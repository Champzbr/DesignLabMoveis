// DesignLabMoveis 1.310.00 · Criação e preferências de peças.
export function createPieceEditorModule(ctx){
  const { $, toast, MIN_SIZE, parseDecimalInput, m, createBox, mm, nice, cellSize, selectSpaceCellByIds, projectCurrentOwnerId, selectedCellInfo, activeSpaceRoot, pieceCreationTargetInfo, clearSpaceSelection, spaceDefaultMaterial, productionMaterialUsesPieceThickness, saveDoorCreateConfig, applyDoorCreateConfig, setVisualMode, spaceMultiSelectionInfo, getSpaceRoot, ensureSpaceMultiSelectBar, updateDoorCreationVisibility, doorCreationConfig, COLORS, uid, renderSpaces, createDoorsInRegion, getSpaceCell, registerVerticalDivisionFixedBand, commitHistory, cellBox } = ctx;
  const moduleRegistry=ctx.moduleRegistry;
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
  const materialThickness=productionMaterialUsesPieceThickness(material)?NaN:Number(material?.thickness);
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

const PIECE_CREATE_PREFS_KEY='designlab-piece-create-prefs-v120067';
function pieceCreatePrefsStorageKey(type=pieceCreateType){
  const root=selectedCellInfo()?.root||activeSpaceRoot();
  return `${PIECE_CREATE_PREFS_KEY}:${pieceThicknessOwnerKey()}:${pieceThicknessMaterialKey(root)}:${type||'left'}`;
}
function capturePieceCreatePrefs(type=pieceCreateType){
  const val=id=>String($(id)?.value??'');
  return {
    type,
    thickness:val('pieceThickness'),frontInset:val('pieceFrontInset'),backInset:val('pieceBackInset'),
    backMachine:!!$('pieceBackMachine')?.checked,backPassLeft:val('pieceBackPassLeft'),backPassRight:val('pieceBackPassRight'),backPassTop:val('pieceBackPassTop'),backPassBottom:val('pieceBackPassBottom'),backGrooveClearance:val('pieceBackGrooveClearance'),backGrooveLeft:!!$('pieceBackGrooveLeft')?.checked,backGrooveRight:!!$('pieceBackGrooveRight')?.checked,backGrooveTop:!!$('pieceBackGrooveTop')?.checked,backGrooveBottom:!!$('pieceBackGrooveBottom')?.checked,
    position:val('piecePosition'),count:val('pieceCount'),divisionMeasure:val('pieceDivisionMeasure'),divisionSide:val('pieceDivisionSide'),
    slatOrientation:val('pieceSlatOrientation'),slatFace:val('pieceSlatFace'),slatSize:val('pieceSlatSize'),slatPosition:val('pieceSlatPosition'),
    railOrientation:val('pieceRailOrientation'),railFace:val('pieceRailFace'),railSize:val('pieceRailSize'),railPosition:val('pieceRailPosition'),
    savedAt:new Date().toISOString()
  };
}
function savePieceCreateConfig(){
  try{
    const cfg=capturePieceCreatePrefs(pieceCreateType);
    const t=parseDecimalInput(cfg.thickness);
    if(!Number.isFinite(t)||t<1){toast('Confira a espessura antes de salvar');return false;}
    cfg.thickness=String(t);
    localStorage.setItem(pieceCreatePrefsStorageKey(pieceCreateType),JSON.stringify(cfg));
    savePieceThicknessPreference({silent:true});
    if(pieceCreateType==='doors')saveDoorCreateConfig({silent:true});
    toast(`Configuração de ${pieceTypeName(pieceCreateType)} salva`);
    return true;
  }catch(err){console.error('Salvar configuração de peça:',err);toast('Não foi possível salvar esta configuração');return false;}
}
function applyPieceCreateConfig(type=pieceCreateType){
  let cfg=null;
  try{cfg=JSON.parse(localStorage.getItem(pieceCreatePrefsStorageKey(type))||'null');}catch{}
  if(!cfg||typeof cfg!=='object')return false;
  const set=(id,v)=>{if($(id)&&v!==undefined&&v!==null)$(id).value=String(v);};
  set('pieceThickness',cfg.thickness);set('pieceFrontInset',cfg.frontInset);set('pieceBackInset',cfg.backInset);
  if($('pieceBackMachine')&&cfg.backMachine!==undefined)$('pieceBackMachine').checked=!!cfg.backMachine;
  set('pieceBackPassLeft',cfg.backPassLeft);set('pieceBackPassRight',cfg.backPassRight);set('pieceBackPassTop',cfg.backPassTop);set('pieceBackPassBottom',cfg.backPassBottom);set('pieceBackGrooveClearance',cfg.backGrooveClearance);
  if($('pieceBackGrooveLeft')&&cfg.backGrooveLeft!==undefined)$('pieceBackGrooveLeft').checked=!!cfg.backGrooveLeft;
  if($('pieceBackGrooveRight')&&cfg.backGrooveRight!==undefined)$('pieceBackGrooveRight').checked=!!cfg.backGrooveRight;
  if($('pieceBackGrooveTop')&&cfg.backGrooveTop!==undefined)$('pieceBackGrooveTop').checked=!!cfg.backGrooveTop;
  if($('pieceBackGrooveBottom')&&cfg.backGrooveBottom!==undefined)$('pieceBackGrooveBottom').checked=!!cfg.backGrooveBottom;
  set('piecePosition',cfg.position);set('pieceCount',cfg.count);set('pieceDivisionMeasure',cfg.divisionMeasure);set('pieceDivisionSide',cfg.divisionSide);
  set('pieceSlatOrientation',cfg.slatOrientation);set('pieceSlatFace',cfg.slatFace);set('pieceSlatSize',cfg.slatSize);set('pieceSlatPosition',cfg.slatPosition);
  set('pieceRailOrientation',cfg.railOrientation);set('pieceRailFace',cfg.railFace);set('pieceRailSize',cfg.railSize);set('pieceRailPosition',cfg.railPosition);
  if(type==='doors')applyDoorCreateConfig();
  return true;
}

// ---------- Criar peças dentro da divisão ----------
let pieceCreateType='left';
let pieceTypeLastClickButton=null;
let pieceTypeLastClickAt=0;
let pieceTypeQuickCreateBusy=false;
const PIECE_TYPE_DOUBLE_CLICK_MS=520;
function selectPieceCreateTypeButton(button,{loadSaved=true}={}){
  if(!button)return;
  pieceCreateType=button.dataset.pieceType||'left';
  document.querySelectorAll('[data-piece-type]').forEach(x=>x.classList.toggle('active',x===button));
  if(loadSaved)applyPieceCreateConfig(pieceCreateType);
  updateCreatePiecesUI();
}
function quickCreatePieceFromTypeButton(button){
  if(pieceTypeQuickCreateBusy||!button)return;
  pieceTypeQuickCreateBusy=true;
  try{
    selectPieceCreateTypeButton(button);
    if(createPiecesInSelectedCell()){
      savePieceThicknessPreference({silent:true});
      $('createPiecesDialog').style.display='none';
    }
  } finally {
    // trava somente durante a chamada atual; o diálogo já fecha quando deu certo.
    pieceTypeQuickCreateBusy=false;
    pieceTypeLastClickButton=null;
    pieceTypeLastClickAt=0;
  }
}
function pieceTypeName(type){
  return ({left:'Lateral esquerda',right:'Lateral direita',division:'Divisão vertical',base:'Base',top:'Chapéu',shelf:'Prateleira',shelves:'Prateleiras',slat:'Ripas',rail:'Sarrafos',back:'Fundo',front:'Frente',doors:'Portas'})[type]||'Peça';
}

function backMachiningConfig(){
  const n=id=>Math.max(0,parseDecimalInput($(id)?.value)||0);
  return {
    enabled:!!$('pieceBackMachine')?.checked,
    left:n('pieceBackPassLeft'),right:n('pieceBackPassRight'),top:n('pieceBackPassTop'),bottom:n('pieceBackPassBottom'),
    clearance:n('pieceBackGrooveClearance'),
    grooveLeft:!!$('pieceBackGrooveLeft')?.checked,grooveRight:!!$('pieceBackGrooveRight')?.checked,grooveTop:!!$('pieceBackGrooveTop')?.checked,grooveBottom:!!$('pieceBackGrooveBottom')?.checked
  };
}
function pieceAabb(o){
  if(!o?.userData)return null;
  const w=Number(o.userData.width),h=Number(o.userData.height),d=Number(o.userData.depth);
  if(!(w>0&&h>0&&d>0))return null;
  return {minX:o.position.x-w/2,maxX:o.position.x+w/2,minY:o.position.y-h/2,maxY:o.position.y+h/2,minZ:o.position.z-d/2,maxZ:o.position.z+d/2};
}
function overlap1d(a0,a1,b0,b1){return Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));}
function backAdjacentPiece(root,cell,side){
  const tol=.0025, objs=Array.isArray(ctx.runtimeModel?.objects)?ctx.runtimeModel.objects:[];
  const candidates=[];
  for(const o of objs){
    const u=o?.userData||{};if(u.spaceRootId!==root.id||u.kind!=='panel'||u.drawerSetId||u.doorSystem||u.doorConfig)continue;
    const b=pieceAabb(o);if(!b)continue;
    let dist=Infinity,score=0;
    if(side==='left'){dist=Math.abs(b.maxX-cell.minX);score=overlap1d(b.minY,b.maxY,cell.minY,cell.maxY)*overlap1d(b.minZ,b.maxZ,cell.minZ,cell.maxZ);}
    if(side==='right'){dist=Math.abs(b.minX-cell.maxX);score=overlap1d(b.minY,b.maxY,cell.minY,cell.maxY)*overlap1d(b.minZ,b.maxZ,cell.minZ,cell.maxZ);}
    if(side==='bottom'){dist=Math.abs(b.maxY-cell.minY);score=overlap1d(b.minX,b.maxX,cell.minX,cell.maxX)*overlap1d(b.minZ,b.maxZ,cell.minZ,cell.maxZ);}
    if(side==='top'){dist=Math.abs(b.minY-cell.maxY);score=overlap1d(b.minX,b.maxX,cell.minX,cell.maxX)*overlap1d(b.minZ,b.maxZ,cell.minZ,cell.maxZ);}
    if(dist<=tol&&score>1e-7)candidates.push({o,b,dist,score});
  }
  candidates.sort((a,b)=>a.dist-b.dist||b.score-a.score);
  return candidates[0]||null;
}
function addBackGroove(owner,{side,panelBounds,panelThicknessMm,clearanceMm,depthMm,rootId}){
  if(!owner||!(depthMm>0))return false;
  const machining=moduleRegistry.get('machiningShapes');
  const ti=machining?.pieceThicknessInfo?.(owner);if(!ti)return false;
  const ob=pieceAabb(owner);if(!ob)return false;
  const grooveW=Math.min(ti.dims.z||Infinity,Math.max(.1,panelThicknessMm+clearanceMm));
  let entryAxis,lengthAxis,length,start,zStart;
  if(side==='left'||side==='right'){
    if(![ti.uAxis,ti.vAxis].includes('y')||![ti.uAxis,ti.vAxis].includes('z'))return false;
    entryAxis=side==='left'?'-x':'+x';lengthAxis='y';
    start=Math.max(0,mm(panelBounds.minY-ob.minY));
    length=Math.min(mm(ob.maxY-ob.minY)-start,mm(panelBounds.maxY-panelBounds.minY));
    zStart=Math.max(0,mm(panelBounds.minZ-ob.minZ)-clearanceMm/2);
  }else{
    if(![ti.uAxis,ti.vAxis].includes('x')||![ti.uAxis,ti.vAxis].includes('z'))return false;
    entryAxis=side==='bottom'?'-y':'+y';lengthAxis='x';
    start=Math.max(0,mm(panelBounds.minX-ob.minX));
    length=Math.min(mm(ob.maxX-ob.minX)-start,mm(panelBounds.maxX-panelBounds.minX));
    zStart=Math.max(0,mm(panelBounds.minZ-ob.minZ)-clearanceMm/2);
  }
  if(!(length>.1))return false;
  const coordRef={x:0,y:0,z:zStart};coordRef[lengthAxis]=start;
  const op={id:uid('mach'),type:'groove',entryAxis,coordRef,x:0,y:0,z:0,through:false,fullLength:false,autoLength:false,lengthAxis,length,width:grooveW,depth:Math.min(ti.thickness,depthMm),preset:'back-groove',rearOffset:Math.max(0,zStart),backAutoRootId:rootId,backAutoSide:side};
  Object.assign(op,machining.resolvedMachiningCoords?.(owner,op)||{});
  (owner.userData.machining||(owner.userData.machining=[])).push(op);
  machining.sanitizeMachiningForPiece?.(owner);
  return true;
}
function machineBackPanelAroundCell(root,cell,backPanel,cfg){
  if(!cfg.enabled)return {created:0,missing:[]};
  const pb=pieceAabb(backPanel);if(!pb)return {created:0,missing:['geometria']};
  const t=mm(Number(backPanel.userData?.depth)||0),missing=[];let created=0;
  const specs=[['left',cfg.left,cfg.grooveLeft],['right',cfg.right,cfg.grooveRight],['top',cfg.top,cfg.grooveTop],['bottom',cfg.bottom,cfg.grooveBottom]];
  for(const [side,pass,selected] of specs){
    if(!selected||!(pass>0))continue;
    const hit=backAdjacentPiece(root,cell,side);
    if(!hit){missing.push(side);continue;}
    if(addBackGroove(hit.o,{side,panelBounds:pb,panelThicknessMm:t,clearanceMm:cfg.clearance,depthMm:pass,rootId:root.id}))created++;
    else missing.push(side);
  }
  moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals');
  return {created,missing};
}
function openCreatePiecesDialog(initialType='left',{doorRegion=false}={}){
  if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
  const region=doorRegion?spaceMultiSelectionInfo():null;
  if(doorRegion&&(!region||!region.ok)){toast(region?.reason||'Selecione os espaços da porta');return false;}
  if(!doorRegion&&!ctx.selectedSpaceCell){toast('Selecione uma divisão');return false;}

  ctx.doorRegionSelectionMode=!!doorRegion;
  pieceCreateType=initialType||'left';
  pieceTypeLastClickButton=null;pieceTypeLastClickAt=0;
  document.querySelectorAll('[data-piece-type]').forEach(b=>b.classList.toggle('active',b.dataset.pieceType===pieceCreateType));
  const root=doorRegion?region.root:getSpaceRoot(ctx.selectedSpaceCell.rootId);
  applySavedPieceThickness(root);

  $('pieceFrontInset').value=0;$('pieceBackInset').value=0;$('piecePosition').value=0;$('pieceCount').value=3;
  if($('pieceBackMachine'))$('pieceBackMachine').checked=true;['pieceBackPassLeft','pieceBackPassRight','pieceBackPassTop','pieceBackPassBottom'].forEach(id=>{if($(id))$(id).value=10;});if($('pieceBackGrooveClearance'))$('pieceBackGrooveClearance').value=.5;['pieceBackGrooveLeft','pieceBackGrooveRight','pieceBackGrooveTop','pieceBackGrooveBottom'].forEach(id=>{if($(id))$(id).checked=true;});
  $('pieceDivisionMeasure').value=0;$('pieceDivisionSide').value='gap1';
  if($('pieceSlatOrientation'))$('pieceSlatOrientation').value='horizontal';if($('pieceSlatFace'))$('pieceSlatFace').value='front';if($('pieceSlatSize'))$('pieceSlatSize').value=100;if($('pieceSlatPosition'))$('pieceSlatPosition').value=0;
  if($('pieceRailOrientation'))$('pieceRailOrientation').value='horizontal';if($('pieceRailFace'))$('pieceRailFace').value='front';if($('pieceRailSize'))$('pieceRailSize').value=100;if($('pieceRailPosition'))$('pieceRailPosition').value=0;
  $('doorCount').value=2;$('doorGapLeft').value=2;$('doorGapRight').value=2;$('doorGapTop').value=2;$('doorGapBottom').value=2;$('doorGapMiddle').value=2;
  $('doorHandleType').value='none';$('doorHandleSize').value=20;$('doorHandleOrientation').value='horizontal';$('doorCavaPosition').value='top';
  $('doorCreateHingeHoles').checked=true;$('doorHingeCount').value='auto';$('doorHingeSide').value='auto';
  $('doorHingeCupDiameter').value=35;$('doorHingeCupDepth').value=12;$('doorHingeCupEdge').value=22.5;$('doorHingeEdgeY').value=100;
  $('doorCreateSideHoles').checked=true;$('doorMountFrontOffset').value=37;$('doorMountSpacing').value=32;$('doorMountDiameter').value=5;$('doorMountDepth').value=12;

  applyPieceCreateConfig(pieceCreateType);
  const dlg=$('createPiecesDialog'),grid=dlg?.querySelector('.pieceTypeGrid');
  if(grid)grid.style.display=doorRegion?'none':'';
  if($('createPiecesTitle'))$('createPiecesTitle').textContent=doorRegion?'🚪 Criar porta na seleção':'Criar peças';
  if($('createPiecesHelp'))$('createPiecesHelp').innerHTML=doorRegion
    ? 'A porta será criada <strong>na frente da região definida pelos espaços selecionados</strong>. Você pode usar só os vãos de referência; prateleiras e divisões entre eles entram automaticamente no tamanho externo.'
    : 'As peças usam a divisão selecionada e cortam o espaço automaticamente. A faixa ocupada pela peça deixa de ser vão livre; o restante vira novas divisões.';
  if(doorRegion)ensureSpaceMultiSelectBar().style.display='none';
  dlg.style.display='flex';
  try{updateCreatePiecesUI();}catch(err){console.error('Criar peças:',err);toast('Erro ao abrir Criar peças: '+(err.message||err));return false;}
  return true;
}
function pieceDivisionLayoutMm(widthM,thicknessM){
  const total=mm(widthM),thickness=mm(thicknessM);
  const free=total-thickness;
  if(!(free>0))return {ok:false,total,thickness,gap1:0,gap2:0,message:'A espessura da divisão ocupa toda a largura.'};

  let measure=parseDecimalInput($('pieceDivisionMeasure')?.value);
  if(!Number.isFinite(measure)||measure<0)measure=0;
  const side=$('pieceDivisionSide')?.value==='gap2'?'gap2':'gap1';

  let gap1,gap2,centered=measure<=.000001;
  if(centered){
    gap1=free/2;
    gap2=free-gap1;
  }else if(side==='gap2'){
    gap2=measure;
    gap1=free-gap2;
  }else{
    gap1=measure;
    gap2=free-gap1;
  }

  const minMm=mm(MIN_SIZE);
  const ok=gap1>=minMm-.001&&gap2>=minMm-.001;
  return {
    ok,total,thickness,free,gap1,gap2,measure,side,centered,minMm,
    message:ok?'':`Cada vão precisa ter pelo menos ${nice(minMm)} mm.`
  };
}

function updateCreatePiecesUI(){
  const info=pieceCreationTargetInfo(); if(!info)return;
  const s=info.size, t=Math.max(.001,m(parseDecimalInput($('pieceThickness').value))||.018);
  const front=Math.max(0,m(parseDecimalInput($('pieceFrontInset').value))||0), back=Math.max(0,m(parseDecimalInput($('pieceBackInset').value))||0);
  const usableDepth=Math.max(.001,s.depth-front-back);
  const isShelf=pieceCreateType==='shelf', isMulti=pieceCreateType==='shelves';
  const isDepthPiece=pieceCreateType==='back'||pieceCreateType==='front';
  const isDoors=pieceCreateType==='doors';
  const isDivision=pieceCreateType==='division';
  const isSlat=pieceCreateType==='slat';
  const isRail=pieceCreateType==='rail';
  $('piecePositionLabel').classList.toggle('hiddenField',!isShelf);
  $('pieceCountLabel').classList.toggle('hiddenField',!isMulti);
  $('pieceDistributionLabel').classList.toggle('hiddenField',!isMulti);
  $('pieceDivisionFields').classList.toggle('hiddenField',!isDivision);
  $('pieceSlatFields')?.classList.toggle('hiddenField',!isSlat);
  $('pieceRailFields')?.classList.toggle('hiddenField',!isRail);
  $('doorGapFields').classList.toggle('hiddenField',!isDoors);
  $('backMachiningFields')?.classList.toggle('hiddenField',pieceCreateType!=='back');
  updateDoorCreationVisibility();
  // Fundo ocupa a profundidade pela própria espessura, mas pode ser afastado da
  // traseira. Nesse caso o campo "Recuo fundo" passa a significar a distância
  // livre atrás do painel. Frente continua sem recuos próprios.
  // A divisão usa os mesmos recuos das laterais, para poder ser mais rasa que o móvel.
  $('pieceFrontInsetLabel').classList.toggle('hiddenField',isDepthPiece||isDoors||isSlat||isRail);
  $('pieceBackInsetLabel').classList.toggle('hiddenField',pieceCreateType==='front'||isDoors||isSlat||isRail);
  const backCaption=$('pieceBackInsetCaption');
  if(backCaption)backCaption.textContent=pieceCreateType==='back'?'Afastar da traseira (mm)':'Recuo fundo (mm)';
  $('pieceTarget').textContent=info.isDoorRegion
    ? `Região selecionada: ${info.selectedCount} espaço(s) · L ${mm(s.width)} × P ${mm(s.depth)} × A ${mm(s.height)} mm`
    : `Divisão: ${mm(s.width)} × ${mm(s.depth)} × ${mm(s.height)} mm`;
  let text='';
  if(pieceCreateType==='left'||pieceCreateType==='right') text=`${pieceTypeName(pieceCreateType)}: ${mm(t)} × ${mm(usableDepth)} × ${mm(s.height)} mm`;
  else if(isDivision){
    const d=pieceDivisionLayoutMm(s.width,t);
    const mode=d.centered?'centralizada':(d.side==='gap1'?'medida aplicada no 1º vão':'medida aplicada no 2º vão');
    $('pieceDivisionPreview').innerHTML=d.ok
      ? `<strong>Vão 1:</strong> ${nice(d.gap1)} mm &nbsp;·&nbsp; <strong>Divisão:</strong> ${nice(d.thickness)} mm &nbsp;·&nbsp; <strong>Vão 2:</strong> ${nice(d.gap2)} mm<br><span style="color:var(--muted)">${mode}</span>`
      : `<strong style="color:#ff7169">${d.message}</strong><br>Vão 1: ${nice(d.gap1)} mm · Divisão: ${nice(d.thickness)} mm · Vão 2: ${nice(d.gap2)} mm`;
    text=d.ok
      ? `Divisão vertical: ${nice(d.thickness)} × ${nice(mm(usableDepth))} × ${nice(mm(s.height))} mm · Vão 1 ${nice(d.gap1)} mm · Vão 2 ${nice(d.gap2)} mm`
      : d.message;
  }
  else if(pieceCreateType==='base'||pieceCreateType==='top') text=`${pieceTypeName(pieceCreateType)}: ${mm(s.width)} × ${mm(usableDepth)} × ${mm(t)} mm`;
  else if(pieceCreateType==='back'){
    const offsetMm=Math.max(0,parseDecimalInput($('pieceBackInset').value)||0),bc=backMachiningConfig();
    const freeFrontMm=mm(s.depth)-offsetMm-mm(t);
    const panelW=mm(s.width)+bc.left+bc.right,panelH=mm(s.height)+bc.top+bc.bottom;
    text=freeFrontMm>=-0.001
      ? `Fundo: ${nice(panelW)} × ${mm(t)} × ${nice(panelH)} mm · afastado ${nice(offsetMm)} mm da traseira · livre atrás ${nice(offsetMm)} mm · livre à frente ${nice(Math.max(0,freeFrontMm))} mm${bc.enabled?' · encaixe usinado':''}`
      : 'O afastamento + a espessura do fundo ultrapassam a profundidade deste espaço.';
    if($('pieceBackMachiningPreview')){
      const selectedSides=[bc.grooveLeft&&'Esq.',bc.grooveRight&&'Dir.',bc.grooveTop&&'Cima',bc.grooveBottom&&'Baixo'].filter(Boolean);
      $('pieceBackMachiningPreview').textContent=bc.enabled
        ? `Fundo passa: E ${nice(bc.left)} · D ${nice(bc.right)} · cima ${nice(bc.top)} · baixo ${nice(bc.bottom)} mm · usinar: ${selectedSides.length?selectedSides.join(' · '):'nenhum lado'} · rasgo ${nice(mm(t)+bc.clearance)} mm.`
        : 'Usinagem desativada · fundo fica somente no tamanho do vão.';
    }
  }
  else if(pieceCreateType==='front') text=`Frente: ${mm(s.width)} × ${mm(t)} × ${mm(s.height)} mm`;
  else if(isDoors){
    const dc=doorCreationConfig(s);
    const cavaSide=dc.handleOrientation==='vertical'?(dc.cavaPosition==='right'?'direita':'esquerda'):(dc.cavaPosition==='bottom'?'baixo':'cima');
    const handleText=dc.handleType==='cava'?` · cava ${nice(dc.handleSize)} mm · ${dc.handleOrientation==='vertical'?'vertical':'horizontal'} · ${cavaSide} (descontada)`:' · sem puxador';
    const hingeText=dc.hingeEnabled?` · ${dc.hingeCount} dobradiça(s)/porta · copo Ø${nice(dc.cupDiameter)} × ${nice(dc.cupDepth)} mm${dc.mountEnabled?' + placa na lateral':''}`:' · sem furação de dobradiça';
    text=(dc.doorW>0&&dc.doorH>0) ? `${dc.count} porta(s): cada uma ${nice(dc.doorW)} × ${mm(t)} × ${nice(dc.doorH)} mm · vãos E ${nice(dc.gl)} / D ${nice(dc.gr)} / C ${nice(dc.gt)} / B ${nice(dc.gb)} / M ${nice(dc.gm)} mm${handleText}${hingeText}` : 'Os vãos/desconto informados não cabem nesta divisão.';
    if($('doorHingePreview'))$('doorHingePreview').textContent=dc.hingeEnabled
      ? `${dc.hingeCount} dobradiça(s) por porta · copo Ø${nice(dc.cupDiameter)} mm · ${dc.mountEnabled?`placa: linha ${nice(dc.mountFrontOffset)} mm da frente / ${nice(dc.mountSpacing)} mm entre furos`:'somente furo na porta'}`
      : 'Furação de dobradiça desativada';
  } else if(isSlat){
    const orient=$('pieceSlatOrientation')?.value==='vertical'?'vertical':'horizontal';
    const face=$('pieceSlatFace')?.value==='back'?'back':'front';
    const sizeMm=Math.max(1,parseDecimalInput($('pieceSlatSize')?.value)||100);
    let posMm=Math.max(0,parseDecimalInput($('pieceSlatPosition')?.value)||0);
    const axisMm=orient==='horizontal'?mm(s.height):mm(s.width);
    const maxPos=Math.max(0,axisMm-sizeMm);
    const actualPos=posMm<=.000001?maxPos/2:Math.min(posMm,maxPos);
    const orientLabel=orient==='horizontal'?'horizontal':'vertical';
    const faceLabel=face==='front'?'frente':'fundo';
    text=sizeMm>axisMm+.001
      ? `A ripa de ${nice(sizeMm)} mm não cabe neste espaço.`
      : `Ripa ${orientLabel} · ${faceLabel} · ${nice(sizeMm)} mm · ${nice(mm(t))} mm de espessura · ${posMm<=.000001?'centralizada':`posição ${nice(actualPos)} mm`} · corta o espaço automaticamente`;
  } else if(isRail){
    const orient=$('pieceRailOrientation')?.value==='vertical'?'vertical':'horizontal';
    const face=$('pieceRailFace')?.value==='back'?'back':'front';
    const sizeMm=Math.max(1,parseDecimalInput($('pieceRailSize')?.value)||100);
    // Sarrafo atravessa a LARGURA do vão e fica na parte SUPERIOR.
    // Horizontal = deitado: tamanho ocupa a profundidade e a espessura ocupa a altura.
    // Vertical   = em pé: espessura ocupa a profundidade e tamanho ocupa a altura.
    const cutDepthMm=orient==='horizontal'?sizeMm:mm(t);
    const cutHeightMm=orient==='horizontal'?mm(t):sizeMm;
    const fits=cutDepthMm<=mm(s.depth)+.001 && cutHeightMm<=mm(s.height)+.001;
    const remainDepth=Math.max(0,mm(s.depth)-cutDepthMm);
    const remainHeight=Math.max(0,mm(s.height)-cutHeightMm);
    text=!fits
      ? `O sarrafo de ${nice(sizeMm)} mm não cabe neste espaço.`
      : `Sarrafo ${orient==='horizontal'?'horizontal (deitado)':'vertical (em pé)'} · superior ${face==='front'?'frontal':'traseiro'} · comprimento ${nice(mm(s.width))} mm · ocupa ${nice(cutDepthMm)} mm da profundidade e ${nice(cutHeightMm)} mm da altura · espaço restante ${nice(mm(s.width))} × ${nice(remainDepth)} × ${nice(remainHeight)} mm`;
  } else if(isShelf){
    let rawPos=parseDecimalInput($('piecePosition').value);
    if(!Number.isFinite(rawPos)||rawPos<0)rawPos=0;

    // 1.100.2: zero significa CENTRALIZAR.
    // Ex.: vão 900 mm, prateleira 18 mm:
    // espaço livre = 882 mm -> 441 mm embaixo + 18 + 441 mm em cima.
    const freeH=Math.max(0,s.height-t);
    let pos=rawPos<=.000001?freeH/2:m(rawPos);
    pos=Math.min(Math.max(0,pos),freeH);

    const bottomGap=pos;
    const topGap=Math.max(0,s.height-t-pos);
    text=rawPos<=.000001
      ? `Prateleira: ${mm(s.width)} × ${mm(usableDepth)} × ${mm(t)} mm · CENTRALIZADA · vão baixo ${mm(bottomGap)} mm · vão cima ${mm(topGap)} mm`
      : `Prateleira: ${mm(s.width)} × ${mm(usableDepth)} × ${mm(t)} mm · base a ${mm(pos)} mm do piso desta divisão`;
  } else if(isMulti){
    const n=Math.max(1,Math.min(50,Math.round(Number($('pieceCount').value)||1)));
    const free=s.height-n*t;
    if(free<=0) text=`As ${n} prateleiras (${mm(n*t)} mm) não cabem na altura de ${mm(s.height)} mm.`;
    else { const gap=free/(n+1); text=`${n} prateleiras de ${mm(t)} mm · ${n+1} vãos iguais de ${mm(gap)} mm (espessuras já descontadas).`; }
  }
  $('pieceCreateInfo').textContent=text;
}
function replaceCellWithFreeRegions(root, oldCell, regions, preferred='largest'){
  const idx=root.cells.findIndex(c=>c.id===oldCell.id);
  if(idx<0) throw new Error('A divisão selecionada não existe mais');
  const valid=regions.filter(c=>(c.maxX-c.minX)>=MIN_SIZE && (c.maxY-c.minY)>=MIN_SIZE && (c.maxZ-c.minZ)>=MIN_SIZE)
                     .map(c=>({...c,id:uid('cell')}));
  root.cells.splice(idx,1,...valid);
  renderSpaces();
  // Se a peça preencher 100% da divisão selecionada (por exemplo, um Fundo
  // de 6 mm dentro de um corte de 6 mm), não existe sobra dentro daquela
  // célula. Nesse caso, selecionamos automaticamente o maior vão livre que
  // já existia no mesmo espaço em vez de simplesmente perder a seleção.
  if(!valid.length){
    if(root.cells.length){
      const target=root.cells.reduce((a,b)=>{
        const sa=cellSize(a), sb=cellSize(b);
        return (sb.width*sb.depth*sb.height)>(sa.width*sa.depth*sa.height)?b:a;
      },root.cells[0]);
      selectSpaceCellByIds(root.id,target.id);
      return target;
    }
    clearSpaceSelection();
    return null;
  }
  let target=valid[0];
  if(preferred==='last') target=valid[valid.length-1];
  else if(preferred==='largest'){
    target=valid.reduce((a,b)=>{
      const sa=cellSize(a), sb=cellSize(b);
      const va=sa.width*sa.depth*sa.height, vb=sb.width*sb.depth*sb.height;
      return vb>va?b:a;
    },valid[0]);
  }
  selectSpaceCellByIds(root.id,target.id);
  return target;
}

// Tolerância de encaixe entre uma peça e uma divisão criada manualmente.
// 0,5 mm evita bloquear por pequenas diferenças de ponto flutuante.
const PIECE_FIT_TOL=.0005;
function pieceFitsWholeAxis(pieceSize,cellSizeM){
  return Math.abs(pieceSize-cellSizeM)<=PIECE_FIT_TOL;
}

function subtractBoxFromCell(cell,box){
  const b={
    minX:Math.max(cell.minX,box.minX),maxX:Math.min(cell.maxX,box.maxX),
    minY:Math.max(cell.minY,box.minY),maxY:Math.min(cell.maxY,box.maxY),
    minZ:Math.max(cell.minZ,box.minZ),maxZ:Math.min(cell.maxZ,box.maxZ)
  };
  if(b.maxX<=b.minX||b.maxY<=b.minY||b.maxZ<=b.minZ)return [{...cell}];
  const out=[];
  if(b.minX-cell.minX>=MIN_SIZE)out.push({...cell,maxX:b.minX});
  if(cell.maxX-b.maxX>=MIN_SIZE)out.push({...cell,minX:b.maxX});
  const mx0=b.minX,mx1=b.maxX;
  if(b.minY-cell.minY>=MIN_SIZE)out.push({...cell,minX:mx0,maxX:mx1,maxY:b.minY});
  if(cell.maxY-b.maxY>=MIN_SIZE)out.push({...cell,minX:mx0,maxX:mx1,minY:b.maxY});
  const my0=b.minY,my1=b.maxY;
  if(b.minZ-cell.minZ>=MIN_SIZE)out.push({...cell,minX:mx0,maxX:mx1,minY:my0,maxY:my1,maxZ:b.minZ});
  if(cell.maxZ-b.maxZ>=MIN_SIZE)out.push({...cell,minX:mx0,maxX:mx1,minY:my0,maxY:my1,minZ:b.maxZ});
  return out;
}

function createPiecesInSelectedCell(){
  const info=pieceCreationTargetInfo(); if(!info){toast(ctx.doorRegionSelectionMode?'A seleção de espaços não é mais válida':'Selecione uma divisão');return false;}
  const regionDoor=!!info.isDoorRegion;
  const root=info.root, c={...info.cell}, s=info.size;
  const t=m(parseDecimalInput($('pieceThickness').value)),front=m(parseDecimalInput($('pieceFrontInset').value)),back=m(parseDecimalInput($('pieceBackInset').value));
  if(![t,front,back].every(Number.isFinite)||t<.001||front<0||back<0){toast('Confira as medidas');return false;}
  const depth=s.depth-front-back;
  if(depth<.001){toast('Os recuos ultrapassam a profundidade');return false;}
  // Trás/fundo é -Z e frente é +Z na vista frontal.
  const z=(c.minZ+back + c.maxZ-front)/2;
  const common={depth,kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)};
  const newFree=[];
  let createdCount=0;
  let affectsSpace=true;
  let divisionFixedInterval=null;
  ctx.historyMuted=true;
  try{
    if(pieceCreateType==='left'){
      const fillsWhole=pieceFitsWholeAxis(t,s.width);
      if(t>s.width+PIECE_FIT_TOL) throw new Error('A espessura da lateral é maior que esta divisão');
      if(!fillsWhole && t>s.width-MIN_SIZE) throw new Error('A lateral não deixa espaço livre suficiente');
      const pieceW=fillsWhole?s.width:t;
      createBox({...common,width:pieceW,height:s.height,x:fillsWhole?info.center.x:c.minX+pieceW/2,yBase:c.minY,z,name:'Lateral esquerda'},false);
      if(!fillsWhole) newFree.push({...c,minX:c.minX+pieceW});
      createdCount=1;
    } else if(pieceCreateType==='right'){
      const fillsWhole=pieceFitsWholeAxis(t,s.width);
      if(t>s.width+PIECE_FIT_TOL) throw new Error('A espessura da lateral é maior que esta divisão');
      if(!fillsWhole && t>s.width-MIN_SIZE) throw new Error('A lateral não deixa espaço livre suficiente');
      const pieceW=fillsWhole?s.width:t;
      createBox({...common,width:pieceW,height:s.height,x:fillsWhole?info.center.x:c.maxX-pieceW/2,yBase:c.minY,z,name:'Lateral direita'},false);
      if(!fillsWhole) newFree.push({...c,maxX:c.maxX-pieceW});
      createdCount=1;
    } else if(pieceCreateType==='division'){
      if(t>=s.width-2*MIN_SIZE) throw new Error('A divisão não deixa dois vãos livres suficientes');
      const d=pieceDivisionLayoutMm(s.width,t);
      if(!d.ok) throw new Error(d.message||'Confira a medida da divisão');

      const gap1=m(d.gap1),gap2=m(d.gap2);
      const x0=c.minX+gap1;
      const x1=x0+t;

      // Peça vertical no ponto definido. Vão 1 = esquerda; Vão 2 = direita
      // olhando o móvel de frente.
      const divisionPiece=createBox({
        ...common,
        width:t,
        height:s.height,
        x:(x0+x1)/2,
        yBase:c.minY,
        z,
        name:'Divisão vertical'
      },false);
      divisionPiece.userData.divisionNominalThicknessM=t;
      divisionFixedInterval={x0,x1};

      newFree.push({...c,maxX:x0});
      newFree.push({...c,minX:x1});
      createdCount=1;
    } else if(pieceCreateType==='base'){
      const fillsWhole=pieceFitsWholeAxis(t,s.height);
      if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura da base é maior que esta divisão');
      if(!fillsWhole && t>s.height-MIN_SIZE) throw new Error('A base não deixa espaço livre suficiente');
      const pieceH=fillsWhole?s.height:t;
      createBox({...common,width:s.width,height:pieceH,x:info.center.x,yBase:c.minY,z,name:'Base'},false);
      if(!fillsWhole) newFree.push({...c,minY:c.minY+pieceH});
      createdCount=1;
    } else if(pieceCreateType==='top'){
      const fillsWhole=pieceFitsWholeAxis(t,s.height);
      if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura do chapéu é maior que esta divisão');
      if(!fillsWhole && t>s.height-MIN_SIZE) throw new Error('O chapéu não deixa espaço livre suficiente');
      const pieceH=fillsWhole?s.height:t;
      createBox({...common,width:s.width,height:pieceH,x:info.center.x,yBase:fillsWhole?c.minY:c.maxY-pieceH,z,name:'Chapéu'},false);
      if(!fillsWhole) newFree.push({...c,maxY:c.maxY-pieceH});
      createdCount=1;
    } else if(pieceCreateType==='slat'){
      const orient=$('pieceSlatOrientation')?.value==='vertical'?'vertical':'horizontal';
      const face=$('pieceSlatFace')?.value==='back'?'back':'front';
      const size=m(Math.max(1,parseDecimalInput($('pieceSlatSize')?.value)||100));
      let posRaw=Math.max(0,parseDecimalInput($('pieceSlatPosition')?.value)||0);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura da ripa é maior que a profundidade deste espaço');
      if(orient==='horizontal'&&size>s.height+PIECE_FIT_TOL) throw new Error('A altura da ripa é maior que este espaço');
      if(orient==='vertical'&&size>s.width+PIECE_FIT_TOL) throw new Error('A largura da ripa é maior que este espaço');
      const pieceD=Math.min(t,s.depth);
      const zc=face==='front'?c.maxZ-pieceD/2:c.minZ+pieceD/2;
      let pieceW,pieceH,x,yBase;
      if(orient==='horizontal'){
        pieceW=s.width;pieceH=Math.min(size,s.height);x=info.center.x;
        const free=Math.max(0,s.height-pieceH),pos=posRaw<=.000001?free/2:Math.min(m(posRaw),free);
        yBase=c.minY+pos;
      }else{
        pieceW=Math.min(size,s.width);pieceH=s.height;yBase=c.minY;
        const free=Math.max(0,s.width-pieceW),pos=posRaw<=.000001?free/2:Math.min(m(posRaw),free);
        x=c.minX+pos+pieceW/2;
      }
      const slat=createBox({width:pieceW,depth:pieceD,height:pieceH,x,yBase,z:zc,name:`Ripa ${orient==='horizontal'?'horizontal':'vertical'} · ${face==='front'?'frente':'fundo'}`,kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)},false);
      slat.userData.slatConfig={orientation:orient,face,sizeMm:mm(size),positionMm:posRaw};
      const box={minX:x-pieceW/2,maxX:x+pieceW/2,minY:yBase,maxY:yBase+pieceH,minZ:zc-pieceD/2,maxZ:zc+pieceD/2};
      newFree.push(...subtractBoxFromCell(c,box));
      createdCount=1;
    } else if(pieceCreateType==='rail'){
      const orient=$('pieceRailOrientation')?.value==='vertical'?'vertical':'horizontal';
      const face=$('pieceRailFace')?.value==='back'?'back':'front';
      const size=m(Math.max(1,parseDecimalInput($('pieceRailSize')?.value)||100));
      // r23: o sarrafo continua sendo uma travessa SUPERIOR na frente ou atrás,
      // mas agora recorta o ESPAÇO útil nas duas dimensões da sua seção.
      // Ex.: horizontal 100 mm com MDF 18 mm em vão P600 => P500 e A-18.
      let pieceW=s.width,pieceD,pieceH;
      if(orient==='horizontal'){
        if(size>s.depth+PIECE_FIT_TOL) throw new Error('O tamanho do sarrafo é maior que a profundidade deste espaço');
        if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura do sarrafo é maior que a altura deste espaço');
        pieceD=Math.min(size,s.depth);
        pieceH=Math.min(t,s.height);
      }else{
        if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura do sarrafo é maior que a profundidade deste espaço');
        if(size>s.height+PIECE_FIT_TOL) throw new Error('O tamanho do sarrafo é maior que a altura deste espaço');
        pieceD=Math.min(t,s.depth);
        pieceH=Math.min(size,s.height);
      }
      if(s.depth-pieceD<MIN_SIZE) throw new Error('O sarrafo não deixa profundidade livre suficiente');
      if(s.height-pieceH<MIN_SIZE) throw new Error('O sarrafo não deixa altura livre suficiente');
      const x=info.center.x;
      const yBase=c.maxY-pieceH;
      const zc=face==='front'?c.maxZ-pieceD/2:c.minZ+pieceD/2;
      const localLabel=face==='front'?'superior frontal':'superior traseiro';
      const rail=createBox({width:pieceW,depth:pieceD,height:pieceH,x,yBase,z:zc,name:`Sarrafo ${orient==='horizontal'?'horizontal':'vertical'} · ${localLabel}`,kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)},false);
      rail.userData.railConfig={orientation:orient,face,sizeMm:mm(size),placement:localLabel,structural:true,affectsSpace:true,cutDepthMm:mm(pieceD),cutHeightMm:mm(pieceH)};
      // O vão útil fica simultaneamente abaixo do sarrafo e fora da faixa de profundidade dele.
      // Não criamos uma segunda célula estreita atrás/na frente da peça: o objetivo é que
      // o espaço selecionável restante já seja o volume realmente utilizável para novas peças.
      const remaining={...c,maxY:c.maxY-pieceH};
      if(face==='front') remaining.maxZ=c.maxZ-pieceD;
      else remaining.minZ=c.minZ+pieceD;
      newFree.push(remaining);
      createdCount=1;
    } else if(pieceCreateType==='back'){
      // Para Fundo, o campo "Recuo fundo" é a distância entre a traseira do
      // vão e a face traseira do painel. A faixa ocupada pelo próprio painel é
      // removida do espaço e, quando houver afastamento, ficam DOIS vãos livres:
      // um atrás e outro à frente. Assim o painel nunca "encavala" o espaço.
      const backOffset=Math.max(0,back);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura do fundo é maior que esta divisão');
      if(backOffset+t>s.depth+PIECE_FIT_TOL) throw new Error('O afastamento + a espessura do fundo ultrapassam a profundidade');
      const pieceD=Math.min(t,s.depth-backOffset),bc=backMachiningConfig();
      const z0=c.minZ+backOffset, z1=z0+pieceD;
      const passL=m(bc.left),passR=m(bc.right),passT=m(bc.top),passB=m(bc.bottom);
      const backPanel=createBox({width:s.width+passL+passR,depth:pieceD,height:s.height+passT+passB,x:info.center.x+(passR-passL)/2,yBase:c.minY-passB,z:(z0+z1)/2,name:'Fundo',kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)},false);
      const machiningResult=machineBackPanelAroundCell(root,c,backPanel,bc);
      backPanel.userData.backMachiningConfig={...bc};
      if(machiningResult.missing.length)window.__lastBackMachiningWarning=machiningResult.missing.slice();
      if(backOffset>=MIN_SIZE) newFree.push({...c,maxZ:z0});
      if(c.maxZ-z1>=MIN_SIZE) newFree.push({...c,minZ:z1});
      createdCount=1;
    } else if(pieceCreateType==='front'){
      const fillsWhole=pieceFitsWholeAxis(t,s.depth);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura da frente é maior que esta divisão');
      if(!fillsWhole && t>s.depth-MIN_SIZE) throw new Error('A frente não deixa espaço livre suficiente');
      const pieceD=fillsWhole?s.depth:t;
      createBox({width:s.width,depth:pieceD,height:s.height,x:info.center.x,yBase:c.minY,z:fillsWhole?info.center.z:c.maxZ-pieceD/2,name:'Frente',kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)},false);
      if(!fillsWhole) newFree.push({...c,maxZ:c.maxZ-pieceD});
      createdCount=1;
    } else if(pieceCreateType==='doors'){
      const result=createDoorsInRegion(info,t,{minSizeM:MIN_SIZE,fitTol:PIECE_FIT_TOL});
      createdCount=result.createdCount;affectsSpace=false;
      window.__lastDoorCreateStats=result.stats;
    } else if(pieceCreateType==='shelf'){
      const fillsWhole=pieceFitsWholeAxis(t,s.height);
      if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura da prateleira é maior que esta divisão');
      if(!fillsWhole && t>s.height-MIN_SIZE) throw new Error('A prateleira não cabe nessa altura');
      if(fillsWhole){
        createBox({...common,width:s.width,height:s.height,x:info.center.x,yBase:c.minY,z,name:'Prateleira'},false);
        createdCount=1;
      } else {
      let rawPos=parseDecimalInput($('piecePosition').value);
      if(!Number.isFinite(rawPos)||rawPos<0)rawPos=0;

      const freeH=Math.max(0,s.height-t);
      // Zero = centro exato do espaço livre, já descontando a espessura.
      // Valor > 0 continua sendo a medida da base da prateleira a partir
      // do piso do vão selecionado.
      let pos=rawPos<=.000001?freeH/2:m(rawPos);
      pos=Math.min(Math.max(0,pos),freeH);

      const y0=c.minY+pos, y1=y0+t;
      createBox({...common,width:s.width,height:t,x:info.center.x,yBase:y0,z,name:'Prateleira'},false);
      if(y0-c.minY>=MIN_SIZE) newFree.push({...c,maxY:y0});
      if(c.maxY-y1>=MIN_SIZE) newFree.push({...c,minY:y1});
      createdCount=1;
      }
    } else if(pieceCreateType==='shelves'){
      const n=Math.max(1,Math.min(50,Math.round(Number($('pieceCount').value)||1)));
      const free=s.height-n*t;
      if(free<(n+1)*MIN_SIZE) throw new Error('As prateleiras não deixam vãos suficientes nessa altura');
      const gap=free/(n+1);
      let cursor=c.minY;
      for(let i=0;i<n;i++){
        const gapEnd=cursor+gap;
        newFree.push({...c,minY:cursor,maxY:gapEnd});
        const shelfBase=gapEnd;
        createBox({...common,width:s.width,height:t,x:info.center.x,yBase:shelfBase,z,name:`Prateleira ${i+1}`},false);
        cursor=shelfBase+t;
        createdCount++;
      }
      newFree.push({...c,minY:cursor,maxY:c.maxY});
    }

    // A própria peça vira o "corte": a região ocupada desaparece da lista de
    // vãos livres e somente os espaços restantes continuam selecionáveis.
    if(affectsSpace) replaceCellWithFreeRegions(root,c,newFree,'largest');
    else if(regionDoor){
      const firstId=info.cellIds?.find(id=>!!getSpaceCell(root.id,id));
      if(firstId)selectSpaceCellByIds(root.id,firstId,{showMenu:false});
      else clearSpaceSelection();
    }else selectSpaceCellByIds(root.id,c.id);

    // A faixa ocupada pela Divisão vertical fica fixa na espessura da chapa.
    // O restante do móvel é que absorve futuros redimensionamentos.
    if(divisionFixedInterval){
      registerVerticalDivisionFixedBand(root,divisionFixedInterval.x0,divisionFixedInterval.x1);
    }
  } catch(err){
    ctx.historyMuted=false;
    toast(err.message||'Não foi possível criar');
    return false;
  }
  ctx.historyMuted=false;
  commitHistory();
  const filledWhole = affectsSpace && createdCount===1 && newFree.length===0;
  if(pieceCreateType==='doors'){
    const st=window.__lastDoorCreateStats||{count:createdCount,hinges:0,mountHoles:0,missingMount:0};
    const hingeText=st.hinges?` · ${st.hinges} copo(s) de dobradiça · ${st.mountHoles} furo(s) de placa`:'';
    const missing=st.missingMount?` · ${st.missingMount} dobradiça(s) sem lateral/divisão encontrada`:'';
    toast(`${st.count||createdCount} porta(s) criada(s)${hingeText}${missing}`);
    window.__lastDoorCreateStats=null;
  }
  else if(pieceCreateType==='division'){
    const d=pieceDivisionLayoutMm(s.width,t);
    toast(`Divisão criada · Vão 1 ${nice(d.gap1)} mm · Vão 2 ${nice(d.gap2)} mm`);
  }
  else if(pieceCreateType==='shelf' && parseDecimalInput($('piecePosition').value)<=0){
    toast('Prateleira criada no centro · espessura descontada do vão');
  }
  else if(pieceCreateType==='slat'){
    const orient=$('pieceSlatOrientation')?.value==='vertical'?'vertical':'horizontal';
    const face=$('pieceSlatFace')?.value==='back'?'fundo':'frente';
    toast(`Ripa ${orient} criada na ${face} · espaço recortado automaticamente`);
  }
  else if(pieceCreateType==='rail'){
    const orient=$('pieceRailOrientation')?.value==='vertical'?'vertical':'horizontal';
    const face=$('pieceRailFace')?.value==='back'?'traseiro':'frontal';
    toast(`Sarrafo ${orient} criado no superior ${face} · espaço recortado`);
  }
  else if(pieceCreateType==='back'){
    const warn=Array.isArray(window.__lastBackMachiningWarning)?window.__lastBackMachiningWarning:[];
    const labels={left:'esquerda',right:'direita',top:'cima',bottom:'baixo'};
    toast(warn.length?`Fundo criado · não encontrei peça para usinar: ${warn.map(x=>labels[x]||x).join(', ')}`:'Fundo criado · encaixes e rasgos automáticos aplicados');
    window.__lastBackMachiningWarning=null;
  }
  else toast(createdCount>1 ? `${createdCount} prateleiras criadas · espaço dividido` : (filledWhole ? 'Peça criada · corte preenchido' : 'Peça criada · espaço dividido automaticamente'));
  return true;
}


  const state={get pieceCreateType(){return pieceCreateType;},set pieceCreateType(v){pieceCreateType=v||'left';},get pieceTypeLastClickButton(){return pieceTypeLastClickButton;},set pieceTypeLastClickButton(v){pieceTypeLastClickButton=v;},get pieceTypeLastClickAt(){return pieceTypeLastClickAt;},set pieceTypeLastClickAt(v){pieceTypeLastClickAt=Number(v)||0;},PIECE_TYPE_DOUBLE_CLICK_MS};
  return {state, savePieceThicknessPreference, pieceThicknessPreference:readPieceThicknessPreference, pieceCreatePrefsStorageKey, capturePieceCreatePrefs, savePieceCreateConfig, applyPieceCreateConfig, selectPieceCreateTypeButton, quickCreatePieceFromTypeButton, pieceTypeName, openCreatePiecesDialog, pieceDivisionLayoutMm, updateCreatePiecesUI, replaceCellWithFreeRegions, pieceFitsWholeAxis, createPiecesInSelectedCell};
}
