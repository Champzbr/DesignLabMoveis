function setTool(mode){
  if(visualMode && mode!=='select')setVisualMode(false,{notify:false,frame:false});
  // v61: Puxe deixou de fazer parte da interface principal.
  if(mode==='pull')mode='select';
  toolMode=mode;
  if(mode!=='tape'){ tapeTouchActive=false; tapeTouchId=null; tapeMouseActive=false; resetTapeMeasure(); hideTapeCrosshair(); }
  else {
    tapeCrosshair.style.left=(innerWidth/2)+'px';
    tapeCrosshair.style.top=(innerHeight/2)+'px';
    tapeCrosshair.style.display='block';
    tapeSnapDot.style.display='none';
    resetTapeMeasure();
    tapeCrosshairLabel.textContent='1ª peça';
    toast('Trena: toque na 1ª peça');
  }
  $('hintText').textContent = mode==='select' ? 'Selecionar · toque exatamente onde o dedo encostar'
    : mode==='move-free' ? 'Mover · reconhece quina, guia, aresta e face' 
    : 'Trena · toque na 1ª peça e depois na 2ª peça para medir a distância entre elas';
  if(typeof syncToolDockButtons==='function')syncToolDockButtons();
}



// ---------- Edição do espaço sem apagar o móvel ----------
function updateEditSpacePreview(){
  const root=activeSpaceRoot(); const out=$('editSpacePreview'); if(!root||!out)return;
  const w=Number($('editSpaceW').value)||0,d=Number($('editSpaceD').value)||0,h=Number($('editSpaceH').value)||0;
  const dx=w-mm(root.width), dd=d-mm(root.depth), dh=h-mm(root.height);
  const fixedCount=['x','y','z'].reduce((n,a)=>n+(root.fixedBands?.[a]?.length||0),0);
  const fmt=v=>(v>=0?'+':'')+nice(v);
  out.innerHTML=`Atual: <strong>${nice(mm(root.width))} × ${nice(mm(root.depth))} × ${nice(mm(root.height))} mm</strong><br>Novo: <strong>${nice(w)} × ${nice(d)} × ${nice(h)} mm</strong> · Δ L ${fmt(dx)} · P ${fmt(dd)} · A ${fmt(dh)} mm${fixedCount?`<br>🔒 ${fixedCount} faixa(s) fixa(s) serão preservadas.`:''}`;
}
function openEditSpaceDialog(){
  const root=activeSpaceRoot(); if(!root){toast('Selecione um espaço');return;}
  $('editSpaceName').value=root.name||'Espaço'; $('editSpaceW').value=mm(root.width); $('editSpaceD').value=mm(root.depth); $('editSpaceH').value=mm(root.height); $('editSpaceBaseY').value=mm(root.yBase);
  $('editSpaceInfo').textContent=`${root.name} · altere o tamanho externo sem apagar ${objects.filter(o=>o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root)).length} peça(s).`;

  fillSpaceMaterialSelect($('editSpaceDefaultMaterial'),root.defaultMaterialId||'',{allowNone:true});
  $('editSpaceDefaultMaterial').value=root.defaultMaterialId||'';
  $('editSpaceApplyMaterialExisting').checked=false;
  updateEditSpaceMaterialPreview();

  updateEditSpacePreview(); $('editSpaceDialog').style.display='flex';
}
['editSpaceW','editSpaceD','editSpaceH','editSpaceBaseY'].forEach(id=>$(id)?.addEventListener('input',updateEditSpacePreview));
$('editSpaceDefaultMaterial').addEventListener('change',updateEditSpaceMaterialPreview);
$('cancelEditSpace').onclick=()=>{$('editSpaceDialog').style.display='none';};
$('editSpaceDialog').addEventListener('pointerdown',e=>{if(e.target===$('editSpaceDialog'))$('editSpaceDialog').style.display='none';});
$('confirmEditSpace').onclick=()=>{
  const root=activeSpaceRoot(); if(!root){toast('Espaço não encontrado');$('editSpaceDialog').style.display='none';return;}
  try{
    resizeSpaceRoot(root,{width:m($('editSpaceW').value),depth:m($('editSpaceD').value),height:m($('editSpaceH').value),yBase:m($('editSpaceBaseY').value),name:$('editSpaceName').value});

    const materialId=$('editSpaceDefaultMaterial').value||null;
    root.defaultMaterialId=materialId;

    let applied=0;
    const mat=productionMaterialById(materialId);
    if(mat&&$('editSpaceApplyMaterialExisting').checked){
      applied=applySpaceMaterialToExistingPieces(root,mat).changed;
    }

    renderSpaces();
    commitHistory(); $('editSpaceDialog').style.display='none';
    toast(applied
      ? `Espaço atualizado · material aplicado em ${applied} peça(s)`
      : `Espaço atualizado · ${mm(root.width)} × ${mm(root.depth)} × ${mm(root.height)} mm`);
  }catch(err){toast(err.message||'Não foi possível editar o espaço');}
};

// ---------- Criação de espaços relativos / presets ----------
const SPACE_PREFS_KEY='miniCadSpaceCreatePrefsV38';
let newSpaceRelation='right';
let newSpaceReferenceId=null;
function getSpaceCreatePrefs(){
  try{return JSON.parse(localStorage.getItem(SPACE_PREFS_KEY)||'null');}catch(_){return null;}
}
function setSpaceCreatePrefs(){
  if(!$('rememberSpaceConfig')?.checked){ localStorage.removeItem(SPACE_PREFS_KEY); return; }
  const ref=currentNewSpaceReference();
  const vertical=newSpaceRelation==='top'||newSpaceRelation==='bottom';
  const manualFloor=vertical&&ref ? mm(ref.yBase) : (Number($('spaceBaseY').value)||0);
  const payload={
    width:Number($('spaceW').value)||1000, depth:Number($('spaceD').value)||600, height:Number($('spaceH').value)||900,
    // Nunca grava como preferência a altura negativa calculada por uma relação "Embaixo".
    floor:Math.max(0,manualFloor), gap:Math.max(0,Number($('spaceGap').value)||0), relation:newSpaceRelation,
    defaultMaterialId:$('spaceDefaultMaterial')?.value||null
  };
  localStorage.setItem(SPACE_PREFS_KEY,JSON.stringify(payload));
}
function relationLabel(r){
  return ({right:'Direita',left:'Esquerda',top:'Em cima',bottom:'Embaixo',front:'Frente',back:'Trás'})[r]||'Direita';
}
function populateSpaceReferenceSelect(preferredRoot=null){
  const sel=$('spaceReference'); if(!sel)return;
  sel.innerHTML='';
  for(const r of spaceRoots){ const opt=document.createElement('option'); opt.value=r.id; opt.textContent=r.name; sel.appendChild(opt); }
  const pref=preferredRoot?.id||newSpaceReferenceId||activeSpaceRoot()?.id||spaceRoots.at(-1)?.id||null;
  if(pref && spaceRoots.some(r=>r.id===pref)) sel.value=pref;
  newSpaceReferenceId=sel.value||null;
}
function currentNewSpaceReference(){ return newSpaceReferenceId ? getSpaceRoot(newSpaceReferenceId) : null; }
function setNewSpaceRelation(rel){
  const wasVertical=newSpaceRelation==='top'||newSpaceRelation==='bottom';
  newSpaceRelation=rel||'right';
  const isVertical=newSpaceRelation==='top'||newSpaceRelation==='bottom';
  const ref=currentNewSpaceReference();
  if(ref && wasVertical && !isVertical) $('spaceBaseY').value=mm(ref.yBase);
  document.querySelectorAll('[data-space-relation]').forEach(b=>b.classList.toggle('active',b.dataset.spaceRelation===newSpaceRelation));
  updateNewSpacePreview();
}
function proposedSpacePlacement(){
  const w=m($('spaceW').value),d=m($('spaceD').value),h=m($('spaceH').value),rawFloor=m($('spaceBaseY').value),gap=Math.max(0,m($('spaceGap').value)||0);
  if(![w,d,h,rawFloor,gap].every(Number.isFinite)||w<=0||d<=0||h<=0)return null;
  const floor=Math.max(0,rawFloor);
  const ref=currentNewSpaceReference();
  if(!ref){ return {x:w/2,yBase:floor,z:d/2,w,d,h,gap,ref:null,belowGround:false}; }
  const refMinX=ref.x-ref.width/2, refMaxX=ref.x+ref.width/2, refMinZ=ref.z-ref.depth/2, refMaxZ=ref.z+ref.depth/2;
  let x=refMinX+w/2, z=refMinZ+d/2, yBase=floor;
  if(newSpaceRelation==='right') x=refMaxX+gap+w/2;
  else if(newSpaceRelation==='left') x=refMinX-gap-w/2;
  else if(newSpaceRelation==='front') z=refMaxZ+gap+d/2;
  else if(newSpaceRelation==='back') z=refMinZ-gap-d/2;
  else if(newSpaceRelation==='top') yBase=ref.yBase+ref.height+gap;
  else if(newSpaceRelation==='bottom') yBase=ref.yBase-h-gap;
  return {x,yBase,z,w,d,h,gap,ref,belowGround:yBase<0};
}
function updateNewSpacePreview(){
  const p=proposedSpacePlacement(), out=$('spaceCreatePreview'); if(!out)return;
  const ref=currentNewSpaceReference();
  const vertical=newSpaceRelation==='top'||newSpaceRelation==='bottom';
  if($('spaceBaseY')){
    $('spaceBaseY').readOnly=!!(ref&&vertical);
    if(ref&&vertical&&p) $('spaceBaseY').value=mm(p.yBase);
  }
  if(!p){out.textContent='Confira as medidas do novo espaço.';return;}
  if(p.belowGround){
    out.innerHTML=`<strong style="color:#ff665c">Não cabe abaixo sem atravessar o chão.</strong><br>Escolha outra referência, reduza a altura/afastamento ou use outra posição.`;
    return;
  }
  if(!ref){
    out.innerHTML=`<strong>${escapeHtml($('spaceName').value.trim()||'Espaço')}</strong> · primeiro espaço · base a <strong>${mm(p.yBase)} mm</strong> do chão<br>Referência horizontal: canto traseiro esquerdo em X/Z = 0<br>🧱 Material padrão: <strong>${escapeHtml(productionMaterialById($('spaceDefaultMaterial').value)?.name||'sem padrão')}</strong>`;
    return;
  }
  out.innerHTML=`Novo espaço: <strong>${escapeHtml($('spaceName').value.trim()||'Espaço')}</strong><br>Referência: <strong>${ref.name}</strong> · ${relationLabel(newSpaceRelation)} · afastamento ${mm(p.gap)} mm<br>Altura do chão resultante: <strong>${mm(p.yBase)} mm</strong><br>🧱 Material padrão: <strong>${escapeHtml(productionMaterialById($('spaceDefaultMaterial').value)?.name||'sem padrão')}</strong>`;
}
function openNewSpaceDialog(preferredRoot=null){
  const prefs=getSpaceCreatePrefs();
  if(prefs){
    $('spaceW').value=prefs.width??1000; $('spaceD').value=prefs.depth??600; $('spaceH').value=prefs.height??900;
    $('spaceBaseY').value=Math.max(0,Number(prefs.floor)||0); $('spaceGap').value=prefs.gap??0; newSpaceRelation=prefs.relation||'right';
    $('rememberSpaceConfig').checked=true;
  }else{
    $('spaceW').value=1000; $('spaceD').value=600; $('spaceH').value=900; $('spaceBaseY').value=0;
    $('spaceGap').value=0; $('rememberSpaceConfig').checked=false; newSpaceRelation='right';
  }
  const hasRef=spaceRoots.length>0;
  $('spaceReferenceBlock').style.display=hasRef?'block':'none';
  $('newSpaceTitle').textContent=hasRef?'Criar outro espaço':'Criar espaço';
  $('newSpaceHelp').textContent=hasRef
    ? 'O espaço selecionado é a referência. Troque a referência abaixo se houver mais de um móvel e escolha em qual lado o novo espaço será criado.'
    : 'No primeiro espaço, X/Z começam na origem. Use Distância do chão para decidir se ele fica apoiado no piso ou elevado.';
  populateSpaceReferenceSelect(preferredRoot||activeSpaceRoot()||spaceRoots.at(-1)||null);
  const ref=currentNewSpaceReference();
  if(ref && !prefs) $('spaceBaseY').value=mm(ref.yBase);

  // Prioridade:
  // 1. material lembrado;
  // 2. material do espaço de referência;
  // 3. MDF branco 18 / primeiro material do projeto.
  const initialMaterialId=(prefs?.defaultMaterialId&&productionMaterialById(prefs.defaultMaterialId))
    ? prefs.defaultMaterialId
    : (ref?.defaultMaterialId&&productionMaterialById(ref.defaultMaterialId))
      ? ref.defaultMaterialId
      : preferredDefaultMaterialId();
  fillSpaceMaterialSelect($('spaceDefaultMaterial'),initialMaterialId,{allowNone:true});
  $('spaceDefaultMaterial').value=initialMaterialId||'';
  updateSpaceMaterialPreview();

  $('spaceName').value='Espaço '+(spaceRoots.length+1);
  document.querySelectorAll('[data-space-relation]').forEach(b=>b.classList.toggle('active',b.dataset.spaceRelation===newSpaceRelation));
  $('newSpaceDialog').style.display='flex';
  updateNewSpacePreview();
}


// ============================================================================
// 1.100.34 · PREFERÊNCIAS DO CORTE DO ESPAÇO
// ============================================================================
const CUT_SPACE_PREFS_KEY='designlab-cut-space-prefs-v134';

function cutSpacePrefsStorageKey(){
  let owner='local-device';
  try{
    const id=typeof projectCurrentOwnerId==='function'?projectCurrentOwnerId():'';
    if(id)owner=id;
  }catch{}
  return `${CUT_SPACE_PREFS_KEY}:${owner}`;
}
function defaultCutSpacePrefs(){
  return {amount:18,side:'left',fixed:false};
}
function loadCutSpacePrefs(){
  const fallback=defaultCutSpacePrefs();
  try{
    const raw=JSON.parse(localStorage.getItem(cutSpacePrefsStorageKey())||'null');
    if(!raw)return fallback;
    const amount=Number(raw.amount);
    const sides=['left','right','top','bottom','front','back'];
    return {
      amount:Number.isFinite(amount)&&amount>=0?amount:fallback.amount,
      side:sides.includes(raw.side)?raw.side:fallback.side,
      fixed:!!raw.fixed
    };
  }catch{
    return fallback;
  }
}
function applyCutSpacePrefs(){
  const p=loadCutSpacePrefs();
  cutSide=p.side;
  $('cutAmount').value=nice(p.amount);
  $('cutFixed').checked=!!p.fixed;
  document.querySelectorAll('[data-cut-side]').forEach(
    b=>b.classList.toggle('active',b.dataset.cutSide===cutSide)
  );
  $('cutSavedInfo').innerHTML=
    `Configuração carregada: <strong>${nice(p.amount)} mm · ${cutSideName(p.side)} · ${p.fixed?'faixa fixa':'faixa solta'}</strong>.`;
  updateCutPreview();
}
function saveCutSpacePrefs(){
  const amount=Number(String($('cutAmount').value||'').replace(',','.'));
  if(!Number.isFinite(amount)||amount<0){
    toast('Confira a medida antes de salvar');
    return;
  }
  const p={amount,side:cutSide,fixed:!!$('cutFixed').checked};
  try{
    localStorage.setItem(cutSpacePrefsStorageKey(),JSON.stringify(p));
    $('cutSavedInfo').innerHTML=
      `Salvo para esta conta: <strong>${nice(amount)} mm · ${cutSideName(cutSide)} · ${p.fixed?'faixa fixa':'faixa solta'}</strong>.`;
    toast('Configuração do corte salva');
  }catch{
    toast('Não foi possível salvar a configuração');
  }
}


let cutSide='left';
function cutSideName(side){
  return side==='left'?'Esquerda'
    : side==='right'?'Direita'
    : side==='top'?'Em cima'
    : side==='bottom'?'Em baixo'
    : side==='front'?'Frente'
    : 'Trás';
}
function updateCutPreview(){
  const info=selectedCellInfo(); if(!info)return;
  const raw=Number($('cutAmount').value);
  const total=(cutSide==='left'||cutSide==='right') ? mm(info.size.width)
             : (cutSide==='front'||cutSide==='back') ? mm(info.size.depth)
             : mm(info.size.height);
  const middle=Number.isFinite(raw)&&Math.abs(raw)<.0000001;
  const a=middle?total/2:(Number.isFinite(raw)?raw:0);
  const fixed=$('cutFixed')?.checked;
  $('cutSideLabel').value=cutSideName(cutSide);
  $('cutPreview').textContent=middle
    ? `${cutSideName(cutSide)}: 0 = DIVIDIR NO MEIO · ${nice(a)} mm + ${nice(total-a)} mm · ${fixed?'FIXO (não redimensiona)':'SOLTO (pode redimensionar)'} · externo continua ${total} mm`
    : `${cutSideName(cutSide)}: ${a} mm + restante ${Math.max(0,total-a)} mm · ${fixed?'FIXO (não redimensiona)':'SOLTO (pode redimensionar)'} · externo continua ${total} mm`;
}
$('cancelSpace').onclick=()=>{$('newSpaceDialog').style.display='none';};
$('spaceReference').addEventListener('change',()=>{newSpaceReferenceId=$('spaceReference').value||null;const ref=currentNewSpaceReference();if(ref && !(newSpaceRelation==='top'||newSpaceRelation==='bottom')) $('spaceBaseY').value=mm(ref.yBase);updateNewSpacePreview();});
document.querySelectorAll('[data-space-relation]').forEach(b=>b.addEventListener('click',()=>setNewSpaceRelation(b.dataset.spaceRelation)));
['spaceName','spaceW','spaceD','spaceH','spaceBaseY','spaceGap'].forEach(id=>$(id).addEventListener('input',updateNewSpacePreview));
$('spaceDefaultMaterial').addEventListener('change',()=>{updateSpaceMaterialPreview();updateNewSpacePreview();});
$('confirmSpace').onclick=()=>{
  const p=proposedSpacePlacement(); if(!p||p.w<.002||p.d<.002||p.h<.002){toast('Confira as medidas do espaço');return;}
  if(p.belowGround){toast('O novo espaço ficaria abaixo do chão');return;}
  setSpaceCreatePrefs();
  const root=createSpace({width:p.w,depth:p.d,height:p.h,x:p.x,yBase:p.yBase,z:p.z,name:$('spaceName').value.trim()||'Espaço',defaultMaterialId:$('spaceDefaultMaterial').value||null});
  $('newSpaceDialog').style.display='none';
  toast(p.ref?`Espaço criado à ${relationLabel(newSpaceRelation).toLowerCase()} de ${p.ref.name}`:`Espaço criado · base ${mm(p.yBase)} mm do chão`);
};
$('cutSpaceBtn').onclick=()=>{
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  if(!selectedSpaceCell)return;
  applyCutSpacePrefs();
  $('cutSpaceDialog').style.display='flex';
};
$('cancelCut').onclick=()=>{$('cutSpaceDialog').style.display='none';};
$('saveCutConfig').onclick=saveCutSpacePrefs;
document.querySelectorAll('[data-cut-side]').forEach(b=>b.onclick=()=>{cutSide=b.dataset.cutSide;document.querySelectorAll('[data-cut-side]').forEach(x=>x.classList.toggle('active',x===b));updateCutPreview();});
$('cutAmount').addEventListener('input',updateCutPreview); $('cutFixed').addEventListener('change',updateCutPreview);
$('confirmCut').onclick=()=>{const fixed=$('cutFixed').checked;if(cutSelectedSpace(cutSide,m($('cutAmount').value),fixed)) {$('cutSpaceDialog').style.display='none';toast(fixed?'Espaço dividido · faixa fixa':'Espaço dividido · faixa solta');}};
// v61 · Móvel curvo: 3 referências fixas + extras equilibrados somente nos trechos retos.
// Ao reduzir o raio, evita manter uma nervura incompatível de configuração antiga.
function normalizeCurvedRadiusInputs(){
  const r=parseDecimalInput($('curvedRadius')?.value);
  if(!Number.isFinite(r)||r<20)return;
  const cover=$('curvedCreateCover')?.checked?curvedFieldNumber('curvedCoverThickness',6):0;
  const bandEl=$('curvedBand');
  const band=parseDecimalInput(bandEl?.value);
  const maxBand=r-cover-1;
  if(bandEl&&Number.isFinite(band)&&band>=r-cover&&maxBand>=20){
    bandEl.value=nice(Math.min(band,maxBand));
  }
}
['curvedRadius','curvedBand','curvedThickness','curvedRibs','curvedPosts','curvedPostWidth','curvedJointDepth','curvedSlotClearance','curvedReliefDiameter','curvedReliefLength','curvedCurveEndInset','curvedEndAInset','curvedEndBInset','curvedCoverThickness','curvedSplitTail'].forEach(id=>{
  $(id)?.addEventListener('input',()=>{
    if(id==='curvedRadius')normalizeCurvedRadiusInputs();
    updateCurvedStructurePreview();
  });
});
document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.addEventListener('click',()=>{curvedOrientation=b.dataset.curvedOrientation||'front-right';document.querySelectorAll('[data-curved-orientation]').forEach(x=>x.classList.toggle('active',x===b));updateCurvedStructurePreview();}));
$('curvedCreateSlots')?.addEventListener('change',updateCurvedStructurePreview);
$('curvedReliefMode')?.addEventListener('change',updateCurvedStructurePreview);
$('curvedCreateCover')?.addEventListener('change',updateCurvedStructurePreview);
$('curvedSplitStructure')?.addEventListener('change',updateCurvedStructurePreview);
$('cancelCurvedStructure').onclick=()=>{if(curved3DPreviewActive)returnCurvedStructurePreview({reopen:false});$('curvedStructureDialog').style.display='none';curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;curvedTargetRootId=null;curvedTargetCellId=null;curvedEditingExisting=false;};
$('curvedStructureDialog').addEventListener('pointerdown',e=>{if(e.target===$('curvedStructureDialog')){$('curvedStructureDialog').style.display='none';curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;curvedTargetRootId=null;curvedTargetCellId=null;curvedEditingExisting=false;}});
$('previewCurvedStructure')?.addEventListener('click',previewCurvedStructure3D);
$('returnCurvedPreview')?.addEventListener('click',()=>returnCurvedStructurePreview({reopen:true}));
$('confirmCurvedStructure').onclick=()=>createCurvedStructure();
$('curvedSpaceBtn').onclick=()=>openCurvedStructureDialog();

$('createPiecesBtn').onclick=()=>{
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  if(!selectedSpaceCell){toast('Selecione uma divisão');return;}
  pieceCreateType='left';
  pieceTypeLastClickButton=null;
  pieceTypeLastClickAt=0;
  document.querySelectorAll('[data-piece-type]').forEach(b=>b.classList.toggle('active',b.dataset.pieceType===pieceCreateType));
  {
    const root=getSpaceRoot(selectedSpaceCell.rootId);
    applySavedPieceThickness(root);
  }
  $('pieceFrontInset').value=0; $('pieceBackInset').value=0; $('piecePosition').value=0; $('pieceCount').value=3;
  $('pieceDivisionMeasure').value=0; $('pieceDivisionSide').value='gap1';
  $('doorCount').value=2; $('doorGapLeft').value=2; $('doorGapRight').value=2; $('doorGapTop').value=2; $('doorGapBottom').value=2; $('doorGapMiddle').value=2;
  $('doorHandleType').value='none'; $('doorHandleSize').value=20; $('doorCavaPosition').value='top';
  $('doorCreateHingeHoles').checked=true; $('doorHingeCount').value='auto'; $('doorHingeSide').value='auto';
  $('doorHingeCupDiameter').value=35; $('doorHingeCupDepth').value=12; $('doorHingeCupEdge').value=22.5; $('doorHingeEdgeY').value=100;
  $('doorCreateSideHoles').checked=true; $('doorMountFrontOffset').value=37; $('doorMountSpacing').value=32; $('doorMountDiameter').value=5; $('doorMountDepth').value=12;
  // Se o usuário já salvou um padrão de portas, restaura todas as medidas,
  // puxador/cava e furação antes de abrir o diálogo.
  applyDoorCreateConfig();
  $('createPiecesDialog').style.display='flex';
  try{ updateCreatePiecesUI(); }catch(err){ console.error('Criar peças:',err); toast('Erro ao abrir Criar peças: '+(err.message||err)); }
};
$('saveDoorCreateConfig').onclick=saveDoorCreateConfig;
$('cancelCreatePieces').onclick=()=>{$('createPiecesDialog').style.display='none';pieceTypeLastClickButton=null;pieceTypeLastClickAt=0;};
$('createPiecesDialog').addEventListener('pointerdown',e=>{if(e.target===$('createPiecesDialog')) $('createPiecesDialog').style.display='none';});
document.querySelectorAll('[data-piece-type]').forEach(b=>{
  b.title='1 clique seleciona · 2 cliques rápidos criam';
  b.onclick=()=>{
    const now=performance.now();
    const isDouble=pieceTypeLastClickButton===b && (now-pieceTypeLastClickAt)<=PIECE_TYPE_DOUBLE_CLICK_MS;

    selectPieceCreateTypeButton(b);

    if(isDouble){
      pieceTypeLastClickButton=null;
      pieceTypeLastClickAt=0;
      quickCreatePieceFromTypeButton(b);
    }else{
      pieceTypeLastClickButton=b;
      pieceTypeLastClickAt=now;
    }
  };
});
['pieceThickness','pieceFrontInset','pieceBackInset','piecePosition','pieceCount','pieceDivisionMeasure','doorCount','doorGapLeft','doorGapRight','doorGapTop','doorGapBottom','doorGapMiddle','doorHandleSize','doorHingeCupDiameter','doorHingeCupDepth','doorHingeCupEdge','doorHingeEdgeY','doorMountFrontOffset','doorMountSpacing','doorMountDiameter','doorMountDepth'].forEach(id=>$(id).addEventListener('input',()=>{
  if(id==='pieceThickness')savePieceThicknessPreference({silent:true});
  updateCreatePiecesUI();
}));
$('pieceDivisionSide').addEventListener('change',updateCreatePiecesUI);
['doorHandleType','doorCavaPosition','doorHingeCount','doorHingeSide'].forEach(id=>$(id).addEventListener('change',()=>{updateDoorCreationVisibility();updateCreatePiecesUI();}));
['doorCreateHingeHoles','doorCreateSideHoles'].forEach(id=>$(id).addEventListener('change',()=>{updateDoorCreationVisibility();updateCreatePiecesUI();}));
$('confirmCreatePieces').onclick=()=>{
  if(createPiecesInSelectedCell()){
    savePieceThicknessPreference({silent:true});
    $('createPiecesDialog').style.display='none';
    pieceTypeLastClickButton=null;
    pieceTypeLastClickAt=0;
  }
};

$('drawerSpaceBtn').onclick=()=>openDrawerSystemDialog();
$('drawerMoreBtn').onclick=()=>{$('spaceMoreDialog').style.display='none';openDrawerSystemDialog();};
$('editDrawerSetBtn').onclick=()=>openDrawerSystemDialog(selected);
$('drawerSlideType').addEventListener('change',()=>{drawerApplyPresetDefaults(true);updateDrawerDrillingFields();});
['drawerLengthMode','drawerSideClearance','drawerCount','drawerBoxHeight','drawerBoxThickness','drawerBottomThickness2','drawerBottomOffset','drawerBottomPassLeft','drawerBottomPassRight','drawerBottomPassFront','drawerBottomPassBack','drawerBottomGrooveClearance','drawerBottomGrooveDepth','drawerFrontInset','drawerRearClearance','drawerEdgeGap','drawerFrontThickness','drawerFrontGapLeft','drawerFrontGapRight','drawerFrontGapTop','drawerFrontGapBottom','drawerFrontGapBetween'].forEach(id=>$(id).addEventListener('input',updateDrawerSystemPreview));
['drawerDrillFrontRef','drawerDrillOffsets','drawerDrillMountY','drawerDrillDiameter','drawerDrillDepth'].forEach(id=>$(id).addEventListener('input',updateDrawerDrillingFields));
$('drawerDrillAutoByLength').addEventListener('change',updateDrawerDrillingFields);
$('drawerDrillVerticalMode').addEventListener('change',updateDrawerDrillingFields);
$('drawerDrillSide').addEventListener('change',updateDrawerDrillingFields);
$('drawerLengthMode').addEventListener('change',updateDrawerDrillingFields);
$('drawerCreateSlides').addEventListener('change',updateDrawerSystemPreview);
$('drawerCreateDrilling').addEventListener('change',updateDrawerDrillingFields);
$('drawerResetDrillingPattern').onclick=()=>{drawerSetDrillingUiFromPreset($('drawerSlideType').value);updateDrawerDrillingFields();toast('Padrão de furação restaurado');};
$('drawerCreateFronts').addEventListener('change',updateDrawerFrontFields);
$('drawerMachineBottom').addEventListener('change',updateDrawerBottomMachiningFields);
['drawerGrooveLeft','drawerGrooveRight','drawerGrooveFront','drawerGrooveBack'].forEach(id=>$(id).addEventListener('change',updateDrawerSystemPreview));
$('drawerSavedSlideSelect').addEventListener('change',applyDrawerSlidePresetLibrary);
$('saveDrawerSlidePreset').onclick=saveDrawerSlidePresetLibrary;
$('deleteDrawerSlidePreset').onclick=deleteDrawerSlidePresetLibrary;
$('confirmDrawerSystem').onclick=saveDrawerSystem;
$('deleteDrawerSet').onclick=deleteDrawerSystem;
$('cancelDrawerSystem').onclick=()=>{$('drawerSystemDialog').style.display='none';drawerEditingSetId=null;drawerTargetRootId=null;drawerTargetCellId=null;};
$('drawerSystemDialog').addEventListener('pointerdown',e=>{if(e.target===$('drawerSystemDialog')){$('drawerSystemDialog').style.display='none';drawerEditingSetId=null;drawerTargetRootId=null;drawerTargetCellId=null;}});

$('openLibraryBtn').onclick=()=>{if(visualMode)setVisualMode(false,{notify:false,frame:false});if(!selectedSpaceCell)return;openLibraryRoot();};
$('closeLibrary').onclick=()=>{$('libraryDialog').style.display='none';activeLibraryFolderId=null;};
$('spaceMoreBtn').onclick=()=>{const info=selectedCellInfo();const root=info?.root||activeSpaceRoot();if(!root){toast('Selecione um espaço');return;}const s=info?.size||{width:root.width,depth:root.depth,height:root.height};$('spaceMoreInfo').textContent=`${root.name} · L ${mm(s.width)} · P ${mm(s.depth)} · A ${mm(s.height)} mm${info?'':' · móvel completo'}`;$('spaceMoreDialog').style.display='flex';};
$('closeSpaceMore').onclick=()=>{$('spaceMoreDialog').style.display='none';};
$('spaceMoreDialog').addEventListener('pointerdown',e=>{if(e.target===$('spaceMoreDialog'))$('spaceMoreDialog').style.display='none';});
$('editSpaceBtn').onclick=()=>{if(visualMode)setVisualMode(false,{notify:false,frame:false});$('spaceMoreDialog').style.display='none';openEditSpaceDialog();};
$('frontSpaceBtn').onclick=()=>{const root=activeSpaceRoot();if(root)viewSpace(root,'front');$('spaceMoreDialog').style.display='none';};
$('backSpaceBtn').onclick=()=>{const root=activeSpaceRoot();if(root)viewSpace(root,'back');$('spaceMoreDialog').style.display='none';};
$('leftSpaceBtn').onclick=()=>{const root=activeSpaceRoot();if(root)viewSpace(root,'left');$('spaceMoreDialog').style.display='none';};
$('rightSpaceBtn').onclick=()=>{const root=activeSpaceRoot();if(root)viewSpace(root,'right');$('spaceMoreDialog').style.display='none';};
$('topSpaceBtn').onclick=()=>{const root=activeSpaceRoot();if(root)viewSpace(root,'top');$('spaceMoreDialog').style.display='none';};
$('bottomSpaceBtn').onclick=()=>{const root=activeSpaceRoot();if(root)viewSpace(root,'bottom');$('spaceMoreDialog').style.display='none';};
$('toggleSpaceBtn').onclick=()=>{toggleActiveSpaceVisibility();$('spaceMoreDialog').style.display='none';};
$('hideSelectedSpaceBtn').onclick=()=>toggleActiveSpaceVisibility();
$('deleteSelectedSpaceBtn').onclick=()=>deleteSelectedSpaceRoot();
$('showHiddenSpacesMoreBtn').onclick=()=>{showAllHiddenSpaces();$('spaceMoreDialog').style.display='none';};
$('toggleDoorsBtn').onclick=()=>{toggleDoorsForActiveSpace();};
$('newAdjacentSpaceBtn').onclick=()=>{if(visualMode)setVisualMode(false,{notify:false,frame:false});const root=activeSpaceRoot();$('spaceMoreDialog').style.display='none';openNewSpaceDialog(root);};
$('exportFurnitureBtn').onclick=()=>{exportSelectedFurniture();};
$('exportAspireBtn').onclick=()=>{exportSelectedAspireDxf();};

$('closeProductionDialog').onclick=closeProductionDialog;
$('productionDialog').addEventListener('pointerdown',e=>{if(e.target===$('productionDialog'))closeProductionDialog();});
$('productionMaterialSelect').addEventListener('change',()=>{if($('productionMaterialSelect').value)productionLoadMaterialFields();});
$('productionBandSelect').addEventListener('change',()=>{if($('productionBandSelect').value)productionLoadBandFields();});
$('productionMaterialNew').onclick=productionNewMaterial;
$('productionMaterialSave').onclick=productionSaveMaterial;
$('productionMaterialDelete').onclick=productionDeleteMaterial;
$('productionMaterialApply').onclick=productionApplyMaterial;
$('productionBandNew').onclick=productionNewBand;
$('productionBandSave').onclick=productionSaveBand;
$('productionBandDelete').onclick=productionDeleteBand;
document.querySelectorAll('[data-edge-key]').forEach(sel=>sel.addEventListener('change',()=>productionAssignEdge(sel.dataset.edgeKey,sel.value)));
$('productionClearBands').onclick=productionClearSelectedBands;
$('openLabelsFromProduction').onclick=()=>{closeProductionDialog();openLabelsDialog();};
$('printLabelsFromProduction').onclick=()=>{closeProductionDialog();labelsApplyPrefs();$('labelsScope').value='project';labelsSavePrefs();labelsPrint();};
$('labelsToolBtn').onclick=()=>openLabelsDialog();
$('closeLabelsDialog').onclick=closeLabelsDialog;
$('closeLabelsDialogTop').onclick=closeLabelsDialog;
$('labelsDialog').addEventListener('pointerdown',e=>{if(e.target===$('labelsDialog'))closeLabelsDialog();});
$('refreshLabelsPreview').onclick=renderLabelsPreview;
$('printLabelsBtn').onclick=labelsPrint;
$('saveLabelsHtml').onclick=labelsSaveHtml;
['labelsScope','labelsMode','labelsWidth','labelsHeight','labelsPaper','labelsMarginLeft','labelsMarginRight','labelsMarginTop','labelsMarginBottom','labelsGapHorizontal','labelsGapVertical','labelsSort','labelsShowProject','labelsShowSpace','labelsShowBands','labelsShowMachining','labelsShowGrain','labelsShowId'].forEach(id=>$(id).addEventListener(id.startsWith('labelsShow')?'change':'input',renderLabelsPreview));


