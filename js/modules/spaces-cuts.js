// DesignLabMoveis 1.310.00 · Espaços, cortes e redimensionamento estrutural.
export function createSpacesCutsModule(ctx){
  const { $, THREE, scene, COLORS, controls, perspectiveCamera, orthoCamera, m, mm, nice, escapeHtml, spaceMaterialText, toast, clampSize, uid, spaceSelectionKey, SPACE_HEAL_TOL, updateSpaceMultiSelectBar, applyVisualSceneState, applyAllDoorVisibility, renderMachiningVisuals, isDoorObject, doorObjectShouldBeVisible, restoreBaseColor, selectObject, commitHistory, designLabVisualizationOnlyActive, openPieceInspector, hideGuides, updateDoorsToggleButton, updateMeasureBadge, objectBelongsToRoot, selectedFurnitureRoot, canonicalFactoryMaterialId, resetSpaceDoubleTap, restoreTechnical2DTransparency, setVisualMode, frameFurnitureVisual, remember3DView, orthographicFrustum, useCamera, setViewModeBadge, applyTechnical2DTransparency, returnTo3D, cellBox, addFixedBandForCell, mergeIntervals, pieceThicknessInfo, productionMaterialById, productionMaterialUsesPieceThickness, fixedIntervalsFromSpace, structuralFixedIntervalsFromRoot, makeBalancedSpaceAxisMapper, normalizePieceManualGeometryDelta, remapMachiningForPieceResize, rebuildFormGeometry, sanitizeMachiningForPiece, rebuildDrawerSetsForRoot, applyDoorVisibility, getBounds, removeHardwareLinkedToObjects, sameCellTangents, almostSpace, cellAxisMax, cellAxisMin, boxAxisMin, axisCellMinKey, axisCellMaxKey, selectedCellEditPair, cellTangentWithin, cellTangentOverlapArea, cellTangentFaceArea, mergedCellFromPair, setCellAxisMin, setCellAxisMax, removeDrawerSet }=ctx;
  const runtimeModel=ctx.runtimeModel;
function getSpaceRoot(id){ return runtimeModel.spaceRoots.find(r=>r.id===id) || null; }
function getSpaceCell(rootId,cellId){ const r=getSpaceRoot(rootId); return r?.cells.find(c=>c.id===cellId) || null; }
function cellSize(c){ return {width:c.maxX-c.minX, depth:c.maxZ-c.minZ, height:c.maxY-c.minY}; }
function cellCenter(c){ return new THREE.Vector3((c.minX+c.maxX)/2,(c.minY+c.maxY)/2,(c.minZ+c.maxZ)/2); }
function disposeSpaceMeshes(){
  // Limpa TODOS os grupos de espaço que ainda estiverem na cena, inclusive
  // grupos órfãos de um espaço que já foi removido de spaceRoots.
  const groups = scene.children.filter(o=>o?.userData?.isSpaceRoot);
  for(const group of groups){
    group.traverse(o=>{
      if(o.isMesh || o.isLineSegments || o.isLine){
        o.geometry?.dispose?.();
        if(Array.isArray(o.material)) o.material.forEach(m=>m?.dispose?.());
        else o.material?.dispose?.();
      }
    });
    scene.remove(group);
  }
  for(const root of runtimeModel.spaceRoots) root.group=null;
  runtimeModel.spacePickMeshes.length=0;
}
function updateSpaceSelectionVisuals(){
  for(const mesh of runtimeModel.spacePickMeshes){
    const key=spaceSelectionKey(mesh.userData.spaceRootId,mesh.userData.spaceCellId);
    const multiActive=runtimeModel.selectedSpaceCells.has(key);
    const active=multiActive || (!!ctx.selectedSpaceCell && mesh.userData.spaceRootId===ctx.selectedSpaceCell.rootId && mesh.userData.spaceCellId===ctx.selectedSpaceCell.cellId);

    // 1.100.30:
    // - o espaço INATIVO continua claramente reconhecível;
    // - o selecionado fica mais forte;
    // - DoubleSide facilita enxergar o volume aberto de qualquer ângulo;
    // - depthTest continua ligado, então nada atravessa MDF quando o Raio-X está desligado.
    mesh.material.opacity=active ? .30 : .065;
    mesh.material.side=THREE.DoubleSide;
    mesh.material.depthTest=true;
    mesh.material.depthWrite=false;
    mesh.material.needsUpdate=true;
    mesh.renderOrder=active?18:8;

    const edge=mesh.userData.spaceEdges;
    if(edge){
      const cell=getSpaceCell(mesh.userData.spaceRootId,mesh.userData.spaceCellId);
      const isFixed=!!(cell?.fixedAxes && (cell.fixedAxes.x||cell.fixedAxes.y||cell.fixedAxes.z));

      // Contorno do espaço selecionado é forte, mas só onde estiver realmente
      // visível para a câmera. Nada de linhas verdes atravessando as chapas.
      edge.material.color.set(active?0x16a34a:(isFixed?0xffc107:0x4f8995));
      edge.material.opacity=active?1:.48;
      edge.material.depthTest=true;
      edge.material.depthWrite=false;
      edge.material.needsUpdate=true;
      edge.renderOrder=active?19:7;
    }
  }
}
function renderSpaces(){
  disposeSpaceMeshes();
  for(const root of runtimeModel.spaceRoots){
    const group=new THREE.Group(); group.userData.isSpaceRoot=true; root.group=group; group.visible=!ctx.visualMode&&!ctx.quickSpacesHidden; scene.add(group);

    // 1.100.96: o espaço criado originalmente continua sendo o espaço PRINCIPAL.
    // Os cortes são apenas subdivisões independentes dentro dele. O contorno
    // principal fica como referência e não participa da seleção.
    const rootOutlineMat=new THREE.LineBasicMaterial({
      color:0x6b8790, transparent:true, opacity:.22, depthTest:true, depthWrite:false
    });
    const rootOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),rootOutlineMat);
    rootOutline.scale.set(root.width,root.height,root.depth);
    rootOutline.position.set(root.x,root.yBase+root.height/2,root.z);
    rootOutline.renderOrder=5;
    rootOutline.userData={kind:'space-root-outline',spaceRootId:root.id};
    group.add(rootOutline);

    for(const c of root.cells){
      // v34: cada divisão pode ser ocultada individualmente.
      // A divisão oculta deixa de ser desenhada e também deixa de participar
      // da seleção/snap, mas as outras divisões do mesmo espaço continuam visíveis.
      if(c.hidden) continue;
      const sz=cellSize(c), ctr=cellCenter(c);
      const mat=new THREE.MeshBasicMaterial({
        color:COLORS.space,
        transparent:true,
        opacity:.065,
        side:THREE.DoubleSide,
        depthWrite:false,
        depthTest:true
      });
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
      mesh.scale.set(sz.width,sz.height,sz.depth); mesh.position.copy(ctr);
      mesh.userData={kind:'space-cell',name:root.name,width:sz.width,depth:sz.depth,height:sz.height,baseColor:COLORS.space,faceMaterials:[mat],spaceRootId:root.id,spaceCellId:c.id};
      const isFixed=!!(c.fixedAxes && (c.fixedAxes.x||c.fixedAxes.y||c.fixedAxes.z));
      const edgeMat=new THREE.LineBasicMaterial({
        color:isFixed?0xffc107:0x4f8995,
        transparent:true,
        opacity:.48,
        depthTest:true,
        depthWrite:false
      });
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),edgeMat);
      edges.scale.copy(mesh.scale); edges.position.copy(mesh.position); edges.renderOrder=7;
      mesh.userData.spaceEdges=edges; mesh.renderOrder=8;
      group.add(mesh,edges); runtimeModel.spacePickMeshes.push(mesh);
    }
  }
  updateSpaceSelectionVisuals();
  updateSpaceMultiSelectBar();
  if(ctx.visualMode)applyVisualSceneState();
}
function referenceMeshes(exclude=null){ return [...runtimeModel.objects,...runtimeModel.spacePickMeshes].filter(o=>o!==exclude && o.visible!==false); }
function applyQuickFrontVisibility(hidden,{notify=false}={}){
  ctx.quickFrontFacesHidden=!!hidden;
  applyAllDoorVisibility();
  if(typeof renderMachiningVisuals==='function')renderMachiningVisuals();
  if(notify)toast(ctx.quickFrontFacesHidden?'Portas e frentes de gaveta ocultadas':'Portas e frentes de gaveta exibidas');
}
// 1.200.98 · ocultação manual de peças.
// É somente visual no CAD: não remove a peça e não altera a lista/plano de corte.
function isManuallyHideablePiece(o){
  return !!o && runtimeModel.objects.includes(o) && o.userData?.kind!=='hardware-visual';
}
function manuallyHiddenPieces(){
  return runtimeModel.objects.filter(o=>!!o.userData?.hiddenByUser);
}
function syncManualPieceVisibilityButtons(){
  const showBtn=$('cadShowHiddenPiecesQuick');
  const hideBtn=$('cadHideSelectedPieceQuick');
  const count=manuallyHiddenPieces().length;
  if(showBtn){
    showBtn.disabled=count===0;
    showBtn.classList.toggle('active',count>0);
    showBtn.textContent=count?`◩ Mostrar peças (${count})`:'◩ Mostrar peças';
    showBtn.title=count?`Mostrar ${count} peça(s) ocultada(s) manualmente`:'Nenhuma peça está ocultada manualmente';
  }
  if(hideBtn){
    const canHide=isManuallyHideablePiece(ctx.selected)&&ctx.selected.visible!==false;
    hideBtn.classList.toggle('active',canHide);
    hideBtn.title=canHide?`Ocultar ${ctx.selected.userData?.name||'peça'} somente no CAD`:'Selecione uma peça visível para ocultar';
  }
}
function applyManualVisibilityToObject(o){
  if(!o)return;
  if(o.userData?.hiddenByUser){
    o.visible=false;
  }else if(isDoorObject(o)){
    const root=o.userData?.spaceRootId?getSpaceRoot(o.userData.spaceRootId):null;
    o.visible=doorObjectShouldBeVisible(o,root);
    o.userData.hiddenByDoors=!o.visible;
  }else if(o.userData?.kind==='hardware-visual'){
    o.visible=!!ctx.cadHardwareVisible;
  }else{
    o.visible=true;
  }
  if(o.userData?.visualEdges)o.userData.visualEdges.visible=o.visible!==false;
}
function hideSelectedPieceQuick(){
  if(!ctx.selected){toast('Selecione a peça que deseja ocultar');return false;}
  if(!isManuallyHideablePiece(ctx.selected)){toast('Selecione uma peça do móvel');return false;}
  const o=ctx.selected,name=o.userData?.name||'Peça';
  o.userData.hiddenByUser=true;
  o.visible=false;
  if(o.userData?.visualEdges)o.userData.visualEdges.visible=false;
  restoreBaseColor(o);
  selectObject(null);
  if(typeof renderMachiningVisuals==='function')renderMachiningVisuals();
  syncManualPieceVisibilityButtons();
  commitHistory();
  toast(`${name} ocultada · continua na produção`);
  return true;
}
function showAllManuallyHiddenPieces(){
  const hidden=manuallyHiddenPieces();
  if(!hidden.length){toast('Nenhuma peça oculta');syncManualPieceVisibilityButtons();return false;}
  for(const o of hidden){o.userData.hiddenByUser=false;applyManualVisibilityToObject(o);}
  if(typeof renderMachiningVisuals==='function')renderMachiningVisuals();
  syncManualPieceVisibilityButtons();
  commitHistory();
  toast(`${hidden.length} peça(s) exibida(s)`);
  return true;
}
function hasIndividuallyHiddenSpaces(){
  return runtimeModel.spaceRoots.some(root=>!!root.spaceHidden || (root.cells||[]).some(c=>!!c.hidden));
}
function syncQuickSpaceVisibilityButton(){
  const btn=$('cadSpaceQuickToggle');if(!btn)return;
  // 1.200.95: se QUALQUER divisão foi ocultada individualmente, o botão geral
  // já vira "Mostrar espaços". Ao mostrar, todos os espaços do projeto voltam.
  const hasHidden=!!ctx.quickSpacesHidden || hasIndividuallyHiddenSpaces();
  btn.classList.toggle('active',hasHidden);
  btn.setAttribute('aria-pressed',hasHidden?'true':'false');
  btn.textContent=hasHidden?'▰ Mostrar espaços':'▱ Ocultar espaços';
  btn.title=hasHidden?'Mostrar TODOS os espaços e divisões do projeto':'Ocultar os volumes dos espaços';
}
function applyQuickSpaceVisibility(hidden,{notify=false}={}){
  ctx.quickSpacesHidden=!!hidden;
  const showSpaces=!ctx.quickSpacesHidden&&!ctx.visualMode;
  for(const root of runtimeModel.spaceRoots){
    if(root.group)root.group.visible=showSpaces;
  }
  for(const mesh of runtimeModel.spacePickMeshes){
    mesh.visible=showSpaces;
    if(mesh.userData?.spaceEdges)mesh.userData.spaceEdges.visible=showSpaces;
  }
  syncQuickSpaceVisibilityButton();
  if(notify)toast(ctx.quickSpacesHidden?'Espaços ocultados':'Espaços exibidos');
}
function showAllSpacesGeneral({notify=true}={}){
  const wasGloballyHidden=!!ctx.quickSpacesHidden;
  let restored=0;
  ctx.quickSpacesHidden=false;
  for(const root of runtimeModel.spaceRoots){
    if(root.spaceHidden){root.spaceHidden=false;restored++;}
    for(const c of (root.cells||[])){
      if(c.hidden){c.hidden=false;restored++;}
    }
  }
  renderSpaces();
  syncQuickSpaceVisibilityButton();
  updateSpaceVisibilityToggleButton();
  // hidden das divisões faz parte do projeto; esconder tudo pelo botão geral é só visual.
  if(restored)commitHistory();
  if(notify)toast((restored||wasGloballyHidden)?'Todos os espaços foram exibidos':'Todos os espaços já estão visíveis');
}
function quickToggleAllSpaces(){
  if(ctx.quickSpacesHidden || hasIndividuallyHiddenSpaces()){
    showAllSpacesGeneral({notify:true});
  }else{
    applyQuickSpaceVisibility(true,{notify:true});
  }
}
function hideQuickSelectedSpace(){
  if(!ctx.selectedSpaceCell){toast('Selecione o espaço que deseja ocultar');return false;}
  // Se o projeto inteiro estava oculto, não existe seleção utilizável. Mantemos a
  // ação individual independente e fazemos o botão geral refletir o novo estado.
  toggleActiveSpaceVisibility();
  syncQuickSpaceVisibilityButton();
  return true;
}

// 1.200.95 · botão Configuração é o único caminho rápido para abrir a configuração.
// Espaço selecionado abre o menu completo (Corte, Peças, Biblioteca etc.);
// peça selecionada abre o inspetor/configuração da própria peça.
function openQuickSelectedConfiguration(){
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive())return false;
  if(ctx.selectedSpaceCell){
    const root=getSpaceRoot(ctx.selectedSpaceCell.rootId),cell=getSpaceCell(ctx.selectedSpaceCell.rootId,ctx.selectedSpaceCell.cellId);
    if(root&&cell){
      selectSpaceCellByIds(root.id,cell.id,{showMenu:false});
      const sz=cellSize(cell);
      const info=$('spaceMoreInfo');
      if(info)info.textContent=`${root.name} · L ${mm(sz.width)} · P ${mm(sz.depth)} · A ${mm(sz.height)} mm`;
      const dlg=$('spaceMoreDialog');
      if(dlg)dlg.style.display='flex';
      toast('Configuração do espaço');
      return true;
    }
  }
  if(ctx.selected){
    openPieceInspector(ctx.selected);
    toast('Configuração da peça');
    return true;
  }
  if(ctx.activeSpaceRootId){
    const root=getSpaceRoot(ctx.activeSpaceRootId);
    if(root){
      selectSpaceRootOnly(root,{showMenu:false});
      const info=$('spaceMoreInfo');if(info)info.textContent=`${root.name} · L ${mm(root.width)} · P ${mm(root.depth)} · A ${mm(root.height)} mm · móvel completo`;
      const dlg=$('spaceMoreDialog');if(dlg)dlg.style.display='flex';
      toast('Configuração do móvel');return true;
    }
  }
  toast('Selecione um espaço ou uma peça');
  return false;
}
function updateSpaceVisibilityToggleButton(){
  const btn=$('toggleSpaceBtn');
  if(btn)btn.textContent='Ocultar divisão';
  const direct=$('hideSelectedSpaceBtn');
  if(direct)direct.textContent='◫ Ocultar selecionado';
}
function largestVisibleCell(root){
  if(!root) return null;
  let best=null, bestVol=-1;
  for(const c of root.cells){
    if(c.hidden) continue;
    const sz=cellSize(c), vol=sz.width*sz.depth*sz.height;
    if(vol>bestVol){ bestVol=vol; best=c; }
  }
  return best;
}
function spaceCellLabel(root,cell){
  const cells=root?.cells||[];
  const idx=Math.max(0,cells.findIndex(c=>c.id===cell?.id));
  return cells.length<=1?'principal':`corte ${idx+1} de ${cells.length}`;
}
function nearestVisibleCell(root,sourceCell){
  const visible=(root?.cells||[]).filter(c=>!c.hidden && c.id!==sourceCell?.id);
  if(!visible.length)return null;
  const sc=cellCenter(sourceCell);
  // Primeiro favorece um corte que ocupe a mesma região frontal (X/Y),
  // útil para ocultar uma faixa de porta e cair direto no vão atrás dela.
  let best=null,bestScore=Infinity;
  for(const c of visible){
    const cc=cellCenter(c);
    const overlapX=Math.max(0,Math.min(sourceCell.maxX,c.maxX)-Math.max(sourceCell.minX,c.minX));
    const overlapY=Math.max(0,Math.min(sourceCell.maxY,c.maxY)-Math.max(sourceCell.minY,c.minY));
    const sameFace=overlapX>1e-6 && overlapY>1e-6;
    const dx=cc.x-sc.x,dy=cc.y-sc.y,dz=cc.z-sc.z;
    const dist=dx*dx+dy*dy+dz*dz;
    const score=dist+(sameFace?0:1000);
    if(score<bestScore){bestScore=score;best=c;}
  }
  return best||visible[0];
}
function toggleActiveSpaceVisibility(){
  if(!ctx.selectedSpaceCell){ toast('Selecione a divisão que deseja ocultar'); return; }
  const root=getSpaceRoot(ctx.selectedSpaceCell.rootId);
  const cell=getSpaceCell(ctx.selectedSpaceCell.rootId,ctx.selectedSpaceCell.cellId);
  if(!root || !cell){ toast('Divisão não encontrada'); return; }

  // Oculta somente a divisão clicada. As peças ligadas ao espaço permanecem visíveis.
  cell.hidden=true;
  const rootId=root.id;
  renderSpaces();
  syncQuickSpaceVisibilityButton();

  // Depois de esconder o corte atual, tenta selecionar o corte mais próximo.
  // Em cortes de frente/trás isso normalmente leva direto ao espaço de dentro.
  const next=nearestVisibleCell(root,cell);
  if(next) selectSpaceCellByIds(rootId,next.id);
  else selectSpaceRootOnly(root);

  commitHistory();
  toast('Corte ocultado · espaço principal mantido');
}
function showAllHiddenSpaces(){
  showAllSpacesGeneral({notify:true});
}

function setSpaceActionCellMode(hasCell){
  for(const id of ['cutSpaceBtn','createPiecesBtn','openLibraryBtn','hideSelectedSpaceBtn','editSelectedSpaceBtn','deleteSelectedSpaceBtn']){
    const b=$(id);if(b)b.disabled=!hasCell;
  }
}
function selectSpaceRootOnly(root,{showMenu}={}){
  if(!root){ clearSpaceSelection(); return; }
  const panel=$('spaceActions');
  const wasOpen=panel?.style.display==='block';
  if(ctx.selected){ restoreBaseColor(ctx.selected); ctx.selected=null; }
  ctx.lastEdit=null; runtimeModel.liveLabel.style.display='none'; hideGuides(); $('inspector').style.display='none';
  ctx.selectedSpaceCell=null; ctx.activeSpaceRootId=root.id; updateSpaceSelectionVisuals();
  $('spaceActionTitle').textContent=root.name+' · principal';
  $('spaceActionDims').innerHTML=`L ${mm(root.width)} · P ${mm(root.depth)} · A ${mm(root.height)} mm<br><span style="color:var(--muted)">Espaço principal · selecione um corte para editar/ocultar</span>`;
  if(panel)panel.style.display=(showMenu===undefined?wasOpen:!!showMenu)?'block':'none';
  setSpaceActionCellMode(false); updateDoorsToggleButton(root); updateSpaceVisibilityToggleButton(root); updateMeasureBadge();
}
function distanceSqPointToCell(point,c){
  const dx=point.x<c.minX?c.minX-point.x:point.x>c.maxX?point.x-c.maxX:0;
  const dy=point.y<c.minY?c.minY-point.y:point.y>c.maxY?point.y-c.maxY:0;
  const dz=point.z<c.minZ?c.minZ-point.z:point.z>c.maxZ?point.z-c.maxZ:0;
  return dx*dx+dy*dy+dz*dz;
}
function bestVisibleCellForObject(root,obj=null){
  const cells=(root?.cells||[]).filter(c=>!c.hidden);
  if(!cells.length)return null;
  if(!obj)return largestVisibleCell(root);
  const p=obj.position.clone();
  return cells.reduce((best,c)=>distanceSqPointToCell(p,c)<distanceSqPointToCell(p,best)?c:best,cells[0]);
}
function rootForObject(obj){
  if(!obj)return null;
  const rootId=obj.userData?.spaceRootId;
  if(rootId){ const r=getSpaceRoot(rootId); if(r)return r; }
  return runtimeModel.spaceRoots.find(r=>objectBelongsToRoot(obj,r))||null;
}
function openSpaceFromObject(obj=null){
  obj=obj||ctx.selected;
  const root=rootForObject(obj)||selectedFurnitureRoot();
  if(!root){ toast('Selecione uma peça que pertença a um móvel'); return false; }
  const cell=bestVisibleCellForObject(root,obj);
  if(cell) selectSpaceCellByIds(root.id,cell.id,{showMenu:true});
  else selectSpaceRootOnly(root,{showMenu:true});
  $('morePanel').style.display='none';
  toast(cell ? `Espaço aberto · ${root.name}` : `Móvel aberto · ${root.name}`);
  return true;
}
function activeSpaceRoot(){
  if(ctx.selectedSpaceCell){ const r=getSpaceRoot(ctx.selectedSpaceCell.rootId); if(r)return r; }
  if(ctx.activeSpaceRootId){ const r=getSpaceRoot(ctx.activeSpaceRootId); if(r)return r; }
  return selectedFurnitureRoot();
}

function clearSpaceSelection(){
  ctx.selectedSpaceCell=null; ctx.activeSpaceRootId=null; runtimeModel.selectedSpaceCells.clear(); ctx.doorRegionSelectionMode=false;
  $('spaceActions').style.display='none'; setSpaceActionCellMode(true); updateDoorsToggleButton(null); updateSpaceVisibilityToggleButton(null);
  updateSpaceSelectionVisuals(); updateSpaceMultiSelectBar();
}
function selectSpaceCellByIds(rootId,cellId,{showMenu,preserveMulti=false}={}){
  const panel=$('spaceActions');
  if(!preserveMulti&&runtimeModel.selectedSpaceCells.size){runtimeModel.selectedSpaceCells.clear();ctx.doorRegionSelectionMode=false;updateSpaceMultiSelectBar();}
  const wasOpen=panel?.style.display==='block';
  if(ctx.selected){ restoreBaseColor(ctx.selected); ctx.selected=null; }
  ctx.lastEdit=null; runtimeModel.liveLabel.style.display='none'; hideGuides(); $('inspector').style.display='none';
  const root=getSpaceRoot(rootId), cell=getSpaceCell(rootId,cellId); if(!root||!cell){clearSpaceSelection();updateMeasureBadge();return;}
  ctx.selectedSpaceCell={rootId,cellId}; ctx.activeSpaceRootId=rootId; updateSpaceSelectionVisuals();
  const sz=cellSize(cell); const cutLabel=spaceCellLabel(root,cell); $('spaceActionTitle').textContent=root.name+' · '+cutLabel;
  const fixed=[]; if(cell.fixedAxes?.x)fixed.push(`X ${mm(sz.width)} mm`); if(cell.fixedAxes?.y)fixed.push(`Y ${mm(sz.height)} mm`); if(cell.fixedAxes?.z)fixed.push(`Z ${mm(sz.depth)} mm`);
  $('spaceActionDims').innerHTML=`L ${mm(sz.width)} · P ${mm(sz.depth)} · A ${mm(sz.height)} mm${root.cells.length>1?`<br><span style="color:var(--muted)">Corte individual do espaço principal</span>`:''}${fixed.length?`<br><span class="fixedBadge">🔒 Fixo: ${fixed.join(' · ')}</span>`:''}<br><span style="color:#9fd6ac">🧱 ${escapeHtml(spaceMaterialText(root))}</span>`;
  if(panel)panel.style.display=(showMenu===undefined?wasOpen:!!showMenu)?'block':'none';
  setSpaceActionCellMode(true); updateDoorsToggleButton(root); updateSpaceVisibilityToggleButton(root); updateMeasureBadge();
}
function createSpace({width=1,depth=.6,height=.9,x=0,yBase=0,z=0,name='Espaço',defaultMaterialId=null,doorSystem=null}={},doHistory=true){
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  // O chão do projeto é Y=0. Espaços de mobiliário nunca nascem abaixo dele.
  yBase=Math.max(0,Number(yBase)||0);
  const root={id:uid('space'),name,width,depth,height,x,yBase,z,defaultMaterialId:canonicalFactoryMaterialId(defaultMaterialId)||null,doorsHidden:false,spaceHidden:false,doorSystem:doorSystem?JSON.parse(JSON.stringify(doorSystem)):null,fixedBands:{x:[],y:[],z:[]},cells:[{id:uid('cell'),hidden:false,fixedAxes:{},minX:x-width/2,maxX:x+width/2,minY:yBase,maxY:yBase+height,minZ:z-depth/2,maxZ:z+depth/2}]};
  runtimeModel.spaceRoots.push(root); renderSpaces();
  // 1.100.96: criar o espaço principal apenas o seleciona. O menu nunca abre
  // automaticamente; toque e segure o espaço para abrir as opções.
  selectSpaceCellByIds(root.id,root.cells[0].id,{showMenu:false});
  resetSpaceDoubleTap();
  frontViewToSpace(root);
  if(doHistory) commitHistory(); return root;
}
function createSpaceFromState(data){
  const legacyWholeHidden=!!data.spaceHidden;
  const root={id:data.id||uid('space'),name:data.name||'Espaço',width:data.width,depth:data.depth,height:data.height,x:data.x||0,yBase:data.yBase||0,z:data.z||0,defaultMaterialId:canonicalFactoryMaterialId(data.defaultMaterialId)||null,doorsHidden:!!data.doorsHidden,spaceHidden:false,doorSystem:data.doorSystem?JSON.parse(JSON.stringify(data.doorSystem)):null,fixedBands:{x:(data.fixedBands?.x||[]).map(v=>[...v]),y:(data.fixedBands?.y||[]).map(v=>[...v]),z:(data.fixedBands?.z||[]).map(v=>[...v])},cells:(data.cells||[]).map(c=>({...c,id:c.id||uid('cell'),hidden:!!c.hidden||legacyWholeHidden,fixedAxes:{...(c.fixedAxes||{})},manualCut:c.manualCut?JSON.parse(JSON.stringify(c.manualCut)):null}))};
  if(!root.cells.length) root.cells=[{id:uid('cell'),hidden:legacyWholeHidden,fixedAxes:{},minX:root.x-root.width/2,maxX:root.x+root.width/2,minY:root.yBase,maxY:root.yBase+root.height,minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2}];
  runtimeModel.spaceRoots.push(root); return root;
}
function viewSpace(root=null,view='front'){
  restoreTechnical2DTransparency();
  if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
  let center=new THREE.Vector3(0,.8,0), w=2.2, h=1.6, depth=2.2;
  if(root){
    center.set(root.x,root.yBase+root.height/2,root.z);
    if(view==='left'||view==='right'){w=root.depth;h=root.height;depth=root.width;}
    else if(view==='top'||view==='bottom'){w=root.width;h=root.depth;depth=root.height;}
    else {w=root.width;h=root.height;depth=root.depth;}
  }
  if(ctx.camera===perspectiveCamera&&!ctx.viewMode2D)remember3DView();
  orthographicFrustum(w,h);
  const dist=Math.max(5,depth*4,Math.max(w,h)*3);
  orthoCamera.up.set(0,1,0);
  if(view==='back') orthoCamera.position.set(center.x,center.y,center.z-dist);
  else if(view==='left') orthoCamera.position.set(center.x-dist,center.y,center.z);
  else if(view==='right') orthoCamera.position.set(center.x+dist,center.y,center.z);
  else if(view==='top'){ orthoCamera.up.set(0,0,-1); orthoCamera.position.set(center.x,center.y+dist,center.z); }
  else if(view==='bottom'){ orthoCamera.up.set(0,0,1); orthoCamera.position.set(center.x,center.y-dist,center.z); }
  else orthoCamera.position.set(center.x,center.y,center.z+dist);
  controls.target.copy(center);
  orthoCamera.lookAt(center);
  ctx.viewMode2D=true; ctx.current2DView=view;
  useCamera(orthoCamera);
  setViewModeBadge(view);
  applyTechnical2DTransparency(root,view);
  const names={front:'frontal',back:'traseira',left:'lateral esquerda',right:'lateral direita',top:'superior',bottom:'inferior'};
  toast(`Vista ${names[view]||'2D'} · X-Ray interno`);
}
function perspectiveFrontToSpace(root=null){
  returnTo3D({restore:false,notify:false});
  let center=new THREE.Vector3(0,.8,0), span=2.2;
  if(root){center.set(root.x,root.yBase+root.height/2,root.z);span=Math.max(root.width,root.height,root.depth);}
  const dist=Math.max(2.4,span*2.15);
  perspectiveCamera.up.set(0,1,0);
  perspectiveCamera.position.set(center.x+dist*.55,center.y+dist*.45,center.z+dist);
  controls.target.copy(center); perspectiveCamera.lookAt(center); controls.update(); remember3DView();
}
function frontViewToSpace(root=null){ perspectiveFrontToSpace(root); }
function setFrontWorldView(){
  returnTo3D({restore:false,notify:false});
  perspectiveCamera.up.set(0,1,0);
  perspectiveCamera.position.set(3.4,2.8,4.8);
  controls.target.set(0,.8,0); perspectiveCamera.lookAt(controls.target); controls.update(); remember3DView();
}

// 1.200.90 · divisão automática do vão em N partes iguais quando a medida = 0.
// A divisão é gravada como uma sequência de cortes reais, preservando a árvore
// manualCut usada para editar vãos antigos/descendentes e para histórico.
function divideSelectedSpaceEvenly(side,count,isFixed=false){
  if(!ctx.selectedSpaceCell)return {ok:false};
  const root=getSpaceRoot(ctx.selectedSpaceCell.rootId),cell=getSpaceCell(ctx.selectedSpaceCell.rootId,ctx.selectedSpaceCell.cellId);
  if(!root||!cell)return {ok:false};
  count=Math.round(Number(count));
  if(!Number.isFinite(count)||count<1||count>50){toast('Quantidade de vãos: use de 1 a 50');return {ok:false};}
  if(count===1)return {ok:true,noCut:true,count:1};

  const axis=(side==='left'||side==='right')?'x':((side==='front'||side==='back')?'z':'y');
  const minK=axis==='x'?'minX':axis==='y'?'minY':'minZ';
  const maxK=axis==='x'?'maxX':axis==='y'?'maxY':'maxZ';
  const lowSide=side==='left'||side==='bottom'||side==='back';
  const originalMin=Number(cell[minK]),originalMax=Number(cell[maxK]);
  const total=originalMax-originalMin;
  if(!(total>.001*count)){toast(`Não há espaço suficiente para ${count} vãos`);return {ok:false};}

  const made=[];
  let remainder={...cell,id:uid('cell'),fixedAxes:{...(cell.fixedAxes||{})},manualCut:cell.manualCut?JSON.parse(JSON.stringify(cell.manualCut)):null};
  let firstSlice=null;
  for(let i=1;i<count;i++){
    const parentBounds=cellBox(remainder);
    const inherited=remainder.manualCut?JSON.parse(JSON.stringify(remainder.manualCut)):null;
    const manualCut={id:uid('cut'),axis,side,parentBounds,parentMeta:inherited,isFixed:!!isFixed,equalDivisionCount:count,equalDivisionIndex:i};
    const slice={...remainder,id:uid('cell'),fixedAxes:{...(remainder.fixedAxes||{})},manualCut:JSON.parse(JSON.stringify(manualCut))};
    const next={...remainder,id:uid('cell'),fixedAxes:{...(remainder.fixedAxes||{})},manualCut:JSON.parse(JSON.stringify(manualCut))};
    const boundary=lowSide
      ? originalMin+total*(i/count)
      : originalMax-total*(i/count);
    if(lowSide){slice[maxK]=boundary;next[minK]=boundary;}
    else{slice[minK]=boundary;next[maxK]=boundary;}
    if(isFixed){slice.fixedAxes={...(slice.fixedAxes||{}),[axis]:true};addFixedBandForCell(root,slice,axis);}
    made.push(slice);if(!firstSlice)firstSlice=slice;remainder=next;
  }
  made.push(remainder);
  const idx=root.cells.findIndex(c=>c.id===cell.id);
  if(idx<0)return {ok:false};
  root.cells.splice(idx,1,...made);
  renderSpaces();
  selectSpaceCellByIds(root.id,(firstSlice||made[0]).id);
  commitHistory();
  return {ok:true,noCut:false,count,eachMm:mm(total/count)};
}
function applySelectedSpaceCut(side,amountM,isFixed=false,count=2){
  if(Number.isFinite(amountM)&&Math.abs(amountM)<.0000001)return divideSelectedSpaceEvenly(side,count,isFixed);
  const ok=cutSelectedSpace(side,amountM,isFixed);
  return {ok:!!ok,noCut:false,count:ok?2:0};
}

function cutSelectedSpace(side,amountM,isFixed=false){
  // 1.100.96: cortar nunca cria outro móvel principal. O root continua sendo
  // o espaço original; apenas a célula selecionada vira dois cortes irmãos.
  if(!ctx.selectedSpaceCell) return false;
  const root=getSpaceRoot(ctx.selectedSpaceCell.rootId), cell=getSpaceCell(ctx.selectedSpaceCell.rootId,ctx.selectedSpaceCell.cellId); if(!root||!cell)return false;
  const sz=cellSize(cell);
  const limit=(side==='left'||side==='right') ? sz.width
             : (side==='front'||side==='back') ? sz.depth
             : sz.height;

  // v85: medida 0 significa "dividir exatamente no meio".
  // Vale para TODOS os lados: esquerda, direita, cima, baixo, frente e trás.
  if(Number.isFinite(amountM) && Math.abs(amountM)<.0000001) amountM=limit/2;

  if(!Number.isFinite(amountM)||amountM<.001||amountM>limit-.001){
    toast(`Use 0 para dividir ao meio ou uma medida entre 1 e ${Math.max(1,mm(limit)-1)} mm`);
    return false;
  }
  const a={...cell,id:uid('cell')}, b={...cell,id:uid('cell')}; let cutCell=a;
  const manualCutId=uid('cut');
  const inheritedManualCut=cell.manualCut?JSON.parse(JSON.stringify(cell.manualCut)):null;
  const cutAxis=(side==='left'||side==='right')?'x':((side==='front'||side==='back')?'z':'y');
  const manualCut={id:manualCutId,axis:cutAxis,side,parentBounds:cellBox(cell),parentMeta:inheritedManualCut,isFixed:!!isFixed};
  a.manualCut=JSON.parse(JSON.stringify(manualCut));
  b.manualCut=JSON.parse(JSON.stringify(manualCut));
  if(side==='left'){ const p=cell.minX+amountM; a.maxX=p; b.minX=p; cutCell=a; }
  if(side==='right'){ const p=cell.maxX-amountM; a.minX=p; b.maxX=p; cutCell=a; }
  if(side==='bottom'){ const p=cell.minY+amountM; a.maxY=p; b.minY=p; cutCell=a; }
  if(side==='top'){ const p=cell.maxY-amountM; a.minY=p; b.maxY=p; cutCell=a; }
  // Frente = lado mais próximo da câmera na vista frontal (+Z).
  // Trás   = fundo do móvel (-Z).
  if(side==='front'){ const p=cell.maxZ-amountM; a.minZ=p; b.maxZ=p; cutCell=a; }
  if(side==='back'){ const p=cell.minZ+amountM; a.maxZ=p; b.minZ=p; cutCell=a; }
  // Um corte fixo guarda a dimensão daquela faixa no eixo do corte.
  // Ao reutilizar o modelo em outro espaço, os trechos fixos mantêm sua medida
  // e apenas os trechos soltos absorvem o aumento/redução.
  a.fixedAxes={...(a.fixedAxes||{})}; b.fixedAxes={...(b.fixedAxes||{})};
  if(isFixed){
    const axis=(side==='left'||side==='right')?'x':((side==='front'||side==='back')?'z':'y');
    cutCell.fixedAxes={...(cutCell.fixedAxes||{}),[axis]:true};
    root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
    const rb=rootBounds(root);
    const rootMin=axis==='x'?rb.minX:(axis==='y'?rb.minY:rb.minZ);
    const cMin=axis==='x'?cutCell.minX:(axis==='y'?cutCell.minY:cutCell.minZ);
    const cMax=axis==='x'?cutCell.maxX:(axis==='y'?cutCell.maxY:cutCell.maxZ);
    root.fixedBands[axis]=mergeIntervals([...(root.fixedBands[axis]||[]),[cMin-rootMin,cMax-rootMin]]);
  }
  const i=root.cells.findIndex(c=>c.id===cell.id); root.cells.splice(i,1,a,b); renderSpaces(); selectSpaceCellByIds(root.id,cutCell.id); commitHistory(); return true;
}
function rootBounds(root){
  return {minX:root.x-root.width/2,maxX:root.x+root.width/2,minY:root.yBase,maxY:root.yBase+root.height,minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2};
}
function mapPersistentFixedBands(root,axis,mapper,srcMin,dstMin){
  const bands=(root.fixedBands?.[axis]||[]);
  return mergeIntervals(bands.map(([a,b])=>{
    const na=mapper(srcMin+Number(a))-dstMin;
    const nb=mapper(srcMin+Number(b))-dstMin;
    return [Math.min(na,nb),Math.max(na,nb)];
  }));
}
function updateAutoMachiningAfterPieceResize(obj){
  const u=obj?.userData; if(!u||!Array.isArray(u.machining)||!u.machining.length)return;
  const ti=pieceThicknessInfo(obj); if(!ti)return;
  for(const op of u.machining){
    // Medidas de usinagem ficam absolutas em mm. Apenas operações automáticas
    // que dependem do comprimento da peça acompanham o novo tamanho.
    if(op.type==='groove' && op.preset==='back-groove' && op.autoLength){
      if([ti.uAxis,ti.vAxis].includes(op.lengthAxis)) op.length=ti.dims[op.lengthAxis];
      else { op.lengthAxis=[ti.uAxis,ti.vAxis].find(a=>a!=='z')||ti.uAxis; op.length=ti.dims[op.lengthAxis]; }
      op.coordRef=op.coordRef&&typeof op.coordRef==='object'?op.coordRef:{};
      op.coordRef[op.lengthAxis]=0;
      if(Number.isFinite(Number(op.rearOffset))) op.coordRef.z=Number(op.rearOffset);
    }
    if(op.through) op.depth=ti.thickness;
  }
}

// ============================================================================
// 1.100.34 · ESPESSURA FIXA DA DIVISÃO VERTICAL
// ============================================================================
//
// A divisão vertical é uma chapa estrutural. Ao redimensionar o móvel,
// largura/altura/profundidade do módulo podem mudar, mas a ESPESSURA da chapa
// não pode ser escalada junto com o vão.
//
function isVerticalDivisionPiece(obj,root=null){
  if(!obj)return false;
  const u=obj.userData||{};
  if(root&&u.spaceRootId!==root.id)return false;
  return /^Divisão vertical$/i.test(String(u.name||'').trim());
}
function verticalDivisionNominalThicknessM(obj){
  if(!obj)return .018;

  // Projeto novo: se existir um valor nominal salvo no objeto, ele vence.
  const saved=Number(obj.userData?.divisionNominalThicknessM);
  if(Number.isFinite(saved)&&saved>.0001)return saved;

  // Projetos antigos: recupera a espessura nominal pelo material da peça.
  const material=productionMaterialById(obj.userData?.materialId);
  const mt=productionMaterialUsesPieceThickness(material)?NaN:Number(material?.thickness);
  if(Number.isFinite(mt)&&mt>.1)return m(mt);

  // Último fallback: espessura atual da peça.
  const current=Number(obj.userData?.width);
  return Number.isFinite(current)&&current>.0001?current:.018;
}
function registerVerticalDivisionFixedBand(root,x0,x1){
  if(!root)return;
  const rb=rootBounds(root);
  const a=Math.max(rb.minX,Math.min(rb.maxX,Number(x0)));
  const b=Math.max(rb.minX,Math.min(rb.maxX,Number(x1)));
  if(!(b>a))return;
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands.x=mergeIntervals([
    ...(root.fixedBands.x||[]),
    [a-rb.minX,b-rb.minX]
  ]);
}
function repairVerticalDivisionThickness(root){
  if(!root)return 0;
  const dividers=runtimeModel.objects.filter(o=>isVerticalDivisionPiece(o,root));
  if(!dividers.length)return 0;

  let repaired=0;
  for(const obj of dividers){
    const u=obj.userData||{};
    const target=verticalDivisionNominalThicknessM(obj);
    if(!(target>.0001)||target>=root.width)continue;

    const center=Number(obj.position.x);
    if(!Number.isFinite(center))continue;

    const current=Number(u.width)||target;
    const oldMin=center-current/2;
    const oldMax=center+current/2;
    const targetMin=center-target/2;
    const targetMax=center+target/2;

    // Os vãos criados pela divisão têm suas bordas exatamente encostadas
    // na chapa. Reposicionamos essas bordas antes de recalcular o móvel.
    const tol=.002; // 2 mm: tolera ponto flutuante sem capturar outra divisão.
    for(const c of root.cells||[]){
      if(Math.abs(Number(c.maxX)-oldMin)<=tol)c.maxX=targetMin;
      if(Math.abs(Number(c.minX)-oldMax)<=tol)c.minX=targetMax;
    }

    u.divisionNominalThicknessM=target;
    u.width=target;

    // A Divisão vertical é uma caixa comum; X é sempre a espessura.
    if(!(Array.isArray(u.forms)&&u.forms.length)){
      obj.scale.x=target;
    }
    obj.updateMatrixWorld?.(true);

    registerVerticalDivisionFixedBand(root,targetMin,targetMax);
    repaired++;
  }
  return repaired;
}


// ============================================================================
// 1.310.00 · domínio movido para módulo (4877-4952).


function resizeSpaceRoot(root,{width,depth,height,yBase,name}={}){
  if(!root) throw new Error('Espaço não encontrado');
  width=Number(width); depth=Number(depth); height=Number(height); yBase=Number(yBase);
  if(![width,depth,height,yBase].every(Number.isFinite)||width<.002||depth<.002||height<.002) throw new Error('Confira as medidas do espaço');
  if(yBase<0) throw new Error('A altura do chão não pode ser negativa');

  // Antes de redimensionar, restaura qualquer Divisão vertical antiga para a
  // espessura nominal da chapa e registra essa faixa como fixa.
  repairVerticalDivisionThickness(root);

  const src=rootBounds(root);
  const dst={minX:src.minX,maxX:src.minX+width,minY:yBase,maxY:yBase+height,minZ:src.minZ,maxZ:src.minZ+depth};
  const fixedX=fixedIntervalsFromSpace(root,'x'), fixedY=fixedIntervalsFromSpace(root,'y'), fixedZ=fixedIntervalsFromSpace(root,'z');
  // 1.200.90 · Projetos/blocos antigos podem ter perdido o marcador de faixa
  // fixa no espaço, embora a peça estrutural (18 mm, régua de 60 mm etc.) ainda
  // esteja no desenho. Recuperamos essas faixas pelas peças que realmente
  // cortam/ocupam o vão e as somamos aos travamentos explícitos.
  const structuralX=structuralFixedIntervalsFromRoot(root,'x',src);
  const structuralY=structuralFixedIntervalsFromRoot(root,'y',src);
  const structuralZ=structuralFixedIntervalsFromRoot(root,'z',src);
  const mapX=makeBalancedSpaceAxisMapper(root,'x',src.minX,src.maxX,dst.minX,dst.maxX,structuralX);
  const mapY=makeBalancedSpaceAxisMapper(root,'y',src.minY,src.maxY,dst.minY,dst.maxY,structuralY);
  const mapZ=makeBalancedSpaceAxisMapper(root,'z',src.minZ,src.maxZ,dst.minZ,dst.maxZ,structuralZ);

  // Captura as peças antes de alterar os limites do espaço.
  const linked=runtimeModel.objects.filter(o=>o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root));
  const pieceStates=linked.map(o=>{
    const u=o.userData,d=normalizePieceManualGeometryDelta(u.manualGeometryDelta);
    const curYBase=o.position.y-u.height/2;
    // Remove somente o ajuste manual para descobrir a peça-base que deve
    // acompanhar o móvel. Depois do mapeamento o mesmo delta será reaplicado.
    const bw=Math.max(.001,Number(u.width)-d.dw),bd=Math.max(.001,Number(u.depth)-d.dd),bh=Math.max(.001,Number(u.height)-d.dh);
    const bx=o.position.x-d.dx,byBase=curYBase-d.dyBase,bz=o.position.z-d.dz;
    return {o,d,minX:bx-bw/2,maxX:bx+bw/2,minY:byBase,maxY:byBase+bh,minZ:bz-bd/2,maxZ:bz+bd/2,oldDimsMm:{x:Number(u.width)*1000,y:Number(u.height)*1000,z:Number(u.depth)*1000}};
  });

  // Primeiro remapeia as divisões/vãos internos.
  for(const c of root.cells){
    c.minX=mapX(c.minX); c.maxX=mapX(c.maxX);
    c.minY=mapY(c.minY); c.maxY=mapY(c.maxY);
    c.minZ=mapZ(c.minZ); c.maxZ=mapZ(c.maxZ);
  }

  // Remapeia as peças. Trechos dentro de faixas fixas preservam espessura;
  // trechos soltos absorvem o aumento/redução do móvel.
  for(const st of pieceStates){
    const o=st.o,u=o.userData;
    const nx0=mapX(st.minX), nx1=mapX(st.maxX), ny0=mapY(st.minY), ny1=mapY(st.maxY), nz0=mapZ(st.minZ), nz1=mapZ(st.maxZ),d=st.d;
    const baseW=Math.max(.001,Math.abs(nx1-nx0)),baseH=Math.max(.001,Math.abs(ny1-ny0)),baseD=Math.max(.001,Math.abs(nz1-nz0));
    const nw=Math.max(.001,baseW+d.dw),nh=Math.max(.001,baseH+d.dh),nd=Math.max(.001,baseD+d.dd);
    u.width=nw;u.height=nh;u.depth=nd;
    remapMachiningForPieceResize(o,st.oldDimsMm,{x:nw*1000,y:nh*1000,z:nd*1000});
    if(Array.isArray(u.forms)&&u.forms.length){o.scale.set(1,1,1);rebuildFormGeometry(o);}else o.scale.set(nw,nh,nd);
    const mappedBaseY=Math.min(ny0,ny1);
    o.position.set((nx0+nx1)/2+d.dx,mappedBaseY+d.dyBase+nh/2,(nz0+nz1)/2+d.dz);
    updateAutoMachiningAfterPieceResize(o);
    sanitizeMachiningForPiece(o);
  }

  // Mantém as faixas fixas persistentes corretas para futuros redimensionamentos.
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands.x=mapPersistentFixedBands(root,'x',mapX,src.minX,dst.minX);
  root.fixedBands.y=mapPersistentFixedBands(root,'y',mapY,src.minY,dst.minY);
  root.fixedBands.z=mapPersistentFixedBands(root,'z',mapZ,src.minZ,dst.minZ);

  root.width=width; root.depth=depth; root.height=height; root.yBase=yBase;
  root.x=dst.minX+width/2; root.z=dst.minZ+depth/2;
  if(String(name||'').trim()) root.name=String(name).trim();

  // Conjuntos de gaveta não são deformados como blocos comuns: são
  // recalculados a partir do vão e da corrediça, no estilo paramétrico.
  rebuildDrawerSetsForRoot(root);
  renderSpaces(); applyDoorVisibility(root); renderMachiningVisuals();
  const currentId=ctx.selectedSpaceCell?.rootId===root.id?ctx.selectedSpaceCell.cellId:null;
  const current=currentId?getSpaceCell(root.id,currentId):null;
  if(current) selectSpaceCellByIds(root.id,current.id); else selectSpaceRootOnly(root);
  updateMeasureBadge();
}
function objectInsideSpaceRoot(obj,root,tol=.003){
  if(obj.userData.spaceRootId===root.id) return true;
  const a=getBounds(obj), b=rootBounds(root);
  return a.minX>=b.minX-tol && a.maxX<=b.maxX+tol && a.minY>=b.minY-tol && a.maxY<=b.maxY+tol && a.minZ>=b.minZ-tol && a.maxZ<=b.maxZ+tol;
}
function disposeObject(obj){
  const ve=obj.userData?.visualEdges;
  if(ve){ve.geometry?.dispose?.();ve.material?.dispose?.();obj.remove(ve);}
  scene.remove(obj);
  obj.geometry?.dispose();
  (obj.userData.faceMaterials||[]).forEach(m=>m.dispose?.());
}
function deleteSelectedSpaceRoot(){
  const rootId=ctx.selectedSpaceCell?.rootId || ctx.activeSpaceRootId;
  if(!rootId){toast('Selecione um espaço');return false;}

  const i=runtimeModel.spaceRoots.findIndex(r=>r.id===rootId);
  if(i<0){toast('Espaço não encontrado');return false;}

  const root=runtimeModel.spaceRoots[i];
  const linked=runtimeModel.objects.filter(o=>objectInsideSpaceRoot(o,root));
  const cells=(root.cells||[]).length;
  const extra=linked.length
    ? `\n\nTambém serão apagadas ${linked.length} peça(s) que pertencem a este móvel.`
    : '';

  const ok=window.confirm(
    `Apagar o espaço / móvel “${root.name}”?`+
    `\n\nEste móvel possui ${cells} divisão(ões)/vão(s).`+
    extra+
    `\n\nSe foi criado por engano, pode apagar com segurança. A ação ainda pode ser revertida em Desfazer.`
  );
  if(!ok)return false;

  // Fecha qualquer painel relacionado antes de remover a seleção.
  $('spaceActions').style.display='none';
  $('spaceMoreDialog').style.display='none';
  $('editSpaceDialog').style.display='none';

  // Remove também ferragens que ligavam peças deste móvel a outras peças.
  removeHardwareLinkedToObjects(linked);

  for(const obj of linked){
    const oi=runtimeModel.objects.indexOf(obj);
    if(oi>=0)runtimeModel.objects.splice(oi,1);
    disposeObject(obj);
  }
  if(ctx.selected&&linked.includes(ctx.selected))ctx.selected=null;

  // Remove o grupo visual deste espaço ANTES de tirá-lo de spaceRoots.
  if(root.group){
    root.group.traverse(o=>{
      if(o.isMesh||o.isLineSegments||o.isLine){
        o.geometry?.dispose?.();
        if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());
        else o.material?.dispose?.();
      }
    });
    scene.remove(root.group);
    root.group=null;
  }

  runtimeModel.spaceRoots.splice(i,1);
  clearSpaceSelection();
  renderSpaces();
  renderMachiningVisuals();
  updateMeasureBadge();
  commitHistory();

  toast(linked.length
    ? `“${root.name}” apagado · ${linked.length} peça(s) removida(s)`
    : `“${root.name}” apagado`
  );

  return true;
}

// ============================================================================
// 1.200.74 · APAGAR ESPAÇO SELECIONADO = DESFAZER SOMENTE A DIVISÃO/CORTE
// ============================================================================
function cellContainsObjectCompletely(cell,o,tol=.0015){
  if(!cell||!o)return false;
  const b=getBounds(o);
  return b.minX>=cell.minX-tol&&b.maxX<=cell.maxX+tol&&
         b.minY>=cell.minY-tol&&b.maxY<=cell.maxY+tol&&
         b.minZ>=cell.minZ-tol&&b.maxZ<=cell.maxZ+tol;
}
function manualCutSibling(root,cell){
  const meta=cell?.manualCut;
  if(meta?.id){
    const sibling=(root.cells||[]).find(c=>c!==cell&&c.manualCut?.id===meta.id);
    if(sibling)return {sibling,axis:meta.axis||null,meta};
  }
  const tol=Math.max(SPACE_HEAL_TOL*4,.0025),candidates=[];
  for(const axis of ['x','y','z']){
    for(const other of (root.cells||[])){
      if(other===cell||!sameCellTangents(cell,other,axis,tol))continue;
      const touches=almostSpace(cellAxisMax(cell,axis),cellAxisMin(other,axis),tol)||almostSpace(cellAxisMax(other,axis),cellAxisMin(cell,axis),tol);
      if(!touches)continue;
      const cs=cellSize(cell),os=cellSize(other);
      const volume=os.width*os.depth*os.height;
      candidates.push({sibling:other,axis,meta:null,volume});
    }
  }
  candidates.sort((a,b)=>b.volume-a.volume);
  return candidates[0]||null;
}
function removeFixedBandForDeletedCell(root,cell,axis){
  if(!root||!cell||!axis||!cell.fixedAxes?.[axis])return;
  const rb=rootBounds(root),rootMin=boxAxisMin(rb,axis);
  const a=cellAxisMin(cell,axis)-rootMin,z=cellAxisMax(cell,axis)-rootMin;
  const tol=.003;
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands[axis]=(root.fixedBands[axis]||[]).filter(([s,e])=>!(Math.abs(Number(s)-a)<=tol&&Math.abs(Number(e)-z)<=tol));
}
function removeManualCutNodeFromChain(meta,cutId){
  if(!meta||!cutId)return meta?JSON.parse(JSON.stringify(meta)):null;
  const node=JSON.parse(JSON.stringify(meta));
  if(node.id===cutId)return removeManualCutNodeFromChain(node.parentMeta,cutId);
  node.parentMeta=removeManualCutNodeFromChain(node.parentMeta,cutId);
  return node;
}
function expandManualCutParentBoundsAtDeletedBoundary(cell,axis,oldBoundary,newEdge,selectedLow){
  if(!cell)return;
  const minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis),tol=.003;
  let meta=cell.manualCut||null,guard=0;
  while(meta&&guard++<24){
    const b=meta.parentBounds;
    if(b){
      if(selectedLow&&Math.abs(Number(b[minK])-Number(oldBoundary))<=tol)b[minK]=newEdge;
      if(!selectedLow&&Math.abs(Number(b[maxK])-Number(oldBoundary))<=tol)b[maxK]=newEdge;
    }
    meta=meta.parentMeta||null;
  }
}
function selectedSpaceCellDeleteContext(root,cell){
  // 1.300.17: o "irmão" original pode ter sido recortado novamente. A rotina
  // de edição de vãos já sabe reconstruir essa árvore e retornar todos os
  // descendentes do mesmo pai; reaproveitamos a mesma leitura aqui.
  let ctx=null;
  try{ctx=selectedCellEditPair(root,cell);}catch(_){ctx=null;}
  if(ctx){
    const axis=ctx.axis,minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis),tol=.003;
    const boundary=Number(ctx.oldBoundary);
    const adjacent=(ctx.affectedCells||root.cells||[]).filter(c=>c!==cell&&(root.cells||[]).includes(c)&&
      cellTangentWithin(c,cell,axis,tol)&&
      (ctx.selectedLow?Math.abs(Number(c[minK])-boundary)<=tol:Math.abs(Number(c[maxK])-boundary)<=tol));
    const coverage=adjacent.reduce((n,c)=>n+cellTangentOverlapArea(cell,c,axis),0)/cellTangentFaceArea(cell,axis);
    if(adjacent.length&&coverage>=.90)return {...ctx,adjacent,coverage};
  }

  // Compatibilidade com projetos antigos: se ainda houver um irmão direto,
  // mantém a lógica anterior.
  const pair=manualCutSibling(root,cell);
  if(!pair)return null;
  const {sibling,axis,meta}=pair,tol=.003;
  const selectedLow=cellAxisMax(cell,axis)<=cellAxisMin(sibling,axis)+tol;
  const oldBoundary=selectedLow?cellAxisMax(cell,axis):cellAxisMin(cell,axis);
  const parent=meta?.parentBounds?{...meta.parentBounds}:mergedCellFromPair(cell,sibling,axis);
  return {root,cell,axis,selectedLow,parent,oldBoundary,affectedCells:[cell,sibling],adjacent:[sibling],cutId:meta?.id||null,source:'direct-sibling',coverage:1};
}
function selectedSpaceCellDeletePreview(){
  if(!ctx.selectedSpaceCell)return null;
  const root=getSpaceRoot(ctx.selectedSpaceCell.rootId),cell=getSpaceCell(ctx.selectedSpaceCell.rootId,ctx.selectedSpaceCell.cellId);
  if(!root||!cell)return null;
  if((root.cells||[]).length<=1)return {root,cell,error:'Este é o espaço principal. Não existe corte para desfazer.'};
  const editCtx=selectedSpaceCellDeleteContext(root,cell);
  if(!editCtx)return {root,cell,error:'Não encontrei um vão adjacente seguro para recompor este espaço.'};
  const inside=runtimeModel.objects.filter(o=>cellContainsObjectCompletely(cell,o));
  return {...editCtx,inside};
}
function openDeleteSelectedSpaceCellDialog(){
  const p=selectedSpaceCellDeletePreview();
  if(!p){toast('Selecione o espaço que deseja apagar');return false;}
  if(p.error){toast(p.error);return false;}
  const sz=cellSize(p.cell),count=p.inside.length,axisMm=mm(cellAxisMax(p.cell,p.axis)-cellAxisMin(p.cell,p.axis));
  let result='';
  if(p.adjacent.length===1){
    const a={...p.adjacent[0]};
    if(p.selectedLow)setCellAxisMin(a,p.axis,cellAxisMin(p.cell,p.axis));
    else setCellAxisMax(a,p.axis,cellAxisMax(p.cell,p.axis));
    const asz=cellSize(a);
    result=`O vão vizinho absorverá <strong>${nice(axisMm)} mm</strong> e passará para <strong>${nice(mm(asz.width))} × ${nice(mm(asz.depth))} × ${nice(mm(asz.height))} mm</strong>.`;
  }else{
    result=`Este espaço será devolvido ao vão de origem. <strong>${p.adjacent.length} divisões vizinhas</strong> absorverão os ${nice(axisMm)} mm, preservando os cortes internos que já existem.`;
  }
  $('deleteSpaceCellText').innerHTML=
    `<strong>Espaço selecionado:</strong> ${nice(mm(sz.width))} × ${nice(mm(sz.depth))} × ${nice(mm(sz.height))} mm.<br>`+
    result+
    (count?`<br><strong>${count} peça(s)</strong> totalmente dentro do espaço selecionado também serão apagadas.`:'');
  $('deleteSpaceCellDialog').style.display='flex';
  return true;
}
function deleteSelectedSpaceCell(){
  const p=selectedSpaceCellDeletePreview();
  if(!p||p.error){toast(p?.error||'Selecione um espaço dividido');return false;}
  const {root,cell,axis,selectedLow,oldBoundary,adjacent,cutId}=p;

  // Tudo que pertence inteiramente ao subespaço removido é apagado. Peças que
  // atravessam outros vãos (ex.: chapéu geral) são preservadas.
  const inside=runtimeModel.objects.filter(o=>cellContainsObjectCompletely(cell,o));
  const drawerIds=new Set();
  for(const o of inside)if(o.userData?.drawerSetId)drawerIds.add(o.userData.drawerSetId);
  for(const id of drawerIds)removeDrawerSet(id,{commit:false});
  const stillInside=runtimeModel.objects.filter(o=>cellContainsObjectCompletely(cell,o));
  removeHardwareLinkedToObjects(stillInside);
  for(const o of [...stillInside]){
    const i=runtimeModel.objects.indexOf(o);if(i>=0)runtimeModel.objects.splice(i,1);
    if(ctx.selected===o)ctx.selected=null;
    disposeObject(o);
  }

  const idx=root.cells.indexOf(cell);
  if(idx<0){toast('A divisão mudou. Selecione novamente.');return false;}

  // Remove o travamento da faixa apagada. Cada descendente adjacente absorve
  // o volume correspondente à sua própria faixa tangencial; assim cortes feitos
  // depois do corte original continuam existindo em vez de serem apagados.
  removeFixedBandForDeletedCell(root,cell,axis);
  const minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis);
  const newEdge=selectedLow?Number(cell[minK]):Number(cell[maxK]);

  const survivors=(p.affectedCells||[]).filter(c=>c!==cell&&(root.cells||[]).includes(c));
  for(const c of survivors){
    if(cutId)c.manualCut=removeManualCutNodeFromChain(c.manualCut,cutId);
    expandManualCutParentBoundsAtDeletedBoundary(c,axis,oldBoundary,newEdge,selectedLow);
  }

  for(const c of adjacent){
    if(!(root.cells||[]).includes(c))continue;
    const wasFixed=!!c.fixedAxes?.[axis],keepFixed=!!(wasFixed&&cell.fixedAxes?.[axis]);
    removeFixedBandForDeletedCell(root,c,axis);
    if(selectedLow)c[minK]=Math.min(Number(c[minK]),newEdge);
    else c[maxK]=Math.max(Number(c[maxK]),newEdge);
    c.hidden=!!(c.hidden&&cell.hidden);
    c.fixedAxes={...(c.fixedAxes||{})};
    if(keepFixed){c.fixedAxes[axis]=true;addFixedBandForCell(root,c,axis);}
    else delete c.fixedAxes[axis];
  }

  root.cells.splice(idx,1);
  $('deleteSpaceCellDialog').style.display='none';
  $('spaceActions').style.display='none';
  renderSpaces();renderMachiningVisuals();
  const next=adjacent.find(c=>(root.cells||[]).includes(c))||survivors.find(c=>(root.cells||[]).includes(c));
  if(next)selectSpaceCellByIds(root.id,next.id,{showMenu:false});else selectSpaceRootOnly(root);
  updateMeasureBadge();commitHistory();
  toast(`Espaço apagado · vão recalculado${adjacent.length>1?` · ${adjacent.length} divisões preservadas`:''}${stillInside.length?` · ${stillInside.length} peça(s) removida(s)`:''}`);
  return true;
}


  return {getSpaceRoot,getSpaceCell,cellSize,cellCenter,disposeSpaceMeshes,updateSpaceSelectionVisuals,renderSpaces,referenceMeshes,applyQuickFrontVisibility,isManuallyHideablePiece,manuallyHiddenPieces,syncManualPieceVisibilityButtons,applyManualVisibilityToObject,hideSelectedPieceQuick,showAllManuallyHiddenPieces,hasIndividuallyHiddenSpaces,syncQuickSpaceVisibilityButton,applyQuickSpaceVisibility,showAllSpacesGeneral,quickToggleAllSpaces,hideQuickSelectedSpace,openQuickSelectedConfiguration,updateSpaceVisibilityToggleButton,largestVisibleCell,spaceCellLabel,nearestVisibleCell,toggleActiveSpaceVisibility,showAllHiddenSpaces,setSpaceActionCellMode,selectSpaceRootOnly,distanceSqPointToCell,bestVisibleCellForObject,rootForObject,openSpaceFromObject,activeSpaceRoot,clearSpaceSelection,selectSpaceCellByIds,createSpace,createSpaceFromState,viewSpace,perspectiveFrontToSpace,frontViewToSpace,setFrontWorldView,divideSelectedSpaceEvenly,applySelectedSpaceCut,cutSelectedSpace,rootBounds,mapPersistentFixedBands,updateAutoMachiningAfterPieceResize,isVerticalDivisionPiece,verticalDivisionNominalThicknessM,registerVerticalDivisionFixedBand,repairVerticalDivisionThickness,resizeSpaceRoot,objectInsideSpaceRoot,disposeObject,deleteSelectedSpaceRoot,cellContainsObjectCompletely,manualCutSibling,removeFixedBandForDeletedCell,removeManualCutNodeFromChain,expandManualCutParentBoundsAtDeletedBoundary,selectedSpaceCellDeleteContext,selectedSpaceCellDeletePreview,openDeleteSelectedSpaceCellDialog,deleteSelectedSpaceCell};
}
