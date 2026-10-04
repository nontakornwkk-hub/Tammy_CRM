"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Gift, History, PawPrint, Play, Ticket, X } from "lucide-react";
import { localQr } from "@/lib/customer-qr";
import { cachedMemberGames, loadMemberGames } from "@/lib/games/client";
import { watchCatalogChanges } from "@/lib/catalog-live";
import type { SceneView } from "./admin-game-preview";
import { GameStage, type StageSpin } from "./game-stage";
import { practicePrizes } from "@/lib/games/preview";
import type { GameDefinition, GameProgram, GameGrant, GamePlay, MemberGames, PublicPrize } from "@/lib/games/types";

const empty: MemberGames = { ready: false, program: { purchaseThreshold: 500, earningEnabled: false }, games: [], wallet: { balance: 0, carry: 0 }, plays: [], grants: [] };
const when=(date:string)=>new Date(date).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"});
function prizeText(p:PublicPrize){return p.kind==="points"?`${p.points.toLocaleString()} แต้ม`:p.kind==="coupon"?`ส่วนลด ${p.discountValue}${p.discountType==="percent"?"%":" บาท"}`:"รับของที่ร้าน";}
type Pending={gameKey:string;requestId:string;version:number};
export function MemberGameHub({ member, idToken, accessToken, preview=false, previewGame, previewProgram, sceneView, active=true, onPointsUpdated }: { member: { memberCode: string; name: string; points: number; linePictureUrl?: string|null }; idToken?: string; accessToken?: string; preview?: boolean; previewGame?: GameDefinition; previewProgram?: GameProgram; sceneView?: SceneView; active?:boolean; onPointsUpdated?: (points:number)=>void }) {
  const [data,setData]=useState<MemberGames>(()=>preview?empty:cachedMemberGames(idToken,accessToken)||empty), [statusLoaded,setStatusLoaded]=useState(preview||Boolean(cachedMemberGames(idToken,accessToken))), [key,setKey]=useState("paw-wheel"), [practice,setPractice]=useState(preview), [busy,setBusy]=useState(false), [checking,setChecking]=useState(false), [unavailable,setUnavailable]=useState(""), [error,setError]=useState(""), [spin,setSpin]=useState<StageSpin|null>(null), [slots,setSlots]=useState<PublicPrize[]|null>(null), [dialog,setDialog]=useState<"rules"|"history"|"rewards"|"win"|"availability"|null>(null), [result,setResult]=useState<GamePlay|null>(null), [qr,setQr]=useState(""), [selected,setSelected]=useState<GameGrant|null>(null);
  const lock=useRef(false), outcome=useRef<GamePlay|null>(null), demo=useRef(false), pending=useRef<Pending|null>(null), mounted=useRef(true), pointsCallback=useRef(onPointsUpdated), dialogRef=useRef<HTMLDialogElement>(null);
  pointsCallback.current=onPointsUpdated;
  const storageKey=`tammy-game-pending:${accessToken?.startsWith("test:")?"test":"live"}:${member.memberCode}`;
  const call=useCallback(async(body:object)=>{const response=await fetch("/api/line/member/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,idToken,accessToken}),cache:"no-store"});const json=await response.json();if(!response.ok) {const err=new Error(json.error||"เชื่อมต่อไม่สำเร็จ") as Error&{status:number;code?:string};err.status=response.status;err.code=json.code;throw err;}return json;},[idToken,accessToken]);
  const refresh=useCallback(async()=>{if(preview)return;const next=await loadMemberGames(idToken,accessToken,{fresh:true});if(mounted.current){setData(next);setStatusLoaded(true);}},[idToken,accessToken,preview]);
  useEffect(()=>{mounted.current=true;void refresh().catch(e=>{if(mounted.current)setError(e.message);});let stored:Pending|null=null;try{stored=JSON.parse(sessionStorage.getItem(storageKey)||"null");}catch{}if(stored&&!preview){pending.current=stored;lock.current=true;setBusy(true);void call({action:"recover",...stored}).then(json=>{if(!mounted.current)return;if(json.play){outcome.current=json.play;setResult(json.play);setDialog("win");try{sessionStorage.removeItem(storageKey);}catch{}pending.current=null;if(typeof json.play.points_after==="number")pointsCallback.current?.(json.play.points_after);void refresh().catch(()=>{});}else setError("มีรอบที่ยังไม่ยืนยัน กดหมุนอีกครั้งเพื่อตรวจรอบเดิมโดยไม่หักซ้ำ");}).catch(e=>{if(mounted.current)setError(e.message);}).finally(()=>{lock.current=false;if(mounted.current)setBusy(false);});}return()=>{mounted.current=false;};},[call,refresh,preview,storageKey]);
  useEffect(()=>{if(preview)return;return watchCatalogChanges(()=>{void refresh().catch(()=>{});});},[preview,refresh]);
  useEffect(()=>{if(!dialog||!active)return;const previous=document.activeElement as HTMLElement|null;const el=dialogRef.current;if(el&&!el.open)el.showModal();return()=>{el?.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[dialog,active]);
  useEffect(()=>{if(!selected||dialog!=="rewards"||!active)return;setQr(localQr(`TAMMY-GAME:${selected.qr_token}`,280));const timer=setInterval(()=>void refresh().catch(()=>{}),5000);return()=>{clearInterval(timer);};},[selected,refresh,dialog,active]);
  const game=preview?previewGame:data.games.find(g=>g.key===key)||data.games[0];const program=previewProgram||data.program;const playingDemo=practice||preview;const configured=game?game.prizes:practicePrizes;const displayed=slots||configured;
  useEffect(()=>{if(!busy&&slots&&JSON.stringify(slots)!==JSON.stringify(configured)){setSlots(null);setSpin(null);}},[busy,slots,configured]);
  const finish=()=>{const play=outcome.current;if(!play)return;setResult(play);setDialog("win");setBusy(false);lock.current=false;if(!demo.current){if(typeof play.points_after==="number")onPointsUpdated?.(play.points_after);void refresh().catch(e=>setError(e.message));}};
  const start=async(forcePractice=false)=>{
    if(lock.current)return;
    const asPractice=(forcePractice||playingDemo)&&!pending.current;
    lock.current=true;setBusy(true);setChecking(!asPractice);setError("");demo.current=asPractice;
    try{
      let play:GamePlay;
      if(asPractice){
        if(!configured.length)throw new Error("ยังไม่มีช่องรางวัลพร้อมทดลองเล่น");
        if(forcePractice){setPractice(true);setDialog(null);}
        const r=new Uint32Array(1);crypto.getRandomValues(r);
        play={id:crypto.randomUUID(),game_key:"practice",prize:configured[r[0]%configured.length],created_at:new Date().toISOString(),tickets_before:0,tickets_after:0,slots:configured};
      }else{
        let req=pending.current;
        if(!req){
          // The atomic draw validates balance/version; avoid a status round-trip
          // before every spin. New rights are checked by the draw itself.
          const latest:MemberGames=data.ready?data:await loadMemberGames(idToken,accessToken,{fresh:true});
          if(!mounted.current)return;
          setData(latest);
          const active=latest.games.find(g=>g.key===key)||latest.games[0];
          if(!latest.ready||!active?.prizes.length){
            setUnavailable("ร้านยังไม่มีรอบรางวัลที่พร้อมเล่น ตอนนี้ฝึกหมุนฟรีก่อนได้เลย");
            setDialog("availability");setBusy(false);lock.current=false;return;
          }
          req={gameKey:active.key,requestId:crypto.randomUUID(),version:active.version};
          pending.current=req;try{sessionStorage.setItem(storageKey,JSON.stringify(req));}catch{}
        }
        let json;
        try { json=await call({action:"play",...req}); }
        catch(cause){
          const changed=cause as Error&{code?:string};
          if(changed.code!=="CONFIG_CHANGED")throw cause;
          const latest=await loadMemberGames(idToken,accessToken,{fresh:true}),activeGame=latest.games.find(g=>g.key===req!.gameKey);
          if(!activeGame?.prizes.length)throw cause;
          setData(latest);req={...req,version:activeGame.version};pending.current=req;
          try{sessionStorage.setItem(storageKey,JSON.stringify(req));}catch{}
          // A rejected version consumed nothing. Retry the same round ID once.
          json=await call({action:"play",...req});
        }
        play=json.play;
        pending.current=null;try{sessionStorage.removeItem(storageKey);}catch{}
      }
      if(!mounted.current)return;
      outcome.current=play;setSlots(play.slots||displayed);setSpin({key:play.id,targetId:play.prize.id});
    }catch(e){
      const err=e as Error&{status?:number;code?:string};
      if(err.code==="NO_TICKETS"){setUnavailable("ยังไม่มีสิทธิ์เล่นรางวัลจริง สะสมยอดซื้อเพื่อรับสิทธิ์ หรือฝึกหมุนฟรีก่อนได้เลย");setDialog("availability");}else setError(err.message);
      if(err.status&&err.status<500){pending.current=null;try{sessionStorage.removeItem(storageKey);}catch{}void refresh().catch(()=>{});}
      setBusy(false);lock.current=false;
    }finally{if(mounted.current)setChecking(false);}
  };
  const comingSoon=!preview&&!busy&&statusLoaded&&(!data.ready||!game?.prizes.length);
  const opening=!preview&&!statusLoaded;
  const currentGrant=selected?data.grants.find(g=>g.id===selected.id)||selected:null;
  const grantUsable=currentGrant?.status==="available"&&(!currentGrant.expires_at||new Date(currentGrant.expires_at).getTime()>Date.now());
  return <section className={`paw-game paw-game--cinematic${comingSoon||opening?" paw-game--coming-soon":""}`} aria-label="วงล้ออุ้งเท้า">
    <div className="paw-hud"><span className="paw-profile">{member.linePictureUrl?<img src={member.linePictureUrl} alt=""/>:<PawPrint size={23}/>}<b>{member.name}</b></span><span>🪙 <b>{member.points.toLocaleString()}</b><small>แต้ม</small></span><span><Ticket size={20}/><b>{Math.max(0,data.wallet.balance)+(data.wallet.testBalance||0)}</b><small>{data.wallet.testBalance?`สิทธิ์ · ทดสอบ ${data.wallet.testBalance}`:"สิทธิ์"}</small></span></div>
    {!comingSoon&&!opening&&<><header className="paw-title" data-art-title={!game?.name||game.name==="วงล้ออุ้งเท้า"?"true":"false"}>{(!game?.name||game.name==="วงล้ออุ้งเท้า")&&<img className="paw-title-art" width={1200} height={400} src="/assets/games/reference-art/title.webp" alt="" aria-hidden="true" fetchPriority="high"/>}<h2><PawPrint aria-hidden="true"/>{game?.name||"วงล้ออุ้งเท้า"}<PawPrint aria-hidden="true"/></h2></header>
    {data.games.length>1&&<div className="paw-game-picker">{data.games.map(g=><button key={g.key} disabled={busy} className={game?.key===g.key?"selected":""} onClick={()=>{setKey(g.key);setSlots(null);setSpin(null);}}>{g.name}</button>)}</div>}
    <div className="paw-purchase"><div><span>ซื้อสะสมครบ <b>฿{program.purchaseThreshold.toLocaleString()}</b> รับ 1 สิทธิ์</span><b>อีก ฿{Math.max(0,program.purchaseThreshold-data.wallet.carry).toLocaleString()}</b></div><progress value={Math.min(data.wallet.carry,program.purchaseThreshold)} max={program.purchaseThreshold}/><small>{program.earningEnabled?"สะสมจากยอดซื้อใหม่ · สิทธิ์เก็บไว้เล่นครั้งต่อไปได้":"ร้านยังไม่เปิดสะสมสิทธิ์จากยอดซื้อ"}{data.wallet.balance<0&&" · สิทธิ์จากรายการที่ยกเลิกจะชดเชยด้วยยอดซื้อครั้งถัดไป"}</small></div>
    <GameStage engine={game?.engine||"wheel"} prizes={displayed} spin={spin} onFinish={finish} preparing={checking} view={sceneView} cinematic immersive/><div className="paw-stage-space" aria-hidden="true"/>
    <div className="paw-controls"><button className="paw-spin" disabled={busy||!displayed.length} onClick={()=>void start()}><PawPrint/>{checking?"วงล้อกำลังหมุน…":busy?"วงล้อกำลังหมุน…":pending.current?"ตรวจรอบเดิม":playingDemo?"หมุนทดลองเล่น":"หมุนรับรางวัล"}<Play size={19}/></button><p>{playingDemo?"โหมดฝึก · ไม่ใช้สิทธิ์และไม่ได้รับรางวัลจริง":"ใช้ 1 สิทธิ์ต่อรอบ · ผลบันทึกอัตโนมัติ"}</p>{!preview&&<button className="paw-practice" disabled={busy||Boolean(pending.current)} onClick={()=>{setPractice(v=>!v);setSlots(null);setSpin(null);}}>{practice?"กลับไปเล่นรับรางวัล":"ลองฝึกเล่นฟรี"}</button>}</div>
    </>}
    {(comingSoon||opening)&&<div className="paw-coming-soon" aria-live="polite"><span className="paw-coming-soon-icon"><Gift size={42}/><PawPrint size={22}/></span><small>TAMMY PLAY CLUB</small><h2>{opening?"ลุ้นความสนุกไปด้วยกัน":"เตรียมพบกับการลุ้นรางวัล"}</h2><p>{opening?"กำลังเชื่อมต่อกิจกรรมของร้าน":"น้องหมาน้องแมวกำลังเตรียมของขวัญให้คุณ"}</p>{comingSoon&&<span className="paw-coming-soon-tag">พบกันเร็ว ๆ นี้ 🐾</span>}</div>}
    {error&&<p className="paw-alert" role="status">{error}<button onClick={()=>void refresh().then(()=>setError("")).catch(e=>setError(e.message))}>ตรวจอีกครั้ง</button></p>}
    <nav className="paw-actions"><button onClick={()=>setDialog("rules")}><BookOpen/>กติกา</button><button onClick={()=>setDialog("history")}><History/>ประวัติ</button><button onClick={()=>{setSelected(null);setDialog("rewards");}}><Gift/>รางวัลของฉัน</button></nav>
    {dialog&&active&&createPortal(<dialog ref={dialogRef} className="paw-dialog" aria-label={dialog==="availability"?"สิทธิ์เล่นเกม":dialog==="rules"?"กติกาวงล้ออุ้งเท้า":dialog==="history"?"ประวัติการเล่น":dialog==="rewards"?"รางวัลของฉัน":"ผลการหมุนรางวัล"} onCancel={()=>setDialog(null)} onClick={e=>{if(e.target===e.currentTarget)setDialog(null);}}><div className="paw-dialog-inner"><button className="paw-close" aria-label="ปิด" onClick={()=>setDialog(null)}><X/></button>
      {dialog==="availability"&&<><div className="paw-win-icon"><Ticket size={48}/></div><h2>มาลองหมุนกันก่อน</h2><p>{unavailable}</p><button className="paw-primary" onClick={()=>void start(true)}><Play size={18}/> ฝึกหมุนฟรี</button><p>โหมดฝึกไม่ใช้สิทธิ์ และไม่แจกของรางวัลจริง</p></>}
      {dialog==="win"&&result&&<><div className="paw-win-icon">{result.prize.image?<img src={result.prize.image} alt=""/>:result.prize.kind==="points"?"🪙":result.prize.kind==="coupon"?"🎟️":"🎁"}</div><small>{demo.current?"ผลทดลองเล่น":"ยินดีด้วย!"}</small><h2>{result.prize.kind==="points"?prizeText(result.prize):result.prize.title}</h2><p>{prizeText(result.prize)}</p><p>{demo.current?"รอบนี้เป็นการฝึก ไม่เพิ่มแต้มและไม่แจกของรางวัลจริง":result.prize.kind==="points"?"เพิ่มแต้มเข้าบัญชีเรียบร้อยแล้ว":"เก็บรางวัลไว้แล้ว เปิด QR ในรางวัลของฉันเพื่อรับที่ร้าน"}</p><button className="paw-primary" onClick={()=>{setDialog(result.prize.kind!=="points"&&!demo.current?"rewards":null);setSelected(null);}}> {result.prize.kind!=="points"&&!demo.current?"เปิดรางวัลของฉัน":"เล่นต่อ"}</button></>}
      {dialog==="rules"&&<><small>HOW TO PLAY</small><h2>กติกาวงล้ออุ้งเท้า</h2><ol><li>ยอดซื้อใหม่สะสมครบ {program.purchaseThreshold.toLocaleString()} บาท รับ 1 สิทธิ์ ยอดที่เหลือยกไปครั้งถัดไป</li><li>ใช้ 1 สิทธิ์ต่อรอบ เก็บสิทธิ์ไว้เล่นภายหลังได้ ไม่มีสิทธิ์ฟรีรายวัน</li><li>แต้มเข้าบัญชีอัตโนมัติ คูปองและสินค้าเก็บใน “รางวัลของฉัน”</li><li>คูปองมีเงื่อนไขและวันหมดอายุตามที่แสดงบนรางวัล ต้องแสดง QR ให้พนักงาน</li><li>โหมดฝึกไม่มีรางวัลจริง หากเน็ตหลุด ระบบตรวจรอบเดิมให้ ไม่หักสิทธิ์ซ้ำ</li><li>ยกเลิกยอดซื้อแล้วสิทธิ์จากยอดนั้นจะถูกปรับคืน หากใช้ไปแล้ว ยอดซื้อถัดไปจะชดเชยก่อน</li></ol><p>ขนาดช่องบนวงล้อเป็นภาพประกอบ การได้รับรางวัลขึ้นอยู่กับเงื่อนไขกิจกรรมและจำนวนรางวัลคงเหลือ</p></>}
      {dialog==="history"&&<><small>PLAY HISTORY</small><h2>ประวัติการเล่น</h2><p>100 รายการล่าสุด</p>{!data.plays.length?<p className="paw-empty">เริ่มหมุนครั้งแรกแล้วประวัติจะอยู่ตรงนี้ 🐾</p>:data.plays.map(p=><div className="paw-history" key={p.id}><span>{p.prize.kind==="points"?"🪙":"🎁"}</span><div><b>{p.prize.title}</b><small>{when(p.created_at)}</small></div><b>−1 สิทธิ์</b></div>)}</>}
      {dialog==="rewards"&&<><small>MY PRIZES</small><h2>รางวัลของฉัน</h2>{selected&&currentGrant?<><h3>{currentGrant.title}</h3><p>{prizeText(currentGrant.snapshot)}</p>{currentGrant.kind==="coupon"&&<p>ยอดซื้อขั้นต่ำ ฿{currentGrant.snapshot.minSpend.toLocaleString()}{currentGrant.snapshot.maxDiscount!==null&&` · ลดสูงสุด ฿${currentGrant.snapshot.maxDiscount}`}</p>}<p>{currentGrant.expires_at?`ใช้ก่อน ${when(currentGrant.expires_at)}`:"ไม่กำหนดวันหมดอายุ"}</p>{grantUsable&&qr?<img className="paw-qr" src={qr} alt="QR รับรางวัล แสดงให้พนักงานร้าน"/>:<p>{currentGrant.status==="used"?"ใช้รางวัลแล้ว":grantUsable?"กำลังสร้าง QR…":"รางวัลหมดอายุแล้ว"}</p>}<button className="paw-primary" onClick={()=>setSelected(null)}>กลับไปดูรางวัล</button></>:!data.grants.length?<p className="paw-empty">คูปองและของขวัญที่ได้รับจะอยู่ตรงนี้ 🎁</p>:data.grants.map(g=><button className="paw-grant" key={g.id} onClick={()=>setSelected(g)}><span>🎁</span><div><b>{g.title}</b><small>{g.status==="used"?"ใช้แล้ว":g.expires_at&&new Date(g.expires_at).getTime()<=Date.now()?"หมดอายุ":g.expires_at?`ใช้ก่อน ${when(g.expires_at)}`:"พร้อมใช้"}</small></div><span>ดู QR ›</span></button>)}</>}
    </div></dialog>,document.body)}
  </section>;
}
