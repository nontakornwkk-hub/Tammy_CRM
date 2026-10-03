"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
export function GameQrScanner({ onCode, onClose }: { onCode:(code:string)=>void;onClose:()=>void }){
  const video=useRef<HTMLVideoElement>(null),dialog=useRef<HTMLDialogElement>(null),[error,setError]=useState("");
  const codeCallback=useRef(onCode);codeCallback.current=onCode;
  useEffect(()=>{dialog.current?.showModal();let live=true;let scanner:import("qr-scanner").default|undefined;
    void import("qr-scanner").then(async({default:QrScanner})=>{if(!live||!video.current)return;scanner=new QrScanner(video.current,result=>{if(!live)return;if(!/^TAMMY-GAME:[0-9a-f-]{36}$/i.test(result.data)){setError("QR นี้เป็นรหัสอื่น กรุณาเปิดรางวัลจากเกม");return;}scanner?.stop();codeCallback.current(result.data);},{preferredCamera:"environment",highlightScanRegion:true,returnDetailedScanResult:true});try{await scanner.start();if(!live)scanner.destroy();}catch{if(live)setError("เปิดกล้องไม่ได้ กรุณาอนุญาตกล้อง หรือวางรหัส QR แทน");}});
    return()=>{live=false;scanner?.destroy();};
  },[]);
  return <dialog ref={dialog} className="paw-dialog game-camera" onCancel={onClose}><div className="paw-dialog-inner"><button className="paw-close" onClick={onClose} aria-label="ปิดกล้อง"><X/></button><h2>สแกนรางวัลของสมาชิก</h2><video ref={video} muted playsInline/><p>{error||"วาง QR ไว้ในกรอบ เพื่ออ่านรหัสรางวัล"}</p></div></dialog>;
}
