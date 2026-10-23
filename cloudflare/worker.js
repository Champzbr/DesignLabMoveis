export default {
  async fetch(request, env) {
    const siteUrl = String(env?.NETLIFY_SITE_URL || "").trim().replace(/\/+$/, "");
    if (!siteUrl) {
      return new Response(JSON.stringify({
        ok:false,
        error:"config_missing",
        message:"NETLIFY_SITE_URL não configurado"
      }), {
        status:500,
        headers:{ "Content-Type":"application/json" }
      });
    }

    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origin === siteUrl ? origin : siteUrl,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin"
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=UTF-8" }
    });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/health") {
      try {
        const db = await env.DB.prepare("SELECT 1 AS ok").first();
        const r2 = await env.PROJECTS.list({ limit: 1 });
        return json({ ok:true, service:"designlabmoveis-api", version:"1.312.00-r38", db:db?.ok===1, r2:true, r2_objects:r2.objects.length });
      } catch (error) {
        return json({ ok:false, error:error.message }, 500);
      }
    }

    // r38: consulta PÚBLICA apenas de uma visão filtrada, sem login, ZAW, DXF ou dados de clientes.
    // Um token aleatório de 128 bits é usado como chave de capacidade; não usar número de pedido.
    if (/^\/public\/pedidos\/[a-f0-9]{32}$/.test(url.pathname) && request.method === 'GET') {
      const token=url.pathname.split('/')[3];
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_public_links (token TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`).run();
      const row=await env.DB.prepare(`SELECT po.id,po.r2_key,po.revision,pl.created_at FROM production_public_links pl JOIN production_orders po ON po.id=pl.order_id WHERE pl.token=?1`).bind(token).first();
      if(!row)return json({ok:false,message:'Projeto não publicado ou link desativado.'},404);
      const object=await env.PROJECTS.get(row.r2_key);
      if(!object)return json({ok:false,message:'Projeto indisponível.'},404);
      const pkg=JSON.parse(await object.text());
      const pieces=(Array.isArray(pkg.labels?.labels)?pkg.labels.labels:[]).slice(0,2000).map(p=>({
        code:String(p.code||'').slice(0,60),name:String(p.name||'Peça').slice(0,100),
        length:Number(p.length)||0,width:Number(p.width)||0,thickness:Number(p.thickness)||0,
        sheet:Number(p.sheet)||0,material:String(p.material||'').slice(0,100),
        edgeBands:p.edgeBands&&typeof p.edgeBands==='object'?Object.fromEntries(['uMin','uMax','vMin','vMax'].map(k=>[k,p.edgeBands[k]?{name:String(p.edgeBands[k].name||p.edgeBands[k].code||'Fita').slice(0,80)}:null])):{}
      }));
      return new Response(JSON.stringify({ok:true,project:{orderNumber:String(pkg.orderNumber||'').slice(0,60),name:String(pkg.work||'Projeto').slice(0,90),revision:row.revision,pieces,assembly:pkg.assembly||null}}),{
        status:200,headers:{...cors,'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
      });
    }

    const authResult = await authenticateAndSync(request, env, siteUrl);
    if (!authResult.ok) return json(authResult.body, authResult.status);
    const ctx = authResult.ctx;

    if (ctx.dbUser.banned) {
      return json({ ok:false, error:"banned", message:"Esta conta está bloqueada.", reason:ctx.dbUser.banned_reason||null },403);
    }

    // r11: acesso autorizado no D1 (falha fechada sem migracao).
    const accessRole=ctx.dbUser.role==='admin'?'admin':ctx.dbUser.access_role;
    const approved=ctx.dbUser.role==='admin'||ctx.dbUser.access_status==='approved';
    if (url.pathname === '/access' && request.method === 'GET') {
      return json({ok:true,role:accessRole||'pending',status:ctx.dbUser.role==='admin'?'approved':(ctx.dbUser.access_status||'pending')});
    }
    if (!approved && url.pathname!=='/me') return json({ok:false,error:'approval_required',message:'Conta aguardando aprovação do administrador.'},403);
    const operatorRole=['cnc','seccionadora','ambas'].includes(accessRole);
    const supervisorRole=accessRole==='supervisor';
    if (operatorRole && request.method!=='GET' && !(request.method==='PATCH' && /^\/production\/orders\/[A-Za-z0-9_-]{1,100}\/sheets\/[0-9]{1,5}$/.test(url.pathname)))return json({ok:false,error:'operator_read_only',message:'Operadores somente consultam as ordens.'},403);
    if (operatorRole && !url.pathname.startsWith('/production/') && url.pathname!=='/me')
      return json({ok:false,error:'restricted_operator',message:'Esta conta só pode acessar o PlanosLab.'},403);
    if (supervisorRole && !['GET','HEAD'].includes(request.method))
      return json({ok:false,error:'read_only',message:'Supervisor tem acesso somente para visualização.'},403);
    if (supervisorRole && !['/me','/projects','/supervisor/projects'].includes(url.pathname) && !/^\/projects\/[A-Za-z0-9_-]+$/.test(url.pathname))
      return json({ok:false,error:'restricted_supervisor',message:'Supervisor só pode consultar projetos.'},403);

    // r38: revogar o link público sem apagar a ordem.
    if (/^\/production\/orders\/[A-Za-z0-9_-]{1,100}\/public$/.test(url.pathname) && request.method==='DELETE') {
      if(ctx.dbUser.role!=='admin')return json({ok:false,message:'Somente administrador pode revogar QR.'},403);
      const id=url.pathname.split('/')[3];
      const item=await env.DB.prepare('SELECT id FROM production_orders WHERE id=?1 AND owner_id=?2').bind(id,ctx.dbUser.identity_user_id).first();
      if(!item)return json({ok:false,message:'Pedido não encontrado.'},404);
      await env.DB.prepare('DELETE FROM production_public_links WHERE order_id=?1').bind(id).run();
      return json({ok:true,revoked:true});
    }

    // r10 · Ordens publicadas na produção. D1 guarda o índice; R2, o pacote imutável.
    if (url.pathname === "/production/orders" || /^\/production\/orders\/[A-Za-z0-9_-]{1,100}(?:\/sheets\/[0-9]{1,5})?$/.test(url.pathname)) {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_orders (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
        machine TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        revision INTEGER NOT NULL DEFAULT 1, r2_key TEXT NOT NULL,
        part_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      )`).run();
      const orderId=url.pathname.split('/')[3]||null;
      const sheetId=url.pathname.split('/')[5]||null;
      const operator=operatorRole;
      if (!orderId && request.method==='POST') {
        if(accessRole!=='admin'&&accessRole!=='geral')return json({ok:false,error:'forbidden',message:'Sem permissão para publicar ordens.'},403);
        const body=await readJson(request);
        const name=String(body?.name||'').trim().slice(0,120);
        const machine=String(body?.machine||'');
        const labels=body?.labels;
        if (!name||!['seccionadora','cnc','ambas'].includes(machine)||!labels||labels.schema!=='designlab-labels-v1'||!Array.isArray(labels.labels)||!labels.labels.length||labels.labels.length>2000)
          return json({ok:false,message:'Ordem inválida: confira nome, máquina e lista de peças.'},400);
        const zawFiles=Array.isArray(body?.zawFiles)?body.zawFiles:[];
        if(zawFiles.length>100||zawFiles.some(f=>typeof f.name!=='string'||!/^mingli-zaw\/[A-Za-z0-9_.\/-]+\/Result\.zaw$/i.test(f.name)||typeof f.data!=='string'||f.data.length>250000))
          return json({ok:false,message:'Arquivos ZAW inválidos ou grandes demais.'},400);
        // SVGs são gerados pelo otimizador; preserve-os no pacote do R2 para consulta por chapa.
        const sheetPlans=Array.isArray(body?.sheetPlans)?body.sheetPlans:[];
        if(sheetPlans.length>100||sheetPlans.some(p=>!Number.isInteger(Number(p.sheet))||Number(p.sheet)<1||typeof p.svg!=='string'||p.svg.length>400000||!/^\s*<svg\b/i.test(p.svg)))
          return json({ok:false,message:'Os desenhos dos planos de corte são inválidos ou excedem o limite.'},400);
        const cncFiles=Array.isArray(body?.cncFiles)?body.cncFiles:[];
        if(cncFiles.length>100||cncFiles.some(g=>!Number.isInteger(Number(g.sheet))||Number(g.sheet)<1||!Array.isArray(g.files)||g.files.length>80||g.files.some(f=>typeof f.name!=='string'||!/^[-A-Za-z0-9_./]+\.dxf$/i.test(f.name)||typeof f.data!=='string'||f.data.length>400000)))
          return json({ok:false,message:'Arquivos DXF para Aspire inválidos ou acima do limite.'},400);
        // O cliente gera o token com crypto.getRandomValues antes de imprimir etiquetas.
        const publicToken=String(body?.publicToken||'').toLowerCase();
        if(!/^[a-f0-9]{32}$/.test(publicToken))return json({ok:false,message:'Token público do pedido inválido.'},400);
        const assembly=body?.assembly;
        if(!assembly||assembly.schema!=='designlab-public-assembly-v1'||!Array.isArray(assembly.objects)||!assembly.objects.length||assembly.objects.length>500)
          return json({ok:false,message:'Montagem 3D inválida ou vazia.'},400);
        let meshValues=0;
        for(const p of assembly.objects){
          if(!p||!Array.isArray(p.size)||!Array.isArray(p.position)||!Array.isArray(p.rotation)||
            [...p.size,...p.position,...p.rotation].some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>100)||
            p.size.some(n=>n<=0)||typeof p.name!=='string'||p.name.length>100) return json({ok:false,message:'Componente 3D inválido.'},400);
          if(p.mesh!==undefined){if(!Array.isArray(p.mesh)||p.mesh.length%9!==0||p.mesh.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>2))return json({ok:false,message:'Malha 3D inválida.'},400);meshValues+=p.mesh.length;}
        }
        if(meshValues>150000)return json({ok:false,message:'Malha 3D grande demais.'},413);
        const payload=JSON.stringify({name,machine,orderNumber:String(body.orderNumber||'').slice(0,60),customer:String(body.customer||'').slice(0,90),work:String(body.work||'').slice(0,90),publicToken,labels,html:String(body.html||''),zawFiles,sheetPlans,cncFiles,assembly});
        if(payload.length>4500000)return json({ok:false,message:'Ordem maior que o limite de 4,5 MB.'},413);
        const id=crypto.randomUUID().replaceAll('-','');
        const key='production/'+ctx.dbUser.identity_user_id+'/'+id+'.json';
        await env.PROJECTS.put(key,payload,{httpMetadata:{contentType:'application/json'}});
        const now=new Date().toISOString();
        try{await env.DB.prepare(`INSERT INTO production_orders(id,owner_id,name,machine,status,revision,r2_key,part_count,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,ctx.dbUser.identity_user_id,name,machine,'pending',1,key,labels.labels.length,now).run();}
        catch(e){await env.PROJECTS.delete(key);throw e;}
        try{
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_public_links (token TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`).run();
          await env.DB.prepare(`INSERT INTO production_public_links(token,order_id,created_at) VALUES(?1,?2,?3)`).bind(publicToken,id,now).run();
        }catch(e){await env.DB.prepare('DELETE FROM production_orders WHERE id=?1').bind(id).run();await env.PROJECTS.delete(key);throw e;}
        return json({ok:true,id,publicUrl:siteUrl+'/pedido.html?t='+publicToken,created_at:now},201);
      }
      if (!orderId && request.method==='GET') {
        // r10: somente o proprietário ou admin. Compartilhamento por equipe exige
        // associação de operadores à empresa; não expor ordens de outros usuários.
        const rows=operatorRole
          ? await env.DB.prepare(`SELECT po.id,po.name,po.machine,po.status,po.revision,po.part_count,po.created_at FROM production_orders po JOIN users owner ON owner.identity_user_id=po.owner_id WHERE owner.role='admin' AND (?1='ambas' OR po.machine=?1 OR po.machine='ambas') ORDER BY po.created_at DESC LIMIT 200`).bind(accessRole).all()
          : await env.DB.prepare(`SELECT id,name,machine,status,revision,part_count,created_at FROM production_orders WHERE owner_id=? ORDER BY created_at DESC LIMIT 200`).bind(ctx.dbUser.identity_user_id).all();
        return json({ok:true,orders:rows.results||[]});
      }
      // r26: somente o administrador remove pedidos oficiais e seus dados de produção.
      if (orderId && !sheetId && request.method === 'DELETE') {
        if (ctx.dbUser.role !== 'admin')
          return json({ok:false,error:'admin_required',message:'Somente o administrador pode excluir pedidos.'},403);
        const existing = await env.DB.prepare(`SELECT id,name,r2_key FROM production_orders WHERE id=?1 AND owner_id=?2`)
          .bind(orderId,ctx.dbUser.identity_user_id).first();
        if (!existing) return json({ok:false,error:'not_found',message:'Pedido não encontrado na sua conta.'},404);
        // Remova primeiro o índice e o progresso; um R2 órfão nunca fica acessível pela API.
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_sheet_status (
          order_id TEXT NOT NULL, sheet_no INTEGER NOT NULL, status TEXT NOT NULL,
          updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY(order_id,sheet_no)
        )`).run();
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM production_sheet_status WHERE order_id=?1`).bind(orderId),
          env.DB.prepare(`DELETE FROM production_orders WHERE id=?1 AND owner_id=?2`).bind(orderId,ctx.dbUser.identity_user_id),
          env.DB.prepare(`DELETE FROM production_public_links WHERE order_id=?1`).bind(orderId)
        ]);
        let storageCleaned=true;
        try { await env.PROJECTS.delete(existing.r2_key); }
        catch (err) { storageCleaned=false; console.error('Falha ao limpar pacote de pedido excluído:',orderId,err); }
        try { await audit(env,ctx.dbUser.identity_user_id,'delete_production_order',null,{orderId,name:existing.name,storageCleaned}); }
        catch(err) { console.error('Falha ao registrar auditoria de exclusão:',err); }
        return json({ok:true,deleted:true,id:orderId,storageCleaned,message:storageCleaned?'Pedido excluído.':'Pedido removido da lista; limpeza do armazenamento pendente.'});
      }
      if (orderId && sheetId && request.method==='PATCH') {
        // r21: progresso por chapa armazenado no D1, sem alterar o pacote R2.
        const sheetNo=Number(sheetId);
        const payload=await readJson(request);
        if (!Number.isSafeInteger(sheetNo)||sheetNo<1||!['cut','pending'].includes(payload?.status)) return json({ok:false,message:'Chapa ou situação inválida.'},400);
        const meta=operatorRole
          ? await env.DB.prepare(`SELECT po.* FROM production_orders po JOIN users owner ON owner.identity_user_id=po.owner_id WHERE po.id=?1 AND owner.role='admin' AND (?2='ambas' OR po.machine=?2 OR po.machine='ambas')`).bind(orderId,accessRole).first()
          : await env.DB.prepare(`SELECT * FROM production_orders WHERE id=? AND owner_id=?`).bind(orderId,ctx.dbUser.identity_user_id).first();
        if(!meta)return json({ok:false,message:'Ordem não encontrada ou não autorizada.'},404);
        const pkgObject=await env.PROJECTS.get(meta.r2_key);
        if(!pkgObject)return json({ok:false,message:'Pacote indisponível.'},404);
        const pkg=JSON.parse(await pkgObject.text());
        const sheetNumbers=new Set((pkg.labels?.labels||[]).map(l=>Number(l.group||l.sheet)));
        if(!sheetNumbers.has(sheetNo))return json({ok:false,message:'Chapa não pertence a esta ordem.'},404);
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_sheet_status (
          order_id TEXT NOT NULL, sheet_no INTEGER NOT NULL, status TEXT NOT NULL,
          updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY(order_id,sheet_no)
        )`).run();
        const now=new Date().toISOString();
        await env.DB.prepare(`INSERT INTO production_sheet_status(order_id,sheet_no,status,updated_by,updated_at)
          VALUES(?,?,?,?,?) ON CONFLICT(order_id,sheet_no) DO UPDATE SET status=excluded.status,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
          .bind(orderId,sheetNo,payload.status,ctx.dbUser.identity_user_id,now).run();
        return json({ok:true,sheet:sheetNo,status:payload.status,updated_at:now});
      }
      if(orderId && request.method==='GET'){
        const meta=operatorRole
          ? await env.DB.prepare(`SELECT po.* FROM production_orders po JOIN users owner ON owner.identity_user_id=po.owner_id WHERE po.id=?1 AND owner.role='admin' AND (?2='ambas' OR po.machine=?2 OR po.machine='ambas')`).bind(orderId,accessRole).first()
          : await env.DB.prepare(`SELECT * FROM production_orders WHERE id=? AND owner_id=?`).bind(orderId,ctx.dbUser.identity_user_id).first();
        if(!meta)return json({ok:false,message:'Ordem não encontrada nesta conta.'},404);
        const object=await env.PROJECTS.get(meta.r2_key);
        if(!object)return json({ok:false,message:'Pacote de produção indisponível.'},404);
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_sheet_status (order_id TEXT NOT NULL, sheet_no INTEGER NOT NULL, status TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(order_id,sheet_no))`).run();
        const statusRows=await env.DB.prepare(`SELECT sheet_no,status,updated_at FROM production_sheet_status WHERE order_id=?`).bind(orderId).all();
        return json({ok:true,order:{id:meta.id,name:meta.name,machine:meta.machine,status:meta.status,revision:meta.revision,created_at:meta.created_at},sheetStatus:statusRows.results||[],package:JSON.parse(await object.text())});
      }
      return json({ok:false,message:'Operação não permitida.'},405);
    }

    if (url.pathname === "/me" && request.method === "GET") {
      const trial = await getActiveTrial(env, ctx.dbUser.identity_user_id);
      let offlineLicense=null,offlineLicenseError=null;
      if(ctx.dbUser.role==="admin"||isPremiumActive(ctx.dbUser)){
        try{offlineLicense=await issueOfflinePremiumLicense(env,ctx.dbUser);}
        catch(error){
          console.error("Offline premium license:",error);
          offlineLicenseError=String(error?.message||"offline_license_error");
        }
      }
      return json({
        ok:true,
        user:publicUser(ctx.dbUser),
        subscription:subscriptionView(ctx.dbUser, trial),
        server_now:new Date().toISOString(),
        offline_license:offlineLicense,
        offline_license_error:offlineLicenseError
      });
    }

    // -----------------------------------------------------------------------
    // 1.100.91 · COMPRA PREMIUM — acessível mesmo com Premium vencido.
    // O frontend recebe uma resposta genérica por provedor, permitindo trocar
    // PIX manual por Mercado Pago/outro gateway futuramente sem refazer o gate.
    // -----------------------------------------------------------------------
    if (url.pathname === "/payments/config" && request.method === "GET") {
      const cfg=await getPaymentSettings(env);
      return json({ok:true,payment:{
        provider:cfg.payment_provider,
        premium_price_cents:cfg.premium_price_cents,
        premium_days:cfg.premium_days,
        premium_sales_enabled:(await getSettingText(env,"premium_sales_enabled","0"))==="1",
        pix_configured:!!(cfg.pix_key&&cfg.pix_receiver_name&&cfg.pix_receiver_city)
      }});
    }

    if (url.pathname === "/payments/pix" && request.method === "POST") {
      if((await getSettingText(env,"premium_sales_enabled","0"))!=="1")return json({ok:false,error:"sales_disabled",message:"A compra de Premium está desativada pelo administrador."},403);
      if(ctx.dbUser.role==="admin")return json({ok:false,error:"admin_does_not_need_payment",message:"A conta administrativa não precisa comprar Premium."},400);
      const cfg=await getPaymentSettings(env);
      if(cfg.payment_provider!=="manual_pix")return json({ok:false,error:"payment_provider_not_supported",message:"O provedor de pagamento configurado ainda não está disponível nesta versão."},409);
      if(!cfg.pix_key||!cfg.pix_receiver_name||!cfg.pix_receiver_city){
        return json({ok:false,error:"pix_not_configured",message:"O PIX para compra do Premium ainda não foi configurado pelo administrador."},409);
      }

      let payment=await env.DB.prepare(`
        SELECT id,user_id,status,amount_cents,days_purchased,created_at,updated_at
        FROM payments
        WHERE user_id=?1 AND status='pending'
          AND amount_cents=?2 AND days_purchased=?3
          AND datetime(created_at)>datetime('now','-60 minutes')
        ORDER BY datetime(created_at) DESC LIMIT 1
      `).bind(ctx.dbUser.identity_user_id,cfg.premium_price_cents,cfg.premium_days).first();

      if(!payment){
        const now=new Date().toISOString(),id="pay_"+crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO payments(id,user_id,status,amount_cents,days_purchased,created_at,updated_at)
          VALUES (?1,?2,'pending',?3,?4,?5,?5)
        `).bind(id,ctx.dbUser.identity_user_id,cfg.premium_price_cents,cfg.premium_days,now).run();
        payment={id,user_id:ctx.dbUser.identity_user_id,status:"pending",amount_cents:cfg.premium_price_cents,days_purchased:cfg.premium_days,created_at:now,updated_at:now};
      }

      const txid=paymentTxid(payment.id);
      const pixCopyPaste=buildPixPayload(cfg,Number(payment.amount_cents),txid);
      const createdMs=Date.parse(String(payment.created_at||""));
      const expiresAt=new Date((Number.isFinite(createdMs)?createdMs:Date.now())+60*60*1000).toISOString();
      return json({ok:true,payment:{
        id:payment.id,status:payment.status,provider:"manual_pix",
        amount_cents:Number(payment.amount_cents),days_purchased:Number(payment.days_purchased),
        reported_paid:payment.status==='pending'&&String(payment.updated_at||'')!==String(payment.created_at||''),
        txid,pix_copy_paste:pixCopyPaste,expires_at:expiresAt
      }});
    }

    let userPaymentMatch=url.pathname.match(/^\/payments\/([^/]+)$/);
    if(userPaymentMatch&&request.method==="GET"){
      const id=decodeURIComponent(userPaymentMatch[1]);
      const payment=await env.DB.prepare(`
        SELECT id,status,amount_cents,days_purchased,created_at,updated_at,
          CASE WHEN status='pending' AND updated_at<>created_at THEN 1 ELSE 0 END AS reported_paid
        FROM payments WHERE id=?1 AND user_id=?2 LIMIT 1
      `).bind(id,ctx.dbUser.identity_user_id).first();
      if(!payment)return json({ok:false,error:"not_found",message:"Pagamento não encontrado nesta conta."},404);
      const freshUser=await getUser(env,ctx.dbUser.identity_user_id),trial=await getActiveTrial(env,ctx.dbUser.identity_user_id);
      return json({ok:true,payment,subscription:subscriptionView(freshUser||ctx.dbUser,trial)});
    }

    let userPaidMatch=url.pathname.match(/^\/payments\/([^/]+)\/paid$/);
    if(userPaidMatch&&request.method==="POST"){
      const id=decodeURIComponent(userPaidMatch[1]);
      const payment=await env.DB.prepare(`SELECT id,status FROM payments WHERE id=?1 AND user_id=?2 LIMIT 1`).bind(id,ctx.dbUser.identity_user_id).first();
      if(!payment)return json({ok:false,error:"not_found",message:"Pagamento não encontrado nesta conta."},404);
      if(payment.status==="paid")return json({ok:true,status:"paid",reported_paid:true});
      if(payment.status==="rejected")return json({ok:false,error:"payment_rejected",message:"Este pagamento foi rejeitado. Gere um novo PIX."},409);
      await env.DB.prepare(`UPDATE payments SET updated_at=?1 WHERE id=?2 AND user_id=?3 AND status='pending'`).bind(new Date().toISOString(),id,ctx.dbUser.identity_user_id).run();
      return json({ok:true,status:"pending",reported_paid:true});
    }

    // 1.100.90: autenticação não equivale a licença. Exceto administradores,
    // todas as APIs de trabalho exigem Premium ainda dentro da validade.
    if (!operatorRole && !supervisorRole && ctx.dbUser.role !== "admin" && !isPremiumActive(ctx.dbUser)) {
      return json({
        ok:false,
        error:"premium_required",
        message:"Seu Premium expirou ou não está ativo.",
        subscription:subscriptionView(ctx.dbUser, null)
      },403);
    }

    // -----------------------------------------------------------------------
    // PREFERÊNCIAS DA CONTA — configurações compartilhadas entre aparelhos
    // -----------------------------------------------------------------------
    if (url.pathname === "/preferences" && request.method === "GET") {
      const row=await env.DB.prepare(`
        SELECT prefs_json,revision,created_at,updated_at
        FROM user_preferences
        WHERE user_id=?1
        LIMIT 1
      `).bind(ctx.dbUser.identity_user_id).first();
      if(!row)return json({ok:true,exists:false,settings:{},revision:0,updated_at:null});
      let settings={};
      try{settings=JSON.parse(row.prefs_json||"{}");}catch{}
      if(!settings||typeof settings!=="object"||Array.isArray(settings))settings={};
      return json({ok:true,exists:true,settings,revision:Number(row.revision||1),updated_at:row.updated_at});
    }

    if (url.pathname === "/preferences" && request.method === "PUT") {
      const body=await readJson(request);
      const settings=body?.settings;
      if(!settings||typeof settings!=="object"||Array.isArray(settings)){
        return json({ok:false,error:"invalid_preferences",message:"Configurações inválidas."},400);
      }
      const prefsJson=JSON.stringify(settings);
      const sizeBytes=new TextEncoder().encode(prefsJson).byteLength;
      if(sizeBytes>1024*1024){
        return json({ok:false,error:"preferences_too_large",message:"As configurações ultrapassaram o limite de 1 MB."},413);
      }
      const existing=await env.DB.prepare(`SELECT revision,created_at FROM user_preferences WHERE user_id=?1 LIMIT 1`).bind(ctx.dbUser.identity_user_id).first();
      const now=new Date().toISOString();
      const revision=Number(existing?.revision||0)+1;
      const createdAt=existing?.created_at||now;
      await env.DB.prepare(`
        INSERT INTO user_preferences(user_id,prefs_json,revision,created_at,updated_at)
        VALUES (?1,?2,?3,?4,?5)
        ON CONFLICT(user_id) DO UPDATE SET
          prefs_json=excluded.prefs_json,
          revision=excluded.revision,
          updated_at=excluded.updated_at
      `).bind(ctx.dbUser.identity_user_id,prefsJson,revision,createdAt,now).run();
      return json({ok:true,revision,updated_at:now,size_bytes:sizeBytes});
    }


    // -----------------------------------------------------------------------
    // PROJETOS POR USUÁRIO — índice no D1, arquivo completo no R2
    // -----------------------------------------------------------------------
    if (url.pathname === '/supervisor/projects' && request.method === 'GET') {
      if(!supervisorRole && accessRole!=='admin')return json({ok:false,error:'forbidden'},403);
      const rows=await env.DB.prepare(`SELECT p.id,p.name,p.size_bytes,p.cloud_revision,p.updated_at FROM projects p JOIN users u ON u.identity_user_id=p.user_id WHERE u.role='admin' AND p.deleted_at IS NULL ORDER BY p.updated_at DESC LIMIT 200`).all();
      return json({ok:true,projects:rows.results||[]});
    }
    if (url.pathname === "/projects" && request.method === "GET") {
      const includeDeleted=url.searchParams.get("include_deleted")==="1";
      const result=await env.DB.prepare(`
        SELECT id,name,size_bytes,cloud_revision,created_at,updated_at,deleted_at
        FROM projects
        WHERE (user_id=?1 OR (?3=1 AND user_id IN (SELECT identity_user_id FROM users WHERE role='admin'))) AND (?2=1 OR deleted_at IS NULL)
        ORDER BY datetime(updated_at) DESC
        LIMIT 500
      `).bind(ctx.dbUser.identity_user_id,includeDeleted?1:0,supervisorRole?1:0).all();
      return json({ok:true,projects:result.results||[]});
    }

    let projectMatch=url.pathname.match(/^\/projects\/([A-Za-z0-9_-]{1,120})$/);

    if(projectMatch&&request.method==="GET"){
      const projectId=projectMatch[1];
      const meta=await env.DB.prepare(`
        SELECT id,user_id,name,r2_key,size_bytes,cloud_revision,created_at,updated_at,deleted_at
        FROM projects
        WHERE id=?1 AND (user_id=?2 OR (?3=1 AND user_id IN (SELECT identity_user_id FROM users WHERE role='admin')))
        LIMIT 1
      `).bind(projectId,ctx.dbUser.identity_user_id,supervisorRole?1:0).first();

      if(!meta||meta.deleted_at){
        return json({ok:false,error:"not_found",message:"Projeto não encontrado nesta conta."},404);
      }

      const object=await env.PROJECTS.get(meta.r2_key);
      if(!object)return json({ok:false,error:"r2_missing",message:"Arquivo do projeto não encontrado na nuvem."},404);

      try{
        const record=JSON.parse(await object.text());
        record.ownerUserId=meta.user_id;
        return json({
          ok:true,
          project:{id:meta.id,name:meta.name,cloud_revision:Number(meta.cloud_revision||1),updated_at:meta.updated_at},
          record
        });
      }catch{
        return json({ok:false,error:"invalid_project_file",message:"Arquivo do projeto está inválido."},500);
      }
    }

    if(projectMatch&&request.method==="PUT"){
      const projectId=projectMatch[1];
      const body=await readJson(request);
      const incoming=body?.record;

      if(!incoming||String(incoming.id||"")!==projectId){
        return json({ok:false,error:"invalid_project",message:"Dados do projeto inválidos."},400);
      }

      const existing=await env.DB.prepare(`
        SELECT id,user_id,r2_key,cloud_revision,deleted_at
        FROM projects WHERE id=?1 LIMIT 1
      `).bind(projectId).first();

      if(existing&&existing.user_id!==ctx.dbUser.identity_user_id){
        return json({ok:false,error:"project_conflict",message:"Este projeto pertence a outra conta."},409);
      }
      if(existing?.deleted_at){
        return json({ok:false,error:"project_deleted",message:"Este projeto já foi excluído da nuvem.",deleted_at:existing.deleted_at},409);
      }

      const now=new Date().toISOString();
      const u=Date.parse(String(incoming.updatedAt||""));
      const c=Date.parse(String(incoming.createdAt||""));
      const updatedAt=Number.isFinite(u)?new Date(u).toISOString():now;
      const createdAt=Number.isFinite(c)?new Date(c).toISOString():now;

      const stored={...incoming,id:projectId,ownerUserId:ctx.dbUser.identity_user_id,appVersion:"1.100.29"};
      delete stored.draftState;delete stored.draftCamera;delete stored.draftAt;
      delete stored.cloudSyncedAt;delete stored.cloudRevision;delete stored.cloudError;delete stored.deletedAt;

      const serialized=JSON.stringify(stored);
      const sizeBytes=new TextEncoder().encode(serialized).byteLength;
      const r2Key=existing?.r2_key||`users/${ctx.dbUser.identity_user_id}/projects/${projectId}.json`;
      const revision=Number(existing?.cloud_revision||0)+1;

      await env.PROJECTS.put(r2Key,serialized,{
        httpMetadata:{contentType:"application/json; charset=UTF-8"},
        customMetadata:{user_id:ctx.dbUser.identity_user_id,project_id:projectId,updated_at:updatedAt}
      });

      await env.DB.prepare(`
        INSERT INTO projects(id,user_id,name,r2_key,size_bytes,cloud_revision,created_at,updated_at,deleted_at)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,NULL)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          r2_key=excluded.r2_key,
          size_bytes=excluded.size_bytes,
          cloud_revision=excluded.cloud_revision,
          updated_at=excluded.updated_at,
          deleted_at=NULL
      `).bind(
        projectId,ctx.dbUser.identity_user_id,String(stored.name||"Projeto").slice(0,200),
        r2Key,sizeBytes,revision,createdAt,updatedAt
      ).run();

      return json({ok:true,project:{
        id:projectId,name:String(stored.name||"Projeto"),cloud_revision:revision,
        size_bytes:sizeBytes,created_at:createdAt,updated_at:updatedAt
      }});
    }

    if(projectMatch&&request.method==="DELETE"){
      const projectId=projectMatch[1];
      const body=await readJson(request);
      const existing=await env.DB.prepare(`
        SELECT id,user_id,r2_key,cloud_revision,deleted_at
        FROM projects
        WHERE id=?1 AND user_id=?2
        LIMIT 1
      `).bind(projectId,ctx.dbUser.identity_user_id).first();

      if(!existing)return json({ok:true,deleted:true,already_missing:true});

      if(existing.r2_key){
        try{await env.PROJECTS.delete(existing.r2_key);}catch{}
      }

      const requested=Date.parse(String(body?.deleted_at||""));
      const deletedAt=Number.isFinite(requested)?new Date(requested).toISOString():new Date().toISOString();

      await env.DB.prepare(`
        UPDATE projects
        SET deleted_at=?1,updated_at=?1,cloud_revision=cloud_revision+1
        WHERE id=?2 AND user_id=?3
      `).bind(deletedAt,projectId,ctx.dbUser.identity_user_id).run();

      return json({ok:true,deleted:true,deleted_at:deletedAt});
    }

    // -----------------------------------------------------------------------
    // BIBLIOTECA GLOBAL — leitura para qualquer conta autenticada.
    // Pastas e metadados ficam no D1; o modelo completo fica no mesmo R2.
    // -----------------------------------------------------------------------
    if (url.pathname === "/library/global/folders" && request.method === "GET") {
      const result=await env.DB.prepare(`
        SELECT f.id,f.name,f.created_at,f.updated_at,
          (SELECT COUNT(*) FROM global_library_items i WHERE i.folder_id=f.id) AS item_count
        FROM global_library_folders f
        ORDER BY lower(f.name), datetime(f.created_at)
      `).all();
      return json({ok:true,folders:result.results||[]});
    }

    let globalFolderMatch=url.pathname.match(/^\/library\/global\/folders\/([A-Za-z0-9_-]{1,120})\/items$/);
    if(globalFolderMatch&&request.method==="GET"){
      const folderId=globalFolderMatch[1];
      const folder=await env.DB.prepare(`
        SELECT id,name,created_at,updated_at
        FROM global_library_folders WHERE id=?1 LIMIT 1
      `).bind(folderId).first();
      if(!folder)return json({ok:false,error:"not_found",message:"Pasta global não encontrada."},404);

      const result=await env.DB.prepare(`
        SELECT id,folder_id,name,size_bytes,created_at,updated_at
        FROM global_library_items
        WHERE folder_id=?1
        ORDER BY lower(name), datetime(created_at)
      `).bind(folderId).all();
      return json({ok:true,folder,items:result.results||[]});
    }

    let globalItemMatch=url.pathname.match(/^\/library\/global\/items\/([A-Za-z0-9_-]{1,120})$/);
    if(globalItemMatch&&request.method==="GET"){
      const itemId=globalItemMatch[1];
      const item=await env.DB.prepare(`
        SELECT id,folder_id,name,r2_key,size_bytes,created_at,updated_at
        FROM global_library_items
        WHERE id=?1 LIMIT 1
      `).bind(itemId).first();
      if(!item)return json({ok:false,error:"not_found",message:"Modelo global não encontrado."},404);

      const object=await env.PROJECTS.get(item.r2_key);
      if(!object)return json({ok:false,error:"r2_missing",message:"Arquivo do modelo global não foi encontrado."},404);
      try{
        const record=JSON.parse(await object.text());
        return json({ok:true,item:{id:item.id,folder_id:item.folder_id,name:item.name,size_bytes:item.size_bytes,created_at:item.created_at,updated_at:item.updated_at},record});
      }catch{
        return json({ok:false,error:"invalid_global_model",message:"O arquivo do modelo global está inválido."},500);
      }
    }

    // -----------------------------------------------------------------------
    // 1.300.10 · MODELOS DE PORTAS GLOBAIS — leitura para usuários Premium.
    // A geometria fica no R2 e os metadados/revisões no D1. O modelo embutido
    // do frontend continua sendo fallback quando não existe override no servidor.
    // -----------------------------------------------------------------------
    if (url.pathname === "/doors/global" && request.method === "GET") {
      await ensureGlobalDoorModelsSchema(env);
      const result=await env.DB.prepare(`
        SELECT id,name,kind,description,reference_width_mm,reference_height_mm,reference_depth_mm,
          production_oversize_mm,face_part_ids_json,rules_json,part_count,face_count,revision,active,created_at,updated_at
        FROM global_door_models
        WHERE active=1
        ORDER BY lower(name), datetime(created_at)
      `).all();
      return json({ok:true,items:(result.results||[]).map(publicDoorModelRow)});
    }

    let globalDoorMatch=url.pathname.match(/^\/doors\/global\/([A-Za-z0-9_-]{1,160})$/);
    if(globalDoorMatch&&request.method==="GET"){
      await ensureGlobalDoorModelsSchema(env);
      const id=globalDoorMatch[1];
      const row=await env.DB.prepare(`
        SELECT * FROM global_door_models WHERE id=?1 AND active=1 LIMIT 1
      `).bind(id).first();
      if(!row)return json({ok:false,error:"not_found",message:"Modelo de porta não encontrado."},404);
      const object=await env.PROJECTS.get(row.r2_key);
      if(!object)return json({ok:false,error:"r2_missing",message:"Arquivo do modelo de porta não foi encontrado."},404);
      try{
        const record=JSON.parse(await object.text());
        return json({ok:true,item:publicDoorModelRow(row),record});
      }catch{
        return json({ok:false,error:"invalid_door_model",message:"O arquivo do modelo de porta está inválido."},500);
      }
    }

    // -----------------------------------------------------------------------
    // FERRAGENS GLOBAIS — leitura para qualquer conta autenticada.
    // As regras são pequenas e ficam diretamente no D1.
    // -----------------------------------------------------------------------
    if (url.pathname === "/hardware/global" && request.method === "GET") {
      const result=await env.DB.prepare(`
        SELECT id,name,preset_json,created_at,updated_at
        FROM global_hardware_presets
        ORDER BY lower(name), datetime(created_at)
      `).all();
      const items=[];
      for(const row of (result.results||[])){
        try{
          const preset=JSON.parse(row.preset_json||"{}");
          items.push({...preset,id:row.id,name:row.name,global:true,created_at:row.created_at,updated_at:row.updated_at});
        }catch{}
      }
      return json({ok:true,items});
    }

    // FORMAS GLOBAIS — leitura para qualquer conta autenticada.
    if (url.pathname === "/shapes/global" && request.method === "GET") {
      const result=await env.DB.prepare(`
        SELECT id,name,preset_json,created_at,updated_at
        FROM global_shape_presets
        ORDER BY lower(name), datetime(created_at)
      `).all();
      const items=[];
      for(const row of (result.results||[])){
        try{
          const preset=JSON.parse(row.preset_json||"{}");
          items.push({...preset,id:row.id,name:row.name,global:true,created_at:row.created_at,updated_at:row.updated_at});
        }catch{}
      }
      return json({ok:true,items});
    }

    if (url.pathname.startsWith("/admin/")) {
      if (ctx.dbUser.role !== "admin") {
        return json({ ok:false, error:"admin_required", message:"Acesso permitido somente para administrador." },403);
      }

      if (url.pathname === "/admin/settings" && request.method === "GET") {
        const freeTrialDays=await getSettingInt(env,"free_trial_days",15,0,365);
        const payment=await getPaymentSettings(env);
        return json({ok:true,settings:{free_trial_days:freeTrialDays,...payment,premium_sales_enabled:(await getSettingText(env,"premium_sales_enabled","0"))==="1"}});
      }

      if (url.pathname === "/admin/settings" && request.method === "POST") {
        const body=await readJson(request),now=new Date().toISOString();
        const freeTrialDays=clampInt(body.free_trial_days,0,365,15);
        const premiumPriceCents=clampInt(body.premium_price_cents,100,999900,2999);
        const premiumDays=clampInt(body.premium_days,1,3650,30);
        const paymentProvider=String(body.payment_provider||"manual_pix")==="manual_pix"?"manual_pix":"manual_pix";
        const pixKey=String(body.pix_key||"").trim().slice(0,180);
        const pixReceiverName=String(body.pix_receiver_name||"").trim().slice(0,60);
        const pixReceiverCity=String(body.pix_receiver_city||"").trim().slice(0,40);
        const premiumSalesEnabled=body.premium_sales_enabled===true;
        const rows=[
          ["premium_sales_enabled",premiumSalesEnabled?"1":"0"],
          ["free_trial_days",String(freeTrialDays)],["premium_price_cents",String(premiumPriceCents)],
          ["premium_days",String(premiumDays)],["payment_provider",paymentProvider],
          ["pix_key",pixKey],["pix_receiver_name",pixReceiverName],["pix_receiver_city",pixReceiverCity]
        ];
        await env.DB.batch(rows.map(([key,value])=>env.DB.prepare(`
          INSERT INTO app_settings(key,value,updated_at) VALUES (?1,?2,?3)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
        `).bind(key,value,now)));
        await audit(env,ctx.dbUser.identity_user_id,"update_app_payment_settings",null,{
          free_trial_days:freeTrialDays,premium_price_cents:premiumPriceCents,premium_days:premiumDays,
          premium_sales_enabled:premiumSalesEnabled,payment_provider:paymentProvider,pix_configured:!!(pixKey&&pixReceiverName&&pixReceiverCity)
        });
        return json({ok:true,settings:{
          free_trial_days:freeTrialDays,premium_price_cents:premiumPriceCents,premium_days:premiumDays,
          premium_sales_enabled:premiumSalesEnabled,payment_provider:paymentProvider,pix_key:pixKey,pix_receiver_name:pixReceiverName,pix_receiver_city:pixReceiverCity
        }});
      }

      if (url.pathname === "/admin/stats" && request.method === "GET") {
        const users = await env.DB.prepare(`
          SELECT COUNT(*) AS users_total,
            SUM(CASE WHEN banned=1 THEN 1 ELSE 0 END) AS banned_total,
            SUM(CASE WHEN plan='premium' AND premium_until IS NOT NULL
              AND datetime(premium_until)>datetime('now') THEN 1 ELSE 0 END) AS premium_active
          FROM users
        `).first();
        const payments = await env.DB.prepare(`
          SELECT
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS payments_pending,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS payments_paid,
            COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END),0) AS paid_cents
          FROM payments
        `).first();
        return json({ok:true,stats:{
          users_total:Number(users?.users_total||0),
          premium_active:Number(users?.premium_active||0),
          banned_total:Number(users?.banned_total||0),
          payments_pending:Number(payments?.payments_pending||0),
          payments_paid:Number(payments?.payments_paid||0),
          paid_cents:Number(payments?.paid_cents||0)
        }});
      }

      if (url.pathname === "/admin/users" && request.method === "GET") {
        const search=String(url.searchParams.get("search")||"").trim();
        const limit=clampInt(url.searchParams.get("limit"),1,100,60);
        const offset=clampInt(url.searchParams.get("offset"),0,1000000,0);
        const like=`%${search}%`;
        const result=await env.DB.prepare(`
          SELECT u.identity_user_id,u.email,u.name,u.role,u.access_role,u.access_status,u.plan,u.premium_until,
            u.banned,u.banned_at,u.banned_reason,u.created_at,u.updated_at,u.last_login_at,
            (SELECT COUNT(*) FROM payments p WHERE p.user_id=u.identity_user_id AND p.status='paid') AS purchases_count,
            (SELECT COALESCE(SUM(p.amount_cents),0) FROM payments p WHERE p.user_id=u.identity_user_id AND p.status='paid') AS paid_cents,
            EXISTS(
              SELECT 1 FROM subscriptions s
              WHERE s.user_id=u.identity_user_id
                AND s.source='trial'
                AND datetime(s.ends_at)>datetime('now')
            ) AS trial_active
          FROM users u
          WHERE (?1='' OR lower(u.email) LIKE lower(?2) OR lower(COALESCE(u.name,'')) LIKE lower(?2))
          ORDER BY datetime(u.created_at) DESC
          LIMIT ?3 OFFSET ?4
        `).bind(search,like,limit,offset).all();
        return json({
          ok:true,
          users:(result.results||[]).map(row=>({
            ...row,
            banned:!!Number(row.banned),
            trial_active:!!Number(row.trial_active),
            premium_active:isPremiumActive(row)
          })),
          limit,offset
        });
      }

      // r11: perfis e aprovacao somente pelo administrador existente.
      let accessMatch=url.pathname.match(/^\/admin\/users\/([^/]+)\/access$/);
      if(accessMatch && request.method==='POST'){
        const targetId=decodeURIComponent(accessMatch[1]),body=await readJson(request);
        const desiredRole=String(body?.access_role||'');const status=String(body?.access_status||'');
        if(!['geral','cnc','seccionadora','ambas','supervisor'].includes(desiredRole)||!['approved','pending','rejected'].includes(status))return json({ok:false,error:'invalid_access'},400);
        const target=await getUser(env,targetId);
        if(!target)return json({ok:false,error:'not_found'},404);
        if(target.role==='admin')return json({ok:false,error:'admin_protected',message:'O papel administrador não pode ser alterado aqui.'},403);
        const now=new Date().toISOString();
        await env.DB.prepare('UPDATE users SET access_role=?1,access_status=?2,updated_at=?3 WHERE identity_user_id=?4').bind(desiredRole,status,now,targetId).run();
        await audit(env,ctx.dbUser.identity_user_id,'set_access',targetId,{access_role:desiredRole,access_status:status});
        return json({ok:true,access_role:desiredRole,access_status:status});
      }

      let m=url.pathname.match(/^\/admin\/users\/([^/]+)\/ban$/);
      if(m&&request.method==="POST"){
        const targetId=decodeURIComponent(m[1]),body=await readJson(request),banned=!!body.banned;
        const reason=String(body.reason||"").trim().slice(0,500);
        if(targetId===ctx.dbUser.identity_user_id&&banned){
          return json({ok:false,error:"self_ban",message:"Você não pode banir a própria conta administrativa."},400);
        }
        if(!await getUser(env,targetId))return json({ok:false,error:"not_found",message:"Usuário não encontrado."},404);
        const now=new Date().toISOString();
        await env.DB.prepare(`
          UPDATE users SET banned=?1,banned_at=?2,banned_reason=?3,updated_at=?4
          WHERE identity_user_id=?5
        `).bind(banned?1:0,banned?now:null,banned?reason:null,now,targetId).run();
        await audit(env,ctx.dbUser.identity_user_id,banned?"ban_user":"unban_user",targetId,{reason});
        return json({ok:true,banned});
      }

      m=url.pathname.match(/^\/admin\/users\/([^/]+)\/premium$/);
      if(m&&request.method==="POST"){
        const targetId=decodeURIComponent(m[1]),body=await readJson(request);
        const days=clampInt(body.days,1,3650,0);
        if(!days)return json({ok:false,error:"invalid_days",message:"Informe uma quantidade válida de dias."},400);
        const target=await getUser(env,targetId);
        if(!target)return json({ok:false,error:"not_found",message:"Usuário não encontrado."},404);
        const nowMs=Date.now(),oldMs=target.premium_until?Date.parse(target.premium_until):NaN;
        const baseMs=Number.isFinite(oldMs)&&oldMs>nowMs?oldMs:nowMs;
        const premiumUntil=new Date(baseMs+days*86400000).toISOString(),now=new Date(nowMs).toISOString();
        await env.DB.batch([
          env.DB.prepare(`UPDATE users SET plan='premium',premium_until=?1,updated_at=?2 WHERE identity_user_id=?3`).bind(premiumUntil,now,targetId),
          env.DB.prepare(`INSERT INTO subscriptions(id,user_id,source,days_added,starts_at,ends_at,status,created_at) VALUES (?1,?2,'admin',?3,?4,?5,'active',?4)`).bind("sub_"+crypto.randomUUID(),targetId,days,now,premiumUntil),
          env.DB.prepare(`INSERT INTO admin_audit(admin_user_id,action,target_user_id,details_json,created_at) VALUES (?1,'add_premium_days',?2,?3,?4)`).bind(ctx.dbUser.identity_user_id,targetId,JSON.stringify({days,premiumUntil}),now)
        ]);
        return json({ok:true,plan:"premium",premium_until:premiumUntil,days_added:days});
      }

      m=url.pathname.match(/^\/admin\/users\/([^/]+)\/premium\/revoke$/);
      if(m&&request.method==="POST"){
        const targetId=decodeURIComponent(m[1]);
        if(!await getUser(env,targetId))return json({ok:false,error:"not_found",message:"Usuário não encontrado."},404);
        const now=new Date().toISOString();
        await env.DB.prepare(`UPDATE users SET plan='free',premium_until=NULL,updated_at=?1 WHERE identity_user_id=?2`).bind(now,targetId).run();
        await audit(env,ctx.dbUser.identity_user_id,"revoke_premium",targetId,{});
        return json({ok:true,plan:"free",premium_until:null});
      }

      if(url.pathname==="/admin/payments"&&request.method==="GET"){
        const status=String(url.searchParams.get("status")||"").trim();
        const limit=clampInt(url.searchParams.get("limit"),1,100,60),offset=clampInt(url.searchParams.get("offset"),0,1000000,0);
        const result=await env.DB.prepare(`
          SELECT p.*,u.email,u.name,
            CASE WHEN p.status='pending' AND p.updated_at<>p.created_at THEN 1 ELSE 0 END AS reported_paid
          FROM payments p LEFT JOIN users u ON u.identity_user_id=p.user_id
          WHERE (?1='' OR p.status=?1)
          ORDER BY datetime(p.created_at) DESC
          LIMIT ?2 OFFSET ?3
        `).bind(status,limit,offset).all();
        return json({ok:true,payments:result.results||[],limit,offset});
      }

      m=url.pathname.match(/^\/admin\/payments\/([^/]+)\/approve$/);
      if(m&&request.method==="POST"){
        const paymentId=decodeURIComponent(m[1]);
        const payment=await env.DB.prepare(`SELECT * FROM payments WHERE id=?1 LIMIT 1`).bind(paymentId).first();
        if(!payment)return json({ok:false,error:"not_found",message:"Pagamento não encontrado."},404);
        if(payment.status!=="pending")return json({ok:false,error:"invalid_status",message:"Este pagamento não está pendente."},400);
        const target=await getUser(env,payment.user_id);
        if(!target)return json({ok:false,error:"user_not_found",message:"Usuário do pagamento não foi encontrado."},404);
        const days=Math.max(0,Number(payment.days_purchased||0)),nowMs=Date.now(),now=new Date(nowMs).toISOString();
        const oldMs=target.premium_until?Date.parse(target.premium_until):NaN,baseMs=Number.isFinite(oldMs)&&oldMs>nowMs?oldMs:nowMs;
        const premiumUntil=days>0?new Date(baseMs+days*86400000).toISOString():target.premium_until;
        const statements=[
          env.DB.prepare(`UPDATE payments SET status='paid',updated_at=?1 WHERE id=?2`).bind(now,paymentId),
          env.DB.prepare(`INSERT INTO admin_audit(admin_user_id,action,target_user_id,details_json,created_at) VALUES (?1,'approve_payment',?2,?3,?4)`).bind(ctx.dbUser.identity_user_id,payment.user_id,JSON.stringify({paymentId,days}),now)
        ];
        if(days>0){
          statements.push(
            env.DB.prepare(`UPDATE users SET plan='premium',premium_until=?1,updated_at=?2 WHERE identity_user_id=?3`).bind(premiumUntil,now,payment.user_id),
            env.DB.prepare(`INSERT INTO subscriptions(id,user_id,source,days_added,starts_at,ends_at,status,created_at) VALUES (?1,?2,'payment',?3,?4,?5,'active',?4)`).bind("sub_"+crypto.randomUUID(),payment.user_id,days,now,premiumUntil)
          );
        }
        await env.DB.batch(statements);
        return json({ok:true,status:"paid",premium_until:premiumUntil});
      }

      m=url.pathname.match(/^\/admin\/payments\/([^/]+)\/reject$/);
      if(m&&request.method==="POST"){
        const paymentId=decodeURIComponent(m[1]);
        const payment=await env.DB.prepare(`SELECT * FROM payments WHERE id=?1 LIMIT 1`).bind(paymentId).first();
        if(!payment)return json({ok:false,error:"not_found",message:"Pagamento não encontrado."},404);
        if(payment.status!=="pending")return json({ok:false,error:"invalid_status",message:"Este pagamento não está pendente."},400);
        const now=new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare(`UPDATE payments SET status='rejected',updated_at=?1 WHERE id=?2`).bind(now,paymentId),
          env.DB.prepare(`INSERT INTO admin_audit(admin_user_id,action,target_user_id,details_json,created_at) VALUES (?1,'reject_payment',?2,?3,?4)`).bind(ctx.dbUser.identity_user_id,payment.user_id,JSON.stringify({paymentId}),now)
        ]);
        return json({ok:true,status:"rejected"});
      }

      // ---------------------------------------------------------------------
      // 1.300.10 · MODELOS DE PORTAS — somente administrador publica/edita.
      // PUT é upsert de propósito: permite ao ADM substituir o modelo embutido
      // door-pivotante-01 sem trocar seu ID, preservando projetos e preferências.
      // ---------------------------------------------------------------------
      if(url.pathname==="/admin/doors/global"&&request.method==="POST"){
        await ensureGlobalDoorModelsSchema(env);
        const body=await readJson(request),checked=sanitizeDoorModel(body?.model);
        if(!checked.ok)return json({ok:false,error:"invalid_door_model",message:checked.message},400);
        const duplicate=await env.DB.prepare(`SELECT id FROM global_door_models WHERE lower(name)=lower(?1) AND active=1 LIMIT 1`).bind(checked.value.name).first();
        if(duplicate)return json({ok:false,error:"door_model_exists",message:"Já existe um modelo de porta oficial com esse nome."},409);
        const id="door_"+crypto.randomUUID();
        const item=await saveGlobalDoorModel(env,ctx.dbUser.identity_user_id,id,checked.value,null);
        await audit(env,ctx.dbUser.identity_user_id,"create_global_door_model",null,{id,name:item.name,revision:item.revision});
        return json({ok:true,item});
      }

      let adminDoorMatch=url.pathname.match(/^\/admin\/doors\/global\/([A-Za-z0-9_-]{1,160})$/);
      if(adminDoorMatch&&request.method==="PUT"){
        await ensureGlobalDoorModelsSchema(env);
        const id=adminDoorMatch[1],body=await readJson(request),checked=sanitizeDoorModel(body?.model);
        if(!checked.ok)return json({ok:false,error:"invalid_door_model",message:checked.message},400);
        const existing=await env.DB.prepare(`SELECT * FROM global_door_models WHERE id=?1 LIMIT 1`).bind(id).first();
        const duplicate=await env.DB.prepare(`SELECT id FROM global_door_models WHERE lower(name)=lower(?1) AND id<>?2 AND active=1 LIMIT 1`).bind(checked.value.name,id).first();
        if(duplicate)return json({ok:false,error:"door_model_exists",message:"Já existe outro modelo de porta oficial com esse nome."},409);
        const item=await saveGlobalDoorModel(env,ctx.dbUser.identity_user_id,id,checked.value,existing||null);
        await audit(env,ctx.dbUser.identity_user_id,existing?"update_global_door_model":"override_builtin_door_model",null,{id,name:item.name,revision:item.revision});
        return json({ok:true,item});
      }
      if(adminDoorMatch&&request.method==="DELETE"){
        await ensureGlobalDoorModelsSchema(env);
        const id=adminDoorMatch[1],existing=await env.DB.prepare(`SELECT id,name,r2_key,revision FROM global_door_models WHERE id=?1 LIMIT 1`).bind(id).first();
        if(!existing)return json({ok:true,deleted:true,already_missing:true});
        if(existing.r2_key){
          try{
            const old=await env.PROJECTS.get(existing.r2_key);
            if(old){const stamp=new Date().toISOString().replace(/[:.]/g,'-');await env.PROJECTS.put(`global-door-models/history/${id}/rev-${Number(existing.revision||1)}-${stamp}.json`,await old.arrayBuffer(),{httpMetadata:{contentType:"application/json; charset=UTF-8"}});}
          }catch{}
          try{await env.PROJECTS.delete(existing.r2_key);}catch{}
        }
        await env.DB.prepare(`DELETE FROM global_door_models WHERE id=?1`).bind(id).run();
        await audit(env,ctx.dbUser.identity_user_id,"delete_global_door_model",null,{id,name:existing.name,revision:Number(existing.revision||1)});
        return json({ok:true,deleted:true});
      }

      // ---------------------------------------------------------------------
      // BIBLIOTECA GLOBAL — somente administrador pode criar/apagar.
      // ---------------------------------------------------------------------
      if(url.pathname==="/admin/library/folders"&&request.method==="POST"){
        const body=await readJson(request);
        const name=String(body?.name||"").trim().slice(0,120);
        if(!name)return json({ok:false,error:"invalid_name",message:"Informe o nome da pasta global."},400);

        const duplicate=await env.DB.prepare(`
          SELECT id FROM global_library_folders WHERE lower(name)=lower(?1) LIMIT 1
        `).bind(name).first();
        if(duplicate)return json({ok:false,error:"folder_exists",message:"Já existe uma pasta global com esse nome."},409);

        const id="gf_"+crypto.randomUUID();
        const now=new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO global_library_folders(id,name,created_by,created_at,updated_at)
          VALUES (?1,?2,?3,?4,?4)
        `).bind(id,name,ctx.dbUser.identity_user_id,now).run();
        await audit(env,ctx.dbUser.identity_user_id,"create_global_library_folder",null,{id,name});
        return json({ok:true,folder:{id,name,item_count:0,created_at:now,updated_at:now}});
      }

      let adminGlobalFolderMatch=url.pathname.match(/^\/admin\/library\/folders\/([A-Za-z0-9_-]{1,120})$/);
      if(adminGlobalFolderMatch&&request.method==="DELETE"){
        const folderId=adminGlobalFolderMatch[1];
        const folder=await env.DB.prepare(`
          SELECT id,name FROM global_library_folders WHERE id=?1 LIMIT 1
        `).bind(folderId).first();
        if(!folder)return json({ok:true,deleted:true,already_missing:true});

        const items=await env.DB.prepare(`
          SELECT id,r2_key FROM global_library_items WHERE folder_id=?1
        `).bind(folderId).all();

        await Promise.all((items.results||[]).map(async row=>{
          if(row.r2_key){try{await env.PROJECTS.delete(row.r2_key);}catch{}}
        }));

        const statements=(items.results||[]).map(row=>
          env.DB.prepare(`DELETE FROM global_library_items WHERE id=?1`).bind(row.id)
        );
        statements.push(env.DB.prepare(`DELETE FROM global_library_folders WHERE id=?1`).bind(folderId));
        await env.DB.batch(statements);
        await audit(env,ctx.dbUser.identity_user_id,"delete_global_library_folder",null,{id:folderId,name:folder.name,items:(items.results||[]).length});
        return json({ok:true,deleted:true,items_deleted:(items.results||[]).length});
      }

      if(url.pathname==="/admin/library/items"&&request.method==="POST"){
        const body=await readJson(request);
        const folderId=String(body?.folder_id||"").trim();
        const name=String(body?.name||"").trim().slice(0,160);
        const record=body?.record;
        if(!folderId||!name)return json({ok:false,error:"invalid_data",message:"Informe a pasta e o nome do modelo."},400);
        if(!record||!Array.isArray(record.objects)||!record.objects.length||!Array.isArray(record.spaces)||!record.spaces.length){
          return json({ok:false,error:"invalid_model",message:"O móvel selecionado não possui dados válidos para publicar."},400);
        }

        const folder=await env.DB.prepare(`SELECT id,name FROM global_library_folders WHERE id=?1 LIMIT 1`).bind(folderId).first();
        if(!folder)return json({ok:false,error:"folder_not_found",message:"Pasta global não encontrada."},404);

        const duplicate=await env.DB.prepare(`
          SELECT id FROM global_library_items WHERE folder_id=?1 AND lower(name)=lower(?2) LIMIT 1
        `).bind(folderId,name).first();
        if(duplicate)return json({ok:false,error:"item_exists",message:"Já existe um modelo com esse nome nesta pasta global."},409);

        const id="gm_"+crypto.randomUUID();
        const now=new Date().toISOString();
        const stored={...record,type:"mini-cad-furniture",globalLibrary:true,publishedAt:now,publishedBy:ctx.dbUser.identity_user_id};
        const serialized=JSON.stringify(stored);
        const sizeBytes=new TextEncoder().encode(serialized).byteLength;
        if(sizeBytes>8*1024*1024)return json({ok:false,error:"model_too_large",message:"O modelo ultrapassa o limite de 8 MB da Biblioteca global."},413);

        const r2Key=`global-library/items/${id}.json`;
        await env.PROJECTS.put(r2Key,serialized,{
          httpMetadata:{contentType:"application/json; charset=UTF-8"},
          customMetadata:{global_library:"1",item_id:id,folder_id:folderId,updated_at:now}
        });

        await env.DB.prepare(`
          INSERT INTO global_library_items(id,folder_id,name,r2_key,size_bytes,created_by,created_at,updated_at)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?7)
        `).bind(id,folderId,name,r2Key,sizeBytes,ctx.dbUser.identity_user_id,now).run();
        await env.DB.prepare(`UPDATE global_library_folders SET updated_at=?1 WHERE id=?2`).bind(now,folderId).run();
        await audit(env,ctx.dbUser.identity_user_id,"publish_global_library_item",null,{id,folder_id:folderId,name,size_bytes:sizeBytes});
        return json({ok:true,item:{id,folder_id:folderId,name,size_bytes:sizeBytes,created_at:now,updated_at:now}});
      }

      let adminGlobalItemMatch=url.pathname.match(/^\/admin\/library\/items\/([A-Za-z0-9_-]{1,120})$/);
      if(adminGlobalItemMatch&&request.method==="DELETE"){
        const itemId=adminGlobalItemMatch[1];
        const item=await env.DB.prepare(`
          SELECT id,folder_id,name,r2_key FROM global_library_items WHERE id=?1 LIMIT 1
        `).bind(itemId).first();
        if(!item)return json({ok:true,deleted:true,already_missing:true});

        if(item.r2_key){try{await env.PROJECTS.delete(item.r2_key);}catch{}}
        const now=new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM global_library_items WHERE id=?1`).bind(itemId),
          env.DB.prepare(`UPDATE global_library_folders SET updated_at=?1 WHERE id=?2`).bind(now,item.folder_id)
        ]);
        await audit(env,ctx.dbUser.identity_user_id,"delete_global_library_item",null,{id:itemId,folder_id:item.folder_id,name:item.name});
        return json({ok:true,deleted:true});
      }

      // ---------------------------------------------------------------------
      // FORMAS GLOBAIS — somente administrador publica/edita/exclui.
      // ---------------------------------------------------------------------
      if(url.pathname==="/admin/shapes/global"&&request.method==="POST"){
        const body=await readJson(request),preset=sanitizeShapePreset(body?.preset);
        if(!preset.ok)return json({ok:false,error:"invalid_shape",message:preset.message},400);
        const duplicate=await env.DB.prepare(`SELECT id FROM global_shape_presets WHERE lower(name)=lower(?1) LIMIT 1`).bind(preset.value.name).first();
        if(duplicate)return json({ok:false,error:"shape_exists",message:"Já existe uma Forma global com esse nome."},409);
        const id="gs_"+crypto.randomUUID(),now=new Date().toISOString(),stored={...preset.value,id,global:true};
        await env.DB.prepare(`INSERT INTO global_shape_presets(id,name,preset_json,created_by,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?5)`).bind(id,stored.name,JSON.stringify(stored),ctx.dbUser.identity_user_id,now).run();
        await audit(env,ctx.dbUser.identity_user_id,"create_global_shape",null,{id,name:stored.name});
        return json({ok:true,item:{...stored,created_at:now,updated_at:now}});
      }
      let adminGlobalShapeMatch=url.pathname.match(/^\/admin\/shapes\/global\/([A-Za-z0-9_-]{1,160})$/);
      if(adminGlobalShapeMatch&&request.method==="PUT"){
        const id=adminGlobalShapeMatch[1],body=await readJson(request),preset=sanitizeShapePreset(body?.preset);
        if(!preset.ok)return json({ok:false,error:"invalid_shape",message:preset.message},400);
        const existing=await env.DB.prepare(`SELECT id FROM global_shape_presets WHERE id=?1 LIMIT 1`).bind(id).first();
        if(!existing)return json({ok:false,error:"not_found",message:"Forma global não encontrada."},404);
        const duplicate=await env.DB.prepare(`SELECT id FROM global_shape_presets WHERE lower(name)=lower(?1) AND id<>?2 LIMIT 1`).bind(preset.value.name,id).first();
        if(duplicate)return json({ok:false,error:"shape_exists",message:"Já existe outra Forma global com esse nome."},409);
        const now=new Date().toISOString(),stored={...preset.value,id,global:true};
        await env.DB.prepare(`UPDATE global_shape_presets SET name=?1,preset_json=?2,updated_at=?3 WHERE id=?4`).bind(stored.name,JSON.stringify(stored),now,id).run();
        await audit(env,ctx.dbUser.identity_user_id,"update_global_shape",null,{id,name:stored.name});
        return json({ok:true,item:{...stored,updated_at:now}});
      }
      if(adminGlobalShapeMatch&&request.method==="DELETE"){
        const id=adminGlobalShapeMatch[1],existing=await env.DB.prepare(`SELECT id,name FROM global_shape_presets WHERE id=?1 LIMIT 1`).bind(id).first();
        if(!existing)return json({ok:true,deleted:true,already_missing:true});
        await env.DB.prepare(`DELETE FROM global_shape_presets WHERE id=?1`).bind(id).run();
        await audit(env,ctx.dbUser.identity_user_id,"delete_global_shape",null,{id,name:existing.name});
        return json({ok:true,deleted:true});
      }

      // ---------------------------------------------------------------------
      // FERRAGENS GLOBAIS — somente administrador publica/edita/exclui.
      // ---------------------------------------------------------------------
      if(url.pathname==="/admin/hardware/global"&&request.method==="POST"){
        const body=await readJson(request),preset=sanitizeHardwarePreset(body?.preset);
        if(!preset.ok)return json({ok:false,error:"invalid_hardware",message:preset.message},400);
        const duplicate=await env.DB.prepare(`SELECT id FROM global_hardware_presets WHERE lower(name)=lower(?1) LIMIT 1`).bind(preset.value.name).first();
        if(duplicate)return json({ok:false,error:"hardware_exists",message:"Já existe uma Ferragem global com esse nome."},409);
        const id="gh_"+crypto.randomUUID(),now=new Date().toISOString();
        const stored={...preset.value,id,global:true};
        await env.DB.prepare(`
          INSERT INTO global_hardware_presets(id,name,preset_json,created_by,created_at,updated_at)
          VALUES (?1,?2,?3,?4,?5,?5)
        `).bind(id,stored.name,JSON.stringify(stored),ctx.dbUser.identity_user_id,now).run();
        await audit(env,ctx.dbUser.identity_user_id,"create_global_hardware",null,{id,name:stored.name});
        return json({ok:true,item:{...stored,created_at:now,updated_at:now}});
      }

      let adminGlobalHardwareMatch=url.pathname.match(/^\/admin\/hardware\/global\/([A-Za-z0-9_-]{1,160})$/);
      if(adminGlobalHardwareMatch&&request.method==="PUT"){
        const id=adminGlobalHardwareMatch[1],body=await readJson(request),preset=sanitizeHardwarePreset(body?.preset);
        if(!preset.ok)return json({ok:false,error:"invalid_hardware",message:preset.message},400);
        const existing=await env.DB.prepare(`SELECT id FROM global_hardware_presets WHERE id=?1 LIMIT 1`).bind(id).first();
        if(!existing)return json({ok:false,error:"not_found",message:"Ferragem global não encontrada."},404);
        const duplicate=await env.DB.prepare(`SELECT id FROM global_hardware_presets WHERE lower(name)=lower(?1) AND id<>?2 LIMIT 1`).bind(preset.value.name,id).first();
        if(duplicate)return json({ok:false,error:"hardware_exists",message:"Já existe outra Ferragem global com esse nome."},409);
        const now=new Date().toISOString(),stored={...preset.value,id,global:true};
        await env.DB.prepare(`UPDATE global_hardware_presets SET name=?1,preset_json=?2,updated_at=?3 WHERE id=?4`).bind(stored.name,JSON.stringify(stored),now,id).run();
        await audit(env,ctx.dbUser.identity_user_id,"update_global_hardware",null,{id,name:stored.name});
        return json({ok:true,item:{...stored,updated_at:now}});
      }
      if(adminGlobalHardwareMatch&&request.method==="DELETE"){
        const id=adminGlobalHardwareMatch[1];
        const existing=await env.DB.prepare(`SELECT id,name FROM global_hardware_presets WHERE id=?1 LIMIT 1`).bind(id).first();
        if(!existing)return json({ok:true,deleted:true,already_missing:true});
        await env.DB.prepare(`DELETE FROM global_hardware_presets WHERE id=?1`).bind(id).run();
        await audit(env,ctx.dbUser.identity_user_id,"delete_global_hardware",null,{id,name:existing.name});
        return json({ok:true,deleted:true});
      }

      return json({ok:false,error:"not_found",message:"Rota administrativa não encontrada."},404);
    }

    return json({ok:false,error:"not_found",message:"Rota não encontrada."},404);
  }
};


async function ensureGlobalDoorModelsSchema(env){
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS global_door_models(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'porta',
      description TEXT NOT NULL DEFAULT '',
      reference_width_mm REAL NOT NULL,
      reference_height_mm REAL NOT NULL,
      reference_depth_mm REAL NOT NULL,
      production_oversize_mm REAL NOT NULL DEFAULT 15,
      face_part_ids_json TEXT NOT NULL DEFAULT '[]',
      rules_json TEXT NOT NULL DEFAULT '{}',
      r2_key TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      part_count INTEGER NOT NULL DEFAULT 0,
      face_count INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_global_door_models_name ON global_door_models(name)`)
  ]);
}
function publicDoorModelRow(row){
  let faces=[],rules={};try{faces=JSON.parse(row?.face_part_ids_json||'[]');}catch{}try{rules=JSON.parse(row?.rules_json||'{}');}catch{}
  return {
    id:String(row?.id||''),name:String(row?.name||''),kind:String(row?.kind||'porta'),description:String(row?.description||''),
    reference:{widthMm:Number(row?.reference_width_mm)||0,heightMm:Number(row?.reference_height_mm)||0,depthMm:Number(row?.reference_depth_mm)||0},
    productionOversizeMm:Number(row?.production_oversize_mm)||0,facePartIds:Array.isArray(faces)?faces:[],rules:rules&&typeof rules==='object'?rules:{},
    part_count:Number(row?.part_count||0),face_count:Number(row?.face_count||0),revision:Number(row?.revision||1),active:!!Number(row?.active),
    global:true,created_at:row?.created_at||null,updated_at:row?.updated_at||null
  };
}
function sanitizeDoorModel(raw){
  if(!raw||typeof raw!=="object")return {ok:false,message:"Dados do modelo de porta ausentes."};
  const record=raw.record;
  if(!record||!Array.isArray(record.objects)||!record.objects.length||!Array.isArray(record.spaces)||!record.spaces.length)return {ok:false,message:"O espaço selecionado não contém um modelo de porta válido."};
  const name=String(raw.name||record.name||"").trim().slice(0,120);if(!name)return {ok:false,message:"Informe o nome do modelo de porta."};
  const kind=String(raw.kind||"porta").trim().slice(0,60)||"porta",description=String(raw.description||"").trim().slice(0,500);
  const sp=record.spaces[0]||{},refRaw=raw.reference||{};
  const widthMm=Number(refRaw.widthMm)||Number(sp.width)*1000,heightMm=Number(refRaw.heightMm)||Number(sp.height)*1000,depthMm=Number(refRaw.depthMm)||Number(sp.depth)*1000;
  if(![widthMm,heightMm,depthMm].every(Number.isFinite)||widthMm<=20||heightMm<=20||depthMm<=1)return {ok:false,message:"As medidas de referência do modelo são inválidas."};
  const faceSet=new Set((raw.facePartIds||[]).map(String));
  const partIds=new Set(record.objects.map(p=>String(p?.partId||'')).filter(Boolean));
  const facePartIds=[...faceSet].filter(id=>partIds.has(id)).slice(0,8);
  if(facePartIds.length<2)return {ok:false,message:"O modelo precisa identificar pelo menos as duas faces da Folha Porta."};
  const over=Math.max(0,Math.min(100,Number(raw.productionOversizeMm)||0));
  const rules=raw.rules&&typeof raw.rules==='object'&&!Array.isArray(raw.rules)?raw.rules:{};
  return {ok:true,value:{name,kind,description,reference:{widthMm,heightMm,depthMm},productionOversizeMm:over,facePartIds,rules,record}};
}
async function saveGlobalDoorModel(env,adminId,id,model,existing){
  const now=new Date().toISOString(),revision=Number(existing?.revision||0)+1,r2Key=`global-door-models/${id}.json`;
  if(existing?.r2_key){
    try{
      const old=await env.PROJECTS.get(existing.r2_key);
      if(old){const stamp=now.replace(/[:.]/g,'-');await env.PROJECTS.put(`global-door-models/history/${id}/rev-${Number(existing.revision||1)}-${stamp}.json`,await old.arrayBuffer(),{httpMetadata:{contentType:"application/json; charset=UTF-8"}});}
    }catch{}
  }
  const serialized=JSON.stringify(model.record),sizeBytes=new TextEncoder().encode(serialized).byteLength;
  if(sizeBytes>8*1024*1024)throw new Error("O modelo de porta ultrapassa o limite de 8 MB.");
  await env.PROJECTS.put(r2Key,serialized,{httpMetadata:{contentType:"application/json; charset=UTF-8"},customMetadata:{global_door_model:"1",model_id:id,revision:String(revision),updated_at:now}});
  const createdAt=existing?.created_at||now,createdBy=existing?.created_by||adminId;
  await env.DB.prepare(`
    INSERT INTO global_door_models(
      id,name,kind,description,reference_width_mm,reference_height_mm,reference_depth_mm,production_oversize_mm,
      face_part_ids_json,rules_json,r2_key,size_bytes,part_count,face_count,revision,active,created_by,updated_by,created_at,updated_at
    ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,1,?16,?17,?18,?19)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,kind=excluded.kind,description=excluded.description,
      reference_width_mm=excluded.reference_width_mm,reference_height_mm=excluded.reference_height_mm,reference_depth_mm=excluded.reference_depth_mm,
      production_oversize_mm=excluded.production_oversize_mm,face_part_ids_json=excluded.face_part_ids_json,rules_json=excluded.rules_json,
      r2_key=excluded.r2_key,size_bytes=excluded.size_bytes,part_count=excluded.part_count,face_count=excluded.face_count,
      revision=excluded.revision,active=1,updated_by=excluded.updated_by,updated_at=excluded.updated_at
  `).bind(id,model.name,model.kind,model.description,model.reference.widthMm,model.reference.heightMm,model.reference.depthMm,model.productionOversizeMm,JSON.stringify(model.facePartIds),JSON.stringify(model.rules||{}),r2Key,sizeBytes,model.record.objects.length,model.facePartIds.length,revision,createdBy,adminId,createdAt,now).run();
  const row=await env.DB.prepare(`SELECT * FROM global_door_models WHERE id=?1 LIMIT 1`).bind(id).first();return publicDoorModelRow(row);
}

function sanitizeShapePreset(raw){
  if(!raw||typeof raw!=="object")return {ok:false,message:"Dados da Forma ausentes."};
  const name=String(raw.name||"").trim().slice(0,120),folder=String(raw.folder||"Formas").trim().slice(0,80)||"Formas",type=["piece-format","custom-profile","round-corner"].includes(raw.type)?raw.type:"piece-format";
  if(!name)return {ok:false,message:"Informe o nome da Forma."};
  const clean={name,folder,type};
  if(type==="piece-format"){
    const c=raw.formatConfig||raw.config||{},fmt=["rectangle","ellipse","circle","l-top","cut-corners","rounded-rect","chamfered"].includes(c.format)?c.format:"rectangle",num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};
    clean.formatConfig={format:fmt,width:Math.max(1,num(c.width,800)),height:Math.max(1,num(c.height,500)),cutW:Math.max(.1,num(c.cutW,200)),cutH:Math.max(.1,num(c.cutH,125)),lCorner:["tl","tr","bl","br"].includes(c.lCorner)?c.lCorner:"tr",cutX:Math.max(.1,num(c.cutX,60)),cutY:Math.max(.1,num(c.cutY,60)),corners:Array.isArray(c.corners)?c.corners.filter(x=>["tl","tr","bl","br"].includes(x)).slice(0,4):[],radius:Math.max(.1,num(c.radius,50))};
    if(raw.cornerEdits&&typeof raw.cornerEdits==="object")clean.cornerEdits=raw.cornerEdits;
  }else if(type==="custom-profile"){
    const points=Array.isArray(raw.sketchPoints)?raw.sketchPoints:Array.isArray(raw.profileNormalized)?raw.profileNormalized:null;if(!points||points.length<2)return {ok:false,message:"A Forma global precisa ter um esboço válido."};
    const cleanPts=points.slice(0,500).map(p=>[Number(p?.[0])||0,Number(p?.[1])||0]);if(Array.isArray(raw.sketchPoints)){clean.sketchPoints=cleanPts;clean.sketchW=Math.max(.001,Number(raw.sketchW)||1);clean.sketchH=Math.max(.001,Number(raw.sketchH)||1);}else clean.profileNormalized=cleanPts;clean.closed=raw.closed!==false;clean.profileVersion=2;clean.operation=raw.operation==="edge-profile"?"edge-profile":"cutout";
  }else clean.radius=Math.max(.1,Number(raw.radius)||50);
  return {ok:true,value:clean};
}

function sanitizeHardwarePreset(raw){
  if(!raw||typeof raw!=="object")return {ok:false,message:"Dados da ferragem ausentes."};
  const name=String(raw.name||"").trim().slice(0,120);
  const contactAxis=["auto","x","y","z"].includes(raw.contactAxis)?raw.contactAxis:"auto";
  const contactSide=["both","negative","positive"].includes(raw.contactSide)?raw.contactSide:"both";
  const bMode=["single","ends","series"].includes(raw.bMode)?raw.bMode:"single";
  const anchor=v=>["start","center","end"].includes(v)?v:"center";
  const num=(v,def=0)=>{const n=Number(v);return Number.isFinite(n)?n:def;};
  const bool=v=>!!v;
  const value={
    id:String(raw.id||""),name,contactAxis,contactSide,
    tolerance:Math.max(0,Math.min(20,num(raw.tolerance,2))),
    aAnchor:anchor(raw.aAnchor),aOffset:num(raw.aOffset,0),
    bMode,bAnchor:anchor(raw.bAnchor),bOffset:num(raw.bOffset,50),bEdge:Math.max(0,num(raw.bEdge,50)),
    bSeriesAnchor:anchor(raw.bSeriesAnchor),bSeriesOffset:num(raw.bSeriesOffset,50),
    bSeriesCount:Math.max(1,Math.min(100,Math.trunc(num(raw.bSeriesCount,2)))),
    bSeriesStep:Math.max(.001,num(raw.bSeriesStep,100)),bSeriesDirection:num(raw.bSeriesDirection,1)<0?-1:1,
    sourceEnabled:bool(raw.sourceEnabled),sourceDiameter:Math.max(.1,num(raw.sourceDiameter,8)),sourceDepth:Math.max(.1,num(raw.sourceDepth,20)),
    targetEnabled:bool(raw.targetEnabled),targetDiameter:Math.max(.1,num(raw.targetDiameter,5)),targetDepth:Math.max(.1,num(raw.targetDepth,10))
  };
  if(!name)return {ok:false,message:"Informe o nome da ferragem."};
  if(!value.sourceEnabled&&!value.targetEnabled)return {ok:false,message:"A ferragem precisa furar pelo menos uma das peças."};
  return {ok:true,value};
}

// ---------------------------------------------------------------------------
// 1.100.92 · LICENÇA PREMIUM OFFLINE ASSINADA
// ---------------------------------------------------------------------------
// Configure no Worker uma Secret chamada OFFLINE_LICENSE_PRIVATE_PKCS8.
// O valor é a chave privada P-256 em PKCS#8 DER codificada em Base64.
// A chave pública correspondente fica embutida no app. NUNCA coloque a chave
// privada no Netlify, Git público ou em qualquer arquivo servido pelo site.
const OFFLINE_LICENSE_KID="dlm-2026-09-p256-01";
const OFFLINE_LICENSE_RECHECK_MS=24*60*60*1000;
const OFFLINE_LICENSE_MAX_OFFLINE_MS=72*60*60*1000;
let offlinePremiumPrivateKeyCache=null;
let offlinePremiumPrivateKeySecret="";
function bytesToBase64Url(bytes){
  let s="";const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function base64ToBytes(raw){
  const s=String(raw||"").replace(/\s+/g,"");
  const bin=atob(s);const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
}
async function offlinePremiumPrivateKey(env){
  const secret=String(env.OFFLINE_LICENSE_PRIVATE_PKCS8||"").trim();
  if(!secret)throw new Error("offline_license_secret_missing");
  if(offlinePremiumPrivateKeyCache&&offlinePremiumPrivateKeySecret===secret)return offlinePremiumPrivateKeyCache;
  const key=await crypto.subtle.importKey(
    "pkcs8",base64ToBytes(secret),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]
  );
  offlinePremiumPrivateKeySecret=secret;offlinePremiumPrivateKeyCache=key;return key;
}
async function issueOfflinePremiumLicense(env,row){
  const role=String(row?.role||"user");
  const admin=role==="admin";
  const nowMs=Date.now();
  let entitlementUntilMs=admin?nowMs+OFFLINE_LICENSE_MAX_OFFLINE_MS:Date.parse(String(row?.premium_until||""));
  if(!admin&&(!Number.isFinite(entitlementUntilMs)||entitlementUntilMs<=nowMs))return null;
  const offlineUntilMs=Math.min(nowMs+OFFLINE_LICENSE_MAX_OFFLINE_MS,entitlementUntilMs);
  if(offlineUntilMs<=nowMs)return null;
  const recheckAfterMs=Math.min(nowMs+OFFLINE_LICENSE_RECHECK_MS,offlineUntilMs);
  const header={alg:"ES256",typ:"DLM-OFFLINE",kid:OFFLINE_LICENSE_KID};
  const payload={
    v:1,iss:"designlabmoveis-api",aud:"designlabmoveis",sub:String(row.identity_user_id||""),
    email:String(row.email||""),name:String(row.name||""),role,premium:true,
    iat:Math.floor(nowMs/1000),recheck_after:Math.floor(recheckAfterMs/1000),
    offline_until:Math.floor(offlineUntilMs/1000),premium_until:admin?null:(row.premium_until||null)
  };
  const enc=new TextEncoder();
  const h=bytesToBase64Url(enc.encode(JSON.stringify(header)));
  const p=bytesToBase64Url(enc.encode(JSON.stringify(payload)));
  const input=h+"."+p;
  const key=await offlinePremiumPrivateKey(env);
  const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,enc.encode(input));
  return {token:input+"."+bytesToBase64Url(sig),kid:OFFLINE_LICENSE_KID,recheck_after:new Date(recheckAfterMs).toISOString(),offline_until:new Date(offlineUntilMs).toISOString()};
}

function clampInt(v,min,max,fallback){const n=Math.trunc(Number(v));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
async function readJson(request){try{return await request.json();}catch{return {};}}
function publicUser(row){return {id:row.identity_user_id,email:row.email,name:row.name,role:row.role,access_role:row.role==='admin'?'admin':row.access_role,access_status:row.role==='admin'?'approved':row.access_status,banned:!!Number(row.banned)};}
function isPremiumActive(row){if(row?.plan!=="premium"||!row?.premium_until)return false;const t=Date.parse(row.premium_until);return Number.isFinite(t)&&t>Date.now();}
function subscriptionView(row,trial=null){
  const active=isPremiumActive(row);
  return {
    plan:active?"premium":"free",
    premium_active:active,
    premium_until:row?.premium_until||null,
    trial_active:!!(active&&trial),
    trial_started_at:trial?.starts_at||null,
    trial_ends_at:trial?.ends_at||null
  };
}
async function getSettingInt(env,key,fallback,min=0,max=3650){
  try{
    const row=await env.DB.prepare(`SELECT value FROM app_settings WHERE key=?1 LIMIT 1`).bind(key).first();
    const n=Math.trunc(Number(row?.value));
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  }catch{
    return fallback;
  }
}
async function getSettingText(env,key,fallback=""){
  try{
    const row=await env.DB.prepare(`SELECT value FROM app_settings WHERE key=?1 LIMIT 1`).bind(key).first();
    return row?.value==null?String(fallback??""):String(row.value);
  }catch{return String(fallback??"");}
}
async function getPaymentSettings(env){
  const [premium_price_cents,premium_days,payment_provider,pix_key,pix_receiver_name,pix_receiver_city]=await Promise.all([
    getSettingInt(env,"premium_price_cents",2999,100,999900),
    getSettingInt(env,"premium_days",30,1,3650),
    getSettingText(env,"payment_provider",String(env.PAYMENT_PROVIDER||"manual_pix")),
    getSettingText(env,"pix_key",String(env.PIX_KEY||"")),
    getSettingText(env,"pix_receiver_name",String(env.PIX_RECEIVER_NAME||"")),
    getSettingText(env,"pix_receiver_city",String(env.PIX_RECEIVER_CITY||""))
  ]);
  return {premium_price_cents,premium_days,payment_provider:payment_provider||"manual_pix",pix_key,pix_receiver_name,pix_receiver_city};
}
function crc16Ccitt(text){
  let crc=0xFFFF;
  for(let i=0;i<text.length;i++){crc^=text.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xFFFF:(crc<<1)&0xFFFF;}
  return crc.toString(16).toUpperCase().padStart(4,"0");
}
function pixEmv(id,value){const v=String(value==null?"":value);return String(id).padStart(2,"0")+String(v.length).padStart(2,"0")+v;}
function pixText(value,max){
  let s=String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  s=s.replace(/[^A-Z0-9 .\-]/g," ").replace(/\s+/g," ").trim();return s.slice(0,max);
}
function paymentTxid(paymentId){return ("DLM"+String(paymentId||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase()).slice(0,25)||"DLM***";}
function buildPixPayload(settings,amountCents,txid){
  const key=String(settings.pix_key||"").trim(),receiver=pixText(settings.pix_receiver_name||"",25),city=pixText(settings.pix_receiver_city||"",15);
  if(!key||!receiver||!city)throw new Error("pix_not_configured");
  const merchantAccount=pixEmv("26",pixEmv("00","BR.GOV.BCB.PIX")+pixEmv("01",key));
  const amount=(Number(amountCents)/100).toFixed(2),additional=pixEmv("62",pixEmv("05",String(txid||"***").slice(0,25)));
  let payload=pixEmv("00","01")+merchantAccount+pixEmv("52","0000")+pixEmv("53","986")+pixEmv("54",amount)+pixEmv("58","BR")+pixEmv("59",receiver)+pixEmv("60",city)+additional+"6304";
  return payload+crc16Ccitt(payload);
}

async function getActiveTrial(env,userId){
  try{
    return await env.DB.prepare(`
      SELECT id,starts_at,ends_at,status
      FROM subscriptions
      WHERE user_id=?1
        AND source='trial'
        AND datetime(ends_at)>datetime('now')
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).bind(userId).first();
  }catch{
    return null;
  }
}
async function grantFreeTrialIfNew(env,userId,identityCreatedAt,nowIso){
  const days=await getSettingInt(env,"free_trial_days",15,0,365);
  if(days<=0)return null;

  const nowMs=Date.parse(nowIso);
  const createdMs=Date.parse(String(identityCreatedAt||""));
  const startMs=Number.isFinite(createdMs)?createdMs:nowMs;
  const endMs=startMs + days*86400000;
  const startIso=new Date(startMs).toISOString();
  const endIso=new Date(endMs).toISOString();
  const active=endMs>nowMs;

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE users
      SET plan=?1,
          premium_until=?2,
          updated_at=?3
      WHERE identity_user_id=?4
    `).bind(active?"premium":"free",endIso,nowIso,userId),
    env.DB.prepare(`
      INSERT INTO subscriptions
        (id,user_id,source,days_added,starts_at,ends_at,status,created_at)
      VALUES (?1,?2,'trial',?3,?4,?5,?6,?7)
    `).bind(
      "trial_"+crypto.randomUUID(),
      userId,
      days,
      startIso,
      endIso,
      active?"active":"expired",
      nowIso
    )
  ]);

  return {days,starts_at:startIso,ends_at:endIso,active};
}

async function getUser(env,id){
  return await env.DB.prepare(`SELECT identity_user_id,email,name,role,access_role,access_status,plan,premium_until,banned,banned_at,banned_reason,created_at,updated_at,last_login_at FROM users WHERE identity_user_id=?1 LIMIT 1`).bind(id).first();
}
async function audit(env,adminId,action,targetId,details){
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO admin_audit(admin_user_id,action,target_user_id,details_json,created_at) VALUES (?1,?2,?3,?4,?5)`).bind(adminId,action,targetId||null,JSON.stringify(details||{}),now).run();
}
async function authenticateAndSync(request,env,siteUrl){
  const authHeader=request.headers.get("Authorization")||"";
  if(!authHeader.startsWith("Bearer "))return {ok:false,status:401,body:{ok:false,error:"unauthorized",message:"Usuário não autenticado."}};
  const token=authHeader.slice(7).trim();
  if(!token)return {ok:false,status:401,body:{ok:false,error:"unauthorized",message:"Token ausente."}};
  let identityUser;
  try{
    const response=await fetch(siteUrl+"/.netlify/identity/user",{method:"GET",headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});
    if(!response.ok)return {ok:false,status:401,body:{ok:false,error:"invalid_token",message:"Sessão inválida ou expirada."}};
    identityUser=await response.json();
  }catch{
    return {ok:false,status:502,body:{ok:false,error:"identity_unavailable",message:"Não foi possível consultar o Netlify Identity."}};
  }
  const userId=String(identityUser.id||"").trim(),email=String(identityUser.email||"").trim();
  const meta=identityUser.user_metadata||identityUser.data||{};
  const name=String(meta.full_name||meta.name||email.split("@")[0]||"Usuário").trim();
  if(!userId||!email)return {ok:false,status:401,body:{ok:false,error:"invalid_identity_user",message:"Usuário do Identity inválido."}};
  const now=new Date().toISOString();
  const existingUser=await getUser(env,userId);

  await env.DB.prepare(`
    INSERT INTO users(identity_user_id,email,name,created_at,updated_at,last_login_at)
    VALUES (?1,?2,?3,?4,?4,?4)
    ON CONFLICT(identity_user_id)
    DO UPDATE SET
      email=excluded.email,
      name=excluded.name,
      updated_at=excluded.updated_at,
      last_login_at=excluded.last_login_at
  `).bind(userId,email,name,now).run();

  // Teste grátis é concedido SOMENTE no primeiro cadastro do usuário no D1.
  // O início usa created_at do Netlify quando disponível, evitando reiniciar
  // o teste apenas porque o usuário demorou para fazer o primeiro login.
  if(!existingUser){
    await grantFreeTrialIfNew(env,userId,identityUser.created_at,now);
  }

  const dbUser=await getUser(env,userId);
  return {ok:true,ctx:{identityUser,dbUser}};
}
