// DesignLabMoveis 1.310.00 · bootstrap final do editor e ciclo de vida global.
export function startRuntimeBootstrap(ctx){
  const { $, state, installOutsideMenuClose, sheetPreviewDraw, renderer, updateCadEdgeResolution, perspectiveCamera, activeSpaceRoot, viewSpace, designLabRuntimeBuild, DESIGNLAB_JS_BUILD, updateCacheStatusUI, initDesignLabInstallExperience, initDesignLabServiceWorker, checkDesignLabUpdate, auth, offlineLicenseRecheckDue, verifyPremiumWorkspaceAccess, cloudAccount, syncCloudPreferences, saveCloudPreferences, loadOfflinePremiumLicense, showOfflineLicenseExpired, designLabRouteEnsureHomeRoot, setFrontWorldView, stateString, setHistory, setHistoryIndex, initToolDock, initSpaceActionsDrag, initPieceInspectorFloating, initProjectHub, toast, initOnlineIdentity, setAuthStatus, controls, updateLiveLabel, updateMachiningVisualTransforms, updateDoorHandleVisuals, scene, updateXray3DButton, applyCadDetailVisibility, setPieceVisualEdgesVisible } = ctx;
installOutsideMenuClose();

window.addEventListener('resize'
,()=>{if($('sheetPreviewDialog')?.classList.contains('show'))requestAnimationFrame(sheetPreviewDraw);});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);updateCadEdgeResolution();perspectiveCamera.aspect=innerWidth/Math.max(1,innerHeight);perspectiveCamera.updateProjectionMatrix();if(state.viewMode2D){const root=activeSpaceRoot();viewSpace(root,state.current2DView||'front');}else state.camera.updateProjectionMatrix();});

// 1.200.42: remove os parâmetros técnicos depois que a cópia fresca abriu.
// Assim, uma próxima abertura fria do PWA volta para / e passa novamente pelo
// bootstrap automático do servidor, sem o usuário precisar tocar em botão.
setTimeout(()=>{
  try{
    const u=new URL(location.href),keys=['_bootFresh','_refresh','_dlv','_server'];let changed=false;
    for(const k of keys)if(u.searchParams.has(k)){u.searchParams.delete(k);changed=true;}
    if(changed)window.history.replaceState(window.history.state||{},'',u.pathname+(u.search||'')+(u.hash||''));
  }catch(_){}
},1400);
// Detecta mistura improvável de HTML atual com bundle antigo e corrige sozinha.
setTimeout(()=>{
  try{
    if(navigator.onLine&&typeof designLabRuntimeBuild==='function'&&designLabRuntimeBuild()!==DESIGNLAB_JS_BUILD){
      console.warn('Build HTML/JS diferente; atualização automática adiada para não sair do projeto.');
      updateCacheStatusUI('Arquivos de versões diferentes detectados · use Configurações > Recarregar versão do servidor.');
    }
  }catch(_){}
},300);

initDesignLabInstallExperience();
// 1.200.42: não tentamos mais fingir que uma recuperação automática é igual a
// um clique humano. Chrome/TWA diferencia essas duas situações. Registramos e
// atualizamos o SW normalmente; o PRIMEIRO toque/click real que a pessoa já faria
// para usar o DesignLab dispara, uma única vez, o mesmo caminho do botão manual.
initDesignLabServiceWorker().catch(()=>{});
setTimeout(()=>checkDesignLabUpdate({force:true,autoApply:true}),450);
window.addEventListener('online',()=>{
  updateCacheStatusUI();checkDesignLabUpdate({force:true,autoApply:true}).catch(()=>{});
  if(auth.currentIdentityUser&&offlineLicenseRecheckDue())verifyPremiumWorkspaceAccess({background:true}).catch(()=>{});
  if(auth.currentIdentityUser&&cloudAccount.cloudAccountState.ok)syncCloudPreferences({silent:true,allowReload:false}).then(r=>r?.ok?saveCloudPreferences({silent:true}):null);
});
window.addEventListener('offline',updateCacheStatusUI);

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')return;
  if(document.visibilityState==='visible'){
    // 1.200.74: não fabrica histórico ao retomar. Apenas garante que a entrada
    // atual continue identificada; guard/workspace foram criados por gesto real.
    if(typeof designLabRouteEnsureHomeRoot==='function')designLabRouteEnsureHomeRoot();
    checkDesignLabUpdate({force:true,autoApply:true}).catch(()=>{});
    if(auth.authOfflineMode){
      loadOfflinePremiumLicense().then(r=>{if(!r.valid)showOfflineLicenseExpired();});
    }else if(auth.currentIdentityUser&&navigator.onLine&&offlineLicenseRecheckDue()){
      verifyPremiumWorkspaceAccess({background:true}).catch(()=>{});
    }
  }
});
window.addEventListener('pageshow',()=>{
  if(typeof designLabRouteEnsureHomeRoot==='function')designLabRouteEnsureHomeRoot();
  checkDesignLabUpdate({force:true,autoApply:true}).catch(()=>{});
});

// Início limpo e frontal. O CAD inicializa normalmente por baixo da tela de projetos.
if(typeof designLabRouteEnsureHomeRoot==='function')designLabRouteEnsureHomeRoot();
setFrontWorldView();
setHistory([stateString()]); setHistoryIndex(0);
initToolDock();
initSpaceActionsDrag();
initPieceInspectorFloating();
initProjectHub().catch(err=>{console.error(err);toast('Não foi possível abrir o gerenciador de projetos');});
initOnlineIdentity().catch(err=>{console.error(err);setAuthStatus('Falha ao iniciar a autenticação.','error');});

function animate(){
  requestAnimationFrame(animate); controls.update(); if(state.dragMode) updateLiveLabel(); updateMachiningVisualTransforms(); updateDoorHandleVisuals(); renderer.render(scene,state.camera);
}
updateXray3DButton();
applyCadDetailVisibility({persist:false,notify:false});
setPieceVisualEdgesVisible(true);
animate();

  return {started:true};
}
