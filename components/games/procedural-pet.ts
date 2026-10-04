import * as T from "three";

/** Rounded, articulated characters. Fur is fine geometry, never surface beads or sprites. */
export function createProceduralPet(cat: boolean) {
  const root=new T.Group(), body=new T.Group(), head=new T.Group(), arm=new T.Group(), tail=new T.Group();
  const coat=new T.MeshPhysicalMaterial({color:cat?"#8d929f":"#d99a50",roughness:.83,sheen:1,sheenColor:new T.Color(cat?"#d3d7df":"#fce0ac"),sheenRoughness:1});
  const cream=new T.MeshPhysicalMaterial({color:cat?"#fff8ed":"#ffe1aa",roughness:.87,sheen:1,sheenColor:new T.Color("#fff1d6")});
  const nose=new T.MeshPhysicalMaterial({color:"#29202a",roughness:.32,clearcoat:.65});
  const pink=new T.MeshStandardMaterial({color:"#e8a0a5",roughness:.8});
  const cloth=new T.MeshStandardMaterial({color:cat?"#08885d":"#0b58ba",roughness:.82});
  const eyeMat=new T.MeshPhysicalMaterial({color:cat?"#73a552":"#754426",roughness:.16,clearcoat:1});
  const shine=new T.MeshBasicMaterial({color:"#ffffff"}), unitSphere=new T.SphereGeometry(1,32,24);
  const ball=(p:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>{const o=new T.Mesh(unitSphere,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
  const curve=(p:T.Object3D,points:number[][],radius:number,m:T.Material)=>{const c=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v as [number,number,number])));const o=new T.Mesh(new T.TubeGeometry(c,16,radius,8,false),m);p.add(o);return o;};
  const fur=(p:T.Object3D,center:T.Vector3,r:T.Vector3,count:number)=>{
    const positions:number[]=[];
    for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,a=i*2.39996,q=Math.sqrt(1-y*y),n=new T.Vector3(Math.cos(a)*q,y,Math.sin(a)*q);if(n.z>.55)continue;const start=n.clone().multiply(r).add(center);const end=start.clone().addScaledVector(n,.008+(i%7)*.002);end.y-=.008;positions.push(...start.toArray(),...end.toArray());}
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(positions,3));p.add(new T.LineSegments(g,new T.LineBasicMaterial({color:cat?"#c6c9d1":"#edc27e",transparent:true,opacity:.38,depthWrite:false})));
  };
  root.add(body);
  ball(body,coat,0,.53,-.02,.37,.48,.31);ball(body,cream,0,.56,.24,.235,.29,.095);
  for(const side of [-1,1]){ball(body,coat,side*.255,.23,-.06,.19,.23,.24);ball(body,cream,side*.22,.095,.21,.17,.1,.23);for(let i=0;i<2;i++)curve(body,[[side*.22-.045+i*.07,.12,.4],[side*.22-.045+i*.07,.085,.425]],.003,coat);}
  fur(body,new T.Vector3(0,.53,-.03),new T.Vector3(.37,.47,.3),1100);
  head.position.set(0,1.12,.035);body.add(head);ball(head,coat,0,0,0,.47,.395,.35);
  ball(head,cream,0,-.17,.24,.315,.205,.175);fur(head,new T.Vector3(0,0,-.04),new T.Vector3(.47,.39,.31),1300);
  const ears:T.Group[]=[],eyes:T.Group[]=[];
  for(const side of [-1,1]){
    const ear=new T.Group();ear.position.set(side*.36,.2,-.045);head.add(ear);ears.push(ear);
    if(cat){const shape=new T.Shape();shape.moveTo(-.15,-.14);shape.quadraticCurveTo(-.16,.06,0,.28);shape.quadraticCurveTo(.18,.07,.16,-.14);shape.closePath();const outer=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.04,bevelThickness:.035,bevelSegments:4,steps:1,curveSegments:12}),coat);ear.add(outer);const inner=new T.Mesh(outer.geometry.clone(),pink);inner.scale.set(.62,.66,.4);inner.position.set(0,.025,.075);ear.add(inner);ear.rotation.z=-side*.16;}
    else{ball(ear,coat,side*.09,-.25,0,.19,.37,.145);ball(ear,cream,side*.11,-.3,.072,.1,.245,.06);fur(ear,new T.Vector3(side*.09,-.25,0),new T.Vector3(.19,.36,.145),550);}
    const eye=new T.Group();eye.position.set(side*.185,.025,.303);head.add(eye);eyes.push(eye);
    ball(eye,nose,0,0,0,.103,.124,.047);ball(eye,eyeMat,0,0,.025,.091,.109,.031);ball(eye,nose,-side*.009,-.005,.051,.05,.076,.017);ball(eye,shine,-.028,.044,.067,.025,.028,.012);ball(eye,shine,.025,-.024,.069,.009);
    curve(head,[[side*.1,.2,.29],[side*.18,.22,.292],[side*.25,.19,.26]],.018,coat);
    ball(head,cream,side*.11,-.16,.372,.15,.11,.08);
    if(cat)for(let i=0;i<3;i++)curve(head,[[side*.15,-.19-i*.018,.418],[side*.35,-.18-i*.035,.4],[side*.52,-.15-i*.063,.34]],.0028,nose);
  }
  ball(head,nose,0,-.12,.47,cat?.045:.065,.034,.03);
  curve(head,[[0,-.15,.443],[0,-.215,.43]],.007,nose);
  for(const side of [-1,1])curve(head,[[0,-.215,.43],[side*.045,-.23,.428],[side*.1,-.206,.423]],.007,nose);
  if(!cat){ball(head,nose,0,-.253,.407,.065,.045,.018);ball(head,pink,0,-.269,.427,.043,.042,.013);curve(head,[[0,-.247,.442],[0,-.276,.444]],.002,coat);}
  if(cat){const stripe=new T.MeshStandardMaterial({color:"#5d6573",roughness:.92});for(const side of [-1,1]){curve(head,[[side*.045,.31,.2],[side*.085,.265,.275],[side*.105,.19,.3]],.022,stripe);curve(head,[[side*.17,.29,.225],[side*.22,.25,.24],[side*.245,.2,.24]],.019,stripe);for(let i=0;i<2;i++)curve(head,[[side*.405,-.035-i*.09,.19],[side*.365,-.055-i*.09,.26],[side*.32,-.075-i*.09,.285]],.014,stripe);}}
  const collar=new T.Mesh(new T.TorusGeometry(.245,.036,10,40),cloth);collar.position.set(0,.865,.06);collar.rotation.x=Math.PI/2;body.add(collar);
  const bib=new T.Shape();bib.moveTo(-.22,.09);bib.quadraticCurveTo(0,.02,.22,.09);bib.quadraticCurveTo(.19,-.1,.015,-.23);bib.quadraticCurveTo(-.12,-.17,-.22,.09);const scarf=new T.Mesh(new T.ExtrudeGeometry(bib,{depth:.025,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:3,curveSegments:14}),cloth);scarf.position.set(0,.8,.29);body.add(scarf);
  ball(body,cream,0,.73,.338,.049,.04,.009);for(const [x,y] of [[-.055,.78],[0,.81],[.055,.78]])ball(body,cream,x,y,.338,.022,.027,.009);
  const bell=new T.Group();bell.position.set(.12,.86,.28);body.add(bell);const metal=new T.MeshPhysicalMaterial({color:"#eeb945",metalness:.75,roughness:.2});ball(bell,metal,0,-.05,0,.052);curve(bell,[[-.02,-.075,.041],[0,-.08,.052],[.02,-.075,.041]],.004,nose);
  const side=cat?-1:1;arm.position.set(side*.27,.67,.07);body.add(arm);ball(arm,coat,side*.05,-.16,.11,.105,.22,.1);ball(arm,cream,side*.065,-.35,.14,.115,.1,.115);ball(arm,pink,side*.065,-.35,.248,.035,.031,.004);
  ball(body,coat,-side*.22,.39,.24,.1,.24,.105);ball(body,cream,-side*.22,.16,.29,.12,.1,.16);
  tail.position.set(-side*.22,.22,-.19);body.add(tail);curve(tail,[[0,0,0],[-side*.25,.04,0],[-side*.42,.18,.03],[-side*.47,.38,.06]],cat?.065:.095,coat);
  return {root,animate(ms:number,excited:boolean){const t=ms/1000,phase=cat?1.3:0;body.scale.y=1+Math.sin(t*1.8+phase)*.008;head.rotation.z=Math.sin(t*.7+phase)*.055;head.rotation.y=Math.sin(t*.45+phase)*.08;arm.rotation.z=side*(1.85+Math.sin(t*(excited?4:1.5)+phase)*(excited?.2:.08));tail.rotation.y=Math.sin(t*(excited?6:2.5)+phase)*.3;bell.rotation.z=Math.sin(t*2+phase)*.13;ears.forEach((e,i)=>{e.rotation.x=Math.sin(t*1.7+i)*.025;});const b=(t+phase)%5.3;eyes.forEach(e=>{e.scale.y=b>5?Math.max(.08,Math.abs(b-5.15)/.15):1;});}};
}
