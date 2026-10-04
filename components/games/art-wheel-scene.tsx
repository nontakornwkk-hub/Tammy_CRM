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
export function ArtWheelScene({prizes,spin,onFinish,preparing=false,view,immersive=false}:{prizes:PublicPrize[];spin:StageSpin|null;onFinish:()=>void;preparing?:boolean;view?:SceneView;immersive?:boolean;cinematic?:boolean}){
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
    if(!preparing||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    let frame=0,last=performance.now();
    const tick=(now:number)=>{angle.current+=(now-last)*.008;last=now;const degrees=angle.current*180/Math.PI;
      if(rotor.current){rotor.current.style.transform=`rotate(${-degrees}deg)`;rotor.current.style.setProperty("--paw-counter-angle",`${degrees}deg`);}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[preparing]);
  useEffect(()=>{
    if(!spin){if(preparing)return;angle.current=0;completed.current=null;if(rotor.current)rotor.current.style.transform="rotate(0deg)";rotor.current?.style.setProperty("--paw-counter-angle","0deg");return;}
    if(completed.current===spin.key)return;
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
        rotor.current.style.setProperty("--paw-counter-angle",`${degrees}deg`);
      }
      if(t<1)frame=requestAnimationFrame(tick);else{completed.current=spin.key;root.current?.classList.remove("is-spinning");finish.current();}
    };
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);root.current?.classList.remove("is-spinning");};
  },[spin,count,prizes,preparing]);
  return <div ref={root} className={`paw-scene paw-art-scene${immersive?" paw-art-scene--immersive":""}${view?.lighting==="day"?" paw-art-scene--day":""}`} role="img" aria-label={`วงล้ออุ้งเท้า ${count} ช่องรางวัล พร้อมน้องหมาและน้องแมว`}>
    <img className="paw-art-backdrop" width={1086} height={1448} src={`${ART}shop.webp`} alt="" fetchPriority="high" draggable={false}/>
    <div className="paw-art-wheel">
      <div ref={rotor} className="paw-art-rotor" data-testid="prize-rotor">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>{prizes.map((p,i)=><linearGradient key={p.id} id={`${uid}-sector-${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={tint(p.color,.25)}/><stop offset=".4" stopColor={p.color}/><stop offset="1" stopColor={tint(p.color,-.25)}/></linearGradient>)}<radialGradient id={`${uid}-sheen`} cx=".25" cy=".18" r=".85"><stop stopColor="#fff" stopOpacity=".25"/><stop offset=".65" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#001c40" stopOpacity=".13"/></radialGradient></defs>
          <circle cx="50" cy="50" r="47" fill="#c98516"/>
          <g data-testid="wheel-sectors">{prizes.map((p,i)=>count===1?<circle key={p.id} cx="50" cy="50" r="46" fill={`url(#${uid}-sector-${i})`}/>:<path key={p.id} d={sector(i,count)} fill={`url(#${uid}-sector-${i})`} stroke="#ffd979" strokeWidth=".65"/>)}</g>
          <g data-testid="wheel-prizes">{prizes.map((p,i)=>{
            const hasLabel=p.kind==="points"||p.kind==="coupon",cell=iconCell(p),theta=i*Math.PI*2/count,icon=polar(theta,hasLabel?34:29),label=polar(theta,22);
            const size=Math.min(hasLabel?13:22,75*Math.sin(Math.PI/Math.max(2,count))),value=p.kind==="points"?String(p.points):`${p.discountValue}${p.discountType==="percent"?"%":""}`,fontSize=Math.min(5.8,27/Math.max(1,value.length),30*Math.sin(Math.PI/Math.max(2,count)));
            const upright={transform:"rotate(var(--paw-counter-angle,0deg))",transformOrigin:"0px 0px"};
            return <g key={p.id} data-prize-id={p.id}><title>{`${p.title}${hasLabel?` · ${value}${p.kind==="points"?" แต้ม":p.discountType==="fixed"?" บาท":""}`:""}`}</title>
              <g transform={`translate(${icon.x} ${icon.y})`}><g style={upright}>{p.image?<image href={p.image} x={-size/2} y={-size/2} width={size} height={size} preserveAspectRatio="xMidYMid meet"/>:<svg x={-size/2} y={-size/2} width={size} height={size} viewBox={`${cell%3*512} ${Math.floor(cell/3)*512} 512 512`} overflow="hidden"><image href={`${ART}icons.webp`} width="1536" height="1024"/></svg>}</g></g>
              {hasLabel&&<g transform={`translate(${label.x} ${label.y})`}><g className="paw-wheel-value" style={upright}><text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight="900">{value}</text>{(p.kind==="points"||p.discountType==="fixed")&&<text className="paw-wheel-unit" x="0" y="4.2" textAnchor="middle" fontSize="2.7" fontWeight="700">{p.kind==="points"?"แต้ม":"บาท"}</text>}</g></g>}
            </g>;
          })}</g>
          <circle cx="50" cy="50" r="46" fill={`url(#${uid}-sheen)`}/>
        </svg>
      </div>
      <img className="paw-art-frame" data-testid="stationary-paw-frame" width={1122} height={1402} src={`${ART}frame.webp`} alt="" fetchPriority="high" draggable={false}/>
    </div>
    {view?.pets!==false&&<div className="paw-art-pets" aria-hidden="true"><div className="paw-art-pet paw-art-pet--dog"><img width={1536} height={1024} src={`${ART}pets.webp`} alt="" draggable={false}/></div><div className="paw-art-pet paw-art-pet--cat"><img src={`${ART}pets.webp`} alt="" draggable={false}/></div></div>}
  </div>;
}
