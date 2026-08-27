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

  // 1.100.96: montantes estruturais não podem ser posicionados usando a caixa
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

// ---------- 1.100.96 · Etiquetas A4 com margens e espaçamentos independentes ----------
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
      // Migração 1.100.96: o espaçamento antigo passa a representar somente o vão horizontal.
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

// ---------- 1.200.35 · Mini CAD Forma com inferência magnética estilo SketchUp ----------
const shapeCadState={
  tool:'edit',points:[],closed:false,undo:[],redo:[],draft:[],pointer:null,dragIndex:-1,
  current:null,rawCurrent:null,baseW:0,baseH:0,loadedPresetId:null,hoverSnap:null,guides:[],
  lastPointerType:'mouse'
};
function shapeCadOwnerInfo(){const o=shapePreviewOwner||selected,ti=pieceThicknessInfo(o);return {o,ti,W:ti?.faceW||1,H:ti?.faceH||1};}
function shapeCadSnapshot(){return {points:shapeCadState.points.map(p=>[Number(p[0]),Number(p[1])]),closed:!!shapeCadState.closed};}
function shapeCadRestoreSnapshot(s){if(!s)return;shapeCadState.points=(s.points||[]).map(p=>[Number(p[0]),Number(p[1])]);shapeCadState.closed=!!s.closed;shapeCadState.draft=[];shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadRender();updateShapePreview();}
function shapeCadPushUndo(){shapeCadState.undo.push(shapeCadSnapshot());if(shapeCadState.undo.length>80)shapeCadState.undo.shift();shapeCadState.redo.length=0;}
function shapeCadUndo(){if(!shapeCadState.undo.length)return;shapeCadState.redo.push(shapeCadSnapshot());shapeCadRestoreSnapshot(shapeCadState.undo.pop());}
function shapeCadRedo(){if(!shapeCadState.redo.length)return;shapeCadState.undo.push(shapeCadSnapshot());shapeCadRestoreSnapshot(shapeCadState.redo.pop());}
function shapeCadClampPoint(p){const {W,H}=shapeCadOwnerInfo();return [Math.max(0,Math.min(W,Number(p[0])||0)),Math.max(0,Math.min(H,Number(p[1])||0))];}
function shapeCadMap(){const {W,H}=shapeCadOwnerInfo(),pad=28,sw=640,sh=390,s=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H)),dw=W*s,dh=H*s,ox=(sw-dw)/2,oy=(sh-dh)/2;return {W,H,sw,sh,pad,s,ox,oy,sx:x=>ox+x*s,sy:y=>sh-(oy+y*s),ux:x=>(x-ox)/s,uy:y=>(sh-y-oy)/s};}
function shapeCadTouchLike(e=null){return e?.pointerType==='touch'||e?.pointerType==='pen'||(navigator.maxTouchPoints||0)>0||!!window.matchMedia?.('(pointer: coarse)')?.matches;}
function shapeCadSnapRadiusPx(e=null){return shapeCadTouchLike(e)?38:18;}
function shapeCadEdgeRadiusPx(e=null){return shapeCadTouchLike(e)?27:12;}
function shapeCadPxDistance(a,b,m=shapeCadMap()){return Math.hypot(m.sx(a[0])-m.sx(b[0]),m.sy(a[1])-m.sy(b[1]));}
function shapeCadNearestIndex(p,maxPx=null,{excludeIndex=-1}={}){const m=shapeCadMap(),limit=maxPx??shapeCadSnapRadiusPx();let best=-1,bd=Infinity;shapeCadState.points.forEach((q,i)=>{if(i===excludeIndex)return;const d=shapeCadPxDistance(q,p,m);if(d<bd){bd=d;best=i;}});return bd<=limit?best:-1;}
function shapeCadSegments(){const pts=shapeCadState.points,out=[];for(let i=0;i+1<pts.length;i++)out.push({a:pts[i],b:pts[i+1],i,j:i+1});if(shapeCadState.closed&&pts.length>2)out.push({a:pts.at(-1),b:pts[0],i:pts.length-1,j:0,closing:true});return out;}
function shapeCadClosestOnSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d2=dx*dx+dy*dy;if(d2<1e-12)return {point:[a[0],a[1]],t:0};const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d2));return {point:[a[0]+dx*t,a[1]+dy*t],t};}
function shapeCadSegmentIntersection(s1,s2){const [x1,y1]=s1.a,[x2,y2]=s1.b,[x3,y3]=s2.a,[x4,y4]=s2.b,dx1=x2-x1,dy1=y2-y1,dx2=x4-x3,dy2=y4-y3,den=dx1*dy2-dy1*dx2;if(Math.abs(den)<1e-9)return null;const qx=x3-x1,qy=y3-y1,t=(qx*dy2-qy*dx2)/den,u=(qx*dy1-qy*dx1)/den;if(t<=1e-6||t>=1-1e-6||u<=1e-6||u>=1-1e-6)return null;return [x1+t*dx1,y1+t*dy1];}
function shapeCadActiveAnchor(){const t=shapeCadState.tool;if(t==='line'&&shapeCadState.points.length&&!shapeCadState.closed)return shapeCadState.points.at(-1);if(['rect','circle'].includes(t)&&shapeCadState.draft.length)return shapeCadState.draft[0];if(['arc','curve'].includes(t)&&shapeCadState.draft.length)return shapeCadState.draft.at(-1);return null;}
function shapeCadInferenceCandidates(raw,{endpoints=true,excludeIndex=-1,event=null}={}){
  const m=shapeCadMap(),snapPx=shapeCadSnapRadiusPx(event),edgePx=shapeCadEdgeRadiusPx(event),axisPx=shapeCadTouchLike(event)?23:12,c=[];
  const add=(point,kind,label,priority,limit=snapPx,extra={})=>{point=shapeCadClampPoint(point);const dist=shapeCadPxDistance(raw,point,m);if(dist<=limit)c.push({point,kind,label,priority,dist,...extra});};
  if(endpoints){shapeCadState.points.forEach((q,i)=>{if(i===excludeIndex)return;const last=shapeCadState.points.length-1;if(shapeCadState.tool==='line'&&!shapeCadState.closed&&i===last)return;const closing=shapeCadState.tool==='line'&&!shapeCadState.closed&&shapeCadState.points.length>=3&&i===0;add(q,'endpoint',closing?'Fechar contorno':'Extremidade',closing?-2:0,snapPx,{index:i});});}
  const segs=shapeCadSegments();
  for(const seg of segs){const mid=[(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];add(mid,'midpoint','Meio',2,snapPx*.86,{segment:seg});}
  if(segs.length<=120){for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const a=segs[i],b=segs[j];if(a.i===b.i||a.i===b.j||a.j===b.i||a.j===b.j)continue;const x=shapeCadSegmentIntersection(a,b);if(x)add(x,'intersection','Interseção',1,snapPx*.92,{segments:[a,b]});}}
  if(shapeCadState.closed&&shapeCadState.points.length>=3){const xs=shapeCadState.points.map(p=>p[0]),ys=shapeCadState.points.map(p=>p[1]),center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];add(center,'center','Centro',4,snapPx*.82);}
  for(const seg of segs){const pr=shapeCadClosestOnSegment(raw,seg.a,seg.b);if(pr.t>.015&&pr.t<.985)add(pr.point,'edge','Sobre aresta',5,edgePx,{segment:seg});}
  const anchor=shapeCadActiveAnchor();
  if(anchor&&shapeCadState.tool!=='edit'){
    const dx=raw[0]-anchor[0],dy=raw[1]-anchor[1];
    add([raw[0],anchor[1]],'horizontal','Horizontal',7,axisPx,{guide:{type:'line',a:[0,anchor[1]],b:[m.W,anchor[1]]}});
    add([anchor[0],raw[1]],'vertical','Vertical',7,axisPx,{guide:{type:'line',a:[anchor[0],0],b:[anchor[0],m.H]}});
    if(Math.abs(dx)+Math.abs(dy)>.001){const sx=Math.sign(dx)||1,sy=Math.sign(dy)||1,t=(Math.abs(dx)+Math.abs(dy))/2,q=[anchor[0]+sx*t,anchor[1]+sy*t];add(q,'angle45','45°',8,axisPx,{guide:{type:'line',a:anchor,b:q}});}
  }
  const alignPx=shapeCadTouchLike(event)?20:9;
  if(shapeCadState.points.length&&shapeCadState.tool!=='edit'){
    let bestX=null,bestY=null,bdx=Infinity,bdy=Infinity;
    shapeCadState.points.forEach((q,i)=>{if(i===excludeIndex)return;const dx=Math.abs(m.sx(q[0])-m.sx(raw[0])),dy=Math.abs(m.sy(q[1])-m.sy(raw[1]));if(dx<bdx){bdx=dx;bestX=q;}if(dy<bdy){bdy=dy;bestY=q;}});
    if(bestX&&bdx<=alignPx)add([bestX[0],raw[1]],'alignX','Alinhado',10,alignPx,{guide:{type:'line',a:[bestX[0],0],b:[bestX[0],m.H]}});
    if(bestY&&bdy<=alignPx)add([raw[0],bestY[1]],'alignY','Alinhado',10,alignPx,{guide:{type:'line',a:[0,bestY[1]],b:[m.W,bestY[1]]}});
  }
  return c;
}
function shapeCadResolveSnap(raw,{endpoints=true,excludeIndex=-1,event=null}={}){
  raw=shapeCadClampPoint(raw);if($('shapeCadSnap')?.checked===false)return {point:raw,snap:null,guides:[]};
  const candidates=shapeCadInferenceCandidates(raw,{endpoints,excludeIndex,event});
  candidates.sort((a,b)=>(a.dist+a.priority*3)-(b.dist+b.priority*3)||a.priority-b.priority||a.dist-b.dist);
  if(candidates.length){const best=candidates[0];return {point:best.point,snap:best,guides:best.guide?[best.guide]:[]};}
  const grid=Math.max(.01,Number($('shapeCadGrid')?.value)||10),q=shapeCadClampPoint([Math.round(raw[0]/grid)*grid,Math.round(raw[1]/grid)*grid]);
  return {point:q,snap:{point:q,kind:'grid',label:'Grade',priority:99,dist:shapeCadPxDistance(raw,q)},guides:[]};
}
function shapeCadEventRawPoint(e){const svg=$('shapeCadSvg'),r=svg.getBoundingClientRect(),m=shapeCadMap(),sx=(e.clientX-r.left)*(640/Math.max(1,r.width)),sy=(e.clientY-r.top)*(390/Math.max(1,r.height));return shapeCadClampPoint([m.ux(sx),m.uy(sy)]);}
function shapeCadSnapPoint(p,{endpoints=true,excludeIndex=-1,event=null}={}){const r=shapeCadResolveSnap(p,{endpoints,excludeIndex,event});shapeCadState.hoverSnap=r.snap;shapeCadState.guides=r.guides;return r.point;}
function shapeCadPointerPoint(e,{endpoints=true,excludeIndex=-1}={}){shapeCadState.lastPointerType=e.pointerType||shapeCadState.lastPointerType||'mouse';const raw=shapeCadEventRawPoint(e),r=shapeCadResolveSnap(raw,{endpoints,excludeIndex,event:e});shapeCadState.rawCurrent=raw;shapeCadState.hoverSnap=r.snap;shapeCadState.guides=r.guides;return r.point;}
function shapeCadSetStatus(t){if($('shapeCadStatus'))$('shapeCadStatus').textContent=t;}
function shapeCadSetTool(tool){shapeCadState.tool=tool;shapeCadState.draft=[];shapeCadState.dragIndex=-1;shapeCadState.hoverSnap=null;shapeCadState.guides=[];document.querySelectorAll('[data-shape-cad-tool]').forEach(b=>b.classList.toggle('active',b.dataset.shapeCadTool===tool));const msgs={edit:'Arraste qualquer ponto. No celular a área de captura é maior e o ponto encaixa sozinho.',line:'Toque em sequência. O cursor encontra extremidades, meios, interseções, arestas e eixos automaticamente.',rect:'Toque em dois cantos opostos. Snap e alinhamentos permanecem ativos.',circle:'Toque no centro e depois na borda do círculo.',arc:'Defina início, ponto intermediário e final do arco.',curve:'Defina início, controle e final da curva.',fillet:'Toque num vértice para aplicar o raio informado.',chamfer:'Toque num vértice para criar o chanfro informado.',trim:'Toque em um ponto para apará-lo/removê-lo.'};shapeCadSetStatus(msgs[tool]||'Mini CAD');shapeCadRender();}
function shapeCadResetToPieceRect({record=true}={}){const {W,H}=shapeCadOwnerInfo();if(record)shapeCadPushUndo();shapeCadState.points=[[0,0],[W,0],[W,H],[0,H]];shapeCadState.closed=true;shapeCadState.draft=[];shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadRender();updateShapePreview();}
function shapeCadClear(){shapeCadPushUndo();shapeCadState.points=[];shapeCadState.closed=false;shapeCadState.draft=[];shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadRender();updateShapePreview();}
function shapeCadCloseContour(){if(shapeCadState.points.length<3){toast('Crie pelo menos 3 pontos para fechar a forma');return;}shapeCadPushUndo();shapeCadState.closed=true;shapeCadState.draft=[];shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadRender();updateShapePreview();toast('Contorno fechado');}
function shapeCadPolygonArea(pts){let a=0;for(let i=0,j=pts.length-1;i<pts.length;j=i++)a+=pts[j][0]*pts[i][1]-pts[i][0]*pts[j][1];return a/2;}
function shapeCadNormalizePoints(pts,W,H){return pts.map(p=>[Math.max(0,Math.min(1,p[0]/Math.max(.001,W))),Math.max(0,Math.min(1,p[1]/Math.max(.001,H)))]);}
function shapeCadLoadNormalized(norm,{closed=true}={}){const {W,H}=shapeCadOwnerInfo();shapeCadState.points=(norm||[]).map(p=>[Number(p[0])*W,Number(p[1])*H]);shapeCadState.closed=!!closed;shapeCadState.undo=[];shapeCadState.redo=[];shapeCadState.draft=[];shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadRender();updateShapePreview();}
function shapeCadProfilePoints(){if(shapeCadState.points.length<3)throw new Error('Desenhe pelo menos 3 pontos no Mini CAD');if(!shapeCadState.closed)throw new Error('Feche o contorno no Mini CAD antes de aplicar');const pts=shapeCadState.points.map(shapeCadClampPoint);if(Math.abs(shapeCadPolygonArea(pts))<.5)throw new Error('O contorno desenhado não possui área válida');return pts;}
function shapeCadArcThrough(a,m,b,count=30){const x1=a[0],y1=a[1],x2=m[0],y2=m[1],x3=b[0],y3=b[1],d=2*(x1*(y2-y3)+x2*(y3-y1)+x3*(y1-y2));if(Math.abs(d)<1e-7)return [a,m,b];const ux=((x1*x1+y1*y1)*(y2-y3)+(x2*x2+y2*y2)*(y3-y1)+(x3*x3+y3*y3)*(y1-y2))/d,uy=((x1*x1+y1*y1)*(x3-x2)+(x2*x2+y2*y2)*(x1-x3)+(x3*x3+y3*y3)*(x2-x1))/d,r=Math.hypot(x1-ux,y1-uy),a0=Math.atan2(y1-uy,x1-ux),am=Math.atan2(y2-uy,x2-ux),a1=Math.atan2(y3-uy,x3-ux),tau=Math.PI*2,ccw=(x,y)=>(y-x+tau)%tau;let sweep=ccw(a0,a1);if(ccw(a0,am)>sweep)sweep=-ccw(a1,a0);const out=[];for(let i=0;i<=count;i++){const aa=a0+sweep*(i/count);out.push([ux+r*Math.cos(aa),uy+r*Math.sin(aa)]);}return out.map(shapeCadClampPoint);}
function shapeCadQuad(a,c,b,count=28){const out=[];for(let i=0;i<=count;i++){const t=i/count,s=1-t;out.push(shapeCadClampPoint([s*s*a[0]+2*s*t*c[0]+t*t*b[0],s*s*a[1]+2*s*t*c[1]+t*t*b[1]]));}return out;}
function shapeCadFilletAt(i,r){const pts=shapeCadState.points,n=pts.length;if(n<3||(!shapeCadState.closed&&(i===0||i===n-1)))return false;const prev=pts[(i-1+n)%n],cur=pts[i],next=pts[(i+1)%n],v1=[prev[0]-cur[0],prev[1]-cur[1]],v2=[next[0]-cur[0],next[1]-cur[1]],l1=Math.hypot(...v1),l2=Math.hypot(...v2);if(l1<.01||l2<.01)return false;const u1=[v1[0]/l1,v1[1]/l1],u2=[v2[0]/l2,v2[1]/l2],dot=Math.max(-.999999,Math.min(.999999,u1[0]*u2[0]+u1[1]*u2[1])),theta=Math.acos(dot);if(theta<.02||Math.PI-theta<.02)return false;let rr=Math.max(.1,Number(r)||1),t=rr/Math.tan(theta/2);const maxT=Math.min(l1,l2)*.45;if(t>maxT){t=maxT;rr=t*Math.tan(theta/2);}const a=[cur[0]+u1[0]*t,cur[1]+u1[1]*t],b=[cur[0]+u2[0]*t,cur[1]+u2[1]*t],bis=[u1[0]+u2[0],u1[1]+u2[1]],bl=Math.hypot(...bis);if(bl<.001)return false;bis[0]/=bl;bis[1]/=bl;const dc=rr/Math.sin(theta/2),cen=[cur[0]+bis[0]*dc,cur[1]+bis[1]*dc],aa=Math.atan2(a[1]-cen[1],a[0]-cen[0]),bb=Math.atan2(b[1]-cen[1],b[0]-cen[0]),tau=Math.PI*2;let sweep=(bb-aa+tau)%tau;if(sweep>Math.PI)sweep-=tau;const arc=[];const steps=16;for(let k=0;k<=steps;k++){const an=aa+sweep*(k/steps);arc.push(shapeCadClampPoint([cen[0]+rr*Math.cos(an),cen[1]+rr*Math.sin(an)]));}pts.splice(i,1,...arc);return true;}
function shapeCadChamferAt(i,d){const pts=shapeCadState.points,n=pts.length;if(n<3||(!shapeCadState.closed&&(i===0||i===n-1)))return false;const prev=pts[(i-1+n)%n],cur=pts[i],next=pts[(i+1)%n],l1=Math.hypot(prev[0]-cur[0],prev[1]-cur[1]),l2=Math.hypot(next[0]-cur[0],next[1]-cur[1]),dd=Math.min(Math.max(.1,Number(d)||1),l1*.45,l2*.45),a=[cur[0]+(prev[0]-cur[0])*(dd/l1),cur[1]+(prev[1]-cur[1])*(dd/l1)],b=[cur[0]+(next[0]-cur[0])*(dd/l2),cur[1]+(next[1]-cur[1])*(dd/l2)];pts.splice(i,1,a,b);return true;}
function shapeCadApplyToolPoint(p){const tool=shapeCadState.tool;if(tool==='line'){
    if(shapeCadState.closed){shapeCadPushUndo();shapeCadState.points=[];shapeCadState.closed=false;shapeCadState.hoverSnap=null;}
    if(!shapeCadState.points.length){shapeCadPushUndo();shapeCadState.points.push(p);}else{const snap=shapeCadState.hoverSnap,first=shapeCadState.points[0],m=shapeCadMap(),nearFirst=shapeCadState.points.length>=3&&((snap?.kind==='endpoint'&&snap.index===0)||shapeCadPxDistance(p,first,m)<=shapeCadSnapRadiusPx());if(nearFirst){shapeCadPushUndo();shapeCadState.closed=true;shapeCadState.current=first;shapeCadSetStatus('Contorno fechado automaticamente na extremidade inicial.');}else{shapeCadPushUndo();shapeCadState.points.push(p);}}
  }else if(tool==='rect'){
    if(!shapeCadState.draft.length){shapeCadState.draft=[p];shapeCadSetStatus('Agora toque no canto oposto do retângulo.');}
    else{shapeCadPushUndo();const a=shapeCadState.draft[0],x1=Math.min(a[0],p[0]),x2=Math.max(a[0],p[0]),y1=Math.min(a[1],p[1]),y2=Math.max(a[1],p[1]);shapeCadState.points=[[x1,y1],[x2,y1],[x2,y2],[x1,y2]];shapeCadState.closed=true;shapeCadState.draft=[];}
  }else if(tool==='circle'){
    if(!shapeCadState.draft.length){shapeCadState.draft=[p];shapeCadSetStatus('Agora toque na borda do círculo.');}
    else{shapeCadPushUndo();const c=shapeCadState.draft[0],r=Math.hypot(p[0]-c[0],p[1]-c[1]);if(r<.1){toast('Círculo muito pequeno');return;}const arr=[];for(let i=0;i<72;i++){const a=Math.PI*2*i/72;arr.push(shapeCadClampPoint([c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]));}shapeCadState.points=arr;shapeCadState.closed=true;shapeCadState.draft=[];}
  }else if(tool==='arc'||tool==='curve'){
    if(!shapeCadState.draft.length){if(shapeCadState.points.length&&!shapeCadState.closed)shapeCadState.draft=[shapeCadState.points.at(-1)];else shapeCadState.draft=[p];}
    else if(shapeCadState.draft.length===1){shapeCadState.draft.push(p);shapeCadSetStatus(tool==='arc'?'Toque no ponto final do arco.':'Toque no ponto final da curva.');}
    else{const a=shapeCadState.draft[0],m=shapeCadState.draft[1],seg=tool==='arc'?shapeCadArcThrough(a,m,p):shapeCadQuad(a,m,p);shapeCadPushUndo();if(!shapeCadState.points.length||shapeCadState.closed){shapeCadState.points=[...seg];shapeCadState.closed=false;}else shapeCadState.points.push(...seg.slice(1));shapeCadState.draft=[];}
  }else if(['fillet','chamfer','trim'].includes(tool)){
    const i=shapeCadNearestIndex(p,shapeCadTouchLike()?42:23);if(i<0){toast('Toque mais perto de um ponto do contorno');return;}shapeCadPushUndo();if(tool==='trim'){if(shapeCadState.points.length<=3){shapeCadState.undo.pop();toast('A forma precisa manter pelo menos 3 pontos');return;}shapeCadState.points.splice(i,1);}else if(tool==='fillet'){if(!shapeCadFilletAt(i,Number($('shapeCadRadius')?.value)||50)){shapeCadState.undo.pop();toast('Não foi possível aplicar raio neste ponto');return;}}else if(!shapeCadChamferAt(i,Number($('shapeCadRadius')?.value)||50)){shapeCadState.undo.pop();toast('Não foi possível criar chanfro neste ponto');return;}
  }
  shapeCadRender();updateShapePreview();
}
function shapeCadGuideSvg(g,m){if(!g)return '';if(g.type==='line'&&g.a&&g.b)return `<line x1="${m.sx(g.a[0]).toFixed(2)}" y1="${m.sy(g.a[1]).toFixed(2)}" x2="${m.sx(g.b[0]).toFixed(2)}" y2="${m.sy(g.b[1]).toFixed(2)}" stroke="#ff6f91" stroke-width="1.25" stroke-dasharray="7 5" opacity=".9"/>`;return '';}
function shapeCadSnapMarkerSvg(s,m){if(!s||s.kind==='grid')return '';const x=m.sx(s.point[0]),y=m.sy(s.point[1]),label=s.label||'',touch=shapeCadTouchLike(),halo=touch?`<circle cx="${x}" cy="${y}" r="17" fill="rgba(127,229,148,.10)" stroke="rgba(127,229,148,.42)" stroke-width="1"/>`:'';let mark='';if(s.kind==='midpoint')mark=`<rect x="${x-5}" y="${y-5}" width="10" height="10" fill="#ffd36a" stroke="#071116" stroke-width="1.2"/>`;else if(s.kind==='intersection')mark=`<path d="M ${x-6} ${y-6} L ${x+6} ${y+6} M ${x+6} ${y-6} L ${x-6} ${y+6}" stroke="#ff6f91" stroke-width="2.4"/>`;else if(s.kind==='center')mark=`<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#8fb7ff" stroke-width="2"/><circle cx="${x}" cy="${y}" r="1.8" fill="#8fb7ff"/>`;else if(s.kind==='edge')mark=`<path d="M ${x} ${y-6} L ${x+6} ${y} L ${x} ${y+6} L ${x-6} ${y} Z" fill="#53d6e8" stroke="#071116" stroke-width="1"/>`;else mark=`<circle cx="${x}" cy="${y}" r="6" fill="${s.kind==='endpoint'?'#7fe594':'#ff6f91'}" stroke="#071116" stroke-width="1.4"/>`;const w=Math.max(54,label.length*6.1+14),lx=Math.min(640-w-4,Math.max(4,x+11)),ly=Math.max(18,y-11);return `${halo}${mark}<g pointer-events="none"><rect x="${lx}" y="${ly-15}" rx="5" ry="5" width="${w}" height="18" fill="rgba(5,10,13,.92)" stroke="${s.kind==='endpoint'?'#7fe594':'#ff6f91'}" stroke-width=".8"/><text x="${lx+7}" y="${ly-3}" fill="#f7fbfd" font-size="10" font-weight="800">${label}</text></g>`;}
function shapeCadRender(){const svg=$('shapeCadSvg');if(!svg)return;const m=shapeCadMap(),grid=Math.max(.1,Number($('shapeCadGrid')?.value)||10),parts=[];parts.push('<rect width="640" height="390" fill="#0b1116"/>');const px=grid*m.s;if(px>=7){for(let x=0;x<=m.W+.001;x+=grid){const sx=m.sx(x);parts.push(`<line x1="${sx.toFixed(2)}" y1="${m.sy(0).toFixed(2)}" x2="${sx.toFixed(2)}" y2="${m.sy(m.H).toFixed(2)}" stroke="#21303a" stroke-width="0.7"/>`);}for(let y=0;y<=m.H+.001;y+=grid){const sy=m.sy(y);parts.push(`<line x1="${m.sx(0).toFixed(2)}" y1="${sy.toFixed(2)}" x2="${m.sx(m.W).toFixed(2)}" y2="${sy.toFixed(2)}" stroke="#21303a" stroke-width="0.7"/>`);}}
  parts.push(`<rect x="${m.sx(0)}" y="${m.sy(m.H)}" width="${m.W*m.s}" height="${m.H*m.s}" fill="none" stroke="#7b8b95" stroke-width="1.2" stroke-dasharray="7 5"/>`);
  for(const g of shapeCadState.guides||[])parts.push(shapeCadGuideSvg(g,m));
  const anchor=shapeCadActiveAnchor();if(anchor&&shapeCadState.current&&shapeCadState.tool!=='edit'&&!shapeCadState.closed){parts.push(`<line x1="${m.sx(anchor[0]).toFixed(2)}" y1="${m.sy(anchor[1]).toFixed(2)}" x2="${m.sx(shapeCadState.current[0]).toFixed(2)}" y2="${m.sy(shapeCadState.current[1]).toFixed(2)}" stroke="#ffd36a" stroke-width="1.5" stroke-dasharray="5 4" opacity=".9"/>`);}
  if(shapeCadState.points.length){const d=shapeCadState.points.map((p,i)=>`${i?'L':'M'} ${m.sx(p[0]).toFixed(2)} ${m.sy(p[1]).toFixed(2)}`).join(' ')+(shapeCadState.closed?' Z':'');parts.push(`<path d="${d}" fill="${shapeCadState.closed?'rgba(83,214,232,.12)':'none'}" stroke="#53d6e8" stroke-width="2.6" stroke-linejoin="round"/>`);shapeCadState.points.forEach((p,i)=>{const r=shapeCadTouchLike()?5.2:4.2;parts.push(`<circle cx="${m.sx(p[0]).toFixed(2)}" cy="${m.sy(p[1]).toFixed(2)}" r="${i===shapeCadState.dragIndex?r+2:r}" fill="${i===0?'#7fe594':'#f8f8f8'}" stroke="#071116" stroke-width="1.2"/>`);});}
  if(shapeCadState.draft.length){for(const p of shapeCadState.draft)parts.push(`<circle cx="${m.sx(p[0]).toFixed(2)}" cy="${m.sy(p[1]).toFixed(2)}" r="5" fill="#ffd36a"/>`);}
  parts.push(shapeCadSnapMarkerSvg(shapeCadState.hoverSnap,m));
  parts.push(`<text x="${m.sx(0)+5}" y="${m.sy(0)-7}" fill="#8fa0aa" font-size="11">0,0</text><text x="${m.sx(m.W)-5}" y="${m.sy(m.H)+15}" text-anchor="end" fill="#8fa0aa" font-size="11">${nice(m.W)} × ${nice(m.H)} mm</text>`);svg.innerHTML=parts.join('');const pts=shapeCadState.points;if($('shapeCadMeasure'))$('shapeCadMeasure').textContent=pts.length?`${pts.length} pontos · ${shapeCadState.closed?'contorno fechado':'contorno aberto'}${shapeCadState.closed?` · área ${nice(Math.abs(shapeCadPolygonArea(pts)))} mm²`:''}`:'Nenhum contorno';}
function shapeCadPointerDown(e){if($('shapeType')?.value!=='custom-profile')return;e.preventDefault();shapeCadState.lastPointerType=e.pointerType||shapeCadState.lastPointerType;const raw=shapeCadEventRawPoint(e);if(shapeCadState.tool==='edit'){const i=shapeCadNearestIndex(raw,shapeCadSnapRadiusPx(e)+5);if(i>=0){shapeCadPushUndo();shapeCadState.dragIndex=i;shapeCadState.pointer=e.pointerId;shapeCadState.hoverSnap={point:shapeCadState.points[i],kind:'endpoint',label:'Mover ponto',index:i};shapeCadState.current=shapeCadState.points[i];try{$('shapeCadSvg').setPointerCapture(e.pointerId);}catch{}shapeCadRender();}else{shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadRender();}}else{const p=shapeCadPointerPoint(e);shapeCadState.current=p;const tag=shapeCadState.hoverSnap?.kind&&shapeCadState.hoverSnap.kind!=='grid'?` · ${shapeCadState.hoverSnap.label}`:'';if($('shapeCadCoords'))$('shapeCadCoords').textContent=`X ${nice(p[0])} · Y ${nice(p[1])} mm${tag}`;shapeCadApplyToolPoint(p);}}
function shapeCadPointerMove(e){if($('shapeType')?.value!=='custom-profile')return;const p=shapeCadPointerPoint(e,{endpoints:true,excludeIndex:shapeCadState.dragIndex});shapeCadState.current=p;const tag=shapeCadState.hoverSnap?.kind&&shapeCadState.hoverSnap.kind!=='grid'?` · ${shapeCadState.hoverSnap.label}`:'';if($('shapeCadCoords'))$('shapeCadCoords').textContent=`X ${nice(p[0])} · Y ${nice(p[1])} mm${tag}`;if(shapeCadState.dragIndex>=0&&shapeCadState.pointer===e.pointerId){e.preventDefault();shapeCadState.points[shapeCadState.dragIndex]=p;shapeCadRender();updateShapePreview();}else shapeCadRender();}
function shapeCadPointerUp(e){if(shapeCadState.pointer===e.pointerId){shapeCadState.pointer=null;shapeCadState.dragIndex=-1;shapeCadRender();updateShapePreview();}}
function shapeCadPointerLeave(e){if(shapeCadState.pointer!=null)return;if((e?.pointerType||'mouse')==='mouse'){shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadState.current=null;shapeCadRender();}}
function shapeCadInitForOwner({forceRect=false}={}){const {W,H}=shapeCadOwnerInfo();const changed=Math.abs(W-shapeCadState.baseW)>.01||Math.abs(H-shapeCadState.baseH)>.01;shapeCadState.baseW=W;shapeCadState.baseH=H;if(forceRect||changed||shapeCadState.points.length<3)shapeCadResetToPieceRect({record:false});else shapeCadRender();}
function shapeCadSyncUi(){const custom=$('shapeType')?.value==='custom-profile';if($('shapeMiniCad'))$('shapeMiniCad').style.display=custom?'grid':'none';if($('shapeCornerGrid'))$('shapeCornerGrid').style.display=custom?'none':'grid';const cornerHelp=$('shapeCornerGrid')?.nextElementSibling;if(cornerHelp?.classList.contains('dialogHelp'))cornerHelp.style.display=custom?'none':'';if($('shapeRadiusLabel'))$('shapeRadiusLabel').style.display=custom?'none':'';if(custom)shapeCadInitForOwner();shapeCadRender();}
function shapeCadLoadPreset(p){if(p?.type!=='custom-profile')return;const norm=p.profileNormalized||p.pointsNormalized||null;if(Array.isArray(norm)&&norm.length>=3)shapeCadLoadNormalized(norm,{closed:p.closed!==false});else shapeCadResetToPieceRect({record:false});shapeCadState.loadedPresetId=p.id||null;}
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
  if(p.type==='custom-profile')shapeCadLoadPreset(p);shapeCadSyncUi();updateShapePreview();
}
function newShapePreset(){shapePresetEditId=null;$('shapeFolder').value='Formas personalizadas';$('shapeName').value='Minha forma';$('shapeType').value='custom-profile';$('shapeRadius').value=150;$('saveShapePreset').textContent='💾 Salvar na biblioteca';shapeCadResetToPieceRect({record:false});shapeCadSyncUi();updateShapePreview();$('shapeName').focus();}
function editSelectedShapePreset(){const p=findShapePreset($('shapePresetSelect')?.value);if(!p)return;if(p.locked){shapePresetEditId=null;$('shapeName').value=(p.name||'Forma')+' personalizada';$('saveShapePreset').textContent='💾 Salvar na biblioteca';toast('Preset padrão aberto como cópia editável');}else{shapePresetEditId=p.id;$('saveShapePreset').textContent='💾 Salvar alteração';}if(p.type==='custom-profile')shapeCadLoadPreset(p);shapeCadSyncUi();updateShapePreview();}
function saveShapePresetLibrary(){
  const name=String($('shapeName').value||'').trim(),folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',radius=Number($('shapeRadius').value),type=$('shapeType').value||'round-corner';
  if(!name){toast('Dê um nome para a forma');return;}if(type==='round-corner'&&!(radius>0)){toast('Confira o raio');return;}
  let extra={};
  if(type==='custom-profile'){
    let pts;try{pts=shapeCadProfilePoints();}catch(err){toast(err.message||'Confira o contorno do Mini CAD');return;}
    const {W,H}=shapeCadOwnerInfo();extra={profileNormalized:shapeCadNormalizePoints(pts,W,H),closed:true,baseW:W,baseH:H};
  }
  const arr=getUserShapePresets();
  if(shapePresetEditId){const i=arr.findIndex(x=>x.id===shapePresetEditId);if(i>=0)arr[i]={...arr[i],name,folder,radius,type,...extra};else shapePresetEditId=null;}
  if(!shapePresetEditId){const item={id:uid('shapePreset'),name,folder,radius,type,...extra};arr.push(item);shapePresetEditId=item.id;}
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
  const ti=pieceThicknessInfo(o);if(!ti)return [];const forms=(formsOverride??o.userData?.forms??[]);
  const custom=[...forms].reverse().find(f=>f?.type==='custom-profile'&&Array.isArray(f.points)&&f.points.length>=3);
  if(custom){
    return custom.points.map(p=>[Math.max(0,Math.min(ti.faceW,Number(p[0])||0)),Math.max(0,Math.min(ti.faceH,Number(p[1])||0))]);
  }
  const W=ti.faceW,H=ti.faceH,r=formCornerRadii(o,forms);if(!r)return [];
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
  const type=$('shapeType')?.value||'round-corner',name=String($('shapeName').value||'Forma').trim()||'Forma',folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',presetId=$('shapePresetSelect')?.value||null;
  const ti=pieceThicknessInfo(shapePreviewOwner||selected);if(!ti)throw new Error('Selecione uma peça retangular');
  if(type==='custom-profile'){
    const points=shapeCadProfilePoints();
    return {id:uid('form'),type:'custom-profile',name,folder,presetId,points:points.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),baseW:ti.faceW,baseH:ti.faceH};
  }
  const radius=Number($('shapeRadius').value);if(!(radius>0))throw new Error('Confira o raio');if(!shapeSelectedCorners.size)throw new Error('Escolha pelo menos um canto');if(radius>Math.min(ti.faceW,ti.faceH)/2+.001)throw new Error(`Raio máximo nesta peça: ${nice(Math.min(ti.faceW,ti.faceH)/2)} mm`);
  return {id:uid('form'),type:'round-corner',name,radius,folder,presetId,corners:[...shapeSelectedCorners]};
}
function updateShapePreview(){
  const owner=shapePreviewOwner||selected,svg=$('shapePreviewSvg');if(!owner||!svg)return;const ti=pieceThicknessInfo(owner);if(!ti)return;
  let forms=cloneForms(owner.userData.forms||[]),op=null,msg='';try{op=shapeDraftOperation();forms.push(op);}catch(err){msg=err.message||'Confira a forma';}
  const pts=formOutlinePointsMm(owner,forms,24),W=ti.faceW,H=ti.faceH,pad=22,sw=420,sh=260,scale=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H)),ox=(sw-W*scale)/2,oy=(sh-H*scale)/2;
  const d=pts.map(([u,v],i)=>`${i?'L':'M'} ${(ox+u*scale).toFixed(2)} ${(sh-(oy+v*scale)).toFixed(2)}`).join(' ')+' Z';
  svg.innerHTML=`<path d="${d}" fill="#c8b591" stroke="#080808" stroke-width="2.2"/><text x="${sw/2}" y="18" text-anchor="middle" fill="#53d6e8" font-size="12">${nice(W)} × ${nice(H)} mm</text>`;
  $('shapePreviewText').textContent=msg||(op?.type==='custom-profile'?`${op?.name||'Forma'} · Mini CAD · ${op?.points?.length||0} pontos · contorno fechado.`:`${op?.name||'Forma'} · raio ${nice(op?.radius||0)} mm · ${op?.corners?.length||0} canto(s) selecionado(s).`);
}
function renderAppliedShapes(){
  const list=$('shapeAppliedList');if(!list)return;list.innerHTML='';const owner=shapePreviewOwner||selected,forms=owner?.userData?.forms||[],labels=shapeCornerLabels(owner);
  if(!forms.length){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma Forma aplicada nesta peça.';list.appendChild(d);return;}
  for(const f of forms){const item=document.createElement('div');item.className='shapeAppliedItem';const text=document.createElement('div');text.innerHTML=`<strong></strong><span></span>`;text.querySelector('strong').textContent=f.name||'Forma';text.querySelector('span').textContent=f.type==='custom-profile'?`Mini CAD · ${(f.points||[]).length} pontos · contorno personalizado`:`R ${nice(f.radius)} mm · ${(f.corners||[]).map(c=>labels[c]||c).join(' + ')}`;const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteAppliedShape(f.id);item.append(text,del);list.appendChild(item);}
}
function deleteAppliedShape(id){
  const owner=shapePreviewOwner||selected;if(!owner)return;const arr=owner.userData.forms||[],f=arr.find(x=>x.id===id);if(!f)return;if(!window.confirm(`Excluir a Forma “${f.name||'Forma'}” desta peça?`))return;owner.userData.forms=arr.filter(x=>x.id!==id);rebuildFormGeometry(owner);renderAppliedShapes();updateShapePreview();renderMachiningVisuals();commitHistory();toast('Forma removida da peça');
}
function openShapeDialog(){
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  if(!selected){toast('Selecione uma peça');return;}if(selected.userData?.kind==='cylinder'||selected.userData?.kind==='curved-panel'||selected.userData?.curvedRole){toast('Forma disponível para peças retangulares');return;}
  shapePreviewOwner=selected;shapePreviewOriginalForms=null;shapePreviewActive=false;shapePresetEditId=null;shapeSelectedCorners=new Set(['bl']);$('morePanel').style.display='none';$('machiningDialog').style.display='none';
  const ti=pieceThicknessInfo(selected);$('shapePartInfo').textContent=`${selected.userData.name||'Peça'} · face ${nice(ti.faceW)} × ${nice(ti.faceH)} mm · espessura ${nice(ti.thickness)} mm. A Forma altera o contorno real e será exportada em CORTE_EXTERNO.`;
  refreshShapePresetSelect('builtin-r150');refreshShapeCornerLabels();shapeCadInitForOwner({forceRect:true});shapeCadSyncUi();renderAppliedShapes();updateShapePreview();$('shapeDialog').style.display='flex';
}
function restoreShapePreview(){
  if(shapePreviewActive&&shapePreviewOwner&&objects.includes(shapePreviewOwner)){shapePreviewOwner.userData.forms=cloneForms(shapePreviewOriginalForms||[]);rebuildFormGeometry(shapePreviewOwner);}
  shapePreviewActive=false;shapePreviewOriginalForms=null;$('shape3DPreviewBar').style.display='none';setDesignLabVisualizationOnly(false);renderMachiningVisuals();
}
function previewShape3D(){
  const owner=shapePreviewOwner||selected;if(!owner)return;try{restoreShapePreview();shapePreviewOwner=owner;shapePreviewOriginalForms=cloneForms(owner.userData.forms||[]);const forms=cloneForms(shapePreviewOriginalForms);forms.push(shapeDraftOperation());owner.userData.forms=forms;rebuildFormGeometry(owner);shapePreviewActive=true;$('shapeDialog').style.display='none';$('shape3DPreviewBar').style.display='flex';setDesignLabVisualizationOnly(true);$('shape3DPreviewInfo').textContent=`${owner.userData.name||'Peça'} · prévia temporária; volte para aplicar ou ajustar.`;selectObject(owner);toast('Prévia 3D da Forma');}catch(err){restoreShapePreview();toast(err.message||'Não foi possível visualizar');}
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

// 1.100.96 — ciclo de vida das ferragens.
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
function previewHardware3D(){try{const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(!p)throw new Error('Escolha uma ferragem');const plan=hardwarePlan(selected,p,{instanceId:'preview'});renderHardwarePreviewOps(plan);machiningPreviewOwner=selected;machiningPreviewActive=true;machiningVisualGroup.visible=false;$('machiningDialog').style.display='none';$('machining3DPreviewBar').style.display='flex';setDesignLabVisualizationOnly(true);$('machining3DPreviewInfo').textContent=`${p.name} · ${plan.contacts.length} contato(s) · ${plan.operations.length} furação(ões) · ainda não salvo`;focusHardwarePlan(plan);toast('Prévia 3D · amarelo = furos da ferragem');}catch(err){clearMachiningDraftPreview();machiningPreviewActive=false;machiningVisualGroup.visible=true;setDesignLabVisualizationOnly(false);toast(err.message||'Não foi possível visualizar a ferragem');}}
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
    setDesignLabVisualizationOnly(true);
    const qty=op.type==='hole'?holeSeriesInstances(owner,op).length:1;
    $('machining3DPreviewInfo').textContent=op.type==='hole'
      ?`${qty>1?qty+' furos':'Furo'} Ø ${nice(op.diameter)} mm · prof. ${nice(operationDepthMm(owner,op))} mm · ainda não salvo`
      :`Rasgo ${nice(op.length)} × ${nice(op.width)} mm · prof. ${nice(operationDepthMm(owner,op))} mm · ainda não salvo`;
    focusPieceForMachiningPreview(owner);
    toast('Prévia 3D · verde = volume da usinagem');
  }catch(err){
    clearMachiningDraftPreview(); machiningPreviewActive=false; machiningVisualGroup.visible=true;
    setDesignLabVisualizationOnly(false);
    toast(err.message||'Não foi possível visualizar a usinagem');
  }
}
function closeMachining3DPreview({reopen=true}={}){
  clearMachiningDraftPreview(); hardwarePreviewOps=[];
  machiningPreviewActive=false; machiningVisualGroup.visible=true;
  setDesignLabVisualizationOnly(false);
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


