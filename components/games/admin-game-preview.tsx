"use client";
import { useMemo, useRef, useState } from "react";
import { Camera, Maximize, PawPrint, RotateCcw } from "lucide-react";
import { MemberGameHub } from "./member-game-hub";
import type { GameDefinition, GameProgram, PublicPrize } from "@/lib/games/types";
export type SceneView={ camera:"front"|"close"; lighting:"warm"|"day"; pets:boolean };
export const defaultSceneView:SceneView={camera:"front",lighting:"warm",pets:true};
export function AdminGamePreview({prizes,name="วงล้ออุ้งเท้า",program,view,onView}:{prizes:PublicPrize[];name?:string;program?:GameProgram;view:SceneView;onView:(view:SceneView)=>void}){
  const root=useRef<HTMLElement>(null),[version,setVersion]=useState(0),[error,setError]=useState("");
  const game=useMemo<GameDefinition>(()=>({id:"preview",key:"preview",engine:"wheel",name,difficulty:"easy",enabled:true,version:0,prizes}),[name,prizes]);
  return <aside ref={root} className="game-preview game-studio-preview"><header><h2><PawPrint size={21}/>ตัวอย่างหน้าผู้ใช้</h2><div className="game-preview-tools"><label><Camera size={16}/><select aria-label="มุมกล้องตัวอย่าง" value={view.camera} onChange={e=>onView({...view,camera:e.target.value as SceneView["camera"]})}><option value="front">มุมกล้อง</option><option value="close">ใกล้วงล้อ</option></select></label><button aria-label="ดูตัวอย่างเต็มจอ" onClick={()=>void root.current?.requestFullscreen().catch(()=>setError("เบราว์เซอร์นี้ไม่รองรับเต็มจอ"))}><Maximize size={17}/></button><button aria-label="เริ่มตัวอย่างใหม่" onClick={()=>setVersion(v=>v+1)}><RotateCcw size={17}/></button></div></header><div className="game-phone-frame"><div className="game-phone-screen"><div className="game-phone-status"><span>9:41</span><i aria-hidden="true"/><span>▮▮▮ ▰</span></div><MemberGameHub key={version} preview previewGame={game} previewProgram={program} sceneView={view} member={{memberCode:"preview",name:"คุณสมาชิก",points:141}}/><div className="game-phone-home" aria-hidden="true"/></div></div><p className="game-phone-caption">หน้าจอเดียวกับสมาชิก · ใช้รางวัลและลำดับที่กำลังตั้งค่า<br/>ทดลองหมุนไม่หักสิทธิ์และไม่แจกของจริง</p>{!prizes.length&&<p className="game-preview-empty">เปิดช่องที่มีเรทและสต็อกเพื่อทดลองหมุน</p>}{error&&<p role="status">{error}</p>}</aside>;
}
