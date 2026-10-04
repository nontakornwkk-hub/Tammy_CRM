import assert from 'node:assert/strict';
import * as T from 'three';
import {createWheelAssembly} from '../components/games/wheel-assembly.ts';
const {assembly,rotor,frame,hub}=createWheelAssembly();
const toe=new T.Object3D();toe.position.set(.1,.29,.56);hub.add(toe);
const prize=new T.Object3D();prize.position.set(.7,.7,.3);rotor.add(prize);
assembly.updateMatrixWorld(true);const initial=toe.matrixWorld.clone(),frameInitial=frame.matrixWorld.clone(),prizeInitial=prize.matrixWorld.clone();
for(const angle of [.3,1.9,Math.PI,Math.PI*7]){rotor.rotation.z=angle;assembly.updateMatrixWorld(true);assert.deepEqual(toe.matrixWorld.elements,initial.elements,'center paw must stay stationary at every spin angle');assert.deepEqual(frame.matrixWorld.elements,frameInitial.elements,'frame must stay stationary');assert.notDeepEqual(prize.matrixWorld.elements,prizeInitial.elements,'prize sectors must rotate');}
assert.equal(hub.parent,assembly);assert.equal(frame.parent,assembly);
console.log('PASS wheel: prizes rotate; hub, paw toes and frame keep their world position and orientation.');
