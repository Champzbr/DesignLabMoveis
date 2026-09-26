// DesignLabMoveis 1.311.00 · Biblioteca de modelos/componentes.
export function createLibraryModule(ctx){
  const { $, uid, toast, nice, adminDate, getSpaceRoot, getSpaceCell, cellSize, cellCenter, createBox, COLORS, commitHistory, mm, isSpaceCuttingPieceForHeal, objectInsideSpaceRoot, rootBounds, curvedPostSamplesMm, curvedPostPlacementFromSampleMm, MM_TO_M, normalizePieceGrainRotation, normalizePieceEdgeBands, productionClone, restoreBaseColor, cloneMachiningForTargetSize, createCylinder, createCurvedRib, createCurvedCover, createCurvedPost, pieceMappedGeometryWithManualDelta, renderSpaces, selectSpaceCellByIds, pieceParametricBaseFromRecord, renderMachiningVisuals, cloudApiFetch, adminAllowed, selectedFurnitureRoot, safeFileName, captureFurniture, pieceThicknessInfo, parseDecimalInput, setVisualMode, roundMmNumber, pieceLocalAxisVector, selectObject, disposeObject, updateMeasureBadge, m }=ctx;
  const runtimeModel=ctx.runtimeModel;
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
  if(!ctx.selectedSpaceCell)return null; const root=getSpaceRoot(ctx.selectedSpaceCell.rootId),cell=getSpaceCell(ctx.selectedSpaceCell.rootId,ctx.selectedSpaceCell.cellId); if(!root||!cell)return null;
  return {root,cell,size:cellSize(cell),center:cellCenter(cell)};
}
function createCabinetInCell(info){
  const c=info.cell,s=info.size,t=.018,b=.006; if(s.width<=2*t||s.height<=2*t||s.depth<=b){toast('Espaço pequeno para caixa MDF 18 mm');return;}
  ctx.historyMuted=true;
  createBox({width:t,depth:s.depth,height:s.height,x:c.minX+t/2,yBase:c.minY,z:info.center.z,name:'Lateral esquerda',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:t,depth:s.depth,height:s.height,x:c.maxX-t/2,yBase:c.minY,z:info.center.z,name:'Lateral direita',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:s.width-2*t,depth:s.depth,height:t,x:info.center.x,yBase:c.minY,z:info.center.z,name:'Base',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:s.width-2*t,depth:s.depth,height:t,x:info.center.x,yBase:c.maxY-t,z:info.center.z,name:'Topo',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  createBox({width:s.width-2*t,depth:b,height:s.height-2*t,x:info.center.x,yBase:c.minY+t,z:c.minZ+b/2,name:'Fundo 6 mm',kind:'panel',materialType:'MDF',baseColor:COLORS.panel},false);
  ctx.historyMuted=false; commitHistory(); toast('Caixa MDF inserida');
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

// 1.200.90 · Para o cálculo paramétrico do móvel, fixedBands é a fonte de
// verdade. cell.fixedAxes é mantido por compatibilidade e pela UI, mas em
// modelos que passaram por vários cortes ele pode ter sido herdado por uma
// célula maior do que a faixa originalmente travada. Isso fazia um vão inteiro
// entrar na soma dos fixos. Se existem fixedBands persistentes usamos SOMENTE
// elas; células antigas entram apenas como fallback quando não há banda salva.
function stableFixedIntervalsFromSpace(space,axis){
  if(!space)return [];
  const bounds=layoutBoundsFromSpace(space);
  const rootMin=bounds ? (axis==='x'?bounds.minX:axis==='y'?bounds.minY:bounds.minZ) : 0;
  const persistent=mergeIntervals((space.fixedBands?.[axis]||[])
    .map(([a,b])=>[rootMin+Number(a),rootMin+Number(b)])
    .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a+1e-9));
  if(persistent.length)return persistent;
  const minKey=axis==='x'?'minX':axis==='y'?'minY':'minZ';
  const maxKey=axis==='x'?'maxX':axis==='y'?'maxY':'maxZ';
  const legacy=[];
  for(const c of (space.cells||[])){
    if(!c.fixedAxes?.[axis])continue;
    const a=Number(c[minKey]),b=Number(c[maxKey]);
    if(Number.isFinite(a)&&Number.isFinite(b)&&b>a+1e-9)legacy.push([a,b]);
  }
  return mergeIntervals(legacy);
}
// 1.200.90 · Reconstrói as faixas REALMENTE marcadas como travadas a
// partir da árvore manualCut. Esta é a fonte mais fiel da intenção do usuário:
// cada corte guarda side + parentBounds + isFixed. Em modelos que passaram por
// Biblioteca/edições antigas, fixedBands/fixedAxes podem ter sido perdidos,
// herdados ou mesclados de forma incorreta; a árvore do corte ainda permite
// recuperar exatamente a faixa que nasceu travada.
function explicitFixedIntervalsFromManualCuts(space,axis){
  if(!space||!Array.isArray(space.cells)||!space.cells.length)return [];
  const minK=axis==='x'?'minX':axis==='y'?'minY':'minZ';
  const maxK=axis==='x'?'maxX':axis==='y'?'maxY':'maxZ';
  const axisForSide=side=>(side==='left'||side==='right')?'x':((side==='front'||side==='back')?'z':'y');
  const lowSide=side=>side==='left'||side==='bottom'||side==='back';
  const tol=.00005;
  const cuts=new Map();
  const addChain=meta=>{
    let m=meta,guard=0;
    while(m&&typeof m==='object'&&guard++<100){
      const ax=m.axis||axisForSide(m.side);
      if(m.isFixed&&ax===axis&&m.parentBounds){
        const pb=m.parentBounds;
        const a=Number(pb[minK]),b=Number(pb[maxK]);
        if(Number.isFinite(a)&&Number.isFinite(b)&&b>a+1e-9){
          const key=m.id||`${axis}|${m.side}|${a.toFixed(7)}|${b.toFixed(7)}`;
          if(!cuts.has(key))cuts.set(key,{...m,__a:a,__b:b});
        }
      }
      m=m.parentMeta||null;
    }
  };
  for(const c of space.cells)addChain(c.manualCut);
  if(!cuts.size)return [];

  const insideParent=(c,pb)=>{
    for(const [lo,hi] of [['minX','maxX'],['minY','maxY'],['minZ','maxZ']]){
      const a=Number(c[lo]),b=Number(c[hi]),pa=Number(pb[lo]),pbv=Number(pb[hi]);
      if(![a,b,pa,pbv].every(Number.isFinite))return false;
      if(a<pa-tol||b>pbv+tol)return false;
    }
    return true;
  };
  const out=[];
  for(const cut of cuts.values()){
    const a=cut.__a,b=cut.__b,pb=cut.parentBounds;
    const boundaries=[];
    for(const c of space.cells){
      if(!insideParent(c,pb))continue;
      const c0=Number(c[minK]),c1=Number(c[maxK]);
      if(c0>a+tol&&c0<b-tol)boundaries.push(c0);
      if(c1>a+tol&&c1<b-tol)boundaries.push(c1);
    }
    const uniq=[...new Set(boundaries.map(v=>Number(v.toFixed(9))))].sort((x,y)=>x-y);
    if(!uniq.length)continue;
    const boundary=lowSide(cut.side)?uniq[0]:uniq[uniq.length-1];
    const interval=lowSide(cut.side)?[a,boundary]:[boundary,b];
    if(interval[1]>interval[0]+1e-9)out.push(interval);
  }
  return mergeIntervals(out);
}

function stableFixedIntervalsForParametricSpace(space,axis){
  // Se a árvore informa explicitamente quais cortes foram travados, ela vence.
  // Assim a conta usa SOMENTE o que o usuário travou, como solicitado.
  const explicit=explicitFixedIntervalsFromManualCuts(space,axis);
  if(explicit.length)return explicit;
  // Compatibilidade com modelos sem manualCut completo.
  return stableFixedIntervalsFromSpace(space,axis);
}

function fixedGapPlan(srcMin,srcMax,fixedIntervals){
  const fixed=mergeIntervals((fixedIntervals||[])
    .map(([a,b])=>[Math.max(srcMin,Number(a)),Math.min(srcMax,Number(b))])
    .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a+1e-9));
  const segments=[];let cursor=srcMin;
  for(const [a,b] of fixed){
    if(a>cursor+1e-9)segments.push({kind:'free',a:cursor,b:a});
    segments.push({kind:'fixed',a,b});cursor=Math.max(cursor,b);
  }
  if(cursor<srcMax-1e-9)segments.push({kind:'free',a:cursor,b:srcMax});
  return {fixed,segments,free:segments.filter(q=>q.kind==='free'&&q.b-q.a>1e-9),fixedTotal:fixed.reduce((n,[a,b])=>n+(b-a),0)};
}

// 1.200.90 · Uma peça estrutural criada dentro do espaço (lateral, base,
// chapéu, divisão, prateleira, frente/fundo etc.) ocupa uma faixa física que
// também deve manter a espessura nominal durante o redimensionamento. Em
// versões anteriores, somente fixedBands/cell.fixedAxes entravam no cálculo;
// se a peça tinha sido criada diretamente, a faixa dela podia ser tratada como
// parte do vão solto e os vãos terminavam com larguras diferentes.
function libraryPartRecordIsStructural(p){
  if(!p||typeof p!=='object')return false;
  if(p.spaceCutting===true||p.spaceCutParentBounds)return true;
  const name=String(p.name||'').trim();
  // Compatibilidade com blocos antigos da Biblioteca, salvos antes de
  // spaceCutting ser persistido em todos os registros. Estes nomes são as
  // peças que realmente retiram uma faixa do vão ao serem criadas.
  return /^(Lateral esquerda|Lateral direita|Divisão vertical|Divisão central|Base|Chapéu|Chapeu|Topo|Prateleira(?:\s+\d+)?|Fundo(?:\s+6\s*mm)?|Frente|Travessa|Régua|Regua|Montante)$/i.test(name);
}
function structuralFixedIntervalsFromPartRecords(parts,axis,bounds=null){
  const out=[];
  for(const p of (Array.isArray(parts)?parts:[])){
    if(!libraryPartRecordIsStructural(p))continue;
    const dims={x:Number(p.width),y:Number(p.height),z:Number(p.depth)};
    if(!Object.values(dims).every(Number.isFinite))continue;
    const thicknessAxis=['x','y','z'].sort((a,b)=>dims[a]-dims[b])[0];
    if(thicknessAxis!==axis)continue;
    const thickness=dims[axis];
    // Evita transformar volumes grossos em "espessura de chapa" por engano.
    // 120 mm cobre com folga MDF, compensado, sarrafos/réguas estruturais.
    if(!(thickness>.0001&&thickness<=.12))continue;
    const center=axis==='x'?Number(p.x):axis==='y'?(Number(p.yBase)+dims.y/2):Number(p.z);
    if(!Number.isFinite(center))continue;
    let a=center-thickness/2,b=center+thickness/2;
    if(bounds){
      const lo=axis==='x'?bounds.minX:axis==='y'?bounds.minY:bounds.minZ;
      const hi=axis==='x'?bounds.maxX:axis==='y'?bounds.maxY:bounds.maxZ;
      a=Math.max(lo,a);b=Math.min(hi,b);
    }
    if(b>a+1e-9)out.push([a,b]);
  }
  return mergeIntervals(out);
}
function structuralFixedIntervalsFromRoot(root,axis,bounds=null){
  if(!root)return [];
  const parts=[];
  for(const o of runtimeModel.objects){
    const u=o?.userData||{};
    // Também reconhece peças de projetos antigos pelo papel estrutural/nome.
    if(!(u.spaceCutting===true||u.spaceCutParentBounds||isSpaceCuttingPieceForHeal(o)))continue;
    if(!(u.spaceRootId===root.id||objectInsideSpaceRoot(o,root)))continue;
    parts.push({
      spaceCutting:true,
      width:Number(u.width),height:Number(u.height),depth:Number(u.depth),
      x:Number(o.position.x),yBase:Number(o.position.y)-Number(u.height)/2,z:Number(o.position.z)
    });
  }
  return structuralFixedIntervalsFromPartRecords(parts,axis,bounds||rootBounds(root));
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

// 1.200.90 · Ao redimensionar o móvel inteiro, faixas travadas continuam com
// a medida exata e TODOS os vãos soltos entre elas passam a dividir igualmente
// o espaço que sobrar. O mapper antigo acima continua sendo usado pelo editor
// pontual de um único vão, onde preservar a geometria local é mais seguro.
function makeBalancedFixedAxisMapper(srcMin,srcMax,dstMin,dstMax,fixedIntervals){
  const srcLen=srcMax-srcMin, dstLen=dstMax-dstMin;
  const clipped=mergeIntervals((fixedIntervals||[])
    .map(([a,b])=>[Math.max(srcMin,Number(a)),Math.min(srcMax,Number(b))])
    .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a));
  const fixedTotal=clipped.reduce((n,[a,b])=>n+(b-a),0);
  if(dstLen+1e-9<fixedTotal) throw new Error(`Destino menor que as medidas fixas (${mm(fixedTotal)} mm)`);

  // Monta a sequência real do eixo: vão solto / faixa fixa / vão solto...
  const segments=[];
  let cursor=srcMin;
  for(const [a,b] of clipped){
    if(a>cursor+1e-9)segments.push({kind:'free',a:cursor,b:a});
    segments.push({kind:'fixed',a,b});
    cursor=Math.max(cursor,b);
  }
  if(cursor<srcMax-1e-9)segments.push({kind:'free',a:cursor,b:srcMax});

  const freeSegments=segments.filter(s=>s.kind==='free'&&s.b-s.a>1e-9);
  if(freeSegments.length<2)return makeFixedAxisMapper(srcMin,srcMax,dstMin,dstMax,clipped);

  const targetFreeTotal=Math.max(0,dstLen-fixedTotal);
  const targetEach=targetFreeTotal/freeSegments.length;
  let outCursor=dstMin;
  for(const seg of segments){
    seg.srcLen=Math.max(0,seg.b-seg.a);
    seg.dstA=outCursor;
    seg.dstLen=seg.kind==='fixed'?seg.srcLen:targetEach;
    seg.dstB=seg.dstA+seg.dstLen;
    outCursor=seg.dstB;
  }

  return value=>{
    const v=Math.min(srcMax,Math.max(srcMin,Number(value)));
    if(v<=srcMin)return dstMin;
    if(v>=srcMax)return dstMax;
    let seg=segments.find(s=>v>=s.a-1e-9&&v<=s.b+1e-9);
    if(!seg)seg=segments[segments.length-1];
    const t=seg.srcLen>1e-12?(v-seg.a)/seg.srcLen:0;
    return seg.dstA+Math.max(0,Math.min(1,t))*seg.dstLen;
  };
}

// 1.200.90 · O balanceamento usa os TRAVAMENTOS EXPLÍCITOS do modelo.
// Dois vãos soltos podem encostar na mesma coordenada de corte
// (com uma peça divisória sobre essa linha) e, nesse caso, o mapper antigo via
// tudo como um único trecho solto e preservava a proporção antiga. Aqui cada
// intervalo topológico entre bordas de células vira uma faixa independente.
// Faixas explicitamente travadas continuam fixas; nenhuma peça ou intervalo é
// transformado em fixo por inferência. O que não está travado é espaço livre.
// 1.200.90 · REGRA DIRETA PARA O MÓVEL PARAMÉTRICO.
// O eixo é tratado como uma conta simples:
//   medida nova - soma das faixas travadas = espaço livre
//   espaço livre / quantidade de vãos soltos = medida de cada vão
//
// O ponto importante é descobrir a quantidade REAL de vãos no eixo sem deixar
// cortes locais (por exemplo um corte só em uma gaveta) fazerem um vão valer 2x.
// Para isso medimos quanto cada borda de célula atravessa da seção do móvel.
// Uma borda que aparece numa parcela grande da seção é uma divisão principal;
// uma borda local é ignorada para o balanceamento do móvel inteiro.
function balancedAxisCellCrossArea(cell,axis){
  const dx=Math.max(0,Number(cell?.maxX)-Number(cell?.minX));
  const dy=Math.max(0,Number(cell?.maxY)-Number(cell?.minY));
  const dz=Math.max(0,Number(cell?.maxZ)-Number(cell?.minZ));
  if(axis==='x')return dy*dz;
  if(axis==='y')return dx*dz;
  return dx*dy;
}
function balancedAxisRootCrossArea(space,axis){
  const b=layoutBoundsFromSpace(space);if(!b)return 0;
  const dx=Math.max(0,b.maxX-b.minX),dy=Math.max(0,b.maxY-b.minY),dz=Math.max(0,b.maxZ-b.minZ);
  if(axis==='x')return dy*dz;
  if(axis==='y')return dx*dz;
  return dx*dy;
}
function balancedAxisPrimaryBoundaries(space,axis,srcMin,srcMax,fixedIntervals=[]){
  const minKey=axis==='x'?'minX':axis==='y'?'minY':'minZ';
  const maxKey=axis==='x'?'maxX':axis==='y'?'maxY':'maxZ';
  const cells=Array.isArray(space?.cells)?space.cells:[];
  const rootCross=balancedAxisRootCrossArea(space,axis);
  const snap=Math.max(1e-7,Math.abs(srcMax-srcMin)*1e-8);
  const groups=[];
  const findGroup=v=>{
    let g=groups.find(q=>Math.abs(q.p-v)<=snap);
    if(!g){g={p:v,left:0,right:0};groups.push(g);}return g;
  };
  for(const c of cells){
    const a=Number(c?.[minKey]),b=Number(c?.[maxKey]),area=balancedAxisCellCrossArea(c,axis);
    if(!Number.isFinite(a)||!Number.isFinite(b)||!(b>a+1e-10)||!(area>0))continue;
    if(a>srcMin+snap&&a<srcMax-snap)findGroup(a).right+=area;
    if(b>srcMin+snap&&b<srcMax-snap)findGroup(b).left+=area;
  }
  const points=[srcMin,srcMax];
  // 55% é proposital: laterais/frentes/base podem retirar uma faixa da seção,
  // mas uma divisão principal ainda atravessa a maior parte do móvel. Um corte
  // local em apenas uma gaveta/prateleira normalmente fica abaixo deste valor.
  const minCoverage=.55;
  for(const g of groups){
    const coverage=rootCross>1e-12?Math.min(g.left,g.right)/rootCross:0;
    if(coverage>=minCoverage)points.push(g.p);
  }
  // Toda borda de uma faixa travada é obrigatoriamente uma borda principal.
  for(const [a,b] of fixedIntervals||[]){
    if(Number.isFinite(a)&&a>srcMin+snap&&a<srcMax-snap)points.push(a);
    if(Number.isFinite(b)&&b>srcMin+snap&&b<srcMax-snap)points.push(b);
  }
  points.sort((a,b)=>a-b);
  const uniq=[];
  for(const v of points){
    if(!Number.isFinite(v))continue;
    if(!uniq.length||Math.abs(v-uniq[uniq.length-1])>snap)uniq.push(v);
  }
  return uniq;
}
function balancedAxisSegmentFixedByCells(space,axis,a,b){
  const mid=(a+b)/2;
  const minKey=axis==='x'?'minX':axis==='y'?'minY':'minZ';
  const maxKey=axis==='x'?'maxX':axis==='y'?'maxY':'maxZ';
  let all=0,fixed=0;
  for(const c of (space?.cells||[])){
    const c0=Number(c?.[minKey]),c1=Number(c?.[maxKey]);
    if(!Number.isFinite(c0)||!Number.isFinite(c1)||mid<c0-1e-8||mid>c1+1e-8)continue;
    const area=balancedAxisCellCrossArea(c,axis);if(!(area>0))continue;
    all+=area;if(c.fixedAxes?.[axis])fixed+=area;
  }
  return all>1e-12&&fixed/all>=.5;
}
function makeBalancedSpaceAxisMapper(space,axis,srcMin,srcMax,dstMin,dstMax,extraFixedIntervals=[]){
  const dstLen=dstMax-dstMin,srcLen=srcMax-srcMin;
  // 1.300.25 · Se o tamanho do eixo NÃO mudou, o mapeamento precisa ser
  // exatamente uma translação. Antes, simplesmente abrir Configuração do
  // Espaço e salvar (por exemplo só para trocar o material) executava de novo
  // o balanceamento dos vãos soltos e podia redistribuir o móvel mesmo com a
  // mesma medida externa.
  const savedFixed=stableFixedIntervalsForParametricSpace(space,axis);
  if(Math.abs(dstLen-srcLen)<=1e-9){
    const shift=dstMin-srcMin;
    const sourceFixed=mergeIntervals([...savedFixed,...(extraFixedIntervals||[])]
      .map(([a,b])=>[Math.max(srcMin,Number(a)),Math.min(srcMax,Number(b))])
      .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a+1e-9));
    const mapper=value=>Number(value)+shift;
    mapper.__designLabBalance={axis,mode:'same-size-preserve-exactly',freeCount:null,fixedCount:sourceFixed.length,fixedTotal:sourceFixed.reduce((n,[a,b])=>n+(b-a),0),targetEach:null,sourceFixedIntervals:sourceFixed.map(v=>[...v])};
    return mapper;
  }
  // Regra direta pedida para a Biblioteca/redimensionamento:
  // novo total - soma dos travados = restante; restante / vãos soltos.
  // Não usamos a quantidade de células para a conta quando já há bandas
  // travadas/peças estruturais separando os vãos.
  const fixed=mergeIntervals([...savedFixed,...(extraFixedIntervals||[])]
    .map(([a,b])=>[Math.max(srcMin,Number(a)),Math.min(srcMax,Number(b))])
    .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a+1e-9));
  const plan=fixedGapPlan(srcMin,srcMax,fixed);
  if(dstLen+1e-9<plan.fixedTotal)throw new Error(`Destino menor que as medidas travadas (${nice(mm(plan.fixedTotal))} mm)`);

  if(plan.free.length>=2){
    const each=Math.max(0,dstLen-plan.fixedTotal)/plan.free.length;
    let cursor=dstMin;
    const segments=plan.segments.map(seg=>{
      const srcLen=seg.b-seg.a;
      const dstLenSeg=seg.kind==='fixed'?srcLen:each;
      const out={...seg,srcLen,dstA:cursor,dstLen:dstLenSeg,dstB:cursor+dstLenSeg};
      cursor=out.dstB;return out;
    });
    if(segments.length)segments[segments.length-1].dstB=dstMax;
    const mapper=value=>{
      const v=Math.min(srcMax,Math.max(srcMin,Number(value)));
      if(v<=srcMin)return dstMin;if(v>=srcMax)return dstMax;
      let seg=segments.find(q=>v>=q.a-1e-9&&v<=q.b+1e-9);
      if(!seg)seg=segments[segments.length-1];
      const t=seg.srcLen>1e-12?(v-seg.a)/seg.srcLen:0;
      return seg.dstA+Math.max(0,Math.min(1,t))*seg.dstLen;
    };
    mapper.__designLabBalance={axis,mode:'direct-fixed-minus-equal-free',freeCount:plan.free.length,fixedCount:plan.fixed.length,fixedTotal:plan.fixedTotal,targetEach:each,sourceFixedIntervals:plan.fixed.map(v=>[...v])};
    return mapper;
  }

  // Compatibilidade para modelos sem bandas físicas suficientes (cortes de
  // espessura zero/formatos muito antigos): tenta a topologia apenas como
  // fallback. Ela nunca substitui a conta direta quando fixedBands existem.
  const points=balancedAxisPrimaryBoundaries(space,axis,srcMin,srcMax,fixed);
  const topo=[];const tol=1e-8;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];if(!(b>a+1e-9))continue;
    const mid=(a+b)/2;
    const fixedByBand=fixed.some(([f0,f1])=>mid>=f0-tol&&mid<=f1+tol);
    topo.push({kind:fixedByBand?'fixed':'free',a,b});
  }
  const topoFree=topo.filter(q=>q.kind==='free'&&q.b-q.a>1e-9);
  if(topoFree.length>=2){
    const fixedTotal=topo.filter(q=>q.kind==='fixed').reduce((n,q)=>n+(q.b-q.a),0);
    const each=Math.max(0,dstLen-fixedTotal)/topoFree.length;
    let cursor=dstMin;
    for(const seg of topo){seg.srcLen=seg.b-seg.a;seg.dstA=cursor;seg.dstLen=seg.kind==='fixed'?seg.srcLen:each;seg.dstB=cursor+seg.dstLen;cursor=seg.dstB;}
    const mapper=value=>{
      const v=Math.min(srcMax,Math.max(srcMin,Number(value)));
      if(v<=srcMin)return dstMin;if(v>=srcMax)return dstMax;
      const seg=topo.find(q=>v>=q.a-tol&&v<=q.b+tol)||topo[topo.length-1];
      const t=seg.srcLen>1e-12?(v-seg.a)/seg.srcLen:0;
      return seg.dstA+Math.max(0,Math.min(1,t))*seg.dstLen;
    };
    mapper.__designLabBalance={axis,mode:'legacy-topology-fallback',freeCount:topoFree.length,fixedCount:topo.length-topoFree.length,fixedTotal,targetEach:each,sourceFixedIntervals:plan.fixed.map(v=>[...v])};
    return mapper;
  }

  const fallback=makeFixedAxisMapper(srcMin,srcMax,dstMin,dstMax,fixed);
  fallback.__designLabBalance={axis,mode:'single-free',freeCount:plan.free.length,fixedCount:plan.fixed.length,fixedTotal:plan.fixedTotal,targetEach:null,sourceFixedIntervals:plan.fixed.map(v=>[...v])};
  return fallback;
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
  u.doorSystem=p.doorSystem?JSON.parse(JSON.stringify(p.doorSystem)):null;
  u.excludeFromCutList=!!p.excludeFromCutList;
  u.manualGeometryDelta=p.manualGeometryDelta?JSON.parse(JSON.stringify(p.manualGeometryDelta)):null;
  u.pieceSavedConfig=p.pieceSavedConfig?JSON.parse(JSON.stringify(p.pieceSavedConfig)):null;
  u.spaceCutting=!!p.spaceCutting||isSpaceCuttingPieceForHeal(created);
  if(Number.isFinite(Number(p.divisionNominalThicknessM))&&Number(p.divisionNominalThicknessM)>0)u.divisionNominalThicknessM=Number(p.divisionNominalThicknessM);
  restoreBaseColor(created);return created;
}
function createLibraryTemplatePart(p,info,{width,depth,height,x,yBase,z}={}){
  if(!p)return null;
  const sourceDimsMm={x:Number(p.width)*1000,y:Number(p.height)*1000,z:Number(p.depth)*1000};
  const targetDimsMm={x:Number(width)*1000,y:Number(height)*1000,z:Number(depth)*1000};
  const adaptedMachining=cloneMachiningForTargetSize(p.machining||[],sourceDimsMm,targetDimsMm);
  const adaptedPart={...p,machining:adaptedMachining};
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
    created=createBox({width,depth,height,x,yBase,z,name:p.name||'Peça',kind:p.kind||'box',materialType:p.materialType||'genérico',baseColor:p.baseColor??COLORS.default,spaceRootId:info.root.id,machining:adaptedMachining,forms:p.forms||[],doorConfig:p.doorConfig||null,doorSystem:p.doorSystem||null,edgeBands:p.edgeBands||{},materialId:p.materialId||null,materialCode:p.materialCode||'',materialGrain:!!p.materialGrain,materialGrainRotation:normalizePieceGrainRotation(p.materialGrainRotation),materialCoreColor:p.materialCoreColor||null,partId:p.partId||null,labelMeta:p.labelMeta||null,rotationX:Number(p.rotationX)||0,rotationY:Number(p.rotationY)||0,rotationZ:Number(p.rotationZ)||0,manualGeometryDelta:p.manualGeometryDelta||null,pieceSavedConfig:p.pieceSavedConfig||null,curvedRole:p.curvedRole||null,curvedConfig:p.curvedConfig||null,drawerSetId:p.drawerSetId||null,drawerRole:p.drawerRole||null,drawerIndex:p.drawerIndex??null,drawerConfig:p.drawerConfig||null,excludeFromCutList:!!p.excludeFromCutList,spaceCutting:!!p.spaceCutting,spaceCutParentBounds:p.spaceCutParentBounds||null},false);
  }
  return copyLibraryPartMeta(created,adaptedPart);
}
// 1.200.90 · Biblioteca preserva a TOPOLOGIA dos espaços, não somente as peças.
// Antes o modelo salvo trazia layout.space, porém placeCustomTemplate() usava
// esse layout apenas para calcular a escala das peças. O espaço de destino
// continuava sendo uma única célula; por isso tocar em qualquer vão selecionava
// o volume inteiro e, no redimensionamento seguinte, os cortes/travamentos já
// não existiam para o motor paramétrico.
function libraryMapBounds(box,mapX,mapY,mapZ){
  if(!box)return null;
  const x0=mapX(Number(box.minX)),x1=mapX(Number(box.maxX));
  const y0=mapY(Number(box.minY)),y1=mapY(Number(box.maxY));
  const z0=mapZ(Number(box.minZ)),z1=mapZ(Number(box.maxZ));
  if(![x0,x1,y0,y1,z0,z1].every(Number.isFinite))return null;
  return {minX:Math.min(x0,x1),maxX:Math.max(x0,x1),minY:Math.min(y0,y1),maxY:Math.max(y0,y1),minZ:Math.min(z0,z1),maxZ:Math.max(z0,z1)};
}
function libraryCloneTargetManualCut(meta){
  return meta?JSON.parse(JSON.stringify(meta)):null;
}
function libraryTransformManualCut(meta,mapX,mapY,mapZ,cutIdMap,tailMeta=null){
  if(!meta)return libraryCloneTargetManualCut(tailMeta);
  const out={...meta};
  if(meta.id){
    if(!cutIdMap.has(meta.id))cutIdMap.set(meta.id,uid('cut'));
    out.id=cutIdMap.get(meta.id);
  }else out.id=uid('cut');
  if(meta.parentBounds)out.parentBounds=libraryMapBounds(meta.parentBounds,mapX,mapY,mapZ);
  out.parentMeta=meta.parentMeta
    ? libraryTransformManualCut(meta.parentMeta,mapX,mapY,mapZ,cutIdMap,tailMeta)
    : libraryCloneTargetManualCut(tailMeta);
  return out;
}
function libraryInstallSpaceTopology(layoutSpace,info,mapX,mapY,mapZ,lb){
  const root=info?.root,target=info?.cell,srcCells=Array.isArray(layoutSpace?.cells)?layoutSpace.cells:[];
  const result={changed:false,cellIdMap:new Map(),cells:[],selectedCell:null};
  if(!root||!target)return result;

  // Os travamentos do modelo salvo também precisam passar para o root de
  // destino. fixedIntervalsFromSpace cobre tanto fixedBands quanto modelos
  // antigos que só possuem cell.fixedAxes.
  const rb=rootBounds(root);
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  for(const axis of ['x','y','z']){
    const mapper=axis==='x'?mapX:axis==='y'?mapY:mapZ;
    const dstRootMin=axis==='x'?rb.minX:axis==='y'?rb.minY:rb.minZ;
    const sourceFixed=(mapper?.__designLabBalance?.sourceFixedIntervals||stableFixedIntervalsForParametricSpace(layoutSpace,axis));
    const imported=sourceFixed.map(([a,b])=>{
      const na=mapper(Number(a)),nb=mapper(Number(b));
      return [Math.min(na,nb)-dstRootMin,Math.max(na,nb)-dstRootMin];
    }).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a+.0000001);
    root.fixedBands[axis]=mergeIntervals([...(root.fixedBands[axis]||[]),...imported]);
  }

  // Sem subdivisão real não há nada para substituir. Mantemos a célula de
  // destino e somente herdamos os travamentos acima.
  if(srcCells.length<=1){
    if(srcCells[0]?.id)result.cellIdMap.set(srcCells[0].id,target.id);
    result.cells=[target];result.selectedCell=target;
    return result;
  }

  const targetIndex=(root.cells||[]).findIndex(c=>c.id===target.id);
  if(targetIndex<0)return result;
  for(const c of srcCells)result.cellIdMap.set(c.id,uid('cell'));
  const cutIdMap=new Map(),tailMeta=target.manualCut?libraryCloneTargetManualCut(target.manualCut):null;
  const inheritedFixed={...(target.fixedAxes||{})};
  const mapped=[];
  for(const srcCell of srcCells){
    const bounds=libraryMapBounds(srcCell,mapX,mapY,mapZ);
    if(!bounds)continue;
    const cell={
      ...srcCell,
      ...bounds,
      id:result.cellIdMap.get(srcCell.id)||uid('cell'),
      // Ocultar divisão é estado de visualização do projeto que originou o
      // modelo; ao inserir pela Biblioteca os cortes devem nascer visíveis.
      hidden:false,
      fixedAxes:(()=>{
        const out={...inheritedFixed};
        const srcFixed={x:mapX?.__designLabBalance?.sourceFixedIntervals||stableFixedIntervalsForParametricSpace(layoutSpace,'x'),y:mapY?.__designLabBalance?.sourceFixedIntervals||stableFixedIntervalsForParametricSpace(layoutSpace,'y'),z:mapZ?.__designLabBalance?.sourceFixedIntervals||stableFixedIntervalsForParametricSpace(layoutSpace,'z')};
        for(const ax of ['x','y','z']){
          if(!srcCell.fixedAxes?.[ax])continue;
          const k0=ax==='x'?'minX':ax==='y'?'minY':'minZ',k1=ax==='x'?'maxX':ax==='y'?'maxY':'maxZ';
          const a=Number(srcCell[k0]),b=Number(srcCell[k1]),tol=.00005;
          if((srcFixed[ax]||[]).some(([f0,f1])=>a>=f0-tol&&b<=f1+tol))out[ax]=true;
        }
        return out;
      })(),
      manualCut:srcCell.manualCut
        ? libraryTransformManualCut(srcCell.manualCut,mapX,mapY,mapZ,cutIdMap,tailMeta)
        : libraryCloneTargetManualCut(tailMeta)
    };
    mapped.push(cell);
  }
  if(mapped.length<2)return result;
  root.cells.splice(targetIndex,1,...mapped);
  result.changed=true;result.cells=mapped;result.selectedCell=mapped[0];
  return result;
}
function libraryRemapPartCellRefs(part,rootId,cellIdMap,fallbackCellId){
  const p=JSON.parse(JSON.stringify(part||{}));
  const remapCfg=cfg=>{
    if(!cfg||typeof cfg!=='object')return cfg;
    cfg.targetRootId=rootId;
    cfg.targetCellId=cellIdMap?.get(cfg.targetCellId)||fallbackCellId||cfg.targetCellId||null;
    return cfg;
  };
  if(p.drawerConfig)p.drawerConfig=remapCfg(p.drawerConfig);
  if(p.curvedConfig)p.curvedConfig=remapCfg(p.curvedConfig);
  if(p.customProfile?.cfg)p.customProfile.cfg=remapCfg(p.customProfile.cfg);
  return p;
}
function libraryInfoForPart(baseInfo,part){
  const cfg=part?.drawerConfig||part?.curvedConfig||part?.customProfile?.cfg||null;
  const cell=cfg?.targetCellId?getSpaceCell(baseInfo.root.id,cfg.targetCellId):null;
  return cell?{root:baseInfo.root,cell,size:cellSize(cell),center:cellCenter(cell)}:baseInfo;
}
function placeCustomTemplate(item,info,{commit=true,notify=true}={}){
  const sb=item.sourceBounds, sw=sb.maxX-sb.minX, sh=sb.maxY-sb.minY, sd=sb.maxZ-sb.minZ; if(sw<=0||sh<=0||sd<=0)return;
  ctx.historyMuted=true;
  try{
    const layout=item.layout||null;
    if(layout?.space){
      const lb=layoutBoundsFromSpace(layout.space)||sb;
      // 1.200.90 · Além dos travamentos gravados no espaço, recupera faixas
      // estruturais de blocos antigos diretamente dos registros das peças.
      // Assim um modelo antigo com laterais/divisões de 18 mm ou réguas de
      // 60 mm não precisa ser recriado apenas porque faltou o flag spaceCutting.
      const libStructuralX=structuralFixedIntervalsFromPartRecords(item.parts,'x',lb);
      const libStructuralY=structuralFixedIntervalsFromPartRecords(item.parts,'y',lb);
      const libStructuralZ=structuralFixedIntervalsFromPartRecords(item.parts,'z',lb);
      // 1.300.17 · PORTA PIVOTANTE: a árvore manualCut pode perder uma das
      // faixas fixas de profundidade depois de vários cortes/edições. Para um
      // sistema de porta isso deformava peças construtivas do batente ao mudar
      // a espessura da parede (ex.: 195 -> 205 mm). O modelo de porta passa a
      // reaplicar também as fixedBands físicas salvas no espaço-mestre. Assim
      // as faixas fixas mantêm suas medidas exatas e somente o vão livre em Z
      // recebe a diferença da nova espessura da parede.
      const isDoorSystemTemplate=(item.parts||[]).some(q=>q?.doorSystem?.templateId||q?.doorSystem?.systemId);
      const savedDoorX=isDoorSystemTemplate?stableFixedIntervalsFromSpace(layout.space,'x'):[];
      const savedDoorY=isDoorSystemTemplate?stableFixedIntervalsFromSpace(layout.space,'y'):[];
      const savedDoorZ=isDoorSystemTemplate?stableFixedIntervalsFromSpace(layout.space,'z'):[];
      const mapX=makeBalancedSpaceAxisMapper(layout.space,'x',lb.minX,lb.maxX,info.cell.minX,info.cell.maxX,[...libStructuralX,...savedDoorX]);
      const mapY=makeBalancedSpaceAxisMapper(layout.space,'y',lb.minY,lb.maxY,info.cell.minY,info.cell.maxY,[...libStructuralY,...savedDoorY]);
      const mapZ=makeBalancedSpaceAxisMapper(layout.space,'z',lb.minZ,lb.maxZ,info.cell.minZ,info.cell.maxZ,[...libStructuralZ,...savedDoorZ]);

      // IMPORTANTE: primeiro recria os cortes/vãos dentro da célula escolhida.
      // Depois as peças são posicionadas usando o mesmo mapeamento.
      const topology=libraryInstallSpaceTopology(layout.space,info,mapX,mapY,mapZ,lb);
      const fallbackCellId=topology.selectedCell?.id||info.cell.id;
      for(const originalPart of item.parts){
        const p=libraryRemapPartCellRefs(originalPart,info.root.id,topology.cellIdMap,fallbackCellId);
        const pInfo=libraryInfoForPart(info,p);
        // 1.200.95: mapeia a geometria PARAMÉTRICA original e só depois
        // reaplica os ajustes manuais salvos (faces, posição e medidas exatas).
        const geom=pieceMappedGeometryWithManualDelta(p,mapX,mapY,mapZ);
        createLibraryTemplatePart(p,pInfo,geom);
      }
      renderSpaces();
      const selectedCell=topology.selectedCell&&getSpaceCell(info.root.id,topology.selectedCell.id);
      if(selectedCell)selectSpaceCellByIds(info.root.id,selectedCell.id,{showMenu:false});
      const balanceInfo=[['L',mapX],['A',mapY],['P',mapZ]].map(([label,mapper])=>{
        const meta=mapper?.__designLabBalance;if(!meta)return null;
        if(meta.freeCount>=2&&Number.isFinite(meta.targetEach))return `${label}: ${meta.freeCount} vão(s) × ${nice(mm(meta.targetEach))} mm`;
        if(label==='L')return `L: ${meta.freeCount||0} vão(s) solto(s) · ${meta.fixedCount||0} travado(s) · ${nice(mm(meta.fixedTotal||0))} mm fixos`;
        return null;
      }).filter(Boolean).join(' · ');
      if(notify)toast((topology.changed
        ?`Móvel inserido · ${topology.cells.length} espaço(s) preservados · travados mantidos`
        :'Componente ajustado · travados preservados')+(balanceInfo?` · ${balanceInfo}`:''));
    } else {
      const sx=info.size.width/sw, sy=info.size.height/sh, sz=info.size.depth/sd;
      for(const p of item.parts){
        const b=pieceParametricBaseFromRecord(p),d=b.d;
        const x=info.cell.minX+(b.x-sb.minX)*sx+d.dx, yBase=info.cell.minY+(b.yBase-sb.minY)*sy+d.dyBase, z=info.cell.minZ+(b.z-sb.minZ)*sz+d.dz;
        createLibraryTemplatePart(p,info,{width:Math.max(.001,b.width*sx+d.dw),depth:Math.max(.001,b.depth*sz+d.dd),height:Math.max(.001,b.height*sy+d.dh),x,yBase,z});
      }
      if(notify)toast('Componente ajustado ao espaço');
    }
  }catch(err){ ctx.historyMuted=false; if(notify)toast(err.message||'Não foi possível ajustar o componente'); return false; }
  renderMachiningVisuals(); ctx.historyMuted=false; if(commit)commitHistory();
  return true;
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
  if(!ctx.cloudAccountState.ok){
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
    if(!ctx.cloudAccountState.ok){
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


// ---------- 1.200.74 · Painel ripado paramétrico ----------
let slattedPanelOwner=null;
function slattedPanelEligible(o){
  if(!o)return {ok:false,message:'Selecione uma peça primeiro'};
  const u=o.userData||{};
  if(u.kind==='cylinder'||u.kind==='hardware-visual')return {ok:false,message:'Painel ripado disponível para peças retangulares'};
  if(u.kind==='curved-panel'||u.curvedRole)return {ok:false,message:'Peças curvas continuam sendo editadas pela ferramenta Móvel curvo'};
  if(u.drawerSetId)return {ok:false,message:'Peças de gaveta paramétrica devem ser editadas pela ferramenta Gavetas / corrediças'};
  const ti=pieceThicknessInfo(o);if(!ti||!(ti.faceW>0&&ti.faceH>0&&ti.thickness>0))return {ok:false,message:'Não foi possível ler as medidas desta peça'};
  return {ok:true,ti};
}
function slattedPanelReadConfig(){
  const width=parseDecimalInput($('slattedPanelSlatWidth')?.value),gap=parseDecimalInput($('slattedPanelGap')?.value);
  return {width,gap,direction:$('slattedPanelDirection')?.value==='horizontal'?'horizontal':'vertical',align:['start','end'].includes($('slattedPanelAlign')?.value)?$('slattedPanelAlign').value:'center'};
}
function slattedPanelLayoutFor(o,cfg=slattedPanelReadConfig()){
  const check=slattedPanelEligible(o);if(!check.ok)throw new Error(check.message);
  const ti=check.ti,w=Number(cfg.width),gap=Number(cfg.gap);
  if(!(w>0))throw new Error('A largura do ripado deve ser maior que zero');
  if(!(gap>=0))throw new Error('O vão não pode ser negativo');
  const run=cfg.direction==='horizontal'?ti.faceH:ti.faceW;
  const span=cfg.direction==='horizontal'?ti.faceW:ti.faceH;
  if(w>run+.001)throw new Error(`O ripado de ${nice(w)} mm é maior que a área disponível de ${nice(run)} mm`);
  const step=w+gap;if(!(step>0))throw new Error('Confira as medidas do ripado e do vão');
  const count=Math.floor((run+gap+.000001)/step);
  if(count<1)throw new Error('Não cabe nenhum ripado nesta peça');
  if(count>500)throw new Error('A configuração criaria peças demais. Aumente a largura ou o vão.');
  const used=count*w+Math.max(0,count-1)*gap;
  const leftover=Math.max(0,run-used);
  const before=cfg.align==='start'?0:cfg.align==='end'?leftover:leftover/2;
  const after=leftover-before;
  return {ti,run,span,count,used,leftover,before,after,step};
}
function renderSlattedPanelPreview(){
  const owner=slattedPanelOwner&&runtimeModel.objects.includes(slattedPanelOwner)?slattedPanelOwner:ctx.selected;
  const preview=$('slattedPanelPreview'),summary=$('slattedPanelSummary');if(!preview||!summary)return;
  preview.innerHTML='';
  try{
    const cfg=slattedPanelReadConfig(),lay=slattedPanelLayoutFor(owner,cfg),vertical=cfg.direction==='vertical';
    preview.classList.toggle('vertical',vertical);preview.classList.toggle('horizontal',!vertical);
    const maxBars=Math.min(lay.count,18),scale=Math.min(4,Math.max(.15,320/Math.max(1,lay.run)));
    const before=document.createElement('span');before.style.flex=`0 0 ${Math.max(1,lay.before*scale)}px`;preview.appendChild(before);
    for(let i=0;i<maxBars;i++){
      const bar=document.createElement('span');bar.className='slatDemo';
      if(vertical)bar.style.width=`${Math.max(3,cfg.width*scale)}px`;else bar.style.height=`${Math.max(3,cfg.width*scale)}px`;
      preview.appendChild(bar);
      if(i<maxBars-1){const g=document.createElement('span');if(vertical)g.style.width=`${Math.max(1,cfg.gap*scale)}px`;else g.style.height=`${Math.max(1,cfg.gap*scale)}px`;g.style.flex='0 0 auto';preview.appendChild(g);}
    }
    if(lay.count>maxBars){const more=document.createElement('span');more.textContent=`+${lay.count-maxBars}`;more.style.cssText='align-self:center;color:#9fd9ff;font-size:10px;font-weight:900;padding:3px';preview.appendChild(more);}
    const after=document.createElement('span');after.style.flex=`0 0 ${Math.max(1,lay.after*scale)}px`;preview.appendChild(after);
    summary.textContent=`${lay.count} peça(s) · ripado ${nice(cfg.width)} mm · vão ${nice(cfg.gap)} mm · comprimento ${nice(lay.span)} mm · espessura ${nice(lay.ti.thickness)} mm · sobra ${nice(lay.before)} / ${nice(lay.after)} mm nas bordas.`;
    summary.classList.remove('error');
  }catch(err){preview.className='slattedPanelPreview';summary.textContent=err.message||'Confira as medidas';summary.classList.add('error');}
}
function openSlattedPanelDialog(){
  if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
  const check=slattedPanelEligible(ctx.selected);if(!check.ok){toast(check.message);return false;}
  slattedPanelOwner=ctx.selected;
  const ti=check.ti,u=ctx.selected.userData||{};
  $('slattedPanelPartInfo').textContent=`${u.name||'Peça'} · área ${nice(ti.faceW)} × ${nice(ti.faceH)} mm · espessura ${nice(ti.thickness)} mm. O padrão será criado dentro exatamente desta área.`;
  const last=(()=>{try{return JSON.parse(localStorage.getItem('designLabSlattedPanelPrefsV1')||'null')}catch{return null}})();
  $('slattedPanelSlatWidth').value=Number(last?.width)>0?String(roundMmNumber(last.width,3)):'30';
  $('slattedPanelGap').value=Number(last?.gap)>=0?String(roundMmNumber(last.gap,3)):'15';
  $('slattedPanelDirection').value=last?.direction==='horizontal'?'horizontal':'vertical';
  $('slattedPanelAlign').value=['start','end'].includes(last?.align)?last.align:'center';
  $('slattedPanelDialog').style.display='flex';renderSlattedPanelPreview();return true;
}
function closeSlattedPanelDialog(){
  $('slattedPanelDialog').style.display='none';slattedPanelOwner=null;
}
function createSlattedPanel(){
  const source=slattedPanelOwner&&runtimeModel.objects.includes(slattedPanelOwner)?slattedPanelOwner:ctx.selected;
  try{
    const cfg=slattedPanelReadConfig(),lay=slattedPanelLayoutFor(source,cfg),u=source.userData||{};
    const hasDetails=(u.machining?.length||0)+(u.forms?.length||0)+(u.doorConfig?1:0);
    if(hasDetails&&!window.confirm('Esta peça possui Forma, usinagem ou configuração de porta. Ao transformar em painel ripado, esses detalhes da peça original não serão copiados para os ripados. Continuar?'))return;
    try{localStorage.setItem('designLabSlattedPanelPrefsV1',JSON.stringify(cfg));}catch{}

    const sourcePos=source.position.clone(),sourceRot={x:source.rotation.x,y:source.rotation.y,z:source.rotation.z};
    const tAxis=lay.ti.thicknessAxis,uAxis=lay.ti.uAxis,vAxis=lay.ti.vAxis;
    const distributionAxis=cfg.direction==='horizontal'?vAxis:uAxis;
    const distributionVector=pieceLocalAxisVector(source,distributionAxis);
    const baseName=String(u.name||'Painel').replace(/^Ripado\s*·\s*/i,'').trim()||'Painel';
    const partName=`Ripado · ${baseName}`;
    const common={
      kind:'panel',name:partName,materialType:u.materialType||'MDF',baseColor:u.baseColor??COLORS.panel,
      materialId:u.materialId||null,materialCode:u.materialCode||'',materialGrain:!!u.materialGrain,materialGrainRotation:normalizePieceGrainRotation(u.materialGrainRotation),materialCoreColor:u.materialCoreColor||null,
      edgeBands:{},labelMeta:u.labelMeta?productionClone(u.labelMeta):null,spaceRootId:u.spaceRootId||null,machining:[],forms:[],rotationX:sourceRot.x,rotationY:sourceRot.y,rotationZ:sourceRot.z,excludeFromCutList:!!u.excludeFromCutList,
      spaceCutting:false,spaceCutParentBounds:null
    };

    // A malha original sai, mas a divisão paramétrica do espaço permanece. Assim o
    // ripado substitui a peça visual/fabricável sem "desfazer" o vão onde ela nasceu.
    selectObject(null);
    const srcIndex=runtimeModel.objects.indexOf(source);if(srcIndex>=0)runtimeModel.objects.splice(srcIndex,1);disposeObject(source);

    const made=[];
    for(let i=0;i<lay.count;i++){
      const localOffset=-lay.run/2+lay.before+cfg.width/2+i*lay.step;
      const center=sourcePos.clone().addScaledVector(distributionVector,m(localOffset));
      const dims={x:lay.ti.dims.x,y:lay.ti.dims.y,z:lay.ti.dims.z};
      if(cfg.direction==='vertical'){dims[uAxis]=cfg.width;dims[vAxis]=lay.span;}
      else{dims[vAxis]=cfg.width;dims[uAxis]=lay.span;}
      dims[tAxis]=lay.ti.thickness;
      const slat=createBox({...common,width:m(dims.x),depth:m(dims.z),height:m(dims.y),x:center.x,yBase:center.y-m(dims.y)/2,z:center.z},false);
      slat.position.copy(center);slat.updateMatrixWorld(true);made.push(slat);
    }
    if(made.length)selectObject(made[0]);
    closeSlattedPanelDialog();renderMachiningVisuals();updateMeasureBadge();commitHistory();
    toast(`Painel ripado criado · ${made.length} peça(s) de ${nice(cfg.width)} mm · vão ${nice(cfg.gap)} mm`);
  }catch(err){toast(err.message||'Não foi possível criar o painel ripado');renderSlattedPanelPreview();}
}
['slattedPanelSlatWidth','slattedPanelGap','slattedPanelDirection','slattedPanelAlign'].forEach(id=>$(id)?.addEventListener('input',renderSlattedPanelPreview));
$('cancelSlattedPanel')?.addEventListener('click',closeSlattedPanelDialog);
$('createSlattedPanel')?.addEventListener('click',createSlattedPanel);
$('slattedPanelDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('slattedPanelDialog'))closeSlattedPanelDialog();});

// ---------- Usinagem de peças: furos e rasgos ----------
// 1.311.00 · domínio movido para módulo (10867-10963).




// ---------- Interface de materiais / fitas ----------
// 1.311.00 · domínio movido para módulo (10969-11555).


// ---------- v78: Forma paramétrica / contorno externo ----------
// 1.311.00 · domínio movido para módulo (11559-11817).

// ---------- Ferragens inteligentes por contato ----------
// 1.311.00 · domínio movido para módulo (11820-12208).

// 1.311.00 · domínio movido para módulo (12210-13439).

// ============================================================================
// 1.200.51 · COPIAR FERRAGENS EM LOTE
// Copia as operações de usinagem vinculadas a ferragens da peça origem para
// várias peças destino. Ferragem não é escalada: as medidas em milímetros e as
// referências de borda são preservadas. Cada destino recebe instâncias próprias.
// ============================================================================
// 1.311.00 · domínio movido para módulo (13447-13592).


  const state={
    get activeLibraryFolderId(){return activeLibraryFolderId;}, set activeLibraryFolderId(v){activeLibraryFolderId=v;},
    get libraryScope(){return libraryScope;}, set libraryScope(v){libraryScope=v;},
    get globalLibraryState(){return globalLibraryState;},
    get customLibrary(){return customLibrary;},
    get libraryFolders(){return libraryFolders;}
  };
  return {state,persistLibrary,libraryFolderById,uniqueLibraryFolderName,createLibraryFolder,selectedCellInfo,createCabinetInCell,mergeIntervals,fixedIntervalsFromSpace,stableFixedIntervalsFromSpace,explicitFixedIntervalsFromManualCuts,stableFixedIntervalsForParametricSpace,fixedGapPlan,libraryPartRecordIsStructural,structuralFixedIntervalsFromPartRecords,structuralFixedIntervalsFromRoot,makeFixedAxisMapper,makeBalancedFixedAxisMapper,balancedAxisCellCrossArea,balancedAxisRootCrossArea,balancedAxisPrimaryBoundaries,balancedAxisSegmentFixedByCells,makeBalancedSpaceAxisMapper,layoutBoundsFromSpace,libraryCurvedConfigForTarget,libraryCurvedPostPlacementForTarget,copyLibraryPartMeta,createLibraryTemplatePart,libraryMapBounds,libraryCloneTargetManualCut,libraryTransformManualCut,libraryInstallSpaceTopology,libraryRemapPartCellRefs,libraryInfoForPart,placeCustomTemplate,placeLibraryItem,builtinLibraryItems,globalLibraryFolderById,setLibraryScope,globalTemplateFromFurniture,updateLibraryFolderUi,libraryItemElement,renderLibrary,openLibraryRoot,newLibraryFolder,renameActiveLibraryFolder,deleteActiveLibraryFolder,deleteLibraryItem,importLibraryTemplate,saveCurrentFurnitureToLibrary,slattedPanelEligible,slattedPanelReadConfig,slattedPanelLayoutFor,renderSlattedPanelPreview,openSlattedPanelDialog,closeSlattedPanelDialog,createSlattedPanel};
}
