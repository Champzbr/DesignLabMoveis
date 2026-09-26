// DesignLabMoveis 1.311.00 · helpers geométricos de ponteiro/movimento.
export function createInteractionHelpers({THREE,renderer,runtimeModel,groundPlane,AXIS_INFERENCE_ANGLE,AXIS_INFERENCE_MIN_PX,getCamera}){
  function getClientPoint(event){return {x:event.clientX,y:event.clientY};}
  function getPointerNDC(event){
    const rect=renderer.domElement.getBoundingClientRect();
    runtimeModel.pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
    runtimeModel.pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
    return getClientPoint(event);
  }
  function intersectPlane(plane,target=new THREE.Vector3()){
    runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,getCamera());
    return runtimeModel.raycaster.ray.intersectPlane(plane,target);
  }
  function intersectGround(){
    runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,getCamera());
    const p=new THREE.Vector3();
    return runtimeModel.raycaster.ray.intersectPlane(groundPlane,p)?p:new THREE.Vector3();
  }
  function closestParamOnAxis(linePoint,lineDir){
    runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,getCamera());
    const O1=runtimeModel.raycaster.ray.origin,D1=runtimeModel.raycaster.ray.direction.clone().normalize(),O2=linePoint,D2=lineDir.clone().normalize();
    const r=new THREE.Vector3().subVectors(O1,O2);
    const a=D1.dot(D1),b=D1.dot(D2),c=D2.dot(D2),d=D1.dot(r),e=D2.dot(r),den=a*c-b*b;
    if(Math.abs(den)<1e-8)return 0;
    return (a*e-b*d)/den;
  }
  function worldAxisForFace(hit,obj){
    const n=hit.face.normal.clone().transformDirection(obj.matrixWorld);
    const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
    if(ax>=ay&&ax>=az)return {axis:'x',sign:Math.sign(n.x)||1};
    if(ay>=ax&&ay>=az)return {axis:'y',sign:Math.sign(n.y)||1};
    return {axis:'z',sign:Math.sign(n.z)||1};
  }
  function worldToClient(v){
    const camera=getCamera();
    camera.updateMatrixWorld(true);
    const rect=renderer.domElement.getBoundingClientRect();
    const p=v.clone().project(camera);
    return new THREE.Vector2(rect.left+(p.x*.5+.5)*rect.width,rect.top+(-p.y*.5+.5)*rect.height);
  }
  function inferMoveAxis(event){
    const motion=new THREE.Vector2(event.clientX-runtimeModel.moveDownAim.x,event.clientY-runtimeModel.moveDownAim.y);
    const motionLen=motion.length();
    if(motionLen<AXIS_INFERENCE_MIN_PX)return null;
    motion.normalize();
    const base=worldToClient(runtimeModel.movePickPoint);
    let best=null;
    for(const [axis,dir] of Object.entries({x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)})){
      const end=worldToClient(runtimeModel.movePickPoint.clone().add(dir));
      const sv=end.sub(base);
      if(sv.length()<14)continue;
      sv.normalize();
      const dot=Math.abs(motion.dot(sv));
      const angle=Math.acos(THREE.MathUtils.clamp(dot,-1,1));
      if(angle<=AXIS_INFERENCE_ANGLE&&(!best||angle<best.angle))best={axis,angle};
    }
    return best?.axis||null;
  }
  function axisVector(axis){return axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);}
  return {getClientPoint,getPointerNDC,intersectPlane,intersectGround,closestParamOnAxis,worldAxisForFace,worldToClient,inferMoveAxis,axisVector};
}
