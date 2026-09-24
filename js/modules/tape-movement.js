// DesignLabMoveis 1.310.00 · Trena, guias e inferência de movimento.
export function createTapeMovementModule(ctx){
  const { $, THREE, referenceMeshes, SNAP_THRESHOLD, CORNER_PICK_PX, EDGE_PICK_PX, GUIDE_SNAP_PX, TAPE_AIM_SNAP_PX, COLORS, scene, commitHistory, getPointerNDC, camera, worldToClient, mm, nice, toast, controls, syncToolDockButtons, renderer, TAPE_POINT_TOUCH_OFFSET_PX, axisVector, GUIDE_EXTENT, closestParamOnAxis, worldAxisX, worldAxisY, worldAxisZ, worldAxisForFace, groundPlane, TAPE_POINT_CORNER_SNAP_TOUCH_PX, TAPE_POINT_CORNER_SNAP_MOUSE_PX, TAPE_POINT_EDGE_SNAP_TOUCH_PX, TAPE_POINT_EDGE_SNAP_MOUSE_PX, TAPE_POINT_LINE_SNAP_TOUCH_PX, TAPE_POINT_LINE_SNAP_MOUSE_PX, TAPE_AXIS_ANGLE, MIN_SIZE, CORNER_SNAP_PX, EDGE_SNAP_PX, GUIDE_OBJECT_SNAP_WORLD}=ctx;
  const runtimeModel=ctx.runtimeModel;
function getBounds(mesh){
  mesh.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(mesh);
  const c=new THREE.Vector3(); b.getCenter(c);
  return { minX:b.min.x,maxX:b.max.x,centerX:c.x,minY:b.min.y,maxY:b.max.y,centerY:c.y,minZ:b.min.z,maxZ:b.max.z,centerZ:c.z };
}
function axisFeatures(bounds,axis){
  return axis==='x' ? [bounds.minX,bounds.centerX,bounds.maxX]
       : axis==='y' ? [bounds.minY,bounds.centerY,bounds.maxY]
       : [bounds.minZ,bounds.centerZ,bounds.maxZ];
}
function findMoveSnap(mesh,axis){
  const mine=getBounds(mesh), myF=axisFeatures(mine,axis);
  let best=null;
  for(const o of referenceMeshes(mesh)){
    const otherF=axisFeatures(getBounds(o),axis);
    for(const a of myF) for(const b of otherF){
      const delta=b-a;
      if(Math.abs(delta)<=SNAP_THRESHOLD && (!best || Math.abs(delta)<Math.abs(best.delta))) best={delta,line:b};
    }
  }
  return best;
}
function snapFaceCoordinate(mesh,axis,coord){
  let best=null;
  for(const o of referenceMeshes(mesh)){
    const f=axisFeatures(getBounds(o),axis);
    for(const val of f){
      const delta=val-coord;
      if(Math.abs(delta)<=SNAP_THRESHOLD && (!best || Math.abs(delta)<Math.abs(best.delta))) best={coord:val,delta,line:val};
    }
  }
  return best;
}

const guideMat=new THREE.LineBasicMaterial({color:COLORS.snap,depthTest:false,transparent:true,opacity:.95});
function guide(points, material=guideMat){ const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material); l.visible=false; l.renderOrder=99; scene.add(l); return l; }
const guideX=guide([new THREE.Vector3(0,.002,-15),new THREE.Vector3(0,.002,15)]);
const guideZ=guide([new THREE.Vector3(-15,.002,0),new THREE.Vector3(15,.002,0)]);
const guideY=guide([new THREE.Vector3(0,-10,0),new THREE.Vector3(0,20,0)]);
const axisMats={
  x:new THREE.LineBasicMaterial({color:0xff3b30,depthTest:false,transparent:true,opacity:.98}),
  y:new THREE.LineBasicMaterial({color:0x2979ff,depthTest:false,transparent:true,opacity:.98}),
  z:new THREE.LineBasicMaterial({color:0xffd23f,depthTest:false,transparent:true,opacity:.98})
};
const inferenceLines={
  x:guide([new THREE.Vector3(-20,0,0),new THREE.Vector3(20,0,0)],axisMats.x),
  y:guide([new THREE.Vector3(0,-20,0),new THREE.Vector3(0,20,0)],axisMats.y),
  z:guide([new THREE.Vector3(0,0,-20),new THREE.Vector3(0,0,20)],axisMats.z)
};
const moveGrip=new THREE.Mesh(new THREE.SphereGeometry(.012,12,12),new THREE.MeshBasicMaterial({color:COLORS.cyan,depthTest:false}));
moveGrip.visible=false; moveGrip.renderOrder=101; scene.add(moveGrip);
const cornerMarker=new THREE.Mesh(new THREE.SphereGeometry(.016,14,14),new THREE.MeshBasicMaterial({color:0x34d058,depthTest:false}));
cornerMarker.visible=false; cornerMarker.renderOrder=103; scene.add(cornerMarker);

// ---------- Trena estilo CAD / linhas de construção ----------
function makeDashedMaterial(color=0xe8e8e8,opacity=.9){
  return new THREE.LineDashedMaterial({
    color, dashSize:.03, gapSize:.018, transparent:true, opacity, depthTest:false, depthWrite:false
  });
}
const tapePreviewMaterial=makeDashedMaterial(0x00e5ff,.95);
const tapePreviewLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),new THREE.Vector3()
]),tapePreviewMaterial);
tapePreviewLine.visible=false;
tapePreviewLine.renderOrder=105;
scene.add(tapePreviewLine);

const tapePointMarker=new THREE.Mesh(
  new THREE.SphereGeometry(.012,12,12),
  new THREE.MeshBasicMaterial({color:0x00e5ff,depthTest:false})
);
tapePointMarker.visible=false;
tapePointMarker.renderOrder=106;
scene.add(tapePointMarker);

const tapePointFirstMarker=new THREE.Mesh(
  new THREE.SphereGeometry(.014,12,12),
  new THREE.MeshBasicMaterial({color:0x34d058,depthTest:false})
);
tapePointFirstMarker.visible=false;
tapePointFirstMarker.renderOrder=107;
scene.add(tapePointFirstMarker);

const tapeSourceEdgeLine=new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),
  new THREE.LineBasicMaterial({color:0xffd23f,depthTest:false,transparent:true,opacity:1})
);
tapeSourceEdgeLine.visible=false; tapeSourceEdgeLine.renderOrder=107; scene.add(tapeSourceEdgeLine);

const tapeOffsetLine=new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),
  makeDashedMaterial(0xffffff,.78)
);
tapeOffsetLine.visible=false; tapeOffsetLine.renderOrder=106; scene.add(tapeOffsetLine);

function setLinePoints(line,a,b){
  line.geometry.dispose();
  line.geometry=new THREE.BufferGeometry().setFromPoints([a,b]);
  line.computeLineDistances();
}

function guideAxisColor(axis){
  return axis==='x' ? 0xff3b30 : axis==='y' ? 0x2979ff : axis==='z' ? 0xffd23f : 0xdcdcdc;
}

function createConstructionGuide(start,end,{infinite=false,axis=null,kind='guide',offset=null,doHistory=true}={}){
  const a=start.clone(), b=end.clone();
  const mat=makeDashedMaterial(guideAxisColor(axis),.9);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),mat);
  line.computeLineDistances();
  line.renderOrder=84;
  line.userData={
    isConstructionGuide:true,
    infinite,
    axis,
    kind,
    offset,
    start:a.clone(),
    end:b.clone()
  };
  scene.add(line);
  runtimeModel.constructionGuides.push(line);
  if(doHistory) commitHistory();
  return line;
}


// 1.200.18 · Trena peça a peça.
// O fluxo antigo por pontos/guias foi substituído por: 1ª peça -> 2ª peça -> distância mínima entre as superfícies.
let tapePieceFirst=null;
let tapePieceSecond=null;
let tapePieceHover=null;
let tapeMeasurementCommitted=false;
// 1.200.91 · Depois da 2ª peça a Trena encerra automaticamente, mas a
// última medida fica "latched" na tela até a próxima interação do usuário.
let tapeMeasurementLatched=false;
// 1.300.17 · A Trena agora tem dois fluxos: peça↔peça e ponto↔ponto (estilo SketchUp).
let tapeMeasureMode='piece'; // piece | point
let tapePointFirst=null;
let tapePointSecond=null;
let tapePointFirstKind='';
let tapePointSecondKind='';

const tapeFirstPieceBox=new THREE.Box3Helper(new THREE.Box3(),0x00e5ff);
tapeFirstPieceBox.visible=false; tapeFirstPieceBox.renderOrder=108; tapeFirstPieceBox.material.depthTest=false; scene.add(tapeFirstPieceBox);
const tapeHoverPieceBox=new THREE.Box3Helper(new THREE.Box3(),0xffd23f);
tapeHoverPieceBox.visible=false; tapeHoverPieceBox.renderOrder=109; tapeHoverPieceBox.material.depthTest=false; scene.add(tapeHoverPieceBox);
const tapeSecondPieceBox=new THREE.Box3Helper(new THREE.Box3(),0x34d058);
tapeSecondPieceBox.visible=false; tapeSecondPieceBox.renderOrder=108; tapeSecondPieceBox.material.depthTest=false; scene.add(tapeSecondPieceBox);

function tapePieceName(mesh){
  return String(mesh?.userData?.name||'Peça');
}
function tapeSetBoxHelper(helper,mesh){
  if(!helper)return;
  if(!mesh){helper.visible=false;return;}
  mesh.updateMatrixWorld(true);
  helper.box.copy(new THREE.Box3().setFromObject(mesh));
  helper.visible=true;
}
function tapeMeasurablePieces(){
  return runtimeModel.objects.filter(o=>o&&o.visible!==false&&o.isObject3D&&!o.userData?.isConstructionGuide);
}
function getTapePieceAtEvent(event){
  if(!event||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return null;
  getPointerNDC(event);
  runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
  const hits=runtimeModel.raycaster.intersectObjects(tapeMeasurablePieces(),false);
  if(!hits.length)return null;
  const hit=hits[0];
  return {mesh:hit.object,point:hit.point.clone(),hit};
}
function tapeClosestIntervalPoints(aMin,aMax,bMin,bMax){
  if(aMax<bMin)return [aMax,bMin];
  if(bMax<aMin)return [aMin,bMax];
  const lo=Math.max(aMin,bMin),hi=Math.min(aMax,bMax),v=(lo+hi)/2;
  return [v,v];
}
function tapeDistanceBetweenPieces(a,b){
  if(!a||!b)return null;
  a.updateMatrixWorld(true); b.updateMatrixWorld(true);
  const ba=new THREE.Box3().setFromObject(a),bb=new THREE.Box3().setFromObject(b);
  const [ax,bx]=tapeClosestIntervalPoints(ba.min.x,ba.max.x,bb.min.x,bb.max.x);
  const [ay,by]=tapeClosestIntervalPoints(ba.min.y,ba.max.y,bb.min.y,bb.max.y);
  const [az,bz]=tapeClosestIntervalPoints(ba.min.z,ba.max.z,bb.min.z,bb.max.z);
  const p1=new THREE.Vector3(ax,ay,az),p2=new THREE.Vector3(bx,by,bz);
  const delta=p2.clone().sub(p1);
  return {p1,p2,delta,distance:p1.distanceTo(p2)};
}
function tapeShowPieceDistance(a,b,{committed=false}={}){
  const result=tapeDistanceBetweenPieces(a,b);
  if(!result)return null;
  setLinePoints(tapePreviewLine,result.p1,result.p2);
  tapePreviewLine.material.color.set(0x00e5ff);
  tapePreviewLine.visible=true;
  tapePointMarker.position.copy(result.p2);
  tapePointMarker.visible=true;
  const mid=result.p1.clone().lerp(result.p2,.5),sp=worldToClient(mid);
  const distMm=nice(mm(result.distance));
  runtimeModel.liveLabel.style.left=sp.x+'px'; runtimeModel.liveLabel.style.top=sp.y+'px';
  runtimeModel.liveLabel.textContent=`${distMm} mm · ${tapePieceName(a)} ↔ ${tapePieceName(b)}`;
  runtimeModel.liveLabel.style.display='block';
  if(committed){
    const dx=Math.abs(mm(result.delta.x)),dy=Math.abs(mm(result.delta.y)),dz=Math.abs(mm(result.delta.z));
    const parts=[]; if(dx>.001)parts.push(`X ${nice(dx)}`); if(dy>.001)parts.push(`Y ${nice(dy)}`); if(dz>.001)parts.push(`Z ${nice(dz)}`);
    const detail=parts.length>1?` · ${parts.join(' · ')} mm`:'';
    toast(`Distância: ${distMm} mm${detail}`);
  }
  return result;
}
function tapeUpdatePiecePrompt(){
  if(ctx.toolMode!=='tape')return;
  if(tapeMeasureMode==='point'){
    $('hintText').textContent=tapePointFirst
      ? 'Trena · Medir ponto · toque na 2ª quina/aresta/ponto'
      : 'Trena · Medir ponto · toque na 1ª quina/aresta/ponto';
    return;
  }
  if(tapeMeasurementCommitted){
    $('hintText').textContent=`Trena · ${tapePieceName(tapePieceFirst)} ↔ ${tapePieceName(tapePieceSecond)} · toque em outra peça para medir novamente`;
  }else if(tapePieceFirst){
    $('hintText').textContent=`Trena · 1ª peça: ${tapePieceName(tapePieceFirst)} · toque na 2ª peça`;
  }else{
    $('hintText').textContent='Trena · Medir peça · toque na 1ª peça';
  }
}
function resetTapeMeasure(){
  tapeMeasurementLatched=false;
  ctx.tapeStart=null;
  ctx.tapeStartClient=null;
  ctx.tapeHover=null;
  ctx.tapeEdgeSource=null;
  ctx.tapePendingEdge=null;
  ctx.tapeDragEdgeActive=false;
  tapePieceFirst=null;
  tapePieceSecond=null;
  tapePieceHover=null;
  tapePointFirst=null;
  tapePointSecond=null;
  tapePointFirstKind='';
  tapePointSecondKind='';
  tapeMeasurementCommitted=false;
  tapePreviewLine.visible=false;
  tapeSourceEdgeLine.visible=false;
  tapeOffsetLine.visible=false;
  tapePointMarker.visible=false;
  tapePointFirstMarker.visible=false;
  tapeFirstPieceBox.visible=false;
  tapeSecondPieceBox.visible=false;
  tapeHoverPieceBox.visible=false;
  runtimeModel.liveLabel.style.display='none';
  tapeUpdatePiecePrompt();
}

function hideTapeCrosshair(){
  runtimeModel.tapeCrosshair.style.display='none';
  runtimeModel.tapeSnapDot.style.display='none';
  ctx.tapeAim=null;
}

function clearLatchedTapeMeasurement(){
  if(!tapeMeasurementLatched)return;
  tapeMeasurementLatched=false;
  tapeMeasurementCommitted=false;
  tapePieceFirst=null;
  tapePieceSecond=null;
  tapePieceHover=null;
  tapePointFirst=null;
  tapePointSecond=null;
  tapePointFirstKind='';
  tapePointSecondKind='';
  tapePreviewLine.visible=false;
  tapeSourceEdgeLine.visible=false;
  tapeOffsetLine.visible=false;
  tapePointMarker.visible=false;
  tapePointFirstMarker.visible=false;
  tapeFirstPieceBox.visible=false;
  tapeSecondPieceBox.visible=false;
  tapeHoverPieceBox.visible=false;
  runtimeModel.liveLabel.style.display='none';
}

function restoreCadNavigationAfterTape(){
  // 1.300.25 · A Trena por ponto desliga o gesto de 1 dedo enquanto está ativa
  // (ONE=-1) para que o dedo mova só a mira. Como a medição concluída sai da
  // Trena sem chamar setTool('select') — para manter a medida na tela — precisamos
  // restaurar explicitamente a navegação padrão do CAD aqui.
  if(controls?.touches){
    controls.touches.ONE=THREE.TOUCH.ROTATE;
    controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  }
  controls.enabled=true;
  ctx.tapeTouchActive=false;
  ctx.tapeTouchId=null;
  ctx.tapeMouseActive=false;
  runtimeModel.tapePointTouchPointers.clear();
  ctx.tapePointPinchNavigating=false;
  ctx.tapePointPinchSuppressUntil=0;
}

function closeTapeAfterCommittedMeasurement(){
  // Não chama setTool('select'), porque setTool limparia a linha e o texto
  // imediatamente. Aqui só desarma a ferramenta; a medida fica visível até
  // o próximo clique/toque em qualquer outro lugar.
  tapeMeasurementLatched=true;
  tapeMeasurementCommitted=false;
  tapePieceHover=null;
  tapeFirstPieceBox.visible=false;
  tapeSecondPieceBox.visible=false;
  tapeHoverPieceBox.visible=false;
  tapePointMarker.visible=false;
  tapePointFirstMarker.visible=false;
  hideTapeCrosshair();
  ctx.toolMode='select';
  restoreCadNavigationAfterTape();
  $('hintText').textContent='Selecionar · toque exatamente onde o dedo encostar';
  if(typeof syncToolDockButtons==='function')syncToolDockButtons();
}

// A medida concluída permanece na tela, mas qualquer interação seguinte
// (na área 3D ou em um botão da interface) a remove antes de continuar.
const clearTapeLatchedOnNextInteraction=()=>{
  if(tapeMeasurementLatched&&ctx.toolMode!=='tape')clearLatchedTapeMeasurement();
};
document.addEventListener('pointerdown',clearTapeLatchedOnNextInteraction,true);
document.addEventListener('touchstart',clearTapeLatchedOnNextInteraction,{capture:true,passive:true});

function tapePointAimEvent(event){
  if(!event || tapeMeasureMode!=='point' || event.pointerType!=='touch') return event;
  const rect=renderer.domElement.getBoundingClientRect();
  const rawX=Number(event.clientX), rawY=Number(event.clientY);
  if(!Number.isFinite(rawX)||!Number.isFinite(rawY)) return event;
  // A mira fica acima do dedo. Perto do topo ela inverte para baixo para não sair da tela.
  let y=rawY-TAPE_POINT_TOUCH_OFFSET_PX;
  if(y<rect.top+38) y=rawY+TAPE_POINT_TOUCH_OFFSET_PX;
  y=THREE.MathUtils.clamp(y,rect.top+18,rect.bottom-18);
  const x=THREE.MathUtils.clamp(rawX,rect.left+10,rect.right-10);
  return {
    clientX:x,clientY:y,pointerType:'touch',pointerId:event.pointerId??1,
    isPrimary:event.isPrimary!==false,button:0,
    __tapeRawClientX:rawX,__tapeRawClientY:rawY,__tapeTouchOffset:true
  };
}
function tapePointAimClient(event){
  const e=tapePointAimEvent(event);
  return new THREE.Vector2(Number(e?.clientX)||0,Number(e?.clientY)||0);
}

function setTapeCrosshair(client,aim,snapClient=null){
  // A mira principal acompanha SEMPRE o dedo/mouse.
  runtimeModel.tapeCrosshair.style.left=client.x+'px';
  runtimeModel.tapeCrosshair.style.top=client.y+'px';
  runtimeModel.tapeCrosshair.style.display='block';
  runtimeModel.tapeCrosshair.className='';
  const kind=aim?.snapKind || 'free';
  if(kind==='axis') runtimeModel.tapeCrosshair.classList.add('snap-axis');
  else if(kind==='edge') runtimeModel.tapeCrosshair.classList.add('snap-edge');
  else if(kind==='corner') runtimeModel.tapeCrosshair.classList.add('snap-corner');
  else if(kind==='guide') runtimeModel.tapeCrosshair.classList.add('snap-guide');
  const axis=aim?.snapAxis ? ` ${aim.snapAxis.toUpperCase()}` : '';
  runtimeModel.tapeCrosshairLabel.textContent = kind==='axis' ? `Eixo${axis}`
    : kind==='edge' ? `Aresta${axis}`
    : kind==='corner' ? 'Quina'
    : kind==='guide' ? `Guia${axis}`
    : aim?.face ? `Face ${aim.face.axis.toUpperCase()}` : 'Trena';

  // O ponto menor mostra onde o snap REAL foi encontrado.
  if(snapClient && kind!=='free'){
    runtimeModel.tapeSnapDot.style.left=snapClient.x+'px';
    runtimeModel.tapeSnapDot.style.top=snapClient.y+'px';
    runtimeModel.tapeSnapDot.style.display='block';
    runtimeModel.tapeSnapDot.className='';
    if(kind==='axis') runtimeModel.tapeSnapDot.classList.add('snap-axis');
    else if(kind==='edge') runtimeModel.tapeSnapDot.classList.add('snap-edge');
    else if(kind==='corner') runtimeModel.tapeSnapDot.classList.add('snap-corner');
    else if(kind==='guide') runtimeModel.tapeSnapDot.classList.add('snap-guide');
  }else{
    runtimeModel.tapeSnapDot.style.display='none';
    runtimeModel.tapeSnapDot.className='';
  }
}


function nearestAnyCornerToClient(client,maxPx=22){
  let best=null;
  runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
  for(const mesh of referenceMeshes()){
    if(mesh.userData.kind==='cylinder') continue;
    for(const point of getBoxCorners(mesh)){
      const sp=worldToClient(point);
      const dist=sp.distanceTo(client);
      if(dist>maxPx)continue;
      const rayDist=runtimeModel.raycaster.ray.distanceToPoint(point);
      const cameraDist=camera.position.distanceTo(point);
      if(!best || dist<best.dist-.35 ||
        (Math.abs(dist-best.dist)<=.35 && (rayDist<best.rayDist-1e-5 ||
          (Math.abs(rayDist-best.rayDist)<=1e-5 && cameraDist<best.cameraDist)))){
        best={point:point.clone(),dist,rayDist,cameraDist,mesh};
      }
    }
  }
  return best;
}

function getBoxEdges(mesh){
  if(!mesh || mesh.userData.kind==='cylinder') return [];
  const b=getBounds(mesh);
  const xs=[b.minX,b.maxX], ys=[b.minY,b.maxY], zs=[b.minZ,b.maxZ];
  const edges=[];
  for(const y of ys) for(const z of zs) edges.push({axis:'x',a:new THREE.Vector3(b.minX,y,z),b:new THREE.Vector3(b.maxX,y,z)});
  for(const x of xs) for(const z of zs) edges.push({axis:'y',a:new THREE.Vector3(x,b.minY,z),b:new THREE.Vector3(x,b.maxY,z)});
  for(const x of xs) for(const y of ys) edges.push({axis:'z',a:new THREE.Vector3(x,y,b.minZ),b:new THREE.Vector3(x,y,b.maxZ)});
  return edges;
}

function refineTapeEdgeScreenPick(edgePick,client){
  if(!edgePick?.a||!edgePick?.b||!client)return edgePick;
  // Em perspectiva, interpolar o t em 2D e reaplicar o mesmo t em 3D não é exato.
  // Refinamos apenas a melhor aresta encontrada para o ponto amarelo cair no ponto real da aresta.
  const score=t=>{
    const p=edgePick.a.clone().lerp(edgePick.b,t);
    const sp=worldToClient(p);
    return {t,p,dist:sp.distanceTo(client)};
  };
  let lo=Math.max(0,(Number(edgePick.t)||0)-.22), hi=Math.min(1,(Number(edgePick.t)||0)+.22);
  for(let i=0;i<9;i++){
    const t1=lo+(hi-lo)/3, t2=hi-(hi-lo)/3;
    if(score(t1).dist<=score(t2).dist) hi=t2; else lo=t1;
  }
  const best=score((lo+hi)/2);
  runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
  return {...edgePick,t:best.t,point:best.p,dist:best.dist,rayDist:runtimeModel.raycaster.ray.distanceToPoint(best.p)};
}

function nearestAnyEdgeToClient(client,maxPx=EDGE_PICK_PX,excludeMesh=null){
  let best=null;
  for(const mesh of referenceMeshes(excludeMesh)){
    if(mesh.userData.kind==='cylinder') continue;
    for(const edge of getBoxEdges(mesh)){
      const sa=worldToClient(edge.a), sb=worldToClient(edge.b);
      const ab=sb.clone().sub(sa), len2=ab.lengthSq();
      if(len2<1e-8) continue;
      const t=THREE.MathUtils.clamp(client.clone().sub(sa).dot(ab)/len2,0,1);
      const screenPoint=sa.clone().addScaledVector(ab,t);
      const dist=client.distanceTo(screenPoint);
      if(dist>maxPx) continue;
      const point=edge.a.clone().lerp(edge.b,t);
      runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
      const rayDist=runtimeModel.raycaster.ray.distanceToPoint(point);
      if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)){
        best={...edge,mesh,point,dist,rayDist,t};
      }
    }
  }
  return best ? refineTapeEdgeScreenPick(best,client) : null;
}

function nearestEdgeOnMeshToClient(mesh,client,maxPx=EDGE_PICK_PX){
  if(!mesh || mesh.userData.kind==='cylinder') return null;
  let best=null;
  for(const edge of getBoxEdges(mesh)){
    const sa=worldToClient(edge.a), sb=worldToClient(edge.b);
    const ab=sb.clone().sub(sa), len2=ab.lengthSq();
    if(len2<1e-8) continue;
    const t=THREE.MathUtils.clamp(client.clone().sub(sa).dot(ab)/len2,0,1);
    const screenPoint=sa.clone().addScaledVector(ab,t);
    const dist=client.distanceTo(screenPoint);
    if(dist>maxPx) continue;
    const point=edge.a.clone().lerp(edge.b,t);
    runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
    const rayDist=runtimeModel.raycaster.ray.distanceToPoint(point);
    if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)) best={...edge,mesh,point,dist,rayDist,t};
  }
  return best;
}

function nearestGuideToClient(client,maxPx=GUIDE_SNAP_PX){
  let best=null;
  for(const line of runtimeModel.constructionGuides){
    const a=line.userData.start, b=line.userData.end;
    if(!a || !b) continue;
    const sa=worldToClient(a), sb=worldToClient(b);
    const ab=sb.clone().sub(sa), len2=ab.lengthSq();
    if(len2<1e-8) continue;
    const t=THREE.MathUtils.clamp(client.clone().sub(sa).dot(ab)/len2,0,1);
    const screenPoint=sa.clone().addScaledVector(ab,t);
    const dist=client.distanceTo(screenPoint);
    if(dist>maxPx) continue;
    const point=a.clone().lerp(b,t);
    runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
    const rayDist=runtimeModel.raycaster.ray.distanceToPoint(point);
    if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)){
      best={line,point,dist,rayDist,axis:line.userData.axis||null};
    }
  }
  return best;
}

function closestPointOnInfiniteLine(point,linePoint,lineDir){
  const d=lineDir.clone().normalize();
  return linePoint.clone().addScaledVector(d,point.clone().sub(linePoint).dot(d));
}

function nearestGlobalAxisHit(client,maxPx=TAPE_AIM_SNAP_PX){
  // Reconhecimento 100% em espaço de tela: usamos dois pontos BEM afastados
  // do eixo visível. Isso evita erros de direção/projeção em WebView mobile.
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  let best=null;
  const origin=new THREE.Vector3(0,0,0);
  for(const axis of ['x','y','z']){
    const dir=axisVector(axis);
    const wa=origin.clone().addScaledVector(dir,-GUIDE_EXTENT);
    const wb=origin.clone().addScaledVector(dir, GUIDE_EXTENT);
    const sa=worldToClient(wa), sb=worldToClient(wb);
    const ab=sb.clone().sub(sa);
    const len2=ab.lengthSq();
    if(!Number.isFinite(len2) || len2<4) continue;

    // Distância até a reta 2D infinita do eixo que o usuário realmente vê.
    const screenT=client.clone().sub(sa).dot(ab)/len2;
    const screenPoint=sa.clone().addScaledVector(ab,screenT);
    const dist=client.distanceTo(screenPoint);
    if(!Number.isFinite(dist) || dist>maxPx) continue;

    // O ponto 3D exato é o ponto do eixo mais próximo do raio do toque.
    let worldT=closestParamOnAxis(origin,dir);
    if(!Number.isFinite(worldT)) worldT=0;
    worldT=THREE.MathUtils.clamp(worldT,-GUIDE_EXTENT,GUIDE_EXTENT);
    const point=origin.clone().addScaledVector(dir,worldT);
    if(!best || dist<best.dist) best={axis,point,screenPoint,dist};
  }
  return best;
}
function nearestReferenceLineByRay(event){
  // Reconhecimento direto na geometria visível. Em Android isso é mais robusto
  // que depender apenas da projeção 3D -> tela para eixos compridos.
  getPointerNDC(event);
  runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
  const oldThreshold=runtimeModel.raycaster.params.Line.threshold;
  const camScale=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)/5, .7, 2.2);
  runtimeModel.raycaster.params.Line.threshold=.14*camScale;
  const refs=[worldAxisX,worldAxisY,worldAxisZ,...runtimeModel.constructionGuides];
  const hits=runtimeModel.raycaster.intersectObjects(refs,false);
  runtimeModel.raycaster.params.Line.threshold=oldThreshold;
  if(!hits.length) return null;
  const hit=hits[0], line=hit.object;
  const axis=line.userData.tapeAxis || line.userData.axis || null;
  let point=null;
  if(line.userData.tapeAxis){
    const dir=axisVector(axis);
    let t=closestParamOnAxis(new THREE.Vector3(0,0,0),dir);
    if(!Number.isFinite(t)) t=0;
    point=dir.clone().multiplyScalar(THREE.MathUtils.clamp(t,-GUIDE_EXTENT,GUIDE_EXTENT));
  }else if(line.userData.isConstructionGuide && line.userData.start && line.userData.end){
    const a=line.userData.start, b=line.userData.end;
    const d=b.clone().sub(a); const len=d.length();
    if(len<1e-9) return null;
    d.divideScalar(len);
    let t=closestParamOnAxis(a,d);
    if(!line.userData.infinite) t=THREE.MathUtils.clamp(t,0,len);
    point=a.clone().addScaledVector(d,t);
  }
  if(!point) return null;
  const screenPoint=worldToClient(point);
  const client=new THREE.Vector2(Number(event?.clientX)||0,Number(event?.clientY)||0);
  const screenDist=screenPoint.distanceTo(client);
  return {
    snapKind: line.userData.tapeAxis ? 'axis' : 'guide',
    snapAxis: axis,
    point,
    line,
    screenPoint,
    guide: line.userData.isConstructionGuide ? {line,point,axis,dist:screenDist} : null,
    dist:screenDist
  };
}

function resolveTapeAim(event){
  // No modo ponto em touch, o alvo real fica deslocado do dedo para a quina continuar visível.
  const aimEvent=tapePointAimEvent(event);
  getPointerNDC(aimEvent);
  const client=new THREE.Vector2(aimEvent.clientX,aimEvent.clientY);
  runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);
  const hits=runtimeModel.raycaster.intersectObjects(referenceMeshes(),false);
  const hit=hits[0] || null;
  let rawPoint=null, face=null;
  if(hit){
    rawPoint=hit.point.clone();
    face=worldAxisForFace(hit,hit.object);
  }else{
    rawPoint=new THREE.Vector3();
    if(!runtimeModel.raycaster.ray.intersectPlane(groundPlane,rawPoint)) rawPoint.set(0,0,0);
  }

  const pointMode=tapeMeasureMode==='point';
  const touchPoint=pointMode && aimEvent?.pointerType==='touch';
  const cornerLimit=pointMode ? (touchPoint?TAPE_POINT_CORNER_SNAP_TOUCH_PX:TAPE_POINT_CORNER_SNAP_MOUSE_PX) : TAPE_AIM_SNAP_PX;
  const edgeLimit=pointMode ? (touchPoint?TAPE_POINT_EDGE_SNAP_TOUCH_PX:TAPE_POINT_EDGE_SNAP_MOUSE_PX) : TAPE_AIM_SNAP_PX;
  const lineLimit=pointMode ? (touchPoint?TAPE_POINT_LINE_SNAP_TOUCH_PX:TAPE_POINT_LINE_SNAP_MOUSE_PX) : TAPE_AIM_SNAP_PX;

  const candidates=[];
  const directLine=nearestReferenceLineByRay(aimEvent);
  if(directLine && (!pointMode || Number(directLine.dist||0)<=lineLimit)) candidates.push(directLine);
  const corner=nearestAnyCornerToClient(client,cornerLimit);
  if(corner) candidates.push({snapKind:'corner',point:corner.point.clone(),corner,dist:corner.dist});
  const edge=nearestAnyEdgeToClient(client,edgeLimit);
  if(edge) candidates.push({snapKind:'edge',point:edge.point.clone(),edge,snapAxis:edge.axis,dist:edge.dist});
  const guide=nearestGuideToClient(client,lineLimit);
  if(guide) candidates.push({snapKind:'guide',point:guide.point.clone(),guide,snapAxis:guide.axis,dist:guide.dist});
  const axisHit=nearestGlobalAxisHit(client,lineLimit);
  if(axisHit) candidates.push({snapKind:'axis',point:axisHit.point.clone(),axisHit,snapAxis:axisHit.axis,dist:axisHit.dist});

  // No modo ponto, quina tem "ímã" próprio: se entrou no raio curto, ela vence a aresta.
  // Isso evita o dedo parar alguns milímetros antes/depois da quina.
  let snap=null;
  if(pointMode && corner){
    snap=candidates.find(c=>c.snapKind==='corner')||null;
  }else{
    const direct=!pointMode ? candidates.find(c=>c===directLine && directLine) : null;
    const priority={corner:0,edge:1,guide:2,axis:3};
    candidates.sort((a,b)=>(a.dist-b.dist) || (priority[a.snapKind]-priority[b.snapKind]));
    snap=direct || candidates[0] || null;
  }
  const aim={
    point:snap ? snap.point.clone() : rawPoint,
    hit,face,corner:snap?.corner||null,edge:snap?.edge||null,guide:snap?.guide||null,
    axisHit:snap?.axisHit||null,snapKind:snap?.snapKind||'free',snapAxis:snap?.snapAxis||null,
    dist:snap?.dist ?? Infinity,
    touchOffset:!!aimEvent?.__tapeTouchOffset
  };
  ctx.tapeAim=aim;
  const snapScreen=snap ? (snap.axisHit?.screenPoint?.clone?.() || worldToClient(aim.point)) : null;
  setTapeCrosshair(client,aim,snapScreen);
  return aim;
}

function getTapePick(event){
  return resolveTapeAim(event);
}

function distancePointToSegment2D(p,a,b){
  const ab=b.clone().sub(a);
  const len2=ab.lengthSq();
  if(len2<1e-9) return p.distanceTo(a);
  const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/len2,0,1);
  return p.distanceTo(a.clone().addScaledVector(ab,t));
}

function nearestGlobalAxisAtClient(client,maxPx=34){
  return nearestGlobalAxisHit(client,maxPx)?.axis || null;
}

function inferTapeAxis(start,event){
  const motion=new THREE.Vector2(
    event.clientX-(ctx.tapeStartClient?.x ?? event.clientX),
    event.clientY-(ctx.tapeStartClient?.y ?? event.clientY)
  );
  if(motion.length()<8) return null;
  motion.normalize();
  const base=worldToClient(start);
  let best=null;
  for(const [axis,dir] of Object.entries({
    x:new THREE.Vector3(1,0,0),
    y:new THREE.Vector3(0,1,0),
    z:new THREE.Vector3(0,0,1)
  })){
    const sv=worldToClient(start.clone().add(dir)).sub(base);
    if(sv.length()<10) continue;
    sv.normalize();
    const angle=Math.acos(THREE.MathUtils.clamp(Math.abs(motion.dot(sv)),-1,1));
    if(angle<=TAPE_AXIS_ANGLE && (!best || angle<best.angle)) best={axis,angle};
  }
  return best?.axis || null;
}

function projectPointToAxis(start,target,axis){
  if(!axis) return target.clone();
  const dir=axisVector(axis);
  const amount=target.clone().sub(start).dot(dir);
  return start.clone().addScaledVector(dir,amount);
}

function activateTapeEdgeSource(pick,clientX,clientY){
  if(!pick?.edge) return false;
  ctx.tapeEdgeSource={mesh:pick.edge.mesh,axis:pick.edge.axis,a:pick.edge.a.clone(),b:pick.edge.b.clone()};
  ctx.tapeStart=pick.edge.point.clone();
  ctx.tapeStartClient={x:clientX,y:clientY};
  tapePointMarker.position.copy(ctx.tapeStart); tapePointMarker.visible=true;
  setLinePoints(tapeSourceEdgeLine,ctx.tapeEdgeSource.a,ctx.tapeEdgeSource.b);
  tapeSourceEdgeLine.visible=true;
  return true;
}

function parallelGuideGeometryFromPick(pick){
  if(!ctx.tapeEdgeSource || !ctx.tapeStart || !pick) return null;
  const dir=ctx.tapeEdgeSource.b.clone().sub(ctx.tapeEdgeSource.a).normalize();
  const nearestOnSource=closestPointOnInfiniteLine(pick.point,ctx.tapeEdgeSource.a,dir);
  const offsetVec=pick.point.clone().sub(nearestOnSource);
  const offset=offsetVec.length();
  const targetAnchor=ctx.tapeStart.clone().add(offsetVec);
  return {
    dir,offset,targetAnchor,
    start:targetAnchor.clone().addScaledVector(dir,-GUIDE_EXTENT),
    end:targetAnchor.clone().addScaledVector(dir, GUIDE_EXTENT)
  };
}

function commitTapeParallelAtEvent(event){
  const pick=getTapePick(event);
  const g=parallelGuideGeometryFromPick(pick);
  if(!g || g.offset<MIN_SIZE){ resetTapeMeasure(); return false; }
  createConstructionGuide(g.start,g.end,{infinite:true,axis:ctx.tapeEdgeSource.axis,kind:'parallel',offset:g.offset});
  toast(`Guia paralela · ${mm(g.offset)} mm da aresta`);
  resetTapeMeasure();
  return true;
}

function tapePointKindLabel(pick){
  const k=pick?.snapKind||'free';
  if(k==='corner')return 'Quina';
  if(k==='edge')return 'Aresta';
  if(k==='guide')return 'Guia';
  if(k==='axis')return `Eixo${pick?.snapAxis?` ${String(pick.snapAxis).toUpperCase()}`:''}`;
  if(pick?.hit)return 'Ponto na face';
  return 'Ponto';
}
function tapePointPickIsValid(pick){
  // Ponto livre no chão sem acertar geometria é fácil de tocar por engano.
  // Quina/aresta/guia/eixo ou qualquer ponto real de uma face são válidos.
  return !!pick && (pick.snapKind!=='free' || !!pick.hit);
}
function tapeShowPointDistance(a,b,{committed=false}={}){
  if(!a||!b)return null;
  const delta=b.clone().sub(a), distance=a.distanceTo(b);
  setLinePoints(tapePreviewLine,a,b);
  tapePreviewLine.material.color.set(0x00e5ff);
  tapePreviewLine.visible=true;
  tapePointFirstMarker.position.copy(a); tapePointFirstMarker.visible=true;
  tapePointMarker.position.copy(b); tapePointMarker.visible=true;
  const mid=a.clone().lerp(b,.5),sp=worldToClient(mid),distMm=nice(mm(distance));
  runtimeModel.liveLabel.style.left=sp.x+'px'; runtimeModel.liveLabel.style.top=sp.y+'px';
  runtimeModel.liveLabel.textContent=`${distMm} mm`;
  runtimeModel.liveLabel.style.display='block';
  if(committed){
    const dx=Math.abs(mm(delta.x)),dy=Math.abs(mm(delta.y)),dz=Math.abs(mm(delta.z));
    const parts=[]; if(dx>.001)parts.push(`X ${nice(dx)}`); if(dy>.001)parts.push(`Y ${nice(dy)}`); if(dz>.001)parts.push(`Z ${nice(dz)}`);
    toast(`Ponto a ponto: ${distMm} mm${parts.length?` · ${parts.join(' · ')} mm`:''}`);
  }
  return {delta,distance};
}
function updateTapePointPreview(event){
  const client=new THREE.Vector2(event.clientX,event.clientY);
  const pick=getTapePick(event); // resolveTapeAim também atualiza mira/snap visual
  tapeFirstPieceBox.visible=false; tapeSecondPieceBox.visible=false; tapeHoverPieceBox.visible=false;
  if(tapeMeasurementCommitted)return;
  if(!tapePointFirst){
    tapePreviewLine.visible=false;
    tapePointMarker.visible=false;
    tapePointFirstMarker.visible=false;
    runtimeModel.liveLabel.style.display='none';
    runtimeModel.tapeCrosshairLabel.textContent=tapePointKindLabel(pick);
    return;
  }
  tapePointFirstMarker.position.copy(tapePointFirst); tapePointFirstMarker.visible=true;
  if(tapePointPickIsValid(pick)){
    tapeShowPointDistance(tapePointFirst,pick.point,{committed:false});
    runtimeModel.tapeCrosshairLabel.textContent=`2º · ${tapePointKindLabel(pick)}`;
  }else{
    tapePreviewLine.visible=false;
    tapePointMarker.visible=false;
    runtimeModel.liveLabel.style.display='none';
    runtimeModel.tapeCrosshairLabel.textContent='2º ponto';
  }
}
function handleTapePointTap(event){
  const pick=getTapePick(event);
  if(!tapePointPickIsValid(pick)){
    toast(tapePointFirst?'Trena: toque na 2ª quina/aresta/face':'Trena: toque na 1ª quina/aresta/face');
    return false;
  }
  if(tapeMeasurementCommitted)resetTapeMeasure();
  if(!tapePointFirst){
    tapePointFirst=pick.point.clone();
    tapePointFirstKind=tapePointKindLabel(pick);
    tapePointSecond=null; tapePointSecondKind='';
    tapePointFirstMarker.position.copy(tapePointFirst); tapePointFirstMarker.visible=true;
    tapePointMarker.visible=false; tapePreviewLine.visible=false; runtimeModel.liveLabel.style.display='none';
    tapeUpdatePiecePrompt();
    toast(`1º ponto: ${tapePointFirstKind} · agora toque no 2º ponto`);
    return true;
  }
  if(tapePointFirst.distanceTo(pick.point)<1e-6){
    toast('Trena: escolha um 2º ponto diferente');
    return false;
  }
  tapePointSecond=pick.point.clone(); tapePointSecondKind=tapePointKindLabel(pick);
  tapeMeasurementCommitted=true;
  tapeShowPointDistance(tapePointFirst,tapePointSecond,{committed:true});
  ctx.tapeLastConfirmedTap={time:0,x:-9999,y:-9999,key:''};
  closeTapeAfterCommittedMeasurement();
  return true;
}

function updateTapePreview(event){
  if(ctx.toolMode!=='tape')return;
  if(tapeMeasureMode==='point')return updateTapePointPreview(event);
  const client=new THREE.Vector2(event.clientX,event.clientY);
  const pick=getTapePieceAtEvent(event);
  tapePieceHover=pick?.mesh||null;

  // Na nova Trena a mira identifica peças, não pontos/arestas/guias.
  runtimeModel.tapeCrosshair.style.left=client.x+'px';
  runtimeModel.tapeCrosshair.style.top=client.y+'px';
  runtimeModel.tapeCrosshair.style.display='block';
  runtimeModel.tapeCrosshair.className=pick?'snap-edge':'';
  runtimeModel.tapeSnapDot.style.display='none';
  runtimeModel.tapeCrosshairLabel.textContent=pick ? tapePieceName(pick.mesh) : (tapePieceFirst?'2ª peça':'1ª peça');

  tapeSetBoxHelper(tapeHoverPieceBox,pick?.mesh&&pick.mesh!==tapePieceFirst&&pick.mesh!==tapePieceSecond?pick.mesh:null);

  if(tapeMeasurementCommitted){
    // O resultado fica visível até o próximo toque ou até sair da Trena.
    tapeSetBoxHelper(tapeFirstPieceBox,tapePieceFirst);
    tapeSetBoxHelper(tapeSecondPieceBox,tapePieceSecond);
    return;
  }

  if(!tapePieceFirst){
    tapePreviewLine.visible=false;
    tapePointMarker.visible=false;
    runtimeModel.liveLabel.style.display='none';
    tapeFirstPieceBox.visible=false;
    tapeSecondPieceBox.visible=false;
    return;
  }

  tapeSetBoxHelper(tapeFirstPieceBox,tapePieceFirst);
  tapeSecondPieceBox.visible=false;
  if(pick?.mesh&&pick.mesh!==tapePieceFirst){
    tapeShowPieceDistance(tapePieceFirst,pick.mesh,{committed:false});
  }else{
    tapePreviewLine.visible=false;
    tapePointMarker.visible=false;
    runtimeModel.liveLabel.style.display='none';
  }
}

function createInfiniteAxisGuide(point,axis){
  const dir=axisVector(axis);
  const start=point.clone().addScaledVector(dir,-GUIDE_EXTENT);
  const end=point.clone().addScaledVector(dir,GUIDE_EXTENT);
  createConstructionGuide(start,end,{infinite:true,axis});
  resetTapeMeasure();
  toast(`Guia infinita no eixo ${axis.toUpperCase()}`);
}

function tapePickKey(pick){
  if(!pick) return 'none';
  if(pick.snapKind==='axis') return `axis:${pick.snapAxis||''}`;
  if(pick.snapKind==='guide') return `guide:${pick.snapAxis||''}:${runtimeModel.constructionGuides.indexOf(pick.guide?.line)}`;
  if(pick.snapKind==='edge' && pick.edge){
    const a=pick.edge.a, b=pick.edge.b;
    return `edge:${pick.edge.axis}:${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}:${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)}`;
  }
  if(pick.snapKind==='corner') return `corner:${pick.point.x.toFixed(3)},${pick.point.y.toFixed(3)},${pick.point.z.toFixed(3)}`;
  return `free:${pick.face?.axis||'ground'}`;
}

function handleTapeTap(event){
  if(ctx.toolMode!=='tape')return false;
  if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return false;

  const now=performance.now();
  const gateDist=Math.hypot(event.clientX-ctx.tapeConfirmGate.x,event.clientY-ctx.tapeConfirmGate.y);
  if((now-ctx.tapeConfirmGate.time)<110&&gateDist<14)return false;
  ctx.tapeConfirmGate={time:now,x:event.clientX,y:event.clientY};

  if(tapeMeasureMode==='point')return handleTapePointTap(event);

  const pick=getTapePieceAtEvent(event);
  if(!pick?.mesh){
    toast(tapePieceFirst?'Trena: toque na 2ª peça':'Trena: toque diretamente na 1ª peça');
    return false;
  }
  const mesh=pick.mesh;

  // Depois de mostrar um resultado, qualquer novo toque inicia uma nova medição
  // usando a peça tocada como a primeira peça.
  if(tapeMeasurementCommitted){
    resetTapeMeasure();
  }

  if(!tapePieceFirst){
    tapePieceFirst=mesh;
    tapePieceSecond=null;
    tapeMeasurementCommitted=false;
    tapeSetBoxHelper(tapeFirstPieceBox,mesh);
    tapeHoverPieceBox.visible=false;
    tapePreviewLine.visible=false;
    runtimeModel.liveLabel.style.display='none';
    tapeUpdatePiecePrompt();
    toast(`1ª peça: ${tapePieceName(mesh)} · agora toque na 2ª peça`);
    return true;
  }

  if(mesh===tapePieceFirst){
    toast('Trena: escolha uma 2ª peça diferente');
    return false;
  }

  tapePieceSecond=mesh;
  tapeMeasurementCommitted=true;
  tapeSetBoxHelper(tapeFirstPieceBox,tapePieceFirst);
  tapeSetBoxHelper(tapeSecondPieceBox,tapePieceSecond);
  tapeHoverPieceBox.visible=false;
  tapeShowPieceDistance(tapePieceFirst,tapePieceSecond,{committed:true});
  ctx.tapeLastConfirmedTap={time:0,x:-9999,y:-9999,key:''};
  closeTapeAfterCommittedMeasurement();
  return true;
}

function getBoxCorners(mesh){
  if(!mesh || mesh.userData.kind==='cylinder') return [];
  const b=getBounds(mesh), pts=[];
  for(const x of [b.minX,b.maxX]) for(const y of [b.minY,b.maxY]) for(const z of [b.minZ,b.maxZ]) pts.push(new THREE.Vector3(x,y,z));
  return pts;
}
function getFaceCorners(mesh,face){
  const pts=getBoxCorners(mesh);
  if(!pts.length || !face) return pts;
  const b=getBounds(mesh);
  const target=face.axis==='x' ? (face.sign>0?b.maxX:b.minX)
             : face.axis==='y' ? (face.sign>0?b.maxY:b.minY)
             : (face.sign>0?b.maxZ:b.minZ);
  return pts.filter(p=>Math.abs(p[face.axis]-target)<1e-6);
}
function nearestCornerToClient(mesh,face,client,maxPx=CORNER_PICK_PX){
  let best=null;
  for(const point of getFaceCorners(mesh,face)){
    const sp=worldToClient(point), dist=sp.distanceTo(client);
    if(dist<=maxPx && (!best || dist<best.dist)) best={point,dist};
  }
  return best;
}
function findTargetCornerSnap(moving,event){
  const aim2=new THREE.Vector2(event.clientX,event.clientY);
  let best=null;
  for(const other of referenceMeshes(moving)){
    if(other.userData.kind==='cylinder') continue;
    for(const point of getBoxCorners(other)){
      const sp=worldToClient(point), dist=sp.distanceTo(aim2);
      if(dist>CORNER_SNAP_PX) continue;
      // Em projeções com cantos sobrepostos, favorece o vértice mais perto do raio da mira.
      const rayDist=runtimeModel.raycaster.ray.distanceToPoint(point);
      if(!best || dist<best.dist-0.5 || (Math.abs(dist-best.dist)<=0.5 && rayDist<best.rayDist)) best={point,dist,rayDist};
    }
  }
  return best;
}
function findMoveInferenceTarget(moving,event){
  const client=new THREE.Vector2(event.clientX,event.clientY);
  runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,camera);

  const corner=findTargetCornerSnap(moving,event);
  if(corner) return {kind:'corner',point:corner.point.clone(),label:'Quina'};

  const g=nearestGuideToClient(client,GUIDE_SNAP_PX);
  if(g) return {kind:'guide',point:g.point.clone(),label:'Guia',axis:g.axis,line:g.line};

  const edge=nearestAnyEdgeToClient(client,EDGE_SNAP_PX,moving);
  if(edge) return {kind:'edge',point:edge.point.clone(),label:'Aresta',axis:edge.axis,mesh:edge.mesh};

  // Face visível sob o dedo. Só entra depois de quina/guia/aresta para não roubar inferências mais precisas.
  const hits=runtimeModel.raycaster.intersectObjects(referenceMeshes(moving),false);
  if(hits.length){
    const hit=hits[0];
    return {kind:'face',point:hit.point.clone(),label:'Face',mesh:hit.object,face:worldAxisForFace(hit,hit.object)};
  }
  return null;
}

function snapMovingObjectFeaturesToGuide(moving,line){
  const axis=line?.userData?.axis;
  const ref=line?.userData?.start;
  if(!axis || !ref) return false;
  const b=getBounds(moving);
  let changed=false;
  for(const ax of ['x','y','z']){
    if(ax===axis) continue; // a linha varia neste eixo; os outros dois definem sua posição.
    const values=axisFeatures(b,ax);
    let bestVal=values[0], bestDelta=ref[ax]-values[0];
    for(const v of values.slice(1)){
      const d=ref[ax]-v;
      if(Math.abs(d)<Math.abs(bestDelta)){ bestVal=v; bestDelta=d; }
    }
    if(Math.abs(bestDelta)<=GUIDE_OBJECT_SNAP_WORLD){
      moving.position[ax]+=bestDelta;
      changed=true;
      // Atualiza os bounds antes do próximo eixo porque a peça já se moveu.
      Object.assign(b,getBounds(moving));
    }
  }
  return changed;
}

function setMoveTargetMarker(target){
  if(!target){
    ctx.moveSnapKind=null; ctx.moveSnapText='';
    if(!ctx.moveGrabIsCorner) cornerMarker.visible=false;
    return;
  }
  ctx.moveSnapKind=target.kind;
  ctx.moveSnapText=target.label;
  cornerMarker.position.copy(target.point); cornerMarker.visible=true;
  const color=target.kind==='corner' ? 0x34d058
             : target.kind==='guide' ? COLORS.snap
             : target.kind==='edge' ? 0xffd23f
             : COLORS.cyan;
  cornerMarker.material.color.set(color);
  moveGrip.material.color.set(color);
}

function showGuide(axis,line){
  if(axis==='x'){ guideX.visible=true; guideX.position.x=line; }
  if(axis==='z'){ guideZ.visible=true; guideZ.position.z=line; }
  if(axis==='y' && ctx.selected){ guideY.visible=true; guideY.position.set(ctx.selected.position.x,0,ctx.selected.position.z); }
}
function hideInference(){ Object.values(inferenceLines).forEach(l=>l.visible=false); ctx.moveInferenceAxis=null; }
function showInference(axis){
  Object.entries(inferenceLines).forEach(([k,l])=>l.visible=(k===axis));
  if(!axis) return;
  inferenceLines[axis].position.copy(runtimeModel.movePickPoint);
}
function hideGuides(){ guideX.visible=guideZ.visible=guideY.visible=false; hideInference(); cornerMarker.visible=false; ctx.moveCornerTarget=null; ctx.moveSnapKind=null; ctx.moveSnapText=''; }


  const state={get tapeMeasureMode(){return tapeMeasureMode;},set tapeMeasureMode(v){tapeMeasureMode=v==='point'?'point':'piece';}};
  return {state,getBounds,axisFeatures,findMoveSnap,snapFaceCoordinate,guide,makeDashedMaterial,setLinePoints,guideAxisColor,createConstructionGuide,tapePieceName,tapeSetBoxHelper,tapeMeasurablePieces,getTapePieceAtEvent,tapeClosestIntervalPoints,tapeDistanceBetweenPieces,tapeShowPieceDistance,tapeUpdatePiecePrompt,resetTapeMeasure,hideTapeCrosshair,clearLatchedTapeMeasurement,restoreCadNavigationAfterTape,closeTapeAfterCommittedMeasurement,tapePointAimEvent,tapePointAimClient,setTapeCrosshair,nearestAnyCornerToClient,getBoxEdges,refineTapeEdgeScreenPick,nearestAnyEdgeToClient,nearestEdgeOnMeshToClient,nearestGuideToClient,closestPointOnInfiniteLine,nearestGlobalAxisHit,nearestReferenceLineByRay,resolveTapeAim,getTapePick,distancePointToSegment2D,nearestGlobalAxisAtClient,inferTapeAxis,projectPointToAxis,activateTapeEdgeSource,parallelGuideGeometryFromPick,commitTapeParallelAtEvent,tapePointKindLabel,tapePointPickIsValid,tapeShowPointDistance,updateTapePointPreview,handleTapePointTap,updateTapePreview,createInfiniteAxisGuide,tapePickKey,handleTapeTap,getBoxCorners,getFaceCorners,nearestCornerToClient,findTargetCornerSnap,findMoveInferenceTarget,snapMovingObjectFeaturesToGuide,setMoveTargetMarker,showGuide,hideInference,showInference,hideGuides,guideX,guideY,guideZ,inferenceLines,moveGrip,cornerMarker};
}
