// DesignLabMoveis 1.310.00 · projetos, salvamento local e sincronização de projetos.
export function createProjectsModule(ctx){
  const { $, DESIGNLAB_APP_VERSION, STORAGE_KEY, LEGACY_STORAGE_KEY_V22, LEGACY_STORAGE_KEY_V18, LEGACY_STORAGE_KEY_V15, LEGACY_STORAGE_KEY, LEGACY_STORAGE_KEY_V13, LEGACY_STORAGE_KEY_V12, LEGACY_STORAGE_KEY_V11, LEGACY_STORAGE_KEY_V10, LEGACY_STORAGE_KEY_V9, activeSpaceRoot, applyState, authUserName, captureState, clearScene, closeCopyHardwareTool, closeCopyShapeTool, controls, cloudApiFetch, designLabRouteEnterWorkspace, designLabRouteMarkHomeTop, escapeHtml, frameFurnitureVisual, last3DView, remember3DView, openProductionDialog, orthoCamera, perspectiveCamera, renderer, returnTo3D, scene, setDesignLabVisualizationOnly, setFrontWorldView, setPieceVisualEdgesVisible, setVisualMode, stateString, toast, viewSpace }=ctx;
  const runtimeModel=ctx.runtimeModel;
  // ---- domínio extraído do runtime original: 61-77 ----
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
  // ---- domínio extraído do runtime original: 814-1774 ----
  let cloudProjectsSyncing=false;
  let cloudProjectsLastSync=null;
  
  function projectIsoMs(v){
    const n=Date.parse(String(v||''));
    return Number.isFinite(n)?n:0;
  }
  function cloudProjectBadge(record){
    if(ctx.auth.authLocalMode)return '<span class="projectCloudBadge local">Somente local</span>';
    if(record.cloudSyncedAt && projectIsoMs(record.cloudSyncedAt)>=projectIsoMs(record.updatedAt)){
      return '<span class="projectCloudBadge ok">☁ Nuvem</span>';
    }
    return '<span class="projectCloudBadge pending">☁ Aguardando sincronizar</span>';
  }
  async function cloudSaveProjectRecord(record,{silent=true}={}){
    if(ctx.auth.authLocalMode||!ctx.auth.currentIdentityUser||!ctx.cloudAccountState.ok||!record)return null;
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
    if(ctx.auth.authLocalMode||!ctx.auth.currentIdentityUser||!ctx.cloudAccountState.ok||!id)return false;
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
    if(cloudProjectsSyncing||ctx.auth.authLocalMode||!ctx.auth.currentIdentityUser||!ctx.cloudAccountState.ok)return null;
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
  
    if(ctx.auth.authLocalMode||!ctx.auth.currentIdentityUser){
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
    if(!owner||ctx.auth.authLocalMode)throw new Error('Entre na sua conta para importar');
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
    if(ctx.auth.authLocalMode||!ctx.auth.currentIdentityUser)return;
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
  // 1.200.18 · HOME OPÇÃO 1
  // ============================================================================
  function updateProjectHomeWelcome(){
    const title=$('projectWelcomeTitle');
    if(!title)return;
  
    if(ctx.auth.authLocalMode){
      title.textContent='Olá!';
      return;
    }
    const welcomeUser=ctx.auth.currentIdentityUser||ctx.auth.offlineLicensedUser;
    if(welcomeUser){
      const full=String(authUserName(welcomeUser)||'').trim();
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
    if(ctx.auth.authLocalMode)return 'local-device';
    return String(ctx.auth.currentIdentityUser?.id || ctx.auth.offlineLicensedUser?.id || ctx.cloudAccountState?.user?.id || '').trim();
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
    if(ctx.viewMode2D||ctx.camera===orthoCamera)returnTo3D({restore:false,notify:false});
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
    if(!runtimeModel.objects.length&&!runtimeModel.spaceRoots.length)return null;
    const was2D=ctx.viewMode2D;
    const saved2D=ctx.current2DView;
    const savedRoot=activeSpaceRoot();
    const wasVisual=ctx.visualMode;
    const savedPos=perspectiveCamera.position.clone();
    const savedUp=perspectiveCamera.up.clone();
    const savedTarget=controls.target.clone();
    const savedLast={position:last3DView.position.clone(),up:last3DView.up.clone(),target:last3DView.target.clone()};
    let result=null;
    try{
      if(was2D||ctx.camera===orthoCamera)returnTo3D({restore:true,notify:false});
      if(!ctx.visualMode)setVisualMode(true,{notify:false,frame:true});
      else frameFurnitureVisual();
      setPieceVisualEdgesVisible(false);
      renderer.render(scene,perspectiveCamera);
  
      const src=renderer.domElement,w=720,h=405;
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const c2d=c.getContext('2d');c2d.fillStyle=ctx.cadBackgroundMode==='white'?'#f4f4f4':'#171717';c2d.fillRect(0,0,w,h);
      const scale=Math.min(w/src.width,h/src.height);
      const dw=src.width*scale,dh=src.height*scale;
      c2d.drawImage(src,(w-dw)/2,(h-dh)/2,dw,dh);
      result=c.toDataURL('image/jpeg',.82);
    }catch(err){
      console.warn('Miniatura do projeto:',err);
    }finally{
      setPieceVisualEdgesVisible(true);
      if(!wasVisual&&ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
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
    document.title=currentProjectId?`${name} · DesignLabMoveis ${DESIGNLAB_APP_VERSION}`:`DesignLabMoveis ${DESIGNLAB_APP_VERSION}`;
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
    setDesignLabVisualizationOnly(!!on);
    if(on){
      if(ctx.viewMode2D||ctx.camera===orthoCamera)returnTo3D({restore:true,notify:false});
      if(!ctx.visualMode)setVisualMode(true,{notify:false,frame:false});
      if(frame&&runtimeModel.objects.length)frameFurnitureVisual();
      setPieceVisualEdgesVisible(false);
    }else{
      setPieceVisualEdgesVisible(true);
      if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
    }
  }
  function resetProjectHistory(){
    const snapshot=stateString();ctx.setHistory([snapshot]);ctx.historyIndex=0;
    localStorage.setItem(STORAGE_KEY,snapshot);
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
      if(!restored&&runtimeModel.objects.length)frameFurnitureVisual();
      $('hintText').textContent='Modo Projeto · selecione peças ou divisões para editar';
    }
  }
  function enterProjectEditor(){
    if(typeof designLabRouteEnterWorkspace==='function')designLabRouteEnterWorkspace('editor');
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
    ctx.updateIdentityChrome?.();
  }
  async function showProjectHome({fromHistory=false}={}){
    if(typeof closeCopyHardwareTool==='function')closeCopyHardwareTool(false);
    if(typeof closeCopyShapeTool==='function')closeCopyShapeTool(false);
    await projectAutosaveNow();
    if(document.body.classList.contains('presentation-active'))applyProjectPresentationScene(false);
    document.body.classList.remove('presentation-active');
    document.body.classList.add('project-home-active');
    $('projectHome').style.display='block';
    $('projectMenuPanel').classList.remove('show');
    $('projectCardMenu').classList.remove('show');
    await renderProjectHome();
    if(!fromHistory&&typeof designLabRouteMarkHomeTop==='function')designLabRouteMarkHomeTop();
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
    if(typeof designLabRouteEnterWorkspace==='function')designLabRouteEnterWorkspace('editor');
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
      thumbnail:null,appVersion:DESIGNLAB_APP_VERSION
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
      createdAt:rec.createdAt||now,updatedAt:now,appVersion:DESIGNLAB_APP_VERSION
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
      thumbnail:thumb,appVersion:DESIGNLAB_APP_VERSION
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
      format:'mini-cad-pro-project',formatVersion:1,appVersion:DESIGNLAB_APP_VERSION,exportedAt:projectNow(),
      project:{
        name:record.name||'Projeto',client:record.client||'',environment:record.environment||'',
        createdAt:record.createdAt||projectNow(),updatedAt:record.updatedAt||projectNow(),
        state:record.state||{version:93,objects:[],guides:[],spaces:[]},
        camera:record.camera||null,thumbnail:record.thumbnail||null,
        versions:Array.isArray(record.versions)?record.versions.slice(-10):[]
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
      thumbnail:p.thumbnail||null,versions:Array.isArray(p.versions)?p.versions.slice(-10):[],appVersion:DESIGNLAB_APP_VERSION
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
    if(typeof designLabRouteEnterWorkspace==='function')designLabRouteEnterWorkspace(presentation?'presentation':'editor');
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
      await projectDbPut({id:newProjectId(),name:'Projeto anterior',client:'',environment:'',createdAt:now,updatedAt:now,state,camera:null,thumbnail:null,appVersion:DESIGNLAB_APP_VERSION});
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
  const state={get currentProjectId(){return currentProjectId;}, set currentProjectId(value){currentProjectId=value;},get currentProjectRecord(){return currentProjectRecord;}, set currentProjectRecord(value){currentProjectRecord=value;},get currentProjectDirty(){return currentProjectDirty;}, set currentProjectDirty(value){currentProjectDirty=value;},get suppressProjectDirty(){return suppressProjectDirty;}, set suppressProjectDirty(value){suppressProjectDirty=value;},get pendingRecovery(){return pendingRecovery;}, set pendingRecovery(value){pendingRecovery=value;},get projectMetaMode(){return projectMetaMode;}, set projectMetaMode(value){projectMetaMode=value;},get projectCardMenuId(){return projectCardMenuId;}, set projectCardMenuId(value){projectCardMenuId=value;},get cloudProjectsSyncing(){return cloudProjectsSyncing;}, set cloudProjectsSyncing(value){cloudProjectsSyncing=value;},get cloudProjectsLastSync(){return cloudProjectsLastSync;}, set cloudProjectsLastSync(value){cloudProjectsLastSync=value;}};
  return { state, projectIsoMs, cloudProjectBadge, cloudSaveProjectRecord, cloudDeleteProjectRecord, cloudDownloadProject, syncCloudProjects, renderLegacyProjects, claimLegacyProject, claimAllLegacyProjects, newProjectId, projectNow, projectStateHasContent, projectDateText, projectSlug, openProjectDb, fallbackProjectList, fallbackProjectWrite, updateProjectHomeWelcome, scrollProjectHomeTo, openHomeModeling, openHomeMaterials, projectCurrentOwnerId, projectBelongsToCurrentOwner, projectEmergencyKey, projectRecordCloudClean, prepareProjectAccountSwitch, applyProjectAccountScope, projectDbList, projectDbGet, projectDbPut, projectDbDelete, captureProjectCamera, restoreProjectCamera, captureProjectThumbnail, updateProjectChrome, markCurrentProjectDirty, projectAutosaveNow, clearProjectDraft, applyProjectPresentationScene, resetProjectHistory, loadProjectRecord, enterProjectEditor, renderProjectHome, showProjectHome, openProjectMetaDialog, closeProjectMetaDialog, readProjectMeta, createNewProject, saveCurrentProject, saveAsCurrentProject, renameCurrentProject, duplicateProjectById, deleteProjectById, projectDownload, exportProjectRecordFile, exportCurrentProjectFile, importProjectFile, requestOpenProject, showRecoveryDialog, closeRecoveryDialog, recoverPendingProject, discardPendingRecovery, openProjectCardMenu, closeProjectCardMenu, migrateLegacySingleProject, mergeEmergencyRecovery, checkStartupRecovery, initProjectHub };
}
