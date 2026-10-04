import * as T from "three";

// Entire character is geometry: no image textures, sprites or external model files.
export function createProceduralPet(cat: boolean) {
  const root=new T.Group(), body=new T.Group(), head=new T.Group(), arm=new T.Group(), tail=new T.Group();
  const coat=new T.MeshStandardMaterial({color:cat?"#aaa9ad":"#dc9a4d",roughness:.8});
  const light=new T.MeshStandardMaterial({color:cat?"#fff8eb":"#ffe0a5",roughness:.8});
  const dark=new T.MeshPhysicalMaterial({color:"#201619",roughness:.18,clearcoat:1});
  const white=new T.MeshStandardMaterial({color:"#fffdf6"}), pink=new T.MeshStandardMaterial({color:"#f88b9a"});
  const bandana=new T.MeshStandardMaterial({color:cat?"#00975d":"#0657d6",roughness:.45});
  const iris=new T.MeshPhysicalMaterial({color:cat?"#4da331":"#834615",roughness:.12,clearcoat:1});
  const ball=(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>{const m=new T.Mesh(new T.SphereGeometry(1,20,14),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;};
  const fur=(parent:T.Object3D,center:T.Vector3,radii:T.Vector3,count:number)=>{
    const tufts=new T.InstancedMesh(new T.SphereGeometry(1,7,5),coat,count), dummy=new T.Object3D();
    for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,a=i*2.399963,r=Math.sqrt(1-y*y),normal=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);dummy.position.copy(normal).multiply(radii).add(center);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal);dummy.scale.set(.036,.055,.036);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);}
    parent.add(tufts);
  };
  root.add(body);ball(body,coat,0,.65,0,.35,.49,.29);ball(body,light,0,.64,.23,.24,.32,.07);
  fur(body,new T.Vector3(0,.65,0),new T.Vector3(.34,.46,.28),100);
  for(const x of [-.23,.23]){ball(body,light,x,.15,.15,.19,.14,.23);for(let i=0;i<3;i++)ball(body,coat,x-.07+i*.07,.12,.35,.026,.022,.022);}
  head.position.set(0,1.25,.06);body.add(head);ball(head,coat,0,0,0,.44,.38,.34);
  // Fur on the back and sides leaves the eyes and muzzle unobscured.
  fur(head,new T.Vector3(0,0,-.1),new T.Vector3(.42,.37,.22),130);
  const eyes:T.Group[]=[];
  for(const side of [-1,1]){
    if(cat){const ear=new T.Mesh(new T.ConeGeometry(.19,.38,3),coat);ear.position.set(side*.31,.36,0);ear.rotation.z=-side*.18;head.add(ear);const inner=new T.Mesh(new T.ConeGeometry(.12,.24,3),pink);inner.position.set(side*.31,.4,.08);head.add(inner);}
    else{ball(head,coat,side*.43,-.1,-.02,.18,.35,.14);ball(head,light,side*.47,-.16,.02,.08,.23,.07);fur(head,new T.Vector3(side*.43,-.1,-.02),new T.Vector3(.17,.32,.12),45);}
    const eye=new T.Group();eye.position.set(side*.195,.055,.29);head.add(eye);eyes.push(eye);
    ball(eye,light,0,0,0,.145,.17,.085);ball(eye,iris,-side*.015,0,.07,.125,.15,.055);ball(eye,dark,-side*.015,0,.115,.079,.108,.025);
    ball(eye,white,-.03,.055,.137,.028);ball(eye,white,.035,-.033,.14,.013);
    ball(head,light,side*.14,-.15,.3,.18,.13,.105);
    if(cat)for(let i=0;i<3;i++){const curve=new T.LineCurve3(new T.Vector3(side*.13,-.15-i*.035,.4),new T.Vector3(side*.51,-.11-i*.07,.35));head.add(new T.Mesh(new T.TubeGeometry(curve,1,.004,4,false),dark));}
  }
  ball(head,dark,0,-.115,.425,.07,.044,.032);ball(head,dark,0,-.255,.335,.145,.088,.04);ball(head,pink,0,-.29,.38,.07,.064,.035);
  ball(head,white,0,-.212,.378,.085,.025,.012);for(const side of [-1,1]){ball(head,pink,side*.285,-.095,.335,.049,.023,.008);for(let i=0;i<3;i++)ball(head,dark,side*(.12+i*.028),-.165+(i%2)*.025,.414,.008);}
  if(cat){const stripeMaterial=new T.MeshStandardMaterial({color:"#65616a",roughness:.85});for(const x of [-.27,0,.27]){const stripe=ball(head,stripeMaterial,x,.28,.13,.035,.11,.018);stripe.rotation.z=x;}for(const side of [-1,1])for(let i=0;i<3;i++){const stripe=ball(body,stripeMaterial,side*.31,.5+i*.1,.13,.047,.025,.05);stripe.rotation.z=side*.35;}}
  const collar=new T.Mesh(new T.TorusGeometry(.26,.043,8,30),bandana);collar.position.set(0,.94,.04);collar.rotation.x=Math.PI/2;body.add(collar);
  const cloth=new T.Mesh(new T.ConeGeometry(.22,.32,3),bandana);cloth.position.set(0,.79,.3);cloth.rotation.z=Math.PI;body.add(cloth);
  ball(body,light,0,.79,.42,.055,.043,.015);for(const [x,y] of [[-.06,.85],[0,.89],[.06,.85]])ball(body,light,x,y,.42,.025,.033,.016);
  const bellMaterial=new T.MeshPhysicalMaterial({color:"#ffbe35",metalness:.7,roughness:.22,clearcoat:1});ball(body,bellMaterial,0,.965,.33,.064);ball(body,dark,0,.933,.385,.013,.006,.004);
  arm.position.set(cat?-.27:.27,.79,.12);body.add(arm);ball(arm,coat,0,.12,.07,.115,.26,.11);ball(arm,light,0,.35,.08,.14,.14,.1);for(let i=0;i<3;i++)ball(arm,coat,-.07+i*.07,.4,.17,.035,.042,.02);
  ball(arm,pink,0,.335,.181,.05,.041,.008);for(const x of [-.065,0,.065])ball(arm,pink,x,.4,.19,.02,.026,.008);
  ball(body,coat,cat?.25:-.25,.56,.22,.115,.25,.11);
  tail.position.set(cat?.25:-.25,.35,-.14);body.add(tail);const curve=new T.CatmullRomCurve3([new T.Vector3(),new T.Vector3(cat?.35:-.35,.1,0),new T.Vector3(cat?.42:-.42,.46,.04)]);tail.add(new T.Mesh(new T.TubeGeometry(curve,16,cat?.075:.1,8,false),coat));
  return {root,animate(time:number,celebrating:boolean){const t=time/1000,phase=cat?1.2:0;body.scale.y=1+Math.sin(t*2+phase)*.012;head.rotation.z=Math.sin(t*.8+phase)*.055;head.rotation.y=Math.sin(t*.55+phase)*.06;arm.rotation.z=(cat?.55:-.55)+Math.sin(t*(celebrating?6:2.2)+phase)*(celebrating?.32:.14);tail.rotation.y=Math.sin(t*(celebrating?9:3)+phase)*.35;const cycle=(t+phase)%4.8,blink=cycle>4.5?Math.max(.06,Math.abs(cycle-4.65)/.15):1;eyes.forEach(eye=>{eye.scale.y=blink;});}};
}
