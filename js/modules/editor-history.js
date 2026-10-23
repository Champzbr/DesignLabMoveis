import {applyImportedMeshGeometry} from './imported-mesh.js';
// DesignLabMoveis 1.311.00 · Estado, serialização e histórico Desfazer/Refazer.
export function createEditorHistoryModule(ctx){
  const { state, THREE, canonicalFactoryMaterialId, normalizePieceGrainRotation, productionClone, captureProductionState, STORAGE_KEY, markCurrentProjectDirty, scene, resetTapeMeasure, clearMachiningVisuals, getProductionMaterials, defaultProjectProduction, disposeObject, disposeSpaceMeshes, clearSpaceSelection, selectObject, setProjectProductionState, createCylinder, createCurvedRib, createCurvedCover, createCurvedPost, createBox, createConstructionGuide, createSpaceFromState, repairVerticalDivisionThickness, repairOrphanSpaceGaps, removeDrawerSet, drawerEnsureBottomGroovesForSet, renderSpaces, applyAllDoorVisibility, applyManualVisibilityToObject, renderMachiningVisuals, applyCadDetailVisibility, syncManualPieceVisibilityButtons, toast }=ctx;
  const runtimeModel=ctx.runtimeModel;

function captureObjects(){
  return runtimeModel.objects.map(o=>({
    kind:o.userData.kind,name:o.userData.name,materialType:o.userData.materialType,baseColor:o.userData.baseColor,
    materialId:o.userData.materialId||null,materialCode:o.userData.materialCode||'',materialGrain:!!o.userData.materialGrain,materialGrainRotation:normalizePieceGrainRotation(o.userData.materialGrainRotation),materialCoreColor:o.userData.materialCoreColor||null,
    edgeBands:productionClone(o.userData.edgeBands||{}),partId:o.userData.partId||null,labelMeta:productionClone(o.userData.labelMeta||{schemaVersion:1,enabled:true}),
    spaceRootId:o.userData.spaceRootId||null,importedMesh:o.userData.importedMesh?productionClone(o.userData.importedMesh):null,
    machining:JSON.parse(JSON.stringify(o.userData.machining||[])),forms:JSON.parse(JSON.stringify(o.userData.forms||[])),customProfile:o.userData.customProfile?JSON.parse(JSON.stringify(o.userData.customProfile)):null,curvedRole:o.userData.curvedRole||null,curvedPart:o.userData.curvedPart||o.userData.customProfile?.part||null,curvedConfig:o.userData.curvedConfig?JSON.parse(JSON.stringify(o.userData.curvedConfig)):null,drawerSetId:o.userData.drawerSetId||null,drawerRole:o.userData.drawerRole||null,drawerIndex:o.userData.drawerIndex??null,drawerConfig:o.userData.drawerConfig?JSON.parse(JSON.stringify(o.userData.drawerConfig)):null,doorConfig:o.userData.doorConfig?JSON.parse(JSON.stringify(o.userData.doorConfig)):null,doorSystem:o.userData.doorSystem?JSON.parse(JSON.stringify(o.userData.doorSystem)):null,doorHandleVisual:!!o.userData.doorHandleVisual,doorHandleOwnerPartId:o.userData.doorHandleOwnerPartId||null,hiddenByUser:!!o.userData.hiddenByUser,excludeFromCutList:!!o.userData.excludeFromCutList,spaceCutting:!!o.userData.spaceCutting,spaceCutParentBounds:o.userData.spaceCutParentBounds?JSON.parse(JSON.stringify(o.userData.spaceCutParentBounds)):null,
    divisionNominalThicknessM:Number(o.userData.divisionNominalThicknessM)||null,
    manualGeometryDelta:productionClone(o.userData.manualGeometryDelta||null),pieceSavedConfig:productionClone(o.userData.pieceSavedConfig||null),cutPlanSheetHint:Number(o.userData.cutPlanSheetHint)||null,
    rotationX:Number(o.rotation.x)||0,rotationY:Number(o.rotation.y)||0,rotationZ:Number(o.rotation.z)||0,
    width:o.userData.width,depth:o.userData.depth,height:o.userData.height,
    x:Number.isFinite(o.userData.curvedTargetX)?o.userData.curvedTargetX:o.position.x,yBase:o.position.y-o.userData.height/2,z:Number.isFinite(o.userData.curvedTargetZ)?o.userData.curvedTargetZ:o.position.z
  }));
}
function captureGuides(){
  return runtimeModel.constructionGuides.map(line=>({
    infinite:!!line.userData.infinite,
    axis:line.userData.axis || null,
    kind:line.userData.kind || 'guide',
    offset:Number.isFinite(line.userData.offset) ? line.userData.offset : null,
    start:line.userData.start.toArray(),
    end:line.userData.end.toArray()
  }));
}
function captureSpaces(){ return runtimeModel.spaceRoots.map(r=>({id:r.id,name:r.name,width:r.width,depth:r.depth,height:r.height,x:r.x,yBase:r.yBase,z:r.z,defaultMaterialId:canonicalFactoryMaterialId(r.defaultMaterialId)||null,doorsHidden:!!r.doorsHidden,spaceHidden:false,doorSystem:r.doorSystem?JSON.parse(JSON.stringify(r.doorSystem)):null,fixedBands:{x:(r.fixedBands?.x||[]).map(v=>[...v]),y:(r.fixedBands?.y||[]).map(v=>[...v]),z:(r.fixedBands?.z||[]).map(v=>[...v])},cells:r.cells.map(c=>({id:c.id,hidden:!!c.hidden,fixedAxes:{...(c.fixedAxes||{})},manualCut:c.manualCut?JSON.parse(JSON.stringify(c.manualCut)):null,minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ}))})); }
function captureState(){ return { version:'1.200.18', objects:captureObjects(), guides:captureGuides(), spaces:captureSpaces(), production:captureProductionState() }; }
function stateString(){ return JSON.stringify(captureState()); }
function commitHistory(){
  if(state.historyMuted) return;
  const s=stateString();
  if(state.historyIndex>=0 && state.history[state.historyIndex]===s) return;
  state.history=state.history.slice(0,state.historyIndex+1); state.history.push(s); state.historyIndex=state.history.length-1;
  if(state.history.length>80){ state.history.shift(); state.historyIndex--; }
  localStorage.setItem(STORAGE_KEY,s);
  if(typeof markCurrentProjectDirty==='function')markCurrentProjectDirty();
}
function clearConstructionGuides(){
  for(const line of [...runtimeModel.constructionGuides]){
    scene.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  runtimeModel.constructionGuides.length=0;
  resetTapeMeasure();
}
function clearScene(){
  clearMachiningVisuals();
  // Novo projeto/limpeza recebe catálogos iniciais; applyState restaura os salvos logo depois.
  getProductionMaterials().state.projectProduction=defaultProjectProduction();
  for(const o of [...runtimeModel.objects])disposeObject(o);
  runtimeModel.objects.length=0;
  disposeSpaceMeshes(); runtimeModel.spaceRoots.length=0; clearSpaceSelection();
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
  state.historyMuted=true; clearScene();
  setProjectProductionState(Array.isArray(state)?null:state?.production);
  const rawObjectState=Array.isArray(state) ? state : (state?.objects || []);
  // 1.300.17: o antigo puxador externo visual foi removido do produto. Ao abrir
  // projetos antigos, seus marcadores são descartados sem tocar nas portas reais.
  const objectState=rawObjectState.filter(item=>!item?.doorHandleVisual);
  const guideState=Array.isArray(state) ? [] : (state?.guides || []);
  const spaceState=Array.isArray(state) ? [] : (state?.spaces || []);
  for(const item of objectState){
    if(item.kind==='cylinder') createCylinder({diameter:item.width,height:item.height,x:item.x,yBase:item.yBase,z:item.z,name:item.name},false);
    else if(item.kind==='curved-panel'&&item.customProfile?.cfg) createCurvedRib({cfg:item.customProfile.cfg,yBase:item.yBase,x:item.x,z:item.z,name:item.name,spaceRootId:item.spaceRootId,part:item.customProfile.part||item.curvedPart||'full'},false);
    else if(item.curvedRole==='cover'&&item.curvedConfig) createCurvedCover({cfg:item.curvedConfig,yBase:item.yBase,x:item.x,z:item.z,name:item.name||'Capa externa',spaceRootId:item.spaceRootId,part:item.curvedPart||item.curvedConfig.coverPart||'full'},false);
    else if(item.curvedRole==='post'&&item.curvedConfig) createCurvedPost({cfg:item.curvedConfig,yBase:item.yBase,x:item.x,z:item.z,name:item.name||'Montante curvo',spaceRootId:item.spaceRootId,rotationY:item.rotationY||0},false);
    else {const part=createBox({...item,rotationX:item.rotationX||0,rotationY:item.rotationY||0,rotationZ:item.rotationZ||0},false);if(item.importedMesh)applyImportedMeshGeometry(THREE,part,item.importedMesh);}
  }
  for(const g of guideState){
    if(!Array.isArray(g.start) || !Array.isArray(g.end)) continue;
    createConstructionGuide(new THREE.Vector3().fromArray(g.start),new THREE.Vector3().fromArray(g.end),{
      infinite:!!g.infinite,axis:g.axis||null,kind:g.kind||'guide',offset:Number.isFinite(g.offset)?g.offset:null,doHistory:false
    });
  }
  for(const sp of spaceState) createSpaceFromState(sp);

  // 1.200.98: restaura a ocultação manual também para geometrias especiais.
  const hiddenByPartId=new Map(objectState.filter(it=>it?.partId).map(it=>[it.partId,!!it.hiddenByUser]));
  for(let i=0;i<runtimeModel.objects.length;i++){
    const o=runtimeModel.objects[i],fallback=objectState[i];
    const hidden=o.userData?.partId&&hiddenByPartId.has(o.userData.partId)?hiddenByPartId.get(o.userData.partId):!!fallback?.hiddenByUser;
    o.userData.hiddenByUser=!!hidden;
    if(hidden){o.visible=false;if(o.userData?.visualEdges)o.userData.visualEdges.visible=false;}
  }

  // 1.100.34: projetos antigos podiam ter a Divisão vertical afinada/engrossada
  // ao redimensionar o móvel. Recupera a espessura nominal pelo material.
  for(const root of runtimeModel.spaceRoots)repairVerticalDivisionThickness(root);

  // 1.200.98: o reparo de faixas órfãs é SOMENTE para topologia legada.
  // Projetos modernos guardam a árvore manualCut e ela é a fonte de verdade.
  // Antes, applyState() rodava repairOrphanSpaceGaps() em todo Desfazer/Refazer.
  // Se uma peça que havia consumido 10 mm do vão fosse deslocada para frente,
  // o reparador interpretava os 10 mm originais como um buraco e devolvia essa
  // faixa ao espaço (ex.: 30 mm voltavam como 40 mm). Agora um root que possui
  // manualCut é restaurado exatamente como foi salvo no histórico.
  const sourceSpaceById=new Map(spaceState.map(sp=>[sp?.id,sp]));
  for(let pass=0;pass<6;pass++){
    let changed=0;
    for(const root of runtimeModel.spaceRoots){
      const source=sourceSpaceById.get(root.id);
      const hasModernCutTree=!!source?.cells?.some(c=>c?.manualCut&&typeof c.manualCut==='object');
      if(hasModernCutTree)continue;
      changed+=repairOrphanSpaceGaps(root).changes;
    }
    if(!changed)break;
  }

  // 1.100.3: limpa duplicatas históricas de gavetas no mesmo vão.
  // Mantém o primeiro set encontrado e remove os demais.
  {
    const byTarget=new Map();
    for(const o of runtimeModel.objects){
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
    const ids=new Set(runtimeModel.objects.filter(o=>o.userData?.drawerSetId&&o.userData?.drawerConfig?.machineBottom).map(o=>o.userData.drawerSetId));
    for(const id of ids)drawerEnsureBottomGroovesForSet(id);
  }

  renderSpaces(); applyAllDoorVisibility();
  for(const o of runtimeModel.objects)if(o.userData?.hiddenByUser)applyManualVisibilityToObject(o);
  renderMachiningVisuals();
  applyCadDetailVisibility({persist:false,notify:false});
  selectObject(runtimeModel.objects.filter(o=>o.visible!==false).at(-1)||null); if(!runtimeModel.objects.some(o=>o.visible!==false)) clearSpaceSelection();
  syncManualPieceVisibilityButtons();
  state.historyMuted=false;
}
function undo(){ if(state.historyIndex<=0){toast('Nada para desfazer');return;} state.historyIndex--; applyState(JSON.parse(state.history[state.historyIndex])); localStorage.setItem(STORAGE_KEY,state.history[state.historyIndex]); markCurrentProjectDirty(); }
function redo(){ if(state.historyIndex>=state.history.length-1){toast('Nada para refazer');return;} state.historyIndex++; applyState(JSON.parse(state.history[state.historyIndex])); localStorage.setItem(STORAGE_KEY,state.history[state.historyIndex]); markCurrentProjectDirty(); }

  return { captureObjects, captureGuides, captureSpaces, captureState, stateString, commitHistory, clearConstructionGuides, clearScene, normalizeStateToGround, applyState, undo, redo };
}
