export function createAdminModule({$,escapeHtml,toast,cloudApiFetch,getCloudAccountState,getCurrentIdentityUser}){
  const cloudAccountState=new Proxy({}, {
    get(_target,key){return getCloudAccountState()?.[key];},
    set(_target,key,value){const state=getCloudAccountState();if(state)state[key]=value;return true;}
  });

  let adminPanelState={tab:'users',stats:null,users:[],payments:[],settings:{free_trial_days:15,premium_price_cents:2999,premium_days:30,payment_provider:'manual_pix',pix_key:'',pix_receiver_name:'',pix_receiver_city:''},search:'',paymentStatus:''};

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
        <div class="adminMeta"><div><strong>Acesso</strong>${escapeHtml(u.role==='admin'?'Administrador':(u.access_role||'geral'))} · ${escapeHtml(u.role==='admin'?'approved':(u.access_status||'pending'))}</div></div>
        ${u.role==='admin'?'':`<div class="adminActions" style="align-items:center;flex-wrap:wrap"><select data-access-role aria-label="Perfil de acesso"><option value="geral" ${u.access_role==='geral'?'selected':''}>Acesso geral</option><option value="cnc" ${u.access_role==='cnc'?'selected':''}>CNC</option><option value="seccionadora" ${u.access_role==='seccionadora'?'selected':''}>Seccionadora</option><option value="ambas" ${u.access_role==='ambas'?'selected':''}>CNC + Seccionadora</option><option value="supervisor" ${u.access_role==='supervisor'?'selected':''}>Supervisor (leitura)</option></select><button data-admin-action="approveAccess">Aprovar perfil</button><button class="secondary" data-admin-action="pendingAccess">Suspender acesso</button><button class="danger" data-admin-action="rejectAccess">Rejeitar</button></div>`}
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
    if(!rows.length){box.innerHTML='<div class="adminEmpty">Nenhum pagamento encontrado.</div>';return;}
    box.innerHTML=rows.map(p=>{
      const review=p.status==='pending';
      const statusLabel=p.status==='pending'&&Number(p.reported_paid)?'AGUARDANDO CONFERÊNCIA':String(p.status||'').toUpperCase();
      const badgeClass=p.status==='paid'?'premium':review?'pending':'';
      return `<article class="adminPaymentCard" data-admin-payment="${escapeHtml(p.id)}">
        <div class="adminPaymentTop">
          <div><strong>${escapeHtml(p.name||p.email||'Usuário')}</strong><small>${escapeHtml(p.email||'')} · ${escapeHtml(p.id)}</small></div>
          <div class="adminBadges"><span class="adminBadge ${badgeClass}">${escapeHtml(statusLabel)}</span></div>
        </div>
        <div class="adminMeta">
          <div><strong>Valor</strong>${escapeHtml(adminMoney(p.amount_cents||0))}</div>
          <div><strong>Dias</strong>${Number(p.days_purchased||0)}</div>
          <div><strong>Criado</strong>${escapeHtml(adminDate(p.created_at))}</div>
        </div>
        ${p.status==='pending'&&Number(p.reported_paid)?'<div class="adminPaymentReported">✓ O usuário informou que já realizou o PIX.</div>':''}
        ${review?`<div class="adminActions"><button data-admin-payment-action="approve">✓ Aprovar pagamento</button><button class="danger" data-admin-payment-action="reject">Rejeitar</button></div>`:''}
      </article>`;
    }).join('');
  }

  function renderAdminSettings(){
    const s=adminPanelState.settings||{};
    const days=Math.max(0,Number(s.free_trial_days??15)||0);
    $('adminFreeTrialDays').value=days;
    $('adminTrialSettingsInfo').textContent=days>0
      ? `Novas contas recebem ${days} dia(s) de Premium grátis. O período começa na data de criação da conta no Netlify.`
      : 'Teste grátis desativado. Novas contas começam diretamente no plano Free.';
    if($('adminPremiumPrice'))$('adminPremiumPrice').value=(Math.max(100,Number(s.premium_price_cents??2999)||2999)/100).toFixed(2);
    if($('adminPremiumDays'))$('adminPremiumDays').value=Math.max(1,Number(s.premium_days??30)||30);
    if($('adminPaymentProvider'))$('adminPaymentProvider').value=String(s.payment_provider||'manual_pix');
    if($('adminPixKey'))$('adminPixKey').value=String(s.pix_key||'');
    if($('adminPixReceiverName'))$('adminPixReceiverName').value=String(s.pix_receiver_name||'');
    if($('adminPixReceiverCity'))$('adminPixReceiverCity').value=String(s.pix_receiver_city||'');
    if($('adminPaymentSettingsInfo')){
      const configured=!!(String(s.pix_key||'').trim()&&String(s.pix_receiver_name||'').trim()&&String(s.pix_receiver_city||'').trim());
      $('adminPaymentSettingsInfo').textContent=configured
        ? `PIX configurado · ${adminMoney(s.premium_price_cents||2999)} por ${Number(s.premium_days||30)} dias. Compra manual ativa.`
        : 'PIX ainda incompleto. Informe a mesma chave, nome do recebedor e cidade usados no Contas Fácil.';
    }
  }
  async function loadAdminSettings(){
    const d=await cloudApiFetch('/admin/settings');
    adminPanelState.settings=d?.settings||adminPanelState.settings;
    renderAdminSettings();
  }
  async function saveAdminSettings(){
    const trialRaw=Number($('adminFreeTrialDays')?.value),trialDays=Math.max(0,Math.min(365,Math.trunc(Number.isFinite(trialRaw)?trialRaw:15)));
    const priceRaw=Number($('adminPremiumPrice')?.value),priceCents=Math.max(100,Math.min(999900,Math.round((Number.isFinite(priceRaw)?priceRaw:29.99)*100)));
    const premiumDays=Math.max(1,Math.min(3650,Math.trunc(Number($('adminPremiumDays')?.value)||30)));
    const body={
      free_trial_days:trialDays,premium_price_cents:priceCents,premium_days:premiumDays,
      payment_provider:String($('adminPaymentProvider')?.value||'manual_pix'),
      pix_key:String($('adminPixKey')?.value||'').trim(),
      pix_receiver_name:String($('adminPixReceiverName')?.value||'').trim(),
      pix_receiver_city:String($('adminPixReceiverCity')?.value||'').trim()
    };
    adminSetStatus('Salvando teste grátis, Premium e PIX…');
    try{
      const d=await cloudApiFetch('/admin/settings',{method:'POST',body});
      adminPanelState.settings=d?.settings||body;renderAdminSettings();
      adminSetStatus('Configurações do Premium e PIX salvas.','good');
    }catch(err){adminSetStatus(err.message||'Não foi possível salvar as configurações.','error');}
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
    $('adminIdentityText').textContent=`Administrador: ${cloudAccountState.user?.name||getCurrentIdentityUser()?.email||''}`;
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
  async function adminChangeAccess(userId,accessRole,accessStatus){
    if(!confirm(accessStatus==='approved'?'Aprovar este usuário com o perfil selecionado?':'Alterar o status de acesso deste usuário?'))return;
    adminSetStatus('Atualizando acesso…');
    try{
      await cloudApiFetch(`/admin/users/${encodeURIComponent(userId)}/access`,{method:'POST',body:{access_role:accessRole,access_status:accessStatus}});
      await loadAdminUsers();adminSetStatus('Acesso atualizado.','good');
    }catch(e){adminSetStatus(e.message||'Falha ao atualizar acesso.','error');}
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

  return {
    adminPanelState,
    adminAllowed,
    updateAdminVisibility,
    adminMoney,
    adminDate,
    adminSetStatus,
    adminSetTab,
    renderAdminStats,
    renderAdminUsers,
    renderAdminPayments,
    renderAdminSettings,
    loadAdminSettings,
    saveAdminSettings,
    loadAdminStats,
    loadAdminUsers,
    loadAdminPayments,
    refreshAdminPanel,
    openAdminPanel,
    closeAdminPanel,
    adminPremium,
    adminRevokePremium,
    adminBanUser,
    adminChangeAccess,
    adminPaymentAction
  };
}
