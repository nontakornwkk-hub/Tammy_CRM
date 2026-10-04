import * as T from "three";

/** Fine tapered strands modeled as geometry; no texture, sprite or image is used. */
export function ellipsoidFur(center:T.Vector3,radius:T.Vector3,count:number,cat:boolean,length:number,cream=false,maskFace=true){
  const positions:number[]=[],colors:number[]=[];
  const light=new T.Color(cream?"#fff5df":cat?"#dde0e2":"#eac58c"),dark=new T.Color(cream?"#dfc9a5":cat?"#adb2b8":"#b78642");
  const random=(i:number)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,a=i*2.399963,q=Math.sqrt(1-y*y),n=new T.Vector3(Math.cos(a)*q,y,Math.sin(a)*q);
    // Keep the muzzle, eyes and cream chest readable.
    if(maskFace&&n.z>.48&&n.y<.5)continue;
    const normal=n.clone().divide(radius).normalize(),base=n.clone().multiply(radius).add(center);
    const down=new T.Vector3(0,-1,.08).addScaledVector(normal,normal.y).normalize();
    const across=new T.Vector3().crossVectors(normal,down).normalize();
    const size=length*(.55+random(i)*.55),width=size*(.10+random(i+19)*.09);
    const mid=base.clone().addScaledVector(normal,size*.5).addScaledVector(down,size*.32);
    const tip=base.clone().addScaledVector(normal,size*.72).addScaledVector(down,size*.75);
    const a0=base.clone().addScaledVector(across,width),b0=base.clone().addScaledVector(across,-width);
    const a1=mid.clone().addScaledVector(across,width*.5),b1=mid.clone().addScaledVector(across,-width*.5);
    const color=dark.clone().lerp(light,.3+random(i+27)*.6);
    for(const v of [a0,b0,a1,b0,b1,a1,a1,b1,tip]){positions.push(v.x,v.y,v.z);colors.push(color.r,color.g,color.b);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.98,side:T.DoubleSide}));mesh.receiveShadow=true;mesh.castShadow=false;return mesh;
}
