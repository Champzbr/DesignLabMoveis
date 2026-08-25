
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const M_TO_MM = 1000;
const MM_TO_M = 0.001;
const MIN_SIZE = 0.001;       // 1 mm
const MAX_SIZE = 20;          // 20 m
const SNAP_THRESHOLD = 0.012; // 12 mm
const REAIM_THRESHOLD_PX = 3;
const CORNER_PICK_PX = 30;    // tolerância para reconhecer uma quina ao pegar a peça
const CORNER_SNAP_PX = 24;    // tolerância visual para encaixar quina com quina
const STORAGE_KEY = 'miniCadProV23_project';
const LEGACY_STORAGE_KEY_V22 = 'miniCadProV21_project';
const LEGACY_STORAGE_KEY_V20 = 'miniCadProV20_project';
const LEGACY_STORAGE_KEY_V19 = 'miniCadProV19_project';
const LEGACY_STORAGE_KEY_V18 = 'miniCadProV16_project';
const LEGACY_STORAGE_KEY_V15 = 'miniCadProV15_project';
const LEGACY_STORAGE_KEY = 'miniCadProV14_project';
const LEGACY_STORAGE_KEY_V13 = 'miniCadProV13_project';
const LEGACY_STORAGE_KEY_V12 = 'miniCadProV12_project';
const LEGACY_STORAGE_KEY_V11 = 'miniCadProV11_project';
const LEGACY_STORAGE_KEY_V10 = 'miniCadProV10_project';
const LEGACY_STORAGE_KEY_V9 = 'miniCadProV9_project';
const GUIDE_EXTENT = 50;
const DOUBLE_TAP_MS = 420;
const DOUBLE_TAP_PX = 36;
const TAPE_AIM_SNAP_PX = 62; // tolerância visual da Trena no celular
const TAPE_AXIS_ANGLE = 14 * Math.PI / 180;
const EDGE_PICK_PX = 24;       // reconhecer arestas com a Trena / Mover
const EDGE_SNAP_PX = 25;       // snap visual do Mover em arestas
const GUIDE_SNAP_PX = 36;      // snap visual do Mover nas guias da Trena
const FACE_SNAP_PX = 34;       // indicação de face sob o dedo
const GUIDE_OBJECT_SNAP_WORLD = 0.15; // até 150 mm para alinhar face/aresta da peça à guia

const $ = id => document.getElementById(id);


// ============================================================================
// v93 · GERENCIADOR DE PROJETOS
// ============================================================================
// O editor continua usando o estado interno original. Esta camada apenas
// organiza vários estados em IndexedDB, cria miniaturas, autosave e apresentação.
const PROJECT_DB_NAME='MiniCADProProjects';
const PROJECT_DB_VERSION=1;
const PROJECT_STORE='projects';
const PROJECT_FALLBACK_KEY='miniCadProjectsFallbackV93';
const PROJECT_MIGRATION_KEY='miniCadProjectsMigratedV93';
const PROJECT_EMERGENCY_KEY='miniCadEmergencyDraftV93';

let projectDbDisabled=false;
let projectDbPromise=null;
let currentProjectId=null;
let currentProjectRecord=null;
let currentProjectDirty=false;
let projectAutosaveTimer=null;
let projectMetaMode='new';
let projectCardMenuId=null;
let pendingRecovery=null;
let suppressProjectDirty=false;

function escapeHtml(v){
  return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}


// ============================================================================
// 1.100.20 · AUTENTICAÇÃO ONLINE — NETLIFY IDENTITY
// ============================================================================
let identityClient=null;
let currentIdentityUser=null;
let authLocalMode=false;
let authInitialized=false;
let authWidgetEventsBound=false;

function isLocalAuthDevelopment(){
  const protocol=String(location.protocol||'').toLowerCase();
  const host=String(location.hostname||'').toLowerCase();
  return protocol==='file:' || protocol==='content:' || host==='localhost' || host==='127.0.0.1';
}
function authUserName(user){
  const meta=user?.user_metadata||{};
  const full=String(meta.full_name||meta.name||'').trim();
  if(full)return full;
  const email=String(user?.email||'').trim();
  return email?email.split('@')[0]:'Usuário';
}
function authUserInitials(user){
  const name=authUserName(user),parts=name.split(/\s+/).filter(Boolean);
  if(parts.length>=2)return (parts[0][0]+parts.at(-1)[0]).toUpperCase();
  return name.slice(0,2).toUpperCase()||'MC';
}
function setAuthStatus(message,tone=''){
  const el=$('authStatus');if(!el)return;
  el.textContent=message;
  el.className='authStatus'+(tone?` ${tone}`:'');
}
function updateIdentityChrome(){
  const chip=$('projectAccountChip'),avatar=$('projectAccountAvatar'),name=$('projectAccountName'),
        email=$('projectAccountEmail'),logout=$('homeLogoutBtn'),menu=$('projectMenuAccount');

  if(authLocalMode){
    if(chip)chip.style.display='flex';
    if(avatar)avatar.textContent='L';
    if(name)name.textContent='Modo local';
    if(email)email.textContent='sem autenticação';
    if(logout)logout.style.display='none';
    if(menu)menu.innerHTML='<strong>Modo local</strong><br>Identity será testado no endereço HTTPS do Netlify.';
    return;
  }
  if(currentIdentityUser){
    if(chip)chip.style.display='flex';
    if(avatar)avatar.textContent=authUserInitials(currentIdentityUser);
    if(name)name.textContent=authUserName(currentIdentityUser);
    if(email)email.textContent=currentIdentityUser.email||'Conta Netlify';
    if(logout)logout.style.display='';
    if(menu)menu.innerHTML=`<strong>${escapeHtml(authUserName(currentIdentityUser))}</strong><br>${escapeHtml(currentIdentityUser.email||'')}<br>Conta autenticada · Premium ainda não conectado.`;
  }else{
    if(chip)chip.style.display='none';
    if(logout)logout.style.display='none';
    if(menu)menu.innerHTML='<strong>Conta desconectada</strong>';
  }
  if(typeof updateCloudAccountChrome==='function')updateCloudAccountChrome();
  if(typeof updateProjectHomeWelcome==='function')updateProjectHomeWelcome();
}
function lockOnlineApp(message='Entre para acessar o DesignLabMoveis.'){
  if(authLocalMode)return;
  currentIdentityUser=null;
  updateIdentityChrome();
  $('authGate')?.classList.remove('hidden');
  showAuthInlineForm('main');
  setAuthStatus(message,'');
}
function unlockOnlineApp(user,{message='Conta conectada.'}={}){
  currentIdentityUser=user||currentIdentityUser;
  authLocalMode=false;
  prepareProjectAccountSwitch();
  updateIdentityChrome();
  $('authGate')?.classList.add('hidden');
  setAuthStatus(message,'good');
  queueMicrotask(()=>applyProjectAccountScope({checkRecovery:true}));
  queueMicrotask(()=>syncCloudAccount({silent:true}));
}
function localAuthContinue(){
  if(!isLocalAuthDevelopment())return;
  authLocalMode=true;
  currentIdentityUser=null;
  prepareProjectAccountSwitch();
  updateIdentityChrome();
  updateCloudAccountChrome();
  $('authGate')?.classList.add('hidden');
  setAuthStatus('Modo local ativo. Publique no Netlify para testar cadastro e login.','warn');
  queueMicrotask(()=>applyProjectAccountScope({checkRecovery:true}));
}
async function waitForNetlifyIdentity(timeoutMs=10000){
  const start=Date.now();
  while(Date.now()-start<timeoutMs){
    if(window.netlifyIdentity)return window.netlifyIdentity;
    await new Promise(r=>setTimeout(r,80));
  }
  return null;
}
function bindIdentityEvents(client){
  if(authWidgetEventsBound||!client)return;
  authWidgetEventsBound=true;

  client.on('init',user=>{
    authInitialized=true;
    if(user)unlockOnlineApp(user,{message:'Sessão restaurada.'});
    else if(!authLocalMode)lockOnlineApp('Conta não conectada. Entre ou crie uma conta.');
  });
  client.on('login',user=>{
    unlockOnlineApp(user,{message:'Login realizado.'});
    try{client.close();}catch{}
  });
  client.on('logout',()=>{
    currentIdentityUser=null;
    authLocalMode=false;
    cloudAccountState={loading:false,ok:false,error:null,user:null,subscription:null,lastSync:null,banned:false};
    updateCloudAccountChrome();
    lockOnlineApp('Você saiu da conta.');
  });
  try{
    client.on('signup',user=>{
      currentIdentityUser=null;
      // Com confirmação obrigatória, o cadastro não libera o CAD ainda.
      // Fechamos o modal e voltamos para a tela de acesso com a orientação.
      try{client.close();}catch{}
      $('authGate')?.classList.remove('hidden');
      setAuthStatus(
        user?.confirmed_at?'Conta criada. Agora faça login.':'Conta criada. Confira seu e-mail e confirme o cadastro antes de entrar.',
        'good'
      );
    });
  }catch{}
  client.on('error',err=>{
    console.error('Netlify Identity:',err);
    setAuthStatus(`Autenticação: ${String(err?.message||err||'Falha na autenticação.')}`,'error');
  });
  try{
    client.on('open',()=>{
      // O widget oficial do Netlify é um modal próprio. O gate do DesignLabMoveis
      // precisa sair da frente enquanto o modal estiver aberto.
      $('authGate')?.classList.add('hidden');
      setAuthStatus('Formulário de autenticação aberto.','');
    });
    client.on('close',()=>{
      if(!currentIdentityUser&&!authLocalMode){
        $('authGate')?.classList.remove('hidden');
        setAuthStatus('Entre ou crie uma conta para continuar.','');
      }
    });
  }catch{}
}
async function initOnlineIdentity(){
  const local=isLocalAuthDevelopment();
  $('authLocalBox')?.classList.toggle('show',local);
  setAuthStatus(
    local?'Arquivo local detectado. Para testar o login real, use o endereço HTTPS publicado no Netlify.':'Conectando ao Netlify Identity…',
    local?'warn':''
  );

  const client=await waitForNetlifyIdentity();
  if(!client){
    setAuthStatus(
      local?'Identity não carregou no arquivo local. Você pode continuar em modo local.':'Não foi possível carregar o Netlify Identity. Confira a internet e tente novamente.',
      local?'warn':'error'
    );
    return;
  }

  identityClient=client;
  if(!currentIdentityUser&&!authLocalMode&&$('authMainActions')&&!$('authMainActions').classList.contains('hidden')){
    setAuthStatus('Autenticação pronta.','good');
  }

  // Mantém o widget oficial em Português para confirmação/recuperação por link.
  // "pt" é uma tradução suportada oficialmente pelo widget.
  try{client.setLocale?.('pt');}catch(err){console.warn('Não foi possível definir locale pt:',err);}

  bindIdentityEvents(client);

  try{
    const existing=client.currentUser?.();
    if(existing){
      authInitialized=true;
      unlockOnlineApp(existing,{message:'Sessão restaurada.'});
    }else{
      try{client.init?.();}catch{}
      setTimeout(()=>{
        if(!authInitialized&&!currentIdentityUser&&!authLocalMode){
          lockOnlineApp('Conta não conectada. Entre ou crie uma conta.');
        }
      },1200);
    }
  }catch(err){
    console.error(err);
    setAuthStatus('Não foi possível iniciar o serviço de login.','error');
  }

  const hash=String(location.hash||'');
  if(/confirmation_token=/i.test(hash)){
    setAuthStatus('Confirmação de e-mail recebida. Aguarde o Netlify concluir o cadastro…','good');
  }else if(/recovery_token=/i.test(hash)){
    setAuthStatus('Recuperação de senha detectada. Use o formulário do Netlify para definir a nova senha.','warn');
  }else if(/invite_token=/i.test(hash)){
    setAuthStatus('Convite recebido. Conclua seu cadastro no formulário do Netlify.','good');
  }
}

// ============================================================================
// 1.100.24 · FORMULÁRIOS PRÓPRIOS DE LOGIN
// O clique abre o formulário IMEDIATAMENTE; não esperamos o modal do widget.
// ============================================================================
function authFriendlyError(err){
  const raw=String(
    err?.json?.msg || err?.json?.error_description || err?.message ||
    err?.data?.msg || err?.msg || err || 'Não foi possível concluir.'
  ).trim();
  const s=raw.toLowerCase();

  if(s.includes('invalid login credentials')||s.includes('invalid_grant'))
    return 'E-mail ou senha incorretos.';
  if(s.includes('email not confirmed')||s.includes('not confirmed'))
    return 'Seu e-mail ainda não foi confirmado. Abra o e-mail de confirmação e tente novamente.';
  if(s.includes('already been registered')||s.includes('already registered'))
    return 'Já existe uma conta cadastrada com este e-mail.';
  if(s.includes('signups not allowed'))
    return 'O cadastro está desativado no Netlify Identity.';
  if(s.includes('password')&&s.includes('at least'))
    return 'A senha não atende ao tamanho mínimo exigido.';
  if(s.includes('rate limit')||s.includes('too many'))
    return 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.';
  if(s.includes('failed to fetch')||s.includes('network'))
    return 'Falha de conexão. Confira a internet e tente novamente.';
  return raw;
}
function showAuthInlineForm(mode='main'){
  $('authBannedPanel')?.classList.remove('show');
  const main=$('authMainActions');
  const forms={
    login:$('authLoginForm'),
    signup:$('authSignupForm'),
    forgot:$('authForgotForm')
  };
  main?.classList.toggle('hidden',mode!=='main');
  for(const [key,form] of Object.entries(forms))form?.classList.toggle('show',key===mode);

  if(mode==='login'){
    setAuthStatus(identityClient?'Digite seu e-mail e senha.':'O formulário já está pronto. O serviço de login está terminando de carregar…','');
    setTimeout(()=>$('authLoginEmail')?.focus(),30);
  }else if(mode==='signup'){
    setAuthStatus('Preencha os dados abaixo. O cadastro será enviado diretamente ao Identity.','');
    setTimeout(()=>$('authSignupName')?.focus(),30);
  }else if(mode==='forgot'){
    const known=$('authLoginEmail')?.value||$('authSignupEmail')?.value||'';
    if(known)$('authForgotEmail').value=known;
    setAuthStatus('Informe o e-mail usado na sua conta.','');
    setTimeout(()=>$('authForgotEmail')?.focus(),30);
  }else if(!currentIdentityUser){
    setAuthStatus(identityClient?'Autenticação pronta.':'Preparando autenticação…','');
  }
}
function authSetBusy(button,busy,labelBusy,labelNormal){
  if(!button)return;
  button.disabled=!!busy;
  button.textContent=busy?labelBusy:labelNormal;
}
async function getReadyGoTrue(timeoutMs=12000){
  if(identityClient?.gotrue)return identityClient.gotrue;
  const client=identityClient||await waitForNetlifyIdentity(timeoutMs);
  if(client&&!identityClient){
    identityClient=client;
    try{client.setLocale?.('pt');}catch{}
    bindIdentityEvents(client);
  }
  if(!client?.gotrue)throw new Error('O serviço de login ainda não carregou. Confira a internet e tente novamente.');
  return client.gotrue;
}
async function authSubmitLogin(e){
  e?.preventDefault?.();
  const email=String($('authLoginEmail').value||'').trim();
  const password=String($('authLoginPassword').value||'');
  const remember=!!$('authRememberMe').checked;
  if(!email||!password){setAuthStatus('Preencha e-mail e senha.','warn');return;}

  const btn=$('authLoginSubmit');
  authSetBusy(btn,true,'Entrando…','Entrar');
  setAuthStatus('Conectando sua conta…','');
  try{
    const auth=await getReadyGoTrue();
    const user=await auth.login(email,password,remember);
    currentIdentityUser=user;
    authInitialized=true;
    unlockOnlineApp(user,{message:'Login realizado.'});
  }catch(err){
    console.error('Login:',err);
    setAuthStatus(authFriendlyError(err),'error');
  }finally{
    authSetBusy(btn,false,'Entrando…','Entrar');
  }
}
async function authSubmitSignup(e){
  e?.preventDefault?.();
  const name=String($('authSignupName').value||'').trim();
  const email=String($('authSignupEmail').value||'').trim();
  const password=String($('authSignupPassword').value||'');
  const password2=String($('authSignupPassword2').value||'');
  if(!name||!email||!password||!password2){setAuthStatus('Preencha todos os campos.','warn');return;}
  if(password.length<6){setAuthStatus('Use uma senha com pelo menos 6 caracteres.','warn');return;}
  if(password!==password2){setAuthStatus('As duas senhas estão diferentes.','warn');return;}

  const btn=$('authSignupSubmit');
  authSetBusy(btn,true,'Criando conta…','Criar minha conta');
  setAuthStatus('Criando sua conta…','');
  try{
    // Cadastro via endpoint oficial do próprio site. Não depende da abertura
    // do modal e ainda permite gravar o nome em user_metadata.
    const res=await fetch('/.netlify/identity/signup',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({email,password,data:{full_name:name}})
    });
    let data=null;
    try{data=await res.json();}catch{}
    if(!res.ok){
      const err=new Error(data?.msg||data?.error_description||`Falha no cadastro (${res.status})`);
      err.json=data;throw err;
    }

    $('authSignupPassword').value='';
    $('authSignupPassword2').value='';
    showAuthInlineForm('main');
    setAuthStatus(`Conta criada para ${email}. Confira seu e-mail e toque no link de confirmação antes de entrar.`,'good');
  }catch(err){
    console.error('Cadastro:',err);
    setAuthStatus(authFriendlyError(err),'error');
  }finally{
    authSetBusy(btn,false,'Criando conta…','Criar minha conta');
  }
}
async function authSubmitForgot(e){
  e?.preventDefault?.();
  const email=String($('authForgotEmail').value||'').trim();
  if(!email){setAuthStatus('Digite o e-mail da sua conta.','warn');return;}

  const btn=$('authForgotSubmit');
  authSetBusy(btn,true,'Enviando…','Enviar recuperação');
  setAuthStatus('Solicitando recuperação de senha…','');
  try{
    // Endpoint oficial do GoTrue/Netlify Identity.
    const res=await fetch('/.netlify/identity/recover',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({email})
    });
    let data=null;
    try{data=await res.json();}catch{}
    if(!res.ok){
      const err=new Error(data?.msg||data?.error_description||`Falha na recuperação (${res.status})`);
      err.json=data;throw err;
    }
    showAuthInlineForm('main');
    setAuthStatus(`Se ${email} estiver cadastrado, o Netlify enviará o e-mail de recuperação.`,'good');
  }catch(err){
    console.error('Recuperação:',err);
    setAuthStatus(authFriendlyError(err),'error');
  }finally{
    authSetBusy(btn,false,'Enviando…','Enviar recuperação');
  }
}


function openIdentityMode(mode='login'){
  if(!identityClient){
    setAuthStatus('O serviço de autenticação ainda não carregou. Toque em “Verificar sessão”.','error');
    return;
  }
  try{
    setAuthStatus(mode==='signup'?'Abrindo criação de conta…':'Abrindo login…','');
    try{identityClient.setLocale?.('pt');}catch{}
    identityClient.open(mode);

    // Segurança extra: mesmo se uma versão do widget não disparar "open"
    // imediatamente, removemos o gate para o modal ficar visível.
    setTimeout(()=>{
      const widget=document.querySelector('.netlify-identity-widget');
      if(widget && !currentIdentityUser && !authLocalMode){
        $('authGate')?.classList.add('hidden');
      }
    },80);
  }catch(err){
    console.error(err);
    $('authGate')?.classList.remove('hidden');
    setAuthStatus('Não foi possível abrir o formulário de autenticação.','error');
  }
}
async function logoutOnlineIdentity(){
  if(authLocalMode){authLocalMode=false;lockOnlineApp('Modo local encerrado.');return;}
  if(!identityClient)return;
  try{await projectAutosaveNow();}catch{}
  try{await identityClient.logout();}
  catch(err){console.error(err);setAuthStatus('Não foi possível sair da conta agora.','error');}
}

window.miniCadAuth={
  getUser(){return currentIdentityUser;},
  isAuthenticated(){return !!currentIdentityUser&&!authLocalMode;},
  isLocalMode(){return !!authLocalMode;},
  async getToken(){
    if(!currentIdentityUser||authLocalMode)return null;
    try{
      if(typeof currentIdentityUser.jwt==='function'){
        const jwt=await currentIdentityUser.jwt();
        if(jwt)return jwt;
      }
    }catch(err){console.warn('Não foi possível obter JWT pelo usuário:',err);}
    try{
      const jwt=await identityClient?.refresh?.();
      if(jwt)return jwt;
    }catch(err){console.warn('Não foi possível renovar JWT:',err);}
    return currentIdentityUser?.token?.access_token||null;
  }
};




// ============================================================================
// 1.100.27 · SISTEMA DE ATUALIZAÇÃO + CACHE SEGURO
// ============================================================================
const DESIGNLAB_APP_VERSION='1.100.84';
const DESIGNLAB_VERSION_URL='./version.json';
const DESIGNLAB_UPDATE_MIN_INTERVAL=5*60*1000;

let designLabLastUpdateCheck=0;
let designLabAvailableUpdate=null;
let designLabUpdating=false;
let designLabSwRegistration=null;

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
async function checkDesignLabUpdate({manual=false,force=false}={}){
  const now=Date.now();
  if(!force&&!manual&&now-designLabLastUpdateCheck<DESIGNLAB_UPDATE_MIN_INTERVAL)return null;
  designLabLastUpdateCheck=now;

  if(!navigator.onLine){
    if(manual)toast('Sem internet · usando a versão salva no cache');
    updateCacheStatusUI();
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
      openUpdateDialog(info);
      return info;
    }

    designLabAvailableUpdate=null;
    if(manual)toast(`DesignLabMoveis ${DESIGNLAB_APP_VERSION} já está atualizado`);
    updateCacheStatusUI();
    return info;
  }catch(err){
    console.warn('Verificação de atualização:',err);
    if(manual)toast('Não foi possível verificar atualização agora');
    updateCacheStatusUI('Cache ativo · não foi possível consultar nova versão agora.');
    return null;
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

    if('serviceWorker' in navigator){
      const reg=designLabSwRegistration || await navigator.serviceWorker.getRegistration();
      if(reg){
        designLabSwRegistration=reg;
        setUpdateDialogStatus('Baixando arquivos atualizados e renovando o cache…','warn');
        await reg.update();

        const waiting=reg.waiting;
        if(waiting)waiting.postMessage({type:'SKIP_WAITING'});
      }
    }

    // Cache-buster garante que nem o navegador nem um SW antigo entreguem o HTML antigo.
    const target=new URL(location.href);
    target.searchParams.set('_dlv',designLabAvailableUpdate?.version||String(Date.now()));
    target.searchParams.set('_refresh',String(Date.now()));
    setUpdateDialogStatus('Atualização pronta. Reiniciando o DesignLabMoveis…','good');

    setTimeout(()=>location.replace(target.toString()),450);
  }catch(err){
    console.error('Atualização:',err);
    designLabUpdating=false;
    $('updateNowBtn').disabled=false;
    $('updateLaterBtn').disabled=false;
    setUpdateDialogStatus('Não foi possível concluir. Tente novamente em alguns instantes.','error');
  }
}
async function initDesignLabServiceWorker(){
  updateCacheStatusUI();

  if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;
  try{
    designLabSwRegistration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});

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


let adminPanelState={tab:'users',stats:null,users:[],payments:[],settings:{free_trial_days:15},search:'',paymentStatus:''};

function adminAllowed(){
  return !!(cloudAccountState.ok && cloudAccountState.user?.role==='admin' && !cloudAccountState.user?.banned);
}
function updateAdminVisibility(){
  const allowed=adminAllowed();
  for(const id of ['homeAdminPanel','homeAdminShortcut','menuAdminPanel']){
    const b=$(id);if(!b)continue;
    b.classList.toggle('show',allowed);
    b.style.display=allowed?'block':'none';
  }
  if(!allowed&&$('adminDialog')?.style.display==='flex')$('adminDialog').style.display='none';
}
function adminMoney(cents){return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function adminDate(value){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?String(value):d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
}
function adminSetStatus(message,tone=''){
  const el=$('adminStatus');if(!el)return;
  el.textContent=message;el.className=tone?tone:'';
}
function adminSetTab(tab){
  adminPanelState.tab=['users','payments','settings'].includes(tab)?tab:'users';
  $('adminUsersTab').style.display=adminPanelState.tab==='users'?'block':'none';
  $('adminPaymentsTab').style.display=adminPanelState.tab==='payments'?'block':'none';
  $('adminSettingsTab').style.display=adminPanelState.tab==='settings'?'block':'none';

  $('adminUsersTabBtn').classList.toggle('active',adminPanelState.tab==='users');
  $('adminUsersTabBtn').classList.toggle('secondary',adminPanelState.tab!=='users');
  $('adminPaymentsTabBtn').classList.toggle('active',adminPanelState.tab==='payments');
  $('adminPaymentsTabBtn').classList.toggle('secondary',adminPanelState.tab!=='payments');
  $('adminSettingsTabBtn').classList.toggle('active',adminPanelState.tab==='settings');
  $('adminSettingsTabBtn').classList.toggle('secondary',adminPanelState.tab!=='settings');
}
function renderAdminStats(){
  const s=adminPanelState.stats||{};
  $('adminStatUsers').textContent=Number(s.users_total||0);
  $('adminStatPremium').textContent=Number(s.premium_active||0);
  $('adminStatBanned').textContent=Number(s.banned_total||0);
  $('adminStatPending').textContent=Number(s.payments_pending||0);
}
function renderAdminUsers(){
  const box=$('adminUsersList'),users=adminPanelState.users||[];
  if(!users.length){box.innerHTML='<div class="adminEmpty">Nenhum usuário encontrado.</div>';return;}
  const me=cloudAccountState.user?.id||'';
  box.innerHTML=users.map(u=>{
    const premium=!!u.premium_active,banned=!!Number(u.banned),self=u.identity_user_id===me;
    return `<article class="adminUserCard" data-admin-user="${escapeHtml(u.identity_user_id)}">
      <div class="adminUserTop">
        <div><strong>${escapeHtml(u.name||'Sem nome')}</strong><small>${escapeHtml(u.email||'')}</small></div>
        <div class="adminBadges">
          ${u.role==='admin'?'<span class="adminBadge admin">ADMIN</span>':''}
          ${u.trial_active?'<span class="adminBadge trial">TESTE</span>':''}
          ${premium?'<span class="adminBadge premium">PREMIUM</span>':'<span class="adminBadge">FREE</span>'}
          ${banned?'<span class="adminBadge banned">BANIDO</span>':''}
        </div>
      </div>
      <div class="adminMeta">
        <div><strong>Cadastro</strong>${escapeHtml(adminDate(u.created_at))}</div>
        <div><strong>Premium até</strong>${escapeHtml(adminDate(u.premium_until))}</div>
        <div><strong>Compras pagas</strong>${Number(u.purchases_count||0)} · ${escapeHtml(adminMoney(u.paid_cents||0))}</div>
      </div>
      ${u.banned_reason?`<div class="adminMeta"><div><strong>Motivo do bloqueio</strong>${escapeHtml(u.banned_reason)}</div></div>`:''}
      <div class="adminActions">
        <button class="secondary" data-admin-action="premium7">+7 dias</button>
        <button class="secondary" data-admin-action="premium30">+30 dias</button>
        <button class="secondary" data-admin-action="premium90">+90 dias</button>
        <button class="secondary" data-admin-action="revoke">Retirar Premium</button>
        <button class="${banned?'secondary':'danger'}" data-admin-action="${banned?'unban':'ban'}" ${self?'disabled title="Você não pode banir a própria conta"':''}>${banned?'Desbanir':'Banir'}</button>
      </div>
    </article>`;
  }).join('');
}
function renderAdminPayments(){
  const box=$('adminPaymentsList'),rows=adminPanelState.payments||[];
  if(!rows.length){box.innerHTML='<div class="adminEmpty">Nenhum pagamento encontrado. Quando adicionarmos a compra de dias, eles aparecerão aqui.</div>';return;}
  box.innerHTML=rows.map(p=>{
    const pending=p.status==='pending';
    return `<article class="adminPaymentCard" data-admin-payment="${escapeHtml(p.id)}">
      <div class="adminPaymentTop">
        <div><strong>${escapeHtml(p.name||p.email||'Usuário')}</strong><small>${escapeHtml(p.email||'')} · ${escapeHtml(p.id)}</small></div>
        <div class="adminBadges"><span class="adminBadge ${p.status==='pending'?'pending':p.status==='paid'?'premium':''}">${escapeHtml(String(p.status||'').toUpperCase())}</span></div>
      </div>
      <div class="adminMeta">
        <div><strong>Valor</strong>${escapeHtml(adminMoney(p.amount_cents||0))}</div>
        <div><strong>Dias</strong>${Number(p.days_purchased||0)}</div>
        <div><strong>Criado</strong>${escapeHtml(adminDate(p.created_at))}</div>
      </div>
      ${pending?`<div class="adminActions"><button data-admin-payment-action="approve">✓ Aprovar pagamento</button><button class="danger" data-admin-payment-action="reject">Rejeitar</button></div>`:''}
    </article>`;
  }).join('');
}

function renderAdminSettings(){
  const s=adminPanelState.settings||{};
  const days=Math.max(0,Number(s.free_trial_days??15)||0);
  $('adminFreeTrialDays').value=days;
  $('adminTrialSettingsInfo').textContent=
    days>0
      ? `Novas contas recebem ${days} dia(s) de Premium grátis. O período começa na data de criação da conta no Netlify.`
      : 'Teste grátis desativado. Novas contas começam diretamente no plano Free.';
}
async function loadAdminSettings(){
  const d=await cloudApiFetch('/admin/settings');
  adminPanelState.settings=d?.settings||{free_trial_days:15};
  renderAdminSettings();
}
async function saveAdminSettings(){
  const raw=Number($('adminFreeTrialDays').value);
  const days=Math.max(0,Math.min(365,Math.trunc(Number.isFinite(raw)?raw:15)));
  $('adminFreeTrialDays').value=days;
  adminSetStatus('Salvando configuração do teste grátis…');
  try{
    const d=await cloudApiFetch('/admin/settings',{
      method:'POST',
      body:{free_trial_days:days}
    });
    adminPanelState.settings=d?.settings||{free_trial_days:days};
    renderAdminSettings();
    adminSetStatus(
      days>0
        ? `Teste grátis configurado em ${days} dia(s) para novas contas.`
        : 'Teste grátis desativado para novas contas.',
      'good'
    );
  }catch(err){
    adminSetStatus(err.message||'Não foi possível salvar a configuração.','error');
  }
}

async function loadAdminStats(){const d=await cloudApiFetch('/admin/stats');adminPanelState.stats=d?.stats||{};renderAdminStats();}
async function loadAdminUsers(){
  const q=new URLSearchParams({search:adminPanelState.search||'',limit:'60',offset:'0'});
  const d=await cloudApiFetch('/admin/users?'+q.toString());adminPanelState.users=d?.users||[];renderAdminUsers();
}
async function loadAdminPayments(){
  const q=new URLSearchParams({limit:'60',offset:'0'});
  if(adminPanelState.paymentStatus)q.set('status',adminPanelState.paymentStatus);
  const d=await cloudApiFetch('/admin/payments?'+q.toString());adminPanelState.payments=d?.payments||[];renderAdminPayments();
}
async function refreshAdminPanel(){
  if(!adminAllowed()){toast('Acesso administrativo não autorizado');return;}
  adminSetStatus('Atualizando painel…');
  try{
    await Promise.all([
      loadAdminStats(),
      adminPanelState.tab==='users'
        ? loadAdminUsers()
        : adminPanelState.tab==='payments'
          ? loadAdminPayments()
          : loadAdminSettings()
    ]);
    adminSetStatus('Painel atualizado.','good');
  }catch(err){
    console.error('Admin:',err);
    if(err.status===403){updateAdminVisibility();$('adminDialog').style.display='none';toast('Sua conta não possui acesso administrativo');return;}
    adminSetStatus(err.message||'Falha ao carregar painel.','error');
  }
}
async function openAdminPanel(){
  if(!adminAllowed()){toast('Painel disponível somente para administrador');return;}
  $('projectMenuPanel')?.classList.remove('show');
  $('adminDialog').style.display='flex';
  $('adminIdentityText').textContent=`Administrador: ${cloudAccountState.user?.name||currentIdentityUser?.email||''}`;
  adminSetTab('users');
  await refreshAdminPanel();
}
function closeAdminPanel(){$('adminDialog').style.display='none';}
async function adminPremium(userId,days){
  adminSetStatus(`Adicionando ${days} dia(s) de Premium…`);
  try{
    await cloudApiFetch(`/admin/users/${encodeURIComponent(userId)}/premium`,{method:'POST',body:{days}});
    await Promise.all([loadAdminStats(),loadAdminUsers()]);
    adminSetStatus(`${days} dia(s) adicionados com sucesso.`,'good');
  }catch(err){adminSetStatus(err.message||'Não foi possível atualizar Premium.','error');}
}
async function adminRevokePremium(userId){
  if(!confirm('Retirar o Premium deste usuário?'))return;
  try{
    await cloudApiFetch(`/admin/users/${encodeURIComponent(userId)}/premium/revoke`,{method:'POST',body:{}});
    await Promise.all([loadAdminStats(),loadAdminUsers()]);
    adminSetStatus('Premium removido.','good');
  }catch(err){adminSetStatus(err.message||'Falha ao retirar Premium.','error');}
}
async function adminBanUser(userId,banned){
  const reason=banned?(prompt('Motivo do bloqueio (opcional):','')||''):'';
  if(banned&&!confirm('Banir esta conta? O usuário perderá o acesso online ao DesignLabMoveis.'))return;
  if(!banned&&!confirm('Desbanir esta conta?'))return;
  try{
    await cloudApiFetch(`/admin/users/${encodeURIComponent(userId)}/ban`,{method:'POST',body:{banned,reason}});
    await Promise.all([loadAdminStats(),loadAdminUsers()]);
    adminSetStatus(banned?'Usuário banido.':'Usuário desbanido.','good');
  }catch(err){adminSetStatus(err.message||'Falha ao alterar bloqueio.','error');}
}
async function adminPaymentAction(paymentId,action){
  if(action==='approve'&&!confirm('Aprovar este pagamento e liberar os dias comprados?'))return;
  if(action==='reject'&&!confirm('Rejeitar este pagamento?'))return;
  try{
    await cloudApiFetch(`/admin/payments/${encodeURIComponent(paymentId)}/${action}`,{method:'POST',body:{}});
    await Promise.all([loadAdminStats(),loadAdminPayments()]);
    adminSetStatus(action==='approve'?'Pagamento aprovado.':'Pagamento rejeitado.','good');
  }catch(err){adminSetStatus(err.message||'Falha ao atualizar pagamento.','error');}
}
function showBannedAccount(reason=''){
  cloudAccountState.banned=true;
  $('authGate')?.classList.remove('hidden');
  $('authMainActions')?.classList.add('hidden');
  for(const id of ['authLoginForm','authSignupForm','authForgotForm'])$(id)?.classList.remove('show');
  $('authBannedPanel')?.classList.add('show');
  if($('authBannedReason'))$('authBannedReason').textContent=reason?`Motivo: ${reason}`:'Entre em contato com o administrador caso acredite que houve um engano.';
  setAuthStatus('Esta conta está bloqueada.','error');
}


const CLOUD_API_BASE='https://designlabmoveis-api.geppetomarcenaria.workers.dev';

let cloudAccountState={loading:false,ok:false,error:null,user:null,subscription:null,lastSync:null,banned:false};

function cloudPlanText(){
  const s=cloudAccountState.subscription;
  if(!s)return 'Plano não consultado';
  if(s.premium_active){
    const until=s.premium_until?new Date(s.premium_until):null;
    const date=until&&!Number.isNaN(until.getTime())?until.toLocaleDateString('pt-BR'):'';
    if(s.trial_active)return `Teste grátis${date?` até ${date}`:''}`;
    return `Premium${date?` até ${date}`:''}`;
  }
  return 'Plano Free';
}
function updateCloudAccountChrome(){
  updateAdminVisibility();
  const line=$('projectAccountCloud');
  const box=$('cloudAccountStatus');
  const menu=$('projectMenuAccount');

  if(authLocalMode){
    if(line){line.textContent='Modo local · nuvem desligada';line.className='cloudLine warn';}
    if(box){box.textContent='Nuvem: modo local. Publique no Netlify para testar D1/R2.';box.className='cloudAccountStatus warn';}
    return;
  }
  if(cloudAccountState.loading){
    if(line){line.textContent='Conectando à nuvem…';line.className='cloudLine';}
    if(box){box.textContent='Nuvem: conectando sua conta ao DesignLabMoveis API…';box.className='cloudAccountStatus';}
    return;
  }
  if(cloudAccountState.ok){
    const plan=cloudPlanText();
    if(line){line.textContent=`${plan} · Nuvem conectada`;line.className='cloudLine ok';}
    if(box){box.textContent=`Nuvem conectada · ${plan} · conta registrada no D1.`;box.className='cloudAccountStatus ok';}
    if(menu&&currentIdentityUser){
      menu.innerHTML=`<strong>${escapeHtml(authUserName(currentIdentityUser))}</strong><br>${escapeHtml(currentIdentityUser.email||'')}<br>${escapeHtml(plan)} · conta sincronizada com o D1.`;
    }
    return;
  }
  if(cloudAccountState.error){
    if(line){line.textContent='Nuvem indisponível';line.className='cloudLine warn';}
    if(box){box.textContent=`Nuvem: ${cloudAccountState.error}`;box.className='cloudAccountStatus error';}
    return;
  }
  if(line){line.textContent='Nuvem ainda não sincronizada';line.className='cloudLine';}
  if(box){box.textContent='Nuvem: aguardando login.';box.className='cloudAccountStatus';}
}
async function cloudApiFetch(path,{method='GET',body=null,timeoutMs=12000}={}){
  const token=await window.miniCadAuth?.getToken?.();
  if(!token)throw new Error('Não foi possível obter a sessão da conta.');

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(CLOUD_API_BASE+path,{
      method,mode:'cors',cache:'no-store',
      headers:{
        'Accept':'application/json',
        'Authorization':`Bearer ${token}`,
        ...(body?{'Content-Type':'application/json'}:{})
      },
      body:body?JSON.stringify(body):undefined,
      signal:controller.signal
    });
    let data=null;
    try{data=await res.json();}catch{}
    if(!res.ok){
      const message=data?.message||(res.status===401?'Sessão inválida ou expirada.':res.status===403?'Acesso negado pela API.':`API retornou erro ${res.status}.`);
      const err=new Error(message);err.status=res.status;err.data=data;throw err;
    }
    return data;
  }catch(err){
    if(err?.name==='AbortError')throw new Error('A API demorou demais para responder.');
    throw err;
  }finally{clearTimeout(timer);}
}
async function syncCloudAccount({silent=false}={}){
  if(authLocalMode||!currentIdentityUser){
    cloudAccountState={loading:false,ok:false,error:null,user:null,subscription:null,lastSync:null,banned:false};
    updateCloudAccountChrome();return null;
  }
  if(cloudAccountState.loading)return null;
  cloudAccountState.loading=true;cloudAccountState.error=null;updateCloudAccountChrome();

  try{
    const data=await cloudApiFetch('/me');
    cloudAccountState={
      loading:false,ok:!!data?.ok,error:null,user:data?.user||null,
      subscription:data?.subscription||null,lastSync:new Date().toISOString(),banned:false
    };
    updateCloudAccountChrome();

    await syncCloudProjects({silent:true});
    if(document.body.classList.contains('project-home-active'))await renderProjectHome();

    if(!silent)toast(`Conta conectada · ${cloudPlanText()}`);
    return data;
  }catch(err){
    console.error('Cloud account sync:',err);
    if(err?.status===403 && err?.data?.error==='banned'){
      cloudAccountState={loading:false,ok:false,error:'Conta bloqueada',user:null,subscription:null,lastSync:null,banned:true};
      updateCloudAccountChrome();
      showBannedAccount(err?.data?.reason||'');
      return null;
    }
    cloudAccountState={
      loading:false,ok:false,error:String(err?.message||'Não foi possível conectar à nuvem.'),
      user:null,subscription:null,lastSync:null,banned:false
    };
    updateCloudAccountChrome();
    if(!silent)toast('Login feito, mas a nuvem não respondeu');
    return null;
  }
}
window.designLabCloud={apiBase:CLOUD_API_BASE,getState(){return JSON.parse(JSON.stringify(cloudAccountState));},sync(){return syncCloudAccount({silent:false});},apiFetch:cloudApiFetch};



// ============================================================================
// 1.100.29 · SINCRONIZAÇÃO DE PROJETOS — D1 + R2
// ============================================================================
let cloudProjectsSyncing=false;
let cloudProjectsLastSync=null;

function projectIsoMs(v){
  const n=Date.parse(String(v||''));
  return Number.isFinite(n)?n:0;
}
function cloudProjectBadge(record){
  if(authLocalMode)return '<span class="projectCloudBadge local">Somente local</span>';
  if(record.cloudSyncedAt && projectIsoMs(record.cloudSyncedAt)>=projectIsoMs(record.updatedAt)){
    return '<span class="projectCloudBadge ok">☁ Nuvem</span>';
  }
  return '<span class="projectCloudBadge pending">☁ Aguardando sincronizar</span>';
}
async function cloudSaveProjectRecord(record,{silent=true}={}){
  if(authLocalMode||!currentIdentityUser||!cloudAccountState.ok||!record)return null;
  if(!projectBelongsToCurrentOwner(record)||record.deletedAt)return null;

  const clean=projectRecordCloudClean(record);
  try{
    const data=await cloudApiFetch(`/projects/${encodeURIComponent(clean.id)}`,{
      method:'PUT',body:{record:clean},timeoutMs:30000
    });
    const latest=await projectDbGet(clean.id);
    if(latest&&projectBelongsToCurrentOwner(latest)&&!latest.deletedAt){
      latest.cloudSyncedAt=projectNow();
      latest.cloudRevision=Number(data?.project?.cloud_revision||latest.cloudRevision||1);
      delete latest.cloudError;
      await projectDbPut(latest);
      if(currentProjectId===latest.id)currentProjectRecord={...latest};
    }
    if(document.body.classList.contains('project-home-active'))await renderProjectHome();
    if(!silent)toast('Projeto salvo na nuvem');
    return data;
  }catch(err){
    console.error('Salvar projeto na nuvem:',err);
    if(err?.status===409&&err?.data?.error==='project_deleted'){
      await projectDbDelete(record.id);
      if(currentProjectId===record.id){
        currentProjectId=null;currentProjectRecord=null;currentProjectDirty=false;
      }
      if(document.body.classList.contains('project-home-active'))await renderProjectHome();
      return null;
    }
    const latest=await projectDbGet(record.id);
    if(latest&&projectBelongsToCurrentOwner(latest)){
      latest.cloudError=String(err?.message||'Falha de sincronização');
      await projectDbPut(latest);
    }
    if(!silent)toast('Projeto salvo neste aparelho; nuvem pendente');
    return null;
  }
}
async function cloudDeleteProjectRecord(id,deletedAt,{silent=true}={}){
  if(authLocalMode||!currentIdentityUser||!cloudAccountState.ok||!id)return false;
  try{
    await cloudApiFetch(`/projects/${encodeURIComponent(id)}`,{
      method:'DELETE',body:{deleted_at:deletedAt||projectNow()},timeoutMs:20000
    });
    await projectDbDelete(id);
    if(!silent)toast('Projeto removido da nuvem');
    return true;
  }catch(err){
    console.error('Excluir projeto na nuvem:',err);
    if(!silent)toast('Exclusão ficará pendente até a internet voltar');
    return false;
  }
}
async function cloudDownloadProject(id){
  const data=await cloudApiFetch(`/projects/${encodeURIComponent(id)}`,{timeoutMs:30000});
  const rec=data?.record;
  if(!rec?.id)return null;
  rec.ownerUserId=projectCurrentOwnerId();
  rec.cloudSyncedAt=projectNow();
  rec.cloudRevision=Number(data?.project?.cloud_revision||rec.cloudRevision||1);
  delete rec.deletedAt;
  delete rec.cloudError;
  await projectDbPut(rec);
  return rec;
}
async function syncCloudProjects({silent=true}={}){
  if(cloudProjectsSyncing||authLocalMode||!currentIdentityUser||!cloudAccountState.ok)return null;
  cloudProjectsSyncing=true;
  try{
    const owner=projectCurrentOwnerId();
    if(!owner)return null;

    const remoteData=await cloudApiFetch('/projects?include_deleted=1',{timeoutMs:20000});
    const remote=Array.isArray(remoteData?.projects)?remoteData.projects:[];
    const remoteMap=new Map(remote.map(p=>[p.id,p]));
    const localAll=await projectDbList();
    const localOwned=localAll.filter(p=>p.ownerUserId===owner);
    const localMap=new Map(localOwned.map(p=>[p.id,p]));

    for(const meta of remote){
      const local=localMap.get(meta.id)||null;

      if(meta.deleted_at){
        if(local){
          const remoteDelete=projectIsoMs(meta.deleted_at);
          const localTime=Math.max(projectIsoMs(local.updatedAt),projectIsoMs(local.deletedAt));
          if(remoteDelete>=localTime || !local.deletedAt){
            if(currentProjectId===meta.id&&currentProjectDirty)continue;
            await projectDbDelete(meta.id);
          }else if(local.deletedAt){
            await cloudDeleteProjectRecord(local.id,local.deletedAt,{silent:true});
          }
        }
        continue;
      }

      if(!local){
        await cloudDownloadProject(meta.id);
        continue;
      }

      if(local.deletedAt){
        if(projectIsoMs(local.deletedAt)>=projectIsoMs(meta.updated_at)){
          await cloudDeleteProjectRecord(local.id,local.deletedAt,{silent:true});
        }else{
          await projectDbDelete(local.id);
        }
        continue;
      }

      const localTime=projectIsoMs(local.updatedAt);
      const remoteTime=projectIsoMs(meta.updated_at);

      if(remoteTime>localTime){
        if(currentProjectId===meta.id&&currentProjectDirty)continue;
        await cloudDownloadProject(meta.id);
      }else if(localTime>remoteTime){
        await cloudSaveProjectRecord(local,{silent:true});
      }else if(!local.cloudSyncedAt){
        local.cloudSyncedAt=projectNow();
        local.cloudRevision=Number(meta.cloud_revision||1);
        await projectDbPut(local);
      }
    }

    for(const local of localOwned){
      if(remoteMap.has(local.id))continue;
      if(local.deletedAt){
        await projectDbDelete(local.id);
        continue;
      }
      await cloudSaveProjectRecord(local,{silent:true});
    }

    cloudProjectsLastSync=projectNow();
    if(document.body.classList.contains('project-home-active'))await renderProjectHome();
    if(!silent)toast('Projetos sincronizados com a nuvem');
    return remoteData;
  }catch(err){
    console.error('Sincronizar projetos:',err);
    if(!silent)toast('Não foi possível sincronizar os projetos agora');
    return null;
  }finally{
    cloudProjectsSyncing=false;
  }
}
window.designLabCloudProjects={
  sync:()=>syncCloudProjects({silent:false}),
  save:record=>cloudSaveProjectRecord(record,{silent:false})
};



async function renderLegacyProjects(allRecords){
  const section=$('legacyProjectsSection'),box=$('legacyProjectCards');
  if(!section||!box)return;

  if(authLocalMode||!currentIdentityUser){
    section.classList.remove('show');box.innerHTML='';return;
  }

  const legacy=(allRecords||[])
    .filter(r=>!r.ownerUserId&&!r.deletedAt)
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));

  if(!legacy.length){
    section.classList.remove('show');box.innerHTML='';return;
  }

  section.classList.add('show');
  $('legacyImportAllBtn').textContent=`Importar todos (${legacy.length}) para minha conta`;
  box.innerHTML=legacy.map(rec=>`
    <article class="legacyProjectCard">
      <strong>${escapeHtml(rec.name||'Projeto antigo')}</strong>
      <span>${projectDateText(rec.updatedAt||rec.createdAt)}<br>Sem proprietário definido.</span>
      <button class="secondary" type="button" data-legacy-import="${escapeHtml(rec.id)}">Importar para minha conta</button>
    </article>
  `).join('');
}
async function claimLegacyProject(id,{silent=false}={}){
  const owner=projectCurrentOwnerId();
  if(!owner||authLocalMode)throw new Error('Entre na sua conta para importar');
  const rec=await projectDbGet(id);
  if(!rec)throw new Error('Projeto antigo não encontrado');

  if(rec.ownerUserId){
    if(rec.ownerUserId!==owner)throw new Error('Este projeto já pertence a outra conta');
    return rec;
  }

  rec.ownerUserId=owner;
  rec.ownerAssignedAt=projectNow();
  delete rec.cloudSyncedAt;delete rec.cloudRevision;delete rec.cloudError;
  await projectDbPut(rec);
  await cloudSaveProjectRecord(rec,{silent:true});
  await renderProjectHome();
  if(!silent)toast(`“${rec.name||'Projeto'}” importado para sua conta`);
  return rec;
}
async function claimAllLegacyProjects(){
  if(authLocalMode||!currentIdentityUser)return;
  const all=await projectDbList();
  const legacy=all.filter(r=>!r.ownerUserId&&!r.deletedAt);
  if(!legacy.length)return;

  if(!confirm(`Importar ${legacy.length} projeto(s) antigo(s) para esta conta?\n\nFaça isso somente se estes projetos realmente forem seus.`))return;

  for(const rec of legacy){
    try{await claimLegacyProject(rec.id,{silent:true});}catch(err){console.warn(err);}
  }
  await renderProjectHome();
  toast('Projetos antigos importados para sua conta');
}


function newProjectId(){
  try{if(crypto?.randomUUID)return 'proj_'+crypto.randomUUID();}catch{}
  return 'proj_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}
function projectNow(){return new Date().toISOString();}
function projectStateHasContent(state){
  if(!state)return false;
  if(Array.isArray(state))return state.length>0;
  return !!((state.objects?.length||0)+(state.guides?.length||0)+(state.spaces?.length||0));
}
function projectDateText(iso){
  if(!iso)return 'Sem data';
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return 'Sem data';
  const today=new Date(),same=today.toDateString()===d.toDateString();
  const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
  const yest=yesterday.toDateString()===d.toDateString();
  const time=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(same)return `Hoje · ${time}`;
  if(yest)return `Ontem · ${time}`;
  return d.toLocaleDateString('pt-BR')+' · '+time;
}
function projectSlug(v){
  return String(v||'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'projeto';
}
function openProjectDb(){
  if(projectDbDisabled||!('indexedDB' in window))return Promise.reject(new Error('IndexedDB indisponível'));
  if(projectDbPromise)return projectDbPromise;
  projectDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(PROJECT_DB_NAME,PROJECT_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(PROJECT_STORE)){
        const store=db.createObjectStore(PROJECT_STORE,{keyPath:'id'});
        store.createIndex('updatedAt','updatedAt',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Falha no banco de projetos'));
    req.onblocked=()=>reject(new Error('Banco de projetos bloqueado'));
  }).catch(err=>{projectDbDisabled=true;projectDbPromise=null;throw err;});
  return projectDbPromise;
}
function fallbackProjectList(){
  try{const v=JSON.parse(localStorage.getItem(PROJECT_FALLBACK_KEY)||'[]');return Array.isArray(v)?v:[];}catch{return [];}
}
function fallbackProjectWrite(list){try{localStorage.setItem(PROJECT_FALLBACK_KEY,JSON.stringify(list));}catch{}}



// ============================================================================
// 1.100.84 · HOME OPÇÃO 1
// ============================================================================
function updateProjectHomeWelcome(){
  const title=$('projectWelcomeTitle');
  if(!title)return;

  if(authLocalMode){
    title.textContent='Olá!';
    return;
  }
  if(currentIdentityUser){
    const full=String(authUserName(currentIdentityUser)||'').trim();
    const first=full.split(/\s+/)[0]||'';
    title.textContent=first?`Olá, ${first}!`:'Olá!';
    return;
  }
  title.textContent='Bem-vindo!';
}

function scrollProjectHomeTo(targetId){
  const home=$('projectHome');
  const target=$(targetId);
  if(!home||!target)return;
  const top=Math.max(0,target.offsetTop-14);
  home.scrollTo({top,behavior:'smooth'});
}

function openHomeModeling(){
  if(!currentProjectId){
    toast('Abra ou crie um projeto para entrar na modelagem');
    return;
  }
  enterProjectEditor();
}

function openHomeMaterials(){
  if(!currentProjectId){
    toast('Abra ou crie um projeto para acessar os materiais');
    return;
  }
  enterProjectEditor();
  setTimeout(()=>{
    try{openProductionDialog();}catch(err){console.warn(err);}
  },50);
}


// ============================================================================
// 1.100.29 · ESCOPO LOCAL POR CONTA
// ============================================================================
function projectCurrentOwnerId(){
  if(authLocalMode)return 'local-device';
  return String(currentIdentityUser?.id || cloudAccountState?.user?.id || '').trim();
}
function projectBelongsToCurrentOwner(record){
  const owner=projectCurrentOwnerId();
  return !!(record&&owner&&record.ownerUserId===owner);
}
function projectEmergencyKey(){
  return `${PROJECT_EMERGENCY_KEY}:${projectCurrentOwnerId()||'anonymous'}`;
}
function projectRecordCloudClean(record){
  if(!record)return null;
  const r={...record};
  delete r.draftState; delete r.draftCamera; delete r.draftAt;
  delete r.cloudSyncedAt; delete r.cloudRevision; delete r.cloudError;
  delete r.deletedAt;
  r.ownerUserId=projectCurrentOwnerId()||record.ownerUserId||null;
  return r;
}
function prepareProjectAccountSwitch(){
  const owner=projectCurrentOwnerId();
  if(currentProjectRecord && currentProjectRecord.ownerUserId!==owner){
    currentProjectId=null;
    currentProjectRecord=null;
    currentProjectDirty=false;
    suppressProjectDirty=true;
    try{
      applyProjectPresentationScene(false);
      clearScene();
      setFrontWorldView();
      resetProjectHistory();
    }catch{}
    suppressProjectDirty=false;
    updateProjectChrome();
  }
  closeProjectCardMenu?.();
  const cards=$('projectCards');
  if(cards)cards.innerHTML='<div class="projectEmpty">Carregando os projetos desta conta…</div>';
  if($('projectCountText'))$('projectCountText').textContent='Carregando…';
}
async function applyProjectAccountScope({checkRecovery=true}={}){
  prepareProjectAccountSwitch();
  await mergeEmergencyRecovery();
  if(document.body.classList.contains('project-home-active')||$('projectHome')?.style.display!=='none'){
    await renderProjectHome();
  }
  if(checkRecovery)await checkStartupRecovery();
}

async function projectDbList(){
  try{
    const db=await openProjectDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(PROJECT_STORE,'readonly'),req=tx.objectStore(PROJECT_STORE).getAll();
      req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
    });
  }catch{return fallbackProjectList();}
}
async function projectDbGet(id){
  if(!id)return null;
  try{
    const db=await openProjectDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(PROJECT_STORE,'readonly'),req=tx.objectStore(PROJECT_STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
    });
  }catch{return fallbackProjectList().find(x=>x.id===id)||null;}
}
async function projectDbPut(record){
  if(!record?.id)throw new Error('Projeto sem ID');
  try{
    const db=await openProjectDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(PROJECT_STORE,'readwrite');
      tx.objectStore(PROJECT_STORE).put(record);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }catch{
    const arr=fallbackProjectList(),i=arr.findIndex(x=>x.id===record.id);
    if(i>=0)arr[i]=record;else arr.push(record);
    fallbackProjectWrite(arr);
  }
  return record;
}
async function projectDbDelete(id){
  try{
    const db=await openProjectDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(PROJECT_STORE,'readwrite');
      tx.objectStore(PROJECT_STORE).delete(id);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }catch{fallbackProjectWrite(fallbackProjectList().filter(x=>x.id!==id));}
}
function captureProjectCamera(){
  return {
    position:perspectiveCamera.position.toArray(),
    target:controls.target.toArray(),
    up:perspectiveCamera.up.toArray(),
    fov:Number(perspectiveCamera.fov)||52
  };
}
function restoreProjectCamera(data){
  if(!data||!Array.isArray(data.position)||!Array.isArray(data.target))return false;
  if(viewMode2D||camera===orthoCamera)returnTo3D({restore:false,notify:false});
  perspectiveCamera.position.fromArray(data.position);
  perspectiveCamera.up.fromArray(Array.isArray(data.up)?data.up:[0,1,0]);
  perspectiveCamera.fov=Number(data.fov)||52;
  perspectiveCamera.updateProjectionMatrix();
  controls.target.fromArray(data.target);
  perspectiveCamera.lookAt(controls.target);
  controls.update();
  remember3DView();
  return true;
}
async function captureProjectThumbnail(){
  if(!objects.length&&!spaceRoots.length)return null;
  const was2D=viewMode2D;
  const saved2D=current2DView;
  const savedRoot=activeSpaceRoot();
  const wasVisual=visualMode;
  const savedPos=perspectiveCamera.position.clone();
  const savedUp=perspectiveCamera.up.clone();
  const savedTarget=controls.target.clone();
  const savedLast={position:last3DView.position.clone(),up:last3DView.up.clone(),target:last3DView.target.clone()};
  let result=null;
  try{
    if(was2D||camera===orthoCamera)returnTo3D({restore:true,notify:false});
    if(!visualMode)setVisualMode(true,{notify:false,frame:true});
    else frameFurnitureVisual();
    setPieceVisualEdgesVisible(false);
    renderer.render(scene,perspectiveCamera);

    const src=renderer.domElement,w=720,h=405;
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');ctx.fillStyle=cadBackgroundMode==='white'?'#f4f4f4':'#171717';ctx.fillRect(0,0,w,h);
    const scale=Math.min(w/src.width,h/src.height);
    const dw=src.width*scale,dh=src.height*scale;
    ctx.drawImage(src,(w-dw)/2,(h-dh)/2,dw,dh);
    result=c.toDataURL('image/jpeg',.82);
  }catch(err){
    console.warn('Miniatura do projeto:',err);
  }finally{
    setPieceVisualEdgesVisible(true);
    if(!wasVisual&&visualMode)setVisualMode(false,{notify:false,frame:false});
    perspectiveCamera.position.copy(savedPos);perspectiveCamera.up.copy(savedUp);
    controls.target.copy(savedTarget);perspectiveCamera.lookAt(savedTarget);
    perspectiveCamera.updateProjectionMatrix();controls.update();
    last3DView.position.copy(savedLast.position);last3DView.up.copy(savedLast.up);last3DView.target.copy(savedLast.target);
    if(was2D&&savedRoot&&saved2D)viewSpace(savedRoot,saved2D);
  }
  return result;
}
function updateProjectChrome(){
  const name=currentProjectRecord?.name||'Sem projeto';
  const top=$('editorProjectName');if(top)top.textContent=name;
  const dot=$('editorDirtyDot');if(dot)dot.classList.toggle('show',!!currentProjectDirty);
  const menuName=$('projectMenuProjectName');if(menuName)menuName.textContent=name;
  const status=$('projectMenuStatus');
  if(status)status.textContent=currentProjectId?(currentProjectDirty?'Alterações não salvas · autosave ativo':'Salvo'):'Abra ou crie um projeto';
  const current=$('projectCurrentStrip');
  if(current){
    if(currentProjectId){
      current.style.display='block';
      current.innerHTML=`Projeto atual: <strong>${escapeHtml(name)}</strong>${currentProjectDirty?' · <span style="color:#ffb14a">alterações em recuperação automática</span>':''}`;
    }else current.style.display='none';
  }
  for(const id of ['homeSaveProject','homeSaveAsProject','menuSaveProject','menuSaveAsProject','menuRenameProject','menuDuplicateProject','menuExportProjectFile']){
    const b=$(id);if(b)b.disabled=!currentProjectId;
  }
  document.title=currentProjectId?`${name} · DesignLabMoveis 1.100.84`:'DesignLabMoveis 1.100.84';
}
function markCurrentProjectDirty(){
  if(suppressProjectDirty||!currentProjectId)return;
  currentProjectDirty=true;updateProjectChrome();
  clearTimeout(projectAutosaveTimer);
  projectAutosaveTimer=setTimeout(()=>projectAutosaveNow(),1600);
}
async function projectAutosaveNow(){
  clearTimeout(projectAutosaveTimer);projectAutosaveTimer=null;
  if(!currentProjectId||!currentProjectDirty)return;
  try{
    const rec=await projectDbGet(currentProjectId);
    if(!rec||!projectBelongsToCurrentOwner(rec))return;
    rec.draftState=captureState();
    rec.draftCamera=captureProjectCamera();
    rec.draftAt=projectNow();
    await projectDbPut(rec);
    currentProjectRecord={...rec};
    try{
      localStorage.setItem(projectEmergencyKey(),JSON.stringify({
        id:rec.id,draftState:rec.draftState,draftCamera:rec.draftCamera,draftAt:rec.draftAt
      }));
    }catch{}
    updateProjectChrome();
  }catch(err){console.warn('Autosave:',err);}
}
async function clearProjectDraft(record){
  if(!record)return;
  delete record.draftState;delete record.draftCamera;delete record.draftAt;
  await projectDbPut(record);
  try{
    const e=JSON.parse(localStorage.getItem(projectEmergencyKey())||'null');
    if(e?.id===record.id)localStorage.removeItem(projectEmergencyKey());
  }catch{}
}
function applyProjectPresentationScene(on,{frame=false}={}){
  if(on){
    if(viewMode2D||camera===orthoCamera)returnTo3D({restore:true,notify:false});
    if(!visualMode)setVisualMode(true,{notify:false,frame:false});
    if(frame&&objects.length)frameFurnitureVisual();
    setPieceVisualEdgesVisible(false);
  }else{
    setPieceVisualEdgesVisible(true);
    if(visualMode)setVisualMode(false,{notify:false,frame:false});
  }
}
function resetProjectHistory(){
  history=[stateString()];historyIndex=0;
  localStorage.setItem(STORAGE_KEY,history[0]);
}
async function loadProjectRecord(record,{useDraft=false,presentation=true}={}){
  if(!record||!projectBelongsToCurrentOwner(record)){
    toast('Este projeto pertence a outra conta');
    return;
  }
  suppressProjectDirty=true;
  currentProjectId=record.id;
  currentProjectRecord={...record};
  const state=useDraft&&record.draftState?record.draftState:record.state;
  applyProjectPresentationScene(false);
  applyState(state||{version:93,objects:[],guides:[],spaces:[]});
  resetProjectHistory();
  const cam=useDraft&&record.draftCamera?record.draftCamera:record.camera;
  const restored=restoreProjectCamera(cam);
  currentProjectDirty=!!useDraft;
  suppressProjectDirty=false;
  updateProjectChrome();

  $('projectHome').style.display='none';
  document.body.classList.remove('project-home-active');
  $('projectMenuPanel').classList.remove('show');

  if(presentation&&projectStateHasContent(state)){
    document.body.classList.add('presentation-active');
    $('presentationProjectName').textContent=record.name||'Projeto';
    const meta=[record.client,record.environment].filter(Boolean).join(' · ');
    $('presentationProjectMeta').textContent=(meta?meta+' · ':'')+'Visualização limpa · arraste para girar · pinça/roda para zoom';
    applyProjectPresentationScene(true,{frame:!restored});
  }else{
    document.body.classList.remove('presentation-active');
    applyProjectPresentationScene(false);
    if(!restored&&objects.length)frameFurnitureVisual();
    $('hintText').textContent='Modo Projeto · selecione peças ou divisões para editar';
  }
}
function enterProjectEditor(){
  document.body.classList.remove('presentation-active','project-home-active');
  $('projectHome').style.display='none';
  applyProjectPresentationScene(false);
  $('hintText').textContent='Modo Projeto · selecione peças ou divisões para editar';
  updateProjectChrome();
}
async function renderProjectHome(){
  const cards=$('projectCards');if(!cards)return;
  const all=await projectDbList();
  const owner=projectCurrentOwnerId();

  const list=(owner
    ? all.filter(r=>r.ownerUserId===owner&&!r.deletedAt)
    : []
  ).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));

  $('projectCountText').textContent=`${list.length} projeto${list.length===1?'':'s'}`;
  cards.innerHTML='';

  if(!owner){
    cards.innerHTML='<div class="projectEmpty"><strong>Entre na sua conta.</strong><br>Os projetos ficam separados por usuário.</div>';
  }else if(!list.length){
    cards.innerHTML='<div class="projectEmpty"><strong>Nenhum projeto nesta conta ainda.</strong><br>Crie um novo projeto, abra um arquivo <b>.mcad</b> ou importe um projeto antigo deste dispositivo.</div>';
  }else{
    for(const rec of list){
      const el=document.createElement('article');
      el.className='projectCard';
      el.dataset.projectId=rec.id;
      const hasDraft=!!rec.draftState&&String(rec.draftAt||'')>String(rec.updatedAt||'');
      const meta=[rec.client,rec.environment].filter(Boolean).join(' · ');
      el.innerHTML=`
        <div class="projectThumb" data-project-action="present">
          ${rec.thumbnail?`<img src="${rec.thumbnail}" alt="">`:'<div class="projectThumbFallback">▱</div>'}
          ${hasDraft?'<div class="projectRecoveryBadge">RECUPERAÇÃO</div>':''}
        </div>
        <div class="projectCardBody">
          <div class="projectCardName">${escapeHtml(rec.name||'Projeto')}</div>
          <div class="projectCardMeta">
            ${meta?escapeHtml(meta)+'<br>':''}${projectDateText(rec.updatedAt||rec.createdAt)}
            <br>${cloudProjectBadge(rec)}
          </div>
          <div class="projectCardFooter">
            <button data-project-action="present" class="secondary">Visualizar</button>
            <button data-project-action="edit">Editar</button>
            <button data-project-action="menu" class="secondary">⋮</button>
          </div>
        </div>`;
      el.addEventListener('click',e=>{
        const action=e.target.closest('[data-project-action]')?.dataset.projectAction;
        if(!action)return;
        e.stopPropagation();
        if(action==='menu')openProjectCardMenu(rec.id,e.target);
        else requestOpenProject(rec.id,{presentation:action!=='edit'});
      });
      cards.appendChild(el);
    }
  }

  await renderLegacyProjects(all);
  updateProjectChrome();
  updateIdentityChrome();
}
async function showProjectHome(){
  await projectAutosaveNow();
  if(document.body.classList.contains('presentation-active'))applyProjectPresentationScene(false);
  document.body.classList.remove('presentation-active');
  document.body.classList.add('project-home-active');
  $('projectHome').style.display='block';
  $('projectMenuPanel').classList.remove('show');
  $('projectCardMenu').classList.remove('show');
  await renderProjectHome();
}
function openProjectMetaDialog(mode='new',record=currentProjectRecord){
  projectMetaMode=mode;
  const dlg=$('projectMetaDialog');
  if(mode==='new'){
    $('projectMetaTitle').textContent='Novo projeto';
    $('projectMetaHelp').textContent='Crie um projeto vazio. Cliente e ambiente são opcionais.';
    $('projectMetaName').value=`Projeto ${new Date().toLocaleDateString('pt-BR')}`;
    $('projectMetaClient').value='';
    $('projectMetaEnvironment').value='';
    $('projectMetaConfirm').textContent='Criar projeto';
  }else if(mode==='saveas'){
    $('projectMetaTitle').textContent='Salvar como';
    $('projectMetaHelp').textContent='Cria uma nova cópia independente do projeto atual.';
    $('projectMetaName').value=(record?.name||'Projeto')+' - cópia';
    $('projectMetaClient').value=record?.client||'';
    $('projectMetaEnvironment').value=record?.environment||'';
    $('projectMetaConfirm').textContent='Salvar cópia';
  }else{
    $('projectMetaTitle').textContent='Renomear projeto';
    $('projectMetaHelp').textContent='Atualize o nome, cliente ou ambiente.';
    $('projectMetaName').value=record?.name||'Projeto';
    $('projectMetaClient').value=record?.client||'';
    $('projectMetaEnvironment').value=record?.environment||'';
    $('projectMetaConfirm').textContent='Salvar nome';
  }
  dlg.classList.add('show');
  setTimeout(()=>$('projectMetaName').focus(),40);
}
function closeProjectMetaDialog(){$('projectMetaDialog').classList.remove('show');}
function readProjectMeta(){
  const name=String($('projectMetaName').value||'').trim();
  if(!name)throw new Error('Digite um nome para o projeto');
  return {name,client:String($('projectMetaClient').value||'').trim(),environment:String($('projectMetaEnvironment').value||'').trim()};
}
async function createNewProject(meta){
  await projectAutosaveNow();
  const owner=projectCurrentOwnerId();
  if(!owner){toast('Entre na sua conta para criar um projeto');return;}

  suppressProjectDirty=true;
  applyProjectPresentationScene(false);clearScene();setFrontWorldView();
  const now=projectNow();
  const rec={
    id:newProjectId(),ownerUserId:owner,
    name:meta.name,client:meta.client||'',environment:meta.environment||'',
    createdAt:now,updatedAt:now,state:captureState(),camera:captureProjectCamera(),
    thumbnail:null,appVersion:'1.100.84'
  };
  await projectDbPut(rec);
  currentProjectId=rec.id;currentProjectRecord={...rec};currentProjectDirty=false;
  resetProjectHistory();suppressProjectDirty=false;
  closeProjectMetaDialog();enterProjectEditor();updateProjectChrome();
  queueMicrotask(()=>cloudSaveProjectRecord(rec,{silent:true}));
  toast('Novo projeto criado');
}
async function saveCurrentProject({silent=false}={}){
  if(!currentProjectId){openProjectMetaDialog('new');return null;}
  const rec=(await projectDbGet(currentProjectId))||currentProjectRecord||{};
  if(!projectBelongsToCurrentOwner(rec)){
    toast('Este projeto não pertence à conta atual');
    return null;
  }

  const thumbnail=(await captureProjectThumbnail())||rec.thumbnail||null;
  const now=projectNow();
  const next={
    ...rec,...currentProjectRecord,
    id:currentProjectId,ownerUserId:projectCurrentOwnerId(),
    state:captureState(),camera:captureProjectCamera(),thumbnail,
    createdAt:rec.createdAt||now,updatedAt:now,appVersion:'1.100.84'
  };
  delete next.draftState;delete next.draftCamera;delete next.draftAt;
  delete next.deletedAt;
  await projectDbPut(next);
  currentProjectRecord={...next};currentProjectDirty=false;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(next.state));
  try{localStorage.removeItem(projectEmergencyKey());}catch{}
  updateProjectChrome();
  if(document.body.classList.contains('project-home-active'))await renderProjectHome();
  queueMicrotask(()=>cloudSaveProjectRecord(next,{silent:true}));
  if(!silent)toast(navigator.onLine?'Projeto salvo · sincronizando nuvem':'Projeto salvo neste aparelho · nuvem pendente');
  return next;
}
async function saveAsCurrentProject(meta){
  if(!currentProjectId)return createNewProject(meta);
  await projectAutosaveNow();

  const original=await projectDbGet(currentProjectId);
  if(!original||!projectBelongsToCurrentOwner(original)){
    toast('Este projeto não pertence à conta atual');
    return;
  }

  const thumb=(await captureProjectThumbnail())||original?.thumbnail||null;
  const now=projectNow();
  const next={
    id:newProjectId(),ownerUserId:projectCurrentOwnerId(),
    name:meta.name,client:meta.client||'',environment:meta.environment||'',
    createdAt:now,updatedAt:now,state:captureState(),camera:captureProjectCamera(),
    thumbnail:thumb,appVersion:'1.100.84'
  };
  await projectDbPut(next);
  if(original){
    delete original.draftState;delete original.draftCamera;delete original.draftAt;
    await projectDbPut(original);
  }
  currentProjectId=next.id;currentProjectRecord={...next};currentProjectDirty=false;
  try{localStorage.removeItem(projectEmergencyKey());}catch{}
  closeProjectMetaDialog();updateProjectChrome();
  if(document.body.classList.contains('project-home-active'))await renderProjectHome();
  queueMicrotask(()=>cloudSaveProjectRecord(next,{silent:true}));
  toast('Cópia criada com Salvar como');
}
async function renameCurrentProject(meta,record=currentProjectRecord){
  if(!record?.id)return;
  const rec=await projectDbGet(record.id);
  if(!rec||!projectBelongsToCurrentOwner(rec))return;
  Object.assign(rec,meta,{updatedAt:projectNow()});
  delete rec.cloudSyncedAt;
  await projectDbPut(rec);
  if(currentProjectId===rec.id)currentProjectRecord={...rec};
  closeProjectMetaDialog();updateProjectChrome();await renderProjectHome();
  queueMicrotask(()=>cloudSaveProjectRecord(rec,{silent:true}));
  toast('Projeto renomeado');
}
async function duplicateProjectById(id){
  const rec=await projectDbGet(id);
  if(!rec||!projectBelongsToCurrentOwner(rec))return;
  const now=projectNow();
  const copy={
    ...rec,id:newProjectId(),ownerUserId:projectCurrentOwnerId(),
    name:(rec.name||'Projeto')+' - cópia',createdAt:now,updatedAt:now
  };
  delete copy.draftState;delete copy.draftCamera;delete copy.draftAt;
  delete copy.cloudSyncedAt;delete copy.cloudRevision;delete copy.cloudError;delete copy.deletedAt;
  await projectDbPut(copy);
  await renderProjectHome();
  queueMicrotask(()=>cloudSaveProjectRecord(copy,{silent:true}));
  toast('Projeto duplicado');
}
async function deleteProjectById(id){
  const rec=await projectDbGet(id);
  if(!rec||!projectBelongsToCurrentOwner(rec))return;
  if(!window.confirm(`Excluir o projeto “${rec.name||'Projeto'}”?\n\nEle será removido desta conta e também da nuvem quando houver internet.`))return;

  const deletedAt=projectNow();
  rec.deletedAt=deletedAt;
  rec.updatedAt=deletedAt;
  await projectDbPut(rec);
  queueMicrotask(()=>cloudDeleteProjectRecord(id,deletedAt,{silent:true}));

  if(currentProjectId===id){
    currentProjectId=null;currentProjectRecord=null;currentProjectDirty=false;
    suppressProjectDirty=true;
    applyProjectPresentationScene(false);clearScene();setFrontWorldView();resetProjectHistory();
    suppressProjectDirty=false;
  }
  closeProjectCardMenu();updateProjectChrome();await renderProjectHome();toast('Projeto excluído');
}
function projectDownload(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}
async function exportProjectRecordFile(record){
  if(!record)return;
  const payload={
    format:'mini-cad-pro-project',formatVersion:1,appVersion:'1.100.84',exportedAt:projectNow(),
    project:{
      name:record.name||'Projeto',client:record.client||'',environment:record.environment||'',
      createdAt:record.createdAt||projectNow(),updatedAt:record.updatedAt||projectNow(),
      state:record.state||{version:93,objects:[],guides:[],spaces:[]},
      camera:record.camera||null,thumbnail:record.thumbnail||null
    }
  };
  projectDownload(payload,projectSlug(record.name)+'.mcad');
}
async function exportCurrentProjectFile(){
  if(!currentProjectId){toast('Abra ou crie um projeto');return;}
  const rec=await saveCurrentProject({silent:true});if(rec){await exportProjectRecordFile(rec);toast('Arquivo .mcad exportado');}
}
async function importProjectFile(file){
  const raw=JSON.parse(await file.text());
  let p=null;
  if(raw?.format==='mini-cad-pro-project'&&raw.project){
    p=raw.project;
  }else if(Array.isArray(raw)||Array.isArray(raw?.objects)){
    p={name:file.name.replace(/\.[^.]+$/,''),client:'',environment:'',state:raw,camera:null,thumbnail:null};
  }else throw new Error('Arquivo de projeto inválido');

  if(!Array.isArray(p.state)&&!Array.isArray(p.state?.objects))throw new Error('Projeto sem dados CAD');

  const owner=projectCurrentOwnerId();
  if(!owner)throw new Error('Entre na sua conta para importar o projeto');

  const now=projectNow();
  const rec={
    id:newProjectId(),ownerUserId:owner,
    name:String(p.name||file.name.replace(/\.[^.]+$/,'')||'Projeto importado'),
    client:String(p.client||''),environment:String(p.environment||''),
    createdAt:now,updatedAt:now,state:p.state,camera:p.camera||null,
    thumbnail:p.thumbnail||null,appVersion:'1.100.84'
  };
  await projectDbPut(rec);
  await loadProjectRecord(rec,{presentation:projectStateHasContent(rec.state)});
  if(!rec.thumbnail&&projectStateHasContent(rec.state)){
    const th=await captureProjectThumbnail();
    if(th){rec.thumbnail=th;await projectDbPut(rec);currentProjectRecord={...rec};}
  }
  queueMicrotask(()=>cloudSaveProjectRecord(rec,{silent:true}));
  toast('Projeto importado para sua conta');
}
async function requestOpenProject(id,{presentation=true}={}){
  await projectAutosaveNow();
  const rec=await projectDbGet(id);
  if(!rec||!projectBelongsToCurrentOwner(rec))return;
  if(rec.draftState&&String(rec.draftAt||'')>String(rec.updatedAt||'')){
    showRecoveryDialog(rec,{openAfter:true,presentation});
    return;
  }
  await loadProjectRecord(rec,{useDraft:false,presentation});
}
function showRecoveryDialog(record,{openAfter=false,presentation=true}={}){
  pendingRecovery={record,openAfter,presentation};
  $('recoveryText').innerHTML=`Encontramos alterações automáticas mais recentes em <strong>${escapeHtml(record.name||'Projeto')}</strong>.<br><br>Último autosave: ${projectDateText(record.draftAt)}.`;
  $('recoveryDialog').classList.add('show');
}
function closeRecoveryDialog(){$('recoveryDialog').classList.remove('show');pendingRecovery=null;}
async function recoverPendingProject(){
  const p=pendingRecovery;if(!p)return;
  $('recoveryDialog').classList.remove('show');pendingRecovery=null;
  await loadProjectRecord(p.record,{useDraft:true,presentation:p.presentation});
  toast('Alterações recuperadas · use Salvar para confirmar');
}
async function discardPendingRecovery(){
  const p=pendingRecovery;if(!p)return;
  const rec={...p.record};delete rec.draftState;delete rec.draftCamera;delete rec.draftAt;
  await projectDbPut(rec);
  try{const e=JSON.parse(localStorage.getItem(projectEmergencyKey())||'null');if(e?.id===rec.id)localStorage.removeItem(projectEmergencyKey());}catch{}
  $('recoveryDialog').classList.remove('show');pendingRecovery=null;
  if(p.openAfter)await loadProjectRecord(rec,{presentation:p.presentation});
  else await renderProjectHome();
}
function openProjectCardMenu(id,anchor){
  projectCardMenuId=id;
  const menu=$('projectCardMenu');menu.classList.add('show');
  const r=anchor.getBoundingClientRect(),mw=210,mh=185;
  menu.style.left=Math.max(8,Math.min(innerWidth-mw-8,r.right-mw))+'px';
  menu.style.top=Math.max(8,Math.min(innerHeight-mh-8,r.bottom+5))+'px';
}
function closeProjectCardMenu(){projectCardMenuId=null;$('projectCardMenu').classList.remove('show');}
async function migrateLegacySingleProject(){
  if(localStorage.getItem(PROJECT_MIGRATION_KEY))return;
  const existing=await projectDbList();
  if(existing.length){localStorage.setItem(PROJECT_MIGRATION_KEY,'1');return;}
  const keys=[STORAGE_KEY,LEGACY_STORAGE_KEY_V22,LEGACY_STORAGE_KEY_V18,LEGACY_STORAGE_KEY_V15,LEGACY_STORAGE_KEY,LEGACY_STORAGE_KEY_V13,LEGACY_STORAGE_KEY_V12,LEGACY_STORAGE_KEY_V11,LEGACY_STORAGE_KEY_V10,LEGACY_STORAGE_KEY_V9];
  let state=null;
  for(const k of keys){
    try{const s=localStorage.getItem(k);if(!s)continue;const v=JSON.parse(s);if(projectStateHasContent(v)){state=v;break;}}catch{}
  }
  if(state){
    const now=projectNow();
    await projectDbPut({id:newProjectId(),name:'Projeto anterior',client:'',environment:'',createdAt:now,updatedAt:now,state,camera:null,thumbnail:null,appVersion:'1.100.84'});
  }
  localStorage.setItem(PROJECT_MIGRATION_KEY,'1');
}
async function mergeEmergencyRecovery(){
  try{
    const e=JSON.parse(localStorage.getItem(projectEmergencyKey())||'null');
    if(!e?.id||!e.draftState)return;
    const rec=await projectDbGet(e.id);if(!rec)return;
    if(String(e.draftAt||'')>String(rec.draftAt||'')&&String(e.draftAt||'')>String(rec.updatedAt||'')){
      rec.draftState=e.draftState;rec.draftCamera=e.draftCamera||null;rec.draftAt=e.draftAt;await projectDbPut(rec);
    }
  }catch{}
}
async function checkStartupRecovery(){
  const owner=projectCurrentOwnerId();
  if(!owner)return;
  const list=await projectDbList();
  const rec=list
    .filter(r=>r.ownerUserId===owner&&!r.deletedAt&&r.draftState&&String(r.draftAt||'')>String(r.updatedAt||''))
    .sort((a,b)=>String(b.draftAt).localeCompare(String(a.draftAt)))[0];
  if(rec)showRecoveryDialog(rec,{openAfter:false,presentation:true});
}
async function initProjectHub(){
  await migrateLegacySingleProject();
  currentProjectId=null;currentProjectRecord=null;currentProjectDirty=false;
  updateProjectChrome();
  await showProjectHome();
}


// ---------- v61: painel flutuante / favoritos editáveis ----------
const TOOL_DOCK_PREFS_KEY='miniCadToolDockPrefsV62';
const TOOL_DOCK_LEGACY_PREFS_KEY='miniCadToolDockPrefsV61';
const TOOL_DOCK_POS_KEY='miniCadToolDockPosV61';
const TOOL_DOCK_DEFAULT=['space','select','move','tape','parts','materials','labels','machining','visual','more'];
const TOOL_DOCK_CATALOG=[
  // Projeto / navegação
  {group:'Projeto',key:'space',label:'＋ Espaço',desc:'Criar outro espaço'},
  {group:'Projeto',key:'select',label:'Selecionar',desc:'Selecionar peças e espaços'},
  {group:'Projeto',key:'move',label:'✥ Mover',desc:'Mover com snap e inferências'},
  {group:'Projeto',key:'tape',label:'📏 Trena',desc:'Medir e criar guias'},
  {group:'Projeto',key:'parts',label:'📋 Peças gerais',desc:'Lista geral e cálculo de chapas'},
  {group:'Projeto',key:'materials',label:'🎨 Materiais / fitas',desc:'Materiais do projeto e fita de borda'},
  {group:'Projeto',key:'labels',label:'🏷 Etiquetas',desc:'Visualizar e imprimir etiquetas das peças'},
  {group:'Projeto',key:'visual',label:'👁 Visual',desc:'Alternar Projeto / Visual'},
  {group:'Projeto',key:'xray',label:'◈ Raio-X 3D',desc:'Mostrar contornos internos através das chapas'},
  {group:'Projeto',key:'view3d',label:'◇ Vista 3D',desc:'Voltar à perspectiva 3D'},
  {group:'Projeto',key:'undo',label:'↶ Desfazer',desc:'Voltar uma alteração'},
  {group:'Projeto',key:'redo',label:'↷ Refazer',desc:'Refazer alteração'},

  // Peça / usinagem
  {group:'Peça / Usinagem',key:'inspector',label:'📐 Medidas / posição',desc:'Editar medidas da peça selecionada'},
  {group:'Peça / Usinagem',key:'openSpace',label:'▣ Abrir espaço do móvel',desc:'Abrir o espaço ligado à peça'},
  {group:'Peça / Usinagem',key:'hole',label:'● Furo',desc:'Criar furo na peça selecionada'},
  {group:'Peça / Usinagem',key:'groove',label:'▱ Rasgo',desc:'Criar rasgo na peça selecionada'},
  {group:'Peça / Usinagem',key:'hardware',label:'⚙ Ferragens',desc:'Aplicar/criar ferragens inteligentes'},
  {group:'Peça / Usinagem',key:'shape',label:'◜ Forma',desc:'Alterar o contorno externo da peça'},
  {group:'Peça / Usinagem',key:'machining',label:'🛠 Usinagens',desc:'Abrir lista e editor de usinagens'},
  {group:'Peça / Usinagem',key:'duplicate',label:'⧉ Duplicar peça',desc:'Duplicar a peça selecionada'},
  {group:'Peça / Usinagem',key:'deleteSelected',label:'🗑 Excluir peça',desc:'Excluir a peça selecionada'},

  // Espaço / móvel
  {group:'Espaço / Móvel',key:'cutSpace',label:'✂ Corte',desc:'Cortar a divisão selecionada'},
  {group:'Espaço / Móvel',key:'createPieces',label:'▰ Criar peças',desc:'Criar laterais, base, prateleiras, portas etc.'},
  {group:'Espaço / Móvel',key:'drawers',label:'▤ Gavetas / corrediças',desc:'Criar gavetas paramétricas com corrediças e furação automática'},
  {group:'Espaço / Móvel',key:'curvedStructure',label:'◒ Móvel curvo',desc:'Criar estrutura curva dentro do espaço selecionado'},
  {group:'Espaço / Móvel',key:'library',label:'▦ Biblioteca',desc:'Abrir biblioteca de modelos por pastas'},
  {group:'Espaço / Móvel',key:'editSpace',label:'✎ Editar espaço',desc:'Alterar tamanho do móvel sem apagar peças'},
  {group:'Espaço / Móvel',key:'adjacentSpace',label:'＋ Outro espaço',desc:'Criar espaço relativo ao móvel atual'},
  {group:'Espaço / Móvel',key:'toggleSpace',label:'◫ Ocultar divisão',desc:'Ocultar a divisão selecionada'},
  {group:'Espaço / Móvel',key:'toggleDoors',label:'▥ Ocultar / mostrar portas',desc:'Alternar visibilidade das portas'},
  {group:'Espaço / Móvel',key:'showHiddenSpaces',label:'◩ Mostrar divisões ocultas',desc:'Reexibir todas as divisões ocultas'},
  {group:'Espaço / Móvel',key:'exportFurniture',label:'⇩ Exportar móvel STL',desc:'Exportar o modelo 3D completo em STL'},
  {group:'Espaço / Móvel',key:'aspireFurniture',label:'DXF Aspire · móvel',desc:'Gerar Aspire ZIP do móvel selecionado'},
  {group:'Espaço / Móvel',key:'aspireProject',label:'DXF Aspire · projeto',desc:'Gerar todas as chapas do projeto inteiro'},
  {group:'Espaço / Móvel',key:'deleteSpace',label:'🗑 Excluir espaço',desc:'Excluir o móvel/espaço selecionado'},

  // Vistas técnicas
  {group:'Vistas',key:'front',label:'Vista frontal',desc:'Vista 2D frontal'},
  {group:'Vistas',key:'back',label:'Vista traseira',desc:'Vista 2D traseira'},
  {group:'Vistas',key:'left',label:'Vista lateral esq.',desc:'Vista 2D lateral esquerda'},
  {group:'Vistas',key:'right',label:'Vista lateral dir.',desc:'Vista 2D lateral direita'},
  {group:'Vistas',key:'top',label:'Vista de cima',desc:'Vista 2D superior'},
  {group:'Vistas',key:'bottom',label:'Vista de baixo',desc:'Vista 2D inferior'},

  // Arquivo / manutenção
  {group:'Arquivo / Manutenção',key:'save',label:'💾 Salvar',desc:'Salvar projeto atual e atualizar a miniatura'},
  {group:'Arquivo / Manutenção',key:'load',label:'📂 Projetos',desc:'Voltar à tela inicial e abrir outro projeto'},
  {group:'Arquivo / Manutenção',key:'exportProject',label:'⇩ Exportar .mcad',desc:'Baixar uma cópia portátil do projeto'},
  {group:'Arquivo / Manutenção',key:'importProject',label:'⇧ Abrir arquivo',desc:'Abrir arquivo .mcad ou JSON antigo'},
  {group:'Arquivo / Manutenção',key:'importFurniture',label:'⇧ Importar móvel',desc:'Adicionar um móvel exportado ao projeto'},
  {group:'Arquivo / Manutenção',key:'clearGuides',label:'⌫ Limpar guias',desc:'Remover todas as guias da Trena'},
  {group:'Arquivo / Manutenção',key:'clearProject',label:'⚠ Limpar projeto',desc:'Apagar todo o projeto atual'},
  {group:'Arquivo / Manutenção',key:'more',label:'Mais ⋯',desc:'Abrir o menu completo original'}
];
let toolDockPrefs=loadToolDockPrefs();
let toolDockDraft=null;

function loadToolDockPrefs(){
  try{
    const stored=localStorage.getItem(TOOL_DOCK_PREFS_KEY) || localStorage.getItem(TOOL_DOCK_LEGACY_PREFS_KEY);
    const raw=JSON.parse(stored||'null');
    if(Array.isArray(raw)){
      const valid=raw.filter(k=>TOOL_DOCK_CATALOG.some(t=>t.key===k));
      // v62: inclui Usinagens na migração caso o usuário ainda esteja com o conjunto padrão antigo.
      if(valid.length){
        if(!valid.includes('machining') && valid.includes('more')) valid.splice(Math.max(0,valid.indexOf('more')),0,'machining');
        if(!valid.includes('curvedStructure')) valid.splice(Math.min(valid.length,Math.max(1,valid.indexOf('space')+1)),0,'curvedStructure');
        if(!valid.includes('drawers')) valid.splice(Math.min(valid.length,Math.max(1,valid.indexOf('curvedStructure'))),0,'drawers');
        return valid;
      }
    }
  }catch{}
  return [...TOOL_DOCK_DEFAULT];
}
function saveToolDockPrefs(){
  try{localStorage.setItem(TOOL_DOCK_PREFS_KEY,JSON.stringify(toolDockPrefs));}catch{}
}
function toolDockDef(key){return TOOL_DOCK_CATALOG.find(t=>t.key===key)||null;}
function toolDockLabel(key){
  if(key==='visual')return visualMode?'🛠 Projeto':'👁 Visual';
  if(key==='xray')return xray3DEnabled?'◈ Raio-X: ligado':'◈ Raio-X: desligado';
  return toolDockDef(key)?.label||key;
}
function syncToolDockButtons(){
  document.querySelectorAll('#toolDockTools [data-dock-tool]').forEach(b=>{
    const key=b.dataset.dockTool;
    b.textContent=toolDockLabel(key);
    const active=(key==='select'&&toolMode==='select')||(key==='move'&&toolMode==='move-free')||(key==='tape'&&toolMode==='tape')||(key==='visual'&&visualMode)||(key==='xray'&&xray3DEnabled);
    b.classList.toggle('active',active);
    b.classList.toggle('secondary',!active);
  });
}
function renderToolDock(){
  const box=$('toolDockTools'); if(!box)return;
  box.innerHTML='';
  for(const key of toolDockPrefs){
    const def=toolDockDef(key); if(!def)continue;
    const b=document.createElement('button');
    b.type='button'; b.dataset.dockTool=key; b.className='secondary'; b.textContent=toolDockLabel(key);
    b.addEventListener('click',()=>runDockTool(key));
    box.appendChild(b);
  }
  syncToolDockButtons();
}
function toggleMorePanel(){
  const panel=$('morePanel'); if(!panel)return;
  const show=panel.style.display!=='block';
  panel.style.display=show?'block':'none';
  if(show){
    const ok=!!selected&&selected.userData?.kind!=='cylinder';
    for(const id of ['addHoleBtn','addGrooveBtn','addHardwareBtn','addShapeBtn','manageMachiningBtn']){
      const el=$(id); if(el)el.disabled=!ok;
    }
    const mmgr=$('manageMachiningBtn');
    if(mmgr)mmgr.textContent=ok&&selected.userData?.machining?.length?`Usinagens (${selected.userData.machining.length})`:'Usinagens';
  }
}
function applyXray3D(enabled,{persist=true,notify=false}={}){
  xray3DEnabled=!!enabled;

  if(persist){
    try{localStorage.setItem(XRAY_3D_KEY,xray3DEnabled?'1':'0');}catch{}
  }

  if(viewMode2D){
    // As vistas técnicas 2D continuam com seu próprio X-Ray interno.
    // A opção abaixo controla principalmente o 3D em perspectiva.
    const root=activeSpaceRoot();
    applyTechnical2DTransparency(root,current2DView||'front');
  }else{
    // DESLIGADO: depthTest normal -> o que estiver atrás da chapa some.
    // LIGADO: linhas ignoram o depth buffer -> todos os contornos aparecem.
    setPieceVisualEdgesVisible(true);
  }

  // Eixos globais nunca atravessam o móvel. O Raio-X é reservado para
  // contornos técnicos das peças, não para os eixos XYZ.
  for(const axis of [worldAxisX,worldAxisY,worldAxisZ]){
    if(axis?.material){
      axis.material.depthTest=true;
      axis.material.depthWrite=false;
      axis.material.needsUpdate=true;
    }
  }
  updateSpaceSelectionVisuals();
  updateXray3DButton();
  syncToolDockButtons();

  if(notify){
    toast(xray3DEnabled
      ? 'Raio-X 3D ligado · contornos internos visíveis'
      : 'Visual sólido · linhas internas ocultas');
  }
}
function toggleDockXray(){
  applyXray3D(!xray3DEnabled,{persist:true,notify:true});
}
function dockEnsurePiece(){
  if(!selected){toast('Selecione uma peça primeiro');return false;}
  return true;
}
function dockEnsureSpace(needsCell=false){
  let root=activeSpaceRoot();
  if(!root && selected){openSpaceFromObject(selected);root=activeSpaceRoot();}
  if(!root){toast('Selecione um espaço ou uma peça do móvel');return false;}
  if(needsCell && !selectedSpaceCell){
    const cell=largestVisibleCell(root);
    if(cell)selectSpaceCellByIds(root.id,cell.id);
  }
  if(needsCell && !selectedSpaceCell){toast('Este móvel não tem divisão livre para esta ferramenta');return false;}
  return true;
}
function dockClick(id){const el=$(id);if(!el){toast('Ferramenta indisponível');return false;}el.click();return true;}
function dockView(view){if(!dockEnsureSpace(false))return;const root=activeSpaceRoot();if(root)viewSpace(root,view);}
// v64: o painel flutuante fecha sempre que uma ação abrir outra janela/menu.
// Ferramentas de alternância permanecem abertas para permitir ligar/desligar rapidamente.
function closeToolDockBeforeMenu(){
  setToolDockOpen(false);
}
function runDockTool(key){
  if(key==='space'){ if(visualMode)setVisualMode(false,{notify:false,frame:false}); closeToolDockBeforeMenu(); openNewSpaceDialog(activeSpaceRoot()||spaceRoots.at(-1)||null); }
  else if(key==='select')setTool('select');
  else if(key==='move')setTool('move-free');
  else if(key==='tape')setTool('tape');
  else if(key==='parts'){closeToolDockBeforeMenu();openPartsListDialog();}
  else if(key==='materials'){closeToolDockBeforeMenu();openProductionDialog();}
  else if(key==='labels'){closeToolDockBeforeMenu();openLabelsDialog();}
  else if(key==='visual')setVisualMode(!visualMode,{frame:true});
  else if(key==='xray')toggleDockXray();
  else if(key==='view3d'){returnTo3D({restore:true,notify:false});setFrontWorldView();toast('Vista 3D');}
  else if(key==='undo')undo();
  else if(key==='redo')redo();

  else if(key==='inspector'){if(dockEnsurePiece()){closeToolDockBeforeMenu();dockClick('showInspectorBtn');}}
  else if(key==='openSpace'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openSpaceFromObject(selected);}}
  else if(key==='hole'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog('hole');}}
  else if(key==='groove'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog('groove');}}
  else if(key==='hardware'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog('hardware');}}
  else if(key==='shape'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openShapeDialog();}}
  else if(key==='machining'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog((selected?.userData?.machining||[])[0]?.type||'hole');}}
  else if(key==='duplicate'){if(dockEnsurePiece())duplicateSelected();}
  else if(key==='deleteSelected'){if(dockEnsurePiece())deleteSelected();}

  else if(key==='cutSpace'){if(dockEnsureSpace(true)){closeToolDockBeforeMenu();dockClick('cutSpaceBtn');}}
  else if(key==='createPieces'){if(dockEnsureSpace(true)){closeToolDockBeforeMenu();dockClick('createPiecesBtn');}}
  else if(key==='drawers'){closeToolDockBeforeMenu();openDrawerSystemDialog();}
  else if(key==='curvedStructure'){closeToolDockBeforeMenu();openCurvedStructureDialog();}
  else if(key==='library'){if(dockEnsureSpace(true)){closeToolDockBeforeMenu();dockClick('openLibraryBtn');}}
  else if(key==='editSpace'){if(dockEnsureSpace(false)){closeToolDockBeforeMenu();openEditSpaceDialog();}}
  else if(key==='adjacentSpace'){if(dockEnsureSpace(false)){if(visualMode)setVisualMode(false,{notify:false,frame:false});closeToolDockBeforeMenu();openNewSpaceDialog(activeSpaceRoot());}}
  else if(key==='toggleSpace'){if(dockEnsureSpace(true))toggleActiveSpaceVisibility();}
  else if(key==='toggleDoors'){if(dockEnsureSpace(false))toggleDoorsForActiveSpace();}
  else if(key==='showHiddenSpaces')showAllHiddenSpaces();
  else if(key==='exportFurniture'){if(dockEnsureSpace(false))exportSelectedFurniture();}
  else if(key==='aspireFurniture'){if(dockEnsureSpace(false))exportSelectedAspireDxf();}
  else if(key==='aspireProject')exportProjectAspireZip();
  else if(key==='deleteSpace'){if(dockEnsureSpace(false)){closeToolDockBeforeMenu();deleteSelectedSpaceRoot();}}

  else if(key==='front')dockView('front');
  else if(key==='back')dockView('back');
  else if(key==='left')dockView('left');
  else if(key==='right')dockView('right');
  else if(key==='top')dockView('top');
  else if(key==='bottom')dockView('bottom');

  else if(key==='save')dockClick('saveBtn');
  else if(key==='load')dockClick('loadBtn');
  else if(key==='exportProject')dockClick('exportBtn');
  else if(key==='importProject'){closeToolDockBeforeMenu();dockClick('importBtn');}
  else if(key==='importFurniture'){closeToolDockBeforeMenu();dockClick('importFurnitureBtn');}
  else if(key==='clearGuides')dockClick('clearGuidesBtn');
  else if(key==='clearProject')dockClick('clearBtn');
  else if(key==='more'){closeToolDockBeforeMenu();toggleMorePanel();}
  syncToolDockButtons();
}
function setToolDockOpen(open){
  const dock=$('toolDock'); if(!dock)return;
  dock.classList.toggle('open',!!open);
  const t=$('toolDockToggle'); if(t){t.textContent=open?'⌃':'⌄';t.setAttribute('aria-label',open?'Fechar ferramentas':'Abrir ferramentas');}
}
function clampToolDockPosition(left,top){
  const dock=$('toolDock'); if(!dock)return {left,top};
  const rect=dock.getBoundingClientRect();
  const maxL=Math.max(6,innerWidth-rect.width-6);
  const maxT=Math.max(6,innerHeight-Math.min(rect.height,520)-6);
  return {left:Math.max(6,Math.min(maxL,left)),top:Math.max(6,Math.min(maxT,top))};
}
function restoreToolDockPosition(){
  const dock=$('toolDock'); if(!dock)return;
  try{
    const pos=JSON.parse(localStorage.getItem(TOOL_DOCK_POS_KEY)||'null');
    if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){
      const c=clampToolDockPosition(pos.left,pos.top);
      dock.style.left=c.left+'px'; dock.style.top=c.top+'px';
    }
  }catch{}
}
function saveToolDockPosition(){
  const dock=$('toolDock'); if(!dock)return;
  const r=dock.getBoundingClientRect();
  try{localStorage.setItem(TOOL_DOCK_POS_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}
}
function initToolDockDrag(){
  const dock=$('toolDock'),head=$('toolDockHeader'); if(!dock||!head)return;
  let drag=null,moved=false;
  head.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    const r=dock.getBoundingClientRect();
    drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    moved=false; head.setPointerCapture?.(e.pointerId);
  });
  head.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    moved=true;
    const c=clampToolDockPosition(e.clientX-drag.dx,e.clientY-drag.dy);
    dock.style.left=c.left+'px';dock.style.top=c.top+'px';
    e.preventDefault();
  });
  const end=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    head.releasePointerCapture?.(e.pointerId);
    drag=null; if(moved)saveToolDockPosition();
  };
  head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
}

// 1.100.84 · painel Espaço/Divisão flutuante com posição persistente.
// 1.100.84 · Exportar/Importar móvel: STL 3D. Aspire e usinagem continuam em DXF.
// O usuário arrasta pelo cabeçalho (nome + medidas) e a posição é lembrada
// no aparelho mesmo depois de fechar/reabrir o app.
const SPACE_ACTIONS_POS_KEY='designLabSpaceActionsPosV1';
function clampSpaceActionsPosition(left,top){
  const panel=$('spaceActions'); if(!panel)return {left,top};
  const rect=panel.getBoundingClientRect();
  const margin=6;
  const maxL=Math.max(margin,innerWidth-rect.width-margin);
  const visibleH=Math.min(rect.height,Math.max(60,innerHeight-margin*2));
  const maxT=Math.max(margin,innerHeight-visibleH-margin);
  return {
    left:Math.max(margin,Math.min(maxL,Number(left)||margin)),
    top:Math.max(margin,Math.min(maxT,Number(top)||margin))
  };
}
function restoreSpaceActionsPosition(){
  const panel=$('spaceActions'); if(!panel)return;
  try{
    const pos=JSON.parse(localStorage.getItem(SPACE_ACTIONS_POS_KEY)||'null');
    if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){
      const c=clampSpaceActionsPosition(pos.left,pos.top);
      panel.style.left=c.left+'px';
      panel.style.top=c.top+'px';
      panel.style.right='auto';
      panel.style.bottom='auto';
    }
  }catch{}
}
function saveSpaceActionsPosition(){
  const panel=$('spaceActions'); if(!panel)return;
  const r=panel.getBoundingClientRect();
  try{localStorage.setItem(SPACE_ACTIONS_POS_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}
}
function initSpaceActionsDrag(){
  const panel=$('spaceActions'),handle=$('spaceActionsDragHandle');
  if(!panel||!handle)return;
  restoreSpaceActionsPosition();
  let drag=null,moved=false;

  handle.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const r=panel.getBoundingClientRect();
    drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    moved=false;
    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    moved=true;
    const c=clampSpaceActionsPosition(e.clientX-drag.dx,e.clientY-drag.dy);
    panel.style.left=c.left+'px';
    panel.style.top=c.top+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
    e.preventDefault();
  });
  const finish=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    handle.releasePointerCapture?.(e.pointerId);
    drag=null;
    if(moved)saveSpaceActionsPosition();
  };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);

  window.addEventListener('resize',()=>{
    const r=panel.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const c=clampSpaceActionsPosition(r.left,r.top);
    panel.style.left=c.left+'px';
    panel.style.top=c.top+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
    saveSpaceActionsPosition();
  });
}

