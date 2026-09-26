// DesignLabMoveis 1.311.00 · Seleção 3D, gestos e manipulação interativa.
export function createSelection3DModule(ctx){
  const { $, THREE, renderer, controls, getPointerNDC, designLabVisualizationOnlyActive, selectObject, clearSpaceSelection, rootForObject, openSpaceFromObject, openPieceInspector, isDoorObject, objectInsideSpaceRoot, worldAxisForFace, nearestCornerToClient, nearestEdgeOnMeshToClient, worldToClient, getBounds, updateMeasureBadge, updateInspector, renderSpaces, setAllFaces, commitHistory, renderMachiningVisuals, stateString, intersectPlane, axisVector, closestParamOnAxis, inferMoveAxis, showInference, hideInference, findMoveInferenceTarget, snapMovingObjectFeaturesToGuide, setMoveTargetMarker, snapFaceCoordinate, hideGuides, showGuide, moveGrip, cornerMarker, COLORS, clampSize, REAIM_THRESHOLD_PX, updateTapePreview, tapePointAimClient, tapePointAimEvent, handleTapeTap, desktopCadNavigation, getSpaceRoot, getSpaceCell, selectSpaceCellByIds, toggleSpaceMultiSelection, clearSpaceMultiSelection, openSpaceQuickCreateMenu, referenceMeshes, hardwareCopyHandlePick, shapeCopyHandlePick, CORNER_PICK_PX, EDGE_PICK_PX, findMoveSnap, guideX, guideY, guideZ, mm, toast, pickSpaceCellAtClient, spaceSelectionKey }=ctx;
  const runtimeModel=ctx.runtimeModel;
// 1.311.00-r1 · interação dos ESPAÇOS no celular:
// - 1 toque mantém o fluxo normal de seleção;
// - 2 toques rápidos adicionam/removem o vão da seleção de porta;
// - toque longo abre Porta/Gaveta usando a seleção já montada.
// No PC, Ctrl+clique continua fazendo a seleção múltipla e duplo clique abre o menu rápido.
let spaceTapState={count:0,lastAt:0,lastX:0,lastY:0,rootId:null,cellId:null};
let lastSpacePointerType='mouse';
let suppressTouchDblClickUntil=0;
const SPACE_MULTI_TAP_GAP_MS=560;
const SPACE_MULTI_TAP_PX=64;
function resetSpaceDoubleTap(){
  spaceTapState={count:0,lastAt:0,lastX:0,lastY:0,rootId:null,cellId:null};
}
function registerSpaceDoubleTap(rootId,cellId){
  const now=performance.now();
  const distance=Math.hypot(ctx.downClientX-spaceTapState.lastX,ctx.downClientY-spaceTapState.lastY);
  const closeEnough=distance<=SPACE_MULTI_TAP_PX;
  const elapsed=now-spaceTapState.lastAt;
  const inTime=elapsed<=SPACE_MULTI_TAP_GAP_MS;
  const sameTarget=spaceTapState.rootId===rootId && spaceTapState.cellId===cellId;

  // Alguns WebViews Android podem repetir o pointerdown do mesmo contato quase
  // instantaneamente. Isso não deve virar um falso "duplo toque". Um segundo
  // toque real precisa ter uma pequena separação temporal.
  const looksLikeDuplicateEvent=spaceTapState.count && sameTarget && distance<=12 && elapsed>=0 && elapsed<45;
  if(looksLikeDuplicateEvent)return false;

  if(spaceTapState.count && closeEnough && inTime && sameTarget){
    resetSpaceDoubleTap();
    return true;
  }
  spaceTapState={count:1,lastAt:now,lastX:ctx.downClientX,lastY:ctx.downClientY,rootId,cellId};
  return false;
}

// 1.311.00-r1 · no celular, o duplo toque alterna a seleção múltipla.
// O toque longo NÃO seleciona por si só: ele abre o menu e, se necessário,
// acrescenta o vão pressionado como última referência. No PC usa Ctrl + clique.
let spaceLongPressTimer=null;
let spaceLongPress={id:null,rootId:null,cellId:null,x:0,y:0,triggered:false};
const SPACE_LONG_PRESS_MS=520;
const SPACE_LONG_PRESS_MOVE_PX=18;
function cancelSpaceLongPress(){
  if(spaceLongPressTimer){clearTimeout(spaceLongPressTimer);spaceLongPressTimer=null;}
  spaceLongPress={id:null,rootId:null,cellId:null,x:0,y:0,triggered:false};
}
function startSpaceLongPress(rootId,cellId,pointerId,x,y){
  cancelSpaceLongPress();
  if(ctx.toolMode!=='select'||!rootId||!cellId)return;
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive())return;
  spaceLongPress={id:pointerId,rootId,cellId,x,y,triggered:false};
  spaceLongPressTimer=setTimeout(()=>{
    spaceLongPressTimer=null;
    const root=getSpaceRoot(rootId),cell=getSpaceCell(rootId,cellId);
    if(ctx.toolMode!=='select'||!root||!cell)return;
    spaceLongPress.triggered=true;
    resetSpaceDoubleTap();
    // Se já havia outra referência, o vão pressionado entra na seleção e o menu
    // abre imediatamente. Assim dá para selecionar baixo + cima e já criar a porta.
    openSpaceQuickCreateMenu(rootId,cellId,{addReference:true});
    try{if(navigator.vibrate)navigator.vibrate([18,35,18]);}catch{}
  },SPACE_LONG_PRESS_MS);
}
function cancelSpaceLongPressOnMove(e){
  if(!spaceLongPressTimer||spaceLongPress.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-spaceLongPress.x,e.clientY-spaceLongPress.y)>SPACE_LONG_PRESS_MOVE_PX){
    cancelSpaceLongPress();
    resetSpaceDoubleTap();
  }
}

let pieceTapState={count:0,lastAt:0,lastX:0,lastY:0,obj:null,rootId:null,doubleTimer:null};
const PIECE_MULTI_TAP_GAP_MS=560;
const PIECE_MULTI_TAP_PX=64;
const PIECE_DOUBLE_ACTION_DELAY_MS=620;

function resetLinkedDoubleTap(){
  if(pieceTapState.doubleTimer)clearTimeout(pieceTapState.doubleTimer);
  pieceTapState={count:0,lastAt:0,lastX:0,lastY:0,obj:null,rootId:null,doubleTimer:null};
}
function registerLinkedDoubleTap(obj){
  const now=performance.now();
  const root=rootForObject(obj),rootId=root?.id||null;
  const distance=Math.hypot(ctx.downClientX-pieceTapState.lastX,ctx.downClientY-pieceTapState.lastY);
  const closeEnough=distance<=PIECE_MULTI_TAP_PX;
  const elapsed=now-pieceTapState.lastAt;
  const inTime=elapsed<=PIECE_MULTI_TAP_GAP_MS;
  const sameRoot=pieceTapState.rootId===rootId;
  const sameObject=pieceTapState.obj===obj;

  // Evita pointerdown duplicado do mesmo contato em alguns WebViews Android.
  const duplicateEvent=pieceTapState.count&&sameObject&&distance<=12&&elapsed>=0&&elapsed<110;
  if(duplicateEvent)return false;

  if(!pieceTapState.count||!closeEnough||!inTime||!sameRoot||!sameObject){
    resetLinkedDoubleTap();
    pieceTapState={count:1,lastAt:now,lastX:ctx.downClientX,lastY:ctx.downClientY,obj,rootId,doubleTimer:null};
    return false;
  }

  // Duplo toque/clique continua abrindo o espaço/móvel vinculado, como antes.
  if(pieceTapState.count===1){
    pieceTapState.count=2;pieceTapState.lastAt=now;pieceTapState.lastX=ctx.downClientX;pieceTapState.lastY=ctx.downClientY;
    const pendingObj=obj,pendingRoot=root;
    pieceTapState.doubleTimer=setTimeout(()=>{
      if(pieceTapState.count!==2)return;
      resetLinkedDoubleTap();
      if(pendingRoot)openSpaceFromObject(pendingObj);
    },PIECE_DOUBLE_ACTION_DELAY_MS);
    return true;
  }

  resetLinkedDoubleTap();
  return false;
}

// 1.200.18 · segurar a peça abre a configuração (mouse e touch).
let pieceLongPressTimer=null;
let pieceLongPress={id:null,obj:null,x:0,y:0,triggered:false};
const PIECE_LONG_PRESS_MS=520;
const PIECE_LONG_PRESS_MOVE_PX=18;
function cancelPieceLongPress(){
  if(pieceLongPressTimer){clearTimeout(pieceLongPressTimer);pieceLongPressTimer=null;}
  pieceLongPress={id:null,obj:null,x:0,y:0,triggered:false};
}
function startPieceLongPress(obj,pointerId,x,y){
  cancelPieceLongPress();
  if(!obj||ctx.toolMode!=='select')return;
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive())return;
  pieceLongPress={id:pointerId,obj,x,y,triggered:false};
  pieceLongPressTimer=setTimeout(()=>{
    pieceLongPressTimer=null;
    if(ctx.toolMode!=='select'||pieceLongPress.obj!==obj)return;
    pieceLongPress.triggered=true;
    resetLinkedDoubleTap();
    selectObject(obj);
    openPieceInspector(obj);
    try{if(navigator.vibrate)navigator.vibrate(18);}catch{}
    toast('Configuração da peça');
  },PIECE_LONG_PRESS_MS);
}
function cancelPieceLongPressOnMove(e){
  if(!pieceLongPressTimer||pieceLongPress.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-pieceLongPress.x,e.clientY-pieceLongPress.y)>PIECE_LONG_PRESS_MOVE_PX){
    cancelPieceLongPress();
    resetLinkedDoubleTap();
  }
}

function beginPick(event=null){
  // 1.200.51 · Copiar Forma / Copiar Ferragens usam o mesmo raycast do CAD,
  // mas mantêm seleção múltipla própria. Enquanto um desses modos está ativo,
  // os toques não entram no fluxo normal de selecionar/mover peça.
  if(typeof hardwareCopyHandlePick==='function' && hardwareCopyHandlePick()){
    ctx.dragMode=null; controls.enabled=true; return;
  }
  if(typeof shapeCopyHandlePick==='function' && shapeCopyHandlePick()){
    ctx.dragMode=null; controls.enabled=true; return;
  }
  runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,ctx.camera);
  const hits=runtimeModel.raycaster.intersectObjects(referenceMeshes(),false);
  if(!hits.length){
    if(ctx.toolMode==='select'){ selectObject(null); clearSpaceSelection(); resetLinkedDoubleTap(); resetSpaceDoubleTap(); cancelSpaceLongPress(); }
    ctx.dragMode=null; controls.enabled=true; return;
  }
  let hit=hits[0], obj=hit.object;

  // 1.200.18: quando já estamos trabalhando em um espaço e uma porta está
  // na frente, a porta não bloqueia a seleção dos cortes atrás dela. Procuramos
  // no mesmo raio a divisão do espaço principal ativo. Peças comuns continuam
  // selecionáveis normalmente; a prioridade especial vale para portas.
  if(ctx.toolMode==='select' && (ctx.selectedSpaceCell||ctx.activeSpaceRootId) && isDoorObject(obj)){
    const activeRootId=ctx.selectedSpaceCell?.rootId||ctx.activeSpaceRootId;
    const cellHit=hits.find(h=>h.object?.userData?.kind==='space-cell' && h.object.userData.spaceRootId===activeRootId);
    if(cellHit){ hit=cellHit; obj=cellHit.object; }
  }

  if(obj.userData.kind==='space-cell'){
    resetLinkedDoubleTap();
    if(ctx.toolMode==='select'){
      const rootId=obj.userData.spaceRootId,cellId=obj.userData.spaceCellId;
      const isTouch=event?.pointerType==='touch';
      lastSpacePointerType=isTouch?'touch':(event?.pointerType||'mouse');
      const multiModifier=!isTouch&&!!(event?.ctrlKey||event?.metaKey);

      // CELULAR · r7: o segundo toque rápido no MESMO vão apenas alterna a
      // referência da porta. O menu não abre aqui; ele só abre ao segurar.
      if(isTouch){
        const isDoubleTap=registerSpaceDoubleTap(rootId,cellId);
        if(isDoubleTap){
          cancelSpaceLongPress();
          suppressTouchDblClickUntil=performance.now()+900;
          toggleSpaceMultiSelection(rootId,cellId,{notify:true});
          ctx.dragMode=null;controls.enabled=true;return;
        }

        // O primeiro toque de um possível duplo toque não pode apagar os vãos
        // que já foram selecionados. Ele muda só o vão ativo e arma o toque longo.
        selectSpaceCellByIds(rootId,cellId,{
          showMenu:false,
          preserveMulti:runtimeModel.selectedSpaceCells.size>0
        });
        startSpaceLongPress(rootId,cellId,event.pointerId,event.clientX,event.clientY);
        ctx.dragMode=null;controls.enabled=true;return;
      }

      // PC: Ctrl + clique adiciona/remove o vão da seleção múltipla.
      if(multiModifier){
        cancelSpaceLongPress();
        toggleSpaceMultiSelection(rootId,cellId,{notify:true});
        ctx.dragMode=null;controls.enabled=true;return;
      }

      // PC sem modificador: seleção normal. O menu rápido permanece no dblclick.
      if(runtimeModel.selectedSpaceCells.size){clearSpaceMultiSelection({notify:false});}
      selectSpaceCellByIds(rootId,cellId,{showMenu:false});
      ctx.dragMode=null; controls.enabled=true; return;
    }
    if(ctx.toolMode==='move-free'){
      const root=getSpaceRoot(obj.userData.spaceRootId);
      if(!root){ctx.dragMode=null;controls.enabled=true;return;}
      selectSpaceCellByIds(obj.userData.spaceRootId,obj.userData.spaceCellId);
      ctx.movingSpaceRoot=root;
      ctx.movingSpaceRootStart={x:root.x,yBase:root.yBase,z:root.z};
      ctx.movingSpaceCellStarts=root.cells.map(c=>({id:c.id,minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ}));
      ctx.movingSpaceObjectStarts=runtimeModel.objects.filter(o=>objectInsideSpaceRoot(o,root)).map(o=>({obj:o,pos:o.position.clone()}));
      ctx.dragStartState=stateString(); ctx.dragChanged=false; ctx.dragMode='space-free'; controls.enabled=false;
      ctx.camera.getWorldDirection(runtimeModel.freeMovePlaneNormal).normalize();
      runtimeModel.freeMovePlane.setFromNormalAndCoplanarPoint(runtimeModel.freeMovePlaneNormal,hit.point);
      if(!intersectPlane(runtimeModel.freeMovePlane,runtimeModel.movingSpaceStartPoint)) runtimeModel.movingSpaceStartPoint.copy(hit.point);
      return;
    }
    toast('Use Selecionar, Mover ou as ações do espaço');
    ctx.dragMode=null; controls.enabled=true; return;
  }
  // 1.200.95: removidos duplo toque e toque segurado do CAD.
  // Um toque apenas seleciona; qualquer configuração abre pelo botão fixo no canto.
  if(ctx.toolMode==='select'){
    cancelSpaceLongPress();
    cancelPieceLongPress();
    resetSpaceDoubleTap();
    resetLinkedDoubleTap();
  }
  selectObject(obj);
  const f=worldAxisForFace(hit,obj);
  const u=obj.userData;
  ctx.dragStartState=stateString(); ctx.dragChanged=false;

  if(ctx.toolMode==='move-free'){
    // Estilo CAD: se a mira estiver perto de uma quina da face tocada,
    // a quina exata vira o ponto de pega. Caso contrário usa o ponto da face.
    ctx.dragMode='free';
    controls.enabled=false;
    runtimeModel.freeMoveStartPosition.copy(obj.position);
    const actualAim=new THREE.Vector2(
      ((runtimeModel.pointer.x+1)*.5)*renderer.domElement.getBoundingClientRect().width + renderer.domElement.getBoundingClientRect().left,
      ((1-runtimeModel.pointer.y)*.5)*renderer.domElement.getBoundingClientRect().height + renderer.domElement.getBoundingClientRect().top
    );
    const corner=nearestCornerToClient(obj,f,actualAim,CORNER_PICK_PX);
    const edge=!corner ? nearestEdgeOnMeshToClient(obj,actualAim,EDGE_PICK_PX) : null;
    ctx.moveGrabIsCorner=!!corner;
    ctx.moveGrabKind=corner ? 'corner' : edge ? 'edge' : 'face';
    runtimeModel.movePickPoint.copy(corner ? corner.point : edge ? edge.point : hit.point);
    moveGrip.position.copy(runtimeModel.movePickPoint); moveGrip.visible=true;
    moveGrip.material.color.set(ctx.moveGrabKind==='corner' ? 0x34d058 : ctx.moveGrabKind==='edge' ? 0xffd23f : COLORS.cyan);
    if(ctx.moveGrabKind!=='face'){
      cornerMarker.position.copy(runtimeModel.movePickPoint); cornerMarker.visible=true;
      cornerMarker.material.color.set(ctx.moveGrabKind==='corner' ? 0x34d058 : 0xffd23f);
    }
    const aimClient=worldToClient(runtimeModel.movePickPoint);
    runtimeModel.moveDownAim.copy(aimClient);
    ctx.camera.getWorldDirection(runtimeModel.freeMovePlaneNormal).normalize();
    runtimeModel.freeMovePlane.setFromNormalAndCoplanarPoint(runtimeModel.freeMovePlaneNormal,runtimeModel.movePickPoint);
    if(!intersectPlane(runtimeModel.freeMovePlane,runtimeModel.freeMoveStartPoint)) runtimeModel.freeMoveStartPoint.copy(runtimeModel.movePickPoint);
    ctx.moveInferenceAxis=null;
    ctx.lastEdit={type:'position',axis:'free',mesh:obj};
    return;
  }

  if(ctx.toolMode==='pull'){
    controls.enabled=false;
    if(u.kind==='cylinder' && f.axis!=='y'){
      ctx.dragMode='radius';
      runtimeModel.radiusDir.set(hit.point.x-obj.position.x,0,hit.point.z-obj.position.z).normalize();
      ctx.lastEdit={type:'diameter',mesh:obj};
      return;
    }
    ctx.pullAxis=f.axis; ctx.grabSign=f.sign;
    if(ctx.pullAxis==='x'){ ctx.anchorCoord=obj.position.x-ctx.grabSign*u.width/2; ctx.lockedA=obj.position.y; ctx.lockedB=obj.position.z; }
    if(ctx.pullAxis==='y'){ ctx.anchorCoord=obj.position.y-ctx.grabSign*u.height/2; ctx.lockedA=obj.position.x; ctx.lockedB=obj.position.z; }
    if(ctx.pullAxis==='z'){ ctx.anchorCoord=obj.position.z-ctx.grabSign*u.depth/2; ctx.lockedA=obj.position.x; ctx.lockedB=obj.position.y; }
    ctx.dragMode='pull-'+ctx.pullAxis; ctx.lastEdit={type:ctx.pullAxis,mesh:obj};
    return;
  }

  // Selecionar no estilo CAD: apenas seleciona. Não move e não abre painel.
  ctx.dragMode=null;
  controls.enabled=true;
}

function moveSpaceFree(){
  if(!ctx.movingSpaceRoot) return;
  if(!intersectPlane(runtimeModel.freeMovePlane,runtimeModel.movingSpaceCurrentPoint)) return;
  const rawDelta=runtimeModel.movingSpaceCurrentPoint.clone().sub(runtimeModel.movingSpaceStartPoint);
  const root=ctx.movingSpaceRoot;
  const start0=ctx.movingSpaceCellStarts[0];
  if(!start0) return;
  const rs=ctx.movingSpaceRootStart || {x:root.x,yBase:root.yBase,z:root.z};
  // Não deixa o móvel atravessar o plano do chão ao mover.
  const delta=rawDelta.clone();
  if(rs.yBase+delta.y<0) delta.y=-rs.yBase;
  // O grupo visual usa o delta enquanto os dados absolutos são atualizados.
  if(root.group) root.group.position.copy(delta);
  root.x=rs.x+delta.x; root.yBase=rs.yBase+delta.y; root.z=rs.z+delta.z;
  root.cells.forEach((c,i)=>{
    const st=ctx.movingSpaceCellStarts[i]; if(!st)return;
    c.minX=st.minX+delta.x; c.maxX=st.maxX+delta.x;
    c.minY=st.minY+delta.y; c.maxY=st.maxY+delta.y;
    c.minZ=st.minZ+delta.z; c.maxZ=st.maxZ+delta.z;
  });
  for(const item of ctx.movingSpaceObjectStarts) item.obj.position.copy(item.pos).add(delta);
  ctx.dragChanged=delta.lengthSq()>1e-10;
  updateMeasureBadge();
}

function updateLiveLabel(){
  if(!ctx.lastEdit || !ctx.selected || !ctx.dragMode){ runtimeModel.liveLabel.style.display='none'; return; }
  let worldPos=ctx.selected.position.clone();
  const u=ctx.selected.userData;
  let text='';
  if(ctx.dragMode==='planar' || ctx.dragMode==='free'){
    worldPos.y=getBounds(ctx.selected).maxY+.04;
    text=`X ${mm(ctx.selected.position.x)} · Y ${mm(ctx.selected.position.y-u.height/2)} · Z ${mm(ctx.selected.position.z)} mm${ctx.moveSnapText ? ` · ${ctx.moveSnapText}` : ''}`;
  } else if(ctx.dragMode==='radius') { worldPos.set(ctx.selected.position.x+u.width/2,ctx.selected.position.y,ctx.selected.position.z); text=`Ø ${mm(u.width)} mm`; }
  else if(ctx.pullAxis==='x'){ worldPos.set(ctx.selected.position.x+ctx.grabSign*u.width/2,ctx.selected.position.y,ctx.selected.position.z); text=`${mm(u.width)} mm`; }
  else if(ctx.pullAxis==='y'){ worldPos.set(ctx.selected.position.x,ctx.selected.position.y+ctx.grabSign*u.height/2,ctx.selected.position.z); text=`${mm(u.height)} mm`; }
  else { worldPos.set(ctx.selected.position.x,ctx.selected.position.y,ctx.selected.position.z+ctx.grabSign*u.depth/2); text=`${mm(u.depth)} mm`; }
  const p=worldPos.project(ctx.camera); if(p.z>1){runtimeModel.liveLabel.style.display='none';return;}
  runtimeModel.liveLabel.style.left=((p.x*.5+.5)*innerWidth)+'px'; runtimeModel.liveLabel.style.top=((-p.y*.5+.5)*innerHeight)+'px'; runtimeModel.liveLabel.textContent=text; runtimeModel.liveLabel.style.display='block';
}

function moveFree(event){
  if(!ctx.selected) return;
  const inferred=inferMoveAxis(event);
  ctx.moveInferenceAxis=inferred;

  if(inferred){
    const dir=axisVector(inferred);
    runtimeModel.moveAxisDir.copy(dir);
    const t=closestParamOnAxis(runtimeModel.movePickPoint,dir);
    ctx.selected.position.copy(runtimeModel.freeMoveStartPosition).addScaledVector(dir,t);
    showInference(inferred);

    // No eixo inferido, o snap age somente nesse eixo, como uma inferência de CAD.
    const snap=findMoveSnap(ctx.selected,inferred);
    if(snap){ ctx.selected.position[inferred]+=snap.delta; showGuide(inferred,snap.line); }
    if(inferred!=='x') guideX.visible=false;
    if(inferred!=='y') guideY.visible=false;
    if(inferred!=='z') guideZ.visible=false;
  } else {
    hideInference();
    if(!intersectPlane(runtimeModel.freeMovePlane,runtimeModel.freeMoveCurrentPoint)) return;
    const delta=runtimeModel.freeMoveCurrentPoint.clone().sub(runtimeModel.freeMoveStartPoint);
    ctx.selected.position.copy(runtimeModel.freeMoveStartPosition).add(delta);

    // Movimento livre + snap de faces/centros nos três eixos.
    for(const axis of ['x','y','z']){
      const snap=findMoveSnap(ctx.selected,axis);
      if(snap){ ctx.selected.position[axis]+=snap.delta; showGuide(axis,snap.line); }
      else if(axis==='x') guideX.visible=false;
      else if(axis==='y') guideY.visible=false;
      else guideZ.visible=false;
    }
  }

  // Inferência estilo CAD: quina -> guia da Trena -> aresta -> face.
  let movedDelta=ctx.selected.position.clone().sub(runtimeModel.freeMoveStartPosition);
  let currentGrip=runtimeModel.movePickPoint.clone().add(movedDelta);
  const target=findMoveInferenceTarget(ctx.selected,event);
  if(target){
    if(target.kind==='guide' && ctx.moveGrabKind==='face' && target.line?.userData?.axis){
      // Ao mover pela face, a guia pode capturar a lateral/centro da peça,
      // em vez de obrigar apenas o ponto de pega a cair sobre a linha.
      const aligned=snapMovingObjectFeaturesToGuide(ctx.selected,target.line);
      movedDelta=ctx.selected.position.clone().sub(runtimeModel.freeMoveStartPosition);
      currentGrip=runtimeModel.movePickPoint.clone().add(movedDelta);
      if(!aligned){
        ctx.selected.position.add(target.point.clone().sub(currentGrip));
        movedDelta=ctx.selected.position.clone().sub(runtimeModel.freeMoveStartPosition);
        currentGrip.copy(target.point);
      }
    } else {
      ctx.selected.position.add(target.point.clone().sub(currentGrip));
      movedDelta=ctx.selected.position.clone().sub(runtimeModel.freeMoveStartPosition);
      currentGrip.copy(target.point);
    }
    ctx.moveCornerTarget=target.kind==='corner' ? target.point.clone() : null;
    setMoveTargetMarker(target);
  } else {
    ctx.moveCornerTarget=null;
    ctx.moveSnapKind=null; ctx.moveSnapText='';
    if(ctx.moveGrabKind==='corner' || ctx.moveGrabKind==='edge'){
      const c=ctx.moveGrabKind==='corner' ? 0x34d058 : 0xffd23f;
      cornerMarker.position.copy(currentGrip); cornerMarker.visible=true;
      cornerMarker.material.color.set(c);
      moveGrip.material.color.set(c);
    } else {
      cornerMarker.visible=false;
      moveGrip.material.color.set(COLORS.cyan);
    }
  }

  // O ponto de pega viaja junto com a peça, visualmente como no CAD.
  moveGrip.position.copy(currentGrip);
  ctx.dragChanged=true;
}

function pullSelected(axis){
  const u=ctx.selected.userData;
  const dir=axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  const lp=axis==='x'?new THREE.Vector3(ctx.anchorCoord,ctx.lockedA,ctx.lockedB):axis==='y'?new THREE.Vector3(ctx.lockedA,ctx.anchorCoord,ctx.lockedB):new THREE.Vector3(ctx.lockedA,ctx.lockedB,ctx.anchorCoord);
  let t=closestParamOnAxis(lp,dir);
  let edge=ctx.anchorCoord+t;
  const snap=snapFaceCoordinate(ctx.selected,axis,edge);
  if(snap){ edge=snap.coord; t=edge-ctx.anchorCoord; showGuide(axis,snap.line); } else hideGuides();
  const sign=t===0?ctx.grabSign:Math.sign(t);
  const size=clampSize(Math.abs(t));
  ctx.grabSign=sign; // mantém o lado correto também para edições posteriores
  if(axis==='x'){
    u.width=size; ctx.selected.scale.x=size; ctx.selected.position.x=ctx.anchorCoord+sign*size/2;
  } else if(axis==='y'){
    u.height=size; ctx.selected.scale.y=size; ctx.selected.position.y=ctx.anchorCoord+sign*size/2;
    if(ctx.selected.position.y-u.height/2<0 && sign>0){ ctx.selected.position.y=u.height/2; }
  } else {
    u.depth=size; ctx.selected.scale.z=size; ctx.selected.position.z=ctx.anchorCoord+sign*size/2;
  }
  ctx.dragChanged=true;
}

renderer.domElement.addEventListener('pointerdown',e=>{
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive()){
    // Visualização é somente leitura: o evento continua livre para o
    // OrbitControls (girar/pan/zoom), mas não inicia seleção nem edição.
    ctx.dragMode=null;controls.enabled=true;return;
  }
  // Navegação CAD no PC é tratada pelo OrbitControls.
  // O fluxo de edição abaixo continua exclusivo do botão esquerdo.
  if(e.button!==undefined && e.button!==0) return;

  if(ctx.toolMode==='tape'){
    // DOWN só começa o gesto. Arrastar serve para procurar snap; um toque curto
    // é confirmado no UP/END. No modo ponto, 2 dedos nunca pertencem à Trena:
    // eles continuam livres para a pinça/zoom normal da câmera.
    const pointTouch=ctx.tapeMeasureMode==='point' && e.pointerType==='touch';
    if(pointTouch){
      runtimeModel.tapePointTouchPointers.add(e.pointerId);
      if(runtimeModel.tapePointTouchPointers.size>=2){
        ctx.tapePointPinchNavigating=true;
        ctx.tapePointPinchSuppressUntil=performance.now()+350;
        ctx.tapeTouchActive=false; ctx.tapeTouchId=null;
        controls.enabled=true;
        return;
      }
    }
    ctx.tapeMouseActive=e.pointerType!=='touch';
    ctx.activePointerId=e.pointerId;
    ctx.downClientX=e.clientX; ctx.downClientY=e.clientY;
    ctx.tapePointerMoved=false;
    getPointerNDC(e);
    moveTapeCrosshairForEvent(e);
    // Medir ponto no touch deixa o OrbitControls habilitado; o gesto de 1 dedo
    // é neutralizado em controls.touches.ONE e o de 2 dedos segue DOLLY_PAN.
    controls.enabled=pointTouch ? true : false;
    try { updateTapePreview(e); }
    catch(err){ console.error('Trena pointerdown:',err); }
    return;
  }

  if(e.pointerType==='touch' && e.isPrimary===false) return;
  ctx.activePointerId=e.pointerId;
  ctx.downClientX=e.clientX; ctx.downClientY=e.clientY; ctx.gestureLocked=false;
  getPointerNDC(e);
  renderer.domElement.setPointerCapture?.(e.pointerId);
  beginPick(e);
});

// 1.200.95: duplo clique não executa ação no CAD; apenas evita o comportamento nativo do navegador.
if(desktopCadNavigation){
  renderer.domElement.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button===1){
      renderer.domElement.style.cursor='grabbing';
    }
  },{passive:true});
  const releaseDesktopCameraCursor=e=>{
    if(e?.pointerType==='mouse'&&e.button===1){
      renderer.domElement.style.cursor='';
    }
  };
  renderer.domElement.addEventListener('pointerup',releaseDesktopCameraCursor,{passive:true});
  renderer.domElement.addEventListener('pointercancel',releaseDesktopCameraCursor,{passive:true});
  renderer.domElement.addEventListener('auxclick',e=>{
    if(e.button===1)e.preventDefault();
  });
}

renderer.domElement.addEventListener('dblclick',e=>{
  if(ctx.toolMode!=='select')return;
  e.preventDefault();e.stopPropagation();

  // Android/WebView pode transformar dois toques em um dblclick sintético.
  // No celular o duplo toque é SOMENTE seleção; impedir que esse evento abra
  // Porta/Gaveta logo depois. Mouse real no PC continua abrindo o menu.
  if(lastSpacePointerType==='touch'||performance.now()<suppressTouchDblClickUntil)return;

  const pick=pickSpaceCellAtClient(e.clientX,e.clientY);
  if(pick){
    const key=spaceSelectionKey(pick.rootId,pick.cellId);
    const preserve=runtimeModel.selectedSpaceCells.size>1&&runtimeModel.selectedSpaceCells.has(key);
    openSpaceQuickCreateMenu(pick.rootId,pick.cellId,{addReference:preserve});
  }
});

function moveTapeCrosshairRaw(x,y){
  if(ctx.toolMode!=='tape' || !Number.isFinite(x) || !Number.isFinite(y)) return;
  runtimeModel.tapeCrosshair.style.left=x+'px';
  runtimeModel.tapeCrosshair.style.top=y+'px';
  runtimeModel.tapeCrosshair.style.display='block';
}
function moveTapeCrosshairForEvent(ev){
  if(!ev)return;
  const p=tapePointAimClient(ev);
  moveTapeCrosshairRaw(p.x,p.y);
}

function prepareTapeDown(ev){
  ctx.downClientX=ev.clientX; ctx.downClientY=ev.clientY;
  ctx.tapePointerMoved=false;
  getPointerNDC(ev);
  moveTapeCrosshairForEvent(ev);
  const pointTouch=ctx.tapeMeasureMode==='point' && ev?.pointerType==='touch';
  controls.enabled=pointTouch ? true : false;
  try { updateTapePreview(ev); } catch(err){ console.error('Trena preview:',err); }
}
function handleTapePointerMotion(e){
  if(ctx.toolMode!=='tape') return;
  if(ctx.tapeMeasureMode==='point' && e?.pointerType==='touch' && ctx.tapePointPinchNavigating){
    controls.enabled=true;
    return;
  }
  moveTapeCrosshairForEvent(e);
  getPointerNDC(tapePointAimEvent(e));
  if(Math.hypot(e.clientX-ctx.downClientX,e.clientY-ctx.downClientY)>11) ctx.tapePointerMoved=true;
  try { updateTapePreview(e); }
  catch(err){ console.error('Trena snap:',err); }
}
function finishTapeInteraction(ev,confirmTap=true){
  if(ctx.toolMode!=='tape') return;
  if(ctx.tapeMeasureMode==='point' && ev?.pointerType==='touch' &&
     (ctx.tapePointPinchNavigating || performance.now()<ctx.tapePointPinchSuppressUntil)){
    controls.enabled=true;
    ctx.tapePointerMoved=false;
    return;
  }
  if(Number.isFinite(ev?.clientX) && Number.isFinite(ev?.clientY)){
    moveTapeCrosshairForEvent(ev);
    try { updateTapePreview(ev); } catch(_) {}
  }
  // No modo ponto do celular, o dedo pode deslizar para posicionar a mira deslocada.
  // Ao soltar, confirma exatamente o ponto mostrado pela mira.
  const confirmPointTouch=confirmTap && ctx.tapeMeasureMode==='point' && ev?.pointerType==='touch';
  if(confirmTap && (!ctx.tapePointerMoved || confirmPointTouch)){
    try { handleTapeTap(ev); updateTapePreview(ev); }
    catch(err){ console.error('Trena confirmar:',err); toast('Erro Trena: '+(err?.message || String(err))); }
  }
  controls.enabled=true;
  ctx.tapePointerMoved=false;
}
function touchEventLike(touch){
  return {
    clientX:touch.clientX, clientY:touch.clientY,
    pointerType:'touch', pointerId:touch.identifier ?? 1,
    isPrimary:true, button:0
  };
}
function findTrackedTouch(list){
  if(!list || !list.length) return null;
  for(let i=0;i<list.length;i++) if(ctx.tapeTouchId===null || list[i].identifier===ctx.tapeTouchId) return list[i];
  // Fallback para WebViews que trocam o identifier durante o gesto.
  return list[0] || null;
}

// Android/WebView: Touch Events mantêm a mira fluida. No modo ponto, o dedo pode
// deslizar para posicionar a mira deslocada; ao soltar, confirma o alvo mostrado.
window.addEventListener('touchstart',e=>{
  if(ctx.toolMode!=='tape' || e.target!==renderer.domElement || !e.changedTouches?.length) return;
  // Assim que entra o 2º dedo, a Trena sai do gesto e entrega tudo à câmera.
  if(ctx.tapeMeasureMode==='point' && e.touches?.length>=2){
    ctx.tapePointPinchNavigating=true;
    ctx.tapePointPinchSuppressUntil=performance.now()+350;
    ctx.tapeTouchActive=false; ctx.tapeTouchId=null;
    controls.enabled=true;
    return;
  }
  const t=e.changedTouches[0];
  ctx.tapeTouchActive=true;
  ctx.tapeTouchId=t.identifier;
  ctx.tapeLastClientX=t.clientX; ctx.tapeLastClientY=t.clientY;
  const ev=touchEventLike(t);
  prepareTapeDown(ev);
  e.preventDefault();
},{capture:true,passive:false});

window.addEventListener('touchmove',e=>{
  if(ctx.toolMode!=='tape') return;
  if(ctx.tapeMeasureMode==='point' && (ctx.tapePointPinchNavigating || e.touches?.length>=2)){
    ctx.tapePointPinchNavigating=true;
    ctx.tapePointPinchSuppressUntil=performance.now()+350;
    controls.enabled=true;
    return;
  }
  if(!ctx.tapeTouchActive) return;
  const t=findTrackedTouch(e.touches) || findTrackedTouch(e.changedTouches);
  if(!t) return;
  ctx.tapeLastClientX=t.clientX; ctx.tapeLastClientY=t.clientY;
  handleTapePointerMotion(touchEventLike(t));
  e.preventDefault();
},{capture:true,passive:false});

function finishNativeTapeTouch(e){
  if(ctx.toolMode!=='tape') return;
  if(ctx.tapeMeasureMode==='point' && ctx.tapePointPinchNavigating){
    controls.enabled=true;
    ctx.tapeTouchActive=false; ctx.tapeTouchId=null;
    ctx.tapePointPinchSuppressUntil=performance.now()+350;
    if(!e.touches || e.touches.length===0)ctx.tapePointPinchNavigating=false;
    return;
  }
  if(!ctx.tapeTouchActive) return;
  const t=findTrackedTouch(e.changedTouches) || e.changedTouches?.[0] || null;
  const ev=t ? touchEventLike(t) : {
    clientX:ctx.tapeLastClientX,clientY:ctx.tapeLastClientY,pointerType:'touch',pointerId:ctx.tapeTouchId??1,isPrimary:true,button:0
  };
  finishTapeInteraction(ev);
  ctx.tapeTouchActive=false;
  ctx.tapeTouchId=null;
  controls.enabled=true;
  e.preventDefault();
}
window.addEventListener('touchend',finishNativeTapeTouch,{capture:true,passive:false});
window.addEventListener('touchcancel',finishNativeTapeTouch,{capture:true,passive:false});

// Mouse/caneta usam Pointer Events; toque não entra aqui.
window.addEventListener('pointermove',e=>{
  if(ctx.toolMode!=='tape') return;
  handleTapePointerMotion(e);
},{capture:true,passive:false});

window.addEventListener('pointerup',e=>{
  if(ctx.toolMode!=='tape') return;
  if(ctx.tapeMeasureMode==='point' && e.pointerType==='touch'){
    const wasPinch=ctx.tapePointPinchNavigating || performance.now()<ctx.tapePointPinchSuppressUntil;
    runtimeModel.tapePointTouchPointers.delete(e.pointerId);
    if(runtimeModel.tapePointTouchPointers.size===0 && ctx.tapePointPinchNavigating){
      ctx.tapePointPinchNavigating=false;
      ctx.tapePointPinchSuppressUntil=performance.now()+350;
    }
    if(wasPinch){controls.enabled=true;return;}
  }
  // Fallback para WebViews que entregam PointerEvent mas não TouchEvent.
  finishTapeInteraction(e,true);
  ctx.tapeMouseActive=false;
  ctx.activePointerId=null;
},{capture:true,passive:false});
window.addEventListener('pointercancel',e=>{
  if(ctx.toolMode!=='tape') return;
  if(ctx.tapeMeasureMode==='point' && e.pointerType==='touch'){
    const wasPinch=ctx.tapePointPinchNavigating || performance.now()<ctx.tapePointPinchSuppressUntil;
    runtimeModel.tapePointTouchPointers.delete(e.pointerId);
    if(runtimeModel.tapePointTouchPointers.size===0){
      ctx.tapePointPinchNavigating=false;
      ctx.tapePointPinchSuppressUntil=performance.now()+350;
    }
    if(wasPinch){controls.enabled=true;return;}
  }
  finishTapeInteraction(e,true);
  ctx.tapeMouseActive=false;
  ctx.activePointerId=null;
},{capture:true,passive:false});

renderer.domElement.addEventListener('pointermove',e=>{
  if(ctx.toolMode==='tape') return;
  if(ctx.activePointerId!==null && e.pointerId!==ctx.activePointerId) return;
  cancelPieceLongPressOnMove(e);
  cancelSpaceLongPressOnMove(e);
  getPointerNDC(e);

  if(!ctx.dragMode) return;
  if(ctx.dragMode!=='space-free' && !ctx.selected) return;
  if(e.pointerType==='touch' && !ctx.gestureLocked){
    const dist=Math.hypot(e.clientX-ctx.downClientX,e.clientY-ctx.downClientY);
    if(dist<REAIM_THRESHOLD_PX){ return; }
    ctx.gestureLocked=true;
  }
  if(ctx.dragMode==='space-free') moveSpaceFree();
  else if(ctx.dragMode==='free') moveFree(e);
  else if(ctx.dragMode.startsWith('pull-')) pullSelected(ctx.dragMode.slice(-1));
  else if(ctx.dragMode==='radius'){
    const p=ctx.selected.position.clone(); const t=closestParamOnAxis(p,runtimeModel.radiusDir); const d=clampSize(Math.abs(t)*2);
    ctx.selected.userData.width=d; ctx.selected.userData.depth=d; ctx.selected.scale.x=d; ctx.selected.scale.z=d; ctx.dragChanged=true;
  }
  updateMeasureBadge(); if(ctx.selected){updateInspector(); updateLiveLabel();}
});

function endDrag(e){
  if(e && ctx.activePointerId!==null && e.pointerId!==ctx.activePointerId) return;
  if(ctx.dragMode==='space-free' && ctx.movingSpaceRoot){
    const keepRootId=ctx.movingSpaceRoot.id, keepCellId=ctx.selectedSpaceCell?.cellId;
    if(ctx.movingSpaceRoot.group) ctx.movingSpaceRoot.group.position.set(0,0,0);
    renderSpaces();
    if(keepCellId && getSpaceCell(keepRootId,keepCellId)) selectSpaceCellByIds(keepRootId,keepCellId);
    ctx.movingSpaceRoot=null; ctx.movingSpaceRootStart=null; ctx.movingSpaceCellStarts=[]; ctx.movingSpaceObjectStarts=[];
  }
  if(ctx.selected) setAllFaces(ctx.selected,COLORS.selected);
  controls.enabled=true; ctx.activePointerId=null; ctx.dragMode=null; ctx.gestureLocked=false; runtimeModel.liveLabel.style.display='none'; moveGrip.visible=false; ctx.moveGrabIsCorner=false; ctx.moveGrabKind='face'; ctx.moveCornerTarget=null; ctx.moveSnapKind=null; ctx.moveSnapText=''; hideGuides();
  if(ctx.dragChanged && ctx.dragStartState!==stateString()) commitHistory();
  if(ctx.dragChanged) renderMachiningVisuals();
  ctx.dragChanged=false; ctx.dragStartState=null;
}

renderer.domElement.addEventListener('pointerup',e=>{
  if(ctx.toolMode==='tape') return;
  cancelPieceLongPress();
  cancelSpaceLongPress();
  endDrag(e);
});
renderer.domElement.addEventListener('pointercancel',e=>{
  if(ctx.toolMode==='tape') return;
  cancelPieceLongPress();
  cancelSpaceLongPress();
  endDrag(e);
});




  return {resetSpaceDoubleTap,updateLiveLabel,beginPick,moveFree,pullSelected,cancelSpaceLongPress,cancelPieceLongPress};
}
