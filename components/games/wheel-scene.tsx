"use client";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createProceduralPet } from "./procedural-pet";
import { createWheelAssembly } from "./wheel-assembly";
import { createProceduralShop } from "./procedural-shop";
import { wheelTarget } from "@/lib/games/registry";
import type { PublicPrize } from "@/lib/games/types";
import type { StageSpin } from "./game-stage";
import type { SceneView } from "./admin-game-preview";

const gold = new T.MeshPhysicalMaterial({ color: "#f6ab19", metalness: .68, roughness: .19, clearcoat: 1 });
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
function prizeModel(parent:T.Object3D, prize:PublicPrize) {
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
    for(const [x,y] of [[-.075,.075],[.075,-.075]])mesh(parent,new T.TorusGeometry(.043,.013,8,24),cream,x,y,.098);
    const slash=mesh(parent,new T.BoxGeometry(.025,.25,.025),cream,0,0,.095);slash.rotation.z=-.55;parent.rotation.z=-.2;
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
function numberModel(parent:T.Object3D,value:number){
  const patterns=["abcdef","bc","abdeg","abcdg","bcfg","acdfg","acdefg","abc","abcdefg","abcdfg"];
  const locations:Record<string,[number,number,boolean]>={a:[0,.09,true],b:[.035,.045,false],c:[.035,-.045,false],d:[0,-.09,true],e:[-.035,-.045,false],f:[-.035,.045,false],g:[0,0,true]};
  const digits=String(Math.max(0,Math.floor(value))),ink=material("#fff6cf");
  for(let i=0;i<digits.length;i++)for(const part of patterns[Number(digits[i])]){const [x,y,horizontal]=locations[part];mesh(parent,new T.BoxGeometry(horizontal?.06:.014,horizontal?.014:.075,.015),ink,x+(i-(digits.length-1)/2)*.1,y-.36,.18);}
}
export function WheelScene({ prizes, spin, onFinish,view,cinematic=false,immersive=false }: { prizes: PublicPrize[]; spin: StageSpin | null; onFinish: () => void;view?:SceneView;cinematic?:boolean;immersive?:boolean }) {
  const root=useRef<HTMLDivElement>(null), animation=useRef<{ key: string; targetId: string } | null>(spin), finish=useRef(onFinish), completed=useRef<string|null>(null);
  const [failed,setFailed]=useState(false); animation.current=spin; finish.current=onFinish;
  useEffect(()=>{
    const el=root.current; if(!el || !prizes.length)return;
    let renderer:T.WebGLRenderer; try { renderer=new T.WebGLRenderer({antialias:true,alpha:cinematic,powerPreference:"high-performance"}); } catch {setFailed(true);return;}
    setFailed(false); let disposed=false, frame=0, visible=true, lastKey=completed.current||"", move:{start:number;from:number;to:number;key:string}|null=null;
    const scene=new T.Scene();if(!cinematic){scene.background=new T.Color("#d8b18a");scene.fog=new T.Fog("#d8b18a",12,24);}
    const camera=new T.PerspectiveCamera(34,1,.1,40);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=cinematic?.85:1.25;
    el.appendChild(renderer.domElement);
    const pmrem=new T.PMREMGenerator(renderer), room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
    scene.environmentIntensity=cinematic?.4:1;
    if(cinematic){mesh(scene,new T.CylinderGeometry(1.72,1.84,.08,64),material("#102752",.25),0,-.035,0);mesh(scene,new T.TorusGeometry(1.78,.025,8,80),gold,0,.015,0).rotation.x=Math.PI/2;}
    scene.add(new T.HemisphereLight("#fff6df","#74583e",cinematic?.45:2)); const sun=new T.DirectionalLight("#fff4d6",cinematic?3:4); sun.position.set(-4,6,3); sun.castShadow=true; sun.shadow.mapSize.set(1536,1536); sun.shadow.normalBias=.025; sun.shadow.bias=-.0002; sun.shadow.camera.left=-5; sun.shadow.camera.right=5; sun.shadow.camera.top=6; sun.shadow.camera.bottom=-3; scene.add(sun);
    const fill=new T.PointLight("#54b7ff",cinematic?2:12,10);fill.position.set(3,4,3);scene.add(fill);
    if(view?.lighting==="day"){sun.color.set("#ffffff");renderer.toneMappingExposure=1.5;}
    scene.add(createProceduralShop());
    const rug=mesh(scene,new T.CylinderGeometry(2.75,2.75,.016,64),material("#ab8253"),0,.012,.4);rug.scale.z=.62;
    const frontShape=new T.Shape();frontShape.moveTo(-1.48,.03);frontShape.lineTo(1.48,.03);frontShape.lineTo(1.23,.42);frontShape.quadraticCurveTo(0,.5,-1.23,.42);frontShape.closePath();
    mesh(scene,new T.ExtrudeGeometry(frontShape,{depth:.1,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:3}),material("#0742aa",.4),0,0,1.08);
    mesh(scene,new T.CylinderGeometry(1.48,1.7,.25,48),material("#063989",.4),0,.14,0);mesh(scene,new T.CylinderGeometry(1.5,1.72,.05,48),gold,0,.03,0);
    for(const x of [-.75,.75])mesh(scene,new T.BoxGeometry(.24,1.25,.36),material("#093d93",.45),x,.73,-.12);
    if(cinematic){const badge=mesh(scene,new T.CylinderGeometry(.32,.32,.12,40),material("#073b92",.55),0,.27,1.5);badge.rotation.x=Math.PI/2;paw(scene,0,.27,1.58,.6,gold);for(const x of [-1.1,1.1]){sphere(scene,gold,x,.26,1.02,.045);sphere(scene,gold,x,.26,1.35,.045);}}
    const {assembly,rotor:wheel,frame:frameGroup,hub:hubGroup}=createWheelAssembly();scene.add(assembly);
    const back=mesh(frameGroup,new T.CylinderGeometry(1.56,1.56,.26,64),gold);back.rotation.x=Math.PI/2;
    const rim=mesh(frameGroup,new T.TorusGeometry(1.48,.095,12,96),gold,0,0,.18);
    const count=prizes.length, step=Math.PI*2/count;
    if(animation.current?.key===completed.current){const index=prizes.findIndex(p=>p.id===animation.current?.targetId);if(index>=0)wheel.rotation.z=wheelTarget(0,index,count)%(Math.PI*2);}
    prizes.forEach((p,i)=>{const a=Math.PI/2-i*step;const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(1.37*Math.cos(a-step/2),1.37*Math.sin(a-step/2));shape.absarc(0,0,1.37,a-step/2,a+step/2,false);shape.lineTo(0,0);const geo=new T.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.015,bevelThickness:.02,curveSegments:32});mesh(wheel,geo,cinematic?new T.MeshPhysicalMaterial({color:p.color,metalness:.08,roughness:.24,clearcoat:1,envMapIntensity:.2}):material(p.color,.18),0,0,.12);
      const icon=new T.Group();icon.position.set(Math.cos(a)*.99,Math.sin(a)*.99,.31);icon.rotation.z=a-Math.PI/2;icon.scale.setScalar(Math.min(1,8/count));wheel.add(icon);prizeModel(icon,p);if(p.kind==="points")numberModel(icon,p.points);else if(p.kind==="coupon")numberModel(icon,p.discountValue);
      if(cinematic){const edge=new T.Group();edge.rotation.z=a-step/2;wheel.add(edge);mesh(edge,new T.BoxGeometry(1.33,.027,.04),gold,.67,0,.265);}
    });
    mesh(hubGroup,new T.TorusGeometry(.42,.055,16,64),gold,0,0,.45);const hub=mesh(hubGroup,new T.CylinderGeometry(.4,.4,.19,64),gold,0,0,.41);hub.rotation.x=Math.PI/2;mesh(hubGroup,new T.TorusGeometry(.35,.013,8,64),material("#ffe8a2",.6),0,0,.51);paw(hubGroup,0,0,.56,.75,material("#ffe4a0",.45));
    const bulbs:T.MeshStandardMaterial[]=[];
    for(let i=0;i<24;i++){const a=i*Math.PI/12,m=new T.MeshStandardMaterial({color:"#ffedaa",emissive:"#ffbd45",emissiveIntensity:1.5});bulbs.push(m);sphere(frameGroup,m,Math.cos(a)*1.49,Math.sin(a)*1.49,.23,.05);}
    const pointer=mesh(scene,new T.ConeGeometry(cinematic?.2:.16,cinematic?.5:.4,3),gold,0,3.74,.65);pointer.rotation.z=Math.PI;if(cinematic){sphere(scene,gold,0,3.94,.62,.23,.22,.09);mesh(scene,new T.TorusGeometry(.18,.018,8,32),material("#fff0bc",.45),0,3.94,.72);}paw(scene,0,cinematic?3.96:3.84,.76,cinematic?.39:.27,material("#fff0bc",.4));
    const dog=createProceduralPet(false),cat=createProceduralPet(true);dog.root.position.set(-1.87,.06,.86);dog.root.rotation.y=.2;dog.root.scale.setScalar(1.62);cat.root.position.set(1.95,.38,.75);cat.root.rotation.y=-.23;cat.root.scale.setScalar(1.4);scene.add(dog.root,cat.root);const crate=mesh(scene,new T.BoxGeometry(.8,.35,.7),material("#c38b55"),1.92,.175,.65);paw(crate,0,.005,.365,.3,material("#764326"));
    dog.root.visible=cat.root.visible=crate.visible=view?.pets!==false;
    for(let i=0;i<3;i++)mesh(crate,new T.BoxGeometry(.79,.008,.006),material("#996137"),0,-.105+i*.11,.356);
    for(const x of [-.33,.33])for(const y of [-.115,.125])sphere(crate,material("#6c5845",.5),x,y,.367,.015);
    for(const x of [-1.1,1.1]){const bone=new T.Group();bone.position.set(x,.27,1.33);bone.rotation.z=x<0?.5:-.5;scene.add(bone);mesh(bone,new T.BoxGeometry(.22,.075,.05),gold);for(const side of [-1,1])for(const y of [-.035,.035])sphere(bone,gold,side*.12,y,0,.05);}
    const resize=()=>{
      const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;
      const span=cinematic?(view?.camera==="close"?5.5:6):(view?.camera==="close"?3.7:4.4);
      const distance=Math.max(immersive?8:cinematic?6:view?.camera==="close"?6.4:7.5,span/(2*Math.tan(T.MathUtils.degToRad(17))*camera.aspect));
      let centerY=2.02;
      if(immersive){const anchor=el.parentElement?.querySelector(".paw-stage-space");if(anchor){const rect=anchor.getBoundingClientRect(),frame=el.getBoundingClientRect();const fraction=(rect.top+rect.height*.46-frame.top)/h;centerY=2.25+(fraction-.5)*span*h/w;}}
      camera.position.set(0,cinematic?centerY+distance*.06:3.2,distance);camera.lookAt(0,centerY,0);camera.updateProjectionMatrix();
    };resize();const ro=new ResizeObserver(resize);ro.observe(el);if(immersive&&el.parentElement)ro.observe(el.parentElement);
    const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});io.observe(el);
    const lost=(event:Event)=>{event.preventDefault();setFailed(true);};renderer.domElement.addEventListener("webglcontextlost",lost);
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick=(now:number)=>{
      if(disposed)return; frame=requestAnimationFrame(tick);
      const s=animation.current;if(s&&s.key!==lastKey){lastKey=s.key;const index=prizes.findIndex(p=>p.id===s.targetId);if(index>=0)move={start:now,from:wheel.rotation.z,to:wheelTarget(wheel.rotation.z,index,count),key:s.key};else {completed.current=s.key;finish.current();}}
      if(move&&completed.current===move.key)move=null;
      if(move){const t=Math.min(1,(now-move.start)/(reduced?800:5200));wheel.rotation.z=move.from+(move.to-move.from)*(1-Math.pow(1-t,4));if(t===1){completed.current=move.key;move=null;finish.current();}}
      if(visible&&!document.hidden){if(!reduced){dog.animate(now,Boolean(move));cat.animate(now,Boolean(move));bulbs.forEach((m,i)=>{m.emissiveIntensity=1.1+.9*(.5+.5*Math.sin(now*.003+i*.7));});rim.scale.setScalar(1+Math.sin(now*.003)*.001);}renderer.render(scene,camera);}
    };frame=requestAnimationFrame(tick);
    return()=>{disposed=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();renderer.domElement.removeEventListener("webglcontextlost",lost);const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();scene.traverse(o=>{if(o instanceof T.Mesh || o instanceof T.Line){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});geos.forEach(g=>g.dispose());mats.forEach(m=>{if(m!==gold)m.dispose();});environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[prizes,view?.camera,view?.lighting,view?.pets,cinematic,immersive]);
  useEffect(()=>{if(!failed||!spin||completed.current===spin.key)return;const timer=setTimeout(()=>{completed.current=spin.key;finish.current();},800);return()=>clearTimeout(timer);},[failed,spin]);
  return <div className="paw-scene" ref={root} aria-label="ฉากวงล้อสามมิติ พร้อมน้องหมาและน้องแมว">{failed&&<div className="game-stage-loading">อุปกรณ์นี้เปิดฉาก 3 มิติไม่ได้<br/>คุณยังเล่นและรับผลรางวัลได้ตามปกติ</div>}</div>;
}
