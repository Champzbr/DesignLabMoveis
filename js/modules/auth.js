export function offlineLicenseB64UrlToBytes(raw){
  let s=String(raw||'').replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4)s+='=';
  const bin=atob(s),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}

export function offlineLicenseBase64ToBytes(raw){
  const bin=atob(String(raw||'').replace(/\s+/g,'')),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}

export function offlineLicenseDecodeJson(part){
  try{return JSON.parse(new TextDecoder().decode(offlineLicenseB64UrlToBytes(part)));}
  catch{return null;}
}

export function offlineLicenseUserFromPayload(payload){
  const name=String(payload?.name||payload?.email||'Usuário').trim();
  return {
    id:String(payload?.sub||''),email:String(payload?.email||''),name,
    role:String(payload?.role||'user'),user_metadata:{full_name:name,name}
  };
}

export function authUserName(user){
  const meta=user?.user_metadata||{};
  const full=String(meta.full_name||meta.name||user?.name||'').trim();
  if(full)return full;
  const email=String(user?.email||'').trim();
  return email?email.split('@')[0]:'Usuário';
}

export function authUserInitials(user){
  const name=authUserName(user),parts=name.split(/\s+/).filter(Boolean);
  if(parts.length>=2)return (parts[0][0]+parts.at(-1)[0]).toUpperCase();
  return name.slice(0,2).toUpperCase()||'MC';
}

// 1.311.00 · Autenticação/Premium isolados do editor.
export function createAuthModule(ctx){
  const { $, applyProjectAccountScope, cloudApiFetch, escapeHtml, prepareProjectAccountSwitch, projectAutosaveNow, syncCloudAccount, updateCloudAccountChrome, updateProjectHomeWelcome } = ctx;
  
  
  
  // ============================================================================
  // 1.100.20 · AUTENTICAÇÃO ONLINE — NETLIFY IDENTITY
  // ============================================================================
  let identityClient=null;
  
  let currentIdentityUser=null;
  
  let authLocalMode=false;
  
  let authOfflineMode=false;
  
  let offlineLicensedUser=null;
  
  let offlineLicensePayload=null;
  
  let offlineAccessExpiryTimer=null;
  
  let authInitialized=false;
  
  let authWidgetEventsBound=false;
  
  let premiumAccessCheckSerial=0;
  
  let premiumAccessExpiryTimer=null;
  
  let premiumAccessRecheckTimer=null;
  
  const PREMIUM_ACCESS_RECHECK_MS=60*60*1000;
  
  
  // 1.200.96 · Premium offline assinado pelo Worker.
  // O app guarda apenas o token assinado. A chave privada fica SOMENTE no Worker.
  const OFFLINE_LICENSE_STORAGE_KEY='designlabOfflinePremiumLicenseV1';
  
  const OFFLINE_LICENSE_LAST_SEEN_PREFIX='designlabOfflinePremiumLastSeenV1:';
  
  const OFFLINE_LICENSE_PUBLIC_SPKI='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIBmSfuYVRlpYFLz93j9Dgs7un4D5LNe8bapSn8qHq3gGddyI1zlHDweBuewwuvWwd5xy1escqSmDf4ibm1Miig==';
  
  const OFFLINE_LICENSE_CLOCK_TOLERANCE_MS=10*60*1000;
  
  let offlineLicensePublicKeyPromise=null;
  
  
  // 1.200.60: a versão comercial não possui bypass local.
  // Desenvolvimento/login devem ser testados no endereço HTTPS publicado.
  function isLocalAuthDevelopment(){ return false; }
  
  async function offlineLicensePublicKey(){
    offlineLicensePublicKeyPromise ||= crypto.subtle.importKey(
      'spki',offlineLicenseBase64ToBytes(OFFLINE_LICENSE_PUBLIC_SPKI),
      {name:'ECDSA',namedCurve:'P-256'},false,['verify']
    );
    return offlineLicensePublicKeyPromise;
  }
  
  function offlineLicenseStoredToken(){
    try{return String(localStorage.getItem(OFFLINE_LICENSE_STORAGE_KEY)||'').trim();}catch{return '';}
  }
  
  function offlineLicenseLastSeenKey(userId){return OFFLINE_LICENSE_LAST_SEEN_PREFIX+String(userId||'unknown');}
  
  function clearOfflinePremiumLicense({userId=null}={}){
    try{
      const token=offlineLicenseStoredToken();
      const payload=token?offlineLicenseDecodeJson(token.split('.')[1]||''):null;
      if(userId&&String(payload?.sub||'')!==String(userId))return false;
      localStorage.removeItem(OFFLINE_LICENSE_STORAGE_KEY);
      if(payload?.sub)localStorage.removeItem(offlineLicenseLastSeenKey(payload.sub));
    }catch{}
    clearTimeout(offlineAccessExpiryTimer);offlineAccessExpiryTimer=null;
    authOfflineMode=false;offlineLicensedUser=null;offlineLicensePayload=null;
    return true;
  }
  
  async function verifyOfflinePremiumToken(token,{expectedUserId=null,updateClock=true}={}){
    try{
      token=String(token||'').trim();
      const parts=token.split('.');if(parts.length!==3)return {valid:false,reason:'format'};
      const header=offlineLicenseDecodeJson(parts[0]),payload=offlineLicenseDecodeJson(parts[1]);
      if(!header||!payload||header.alg!=='ES256'||header.typ!=='DLM-OFFLINE')return {valid:false,reason:'header'};
      const key=await offlineLicensePublicKey();
      const ok=await crypto.subtle.verify(
        {name:'ECDSA',hash:'SHA-256'},key,offlineLicenseB64UrlToBytes(parts[2]),
        new TextEncoder().encode(parts[0]+'.'+parts[1])
      );
      if(!ok)return {valid:false,reason:'signature'};
      if(payload.v!==1||payload.iss!=='designlabmoveis-api'||payload.aud!=='designlabmoveis'||payload.premium!==true)return {valid:false,reason:'claims'};
      const uid=String(payload.sub||'');if(!uid)return {valid:false,reason:'user'};
      if(expectedUserId&&uid!==String(expectedUserId))return {valid:false,reason:'different_user'};
      const now=Date.now(),issued=Number(payload.iat)*1000,offlineUntil=Number(payload.offline_until)*1000,recheckAfter=Number(payload.recheck_after)*1000;
      if(!Number.isFinite(issued)||!Number.isFinite(offlineUntil)||!Number.isFinite(recheckAfter))return {valid:false,reason:'times'};
      if(now+OFFLINE_LICENSE_CLOCK_TOLERANCE_MS<issued)return {valid:false,reason:'clock_before_issue'};
      const lastKey=offlineLicenseLastSeenKey(uid);
      let lastSeen=0;try{lastSeen=Number(localStorage.getItem(lastKey)||0)||0;}catch{}
      if(lastSeen&&now+OFFLINE_LICENSE_CLOCK_TOLERANCE_MS<lastSeen)return {valid:false,reason:'clock_rollback'};
      if(now>=offlineUntil)return {valid:false,reason:'offline_expired',payload};
      if(payload.premium_until){
        const premiumUntil=Date.parse(String(payload.premium_until));
        if(Number.isFinite(premiumUntil)&&now>=premiumUntil)return {valid:false,reason:'premium_expired',payload};
      }
      if(updateClock){try{localStorage.setItem(lastKey,String(Math.max(lastSeen,now)));}catch{}}
      return {valid:true,payload,token,needsRecheck:now>=recheckAfter,offlineUntil,recheckAfter,remainingMs:offlineUntil-now};
    }catch(err){console.warn('Licença offline:',err);return {valid:false,reason:'verify_error',error:err};}
  }
  
  async function loadOfflinePremiumLicense({expectedUserId=null,updateClock=true}={}){
    const token=offlineLicenseStoredToken();
    if(!token)return {valid:false,reason:'missing'};
    const result=await verifyOfflinePremiumToken(token,{expectedUserId,updateClock});
    if(!result.valid&&['signature','claims','format','header','offline_expired','premium_expired'].includes(result.reason)){
      clearOfflinePremiumLicense({userId:expectedUserId||null});
    }
    return result;
  }
  
  async function storeOfflinePremiumLicense(bundle,{expectedUserId=null}={}){
    const token=String(bundle?.token||'').trim();if(!token)return false;
    const result=await verifyOfflinePremiumToken(token,{expectedUserId,updateClock:true});
    if(!result.valid){console.warn('Worker devolveu licença offline inválida:',result.reason);return false;}
    try{localStorage.setItem(OFFLINE_LICENSE_STORAGE_KEY,token);}catch{return false;}
    offlineLicensePayload=result.payload;offlineLicensedUser=offlineLicenseUserFromPayload(result.payload);
    scheduleOfflineLicenseExpiry(result.payload);
    return true;
  }
  
  function offlineLicenseRecheckDue(){
    const t=Number(offlineLicensePayload?.recheck_after)*1000;
    return !Number.isFinite(t)||Date.now()>=t;
  }
  
  function scheduleOfflineLicenseExpiry(payload){
    clearTimeout(offlineAccessExpiryTimer);offlineAccessExpiryTimer=null;
    const until=Number(payload?.offline_until)*1000;if(!Number.isFinite(until))return;
    const remaining=until-Date.now();
    if(remaining<=0){queueMicrotask(()=>showOfflineLicenseExpired());return;}
    offlineAccessExpiryTimer=setTimeout(()=>handleOfflineLicenseDeadline(),Math.min(remaining+500,2147480000));
  }
  
  function handleOfflineLicenseDeadline(){
    if(currentIdentityUser&&navigator.onLine){verifyPremiumWorkspaceAccess({background:true}).catch(()=>showOfflineLicenseExpired());return;}
    showOfflineLicenseExpired();
  }
  
  function showOfflineLicenseExpired(){
    clearOfflinePremiumLicense();
    authOfflineMode=false;
    $('authGate')?.classList.remove('hidden');
    $('authMainActions')?.classList.remove('hidden');
    hidePremiumAccessPanel();
    showAuthInlineForm('main');
    setAuthStatus('O período offline terminou. Conecte à internet para validar o Premium novamente.','warn');
    updateIdentityChrome();
  }
  
  async function activateOfflinePremiumAccess(result,{message='Premium offline autorizado.'}={}){
    if(!result?.valid)return false;
    authOfflineMode=true;authLocalMode=false;
    offlineLicensePayload=result.payload;offlineLicensedUser=offlineLicenseUserFromPayload(result.payload);
    prepareProjectAccountSwitch();
    updateIdentityChrome();
    hidePremiumAccessPanel();
    $('authBannedPanel')?.classList.remove('show');
    $('authMainActions')?.classList.remove('hidden');
    $('authGate')?.classList.add('hidden');
    setAuthStatus(message,'good');
    scheduleOfflineLicenseExpiry(result.payload);
    queueMicrotask(()=>applyProjectAccountScope({checkRecovery:true}));
    return true;
  }
  
  async function tryOfflinePremiumStartup(){
    const result=await loadOfflinePremiumLicense();
    if(!result.valid)return false;
    await activateOfflinePremiumAccess(result,{message:result.needsRecheck?'Premium offline válido · verificaremos quando houver internet.':'Premium validado neste aparelho.'});
    return true;
  }
  
  function setAuthStatus(message,tone=''){
    const el=$('authStatus');if(!el)return;
    el.textContent=message;
    el.className='authStatus'+(tone?` ${tone}`:'');
  }
  
  function ensurePremiumAccessPanel(){
    let panel=$('authPremiumPanel');
    if(panel)return panel;
    panel=document.createElement('div');
    panel.id='authPremiumPanel';
    panel.className='authBannedPanel';
    panel.innerHTML=`<strong id="authPremiumTitle">Premium necessário</strong><p id="authPremiumMessage">Verificando sua assinatura…</p><button id="authPremiumBuy" type="button">💎 Comprar Premium</button><button id="authPremiumRetry" class="secondary" type="button">↻ Verificar acesso</button><button id="authPremiumLogout" class="secondary" type="button">Sair desta conta</button>`;
    const body=document.querySelector('#authGate .authBody');
    if(body){const status=$('authStatus');status?body.insertBefore(panel,status):body.appendChild(panel);}
    $('authPremiumBuy')?.addEventListener('click',()=>openPremiumPurchase());
    $('authPremiumRetry')?.addEventListener('click',()=>verifyPremiumWorkspaceAccess({message:'Acesso Premium confirmado.'}));
    $('authPremiumLogout')?.addEventListener('click',()=>logoutOnlineIdentity());
    return panel;
  }
  
  function hidePremiumAccessPanel(){ $('authPremiumPanel')?.classList.remove('show'); }
  
  
  // ============================================================================
  // 1.200.65 · COMPRA PREMIUM — PIX MANUAL / PROVIDER-READY
  // ============================================================================
  let premiumPurchaseState={payment:null,busy:false};
  
  let premiumQrModulePromise=null;
  
  async function premiumRenderQr(code){
    const holder=$('premiumPixQr');if(!holder)return;
    holder.innerHTML='<div class="premiumQrLoading">Gerando QR Code…</div>';
    try{
      premiumQrModulePromise ||= import('../qr-local.js?v=1.311.00-r3');
      const mod=await premiumQrModulePromise;
      if(holder&&String($('premiumPixCode')?.value||'')===String(code||'')){
        holder.innerHTML=mod.qrSvg(code,{size:260,margin:4,errorLevel:'M'});
      }
    }catch(err){
      console.error('QR PIX:',err);
      if(holder)holder.innerHTML='<div style="padding:20px;color:#a33;text-align:center">Não foi possível montar o QR Code. Use o PIX copia e cola abaixo.</div>';
    }
  }
  
  function premiumMoney(cents){return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  
  function premiumPurchaseSetStatus(message='',tone=''){
    const el=$('premiumPurchaseStatus');if(!el)return;
    el.textContent=message;el.className='premiumPurchaseStatus'+(tone?` ${tone}`:'');
  }
  
  function closePremiumPurchase(){
    const dlg=$('premiumPurchaseDialog');if(dlg){dlg.classList.remove('show');dlg.setAttribute('aria-hidden','true');}
  }
  
  function renderPremiumPurchase(payment){
    if(!payment)return;
    premiumPurchaseState.payment=payment;
    $('premiumPurchaseLoading').style.display='none';
    $('premiumPurchaseContent').style.display='block';
    $('premiumPurchasePrice').textContent=premiumMoney(payment.amount_cents);
    $('premiumPurchaseDays').textContent=`${Number(payment.days_purchased||30)} dias de acesso Premium`;
    $('premiumPixCode').value=String(payment.pix_copy_paste||'');
    premiumRenderQr(payment.pix_copy_paste);
    const status=String(payment.status||'pending');
    if(payment.reported_paid)premiumPurchaseSetStatus('Pagamento informado. Aguardando conferência do administrador.','warn');
    else if(status==='paid')premiumPurchaseSetStatus('Pagamento aprovado. Liberando o Premium…','good');
    else premiumPurchaseSetStatus('Escaneie o QR Code ou copie o código PIX. Depois toque em “Já fiz o pagamento”.','');
  }
  
  async function openPremiumPurchase(){
    if(!currentIdentityUser){setAuthStatus('Entre na conta antes de comprar o Premium.','warn');return;}
    const dlg=$('premiumPurchaseDialog');if(!dlg)return;
    dlg.classList.add('show');dlg.setAttribute('aria-hidden','false');
    $('premiumPurchaseLoading').style.display='block';
    $('premiumPurchaseContent').style.display='none';
    $('premiumPurchaseLoading').textContent='Gerando seu PIX…';
    premiumPurchaseSetStatus('');
    premiumPurchaseState.payment=null;
    try{
      const data=await cloudApiFetch('/payments/pix',{method:'POST',body:{},timeoutMs:20000});
      renderPremiumPurchase(data?.payment);
    }catch(err){
      console.error('Comprar Premium:',err);
      $('premiumPurchaseLoading').textContent=err?.data?.error==='pix_not_configured'
        ?'O PIX ainda não foi configurado pelo administrador.'
        :(err.message||'Não foi possível gerar o PIX agora.');
      premiumPurchaseSetStatus('Você pode fechar esta janela e tentar novamente depois.','error');
    }
  }
  
  async function copyPremiumPix(){
    const code=String($('premiumPixCode')?.value||'');if(!code)return;
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(code);
      else{const ta=$('premiumPixCode');ta.focus();ta.select();document.execCommand('copy');}
      premiumPurchaseSetStatus('Código PIX copiado.','good');
    }catch{premiumPurchaseSetStatus('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.','error');}
  }
  
  async function markPremiumPaymentPaid(){
    const payment=premiumPurchaseState.payment;if(!payment?.id||premiumPurchaseState.busy)return;
    premiumPurchaseState.busy=true;
    premiumPurchaseSetStatus('Registrando que você fez o pagamento…');
    try{
      const data=await cloudApiFetch(`/payments/${encodeURIComponent(payment.id)}/paid`,{method:'POST',body:{},timeoutMs:15000});
      payment.status=data?.status||'pending';payment.reported_paid=!!data?.reported_paid;
      renderPremiumPurchase(payment);
    }catch(err){premiumPurchaseSetStatus(err.message||'Não foi possível registrar o pagamento.','error');}
    finally{premiumPurchaseState.busy=false;}
  }
  
  async function verifyPremiumPayment(){
    const payment=premiumPurchaseState.payment;if(!payment?.id||premiumPurchaseState.busy)return;
    premiumPurchaseState.busy=true;premiumPurchaseSetStatus('Verificando pagamento e acesso Premium…');
    try{
      const data=await cloudApiFetch(`/payments/${encodeURIComponent(payment.id)}`,{timeoutMs:15000});
      if(data?.payment?.status==='paid'||data?.subscription?.premium_active){
        premiumPurchaseSetStatus('Pagamento aprovado. Premium liberado!','good');
        setTimeout(()=>closePremiumPurchase(),350);
        await verifyPremiumWorkspaceAccess({message:'Premium liberado. Bem-vindo!'});
      }else if(data?.payment?.status==='rejected'){
        payment.status='rejected';premiumPurchaseSetStatus('Este pagamento foi rejeitado. Gere um novo PIX ou fale com o suporte.','error');
      }else{
        payment.status=data?.payment?.status||payment.status;payment.reported_paid=!!data?.payment?.reported_paid;
        premiumPurchaseSetStatus(payment.reported_paid?'Ainda aguardando a conferência do administrador.':'Pagamento ainda não aprovado.','warn');
      }
    }catch(err){premiumPurchaseSetStatus(err.message||'Não foi possível verificar o pagamento.','error');}
    finally{premiumPurchaseState.busy=false;}
  }
  
  
  function stopPremiumAccessWatch(){
    clearTimeout(premiumAccessExpiryTimer);premiumAccessExpiryTimer=null;
    clearInterval(premiumAccessRecheckTimer);premiumAccessRecheckTimer=null;
  }
  
  function premiumWorkspaceAllowed(data){
    return data?.user?.role==='admin' || !!data?.subscription?.premium_active;
  }
  
  function premiumUntilText(subscription){
    const raw=subscription?.premium_until;if(!raw)return '';
    const d=new Date(raw);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR');
  }
  
  function showPremiumAccessRequired(subscription,{verificationError=false}={}){
    if(authLocalMode)return;
    authOfflineMode=false;clearTimeout(offlineAccessExpiryTimer);offlineAccessExpiryTimer=null;
    stopPremiumAccessWatch();
    $('authGate')?.classList.remove('hidden');
    $('authMainActions')?.classList.add('hidden');
    for(const id of ['authLoginForm','authSignupForm','authForgotForm'])$(id)?.classList.remove('show');
    $('authBannedPanel')?.classList.remove('show');
    const panel=ensurePremiumAccessPanel();panel?.classList.add('show');
    const title=$('authPremiumTitle'),msg=$('authPremiumMessage');
    if(verificationError){
      if(title)title.textContent='Não foi possível verificar o Premium';
      if(msg)msg.textContent='Confira sua internet e toque em “Verificar acesso”. A área de trabalho permanece protegida até a assinatura ser confirmada.';
      setAuthStatus('Não foi possível validar sua assinatura.','error');
      return;
    }
    const until=premiumUntilText(subscription);
    if(title)title.textContent='Premium expirado';
    if(msg)msg.textContent=until?`Seu acesso Premium terminou em ${until}. Renove o Premium para voltar à área de trabalho.`:'Sua conta não possui Premium ativo. Renove o Premium para acessar a área de trabalho.';
    setAuthStatus('Acesso à área de trabalho bloqueado até a renovação do Premium.','warn');
  }
  
  function schedulePremiumAccessWatch(data){
    stopPremiumAccessWatch();
    if(data?.user?.role==='admin')return;
    const until=Date.parse(String(data?.subscription?.premium_until||''));
    if(Number.isFinite(until)){
      const remaining=until-Date.now();
      if(remaining<=0){showPremiumAccessRequired(data?.subscription||null);return;}
      premiumAccessExpiryTimer=setTimeout(()=>verifyPremiumWorkspaceAccess({background:true}),Math.min(remaining+750,2147480000));
    }
    premiumAccessRecheckTimer=setInterval(()=>{
      if(document.visibilityState==='visible'&&currentIdentityUser&&navigator.onLine&&offlineLicenseRecheckDue())verifyPremiumWorkspaceAccess({background:true});
    },PREMIUM_ACCESS_RECHECK_MS);
  }
  
  async function verifyPremiumWorkspaceAccess({message='Conta conectada.',background=false}={}){
    if(authLocalMode||!currentIdentityUser)return false;
    const user=currentIdentityUser,serial=++premiumAccessCheckSerial;
    if(!background){
      hidePremiumAccessPanel();
      $('authBannedPanel')?.classList.remove('show');
      $('authMainActions')?.classList.add('hidden');
      $('authGate')?.classList.remove('hidden');
      setAuthStatus('Verificando acesso Premium…','');
    }
    const data=await syncCloudAccount({silent:true});
    if(serial!==premiumAccessCheckSerial||currentIdentityUser?.id!==user?.id)return false;
    if(ctx.cloudAccountState.banned)return false;
    if(!data){
      // 1.200.96: se a nuvem cair, usamos SOMENTE uma licença local com assinatura
      // válida, do mesmo usuário e dentro da janela máxima de 72 horas.
      const cached=await loadOfflinePremiumLicense({expectedUserId:user?.id});
      if(cached.valid){
        offlineLicensePayload=cached.payload;offlineLicensedUser=offlineLicenseUserFromPayload(cached.payload);
        hidePremiumAccessPanel();$('authMainActions')?.classList.remove('hidden');$('authGate')?.classList.add('hidden');
        setAuthStatus('Sem internet · Premium offline autorizado.','good');
        scheduleOfflineLicenseExpiry(cached.payload);
        return true;
      }
      showPremiumAccessRequired(ctx.cloudAccountState?.subscription||null,{verificationError:true});
      return false;
    }
    if(!premiumWorkspaceAllowed(data)){showPremiumAccessRequired(data?.subscription||null);return false;}
    hidePremiumAccessPanel();
    closePremiumPurchase();
    $('authMainActions')?.classList.remove('hidden');
    $('authGate')?.classList.add('hidden');
    setAuthStatus(message,'good');
    queueMicrotask(()=>applyProjectAccountScope({checkRecovery:true}));
    schedulePremiumAccessWatch(data);
    return true;
  }
  
  function updateIdentityChrome(){
    const chip=$('projectAccountChip'),avatar=$('projectAccountAvatar'),name=$('projectAccountName'),
          email=$('projectAccountEmail'),logout=$('homeLogoutBtn'),menu=$('projectMenuAccount');
  
    if(authOfflineMode&&!currentIdentityUser&&offlineLicensedUser){
      if(chip)chip.style.display='flex';
      if(avatar)avatar.textContent=authUserInitials(offlineLicensedUser);
      if(name)name.textContent=authUserName(offlineLicensedUser);
      if(email)email.textContent=offlineLicensedUser.email||'Premium offline';
      if(logout)logout.style.display='';
      if(menu)menu.innerHTML=`<strong>${escapeHtml(authUserName(offlineLicensedUser))}</strong><br>${escapeHtml(offlineLicensedUser.email||'')}<br>Premium offline autorizado · nuvem sincroniza quando houver internet.`;
      if(typeof updateCloudAccountChrome==='function')updateCloudAccountChrome();
      if(typeof updateProjectHomeWelcome==='function')updateProjectHomeWelcome();
      return;
    }
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
    if(authOfflineMode&&offlineLicensePayload){setAuthStatus('Premium offline autorizado. A validação online será retomada quando possível.','good');return;}
    stopPremiumAccessWatch();premiumAccessCheckSerial++;
    authLocalMode=false;
    authOfflineMode=false;
    currentIdentityUser=null;
    hidePremiumAccessPanel();
    $('authBannedPanel')?.classList.remove('show');
    updateIdentityChrome();
    $('authGate')?.classList.remove('hidden');
    showAuthInlineForm('main');
    setAuthStatus(message,'');
  }
  
  function unlockOnlineApp(user,{message='Conta conectada.'}={}){
    currentIdentityUser=user||currentIdentityUser;
    authLocalMode=false;
    authOfflineMode=false;
    prepareProjectAccountSwitch();
    updateIdentityChrome();
    queueMicrotask(async()=>{
      const cached=await loadOfflinePremiumLicense({expectedUserId:currentIdentityUser?.id});
      if(cached.valid){
        offlineLicensePayload=cached.payload;offlineLicensedUser=offlineLicenseUserFromPayload(cached.payload);
        hidePremiumAccessPanel();$('authBannedPanel')?.classList.remove('show');
        $('authMainActions')?.classList.remove('hidden');$('authGate')?.classList.add('hidden');
        setAuthStatus(cached.needsRecheck?'Premium local válido · atualizando a licença…':message,'good');
        scheduleOfflineLicenseExpiry(cached.payload);
        queueMicrotask(()=>applyProjectAccountScope({checkRecovery:true}));
        if(navigator.onLine&&cached.needsRecheck)verifyPremiumWorkspaceAccess({message,background:true});
        else schedulePremiumAccessWatch({user:{role:cached.payload.role},subscription:{premium_active:true,premium_until:cached.payload.premium_until}});
        return;
      }
      if(cached.reason==='different_user')clearOfflinePremiumLicense();
      $('authGate')?.classList.remove('hidden');
      setAuthStatus('Verificando acesso Premium…','');
      verifyPremiumWorkspaceAccess({message});
    });
  }
  
  function localAuthContinue(){
    authLocalMode=false;
    $('authGate')?.classList.remove('hidden');
    setAuthStatus('Modo local desativado na versão comercial. Use o site HTTPS para entrar.','warn');
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
      else if(!authLocalMode&&!authOfflineMode)lockOnlineApp('Conta não conectada. Entre ou crie uma conta.');
    });
    client.on('login',user=>{
      unlockOnlineApp(user,{message:'Login realizado.'});
      try{client.close();}catch{}
    });
    client.on('logout',()=>{
      stopPremiumAccessWatch();premiumAccessCheckSerial++;hidePremiumAccessPanel();
      clearOfflinePremiumLicense();
      currentIdentityUser=null;
      authLocalMode=false;authOfflineMode=false;
      ctx.setCloudAccountState({loading:false,ok:false,error:null,user:null,subscription:null,lastSync:null,banned:false});
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
        if(!currentIdentityUser&&!authLocalMode&&!authOfflineMode){
          $('authGate')?.classList.remove('hidden');
          setAuthStatus('Entre ou crie uma conta para continuar.','');
        }
      });
    }catch{}
  }
  
  async function initOnlineIdentity(){
    const local=isLocalAuthDevelopment();
    const hadOfflineAccess=await tryOfflinePremiumStartup();
    $('authLocalBox')?.classList.toggle('show',local);
    setAuthStatus(
      local?'Arquivo local detectado. Para testar o login real, use o endereço HTTPS publicado no Netlify.':'Conectando ao Netlify Identity…',
      local?'warn':''
    );
  
    const client=await waitForNetlifyIdentity();
    if(!client){
      if(hadOfflineAccess||authOfflineMode){
        setAuthStatus('Premium offline autorizado · conecte à internet dentro do prazo para renovar a validação.','good');
        return;
      }
      setAuthStatus(
        local?'Identity não carregou no arquivo local. Você pode continuar em modo local.':'Não foi possível carregar o Netlify Identity. Confira a internet e tente novamente.',
        local?'warn':'error'
      );
      return;
    }
  
    identityClient=client;
    if(!currentIdentityUser&&!authLocalMode&&!authOfflineMode&&$('authMainActions')&&!$('authMainActions').classList.contains('hidden')){
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
          if(!authInitialized&&!currentIdentityUser&&!authLocalMode&&!authOfflineMode){
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
    hidePremiumAccessPanel();
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
        if(widget && !currentIdentityUser && !authLocalMode && !authOfflineMode){
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
    try{await projectAutosaveNow();}catch{}
    const wasOfflineOnly=authOfflineMode&&!currentIdentityUser;
    clearOfflinePremiumLicense();
    if(wasOfflineOnly){authOfflineMode=false;lockOnlineApp('Acesso offline encerrado. Entre novamente para continuar.');return;}
    if(!identityClient){currentIdentityUser=null;authOfflineMode=false;lockOnlineApp('Você saiu da conta.');return;}
    try{await identityClient.logout();}
    catch(err){currentIdentityUser=null;authOfflineMode=false;lockOnlineApp('Sessão local encerrada. Conecte à internet para concluir a saída no servidor.');console.error(err);}
  }
  
  
  window.miniCadAuth={
    getUser(){return currentIdentityUser||offlineLicensedUser;},
    isAuthenticated(){return (!!currentIdentityUser&&!authLocalMode)||!!authOfflineMode;},
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

  return {
    get identityClient(){ return identityClient; },
    get currentIdentityUser(){ return currentIdentityUser; },
    get authLocalMode(){ return authLocalMode; },
    get authOfflineMode(){ return authOfflineMode; },
    get offlineLicensedUser(){ return offlineLicensedUser; },
    get offlineLicensePayload(){ return offlineLicensePayload; },
    get authInitialized(){ return authInitialized; },
    isLocalAuthDevelopment,
    offlineLicensePublicKey,
    offlineLicenseStoredToken,
    offlineLicenseLastSeenKey,
    clearOfflinePremiumLicense,
    verifyOfflinePremiumToken,
    loadOfflinePremiumLicense,
    storeOfflinePremiumLicense,
    offlineLicenseRecheckDue,
    scheduleOfflineLicenseExpiry,
    handleOfflineLicenseDeadline,
    showOfflineLicenseExpired,
    activateOfflinePremiumAccess,
    tryOfflinePremiumStartup,
    setAuthStatus,
    ensurePremiumAccessPanel,
    hidePremiumAccessPanel,
    premiumRenderQr,
    premiumMoney,
    premiumPurchaseSetStatus,
    closePremiumPurchase,
    renderPremiumPurchase,
    openPremiumPurchase,
    copyPremiumPix,
    markPremiumPaymentPaid,
    verifyPremiumPayment,
    stopPremiumAccessWatch,
    premiumWorkspaceAllowed,
    premiumUntilText,
    showPremiumAccessRequired,
    schedulePremiumAccessWatch,
    verifyPremiumWorkspaceAccess,
    updateIdentityChrome,
    lockOnlineApp,
    unlockOnlineApp,
    localAuthContinue,
    waitForNetlifyIdentity,
    bindIdentityEvents,
    initOnlineIdentity,
    authFriendlyError,
    showAuthInlineForm,
    authSetBusy,
    getReadyGoTrue,
    authSubmitLogin,
    authSubmitSignup,
    authSubmitForgot,
    openIdentityMode,
    logoutOnlineIdentity,
  };
}
