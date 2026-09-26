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

  // 1.311.00-r4 · Windows: zoom estilo SketchUp com ponto 3D travado por gesto.
  // O primeiro passo da roda escolhe o ponto sob o cursor. Enquanto a sequência de
  // rolagem continua, esse mesmo ponto fica ancorado no mundo e na mesma posição da
  // tela: a câmera e o target são transladados juntos, sem "perseguir" o mouse.
  // Uma pausa curta libera a âncora; o próximo giro escolhe um novo ponto.
  const windowsDesktopZoom=!!(window.DesignLabDesktop?.isDesktop &&
    (window.DesignLabDesktop?.platform==='win32' || document.documentElement.classList.contains('designlab-windows')));
  const winZoomRaycaster=windowsDesktopZoom?new THREE.Raycaster():null;
  const winZoomNdc=windowsDesktopZoom?new THREE.Vector2():null;
  const winZoomPlane=windowsDesktopZoom?new THREE.Plane():null;
  const winZoomNormal=windowsDesktopZoom?new THREE.Vector3():null;
  const winZoomFallback=windowsDesktopZoom?new THREE.Vector3():null;
  const winZoomDelta=windowsDesktopZoom?new THREE.Vector3():null;
  const WIN_ZOOM_GESTURE_MS=300;
  let winZoomAnchor=null;
  let winZoomLastAt=-Infinity;
  function windowsZoomObjects(){
    const list=ctx.runtimeModel?.objects;
    if(!Array.isArray(list))return [];
    return list.filter(o=>{
      if(!o||o.visible===false||o.isMesh!==true)return false;
      const u=o.userData||{};
      return !(u.kind==='hardware-visual'||u.kind==='cylinder'||u.isVisualEdge||u.isMachiningVisual||u.isSpacePick||u.kind==='space-cell'||u.kind==='space-root-outline');
    });
  }
  function windowsZoomFocus(clientX,clientY){
    const rect=renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return controls.target.clone();
    winZoomNdc.set(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1);
    winZoomRaycaster.setFromCamera(winZoomNdc,perspectiveCamera);
    const hits=winZoomRaycaster.intersectObjects(windowsZoomObjects(),false);
    if(hits.length)return hits[0].point.clone();
    // No vazio, usa o plano perpendicular à câmera que passa pelo target atual.
    perspectiveCamera.getWorldDirection(winZoomNormal);
    winZoomPlane.setFromNormalAndCoplanarPoint(winZoomNormal,controls.target);
    return winZoomRaycaster.ray.intersectPlane(winZoomPlane,winZoomFallback)?winZoomFallback.clone():controls.target.clone();
  }
  function windowsZoomGestureAnchor(e){
    const now=performance.now();
    if(!winZoomAnchor || now-winZoomLastAt>WIN_ZOOM_GESTURE_MS){
      winZoomAnchor=windowsZoomFocus(e.clientX,e.clientY);
    }
    winZoomLastAt=now;
    return winZoomAnchor;
  }
  function windowsSketchZoom(e){
    if(!windowsDesktopZoom||getCamera()!==perspectiveCamera||getViewMode2D())return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    const raw=Math.abs(Number(e.deltaY)||0);
    const unit=e.deltaMode===1?3:(e.deltaMode===2?12:100);
    const steps=THREE.MathUtils.clamp(raw/Math.max(1,unit),.18,5);
    const zoomIn=e.deltaY<0;
    const focus=windowsZoomGestureAnchor(e);
    const oldPos=perspectiveCamera.position.clone();
    const offset=oldPos.clone().sub(focus);
    const dist=Math.max(offset.length(),1e-7);
    const factor=Math.pow(zoomIn ? .80 : 1.25,steps);
    const nextDist=zoomIn?Math.max(.00035,dist*factor):Math.min(250,dist*factor);
    const newPos=focus.clone().add(offset.multiplyScalar(nextDist/dist));

    // A diferença para o r3: não gira/recentra a câmera em direção ao ponto.
    // Transladar position e target pelo mesmo delta conserva a orientação e faz o
    // ponto escolhido permanecer no mesmo pixel durante toda a sequência da roda.
    winZoomDelta.copy(newPos).sub(oldPos);
    perspectiveCamera.position.copy(newPos);
    controls.target.add(winZoomDelta);

    const near=zoomIn?THREE.MathUtils.clamp(nextDist*.025,.00008,.001):.001;
    if(Math.abs(perspectiveCamera.near-near)>1e-7){
      perspectiveCamera.near=near;
      perspectiveCamera.updateProjectionMatrix();
    }
    perspectiveCamera.updateMatrixWorld(true);
    controls.update();
    remember3DView();
    return true;
  }

  renderer.domElement.addEventListener('wheel',e=>{
    if(windowsSketchZoom(e))return;
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
