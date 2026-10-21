// DesignLabMoveis 1.311.00 · Produção, histórico e montagem.
export function createProductionSuiteModule(ctx){
  const { $, THREE, projects, toast, projectStateHasContent, projectNow, projectDbGet, projectDbPut, projectBelongsToCurrentOwner, projectIsoMs, cloudSaveProjectRecord, auth, projectAutosaveNow, projectCurrentOwnerId, projectEmergencyKey, captureProjectThumbnail, STORAGE_KEY, escapeHtml, captureState, captureProjectCamera, restoreProjectCamera, DESIGNLAB_APP_VERSION, updateProjectChrome, applyProjectPresentationScene, applyState, resetProjectHistory, normalizePieceEdgeBands, productionObjectKind, productionMaterialById, productionMaterialKind, pieceThicknessInfo, productionMaterialUsesPieceThickness, normalizePieceGrainRotation, groupAspireProjectParts, buildMingliZawFiles, getSheetPrefs, normalizedSheetPrefs, cutPlanPartAreaMm2, allProjectFurnitureParts, allProjectProductionPartsByKind, cutPlanAssignCodes, cutPlanPackOpen, nice, csvLine, layerNum, frameFurnitureVisual, orthoCamera, returnTo3D, setVisualMode, viewSpace, safeFileName, downloadText, scene, labelsPrefs, labelsBuildItems, labelsPrintDocument, buildPartsCsv, buildLabelsBaseCsv, buildMachiningCsv, buildSheetsCsv, buildPanelSawCutsCsv, zipStore, dlLayoutState, dlLayoutIsDoor, dlLayoutIsFront, dlLayoutPopulateScope, dlLayoutBuildDirectCanvas, dlLayoutDownloadBlob, dlLayoutCanvasJpegData, dlLayoutPdfWithJpegs, dlLayoutWithTemporaryState, openTechnicalLayoutDialog, openProductionDialog, closeProductionDialog, closeToolDockBeforeMenu, syncToolDockButtons, TOOL_DOCK_CATALOG, toolDockPrefs, saveToolDockPrefs, renderToolDock, initQuickDock, repairAllDrawerBottomGrooves, repairAllDrawerDrillingForAspire, activeSpaceRoot }=ctx;
  const runtimeModel=ctx.runtimeModel;
// ============================================================================
// 1.200.42 · SEGURANÇA DO PROJETO + PRODUÇÃO + MONTAGEM
// ----------------------------------------------------------------------------
// 1) Autosave comprometido + histórico das últimas 10 versões.
// 2) Verificador "Projeto pronto para produção".
// 3) Pacote de produção completo em um único ZIP.
// 4) Vista explodida numerada + manual automático de montagem.
// ============================================================================

const DL_PRODUCTION_SUITE_VERSION='1.300.17';
const DL_PROJECT_VERSION_LIMIT=10;
const DL_COMMIT_AUTOSAVE_MS=25000;
let dlCommitAutosaveTimer=null;
let dlCommitAutosaveRunning=false;
let dlProductionLastCheck=null;
let dlProductionPackageRunning=false;
let dlAssemblyActive=false;
let dlAssemblyOriginals=[];
let dlAssemblyLabelGroup=null;
let dlAssemblyPreviousView=null;
let dlAssemblyCurrentDistance=180;

function dlProdClone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function dlProdStateHash(state){
  let s='';try{s=JSON.stringify(state||{});}catch{return 'invalid';}
  let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return `${s.length.toString(36)}-${h.toString(36)}`;
}
function dlProdVersionList(rec){return Array.isArray(rec?.versions)?rec.versions:[];}
function dlProdPushVersion(rec,reason='Versão automática'){
  if(!rec?.state||!projectStateHasContent(rec.state))return rec;
  const versions=dlProdVersionList(rec).map(v=>({...v}));
  const hash=dlProdStateHash(rec.state),last=versions.at(-1);
  if(last?.hash===hash)return {...rec,versions};
  versions.push({
    id:'ver_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),
    at:projectNow(),reason:String(reason||'Versão automática').slice(0,80),hash,
    state:dlProdClone(rec.state),camera:dlProdClone(rec.camera||null)
  });
  return {...rec,versions:versions.slice(-DL_PROJECT_VERSION_LIMIT)};
}
function dlProdVersionDate(iso){
  try{return new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}catch{return String(iso||'');}
}

async function dlCommitProjectAutosave({reason='Salvamento automático',force=false}={}){
  clearTimeout(dlCommitAutosaveTimer);dlCommitAutosaveTimer=null;
  if(dlCommitAutosaveRunning||dlAssemblyActive||!projects.state.currentProjectId||(!projects.state.currentProjectDirty&&!force))return null;
  dlCommitAutosaveRunning=true;
  try{
    let rec=(await projectDbGet(projects.state.currentProjectId))||projects.state.currentProjectRecord;
    if(!rec||!projectBelongsToCurrentOwner(rec))return null;
    if(projects.state.currentProjectDirty)rec=dlProdPushVersion(rec,reason);
    const now=projectNow();
    const next={
      ...rec,...projects.state.currentProjectRecord,
      id:projects.state.currentProjectId,ownerUserId:projectCurrentOwnerId(),
      state:captureState(),camera:captureProjectCamera(),
      createdAt:rec.createdAt||now,updatedAt:now,appVersion:DESIGNLAB_APP_VERSION||DL_PRODUCTION_SUITE_VERSION
    };
    delete next.draftState;delete next.draftCamera;delete next.draftAt;delete next.deletedAt;
    await projectDbPut(next);
    projects.state.currentProjectRecord={...next};projects.state.currentProjectDirty=false;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next.state));localStorage.removeItem(projectEmergencyKey());}catch{}
    updateProjectChrome();
    if(navigator.onLine&&auth.currentIdentityUser&&ctx.cloudAccountState.ok){queueMicrotask(()=>cloudSaveProjectRecord(next,{silent:true}));}
    return next;
  }catch(err){console.warn('Autosave comprometido 1.200.42:',err);return null;}
  finally{dlCommitAutosaveRunning=false;}
}
function dlScheduleCommitAutosave(){
  if(dlAssemblyActive||!projects.state.currentProjectId)return;
  if(dlCommitAutosaveTimer)return;
  dlCommitAutosaveTimer=setTimeout(()=>dlCommitProjectAutosave({reason:'Autosave · 25 s'}),DL_COMMIT_AUTOSAVE_MS);
}

// Mantém o draft rápido já existente (1,6 s) e acrescenta um commit real a cada
// janela de trabalho. Assim queda/stand-by tem recuperação imediata e a nuvem
// recebe uma versão estável sem salvar em excesso a cada clique.
const dlProdOriginalMarkCurrentProjectDirty=ctx.getMarkCurrentProjectDirty();
const markCurrentProjectDirty=function(){
  dlProdOriginalMarkCurrentProjectDirty();
  dlScheduleCommitAutosave();
};
ctx.setMarkCurrentProjectDirty(markCurrentProjectDirty);

// Salvar manualmente também cria um ponto de retorno do estado anterior.
const dlProdOriginalSaveCurrentProject=ctx.getSaveCurrentProject();
const saveCurrentProject=async function(opts={}){
  try{
    if(projects.state.currentProjectId){
      let rec=await projectDbGet(projects.state.currentProjectId);
      if(rec&&projectBelongsToCurrentOwner(rec)){
        rec=dlProdPushVersion(rec,'Antes do salvamento manual');
        await projectDbPut(rec);
        projects.state.currentProjectRecord={...rec,...projects.state.currentProjectRecord,versions:rec.versions};
      }
    }
  }catch(err){console.warn('Histórico antes de salvar:',err);}
  const out=await dlProdOriginalSaveCurrentProject(opts);
  if(out?.id){
    const rec=await projectDbGet(out.id).catch(()=>null);
    if(rec?.versions&&!out.versions){out.versions=rec.versions;await projectDbPut(out).catch(()=>{});}
  }
  return out;
};
ctx.setSaveCurrentProject(saveCurrentProject);

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')dlCommitProjectAutosave({reason:'App em segundo plano',force:!!projects.state.currentProjectDirty}).catch(()=>{});
});
window.addEventListener('pagehide',()=>{dlCommitProjectAutosave({reason:'Fechamento seguro',force:!!projects.state.currentProjectDirty}).catch(()=>{});});
window.addEventListener('online',()=>{
  if(projects.state.currentProjectRecord&&auth.currentIdentityUser&&ctx.cloudAccountState.ok){
    const local=projects.state.currentProjectRecord,ls=projectIsoMs(local.cloudSyncedAt),lu=projectIsoMs(local.updatedAt);
    if(lu>ls)cloudSaveProjectRecord(local,{silent:true}).catch(()=>{});
  }
});

// ---------------------------------------------------------------------------
// HISTÓRICO DE VERSÕES
// ---------------------------------------------------------------------------
async function openProjectVersionsDialog(){
  if(!projects.state.currentProjectId){toast('Abra um projeto primeiro');return;}
  await projectAutosaveNow().catch(()=>{});
  const rec=(await projectDbGet(projects.state.currentProjectId))||projects.state.currentProjectRecord;
  const box=$('projectVersionsList'),sum=$('projectVersionsSummary');
  if(!box||!rec)return;
  const versions=dlProdVersionList(rec).slice().reverse();
  sum.innerHTML=`<strong>${escapeHtml(rec.name||'Projeto')}</strong><br>${versions.length} versão(ões) guardada(s) · limite ${DL_PROJECT_VERSION_LIMIT}. O autosave rápido continua ativo entre os pontos de versão.`;
  box.innerHTML='';
  if(!versions.length){box.innerHTML='<div class="dlSuiteEmpty">Ainda não há versões anteriores. Continue editando; o primeiro ponto será criado automaticamente.</div>';}
  for(const v of versions){
    const card=document.createElement('div');card.className='dlVersionCard';
    card.innerHTML=`<div><strong>${escapeHtml(v.reason||'Versão')}</strong><span>${escapeHtml(dlProdVersionDate(v.at))}</span></div><button class="secondary" type="button">Restaurar</button>`;
    card.querySelector('button').onclick=()=>restoreProjectVersion(v.id);
    box.appendChild(card);
  }
  $('projectVersionsDialog').classList.add('show');$('projectVersionsDialog').style.display='flex';
}
function closeProjectVersionsDialog(){const d=$('projectVersionsDialog');if(d){d.classList.remove('show');d.style.display='none';}}
async function restoreProjectVersion(versionId){
  if(!projects.state.currentProjectId)return;
  let rec=await projectDbGet(projects.state.currentProjectId);if(!rec)return;
  const v=dlProdVersionList(rec).find(x=>x.id===versionId);if(!v)return;
  if(!confirm(`Restaurar a versão de ${dlProdVersionDate(v.at)}?\n\nO estado atual será guardado no histórico antes da restauração.`))return;
  rec=dlProdPushVersion({...rec,state:captureState(),camera:captureProjectCamera()},'Antes de restaurar versão');
  rec.state=dlProdClone(v.state);rec.camera=dlProdClone(v.camera);rec.updatedAt=projectNow();rec.appVersion=DESIGNLAB_APP_VERSION||DL_PRODUCTION_SUITE_VERSION;
  delete rec.draftState;delete rec.draftCamera;delete rec.draftAt;
  await projectDbPut(rec);
  projects.state.suppressProjectDirty=true;
  applyProjectPresentationScene(false);applyState(rec.state);restoreProjectCamera(rec.camera);resetProjectHistory();
  projects.state.suppressProjectDirty=false;projects.state.currentProjectRecord={...rec};projects.state.currentProjectDirty=false;updateProjectChrome();
  queueMicrotask(()=>cloudSaveProjectRecord(rec,{silent:true}));
  closeProjectVersionsDialog();toast('Versão restaurada · estado anterior ficou guardado no histórico');
}

// ---------------------------------------------------------------------------
// VERIFICADOR DE PRODUÇÃO
// ---------------------------------------------------------------------------
function dlProdPhysicalObjects({includeExcluded=true}={}){
  return runtimeModel.objects.filter(o=>{
    const u=o?.userData||{};
    if(!o||u.kind==='space-cell'||u.kind==='cylinder'||u.kind==='hardware-visual'||u.isSpacePickMesh||u.isMachiningDraftPreview)return false;
    if(!includeExcluded&&u.excludeFromCutList)return false;
    return true;
  });
}
function dlProdIssue(level,title,detail='',objectsList=[]){return {level,title,detail,count:objectsList.length||0,objects:objectsList};}
function dlProdPieceLabel(o){return String(o?.userData?.name||'Peça sem nome');}
function dlProdHasAnyBand(o){const b=normalizePieceEdgeBands(o?.userData?.edgeBands||{});return ['uMin','uMax','vMin','vMax'].some(k=>!!b[k]);}
function dlProdFitsSheet(o,mat){
  if(productionMaterialKind(mat)!=='sheet')return true;
  const ti=pieceThicknessInfo(o);if(!ti||!mat)return true;
  const w=ti.faceW,h=ti.faceH,sw=Number(mat.sheetWidth)||0,sh=Number(mat.sheetHeight)||0;
  if(sw<=0||sh<=0)return false;
  if(mat.grain||o.userData?.materialGrain){
    const rot=normalizePieceGrainRotation(o.userData?.materialGrainRotation);
    const sheetAlongLength=(mat.grainDirection||'length')!=='width';
    // Convenção 1.311.00-r17: 0° acompanha o maior lado da peça; 90° o menor.
    const faceWIsMajor=Number(w)>=Number(h);
    const pieceAlongFaceW=rot===0?faceWIsMajor:!faceWIsMajor;
    const rotatePlacement=sheetAlongLength?!pieceAlongFaceW:pieceAlongFaceW;
    return rotatePlacement?(h<=sw+.01&&w<=sh+.01):(w<=sw+.01&&h<=sh+.01);
  }
  return (w<=sw+.01&&h<=sh+.01)||(w<=sh+.01&&h<=sw+.01);
}
async function checkProjectReadyForProduction({render=true}={}){
  const issues=[],all=dlProdPhysicalObjects({includeExcluded:true}),pieces=all.filter(o=>!o.userData?.excludeFromCutList),excluded=all.filter(o=>o.userData?.excludeFromCutList);
  if(!projects.state.currentProjectId)issues.push(dlProdIssue('error','Nenhum projeto aberto','Abra ou crie um projeto antes de preparar a produção.'));
  if(!pieces.length)issues.push(dlProdIssue('error','Nenhuma peça para produzir','Todas as peças estão ausentes ou marcadas como “não produzir”.'));

  const unnamed=pieces.filter(o=>!String(o.userData?.name||'').trim()||/^(cubo|box|peça|painel)$/i.test(String(o.userData?.name||'').trim()));
  if(unnamed.length)issues.push(dlProdIssue('warning','Peças com nome genérico',`${unnamed.length} peça(s) ainda podem receber um nome técnico.`,unnamed));

  const noMaterial=pieces.filter(o=>!o.userData?.materialId||!productionMaterialById(o.userData?.materialId));
  if(noMaterial.length)issues.push(dlProdIssue('error','Material não definido',`${noMaterial.length} peça(s) sem material/chapa válida.`,noMaterial));

  const thicknessMismatch=pieces.filter(o=>{
    const mat=productionMaterialById(o.userData?.materialId),ti=pieceThicknessInfo(o);if(!mat||!ti)return false;
    return !productionMaterialUsesPieceThickness(mat)&&Math.abs(Number(mat.thickness)-Number(ti.thickness))>.31;
  });
  if(thicknessMismatch.length)issues.push(dlProdIssue('error','Espessura diferente do material',`${thicknessMismatch.length} peça(s) têm espessura geométrica diferente da chapa cadastrada.`,thicknessMismatch));

  const tooBig=pieces.filter(o=>{const m=productionMaterialById(o.userData?.materialId);return m&&productionMaterialKind(m)==='sheet'&&!dlProdFitsSheet(o,m);});
  if(tooBig.length)issues.push(dlProdIssue('error','Peça maior que a chapa',`${tooBig.length} peça(s) não cabem na chapa cadastrada respeitando o veio.`,tooBig));

  const badGrain=pieces.filter(o=>o.userData?.materialGrain&&![0,90].includes(normalizePieceGrainRotation(o.userData?.materialGrainRotation)));
  if(badGrain.length)issues.push(dlProdIssue('warning','Sentido do veio fora do padrão',`${badGrain.length} peça(s) precisam confirmar 0° ou 90°.`,badGrain));

  const frontsWithoutBands=pieces.filter(o=>productionObjectKind(o)==='sheet'&&(dlLayoutIsDoor?.(o)||dlLayoutIsFront?.(o))&&!dlProdHasAnyBand(o));
  if(frontsWithoutBands.length)issues.push(dlProdIssue('warning','Portas/frentes sem fita',`${frontsWithoutBands.length} porta(s)/frente(s) não têm fita de borda definida.`,frontsWithoutBands));

  if(excluded.length)issues.push(dlProdIssue('info','Peças marcadas “não produzir”',`${excluded.length} peça(s) ficam no 3D, mas não entram na produção.`,excluded));

  const doors=pieces.filter(o=>dlLayoutIsDoor?.(o)),drawerFronts=pieces.filter(o=>dlLayoutIsFront?.(o));
  const mach=pieces.reduce((n,o)=>n+(o.userData?.machining||[]).length,0);
  const sheetPieces=pieces.filter(o=>productionObjectKind(o)==='sheet');
  const woodPieces=pieces.filter(o=>productionObjectKind(o)==='wood');
  const metalPieces=pieces.filter(o=>productionObjectKind(o)==='metal');
  issues.push(dlProdIssue('ok','Estrutura reconhecida',`${pieces.length} peça(s) · ${doors.length} porta(s) · ${drawerFronts.length} frente(s) de gaveta · ${mach} usinagem(ns).`));
  if(woodPieces.length)issues.push(dlProdIssue('info','Plano separado · Madeira maciça',`${woodPieces.length} peça(s) irão para pranchas, fora do plano de chapas.`,woodPieces));
  if(metalPieces.length)issues.push(dlProdIssue('info','Plano separado · Ferro / Metalon',`${metalPieces.length} peça(s) irão para barras, fora do plano de chapas.`,metalPieces));

  let groups=[],cfg=null,zawCount=0;
  if(sheetPieces.length){
    try{
      cfg=getSheetPrefs();groups=groupAspireProjectParts(cfg);
      issues.push(dlProdIssue('ok','Plano de chapas calculado',`${groups.length} chapa(s) física(s) calculada(s) com as configurações atuais.`));
      if(cfg.cutMode==='panel'){
        zawCount=buildMingliZawFiles(groups,cfg).length;
        issues.push(dlProdIssue(zawCount?'ok':'warning','Mingli/ZAW',zawCount?`${zawCount} arquivo(s) ZAW pronto(s) para a seccionadora.`:'Nenhum ZAW foi gerado. Confira as peças e o plano mestre.'));
      }else issues.push(dlProdIssue('info','Mingli/ZAW não ativo','O plano de chapas atual está em CNC. Para ZAW, use o modo Seccionadora.'));
    }catch(err){issues.push(dlProdIssue('error','Falha ao calcular plano de chapas',err.message||'Não foi possível organizar as peças nas chapas.'));}
  }else issues.push(dlProdIssue('info','Sem peças de chapa','O projeto atual possui somente madeira/perfis ou peças sem chapa.'));

  const errors=issues.filter(x=>x.level==='error').length,warnings=issues.filter(x=>x.level==='warning').length;
  const result={at:projectNow(),ready:errors===0,errors,warnings,issues,stats:{pieces:pieces.length,excluded:excluded.length,doors:doors.length,drawerFronts:drawerFronts.length,machining:mach,sheets:groups.length,wood:woodPieces.length,metal:metalPieces.length,zaw:zawCount},groups,cfg};
  dlProductionLastCheck=result;
  if(render)dlRenderProductionCheck(result);
  return result;
}
function dlIssueIcon(level){return level==='error'?'✕':level==='warning'?'!':level==='ok'?'✓':'i';}
function dlRenderProductionCheck(result){
  const summary=$('productionSuiteSummary'),list=$('productionSuiteIssues');if(!summary||!list)return;
  summary.className='dlSuiteStatus '+(result.ready?'ready':'attention');
  summary.innerHTML=result.ready
    ? `<strong>✓ Projeto pronto para produção</strong><span>${result.stats.pieces} peça(s) · ${result.stats.sheets} chapa(s) · ${result.warnings} aviso(s) não bloqueante(s)</span>`
    : `<strong>⚠ ${result.errors} item(ns) precisam de atenção</strong><span>${result.stats.pieces} peça(s) analisada(s) · ${result.warnings} aviso(s)</span>`;
  list.innerHTML='';
  for(const it of result.issues){
    const row=document.createElement('div');row.className=`dlCheckRow ${it.level}`;
    row.innerHTML=`<b class="dlCheckIcon">${dlIssueIcon(it.level)}</b><div><strong>${escapeHtml(it.title)}</strong><span>${escapeHtml(it.detail||'')}</span>${it.objects?.length?`<small>${escapeHtml(it.objects.slice(0,6).map(dlProdPieceLabel).join(' · '))}${it.objects.length>6?' · …':''}</small>`:''}</div>`;
    list.appendChild(row);
  }
}
async function openProductionSuiteDialog(){
  if(!projects.state.currentProjectId){toast('Abra um projeto primeiro');return;}
  $('morePanel')&&($('morePanel').style.display='none');
  const d=$('productionSuiteDialog');d.classList.add('show');d.style.display='flex';
  $('productionSuiteSummary').innerHTML='<strong>Analisando projeto…</strong><span>Materiais, peças, chapas, veio, fitas e produção.</span>';
  $('productionSuiteIssues').innerHTML='';
  await checkProjectReadyForProduction({render:true});
}
function closeProductionSuiteDialog(){const d=$('productionSuiteDialog');if(d){d.classList.remove('show');d.style.display='none';}}

// ---------------------------------------------------------------------------
// 1.200.99 · PLANOS SEPARADOS: MADEIRA MACIÇA E PERFIS METÁLICOS
// ---------------------------------------------------------------------------
function dlLinearPieceLengthMm(p){
  const d=p?.dims||{};
  return Math.max(Number(d.x)||0,Number(d.y)||0,Number(d.z)||0);
}
function dlPackMetalBars(parts,stockLength=6000,kerf=3){
  const ordered=parts.map(p=>({...p,cutLength:dlLinearPieceLengthMm(p)})).sort((a,b)=>b.cutLength-a.cutLength);
  const bars=[];
  for(const p of ordered){
    if(!(p.cutLength>0))continue;
    if(p.cutLength>stockLength+.001)throw new Error(`${p.name}: ${nice(p.cutLength)} mm é maior que a barra de ${nice(stockLength)} mm.`);
    let best=-1,bestRemain=Infinity;
    for(let i=0;i<bars.length;i++){
      const b=bars[i],extra=(b.parts.length?kerf:0)+p.cutLength,remain=stockLength-(b.used+extra);
      if(remain>=-.001&&remain<bestRemain){best=i;bestRemain=remain;}
    }
    if(best<0)bars.push({used:p.cutLength,parts:[p]});
    else{
      const b=bars[best];b.used+=(b.parts.length?kerf:0)+p.cutLength;b.parts.push(p);
    }
  }
  return bars.map((b,i)=>({...b,index:i+1,waste:Math.max(0,stockLength-b.used)}));
}
function dlWoodPlanGroups(){
  const parts=allProjectProductionPartsByKind('wood'),map=new Map();
  for(const p of parts){
    const m=productionMaterialById(p.materialId)||p.materialRecord||{};
    const key=`${p.materialId||p.material}_${layerNum(p.thickness)}mm`;
    if(!map.has(key))map.set(key,{material:m,thickness:p.thickness,parts:[]});
    map.get(key).parts.push(p);
  }
  return [...map.values()];
}
function dlMetalPlanGroups(){
  const parts=allProjectProductionPartsByKind('metal'),map=new Map();
  for(const p of parts){
    const m=productionMaterialById(p.materialId)||p.materialRecord||{};
    const key=p.materialId||p.material||'metal';
    if(!map.has(key))map.set(key,{material:m,parts:[]});
    map.get(key).parts.push(p);
  }
  return [...map.values()];
}
function dlRenderGeneralPartsSummary(){
  const el=$('partsGeneralSummary');if(!el)return;
  const sheet=allProjectProductionPartsByKind('sheet').length,wood=allProjectProductionPartsByKind('wood').length,metal=allProjectProductionPartsByKind('metal').length,total=sheet+wood+metal;
  el.innerHTML=`<div class="cutPlanSummaryGrid"><span><b>${total}</b><small>peças produzidas</small></span><span><b>${sheet}</b><small>peças de chapa</small></span><span><b>${wood}</b><small>madeira maciça</small></span><span><b>${metal}</b><small>ferro / Metalon</small></span></div><div class="cutPlanSummaryText"><strong>Peças gerais</strong> · todos os sistemas de produção reunidos abaixo sem misturar os otimizadores.</div>`;
}
function dlRenderWoodPlanInto(content,summary){
  if(!content||!summary)return;
  content.innerHTML='';
  const groups=dlWoodPlanGroups();
  if(!groups.length){summary.className='dlSuiteStatus attention';summary.innerHTML='<strong>Sem peças de madeira maciça</strong><span>Aplique um material da categoria Madeira maciça às peças.</span>';return;}
  let totalPlanks=0,totalPieces=0;
  for(const g of groups){
    const mat=g.material||{},stockLength=Number(mat.stockLength||mat.sheetWidth||6000),stockWidth=Number(mat.stockWidth||mat.sheetHeight||250);
    const cfg={...normalizedSheetPrefs(getSheetPrefs()),width:stockLength,height:stockWidth,margin:0,gap:3,grain:true,grainDirection:'length',cutMode:'cnc',optimization:'advanced',direction:'length',keepLength:100,keepWidth:20};
    let planks=[];
    try{planks=cutPlanPackOpen(g.parts,cfg);}catch(err){
      const row=document.createElement('div');row.className='dlCheckRow error';row.innerHTML=`<b class="dlCheckIcon">✕</b><div><strong>${escapeHtml(mat.name||'Madeira maciça')}</strong><span>${escapeHtml(err.message||'Não foi possível organizar as peças na prancha.')}</span></div>`;content.appendChild(row);continue;
    }
    totalPlanks+=planks.length;totalPieces+=g.parts.length;
    const row=document.createElement('div');row.className='dlCheckRow ok';
    const details=planks.map((pl,i)=>{
      const usedArea=pl.placements.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),pct=usedArea/Math.max(1,stockLength*stockWidth)*100;
      const pieces=pl.placements.map(p=>`${p.name} ${nice(p.faceW)}×${nice(p.faceH)}`).join(' · ');
      return `Prancha ${i+1}: ${nice(stockLength)}×${nice(stockWidth)} mm · ${nice(pct)}% · ${pieces}`;
    }).join('<br>');
    row.innerHTML=`<b class="dlCheckIcon">✓</b><div><strong>${escapeHtml(mat.name||'Madeira maciça')} · ${nice(g.thickness)} mm</strong><span>${planks.length} prancha(s) · ${g.parts.length} peça(s) · matéria-prima ${nice(stockLength)} × ${nice(stockWidth)} mm</span><small>${details}</small></div>`;
    content.appendChild(row);
  }
  summary.className='dlSuiteStatus ready';summary.innerHTML=`<strong>🪵 Plano de madeira</strong><span>${totalPieces} peça(s) · ${totalPlanks} prancha(s) · corte separado do MDF, mas visível junto em Peças gerais.</span>`;
}
function dlRenderMetalPlanInto(content,summary){
  if(!content||!summary)return;
  content.innerHTML='';
  const groups=dlMetalPlanGroups();
  if(!groups.length){summary.className='dlSuiteStatus attention';summary.innerHTML='<strong>Sem peças de ferro/perfil</strong><span>Aplique Metalon ou outro perfil metálico às peças.</span>';return;}
  let totalBars=0,totalPieces=0;
  for(const g of groups){
    const mat=g.material||{},stockLength=Number(mat.stockLength||mat.sheetWidth||6000),kerf=3;
    let bars=[];
    try{bars=dlPackMetalBars(g.parts,stockLength,kerf);}catch(err){
      const row=document.createElement('div');row.className='dlCheckRow error';row.innerHTML=`<b class="dlCheckIcon">✕</b><div><strong>${escapeHtml(mat.name||'Perfil metálico')}</strong><span>${escapeHtml(err.message||'Não foi possível organizar as barras.')}</span></div>`;content.appendChild(row);continue;
    }
    totalBars+=bars.length;totalPieces+=g.parts.length;
    const profile=mat.profileWidth&&mat.profileHeight?`${nice(mat.profileWidth)}×${nice(mat.profileHeight)} mm`:'perfil cadastrado';
    const details=bars.map(b=>`Barra ${b.index}: ${b.parts.map(p=>`${p.name} ${nice(dlLinearPieceLengthMm(p))}`).join(' + ')} · sobra ${nice(b.waste)} mm`).join('<br>');
    const row=document.createElement('div');row.className='dlCheckRow ok';
    row.innerHTML=`<b class="dlCheckIcon">✓</b><div><strong>${escapeHtml(mat.name||'Perfil metálico')} · ${profile}</strong><span>${bars.length} barra(s) de ${nice(stockLength)} mm · ${g.parts.length} peça(s) · corte considerado 3 mm</span><small>${details}</small></div>`;
    content.appendChild(row);
  }
  summary.className='dlSuiteStatus ready';summary.innerHTML=`<strong>▰ Plano de ferro / Metalon</strong><span>${totalPieces} peça(s) · ${totalBars} barra(s) · corte separado das chapas, mas visível junto em Peças gerais.</span>`;
}
function dlRenderWoodPlan(){dlRenderWoodPlanInto($('linearMaterialPlanContent'),$('linearMaterialPlanSummary'));}
function dlRenderMetalPlan(){dlRenderMetalPlanInto($('linearMaterialPlanContent'),$('linearMaterialPlanSummary'));}
function dlRenderInlineLinearPlans(){
  dlRenderGeneralPartsSummary();
  dlRenderWoodPlanInto($('partsWoodPlan'),$('partsWoodPlanSummary'));
  dlRenderMetalPlanInto($('partsMetalPlan'),$('partsMetalPlanSummary'));
}
function dlWoodPlanCsv(){
  let c=csvLine(['Material','Espessura_mm','Prancha','Comprimento_prancha_mm','Largura_prancha_mm','Peca','Espaco','Largura_peca_mm','Comprimento_peca_mm']);
  for(const g of dlWoodPlanGroups()){
    const mat=g.material||{},stockLength=Number(mat.stockLength||mat.sheetWidth||6000),stockWidth=Number(mat.stockWidth||mat.sheetHeight||250);
    const cfg={...normalizedSheetPrefs(getSheetPrefs()),width:stockLength,height:stockWidth,margin:0,gap:3,grain:true,grainDirection:'length',cutMode:'cnc',optimization:'advanced',direction:'length',keepLength:100,keepWidth:20};
    const planks=cutPlanPackOpen(g.parts,cfg);
    planks.forEach((pl,i)=>pl.placements.forEach(p=>{c+=csvLine([mat.name||p.material,g.thickness,i+1,stockLength,stockWidth,p.name,p.spaceName||'',p.faceW,p.faceH]);}));
  }
  return c;
}
function dlMetalPlanCsv(){
  let c=csvLine(['Material','Perfil_mm','Barra','Comprimento_barra_mm','Peca','Espaco','Corte_mm','Sobra_barra_mm']);
  for(const g of dlMetalPlanGroups()){
    const mat=g.material||{},stockLength=Number(mat.stockLength||mat.sheetWidth||6000),profile=mat.profileWidth&&mat.profileHeight?`${nice(mat.profileWidth)}x${nice(mat.profileHeight)}`:'';
    const bars=dlPackMetalBars(g.parts,stockLength,3);
    bars.forEach(b=>b.parts.forEach(p=>{c+=csvLine([mat.name||p.material,profile,b.index,stockLength,p.name,p.spaceName||'',dlLinearPieceLengthMm(p),b.waste]);}));
  }
  return c;
}
function openLinearMaterialPlan(kind){
  const d=$('linearMaterialPlanDialog');if(!d)return;
  $('linearMaterialPlanTitle').textContent=kind==='metal'?'▰ Plano de corte · Ferro / Metalon':'🪵 Plano de corte · Madeira maciça';
  $('linearMaterialPlanHelp').textContent=kind==='metal'?'Otimização por barras lineares. O padrão Metalon 20×30 usa barra de 6000 mm.':'Otimização em pranchas. O padrão inicial de madeira maciça usa 6000 × 250 mm e pode ser personalizado.';
  d.classList.add('show');d.style.display='flex';
  if(kind==='metal')dlRenderMetalPlan();else dlRenderWoodPlan();
}
function closeLinearMaterialPlanDialog(){const d=$('linearMaterialPlanDialog');if(d){d.classList.remove('show');d.style.display='none';}}

// ---------------------------------------------------------------------------
// VISTA EXPLODIDA + MANUAL DE MONTAGEM
// ---------------------------------------------------------------------------
function dlAssemblyParts(){
  let parts=allProjectFurnitureParts().filter(p=>p?.object);
  try{parts=cutPlanAssignCodes(parts);}catch{}
  parts.sort((a,b)=>dlAssemblyRank(a)-dlAssemblyRank(b)||String(a.name).localeCompare(String(b.name),'pt-BR',{numeric:true}));
  return parts.map((p,i)=>({...p,assemblyNumber:i+1}));
}
function dlAssemblyRank(p){
  const o=p.object,u=o.userData||{},n=String(p.name||u.name||'').toLowerCase(),r=String(u.drawerRole||'').toLowerCase();
  if(/base|rodap|sóculo|soculo/.test(n))return 10;
  if(/lateral/.test(n))return 20;
  if(/divis|montante/.test(n))return 30;
  if(/chap[eé]u|tampo|topo/.test(n))return 40;
  if(/prateleira/.test(n))return 50;
  if(/fundo/.test(n)&&!r)return 60;
  if(r||/gaveta|contra frente|contra fundo/.test(n))return 70;
  if(dlLayoutIsDoor?.(o)||dlLayoutIsFront?.(o)||/porta|frente/.test(n))return 80;
  return 55;
}
function dlAssemblyStepTitle(rank){return ({10:'Base e rodapé',20:'Laterais',30:'Divisões e montantes',40:'Chapéu / tampo',50:'Prateleiras e peças internas',55:'Demais componentes',60:'Fundos',70:'Gavetas e corrediças',80:'Portas e frentes'})[rank]||'Montagem';}
function dlAssemblySteps(){
  const parts=dlAssemblyParts();
  const map=new Map();for(const p of parts){const rank=dlAssemblyRank(p);if(!map.has(rank,[]))map.set(rank,[]);map.get(rank).push(p);}
  return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([rank,items],i)=>({number:i+1,rank,title:dlAssemblyStepTitle(rank),items}));
}
function dlAssemblyDirection(p,center){
  const o=p.object,n=String(p.name||o.userData?.name||'').toLowerCase(),r=String(o.userData?.drawerRole||'').toLowerCase();
  if(dlLayoutIsDoor?.(o)||dlLayoutIsFront?.(o)||/porta|frente/.test(n)||r)return new THREE.Vector3(0,0,1);
  if(/fundo/.test(n))return new THREE.Vector3(0,0,-1);
  if(/lateral.*esq|esquerda/.test(n))return new THREE.Vector3(-1,0,0);
  if(/lateral.*dir|direita/.test(n))return new THREE.Vector3(1,0,0);
  if(/base|rodap|sóculo|soculo/.test(n))return new THREE.Vector3(0,-1,0);
  if(/chap[eé]u|tampo|topo/.test(n))return new THREE.Vector3(0,1,0);
  const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new THREE.Vector3()),v=c.sub(center);
  if(/prateleira/.test(n))return new THREE.Vector3(0,v.y>=0?1:-1,0);
  if(/divis|montante/.test(n))return new THREE.Vector3(v.x>=0?1:-1,0,0);
  if(v.lengthSq()<1e-6)v.set(1,0,0);return v.normalize();
}
function dlAssemblySprite(num){
  const c=document.createElement('canvas');c.width=128;c.height=128;const g=c.getContext('2d');g.clearRect(0,0,128,128);g.fillStyle='#fff';g.strokeStyle='#111';g.lineWidth=8;g.beginPath();g.arc(64,64,48,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#111';g.font='900 48px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(String(num),64,66);
  const tex=new THREE.CanvasTexture(c);tex.needsUpdate=true;const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false});const s=new THREE.Sprite(mat);s.scale.set(.09,.09,1);s.renderOrder=999;return s;
}
function dlAssemblyClearLabels(){
  if(dlAssemblyLabelGroup){dlAssemblyLabelGroup.traverse(x=>{if(x.material?.map)x.material.map.dispose?.();x.material?.dispose?.();});scene.remove(dlAssemblyLabelGroup);dlAssemblyLabelGroup=null;}
}
function dlAssemblyApplyDistance(mm=180){
  if(!dlAssemblyActive)return;dlAssemblyCurrentDistance=Math.max(0,Math.min(600,Number(mm)||0));
  dlAssemblyClearLabels();dlAssemblyLabelGroup=new THREE.Group();dlAssemblyLabelGroup.name='DL_ASSEMBLY_LABELS';scene.add(dlAssemblyLabelGroup);
  const allBox=new THREE.Box3();dlAssemblyOriginals.forEach(r=>{r.o.position.copy(r.pos);r.o.updateMatrixWorld(true);allBox.expandByObject(r.o);});const center=allBox.getCenter(new THREE.Vector3());
  dlAssemblyOriginals.forEach((r,i)=>{
    const dir=dlAssemblyDirection(r.part,center),spread=(dlAssemblyCurrentDistance/1000)*(1+(i%5)*.06);
    r.o.position.copy(r.pos).addScaledVector(dir,spread);r.o.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(r.o),c=b.getCenter(new THREE.Vector3()),s=dlAssemblySprite(i+1);s.position.copy(c);s.position.y+=Math.max(.035,(b.max.y-b.min.y)*.08);dlAssemblyLabelGroup.add(s);
  });
  frameFurnitureVisual?.();
  if($('assemblyExplodeValue'))$('assemblyExplodeValue').textContent=`${Math.round(dlAssemblyCurrentDistance)} mm`;
}
async function openAssemblyExplodedView(){
  if(dlAssemblyActive)return;
  if(!projects.state.currentProjectId){toast('Abra um projeto primeiro');return;}
  await dlCommitProjectAutosave({reason:'Antes da vista explodida',force:!!projects.state.currentProjectDirty});
  const parts=dlAssemblyParts();if(!parts.length){toast('O projeto não possui peças para explodir');return;}
  dlAssemblyPreviousView={visual:ctx.visualMode,view2D:ctx.viewMode2D,viewName:ctx.current2DView,root:activeSpaceRoot(),camera:captureProjectCamera()};
  if(ctx.viewMode2D||ctx.camera===orthoCamera)returnTo3D({restore:true,notify:false});
  if(!ctx.visualMode)setVisualMode(true,{notify:false,frame:false});
  dlAssemblyOriginals=parts.map(part=>({part,o:part.object,pos:part.object.position.clone()}));dlAssemblyActive=true;
  $('assemblyExplodePanel').style.display='flex';$('assemblyExplodeRange').value=String(dlAssemblyCurrentDistance);dlAssemblyApplyDistance(dlAssemblyCurrentDistance);
  toast('Vista explodida · numeração corresponde ao manual de montagem');
}
function closeAssemblyExplodedView(){
  if(!dlAssemblyActive){const p=$('assemblyExplodePanel');if(p)p.style.display='none';return;}
  dlAssemblyClearLabels();for(const r of dlAssemblyOriginals){r.o.position.copy(r.pos);r.o.updateMatrixWorld(true);}dlAssemblyOriginals=[];dlAssemblyActive=false;
  const prev=dlAssemblyPreviousView;dlAssemblyPreviousView=null;$('assemblyExplodePanel').style.display='none';
  if(prev){
    if(!prev.visual&&ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
    restoreProjectCamera(prev.camera);
    if(prev.view2D&&prev.root&&prev.viewName)viewSpace(prev.root,prev.viewName);
  }
}
function dlAssemblyManualText(){
  const steps=dlAssemblySteps(),project=projects.state.currentProjectRecord?.name||'Projeto';let out=`MANUAL DE MONTAGEM · ${project}\r\nDesignLabMoveis ${DL_PRODUCTION_SUITE_VERSION}\r\n\r\n`;
  for(const s of steps){out+=`${s.number}. ${s.title}\r\n`;for(const p of s.items){out+=`   - #${p.assemblyNumber} · ${p.cutCode||p.index||''} · ${p.name} · ${nice(p.faceW)} x ${nice(p.faceH)} x ${nice(p.thickness)} mm\r\n`;}out+='\r\n';}
  out+='Sequência sugerida automaticamente. Confirme ferragens, acesso de parafusos e condições reais de montagem antes de executar.\r\n';return out;
}
function dlAssemblyManualHtml({normalImage='',explodedImage=''}={}){
  const steps=dlAssemblySteps(),project=projects.state.currentProjectRecord?.name||'Projeto',meta=[projects.state.currentProjectRecord?.client,projects.state.currentProjectRecord?.environment].filter(Boolean).join(' · ');
  const imageBlock=(normalImage||explodedImage)?`<div class="imgs">${normalImage?`<figure><img src="${normalImage}"><figcaption>Vista montada</figcaption></figure>`:''}${explodedImage?`<figure><img src="${explodedImage}"><figcaption>Vista explodida</figcaption></figure>`:''}</div>`:'';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Manual de montagem · ${escapeHtml(project)}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#fff}header{border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:12px}h1{font-size:22px;margin:0}header p{margin:5px 0 0;color:#555}.imgs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.imgs figure{margin:0;border:1px solid #aaa;padding:5px}.imgs img{width:100%;display:block}.imgs figcaption{text-align:center;font-size:11px;margin-top:4px}.step{break-inside:avoid;border:1px solid #bbb;margin:8px 0;padding:8px}.step h2{font-size:16px;margin:0 0 6px}.part{display:grid;grid-template-columns:70px 1fr auto;gap:8px;border-top:1px solid #eee;padding:5px 0;font-size:12px}.code{font-weight:900}.note{margin-top:12px;border:1px solid #111;padding:8px;font-size:11px}@media print{body{print-color-adjust:exact}}</style></head><body><header><h1>Manual de montagem · ${escapeHtml(project)}</h1><p>${escapeHtml(meta||'Projeto de marcenaria')} · DesignLabMoveis ${DL_PRODUCTION_SUITE_VERSION}</p></header>${imageBlock}${steps.map(s=>`<section class="step"><h2>${s.number}. ${escapeHtml(s.title)}</h2>${s.items.map(p=>`<div class="part"><span class="code">#${p.assemblyNumber} · ${escapeHtml(p.cutCode||String(p.index||''))}</span><span>${escapeHtml(p.name||'Peça')}</span><span>${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm</span></div>`).join('')}</section>`).join('')}<div class="note"><strong>Importante:</strong> sequência sugerida automaticamente. Confirme ferragens, acesso de parafusos, esquadro e condições reais de montagem antes da execução.</div></body></html>`;
}
function openAssemblyManualDialog(){
  if(!projects.state.currentProjectId){toast('Abra um projeto primeiro');return;}
  const steps=dlAssemblySteps(),box=$('assemblyManualSteps');box.innerHTML='';
  $('assemblyManualTitle').textContent=`Manual · ${projects.state.currentProjectRecord?.name||'Projeto'}`;
  for(const s of steps){const sec=document.createElement('section');sec.className='dlManualStep';sec.innerHTML=`<h4>${s.number}. ${escapeHtml(s.title)}</h4>${s.items.map(p=>`<div><b>#${p.assemblyNumber} · ${escapeHtml(p.cutCode||String(p.index||''))}</b><span>${escapeHtml(p.name||'Peça')}</span><small>${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm</small></div>`).join('')}`;box.appendChild(sec);}
  $('assemblyManualDialog').classList.add('show');$('assemblyManualDialog').style.display='flex';
}
function closeAssemblyManualDialog(){const d=$('assemblyManualDialog');if(d){d.classList.remove('show');d.style.display='none';}}
function printAssemblyManual(){
  const html=dlAssemblyManualHtml(),w=window.open('','_blank');if(!w){downloadText(`${safeFileName(projects.state.currentProjectRecord?.name||'projeto')}-manual-montagem.html`,html,'text/html;charset=utf-8');toast('Janela bloqueada · manual salvo em HTML');return;}w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);
}

// ---------------------------------------------------------------------------
// PACOTE COMPLETO DE PRODUÇÃO
// ---------------------------------------------------------------------------
function dlDataUrlBytes(dataUrl){const b64=String(dataUrl||'').split(',')[1]||'',bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
async function dlBlobBytes(blob){return new Uint8Array(await blob.arrayBuffer());}
async function dlCanvasPngBytes(canvas){const b=await new Promise(r=>canvas.toBlob(r,'image/png'));return dlBlobBytes(b);}
async function dlCaptureNormalAndExploded(){
  const normal=await captureProjectThumbnail();
  const parts=dlAssemblyParts(),orig=parts.map(p=>({p,o:p.object,pos:p.object.position.clone()}));let exploded='';
  if(parts.length){
    const allBox=new THREE.Box3();orig.forEach(r=>allBox.expandByObject(r.o));const center=allBox.getCenter(new THREE.Vector3());
    try{orig.forEach((r,i)=>{r.o.position.addScaledVector(dlAssemblyDirection(r.p,center),.18*(1+(i%5)*.06));r.o.updateMatrixWorld(true);});exploded=await captureProjectThumbnail();}
    finally{orig.forEach(r=>{r.o.position.copy(r.pos);r.o.updateMatrixWorld(true);});}
  }
  return {normal,exploded};
}
function dlProductionMcadPayload(rec){return {format:'mini-cad-pro-project',formatVersion:1,appVersion:DESIGNLAB_APP_VERSION||DL_PRODUCTION_SUITE_VERSION,exportedAt:projectNow(),project:{name:rec.name||'Projeto',client:rec.client||'',environment:rec.environment||'',createdAt:rec.createdAt||projectNow(),updatedAt:rec.updatedAt||projectNow(),state:rec.state||captureState(),camera:rec.camera||captureProjectCamera(),thumbnail:rec.thumbnail||null,versions:dlProdVersionList(rec).slice(-DL_PROJECT_VERSION_LIMIT)}};}
function dlProductionCheckText(check){
  let s=`VERIFICAÇÃO DE PRODUÇÃO · ${projects.state.currentProjectRecord?.name||'Projeto'}\r\nDesignLabMoveis ${DL_PRODUCTION_SUITE_VERSION}\r\nData: ${new Date().toLocaleString('pt-BR')}\r\n\r\nStatus: ${check.ready?'PRONTO':'ATENÇÃO'} · ${check.errors} erro(s) · ${check.warnings} aviso(s)\r\nPeças: ${check.stats.pieces} · Chapas: ${check.stats.sheets} · ZAW: ${check.stats.zaw}\r\n\r\n`;
  for(const it of check.issues)s+=`[${it.level.toUpperCase()}] ${it.title}${it.detail?` · ${it.detail}`:''}\r\n`;
  return s;
}
function dlCutPlanCanvas(group,cfg){
  const W=1000,H=680,pad=42,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);g.fillStyle='#111';g.font='700 22px Arial';g.fillText(`${group.key.replace(/_/g,' ')} · Chapa ${group.sheetNo}/${group.totalSheets}`,pad,28);const sw=Number(group.cfg?.width||cfg.width),sh=Number(group.cfg?.height||cfg.height),scale=Math.min((W-pad*2)/sw,(H-pad*2-28)/sh),ox=(W-sw*scale)/2,oy=H-pad;g.strokeStyle='#111';g.lineWidth=2;g.strokeRect(ox,oy-sh*scale,sw*scale,sh*scale);
  for(const p of group.parts){const x=ox+p.x*scale,y=oy-(p.y+p.placedH)*scale,w=p.placedW*scale,h=p.placedH*scale;g.fillStyle='#f7f7f7';g.fillRect(x,y,w,h);g.strokeStyle='#222';g.lineWidth=1;g.strokeRect(x,y,w,h);if(w>32&&h>22){g.fillStyle='#111';g.textAlign='center';g.textBaseline='middle';const fs=Math.max(8,Math.min(18,Math.min(w/6,h/3)));g.font=`700 ${fs}px Arial`;g.fillText(p.diagramCode||p.cutCode||String(p.index||''),x+w/2,y+h/2-fs*.35);if(h>38){g.font=`${Math.max(7,fs*.55)}px Arial`;g.fillText(String(p.name||'Peça').slice(0,20),x+w/2,y+h/2+fs*.55);}}}
  g.textAlign='left';g.textBaseline='alphabetic';g.font='13px Arial';g.fillText(`${nice(sw)} × ${nice(sh)} mm · ${group.parts.length} peça(s)`,pad,H-12);return c;
}
async function dlProductionLayoutPdfs(){
  const saved={view:dlLayoutState.view,mode:dlLayoutState.mode,showHidden:dlLayoutState.showHidden,showHatch:dlLayoutState.showHatch,showDimensions:dlLayoutState.showDimensions,showLabels:dlLayoutState.showLabels,visibleDimsOnly:dlLayoutState.visibleDimsOnly,scopeValue:dlLayoutState.scopeValue,page:dlLayoutState.page};const sel=$('layoutScopeSelect'),selValue=sel?.value||'';
  try{
    dlLayoutPopulateScope?.(true);if(sel){sel.value='project';}dlLayoutState.scopeValue='project';dlLayoutState.view='sheet';
    const tech=dlLayoutWithTemporaryState({mode:'technical',showHidden:true,showHatch:true,showDimensions:true,showLabels:true,visibleDimsOnly:true},()=>dlLayoutCanvasJpegData(dlLayoutBuildDirectCanvas(1.55)));
    const clean=dlLayoutWithTemporaryState({mode:'cleanprint',showHidden:false,showHatch:false,showDimensions:true,showLabels:false,visibleDimsOnly:true},()=>dlLayoutCanvasJpegData(dlLayoutBuildDirectCanvas(1.55)));
    return {technical:await dlBlobBytes(dlLayoutPdfWithJpegs([tech],dlLayoutState.page)),clean:await dlBlobBytes(dlLayoutPdfWithJpegs([clean],dlLayoutState.page)),combined:await dlBlobBytes(dlLayoutPdfWithJpegs([tech,clean],dlLayoutState.page))};
  }finally{Object.assign(dlLayoutState,saved);if(sel)sel.value=selValue;}
}
async function generateCompleteProductionPackage(){
  if(dlProductionPackageRunning)return;if(!projects.state.currentProjectId){toast('Abra um projeto primeiro');return;}dlProductionPackageRunning=true;
  const btn=$('productionSuitePackage');if(btn){btn.disabled=true;btn.textContent='Gerando pacote…';}
  try{
    closeAssemblyExplodedView();
    let rec=await saveCurrentProject({silent:true});if(!rec)throw new Error('Não foi possível salvar o projeto');
    // Usa exatamente as mesmas rotinas de reparo já consolidadas pelo pacote Aspire.
    // Elas garantem rasgos de fundo e furações de corrediça antes de congelar a produção.
    const grooves=repairAllDrawerBottomGrooves?.()||{sets:0,created:0,expected:0};
    const drilling=repairAllDrawerDrillingForAspire?.()||{sets:0,holes:0};
    if(drilling.sets>0&&drilling.holes===0)throw new Error('Há gavetas com furação marcada, mas nenhum furo pôde ser ligado às laterais.');
    if(grooves.sets>0&&grooves.created!==grooves.expected)throw new Error(`Rasgos do fundo incompletos: ${grooves.created}/${grooves.expected}.`);
    if(grooves.sets||drilling.sets){rec=await saveCurrentProject({silent:true})||rec;}
    const check=await checkProjectReadyForProduction({render:true});
    if(!check.ready&&!confirm(`O verificador encontrou ${check.errors} item(ns) crítico(s).\n\nDeseja gerar o pacote mesmo assim?`))return;
    const cfg=check.cfg||getSheetPrefs(),groups=Array.isArray(check.groups)?check.groups:[],files=[];
    const slug=safeFileName(rec.name||'projeto');
    files.push({name:'00-LEIA-ME.txt',data:`PACOTE DE PRODUÇÃO · ${rec.name||'Projeto'}\r\nGerado pelo DesignLabMoveis ${DL_PRODUCTION_SUITE_VERSION}\r\n\r\nPastas:\r\n01-projeto = arquivo editável .mcad\r\n02-layout = desenhos técnicos PDF\r\n03-listas = peças, etiquetas e usinagens CSV\r\n04-etiquetas = folha HTML pronta para imprimir\r\n05-plano-corte = chapas + planos separados de madeira e ferro\r\n06-3d = vistas montada e explodida\r\n07-montagem = manual automático\r\n08-verificacao = auditoria antes da produção\r\n`});
    files.push({name:`01-projeto/${slug}.mcad`,data:JSON.stringify(dlProductionMcadPayload(rec),null,2)});

    const pdfs=await dlProductionLayoutPdfs();files.push({name:'02-layout/layout-tecnico.pdf',data:pdfs.technical},{name:'02-layout/layout-limpo.pdf',data:pdfs.clean},{name:'02-layout/layout-producao-2-folhas.pdf',data:pdfs.combined});

    for(const g of groups)files.push({name:`05-plano-corte/dxf/${g.file}`,data:g.text});
    files.push({name:'03-listas/lista-pecas.csv',data:buildPartsCsv(groups)},{name:'03-listas/etiquetas-base.csv',data:buildLabelsBaseCsv(groups)},{name:'03-listas/usinagens.csv',data:buildMachiningCsv(groups)},{name:'05-plano-corte/plano-chapas.csv',data:buildSheetsCsv(groups,cfg)});
    if(allProjectProductionPartsByKind('wood').length)files.push({name:'05-plano-corte/madeira/plano-madeira.csv',data:dlWoodPlanCsv()});
    if(allProjectProductionPartsByKind('metal').length)files.push({name:'05-plano-corte/ferro/plano-ferro.csv',data:dlMetalPlanCsv()});
    if(groups.length&&cfg.cutMode==='panel')files.push({name:'05-plano-corte/cortes-seccionadora.csv',data:buildPanelSawCutsCsv(groups,cfg)},...buildMingliZawFiles(groups,cfg).map(f=>({name:`05-plano-corte/mingli-zaw/${f.name}`,data:f.data})));

    const labelPrefs={...labelsPrefs(),scope:'project'},labelItems=labelsBuildItems(labelPrefs);files.push({name:'04-etiquetas/etiquetas.html',data:labelsPrintDocument(labelItems,labelPrefs)});
    for(let i=0;i<groups.length;i++){const png=await dlCanvasPngBytes(dlCutPlanCanvas(groups[i],groups[i].cfg||cfg));files.push({name:`05-plano-corte/imagens/chapa-${String(i+1).padStart(2,'0')}.png`,data:png});}

    const views=await dlCaptureNormalAndExploded();if(views.normal)files.push({name:'06-3d/vista-montada.jpg',data:dlDataUrlBytes(views.normal)});if(views.exploded)files.push({name:'06-3d/vista-explodida.jpg',data:dlDataUrlBytes(views.exploded)});
    files.push({name:'07-montagem/manual-montagem.html',data:dlAssemblyManualHtml({normalImage:views.normal,explodedImage:views.exploded})},{name:'07-montagem/manual-montagem.txt',data:dlAssemblyManualText()});
    files.push({name:'08-verificacao/relatorio-producao.txt',data:dlProductionCheckText(check)},{name:'08-verificacao/relatorio-producao.json',data:JSON.stringify({...check,groups:undefined,cfg:undefined,issues:check.issues.map(x=>({...x,objects:x.objects?.map(dlProdPieceLabel)}))},null,2)});

    const zip=zipStore(files),name=`${slug}-PRODUCAO-${new Date().toISOString().slice(0,10)}.zip`;dlLayoutDownloadBlob(name,zip);toast(`Pacote completo gerado · ${files.length} arquivo(s) · ${groups.length} chapa(s)`);
  }catch(err){console.error('Pacote produção:',err);toast(err.message||'Não foi possível gerar o pacote de produção');}
  finally{dlProductionPackageRunning=false;if(btn){btn.disabled=false;btn.textContent='📦 Gerar pacote de produção';}}
}

// ---------------------------------------------------------------------------
// EVENTOS / INTEGRAÇÃO COM A INTERFACE
// ---------------------------------------------------------------------------
$('homeProductionSuite')?.addEventListener('click',()=>openProductionSuiteDialog());
$('menuProjectVersions')?.addEventListener('click',()=>{$('projectMenuPanel')?.classList.remove('show');openProjectVersionsDialog();});
$('menuProductionSuite')?.addEventListener('click',()=>{$('projectMenuPanel')?.classList.remove('show');openProductionSuiteDialog();});
$('closeProjectVersionsDialog')?.addEventListener('click',closeProjectVersionsDialog);
$('projectVersionsDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('projectVersionsDialog'))closeProjectVersionsDialog();});
$('closeProductionSuiteDialog')?.addEventListener('click',closeProductionSuiteDialog);
$('productionSuiteDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('productionSuiteDialog'))closeProductionSuiteDialog();});
$('productionSuiteRecheck')?.addEventListener('click',()=>checkProjectReadyForProduction({render:true}));
$('productionSuiteHistory')?.addEventListener('click',openProjectVersionsDialog);
$('productionSuiteMaterials')?.addEventListener('click',()=>{closeProductionSuiteDialog();openProductionDialog();});
$('productionSuiteWoodPlan')?.addEventListener('click',()=>{closeProductionSuiteDialog();openLinearMaterialPlan('wood');});
$('productionSuiteMetalPlan')?.addEventListener('click',()=>{closeProductionSuiteDialog();openLinearMaterialPlan('metal');});
$('partsOpenWoodPlan')?.addEventListener('click',()=>openLinearMaterialPlan('wood'));
$('partsOpenMetalPlan')?.addEventListener('click',()=>openLinearMaterialPlan('metal'));
$('closeLinearMaterialPlanDialog')?.addEventListener('click',closeLinearMaterialPlanDialog);
$('linearMaterialPlanDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('linearMaterialPlanDialog'))closeLinearMaterialPlanDialog();});
$('productionSuiteLayout')?.addEventListener('click',()=>{closeProductionSuiteDialog();openTechnicalLayoutDialog();});
$('productionSuiteAssembly')?.addEventListener('click',()=>{closeProductionSuiteDialog();openAssemblyManualDialog();});
$('productionSuiteExplode')?.addEventListener('click',()=>{closeProductionSuiteDialog();openAssemblyExplodedView();});
$('productionSuitePackage')?.addEventListener('click',generateCompleteProductionPackage);
$('openProductionSuiteFromMaterials')?.addEventListener('click',()=>{closeProductionDialog();openProductionSuiteDialog();});
$('assemblyExplodeRange')?.addEventListener('input',e=>dlAssemblyApplyDistance(e.target.value));
$('closeAssemblyExplode')?.addEventListener('click',closeAssemblyExplodedView);
$('assemblyExplodeManual')?.addEventListener('click',openAssemblyManualDialog);
$('closeAssemblyManualDialog')?.addEventListener('click',closeAssemblyManualDialog);
$('assemblyManualDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('assemblyManualDialog'))closeAssemblyManualDialog();});
$('assemblyManualExplode')?.addEventListener('click',()=>{closeAssemblyManualDialog();openAssemblyExplodedView();});
$('assemblyManualPrint')?.addEventListener('click',printAssemblyManual);
$('assemblyManualDownload')?.addEventListener('click',()=>downloadText(`${safeFileName(projects.state.currentProjectRecord?.name||'projeto')}-manual-montagem.html`,dlAssemblyManualHtml(),'text/html;charset=utf-8'));

// O catálogo da barra é definido no módulo 01. Acrescentamos as novas ações sem
// obrigar usuários antigos a resetar os favoritos.
try{
  if(Array.isArray(TOOL_DOCK_CATALOG)&&!TOOL_DOCK_CATALOG.some(x=>x.key==='productionSuite')){
    const idx=TOOL_DOCK_CATALOG.findIndex(x=>x.key==='visual');
    TOOL_DOCK_CATALOG.splice(idx<0?8:idx,0,{group:'Projeto',key:'productionSuite',label:'✅ Produção',desc:'Verificar projeto, pacote de produção, histórico e montagem'},{group:'Projeto',key:'assembly',label:'🧩 Montagem',desc:'Vista explodida numerada e manual automático'});
  }
  if(Array.isArray(toolDockPrefs)&&!toolDockPrefs.includes('productionSuite')){const m=toolDockPrefs.indexOf('more');toolDockPrefs.splice(m<0?toolDockPrefs.length:m,0,'productionSuite');saveToolDockPrefs();renderToolDock();}
}catch(err){console.warn('Integração barra Produção:',err);}

// Encaminha as duas novas ferramentas antes do roteador original.
const dlProdOriginalRunDockTool=ctx.getRunDockTool();
const runDockTool=function(key){
  if(key==='productionSuite'){closeToolDockBeforeMenu();openProductionSuiteDialog();syncToolDockButtons();return;}
  if(key==='assembly'){closeToolDockBeforeMenu();openAssemblyManualDialog();syncToolDockButtons();return;}
  return dlProdOriginalRunDockTool(key);
};
ctx.setRunDockTool(runDockTool);

window.designLabProductionSuite={
  check:()=>checkProjectReadyForProduction({render:false}),package:generateCompleteProductionPackage,
  history:openProjectVersionsDialog,assembly:openAssemblyExplodedView,manual:openAssemblyManualDialog,
  autosave:()=>dlCommitProjectAutosave({reason:'Autosave solicitado',force:true})
};

// 1.200.56 · a barra inferior nasce depois que o catálogo recebeu Produção/Montagem.
try{initQuickDock();}catch(err){console.warn('Barra rápida:',err);}

  return {
    checkProjectReadyForProduction, openProductionSuiteDialog, closeProductionSuiteDialog, openProjectVersionsDialog, closeProjectVersionsDialog,
    dlLinearPieceLengthMm, dlPackMetalBars, dlWoodPlanGroups, dlMetalPlanGroups, dlRenderGeneralPartsSummary, dlRenderInlineLinearPlans,
    openLinearMaterialPlan, openAssemblyExplodedView, closeAssemblyExplodedView, openAssemblyManualDialog, closeAssemblyManualDialog,
    generateCompleteProductionPackage, dlCommitProjectAutosave
  };
}
