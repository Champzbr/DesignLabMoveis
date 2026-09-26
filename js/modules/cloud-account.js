// DesignLabMoveis 1.311.00 · conta em nuvem e preferências sincronizadas.
export function createCloudAccountModule(ctx){
  const { $, escapeHtml, toast, authUserName, updateAdminVisibility, getAuth, storeOfflinePremiumLicense, premiumWorkspaceAllowed, clearOfflinePremiumLicense, showPremiumAccessRequired, syncCloudProjects, renderProjectHome, showBannedAccount } = ctx;
  const auth=new Proxy({}, {get(_t,p){const a=getAuth?.();const v=a?.[p];return typeof v==='function'?v.bind(a):v;}});
const CLOUD_API_BASE='https://designlabmoveis-api.geppetomarcenaria.workers.dev';

const cloudAccountState={loading:false,ok:false,error:null,user:null,subscription:null,lastSync:null,banned:false};
function replaceCloudAccountState(next){const v=next&&typeof next==='object'?next:{};for(const k of Object.keys(cloudAccountState))delete cloudAccountState[k];Object.assign(cloudAccountState,v);return cloudAccountState;}

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

  if(auth.authOfflineMode&&!cloudAccountState.ok){
    if(line){line.textContent='Premium offline · nuvem aguardando internet';line.className='cloudLine warn';}
    if(box){box.textContent='Premium offline autorizado. Projetos locais funcionam normalmente; a nuvem sincroniza quando a internet voltar.';box.className='cloudAccountStatus warn';}
    return;
  }
  if(auth.authLocalMode){
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
    if(menu&&auth.currentIdentityUser){
      menu.innerHTML=`<strong>${escapeHtml(authUserName(auth.currentIdentityUser))}</strong><br>${escapeHtml(auth.currentIdentityUser.email||'')}<br>${escapeHtml(plan)} · conta sincronizada com o D1.`;
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
// 1.200.18 · PREFERÊNCIAS DA CONTA — CELULAR / PC
// ============================================================================
// Projetos continuam no fluxo próprio (IndexedDB + R2). Este bloco sincroniza
// somente preferências/configurações do DesignLabMoveis no D1, por usuário.
// Configurações antigas do aparelho são aproveitadas no primeiro sincronismo.
const CLOUD_PREFERENCES_EXACT_KEYS=new Set([
  'miniCadToolDockPrefsV62','miniCadToolDockPrefsV61','miniCadToolDockPosV61','designLabQuickDockV2','designLabQuickDockV1',
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
  'designlab-piece-thickness-v135:',
  'designlab-piece-create-prefs-v120067:'
];
let cloudPreferencesApplying=false;
let cloudPreferencesSaveTimer=null;
let cloudPreferencesSyncing=false;
let cloudPreferencesRevision=0;
let cloudPreferencesUpdatedAt=null;
let cloudPreferencesHookInstalled=false;

function cloudPreferencesOwnerId(){
  return String(auth.currentIdentityUser?.id||cloudAccountState?.user?.id||'').trim();
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
  if(auth.authLocalMode||!auth.currentIdentityUser||!cloudAccountState.ok)return;
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
  if(auth.authLocalMode||!auth.currentIdentityUser||!cloudAccountState.ok||cloudPreferencesApplying)return null;
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
  if(cloudPreferencesSyncing||auth.authLocalMode||!auth.currentIdentityUser||!cloudAccountState.ok)return null;
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
    // 1.200.65: nunca recarrega a página só porque preferências da conta mudaram.
    // No Android isso podia zerar a pilha de navegação e fazer o Voltar fechar o
    // PWA. As preferências ficam salvas imediatamente e valem integralmente na
    // próxima abertura; as telas abertas continuam estáveis nesta sessão.
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
  if(auth.authLocalMode||!auth.currentIdentityUser){
    replaceCloudAccountState({loading:false,ok:false,error:null,user:null,subscription:null,lastSync:null,banned:false});
    updateCloudAccountChrome();return null;
  }
  if(cloudAccountState.loading)return null;
  cloudAccountState.loading=true;cloudAccountState.error=null;updateCloudAccountChrome();

  try{
    const data=await cloudApiFetch('/me');
    replaceCloudAccountState({
      loading:false,ok:!!data?.ok,error:null,user:data?.user||null,
      subscription:data?.subscription||null,lastSync:new Date().toISOString(),banned:false
    });
    updateCloudAccountChrome();

    // 1.200.96: cada validação online renova uma licença assinada por até 72 h.
    // O token não contém segredo e não pode ser alterado sem invalidar a assinatura.
    if(premiumWorkspaceAllowed(data)){
      if(data?.offline_license?.token){
        await storeOfflinePremiumLicense(data.offline_license,{expectedUserId:data?.user?.id||auth.currentIdentityUser?.id});
      }else if(data?.offline_license_error){
        console.warn('Premium offline não emitido pelo Worker:',data.offline_license_error);
      }
    }else{
      clearOfflinePremiumLicense();
      showPremiumAccessRequired(data?.subscription||null);
      return data;
    }

    // 1.200.65: sincronização da conta não pode recarregar o documento por baixo
    // do usuário. Reload automático derrubava o estado de navegação/Voltar em
    // alguns PWAs Android. As preferências são gravadas localmente e o runtime
    // continua; o próximo acesso já parte delas sem precisar sincronizar servidor.
    const prefSync=await syncCloudPreferences({silent:true,allowReload:false});
    if(prefSync?.reloading)return data;
    await syncCloudProjects({silent:true});
    if(document.body.classList.contains('project-home-active'))await renderProjectHome();

    if(!silent)toast(`Conta conectada · ${cloudPlanText()}`);
    return data;
  }catch(err){
    console.error('Cloud account sync:',err);
    if(err?.status===403 && err?.data?.error==='banned'){
      clearOfflinePremiumLicense();
      replaceCloudAccountState({loading:false,ok:false,error:'Conta bloqueada',user:null,subscription:null,lastSync:null,banned:true});
      updateCloudAccountChrome();
      showBannedAccount(err?.data?.reason||'');
      return null;
    }
    replaceCloudAccountState({
      ...cloudAccountState,
      loading:false,ok:false,error:String(err?.message||'Não foi possível conectar à nuvem.'),
      lastSync:cloudAccountState.lastSync||null,banned:false
    });
    updateCloudAccountChrome();
    if(!silent)toast('Login feito, mas a nuvem não respondeu');
    return null;
  }
}
window.designLabCloud={apiBase:CLOUD_API_BASE,getState(){return JSON.parse(JSON.stringify(cloudAccountState));},sync(){return syncCloudAccount({silent:false});},syncPreferences(){return syncCloudPreferences({silent:false,allowReload:true});},savePreferences(){return saveCloudPreferences({silent:false});},apiFetch:cloudApiFetch};




  return {
    CLOUD_API_BASE, cloudPlanText, updateCloudAccountChrome, cloudApiFetch,
    cloudPreferencesOwnerId,isCloudPreferenceKey,captureCloudPreferences,cloudPreferenceStorageChanged,installCloudPreferenceStorageHook,cloudPreferencesReloadStamp,applyCloudPreferences,saveCloudPreferences,syncCloudPreferences,syncCloudAccount,
    get cloudAccountState(){return cloudAccountState;},
    set cloudAccountState(v){replaceCloudAccountState(v||{loading:false,ok:false,error:null,user:null,subscription:null,lastSync:null,banned:false});}
  };
}
