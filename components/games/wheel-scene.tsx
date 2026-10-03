"use client";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { wheelTarget } from "@/lib/games/registry";
import type { PublicPrize } from "@/lib/games/types";
import type { StageSpin } from "./game-stage";
import type { SceneView } from "./admin-game-preview";

const gold = new T.MeshPhysicalMaterial({ color: "#ffae1c", metalness: .82, roughness: .23, clearcoat: 1 });
function material(color: string, metalness = 0) { return new T.MeshStandardMaterial({ color, roughness: .38, metalness }); }
function mesh(parent: T.Object3D, geometry: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function sphere(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, a: number, b = a, c = a) { const m = mesh(parent, new T.SphereGeometry(1, 24, 16), mat, x, y, z); m.scale.set(a, b, c); return m; }
function paw(parent: T.Object3D, x: number, y: number, z: number, scale: number, mat: T.Material) {
  const p = new T.Group(); p.position.set(x, y, z); p.scale.setScalar(scale); parent.add(p);
  sphere(p, mat, 0, -.09, 0, .23, .2, .08);
  [[-.25,.12],[-.1,.29],[.1,.29],[.25,.12]].forEach(([a,b]) => sphere(p,mat,a,b,0,.095,.13,.075)); return p;
}
function pet(cat: boolean) {
  const p = new T.Group(), fur = material(cat ? "#a7a29a" : "#cd833f"), white = material("#fff0d6"), dark = material("#28232a"), pink = material("#ff8c9a"), collar = material(cat ? "#00945c" : "#075dda");
  sphere(p,fur,0,.65,0,.36,.53,.31); sphere(p,white,0,.64,.22,.24,.35,.1);
  for (const x of [-.22,.22]) { sphere(p,white,x,.17,.17,.18,.15,.24); sphere(p,fur,x,.59,.28,.12,.24,.12); }
  sphere(p,fur,0,1.21,.06,.43,.38,.33);
  for (const x of [-.31,.31]) {
    if (cat) { const ear=mesh(p,new T.ConeGeometry(.2,.4,3),fur,x,1.58,.04); ear.rotation.z=x<0?.25:-.25; mesh(p,new T.ConeGeometry(.12,.25,3),pink,x,1.6,.12); }
    else sphere(p,fur,x*1.28,1.17,.025,.18,.37,.15);
    sphere(p,white,x*.64,1.21,.32,.17,.19,.1); sphere(p,dark,x*.62,1.23,.407,.097,.115,.04); sphere(p,material("#ffffff"),x*.62-.025,1.27,.44,.025);
  }
  sphere(p,white,0,1.02,.34,.24,.15,.12); sphere(p,dark,0,1.085,.455,.065,.043,.03);
  sphere(p,dark,0,.963,.445,.085,.048,.025); sphere(p,pink,0,.947,.47,.04,.046,.012);
  const band=mesh(p,new T.TorusGeometry(.27,.045,8,32),collar,0,.9,.06); band.rotation.x=Math.PI/2;
  const scarf=mesh(p,new T.ConeGeometry(.2,.3,3),collar,0,.75,.35); scarf.rotation.z=Math.PI;
  sphere(p,gold,.06,.86,.4,.045); const tail=new T.CatmullRomCurve3([new T.Vector3(.2,.35,-.18),new T.Vector3(.54,.5,-.12),new T.Vector3(.56,.9,-.05)]); mesh(p,new T.TubeGeometry(tail,16,.09,8,false),fur);
  if(cat) for(const side of [-1,1]) for(let i=0;i<3;i++) { const line=new T.BufferGeometry().setFromPoints([new T.Vector3(side*.14,1.04-i*.035,.45),new T.Vector3(side*.44,1.08-i*.08,.43)]); p.add(new T.Line(line,new T.LineBasicMaterial({color:"#6b5849"}))); }
  return p;
}
function prizeModel(parent:T.Object3D, prize:PublicPrize, textures:T.Texture[]) {
  const cream=material("#ffeb92",.5), blue=material("#0876ee",.35);
  if(prize.kind==="points") {
    for(const [x,y,z] of [[-.13,-.1,.04],[.12,-.03,.12],[0,.18,.04]]) {
      const coin=mesh(parent,new T.CylinderGeometry(.19,.19,.08,40),gold,x,y,z);coin.rotation.x=Math.PI/2;
      mesh(parent,new T.TorusGeometry(.151,.013,8,32),cream,x,y,z+.046);paw(parent,x,y,z+.052,.32,cream);
    }
  } else if(prize.kind==="coupon") {
    const shape=new T.Shape();shape.moveTo(-.28,-.19);shape.lineTo(.28,-.19);shape.lineTo(.28,-.065);shape.quadraticCurveTo(.18,0,.28,.065);shape.lineTo(.28,.19);shape.lineTo(-.28,.19);shape.lineTo(-.28,.065);shape.quadraticCurveTo(-.18,0,-.28,-.065);shape.closePath();
    mesh(parent,new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:3}),material("#e9f5ff",.2));
    mesh(parent,new T.BoxGeometry(.4,.28,.035),blue,0,0,.065);
    const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.font="bold 100px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("%",64,71);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);mesh(parent,new T.PlaneGeometry(.26,.26),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),0,0,.09);parent.rotation.z=-.2;
  } else if(/อาหาร/.test(prize.title)) {
    mesh(parent,new T.BoxGeometry(.36,.49,.17),material("#9e5025"),0,0,0);
    mesh(parent,new T.BoxGeometry(.38,.045,.18),gold,0,.25,0);
    mesh(parent,new T.BoxGeometry(.3,.29,.018),material("#f5cf80"),0,-.01,.095);
    paw(parent,0,.035,.12,.37,material("#a6532e"));
    for(const [x,y] of [[-.09,-.13],[0,-.15],[.1,-.13]])sphere(parent,material("#905028"),x,y,.12,.035,.025,.026);
  } else if(/ขนม/.test(prize.title)) {
    const can=mesh(parent,new T.CylinderGeometry(.2,.2,.33,40),material("#139960",.3),0,-.04,0);can.rotation.x=Math.PI/2;
    mesh(parent,new T.TorusGeometry(.18,.023,8,40),gold,0,-.04,.18);paw(parent,0,-.04,.195,.4,cream);
    sphere(parent,material("#a85328"),0,.2,.04,.12,.06,.05);
  } else {
    mesh(parent,new T.BoxGeometry(.4,.37,.24),material("#ffbe35",.25),0,-.035,0);
    mesh(parent,new T.BoxGeometry(.44,.095,.28),gold,0,.18,0);
    mesh(parent,new T.BoxGeometry(.07,.45,.025),blue,0,0,.15);
    mesh(parent,new T.BoxGeometry(.42,.065,.027),blue,0,.035,.15);
    for(const side of [-1,1]){const bow=mesh(parent,new T.TorusGeometry(.09,.025,8,24),blue,side*.084,.25,.02);bow.scale.set(1,.6,1);bow.rotation.z=side*.45;}
    paw(parent,.11,-.08,.15,.22,material("#805022"));
  }
}
function labelTexture(prize: PublicPrize, onTexture: (texture: T.Texture) => void, alive: () => boolean, cinematic=false) {
  const canvas=document.createElement("canvas"); canvas.width=384; canvas.height=256;
  const ctx=canvas.getContext("2d")!;
  const draw=(img?: HTMLImageElement) => {
    ctx.clearRect(0,0,384,256); ctx.textAlign="center"; ctx.textBaseline="middle";
    if(img) { const r=Math.min(150/img.width,140/img.height); ctx.drawImage(img,192-img.width*r/2,10,img.width*r,img.height*r); }
    else if(!cinematic) { ctx.font="100px Arial"; ctx.fillText(prize.kind==="points"?"🪙":prize.kind==="coupon"?"🎟️":"🎁",192,90); }
    ctx.font='bold 30px "Noto Sans Thai", sans-serif'; ctx.fillStyle="#ffffff"; ctx.shadowColor="#00204c"; ctx.shadowBlur=5; ctx.fillText(prize.title.length>16?prize.title.slice(0,15)+"…":prize.title,192,205,360); ctx.shadowBlur=0;
  };
  draw(); const tex=new T.CanvasTexture(canvas); tex.colorSpace=T.SRGBColorSpace; onTexture(tex);
  if(prize.image) { const img=new window.Image(); img.crossOrigin="anonymous"; img.onload=()=>{if(alive()){draw(img);tex.needsUpdate=true;}}; img.src=prize.image; }
  return tex;
}
export function WheelScene({ prizes, spin, onFinish,view,cinematic=false }: { prizes: PublicPrize[]; spin: StageSpin | null; onFinish: () => void;view?:SceneView;cinematic?:boolean }) {
  const root=useRef<HTMLDivElement>(null), animation=useRef<{ key: string; targetId: string } | null>(spin), finish=useRef(onFinish), completed=useRef<string|null>(null);
  const [failed,setFailed]=useState(false); animation.current=spin; finish.current=onFinish;
  useEffect(()=>{
    const el=root.current; if(!el || !prizes.length)return;
    let renderer:T.WebGLRenderer; try { renderer=new T.WebGLRenderer({antialias:true,alpha:cinematic,powerPreference:"high-performance"}); } catch {setFailed(true);return;}
    setFailed(false); let disposed=false, frame=0, visible=true, lastKey=completed.current||"", move:{start:number;from:number;to:number;key:string}|null=null;
    const textures:T.Texture[]=[]; const scene=new T.Scene();if(!cinematic){scene.background=new T.Color("#d8b18a");scene.fog=new T.Fog("#d8b18a",12,24);}
    const camera=cinematic?new T.OrthographicCamera(-2.1,2.1,2.1,-2.1,.1,40):new T.PerspectiveCamera(34,1,.1,40);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=cinematic?.95:1.25;
    el.appendChild(renderer.domElement);
    const pmrem=new T.PMREMGenerator(renderer), room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
    scene.environmentIntensity=cinematic?.65:1;
    scene.add(new T.HemisphereLight("#fff6df","#74583e",cinematic?.7:2)); const sun=new T.DirectionalLight("#fff4d6",cinematic?2.2:4); sun.position.set(-3,7,5); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-5; sun.shadow.camera.right=5; sun.shadow.camera.top=6; sun.shadow.camera.bottom=-3; scene.add(sun);
    const fill=new T.PointLight("#54b7ff",cinematic?4:12,10);fill.position.set(3,4,3);scene.add(fill);
    if(view?.lighting==="day"){sun.color.set("#ffffff");renderer.toneMappingExposure=1.5;}
    if(!cinematic){mesh(scene,new T.BoxGeometry(12,.12,12),material("#bd844e"),0,-.1,0);
    for(let x=-6;x<6;x+=.6)mesh(scene,new T.BoxGeometry(.014,.01,12),material("#94603b"),x,-.031,0);
    mesh(scene,new T.BoxGeometry(12,7,.2),material("#b78358"),0,3,-2.8);
    for(const x of [-3.5,3.5]){
      mesh(scene,new T.BoxGeometry(1.8,4.8,.55),material("#62412a"),x,2,-2.4);
      for(let y=.45;y<4.8;y+=.85){mesh(scene,new T.BoxGeometry(1.9,.09,.8),material("#996636"),x,y,-2.05);for(let i=0;i<4;i++)mesh(scene,new T.BoxGeometry(.27,.51,.23),material(["#1166d3","#f39223","#139568","#d24434"][i]),x-.6+i*.4,y+.3,-1.98);}
    }
    const sign=document.createElement("canvas");sign.width=512;sign.height=160;const sc=sign.getContext("2d")!;sc.fillStyle="#e2ad61";sc.fillRect(0,0,512,160);sc.fillStyle="#66380c";sc.textAlign="center";sc.font="bold 70px sans-serif";sc.fillText("TAMMY",256,83);sc.font="26px sans-serif";sc.fillText("PET SHOP • PLAY & WIN",256,127);const st=new T.CanvasTexture(sign);st.colorSpace=T.SRGBColorSpace;textures.push(st);mesh(scene,new T.BoxGeometry(2.8,.87,.13),new T.MeshStandardMaterial({map:st,roughness:.6}),0,4.65,-2.62);
    for(const x of [-2,2]){mesh(scene,new T.CylinderGeometry(.008,.008,1,8),material("#343434"),x,5.3,-1.3);mesh(scene,new T.ConeGeometry(.3,.2,24),gold,x,4.8,-1.3);const l=new T.PointLight("#ffd08b",4,4);l.position.set(x,4.65,-1.3);scene.add(l);}}
    mesh(scene,new T.CylinderGeometry(1.48,1.7,.25,48),material("#0741a8",.35),0,.14,0);mesh(scene,new T.CylinderGeometry(1.5,1.72,.05,48),gold,0,.03,0);
    for(const x of [-.75,.75])mesh(scene,new T.BoxGeometry(.24,1.25,.36),material("#0741a8",.3),x,.73,-.12);
    if(cinematic){const badge=mesh(scene,new T.CylinderGeometry(.32,.32,.12,40),material("#073b92",.55),0,.27,1.5);badge.rotation.x=Math.PI/2;paw(scene,0,.27,1.58,.6,gold);for(const x of [-1.1,1.1]){sphere(scene,gold,x,.26,1.02,.045);sphere(scene,gold,x,.26,1.35,.045);}}
    const wheel=new T.Group();wheel.position.set(0,2.25,.08);scene.add(wheel);
    const back=mesh(wheel,new T.CylinderGeometry(1.56,1.56,.26,64),gold);back.rotation.x=Math.PI/2;
    const rim=mesh(wheel,new T.TorusGeometry(1.48,.095,12,96),gold,0,0,.18);
    const count=prizes.length, step=Math.PI*2/count;
    if(animation.current?.key===completed.current){const index=prizes.findIndex(p=>p.id===animation.current?.targetId);if(index>=0)wheel.rotation.z=wheelTarget(0,index,count)%(Math.PI*2);}
    prizes.forEach((p,i)=>{const a=Math.PI/2-i*step;const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(1.37*Math.cos(a-step/2),1.37*Math.sin(a-step/2));shape.absarc(0,0,1.37,a-step/2,a+step/2,false);shape.lineTo(0,0);const geo=new T.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.015,bevelThickness:.02,curveSegments:32});mesh(wheel,geo,cinematic?new T.MeshPhysicalMaterial({color:p.color,metalness:.08,roughness:.24,clearcoat:1,envMapIntensity:.2}):material(p.color,.18),0,0,.12);
      const texture=labelTexture(p,t=>textures.push(t),()=>!disposed,cinematic); const face=mesh(wheel,new T.PlaneGeometry(.78,.52),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),Math.cos(a)*.89,Math.sin(a)*.89,.29);face.rotation.z=a-Math.PI/2;
      if(cinematic&&!p.image){const icon=new T.Group();icon.position.set(Math.cos(a)*.99,Math.sin(a)*.99,.31);icon.rotation.z=a-Math.PI/2;wheel.add(icon);prizeModel(icon,p,textures);}
      if(cinematic){const edge=new T.Group();edge.rotation.z=a-step/2;wheel.add(edge);mesh(edge,new T.BoxGeometry(1.33,.027,.04),gold,.67,0,.265);}
    });
    mesh(wheel,new T.TorusGeometry(.42,.07,10,48),gold,0,0,.34);const hub=mesh(wheel,new T.CylinderGeometry(.4,.4,.18,48),gold,0,0,.31);hub.rotation.x=Math.PI/2;paw(wheel,0,0,.45,.7,material("#ffe28a",.4));
    for(let i=0;i<24;i++){const a=i*Math.PI/12;sphere(wheel,new T.MeshStandardMaterial({color:"#ffedaa",emissive:"#ffbd45",emissiveIntensity:1.5}),Math.cos(a)*1.49,Math.sin(a)*1.49,.23,.04);}
    const pointer=mesh(scene,new T.ConeGeometry(cinematic?.2:.16,cinematic?.5:.4,3),gold,0,3.74,.65);pointer.rotation.z=Math.PI;if(cinematic){sphere(scene,gold,0,3.94,.62,.23,.22,.09);mesh(scene,new T.TorusGeometry(.18,.018,8,32),material("#fff0bc",.45),0,3.94,.72);}paw(scene,0,cinematic?3.96:3.84,.76,cinematic?.39:.27,material("#fff0bc",.4));
    const dog=pet(false),cat=pet(true);dog.position.set(-1.62,.08,.5);dog.rotation.y=.26;dog.scale.setScalar(.86);cat.position.set(1.62,.23,.45);cat.rotation.y=-.26;cat.scale.setScalar(.82);scene.add(dog,cat);mesh(scene,new T.BoxGeometry(.8,.28,.7),material("#c38b55"),1.62,.06,.42);
    dog.visible=cat.visible=!cinematic&&view?.pets!==false;
    if(cinematic){const crate=scene.children.find(o=>o instanceof T.Mesh&&o.position.x===1.62&&o.position.y===.06);if(crate)crate.visible=false;}
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight; if(!w||!h)return;renderer.setSize(w,h,false);if(camera instanceof T.OrthographicCamera){camera.left=-2.1;camera.right=2.1;camera.top=2.1*h/w;camera.bottom=-2.1*h/w;camera.position.set(0,2.02,9);}else{camera.aspect=w/h;camera.position.set(0,3.2,Math.max(view?.camera==="close"?6.4:7.5,(view?.camera==="close"?3.7:4.4)/(2*Math.tan(T.MathUtils.degToRad(17))*camera.aspect)));}camera.lookAt(0,2.02,0);camera.updateProjectionMatrix();};resize();const ro=new ResizeObserver(resize);ro.observe(el);
    const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});io.observe(el);
    const lost=(event:Event)=>{event.preventDefault();setFailed(true);};renderer.domElement.addEventListener("webglcontextlost",lost);
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick=(now:number)=>{
      if(disposed)return; frame=requestAnimationFrame(tick);
      const s=animation.current;if(s&&s.key!==lastKey){lastKey=s.key;const index=prizes.findIndex(p=>p.id===s.targetId);if(index>=0)move={start:now,from:wheel.rotation.z,to:wheelTarget(wheel.rotation.z,index,count),key:s.key};else {completed.current=s.key;finish.current();}}
      if(move&&completed.current===move.key)move=null;
      if(move){const t=Math.min(1,(now-move.start)/(reduced?800:5200));wheel.rotation.z=move.from+(move.to-move.from)*(1-Math.pow(1-t,4));if(t===1){completed.current=move.key;move=null;finish.current();}}
      if(visible&&!document.hidden){if(!reduced){dog.rotation.z=Math.sin(now*.0017)*.012;cat.rotation.z=-Math.sin(now*.0016)*.012;rim.scale.setScalar(1+Math.sin(now*.003)*.001);}renderer.render(scene,camera);}
    };frame=requestAnimationFrame(tick);
    return()=>{disposed=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();renderer.domElement.removeEventListener("webglcontextlost",lost);const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();scene.traverse(o=>{if(o instanceof T.Mesh || o instanceof T.Line){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});geos.forEach(g=>g.dispose());mats.forEach(m=>{if(m!==gold)m.dispose();});textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[prizes,view?.camera,view?.lighting,view?.pets,cinematic]);
  useEffect(()=>{if(!failed||!spin||completed.current===spin.key)return;const timer=setTimeout(()=>{completed.current=spin.key;finish.current();},800);return()=>clearTimeout(timer);},[failed,spin]);
  return <div className="paw-scene" ref={root} aria-label="ฉากวงล้อสามมิติ พร้อมน้องหมาและน้องแมว">{failed&&<div className="game-stage-loading">อุปกรณ์นี้เปิดฉาก 3 มิติไม่ได้<br/>คุณยังเล่นและรับผลรางวัลได้ตามปกติ</div>}</div>;
}
