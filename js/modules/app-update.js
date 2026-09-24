// DesignLabMoveis 1.310.00 · atualização, PWA e ciclo de cache isolados do runtime.
export function createAppUpdateModule(ctx){
  const { $, controls, toast, setTool, setDragMode, getProjects, projectAutosaveNow, setCloudAccountBanned, setAuthStatus } = ctx;
// ============================================================================
// 1.100.27 · SISTEMA DE ATUALIZAÇÃO + CACHE SEGURO
// ============================================================================
function designLabRuntimeVersion(){
  const build=String(document.querySelector('meta[name="designlab-build"]')?.content||'').trim();
  const m=build.match(/^(\d+\.\d+\.\d+)/);
  if(m?.[1])return m[1];
  const title=String(document.title||'');
  const tm=title.match(/(\d+\.\d+\.\d+)/);
  return tm?.[1]||'1.310.00';
}
const DESIGNLAB_APP_VERSION=designLabRuntimeVersion();
const DESIGNLAB_JS_BUILD='1.310.00-r8';
function designLabRuntimeBuild(){return String(document.querySelector('meta[name="designlab-build"]')?.content||'').trim();}

// 1.200.18 · modo de visualização realmente somente leitura.
// Usado pela visualização de projeto e por todas as prévias 3D.
function setDesignLabVisualizationOnly(on){
  document.body.classList.toggle('visualization-only',!!on);
  if(!on)return;
  try{setTool?.('select');}catch{}
  try{setDragMode?.(null);controls.enabled=true;}catch{}
  $('projectMenuPanel')?.classList.remove('show');
  $('projectCardMenu')?.classList.remove('show');
  if($('morePanel'))$('morePanel').style.display='none';
  if($('spaceActions'))$('spaceActions').style.display='none';
  if($('inspector')){ $('inspector').classList.add('compact'); $('inspector').style.display='none'; }
  if($('toolDockEditDialog'))$('toolDockEditDialog').style.display='none';
}
function designLabVisualizationOnlyActive(){
  return document.body.classList.contains('visualization-only') || document.body.classList.contains('presentation-active');
}

const DESIGNLAB_VERSION_URL='/version.json';
const DESIGNLAB_UPDATE_MIN_INTERVAL=5*60*1000;

let designLabLastUpdateCheck=0;
let designLabAvailableUpdate=null;
let designLabAutoUpdateNoticeVersion=(()=>{try{return sessionStorage.getItem('designLabUpdateNoticeVersion')||'';}catch{return '';}})();
let designLabUpdateCheckPromise=null;
function markDesignLabUpdateAvailable(info){
  const version=String(info?.version||'').trim();
  for(const id of ['homeCheckUpdate','menuCheckUpdate','settingsCheckUpdate']){
    const b=$(id);if(!b)continue;
    b.classList.toggle('updateAvailable',!!version);
    if(version)b.title=`Atualização ${version} disponível`;else b.removeAttribute('title');
  }
}
function notifyDesignLabUpdateOnce(info){
  const version=String(info?.version||'nova');
  markDesignLabUpdateAvailable(info);
  if(designLabAutoUpdateNoticeVersion===version)return;
  designLabAutoUpdateNoticeVersion=version;
  try{sessionStorage.setItem('designLabUpdateNoticeVersion',version);}catch{}
  toast(`Atualização ${version} disponível · use Projeto > Verificar atualização`);
}

let designLabUpdating=false;
let designLabSwRegistration=null;

// ============================================================================
// 1.200.18 · PWA / APP SEM BARRA DE ENDEREÇO
// Mesma estratégia usada no Contas Fácil: manifesto e SW na raiz + instalação
// real como app. Navegadores não permitem que uma página comum esconda a barra
// por JavaScript; por isso celulares fora do modo standalone recebem a opção de
// instalar o DesignLab em vez de criar apenas um atalho de navegador.
// ============================================================================
let designLabDeferredInstallPrompt=null;
let designLabInstallHintShown=false;

function designLabStandaloneMode(){
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true);
}
function designLabIsMobile(){
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'') || Math.min(innerWidth||9999,innerHeight||9999)<800;
}
function removeDesignLabInstallCard(){
  document.getElementById('designLabInstallCard')?.remove();
}
function designLabInstallInstructions(){
  const ua=navigator.userAgent||'';
  if(/SamsungBrowser/i.test(ua))return 'No Samsung Internet: menu ☰ → Adicionar página a → Tela inicial → Instalar.';
  if(/iPhone|iPad|iPod/i.test(ua))return 'No Safari: Compartilhar → Adicionar à Tela de Início.';
  return 'Abra este endereço no Chrome e use ⋮ → Instalar app (ou Adicionar à tela inicial). Depois abra pelo ícone DesignLabMoveis.';
}
function showDesignLabInstallCard(force=false){
  if(designLabStandaloneMode() || !designLabIsMobile())return;
  if(document.getElementById('designLabInstallCard'))return;
  if(!force && designLabInstallHintShown)return;
  designLabInstallHintShown=true;
  const card=document.createElement('div');
  card.id='designLabInstallCard';
  card.className='designLabInstallCard';
  card.innerHTML=`<div class="designLabInstallIcon">DL</div>
    <div class="designLabInstallText"><strong>Abrir como aplicativo</strong><span>Instale o DesignLab para abrir sem a barra de endereço do navegador.</span></div>
    <button type="button" class="designLabInstallPrimary">Instalar</button>
    <button type="button" class="designLabInstallClose" aria-label="Fechar">×</button>`;
  document.body.appendChild(card);
  card.querySelector('.designLabInstallClose').onclick=()=>removeDesignLabInstallCard();
  card.querySelector('.designLabInstallPrimary').onclick=async()=>{
    if(designLabDeferredInstallPrompt){
      const prompt=designLabDeferredInstallPrompt;
      designLabDeferredInstallPrompt=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        if(choice?.outcome==='accepted')removeDesignLabInstallCard();
        else toast('Instalação cancelada');
      }catch(err){console.warn('Instalação PWA:',err);toast(designLabInstallInstructions());}
      return;
    }
    toast(designLabInstallInstructions());
  };
}
function initDesignLabInstallExperience(){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    designLabDeferredInstallPrompt=e;
    if(!designLabStandaloneMode())setTimeout(()=>showDesignLabInstallCard(true),250);
  });
  window.addEventListener('appinstalled',()=>{
    designLabDeferredInstallPrompt=null;
    removeDesignLabInstallCard();
    toast('DesignLabMoveis instalado · abra pelo ícone para usar sem barra de endereço');
  });
  const mq=window.matchMedia?.('(display-mode: standalone)');
  mq?.addEventListener?.('change',()=>{if(designLabStandaloneMode())removeDesignLabInstallCard();});
  // Se o navegador não emitir beforeinstallprompt (ex.: aba personalizada),
  // ainda explicamos como abrir/instalar corretamente.
  setTimeout(()=>showDesignLabInstallCard(false),1800);
}

function compareAppVersions(a,b){
  const aa=String(a||'').split('.').map(n=>Number(n)||0);
  const bb=String(b||'').split('.').map(n=>Number(n)||0);
  const len=Math.max(aa.length,bb.length);
  for(let i=0;i<len;i++){
    const av=aa[i]||0,bv=bb[i]||0;
    if(av>bv)return 1;
    if(av<bv)return -1;
  }
  return 0;
}
function setUpdateDialogStatus(message,tone=''){
  const el=$('updateDialogStatus');if(!el)return;
  el.textContent=message;
  el.className='updateNote'+(tone?` ${tone}`:'');
}
function updateCacheStatusUI(message=null){
  const el=$('appCacheStatus');
  if(!el)return;
  if(message){el.textContent=message;return;}
  if(!('serviceWorker' in navigator)){
    el.textContent='Cache offline não suportado neste navegador.';
    return;
  }
  if(location.protocol!=='https:'&&location.hostname!=='localhost'){
    el.textContent='Cache offline disponível quando publicado por HTTPS.';
    return;
  }
  el.textContent=navigator.onLine
    ? `Cache ativo · versão ${DESIGNLAB_APP_VERSION}`
    : `Offline · usando cache da versão ${DESIGNLAB_APP_VERSION}`;
}
function openUpdateDialog(info){
  designLabAvailableUpdate=info||designLabAvailableUpdate;
  if(!designLabAvailableUpdate)return;
  markDesignLabUpdateAvailable(designLabAvailableUpdate);
  $('updateCurrentVersion').textContent=DESIGNLAB_APP_VERSION;
  $('updateAvailableVersion').textContent=designLabAvailableUpdate.version||'nova';
  $('updateDialogMessage').textContent=designLabAvailableUpdate.message||
    'Existe uma versão mais nova do DesignLabMoveis.';
  setUpdateDialogStatus(
    designLabAvailableUpdate.required
      ? 'Esta atualização foi marcada como importante. Salve o projeto antes de atualizar.'
      : 'Você pode atualizar agora ou continuar trabalhando e instalar depois.',
    designLabAvailableUpdate.required?'warn':''
  );
  $('updateLaterBtn').style.display=designLabAvailableUpdate.required?'none':'';
  $('updateDialog').classList.add('show');
}
function closeUpdateDialog(){
  if(designLabAvailableUpdate?.required)return;
  $('updateDialog').classList.remove('show');
}
async function checkDesignLabUpdate({manual=false,force=false,autoApply=false}={}){
  const now=Date.now();
  if(!force&&!manual&&now-designLabLastUpdateCheck<DESIGNLAB_UPDATE_MIN_INTERVAL)return null;
  designLabLastUpdateCheck=now;

  const settingsBtn=manual?$('settingsCheckUpdate'):null;
  const oldSettingsText=settingsBtn?.textContent||'';
  if(settingsBtn){settingsBtn.disabled=true;settingsBtn.textContent='Verificando…';}
  if(manual)updateCacheStatusUI('Consultando a versão publicada no servidor…');

  if(!navigator.onLine){
    if(manual){toast('Sem internet · usando a versão salva no cache');updateCacheStatusUI(`Offline · versão instalada ${DESIGNLAB_APP_VERSION}`);}
    else updateCacheStatusUI();
    if(settingsBtn){settingsBtn.disabled=false;settingsBtn.textContent=oldSettingsText||'Verificar agora';}
    return null;
  }

  try{
    const res=await fetch(`${DESIGNLAB_VERSION_URL}?t=${Date.now()}`,{
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const info=await res.json();
    if(!info?.version)throw new Error('version.json inválido');

    if(compareAppVersions(info.version,DESIGNLAB_APP_VERSION)>0){
      designLabAvailableUpdate=info;
      markDesignLabUpdateAvailable(info);
      const editingProject=!!(typeof getProjects?.()?.state?.currentProjectId!=='undefined'&&getProjects()?.state?.currentProjectId&&!document.body.classList.contains('project-home-active'));
      if(autoApply&&!manual&&!editingProject&&document.visibilityState==='visible'){
        let last={};try{last=JSON.parse(sessionStorage.getItem('designLabAutoUpdateAttempt')||'{}')||{};}catch{}
        const target=String(info.version||'');
        if(last.version!==target || Date.now()-Number(last.at||0)>60000){
          try{sessionStorage.setItem('designLabAutoUpdateAttempt',JSON.stringify({version:target,at:Date.now()}));}catch{}
          applyDesignLabUpdate().catch(()=>{});
        }else notifyDesignLabUpdateOnce(info);
      }else if(manual){
        updateCacheStatusUI(`Servidor ${info.version} · instalada ${DESIGNLAB_APP_VERSION} · atualização disponível.`);
        openUpdateDialog(info);
      }else notifyDesignLabUpdateOnce(info);
      return info;
    }

    designLabAvailableUpdate=null;
    markDesignLabUpdateAvailable(null);
    if(manual){
      toast(`DesignLabMoveis ${DESIGNLAB_APP_VERSION} já está atualizado`);
      updateCacheStatusUI(`Servidor ${info.version} · instalada ${DESIGNLAB_APP_VERSION} · já está atualizada.`);
    }else updateCacheStatusUI();
    return info;
  }catch(err){
    console.warn('Verificação de atualização:',err);
    if(manual)toast('Não foi possível verificar atualização agora');
    updateCacheStatusUI('Não foi possível consultar a versão publicada no servidor.');
    return null;
  }finally{
    if(settingsBtn){settingsBtn.disabled=false;settingsBtn.textContent=oldSettingsText||'Verificar agora';}
  }
}
async function applyDesignLabUpdate(){
  if(designLabUpdating)return;
  designLabUpdating=true;
  $('updateNowBtn').disabled=true;
  $('updateLaterBtn').disabled=true;
  setUpdateDialogStatus('Preparando a nova versão…','warn');

  try{
    try{await projectAutosaveNow();}catch{}

    let targetBuild=String(designLabAvailableUpdate?.build||designLabAvailableUpdate?.version||Date.now());
    if('serviceWorker' in navigator){
      const reg=designLabSwRegistration || await navigator.serviceWorker.getRegistration();
      if(reg){
        designLabSwRegistration=reg;
        setUpdateDialogStatus('Baixando arquivos atualizados diretamente do servidor…','warn');
        await reg.update().catch(()=>{});
        reg.waiting?.postMessage?.({type:'SKIP_WAITING'});
        reg.active?.postMessage?.({type:'PURGE_APP_CACHE'});
      }
    }

    // Mesma limpeza do botão manual: a atualização automática não pode deixar
    // HTML novo usando JS/CSS antigos do PWA.
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('designlabmoveis-')||k.startsWith('mini-cad-pro-')).map(k=>caches.delete(k)));
    }

    if('serviceWorker' in navigator){
      const reg=designLabSwRegistration || await navigator.serviceWorker.getRegistration();
      if(reg?.waiting){
        await Promise.race([
          new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),
          new Promise(resolve=>setTimeout(resolve,900))
        ]);
      }
    }

    const target=new URL('/',location.origin);
    target.searchParams.set('_bootFresh',targetBuild);
    target.searchParams.set('_dlv',designLabAvailableUpdate?.version||String(Date.now()));
    target.searchParams.set('_refresh',String(Date.now()));
    setUpdateDialogStatus('Atualização pronta. Reiniciando o DesignLabMoveis…','good');
    setTimeout(()=>location.replace(target.toString()),250);
  }catch(err){
    console.error('Atualização:',err);
    designLabUpdating=false;
    $('updateNowBtn').disabled=false;
    $('updateLaterBtn').disabled=false;
    setUpdateDialogStatus('Não foi possível concluir. Tente novamente em alguns instantes.','error');
  }
}

async function forceDesignLabServerRefresh(){
  if(designLabUpdating)return false;
  designLabUpdating=true;
  const btn=$('settingsForceRefresh'),oldText=btn?.textContent||'';
  if(btn){btn.disabled=true;btn.textContent='Recarregando…';}
  updateCacheStatusUI('Limpando o cache e buscando os arquivos diretamente do servidor…');
  try{
    try{await projectAutosaveNow();}catch{}
    if('serviceWorker' in navigator){
      const reg=designLabSwRegistration || await navigator.serviceWorker.getRegistration();
      if(reg){
        designLabSwRegistration=reg;
        await reg.update().catch(()=>{});
        reg.waiting?.postMessage?.({type:'SKIP_WAITING'});
        reg.active?.postMessage?.({type:'PURGE_APP_CACHE'});
      }
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('designlabmoveis-')||k.startsWith('mini-cad-pro-')).map(k=>caches.delete(k)));
    }
    if('serviceWorker' in navigator){
      const reg=designLabSwRegistration || await navigator.serviceWorker.getRegistration();
      if(reg?.waiting){
        await Promise.race([
          new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),
          new Promise(resolve=>setTimeout(resolve,900))
        ]);
      }else{
        await new Promise(resolve=>setTimeout(resolve,120));
      }
    }
    // Remove o worker atual para que a próxima navegação não possa ser servida
    // por uma cópia antiga. A página nova registra o SW novamente sozinha.
    if('serviceWorker' in navigator){
      try{
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister().catch(()=>false)));
      }catch{}
    }
    let published='';
    try{
      const vr=await fetch(`/version.json?_force=${Date.now()}`,{cache:'no-store'});
      if(vr.ok)published=String((await vr.json())?.version||'');
    }catch{}
    const target=new URL('/',location.origin);
    target.searchParams.set('_bootFresh','manual-'+Date.now());
    target.searchParams.set('_server',published||DESIGNLAB_APP_VERSION);
    target.searchParams.set('_refresh',String(Date.now()));
    updateCacheStatusUI(`Reabrindo a versão publicada${published?' '+published:''}…`);
    setTimeout(()=>location.replace(target.toString()),120);
    return true;
  }catch(err){
    console.error('Recarregar servidor:',err);
    designLabUpdating=false;
    if(btn){btn.disabled=false;btn.textContent=oldText||'Recarregar versão do servidor';}
    toast('Não foi possível recarregar a versão do servidor agora');
    updateCacheStatusUI('Falha ao recarregar. A versão atual foi mantida.');
    return false;
  }
}

async function initDesignLabServiceWorker(){
  updateCacheStatusUI();

  if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;
  try{
    designLabSwRegistration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});

    // Pede ao navegador para conferir sw.js imediatamente a cada abertura.
    await designLabSwRegistration.update().catch(()=>{});

    designLabSwRegistration.addEventListener('updatefound',()=>{
      const nw=designLabSwRegistration.installing;
      if(!nw)return;
      nw.addEventListener('statechange',()=>{
        if(nw.state==='installed'&&navigator.serviceWorker.controller){
          // Não força reload no meio do trabalho: version.json controla o aviso.
          checkDesignLabUpdate({force:true}).catch(()=>{});
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      updateCacheStatusUI(`Cache renovado · versão ${DESIGNLAB_APP_VERSION}`);
    });
  }catch(err){
    console.warn('Service Worker:',err);
    updateCacheStatusUI('Não foi possível ativar o cache offline.');
  }
}


function showBannedAccount(reason=''){
  setCloudAccountBanned?.(true);
  $('authGate')?.classList.remove('hidden');
  $('authMainActions')?.classList.add('hidden');
  for(const id of ['authLoginForm','authSignupForm','authForgotForm'])$(id)?.classList.remove('show');
  $('authBannedPanel')?.classList.add('show');
  if($('authBannedReason'))$('authBannedReason').textContent=reason?`Motivo: ${reason}`:'Entre em contato com o administrador caso acredite que houve um engano.';
  setAuthStatus('Esta conta está bloqueada.','error');
}



  return {DESIGNLAB_APP_VERSION,DESIGNLAB_JS_BUILD,designLabRuntimeBuild,setDesignLabVisualizationOnly,designLabVisualizationOnlyActive,markDesignLabUpdateAvailable,notifyDesignLabUpdateOnce,designLabStandaloneMode,designLabIsMobile,removeDesignLabInstallCard,designLabInstallInstructions,showDesignLabInstallCard,initDesignLabInstallExperience,compareAppVersions,setUpdateDialogStatus,updateCacheStatusUI,openUpdateDialog,closeUpdateDialog,checkDesignLabUpdate,applyDesignLabUpdate,forceDesignLabServerRefresh,initDesignLabServiceWorker,showBannedAccount};
}
