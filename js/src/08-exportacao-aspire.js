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
  // 1.100.83: além do bloco antigo, gravamos uma assinatura compacta extra
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
  if(parsed.fallback)toast(parsed.record?.dxfFallbackMode==='2d'?'DXF 2D importado como painéis planos · a montagem 3D original não existe no arquivo':'DXF importado só pela geometria · se este arquivo saiu do DesignLab, exporte novamente na 1.100.83 para preservar curvas, usinagens e configurações');
  else if(parsed.stl)toast('STL DesignLab importado preservando curvas, peças e configurações');
  else if(!parsed.legacyJson)toast('DXF DesignLab importado com peças, curvas e configurações preservadas');
}

// ---------- 1.100.83 · STL do modelo 3D completo ----------
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
  const headerText=new TextEncoder().encode('DesignLabMoveis 1.100.83 STL 3D | metadata after triangles');
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
    cutMode:$('sheetCutMode')?.value||'cnc'
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
  // 1.100.83: na peça, VEIO 0° acompanha o eixo vertical da face (faceH) e
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

// ---------- 1.100.83 · CNC por contorno real ----------
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

function packPartsIntoSheetsPanelSaw(parts,cfg){
  let best=null;
  for(const mode of ['area','max','width','height']){
    const sheets=packPanelSawAttempt(parts,cfg,mode);
    const score=[sheets.length,panelSawPackingTieScore(sheets)];
    if(!best||compareSheetScores(score,best.score)<0)best={sheets,score};
  }
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
    help.innerHTML='<strong>Seccionadora:</strong> usa encaixe guilhotina. Cada subdivisão gera cortes somente horizontais/verticais e o ZIP recebe <b>cortes-seccionadora.csv</b>. Formas curvas/especiais são tratadas como blank retangular e continuam exigindo CNC/fresa para o contorno final.';
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

function buildPanelSawCutsCsv(groups,cfg){
  let c=csvLine([
    'Grupo','Chapa','Ordem_corte','Orientacao',
    'X1_mm','Y1_mm','X2_mm','Y2_mm','Comprimento_mm','Descricao'
  ]);
  if(cfg.cutMode!=='panel')return c;
  for(const g of groups){
    for(const cut of (g.panelCuts||[])){
      c+=csvLine([
        g.key,g.sheetNo,cut.order,
        cut.orientation==='V'?'VERTICAL':'HORIZONTAL',
        cut.x1,cut.y1,cut.x2,cut.y2,cut.length,cut.description||''
      ]);
    }
  }
  return c;
}
function sheetCutModeLabel(cfg){
  return cfg.cutMode==='panel'
    ? 'SECCIONADORA · cortes retos'
    : 'CNC · centro para fora';
}
function cutModeReadmeText(cfg){
  return cfg.cutMode==='panel'
    ? 'Modo do plano: SECCIONADORA / GUILHOTINA. O arquivo cortes-seccionadora.csv traz a sequência de cortes retos. A layer CORTE_SECCIONADORA também aparece nos DXFs.'
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
  let c=csvLine(['Arquivo_DXF','Grupo','Chapa','Modo_corte','Largura_chapa_mm','Altura_chapa_mm','Pecas','Cortes_retos','Area_pecas_m2','Aproveitamento_percentual']);
  for(const g of groups){
    const gc=g.cfg||cfg,area=g.parts.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),pct=area/Math.max(1,(gc.width-2*gc.margin)*(gc.height-2*gc.margin))*100;
    c+=csvLine([g.file,g.key,g.sheetNo,gc.cutMode==='panel'?'SECCIONADORA':'CNC',gc.width,gc.height,g.parts.length,g.panelCuts?.length||0,(area/1e6).toFixed(3),pct.toFixed(1)]);
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
        parts:sheet.placements,panelCuts,cutMode:groupCfg.cutMode,cfg:groupCfg,...built
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
  // 1.100.83: recria o anexo com bytes concretos. Alguns Android/WhatsApp
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
  return `DesignLabMoveis 1.100.83 - Pacote Aspire\r\nMóvel: ${root.name}\r\nUnidade: milímetros\r\nChapa padrão/fallback: ${cfg.width} x ${cfg.height} mm\r\nMargem: ${cfg.margin} mm | Folga: ${cfg.gap} mm | Veio padrão: ${(cfg.grainDirection||'length')==='width'?'LARGURA':'COMPRIMENTO'}\r\n${cutModeReadmeText(cfg)}\r\n\r\nCHAPAS\r\n${[...byKey.entries()].map(([k,n])=>{const g=groups.find(x=>x.key===k),gc=g?.cfg||cfg;return '- '+k+': '+n+' chapa(s) · '+gc.width+' x '+gc.height+' mm'+(g?.parts?.some(p=>p.materialGrain)?' · veio '+((gc.grainDirection||'length')==='width'?'na largura':'no comprimento'):'');}).join('\r\n')}\r\n\r\nARQUIVOS DXF\r\n${groups.map(g=>'- '+g.file+' = '+g.key+' / chapa '+g.sheetNo+' ('+g.parts.length+' peça(s))').join('\r\n')}\r\n- lista-pecas.csv = posição, medidas e identificação de cada peça\r\n- plano-chapas.csv = resumo das chapas e aproveitamento por área\r\n- usinagens.csv = uma linha por furo/rasgo real\r\n\r\nLAYERS\r\nCHAPA_REFERENCIA = contorno da chapa; NÃO criar toolpath de corte nesta layer\r\nCORTE_EXTERNO = contorno final REAL das peças, incluindo curvas e Formas paramétricas\r\nFURO_A_Dx_Py / FURO_B_Dx_Py = furos por face, diâmetro e profundidade; no DXF são entidades CIRCLE\r\nRASGO_A_Wx_Py / RASGO_B_Wx_Py = rasgos manuais\r\nRASGO_FUNDO_A_Wx_Py / RASGO_FUNDO_B_Wx_Py = rasgos de fundo automáticos\r\nENCAIXE_MONTANTE = encaixes das nervuras curvas para os montantes\r\nCORTE_SECCIONADORA = linhas retas numeradas do modo seccionadora; ignore esta layer no modo CNC\r\n\r\nIMPORTANTE\r\nCada DXF representa UMA chapa física. Se o móvel precisar de 3 chapas MDF 18 mm, serão criados 3 DXFs MDF 18 mm. Materiais e espessuras diferentes nunca são misturados.\r\nQuando “Material madeirado / manter sentido do veio” estiver marcado, nenhuma peça gira 90°. Quando estiver desmarcado, o CAD pode girar automaticamente para melhorar o aproveitamento.\r\nSem rotação, o DXF preserva os eixos naturais da peça: portas/fundos usam X horizontal e Y vertical; bases/prateleiras usam X/Z; laterais usam Z/Y.\r\nCoordenadas negativas são referências do lado oposto: Y=-100 mantém a operação 100 mm do topo mesmo se a peça for redimensionada. O usinagens.csv traz coordenadas reais e também X_ref/Y_ref/Z_ref.\r\nFerragens podem criar FUROS DE BORDA (entrada em eixo diferente da espessura). Esses furos ficam identificados como FURO_BORDA no usinagens.csv e não viram círculo no DXF da face principal, pois exigem usinagem lateral ou virar a peça; isso evita gerar um toolpath vertical incorreto.\r\n\r\nTotal: ${totalParts} peça(s), ${groups.length} chapa(s), ${ops} operação(ões) geométrica(s).\r\nNo Aspire, associe toolpaths às layers conforme ferramenta, profundidade e estratégia de face.\r\n`;
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
  return `DesignLabMoveis 1.100.83 - Pacote Aspire do projeto completo\r\nUnidade: milímetros\r\nEspaços incluídos: ${spaces.length}\r\n${spaces.map(x=>'- '+x).join('\r\n')}\r\n\r\nChapa padrão/fallback: ${cfg.width} x ${cfg.height} mm\r\nMargem: ${cfg.margin} mm | Folga: ${cfg.gap} mm | Veio padrão: ${(cfg.grainDirection||'length')==='width'?'LARGURA':'COMPRIMENTO'}\r\n${cutModeReadmeText(cfg)}\r\n\r\nCHAPAS\r\n${[...byKey.entries()].map(([k,n])=>{const g=groups.find(x=>x.key===k),gc=g?.cfg||cfg;return '- '+k+': '+n+' chapa(s) · '+gc.width+' x '+gc.height+' mm'+(g?.parts?.some(p=>p.materialGrain)?' · veio '+((gc.grainDirection||'length')==='width'?'na largura':'no comprimento'):'');}).join('\r\n')}\r\n\r\nARQUIVOS DXF\r\n${groups.map(g=>'- '+g.file+' = '+g.key+' / chapa '+g.sheetNo+' ('+g.parts.length+' peça(s))').join('\r\n')}\r\n- lista-pecas.csv = todas as peças do projeto, com espaço de origem\r\n- etiquetas-base.csv = dados estruturados para a futura geração de etiquetas (material, fita por lado, medidas e ID)\r\n- plano-chapas.csv = resumo das chapas e aproveitamento por área\r\n- usinagens.csv = uma linha por furo/rasgo real, com espaço de origem\r\n\r\nLAYERS\r\nCHAPA_REFERENCIA = contorno da chapa; NÃO criar toolpath nesta layer\r\nCORTE_EXTERNO = contorno final REAL das peças, incluindo curvas e Formas paramétricas\r\nFURO_A_Dx_Py / FURO_B_Dx_Py = furos por face, diâmetro e profundidade; no DXF são entidades CIRCLE\r\nRASGO_A_Wx_Py / RASGO_B_Wx_Py = rasgos manuais\r\nRASGO_FUNDO_A_Wx_Py / RASGO_FUNDO_B_Wx_Py = rasgos de fundo automáticos\r\nENCAIXE_MONTANTE = encaixes das nervuras curvas para os montantes\r\nCORTE_SECCIONADORA = linhas retas numeradas do modo seccionadora; ignore esta layer no modo CNC\r\n\r\nIMPORTANTE\r\nO plano de corte é calculado com TODAS as peças de TODOS os espaços juntas. Peças do mesmo material e espessura podem compartilhar a mesma chapa, melhorando o aproveitamento.\r\nCada DXF representa UMA chapa física. Se forem necessárias 4 chapas MDF 18 mm, serão gerados 4 DXFs MDF 18 mm. Materiais e espessuras diferentes nunca são misturados.\r\nQuando “Material madeirado / manter sentido do veio” estiver marcado, nenhuma peça gira 90°. Quando estiver desmarcado, o CAD pode girar automaticamente para melhorar o aproveitamento.\r\nSem rotação, o DXF preserva os eixos naturais da peça: portas/fundos usam X horizontal e Y vertical; bases/prateleiras usam X/Z; laterais usam Z/Y.\r\nCoordenadas negativas são referências do lado oposto: Y=-100 mantém a operação 100 mm do topo mesmo se a peça for redimensionada. O usinagens.csv traz coordenadas reais e também X_ref/Y_ref/Z_ref.\r\nFerragens podem criar FUROS DE BORDA (entrada em eixo diferente da espessura). Esses furos ficam identificados como FURO_BORDA no usinagens.csv e não viram círculo no DXF da face principal, pois exigem usinagem lateral ou virar a peça; isso evita gerar um toolpath vertical incorreto.\r\n\r\nTotal: ${totalParts} peça(s), ${groups.length} chapa(s), ${ops} operação(ões) geométrica(s).\r\n`;
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
    if(cfg.cutMode==='ocl')$('partsListInfo').textContent=`Projeto completo · plano guilhotina inteligente inspirado no OpenCutList: combina ${spaces.length} espaço(s), testa múltiplas ordens/direções e preserva sobras aproveitáveis.`;
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
    if(cfg.cutMode==='panel')files.push({name:'cortes-seccionadora.csv',data:buildPanelSawCutsCsv(groups,cfg)});
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
    if(cfg.cutMode==='panel')files.push({name:'cortes-seccionadora.csv',data:buildPanelSawCutsCsv(groups,cfg)});
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



