// DesignLabMoveis 1.311.00 · gestos de navegação/zoom do canvas CAD.
export function installCadInputNavigation(ctx){
  const {
    THREE,renderer,controls,perspectiveCamera,
    CAD_ZOOM_DEFAULT_SPEED,CAD_ZOOM_TOUCH_SPEED,CAD_ZOOM_SURFACE_GAP,
    getCamera,getViewMode2D,getToolMode,last3DView,
    cadZoomPrepareIn,cadZoomPrepareTouchIn,cadZoomResetOut,
    returnTo3D,remember3DView
  }=ctx;

  controls.zoomSpeed=CAD_ZOOM_DEFAULT_SPEED;
  controls.zoomToCursor=true;
  controls.minDistance=.001;
  controls.maxDistance=250;

  renderer.domElement.addEventListener('wheel',e=>{
    if(getCamera()!==perspectiveCamera||getViewMode2D())return;
    if(e.deltaY<0){
      const d=cadZoomPrepareIn(e.clientX,e.clientY);
      if(Number.isFinite(d)&&d<=CAD_ZOOM_SURFACE_GAP*1.04){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }else cadZoomResetOut();
  },{passive:false,capture:true});

  const touchPointers=new Map();
  let lastPinchDistance=0;
  const pinchDistance=()=>{
    const pts=[...touchPointers.values()];
    return pts.length<2?0:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
  };
  renderer.domElement.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touchPointers.size===1){controls.zoomToCursor=false;controls.zoomSpeed=CAD_ZOOM_TOUCH_SPEED;}
    if(touchPointers.size===2)lastPinchDistance=pinchDistance();
  },{capture:true,passive:true});
  renderer.domElement.addEventListener('pointermove',e=>{
    if(e.pointerType!=='touch'||!touchPointers.has(e.pointerId))return;
    touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touchPointers.size!==2)return;
    const next=pinchDistance();
    if(!lastPinchDistance){lastPinchDistance=next;return;}
    const delta=next-lastPinchDistance;
    if(delta>.15)cadZoomPrepareTouchIn();
    else if(delta<-.15)cadZoomResetOut({touch:true});
    lastPinchDistance=next;
  },{capture:true,passive:false});
  const endTouch=e=>{
    if(e.pointerType!=='touch')return;
    touchPointers.delete(e.pointerId);
    if(touchPointers.size<2)lastPinchDistance=0;
    if(touchPointers.size===0){controls.zoomToCursor=true;cadZoomResetOut();}
    else controls.zoomSpeed=CAD_ZOOM_TOUCH_SPEED;
  };
  renderer.domElement.addEventListener('pointerup',endTouch,{capture:true,passive:true});
  renderer.domElement.addEventListener('pointercancel',endTouch,{capture:true,passive:true});

  const desktopCadNavigation=!!window.matchMedia?.('(pointer:fine)').matches;
  if(desktopCadNavigation){
    controls.mouseButtons.LEFT=null;
    controls.mouseButtons.MIDDLE=THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT=null;
    controls.enableRotate=true;
    controls.enablePan=true;
    controls.enableZoom=true;
    controls.enableDamping=false;
    controls.dampingFactor=0;
  }
  controls.update();

  // Na vista 2D, pinça/pan com 2 dedos permanece em 2D; arrastar com 1 dedo volta ao 3D.
  let orthoNavGesture=null;
  const orthoPointers=new Set();
  let orthoMultiTouch=false;
  renderer.domElement.addEventListener('pointerdown',e=>{
    orthoPointers.add(e.pointerId);
    if(!getViewMode2D()||getToolMode()!=='select')return;
    if(orthoPointers.size>=2){orthoMultiTouch=true;orthoNavGesture=null;return;}
    if(e.isPrimary!==false){orthoMultiTouch=false;orthoNavGesture={id:e.pointerId,x:e.clientX,y:e.clientY};}
  },{passive:true});
  renderer.domElement.addEventListener('pointermove',e=>{
    if(!getViewMode2D()||getToolMode()!=='select'||orthoMultiTouch||orthoPointers.size>1)return;
    if(!orthoNavGesture||e.pointerId!==orthoNavGesture.id)return;
    if(Math.hypot(e.clientX-orthoNavGesture.x,e.clientY-orthoNavGesture.y)>12){
      orthoNavGesture=null;
      returnTo3D({restore:true,notify:true});
    }
  },{passive:true});
  const clearOrthoPointer=e=>{
    if(e)orthoPointers.delete(e.pointerId);
    if(!e||!orthoNavGesture||e.pointerId===orthoNavGesture.id)orthoNavGesture=null;
    if(orthoPointers.size===0)orthoMultiTouch=false;
  };
  renderer.domElement.addEventListener('pointerup',clearOrthoPointer,{passive:true});
  renderer.domElement.addEventListener('pointercancel',clearOrthoPointer,{passive:true});
  renderer.domElement.addEventListener('lostpointercapture',clearOrthoPointer,{passive:true});

  controls.addEventListener('end',()=>{
    if(!getViewMode2D()&&getCamera()===perspectiveCamera)remember3DView();
  });

  return {desktopCadNavigation,last3DView};
}
