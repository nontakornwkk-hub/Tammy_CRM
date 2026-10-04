"use client";
import { useEffect, useId, useRef } from "react";
import { gameEngines, wheelTarget } from "@/lib/games/registry";
import type { PublicPrize } from "@/lib/games/types";
import type { StageSpin } from "./game-stage";
import type { SceneView } from "./admin-game-preview";

const ART="/assets/games/reference-art/";
const polar=(angle:number,radius=46)=>({x:50+Math.sin(angle)*radius,y:50-Math.cos(angle)*radius});
function sector(index:number,count:number){
  const step=Math.PI*2/count,a=polar(index*step-step/2),b=polar(index*step+step/2);
  return `M50 50 L${a.x} ${a.y} A46 46 0 ${step>Math.PI?1:0} 1 ${b.x} ${b.y} Z`;
}
function tint(hex:string,amount:number){
  const color=hex.replace("#","");if(!/^[0-9a-f]{6}$/i.test(color))return hex;
  const rgb=[0,2,4].map(i=>parseInt(color.slice(i,i+2),16));return `rgb(${rgb.map(c=>Math.round(amount>0?c+(255-c)*amount:c*(1+amount))).join(",")})`;
}
function iconCell(prize:PublicPrize){return prize.kind==="points"?0:prize.kind==="coupon"?1:/อาหาร/.test(prize.title)?2:/ขนม/.test(prize.title)?3:/กระดูก|บิสกิต/.test(prize.title)?5:4;}
export function ArtWheelScene({prizes,spin,onFinish,view,immersive=false}:{prizes:PublicPrize[];spin:StageSpin|null;onFinish:()=>void;view?:SceneView;immersive?:boolean;cinematic?:boolean}){
  const root=useRef<HTMLDivElement>(null),rotor=useRef<HTMLDivElement>(null),angle=useRef(0),completed=useRef<string|null>(null),finish=useRef(onFinish);
  finish.current=onFinish;
  const uid=useId().replace(/:/g,""),count=prizes.length;
  useEffect(()=>{
    const el=root.current;if(!el)return;
    const resize=()=>{
      const width=el.clientWidth,height=el.clientHeight;if(!width||!height)return;
      const wheelWidth=width*(view?.camera==="close"?(immersive?.76:.68):(immersive?.70:.61)),wheelHeight=wheelWidth*1.24955;
      const anchor=immersive?el.parentElement?.querySelector(".paw-stage-space"):null;
      let center=height*.41;
      if(anchor){const a=anchor.getBoundingClientRect(),r=el.getBoundingClientRect();center=a.top-r.top+a.height*.39;}
      const top=center-wheelHeight*.44;
      el.style.setProperty("--art-wheel-width",`${wheelWidth}px`);el.style.setProperty("--art-wheel-top",`${top}px`);
      el.style.setProperty("--art-pet-bottom",`${height-(top+wheelHeight)+7}px`);
    };
    resize();const observer=new ResizeObserver(resize);observer.observe(el);if(immersive&&el.parentElement)observer.observe(el.parentElement);return()=>observer.disconnect();
  },[immersive,view?.camera]);
  useEffect(()=>{
    if(!spin||completed.current===spin.key)return;
    const index=prizes.findIndex(p=>p.id===spin.targetId);
    if(index<0){completed.current=spin.key;finish.current();return;}
    const from=angle.current,to=wheelTarget(from,index,count),start=performance.now();
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches,duration=reduced?800:gameEngines.wheel.durationMs;
    let frame=0;
    root.current?.classList.add("is-spinning");
    const tick=(now:number)=>{
      const t=Math.min(1,(now-start)/duration);angle.current=from+(to-from)*(1-Math.pow(1-t,4));
      // DOM's positive rotation is clockwise; the server's target uses counterclockwise angles.
      if(rotor.current){
        const degrees=angle.current*180/Math.PI;
        rotor.current.style.transform=`rotate(${-degrees}deg)`;
        rotor.current.style.setProperty("--art-counter-rotation",`${degrees}deg`);
      }
      if(t<1)frame=requestAnimationFrame(tick);else{completed.current=spin.key;root.current?.classList.remove("is-spinning");finish.current();}
    };
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);root.current?.classList.remove("is-spinning");};
  },[spin,count,prizes]);
  return <div ref={root} className={`paw-scene paw-art-scene${immersive?" paw-art-scene--immersive":""}${view?.lighting==="day"?" paw-art-scene--day":""}`} role="img" aria-label={`วงล้ออุ้งเท้า ${count} ช่องรางวัล พร้อมน้องหมาและน้องแมว`}>
    <img className="paw-art-backdrop" width={1086} height={1448} src={`${ART}shop.webp`} alt="" fetchPriority="high" draggable={false}/>
    <div className="paw-art-wheel">
      <div ref={rotor} className="paw-art-rotor" data-testid="prize-rotor">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>{prizes.map((p,i)=><linearGradient key={p.id} id={`${uid}-sector-${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={tint(p.color,.25)}/><stop offset=".4" stopColor={p.color}/><stop offset="1" stopColor={tint(p.color,-.25)}/></linearGradient>)}<radialGradient id={`${uid}-sheen`} cx=".25" cy=".18" r=".85"><stop stopColor="#fff" stopOpacity=".25"/><stop offset=".65" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#001c40" stopOpacity=".13"/></radialGradient></defs>
          <circle cx="50" cy="50" r="47" fill="#c98516"/>
          {prizes.map((p,i)=>{const pos=polar(i*Math.PI*2/count,27),label=polar(i*Math.PI*2/count,34),cell=iconCell(p),size=Math.min(24,156/count);return <g key={p.id}>
            {count===1?<circle cx="50" cy="50" r="46" fill={`url(#${uid}-sector-${i})`}/>:<path d={sector(i,count)} fill={`url(#${uid}-sector-${i})`} stroke="#ffc857" strokeWidth=".7"/>}
            {p.image?<image href={p.image} x={pos.x-size/2} y={pos.y-size/2} width={size} height={size} preserveAspectRatio="xMidYMid meet"/>:<svg x={pos.x-size/2} y={pos.y-size/2} width={size} height={size} viewBox={`${cell%3*512} ${Math.floor(cell/3)*512} 512 512`} overflow="hidden"><image href={`${ART}icons.webp`} width="1536" height="1024"/></svg>}
            {(p.kind==="points"||p.kind==="coupon")&&<g className="paw-art-label"><rect x={label.x-11.5} y={label.y-4} width="23" height="8" rx="4" fill="#fff9e6" stroke="#e6aa37" strokeWidth=".45"/><text x={label.x} y={label.y+.25} dominantBaseline="middle" textAnchor="middle" fill="#123963" fontSize="5" fontWeight="800">{p.kind==="points"?`${p.points} แต้ม`:`${p.discountValue}${p.discountType==="percent"?"%":" บาท"}`}</text></g>}
          </g>;})}
          <circle cx="50" cy="50" r="46" fill={`url(#${uid}-sheen)`}/>
        </svg>
      </div>
      <img className="paw-art-frame" data-testid="stationary-paw-frame" width={1122} height={1402} src={`${ART}frame.webp`} alt="" fetchPriority="high" draggable={false}/>
    </div>
    {view?.pets!==false&&<div className="paw-art-pets" aria-hidden="true"><div className="paw-art-pet paw-art-pet--dog"><img width={1536} height={1024} src={`${ART}pets.webp`} alt="" draggable={false}/></div><div className="paw-art-pet paw-art-pet--cat"><img src={`${ART}pets.webp`} alt="" draggable={false}/></div></div>}
  </div>;
}
