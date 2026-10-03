"use client";
import {useState} from "react";
import {ScanLine,Ticket,ArrowRight} from "lucide-react";
import {CouponQrScanner} from "../coupon-qr-scanner";
export function GameRewardCheck({preview=false}:{preview?:boolean}){
 const [code,setCode]=useState(""),[open,setOpen]=useState(false),[initial,setInitial]=useState("");
 return <section className="game-reward-check"><header><span className="game-check-icon"><Ticket size={23}/></span><div><h2>ตรวจและรับรางวัล</h2><p>สแกน QR เพื่อตรวจสิทธิ์ก่อนมอบรางวัล</p></div><button type="button" disabled={preview} onClick={()=>{setInitial("");setOpen(true);}}><ScanLine size={18}/>สแกน</button></header><form onSubmit={e=>{e.preventDefault();if(code.trim()){setInitial(code.trim());setOpen(true);}}}><label htmlFor="game-check-code">หรือใส่รหัสรางวัล</label><div><input id="game-check-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="วางรหัส QR คูปอง / รางวัลเกม" autoComplete="off"/><button type="submit" disabled={preview||!code.trim()} aria-label="ตรวจรหัสรางวัล"><ArrowRight size={18}/></button></div></form>{open&&<CouponQrScanner initialQr={initial} onClose={()=>setOpen(false)}/>}</section>;
}
