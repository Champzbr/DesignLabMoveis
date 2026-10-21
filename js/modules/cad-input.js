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

  // 1.311.00-r18 · Windows: zoom estilo SketchUp com ponto 3D travado pelo cursor.
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
  const WIN_ZOOM_CURSOR_RELEASE_PX=7;
  let winZoomAnchor=null;
  let winZoomAnchorClientX=NaN;
  let winZoomAnchorClientY=NaN;
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
  function windowsZoomResetAnchor(){
    winZoomAnchor=null;
    winZoomAnchorClientX=NaN;
    winZoomAnchorClientY=NaN;
  }
  function windowsZoomGestureAnchor(e){
    // 1.311.00-r18 · A âncora não expira por tempo. Em mouse com roda física,
    // dois "dentes" podem ficar separados por mais de 300 ms e o r4 acabava
    // escolhendo outro ponto 3D sob o mesmo pixel. Resultado: parecia que o zoom
    // continuava seguindo o ponteiro. Agora o ponto 3D só muda quando o usuário
    // realmente move o cursor para outro lugar (ou inicia outra navegação).
    if(!winZoomAnchor){
      winZoomAnchor=windowsZoomFocus(e.clientX,e.clientY);
      winZoomAnchorClientX=e.clientX;
      winZoomAnchorClientY=e.clientY;
    }
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

  if(windowsDesktopZoom){
    renderer.domElement.addEventListener('pointermove',e=>{
      if(e.pointerType&&e.pointerType!=='mouse')return;
      if(!winZoomAnchor||!Number.isFinite(winZoomAnchorClientX)||!Number.isFinite(winZoomAnchorClientY))return;
      if(Math.hypot(e.clientX-winZoomAnchorClientX,e.clientY-winZoomAnchorClientY)>=WIN_ZOOM_CURSOR_RELEASE_PX){
        windowsZoomResetAnchor();
      }
    },{capture:true,passive:true});
    // Orbitar/panear significa que o usuário mudou a intenção de câmera; o próximo
    // giro escolhe um novo ponto sob o cursor. Sair do canvas também libera o foco.
    controls.addEventListener('start',windowsZoomResetAnchor);
    renderer.domElement.addEventListener('mouseleave',windowsZoomResetAnchor,{passive:true});

    // 1.311.00-r18 · Windows: órbita estilo SketchUp no botão do meio.
    // O pivô é o ponto 3D sob o cursor no instante em que a rodinha é pressionada.
    // Durante o arraste, posição E orientação da câmera são rotacionadas ao redor
    // desse pivô. Assim o ponto escolhido permanece visualmente estável na tela,
    // em vez de o móvel inteiro girar em torno de um target global distante.
    const orbitWorldUp=new THREE.Vector3(0,1,0);
    const orbitRight=new THREE.Vector3();
    const orbitOffset=new THREE.Vector3();
    const orbitForward=new THREE.Vector3();
    const orbitForwardTest=new THREE.Vector3();
    const orbitQYaw=new THREE.Quaternion();
    const orbitQPitch=new THREE.Quaternion();
    let winOrbit=null;
    function syncControlsTargetToCamera(distance){
      perspectiveCamera.getWorldDirection(orbitForward);
      controls.target.copy(perspectiveCamera.position).addScaledVector(orbitForward,Math.max(.01,distance||1));
    }
    function beginWindowsPivotOrbit(e){
      if(e.pointerType&&e.pointerType!=='mouse')return false;
      if(e.button!==1||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return false;
      if(getCamera()!==perspectiveCamera||getViewMode2D())return false;
      const pivot=windowsZoomFocus(e.clientX,e.clientY);
      const lookDistance=Math.max(.01,perspectiveCamera.position.distanceTo(controls.target));
      winOrbit={id:e.pointerId,pivot,lastX:e.clientX,lastY:e.clientY,lookDistance};
      windowsZoomResetAnchor();
      try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
    function moveWindowsPivotOrbit(e){
      if(!winOrbit||e.pointerId!==winOrbit.id)return false;
      const dx=e.clientX-winOrbit.lastX,dy=e.clientY-winOrbit.lastY;
      winOrbit.lastX=e.clientX;winOrbit.lastY=e.clientY;
      if(!dx&&!dy){e.preventDefault();e.stopImmediatePropagation();return true;}
      const rect=renderer.domElement.getBoundingClientRect();
      const speed=(Math.PI*1.55)/Math.max(280,Math.min(rect.width||800,rect.height||600));

      // Yaw em torno do eixo vertical global.
      orbitQYaw.setFromAxisAngle(orbitWorldUp,-dx*speed);
      orbitOffset.copy(perspectiveCamera.position).sub(winOrbit.pivot).applyQuaternion(orbitQYaw);
      perspectiveCamera.position.copy(winOrbit.pivot).add(orbitOffset);
      perspectiveCamera.quaternion.premultiply(orbitQYaw);

      // Pitch em torno do eixo horizontal atual da câmera. Limitamos antes de
      // chegar ao polo para evitar a inversão "de cabeça para baixo".
      orbitRight.set(1,0,0).applyQuaternion(perspectiveCamera.quaternion).normalize();
      orbitQPitch.setFromAxisAngle(orbitRight,-dy*speed);
      perspectiveCamera.getWorldDirection(orbitForward);
      orbitForwardTest.copy(orbitForward).applyQuaternion(orbitQPitch);
      if(Math.abs(orbitForwardTest.dot(orbitWorldUp))<.985){
        orbitOffset.copy(perspectiveCamera.position).sub(winOrbit.pivot).applyQuaternion(orbitQPitch);
        perspectiveCamera.position.copy(winOrbit.pivot).add(orbitOffset);
        perspectiveCamera.quaternion.premultiply(orbitQPitch);
      }

      // O render loop chama controls.update() em todo frame. Mantemos o target
      // alinhado com a orientação resultante para o OrbitControls não desfazer a
      // órbita customizada no frame seguinte.
      perspectiveCamera.updateMatrixWorld(true);
      syncControlsTargetToCamera(winOrbit.lookDistance);
      controls.update();
      remember3DView();
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
    function endWindowsPivotOrbit(e){
      if(!winOrbit||e.pointerId!==winOrbit.id)return false;
      try{renderer.domElement.releasePointerCapture(e.pointerId);}catch{}
      winOrbit=null;
      remember3DView();
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
    renderer.domElement.addEventListener('pointerdown',e=>{beginWindowsPivotOrbit(e);},{capture:true,passive:false});
    renderer.domElement.addEventListener('pointermove',e=>{moveWindowsPivotOrbit(e);},{capture:true,passive:false});
    renderer.domElement.addEventListener('pointerup',e=>{endWindowsPivotOrbit(e);},{capture:true,passive:false});
    renderer.domElement.addEventListener('pointercancel',e=>{endWindowsPivotOrbit(e);},{capture:true,passive:false});
    renderer.domElement.addEventListener('lostpointercapture',e=>{
      if(winOrbit&&e.pointerId===winOrbit.id){winOrbit=null;remember3DView();}
    },{capture:true,passive:true});
  }

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
