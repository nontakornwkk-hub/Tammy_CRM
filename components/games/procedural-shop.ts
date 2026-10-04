import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** A miniature pet boutique, entirely modeled geometry with no image textures. */
export function createProceduralShop(){
  const root=new T.Group(), materials=new Map<string,T.MeshStandardMaterial>();
  const mat=(color:string,metalness=0)=>{const key=color+metalness;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:metalness?.3:.72,metalness}));return materials.get(key)!;};
  const add=(g:T.BufferGeometry,color:string,x:number,y:number,z:number,metalness=0)=>{const m=new T.Mesh(g,mat(color,metalness));m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;root.add(m);return m;};
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,round=.02)=>add(new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/4,h/4,d/4)),color,x,y,z);
  const ball=(x:number,y:number,z:number,a:number,b:number,c:number,color:string)=>{const m=add(new T.SphereGeometry(1,16,12),color,x,y,z);m.scale.set(a,b,c);return m;};
  const cylinder=(x:number,y:number,z:number,r:number,h:number,color:string)=>add(new T.CylinderGeometry(r,r,h,24),color,x,y,z);
  const badge=(x:number,y:number,z:number,s:number,color:string)=>{ball(x,y-.025*s,z,.055*s,.047*s,.012,color);for(const [a,b] of [[-.055,.045],[0,.07],[.055,.045]])ball(x+a*s,y+b*s,z,.025*s,.032*s,.012,color);};
  // Broad surfaces extend behind the camera frame; individual planks catch warm light.
  box(0,2,-2.8,18,15,.2,"#bb8152");
  for(let i=0;i<42;i++)box(-9+i*.44,4,-2.67,.43,15,.055,i%3===0?"#d8aa79":"#dbb181");
  box(0,-.14,0,18,.22,22,"#905c38");
  for(let row=0;row<27;row++)for(let col=0;col<9;col++)box(-10+col*2.4+(row%2)*.8,-.018,-9.5+row*.74,2.38,.04,.724,["#c58b55","#c9915e","#d09b65"][(row+col)%3],.008);
  for(const x of [-3.6,0,3.6])box(x,5.4,-.8,.18,.2,5,"#835336");
  box(0,5.5,-2.4,18,.22,.35,"#875632");
  // Blue shop window with an actual inset frame, sill and small outdoor foliage.
  box(-2.6,2.55,-2.49,1.3,4.1,.2,"#234c69");box(-2.6,2.55,-2.36,1.13,3.9,.05,"#b2d8e0");
  for(const x of [-3.17,-2.6,-2.03])box(x,2.55,-2.27,.045,3.96,.065,"#346988");
  for(const y of [0.6,2.55,4.5])box(-2.6,y,-2.27,1.2,.045,.065,"#346988");
  box(-2.6,0.54,-2.15,1.5,.1,.45,"#ba8150");
  // Side cabinets have thickness, inset backs, product bags, jars and paw labels.
  for(const side of [-1,1]){
    const first=root.children.length;const x=side*2.7;box(x,1.42,-1.83,1.12,2.65,.16,"#9b633e");
    for(const edge of [-.58,.58])box(x+edge,1.42,-1.56,.085,2.8,.66,"#ae7344");
    for(let shelf=0;shelf<4;shelf++){
      const y=.15+shelf*.82;box(x,y,-1.48,1.25,.095,.82,"#c48e54");box(x,y+.027,-1.052,1.26,.08,.035,"#e3b271");
      if(shelf===3)continue;
      for(let i=0;i<3;i++){
        const px=x-.38+i*.38,color=["#347889","#468577","#cf8252"][(i+shelf)%3];
        if((i+shelf)%2){box(px,y+.29,-1.35,.26,.48,.23,color,.045);box(px,y+.545,-1.35,.28,.055,.22,"#ead19d");box(px,y+.27,-1.22,.21,.24,.016,"#fff1d4");badge(px,y+.28,-1.2,.9,color);}
        else {cylinder(px,y+.23,-1.35,.133,.36,color);cylinder(px,y+.425,-1.35,.138,.045,"#d8b675");box(px,y+.24,-1.208,.19,.19,.014,"#f5e6c8");badge(px,y+.25,-1.19,.8,color);}
      }
    }
    const cabinet=new T.Group();cabinet.position.set(x,0,-1.7);root.add(cabinet);root.updateMatrixWorld(true);for(const part of root.children.slice(first,-1))cabinet.attach(part);cabinet.rotation.y=-side*.24;
  }
  // Framed paw sign over the back counter.
  box(1.18,3.32,-2.45,1.8,.95,.16,"#9e602e",.12);box(1.18,3.32,-2.345,1.64,.79,.08,"#efc680",.1);
  badge(1.18,3.42,-2.285,2.1,"#8c582e");
  const lettering:Record<string,number[][][]>={T:[[[-.08,.1],[.08,.1]],[[0,.1],[0,-.1]]],A:[[[-.08,-.1],[0,.1],[.08,-.1]],[[-.04,0],[.04,0]]],M:[[[-.08,-.1],[-.08,.1],[0,-.015],[.08,.1],[.08,-.1]]],Y:[[[-.08,.1],[0,0],[.08,.1]],[[0,0],[0,-.1]]]};
  [..."TAMMY"].forEach((letter,index)=>lettering[letter].forEach(points=>{const line=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(1.18+(index-2)*.24+x,3.14+y,-2.28)),false,"catmullrom",0);add(new T.TubeGeometry(line,16,.014,6,false),"#75431f",0,0,0);}));
  // Counter behind the wheel, with drawer pulls and a tiny register.
  box(.8,.54,-1.97,2.45,1.04,.55,"#ae7448");box(.8,1.08,-1.91,2.65,.12,.8,"#d6a367");
  for(let i=0;i<3;i++){box(-.04+i*.8,.71,-1.67,.72,.34,.045,"#c58c58");ball(-.04+i*.8,.71,-1.628,.09,.014,.018,"#ebbf6d");}
  box(1.45,1.18,-1.84,.45,.09,.33,"#2c4654");const register=box(1.45,1.39,-1.87,.38,.32,.075,"#294452");register.rotation.x=-.18;box(1.45,1.4,-1.81,.3,.23,.016,"#a0c5bf");
  // Pendant lamps and warm pools of light.
  for(const x of [-1.66,1.9]){
    cylinder(x,4.04,-1.9,.014,.72,"#473b34");
    add(new T.ConeGeometry(.29,.2,32,1,true),"#b7833c",x,3.61,-1.9,.35);
    const bulb=add(new T.SphereGeometry(.09,16,12),"#fff2c6",x,3.51,-1.9);(bulb.material as T.MeshStandardMaterial).emissive.set("#ffdca0");(bulb.material as T.MeshStandardMaterial).emissiveIntensity=2;
    const lamp=new T.PointLight("#ffbb66",2,5);lamp.position.set(x,3.45,-1.8);root.add(lamp);
  }
  // Plants and foreground bowl soften the set without competing with the pets.
  for(const [x,y,z] of [[-3.32,.13,-1.1],[2.76,2.7,-1.6]]){
    const pot=add(new T.CylinderGeometry(.15,.11,.23,24),"#cb8158",x,y+.11,z);
    for(let i=0;i<7;i++){const a=i*2.4,leaf=ball(x+Math.cos(a)*.1,y+.32+(i%3)*.09,z+Math.sin(a)*.1,.065,.18,.045,i%2?"#477e51":"#73944f");leaf.rotation.z=Math.cos(a)*.65;}
    pot.receiveShadow=true;
  }
  const bowl=add(new T.CylinderGeometry(.23,.18,.15,32),"#296b95",-2.55,.095,1.1,.2);badge(-2.55,.12,1.305,.75,"#f0d4a0");
  const rim=add(new T.TorusGeometry(.215,.018,8,32),"#e4c184",-2.55,.176,1.1,.5);rim.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++)ball(-2.55+Math.cos(i*2.4)*.15,.17,1.1+Math.sin(i*2.4)*.15,.035,.028,.035,"#92552b");
  bowl.receiveShadow=true;return root;
}
