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
  constructionGuides.push(line);
  if(doHistory) commitHistory();
  return line;
}


// 1.200.18 · Trena peça a peça.
// O fluxo antigo por pontos/guias foi substituído por: 1ª peça -> 2ª peça -> distância mínima entre as superfícies.
let tapePieceFirst=null;
let tapePieceSecond=null;
let tapePieceHover=null;
let tapeMeasurementCommitted=false;

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
  return objects.filter(o=>o&&o.visible!==false&&o.isObject3D&&!o.userData?.isConstructionGuide);
}
function getTapePieceAtEvent(event){
  if(!event||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return null;
  getPointerNDC(event);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(tapeMeasurablePieces(),false);
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
  liveLabel.style.left=sp.x+'px'; liveLabel.style.top=sp.y+'px';
  liveLabel.textContent=`${distMm} mm · ${tapePieceName(a)} ↔ ${tapePieceName(b)}`;
  liveLabel.style.display='block';
  if(committed){
    const dx=Math.abs(mm(result.delta.x)),dy=Math.abs(mm(result.delta.y)),dz=Math.abs(mm(result.delta.z));
    const parts=[]; if(dx>.001)parts.push(`X ${nice(dx)}`); if(dy>.001)parts.push(`Y ${nice(dy)}`); if(dz>.001)parts.push(`Z ${nice(dz)}`);
    const detail=parts.length>1?` · ${parts.join(' · ')} mm`:'';
    toast(`Distância: ${distMm} mm${detail}`);
  }
  return result;
}
function tapeUpdatePiecePrompt(){
  if(toolMode!=='tape')return;
  if(tapeMeasurementCommitted){
    $('hintText').textContent=`Trena · ${tapePieceName(tapePieceFirst)} ↔ ${tapePieceName(tapePieceSecond)} · toque em outra peça para medir novamente`;
  }else if(tapePieceFirst){
    $('hintText').textContent=`Trena · 1ª peça: ${tapePieceName(tapePieceFirst)} · toque na 2ª peça`;
  }else{
    $('hintText').textContent='Trena · toque na 1ª peça';
  }
}
function resetTapeMeasure(){
  tapeStart=null;
  tapeStartClient=null;
  tapeHover=null;
  tapeEdgeSource=null;
  tapePendingEdge=null;
  tapeDragEdgeActive=false;
  tapePieceFirst=null;
  tapePieceSecond=null;
  tapePieceHover=null;
  tapeMeasurementCommitted=false;
  tapePreviewLine.visible=false;
  tapeSourceEdgeLine.visible=false;
  tapeOffsetLine.visible=false;
  tapePointMarker.visible=false;
  tapeFirstPieceBox.visible=false;
  tapeSecondPieceBox.visible=false;
  tapeHoverPieceBox.visible=false;
  liveLabel.style.display='none';
  tapeUpdatePiecePrompt();
}

function hideTapeCrosshair(){
  tapeCrosshair.style.display='none';
  tapeSnapDot.style.display='none';
  tapeAim=null;
}

function setTapeCrosshair(client,aim,snapClient=null){
  // A mira principal acompanha SEMPRE o dedo/mouse.
  tapeCrosshair.style.left=client.x+'px';
  tapeCrosshair.style.top=client.y+'px';
  tapeCrosshair.style.display='block';
  tapeCrosshair.className='';
  const kind=aim?.snapKind || 'free';
  if(kind==='axis') tapeCrosshair.classList.add('snap-axis');
  else if(kind==='edge') tapeCrosshair.classList.add('snap-edge');
  else if(kind==='corner') tapeCrosshair.classList.add('snap-corner');
  else if(kind==='guide') tapeCrosshair.classList.add('snap-guide');
  const axis=aim?.snapAxis ? ` ${aim.snapAxis.toUpperCase()}` : '';
  tapeCrosshairLabel.textContent = kind==='axis' ? `Eixo${axis}`
    : kind==='edge' ? `Aresta${axis}`
    : kind==='corner' ? 'Quina'
    : kind==='guide' ? `Guia${axis}`
    : aim?.face ? `Face ${aim.face.axis.toUpperCase()}` : 'Trena';

  // O ponto menor mostra onde o snap REAL foi encontrado.
  if(snapClient && kind!=='free'){
    tapeSnapDot.style.left=snapClient.x+'px';
    tapeSnapDot.style.top=snapClient.y+'px';
    tapeSnapDot.style.display='block';
    tapeSnapDot.className='';
    if(kind==='axis') tapeSnapDot.classList.add('snap-axis');
    else if(kind==='edge') tapeSnapDot.classList.add('snap-edge');
    else if(kind==='corner') tapeSnapDot.classList.add('snap-corner');
    else if(kind==='guide') tapeSnapDot.classList.add('snap-guide');
  }else{
    tapeSnapDot.style.display='none';
    tapeSnapDot.className='';
  }
}


function nearestAnyCornerToClient(client,maxPx=22){
  let best=null;
  for(const mesh of referenceMeshes()){
    if(mesh.userData.kind==='cylinder') continue;
    for(const point of getBoxCorners(mesh)){
      const sp=worldToClient(point);
      const dist=sp.distanceTo(client);
      if(dist<=maxPx && (!best || dist<best.dist)) best={point:point.clone(),dist,mesh};
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
      raycaster.setFromCamera(pointer,camera);
      const rayDist=raycaster.ray.distanceToPoint(point);
      if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)){
        best={...edge,mesh,point,dist,rayDist,t};
      }
    }
  }
  return best;
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
    raycaster.setFromCamera(pointer,camera);
    const rayDist=raycaster.ray.distanceToPoint(point);
    if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)) best={...edge,mesh,point,dist,rayDist,t};
  }
  return best;
}

function nearestGuideToClient(client,maxPx=GUIDE_SNAP_PX){
  let best=null;
  for(const line of constructionGuides){
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
    raycaster.setFromCamera(pointer,camera);
    const rayDist=raycaster.ray.distanceToPoint(point);
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
  raycaster.setFromCamera(pointer,camera);
  const oldThreshold=raycaster.params.Line.threshold;
  const camScale=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)/5, .7, 2.2);
  raycaster.params.Line.threshold=.14*camScale;
  const refs=[worldAxisX,worldAxisY,worldAxisZ,...constructionGuides];
  const hits=raycaster.intersectObjects(refs,false);
  raycaster.params.Line.threshold=oldThreshold;
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
  return {
    snapKind: line.userData.tapeAxis ? 'axis' : 'guide',
    snapAxis: axis,
    point,
    line,
    guide: line.userData.isConstructionGuide ? {line,point,axis,dist:0} : null,
    dist:0
  };
}

function resolveTapeAim(event){
  // Sempre atualiza o raycast com a coordenada do evento atual. Assim nenhum
  // touchmove/touchend usa a posição antiga do ponteiro.
  getPointerNDC(event);
  const client=new THREE.Vector2(event.clientX,event.clientY);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(referenceMeshes(),false);
  const hit=hits[0] || null;
  let rawPoint=null, face=null;
  if(hit){
    rawPoint=hit.point.clone();
    face=worldAxisForFace(hit,hit.object);
  }else{
    rawPoint=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(groundPlane,rawPoint)) rawPoint.set(0,0,0);
  }

  // A mira da Trena procura o elemento visualmente mais próximo do dedo.
  // Isso inclui o eixo azul vertical, que não depende mais da interseção com o chão.
  const candidates=[];
  // Primeiro tenta acertar diretamente as linhas realmente desenhadas no WebGL.
  const directLine=nearestReferenceLineByRay(event);
  if(directLine) candidates.push(directLine);
  const corner=nearestAnyCornerToClient(client,TAPE_AIM_SNAP_PX);
  if(corner) candidates.push({snapKind:'corner',point:corner.point.clone(),corner,dist:corner.dist});
  const edge=nearestAnyEdgeToClient(client,TAPE_AIM_SNAP_PX);
  if(edge) candidates.push({snapKind:'edge',point:edge.point.clone(),edge,snapAxis:edge.axis,dist:edge.dist});
  const guide=nearestGuideToClient(client,TAPE_AIM_SNAP_PX);
  if(guide) candidates.push({snapKind:'guide',point:guide.point.clone(),guide,snapAxis:guide.axis,dist:guide.dist});
  const axisHit=nearestGlobalAxisHit(client,TAPE_AIM_SNAP_PX);
  if(axisHit) candidates.push({snapKind:'axis',point:axisHit.point.clone(),axisHit,snapAxis:axisHit.axis,dist:axisHit.dist});

  // Se o raycast bateu numa linha real, ela ganha. Nos demais casos vale a
  // distância visual: quina > aresta > guia > eixo.
  const direct=candidates.find(c=>c===directLine && directLine);
  const priority={corner:0,edge:1,guide:2,axis:3};
  candidates.sort((a,b)=>(a.dist-b.dist) || (priority[a.snapKind]-priority[b.snapKind]));
  const snap=direct || candidates[0] || null;
  const aim={
    point:snap ? snap.point.clone() : rawPoint,
    hit,face,corner:snap?.corner||null,edge:snap?.edge||null,guide:snap?.guide||null,
    axisHit:snap?.axisHit||null,snapKind:snap?.snapKind||'free',snapAxis:snap?.snapAxis||null,
    dist:snap?.dist ?? Infinity
  };
  tapeAim=aim;
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
    event.clientX-(tapeStartClient?.x ?? event.clientX),
    event.clientY-(tapeStartClient?.y ?? event.clientY)
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
  tapeEdgeSource={mesh:pick.edge.mesh,axis:pick.edge.axis,a:pick.edge.a.clone(),b:pick.edge.b.clone()};
  tapeStart=pick.edge.point.clone();
  tapeStartClient={x:clientX,y:clientY};
  tapePointMarker.position.copy(tapeStart); tapePointMarker.visible=true;
  setLinePoints(tapeSourceEdgeLine,tapeEdgeSource.a,tapeEdgeSource.b);
  tapeSourceEdgeLine.visible=true;
  return true;
}

function parallelGuideGeometryFromPick(pick){
  if(!tapeEdgeSource || !tapeStart || !pick) return null;
  const dir=tapeEdgeSource.b.clone().sub(tapeEdgeSource.a).normalize();
  const nearestOnSource=closestPointOnInfiniteLine(pick.point,tapeEdgeSource.a,dir);
  const offsetVec=pick.point.clone().sub(nearestOnSource);
  const offset=offsetVec.length();
  const targetAnchor=tapeStart.clone().add(offsetVec);
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
  createConstructionGuide(g.start,g.end,{infinite:true,axis:tapeEdgeSource.axis,kind:'parallel',offset:g.offset});
  toast(`Guia paralela · ${mm(g.offset)} mm da aresta`);
  resetTapeMeasure();
  return true;
}

function updateTapePreview(event){
  if(toolMode!=='tape')return;
  const client=new THREE.Vector2(event.clientX,event.clientY);
  const pick=getTapePieceAtEvent(event);
  tapePieceHover=pick?.mesh||null;

  // Na nova Trena a mira identifica peças, não pontos/arestas/guias.
  tapeCrosshair.style.left=client.x+'px';
  tapeCrosshair.style.top=client.y+'px';
  tapeCrosshair.style.display='block';
  tapeCrosshair.className=pick?'snap-edge':'';
  tapeSnapDot.style.display='none';
  tapeCrosshairLabel.textContent=pick ? tapePieceName(pick.mesh) : (tapePieceFirst?'2ª peça':'1ª peça');

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
    liveLabel.style.display='none';
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
    liveLabel.style.display='none';
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
  if(pick.snapKind==='guide') return `guide:${pick.snapAxis||''}:${constructionGuides.indexOf(pick.guide?.line)}`;
  if(pick.snapKind==='edge' && pick.edge){
    const a=pick.edge.a, b=pick.edge.b;
    return `edge:${pick.edge.axis}:${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}:${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)}`;
  }
  if(pick.snapKind==='corner') return `corner:${pick.point.x.toFixed(3)},${pick.point.y.toFixed(3)},${pick.point.z.toFixed(3)}`;
  return `free:${pick.face?.axis||'ground'}`;
}

function handleTapeTap(event){
  if(toolMode!=='tape')return false;
  if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return false;

  const now=performance.now();
  const gateDist=Math.hypot(event.clientX-tapeConfirmGate.x,event.clientY-tapeConfirmGate.y);
  if((now-tapeConfirmGate.time)<110&&gateDist<14)return false;
  tapeConfirmGate={time:now,x:event.clientX,y:event.clientY};

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
    liveLabel.style.display='none';
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
  tapeUpdatePiecePrompt();
  tapeLastConfirmedTap={time:0,x:-9999,y:-9999,key:''};
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
      const rayDist=raycaster.ray.distanceToPoint(point);
      if(!best || dist<best.dist-0.5 || (Math.abs(dist-best.dist)<=0.5 && rayDist<best.rayDist)) best={point,dist,rayDist};
    }
  }
  return best;
}
function findMoveInferenceTarget(moving,event){
  const client=new THREE.Vector2(event.clientX,event.clientY);
  raycaster.setFromCamera(pointer,camera);

  const corner=findTargetCornerSnap(moving,event);
  if(corner) return {kind:'corner',point:corner.point.clone(),label:'Quina'};

  const g=nearestGuideToClient(client,GUIDE_SNAP_PX);
  if(g) return {kind:'guide',point:g.point.clone(),label:'Guia',axis:g.axis,line:g.line};

  const edge=nearestAnyEdgeToClient(client,EDGE_SNAP_PX,moving);
  if(edge) return {kind:'edge',point:edge.point.clone(),label:'Aresta',axis:edge.axis,mesh:edge.mesh};

  // Face visível sob o dedo. Só entra depois de quina/guia/aresta para não roubar inferências mais precisas.
  const hits=raycaster.intersectObjects(referenceMeshes(moving),false);
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
    moveSnapKind=null; moveSnapText='';
    if(!moveGrabIsCorner) cornerMarker.visible=false;
    return;
  }
  moveSnapKind=target.kind;
  moveSnapText=target.label;
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
  if(axis==='y' && selected){ guideY.visible=true; guideY.position.set(selected.position.x,0,selected.position.z); }
}
function hideInference(){ Object.values(inferenceLines).forEach(l=>l.visible=false); moveInferenceAxis=null; }
function showInference(axis){
  Object.entries(inferenceLines).forEach(([k,l])=>l.visible=(k===axis));
  if(!axis) return;
  inferenceLines[axis].position.copy(movePickPoint);
}
function hideGuides(){ guideX.visible=guideZ.visible=guideY.visible=false; hideInference(); cornerMarker.visible=false; moveCornerTarget=null; moveSnapKind=null; moveSnapText=''; }

function captureObjects(){
  return objects.map(o=>({
    kind:o.userData.kind,name:o.userData.name,materialType:o.userData.materialType,baseColor:o.userData.baseColor,
    materialId:o.userData.materialId||null,materialCode:o.userData.materialCode||'',materialGrain:!!o.userData.materialGrain,materialGrainRotation:normalizePieceGrainRotation(o.userData.materialGrainRotation),materialCoreColor:o.userData.materialCoreColor||null,
    edgeBands:productionClone(o.userData.edgeBands||{}),partId:o.userData.partId||null,labelMeta:productionClone(o.userData.labelMeta||{schemaVersion:1,enabled:true}),
    spaceRootId:o.userData.spaceRootId||null,
    machining:JSON.parse(JSON.stringify(o.userData.machining||[])),forms:JSON.parse(JSON.stringify(o.userData.forms||[])),customProfile:o.userData.customProfile?JSON.parse(JSON.stringify(o.userData.customProfile)):null,curvedRole:o.userData.curvedRole||null,curvedPart:o.userData.curvedPart||o.userData.customProfile?.part||null,curvedConfig:o.userData.curvedConfig?JSON.parse(JSON.stringify(o.userData.curvedConfig)):null,drawerSetId:o.userData.drawerSetId||null,drawerRole:o.userData.drawerRole||null,drawerIndex:o.userData.drawerIndex??null,drawerConfig:o.userData.drawerConfig?JSON.parse(JSON.stringify(o.userData.drawerConfig)):null,doorConfig:o.userData.doorConfig?JSON.parse(JSON.stringify(o.userData.doorConfig)):null,excludeFromCutList:!!o.userData.excludeFromCutList,spaceCutting:!!o.userData.spaceCutting,spaceCutParentBounds:o.userData.spaceCutParentBounds?JSON.parse(JSON.stringify(o.userData.spaceCutParentBounds)):null,
    divisionNominalThicknessM:Number(o.userData.divisionNominalThicknessM)||null,
    rotationX:Number(o.rotation.x)||0,rotationY:Number(o.rotation.y)||0,rotationZ:Number(o.rotation.z)||0,
    width:o.userData.width,depth:o.userData.depth,height:o.userData.height,
    x:Number.isFinite(o.userData.curvedTargetX)?o.userData.curvedTargetX:o.position.x,yBase:o.position.y-o.userData.height/2,z:Number.isFinite(o.userData.curvedTargetZ)?o.userData.curvedTargetZ:o.position.z
  }));
}
function captureGuides(){
  return constructionGuides.map(line=>({
    infinite:!!line.userData.infinite,
    axis:line.userData.axis || null,
    kind:line.userData.kind || 'guide',
    offset:Number.isFinite(line.userData.offset) ? line.userData.offset : null,
    start:line.userData.start.toArray(),
    end:line.userData.end.toArray()
  }));
}
function captureSpaces(){ return spaceRoots.map(r=>({id:r.id,name:r.name,width:r.width,depth:r.depth,height:r.height,x:r.x,yBase:r.yBase,z:r.z,defaultMaterialId:r.defaultMaterialId||null,doorsHidden:!!r.doorsHidden,spaceHidden:false,fixedBands:{x:(r.fixedBands?.x||[]).map(v=>[...v]),y:(r.fixedBands?.y||[]).map(v=>[...v]),z:(r.fixedBands?.z||[]).map(v=>[...v])},cells:r.cells.map(c=>({id:c.id,hidden:!!c.hidden,fixedAxes:{...(c.fixedAxes||{})},minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ}))})); }
function captureState(){ return { version:'1.200.18', objects:captureObjects(), guides:captureGuides(), spaces:captureSpaces(), production:captureProductionState() }; }
function stateString(){ return JSON.stringify(captureState()); }
function commitHistory(){
  if(historyMuted) return;
  const s=stateString();
  if(historyIndex>=0 && history[historyIndex]===s) return;
  history=history.slice(0,historyIndex+1); history.push(s); historyIndex=history.length-1;
  if(history.length>80){ history.shift(); historyIndex--; }
  localStorage.setItem(STORAGE_KEY,s);
  if(typeof markCurrentProjectDirty==='function')markCurrentProjectDirty();
}
function clearConstructionGuides(){
  for(const line of [...constructionGuides]){
    scene.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  constructionGuides.length=0;
  resetTapeMeasure();
}
function clearScene(){
  clearMachiningVisuals();
  // Novo projeto/limpeza recebe catálogos iniciais; applyState restaura os salvos logo depois.
  projectProduction=defaultProjectProduction();
  for(const o of [...objects])disposeObject(o);
  objects.length=0;
  disposeSpaceMeshes(); spaceRoots.length=0; clearSpaceSelection();
  clearConstructionGuides();
  selectObject(null);
}
function normalizeStateToGround(state){
  if(!state || Array.isArray(state) || !Array.isArray(state.spaces)) return state;
  const fixed=JSON.parse(JSON.stringify(state));
  const shifts=new Map();
  for(const sp of fixed.spaces||[]){
    const y=Number(sp.yBase)||0;
    if(y>=0) continue;
    const dy=-y; shifts.set(sp.id,dy); sp.yBase=0;
    for(const c of sp.cells||[]){ c.minY=Number(c.minY)+dy; c.maxY=Number(c.maxY)+dy; }
  }
  for(const o of fixed.objects||[]){
    const dy=shifts.get(o.spaceRootId);
    if(dy) o.yBase=(Number(o.yBase)||0)+dy;
  }
  return fixed;
}
function applyState(state){
  state=normalizeStateToGround(state);
  historyMuted=true; clearScene();
  setProjectProductionState(Array.isArray(state)?null:state?.production);
  const objectState=Array.isArray(state) ? state : (state?.objects || []);
  const guideState=Array.isArray(state) ? [] : (state?.guides || []);
  const spaceState=Array.isArray(state) ? [] : (state?.spaces || []);
  for(const item of objectState){
    if(item.kind==='cylinder') createCylinder({diameter:item.width,height:item.height,x:item.x,yBase:item.yBase,z:item.z,name:item.name},false);
    else if(item.kind==='curved-panel'&&item.customProfile?.cfg) createCurvedRib({cfg:item.customProfile.cfg,yBase:item.yBase,x:item.x,z:item.z,name:item.name,spaceRootId:item.spaceRootId,part:item.customProfile.part||item.curvedPart||'full'},false);
    else if(item.curvedRole==='cover'&&item.curvedConfig) createCurvedCover({cfg:item.curvedConfig,yBase:item.yBase,x:item.x,z:item.z,name:item.name||'Capa externa',spaceRootId:item.spaceRootId,part:item.curvedPart||item.curvedConfig.coverPart||'full'},false);
    else if(item.curvedRole==='post'&&item.curvedConfig) createCurvedPost({cfg:item.curvedConfig,yBase:item.yBase,x:item.x,z:item.z,name:item.name||'Montante curvo',spaceRootId:item.spaceRootId,rotationY:item.rotationY||0},false);
    else createBox({...item,rotationX:item.rotationX||0,rotationY:item.rotationY||0,rotationZ:item.rotationZ||0},false);
  }
  for(const g of guideState){
    if(!Array.isArray(g.start) || !Array.isArray(g.end)) continue;
    createConstructionGuide(new THREE.Vector3().fromArray(g.start),new THREE.Vector3().fromArray(g.end),{
      infinite:!!g.infinite,axis:g.axis||null,kind:g.kind||'guide',offset:Number.isFinite(g.offset)?g.offset:null,doHistory:false
    });
  }
  for(const sp of spaceState) createSpaceFromState(sp);

  // 1.100.34: projetos antigos podiam ter a Divisão vertical afinada/engrossada
  // ao redimensionar o móvel. Recupera a espessura nominal pelo material.
  for(const root of spaceRoots)repairVerticalDivisionThickness(root);

  // v99: projetos antigos podem já ter sido salvos depois de apagar uma
  // prateleira, deixando uma faixa de 18 mm sem peça e sem célula.
  // Repara essas faixas automaticamente ao abrir o projeto.
  for(let pass=0;pass<6;pass++){
    let changed=0;
    for(const root of spaceRoots)changed+=repairOrphanSpaceGaps(root).changes;
    if(!changed)break;
  }

  // 1.100.3: limpa duplicatas históricas de gavetas no mesmo vão.
  // Mantém o primeiro set encontrado e remove os demais.
  {
    const byTarget=new Map();
    for(const o of objects){
      const u=o.userData;
      if(!u?.drawerSetId||!u.drawerConfig)continue;
      const cfg=u.drawerConfig;
      const key=`${cfg.targetRootId}::${cfg.targetCellId}`;
      if(!byTarget.has(key))byTarget.set(key,new Set());
      byTarget.get(key).add(u.drawerSetId);
    }
    for(const ids of byTarget.values()){
      const arr=[...ids];
      if(arr.length<=1)continue;
      for(const duplicateId of arr.slice(1))removeDrawerSet(duplicateId,{commit:false,keepSelection:true});
    }
  }

  // 1.100.5: recupera rasgos de fundo que versões anteriores possam ter
  // removido durante a conferência das furações de corrediça.
  {
    const ids=new Set(objects.filter(o=>o.userData?.drawerSetId&&o.userData?.drawerConfig?.machineBottom).map(o=>o.userData.drawerSetId));
    for(const id of ids)drawerEnsureBottomGroovesForSet(id);
  }

  renderSpaces(); applyAllDoorVisibility(); renderMachiningVisuals();
  applyCadDetailVisibility({persist:false,notify:false});
  selectObject(objects.filter(o=>o.visible!==false).at(-1)||null); if(!objects.some(o=>o.visible!==false)) clearSpaceSelection();
  historyMuted=false;
}
function undo(){ if(historyIndex<=0){toast('Nada para desfazer');return;} historyIndex--; applyState(JSON.parse(history[historyIndex])); localStorage.setItem(STORAGE_KEY,history[historyIndex]); markCurrentProjectDirty(); }
function redo(){ if(historyIndex>=history.length-1){toast('Nada para refazer');return;} historyIndex++; applyState(JSON.parse(history[historyIndex])); localStorage.setItem(STORAGE_KEY,history[historyIndex]); markCurrentProjectDirty(); }



// ============================================================================
// 1.100.32 · AJUSTES RELATIVOS / POR FACE
// ============================================================================
const PIECE_RELATIVE_INPUT_IDS=[
  'pieceMoveX','pieceMoveY','pieceMoveZ',
  'pieceFaceLeft','pieceFaceRight',
  'pieceFaceBack','pieceFaceFront',
  'pieceFaceBottom','pieceFaceTop',
  'pieceRotX','pieceRotY','pieceRotZ'
];

function pieceRelativeNumber(id){
  const raw=String($(id)?.value??'0').trim().replace(',','.');
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}
function resetPieceRelativeInputs(){
  for(const id of PIECE_RELATIVE_INPUT_IDS){
    const el=$(id);if(el)el.value='0';
  }
}
function pieceRelativeEditable(mesh){
  if(!mesh)return {ok:false,message:'Selecione uma peça'};
  const u=mesh.userData||{};
  if(u.kind==='hardware-visual')return {ok:false,message:'Esta é uma ferragem visual. Edite pelo sistema de ferragens/corrediças.'};
  if(u.drawerSetId)return {ok:false,message:'Esta peça pertence a um conjunto paramétrico de gavetas. Edite pela ferramenta Gavetas / corrediças.'};
  if(u.kind==='curved-panel'||u.curvedRole)return {ok:false,message:'Peças do móvel curvo continuam sendo editadas pela ferramenta Móvel curvo.'};
  if(u.kind==='cylinder')return {ok:false,message:'Este ajuste é destinado às peças retangulares.'};
  return {ok:true};
}
function pieceLocalAxisVector(mesh,axis){
  const v=axis==='x'
    ? new THREE.Vector3(1,0,0)
    : axis==='y'
      ? new THREE.Vector3(0,1,0)
      : new THREE.Vector3(0,0,1);
  return v.applyQuaternion(mesh.quaternion).normalize();
}
function syncPieceRotationMetadata(mesh){
  if(!mesh)return;
  mesh.userData.rotationX=Number(mesh.rotation.x)||0;
  mesh.userData.rotationY=Number(mesh.rotation.y)||0;
  mesh.userData.rotationZ=Number(mesh.rotation.z)||0;
}
function applyPieceRelativeConfig(){
  const check=pieceRelativeEditable(selected);
  if(!check.ok){
    toast(check.message);
    if(selected?.userData?.drawerSetId)openDrawerSystemDialog(selected);
    return;
  }

  const moveMm={
    x:pieceRelativeNumber('pieceMoveX'),
    y:pieceRelativeNumber('pieceMoveY'),
    z:pieceRelativeNumber('pieceMoveZ')
  };

  // Cada valor representa o deslocamento DAQUELA FACE:
  // positivo = face anda para fora, aumentando a peça;
  // negativo = face anda para dentro, diminuindo a peça.
  const faceMm={
    left:pieceRelativeNumber('pieceFaceLeft'),
    right:pieceRelativeNumber('pieceFaceRight'),
    back:pieceRelativeNumber('pieceFaceBack'),
    front:pieceRelativeNumber('pieceFaceFront'),
    bottom:pieceRelativeNumber('pieceFaceBottom'),
    top:pieceRelativeNumber('pieceFaceTop')
  };

  const rotDeg={
    x:pieceRelativeNumber('pieceRotX'),
    y:pieceRelativeNumber('pieceRotY'),
    z:pieceRelativeNumber('pieceRotZ')
  };

  const nums=[...Object.values(moveMm),...Object.values(faceMm),...Object.values(rotDeg)];
  if(!nums.every(Number.isFinite)){
    toast('Confira os valores da configuração');
    return;
  }

  const u=selected.userData;
  const oldW=Number(u.width)||0;
  const oldD=Number(u.depth)||0;
  const oldH=Number(u.height)||0;

  // A dimensão total muda pela SOMA dos dois lados.
  // Ex.: somente Cima=-20 => altura perde EXATAMENTE 20 mm.
  const newW=oldW+m(faceMm.left+faceMm.right);
  const newD=oldD+m(faceMm.back+faceMm.front);
  const newH=oldH+m(faceMm.bottom+faceMm.top);

  if(newW<MIN_SIZE||newD<MIN_SIZE||newH<MIN_SIZE){
    toast('O ajuste deixaria a peça com medida menor que 1 mm');
    return;
  }
  if(newW>MAX_SIZE||newD>MAX_SIZE||newH>MAX_SIZE){
    toast('O ajuste ultrapassa a medida máxima permitida');
    return;
  }

  // Preserva a face oposta.
  //
  // X:
  // esquerda positiva expande para -X => centro vai -left/2
  // direita positiva expande para +X => centro vai +right/2
  //
  // Y:
  // baixo positivo expande para -Y
  // cima positivo expande para +Y
  //
  // Z:
  // trás positivo expande para -Z
  // frente positivo expande para +Z
  const shiftLocalX=m((faceMm.right-faceMm.left)/2);
  const shiftLocalY=m((faceMm.top-faceMm.bottom)/2);
  const shiftLocalZ=m((faceMm.front-faceMm.back)/2);

  if(Math.abs(shiftLocalX)>1e-12){
    selected.position.addScaledVector(pieceLocalAxisVector(selected,'x'),shiftLocalX);
  }
  if(Math.abs(shiftLocalY)>1e-12){
    selected.position.addScaledVector(pieceLocalAxisVector(selected,'y'),shiftLocalY);
  }
  if(Math.abs(shiftLocalZ)>1e-12){
    selected.position.addScaledVector(pieceLocalAxisVector(selected,'z'),shiftLocalZ);
  }

  if(
    Math.abs(newW-oldW)>1e-12||
    Math.abs(newD-oldD)>1e-12||
    Math.abs(newH-oldH)>1e-12
  ){
    setDimensions(selected,newW,newD,newH,false);
  }

  // Deslocamento da peça inteira nos eixos GLOBAIS.
  selected.position.x+=m(moveMm.x);
  selected.position.y+=m(moveMm.y);
  selected.position.z+=m(moveMm.z);

  // Rotação relativa.
  selected.rotation.order='XYZ';
  selected.rotation.x+=THREE.MathUtils.degToRad(rotDeg.x);
  selected.rotation.y+=THREE.MathUtils.degToRad(rotDeg.y);
  selected.rotation.z+=THREE.MathUtils.degToRad(rotDeg.z);
  syncPieceRotationMetadata(selected);

  selected.updateMatrixWorld(true);
  if(Array.isArray(u.machining)&&u.machining.length)renderMachiningVisuals();

  updateInspector();
  updateMeasureBadge();
  resetPieceRelativeInputs();
  commitHistory();

  const changedFaces=Object.entries(faceMm)
    .filter(([,v])=>Math.abs(v)>1e-12)
    .map(([k])=>({
      left:'esquerda',right:'direita',
      back:'trás',front:'frente',
      bottom:'baixo',top:'cima'
    }[k]));

  const parts=[];
  if(moveMm.x||moveMm.y||moveMm.z)parts.push('deslocada');
  if(changedFaces.length)parts.push(`faces: ${changedFaces.join(', ')}`);
  if(rotDeg.x||rotDeg.y||rotDeg.z)parts.push('rotacionada');

  toast(parts.length?`Peça ajustada · ${parts.join(' · ')}`:'Nenhum ajuste informado');
}

function setDimensions(mesh,width,depth,height,keepBase=true,followMachining=true){
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  const oldDimsMm={x:Number(mesh.userData.width)*1000,y:Number(mesh.userData.height)*1000,z:Number(mesh.userData.depth)*1000};
  const oldBase=mesh.position.y-mesh.userData.height/2;
  if(mesh.userData.kind==='cylinder'){
    const d=width; mesh.scale.set(d,height,d); mesh.userData.width=d; mesh.userData.depth=d; mesh.userData.height=height;
  }else{
    mesh.userData.width=width; mesh.userData.depth=depth; mesh.userData.height=height;
    if(Array.isArray(mesh.userData.forms)&&mesh.userData.forms.length){mesh.scale.set(1,1,1);rebuildFormGeometry(mesh);}else mesh.scale.set(width,height,depth);
  }
  if(keepBase) mesh.position.y=oldBase+height/2;
  if(followMachining)remapMachiningForPieceResize(mesh,oldDimsMm,{x:Number(mesh.userData.width)*1000,y:Number(mesh.userData.height)*1000,z:Number(mesh.userData.depth)*1000});
  sanitizeMachiningForPiece(mesh);
}

function applyExactPanel(){
  if(!selected) return;
  if(selected.userData?.kind==='curved-panel'||selected.userData?.curvedRole){toast('Edite estruturas curvas/capas pela ferramenta Móvel curvo');return;}
  if(selected.userData?.drawerSetId){toast('Edite este conjunto pela ferramenta Gavetas / corrediças');openDrawerSystemDialog(selected);return;}
  const w=clampSize(m($('dimW').value)), d=clampSize(m($('dimD').value)), h=clampSize(m($('dimH').value));
  const x=m($('posX').value), yBase=m($('posY').value), z=m($('posZ').value);
  if(![w,d,h,x,yBase,z].every(Number.isFinite)){ toast('Confira os valores'); return; }
  selected.userData.name=$('partNameInput').value.trim() || selected.userData.name || 'Peça';
  setDimensions(selected,w,d,h,false);
  selected.position.set(x,yBase+h/2,z);
  syncPieceRotationMetadata(selected);
  updateInspector(); updateMeasureBadge(); commitHistory(); toast('Medidas aplicadas');
}

function rotateBox(axis){
  if(!selected) return;
  if(Array.isArray(selected.userData?.forms)&&selected.userData.forms.length){toast('Remova ou edite a Forma antes de girar a peça');return;}
  if(selected.userData.kind==='cylinder'){ toast('Rotação de cilindro ainda não é necessária'); return; }
  const u=selected.userData;
  const base=selected.position.y-u.height/2;
  let w=u.width,d=u.depth,h=u.height;
  if(axis==='x'){ remapMachiningAxes(u,'y','z'); [d,h]=[h,d]; }
  if(axis==='y'){ remapMachiningAxes(u,'x','z'); [w,d]=[d,w]; }
  if(axis==='z'){ remapMachiningAxes(u,'x','y'); [w,h]=[h,w]; }
  setDimensions(selected,w,d,h,false,false);
  selected.position.y=base+h/2;
  if(u.kind==='panel') u.materialType='MDF';
  updateInspector(); updateMeasureBadge(); commitHistory();
}

function rotateSelectedPieceGrain(){
  if(!selected){toast('Selecione uma peça');return;}
  const u=selected.userData||{};
  if(u.kind==='cylinder'||u.kind==='hardware-visual'){toast('Esta opção é para peças de chapa');return;}
  if(!u.materialGrain){toast('O material desta peça não está marcado como madeirado / com veio');return;}
  u.materialGrainRotation=normalizePieceGrainRotation(u.materialGrainRotation)===90?0:90;
  updateInspector();
  commitHistory();
  toast(u.materialGrainRotation===90?'Veio da peça rotacionado 90° · geometria não foi alterada':'Veio da peça voltou ao sentido original');
}

function setSelectedPieceDoNotProduce(enabled){
  if(!selected){toast('Selecione uma peça');return;}
  const u=selected.userData||{};
  if(u.kind==='cylinder'||u.kind==='hardware-visual')return;
  u.excludeFromCutList=!!enabled;
  updateInspector();
  commitHistory();
  toast(u.excludeFromCutList?'Peça marcada como NÃO PRODUZIR · removida do plano de corte':'Peça voltou para produção · será incluída no plano de corte');
}

let duplicatePieceLocked=false;
let duplicatePieceUnlockTimer=null;

function cancelDuplicateConfirmation(){
  const row=$('duplicateConfirmRow');if(row)row.classList.remove('show');
  const btn=$('duplicateBtn');if(btn&&!duplicatePieceLocked)btn.disabled=false;
}
function requestDuplicateSelected(){
  if(!selected){toast('Selecione uma peça');return;}
  if(selected.userData?.drawerSetId){
    toast('O conjunto de gavetas é paramétrico. Edite ou crie outro conjunto pelo espaço.');
    openDrawerSystemDialog(selected);return;
  }
  const row=$('duplicateConfirmRow'),txt=$('duplicateConfirmText');
  if(txt)txt.textContent=`Duplicar “${selected.userData?.name||'Peça'}”? Toque em Confirmar duplicação.`;
  row?.classList.add('show');
}
function confirmDuplicateSelected(){
  const row=$('duplicateConfirmRow');row?.classList.remove('show');
  duplicateSelected();
}

function duplicateSelected(){
  if(!selected)return;

  if(selected.userData?.drawerSetId){
    toast('O conjunto de gavetas é paramétrico. Edite ou crie outro conjunto pelo espaço.');
    openDrawerSystemDialog(selected);
    return;
  }

  // Proteção para Android/touch: um acionamento nunca pode criar 2 cópias.
  if(duplicatePieceLocked)return;
  duplicatePieceLocked=true;

  const btn=$('duplicateBtn');
  if(btn)btn.disabled=true;

  const source=selected;
  const u=source.userData;
  const yBase=source.position.y-u.height/2;

  const opts={
    width:u.width,depth:u.depth,height:u.height,
    x:source.position.x+.03,yBase,z:source.position.z+.03,
    name:(u.name||'Peça')+' cópia',
    kind:u.kind,materialType:u.materialType,baseColor:u.baseColor,
    materialId:u.materialId||null,materialCode:u.materialCode||'',
    materialGrain:!!u.materialGrain,materialGrainRotation:normalizePieceGrainRotation(u.materialGrainRotation),materialCoreColor:u.materialCoreColor||null,
    edgeBands:productionClone(u.edgeBands||{}),
    labelMeta:{...(u.labelMeta||{}),schemaVersion:1},
    spaceRootId:u.spaceRootId||null,
    machining:JSON.parse(JSON.stringify(u.machining||[])),
    forms:JSON.parse(JSON.stringify(u.forms||[])),
    rotationX:Number(source.rotation.x)||0,
    rotationY:Number(source.rotation.y)||0,
    rotationZ:Number(source.rotation.z)||0,
    excludeFromCutList:!!u.excludeFromCutList,
    spaceCutting:!!u.spaceCutting,
    spaceCutParentBounds:u.spaceCutParentBounds?JSON.parse(JSON.stringify(u.spaceCutParentBounds)):null
  };

  let copy=null;
  try{
    // Todos os criadores recebem doHistory=false. No fim fazemos um único commit.
    if(u.kind==='cylinder'){
      copy=createCylinder({
        diameter:u.width,height:u.height,x:opts.x,yBase,z:opts.z,name:opts.name
      },false);
    }else if(u.kind==='curved-panel'&&u.customProfile?.cfg){
      copy=createCurvedRib({
        cfg:u.customProfile.cfg,yBase,
        x:(Number.isFinite(u.curvedTargetX)?u.curvedTargetX:source.position.x)+.03,
        z:(Number.isFinite(u.curvedTargetZ)?u.curvedTargetZ:source.position.z)+.03,
        name:opts.name,spaceRootId:u.spaceRootId||null,
        part:u.customProfile.part||u.curvedPart||'full'
      },false);
    }else if(u.curvedRole==='cover'&&u.curvedConfig){
      copy=createCurvedCover({
        cfg:u.curvedConfig,yBase,x:opts.x,z:opts.z,name:opts.name,
        spaceRootId:u.spaceRootId||null,
        part:u.curvedPart||u.curvedConfig.coverPart||'full'
      },false);
    }else if(u.curvedRole==='post'&&u.curvedConfig){
      copy=createCurvedPost({
        cfg:u.curvedConfig,yBase,x:opts.x,z:opts.z,name:opts.name,
        spaceRootId:u.spaceRootId||null,
        rotationY:Number(source.rotation.y)||0
      },false);
    }else{
      copy=createBox(opts,false);
    }

    if(copy){
      copy.userData.excludeFromCutList=!!u.excludeFromCutList;
      copy.userData.spaceCutting=!!u.spaceCutting;
      commitHistory();
      openPieceInspector(copy);
      toast('1 cópia criada');
    }
  }finally{
    clearTimeout(duplicatePieceUnlockTimer);
    duplicatePieceUnlockTimer=setTimeout(()=>{
      duplicatePieceLocked=false;
      if(btn)btn.disabled=false;
    },700);
  }
}

function deleteSelectedFromInspector(){
  if(!selected){
    toast('Selecione uma peça');
    return;
  }

  // Gaveta paramétrica usa a confirmação própria da rotina existente.
  if(selected.userData?.drawerSetId){
    deleteSelected();
    return;
  }

  const name=selected.userData?.name||'Peça';
  if(!window.confirm(`Apagar a peça “${name}”?\n\nO espaço será recalculado quando necessário.`))return;

  deleteSelected();
  $('inspector').classList.add('compact');
  $('inspector').style.display='none';
}

// ============================================================================
// v100 · RECALCULAR VÃOS QUANDO UMA PEÇA É APAGADA
// ============================================================================
const SPACE_HEAL_TOL=.0008;
const SPACE_HEAL_MAX_GAP=.120;

function cellAxisMin(c,axis){return axis==='x'?c.minX:axis==='y'?c.minY:c.minZ;}
function cellAxisMax(c,axis){return axis==='x'?c.maxX:axis==='y'?c.maxY:c.maxZ;}
function setCellAxisMin(c,axis,v){if(axis==='x')c.minX=v;else if(axis==='y')c.minY=v;else c.minZ=v;}
function setCellAxisMax(c,axis,v){if(axis==='x')c.maxX=v;else if(axis==='y')c.maxY=v;else c.maxZ=v;}
function tangentAxesForSpace(axis){return axis==='x'?['y','z']:axis==='y'?['x','z']:['x','y'];}
function almostSpace(a,b,tol=SPACE_HEAL_TOL){return Math.abs(Number(a)-Number(b))<=tol;}
function sameCellTangents(a,b,axis,tol=SPACE_HEAL_TOL){
  const [u,v]=tangentAxesForSpace(axis);
  return almostSpace(cellAxisMin(a,u),cellAxisMin(b,u),tol)
      && almostSpace(cellAxisMax(a,u),cellAxisMax(b,u),tol)
      && almostSpace(cellAxisMin(a,v),cellAxisMin(b,v),tol)
      && almostSpace(cellAxisMax(a,v),cellAxisMax(b,v),tol);
}
function cellBox(c){return {minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ};}
function boxAxisMin(b,a){return a==='x'?b.minX:a==='y'?b.minY:b.minZ;}
function boxAxisMax(b,a){return a==='x'?b.maxX:a==='y'?b.maxY:b.maxZ;}
function setBoxAxisMin(b,a,v){if(a==='x')b.minX=v;else if(a==='y')b.minY=v;else b.minZ=v;}
function setBoxAxisMax(b,a,v){if(a==='x')b.maxX=v;else if(a==='y')b.maxY=v;else b.maxZ=v;}
function boxOverlapMeters(a,b,axis){
  return Math.min(boxAxisMax(a,axis),boxAxisMax(b,axis))-Math.max(boxAxisMin(a,axis),boxAxisMin(b,axis));
}
function boxesOverlapVolume(a,b,tol=SPACE_HEAL_TOL){
  return boxOverlapMeters(a,b,'x')>tol && boxOverlapMeters(a,b,'y')>tol && boxOverlapMeters(a,b,'z')>tol;
}
function gapBoxBetweenCells(a,b,axis){
  const box={...cellBox(a)};
  const a0=cellAxisMin(a,axis),a1=cellAxisMax(a,axis),b0=cellAxisMin(b,axis),b1=cellAxisMax(b,axis);
  if(a1<b0){
    setBoxAxisMin(box,axis,a1);setBoxAxisMax(box,axis,b0);
  }else if(b1<a0){
    setBoxAxisMin(box,axis,b1);setBoxAxisMax(box,axis,a0);
  }else return null;
  return box;
}
function objectOccupiesSpaceGap(root,gapBox,axis,exclude=null){
  const [u,v]=tangentAxesForSpace(axis);
  for(const o of objects){
    if(o===exclude)continue;
    const ud=o.userData||{};
    if(ud.kind==='hardware-visual'||ud.kind==='cylinder')continue;
    const belongs=ud.spaceRootId===root.id || objectInsideSpaceRoot(o,root,.006);
    if(!belongs)continue;

    // Só uma peça cuja ESPESSURA está no mesmo eixo do GAP pode bloquear
    // a recomposição daquele vão. Ex.: prateleira => GAP em Y.
    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!==axis)continue;

    const b=getBounds(o);
    const axisOv=boxOverlapMeters(b,gapBox,axis);
    if(axisOv<=SPACE_HEAL_TOL)continue;

    const ovU=boxOverlapMeters(b,gapBox,u),ovV=boxOverlapMeters(b,gapBox,v);
    if(ovU>.004&&ovV>.004)return true;
  }
  return false;
}
function anotherCellOccupiesGap(root,gapBox,ignore=[]){
  const ignored=new Set(ignore);
  return root.cells.some(c=>!ignored.has(c)&&boxesOverlapVolume(cellBox(c),gapBox,.0002));
}
function mergedCellFromPair(a,b,axis){
  const c={
    id:uid('cell'),
    hidden:!!(a.hidden&&b.hidden),
    fixedAxes:{
      x:!!(a.fixedAxes?.x&&b.fixedAxes?.x),
      y:!!(a.fixedAxes?.y&&b.fixedAxes?.y),
      z:!!(a.fixedAxes?.z&&b.fixedAxes?.z)
    },
    minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),
    minY:Math.min(a.minY,b.minY),maxY:Math.max(a.maxY,b.maxY),
    minZ:Math.min(a.minZ,b.minZ),maxZ:Math.max(a.maxZ,b.maxZ)
  };
  setCellAxisMin(c,axis,Math.min(cellAxisMin(a,axis),cellAxisMin(b,axis)));
  setCellAxisMax(c,axis,Math.max(cellAxisMax(a,axis),cellAxisMax(b,axis)));
  return c;
}
function tryMergeOneOrphanGap(root,exclude=null){
  for(const axis of ['x','y','z']){
    for(let i=0;i<root.cells.length;i++){
      const a=root.cells[i];
      for(let j=i+1;j<root.cells.length;j++){
        const b=root.cells[j];
        if(!sameCellTangents(a,b,axis))continue;
        const gap=gapBoxBetweenCells(a,b,axis);if(!gap)continue;
        const size=boxAxisMax(gap,axis)-boxAxisMin(gap,axis);
        if(size<=SPACE_HEAL_TOL||size>SPACE_HEAL_MAX_GAP)continue;
        if(objectOccupiesSpaceGap(root,gap,axis,exclude))continue;
        if(anotherCellOccupiesGap(root,gap,[a,b]))continue;
        const merged=mergedCellFromPair(a,b,axis);
        root.cells.splice(j,1);root.cells.splice(i,1,merged);
        return {kind:'merge',axis,size,cell:merged};
      }
    }
  }
  return null;
}
function blockingIntervalsInBoundaryGap(root,gapBox,axis,exclude=null){
  const [u,v]=tangentAxesForSpace(axis),out=[];
  for(const o of objects){
    if(o===exclude)continue;
    const ud=o.userData||{};
    if(ud.kind==='hardware-visual'||ud.kind==='cylinder')continue;
    const belongs=ud.spaceRootId===root.id || objectInsideSpaceRoot(o,root,.006);
    if(!belongs)continue;

    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!==axis)continue;

    const b=getBounds(o);
    if(boxOverlapMeters(b,gapBox,axis)<=SPACE_HEAL_TOL)continue;
    if(boxOverlapMeters(b,gapBox,u)<=.004||boxOverlapMeters(b,gapBox,v)<=.004)continue;

    const a=Math.max(boxAxisMin(b,axis),boxAxisMin(gapBox,axis));
    const z=Math.min(boxAxisMax(b,axis),boxAxisMax(gapBox,axis));
    if(z-a>SPACE_HEAL_TOL)out.push([a,z]);
  }
  return out;
}
function tryHealOneBoundaryGap(root,exclude=null){
  const rb=rootBounds(root);
  for(const axis of ['x','y','z']){
    const rootMin=boxAxisMin(rb,axis),rootMax=boxAxisMax(rb,axis);

    for(const c of root.cells){
      for(const side of ['min','max']){
        const edge=side==='min'?cellAxisMin(c,axis):cellAxisMax(c,axis);
        const boundary=side==='min'?rootMin:rootMax;
        const rawSize=side==='min'?edge-boundary:boundary-edge;
        if(rawSize<=SPACE_HEAL_TOL||rawSize>SPACE_HEAL_MAX_GAP)continue;

        const gap={...cellBox(c)};
        if(side==='min'){
          setBoxAxisMin(gap,axis,boundary);
          setBoxAxisMax(gap,axis,edge);
        }else{
          setBoxAxisMin(gap,axis,edge);
          setBoxAxisMax(gap,axis,boundary);
        }

        if(anotherCellOccupiesGap(root,gap,[c]))continue;

        // Em vez de cancelar o reparo porque existe uma base/lateral/chapéu
        // dentro do GAP, encontramos a peça legítima mais próxima do vão.
        // O espaço cresce ATÉ essa peça, cobrindo somente a faixa órfã.
        const blockers=blockingIntervalsInBoundaryGap(root,gap,axis,exclude);
        let target=boundary;

        if(side==='min'){
          // Ex.: raiz 0, base 0..18, prateleira apagada 18..36,
          // vão atual começa em 36. O alvo correto é 18, não 0.
          for(const [,end] of blockers){
            if(end<=edge+SPACE_HEAL_TOL)target=Math.max(target,end);
          }
          const healSize=edge-target;
          if(healSize<=SPACE_HEAL_TOL||healSize>SPACE_HEAL_MAX_GAP)continue;

          const orphan={...cellBox(c)};
          setBoxAxisMin(orphan,axis,target);
          setBoxAxisMax(orphan,axis,edge);
          if(anotherCellOccupiesGap(root,orphan,[c]))continue;

          setCellAxisMin(c,axis,target);
          c.hidden=false;
          return {kind:'boundary',axis,size:healSize,cell:c,target};
        }else{
          for(const [start] of blockers){
            if(start>=edge-SPACE_HEAL_TOL)target=Math.min(target,start);
          }
          const healSize=target-edge;
          if(healSize<=SPACE_HEAL_TOL||healSize>SPACE_HEAL_MAX_GAP)continue;

          const orphan={...cellBox(c)};
          setBoxAxisMin(orphan,axis,edge);
          setBoxAxisMax(orphan,axis,target);
          if(anotherCellOccupiesGap(root,orphan,[c]))continue;

          setCellAxisMax(c,axis,target);
          c.hidden=false;
          return {kind:'boundary',axis,size:healSize,cell:c,target};
        }
      }
    }
  }
  return null;
}
function repairOrphanSpaceGaps(root,{exclude=null,maxPasses=80}={}){
  if(!root||!Array.isArray(root.cells)||!root.cells.length)return {changes:0,cell:null};
  let changes=0,lastCell=null;
  for(let n=0;n<maxPasses;n++){
    const r=tryMergeOneOrphanGap(root,exclude);
    if(!r)break;changes++;lastCell=r.cell;
  }
  for(let n=0;n<maxPasses;n++){
    const r=tryHealOneBoundaryGap(root,exclude);
    if(!r)break;changes++;lastCell=r.cell;
  }
  return {changes,cell:lastCell};
}
function repairAllOrphanSpaceGaps(){
  let changes=0;
  for(const root of spaceRoots)changes+=repairOrphanSpaceGaps(root).changes;
  if(changes){
    renderSpaces();
    console.info(`DesignLabMoveis: ${changes} faixa(s) órfã(s) recuperada(s).`);
  }
  return changes;
}
function bestCellNearPoint(root,p){
  const visible=(root?.cells||[]).filter(c=>!c.hidden);
  if(!visible.length)return null;
  const inside=visible.find(c=>p.x>=c.minX-SPACE_HEAL_TOL&&p.x<=c.maxX+SPACE_HEAL_TOL&&p.y>=c.minY-SPACE_HEAL_TOL&&p.y<=c.maxY+SPACE_HEAL_TOL&&p.z>=c.minZ-SPACE_HEAL_TOL&&p.z<=c.maxZ+SPACE_HEAL_TOL);
  if(inside)return inside;
  return visible.reduce((best,c)=>distanceSqPointToCell(p,c)<distanceSqPointToCell(p,best)?c:best,visible[0]);
}

// 1.200.18 · ao apagar uma peça estrutural, devolve exatamente a faixa que ela ocupava
// ao(s) vão(s) vizinho(s). Isso resolve principalmente lateral esquerda/direita,
// base, chapéu, prateleira, fundo/frente e divisão vertical.
function isSpaceCuttingPieceForHeal(o){
  if(!o||o.userData?.kind!=='panel'||isDoorObject(o)||o.userData?.drawerRole||o.userData?.curvedRole)return false;
  if(o.userData?.spaceCutting===true)return true;
  const n=String(o.userData?.name||'').trim();
  return /^(Lateral esquerda|Lateral direita|Divisão vertical|Base|Chapéu|Prateleira(?:\s+\d+)?|Fundo|Frente)$/i.test(n);
}
function deletedPieceAxisBounds(b,axis){
  return axis==='x'?[b.minX,b.maxX]:axis==='y'?[b.minY,b.maxY]:[b.minZ,b.maxZ];
}
function deletedPieceTangentOverlap(cell,b,axis){
  const [u,v]=tangentAxesForSpace(axis);
  return boxOverlapMeters(cellBox(cell),b,u)>SPACE_HEAL_TOL && boxOverlapMeters(cellBox(cell),b,v)>SPACE_HEAL_TOL;
}
function removeDeletedDivisionFixedBand(root,o,b,axis){
  if(!root||axis!=='x'||!isVerticalDivisionPiece(o,root))return 0;
  const rb=rootBounds(root),rootMin=rb.minX;
  const a=b.minX-rootMin,z=b.maxX-rootMin,tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  const before=(root.fixedBands?.x||[]).length;
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands.x=(root.fixedBands.x||[]).filter(([s,e])=>!(Math.abs(Number(s)-a)<=tol&&Math.abs(Number(e)-z)<=tol));
  return before-root.fixedBands.x.length;
}
function spaceBoundaryRoleForHeal(o,axis){
  const n=String(o?.userData?.name||'').trim().toLowerCase();
  if(axis==='x'){
    if(/^lateral esquerda$/i.test(n))return 'min';
    if(/^lateral direita$/i.test(n))return 'max';
  }
  if(axis==='y'){
    if(/^base$/i.test(n))return 'min';
    if(/^(chapéu|chapeu|topo)$/i.test(n))return 'max';
  }
  if(axis==='z'){
    if(/^fundo(?: 6 mm)?$/i.test(n))return 'min';
    if(/^frente$/i.test(n))return 'max';
  }
  return null;
}
function validStoredSpaceCutParentBounds(o){
  const b=o?.userData?.spaceCutParentBounds;
  if(!b)return null;
  const keys=['minX','maxX','minY','maxY','minZ','maxZ'];
  if(!keys.every(k=>Number.isFinite(Number(b[k]))))return null;
  const out={};for(const k of keys)out[k]=Number(b[k]);
  return out.maxX>out.minX&&out.maxY>out.minY&&out.maxZ>out.minZ?out:null;
}
function cellTangentOverlapWithDeletedPiece(c,b,axis){
  const [u,v]=tangentAxesForSpace(axis);
  return boxOverlapMeters(cellBox(c),b,u)>SPACE_HEAL_TOL && boxOverlapMeters(cellBox(c),b,v)>SPACE_HEAL_TOL;
}
function restoreBoundaryPieceThickness(root,o,b,axis,role){
  const [d0,d1]=deletedPieceAxisBounds(b,axis),tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  const parent=validStoredSpaceCutParentBounds(o);
  // Para peças criadas a partir desta versão, o limite é o limite original do
  // vão. Para projetos antigos usamos a própria face externa da peça: isso é
  // suficiente para devolver exatamente a espessura sem atravessar o corte
  // manual que existe do outro lado da lateral/base/chapéu/fundo/frente.
  const target=role==='min'
    ? (parent?Math.max(boxAxisMin(parent,axis),Math.min(d0,d1)):d0)
    : (parent?Math.min(boxAxisMax(parent,axis),Math.max(d0,d1)):d1);
  const insideFace=role==='min'?d1:d0;
  let changes=0,lastCell=null;
  const candidates=root.cells.filter(c=>cellTangentOverlapWithDeletedPiece(c,b,axis));
  for(const c of candidates){
    const touchesInside=role==='min'
      ? almostSpace(cellAxisMin(c,axis),insideFace,tol)
      : almostSpace(cellAxisMax(c,axis),insideFace,tol);
    if(!touchesInside)continue;
    const gap={...cellBox(c)};
    if(role==='min'){
      setBoxAxisMin(gap,axis,target);setBoxAxisMax(gap,axis,cellAxisMin(c,axis));
    }else{
      setBoxAxisMin(gap,axis,cellAxisMax(c,axis));setBoxAxisMax(gap,axis,target);
    }
    if(boxAxisMax(gap,axis)-boxAxisMin(gap,axis)<=SPACE_HEAL_TOL)continue;
    // Outra divisão pode encostar no lado de fora, mas não pode ocupar o volume
    // que era da peça apagada. Assim o vão de 60 mm volta a 60 mm sem juntar
    // com os espaços grandes à esquerda/direita.
    if(objectOccupiesSpaceGap(root,gap,axis,null)||anotherCellOccupiesGap(root,gap,[c]))continue;
    if(role==='min')setCellAxisMin(c,axis,target);else setCellAxisMax(c,axis,target);
    c.hidden=false;changes++;lastCell=c;
  }
  // Caso a peça ocupasse 100% do vão, não existe célula interna para expandir.
  // Se conhecemos o vão original, recriamos a célula inteira.
  if(!changes&&parent){
    const free={id:uid('cell'),hidden:false,fixedAxes:{},...parent};
    if(!root.cells.some(c=>boxesOverlapVolume(cellBox(c),parent,.0002)) && !objectOccupiesSpaceGap(root,parent,axis,null)){
      root.cells.push(free);changes++;lastCell=free;
    }
  }
  return {changes,cell:lastCell};
}
function reclaimDeletedPieceSpace(root,o,deletedBounds){
  if(!root||!deletedBounds||!isSpaceCuttingPieceForHeal(o))return {changes:0,cell:null};
  const ti=pieceThicknessInfo(o);if(!ti)return {changes:0,cell:null};
  const axis=ti.thicknessAxis,[d0,d1]=deletedPieceAxisBounds(deletedBounds,axis),tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  let changes=0,lastCell=null;

  removeDeletedDivisionFixedBand(root,o,deletedBounds,axis);

  // Laterais/base/chapéu/fundo/frente são bordas DO VÃO EM QUE FORAM CRIADAS,
  // não necessariamente bordas do móvel principal. Ao apagar, devolvemos só a
  // espessura da peça para dentro daquele vão. Esse é o caso de um corte de
  // 60 mm com duas laterais: 60 -> 24 livres; apagando ambas volta exatamente 60.
  const boundaryRole=spaceBoundaryRoleForHeal(o,axis);
  if(boundaryRole){
    const r=restoreBoundaryPieceThickness(root,o,deletedBounds,axis,boundaryRole);
    return r;
  }

  // Peças internas, como Divisão vertical e Prateleira, realmente separam dois
  // vãos. Ao apagar, une somente os dois compartimentos que encostavam nas duas
  // faces da peça.
  let merged=true;
  while(merged){
    merged=false;
    outer:
    for(let i=0;i<root.cells.length;i++){
      const a=root.cells[i];
      if(!deletedPieceTangentOverlap(a,deletedBounds,axis))continue;
      for(let j=i+1;j<root.cells.length;j++){
        const c=root.cells[j];
        if(!deletedPieceTangentOverlap(c,deletedBounds,axis)||!sameCellTangents(a,c,axis,tol))continue;
        const aLow=almostSpace(cellAxisMax(a,axis),d0,tol)&&almostSpace(cellAxisMin(c,axis),d1,tol);
        const cLow=almostSpace(cellAxisMax(c,axis),d0,tol)&&almostSpace(cellAxisMin(a,axis),d1,tol);
        if(!aLow&&!cLow)continue;
        const gap=gapBoxBetweenCells(a,c,axis);
        if(!gap||objectOccupiesSpaceGap(root,gap,axis,null)||anotherCellOccupiesGap(root,gap,[a,c]))continue;
        const joined=mergedCellFromPair(a,c,axis);
        root.cells.splice(j,1);root.cells.splice(i,1,joined);
        changes++;lastCell=joined;merged=true;break outer;
      }
    }
  }

  // Compatibilidade: se uma peça estrutural antiga estiver na borda real do
  // móvel e não tiver metadados do vão, ainda recupera a faixa até o root.
  if(!changes){
    const rb=rootBounds(root),r0=boxAxisMin(rb,axis),r1=boxAxisMax(rb,axis);
    const touchesMin=d0<=r0+tol,touchesMax=d1>=r1-tol;
    if(touchesMin||touchesMax){
      const role=touchesMin?'min':'max';
      const r=restoreBoundaryPieceThickness(root,o,deletedBounds,axis,role);
      changes+=r.changes;lastCell=r.cell||lastCell;
    }
  }
  return {changes,cell:lastCell};
}

function deleteSelected(){
  if(!selected) return;
  const setId=selected.userData?.drawerSetId;
  if(setId){
    const cfg=selected.userData?.drawerConfig||{};
    if(!window.confirm(`Excluir o conjunto de gavetas “${cfg.name||cfg.slideName||'Gavetas'}” inteiro?\n\nAs furações automáticas ligadas às corrediças também serão removidas.`))return;
    removeDrawerSet(setId,{commit:true});
    toast('Conjunto de gavetas excluído');
    return;
  }

  const o=selected;
  const root=rootForObject(o);
  const oldCenter=o.position.clone();
  const deletedBounds=root?{...getBounds(o)}:null;

  // Antes de remover a peça, elimina a aplicação completa das ferragens
  // vinculadas a ela nas outras peças. Assim não sobram pontos rosa no ar.
  const hardwareRemoved=removeHardwareLinkedToObjects([o]);

  const i=objects.indexOf(o);if(i>=0)objects.splice(i,1);
  disposeObject(o);
  selectObject(null);

  let healed=0,targetCell=null;
  if(root){
    // Primeiro devolve diretamente ao espaço a faixa ocupada pela peça apagada.
    // Depois roda o reparo genérico para consolidar qualquer faixa órfã restante.
    const direct=reclaimDeletedPieceSpace(root,o,deletedBounds);
    const first=repairOrphanSpaceGaps(root,{exclude:o});
    const second=repairOrphanSpaceGaps(root);
    healed=direct.changes+first.changes+second.changes;

    if(healed){
      renderSpaces();
      targetCell=bestCellNearPoint(root,oldCenter)||second.cell||first.cell||direct.cell||largestVisibleCell(root);
      if(targetCell)selectSpaceCellByIds(root.id,targetCell.id,{showMenu:false});
      else selectSpaceRootOnly(root,{showMenu:false});
    }
  }

  if(root){
    // Garante que a geometria visual das células reflita imediatamente
    // os limites recalculados, inclusive quando a peça estava colada na base.
    renderSpaces();
    targetCell=bestCellNearPoint(root,oldCenter)||targetCell||largestVisibleCell(root);
    if(targetCell)selectSpaceCellByIds(root.id,targetCell.id);
  }

  renderMachiningVisuals();
  commitHistory();
  const hwText=hardwareRemoved.instances?` · ${hardwareRemoved.instances} ferragem(ns) vinculada(s) removida(s)`:'';
  toast((healed?`Peça excluída · espaço recalculado (${healed} ajuste${healed===1?'':'s'})`:'Peça excluída')+hwText);
}

function getClientPoint(event){
  return { x:event.clientX, y:event.clientY };
}
function getPointerNDC(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  return getClientPoint(event);
}
function intersectPlane(plane,target=new THREE.Vector3()){
  raycaster.setFromCamera(pointer,camera);
  return raycaster.ray.intersectPlane(plane,target);
}
function intersectGround(){
  raycaster.setFromCamera(pointer,camera); const p=new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane,p) ? p : new THREE.Vector3();
}
function closestParamOnAxis(linePoint,lineDir){
  raycaster.setFromCamera(pointer,camera);
  const O1=raycaster.ray.origin,D1=raycaster.ray.direction.clone().normalize(),O2=linePoint,D2=lineDir.clone().normalize();
  const r=new THREE.Vector3().subVectors(O1,O2);
  const a=D1.dot(D1),b=D1.dot(D2),c=D2.dot(D2),d=D1.dot(r),e=D2.dot(r),den=a*c-b*b;
  if(Math.abs(den)<1e-8) return 0;
  return (a*e-b*d)/den;
}
function worldAxisForFace(hit,obj){
  const n=hit.face.normal.clone().transformDirection(obj.matrixWorld);
  const ax=Math.abs(n.x), ay=Math.abs(n.y), az=Math.abs(n.z);
  if(ax>=ay && ax>=az) return {axis:'x',sign:Math.sign(n.x)||1};
  if(ay>=ax && ay>=az) return {axis:'y',sign:Math.sign(n.y)||1};
  return {axis:'z',sign:Math.sign(n.z)||1};
}

function worldToClient(v){
  // Usa o retângulo REAL do canvas. Em Android/WebView innerWidth/innerHeight
  // podem divergir alguns pixels da área efetivamente usada pelo WebGL.
  camera.updateMatrixWorld(true);
  const rect=renderer.domElement.getBoundingClientRect();
  const p=v.clone().project(camera);
  return new THREE.Vector2(
    rect.left + (p.x*.5+.5)*rect.width,
    rect.top  + (-p.y*.5+.5)*rect.height
  );
}
function inferMoveAxis(event){
  const motion=new THREE.Vector2(event.clientX-moveDownAim.x,event.clientY-moveDownAim.y);
  const motionLen=motion.length();
  if(motionLen<AXIS_INFERENCE_MIN_PX) return null;
  motion.normalize();
  const base=worldToClient(movePickPoint);
  let best=null;
  for(const [axis,dir] of Object.entries({x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)})){
    const end=worldToClient(movePickPoint.clone().add(dir));
    const sv=end.sub(base);
    if(sv.length()<14) continue;
    sv.normalize();
    const dot=Math.abs(motion.dot(sv));
    const angle=Math.acos(THREE.MathUtils.clamp(dot,-1,1));
    if(angle<=AXIS_INFERENCE_ANGLE && (!best || angle<best.angle)) best={axis,angle};
  }
  return best?.axis || null;
}
function axisVector(axis){
  return axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
}

// PEÇAS: 1 clique seleciona; segurar abre Configuração da peça.
// ESPAÇOS/DIVISÕES: 1 clique seleciona; segurar abre o menu flutuante.
// O antigo duplo clique do espaço foi removido na 1.200.18.
let spaceTapState={count:0,lastAt:0,lastX:0,lastY:0,rootId:null,cellId:null};
const SPACE_MULTI_TAP_GAP_MS=560;
const SPACE_MULTI_TAP_PX=64;
function resetSpaceDoubleTap(){
  spaceTapState={count:0,lastAt:0,lastX:0,lastY:0,rootId:null,cellId:null};
}
function registerSpaceDoubleTap(rootId,cellId){
  const now=performance.now();
  const distance=Math.hypot(downClientX-spaceTapState.lastX,downClientY-spaceTapState.lastY);
  const closeEnough=distance<=SPACE_MULTI_TAP_PX;
  const elapsed=now-spaceTapState.lastAt;
  const inTime=elapsed<=SPACE_MULTI_TAP_GAP_MS;
  const sameTarget=spaceTapState.rootId===rootId && spaceTapState.cellId===cellId;

  // Alguns WebViews Android podem repetir o pointerdown do mesmo contato quase
  // instantaneamente. Isso não deve virar um falso "duplo toque". Um segundo
  // toque real precisa ter uma pequena separação temporal.
  const looksLikeDuplicateEvent=spaceTapState.count && sameTarget && distance<=12 && elapsed>=0 && elapsed<110;
  if(looksLikeDuplicateEvent)return false;

  if(spaceTapState.count && closeEnough && inTime && sameTarget){
    resetSpaceDoubleTap();
    return true;
  }
  spaceTapState={count:1,lastAt:now,lastX:downClientX,lastY:downClientY,rootId,cellId};
  return false;
}

// 1.200.18 · menu do espaço igual ao menu da peça:
// 1 toque = somente seleciona; tocar/clicar e SEGURAR = abre o menu flutuante.
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
  if(toolMode!=='select'||!rootId||!cellId)return;
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive())return;
  spaceLongPress={id:pointerId,rootId,cellId,x,y,triggered:false};
  spaceLongPressTimer=setTimeout(()=>{
    spaceLongPressTimer=null;
    const root=getSpaceRoot(rootId),cell=getSpaceCell(rootId,cellId);
    if(toolMode!=='select'||!root||!cell)return;
    spaceLongPress.triggered=true;
    resetSpaceDoubleTap();
    selectSpaceCellByIds(rootId,cellId,{showMenu:true});
    try{if(navigator.vibrate)navigator.vibrate(18);}catch{}
    toast(root.cells.length<=1?'Menu do espaço':'Menu da divisão');
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
  const distance=Math.hypot(downClientX-pieceTapState.lastX,downClientY-pieceTapState.lastY);
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
    pieceTapState={count:1,lastAt:now,lastX:downClientX,lastY:downClientY,obj,rootId,doubleTimer:null};
    return false;
  }

  // Duplo toque/clique continua abrindo o espaço/móvel vinculado, como antes.
  if(pieceTapState.count===1){
    pieceTapState.count=2;pieceTapState.lastAt=now;pieceTapState.lastX=downClientX;pieceTapState.lastY=downClientY;
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
  if(!obj||toolMode!=='select')return;
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive())return;
  pieceLongPress={id:pointerId,obj,x,y,triggered:false};
  pieceLongPressTimer=setTimeout(()=>{
    pieceLongPressTimer=null;
    if(toolMode!=='select'||pieceLongPress.obj!==obj)return;
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

function beginPick(){
  // 1.200.51 · Copiar Forma / Copiar Ferragens usam o mesmo raycast do CAD,
  // mas mantêm seleção múltipla própria. Enquanto um desses modos está ativo,
  // os toques não entram no fluxo normal de selecionar/mover peça.
  if(typeof hardwareCopyHandlePick==='function' && hardwareCopyHandlePick()){
    dragMode=null; controls.enabled=true; return;
  }
  if(typeof shapeCopyHandlePick==='function' && shapeCopyHandlePick()){
    dragMode=null; controls.enabled=true; return;
  }
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(referenceMeshes(),false);
  if(!hits.length){
    if(toolMode==='select'){ selectObject(null); clearSpaceSelection(); resetLinkedDoubleTap(); resetSpaceDoubleTap(); cancelSpaceLongPress(); }
    dragMode=null; controls.enabled=true; return;
  }
  let hit=hits[0], obj=hit.object;

  // 1.200.18: quando já estamos trabalhando em um espaço e uma porta está
  // na frente, a porta não bloqueia a seleção dos cortes atrás dela. Procuramos
  // no mesmo raio a divisão do espaço principal ativo. Peças comuns continuam
  // selecionáveis normalmente; a prioridade especial vale para portas.
  if(toolMode==='select' && (selectedSpaceCell||activeSpaceRootId) && isDoorObject(obj)){
    const activeRootId=selectedSpaceCell?.rootId||activeSpaceRootId;
    const cellHit=hits.find(h=>h.object?.userData?.kind==='space-cell' && h.object.userData.spaceRootId===activeRootId);
    if(cellHit){ hit=cellHit; obj=cellHit.object; }
  }

  if(obj.userData.kind==='space-cell'){
    resetLinkedDoubleTap();
    if(toolMode==='select'){
      const rootId=obj.userData.spaceRootId,cellId=obj.userData.spaceCellId;
      resetSpaceDoubleTap();
      // 1.200.18: um toque apenas seleciona e fecha o menu. Segurar o mesmo
      // espaço/divisão abre a janela, exatamente como a configuração da peça.
      selectSpaceCellByIds(rootId,cellId,{showMenu:false});
      startSpaceLongPress(rootId,cellId,activePointerId,downClientX,downClientY);
      dragMode=null; controls.enabled=true; return;
    }
    if(toolMode==='move-free'){
      const root=getSpaceRoot(obj.userData.spaceRootId);
      if(!root){dragMode=null;controls.enabled=true;return;}
      selectSpaceCellByIds(obj.userData.spaceRootId,obj.userData.spaceCellId);
      movingSpaceRoot=root;
      movingSpaceRootStart={x:root.x,yBase:root.yBase,z:root.z};
      movingSpaceCellStarts=root.cells.map(c=>({id:c.id,minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ}));
      movingSpaceObjectStarts=objects.filter(o=>objectInsideSpaceRoot(o,root)).map(o=>({obj:o,pos:o.position.clone()}));
      dragStartState=stateString(); dragChanged=false; dragMode='space-free'; controls.enabled=false;
      camera.getWorldDirection(freeMovePlaneNormal).normalize();
      freeMovePlane.setFromNormalAndCoplanarPoint(freeMovePlaneNormal,hit.point);
      if(!intersectPlane(freeMovePlane,movingSpaceStartPoint)) movingSpaceStartPoint.copy(hit.point);
      return;
    }
    toast('Use Selecionar, Mover ou as ações do espaço');
    dragMode=null; controls.enabled=true; return;
  }
  let linkedDoublePending=false;
  if(toolMode==='select'){
    cancelSpaceLongPress();
    resetSpaceDoubleTap();
    linkedDoublePending=registerLinkedDoubleTap(obj);
  } else {
    resetLinkedDoubleTap();
  }
  selectObject(obj);
  if(toolMode==='select'){
    startPieceLongPress(obj,activePointerId,downClientX,downClientY);
    // No segundo toque também iniciamos o temporizador de segurar. Se o usuário
    // apenas tocar duas vezes, o espaço vinculado abre; se mantiver pressionado,
    // a configuração da peça ganha prioridade e cancela o duplo toque.
    if(linkedDoublePending){dragMode=null;controls.enabled=true;return;}
  }
  const f=worldAxisForFace(hit,obj);
  const u=obj.userData;
  dragStartState=stateString(); dragChanged=false;

  if(toolMode==='move-free'){
    // Estilo CAD: se a mira estiver perto de uma quina da face tocada,
    // a quina exata vira o ponto de pega. Caso contrário usa o ponto da face.
    dragMode='free';
    controls.enabled=false;
    freeMoveStartPosition.copy(obj.position);
    const actualAim=new THREE.Vector2(
      ((pointer.x+1)*.5)*renderer.domElement.getBoundingClientRect().width + renderer.domElement.getBoundingClientRect().left,
      ((1-pointer.y)*.5)*renderer.domElement.getBoundingClientRect().height + renderer.domElement.getBoundingClientRect().top
    );
    const corner=nearestCornerToClient(obj,f,actualAim,CORNER_PICK_PX);
    const edge=!corner ? nearestEdgeOnMeshToClient(obj,actualAim,EDGE_PICK_PX) : null;
    moveGrabIsCorner=!!corner;
    moveGrabKind=corner ? 'corner' : edge ? 'edge' : 'face';
    movePickPoint.copy(corner ? corner.point : edge ? edge.point : hit.point);
    moveGrip.position.copy(movePickPoint); moveGrip.visible=true;
    moveGrip.material.color.set(moveGrabKind==='corner' ? 0x34d058 : moveGrabKind==='edge' ? 0xffd23f : COLORS.cyan);
    if(moveGrabKind!=='face'){
      cornerMarker.position.copy(movePickPoint); cornerMarker.visible=true;
      cornerMarker.material.color.set(moveGrabKind==='corner' ? 0x34d058 : 0xffd23f);
    }
    const aimClient=worldToClient(movePickPoint);
    moveDownAim.copy(aimClient);
    camera.getWorldDirection(freeMovePlaneNormal).normalize();
    freeMovePlane.setFromNormalAndCoplanarPoint(freeMovePlaneNormal,movePickPoint);
    if(!intersectPlane(freeMovePlane,freeMoveStartPoint)) freeMoveStartPoint.copy(movePickPoint);
    moveInferenceAxis=null;
    lastEdit={type:'position',axis:'free',mesh:obj};
    return;
  }

  if(toolMode==='pull'){
    controls.enabled=false;
    if(u.kind==='cylinder' && f.axis!=='y'){
      dragMode='radius';
      radiusDir.set(hit.point.x-obj.position.x,0,hit.point.z-obj.position.z).normalize();
      lastEdit={type:'diameter',mesh:obj};
      return;
    }
    pullAxis=f.axis; grabSign=f.sign;
    if(pullAxis==='x'){ anchorCoord=obj.position.x-grabSign*u.width/2; lockedA=obj.position.y; lockedB=obj.position.z; }
    if(pullAxis==='y'){ anchorCoord=obj.position.y-grabSign*u.height/2; lockedA=obj.position.x; lockedB=obj.position.z; }
    if(pullAxis==='z'){ anchorCoord=obj.position.z-grabSign*u.depth/2; lockedA=obj.position.x; lockedB=obj.position.y; }
    dragMode='pull-'+pullAxis; lastEdit={type:pullAxis,mesh:obj};
    return;
  }

  // Selecionar no estilo CAD: apenas seleciona. Não move e não abre painel.
  dragMode=null;
  controls.enabled=true;
}

function moveSpaceFree(){
  if(!movingSpaceRoot) return;
  if(!intersectPlane(freeMovePlane,movingSpaceCurrentPoint)) return;
  const rawDelta=movingSpaceCurrentPoint.clone().sub(movingSpaceStartPoint);
  const root=movingSpaceRoot;
  const start0=movingSpaceCellStarts[0];
  if(!start0) return;
  const rs=movingSpaceRootStart || {x:root.x,yBase:root.yBase,z:root.z};
  // Não deixa o móvel atravessar o plano do chão ao mover.
  const delta=rawDelta.clone();
  if(rs.yBase+delta.y<0) delta.y=-rs.yBase;
  // O grupo visual usa o delta enquanto os dados absolutos são atualizados.
  if(root.group) root.group.position.copy(delta);
  root.x=rs.x+delta.x; root.yBase=rs.yBase+delta.y; root.z=rs.z+delta.z;
  root.cells.forEach((c,i)=>{
    const st=movingSpaceCellStarts[i]; if(!st)return;
    c.minX=st.minX+delta.x; c.maxX=st.maxX+delta.x;
    c.minY=st.minY+delta.y; c.maxY=st.maxY+delta.y;
    c.minZ=st.minZ+delta.z; c.maxZ=st.maxZ+delta.z;
  });
  for(const item of movingSpaceObjectStarts) item.obj.position.copy(item.pos).add(delta);
  dragChanged=delta.lengthSq()>1e-10;
  updateMeasureBadge();
}

function updateLiveLabel(){
  if(!lastEdit || !selected || !dragMode){ liveLabel.style.display='none'; return; }
  let worldPos=selected.position.clone();
  const u=selected.userData;
  let text='';
  if(dragMode==='planar' || dragMode==='free'){
    worldPos.y=getBounds(selected).maxY+.04;
    text=`X ${mm(selected.position.x)} · Y ${mm(selected.position.y-u.height/2)} · Z ${mm(selected.position.z)} mm${moveSnapText ? ` · ${moveSnapText}` : ''}`;
  } else if(dragMode==='radius') { worldPos.set(selected.position.x+u.width/2,selected.position.y,selected.position.z); text=`Ø ${mm(u.width)} mm`; }
  else if(pullAxis==='x'){ worldPos.set(selected.position.x+grabSign*u.width/2,selected.position.y,selected.position.z); text=`${mm(u.width)} mm`; }
  else if(pullAxis==='y'){ worldPos.set(selected.position.x,selected.position.y+grabSign*u.height/2,selected.position.z); text=`${mm(u.height)} mm`; }
  else { worldPos.set(selected.position.x,selected.position.y,selected.position.z+grabSign*u.depth/2); text=`${mm(u.depth)} mm`; }
  const p=worldPos.project(camera); if(p.z>1){liveLabel.style.display='none';return;}
  liveLabel.style.left=((p.x*.5+.5)*innerWidth)+'px'; liveLabel.style.top=((-p.y*.5+.5)*innerHeight)+'px'; liveLabel.textContent=text; liveLabel.style.display='block';
}

function moveFree(event){
  if(!selected) return;
  const inferred=inferMoveAxis(event);
  moveInferenceAxis=inferred;

  if(inferred){
    const dir=axisVector(inferred);
    moveAxisDir.copy(dir);
    const t=closestParamOnAxis(movePickPoint,dir);
    selected.position.copy(freeMoveStartPosition).addScaledVector(dir,t);
    showInference(inferred);

    // No eixo inferido, o snap age somente nesse eixo, como uma inferência de CAD.
    const snap=findMoveSnap(selected,inferred);
    if(snap){ selected.position[inferred]+=snap.delta; showGuide(inferred,snap.line); }
    if(inferred!=='x') guideX.visible=false;
    if(inferred!=='y') guideY.visible=false;
    if(inferred!=='z') guideZ.visible=false;
  } else {
    hideInference();
    if(!intersectPlane(freeMovePlane,freeMoveCurrentPoint)) return;
    const delta=freeMoveCurrentPoint.clone().sub(freeMoveStartPoint);
    selected.position.copy(freeMoveStartPosition).add(delta);

    // Movimento livre + snap de faces/centros nos três eixos.
    for(const axis of ['x','y','z']){
      const snap=findMoveSnap(selected,axis);
      if(snap){ selected.position[axis]+=snap.delta; showGuide(axis,snap.line); }
      else if(axis==='x') guideX.visible=false;
      else if(axis==='y') guideY.visible=false;
      else guideZ.visible=false;
    }
  }

  // Inferência estilo CAD: quina -> guia da Trena -> aresta -> face.
  let movedDelta=selected.position.clone().sub(freeMoveStartPosition);
  let currentGrip=movePickPoint.clone().add(movedDelta);
  const target=findMoveInferenceTarget(selected,event);
  if(target){
    if(target.kind==='guide' && moveGrabKind==='face' && target.line?.userData?.axis){
      // Ao mover pela face, a guia pode capturar a lateral/centro da peça,
      // em vez de obrigar apenas o ponto de pega a cair sobre a linha.
      const aligned=snapMovingObjectFeaturesToGuide(selected,target.line);
      movedDelta=selected.position.clone().sub(freeMoveStartPosition);
      currentGrip=movePickPoint.clone().add(movedDelta);
      if(!aligned){
        selected.position.add(target.point.clone().sub(currentGrip));
        movedDelta=selected.position.clone().sub(freeMoveStartPosition);
        currentGrip.copy(target.point);
      }
    } else {
      selected.position.add(target.point.clone().sub(currentGrip));
      movedDelta=selected.position.clone().sub(freeMoveStartPosition);
      currentGrip.copy(target.point);
    }
    moveCornerTarget=target.kind==='corner' ? target.point.clone() : null;
    setMoveTargetMarker(target);
  } else {
    moveCornerTarget=null;
    moveSnapKind=null; moveSnapText='';
    if(moveGrabKind==='corner' || moveGrabKind==='edge'){
      const c=moveGrabKind==='corner' ? 0x34d058 : 0xffd23f;
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
  dragChanged=true;
}

function pullSelected(axis){
  const u=selected.userData;
  const dir=axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  const lp=axis==='x'?new THREE.Vector3(anchorCoord,lockedA,lockedB):axis==='y'?new THREE.Vector3(lockedA,anchorCoord,lockedB):new THREE.Vector3(lockedA,lockedB,anchorCoord);
  let t=closestParamOnAxis(lp,dir);
  let edge=anchorCoord+t;
  const snap=snapFaceCoordinate(selected,axis,edge);
  if(snap){ edge=snap.coord; t=edge-anchorCoord; showGuide(axis,snap.line); } else hideGuides();
  const sign=t===0?grabSign:Math.sign(t);
  const size=clampSize(Math.abs(t));
  grabSign=sign; // mantém o lado correto também para edições posteriores
  if(axis==='x'){
    u.width=size; selected.scale.x=size; selected.position.x=anchorCoord+sign*size/2;
  } else if(axis==='y'){
    u.height=size; selected.scale.y=size; selected.position.y=anchorCoord+sign*size/2;
    if(selected.position.y-u.height/2<0 && sign>0){ selected.position.y=u.height/2; }
  } else {
    u.depth=size; selected.scale.z=size; selected.position.z=anchorCoord+sign*size/2;
  }
  dragChanged=true;
}

renderer.domElement.addEventListener('pointerdown',e=>{
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive()){
    // Visualização é somente leitura: o evento continua livre para o
    // OrbitControls (girar/pan/zoom), mas não inicia seleção nem edição.
    dragMode=null;controls.enabled=true;return;
  }
  // Navegação CAD no PC é tratada pelo OrbitControls.
  // O fluxo de edição abaixo continua exclusivo do botão esquerdo.
  if(e.button!==undefined && e.button!==0) return;

  if(toolMode==='tape'){
    // DOWN só começa o gesto. Arrastar serve para procurar snap; um toque curto
    // é confirmado no UP/END. Isso deixa a mira utilizável como no CAD mobile.
    tapeMouseActive=e.pointerType!=='touch';
    activePointerId=e.pointerId;
    downClientX=e.clientX; downClientY=e.clientY;
    tapePointerMoved=false;
    getPointerNDC(e);
    moveTapeCrosshairRaw(e.clientX,e.clientY);
    controls.enabled=false;
    try { updateTapePreview(e); }
    catch(err){ console.error('Trena pointerdown:',err); }
    return;
  }

  if(e.pointerType==='touch' && e.isPrimary===false) return;
  activePointerId=e.pointerId;
  downClientX=e.clientX; downClientY=e.clientY; gestureLocked=false;
  getPointerNDC(e);
  renderer.domElement.setPointerCapture?.(e.pointerId);
  beginPick();
});

// Fallback para mouse/trackpad: o evento nativo de duplo clique também abre
// o móvel, usando a mesma inferência de vínculo usada no duplo toque mobile.
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
  // O duplo clique continua reservado ao espaço/móvel vinculado.
  // Configuração de peça agora abre ao clicar/tocar e segurar.
  if(toolMode==='select')e.preventDefault();
});

function moveTapeCrosshairRaw(x,y){
  if(toolMode!=='tape' || !Number.isFinite(x) || !Number.isFinite(y)) return;
  tapeCrosshair.style.left=x+'px';
  tapeCrosshair.style.top=y+'px';
  tapeCrosshair.style.display='block';
}

function prepareTapeDown(ev){
  downClientX=ev.clientX; downClientY=ev.clientY;
  tapePointerMoved=false;
  getPointerNDC(ev);
  moveTapeCrosshairRaw(ev.clientX,ev.clientY);
  controls.enabled=false;
  try { updateTapePreview(ev); } catch(err){ console.error('Trena preview:',err); }
}
function handleTapePointerMotion(e){
  if(toolMode!=='tape') return;
  moveTapeCrosshairRaw(e.clientX,e.clientY);
  getPointerNDC(e);
  if(Math.hypot(e.clientX-downClientX,e.clientY-downClientY)>11) tapePointerMoved=true;
  try { updateTapePreview(e); }
  catch(err){ console.error('Trena snap:',err); }
}
function finishTapeInteraction(ev,confirmTap=true){
  if(toolMode!=='tape') return;
  if(Number.isFinite(ev?.clientX) && Number.isFinite(ev?.clientY)){
    moveTapeCrosshairRaw(ev.clientX,ev.clientY);
    try { updateTapePreview(ev); } catch(_) {}
  }
  if(confirmTap && !tapePointerMoved){
    try { handleTapeTap(ev); updateTapePreview(ev); }
    catch(err){ console.error('Trena confirmar:',err); toast('Erro Trena: '+(err?.message || String(err))); }
  }
  controls.enabled=true;
  tapePointerMoved=false;
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
  for(let i=0;i<list.length;i++) if(tapeTouchId===null || list[i].identifier===tapeTouchId) return list[i];
  // Fallback para WebViews que trocam o identifier durante o gesto.
  return list[0] || null;
}

// Android/WebView: Touch Events mantêm a mira fluida. O ponto só é confirmado
// no fim de um toque curto; arrastar serve apenas para posicionar a mira.
window.addEventListener('touchstart',e=>{
  if(toolMode!=='tape' || e.target!==renderer.domElement || !e.changedTouches?.length) return;
  const t=e.changedTouches[0];
  tapeTouchActive=true;
  tapeTouchId=t.identifier;
  tapeLastClientX=t.clientX; tapeLastClientY=t.clientY;
  const ev=touchEventLike(t);
  prepareTapeDown(ev);
  e.preventDefault();
},{capture:true,passive:false});

window.addEventListener('touchmove',e=>{
  if(toolMode!=='tape' || !tapeTouchActive) return;
  const t=findTrackedTouch(e.touches) || findTrackedTouch(e.changedTouches);
  if(!t) return;
  tapeLastClientX=t.clientX; tapeLastClientY=t.clientY;
  handleTapePointerMotion(touchEventLike(t));
  e.preventDefault();
},{capture:true,passive:false});

function finishNativeTapeTouch(e){
  if(toolMode!=='tape' || !tapeTouchActive) return;
  const t=findTrackedTouch(e.changedTouches) || e.changedTouches?.[0] || null;
  const ev=t ? touchEventLike(t) : {
    clientX:tapeLastClientX,clientY:tapeLastClientY,pointerType:'touch',pointerId:tapeTouchId??1,isPrimary:true,button:0
  };
  finishTapeInteraction(ev);
  tapeTouchActive=false;
  tapeTouchId=null;
  controls.enabled=true;
  e.preventDefault();
}
window.addEventListener('touchend',finishNativeTapeTouch,{capture:true,passive:false});
window.addEventListener('touchcancel',finishNativeTapeTouch,{capture:true,passive:false});

// Mouse/caneta usam Pointer Events; toque não entra aqui.
window.addEventListener('pointermove',e=>{
  if(toolMode!=='tape') return;
  handleTapePointerMotion(e);
},{capture:true,passive:false});

window.addEventListener('pointerup',e=>{
  if(toolMode!=='tape') return;
  // Fallback para WebViews que entregam PointerEvent mas não TouchEvent.
  finishTapeInteraction(e,true);
  tapeMouseActive=false;
  activePointerId=null;
},{capture:true,passive:false});
window.addEventListener('pointercancel',e=>{
  if(toolMode!=='tape') return;
  finishTapeInteraction(e,true);
  tapeMouseActive=false;
  activePointerId=null;
},{capture:true,passive:false});

renderer.domElement.addEventListener('pointermove',e=>{
  if(toolMode==='tape') return;
  if(activePointerId!==null && e.pointerId!==activePointerId) return;
  cancelPieceLongPressOnMove(e);
  cancelSpaceLongPressOnMove(e);
  getPointerNDC(e);

  if(!dragMode) return;
  if(dragMode!=='space-free' && !selected) return;
  if(e.pointerType==='touch' && !gestureLocked){
    const dist=Math.hypot(e.clientX-downClientX,e.clientY-downClientY);
    if(dist<REAIM_THRESHOLD_PX){ return; }
    gestureLocked=true;
  }
  if(dragMode==='space-free') moveSpaceFree();
  else if(dragMode==='free') moveFree(e);
  else if(dragMode.startsWith('pull-')) pullSelected(dragMode.slice(-1));
  else if(dragMode==='radius'){
    const p=selected.position.clone(); const t=closestParamOnAxis(p,radiusDir); const d=clampSize(Math.abs(t)*2);
    selected.userData.width=d; selected.userData.depth=d; selected.scale.x=d; selected.scale.z=d; dragChanged=true;
  }
  updateMeasureBadge(); if(selected){updateInspector(); updateLiveLabel();}
});

function endDrag(e){
  if(e && activePointerId!==null && e.pointerId!==activePointerId) return;
  if(dragMode==='space-free' && movingSpaceRoot){
    const keepRootId=movingSpaceRoot.id, keepCellId=selectedSpaceCell?.cellId;
    if(movingSpaceRoot.group) movingSpaceRoot.group.position.set(0,0,0);
    renderSpaces();
    if(keepCellId && getSpaceCell(keepRootId,keepCellId)) selectSpaceCellByIds(keepRootId,keepCellId);
    movingSpaceRoot=null; movingSpaceRootStart=null; movingSpaceCellStarts=[]; movingSpaceObjectStarts=[];
  }
  if(selected) setAllFaces(selected,COLORS.selected);
  controls.enabled=true; activePointerId=null; dragMode=null; gestureLocked=false; liveLabel.style.display='none'; moveGrip.visible=false; moveGrabIsCorner=false; moveGrabKind='face'; moveCornerTarget=null; moveSnapKind=null; moveSnapText=''; hideGuides();
  if(dragChanged && dragStartState!==stateString()) commitHistory();
  if(dragChanged) renderMachiningVisuals();
  dragChanged=false; dragStartState=null;
}

renderer.domElement.addEventListener('pointerup',e=>{
  if(toolMode==='tape') return;
  cancelPieceLongPress();
  cancelSpaceLongPress();
  endDrag(e);
});
renderer.domElement.addEventListener('pointercancel',e=>{
  if(toolMode==='tape') return;
  cancelPieceLongPress();
  cancelSpaceLongPress();
  endDrag(e);
});



// ============================================================================
// 1.100.35 · ESPESSURA DECIMAL SALVA NO "CRIAR PEÇAS"
// ============================================================================
//
// A espessura escolhida pelo usuário é lembrada por:
//   conta + material padrão do espaço.
//
// Exemplo: MDF Branco cadastrado como 18 mm, mas o usuário trabalha com
// 18.5 mm reais. Depois de informar 18.5 uma vez, esse material passa a abrir
// com 18.5 mm para aquela conta em qualquer aparelho.
//
const PIECE_THICKNESS_PREFS_KEY='designlab-piece-thickness-v135';

function pieceThicknessOwnerKey(){
  try{
    const id=typeof projectCurrentOwnerId==='function'?projectCurrentOwnerId():'';
    if(id)return String(id);
  }catch{}
  return 'local-device';
}
function pieceThicknessMaterialKey(root){
  return String(root?.defaultMaterialId||'sem-material');
}
function pieceThicknessStorageKey(root){
  return `${PIECE_THICKNESS_PREFS_KEY}:${pieceThicknessOwnerKey()}:${pieceThicknessMaterialKey(root)}`;
}
function readPieceThicknessPreference(root){
  const material=spaceDefaultMaterial(root);
  const materialThickness=Number(material?.thickness);
  const fallback=Number.isFinite(materialThickness)&&materialThickness>0?materialThickness:18;

  try{
    const saved=Number(localStorage.getItem(pieceThicknessStorageKey(root)));
    return Number.isFinite(saved)&&saved>=1?saved:fallback;
  }catch{
    return fallback;
  }
}
function savePieceThicknessPreference({silent=true}={}){
  const info=selectedCellInfo();
  const root=info?.root||activeSpaceRoot();
  if(!root)return false;

  const raw=String($('pieceThickness')?.value??'').trim().replace(',','.');
  const value=Number(raw);
  if(!Number.isFinite(value)||value<1)return false;

  try{
    // String(Number) mantém 18.5 como 18.5; não arredonda para inteiro.
    localStorage.setItem(pieceThicknessStorageKey(root),String(value));
    if(!silent)toast(`Espessura ${nice(value)} mm salva`);
    return true;
  }catch{
    if(!silent)toast('Não foi possível salvar a espessura');
    return false;
  }
}
function applySavedPieceThickness(root){
  const value=readPieceThicknessPreference(root);
  $('pieceThickness').value=String(value);
  $('pieceThickness').dataset.savedValue=String(value);
}


