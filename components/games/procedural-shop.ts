import * as T from "three";

// Small pet-shop set built entirely from geometry, including products and lighting.
export function createProceduralShop(){
  const root=new T.Group();
  const materials=new Map<string,T.MeshStandardMaterial>();
  const mat=(color:string)=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.65}));return materials.get(color)!;};
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.receiveShadow=true;root.add(m);return m;};
  box(0,2,-2.2,6,4.5,.1,"#dfb67b");
  for(let x=-3;x<3;x+=.4)box(x,2,-2.135,.014,4.4,.01,"#c99562");
  box(0,-.07,0,6,.1,5,"#b8804f");for(let x=-3;x<3;x+=.5)box(x,-.011,0,.015,.008,5,"#9c633d");
  box(-2.45,2.7,-2,.85,2.2,.08,"#1b5f99");box(-2.45,2.7,-1.94,.7,2,.015,"#8dccdc");box(-2.45,2.7,-1.89,.045,2.1,.03,"#236698");box(-2.45,2.7,-1.89,.76,.045,.03,"#236698");
  for(const side of [-1,1]){
    const x=side*2.48;box(x,1.85,-1.67,.84,2.6,.13,"#9b663f");
    for(let shelf=0;shelf<3;shelf++){const y=.65+shelf*.84;box(x,y,-1.43,.9,.075,.56,"#c89257");for(let i=0;i<3;i++){const px=x-.27+i*.27,color=["#1975a9","#3c946e","#e9973c"][(i+shelf)%3];box(px,y+.23,-1.4,.18,.38,.2,color);box(px,y+.23,-1.285,.13,.14,.009,"#ffe9be");box(px,y+.44,-1.4,.17,.025,.19,"#e9bc74");}}
  }
  for(const side of [-1,1]){
    const x=side*1.68;box(x,4.06,-1.5,.013,.5,.013,"#573a30");const shade=new T.Mesh(new T.ConeGeometry(.23,.17,24),mat("#eab34d"));shade.position.set(x,3.8,-1.5);root.add(shade);const bulb=new T.Mesh(new T.SphereGeometry(.08,16,10),new T.MeshStandardMaterial({color:"#fff2bd",emissive:"#ffc45e",emissiveIntensity:2}));bulb.position.set(x,3.72,-1.5);root.add(bulb);const lamp=new T.PointLight("#ffc573",1.4,3);lamp.position.copy(bulb.position);root.add(lamp);
  }
  const bowl=new T.Mesh(new T.CylinderGeometry(.18,.14,.14,24),mat("#126dab"));bowl.position.set(-2.65,.08,1);root.add(bowl);
  for(let i=0;i<7;i++){const kibble=new T.Mesh(new T.SphereGeometry(.035,8,6),mat("#ac5f2b"));kibble.position.set(-2.65+Math.cos(i*2.4)*.1,.165,1+Math.sin(i*2.4)*.1);root.add(kibble);}
  return root;
}
