// DesignLabMoveis 1.311.00 · Seleção e inspetor de peças.
export function createPieceInspectorModule(ctx){
  const { $, state, clearSpaceSelection, restoreBaseColor, hideGuides, setAllFaces, COLORS, cancelDuplicateConfirmation, syncManualPieceVisibilityButtons, designLabVisualizationOnlyActive, setVisualMode, restorePieceInspectorPosition, pieceThicknessInfo, normalizePieceEdgeBands, fillPieceMaterialSelect, refreshPieceNamePresetSelect, rootForObject, doorAutoHingeCount, normalizePieceGrainRotation, loadPieceRelativeInputs, getSpaceCell, cellSize, mm }=ctx;
  const runtimeModel=ctx.runtimeModel;

function selectObject(mesh){
  if(mesh)clearSpaceSelection();
  if(state.selected&&state.selected!==mesh)restoreBaseColor(state.selected);
  state.selected=mesh;
  state.lastEdit=null;
  runtimeModel.liveLabel.style.display='none';
  hideGuides();

  if(state.selected){
    if(!state.visualMode)setAllFaces(state.selected,COLORS.selected);
    else restoreBaseColor(state.selected);
    updateInspector();

    // 1.200.95: um clique apenas seleciona.
    // A configuração abre somente pelo botão ⚙ Configuração.
    cancelDuplicateConfirmation?.();
    $('inspector').classList.add('compact');
    $('inspector').style.display='none';
  }else{
    $('inspector').classList.add('compact');
    $('inspector').style.display='none';
  }
  updateMeasureBadge();
  if(typeof syncManualPieceVisibilityButtons==='function')syncManualPieceVisibilityButtons();
}

// 1.200.18 · nomes rápidos de peças + biblioteca pessoal de nomes.
// 1.311.00 · domínio movido para módulo (6218-6323).

function openPieceInspector(mesh=state.selected){
  if(!mesh)return;
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive())return;
  if($('pieceMaterialSearch'))$('pieceMaterialSearch').value='';
  if(mesh!==state.selected)selectObject(mesh);
  if(state.visualMode)setVisualMode(false,{notify:false,frame:false});
  cancelDuplicateConfirmation?.();
  updateInspector();
  $('morePanel').style.display='none';
  $('inspector').classList.remove('compact');
  $('inspector').style.display='block';
  requestAnimationFrame(()=>restorePieceInspectorPosition(true));
}

function updateInspector(){
  if(!state.selected) return;
  const u=state.selected.userData;
  $('objectName').textContent=u.name || 'Peça';
  const machineCount=(u.machining||[]).length;
  const ti=u.kind==='cylinder'?null:pieceThicknessInfo(state.selected);
  const bandCount=Object.keys(normalizePieceEdgeBands(u.edgeBands||{})).length;
  const matTxt=u.materialType&&u.materialType!=='genérico'?` · ${u.materialType}${u.materialCode?` (${u.materialCode})`:''}`:'';
  $('objectType').textContent = u.kind==='panel'
    ? `MDF · ${ti?.thickness||mm(u.height)} mm${matTxt}${bandCount?` · ${bandCount} fita(s)`:''}${machineCount?` · ${machineCount} usinagem(ns)`:''}`
    : (u.kind==='cylinder' ? 'Cilindro' : `Cubo${matTxt}${bandCount?` · ${bandCount} fita(s)`:''}${machineCount?` · ${machineCount} usinagem(ns)`:''}`);
  $('partNameInput').value=u.name || '';
  refreshPieceNamePresetSelect(u.name||'');
  fillPieceMaterialSelect(u.materialId||'');
  $('dimW').value=mm(u.width); $('dimD').value=mm(u.depth); $('dimH').value=mm(u.height);
  $('posX').value=mm(state.selected.position.x);
  $('posY').value=mm(state.selected.position.y-u.height/2);
  $('posZ').value=mm(state.selected.position.z);
  const linkedBtn=$('openLinkedSpaceBtn');
  if(linkedBtn) linkedBtn.style.display=rootForObject(state.selected) ? 'block' : 'none';
  const drawerBtn=$('editDrawerSetBtn');
  if(drawerBtn) drawerBtn.style.display=u.drawerSetId?'block':'none';
  if(u.drawerSetId){
    const cfg=u.drawerConfig||{};
    $('objectType').textContent=(u.kind==='hardware-visual'?'Ferragem · ':'MDF · ')+(cfg.slideName||'Conjunto de gavetas')+` · gaveta ${(Number(u.drawerIndex)||0)+1}`;
  }

  // 1.100.96: a troca do lado da dobradiça só existe no menu de uma PORTA.
  const doorHingeSection=$('doorInspectorHingeSection');
  const isParametricDoor=!!u.doorConfig;
  if(doorHingeSection)doorHingeSection.style.display=isParametricDoor?'block':'none';
  if(isParametricDoor){
    const side=u.doorConfig?.hinge?.side==='right'?'right':'left';
    $('doorHingeLeftInspectorBtn')?.classList.toggle('active',side==='left');
    $('doorHingeRightInspectorBtn')?.classList.toggle('active',side==='right');
    const h=u.doorConfig?.hinge||{};
    const count=Math.max(1,Math.round(Number(h.count)||doorAutoHingeCount(mm(u.height))));
    const enabled=h.enabled!==false;
    $('doorInspectorHingeStatus').textContent=enabled
      ?`Atual: lado ${side==='left'?'esquerdo':'direito'} · ${count} dobradiça(s). Ao trocar, o copo da porta e os furos da lateral/divisão são refeitos no novo lado.`
      :'Esta porta está sem furação automática de dobradiça.';
  }

  const productionSection=$('pieceProductionSection');
  const doNotProduce=$('pieceDoNotProduce');
  const productionToggle=$('pieceProductionToggle');
  const canControlProduction=u.kind!=='cylinder'&&u.kind!=='hardware-visual';
  if(productionSection)productionSection.style.display=canControlProduction?'block':'none';
  if(doNotProduce)doNotProduce.checked=!!u.excludeFromCutList;
  productionToggle?.classList.toggle('isExcluded',!!u.excludeFromCutList);
  if(u.excludeFromCutList&&canControlProduction){
    $('objectType').textContent += ' · 🚫 NÃO PRODUZIR';
  }

  // 1.100.96: o veio pode girar 90° sem alterar a geometria/posição da peça.
  const grainSection=$('pieceGrainSection'),grainBtn=$('rotatePieceGrainBtn'),grainStatus=$('pieceGrainStatus');
  const hasGrain=canControlProduction&&!!u.materialGrain;
  const grainRot=normalizePieceGrainRotation(u.materialGrainRotation);
  if(grainSection)grainSection.style.display=hasGrain?'block':'none';
  if(grainBtn)grainBtn.textContent=grainRot===90?'↻ Voltar veio ao original':'↻ Rotacionar veio 90°';
  if(grainStatus){
    grainStatus.textContent=grainRot===90?'Veio rotacionado 90° nesta peça.':'Veio no sentido original desta peça.';
    grainStatus.classList.toggle('rotated',grainRot===90);
  }
  if(hasGrain)$('objectType').textContent += grainRot===90?' · VEIO 90°':' · VEIO 0°';

  // 1.200.95: os campos relativos são uma configuração persistente da peça.
  // Ao reabrir, mostramos exatamente os valores salvos em vez de zerá-los.
  loadPieceRelativeInputs(state.selected);
}
function updateMeasureBadge(){
  if(state.selected){
    const u=state.selected.userData;
    runtimeModel.measureBadge.style.display='block';
    runtimeModel.measureBadge.style.color='var(--yellow)';
    runtimeModel.measureBadge.textContent=`L ${mm(u.width)} · P ${mm(u.depth)} · A ${mm(u.height)} mm`;
    return;
  }
  if(state.selectedSpaceCell){
    const c=getSpaceCell(state.selectedSpaceCell.rootId,state.selectedSpaceCell.cellId);
    if(c){
      const z=cellSize(c);
      runtimeModel.measureBadge.style.display='block';
      runtimeModel.measureBadge.style.color='#5fd080';
      runtimeModel.measureBadge.textContent=`ESPAÇO · L ${mm(z.width)} · P ${mm(z.depth)} · A ${mm(z.height)} mm`;
      return;
    }
  }
  runtimeModel.measureBadge.style.display='none';
}

  return { selectObject, openPieceInspector, updateInspector, updateMeasureBadge };
}
