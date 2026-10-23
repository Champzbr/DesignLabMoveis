import {applyImportedMeshGeometry} from './imported-mesh.js';
// DesignLabMoveis 1.311.00 · Importação/exportação DXF/STL e serialização de móveis.
export function createCadIoModule(ctx){
  const { $, THREE, COLORS, MM_TO_M, scene, getSpaceRoot, getBounds, captureSpaces, normalizePieceGrainRotation, productionClone, captureProductionState, mm, adminAllowed, globalLibraryFolderById, cloudApiFetch, loadGlobalLibraryItems, loadGlobalLibraryFolders, renderLibrary, toast, importLibraryTemplate, exportLeafName, downloadExportFallback, isExportPickerCancel, pickExportTarget, mergeProjectProductionState, uid, createSpaceFromState, createCylinder, createCurvedRib, createCurvedCover, curvedPostSamplesMm, curvedPostPlacementFromSampleMm, createCurvedPost, createBox, copyLibraryPartMeta, repairOrphanSpaceGaps, renderSpaces, applyAllDoorVisibility, renderMachiningVisuals, selectSpaceCellByIds, frontViewToSpace, commitHistory } = ctx;
  const runtimeModel=ctx.runtimeModel;
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
  if(ctx.selectedSpaceCell){ const r=getSpaceRoot(ctx.selectedSpaceCell.rootId); if(r)return r; }
  if(ctx.selected?.userData?.spaceRootId){ const r=getSpaceRoot(ctx.selected.userData.spaceRootId); if(r)return r; }
  if(ctx.activeSpaceRootId){ const r=getSpaceRoot(ctx.activeSpaceRootId); if(r)return r; }
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
function furnitureObjects(root){ return runtimeModel.objects.filter(o=>objectBelongsToRoot(o,root)); }
function captureFurniture(root){
  const stateSpace=captureSpaces().find(s=>s.id===root.id);
  const parts=furnitureObjects(root).map(o=>({
    kind:o.userData.kind,name:o.userData.name,materialType:o.userData.materialType,baseColor:o.userData.baseColor,
    materialId:o.userData.materialId||null,materialCode:o.userData.materialCode||'',materialGrain:!!o.userData.materialGrain,materialGrainRotation:normalizePieceGrainRotation(o.userData.materialGrainRotation),materialCoreColor:o.userData.materialCoreColor||null,
    edgeBands:productionClone(o.userData.edgeBands||{}),partId:o.userData.partId||null,labelMeta:productionClone(o.userData.labelMeta||{schemaVersion:1,enabled:true}),
    spaceRootId:root.id,importedMesh:o.userData.importedMesh?productionClone(o.userData.importedMesh):null,
    machining:JSON.parse(JSON.stringify(o.userData.machining||[])),forms:JSON.parse(JSON.stringify(o.userData.forms||[])),customProfile:o.userData.customProfile?JSON.parse(JSON.stringify(o.userData.customProfile)):null,curvedRole:o.userData.curvedRole||null,curvedPart:o.userData.curvedPart||o.userData.customProfile?.part||null,curvedConfig:o.userData.curvedConfig?JSON.parse(JSON.stringify(o.userData.curvedConfig)):null,drawerSetId:o.userData.drawerSetId||null,drawerRole:o.userData.drawerRole||null,drawerIndex:o.userData.drawerIndex??null,drawerConfig:o.userData.drawerConfig?JSON.parse(JSON.stringify(o.userData.drawerConfig)):null,doorConfig:o.userData.doorConfig?JSON.parse(JSON.stringify(o.userData.doorConfig)):null,doorSystem:o.userData.doorSystem?JSON.parse(JSON.stringify(o.userData.doorSystem)):null,excludeFromCutList:!!o.userData.excludeFromCutList,spaceCutting:!!o.userData.spaceCutting,spaceCutParentBounds:o.userData.spaceCutParentBounds?JSON.parse(JSON.stringify(o.userData.spaceCutParentBounds)):null,divisionNominalThicknessM:Number(o.userData.divisionNominalThicknessM)||null,manualGeometryDelta:productionClone(o.userData.manualGeometryDelta||null),pieceSavedConfig:productionClone(o.userData.pieceSavedConfig||null),cutPlanSheetHint:Number(o.userData.cutPlanSheetHint)||null,rotationX:Number(o.rotation.x)||0,rotationY:Number(o.rotation.y)||0,rotationZ:Number(o.rotation.z)||0,
    width:o.userData.width,depth:o.userData.depth,height:o.userData.height,
    x:Number.isFinite(o.userData.curvedTargetX)?o.userData.curvedTargetX:o.position.x,yBase:o.position.y-o.userData.height/2,z:Number.isFinite(o.userData.curvedTargetZ)?o.userData.curvedTargetZ:o.position.z
  }));
  return {type:'mini-cad-furniture',version:57,unit:'meter',name:root.name||'Móvel',createdAt:new Date().toISOString(),objects:parts,spaces:[stateSpace],production:captureProductionState()};
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
  // 1.200.18: além do bloco antigo, gravamos uma assinatura compacta extra
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
function dxfFallbackPlanarSpace(fallbackParts,name){
  if(!fallbackParts.length)return [];
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of fallbackParts){
    minX=Math.min(minX,p.x-p.width/2);maxX=Math.max(maxX,p.x+p.width/2);
    minY=Math.min(minY,p.yBase);maxY=Math.max(maxY,p.yBase+p.height);
  }
  if(![minX,maxX,minY,maxY].every(Number.isFinite))return [];
  const depth=Math.max(.018,...fallbackParts.map(p=>Number(p.depth)||0));
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

  const fallbackObjects=[];let idx=0;
  for(const [layer,b] of byLayer3d){const o=dxfFallbackObjectFrom3DBounds(layer,b,idx);if(o){fallbackObjects.push(o);idx++;}}
  if(fallbackObjects.length)return {type:'mini-cad-furniture',version:66,unit:'meter',name,createdAt:new Date().toISOString(),objects:fallbackObjects,spaces:[],production:{},dxfFallback:true,dxfFallbackMode:'3d'};

  // DXFs antigos podem ter somente contornos 2D (LWPOLYLINE/POLYLINE) ou
  // linhas por peça. Nesse caso importamos as peças como painéis planos em vez
  // de rejeitar o arquivo. Contornos internos (furos/rasgos) são descartados
  // quando estão completamente dentro de um contorno maior.
  const candidates=planar.filter(c=>c.closed&&c.b&&Number.isFinite(c.b.minX)&&Number.isFinite(c.b.maxX)&&Number.isFinite(c.b.minY)&&Number.isFinite(c.b.maxY));
  const outer=candidates.filter((c,ci)=>!candidates.some((p,pi)=>pi!==ci&&p.layer===c.layer&&p.b.minX<=c.b.minX-.01&&p.b.maxX>=c.b.maxX+.01&&p.b.minY<=c.b.minY-.01&&p.b.maxY>=c.b.maxY+.01));
  const planarSource=outer.length?outer:candidates;
  for(const c of planarSource){const o=dxfFallbackObjectFromPlanarBounds(c.layer,c.b,idx);if(o){fallbackObjects.push(o);idx++;}}
  if(!fallbackObjects.length){for(const [layer,b] of line2dByLayer){const o=dxfFallbackObjectFromPlanarBounds(layer,b,idx);if(o){fallbackObjects.push(o);idx++;}}}
  if(fallbackObjects.length)return {type:'mini-cad-furniture',version:66,unit:'meter',name,createdAt:new Date().toISOString(),objects:fallbackObjects,spaces:dxfFallbackPlanarSpace(fallbackObjects,name),production:{},dxfFallback:true,dxfFallbackMode:'2d'};

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
  const name=String(file.name||'Modelo').replace(/\.dlbridge\.json$/i,'').replace(/(?:\.mini-cad)?\.json$/i,'').replace(/\.(?:dxf|stl|dae)$/i,'')||'Modelo';
  if(ctx.libraryState.libraryScope==='global'){
    if(!adminAllowed())throw new Error('Somente o administrador pode importar modelos globais');
    const folder=globalLibraryFolderById(ctx.libraryState.activeLibraryFolderId);if(!folder)throw new Error('Abra uma pasta global para importar');
    await cloudApiFetch('/admin/library/items',{method:'POST',body:{folder_id:folder.id,name,record:parsed.record},timeoutMs:30000});
    ctx.libraryState.globalLibraryState.itemsByFolder.delete(folder.id);ctx.libraryState.globalLibraryState.records.clear();
    await loadGlobalLibraryItems(folder.id,{force:true});await loadGlobalLibraryFolders({force:true});renderLibrary();
    toast(parsed.stl?'STL DesignLab publicado na Biblioteca global':(parsed.fallback?(parsed.record?.dxfFallbackMode==='2d'?'DXF 2D publicado como painéis planos · a montagem 3D original não existe no arquivo':'DXF antigo publicado por geometria · sem dados de usinagem que não existiam no arquivo'):'Modelo publicado na Biblioteca global'));
    return;
  }
  importLibraryTemplate(parsed.record,name,ctx.libraryState.activeLibraryFolderId);
  if(parsed.sketchup)toast(`SketchUp: ${parsed.recognized} componente(s) importado(s) em 3D${parsed.skipped?' · '+parsed.skipped+' malha(s) ignorada(s)':''}. Geometrias livres não entram no corte automático.${parsed.bridge?' Fitas e materiais importados para conferência.':''}`);
  else if(parsed.fallback)toast(parsed.record?.dxfFallbackMode==='2d'?'DXF 2D importado como painéis planos · a montagem 3D original não existe no arquivo':'DXF importado só pela geometria · se este arquivo saiu do DesignLab, exporte novamente na 1.200.18 para preservar curvas, usinagens e configurações');
  else if(parsed.stl)toast('STL DesignLab importado preservando curvas, peças e configurações');
  else if(!parsed.legacyJson)toast('DXF DesignLab importado com peças, curvas e configurações preservadas');
}

// ---------- 1.200.18 · STL do modelo 3D completo ----------
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
  const headerText=new TextEncoder().encode('DesignLabMoveis 1.311.00 STL 3D | metadata after triangles');
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
// SketchUp DAE: importa faces trianguladas sem pressupor que todas as peças
// sejam caixas. Componentes irregulares permanecem em modo visual 3D e são
// explicitamente excluídos da produção automática.
async function designLabRecordFromSketchupDae(file){
  const xml=await file.text();
  if(!/<(?:[\w.-]+:)?COLLADA(?:\s|>)/i.test(xml))throw new Error('Arquivo DAE/Collada inválido');
  const {ColladaLoader}=await import('three/addons/loaders/ColladaLoader.js');
  const parsed=new ColladaLoader().parse(xml,'');
  const model=parsed.scene;model.updateMatrixWorld(true);
  const meshes=[];model.traverse(o=>{if(o.isMesh&&o.geometry?.attributes?.position)meshes.push(o);});
  if(!meshes.length)throw new Error('O DAE não contém peças 3D');
  const groups=new Map();
  for(const [i,mesh] of meshes.entries()){
    // Um componente pode conter várias malhas/materiais: agrupar sob o mesmo pai.
    let owner=mesh;
    while(owner.parent&&owner.parent!==model){
      if(owner.name&&!/^(?:mesh|geometry|instance_\d+|sketchup)$/i.test(owner.name))break;
      owner=owner.parent;
    }
    const key=owner!==model?owner:mesh;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(mesh);
  }
  const parts=[];let skipped=0;
  for(const [owner,group] of groups){
    const points=[];const b=new THREE.Box3().makeEmpty();
    for(const mesh of group){
      const pos=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index;
      const count=idx?idx.count:pos.count;
      if(count>300000||count%3!==0){skipped++;continue;}
      for(let k=0;k<count;k++){
        const vi=idx?idx.getX(k):k;
        const v=new THREE.Vector3().fromBufferAttribute(pos,vi).applyMatrix4(mesh.matrixWorld);
        if(![v.x,v.y,v.z].every(Number.isFinite))continue;
        points.push(v);b.expandByPoint(v);
      }
    }
    if(points.length<3||b.isEmpty()){skipped++;continue;}
    const size=b.getSize(new THREE.Vector3());
    if([size.x,size.y,size.z].some(v=>!Number.isFinite(v)||v<0.0001)){skipped++;continue;}
    if(points.length>300000)throw new Error('Componente muito complexo; simplifique sua malha no SketchUp antes de importar');
    const center=b.getCenter(new THREE.Vector3());
    const positions=[];
    for(const v of points){
      positions.push(Number(((v.x-center.x)/size.x).toFixed(6)),Number(((v.y-center.y)/size.y).toFixed(6)),Number(((v.z-center.z)/size.z).toFixed(6)));
    }
    const name=String(owner.name||group[0].name||`Componente ${parts.length+1}`).trim().slice(0,100);
    parts.push({name,b,size,positions});
  }
  if(!parts.length)throw new Error('O DAE não contém geometria sólida triangulada reconhecível');
  const all=new THREE.Box3();for(const p of parts)all.union(p.b);
  const origin=all.min,width=all.max.x-origin.x,depth=all.max.z-origin.z,height=all.max.y-origin.y;
  const objects=parts.map(p=>({kind:'imported-mesh',name:p.name,width:p.size.x,depth:p.size.z,height:p.size.y,
    x:p.b.min.x-origin.x+p.size.x/2,yBase:p.b.min.y-origin.y,z:p.b.min.z-origin.z+p.size.z/2,
    materialType:'SketchUp DAE (visual)',excludeFromCutList:true,edgeBands:{},machining:[],forms:[],
    importedMesh:{source:'SketchUp DAE',positions:p.positions}}));
  const w=Math.max(width,.01),d=Math.max(depth,.01),h=Math.max(height,.01);
  const space={id:'sketchup-space',name:file.name.replace(/\.dae$/i,''),x:w/2,yBase:0,z:d/2,width:w,depth:d,height:h,cells:[],fixedBands:{x:[],y:[],z:[]}};
  return {record:{type:'mini-cad-furniture',version:66,unit:'meter',name:space.name,objects,spaces:[space],production:{}},sketchup:true,skipped,recognized:parts.length};
}
// DesignLab Bridge v1: pacote JSON próprio da extensão SketchUp.
// Materiais e indícios de fitas são preservados para conferência; não inferir
// automaticamente qual lado recebe fita quando não há metadados normalizados.
async function designLabRecordFromBridge(file){
  if(file.size>32*1024*1024)throw new Error('Pacote maior que 32 MB. Exporte em etapas.');
  const data=JSON.parse(await file.text());
  if(data?.format!=='designlab-bridge'||data.schemaVersion!==1||data.units!=='mm'||!Array.isArray(data.components))throw new Error('Pacote DesignLab Bridge inválido ou incompatível.');
  if(!data.components.length||data.components.length>5000)throw new Error('Quantidade de componentes inválida.');
  const parts=[];
  for(const [index,component] of data.components.entries()){
    if(!Array.isArray(component.faces))continue;
    const points=[];const faceMaterials=[];const paintedFaces=[];
    for(const face of component.faces){
      if(!Array.isArray(face.triangles)||face.triangles.length%9!==0)throw new Error('Malha triangular inválida no componente '+(index+1));
      for(let j=0;j<face.triangles.length;j+=9){
        // SketchUp Z-up → Three.js Y-up. Inverter ordem para manter a orientação das faces.
        for(const shift of [0,6,3]){
          const x=Number(face.triangles[j+shift]),y=Number(face.triangles[j+shift+1]),z=Number(face.triangles[j+shift+2]);
          if(![x,y,z].every(Number.isFinite)||Math.max(Math.abs(x),Math.abs(y),Math.abs(z))>1e7)throw new Error('Coordenadas inválidas no pacote.');
          points.push([x/1000,z/1000,y/1000]);
        }
      }
      if(face.frontMaterial||face.backMaterial){
        faceMaterials.push({front:face.frontMaterial||null,back:face.backMaterial||null,attributes:face.attributes||{}});
        const coords=face.triangles;
        const bounds=[0,1,2].map(axis=>{
          const vals=[];for(let k=axis;k<coords.length;k+=3)vals.push(Number(coords[k]));
          return [Math.min(...vals),Math.max(...vals)];
        });
        paintedFaces.push({bounds,front:face.frontMaterial||null,back:face.backMaterial||null});
      }
    }
    if(points.length<3)continue;
    if(points.length>360000)throw new Error('Componente grande demais: simplifique a malha.');
    const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
    for(const pt of points)for(let k=0;k<3;k++){low[k]=Math.min(low[k],pt[k]);high[k]=Math.max(high[k],pt[k]);}
    const size=high.map((v,k)=>v-low[k]);
    if(size.some(x=>!Number.isFinite(x)||x<0.00005))continue;
    const center=high.map((v,k)=>(v+low[k])/2);
    const positions=points.flatMap(pt=>pt.map((v,k)=>Number(((v-center[k])/size[k]).toFixed(6))));
    // Face-painted band candidates. SketchUp face axes: X,Y,Z; Three.js X,Z,Y.
    // Candidates are diagnostic ONLY until local orientation and OCL materials are verified.
    const thinAxis=size.indexOf(Math.min(...size));
    const longAxes=[0,1,2].filter(a=>a!==thinAxis);
    const edgeBandCandidates={};
    for(const face of paintedFaces){
      const rect=[face.bounds[0],face.bounds[2],face.bounds[1]]; // X,Z,Y in metres? bounds are mm, remap below
      const sketchBounds=face.bounds;
      const b=[[sketchBounds[0][0]/1000,sketchBounds[0][1]/1000],
               [sketchBounds[2][0]/1000,sketchBounds[2][1]/1000],
               [sketchBounds[1][0]/1000,sketchBounds[1][1]/1000]];
      for(let k=0;k<2;k++){
        const axis=longAxes[k];const span=b[axis][1]-b[axis][0];
        if(span>Math.max(.0004,size[axis]*.002))continue;
        const side=Math.abs(b[axis][0]-low[axis])<=Math.max(.0005,size[axis]*.003)?'Min':
                   Math.abs(b[axis][0]-(low[axis]+size[axis]))<=Math.max(.0005,size[axis]*.003)?'Max':null;
        if(!side)continue;
        const other=longAxes[1-k];
        if(b[thinAxis][1]-b[thinAxis][0]<size[thinAxis]*.65 || b[other][1]-b[other][0]<size[other]*.65)continue;
        const material=face.front||face.back;
        if(!material?.name)continue;
        const key=(k?'v':'u')+side;
        (edgeBandCandidates[key]??=[]).push(String(material.name));
      }
    }
    const bandHints=Object.fromEntries(Object.entries(edgeBandCandidates).map(([key,names])=>[key,[...new Set(names)]]));
    parts.push({name:String(component.name||component.definition||`Peça ${index+1}`).slice(0,120),low,size,positions,
      id:String(component.id||index),material:component.material||null,faceMaterials,bandHints,
      attributes:component.attributes||{}});
  }
  if(!parts.length)throw new Error('O pacote não contém componentes sólidos reconhecíveis.');
  const low=[0,1,2].map(k=>Math.min(...parts.map(p=>p.low[k])));
  const hi=[0,1,2].map(k=>Math.max(...parts.map(p=>p.low[k]+p.size[k])));
  const dims=hi.map((v,k)=>Math.max(.01,v-low[k]));
  const objects=parts.map(p=>({kind:'imported-mesh',name:p.name,width:Number((p.size[0]).toFixed(6)),height:Number((p.size[1]).toFixed(6)),depth:Number((p.size[2]).toFixed(6)),
    x:p.low[0]-low[0]+p.size[0]/2,yBase:p.low[1]-low[1],z:p.low[2]-low[2]+p.size[2]/2,
    materialType:p.material?.name||'SketchUp / OpenCutList · conferir',excludeFromCutList:true,
    edgeBands:{},machining:[],forms:[],
    importedMesh:{source:'DesignLab Bridge / SketchUp',positions:p.positions,bridgeMetadata:{componentId:p.id,material:p.material,faceMaterials:p.faceMaterials,attributes:p.attributes,edgeBandCandidates:p.bandHints,edgeBandStatus:'conferir'}},
    bridgeMetadata:{componentId:p.id,material:p.material,faceMaterials:p.faceMaterials,attributes:p.attributes,edgeBandCandidates:p.bandHints,edgeBandStatus:'conferir',
      note:'Materiais de faces exportados para conferência; orientação de fitas não validada.'}}));
  const name=String(data.projectName||file.name.replace(/\.dlbridge\.json$/i,'')).slice(0,160);
  const space={id:'bridge-space',name,x:dims[0]/2,yBase:0,z:dims[2]/2,width:dims[0],depth:dims[2],height:dims[1],cells:[],fixedBands:{x:[],y:[],z:[]}};
  return {record:{type:'mini-cad-furniture',version:66,unit:'meter',name,objects,spaces:[space],production:{},
    bridgeMetadata:{source:'SketchUp / OpenCutList',materials:Array.isArray(data.materials)?data.materials:[],verifiedEdges:false}},
    sketchup:true,recognized:parts.length,skipped:data.components.length-parts.length,bridge:true};
}
async function designLabFurnitureRecordFromFile(file){
  const lower=String(file?.name||'').toLowerCase();
  if(lower.endsWith('.dlbridge.json'))return designLabRecordFromBridge(file);
  if(lower.endsWith('.dae'))return designLabRecordFromSketchupDae(file);
  if(lower.endsWith('.skp'))throw new Error('Para importar do SketchUp, exporte como COLLADA (.dae). O formato .skp direto ainda não é suportado.');
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
  for(const r of runtimeModel.spaceRoots){ max=Math.max(max,r.x+r.width/2); has=true; }
  for(const o of runtimeModel.objects){ const b=objectBounds(o); max=Math.max(max,b.maxX); has=true; }
  return has?max:0;
}
function importFurnitureData(data){
  if(!data || !Array.isArray(data.spaces) || !data.spaces.length || !Array.isArray(data.objects)) throw new Error('Arquivo não contém um móvel válido');
  mergeProjectProductionState(data.production);
  const src=JSON.parse(JSON.stringify(data.spaces[0]));
  const w=Number(src.width),d=Number(src.depth),h=Number(src.height),sx=Number(src.x),sy=Number(src.yBase),sz=Number(src.z);
  if(![w,d,h,sx,sy,sz].every(Number.isFinite)||w<=0||d<=0||h<=0) throw new Error('Medidas do móvel inválidas');
  const srcMinX=sx-w/2, srcMinY=sy, srcMinZ=sz-d/2;
  const hasScene=runtimeModel.spaceRoots.length||runtimeModel.objects.length;
  const dstMinX=hasScene?projectMaxX()+.2:0, dstMinY=0, dstMinZ=0;
  const dx=dstMinX-srcMinX,dy=dstMinY-srcMinY,dz=dstMinZ-srcMinZ;
  const newRootId=uid('space'),cellIdMap=new Map();
  const importedCells=(src.cells||[]).map(c=>{const nid=uid('cell');cellIdMap.set(c.id,nid);return {...c,id:nid,minX:Number(c.minX)+dx,maxX:Number(c.maxX)+dx,minY:Number(c.minY)+dy,maxY:Number(c.maxY)+dy,minZ:Number(c.minZ)+dz,maxZ:Number(c.maxZ)+dz,fixedAxes:{...(c.fixedAxes||{})}};});
  const rootData={...src,id:newRootId,name:data.name||src.name||'Móvel importado',x:sx+dx,yBase:sy+dy,z:sz+dz,doorsHidden:!!src.doorsHidden,spaceHidden:false,
    fixedBands:{x:(src.fixedBands?.x||[]).map(v=>[...v]),y:(src.fixedBands?.y||[]).map(v=>[...v]),z:(src.fixedBands?.z||[]).map(v=>[...v])},
    cells:importedCells};
  ctx.historyMuted=true;
  const root=createSpaceFromState(rootData);
  for(const p of data.objects){
    if(p?.doorHandleVisual)continue;
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
      createdPart=createBox({width:ww,depth:dd,height:hh,x:xx,yBase:yy,z:zz,name:p.name||'Peça',kind:p.kind||'box',materialType:p.materialType||'genérico',baseColor:p.baseColor??COLORS.default,materialId:p.materialId||null,materialCode:p.materialCode||'',materialGrain:!!p.materialGrain,materialGrainRotation:normalizePieceGrainRotation(p.materialGrainRotation),materialCoreColor:p.materialCoreColor||null,edgeBands:p.edgeBands||{},partId:p.partId||null,labelMeta:p.labelMeta||null,spaceRootId:newRootId,machining:p.machining||[],forms:p.forms||[],rotationY:p.rotationY||0,curvedRole:p.curvedRole||null,curvedConfig:p.curvedConfig||null,drawerSetId:p.drawerSetId||null,drawerRole:p.drawerRole||null,drawerIndex:p.drawerIndex??null,drawerConfig:dc,doorConfig:doorCfg,doorSystem:p.doorSystem||null,excludeFromCutList:!!p.excludeFromCutList,spaceCutting:!!p.spaceCutting,spaceCutParentBounds:p.spaceCutParentBounds||null,cutPlanSheetHint:p.cutPlanSheetHint||null},false);
    }
    if(createdPart){copyLibraryPartMeta(createdPart,p);if(p.importedMesh)applyImportedMeshGeometry(THREE,createdPart,p.importedMesh);}
  }
  repairOrphanSpaceGaps(root);
  renderSpaces(); applyAllDoorVisibility(); renderMachiningVisuals();
  const firstVisible=root.cells.find(c=>!c.hidden)||root.cells[0]; if(firstVisible)selectSpaceCellByIds(root.id,firstVisible.id);
  frontViewToSpace(root); ctx.historyMuted=false; commitHistory();
  toast(`Móvel importado · ${data.objects.length} peça(s)`);
}

  return {safeFileName,downloadText,selectedFurnitureRoot,objectBounds,objectBelongsToRoot,furnitureObjects,captureFurniture,dxfModelCleanLayerName,dxfModelNumber,designLabUtf8ToBase64,designLabBase64ToUtf8,designLabDxfPayloadComments,dxfPairs,designLabRecordFromDxfPayload,dxfImportedPartName,dxfFallbackNewBounds,dxfFallbackAddPoint,dxfFallbackBoundsValid,dxfFallbackLayerThicknessMm,dxfFallbackObjectFrom3DBounds,dxfFallbackObjectFromPlanarBounds,dxfFallbackPlanarSpace,designLabFallbackRecordFromDxf,designLabFurnitureRecordFromImportedFile,designLabFurnitureRecordFromFile,importLibraryFile,exportSelectedFurniture,designLabStlTrailer,designLabRecordFromStlBuffer,furnitureModelTriangleCount,buildFurnitureModelStl,dxfModelFace,furnitureModelMeshes,buildFurnitureModelDxf,designLabIsMobileLike,projectMaxX,importFurnitureData};
}
