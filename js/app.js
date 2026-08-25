
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
const DESIGNLAB_APP_VERSION='1.100.95';
const DESIGNLAB_VERSION_URL='./version.json';
const DESIGNLAB_UPDATE_MIN_INTERVAL=5*60*1000;

let designLabLastUpdateCheck=0;
let designLabAvailableUpdate=null;
let designLabUpdating=false;
let designLabSwRegistration=null;

// ============================================================================
// 1.100.95 · PWA / APP SEM BARRA DE ENDEREÇO
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

// ============================================================================
// 1.100.95 · PREFERÊNCIAS DA CONTA — CELULAR / PC
// ============================================================================
// Projetos continuam no fluxo próprio (IndexedDB + R2). Este bloco sincroniza
// somente preferências/configurações do DesignLabMoveis no D1, por usuário.
// Configurações antigas do aparelho são aproveitadas no primeiro sincronismo.
const CLOUD_PREFERENCES_EXACT_KEYS=new Set([
  'miniCadToolDockPrefsV62','miniCadToolDockPrefsV61','miniCadToolDockPosV61',
  'designLabSpaceActionsPosV1','designLabPieceInspectorPosV1',
  'miniCadProCadBackgroundV2','miniCadProCadGridVisibleV1','miniCadProXray3DV2',
  'designlabCutPlanV42','designlabCutPlanV42-mode',
  'miniCadProV50_sheetPrefs','miniCadProV49_sheetPrefs','miniCadProV48_sheetPrefs','miniCadProV46_sheetPrefs',
  'designLabDoorCreateConfigV1','miniCadProV88_drawerSlideLibrary',
  'designlabLabelsV110075','miniCadProV78_shapePresets',
  'miniCadProV54_hardwarePresets','designLabHardwareScopeV1','miniCadProV50_machiningPresets',
  'miniCadSpaceCreatePrefsV38'
]);
const CLOUD_PREFERENCES_DYNAMIC_PREFIXES=[
  'designlab-cut-space-prefs-v134:',
  'designlab-piece-thickness-v135:'
];
let cloudPreferencesApplying=false;
let cloudPreferencesSaveTimer=null;
let cloudPreferencesSyncing=false;
let cloudPreferencesRevision=0;
let cloudPreferencesUpdatedAt=null;
let cloudPreferencesHookInstalled=false;

function cloudPreferencesOwnerId(){
  return String(currentIdentityUser?.id||cloudAccountState?.user?.id||'').trim();
}
function isCloudPreferenceKey(key){
  key=String(key||'');
  if(CLOUD_PREFERENCES_EXACT_KEYS.has(key))return true;
  const owner=cloudPreferencesOwnerId();
  if(!owner)return false;
  return CLOUD_PREFERENCES_DYNAMIC_PREFIXES.some(prefix=>{
    if(!key.startsWith(prefix))return false;
    const suffix=key.slice(prefix.length);
    return suffix===owner || suffix.startsWith(owner+':');
  });
}
function captureCloudPreferences(){
  const settings={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!isCloudPreferenceKey(key))continue;
    const value=localStorage.getItem(key);
    if(value!==null)settings[key]=value;
  }
  return settings;
}
function cloudPreferenceStorageChanged(key){
  if(cloudPreferencesApplying||!isCloudPreferenceKey(key))return;
  if(authLocalMode||!currentIdentityUser||!cloudAccountState.ok)return;
  clearTimeout(cloudPreferencesSaveTimer);
  cloudPreferencesSaveTimer=setTimeout(()=>saveCloudPreferences({silent:true}),350);
}
function installCloudPreferenceStorageHook(){
  if(cloudPreferencesHookInstalled||typeof Storage==='undefined')return;
  cloudPreferencesHookInstalled=true;
  const nativeSet=Storage.prototype.setItem;
  const nativeRemove=Storage.prototype.removeItem;
  Storage.prototype.setItem=function(key,value){
    const out=nativeSet.call(this,key,value);
    try{if(this===localStorage)cloudPreferenceStorageChanged(key);}catch{}
    return out;
  };
  Storage.prototype.removeItem=function(key){
    const out=nativeRemove.call(this,key);
    try{if(this===localStorage)cloudPreferenceStorageChanged(key);}catch{}
    return out;
  };
}
function cloudPreferencesReloadStamp(revision){
  return `designlab-cloud-prefs-applied:${cloudPreferencesOwnerId()}:${Number(revision)||0}`;
}
function applyCloudPreferences(settings,revision){
  if(!settings||typeof settings!=='object'||Array.isArray(settings))return false;
  let changed=false;
  cloudPreferencesApplying=true;
  try{
    // A nuvem é a fonte da verdade para a conta. Remove do aparelho qualquer
    // preferência sincronizável que não exista mais no perfil remoto.
    const localKeys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(isCloudPreferenceKey(key))localKeys.push(key);
    }
    for(const key of localKeys){
      if(Object.prototype.hasOwnProperty.call(settings,key))continue;
      localStorage.removeItem(key);changed=true;
    }
    for(const [key,raw] of Object.entries(settings)){
      if(!isCloudPreferenceKey(key))continue;
      const value=String(raw??'');
      if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);changed=true;}
    }
  }finally{cloudPreferencesApplying=false;}
  cloudPreferencesRevision=Number(revision)||cloudPreferencesRevision||0;
  return changed;
}
async function saveCloudPreferences({silent=true}={}){
  if(authLocalMode||!currentIdentityUser||!cloudAccountState.ok||cloudPreferencesApplying)return null;
  clearTimeout(cloudPreferencesSaveTimer);cloudPreferencesSaveTimer=null;
  try{
    const data=await cloudApiFetch('/preferences',{method:'PUT',body:{settings:captureCloudPreferences()},timeoutMs:20000});
    cloudPreferencesRevision=Number(data?.revision)||cloudPreferencesRevision||0;
    cloudPreferencesUpdatedAt=data?.updated_at||new Date().toISOString();
    if(!silent)toast('Configurações salvas na conta');
    return data;
  }catch(err){
    console.warn('Cloud preferences save:',err);
    if(!silent)toast('Não foi possível salvar as configurações na conta');
    return null;
  }
}
async function syncCloudPreferences({silent=true,allowReload=true}={}){
  if(cloudPreferencesSyncing||authLocalMode||!currentIdentityUser||!cloudAccountState.ok)return null;
  cloudPreferencesSyncing=true;
  try{
    const data=await cloudApiFetch('/preferences',{timeoutMs:20000});
    if(!data?.exists){
      // Migração transparente: a primeira conta que ainda não possui preferências
      // recebe as configurações já existentes neste aparelho.
      const saved=await saveCloudPreferences({silent:true});
      if(!silent&&saved)toast('Configurações deste aparelho salvas na sua conta');
      return {ok:!!saved,seeded:!!saved,reloading:false};
    }
    const changed=applyCloudPreferences(data.settings||{},data.revision);
    cloudPreferencesUpdatedAt=data.updated_at||null;
    if(changed&&allowReload){
      const stamp=cloudPreferencesReloadStamp(data.revision);
      if(sessionStorage.getItem('designlabCloudPrefsReloadStamp')!==stamp){
        sessionStorage.setItem('designlabCloudPrefsReloadStamp',stamp);
        setTimeout(()=>location.reload(),0);
        return {ok:true,changed:true,reloading:true};
      }
    }
    if(!silent)toast(changed?'Configurações da conta carregadas':'Configurações da conta sincronizadas');
    return {ok:true,changed,reloading:false};
  }catch(err){
    // Não bloqueia login/projetos se o Worker ainda não foi atualizado ou se
    // a conexão caiu. O próximo login/retorno online tenta novamente.
    console.warn('Cloud preferences sync:',err);
    return {ok:false,error:err,reloading:false};
  }finally{cloudPreferencesSyncing=false;}
}
installCloudPreferenceStorageHook();

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

    const prefSync=await syncCloudPreferences({silent:true,allowReload:true});
    if(prefSync?.reloading)return data;
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
window.designLabCloud={apiBase:CLOUD_API_BASE,getState(){return JSON.parse(JSON.stringify(cloudAccountState));},sync(){return syncCloudAccount({silent:false});},syncPreferences(){return syncCloudPreferences({silent:false,allowReload:true});},savePreferences(){return saveCloudPreferences({silent:false});},apiFetch:cloudApiFetch};



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
// 1.100.95 · HOME OPÇÃO 1
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
  document.title=currentProjectId?`${name} · DesignLabMoveis 1.100.95`:'DesignLabMoveis 1.100.95';
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
    thumbnail:null,appVersion:'1.100.95'
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
    createdAt:rec.createdAt||now,updatedAt:now,appVersion:'1.100.95'
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
    thumbnail:thumb,appVersion:'1.100.95'
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
    format:'mini-cad-pro-project',formatVersion:1,appVersion:'1.100.95',exportedAt:projectNow(),
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
    thumbnail:p.thumbnail||null,appVersion:'1.100.95'
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
    await projectDbPut({id:newProjectId(),name:'Projeto anterior',client:'',environment:'',createdAt:now,updatedAt:now,state,camera:null,thumbnail:null,appVersion:'1.100.95'});
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

// 1.100.95 · painel Espaço/Divisão flutuante com posição persistente.
// 1.100.95 · Exportar/Importar móvel: STL 3D. Aspire e usinagem continuam em DXF.
// O usuário arrasta pelo cabeçalho (nome + medidas) e a posição é lembrada
// na conta e restaurada depois de fechar/reabrir o app ou trocar de aparelho.
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

// ============================================================================
// 1.100.95 · JANELA DE CONFIGURAÇÃO DA PEÇA FLUTUANTE
// ============================================================================
const PIECE_INSPECTOR_POS_KEY='designLabPieceInspectorPosV1';
function clampPieceInspectorPosition(left,top){
  const panel=$('inspector');if(!panel)return {left,top};
  const r=panel.getBoundingClientRect(),margin=6;
  const w=Math.max(80,r.width||Math.min(370,innerWidth-16));
  const h=Math.max(80,Math.min(r.height||420,innerHeight-margin*2));
  return {
    left:Math.max(margin,Math.min(Math.max(margin,innerWidth-w-margin),Number(left)||margin)),
    top:Math.max(margin,Math.min(Math.max(margin,innerHeight-h-margin),Number(top)||margin))
  };
}
function restorePieceInspectorPosition(clampNow=false){
  const panel=$('inspector');if(!panel)return;
  try{
    const pos=JSON.parse(localStorage.getItem(PIECE_INSPECTOR_POS_KEY)||'null');
    if(!pos||!Number.isFinite(pos.left)||!Number.isFinite(pos.top))return;
    const c=clampNow?clampPieceInspectorPosition(pos.left,pos.top):pos;
    panel.style.left=c.left+'px';panel.style.top=c.top+'px';
    panel.style.right='auto';panel.style.bottom='auto';panel.style.width='min(370px,calc(100vw - 16px))';
  }catch{}
}
function savePieceInspectorPosition(){
  const panel=$('inspector');if(!panel||!elementIsVisible(panel))return;
  const r=panel.getBoundingClientRect();
  try{localStorage.setItem(PIECE_INSPECTOR_POS_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}
}
function initPieceInspectorFloating(){
  const panel=$('inspector'),handle=$('inspectorHeader');if(!panel||!handle)return;
  let drag=null,moved=false;
  handle.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,input,select,textarea'))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const r=panel.getBoundingClientRect();
    drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,sx:e.clientX,sy:e.clientY};moved=false;
    handle.setPointerCapture?.(e.pointerId);e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>2)moved=true;
    const c=clampPieceInspectorPosition(e.clientX-drag.dx,e.clientY-drag.dy);
    panel.style.left=c.left+'px';panel.style.top=c.top+'px';
    panel.style.right='auto';panel.style.bottom='auto';panel.style.width='min(370px,calc(100vw - 16px))';
    e.preventDefault();
  });
  const finish=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    handle.releasePointerCapture?.(e.pointerId);drag=null;
    if(moved)savePieceInspectorPosition();
  };
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  window.addEventListener('resize',()=>{
    if(!elementIsVisible(panel))return;
    const r=panel.getBoundingClientRect(),c=clampPieceInspectorPosition(r.left,r.top);
    panel.style.left=c.left+'px';panel.style.top=c.top+'px';panel.style.right='auto';panel.style.bottom='auto';
    savePieceInspectorPosition();
  });
}

function renderToolDockEditor(){
  const list=$('toolDockEditList'); if(!list)return;
  if(!Array.isArray(toolDockDraft))toolDockDraft=[...toolDockPrefs];
  list.innerHTML='';
  const groups=[...new Set(TOOL_DOCK_CATALOG.map(t=>t.group||'Outros'))];
  for(const group of groups){
    const title=document.createElement('div');title.className='toolEditGroup';title.textContent=group;list.appendChild(title);
    const defs=TOOL_DOCK_CATALOG.filter(t=>(t.group||'Outros')===group);
    for(const def of defs){
      const row=document.createElement('div');row.className='toolEditRow';
      const check=document.createElement('input');check.type='checkbox';check.checked=toolDockDraft.includes(def.key);
      check.addEventListener('change',()=>{
        if(check.checked){ if(!toolDockDraft.includes(def.key))toolDockDraft.push(def.key); }
        else toolDockDraft=toolDockDraft.filter(k=>k!==def.key);
        renderToolDockEditor();
      });
      const meta=document.createElement('div');meta.className='meta';meta.innerHTML=`<b>${def.label}</b><span>${def.desc}</span>`;
      const order=document.createElement('div');order.className='order';
      const idx=toolDockDraft.indexOf(def.key);
      for(const [txt,delta] of [['↑',-1],['↓',1]]){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=txt;b.disabled=idx<0||(delta<0&&idx===0)||(delta>0&&idx===toolDockDraft.length-1);
        b.addEventListener('click',()=>{
          const i=toolDockDraft.indexOf(def.key),j=i+delta;if(i<0||j<0||j>=toolDockDraft.length)return;
          [toolDockDraft[i],toolDockDraft[j]]=[toolDockDraft[j],toolDockDraft[i]];renderToolDockEditor();
        });
        order.appendChild(b);
      }
      row.append(check,meta,order);list.appendChild(row);
    }
  }
}function openToolDockEditor(){
  setToolDockOpen(false);
  toolDockDraft=[...toolDockPrefs];renderToolDockEditor();$('toolDockEditDialog').style.display='flex';
}
function initToolDock(){
  renderToolDock(); restoreToolDockPosition(); initToolDockDrag();
  $('toolDockToggle')?.addEventListener('click',()=>setToolDockOpen(!$('toolDock').classList.contains('open')));
  $('toolDockCollapse')?.addEventListener('click',()=>setToolDockOpen(false));
  $('toolDockEditBtn')?.addEventListener('click',openToolDockEditor);
  $('toolDockEditCancel')?.addEventListener('click',()=>{$('toolDockEditDialog').style.display='none';});
  $('toolDockEditDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('toolDockEditDialog'))$('toolDockEditDialog').style.display='none';});
  // v64: tocar fora do painel recolhe sem bloquear o toque no CAD.
  document.addEventListener('pointerdown',e=>{
    const dock=$('toolDock');
    if(!dock?.classList.contains('open'))return;
    if(dock.contains(e.target))return;
    setToolDockOpen(false);
  },true);
  $('toolDockReset')?.addEventListener('click',()=>{toolDockDraft=[...TOOL_DOCK_DEFAULT];renderToolDockEditor();});
  $('toolDockEditSave')?.addEventListener('click',()=>{
    if(!toolDockDraft.length){toast('Escolha ao menos uma ferramenta');return;}
    toolDockPrefs=[...toolDockDraft];saveToolDockPrefs();renderToolDock();$('toolDockEditDialog').style.display='none';toast('Ferramentas favoritas atualizadas');
  });
  window.addEventListener('resize',()=>{
    const r=$('toolDock')?.getBoundingClientRect();if(!r)return;
    const c=clampToolDockPosition(r.left,r.top);$('toolDock').style.left=c.left+'px';$('toolDock').style.top=c.top+'px';
  });
  setToolDockOpen(false);
}

const container = $('canvas-container');


// ============================================================================
// 1.100.10 · FUNDO DO CAD
// ============================================================================
const CAD_BACKGROUND_KEY='miniCadProCadBackgroundV2';
const CAD_GRID_KEY='miniCadProCadGridVisibleV1';
const XRAY_3D_KEY='miniCadProXray3DV2';

// Padrão tipo CAD:
// - fundo branco;
// - grade desligada;
// - Raio-X 3D desligado.
let cadBackgroundMode='white';
let cadGridVisible=false;
let xray3DEnabled=false;

try{
  const saved=localStorage.getItem(CAD_BACKGROUND_KEY);
  if(saved==='white'||saved==='dark')cadBackgroundMode=saved;

  const savedGrid=localStorage.getItem(CAD_GRID_KEY);
  if(savedGrid!==null)cadGridVisible=savedGrid==='true';

  const savedXray=localStorage.getItem(XRAY_3D_KEY);
  if(savedXray!==null)xray3DEnabled=savedXray==='1';
}catch{}

function cadBackgroundHex(mode=cadBackgroundMode){
  return mode==='white'?0xf4f4f4:0x171717;
}
function cadFloorHex(mode=cadBackgroundMode){
  return mode==='white'?0xeeeeee:0x202020;
}
function syncCadBackgroundButtons(){
  document.querySelectorAll('[data-cad-bg]').forEach(b=>{
    b.classList.toggle('active',b.dataset.cadBg===cadBackgroundMode);
  });
  if($('cadGridVisibleSetting'))$('cadGridVisibleSetting').checked=!!cadGridVisible;
}
function applyCadGridVisibility(visible,{persist=true,notify=false}={}){
  cadGridVisible=!!visible;

  // No modo apresentação/visual limpo a grade permanece escondida,
  // independentemente da preferência.
  if(typeof grid!=='undefined'&&grid){
    grid.visible=cadGridVisible&&!visualMode;
  }

  if(persist){
    try{localStorage.setItem(CAD_GRID_KEY,String(cadGridVisible));}catch{}
  }

  syncCadBackgroundButtons();

  if(notify)toast(cadGridVisible?'Grade do chão ativada':'Grade do chão desativada');
}
function applyCadBackground(mode,{persist=true,notify=false}={}){
  cadBackgroundMode=mode==='white'?'white':'dark';

  if(typeof scene!=='undefined'&&scene?.background){
    scene.background.setHex(cadBackgroundHex());
  }
  if(typeof visualFloorMat!=='undefined'&&visualFloorMat?.color){
    visualFloorMat.color.setHex(cadFloorHex());
    visualFloorMat.needsUpdate=true;
  }

  document.body.dataset.cadBackground=cadBackgroundMode;
  syncCadBackgroundButtons();

  if(persist){
    try{localStorage.setItem(CAD_BACKGROUND_KEY,cadBackgroundMode);}catch{}
  }
  if(notify)toast(cadBackgroundMode==='white'?'Fundo do CAD: branco':'Fundo do CAD: escuro');
}
function openAppSettings(){
  $('projectMenuPanel')?.classList.remove('show');
  syncCadBackgroundButtons();
  updateXray3DButton();
  $('appSettingsDialog').classList.add('show');
}
function closeAppSettings(){
  $('appSettingsDialog').classList.remove('show');
}


const scene = new THREE.Scene();
scene.background = new THREE.Color(cadBackgroundHex());

const perspectiveCamera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.001, 1000);
perspectiveCamera.position.set(3.4, 2.8, 4.8);
const orthoCamera = new THREE.OrthographicCamera(-1,1,1,-1,0.001,1000);
let camera = perspectiveCamera;
let viewMode2D = false;
let current2DView = null;
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.style.touchAction='none';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.12));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.28);
dirLight.position.set(4, 8, 5);
dirLight.castShadow=true;
dirLight.shadow.mapSize.set(1024,1024);
dirLight.shadow.camera.left=-8; dirLight.shadow.camera.right=8;
dirLight.shadow.camera.top=8; dirLight.shadow.camera.bottom=-8;
dirLight.shadow.camera.near=.1; dirLight.shadow.camera.far=30;
scene.add(dirLight);
const fillLight=new THREE.DirectionalLight(0xcfe2ff,.34);
fillLight.position.set(-4,3,-5); scene.add(fillLight);

// v65: luz de preenchimento inferior. Em CAD o usuário gira a câmera por baixo
// do móvel com frequência; sem uma fonte vinda de baixo, as faces inferiores
// recebiam apenas a componente escura do HemisphereLight e pareciam pretas.
// Esta luz é propositalmente suave: recupera a cor do MDF sem achatar o volume.
const bottomFillLight=new THREE.DirectionalLight(0xfff4df,.58);
bottomFillLight.position.set(2.5,-5.5,3.5);
bottomFillLight.castShadow=false;
scene.add(bottomFillLight);

// Um ambiente mínimo evita preto absoluto em qualquer orientação extrema da câmera.
const cadAmbientLight=new THREE.AmbientLight(0xffffff,.16);
scene.add(cadAmbientLight);

const visualFloorMat=new THREE.MeshStandardMaterial({color:cadFloorHex(),roughness:.95,metalness:0});
const visualFloor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),visualFloorMat);
visualFloor.rotation.x=-Math.PI/2; visualFloor.position.y=-.004; visualFloor.receiveShadow=true; visualFloor.visible=false; scene.add(visualFloor);

const grid = new THREE.GridHelper(20, 200, 0x555555, 0x262626); // linhas a cada 100 mm
scene.add(grid);
applyCadBackground(cadBackgroundMode,{persist:false});
applyCadGridVisibility(cadGridVisible,{persist:false});

// Eixos globais estilo CAD.
// X = vermelho, Y(vertical interno) = azul, Z = amarelo.
// 1.100.18: respeitam o depth buffer. Se uma chapa estiver na frente do eixo,
// o trecho encoberto NÃO atravessa mais o móvel.
function makeWorldAxis(points,color){
  const mat=new THREE.LineBasicMaterial({
    color,
    depthTest:true,
    depthWrite:false,
    transparent:true,
    opacity:.96
  });
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat);
  line.renderOrder=4; scene.add(line); return line;
}
const worldAxisX=makeWorldAxis([new THREE.Vector3(-20,.003,0),new THREE.Vector3(20,.003,0)],0xff3b30);
const worldAxisY=makeWorldAxis([new THREE.Vector3(0,-20,0),new THREE.Vector3(0,20,0)],0x2979ff);
const worldAxisZ=makeWorldAxis([new THREE.Vector3(0,.003,-20),new THREE.Vector3(0,.003,20)],0xffd23f);
worldAxisX.userData.tapeAxis='x';
worldAxisY.userData.tapeAxis='y';
worldAxisZ.userData.tapeAxis='z';
const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);

let visualMode=false;
function updateXray3DButton(){
  const b=$('xray3DBtn');
  if(b){
    b.textContent=xray3DEnabled?'◈ Raio-X 3D: ligado':'◇ Raio-X 3D: desligado';
    b.classList.toggle('active',xray3DEnabled);
    b.classList.toggle('secondary',!xray3DEnabled);
  }
  const setting=$('cadXrayVisibleSetting');
  if(setting)setting.checked=!!xray3DEnabled;
}
function xray3DActive(){ return xray3DEnabled && !visualMode && !viewMode2D && camera===perspectiveCamera; }
function setPieceVisualEdgesVisible(show=true){
  // v58: contorno técnico preto permanece visível em todas as peças físicas.
  // `show=false` ainda é respeitado apenas quando uma rotina precisar esconder explicitamente.
  for(const o of objects){
    const e=o.userData?.visualEdges;
    if(!e)continue;
    e.visible=show!==false && o.visible!==false;
    if(e.material){
      const xray=xray3DActive();
      e.material.color.setHex(0x080808);
      e.material.transparent=true;
      e.material.opacity=xray?.86:.96;
      // v60: no 3D técnico, o contorno ignora o depth buffer. Assim uma
      // prateleira continua legível mesmo atrás de porta/lateral fechada.
      e.material.depthTest=!xray;
      e.material.depthWrite=false;
      e.material.needsUpdate=true;
    }
    e.renderOrder=xray3DActive()?88:12;
  }
}
function applyVisualSceneState(){
  grid.visible=cadGridVisible&&!visualMode;
  worldAxisX.visible=!visualMode; worldAxisY.visible=!visualMode; worldAxisZ.visible=!visualMode;
  visualFloor.visible=visualMode;
  if(typeof machiningVisualGroup!=='undefined') machiningVisualGroup.visible=!visualMode;
  if(typeof spacePickMeshes!=='undefined'){
    for(const mesh of spacePickMeshes){
      mesh.visible=!visualMode;
      if(mesh.userData?.spaceEdges) mesh.userData.spaceEdges.visible=!visualMode;
    }
  }
  if(typeof spaceRoots!=='undefined'){ for(const root of spaceRoots){ if(root.group)root.group.visible=!visualMode; } }
  if(typeof constructionGuides!=='undefined'){ for(const g of constructionGuides)g.visible=!visualMode; }
  if(typeof guideX!=='undefined'){ guideX.visible=false; guideY.visible=false; guideZ.visible=false; }
  if(typeof inferenceLines!=='undefined'){ Object.values(inferenceLines).forEach(l=>l.visible=false); }
  setPieceVisualEdgesVisible(true);
  document.body.classList.toggle('visual-mode',visualMode);
  const b=$('visualModeBtn'); if(b){ b.textContent=visualMode?'🛠 Projeto':'👁 Visual'; b.classList.toggle('active',visualMode); b.classList.toggle('secondary',!visualMode); }
  const mb=$('visualModeMoreBtn'); if(mb)mb.textContent=visualMode?'🛠 Voltar ao Projeto':'👁 Visual limpo';
  updateXray3DButton();
  if(typeof syncToolDockButtons==='function')syncToolDockButtons();
}
function visualFurnitureObjects(){
  let root=null;
  try{ root=selected?rootForObject(selected):null; }catch{}
  if(!root && typeof activeSpaceRootId!=='undefined' && activeSpaceRootId)root=getSpaceRoot(activeSpaceRootId);
  let arr=[];
  if(root){
    arr=objects.filter(o=>o.visible!==false && (o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root)));
  }
  if(!arr.length)arr=objects.filter(o=>o.visible!==false);
  return arr;
}
function frameFurnitureVisual(){
  const arr=visualFurnitureObjects(); if(!arr.length){toast('Crie ou selecione um móvel');return false;}
  const box=new THREE.Box3(); arr.forEach(o=>box.expandByObject(o));
  if(box.isEmpty())return false;
  const center=box.getCenter(new THREE.Vector3());
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  const aspect=Math.max(.25,innerWidth/Math.max(1,innerHeight));
  const vfov=THREE.MathUtils.degToRad(perspectiveCamera.fov);
  const hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
  const minFov=Math.max(.20,Math.min(vfov,hfov));
  const dist=Math.max(.8,(sphere.radius/Math.sin(minFov/2))*1.03);
  let dir=perspectiveCamera.position.clone().sub(controls.target);
  if(dir.lengthSq()<1e-6)dir.set(1.25,.85,1.5);
  dir.normalize();
  if(Math.abs(dir.y)>.88)dir.set(1.2,.8,1.45).normalize();
  perspectiveCamera.position.copy(center).addScaledVector(dir,dist);
  perspectiveCamera.up.set(0,1,0);
  controls.target.copy(center); perspectiveCamera.lookAt(center);
  perspectiveCamera.near=.001; perspectiveCamera.far=Math.max(1000,dist*20); perspectiveCamera.updateProjectionMatrix();
  controls.update(); remember3DView();
  return true;
}
function setVisualMode(on,{notify=true,frame=true}={}){
  on=!!on;
  if(on===visualMode){ if(on&&frame)frameFurnitureVisual(); return; }
  if(on){
    if(viewMode2D||camera===orthoCamera)returnTo3D({restore:true,notify:false});
    if(selected)restoreBaseColor(selected);
    visualMode=true; applyVisualSceneState();
    if(frame)frameFurnitureVisual();
    $('morePanel').style.display='none'; $('inspector').style.display='none';
    $('hintText').textContent=desktopCadNavigation
      ? 'Visual limpo · rodinha pressionada: orbitar · Shift + rodinha: mover vista · roda: zoom'
      : 'Visual limpo · arraste para girar · pinça para zoom · toque em Projeto para editar';
    if(notify)toast('Modo Visual');
  }else{
    visualMode=false; applyVisualSceneState();
    if(selected)setAllFaces(selected,COLORS.selected);
    $('hintText').textContent=toolMode==='select'?'Selecionar · toque exatamente onde o dedo encostar':'Modo Projeto';
    if(notify)toast('Modo Projeto');
  }
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .09;
controls.target.set(0,.45,0);
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// 1.100.95 · ZOOM DE APROXIMAÇÃO FINO
// O zoom agora acompanha o ponto sob o cursor, aceita aproximação de poucos
// milímetros e reduz progressivamente a velocidade ao chegar perto da peça.
// Isso evita o efeito de "pular" para dentro da chapa quando o usuário quer
// apenas conferir uma quina, furo, fita ou encontro entre peças.
const CAD_ZOOM_DEFAULT_SPEED=.72;
const CAD_ZOOM_CLOSE_SPEED=.14;
const CAD_ZOOM_SLOW_ZONE=.12;      // começa a desacelerar a 120 mm da superfície
const CAD_ZOOM_SURFACE_GAP=.004;    // para a aproximadamente 4 mm da superfície
controls.zoomSpeed=CAD_ZOOM_DEFAULT_SPEED;
controls.zoomToCursor=true;
controls.minDistance=.004;
controls.maxDistance=250;

const cadZoomRaycaster=new THREE.Raycaster();
const cadZoomNdc=new THREE.Vector2();
function cadZoomPhysicalObjects(){
  if(typeof objects==='undefined')return [];
  return objects.filter(o=>{
    if(!o||o.visible===false||!o.isObject3D)return false;
    const u=o.userData||{};
    if(u.kind==='hardware-visual'||u.kind==='cylinder')return false;
    if(u.isVisualEdge||u.isMachiningVisual||u.isSpacePick||u.kind==='space-cell'||u.kind==='space-root-outline')return false;
    return o.isMesh===true;
  });
}
function cadZoomSurfaceDistance(clientX,clientY){
  if(camera!==perspectiveCamera||viewMode2D)return Infinity;
  const rect=renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return Infinity;
  cadZoomNdc.set(
    ((clientX-rect.left)/rect.width)*2-1,
    -((clientY-rect.top)/rect.height)*2+1
  );
  cadZoomRaycaster.setFromCamera(cadZoomNdc,perspectiveCamera);
  const hits=cadZoomRaycaster.intersectObjects(cadZoomPhysicalObjects(),false);
  return hits.length?hits[0].distance:Infinity;
}
function cadZoomAdaptiveSpeed(distance){
  if(!Number.isFinite(distance))return CAD_ZOOM_DEFAULT_SPEED;
  const t=THREE.MathUtils.clamp(
    (distance-CAD_ZOOM_SURFACE_GAP)/(CAD_ZOOM_SLOW_ZONE-CAD_ZOOM_SURFACE_GAP),
    0,1
  );
  return THREE.MathUtils.lerp(CAD_ZOOM_CLOSE_SPEED,CAD_ZOOM_DEFAULT_SPEED,t);
}
// Capture roda antes do OrbitControls: aproximando, a velocidade cai conforme
// a distância real até a chapa. Ao atingir a folga mínima, só bloqueamos o
// movimento para dentro; afastar continua funcionando imediatamente.
renderer.domElement.addEventListener('wheel',e=>{
  if(camera!==perspectiveCamera||viewMode2D)return;
  if(e.deltaY<0){
    const d=cadZoomSurfaceDistance(e.clientX,e.clientY);
    controls.zoomSpeed=cadZoomAdaptiveSpeed(d);
    if(Number.isFinite(d)&&d<=CAD_ZOOM_SURFACE_GAP*1.08){
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
  }else{
    controls.zoomSpeed=CAD_ZOOM_DEFAULT_SPEED;
  }
},{passive:false,capture:true});


// ============================================================================
// 1.100.14 · NAVEGAÇÃO DE MOUSE NO ESTILO CAD (SOMENTE PC)
// ----------------------------------------------------------------------------
// Mouse com ponteiro preciso:
// - botão esquerdo: reservado para selecionar/mover/desenhar no CAD;
// - botão do meio (rodinha pressionada) + arrastar: ORBITAR;
// - Shift + botão do meio + arrastar: PAN / deslocar a câmera;
// - girar a rodinha: ZOOM normal do OrbitControls.
//
// Em celulares/tablets com ponteiro coarse o mapeamento NÃO é alterado.
// Os gestos touch continuam exatamente como já estavam.
// ============================================================================
const desktopCadNavigation=!!window.matchMedia?.('(pointer:fine)').matches;

function applyDesktopCadNavigation(){
  if(!desktopCadNavigation)return;

  // OrbitControls r160 interpreta Shift/Ctrl/Meta + ação ROTATE como PAN.
  // Portanto mapear MIDDLE para ROTATE entrega:
  // MIDDLE = órbita
  // SHIFT + MIDDLE = pan
  controls.mouseButtons.LEFT=null;
  controls.mouseButtons.MIDDLE=THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT=null;

  // A roda sem pressionar continua chegando ao evento wheel do OrbitControls
  // e mantém o zoom normal.
  controls.enableRotate=true;
  controls.enablePan=true;
  controls.enableZoom=true;

  // CAD responde diretamente ao mouse, sem "rastro" ou inércia.
  // O damping do OrbitControls era o delay percebido no PC.
  controls.enableDamping=false;
  controls.dampingFactor=0;
}

applyDesktopCadNavigation();
controls.update();

const last3DView = {
  position: perspectiveCamera.position.clone(),
  up: perspectiveCamera.up.clone(),
  target: controls.target.clone()
};
let cameraSwitching = false;

function remember3DView(){
  if(camera===perspectiveCamera && !viewMode2D){
    last3DView.position.copy(perspectiveCamera.position);
    last3DView.up.copy(perspectiveCamera.up);
    last3DView.target.copy(controls.target);
  }
}
function useCamera(next){
  camera=next;
  controls.object=camera;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  controls.update();
}
function orthographicFrustum(viewW,viewH){
  const aspect=Math.max(.2,innerWidth/Math.max(1,innerHeight));
  const w=Math.max(.05,viewW), h=Math.max(.05,viewH);
  const halfV=Math.max(h/2,w/(2*aspect))*1.12;
  orthoCamera.left=-halfV*aspect; orthoCamera.right=halfV*aspect;
  orthoCamera.top=halfV; orthoCamera.bottom=-halfV;
  orthoCamera.near=.001; orthoCamera.far=1000;
  orthoCamera.zoom=1; orthoCamera.updateProjectionMatrix();
}
// Vista técnica 2D: a peça externa voltada para a câmera fica levemente
// transparente para revelar prateleiras, divisões e ferragens internas.
// Ao voltar ao 3D, todos os materiais retornam exatamente ao estado anterior.
const technical2DFaded = [];
function restoreTechnical2DTransparency(){
  while(technical2DFaded.length){
    const rec=technical2DFaded.pop();
    const mesh=rec.mesh;
    if(!mesh)continue;
    if(rec.renderOrder!=null) mesh.renderOrder=rec.renderOrder;
    const mats=mesh.userData?.faceMaterials||[];
    mats.forEach((mat,i)=>{
      const st=rec.materials[i]; if(!mat||!st)return;
      mat.transparent=st.transparent;
      mat.opacity=st.opacity;
      mat.depthWrite=st.depthWrite;
      mat.depthTest=st.depthTest;
      mat.needsUpdate=true;
    });
    const ve=mesh.userData?.visualEdges;
    if(ve&&rec.edge){
      ve.visible=rec.edge.visible;
      ve.renderOrder=rec.edge.renderOrder ?? 12;
      if(ve.material){
        if(rec.edge.color!=null) ve.material.color.setHex(rec.edge.color);
        ve.material.transparent=rec.edge.transparent;
        ve.material.opacity=rec.edge.opacity;
        ve.material.depthTest=rec.edge.depthTest;
        ve.material.depthWrite=rec.edge.depthWrite;
        ve.material.needsUpdate=true;
      }
    }
  }
}
function objectBelongsToRootFor2D(o,root){
  if(!o||!root||o.visible===false)return false;
  return o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root);
}
function pieceIsCameraCover(o,root,view){
  if(!objectBelongsToRootFor2D(o,root) || o.userData?.kind==='cylinder')return false;
  const b=getBounds(o);
  const rb={
    minX:root.x-root.width/2,maxX:root.x+root.width/2,
    minY:root.yBase,maxY:root.yBase+root.height,
    minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2
  };
  const ti=pieceThicknessInfo(o);
  const tol=.003; // 3 mm para tolerar pequenas folgas/vãos
  if(view==='right') return ti?.axis==='x' && Math.abs(b.maxX-rb.maxX)<=tol;
  if(view==='left')  return ti?.axis==='x' && Math.abs(b.minX-rb.minX)<=tol;
  if(view==='front') return ti?.axis==='z' && Math.abs(b.maxZ-rb.maxZ)<=tol;
  if(view==='back')  return ti?.axis==='z' && Math.abs(b.minZ-rb.minZ)<=tol;
  if(view==='top')   return ti?.axis==='y' && Math.abs(b.maxY-rb.maxY)<=tol;
  if(view==='bottom')return ti?.axis==='y' && Math.abs(b.minY-rb.minY)<=tol;
  return false;
}
function applyTechnical2DTransparency(root,view){
  restoreTechnical2DTransparency();
  if(!root||!view)return;
  // v59: contornos X-Ray. Em vista técnica 2D, as bordas de TODAS as peças
  // do móvel são desenhadas acima da casca externa translúcida. Isso garante
  // que uma prateleira vista de lado/frente continue visível mesmo atrás de
  // lateral, porta, fundo, tampo ou base.
  for(const o of objects){
    if(!objectBelongsToRootFor2D(o,root))continue;
    const mats=o.userData?.faceMaterials||[];
    const ve=o.userData?.visualEdges;
    const rec={mesh:o,renderOrder:o.renderOrder,materials:mats.map(mat=>({
      transparent:mat.transparent,opacity:mat.opacity,depthWrite:mat.depthWrite,depthTest:mat.depthTest
    })),edge:null};
    if(ve){
      rec.edge={
        visible:ve.visible,
        renderOrder:ve.renderOrder,
        color:ve.material?.color?.getHex?.(),
        transparent:ve.material?.transparent,
        opacity:ve.material?.opacity,
        depthTest:ve.material?.depthTest,
        depthWrite:ve.material?.depthWrite
      };
      ve.visible=true;
      ve.renderOrder=95;
      if(ve.material){
        ve.material.color.setHex(0x050505);
        ve.material.transparent=true;
        ve.material.opacity=1;
        ve.material.depthTest=false; // X-Ray: não deixa a peça da frente esconder a prateleira
        ve.material.depthWrite=false;
        ve.material.needsUpdate=true;
      }
    }
    technical2DFaded.push(rec);
  }

  const candidates=objects.filter(o=>pieceIsCameraCover(o,root,view));
  for(const mesh of candidates){
    const mats=mesh.userData?.faceMaterials||[];
    mats.forEach(mat=>{
      mat.transparent=true;
      mat.opacity=.14;      // casca bem leve: mantém referência sem tapar o interior
      mat.depthWrite=false; // não grava profundidade, evitando ocultar linhas internas
      mat.depthTest=true;
      mat.needsUpdate=true;
    });
    mesh.renderOrder=10;
  }
}
function setViewModeBadge(view=null){
  const b=$('viewModeBadge'); if(!b)return;
  if(!viewMode2D){b.style.display='none';return;}
  const names={front:'Frente',back:'Trás',left:'Lateral esq.',right:'Lateral dir.',top:'Cima',bottom:'Baixo'};
  b.textContent=`2D ${names[view]||''} · 3D`; b.style.display='block';
}
function returnTo3D({restore=true,notify=true}={}){
  if(cameraSwitching)return; cameraSwitching=true;
  const was2D=viewMode2D||camera===orthoCamera;
  restoreTechnical2DTransparency();
  viewMode2D=false; current2DView=null;
  perspectiveCamera.aspect=innerWidth/Math.max(1,innerHeight);
  perspectiveCamera.updateProjectionMatrix();
  if(restore){
    perspectiveCamera.position.copy(last3DView.position);
    perspectiveCamera.up.copy(last3DView.up);
    controls.target.copy(last3DView.target);
    perspectiveCamera.lookAt(controls.target);
  }
  useCamera(perspectiveCamera);
  setViewModeBadge(null);
  setPieceVisualEdgesVisible(true);
  updateXray3DButton();
  cameraSwitching=false;
  if(was2D&&notify)toast('Vista 3D');
}
controls.addEventListener('end',()=>{ if(!viewMode2D&&camera===perspectiveCamera) remember3DView(); });

const COLORS = {
  default: 0x2d7dfa,

  // 1.100.12: os volumes de espaço usam laranja/âmbar.
  // No fundo branco esse tom mantém contraste sem competir com os eixos.
  space: 0x46b96b,

  panel: 0xd8c5a4,
  selected: 0xff9d2e,
  highlight: 0x00e5ff,
  snap: 0xff2ea6
};

const objects = [];
// Marcadores visuais das usinagens ficam separados da geometria sólida da peça.
const machiningVisualGroup = new THREE.Group();
machiningVisualGroup.userData.isMachiningVisualGroup=true;
scene.add(machiningVisualGroup);
// Prévia temporária: mostra o volume que será removido ANTES de salvar a usinagem.
const machiningDraftPreviewGroup = new THREE.Group();
machiningDraftPreviewGroup.userData.isMachiningDraftPreviewGroup=true;
scene.add(machiningDraftPreviewGroup);
let machiningPreviewOwner=null;
let machiningPreviewActive=false;
// Espaços são volumes paramétricos separados das peças comuns.
const spaceRoots = [];
const spacePickMeshes = [];
let selectedSpaceCell = null; // {rootId, cellId}
let activeSpaceRootId = null; // mantém o espaço ativo mesmo durante ações do menu
let selected = null;
let toolMode = 'select'; // select | pull | move-free | tape
let dragMode = null;     // planar | free | pull-x | pull-y | pull-z | radius
let dragChanged = false;
let dragStartState = null;
let activePointerId = null;
let downClientX = 0, downClientY = 0, gestureLocked = false;
let dragOffset = new THREE.Vector3();
let anchorCoord = 0, lockedA = 0, lockedB = 0, grabSign = 1;
let pullAxis = 'x';
let dragAxisOrigin = new THREE.Vector3();
const freeMovePlane = new THREE.Plane();
const freeMoveStartPoint = new THREE.Vector3();
const freeMoveCurrentPoint = new THREE.Vector3();
const freeMoveStartPosition = new THREE.Vector3();
const freeMovePlaneNormal = new THREE.Vector3();
const movePickPoint = new THREE.Vector3();
const moveAxisDir = new THREE.Vector3();
let moveInferenceAxis = null; // x | y | z | null
let moveGrabIsCorner = false;
let moveGrabKind = 'face';     // face | edge | corner
let moveCornerTarget = null;
let moveSnapKind = null;       // corner | guide | edge | face | null
let moveSnapText = '';
let movingSpaceRoot = null;
let movingSpaceRootStart = null;
let movingSpaceCellStarts = [];
let movingSpaceObjectStarts = [];
const movingSpaceStartPoint = new THREE.Vector3();
const movingSpaceCurrentPoint = new THREE.Vector3();
const moveDownAim = new THREE.Vector2();
const AXIS_INFERENCE_ANGLE = 17 * Math.PI / 180;
const AXIS_INFERENCE_MIN_PX = 10;
let radiusDir = new THREE.Vector3(1,0,0);
let lastEdit = null;
let history = [], historyIndex = -1, historyMuted = false;
let toastTimer = null;

// Em vista 2D:
// - toque simples continua selecionando normalmente;
// - gesto com 2 dedos (pinça/zoom e pan) PERMANECE no 2D;
// - somente um arrasto real com 1 dedo/mouse volta ao 3D.
// Isso evita que o primeiro dedo da pinça seja interpretado como intenção de orbitar.
let orthoNavGesture=null;
const orthoPointers=new Set();
let orthoMultiTouch=false;
renderer.domElement.addEventListener('pointerdown',e=>{
  orthoPointers.add(e.pointerId);
  if(!viewMode2D||toolMode!=='select')return;
  if(orthoPointers.size>=2){
    orthoMultiTouch=true;
    orthoNavGesture=null;
    return;
  }
  if(e.isPrimary!==false){
    orthoMultiTouch=false;
    orthoNavGesture={id:e.pointerId,x:e.clientX,y:e.clientY};
  }
},{passive:true});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!viewMode2D||toolMode!=='select')return;
  // Durante pinça/zoom ou pan com 2 dedos nunca abandonar a vista ortográfica.
  if(orthoMultiTouch||orthoPointers.size>1)return;
  if(!orthoNavGesture||e.pointerId!==orthoNavGesture.id)return;
  if(Math.hypot(e.clientX-orthoNavGesture.x,e.clientY-orthoNavGesture.y)>12){
    orthoNavGesture=null;
    returnTo3D({restore:true,notify:true});
  }
},{passive:true});
function clearOrthoPointer(e){
  if(e)orthoPointers.delete(e.pointerId);
  if(!e||!orthoNavGesture||e.pointerId===orthoNavGesture.id)orthoNavGesture=null;
  // Depois de uma pinça, só permitimos voltar ao 3D em um NOVO gesto de 1 dedo.
  if(orthoPointers.size===0)orthoMultiTouch=false;
}
renderer.domElement.addEventListener('pointerup',clearOrthoPointer,{passive:true});
renderer.domElement.addEventListener('pointercancel',clearOrthoPointer,{passive:true});
renderer.domElement.addEventListener('lostpointercapture',clearOrthoPointer,{passive:true});

// ---------- Trena / guias de construção ----------
const constructionGuides = [];
let tapeStart = null;
let tapeStartClient = null;
let tapePointerMoved = false;
let tapeLastTap = { time:0, x:0, y:0 };
let tapeHover = null;
let tapeEdgeSource = null;     // aresta usada para criar guia paralela
let tapePendingEdge = null;    // aresta candidata no pointerdown
let tapeDragEdgeActive = false;
let tapeTouchActive = false;
let tapeTouchId = null;
let tapeTouchStartX = 0, tapeTouchStartY = 0;
let tapeLastClientX = 0, tapeLastClientY = 0;
let tapeMouseActive = false;
let tapeAim = null; // último alvo reconhecido pela Trena
// Uma única porta de entrada para confirmar toques da Trena. PointerEvent e
// TouchEvent podem representar o MESMO dedo no Android, então deduplicamos aqui.
let tapeConfirmGate = { time:0, x:-9999, y:-9999 };
let tapeLastConfirmedTap = { time:0, x:-9999, y:-9999, key:'' };

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const liveLabel = $('liveLabel');
const measureBadge = $('measureBadge');
const tapeCrosshair = $('tapeCrosshair');
const tapeCrosshairLabel = $('tapeCrosshairLabel');
const tapeSnapDot = $('tapeSnapDot');

function roundMmNumber(v,digits=3){
  const n=Number(v); if(!Number.isFinite(n)) return 0;
  const p=10**digits; return Math.round((n+Number.EPSILON)*p)/p;
}
// mm() continua retornando número (para inputs/cálculos), mas não destrói .5/.25 etc.
function mm(v){ return roundMmNumber(Number(v) * M_TO_MM,3); }
function m(v){ return Number(v) * MM_TO_M; }
function clampSize(v){ return THREE.MathUtils.clamp(v, MIN_SIZE, MAX_SIZE); }
// Texto de medidas em pt-BR: 22,5 em vez de 23; sem zeros desnecessários.
function nice(v){
  const n=roundMmNumber(v,3);
  return String(n).replace('.',',');
}

function toast(text){
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$('toast').classList.remove('show'), 1500);
}


// ============================================================================
// 1.100.16 · PRODUÇÃO: MATERIAIS, FITAS E BASE PARA ETIQUETAS
// ============================================================================
const PRODUCTION_SCHEMA_VERSION=2;

function defaultProjectProduction(){
  return {
    version:PRODUCTION_SCHEMA_VERSION,
    materials:[
      {id:'mat-mdf-branco-18',name:'MDF Branco 18 mm',code:'MDF-BR18',thickness:18,sheetWidth:2750,sheetHeight:1850,grainDirection:'length',color:'#e7e1d4',coreColor:'#c6a77b',grain:false},
      {id:'mat-mdf-madeirado-18',name:'MDF Madeirado 18 mm',code:'MDF-MAD18',thickness:18,sheetWidth:2750,sheetHeight:1850,grainDirection:'length',color:'#b88955',coreColor:'#b99665',grain:true},
      {id:'mat-mdf-branco-6',name:'MDF Branco 6 mm',code:'MDF-BR6',thickness:6,sheetWidth:2750,sheetHeight:1850,grainDirection:'length',color:'#efede7',coreColor:'#c6a77b',grain:false}
    ],
    edgeBands:[
      {id:'band-branca-045',name:'Fita branca 0,45 mm',code:'FB-045',thickness:.45,width:22,color:'#f5f5f2'},
      {id:'band-madeirada-045',name:'Fita madeirada 0,45 mm',code:'FM-045',thickness:.45,width:22,color:'#b88955'},
      {id:'band-preta-045',name:'Fita preta 0,45 mm',code:'FP-045',thickness:.45,width:22,color:'#202020'}
    ],
    labelTemplate:{
      version:1,
      configurableLater:true,
      availableFields:[
        'project','client','environment','space','partId','partName','dimensions',
        'material','materialCode','grain','edgeBands','machining'
      ]
    }
  };
}
let projectProduction=defaultProjectProduction();

function productionClone(v){return JSON.parse(JSON.stringify(v));}
function productionColor(v,fallback='#d8c5a4'){
  const s=String(v||'').trim();
  return /^#[0-9a-f]{6}$/i.test(s)?s:fallback;
}
function productionColorInt(v,fallback=COLORS.panel){
  const s=productionColor(v,'');
  return s?parseInt(s.slice(1),16):fallback;
}
function normalizeProductionMaterial(m){
  if(!m)return null;
  const thickness=Number(m.thickness),sheetWidth=Number(m.sheetWidth),sheetHeight=Number(m.sheetHeight);
  return {
    id:String(m.id||uid('mat')),
    name:String(m.name||'Material').trim()||'Material',
    code:String(m.code||'').trim(),
    thickness:Number.isFinite(thickness)&&thickness>0?thickness:18,
    sheetWidth:Number.isFinite(sheetWidth)&&sheetWidth>=100?sheetWidth:2750,
    sheetHeight:Number.isFinite(sheetHeight)&&sheetHeight>=100?sheetHeight:1850,
    grainDirection:m.grainDirection==='width'?'width':'length',
    color:productionColor(m.color,'#d8c5a4'),
    coreColor:productionColor(m.coreColor,'#c6a77b'),
    grain:!!m.grain
  };
}
function normalizeProductionBand(b){
  if(!b)return null;
  const thickness=Number(b.thickness),width=Number(b.width);
  return {
    id:String(b.id||uid('band')),
    name:String(b.name||'Fita de borda').trim()||'Fita de borda',
    code:String(b.code||'').trim(),
    thickness:Number.isFinite(thickness)&&thickness>0?thickness:.45,
    width:Number.isFinite(width)&&width>0?width:22,
    color:productionColor(b.color,'#f5f5f2')
  };
}
function setProjectProductionState(raw){
  if(!raw){
    projectProduction=defaultProjectProduction();
    return;
  }
  projectProduction={
    version:PRODUCTION_SCHEMA_VERSION,
    materials:Array.isArray(raw.materials)?raw.materials.map(normalizeProductionMaterial).filter(Boolean):[],
    edgeBands:Array.isArray(raw.edgeBands)?raw.edgeBands.map(normalizeProductionBand).filter(Boolean):[],
    labelTemplate:raw.labelTemplate?productionClone(raw.labelTemplate):defaultProjectProduction().labelTemplate
  };
}
function mergeProjectProductionState(raw){
  if(!raw)return;
  const mats=Array.isArray(raw.materials)?raw.materials.map(normalizeProductionMaterial).filter(Boolean):[];
  const bands=Array.isArray(raw.edgeBands)?raw.edgeBands.map(normalizeProductionBand).filter(Boolean):[];
  for(const m of mats){
    if(!projectProduction.materials.some(x=>x.id===m.id))projectProduction.materials.push(m);
  }
  for(const b of bands){
    if(!projectProduction.edgeBands.some(x=>x.id===b.id))projectProduction.edgeBands.push(b);
  }
}
function captureProductionState(){return productionClone(projectProduction);}
function productionMaterialById(id){return projectProduction.materials.find(x=>x.id===id)||null;}
function productionBandById(id){return projectProduction.edgeBands.find(x=>x.id===id)||null;}
function productionBandSnapshot(id){
  const b=productionBandById(id);
  return b?productionClone(b):null;
}
function normalizePieceEdgeBands(v){
  const out={};
  for(const key of ['uMin','uMax','vMin','vMax']){
    const rec=v?.[key];
    if(!rec)continue;
    if(typeof rec==='string'){
      const b=productionBandSnapshot(rec);
      if(b)out[key]=b;
    }else{
      const b=normalizeProductionBand(rec);
      if(b)out[key]=b;
    }
  }
  return out;
}
function boxFaceMaterialIndex(axis,sign){
  if(axis==='x')return sign>0?0:1;
  if(axis==='y')return sign>0?2:3;
  return sign>0?4:5;
}
function pieceEdgeFaceDefinitions(o){
  const ti=pieceThicknessInfo(o);if(!ti)return {};
  return {
    uMin:{axis:ti.uAxis,sign:-1},
    uMax:{axis:ti.uAxis,sign:1},
    vMin:{axis:ti.vAxis,sign:-1},
    vMax:{axis:ti.vAxis,sign:1}
  };
}
function pieceEdgeDisplayDefinitions(o){
  const ti=pieceThicknessInfo(o);if(!ti)return {};
  if(ti.thicknessAxis==='z'){
    return {
      uMin:{label:'Esquerda',axis:`−${axisLabel(ti.uAxis)}`},
      uMax:{label:'Direita',axis:`+${axisLabel(ti.uAxis)}`},
      vMin:{label:'Baixo',axis:`−${axisLabel(ti.vAxis)}`},
      vMax:{label:'Cima',axis:`+${axisLabel(ti.vAxis)}`}
    };
  }
  if(ti.thicknessAxis==='y'){
    return {
      uMin:{label:'Esquerda',axis:`−${axisLabel(ti.uAxis)}`},
      uMax:{label:'Direita',axis:`+${axisLabel(ti.uAxis)}`},
      vMin:{label:'Trás',axis:`−${axisLabel(ti.vAxis)}`},
      vMax:{label:'Frente',axis:`+${axisLabel(ti.vAxis)}`}
    };
  }
  return {
    uMin:{label:'Trás',axis:`−${axisLabel(ti.uAxis)}`},
    uMax:{label:'Frente',axis:`+${axisLabel(ti.uAxis)}`},
    vMin:{label:'Baixo',axis:`−${axisLabel(ti.vAxis)}`},
    vMax:{label:'Cima',axis:`+${axisLabel(ti.vAxis)}`}
  };
}
function applyPieceProductionEdgeColors(mesh){
  if(!mesh||mesh.userData?.kind==='cylinder')return;
  const mats=mesh.userData?.faceMaterials||[];
  if(mats.length<6)return;
  const defs=pieceEdgeFaceDefinitions(mesh);
  const material=productionMaterialById(mesh.userData?.materialId);
  const coreColor=mesh.userData?.materialCoreColor||material?.coreColor||null;

  // Quando há material de produção aplicado, a borda sem fita mostra o miolo.
  if(coreColor){
    for(const key of ['uMin','uMax','vMin','vMax']){
      const d=defs[key];if(!d)continue;
      mats[boxFaceMaterialIndex(d.axis,d.sign)]?.color?.set(productionColorInt(coreColor));
    }
  }

  // A fita substitui visualmente o miolo somente no lado escolhido.
  const bands=normalizePieceEdgeBands(mesh.userData?.edgeBands||{});
  mesh.userData.edgeBands=bands;
  for(const key of ['uMin','uMax','vMin','vMax']){
    const b=bands[key],d=defs[key];if(!b||!d)continue;
    mats[boxFaceMaterialIndex(d.axis,d.sign)]?.color?.set(productionColorInt(b.color,0xffffff));
  }
}
function pieceEdgeBandSignature(o){
  const bands=normalizePieceEdgeBands(o?.userData?.edgeBands||{});
  return ['uMin','uMax','vMin','vMax'].map(k=>bands[k]?.id||bands[k]?.name||'').join('|');
}
function pieceEdgeBandSummary(o){
  if(!o)return '';
  const defs=pieceEdgeDisplayDefinitions(o),bands=normalizePieceEdgeBands(o.userData?.edgeBands||{});
  const parts=[];
  for(const key of ['uMin','uMax','vMin','vMax']){
    if(!bands[key])continue;
    parts.push(`${defs[key]?.label||key}: ${bands[key].code||bands[key].name}`);
  }
  return parts.join(' · ');
}

// ============================================================================
// 1.100.19 · MATERIAL PADRÃO POR ESPAÇO
// ============================================================================
function spaceDefaultMaterial(rootOrId){
  const root=typeof rootOrId==='string'?getSpaceRoot(rootOrId):rootOrId;
  return root?.defaultMaterialId?productionMaterialById(root.defaultMaterialId):null;
}
function productionApplyMaterialRecordToObject(o,m,{keepSelection=true}={}){
  if(!o||!m)return false;
  const u=o.userData||{};
  if(u.kind==='hardware-visual'||u.kind==='cylinder'||u.excludeFromCutList)return false;

  u.materialId=m.id;
  u.materialType=m.name;
  u.materialCode=m.code||'';
  u.materialGrain=!!m.grain;
  u.materialCoreColor=m.coreColor||null;
  u.baseColor=productionColorInt(m.color,COLORS.panel);
  u.labelMeta={...(u.labelMeta||{}),schemaVersion:1,enabled:true};

  // Peças retangulares usam material por face; perfis curvos normalmente
  // possuem um único material. Ambos recebem a cor do cadastro.
  const mats=u.faceMaterials||[];
  for(const mat of mats)mat?.color?.set?.(u.baseColor);
  if(mats.length>=6)applyPieceProductionEdgeColors(o);

  if(keepSelection&&o===selected&&!visualMode)setAllFaces(o,COLORS.selected);
  return true;
}
function applySpaceDefaultMaterialToObject(o,rootOrId,{requireThicknessMatch=true}={}){
  if(!o||o.userData?.materialId)return false;
  const root=typeof rootOrId==='string'?getSpaceRoot(rootOrId):rootOrId;
  const mat=spaceDefaultMaterial(root);
  if(!root||!mat)return false;
  if(o.userData?.kind==='hardware-visual'||o.userData?.kind==='cylinder'||o.userData?.excludeFromCutList)return false;

  if(requireThicknessMatch){
    const ti=pieceThicknessInfo(o);
    if(ti&&Math.abs(Number(ti.thickness)-Number(mat.thickness))>.25)return false;
  }
  return productionApplyMaterialRecordToObject(o,mat,{keepSelection:false});
}
function spaceEligibleProductionPieces(root){
  if(!root)return [];
  return objects.filter(o=>{
    if(o.userData?.kind==='hardware-visual'||o.userData?.kind==='cylinder'||o.userData?.excludeFromCutList)return false;
    return o.userData?.spaceRootId===root.id || objectBelongsToRoot(o,root);
  });
}
function applySpaceMaterialToExistingPieces(root,material){
  if(!root||!material)return {changed:0,skipped:0};
  let changed=0,skipped=0;
  for(const o of spaceEligibleProductionPieces(root)){
    const ti=pieceThicknessInfo(o);
    // Ao aplicar em peças existentes, a espessura geométrica nunca é alterada.
    // Mesmo se houver diferença, o material é aplicado e o usuário pode ver
    // o aviso/lista depois. Isso é uma ação explícita do usuário.
    if(productionApplyMaterialRecordToObject(o,material,{keepSelection:false}))changed++;
    else skipped++;
  }
  if(selected&&spaceEligibleProductionPieces(root).includes(selected)&&!visualMode)setAllFaces(selected,COLORS.selected);
  return {changed,skipped};
}
function spaceMaterialText(rootOrId){
  const m=spaceDefaultMaterial(rootOrId);
  return m?`${m.name}${m.code?` · ${m.code}`:''} · ${nice(m.thickness)} mm · chapa ${nice(m.sheetWidth)} × ${nice(m.sheetHeight)}${m.grain?` · veio no ${m.grainDirection==='width'?'largura':'comprimento'}`:''}`:'Sem material padrão';
}


function normalizePieceGrainRotation(value){
  const n=Number(value)||0;
  return Math.abs(Math.round(n/90))%2?90:0;
}
function pieceGrainRotation(o){
  return normalizePieceGrainRotation(o?.userData?.materialGrainRotation);
}

function pieceProductionLabelData(o){
  if(!o)return null;
  const u=o.userData||{},ti=pieceThicknessInfo(o),root=rootForObject(o);
  return {
    schemaVersion:1,
    partId:u.partId||'',
    project:typeof currentProjectRecord!=='undefined'?(currentProjectRecord?.name||''):'',
    client:typeof currentProjectRecord!=='undefined'?(currentProjectRecord?.client||''):'',
    environment:typeof currentProjectRecord!=='undefined'?(currentProjectRecord?.environment||''):'',
    space:root?.name||'',
    partName:u.name||'Peça',
    material:u.materialType||'MDF',
    materialCode:u.materialCode||'',
    grain:!!u.materialGrain,
    grainRotation:normalizePieceGrainRotation(u.materialGrainRotation),
    thickness:ti?.thickness||0,
    faceW:ti?.faceW||0,
    faceH:ti?.faceH||0,
    edgeBands:productionClone(u.edgeBands||{}),
    edgeBandSummary:pieceEdgeBandSummary(o),
    machiningCount:(u.machining||[]).length
  };
}


function makeMaterials(baseColor, count=6){
  return Array.from({length:count},()=>new THREE.MeshStandardMaterial({ color:baseColor, roughness:.72, metalness:0 }));
}
function setAllFaces(mesh, color){
  const mats = mesh.userData.faceMaterials || [];
  mats.forEach(mat=>mat.color.set(color));
  // Mesmo selecionada, a peça continua mostrando quais bordas têm fita.
  applyPieceProductionEdgeColors(mesh);
}
function restoreBaseColor(mesh){ setAllFaces(mesh, mesh.userData.baseColor ?? COLORS.default); }


function uid(prefix='id'){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }
function getSpaceRoot(id){ return spaceRoots.find(r=>r.id===id) || null; }
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
  for(const root of spaceRoots) root.group=null;
  spacePickMeshes.length=0;
}
function updateSpaceSelectionVisuals(){
  for(const mesh of spacePickMeshes){
    const active=!!selectedSpaceCell && mesh.userData.spaceRootId===selectedSpaceCell.rootId && mesh.userData.spaceCellId===selectedSpaceCell.cellId;

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
  for(const root of spaceRoots){
    const group=new THREE.Group(); group.userData.isSpaceRoot=true; root.group=group; scene.add(group);

    // 1.100.95: o espaço criado originalmente continua sendo o espaço PRINCIPAL.
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
      group.add(mesh,edges); spacePickMeshes.push(mesh);
    }
  }
  updateSpaceSelectionVisuals();
  if(visualMode)applyVisualSceneState();
}
function referenceMeshes(exclude=null){ return [...objects,...spacePickMeshes].filter(o=>o!==exclude && o.visible!==false); }
function isDoorObject(o){
  return !!o && (/^Porta\s/i.test(String(o.userData?.name||'')) || o.userData?.drawerRole==='drawer-front');
}
function doorObjectsForRoot(rootId){
  return objects.filter(o=>o.userData?.spaceRootId===rootId && isDoorObject(o));
}
function applyDoorVisibility(root){
  if(!root) return;
  const visible=!root.doorsHidden;
  for(const o of doorObjectsForRoot(root.id)){
    o.visible=visible;
    o.userData.hiddenByDoors=!visible;
  }
  if(selected && selected.userData?.spaceRootId===root.id && isDoorObject(selected) && !visible){
    restoreBaseColor(selected); selected=null; $('inspector').style.display='none';
  }
}
function applyAllDoorVisibility(){ for(const root of spaceRoots) applyDoorVisibility(root); }
function updateDoorsToggleButton(root=null){
  const btn=$('toggleDoorsBtn'); if(!btn) return;
  root=root || (selectedSpaceCell ? getSpaceRoot(selectedSpaceCell.rootId) : null);
  btn.textContent=(root && root.doorsHidden) ? 'Mostrar portas' : 'Ocultar portas';
}
function toggleDoorsForActiveSpace(){
  const root=selectedSpaceCell ? getSpaceRoot(selectedSpaceCell.rootId) : (activeSpaceRootId ? getSpaceRoot(activeSpaceRootId) : null);
  if(!root){ toast('Selecione um espaço'); return; }
  const doors=doorObjectsForRoot(root.id);
  if(!doors.length){ toast('Este espaço ainda não tem portas'); return; }
  root.doorsHidden=!root.doorsHidden;
  applyDoorVisibility(root); updateDoorsToggleButton(root); commitHistory();
  toast(root.doorsHidden ? 'Portas ocultadas' : 'Portas exibidas');
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
  if(!selectedSpaceCell){ toast('Selecione a divisão que deseja ocultar'); return; }
  const root=getSpaceRoot(selectedSpaceCell.rootId);
  const cell=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId);
  if(!root || !cell){ toast('Divisão não encontrada'); return; }

  // Oculta somente a divisão clicada. As peças ligadas ao espaço permanecem visíveis.
  cell.hidden=true;
  const rootId=root.id;
  renderSpaces();

  // Depois de esconder o corte atual, tenta selecionar o corte mais próximo.
  // Em cortes de frente/trás isso normalmente leva direto ao espaço de dentro.
  const next=nearestVisibleCell(root,cell);
  if(next) selectSpaceCellByIds(rootId,next.id);
  else selectSpaceRootOnly(root);

  commitHistory();
  toast('Corte ocultado · espaço principal mantido');
}
function showAllHiddenSpaces(){
  let count=0;
  for(const root of spaceRoots){
    // Compatibilidade com projetos v32/v33 que ocultavam o espaço inteiro.
    if(root.spaceHidden){ root.spaceHidden=false; }
    for(const c of root.cells){
      if(c.hidden){ c.hidden=false; count++; }
    }
  }
  if(!count){ toast('Não há divisões ocultas'); return; }
  renderSpaces();
  updateSpaceVisibilityToggleButton();
  commitHistory();
  toast(count===1 ? 'Divisão oculta exibida' : `${count} divisões ocultas exibidas`);
}
function setSpaceActionCellMode(hasCell){
  for(const id of ['cutSpaceBtn','createPiecesBtn','openLibraryBtn','hideSelectedSpaceBtn','deleteSelectedSpaceBtn']){
    const b=$(id);if(b)b.disabled=!hasCell;
  }
}
function selectSpaceRootOnly(root,{showMenu}={}){
  if(!root){ clearSpaceSelection(); return; }
  const panel=$('spaceActions');
  const wasOpen=panel?.style.display==='block';
  if(selected){ restoreBaseColor(selected); selected=null; }
  lastEdit=null; liveLabel.style.display='none'; hideGuides(); $('inspector').style.display='none';
  selectedSpaceCell=null; activeSpaceRootId=root.id; updateSpaceSelectionVisuals();
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
  return spaceRoots.find(r=>objectBelongsToRoot(obj,r))||null;
}
function openSpaceFromObject(obj=null){
  obj=obj||selected;
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
  if(selectedSpaceCell){ const r=getSpaceRoot(selectedSpaceCell.rootId); if(r)return r; }
  if(activeSpaceRootId){ const r=getSpaceRoot(activeSpaceRootId); if(r)return r; }
  return selectedFurnitureRoot();
}

function clearSpaceSelection(){ selectedSpaceCell=null; activeSpaceRootId=null; $('spaceActions').style.display='none'; setSpaceActionCellMode(true); updateDoorsToggleButton(null); updateSpaceVisibilityToggleButton(null); updateSpaceSelectionVisuals(); }
function selectSpaceCellByIds(rootId,cellId,{showMenu}={}){
  const panel=$('spaceActions');
  const wasOpen=panel?.style.display==='block';
  if(selected){ restoreBaseColor(selected); selected=null; }
  lastEdit=null; liveLabel.style.display='none'; hideGuides(); $('inspector').style.display='none';
  const root=getSpaceRoot(rootId), cell=getSpaceCell(rootId,cellId); if(!root||!cell){clearSpaceSelection();updateMeasureBadge();return;}
  selectedSpaceCell={rootId,cellId}; activeSpaceRootId=rootId; updateSpaceSelectionVisuals();
  const sz=cellSize(cell); const cutLabel=spaceCellLabel(root,cell); $('spaceActionTitle').textContent=root.name+' · '+cutLabel;
  const fixed=[]; if(cell.fixedAxes?.x)fixed.push(`X ${mm(sz.width)} mm`); if(cell.fixedAxes?.y)fixed.push(`Y ${mm(sz.height)} mm`); if(cell.fixedAxes?.z)fixed.push(`Z ${mm(sz.depth)} mm`);
  $('spaceActionDims').innerHTML=`L ${mm(sz.width)} · P ${mm(sz.depth)} · A ${mm(sz.height)} mm${root.cells.length>1?`<br><span style="color:var(--muted)">Corte individual do espaço principal</span>`:''}${fixed.length?`<br><span class="fixedBadge">🔒 Fixo: ${fixed.join(' · ')}</span>`:''}<br><span style="color:#9fd6ac">🧱 ${escapeHtml(spaceMaterialText(root))}</span>`;
  if(panel)panel.style.display=(showMenu===undefined?wasOpen:!!showMenu)?'block':'none';
  setSpaceActionCellMode(true); updateDoorsToggleButton(root); updateSpaceVisibilityToggleButton(root); updateMeasureBadge();
}
function createSpace({width=1,depth=.6,height=.9,x=0,yBase=0,z=0,name='Espaço',defaultMaterialId=null}={},doHistory=true){
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  // O chão do projeto é Y=0. Espaços de mobiliário nunca nascem abaixo dele.
  yBase=Math.max(0,Number(yBase)||0);
  const root={id:uid('space'),name,width,depth,height,x,yBase,z,defaultMaterialId:defaultMaterialId||null,doorsHidden:false,spaceHidden:false,fixedBands:{x:[],y:[],z:[]},cells:[{id:uid('cell'),hidden:false,fixedAxes:{},minX:x-width/2,maxX:x+width/2,minY:yBase,maxY:yBase+height,minZ:z-depth/2,maxZ:z+depth/2}]};
  spaceRoots.push(root); renderSpaces();
  // 1.100.95: criar o espaço principal apenas o seleciona. O menu nunca abre
  // automaticamente; toque e segure o espaço para abrir as opções.
  selectSpaceCellByIds(root.id,root.cells[0].id,{showMenu:false});
  resetSpaceDoubleTap();
  frontViewToSpace(root);
  if(doHistory) commitHistory(); return root;
}
function createSpaceFromState(data){
  const legacyWholeHidden=!!data.spaceHidden;
  const root={id:data.id||uid('space'),name:data.name||'Espaço',width:data.width,depth:data.depth,height:data.height,x:data.x||0,yBase:data.yBase||0,z:data.z||0,defaultMaterialId:data.defaultMaterialId||null,doorsHidden:!!data.doorsHidden,spaceHidden:false,fixedBands:{x:(data.fixedBands?.x||[]).map(v=>[...v]),y:(data.fixedBands?.y||[]).map(v=>[...v]),z:(data.fixedBands?.z||[]).map(v=>[...v])},cells:(data.cells||[]).map(c=>({...c,id:c.id||uid('cell'),hidden:!!c.hidden||legacyWholeHidden,fixedAxes:{...(c.fixedAxes||{})}}))};
  if(!root.cells.length) root.cells=[{id:uid('cell'),hidden:legacyWholeHidden,fixedAxes:{},minX:root.x-root.width/2,maxX:root.x+root.width/2,minY:root.yBase,maxY:root.yBase+root.height,minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2}];
  spaceRoots.push(root); return root;
}
function viewSpace(root=null,view='front'){
  restoreTechnical2DTransparency();
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  let center=new THREE.Vector3(0,.8,0), w=2.2, h=1.6, depth=2.2;
  if(root){
    center.set(root.x,root.yBase+root.height/2,root.z);
    if(view==='left'||view==='right'){w=root.depth;h=root.height;depth=root.width;}
    else if(view==='top'||view==='bottom'){w=root.width;h=root.depth;depth=root.height;}
    else {w=root.width;h=root.height;depth=root.depth;}
  }
  if(camera===perspectiveCamera&&!viewMode2D)remember3DView();
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
  viewMode2D=true; current2DView=view;
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

function cutSelectedSpace(side,amountM,isFixed=false){
  // 1.100.95: cortar nunca cria outro móvel principal. O root continua sendo
  // o espaço original; apenas a célula selecionada vira dois cortes irmãos.
  if(!selectedSpaceCell) return false;
  const root=getSpaceRoot(selectedSpaceCell.rootId), cell=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId); if(!root||!cell)return false;
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
  const mt=Number(material?.thickness);
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
  const dividers=objects.filter(o=>isVerticalDivisionPiece(o,root));
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
  const mapX=makeFixedAxisMapper(src.minX,src.maxX,dst.minX,dst.maxX,fixedX);
  const mapY=makeFixedAxisMapper(src.minY,src.maxY,dst.minY,dst.maxY,fixedY);
  const mapZ=makeFixedAxisMapper(src.minZ,src.maxZ,dst.minZ,dst.maxZ,fixedZ);

  // Captura as peças antes de alterar os limites do espaço.
  const linked=objects.filter(o=>o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root));
  const pieceStates=linked.map(o=>{
    const u=o.userData;
    return {o, minX:o.position.x-u.width/2,maxX:o.position.x+u.width/2,minY:o.position.y-u.height/2,maxY:o.position.y+u.height/2,minZ:o.position.z-u.depth/2,maxZ:o.position.z+u.depth/2};
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
    const nx0=mapX(st.minX), nx1=mapX(st.maxX), ny0=mapY(st.minY), ny1=mapY(st.maxY), nz0=mapZ(st.minZ), nz1=mapZ(st.maxZ);
    const nw=Math.max(.001,Math.abs(nx1-nx0)), nh=Math.max(.001,Math.abs(ny1-ny0)), nd=Math.max(.001,Math.abs(nz1-nz0));
    u.width=nw; u.height=nh; u.depth=nd;
    if(Array.isArray(u.forms)&&u.forms.length){o.scale.set(1,1,1);rebuildFormGeometry(o);}else o.scale.set(nw,nh,nd);
    o.position.set((nx0+nx1)/2,(ny0+ny1)/2,(nz0+nz1)/2);
    updateAutoMachiningAfterPieceResize(o);
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
  const currentId=selectedSpaceCell?.rootId===root.id?selectedSpaceCell.cellId:null;
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
  const rootId=selectedSpaceCell?.rootId || activeSpaceRootId;
  if(!rootId){toast('Selecione um espaço');return false;}

  const i=spaceRoots.findIndex(r=>r.id===rootId);
  if(i<0){toast('Espaço não encontrado');return false;}

  const root=spaceRoots[i];
  const linked=objects.filter(o=>objectInsideSpaceRoot(o,root));
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
    const oi=objects.indexOf(obj);
    if(oi>=0)objects.splice(oi,1);
    disposeObject(obj);
  }
  if(selected&&linked.includes(selected))selected=null;

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

  spaceRoots.splice(i,1);
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

function createBox({width=1, depth=1, height=1, x=0, yBase=0, z=0, name='Cubo', kind='box', materialType='genérico', baseColor=COLORS.default, materialId=null, materialCode='', materialGrain=false, materialGrainRotation=0, materialCoreColor=null, edgeBands={}, partId=null, labelMeta=null, spaceRootId=null, machining=[], forms=[], rotationX=0, rotationY=0, rotationZ=0, divisionNominalThicknessM=null, curvedRole=null, curvedConfig=null, drawerSetId=null, drawerRole=null, drawerIndex=null, drawerConfig=null, doorConfig=null, excludeFromCutList=false, spaceCutting=false, spaceCutParentBounds=null}={}, doHistory=true){
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  const mats=makeMaterials(baseColor,6);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mats);
  mesh.scale.set(width,height,depth);
  mesh.position.set(x,yBase+height/2,z);
  mesh.rotation.order='XYZ';
  mesh.rotation.set(Number(rotationX)||0,Number(rotationY)||0,Number(rotationZ)||0);
  mesh.userData={
    kind,width,depth,height,name,materialType,baseColor,
    materialId:materialId||null,
    materialCode:String(materialCode||''),
    materialGrain:!!materialGrain,
    materialGrainRotation:normalizePieceGrainRotation(materialGrainRotation),
    materialCoreColor:materialCoreColor||null,
    edgeBands:normalizePieceEdgeBands(edgeBands||{}),
    partId:partId||uid('part'),
    labelMeta:labelMeta?productionClone(labelMeta):{schemaVersion:1,enabled:true,custom:{}},
    faceMaterials:mats,spaceRootId:spaceRootId||null,
    machining:Array.isArray(machining)?JSON.parse(JSON.stringify(machining)):[],
    forms:Array.isArray(forms)?JSON.parse(JSON.stringify(forms)):[],
    rotationX:Number(rotationX)||0,rotationY:Number(rotationY)||0,rotationZ:Number(rotationZ)||0,
    divisionNominalThicknessM:Number.isFinite(Number(divisionNominalThicknessM))&&Number(divisionNominalThicknessM)>0?Number(divisionNominalThicknessM):null,
    curvedRole:curvedRole||null,
    curvedConfig:curvedConfig?JSON.parse(JSON.stringify(curvedConfig)):null,
    drawerSetId:drawerSetId||null,drawerRole:drawerRole||null,
    drawerIndex:Number.isFinite(Number(drawerIndex))?Number(drawerIndex):null,
    drawerConfig:drawerConfig?JSON.parse(JSON.stringify(drawerConfig)):null,
    doorConfig:doorConfig?JSON.parse(JSON.stringify(doorConfig)):null,
    excludeFromCutList:!!excludeFromCutList,
    spaceCutting:!!spaceCutting,
    // Guarda o vão ORIGINAL no qual esta peça estrutural foi criada. Isso
    // permite devolver somente a espessura da peça ao vão correto ao apagá-la,
    // sem misturar com divisões vizinhas do mesmo espaço.
    spaceCutParentBounds:spaceCutParentBounds?JSON.parse(JSON.stringify(spaceCutParentBounds)):null
  };
  mesh.castShadow=true; mesh.receiveShadow=true;

  // Se a peça não recebeu material explicitamente, herda o material padrão
  // do espaço quando a espessura nominal da chapa corresponde à peça.
  // Isso evita aplicar MDF 18 mm automaticamente em um fundo de gaveta 6 mm.
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});

  const visualEdgeMat=new THREE.LineBasicMaterial({color:0x080808,transparent:true,opacity:xray3DActive()?.86:.96,depthTest:!xray3DActive(),depthWrite:false});
  const visualEdges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),visualEdgeMat);
  visualEdges.userData.isVisualEdge=true; visualEdges.visible=true; visualEdges.renderOrder=xray3DActive()?88:12;
  mesh.add(visualEdges); mesh.userData.visualEdges=visualEdges;
  scene.add(mesh); objects.push(mesh);
  if(mesh.userData.forms.length) rebuildFormGeometry(mesh);
  restoreBaseColor(mesh);
  selectObject(mesh);
  if(mesh.userData.machining.length) renderMachiningVisuals();
  if(doHistory) commitHistory();
  return mesh;
}

// ---------- v75: móvel curvo + 3 montantes obrigatórios + extras só na frente ----------
let curvedTargetRootId=null, curvedTargetCellId=null, curvedOrientation='front-right', curvedEditingExisting=false;
let curved3DPreviewActive=false, curved3DPreviewOriginalState=null, curved3DPreviewMeta=null;
function curvedSelectedTarget(){
  let root=null,cell=null;
  if(selectedSpaceCell){ root=getSpaceRoot(selectedSpaceCell.rootId); cell=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId); }
  if(!root && activeSpaceRootId) root=getSpaceRoot(activeSpaceRootId);
  if(!root && selected) root=rootForObject(selected);
  if(!root) return null;
  if(cell){
    return {root,cell,width:cell.maxX-cell.minX,depth:cell.maxZ-cell.minZ,height:cell.maxY-cell.minY,x:(cell.minX+cell.maxX)/2,z:(cell.minZ+cell.maxZ)/2,yBase:cell.minY,label:`${root.name} · divisão`};
  }
  return {root,cell:null,width:root.width,depth:root.depth,height:root.height,x:root.x,z:root.z,yBase:root.yBase,label:`${root.name} · espaço completo`};
}
function curvedTargetFromStored(){
  const root=curvedTargetRootId?getSpaceRoot(curvedTargetRootId):null;
  if(!root)return null;
  const cell=curvedTargetCellId?getSpaceCell(root.id,curvedTargetCellId):null;
  if(cell)return {root,cell,width:cell.maxX-cell.minX,depth:cell.maxZ-cell.minZ,height:cell.maxY-cell.minY,x:(cell.minX+cell.maxX)/2,z:(cell.minZ+cell.maxZ)/2,yBase:cell.minY,label:`${root.name} · divisão`};
  return {root,cell:null,width:root.width,depth:root.depth,height:root.height,x:root.x,z:root.z,yBase:root.yBase,label:`${root.name} · espaço completo`};
}
function curvedOrientationName(v){
  return v==='front-left'?'Frente esquerda'
    :v==='back-left'?'Trás esquerda'
    :v==='back-right'?'Trás direita'
    :'Frente direita';
}
function curvedTransformPointMm(cfg,x,z){
  const W=Number(cfg.targetW)||(Number(cfg.straightA)+Number(cfg.radius));
  const D=Number(cfg.targetD)||(Number(cfg.radius)+Number(cfg.straightB));
  const o=cfg.orientation||'front-right';
  if(o==='front-left'||o==='back-left')x=W-x;
  if(o==='back-left'||o==='back-right')z=D-z;
  return {x,z};
}
function curvedTransformVector(cfg,tx,tz){
  const o=cfg.orientation||'front-right';
  if(o==='front-left'||o==='back-left')tx=-tx;
  if(o==='back-left'||o==='back-right')tz=-tz;
  return {tx,tz};
}
function curvedCoverOffsetMm(cfg){
  return cfg.createCover===false?0:Math.max(0,Number(cfg.coverThickness)||0);
}
function curvedProfilePointsMm(cfg,part='full'){
  const a=Math.max(0,Number(cfg.straightA)||0), b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500), cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover), band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50)), Rin=Rout-band;
  const seg=Math.max(160,Math.min(320,Math.ceil(R/2.5))), pts=[];
  const split=(part==='full')?0:curvedSplitInfo(cfg).splitX;
  if(part==='straight'){
    if(split<=.001)return [];
    pts.push([0,cover],[split,cover],[split,cover+band],[0,cover+band]);
  }else{
    const x0=part==='curve'?split:0;
    pts.push([x0,cover],[a,cover]);
    for(let i=1;i<=seg;i++){
      const ang=-Math.PI/2+(Math.PI/2)*(i/seg);
      pts.push([a+Rout*Math.cos(ang),R+Rout*Math.sin(ang)]);
    }
    if(b>.001)pts.push([a+Rout,R+b],[a+Rin,R+b]);
    else pts.push([a+Rin,R]);
    if(b>.001)pts.push([a+Rin,R]);
    for(let i=1;i<=seg;i++){
      const ang=0-(Math.PI/2)*(i/seg);
      pts.push([a+Rin*Math.cos(ang),R+Rin*Math.sin(ang)]);
    }
    pts.push([x0,cover+band]);
  }
  return pts.map(([x,z])=>{const p=curvedTransformPointMm(cfg,x,z);return [p.x,p.z];});
}
function curvedPathSampleMm(cfg,t){
  const a=Math.max(0,Number(cfg.straightA)||0), b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500), cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover), band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50));
  const rc=Math.max(.5,Rout-band/2), arc=rc*Math.PI/2, total=a+arc+b, s=THREE.MathUtils.clamp(Number(t)||0,0,1)*total;
  let x,z,tx,tz,segment;
  if(s<=a){x=s;z=cover+band/2;tx=1;tz=0;segment='straightA';}
  else if(s<=a+arc){
    const q=(s-a)/arc, ang=-Math.PI/2+q*Math.PI/2;
    x=a+rc*Math.cos(ang);z=R+rc*Math.sin(ang);tx=-Math.sin(ang);tz=Math.cos(ang);segment='curve';
  }else{x=a+rc;z=R+(s-a-arc);tx=0;tz=1;segment='straightB';}
  const nx=-tz,nz=tx;
  const p=curvedTransformPointMm(cfg,x,z),v=curvedTransformVector(cfg,tx,tz),n=curvedTransformVector(cfg,nx,nz);
  return {x:p.x,z:p.z,phi:Math.atan2(v.tz,v.tx),tx:v.tx,tz:v.tz,nx:n.tx,nz:n.tz,segment,s,total};
}
function curvedPathTotalMm(cfg){
  const a=Math.max(0,Number(cfg.straightA)||0), b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500), cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover), band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50));
  return a+Math.max(.5,Rout-band/2)*Math.PI/2+b;
}
function curvedPathMetricsMm(cfg){
  const a=Math.max(0,Number(cfg.straightA)||0),b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500),cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover),band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50));
  const rc=Math.max(.5,Rout-band/2),arc=rc*Math.PI/2,total=a+arc+b;
  return {a,b,R,cover,Rout,band,rc,arc,total};
}
function curvedSampleAtDistanceMm(cfg,s,tag=null){
  const m=curvedPathMetricsMm(cfg),ss=THREE.MathUtils.clamp(Number(s)||0,0,m.total);
  const sample=curvedPathSampleMm(cfg,m.total>0?ss/m.total:0);
  sample.s=ss;
  if(tag){sample.structuralTag=tag;sample.segment='curve';}
  return sample;
}
const CURVED_CURVE_END_INSET_MM=17;
const CURVED_END_A_INSET_MM=0;
const CURVED_END_B_INSET_MM=0;
function curvedPostSamplesMm(cfg){
  const m=curvedPathMetricsMm(cfg),T=Math.max(1,Number(cfg.thickness)||18);
  const requested=Math.max(4,Math.round(Number(cfg.posts)||5));
  const samples=[];
  const push=(s,tag=null,forceSegment=null)=>{
    const sm=curvedSampleAtDistanceMm(cfg,s,tag);
    if(forceSegment)sm.segment=forceSegment;
    if(samples.some(v=>Math.abs(v.s-sm.s)<.25))return false;
    samples.push(sm);return true;
  };

  // v63 — as duas pontas do conjunto passam a ter distância configurável.
  // A medida é da BORDA do móvel até a BORDA do montante. 0 = rente.
  // Além delas permanecem as referências estruturais do arco: centro e final
  // recuado. Em 2 partes, o trecho de emenda continua totalmente livre.
  const curveStart=m.a,curveEnd=m.a+m.arc;
  const endAInset=Number.isFinite(Number(cfg.endAInset))?Math.max(0,Number(cfg.endAInset)):CURVED_END_A_INSET_MM;
  const endBInset=Number.isFinite(Number(cfg.endBInset))?Math.max(0,Number(cfg.endBInset)):CURVED_END_B_INSET_MM;
  const curveInset=Number.isFinite(Number(cfg.curveEndInset))?Math.max(0,Number(cfg.curveEndInset)):CURVED_CURVE_END_INSET_MM;
  const startCenter=Math.min(m.total,Math.max(0,endAInset+T/2));
  const finishCenter=Math.max(0,Math.min(m.total,m.total-endBInset-T/2));
  const curveCenterInset=curveInset+T/2;
  const curveEndCenter=Math.max(curveStart+T/2,curveEnd-Math.min(curveCenterInset,Math.max(0,m.arc/2-.25)));

  push(startCenter,'end-a',m.a>.001?'straightA':'curve');
  push(curveStart+m.arc/2,'curve-mid','curve');
  push(curveEndCenter,'curve-end-inset','curve');
  push(finishCenter,'end-b',m.b>.001?'straightB':'curve');

  let extras=Math.max(0,requested-samples.length);
  if(extras){
    const split=curvedSplitInfoBase(cfg);
    const upperA=Math.max(0,(cfg.splitStructure&&split.enabled&&split.valid?split.splitX:m.a));
    // Reserva o espaço já ocupado pelo montante final A.
    const lowerA=Math.min(upperA,Math.max(0,endAInset+T));
    const lengthA=Math.max(0,upperA-lowerA);
    // No lado B reserva a ponta ocupada pelo montante final B.
    const upperB=Math.max(curveEnd,Math.min(m.total,m.total-endBInset-T));
    const lowerB=curveEnd;
    const lengthB=Math.max(0,upperB-lowerB);

    const gapFor=(length,n)=>{
      const free=length-n*T;
      return free>=-.001?Math.max(0,free)/(n+1):-Infinity;
    };
    let best=null;
    for(let nA=0;nA<=extras;nA++){
      const nB=extras-nA,ga=gapFor(lengthA,nA),gb=gapFor(lengthB,nB);
      if(!Number.isFinite(ga)||!Number.isFinite(gb))continue;
      const score=Math.max(ga,gb)*100000+Math.abs(ga-gb)*100+Math.abs(nA-nB);
      if(!best||score<best.score-.001)best={nA,nB,score};
    }
    if(!best){
      let left=extras,nA=0,nB=0;
      while(left>0){
        const canA=Number.isFinite(gapFor(lengthA,nA+1)),canB=Number.isFinite(gapFor(lengthB,nB+1));
        if(!canA&&!canB)break;
        const ga=canA?gapFor(lengthA,nA+1):-1,gb=canB?gapFor(lengthB,nB+1):-1;
        if(gb>ga)nB++;else nA++;
        left--;
      }
      best={nA,nB};
    }
    if(best.nA>0){
      const g=gapFor(lengthA,best.nA);
      for(let i=0;i<best.nA;i++)push(lowerA+g+T/2+i*(T+g),'straight-a','straightA');
    }
    if(best.nB>0){
      const g=gapFor(lengthB,best.nB);
      for(let i=0;i<best.nB;i++)push(lowerB+g+T/2+i*(T+g),'straight-b','straightB');
    }
  }

  samples.sort((u,v)=>u.s-v.s);
  samples.forEach((v,i)=>v.postIndex=i);
  return samples;
}
function curvedPostSampleMm(cfg,index,count){
  // Compatibilidade com chamadas antigas: a lista usa as regras estruturais fixas da v58.
  const list=curvedPostSamplesMm({...cfg,posts:Math.max(3,Math.round(Number(count)||Number(cfg.posts)||5))});
  return list[Math.max(0,Math.min(list.length-1,Math.round(Number(index)||0)))]||curvedSampleAtDistanceMm(cfg,0);
}
function curvedSplitInfoBase(cfg){
  const a=Math.max(0,Number(cfg.straightA)||0);
  const tail=Math.max(0,Number(cfg.splitTail)||60);
  if(!cfg.splitStructure)return {enabled:false,valid:true,splitX:0,tail,lastPostIndex:-1,lastPost:null,straightLength:0,curveTail:a};
  // v58: a emenda fica no trecho reto antes da curva. O valor configurado
  // é preservado como trecho de emenda entre o corte e o começo do arco.
  const splitX=a-tail;
  return {
    enabled:true,
    valid:splitX>=20&&splitX<=a+.001,
    splitX,
    tail,
    lastPostIndex:-1,
    lastPost:null,
    outerEdge:a,
    straightLength:Math.max(0,splitX),
    curveTail:Math.max(0,a-splitX),
    reason:splitX<20?'Não há trecho reto suficiente para o espaço de emenda escolhido. Reduza a emenda ou aumente o trecho reto antes da curva.':''
  };
}
function curvedSplitInfo(cfg){
  const info=curvedSplitInfoBase(cfg);
  if(!info.enabled)return info;
  const list=curvedPostSamplesMm({...cfg,splitStructure:false});
  const before=list.filter(s=>s.s<info.splitX-.001);
  const ref=before.length?before[before.length-1]:null;
  return {...info,lastPostIndex:ref?list.indexOf(ref):-1,lastPost:ref};
}
function curvedPostPlacementFromSampleMm(cfg,sample){
  const band=Math.max(1,Number(cfg.band)||50),postWidth=Math.max(1,Number(cfg.postWidth)||100);
  const offset=(postWidth-band)/2;
  return {...sample,x:sample.x+sample.nx*offset,z:sample.z+sample.nz*offset,rotationY:Math.atan2(-sample.nz,sample.nx)};
}
function curvedPostPlacementMm(cfg,index,count){
  return curvedPostPlacementFromSampleMm(cfg,curvedPostSampleMm(cfg,index,count));
}
function curvedRotatePtsAround(anchor,pts,angle){
  const c=Math.cos(angle),s=Math.sin(angle),ax=anchor[0],ay=anchor[1];
  return (pts||[]).map(([x,y])=>{const dx=x-ax,dy=y-ay;return [ax+dx*c-dy*s,ay+dx*s+dy*c];});
}
function curvedDiagonalReliefSequence2D(cx,cy,dx,dy,px,py,diameter,length,steps=14){
  // v65 — comprimento é a penetração real além do canto e pode chegar a 0,5 mm.
  // O começo do canal fica dentro do encaixe; não forçamos mais o comprimento ao Ø da fresa.
  // Alívio diagonal (dog-bone) a 45°. O começo do canal fica dentro do
  // encaixe e somente a ponta avança para o material, por isso não aparece mais
  // como uma lingueta reta saindo pela frente da peça.
  const mag=Math.hypot(dx,dy)||1,pmag=Math.hypot(px,py)||1;
  dx/=mag;dy/=mag;px/=pmag;py/=pmag;
  const r=Math.max(.4,Number(diameter)||6)/2;
  const len=Math.max(.5,Number(length)||18);
  const sx=cx-dx*r,sy=cy-dy*r;
  const ex=cx+dx*(len-r),ey=cy+dy*(len-r);
  const startPlus=[sx+px*r,sy+py*r];
  const endPlus=[ex+px*r,ey+py*r];
  const endMinus=[ex-px*r,ey-py*r];
  const startMinus=[sx-px*r,sy-py*r];
  const seq=[startPlus,endPlus];
  for(let i=1;i<=steps;i++){
    const a=Math.PI*(i/steps);
    // +P -> +D -> -P: semicírculo da ponta, sempre voltado para fora do encaixe.
    const vx=px*Math.cos(a)+dx*Math.sin(a),vy=py*Math.cos(a)+dy*Math.sin(a);
    seq.push([ex+vx*r,ey+vy*r]);
  }
  seq.push(startMinus);
  return {seq,startPlus,startMinus,r,len,cornerOffset:Math.SQRT2*r};
}
function curvedPointInOrOnPolygonMm(point,poly,tol=.45){
  if(!Array.isArray(poly)||poly.length<3)return true;
  const x=Number(point?.[0]),y=Number(point?.[1]);
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const tol2=tol*tol;
  // Considera a própria borda como madeira válida. Isso evita falso negativo
  // nos encaixes que terminam exatamente no contorno da nervura.
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const ax=Number(poly[j]?.[0]),ay=Number(poly[j]?.[1]),bx=Number(poly[i]?.[0]),by=Number(poly[i]?.[1]);
    if(![ax,ay,bx,by].every(Number.isFinite))continue;
    const vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy;
    const t=den>1e-12?THREE.MathUtils.clamp(((x-ax)*vx+(y-ay)*vy)/den,0,1):0;
    const dx=x-(ax+vx*t),dy=y-(ay+vy*t);
    if(dx*dx+dy*dy<=tol2)return true;
  }
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=Number(poly[i]?.[0]),yi=Number(poly[i]?.[1]),xj=Number(poly[j]?.[0]),yj=Number(poly[j]?.[1]);
    if(![xi,yi,xj,yj].every(Number.isFinite))continue;
    const hit=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);
    if(hit)inside=!inside;
  }
  return inside;
}
function curvedReliefFitsWoodMm(relief,localToWorld,hostPolygon){
  if(!relief||typeof localToWorld!=='function'||!Array.isArray(hostPolygon)||hostPolygon.length<3)return true;
  // v64 — cada entrada é validada separadamente. Se qualquer trecho da cápsula
  // sair para fora do contorno da madeira, aquele alívio não é criado.
  return (relief.seq||[]).every(([u,v])=>curvedPointInOrOnPolygonMm(localToWorld(u,v),hostPolygon,.55));
}
function curvedSlotPolygonMm(cfg,sample,postThickness,clearance,visualInset=0,hostPolygon=null){
  const band=Math.max(1,Number(cfg.band)||50);
  const rawDepth=Math.min(band,Math.max(1,Number(cfg.jointDepth)||band/2));
  const inset=Math.max(0,Math.min(rawDepth/3,Number(visualInset)||0));
  const depth=Math.max(.2,rawDepth-inset*2),rawTw=Math.max(1,Number(postThickness)+Number(clearance||0)),tw=Math.max(.2,rawTw-inset*2);
  const tx=sample.tx,tz=sample.tz,nx=sample.nx,nz=sample.nz;
  const ht=tw/2;
  const deep=band/2-rawDepth+inset,outer=band/2-inset;
  const innerLimit=-band/2+inset;
  const local=(u,v)=>[sample.x+tx*u+nx*v,sample.z+tz*u+nz*v];
  const mode=['single','double','none'].includes(cfg.reliefMode)?cfg.reliefMode:'single';
  if(mode==='none')return [local(-ht,deep),local(ht,deep),local(ht,outer),local(-ht,outer)];

  // v64 — a entrada continua diagonal, porém só existe se houver madeira real
  // no lado para onde ela avança. Nas pontas/recortes do móvel, uma entrada que
  // cairia no vazio é automaticamente ignorada, sem criar linguetas/loops feios.
  const requestedDia=Math.max(.8,Number(cfg.reliefDiameter)||6);
  const diaByWidth=mode==='double'?Math.max(.8,tw*.42):Math.max(.8,tw*.82);
  const diaByDepth=Math.max(.8,rawDepth*1.25);
  const entryDia=Math.max(.8,Math.min(requestedDia,diaByWidth,diaByDepth));
  const diagonalRoom=Math.max(entryDia,(deep-innerLimit)*Math.SQRT2-.5);
  const requestedLen=Math.max(.5,Number(cfg.reliefLength)||18);
  const entryLen=Math.min(requestedLen,diagonalRoom);
  if(entryLen<.5)return [local(-ht,deep),local(ht,deep),local(ht,outer),local(-ht,outer)];

  const q=Math.SQRT1_2,pts=[];
  pts.push(local(-ht,outer),local(ht,outer));

  const right=curvedDiagonalReliefSequence2D(ht,deep,q,-q,q,q,entryDia,entryLen,14);
  const rightOk=curvedReliefFitsWoodMm(right,local,hostPolygon);
  if(rightOk)for(const [u,v] of right.seq)pts.push(local(u,v));
  else pts.push(local(ht,deep));

  if(mode==='double'){
    const left=curvedDiagonalReliefSequence2D(-ht,deep,-q,-q,q,-q,entryDia,entryLen,14);
    const leftOk=curvedReliefFitsWoodMm(left,local,hostPolygon);
    if(leftOk)for(const [u,v] of left.seq)pts.push(local(u,v));
    else pts.push(local(-ht,deep));
  }else{
    pts.push(local(-ht,deep));
  }
  pts.push(local(-ht,outer));
  return pts;
}
function curvedPostOutlineMm(cfg){
  const W=Math.max(1,Number(cfg.postWidth)||100),H=Math.max(1,Number(cfg.height)||900);
  const T=Math.max(1,Number(cfg.thickness)||18),clear=Math.max(0,Number(cfg.slotClearance)||0);
  const depth=Math.min(W-.001,Math.max(1,Number(cfg.jointDepth)||25));
  const ribs=Math.max(2,Math.round(Number(cfg.ribs)||3)),intervals=[];
  for(let i=0;i<ribs;i++){
    const y=(ribs===1?0:(H-T)*(i/(ribs-1)));
    intervals.push([Math.max(0,y-clear/2),Math.min(H,y+T+clear/2)]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const iv of intervals){
    const last=merged.at(-1);
    if(last&&iv[0]<=last[1]+.001)last[1]=Math.max(last[1],iv[1]);
    else merged.push([...iv]);
  }

  // v62 — no montante de 100 mm o alívio também sai em diagonal.
  // 1 entrada = canto inferior interno; 2 entradas = superior + inferior; sem = quadrado.
  const mode=['single','double','none'].includes(cfg.reliefMode)?cfg.reliefMode:'single';
  const requestedDia=Math.max(.8,Number(cfg.reliefDiameter)||6);
  const requestedLen=Math.max(.5,Number(cfg.reliefLength)||18);
  const eps=.001,q=Math.SQRT1_2,pts=[];
  const push=(pt)=>{
    if(!pt)return;
    const last=pts.at(-1);
    if(last&&Math.abs(last[0]-pt[0])<1e-6&&Math.abs(last[1]-pt[1])<1e-6)return;
    pts.push(pt);
  };
  const first=merged[0],topOpen=!!first&&first[0]<=eps;
  push([topOpen?depth:0,0]);
  let cy=0;

  for(const [y0,y1] of merged){
    const topInternal=y0>eps,bottomInternal=y1<H-eps;
    const slotH=Math.max(.5,y1-y0);
    const diaBySlot=mode==='double'?Math.max(.8,slotH*.42):Math.max(.8,slotH*.82);
    const diaByDepth=Math.max(.8,depth*1.25);
    const entryDia=Math.max(.8,Math.min(requestedDia,diaBySlot,diaByDepth));
    const room=Math.max(entryDia,(W-depth)*Math.SQRT2-.5);
    const entryLen=Math.min(requestedLen,room);
    const canRelief=mode!=='none'&&entryLen>=.5;
    const rectFits=rel=>(rel?.seq||[]).every(([x,y])=>x>=-eps&&x<=W+eps&&y>=-eps&&y<=H+eps);
    const topRel=canRelief&&mode==='double'&&topInternal?curvedDiagonalReliefSequence2D(depth,y0,q,-q,-q,-q,entryDia,entryLen,14):null;
    const bottomRel=canRelief&&bottomInternal?curvedDiagonalReliefSequence2D(depth,y1,q,q,q,-q,entryDia,entryLen,14):null;
    const doTop=!!topRel&&rectFits(topRel);
    const doBottom=!!bottomRel&&rectFits(bottomRel);

    if(topInternal){
      if(y0>cy+eps)push([0,y0]);
      if(doTop){
        // v64: só abre o alívio se toda a entrada continuar dentro da madeira.
        topRel.seq.forEach(push);
      }else push([depth,y0]);
    }else if(Math.abs(y0)>eps){
      push([depth,y0]);
    }

    const offset=Math.SQRT2*(entryDia/2);
    const wallTop=doTop?Math.min(y1,y0+offset):y0;
    const wallBottom=doBottom?Math.max(wallTop,y1-offset):y1;
    if(wallBottom>wallTop+eps)push([depth,wallBottom]);

    if(bottomInternal){
      if(doBottom){
        // v64: idem para a entrada inferior; se cair no vazio, fica sem alívio.
        bottomRel.seq.forEach(push);
      }
      push([0,y1]);
    }else{
      push([depth,y1]);
    }
    cy=y1;
  }

  if(cy<H-eps)push([0,H]);
  push([W,H]);push([W,0]);
  return {points:pts,bboxW:W,bboxH:H};
}
function makeManualEdgeGroupFromLoops(loops,depth,opts={}){
  const group=new THREE.Group();
  group.userData.isVisualEdge=true;
  const color=opts.color??0x080808, opacity=opts.opacity??(xray3DActive()?.86:.96);
  const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:opts.depthTest??!xray3DActive(),depthWrite:false});
  group.material=mat; // compatibilidade com as rotinas globais de Raio-X/2D
  const z0=-depth/2,z1=depth/2;
  for(const loop of loops){
    if(!Array.isArray(loop)||loop.length<2)continue;
    const front=[],back=[];
    for(const p of loop){front.push(new THREE.Vector3(p[0],p[1],z0));back.push(new THREE.Vector3(p[0],p[1],z1));}
    front.push(front[0].clone());back.push(back[0].clone());
    const lf=new THREE.Line(new THREE.BufferGeometry().setFromPoints(front),mat);
    const lb=new THREE.Line(new THREE.BufferGeometry().setFromPoints(back),mat);
    lf.userData.isVisualEdge=lb.userData.isVisualEdge=true;group.add(lf,lb);
    const seg=[];
    for(const p of loop){seg.push(new THREE.Vector3(p[0],p[1],z0),new THREE.Vector3(p[0],p[1],z1));}
    const side=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),mat);side.userData.isVisualEdge=true;group.add(side);
  }
  group.renderOrder=xray3DActive()?88:12;
  group.traverse(o=>{if(o.material)o.renderOrder=group.renderOrder;});
  return group;
}
function makeManualCurvedRibEdges(pts,slots,cx,cz,T){
  const conv=poly=>poly.map(([px,pz])=>[(px-cx)*MM_TO_M,-(pz-cz)*MM_TO_M]);
  return makeManualEdgeGroupFromLoops([conv(pts),...(slots||[]).map(conv)],T*MM_TO_M,{color:0x080808});
}
function makeManualCurvedCoverEdges(pairs,H){
  const group=new THREE.Group();group.userData.isVisualEdge=true;
  const mat=new THREE.LineBasicMaterial({color:0x17120c,transparent:true,opacity:.82,depthTest:!xray3DActive(),depthWrite:false});
  group.material=mat; // compatibilidade com as rotinas globais de Raio-X/2D
  const y0=-H*MM_TO_M/2,y1=H*MM_TO_M/2;
  const paths=[
    pairs.map(p=>new THREE.Vector3(p.ox*MM_TO_M,y0,p.oz*MM_TO_M)),
    pairs.map(p=>new THREE.Vector3(p.ox*MM_TO_M,y1,p.oz*MM_TO_M)),
    pairs.map(p=>new THREE.Vector3(p.ix*MM_TO_M,y0,p.iz*MM_TO_M)),
    pairs.map(p=>new THREE.Vector3(p.ix*MM_TO_M,y1,p.iz*MM_TO_M))
  ];
  for(const arr of paths){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),mat);l.userData.isVisualEdge=true;group.add(l);}
  if(pairs.length){
    const ends=[pairs[0],pairs[pairs.length-1]],seg=[];
    for(const p of ends){
      const o0=new THREE.Vector3(p.ox*MM_TO_M,y0,p.oz*MM_TO_M),o1=new THREE.Vector3(p.ox*MM_TO_M,y1,p.oz*MM_TO_M),i0=new THREE.Vector3(p.ix*MM_TO_M,y0,p.iz*MM_TO_M),i1=new THREE.Vector3(p.ix*MM_TO_M,y1,p.iz*MM_TO_M);
      seg.push(o0,o1,o1,i1,i1,i0,i0,o0);
    }
    const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),mat);ls.userData.isVisualEdge=true;group.add(ls);
  }
  group.renderOrder=xray3DActive()?88:12;return group;
}
function createCurvedPost({cfg,yBase=0,x=0,z=0,name='Montante curvo',spaceRootId=null,rotationY=0}={},doHistory=true){
  const prof=curvedPostOutlineMm(cfg),W=Math.max(1,Number(cfg.postWidth)||100),H=Math.max(1,Number(cfg.height)||900),T=Math.max(1,Number(cfg.thickness)||18);
  const shape=new THREE.Shape();
  prof.points.forEach(([px,py],i)=>{const sx=(px-W/2)*MM_TO_M,sy=(py-H/2)*MM_TO_M;if(i===0)shape.moveTo(sx,sy);else shape.lineTo(sx,sy);});shape.closePath();
  const geom=new THREE.ExtrudeGeometry(shape,{depth:T*MM_TO_M,bevelEnabled:false,steps:1,curveSegments:4});
  geom.translate(0,0,-T*MM_TO_M/2);geom.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:COLORS.panel,roughness:.72,metalness:0,side:THREE.DoubleSide,flatShading:false});
  const mesh=new THREE.Mesh(geom,mat);mesh.rotation.y=Number(rotationY)||0;mesh.position.set(x,yBase+H*MM_TO_M/2,z);
  mesh.userData={kind:'panel',name,materialType:'MDF',baseColor:COLORS.panel,materialId:null,materialCode:'',materialGrain:false,materialCoreColor:null,edgeBands:{},partId:uid('part'),labelMeta:{schemaVersion:1,enabled:true,custom:{}},faceMaterials:[mat],spaceRootId:spaceRootId||null,machining:[],curvedRole:'post',curvedConfig:JSON.parse(JSON.stringify(cfg)),width:W*MM_TO_M,depth:T*MM_TO_M,height:H*MM_TO_M,rotationY:Number(rotationY)||0};
  mesh.castShadow=true;mesh.receiveShadow=true;
  // bordas manuais do perfil; nenhuma aresta de triangulação interna é desenhada.
  const postLoop=prof.points.map(([px,py])=>[(px-W/2)*MM_TO_M,(py-H/2)*MM_TO_M]);
  const edges=makeManualEdgeGroupFromLoops([postLoop],T*MM_TO_M,{color:0x080808});edges.visible=true;mesh.add(edges);mesh.userData.visualEdges=edges;
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});
  scene.add(mesh);objects.push(mesh);selectObject(mesh);if(doHistory)commitHistory();return mesh;
}
function curvedRibPartSlotSamples(cfg,part){
  const out=[],samples=curvedPostSamplesMm(cfg),split=curvedSplitInfo(cfg);
  for(const sample of samples){
    if(part==='full')out.push(sample);
    else if(part==='straight'){
      if(sample.s<split.splitX-.001)out.push(sample);
    }else if(part==='curve'){
      if(sample.s>=split.splitX-.001)out.push(sample);
    }
  }
  return out;
}
function createCurvedRib({cfg,yBase=0,x=0,z=0,name='Nervura curva',spaceRootId=null,index=1,part='full'}={},doHistory=true){
  const pts=curvedProfilePointsMm(cfg,part);if(pts.length<3)return null;
  const samples=curvedRibPartSlotSamples(cfg,part),slots=[];
  if(cfg.createSlots!==false)for(const sample of samples)slots.push(curvedSlotPolygonMm(cfg,sample,Number(cfg.thickness),Number(cfg.slotClearance)||0,0,pts));
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),BW=maxX-minX,BH=maxZ-minZ,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,T=Number(cfg.thickness);
  const shape=new THREE.Shape();
  pts.forEach(([px,pz],i)=>{const lx=(px-cx)*MM_TO_M,ly=-(pz-cz)*MM_TO_M;if(i===0)shape.moveTo(lx,ly);else shape.lineTo(lx,ly);});shape.closePath();
  if(cfg.createSlots!==false){
    for(const sample of samples){
      const poly=curvedSlotPolygonMm(cfg,sample,Number(cfg.thickness),Number(cfg.slotClearance)||0,.18,pts),hole=new THREE.Path();
      poly.slice().reverse().forEach(([px,pz],j)=>{const lx=(px-cx)*MM_TO_M,ly=-(pz-cz)*MM_TO_M;if(j===0)hole.moveTo(lx,ly);else hole.lineTo(lx,ly);});hole.closePath();shape.holes.push(hole);
    }
  }
  const geom=new THREE.ExtrudeGeometry(shape,{depth:T*MM_TO_M,bevelEnabled:false,steps:1,curveSegments:160});geom.translate(0,0,-T*MM_TO_M/2);geom.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:COLORS.panel,roughness:.72,metalness:0,side:THREE.DoubleSide,flatShading:false});
  const mesh=new THREE.Mesh(geom,mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x+(cx-cfg.targetW/2)*MM_TO_M,yBase+T*MM_TO_M/2,z+(cz-cfg.targetD/2)*MM_TO_M);
  const normalizedPts=pts.map(([px,pz])=>[px-minX,pz-minZ]),normalizedSlots=slots.map(poly=>poly.map(([px,pz])=>[px-minX,pz-minZ]));
  const role=part==='full'?'rib':part==='curve'?'rib-curve':'rib-straight';
  mesh.userData={kind:'curved-panel',name,materialType:'MDF',baseColor:COLORS.panel,materialId:null,materialCode:'',materialGrain:false,materialCoreColor:null,edgeBands:{},partId:uid('part'),labelMeta:{schemaVersion:1,enabled:true,custom:{}},faceMaterials:[mat],spaceRootId:spaceRootId||null,machining:[],curvedRole:role,curvedPart:part,curvedTargetX:x,curvedTargetZ:z,width:BW*MM_TO_M,depth:BH*MM_TO_M,height:T*MM_TO_M,customProfile:{type:'quarter-rail',part,points:normalizedPts,slots:normalizedSlots,bboxW:BW,bboxH:BH,cfg:JSON.parse(JSON.stringify(cfg))}};
  mesh.castShadow=true;mesh.receiveShadow=true;
  // v73: contorno explícito da nervura + encaixes, sem diagonais internas da triangulação.
  const edges=makeManualCurvedRibEdges(pts,slots,cx,cz,T);edges.visible=true;mesh.add(edges);mesh.userData.visualEdges=edges;
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});
  scene.add(mesh);objects.push(mesh);selectObject(mesh);if(doHistory)commitHistory();return mesh;
}
function curvedCoverPathPairsMm(cfg,part='full'){
  const a=Math.max(0,Number(cfg.straightA)||0),b=Math.max(0,Number(cfg.straightB)||0),R=Math.max(10,Number(cfg.radius)||500),t=Math.max(.1,Number(cfg.coverThickness)||6),seg=120,pairs=[];
  const split=(part==='full')?0:curvedSplitInfo(cfg).splitX;
  const add=(ox,oz,ix,iz)=>{const o=curvedTransformPointMm(cfg,ox,oz),inn=curvedTransformPointMm(cfg,ix,iz);pairs.push({ox:o.x,oz:o.z,ix:inn.x,iz:inn.z});};
  if(part==='straight'){
    if(split<=.001)return [];
    add(0,0,0,t);add(split,0,split,t);return pairs;
  }
  const x0=part==='curve'?split:0;
  add(x0,0,x0,t);add(a,0,a,t);
  for(let i=1;i<=seg;i++){
    const ang=-Math.PI/2+(Math.PI/2)*(i/seg);
    add(a+R*Math.cos(ang),R+R*Math.sin(ang),a+(R-t)*Math.cos(ang),R+(R-t)*Math.sin(ang));
  }
  if(b>.001)add(a+R,R+b,a+R-t,R+b);
  return pairs;
}
function curvedCoverDevelopedLengthMm(cfg,part='full'){
  const a=Math.max(0,Number(cfg.straightA)||0),b=Math.max(0,Number(cfg.straightB)||0),R=Math.max(10,Number(cfg.radius)||500),t=Math.max(.1,Number(cfg.coverThickness)||6),neutral=Math.max(.1,R-t/2),split=curvedSplitInfo(cfg).splitX;
  if(part==='straight')return Math.max(0,split);
  if(part==='curve')return Math.max(0,a-split)+neutral*Math.PI/2+b;
  return a+neutral*Math.PI/2+b;
}
function createCurvedCover({cfg,yBase=0,x=0,z=0,name='Capa externa curva',spaceRootId=null,part='full'}={},doHistory=true){
  const pairs=curvedCoverPathPairsMm(cfg,part);if(pairs.length<2)return null;
  const H=Math.max(1,Number(cfg.height)||900),T=Math.max(.1,Number(cfg.coverThickness)||6),W=Number(cfg.targetW),D=Number(cfg.targetD),verts=[],idx=[];
  for(const p of pairs){
    const ox=(p.ox-W/2)*MM_TO_M,oz=(p.oz-D/2)*MM_TO_M,ix=(p.ix-W/2)*MM_TO_M,iz=(p.iz-D/2)*MM_TO_M,y0=-H*MM_TO_M/2,y1=H*MM_TO_M/2;
    verts.push(ox,y0,oz, ox,y1,oz, ix,y0,iz, ix,y1,iz);
  }
  for(let i=0;i<pairs.length-1;i++){
    const a=i*4,b=(i+1)*4;
    idx.push(a,b,b+1,a,b+1,a+1);              // face externa
    idx.push(a+2,a+3,b+3,a+2,b+3,b+2);        // face interna
    idx.push(a+1,b+1,b+3,a+1,b+3,a+3);        // topo
    idx.push(a,a+2,b+2,a,b+2,b);              // base
  }
  const s0=0,se=(pairs.length-1)*4;idx.push(s0,s0+1,s0+3,s0,s0+3,s0+2);idx.push(se,se+2,se+3,se,se+3,se+1);
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.setIndex(idx);geom.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:0xc9b28d,roughness:.76,metalness:0,side:THREE.DoubleSide,flatShading:false});
  const mesh=new THREE.Mesh(geom,mat);mesh.position.set(x,yBase+H*MM_TO_M/2,z);
  const dev=curvedCoverDevelopedLengthMm(cfg,part);
  mesh.userData={kind:'panel',name,materialType:'MDF flexível',baseColor:0xc9b28d,materialId:null,materialCode:'',materialGrain:false,materialCoreColor:null,edgeBands:{},partId:uid('part'),labelMeta:{schemaVersion:1,enabled:true,custom:{}},faceMaterials:[mat],spaceRootId:spaceRootId||null,machining:[],curvedRole:'cover',curvedPart:part,curvedConfig:{...JSON.parse(JSON.stringify(cfg)),coverPart:part},width:dev*MM_TO_M,depth:T*MM_TO_M,height:H*MM_TO_M};
  mesh.castShadow=true;mesh.receiveShadow=true;
  // v74: capa com apenas as quatro bordas longitudinais e as duas extremidades.
  const localPairs=pairs.map(p=>({ox:p.ox-W/2,oz:p.oz-D/2,ix:p.ix-W/2,iz:p.iz-D/2}));
  const edges=makeManualCurvedCoverEdges(localPairs,H);mesh.add(edges);mesh.userData.visualEdges=edges;
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});
  scene.add(mesh);objects.push(mesh);selectObject(mesh);if(doHistory)commitHistory();return mesh;
}
function curvedExistingConfig(root){
  if(!root)return null;
  const candidates=objects.filter(o=>o.userData?.spaceRootId===root.id&&(o.userData?.curvedRole||o.userData?.kind==='curved-panel'||/^Montante curvo/i.test(o.userData?.name||'')));
  // Prefere nervura: guarda a configuração-base completa sem campos específicos de capa/montante.
  const rib=candidates.find(o=>o.userData?.kind==='curved-panel'&&o.userData?.customProfile?.cfg);
  const src=rib?.userData?.customProfile?.cfg
    || candidates.find(o=>o.userData?.curvedRole==='cover'&&o.userData?.curvedConfig)?.userData?.curvedConfig
    || candidates.find(o=>o.userData?.curvedRole==='post'&&o.userData?.curvedConfig)?.userData?.curvedConfig;
  return src?JSON.parse(JSON.stringify(src)):null;
}
function curvedTargetUsingExisting(root,cfg,fallback){
  if(!root||!cfg)return fallback;
  const cell=cfg.targetCellId?getSpaceCell(root.id,cfg.targetCellId):null;
  if(cell)return {root,cell,width:cell.maxX-cell.minX,depth:cell.maxZ-cell.minZ,height:cell.maxY-cell.minY,x:(cell.minX+cell.maxX)/2,z:(cell.minZ+cell.maxZ)/2,yBase:cell.minY,label:`${root.name} · divisão`};
  return fallback;
}
function setCurvedFormFromConfig(c){
  if(!c)return;
  const set=(id,v)=>{const el=$(id);if(el&&v!==undefined&&v!==null&&Number.isFinite(Number(v)))el.value=nice(Number(v));};
  set('curvedRadius',c.radius); set('curvedBand',c.band); set('curvedThickness',c.thickness);
  set('curvedRibs',c.ribs); set('curvedPosts',Math.max(4,Number(c.posts)||5)); set('curvedPostWidth',c.postWidth);
  set('curvedJointDepth',c.jointDepth); set('curvedSlotClearance',c.slotClearance);
  set('curvedReliefDiameter',c.reliefDiameter??6); set('curvedReliefLength',c.reliefLength??18); set('curvedCurveEndInset',c.curveEndInset??CURVED_CURVE_END_INSET_MM); set('curvedEndAInset',c.endAInset??CURVED_END_A_INSET_MM); set('curvedEndBInset',c.endBInset??CURVED_END_B_INSET_MM);
  if($('curvedReliefMode'))$('curvedReliefMode').value=['single','double','none'].includes(c.reliefMode)?c.reliefMode:'single';
  set('curvedCoverThickness',c.coverThickness); set('curvedSplitTail',c.splitTail);
  if($('curvedCreateSlots'))$('curvedCreateSlots').checked=c.createSlots!==false;
  if($('curvedCreateCover'))$('curvedCreateCover').checked=c.createCover!==false;
  if($('curvedSplitStructure'))$('curvedSplitStructure').checked=!!c.splitStructure;
  curvedOrientation=c.orientation||'front-right';
  document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.classList.toggle('active',b.dataset.curvedOrientation===curvedOrientation));
}
function openCurvedStructureDialog(){
  if(curved3DPreviewActive)returnCurvedStructurePreview({reopen:false});
  curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  let target=curvedSelectedTarget();if(!target){toast('Selecione primeiro o espaço ou uma peça do móvel curvo');return false;}
  const existingCfg=curvedExistingConfig(target.root);
  if(existingCfg)target=curvedTargetUsingExisting(target.root,existingCfg,target);
  curvedTargetRootId=target.root.id;curvedTargetCellId=target.cell?.id||null;
  curvedEditingExisting=!!existingCfg;
  if(existingCfg)setCurvedFormFromConfig(existingCfg);
  else document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.classList.toggle('active',b.dataset.curvedOrientation===curvedOrientation));
  const W=mm(target.width),D=mm(target.depth),H=mm(target.height),minSide=Math.min(W,D);let r=parseDecimalInput($('curvedRadius')?.value);
  if(!Number.isFinite(r)||r<20||r>=minSide)r=Math.max(20,Math.min(minSide-1,Math.round(minSide*.7)));$('curvedRadius').value=nice(r);
  let band=parseDecimalInput($('curvedBand')?.value);if(!Number.isFinite(band)||band<20||band>=r)$('curvedBand').value=nice(Math.max(20,Math.min(r-1,50)));
  $('curvedTargetSpaceInfo').innerHTML=`<b>${target.label}</b><br>L ${nice(W)} × P ${nice(D)} × A ${nice(H)} mm · base ${nice(mm(target.yBase))} mm do chão`;
  if($('curvedDialogTitle'))$('curvedDialogTitle').textContent=curvedEditingExisting?'◒ Editar móvel curvo':'◒ Móvel curvo no espaço';
  if($('curvedDialogHelp'))$('curvedDialogHelp').textContent=curvedEditingExisting?'Altere qualquer configuração abaixo. Ao salvar, o conjunto existente será reconstruído no mesmo espaço.':'A estrutura usa automaticamente as medidas do espaço/divisão selecionado. Você configura somente a geometria da curva e a estrutura interna.';
  if($('curvedEditStatus')){
    $('curvedEditStatus').style.display=curvedEditingExisting?'block':'none';
    $('curvedEditStatus').innerHTML=curvedEditingExisting?'<b>EDITANDO ESTRUTURA EXISTENTE</b><br>Raio, réguas, nervuras, capa, encaixes e divisão em 2 partes podem ser alterados.':'';
  }
  if($('confirmCurvedStructure'))$('confirmCurvedStructure').textContent=curvedEditingExisting?'Salvar alterações':'Criar no espaço';
  $('curvedStructureDialog').style.display='flex';updateCurvedStructurePreview();return true;
}
function curvedFieldNumber(id,fallback){
  const v=parseDecimalInput($(id)?.value);
  return Number.isFinite(v)?v:Number(fallback);
}
function curvedFormConfig(){
  const target=curvedTargetFromStored();if(!target)throw new Error('Selecione um espaço');
  const W=mm(target.width),D=mm(target.depth),H=mm(target.height);
  // v79: raio de 150 mm e campos auxiliares vazios não bloqueiam a criação.
  const R=curvedFieldNumber('curvedRadius',150);
  const createCover=!!$('curvedCreateCover')?.checked;
  const createSlots=!!$('curvedCreateSlots')?.checked;
  const splitStructure=!!$('curvedSplitStructure')?.checked;
  return {
    name:target.root.name||'Móvel curvo',
    height:H,
    straightA:W-R,
    radius:R,
    straightB:D-R,
    band:curvedFieldNumber('curvedBand',50),
    thickness:curvedFieldNumber('curvedThickness',18),
    ribs:Math.round(curvedFieldNumber('curvedRibs',3)),
    posts:Math.round(curvedFieldNumber('curvedPosts',5)),
    postWidth:curvedFieldNumber('curvedPostWidth',100),
    jointDepth:curvedFieldNumber('curvedJointDepth',25),
    slotClearance:curvedFieldNumber('curvedSlotClearance',0.5),
    reliefMode:['single','double','none'].includes($('curvedReliefMode')?.value)?$('curvedReliefMode').value:'single',
    reliefDiameter:curvedFieldNumber('curvedReliefDiameter',6),
    reliefLength:curvedFieldNumber('curvedReliefLength',18),
    curveEndInset:curvedFieldNumber('curvedCurveEndInset',CURVED_CURVE_END_INSET_MM),
    endAInset:curvedFieldNumber('curvedEndAInset',CURVED_END_A_INSET_MM),
    endBInset:curvedFieldNumber('curvedEndBInset',CURVED_END_B_INSET_MM),
    orientation:curvedOrientation,
    floor:mm(target.yBase),
    createSlots,
    createCover,
    coverThickness:curvedFieldNumber('curvedCoverThickness',6),
    splitStructure,
    splitTail:curvedFieldNumber('curvedSplitTail',60),
    targetW:W,targetD:D,targetRootId:target.root.id,targetCellId:target.cell?.id||null
  };
}
function validateCurvedConfig(c){
  const required=[
    ['altura',c.height],['trecho reto frontal',c.straightA],['raio',c.radius],
    ['trecho reto lateral',c.straightB],['largura da nervura',c.band],
    ['espessura do MDF',c.thickness],['nervuras',c.ribs],['montantes',c.posts],
    ['largura do montante',c.postWidth],['encaixe',c.jointDepth],
    ['folga do encaixe',c.slotClearance],['Ø da entrada',c.reliefDiameter],['comprimento da entrada',c.reliefLength],['recuo do final da curva',c.curveEndInset],['distância do montante lado A',c.endAInset],['distância do montante lado B',c.endBInset],['altura do chão',c.floor],
    ['largura do espaço',c.targetW],['profundidade do espaço',c.targetD],
    ['espessura da capa',c.coverThickness],['sobra da emenda',c.splitTail]
  ];
  const invalid=required.find(([,v])=>!Number.isFinite(v));
  if(invalid)throw new Error(`Confira ${invalid[0]}`);
  if(c.radius<20||c.radius>Math.min(c.targetW,c.targetD))throw new Error(`O raio deve ficar entre 20 e ${nice(Math.min(c.targetW,c.targetD))} mm`);
  if(c.straightA<-.001||c.straightB<-.001)throw new Error('O raio é maior que o espaço selecionado');
  if(c.coverThickness<1)throw new Error('A capa externa deve ter pelo menos 1 mm');
  const availableRadius=c.radius-(c.createCover?c.coverThickness:0);
  if(c.band<20||c.band>=availableRadius)throw new Error('A nervura + capa precisam caber dentro do raio');
  if(c.thickness<3||c.ribs<2||c.posts<4||c.postWidth<20)throw new Error('Confira espessura, nervuras e montantes (mínimo 4)');
  if(c.reliefDiameter<1||c.reliefDiameter>20)throw new Error('Ø da entrada da fresa deve ficar entre 1 e 20 mm');
  if(c.reliefLength<.5||c.reliefLength>60)throw new Error('Comprimento da entrada deve ficar entre 0,5 e 60 mm');
  if(c.curveEndInset<0||c.curveEndInset>100)throw new Error('Recuo do final da curva deve ficar entre 0 e 100 mm');
  if(c.endAInset<0||c.endAInset>500||c.endBInset<0||c.endBInset>500)throw new Error('A distância dos últimos montantes deve ficar entre 0 e 500 mm');
  if(c.jointDepth<=0||c.jointDepth>c.band||c.jointDepth>c.postWidth)throw new Error('O encaixe deve caber na nervura e no montante');
  if(c.height<c.thickness*2)throw new Error('Altura do espaço pequena para as nervuras');
  if(c.splitTail<0)throw new Error('A sobra da emenda não pode ser negativa');
  if(c.splitStructure){
    const sp=curvedSplitInfo(c);
    if(!sp.valid)throw new Error(sp.reason||'Não foi possível calcular a emenda em 2 partes');
  }
  return c;
}
function updateCurvedStructurePreview(){
  try{
    const c=validateCurvedConfig(curvedFormConfig()),devFull=curvedCoverDevelopedLengthMm(c,'full'),sp=curvedSplitInfo(c);
    if($('curvedCoverInfo'))$('curvedCoverInfo').value=c.createCover?`${nice(devFull)} × ${nice(c.height)} mm`:'desligada';
    $('curvedCoverThickness').disabled=!c.createCover;
    $('curvedSplitTail').disabled=!c.splitStructure;
    if($('curvedReliefMode'))$('curvedReliefMode').disabled=!c.createSlots;
    if($('curvedReliefDiameter'))$('curvedReliefDiameter').disabled=!c.createSlots||c.reliefMode==='none';
    if($('curvedReliefLength'))$('curvedReliefLength').disabled=!c.createSlots||c.reliefMode==='none';
    if($('curvedSplitInfo'))$('curvedSplitInfo').value=c.splitStructure?`${nice(sp.splitX)} mm`:'inteira';
    const splitText=c.splitStructure
      ?`2 PARTES · espaço de emenda ${nice(c.splitTail)} mm · corte em ${nice(sp.splitX)} mm<br>Parte reta: ${nice(sp.straightLength)} mm · parte curva mantém ${nice(sp.curveTail)} mm retos antes do arco`
      :'INTEIRA';
    $('curvedStructurePreview').innerHTML=`Ocupa exatamente: <b>${nice(c.targetW)} × ${nice(c.targetD)} × ${nice(c.height)} mm</b><br><b>${curvedOrientationName(c.orientation)}</b> · raio final externo ${nice(c.radius)} mm · nervura ${nice(c.band)} mm${c.createCover?` recuada ${nice(c.coverThickness)} mm para receber a capa`:''}<br>Montante ${nice(c.postWidth)} mm · encaixe ${nice(c.jointDepth)} mm nas duas peças<br>${c.ribs} nervura(s) MDF ${nice(c.thickness)} mm · ${c.posts} montante(s) no total<br><b>Montantes fixos:</b> ponta A a ${nice(c.endAInset)} mm da borda + centro da curva + final da curva recuado ${nice(c.curveEndInset)} mm + ponta B a ${nice(c.endBInset)} mm da borda<br>Montantes extras: divisão equilibrada somente nos vãos retos livres${c.splitStructure?` · em 2 partes preserva ${nice(c.splitTail)} mm da emenda`:''}<br>Entrada da fresa: <b>${c.reliefMode==='none'?'sem alívio':`${c.reliefMode==='double'?'2 entradas diagonais':'1 entrada diagonal'} · Ø${nice(c.reliefDiameter)} × ${nice(c.reliefLength)} mm`}</b><br>Capa externa: <b>${c.createCover?`${nice(c.coverThickness)} mm · desenvolvimento ${nice(devFull)} mm`:'NÃO'}</b><br>Estrutura: <b>${splitText}</b>`;
  }catch(err){
    if($('curvedSplitTail'))$('curvedSplitTail').disabled=!$('curvedSplitStructure')?.checked;
    const slotsOn=!!$('curvedCreateSlots')?.checked,reliefOn=$('curvedReliefMode')?.value!=='none';
    if($('curvedReliefMode'))$('curvedReliefMode').disabled=!slotsOn;
    if($('curvedReliefDiameter'))$('curvedReliefDiameter').disabled=!slotsOn||!reliefOn;
    if($('curvedReliefLength'))$('curvedReliefLength').disabled=!slotsOn||!reliefOn;
    if($('curvedSplitInfo'))$('curvedSplitInfo').value='—';
    $('curvedStructurePreview').textContent=err.message||'Confira as medidas';
  }
}
function removeExistingCurvedStructure(root){
  const doomed=objects.filter(o=>o.userData?.spaceRootId===root.id&&(o.userData?.curvedRole||o.userData?.kind==='curved-panel'||/^Montante curvo/i.test(o.userData?.name||'')));
  removeHardwareLinkedToObjects(doomed);
  for(const o of doomed){if(selected===o)selected=null;disposeObject(o);const idx=objects.indexOf(o);if(idx>=0)objects.splice(idx,1);}renderMachiningVisuals();return doomed.length;
}
function buildCurvedStructureObjects(c,target){
  const root=target.root,H=target.height,T=c.thickness*MM_TO_M,xCenter=target.x,zCenter=target.z,yBase=target.yBase;
  removeExistingCurvedStructure(root);
  for(let i=0;i<c.ribs;i++){
    const yy=yBase+(c.ribs===1?0:(H-T)*(i/(c.ribs-1)));
    if(c.splitStructure){
      createCurvedRib({cfg:c,yBase:yy,x:xCenter,z:zCenter,name:`Nervura curva ${i+1}`,spaceRootId:root.id,index:i+1,part:'curve'},false);
      createCurvedRib({cfg:c,yBase:yy,x:xCenter,z:zCenter,name:`Nervura reta ${i+1}`,spaceRootId:root.id,index:i+1,part:'straight'},false);
    }else createCurvedRib({cfg:c,yBase:yy,x:xCenter,z:zCenter,name:`Nervura curva ${i+1}`,spaceRootId:root.id,index:i+1,part:'full'},false);
  }
  const postSamples=curvedPostSamplesMm(c);
  let extraNo=0;
  for(const sample of postSamples){
    const plc=curvedPostPlacementFromSampleMm(c,sample),x=xCenter+(plc.x-c.targetW/2)*MM_TO_M,z=zCenter+(plc.z-c.targetD/2)*MM_TO_M;
    const nm=sample.structuralTag==='end-a'?`Montante final A - ${c.endAInset>0?`${nice(c.endAInset)} mm da borda`:'rente'}`:sample.structuralTag==='end-b'?`Montante final B - ${c.endBInset>0?`${nice(c.endBInset)} mm da borda`:'rente'}`:sample.structuralTag==='curve-mid'?'Montante curva - centro':sample.structuralTag==='curve-end-inset'?`Montante curva - final recuado ${nice(c.curveEndInset)} mm`:sample.structuralTag==='straight-a'?`Montante reto A ${++extraNo}`:sample.structuralTag==='straight-b'?`Montante reto B ${++extraNo}`:`Montante reto ${++extraNo}`;
    createCurvedPost({cfg:{...c,postStructuralTag:sample.structuralTag||'extra',postSampleIndex:sample.postIndex,postSampleS:sample.s},yBase,x,z,name:nm,spaceRootId:root.id,rotationY:plc.rotationY},false);
  }
  if(c.createCover){
    if(c.splitStructure){
      createCurvedCover({cfg:c,yBase,x:xCenter,z:zCenter,name:'Capa externa curva',spaceRootId:root.id,part:'curve'},false);
      createCurvedCover({cfg:c,yBase,x:xCenter,z:zCenter,name:'Capa externa reta',spaceRootId:root.id,part:'straight'},false);
    }else createCurvedCover({cfg:c,yBase,x:xCenter,z:zCenter,name:'Capa externa',spaceRootId:root.id,part:'full'},false);
  }
  renderSpaces();renderMachiningVisuals();
  return root;
}
function previewCurvedStructure3D(){
  let c;try{c=validateCurvedConfig(curvedFormConfig());}catch(err){toast(err.message||'Confira as medidas');return false;}
  const target=curvedTargetFromStored();if(!target){toast('O espaço selecionado não existe mais');return false;}
  const original=stateString();
  const meta={rootId:curvedTargetRootId,cellId:curvedTargetCellId,editing:curvedEditingExisting,orientation:curvedOrientation};
  try{
    curved3DPreviewOriginalState=original;curved3DPreviewMeta=meta;
    historyMuted=true;buildCurvedStructureObjects(c,target);historyMuted=false;
    curved3DPreviewActive=true;
    $('curvedStructureDialog').style.display='none';
    $('curved3DPreviewBar').style.display='flex';
    if($('curved3DPreviewInfo'))$('curved3DPreviewInfo').textContent=`Raio ${nice(c.radius)} mm · ${c.ribs} nervura(s) · ${curvedPostSamplesMm(c).length} montante(s) · prévia temporária, ainda não salva.`;
    selectObject(null);frameFurnitureVisual();
    toast('Prévia 3D · gire/zoom e toque em Voltar e editar');
    return true;
  }catch(err){
    historyMuted=false;
    try{applyState(JSON.parse(original));}catch(_){ }
    curvedTargetRootId=meta.rootId;curvedTargetCellId=meta.cellId;curvedEditingExisting=meta.editing;curvedOrientation=meta.orientation;
    curved3DPreviewActive=false;curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;
    if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';
    toast(err.message||'Não foi possível visualizar o móvel curvo');
    return false;
  }
}
function returnCurvedStructurePreview({reopen=true}={}){
  if(!curved3DPreviewActive){if(reopen)$('curvedStructureDialog').style.display='flex';return;}
  const snapshot=curved3DPreviewOriginalState,meta=curved3DPreviewMeta||{};
  curved3DPreviewActive=false;curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;
  if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';
  if(snapshot){
    try{applyState(JSON.parse(snapshot));}catch(err){toast('Não foi possível restaurar a prévia');}
  }
  curvedTargetRootId=meta.rootId||null;curvedTargetCellId=meta.cellId||null;curvedEditingExisting=!!meta.editing;curvedOrientation=meta.orientation||curvedOrientation;
  document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.classList.toggle('active',b.dataset.curvedOrientation===curvedOrientation));
  if(reopen){$('curvedStructureDialog').style.display='flex';updateCurvedStructurePreview();}
}
function createCurvedStructure(){
  let c;try{c=validateCurvedConfig(curvedFormConfig());}catch(err){toast(err.message);return false;}
  const target=curvedTargetFromStored();if(!target){toast('O espaço selecionado não existe mais');return false;}
  const root=target.root;
  const existing=objects.filter(o=>o.userData?.spaceRootId===root.id&&(o.userData?.curvedRole||o.userData?.kind==='curved-panel'||/^Montante curvo/i.test(o.userData?.name||'')));
  if(existing.length&&!curvedEditingExisting&&!confirm(`Este espaço já possui ${existing.length} peça(s) de estrutura curva/capa. Substituir pela nova estrutura?`))return false;
  const wasEditing=curvedEditingExisting;
  historyMuted=true;buildCurvedStructureObjects(c,target);historyMuted=false;commitHistory();
  $('curvedStructureDialog').style.display='none';if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';selectSpaceRootOnly(root);frameFurnitureVisual();
  curved3DPreviewActive=false;curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;
  curvedEditingExisting=false;curvedTargetRootId=null;curvedTargetCellId=null;
  toast(`${wasEditing?'Móvel curvo atualizado':'Móvel curvo criado'} · ${c.splitStructure?'2 partes':'inteiro'} · ${c.createCover?'com capa externa':'sem capa'}`);return true;
}

function createCylinder({diameter=1,height=1,x=0,yBase=0,z=0,name='Cilindro'}={}, doHistory=true){
  diameter=clampSize(diameter); height=clampSize(height);
  const mats=makeMaterials(COLORS.default,3);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,48),mats);
  mesh.scale.set(diameter,height,diameter);
  mesh.position.set(x,yBase+height/2,z);
  mesh.userData={kind:'cylinder',width:diameter,depth:diameter,height,name,materialType:'genérico',baseColor:COLORS.default,faceMaterials:mats};
  mesh.castShadow=true; mesh.receiveShadow=true;
  scene.add(mesh); objects.push(mesh); selectObject(mesh);
  if(doHistory) commitHistory();
  return mesh;
}

function selectObject(mesh){
  if(mesh)clearSpaceSelection();
  if(selected&&selected!==mesh)restoreBaseColor(selected);
  selected=mesh;
  lastEdit=null;
  liveLabel.style.display='none';
  hideGuides();

  if(selected){
    if(!visualMode)setAllFaces(selected,COLORS.selected);
    else restoreBaseColor(selected);
    updateInspector();

    // 1.100.95: um clique apenas seleciona.
    // A configuração abre ao clicar/tocar e SEGURAR a mesma peça.
    cancelDuplicateConfirmation?.();
    $('inspector').classList.add('compact');
    $('inspector').style.display='none';
  }else{
    $('inspector').classList.add('compact');
    $('inspector').style.display='none';
  }
  updateMeasureBadge();
}

function openPieceInspector(mesh=selected){
  if(!mesh)return;
  if(mesh!==selected)selectObject(mesh);
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  cancelDuplicateConfirmation?.();
  updateInspector();
  $('morePanel').style.display='none';
  $('inspector').classList.remove('compact');
  $('inspector').style.display='block';
  requestAnimationFrame(()=>restorePieceInspectorPosition(true));
}

function updateInspector(){
  if(!selected) return;
  const u=selected.userData;
  $('objectName').textContent=u.name || 'Peça';
  const machineCount=(u.machining||[]).length;
  const ti=u.kind==='cylinder'?null:pieceThicknessInfo(selected);
  const bandCount=Object.keys(normalizePieceEdgeBands(u.edgeBands||{})).length;
  const matTxt=u.materialType&&u.materialType!=='genérico'?` · ${u.materialType}${u.materialCode?` (${u.materialCode})`:''}`:'';
  $('objectType').textContent = u.kind==='panel'
    ? `MDF · ${ti?.thickness||mm(u.height)} mm${matTxt}${bandCount?` · ${bandCount} fita(s)`:''}${machineCount?` · ${machineCount} usinagem(ns)`:''}`
    : (u.kind==='cylinder' ? 'Cilindro' : `Cubo${matTxt}${bandCount?` · ${bandCount} fita(s)`:''}${machineCount?` · ${machineCount} usinagem(ns)`:''}`);
  $('partNameInput').value=u.name || '';
  $('dimW').value=mm(u.width); $('dimD').value=mm(u.depth); $('dimH').value=mm(u.height);
  $('posX').value=mm(selected.position.x);
  $('posY').value=mm(selected.position.y-u.height/2);
  $('posZ').value=mm(selected.position.z);
  const linkedBtn=$('openLinkedSpaceBtn');
  if(linkedBtn) linkedBtn.style.display=rootForObject(selected) ? 'block' : 'none';
  const drawerBtn=$('editDrawerSetBtn');
  if(drawerBtn) drawerBtn.style.display=u.drawerSetId?'block':'none';
  if(u.drawerSetId){
    const cfg=u.drawerConfig||{};
    $('objectType').textContent=(u.kind==='hardware-visual'?'Ferragem · ':'MDF · ')+(cfg.slideName||'Conjunto de gavetas')+` · gaveta ${(Number(u.drawerIndex)||0)+1}`;
  }

  // 1.100.95: a troca do lado da dobradiça só existe no menu de uma PORTA.
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

  // 1.100.95: o veio pode girar 90° sem alterar a geometria/posição da peça.
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

  // Os campos relativos sempre começam em zero quando a seleção muda/atualiza.
  resetPieceRelativeInputs();
}
function updateMeasureBadge(){
  if(selected){
    const u=selected.userData;
    measureBadge.style.display='block';
    measureBadge.style.color='var(--yellow)';
    measureBadge.textContent=`L ${mm(u.width)} · P ${mm(u.depth)} · A ${mm(u.height)} mm`;
    return;
  }
  if(selectedSpaceCell){
    const c=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId);
    if(c){
      const z=cellSize(c);
      measureBadge.style.display='block';
      measureBadge.style.color='#5fd080';
      measureBadge.textContent=`ESPAÇO · L ${mm(z.width)} · P ${mm(z.depth)} · A ${mm(z.height)} mm`;
      return;
    }
  }
  measureBadge.style.display='none';
}

function getBounds(mesh){
  mesh.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(mesh);
  const c=new THREE.Vector3(); b.getCenter(c);
  return { minX:b.min.x,maxX:b.max.x,centerX:c.x,minY:b.min.y,maxY:b.max.y,centerY:c.y,minZ:b.min.z,maxZ:b.max.z,centerZ:c.z };
}
function axisFeatures(bounds,axis){
  return axis==='x' ? [bounds.minX,bounds.centerX,bounds.maxX]
       : axis==='y' ? [bounds.minY,bounds.centerY,bounds.maxY]
       : [bounds.minZ,bounds.centerZ,bounds.maxZ];
}
function findMoveSnap(mesh,axis){
  const mine=getBounds(mesh), myF=axisFeatures(mine,axis);
  let best=null;
  for(const o of referenceMeshes(mesh)){
    const otherF=axisFeatures(getBounds(o),axis);
    for(const a of myF) for(const b of otherF){
      const delta=b-a;
      if(Math.abs(delta)<=SNAP_THRESHOLD && (!best || Math.abs(delta)<Math.abs(best.delta))) best={delta,line:b};
    }
  }
  return best;
}
function snapFaceCoordinate(mesh,axis,coord){
  let best=null;
  for(const o of referenceMeshes(mesh)){
    const f=axisFeatures(getBounds(o),axis);
    for(const val of f){
      const delta=val-coord;
      if(Math.abs(delta)<=SNAP_THRESHOLD && (!best || Math.abs(delta)<Math.abs(best.delta))) best={coord:val,delta,line:val};
    }
  }
  return best;
}

const guideMat=new THREE.LineBasicMaterial({color:COLORS.snap,depthTest:false,transparent:true,opacity:.95});
function guide(points, material=guideMat){ const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material); l.visible=false; l.renderOrder=99; scene.add(l); return l; }
const guideX=guide([new THREE.Vector3(0,.002,-15),new THREE.Vector3(0,.002,15)]);
const guideZ=guide([new THREE.Vector3(-15,.002,0),new THREE.Vector3(15,.002,0)]);
const guideY=guide([new THREE.Vector3(0,-10,0),new THREE.Vector3(0,20,0)]);
const axisMats={
  x:new THREE.LineBasicMaterial({color:0xff3b30,depthTest:false,transparent:true,opacity:.98}),
  y:new THREE.LineBasicMaterial({color:0x2979ff,depthTest:false,transparent:true,opacity:.98}),
  z:new THREE.LineBasicMaterial({color:0xffd23f,depthTest:false,transparent:true,opacity:.98})
};
const inferenceLines={
  x:guide([new THREE.Vector3(-20,0,0),new THREE.Vector3(20,0,0)],axisMats.x),
  y:guide([new THREE.Vector3(0,-20,0),new THREE.Vector3(0,20,0)],axisMats.y),
  z:guide([new THREE.Vector3(0,0,-20),new THREE.Vector3(0,0,20)],axisMats.z)
};
const moveGrip=new THREE.Mesh(new THREE.SphereGeometry(.012,12,12),new THREE.MeshBasicMaterial({color:COLORS.cyan,depthTest:false}));
moveGrip.visible=false; moveGrip.renderOrder=101; scene.add(moveGrip);
const cornerMarker=new THREE.Mesh(new THREE.SphereGeometry(.016,14,14),new THREE.MeshBasicMaterial({color:0x34d058,depthTest:false}));
cornerMarker.visible=false; cornerMarker.renderOrder=103; scene.add(cornerMarker);

// ---------- Trena estilo CAD / linhas de construção ----------
function makeDashedMaterial(color=0xe8e8e8,opacity=.9){
  return new THREE.LineDashedMaterial({
    color, dashSize:.03, gapSize:.018, transparent:true, opacity, depthTest:false, depthWrite:false
  });
}
const tapePreviewMaterial=makeDashedMaterial(0x00e5ff,.95);
const tapePreviewLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),new THREE.Vector3()
]),tapePreviewMaterial);
tapePreviewLine.visible=false;
tapePreviewLine.renderOrder=105;
scene.add(tapePreviewLine);

const tapePointMarker=new THREE.Mesh(
  new THREE.SphereGeometry(.012,12,12),
  new THREE.MeshBasicMaterial({color:0x00e5ff,depthTest:false})
);
tapePointMarker.visible=false;
tapePointMarker.renderOrder=106;
scene.add(tapePointMarker);

const tapeSourceEdgeLine=new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),
  new THREE.LineBasicMaterial({color:0xffd23f,depthTest:false,transparent:true,opacity:1})
);
tapeSourceEdgeLine.visible=false; tapeSourceEdgeLine.renderOrder=107; scene.add(tapeSourceEdgeLine);

const tapeOffsetLine=new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),
  makeDashedMaterial(0xffffff,.78)
);
tapeOffsetLine.visible=false; tapeOffsetLine.renderOrder=106; scene.add(tapeOffsetLine);

function setLinePoints(line,a,b){
  line.geometry.dispose();
  line.geometry=new THREE.BufferGeometry().setFromPoints([a,b]);
  line.computeLineDistances();
}

function guideAxisColor(axis){
  return axis==='x' ? 0xff3b30 : axis==='y' ? 0x2979ff : axis==='z' ? 0xffd23f : 0xdcdcdc;
}

function createConstructionGuide(start,end,{infinite=false,axis=null,kind='guide',offset=null,doHistory=true}={}){
  const a=start.clone(), b=end.clone();
  const mat=makeDashedMaterial(guideAxisColor(axis),.9);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),mat);
  line.computeLineDistances();
  line.renderOrder=84;
  line.userData={
    isConstructionGuide:true,
    infinite,
    axis,
    kind,
    offset,
    start:a.clone(),
    end:b.clone()
  };
  scene.add(line);
  constructionGuides.push(line);
  if(doHistory) commitHistory();
  return line;
}

function resetTapeMeasure(){
  tapeStart=null;
  tapeStartClient=null;
  tapeHover=null;
  tapeEdgeSource=null;
  tapePendingEdge=null;
  tapeDragEdgeActive=false;
  tapePreviewLine.visible=false;
  tapeSourceEdgeLine.visible=false;
  tapeOffsetLine.visible=false;
  tapePointMarker.visible=false;
  liveLabel.style.display='none';
}

function hideTapeCrosshair(){
  tapeCrosshair.style.display='none';
  tapeSnapDot.style.display='none';
  tapeAim=null;
}

function setTapeCrosshair(client,aim,snapClient=null){
  // A mira principal acompanha SEMPRE o dedo/mouse.
  tapeCrosshair.style.left=client.x+'px';
  tapeCrosshair.style.top=client.y+'px';
  tapeCrosshair.style.display='block';
  tapeCrosshair.className='';
  const kind=aim?.snapKind || 'free';
  if(kind==='axis') tapeCrosshair.classList.add('snap-axis');
  else if(kind==='edge') tapeCrosshair.classList.add('snap-edge');
  else if(kind==='corner') tapeCrosshair.classList.add('snap-corner');
  else if(kind==='guide') tapeCrosshair.classList.add('snap-guide');
  const axis=aim?.snapAxis ? ` ${aim.snapAxis.toUpperCase()}` : '';
  tapeCrosshairLabel.textContent = kind==='axis' ? `Eixo${axis}`
    : kind==='edge' ? `Aresta${axis}`
    : kind==='corner' ? 'Quina'
    : kind==='guide' ? `Guia${axis}`
    : aim?.face ? `Face ${aim.face.axis.toUpperCase()}` : 'Trena';

  // O ponto menor mostra onde o snap REAL foi encontrado.
  if(snapClient && kind!=='free'){
    tapeSnapDot.style.left=snapClient.x+'px';
    tapeSnapDot.style.top=snapClient.y+'px';
    tapeSnapDot.style.display='block';
    tapeSnapDot.className='';
    if(kind==='axis') tapeSnapDot.classList.add('snap-axis');
    else if(kind==='edge') tapeSnapDot.classList.add('snap-edge');
    else if(kind==='corner') tapeSnapDot.classList.add('snap-corner');
    else if(kind==='guide') tapeSnapDot.classList.add('snap-guide');
  }else{
    tapeSnapDot.style.display='none';
    tapeSnapDot.className='';
  }
}


function nearestAnyCornerToClient(client,maxPx=22){
  let best=null;
  for(const mesh of referenceMeshes()){
    if(mesh.userData.kind==='cylinder') continue;
    for(const point of getBoxCorners(mesh)){
      const sp=worldToClient(point);
      const dist=sp.distanceTo(client);
      if(dist<=maxPx && (!best || dist<best.dist)) best={point:point.clone(),dist,mesh};
    }
  }
  return best;
}

function getBoxEdges(mesh){
  if(!mesh || mesh.userData.kind==='cylinder') return [];
  const b=getBounds(mesh);
  const xs=[b.minX,b.maxX], ys=[b.minY,b.maxY], zs=[b.minZ,b.maxZ];
  const edges=[];
  for(const y of ys) for(const z of zs) edges.push({axis:'x',a:new THREE.Vector3(b.minX,y,z),b:new THREE.Vector3(b.maxX,y,z)});
  for(const x of xs) for(const z of zs) edges.push({axis:'y',a:new THREE.Vector3(x,b.minY,z),b:new THREE.Vector3(x,b.maxY,z)});
  for(const x of xs) for(const y of ys) edges.push({axis:'z',a:new THREE.Vector3(x,y,b.minZ),b:new THREE.Vector3(x,y,b.maxZ)});
  return edges;
}

function nearestAnyEdgeToClient(client,maxPx=EDGE_PICK_PX,excludeMesh=null){
  let best=null;
  for(const mesh of referenceMeshes(excludeMesh)){
    if(mesh.userData.kind==='cylinder') continue;
    for(const edge of getBoxEdges(mesh)){
      const sa=worldToClient(edge.a), sb=worldToClient(edge.b);
      const ab=sb.clone().sub(sa), len2=ab.lengthSq();
      if(len2<1e-8) continue;
      const t=THREE.MathUtils.clamp(client.clone().sub(sa).dot(ab)/len2,0,1);
      const screenPoint=sa.clone().addScaledVector(ab,t);
      const dist=client.distanceTo(screenPoint);
      if(dist>maxPx) continue;
      const point=edge.a.clone().lerp(edge.b,t);
      raycaster.setFromCamera(pointer,camera);
      const rayDist=raycaster.ray.distanceToPoint(point);
      if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)){
        best={...edge,mesh,point,dist,rayDist,t};
      }
    }
  }
  return best;
}

function nearestEdgeOnMeshToClient(mesh,client,maxPx=EDGE_PICK_PX){
  if(!mesh || mesh.userData.kind==='cylinder') return null;
  let best=null;
  for(const edge of getBoxEdges(mesh)){
    const sa=worldToClient(edge.a), sb=worldToClient(edge.b);
    const ab=sb.clone().sub(sa), len2=ab.lengthSq();
    if(len2<1e-8) continue;
    const t=THREE.MathUtils.clamp(client.clone().sub(sa).dot(ab)/len2,0,1);
    const screenPoint=sa.clone().addScaledVector(ab,t);
    const dist=client.distanceTo(screenPoint);
    if(dist>maxPx) continue;
    const point=edge.a.clone().lerp(edge.b,t);
    raycaster.setFromCamera(pointer,camera);
    const rayDist=raycaster.ray.distanceToPoint(point);
    if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)) best={...edge,mesh,point,dist,rayDist,t};
  }
  return best;
}

function nearestGuideToClient(client,maxPx=GUIDE_SNAP_PX){
  let best=null;
  for(const line of constructionGuides){
    const a=line.userData.start, b=line.userData.end;
    if(!a || !b) continue;
    const sa=worldToClient(a), sb=worldToClient(b);
    const ab=sb.clone().sub(sa), len2=ab.lengthSq();
    if(len2<1e-8) continue;
    const t=THREE.MathUtils.clamp(client.clone().sub(sa).dot(ab)/len2,0,1);
    const screenPoint=sa.clone().addScaledVector(ab,t);
    const dist=client.distanceTo(screenPoint);
    if(dist>maxPx) continue;
    const point=a.clone().lerp(b,t);
    raycaster.setFromCamera(pointer,camera);
    const rayDist=raycaster.ray.distanceToPoint(point);
    if(!best || dist<best.dist-.5 || (Math.abs(dist-best.dist)<=.5 && rayDist<best.rayDist)){
      best={line,point,dist,rayDist,axis:line.userData.axis||null};
    }
  }
  return best;
}

function closestPointOnInfiniteLine(point,linePoint,lineDir){
  const d=lineDir.clone().normalize();
  return linePoint.clone().addScaledVector(d,point.clone().sub(linePoint).dot(d));
}

function nearestGlobalAxisHit(client,maxPx=TAPE_AIM_SNAP_PX){
  // Reconhecimento 100% em espaço de tela: usamos dois pontos BEM afastados
  // do eixo visível. Isso evita erros de direção/projeção em WebView mobile.
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  let best=null;
  const origin=new THREE.Vector3(0,0,0);
  for(const axis of ['x','y','z']){
    const dir=axisVector(axis);
    const wa=origin.clone().addScaledVector(dir,-GUIDE_EXTENT);
    const wb=origin.clone().addScaledVector(dir, GUIDE_EXTENT);
    const sa=worldToClient(wa), sb=worldToClient(wb);
    const ab=sb.clone().sub(sa);
    const len2=ab.lengthSq();
    if(!Number.isFinite(len2) || len2<4) continue;

    // Distância até a reta 2D infinita do eixo que o usuário realmente vê.
    const screenT=client.clone().sub(sa).dot(ab)/len2;
    const screenPoint=sa.clone().addScaledVector(ab,screenT);
    const dist=client.distanceTo(screenPoint);
    if(!Number.isFinite(dist) || dist>maxPx) continue;

    // O ponto 3D exato é o ponto do eixo mais próximo do raio do toque.
    let worldT=closestParamOnAxis(origin,dir);
    if(!Number.isFinite(worldT)) worldT=0;
    worldT=THREE.MathUtils.clamp(worldT,-GUIDE_EXTENT,GUIDE_EXTENT);
    const point=origin.clone().addScaledVector(dir,worldT);
    if(!best || dist<best.dist) best={axis,point,screenPoint,dist};
  }
  return best;
}
function nearestReferenceLineByRay(event){
  // Reconhecimento direto na geometria visível. Em Android isso é mais robusto
  // que depender apenas da projeção 3D -> tela para eixos compridos.
  getPointerNDC(event);
  raycaster.setFromCamera(pointer,camera);
  const oldThreshold=raycaster.params.Line.threshold;
  const camScale=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)/5, .7, 2.2);
  raycaster.params.Line.threshold=.14*camScale;
  const refs=[worldAxisX,worldAxisY,worldAxisZ,...constructionGuides];
  const hits=raycaster.intersectObjects(refs,false);
  raycaster.params.Line.threshold=oldThreshold;
  if(!hits.length) return null;
  const hit=hits[0], line=hit.object;
  const axis=line.userData.tapeAxis || line.userData.axis || null;
  let point=null;
  if(line.userData.tapeAxis){
    const dir=axisVector(axis);
    let t=closestParamOnAxis(new THREE.Vector3(0,0,0),dir);
    if(!Number.isFinite(t)) t=0;
    point=dir.clone().multiplyScalar(THREE.MathUtils.clamp(t,-GUIDE_EXTENT,GUIDE_EXTENT));
  }else if(line.userData.isConstructionGuide && line.userData.start && line.userData.end){
    const a=line.userData.start, b=line.userData.end;
    const d=b.clone().sub(a); const len=d.length();
    if(len<1e-9) return null;
    d.divideScalar(len);
    let t=closestParamOnAxis(a,d);
    if(!line.userData.infinite) t=THREE.MathUtils.clamp(t,0,len);
    point=a.clone().addScaledVector(d,t);
  }
  if(!point) return null;
  return {
    snapKind: line.userData.tapeAxis ? 'axis' : 'guide',
    snapAxis: axis,
    point,
    line,
    guide: line.userData.isConstructionGuide ? {line,point,axis,dist:0} : null,
    dist:0
  };
}

function resolveTapeAim(event){
  // Sempre atualiza o raycast com a coordenada do evento atual. Assim nenhum
  // touchmove/touchend usa a posição antiga do ponteiro.
  getPointerNDC(event);
  const client=new THREE.Vector2(event.clientX,event.clientY);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(referenceMeshes(),false);
  const hit=hits[0] || null;
  let rawPoint=null, face=null;
  if(hit){
    rawPoint=hit.point.clone();
    face=worldAxisForFace(hit,hit.object);
  }else{
    rawPoint=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(groundPlane,rawPoint)) rawPoint.set(0,0,0);
  }

  // A mira da Trena procura o elemento visualmente mais próximo do dedo.
  // Isso inclui o eixo azul vertical, que não depende mais da interseção com o chão.
  const candidates=[];
  // Primeiro tenta acertar diretamente as linhas realmente desenhadas no WebGL.
  const directLine=nearestReferenceLineByRay(event);
  if(directLine) candidates.push(directLine);
  const corner=nearestAnyCornerToClient(client,TAPE_AIM_SNAP_PX);
  if(corner) candidates.push({snapKind:'corner',point:corner.point.clone(),corner,dist:corner.dist});
  const edge=nearestAnyEdgeToClient(client,TAPE_AIM_SNAP_PX);
  if(edge) candidates.push({snapKind:'edge',point:edge.point.clone(),edge,snapAxis:edge.axis,dist:edge.dist});
  const guide=nearestGuideToClient(client,TAPE_AIM_SNAP_PX);
  if(guide) candidates.push({snapKind:'guide',point:guide.point.clone(),guide,snapAxis:guide.axis,dist:guide.dist});
  const axisHit=nearestGlobalAxisHit(client,TAPE_AIM_SNAP_PX);
  if(axisHit) candidates.push({snapKind:'axis',point:axisHit.point.clone(),axisHit,snapAxis:axisHit.axis,dist:axisHit.dist});

  // Se o raycast bateu numa linha real, ela ganha. Nos demais casos vale a
  // distância visual: quina > aresta > guia > eixo.
  const direct=candidates.find(c=>c===directLine && directLine);
  const priority={corner:0,edge:1,guide:2,axis:3};
  candidates.sort((a,b)=>(a.dist-b.dist) || (priority[a.snapKind]-priority[b.snapKind]));
  const snap=direct || candidates[0] || null;
  const aim={
    point:snap ? snap.point.clone() : rawPoint,
    hit,face,corner:snap?.corner||null,edge:snap?.edge||null,guide:snap?.guide||null,
    axisHit:snap?.axisHit||null,snapKind:snap?.snapKind||'free',snapAxis:snap?.snapAxis||null,
    dist:snap?.dist ?? Infinity
  };
  tapeAim=aim;
  const snapScreen=snap ? (snap.axisHit?.screenPoint?.clone?.() || worldToClient(aim.point)) : null;
  setTapeCrosshair(client,aim,snapScreen);
  return aim;
}

function getTapePick(event){
  return resolveTapeAim(event);
}

function distancePointToSegment2D(p,a,b){
  const ab=b.clone().sub(a);
  const len2=ab.lengthSq();
  if(len2<1e-9) return p.distanceTo(a);
  const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/len2,0,1);
  return p.distanceTo(a.clone().addScaledVector(ab,t));
}

function nearestGlobalAxisAtClient(client,maxPx=34){
  return nearestGlobalAxisHit(client,maxPx)?.axis || null;
}

function inferTapeAxis(start,event){
  const motion=new THREE.Vector2(
    event.clientX-(tapeStartClient?.x ?? event.clientX),
    event.clientY-(tapeStartClient?.y ?? event.clientY)
  );
  if(motion.length()<8) return null;
  motion.normalize();
  const base=worldToClient(start);
  let best=null;
  for(const [axis,dir] of Object.entries({
    x:new THREE.Vector3(1,0,0),
    y:new THREE.Vector3(0,1,0),
    z:new THREE.Vector3(0,0,1)
  })){
    const sv=worldToClient(start.clone().add(dir)).sub(base);
    if(sv.length()<10) continue;
    sv.normalize();
    const angle=Math.acos(THREE.MathUtils.clamp(Math.abs(motion.dot(sv)),-1,1));
    if(angle<=TAPE_AXIS_ANGLE && (!best || angle<best.angle)) best={axis,angle};
  }
  return best?.axis || null;
}

function projectPointToAxis(start,target,axis){
  if(!axis) return target.clone();
  const dir=axisVector(axis);
  const amount=target.clone().sub(start).dot(dir);
  return start.clone().addScaledVector(dir,amount);
}

function activateTapeEdgeSource(pick,clientX,clientY){
  if(!pick?.edge) return false;
  tapeEdgeSource={mesh:pick.edge.mesh,axis:pick.edge.axis,a:pick.edge.a.clone(),b:pick.edge.b.clone()};
  tapeStart=pick.edge.point.clone();
  tapeStartClient={x:clientX,y:clientY};
  tapePointMarker.position.copy(tapeStart); tapePointMarker.visible=true;
  setLinePoints(tapeSourceEdgeLine,tapeEdgeSource.a,tapeEdgeSource.b);
  tapeSourceEdgeLine.visible=true;
  return true;
}

function parallelGuideGeometryFromPick(pick){
  if(!tapeEdgeSource || !tapeStart || !pick) return null;
  const dir=tapeEdgeSource.b.clone().sub(tapeEdgeSource.a).normalize();
  const nearestOnSource=closestPointOnInfiniteLine(pick.point,tapeEdgeSource.a,dir);
  const offsetVec=pick.point.clone().sub(nearestOnSource);
  const offset=offsetVec.length();
  const targetAnchor=tapeStart.clone().add(offsetVec);
  return {
    dir,offset,targetAnchor,
    start:targetAnchor.clone().addScaledVector(dir,-GUIDE_EXTENT),
    end:targetAnchor.clone().addScaledVector(dir, GUIDE_EXTENT)
  };
}

function commitTapeParallelAtEvent(event){
  const pick=getTapePick(event);
  const g=parallelGuideGeometryFromPick(pick);
  if(!g || g.offset<MIN_SIZE){ resetTapeMeasure(); return false; }
  createConstructionGuide(g.start,g.end,{infinite:true,axis:tapeEdgeSource.axis,kind:'parallel',offset:g.offset});
  toast(`Guia paralela · ${mm(g.offset)} mm da aresta`);
  resetTapeMeasure();
  return true;
}

function updateTapePreview(event){
  if(toolMode!=='tape') return;
  const pick=getTapePick(event);
  if(!pick) return;
  tapeHover=pick;

  if(!tapeStart){
    tapePointMarker.position.copy(pick.point);
    tapePointMarker.visible=true;
    liveLabel.style.display='none';
    tapeOffsetLine.visible=false;
    // Antes do primeiro toque, a mira já mostra exatamente o eixo/aresta/guia reconhecido.
    if(pick.edge){
      setLinePoints(tapeSourceEdgeLine,pick.edge.a,pick.edge.b);
      tapeSourceEdgeLine.visible=true;
      tapePreviewLine.visible=false;
    }else if(pick.snapKind==='axis' && pick.snapAxis){
      const dir=axisVector(pick.snapAxis);
      setLinePoints(tapePreviewLine,pick.point.clone().addScaledVector(dir,-GUIDE_EXTENT),pick.point.clone().addScaledVector(dir,GUIDE_EXTENT));
      tapePreviewLine.material.color.set(guideAxisColor(pick.snapAxis));
      tapePreviewLine.visible=true;
      tapeSourceEdgeLine.visible=false;
    }else if(pick.snapKind==='guide' && pick.guide){
      setLinePoints(tapePreviewLine,pick.guide.line.userData.start,pick.guide.line.userData.end);
      tapePreviewLine.material.color.set(guideAxisColor(pick.snapAxis));
      tapePreviewLine.visible=true;
      tapeSourceEdgeLine.visible=false;
    }else{
      tapeSourceEdgeLine.visible=false;
      tapePreviewLine.visible=false;
    }
    return;
  }

  if(tapeEdgeSource){
    const g=parallelGuideGeometryFromPick(pick);
    if(!g) return;
    setLinePoints(tapePreviewLine,g.start,g.end);
    tapePreviewLine.material.color.set(guideAxisColor(tapeEdgeSource.axis));
    tapePreviewLine.visible=true;
    setLinePoints(tapeSourceEdgeLine,tapeEdgeSource.a,tapeEdgeSource.b);
    tapeSourceEdgeLine.visible=true;
    setLinePoints(tapeOffsetLine,tapeStart,g.targetAnchor);
    tapeOffsetLine.visible=true;
    tapePointMarker.position.copy(g.targetAnchor); tapePointMarker.visible=true;
    const mid=tapeStart.clone().lerp(g.targetAnchor,.5), sp=worldToClient(mid);
    liveLabel.style.left=sp.x+'px'; liveLabel.style.top=sp.y+'px';
    liveLabel.textContent=`${mm(g.offset)} mm · paralela à aresta`;
    liveLabel.style.display='block';
    return;
  }

  tapeSourceEdgeLine.visible=false;
  tapeOffsetLine.visible=false;
  const axis=inferTapeAxis(tapeStart,event);
  const end=projectPointToAxis(tapeStart,pick.point,axis);
  tapePointMarker.position.copy(end);
  tapePointMarker.visible=true;
  setLinePoints(tapePreviewLine,tapeStart,end);
  tapePreviewLine.material.color.set(guideAxisColor(axis));
  tapePreviewLine.visible=true;

  const dist=tapeStart.distanceTo(end);
  const mid=tapeStart.clone().lerp(end,.5);
  const sp=worldToClient(mid);
  liveLabel.style.left=sp.x+'px';
  liveLabel.style.top=sp.y+'px';
  liveLabel.textContent=`${mm(dist)} mm${axis ? ` · eixo ${axis.toUpperCase()}` : ''}`;
  liveLabel.style.display='block';
}
function createInfiniteAxisGuide(point,axis){
  const dir=axisVector(axis);
  const start=point.clone().addScaledVector(dir,-GUIDE_EXTENT);
  const end=point.clone().addScaledVector(dir,GUIDE_EXTENT);
  createConstructionGuide(start,end,{infinite:true,axis});
  resetTapeMeasure();
  toast(`Guia infinita no eixo ${axis.toUpperCase()}`);
}

function tapePickKey(pick){
  if(!pick) return 'none';
  if(pick.snapKind==='axis') return `axis:${pick.snapAxis||''}`;
  if(pick.snapKind==='guide') return `guide:${pick.snapAxis||''}:${constructionGuides.indexOf(pick.guide?.line)}`;
  if(pick.snapKind==='edge' && pick.edge){
    const a=pick.edge.a, b=pick.edge.b;
    return `edge:${pick.edge.axis}:${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}:${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)}`;
  }
  if(pick.snapKind==='corner') return `corner:${pick.point.x.toFixed(3)},${pick.point.y.toFixed(3)},${pick.point.z.toFixed(3)}`;
  return `free:${pick.face?.axis||'ground'}`;
}

function handleTapeTap(event){
  if(toolMode!=='tape') return false;
  if(!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;

  const now=performance.now();
  const client=new THREE.Vector2(event.clientX,event.clientY);

  // Android pode disparar pointerdown + touchstart para o mesmo contato.
  // Se os dois chegarem quase juntos e no mesmo lugar, só confirmamos uma vez.
  const gateDist=Math.hypot(event.clientX-tapeConfirmGate.x,event.clientY-tapeConfirmGate.y);
  if((now-tapeConfirmGate.time)<110 && gateDist<14) return false;
  tapeConfirmGate={time:now,x:event.clientX,y:event.clientY};

  const pick=getTapePick(event);
  if(!pick){ toast('Trena: não consegui localizar o ponto'); return false; }
  const key=tapePickKey(pick);

  const lastDist=Math.hypot(event.clientX-tapeLastConfirmedTap.x,event.clientY-tapeLastConfirmedTap.y);
  const sameReference=key===tapeLastConfirmedTap.key;
  const isDouble=(now-tapeLastConfirmedTap.time)<=DOUBLE_TAP_MS && lastDist<=DOUBLE_TAP_PX && sameReference;

  // Duplo toque só vira guia infinita quando a mira está realmente sobre
  // eixo, aresta ou guia. Um duplo toque em espaço livre não destrói P1/P2.
  if(isDouble && ['axis','edge','guide'].includes(pick.snapKind)){
    let axis=pick.snapAxis || pick.edge?.axis || pick.guide?.axis || null;
    if(axis){
      createInfiniteAxisGuide(pick.point,axis);
      tapeLastConfirmedTap={time:0,x:-9999,y:-9999,key:''};
      toast(`Guia infinita · eixo ${axis.toUpperCase()}`);
      return true;
    }
  }

  tapeLastConfirmedTap={time:now,x:event.clientX,y:event.clientY,key};

  if(!tapeStart){
    tapeStart=pick.point.clone();
    tapeStartClient={x:event.clientX,y:event.clientY};
    tapePointMarker.position.copy(tapeStart);
    tapePointMarker.visible=true;
    tapePreviewLine.visible=false;
    toast(`P1 fixado${pick.snapKind!=='free' ? ` · ${tapeCrosshairLabel.textContent}` : ''}`);
    return true;
  }

  // Segundo toque SEMPRE conclui uma guia. Se houver eixo/aresta/guia sob a
  // mira, respeitamos sua direção; caso contrário usamos os dois pontos livres.
  let axis=pick.snapAxis || pick.edge?.axis || pick.guide?.axis || null;
  if(!axis) axis=inferTapeAxis(tapeStart,event);
  let end=axis ? projectPointToAxis(tapeStart,pick.point,axis) : pick.point.clone();

  // Se a projeção de eixo colapsar os pontos, não apagamos P1: usamos o ponto
  // livre em vez de simplesmente cancelar a medição.
  if(tapeStart.distanceTo(end)<MIN_SIZE*2){
    end=pick.point.clone();
  }
  if(tapeStart.distanceTo(end)<MIN_SIZE*2){
    toast('P2 muito próximo do P1');
    return false;
  }

  const dist=tapeStart.distanceTo(end);
  createConstructionGuide(tapeStart,end,{infinite:false,axis});
  toast(`Guia criada · ${mm(dist)} mm${axis ? ` · ${axis.toUpperCase()}` : ''}`);
  resetTapeMeasure();
  tapeLastConfirmedTap={time:0,x:-9999,y:-9999,key:''};
  return true;
}
function getBoxCorners(mesh){
  if(!mesh || mesh.userData.kind==='cylinder') return [];
  const b=getBounds(mesh), pts=[];
  for(const x of [b.minX,b.maxX]) for(const y of [b.minY,b.maxY]) for(const z of [b.minZ,b.maxZ]) pts.push(new THREE.Vector3(x,y,z));
  return pts;
}
function getFaceCorners(mesh,face){
  const pts=getBoxCorners(mesh);
  if(!pts.length || !face) return pts;
  const b=getBounds(mesh);
  const target=face.axis==='x' ? (face.sign>0?b.maxX:b.minX)
             : face.axis==='y' ? (face.sign>0?b.maxY:b.minY)
             : (face.sign>0?b.maxZ:b.minZ);
  return pts.filter(p=>Math.abs(p[face.axis]-target)<1e-6);
}
function nearestCornerToClient(mesh,face,client,maxPx=CORNER_PICK_PX){
  let best=null;
  for(const point of getFaceCorners(mesh,face)){
    const sp=worldToClient(point), dist=sp.distanceTo(client);
    if(dist<=maxPx && (!best || dist<best.dist)) best={point,dist};
  }
  return best;
}
function findTargetCornerSnap(moving,event){
  const aim2=new THREE.Vector2(event.clientX,event.clientY);
  let best=null;
  for(const other of referenceMeshes(moving)){
    if(other.userData.kind==='cylinder') continue;
    for(const point of getBoxCorners(other)){
      const sp=worldToClient(point), dist=sp.distanceTo(aim2);
      if(dist>CORNER_SNAP_PX) continue;
      // Em projeções com cantos sobrepostos, favorece o vértice mais perto do raio da mira.
      const rayDist=raycaster.ray.distanceToPoint(point);
      if(!best || dist<best.dist-0.5 || (Math.abs(dist-best.dist)<=0.5 && rayDist<best.rayDist)) best={point,dist,rayDist};
    }
  }
  return best;
}
function findMoveInferenceTarget(moving,event){
  const client=new THREE.Vector2(event.clientX,event.clientY);
  raycaster.setFromCamera(pointer,camera);

  const corner=findTargetCornerSnap(moving,event);
  if(corner) return {kind:'corner',point:corner.point.clone(),label:'Quina'};

  const g=nearestGuideToClient(client,GUIDE_SNAP_PX);
  if(g) return {kind:'guide',point:g.point.clone(),label:'Guia',axis:g.axis,line:g.line};

  const edge=nearestAnyEdgeToClient(client,EDGE_SNAP_PX,moving);
  if(edge) return {kind:'edge',point:edge.point.clone(),label:'Aresta',axis:edge.axis,mesh:edge.mesh};

  // Face visível sob o dedo. Só entra depois de quina/guia/aresta para não roubar inferências mais precisas.
  const hits=raycaster.intersectObjects(referenceMeshes(moving),false);
  if(hits.length){
    const hit=hits[0];
    return {kind:'face',point:hit.point.clone(),label:'Face',mesh:hit.object,face:worldAxisForFace(hit,hit.object)};
  }
  return null;
}

function snapMovingObjectFeaturesToGuide(moving,line){
  const axis=line?.userData?.axis;
  const ref=line?.userData?.start;
  if(!axis || !ref) return false;
  const b=getBounds(moving);
  let changed=false;
  for(const ax of ['x','y','z']){
    if(ax===axis) continue; // a linha varia neste eixo; os outros dois definem sua posição.
    const values=axisFeatures(b,ax);
    let bestVal=values[0], bestDelta=ref[ax]-values[0];
    for(const v of values.slice(1)){
      const d=ref[ax]-v;
      if(Math.abs(d)<Math.abs(bestDelta)){ bestVal=v; bestDelta=d; }
    }
    if(Math.abs(bestDelta)<=GUIDE_OBJECT_SNAP_WORLD){
      moving.position[ax]+=bestDelta;
      changed=true;
      // Atualiza os bounds antes do próximo eixo porque a peça já se moveu.
      Object.assign(b,getBounds(moving));
    }
  }
  return changed;
}

function setMoveTargetMarker(target){
  if(!target){
    moveSnapKind=null; moveSnapText='';
    if(!moveGrabIsCorner) cornerMarker.visible=false;
    return;
  }
  moveSnapKind=target.kind;
  moveSnapText=target.label;
  cornerMarker.position.copy(target.point); cornerMarker.visible=true;
  const color=target.kind==='corner' ? 0x34d058
             : target.kind==='guide' ? COLORS.snap
             : target.kind==='edge' ? 0xffd23f
             : COLORS.cyan;
  cornerMarker.material.color.set(color);
  moveGrip.material.color.set(color);
}

function showGuide(axis,line){
  if(axis==='x'){ guideX.visible=true; guideX.position.x=line; }
  if(axis==='z'){ guideZ.visible=true; guideZ.position.z=line; }
  if(axis==='y' && selected){ guideY.visible=true; guideY.position.set(selected.position.x,0,selected.position.z); }
}
function hideInference(){ Object.values(inferenceLines).forEach(l=>l.visible=false); moveInferenceAxis=null; }
function showInference(axis){
  Object.entries(inferenceLines).forEach(([k,l])=>l.visible=(k===axis));
  if(!axis) return;
  inferenceLines[axis].position.copy(movePickPoint);
}
function hideGuides(){ guideX.visible=guideZ.visible=guideY.visible=false; hideInference(); cornerMarker.visible=false; moveCornerTarget=null; moveSnapKind=null; moveSnapText=''; }

function captureObjects(){
  return objects.map(o=>({
    kind:o.userData.kind,name:o.userData.name,materialType:o.userData.materialType,baseColor:o.userData.baseColor,
    materialId:o.userData.materialId||null,materialCode:o.userData.materialCode||'',materialGrain:!!o.userData.materialGrain,materialGrainRotation:normalizePieceGrainRotation(o.userData.materialGrainRotation),materialCoreColor:o.userData.materialCoreColor||null,
    edgeBands:productionClone(o.userData.edgeBands||{}),partId:o.userData.partId||null,labelMeta:productionClone(o.userData.labelMeta||{schemaVersion:1,enabled:true}),
    spaceRootId:o.userData.spaceRootId||null,
    machining:JSON.parse(JSON.stringify(o.userData.machining||[])),forms:JSON.parse(JSON.stringify(o.userData.forms||[])),customProfile:o.userData.customProfile?JSON.parse(JSON.stringify(o.userData.customProfile)):null,curvedRole:o.userData.curvedRole||null,curvedPart:o.userData.curvedPart||o.userData.customProfile?.part||null,curvedConfig:o.userData.curvedConfig?JSON.parse(JSON.stringify(o.userData.curvedConfig)):null,drawerSetId:o.userData.drawerSetId||null,drawerRole:o.userData.drawerRole||null,drawerIndex:o.userData.drawerIndex??null,drawerConfig:o.userData.drawerConfig?JSON.parse(JSON.stringify(o.userData.drawerConfig)):null,doorConfig:o.userData.doorConfig?JSON.parse(JSON.stringify(o.userData.doorConfig)):null,excludeFromCutList:!!o.userData.excludeFromCutList,spaceCutting:!!o.userData.spaceCutting,spaceCutParentBounds:o.userData.spaceCutParentBounds?JSON.parse(JSON.stringify(o.userData.spaceCutParentBounds)):null,
    divisionNominalThicknessM:Number(o.userData.divisionNominalThicknessM)||null,
    rotationX:Number(o.rotation.x)||0,rotationY:Number(o.rotation.y)||0,rotationZ:Number(o.rotation.z)||0,
    width:o.userData.width,depth:o.userData.depth,height:o.userData.height,
    x:Number.isFinite(o.userData.curvedTargetX)?o.userData.curvedTargetX:o.position.x,yBase:o.position.y-o.userData.height/2,z:Number.isFinite(o.userData.curvedTargetZ)?o.userData.curvedTargetZ:o.position.z
  }));
}
function captureGuides(){
  return constructionGuides.map(line=>({
    infinite:!!line.userData.infinite,
    axis:line.userData.axis || null,
    kind:line.userData.kind || 'guide',
    offset:Number.isFinite(line.userData.offset) ? line.userData.offset : null,
    start:line.userData.start.toArray(),
    end:line.userData.end.toArray()
  }));
}
function captureSpaces(){ return spaceRoots.map(r=>({id:r.id,name:r.name,width:r.width,depth:r.depth,height:r.height,x:r.x,yBase:r.yBase,z:r.z,defaultMaterialId:r.defaultMaterialId||null,doorsHidden:!!r.doorsHidden,spaceHidden:false,fixedBands:{x:(r.fixedBands?.x||[]).map(v=>[...v]),y:(r.fixedBands?.y||[]).map(v=>[...v]),z:(r.fixedBands?.z||[]).map(v=>[...v])},cells:r.cells.map(c=>({id:c.id,hidden:!!c.hidden,fixedAxes:{...(c.fixedAxes||{})},minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ}))})); }
function captureState(){ return { version:'1.100.95', objects:captureObjects(), guides:captureGuides(), spaces:captureSpaces(), production:captureProductionState() }; }
function stateString(){ return JSON.stringify(captureState()); }
function commitHistory(){
  if(historyMuted) return;
  const s=stateString();
  if(historyIndex>=0 && history[historyIndex]===s) return;
  history=history.slice(0,historyIndex+1); history.push(s); historyIndex=history.length-1;
  if(history.length>80){ history.shift(); historyIndex--; }
  localStorage.setItem(STORAGE_KEY,s);
  if(typeof markCurrentProjectDirty==='function')markCurrentProjectDirty();
}
function clearConstructionGuides(){
  for(const line of [...constructionGuides]){
    scene.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  constructionGuides.length=0;
  resetTapeMeasure();
}
function clearScene(){
  clearMachiningVisuals();
  // Novo projeto/limpeza recebe catálogos iniciais; applyState restaura os salvos logo depois.
  projectProduction=defaultProjectProduction();
  for(const o of [...objects])disposeObject(o);
  objects.length=0;
  disposeSpaceMeshes(); spaceRoots.length=0; clearSpaceSelection();
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
  historyMuted=true; clearScene();
  setProjectProductionState(Array.isArray(state)?null:state?.production);
  const objectState=Array.isArray(state) ? state : (state?.objects || []);
  const guideState=Array.isArray(state) ? [] : (state?.guides || []);
  const spaceState=Array.isArray(state) ? [] : (state?.spaces || []);
  for(const item of objectState){
    if(item.kind==='cylinder') createCylinder({diameter:item.width,height:item.height,x:item.x,yBase:item.yBase,z:item.z,name:item.name},false);
    else if(item.kind==='curved-panel'&&item.customProfile?.cfg) createCurvedRib({cfg:item.customProfile.cfg,yBase:item.yBase,x:item.x,z:item.z,name:item.name,spaceRootId:item.spaceRootId,part:item.customProfile.part||item.curvedPart||'full'},false);
    else if(item.curvedRole==='cover'&&item.curvedConfig) createCurvedCover({cfg:item.curvedConfig,yBase:item.yBase,x:item.x,z:item.z,name:item.name||'Capa externa',spaceRootId:item.spaceRootId,part:item.curvedPart||item.curvedConfig.coverPart||'full'},false);
    else if(item.curvedRole==='post'&&item.curvedConfig) createCurvedPost({cfg:item.curvedConfig,yBase:item.yBase,x:item.x,z:item.z,name:item.name||'Montante curvo',spaceRootId:item.spaceRootId,rotationY:item.rotationY||0},false);
    else createBox({...item,rotationX:item.rotationX||0,rotationY:item.rotationY||0,rotationZ:item.rotationZ||0},false);
  }
  for(const g of guideState){
    if(!Array.isArray(g.start) || !Array.isArray(g.end)) continue;
    createConstructionGuide(new THREE.Vector3().fromArray(g.start),new THREE.Vector3().fromArray(g.end),{
      infinite:!!g.infinite,axis:g.axis||null,kind:g.kind||'guide',offset:Number.isFinite(g.offset)?g.offset:null,doHistory:false
    });
  }
  for(const sp of spaceState) createSpaceFromState(sp);

  // 1.100.34: projetos antigos podiam ter a Divisão vertical afinada/engrossada
  // ao redimensionar o móvel. Recupera a espessura nominal pelo material.
  for(const root of spaceRoots)repairVerticalDivisionThickness(root);

  // v99: projetos antigos podem já ter sido salvos depois de apagar uma
  // prateleira, deixando uma faixa de 18 mm sem peça e sem célula.
  // Repara essas faixas automaticamente ao abrir o projeto.
  for(let pass=0;pass<6;pass++){
    let changed=0;
    for(const root of spaceRoots)changed+=repairOrphanSpaceGaps(root).changes;
    if(!changed)break;
  }

  // 1.100.3: limpa duplicatas históricas de gavetas no mesmo vão.
  // Mantém o primeiro set encontrado e remove os demais.
  {
    const byTarget=new Map();
    for(const o of objects){
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
    const ids=new Set(objects.filter(o=>o.userData?.drawerSetId&&o.userData?.drawerConfig?.machineBottom).map(o=>o.userData.drawerSetId));
    for(const id of ids)drawerEnsureBottomGroovesForSet(id);
  }

  renderSpaces(); applyAllDoorVisibility(); renderMachiningVisuals();
  selectObject(objects.filter(o=>o.visible!==false).at(-1)||null); if(!objects.some(o=>o.visible!==false)) clearSpaceSelection();
  historyMuted=false;
}
function undo(){ if(historyIndex<=0){toast('Nada para desfazer');return;} historyIndex--; applyState(JSON.parse(history[historyIndex])); localStorage.setItem(STORAGE_KEY,history[historyIndex]); markCurrentProjectDirty(); }
function redo(){ if(historyIndex>=history.length-1){toast('Nada para refazer');return;} historyIndex++; applyState(JSON.parse(history[historyIndex])); localStorage.setItem(STORAGE_KEY,history[historyIndex]); markCurrentProjectDirty(); }



// ============================================================================
// 1.100.32 · AJUSTES RELATIVOS / POR FACE
// ============================================================================
const PIECE_RELATIVE_INPUT_IDS=[
  'pieceMoveX','pieceMoveY','pieceMoveZ',
  'pieceFaceLeft','pieceFaceRight',
  'pieceFaceBack','pieceFaceFront',
  'pieceFaceBottom','pieceFaceTop',
  'pieceRotX','pieceRotY','pieceRotZ'
];

function pieceRelativeNumber(id){
  const raw=String($(id)?.value??'0').trim().replace(',','.');
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}
function resetPieceRelativeInputs(){
  for(const id of PIECE_RELATIVE_INPUT_IDS){
    const el=$(id);if(el)el.value='0';
  }
}
function pieceRelativeEditable(mesh){
  if(!mesh)return {ok:false,message:'Selecione uma peça'};
  const u=mesh.userData||{};
  if(u.kind==='hardware-visual')return {ok:false,message:'Esta é uma ferragem visual. Edite pelo sistema de ferragens/corrediças.'};
  if(u.drawerSetId)return {ok:false,message:'Esta peça pertence a um conjunto paramétrico de gavetas. Edite pela ferramenta Gavetas / corrediças.'};
  if(u.kind==='curved-panel'||u.curvedRole)return {ok:false,message:'Peças do móvel curvo continuam sendo editadas pela ferramenta Móvel curvo.'};
  if(u.kind==='cylinder')return {ok:false,message:'Este ajuste é destinado às peças retangulares.'};
  return {ok:true};
}
function pieceLocalAxisVector(mesh,axis){
  const v=axis==='x'
    ? new THREE.Vector3(1,0,0)
    : axis==='y'
      ? new THREE.Vector3(0,1,0)
      : new THREE.Vector3(0,0,1);
  return v.applyQuaternion(mesh.quaternion).normalize();
}
function syncPieceRotationMetadata(mesh){
  if(!mesh)return;
  mesh.userData.rotationX=Number(mesh.rotation.x)||0;
  mesh.userData.rotationY=Number(mesh.rotation.y)||0;
  mesh.userData.rotationZ=Number(mesh.rotation.z)||0;
}
function applyPieceRelativeConfig(){
  const check=pieceRelativeEditable(selected);
  if(!check.ok){
    toast(check.message);
    if(selected?.userData?.drawerSetId)openDrawerSystemDialog(selected);
    return;
  }

  const moveMm={
    x:pieceRelativeNumber('pieceMoveX'),
    y:pieceRelativeNumber('pieceMoveY'),
    z:pieceRelativeNumber('pieceMoveZ')
  };

  // Cada valor representa o deslocamento DAQUELA FACE:
  // positivo = face anda para fora, aumentando a peça;
  // negativo = face anda para dentro, diminuindo a peça.
  const faceMm={
    left:pieceRelativeNumber('pieceFaceLeft'),
    right:pieceRelativeNumber('pieceFaceRight'),
    back:pieceRelativeNumber('pieceFaceBack'),
    front:pieceRelativeNumber('pieceFaceFront'),
    bottom:pieceRelativeNumber('pieceFaceBottom'),
    top:pieceRelativeNumber('pieceFaceTop')
  };

  const rotDeg={
    x:pieceRelativeNumber('pieceRotX'),
    y:pieceRelativeNumber('pieceRotY'),
    z:pieceRelativeNumber('pieceRotZ')
  };

  const nums=[...Object.values(moveMm),...Object.values(faceMm),...Object.values(rotDeg)];
  if(!nums.every(Number.isFinite)){
    toast('Confira os valores da configuração');
    return;
  }

  const u=selected.userData;
  const oldW=Number(u.width)||0;
  const oldD=Number(u.depth)||0;
  const oldH=Number(u.height)||0;

  // A dimensão total muda pela SOMA dos dois lados.
  // Ex.: somente Cima=-20 => altura perde EXATAMENTE 20 mm.
  const newW=oldW+m(faceMm.left+faceMm.right);
  const newD=oldD+m(faceMm.back+faceMm.front);
  const newH=oldH+m(faceMm.bottom+faceMm.top);

  if(newW<MIN_SIZE||newD<MIN_SIZE||newH<MIN_SIZE){
    toast('O ajuste deixaria a peça com medida menor que 1 mm');
    return;
  }
  if(newW>MAX_SIZE||newD>MAX_SIZE||newH>MAX_SIZE){
    toast('O ajuste ultrapassa a medida máxima permitida');
    return;
  }

  // Preserva a face oposta.
  //
  // X:
  // esquerda positiva expande para -X => centro vai -left/2
  // direita positiva expande para +X => centro vai +right/2
  //
  // Y:
  // baixo positivo expande para -Y
  // cima positivo expande para +Y
  //
  // Z:
  // trás positivo expande para -Z
  // frente positivo expande para +Z
  const shiftLocalX=m((faceMm.right-faceMm.left)/2);
  const shiftLocalY=m((faceMm.top-faceMm.bottom)/2);
  const shiftLocalZ=m((faceMm.front-faceMm.back)/2);

  if(Math.abs(shiftLocalX)>1e-12){
    selected.position.addScaledVector(pieceLocalAxisVector(selected,'x'),shiftLocalX);
  }
  if(Math.abs(shiftLocalY)>1e-12){
    selected.position.addScaledVector(pieceLocalAxisVector(selected,'y'),shiftLocalY);
  }
  if(Math.abs(shiftLocalZ)>1e-12){
    selected.position.addScaledVector(pieceLocalAxisVector(selected,'z'),shiftLocalZ);
  }

  if(
    Math.abs(newW-oldW)>1e-12||
    Math.abs(newD-oldD)>1e-12||
    Math.abs(newH-oldH)>1e-12
  ){
    setDimensions(selected,newW,newD,newH,false);
  }

  // Deslocamento da peça inteira nos eixos GLOBAIS.
  selected.position.x+=m(moveMm.x);
  selected.position.y+=m(moveMm.y);
  selected.position.z+=m(moveMm.z);

  // Rotação relativa.
  selected.rotation.order='XYZ';
  selected.rotation.x+=THREE.MathUtils.degToRad(rotDeg.x);
  selected.rotation.y+=THREE.MathUtils.degToRad(rotDeg.y);
  selected.rotation.z+=THREE.MathUtils.degToRad(rotDeg.z);
  syncPieceRotationMetadata(selected);

  selected.updateMatrixWorld(true);
  if(Array.isArray(u.machining)&&u.machining.length)renderMachiningVisuals();

  updateInspector();
  updateMeasureBadge();
  resetPieceRelativeInputs();
  commitHistory();

  const changedFaces=Object.entries(faceMm)
    .filter(([,v])=>Math.abs(v)>1e-12)
    .map(([k])=>({
      left:'esquerda',right:'direita',
      back:'trás',front:'frente',
      bottom:'baixo',top:'cima'
    }[k]));

  const parts=[];
  if(moveMm.x||moveMm.y||moveMm.z)parts.push('deslocada');
  if(changedFaces.length)parts.push(`faces: ${changedFaces.join(', ')}`);
  if(rotDeg.x||rotDeg.y||rotDeg.z)parts.push('rotacionada');

  toast(parts.length?`Peça ajustada · ${parts.join(' · ')}`:'Nenhum ajuste informado');
}

function setDimensions(mesh,width,depth,height,keepBase=true){
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  const oldBase=mesh.position.y-mesh.userData.height/2;
  if(mesh.userData.kind==='cylinder'){
    const d=width; mesh.scale.set(d,height,d); mesh.userData.width=d; mesh.userData.depth=d; mesh.userData.height=height;
  }else{
    mesh.userData.width=width; mesh.userData.depth=depth; mesh.userData.height=height;
    if(Array.isArray(mesh.userData.forms)&&mesh.userData.forms.length){mesh.scale.set(1,1,1);rebuildFormGeometry(mesh);}else mesh.scale.set(width,height,depth);
  }
  if(keepBase) mesh.position.y=oldBase+height/2;
  sanitizeMachiningForPiece(mesh);
}

function applyExactPanel(){
  if(!selected) return;
  if(selected.userData?.kind==='curved-panel'||selected.userData?.curvedRole){toast('Edite estruturas curvas/capas pela ferramenta Móvel curvo');return;}
  if(selected.userData?.drawerSetId){toast('Edite este conjunto pela ferramenta Gavetas / corrediças');openDrawerSystemDialog(selected);return;}
  const w=clampSize(m($('dimW').value)), d=clampSize(m($('dimD').value)), h=clampSize(m($('dimH').value));
  const x=m($('posX').value), yBase=m($('posY').value), z=m($('posZ').value);
  if(![w,d,h,x,yBase,z].every(Number.isFinite)){ toast('Confira os valores'); return; }
  selected.userData.name=$('partNameInput').value.trim() || selected.userData.name || 'Peça';
  setDimensions(selected,w,d,h,false);
  selected.position.set(x,yBase+h/2,z);
  syncPieceRotationMetadata(selected);
  updateInspector(); updateMeasureBadge(); commitHistory(); toast('Medidas aplicadas');
}

function rotateBox(axis){
  if(!selected) return;
  if(Array.isArray(selected.userData?.forms)&&selected.userData.forms.length){toast('Remova ou edite a Forma antes de girar a peça');return;}
  if(selected.userData.kind==='cylinder'){ toast('Rotação de cilindro ainda não é necessária'); return; }
  const u=selected.userData;
  const base=selected.position.y-u.height/2;
  let w=u.width,d=u.depth,h=u.height;
  if(axis==='x'){ remapMachiningAxes(u,'y','z'); [d,h]=[h,d]; }
  if(axis==='y'){ remapMachiningAxes(u,'x','z'); [w,d]=[d,w]; }
  if(axis==='z'){ remapMachiningAxes(u,'x','y'); [w,h]=[h,w]; }
  setDimensions(selected,w,d,h,false);
  selected.position.y=base+h/2;
  if(u.kind==='panel') u.materialType='MDF';
  updateInspector(); updateMeasureBadge(); commitHistory();
}

function rotateSelectedPieceGrain(){
  if(!selected){toast('Selecione uma peça');return;}
  const u=selected.userData||{};
  if(u.kind==='cylinder'||u.kind==='hardware-visual'){toast('Esta opção é para peças de chapa');return;}
  if(!u.materialGrain){toast('O material desta peça não está marcado como madeirado / com veio');return;}
  u.materialGrainRotation=normalizePieceGrainRotation(u.materialGrainRotation)===90?0:90;
  updateInspector();
  commitHistory();
  toast(u.materialGrainRotation===90?'Veio da peça rotacionado 90° · geometria não foi alterada':'Veio da peça voltou ao sentido original');
}

function setSelectedPieceDoNotProduce(enabled){
  if(!selected){toast('Selecione uma peça');return;}
  const u=selected.userData||{};
  if(u.kind==='cylinder'||u.kind==='hardware-visual')return;
  u.excludeFromCutList=!!enabled;
  updateInspector();
  commitHistory();
  toast(u.excludeFromCutList?'Peça marcada como NÃO PRODUZIR · removida do plano de corte':'Peça voltou para produção · será incluída no plano de corte');
}

let duplicatePieceLocked=false;
let duplicatePieceUnlockTimer=null;

function cancelDuplicateConfirmation(){
  const row=$('duplicateConfirmRow');if(row)row.classList.remove('show');
  const btn=$('duplicateBtn');if(btn&&!duplicatePieceLocked)btn.disabled=false;
}
function requestDuplicateSelected(){
  if(!selected){toast('Selecione uma peça');return;}
  if(selected.userData?.drawerSetId){
    toast('O conjunto de gavetas é paramétrico. Edite ou crie outro conjunto pelo espaço.');
    openDrawerSystemDialog(selected);return;
  }
  const row=$('duplicateConfirmRow'),txt=$('duplicateConfirmText');
  if(txt)txt.textContent=`Duplicar “${selected.userData?.name||'Peça'}”? Toque em Confirmar duplicação.`;
  row?.classList.add('show');
}
function confirmDuplicateSelected(){
  const row=$('duplicateConfirmRow');row?.classList.remove('show');
  duplicateSelected();
}

function duplicateSelected(){
  if(!selected)return;

  if(selected.userData?.drawerSetId){
    toast('O conjunto de gavetas é paramétrico. Edite ou crie outro conjunto pelo espaço.');
    openDrawerSystemDialog(selected);
    return;
  }

  // Proteção para Android/touch: um acionamento nunca pode criar 2 cópias.
  if(duplicatePieceLocked)return;
  duplicatePieceLocked=true;

  const btn=$('duplicateBtn');
  if(btn)btn.disabled=true;

  const source=selected;
  const u=source.userData;
  const yBase=source.position.y-u.height/2;

  const opts={
    width:u.width,depth:u.depth,height:u.height,
    x:source.position.x+.03,yBase,z:source.position.z+.03,
    name:(u.name||'Peça')+' cópia',
    kind:u.kind,materialType:u.materialType,baseColor:u.baseColor,
    materialId:u.materialId||null,materialCode:u.materialCode||'',
    materialGrain:!!u.materialGrain,materialGrainRotation:normalizePieceGrainRotation(u.materialGrainRotation),materialCoreColor:u.materialCoreColor||null,
    edgeBands:productionClone(u.edgeBands||{}),
    labelMeta:{...(u.labelMeta||{}),schemaVersion:1},
    spaceRootId:u.spaceRootId||null,
    machining:JSON.parse(JSON.stringify(u.machining||[])),
    forms:JSON.parse(JSON.stringify(u.forms||[])),
    rotationX:Number(source.rotation.x)||0,
    rotationY:Number(source.rotation.y)||0,
    rotationZ:Number(source.rotation.z)||0,
    excludeFromCutList:!!u.excludeFromCutList,
    spaceCutting:!!u.spaceCutting,
    spaceCutParentBounds:u.spaceCutParentBounds?JSON.parse(JSON.stringify(u.spaceCutParentBounds)):null
  };

  let copy=null;
  try{
    // Todos os criadores recebem doHistory=false. No fim fazemos um único commit.
    if(u.kind==='cylinder'){
      copy=createCylinder({
        diameter:u.width,height:u.height,x:opts.x,yBase,z:opts.z,name:opts.name
      },false);
    }else if(u.kind==='curved-panel'&&u.customProfile?.cfg){
      copy=createCurvedRib({
        cfg:u.customProfile.cfg,yBase,
        x:(Number.isFinite(u.curvedTargetX)?u.curvedTargetX:source.position.x)+.03,
        z:(Number.isFinite(u.curvedTargetZ)?u.curvedTargetZ:source.position.z)+.03,
        name:opts.name,spaceRootId:u.spaceRootId||null,
        part:u.customProfile.part||u.curvedPart||'full'
      },false);
    }else if(u.curvedRole==='cover'&&u.curvedConfig){
      copy=createCurvedCover({
        cfg:u.curvedConfig,yBase,x:opts.x,z:opts.z,name:opts.name,
        spaceRootId:u.spaceRootId||null,
        part:u.curvedPart||u.curvedConfig.coverPart||'full'
      },false);
    }else if(u.curvedRole==='post'&&u.curvedConfig){
      copy=createCurvedPost({
        cfg:u.curvedConfig,yBase,x:opts.x,z:opts.z,name:opts.name,
        spaceRootId:u.spaceRootId||null,
        rotationY:Number(source.rotation.y)||0
      },false);
    }else{
      copy=createBox(opts,false);
    }

    if(copy){
      copy.userData.excludeFromCutList=!!u.excludeFromCutList;
      copy.userData.spaceCutting=!!u.spaceCutting;
      commitHistory();
      openPieceInspector(copy);
      toast('1 cópia criada');
    }
  }finally{
    clearTimeout(duplicatePieceUnlockTimer);
    duplicatePieceUnlockTimer=setTimeout(()=>{
      duplicatePieceLocked=false;
      if(btn)btn.disabled=false;
    },700);
  }
}

function deleteSelectedFromInspector(){
  if(!selected){
    toast('Selecione uma peça');
    return;
  }

  // Gaveta paramétrica usa a confirmação própria da rotina existente.
  if(selected.userData?.drawerSetId){
    deleteSelected();
    return;
  }

  const name=selected.userData?.name||'Peça';
  if(!window.confirm(`Apagar a peça “${name}”?\n\nO espaço será recalculado quando necessário.`))return;

  deleteSelected();
  $('inspector').classList.add('compact');
  $('inspector').style.display='none';
}

// ============================================================================
// v100 · RECALCULAR VÃOS QUANDO UMA PEÇA É APAGADA
// ============================================================================
const SPACE_HEAL_TOL=.0008;
const SPACE_HEAL_MAX_GAP=.120;

function cellAxisMin(c,axis){return axis==='x'?c.minX:axis==='y'?c.minY:c.minZ;}
function cellAxisMax(c,axis){return axis==='x'?c.maxX:axis==='y'?c.maxY:c.maxZ;}
function setCellAxisMin(c,axis,v){if(axis==='x')c.minX=v;else if(axis==='y')c.minY=v;else c.minZ=v;}
function setCellAxisMax(c,axis,v){if(axis==='x')c.maxX=v;else if(axis==='y')c.maxY=v;else c.maxZ=v;}
function tangentAxesForSpace(axis){return axis==='x'?['y','z']:axis==='y'?['x','z']:['x','y'];}
function almostSpace(a,b,tol=SPACE_HEAL_TOL){return Math.abs(Number(a)-Number(b))<=tol;}
function sameCellTangents(a,b,axis,tol=SPACE_HEAL_TOL){
  const [u,v]=tangentAxesForSpace(axis);
  return almostSpace(cellAxisMin(a,u),cellAxisMin(b,u),tol)
      && almostSpace(cellAxisMax(a,u),cellAxisMax(b,u),tol)
      && almostSpace(cellAxisMin(a,v),cellAxisMin(b,v),tol)
      && almostSpace(cellAxisMax(a,v),cellAxisMax(b,v),tol);
}
function cellBox(c){return {minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ};}
function boxAxisMin(b,a){return a==='x'?b.minX:a==='y'?b.minY:b.minZ;}
function boxAxisMax(b,a){return a==='x'?b.maxX:a==='y'?b.maxY:b.maxZ;}
function setBoxAxisMin(b,a,v){if(a==='x')b.minX=v;else if(a==='y')b.minY=v;else b.minZ=v;}
function setBoxAxisMax(b,a,v){if(a==='x')b.maxX=v;else if(a==='y')b.maxY=v;else b.maxZ=v;}
function boxOverlapMeters(a,b,axis){
  return Math.min(boxAxisMax(a,axis),boxAxisMax(b,axis))-Math.max(boxAxisMin(a,axis),boxAxisMin(b,axis));
}
function boxesOverlapVolume(a,b,tol=SPACE_HEAL_TOL){
  return boxOverlapMeters(a,b,'x')>tol && boxOverlapMeters(a,b,'y')>tol && boxOverlapMeters(a,b,'z')>tol;
}
function gapBoxBetweenCells(a,b,axis){
  const box={...cellBox(a)};
  const a0=cellAxisMin(a,axis),a1=cellAxisMax(a,axis),b0=cellAxisMin(b,axis),b1=cellAxisMax(b,axis);
  if(a1<b0){
    setBoxAxisMin(box,axis,a1);setBoxAxisMax(box,axis,b0);
  }else if(b1<a0){
    setBoxAxisMin(box,axis,b1);setBoxAxisMax(box,axis,a0);
  }else return null;
  return box;
}
function objectOccupiesSpaceGap(root,gapBox,axis,exclude=null){
  const [u,v]=tangentAxesForSpace(axis);
  for(const o of objects){
    if(o===exclude)continue;
    const ud=o.userData||{};
    if(ud.kind==='hardware-visual'||ud.kind==='cylinder')continue;
    const belongs=ud.spaceRootId===root.id || objectInsideSpaceRoot(o,root,.006);
    if(!belongs)continue;

    // Só uma peça cuja ESPESSURA está no mesmo eixo do GAP pode bloquear
    // a recomposição daquele vão. Ex.: prateleira => GAP em Y.
    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!==axis)continue;

    const b=getBounds(o);
    const axisOv=boxOverlapMeters(b,gapBox,axis);
    if(axisOv<=SPACE_HEAL_TOL)continue;

    const ovU=boxOverlapMeters(b,gapBox,u),ovV=boxOverlapMeters(b,gapBox,v);
    if(ovU>.004&&ovV>.004)return true;
  }
  return false;
}
function anotherCellOccupiesGap(root,gapBox,ignore=[]){
  const ignored=new Set(ignore);
  return root.cells.some(c=>!ignored.has(c)&&boxesOverlapVolume(cellBox(c),gapBox,.0002));
}
function mergedCellFromPair(a,b,axis){
  const c={
    id:uid('cell'),
    hidden:!!(a.hidden&&b.hidden),
    fixedAxes:{
      x:!!(a.fixedAxes?.x&&b.fixedAxes?.x),
      y:!!(a.fixedAxes?.y&&b.fixedAxes?.y),
      z:!!(a.fixedAxes?.z&&b.fixedAxes?.z)
    },
    minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),
    minY:Math.min(a.minY,b.minY),maxY:Math.max(a.maxY,b.maxY),
    minZ:Math.min(a.minZ,b.minZ),maxZ:Math.max(a.maxZ,b.maxZ)
  };
  setCellAxisMin(c,axis,Math.min(cellAxisMin(a,axis),cellAxisMin(b,axis)));
  setCellAxisMax(c,axis,Math.max(cellAxisMax(a,axis),cellAxisMax(b,axis)));
  return c;
}
function tryMergeOneOrphanGap(root,exclude=null){
  for(const axis of ['x','y','z']){
    for(let i=0;i<root.cells.length;i++){
      const a=root.cells[i];
      for(let j=i+1;j<root.cells.length;j++){
        const b=root.cells[j];
        if(!sameCellTangents(a,b,axis))continue;
        const gap=gapBoxBetweenCells(a,b,axis);if(!gap)continue;
        const size=boxAxisMax(gap,axis)-boxAxisMin(gap,axis);
        if(size<=SPACE_HEAL_TOL||size>SPACE_HEAL_MAX_GAP)continue;
        if(objectOccupiesSpaceGap(root,gap,axis,exclude))continue;
        if(anotherCellOccupiesGap(root,gap,[a,b]))continue;
        const merged=mergedCellFromPair(a,b,axis);
        root.cells.splice(j,1);root.cells.splice(i,1,merged);
        return {kind:'merge',axis,size,cell:merged};
      }
    }
  }
  return null;
}
function blockingIntervalsInBoundaryGap(root,gapBox,axis,exclude=null){
  const [u,v]=tangentAxesForSpace(axis),out=[];
  for(const o of objects){
    if(o===exclude)continue;
    const ud=o.userData||{};
    if(ud.kind==='hardware-visual'||ud.kind==='cylinder')continue;
    const belongs=ud.spaceRootId===root.id || objectInsideSpaceRoot(o,root,.006);
    if(!belongs)continue;

    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!==axis)continue;

    const b=getBounds(o);
    if(boxOverlapMeters(b,gapBox,axis)<=SPACE_HEAL_TOL)continue;
    if(boxOverlapMeters(b,gapBox,u)<=.004||boxOverlapMeters(b,gapBox,v)<=.004)continue;

    const a=Math.max(boxAxisMin(b,axis),boxAxisMin(gapBox,axis));
    const z=Math.min(boxAxisMax(b,axis),boxAxisMax(gapBox,axis));
    if(z-a>SPACE_HEAL_TOL)out.push([a,z]);
  }
  return out;
}
function tryHealOneBoundaryGap(root,exclude=null){
  const rb=rootBounds(root);
  for(const axis of ['x','y','z']){
    const rootMin=boxAxisMin(rb,axis),rootMax=boxAxisMax(rb,axis);

    for(const c of root.cells){
      for(const side of ['min','max']){
        const edge=side==='min'?cellAxisMin(c,axis):cellAxisMax(c,axis);
        const boundary=side==='min'?rootMin:rootMax;
        const rawSize=side==='min'?edge-boundary:boundary-edge;
        if(rawSize<=SPACE_HEAL_TOL||rawSize>SPACE_HEAL_MAX_GAP)continue;

        const gap={...cellBox(c)};
        if(side==='min'){
          setBoxAxisMin(gap,axis,boundary);
          setBoxAxisMax(gap,axis,edge);
        }else{
          setBoxAxisMin(gap,axis,edge);
          setBoxAxisMax(gap,axis,boundary);
        }

        if(anotherCellOccupiesGap(root,gap,[c]))continue;

        // Em vez de cancelar o reparo porque existe uma base/lateral/chapéu
        // dentro do GAP, encontramos a peça legítima mais próxima do vão.
        // O espaço cresce ATÉ essa peça, cobrindo somente a faixa órfã.
        const blockers=blockingIntervalsInBoundaryGap(root,gap,axis,exclude);
        let target=boundary;

        if(side==='min'){
          // Ex.: raiz 0, base 0..18, prateleira apagada 18..36,
          // vão atual começa em 36. O alvo correto é 18, não 0.
          for(const [,end] of blockers){
            if(end<=edge+SPACE_HEAL_TOL)target=Math.max(target,end);
          }
          const healSize=edge-target;
          if(healSize<=SPACE_HEAL_TOL||healSize>SPACE_HEAL_MAX_GAP)continue;

          const orphan={...cellBox(c)};
          setBoxAxisMin(orphan,axis,target);
          setBoxAxisMax(orphan,axis,edge);
          if(anotherCellOccupiesGap(root,orphan,[c]))continue;

          setCellAxisMin(c,axis,target);
          c.hidden=false;
          return {kind:'boundary',axis,size:healSize,cell:c,target};
        }else{
          for(const [start] of blockers){
            if(start>=edge-SPACE_HEAL_TOL)target=Math.min(target,start);
          }
          const healSize=target-edge;
          if(healSize<=SPACE_HEAL_TOL||healSize>SPACE_HEAL_MAX_GAP)continue;

          const orphan={...cellBox(c)};
          setBoxAxisMin(orphan,axis,edge);
          setBoxAxisMax(orphan,axis,target);
          if(anotherCellOccupiesGap(root,orphan,[c]))continue;

          setCellAxisMax(c,axis,target);
          c.hidden=false;
          return {kind:'boundary',axis,size:healSize,cell:c,target};
        }
      }
    }
  }
  return null;
}
function repairOrphanSpaceGaps(root,{exclude=null,maxPasses=80}={}){
  if(!root||!Array.isArray(root.cells)||!root.cells.length)return {changes:0,cell:null};
  let changes=0,lastCell=null;
  for(let n=0;n<maxPasses;n++){
    const r=tryMergeOneOrphanGap(root,exclude);
    if(!r)break;changes++;lastCell=r.cell;
  }
  for(let n=0;n<maxPasses;n++){
    const r=tryHealOneBoundaryGap(root,exclude);
    if(!r)break;changes++;lastCell=r.cell;
  }
  return {changes,cell:lastCell};
}
function repairAllOrphanSpaceGaps(){
  let changes=0;
  for(const root of spaceRoots)changes+=repairOrphanSpaceGaps(root).changes;
  if(changes){
    renderSpaces();
    console.info(`DesignLabMoveis: ${changes} faixa(s) órfã(s) recuperada(s).`);
  }
  return changes;
}
function bestCellNearPoint(root,p){
  const visible=(root?.cells||[]).filter(c=>!c.hidden);
  if(!visible.length)return null;
  const inside=visible.find(c=>p.x>=c.minX-SPACE_HEAL_TOL&&p.x<=c.maxX+SPACE_HEAL_TOL&&p.y>=c.minY-SPACE_HEAL_TOL&&p.y<=c.maxY+SPACE_HEAL_TOL&&p.z>=c.minZ-SPACE_HEAL_TOL&&p.z<=c.maxZ+SPACE_HEAL_TOL);
  if(inside)return inside;
  return visible.reduce((best,c)=>distanceSqPointToCell(p,c)<distanceSqPointToCell(p,best)?c:best,visible[0]);
}

// 1.100.95 · ao apagar uma peça estrutural, devolve exatamente a faixa que ela ocupava
// ao(s) vão(s) vizinho(s). Isso resolve principalmente lateral esquerda/direita,
// base, chapéu, prateleira, fundo/frente e divisão vertical.
function isSpaceCuttingPieceForHeal(o){
  if(!o||o.userData?.kind!=='panel'||isDoorObject(o)||o.userData?.drawerRole||o.userData?.curvedRole)return false;
  if(o.userData?.spaceCutting===true)return true;
  const n=String(o.userData?.name||'').trim();
  return /^(Lateral esquerda|Lateral direita|Divisão vertical|Base|Chapéu|Prateleira(?:\s+\d+)?|Fundo|Frente)$/i.test(n);
}
function deletedPieceAxisBounds(b,axis){
  return axis==='x'?[b.minX,b.maxX]:axis==='y'?[b.minY,b.maxY]:[b.minZ,b.maxZ];
}
function deletedPieceTangentOverlap(cell,b,axis){
  const [u,v]=tangentAxesForSpace(axis);
  return boxOverlapMeters(cellBox(cell),b,u)>SPACE_HEAL_TOL && boxOverlapMeters(cellBox(cell),b,v)>SPACE_HEAL_TOL;
}
function removeDeletedDivisionFixedBand(root,o,b,axis){
  if(!root||axis!=='x'||!isVerticalDivisionPiece(o,root))return 0;
  const rb=rootBounds(root),rootMin=rb.minX;
  const a=b.minX-rootMin,z=b.maxX-rootMin,tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  const before=(root.fixedBands?.x||[]).length;
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands.x=(root.fixedBands.x||[]).filter(([s,e])=>!(Math.abs(Number(s)-a)<=tol&&Math.abs(Number(e)-z)<=tol));
  return before-root.fixedBands.x.length;
}
function spaceBoundaryRoleForHeal(o,axis){
  const n=String(o?.userData?.name||'').trim().toLowerCase();
  if(axis==='x'){
    if(/^lateral esquerda$/i.test(n))return 'min';
    if(/^lateral direita$/i.test(n))return 'max';
  }
  if(axis==='y'){
    if(/^base$/i.test(n))return 'min';
    if(/^(chapéu|chapeu|topo)$/i.test(n))return 'max';
  }
  if(axis==='z'){
    if(/^fundo(?: 6 mm)?$/i.test(n))return 'min';
    if(/^frente$/i.test(n))return 'max';
  }
  return null;
}
function validStoredSpaceCutParentBounds(o){
  const b=o?.userData?.spaceCutParentBounds;
  if(!b)return null;
  const keys=['minX','maxX','minY','maxY','minZ','maxZ'];
  if(!keys.every(k=>Number.isFinite(Number(b[k]))))return null;
  const out={};for(const k of keys)out[k]=Number(b[k]);
  return out.maxX>out.minX&&out.maxY>out.minY&&out.maxZ>out.minZ?out:null;
}
function cellTangentOverlapWithDeletedPiece(c,b,axis){
  const [u,v]=tangentAxesForSpace(axis);
  return boxOverlapMeters(cellBox(c),b,u)>SPACE_HEAL_TOL && boxOverlapMeters(cellBox(c),b,v)>SPACE_HEAL_TOL;
}
function restoreBoundaryPieceThickness(root,o,b,axis,role){
  const [d0,d1]=deletedPieceAxisBounds(b,axis),tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  const parent=validStoredSpaceCutParentBounds(o);
  // Para peças criadas a partir desta versão, o limite é o limite original do
  // vão. Para projetos antigos usamos a própria face externa da peça: isso é
  // suficiente para devolver exatamente a espessura sem atravessar o corte
  // manual que existe do outro lado da lateral/base/chapéu/fundo/frente.
  const target=role==='min'
    ? (parent?Math.max(boxAxisMin(parent,axis),Math.min(d0,d1)):d0)
    : (parent?Math.min(boxAxisMax(parent,axis),Math.max(d0,d1)):d1);
  const insideFace=role==='min'?d1:d0;
  let changes=0,lastCell=null;
  const candidates=root.cells.filter(c=>cellTangentOverlapWithDeletedPiece(c,b,axis));
  for(const c of candidates){
    const touchesInside=role==='min'
      ? almostSpace(cellAxisMin(c,axis),insideFace,tol)
      : almostSpace(cellAxisMax(c,axis),insideFace,tol);
    if(!touchesInside)continue;
    const gap={...cellBox(c)};
    if(role==='min'){
      setBoxAxisMin(gap,axis,target);setBoxAxisMax(gap,axis,cellAxisMin(c,axis));
    }else{
      setBoxAxisMin(gap,axis,cellAxisMax(c,axis));setBoxAxisMax(gap,axis,target);
    }
    if(boxAxisMax(gap,axis)-boxAxisMin(gap,axis)<=SPACE_HEAL_TOL)continue;
    // Outra divisão pode encostar no lado de fora, mas não pode ocupar o volume
    // que era da peça apagada. Assim o vão de 60 mm volta a 60 mm sem juntar
    // com os espaços grandes à esquerda/direita.
    if(objectOccupiesSpaceGap(root,gap,axis,null)||anotherCellOccupiesGap(root,gap,[c]))continue;
    if(role==='min')setCellAxisMin(c,axis,target);else setCellAxisMax(c,axis,target);
    c.hidden=false;changes++;lastCell=c;
  }
  // Caso a peça ocupasse 100% do vão, não existe célula interna para expandir.
  // Se conhecemos o vão original, recriamos a célula inteira.
  if(!changes&&parent){
    const free={id:uid('cell'),hidden:false,fixedAxes:{},...parent};
    if(!root.cells.some(c=>boxesOverlapVolume(cellBox(c),parent,.0002)) && !objectOccupiesSpaceGap(root,parent,axis,null)){
      root.cells.push(free);changes++;lastCell=free;
    }
  }
  return {changes,cell:lastCell};
}
function reclaimDeletedPieceSpace(root,o,deletedBounds){
  if(!root||!deletedBounds||!isSpaceCuttingPieceForHeal(o))return {changes:0,cell:null};
  const ti=pieceThicknessInfo(o);if(!ti)return {changes:0,cell:null};
  const axis=ti.thicknessAxis,[d0,d1]=deletedPieceAxisBounds(deletedBounds,axis),tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  let changes=0,lastCell=null;

  removeDeletedDivisionFixedBand(root,o,deletedBounds,axis);

  // Laterais/base/chapéu/fundo/frente são bordas DO VÃO EM QUE FORAM CRIADAS,
  // não necessariamente bordas do móvel principal. Ao apagar, devolvemos só a
  // espessura da peça para dentro daquele vão. Esse é o caso de um corte de
  // 60 mm com duas laterais: 60 -> 24 livres; apagando ambas volta exatamente 60.
  const boundaryRole=spaceBoundaryRoleForHeal(o,axis);
  if(boundaryRole){
    const r=restoreBoundaryPieceThickness(root,o,deletedBounds,axis,boundaryRole);
    return r;
  }

  // Peças internas, como Divisão vertical e Prateleira, realmente separam dois
  // vãos. Ao apagar, une somente os dois compartimentos que encostavam nas duas
  // faces da peça.
  let merged=true;
  while(merged){
    merged=false;
    outer:
    for(let i=0;i<root.cells.length;i++){
      const a=root.cells[i];
      if(!deletedPieceTangentOverlap(a,deletedBounds,axis))continue;
      for(let j=i+1;j<root.cells.length;j++){
        const c=root.cells[j];
        if(!deletedPieceTangentOverlap(c,deletedBounds,axis)||!sameCellTangents(a,c,axis,tol))continue;
        const aLow=almostSpace(cellAxisMax(a,axis),d0,tol)&&almostSpace(cellAxisMin(c,axis),d1,tol);
        const cLow=almostSpace(cellAxisMax(c,axis),d0,tol)&&almostSpace(cellAxisMin(a,axis),d1,tol);
        if(!aLow&&!cLow)continue;
        const gap=gapBoxBetweenCells(a,c,axis);
        if(!gap||objectOccupiesSpaceGap(root,gap,axis,null)||anotherCellOccupiesGap(root,gap,[a,c]))continue;
        const joined=mergedCellFromPair(a,c,axis);
        root.cells.splice(j,1);root.cells.splice(i,1,joined);
        changes++;lastCell=joined;merged=true;break outer;
      }
    }
  }

  // Compatibilidade: se uma peça estrutural antiga estiver na borda real do
  // móvel e não tiver metadados do vão, ainda recupera a faixa até o root.
  if(!changes){
    const rb=rootBounds(root),r0=boxAxisMin(rb,axis),r1=boxAxisMax(rb,axis);
    const touchesMin=d0<=r0+tol,touchesMax=d1>=r1-tol;
    if(touchesMin||touchesMax){
      const role=touchesMin?'min':'max';
      const r=restoreBoundaryPieceThickness(root,o,deletedBounds,axis,role);
      changes+=r.changes;lastCell=r.cell||lastCell;
    }
  }
  return {changes,cell:lastCell};
}

function deleteSelected(){
  if(!selected) return;
  const setId=selected.userData?.drawerSetId;
  if(setId){
    const cfg=selected.userData?.drawerConfig||{};
    if(!window.confirm(`Excluir o conjunto de gavetas “${cfg.name||cfg.slideName||'Gavetas'}” inteiro?\n\nAs furações automáticas ligadas às corrediças também serão removidas.`))return;
    removeDrawerSet(setId,{commit:true});
    toast('Conjunto de gavetas excluído');
    return;
  }

  const o=selected;
  const root=rootForObject(o);
  const oldCenter=o.position.clone();
  const deletedBounds=root?{...getBounds(o)}:null;

  // Antes de remover a peça, elimina a aplicação completa das ferragens
  // vinculadas a ela nas outras peças. Assim não sobram pontos rosa no ar.
  const hardwareRemoved=removeHardwareLinkedToObjects([o]);

  const i=objects.indexOf(o);if(i>=0)objects.splice(i,1);
  disposeObject(o);
  selectObject(null);

  let healed=0,targetCell=null;
  if(root){
    // Primeiro devolve diretamente ao espaço a faixa ocupada pela peça apagada.
    // Depois roda o reparo genérico para consolidar qualquer faixa órfã restante.
    const direct=reclaimDeletedPieceSpace(root,o,deletedBounds);
    const first=repairOrphanSpaceGaps(root,{exclude:o});
    const second=repairOrphanSpaceGaps(root);
    healed=direct.changes+first.changes+second.changes;

    if(healed){
      renderSpaces();
      targetCell=bestCellNearPoint(root,oldCenter)||second.cell||first.cell||direct.cell||largestVisibleCell(root);
      if(targetCell)selectSpaceCellByIds(root.id,targetCell.id,{showMenu:false});
      else selectSpaceRootOnly(root,{showMenu:false});
    }
  }

  if(root){
    // Garante que a geometria visual das células reflita imediatamente
    // os limites recalculados, inclusive quando a peça estava colada na base.
    renderSpaces();
    targetCell=bestCellNearPoint(root,oldCenter)||targetCell||largestVisibleCell(root);
    if(targetCell)selectSpaceCellByIds(root.id,targetCell.id);
  }

  renderMachiningVisuals();
  commitHistory();
  const hwText=hardwareRemoved.instances?` · ${hardwareRemoved.instances} ferragem(ns) vinculada(s) removida(s)`:'';
  toast((healed?`Peça excluída · espaço recalculado (${healed} ajuste${healed===1?'':'s'})`:'Peça excluída')+hwText);
}

function getClientPoint(event){
  return { x:event.clientX, y:event.clientY };
}
function getPointerNDC(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  return getClientPoint(event);
}
function intersectPlane(plane,target=new THREE.Vector3()){
  raycaster.setFromCamera(pointer,camera);
  return raycaster.ray.intersectPlane(plane,target);
}
function intersectGround(){
  raycaster.setFromCamera(pointer,camera); const p=new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane,p) ? p : new THREE.Vector3();
}
function closestParamOnAxis(linePoint,lineDir){
  raycaster.setFromCamera(pointer,camera);
  const O1=raycaster.ray.origin,D1=raycaster.ray.direction.clone().normalize(),O2=linePoint,D2=lineDir.clone().normalize();
  const r=new THREE.Vector3().subVectors(O1,O2);
  const a=D1.dot(D1),b=D1.dot(D2),c=D2.dot(D2),d=D1.dot(r),e=D2.dot(r),den=a*c-b*b;
  if(Math.abs(den)<1e-8) return 0;
  return (a*e-b*d)/den;
}
function worldAxisForFace(hit,obj){
  const n=hit.face.normal.clone().transformDirection(obj.matrixWorld);
  const ax=Math.abs(n.x), ay=Math.abs(n.y), az=Math.abs(n.z);
  if(ax>=ay && ax>=az) return {axis:'x',sign:Math.sign(n.x)||1};
  if(ay>=ax && ay>=az) return {axis:'y',sign:Math.sign(n.y)||1};
  return {axis:'z',sign:Math.sign(n.z)||1};
}

function worldToClient(v){
  // Usa o retângulo REAL do canvas. Em Android/WebView innerWidth/innerHeight
  // podem divergir alguns pixels da área efetivamente usada pelo WebGL.
  camera.updateMatrixWorld(true);
  const rect=renderer.domElement.getBoundingClientRect();
  const p=v.clone().project(camera);
  return new THREE.Vector2(
    rect.left + (p.x*.5+.5)*rect.width,
    rect.top  + (-p.y*.5+.5)*rect.height
  );
}
function inferMoveAxis(event){
  const motion=new THREE.Vector2(event.clientX-moveDownAim.x,event.clientY-moveDownAim.y);
  const motionLen=motion.length();
  if(motionLen<AXIS_INFERENCE_MIN_PX) return null;
  motion.normalize();
  const base=worldToClient(movePickPoint);
  let best=null;
  for(const [axis,dir] of Object.entries({x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)})){
    const end=worldToClient(movePickPoint.clone().add(dir));
    const sv=end.sub(base);
    if(sv.length()<14) continue;
    sv.normalize();
    const dot=Math.abs(motion.dot(sv));
    const angle=Math.acos(THREE.MathUtils.clamp(dot,-1,1));
    if(angle<=AXIS_INFERENCE_ANGLE && (!best || angle<best.angle)) best={axis,angle};
  }
  return best?.axis || null;
}
function axisVector(axis){
  return axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
}

// PEÇAS: 1 clique seleciona; segurar abre Configuração da peça.
// ESPAÇOS/DIVISÕES: 1 clique seleciona; segurar abre o menu flutuante.
// O antigo duplo clique do espaço foi removido na 1.100.95.
let spaceTapState={count:0,lastAt:0,lastX:0,lastY:0,rootId:null,cellId:null};
const SPACE_MULTI_TAP_GAP_MS=560;
const SPACE_MULTI_TAP_PX=64;
function resetSpaceDoubleTap(){
  spaceTapState={count:0,lastAt:0,lastX:0,lastY:0,rootId:null,cellId:null};
}
function registerSpaceDoubleTap(rootId,cellId){
  const now=performance.now();
  const distance=Math.hypot(downClientX-spaceTapState.lastX,downClientY-spaceTapState.lastY);
  const closeEnough=distance<=SPACE_MULTI_TAP_PX;
  const elapsed=now-spaceTapState.lastAt;
  const inTime=elapsed<=SPACE_MULTI_TAP_GAP_MS;
  const sameTarget=spaceTapState.rootId===rootId && spaceTapState.cellId===cellId;

  // Alguns WebViews Android podem repetir o pointerdown do mesmo contato quase
  // instantaneamente. Isso não deve virar um falso "duplo toque". Um segundo
  // toque real precisa ter uma pequena separação temporal.
  const looksLikeDuplicateEvent=spaceTapState.count && sameTarget && distance<=12 && elapsed>=0 && elapsed<110;
  if(looksLikeDuplicateEvent)return false;

  if(spaceTapState.count && closeEnough && inTime && sameTarget){
    resetSpaceDoubleTap();
    return true;
  }
  spaceTapState={count:1,lastAt:now,lastX:downClientX,lastY:downClientY,rootId,cellId};
  return false;
}

// 1.100.95 · menu do espaço igual ao menu da peça:
// 1 toque = somente seleciona; tocar/clicar e SEGURAR = abre o menu flutuante.
let spaceLongPressTimer=null;
let spaceLongPress={id:null,rootId:null,cellId:null,x:0,y:0,triggered:false};
const SPACE_LONG_PRESS_MS=520;
const SPACE_LONG_PRESS_MOVE_PX=18;
function cancelSpaceLongPress(){
  if(spaceLongPressTimer){clearTimeout(spaceLongPressTimer);spaceLongPressTimer=null;}
  spaceLongPress={id:null,rootId:null,cellId:null,x:0,y:0,triggered:false};
}
function startSpaceLongPress(rootId,cellId,pointerId,x,y){
  cancelSpaceLongPress();
  if(toolMode!=='select'||!rootId||!cellId)return;
  spaceLongPress={id:pointerId,rootId,cellId,x,y,triggered:false};
  spaceLongPressTimer=setTimeout(()=>{
    spaceLongPressTimer=null;
    const root=getSpaceRoot(rootId),cell=getSpaceCell(rootId,cellId);
    if(toolMode!=='select'||!root||!cell)return;
    spaceLongPress.triggered=true;
    resetSpaceDoubleTap();
    selectSpaceCellByIds(rootId,cellId,{showMenu:true});
    try{if(navigator.vibrate)navigator.vibrate(18);}catch{}
    toast(root.cells.length<=1?'Menu do espaço':'Menu da divisão');
  },SPACE_LONG_PRESS_MS);
}
function cancelSpaceLongPressOnMove(e){
  if(!spaceLongPressTimer||spaceLongPress.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-spaceLongPress.x,e.clientY-spaceLongPress.y)>SPACE_LONG_PRESS_MOVE_PX){
    cancelSpaceLongPress();
    resetSpaceDoubleTap();
  }
}

let pieceTapState={count:0,lastAt:0,lastX:0,lastY:0,obj:null,rootId:null,doubleTimer:null};
const PIECE_MULTI_TAP_GAP_MS=560;
const PIECE_MULTI_TAP_PX=64;
const PIECE_DOUBLE_ACTION_DELAY_MS=620;

function resetLinkedDoubleTap(){
  if(pieceTapState.doubleTimer)clearTimeout(pieceTapState.doubleTimer);
  pieceTapState={count:0,lastAt:0,lastX:0,lastY:0,obj:null,rootId:null,doubleTimer:null};
}
function registerLinkedDoubleTap(obj){
  const now=performance.now();
  const root=rootForObject(obj),rootId=root?.id||null;
  const distance=Math.hypot(downClientX-pieceTapState.lastX,downClientY-pieceTapState.lastY);
  const closeEnough=distance<=PIECE_MULTI_TAP_PX;
  const elapsed=now-pieceTapState.lastAt;
  const inTime=elapsed<=PIECE_MULTI_TAP_GAP_MS;
  const sameRoot=pieceTapState.rootId===rootId;
  const sameObject=pieceTapState.obj===obj;

  // Evita pointerdown duplicado do mesmo contato em alguns WebViews Android.
  const duplicateEvent=pieceTapState.count&&sameObject&&distance<=12&&elapsed>=0&&elapsed<110;
  if(duplicateEvent)return false;

  if(!pieceTapState.count||!closeEnough||!inTime||!sameRoot||!sameObject){
    resetLinkedDoubleTap();
    pieceTapState={count:1,lastAt:now,lastX:downClientX,lastY:downClientY,obj,rootId,doubleTimer:null};
    return false;
  }

  // Duplo toque/clique continua abrindo o espaço/móvel vinculado, como antes.
  if(pieceTapState.count===1){
    pieceTapState.count=2;pieceTapState.lastAt=now;pieceTapState.lastX=downClientX;pieceTapState.lastY=downClientY;
    const pendingObj=obj,pendingRoot=root;
    pieceTapState.doubleTimer=setTimeout(()=>{
      if(pieceTapState.count!==2)return;
      resetLinkedDoubleTap();
      if(pendingRoot)openSpaceFromObject(pendingObj);
    },PIECE_DOUBLE_ACTION_DELAY_MS);
    return true;
  }

  resetLinkedDoubleTap();
  return false;
}

// 1.100.95 · segurar a peça abre a configuração (mouse e touch).
let pieceLongPressTimer=null;
let pieceLongPress={id:null,obj:null,x:0,y:0,triggered:false};
const PIECE_LONG_PRESS_MS=520;
const PIECE_LONG_PRESS_MOVE_PX=18;
function cancelPieceLongPress(){
  if(pieceLongPressTimer){clearTimeout(pieceLongPressTimer);pieceLongPressTimer=null;}
  pieceLongPress={id:null,obj:null,x:0,y:0,triggered:false};
}
function startPieceLongPress(obj,pointerId,x,y){
  cancelPieceLongPress();
  if(!obj||toolMode!=='select')return;
  pieceLongPress={id:pointerId,obj,x,y,triggered:false};
  pieceLongPressTimer=setTimeout(()=>{
    pieceLongPressTimer=null;
    if(toolMode!=='select'||pieceLongPress.obj!==obj)return;
    pieceLongPress.triggered=true;
    resetLinkedDoubleTap();
    selectObject(obj);
    openPieceInspector(obj);
    try{if(navigator.vibrate)navigator.vibrate(18);}catch{}
    toast('Configuração da peça');
  },PIECE_LONG_PRESS_MS);
}
function cancelPieceLongPressOnMove(e){
  if(!pieceLongPressTimer||pieceLongPress.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-pieceLongPress.x,e.clientY-pieceLongPress.y)>PIECE_LONG_PRESS_MOVE_PX){
    cancelPieceLongPress();
    resetLinkedDoubleTap();
  }
}

function beginPick(){
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(referenceMeshes(),false);
  if(!hits.length){
    if(toolMode==='select'){ selectObject(null); clearSpaceSelection(); resetLinkedDoubleTap(); resetSpaceDoubleTap(); cancelSpaceLongPress(); }
    dragMode=null; controls.enabled=true; return;
  }
  let hit=hits[0], obj=hit.object;

  // 1.100.95: quando já estamos trabalhando em um espaço e uma porta está
  // na frente, a porta não bloqueia a seleção dos cortes atrás dela. Procuramos
  // no mesmo raio a divisão do espaço principal ativo. Peças comuns continuam
  // selecionáveis normalmente; a prioridade especial vale para portas.
  if(toolMode==='select' && (selectedSpaceCell||activeSpaceRootId) && isDoorObject(obj)){
    const activeRootId=selectedSpaceCell?.rootId||activeSpaceRootId;
    const cellHit=hits.find(h=>h.object?.userData?.kind==='space-cell' && h.object.userData.spaceRootId===activeRootId);
    if(cellHit){ hit=cellHit; obj=cellHit.object; }
  }

  if(obj.userData.kind==='space-cell'){
    resetLinkedDoubleTap();
    if(toolMode==='select'){
      const rootId=obj.userData.spaceRootId,cellId=obj.userData.spaceCellId;
      resetSpaceDoubleTap();
      // 1.100.95: um toque apenas seleciona e fecha o menu. Segurar o mesmo
      // espaço/divisão abre a janela, exatamente como a configuração da peça.
      selectSpaceCellByIds(rootId,cellId,{showMenu:false});
      startSpaceLongPress(rootId,cellId,activePointerId,downClientX,downClientY);
      dragMode=null; controls.enabled=true; return;
    }
    if(toolMode==='move-free'){
      const root=getSpaceRoot(obj.userData.spaceRootId);
      if(!root){dragMode=null;controls.enabled=true;return;}
      selectSpaceCellByIds(obj.userData.spaceRootId,obj.userData.spaceCellId);
      movingSpaceRoot=root;
      movingSpaceRootStart={x:root.x,yBase:root.yBase,z:root.z};
      movingSpaceCellStarts=root.cells.map(c=>({id:c.id,minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ}));
      movingSpaceObjectStarts=objects.filter(o=>objectInsideSpaceRoot(o,root)).map(o=>({obj:o,pos:o.position.clone()}));
      dragStartState=stateString(); dragChanged=false; dragMode='space-free'; controls.enabled=false;
      camera.getWorldDirection(freeMovePlaneNormal).normalize();
      freeMovePlane.setFromNormalAndCoplanarPoint(freeMovePlaneNormal,hit.point);
      if(!intersectPlane(freeMovePlane,movingSpaceStartPoint)) movingSpaceStartPoint.copy(hit.point);
      return;
    }
    toast('Use Selecionar, Mover ou as ações do espaço');
    dragMode=null; controls.enabled=true; return;
  }
  let linkedDoublePending=false;
  if(toolMode==='select'){
    cancelSpaceLongPress();
    resetSpaceDoubleTap();
    linkedDoublePending=registerLinkedDoubleTap(obj);
  } else {
    resetLinkedDoubleTap();
  }
  selectObject(obj);
  if(toolMode==='select'){
    startPieceLongPress(obj,activePointerId,downClientX,downClientY);
    // No segundo toque também iniciamos o temporizador de segurar. Se o usuário
    // apenas tocar duas vezes, o espaço vinculado abre; se mantiver pressionado,
    // a configuração da peça ganha prioridade e cancela o duplo toque.
    if(linkedDoublePending){dragMode=null;controls.enabled=true;return;}
  }
  const f=worldAxisForFace(hit,obj);
  const u=obj.userData;
  dragStartState=stateString(); dragChanged=false;

  if(toolMode==='move-free'){
    // Estilo CAD: se a mira estiver perto de uma quina da face tocada,
    // a quina exata vira o ponto de pega. Caso contrário usa o ponto da face.
    dragMode='free';
    controls.enabled=false;
    freeMoveStartPosition.copy(obj.position);
    const actualAim=new THREE.Vector2(
      ((pointer.x+1)*.5)*renderer.domElement.getBoundingClientRect().width + renderer.domElement.getBoundingClientRect().left,
      ((1-pointer.y)*.5)*renderer.domElement.getBoundingClientRect().height + renderer.domElement.getBoundingClientRect().top
    );
    const corner=nearestCornerToClient(obj,f,actualAim,CORNER_PICK_PX);
    const edge=!corner ? nearestEdgeOnMeshToClient(obj,actualAim,EDGE_PICK_PX) : null;
    moveGrabIsCorner=!!corner;
    moveGrabKind=corner ? 'corner' : edge ? 'edge' : 'face';
    movePickPoint.copy(corner ? corner.point : edge ? edge.point : hit.point);
    moveGrip.position.copy(movePickPoint); moveGrip.visible=true;
    moveGrip.material.color.set(moveGrabKind==='corner' ? 0x34d058 : moveGrabKind==='edge' ? 0xffd23f : COLORS.cyan);
    if(moveGrabKind!=='face'){
      cornerMarker.position.copy(movePickPoint); cornerMarker.visible=true;
      cornerMarker.material.color.set(moveGrabKind==='corner' ? 0x34d058 : 0xffd23f);
    }
    const aimClient=worldToClient(movePickPoint);
    moveDownAim.copy(aimClient);
    camera.getWorldDirection(freeMovePlaneNormal).normalize();
    freeMovePlane.setFromNormalAndCoplanarPoint(freeMovePlaneNormal,movePickPoint);
    if(!intersectPlane(freeMovePlane,freeMoveStartPoint)) freeMoveStartPoint.copy(movePickPoint);
    moveInferenceAxis=null;
    lastEdit={type:'position',axis:'free',mesh:obj};
    return;
  }

  if(toolMode==='pull'){
    controls.enabled=false;
    if(u.kind==='cylinder' && f.axis!=='y'){
      dragMode='radius';
      radiusDir.set(hit.point.x-obj.position.x,0,hit.point.z-obj.position.z).normalize();
      lastEdit={type:'diameter',mesh:obj};
      return;
    }
    pullAxis=f.axis; grabSign=f.sign;
    if(pullAxis==='x'){ anchorCoord=obj.position.x-grabSign*u.width/2; lockedA=obj.position.y; lockedB=obj.position.z; }
    if(pullAxis==='y'){ anchorCoord=obj.position.y-grabSign*u.height/2; lockedA=obj.position.x; lockedB=obj.position.z; }
    if(pullAxis==='z'){ anchorCoord=obj.position.z-grabSign*u.depth/2; lockedA=obj.position.x; lockedB=obj.position.y; }
    dragMode='pull-'+pullAxis; lastEdit={type:pullAxis,mesh:obj};
    return;
  }

  // Selecionar no estilo CAD: apenas seleciona. Não move e não abre painel.
  dragMode=null;
  controls.enabled=true;
}

function moveSpaceFree(){
  if(!movingSpaceRoot) return;
  if(!intersectPlane(freeMovePlane,movingSpaceCurrentPoint)) return;
  const rawDelta=movingSpaceCurrentPoint.clone().sub(movingSpaceStartPoint);
  const root=movingSpaceRoot;
  const start0=movingSpaceCellStarts[0];
  if(!start0) return;
  const rs=movingSpaceRootStart || {x:root.x,yBase:root.yBase,z:root.z};
  // Não deixa o móvel atravessar o plano do chão ao mover.
  const delta=rawDelta.clone();
  if(rs.yBase+delta.y<0) delta.y=-rs.yBase;
  // O grupo visual usa o delta enquanto os dados absolutos são atualizados.
  if(root.group) root.group.position.copy(delta);
  root.x=rs.x+delta.x; root.yBase=rs.yBase+delta.y; root.z=rs.z+delta.z;
  root.cells.forEach((c,i)=>{
    const st=movingSpaceCellStarts[i]; if(!st)return;
    c.minX=st.minX+delta.x; c.maxX=st.maxX+delta.x;
    c.minY=st.minY+delta.y; c.maxY=st.maxY+delta.y;
    c.minZ=st.minZ+delta.z; c.maxZ=st.maxZ+delta.z;
  });
  for(const item of movingSpaceObjectStarts) item.obj.position.copy(item.pos).add(delta);
  dragChanged=delta.lengthSq()>1e-10;
  updateMeasureBadge();
}

function updateLiveLabel(){
  if(!lastEdit || !selected || !dragMode){ liveLabel.style.display='none'; return; }
  let worldPos=selected.position.clone();
  const u=selected.userData;
  let text='';
  if(dragMode==='planar' || dragMode==='free'){
    worldPos.y=getBounds(selected).maxY+.04;
    text=`X ${mm(selected.position.x)} · Y ${mm(selected.position.y-u.height/2)} · Z ${mm(selected.position.z)} mm${moveSnapText ? ` · ${moveSnapText}` : ''}`;
  } else if(dragMode==='radius') { worldPos.set(selected.position.x+u.width/2,selected.position.y,selected.position.z); text=`Ø ${mm(u.width)} mm`; }
  else if(pullAxis==='x'){ worldPos.set(selected.position.x+grabSign*u.width/2,selected.position.y,selected.position.z); text=`${mm(u.width)} mm`; }
  else if(pullAxis==='y'){ worldPos.set(selected.position.x,selected.position.y+grabSign*u.height/2,selected.position.z); text=`${mm(u.height)} mm`; }
  else { worldPos.set(selected.position.x,selected.position.y,selected.position.z+grabSign*u.depth/2); text=`${mm(u.depth)} mm`; }
  const p=worldPos.project(camera); if(p.z>1){liveLabel.style.display='none';return;}
  liveLabel.style.left=((p.x*.5+.5)*innerWidth)+'px'; liveLabel.style.top=((-p.y*.5+.5)*innerHeight)+'px'; liveLabel.textContent=text; liveLabel.style.display='block';
}

function moveFree(event){
  if(!selected) return;
  const inferred=inferMoveAxis(event);
  moveInferenceAxis=inferred;

  if(inferred){
    const dir=axisVector(inferred);
    moveAxisDir.copy(dir);
    const t=closestParamOnAxis(movePickPoint,dir);
    selected.position.copy(freeMoveStartPosition).addScaledVector(dir,t);
    showInference(inferred);

    // No eixo inferido, o snap age somente nesse eixo, como uma inferência de CAD.
    const snap=findMoveSnap(selected,inferred);
    if(snap){ selected.position[inferred]+=snap.delta; showGuide(inferred,snap.line); }
    if(inferred!=='x') guideX.visible=false;
    if(inferred!=='y') guideY.visible=false;
    if(inferred!=='z') guideZ.visible=false;
  } else {
    hideInference();
    if(!intersectPlane(freeMovePlane,freeMoveCurrentPoint)) return;
    const delta=freeMoveCurrentPoint.clone().sub(freeMoveStartPoint);
    selected.position.copy(freeMoveStartPosition).add(delta);

    // Movimento livre + snap de faces/centros nos três eixos.
    for(const axis of ['x','y','z']){
      const snap=findMoveSnap(selected,axis);
      if(snap){ selected.position[axis]+=snap.delta; showGuide(axis,snap.line); }
      else if(axis==='x') guideX.visible=false;
      else if(axis==='y') guideY.visible=false;
      else guideZ.visible=false;
    }
  }

  // Inferência estilo CAD: quina -> guia da Trena -> aresta -> face.
  let movedDelta=selected.position.clone().sub(freeMoveStartPosition);
  let currentGrip=movePickPoint.clone().add(movedDelta);
  const target=findMoveInferenceTarget(selected,event);
  if(target){
    if(target.kind==='guide' && moveGrabKind==='face' && target.line?.userData?.axis){
      // Ao mover pela face, a guia pode capturar a lateral/centro da peça,
      // em vez de obrigar apenas o ponto de pega a cair sobre a linha.
      const aligned=snapMovingObjectFeaturesToGuide(selected,target.line);
      movedDelta=selected.position.clone().sub(freeMoveStartPosition);
      currentGrip=movePickPoint.clone().add(movedDelta);
      if(!aligned){
        selected.position.add(target.point.clone().sub(currentGrip));
        movedDelta=selected.position.clone().sub(freeMoveStartPosition);
        currentGrip.copy(target.point);
      }
    } else {
      selected.position.add(target.point.clone().sub(currentGrip));
      movedDelta=selected.position.clone().sub(freeMoveStartPosition);
      currentGrip.copy(target.point);
    }
    moveCornerTarget=target.kind==='corner' ? target.point.clone() : null;
    setMoveTargetMarker(target);
  } else {
    moveCornerTarget=null;
    moveSnapKind=null; moveSnapText='';
    if(moveGrabKind==='corner' || moveGrabKind==='edge'){
      const c=moveGrabKind==='corner' ? 0x34d058 : 0xffd23f;
      cornerMarker.position.copy(currentGrip); cornerMarker.visible=true;
      cornerMarker.material.color.set(c);
      moveGrip.material.color.set(c);
    } else {
      cornerMarker.visible=false;
      moveGrip.material.color.set(COLORS.cyan);
    }
  }

  // O ponto de pega viaja junto com a peça, visualmente como no CAD.
  moveGrip.position.copy(currentGrip);
  dragChanged=true;
}

function pullSelected(axis){
  const u=selected.userData;
  const dir=axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  const lp=axis==='x'?new THREE.Vector3(anchorCoord,lockedA,lockedB):axis==='y'?new THREE.Vector3(lockedA,anchorCoord,lockedB):new THREE.Vector3(lockedA,lockedB,anchorCoord);
  let t=closestParamOnAxis(lp,dir);
  let edge=anchorCoord+t;
  const snap=snapFaceCoordinate(selected,axis,edge);
  if(snap){ edge=snap.coord; t=edge-anchorCoord; showGuide(axis,snap.line); } else hideGuides();
  const sign=t===0?grabSign:Math.sign(t);
  const size=clampSize(Math.abs(t));
  grabSign=sign; // mantém o lado correto também para edições posteriores
  if(axis==='x'){
    u.width=size; selected.scale.x=size; selected.position.x=anchorCoord+sign*size/2;
  } else if(axis==='y'){
    u.height=size; selected.scale.y=size; selected.position.y=anchorCoord+sign*size/2;
    if(selected.position.y-u.height/2<0 && sign>0){ selected.position.y=u.height/2; }
  } else {
    u.depth=size; selected.scale.z=size; selected.position.z=anchorCoord+sign*size/2;
  }
  dragChanged=true;
}

renderer.domElement.addEventListener('pointerdown',e=>{
  // Navegação CAD no PC é tratada pelo OrbitControls.
  // O fluxo de edição abaixo continua exclusivo do botão esquerdo.
  if(e.button!==undefined && e.button!==0) return;

  if(toolMode==='tape'){
    // DOWN só começa o gesto. Arrastar serve para procurar snap; um toque curto
    // é confirmado no UP/END. Isso deixa a mira utilizável como no CAD mobile.
    tapeMouseActive=e.pointerType!=='touch';
    activePointerId=e.pointerId;
    downClientX=e.clientX; downClientY=e.clientY;
    tapePointerMoved=false;
    getPointerNDC(e);
    moveTapeCrosshairRaw(e.clientX,e.clientY);
    controls.enabled=false;
    try { updateTapePreview(e); }
    catch(err){ console.error('Trena pointerdown:',err); }
    return;
  }

  if(e.pointerType==='touch' && e.isPrimary===false) return;
  activePointerId=e.pointerId;
  downClientX=e.clientX; downClientY=e.clientY; gestureLocked=false;
  getPointerNDC(e);
  renderer.domElement.setPointerCapture?.(e.pointerId);
  beginPick();
});

// Fallback para mouse/trackpad: o evento nativo de duplo clique também abre
// o móvel, usando a mesma inferência de vínculo usada no duplo toque mobile.
if(desktopCadNavigation){
  renderer.domElement.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button===1){
      renderer.domElement.style.cursor='grabbing';
    }
  },{passive:true});
  const releaseDesktopCameraCursor=e=>{
    if(e?.pointerType==='mouse'&&e.button===1){
      renderer.domElement.style.cursor='';
    }
  };
  renderer.domElement.addEventListener('pointerup',releaseDesktopCameraCursor,{passive:true});
  renderer.domElement.addEventListener('pointercancel',releaseDesktopCameraCursor,{passive:true});
  renderer.domElement.addEventListener('auxclick',e=>{
    if(e.button===1)e.preventDefault();
  });
}

renderer.domElement.addEventListener('dblclick',e=>{
  // O duplo clique continua reservado ao espaço/móvel vinculado.
  // Configuração de peça agora abre ao clicar/tocar e segurar.
  if(toolMode==='select')e.preventDefault();
});

function moveTapeCrosshairRaw(x,y){
  if(toolMode!=='tape' || !Number.isFinite(x) || !Number.isFinite(y)) return;
  tapeCrosshair.style.left=x+'px';
  tapeCrosshair.style.top=y+'px';
  tapeCrosshair.style.display='block';
}

function prepareTapeDown(ev){
  downClientX=ev.clientX; downClientY=ev.clientY;
  tapePointerMoved=false;
  getPointerNDC(ev);
  moveTapeCrosshairRaw(ev.clientX,ev.clientY);
  controls.enabled=false;
  try { updateTapePreview(ev); } catch(err){ console.error('Trena preview:',err); }
}
function handleTapePointerMotion(e){
  if(toolMode!=='tape') return;
  moveTapeCrosshairRaw(e.clientX,e.clientY);
  getPointerNDC(e);
  if(Math.hypot(e.clientX-downClientX,e.clientY-downClientY)>11) tapePointerMoved=true;
  try { updateTapePreview(e); }
  catch(err){ console.error('Trena snap:',err); }
}
function finishTapeInteraction(ev,confirmTap=true){
  if(toolMode!=='tape') return;
  if(Number.isFinite(ev?.clientX) && Number.isFinite(ev?.clientY)){
    moveTapeCrosshairRaw(ev.clientX,ev.clientY);
    try { updateTapePreview(ev); } catch(_) {}
  }
  if(confirmTap && !tapePointerMoved){
    try { handleTapeTap(ev); updateTapePreview(ev); }
    catch(err){ console.error('Trena confirmar:',err); toast('Erro Trena: '+(err?.message || String(err))); }
  }
  controls.enabled=true;
  tapePointerMoved=false;
}
function touchEventLike(touch){
  return {
    clientX:touch.clientX, clientY:touch.clientY,
    pointerType:'touch', pointerId:touch.identifier ?? 1,
    isPrimary:true, button:0
  };
}
function findTrackedTouch(list){
  if(!list || !list.length) return null;
  for(let i=0;i<list.length;i++) if(tapeTouchId===null || list[i].identifier===tapeTouchId) return list[i];
  // Fallback para WebViews que trocam o identifier durante o gesto.
  return list[0] || null;
}

// Android/WebView: Touch Events mantêm a mira fluida. O ponto só é confirmado
// no fim de um toque curto; arrastar serve apenas para posicionar a mira.
window.addEventListener('touchstart',e=>{
  if(toolMode!=='tape' || e.target!==renderer.domElement || !e.changedTouches?.length) return;
  const t=e.changedTouches[0];
  tapeTouchActive=true;
  tapeTouchId=t.identifier;
  tapeLastClientX=t.clientX; tapeLastClientY=t.clientY;
  const ev=touchEventLike(t);
  prepareTapeDown(ev);
  e.preventDefault();
},{capture:true,passive:false});

window.addEventListener('touchmove',e=>{
  if(toolMode!=='tape' || !tapeTouchActive) return;
  const t=findTrackedTouch(e.touches) || findTrackedTouch(e.changedTouches);
  if(!t) return;
  tapeLastClientX=t.clientX; tapeLastClientY=t.clientY;
  handleTapePointerMotion(touchEventLike(t));
  e.preventDefault();
},{capture:true,passive:false});

function finishNativeTapeTouch(e){
  if(toolMode!=='tape' || !tapeTouchActive) return;
  const t=findTrackedTouch(e.changedTouches) || e.changedTouches?.[0] || null;
  const ev=t ? touchEventLike(t) : {
    clientX:tapeLastClientX,clientY:tapeLastClientY,pointerType:'touch',pointerId:tapeTouchId??1,isPrimary:true,button:0
  };
  finishTapeInteraction(ev);
  tapeTouchActive=false;
  tapeTouchId=null;
  controls.enabled=true;
  e.preventDefault();
}
window.addEventListener('touchend',finishNativeTapeTouch,{capture:true,passive:false});
window.addEventListener('touchcancel',finishNativeTapeTouch,{capture:true,passive:false});

// Mouse/caneta usam Pointer Events; toque não entra aqui.
window.addEventListener('pointermove',e=>{
  if(toolMode!=='tape') return;
  handleTapePointerMotion(e);
},{capture:true,passive:false});

window.addEventListener('pointerup',e=>{
  if(toolMode!=='tape') return;
  // Fallback para WebViews que entregam PointerEvent mas não TouchEvent.
  finishTapeInteraction(e,true);
  tapeMouseActive=false;
  activePointerId=null;
},{capture:true,passive:false});
window.addEventListener('pointercancel',e=>{
  if(toolMode!=='tape') return;
  finishTapeInteraction(e,true);
  tapeMouseActive=false;
  activePointerId=null;
},{capture:true,passive:false});

renderer.domElement.addEventListener('pointermove',e=>{
  if(toolMode==='tape') return;
  if(activePointerId!==null && e.pointerId!==activePointerId) return;
  cancelPieceLongPressOnMove(e);
  cancelSpaceLongPressOnMove(e);
  getPointerNDC(e);

  if(!dragMode) return;
  if(dragMode!=='space-free' && !selected) return;
  if(e.pointerType==='touch' && !gestureLocked){
    const dist=Math.hypot(e.clientX-downClientX,e.clientY-downClientY);
    if(dist<REAIM_THRESHOLD_PX){ return; }
    gestureLocked=true;
  }
  if(dragMode==='space-free') moveSpaceFree();
  else if(dragMode==='free') moveFree(e);
  else if(dragMode.startsWith('pull-')) pullSelected(dragMode.slice(-1));
  else if(dragMode==='radius'){
    const p=selected.position.clone(); const t=closestParamOnAxis(p,radiusDir); const d=clampSize(Math.abs(t)*2);
    selected.userData.width=d; selected.userData.depth=d; selected.scale.x=d; selected.scale.z=d; dragChanged=true;
  }
  updateMeasureBadge(); if(selected){updateInspector(); updateLiveLabel();}
});

function endDrag(e){
  if(e && activePointerId!==null && e.pointerId!==activePointerId) return;
  if(dragMode==='space-free' && movingSpaceRoot){
    const keepRootId=movingSpaceRoot.id, keepCellId=selectedSpaceCell?.cellId;
    if(movingSpaceRoot.group) movingSpaceRoot.group.position.set(0,0,0);
    renderSpaces();
    if(keepCellId && getSpaceCell(keepRootId,keepCellId)) selectSpaceCellByIds(keepRootId,keepCellId);
    movingSpaceRoot=null; movingSpaceRootStart=null; movingSpaceCellStarts=[]; movingSpaceObjectStarts=[];
  }
  if(selected) setAllFaces(selected,COLORS.selected);
  controls.enabled=true; activePointerId=null; dragMode=null; gestureLocked=false; liveLabel.style.display='none'; moveGrip.visible=false; moveGrabIsCorner=false; moveGrabKind='face'; moveCornerTarget=null; moveSnapKind=null; moveSnapText=''; hideGuides();
  if(dragChanged && dragStartState!==stateString()) commitHistory();
  if(dragChanged) renderMachiningVisuals();
  dragChanged=false; dragStartState=null;
}

renderer.domElement.addEventListener('pointerup',e=>{
  if(toolMode==='tape') return;
  cancelPieceLongPress();
  cancelSpaceLongPress();
  endDrag(e);
});
renderer.domElement.addEventListener('pointercancel',e=>{
  if(toolMode==='tape') return;
  cancelPieceLongPress();
  cancelSpaceLongPress();
  endDrag(e);
});



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
  const materialThickness=Number(material?.thickness);
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


// ---------- Criar peças dentro da divisão ----------
let pieceCreateType='left';
let pieceTypeLastClickButton=null;
let pieceTypeLastClickAt=0;
let pieceTypeQuickCreateBusy=false;
const PIECE_TYPE_DOUBLE_CLICK_MS=520;
function selectPieceCreateTypeButton(button){
  if(!button)return;
  pieceCreateType=button.dataset.pieceType||'left';
  document.querySelectorAll('[data-piece-type]').forEach(x=>x.classList.toggle('active',x===button));
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
  return ({left:'Lateral esquerda',right:'Lateral direita',division:'Divisão vertical',base:'Base',top:'Chapéu',shelf:'Prateleira',shelves:'Prateleiras',back:'Fundo',front:'Frente',doors:'Portas'})[type]||'Peça';
}
function pieceDivisionLayoutMm(widthM,thicknessM){
  const total=mm(widthM),thickness=mm(thicknessM);
  const free=total-thickness;
  if(!(free>0))return {ok:false,total,thickness,gap1:0,gap2:0,message:'A espessura da divisão ocupa toda a largura.'};

  let measure=Number($('pieceDivisionMeasure')?.value);
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
// ---------- 1.100.95 · Configuração salva de portas ----------
const DOOR_CREATE_CONFIG_KEY='designLabDoorCreateConfigV1';
function captureDoorCreateConfig(){
  return {
    version:1,
    count:String($('doorCount')?.value||'2'),
    gapMiddle:String($('doorGapMiddle')?.value||'2'),
    gapLeft:String($('doorGapLeft')?.value||'2'),
    gapRight:String($('doorGapRight')?.value||'2'),
    gapTop:String($('doorGapTop')?.value||'2'),
    gapBottom:String($('doorGapBottom')?.value||'2'),
    handleType:String($('doorHandleType')?.value||'none'),
    handleSize:String($('doorHandleSize')?.value||'20'),
    cavaPosition:String($('doorCavaPosition')?.value||'top'),
    createHingeHoles:!!$('doorCreateHingeHoles')?.checked,
    hingeCount:String($('doorHingeCount')?.value||'auto'),
    hingeSide:String($('doorHingeSide')?.value||'auto'),
    cupDiameter:String($('doorHingeCupDiameter')?.value||'35'),
    cupDepth:String($('doorHingeCupDepth')?.value||'12'),
    cupEdge:String($('doorHingeCupEdge')?.value||'22.5'),
    hingeEdgeY:String($('doorHingeEdgeY')?.value||'100'),
    createSideHoles:!!$('doorCreateSideHoles')?.checked,
    mountFrontOffset:String($('doorMountFrontOffset')?.value||'37'),
    mountSpacing:String($('doorMountSpacing')?.value||'32'),
    mountDiameter:String($('doorMountDiameter')?.value||'5'),
    mountDepth:String($('doorMountDepth')?.value||'12'),
    savedAt:new Date().toISOString()
  };
}
function readDoorCreateConfig(){
  try{
    const cfg=JSON.parse(localStorage.getItem(DOOR_CREATE_CONFIG_KEY)||'null');
    return cfg&&typeof cfg==='object'?cfg:null;
  }catch(_){return null;}
}
function applyDoorCreateConfig(cfg=readDoorCreateConfig()){
  if(!cfg)return false;
  const set=(id,value)=>{const el=$(id);if(el&&value!==undefined&&value!==null)el.value=String(value);};
  set('doorCount',cfg.count);
  set('doorGapMiddle',cfg.gapMiddle);
  set('doorGapLeft',cfg.gapLeft);
  set('doorGapRight',cfg.gapRight);
  set('doorGapTop',cfg.gapTop);
  set('doorGapBottom',cfg.gapBottom);
  set('doorHandleType',cfg.handleType);
  set('doorHandleSize',cfg.handleSize);
  set('doorCavaPosition',cfg.cavaPosition);
  if($('doorCreateHingeHoles')&&typeof cfg.createHingeHoles==='boolean')$('doorCreateHingeHoles').checked=cfg.createHingeHoles;
  set('doorHingeCount',cfg.hingeCount);
  set('doorHingeSide',cfg.hingeSide);
  set('doorHingeCupDiameter',cfg.cupDiameter);
  set('doorHingeCupDepth',cfg.cupDepth);
  set('doorHingeCupEdge',cfg.cupEdge);
  set('doorHingeEdgeY',cfg.hingeEdgeY);
  if($('doorCreateSideHoles')&&typeof cfg.createSideHoles==='boolean')$('doorCreateSideHoles').checked=cfg.createSideHoles;
  set('doorMountFrontOffset',cfg.mountFrontOffset);
  set('doorMountSpacing',cfg.mountSpacing);
  set('doorMountDiameter',cfg.mountDiameter);
  set('doorMountDepth',cfg.mountDepth);
  updateDoorCreationVisibility();
  return true;
}
function saveDoorCreateConfig(){
  if(pieceCreateType!=='doors'){toast('Selecione Portas para salvar esta configuração');return false;}
  try{
    const cfg=captureDoorCreateConfig();
    localStorage.setItem(DOOR_CREATE_CONFIG_KEY,JSON.stringify(cfg));
    savePieceThicknessPreference({silent:true});
    toast('Configuração de portas salva · será carregada nas próximas criações');
    return true;
  }catch(err){
    console.error('Salvar configuração de portas:',err);
    toast('Não foi possível salvar a configuração de portas');
    return false;
  }
}

// ---------- 1.100.95 · Portas paramétricas + dobradiças ----------
function doorFieldNumber(id,fallback=0,min=-Infinity,max=Infinity){
  const n=parseDecimalInput($(id)?.value);
  const v=Number.isFinite(n)?n:fallback;
  return Math.max(min,Math.min(max,v));
}
function doorAutoHingeCount(heightMm){
  const h=Math.max(0,Number(heightMm)||0);
  if(h<=900)return 2;
  if(h<=1500)return 3;
  if(h<=2100)return 4;
  return 5;
}
function doorHingeCountResolved(heightMm){
  const raw=String($('doorHingeCount')?.value||'auto');
  return raw==='auto'?doorAutoHingeCount(heightMm):Math.max(1,Math.min(6,Math.round(Number(raw)||2)));
}
function doorCreationConfig(size){
  const count=Math.max(1,Math.min(12,Math.round(doorFieldNumber('doorCount',2,1,12))));
  const gl=doorFieldNumber('doorGapLeft',2,0),gr=doorFieldNumber('doorGapRight',2,0),gt=doorFieldNumber('doorGapTop',2,0),gb=doorFieldNumber('doorGapBottom',2,0),gm=doorFieldNumber('doorGapMiddle',2,0);
  const handleType=String($('doorHandleType')?.value||'none');
  const handleSize=handleType==='none'?0:doorFieldNumber('doorHandleSize',20,0,1000);
  const cavaPosition=String($('doorCavaPosition')?.value||'top')==='bottom'?'bottom':'top';
  const cavaDiscount=handleType==='cava'?handleSize:0;
  const totalW=mm(size.width),totalH=mm(size.height);
  const doorW=(totalW-gl-gr-gm*Math.max(0,count-1))/count;
  const doorH=totalH-gt-gb-cavaDiscount;
  const bottomLift=handleType==='cava'&&cavaPosition==='bottom'?handleSize:0;
  const hingeEnabled=!!$('doorCreateHingeHoles')?.checked;
  const mountEnabled=hingeEnabled&&!!$('doorCreateSideHoles')?.checked;
  const hingeCount=hingeEnabled?doorHingeCountResolved(doorH):0;
  return {
    count,gl,gr,gt,gb,gm,doorW,doorH,bottomLift,handleType,handleSize,cavaPosition,cavaDiscount,
    hingeEnabled,mountEnabled,hingeCount,hingeSide:String($('doorHingeSide')?.value||'auto'),
    cupDiameter:doorFieldNumber('doorHingeCupDiameter',35,.5,100),cupDepth:doorFieldNumber('doorHingeCupDepth',12,.5,100),
    cupEdge:doorFieldNumber('doorHingeCupEdge',22.5,1,500),hingeEdgeY:doorFieldNumber('doorHingeEdgeY',100,5,1000),
    mountFrontOffset:doorFieldNumber('doorMountFrontOffset',37,0,1000),mountSpacing:doorFieldNumber('doorMountSpacing',32,0,500),
    mountDiameter:doorFieldNumber('doorMountDiameter',5,.5,50),mountDepth:doorFieldNumber('doorMountDepth',12,.5,100)
  };
}
function doorHingeSideForIndex(index,count,mode){
  if(mode==='left'||mode==='right')return mode;
  if(count<=1)return 'left';
  return index < count/2 ? 'left' : 'right';
}
function doorHingePositionsMm(heightMm,count,edgeMm){
  const h=Math.max(1,Number(heightMm)||1),n=Math.max(1,Math.round(Number(count)||1));
  if(n===1)return [h/2];
  const edge=Math.max(5,Math.min(Number(edgeMm)||100,Math.max(5,h/2-1)));
  const span=Math.max(0,h-2*edge);
  if(span<.001)return [h/2];
  const out=[];for(let i=0;i<n;i++)out.push(edge+span*(i/(n-1)));
  return out;
}
function doorMountPanelCandidate(door,hingeSide,rootId,hingeWorldY){
  const db=objectBoundsMm(door),edgeX=hingeSide==='left'?db.minX:db.maxX;
  let best=null;
  for(const o of objects){
    if(o===door||o.userData?.spaceRootId!==rootId||isDoorObject(o)||o.userData?.kind==='hardware-visual'||o.userData?.kind==='cylinder')continue;
    const ti=pieceThicknessInfo(o);if(!ti||ti.thicknessAxis!=='x')continue;
    const b=objectBoundsMm(o);
    if(hingeWorldY<b.minY-2||hingeWorldY>b.maxY+2)continue;
    if(hingeSide==='left'&&o.position.x>door.position.x+.03)continue;
    if(hingeSide==='right'&&o.position.x<door.position.x-.03)continue;
    const faceX=hingeSide==='left'?b.maxX:b.minX;
    const distance=Math.abs(faceX-edgeX);
    if(distance>80)continue;
    const frontDistance=Math.abs(b.maxZ-db.maxZ);
    const name=String(o.userData?.name||'');
    const structural=/lateral|divis[aã]o vertical/i.test(name)?-8:0;
    const score=distance+Math.min(50,frontDistance*.08)+structural;
    if(!best||score<best.score)best={object:o,bounds:b,score,distance};
  }
  return best?.object||null;
}
function appendDoorHingeDrilling(door,root,cfg,hingeSide){
  if(!cfg.hingeEnabled)return {hinges:0,mountHoles:0,missingMount:0};
  const db=objectBoundsMm(door),positions=doorHingePositionsMm(cfg.doorH,cfg.hingeCount,cfg.hingeEdgeY);
  const cupR=cfg.cupDiameter/2;
  const cupEdge=Math.max(cupR,Math.min(cfg.cupEdge,cfg.doorW-cupR));
  let hinges=0,mountHoles=0,missingMount=0;
  for(const localY of positions){
    const worldY=db.minY+localY;
    const target=cfg.mountEnabled?doorMountPanelCandidate(door,hingeSide,root.id,worldY):null;
    const instanceId=uid('doorhinge');
    const metaBase={presetId:'builtin-door-hinge-auto',name:'Dobradiça de porta',sourcePartId:door.userData.partId||null,contactPartId:target?.userData?.partId||null};
    const cupWorld={x:hingeSide==='left'?db.minX+cupEdge:db.maxX-cupEdge,y:worldY,z:db.minZ};
    const cupOp=hardwareHoleOp(door,cupWorld,'+z',{diameter:cfg.cupDiameter,depth:cfg.cupDepth},{...metaBase,role:'selected',contactName:target?.userData?.name||'Lateral do móvel'},instanceId);
    (door.userData.machining||(door.userData.machining=[])).push(cupOp);hinges++;
    if(cfg.mountEnabled){
      if(!target){missingMount++;continue;}
      const tb=objectBoundsMm(target),r=cfg.mountDiameter/2;
      const z=Math.max(tb.minZ+r,Math.min(tb.maxZ-r,tb.maxZ-cfg.mountFrontOffset));
      const entry=target.position.x<door.position.x?'-x':'+x';
      const offsets=cfg.mountSpacing>.001?[-cfg.mountSpacing/2,cfg.mountSpacing/2]:[0];
      let made=0;
      for(const off of offsets){
        const y=worldY+off;if(y<tb.minY+r-.01||y>tb.maxY-r+.01)continue;
        const op=hardwareHoleOp(target,{x:target.position.x*1000,y,z},entry,{diameter:cfg.mountDiameter,depth:cfg.mountDepth},{...metaBase,role:'contact',contactName:door.userData?.name||'Porta'},instanceId);
        (target.userData.machining||(target.userData.machining=[])).push(op);made++;mountHoles++;
      }
      if(!made)missingMount++;
      sanitizeMachiningForPiece(target);
    }
  }
  sanitizeMachiningForPiece(door);
  return {hinges,mountHoles,missingMount};
}
// 1.100.95 · inverter lado da dobradiça pelo menu de configuração da porta.
function doorInspectorRuntimeConfig(door){
  const h=door?.userData?.doorConfig?.hinge||{};
  const doorW=mm(door?.userData?.width||0),doorH=mm(door?.userData?.height||0);
  return {
    doorW,doorH,
    hingeEnabled:h.enabled!==false,
    mountEnabled:h.mountEnabled!==false,
    hingeCount:Math.max(1,Math.min(6,Math.round(Number(h.count)||doorAutoHingeCount(doorH)))),
    cupDiameter:Math.max(.5,Number(h.cupDiameter)||35),
    cupDepth:Math.max(.5,Number(h.cupDepth)||12),
    cupEdge:Math.max(1,Number(h.cupEdge)||22.5),
    hingeEdgeY:Math.max(5,Number(h.edgeY)||100),
    mountFrontOffset:Math.max(0,Number(h.mountFrontOffset)||37),
    mountSpacing:Math.max(0,Number(h.mountSpacing)||32),
    mountDiameter:Math.max(.5,Number(h.mountDiameter)||5),
    mountDepth:Math.max(.5,Number(h.mountDepth)||12)
  };
}
function removeDoorAutomaticHinges(door){
  if(!door)return {instances:0,operations:0};
  const partId=String(door.userData?.partId||'');
  const ids=new Set();
  for(const o of objects){
    for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
      if(op?.hardwarePresetId!=='builtin-door-hinge-auto'||!op.hardwareInstanceId)continue;
      if(o===door || (partId && String(op.hardwareSourcePartId||'')===partId))ids.add(op.hardwareInstanceId);
    }
  }
  let operations=0;
  if(ids.size){
    for(const o of objects){
      const arr=Array.isArray(o.userData?.machining)?o.userData.machining:null;
      if(!arr)continue;
      const keep=arr.filter(op=>!op?.hardwareInstanceId||!ids.has(op.hardwareInstanceId));
      operations+=arr.length-keep.length;
      if(keep.length!==arr.length)o.userData.machining=keep;
    }
  }
  return {instances:ids.size,operations};
}
function setSelectedDoorHingeSide(side){
  const door=selected;
  if(!door?.userData?.doorConfig){
    toast('Selecione uma porta');return false;
  }
  side=side==='right'?'right':'left';
  const root=rootForObject(door);
  if(!root){toast('Não encontrei o espaço desta porta');return false;}
  const dc=door.userData.doorConfig;
  dc.hinge=dc.hinge||{};
  if(dc.hinge.enabled===false){toast('Esta porta está sem furação automática de dobradiça');return false;}
  const current=dc.hinge.side==='right'?'right':'left';
  if(current===side){toast(`A dobradiça já está no lado ${side==='left'?'esquerdo':'direito'}`);return true;}

  removeDoorAutomaticHinges(door);
  dc.hinge.side=side;
  const cfg=doorInspectorRuntimeConfig(door);
  const st=appendDoorHingeDrilling(door,root,cfg,side);
  renderMachiningVisuals();
  updateInspector();
  commitHistory();
  const extra=st.missingMount?` · ${st.missingMount} posição(ões) sem lateral/divisão encontrada`:'';
  toast(`Dobradiça invertida para o lado ${side==='left'?'esquerdo':'direito'} · ${st.hinges} dobradiça(s)${extra}`);
  return true;
}

function updateDoorCreationVisibility(){
  const isDoors=pieceCreateType==='doors';
  $('saveDoorCreateConfig')?.classList.toggle('hiddenField',!isDoors);
  const handleType=String($('doorHandleType')?.value||'none');
  $('doorHandleSizeLabel')?.classList.toggle('hiddenField',!isDoors||handleType==='none');
  $('doorCavaPositionLabel')?.classList.toggle('hiddenField',!isDoors||handleType!=='cava');
  const hingeOn=isDoors&&!!$('doorCreateHingeHoles')?.checked;
  if($('doorHingeFields'))$('doorHingeFields').style.display=hingeOn?'block':'none';
  const mountOn=hingeOn&&!!$('doorCreateSideHoles')?.checked;
  if($('doorMountFields'))$('doorMountFields').style.display=mountOn?'block':'none';
}

function updateCreatePiecesUI(){
  const info=selectedCellInfo(); if(!info)return;
  const s=info.size, t=Math.max(.001,m($('pieceThickness').value)||.018);
  const front=Math.max(0,m($('pieceFrontInset').value)||0), back=Math.max(0,m($('pieceBackInset').value)||0);
  const usableDepth=Math.max(.001,s.depth-front-back);
  const isShelf=pieceCreateType==='shelf', isMulti=pieceCreateType==='shelves';
  const isDepthPiece=pieceCreateType==='back'||pieceCreateType==='front';
  const isDoors=pieceCreateType==='doors';
  const isDivision=pieceCreateType==='division';
  $('piecePositionLabel').classList.toggle('hiddenField',!isShelf);
  $('pieceCountLabel').classList.toggle('hiddenField',!isMulti);
  $('pieceDistributionLabel').classList.toggle('hiddenField',!isMulti);
  $('pieceDivisionFields').classList.toggle('hiddenField',!isDivision);
  $('doorGapFields').classList.toggle('hiddenField',!isDoors);
  updateDoorCreationVisibility();
  // Fundo/Frente ocupam a profundidade pela própria espessura; recuos não se aplicam.
  // A divisão usa os mesmos recuos das laterais, para poder ser mais rasa que o móvel.
  $('pieceFrontInsetLabel').classList.toggle('hiddenField',isDepthPiece||isDoors);
  $('pieceBackInsetLabel').classList.toggle('hiddenField',isDepthPiece||isDoors);
  $('pieceTarget').textContent=`Divisão: ${mm(s.width)} × ${mm(s.depth)} × ${mm(s.height)} mm`;
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
  else if(isDepthPiece) text=`${pieceTypeName(pieceCreateType)}: ${mm(s.width)} × ${mm(t)} × ${mm(s.height)} mm`;
  else if(isDoors){
    const dc=doorCreationConfig(s);
    const handleText=dc.handleType==='cava'?` · cava ${nice(dc.handleSize)} mm em ${dc.cavaPosition==='top'?'cima':'baixo'} (descontada)`:dc.handleType==='external'?` · puxador externo ${nice(dc.handleSize)} mm`:' · sem puxador';
    const hingeText=dc.hingeEnabled?` · ${dc.hingeCount} dobradiça(s)/porta · copo Ø${nice(dc.cupDiameter)} × ${nice(dc.cupDepth)} mm${dc.mountEnabled?' + placa na lateral':''}`:' · sem furação de dobradiça';
    text=(dc.doorW>0&&dc.doorH>0) ? `${dc.count} porta(s): cada uma ${nice(dc.doorW)} × ${mm(t)} × ${nice(dc.doorH)} mm · vãos E ${nice(dc.gl)} / D ${nice(dc.gr)} / C ${nice(dc.gt)} / B ${nice(dc.gb)} / M ${nice(dc.gm)} mm${handleText}${hingeText}` : 'Os vãos/desconto informados não cabem nesta divisão.';
    if($('doorHingePreview'))$('doorHingePreview').textContent=dc.hingeEnabled
      ? `${dc.hingeCount} dobradiça(s) por porta · copo Ø${nice(dc.cupDiameter)} mm · ${dc.mountEnabled?`placa: linha ${nice(dc.mountFrontOffset)} mm da frente / ${nice(dc.mountSpacing)} mm entre furos`:'somente furo na porta'}`
      : 'Furação de dobradiça desativada';
  } else if(isShelf){
    let rawPos=Number($('piecePosition').value);
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

function createPiecesInSelectedCell(){
  const info=selectedCellInfo(); if(!info){toast('Selecione uma divisão');return false;}
  const root=info.root, c={...info.cell}, s=info.size;
  const t=m($('pieceThickness').value),front=m($('pieceFrontInset').value),back=m($('pieceBackInset').value);
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
  historyMuted=true;
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
    } else if(pieceCreateType==='back'){
      const fillsWhole=pieceFitsWholeAxis(t,s.depth);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura do fundo é maior que esta divisão');
      if(!fillsWhole && t>s.depth-MIN_SIZE) throw new Error('O fundo não deixa espaço livre suficiente');
      const pieceD=fillsWhole?s.depth:t;
      createBox({width:s.width,depth:pieceD,height:s.height,x:info.center.x,yBase:c.minY,z:fillsWhole?info.center.z:c.minZ+pieceD/2,name:'Fundo',kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)},false);
      if(!fillsWhole) newFree.push({...c,minZ:c.minZ+pieceD});
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
      const dc=doorCreationConfig(s);
      if(dc.doorW<mm(MIN_SIZE)||dc.doorH<mm(MIN_SIZE)) throw new Error('Os vãos ou o desconto do puxador ultrapassam o tamanho desta divisão');
      if(dc.hingeEnabled && dc.cupEdge<dc.cupDiameter/2) throw new Error('O centro do copo precisa ficar pelo menos a metade do diâmetro para dentro da porta');
      const fillsWholeDepth=pieceFitsWholeAxis(t,s.depth);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura da porta é maior que a profundidade desta divisão');
      if(!fillsWholeDepth && t>s.depth-MIN_SIZE) throw new Error('A porta não deixa espaço livre suficiente atrás dela');
      const pieceD=fillsWholeDepth?s.depth:t;
      const zDoor=fillsWholeDepth?info.center.z:c.maxZ-pieceD/2;
      const yDoor=c.minY+m(dc.gb+dc.bottomLift);
      const doors=[];
      for(let i=0;i<dc.count;i++){
        const xMm=dc.gl+dc.doorW/2+i*(dc.doorW+dc.gm);
        const x=c.minX+m(xMm);
        const name=dc.count===1?'Porta 1':(dc.count===2?(i===0?'Porta esquerda':'Porta direita'):`Porta ${i+1}`);
        const doorCfg={schemaVersion:1,index:i+1,count:dc.count,gaps:{left:dc.gl,right:dc.gr,top:dc.gt,bottom:dc.gb,middle:dc.gm},handle:{type:dc.handleType,size:dc.handleSize,position:dc.cavaPosition},hinge:{enabled:dc.hingeEnabled,count:dc.hingeCount,side:doorHingeSideForIndex(i,dc.count,dc.hingeSide),cupDiameter:dc.cupDiameter,cupDepth:dc.cupDepth,cupEdge:dc.cupEdge,edgeY:dc.hingeEdgeY,mountEnabled:dc.mountEnabled,mountFrontOffset:dc.mountFrontOffset,mountSpacing:dc.mountSpacing,mountDiameter:dc.mountDiameter,mountDepth:dc.mountDepth}};
        const door=createBox({width:m(dc.doorW),depth:pieceD,height:m(dc.doorH),x,yBase:yDoor,z:zDoor,name,kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,doorConfig:doorCfg},false);
        doors.push(door);
        if(root.doorsHidden){door.visible=false;door.userData.hiddenByDoors=true;}
      }
      let hingeStats={hinges:0,mountHoles:0,missingMount:0};
      if(dc.hingeEnabled){
        for(let i=0;i<doors.length;i++){
          const side=doorHingeSideForIndex(i,dc.count,dc.hingeSide);
          const st=appendDoorHingeDrilling(doors[i],root,dc,side);
          hingeStats.hinges+=st.hinges;hingeStats.mountHoles+=st.mountHoles;hingeStats.missingMount+=st.missingMount;
        }
        renderMachiningVisuals();
      }
      createdCount=doors.length;affectsSpace=false;
      window.__lastDoorCreateStats={...hingeStats,count:doors.length,handleType:dc.handleType,handleSize:dc.handleSize};
    } else if(pieceCreateType==='shelf'){
      const fillsWhole=pieceFitsWholeAxis(t,s.height);
      if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura da prateleira é maior que esta divisão');
      if(!fillsWhole && t>s.height-MIN_SIZE) throw new Error('A prateleira não cabe nessa altura');
      if(fillsWhole){
        createBox({...common,width:s.width,height:s.height,x:info.center.x,yBase:c.minY,z,name:'Prateleira'},false);
        createdCount=1;
      } else {
      let rawPos=Number($('piecePosition').value);
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
    else selectSpaceCellByIds(root.id,c.id);

    // A faixa ocupada pela Divisão vertical fica fixa na espessura da chapa.
    // O restante do móvel é que absorve futuros redimensionamentos.
    if(divisionFixedInterval){
      registerVerticalDivisionFixedBand(root,divisionFixedInterval.x0,divisionFixedInterval.x1);
    }
  } catch(err){
    historyMuted=false;
    toast(err.message||'Não foi possível criar');
    return false;
  }
  historyMuted=false;
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
  else if(pieceCreateType==='shelf' && Number($('piecePosition').value)<=0){
    toast('Prateleira criada no centro · espessura descontada do vão');
  }
  else toast(createdCount>1 ? `${createdCount} prateleiras criadas · espaço dividido` : (filledWhole ? 'Peça criada · corte preenchido' : 'Peça criada · espaço dividido automaticamente'));
  return true;
}

// ---------- v86: Gavetas / corrediças paramétricas ----------
const DRAWER_SLIDE_PRESETS={
  telescopic:{
    id:'telescopic',
    name:'Häfele H45 P · telescópica 30 kg',
    manufacturer:'Häfele',
    model:'H45 P / Matrix Runner BB S',
    sideClearance:12.7,
    railHeight:45.7,
    railWidth:12.7,
    railFrontInset:2,
    mountY:22.85,
    holeDiameter:5,
    holeDepth:10,
    drillFrontRef:37,
    drillOffsets:[0,128,224],
    drillAutoByLength:true,
    drillByLength:{
      250:[0,128],
      300:[0,128,224],
      350:[0,128,224],
      400:[0,128,224,320],
      450:[0,128,224,352],
      500:[0,128,224,352,416],
      550:[0,128,224,352,448],
      600:[0,128,224,352,480],
      650:[0,128,224,352,544],
      700:[0,128,224,352,544]
    },
    catalogByLength:{
      250:'420.50.627',300:'420.50.632',350:'420.50.637',400:'420.50.642',
      450:'420.50.647',500:'420.50.652',550:'420.50.657',600:'420.50.662',
      650:'420.50.667',700:'420.50.672'
    },
    lengths:[250,300,350,400,450,500,550,600,650,700]
  },
  undermount:{
    id:'undermount',
    name:'Oculta · Matrix Runner UM A25',
    manufacturer:'Häfele',
    model:'Matrix Runner UM A25',
    sideClearance:21,
    railHeight:12,
    railWidth:39,
    railExtraLength:18,
    railFrontInset:0,
    mountY:10,
    holeDiameter:5,
    holeDepth:10,
    drillFrontRef:37,
    drillOffsets:[0,128,224],
    lengths:[250,270,300,350,400,450,500,550]
  },
  generic:{id:'generic',name:'Genérica lateral',sideClearance:12.5,railHeight:35,railWidth:9,mountY:18,holeDiameter:5,holeDepth:10,drillFrontRef:37,drillOffsets:[0,64],lengths:[250,300,350,400,450,500,550,600]}
};
let drawerTargetRootId=null,drawerTargetCellId=null,drawerEditingSetId=null;
const DRAWER_SLIDE_LIBRARY_KEY='miniCadProV88_drawerSlideLibrary';
function getDrawerSlideLibrary(){
  try{const a=JSON.parse(localStorage.getItem(DRAWER_SLIDE_LIBRARY_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name):[];}catch(_){return [];}
}
function setDrawerSlideLibrary(a){try{localStorage.setItem(DRAWER_SLIDE_LIBRARY_KEY,JSON.stringify(a||[]));}catch(_){}}
function refreshDrawerSlideLibrarySelect(keep=''){
  const sel=$('drawerSavedSlideSelect');if(!sel)return;
  const arr=getDrawerSlideLibrary();sel.innerHTML='<option value="">Configuração atual / padrão</option>';
  for(const item of arr){const o=document.createElement('option');o.value=item.id;o.textContent=item.name;sel.appendChild(o);}
  if(keep&&arr.some(x=>x.id===keep))sel.value=keep;else sel.value='';
  $('deleteDrawerSlidePreset').disabled=!sel.value;
}
function captureDrawerSlidePreset(){
  return {
    version:4,
    slideType:$('drawerSlideType').value,
    lengthMode:$('drawerLengthMode').value,
    sideClearance:Number($('drawerSideClearance').value),
    frontInset:Number($('drawerFrontInset').value),
    rearClearance:Number($('drawerRearClearance').value),
    createSlides:!!$('drawerCreateSlides').checked,
    createDrilling:!!$('drawerCreateDrilling').checked,

    // Guarda também a caixa e o fundo ligados a esta configuração,
    // para o usuário configurar uma vez e reutilizar.
    boxHeight:Number($('drawerBoxHeight').value),
    boxThickness:Number($('drawerBoxThickness').value),
    edgeGap:Number($('drawerEdgeGap').value),
    bottomThickness:Number($('drawerBottomThickness2').value),
    bottomOffset:Number($('drawerBottomOffset').value),
    bottomPassLeft:Number($('drawerBottomPassLeft').value),
    bottomPassRight:Number($('drawerBottomPassRight').value),
    bottomPassFront:Number($('drawerBottomPassFront').value),
    bottomPassBack:Number($('drawerBottomPassBack').value),
    machineBottom:!!$('drawerMachineBottom').checked,
    bottomGrooveClearance:Number($('drawerBottomGrooveClearance').value),
    bottomGrooveDepth:Number($('drawerBottomGrooveDepth').value),
    grooveLeft:!!$('drawerGrooveLeft').checked,
    grooveRight:!!$('drawerGrooveRight').checked,
    grooveFront:!!$('drawerGrooveFront').checked,
    grooveBack:!!$('drawerGrooveBack').checked,
    drillFrontRef:Number($('drawerDrillFrontRef').value),
    drillOffsets:drawerParseDrillOffsets($('drawerDrillOffsets').value),
    drillAutoByLength:!!$('drawerDrillAutoByLength').checked,
    drillMountY:Number($('drawerDrillMountY').value),
    drillDiameter:Number($('drawerDrillDiameter').value),
    drillDepth:Number($('drawerDrillDepth').value)
  };
}
function saveDrawerSlidePresetLibrary(){
  const data=captureDrawerSlidePreset();
  if(!Number.isFinite(data.sideClearance)||data.sideClearance<0||!Number.isFinite(data.frontInset)||!Number.isFinite(data.rearClearance)){toast('Confira as medidas da corrediça');return;}

  const arr=getDrawerSlideLibrary(),selectedId=$('drawerSavedSlideSelect').value;
  let item=selectedId?arr.find(x=>x.id===selectedId):null;

  let name=String($('drawerSavedSlideName').value||'').trim();
  if(!name&&item)name=item.name;
  if(!name){
    const typeName=$('drawerSlideType').selectedOptions?.[0]?.textContent?.trim()||'Corrediça';
    const length=$('drawerLengthMode').value;
    name=`${typeName}${length==='auto'?' · automática':` · ${length} mm`}`;
  }

  if(item){
    Object.assign(item,data,{name,updatedAt:new Date().toISOString()});
  }else{
    item={id:uid('slidePreset'),name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...data};
    arr.push(item);
  }

  setDrawerSlideLibrary(arr);
  refreshDrawerSlideLibrarySelect(item.id);
  $('drawerSavedSlideName').value=item.name;
  toast(selectedId?'Configuração da corrediça atualizada':'Configuração da corrediça salva');
}
function applyDrawerSlidePresetLibrary(){
  const id=$('drawerSavedSlideSelect').value,item=getDrawerSlideLibrary().find(x=>x.id===id);
  $('deleteDrawerSlidePreset').disabled=!item;
  if(!item){$('drawerSavedSlideName').value='';return;}

  $('drawerSavedSlideName').value=item.name;
  $('drawerSlideType').value=item.slideType||'telescopic';
  $('drawerLengthMode').value=item.lengthMode||'auto';
  $('drawerSideClearance').value=nice(item.sideClearance??drawerPreset(item.slideType).sideClearance);
  $('drawerFrontInset').value=nice(item.frontInset??5);
  $('drawerRearClearance').value=nice(item.rearClearance??10);
  $('drawerCreateSlides').checked=item.createSlides!==false;
  $('drawerCreateDrilling').checked=item.createDrilling!==false;

  if(Number.isFinite(Number(item.boxHeight)))$('drawerBoxHeight').value=nice(item.boxHeight);
  if(Number.isFinite(Number(item.boxThickness)))$('drawerBoxThickness').value=nice(item.boxThickness);
  if(Number.isFinite(Number(item.edgeGap)))$('drawerEdgeGap').value=nice(item.edgeGap);
  if(Number.isFinite(Number(item.bottomThickness)))$('drawerBottomThickness2').value=nice(item.bottomThickness);
  if(Number.isFinite(Number(item.bottomOffset)))$('drawerBottomOffset').value=nice(item.bottomOffset);
  if(Number.isFinite(Number(item.bottomPassLeft)))$('drawerBottomPassLeft').value=nice(item.bottomPassLeft);
  if(Number.isFinite(Number(item.bottomPassRight)))$('drawerBottomPassRight').value=nice(item.bottomPassRight);
  if(Number.isFinite(Number(item.bottomPassFront)))$('drawerBottomPassFront').value=nice(item.bottomPassFront);
  if(Number.isFinite(Number(item.bottomPassBack)))$('drawerBottomPassBack').value=nice(item.bottomPassBack);
  if(typeof item.machineBottom==='boolean')$('drawerMachineBottom').checked=item.machineBottom;
  if(Number.isFinite(Number(item.bottomGrooveClearance)))$('drawerBottomGrooveClearance').value=nice(item.bottomGrooveClearance);
  if(Number.isFinite(Number(item.bottomGrooveDepth)))$('drawerBottomGrooveDepth').value=nice(item.bottomGrooveDepth);

  $('drawerGrooveLeft').checked=item.grooveLeft!==false;
  $('drawerGrooveRight').checked=item.grooveRight!==false;
  $('drawerGrooveFront').checked=item.grooveFront===true;
  $('drawerGrooveBack').checked=item.grooveBack===true;

  const savedDrillPreset=drawerPreset(item.slideType||'telescopic');
  const drillDefault=drawerDrillDefaults(savedDrillPreset);
  $('drawerDrillFrontRef').value=nice(Number.isFinite(Number(item.drillFrontRef))?Number(item.drillFrontRef):drillDefault.frontRef);
  $('drawerDrillOffsets').value=drawerParseDrillOffsets(item.drillOffsets?.length?item.drillOffsets:drillDefault.offsets).map(n=>nice(n)).join(', ');
  $('drawerDrillAutoByLength').checked=typeof item.drillAutoByLength==='boolean'
    ? item.drillAutoByLength
    : !!savedDrillPreset.drillByLength;
  $('drawerDrillMountY').value=nice(Number.isFinite(Number(item.drillMountY))?Number(item.drillMountY):drillDefault.mountY);
  $('drawerDrillDiameter').value=nice(Number.isFinite(Number(item.drillDiameter))?Number(item.drillDiameter):drillDefault.diameter);
  $('drawerDrillDepth').value=nice(Number.isFinite(Number(item.drillDepth))?Number(item.drillDepth):drillDefault.depth);

  drawerApplyPresetDefaults(false);
  updateDrawerBottomMachiningFields();
  updateDrawerDrillingFields();
}
function deleteDrawerSlidePresetLibrary(){
  const id=$('drawerSavedSlideSelect').value,item=getDrawerSlideLibrary().find(x=>x.id===id);if(!item){toast('Escolha uma corrediça salva');return;}
  if(!window.confirm(`Excluir “${item.name}” da biblioteca?`))return;
  setDrawerSlideLibrary(getDrawerSlideLibrary().filter(x=>x.id!==id));refreshDrawerSlideLibrarySelect();$('drawerSavedSlideName').value='';toast('Corrediça removida da biblioteca');
}


function drawerParseDrillOffsets(raw){
  const source=Array.isArray(raw)?raw:String(raw??'').trim().split(/[;\s|/]+|,(?=\s*\d)/);
  const out=[];
  for(const v of source){
    const n=Number(String(v).trim().replace(',','.'));
    if(!Number.isFinite(n)||n<0)continue;
    if(!out.some(x=>Math.abs(x-n)<.001))out.push(n);
  }
  return out.sort((a,b)=>a-b);
}
function drawerDrillTableOffsets(presetOrId,length){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  const table=p?.drillByLength;
  if(!table)return null;
  const key=String(Math.round(Number(length)||0));
  const row=table[key]??table[Number(key)];
  return Array.isArray(row)?drawerParseDrillOffsets(row):null;
}
function drawerCatalogCodeForLength(presetOrId,length){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  if(!p?.catalogByLength)return '';
  const key=String(Math.round(Number(length)||0));
  return String(p.catalogByLength[key]??p.catalogByLength[Number(key)]??'');
}
function drawerDrillDefaults(presetOrId){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  return {
    frontRef:Number.isFinite(Number(p?.drillFrontRef))?Number(p.drillFrontRef):37,
    offsets:drawerParseDrillOffsets(p?.drillOffsets?.length?p.drillOffsets:[0,64,128]),
    mountY:Number.isFinite(Number(p?.mountY))?Number(p.mountY):10,
    diameter:Number.isFinite(Number(p?.holeDiameter))?Number(p.holeDiameter):5,
    depth:Number.isFinite(Number(p?.holeDepth))?Number(p.holeDepth):10
  };
}
function drawerDrillValuesFromUi(){
  const p=drawerPreset($('drawerSlideType')?.value),d=drawerDrillDefaults(p);
  const frontRef=Number($('drawerDrillFrontRef')?.value),mountY=Number($('drawerDrillMountY')?.value),diameter=Number($('drawerDrillDiameter')?.value),depth=Number($('drawerDrillDepth')?.value);
  const offsets=drawerParseDrillOffsets($('drawerDrillOffsets')?.value);
  return {
    frontRef:Number.isFinite(frontRef)?frontRef:d.frontRef,
    offsets:offsets.length?offsets:d.offsets,
    autoByLength:!!$('drawerDrillAutoByLength')?.checked,
    mountY:Number.isFinite(mountY)?mountY:d.mountY,
    diameter:Number.isFinite(diameter)?diameter:d.diameter,
    depth:Number.isFinite(depth)?depth:d.depth
  };
}
function drawerAbsoluteDrillPositions(cfg,preset=null){
  const p=preset||drawerPreset(cfg?.slideType),d=drawerDrillDefaults(p);
  const frontRef=Number.isFinite(Number(cfg?.drillFrontRef))?Number(cfg.drillFrontRef):d.frontRef;
  const length=Number(cfg?.resolvedLength)||Infinity;

  const useAuto=(cfg?.drillAutoByLength!==false)&&!!p?.drillByLength;
  const tableOffsets=useAuto?drawerDrillTableOffsets(p,length):null;
  const offsets=tableOffsets?.length
    ? tableOffsets
    : drawerParseDrillOffsets(cfg?.drillOffsets?.length?cfg.drillOffsets:d.offsets);

  return offsets.map(v=>frontRef+v).filter(v=>v>=0&&v<=length-15+.001);
}
function drawerSetDrillingUiFromPreset(presetOrId){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  const d=drawerDrillDefaults(p);
  $('drawerDrillFrontRef').value=nice(d.frontRef);
  $('drawerDrillOffsets').value=d.offsets.map(n=>nice(n)).join(', ');
  $('drawerDrillAutoByLength').checked=!!p?.drillByLength && p.drillAutoByLength!==false;
  $('drawerDrillMountY').value=nice(d.mountY);
  $('drawerDrillDiameter').value=nice(d.diameter);
  $('drawerDrillDepth').value=nice(d.depth);
}
function updateDrawerDrillingFields(){
  const on=!!$('drawerCreateDrilling')?.checked;
  if($('drawerDrillingFields'))$('drawerDrillingFields').style.display=on?'block':'none';

  try{
    const vals=drawerDrillValuesFromUi(),target=drawerTarget(),preset=drawerPreset($('drawerSlideType').value);
    const resolved=target
      ? drawerResolvedLengthMm(target.cell,preset,$('drawerLengthMode').value,Number($('drawerFrontInset').value)||0,Number($('drawerRearClearance').value)||0)
      : {length:Number($('drawerLengthMode').value)||0};

    const hasTable=!!preset?.drillByLength;
    $('drawerDrillAutoRow').style.display=hasTable?'flex':'none';

    const auto=hasTable&&vals.autoByLength;
    const row=auto?drawerDrillTableOffsets(preset,resolved.length):null;

    if(auto&&row?.length){
      $('drawerDrillOffsets').value=row.map(n=>nice(n)).join(', ');
      $('drawerDrillOffsets').readOnly=true;
    }else{
      $('drawerDrillOffsets').readOnly=false;
    }

    if(on&&$('drawerDrillResult')){
      const cfg={
        slideType:preset.id,
        resolvedLength:resolved.length,
        drillFrontRef:vals.frontRef,
        drillOffsets:auto&&row?.length?row:vals.offsets,
        drillAutoByLength:auto
      };
      const abs=drawerAbsoluteDrillPositions(cfg,preset);
      const code=drawerCatalogCodeForLength(preset,resolved.length);
      const rel=auto&&row?.length?row:vals.offsets;
      $('drawerDrillResult').innerHTML=
        `<strong>${auto?'Catálogo automático':'Manual'}:</strong> `+
        `${nice(vals.frontRef)} + [${rel.map(n=>nice(n)).join(', ')}] = `+
        `<strong>${abs.length?abs.map(n=>nice(n)).join(' / '):'nenhum ponto válido'} mm</strong> desde a frente`+
        `${code?` · Häfele ${code}`:''}`+
        ` · linha Y ${nice(vals.mountY)} mm · Ø${nice(vals.diameter)} × ${nice(vals.depth)} mm.`;
    }
  }catch(_){}

  updateDrawerSystemPreview();
}

function drawerPreset(id){return DRAWER_SLIDE_PRESETS[id]||DRAWER_SLIDE_PRESETS.telescopic;}
function drawerSetObjects(id){return objects.filter(o=>o.userData?.drawerSetId===id);}
function drawerSetRepresentative(id){return drawerSetObjects(id).find(o=>o.userData?.drawerConfig)||null;}
function drawerSetIdsForTarget(rootId,cellId){
  const ids=new Set();
  for(const o of objects){
    const u=o.userData;
    if(!u?.drawerSetId||!u.drawerConfig)continue;
    const cfg=u.drawerConfig;
    if(cfg.targetRootId===rootId&&cfg.targetCellId===cellId)ids.add(u.drawerSetId);
  }
  return [...ids];
}
function drawerPrimarySetIdForTarget(rootId,cellId){
  const ids=drawerSetIdsForTarget(rootId,cellId);
  return ids.length?ids[0]:null;
}
function removeDrawerSetsForTarget(rootId,cellId,{exceptId=null}={}){
  const ids=drawerSetIdsForTarget(rootId,cellId).filter(id=>id&&id!==exceptId);
  let removed=0;
  for(const id of ids)removed+=removeDrawerSet(id,{commit:false,keepSelection:true});
  return {ids,removed};
}
function drawerConfigFromSet(id){const o=drawerSetRepresentative(id);return o?.userData?.drawerConfig?JSON.parse(JSON.stringify(o.userData.drawerConfig)):null;}
function drawerUniqueConfigsForRoot(rootId){
  const map=new Map();
  for(const o of objects){
    const u=o.userData;if(u?.spaceRootId!==rootId||!u.drawerSetId||!u.drawerConfig||map.has(u.drawerSetId))continue;
    map.set(u.drawerSetId,JSON.parse(JSON.stringify(u.drawerConfig)));
  }
  return [...map.values()];
}
function drawerTarget(){
  const root=drawerTargetRootId?getSpaceRoot(drawerTargetRootId):null;
  const cell=root&&drawerTargetCellId?getSpaceCell(root.id,drawerTargetCellId):null;
  return root&&cell?{root,cell,size:cellSize(cell),center:cellCenter(cell)}:null;
}
function drawerAutoLengthMm(cell,preset,frontInset,rearClear){
  const available=mm(cell.maxZ-cell.minZ)-frontInset-rearClear;
  const lengths=(preset.lengths||[]).filter(v=>v<=available+.001);
  return lengths.length?Math.max(...lengths):0;
}
function drawerResolvedLengthMm(cell,preset,mode,frontInset,rearClear){
  const available=mm(cell.maxZ-cell.minZ)-frontInset-rearClear;
  const requested=String(mode||'auto')==='auto'?drawerAutoLengthMm(cell,preset,frontInset,rearClear):Number(mode);
  return {length:Number(requested)||0,available};
}
function drawerApplyPresetDefaults(force=false){
  const p=drawerPreset($('drawerSlideType')?.value);
  if(force||!Number.isFinite(Number($('drawerSideClearance')?.value)))$('drawerSideClearance').value=nice(p.sideClearance);
  if(force||!Number.isFinite(Number($('drawerDrillFrontRef')?.value)))drawerSetDrillingUiFromPreset(p);
  const d=drawerDrillDefaults(p),pattern=`${nice(d.frontRef)} + [${d.offsets.map(n=>nice(n)).join(', ')}]`;
  $('drawerPresetHint').textContent=p.id==='undermount'
    ? `${p.name} · folga ${nice(p.sideClearance)} mm/lado (caixa = vão - ${nice(p.sideClearance*2)} mm) · furação ${pattern}. Tudo pode ser ajustado abaixo.`
    : p.id==='telescopic'
      ? `${p.name} · folga EXATA ${nice(p.sideClearance)} mm/lado · altura ${nice(p.railHeight)} mm · 37 mm da frente · pontos automáticos conforme 250–700 mm.`
      : `${p.name} · comprimentos ${p.lengths.join(' / ')} mm · furação ${pattern}. Tudo pode ser ajustado abaixo.`;
}
function drawerReadConfig(){
  const target=drawerTarget();if(!target)throw new Error('Selecione uma divisão');
  const preset=drawerPreset($('drawerSlideType').value);
  const count=Math.max(1,Math.min(20,Math.round(Number($('drawerCount').value)||1)));
  const sideClearance=Number($('drawerSideClearance').value),boxHeight=Number($('drawerBoxHeight').value),boxThickness=Number($('drawerBoxThickness').value),bottomThickness=Number($('drawerBottomThickness2').value),frontInset=Number($('drawerFrontInset').value),rearClearance=Number($('drawerRearClearance').value),edgeGap=Number($('drawerEdgeGap').value);
  const bottomOffset=Number($('drawerBottomOffset').value),bottomPassLeft=Number($('drawerBottomPassLeft').value),bottomPassRight=Number($('drawerBottomPassRight').value),bottomPassFront=Number($('drawerBottomPassFront').value),bottomPassBack=Number($('drawerBottomPassBack').value);
  const machineBottom=!!$('drawerMachineBottom').checked,bottomGrooveClearance=Number($('drawerBottomGrooveClearance').value),bottomGrooveDepth=Number($('drawerBottomGrooveDepth').value);
  const grooveLeft=!!$('drawerGrooveLeft').checked,grooveRight=!!$('drawerGrooveRight').checked,grooveFront=!!$('drawerGrooveFront').checked,grooveBack=!!$('drawerGrooveBack').checked;
  const createFronts=!!$('drawerCreateFronts').checked,frontThickness=Number($('drawerFrontThickness').value),frontGapLeft=Number($('drawerFrontGapLeft').value),frontGapRight=Number($('drawerFrontGapRight').value),frontGapTop=Number($('drawerFrontGapTop').value),frontGapBottom=Number($('drawerFrontGapBottom').value),frontGapBetween=Number($('drawerFrontGapBetween').value);
  const drillUi=drawerDrillValuesFromUi();
  const drillFrontRef=drillUi.frontRef,drillOffsets=drillUi.offsets,drillAutoByLength=drillUi.autoByLength,drillMountY=drillUi.mountY,drillDiameter=drillUi.diameter,drillDepth=drillUi.depth;

  if(![sideClearance,boxHeight,boxThickness,bottomThickness,frontInset,rearClearance,edgeGap,bottomOffset,bottomPassLeft,bottomPassRight,bottomPassFront,bottomPassBack,bottomGrooveClearance,bottomGrooveDepth,drillFrontRef,drillMountY,drillDiameter,drillDepth].every(Number.isFinite))throw new Error('Confira as medidas das gavetas');
  if(Math.min(sideClearance,frontInset,rearClearance,edgeGap,bottomPassLeft,bottomPassRight,bottomPassFront,bottomPassBack,bottomGrooveClearance,drillFrontRef,drillMountY)<0||boxHeight<=0||boxThickness<=0||bottomThickness<=0||bottomGrooveDepth<=0||drillDiameter<=0||drillDepth<=0)throw new Error('Confira as medidas das gavetas');
  if($('drawerCreateDrilling').checked&&!drillOffsets.length)throw new Error('Informe pelo menos um ponto de furação da corrediça');
  if(machineBottom){
    const grooveW=bottomThickness+bottomGrooveClearance;
    if(bottomOffset<0)throw new Error('Para usinar o fundo, a posição vertical não pode ser negativa');
    if(bottomOffset+grooveW>boxHeight+.001)throw new Error('O rasgo do fundo ultrapassa a altura da caixa');
    if(bottomGrooveDepth>boxThickness+.001)throw new Error(`Profundidade máxima do rasgo: ${nice(boxThickness)} mm`);
    if(!grooveLeft&&!grooveRight&&!grooveFront&&!grooveBack)throw new Error('Marque pelo menos um lado para usinar o fundo');
  }
  if(createFronts){
    if(![frontThickness,frontGapLeft,frontGapRight,frontGapTop,frontGapBottom,frontGapBetween].every(Number.isFinite)||frontThickness<=0)throw new Error('Confira as medidas das frentes');
    if(Math.max(Math.abs(frontGapLeft),Math.abs(frontGapRight),Math.abs(frontGapTop),Math.abs(frontGapBottom),Math.abs(frontGapBetween))>1000)throw new Error('Folga das frentes fora do limite');
  }

  const resolved=drawerResolvedLengthMm(target.cell,preset,$('drawerLengthMode').value,frontInset,rearClearance);
  if(resolved.available<100)throw new Error('A profundidade útil é muito pequena para uma corrediça');
  if(resolved.length<=0)throw new Error(`Nenhum comprimento padrão cabe nos ${nice(resolved.available)} mm úteis`);
  if(resolved.length>resolved.available+.001)throw new Error(`Corrediça de ${nice(resolved.length)} mm não cabe. Disponível: ${nice(resolved.available)} mm`);

  const openingW=mm(target.size.width),openingH=mm(target.size.height),outerW=openingW-sideClearance*2,innerW=outerW-boxThickness*2;
  if(outerW<=boxThickness*2+10)throw new Error('A folga lateral não deixa largura suficiente para a caixa');

  let frontW=0,frontH=0;
  if(createFronts){
    frontW=openingW-frontGapLeft-frontGapRight;
    const availableFrontH=openingH-frontGapTop-frontGapBottom-frontGapBetween*(count-1);
    frontH=availableFrontH/count;
    if(frontW<=10||frontH<=10)throw new Error('As folgas das frentes ultrapassam o tamanho do vão');
    if(boxHeight>frontH+.001)throw new Error(`A caixa (${nice(boxHeight)} mm) é mais alta que cada frente (${nice(frontH)} mm)`);
  }else{
    if(boxHeight+edgeGap*2>openingH+.001)throw new Error('A altura da caixa + folgas não cabe neste vão');
    if(count>1 && openingH-edgeGap*2-boxHeight<1)throw new Error('Não há altura suficiente para distribuir as gavetas');
  }

  const bottomBaseW=innerW,bottomBaseD=Math.max(1,resolved.length-boxThickness*2);
  const bottomW=bottomBaseW+bottomPassLeft+bottomPassRight;
  const bottomD=bottomBaseD+bottomPassFront+bottomPassBack;
  if(bottomW<=1||bottomD<=1)throw new Error('Confira o tamanho final do fundo');
  if(bottomOffset+bottomThickness>boxHeight+50||bottomOffset<-50)throw new Error('Confira a posição vertical do fundo');

  // 1.100.4:
  // Quando o fundo avança para frente/atrás, ele atravessaria fisicamente
  // a contra frente / contra fundo. Nesse caso cortamos o painel por baixo
  // até o topo do fundo.
  const bottomTop=Math.max(0,bottomOffset+bottomThickness);
  const bottomCutFront=bottomPassFront>.001?bottomTop:0;
  const bottomCutBack=bottomPassBack>.001?bottomTop:0;
  if(bottomCutFront>=boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra frente');
  if(bottomCutBack>=boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra fundo');

  return {
    id:drawerEditingSetId||uid('drawerset'),name:`${count} gaveta${count>1?'s':''} · ${preset.name}`,
    targetRootId:target.root.id,targetCellId:target.cell.id,
    slideType:preset.id,slideName:preset.name,lengthMode:$('drawerLengthMode').value,
    resolvedLength:resolved.length,availableDepth:resolved.available,sideClearance,boxHeight,boxThickness,bottomThickness,frontInset,rearClearance,edgeGap,count,
    bottomOffset,bottomPassLeft,bottomPassRight,bottomPassFront,bottomPassBack,bottomW,bottomD,bottomCutFront,bottomCutBack,
    machineBottom,bottomGrooveClearance,bottomGrooveDepth,grooveLeft,grooveRight,grooveFront,grooveBack,
    createFronts,frontThickness,frontGapLeft,frontGapRight,frontGapTop,frontGapBottom,frontGapBetween,frontW,frontH,
    createSlides:!!$('drawerCreateSlides').checked,createDrilling:!!$('drawerCreateDrilling').checked,
    drillFrontRef,drillOffsets,drillAutoByLength,drillMountY,drillDiameter,drillDepth,
    openingW,openingH,openingD:mm(target.size.depth),outerW,innerW,
    version:4
  };
}
function updateDrawerSystemPreview(){
  const target=drawerTarget(),preview=$('drawerPreview'),status=$('drawerHardwareStatus');
  if(!target){if(preview)preview.textContent='Selecione uma divisão.';return;}
  try{
    const cfg=drawerReadConfig(),p=drawerPreset(cfg.slideType);
    $('drawerResolvedLength').value=`${nice(cfg.resolvedLength)} mm`;
    $('drawerTargetInfo').innerHTML=`<strong>${target.root.name}</strong> · vão L ${nice(cfg.openingW)} × P ${nice(cfg.openingD)} × A ${nice(cfg.openingH)} mm`;
    const freeSpan=cfg.openingH-2*cfg.edgeGap-cfg.boxHeight;
    const step=cfg.count>1?freeSpan/(cfg.count-1):0;
    const frontTxt=cfg.createFronts
      ? `<br><strong>Frentes:</strong> ${cfg.count} × ${nice(cfg.frontW)} × ${nice(cfg.frontThickness)} × ${nice(cfg.frontH)} mm · folgas E ${nice(cfg.frontGapLeft)} / D ${nice(cfg.frontGapRight)} / C ${nice(cfg.frontGapTop)} / B ${nice(cfg.frontGapBottom)} / entre ${nice(cfg.frontGapBetween)} mm`
      : '<br><strong>Frentes:</strong> não criar';
    const grooveSides=[];
    if(cfg.grooveLeft)grooveSides.push('lateral E');
    if(cfg.grooveRight)grooveSides.push('lateral D');
    if(cfg.grooveFront&&!(cfg.bottomCutFront>0))grooveSides.push('contra frente');
    if(cfg.grooveBack&&!(cfg.bottomCutBack>0))grooveSides.push('contra fundo');
    const groovePieces=grooveSides.length;
    const grooveTotal=cfg.count*groovePieces;
    const grooveTxt=cfg.machineBottom
      ? ` · <strong>rasgos automáticos:</strong> ${grooveTotal} total · ${grooveSides.join(' + ')} · ${nice(cfg.bottomThickness+cfg.bottomGrooveClearance)} mm largura × ${nice(cfg.bottomGrooveDepth)} mm profundidade${(cfg.grooveFront&&cfg.bottomCutFront>0)||(cfg.grooveBack&&cfg.bottomCutBack>0)?' · peça recortada não recebe rasgo':''}`
      : ` · <strong style="color:#ffae52">usinagem do fundo desligada</strong>`;
    const autoCutTxt=(cfg.bottomCutFront>0||cfg.bottomCutBack>0)
      ? `<br><strong>Recorte automático:</strong> contra frente ${nice(cfg.bottomCutFront)} mm · contra fundo ${nice(cfg.bottomCutBack)} mm, medidos por baixo até o topo do fundo`
      : '';
    const bottomTxt=`<br><strong>Fundo:</strong> ${nice(cfg.bottomW)} × ${nice(cfg.bottomD)} × ${nice(cfg.bottomThickness)} mm · posição ${nice(cfg.bottomOffset)} mm · passa E ${nice(cfg.bottomPassLeft)} / D ${nice(cfg.bottomPassRight)} / F ${nice(cfg.bottomPassFront)} / T ${nice(cfg.bottomPassBack)} mm${autoCutTxt}${grooveTxt}`;
    preview.innerHTML=`<strong>Caixa externa:</strong> ${nice(cfg.outerW)} × ${nice(cfg.resolvedLength)} × ${nice(cfg.boxHeight)} mm<br><strong>Contra frente/fundo entre laterais:</strong> ${nice(cfg.innerW)} mm · MDF ${nice(cfg.boxThickness)} mm${bottomTxt}${frontTxt}<br><strong>Distribuição:</strong> ${cfg.count} gaveta(s)${!cfg.createFronts&&cfg.count>1?` · passo vertical ${nice(step)} mm`:cfg.createFronts?' · caixas centralizadas atrás das frentes':''}<br><strong>Corrediça:</strong> ${p.name} · ${nice(cfg.resolvedLength)} mm · folga ${nice(cfg.sideClearance)} mm por lado`;
    const left=drawerFindSidePanel(cfg,'left'),right=drawerFindSidePanel(cfg,'right');
    const drillPos=drawerAbsoluteDrillPositions(cfg,p);
    const catCode=drawerCatalogCodeForLength(p,cfg.resolvedLength);
    status.textContent=cfg.createDrilling
      ? `Furação automática: E ${left?'OK':'não encontrada'} · D ${right?'OK':'não encontrada'} · ${cfg.drillAutoByLength&&p.drillByLength?'CATÁLOGO':'manual'} · posições ${drillPos.map(n=>nice(n)).join(' / ')} mm desde a frente${catCode?` · Häfele ${catCode}`:''} · linha ${nice(cfg.drillMountY)} mm · Ø${nice(cfg.drillDiameter)} × ${nice(cfg.drillDepth)} mm.`
      : 'Furação automática desligada.';
  }catch(err){
    $('drawerResolvedLength').value='—';
    preview.innerHTML=`<strong style="color:#ff7169">${err.message||'Confira as medidas'}</strong>`;
    if(status)status.textContent='Ajuste as medidas para calcular.';
  }
}
function updateDrawerBottomMachiningFields(){
  const on=!!$('drawerMachineBottom')?.checked;
  if($('drawerBottomMachiningFields'))$('drawerBottomMachiningFields').style.display=on?'grid':'none';
  if($('drawerBottomMachiningHelp'))$('drawerBottomMachiningHelp').style.display=on?'block':'none';
  updateDrawerSystemPreview();
}
function updateDrawerFrontFields(){
  const on=!!$('drawerCreateFronts')?.checked;
  if($('drawerFrontFields'))$('drawerFrontFields').style.display=on?'block':'none';
  updateDrawerSystemPreview();
}
function openDrawerSystemDialog(source=null){
  if(visualMode)setVisualMode(false,{notify:false,frame:false});

  let existingId=source?.userData?.drawerSetId||selected?.userData?.drawerSetId||null;

  // Se o usuário abriu a ferramenta pelo VÃO, detecta automaticamente se já
  // existe um conjunto de gavetas naquele mesmo vão. Assim "Gavetas /
  // corrediças" vira edição, em vez de criar um segundo conjunto por cima.
  if(!existingId&&selectedSpaceCell){
    existingId=drawerPrimarySetIdForTarget(selectedSpaceCell.rootId,selectedSpaceCell.cellId);
  }

  drawerEditingSetId=existingId;
  let cfg=existingId?drawerConfigFromSet(existingId):null;

  if(cfg){
    drawerTargetRootId=cfg.targetRootId;
    drawerTargetCellId=cfg.targetCellId;
  }else{
    if(!selectedSpaceCell){
      let root=activeSpaceRoot();
      if(!root&&selected)root=rootForObject(selected);
      if(root){
        const cell=largestVisibleCell(root);if(cell)selectSpaceCellByIds(root.id,cell.id);
      }
    }
    if(!selectedSpaceCell){toast('Selecione uma divisão para criar as gavetas');return;}
    drawerTargetRootId=selectedSpaceCell.rootId;
    drawerTargetCellId=selectedSpaceCell.cellId;

    // Segunda chance: o maior vão selecionado automaticamente também pode já
    // possuir gavetas de um projeto antigo.
    existingId=drawerPrimarySetIdForTarget(drawerTargetRootId,drawerTargetCellId);
    if(existingId){
      drawerEditingSetId=existingId;
      cfg=drawerConfigFromSet(existingId);
    }
  }
  const target=drawerTarget();
  if(!target){toast('A divisão original deste conjunto não existe mais');drawerEditingSetId=null;return;}
  const preset=drawerPreset(cfg?.slideType||'telescopic');
  $('drawerSlideType').value=cfg?.slideType||preset.id;
  $('drawerLengthMode').value=cfg?.lengthMode||'auto';
  $('drawerCount').value=cfg?.count??3;
  $('drawerBoxHeight').value=cfg?.boxHeight??120;
  const rootMaterial=spaceDefaultMaterial(target.root);
  $('drawerBoxThickness').value=cfg?.boxThickness??rootMaterial?.thickness??15;
  $('drawerBottomThickness2').value=cfg?.bottomThickness??6;
  $('drawerBottomOffset').value=cfg?.bottomOffset??0;
  $('drawerBottomPassLeft').value=cfg?.bottomPassLeft??0;
  $('drawerBottomPassRight').value=cfg?.bottomPassRight??0;
  $('drawerBottomPassFront').value=cfg?.bottomPassFront??0;
  $('drawerBottomPassBack').value=cfg?.bottomPassBack??0;
  $('drawerMachineBottom').checked=cfg ? !!cfg.machineBottom : true;
  $('drawerBottomGrooveClearance').value=cfg?.bottomGrooveClearance??0.5;
  $('drawerBottomGrooveDepth').value=cfg?.bottomGrooveDepth??6;
  $('drawerGrooveLeft').checked=cfg?.grooveLeft!==false;
  $('drawerGrooveRight').checked=cfg?.grooveRight!==false;
  $('drawerGrooveFront').checked=cfg?.grooveFront===true;
  $('drawerGrooveBack').checked=cfg?.grooveBack===true;
  $('drawerFrontInset').value=cfg?.frontInset??5;
  $('drawerRearClearance').value=cfg?.rearClearance??10;
  $('drawerEdgeGap').value=cfg?.edgeGap??20;
  $('drawerSideClearance').value=cfg?.sideClearance??preset.sideClearance;
  $('drawerCreateFronts').checked=cfg?.createFronts!==false;
  $('drawerFrontThickness').value=cfg?.frontThickness??rootMaterial?.thickness??18;
  $('drawerFrontGapLeft').value=cfg?.frontGapLeft??2;
  $('drawerFrontGapRight').value=cfg?.frontGapRight??2;
  $('drawerFrontGapTop').value=cfg?.frontGapTop??2;
  $('drawerFrontGapBottom').value=cfg?.frontGapBottom??2;
  $('drawerFrontGapBetween').value=cfg?.frontGapBetween??2;
  $('drawerCreateSlides').checked=cfg?.createSlides!==false;
  $('drawerCreateDrilling').checked=cfg?.createDrilling!==false;
  const openDrillPreset=drawerPreset(cfg?.slideType||preset.id);
  const drillDefault=drawerDrillDefaults(openDrillPreset);
  $('drawerDrillFrontRef').value=nice(Number.isFinite(Number(cfg?.drillFrontRef))?Number(cfg.drillFrontRef):drillDefault.frontRef);
  $('drawerDrillOffsets').value=drawerParseDrillOffsets(cfg?.drillOffsets?.length?cfg.drillOffsets:drillDefault.offsets).map(n=>nice(n)).join(', ');
  $('drawerDrillAutoByLength').checked=typeof cfg?.drillAutoByLength==='boolean'
    ? cfg.drillAutoByLength
    : !!openDrillPreset.drillByLength;
  $('drawerDrillMountY').value=nice(Number.isFinite(Number(cfg?.drillMountY))?Number(cfg.drillMountY):drillDefault.mountY);
  $('drawerDrillDiameter').value=nice(Number.isFinite(Number(cfg?.drillDiameter))?Number(cfg.drillDiameter):drillDefault.diameter);
  $('drawerDrillDepth').value=nice(Number.isFinite(Number(cfg?.drillDepth))?Number(cfg.drillDepth):drillDefault.depth);
  $('drawerDialogTitle').textContent=cfg?'▤ Editar gavetas / corrediças':'▤ Gavetas / corrediças';
  $('drawerEditBadge').style.display=cfg?'block':'none';
  $('deleteDrawerSet').style.display=cfg?'block':'none';
  $('confirmDrawerSystem').textContent=cfg?'Atualizar conjunto':'Criar gavetas';
  drawerApplyPresetDefaults(false);
  refreshDrawerSlideLibrarySelect();

  // Se está editando um conjunto existente, já deixa um nome útil pronto.
  // Basta ajustar e tocar em "Salvar configuração".
  if(cfg){
    const typeName=$('drawerSlideType').selectedOptions?.[0]?.textContent?.trim()||cfg.slideName||'Corrediça';
    $('drawerSavedSlideName').value=cfg.savedSlidePresetName||`${typeName} · ${cfg.lengthMode==='auto'?'automática':cfg.lengthMode+' mm'}`;
  }else{
    $('drawerSavedSlideName').value='';
  }

  $('drawerSystemDialog').style.display='flex';
  updateDrawerFrontFields();
  updateDrawerBottomMachiningFields();
  updateDrawerDrillingFields();
}
function drawerReferenceGeometry(cfg){
  const set=drawerSetObjects(cfg.id);
  const leftBoxes=set.filter(o=>o.userData?.drawerRole==='side-left');
  const rightBoxes=set.filter(o=>o.userData?.drawerRole==='side-right');
  const allBoxes=[...leftBoxes,...rightBoxes];
  if(!allBoxes.length)return null;

  let minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const o of allBoxes){
    const b=getBounds(o);
    minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY);
    minZ=Math.min(minZ,b.minZ);maxZ=Math.max(maxZ,b.maxZ);
  }

  const leftOuter=leftBoxes.length?Math.min(...leftBoxes.map(o=>getBounds(o).minX)):null;
  const rightOuter=rightBoxes.length?Math.max(...rightBoxes.map(o=>getBounds(o).maxX)):null;
  return {
    leftInner:Number.isFinite(leftOuter)?leftOuter-m(Number(cfg.sideClearance)||0):null,
    rightInner:Number.isFinite(rightOuter)?rightOuter+m(Number(cfg.sideClearance)||0):null,
    minY,maxY,minZ,maxZ,
    frontZ:maxZ
  };
}
function drawerFindSidePanel(cfg,side){
  const root=getSpaceRoot(cfg.targetRootId);
  if(!root)return null;
  const cell=getSpaceCell(root.id,cfg.targetCellId);
  const ref=drawerReferenceGeometry(cfg);

  // Primeira referência: a geometria REAL da caixa da gaveta.
  // Fallback: limites do espaço antigo.
  const target=side==='left'
    ? (Number.isFinite(ref?.leftInner)?ref.leftInner:cell?.minX)
    : (Number.isFinite(ref?.rightInner)?ref.rightInner:cell?.maxX);
  if(!Number.isFinite(target))return null;

  const y0=Number.isFinite(ref?.minY)?ref.minY:(cell?.minY??-Infinity);
  const y1=Number.isFinite(ref?.maxY)?ref.maxY:(cell?.maxY??Infinity);
  const z0=Number.isFinite(ref?.minZ)?ref.minZ:(cell?.minZ??-Infinity);
  const z1=Number.isFinite(ref?.maxZ)?ref.maxZ:(cell?.maxZ??Infinity);

  let best=null;
  for(const o of objects){
    const u=o.userData;
    if(u?.drawerSetId||u?.kind==='hardware-visual'||u?.kind==='cylinder'||u?.kind==='space-cell')continue;

    // Aceita peças explicitamente ligadas ao móvel OU peças geometricamente
    // dentro do mesmo móvel. Isso cobre projetos antigos/importados.
    const sameRoot=u?.spaceRootId===root.id || rootForObject(o)?.id===root.id;
    if(!sameRoot)continue;

    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!=='x')continue;

    const b=getBounds(o);
    const innerFace=side==='left'?b.maxX:b.minX;
    const gap=Math.abs(innerFace-target);

    // Busca até 80 mm e escolhe SEMPRE a peça mais próxima da face prevista.
    // Isso é só fallback de exportação; a pontuação de sobreposição impede
    // escolher uma lateral distante de outro nicho.
    if(gap>.08)continue;

    const oy=Math.max(0,Math.min(b.maxY,y1)-Math.max(b.minY,y0));
    const oz=Math.max(0,Math.min(b.maxZ,z1)-Math.max(b.minZ,z0));
    if(oy<.02||oz<.08)continue;

    // Precisa estar do lado correto da gaveta.
    if(side==='left'&&innerFace>target+.03)continue;
    if(side==='right'&&innerFace<target-.03)continue;

    const overlapBonus=Math.min(.5,oy)*.02+Math.min(.7,oz)*.02;
    const thicknessPenalty=Math.abs(ti.thickness-18)*.00015;
    const score=gap+thicknessPenalty-overlapBonus;
    if(!best||score<best.score)best={o,score,gap,oy,oz};
  }
  return best?.o||null;
}
function drawerRemoveMachining(setId){
  let n=0;
  for(const o of objects){
    const arr=o.userData?.machining;if(!Array.isArray(arr)||!arr.length)continue;
    const next=arr.filter(op=>op.drawerSetId!==setId);n+=arr.length-next.length;o.userData.machining=next;
  }
  return n;
}

// 1.100.5:
// Ao REFAZER somente a furação das corrediças no gabinete, não podemos usar
// drawerRemoveMachining(), pois os rasgos do fundo também possuem drawerSetId.
// Esta função remove exclusivamente os furos automáticos da corrediça.
function drawerRemoveCabinetDrilling(setId){
  let n=0;
  for(const o of objects){
    const arr=o.userData?.machining;
    if(!Array.isArray(arr)||!arr.length)continue;

    const next=arr.filter(op=>{
      if(op?.drawerSetId!==setId)return true;
      const isAutoSlideDrill =
        op?.drawerAutoDrilling===true ||
        !!op?.drawerSlideType ||
        String(op?.hardwarePresetId||'').startsWith('drawer-');
      return !isAutoSlideDrill;
    });

    n+=arr.length-next.length;
    o.userData.machining=next;
  }
  return n;
}
function removeDrawerSet(setId,{commit=false,keepSelection=false}={}){
  if(!setId)return 0;
  const doomed=objects.filter(o=>o.userData?.drawerSetId===setId);
  removeHardwareLinkedToObjects(doomed);
  drawerRemoveMachining(setId);
  for(const o of doomed){const i=objects.indexOf(o);if(i>=0)objects.splice(i,1);disposeObject(o);}
  if(selected&&doomed.includes(selected)&&!keepSelection)selectObject(null);
  renderMachiningVisuals();if(commit)commitHistory();return doomed.length;
}
function drawerCreatePiece(opts,cfg,role,index,kind='panel',exclude=false){
  const o=createBox({...opts,kind,materialType:kind==='hardware-visual'?'Ferragem':'MDF',baseColor:kind==='hardware-visual'?0x60656b:COLORS.panel,spaceRootId:cfg.targetRootId,drawerSetId:cfg.id,drawerRole:role,drawerIndex:index,drawerConfig:cfg,excludeFromCutList:exclude},false);
  return o;
}
function drawerAddBottomGroove(owner,cfg,index,role){
  if(!cfg.machineBottom||!owner)return 0;
  const ti=pieceThicknessInfo(owner);if(!ti)return 0;
  const width=Math.min(ti.faceH,Math.max(.1,Number(cfg.bottomThickness)+Number(cfg.bottomGrooveClearance||0)));
  const depth=Math.min(ti.thickness,Math.max(.1,Number(cfg.bottomGrooveDepth)||.1));
  const y=Math.max(0,Number(cfg.bottomOffset)||0);
  let lengthAxis=null,entryAxis=null;
  if(role==='side-left'){lengthAxis='z';entryAxis='-x';}
  else if(role==='side-right'){lengthAxis='z';entryAxis='+x';}
  else if(role==='box-front'){lengthAxis='x';entryAxis='+z';}
  else if(role==='box-back'){lengthAxis='x';entryAxis='-z';}
  else return 0;
  if(![ti.uAxis,ti.vAxis].includes(lengthAxis))return 0;
  const op={
    id:uid('mach'),type:'groove',entryAxis,coordRef:{x:0,y,z:0},x:0,y:0,z:0,
    through:false,fullLength:true,autoLength:true,lengthAxis,length:ti.dims[lengthAxis],
    width,depth,preset:'drawer-bottom-groove',drawerSetId:cfg.id,drawerIndex:index,
    drawerMachiningRole:'bottom-groove'
  };
  op.coordRef[lengthAxis]=0;
  Object.assign(op,resolvedMachiningCoords(owner,op));
  (owner.userData.machining||(owner.userData.machining=[])).push(op);
  sanitizeMachiningForPiece(owner);
  return 1;
}
function drawerRemoveBottomGrooves(setId){
  let n=0;
  for(const o of drawerSetObjects(setId)){
    const arr=o.userData?.machining;
    if(!Array.isArray(arr)||!arr.length)continue;
    const next=arr.filter(op=>!(op?.drawerSetId===setId&&op?.preset==='drawer-bottom-groove'));
    n+=arr.length-next.length;
    o.userData.machining=next;
  }
  return n;
}
function drawerExpectedBottomGrooves(cfg){
  if(!cfg?.machineBottom)return 0;
  const count=Math.max(1,Number(cfg.count)||1);
  let perDrawer=0;
  if(cfg.grooveLeft!==false)perDrawer++;
  if(cfg.grooveRight!==false)perDrawer++;
  if(cfg.grooveFront===true&&!(Number(cfg.bottomCutFront)||0))perDrawer++;
  if(cfg.grooveBack===true&&!(Number(cfg.bottomCutBack)||0))perDrawer++;
  return count*perDrawer;
}
function drawerBottomGrooveCount(setId){
  let n=0;
  for(const o of drawerSetObjects(setId)){
    for(const op of (o.userData?.machining||[])){
      if(op?.drawerSetId===setId&&op?.preset==='drawer-bottom-groove')n++;
    }
  }
  return n;
}
function drawerEnsureBottomGroovesForSet(setId){
  const cfg=drawerConfigFromSet(setId);
  if(!cfg?.machineBottom)return {setId,enabled:false,expected:0,created:0,before:drawerBottomGrooveCount(setId)};

  // Normaliza dados de versões anteriores.
  cfg.bottomThickness=Number(cfg.bottomThickness)||6;
  cfg.bottomGrooveClearance=Number.isFinite(Number(cfg.bottomGrooveClearance))?Number(cfg.bottomGrooveClearance):.5;
  cfg.bottomGrooveDepth=Number.isFinite(Number(cfg.bottomGrooveDepth))?Number(cfg.bottomGrooveDepth):6;
  cfg.bottomOffset=Number(cfg.bottomOffset)||0;
  if(typeof cfg.grooveLeft!=='boolean')cfg.grooveLeft=true;
  if(typeof cfg.grooveRight!=='boolean')cfg.grooveRight=true;
  if(typeof cfg.grooveFront!=='boolean')cfg.grooveFront=false;
  if(typeof cfg.grooveBack!=='boolean')cfg.grooveBack=false;

  const bottomTop=Math.max(0,cfg.bottomOffset+cfg.bottomThickness);
  cfg.bottomCutFront=Number(cfg.bottomPassFront||0)>.001?bottomTop:0;
  cfg.bottomCutBack=Number(cfg.bottomPassBack||0)>.001?bottomTop:0;

  const before=drawerBottomGrooveCount(setId);
  drawerRemoveBottomGrooves(setId);

  let created=0;
  for(const o of drawerSetObjects(setId)){
    const role=o.userData?.drawerRole;
    const idx=Number(o.userData?.drawerIndex)||0;

    if(role==='side-left'&&cfg.grooveLeft){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }else if(role==='side-right'&&cfg.grooveRight){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }else if(role==='box-front'&&cfg.grooveFront&&!(cfg.bottomCutFront>0)){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }else if(role==='box-back'&&cfg.grooveBack&&!(cfg.bottomCutBack>0)){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }

    // Mantém a configuração atualizada em todas as peças do conjunto.
    o.userData.drawerConfig=JSON.parse(JSON.stringify(cfg));
  }

  const expected=drawerExpectedBottomGrooves(cfg);
  return {setId,enabled:true,expected,created,before};
}
function repairDrawerBottomGroovesForRoot(root){
  if(!root)return {sets:0,expected:0,created:0,repaired:0};
  const ids=new Set();
  for(const o of objects){
    const u=o.userData;
    if(u?.spaceRootId===root.id&&u?.drawerSetId&&u?.drawerConfig?.machineBottom)ids.add(u.drawerSetId);
  }

  let expected=0,created=0,repaired=0;
  for(const id of ids){
    const r=drawerEnsureBottomGroovesForSet(id);
    expected+=r.expected;
    created+=r.created;
    if(r.before!==r.created)repaired++;
  }
  return {sets:ids.size,expected,created,repaired};
}
function repairAllDrawerBottomGrooves(){
  let sets=0,expected=0,created=0,repaired=0;
  for(const root of spaceRoots){
    const r=repairDrawerBottomGroovesForRoot(root);
    sets+=r.sets;expected+=r.expected;created+=r.created;repaired+=r.repaired;
  }
  if(sets)renderMachiningVisuals();
  return {sets,expected,created,repaired};
}

function drawerAddCabinetDrilling(cfg,levels){
  if(!cfg.createDrilling)return {holes:0,left:false,right:false};
  const root=getSpaceRoot(cfg.targetRootId);if(!root)return {holes:0,left:false,right:false};
  const cell=getSpaceCell(root.id,cfg.targetCellId);
  const ref=drawerReferenceGeometry(cfg);
  const p=drawerPreset(cfg.slideType),left=drawerFindSidePanel(cfg,'left'),right=drawerFindSidePanel(cfg,'right');
  let holes=0;

  // A referência longitudinal é a FRENTE DO ARMÁRIO.
  const cabinetFrontZ=cell?mm(cell.maxZ):(Number.isFinite(ref?.frontZ)?mm(ref.frontZ)+Number(cfg.frontInset||0):0);
  const d=drawerDrillDefaults(p);
  const drillMountY=Number.isFinite(Number(cfg.drillMountY))?Number(cfg.drillMountY):d.mountY;
  const drillDiameter=Number.isFinite(Number(cfg.drillDiameter))?Number(cfg.drillDiameter):d.diameter;
  const drillDepth=Number.isFinite(Number(cfg.drillDepth))?Number(cfg.drillDepth):d.depth;
  const drillPositions=drawerAbsoluteDrillPositions(cfg,p);

  // Níveis reais das laterais de gaveta têm prioridade.
  const actualLevels=drawerLevelsFromSet(cfg);
  const useLevels=actualLevels.length?actualLevels:levels;

  for(const [side,owner] of [['left',left],['right',right]]){
    if(!owner)continue;
    const entry=side==='left'?'+x':'-x';
    const ob=objectBoundsMm(owner);
    const x=side==='left'?ob.maxX:ob.minX;

    useLevels.forEach((baseM,idx)=>{
      const y=mm(baseM)+Math.min(Number(cfg.boxHeight||120)-5,drillMountY);
      for(const pos of drillPositions){
        const world={x,y,z:cabinetFrontZ-pos};

        // 2 mm de tolerância tangencial: suficiente para diferenças de
        // arredondamento, sem jogar furo para fora da peça.
        if(!pointWithinPieceTangents(owner,world,'x',2.0))continue;

        const op=hardwareHoleOp(
          owner,world,entry,
          {diameter:drillDiameter,depth:drillDepth},
          {presetId:`drawer-${p.id}`,name:`Corrediça ${p.name}`,role:'contact',contactName:`Gaveta ${idx+1}`},
          cfg.id
        );
        op.drawerSetId=cfg.id;
        op.drawerIndex=idx;
        op.drawerSlideType=p.id;
        op.drawerAutoDrilling=true;
        op.exportAspireFaceHole=true;
        (owner.userData.machining||(owner.userData.machining=[])).push(op);
        holes++;
      }
    });

    sanitizeMachiningForPiece(owner);
  }
  return {holes,left:!!left,right:!!right};
}
function createDrawerSetFromConfig(input,{doHistory=true}={}){
  const cfg=JSON.parse(JSON.stringify(input||{}));
  // Compatibilidade com conjuntos criados na v86: mantém o conjunto antigo
  // funcionando até o usuário abrir "Editar gavetas / corrediças".
  if(!Number.isFinite(Number(cfg.bottomOffset)))cfg.bottomOffset=0;
  if(!Number.isFinite(Number(cfg.bottomPassLeft)))cfg.bottomPassLeft=0;
  if(!Number.isFinite(Number(cfg.bottomPassRight)))cfg.bottomPassRight=0;
  if(!Number.isFinite(Number(cfg.bottomPassFront)))cfg.bottomPassFront=0;
  if(!Number.isFinite(Number(cfg.bottomPassBack)))cfg.bottomPassBack=0;
  if(typeof cfg.machineBottom!=='boolean')cfg.machineBottom=false;
  if(!Number.isFinite(Number(cfg.bottomGrooveClearance)))cfg.bottomGrooveClearance=.5;
  if(!Number.isFinite(Number(cfg.bottomGrooveDepth)))cfg.bottomGrooveDepth=6;
  if(typeof cfg.grooveLeft!=='boolean')cfg.grooveLeft=true;
  if(typeof cfg.grooveRight!=='boolean')cfg.grooveRight=true;
  if(typeof cfg.grooveFront!=='boolean')cfg.grooveFront=false;
  if(typeof cfg.grooveBack!=='boolean')cfg.grooveBack=false;
  if(typeof cfg.createFronts!=='boolean')cfg.createFronts=false;
  if(!Number.isFinite(Number(cfg.frontThickness)))cfg.frontThickness=18;
  if(!Number.isFinite(Number(cfg.frontGapLeft)))cfg.frontGapLeft=2;
  if(!Number.isFinite(Number(cfg.frontGapRight)))cfg.frontGapRight=2;
  if(!Number.isFinite(Number(cfg.frontGapTop)))cfg.frontGapTop=2;
  if(!Number.isFinite(Number(cfg.frontGapBottom)))cfg.frontGapBottom=2;
  if(!Number.isFinite(Number(cfg.frontGapBetween)))cfg.frontGapBetween=2;
  const root=getSpaceRoot(cfg.targetRootId),cell=root&&getSpaceCell(root.id,cfg.targetCellId);
  if(!root||!cell)throw new Error('A divisão original das gavetas não existe mais');
  const preset=drawerPreset(cfg.slideType),s=cellSize(cell);
  {
    const d=drawerDrillDefaults(preset);
    if(!Number.isFinite(Number(cfg.drillFrontRef)))cfg.drillFrontRef=d.frontRef;
    cfg.drillOffsets=drawerParseDrillOffsets(cfg.drillOffsets?.length?cfg.drillOffsets:d.offsets);
    if(!cfg.drillOffsets.length)cfg.drillOffsets=d.offsets;
    if(typeof cfg.drillAutoByLength!=='boolean')cfg.drillAutoByLength=!!preset.drillByLength;
    if(!Number.isFinite(Number(cfg.drillMountY)))cfg.drillMountY=d.mountY;
    if(!Number.isFinite(Number(cfg.drillDiameter)))cfg.drillDiameter=d.diameter;
    if(!Number.isFinite(Number(cfg.drillDepth)))cfg.drillDepth=d.depth;
  }
  // Recalcula ao criar/editar e também quando o móvel muda de tamanho.
  cfg.openingW=mm(s.width);cfg.openingH=mm(s.height);cfg.openingD=mm(s.depth);
  const rr=drawerResolvedLengthMm(cell,preset,cfg.lengthMode,cfg.frontInset,cfg.rearClearance);
  cfg.resolvedLength=rr.length;cfg.availableDepth=rr.available;
  if(cfg.resolvedLength<=0||cfg.resolvedLength>cfg.availableDepth+.001)throw new Error('A corrediça escolhida não cabe mais nesta profundidade');
  cfg.outerW=cfg.openingW-cfg.sideClearance*2;cfg.innerW=cfg.outerW-cfg.boxThickness*2;
  if(cfg.outerW<=cfg.boxThickness*2+10)throw new Error('A caixa não cabe na largura disponível');
  const span=cfg.openingH-2*cfg.edgeGap-cfg.boxHeight;
  if(!cfg.createFronts&&span<-.001)throw new Error('A altura da caixa não cabe no vão');
  const step=!cfg.createFronts&&cfg.count>1?span/(cfg.count-1):0;
  if(!cfg.createFronts&&cfg.count>1&&step<1)throw new Error('As gavetas não cabem na altura informada');
  if(cfg.createFronts){
    const availableFrontH=cfg.openingH-cfg.frontGapTop-cfg.frontGapBottom-cfg.frontGapBetween*(cfg.count-1);
    cfg.frontH=availableFrontH/cfg.count;
    cfg.frontW=cfg.openingW-cfg.frontGapLeft-cfg.frontGapRight;
    if(cfg.frontH<=10||cfg.frontW<=10)throw new Error('As folgas das frentes não cabem no vão');
    if(cfg.boxHeight>cfg.frontH+.001)throw new Error('A caixa é mais alta que a frente calculada');
  }
  cfg.bottomW=cfg.innerW+cfg.bottomPassLeft+cfg.bottomPassRight;
  cfg.bottomD=Math.max(1,cfg.resolvedLength-cfg.boxThickness*2)+cfg.bottomPassFront+cfg.bottomPassBack;

  // Recalcula sempre, inclusive em projetos antigos e após redimensionar o móvel.
  const bottomTopMm=Math.max(0,Number(cfg.bottomOffset||0)+Number(cfg.bottomThickness||0));
  cfg.bottomCutFront=Number(cfg.bottomPassFront||0)>.001?bottomTopMm:0;
  cfg.bottomCutBack=Number(cfg.bottomPassBack||0)>.001?bottomTopMm:0;
  if(cfg.bottomCutFront>=cfg.boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra frente');
  if(cfg.bottomCutBack>=cfg.boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra fundo');

  cfg.slideName=preset.name;cfg.name=`${cfg.count} gaveta${cfg.count>1?'s':''} · ${preset.name}`;
  const t=m(cfg.boxThickness),bt=m(cfg.bottomThickness),outerW=m(cfg.outerW),innerW=m(cfg.innerW),len=m(cfg.resolvedLength),sideH=m(cfg.boxHeight);
  const frontZ=cell.maxZ-m(cfg.frontInset),backZ=frontZ-len,zCenter=(frontZ+backZ)/2;
  const leftX=cell.minX+m(cfg.sideClearance)+t/2,rightX=cell.maxX-m(cfg.sideClearance)-t/2;
  const levels=[];
  historyMuted=true;
  try{
    for(let i=0;i<cfg.count;i++){
      let frontYBase=null;
      if(cfg.createFronts)frontYBase=cell.minY+m(cfg.frontGapBottom+i*(cfg.frontH+cfg.frontGapBetween));
      const yBase=cfg.createFronts
        ? frontYBase+m((cfg.frontH-cfg.boxHeight)/2)
        : cell.minY+m(cfg.edgeGap+(cfg.count>1?step*i:span/2));
      levels.push(yBase);
      const sideLeft=drawerCreatePiece({width:t,depth:len,height:sideH,x:leftX,yBase,z:zCenter,name:`G${i+1} · Lateral esquerda`},cfg,'side-left',i);
      const sideRight=drawerCreatePiece({width:t,depth:len,height:sideH,x:rightX,yBase,z:zCenter,name:`G${i+1} · Lateral direita`},cfg,'side-right',i);

      // Se o fundo passa para frente/atrás, a contra frente / contra fundo
      // é encurtada por baixo até o topo do fundo.
      const frontCut=m(cfg.bottomCutFront||0),backCut=m(cfg.bottomCutBack||0);
      const frontH=Math.max(m(.001),sideH-frontCut);
      const backH=Math.max(m(.001),sideH-backCut);

      const boxFront=drawerCreatePiece({
        width:innerW,depth:t,height:frontH,
        x:(leftX+rightX)/2,
        yBase:yBase+frontCut,
        z:frontZ-t/2,
        name:`G${i+1} · Contra frente${frontCut>0?` · corte ${nice(cfg.bottomCutFront)} mm`:''}`
      },cfg,'box-front',i);

      const boxBack=drawerCreatePiece({
        width:innerW,depth:t,height:backH,
        x:(leftX+rightX)/2,
        yBase:yBase+backCut,
        z:backZ+t/2,
        name:`G${i+1} · Contra fundo${backCut>0?` · corte ${nice(cfg.bottomCutBack)} mm`:''}`
      },cfg,'box-back',i);

      if(cfg.machineBottom){
        if(cfg.grooveLeft)drawerAddBottomGroove(sideLeft,cfg,i,'side-left');
        if(cfg.grooveRight)drawerAddBottomGroove(sideRight,cfg,i,'side-right');

        // Contra frente/fundo só recebem rasgo se o usuário marcou.
        // Se houver recorte inferior porque o fundo passa pela peça, o
        // recorte prevalece e o rasgo é ignorado.
        if(cfg.grooveFront&&!(cfg.bottomCutFront>0))drawerAddBottomGroove(boxFront,cfg,i,'box-front');
        if(cfg.grooveBack&&!(cfg.bottomCutBack>0))drawerAddBottomGroove(boxBack,cfg,i,'box-back');
      }
      const bottomBaseDepth=Math.max(m(.001),len-2*t);
      const bottomW=m(cfg.innerW+cfg.bottomPassLeft+cfg.bottomPassRight);
      const bottomDepth=Math.max(m(.001),bottomBaseDepth+m(cfg.bottomPassFront+cfg.bottomPassBack));
      const bottomX=(leftX+rightX)/2+m((cfg.bottomPassRight-cfg.bottomPassLeft)/2);
      const bottomZ=zCenter+m((cfg.bottomPassFront-cfg.bottomPassBack)/2);
      const bottomY=yBase+m(cfg.bottomOffset);
      drawerCreatePiece({width:bottomW,depth:bottomDepth,height:bt,x:bottomX,yBase:bottomY,z:bottomZ,name:`G${i+1} · Fundo ${nice(cfg.bottomThickness)} mm`},cfg,'bottom',i);

      if(cfg.createFronts){
        const fw=m(cfg.frontW),fh=m(cfg.frontH),ft=m(cfg.frontThickness);
        const fx=cell.minX+m(cfg.frontGapLeft)+fw/2;
        const fz=cell.maxZ+ft/2;
        const front=drawerCreatePiece({width:fw,depth:ft,height:fh,x:fx,yBase:frontYBase,z:fz,name:`G${i+1} · Frente externa`},cfg,'drawer-front',i);
        if(root.doorsHidden){front.visible=false;front.userData.hiddenByDoors=true;}
      }

      if(cfg.createSlides){
        const isUnder=cfg.slideType==='undermount';

        // Corrediça oculta: o trilho fica embaixo da caixa e não dentro da
        // folga lateral. Por isso sua largura visual não deve ser limitada
        // aos 21 mm de folga. A referência técnica UM A25 usa ~39 mm na
        // seção inferior; o comprimento físico ocupa NL + 18 mm.
        const railWidthMm=isUnder
          ? Number(preset.railWidth||39)
          : Math.max(2,Math.min(Number(preset.railWidth||10),cfg.sideClearance));
        const railDepthMm=isUnder
          ? Number(cfg.resolvedLength||0)+Number(preset.railExtraLength||0)
          : Number(cfg.resolvedLength||0);

        const rw=m(railWidthMm),rh=m(preset.railHeight),railDepth=m(railDepthMm);
        const railY=isUnder?yBase:yBase+Math.max(0,(sideH-rh)/2);

        const lx=isUnder
          ? cell.minX+rw/2
          : cell.minX+m(cfg.sideClearance/2);
        const rx=isUnder
          ? cell.maxX-rw/2
          : cell.maxX-m(cfg.sideClearance/2);

        const railFrontZ=cfg.slideType==='telescopic'
          ? cell.maxZ-m(Number(preset.railFrontInset||0))
          : cell.maxZ-m(Number(preset.railFrontInset||0));
        const railZ=railFrontZ-railDepth/2;

        drawerCreatePiece({
          width:rw,depth:railDepth,height:rh,x:lx,yBase:railY,z:railZ,
          name:`G${i+1} · Corrediça esquerda ${cfg.resolvedLength}`
        },cfg,'slide-left',i,'hardware-visual',true);

        drawerCreatePiece({
          width:rw,depth:railDepth,height:rh,x:rx,yBase:railY,z:railZ,
          name:`G${i+1} · Corrediça direita ${cfg.resolvedLength}`
        },cfg,'slide-right',i,'hardware-visual',true);
      }
    }
    const drill=drawerAddCabinetDrilling(cfg,levels);
    for(const o of drawerSetObjects(cfg.id))o.userData.drawerConfig=JSON.parse(JSON.stringify(cfg));

    // Garantia final: se "Usinar encaixe do fundo" estiver ligado, as
    // laterais precisam sair daqui já com os rasgos.
    const bottomGrooves=drawerEnsureBottomGroovesForSet(cfg.id);

    sanitizeDrawerSet(cfg.id);
    renderMachiningVisuals();updateInspector();
    historyMuted=false;if(doHistory)commitHistory();
    return {cfg,drill,levels,bottomGrooves};
  }catch(err){historyMuted=false;removeDrawerSet(cfg.id,{commit:false});throw err;}
}
function sanitizeDrawerSet(setId){
  for(const o of drawerSetObjects(setId)){
    if(o.userData.kind==='hardware-visual'){o.userData.excludeFromCutList=true;continue;}
    sanitizeMachiningForPiece(o);
  }
}
function saveDrawerSystem(){
  // Guarda um snapshot para que uma falha durante a troca nunca deixe o
  // móvel sem as gavetas antigas.
  const before=captureState();
  const editingBefore=drawerEditingSetId;
  const targetRootBefore=drawerTargetRootId;
  const targetCellBefore=drawerTargetCellId;

  try{
    const cfg=drawerReadConfig();

    // Em edição, preserva o mesmo ID. Se o diálogo foi aberto pelo espaço,
    // pega automaticamente o set que já pertence ao vão.
    const existingIds=drawerSetIdsForTarget(cfg.targetRootId,cfg.targetCellId);
    const primaryId=editingBefore||existingIds[0]||null;
    if(primaryId)cfg.id=primaryId;

    // REGRA 1.100.3:
    // Um vão possui um único conjunto paramétrico de gavetas. Antes de criar
    // a versão editada, apaga SEMPRE todos os conjuntos antigos desse vão.
    // Isso também limpa duplicatas deixadas por versões anteriores.
    const idsToRemove=new Set(existingIds);
    if(editingBefore)idsToRemove.add(editingBefore);

    let removedObjects=0;
    for(const id of idsToRemove){
      if(!id)continue;
      removedObjects+=removeDrawerSet(id,{commit:false,keepSelection:true});
    }

    // Segurança extra: depois da limpeza, não pode restar nenhum objeto de
    // outro set apontando para o mesmo target.
    const leftovers=drawerSetIdsForTarget(cfg.targetRootId,cfg.targetCellId);
    for(const id of leftovers){
      removedObjects+=removeDrawerSet(id,{commit:false,keepSelection:true});
    }

    const result=createDrawerSetFromConfig(cfg,{doHistory:true});

    // Verificação pós-criação: deve existir exatamente UM set no vão.
    const finalIds=drawerSetIdsForTarget(cfg.targetRootId,cfg.targetCellId);
    if(finalIds.length!==1||finalIds[0]!==cfg.id){
      throw new Error('Falha de consistência ao substituir o conjunto de gavetas');
    }

    $('drawerSystemDialog').style.display='none';
    drawerEditingSetId=null;
    drawerTargetRootId=null;
    drawerTargetCellId=null;

    const d=result.drill;
    const replaced=idsToRemove.size>0||removedObjects>0;
    toast(`${replaced?'Gavetas atualizadas':'Gavetas criadas'} · ${cfg.count} · corrediça ${cfg.resolvedLength} mm · ${d.holes} furo(s) no gabinete`);
  }catch(err){
    // Se qualquer etapa falhar depois da remoção, restaura exatamente o
    // estado anterior. Assim nunca fica conjunto duplicado nem edição pela metade.
    try{
      historyMuted=true;
      applyState(before);
      historyMuted=false;
      drawerEditingSetId=editingBefore;
      drawerTargetRootId=targetRootBefore;
      drawerTargetCellId=targetCellBefore;
    }catch(rollbackErr){
      historyMuted=false;
      console.error('Rollback das gavetas:',rollbackErr);
    }
    toast(err.message||'Não foi possível atualizar as gavetas');
    updateDrawerSystemPreview();
  }
}
function deleteDrawerSystem(){
  if(!drawerEditingSetId)return;
  const cfg=drawerConfigFromSet(drawerEditingSetId);
  if(!window.confirm(`Excluir “${cfg?.name||'conjunto de gavetas'}”?\\n\\nAs furações automáticas deste conjunto também serão removidas.`))return;
  removeDrawerSet(drawerEditingSetId,{commit:true});
  $('drawerSystemDialog').style.display='none';drawerEditingSetId=null;drawerTargetRootId=null;drawerTargetCellId=null;toast('Conjunto removido');
}
function rebuildDrawerSetsForRoot(root){
  if(!root)return;
  const configs=drawerUniqueConfigsForRoot(root.id);if(!configs.length)return;
  for(const cfg of configs){
    if(!getSpaceCell(root.id,cfg.targetCellId))continue;
    removeDrawerSet(cfg.id,{commit:false,keepSelection:true});
    try{createDrawerSetFromConfig(cfg,{doHistory:false});}catch(err){console.warn('Gavetas após redimensionar:',err);}
  }
}

// ---------- Biblioteca de componentes / modelos por pastas ----------
const LIBRARY_KEY='miniCadProV53_library';
const LIBRARY_FOLDERS_KEY='miniCadProV53_libraryFolders';
const LEGACY_LIBRARY_KEY_V30='miniCadProV30_library';
const LEGACY_LIBRARY_KEY_V28='miniCadProV28_library';
const LEGACY_LIBRARY_KEY_V27='miniCadProV27_library';
const LEGACY_LIBRARY_KEY_V26='miniCadProV26_library';
const LEGACY_LIBRARY_KEY_V25='miniCadProV25_library';
const LEGACY_LIBRARY_KEY_V24='miniCadProV24_library';
const LEGACY_LIBRARY_KEY_V23='miniCadProV23_library';
let customLibrary=[];
let libraryFolders=[];
let activeLibraryFolderId=null;
let libraryScope='local';
const globalLibraryState={folders:[],itemsByFolder:new Map(),records:new Map(),loaded:false,loading:false,error:''};

try{ customLibrary=JSON.parse(localStorage.getItem(LIBRARY_KEY)||localStorage.getItem(LEGACY_LIBRARY_KEY_V30)||localStorage.getItem(LEGACY_LIBRARY_KEY_V28)||localStorage.getItem(LEGACY_LIBRARY_KEY_V27)||localStorage.getItem(LEGACY_LIBRARY_KEY_V26)||localStorage.getItem(LEGACY_LIBRARY_KEY_V25)||localStorage.getItem(LEGACY_LIBRARY_KEY_V24)||localStorage.getItem(LEGACY_LIBRARY_KEY_V23)||'[]'); if(!Array.isArray(customLibrary))customLibrary=[]; }catch{customLibrary=[];}
try{ libraryFolders=JSON.parse(localStorage.getItem(LIBRARY_FOLDERS_KEY)||'[]'); if(!Array.isArray(libraryFolders))libraryFolders=[]; }catch{libraryFolders=[];}

function persistLibrary(){
  localStorage.setItem(LIBRARY_KEY,JSON.stringify(customLibrary));
  localStorage.setItem(LIBRARY_FOLDERS_KEY,JSON.stringify(libraryFolders));
}
function libraryFolderById(id){return libraryFolders.find(f=>f.id===id)||null;}
function uniqueLibraryFolderName(name){
  const base=(String(name||'Nova pasta').trim()||'Nova pasta'); let out=base,n=2;
  const exists=v=>libraryFolders.some(f=>String(f.name).toLocaleLowerCase('pt-BR')===String(v).toLocaleLowerCase('pt-BR'));
  while(exists(out))out=`${base} ${n++}`; return out;
}
function createLibraryFolder(name,{quiet=false}={}){
  const folder={id:uid('libfolder'),name:uniqueLibraryFolderName(name)}; libraryFolders.push(folder);persistLibrary();
  if(!quiet)toast(`Pasta “${folder.name}” criada`);return folder;
}
if(customLibrary.some(i=>!i.folderId)){
  let migrated=libraryFolders.find(f=>f.name==='Importados'); if(!migrated)migrated=createLibraryFolder('Importados',{quiet:true});
  for(const i of customLibrary)if(!i.folderId)i.folderId=migrated.id; persistLibrary();
}
function selectedCellInfo(){
  if(!selectedSpaceCell)return null; const root=getSpaceRoot(selectedSpaceCell.rootId),cell=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId); if(!root||!cell)return null;
  return {root,cell,size:cellSize(cell),center:cellCenter(cell)};
}
function createCabinetInCell(info){
  const c=info.cell,s=info.size,t=.018,b=.006; if(s.width<=2*t||s.height<=2*t||s.depth<=b){toast('Espaço pequeno para caixa MDF 18 mm');return;}
  historyMuted=true;
  createBox({width:t,depth:s.depth,height:s.height,x:c.minX+t/2,yBase:c.minY,z:info.center.z,name:'Lateral esquerda',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:t,depth:s.depth,height:s.height,x:c.maxX-t/2,yBase:c.minY,z:info.center.z,name:'Lateral direita',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:s.width-2*t,depth:s.depth,height:t,x:info.center.x,yBase:c.minY,z:info.center.z,name:'Base',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:s.width-2*t,depth:s.depth,height:t,x:info.center.x,yBase:c.maxY-t,z:info.center.z,name:'Topo',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:s.width-2*t,depth:b,height:s.height-2*t,x:info.center.x,yBase:c.minY+t,z:c.minZ+b/2,name:'Fundo 6 mm',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  historyMuted=false; commitHistory(); toast('Caixa MDF inserida');
}
function mergeIntervals(intervals,tol=.00001){
  const arr=intervals.filter(v=>Number.isFinite(v[0])&&Number.isFinite(v[1])&&v[1]>v[0]).sort((a,b)=>a[0]-b[0]);
  const out=[];
  for(const it of arr){
    if(!out.length || it[0]>out[out.length-1][1]+tol) out.push([it[0],it[1]]);
    else out[out.length-1][1]=Math.max(out[out.length-1][1],it[1]);
  }
  return out;
}
function fixedIntervalsFromSpace(space,axis){
  if(!space)return [];
  const bounds=layoutBoundsFromSpace(space);
  const rootMin=bounds ? (axis==='x'?bounds.minX:axis==='y'?bounds.minY:bounds.minZ) : 0;
  const persistent=(space.fixedBands?.[axis]||[]).map(([a,b])=>[rootMin+Number(a),rootMin+Number(b)]);
  const minKey=axis==='x'?'minX':axis==='y'?'minY':'minZ';
  const maxKey=axis==='x'?'maxX':axis==='y'?'maxY':'maxZ';
  const fromCells=[];
  for(const c of (space.cells||[])){
    if(c.fixedAxes?.[axis]) fromCells.push([Number(c[minKey]),Number(c[maxKey])]);
  }
  return mergeIntervals([...persistent,...fromCells]);
}
function makeFixedAxisMapper(srcMin,srcMax,dstMin,dstMax,fixedIntervals){
  const srcLen=srcMax-srcMin, dstLen=dstMax-dstMin;
  const clipped=mergeIntervals((fixedIntervals||[]).map(([a,b])=>[Math.max(srcMin,a),Math.min(srcMax,b)]).filter(([a,b])=>b>a));
  const fixedTotal=clipped.reduce((n,[a,b])=>n+(b-a),0);
  const flexTotal=Math.max(0,srcLen-fixedTotal);
  if(dstLen+1e-9<fixedTotal) throw new Error(`Destino menor que as medidas fixas (${mm(fixedTotal)} mm)`);
  const flexScale=flexTotal>1e-9 ? (dstLen-fixedTotal)/flexTotal : 1;
  function mappedLength(a,b){
    let fixed=0;
    for(const [f0,f1] of clipped){ const q0=Math.max(a,f0),q1=Math.min(b,f1); if(q1>q0)fixed+=q1-q0; }
    const len=Math.max(0,b-a); return fixed+(len-fixed)*flexScale;
  }
  return value=>{
    const v=Math.min(srcMax,Math.max(srcMin,value));
    return dstMin+mappedLength(srcMin,v);
  };
}
function layoutBoundsFromSpace(space){
  if(!space)return null;
  const minX=Number(space.x)-Number(space.width)/2, maxX=Number(space.x)+Number(space.width)/2;
  const minY=Number(space.yBase), maxY=Number(space.yBase)+Number(space.height);
  const minZ=Number(space.z)-Number(space.depth)/2, maxZ=Number(space.z)+Number(space.depth)/2;
  if(![minX,maxX,minY,maxY,minZ,maxZ].every(Number.isFinite))return null;
  return {minX,maxX,minY,maxY,minZ,maxZ};
}
function libraryCurvedConfigForTarget(p,info){
  const src=p?.customProfile?.cfg||p?.curvedConfig;if(!src)return null;
  const c=JSON.parse(JSON.stringify(src));
  const targetW=mm(info.size.width),targetD=mm(info.size.depth),targetH=mm(info.size.height);
  const srcW=Math.max(1,Number(c.targetW)||targetW),srcD=Math.max(1,Number(c.targetD)||targetD);
  const scaleCurve=Math.min(targetW/srcW,targetD/srcD);
  let radius=(Number(c.radius)||150)*scaleCurve;
  radius=Math.max(20,Math.min(radius,Math.max(20,Math.min(targetW,targetD)-1)));
  c.targetW=targetW;c.targetD=targetD;c.height=targetH;c.radius=radius;
  c.straightA=Math.max(0,targetW-radius);c.straightB=Math.max(0,targetD-radius);
  c.floor=mm(info.cell.minY);c.targetRootId=info.root.id;c.targetCellId=info.cell.id;
  return c;
}
function libraryCurvedPostPlacementForTarget(p,cfg,info){
  const samples=curvedPostSamplesMm(cfg);
  if(!samples.length)return null;
  const stored=p?.curvedConfig||p?.customProfile?.cfg||{};
  const tag=stored.postStructuralTag||null;
  let sample=null;

  // 1.100.95: montantes estruturais não podem ser posicionados usando a caixa
  // retangular da peça rotacionada. Isso deslocava principalmente o último
  // montante mesmo quando a configuração era 0 mm (rente). Recalculamos a
  // posição pela própria trajetória curva e pelas regras estruturais.
  const storedIndex=Number(stored.postSampleIndex);
  if(Number.isInteger(storedIndex)&&storedIndex>=0&&storedIndex<samples.length){
    sample=samples[storedIndex];
  }
  if(!sample&&tag){
    const tagged=samples.filter(s=>s.structuralTag===tag);
    if(tagged.length===1)sample=tagged[0];
    else if(tagged.length>1){
      let ordinal=0;
      const m=String(p?.name||'').match(/(\d+)\s*$/);
      if(m)ordinal=Math.max(0,Number(m[1])-1);
      sample=tagged[Math.min(tagged.length-1,ordinal)]||tagged[0];
    }
  }
  if(!sample){
    // Compatibilidade com modelos antigos: tenta usar o nome dos montantes fixos.
    const name=String(p?.name||'').toLowerCase();
    const wanted=name.includes('final a')?'end-a':name.includes('final b')?'end-b':name.includes('centro')?'curve-mid':name.includes('final recuado')?'curve-end-inset':null;
    if(wanted)sample=samples.find(s=>s.structuralTag===wanted)||null;
  }
  if(!sample)return null;
  const plc=curvedPostPlacementFromSampleMm(cfg,sample);
  return {
    x:info.center.x+(plc.x-cfg.targetW/2)*MM_TO_M,
    z:info.center.z+(plc.z-cfg.targetD/2)*MM_TO_M,
    rotationY:plc.rotationY,
    sample
  };
}
function copyLibraryPartMeta(created,p){
  if(!created||!p)return created;
  const u=created.userData||{};
  if(p.partId)u.partId=p.partId;
  u.materialType=p.materialType||u.materialType;u.baseColor=p.baseColor??u.baseColor;
  u.materialId=p.materialId||null;u.materialCode=p.materialCode||'';u.materialGrain=!!p.materialGrain;u.materialGrainRotation=normalizePieceGrainRotation(p.materialGrainRotation);
  u.materialCoreColor=p.materialCoreColor||null;u.edgeBands=normalizePieceEdgeBands(p.edgeBands||u.edgeBands||{});
  u.labelMeta=p.labelMeta?productionClone(p.labelMeta):u.labelMeta;
  u.machining=JSON.parse(JSON.stringify(p.machining||[]));
  u.drawerSetId=p.drawerSetId||null;u.drawerRole=p.drawerRole||null;u.drawerIndex=p.drawerIndex??null;
  u.drawerConfig=p.drawerConfig?JSON.parse(JSON.stringify(p.drawerConfig)):null;
  u.doorConfig=p.doorConfig?JSON.parse(JSON.stringify(p.doorConfig)):null;
  u.excludeFromCutList=!!p.excludeFromCutList;
  u.spaceCutting=!!p.spaceCutting||isSpaceCuttingPieceForHeal(created);
  restoreBaseColor(created);return created;
}
function createLibraryTemplatePart(p,info,{width,depth,height,x,yBase,z}={}){
  if(!p)return null;
  let created=null;
  if(p.kind==='cylinder'){
    created=createCylinder({diameter:Math.min(width,depth),height,x,yBase,z,name:p.name||'Cilindro'},false);
  }else if(p.kind==='curved-panel'&&p.customProfile?.cfg){
    const cfg=libraryCurvedConfigForTarget(p,info);
    created=createCurvedRib({cfg,yBase,x:info.center.x,z:info.center.z,name:p.name||'Nervura curva',spaceRootId:info.root.id,index:1,part:p.customProfile.part||p.curvedPart||'full'},false);
  }else if(p.curvedRole==='cover'&&p.curvedConfig){
    const cfg=libraryCurvedConfigForTarget(p,info);
    created=createCurvedCover({cfg,yBase,x:info.center.x,z:info.center.z,name:p.name||'Capa externa',spaceRootId:info.root.id,part:p.curvedPart||p.curvedConfig.coverPart||'full'},false);
  }else if(p.curvedRole==='post'&&p.curvedConfig){
    const cfg=libraryCurvedConfigForTarget(p,info);
    const structural=libraryCurvedPostPlacementForTarget(p,cfg,info);
    // Montantes fixos (incluindo ponta A/B = 0 mm) são recalculados pela
    // geometria do móvel. Somente modelos muito antigos sem identificação
    // estrutural usam a posição antiga como fallback.
    created=createCurvedPost({cfg,yBase,x:structural?.x??x,z:structural?.z??z,name:p.name||'Montante curvo',spaceRootId:info.root.id,rotationY:structural?.rotationY??(Number(p.rotationY)||0)},false);
  }else{
    created=createBox({width,depth,height,x,yBase,z,name:p.name||'Peça',kind:p.kind||'box',materialType:p.materialType||'genérico',baseColor:p.baseColor??COLORS.default,spaceRootId:info.root.id,machining:p.machining||[],forms:p.forms||[],doorConfig:p.doorConfig||null,edgeBands:p.edgeBands||{},materialId:p.materialId||null,materialCode:p.materialCode||'',materialGrain:!!p.materialGrain,materialGrainRotation:normalizePieceGrainRotation(p.materialGrainRotation),materialCoreColor:p.materialCoreColor||null,partId:p.partId||null,labelMeta:p.labelMeta||null,rotationY:Number(p.rotationY)||0,curvedRole:p.curvedRole||null,curvedConfig:p.curvedConfig||null,drawerSetId:p.drawerSetId||null,drawerRole:p.drawerRole||null,drawerIndex:p.drawerIndex??null,drawerConfig:p.drawerConfig||null,excludeFromCutList:!!p.excludeFromCutList,spaceCutting:!!p.spaceCutting,spaceCutParentBounds:p.spaceCutParentBounds||null},false);
  }
  return copyLibraryPartMeta(created,p);
}
function placeCustomTemplate(item,info){
  const sb=item.sourceBounds, sw=sb.maxX-sb.minX, sh=sb.maxY-sb.minY, sd=sb.maxZ-sb.minZ; if(sw<=0||sh<=0||sd<=0)return;
  historyMuted=true;
  try{
    const layout=item.layout||null;
    if(layout?.space){
      const lb=layoutBoundsFromSpace(layout.space)||sb;
      const mapX=makeFixedAxisMapper(lb.minX,lb.maxX,info.cell.minX,info.cell.maxX,fixedIntervalsFromSpace(layout.space,'x'));
      const mapY=makeFixedAxisMapper(lb.minY,lb.maxY,info.cell.minY,info.cell.maxY,fixedIntervalsFromSpace(layout.space,'y'));
      const mapZ=makeFixedAxisMapper(lb.minZ,lb.maxZ,info.cell.minZ,info.cell.maxZ,fixedIntervalsFromSpace(layout.space,'z'));
      for(const p of item.parts){
        const pMinX=p.x-p.width/2,pMaxX=p.x+p.width/2,pMinY=p.yBase,pMaxY=p.yBase+p.height,pMinZ=p.z-p.depth/2,pMaxZ=p.z+p.depth/2;
        const nx0=mapX(pMinX),nx1=mapX(pMaxX),ny0=mapY(pMinY),ny1=mapY(pMaxY),nz0=mapZ(pMinZ),nz1=mapZ(pMaxZ);
        const width=Math.max(.001,nx1-nx0),height=Math.max(.001,ny1-ny0),depth=Math.max(.001,nz1-nz0);
        const x=(nx0+nx1)/2,yBase=ny0,z=(nz0+nz1)/2;
        createLibraryTemplatePart(p,info,{width,depth,height,x,yBase,z});
      }
      toast('Componente ajustado · medidas fixas preservadas');
    } else {
      const sx=info.size.width/sw, sy=info.size.height/sh, sz=info.size.depth/sd;
      for(const p of item.parts){
        const x=info.cell.minX+(p.x-sb.minX)*sx, yBase=info.cell.minY+(p.yBase-sb.minY)*sy, z=info.cell.minZ+(p.z-sb.minZ)*sz;
        createLibraryTemplatePart(p,info,{width:p.width*sx,depth:p.depth*sz,height:p.height*sy,x,yBase,z});
      }
      toast('Componente ajustado ao espaço');
    }
  }catch(err){ historyMuted=false; toast(err.message||'Não foi possível ajustar o componente'); return; }
  renderMachiningVisuals(); historyMuted=false; commitHistory();
}
function placeLibraryItem(id){
  const info=selectedCellInfo(); if(!info){toast('Selecione um espaço');return;}
  $('libraryDialog').style.display='none';
  if(id==='fill') createBox({width:info.size.width,depth:info.size.depth,height:info.size.height,x:info.center.x,yBase:info.cell.minY,z:info.center.z,name:'Preenchimento',kind:'box',baseColor:COLORS.default});
  else if(id==='cabinet18') createCabinetInCell(info);
  else if(id==='shelf18'){
    const t=Math.min(.018,info.size.height); createBox({width:info.size.width,depth:info.size.depth,height:t,x:info.center.x,yBase:info.center.y-t/2,z:info.center.z,name:'Prateleira 18 mm',kind:'panel',materialType:'MDF',baseColor:COLORS.panel});
  } else { const item=customLibrary.find(i=>i.id===id); if(item)placeCustomTemplate(item,info); }
}
function builtinLibraryItems(){return [
  {id:'cabinet18',name:'Caixa MDF 18 mm',info:'Laterais + topo + base + fundo 6 mm, ajustados ao espaço.'},
  {id:'shelf18',name:'Prateleira 18 mm',info:'Cria uma prateleira no centro do espaço.'},
  {id:'fill',name:'Preencher volume',info:'Bloco único ocupando exatamente todo o espaço.'}
];}

function globalLibraryFolderById(id){return globalLibraryState.folders.find(f=>f.id===id)||null;}
function setLibraryScope(scope){
  libraryScope=scope==='global'?'global':'local';
  activeLibraryFolderId=null;
  const localBtn=$('libraryLocalTab'),globalBtn=$('libraryGlobalTab');
  localBtn?.classList.toggle('active',libraryScope==='local');
  localBtn?.classList.toggle('secondary',libraryScope!=='local');
  globalBtn?.classList.toggle('active',libraryScope==='global');
  globalBtn?.classList.toggle('secondary',libraryScope!=='global');
  if(libraryScope==='global'&&!globalLibraryState.loaded&&!globalLibraryState.loading)loadGlobalLibraryFolders();
  renderLibrary();
}
async function loadGlobalLibraryFolders({force=false}={}){
  if(globalLibraryState.loading)return;
  if(globalLibraryState.loaded&&!force)return;
  if(!cloudAccountState.ok){
    globalLibraryState.error='Entre na sua conta para acessar a Biblioteca global.';
    globalLibraryState.loaded=false;renderLibrary();return;
  }
  globalLibraryState.loading=true;globalLibraryState.error='';renderLibrary();
  try{
    const data=await cloudApiFetch('/library/global/folders',{timeoutMs:20000});
    globalLibraryState.folders=Array.isArray(data?.folders)?data.folders:[];
    globalLibraryState.loaded=true;
  }catch(err){
    globalLibraryState.error=err.message||'Não foi possível carregar a Biblioteca global.';
    globalLibraryState.loaded=false;
  }finally{
    globalLibraryState.loading=false;renderLibrary();
  }
}
async function loadGlobalLibraryItems(folderId,{force=false}={}){
  if(!folderId)return;
  if(globalLibraryState.itemsByFolder.has(folderId)&&!force)return;
  const data=await cloudApiFetch(`/library/global/folders/${encodeURIComponent(folderId)}/items`,{timeoutMs:20000});
  globalLibraryState.itemsByFolder.set(folderId,Array.isArray(data?.items)?data.items:[]);
}
function globalTemplateFromFurniture(record,meta={}){
  const parts=Array.isArray(record?.objects)?record.objects:[];
  if(!parts.length)throw new Error('Modelo global sem peças');
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const p of parts){
    const w=Number(p.width),d=Number(p.depth),h=Number(p.height),x=Number(p.x),yb=Number(p.yBase),z=Number(p.z);
    if(![w,d,h,x,yb,z].every(Number.isFinite))continue;
    minX=Math.min(minX,x-w/2);maxX=Math.max(maxX,x+w/2);minY=Math.min(minY,yb);maxY=Math.max(maxY,yb+h);minZ=Math.min(minZ,z-d/2);maxZ=Math.max(maxZ,z+d/2);
  }
  if(!Number.isFinite(minX))throw new Error('Medidas do modelo global inválidas');
  const sourceSpace=Array.isArray(record?.spaces)&&record.spaces.length?JSON.parse(JSON.stringify(record.spaces[0])):null;
  const item={id:meta.id||uid('global'),name:meta.name||record.name||'Modelo global',sourceBounds:{minX,maxX,minY,maxY,minZ,maxZ},parts:JSON.parse(JSON.stringify(parts))};
  if(sourceSpace)item.layout={space:sourceSpace};
  return item;
}
async function placeGlobalLibraryItem(id){
  const info=selectedCellInfo();if(!info){toast('Selecione um espaço');return;}
  try{
    let payload=globalLibraryState.records.get(id);
    if(!payload){
      payload=await cloudApiFetch(`/library/global/items/${encodeURIComponent(id)}`,{timeoutMs:30000});
      globalLibraryState.records.set(id,payload);
    }
    const item=globalTemplateFromFurniture(payload?.record,{id,name:payload?.item?.name});
    $('libraryDialog').style.display='none';
    placeCustomTemplate(item,info);
  }catch(err){toast(err.message||'Não foi possível abrir o modelo global');}
}
async function createGlobalLibraryFolder(){
  if(!adminAllowed()){toast('Somente o administrador pode criar pastas globais');return;}
  const name=(window.prompt('Nome da pasta global:','Armários')||'').trim();if(!name)return;
  try{
    await cloudApiFetch('/admin/library/folders',{method:'POST',body:{name},timeoutMs:20000});
    globalLibraryState.itemsByFolder.clear();
    await loadGlobalLibraryFolders({force:true});
    toast(`Pasta global “${name}” criada`);
  }catch(err){toast(err.message||'Não foi possível criar a pasta global');}
}
async function deleteGlobalLibraryFolder(){
  if(!adminAllowed()){toast('Somente o administrador pode excluir pastas globais');return;}
  const f=globalLibraryFolderById(activeLibraryFolderId);if(!f)return;
  if(!window.confirm(`Excluir a pasta global “${f.name}” e todos os modelos dentro dela? Isso some para todos os usuários.`))return;
  try{
    await cloudApiFetch(`/admin/library/folders/${encodeURIComponent(f.id)}`,{method:'DELETE',body:{},timeoutMs:30000});
    activeLibraryFolderId=null;globalLibraryState.itemsByFolder.delete(f.id);
    await loadGlobalLibraryFolders({force:true});
    toast('Pasta global excluída');
  }catch(err){toast(err.message||'Não foi possível excluir a pasta global');}
}
async function publishCurrentFurnitureGlobal(){
  if(!adminAllowed()){toast('Somente o administrador pode publicar modelos globais');return;}
  const folder=globalLibraryFolderById(activeLibraryFolderId);if(!folder){toast('Abra uma pasta global');return;}
  const root=selectedFurnitureRoot();if(!root){toast('Selecione um móvel');return;}
  const name=(window.prompt('Nome do modelo para todos:',safeFileName(root.name||'movel','movel').replace(/-/g,'_'))||'').trim();if(!name)return;
  try{
    await cloudApiFetch('/admin/library/items',{method:'POST',body:{folder_id:folder.id,name,record:captureFurniture(root)},timeoutMs:30000});
    globalLibraryState.itemsByFolder.delete(folder.id);
    await loadGlobalLibraryItems(folder.id,{force:true});
    await loadGlobalLibraryFolders({force:true});
    renderLibrary();toast(`“${name}” publicado para todos`);
  }catch(err){toast(err.message||'Não foi possível publicar o modelo');}
}
async function deleteGlobalLibraryItem(id){
  if(!adminAllowed()){toast('Somente o administrador pode excluir modelos globais');return;}
  const items=globalLibraryState.itemsByFolder.get(activeLibraryFolderId)||[],item=items.find(i=>i.id===id);
  if(!item)return;
  if(!window.confirm(`Excluir “${item.name}” da Biblioteca global? Ele deixará de aparecer para todos.`))return;
  try{
    await cloudApiFetch(`/admin/library/items/${encodeURIComponent(id)}`,{method:'DELETE',body:{},timeoutMs:20000});
    globalLibraryState.records.delete(id);globalLibraryState.itemsByFolder.delete(activeLibraryFolderId);
    await loadGlobalLibraryItems(activeLibraryFolderId,{force:true});
    await loadGlobalLibraryFolders({force:true});
    renderLibrary();toast('Modelo global excluído');
  }catch(err){toast(err.message||'Não foi possível excluir o modelo global');}
}
function updateLibraryFolderUi(){
  const global=libraryScope==='global',admin=adminAllowed();
  const builtin=!global&&activeLibraryFolderId==='__builtins__';
  const localFolder=!global?libraryFolderById(activeLibraryFolderId):null;
  const globalFolder=global?globalLibraryFolderById(activeLibraryFolderId):null;
  const folder=localFolder||globalFolder;
  const inside=!!folder||builtin;

  $('libraryBackBtn').style.display=inside?'inline-flex':'none';
  $('newLibraryFolderBtn').style.display=(!inside&&(!global||admin))?'inline-flex':'none';
  $('newLibraryFolderBtn').textContent=global?'＋ Nova pasta global':'＋ Nova pasta';
  $('renameLibraryFolderBtn').style.display=localFolder?'inline-flex':'none';
  $('deleteLibraryFolderBtn').style.display=folder&&(!global||admin)?'inline-flex':'none';
  $('deleteLibraryFolderBtn').textContent=global?'Excluir pasta global':'Excluir pasta';
  $('saveFurnitureLibraryBtn').style.display=folder&&(!global||admin)?'inline-flex':'none';
  $('saveFurnitureLibraryBtn').textContent=global?'🌐 Publicar móvel para todos':'Salvar móvel nesta pasta';
  $('importLibraryBtn').style.display=(localFolder||(globalFolder&&admin))?'inline-flex':'none';
  $('importLibraryBtn').textContent=global?'🌐 Importar STL para todos':'Importar STL nesta pasta';
  $('libraryBreadcrumb').textContent=inside?`${global?'Biblioteca global':'Pastas'}  ›  ${builtin?'Padrões':folder.name}`:(global?'Biblioteca global':'Pastas');
  if($('libraryScopeHint'))$('libraryScopeHint').textContent=global
    ?(admin?'Global: você é administrador. Pode criar/apagar pastas e publicar/apagar modelos. Todos os usuários enxergam este conteúdo.':'Global: conteúdo oficial publicado pelo administrador. Você pode inserir e editar uma cópia no seu projeto.')
    :'Pastas pessoais: somente você vê neste dispositivo.';
}
function libraryItemElement(item,{custom=false,global=false}={}){
  const el=document.createElement('div');el.className='libraryItem';
  const txt=document.createElement('div');txt.style.minWidth='0';txt.innerHTML='<div class="libName"></div><div class="libInfo"></div>';
  txt.querySelector('.libName').textContent=`📄 ${item.name}`;
  if(global){
    const badge=document.createElement('span');badge.className='globalLibraryBadge';badge.textContent='GLOBAL';txt.querySelector('.libName').appendChild(badge);
  }
  txt.querySelector('.libInfo').textContent=item.info||'Modelo salvo';
  const actions=document.createElement('div');actions.style.display='flex';actions.style.gap='5px';actions.style.flexShrink='0';
  const ins=document.createElement('button');ins.textContent='Inserir';ins.onclick=()=>global?placeGlobalLibraryItem(item.id):placeLibraryItem(item.id);actions.appendChild(ins);
  if(global&&adminAllowed()){
    const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteGlobalLibraryItem(item.id);actions.appendChild(del);
  }else if(custom){
    const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteLibraryItem(item.id);actions.appendChild(del);
  }
  el.append(txt,actions);return el;
}
function renderLibrary(){
  const info=selectedCellInfo(); if(!info)return;
  $('libraryTarget').textContent=`Destino: ${mm(info.size.width)} × ${mm(info.size.depth)} × ${mm(info.size.height)} mm`;
  updateLibraryFolderUi(); const list=$('libraryList');list.innerHTML='';

  if(libraryScope==='global'){
    if(!cloudAccountState.ok){
      const e=document.createElement('div');e.className='libraryEmpty';e.textContent='Entre na sua conta para acessar os modelos globais.';list.appendChild(e);return;
    }
    if(globalLibraryState.loading){
      const e=document.createElement('div');e.className='libraryEmpty';e.textContent='Carregando Biblioteca global…';list.appendChild(e);return;
    }
    if(globalLibraryState.error){
      const e=document.createElement('div');e.className='libraryEmpty';e.textContent=globalLibraryState.error;list.appendChild(e);return;
    }
    if(!globalLibraryState.loaded){
      const e=document.createElement('div');e.className='libraryEmpty';e.textContent='Carregando Biblioteca global…';list.appendChild(e);
      loadGlobalLibraryFolders();return;
    }
    if(activeLibraryFolderId===null){
      if(!globalLibraryState.folders.length){
        const e=document.createElement('div');e.className='libraryEmpty';e.textContent=adminAllowed()?'Nenhuma pasta global. Use “Nova pasta global” para começar.':'O administrador ainda não publicou pastas globais.';list.appendChild(e);return;
      }
      for(const f of globalLibraryState.folders){
        const el=document.createElement('div');el.className='libraryFolder';
        const t=document.createElement('div');t.innerHTML='<div class="folderName"></div><div class="folderInfo"></div>';
        t.querySelector('.folderName').textContent=`🌐 📁 ${f.name}`;
        t.querySelector('.folderInfo').textContent=`${Number(f.item_count||0)} modelo(s) disponível(is) para todos`;
        const b=document.createElement('button');b.className='secondary';b.textContent='Abrir';
        b.onclick=async()=>{activeLibraryFolderId=f.id;renderLibrary();try{await loadGlobalLibraryItems(f.id);renderLibrary();}catch(err){toast(err.message||'Erro ao abrir pasta global');}};
        el.append(t,b);list.appendChild(el);
      }
      return;
    }
    const folder=globalLibraryFolderById(activeLibraryFolderId);
    if(!folder){activeLibraryFolderId=null;renderLibrary();return;}
    if(!globalLibraryState.itemsByFolder.has(folder.id)){
      const e=document.createElement('div');e.className='libraryEmpty';e.textContent='Carregando modelos…';list.appendChild(e);
      loadGlobalLibraryItems(folder.id).then(renderLibrary).catch(err=>{toast(err.message||'Erro ao carregar modelos');});
      return;
    }
    const items=globalLibraryState.itemsByFolder.get(folder.id)||[];
    if(!items.length){
      const e=document.createElement('div');e.className='libraryEmpty';e.textContent=adminAllowed()?'Pasta vazia. Selecione um móvel e toque em “Publicar móvel para todos”.':'Esta pasta ainda não possui modelos.';list.appendChild(e);return;
    }
    for(const i of items)list.appendChild(libraryItemElement({id:i.id,name:i.name,info:`Modelo oficial · ${Number(i.size_bytes||0)>0?Math.max(1,Math.round(Number(i.size_bytes)/1024))+' KB · ':''}atualizado ${adminDate(i.updated_at)}`},{global:true}));
    return;
  }

  if(activeLibraryFolderId===null){
    const folders=[{id:'__builtins__',name:'Padrões',builtin:true},...libraryFolders];
    if(!folders.length){const e=document.createElement('div');e.className='libraryEmpty';e.textContent='Nenhuma pasta. Toque em “Nova pasta” para começar.';list.appendChild(e);return;}
    for(const f of folders){
      const count=f.builtin?builtinLibraryItems().length:customLibrary.filter(i=>i.folderId===f.id).length;
      const el=document.createElement('div');el.className='libraryFolder';
      const t=document.createElement('div');t.innerHTML='<div class="folderName"></div><div class="folderInfo"></div>';t.querySelector('.folderName').textContent=`📁 ${f.name}`;t.querySelector('.folderInfo').textContent=f.builtin?`${count} modelo(s) do DesignLabMoveis`:`${count} arquivo(s) salvo(s)`;
      const b=document.createElement('button');b.className='secondary';b.textContent='Abrir';b.onclick=()=>{activeLibraryFolderId=f.id;renderLibrary();};el.append(t,b);list.appendChild(el);
    }
    return;
  }
  if(activeLibraryFolderId==='__builtins__'){
    for(const item of builtinLibraryItems())list.appendChild(libraryItemElement(item));return;
  }
  const folder=libraryFolderById(activeLibraryFolderId);if(!folder){activeLibraryFolderId=null;renderLibrary();return;}
  const items=customLibrary.filter(i=>i.folderId===folder.id);
  if(!items.length){const e=document.createElement('div');e.className='libraryEmpty';e.textContent='Pasta vazia. Salve o móvel atual ou importe um arquivo STL para esta pasta.';list.appendChild(e);return;}
  for(const i of items)list.appendChild(libraryItemElement({id:i.id,name:i.name,info:i.layout?.space?'Móvel salvo · preserva cortes fixos':'Modelo salvo · ajusta ao espaço'},{custom:true}));
}
function openLibraryRoot(){activeLibraryFolderId=null;renderLibrary();$('libraryDialog').style.display='flex';}
function newLibraryFolder(){
  if(libraryScope==='global'){createGlobalLibraryFolder();return;}
  const name=(window.prompt('Nome da nova pasta:','Armários')||'').trim();if(!name)return;const f=createLibraryFolder(name);activeLibraryFolderId=f.id;renderLibrary();
}
function renameActiveLibraryFolder(){
  if(libraryScope==='global')return;
  const f=libraryFolderById(activeLibraryFolderId);if(!f)return;const name=(window.prompt('Novo nome da pasta:',f.name)||'').trim();if(!name)return;
  if(libraryFolders.some(x=>x.id!==f.id&&x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){toast('Já existe uma pasta com esse nome');return;}
  f.name=name;persistLibrary();renderLibrary();toast('Pasta renomeada');
}
function deleteActiveLibraryFolder(){
  if(libraryScope==='global'){deleteGlobalLibraryFolder();return;}
  const f=libraryFolderById(activeLibraryFolderId);if(!f)return;const items=customLibrary.filter(i=>i.folderId===f.id);
  if(!window.confirm(`Excluir a pasta “${f.name}” e ${items.length} arquivo(s) dentro dela?`))return;
  customLibrary=customLibrary.filter(i=>i.folderId!==f.id);libraryFolders=libraryFolders.filter(x=>x.id!==f.id);activeLibraryFolderId=null;persistLibrary();renderLibrary();toast('Pasta excluída');
}
function deleteLibraryItem(id){
  const i=customLibrary.find(x=>x.id===id);if(!i)return;if(!window.confirm(`Excluir “${i.name}” da biblioteca?`))return;
  customLibrary=customLibrary.filter(x=>x.id!==id);persistLibrary();renderLibrary();toast('Arquivo removido da biblioteca');
}
function importLibraryTemplate(data,name='Peça importada',folderId=activeLibraryFolderId){
  let folder=libraryFolderById(folderId);if(!folder){folder=createLibraryFolder('Importados',{quiet:true});activeLibraryFolderId=folder.id;}
  const parts=Array.isArray(data)?data:(data?.objects||[]); if(!Array.isArray(parts)||!parts.length)throw new Error('JSON sem peças');
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const p of parts){ const w=Number(p.width),d=Number(p.depth),h=Number(p.height),x=Number(p.x),yb=Number(p.yBase),z=Number(p.z); if(![w,d,h,x,yb,z].every(Number.isFinite))continue; minX=Math.min(minX,x-w/2);maxX=Math.max(maxX,x+w/2);minY=Math.min(minY,yb);maxY=Math.max(maxY,yb+h);minZ=Math.min(minZ,z-d/2);maxZ=Math.max(maxZ,z+d/2); }
  if(!Number.isFinite(minX))throw new Error('Medidas inválidas');
  const sourceSpace=(!Array.isArray(data) && Array.isArray(data?.spaces) && data.spaces.length) ? JSON.parse(JSON.stringify(data.spaces[0])) : null;
  const item={id:uid('lib'),folderId:folder.id,name,sourceBounds:{minX,maxX,minY,maxY,minZ,maxZ},parts:parts.map(p=>({...p,machining:JSON.parse(JSON.stringify(p.machining||[]))}))};
  if(sourceSpace)item.layout={space:sourceSpace};customLibrary.push(item);persistLibrary();renderLibrary();
  const fixedCount=(sourceSpace?['x','y','z'].reduce((n,a)=>n+(sourceSpace.fixedBands?.[a]?.length||0),0):0)||(sourceSpace?.cells?.filter(c=>c.fixedAxes&&(c.fixedAxes.x||c.fixedAxes.y||c.fixedAxes.z)).length||0);
  toast(fixedCount?`Modelo salvo · ${fixedCount} faixa(s) fixa(s) preservadas`:'Modelo salvo na biblioteca');
}
function saveCurrentFurnitureToLibrary(){
  if(libraryScope==='global'){publishCurrentFurnitureGlobal();return;}
  const folder=libraryFolderById(activeLibraryFolderId);if(!folder){toast('Abra uma pasta para salvar o móvel');return;}
  const root=selectedFurnitureRoot();if(!root){toast('Selecione um móvel');return;}
  const name=(window.prompt('Nome do arquivo/modelo:',safeFileName(root.name||'movel','movel').replace(/-/g,'_'))||'').trim();if(!name)return;
  importLibraryTemplate(captureFurniture(root),name,folder.id);
}


// ---------- Usinagem de peças: furos e rasgos ----------
let machiningType='hole';
let machiningEditId=null;
function cloneMachining(v){ return JSON.parse(JSON.stringify(Array.isArray(v)?v:[])); }
function mmPrec(v){ return roundMmNumber(Number(v)*M_TO_MM,3); }
function axisSizeMmFromUserData(u,axis){ return axis==='x'?mmPrec(u.width):axis==='y'?mmPrec(u.height):mmPrec(u.depth); }
function pieceThicknessInfo(o){
  if(!o || o.userData?.kind==='cylinder') return null;
  const u=o.userData;
  const dims={x:mmPrec(u.width),y:mmPrec(u.height),z:mmPrec(u.depth)};
  const axes=['x','y','z'].sort((a,b)=>dims[a]-dims[b]);
  const thicknessAxis=axes[0];
  // Orientação 2D CANÔNICA. Não escolhemos mais o maior lado como horizontal,
  // pois isso podia girar a peça 90° no DXF mesmo com "Girar 90°" desligado.
  // Z espessura (porta/fundo): X horizontal, Y vertical.
  // Y espessura (base/topo/prateleira): X horizontal, Z vertical.
  // X espessura (lateral): Z horizontal, Y vertical.
  let uAxis,vAxis;
  if(thicknessAxis==='z'){uAxis='x';vAxis='y';}
  else if(thicknessAxis==='y'){uAxis='x';vAxis='z';}
  else {uAxis='z';vAxis='y';}
  return {dims,thicknessAxis,thickness:dims[thicknessAxis],uAxis,vAxis,faceW:dims[uAxis],faceH:dims[vAxis]};
}
function axisLabel(a){ return a==='x'?'X':a==='y'?'Y':'Z'; }
function machiningFaceOptions(o){
  const ti=pieceThicknessInfo(o); if(!ti)return [];
  const a=ti.thicknessAxis;
  const names=a==='x'?['Esquerda','Direita']:a==='y'?['Baixo','Cima']:['Trás','Frente'];
  return [
    {value:`+${a}`,label:`${names[0]} · entra +${axisLabel(a)}`},
    {value:`-${a}`,label:`${names[1]} · entra −${axisLabel(a)}`}
  ];
}
function entryAxisName(v){ return String(v||'+y').slice(-1); }
function entryAxisSign(v){ return String(v||'+y').startsWith('-')?-1:1; }
function localCoordField(axis){ return $(axis==='x'?'machiningX':axis==='y'?'machiningY':'machiningZ'); }
function parseDecimalInput(value){
  const text=String(value??'').trim().replace(/−/g,'-').replace(/,/g,'.');
  if(!text)return NaN;
  return Number(text);
}
function machiningFieldNumber(id){ return parseDecimalInput($(id)?.value); }
function grooveLengthIsFull(){return /^x$/i.test(String($('machiningLength')?.value||'').trim());}
function setGrooveLengthFull(){
  if(!selected)return;const ti=pieceThicknessInfo(selected);if(!ti)return;const axis=$('machiningLengthAxis').value;
  $('machiningLength').value='X';$('machiningLengthFull').classList.add('active');
  if([ti.uAxis,ti.vAxis].includes(axis))localCoordField(axis).value=0;updateMachiningUI();
}
function syncGrooveLengthButton(){const b=$('machiningLengthFull');if(b)b.classList.toggle('active',grooveLengthIsFull());}

function formatCoordInputValue(value){
  const n=Number(value); if(!Number.isFinite(n))return '';
  return nice(n);
}
function toggleMachiningCoordSign(axis){
  const field=localCoordField(axis); if(!field)return;
  let n=parseDecimalInput(field.value);
  if(!Number.isFinite(n)){toast(`Confira o valor de ${axisLabel(axis)}`);field.focus();return;}
  if(Math.abs(n)<0.0000001)n=0;
  else n=-n;
  field.value=formatCoordInputValue(n);
  field.dispatchEvent(new Event('input',{bubbles:true}));
  field.focus();
  try{field.setSelectionRange(field.value.length,field.value.length);}catch(_){ }
}

function machiningRawCoord(op,axis){
  const r=op?.coordRef?.[axis];
  if(Number.isFinite(Number(r)))return Number(r);
  const v=Number(op?.[axis]); return Number.isFinite(v)?v:0;
}
function resolveSignedMachiningCoord(raw,dim,span=0){
  raw=Number(raw); dim=Number(dim)||0; span=Math.max(0,Number(span)||0);
  if(!Number.isFinite(raw))return 0;
  // Negativo = referência a partir do lado oposto. Para rasgos, descontamos
  // também o tamanho da operação para que a BORDA do rasgo fique à distância pedida.
  return raw<0 ? dim+raw-span : raw;
}
function resolvedMachiningCoords(o,op){
  const ti=pieceThicknessInfo(o); if(!ti)return {x:0,y:0,z:0};
  const da=entryAxisName(op.entryAxis),sign=entryAxisSign(op.entryAxis),out={};
  let wa=null;
  if(op.type==='groove')wa=op.lengthAxis===ti.uAxis?ti.vAxis:ti.uAxis;
  for(const a of ['x','y','z']){
    if(a===da){out[a]=sign>0?0:ti.dims[a];continue;}
    let span=0;
    if(op.type==='groove'){
      if(a===op.lengthAxis)span=Number(op.length)||0;
      else if(a===wa)span=Number(op.width)||0;
    }
    out[a]=resolveSignedMachiningCoord(machiningRawCoord(op,a),ti.dims[a],span);
  }
  return out;
}
function machiningCoordRefText(op){
  return `X ${nice(machiningRawCoord(op,'x'))} · Y ${nice(machiningRawCoord(op,'y'))} · Z ${nice(machiningRawCoord(op,'z'))}`;
}
function machiningHasNegativeRef(op){return ['x','y','z'].some(a=>machiningRawCoord(op,a)<0);}




// ---------- Interface de materiais / fitas ----------
function productionFillSelect(select,items,emptyText){
  const old=select.value;
  select.innerHTML='';
  const none=document.createElement('option');
  none.value='';none.textContent=emptyText;select.appendChild(none);
  for(const item of items){
    const op=document.createElement('option');
    op.value=item.id;
    op.textContent=item.code?`${item.name} · ${item.code}`:item.name;
    select.appendChild(op);
  }
  if([...select.options].some(o=>o.value===old))select.value=old;
}
function productionSelectedIsPiece(){
  return !!selected && selected.userData?.kind!=='cylinder' && selected.userData?.kind!=='hardware-visual' && !selected.userData?.excludeFromCutList;
}
function productionLoadMaterialFields(){
  const m=productionMaterialById($('productionMaterialSelect').value);
  if(!m)return;
  $('productionMaterialName').value=m.name;
  $('productionMaterialCode').value=m.code||'';
  $('productionMaterialThickness').value=nice(m.thickness);
  $('productionMaterialSheetWidth').value=nice(m.sheetWidth||2750);
  $('productionMaterialSheetHeight').value=nice(m.sheetHeight||1850);
  $('productionMaterialGrainDirection').value=m.grainDirection==='width'?'width':'length';
  $('productionMaterialColor').value=productionColor(m.color,'#d8c5a4');
  $('productionMaterialCoreColor').value=productionColor(m.coreColor,'#c6a77b');
  $('productionMaterialGrain').checked=!!m.grain;
}
function productionLoadBandFields(){
  const b=productionBandById($('productionBandSelect').value);
  if(!b)return;
  $('productionBandName').value=b.name;
  $('productionBandCode').value=b.code||'';
  $('productionBandThickness').value=nice(b.thickness);
  $('productionBandWidth').value=nice(b.width);
  $('productionBandColor').value=productionColor(b.color,'#f5f5f2');
}
function productionRefreshCatalogSelects(){
  productionFillSelect($('productionMaterialSelect'),projectProduction.materials,'＋ Novo / selecione material');
  productionFillSelect($('productionBandSelect'),projectProduction.edgeBands,'＋ Nova / selecione fita');
  for(const id of ['productionEdgeUMin','productionEdgeUMax','productionEdgeVMin','productionEdgeVMax']){
    const sel=$(id),old=sel.value;
    sel.innerHTML='<option value="">Sem fita</option>';
    for(const b of projectProduction.edgeBands){
      const op=document.createElement('option');
      op.value=b.id;op.textContent=b.code?`${b.name} · ${b.code}`:b.name;sel.appendChild(op);
    }
    if([...sel.options].some(o=>o.value===old))sel.value=old;
  }
  refreshSpaceMaterialSelects();
}
function productionRefreshSelectedPiece(){
  const ok=productionSelectedIsPiece();
  const info=$('productionSelectedPieceInfo');
  const edgeBox=$('productionEdgeAssignments');
  $('productionMaterialApply').disabled=!ok;
  $('productionClearBands').disabled=!ok;

  for(const sel of document.querySelectorAll('[data-edge-key]'))sel.disabled=!ok;

  if(!ok){
    info.textContent='Selecione uma peça MDF para definir material e fitas.';
    $('productionLabelPreview').innerHTML='<strong>Etiquetas:</strong> selecione uma peça para visualizar os dados que já estão preparados.';
    return;
  }

  const u=selected.userData,ti=pieceThicknessInfo(selected),defs=pieceEdgeDisplayDefinitions(selected);
  const material=productionMaterialById(u.materialId);
  const actualT=ti?.thickness||0;
  const mismatch=material&&Math.abs(Number(material.thickness)-actualT)>.2;

  info.innerHTML=
    `<strong>${escapeHtml(u.name||'Peça')}</strong> · ${nice(ti?.faceW||0)} × ${nice(ti?.faceH||0)} × ${nice(actualT)} mm`+
    `<br>Material: <strong>${escapeHtml(u.materialType||'não definido')}</strong>${u.materialCode?` · ${escapeHtml(u.materialCode)}`:''}`+
    `${mismatch?`<br><span style="color:#ffb14a">⚠ Material cadastrado com ${nice(material.thickness)} mm, mas a peça tem ${nice(actualT)} mm. A geometria não foi alterada.</span>`:''}`;

  for(const [key,d] of Object.entries(defs)){
    const cap=key[0].toUpperCase()+key.slice(1);
    $(`productionEdgeLabel${cap}`).textContent=d.label;
    $(`productionEdgeAxis${cap}`).textContent=d.axis;
  }

  const bands=normalizePieceEdgeBands(u.edgeBands||{});
  for(const [key,id] of Object.entries({
    uMin:'productionEdgeUMin',uMax:'productionEdgeUMax',vMin:'productionEdgeVMin',vMax:'productionEdgeVMax'
  })){
    $(id).value=bands[key]?.id||'';
  }

  const ld=pieceProductionLabelData(selected);
  $('productionLabelPreview').innerHTML=
    `<strong>ID ${escapeHtml(ld.partId||'—')}</strong> · ${escapeHtml(ld.partName)}<br>`+
    `Material: ${escapeHtml(ld.material)}${ld.materialCode?` (${escapeHtml(ld.materialCode)})`:''} · `+
    `${nice(ld.faceW)} × ${nice(ld.faceH)} × ${nice(ld.thickness)} mm · veio ${ld.grain?'SIM':'NÃO'}<br>`+
    `Fitas: ${escapeHtml(ld.edgeBandSummary||'nenhuma')} · Usinagens: ${ld.machiningCount}<br>`+
    `<span style="color:#8ca397">Projeto/cliente/ambiente/espaço também já fazem parte da estrutura. Na etapa de etiquetas escolheremos quais campos imprimir.</span>`;
}
function productionRefreshDialog(){
  productionRefreshCatalogSelects();
  productionRefreshSelectedPiece();
}
function openProductionDialog(){
  $('morePanel').style.display='none';
  productionRefreshDialog();
  $('productionDialog').style.display='flex';
}
function closeProductionDialog(){
  $('productionDialog').style.display='none';
}

// ---------- 1.100.95 · Etiquetas A4 com margens e espaçamentos independentes ----------
const LABELS_PREFS_KEY='designlabLabelsV110075';
function labelsPrefs(){
  const d={scope:'project',mode:'piece',width:70,height:40,paper:'a4',marginLeft:8,marginRight:8,marginTop:8,marginBottom:8,gapHorizontal:3,gapVertical:0,sort:'code',showProject:true,showSpace:true,showBands:true,showMachining:true,showGrain:true,showId:true};
  try{
    const raw=JSON.parse(localStorage.getItem(LABELS_PREFS_KEY)||'{}')||{};
    // Migração das versões antigas, que tinham uma margem única para os 4 lados.
    const legacy=Math.max(0,Number(raw.margin)||0);
    return {...d,...raw,
      marginLeft:Number.isFinite(Number(raw.marginLeft))?Number(raw.marginLeft):(raw.margin!=null?legacy:d.marginLeft),
      marginRight:Number.isFinite(Number(raw.marginRight))?Number(raw.marginRight):(raw.margin!=null?legacy:d.marginRight),
      marginTop:Number.isFinite(Number(raw.marginTop))?Number(raw.marginTop):(raw.margin!=null?legacy:d.marginTop),
      marginBottom:Number.isFinite(Number(raw.marginBottom))?Number(raw.marginBottom):(raw.margin!=null?legacy:d.marginBottom),
      // Migração 1.100.95: o espaçamento antigo passa a representar somente o vão horizontal.
      // Na vertical começamos em 0 mm para etiquetas que são coladas entre as linhas.
      gapHorizontal:Number.isFinite(Number(raw.gapHorizontal))?Number(raw.gapHorizontal):(Number.isFinite(Number(raw.gap))?Number(raw.gap):d.gapHorizontal),
      gapVertical:Number.isFinite(Number(raw.gapVertical))?Number(raw.gapVertical):d.gapVertical
    };
  }catch(_){return d}
}
function labelsSavePrefs(){
  const p={
    scope:$('labelsScope')?.value||'project',mode:$('labelsMode')?.value||'piece',
    width:Math.max(30,Number($('labelsWidth')?.value)||70),height:Math.max(20,Number($('labelsHeight')?.value)||40),
    paper:$('labelsPaper')?.value||'a4',
    marginLeft:Math.max(0,Number($('labelsMarginLeft')?.value)||0),marginRight:Math.max(0,Number($('labelsMarginRight')?.value)||0),
    marginTop:Math.max(0,Number($('labelsMarginTop')?.value)||0),marginBottom:Math.max(0,Number($('labelsMarginBottom')?.value)||0),
    gapHorizontal:Math.max(0,Number($('labelsGapHorizontal')?.value)||0),gapVertical:Math.max(0,Number($('labelsGapVertical')?.value)||0),sort:$('labelsSort')?.value||'code',
    showProject:!!$('labelsShowProject')?.checked,showSpace:!!$('labelsShowSpace')?.checked,showBands:!!$('labelsShowBands')?.checked,
    showMachining:!!$('labelsShowMachining')?.checked,showGrain:!!$('labelsShowGrain')?.checked,showId:!!$('labelsShowId')?.checked
  };
  localStorage.setItem(LABELS_PREFS_KEY,JSON.stringify(p));return p;
}
function labelsApplyPrefs(){
  const p=labelsPrefs(),set=(id,v)=>{if($(id))$(id).value=v},chk=(id,v)=>{if($(id))$(id).checked=!!v};
  set('labelsScope',p.scope);set('labelsMode',p.mode);set('labelsWidth',p.width);set('labelsHeight',p.height);set('labelsPaper',p.paper);
  set('labelsMarginLeft',p.marginLeft);set('labelsMarginRight',p.marginRight);set('labelsMarginTop',p.marginTop);set('labelsMarginBottom',p.marginBottom);set('labelsGapHorizontal',p.gapHorizontal);set('labelsGapVertical',p.gapVertical);set('labelsSort',p.sort);
  chk('labelsShowProject',p.showProject);chk('labelsShowSpace',p.showSpace);chk('labelsShowBands',p.showBands);chk('labelsShowMachining',p.showMachining);chk('labelsShowGrain',p.showGrain);chk('labelsShowId',p.showId);
}
function labelsSourceParts(scope){
  let parts=[];
  if(scope==='selected'){
    if(!productionSelectedIsPiece())throw new Error('Selecione uma peça para gerar a etiqueta.');
    const p=flatPartInfo(selected,1);if(p){const r=rootForObject(selected);p.spaceName=r?.name||'';p.spaceRootId=r?.id||'';parts=[p];}
  }else if(scope==='furniture'){
    const root=selectedFurnitureRoot();if(!root)throw new Error('Selecione um móvel/espaço para gerar as etiquetas.');
    parts=furnitureObjects(root).filter(o=>o.userData?.kind!=='space-cell'&&o.userData?.kind!=='cylinder'&&!o.userData?.excludeFromCutList&&o.userData?.kind!=='hardware-visual').map((o,i)=>{const p=flatPartInfo(o,i+1);if(p){p.spaceName=root.name||'Espaço';p.spaceRootId=root.id;}return p;}).filter(Boolean);
  }else parts=allProjectFurnitureParts();
  if(!parts.length)throw new Error('Não existem peças disponíveis para etiquetas.');
  return cutPlanAssignCodes(parts);
}
function labelsSignature(p){return cutPlanPartSignature(p)}
function labelsBuildItems(prefs=labelsSavePrefs()){
  const parts=labelsSourceParts(prefs.scope),counts=new Map();
  for(const p of parts)counts.set(labelsSignature(p),(counts.get(labelsSignature(p))||0)+1);
  const seen=new Map(),items=[];
  if(prefs.mode==='group'){
    const grouped=new Map();
    for(const p of parts){const k=labelsSignature(p);if(!grouped.has(k))grouped.set(k,{...p,qty:0});grouped.get(k).qty++;}
    items.push(...grouped.values().map(p=>({...p,seq:1,total:p.qty,grouped:true})));
  }else{
    for(const p of parts){const k=labelsSignature(p),seq=(seen.get(k)||0)+1;seen.set(k,seq);items.push({...p,qty:1,seq,total:counts.get(k)||1});}
  }
  const cmp=(a,b)=>String(a||'').localeCompare(String(b||''),'pt-BR',{numeric:true,sensitivity:'base'});
  items.sort((a,b)=>{
    if(prefs.sort==='space')return cmp(a.spaceName,b.spaceName)||cmp(a.cutCode,b.cutCode)||cmp(a.name,b.name);
    if(prefs.sort==='material')return cmp(a.material,b.material)||cmp(a.cutCode,b.cutCode)||cmp(a.name,b.name);
    if(prefs.sort==='name')return cmp(a.name,b.name)||cmp(a.cutCode,b.cutCode);
    return cmp(a.cutCode,b.cutCode)||cmp(a.name,b.name);
  });
  return items;
}
function labelMachiningStats(p){
  const ops=p.machining||[];let holes=0,grooves=0;
  for(const op of ops){if(op.type==='hole')holes+=holeSeriesInstances(p.object,op).length;else if(op.type==='groove')grooves++;}
  return {holes,grooves,total:holes+grooves};
}
function labelEdgeData(p){
  const defs=p.object?pieceEdgeDisplayDefinitions(p.object):{},fallback={uMin:'U−',uMax:'U+',vMin:'V−',vMax:'V+'},out=[];
  for(const k of ['uMin','uMax','vMin','vMax']){const b=p.edgeBands?.[k],side=defs?.[k]?.label||fallback[k];out.push({key:k,side,on:!!b,text:b?(b.code||b.name||'Fita'):'—'});}return out;
}
function labelCodeText(p){if(p.grouped)return p.cutCode||'?';return p.total>1&&p.seq?`${p.cutCode||'?'} · ${p.seq}/${p.total}`:(p.cutCode||'?')}
function labelHtmlCard(p,prefs,{preview=false}={}){
  const project=typeof currentProjectRecord!=='undefined'?currentProjectRecord:null,m=labelMachiningStats(p),edges=labelEdgeData(p);
  const cls=preview?'labelCardPreview':'printLabel';
  const projectLine=[project?.name,project?.client].filter(Boolean).map(escapeHtml).join(' · ');
  const spaceLine=[project?.environment,p.spaceName].filter(Boolean).map(escapeHtml).join(' · ');
  const edgeHtml=prefs.showBands?`<div class="lpEdges">${edges.map(e=>`<span class="lpEdge${e.on?' on':''}">${e.side}: ${escapeHtml(e.text)}</span>`).join('')}</div>`:'';
  const machine=prefs.showMachining?`<div>Usinagem: ${m.holes} furo(s) · ${m.grooves} rasgo(s)</div>`:'';
  const info=[];if(prefs.showProject&&projectLine)info.push(`<div>${projectLine}</div>`);if(prefs.showSpace&&spaceLine)info.push(`<div>${spaceLine}</div>`);if(machine)info.push(machine);
  return `<article class="${cls}"><div class="lpHead"><div class="lpCode">${escapeHtml(labelCodeText(p))}</div><div class="lpName">${escapeHtml(p.name||'Peça')}</div>${p.qty>1?`<div class="lpQty">×${p.qty}</div>`:''}</div><div class="lpDims">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm</div><div class="lpMaterial">${escapeHtml(p.material||'MDF')}${p.materialCode?` · ${escapeHtml(p.materialCode)}`:''}</div><div class="lpMeta"><div>${info.join('')}</div>${prefs.showGrain&&p.materialGrain?`<div class="lpGrain" title="Sentido do veio · ${normalizePieceGrainRotation(p.materialGrainRotation)}°">${normalizePieceGrainRotation(p.materialGrainRotation)===90?'↔':'↕'}</div>`:''}</div>${edgeHtml}<div class="lpFoot">${prefs.showId?`<span class="lpId">ID ${escapeHtml(p.partId||'—')}</span>`:'<span></span>'}<span>${p.materialGrain?`VEIO ${normalizePieceGrainRotation(p.materialGrainRotation)}°`:'SEM VEIO'}</span></div></article>`;
}
function labelsA4Layout(prefs){
  const pageW=210,pageH=297,left=Math.max(0,prefs.marginLeft||0),right=Math.max(0,prefs.marginRight||0),top=Math.max(0,prefs.marginTop||0),bottom=Math.max(0,prefs.marginBottom||0);
  const gapHorizontal=Math.max(0,prefs.gapHorizontal||0),gapVertical=Math.max(0,prefs.gapVertical||0);
  const usableW=pageW-left-right,usableH=pageH-top-bottom;
  if(usableW<=0||usableH<=0)throw new Error('As margens ocupam toda a folha A4.');
  if(prefs.width>usableW+.001||prefs.height>usableH+.001)throw new Error('A etiqueta não cabe na área útil da folha A4 com essas margens.');
  const cols=Math.max(1,Math.floor((usableW+gapHorizontal)/(prefs.width+gapHorizontal)+1e-9));
  const rows=Math.max(1,Math.floor((usableH+gapVertical)/(prefs.height+gapVertical)+1e-9));
  return {pageW,pageH,left,right,top,bottom,gapHorizontal,gapVertical,usableW,usableH,cols,rows,perPage:cols*rows};
}
function labelsPreviewA4(items,prefs){
  const lay=labelsA4Layout(prefs),scale=2,totalPages=Math.max(1,Math.ceil(items.length/lay.perPage)),previewPages=Math.min(totalPages,3),pages=[];
  for(let pi=0;pi<previewPages;pi++){
    const chunk=items.slice(pi*lay.perPage,(pi+1)*lay.perPage),cards=[];
    chunk.forEach((p,i)=>{
      const col=i%lay.cols,row=Math.floor(i/lay.cols),x=lay.left+col*(prefs.width+lay.gapHorizontal),y=lay.top+row*(prefs.height+lay.gapVertical);
      cards.push(labelHtmlCard(p,prefs,{preview:true}).replace('class="labelCardPreview"',`class="labelCardPreview" style="left:${x*scale}px;top:${y*scale}px;width:${prefs.width*scale}px;height:${prefs.height*scale}px"`));
    });
    pages.push(`<section class="labelsPreviewPage" data-page-label="A4 · página ${pi+1}/${totalPages}"><div class="labelsPreviewMarginGuide" style="left:${lay.left*scale}px;top:${lay.top*scale}px;width:${lay.usableW*scale}px;height:${lay.usableH*scale}px"></div>${cards.join('')}</section>`);
  }
  return {html:pages.join(''),layout:lay,totalPages,previewPages};
}
function renderLabelsPreview(){
  const grid=$('labelsPreviewGrid'),sum=$('labelsSummary');if(!grid||!sum)return;
  grid.innerHTML='';
  try{
    const prefs=labelsSavePrefs(),items=labelsBuildItems(prefs),physical=prefs.mode==='group'?items.reduce((n,p)=>n+(p.qty||1),0):items.length;
    if(prefs.paper==='roll'){
      const first=items[0];grid.innerHTML=first?`<div class="labelsRollPreview">${labelHtmlCard(first,prefs,{preview:true})}</div>`:'';
      sum.innerHTML=`<strong>${items.length} etiqueta(s)</strong> · ${physical} peça(s) física(s) · ${nice(prefs.width)} × ${nice(prefs.height)} mm.<br>Prévia da etiquetadora: uma etiqueta por página.`;
    }else{
      const pv=labelsPreviewA4(items,prefs);
      grid.innerHTML=pv.html;
      sum.innerHTML=`<strong>${items.length} etiqueta(s)</strong> na impressão · ${physical} peça(s) física(s) · ${pv.layout.cols} coluna(s) × ${pv.layout.rows} linha(s) por A4 · ${pv.totalPages} página(s).<br>Margens A4: esquerda ${nice(prefs.marginLeft)} · direita ${nice(prefs.marginRight)} · cima ${nice(prefs.marginTop)} · baixo ${nice(prefs.marginBottom)} mm.<br>Entre etiquetas: horizontal ${nice(prefs.gapHorizontal)} mm · vertical ${nice(prefs.gapVertical)} mm${pv.totalPages>pv.previewPages?` · prévia mostrando ${pv.previewPages} página(s)`:''}.`;
    }
  }catch(err){sum.textContent=err.message||'Não foi possível gerar as etiquetas';grid.innerHTML='';}
}
function openLabelsDialog({scope=null}={}){
  $('morePanel').style.display='none';labelsApplyPrefs();if(scope&&$('labelsScope'))$('labelsScope').value=scope;$('labelsDialog').style.display='flex';renderLabelsPreview();
}
function closeLabelsDialog(){$('labelsDialog').style.display='none'}
function labelsPrintDocument(items,prefs){
  const common=`*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}.printLabel{border:.25mm solid #111;padding:2.2mm;background:#fff;overflow:hidden;display:flex;flex-direction:column}.lpHead{display:flex;align-items:flex-start;gap:2mm;border-bottom:.6mm solid #111;padding-bottom:1mm}.lpCode{font-size:7mm;font-weight:900;line-height:1}.lpName{font-size:3.6mm;font-weight:900;line-height:1.05;flex:1;overflow:hidden}.lpQty{font-size:3mm;font-weight:900;border:.3mm solid #111;border-radius:1mm;padding:.5mm 1mm}.lpDims{font-size:4.5mm;font-weight:900;margin-top:1mm;white-space:nowrap}.lpMaterial{font-size:2.8mm;font-weight:800;margin-top:.6mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lpMeta{font-size:2.15mm;line-height:1.28;margin-top:.7mm;display:grid;grid-template-columns:1fr auto;gap:1.2mm}.lpGrain{font-size:5mm;font-weight:900}.lpEdges{display:grid;grid-template-columns:1fr 1fr;gap:.5mm;margin-top:.8mm}.lpEdge{font-size:1.9mm;border:.25mm solid #aaa;border-radius:.6mm;padding:.45mm .65mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.lpEdge.on{border:.55mm solid #111;font-weight:900;padding:.15mm .35mm}.lpFoot{margin-top:auto;border-top:.25mm solid #999;padding-top:.6mm;font-size:1.75mm;display:flex;justify-content:space-between;gap:1mm}.lpId{font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media print{.printLabel{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
  if(prefs.paper==='roll'){
    const cards=items.map(p=>`<section class="rollPage">${labelHtmlCard(p,prefs).replace('class="printLabel"',`class="printLabel" style="width:${prefs.width}mm;height:${prefs.height}mm"`)}</section>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas · ${escapeHtml(currentProjectRecord?.name||'DesignLabMoveis')}</title><style>@page{size:${prefs.width}mm ${prefs.height}mm;margin:0}${common}.rollPage{width:${prefs.width}mm;height:${prefs.height}mm;break-after:page;page-break-after:always}.rollPage:last-child{break-after:auto;page-break-after:auto}</style></head><body>${cards}</body></html>`;
  }
  const lay=labelsA4Layout(prefs),totalPages=Math.max(1,Math.ceil(items.length/lay.perPage)),pages=[];
  for(let pi=0;pi<totalPages;pi++){
    const chunk=items.slice(pi*lay.perPage,(pi+1)*lay.perPage),cards=[];
    chunk.forEach((p,i)=>{
      const col=i%lay.cols,row=Math.floor(i/lay.cols),x=lay.left+col*(prefs.width+lay.gapHorizontal),y=lay.top+row*(prefs.height+lay.gapVertical);
      cards.push(labelHtmlCard(p,prefs).replace('class="printLabel"',`class="printLabel" style="position:absolute;left:${x}mm;top:${y}mm;width:${prefs.width}mm;height:${prefs.height}mm"`));
    });
    pages.push(`<section class="printPage">${cards.join('')}</section>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas · ${escapeHtml(currentProjectRecord?.name||'DesignLabMoveis')}</title><style>@page{size:A4 portrait;margin:0}${common}.printPage{position:relative;width:210mm;height:297mm;break-after:page;page-break-after:always;overflow:hidden}.printPage:last-child{break-after:auto;page-break-after:auto}</style></head><body>${pages.join('')}</body></html>`;
}
function labelsPrint(){
  try{
    const prefs=labelsSavePrefs(),items=labelsBuildItems(prefs),html=labelsPrintDocument(items,prefs),w=window.open('','_blank');
    if(!w){downloadText('etiquetas-designlab.html',html,'text/html;charset=utf-8');toast('O navegador bloqueou a janela de impressão · salvei o HTML das etiquetas');return;}
    w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>{try{w.print()}catch(_){}},350);
  }catch(err){toast(err.message||'Não foi possível imprimir as etiquetas')}
}
function labelsSaveHtml(){
  try{const prefs=labelsSavePrefs(),items=labelsBuildItems(prefs),html=labelsPrintDocument(items,prefs);downloadText(`${safeFileName(currentProjectRecord?.name||'projeto')}-etiquetas.html`,html,'text/html;charset=utf-8');toast('Arquivo de etiquetas salvo');}catch(err){toast(err.message||'Não foi possível salvar as etiquetas')}
}

function productionNewMaterial(){
  $('productionMaterialSelect').value='';
  $('productionMaterialName').value='';
  $('productionMaterialCode').value='';
  $('productionMaterialThickness').value=18;
  $('productionMaterialSheetWidth').value=2750;
  $('productionMaterialSheetHeight').value=1850;
  $('productionMaterialGrainDirection').value='length';
  $('productionMaterialColor').value='#e7e1d4';
  $('productionMaterialCoreColor').value='#c6a77b';
  $('productionMaterialGrain').checked=false;
  $('productionMaterialName').focus();
}
function productionSaveMaterial(){
  const name=String($('productionMaterialName').value||'').trim();
  const thickness=Number($('productionMaterialThickness').value);
  const sheetWidth=Number($('productionMaterialSheetWidth').value),sheetHeight=Number($('productionMaterialSheetHeight').value);
  if(!name){toast('Digite o nome do material');return;}
  if(!Number.isFinite(thickness)||thickness<=0){toast('Confira a espessura do material');return;}
  if(!Number.isFinite(sheetWidth)||sheetWidth<100||!Number.isFinite(sheetHeight)||sheetHeight<100){toast('Confira o tamanho da chapa');return;}

  const selectedId=$('productionMaterialSelect').value;
  let m=selectedId?productionMaterialById(selectedId):null;
  const data=normalizeProductionMaterial({
    id:m?.id||uid('mat'),
    name,
    code:$('productionMaterialCode').value,
    thickness,
    sheetWidth,
    sheetHeight,
    grainDirection:$('productionMaterialGrainDirection').value==='width'?'width':'length',
    color:$('productionMaterialColor').value,
    coreColor:$('productionMaterialCoreColor').value,
    grain:$('productionMaterialGrain').checked
  });

  if(m)Object.assign(m,data);
  else{m=data;projectProduction.materials.push(m);}

  // Material editado atualiza automaticamente todas as peças ligadas a ele.
  for(const o of objects){
    if(o.userData?.materialId!==m.id)continue;
    o.userData.materialType=m.name;
    o.userData.materialCode=m.code;
    o.userData.materialGrain=!!m.grain;
    o.userData.materialCoreColor=m.coreColor;
    o.userData.baseColor=productionColorInt(m.color,COLORS.panel);
    restoreBaseColor(o);
  }
  if(selected&&!visualMode)setAllFaces(selected,COLORS.selected);

  productionRefreshCatalogSelects();
  $('productionMaterialSelect').value=m.id;
  productionLoadMaterialFields();
  productionRefreshSelectedPiece();
  commitHistory();
  toast(selectedId?'Material atualizado':'Material salvo no projeto');
}
function productionDeleteMaterial(){
  const id=$('productionMaterialSelect').value,m=productionMaterialById(id);if(!m)return;
  if(!window.confirm(`Excluir o material “${m.name}” da biblioteca do projeto? As peças mantêm o nome/cor atuais, mas deixam de ficar vinculadas ao cadastro.`))return;
  projectProduction.materials=projectProduction.materials.filter(x=>x.id!==id);
  for(const o of objects){
    if(o.userData?.materialId!==id)continue;
    o.userData.materialId=null;
  }
  for(const root of spaceRoots){
    if(root.defaultMaterialId===id)root.defaultMaterialId=null;
  }
  productionNewMaterial();productionRefreshDialog();renderSpaces();commitHistory();toast('Material removido da biblioteca e dos padrões de espaço');
}
function productionApplyMaterial(){
  if(!productionSelectedIsPiece()){toast('Selecione uma peça MDF');return;}
  const m=productionMaterialById($('productionMaterialSelect').value);
  if(!m){toast('Selecione um material salvo');return;}

  productionApplyMaterialRecordToObject(selected,m,{keepSelection:true});
  updateInspector();productionRefreshSelectedPiece();commitHistory();

  const ti=pieceThicknessInfo(selected);
  const mismatch=Math.abs(Number(m.thickness)-(ti?.thickness||0))>.2;
  toast(mismatch?`Material aplicado · atenção: peça ${nice(ti?.thickness||0)} mm / material ${nice(m.thickness)} mm`:'Material aplicado à peça');
}
function productionNewBand(){
  $('productionBandSelect').value='';
  $('productionBandName').value='';
  $('productionBandCode').value='';
  $('productionBandThickness').value=.45;
  $('productionBandWidth').value=22;
  $('productionBandColor').value='#f5f5f2';
  $('productionBandName').focus();
}
function productionSaveBand(){
  const name=String($('productionBandName').value||'').trim();
  const thickness=Number($('productionBandThickness').value),width=Number($('productionBandWidth').value);
  if(!name){toast('Digite o nome da fita');return;}
  if(!(thickness>0&&width>0)){toast('Confira espessura e largura da fita');return;}

  const selectedId=$('productionBandSelect').value;
  let b=selectedId?productionBandById(selectedId):null;
  const data=normalizeProductionBand({
    id:b?.id||uid('band'),name,code:$('productionBandCode').value,
    thickness,width,color:$('productionBandColor').value
  });
  if(b)Object.assign(b,data);
  else{b=data;projectProduction.edgeBands.push(b);}

  // Atualiza snapshots das peças que usam essa fita.
  for(const o of objects){
    const bands=normalizePieceEdgeBands(o.userData?.edgeBands||{});
    let changed=false;
    for(const key of ['uMin','uMax','vMin','vMax']){
      if(bands[key]?.id===b.id){bands[key]=productionClone(b);changed=true;}
    }
    if(changed){o.userData.edgeBands=bands;restoreBaseColor(o);}
  }
  if(selected&&!visualMode)setAllFaces(selected,COLORS.selected);

  productionRefreshCatalogSelects();
  $('productionBandSelect').value=b.id;
  productionLoadBandFields();
  productionRefreshSelectedPiece();
  commitHistory();
  toast(selectedId?'Fita atualizada':'Fita salva no projeto');
}
function productionDeleteBand(){
  const id=$('productionBandSelect').value,b=productionBandById(id);if(!b)return;
  if(!window.confirm(`Excluir a fita “${b.name}”? As aplicações desta fita serão removidas das peças.`))return;

  projectProduction.edgeBands=projectProduction.edgeBands.filter(x=>x.id!==id);
  for(const o of objects){
    const bands=normalizePieceEdgeBands(o.userData?.edgeBands||{});
    let changed=false;
    for(const key of ['uMin','uMax','vMin','vMax']){
      if(bands[key]?.id===id){delete bands[key];changed=true;}
    }
    if(changed){o.userData.edgeBands=bands;restoreBaseColor(o);}
  }
  if(selected&&!visualMode)setAllFaces(selected,COLORS.selected);

  productionNewBand();productionRefreshDialog();commitHistory();toast('Fita removida');
}
function productionAssignEdge(key,bandId){
  if(!productionSelectedIsPiece())return;
  const bands=normalizePieceEdgeBands(selected.userData?.edgeBands||{});
  if(!bandId)delete bands[key];
  else{
    const snap=productionBandSnapshot(bandId);
    if(snap)bands[key]=snap;
  }
  selected.userData.edgeBands=bands;
  selected.userData.labelMeta={...(selected.userData.labelMeta||{}),schemaVersion:1,enabled:true};
  restoreBaseColor(selected);
  if(!visualMode)setAllFaces(selected,COLORS.selected);
  productionRefreshSelectedPiece();commitHistory();
}
function productionClearSelectedBands(){
  if(!productionSelectedIsPiece())return;
  selected.userData.edgeBands={};
  restoreBaseColor(selected);
  if(!visualMode)setAllFaces(selected,COLORS.selected);
  productionRefreshSelectedPiece();commitHistory();toast('Fitas removidas desta peça');
}



function fillSpaceMaterialSelect(select,preferredId=null,{allowNone=true}={}){
  if(!select)return;
  const old=preferredId??select.value;
  select.innerHTML='';
  if(allowNone){
    const none=document.createElement('option');
    none.value='';
    none.textContent='Sem material padrão';
    select.appendChild(none);
  }
  for(const m of projectProduction.materials){
    const op=document.createElement('option');
    op.value=m.id;
    op.textContent=`${m.name}${m.code?` · ${m.code}`:''} · ${nice(m.thickness)} mm · ${nice(m.sheetWidth||2750)}×${nice(m.sheetHeight||1850)}${m.grain?` · veio ${m.grainDirection==='width'?'largura':'comprimento'}`:''}`;
    select.appendChild(op);
  }
  if(old&&[...select.options].some(o=>o.value===old))select.value=old;
  else if(!allowNone&&select.options.length)select.selectedIndex=0;
}
function preferredDefaultMaterialId(){
  const preferred=projectProduction.materials.find(m=>m.id==='mat-mdf-branco-18')
    || projectProduction.materials.find(m=>Math.abs(Number(m.thickness)-18)<.2)
    || projectProduction.materials[0];
  return preferred?.id||'';
}
function refreshSpaceMaterialSelects(){
  const newSel=$('spaceDefaultMaterial');
  if(newSel){
    const current=newSel.value;
    fillSpaceMaterialSelect(newSel,current,{allowNone:true});
  }
  const editSel=$('editSpaceDefaultMaterial');
  if(editSel){
    const current=editSel.value;
    fillSpaceMaterialSelect(editSel,current,{allowNone:true});
  }
  updateSpaceMaterialPreview();
  updateEditSpaceMaterialPreview();
}
function updateSpaceMaterialPreview(){
  const out=$('spaceDefaultMaterialPreview'),sel=$('spaceDefaultMaterial');
  if(!out||!sel)return;
  const m=productionMaterialById(sel.value);
  out.innerHTML=m
    ? `Novas peças de <strong>${nice(m.thickness)} mm</strong> criadas neste espaço recebem automaticamente <strong>${escapeHtml(m.name)}</strong>. Chapa: <strong>${nice(m.sheetWidth||2750)} × ${nice(m.sheetHeight||1850)} mm</strong>${m.grain?` · veio no <strong>${m.grainDirection==='width'?'sentido da largura':'sentido do comprimento'}</strong>`:''}.`
    : 'Sem padrão: as novas peças continuam com o material genérico até você aplicar um material manualmente.';
}
function updateEditSpaceMaterialPreview(){
  const out=$('editSpaceMaterialPreview'),sel=$('editSpaceDefaultMaterial');
  if(!out||!sel)return;
  const m=productionMaterialById(sel.value);
  const apply=$('editSpaceApplyMaterialExisting');
  if(apply)apply.disabled=!m;
  out.innerHTML=m
    ? `Padrão escolhido: <strong>${escapeHtml(m.name)}</strong> · ${nice(m.thickness)} mm${m.code?` · ${escapeHtml(m.code)}`:''}.`
    : 'Este espaço ficará sem material padrão. Peças já existentes não serão alteradas.';
}


// ---------- v78: Forma paramétrica / contorno externo ----------
const SHAPE_PRESET_KEY='miniCadProV78_shapePresets';
const BUILTIN_SHAPES=[
  {id:'builtin-r50',locked:true,folder:'Cantos',name:'Canto R50',type:'round-corner',radius:50},
  {id:'builtin-r100',locked:true,folder:'Cantos',name:'Canto R100',type:'round-corner',radius:100},
  {id:'builtin-r150',locked:true,folder:'Cantos',name:'Canto R150',type:'round-corner',radius:150}
];
let shapePresetEditId=null;
let shapeSelectedCorners=new Set(['bl']);
let shapePreviewOwner=null, shapePreviewOriginalForms=null, shapePreviewActive=false;
function cloneForms(v){return JSON.parse(JSON.stringify(Array.isArray(v)?v:[]));}
function getUserShapePresets(){try{const a=JSON.parse(localStorage.getItem(SHAPE_PRESET_KEY)||'[]');return Array.isArray(a)?a:[];}catch{return [];}}
function setUserShapePresets(a){try{localStorage.setItem(SHAPE_PRESET_KEY,JSON.stringify(a||[]));}catch{}}
function allShapePresets(){return [...BUILTIN_SHAPES,...getUserShapePresets()];}
function findShapePreset(id){return allShapePresets().find(x=>x.id===id)||null;}
function shapeCornerLabels(o){
  const ti=pieceThicknessInfo(o);if(!ti)return {bl:'Canto inferior esquerdo',br:'Canto inferior direito',tr:'Canto superior direito',tl:'Canto superior esquerdo'};
  if(ti.thicknessAxis==='y')return {bl:'Trás esquerdo',br:'Trás direito',tr:'Frente direito',tl:'Frente esquerdo'};
  if(ti.thicknessAxis==='z')return {bl:'Inferior esquerdo',br:'Inferior direito',tr:'Superior direito',tl:'Superior esquerdo'};
  return {bl:'Trás baixo',br:'Frente baixo',tr:'Frente cima',tl:'Trás cima'};
}
function refreshShapeCornerLabels(){
  const labels=shapeCornerLabels(shapePreviewOwner||selected);
  document.querySelectorAll('[data-shape-corner]').forEach(b=>{b.textContent=labels[b.dataset.shapeCorner]||b.dataset.shapeCorner;b.classList.toggle('active',shapeSelectedCorners.has(b.dataset.shapeCorner));});
}
function refreshShapePresetSelect(preferred=null){
  const sel=$('shapePresetSelect');if(!sel)return;const all=allShapePresets();sel.innerHTML='';
  const groups=new Map();for(const p of all){const g=String(p.folder||'Sem pasta').trim()||'Sem pasta';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(p);}
  for(const [g,arr] of groups){const og=document.createElement('optgroup');og.label=g;for(const p of arr){const o=document.createElement('option');o.value=p.id;o.textContent=p.name+(p.locked?' · padrão':'');og.appendChild(o);}sel.appendChild(og);}
  const wanted=preferred&&all.some(x=>x.id===preferred)?preferred:(all.some(x=>x.id==='builtin-r150')?'builtin-r150':all[0]?.id);if(wanted)sel.value=wanted;
  loadSelectedShapePresetToEditor(false);
}
function loadSelectedShapePresetToEditor(setEdit=false){
  const p=findShapePreset($('shapePresetSelect')?.value);if(!p)return;
  $('shapeFolder').value=p.folder||'Cantos';$('shapeName').value=p.name||'Forma';$('shapeType').value=p.type||'round-corner';$('shapeRadius').value=nice(p.radius||150);
  shapePresetEditId=setEdit&&!p.locked?p.id:null;
  $('saveShapePreset').textContent=shapePresetEditId?'💾 Salvar alteração':'💾 Salvar na biblioteca';
  updateShapePreview();
}
function newShapePreset(){shapePresetEditId=null;$('shapeFolder').value='Cantos';$('shapeName').value='Minha forma';$('shapeType').value='round-corner';$('shapeRadius').value=150;$('saveShapePreset').textContent='💾 Salvar na biblioteca';updateShapePreview();$('shapeName').focus();}
function editSelectedShapePreset(){const p=findShapePreset($('shapePresetSelect')?.value);if(!p)return;if(p.locked){shapePresetEditId=null;$('shapeName').value=(p.name||'Forma')+' personalizada';$('saveShapePreset').textContent='💾 Salvar na biblioteca';toast('Preset padrão aberto como cópia editável');}else{shapePresetEditId=p.id;$('saveShapePreset').textContent='💾 Salvar alteração';}updateShapePreview();}
function saveShapePresetLibrary(){
  const name=String($('shapeName').value||'').trim(),folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',radius=Number($('shapeRadius').value),type=$('shapeType').value||'round-corner';
  if(!name){toast('Dê um nome para a forma');return;}if(!(radius>0)){toast('Confira o raio');return;}
  const arr=getUserShapePresets();
  if(shapePresetEditId){const i=arr.findIndex(x=>x.id===shapePresetEditId);if(i>=0)arr[i]={...arr[i],name,folder,radius,type};else shapePresetEditId=null;}
  if(!shapePresetEditId){const item={id:uid('shapePreset'),name,folder,radius,type};arr.push(item);shapePresetEditId=item.id;}
  setUserShapePresets(arr);refreshShapePresetSelect(shapePresetEditId);toast('Forma salva na biblioteca');
}
function deleteShapePresetLibrary(){
  const id=$('shapePresetSelect')?.value,p=findShapePreset(id);if(!p)return;if(p.locked){toast('As formas padrão não podem ser excluídas');return;}
  if(!window.confirm(`Excluir a forma “${p.name}” da biblioteca?\n\nAs peças que já usam esta forma não serão alteradas.`))return;
  setUserShapePresets(getUserShapePresets().filter(x=>x.id!==id));shapePresetEditId=null;refreshShapePresetSelect('builtin-r150');toast('Forma removida da biblioteca');
}
function formCornerRadii(o,formsOverride=null){
  const ti=pieceThicknessInfo(o);if(!ti)return null;const maxR=Math.max(0,Math.min(ti.faceW,ti.faceH)/2),r={bl:0,br:0,tr:0,tl:0};
  for(const f of (formsOverride??o.userData?.forms??[])){if(f?.type!=='round-corner')continue;const rr=Math.max(0,Math.min(maxR,Number(f.radius)||0));for(const c of (f.corners||[]))if(c in r)r[c]=rr;}
  return r;
}
function formOutlinePointsMm(o,formsOverride=null,segments=48){
  const ti=pieceThicknessInfo(o);if(!ti)return [];const W=ti.faceW,H=ti.faceH,r=formCornerRadii(o,formsOverride);if(!r)return [];
  const pts=[];const add=(x,y)=>{const last=pts.at(-1);if(!last||Math.hypot(last[0]-x,last[1]-y)>.0001)pts.push([x,y]);};
  const arc=(cx,cy,rr,a0,a1)=>{if(rr<=.0001){add(cx,cy);return;}for(let i=0;i<=segments;i++){const a=a0+(a1-a0)*(i/segments);add(cx+rr*Math.cos(a),cy+rr*Math.sin(a));}};
  add(r.bl,0);add(W-r.br,0);if(r.br)arc(W-r.br,r.br,r.br,-Math.PI/2,0);else add(W,0);
  add(W,H-r.tr);if(r.tr)arc(W-r.tr,H-r.tr,r.tr,0,Math.PI/2);else add(W,H);
  add(r.tl,H);if(r.tl)arc(r.tl,H-r.tl,r.tl,Math.PI/2,Math.PI);else add(0,H);
  add(0,r.bl);if(r.bl)arc(r.bl,r.bl,r.bl,Math.PI,Math.PI*1.5);else add(0,0);
  return pts;
}
function disposeVisualEdgeTree(mesh){
  const ve=mesh?.userData?.visualEdges;if(!ve)return;ve.traverse?.(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.();});mesh.remove(ve);mesh.userData.visualEdges=null;
}
function formMapExtrudeGeometry(geom,ti){
  const pos=geom.attributes.position;for(let i=0;i<pos.count;i++){const sx=pos.getX(i),sy=pos.getY(i),st=pos.getZ(i);let x,y,z;if(ti.thicknessAxis==='z'){x=sx;y=sy;z=st;}else if(ti.thicknessAxis==='y'){x=sx;y=st;z=sy;}else{x=st;y=sy;z=sx;}pos.setXYZ(i,x,y,z);}pos.needsUpdate=true;geom.computeVertexNormals();geom.computeBoundingBox();geom.computeBoundingSphere();return geom;
}
function formLocalPoint(ti,u,v,t){
  const su=(u-ti.faceW/2)*MM_TO_M,sv=(v-ti.faceH/2)*MM_TO_M,st=t*MM_TO_M;
  if(ti.thicknessAxis==='z')return new THREE.Vector3(su,sv,st);if(ti.thicknessAxis==='y')return new THREE.Vector3(su,st,sv);return new THREE.Vector3(st,sv,su);
}
function makeFormVisualEdges(o,pts,ti){
  const group=new THREE.Group();group.userData.isVisualEdge=true;const mat=new THREE.LineBasicMaterial({color:0x080808,transparent:true,opacity:xray3DActive()?.86:.96,depthTest:!xray3DActive(),depthWrite:false});group.material=mat;const t=ti.thickness/2;
  for(const side of [-t,t]){const arr=pts.map(([u,v])=>formLocalPoint(ti,u,v,side));if(arr.length)arr.push(arr[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),mat);line.userData.isVisualEdge=true;group.add(line);}
  // Só quatro ligações de espessura. Não desenha uma linha em cada segmento do arco.
  const anchors=[[0,0],[ti.faceW,0],[ti.faceW,ti.faceH],[0,ti.faceH]],seg=[];for(const a of anchors){let best=pts[0],bd=Infinity;for(const p of pts){const d=(p[0]-a[0])**2+(p[1]-a[1])**2;if(d<bd){bd=d;best=p;}}seg.push(formLocalPoint(ti,best[0],best[1],-t),formLocalPoint(ti,best[0],best[1],t));}
  const sides=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),mat);sides.userData.isVisualEdge=true;group.add(sides);group.renderOrder=xray3DActive()?88:12;return group;
}
function rebuildFormGeometry(o){
  if(!o||o.userData?.kind==='cylinder'||o.userData?.kind==='curved-panel'||o.userData?.curvedRole)return;
  const ti=pieceThicknessInfo(o);if(!ti)return;disposeVisualEdgeTree(o);o.geometry?.dispose?.();
  const forms=Array.isArray(o.userData.forms)?o.userData.forms:[];
  if(!forms.length){o.geometry=new THREE.BoxGeometry(1,1,1);o.scale.set(o.userData.width,o.userData.height,o.userData.depth);delete o.userData.formProfile;const mat=new THREE.LineBasicMaterial({color:0x080808,transparent:true,opacity:xray3DActive()?.86:.96,depthTest:!xray3DActive(),depthWrite:false});const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),mat);e.userData.isVisualEdge=true;e.renderOrder=xray3DActive()?88:12;o.add(e);o.userData.visualEdges=e;return;}
  const pts=formOutlinePointsMm(o,forms,48);if(pts.length<4)return;
  const shape=new THREE.Shape();pts.forEach(([u,v],i)=>{const x=(u-ti.faceW/2)*MM_TO_M,y=(v-ti.faceH/2)*MM_TO_M;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);});shape.closePath();
  const geom=new THREE.ExtrudeGeometry(shape,{depth:ti.thickness*MM_TO_M,bevelEnabled:false,steps:1,curveSegments:64});geom.translate(0,0,-ti.thickness*MM_TO_M/2);formMapExtrudeGeometry(geom,ti);o.geometry=geom;o.scale.set(1,1,1);
  o.userData.formProfile={type:'forms',points:pts.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),bboxW:ti.faceW,bboxH:ti.faceH,thicknessAxis:ti.thicknessAxis,uAxis:ti.uAxis,vAxis:ti.vAxis};
  const edges=makeFormVisualEdges(o,pts,ti);o.add(edges);o.userData.visualEdges=edges;
}
function shapeDraftOperation(){
  const radius=Number($('shapeRadius').value),name=String($('shapeName').value||'Canto arredondado').trim()||'Canto arredondado';if(!(radius>0))throw new Error('Confira o raio');if(!shapeSelectedCorners.size)throw new Error('Escolha pelo menos um canto');
  const ti=pieceThicknessInfo(shapePreviewOwner||selected);if(!ti)throw new Error('Selecione uma peça retangular');if(radius>Math.min(ti.faceW,ti.faceH)/2+.001)throw new Error(`Raio máximo nesta peça: ${nice(Math.min(ti.faceW,ti.faceH)/2)} mm`);
  return {id:uid('form'),type:'round-corner',name,radius,folder:String($('shapeFolder').value||'Cantos').trim()||'Cantos',presetId:$('shapePresetSelect')?.value||null,corners:[...shapeSelectedCorners]};
}
function updateShapePreview(){
  const owner=shapePreviewOwner||selected,svg=$('shapePreviewSvg');if(!owner||!svg)return;const ti=pieceThicknessInfo(owner);if(!ti)return;
  let forms=cloneForms(owner.userData.forms||[]),op=null,msg='';try{op=shapeDraftOperation();forms.push(op);}catch(err){msg=err.message||'Confira a forma';}
  const pts=formOutlinePointsMm(owner,forms,24),W=ti.faceW,H=ti.faceH,pad=22,sw=420,sh=260,scale=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H)),ox=(sw-W*scale)/2,oy=(sh-H*scale)/2;
  const d=pts.map(([u,v],i)=>`${i?'L':'M'} ${(ox+u*scale).toFixed(2)} ${(sh-(oy+v*scale)).toFixed(2)}`).join(' ')+' Z';
  svg.innerHTML=`<path d="${d}" fill="#c8b591" stroke="#080808" stroke-width="2.2"/><text x="${sw/2}" y="18" text-anchor="middle" fill="#53d6e8" font-size="12">${nice(W)} × ${nice(H)} mm</text>`;
  $('shapePreviewText').textContent=msg||`${op?.name||'Forma'} · raio ${nice(op?.radius||0)} mm · ${op?.corners?.length||0} canto(s) selecionado(s).`;
}
function renderAppliedShapes(){
  const list=$('shapeAppliedList');if(!list)return;list.innerHTML='';const owner=shapePreviewOwner||selected,forms=owner?.userData?.forms||[],labels=shapeCornerLabels(owner);
  if(!forms.length){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma Forma aplicada nesta peça.';list.appendChild(d);return;}
  for(const f of forms){const item=document.createElement('div');item.className='shapeAppliedItem';const text=document.createElement('div');text.innerHTML=`<strong></strong><span></span>`;text.querySelector('strong').textContent=f.name||'Forma';text.querySelector('span').textContent=`R ${nice(f.radius)} mm · ${(f.corners||[]).map(c=>labels[c]||c).join(' + ')}`;const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteAppliedShape(f.id);item.append(text,del);list.appendChild(item);}
}
function deleteAppliedShape(id){
  const owner=shapePreviewOwner||selected;if(!owner)return;const arr=owner.userData.forms||[],f=arr.find(x=>x.id===id);if(!f)return;if(!window.confirm(`Excluir a Forma “${f.name||'Forma'}” desta peça?`))return;owner.userData.forms=arr.filter(x=>x.id!==id);rebuildFormGeometry(owner);renderAppliedShapes();updateShapePreview();renderMachiningVisuals();commitHistory();toast('Forma removida da peça');
}
function openShapeDialog(){
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  if(!selected){toast('Selecione uma peça');return;}if(selected.userData?.kind==='cylinder'||selected.userData?.kind==='curved-panel'||selected.userData?.curvedRole){toast('Forma disponível para peças retangulares');return;}
  shapePreviewOwner=selected;shapePreviewOriginalForms=null;shapePreviewActive=false;shapePresetEditId=null;shapeSelectedCorners=new Set(['bl']);$('morePanel').style.display='none';$('machiningDialog').style.display='none';
  const ti=pieceThicknessInfo(selected);$('shapePartInfo').textContent=`${selected.userData.name||'Peça'} · face ${nice(ti.faceW)} × ${nice(ti.faceH)} mm · espessura ${nice(ti.thickness)} mm. A Forma altera o contorno real e será exportada em CORTE_EXTERNO.`;
  refreshShapePresetSelect('builtin-r150');refreshShapeCornerLabels();renderAppliedShapes();updateShapePreview();$('shapeDialog').style.display='flex';
}
function restoreShapePreview(){
  if(shapePreviewActive&&shapePreviewOwner&&objects.includes(shapePreviewOwner)){shapePreviewOwner.userData.forms=cloneForms(shapePreviewOriginalForms||[]);rebuildFormGeometry(shapePreviewOwner);}
  shapePreviewActive=false;shapePreviewOriginalForms=null;$('shape3DPreviewBar').style.display='none';renderMachiningVisuals();
}
function previewShape3D(){
  const owner=shapePreviewOwner||selected;if(!owner)return;try{restoreShapePreview();shapePreviewOwner=owner;shapePreviewOriginalForms=cloneForms(owner.userData.forms||[]);const forms=cloneForms(shapePreviewOriginalForms);forms.push(shapeDraftOperation());owner.userData.forms=forms;rebuildFormGeometry(owner);shapePreviewActive=true;$('shapeDialog').style.display='none';$('shape3DPreviewBar').style.display='flex';$('shape3DPreviewInfo').textContent=`${owner.userData.name||'Peça'} · prévia temporária; volte para aplicar ou ajustar.`;selectObject(owner);toast('Prévia 3D da Forma');}catch(err){restoreShapePreview();toast(err.message||'Não foi possível visualizar');}
}
function returnShapePreview(){restoreShapePreview();if(shapePreviewOwner&&objects.includes(shapePreviewOwner))selectObject(shapePreviewOwner);$('shapeDialog').style.display='flex';updateShapePreview();}
function applyShapeToPiece(){
  const owner=shapePreviewOwner||selected;if(!owner)return;try{restoreShapePreview();shapePreviewOwner=owner;const op=shapeDraftOperation(),arr=cloneForms(owner.userData.forms||[]);arr.push(op);owner.userData.forms=arr;rebuildFormGeometry(owner);renderAppliedShapes();updateShapePreview();renderMachiningVisuals();updateInspector();commitHistory();toast(`${op.name} aplicada`);}catch(err){toast(err.message||'Forma inválida');}
}
function closeShapeDialog(){restoreShapePreview();$('shapeDialog').style.display='none';shapePreviewOwner=null;shapePresetEditId=null;}

// ---------- Ferragens inteligentes por contato ----------
const HARDWARE_PRESET_KEY='miniCadProV54_hardwarePresets';
const HARDWARE_SCOPE_KEY='designLabHardwareScopeV1';
let hardwareBuilderEditId=null;
let hardwareBuilderScope='local';
let hardwarePreviewOps=[];
let hardwareScope=localStorage.getItem(HARDWARE_SCOPE_KEY)==='local'?'local':'global';
const globalHardwareState={items:[],loaded:false,loading:false,error:''};

function getHardwarePresets(){
  try{const a=JSON.parse(localStorage.getItem(HARDWARE_PRESET_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name):[];}catch(_){return [];}
}
function setHardwarePresets(a){localStorage.setItem(HARDWARE_PRESET_KEY,JSON.stringify(a));}
function currentHardwarePresets(){return hardwareScope==='global'?globalHardwareState.items:getHardwarePresets();}
function findHardwarePreset(id){
  if(hardwareScope==='global')return globalHardwareState.items.find(x=>x.id===id)||null;
  return getHardwarePresets().find(x=>x.id===id)||null;
}
async function loadGlobalHardwarePresets({force=false}={}){
  if(globalHardwareState.loading)return;
  if(globalHardwareState.loaded&&!force)return;
  if(!cloudAccountState.ok){
    globalHardwareState.error='Entre na sua conta para acessar as Ferragens globais.';
    globalHardwareState.loaded=false;refreshHardwarePresetSelect();return;
  }
  globalHardwareState.loading=true;globalHardwareState.error='';refreshHardwarePresetSelect();
  try{
    const data=await cloudApiFetch('/hardware/global',{timeoutMs:20000});
    globalHardwareState.items=Array.isArray(data?.items)?data.items.filter(x=>x&&x.id&&x.name):[];
    globalHardwareState.loaded=true;
  }catch(err){
    globalHardwareState.items=[];globalHardwareState.loaded=false;
    globalHardwareState.error=err.message||'Não foi possível carregar as Ferragens globais.';
  }finally{
    globalHardwareState.loading=false;refreshHardwarePresetSelect();
  }
}
function setHardwareScope(scope){
  hardwareScope=scope==='local'?'local':'global';
  localStorage.setItem(HARDWARE_SCOPE_KEY,hardwareScope);
  $('hardwareLocalTab')?.classList.toggle('active',hardwareScope==='local');
  $('hardwareGlobalTab')?.classList.toggle('active',hardwareScope==='global');
  refreshHardwarePresetSelect();
  if(hardwareScope==='global'&&!globalHardwareState.loaded&&!globalHardwareState.loading)loadGlobalHardwarePresets();
}
function objectBoundsMm(o){
  const u=o.userData;return {minX:mmPrec(o.position.x-u.width/2),maxX:mmPrec(o.position.x+u.width/2),minY:mmPrec(o.position.y-u.height/2),maxY:mmPrec(o.position.y+u.height/2),minZ:mmPrec(o.position.z-u.depth/2),maxZ:mmPrec(o.position.z+u.depth/2)};
}
function boundsAxisMin(b,a){return b[a==='x'?'minX':a==='y'?'minY':'minZ'];}
function boundsAxisMax(b,a){return b[a==='x'?'maxX':a==='y'?'maxY':'maxZ'];}
function tangentAxesForContact(a){return a==='x'?['y','z']:a==='y'?['x','z']:['x','y'];}
function contactAxisName(a){return a==='x'?'X · esquerda/direita':a==='y'?'Y · baixo/cima':'Z · trás/frente';}
function contactSideName(a,d){if(a==='x')return d<0?'esquerda':'direita';if(a==='y')return d<0?'baixo':'cima';return d<0?'trás':'frente';}
function overlapMm(a0,a1,b0,b1){return Math.min(a1,b1)-Math.max(a0,b0);}
function rawContactsForAxis(source,target,axis,tol){
  const sb=objectBoundsMm(source),tb=objectBoundsMm(target),[a1,a2]=tangentAxesForContact(axis);
  const ov1=overlapMm(boundsAxisMin(sb,a1),boundsAxisMax(sb,a1),boundsAxisMin(tb,a1),boundsAxisMax(tb,a1));
  const ov2=overlapMm(boundsAxisMin(sb,a2),boundsAxisMax(sb,a2),boundsAxisMin(tb,a2),boundsAxisMax(tb,a2));
  if(ov1<=.01||ov2<=.01)return [];
  const out=[];
  const gp=Math.abs(boundsAxisMax(sb,axis)-boundsAxisMin(tb,axis));
  const gn=Math.abs(boundsAxisMin(sb,axis)-boundsAxisMax(tb,axis));
  if(gp<=tol+.001)out.push({source,target,axis,dir:1,gap:gp,area:ov1*ov2});
  if(gn<=tol+.001)out.push({source,target,axis,dir:-1,gap:gn,area:ov1*ov2});
  return out;
}
function hardwareContacts(source,preset){
  if(!source)return [];
  const tol=Math.max(0,Math.min(20,Number(preset?.tolerance)||2));
  const candidates=objects.filter(o=>o!==source&&o.visible!==false&&o.userData?.kind!=='cylinder'&&(!source.userData?.spaceRootId||!o.userData?.spaceRootId||o.userData.spaceRootId===source.userData.spaceRootId));
  let found=[];
  const axes=preset?.contactAxis&&preset.contactAxis!=='auto'?[preset.contactAxis]:['x','y','z'];
  for(const o of candidates)for(const a of axes)found.push(...rawContactsForAxis(source,o,a,tol));
  if((preset?.contactAxis||'auto')==='auto'&&found.length){
    // v63: o eixo automático não pode ser escolhido só pela quantidade de
    // peças encostando. Portas/fundo podem somar mais contatos que as laterais,
    // embora os pontos configurados da ferragem não caibam neles. Simulamos os
    // pontos em cada eixo e priorizamos o eixo que realmente produz mais pontos
    // válidos para as peças que serão furadas.
    const score={x:{validPoints:0,validContacts:0,n:0,a:0},y:{validPoints:0,validContacts:0,n:0,a:0},z:{validPoints:0,validContacts:0,n:0,a:0}};
    for(const c of found){
      const sc=score[c.axis];sc.n++;sc.a+=c.area;
      let valid=0;
      for(const w of hardwarePointWorlds(source,c,preset)){
        const srcOk=!preset.sourceEnabled||pointWithinPieceTangents(source,w,c.axis,.02);
        const tgtOk=!preset.targetEnabled||pointWithinPieceTangents(c.target,w,c.axis,.02);
        if(srcOk&&tgtOk)valid++;
      }
      if(valid){sc.validContacts++;sc.validPoints+=valid;}
    }
    const chosen=['x','y','z'].sort((a,b)=>
      (score[b].validPoints-score[a].validPoints)||
      (score[b].validContacts-score[a].validContacts)||
      (score[b].a-score[a].a)||
      (score[b].n-score[a].n)
    )[0];
    found=found.filter(c=>c.axis===chosen);
  }
  const side=preset?.contactSide||'both';
  if(side==='negative')found=found.filter(c=>c.dir<0);else if(side==='positive')found=found.filter(c=>c.dir>0);
  const seen=new Set();return found.filter(c=>{const k=`${objects.indexOf(c.target)}|${c.axis}|${c.dir}`;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>a.dir-b.dir||a.gap-b.gap);
}
function anchoredWorldCoord(bounds,axis,anchor,offset){
  const lo=boundsAxisMin(bounds,axis),hi=boundsAxisMax(bounds,axis),base=anchor==='end'?hi:anchor==='center'?(lo+hi)/2:lo;return base+(Number(offset)||0);
}
function hardwarePointWorlds(source,contact,preset){
  const sb=objectBoundsMm(source),[a,b]=tangentAxesForContact(contact.axis);
  const wa=anchoredWorldCoord(sb,a,preset.aAnchor||'center',Number(preset.aOffset)||0);
  let bs=[];const mode=preset.bMode||'single';
  if(mode==='ends'){
    // Nunca deixe a distância das extremidades ultrapassar metade do vão.
    // Isso evita gerar dois pontos invertidos/fora da peça em contatos estreitos.
    const lo=boundsAxisMin(sb,b),hi=boundsAxisMax(sb,b),span=Math.max(0,hi-lo);
    const edge=Math.min(span/2,Math.max(0,Number(preset.bEdge)||0));
    bs=[lo+edge,hi-edge];if(Math.abs(bs[1]-bs[0])<.001)bs=[bs[0]];
  }else if(mode==='series'){
    const first=anchoredWorldCoord(sb,b,preset.bSeriesAnchor||'start',Number(preset.bSeriesOffset)||0),count=Math.max(1,Math.min(100,Math.round(Number(preset.bSeriesCount)||1))),step=Math.max(.001,Math.abs(Number(preset.bSeriesStep)||32)),dir=Number(preset.bSeriesDirection)<0?-1:1;for(let i=0;i<count;i++)bs.push(first+i*step*dir);
  }else bs=[anchoredWorldCoord(sb,b,preset.bAnchor||'center',Number(preset.bOffset)||0)];
  const normal=contact.dir>0?(boundsAxisMax(sb,contact.axis)+boundsAxisMin(objectBoundsMm(contact.target),contact.axis))/2:(boundsAxisMin(sb,contact.axis)+boundsAxisMax(objectBoundsMm(contact.target),contact.axis))/2;
  return bs.map(v=>{const p={x:0,y:0,z:0};p[contact.axis]=normal;p[a]=wa;p[b]=v;return p;});
}
function pointWithinPieceTangents(o,world,normalAxis,tol=.01){
  const b=objectBoundsMm(o);for(const a of tangentAxesForContact(normalAxis)){const v=world[a];if(v<boundsAxisMin(b,a)-tol||v>boundsAxisMax(b,a)+tol)return false;}return true;
}
function worldPointToLocalMm(o,p){const b=objectBoundsMm(o);return {x:p.x-b.minX,y:p.y-b.minY,z:p.z-b.minZ};}
function hardwareHoleOp(owner,world,entryAxis,cfg,meta,instanceId){
  const ti=pieceThicknessInfo(owner),local=worldPointToLocalMm(owner,world),da=entryAxisName(entryAxis),sign=entryAxisSign(entryAxis);
  local[da]=sign>0?0:ti.dims[da];
  const maxDepth=ti.dims[da],depth=Math.max(.1,Math.min(Number(cfg.depth)||.1,maxDepth));
  return {id:uid('mach'),type:'hole',entryAxis,coordRef:{...local},x:local.x,y:local.y,z:local.z,through:false,diameter:Math.max(.1,Number(cfg.diameter)||5),depth,seriesEnabled:false,seriesCount:1,seriesStep:32,seriesAxis:ti.uAxis,seriesDirection:1,allowAnyEntryAxis:true,hardwareInstanceId:instanceId,hardwarePresetId:meta.presetId,hardwareName:meta.name,hardwareRole:meta.role,hardwareContactName:meta.contactName,hardwareSourcePartId:meta.sourcePartId||null,hardwareContactPartId:meta.contactPartId||null};
}
function hardwarePlan(source,preset,{instanceId=uid('hwinst')}={}){
  if(!source||!preset)throw new Error('Selecione uma peça e uma ferragem');
  if(!preset.sourceEnabled&&!preset.targetEnabled)throw new Error('A ferragem precisa furar pelo menos uma das peças');
  const contacts=hardwareContacts(source,preset);if(!contacts.length)throw new Error('Nenhuma peça em contato encontrada para esta regra');
  const operations=[],used=[];
  for(const c of contacts){
    const pts=hardwarePointWorlds(source,c,preset);let validCount=0;
    for(const w of pts){
      const srcOk=!preset.sourceEnabled||pointWithinPieceTangents(source,w,c.axis,.02),tgtOk=!preset.targetEnabled||pointWithinPieceTangents(c.target,w,c.axis,.02);
      if(!srcOk||!tgtOk)continue;
      validCount++;
      if(preset.sourceEnabled){const entry=c.dir>0?`-${c.axis}`:`+${c.axis}`;operations.push({owner:source,op:hardwareHoleOp(source,w,entry,{diameter:preset.sourceDiameter,depth:preset.sourceDepth},{presetId:preset.id,name:preset.name,role:'selected',contactName:c.target.userData?.name||'Contato',sourcePartId:source.userData?.partId||null,contactPartId:c.target.userData?.partId||null},instanceId)});}
      if(preset.targetEnabled){const entry=c.dir>0?`+${c.axis}`:`-${c.axis}`;operations.push({owner:c.target,op:hardwareHoleOp(c.target,w,entry,{diameter:preset.targetDiameter,depth:preset.targetDepth},{presetId:preset.id,name:preset.name,role:'contact',contactName:source.userData?.name||'Origem',sourcePartId:source.userData?.partId||null,contactPartId:c.target.userData?.partId||null},instanceId)});}
    }
    if(validCount)used.push({...c,points:validCount});
  }
  if(!operations.length)throw new Error('Nenhum ponto válido para esta ferragem. No modo Automático, confira as distâncias; ou escolha manualmente o eixo de contato.');
  return {instanceId,contacts:used,operations};
}
function refreshHardwarePresetSelect(keep=''){
  const sel=$('hardwarePresetSelect');if(!sel)return;
  const local=hardwareScope==='local',list=currentHardwarePresets();
  $('hardwareLocalTab')?.classList.toggle('active',local);
  $('hardwareGlobalTab')?.classList.toggle('active',!local);
  sel.innerHTML='';
  const e=document.createElement('option');e.value='';
  if(!local&&globalHardwareState.loading)e.textContent='Carregando ferragens globais…';
  else if(!local&&globalHardwareState.error)e.textContent='Ferragens globais indisponíveis';
  else e.textContent=list.length?'Escolha uma ferragem…':(local?'Nenhuma ferragem criada':'Nenhuma ferragem global publicada');
  sel.appendChild(e);
  for(const p of list){const o=document.createElement('option');o.value=p.id;o.textContent=(local?'':'🌐 ')+p.name;sel.appendChild(o);}
  if(list.some(p=>p.id===keep))sel.value=keep;
  updateHardwarePanel();
}
function updateHardwarePanel(){
  const p=findHardwarePreset($('hardwarePresetSelect')?.value),del=$('deleteHardwarePreset'),edit=$('editHardwarePreset'),create=$('createHardwarePreset'),publish=$('publishHardwarePreset');
  const local=hardwareScope==='local',admin=adminAllowed();
  if(create){create.disabled=!local&&!admin;create.textContent=local?'＋ Nova ferragem':'＋ Nova ferragem global';}
  if(edit)edit.disabled=!p||(!local&&!admin);
  if(del)del.disabled=!p||(!local&&!admin);
  if(publish){publish.style.display=local&&admin&&p?'inline-flex':'none';publish.disabled=!p;}
  if($('hardwareScopeLabel'))$('hardwareScopeLabel').textContent=local?'Minhas ferragens':'Ferragens globais';
  if($('hardwareScopeHint'))$('hardwareScopeHint').textContent=local
    ?(admin?'Ferragens da sua conta. Selecione uma e use “Publicar selecionada para todos” para disponibilizar globalmente.':'Ferragens pessoais salvas na sua conta e sincronizadas entre seus aparelhos.')
    :(admin?'Ferragens oficiais: você pode criar, editar e excluir. Todos os usuários conectados enxergam esta lista.':'Ferragens oficiais publicadas pelo administrador. Você pode aplicar normalmente, mas somente o administrador altera a lista.');
  const info=$('hardwarePresetInfo'),sum=$('hardwareContactSummary'),applied=$('hardwareAppliedInfo');if(!info||!sum)return;
  if(!p){
    if(!local&&globalHardwareState.loading){info.textContent='Carregando Ferragens globais…';sum.textContent='Aguarde o carregamento.';}
    else if(!local&&globalHardwareState.error){info.textContent=globalHardwareState.error;sum.textContent='Confira sua conexão e a configuração da API.';}
    else {info.textContent=local?'Crie uma ferragem definindo contato, posição e os furos de cada lado da união.':'Escolha uma Ferragem global publicada pelo administrador.';sum.textContent='Selecione uma ferragem.';}
    if(applied)applied.textContent=hardwareSourceHistoryText(selected);return;
  }
  const contacts=hardwareContacts(selected,p),axis=contacts[0]?.axis||(p.contactAxis==='auto'?'automático':p.contactAxis),[a,b]=tangentAxesForContact(axis==='auto'?'x':axis);
  info.textContent=`${!local?'GLOBAL · ':''}${p.name} · contato ${p.contactAxis==='auto'?'automático':contactAxisName(p.contactAxis)} · ${p.sourceEnabled?'fura selecionada':''}${p.sourceEnabled&&p.targetEnabled?' + ':''}${p.targetEnabled?'fura contato':''}.`;
  sum.textContent=contacts.length?`${contacts.length} contato(s) encontrado(s): ${contacts.map(c=>`${c.target.userData?.name||'Peça'} (${contactSideName(c.axis,c.dir)}, ${c.points||hardwarePointWorlds(selected,c,p).length} ponto(s))`).join(' · ')}. Eixos de posição: ${axisLabel(a)} e ${axisLabel(b)}.`:'Nenhum contato compatível encontrado com a peça selecionada. Confira eixo, lado e tolerância.';
  if(applied)applied.textContent=hardwareSourceHistoryText(selected);
}
function hardwareBuilderAxis(){
  let a=$('hardwareContactAxis')?.value||'auto';if(a!=='auto')return a;const tmp={contactAxis:'auto',contactSide:$('hardwareContactSide')?.value||'both',tolerance:Number($('hardwareContactTolerance')?.value)||2};return hardwareContacts(selected,tmp)[0]?.axis||'x';
}
function updateHardwareBuilderUi(){
  const axis=hardwareBuilderAxis(),[a,b]=tangentAxesForContact(axis);$('hardwareAxisALabel').textContent=`Posição no eixo ${axisLabel(a)}`;$('hardwareAxisBLabel').textContent=`Pontos no eixo ${axisLabel(b)}`;
  const mode=$('hardwareBMode').value;$('hardwareBSingleFields').style.display=mode==='single'?'grid':'none';$('hardwareBEndsFields').style.display=mode==='ends'?'block':'none';$('hardwareBSeriesFields').style.display=mode==='series'?'block':'none';
  const src=$('hardwareSourceEnabled').checked,tgt=$('hardwareTargetEnabled').checked;for(const id of ['hardwareSourceDiameter','hardwareSourceDepth'])$(id).disabled=!src;for(const id of ['hardwareTargetDiameter','hardwareTargetDepth'])$(id).disabled=!tgt;
  const p=readHardwareBuilder(false);if(p){const side=p.contactSide==='both'?'ambos os lados':p.contactSide==='negative'?'lado −':'lado +';$('hardwareBuilderPreview').textContent=`${p.name||'Ferragem'} · contato ${p.contactAxis==='auto'?'automático':axisLabel(p.contactAxis)} · ${side} · ${p.bMode==='ends'?'2 pontos nas extremidades':p.bMode==='series'?`${p.bSeriesCount} pontos em série`:'1 ponto'} · ${p.sourceEnabled?`selecionada Ø${nice(p.sourceDiameter)} × ${nice(p.sourceDepth)} mm`:''}${p.sourceEnabled&&p.targetEnabled?' · ':''}${p.targetEnabled?`contato Ø${nice(p.targetDiameter)} × ${nice(p.targetDepth)} mm`:''}`;}
}
function decimalFrom(id,def=0){const n=parseDecimalInput($(id)?.value);return Number.isFinite(n)?n:def;}
function readHardwareBuilder(strict=true){
  const p={id:hardwareBuilderEditId||uid('hardware'),name:String($('hardwareName')?.value||'').trim(),contactAxis:$('hardwareContactAxis').value,contactSide:$('hardwareContactSide').value,tolerance:Number($('hardwareContactTolerance').value),aAnchor:$('hardwareAAnchor').value,aOffset:decimalFrom('hardwareAOffset',0),bMode:$('hardwareBMode').value,bAnchor:$('hardwareBAnchor').value,bOffset:decimalFrom('hardwareBOffset',0),bEdge:Number($('hardwareBEdge').value),bSeriesAnchor:$('hardwareBSeriesAnchor').value,bSeriesOffset:decimalFrom('hardwareBSeriesOffset',0),bSeriesCount:Number($('hardwareBSeriesCount').value),bSeriesStep:Number($('hardwareBSeriesStep').value),bSeriesDirection:Number($('hardwareBSeriesDirection').value)<0?-1:1,sourceEnabled:$('hardwareSourceEnabled').checked,sourceDiameter:Number($('hardwareSourceDiameter').value),sourceDepth:Number($('hardwareSourceDepth').value),targetEnabled:$('hardwareTargetEnabled').checked,targetDiameter:Number($('hardwareTargetDiameter').value),targetDepth:Number($('hardwareTargetDepth').value)};
  if(!strict)return p;if(!p.name)throw new Error('Digite um nome para a ferragem');if(!p.sourceEnabled&&!p.targetEnabled)throw new Error('Marque pelo menos uma peça para furar');if(!(p.tolerance>=0&&p.tolerance<=20))throw new Error('Confira a tolerância de contato');if(p.bMode==='ends'&&!(p.bEdge>=0))throw new Error('Confira a distância das extremidades');if(p.bMode==='series'&&(!(p.bSeriesCount>=1)||p.bSeriesCount>100||!(p.bSeriesStep>0)))throw new Error('Confira a série de pontos');for(const [on,d,dep,label] of [[p.sourceEnabled,p.sourceDiameter,p.sourceDepth,'peça selecionada'],[p.targetEnabled,p.targetDiameter,p.targetDepth,'peça de contato']])if(on&&(!(d>0)||!(dep>0)))throw new Error(`Confira diâmetro/profundidade da ${label}`);return p;
}
function openHardwareBuilder(existing=null){
  hardwareBuilderScope=hardwareScope;
  if(hardwareBuilderScope==='global'&&!adminAllowed()){toast('Somente o administrador pode criar ou editar Ferragens globais');return;}
  hardwareBuilderEditId=existing?.id||null;$('hardwareName').value=existing?.name||'Nova ferragem';$('hardwareContactAxis').value=existing?.contactAxis||'auto';$('hardwareContactSide').value=existing?.contactSide||'both';$('hardwareContactTolerance').value=existing?.tolerance??2;$('hardwareAAnchor').value=existing?.aAnchor||'center';$('hardwareAOffset').value=nice(existing?.aOffset??0);$('hardwareBMode').value=existing?.bMode||'single';$('hardwareBAnchor').value=existing?.bAnchor||'center';$('hardwareBOffset').value=nice(existing?.bOffset??50);$('hardwareBEdge').value=existing?.bEdge??50;$('hardwareBSeriesAnchor').value=existing?.bSeriesAnchor||'start';$('hardwareBSeriesOffset').value=nice(existing?.bSeriesOffset??50);$('hardwareBSeriesCount').value=existing?.bSeriesCount??2;$('hardwareBSeriesStep').value=existing?.bSeriesStep??100;$('hardwareBSeriesDirection').value=String(Number(existing?.bSeriesDirection)<0?-1:1);$('hardwareSourceEnabled').checked=!!existing?.sourceEnabled;$('hardwareSourceDiameter').value=existing?.sourceDiameter??8;$('hardwareSourceDepth').value=existing?.sourceDepth??20;$('hardwareTargetEnabled').checked=existing?.targetEnabled!==false;$('hardwareTargetDiameter').value=existing?.targetDiameter??5;$('hardwareTargetDepth').value=existing?.targetDepth??10;
  $('hardwareBuilderDialog').querySelector('h3').textContent=hardwareBuilderScope==='global'?'🌐 Criar / editar Ferragem global':'⚙ Criar ferragem';
  $('saveHardwareBuilder').textContent=hardwareBuilderScope==='global'?'Salvar para todos':'Salvar ferragem';
  updateHardwareBuilderUi();$('hardwareBuilderDialog').style.display='flex';
}
async function saveHardwareBuilder(){
  try{
    const p=readHardwareBuilder(true);
    if(hardwareBuilderScope==='global'){
      if(!adminAllowed())throw new Error('Somente o administrador pode salvar Ferragens globais.');
      let data;
      if(hardwareBuilderEditId){
        data=await cloudApiFetch(`/admin/hardware/global/${encodeURIComponent(hardwareBuilderEditId)}`,{method:'PUT',body:{preset:p},timeoutMs:20000});
      }else{
        data=await cloudApiFetch('/admin/hardware/global',{method:'POST',body:{preset:p},timeoutMs:20000});
      }
      $('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;
      await loadGlobalHardwarePresets({force:true});
      refreshHardwarePresetSelect(data?.item?.id||data?.preset?.id||'');
      toast('Ferragem global salva para todos');
      return;
    }
    const arr=getHardwarePresets(),i=arr.findIndex(x=>x.id===p.id);if(i>=0)arr[i]=p;else arr.push(p);setHardwarePresets(arr);
    $('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;refreshHardwarePresetSelect(p.id);toast('Ferragem salva');
  }catch(err){toast(err.message||'Não foi possível salvar a ferragem');}
}
async function publishSelectedHardwarePreset(){
  if(!adminAllowed()){toast('Somente o administrador pode publicar Ferragens globais');return;}
  const p=hardwareScope==='local'?findHardwarePreset($('hardwarePresetSelect')?.value):null;if(!p){toast('Selecione uma ferragem pessoal para publicar');return;}
  if(!window.confirm(`Publicar “${p.name}” para todas as contas?`))return;
  try{
    const data=await cloudApiFetch('/admin/hardware/global',{method:'POST',body:{preset:p},timeoutMs:20000});
    await loadGlobalHardwarePresets({force:true});setHardwareScope('global');refreshHardwarePresetSelect(data?.item?.id||'');toast('Ferragem publicada para todos');
  }catch(err){toast(err.message||'Não foi possível publicar a ferragem');}
}
function appliedHardwareStats(match){
  let operations=0,pieces=0,instances=new Set();
  for(const o of objects){
    const arr=Array.isArray(o.userData?.machining)?o.userData.machining:[];
    const hits=arr.filter(match);
    if(hits.length){pieces++;operations+=hits.length;for(const op of hits)if(op.hardwareInstanceId)instances.add(op.hardwareInstanceId);}
  }
  return {operations,pieces,instances};
}
function hardwareInstanceSummary(instanceId){
  let operations=0;const pieces=new Set();let name='Ferragem',presetId='',sourcePartId='';
  for(const o of objects){
    for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
      if(op?.hardwareInstanceId!==instanceId)continue;
      operations++;pieces.add(o);name=op.hardwareName||name;presetId=op.hardwarePresetId||presetId;sourcePartId=op.hardwareSourcePartId||sourcePartId;
    }
  }
  return {instanceId,operations,pieces:pieces.size,name,presetId,sourcePartId};
}
function hardwareSourceApplications(source){
  const partId=String(source?.userData?.partId||'');if(!partId)return [];
  const ids=new Set();
  for(const o of objects)for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
    if(op?.hardwareInstanceId&&String(op.hardwareSourcePartId||'')===partId)ids.add(op.hardwareInstanceId);
  }
  return [...ids].map(hardwareInstanceSummary).filter(x=>x.operations>0);
}
function hardwareSourceHistoryText(source){
  const list=hardwareSourceApplications(source);
  if(!list.length)return 'Nenhuma ferragem aplicada a partir desta peça.';
  return `Ferragens aplicadas a partir desta peça: ${list.map(x=>`${x.name} (${x.operations} furo(s) / ${x.pieces} peça(s))`).join(' · ')}`;
}
function hardwareInstancesForSourcePreset(source,presetId){
  const partId=String(source?.userData?.partId||'');const ids=new Set();if(!partId||!presetId)return ids;
  for(const o of objects)for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
    if(op?.hardwareInstanceId&&op.hardwarePresetId===presetId&&String(op.hardwareSourcePartId||'')===partId)ids.add(op.hardwareInstanceId);
  }
  return ids;
}
function refreshAfterHardwareRemoval(){
  clearMachiningDraftPreview();hardwarePreviewOps=[];machiningPreviewActive=false;machiningPreviewOwner=null;
  machiningVisualGroup.visible=true;$('machining3DPreviewBar').style.display='none';
  renderMachiningVisuals();renderMachiningList();updateInspector();updateHardwarePanel();
}
function removeAppliedHardware(match,{refresh=true}={}){
  let removed=0,pieces=0;
  for(const o of objects){
    const arr=Array.isArray(o.userData?.machining)?o.userData.machining:null;if(!arr)continue;
    const keep=arr.filter(op=>!match(op)),n=arr.length-keep.length;
    if(n){removed+=n;pieces++;o.userData.machining=keep;}
  }
  if(refresh)refreshAfterHardwareRemoval();
  return {removed,pieces};
}
function removeHardwareInstances(ids,{refresh=true}={}){
  const set=ids instanceof Set?ids:new Set(Array.isArray(ids)?ids:[ids]);
  return removeAppliedHardware(op=>op?.hardwareInstanceId&&set.has(op.hardwareInstanceId),{refresh});
}
function deleteHardwareInstance(instanceId,name='Ferragem'){
  const st=hardwareInstanceSummary(instanceId);if(!st.operations)return;
  if(!window.confirm(`Excluir a ferragem aplicada “${name||st.name}” inteira?

Serão removidas ${st.operations} furação(ões) de ${st.pieces} peça(s) vinculada(s) a esta aplicação.`))return;
  removeHardwareInstances(new Set([instanceId]),{refresh:true});
  commitHistory();toast(`${name||st.name} removida por completo`);
}

// 1.100.95 — ciclo de vida das ferragens.
// Uma aplicação de ferragem pode gerar furos em duas ou mais peças. Se uma
// dessas peças for apagada, toda a aplicação ligada a ela deve desaparecer,
// inclusive os marcadores 3D que pertencem às peças de contato.
function hardwareInstancesLinkedToObjects(doomed){
  const list=(Array.isArray(doomed)?doomed:[doomed]).filter(Boolean);
  const partIds=new Set(list.map(o=>String(o.userData?.partId||'')).filter(Boolean));
  const names=new Set(list.map(o=>String(o.userData?.name||'').trim()).filter(Boolean));
  const ids=new Set();

  for(const o of list){
    for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
      if(op?.hardwareInstanceId)ids.add(op.hardwareInstanceId);
    }
  }

  for(const o of objects){
    for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
      if(!op?.hardwareInstanceId)continue;
      const src=String(op.hardwareSourcePartId||''),contact=String(op.hardwareContactPartId||'');
      if((src&&partIds.has(src))||(contact&&partIds.has(contact))){ids.add(op.hardwareInstanceId);continue;}
      if(!src&&!contact&&names.has(String(op.hardwareContactName||'').trim()))ids.add(op.hardwareInstanceId);
    }
  }
  return ids;
}
function removeHardwareLinkedToObjects(doomed,{refresh=false}={}){
  const ids=hardwareInstancesLinkedToObjects(doomed);
  let operations=0,pieces=0;
  if(ids.size){
    const r=removeHardwareInstances(ids,{refresh:false});operations=r.removed;pieces=r.pieces;
  }
  clearMachiningDraftPreview();hardwarePreviewOps=[];machiningPreviewActive=false;machiningPreviewOwner=null;
  machiningVisualGroup.visible=true;$('machining3DPreviewBar').style.display='none';
  if(refresh)refreshAfterHardwareRemoval();
  return {instances:ids.size,operations,pieces};
}
async function deleteSelectedHardwarePreset(){
  const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(!p)return;
  if(hardwareScope==='global'){
    if(!adminAllowed()){toast('Somente o administrador pode excluir Ferragens globais');return;}
    if(!window.confirm(`Excluir a Ferragem global “${p.name}”?

Ela deixará de aparecer para todos. Ferragens já aplicadas em projetos existentes não serão alteradas.`))return;
    try{
      await cloudApiFetch(`/admin/hardware/global/${encodeURIComponent(p.id)}`,{method:'DELETE',body:{},timeoutMs:20000});
      await loadGlobalHardwarePresets({force:true});refreshHardwarePresetSelect();toast('Ferragem global excluída');
    }catch(err){toast(err.message||'Não foi possível excluir a Ferragem global');}
    return;
  }
  const st=appliedHardwareStats(op=>op.hardwarePresetId===p.id);
  const msg=st.operations
    ?`Excluir a ferragem “${p.name}”?

Ela está aplicada em ${st.pieces} peça(s), com ${st.operations} furação(ões). Ao excluir, essas furações também serão removidas do projeto e do desenho 3D.`
    :`Excluir a ferragem “${p.name}” da biblioteca?`;
  if(!window.confirm(msg))return;
  if(st.operations)removeAppliedHardware(op=>op.hardwarePresetId===p.id,{refresh:true});
  setHardwarePresets(getHardwarePresets().filter(x=>x.id!==p.id));refreshHardwarePresetSelect();commitHistory();
  toast(st.operations?`Ferragem excluída · ${st.operations} furação(ões) removida(s)`:'Ferragem excluída da biblioteca');
}
function renderHardwarePreviewOps(plan){
  clearMachiningDraftPreview();hardwarePreviewOps=plan.operations;
  for(const x of plan.operations){const mat=new THREE.MeshBasicMaterial({color:0xffc83d,transparent:true,opacity:.82,depthTest:false,depthWrite:false}),v=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,32),mat);v.userData={machiningOwner:x.owner,machiningOp:x.op,machiningPoint:null};v.renderOrder=100;machiningDraftPreviewGroup.add(v);}updateDraftPreviewTransforms();
}
function focusHardwarePlan(plan){
  const set=[...new Set(plan.operations.map(x=>x.owner))];if(!set.length)return;returnTo3D({restore:false,notify:false});const box=new THREE.Box3();for(const o of set){o.updateMatrixWorld(true);box.expandByObject(o);}const center=new THREE.Vector3(),size=new THREE.Vector3();box.getCenter(center);box.getSize(size);const span=Math.max(size.x,size.y,size.z,.3),dist=span*2.2;perspectiveCamera.position.set(center.x+dist*.7,center.y+dist*.55,center.z+dist*.85);controls.target.copy(center);perspectiveCamera.lookAt(center);controls.update();
}
function previewHardware3D(){try{const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(!p)throw new Error('Escolha uma ferragem');const plan=hardwarePlan(selected,p,{instanceId:'preview'});renderHardwarePreviewOps(plan);machiningPreviewOwner=selected;machiningPreviewActive=true;machiningVisualGroup.visible=false;$('machiningDialog').style.display='none';$('machining3DPreviewBar').style.display='flex';$('machining3DPreviewInfo').textContent=`${p.name} · ${plan.contacts.length} contato(s) · ${plan.operations.length} furação(ões) · ainda não salvo`;focusHardwarePlan(plan);toast('Prévia 3D · amarelo = furos da ferragem');}catch(err){clearMachiningDraftPreview();machiningVisualGroup.visible=true;toast(err.message||'Não foi possível visualizar a ferragem');}}
function applySelectedHardware(){
  clearMachiningDraftPreview();machiningVisualGroup.visible=true;$('machining3DPreviewBar').style.display='none';
  try{
    const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(!p)throw new Error('Escolha uma ferragem');
    const oldIds=hardwareInstancesForSourcePreset(selected,p.id);
    const plan=hardwarePlan(selected,p);
    if(oldIds.size)removeHardwareInstances(oldIds,{refresh:false});
    for(const x of plan.operations){const arr=x.owner.userData.machining||(x.owner.userData.machining=[]);arr.push(x.op);sanitizeMachiningForPiece(x.owner);}
    renderMachiningVisuals();updateInspector();commitHistory();updateHardwarePanel();renderMachiningList();
    toast(`${p.name} ${oldIds.size?'atualizada':'aplicada'} · ${plan.operations.length} furação(ões)`);
  }catch(err){toast(err.message||'Não foi possível aplicar a ferragem');}
}
function fillHardwareShelfPinExample(){hardwareBuilderEditId=null;$('hardwareName').value='Pino de prateleira';$('hardwareContactAxis').value='x';$('hardwareContactSide').value='both';$('hardwareContactTolerance').value=2;$('hardwareAAnchor').value='start';$('hardwareAOffset').value='-5';$('hardwareBMode').value='ends';$('hardwareBEdge').value=50;$('hardwareSourceEnabled').checked=false;$('hardwareTargetEnabled').checked=true;$('hardwareTargetDiameter').value=5;$('hardwareTargetDepth').value=10;updateHardwareBuilderUi();}
function fillHardwareDowelExample(){hardwareBuilderEditId=null;$('hardwareName').value='Cavilha base/lateral';$('hardwareContactAxis').value='x';$('hardwareContactSide').value='both';$('hardwareContactTolerance').value=2;$('hardwareAAnchor').value='center';$('hardwareAOffset').value='0';$('hardwareBMode').value='ends';$('hardwareBEdge').value=50;$('hardwareSourceEnabled').checked=true;$('hardwareSourceDiameter').value=8;$('hardwareSourceDepth').value=20;$('hardwareTargetEnabled').checked=true;$('hardwareTargetDiameter').value=8;$('hardwareTargetDepth').value=15;updateHardwareBuilderUi();}

const MACHINING_PRESET_KEY='miniCadProV50_machiningPresets';
const BUILTIN_MACHINING_PRESETS=[
  {id:'builtin-hinge35-left-bottom',locked:true,type:'hole',name:'Dobradiça Ø35 · esq. / inferior',data:{entrySide:1,coords:{x:22.5,y:100,z:0},diameter:35,depth:12,through:false,seriesEnabled:false}},
  {id:'builtin-hinge35-left-top',locked:true,type:'hole',name:'Dobradiça Ø35 · esq. / superior',data:{entrySide:1,coords:{x:22.5,y:-100,z:0},diameter:35,depth:12,through:false,seriesEnabled:false}},
  {id:'builtin-hinge35-right-bottom',locked:true,type:'hole',name:'Dobradiça Ø35 · dir. / inferior',data:{entrySide:1,coords:{x:-22.5,y:100,z:0},diameter:35,depth:12,through:false,seriesEnabled:false}},
  {id:'builtin-hinge35-right-top',locked:true,type:'hole',name:'Dobradiça Ø35 · dir. / superior',data:{entrySide:1,coords:{x:-22.5,y:-100,z:0},diameter:35,depth:12,through:false,seriesEnabled:false}},
  {id:'builtin-system32',locked:true,type:'hole',name:'Sistema 32 · Ø5 / passo 32 / 37 frente',special:'system32'},
  {id:'builtin-back-groove',locked:true,type:'groove',name:'Rasgo fundo · 6 × 8 / 10 traseira',special:'backGroove'}
];
function getUserMachiningPresets(){
  try{const a=JSON.parse(localStorage.getItem(MACHINING_PRESET_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name&&['hole','groove'].includes(x.type)):[];}catch(_){return [];}
}
function setUserMachiningPresets(a){localStorage.setItem(MACHINING_PRESET_KEY,JSON.stringify(a));}
function allMachiningPresets(type=machiningType){return [...BUILTIN_MACHINING_PRESETS,...getUserMachiningPresets()].filter(x=>x.type===type);}
function refreshMachiningPresetSelect(keep=''){
  const sel=$('machiningPresetSelect'); if(!sel)return; const list=allMachiningPresets(); sel.innerHTML='';
  const empty=document.createElement('option');empty.value='';empty.textContent='Escolha uma usinagem pronta…';sel.appendChild(empty);
  for(const p of list){const o=document.createElement('option');o.value=p.id;o.textContent=`${p.locked?'★ ':'☆ '}${p.name}`;sel.appendChild(o);}
  if(list.some(p=>p.id===keep))sel.value=keep; else sel.value='';
  updateMachiningPresetInfo();
}
function findMachiningPreset(id){return [...BUILTIN_MACHINING_PRESETS,...getUserMachiningPresets()].find(x=>x.id===id)||null;}
function updateMachiningPresetInfo(){
  const id=$('machiningPresetSelect')?.value,p=findMachiningPreset(id),btn=$('deleteMachiningPreset');
  if(btn)btn.disabled=!p||!!p.locked;
  if(!$('machiningPresetInfo'))return;
  $('machiningPresetInfo').textContent=!p?'Selecione um preset para preencher a usinagem. Você pode salvar novos presets e ir montando sua biblioteca.':p.locked?`Preset pronto: ${p.name}. As medidas são preenchidas automaticamente e ainda podem ser ajustadas.`:`Preset salvo por você: ${p.name}. Pode aplicar, alterar e salvar como uma nova usinagem.`;
}
function captureMachiningPresetData(){
  const ti=pieceThicknessInfo(selected); if(!ti)throw new Error('Selecione uma peça retangular');
  const side=entryAxisSign($('machiningFace').value)<0?-1:1;
  const data={entrySide:side,coords:{x:machiningFieldNumber('machiningX'),y:machiningFieldNumber('machiningY'),z:machiningFieldNumber('machiningZ')},through:$('machiningThrough').checked};
  if(!Object.values(data.coords).every(Number.isFinite))throw new Error('Confira X, Y e Z');
  if(machiningType==='hole')Object.assign(data,{diameter:Number($('machiningDiameter').value),depth:Number($('machiningDepthHole').value),seriesEnabled:$('machiningSeries').checked,seriesCount:Number($('machiningSeriesCount').value),seriesStep:Number($('machiningSeriesStep').value),seriesAxis:$('machiningSeriesAxis').value,seriesDirection:Number($('machiningSeriesDirection').value)<0?-1:1});
  else {const fullLength=grooveLengthIsFull();Object.assign(data,{lengthAxis:$('machiningLengthAxis').value,fullLength,length:fullLength?null:parseDecimalInput($('machiningLength').value),width:Number($('machiningWidth').value),depth:Number($('machiningDepthGroove').value),backGroove:$('machiningBackGroove').checked,rearOffset:Number($('machiningRearOffset').value)});}
  return data;
}
function applyMachiningPresetData(p){
  if(!selected||!p)return; const ti=pieceThicknessInfo(selected); if(!ti)return;
  setMachiningType(p.type,false); populateMachiningFaceOptions(); populateMachiningLengthAxes();
  if(p.special==='system32'){applyHole32Preset();refreshMachiningPresetSelect(p.id);return;}
  if(p.special==='backGroove'){applyBackGroovePreset();refreshMachiningPresetSelect(p.id);return;}
  const d=p.data||{},side=Number(d.entrySide)<0?-1:1;
  populateMachiningFaceOptions(`${side<0?'-':'+'}${ti.thicknessAxis}`);
  $('machiningFace').value=`${side<0?'-':'+'}${ti.thicknessAxis}`;
  for(const a of ['x','y','z'])if(a!==ti.thicknessAxis&&Number.isFinite(Number(d.coords?.[a])))localCoordField(a).value=roundMmNumber(Number(d.coords[a]),3);
  setMachiningSurfaceCoordinate(); $('machiningThrough').checked=!!d.through;
  if(p.type==='hole'){
    $('machiningDiameter').value=roundMmNumber(Number(d.diameter)||5,3); $('machiningDepthHole').value=roundMmNumber(Number(d.depth)||Math.min(8,ti.thickness),3);
    $('machiningSeries').checked=!!d.seriesEnabled; $('machiningSeriesCount').value=Math.max(1,Math.round(Number(d.seriesCount)||1)); $('machiningSeriesStep').value=roundMmNumber(Number(d.seriesStep)||32,3);
    populateMachiningSeriesAxes(d.seriesAxis); if([ti.uAxis,ti.vAxis].includes(d.seriesAxis))$('machiningSeriesAxis').value=d.seriesAxis; $('machiningSeriesDirection').value=String(Number(d.seriesDirection)<0?-1:1);
  }else{
    populateMachiningLengthAxes(d.lengthAxis); if([ti.uAxis,ti.vAxis].includes(d.lengthAxis))$('machiningLengthAxis').value=d.lengthAxis;
    $('machiningLength').value=d.fullLength?'X':roundMmNumber(Number(d.length)||Math.min(300,ti.faceW),3); syncGrooveLengthButton(); $('machiningWidth').value=roundMmNumber(Number(d.width)||6,3); $('machiningDepthGroove').value=roundMmNumber(Number(d.depth)||Math.min(6,ti.thickness),3);
    $('machiningBackGroove').checked=!!d.backGroove; $('machiningRearOffset').value=roundMmNumber(Number(d.rearOffset)||10,3);
  }
  updateHoleSeriesVisibility();updateBackGrooveVisibility();updateMachiningUI();refreshMachiningPresetSelect(p.id);
}
function applySelectedMachiningPreset(){const p=findMachiningPreset($('machiningPresetSelect')?.value);if(p)applyMachiningPresetData(p);}
function saveCurrentMachiningPreset(){
  try{const name=(window.prompt('Nome da usinagem pronta:')||'').trim();if(!name)return;const data=captureMachiningPresetData(),arr=getUserMachiningPresets(),item={id:uid('preset'),name,type:machiningType,data};arr.push(item);setUserMachiningPresets(arr);refreshMachiningPresetSelect(item.id);toast('Usinagem pronta salva');}catch(err){toast(err.message||'Não foi possível salvar o preset');}
}
function deleteSelectedMachiningPreset(){
  const id=$('machiningPresetSelect')?.value,p=findMachiningPreset(id);if(!p||p.locked)return;if(!window.confirm(`Excluir o preset “${p.name}”?`))return;
  setUserMachiningPresets(getUserMachiningPresets().filter(x=>x.id!==id));refreshMachiningPresetSelect();toast('Preset excluído');
}
function populateMachiningSeriesAxes(keep=null){
  if(!selected)return; const ti=pieceThicknessInfo(selected),sel=$('machiningSeriesAxis'); if(!ti||!sel)return; sel.innerHTML='';
  for(const a of [ti.uAxis,ti.vAxis]){const el=document.createElement('option');el.value=a;el.textContent=`Eixo ${axisLabel(a)} · ${nice(ti.dims[a])} mm`;sel.appendChild(el);}
  sel.value=[ti.uAxis,ti.vAxis].includes(keep)?keep:ti.uAxis;
}
function holeSeriesInstances(o,op){
  const ti=pieceThicknessInfo(o); if(!ti)return [];
  const base=resolvedMachiningCoords(o,op);
  const enabled=!!op.seriesEnabled && Math.max(1,Math.round(Number(op.seriesCount)||1))>1;
  if(!enabled)return [{...base,index:1,count:1}];
  const axis=[ti.uAxis,ti.vAxis].includes(op.seriesAxis)?op.seriesAxis:ti.uAxis;
  const count=Math.max(1,Math.min(999,Math.round(Number(op.seriesCount)||1)));
  const step=Math.max(.1,Math.abs(Number(op.seriesStep)||32));
  const dir=Number(op.seriesDirection)<0?-1:1;
  const out=[];
  for(let i=0;i<count;i++){const p={...base};p[axis]+=i*step*dir;out.push({...p,index:i+1,count});}
  return out;
}
function actualMachiningCount(part){
  return (part.machining||[]).reduce((n,op)=>n+(op.type==='hole'?holeSeriesInstances(part.object,op).length:1),0);
}
function updateHoleSeriesVisibility(){
  const on=machiningType==='hole'&&$('machiningSeries').checked;
  $('machiningSeriesFields').style.display=on?'block':'none';
}
function updateBackGrooveVisibility(){
  const on=machiningType==='groove'&&$('machiningBackGroove').checked;
  $('machiningBackGrooveFields').style.display=on?'grid':'none';
  const locked=['machiningLength','machiningLengthAxis','machiningLengthFull'];
  for(const id of locked)$(id).disabled=on;
  syncGrooveLengthButton();
}
function applyHole32Preset(){
  if(!selected)return; const ti=pieceThicknessInfo(selected); if(!ti)return;
  if(![ti.uAxis,ti.vAxis].includes('z')){toast('Nesta orientação, Z é a espessura; use a série manual');return;}
  const seriesAxis=[ti.uAxis,ti.vAxis].find(a=>a!=='z');
  $('machiningSeries').checked=true; populateMachiningSeriesAxes(seriesAxis); $('machiningSeriesAxis').value=seriesAxis;
  $('machiningSeriesCount').value=10; $('machiningSeriesStep').value=32; $('machiningSeriesDirection').value='1'; $('machiningDiameter').value=5;
  // 37 mm da frente: frente = Z máximo; valor é o centro do furo.
  $('machiningZ').value=-37;
  updateHoleSeriesVisibility(); updateMachiningUI();
}
function applyBackGroovePreset(){
  if(!selected)return; const ti=pieceThicknessInfo(selected); if(!ti)return;
  if(![ti.uAxis,ti.vAxis].includes('z')){toast('Rasgo de fundo automático exige o eixo Z na face da peça');return;}
  $('machiningBackGroove').checked=true; $('machiningRearOffset').value=10; $('machiningWidth').value=6; $('machiningDepthGroove').value=Math.min(8,ti.thickness).toFixed(1);
  updateBackGrooveVisibility(); updateMachiningUI();
}
function operationDepthMm(o,op){ const ti=pieceThicknessInfo(o); if(op?.through){const da=entryAxisName(op.entryAxis);return (op.allowAnyEntryAxis&&ti?.dims?.[da])?ti.dims[da]:(ti?.thickness||Number(op.depth)||0);} return Number(op?.depth)||0; }
function remapMachiningAxes(u,a,b){
  for(const op of (u.machining||[])){
    const av=op[a],bv=op[b]; op[a]=bv; op[b]=av;
    if(op.coordRef&&typeof op.coordRef==='object'){
      const ar=op.coordRef[a],br=op.coordRef[b];op.coordRef[a]=br;op.coordRef[b]=ar;
    }
    const e=entryAxisName(op.entryAxis),sgn=entryAxisSign(op.entryAxis)<0?'-':'+';
    if(e===a)op.entryAxis=sgn+b; else if(e===b)op.entryAxis=sgn+a;
    if(op.lengthAxis===a)op.lengthAxis=b; else if(op.lengthAxis===b)op.lengthAxis=a;
    if(op.seriesAxis===a)op.seriesAxis=b; else if(op.seriesAxis===b)op.seriesAxis=a;
  }
}
function sanitizeMachiningForPiece(o){
  if(!o || !Array.isArray(o.userData?.machining))return;
  const ti=pieceThicknessInfo(o); if(!ti)return;
  for(const op of o.userData.machining){
    op.coordRef=op.coordRef&&typeof op.coordRef==='object'?op.coordRef:{};
    for(const a of ['x','y','z'])if(!Number.isFinite(Number(op.coordRef[a])))op.coordRef[a]=Number.isFinite(Number(op[a]))?Number(op[a]):0;
    let da=entryAxisName(op.entryAxis); if(!op.allowAnyEntryAxis && da!==ti.thicknessAxis) op.entryAxis=`-${ti.thicknessAxis}`;
    da=entryAxisName(op.entryAxis); if(!['x','y','z'].includes(da)){da=ti.thicknessAxis;op.entryAxis=`-${da}`;} const sign=entryAxisSign(op.entryAxis),dims=ti.dims;
    const maxEntryDepth=op.allowAnyEntryAxis?dims[da]:ti.thickness;
    if(op.through)op.depth=maxEntryDepth;
    op.depth=Math.max(.1,Math.min(Number(op.depth)||.1,maxEntryDepth));
    if(op.type==='hole'){
      op.diameter=Math.max(.1,Number(op.diameter)||5); const r=op.diameter/2;
      op.seriesEnabled=!!op.seriesEnabled;op.seriesCount=Math.max(1,Math.min(999,Math.round(Number(op.seriesCount)||1)));op.seriesStep=Math.max(.1,Math.abs(Number(op.seriesStep)||32));
      if(![ti.uAxis,ti.vAxis].includes(op.seriesAxis))op.seriesAxis=ti.uAxis;op.seriesDirection=Number(op.seriesDirection)<0?-1:1;
      const rc=resolvedMachiningCoords(o,op); for(const a of ['x','y','z'])op[a]=rc[a]; op[da]=sign>0?0:dims[da];
      const planeAxes=op.allowAnyEntryAxis?['x','y','z'].filter(a=>a!==da):[ti.uAxis,ti.vAxis];
      for(const a of planeAxes)op[a]=Math.max(r,Math.min(op[a],dims[a]-r));
    }else if(op.type==='groove'){
      if(op.preset==='back-groove' && [ti.uAxis,ti.vAxis].includes('z')){
        op.autoLength=true;op.rearOffset=Math.max(0,Number(op.rearOffset)||0);op.lengthAxis=[ti.uAxis,ti.vAxis].find(a=>a!=='z')||ti.uAxis;op.length=dims[op.lengthAxis];
        op.coordRef[op.lengthAxis]=0;op.coordRef.z=op.rearOffset;
      }
      if(![ti.uAxis,ti.vAxis].includes(op.lengthAxis))op.lengthAxis=ti.uAxis;
      if(op.fullLength){op.length=dims[op.lengthAxis];op.coordRef[op.lengthAxis]=0;}
      const wa=op.lengthAxis===ti.uAxis?ti.vAxis:ti.uAxis;
      op.length=Math.max(.1,Math.min(Number(op.length)||100,dims[op.lengthAxis]));op.width=Math.max(.1,Math.min(Number(op.width)||6,dims[wa]));
      const rc=resolvedMachiningCoords(o,op);for(const a of ['x','y','z'])op[a]=rc[a];op[da]=sign>0?0:dims[da];
      op[op.lengthAxis]=Math.max(0,Math.min(op[op.lengthAxis],dims[op.lengthAxis]-op.length));op[wa]=Math.max(0,Math.min(op[wa],dims[wa]-op.width));
    }
  }
}
function clearMachiningVisuals(){
  while(machiningVisualGroup.children.length){
    const v=machiningVisualGroup.children[0]; machiningVisualGroup.remove(v);
    v.geometry?.dispose?.();
    if(Array.isArray(v.material))v.material.forEach(m=>m?.dispose?.()); else v.material?.dispose?.();
  }
}
function renderMachiningVisuals(){
  clearMachiningVisuals();
  for(const owner of objects){
    if(owner.userData?.kind==='cylinder')continue;
    sanitizeMachiningForPiece(owner);
    for(const op of (owner.userData?.machining||[])){
      const points=op.type==='hole'?holeSeriesInstances(owner,op):[null];
      for(const point of points){
        let v;
        if(op.type==='hole'){
          const mat=new THREE.MeshBasicMaterial({color:0xff2ea6,transparent:true,opacity:.68,depthTest:false,depthWrite:false});
          v=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,28),mat);
        }else{
          const mat=new THREE.MeshBasicMaterial({color:0x00e5ff,transparent:true,opacity:.48,depthTest:false,depthWrite:false});
          v=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
        }
        v.userData={machiningOwner:owner,machiningOp:op,machiningPoint:point}; v.renderOrder=88; machiningVisualGroup.add(v);
      }
    }
  }
  updateMachiningVisualTransforms();
  machiningVisualGroup.visible=!visualMode;
}
function updateMachiningVisualTransforms(){
  for(const v of machiningVisualGroup.children){
    const o=v.userData.machiningOwner,op=v.userData.machiningOp;
    if(!o || !objects.includes(o) || !op){v.visible=false;continue;} v.visible=o.visible!==false;
    const u=o.userData,ti=pieceThicknessInfo(o); if(!ti)continue;
    const dims=ti.dims, da=entryAxisName(op.entryAxis), sign=entryAxisSign(op.entryAxis), depth=operationDepthMm(o,op);
    const point=v.userData.machiningPoint; const lc=point?{x:Number(point.x)||0,y:Number(point.y)||0,z:Number(point.z)||0}:resolvedMachiningCoords(o,op);
    lc[da]=sign>0?depth/2:dims[da]-depth/2;
    if(op.type==='hole'){
      const d=Math.max(.1,Number(op.diameter)||5); v.scale.set(m(d),m(depth),m(d)); v.rotation.set(0,0,0);
      if(da==='x')v.rotation.z=-Math.PI/2; else if(da==='z')v.rotation.x=Math.PI/2;
    }else{
      const la=op.lengthAxis, wa=la===ti.uAxis?ti.vAxis:ti.uAxis;
      lc[la]=(Number(op[la])||0)+(Number(op.length)||0)/2;
      lc[wa]=(Number(op[wa])||0)+(Number(op.width)||0)/2;
      const size={x:.001,y:.001,z:.001}; size[da]=m(depth); size[la]=m(Number(op.length)||.1); size[wa]=m(Number(op.width)||.1);
      v.scale.set(size.x,size.y,size.z); v.rotation.set(0,0,0);
    }
    const min={x:o.position.x-u.width/2,y:o.position.y-u.height/2,z:o.position.z-u.depth/2};
    v.position.set(min.x+m(lc.x),min.y+m(lc.y),min.z+m(lc.z));
  }
}
function clearMachiningDraftPreview(){
  while(machiningDraftPreviewGroup.children.length){
    const v=machiningDraftPreviewGroup.children[0]; machiningDraftPreviewGroup.remove(v);
    v.geometry?.dispose?.();
    if(Array.isArray(v.material))v.material.forEach(m=>m?.dispose?.()); else v.material?.dispose?.();
  }
}
function updateDraftPreviewTransforms(){
  for(const v of machiningDraftPreviewGroup.children){
    const o=v.userData.machiningOwner,op=v.userData.machiningOp;
    if(!o || !objects.includes(o) || !op){v.visible=false;continue;}
    v.visible=o.visible!==false;
    const u=o.userData,ti=pieceThicknessInfo(o); if(!ti)continue;
    const dims=ti.dims, da=entryAxisName(op.entryAxis), sign=entryAxisSign(op.entryAxis), depth=operationDepthMm(o,op);
    const point=v.userData.machiningPoint; const lc=point?{x:Number(point.x)||0,y:Number(point.y)||0,z:Number(point.z)||0}:resolvedMachiningCoords(o,op);
    lc[da]=sign>0?depth/2:dims[da]-depth/2;
    if(op.type==='hole'){
      const d=Math.max(.1,Number(op.diameter)||5); v.scale.set(m(d),m(depth),m(d)); v.rotation.set(0,0,0);
      if(da==='x')v.rotation.z=-Math.PI/2; else if(da==='z')v.rotation.x=Math.PI/2;
    }else{
      const la=op.lengthAxis, wa=la===ti.uAxis?ti.vAxis:ti.uAxis;
      lc[la]=(Number(op[la])||0)+(Number(op.length)||0)/2;
      lc[wa]=(Number(op[wa])||0)+(Number(op.width)||0)/2;
      const size={x:.001,y:.001,z:.001}; size[da]=m(depth); size[la]=m(Number(op.length)||.1); size[wa]=m(Number(op.width)||.1);
      v.scale.set(size.x,size.y,size.z); v.rotation.set(0,0,0);
    }
    const min={x:o.position.x-u.width/2,y:o.position.y-u.height/2,z:o.position.z-u.depth/2};
    v.position.set(min.x+m(lc.x),min.y+m(lc.y),min.z+m(lc.z));
  }
}
function renderMachiningDraftPreview(owner,op){
  clearMachiningDraftPreview();
  const points=op.type==='hole'?holeSeriesInstances(owner,op):[null];
  for(const point of points){
    let v;
    if(op.type==='hole'){
      const mat=new THREE.MeshBasicMaterial({color:0x70ff86,transparent:true,opacity:.82,depthTest:false,depthWrite:false});
      v=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,32),mat);
    }else{
      const mat=new THREE.MeshBasicMaterial({color:0x70ff86,transparent:true,opacity:.62,depthTest:false,depthWrite:false});
      v=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
    }
    v.userData={machiningOwner:owner,machiningOp:op,machiningPoint:point};
    v.renderOrder=99; machiningDraftPreviewGroup.add(v);
  }
  updateDraftPreviewTransforms();
}
function focusPieceForMachiningPreview(o){
  if(!o)return;
  returnTo3D({restore:false,notify:false});
  const u=o.userData,center=o.position.clone(),span=Math.max(u.width||.1,u.height||.1,u.depth||.1);
  const dist=Math.max(.45,span*2.15);
  perspectiveCamera.up.set(0,1,0);
  perspectiveCamera.position.set(center.x+dist*.65,center.y+dist*.48,center.z+dist*.82);
  controls.target.copy(center); perspectiveCamera.lookAt(center); controls.update();
}
function showMachining3DPreview(){
  try{
    const owner=selected,op=machiningDraft();
    if(!owner)throw new Error('Selecione uma peça');
    machiningPreviewOwner=owner; machiningPreviewActive=true;
    renderMachiningDraftPreview(owner,op);
    machiningVisualGroup.visible=false;
    $('machiningDialog').style.display='none';
    $('machining3DPreviewBar').style.display='flex';
    const qty=op.type==='hole'?holeSeriesInstances(owner,op).length:1;
    $('machining3DPreviewInfo').textContent=op.type==='hole'
      ?`${qty>1?qty+' furos':'Furo'} Ø ${nice(op.diameter)} mm · prof. ${nice(operationDepthMm(owner,op))} mm · ainda não salvo`
      :`Rasgo ${nice(op.length)} × ${nice(op.width)} mm · prof. ${nice(operationDepthMm(owner,op))} mm · ainda não salvo`;
    focusPieceForMachiningPreview(owner);
    toast('Prévia 3D · verde = volume da usinagem');
  }catch(err){
    clearMachiningDraftPreview(); machiningPreviewActive=false; machiningVisualGroup.visible=true;
    toast(err.message||'Não foi possível visualizar a usinagem');
  }
}
function closeMachining3DPreview({reopen=true}={}){
  clearMachiningDraftPreview(); hardwarePreviewOps=[];
  machiningPreviewActive=false; machiningVisualGroup.visible=true;
  $('machining3DPreviewBar').style.display='none';
  if(machiningPreviewOwner&&objects.includes(machiningPreviewOwner))selectObject(machiningPreviewOwner);
  machiningPreviewOwner=null; hardwarePreviewOps=[];
  if(reopen)$('machiningDialog').style.display='flex';
}
function setMachiningType(type,reset=false){
  machiningType=type==='groove'?'groove':type==='hardware'?'hardware':'hole';
  document.querySelectorAll('[data-machining-type]').forEach(b=>b.classList.toggle('active',b.dataset.machiningType===machiningType));
  const hardware=machiningType==='hardware';
  $('machiningStandardArea').style.display=hardware?'none':'block';
  $('hardwarePanel').style.display=hardware?'block':'none';
  $('machiningHoleFields').style.display=!hardware&&machiningType==='hole'?'block':'none';
  $('machiningGrooveFields').style.display=!hardware&&machiningType==='groove'?'block':'none';
  $('machiningLengthAxisLabel').style.display=!hardware&&machiningType==='groove'?'block':'none';
  if(hardware){refreshHardwarePresetSelect();renderMachiningList();return;}
  if(reset) setDefaultMachiningValues();
  updateHoleSeriesVisibility(); updateBackGrooveVisibility();
  refreshMachiningPresetSelect();
  updateMachiningUI();
}
function populateMachiningFaceOptions(keep=null){
  if(!selected)return; const opts=machiningFaceOptions(selected),sel=$('machiningFace'); sel.innerHTML='';
  for(const o of opts){const el=document.createElement('option');el.value=o.value;el.textContent=o.label;sel.appendChild(el);}
  const preferred=opts.some(o=>o.value===keep)?keep:opts.at(-1)?.value; if(preferred)sel.value=preferred;
  populateMachiningLengthAxes(); setMachiningSurfaceCoordinate();
}
function populateMachiningLengthAxes(keep=null){
  if(!selected)return; const ti=pieceThicknessInfo(selected),sel=$('machiningLengthAxis'); if(!ti)return; sel.innerHTML='';
  for(const a of [ti.uAxis,ti.vAxis]){const el=document.createElement('option');el.value=a;el.textContent=`Eixo ${axisLabel(a)} · ${nice(ti.dims[a])} mm`;sel.appendChild(el);}
  sel.value=[ti.uAxis,ti.vAxis].includes(keep)?keep:ti.uAxis;
  populateMachiningSeriesAxes();
}
function setMachiningSurfaceCoordinate(){
  if(!selected)return; const ti=pieceThicknessInfo(selected),face=$('machiningFace').value;if(!ti||!face)return;
  const a=entryAxisName(face),sign=entryAxisSign(face); localCoordField(a).value=sign>0?0:ti.dims[a];
}
function setDefaultMachiningValues(){
  if(!selected)return; const ti=pieceThicknessInfo(selected);if(!ti)return;
  populateMachiningFaceOptions(`-${ti.thicknessAxis}`);
  $('machiningX').value=(ti.dims.x/2).toFixed(1); $('machiningY').value=(ti.dims.y/2).toFixed(1); $('machiningZ').value=(ti.dims.z/2).toFixed(1); setMachiningSurfaceCoordinate();
  $('machiningDiameter').value=5; $('machiningDepthHole').value=Math.min(8,ti.thickness).toFixed(1);
  $('machiningSeries').checked=false; $('machiningSeriesCount').value=10; $('machiningSeriesStep').value=32; $('machiningSeriesDirection').value='1'; populateMachiningSeriesAxes(ti.uAxis);
  const long=Math.min(300,Math.max(10,ti.dims[ti.uAxis]*.55)); $('machiningLength').value=long.toFixed(1); syncGrooveLengthButton(); $('machiningWidth').value=Math.min(6,ti.dims[ti.vAxis]).toFixed(1); $('machiningDepthGroove').value=Math.min(6,ti.thickness).toFixed(1);
  $('machiningBackGroove').checked=false; $('machiningRearOffset').value=10;
  $('machiningLengthAxis').value=ti.uAxis; $('machiningThrough').checked=false; updateHoleSeriesVisibility(); updateBackGrooveVisibility();
  if(machiningType==='groove'){
    const wa=ti.vAxis; localCoordField(ti.uAxis).value=Math.max(0,(ti.dims[ti.uAxis]-long)/2).toFixed(1); localCoordField(wa).value=Math.max(0,(ti.dims[wa]-Number($('machiningWidth').value))/2).toFixed(1); setMachiningSurfaceCoordinate();
  }
}
function machiningDraft(){
  if(!selected)throw new Error('Selecione uma peça'); const ti=pieceThicknessInfo(selected); if(!ti)throw new Error('Usinagem disponível para peças retangulares');
  const entry=$('machiningFace').value,da=entryAxisName(entry),through=$('machiningThrough').checked;
  const raw={x:machiningFieldNumber('machiningX'),y:machiningFieldNumber('machiningY'),z:machiningFieldNumber('machiningZ')};
  if(!Object.values(raw).every(Number.isFinite))throw new Error('Confira X, Y e Z');
  const op={id:machiningEditId||uid('mach'),type:machiningType,entryAxis:entry,coordRef:{...raw},x:0,y:0,z:0,through};
  if(machiningType==='hole'){
    op.diameter=Number($('machiningDiameter').value);op.depth=through?ti.thickness:Number($('machiningDepthHole').value);
    op.seriesEnabled=$('machiningSeries').checked;op.seriesCount=op.seriesEnabled?Math.round(Number($('machiningSeriesCount').value)||1):1;op.seriesStep=Number($('machiningSeriesStep').value)||32;op.seriesAxis=$('machiningSeriesAxis').value;op.seriesDirection=Number($('machiningSeriesDirection').value)<0?-1:1;
    if(!(op.diameter>0&&op.depth>0))throw new Error('Diâmetro e profundidade devem ser maiores que zero');if(op.depth>ti.thickness+.001)throw new Error(`Profundidade máxima: ${nice(ti.thickness)} mm`);
    if(op.seriesEnabled&&(!(op.seriesCount>=1)||op.seriesCount>999||!(op.seriesStep>0)||![ti.uAxis,ti.vAxis].includes(op.seriesAxis)))throw new Error('Confira quantidade, passo e eixo da série');
    Object.assign(op,resolvedMachiningCoords(selected,op));
    const r=op.diameter/2,pts=holeSeriesInstances(selected,op);for(const p of pts)for(const a of [ti.uAxis,ti.vAxis])if(p[a]<r-.001||p[a]>ti.dims[a]-r+.001)throw new Error(`Furo ${p.index} da série ultrapassa a peça no eixo ${axisLabel(a)}`);
  }else{
    const autoBack=$('machiningBackGroove').checked;op.lengthAxis=$('machiningLengthAxis').value;const fullLength=grooveLengthIsFull();op.fullLength=fullLength;op.length=fullLength?ti.dims[op.lengthAxis]:parseDecimalInput($('machiningLength').value);op.width=Number($('machiningWidth').value);op.depth=through?ti.thickness:Number($('machiningDepthGroove').value);
    if(fullLength)op.coordRef[op.lengthAxis]=0;
    if(autoBack){
      if(![ti.uAxis,ti.vAxis].includes('z'))throw new Error('Rasgo de fundo automático exige Z na face da peça');
      op.preset='back-groove';op.autoLength=true;op.rearOffset=Math.max(0,Number($('machiningRearOffset').value)||0);op.lengthAxis=[ti.uAxis,ti.vAxis].find(a=>a!=='z');op.length=ti.dims[op.lengthAxis];op.coordRef[op.lengthAxis]=0;op.coordRef.z=op.rearOffset;
    }else{op.preset=null;op.autoLength=!!fullLength;}
    if(![ti.uAxis,ti.vAxis].includes(op.lengthAxis))throw new Error('Direção do rasgo inválida');if(!(op.length>0&&op.width>0&&op.depth>0))throw new Error('Comprimento, largura e profundidade devem ser maiores que zero');if(op.depth>ti.thickness+.001)throw new Error(`Profundidade máxima: ${nice(ti.thickness)} mm`);
    Object.assign(op,resolvedMachiningCoords(selected,op));
    const wa=op.lengthAxis===ti.uAxis?ti.vAxis:ti.uAxis;
    if(op[op.lengthAxis]<-.001||op[op.lengthAxis]+op.length>ti.dims[op.lengthAxis]+.001)throw new Error(`Rasgo ultrapassa a peça no eixo ${axisLabel(op.lengthAxis)}. Com referência negativa, a distância é medida pela borda oposta do rasgo.`);
    if(op[wa]<-.001||op[wa]+op.width>ti.dims[wa]+.001)throw new Error(`Rasgo ultrapassa a peça no eixo ${axisLabel(wa)}. Com referência negativa, a distância é medida pela borda oposta do rasgo.`);
  }
  return op;
}
function updateMachiningUI(){
  if(!selected)return; const ti=pieceThicknessInfo(selected);if(!ti)return;setMachiningSurfaceCoordinate();
  const through=$('machiningThrough').checked;$('machiningDepthHole').disabled=through;$('machiningDepthGroove').disabled=through;
  let txt='';try{
    const op=machiningDraft(),face=$('machiningFace').selectedOptions[0]?.textContent||op.entryAxis,res=resolvedMachiningCoords(selected,op),real=machiningHasNegativeRef(op)?` → posição real X ${nice(res.x)} Y ${nice(res.y)} Z ${nice(res.z)}`:'';
    if(op.type==='hole'){const count=holeSeriesInstances(selected,op).length;txt=`${count>1?`Série ${count}× · passo ${nice(op.seriesStep)} mm · `:''}Furo Ø ${nice(op.diameter)} mm · profundidade ${nice(op.depth)} mm · ${face} · referência ${machiningCoordRefText(op)}${real}${count>1?` · eixo ${axisLabel(op.seriesAxis)}`:''}`;}
    else txt=`${op.preset==='back-groove'?'Rasgo de fundo automático · ':op.fullLength?'Rasgo X (tamanho da peça) · ':''}Rasgo ${nice(op.length)} × ${nice(op.width)} mm · profundidade ${nice(op.depth)} mm · comprimento em ${axisLabel(op.lengthAxis)} · ${face} · referência ${machiningCoordRefText(op)}${real}`;
  }catch(err){txt=err.message||'Confira a usinagem';}
  $('machiningPreview').textContent=txt;$('saveMachining').textContent=machiningEditId?'Salvar alteração':(machiningType==='hole'?'Adicionar furo':'Adicionar rasgo');
}
function renderMachiningList(){
  const list=$('machiningList');list.innerHTML='';if(!selected)return;
  const ops=Array.isArray(selected.userData?.machining)?selected.userData.machining:[];
  const renderedInstances=new Set();let rows=0;

  function appendHardwareRow(instanceId,name,sourceOnly=false){
    if(!instanceId||renderedInstances.has(instanceId))return;
    const st=hardwareInstanceSummary(instanceId);if(!st.operations)return;
    renderedInstances.add(instanceId);rows++;
    const item=document.createElement('div');item.className='machiningItem';
    const text=document.createElement('div');text.innerHTML='<div class="miName"></div><div class="miInfo"></div>';
    text.querySelector('.miName').textContent=`⚙ ${name||st.name||'Ferragem'}`;
    text.querySelector('.miInfo').textContent=`${st.operations} furação(ões) em ${st.pieces} peça(s) · ${sourceOnly?'aplicada a partir desta peça':'ferragem vinculada'} · toque em Excluir para remover a aplicação inteira`;
    const btns=document.createElement('div');btns.className='miBtns';
    const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteHardwareInstance(instanceId,name||st.name);
    btns.append(del);item.append(text,btns);list.appendChild(item);
  }

  for(const op of ops){
    if(op?.hardwareInstanceId){appendHardwareRow(op.hardwareInstanceId,op.hardwareName,false);continue;}
    rows++;
    const item=document.createElement('div');item.className='machiningItem';const text=document.createElement('div'),depth=operationDepthMm(selected,op),res=resolvedMachiningCoords(selected,op),neg=machiningHasNegativeRef(op);
    text.innerHTML=`<div class="miName"></div><div class="miInfo"></div>`;
    text.querySelector('.miName').textContent=op.type==='hole'?(op.seriesEnabled&&op.seriesCount>1?`Série ${op.seriesCount}× · Ø ${nice(op.diameter)} mm`:`Furo Ø ${nice(op.diameter)} mm`):(op.preset==='back-groove'?`Rasgo de fundo · ${nice(op.length)} × ${nice(op.width)} mm`:op.preset==='drawer-bottom-groove'?`Rasgo fundo gaveta · ${nice(op.length)} × ${nice(op.width)} mm`:`Rasgo ${nice(op.length)} × ${nice(op.width)} mm`);
    text.querySelector('.miInfo').textContent=`${op.entryAxis.toUpperCase()} · ref. ${machiningCoordRefText(op)}${neg?` · real X ${nice(res.x)} Y ${nice(res.y)} Z ${nice(res.z)}`:''} · prof. ${nice(depth)} mm${op.seriesEnabled&&op.seriesCount>1?` · ${axisLabel(op.seriesAxis)} / ${nice(op.seriesStep)} mm`:''}${op.preset==='back-groove'?` · traseira ${nice(op.rearOffset)} mm`:''}${op.through?' · atravessa':''}`;
    const btns=document.createElement('div');btns.className='miBtns';const edit=document.createElement('button');edit.className='secondary';edit.textContent='Editar';edit.onclick=()=>loadMachiningForEdit(op.id);const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteMachining(op.id);btns.append(edit,del);item.append(text,btns);list.appendChild(item);
  }

  // Ferragens como pino de prateleira podem furar somente as laterais. Nesse
  // caso a prateleira é a origem da aplicação, mas não possui um furo próprio.
  // Mesmo assim a aplicação precisa aparecer no histórico da prateleira.
  for(const app of hardwareSourceApplications(selected))appendHardwareRow(app.instanceId,app.name,true);

  if(!rows){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma usinagem ou ferragem aplicada nesta peça.';list.appendChild(d);}
}
function openMachiningDialog(type='hole'){
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  clearMachiningDraftPreview(); machiningPreviewActive=false; machiningVisualGroup.visible=true; $('machining3DPreviewBar').style.display='none'; machiningPreviewOwner=null;
  if(!selected){toast('Selecione uma peça');return;} if(selected.userData?.kind==='cylinder'){toast('Furo/rasgo em cilindro ainda não está disponível');return;}
  $('morePanel').style.display='none'; machiningEditId=null; machiningType=type==='groove'?'groove':type==='hardware'?'hardware':'hole'; $('machiningTitle').textContent=`Usinagem · ${selected.userData.name||'Peça'}`;
  const ti=pieceThicknessInfo(selected); $('machiningPartInfo').textContent=`Peça ${nice(ti.faceW)} × ${nice(ti.faceH)} × ${nice(ti.thickness)} mm · espessura no eixo ${axisLabel(ti.thicknessAxis)}. X=esquerda→direita, Y=baixo→cima, Z=trás→frente. Valor negativo mede do lado oposto (ex.: Y −100 = 100 mm do topo). DXF sem giro: ${axisLabel(ti.uAxis)} horizontal × ${axisLabel(ti.vAxis)} vertical.`;
  populateMachiningFaceOptions(); setMachiningType(machiningType,machiningType!=='hardware'); if(machiningType!=='hardware')refreshMachiningPresetSelect(); else setHardwareScope(hardwareScope); renderMachiningList(); $('machiningDialog').style.display='flex';
}
function saveMachining(){
  clearMachiningDraftPreview(); machiningPreviewActive=false; machiningVisualGroup.visible=true; $('machining3DPreviewBar').style.display='none'; machiningPreviewOwner=null;
  try{const op=machiningDraft(); const arr=selected.userData.machining||(selected.userData.machining=[]); const i=arr.findIndex(x=>x.id===op.id); if(i>=0)arr[i]=op; else arr.push(op); machiningEditId=null; sanitizeMachiningForPiece(selected); renderMachiningVisuals(); renderMachiningList(); updateInspector(); commitHistory(); setDefaultMachiningValues(); updateMachiningUI(); toast(op.type==='hole'?'Furo salvo':'Rasgo salvo');}catch(err){toast(err.message||'Usinagem inválida');}
}
function loadMachiningForEdit(id){
  const op=(selected?.userData?.machining||[]).find(x=>x.id===id); if(!op)return; machiningEditId=id; machiningType=op.type; setMachiningType(op.type,false); populateMachiningFaceOptions(op.entryAxis); populateMachiningLengthAxes(op.lengthAxis); $('machiningFace').value=op.entryAxis; $('machiningX').value=machiningRawCoord(op,'x'); $('machiningY').value=machiningRawCoord(op,'y'); $('machiningZ').value=machiningRawCoord(op,'z'); $('machiningThrough').checked=!!op.through;
  if(op.type==='hole'){$('machiningDiameter').value=op.diameter;$('machiningDepthHole').value=op.depth;$('machiningSeries').checked=!!op.seriesEnabled;$('machiningSeriesCount').value=op.seriesCount||1;$('machiningSeriesStep').value=op.seriesStep||32;populateMachiningSeriesAxes(op.seriesAxis);$('machiningSeriesAxis').value=op.seriesAxis||pieceThicknessInfo(selected).uAxis;$('machiningSeriesDirection').value=String(Number(op.seriesDirection)<0?-1:1);}else{$('machiningLengthAxis').value=op.lengthAxis;$('machiningLength').value=op.fullLength?'X':op.length;syncGrooveLengthButton();$('machiningWidth').value=op.width;$('machiningDepthGroove').value=op.depth;$('machiningBackGroove').checked=op.preset==='back-groove';$('machiningRearOffset').value=op.rearOffset??10;} updateHoleSeriesVisibility();updateBackGrooveVisibility();updateMachiningUI();
}
function deleteMachining(id){
  if(!selected)return;
  const arr=selected.userData.machining||[],op=arr.find(x=>x.id===id);if(!op)return;
  if(op.hardwareInstanceId){
    const instanceId=op.hardwareInstanceId,st=appliedHardwareStats(x=>x.hardwareInstanceId===instanceId);
    const name=op.hardwareName||'Ferragem';
    if(!window.confirm(`Excluir a ferragem aplicada “${name}” inteira?

Serão removidas ${st.operations} furação(ões) de ${st.pieces} peça(s) vinculada(s) a esta aplicação.`))return;
    removeAppliedHardware(x=>x.hardwareInstanceId===instanceId);
    if(machiningEditId===id)machiningEditId=null;
    commitHistory();toast(`${name} removida por completo`);return;
  }
  const i=arr.findIndex(x=>x.id===id);if(i<0)return;if(!window.confirm('Excluir esta usinagem?'))return;
  arr.splice(i,1);if(machiningEditId===id)machiningEditId=null;refreshAfterHardwareRemoval();commitHistory();toast('Usinagem excluída');
}


// ---------- Exportar / importar móvel + Aspire DXF ----------
function safeFileName(v,fallback='movel'){
  const t=String(v||fallback).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
  return t||fallback;
}
function downloadText(name,text,mime='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type:mime});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}
function selectedFurnitureRoot(){
  if(selectedSpaceCell){ const r=getSpaceRoot(selectedSpaceCell.rootId); if(r)return r; }
  if(selected?.userData?.spaceRootId){ const r=getSpaceRoot(selected.userData.spaceRootId); if(r)return r; }
  if(activeSpaceRootId){ const r=getSpaceRoot(activeSpaceRootId); if(r)return r; }
  return null;
}
function objectBounds(o){
  const b=getBounds(o); return {minX:b.minX,maxX:b.maxX,minY:b.minY,maxY:b.maxY,minZ:b.minZ,maxZ:b.maxZ};
}
function objectBelongsToRoot(o,root){
  if(o.userData?.spaceRootId) return o.userData.spaceRootId===root.id;
  // Compatibilidade com peças antigas criadas antes do vínculo com o espaço.
  const b=objectBounds(o), rb={minX:root.x-root.width/2,maxX:root.x+root.width/2,minY:root.yBase,maxY:root.yBase+root.height,minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2};
  const tol=.002;
  return b.minX>=rb.minX-tol&&b.maxX<=rb.maxX+tol&&b.minY>=rb.minY-tol&&b.maxY<=rb.maxY+tol&&b.minZ>=rb.minZ-tol&&b.maxZ<=rb.maxZ+tol;
}
function furnitureObjects(root){ return objects.filter(o=>objectBelongsToRoot(o,root)); }
function captureFurniture(root){
  const stateSpace=captureSpaces().find(s=>s.id===root.id);
  const parts=furnitureObjects(root).map(o=>({
    kind:o.userData.kind,name:o.userData.name,materialType:o.userData.materialType,baseColor:o.userData.baseColor,
    materialId:o.userData.materialId||null,materialCode:o.userData.materialCode||'',materialGrain:!!o.userData.materialGrain,materialGrainRotation:normalizePieceGrainRotation(o.userData.materialGrainRotation),materialCoreColor:o.userData.materialCoreColor||null,
    edgeBands:productionClone(o.userData.edgeBands||{}),partId:o.userData.partId||null,labelMeta:productionClone(o.userData.labelMeta||{schemaVersion:1,enabled:true}),
    spaceRootId:root.id,
    machining:JSON.parse(JSON.stringify(o.userData.machining||[])),forms:JSON.parse(JSON.stringify(o.userData.forms||[])),customProfile:o.userData.customProfile?JSON.parse(JSON.stringify(o.userData.customProfile)):null,curvedRole:o.userData.curvedRole||null,curvedPart:o.userData.curvedPart||o.userData.customProfile?.part||null,curvedConfig:o.userData.curvedConfig?JSON.parse(JSON.stringify(o.userData.curvedConfig)):null,drawerSetId:o.userData.drawerSetId||null,drawerRole:o.userData.drawerRole||null,drawerIndex:o.userData.drawerIndex??null,drawerConfig:o.userData.drawerConfig?JSON.parse(JSON.stringify(o.userData.drawerConfig)):null,doorConfig:o.userData.doorConfig?JSON.parse(JSON.stringify(o.userData.doorConfig)):null,excludeFromCutList:!!o.userData.excludeFromCutList,spaceCutting:!!o.userData.spaceCutting,spaceCutParentBounds:o.userData.spaceCutParentBounds?JSON.parse(JSON.stringify(o.userData.spaceCutParentBounds)):null,rotationY:Number(o.rotation.y)||0,
    width:o.userData.width,depth:o.userData.depth,height:o.userData.height,
    x:Number.isFinite(o.userData.curvedTargetX)?o.userData.curvedTargetX:o.position.x,yBase:o.position.y-o.userData.height/2,z:Number.isFinite(o.userData.curvedTargetZ)?o.userData.curvedTargetZ:o.position.z
  }));
  return {type:'mini-cad-furniture',version:56,unit:'meter',name:root.name||'Móvel',createdAt:new Date().toISOString(),objects:parts,spaces:[stateSpace],production:captureProductionState()};
}
function dxfModelCleanLayerName(name,index){
  const raw=String(name||`Peca ${index+1}`).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const clean=raw.replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'Peca';
  const prefix=`P${String(index+1).padStart(3,'0')}_`;
  return (prefix+clean).slice(0,31);
}
function dxfModelNumber(v){
  const n=Math.abs(Number(v))<0.00005?0:Number(v);
  return Number.isFinite(n)?Number(n.toFixed(4)):0;
}
function designLabUtf8ToBase64(text){
  const bytes=new TextEncoder().encode(String(text||''));
  let bin='';
  for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(bin);
}
function designLabBase64ToUtf8(base64){
  const bin=atob(String(base64||'')),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function designLabDxfPayloadComments(record){
  // 999 é comentário padrão do DXF e é ignorado por Aspire/AutoCAD.
  // Guardamos os dados completos do DesignLab para que o mesmo DXF possa
  // voltar à Biblioteca preservando peças, usinagens, portas, materiais e cortes.
  // 1.100.95: além do bloco antigo, gravamos uma assinatura compacta extra
  // para ficar mais resistente quando outro app muda a quebra de linha do DXF.
  const b64=designLabUtf8ToBase64(JSON.stringify(record));
  let out='999\r\nDESIGNLABMOVEIS_PAYLOAD_BEGIN\r\n';
  for(let i=0;i<b64.length;i+=220)out+=`999\r\nDLM:${b64.slice(i,i+220)}\r\n`;
  out+='999\r\nDESIGNLABMOVEIS_PAYLOAD_END\r\n';
  out+='999\r\nDESIGNLABMOVEIS_PAYLOAD_V2_BEGIN\r\n';
  for(let i=0;i<b64.length;i+=220)out+=`999\r\nDLM2:${b64.slice(i,i+220)}\r\n`;
  out+='999\r\nDESIGNLABMOVEIS_PAYLOAD_V2_END\r\n';
  return out;
}
function dxfPairs(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n'),pairs=[];
  for(let i=0;i+1<lines.length;i+=2)pairs.push([String(lines[i]||'').trim(),String(lines[i+1]||'')]);
  return pairs;
}
function designLabRecordFromDxfPayload(text){
  const raw=String(text||'');
  const tryDecode=(b64)=>{
    if(!b64)return null;
    const data=JSON.parse(designLabBase64ToUtf8(b64));
    if(!data||!Array.isArray(data.objects)||!data.objects.length)throw new Error('DXF contém dados DesignLab inválidos');
    return data;
  };
  const pairs=dxfPairs(raw);
  const collectByPairs=(begin,end,prefix)=>{
    let active=false,b64='';
    for(const [code,value] of pairs){
      if(code!=='999')continue;
      const v=String(value||'').trim();
      if(v===begin){active=true;b64='';continue;}
      if(active&&v===end)break;
      if(active&&v.startsWith(prefix))b64+=v.slice(prefix.length);
    }
    return b64;
  };
  let b64=collectByPairs('DESIGNLABMOVEIS_PAYLOAD_V2_BEGIN','DESIGNLABMOVEIS_PAYLOAD_V2_END','DLM2:')
    || collectByPairs('DESIGNLABMOVEIS_PAYLOAD_BEGIN','DESIGNLABMOVEIS_PAYLOAD_END','DLM:');
  if(!b64){
    const lines=raw.replace(/\r/g,'').split('\n').map(v=>String(v||'').trim());
    const collectByLines=(begin,end,prefix)=>{
      let active=false,out='';
      for(const line of lines){
        if(line===begin){active=true;out='';continue;}
        if(active&&line===end)break;
        if(active&&line.startsWith(prefix))out+=line.slice(prefix.length);
      }
      return out;
    };
    b64=collectByLines('DESIGNLABMOVEIS_PAYLOAD_V2_BEGIN','DESIGNLABMOVEIS_PAYLOAD_V2_END','DLM2:')
      || collectByLines('DESIGNLABMOVEIS_PAYLOAD_BEGIN','DESIGNLABMOVEIS_PAYLOAD_END','DLM:');
  }
  if(!b64){
    const m=raw.match(/DESIGNLABMOVEIS_PAYLOAD_(?:V2_)?BEGIN([\s\S]*?)DESIGNLABMOVEIS_PAYLOAD_(?:V2_)?END/i);
    if(m&&m[1]){
      const chunks=[...m[1].matchAll(/DLM2?:([A-Za-z0-9+/=]+)/g)].map(x=>x[1]);
      if(chunks.length)b64=chunks.join('');
    }
  }
  return tryDecode(b64);
}
function dxfImportedPartName(layer,index){
  const raw=String(layer||`Peça ${index+1}`).replace(/^P\d+_/i,'').replace(/_+/g,' ').trim();
  return raw||`Peça ${index+1}`;
}
function dxfFallbackNewBounds(){
  return {minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
}
function dxfFallbackAddPoint(b,x,y,z=0){
  x=Number(x);y=Number(y);z=Number(z);
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return;
  b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);
  b.minY=Math.min(b.minY,y);b.maxY=Math.max(b.maxY,y);
  b.minZ=Math.min(b.minZ,z);b.maxZ=Math.max(b.maxZ,z);
}
function dxfFallbackBoundsValid(b){
  return !!b&&[b.minX,b.maxX,b.minY,b.maxY,b.minZ,b.maxZ].every(Number.isFinite);
}
function dxfFallbackLayerThicknessMm(layer){
  const s=String(layer||'').replace(/,/g,'.');
  const patterns=[/(?:^|[_\-\s])(\d+(?:\.\d+)?)\s*mm(?:$|[_\-\s])/i,/(?:MDF|MDP|CHAPA|ESP(?:ESSURA)?)[_\-\s]*(\d+(?:\.\d+)?)/i];
  for(const re of patterns){
    const m=s.match(re),n=m?Number(m[1]):NaN;
    if(Number.isFinite(n)&&n>=3&&n<=60)return n;
  }
  return 18;
}
function dxfFallbackObjectFrom3DBounds(layer,b,index){
  if(!dxfFallbackBoundsValid(b))return null;
  const eps=.05,t=dxfFallbackLayerThicknessMm(layer);
  let dx=Math.max(0,b.maxX-b.minX),dy=Math.max(0,b.maxY-b.minY),dz=Math.max(0,b.maxZ-b.minZ);
  const positive=[dx,dy,dz].filter(v=>v>eps).length;
  if(positive<2)return null;
  let cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2,cz=(b.minZ+b.maxZ)/2;
  if(dx<=eps)dx=t;
  if(dy<=eps)dy=t;
  if(dz<=eps)dz=t;
  if(!(dx>0&&dy>0&&dz>0))return null;
  return {
    kind:'panel',name:dxfImportedPartName(layer,index),materialType:'DXF importado',
    width:dx/1000,depth:dy/1000,height:dz/1000,
    x:cx/1000,z:cy/1000,yBase:(cz-dz/2)/1000,
    machining:[],forms:[],edgeBands:{},materialId:null,materialCode:'',materialGrain:false
  };
}
function dxfFallbackObjectFromPlanarBounds(layer,b,index){
  if(!b||![b.minX,b.maxX,b.minY,b.maxY].every(Number.isFinite))return null;
  const dx=Math.max(0,b.maxX-b.minX),dy=Math.max(0,b.maxY-b.minY),eps=.05;
  if(dx<=eps||dy<=eps)return null;
  const t=dxfFallbackLayerThicknessMm(layer);
  return {
    kind:'panel',name:dxfImportedPartName(layer,index),materialType:'DXF 2D importado',
    width:dx/1000,depth:t/1000,height:dy/1000,
    x:(b.minX+b.maxX)/2000,z:0,yBase:b.minY/1000,
    machining:[],forms:[],edgeBands:{},materialId:null,materialCode:'',materialGrain:false
  };
}
function dxfFallbackPlanarSpace(objects,name){
  if(!objects.length)return [];
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of objects){
    minX=Math.min(minX,p.x-p.width/2);maxX=Math.max(maxX,p.x+p.width/2);
    minY=Math.min(minY,p.yBase);maxY=Math.max(maxY,p.yBase+p.height);
  }
  if(![minX,maxX,minY,maxY].every(Number.isFinite))return [];
  const depth=Math.max(.018,...objects.map(p=>Number(p.depth)||0));
  const width=Math.max(.001,maxX-minX),height=Math.max(.001,maxY-minY),x=(minX+maxX)/2,z=0,yBase=minY;
  const id='dxf_planar_space',cellId='dxf_planar_cell';
  return [{id,name:name||'DXF 2D',width,depth,height,x,z,yBase,cells:[{id:cellId,minX,maxX,minY,maxY,minZ:-depth/2,maxZ:depth/2,fixedAxes:{}}],fixedBands:{x:[],y:[],z:[[-depth/2,depth/2]]},doorsHidden:false,spaceHidden:false}];
}
function designLabFallbackRecordFromDxf(text,name='Modelo DXF'){
  const pairs=dxfPairs(text),byLayer3d=new Map(),line2dByLayer=new Map(),planar=[];
  const add3=(layer,x,y,z)=>{
    layer=String(layer||'0').trim()||'0';let b=byLayer3d.get(layer);if(!b){b=dxfFallbackNewBounds();byLayer3d.set(layer,b);}dxfFallbackAddPoint(b,x,y,z);
  };
  const add2=(layer,x,y)=>{
    layer=String(layer||'0').trim()||'0';let b=line2dByLayer.get(layer);if(!b){b={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};line2dByLayer.set(layer,b);}x=Number(x);y=Number(y);if(!Number.isFinite(x)||!Number.isFinite(y))return;b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);b.minY=Math.min(b.minY,y);b.maxY=Math.max(b.maxY,y);
  };
  const contourBounds=(pts)=>{const b={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};for(const p of pts){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minY=Math.min(b.minY,p.y);b.maxY=Math.max(b.maxY,p.y);}return b;};
  let i=0,recognized=0;
  while(i<pairs.length){
    const [code,value]=pairs[i];
    if(code!=='0'){i++;continue;}
    const type=String(value||'').trim().toUpperCase();
    if(type==='3DFACE'||type==='SOLID'||type==='TRACE'){
      i++;let layer='0',coords={};
      while(i<pairs.length&&pairs[i][0]!=='0'){
        const [c,v]=pairs[i++];if(c==='8')layer=String(v||'0').trim()||'0';
        else if(['10','20','30','11','21','31','12','22','32','13','23','33'].includes(c))coords[c]=Number(v);
      }
      for(let n=0;n<4;n++)add3(layer,coords[String(10+n)],coords[String(20+n)],coords[String(30+n)]);
      recognized++;continue;
    }
    if(type==='LINE'){
      i++;let layer='0',c={};
      while(i<pairs.length&&pairs[i][0]!=='0'){const [k,v]=pairs[i++];if(k==='8')layer=String(v||'0').trim()||'0';else if(['10','20','30','11','21','31'].includes(k))c[k]=Number(v);}
      const z1=Number.isFinite(c['30'])?c['30']:0,z2=Number.isFinite(c['31'])?c['31']:0;
      if(Math.abs(z1)>0.05||Math.abs(z2)>0.05||Math.abs(z1-z2)>0.05){add3(layer,c['10'],c['20'],z1);add3(layer,c['11'],c['21'],z2);}else{add2(layer,c['10'],c['20']);add2(layer,c['11'],c['21']);}
      recognized++;continue;
    }
    if(type==='LWPOLYLINE'){
      i++;let layer='0',elev=0,flags=0,pts=[],pendingX=null;
      while(i<pairs.length&&pairs[i][0]!=='0'){
        const [k,v]=pairs[i++];
        if(k==='8')layer=String(v||'0').trim()||'0';
        else if(k==='38')elev=Number(v)||0;
        else if(k==='70')flags=Number(v)||0;
        else if(k==='10')pendingX=Number(v);
        else if(k==='20'&&Number.isFinite(pendingX)){pts.push({x:pendingX,y:Number(v),z:elev});pendingX=null;}
      }
      if(pts.length>=2){
        if(Math.abs(elev)>0.05){for(const p of pts)add3(layer,p.x,p.y,p.z);}
        else if(pts.length>=3){planar.push({layer,b:contourBounds(pts),closed:!!(flags&1)});}
        else for(const p of pts)add2(layer,p.x,p.y);
      }
      recognized++;continue;
    }
    if(type==='POLYLINE'){
      i++;let layer='0',flags=0;
      while(i<pairs.length&&pairs[i][0]!=='0'){const [k,v]=pairs[i++];if(k==='8')layer=String(v||'0').trim()||'0';else if(k==='70')flags=Number(v)||0;}
      const pts=[];
      while(i<pairs.length){
        if(pairs[i][0]!=='0'){i++;continue;}
        const sub=String(pairs[i][1]||'').trim().toUpperCase();
        if(sub==='VERTEX'){
          i++;let p={x:NaN,y:NaN,z:0};
          while(i<pairs.length&&pairs[i][0]!=='0'){const [k,v]=pairs[i++];if(k==='10')p.x=Number(v);else if(k==='20')p.y=Number(v);else if(k==='30')p.z=Number(v)||0;}
          if(Number.isFinite(p.x)&&Number.isFinite(p.y))pts.push(p);continue;
        }
        if(sub==='SEQEND'){i++;break;}
        break;
      }
      if(pts.length>=2){
        const zMin=Math.min(...pts.map(p=>p.z)),zMax=Math.max(...pts.map(p=>p.z));
        if(Math.abs(zMin)>0.05||Math.abs(zMax)>0.05||Math.abs(zMax-zMin)>0.05||(flags&8)||(flags&16)||(flags&64)){for(const p of pts)add3(layer,p.x,p.y,p.z);}
        else if(pts.length>=3)planar.push({layer,b:contourBounds(pts),closed:!!(flags&1)});
        else for(const p of pts)add2(layer,p.x,p.y);
      }
      recognized++;continue;
    }
    if(type==='CIRCLE'){
      i++;let layer='0',cx=NaN,cy=NaN,cz=0,r=NaN;
      while(i<pairs.length&&pairs[i][0]!=='0'){const [k,v]=pairs[i++];if(k==='8')layer=String(v||'0').trim()||'0';else if(k==='10')cx=Number(v);else if(k==='20')cy=Number(v);else if(k==='30')cz=Number(v)||0;else if(k==='40')r=Math.abs(Number(v));}
      if(Number.isFinite(cx)&&Number.isFinite(cy)&&Number.isFinite(r)&&r>0){if(Math.abs(cz)>0.05){add3(layer,cx-r,cy-r,cz);add3(layer,cx+r,cy+r,cz);}/* círculos 2D normalmente são furos: não viram peças */}
      recognized++;continue;
    }
    i++;
  }

  const objects=[];let idx=0;
  for(const [layer,b] of byLayer3d){const o=dxfFallbackObjectFrom3DBounds(layer,b,idx);if(o){objects.push(o);idx++;}}
  if(objects.length)return {type:'mini-cad-furniture',version:66,unit:'meter',name,createdAt:new Date().toISOString(),objects,spaces:[],production:{},dxfFallback:true,dxfFallbackMode:'3d'};

  // DXFs antigos podem ter somente contornos 2D (LWPOLYLINE/POLYLINE) ou
  // linhas por peça. Nesse caso importamos as peças como painéis planos em vez
  // de rejeitar o arquivo. Contornos internos (furos/rasgos) são descartados
  // quando estão completamente dentro de um contorno maior.
  const candidates=planar.filter(c=>c.closed&&c.b&&Number.isFinite(c.b.minX)&&Number.isFinite(c.b.maxX)&&Number.isFinite(c.b.minY)&&Number.isFinite(c.b.maxY));
  const outer=candidates.filter((c,ci)=>!candidates.some((p,pi)=>pi!==ci&&p.layer===c.layer&&p.b.minX<=c.b.minX-.01&&p.b.maxX>=c.b.maxX+.01&&p.b.minY<=c.b.minY-.01&&p.b.maxY>=c.b.maxY+.01));
  const planarSource=outer.length?outer:candidates;
  for(const c of planarSource){const o=dxfFallbackObjectFromPlanarBounds(c.layer,c.b,idx);if(o){objects.push(o);idx++;}}
  if(!objects.length){for(const [layer,b] of line2dByLayer){const o=dxfFallbackObjectFromPlanarBounds(layer,b,idx);if(o){objects.push(o);idx++;}}}
  if(objects.length)return {type:'mini-cad-furniture',version:66,unit:'meter',name,createdAt:new Date().toISOString(),objects,spaces:dxfFallbackPlanarSpace(objects,name),production:{},dxfFallback:true,dxfFallbackMode:'2d'};

  const kinds=[...new Set(pairs.filter(p=>p[0]==='0').map(p=>String(p[1]||'').trim().toUpperCase()).filter(Boolean))].slice(0,8).join(', ');
  throw new Error(`Este DXF não possui geometria de modelo reconhecível${kinds?` (entidades encontradas: ${kinds})`:''}`);
}
function designLabFurnitureRecordFromImportedFile(text,fileName='modelo.dxf'){
  const lower=String(fileName||'').toLowerCase();
  if(lower.endsWith('.json')||lower.endsWith('.mini-cad.json'))return {record:JSON.parse(text),fallback:false,legacyJson:true};
  const exact=designLabRecordFromDxfPayload(text);
  if(exact)return {record:exact,fallback:false,legacyJson:false};
  const name=String(fileName||'Modelo DXF').replace(/\.dxf$/i,'')||'Modelo DXF';
  return {record:designLabFallbackRecordFromDxf(text,name),fallback:true,legacyJson:false};
}
async function importLibraryFile(file){
  const parsed=await designLabFurnitureRecordFromFile(file);
  const name=String(file.name||'Modelo').replace(/(?:\.mini-cad)?\.json$/i,'').replace(/\.(?:dxf|stl)$/i,'')||'Modelo';
  if(libraryScope==='global'){
    if(!adminAllowed())throw new Error('Somente o administrador pode importar modelos globais');
    const folder=globalLibraryFolderById(activeLibraryFolderId);if(!folder)throw new Error('Abra uma pasta global para importar');
    await cloudApiFetch('/admin/library/items',{method:'POST',body:{folder_id:folder.id,name,record:parsed.record},timeoutMs:30000});
    globalLibraryState.itemsByFolder.delete(folder.id);globalLibraryState.records.clear();
    await loadGlobalLibraryItems(folder.id,{force:true});await loadGlobalLibraryFolders({force:true});renderLibrary();
    toast(parsed.stl?'STL DesignLab publicado na Biblioteca global':(parsed.fallback?(parsed.record?.dxfFallbackMode==='2d'?'DXF 2D publicado como painéis planos · a montagem 3D original não existe no arquivo':'DXF antigo publicado por geometria · sem dados de usinagem que não existiam no arquivo'):'Modelo publicado na Biblioteca global'));
    return;
  }
  importLibraryTemplate(parsed.record,name,activeLibraryFolderId);
  if(parsed.fallback)toast(parsed.record?.dxfFallbackMode==='2d'?'DXF 2D importado como painéis planos · a montagem 3D original não existe no arquivo':'DXF importado só pela geometria · se este arquivo saiu do DesignLab, exporte novamente na 1.100.95 para preservar curvas, usinagens e configurações');
  else if(parsed.stl)toast('STL DesignLab importado preservando curvas, peças e configurações');
  else if(!parsed.legacyJson)toast('DXF DesignLab importado com peças, curvas e configurações preservadas');
}

// ---------- 1.100.95 · STL do modelo 3D completo ----------
// O modelo montado usa STL binário para preservar exatamente a malha 3D (inclusive curvas).
// Aspire/plano de corte/usinagem permanecem exclusivamente no fluxo DXF existente.
const DESIGNLAB_STL_PAYLOAD_BEGIN='DESIGNLABMOVEIS_STL_PAYLOAD_BEGIN';
const DESIGNLAB_STL_PAYLOAD_END='DESIGNLABMOVEIS_STL_PAYLOAD_END';
function designLabStlTrailer(record){
  const b64=designLabUtf8ToBase64(JSON.stringify(record));
  return `\n${DESIGNLAB_STL_PAYLOAD_BEGIN}\n${b64}\n${DESIGNLAB_STL_PAYLOAD_END}\n`;
}
function designLabRecordFromStlBuffer(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<84)throw new Error('STL inválido ou vazio');
  const view=new DataView(buffer),triangles=view.getUint32(80,true),meshBytes=84+triangles*50;
  if(!Number.isFinite(triangles)||triangles<1||meshBytes>buffer.byteLength)throw new Error('STL binário inválido');
  if(meshBytes===buffer.byteLength)return null;
  const trailer=new TextDecoder().decode(new Uint8Array(buffer,meshBytes));
  const a=trailer.indexOf(DESIGNLAB_STL_PAYLOAD_BEGIN),b=trailer.indexOf(DESIGNLAB_STL_PAYLOAD_END);
  if(a<0||b<=a)return null;
  const payload=trailer.slice(a+DESIGNLAB_STL_PAYLOAD_BEGIN.length,b).replace(/\s+/g,'');
  if(!payload)return null;
  const data=JSON.parse(designLabBase64ToUtf8(payload));
  if(!data||!Array.isArray(data.objects)||!data.objects.length||!Array.isArray(data.spaces)||!data.spaces.length)throw new Error('STL contém dados DesignLab inválidos');
  return data;
}
function furnitureModelTriangleCount(meshes){
  let count=0;
  for(const mesh of meshes){
    const geom=mesh.geometry,pos=geom?.getAttribute?.('position'),idx=geom?.index;
    if(!pos)continue;
    count+=Math.floor((idx?idx.count:pos.count)/3);
  }
  return count;
}
function buildFurnitureModelStl(root){
  const meshes=furnitureModelMeshes(root);
  if(!meshes.length)throw new Error('Este móvel não possui geometria para exportar');
  scene.updateMatrixWorld(true);
  const triangleCount=furnitureModelTriangleCount(meshes);
  if(!triangleCount)throw new Error('A geometria do móvel não possui triângulos');
  const min={x:Infinity,y:Infinity,z:Infinity};
  const tmp=new THREE.Vector3();
  for(const mesh of meshes){
    mesh.updateWorldMatrix(true,false);
    const pos=mesh.geometry.getAttribute('position');
    for(let i=0;i<pos.count;i++){
      tmp.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
      if(tmp.x<min.x)min.x=tmp.x;
      if(tmp.z<min.y)min.y=tmp.z;
      if(tmp.y<min.z)min.z=tmp.y;
    }
  }
  if(![min.x,min.y,min.z].every(Number.isFinite))throw new Error('Não foi possível calcular a geometria STL');
  const buffer=new ArrayBuffer(84+triangleCount*50),view=new DataView(buffer),header=new Uint8Array(buffer,0,80);
  const headerText=new TextEncoder().encode('DesignLabMoveis 1.100.95 STL 3D | metadata after triangles');
  header.set(headerText.subarray(0,80));
  view.setUint32(80,triangleCount,true);
  let off=84,written=0;
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();
  const toMm=(v)=>({x:(v.x-min.x)*1000,y:(v.z-min.y)*1000,z:(v.y-min.z)*1000});
  const writeV=(p)=>{view.setFloat32(off,p.x,true);off+=4;view.setFloat32(off,p.y,true);off+=4;view.setFloat32(off,p.z,true);off+=4;};
  const writeTri=(a,b,c)=>{
    ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();
    // normal também precisa acompanhar o mapeamento Three(X,Y,Z) -> STL(X,Z,Y).
    view.setFloat32(off,n.x,true);off+=4;view.setFloat32(off,n.z,true);off+=4;view.setFloat32(off,n.y,true);off+=4;
    writeV(toMm(a));writeV(toMm(c));writeV(toMm(b));view.setUint16(off,0,true);off+=2;written++;
  };
  for(const mesh of meshes){
    const geom=mesh.geometry,pos=geom.getAttribute('position'),idx=geom.index;
    const getVertex=(vertex,out)=>out.fromBufferAttribute(pos,vertex).applyMatrix4(mesh.matrixWorld);
    if(idx){
      for(let i=0;i+2<idx.count;i+=3){getVertex(idx.getX(i),va);getVertex(idx.getX(i+1),vb);getVertex(idx.getX(i+2),vc);writeTri(va,vb,vc);}
    }else{
      for(let i=0;i+2<pos.count;i+=3){getVertex(i,va);getVertex(i+1,vb);getVertex(i+2,vc);writeTri(va,vb,vc);}
    }
  }
  if(written!==triangleCount)throw new Error('Falha ao finalizar a malha STL');
  const trailer=new TextEncoder().encode(designLabStlTrailer(captureFurniture(root)));
  const out=new Uint8Array(buffer.byteLength+trailer.byteLength);out.set(new Uint8Array(buffer),0);out.set(trailer,buffer.byteLength);
  return {bytes:out,pieces:meshes.length,triangles:triangleCount};
}
async function designLabFurnitureRecordFromFile(file){
  const lower=String(file?.name||'').toLowerCase();
  if(lower.endsWith('.stl')){
    const buffer=await file.arrayBuffer();
    const record=designLabRecordFromStlBuffer(buffer);
    if(!record)throw new Error('Este STL não possui os dados internos do DesignLab. Ele pode ser aberto em visualizadores 3D, mas para voltar editável ao DesignLab exporte o móvel pelo próprio DesignLab.');
    return {record,fallback:false,legacyJson:false,stl:true};
  }
  const text=await file.text();
  return {...designLabFurnitureRecordFromImportedFile(text,file.name),stl:false};
}
function dxfModelFace(layer,a,b,c){
  const p=(code,v)=>`${code}\r\n${dxfModelNumber(v)}\r\n`;
  return `0\r\n3DFACE\r\n8\r\n${layer}\r\n`+
    p(10,a.x)+p(20,a.y)+p(30,a.z)+
    p(11,b.x)+p(21,b.y)+p(31,b.z)+
    p(12,c.x)+p(22,c.y)+p(32,c.z)+
    p(13,c.x)+p(23,c.y)+p(33,c.z);
}
function furnitureModelMeshes(root){
  return furnitureObjects(root).filter(o=>o?.isMesh&&o.geometry?.getAttribute?.('position'));
}
function buildFurnitureModelDxf(root){
  const meshes=furnitureModelMeshes(root);
  if(!meshes.length)throw new Error('Este móvel não possui geometria para exportar');
  scene.updateMatrixWorld(true);

  // O DXF do modelo usa X=largura, Y=profundidade e Z=altura.
  // A origem é movida para o canto mínimo do móvel para facilitar abrir em outros CADs.
  const min={x:Infinity,y:Infinity,z:Infinity};
  const tmp=new THREE.Vector3();
  for(const mesh of meshes){
    mesh.updateWorldMatrix(true,false);
    const pos=mesh.geometry.getAttribute('position');
    for(let i=0;i<pos.count;i++){
      tmp.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
      if(tmp.x<min.x)min.x=tmp.x;
      if(tmp.z<min.y)min.y=tmp.z;
      if(tmp.y<min.z)min.z=tmp.y;
    }
  }
  if(![min.x,min.y,min.z].every(Number.isFinite))throw new Error('Não foi possível calcular a geometria do móvel');

  const layerNames=meshes.map((mesh,i)=>dxfModelCleanLayerName(mesh.userData?.name,i));
  let d='';
  d+='0\r\nSECTION\r\n2\r\nHEADER\r\n';
  d+='9\r\n$ACADVER\r\n1\r\nAC1009\r\n';
  d+='9\r\n$MEASUREMENT\r\n70\r\n1\r\n';
  d+='9\r\n$INSUNITS\r\n70\r\n4\r\n';
  d+=designLabDxfPayloadComments(captureFurniture(root));
  d+='0\r\nENDSEC\r\n';
  d+='0\r\nSECTION\r\n2\r\nTABLES\r\n0\r\nTABLE\r\n2\r\nLAYER\r\n70\r\n'+(layerNames.length+1)+'\r\n';
  d+='0\r\nLAYER\r\n2\r\n0\r\n70\r\n0\r\n62\r\n7\r\n6\r\nCONTINUOUS\r\n';
  layerNames.forEach((layer,i)=>{
    const color=1+(i%7);
    d+=`0\r\nLAYER\r\n2\r\n${layer}\r\n70\r\n0\r\n62\r\n${color}\r\n6\r\nCONTINUOUS\r\n`;
  });
  d+='0\r\nENDTAB\r\n0\r\nENDSEC\r\n0\r\nSECTION\r\n2\r\nENTITIES\r\n';

  let faces=0;
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3();
  const toDxf=(v)=>({
    x:(v.x-min.x)*1000,
    y:(v.z-min.y)*1000,
    z:(v.y-min.z)*1000
  });
  meshes.forEach((mesh,mi)=>{
    const geom=mesh.geometry,pos=geom.getAttribute('position'),idx=geom.index,layer=layerNames[mi];
    const getVertex=(vertex,out)=>out.fromBufferAttribute(pos,vertex).applyMatrix4(mesh.matrixWorld);
    if(idx){
      for(let i=0;i+2<idx.count;i+=3){
        getVertex(idx.getX(i),va);getVertex(idx.getX(i+1),vb);getVertex(idx.getX(i+2),vc);
        d+=dxfModelFace(layer,toDxf(va),toDxf(vb),toDxf(vc));faces++;
      }
    }else{
      for(let i=0;i+2<pos.count;i+=3){
        getVertex(i,va);getVertex(i+1,vb);getVertex(i+2,vc);
        d+=dxfModelFace(layer,toDxf(va),toDxf(vb),toDxf(vc));faces++;
      }
    }
  });
  d+='0\r\nENDSEC\r\n0\r\nEOF\r\n';
  return {text:d,pieces:meshes.length,faces};
}
function designLabIsMobileLike(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(navigator.maxTouchPoints>1&&innerWidth<900);
}
async function saveStlBinaryReliable(blob,filename){
  if(!(blob instanceof Blob)||blob.size<84)throw new Error('O STL foi gerado vazio');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(bytes.byteLength!==blob.size||bytes.byteLength<84)throw new Error('Falha ao preparar os bytes do STL');
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tri=dv.getUint32(80,true),meshBytes=84+tri*50;
  if(!tri||meshBytes>bytes.byteLength)throw new Error('A malha STL gerada está inválida');

  // Android/WebView: FileSystemWritableFileStream pode criar o nome do arquivo
  // e deixar 0 B mesmo quando o Blob está correto. Para STL binário não usamos
  // esse caminho no mobile. Entregamos um File real ao sistema (Compartilhar/
  // Salvar em Arquivos) e, se não houver suporte, usamos download Blob.
  if(designLabIsMobileLike()){
    const stableBlob=new Blob([bytes],{type:'application/octet-stream'});
    if(typeof File==='function'&&typeof navigator.share==='function'){
      const file=new File([stableBlob],exportLeafName(filename),{type:'application/octet-stream',lastModified:Date.now()});
      if(file.size!==bytes.byteLength)throw new Error('O Android não conseguiu montar o arquivo STL');
      try{
        if(typeof navigator.canShare!=='function'||navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:exportLeafName(filename)});
          return {mode:'share',locationLabel:'Android · escolha Arquivos/Drive para salvar',size:file.size};
        }
      }catch(err){
        if(err?.name==='AbortError')throw err;
      }
    }
    const r=downloadExportFallback(stableBlob,filename);
    return {...r,size:stableBlob.size};
  }

  // Desktop: gravação direta com Blob e truncate explícito.
  const target=await pickExportTarget(filename,'designlab-export-movel-stl','application/octet-stream');
  let writable=null;
  try{
    if(!target?.handle||typeof target.handle.createWritable!=='function')throw new Error('Destino sem suporte a gravação direta.');
    writable=await target.handle.createWritable({keepExistingData:false});
    await writable.write({type:'write',position:0,data:new Blob([bytes],{type:'application/octet-stream'})});
    if(typeof writable.truncate==='function')await writable.truncate(bytes.byteLength);
    await writable.close();writable=null;
    if(typeof target.handle.getFile==='function'){
      const saved=await target.handle.getFile();
      if(!saved||saved.size!==bytes.byteLength)throw new Error(`Arquivo salvo incompleto (${saved?.size||0} B de ${bytes.byteLength} B)`);
    }
    return {mode:'direct',locationLabel:target.locationLabel||'local escolhido',size:bytes.byteLength};
  }catch(err){
    try{if(writable&&typeof writable.abort==='function')await writable.abort();}catch{}
    throw err;
  }
}
async function exportSelectedFurniture(){
  const root=selectedFurnitureRoot(); if(!root){toast('Selecione um espaço do móvel');return;}
  const filename=`${safeFileName(root.name,'movel')}.stl`;
  try{
    // STL preserva a malha 3D real do móvel. DXF continua reservado ao Aspire/CNC.
    const model=buildFurnitureModelStl(root);
    if(!model?.bytes?.byteLength||model.bytes.byteLength<84)throw new Error('O STL foi gerado vazio');
    const blob=new Blob([model.bytes],{type:'application/octet-stream'});
    if(blob.size!==model.bytes.byteLength)throw new Error('Falha ao montar o arquivo STL');
    const generatedKb=Math.max(1,Math.round(blob.size/1024));
    toast(`STL pronto · ${generatedKb} KB · salvando...`);
    const saveResult=await saveStlBinaryReliable(blob,filename);
    const savedBytes=Number(saveResult?.size)||blob.size;
    const kb=Math.max(1,Math.round(savedBytes/1024));
    toast(`Modelo STL salvo · ${kb} KB · ${model.pieces} peça(s) · ${model.triangles} triângulo(s) · ${saveResult.locationLabel}`);
  }catch(err){
    if(isExportPickerCancel(err)){toast('Exportação cancelada');return;}
    toast(err.message||'Não foi possível exportar o modelo em STL');
  }
}
function projectMaxX(){
  let max=0,has=false;
  for(const r of spaceRoots){ max=Math.max(max,r.x+r.width/2); has=true; }
  for(const o of objects){ const b=objectBounds(o); max=Math.max(max,b.maxX); has=true; }
  return has?max:0;
}
function importFurnitureData(data){
  if(!data || !Array.isArray(data.spaces) || !data.spaces.length || !Array.isArray(data.objects)) throw new Error('Arquivo não contém um móvel válido');
  mergeProjectProductionState(data.production);
  const src=JSON.parse(JSON.stringify(data.spaces[0]));
  const w=Number(src.width),d=Number(src.depth),h=Number(src.height),sx=Number(src.x),sy=Number(src.yBase),sz=Number(src.z);
  if(![w,d,h,sx,sy,sz].every(Number.isFinite)||w<=0||d<=0||h<=0) throw new Error('Medidas do móvel inválidas');
  const srcMinX=sx-w/2, srcMinY=sy, srcMinZ=sz-d/2;
  const hasScene=spaceRoots.length||objects.length;
  const dstMinX=hasScene?projectMaxX()+.2:0, dstMinY=0, dstMinZ=0;
  const dx=dstMinX-srcMinX,dy=dstMinY-srcMinY,dz=dstMinZ-srcMinZ;
  const newRootId=uid('space'),cellIdMap=new Map();
  const importedCells=(src.cells||[]).map(c=>{const nid=uid('cell');cellIdMap.set(c.id,nid);return {...c,id:nid,minX:Number(c.minX)+dx,maxX:Number(c.maxX)+dx,minY:Number(c.minY)+dy,maxY:Number(c.maxY)+dy,minZ:Number(c.minZ)+dz,maxZ:Number(c.maxZ)+dz,fixedAxes:{...(c.fixedAxes||{})}};});
  const rootData={...src,id:newRootId,name:data.name||src.name||'Móvel importado',x:sx+dx,yBase:sy+dy,z:sz+dz,doorsHidden:!!src.doorsHidden,spaceHidden:false,
    fixedBands:{x:(src.fixedBands?.x||[]).map(v=>[...v]),y:(src.fixedBands?.y||[]).map(v=>[...v]),z:(src.fixedBands?.z||[]).map(v=>[...v])},
    cells:importedCells};
  historyMuted=true;
  const root=createSpaceFromState(rootData);
  for(const p of data.objects){
    const ww=Number(p.width),dd=Number(p.depth),hh=Number(p.height),xx=Number(p.x)+dx,yy=Number(p.yBase)+dy,zz=Number(p.z)+dz;
    if(![ww,dd,hh,xx,yy,zz].every(Number.isFinite)||ww<=0||dd<=0||hh<=0)continue;
    let createdPart=null;
    if(p.kind==='cylinder') createdPart=createCylinder({diameter:ww,height:hh,x:xx,yBase:yy,z:zz,name:p.name||'Cilindro'},false);
    else if(p.kind==='curved-panel'&&p.customProfile?.cfg){const cc=JSON.parse(JSON.stringify(p.customProfile.cfg));cc.targetRootId=newRootId;cc.targetCellId=cellIdMap.get(cc.targetCellId)||cc.targetCellId;createdPart=createCurvedRib({cfg:cc,yBase:yy,x:xx,z:zz,name:p.name||'Nervura curva',spaceRootId:newRootId,part:p.customProfile.part||p.curvedPart||'full'},false);}
    else if(p.curvedRole==='cover'&&p.curvedConfig){const cc=JSON.parse(JSON.stringify(p.curvedConfig));cc.targetRootId=newRootId;cc.targetCellId=cellIdMap.get(cc.targetCellId)||cc.targetCellId;createdPart=createCurvedCover({cfg:cc,yBase:yy,x:xx,z:zz,name:p.name||'Capa externa',spaceRootId:newRootId,part:p.curvedPart||p.curvedConfig.coverPart||'full'},false);}
    else if(p.curvedRole==='post'&&p.curvedConfig){
      const cc=JSON.parse(JSON.stringify(p.curvedConfig));cc.targetRootId=newRootId;cc.targetCellId=cellIdMap.get(cc.targetCellId)||cc.targetCellId;
      const samples=curvedPostSamplesMm(cc),tag=cc.postStructuralTag||null;
      let sm=Number.isInteger(Number(cc.postSampleIndex))?samples[Number(cc.postSampleIndex)]:null;
      if(!sm&&tag){const same=samples.filter(s=>s.structuralTag===tag);if(same.length===1)sm=same[0];}
      if(sm){
        const plc=curvedPostPlacementFromSampleMm(cc,sm);
        const rx=(root.x+(plc.x-cc.targetW/2)*MM_TO_M),rz=(root.z+(plc.z-cc.targetD/2)*MM_TO_M);
        createdPart=createCurvedPost({cfg:cc,yBase:yy,x:rx,z:rz,name:p.name||'Montante curvo',spaceRootId:newRootId,rotationY:plc.rotationY},false);
      }else createdPart=createCurvedPost({cfg:cc,yBase:yy,x:xx,z:zz,name:p.name||'Montante curvo',spaceRootId:newRootId,rotationY:p.rotationY||0},false);
    }
    else {
      const dc=p.drawerConfig?JSON.parse(JSON.stringify(p.drawerConfig)):null;
      if(dc){dc.targetRootId=newRootId;dc.targetCellId=cellIdMap.get(dc.targetCellId)||dc.targetCellId;}
      const doorCfg=p.doorConfig?JSON.parse(JSON.stringify(p.doorConfig)):null;
      createdPart=createBox({width:ww,depth:dd,height:hh,x:xx,yBase:yy,z:zz,name:p.name||'Peça',kind:p.kind||'box',materialType:p.materialType||'genérico',baseColor:p.baseColor??COLORS.default,materialId:p.materialId||null,materialCode:p.materialCode||'',materialGrain:!!p.materialGrain,materialGrainRotation:normalizePieceGrainRotation(p.materialGrainRotation),materialCoreColor:p.materialCoreColor||null,edgeBands:p.edgeBands||{},partId:p.partId||null,labelMeta:p.labelMeta||null,spaceRootId:newRootId,machining:p.machining||[],forms:p.forms||[],rotationY:p.rotationY||0,curvedRole:p.curvedRole||null,curvedConfig:p.curvedConfig||null,drawerSetId:p.drawerSetId||null,drawerRole:p.drawerRole||null,drawerIndex:p.drawerIndex??null,drawerConfig:dc,doorConfig:doorCfg,excludeFromCutList:!!p.excludeFromCutList,spaceCutting:!!p.spaceCutting,spaceCutParentBounds:p.spaceCutParentBounds||null},false);
    }
    if(createdPart)copyLibraryPartMeta(createdPart,p);
  }
  repairOrphanSpaceGaps(root);
  renderSpaces(); applyAllDoorVisibility(); renderMachiningVisuals();
  const firstVisible=root.cells.find(c=>!c.hidden)||root.cells[0]; if(firstVisible)selectSpaceCellByIds(root.id,firstVisible.id);
  frontViewToSpace(root); historyMuted=false; commitHistory();
  toast(`Móvel importado · ${data.objects.length} peça(s)`);
}
function flatPartInfo(o,index){
  const u=o.userData;if(u?.excludeFromCutList||u?.kind==='hardware-visual')return null;const ti=pieceThicknessInfo(o); if(!ti)return null;
  const cp=u.customProfile||null,fp=u.formProfile||null;
  const postProfile=(!cp&&u.curvedRole==='post'&&u.curvedConfig)?curvedPostOutlineMm(u.curvedConfig):null;
  return {
    index,name:u.name||`Peça ${index}`,
    material:u.materialType||'MDF',materialId:u.materialId||null,materialCode:u.materialCode||'',materialGrain:!!u.materialGrain,materialGrainRotation:normalizePieceGrainRotation(u.materialGrainRotation),
    partId:u.partId||'',edgeBands:productionClone(u.edgeBands||{}),edgeBandSignature:pieceEdgeBandSignature(o),edgeBandSummary:pieceEdgeBandSummary(o),
    thickness:ti.thickness,faceW:cp?.bboxW||fp?.bboxW||postProfile?.bboxW||ti.faceW,faceH:cp?.bboxH||fp?.bboxH||postProfile?.bboxH||ti.faceH,
    thicknessAxis:cp?'y':ti.thicknessAxis,uAxis:cp?'x':ti.uAxis,vAxis:cp?'z':ti.vAxis,dims:ti.dims,object:o,
    machining:cloneMachining(u.machining||[]),
    customOutline:fp?.points?JSON.parse(JSON.stringify(fp.points)):(cp?.points?JSON.parse(JSON.stringify(cp.points)):(postProfile?.points?JSON.parse(JSON.stringify(postProfile.points)):null)),
    customSlots:cp?.slots?JSON.parse(JSON.stringify(cp.slots)):null,spaceName:'',spaceRootId:u.spaceRootId||''
  };
}
function layerNum(v){const n=roundMmNumber(Number(v),3);return String(n).replace('.', 'p');}
function normalizedLayer(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,80);}
function dxfPair(code,value){ return `${code}\n${value}\n`; }
function dxfLine(layer,x1,y1,x2,y2){
  return dxfPair(0,'LINE')+dxfPair(8,layer)+
    dxfPair(10,x1)+dxfPair(20,y1)+dxfPair(30,0)+
    dxfPair(11,x2)+dxfPair(21,y2)+dxfPair(31,0);
}
function dxfClosedRect(layer,x,y,w,h){
  let s=''; s+=dxfPair(0,'POLYLINE')+dxfPair(8,layer)+dxfPair(66,1)+dxfPair(70,1)+dxfPair(10,0)+dxfPair(20,0)+dxfPair(30,0);
  for(const [vx,vy] of [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]) s+=dxfPair(0,'VERTEX')+dxfPair(8,layer)+dxfPair(10,vx.toFixed(3))+dxfPair(20,vy.toFixed(3))+dxfPair(30,0);
  s+=dxfPair(0,'SEQEND')+dxfPair(8,layer); return s;
}
function dxfClosedPolyline(layer,points){
  let s='';s+=dxfPair(0,'POLYLINE')+dxfPair(8,layer)+dxfPair(66,1)+dxfPair(70,1)+dxfPair(10,0)+dxfPair(20,0)+dxfPair(30,0);
  for(const [vx,vy] of points)s+=dxfPair(0,'VERTEX')+dxfPair(8,layer)+dxfPair(10,Number(vx).toFixed(3))+dxfPair(20,Number(vy).toFixed(3))+dxfPair(30,0);
  s+=dxfPair(0,'SEQEND')+dxfPair(8,layer);return s;
}
function dxfCircle(layer,x,y,r){return dxfPair(0,'CIRCLE')+dxfPair(8,layer)+dxfPair(10,x.toFixed(3))+dxfPair(20,y.toFixed(3))+dxfPair(30,0)+dxfPair(40,r.toFixed(3));}
function machiningLayer(part,op){
  const da=entryAxisName(op.entryAxis),face=entryAxisSign(op.entryAxis)>0?'A':'B';
  if(op.type==='hole'&&da!==part.thicknessAxis)return normalizedLayer(`FURO_BORDA_${axisLabel(da)}_${entryAxisSign(op.entryAxis)>0?'POS':'NEG'}_D${layerNum(op.diameter)}_P${layerNum(operationDepthMm(part.object,op))}`);
  if(op.type==='hole')return normalizedLayer(`FURO_${face}_D${layerNum(op.diameter)}_P${layerNum(operationDepthMm(part.object,op))}`);
  return normalizedLayer(`${op.preset==='back-groove'||op.preset==='drawer-bottom-groove'?'RASGO_FUNDO':'RASGO'}_${face}_W${layerNum(op.width)}_P${layerNum(operationDepthMm(part.object,op))}`);
}
function mapPlacedUV(part,placed,u,v){
  if(!placed.rotated) return {x:placed.x+u,y:placed.y+v};
  // Rotação de 90° no plano da chapa. A peça continua com as mesmas faces/usinagens.
  return {x:placed.x+v,y:placed.y+part.faceW-u};
}
function projectOperation(part,op,placed){
  if(op.type==='hole'&&entryAxisName(op.entryAxis)!==part.thicknessAxis)return []; // furo de borda: permanece no CSV; requer usinagem lateral/virada da peça
  if(op.type==='hole')return holeSeriesInstances(part.object,op).map(coord=>{const p=mapPlacedUV(part,placed,coord[part.uAxis],coord[part.vAxis]);return {kind:'circle',layer:machiningLayer(part,op),x:p.x,y:p.y,r:Number(op.diameter)/2};});
  const coord=resolvedMachiningCoords(part.object,op); const la=op.lengthAxis;
  const startU=coord[part.uAxis],startV=coord[part.vAxis];
  const rectW=la===part.uAxis?Number(op.length):Number(op.width),rectH=la===part.vAxis?Number(op.length):Number(op.width);
  const pts=[mapPlacedUV(part,placed,startU,startV),mapPlacedUV(part,placed,startU+rectW,startV),mapPlacedUV(part,placed,startU+rectW,startV+rectH),mapPlacedUV(part,placed,startU,startV+rectH)];
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y); return [{kind:'rect',layer:machiningLayer(part,op),x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}];
}

// ============================================================================
// v95 · PRÉVIA ASPIRE
// A tela e o DXF consomem esta mesma função de entidades.
// ============================================================================
let sheetPreviewGroups=[],sheetPreviewIndex=0,sheetPreviewFace='ALL',sheetPreviewSelectedPart=null,sheetPreviewIsolated=false,sheetPreviewView=null,sheetPreviewLastTransform=null;

function buildAspireSheetEntities(placed,cfg,cuts=[]){
  const entities=[{kind:'rect',layer:'CHAPA_REFERENCIA',x:0,y:0,w:cfg.width,h:cfg.height}],layers=new Set(['CHAPA_REFERENCIA','CORTE_EXTERNO']);
  for(const p of placed){
    if(p.customOutline){
      const mapPt=([u,v])=>p.rotated?[p.x+v,p.y+p.faceW-u]:[p.x+u,p.y+v];
      entities.push({kind:'poly',layer:'CORTE_EXTERNO',points:p.customOutline.map(mapPt),part:p,role:'outline'});
      if(p.customSlots?.length){layers.add('ENCAIXE_MONTANTE');for(const slot of p.customSlots)entities.push({kind:'poly',layer:'ENCAIXE_MONTANTE',points:slot.map(mapPt),part:p,role:'slot'});}
    }else entities.push({kind:'rect',layer:'CORTE_EXTERNO',x:p.x,y:p.y,w:p.placedW,h:p.placedH,part:p,role:'outline'});
    for(const op of p.machining)for(const e of projectOperation(p,op,p)){if(e){e.part=p;e.op=op;e.role='machining';entities.push(e);layers.add(e.layer);}}
  }
  if(cfg.cutMode==='panel'&&cuts.length){
    layers.add('CORTE_SECCIONADORA');
    for(const cut of cuts){
      entities.push({
        kind:'line',layer:'CORTE_SECCIONADORA',
        x1:cut.x1,y1:cut.y1,x2:cut.x2,y2:cut.y2,
        cut
      });
    }
  }
  const expectedFaceHoles=placed.reduce((n,p)=>n+p.machining.filter(op=>op.type==='hole'&&entryAxisName(op.entryAxis)===p.thicknessAxis).reduce((a,op)=>a+holeSeriesInstances(p.object,op).length,0),0);
  const circleCount=entities.filter(e=>e.kind==='circle').length;
  return {entities,layers:[...layers],circleCount,expectedFaceHoles};
}
function previewEntityFace(e){
  if(!e?.op)return 'ALL';
  if(entryAxisName(e.op.entryAxis)!==e.part.thicknessAxis)return 'EDGE';
  return entryAxisSign(e.op.entryAxis)>0?'A':'B';
}
function previewEdgeHoleMarkers(part){
  const out=[];
  for(const op of (part.machining||[])){
    if(op.type!=='hole'||entryAxisName(op.entryAxis)===part.thicknessAxis)continue;
    for(const coord of holeSeriesInstances(part.object,op)){
      const q=mapPlacedUV(part,part,coord[part.uAxis],coord[part.vAxis]);out.push({x:q.x,y:q.y,part,op});
    }
  }
  return out;
}
function sheetPreviewStats(group){
  let holesA=0,holesB=0,edge=0,groovesA=0,groovesB=0,slots=0;
  for(const p of group.parts){
    slots+=p.customSlots?.length||0;
    for(const op of (p.machining||[])){
      if(op.type==='hole'){
        const qty=holeSeriesInstances(p.object,op).length;
        if(entryAxisName(op.entryAxis)!==p.thicknessAxis)edge+=qty;
        else if(entryAxisSign(op.entryAxis)>0)holesA+=qty;else holesB+=qty;
      }else if(entryAxisName(op.entryAxis)===p.thicknessAxis){
        if(entryAxisSign(op.entryAxis)>0)groovesA++;else groovesB++;
      }
    }
  }
  const mismatch=Number(group.circleCount||0)!==Number(group.expectedFaceHoles||0);
  return {holesA,holesB,edge,groovesA,groovesB,slots,mismatch,errors:mismatch?1:0};
}
function sheetPreviewFaceVisible(e){
  if(e.layer==='CHAPA_REFERENCIA'||e.layer==='CORTE_EXTERNO'||e.layer==='ENCAIXE_MONTANTE'||e.layer==='CORTE_SECCIONADORA')return true;
  return sheetPreviewFace==='ALL'||previewEntityFace(e)===sheetPreviewFace;
}
function sheetPreviewPlacedOutline(p){
  if(!p?.customOutline?.length)return null;
  return p.customOutline.map(([u,v])=>p.rotated?[p.x+v,p.y+p.faceW-u]:[p.x+u,p.y+v]);
}
function sheetPreviewPartBounds(p){
  const pts=sheetPreviewPlacedOutline(p);
  if(pts?.length){
    const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]);
    return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  }
  return {x:p.x,y:p.y,w:p.placedW,h:p.placedH};
}
function pointInPreviewPart(p,x,y){
  const pts=sheetPreviewPlacedOutline(p);
  if(pts?.length){
    let inside=false;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){const xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi||1e-9)+xi))inside=!inside;}
    return inside;
  }
  return x>=p.x&&x<=p.x+p.placedW&&y>=p.y&&y<=p.y+p.placedH;
}
function polygonAreaMm2(points){
  if(!points?.length)return 0;let a=0;
  for(let i=0,j=points.length-1;i<points.length;j=i++)a+=Number(points[j][0])*Number(points[i][1])-Number(points[i][0])*Number(points[j][1]);
  return Math.abs(a)/2;
}
function cutPlanPartAreaMm2(p){
  if(!p?.customOutline?.length)return Math.max(0,Number(p?.faceW)||0)*Math.max(0,Number(p?.faceH)||0);
  let area=polygonAreaMm2(p.customOutline);
  for(const slot of (p.customSlots||[]))area-=polygonAreaMm2(slot);
  return Math.max(0,area);
}
function sheetPreviewViewport(group,cfg){
  if(sheetPreviewIsolated&&sheetPreviewSelectedPart){
    const b=sheetPreviewPartBounds(sheetPreviewSelectedPart),pad=Math.max(30,Math.min(b.w,b.h)*.12);
    const x=Math.max(0,b.x-pad),y=Math.max(0,b.y-pad),r=Math.min(cfg.width,b.x+b.w+pad),t=Math.min(cfg.height,b.y+b.h+pad);
    return {x,y,w:Math.max(1,r-x),h:Math.max(1,t-y)};
  }
  return {x:0,y:0,w:cfg.width,h:cfg.height};
}
function sheetPreviewCanvasSize(){
  const canvas=$('sheetPreviewCanvas'),wrap=canvas.parentElement,r=wrap.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),cssW=Math.max(300,Math.floor(r.width-20)),cssH=Math.max(280,Math.floor(r.height-20));
  if(canvas.width!==Math.floor(cssW*dpr)||canvas.height!==Math.floor(cssH*dpr)){canvas.width=Math.floor(cssW*dpr);canvas.height=Math.floor(cssH*dpr);canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';}
  return {canvas,cssW,cssH,dpr};
}
function sheetPreviewCutMetrics(group,cfg){
  const area=group.parts.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0);
  const usable=Math.max(1,(cfg.width-2*cfg.margin)*(cfg.height-2*cfg.margin));
  const cuts=group.panelCuts||[];
  const cutLength=cuts.reduce((n,c)=>n+Number(c.length||0),0);
  const primaryCuts=cuts.filter(c=>(Number(c.depth)||0)===0).length;
  const leftovers=(group.leftovers||[]).filter(r=>r.w>.5&&r.h>.5);
  const keep=leftovers.filter(r=>r.keep).sort((a,b)=>b.w*b.h-a.w*a.h);
  return {area,usable,pct:area/usable*100,cuts,cutLength,primaryCuts,leftovers,keep};
}
function drawSheetLeftover(ctx,r,sx,sy,scale,keep){
  const x=sx(r.x),y=sy(r.y+r.h),w=r.w*scale,h=r.h*scale;
  if(w<1||h<1)return;
  ctx.save();
  ctx.fillStyle=keep?'rgba(86,148,100,.10)':'rgba(110,118,124,.045)';
  ctx.strokeStyle=keep?'rgba(67,130,82,.62)':'rgba(115,122,128,.34)';
  ctx.lineWidth=1;ctx.setLineDash(keep?[5,4]:[3,4]);ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
  ctx.clip();ctx.setLineDash([]);ctx.strokeStyle=keep?'rgba(67,130,82,.20)':'rgba(120,126,132,.13)';ctx.lineWidth=1;
  for(let d=-h;d<w+h;d+=10){ctx.beginPath();ctx.moveTo(x+d,y+h);ctx.lineTo(x+d+h,y);ctx.stroke();}
  ctx.restore();
}
function drawSheetCutLine(ctx,cut,sx,sy,mode){
  const depth=Number(cut.depth)||0;
  const primary=depth===0;
  ctx.save();
  ctx.strokeStyle=primary?'#d95f59':'#4f9c69';
  ctx.lineWidth=primary?1.8:1.35;
  ctx.setLineDash(mode==='panel'?[6,4]:[]);
  ctx.beginPath();ctx.moveTo(sx(cut.x1),sy(cut.y1));ctx.lineTo(sx(cut.x2),sy(cut.y2));ctx.stroke();
  const mx=(sx(cut.x1)+sx(cut.x2))/2,my=(sy(cut.y1)+sy(cut.y2))/2;
  ctx.setLineDash([]);
  if(cut.length>35){
    const txt=nice(cut.length);
    ctx.font='700 7px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    const tw=ctx.measureText(txt).width+6;
    ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(mx-tw/2,my-5,tw,10);
    ctx.fillStyle=primary?'#9a3d38':'#2f7046';ctx.fillText(txt,mx,my+.3);
  }
  ctx.restore();
}
function legacyV41_sheetPreviewDraw(){
  const group=sheetPreviewGroups[sheetPreviewIndex],cfg=getSheetPrefs(),size=sheetPreviewCanvasSize(),canvas=size.canvas,cssW=size.cssW,cssH=size.cssH,dpr=size.dpr,ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
  if(!group){$('sheetPreviewEmpty').style.display='grid';return}
  $('sheetPreviewEmpty').style.display='none';
  const view=sheetPreviewViewport(group,cfg);sheetPreviewView=view;
  const pad=34,scale=Math.min((cssW-pad*2)/view.w,(cssH-pad*2)/view.h),ox=(cssW-view.w*scale)/2-view.x*scale,oy=(cssH-view.h*scale)/2+(view.y+view.h)*scale;
  const sx=x=>ox+x*scale,sy=y=>oy-y*scale;sheetPreviewLastTransform={scale,ox,oy,sx,sy,cssW,cssH};

  const x0=sx(0),x1=sx(cfg.width),y0=sy(0),y1=sy(cfg.height);
  ctx.save();ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=14;ctx.fillStyle='#fbfaf5';ctx.fillRect(x0,y1,x1-x0,y0-y1);ctx.restore();
  ctx.strokeStyle='#60686d';ctx.lineWidth=1.5;ctx.strokeRect(x0,y1,x1-x0,y0-y1);

  // Dimensões externas da chapa, como em um diagrama de corte técnico.
  ctx.save();ctx.fillStyle='#d9dee1';ctx.font='700 8px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText(nice(cfg.width), (x0+x1)/2, y1-5);
  ctx.translate(x0-8,(y0+y1)/2);ctx.rotate(-Math.PI/2);ctx.fillText(nice(cfg.height),0,0);ctx.restore();

  // Área útil após o refilo.
  ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle='rgba(104,112,118,.48)';ctx.lineWidth=1;
  ctx.strokeRect(sx(cfg.margin),sy(cfg.height-cfg.margin),(cfg.width-2*cfg.margin)*scale,(cfg.height-2*cfg.margin)*scale);ctx.restore();

  // Sobras/retalhos do plano guilhotina.
  if(cfg.cutMode!=='cnc')for(const r of (group.leftovers||[]))drawSheetLeftover(ctx,r,sx,sy,scale,!!r.keep);

  for(const e of group.previewEntities||[]){
    if(e.layer==='CHAPA_REFERENCIA'||e.layer==='CORTE_SECCIONADORA'||!sheetPreviewFaceVisible(e))continue;
    let stroke='#25292c',fill=null,line=1.1;
    if(e.layer==='CORTE_EXTERNO'){
      stroke=e.part===sheetPreviewSelectedPart?'#1677d2':'#2f3437';
      fill=e.part===sheetPreviewSelectedPart?'rgba(22,119,210,.14)':'rgba(40,45,48,.035)';
      line=e.part===sheetPreviewSelectedPart?2.2:1.05;
    }else if(e.layer.startsWith('FURO_')){stroke='#d62d7b';line=1.8}
    else if(e.layer.startsWith('RASGO')){stroke='#0099c7';fill='rgba(0,153,199,.10)';line=1.8}
    else if(e.layer==='ENCAIXE_MONTANTE'){stroke='#bf8a00';fill='rgba(218,168,16,.10)';line=1.6}
    else{stroke='#7b43d1';line=1.5}
    ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=line;if(fill)ctx.fillStyle=fill;
    if(e.kind==='circle'){ctx.beginPath();ctx.arc(sx(e.x),sy(e.y),Math.max(2,e.r*scale),0,Math.PI*2);if(fill)ctx.fill();ctx.stroke()}
    else if(e.kind==='rect'){const rx=sx(e.x),ry=sy(e.y+e.h),rw=e.w*scale,rh=e.h*scale;if(fill)ctx.fillRect(rx,ry,rw,rh);ctx.strokeRect(rx,ry,rw,rh)}
    else if(e.kind==='poly'&&e.points?.length){ctx.beginPath();e.points.forEach((pt,i)=>{const x=sx(pt[0]),y=sy(pt[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();if(fill)ctx.fill();ctx.stroke()}
    ctx.restore();
  }

  // Cortes guilhotina ficam visíveis no plano, mas o fluxo Aspire continua
  // usando suas próprias layers/regras de exportação.
  if(cfg.cutMode!=='cnc')for(const cut of (group.panelCuts||[]))drawSheetCutLine(ctx,cut,sx,sy,cfg.cutMode);

  if($('sheetPreviewEdgeHoles').checked)for(const p of group.parts)for(const mk of previewEdgeHoleMarkers(p)){const x=sx(mk.x),y=sy(mk.y),r=5;ctx.save();ctx.fillStyle='#ff8b1f';ctx.strokeStyle='#542900';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y+r);ctx.lineTo(x-r,y+r);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}

  if($('sheetPreviewLabels').checked){
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    for(const p of group.parts){
      const b=sheetPreviewPartBounds(p),cx=sx(b.x+b.w/2),cy=sy(b.y+b.h/2),pxW=b.w*scale,pxH=b.h*scale;
      if(pxW<28||pxH<20)continue;
      const code=String(p.diagramCode||'');
      const count=p.diagramQty>1?`${p.diagramSeq}/${p.diagramQty}`:'';
      const codeFs=Math.max(10,Math.min(22,Math.min(pxW/4,pxH/2.8)));
      ctx.font=`800 ${codeFs}px system-ui,sans-serif`;ctx.fillStyle='#1f2326';
      const main=cfg.cutMode==='cnc'&&p.cutOrder?`#${p.cutOrder} · ${code}`:code;
      ctx.fillText(main,cx,cy-(pxH>48?codeFs*.20:0));
      if(pxW>58&&pxH>40){
        const fs=Math.max(7,Math.min(9,pxW/18));
        ctx.font=`700 ${fs}px system-ui,sans-serif`;ctx.fillStyle='#4f585d';
        ctx.fillText(`${String(p.name||'Peça').slice(0,22)}${count?' · '+count:''}`,cx,cy+codeFs*.72);
      }
      if(pxW>62){ctx.font='700 7px system-ui,sans-serif';ctx.fillStyle='#697176';ctx.fillText(nice(p.placedW),cx,sy(b.y+b.h)+8)}
      if(pxH>62){ctx.save();ctx.translate(sx(b.x)+8,cy);ctx.rotate(-Math.PI/2);ctx.font='700 7px system-ui,sans-serif';ctx.fillStyle='#697176';ctx.fillText(nice(p.placedH),0,0);ctx.restore()}
    }
    ctx.restore();
  }
  renderSheetPreviewSide();
}
function renderSheetPreviewLeftovers(group,cfg){
  const box=$('sheetPreviewLeftovers');if(!box)return;
  if(cfg.cutMode==='cnc'){box.style.display='none';box.innerHTML='';return;}
  box.style.display='block';
  const m=sheetPreviewCutMetrics(group,cfg),keep=m.keep;
  const minText=`mín. ${nice(cfg.leftoverW)} × ${nice(cfg.leftoverH)} mm`;
  if(!keep.length){box.innerHTML=`<strong>Sobras aproveitáveis</strong><br>Nenhuma sobra atende ${minText}.`;return;}
  box.innerHTML=`<strong>Sobras para guardar · ${keep.length}</strong><br><span>${minText}</span>`+keep.slice(0,6).map((r,i)=>`<div class="sheetPreviewLeftoverRow"><span>${i+1}. ${nice(r.w)} × ${nice(r.h)} mm</span><b>${nice(r.w*r.h/1e6)} m²</b></div>`).join('')+(keep.length>6?`<div style="margin-top:4px">+ ${keep.length-6} sobra(s)</div>`:'');
}
function renderSheetPreviewSide(){
  const group=sheetPreviewGroups[sheetPreviewIndex],cfg=getSheetPrefs();if(!group)return;
  const st=sheetPreviewStats(group),m=sheetPreviewCutMetrics(group,cfg),status=$('sheetPreviewStatus');
  status.className='sheetPreviewStatus '+(st.errors?'bad':st.edge?'warn':'ok');
  const specialBlanks=group.parts.filter(p=>p.customOutline?.length).length;
  let modeLine='';
  if(cfg.cutMode==='ocl')modeLine=`<br><span style="color:#f0b24b">▦ Plano inteligente · guilhotina · ${group.panelCuts?.length||0} corte(s).</span>${specialBlanks?`<br><span style="color:#ffae52">⚠ ${specialBlanks} peça(s) com forma especial usam o blank retangular no encaixe.</span>`:''}`;
  else if(cfg.cutMode==='panel')modeLine=`<br><span style="color:#75a7ff">▰ Seccionadora · ${group.panelCuts?.length||0} corte(s) reto(s) sequenciados.</span>${specialBlanks?`<br><span style="color:#ffae52">⚠ ${specialBlanks} peça(s) com forma especial: a seccionadora corta o blank retangular; o contorno final exige CNC/fresa.</span>`:''}`;
  else modeLine=`<br><span style="color:#65e77c">◎ CNC · contorno real${specialBlanks?` em ${specialBlanks} peça(s) curva(s)/especial(is)`:''} · encaixe por forma + corte numerado centro → fora.</span>`;
  status.innerHTML=`<strong>${group.parts.length} peça(s)</strong> · aproveitamento <b>${nice(m.pct)}%</b>${modeLine}<br>Furos face A: <b>${st.holesA}</b> · face B: <b>${st.holesB}</b><br>Rasgos A: <b>${st.groovesA}</b> · rasgos B: <b>${st.groovesB}</b>${st.slots?` · encaixes: <b>${st.slots}</b>`:''}<br>${st.edge?`<span style="color:#ffae52">⚠ ${st.edge} furo(s) de borda exigem usinagem lateral/virar peça.</span><br>`:''}${st.errors?`<span style="color:#ff6a64">✕ Divergência: DXF tem ${group.circleCount} círculos, esperado ${group.expectedFaceHoles}.</span>`:`<span style="color:#65e77c">✓ Conferência DXF: ${group.circleCount} círculo(s) de furação projetados.</span>`}`;

  const metric=$('sheetPreviewCutSummary');
  const waste=Math.max(0,m.usable-m.area);
  const optLabel=cfg.optimization==='advanced'?'Avançada':'Normal';
  metric.innerHTML=`<div class="sheetPreviewMetric"><b>${nice(m.cutLength/1000)} m</b><span>comprimento de corte</span></div><div class="sheetPreviewMetric"><b>${m.cuts.length}</b><span>cortes${m.primaryCuts?` · ${m.primaryCuts} primário(s)`:''}</span></div><div class="sheetPreviewMetric"><b>${nice(waste/1e6)} m²</b><span>área não usada</span></div><div class="sheetPreviewMetric"><b>${cfg.cutMode==='ocl'?optLabel:sheetCutModeLabel(cfg)}</b><span>${cfg.cutMode==='ocl'?'otimização':'modo'}</span></div>`;

  $('sheetPanelSawLegend').style.display=cfg.cutMode==='cnc'?'none':'grid';
  $('sheetPreviewModeText').textContent=cfg.cutMode==='ocl'
    ? `Plano inteligente · guilhotina · otimização ${optLabel.toLowerCase()} · direção ${cfg.preference==='auto'?'automática':cfg.preference==='length'?'comprimento':cfg.preference==='width'?'largura':'livre'}.`
    : cfg.cutMode==='panel'
      ? 'Seccionadora · cortes retos numerados em guilhotina.'
      : 'CNC · peças menores priorizadas perto do centro, com ordem centro → fora.';
  renderSheetPreviewLeftovers(group,cfg);

  const card=$('sheetPreviewPartCard'),p=sheetPreviewSelectedPart;
  if(!p||!group.parts.includes(p)){sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;card.innerHTML=`<h4>Nenhuma peça selecionada</h4><div class="meta">Toque em uma peça da chapa para conferir medidas e operações.</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary" disabled>Ampliar peça</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button></div>`}
  else{
    const ops=[];
    for(const op of (p.machining||[])){
      if(op.type==='hole'){const qty=holeSeriesInstances(p.object,op).length,edge=entryAxisName(op.entryAxis)!==p.thicknessAxis,face=edge?'BORDA':(entryAxisSign(op.entryAxis)>0?'A':'B');ops.push(`${qty} furo${qty===1?'':'s'} Ø${nice(op.diameter)} × ${nice(operationDepthMm(p.object,op))} mm · ${face}${edge?' · exige usinagem lateral':''}`)}
      else{const face=entryAxisSign(op.entryAxis)>0?'A':'B';ops.push(`${op.preset==='drawer-bottom-groove'?'Rasgo fundo gaveta':op.preset==='back-groove'?'Rasgo de fundo':'Rasgo'} ${nice(op.length)} × ${nice(op.width)} × ${nice(operationDepthMm(p.object,op))} mm · ${face}`)}
    }
    if(p.customSlots?.length)ops.push(`${p.customSlots.length} encaixe(s) de contorno · ENCAIXE_MONTANTE`);
    card.innerHTML=`<h4>${escapeHtml(p.diagramCode?`${p.diagramCode} · ${p.name||'Peça'}`:(p.name||'Peça'))}</h4><div class="meta">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm · ${escapeHtml(p.material||'MDF')}<br>${escapeHtml(p.spaceName||'')} · X ${nice(p.x)} / Y ${nice(p.y)}${p.rotated?' · girada 90°':''}${p.diagramQty>1?` · ${p.diagramSeq}/${p.diagramQty}`:''}${cfg.cutMode==='cnc'&&p.cutOrder?` · ordem CNC #${p.cutOrder}`:''}</div><div class="sheetPreviewPartOps">${ops.length?ops.map(x=>`<div class="sheetPreviewOp">${escapeHtml(x)}</div>`).join(''):'<div class="sheetPreviewOp">Sem usinagens nesta peça.</div>'}</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary">${sheetPreviewIsolated?'Voltar à chapa':'Ampliar peça'}</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button></div>`;
  }
  $('sheetPreviewIsolate').onclick=()=>{if(sheetPreviewSelectedPart){sheetPreviewIsolated=!sheetPreviewIsolated;sheetPreviewDraw()}};
  $('sheetPreviewFit').onclick=()=>{sheetPreviewIsolated=false;sheetPreviewDraw()};
  $('sheetPreviewSheetInfo').innerHTML=`<strong>${escapeHtml(group.key.replace(/_/g,' '))}</strong> · chapa ${group.sheetNo}/${group.totalSheets} · ${nice(cfg.width)} × ${nice(cfg.height)} mm · ${sheetCutModeLabel(cfg)}`;
  $('sheetPreviewFaceInfo').textContent=sheetPreviewFace==='ALL'?'Todas as faces':`Mostrando Face ${sheetPreviewFace}`;
}
function legacyV41_prepareSheetPreviewGroups(){
  const grooves=repairAllDrawerBottomGrooves();
  const repaired=repairAllDrawerDrillingForAspire();
  if(repaired.sets>0&&repaired.holes===0)throw new Error('Há gavetas com furação marcada, mas nenhum furo pôde ser ligado às laterais.');
  if(grooves.sets>0&&grooves.created!==grooves.expected)throw new Error(`Rasgos do fundo incompletos: ${grooves.created}/${grooves.expected}.`);
  const cfg=sheetPrefsFromUi();
  setSheetPrefs(cfg);
  const groups=groupAspireProjectParts(cfg);
  for(const g of groups){
    const data=buildAspireSheetEntities(g.parts,cfg,g.panelCuts||[]);
    g.previewEntities=data.entities;
    g.circleCount=data.circleCount;
    g.expectedFaceHoles=data.expectedFaceHoles;
  }
  return groups;
}
function legacyV41_refreshSheetPreviewSelect(){
  const sel=$('sheetPreviewSelect');sel.innerHTML='';
  sheetPreviewGroups.forEach((g,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${String(i+1).padStart(2,'0')} · ${g.key.replace(/_/g,' ')} · Chapa ${g.sheetNo}/${g.totalSheets} · ${g.parts.length} peças`;sel.appendChild(o)});
  sel.value=String(sheetPreviewIndex);$('sheetPreviewPrev').disabled=sheetPreviewIndex<=0;$('sheetPreviewNext').disabled=sheetPreviewIndex>=sheetPreviewGroups.length-1;
}
function legacyV41_openSheetPreview(){
  try{
    sheetPreviewGroups=prepareSheetPreviewGroups();
    if(!sheetPreviewGroups.length)throw new Error('Não há peças disponíveis para montar o plano de corte.');
    sheetPreviewIndex=Math.min(sheetPreviewIndex,Math.max(0,sheetPreviewGroups.length-1));
    sheetPreviewSelectedPart=null;
    sheetPreviewIsolated=false;
    sheetPreviewFace='ALL';
    document.querySelectorAll('[data-sheet-face]').forEach(b=>b.classList.toggle('active',b.dataset.sheetFace==='ALL'));
    refreshSheetPreviewSelect();
    $('sheetPreviewDialog').classList.add('show');
    requestAnimationFrame(sheetPreviewDraw);
  }catch(err){
    console.error('Prévia Aspire:',err);
    toast(err.message||'Não foi possível montar a prévia Aspire');
  }
}
function legacyV41_closeSheetPreview(){$('sheetPreviewDialog').classList.remove('show');sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;sheetPreviewLastTransform=null}
function legacyV41_selectSheetPreviewIndex(i){i=Math.max(0,Math.min(sheetPreviewGroups.length-1,Number(i)||0));if(i===sheetPreviewIndex)return;sheetPreviewIndex=i;sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw()}
function sheetPreviewPointerToWorld(e){const canvas=$('sheetPreviewCanvas'),r=canvas.getBoundingClientRect(),t=sheetPreviewLastTransform;if(!t)return null;const cx=(e.clientX-r.left)*(t.cssW/r.width),cy=(e.clientY-r.top)*(t.cssH/r.height);return{x:(cx-t.ox)/t.scale,y:(t.oy-cy)/t.scale}}

const SHEET_PREFS_KEY='miniCadProV50_sheetPrefs';
const LEGACY_SHEET_PREFS_KEY='miniCadProV49_sheetPrefs';
const LEGACY_SHEET_PREFS_KEY_V48='miniCadProV48_sheetPrefs';
const LEGACY_SHEET_PREFS_KEY_V46='miniCadProV46_sheetPrefs';
function normalizedSheetPrefs(raw={}){
  const num=(v,d,min=0)=>{v=Number(v);return Number.isFinite(v)?Math.max(min,v):d;};
  // v92:
  // grain=true  => material madeirado / sentido obrigatório => NÃO gira.
  // grain=false => material sem sentido obrigatório => o plano pode girar 90°.
  // Mantemos "rotate" calculado para compatibilidade com o restante do exportador.
  const grain=raw.grain===true;
  const cutMode=['open','panel','cnc'].includes(raw.cutMode)?raw.cutMode:'open';
  return {
    width:num(raw.width,2750,100),
    height:num(raw.height,1850,100),
    margin:num(raw.margin,10,0),
    gap:num(raw.gap,3,0),
    grain,
    grainDirection:raw.grainDirection==='width'?'width':'length',
    cutMode,
    panelFirst:['auto','length','width'].includes(raw.panelFirst)?raw.panelFirst:'auto',
    rotate:!grain
  };
}
function getSheetPrefs(){
  try{
    const raw=JSON.parse(localStorage.getItem(SHEET_PREFS_KEY)||localStorage.getItem(LEGACY_SHEET_PREFS_KEY)||localStorage.getItem(LEGACY_SHEET_PREFS_KEY_V48)||localStorage.getItem(LEGACY_SHEET_PREFS_KEY_V46)||'{}');
    return normalizedSheetPrefs(raw);
  }catch(_){return normalizedSheetPrefs();}
}
function setSheetPrefs(v){const p=normalizedSheetPrefs(v);localStorage.setItem(SHEET_PREFS_KEY,JSON.stringify(p));return p;}
function sheetPrefsFromUi(){
  return normalizedSheetPrefs({
    width:$('sheetWidth')?.value,
    height:$('sheetHeight')?.value,
    margin:$('sheetMargin')?.value,
    gap:$('sheetGap')?.value,
    grain:!!$('sheetGrain')?.checked,
    grainDirection:$('sheetGrainDirection')?.value==='width'?'width':'length',
    cutMode:$('sheetCutMode')?.value||'cnc',
    panelFirst:$('sheetPanelFirst')?.value||'auto'
  });
}
function applySheetPrefsToUi(p=getSheetPrefs()){
  if(!$('sheetWidth'))return;
  $('sheetWidth').value=p.width;
  $('sheetHeight').value=p.height;
  $('sheetMargin').value=p.margin;
  $('sheetGap').value=p.gap;
  $('sheetGrain').checked=!!p.grain;
  if($('sheetGrainDirection'))$('sheetGrainDirection').value=p.grainDirection==='width'?'width':'length';
  $('sheetCutMode').value=p.cutMode||'cnc';
  if($('sheetPanelFirst'))$('sheetPanelFirst').value=['length','width'].includes(p.panelFirst)?p.panelFirst:'auto';
  updateSheetCutModeUi();
}
function sheetPrefsForPartGroup(baseCfg,parts=[]){
  const cfg={...(baseCfg||{}),...normalizedSheetPrefs(baseCfg||{})};
  const linked=parts.find(p=>p?.materialId)?.materialId||null;
  const material=linked?productionMaterialById(linked):null;
  return {
    ...cfg,
    width:material?.sheetWidth||cfg.width,
    height:material?.sheetHeight||cfg.height,
    grainDirection:material?.grainDirection==='width'?'width':(material?.grainDirection==='length'?'length':cfg.grainDirection||'length'),
    sheetMaterialId:material?.id||null,
    sheetMaterialName:material?.name||''
  };
}
function partOrientations(part,cfg){
  const grainLocked=!!cfg.grain||!!part.materialGrain;
  const grainRot=normalizePieceGrainRotation(part.materialGrainRotation);
  // 1.100.95: na peça, VEIO 0° acompanha o eixo vertical da face (faceH) e
  // VEIO 90° acompanha o eixo horizontal (faceW). A chapa madeirada usa por
  // padrão o veio no COMPRIMENTO. O plano gira a peça só na chapa para alinhar
  // esses eixos; a geometria 3D nunca é alterada.
  if(grainLocked){
    const sheetAlongLength=(cfg.grainDirection||'length')!=='width';
    const pieceAlongFaceW=grainRot===90;
    const rotatePlacement=sheetAlongLength?!pieceAlongFaceW:pieceAlongFaceW;
    return rotatePlacement
      ? [{rotated:true,w:part.faceH,h:part.faceW,grainForced:true}]
      : [{rotated:false,w:part.faceW,h:part.faceH,grainForced:true}];
  }
  const a=[{rotated:false,w:part.faceW,h:part.faceH}];
  if(Math.abs(part.faceW-part.faceH)>.001)a.push({rotated:true,w:part.faceH,h:part.faceW});
  return a;
}
// ---------- v92: plano de corte inteligente (MaxRects) ----------
function sheetFreeRectContains(a,b){
  return b.x>=a.x-.001&&b.y>=a.y-.001&&b.x+b.w<=a.x+a.w+.001&&b.y+b.h<=a.y+a.h+.001;
}
function pruneSheetFreeRects(rects){
  const out=[];
  for(let i=0;i<rects.length;i++){
    const r=rects[i];
    if(!(r.w>.001&&r.h>.001))continue;
    let contained=false;
    for(let j=0;j<rects.length;j++){
      if(i===j)continue;
      if(sheetFreeRectContains(rects[j],r)){contained=true;break;}
    }
    if(!contained)out.push(r);
  }
  return out;
}
function splitSheetFreeRect(free,used){
  const fx=free.x,fy=free.y,fr=free.x+free.w,fb=free.y+free.h;
  const ux=used.x,uy=used.y,ur=used.x+used.w,ub=used.y+used.h;
  if(ux>=fr-.001||ur<=fx+.001||uy>=fb-.001||ub<=fy+.001)return [free];
  const out=[];
  if(ux>fx+.001)out.push({x:fx,y:fy,w:ux-fx,h:free.h});
  if(ur<fr-.001)out.push({x:ur,y:fy,w:fr-ur,h:free.h});
  if(uy>fy+.001)out.push({x:fx,y:fy,w:free.w,h:uy-fy});
  if(ub<fb-.001)out.push({x:fx,y:ub,w:free.w,h:fb-ub});
  return out;
}
function newSmartSheet(cfg){
  // A folga é incorporada na reserva da peça.
  // Somamos uma folga ao tamanho útil para que a última peça possa terminar
  // exatamente na margem externa sem exigir folga depois dela.
  return {
    freeRects:[{
      x:0,y:0,
      w:cfg.width-cfg.margin*2+cfg.gap,
      h:cfg.height-cfg.margin*2+cfg.gap
    }],
    placements:[]
  };
}
function scorePartInFreeRect(free,o,cfg){
  const rw=o.w+cfg.gap,rh=o.h+cfg.gap;
  if(rw>free.w+.001||rh>free.h+.001)return null;
  const leftoverW=free.w-rw,leftoverH=free.h-rh;
  const shortSide=Math.min(leftoverW,leftoverH);
  const longSide=Math.max(leftoverW,leftoverH);
  const areaWaste=free.w*free.h-rw*rh;
  // Best Area Fit + Best Short Side Fit.
  // Empates preferem posições mais para cima/esquerda para compactar a chapa.
  return [areaWaste,shortSide,longSide,free.y,free.x,o.rotated?1:0];
}
function compareSheetScores(a,b){
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const av=a[i]??0,bv=b[i]??0;
    if(Math.abs(av-bv)>.0001)return av-bv;
  }
  return 0;
}
function findSmartSheetPlacement(sheet,part,cfg){
  let best=null;
  for(const free of sheet.freeRects){
    for(const o of partOrientations(part,cfg)){
      const score=scorePartInFreeRect(free,o,cfg);
      if(!score)continue;
      if(!best||compareSheetScores(score,best.score)<0){
        best={free,o,score,x:free.x,y:free.y,w:o.w+cfg.gap,h:o.h+cfg.gap};
      }
    }
  }
  return best;
}
function commitSmartSheetPlacement(sheet,part,cfg,best){
  const used={x:best.x,y:best.y,w:best.w,h:best.h};
  let next=[];
  for(const free of sheet.freeRects)next.push(...splitSheetFreeRect(free,used));
  sheet.freeRects=pruneSheetFreeRects(next);

  const placed={
    ...part,
    x:cfg.margin+best.x,
    y:cfg.margin+best.y,
    rotated:best.o.rotated,
    placedW:best.o.w,
    placedH:best.o.h
  };
  sheet.placements.push(placed);
  return placed;
}
function placePartOnSheet(sheet,part,cfg,commit=true){
  const best=findSmartSheetPlacement(sheet,part,cfg);
  if(!best)return null;
  if(!commit){
    return {...part,x:cfg.margin+best.x,y:cfg.margin+best.y,rotated:best.o.rotated,placedW:best.o.w,placedH:best.o.h};
  }
  return commitSmartSheetPlacement(sheet,part,cfg,best);
}
function smartPackOrder(parts){
  // Peças maiores primeiro; além da área, damos prioridade a peças altas/largas.
  // Isso evita que peças pequenas bloqueiem retângulos que só serviriam para
  // uma porta ou lateral grande.
  return [...parts].sort((a,b)=>
    (cutPlanPartAreaMm2(b)-cutPlanPartAreaMm2(a))||
    (Math.max(b.faceW,b.faceH)-Math.max(a.faceW,a.faceH))||
    (Math.min(b.faceW,b.faceH)-Math.min(a.faceW,a.faceH))
  );
}
function compactSheetsWithSecondPass(sheets,cfg){
  // Depois da primeira montagem, tenta mover peças das últimas chapas para
  // qualquer espaço livre das anteriores. Só mantém a chapa extra se realmente
  // não houver encaixe.
  for(let si=sheets.length-1;si>0;si--){
    const source=sheets[si];
    const remaining=[];
    const candidates=[...source.placements].sort((a,b)=>(b.faceW*b.faceH-a.faceW*a.faceH));

    for(const placed of candidates){
      const raw={...placed};
      delete raw.x;delete raw.y;delete raw.rotated;delete raw.placedW;delete raw.placedH;
      let moved=false;
      for(let ti=0;ti<si;ti++){
        const best=findSmartSheetPlacement(sheets[ti],raw,cfg);
        if(best){
          commitSmartSheetPlacement(sheets[ti],raw,cfg,best);
          moved=true;
          break;
        }
      }
      if(!moved)remaining.push(placed);
    }

    if(remaining.length===0){
      sheets.splice(si,1);
    }else{
      // Se não conseguiu esvaziar, reconstrói a chapa para compactar os que ficaram.
      const rebuilt=newSmartSheet(cfg);
      for(const old of smartPackOrder(remaining)){
        const raw={...old};
        delete raw.x;delete raw.y;delete raw.rotated;delete raw.placedW;delete raw.placedH;
        const best=findSmartSheetPlacement(rebuilt,raw,cfg);
        if(!best)throw new Error('Falha interna ao recompacotar a chapa');
        commitSmartSheetPlacement(rebuilt,raw,cfg,best);
      }
      sheets[si]=rebuilt;
    }
  }
  return sheets;
}
function packPartsIntoSheetsCompact(parts,cfg,orderMode='area'){
  if(cfg.width<=cfg.margin*2||cfg.height<=cfg.margin*2)throw new Error('A margem é maior que a área útil da chapa');

  const usableW=cfg.width-2*cfg.margin;
  const usableH=cfg.height-2*cfg.margin;
  const sorted=compactPackOrder(parts,orderMode);
  const sheets=[];

  for(const part of sorted){
    const fits=partOrientations(part,cfg).some(o=>o.w<=usableW+.001&&o.h<=usableH+.001);
    if(!fits){
      const grainMsg=cfg.grain?' (material madeirado: rotação 90° bloqueada)':'';
      throw new Error(`${part.name}: ${part.faceW} × ${part.faceH} mm não cabe na chapa ${cfg.width} × ${cfg.height} mm${grainMsg}`);
    }

    let bestSheet=-1,bestPlacement=null;
    for(let i=0;i<sheets.length;i++){
      const candidate=findSmartSheetPlacement(sheets[i],part,cfg);
      if(!candidate)continue;
      if(!bestPlacement||compareSheetScores(candidate.score,bestPlacement.score)<0){
        bestPlacement=candidate;bestSheet=i;
      }
    }

    if(bestSheet>=0){
      commitSmartSheetPlacement(sheets[bestSheet],part,cfg,bestPlacement);
    }else{
      const sheet=newSmartSheet(cfg);
      const candidate=findSmartSheetPlacement(sheet,part,cfg);
      if(!candidate)throw new Error(`${part.name}: não foi possível posicionar na chapa`);
      commitSmartSheetPlacement(sheet,part,cfg,candidate);
      sheets.push(sheet);
    }
  }

  return compactSheetsWithSecondPass(sheets,cfg);
}

// ============================================================================
// 1.100.33 · PLANO DE CORTE POR MÁQUINA
// ============================================================================

function rawPartFromPlacement(p){
  const r={...p};
  delete r.x;delete r.y;delete r.rotated;delete r.placedW;delete r.placedH;
  delete r.cutOrder;
  return r;
}

function compactPackOrder(parts,mode='area'){
  const a=[...parts];
  if(mode==='max')return a.sort((x,y)=>
    (Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH))||
    (y.faceW*y.faceH-x.faceW*x.faceH)
  );
  if(mode==='width')return a.sort((x,y)=>
    (Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH))||
    (y.faceW*y.faceH-x.faceW*x.faceH)
  );
  if(mode==='height')return a.sort((x,y)=>
    (Math.min(y.faceW,y.faceH)-Math.min(x.faceW,x.faceH))||
    (y.faceW*y.faceH-x.faceW*x.faceH)
  );
  return smartPackOrder(a);
}

function compactPackingTieScore(sheets,cfg){
  let score=0;
  for(const s of sheets){
    let maxX=cfg.margin,maxY=cfg.margin;
    for(const p of s.placements){
      maxX=Math.max(maxX,p.x+p.placedW);
      maxY=Math.max(maxY,p.y+p.placedH);
    }
    score+=(maxX-cfg.margin)*(maxY-cfg.margin);
    score+=(s.freeRects?.length||0)*1000;
  }
  return score;
}

function chooseBestCompactPacking(parts,cfg){
  const modes=['area','max','width','height'];
  let best=null;
  for(const mode of modes){
    try{
      const sheets=packPartsIntoSheetsCompact(parts,cfg,mode);
      const score=[sheets.length,compactPackingTieScore(sheets,cfg)];
      if(!best||compareSheetScores(score,best.score)<0)best={sheets,score};
    }catch(err){
      if(!best&&mode===modes[modes.length-1])throw err;
    }
  }
  if(!best)throw new Error('Não foi possível calcular o plano de corte.');
  return best.sheets;
}

// ---------- CNC: centraliza peças menores sem aumentar o nº de chapas ----------
function clampSheetValue(v,min,max){return Math.max(min,Math.min(max,v));}

function cncCandidatePositions(free,o,cfg){
  const rw=o.w+cfg.gap,rh=o.h+cfg.gap;
  if(rw>free.w+.001||rh>free.h+.001)return [];
  const maxX=free.x+free.w-rw,maxY=free.y+free.h-rh;
  const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
  const cx=usableW/2-o.w/2,cy=usableH/2-o.h/2;
  const midX=(free.x+maxX)/2,midY=(free.y+maxY)/2;

  const raw=[
    [clampSheetValue(cx,free.x,maxX),clampSheetValue(cy,free.y,maxY)],
    [midX,midY],
    [free.x,free.y],[maxX,free.y],[free.x,maxY],[maxX,maxY],
    [midX,free.y],[midX,maxY],[free.x,midY],[maxX,midY]
  ];
  const seen=new Set(),out=[];
  for(const [x,y] of raw){
    const k=`${x.toFixed(3)}|${y.toFixed(3)}`;
    if(seen.has(k))continue;
    seen.add(k);out.push({x,y,rw,rh});
  }
  return out;
}

function scoreCncCenterPlacement(free,o,pos,cfg){
  const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
  const pcx=pos.x+o.w/2,pcy=pos.y+o.h/2;
  const centerDist=Math.hypot(pcx-usableW/2,pcy-usableH/2)/
    Math.max(1,Math.hypot(usableW,usableH));

  const l=pos.x-free.x,r=free.x+free.w-(pos.x+pos.rw);
  const b=pos.y-free.y,t=free.y+free.h-(pos.y+pos.rh);
  const sliverPenalty=[l,r,b,t]
    .filter(v=>v>.001)
    .reduce((n,v)=>n+(v<80?(80-v):0),0);

  const areaWaste=free.w*free.h-pos.rw*pos.rh;
  const shortSide=Math.min(
    Math.max(0,free.w-pos.rw),
    Math.max(0,free.h-pos.rh)
  );

  return [centerDist,sliverPenalty,areaWaste,shortSide,o.rotated?1:0,pos.y,pos.x];
}

function findCncCenterPlacement(sheet,part,cfg){
  let best=null;
  for(const free of sheet.freeRects){
    for(const o of partOrientations(part,cfg)){
      for(const pos of cncCandidatePositions(free,o,cfg)){
        const score=scoreCncCenterPlacement(free,o,pos,cfg);
        if(!best||compareSheetScores(score,best.score)<0){
          best={free,o,score,x:pos.x,y:pos.y,w:pos.rw,h:pos.rh};
        }
      }
    }
  }
  return best;
}

function centerPackSingleSheet(parts,cfg){
  const sheet=newSmartSheet(cfg);
  for(const part of parts){
    const best=findCncCenterPlacement(sheet,part,cfg);
    if(!best)return null;
    commitSmartSheetPlacement(sheet,part,cfg,best);
  }
  return sheet;
}

function cncCenterQuality(sheet,cfg){
  const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
  const cx=cfg.margin+usableW/2,cy=cfg.margin+usableH/2;
  const maxArea=Math.max(1,...sheet.placements.map(p=>p.faceW*p.faceH));
  let weighted=0,totalWeight=0;
  for(const p of sheet.placements){
    const pcx=p.x+p.placedW/2,pcy=p.y+p.placedH/2;
    const dist=Math.hypot(pcx-cx,pcy-cy);
    const area=Math.max(1,p.faceW*p.faceH);
    const weight=Math.sqrt(maxArea/area); // peças menores pesam mais
    weighted+=dist*weight;
    totalWeight+=weight;
  }
  return weighted/Math.max(1,totalWeight);
}

function centerWholeCncCluster(sheet,cfg){
  if(!sheet.placements.length)return sheet;
  const minX=Math.min(...sheet.placements.map(p=>p.x));
  const minY=Math.min(...sheet.placements.map(p=>p.y));
  const maxX=Math.max(...sheet.placements.map(p=>p.x+p.placedW));
  const maxY=Math.max(...sheet.placements.map(p=>p.y+p.placedH));
  const bw=maxX-minX,bh=maxY-minY;
  const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
  const targetMinX=cfg.margin+(usableW-bw)/2;
  const targetMinY=cfg.margin+(usableH-bh)/2;
  const dx=targetMinX-minX,dy=targetMinY-minY;
  return {
    ...sheet,
    placements:sheet.placements.map(p=>({...p,x:p.x+dx,y:p.y+dy}))
  };
}

function assignCncCutOrder(sheet,cfg){
  const cx=cfg.width/2,cy=cfg.height/2;
  const ringSize=Math.max(70,Math.min(260,Math.hypot(cfg.width,cfg.height)*.075));
  const ordered=[...sheet.placements].sort((a,b)=>{
    const da=Math.hypot((a.x+a.placedW/2)-cx,(a.y+a.placedH/2)-cy);
    const db=Math.hypot((b.x+b.placedW/2)-cx,(b.y+b.placedH/2)-cy);
    const ra=Math.floor(da/ringSize),rb=Math.floor(db/ringSize);
    return (ra-rb)||
      (a.faceW*a.faceH-b.faceW*b.faceH)||
      (da-db);
  });
  ordered.forEach((p,i)=>p.cutOrder=i+1);
  return sheet;
}

function repackCncSheetCenterOut(source,cfg){
  const raw=source.placements.map(rawPartFromPlacement);
  const byAreaAsc=[...raw].sort((a,b)=>
    (a.faceW*a.faceH-b.faceW*b.faceH)||
    (Math.max(a.faceW,a.faceH)-Math.max(b.faceW,b.faceH))
  );
  const byMaxAsc=[...raw].sort((a,b)=>
    (Math.max(a.faceW,a.faceH)-Math.max(b.faceW,b.faceH))||
    (a.faceW*a.faceH-b.faceW*b.faceH)
  );
  const smallest=Math.max(1,Math.floor(raw.length*.35));
  const hybrid=[
    ...byAreaAsc.slice(0,smallest),
    ...byAreaAsc.slice(smallest).sort((a,b)=>b.faceW*b.faceH-a.faceW*a.faceH)
  ];
  const byAreaDesc=[...raw].sort((a,b)=>b.faceW*b.faceH-a.faceW*a.faceH);

  let best=null;
  for(const order of [byAreaAsc,byMaxAsc,hybrid,byAreaDesc]){
    const candidate=centerPackSingleSheet(order,cfg);
    if(!candidate)continue;
    const q=cncCenterQuality(candidate,cfg);
    if(!best||q<best.q)best={sheet:candidate,q};
  }

  // Nunca cria uma chapa adicional só para conseguir o efeito centro→fora.
  const finalSheet=best?.sheet||centerWholeCncCluster(source,cfg);
  return assignCncCutOrder(finalSheet,cfg);
}

// ---------- 1.100.95 · CNC por contorno real ----------
// Depois do MaxRects, tenta retirar peças das últimas chapas e encaixá-las nos
// vazios reais de peças curvas/paramétricas. Retângulos continuam sendo usados
// como primeira passada (rápida); esta segunda passada só aceita posições onde
// os POLÍGONOS reais não colidem e respeitam a folga da fresa.
function contourPlacedPolygon(part,x=part.x,y=part.y,rotated=!!part.rotated){
  const src=part?.customOutline?.length?part.customOutline:[[0,0],[part.faceW,0],[part.faceW,part.faceH],[0,part.faceH]];
  return src.map(([u,v])=>rotated?[x+v,y+part.faceW-u]:[x+u,y+v]);
}
function contourPolyBounds(poly){
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
function contourPointInPoly(pt,poly){
  const [x,y]=pt;let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi||1e-12)+xi))inside=!inside;
  }
  return inside;
}
function contourOrient(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function contourOnSegment(a,b,p){return Math.min(a[0],b[0])-.001<=p[0]&&p[0]<=Math.max(a[0],b[0])+.001&&Math.min(a[1],b[1])-.001<=p[1]&&p[1]<=Math.max(a[1],b[1])+.001&&Math.abs(contourOrient(a,b,p))<.001;}
function contourSegmentsIntersect(a,b,c,d){
  const o1=contourOrient(a,b,c),o2=contourOrient(a,b,d),o3=contourOrient(c,d,a),o4=contourOrient(c,d,b);
  if(((o1>0&&o2<0)||(o1<0&&o2>0))&&((o3>0&&o4<0)||(o3<0&&o4>0)))return true;
  return (Math.abs(o1)<.001&&contourOnSegment(a,b,c))||(Math.abs(o2)<.001&&contourOnSegment(a,b,d))||(Math.abs(o3)<.001&&contourOnSegment(c,d,a))||(Math.abs(o4)<.001&&contourOnSegment(c,d,b));
}
function contourPointSegDist(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
  if(l2<1e-9)return Math.hypot(p[0]-a[0],p[1]-a[1]);
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2));
  return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy));
}
function contourPolysClear(a,b,gap){
  const ba=contourPolyBounds(a),bb=contourPolyBounds(b),g=Math.max(0,Number(gap)||0);
  if(ba.maxX+g<bb.minX||bb.maxX+g<ba.minX||ba.maxY+g<bb.minY||bb.maxY+g<ba.minY)return true;
  for(let i=0;i<a.length;i++){
    const a1=a[i],a2=a[(i+1)%a.length];
    for(let j=0;j<b.length;j++){
      const b1=b[j],b2=b[(j+1)%b.length];
      if(contourSegmentsIntersect(a1,a2,b1,b2))return false;
      if(g>0&&(contourPointSegDist(a1,b1,b2)<g-.01||contourPointSegDist(a2,b1,b2)<g-.01||contourPointSegDist(b1,a1,a2)<g-.01||contourPointSegDist(b2,a1,a2)<g-.01))return false;
    }
  }
  if(contourPointInPoly(a[0],b)||contourPointInPoly(b[0],a))return false;
  return true;
}
function contourCandidateFitsSheet(poly,cfg){
  const b=contourPolyBounds(poly),m=Number(cfg.margin)||0;
  return b.minX>=m-.001&&b.minY>=m-.001&&b.maxX<=cfg.width-m+.001&&b.maxY<=cfg.height-m+.001;
}
function contourCandidateClear(poly,placements,cfg){
  if(!contourCandidateFitsSheet(poly,cfg))return false;
  return placements.every(p=>contourPolysClear(poly,contourPlacedPolygon(p),cfg.gap));
}
function contourCandidateSeeds(sheet,part,o,cfg){
  const m=cfg.margin,maxX=cfg.width-m-o.w,maxY=cfg.height-m-o.h,seed=[],seen=new Set();
  const add=(x,y)=>{x=Math.max(m,Math.min(maxX,x));y=Math.max(m,Math.min(maxY,y));const k=`${x.toFixed(2)}|${y.toFixed(2)}`;if(!seen.has(k)){seen.add(k);seed.push([x,y]);}};
  add(m,m);add(maxX,m);add(m,maxY);add(maxX,maxY);add((m+maxX)/2,(m+maxY)/2);
  for(const p of sheet.placements){
    const b=contourPolyBounds(contourPlacedPolygon(p));
    for(const x of [b.minX-o.w-cfg.gap,b.minX,b.maxX+cfg.gap,b.maxX-o.w])
      for(const y of [b.minY-o.h-cfg.gap,b.minY,b.maxY+cfg.gap,b.maxY-o.h])add(x,y);
    if(p.customOutline?.length){
      for(const [vx,vy] of contourPlacedPolygon(p)){
        add(vx-o.w/2,vy-o.h/2);add(vx,vy);add(vx-o.w,vy-o.h);
      }
      // Varredura local no blank de uma peça curva. É aqui que peças menores
      // conseguem entrar na região vazia do retângulo envolvente da curva.
      const step=Math.max(8,Math.min(24,Math.min(o.w,o.h)/4));
      for(let y=Math.max(m,b.minY-o.h);y<=Math.min(maxY,b.maxY)+.001;y+=step)
        for(let x=Math.max(m,b.minX-o.w);x<=Math.min(maxX,b.maxX)+.001;x+=step)add(x,y);
    }
  }
  return seed;
}
function findContourAwarePlacement(sheet,part,cfg){
  let best=null;
  for(const o of partOrientations(part,cfg)){
    for(const [x,y] of contourCandidateSeeds(sheet,part,o,cfg)){
      const poly=contourPlacedPolygon(part,x,y,o.rotated);
      if(!contourCandidateClear(poly,sheet.placements,cfg))continue;
      const cx=x+o.w/2,cy=y+o.h/2,score=[Math.hypot(cx-cfg.width/2,cy-cfg.height/2),y,x,o.rotated?1:0];
      if(!best||compareSheetScores(score,best.score)<0)best={x,y,o,score};
    }
  }
  return best;
}
function contourAwareCompactCncSheets(sheets,cfg){
  if(sheets.length<2||!sheets.some(s=>s.placements.some(p=>p.customOutline?.length)))return sheets;
  for(let si=sheets.length-1;si>0;si--){
    const source=sheets[si];
    const moving=[...source.placements].sort((a,b)=>cutPlanPartAreaMm2(b)-cutPlanPartAreaMm2(a));
    for(const placed of moving){
      const raw=rawPartFromPlacement(placed);let moved=false;
      for(let ti=0;ti<si;ti++){
        // A segunda passada só é necessária onde há ao menos uma forma especial
        // ou quando a própria peça é especial.
        if(!raw.customOutline?.length&&!sheets[ti].placements.some(p=>p.customOutline?.length))continue;
        const pos=findContourAwarePlacement(sheets[ti],raw,cfg);if(!pos)continue;
        sheets[ti].placements.push({...raw,x:pos.x,y:pos.y,rotated:pos.o.rotated,placedW:pos.o.w,placedH:pos.o.h});
        source.placements=source.placements.filter(p=>p!==placed);moved=true;break;
      }
      if(moved&&source.placements.length===0)break;
    }
  }
  const kept=sheets.filter(s=>s.placements.length);
  // freeRects pertencem ao blank retangular da primeira passada e deixam de
  // representar as sobras após o encaixe por contorno. No modo CNC não usamos
  // essas sobras como retalhos de seccionadora.
  kept.forEach(s=>{s.freeRects=[];});
  return kept;
}
function packPartsIntoSheetsCnc(parts,cfg){
  const compact=chooseBestCompactPacking(parts,cfg).map(s=>repackCncSheetCenterOut(s,cfg));
  const contour=contourAwareCompactCncSheets(compact,cfg);
  return contour.map(s=>assignCncCutOrder(s,cfg));
}

// ---------- Seccionadora: guillotine / cortes retos ----------
function newPanelSawSheet(cfg){
  return {
    freeRects:[{
      x:0,y:0,
      w:cfg.width-2*cfg.margin,
      h:cfg.height-2*cfg.margin
    }],
    placements:[],
    cuts:[]
  };
}

function panelSawOrder(parts,mode='area'){
  const a=[...parts];
  if(mode==='max')return a.sort((x,y)=>
    (Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH))||
    (y.faceW*y.faceH-x.faceW*x.faceH)
  );
  if(mode==='width')return a.sort((x,y)=>
    (y.faceW-x.faceW)||(y.faceW*y.faceH-x.faceW*x.faceH)
  );
  if(mode==='height')return a.sort((x,y)=>
    (y.faceH-x.faceH)||(y.faceW*y.faceH-x.faceW*x.faceH)
  );
  return a.sort((x,y)=>
    (y.faceW*y.faceH-x.faceW*x.faceH)||
    (Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH))
  );
}

function panelSawSplitRects(free,o,cfg,split){
  const remW=free.w-o.w,remH=free.h-o.h;
  const gap=cfg.gap;
  const out=[];

  if(split==='V'){
    if(remW>gap+.001){
      out.push({x:free.x+o.w+gap,y:free.y,w:remW-gap,h:free.h});
    }
    if(remH>gap+.001){
      out.push({x:free.x,y:free.y+o.h+gap,w:o.w,h:remH-gap});
    }
  }else{
    if(remH>gap+.001){
      out.push({x:free.x,y:free.y+o.h+gap,w:free.w,h:remH-gap});
    }
    if(remW>gap+.001){
      out.push({x:free.x+o.w+gap,y:free.y,w:remW-gap,h:o.h});
    }
  }
  return out;
}

function panelSawCandidateScore(free,o,cfg,split){
  if(o.w>free.w+.001||o.h>free.h+.001)return null;
  const children=panelSawSplitRects(free,o,cfg,split);
  const waste=free.w*free.h-o.w*o.h;
  const largest=children.length?Math.max(...children.map(r=>r.w*r.h)):0;
  const slivers=children.reduce((n,r)=>n+(Math.min(r.w,r.h)<70?1:0),0);
  const remW=free.w-o.w,remH=free.h-o.h;
  return [waste,slivers,-largest,Math.min(remW,remH),Math.max(remW,remH),o.rotated?1:0];
}

function findPanelSawPlacement(sheet,part,cfg){
  let best=null;
  for(let fi=0;fi<sheet.freeRects.length;fi++){
    const free=sheet.freeRects[fi];
    for(const o of partOrientations(part,cfg)){
      for(const split of ['V','H']){
        const score=panelSawCandidateScore(free,o,cfg,split);
        if(!score)continue;
        if(!best||compareSheetScores(score,best.score)<0){
          best={fi,free,o,split,score};
        }
      }
    }
  }
  return best;
}

function panelSawAddCut(sheet,cut){
  if(!(cut.length>.001))return;
  cut.order=sheet.cuts.length+1;
  sheet.cuts.push(cut);
}

function commitPanelSawPlacement(sheet,part,cfg,best){
  const free=best.free,o=best.o;
  sheet.freeRects.splice(best.fi,1,...panelSawSplitRects(free,o,cfg,best.split));

  const placed={
    ...part,
    x:cfg.margin+free.x,
    y:cfg.margin+free.y,
    rotated:o.rotated,
    placedW:o.w,
    placedH:o.h
  };
  sheet.placements.push(placed);

  const remW=free.w-o.w,remH=free.h-o.h;
  const fx=cfg.margin+free.x,fy=cfg.margin+free.y;

  // Registra a ordem física dos cortes retos da subdivisão guilhotina.
  if(best.split==='V'){
    if(remW>.001){
      panelSawAddCut(sheet,{
        orientation:'V',
        x1:fx+o.w,y1:fy,
        x2:fx+o.w,y2:fy+free.h,
        length:free.h,
        description:`Vertical · X ${nice(fx+o.w)}`
      });
    }
    if(remH>.001){
      panelSawAddCut(sheet,{
        orientation:'H',
        x1:fx,y1:fy+o.h,
        x2:fx+o.w,y2:fy+o.h,
        length:o.w,
        description:`Horizontal · Y ${nice(fy+o.h)}`
      });
    }
  }else{
    if(remH>.001){
      panelSawAddCut(sheet,{
        orientation:'H',
        x1:fx,y1:fy+o.h,
        x2:fx+free.w,y2:fy+o.h,
        length:free.w,
        description:`Horizontal · Y ${nice(fy+o.h)}`
      });
    }
    if(remW>.001){
      panelSawAddCut(sheet,{
        orientation:'V',
        x1:fx+o.w,y1:fy,
        x2:fx+o.w,y2:fy+o.h,
        length:o.h,
        description:`Vertical · X ${nice(fx+o.w)}`
      });
    }
  }

  return placed;
}

function packPanelSawAttempt(parts,cfg,orderMode){
  const ordered=panelSawOrder(parts,orderMode);
  const sheets=[];

  for(const part of ordered){
    const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
    if(!partOrientations(part,cfg).some(o=>o.w<=usableW+.001&&o.h<=usableH+.001)){
      const grainMsg=cfg.grain?' (veio bloqueia giro 90°)':'';
      throw new Error(`${part.name}: ${part.faceW} × ${part.faceH} mm não cabe na chapa${grainMsg}`);
    }

    let bestSheet=-1,best=null;
    for(let i=0;i<sheets.length;i++){
      const c=findPanelSawPlacement(sheets[i],part,cfg);
      if(!c)continue;
      if(!best||compareSheetScores(c.score,best.score)<0){
        best=c;bestSheet=i;
      }
    }

    if(bestSheet<0){
      const sheet=newPanelSawSheet(cfg);
      const c=findPanelSawPlacement(sheet,part,cfg);
      if(!c)throw new Error(`${part.name}: não foi possível montar com cortes retos.`);
      commitPanelSawPlacement(sheet,part,cfg,c);
      sheets.push(sheet);
    }else{
      commitPanelSawPlacement(sheets[bestSheet],part,cfg,best);
    }
  }
  return sheets;
}

function panelSawPackingTieScore(sheets){
  let score=0;
  for(const s of sheets){
    score+=(s.freeRects?.length||0)*1000;
    const maxFree=s.freeRects?.length?Math.max(...s.freeRects.map(r=>r.w*r.h)):0;
    score-=maxFree*.001;
    score+=(s.cuts?.length||0)*10;
  }
  return score;
}

// 1.100.95 · Seccionadora de pinça sem giro automático
// Plano em 2 etapas: primeiro a chapa vira faixas; depois o operador gira
// cada faixa UMA vez em 90° e a máquina executa os cortes transversais.
function panelSawTwoStageNewSheet(cfg,firstAxis){
  return {placements:[],cuts:[],freeRects:[],strips:[],panelFirstAxis:firstAxis,panelSequence:null};
}
function panelSawTwoStageLimits(cfg,firstAxis){
  const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
  return firstAxis==='V'
    ? {cross:usableW,run:usableH}
    : {cross:usableH,run:usableW};
}
function panelSawTwoStageDims(o,firstAxis){
  return firstAxis==='V'
    ? {stripSize:o.w,pieceLen:o.h}
    : {stripSize:o.h,pieceLen:o.w};
}
function panelSawTwoStageCandidate(sheet,part,cfg,firstAxis){
  const lim=panelSawTwoStageLimits(cfg,firstAxis),gap=Math.max(0,cfg.gap||0);
  let best=null;
  for(const o of partOrientations(part,cfg)){
    const d=panelSawTwoStageDims(o,firstAxis);
    if(d.stripSize>lim.cross+.001||d.pieceLen>lim.run+.001)continue;
    for(let i=0;i<sheet.strips.length;i++){
      const strip=sheet.strips[i];
      if(Math.abs(strip.size-d.stripSize)>.01)continue;
      const start=strip.items.length?strip.used+gap:0;
      if(start+d.pieceLen>lim.run+.001)continue;
      const score=[0,lim.run-(start+d.pieceLen),o.rotated?1:0,i];
      if(!best||compareSheetScores(score,best.score)<0)best={o,d,stripIndex:i,newStrip:false,start,score};
    }
    const usedCross=sheet.strips.length?(sheet.strips[sheet.strips.length-1].start+sheet.strips[sheet.strips.length-1].size):0;
    const startCross=sheet.strips.length?usedCross+gap:0;
    if(startCross+d.stripSize<=lim.cross+.001){
      const score=[1,lim.cross-(startCross+d.stripSize),lim.run-d.pieceLen,o.rotated?1:0];
      if(!best||compareSheetScores(score,best.score)<0)best={o,d,newStrip:true,startCross,start:0,score};
    }
  }
  return best;
}
function panelSawTwoStageCommit(sheet,part,cfg,firstAxis,c){
  const gap=Math.max(0,cfg.gap||0);let strip;
  if(c.newStrip){
    strip={index:sheet.strips.length+1,start:c.startCross,size:c.d.stripSize,used:0,items:[]};
    sheet.strips.push(strip);
  }else strip=sheet.strips[c.stripIndex];
  const along=strip.items.length?strip.used+gap:0;
  const x=cfg.margin+(firstAxis==='V'?strip.start:along);
  const y=cfg.margin+(firstAxis==='V'?along:strip.start);
  const placed={...part,x,y,rotated:c.o.rotated,placedW:c.o.w,placedH:c.o.h,panelStrip:strip.index,panelStripAlong:along};
  sheet.placements.push(placed);
  strip.items.push({part:placed,along,length:c.d.pieceLen});
  strip.used=along+c.d.pieceLen;
  return placed;
}
function panelSawTwoStageFinalize(sheet,cfg,firstAxis){
  const lim=panelSawTwoStageLimits(cfg,firstAxis),gap=Math.max(0,cfg.gap||0),m=cfg.margin;
  const cuts=[];let order=0;
  // ETAPA 1: formar as faixas sem girar a chapa durante a sequência.
  for(const strip of sheet.strips){
    const edge=strip.start+strip.size;
    if(edge+gap/2<lim.cross-.001){
      const cut=firstAxis==='V'
        ? {orientation:'V',x1:m+edge+gap/2,y1:m,x2:m+edge+gap/2,y2:m+lim.run,length:lim.run}
        : {orientation:'H',x1:m,y1:m+edge+gap/2,x2:m+lim.run,y2:m+edge+gap/2,length:lim.run};
      cut.order=++order;cut.stage=1;cut.stripNo=strip.index;cut.action='FORMAR_FAIXA';
      cut.description=`Etapa 1 · formar faixa F${strip.index} · ${nice(strip.size)} mm`;
      cuts.push(cut);
    }
  }
  // ETAPA 2: cada faixa é girada manualmente uma única vez e recebe os cortes.
  for(const strip of sheet.strips){
    strip.crossCuts=[];
    for(let i=0;i<strip.items.length;i++){
      const it=strip.items[i],end=it.along+it.length;
      const hasAfter=i<strip.items.length-1 || end+gap/2<lim.run-.001;
      if(!hasAfter)continue;
      const cut=firstAxis==='V'
        ? {orientation:'H',x1:m+strip.start,y1:m+end+gap/2,x2:m+strip.start+strip.size,y2:m+end+gap/2,length:strip.size}
        : {orientation:'V',x1:m+end+gap/2,y1:m+strip.start,x2:m+end+gap/2,y2:m+strip.start+strip.size,length:strip.size};
      cut.order=++order;cut.stage=2;cut.stripNo=strip.index;cut.action='CORTE_FAIXA';
      cut.description=`Etapa 2 · F${strip.index} · ${nice(it.length)} mm · ${it.part.cutCode||it.part.name||'peça'}`;
      cuts.push(cut);strip.crossCuts.push(cut);
    }
  }
  sheet.cuts=cuts;
  // Sobras reais do plano em duas etapas.
  const free=[];
  for(const strip of sheet.strips){
    const start=strip.used+(strip.items.length?gap:0),remain=lim.run-start;
    if(remain>.001){
      if(firstAxis==='V')free.push({x:strip.start,y:start,w:strip.size,h:remain});
      else free.push({x:start,y:strip.start,w:remain,h:strip.size});
    }
  }
  const usedCross=sheet.strips.length?(sheet.strips[sheet.strips.length-1].start+sheet.strips[sheet.strips.length-1].size+gap):0;
  if(lim.cross-usedCross>.001){
    if(firstAxis==='V')free.push({x:usedCross,y:0,w:lim.cross-usedCross,h:lim.run});
    else free.push({x:0,y:usedCross,w:lim.run,h:lim.cross-usedCross});
  }
  sheet.freeRects=free;
  sheet.panelSequence={
    firstAxis,
    turns:sheet.strips.length,
    refilo:cfg.margin,
    stage1Cuts:cuts.filter(c=>c.stage===1),
    strips:sheet.strips.map(strip=>({
      number:strip.index,size:strip.size,used:strip.used,
      items:strip.items.map(it=>({code:it.part.cutCode||'?',name:it.part.name||'Peça',length:it.length,faceW:it.part.faceW,faceH:it.part.faceH})),
      cuts:strip.crossCuts||[]
    }))
  };
  return sheet;
}
function packPanelSawTwoStageAttempt(parts,cfg,firstAxis,orderMode){
  const ordered=panelSawOrder(parts,orderMode),sheets=[];
  for(const part of ordered){
    let chosenSheet=-1,chosen=null;
    for(let i=0;i<sheets.length;i++){
      const c=panelSawTwoStageCandidate(sheets[i],part,cfg,firstAxis);
      if(c&&(!chosen||compareSheetScores(c.score,chosen.score)<0)){chosen=c;chosenSheet=i;}
    }
    if(chosenSheet<0){
      const sheet=panelSawTwoStageNewSheet(cfg,firstAxis),c=panelSawTwoStageCandidate(sheet,part,cfg,firstAxis);
      if(!c)throw new Error(`${part.name}: ${nice(part.faceW)} × ${nice(part.faceH)} mm não cabe no plano de seccionadora em 2 etapas.`);
      panelSawTwoStageCommit(sheet,part,cfg,firstAxis,c);sheets.push(sheet);
    }else panelSawTwoStageCommit(sheets[chosenSheet],part,cfg,firstAxis,chosen);
  }
  return sheets.map(s=>panelSawTwoStageFinalize(s,cfg,firstAxis));
}
function panelSawTwoStageScore(sheets,cfg){
  const turns=sheets.reduce((n,s)=>n+(s.panelSequence?.turns||0),0);
  const cutLength=sheets.reduce((n,s)=>n+(s.cuts||[]).reduce((m,c)=>m+(c.length||0),0),0);
  const cutCount=sheets.reduce((n,s)=>n+(s.cuts||[]).length,0);
  const fragments=sheets.reduce((n,s)=>n+(s.freeRects||[]).length,0);
  return [sheets.length,turns,cutCount,cutLength,fragments];
}
function packPartsIntoSheetsPanelSaw(parts,cfg){
  const pref=cfg.panelFirst||'auto';
  const axes=pref==='length'?['H']:pref==='width'?['V']:['H','V'];
  let best=null,lastError=null;
  for(const axis of axes)for(const mode of ['area','max','width','height']){
    try{
      const sheets=packPanelSawTwoStageAttempt(parts,cfg,axis,mode),score=panelSawTwoStageScore(sheets,cfg);
      if(!best||compareSheetScores(score,best.score)<0)best={sheets,score};
    }catch(err){lastError=err;}
  }
  if(!best)throw lastError||new Error('Não foi possível montar a sequência da seccionadora.');
  return best.sheets;
}

function packPartsIntoSheets(parts,cfg){
  return cfg.cutMode==='panel'
    ? packPartsIntoSheetsPanelSaw(parts,cfg)
    : packPartsIntoSheetsCnc(parts,cfg);
}

function legacyV41_updateSheetCutModeUi(){
  const mode=$('sheetCutMode')?.value||'cnc';
  const help=$('sheetCutModeHelp');
  if(!help)return;
  if(mode==='panel'){
    help.className='sheetModeHelp panel';
    help.innerHTML='<strong>Seccionadora:</strong> usa sequência em 2 etapas para máquina de pinça sem giro automático: forma as faixas, depois pede um único giro de 90° por faixa. Além do CSV, o DesignLab gera um pacote <b>Mingli .ZAW (teste)</b> com <b>1 arquivo por chapa física</b>; as etapas ficam dentro do mesmo arquivo.';
  }else{
    help.className='sheetModeHelp cnc';
    help.innerHTML='<strong>CNC:</strong> usa o contorno real de peças curvas/Forma, calcula a área líquida e faz uma segunda passada para encaixar peças nos vazios reais das curvas quando houver espaço. Depois numera o corte do centro para fora.';
  }
}


function buildAspireDxfForSheet(placed,cfg,cuts=[]){
  const built=buildAspireSheetEntities(placed,cfg,cuts),entities=built.entities,layers=new Set(built.layers);
  let d=''; d+=dxfPair(0,'SECTION')+dxfPair(2,'HEADER')+dxfPair(9,'$ACADVER')+dxfPair(1,'AC1009')+dxfPair(9,'$MEASUREMENT')+dxfPair(70,1)+dxfPair(9,'$INSUNITS')+dxfPair(70,4)+dxfPair(0,'ENDSEC');
  d+=dxfPair(0,'SECTION')+dxfPair(2,'TABLES')+dxfPair(0,'TABLE')+dxfPair(2,'LAYER')+dxfPair(70,layers.size);
  for(const layer of layers){const color=layer==='CORTE_EXTERNO'?7:layer==='CHAPA_REFERENCIA'?8:layer==='CORTE_SECCIONADORA'?4:layer.startsWith('FURO_')?1:5;d+=dxfPair(0,'LAYER')+dxfPair(2,layer)+dxfPair(70,0)+dxfPair(62,color)+dxfPair(6,'CONTINUOUS');}
  d+=dxfPair(0,'ENDTAB')+dxfPair(0,'ENDSEC')+dxfPair(0,'SECTION')+dxfPair(2,'ENTITIES');
  for(const e of entities)d+=e.kind==='circle'?dxfCircle(e.layer,e.x,e.y,e.r):e.kind==='poly'?dxfClosedPolyline(e.layer,e.points):e.kind==='line'?dxfLine(e.layer,e.x1,e.y1,e.x2,e.y2):dxfClosedRect(e.layer,e.x,e.y,e.w,e.h);
  d+=dxfPair(0,'ENDSEC')+dxfPair(0,'EOF');
  const expectedFaceHoles=built.expectedFaceHoles,circleCount=built.circleCount;
  if(expectedFaceHoles!==circleCount)console.warn('DXF Aspire: divergência de furos', {expectedFaceHoles,circleCount});
  return {text:d,layers:[...layers],circleCount,expectedFaceHoles};
}
function csvCell(v){const t=String(v??'');return /[;"\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t;}
function csvLine(values){return values.map(csvCell).join(';')+'\r\n';}

// 1.100.95 · MingliPanelSaw / Zhongde .ZAW
// Estrutura reconstruída a partir do Result.zaw real fotografado no controlador.
// Correção principal desta versão: a árvore Step/Cut passa a ser coerente.
// Cada peça aponta para o Step/Cut que realmente a produziu; cada faixa é filha
// do corte correspondente da chapa. Mantemos UM .ZAW por chapa física.
function mingliXmlAttr(v){
  return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function mingliMm(v){
  const n=Number(v)||0,rounded=Math.round(n*1000)/1000;
  return Number.isInteger(rounded)?String(rounded):String(rounded).replace(/0+$/,'').replace(/\.$/,'');
}
function mingliDecimal(v,d=2,comma=false){
  const n=Number(v)||0,t=n.toFixed(d);return comma?t.replace('.',','):t;
}
function mingliDateTime(d=new Date()){
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function mingliStepTagName(i){return `Step${String(i).padStart(3,'0')}`;}
function mingliBuildStepStrict({index,x=0,y=0,width,length,trim=0,widthDirection=true,parentStep=-1,parentCut=0,cuts=[]}){
  const tag=mingliStepTagName(index),lines=[];
  lines.push(`      <${tag} X="${mingliMm(x)}" Y="${mingliMm(y)}" width="${mingliMm(width)}" Length="${mingliMm(length)}" Trim="${mingliMm(trim)}" WidthDirection="${widthDirection?'True':'False'}" CurrentStep="${index}" stepform="${parentStep}" stepcutform="${parentCut}" stepformProductID="">`);
  cuts.forEach((c,ci)=>lines.push(`        <Cut${ci} Cut="${mingliMm(c.size)}" Num="${Math.max(1,Number(c.qty)||1)}" Dri="${c.dri===false?'False':'True'}" Compensate="0" ID="Z${ci}" RemainID="Trash" />`));
  lines.push(`      </${tag}>`);
  return lines;
}
function mingliFindPlacementBinding(p,strips,stepMap){
  const stripNo=Math.max(1,Number(p?.panelStrip)||1);
  const strip=strips.find(s=>Number(s.index)===stripNo)||strips[stripNo-1]||null;
  if(!strip)return {stepform:0,stepcutform:0};
  let itemIndex=(strip.items||[]).findIndex(it=>it.part===p || (!!p?.object&&it.part?.object===p.object) || (Math.abs((Number(it.along)||0)-(Number(p?.panelStripAlong)||0))<.001));
  if(itemIndex<0)itemIndex=0;
  const map=stepMap.get(Number(strip.index)||stripNo);
  if(map?.direct)return {stepform:0,stepcutform:Math.max(0,Number(map.parentCut)||0)};
  return {stepform:Math.max(1,Number(map?.stepIndex)||1),stepcutform:itemIndex};
}
function mingliSheetProductsStrict(group,firstAxis,trim,strips,stepMap){
  return (group?.parts||group?.placements||[]).map((p,i)=>{
    const w=Math.max(.1,Number(p?.placedW ?? p?.faceW ?? p?.width)||.1);
    const h=Math.max(.1,Number(p?.placedH ?? p?.faceH ?? p?.height)||.1);
    const bind=mingliFindPlacementBinding(p,strips,stepMap);
    // No Result.zaw real o refilo de 10 mm aparece no eixo dos cortes (originY=10),
    // enquanto o eixo de avanço continua em 0. O plano interno do DesignLab usa
    // margem nos dois eixos; retiramos a margem apenas do eixo de avanço ao gravar ZAW.
    const ox=firstAxis==='H'?Math.max(0,(Number(p?.x)||0)-trim):Math.max(0,Number(p?.x)||0);
    const oy=firstAxis==='V'?Math.max(0,(Number(p?.y)||0)-trim):Math.max(0,Number(p?.y)||0);
    return {
      id:`0A${i}`,
      source:p,
      width:w,
      length:h,
      originX:ox,
      originY:oy,
      inputTurn:false,
      dri:!p?.rotated,
      stepform:bind.stepform,
      stepcutform:bind.stepcutform
    };
  });
}
function mingliBuildSpareRecords(strips,firstAxis,plateWidth,plateLength,trim,knife,products){
  const out=[];
  const usableRun=(firstAxis==='H'?plateWidth:plateLength)-trim;
  for(const strip of strips){
    const used=Math.max(0,Number(strip.used)||0);
    const remain=Math.max(0,usableRun-used-(strip.items?.length?knife:0));
    if(remain>.001){
      if(firstAxis==='H')out.push({originX:trim+used+knife,originY:trim+Number(strip.start||0),width:remain,length:Number(strip.size)||0,stepform:Number(strip.index)||1,stepcutform:-2});
      else out.push({originX:trim+Number(strip.start||0),originY:trim+used+knife,width:Number(strip.size)||0,length:remain,stepform:Number(strip.index)||1,stepcutform:-2});
    }
  }
  const usedCross=strips.length?Math.max(...strips.map(s=>(Number(s.start)||0)+(Number(s.size)||0)))+knife:0;
  const crossLimit=(firstAxis==='H'?plateLength:plateWidth)-trim;
  const remainCross=Math.max(0,crossLimit-usedCross);
  if(remainCross>.001){
    if(firstAxis==='H')out.push({originX:0,originY:trim+usedCross,width:plateWidth,length:remainCross,stepform:0,stepcutform:-2});
    else out.push({originX:trim+usedCross,originY:0,width:remainCross,length:plateLength,stepform:0,stepcutform:-2});
  }
  return out.filter(x=>x.width>.001&&x.length>.001).map((x,i)=>({...x,id:`0Z${products.length+i}`}));
}
function buildMingliZawSheetJob(group,cfg){
  const gc=group?.cfg||cfg||{},plateWidth=Math.max(1,Number(gc.width)||2750),plateLength=Math.max(1,Number(gc.height)||1850);
  const thickness=Math.max(.1,Number(group?.parts?.[0]?.thickness)||18),trim=Math.max(0,Number(gc.margin)||0),knife=Math.max(0,Number(gc.gap)||0);
  const seq=group?.panelSequence||{},firstAxis=seq.firstAxis||group?.panelFirstAxis||'H',strips=(group?.panelStrips||[]).filter(s=>(s?.items||[]).length);
  if(!strips.length)throw new Error('ZAW: o plano de seccionadora não possui faixas válidas.');
  // Faixa sem corte transversal é produto direto do Step000, como no Result.zaw
  // fotografado (8 peças 1730x45 = apenas Step000/Cut0 Num=8). As demais faixas
  // recebem Steps filhos numerados sem buracos.
  const stepMap=new Map(),stage1Cuts=[];let nextChildStep=1;
  strips.forEach((strip,si)=>{
    const direct=!(strip?.crossCuts||[]).length && (strip?.items||[]).length===1;
    const size=Math.max(.001,Number(strip.size)||.001);
    let parentCut;
    const prev=stage1Cuts[stage1Cuts.length-1];
    if(direct&&prev&&prev.directGroup&&Math.abs(prev.size-size)<.001){
      prev.qty++;parentCut=stage1Cuts.length-1;
    }else{
      parentCut=stage1Cuts.length;stage1Cuts.push({size,qty:1,dri:true,directGroup:direct});
    }
    stepMap.set(Number(strip.index)||si+1,{direct,parentCut,stepIndex:direct?0:nextChildStep++});
  });
  const products=mingliSheetProductsStrict(group,firstAxis,trim,strips,stepMap);
  if(!products.length)throw new Error('ZAW: a chapa não possui peças.');
  const spareRecords=mingliBuildSpareRecords(strips,firstAxis,plateWidth,plateLength,trim,knife,products);
  const plateArea=plateWidth*plateLength,productArea=products.reduce((n,p)=>n+p.width*p.length,0);
  const spareArea=spareRecords.reduce((n,s)=>n+s.width*s.length,0);
  // O Mingli real considera a sobra registrada como produto utilizado no resumo.
  // Ex.: 3000x550 com 2x 3000x270 + sobra 3000x2 => 1,63 m² e 98,55%.
  const usedArea=productArea+spareArea;
  const totalUtilization=plateArea?usedArea/plateArea*100:0;
  const ratio=plateArea?productArea/plateArea*100:0;
  const lines=[];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<!DOCTYPE ZhongdeOptimizationResults>');
  lines.push(`<ZhongDeModelResult DateTime="${mingliXmlAttr(mingliDateTime())}" ModelCreator="ZhongDe. Limited" EdgeExcludeWidth="${mingliMm(trim)}" knifewidth="${mingliMm(knife)}" EditMode="Manually">`);
  lines.push('  <result>');
  lines.push(`    <TotalUtilization unit="%">${mingliDecimal(ratio,2,true)}</TotalUtilization>`);
  lines.push('    <materialsNum unit="zhang">1</materialsNum>');
  lines.push(`    <ProductArea unit="㎡">${mingliDecimal(productArea/1e6,2,true)}</ProductArea>`);
  lines.push(`    <materialArea unit="㎡">${mingliDecimal(plateArea/1e6,2,true)}</materialArea>`);
  lines.push(`    <ProductUseed unit="Piece">${products.length+spareRecords.length}</ProductUseed>`);
  lines.push('    <NotUseProducts unit="Piece">0</NotUseProducts>');
  lines.push('  </result>');
  lines.push('  <Materials SpecificationNum="1" Nums="1">');
  lines.push(`    <Specific0 ID="B0" Material="M01" Ply="${mingliMm(thickness)}" width="${mingliMm(plateWidth)}" Length="${mingliMm(plateLength)}" AvailableNums="1" UseNums="1" Area="${mingliMm(plateArea)}" />`);
  lines.push('  </Materials>');
  lines.push('  <InputResidualData SpecificationNum="0" Nums="0" />');
  lines.push(`  <ProductData SpecificationNum="${products.length}" Nums="${products.length}">`);
  products.forEach((p,i)=>lines.push(`    <Specific${i} ID="${p.id}" Material="M01" Ply="${mingliMm(thickness)}" width="${mingliMm(p.width)}" Length="${mingliMm(p.length)}" AvailableNums="1" UseNums="1" Area="${mingliMm(p.width*p.length)}" Turn="False" />`));
  lines.push('  </ProductData>');
  lines.push('  <unfinishedProduct unit="Piece" />');
  lines.push('  <CutLines>');
  lines.push(`    <CutScheme0 PlateID="B0" width="${mingliMm(plateWidth)}" Lenth="${mingliMm(plateLength)}" Nums="1" ProductsNum="${products.length}">`);

  // Step000 = chapa inteira. Para planos em duas etapas não agrupamos faixas iguais:
  // cada CutN representa UMA faixa, permitindo que Step00N aponte sem ambiguidade
  // para stepform=0 / stepcutform=N.
  lines.push(...mingliBuildStepStrict({
    index:0,x:0,y:0,width:plateWidth,length:plateLength,trim,
    widthDirection:firstAxis==='H',parentStep:-1,parentCut:0,cuts:stage1Cuts
  }));

  // Um Step filho por faixa. Ele representa a região ORIGINAL da faixa na chapa;
  // WidthDirection é invertido para o corte transversal após o giro manual.
  strips.forEach((strip,si)=>{
    const map=stepMap.get(Number(strip.index)||si+1);
    if(map?.direct)return;
    const stepIndex=Math.max(1,Number(map?.stepIndex)||1);
    const items=strip.items||[];
    const cuts=items.map(it=>({size:Number(it.length)||0,qty:1,dri:true})).filter(c=>c.size>0);
    if(!cuts.length)return;
    const stripStart=trim+Math.max(0,Number(strip.start)||0),stripSize=Math.max(.1,Number(strip.size)||.1);
    const x=firstAxis==='H'?0:stripStart;
    const y=firstAxis==='H'?stripStart:0;
    const width=firstAxis==='H'?plateWidth:stripSize;
    const length=firstAxis==='H'?stripSize:plateLength;
    lines.push(...mingliBuildStepStrict({
      index:stepIndex,x,y,width,length,trim:0,
      widthDirection:firstAxis!=='H',parentStep:0,parentCut:Math.max(0,Number(map?.parentCut)||0),cuts
    }));
  });
  lines.push('    </CutScheme0>');
  lines.push(`    <Scheme0 PlateID="B0" width="${mingliMm(plateWidth)}" Lenth="${mingliMm(plateLength)}" Thick="${mingliMm(thickness)}" PlatesNum="1" ProductsNum="${products.length}" Ratio="${mingliDecimal(ratio,2,true)}">`);
  products.forEach(p=>lines.push(`      <Product ProductID="${p.id}" originX="${mingliMm(p.originX)}" originY="${mingliMm(p.originY)}" width="${mingliMm(p.width)}" Length="${mingliMm(p.length)}" Dri="${p.dri?'True':'False'}" stepform="${p.stepform}" stepcutform="${p.stepcutform}" />`));
  spareRecords.forEach(s=>lines.push(`      <Spare ProductID="${s.id}" originX="${mingliMm(s.originX)}" originY="${mingliMm(s.originY)}" width="${mingliMm(s.width)}" Length="${mingliMm(s.length)}" Dri="True" stepform="${s.stepform}" stepcutform="${s.stepcutform}" />`));
  lines.push('    </Scheme0>');
  lines.push('  </CutLines>');
  lines.push('</ZhongDeModelResult>');
  // Windows/.NET antigo: BOM UTF-8 + CRLF, igual ao padrão salvo pelo Notepad/controlador.
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
function mingliZawSafeBase(group){
  return `CHAPA_${String(group.sheetNo||1).padStart(2,'0')}_${safeFileName(group.key||'material','material')}`;
}
function buildMingliZawFiles(groups,cfg){
  const files=[],notes=[];
  const valid=groups.filter(x=>x.cutMode==='panel'||x.planMode==='panel');
  for(const g of valid){
    const base=mingliZawSafeBase(g),data=buildMingliZawSheetJob(g,cfg);
    files.push({name:`mingli-zaw/${base}.zaw`,data});
    notes.push(`${base}.zaw = chapa física ${g.sheetNo||1} · ${(g.parts||[]).length} peça(s) · árvore Step/Cut completa no mesmo arquivo.`);
  }
  if(!files.length)throw new Error('Não há chapas de seccionadora para gerar ZAW.');
  const readme=`DESIGNLABMOVEIS 1.100.95 · MINGLIPANELSAW / ZAW DE TESTE\r\n\r\n`+
    `CORREÇÃO 1.100.95\r\n- Corrigidos os nomes EXATOS do XML real: ZhongDeModelResult, EdgeExcludeWidth, knifewidth, ProductUseed e stepformProductID.\r\n- Um arquivo .ZAW por chapa física.\r\n- Cada faixa virou um Step filho real do Step000.\r\n- Cada peça aponta para o stepform/stepcutform que realmente a produz.\r\n- WidthDirection é invertido na etapa transversal.\r\n- Coordenadas seguem o refilo no eixo observado no Result.zaw real.\r\n- Arquivo gravado com BOM UTF-8 e CRLF para compatibilidade com o controlador Windows antigo.\r\n\r\n`+
    `TESTE SEGURO\r\nAbra o .zaw no MingliPanelSaw e confira primeiro o desenho, medidas, quantidade, serra/refilo e sequência. NÃO execute o corte automático enquanto a tela do Mingli não estiver idêntica ao plano impresso do DesignLab.\r\n\r\n`+
    notes.map((x,i)=>`${i+1}. ${x}`).join('\r\n')+'\r\n';
  files.push({name:'mingli-zaw/LEIA-ME-ZAW.txt',data:readme});
  return files;
}
function buildPanelSawCutsCsv(groups,cfg){
  let c=csvLine([
    'Grupo','Chapa','Etapa','Acao','Faixa','Ordem_corte','Orientacao',
    'X1_mm','Y1_mm','X2_mm','Y2_mm','Comprimento_mm','Medida_faixa_mm','Pecas','Descricao'
  ]);
  if(cfg.cutMode!=='panel')return c;
  for(const g of groups){
    const seq=g.panelSequence||null;
    if(seq){
      c+=csvLine([g.key,g.sheetNo,0,'CARREGAR_CHAPA','','','','','','','','','','',
        `Carregar chapa ${nice(g.cfg?.width||cfg.width)} x ${nice(g.cfg?.height||cfg.height)} mm · refilo ${nice(g.cfg?.margin??cfg.margin)} mm`]);
      for(const cut of (seq.stage1Cuts||[])){
        c+=csvLine([g.key,g.sheetNo,1,'FORMAR_FAIXA',`F${cut.stripNo||''}`,cut.order,
          cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,
          seq.strips?.find(s=>s.number===cut.stripNo)?.size||'', '',cut.description||'']);
      }
      for(const strip of (seq.strips||[])){
        const pcs=(strip.items||[]).map(it=>`${it.code} ${nice(it.length)}`).join(' | ');
        c+=csvLine([g.key,g.sheetNo,2,'GIRAR_90',`F${strip.number}`,'','','','','','','',strip.size,pcs,
          `Girar faixa F${strip.number} 90 graus uma vez`]);
        for(const cut of (strip.cuts||[])){
          c+=csvLine([g.key,g.sheetNo,2,'CORTE_FAIXA',`F${strip.number}`,cut.order,
            cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,
            strip.size,pcs,cut.description||'']);
        }
      }
      continue;
    }
    for(const cut of (g.panelCuts||[])){
      c+=csvLine([g.key,g.sheetNo,cut.stage||'',cut.action||'CORTE','',cut.order,
        cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,'','',cut.description||'']);
    }
  }
  return c;
}
function sheetCutModeLabel(cfg){
  return cfg.cutMode==='panel'
    ? 'SECCIONADORA · 2 ETAPAS'
    : 'CNC · centro para fora';
}
function cutModeReadmeText(cfg){
  return cfg.cutMode==='panel'
    ? 'Modo do plano: SECCIONADORA DE PINÇA / 2 ETAPAS. Primeiro a chapa é dividida em faixas; depois cada faixa é girada manualmente uma única vez em 90 graus para os cortes transversais. O arquivo cortes-seccionadora.csv traz a sequência e os comandos GIRAR_90 para conferência/integração. O formato nativo do controlador da máquina deve ser confirmado no próprio MingliPanelSaw antes de importação direta.'
    : 'Modo do plano: CNC / ROUTER. O encaixe usa o contorno real das curvas/formas e tenta ocupar vazios reais antes de manter chapa extra; Ordem_Corte segue do centro para fora.';
}


function buildPartsCsv(groups){
  let c=csvLine(['Arquivo_DXF','Grupo','Chapa','Modo_corte','Ordem_CNC','Espaco','Indice','ID_Peca','Nome','Material','Codigo_material','Veio','Veio_rotacao_graus','Espessura_mm','Face_L_mm','Face_A_mm','Fitas','Rotacionada_90','X_chapa_mm','Y_chapa_mm','Eixo_espessura','Eixo_horizontal_original','Eixo_vertical_original','Furos','Rasgos']);
  for(const g of groups)for(const p of g.parts){
    const holes=p.machining.filter(o=>o.type==='hole').reduce((n,o)=>n+holeSeriesInstances(p.object,o).length,0),grooves=p.machining.filter(o=>o.type==='groove').length;
    c+=csvLine([g.file,g.key,g.sheetNo,g.cutMode==='panel'?'SECCIONADORA':'CNC',p.cutOrder||'',p.spaceName||'',p.index,p.partId||'',p.name,p.material,p.materialCode||'',p.materialGrain?'SIM':'NAO',normalizePieceGrainRotation(p.materialGrainRotation),p.thickness,p.faceW,p.faceH,p.edgeBandSummary||'',p.rotated?'SIM':'NAO',p.x,p.y,axisLabel(p.thicknessAxis),axisLabel(p.uAxis),axisLabel(p.vAxis),holes,grooves]);
  }
  return c;
}

function edgeBandCsvValue(part,key){
  const b=part.edgeBands?.[key];
  if(!b)return '';
  return b.code?`${b.code} · ${b.name}`:b.name;
}
function buildLabelsBaseCsv(groups){
  let c=csvLine([
    'ID_Peca','Projeto','Cliente','Ambiente','Espaco','Nome',
    'Material','Codigo_material','L_mm','A_mm','Espessura_mm','Veio','Veio_rotacao_graus',
    'Fita_U_menos','Fita_U_mais','Fita_V_menos','Fita_V_mais',
    'Fitas_resumo','Furos','Rasgos','Etiqueta_schema'
  ]);
  const project=typeof currentProjectRecord!=='undefined'?currentProjectRecord:null;
  for(const g of groups)for(const p of g.parts){
    const holes=p.machining.filter(o=>o.type==='hole').reduce((n,o)=>n+holeSeriesInstances(p.object,o).length,0);
    const grooves=p.machining.filter(o=>o.type==='groove').length;
    c+=csvLine([
      p.partId||'',project?.name||'',project?.client||'',project?.environment||'',
      p.spaceName||'',p.name,p.material,p.materialCode||'',
      p.faceW,p.faceH,p.thickness,p.materialGrain?'SIM':'NAO',normalizePieceGrainRotation(p.materialGrainRotation),
      edgeBandCsvValue(p,'uMin'),edgeBandCsvValue(p,'uMax'),
      edgeBandCsvValue(p,'vMin'),edgeBandCsvValue(p,'vMax'),
      p.edgeBandSummary||'',holes,grooves,'1'
    ]);
  }
  return c;
}

function buildMachiningCsv(groups){
  let c=csvLine(['Arquivo_DXF','Chapa','Espaco','Peca','Rotacionada_90','Tipo','Layer','Face','Entrada','X_mm','Y_mm','Z_mm','X_ref_mm','Y_ref_mm','Z_ref_mm','Diametro_mm','Comprimento_mm','Largura_mm','Profundidade_mm','Atravessa','Serie_Indice','Serie_Qtd','Serie_Eixo','Serie_Passo_mm','Preset']);
  for(const g of groups)for(const p of g.parts)for(const op of p.machining){
    const rx=machiningRawCoord(op,'x'),ry=machiningRawCoord(op,'y'),rz=machiningRawCoord(op,'z');
    if(op.type==='hole'){
      const pts=holeSeriesInstances(p.object,op),face=entryAxisName(op.entryAxis)===p.thicknessAxis?(entryAxisSign(op.entryAxis)>0?'A':'B'):'BORDA';for(const pt of pts)c+=csvLine([g.file,g.sheetNo,p.spaceName||'',p.name,p.rotated?'SIM':'NAO','FURO',machiningLayer(p,op),face,op.entryAxis,pt.x,pt.y,pt.z,rx,ry,rz,op.diameter,'','',operationDepthMm(p.object,op),op.through?'SIM':'NAO',pt.index,pts.length,op.seriesEnabled?axisLabel(op.seriesAxis):'',op.seriesEnabled?op.seriesStep:'',op.hardwareName?`FERRAGEM:${op.hardwareName}`:(op.seriesEnabled?'SERIE':'')]);
    }else{
      const rc=resolvedMachiningCoords(p.object,op);c+=csvLine([g.file,g.sheetNo,p.spaceName||'',p.name,p.rotated?'SIM':'NAO','RASGO',machiningLayer(p,op),entryAxisSign(op.entryAxis)>0?'A':'B',op.entryAxis,rc.x,rc.y,rc.z,rx,ry,rz,'',op.length,op.width,operationDepthMm(p.object,op),op.through?'SIM':'NAO','','','','',op.preset==='back-groove'||op.preset==='drawer-bottom-groove'?'RASGO_FUNDO':'']);
    }
  }return c;
}
function buildSheetsCsv(groups,cfg){
  let c=csvLine(['Arquivo_DXF','Grupo','Chapa','Modo_corte','Largura_chapa_mm','Altura_chapa_mm','Pecas','Cortes_retos','Faixas','Giros_90','Area_pecas_m2','Aproveitamento_percentual']);
  for(const g of groups){
    const gc=g.cfg||cfg,area=g.parts.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),pct=area/Math.max(1,(gc.width-2*gc.margin)*(gc.height-2*gc.margin))*100;
    c+=csvLine([g.file,g.key,g.sheetNo,gc.cutMode==='panel'?'SECCIONADORA':'CNC',gc.width,gc.height,g.parts.length,g.panelCuts?.length||0,g.panelSequence?.strips?.length||0,g.panelSequence?.turns||0,(area/1e6).toFixed(3),pct.toFixed(1)]);
  }
  return c;
}
function groupPartArrayForAspire(parts,cfg=getSheetPrefs(),emptyMessage='Não existem peças para exportar'){
  cfg=normalizedSheetPrefs(cfg);
  if(!parts.length)throw new Error(emptyMessage);
  const map=new Map();for(const p of parts){const mat=normalizedLayer(p.material||'MDF')||'MDF',key=`${mat}_${layerNum(p.thickness)}mm`;if(!map.has(key))map.set(key,[]);map.get(key).push(p);}
  const out=[];let fileIndex=0;
  for(const [key,gparts] of map.entries()){
    const groupCfg=sheetPrefsForPartGroup(cfg,gparts);
    const sheets=packPartsIntoSheets(gparts,groupCfg);
    sheets.forEach((sheet,i)=>{
      fileIndex++;
      const file=`${String(fileIndex).padStart(2,'0')}_${key}_CHAPA_${String(i+1).padStart(2,'0')}.dxf`;
      const panelCuts=sheet.cuts||[];
      const built=buildAspireDxfForSheet(sheet.placements,groupCfg,panelCuts);
      out.push({
        key,file,sheetNo:i+1,totalSheets:sheets.length,
        parts:sheet.placements,panelCuts,panelSequence:sheet.panelSequence||null,panelStrips:sheet.strips||[],cutMode:groupCfg.cutMode,cfg:groupCfg,...built
      });
    });
  }
  return out;
}
function drawerLevelsFromSet(cfg){
  const levels=new Array(Math.max(1,Number(cfg.count)||1)).fill(null);
  for(const o of drawerSetObjects(cfg.id)){
    if(o.userData?.drawerRole!=='side-left')continue;
    const i=Math.max(0,Math.min(levels.length-1,Number(o.userData.drawerIndex)||0));
    levels[i]=getBounds(o).minY;
  }
  // Fallback paramétrico se alguma lateral de caixa não estiver disponível.
  const root=getSpaceRoot(cfg.targetRootId),cell=root&&getSpaceCell(root.id,cfg.targetCellId);
  if(root&&cell){
    const openingH=mm(cell.maxY-cell.minY);
    const createFronts=!!cfg.createFronts;
    let frontH=Number(cfg.frontH);
    if(createFronts&&!(frontH>0)){
      frontH=(openingH-Number(cfg.frontGapTop||0)-Number(cfg.frontGapBottom||0)-Number(cfg.frontGapBetween||0)*(levels.length-1))/levels.length;
    }
    const span=openingH-2*Number(cfg.edgeGap||0)-Number(cfg.boxHeight||120);
    const step=levels.length>1?span/(levels.length-1):0;
    for(let i=0;i<levels.length;i++){
      if(levels[i]!=null)continue;
      const yMm=createFronts
        ? mm(cell.minY)+Number(cfg.frontGapBottom||0)+i*(frontH+Number(cfg.frontGapBetween||0))+(frontH-Number(cfg.boxHeight||120))/2
        : mm(cell.minY)+Number(cfg.edgeGap||0)+(levels.length>1?step*i:span/2);
      levels[i]=m(yMm);
    }
  }
  return levels.filter(Number.isFinite);
}
function drawerForceNearestSidePair(cfg){
  const ref=drawerReferenceGeometry(cfg);
  if(!ref)return {left:null,right:null};

  const candidates=[];
  for(const o of objects){
    const u=o.userData;
    if(u?.drawerSetId||u?.kind==='hardware-visual'||u?.kind==='cylinder'||u?.kind==='space-cell')continue;
    const ti=pieceThicknessInfo(o);if(!ti||ti.thicknessAxis!=='x')continue;
    const b=getBounds(o);
    const oy=Math.max(0,Math.min(b.maxY,ref.maxY)-Math.max(b.minY,ref.minY));
    const oz=Math.max(0,Math.min(b.maxZ,ref.maxZ)-Math.max(b.minZ,ref.minZ));
    if(oy<.02||oz<.08)continue;
    candidates.push({o,b,oy,oz});
  }

  let left=null,right=null;
  for(const c of candidates){
    const lg=Math.abs(c.b.maxX-ref.leftInner);
    if(c.b.maxX<=ref.leftInner+.04 && (!left||lg<left.gap))left={o:c.o,gap:lg};
    const rg=Math.abs(c.b.minX-ref.rightInner);
    if(c.b.minX>=ref.rightInner-.04 && (!right||rg<right.gap))right={o:c.o,gap:rg};
  }
  return {left:left?.o||null,right:right?.o||null};
}
function drawerAddCabinetDrillingOnOwners(cfg,levels,left,right){
  if(!cfg.createDrilling)return {holes:0,left:!!left,right:!!right};
  const p=drawerPreset(cfg.slideType),ref=drawerReferenceGeometry(cfg);
  const frontZ=Number.isFinite(ref?.frontZ)?mm(ref.frontZ):0;
  let holes=0;

  for(const [side,owner] of [['left',left],['right',right]]){
    if(!owner)continue;
    const entry=side==='left'?'+x':'-x',ob=objectBoundsMm(owner),x=side==='left'?ob.maxX:ob.minX;
    levels.forEach((baseM,idx)=>{
      const y=mm(baseM)+Math.min(Number(cfg.boxHeight||120)-5,p.mountY);
      for(const off of p.holePattern){
        if(off>Number(cfg.resolvedLength||0)-15)continue;
        const world={x,y,z:frontZ-off};
        if(!pointWithinPieceTangents(owner,world,'x',3.0))continue;
        const op=hardwareHoleOp(owner,world,entry,{diameter:p.holeDiameter,depth:p.holeDepth},{presetId:`drawer-${p.id}`,name:`Corrediça ${p.name}`,role:'contact',contactName:`Gaveta ${idx+1}`},cfg.id);
        op.drawerSetId=cfg.id;op.drawerIndex=idx;op.drawerSlideType=p.id;op.drawerAutoDrilling=true;op.exportAspireFaceHole=true;
        (owner.userData.machining||(owner.userData.machining=[])).push(op);holes++;
      }
    });
    sanitizeMachiningForPiece(owner);
  }
  return {holes,left:!!left,right:!!right};
}
function repairDrawerDrillingForRoot(root){
  if(!root)return {sets:0,holes:0,missingSides:0,forced:0};
  const configs=drawerUniqueConfigsForRoot(root.id).filter(c=>c?.createDrilling);
  let sets=0,holes=0,missingSides=0,forced=0;

  for(const cfg of configs){
    sets++;
    drawerRemoveCabinetDrilling(cfg.id);
    const levels=drawerLevelsFromSet(cfg);
    let r=drawerAddCabinetDrilling(cfg,levels);

    // Se a busca normal falhar ou gerar ZERO furos, usa a geometria das
    // próprias gavetas para escolher o par de laterais mais próximo.
    if(r.holes===0||!r.left||!r.right){
      drawerRemoveCabinetDrilling(cfg.id);
      const pair=drawerForceNearestSidePair(cfg);
      r=drawerAddCabinetDrillingOnOwners(cfg,levels,pair.left,pair.right);
      if(r.holes>0)forced++;
    }

    holes+=r.holes;
    if(!r.left||!r.right)missingSides++;
  }
  return {sets,holes,missingSides,forced};
}
function repairAllDrawerDrillingForAspire(){
  let sets=0,holes=0,missingSides=0,forced=0;
  for(const root of spaceRoots){
    const r=repairDrawerDrillingForRoot(root);
    sets+=r.sets;holes+=r.holes;missingSides+=r.missingSides;forced+=r.forced||0;
  }
  if(sets)renderMachiningVisuals();
  return {sets,holes,missingSides,forced};
}
function groupAspireParts(root,cfg=getSheetPrefs()){
  const parts=furnitureObjects(root).filter(o=>o.userData?.kind!=='space-cell'&&o.userData?.kind!=='cylinder'&&!o.userData?.excludeFromCutList&&o.userData?.kind!=='hardware-visual').map((o,i)=>{const p=flatPartInfo(o,i+1);if(p){p.spaceName=root.name||'Espaço';p.spaceRootId=root.id;}return p;}).filter(Boolean);
  return groupPartArrayForAspire(parts,cfg,'Este móvel não possui peças para exportar');
}
function allProjectFurnitureParts(){
  const parts=[],seen=new Set();let index=0;
  for(const root of spaceRoots){
    for(const o of furnitureObjects(root)){
      if(seen.has(o) || o.userData?.kind==='space-cell' || o.userData?.kind==='cylinder' || o.userData?.excludeFromCutList || o.userData?.kind==='hardware-visual')continue;
      seen.add(o);const p=flatPartInfo(o,++index);if(!p)continue;p.spaceName=root.name||`Espaço ${spaceRoots.indexOf(root)+1}`;p.spaceRootId=root.id;parts.push(p);
    }
  }
  return parts;
}
function groupAspireProjectParts(cfg=getSheetPrefs()){
  return groupPartArrayForAspire(allProjectFurnitureParts(),cfg,'O projeto ainda não possui peças dentro dos espaços');
}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255]);} function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function concatBytes(parts){let len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len),o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
let crcTable=null;function getCrcTable(){if(crcTable)return crcTable;crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}return crcTable;}
function crc32(bytes){let c=0xffffffff,t=getCrcTable();for(const b of bytes)c=t[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function dosTimeDate(d=new Date()){const year=Math.max(1980,d.getFullYear());const date=((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();const time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);return {date,time};}
function zipStore(files){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;const dt=dosTimeDate();
  for(const f of files){const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);const local=concatBytes([u32(0x04034b50),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);const central=concatBytes([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length;}
  const centralSize=centrals.reduce((n,b)=>n+b.length,0),end=concatBytes([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralSize),u32(offset),u16(0)]);return new Blob([...locals,...centrals,end],{type:'application/zip'});
}
function exportMimeAccept(filename,mime='application/octet-stream'){
  const dot=String(filename||'').lastIndexOf('.');
  const ext=dot>=0?String(filename).slice(dot):'';
  return ext?{[mime]:[ext]}:{[mime]:[]};
}
function isExportPickerCancel(err){return err?.name==='AbortError';}
function exportLeafName(filename){
  const raw=String(filename||'arquivo').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').trim();
  return (raw||'arquivo').slice(0,180);
}
async function pickSaveFileTarget(filename,pickerId,mime){
  if(typeof window.showSaveFilePicker!=='function')return null;
  const leaf=exportLeafName(filename);
  const file=await window.showSaveFilePicker({
    id:pickerId,
    suggestedName:leaf,
    types:[{description:'Arquivo do DesignLabMoveis',accept:exportMimeAccept(leaf,mime)}]
  });
  return {kind:'file',handle:file,locationLabel:'local escolhido'};
}
async function pickDirectoryFileTarget(filename,pickerId){
  if(typeof window.showDirectoryPicker!=='function')return null;
  const dir=await window.showDirectoryPicker({id:pickerId,mode:'readwrite'});
  if(dir?.queryPermission){
    let perm=await dir.queryPermission({mode:'readwrite'}).catch(()=>null);
    if(perm!=='granted'&&dir.requestPermission)perm=await dir.requestPermission({mode:'readwrite'}).catch(()=>perm);
    if(perm&&perm!=='granted')throw new Error('A pasta selecionada não liberou permissão para gravar arquivos.');
  }
  const leaf=exportLeafName(filename);
  try{
    const file=await dir.getFileHandle(leaf,{create:true});
    return {kind:'directory',handle:file,locationLabel:`pasta “${dir.name||'selecionada'}”`};
  }catch(firstErr){
    // Alguns provedores de arquivos do Android recusam substituir/criar um nome já existente.
    // Tenta um nome alternativo antes de abandonar a pasta escolhida.
    const dot=leaf.lastIndexOf('.'),base=dot>0?leaf.slice(0,dot):leaf,ext=dot>0?leaf.slice(dot):'';
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15);
    const alt=exportLeafName(`${base}-${stamp}${ext}`);
    try{
      const file=await dir.getFileHandle(alt,{create:true});
      return {kind:'directory',handle:file,locationLabel:`pasta “${dir.name||'selecionada'}”`};
    }catch(secondErr){
      secondErr._designLabDirectoryError=firstErr;
      throw secondErr;
    }
  }
}
async function pickExportTarget(filename,pickerId='designlab-export',mime='application/octet-stream'){
  if(!window.isSecureContext){
    throw new Error('Para escolher uma pasta de exportação, abra o DesignLabMoveis pelo endereço HTTPS do site.');
  }
  const mobileLike=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(navigator.maxTouchPoints>1&&innerWidth<900);
  // No Android o seletor de diretório pode devolver um FileSystemDirectoryHandle que não aceita
  // getFileHandle(). O seletor de salvar usa o gerenciador de arquivos do sistema e permite escolher
  // a pasta/local sem cair no download automático do navegador.
  if(mobileLike&&typeof window.showSaveFilePicker==='function'){
    const direct=await pickSaveFileTarget(filename,pickerId,mime);
    if(direct)return direct;
  }
  let directoryError=null;
  if(typeof window.showDirectoryPicker==='function'){
    try{
      const target=await pickDirectoryFileTarget(filename,pickerId);
      if(target)return target;
    }catch(err){
      if(isExportPickerCancel(err))throw err;
      directoryError=err;
    }
  }
  if(typeof window.showSaveFilePicker==='function'){
    const target=await pickSaveFileTarget(filename,pickerId,mime);
    if(target)return target;
  }
  if(directoryError){
    throw new Error('A pasta foi escolhida, mas o Android/navegador não permitiu criar o arquivo nela. Escolha outro local de salvamento.');
  }
  throw new Error('Este navegador não permite salvar direto em uma pasta/local. Use uma versão compatível do Chrome ou Edge.');
}
function downloadExportFallback(blob,filename){
  const leaf=exportLeafName(filename||'arquivo');
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=leaf;a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
  return {mode:'download',locationLabel:'Downloads do aparelho · modo compatibilidade'};
}
async function shareExportFallback(blob,filename){
  if(typeof navigator.share!=='function'||typeof File!=='function')return null;
  const leaf=exportLeafName(filename||'arquivo');
  // 1.100.95: recria o anexo com bytes concretos. Alguns Android/WhatsApp
  // tratavam o Blob application/dxf como documento vazio.
  const buffer=await blob.arrayBuffer();
  if(!buffer.byteLength)throw new Error('O arquivo a compartilhar está vazio.');
  const bytes=new Uint8Array(buffer);
  const file=new File([bytes],leaf,{type:'application/octet-stream',lastModified:Date.now()});
  if(file.size!==bytes.byteLength||file.size===0)throw new Error('Não foi possível preparar o DXF para compartilhar.');
  try{
    if(typeof navigator.canShare==='function'&&!navigator.canShare({files:[file]}))return null;
    await navigator.share({files:[file],title:leaf,text:`DesignLabMoveis · ${Math.max(1,Math.round(file.size/1024))} KB`});
    return {mode:'share',locationLabel:'local escolhido no Android',size:file.size};
  }catch(err){
    if(err?.name==='AbortError')throw err;
    return null;
  }
}
async function writeExportTarget(target,blob,filename='arquivo'){
  if(!(blob instanceof Blob)||blob.size<=0)throw new Error('O arquivo gerado está vazio; exportação cancelada.');
  let writable=null;
  try{
    if(!target?.handle||typeof target.handle.createWritable!=='function')throw new Error('Destino sem suporte a gravação direta.');
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(!bytes.byteLength)throw new Error('O arquivo gerado está vazio; exportação cancelada.');
    writable=await target.handle.createWritable({keepExistingData:false});
    await writable.write(bytes);
    await writable.close();
    writable=null;
    // Confere o arquivo já salvo. Se o Android devolver 0 KB, tratamos como falha.
    if(typeof target.handle.getFile==='function'){
      const saved=await target.handle.getFile();
      if(!saved||saved.size<=0)throw new Error('O Android criou o arquivo, mas ele ficou com 0 KB.');
      return {mode:'direct',locationLabel:target.locationLabel||'local escolhido',size:saved.size};
    }
    return {mode:'direct',locationLabel:target.locationLabel||'local escolhido',size:blob.size};
  }catch(err){
    try{if(writable&&typeof writable.abort==='function')await writable.abort();}catch{}
    const mobileLike=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(navigator.maxTouchPoints>1&&innerWidth<900);
    if(mobileLike){
      const shared=await shareExportFallback(blob,filename).catch(e=>{if(e?.name==='AbortError')throw e;return null;});
      if(shared)return shared;
      return downloadExportFallback(blob,filename);
    }
    throw err;
  }
}
function buildAspireReadme(root,groups,cfg){
  const ops=groups.reduce((n,g)=>n+g.parts.reduce((m,p)=>m+actualMachiningCount(p),0),0),totalParts=groups.reduce((n,g)=>n+g.parts.length,0);
  const byKey=new Map();for(const g of groups)byKey.set(g.key,Math.max(byKey.get(g.key)||0,g.sheetNo));
  return `DesignLabMoveis 1.100.95 - Pacote Aspire\r\nMóvel: ${root.name}\r\nUnidade: milímetros\r\nChapa padrão/fallback: ${cfg.width} x ${cfg.height} mm\r\nMargem: ${cfg.margin} mm | Folga: ${cfg.gap} mm | Veio padrão: ${(cfg.grainDirection||'length')==='width'?'LARGURA':'COMPRIMENTO'}\r\n${cutModeReadmeText(cfg)}\r\n\r\nCHAPAS\r\n${[...byKey.entries()].map(([k,n])=>{const g=groups.find(x=>x.key===k),gc=g?.cfg||cfg;return '- '+k+': '+n+' chapa(s) · '+gc.width+' x '+gc.height+' mm'+(g?.parts?.some(p=>p.materialGrain)?' · veio '+((gc.grainDirection||'length')==='width'?'na largura':'no comprimento'):'');}).join('\r\n')}\r\n\r\nARQUIVOS DXF\r\n${groups.map(g=>'- '+g.file+' = '+g.key+' / chapa '+g.sheetNo+' ('+g.parts.length+' peça(s))').join('\r\n')}\r\n- lista-pecas.csv = posição, medidas e identificação de cada peça\r\n- plano-chapas.csv = resumo das chapas e aproveitamento por área\r\n- usinagens.csv = uma linha por furo/rasgo real\r\n\r\nLAYERS\r\nCHAPA_REFERENCIA = contorno da chapa; NÃO criar toolpath de corte nesta layer\r\nCORTE_EXTERNO = contorno final REAL das peças, incluindo curvas e Formas paramétricas\r\nFURO_A_Dx_Py / FURO_B_Dx_Py = furos por face, diâmetro e profundidade; no DXF são entidades CIRCLE\r\nRASGO_A_Wx_Py / RASGO_B_Wx_Py = rasgos manuais\r\nRASGO_FUNDO_A_Wx_Py / RASGO_FUNDO_B_Wx_Py = rasgos de fundo automáticos\r\nENCAIXE_MONTANTE = encaixes das nervuras curvas para os montantes\r\nCORTE_SECCIONADORA = linhas retas numeradas do modo seccionadora; ignore esta layer no modo CNC\r\n\r\nIMPORTANTE\r\nCada DXF representa UMA chapa física. Se o móvel precisar de 3 chapas MDF 18 mm, serão criados 3 DXFs MDF 18 mm. Materiais e espessuras diferentes nunca são misturados.\r\nQuando “Material madeirado / manter sentido do veio” estiver marcado, nenhuma peça gira 90°. Quando estiver desmarcado, o CAD pode girar automaticamente para melhorar o aproveitamento.\r\nSem rotação, o DXF preserva os eixos naturais da peça: portas/fundos usam X horizontal e Y vertical; bases/prateleiras usam X/Z; laterais usam Z/Y.\r\nCoordenadas negativas são referências do lado oposto: Y=-100 mantém a operação 100 mm do topo mesmo se a peça for redimensionada. O usinagens.csv traz coordenadas reais e também X_ref/Y_ref/Z_ref.\r\nFerragens podem criar FUROS DE BORDA (entrada em eixo diferente da espessura). Esses furos ficam identificados como FURO_BORDA no usinagens.csv e não viram círculo no DXF da face principal, pois exigem usinagem lateral ou virar a peça; isso evita gerar um toolpath vertical incorreto.\r\n\r\nTotal: ${totalParts} peça(s), ${groups.length} chapa(s), ${ops} operação(ões) geométrica(s).\r\nNo Aspire, associe toolpaths às layers conforme ferramenta, profundidade e estratégia de face.\r\n`;
}
function groupedPartRows(parts){
  const map=new Map();
  for(const p of parts){
    const k=[p.name,p.material,p.materialCode||'',p.thickness,p.faceW,p.faceH,p.materialGrain?'grain':'',normalizePieceGrainRotation(p.materialGrainRotation),p.edgeBandSignature||''].join('|');
    if(!map.has(k))map.set(k,{...p,qty:0,spaceNames:new Set()});
    const row=map.get(k);row.qty++;if(p.spaceName)row.spaceNames.add(p.spaceName);
  }
  return [...map.values()];
}
function buildProjectAspireReadme(groups,cfg){
  const ops=groups.reduce((n,g)=>n+g.parts.reduce((m,p)=>m+actualMachiningCount(p),0),0),totalParts=groups.reduce((n,g)=>n+g.parts.length,0);
  const byKey=new Map();for(const g of groups)byKey.set(g.key,Math.max(byKey.get(g.key)||0,g.sheetNo));
  const spaces=[...new Set(groups.flatMap(g=>g.parts.map(p=>p.spaceName).filter(Boolean)))];
  return `DesignLabMoveis 1.100.95 - Pacote Aspire do projeto completo\r\nUnidade: milímetros\r\nEspaços incluídos: ${spaces.length}\r\n${spaces.map(x=>'- '+x).join('\r\n')}\r\n\r\nChapa padrão/fallback: ${cfg.width} x ${cfg.height} mm\r\nMargem: ${cfg.margin} mm | Folga: ${cfg.gap} mm | Veio padrão: ${(cfg.grainDirection||'length')==='width'?'LARGURA':'COMPRIMENTO'}\r\n${cutModeReadmeText(cfg)}\r\n\r\nCHAPAS\r\n${[...byKey.entries()].map(([k,n])=>{const g=groups.find(x=>x.key===k),gc=g?.cfg||cfg;return '- '+k+': '+n+' chapa(s) · '+gc.width+' x '+gc.height+' mm'+(g?.parts?.some(p=>p.materialGrain)?' · veio '+((gc.grainDirection||'length')==='width'?'na largura':'no comprimento'):'');}).join('\r\n')}\r\n\r\nARQUIVOS DXF\r\n${groups.map(g=>'- '+g.file+' = '+g.key+' / chapa '+g.sheetNo+' ('+g.parts.length+' peça(s))').join('\r\n')}\r\n- lista-pecas.csv = todas as peças do projeto, com espaço de origem\r\n- etiquetas-base.csv = dados estruturados para a futura geração de etiquetas (material, fita por lado, medidas e ID)\r\n- plano-chapas.csv = resumo das chapas e aproveitamento por área\r\n- usinagens.csv = uma linha por furo/rasgo real, com espaço de origem\r\n\r\nLAYERS\r\nCHAPA_REFERENCIA = contorno da chapa; NÃO criar toolpath nesta layer\r\nCORTE_EXTERNO = contorno final REAL das peças, incluindo curvas e Formas paramétricas\r\nFURO_A_Dx_Py / FURO_B_Dx_Py = furos por face, diâmetro e profundidade; no DXF são entidades CIRCLE\r\nRASGO_A_Wx_Py / RASGO_B_Wx_Py = rasgos manuais\r\nRASGO_FUNDO_A_Wx_Py / RASGO_FUNDO_B_Wx_Py = rasgos de fundo automáticos\r\nENCAIXE_MONTANTE = encaixes das nervuras curvas para os montantes\r\nCORTE_SECCIONADORA = linhas retas numeradas do modo seccionadora; ignore esta layer no modo CNC\r\n\r\nIMPORTANTE\r\nO plano de corte é calculado com TODAS as peças de TODOS os espaços juntas. Peças do mesmo material e espessura podem compartilhar a mesma chapa, melhorando o aproveitamento.\r\nCada DXF representa UMA chapa física. Se forem necessárias 4 chapas MDF 18 mm, serão gerados 4 DXFs MDF 18 mm. Materiais e espessuras diferentes nunca são misturados.\r\nQuando “Material madeirado / manter sentido do veio” estiver marcado, nenhuma peça gira 90°. Quando estiver desmarcado, o CAD pode girar automaticamente para melhorar o aproveitamento.\r\nSem rotação, o DXF preserva os eixos naturais da peça: portas/fundos usam X horizontal e Y vertical; bases/prateleiras usam X/Z; laterais usam Z/Y.\r\nCoordenadas negativas são referências do lado oposto: Y=-100 mantém a operação 100 mm do topo mesmo se a peça for redimensionada. O usinagens.csv traz coordenadas reais e também X_ref/Y_ref/Z_ref.\r\nFerragens podem criar FUROS DE BORDA (entrada em eixo diferente da espessura). Esses furos ficam identificados como FURO_BORDA no usinagens.csv e não viram círculo no DXF da face principal, pois exigem usinagem lateral ou virar a peça; isso evita gerar um toolpath vertical incorreto.\r\n\r\nTotal: ${totalParts} peça(s), ${groups.length} chapa(s), ${ops} operação(ões) geométrica(s).\r\n`;
}
function legacyV41_renderPartsList(){
  const cfg=sheetPrefsFromUi();setSheetPrefs(cfg);
  const list=$('partsList'),summary=$('partsSummary');list.innerHTML='';
  try{
    const groups=groupAspireProjectParts(cfg),allParts=groups.flatMap(g=>g.parts),byKey=new Map();
    const spaces=[...new Set(allParts.map(p=>p.spaceName).filter(Boolean))];
    let totalArea=0,totalUsable=0,totalCutLength=0,totalCuts=0,totalKeep=0;
    for(const g of groups){
      const m=sheetPreviewCutMetrics(g,cfg);
      totalArea+=m.area;totalUsable+=m.usable;totalCutLength+=m.cutLength;totalCuts+=m.cuts.length;totalKeep+=m.keep.length;
      if(!byKey.has(g.key))byKey.set(g.key,{sheets:[],parts:[]});
      const x=byKey.get(g.key);x.sheets.push({group:g,metrics:m});x.parts.push(...g.parts);
    }
    const totalPct=totalUsable>0?totalArea/totalUsable*100:0;
    const opt=cfg.optimization==='advanced'?'avançada':'normal';
    const pref=cfg.preference==='auto'?'automática':cfg.preference==='length'?'comprimento':cfg.preference==='width'?'largura':'sem preferência';
    summary.innerHTML=`<strong>${allParts.length} peça(s)</strong> · ${spaces.length} espaço(s) · <strong>${groups.length} chapa(s)</strong><br><strong>${sheetCutModeLabel(cfg)}</strong> · aproveitamento geral <strong>${nice(totalPct)}%</strong>${cfg.cutMode!=='cnc'?` · ${totalCuts} corte(s) / ${nice(totalCutLength/1000)} m`:''}${cfg.cutMode!=='cnc'?` · ${totalKeep} sobra(s) para guardar`:''}<br>Chapa ${nice(cfg.width)} × ${nice(cfg.height)} mm · refilo ${nice(cfg.margin)} mm/lado · serra/canal ${nice(cfg.gap)} mm · otimização ${opt} · direção ${pref}${cfg.rotate?' · giro 90° permitido onde não há veio':' · giro 90° bloqueado'}`;
    for(const [key,data] of byKey.entries()){
      const keyArea=data.sheets.reduce((n,x)=>n+x.metrics.area,0),keyUsable=data.sheets.reduce((n,x)=>n+x.metrics.usable,0),keyPct=keyUsable?keyArea/keyUsable*100:0;
      const box=document.createElement('div');box.className='partsGroup';
      const head=document.createElement('div');head.className='partsGroupHead';const a=document.createElement('span');a.textContent=key.replace(/_/g,' ');const b=document.createElement('span');b.textContent=`${data.sheets.length} chapa(s) · ${nice(keyPct)}%`;head.append(a,b);box.appendChild(head);
      for(const p of groupedPartRows(data.parts)){
        const row=document.createElement('div');row.className='partRow';const left=document.createElement('div');const nm=document.createElement('div');nm.className='partRowName';nm.textContent=p.name;const meta=document.createElement('div');meta.className='partRowMeta';const origins=[...p.spaceNames];meta.textContent=`${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm · ${p.material}${p.materialCode?' · '+p.materialCode:''}${p.materialGrain?' · veio':''}${p.edgeBandSummary?' · FITA: '+p.edgeBandSummary:''}${origins.length?' · '+origins.join(', '):''}`;left.append(nm,meta);const qty=document.createElement('div');qty.className='partQty';qty.textContent=`×${p.qty}`;row.append(left,qty);box.appendChild(row);
      }
      const chips=document.createElement('div');chips.style.padding='7px 10px 9px';
      data.sheets.forEach((x,i)=>{const c=document.createElement('span');c.className='sheetChip';c.textContent=`Chapa ${i+1} · ${nice(x.metrics.pct)}%${cfg.cutMode!=='cnc'?` · ${x.metrics.cuts.length} cortes`:''}`;chips.appendChild(c);});
      box.appendChild(chips);list.appendChild(box);
    }
    if(cfg.cutMode==='ocl')$('partsListInfo').textContent=`Projeto completo · plano guilhotina inteligente otimizado: combina ${spaces.length} espaço(s), testa múltiplas ordens/direções e preserva sobras aproveitáveis.`;
    else if(cfg.cutMode==='panel')$('partsListInfo').textContent=`Projeto completo · modo Seccionadora: distribuição por cortes retos em guilhotina, combinando ${spaces.length} espaço(s).`;
    else $('partsListInfo').textContent=`Projeto completo · modo CNC: calcula o aproveitamento e reorganiza as peças menores do centro para fora, combinando ${spaces.length} espaço(s).`;
  }catch(err){summary.textContent=err.message||'Não foi possível calcular as chapas';$('partsListInfo').textContent='Lista geral de peças de todos os espaços do projeto.';}
}
function legacyV41_openPartsListDialog(){applySheetPrefsToUi();renderPartsList();$('partsListDialog').style.display='flex';}
async function exportProjectAspireZip(){
  let target=null;
  try{
    // Abre o seletor primeiro para preservar a permissão iniciada pelo clique.
    target=await pickExportTarget('projeto-completo-aspire.zip','designlab-export-aspire-projeto','application/zip');
    const grooves=repairAllDrawerBottomGrooves();
    const repaired=repairAllDrawerDrillingForAspire();
    if(repaired.sets>0&&repaired.holes===0)throw new Error('Há gavetas com furação marcada, mas nenhum furo pôde ser ligado às laterais. Selecione uma lateral do móvel e confira se ela pertence ao mesmo espaço.');
    if(grooves.sets>0&&grooves.created!==grooves.expected)throw new Error(`Rasgos do fundo incompletos: ${grooves.created}/${grooves.expected}.`);
    const cfg=getSheetPrefs(),groups=groupAspireProjectParts(cfg),files=[];
    for(const g of groups)files.push({name:g.file,data:g.text});
    files.push({name:'lista-pecas.csv',data:buildPartsCsv(groups)});
    files.push({name:'etiquetas-base.csv',data:buildLabelsBaseCsv(groups)});
    files.push({name:'plano-chapas.csv',data:buildSheetsCsv(groups,cfg)});
    if(cfg.cutMode==='panel'){files.push({name:'cortes-seccionadora.csv',data:buildPanelSawCutsCsv(groups,cfg)});files.push(...buildMingliZawFiles(groups,cfg));}
    files.push({name:'usinagens.csv',data:buildMachiningCsv(groups)});
    files.push({name:'LEIA-ME.txt',data:buildProjectAspireReadme(groups,cfg)});
    const saveResult=await writeExportTarget(target,zipStore(files),'projeto-completo-aspire.zip');
    const ops=groups.reduce((n,g)=>n+g.parts.reduce((m,p)=>m+actualMachiningCount(p),0),0);
    toast(`Projeto Aspire salvo em ${saveResult.locationLabel} · ${groups.length} chapa(s) · ${groups.reduce((n,g)=>n+g.parts.length,0)} peça(s) · ${ops} operação(ões)${grooves.sets?` · RASGOS FUNDO: ${grooves.created}`:''}${repaired.sets?` · FUROS CORREDIÇA: ${repaired.holes}${repaired.forced?` (fallback ${repaired.forced})`:''}`:''}`);
  }catch(err){
    if(isExportPickerCancel(err)){toast('Exportação cancelada');return;}
    toast(err.message||'Não foi possível exportar o projeto para Aspire');
  }
}
async function exportSelectedAspireDxf(){
  const root=selectedFurnitureRoot();
  if(!root){toast('Selecione um espaço do móvel');return;}
  const filename=`${safeFileName(root.name,'movel')}-aspire.zip`;
  let target=null;
  try{
    // A pasta/local é escolhida antes de montar o ZIP, sem usar download do navegador.
    target=await pickExportTarget(filename,'designlab-export-aspire-movel','application/zip');
    const grooves=repairDrawerBottomGroovesForRoot(root);
    const repaired=repairDrawerDrillingForRoot(root);

    if(repaired.sets>0&&repaired.holes===0)throw new Error('Há gavetas com furação marcada, mas nenhum furo pôde ser ligado às laterais deste móvel.');
    if(grooves.sets>0&&grooves.created!==grooves.expected)throw new Error(`Rasgos do fundo incompletos: ${grooves.created}/${grooves.expected}.`);

    const cfg=getSheetPrefs(),groups=groupAspireParts(root,cfg),files=[];
    for(const g of groups)files.push({name:g.file,data:g.text});
    files.push({name:'lista-pecas.csv',data:buildPartsCsv(groups)});
    files.push({name:'etiquetas-base.csv',data:buildLabelsBaseCsv(groups)});
    files.push({name:'plano-chapas.csv',data:buildSheetsCsv(groups,cfg)});
    if(cfg.cutMode==='panel'){files.push({name:'cortes-seccionadora.csv',data:buildPanelSawCutsCsv(groups,cfg)});files.push(...buildMingliZawFiles(groups,cfg));}
    files.push({name:'usinagens.csv',data:buildMachiningCsv(groups)});
    files.push({name:'LEIA-ME.txt',data:buildAspireReadme(root,groups,cfg)});
    const saveResult=await writeExportTarget(target,zipStore(files),filename);

    const ops=groups.reduce((n,g)=>n+g.parts.reduce((m,p)=>m+actualMachiningCount(p),0),0);
    toast(`Aspire ZIP salvo em ${saveResult.locationLabel} · ${groups.length} chapa(s) · ${ops} operação(ões)${grooves.sets?` · RASGOS FUNDO: ${grooves.created}`:''}${repaired.sets?` · FUROS CORREDIÇA: ${repaired.holes}${repaired.forced?` (fallback ${repaired.forced})`:''}`:''}`);
  }catch(err){
    if(isExportPickerCancel(err)){toast('Exportação cancelada');return;}
    toast(err.message||'Não foi possível exportar pacote Aspire');
  }
}



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
    tapeCrosshairLabel.textContent='Trena';
  }
  $('hintText').textContent = mode==='select' ? 'Selecionar · toque exatamente onde o dedo encostar'
    : mode==='move-free' ? 'Mover · reconhece quina, guia, aresta e face' 
    : 'Trena · 1 toque fixa P1 · 2º toque cria guia · duplo toque em eixo/aresta cria guia infinita';
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


// ============================================================================
// 1.100.95 · PLANO DE CORTE OTIMIZADO
// Mantém a exportação Aspire existente separada. Este bloco cuida somente
// do cálculo e da visualização do plano de corte na interface.
// ============================================================================
const CUT_PLAN_PREFS_KEY='designlabCutPlanV42';
let cutPlanLastGroups=[];

function cutPlanReadExtraPrefs(){
  try{return JSON.parse(localStorage.getItem(CUT_PLAN_PREFS_KEY)||'{}')||{};}catch(_){return {}}
}
function cutPlanSaveExtraPrefs(){
  const p={
    optimization:$('sheetOptimization')?.value||'medium',
    direction:$('sheetDirection')?.value||'auto',
    keepLength:Math.max(0,Number($('sheetKeepLength')?.value)||0),
    keepWidth:Math.max(0,Number($('sheetKeepWidth')?.value)||0)
  };
  localStorage.setItem(CUT_PLAN_PREFS_KEY,JSON.stringify(p));return p;
}
function applyCutPlanExtraPrefs(){
  const p=cutPlanReadExtraPrefs();
  if($('sheetOptimization'))$('sheetOptimization').value=p.optimization==='advanced'?'advanced':'medium';
  if($('sheetDirection'))$('sheetDirection').value=['none','length','width'].includes(p.direction)?p.direction:'auto';
  if($('sheetKeepLength'))$('sheetKeepLength').value=Number.isFinite(Number(p.keepLength))?Number(p.keepLength):100;
  if($('sheetKeepWidth'))$('sheetKeepWidth').value=Number.isFinite(Number(p.keepWidth))?Number(p.keepWidth):100;
}
function cutPlanCfgFromUi(){
  const base=sheetPrefsFromUi(),x=cutPlanSaveExtraPrefs();
  return {...base,optimization:x.optimization,direction:x.direction,keepLength:x.keepLength,keepWidth:x.keepWidth};
}
function cutPlanModeLabel(cfg){
  return cfg.cutMode==='panel'?'Seccionadora · cortes retos':cfg.cutMode==='cnc'?'CNC / Router · encaixe livre':'Otimizado · cortes guilhotina';
}
function updateSheetCutModeUi(){
  const mode=$('sheetCutMode')?.value||'open',help=$('sheetCutModeHelp');
  document.querySelectorAll('.oclOnly').forEach(el=>el.style.display=mode==='open'?'block':'none');
  document.querySelectorAll('.panelOnly').forEach(el=>el.style.display=mode==='panel'?'':'none');
  if(!help)return;
  if(mode==='panel'){
    help.className='sheetModeHelp panel';
    help.innerHTML='<strong>Seccionadora de pinça:</strong> monta o plano em 2 etapas. Primeiro corta a chapa em faixas; depois o operador gira cada faixa <b>uma única vez em 90°</b> e executa os cortes das peças. Além da sequência CSV, a versão 1.100.95 gera pacote Mingli .ZAW de teste com UM arquivo por chapa física; as etapas ficam dentro do mesmo ZAW.';
  }else if(mode==='cnc'){
    help.className='sheetModeHelp cnc';
    help.innerHTML='<strong>CNC / Router:</strong> usa encaixe livre para aproveitar área. Não força sequência guilhotina no plano visual.';
  }else{
    help.className='sheetModeHelp open';
    help.innerHTML='<strong>Otimizado:</strong> usa cortes guilhotina, considera refilo e espessura de corte, testa orientações e tenta concentrar a sobra em retalhos maiores e reaproveitáveis.';
  }
}

function cutPlanCode(index){
  let n=Math.max(0,index|0),s='';
  do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1;}while(n>=0);
  return s;
}
function cutPlanPartSignature(p){
  return [p.name,p.material,p.materialCode||'',roundMmNumber(p.thickness,3),roundMmNumber(p.faceW,3),roundMmNumber(p.faceH,3),p.materialGrain?'1':'0',normalizePieceGrainRotation(p.materialGrainRotation),p.edgeBandSignature||''].join('|');
}
function cutPlanAssignCodes(parts){
  const sigs=[...new Set(parts.map(cutPlanPartSignature))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}));
  const map=new Map(sigs.map((s,i)=>[s,cutPlanCode(i)]));
  return parts.map(p=>({...p,cutCode:map.get(cutPlanPartSignature(p))||'?'}));
}
function cutPlanOrder(parts,mode){
  const a=[...parts];
  if(mode==='max')return a.sort((x,y)=>(Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH))||(y.faceW*y.faceH-x.faceW*x.faceH));
  if(mode==='width')return a.sort((x,y)=>(y.faceW-x.faceW)||(y.faceW*y.faceH-x.faceW*x.faceH));
  if(mode==='height')return a.sort((x,y)=>(y.faceH-x.faceH)||(y.faceW*y.faceH-x.faceW*x.faceH));
  if(mode==='perimeter')return a.sort((x,y)=>((y.faceW+y.faceH)-(x.faceW+x.faceH))||(y.faceW*y.faceH-x.faceW*x.faceH));
  return a.sort((x,y)=>(y.faceW*y.faceH-x.faceW*x.faceH)||(Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH)));
}
function cutPlanSplitRects(free,o,cfg,split){
  const remW=free.w-o.w,remH=free.h-o.h,k=Math.max(0,cfg.gap),out=[];
  if(split==='V'){
    if(remW>k+.001)out.push({x:free.x+o.w+k,y:free.y,w:remW-k,h:free.h});
    if(remH>k+.001)out.push({x:free.x,y:free.y+o.h+k,w:o.w,h:remH-k});
  }else{
    if(remH>k+.001)out.push({x:free.x,y:free.y+o.h+k,w:free.w,h:remH-k});
    if(remW>k+.001)out.push({x:free.x+o.w+k,y:free.y,w:remW-k,h:o.h});
  }
  return out.filter(r=>r.w>.001&&r.h>.001);
}
function cutPlanCandidateScore(free,o,cfg,split,direction='none'){
  if(o.w>free.w+.001||o.h>free.h+.001)return null;
  const kids=cutPlanSplitRects(free,o,cfg,split),waste=free.w*free.h-o.w*o.h;
  const largest=kids.length?Math.max(...kids.map(r=>r.w*r.h)):0;
  const sliverPenalty=kids.reduce((n,r)=>n+(Math.min(r.w,r.h)<Math.max(45,cfg.gap*5)?1:0),0);
  const cutLength=(split==='V'?(free.w-o.w>.001?free.h:0)+(free.h-o.h>.001?o.w:0):(free.h-o.h>.001?free.w:0)+(free.w-o.w>.001?o.h:0));
  const dirPenalty=direction==='length'?(split==='H'?0:1):direction==='width'?(split==='V'?0:1):0;
  const rotatePenalty=o.rotated?.12:0;
  return [sliverPenalty,dirPenalty,waste,-largest,cutLength,rotatePenalty,free.y,free.x];
}
function cutPlanFindPlacement(sheet,part,cfg,direction){
  let best=null;
  for(let fi=0;fi<sheet.freeRects.length;fi++){
    const free=sheet.freeRects[fi];
    for(const o of partOrientations(part,cfg))for(const split of ['H','V']){
      const score=cutPlanCandidateScore(free,o,cfg,split,direction);if(!score)continue;
      if(!best||compareSheetScores(score,best.score)<0)best={fi,free,o,split,score};
    }
  }
  return best;
}
function cutPlanNewSheet(cfg){
  const w=cfg.width-2*cfg.margin,h=cfg.height-2*cfg.margin;
  if(w<=0||h<=0)throw new Error('O refilo é maior que a área útil da chapa.');
  return {freeRects:[{x:0,y:0,w,h}],placements:[],cuts:[]};
}
function cutPlanAddCut(sheet,cut){
  if(!(cut.length>.001))return;
  const key=[cut.orientation,roundMmNumber(cut.x1,2),roundMmNumber(cut.y1,2),roundMmNumber(cut.x2,2),roundMmNumber(cut.y2,2)].join('|');
  if(sheet._cutKeys?.has(key))return;
  if(!sheet._cutKeys)sheet._cutKeys=new Set();sheet._cutKeys.add(key);
  cut.order=sheet.cuts.length+1;sheet.cuts.push(cut);
}
function cutPlanCommitPlacement(sheet,part,cfg,best){
  const free=best.free,o=best.o,k=Math.max(0,cfg.gap),fx=cfg.margin+free.x,fy=cfg.margin+free.y;
  sheet.freeRects.splice(best.fi,1,...cutPlanSplitRects(free,o,cfg,best.split));
  const placed={...part,x:fx,y:fy,rotated:o.rotated,placedW:o.w,placedH:o.h};sheet.placements.push(placed);
  const remW=free.w-o.w,remH=free.h-o.h;
  if(best.split==='V'){
    if(remW>.001)cutPlanAddCut(sheet,{orientation:'V',x1:fx+o.w+k/2,y1:fy,x2:fx+o.w+k/2,y2:fy+free.h,length:free.h});
    if(remH>.001)cutPlanAddCut(sheet,{orientation:'H',x1:fx,y1:fy+o.h+k/2,x2:fx+o.w,y2:fy+o.h+k/2,length:o.w});
  }else{
    if(remH>.001)cutPlanAddCut(sheet,{orientation:'H',x1:fx,y1:fy+o.h+k/2,x2:fx+free.w,y2:fy+o.h+k/2,length:free.w});
    if(remW>.001)cutPlanAddCut(sheet,{orientation:'V',x1:fx+o.w+k/2,y1:fy,x2:fx+o.w+k/2,y2:fy+o.h,length:o.h});
  }
  return placed;
}
function cutPlanPackAttempt(parts,cfg,orderMode,direction){
  const ordered=cutPlanOrder(parts,orderMode),sheets=[];
  const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
  for(const part of ordered){
    if(!partOrientations(part,cfg).some(o=>o.w<=usableW+.001&&o.h<=usableH+.001))throw new Error(`${part.name}: ${nice(part.faceW)} × ${nice(part.faceH)} mm não cabe na chapa ${nice(cfg.width)} × ${nice(cfg.height)} mm.`);
    let bestSheet=-1,best=null;
    for(let i=0;i<sheets.length;i++){
      const c=cutPlanFindPlacement(sheets[i],part,cfg,direction);if(!c)continue;
      if(!best||compareSheetScores(c.score,best.score)<0){best=c;bestSheet=i;}
    }
    if(bestSheet<0){const s=cutPlanNewSheet(cfg),c=cutPlanFindPlacement(s,part,cfg,direction);if(!c)throw new Error(`${part.name}: não foi possível posicionar.`);cutPlanCommitPlacement(s,part,cfg,c);sheets.push(s);}else cutPlanCommitPlacement(sheets[bestSheet],part,cfg,best);
  }
  return sheets;
}
function cutPlanAttemptScore(sheets,cfg){
  let fragmentation=0,cutLength=0,cutCount=0,largestReusable=0;
  for(const s of sheets){
    fragmentation+=(s.freeRects||[]).length;
    cutLength+=(s.cuts||[]).reduce((n,c)=>n+c.length,0);cutCount+=(s.cuts||[]).length;
    for(const r of s.freeRects||[])if(r.w>=cfg.keepLength&&r.h>=cfg.keepWidth)largestReusable=Math.max(largestReusable,r.w*r.h);
  }
  return [sheets.length,fragmentation,cutLength,cutCount,-largestReusable];
}
function cutPlanPackOpen(parts,cfg){
  const dirs=cfg.direction==='auto'?['none','length','width']:[cfg.direction||'none'];
  const modes=cfg.optimization==='advanced'?['area','max','width','height','perimeter']:['area','max'];
  let best=null,lastError=null;
  for(const dir of dirs)for(const mode of modes){
    try{
      const sheets=cutPlanPackAttempt(parts,cfg,mode,dir),score=cutPlanAttemptScore(sheets,cfg);
      if(!best||compareSheetScores(score,best.score)<0)best={sheets,score};
    }catch(err){lastError=err;}
  }
  if(!best)throw lastError||new Error('Não foi possível calcular o plano de corte.');
  return best.sheets;
}
function cutPlanSheetStats(sheet,cfg){
  const area=sheet.placements.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),usable=Math.max(1,(cfg.width-2*cfg.margin)*(cfg.height-2*cfg.margin));
  const cutLength=(sheet.cuts||[]).reduce((n,c)=>n+c.length,0);
  const reusable=(sheet.freeRects||[]).filter(r=>r.w>=cfg.keepLength&&r.h>=cfg.keepWidth).sort((a,b)=>b.w*b.h-a.w*a.h);
  return {area,efficiency:area/usable*100,cutLength,reusable};
}
function cutPlanBuildGroups(cfg=cutPlanCfgFromUi()){
  const raw=allProjectFurnitureParts();if(!raw.length)throw new Error('O projeto ainda não possui peças para o plano de corte.');
  const byMaterial=new Map();
  for(const p of raw){const mat=normalizedLayer(p.material||'MDF')||'MDF',key=`${mat}_${layerNum(p.thickness)}mm`;if(!byMaterial.has(key))byMaterial.set(key,[]);byMaterial.get(key).push(p);}
  const groups=[];
  for(const [key,baseParts] of byMaterial.entries()){
    const parts=cutPlanAssignCodes(baseParts),groupCfg=sheetPrefsForPartGroup(cfg,baseParts);let sheets;
    if(groupCfg.cutMode==='panel')sheets=packPartsIntoSheetsPanelSaw(parts,groupCfg);
    else if(groupCfg.cutMode==='cnc')sheets=packPartsIntoSheetsCnc(parts,groupCfg);
    else sheets=cutPlanPackOpen(parts,groupCfg);
    sheets.forEach((s,i)=>{
      const stats=cutPlanSheetStats(s,groupCfg),first=s.placements[0];
      const preview=buildAspireSheetEntities(s.placements,groupCfg,s.cuts||[]);
      groups.push({
        key,displayName:`${first?.materialCode||first?.material||'Material'} · ${nice(first?.thickness||0)} mm`,
        sheetNo:i+1,totalSheets:sheets.length,parts:s.placements,panelCuts:s.cuts||[],panelSequence:s.panelSequence||null,panelStrips:s.strips||[],freeRects:s.freeRects||[],stats,cfg:{...groupCfg},planMode:groupCfg.cutMode,
        previewEntities:preview.entities,circleCount:preview.circleCount,expectedFaceHoles:preview.expectedFaceHoles
      });
    });
  }
  return groups;
}
function cutPlanGroupRows(parts){
  const map=new Map();
  for(const p of parts){
    const k=cutPlanPartSignature(p);
    if(!map.has(k))map.set(k,{...p,qty:0,spaceNames:new Set(),sourceObjects:[]});
    const r=map.get(k);r.qty++;if(p.spaceName)r.spaceNames.add(p.spaceName);
    if(p.object&&!r.sourceObjects.includes(p.object))r.sourceObjects.push(p.object);
  }
  return [...map.values()].sort((a,b)=>String(a.cutCode).localeCompare(String(b.cutCode),'en',{numeric:true}));
}
function cutPlanToggleGrainObjects(sourceObjects,{keepPreview=false,previewObject=null}={}){
  const targets=[...new Set((sourceObjects||[]).filter(Boolean))].filter(o=>o.userData?.materialGrain);
  if(!targets.length){toast('Esta peça não usa material madeirado / com veio');return;}
  for(const o of targets){
    const u=o.userData||{};
    u.materialGrainRotation=normalizePieceGrainRotation(u.materialGrainRotation)===90?0:90;
  }
  commitHistory();
  // Recalcula imediatamente porque mudar o veio pode obrigar a peça a girar
  // 90° na chapa e, por consequência, reorganizar todo o plano de corte.
  renderPartsList();
  if(keepPreview){
    const wanted=previewObject||targets[0];
    sheetPreviewGroups=cutPlanLastGroups;
    let foundGroup=-1,foundPart=null;
    for(let gi=0;gi<sheetPreviewGroups.length;gi++){
      const p=sheetPreviewGroups[gi].parts.find(x=>x.object===wanted||(wanted.userData?.partId&&x.partId===wanted.userData.partId));
      if(p){foundGroup=gi;foundPart=p;break;}
    }
    if(foundGroup>=0){
      sheetPreviewIndex=foundGroup;sheetPreviewSelectedPart=foundPart;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw();
    }else{
      sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw();
    }
  }
  const rot=normalizePieceGrainRotation(targets[0].userData?.materialGrainRotation);
  toast(targets.length>1?`Veio alterado em ${targets.length} peças · ${rot}°`:`Veio da peça alterado para ${rot}°`);
}
function renderPartsList(){
  const cfg=cutPlanCfgFromUi();setSheetPrefs(cfg);updateSheetCutModeUi();
  const list=$('partsList'),summary=$('partsSummary');list.innerHTML='';
  try{
    const groups=cutPlanBuildGroups(cfg);cutPlanLastGroups=groups;
    const allParts=groups.flatMap(g=>g.parts),spaces=[...new Set(allParts.map(p=>p.spaceName).filter(Boolean))];
    const totalArea=allParts.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),sheetArea=groups.reduce((n,g)=>n+Math.max(1,(g.cfg.width-2*g.cfg.margin)*(g.cfg.height-2*g.cfg.margin)),0),totalEff=sheetArea?totalArea/sheetArea*100:0,totalCut=groups.reduce((n,g)=>n+g.stats.cutLength,0);
    const reusable=groups.reduce((n,g)=>n+g.stats.reusable.length,0),sheetSizes=[...new Set(groups.map(g=>`${nice(g.cfg.width)} × ${nice(g.cfg.height)}`))];
    const sheetText=sheetSizes.length===1?`chapa ${sheetSizes[0]} mm`:`${sheetSizes.length} tamanhos de chapa conforme o material`;
    summary.innerHTML=`<div class="cutPlanSummaryGrid"><span><b>${allParts.length}</b><small>peças</small></span><span><b>${groups.length}</b><small>chapas</small></span><span><b>${nice(totalEff)}%</b><small>aproveitamento</small></span><span><b>${nice(totalCut/1000)} m</b><small>corte estimado</small></span></div><div class="cutPlanSummaryText"><strong>${escapeHtml(cutPlanModeLabel(cfg))}</strong> · ${sheetText} · refilo ${nice(cfg.margin)} mm · corte ${nice(cfg.gap)} mm · ${reusable} sobra(s) útil(eis) · ${spaces.length} espaço(s)</div>`;

    const byKey=new Map();
    groups.forEach((g,gi)=>{if(!byKey.has(g.key))byKey.set(g.key,{name:g.displayName,sheets:[],parts:[]});const d=byKey.get(g.key);d.sheets.push({g,gi});d.parts.push(...g.parts);});
    for(const [key,data] of byKey.entries()){
      const box=document.createElement('div');box.className='partsGroup';
      const eff=data.sheets.reduce((n,x)=>n+x.g.stats.efficiency,0)/Math.max(1,data.sheets.length);
      const head=document.createElement('div');head.className='partsGroupHead';const firstCfg=data.sheets[0]?.g?.cfg||cfg;head.innerHTML=`<span>${escapeHtml(data.name)}</span><span>${data.sheets.length} chapa(s) · ${nice(firstCfg.width)}×${nice(firstCfg.height)} · ${nice(eff)}%</span>`;box.appendChild(head);
      for(const p of cutPlanGroupRows(data.parts)){
        const row=document.createElement('div');row.className='partRow';
        const left=document.createElement('div');const nm=document.createElement('div');nm.className='partRowName';nm.innerHTML=`<span class="cutPlanCode">${escapeHtml(p.cutCode||'?')}</span>${escapeHtml(p.name||'Peça')}`;
        const meta=document.createElement('div');meta.className='partRowMeta';const origins=[...p.spaceNames];meta.textContent=`${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm${p.materialGrain?` · veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} ${normalizePieceGrainRotation(p.materialGrainRotation)}°`:''}${p.edgeBandSummary?' · FITA: '+p.edgeBandSummary:''}${actualMachiningCount(p)?' · USINAGENS: '+actualMachiningCount(p):''}${origins.length?' · '+origins.join(', '):''}`;left.append(nm,meta);
        const qty=document.createElement('div');qty.className='partQty';qty.textContent=`×${p.qty}`;
        const right=document.createElement('div');right.className='cutPlanRowActions';
        if(p.materialGrain){
          const grainBtn=document.createElement('button');grainBtn.type='button';grainBtn.className='cutPlanGrainBtn';const grainAxis=cutPlanPieceGrainAxis(p,{placed:false});grainBtn.textContent=p.qty>1?`↻ Veio ${grainAxis.localSymbol} ×${p.qty}`:`↻ Veio ${grainAxis.localSymbol}`;grainBtn.title=p.qty>1?'Rotacionar 90° o veio de todas as peças iguais desta linha':'Rotacionar 90° somente o veio desta peça';
          grainBtn.onclick=e=>{e.preventDefault();e.stopPropagation();cutPlanToggleGrainObjects(p.sourceObjects)};
          right.appendChild(grainBtn);
        }
        right.appendChild(qty);row.append(left,right);box.appendChild(row);
      }
      const chips=document.createElement('div');chips.style.padding='8px 10px 10px';
      for(const x of data.sheets){const c=document.createElement('button');c.type='button';c.className='sheetChip';c.innerHTML=`<strong>Chapa ${x.g.sheetNo}</strong> · ${nice(x.g.stats.efficiency)}% · ${nice(x.g.stats.cutLength/1000)} m corte`;c.onclick=()=>openSheetPreviewAt(x.gi);chips.appendChild(c);}box.appendChild(chips);list.appendChild(box);
    }
    $('partsListInfo').textContent=cfg.cutMode==='open'?'Plano otimizado: cortes guilhotina, refilo, espessura de corte, nível de otimização, direção preferida e sobras úteis.':cfg.cutMode==='panel'?'Seccionadora de pinça: 2 etapas, uma virada manual de 90° por faixa e sequência de execução numerada.':'CNC / Router: encaixe livre por área com o exportador Aspire existente.';
  }catch(err){cutPlanLastGroups=[];summary.textContent=err.message||'Não foi possível calcular as chapas';$('partsListInfo').textContent='Lista geral de peças de todos os espaços do projeto.';}
}
function openPartsListDialog(){
  applySheetPrefsToUi();applyCutPlanExtraPrefs();
  if(!localStorage.getItem(CUT_PLAN_PREFS_KEY+'-mode')){$('sheetCutMode').value='open';localStorage.setItem(CUT_PLAN_PREFS_KEY+'-mode','1');}
  updateSheetCutModeUi();renderPartsList();$('partsListDialog').style.display='flex';
}

function prepareSheetPreviewGroups(){return cutPlanLastGroups.length?cutPlanLastGroups:cutPlanBuildGroups(cutPlanCfgFromUi());}
function refreshSheetPreviewSelect(){
  const sel=$('sheetPreviewSelect');sel.innerHTML='';
  sheetPreviewGroups.forEach((g,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${String(i+1).padStart(2,'0')} · ${g.displayName} · Chapa ${g.sheetNo}/${g.totalSheets} · ${nice(g.stats.efficiency)}%`;sel.appendChild(o)});
  sel.value=String(sheetPreviewIndex);$('sheetPreviewPrev').disabled=sheetPreviewIndex<=0;$('sheetPreviewNext').disabled=sheetPreviewIndex>=sheetPreviewGroups.length-1;
}
function openSheetPreview(){openSheetPreviewAt(0)}
function openSheetPreviewAt(index=0){
  try{
    sheetPreviewGroups=prepareSheetPreviewGroups();if(!sheetPreviewGroups.length)throw new Error('Não há chapas para visualizar.');
    sheetPreviewIndex=Math.max(0,Math.min(sheetPreviewGroups.length-1,Number(index)||0));sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;refreshSheetPreviewSelect();$('sheetPreviewDialog').classList.add('show');requestAnimationFrame(sheetPreviewDraw);
  }catch(err){toast(err.message||'Não foi possível montar o plano de corte');}
}
function closeSheetPreview(){$('sheetPreviewDialog').classList.remove('show');sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;sheetPreviewLastTransform=null}
function selectSheetPreviewIndex(i){i=Math.max(0,Math.min(sheetPreviewGroups.length-1,Number(i)||0));sheetPreviewIndex=i;sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw()}
function cutPlanCanvasSize(){
  const canvas=$('sheetPreviewCanvas'),wrap=canvas.parentElement,r=wrap.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),cssW=Math.max(300,Math.floor(r.width-20)),cssH=Math.max(280,Math.floor(r.height-20));
  if(canvas.width!==Math.floor(cssW*dpr)||canvas.height!==Math.floor(cssH*dpr)){canvas.width=Math.floor(cssW*dpr);canvas.height=Math.floor(cssH*dpr);canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';}
  return {canvas,cssW,cssH,dpr};
}
function cutPlanDrawWaste(ctx,g,cfg,sx,sy,scale){
  if(g.planMode==='cnc'||!$('sheetPreviewWaste')?.checked)return;
  for(const r of g.freeRects||[]){
    const x=cfg.margin+r.x,y=cfg.margin+r.y,rx=sx(x),ry=sy(y+r.h),rw=r.w*scale,rh=r.h*scale,keep=r.w>=cfg.keepLength&&r.h>=cfg.keepWidth;
    ctx.save();ctx.fillStyle=keep?'rgba(107,150,82,.15)':'rgba(80,86,89,.045)';ctx.strokeStyle=keep?'rgba(77,128,64,.68)':'rgba(119,124,126,.38)';ctx.lineWidth=1;ctx.setLineDash(keep?[5,3]:[3,4]);ctx.fillRect(rx,ry,rw,rh);ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);
    if(rw>48&&rh>32){ctx.strokeStyle=keep?'rgba(80,130,67,.35)':'rgba(120,124,126,.23)';ctx.beginPath();ctx.moveTo(rx+5,ry+5);ctx.lineTo(rx+rw-5,ry+rh-5);ctx.moveTo(rx+rw-5,ry+5);ctx.lineTo(rx+5,ry+rh-5);ctx.stroke();ctx.fillStyle=keep?'#4c7541':'#858b8e';ctx.font='600 8px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${nice(r.w)} × ${nice(r.h)}`,rx+rw/2,ry+rh/2);}
    ctx.restore();
  }
}
function cutPlanPieceGrainAxis(p,{placed=true}={}){
  const grainRot=normalizePieceGrainRotation(p?.materialGrainRotation);
  const alongFaceW=grainRot===90;
  // No desenho da chapa, uma peça girada 90° troca também o eixo visual do veio.
  // Assim a seta representa o veio REAL que o operador verá na peça já posicionada.
  const alongX=placed?(alongFaceW!==!!p?.rotated):alongFaceW;
  return {grainRot,alongFaceW,alongX,symbol:alongX?'↔':'↕',localSymbol:alongFaceW?'↔':'↕'};
}
function cutPlanDrawGrain(ctx,p,b,cfg,sx,sy,scale){
  if(!p.materialGrain)return;
  const axis=cutPlanPieceGrainAxis(p),rx=sx(b.x),ry=sy(b.y+b.h),rw=b.w*scale,rh=b.h*scale;
  if(rw<14||rh<14)return;
  const horizontal=axis.alongX;
  // Deixamos a seta fora do centro para não ficar escondida pelo código/letra da peça.
  const cx=horizontal?rx+rw/2:rx+Math.min(rw/2,Math.max(9,rw*.20));
  const cy=horizontal?ry+Math.min(rh/2,Math.max(9,rh*.20)):ry+rh/2;
  const available=horizontal?rw:rh;
  const len=Math.max(12,Math.min(available*.64,110));
  const x1=horizontal?cx-len/2:cx,y1=horizontal?cy:cy+len/2;
  const x2=horizontal?cx+len/2:cx,y2=horizontal?cy:cy-len/2;
  const head=Math.max(4,Math.min(8,len*.13));
  const drawArrow=(stroke,lineWidth)=>{
    ctx.strokeStyle=stroke;ctx.fillStyle=stroke;ctx.lineWidth=lineWidth;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    const headAt=(x,y,dir)=>{
      ctx.beginPath();
      if(horizontal){ctx.moveTo(x,y);ctx.lineTo(x-dir*head,y-head*.62);ctx.moveTo(x,y);ctx.lineTo(x-dir*head,y+head*.62);}
      else{ctx.moveTo(x,y);ctx.lineTo(x-head*.62,y+dir*head);ctx.moveTo(x,y);ctx.lineTo(x+head*.62,y+dir*head);}
      ctx.stroke();
    };
    headAt(x2,y2,1);headAt(x1,y1,-1);
  };
  ctx.save();
  // Halo claro + traço laranja forte: continua legível sobre peças claras,
  // seleção azul e linhas de usinagem.
  drawArrow('rgba(255,255,255,.96)',5.4);
  drawArrow('#b96700',2.35);
  if(rw>62&&rh>38){
    const fs=Math.max(7,Math.min(10,Math.min(rw,rh)*.16));
    ctx.font=`900 ${fs}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const tx=horizontal?cx:cx+Math.min(22,rw*.24),ty=horizontal?cy+Math.min(13,rh*.22):cy;
    ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.96)';ctx.strokeText('VEIO',tx,ty);ctx.fillStyle='#8a4b00';ctx.fillText('VEIO',tx,ty);
  }
  ctx.restore();
}
function cutPlanDrawMachining(ctx,g,sx,sy,scale){
  if(!$('sheetPreviewMachining')?.checked)return;
  // Furos e rasgos das faces principais usam exatamente a mesma projeção usada pelo DXF Aspire.
  for(const e of (g.previewEntities||[])){
    if(e.role!=='machining')continue;
    const face=previewEntityFace(e),isB=face==='B';
    ctx.save();
    if(e.kind==='circle'){
      ctx.strokeStyle=isB?'#7b43d1':'#d62d7b';ctx.fillStyle=isB?'rgba(123,67,209,.08)':'rgba(214,45,123,.10)';ctx.lineWidth=Math.max(1.4,Math.min(2.6,scale*.6));if(isB)ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.arc(sx(e.x),sy(e.y),Math.max(2.4,e.r*scale),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
      // Cruz central ajuda a conferir o centro do furo mesmo em zoom pequeno.
      const cr=Math.max(2.5,Math.min(6,e.r*scale*.55));ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx(e.x)-cr,sy(e.y));ctx.lineTo(sx(e.x)+cr,sy(e.y));ctx.moveTo(sx(e.x),sy(e.y)-cr);ctx.lineTo(sx(e.x),sy(e.y)+cr);ctx.stroke();
    }else if(e.kind==='rect'){
      const rx=sx(e.x),ry=sy(e.y+e.h),rw=e.w*scale,rh=e.h*scale;ctx.strokeStyle=isB?'#15799a':'#0099c7';ctx.fillStyle=isB?'rgba(21,121,154,.07)':'rgba(0,153,199,.12)';ctx.lineWidth=1.8;if(isB)ctx.setLineDash([5,3]);ctx.fillRect(rx,ry,rw,rh);ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);
    }
    ctx.restore();
  }
  // Furo cuja entrada é pela borda não pode ser representado como círculo de face.
  // Mostramos um triângulo laranja no ponto projetado para não esconder a operação.
  for(const p of g.parts||[])for(const mk of previewEdgeHoleMarkers(p)){
    const x=sx(mk.x),y=sy(mk.y),r=5;ctx.save();ctx.fillStyle='#e47a16';ctx.strokeStyle='#7c3a00';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y+r);ctx.lineTo(x-r,y+r);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  // Encaixes/formas também são usinagens do contorno.
  for(const e of (g.previewEntities||[])){
    if(e.layer!=='ENCAIXE_MONTANTE'||!e.points?.length)continue;ctx.save();ctx.strokeStyle='#bf8a00';ctx.fillStyle='rgba(218,168,16,.10)';ctx.lineWidth=1.6;ctx.beginPath();e.points.forEach((pt,i)=>{const x=sx(pt[0]),y=sy(pt[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
}
function cutPlanMachiningSummary(p){
  const out=[];
  for(const op of (p.machining||[])){
    if(op.type==='hole'){const qty=holeSeriesInstances(p.object,op).length,edge=entryAxisName(op.entryAxis)!==p.thicknessAxis,face=edge?'BORDA':(entryAxisSign(op.entryAxis)>0?'A':'B');out.push(`${qty} furo${qty===1?'':'s'} Ø${nice(op.diameter)} × ${nice(operationDepthMm(p.object,op))} mm · ${face}${op.hardwareName?' · '+op.hardwareName:''}`);}
    else{const face=entryAxisSign(op.entryAxis)>0?'A':'B',label=op.preset==='drawer-bottom-groove'?'Rasgo fundo gaveta':op.preset==='back-groove'?'Rasgo de fundo':'Rasgo';out.push(`${label} ${nice(op.length)} × ${nice(op.width)} × ${nice(operationDepthMm(p.object,op))} mm · ${face}`);}
  }
  if(p.customSlots?.length)out.push(`${p.customSlots.length} encaixe(s) de contorno`);
  return out;
}
function cutPlanPanelSequenceHtml(g,{compact=false}={}){
  const seq=g?.panelSequence;if(!seq)return '';
  const cfg=g.cfg||{};
  const direction=seq.firstAxis==='H'
    ? `faixas no comprimento (${nice(Math.max(0,cfg.width-2*cfg.margin))} mm)`
    : `faixas na largura (${nice(Math.max(0,cfg.height-2*cfg.margin))} mm)`;
  const strips=(seq.strips||[]).map(st=>{
    const pcs=(st.items||[]).map(it=>`${escapeHtml(String(it.code||'?'))} ${nice(it.length)}`).join(' · ');
    return `<div class="panelSawSeqStrip"><b>F${st.number} · ${nice(st.size)} mm</b><span>↻ 90° · ${pcs||'sem peças'}</span></div>`;
  }).join('');
  return `<div class="panelSawSeq ${compact?'compact':''}"><div class="panelSawSeqTitle">SEQUÊNCIA DA SECCIONADORA</div><div><b>1.</b> Formar ${seq.strips?.length||0} faixa(s) · ${direction}</div><div><b>2.</b> Girar cada faixa 90° uma vez e cortar as peças</div>${strips}</div>`;
}

function cutPlanRenderSide(){
  const g=sheetPreviewGroups[sheetPreviewIndex];if(!g)return;const cfg=g.cfg,st=g.stats,status=$('sheetPreviewStatus');
  const keep=st.reusable.slice(0,4).map(r=>`${nice(r.w)} × ${nice(r.h)}`).join(' · ');
  status.className='sheetPreviewStatus ok';
  const mach=sheetPreviewStats(g),machTotal=mach.holesA+mach.holesB+mach.edge+mach.groovesA+mach.groovesB+mach.slots;
  status.innerHTML=`<strong>${escapeHtml(g.displayName)}</strong><br>Chapa ${g.sheetNo}/${g.totalSheets} · ${g.parts.length} peça(s)<br>Aproveitamento <b>${nice(st.efficiency)}%</b> · corte estimado <b>${nice(st.cutLength/1000)} m</b><br>Usinagens: <b>${machTotal}</b> · furos A ${mach.holesA} · B ${mach.holesB}${mach.edge?` · borda ${mach.edge}`:''} · rasgos ${mach.groovesA+mach.groovesB}<br>Chapa ${nice(cfg.width)} × ${nice(cfg.height)} · refilo ${nice(cfg.margin)} · corte ${nice(cfg.gap)} mm${keep?`<br>Sobras úteis: ${escapeHtml(keep)}`:'<br>Sem sobra útil acima do mínimo configurado.'}${g.planMode==='panel'?cutPlanPanelSequenceHtml(g,{compact:true}):''}`;
  $('sheetPreviewModeText').textContent=g.planMode==='open'?'Otimizado · cortes guilhotina e sobras concentradas.':g.planMode==='panel'?`Seccionadora de pinça · 2 etapas · ${g.panelSequence?.turns||0} giro(s) manual(is).`:'CNC / Router · encaixe livre por área.';
  const p=sheetPreviewSelectedPart,card=$('sheetPreviewPartCard');
  if(!p||!g.parts.includes(p)){
    sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;card.innerHTML='<h4>Nenhuma peça selecionada</h4><div class="meta">Toque numa peça para ver código, medida, material e origem.</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary" disabled>Ampliar peça</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button></div>';
  }else{
    const same=g.parts.filter(x=>x.cutCode===p.cutCode).length;
    const ops=cutPlanMachiningSummary(p);
    card.innerHTML=`<h4><span class="cutPlanCode">${escapeHtml(p.cutCode||'?')}</span>${escapeHtml(p.name||'Peça')}</h4><div class="meta">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm · ${escapeHtml(p.materialCode||p.material||'MDF')}<br>${same>1?`${same} peça(s) iguais nesta chapa · `:''}${p.rotated?'girada 90° · ':''}${p.materialGrain?`veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} ${normalizePieceGrainRotation(p.materialGrainRotation)}° · `:''}${escapeHtml(p.spaceName||'')}</div><div class="sheetPreviewPartOps"><div class="sheetPreviewOp">Posição na chapa: X ${nice(p.x)} · Y ${nice(p.y)} mm</div>${p.edgeBandSummary?`<div class="sheetPreviewOp">Fitas: ${escapeHtml(p.edgeBandSummary)}</div>`:''}${ops.length?ops.map(x=>`<div class="sheetPreviewOp">${escapeHtml(x)}</div>`).join(''):'<div class="sheetPreviewOp">Sem usinagens nesta peça.</div>'}</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary">${sheetPreviewIsolated?'Voltar à chapa':'Ampliar peça'}</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button>${p.materialGrain?`<button id="sheetPreviewRotateGrain" type="button" class="cutPlanPreviewGrainBtn">↻ Veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} · Rotacionar 90°</button>`:''}</div>`;
  }
  $('sheetPreviewIsolate').onclick=()=>{if(sheetPreviewSelectedPart){sheetPreviewIsolated=!sheetPreviewIsolated;sheetPreviewDraw()}};
  $('sheetPreviewFit').onclick=()=>{sheetPreviewIsolated=false;sheetPreviewDraw()};
  const grainBtn=$('sheetPreviewRotateGrain');
  if(grainBtn&&sheetPreviewSelectedPart?.object)grainBtn.onclick=()=>cutPlanToggleGrainObjects([sheetPreviewSelectedPart.object],{keepPreview:true,previewObject:sheetPreviewSelectedPart.object});
  $('sheetPreviewSheetInfo').innerHTML=`<strong>${escapeHtml(g.displayName)}</strong> · chapa ${g.sheetNo}/${g.totalSheets}`;
  $('sheetPreviewFaceInfo').textContent=`${nice(st.efficiency)}% · ${nice(st.cutLength/1000)} m de corte`;
}
function sheetPreviewDraw(){
  const g=sheetPreviewGroups[sheetPreviewIndex],size=cutPlanCanvasSize(),canvas=size.canvas,cssW=size.cssW,cssH=size.cssH,dpr=size.dpr,ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
  if(!g){$('sheetPreviewEmpty').style.display='grid';return}$('sheetPreviewEmpty').style.display='none';const cfg=g.cfg;
  const view=sheetPreviewViewport(g,cfg),pad=34,scale=Math.min((cssW-pad*2)/view.w,(cssH-pad*2)/view.h),ox=(cssW-view.w*scale)/2-view.x*scale,oy=(cssH-view.h*scale)/2+(view.y+view.h)*scale;
  const sx=x=>ox+x*scale,sy=y=>oy-y*scale;sheetPreviewLastTransform={scale,ox,oy,sx,sy,cssW,cssH};
  const x0=sx(0),x1=sx(cfg.width),y0=sy(0),y1=sy(cfg.height);
  ctx.save();ctx.shadowColor='rgba(0,0,0,.26)';ctx.shadowBlur=14;ctx.fillStyle='#fff';ctx.fillRect(x0,y1,x1-x0,y0-y1);ctx.restore();ctx.strokeStyle='#41474b';ctx.lineWidth=1.5;ctx.strokeRect(x0,y1,x1-x0,y0-y1);
  ctx.save();ctx.fillStyle='rgba(140,140,132,.08)';ctx.fillRect(x0,y1,x1-x0,y0-y1);ctx.clearRect(sx(cfg.margin),sy(cfg.height-cfg.margin),(cfg.width-2*cfg.margin)*scale,(cfg.height-2*cfg.margin)*scale);ctx.setLineDash([5,4]);ctx.strokeStyle='#9ba0a2';ctx.lineWidth=1;ctx.strokeRect(sx(cfg.margin),sy(cfg.height-cfg.margin),(cfg.width-2*cfg.margin)*scale,(cfg.height-2*cfg.margin)*scale);ctx.restore();

  cutPlanDrawWaste(ctx,g,cfg,sx,sy,scale);

  for(const p of g.parts){
    const b=sheetPreviewPartBounds(p),rx=sx(b.x),ry=sy(b.y+b.h),rw=b.w*scale,rh=b.h*scale,sel=p===sheetPreviewSelectedPart,outline=sheetPreviewPlacedOutline(p);
    ctx.save();ctx.fillStyle=sel?'#e6f0ff':'#f7f7f5';ctx.strokeStyle=sel?'#2d7dfa':'#262a2d';ctx.lineWidth=sel?2.5:1.25;
    if(outline?.length){
      ctx.beginPath();outline.forEach((pt,i)=>{const px=sx(pt[0]),py=sy(pt[1]);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)});ctx.closePath();ctx.fill();ctx.stroke();
    }else{ctx.fillRect(rx,ry,rw,rh);ctx.strokeRect(rx,ry,rw,rh);}
    cutPlanDrawGrain(ctx,p,b,cfg,sx,sy,scale);
    if($('sheetPreviewLabels')?.checked){
      const codeFs=Math.max(10,Math.min(30,Math.min(rw*.26,rh*.34)));ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#25282a';ctx.font=`900 ${codeFs}px system-ui,sans-serif`;if(rw>24&&rh>20)ctx.fillText(String(p.cutCode||'?'),rx+rw/2,ry+rh/2-(rh>58?5:0));
      if(rw>82&&rh>52){ctx.font='700 8px system-ui,sans-serif';ctx.fillStyle='#5e6569';ctx.fillText(`${nice(p.faceW)} × ${nice(p.faceH)}`,rx+rw/2,ry+rh/2+codeFs*.65);}
      if(rw>125&&rh>74){ctx.font='600 7px system-ui,sans-serif';ctx.fillStyle='#7a8084';ctx.fillText(String(p.name||'Peça').slice(0,28),rx+rw/2,ry+rh-10);}
    }
    ctx.restore();
  }

  cutPlanDrawMachining(ctx,g,sx,sy,scale);

  if($('sheetPreviewEdgeHoles')?.checked)for(const cut of g.panelCuts||[]){
    const col=cut.orientation==='H'?'#168758':'#c9445b';ctx.save();ctx.strokeStyle=col;ctx.globalAlpha=.78;ctx.lineWidth=Math.max(1.2,Math.min(4,cfg.gap*scale*.55));ctx.beginPath();ctx.moveTo(sx(cut.x1),sy(cut.y1));ctx.lineTo(sx(cut.x2),sy(cut.y2));ctx.stroke();ctx.globalAlpha=1;
    if((cut.length||0)*scale>55){const mx=(sx(cut.x1)+sx(cut.x2))/2,my=(sy(cut.y1)+sy(cut.y2))/2;ctx.fillStyle=col;ctx.beginPath();ctx.arc(mx,my,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='800 7px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(cut.order||''),mx,my);}ctx.restore();
  }

  ctx.save();ctx.fillStyle='#32373a';ctx.font='800 9px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(nice(cfg.width)+' mm',(x0+x1)/2,Math.max(11,y1-8));ctx.translate(Math.max(11,x0-11),(y0+y1)/2);ctx.rotate(-Math.PI/2);ctx.fillText(nice(cfg.height)+' mm',0,0);ctx.restore();
  cutPlanRenderSide();
}

// ---------- 1.100.95 · impressão técnica do plano de corte em A4 ----------
// A impressão é propositalmente independente do indicador de veio da tela.
// O sentido continua sendo respeitado no cálculo/encaixe, mas não é desenhado
// nem escrito no relatório impresso.
function cutPlanPrintSvg(group){
  const g=group,cfg=g.cfg,toY=y=>cfg.height-y,parts=[],mach=[],cuts=[],waste=[];
  if($('sheetPreviewWaste')?.checked&&g.planMode!=='cnc')for(const r of (g.freeRects||[])){
    const x=cfg.margin+r.x,y=toY(cfg.margin+r.y+r.h),keep=r.w>=cfg.keepLength&&r.h>=cfg.keepWidth;
    waste.push(`<rect x="${x}" y="${y}" width="${r.w}" height="${r.h}" fill="${keep?'#eef3ea':'#f5f5f3'}" stroke="${keep?'#75866e':'#c3c5c4'}" stroke-width="5" stroke-dasharray="18 12"/>`);
  }
  for(const p of (g.parts||[])){
    const outline=sheetPreviewPlacedOutline(p),b=sheetPreviewPartBounds(p);
    if(outline?.length){
      const pts=outline.map(q=>`${q[0]},${toY(q[1])}`).join(' ');
      parts.push(`<polygon points="${pts}" fill="#fafaf8" stroke="#252525" stroke-width="6"/>`);
    }else parts.push(`<rect x="${b.x}" y="${toY(b.y+b.h)}" width="${b.w}" height="${b.h}" fill="#fafaf8" stroke="#252525" stroke-width="6"/>`);

    // Sem desenho de veio na impressão. Mantemos somente identificação útil.
    const cx=b.x+b.w/2,cy=toY(b.y+b.h/2);
    const codeFs=Math.max(44,Math.min(118,Math.min(b.w,b.h)*.25));
    const nameFs=Math.max(24,Math.min(48,Math.min(b.w,b.h)*.105));
    const dimFs=Math.max(22,Math.min(42,Math.min(b.w,b.h)*.09));
    if($('sheetPreviewLabels')?.checked){
      parts.push(`<text x="${cx}" y="${cy-codeFs*.22}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${codeFs}" font-weight="900" fill="#16191b">${escapeHtml(String(p.cutCode||'?'))}</text>`);
      if(b.w>300&&b.h>180){
        const maxName=String(p.name||'Peça').length>22?String(p.name||'Peça').slice(0,21)+'…':String(p.name||'Peça');
        parts.push(`<text x="${cx}" y="${cy+codeFs*.34}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${nameFs}" font-weight="700" fill="#303437">${escapeHtml(maxName)}</text>`);
      }
      if(b.w>390&&b.h>235)parts.push(`<text x="${cx}" y="${cy+codeFs*.77}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${dimFs}" font-weight="700" fill="#55595b">${escapeHtml(`${nice(p.faceW)} × ${nice(p.faceH)}`)}</text>`);
    }
  }
  if($('sheetPreviewMachining')?.checked){
    for(const e of (g.previewEntities||[])){
      if(e.role!=='machining'&&e.layer!=='ENCAIXE_MONTANTE')continue;
      if(e.kind==='circle')mach.push(`<circle cx="${e.x}" cy="${toY(e.y)}" r="${Math.max(8,e.r)}" fill="none" stroke="#9a2b58" stroke-width="9"/>`);
      else if(e.kind==='rect')mach.push(`<rect x="${e.x}" y="${toY(e.y+e.h)}" width="${e.w}" height="${e.h}" fill="none" stroke="#26728a" stroke-width="9"/>`);
      else if(e.points?.length)mach.push(`<polygon points="${e.points.map(pt=>`${pt[0]},${toY(pt[1])}`).join(' ')}" fill="none" stroke="#8b6f20" stroke-width="9"/>`);
    }
    for(const p of (g.parts||[]))for(const mk of previewEdgeHoleMarkers(p))mach.push(`<polygon points="${mk.x},${toY(mk.y)-18} ${mk.x+17},${toY(mk.y)+15} ${mk.x-17},${toY(mk.y)+15}" fill="#a75d27" stroke="#5e3218" stroke-width="5"/>`);
  }
  if($('sheetPreviewEdgeHoles')?.checked)for(const cut of (g.panelCuts||[])){const mx=(cut.x1+cut.x2)/2,my=toY((cut.y1+cut.y2)/2);cuts.push(`<line x1="${cut.x1}" y1="${toY(cut.y1)}" x2="${cut.x2}" y2="${toY(cut.y2)}" stroke="#6f7476" stroke-width="10"/><circle cx="${mx}" cy="${my}" r="28" fill="#303437"/><text x="${mx}" y="${my+3}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="28" font-weight="900" fill="#fff">${cut.order||''}</text>`);}
  return `<svg class="planSvg" viewBox="0 0 ${cfg.width} ${cfg.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano da chapa"><rect x="0" y="0" width="${cfg.width}" height="${cfg.height}" fill="#fff" stroke="#202224" stroke-width="9"/><rect x="${cfg.margin}" y="${cfg.margin}" width="${Math.max(0,cfg.width-2*cfg.margin)}" height="${Math.max(0,cfg.height-2*cfg.margin)}" fill="none" stroke="#a6aaac" stroke-width="5" stroke-dasharray="22 15"/>${waste.join('')}${parts.join('')}${mach.join('')}${cuts.join('')}</svg>`;
}
function cutPlanPrintPartRows(group){
  const by=new Map();
  for(const p of (group.parts||[])){
    const key=[p.cutCode||'',p.name||'',nice(p.faceW),nice(p.faceH),nice(p.thickness),p.materialCode||p.material||''].join('|');
    if(!by.has(key))by.set(key,{...p,count:0});
    by.get(key).count++;
  }
  return [...by.values()].map(p=>`<tr><td class="codeCell">${escapeHtml(String(p.cutCode||'?'))}</td><td><b>${escapeHtml(p.name||'Peça')}</b><small>${escapeHtml(p.materialCode||p.material||'MDF')}</small></td><td class="qtyCell">${p.count}</td><td class="dimCell">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)}</td></tr>`).join('');
}
function cutPlanPrintPanelSequence(group){
  const seq=group?.panelSequence;if(!seq)return '';
  const cfg=group.cfg||{};
  const long=seq.firstAxis==='H'
    ? Math.max(0,cfg.width-2*cfg.margin)
    : Math.max(0,cfg.height-2*cfg.margin);
  const label=seq.firstAxis==='H'?'comprimento':'largura';
  const strips=(seq.strips||[]).map(st=>{
    const pcs=(st.items||[]).map(it=>`<span><b>${escapeHtml(String(it.code||'?'))}</b> ${nice(it.length)}</span>`).join('');
    return `<div class="seqStrip"><div><b>F${st.number}</b><small>${nice(st.size)} mm</small></div><div class="seqTurn">↻ GIRAR 90°</div><div class="seqPieces">${pcs||'<span>—</span>'}</div></div>`;
  }).join('');
  return `<div class="sequencePanel"><div class="panelTitle">SEQUÊNCIA · SECCIONADORA</div><div class="seqIntro"><b>1. FORMAR FAIXAS</b><span>${seq.strips?.length||0} faixa(s) no ${label} · curso ${nice(long)} mm</span><b>2. GIRAR E CORTAR</b><span>Cada faixa gira somente uma vez.</span></div><div class="seqStrips">${strips}</div></div>`;
}

function cutPlanPrintDocument(groups){
  const project=escapeHtml(currentProjectRecord?.name||'DesignLabMoveis'),pages=groups.map((g,i)=>{
    const st=g.stats,mach=sheetPreviewStats(g),machTotal=mach.holesA+mach.holesB+mach.edge+mach.groovesA+mach.groovesB+mach.slots;
    const unique=new Set((g.parts||[]).map(p=>p.cutCode||p.name)).size;
    return `<section class="printCutPage">
      <header class="reportHead"><div><div class="brand">DESIGNLABMÓVEIS</div><h1>${project}</h1><h2>${escapeHtml(g.displayName)}</h2></div><div class="sheetTag"><span>CHAPA</span><b>${g.sheetNo}/${g.totalSheets}</b><small>Página ${i+1} de ${groups.length}</small></div></header>
      <div class="summaryGrid"><div><span>Dimensão da chapa</span><b>${nice(g.cfg.width)} × ${nice(g.cfg.height)} mm</b></div><div><span>Aproveitamento</span><b>${nice(st.efficiency)}%</b></div><div><span>Peças</span><b>${g.parts.length}</b></div><div><span>Tipos</span><b>${unique}</b></div><div><span>Corte estimado</span><b>${nice(st.cutLength/1000)} m</b></div><div><span>Usinagens</span><b>${machTotal}</b></div></div>
      <div class="reportBody"><div class="drawingPanel"><div class="panelTitle">PLANO DA CHAPA</div><div class="drawing">${cutPlanPrintSvg(g)}</div></div><aside class="rightPanel">${g.planMode==='panel'?cutPlanPrintPanelSequence(g):''}<div class="partsPanel"><div class="panelTitle">PEÇAS DESTA CHAPA</div><table><thead><tr><th>Cód.</th><th>Peça / material</th><th>Qtd.</th><th>Medidas (mm)</th></tr></thead><tbody>${cutPlanPrintPartRows(g)}</tbody></table></div></aside></div>
      <footer><span>Refilo ${nice(g.cfg.margin)} mm · espessura de corte ${nice(g.cfg.gap)} mm</span><span>DesignLabMoveis 1.100.95</span></footer>
    </section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Plano de corte · ${project}</title><style>
    @page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#17191a;font-family:Arial,Helvetica,sans-serif}.printCutPage{height:198mm;display:flex;flex-direction:column;gap:2.2mm;break-after:page;page-break-after:always;overflow:hidden}.printCutPage:last-child{break-after:auto;page-break-after:auto}.reportHead{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:.55mm solid #222;padding:0 0 2mm}.brand{font-size:2.35mm;font-weight:900;letter-spacing:.16em;color:#5f6669}h1{font-size:5mm;margin:.6mm 0 0;line-height:1.05}h2{font-size:3mm;margin:1mm 0 0;color:#4d5356}.sheetTag{min-width:31mm;border:.35mm solid #27292a;padding:1.4mm 2mm;text-align:center}.sheetTag span{display:block;font-size:2mm;font-weight:900;letter-spacing:.14em;color:#666}.sheetTag b{display:block;font-size:6mm;line-height:1.05}.sheetTag small{font-size:2mm;color:#666}.summaryGrid{display:grid;grid-template-columns:1.45fr repeat(5,1fr);gap:1.2mm}.summaryGrid>div{border:.25mm solid #b9bdbe;padding:1.4mm 1.7mm;background:#f5f5f3;min-width:0}.summaryGrid span{display:block;font-size:1.8mm;text-transform:uppercase;font-weight:800;color:#6a7073;white-space:nowrap}.summaryGrid b{display:block;margin-top:.45mm;font-size:2.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reportBody{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 82mm;gap:2mm}.rightPanel{min-height:0;display:flex;flex-direction:column;gap:1.5mm}.drawingPanel,.partsPanel,.sequencePanel{min-height:0;border:.25mm solid #aeb2b3;display:flex;flex-direction:column}.partsPanel{flex:1}.panelTitle{height:6mm;display:flex;align-items:center;padding:0 2mm;border-bottom:.25mm solid #aeb2b3;background:#eeeeeb;font-size:2.15mm;font-weight:900;letter-spacing:.05em}.drawing{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:2mm}.planSvg{width:100%;height:100%;display:block}.partsPanel{overflow:hidden}.partsPanel table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2mm}.partsPanel thead{display:table-header-group}.partsPanel th{padding:1.1mm .9mm;text-align:left;background:#f6f6f4;border-bottom:.25mm solid #bfc2c3;font-size:1.7mm;text-transform:uppercase;color:#555}.partsPanel td{padding:1.15mm .9mm;border-bottom:.2mm solid #dedfdf;vertical-align:middle;line-height:1.15;overflow:hidden}.partsPanel th:nth-child(1),.partsPanel td:nth-child(1){width:10mm}.partsPanel th:nth-child(3),.partsPanel td:nth-child(3){width:10mm;text-align:center}.partsPanel th:nth-child(4),.partsPanel td:nth-child(4){width:28mm;text-align:right}.partsPanel small{display:block;margin-top:.35mm;color:#747a7d;font-size:1.65mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.codeCell{font-size:2.5mm;font-weight:900;text-align:center}.qtyCell{font-weight:900}.dimCell{font-weight:800;white-space:nowrap}.partsPanel tbody tr:nth-child(even){background:#fafaf9}.sequencePanel{flex:0 0 auto;max-height:64mm;overflow:hidden}.seqIntro{padding:1.2mm 1.5mm;font-size:1.75mm;display:grid;grid-template-columns:auto 1fr;gap:.5mm 1.2mm;border-bottom:.2mm solid #ddd}.seqIntro b{font-size:1.7mm}.seqIntro span{color:#555}.seqStrips{padding:.7mm 1mm}.seqStrip{display:grid;grid-template-columns:17mm 20mm 1fr;align-items:center;gap:.8mm;padding:.75mm .5mm;border-bottom:.2mm solid #e0e0df;font-size:1.7mm}.seqStrip>div:first-child{display:flex;gap:1mm;align-items:center}.seqStrip small{color:#666}.seqTurn{font-weight:900;font-size:1.55mm}.seqPieces{display:flex;flex-wrap:wrap;gap:.7mm 1.2mm}.seqPieces span{white-space:nowrap}.seqPieces b{font-size:1.8mm}footer{display:flex;justify-content:space-between;border-top:.25mm solid #c4c6c7;padding-top:1.2mm;font-size:2mm;color:#5b6164}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>${pages}</body></html>`;
}
function printCutPlan(){
  try{
    const groups=prepareSheetPreviewGroups();if(!groups.length)throw new Error('Não há chapas para imprimir.');
    const html=cutPlanPrintDocument(groups),w=window.open('','_blank');
    if(!w){downloadText(`${safeFileName(currentProjectRecord?.name||'projeto')}-plano-de-corte.html`,html,'text/html;charset=utf-8');toast('O navegador bloqueou a impressão · salvei o plano de corte em HTML');return;}
    w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>{try{w.print()}catch(_){}},400);
  }catch(err){toast(err.message||'Não foi possível imprimir o plano de corte');}
}

function exportPanelSawSequenceCsv(){
  try{
    const cfg=cutPlanCfgFromUi();
    if(cfg.cutMode!=='panel')throw new Error('Selecione a estratégia Seccionadora para gerar a sequência.');
    const groups=prepareSheetPreviewGroups().filter(g=>g.planMode==='panel');
    if(!groups.length)throw new Error('Não há chapas de seccionadora para exportar.');
    const csv=buildPanelSawCutsCsv(groups,cfg);
    const name=`${safeFileName(currentProjectRecord?.name||'projeto')}-sequencia-seccionadora.csv`;
    downloadText(name,'\ufeff'+csv,'text/csv;charset=utf-8');
    toast(`Sequência da seccionadora gerada · ${groups.length} chapa(s). CSV de integração/conferência.`);
  }catch(err){toast(err.message||'Não foi possível gerar a sequência da seccionadora');}
}


async function exportPanelSawMingliZaw(){
  let target=null;
  try{
    const cfg=cutPlanCfgFromUi();
    if(cfg.cutMode!=='panel')throw new Error('Selecione a estratégia Seccionadora para gerar o Mingli ZAW.');
    const groups=prepareSheetPreviewGroups().filter(g=>g.planMode==='panel'||g.cutMode==='panel');
    if(!groups.length)throw new Error('Não há chapas de seccionadora para exportar.');
    const files=buildMingliZawFiles(groups,cfg);
    const filename=`${safeFileName(currentProjectRecord?.name||'projeto')}-MINGLI-ZAW-1-POR-CHAPA-TESTE.zip`;
    target=await pickExportTarget(filename,'designlab-export-mingli-zaw','application/zip');
    const result=await writeExportTarget(target,zipStore(files),filename);
    const zawCount=files.filter(f=>/\.zaw$/i.test(f.name)).length;
    toast(`Mingli ZAW salvo em ${result.locationLabel} · ${zawCount} arquivo(s) .zaw, um por chapa. Primeiro confira no software antes de mandar cortar.`);
  }catch(err){
    if(isExportPickerCancel(err)){toast('Exportação ZAW cancelada');return;}
    toast(err.message||'Não foi possível gerar o pacote Mingli ZAW');
  }
}

$('closePartsList').onclick=()=>{$('partsListDialog').style.display='none';};
$('partsListDialog').addEventListener('pointerdown',e=>{if(e.target===$('partsListDialog'))$('partsListDialog').style.display='none';});
['sheetWidth','sheetHeight','sheetMargin','sheetGap','sheetKeepLength','sheetKeepWidth'].forEach(id=>$(id).addEventListener('input',renderPartsList));
$('sheetGrain').addEventListener('change',renderPartsList);
$('sheetGrainDirection').addEventListener('change',renderPartsList);
$('sheetCutMode').addEventListener('change',()=>{updateSheetCutModeUi();renderPartsList();});
$('sheetOptimization').addEventListener('change',renderPartsList);
$('sheetDirection').addEventListener('change',renderPartsList);
if($('sheetPanelFirst'))$('sheetPanelFirst').addEventListener('change',renderPartsList);

$('previewAspireFromPartsBtn').onclick=openSheetPreview;
if($('exportPanelSawSequenceBtn'))$('exportPanelSawSequenceBtn').onclick=exportPanelSawSequenceCsv;
if($('exportPanelSawZawBtn'))$('exportPanelSawZawBtn').onclick=exportPanelSawMingliZaw;
if($('sheetPreviewPanelCsv'))$('sheetPreviewPanelCsv').onclick=exportPanelSawSequenceCsv;
if($('sheetPreviewPanelZaw'))$('sheetPreviewPanelZaw').onclick=exportPanelSawMingliZaw;
$('printCutPlanFromPartsBtn').onclick=printCutPlan;
$('sheetPreviewClose').onclick=closeSheetPreview;
$('sheetPreviewPrint').onclick=printCutPlan;
$('sheetPreviewExport').onclick=()=>{setSheetPrefs(sheetPrefsFromUi());exportProjectAspireZip();};
$('sheetPreviewPrev').onclick=()=>selectSheetPreviewIndex(sheetPreviewIndex-1);
$('sheetPreviewNext').onclick=()=>selectSheetPreviewIndex(sheetPreviewIndex+1);
$('sheetPreviewSelect').addEventListener('change',e=>selectSheetPreviewIndex(e.target.value));
document.querySelectorAll('[data-sheet-face]').forEach(b=>b.addEventListener('click',()=>{sheetPreviewFace=b.dataset.sheetFace||'ALL';document.querySelectorAll('[data-sheet-face]').forEach(x=>x.classList.toggle('active',x===b));sheetPreviewDraw()}));
$('sheetPreviewLabels').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewMachining').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewEdgeHoles').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewWaste').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewDialog').addEventListener('pointerdown',e=>{if(e.target===$('sheetPreviewDialog'))closeSheetPreview()});
$('sheetPreviewCanvas').addEventListener('pointermove',e=>{const p=sheetPreviewPointerToWorld(e);$('sheetPreviewPosition').textContent=p?`X ${nice(p.x)} · Y ${nice(p.y)} mm`:'X — · Y — mm'});
$('sheetPreviewCanvas').addEventListener('pointerleave',()=>{$('sheetPreviewPosition').textContent='X — · Y — mm'});
$('sheetPreviewCanvas').addEventListener('pointerup',e=>{const w=sheetPreviewPointerToWorld(e),g=sheetPreviewGroups[sheetPreviewIndex];if(!w||!g)return;const hits=g.parts.filter(p=>pointInPreviewPart(p,w.x,w.y));sheetPreviewSelectedPart=hits.length?hits[hits.length-1]:null;sheetPreviewIsolated=false;sheetPreviewDraw()});
$('sheetPreviewCanvas').addEventListener('dblclick',e=>{const w=sheetPreviewPointerToWorld(e),g=sheetPreviewGroups[sheetPreviewIndex];if(!w||!g)return;const hits=g.parts.filter(p=>pointInPreviewPart(p,w.x,w.y));if(hits.length){sheetPreviewSelectedPart=hits[hits.length-1];sheetPreviewIsolated=true;sheetPreviewDraw()}});

$('exportAspireFromPartsBtn').onclick=()=>{setSheetPrefs(sheetPrefsFromUi());exportProjectAspireZip();};
$('deleteSpaceBtn').onclick=()=>deleteSelectedSpaceRoot();
$('libraryLocalTab').onclick=()=>setLibraryScope('local');
$('libraryGlobalTab').onclick=()=>setLibraryScope('global');
$('libraryBackBtn').onclick=()=>{activeLibraryFolderId=null;renderLibrary();};
$('newLibraryFolderBtn').onclick=newLibraryFolder;
$('renameLibraryFolderBtn').onclick=renameActiveLibraryFolder;
$('deleteLibraryFolderBtn').onclick=deleteActiveLibraryFolder;
$('saveFurnitureLibraryBtn').onclick=saveCurrentFurnitureToLibrary;
$('importLibraryBtn').onclick=()=>{
  const ok=libraryScope==='global'?(adminAllowed()&&!!globalLibraryFolderById(activeLibraryFolderId)):!!libraryFolderById(activeLibraryFolderId);
  if(!ok){toast(libraryScope==='global'?'Abra uma pasta global como administrador':'Abra uma pasta para importar');return;}
  $('libraryImportFile').click();
};
$('libraryImportFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{await importLibraryFile(f);}catch(err){toast('Modelo inválido: '+(err.message||err));}
  e.target.value='';
});

$('visualModeMoreBtn').onclick=()=>setVisualMode(!visualMode,{frame:true});
$('xray3DBtn').onclick=()=>{toggleDockXray();$('morePanel').style.display='none';};
$('cancelPanel').onclick=()=>{$('newPanelDialog').style.display='none';};
$('createPanel').onclick=()=>{
  const w=clampSize(m($('newW').value)),d=clampSize(m($('newD').value)),h=clampSize(m($('newT').value));
  if(![w,d,h].every(Number.isFinite)){toast('Confira as medidas');return;}
  createBox({width:w,depth:d,height:h,name:$('newName').value.trim()||'Peça MDF',kind:'panel',materialType:'MDF',baseColor:COLORS.panel});
  $('newPanelDialog').style.display='none'; toast('Peça MDF criada');
};
document.querySelectorAll('[data-thickness]').forEach(b=>b.onclick=()=>{$('newT').value=b.dataset.thickness;});
$('applyExact').onclick=applyExactPanel;
$('applyPieceRelative').onclick=applyPieceRelativeConfig;
$('resetPieceRelative').onclick=resetPieceRelativeInputs;
$('duplicateBtn').onclick=requestDuplicateSelected;
$('confirmDuplicateBtn').onclick=confirmDuplicateSelected;
$('cancelDuplicateBtn').onclick=cancelDuplicateConfirmation;
$('deletePieceInspectorBtn').onclick=deleteSelectedFromInspector;
$('doorHingeLeftInspectorBtn').onclick=()=>setSelectedDoorHingeSide('left');
$('doorHingeRightInspectorBtn').onclick=()=>setSelectedDoorHingeSide('right');
$('partNameInput').addEventListener('change',()=>{if(selected){selected.userData.name=$('partNameInput').value.trim()||'Peça';updateInspector();commitHistory();}});
$('pieceDoNotProduce').addEventListener('change',e=>setSelectedPieceDoNotProduce(e.target.checked));
$('rotatePieceGrainBtn').onclick=rotateSelectedPieceGrain;

function installMinusButtons(){
  document.querySelectorAll('input[data-minus-button="1"]').forEach(input=>{
    if(input.dataset.minusInstalled==='1')return;
    input.dataset.minusInstalled='1';

    const parent=input.parentNode;
    const wrap=document.createElement('div');
    wrap.className='signedMinusWrap';
    parent.insertBefore(wrap,input);

    const minus=document.createElement('button');
    minus.type='button';
    minus.className='signedMinusBtn';
    minus.textContent='−';
    minus.setAttribute('aria-label','Usar valor negativo');
    minus.title='Valor negativo';

    const plus=document.createElement('button');
    plus.type='button';
    plus.className='signedPlusBtn';
    plus.textContent='+';
    plus.setAttribute('aria-label','Usar valor positivo');
    plus.title='Valor positivo';

    wrap.appendChild(minus);
    wrap.appendChild(input);
    wrap.appendChild(plus);

    const formatSignedValue=(value)=>{
      const step=Number(input.step);
      if(Number.isFinite(step)&&step>0&&step<1){
        const decimals=Math.min(6,Math.max(0,String(step).split('.')[1]?.length||0));
        input.value=String(Number(value.toFixed(decimals)));
      }else{
        input.value=String(value);
      }
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      input.focus({preventScroll:true});
    };

    minus.addEventListener('click',()=>{
      let n=Number(String(input.value??'0').trim().replace(',','.'));
      if(!Number.isFinite(n))n=0;
      formatSignedValue(-Math.abs(n));
    });

    plus.addEventListener('click',()=>{
      let n=Number(String(input.value??'0').trim().replace(',','.'));
      if(!Number.isFinite(n))n=0;
      formatSignedValue(Math.abs(n));
    });
  });
}
installMinusButtons();


// ============================================================================
// v98 · FECHAR MENUS / PAINÉIS AO TOCAR FORA
// ----------------------------------------------------------------------------
// Regra geral:
// - menus flutuantes fecham ao tocar fora, sem bloquear o toque no CAD;
// - o próprio botão que abriu o menu continua podendo fechá-lo normalmente;
// - diálogos de tela cheia fecham ao tocar no fundo escuro, usando o mesmo
//   botão Cancelar/Fechar para preservar qualquer rotina de limpeza existente.
// ============================================================================
function elementIsVisible(el){
  if(!el)return false;
  const cs=getComputedStyle(el);
  return cs.display!=='none' && cs.visibility!=='hidden';
}
function hideFloatingPanel(id){
  const el=$(id);
  if(el&&elementIsVisible(el))el.style.display='none';
}
function closeInspectorOutside(){
  const el=$('inspector');
  if(!el||!elementIsVisible(el))return;
  cancelDuplicateConfirmation?.();
  el.classList.add('compact');
  el.style.display='none';
}
function closeSpaceActionsOutside(){
  const el=$('spaceActions');
  if(el&&elementIsVisible(el))el.style.display='none';
}
function clickBackdropCancel(dialogId,buttonId){
  const dlg=$(dialogId),btn=$(buttonId);
  if(!dlg||!btn)return;
  dlg.addEventListener('pointerdown',e=>{
    if(e.target!==dlg)return;
    e.preventDefault();
    btn.click();
  });
}
function installOutsideMenuClose(){
  // Menus / painéis leves: captura primeiro, fecha e deixa o toque seguir
  // para o CAD normalmente.
  document.addEventListener('pointerdown',e=>{
    const target=e.target;

    // MAIS FERRAMENTAS
    const more=$('morePanel');
    const moreTrigger=target.closest?.('[data-dock-tool="more"]');
    if(more&&more.style.display==='block'&&!more.contains(target)&&!moreTrigger){
      more.style.display='none';
    }

    // MEDIDAS / POSIÇÃO (inspector)
    const inspector=$('inspector');
    const inspectorTrigger=target.closest?.('#showInspectorBtn,[data-dock-tool="inspector"]');
    if(inspector&&elementIsVisible(inspector)&&!inspector.contains(target)&&!inspectorTrigger){
      closeInspectorOutside();
    }

    // MENU DO ESPAÇO/DIVISÃO
    const spaceActions=$('spaceActions');
    // Ferramentas que trabalham diretamente com o espaço não contam como
    // "fora" durante o próprio toque que as aciona.
    const spaceTrigger=target.closest?.(
      '#spaceActions,[data-dock-tool="cutSpace"],[data-dock-tool="createPieces"],'+
      '[data-dock-tool="drawers"],[data-dock-tool="curvedStructure"],'+
      '[data-dock-tool="library"],[data-dock-tool="editSpace"]'
    );
    if(spaceActions&&elementIsVisible(spaceActions)&&!spaceActions.contains(target)&&!spaceTrigger){
      closeSpaceActionsOutside();
    }
  },true);

  // Diálogos que ainda não tinham fechamento pelo fundo escuro.
  clickBackdropCancel('newPanelDialog','cancelPanel');
  clickBackdropCancel('newSpaceDialog','cancelSpace');
  clickBackdropCancel('cutSpaceDialog','cancelCut');
  clickBackdropCancel('libraryDialog','closeLibrary');
  clickBackdropCancel('recoveryDialog','recoveryCancel');
  clickBackdropCancel('productionDialog','closeProductionDialog');
  clickBackdropCancel('labelsDialog','closeLabelsDialog');
  clickBackdropCancel('adminDialog','closeAdminDialog');

  // ESC também segue o comportamento padrão dos menus leves.
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;

    if($('projectCardMenu')?.classList.contains('show')){
      closeProjectCardMenu(); return;
    }
    if($('projectMenuPanel')?.classList.contains('show')){
      $('projectMenuPanel').classList.remove('show'); return;
    }
    if($('toolDock')?.classList.contains('open')){
      setToolDockOpen(false); return;
    }
    if($('morePanel')?.style.display==='block'){
      $('morePanel').style.display='none'; return;
    }
    if(elementIsVisible($('inspector'))){
      closeInspectorOutside(); return;
    }
    if(elementIsVisible($('spaceActions'))){
      closeSpaceActionsOutside(); return;
    }
  });
}


$('closeInspector').onclick=()=>{cancelDuplicateConfirmation();$('inspector').classList.add('compact');$('inspector').style.display='none';};

$('showInspectorBtn').onclick=()=>{if(!selected){toast('Selecione uma peça');return;}openPieceInspector(selected);};
$('openFurnitureSpaceBtn').onclick=()=>{openSpaceFromObject(selected);};
$('openLinkedSpaceBtn').onclick=()=>{openSpaceFromObject(selected);};
$('addHoleBtn').onclick=()=>openMachiningDialog('hole');
$('addGrooveBtn').onclick=()=>openMachiningDialog('groove');
$('addHardwareBtn').onclick=()=>openMachiningDialog('hardware');
$('addShapeBtn').onclick=()=>openShapeDialog();
$('manageMachiningBtn').onclick=()=>openMachiningDialog((selected?.userData?.machining||[])[0]?.type||'hole');
$('materialsToolBtn').onclick=openProductionDialog;
document.querySelectorAll('[data-machining-type]').forEach(b=>b.onclick=()=>{machiningEditId=null;if(b.dataset.machiningType==='shape'){openShapeDialog();return;}setMachiningType(b.dataset.machiningType,true);});
$('machiningFace').addEventListener('change',()=>{setMachiningSurfaceCoordinate();updateMachiningUI();});
$('machiningLengthAxis').addEventListener('change',()=>{if(grooveLengthIsFull()){const a=$('machiningLengthAxis').value;localCoordField(a).value=0;}updateMachiningUI();});
['machiningX','machiningY','machiningZ','machiningDiameter','machiningDepthHole','machiningLength','machiningWidth','machiningDepthGroove','machiningSeriesCount','machiningSeriesStep','machiningRearOffset'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='machiningLength')syncGrooveLengthButton();updateMachiningUI();}));
$('machiningLengthFull').onclick=setGrooveLengthFull;
document.querySelectorAll('[data-signed-axis]').forEach(btn=>{btn.addEventListener('click',()=>toggleMachiningCoordSign(btn.dataset.signedAxis));});
$('machiningThrough').addEventListener('change',updateMachiningUI);
$('machiningSeries').addEventListener('change',()=>{updateHoleSeriesVisibility();updateMachiningUI();});
$('machiningSeriesAxis').addEventListener('change',updateMachiningUI);
$('machiningSeriesDirection').addEventListener('change',updateMachiningUI);
$('machiningPreset32').onclick=applyHole32Preset;
$('machiningPresetSelect').addEventListener('change',()=>{updateMachiningPresetInfo();applySelectedMachiningPreset();});
$('saveMachiningPreset').onclick=saveCurrentMachiningPreset;
$('deleteMachiningPreset').onclick=deleteSelectedMachiningPreset;


$('shapePresetSelect').addEventListener('change',()=>loadSelectedShapePresetToEditor(false));
$('newShapePreset').onclick=newShapePreset;
$('editShapePreset').onclick=editSelectedShapePreset;
$('saveShapePreset').onclick=saveShapePresetLibrary;
$('deleteShapePreset').onclick=deleteShapePresetLibrary;
['shapeFolder','shapeName','shapeRadius','shapeType'].forEach(id=>$(id)?.addEventListener('input',updateShapePreview));
document.querySelectorAll('[data-shape-corner]').forEach(b=>b.addEventListener('click',()=>{const c=b.dataset.shapeCorner;if(shapeSelectedCorners.has(c))shapeSelectedCorners.delete(c);else shapeSelectedCorners.add(c);refreshShapeCornerLabels();updateShapePreview();}));
$('previewShape3D').onclick=previewShape3D;
$('returnShapePreview').onclick=returnShapePreview;
$('applyShape').onclick=applyShapeToPiece;
$('cancelShape').onclick=closeShapeDialog;
$('shapeDialog').addEventListener('pointerdown',e=>{if(e.target===$('shapeDialog'))closeShapeDialog();});

$('hardwarePresetSelect').addEventListener('change',updateHardwarePanel);
$('hardwareLocalTab').onclick=()=>setHardwareScope('local');
$('hardwareGlobalTab').onclick=()=>setHardwareScope('global');
$('createHardwarePreset').onclick=()=>openHardwareBuilder(null);
$('editHardwarePreset').onclick=()=>{const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(p)openHardwareBuilder(p);};
$('publishHardwarePreset').onclick=publishSelectedHardwarePreset;
$('deleteHardwarePreset').onclick=deleteSelectedHardwarePreset;
$('previewHardware3D').onclick=previewHardware3D;
$('applyHardware').onclick=applySelectedHardware;
$('cancelHardware').onclick=()=>{$('machiningDialog').style.display='none';machiningEditId=null;};
['hardwareContactAxis','hardwareContactSide','hardwareBMode','hardwareAAnchor','hardwareBAnchor','hardwareBSeriesAnchor','hardwareBSeriesDirection'].forEach(id=>$(id).addEventListener('change',updateHardwareBuilderUi));
['hardwareContactTolerance','hardwareAOffset','hardwareBOffset','hardwareBEdge','hardwareBSeriesOffset','hardwareBSeriesCount','hardwareBSeriesStep','hardwareSourceDiameter','hardwareSourceDepth','hardwareTargetDiameter','hardwareTargetDepth','hardwareName'].forEach(id=>$(id).addEventListener('input',updateHardwareBuilderUi));
['hardwareSourceEnabled','hardwareTargetEnabled'].forEach(id=>$(id).addEventListener('change',updateHardwareBuilderUi));
function toggleHardwareSigned(id){const f=$(id);let n=parseDecimalInput(f.value);if(!Number.isFinite(n))n=0;f.value=nice(Math.abs(n)<1e-9?0:-n);updateHardwareBuilderUi();f.focus();}
$('hardwareAOffsetSign').onclick=()=>toggleHardwareSigned('hardwareAOffset');
$('hardwareBOffsetSign').onclick=()=>toggleHardwareSigned('hardwareBOffset');
$('hardwareBSeriesOffsetSign').onclick=()=>toggleHardwareSigned('hardwareBSeriesOffset');
$('hardwareExampleShelfPin').onclick=fillHardwareShelfPinExample;
$('hardwareExampleDowel').onclick=fillHardwareDowelExample;
$('cancelHardwareBuilder').onclick=()=>{$('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;};
$('saveHardwareBuilder').onclick=saveHardwareBuilder;
$('hardwareBuilderDialog').addEventListener('pointerdown',e=>{if(e.target===$('hardwareBuilderDialog')){$('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;}});

$('machiningBackGroove').addEventListener('change',()=>{updateBackGrooveVisibility();updateMachiningUI();});
$('machiningPresetBackGroove').onclick=applyBackGroovePreset;
$('saveMachining').onclick=saveMachining;
$('previewMachining3D').onclick=showMachining3DPreview;
$('returnMachiningPreview').onclick=()=>closeMachining3DPreview({reopen:true});
$('cancelMachining').onclick=()=>{clearMachiningDraftPreview();machiningPreviewActive=false;machiningVisualGroup.visible=true;$('machining3DPreviewBar').style.display='none';machiningPreviewOwner=null;$('machiningDialog').style.display='none';machiningEditId=null;};
$('machiningDialog').addEventListener('pointerdown',e=>{if(e.target===$('machiningDialog')){clearMachiningDraftPreview();machiningPreviewActive=false;machiningVisualGroup.visible=true;$('machining3DPreviewBar').style.display='none';machiningPreviewOwner=null;$('machiningDialog').style.display='none';machiningEditId=null;}});
$('rotX').onclick=()=>rotateBox('x'); $('rotY').onclick=()=>rotateBox('y'); $('rotZ').onclick=()=>rotateBox('z');
$('undoBtn').onclick=undo; $('redoBtn').onclick=redo; $('deleteBtn').onclick=deleteSelected;
$('clearGuidesBtn').onclick=()=>{ if(!constructionGuides.length){toast('Não há guias');return;} clearConstructionGuides(); commitHistory(); toast('Guias removidas'); };
$('showHiddenSpacesBtn').onclick=()=>{ showAllHiddenSpaces(); $('morePanel').style.display='none'; };
$('importFurnitureBtn').onclick=()=>{ $('morePanel').style.display='none'; $('furnitureImportFile').click(); };
$('furnitureImportFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const parsed=await designLabFurnitureRecordFromFile(file);
    importFurnitureData(parsed.record);
    if(parsed.stl){
      toast('STL DesignLab importado preservando a geometria curva e as configurações do móvel.');
    }else if(parsed.fallback){
      toast(parsed.record?.dxfFallbackMode==='2d'
        ?'DXF 2D importado como painéis planos; a montagem 3D original não existe no arquivo.'
        :'DXF sem dados internos do DesignLab: importado pela geometria disponível.');
    }else if(!parsed.legacyJson){
      toast('DXF DesignLab importado preservando curvas, peças e configurações.');
    }
  }catch(err){ toast(err.message||'Móvel inválido'); }
  e.target.value='';
});
$('resetCam').onclick=()=>{setFrontWorldView();$('morePanel').style.display='none';toast('Vista 3D');};
$('viewModeBadge').onclick=()=>returnTo3D({restore:true,notify:true});
$('saveBtn').onclick=()=>saveCurrentProject();
$('loadBtn').onclick=()=>showProjectHome();
$('clearBtn').onclick=()=>{if(!objects.length && !constructionGuides.length && !spaceRoots.length)return; clearScene();commitHistory();toast('Projeto limpo');};
$('exportBtn').onclick=()=>exportCurrentProjectFile();
$('importBtn').onclick=()=>$('projectFileInput').click();
$('importFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{ const data=JSON.parse(await file.text()); const state=Array.isArray(data)?data:data; if(!Array.isArray(state) && !Array.isArray(state?.objects))throw new Error(); applyState(state);commitHistory();toast('Projeto importado'); }
  catch{toast('JSON inválido');} e.target.value='';
});


// ---------- v93 · eventos do gerenciador de projetos ----------
$('homeNewProject').onclick=$('heroNewProject').onclick=$('menuNewProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); openProjectMetaDialog('new'); };
$('homeOpenFile').onclick=$('heroOpenFile').onclick=$('menuOpenProjectFile').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); $('projectFileInput').click(); };
$('legacyImportAllBtn').onclick=claimAllLegacyProjects;
$('legacyProjectCards').addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-legacy-import]');
  if(!btn)return;
  claimLegacyProject(btn.dataset.legacyImport).catch(err=>toast(err.message||'Não foi possível importar'));
});
$('homeSaveProject').onclick=$('menuSaveProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); saveCurrentProject(); };
$('homeSaveAsProject').onclick=$('menuSaveAsProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); if(currentProjectId)openProjectMetaDialog('saveas'); };
$('homeSettings').onclick=$('menuAppSettings').onclick=()=>openAppSettings();
$('appSettingsClose').onclick=closeAppSettings;
$('appSettingsDialog').addEventListener('pointerdown',e=>{if(e.target===$('appSettingsDialog'))closeAppSettings();});
document.querySelectorAll('[data-cad-bg]').forEach(b=>b.addEventListener('click',()=>{
  applyCadBackground(b.dataset.cadBg,{persist:true,notify:true});
}));
$('cadGridVisibleSetting').addEventListener('change',e=>{
  applyCadGridVisibility(e.target.checked,{persist:true,notify:true});
});
$('cadXrayVisibleSetting').addEventListener('change',e=>{
  applyXray3D(e.target.checked,{persist:true,notify:true});
});
$('menuOpenProjects').onclick=$('menuProjectHome').onclick=()=>showProjectHome();
$('menuRenameProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); if(currentProjectId)openProjectMetaDialog('rename',currentProjectRecord); };
$('menuDuplicateProject').onclick=async()=>{ $('projectMenuPanel').classList.remove('show'); if(currentProjectId)await duplicateProjectById(currentProjectId); };
$('menuExportProjectFile').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); exportCurrentProjectFile(); };
$('projectMenuBtn').onclick=e=>{e.stopPropagation();$('projectMenuPanel').classList.toggle('show');};
$('presentationBack').onclick=()=>showProjectHome();
$('presentationEdit').onclick=enterProjectEditor;
$('projectMetaCancel').onclick=closeProjectMetaDialog;
$('projectMetaConfirm').onclick=async()=>{
  try{
    const meta=readProjectMeta();
    if(projectMetaMode==='new')await createNewProject(meta);
    else if(projectMetaMode==='saveas')await saveAsCurrentProject(meta);
    else await renameCurrentProject(meta,currentProjectRecord);
  }catch(err){toast(err.message||'Não foi possível salvar os dados do projeto');}
};
$('projectMetaDialog').addEventListener('pointerdown',e=>{if(e.target===$('projectMetaDialog'))closeProjectMetaDialog();});
$('recoveryRestore').onclick=recoverPendingProject;
$('recoveryDiscard').onclick=discardPendingRecovery;
$('recoveryCancel').onclick=()=>{$('recoveryDialog').classList.remove('show');pendingRecovery=null;};
$('cardMenuRename').onclick=async()=>{const rec=await projectDbGet(projectCardMenuId);closeProjectCardMenu();if(rec)openProjectMetaDialog('rename',rec);};
$('cardMenuDuplicate').onclick=async()=>{const id=projectCardMenuId;closeProjectCardMenu();if(id)await duplicateProjectById(id);};
$('cardMenuExport').onclick=async()=>{const id=projectCardMenuId;closeProjectCardMenu();const rec=await projectDbGet(id);if(rec)await exportProjectRecordFile(rec);};
$('cardMenuDelete').onclick=async()=>{const id=projectCardMenuId;if(id)await deleteProjectById(id);};
$('projectFileInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{await importProjectFile(file);}catch(err){toast(err.message||'Arquivo de projeto inválido');}
  e.target.value='';
});
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('#projectMenuPanel')&&!e.target.closest('#projectMenuBtn'))$('projectMenuPanel').classList.remove('show');
  if(!e.target.closest('#projectCardMenu')&&!e.target.closest('[data-project-action="menu"]'))closeProjectCardMenu();
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('appSettingsDialog')?.classList.contains('show')){
    closeAppSettings();
    return;
  }
  const mod=e.ctrlKey||e.metaKey;if(!mod)return;
  const key=e.key.toLowerCase();
  if(key==='s'){
    e.preventDefault();
    if(e.shiftKey){if(currentProjectId)openProjectMetaDialog('saveas');}
    else saveCurrentProject();
  }else if(key==='o'){
    e.preventDefault();$('projectFileInput').click();
  }else if(key==='n'){
    e.preventDefault();openProjectMetaDialog('new');
  }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){projectAutosaveNow();if(currentIdentityUser&&cloudAccountState.ok)saveCloudPreferences({silent:true});}});
window.addEventListener('pagehide',()=>{projectAutosaveNow();});


$('authLoginBtn').onclick=()=>showAuthInlineForm('login');
$('authSignupBtn').onclick=()=>showAuthInlineForm('signup');
$('authForgotBtn').onclick=()=>showAuthInlineForm('forgot');
document.querySelectorAll('[data-auth-back]').forEach(b=>b.onclick=()=>showAuthInlineForm('main'));
$('authLoginForm').addEventListener('submit',authSubmitLogin);
$('authSignupForm').addEventListener('submit',authSubmitSignup);
$('authForgotForm').addEventListener('submit',authSubmitForgot);
$('authRetryBtn').onclick=async()=>{
  setAuthStatus('Verificando sessão…','');
  if(identityClient){
    const user=identityClient.currentUser?.();
    if(user){
      unlockOnlineApp(user,{message:'Sessão encontrada.'});
      setTimeout(()=>syncCloudAccount({silent:false}),100);
    }else lockOnlineApp('Nenhuma sessão ativa. Entre ou crie uma conta.');
  }else{
    await initOnlineIdentity();
  }
};
$('authLocalBtn').onclick=localAuthContinue;
$('homeLogoutBtn').onclick=logoutOnlineIdentity;
$('homeCheckUpdate').onclick=()=>checkDesignLabUpdate({manual:true,force:true});
$('menuCheckUpdate').onclick=()=>checkDesignLabUpdate({manual:true,force:true});
$('settingsCheckUpdate').onclick=()=>checkDesignLabUpdate({manual:true,force:true});
$('updateLaterBtn').onclick=closeUpdateDialog;
$('updateNowBtn').onclick=applyDesignLabUpdate;
$('updateDialog').addEventListener('pointerdown',e=>{if(e.target===$('updateDialog'))closeUpdateDialog();});

$('homeNavStart').onclick=()=>scrollProjectHomeTo('projectHome');
$('homeNavProjects').onclick=()=>scrollProjectHomeTo('homeRecentSection');
$('homeNavModeling').onclick=openHomeModeling;
$('homeNavMaterials').onclick=openHomeMaterials;
$('homeNavAccount').onclick=()=>scrollProjectHomeTo('projectWelcomeCard');

$('homeModelsSection').addEventListener('click',e=>{
  if(!e.target.closest?.('.homeModelCard'))return;
  toast('A biblioteca de modelos será a próxima etapa do layout');
});

$('authBannedLogout').onclick=logoutOnlineIdentity;
$('homeAdminPanel').onclick=openAdminPanel;
$('homeAdminShortcut').onclick=openAdminPanel;
$('menuAdminPanel').onclick=openAdminPanel;
$('closeAdminDialog').onclick=closeAdminPanel;
$('adminDialog').addEventListener('pointerdown',e=>{if(e.target===$('adminDialog'))closeAdminPanel();});
$('adminUsersTabBtn').onclick=async()=>{adminSetTab('users');await refreshAdminPanel();};
$('adminPaymentsTabBtn').onclick=async()=>{adminSetTab('payments');await refreshAdminPanel();};
$('adminSettingsTabBtn').onclick=async()=>{adminSetTab('settings');await refreshAdminPanel();};
$('adminSaveSettingsBtn').onclick=saveAdminSettings;
$('adminRefreshBtn').onclick=refreshAdminPanel;
$('adminUserSearchBtn').onclick=async()=>{adminPanelState.search=$('adminUserSearch').value.trim();await loadAdminUsers();};
$('adminUserSearch').addEventListener('keydown',async e=>{if(e.key==='Enter'){e.preventDefault();adminPanelState.search=$('adminUserSearch').value.trim();await loadAdminUsers();}});
$('adminPaymentFilter').addEventListener('change',async e=>{adminPanelState.paymentStatus=e.target.value;await loadAdminPayments();});
$('adminPaymentRefreshBtn').onclick=async()=>{await Promise.all([loadAdminStats(),loadAdminPayments()]);};
$('adminUsersList').addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-admin-action]');if(!btn)return;
  const card=btn.closest('[data-admin-user]');if(!card)return;
  const id=card.dataset.adminUser,action=btn.dataset.adminAction;
  if(action==='premium7')adminPremium(id,7);
  else if(action==='premium30')adminPremium(id,30);
  else if(action==='premium90')adminPremium(id,90);
  else if(action==='revoke')adminRevokePremium(id);
  else if(action==='ban')adminBanUser(id,true);
  else if(action==='unban')adminBanUser(id,false);
});
$('adminPaymentsList').addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-admin-payment-action]');if(!btn)return;
  const card=btn.closest('[data-admin-payment]');if(!card)return;
  adminPaymentAction(card.dataset.adminPayment,btn.dataset.adminPaymentAction);
});

installOutsideMenuClose();

window.addEventListener('resize',()=>{if($('sheetPreviewDialog')?.classList.contains('show'))requestAnimationFrame(sheetPreviewDraw);});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);perspectiveCamera.aspect=innerWidth/Math.max(1,innerHeight);perspectiveCamera.updateProjectionMatrix();if(viewMode2D){const root=activeSpaceRoot();viewSpace(root,current2DView||'front');}else camera.updateProjectionMatrix();});

initDesignLabInstallExperience();
initDesignLabServiceWorker().catch(()=>{});
setTimeout(()=>checkDesignLabUpdate({force:true}),1200);
window.addEventListener('online',()=>{updateCacheStatusUI();checkDesignLabUpdate({force:true}).catch(()=>{});if(currentIdentityUser&&cloudAccountState.ok)syncCloudPreferences({silent:true,allowReload:false}).then(r=>r?.ok?saveCloudPreferences({silent:true}):null);});
window.addEventListener('offline',updateCacheStatusUI);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')checkDesignLabUpdate().catch(()=>{});
});
window.addEventListener('pageshow',()=>checkDesignLabUpdate().catch(()=>{}));

// Início limpo e frontal. O CAD inicializa normalmente por baixo da tela de projetos.
setFrontWorldView();
history=[stateString()]; historyIndex=0;
initToolDock();
initSpaceActionsDrag();
initPieceInspectorFloating();
initProjectHub().catch(err=>{console.error(err);toast('Não foi possível abrir o gerenciador de projetos');});
initOnlineIdentity().catch(err=>{console.error(err);setAuthStatus('Falha ao iniciar a autenticação.','error');});

function animate(){
  requestAnimationFrame(animate); controls.update(); if(dragMode) updateLiveLabel(); updateMachiningVisualTransforms(); renderer.render(scene,camera);
}
updateXray3DButton();
setPieceVisualEdgesVisible(true);
animate();
