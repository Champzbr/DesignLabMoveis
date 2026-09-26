// DesignLabMoveis 1.311.00 · navegação Voltar/History isolada do runtime.
export function createBackNavigationModule(ctx){
  const { $, state, clearSpaceMultiSelection, quickDockSubmenuVisible, closeQuickDockSubmenu, productionMaterials, closeCopyHardwareTool, machiningShapes, closeCopyShapeTool, curvedFurniture, returnCurvedStructurePreview, returnShapePreview, closeMachining3DPreview, elementIsVisible, closeInspectorOutside, closeSpaceActionsOutside, closeProjectCardMenu, setToolDockOpen, setTool, orthoCamera, returnTo3D, setVisualMode, showAuthInlineForm, projects, showProjectHome }=ctx;
  const runtimeModel=ctx.runtimeModel;
// ============================================================================
// 1.200.18 · VOLTAR UNIVERSAL (Android / navegador / PWA)
// ----------------------------------------------------------------------------
// 1.200.18 · VOLTAR UNIVERSAL / CERCA DE HISTÓRICO
// ----------------------------------------------------------------------------
// O bootstrap instalado no <head> cria uma "almofada" de várias entradas
// same-document ANTES de o app carregar. Isso é deliberado: em alguns Samsung/
// Chrome PWA uma única entrada pushState não era suficiente e o botão físico
// Voltar encerrava o app antes do próximo estado ser reposto.
//
// Aqui cuidamos apenas da cascata visual. Cada Voltar fecha exatamente a camada
// visível mais profunda e, no editor, volta à seleção de projetos. Na seleção,
// o app permanece aberto.
// ============================================================================
function designLabBackElementVisible(id){
  const el=$(id);if(!el)return false;
  const cs=getComputedStyle(el);
  if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
  const r=el.getBoundingClientRect?.();
  return !!(el.classList.contains('show')||el.classList.contains('open')||cs.display==='flex'||cs.display==='block'||cs.display==='grid'||(r&&r.width>0&&r.height>0));
}
function designLabClickBackCloser(containerId,buttonId){
  if(!designLabBackElementVisible(containerId))return false;
  const b=$(buttonId);
  if(b&&!b.disabled){b.click();return true;}
  const el=$(containerId);
  if(el){el.classList.remove('show','open');el.style.display='none';return true;}
  return false;
}
function designLabAuthBack(){
  const gate=$('authGate');if(!gate||!designLabBackElementVisible('authGate'))return false;
  const openForm=gate.querySelector('.authInlineForm.show');
  if(openForm){showAuthInlineForm('main');return true;}
  return false;
}
function designLabCloseInstallCard(){
  const card=document.getElementById('designLabInstallCard');
  if(!card)return false;
  card.querySelector('.designLabInstallClose')?.click?.();
  if(document.body.contains(card))card.remove();
  return true;
}
function designLabGenericBackLayer(){
  const selector='[id$="Dialog"],[id$="Modal"],.projectModal,[role="dialog"],[aria-modal="true"]';
  const candidates=[...document.querySelectorAll(selector)].filter(el=>{
    if(!el||el===document.body||el===document.documentElement)return false;
    if(el.id==='authGate'||el.id==='projectHome')return false;
    const cs=getComputedStyle(el),r=el.getBoundingClientRect?.();
    if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
    return !!(el.classList.contains('show')||el.classList.contains('open')||cs.position==='fixed'||cs.position==='absolute'||(r&&r.width>0&&r.height>0));
  });
  candidates.sort((a,b)=>{
    const za=Number.parseInt(getComputedStyle(a).zIndex)||0,zb=Number.parseInt(getComputedStyle(b).zIndex)||0;
    return zb-za;
  });
  const el=candidates[0];if(!el)return false;
  const btn=el.querySelector('button[id^="close" i],button[id^="cancel" i],[data-close],[data-back],button[aria-label*="voltar" i],button[aria-label*="fechar" i]');
  if(btn&&!btn.disabled){btn.click();return true;}
  el.classList.remove('show','open');el.style.display='none';return true;
}
async function designLabHandleBackCascade(){
  if(typeof quickDockSubmenuVisible==='function'&&quickDockSubmenuVisible()){closeQuickDockSubmenu();return 'closed';}
  if(typeof productionMaterials.state.hardwareCopyState!=='undefined'&&productionMaterials.state.hardwareCopyState.active){closeCopyHardwareTool(false);return 'closed';}
  if(typeof machiningShapes.state.shapeCopyState!=='undefined'&&machiningShapes.state.shapeCopyState.active){closeCopyShapeTool(false);return 'closed';}
  if(typeof runtimeModel.selectedSpaceCells!=='undefined'&&runtimeModel.selectedSpaceCells.size){clearSpaceMultiSelection({notify:false});return 'closed';}
  if(curvedFurniture.state.curved3DPreviewActive||designLabBackElementVisible('curved3DPreviewBar')){returnCurvedStructurePreview({reopen:true});return 'closed';}
  if(machiningShapes.state.shapePreviewActive||designLabBackElementVisible('shape3DPreviewBar')){returnShapePreview();return 'closed';}
  if(state.machiningPreviewActive||designLabBackElementVisible('machining3DPreviewBar')){closeMachining3DPreview({reopen:true});return 'closed';}

  const closers=[
    ['assemblyExplodePanel','closeAssemblyExplode'],
    ['assemblyManualDialog','closeAssemblyManualDialog'],
    ['projectVersionsDialog','closeProjectVersionsDialog'],
    ['productionSuiteDialog','closeProductionSuiteDialog'],
    ['layoutPrintPreviewDialog','closeLayoutPrintPreview'],
    ['technicalLayoutDialog','closeTechnicalLayout'],
    ['sheetPreviewDialog','sheetPreviewClose'],
    ['labelsDialog','closeLabelsDialogTop'],
    ['partsListDialog','closePartsList'],
    ['hardwareBuilderDialog','cancelHardwareBuilder'],
    ['shapeDialog','cancelShape'],
    ['slattedPanelDialog','cancelSlattedPanel'],
    ['machiningDialog','cancelMachining'],
    ['curvedStructureDialog','cancelCurvedStructure'],
    ['drawerSystemDialog','cancelDrawerSystem'],
    ['createPiecesDialog','cancelCreatePieces'],
    ['deleteSpaceCellDialog','cancelDeleteSpaceCell'],
    ['cutSpaceDialog','cancelCut'],
    ['newSpaceDialog','cancelSpace'],
    ['editSpaceDialog','cancelEditSpace'],
    ['libraryDialog','closeLibrary'],
    ['newPanelDialog','cancelPanel'],
    ['toolDockEditDialog','toolDockEditCancel'],
    ['quickDockConfigDialog','quickDockCancel'],
    ['productionDialog','closeProductionDialog'],
    ['spaceMoreDialog','closeSpaceMore'],
    ['adminDialog','closeAdminDialog'],
    ['appSettingsDialog','appSettingsClose'],
    ['projectMetaDialog','projectMetaCancel'],
    ['recoveryDialog','recoveryCancel'],
    ['updateDialog','updateLaterBtn']
  ];
  for(const [container,button] of closers){if(designLabClickBackCloser(container,button))return 'closed';}
  if(designLabGenericBackLayer())return 'closed';

  if(designLabCloseInstallCard())return 'closed';
  if($('projectCardMenu')?.classList.contains('show')){closeProjectCardMenu();return 'closed';}
  if(elementIsVisible($('inspector'))){closeInspectorOutside();return 'closed';}
  if(elementIsVisible($('spaceActions'))){closeSpaceActionsOutside();return 'closed';}
  if(designLabBackElementVisible('morePanel')){$('morePanel').style.display='none';return 'closed';}
  if($('projectMenuPanel')?.classList.contains('show')){$('projectMenuPanel').classList.remove('show');return 'closed';}
  if($('toolDock')?.classList.contains('open')){setToolDockOpen(false);return 'closed';}

  if(state.toolMode&&state.toolMode!=='select'){setTool('select');return 'closed';}
  if(state.viewMode2D||state.camera===orthoCamera){returnTo3D({restore:true,notify:false});return 'closed';}
  if(state.visualMode&&!document.body.classList.contains('presentation-active')){setVisualMode(false,{notify:false,frame:false});return 'closed';}
  if(designLabAuthBack())return 'closed';

  if(!document.body.classList.contains('project-home-active')&&projects.state.currentProjectId){
    await showProjectHome({fromHistory:true});
    return 'home';
  }
  return 'root';
}

let designLabHandlingPopState=false;
const DESIGNLAB_ROUTE_KEY='__designLabRouteV2';
const DESIGNLAB_WORKSPACE_ROUTES=new Set(['workspace','presentation','editor']);
let designLabRouteRestoringForward=false;
let designLabRoutePopBusy=false;

function designLabRouteKind(st=window.history.state||{}){
  return String(st?.[DESIGNLAB_ROUTE_KEY]||window.__DL_ROUTE_BOOTSTRAP?.kind?.(st)||'');
}
function designLabRouteState(kind,extra={}){
  const st=Object.assign({},window.history.state||{},extra);
  st[DESIGNLAB_ROUTE_KEY]=kind;st.__designLabRouteVersion='1.311.00';
  return st;
}
function designLabRouteReplace(kind,extra={}){
  try{window.history.replaceState(designLabRouteState(kind,extra),'',location.href);return true;}
  catch(err){console.warn('Rota DesignLab replace:',err);return false;}
}
function designLabRoutePush(kind,extra={}){
  try{window.history.pushState(designLabRouteState(kind,extra),'',location.href);return true;}
  catch(err){console.warn('Rota DesignLab push:',err);return false;}
}
function designLabRouteEnsureHomeRoot(){
  if(!designLabRouteKind())designLabRouteReplace('home-root');
}
function designLabRouteEnsureHomeGuard(){
  let cur=designLabRouteKind();
  if(cur==='home-guard')return true;
  if(cur==='home-root'||!cur){
    if(!cur)designLabRouteReplace('home-root');
    return designLabRoutePush('home-guard',{armedBy:'user'});
  }
  return false;
}
function designLabRouteEnterWorkspace(kind='editor'){
  kind=kind==='presentation'?'presentation':'editor';
  let cur=designLabRouteKind();
  // O guard e a workspace são criados no MESMO clique que abre o projeto.
  // Assim são entradas reais/ativadas, não histórico artificial de boot.
  if(cur==='home-root'||!cur){
    if(!cur)designLabRouteReplace('home-root');
    designLabRoutePush('home-guard',{armedBy:'open-project'});
    cur='home-guard';
  }
  if(cur==='home-guard')return designLabRoutePush(kind,{projectId:projects.state.currentProjectId||null});
  if(DESIGNLAB_WORKSPACE_ROUTES.has(cur))return designLabRouteReplace(kind,{projectId:projects.state.currentProjectId||null});
  designLabRouteReplace('home-guard');
  return designLabRoutePush(kind,{projectId:projects.state.currentProjectId||null});
}
function designLabRouteMarkHomeTop(){
  const cur=designLabRouteKind();
  if(cur==='home-root'||cur==='home-guard')return true;
  // Ao tocar em Projetos/Voltar visualmente, reaproveita a entrada atual como
  // guard. A home-root confiável continua logo atrás, impedindo saída acidental.
  return designLabRouteReplace('home-guard',{projectId:null});
}
function designLabRouteArmFromGesture(ev){
  if(ev?.isTrusted===false)return;
  const atHome=document.body.classList.contains('project-home-active');
  if(!atHome)return;
  const cur=designLabRouteKind();
  if(cur==='home-root'||!cur)designLabRouteEnsureHomeGuard();
}
// pointerup ocorre antes do click dos cartões. Portanto o HOME-GUARD já existe
// quando requestOpenProject() adiciona a WORKSPACE no próprio clique real.
window.addEventListener('pointerup',designLabRouteArmFromGesture,{capture:true,passive:true});
window.addEventListener('touchend',designLabRouteArmFromGesture,{capture:true,passive:true});
window.addEventListener('click',designLabRouteArmFromGesture,{capture:true,passive:true});
window.addEventListener('keydown',ev=>{if(ev.key!=='Escape')designLabRouteArmFromGesture(ev);},{capture:true});

designLabRouteEnsureHomeRoot();

async function designLabRunNativeBackCascade(){
  if(designLabHandlingPopState)return 'busy';
  designLabHandlingPopState=true;
  try{return await designLabHandleBackCascade();}
  catch(err){console.warn('Voltar DesignLab:',err);return 'root';}
  finally{designLabHandlingPopState=false;}
}
window.__designLabRunBackCascade=designLabRunNativeBackCascade;

window.addEventListener('popstate',async ev=>{
  if(designLabRouteRestoringForward){
    designLabRouteRestoringForward=false;
    return;
  }
  if(designLabRoutePopBusy)return;
  const dest=designLabRouteKind(ev.state||{});
  if(DESIGNLAB_WORKSPACE_ROUTES.has(dest))return; // history.forward() restaurou workspace.
  if(dest!=='home-root'&&dest!=='home-guard')return;

  designLabRoutePopBusy=true;
  try{
    const wasHome=document.body.classList.contains('project-home-active');
    const result=await designLabRunNativeBackCascade();
    if(result==='closed'&&(!wasHome||dest==='home-root')){
      // Workspace: restaura a entrada WORKSPACE para continuar no projeto.
      // Home: só restaura quando caímos no home-root, preservando o guard.
      designLabRouteRestoringForward=true;
      try{window.history.forward();}catch(_){designLabRouteRestoringForward=false;}
      setTimeout(()=>{designLabRouteRestoringForward=false;},700);
    }else if(result==='root'&&dest==='home-root'){
      // Já estamos na Home. Consumimos o Back retornando ao HOME-GUARD criado
      // pelo primeiro gesto real do usuário. Assim o PWA não fecha.
      designLabRouteRestoringForward=true;
      try{window.history.forward();}catch(_){designLabRouteRestoringForward=false;}
      setTimeout(()=>{designLabRouteRestoringForward=false;},700);
    }
    // result==='home': o usuário veio da workspace; permanece nesta entrada Home.
  }finally{designLabRoutePopBusy=false;}
},{capture:true});

// Wrappers Android/Capacitor/Cordova que emitem backbutton em vez de history.
document.addEventListener('backbutton',e=>{
  e.preventDefault?.();e.stopPropagation?.();
  designLabRunNativeBackCascade().catch(()=>{});
},{capture:true});
// Esc no PC segue a mesma cascata sem alterar o histórico do navegador.
window.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||e.defaultPrevented)return;
  const t=e.target;if(t&&['INPUT','TEXTAREA','SELECT'].includes(t.tagName))return;
  e.preventDefault();designLabRunNativeBackCascade().catch(()=>{});
},{capture:true});

// Compatibilidade com chamadas antigas espalhadas pelo app. Não criam mais
// histórico sintético; o guard é armado pelos gestos reais acima.
function designLabInstallBackFence(){return true;}
function designLabPushBackGuard(){return true;}
function designLabArmBackGuard(){return true;}


  return {designLabBackElementVisible,designLabClickBackCloser,designLabAuthBack,designLabCloseInstallCard,designLabGenericBackLayer,designLabHandleBackCascade,designLabRouteKind,designLabRouteState,designLabRouteReplace,designLabRoutePush,designLabRouteEnsureHomeRoot,designLabRouteEnsureHomeGuard,designLabRouteEnterWorkspace,designLabRouteMarkHomeTop,designLabRouteArmFromGesture,designLabRunNativeBackCascade,designLabInstallBackFence,designLabPushBackGuard,designLabArmBackGuard};
}
