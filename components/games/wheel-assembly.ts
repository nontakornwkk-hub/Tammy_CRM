import * as T from "three";

/** Only rotor turns; the frame, pointer and center medallion stay in world orientation. */
export function createWheelAssembly(){
  const assembly=new T.Group(),rotor=new T.Group(),frame=new T.Group(),hub=new T.Group();
  assembly.name="paw-wheel-assembly";rotor.name="prize-rotor";frame.name="stationary-wheel-frame";hub.name="stationary-paw-hub";
  assembly.position.set(0,2.25,.08);assembly.add(rotor,frame,hub);
  return {assembly,rotor,frame,hub};
}
