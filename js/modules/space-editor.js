// DesignLabMoveis 1.310.00 · edição/criação/corte de espaços e seus diálogos.
export function createSpaceEditorModule(ctx){
  const { $, mm, m, nice, toast, escapeHtml, rootBounds, cellAxisMin, cellAxisMax, cellBox, activeSpaceRoot, parseDecimalInput, getBounds, mergeIntervals, tangentAxesForSpace, productionMaterialById, cellSize, getSpaceRoot, getSpaceCell, remapMachiningForPieceResize, rebuildFormGeometry, updateAutoMachiningAfterPieceResize, sanitizeMachiningForPiece, fixedIntervalsFromSpace, objectInsideSpaceRoot, isVerticalDivisionPiece, registerVerticalDivisionFixedBand, rebuildDrawerSetsForRoot, renderSpaces, applyDoorVisibility, renderMachiningVisuals, updateMeasureBadge, commitHistory, makeFixedAxisMapper, selectSpaceCellByIds, resizeSpaceRoot, fillSpaceMaterialSelect, updateEditSpaceMaterialPreview, applySpaceMaterialToExistingPieces, preferredDefaultMaterialId, selectedCellInfo, updateSpaceMaterialPreview, projectCurrentOwnerId, createSpace, setVisualMode, applySelectedSpaceCut }=ctx;
  const runtimeModel=ctx.runtimeModel;
// ---------- Edição do espaço sem apagar o móvel ----------
function updateEditSpacePreview(){
  const root=activeSpaceRoot(); const out=$('editSpacePreview'); if(!root||!out)return;
  const w=Number($('editSpaceW').value)||0,d=Number($('editSpaceD').value)||0,h=Number($('editSpaceH').value)||0;
  const px=Number($('editSpacePosX')?.value),py=Number($('editSpacePosY')?.value),pz=Number($('editSpacePosZ')?.value);
  const rb=rootBounds(root);
  const dx=w-mm(root.width), dd=d-mm(root.depth), dh=h-mm(root.height);
  const fixedCount=['x','y','z'].reduce((n,a)=>n+(root.fixedBands?.[a]?.length||0),0);
  const fmt=v=>(v>=0?'+':'')+nice(v);
  const validPos=[px,py,pz].every(Number.isFinite);
  const posNow=`X ${nice(mm(rb.minX))} · Y ${nice(mm(rb.minY))} · Z ${nice(mm(rb.minZ))} mm`;
  const posNew=validPos?`X ${nice(px)} · Y ${nice(py)} · Z ${nice(pz)} mm`:'confira X / Y / Z';
  out.innerHTML=`Atual: <strong>${nice(mm(root.width))} × ${nice(mm(root.depth))} × ${nice(mm(root.height))} mm</strong><br>Novo: <strong>${nice(w)} × ${nice(d)} × ${nice(h)} mm</strong> · Δ L ${fmt(dx)} · P ${fmt(dd)} · A ${fmt(dh)} mm<br>Posição atual: <strong>${posNow}</strong><br>Nova posição: <strong>${posNew}</strong>${fixedCount?`<br>🔒 ${fixedCount} faixa(s) fixa(s) serão preservadas.`:''}`;
}
function objectInsideRootBounds(obj,b,tol=.003){
  if(!obj||!b)return false;
  const a=getBounds(obj);
  return a.minX>=b.minX-tol && a.maxX<=b.maxX+tol &&
         a.minY>=b.minY-tol && a.maxY<=b.maxY+tol &&
         a.minZ>=b.minZ-tol && a.maxZ<=b.maxZ+tol;
}
function collectSpaceLinkedObjects(root,bounds=null){
  if(!root)return [];
  const b=bounds||rootBounds(root);
  return runtimeModel.objects.filter(o=>o?.userData?.spaceRootId===root.id || objectInsideRootBounds(o,b));
}
function translateSpaceObjectMetadata(o,dx,dy,dz){
  const u=o?.userData||{};
  const pb=u.spaceCutParentBounds;
  if(pb&&['minX','maxX','minY','maxY','minZ','maxZ'].every(k=>Number.isFinite(Number(pb[k])))){
    pb.minX=Number(pb.minX)+dx;pb.maxX=Number(pb.maxX)+dx;
    pb.minY=Number(pb.minY)+dy;pb.maxY=Number(pb.maxY)+dy;
    pb.minZ=Number(pb.minZ)+dz;pb.maxZ=Number(pb.maxZ)+dz;
  }
  if(Number.isFinite(Number(u.curvedTargetX)))u.curvedTargetX=Number(u.curvedTargetX)+dx;
  if(Number.isFinite(Number(u.curvedTargetZ)))u.curvedTargetZ=Number(u.curvedTargetZ)+dz;
}
function moveSpaceRootToPosition(root,{leftX,yBase,backZ,linkedObjects=null}={}){
  if(!root)throw new Error('Espaço não encontrado');
  leftX=Number(leftX);yBase=Number(yBase);backZ=Number(backZ);
  if(![leftX,yBase,backZ].every(Number.isFinite))throw new Error('Confira a posição X / Y / Z');
  if(yBase<0)throw new Error('A posição Y não pode ficar abaixo do chão');

  const b=rootBounds(root);
  const dx=leftX-b.minX,dy=yBase-b.minY,dz=backZ-b.minZ;

  // Une as peças capturadas ANTES do redimensionamento às peças que continuam
  // ligadas ao espaço depois dele. Isso também cobre projetos antigos em que
  // algumas peças ainda não possuem spaceRootId.
  const linkedSet=new Set();
  if(Array.isArray(linkedObjects))for(const o of linkedObjects)if(runtimeModel.objects.includes(o))linkedSet.add(o);
  for(const o of collectSpaceLinkedObjects(root,b))linkedSet.add(o);

  // Posição absoluta: X é a esquerda, Y é a base e Z é o fundo/traseiro.
  // Não usamos += aqui; assim projetos antigos com valores serializados de
  // forma diferente não conseguem transformar a soma em concatenação/string.
  root.x=leftX+Number(root.width)/2;
  root.yBase=yBase;
  root.z=backZ+Number(root.depth)/2;

  for(const c of root.cells||[]){
    c.minX=Number(c.minX)+dx;c.maxX=Number(c.maxX)+dx;
    c.minY=Number(c.minY)+dy;c.maxY=Number(c.maxY)+dy;
    c.minZ=Number(c.minZ)+dz;c.maxZ=Number(c.maxZ)+dz;
  }
  for(const o of linkedSet){
    o.position.set(Number(o.position.x)+dx,Number(o.position.y)+dy,Number(o.position.z)+dz);
    translateSpaceObjectMetadata(o,dx,dy,dz);
  }
  return {dx,dy,dz,count:linkedSet.size};
}
// ============================================================================
// 1.200.90 · EDITAR O ESPAÇO/VÃO SELECIONADO DIRETO PELO TOQUE LONGO
// ============================================================================
// O espaço principal continua sendo editado por openEditSpaceDialog(). Para uma
// divisão interna, ajustamos apenas a fronteira compartilhada com o vão vizinho:
// o tamanho externo do móvel não muda e o vizinho absorve a diferença.
let editSelectedSpaceContext=null;
let editSelectedSpaceRelations=null;
function axisCellMinKey(axis){return axis==='x'?'minX':axis==='y'?'minY':'minZ';}
function axisCellMaxKey(axis){return axis==='x'?'maxX':axis==='y'?'maxY':'maxZ';}
function axisObjectDimKey(axis){return axis==='x'?'width':axis==='y'?'height':'depth';}
function axisSpaceFieldId(axis){return axis==='x'?'editSelectedSpaceW':axis==='y'?'editSelectedSpaceH':'editSelectedSpaceD';}
function axisSpaceName(axis){return axis==='x'?'largura (X)':axis==='y'?'altura (Y)':'profundidade (Z)';}
function axisShortName(axis){return axis==='x'?'Largura':axis==='y'?'Altura':'Profundidade';}
function boxUnionForCells(a,b){
  return {minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),minY:Math.min(a.minY,b.minY),maxY:Math.max(a.maxY,b.maxY),minZ:Math.min(a.minZ,b.minZ),maxZ:Math.max(a.maxZ,b.maxZ)};
}
function objectTouchesCellEditParent(o,parent,axis,tol=.003){
  if(!o||!parent)return false;
  const b=getBounds(o);
  const tangents=axis==='x'
    ? b.maxY>=parent.minY-tol&&b.minY<=parent.maxY+tol&&b.maxZ>=parent.minZ-tol&&b.minZ<=parent.maxZ+tol
    : axis==='y'
      ? b.maxX>=parent.minX-tol&&b.minX<=parent.maxX+tol&&b.maxZ>=parent.minZ-tol&&b.minZ<=parent.maxZ+tol
      : b.maxX>=parent.minX-tol&&b.minX<=parent.maxX+tol&&b.maxY>=parent.minY-tol&&b.minY<=parent.maxY+tol;
  if(!tangents)return false;
  const minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis);
  return b[maxK]>=parent[minK]-tol&&b[minK]<=parent[maxK]+tol;
}
function subtractFixedBand(root,axis,absA,absB){
  if(!root)return;
  const rb=rootBounds(root),rootMin=axis==='x'?rb.minX:axis==='y'?rb.minY:rb.minZ;
  let a=Math.min(absA,absB)-rootMin,b=Math.max(absA,absB)-rootMin;
  if(!(b>a))return;
  const eps=.0006,out=[];
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  for(const raw of root.fixedBands[axis]||[]){
    let s=Math.min(Number(raw[0]),Number(raw[1])),e=Math.max(Number(raw[0]),Number(raw[1]));
    if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s)continue;
    if(e<=a+eps||s>=b-eps){out.push([s,e]);continue;}
    if(s<a-eps)out.push([s,a]);
    if(e>b+eps)out.push([b,e]);
  }
  root.fixedBands[axis]=mergeIntervals(out);
}
function addFixedBandForCell(root,cell,axis){
  if(!root||!cell)return;
  const rb=rootBounds(root),rootMin=axis==='x'?rb.minX:axis==='y'?rb.minY:rb.minZ;
  const minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis);
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands[axis]=mergeIntervals([...(root.fixedBands[axis]||[]),[Number(cell[minK])-rootMin,Number(cell[maxK])-rootMin]]);
}
function cellWithinEditParent(c,parent,tol=.003){
  if(!c||!parent)return false;
  return Number(c.minX)>=Number(parent.minX)-tol&&Number(c.maxX)<=Number(parent.maxX)+tol&&
         Number(c.minY)>=Number(parent.minY)-tol&&Number(c.maxY)<=Number(parent.maxY)+tol&&
         Number(c.minZ)>=Number(parent.minZ)-tol&&Number(c.maxZ)<=Number(parent.maxZ)+tol;
}
function cellTangentWithin(inner,outer,axis,tol=.003){
  for(const a of tangentAxesForSpace(axis)){
    if(cellAxisMin(inner,a)<cellAxisMin(outer,a)-tol||cellAxisMax(inner,a)>cellAxisMax(outer,a)+tol)return false;
  }
  return true;
}
function cellTangentOverlapArea(a,b,axis){
  const [u,v]=tangentAxesForSpace(axis);
  const du=Math.max(0,Math.min(cellAxisMax(a,u),cellAxisMax(b,u))-Math.max(cellAxisMin(a,u),cellAxisMin(b,u)));
  const dv=Math.max(0,Math.min(cellAxisMax(a,v),cellAxisMax(b,v))-Math.max(cellAxisMin(a,v),cellAxisMin(b,v)));
  return du*dv;
}
function cellTangentFaceArea(c,axis){
  const [u,v]=tangentAxesForSpace(axis);
  return Math.max(.000000001,(cellAxisMax(c,u)-cellAxisMin(c,u))*(cellAxisMax(c,v)-cellAxisMin(c,v)));
}
function selectedLowFromCutSide(side,axis){
  if(axis==='x')return side==='left';
  if(axis==='y')return side==='bottom';
  return side==='back';
}
function manualCutMetaChain(cell){
  const out=[];let m=cell?.manualCut||null,guard=0;
  while(m&&guard++<16){out.push(m);m=m.parentMeta||null;}
  return out;
}
function setManualCutFixedInChain(cell,cutId,fixed){
  if(!cell||!cutId)return;
  let m=cell.manualCut||null,guard=0;
  while(m&&guard++<16){
    if(m.id===cutId)m.isFixed=!!fixed;
    m=m.parentMeta||null;
  }
}
function remapManualCutBoundsInChain(cell,axis,parentMin,parentMax,mapAxis){
  if(!cell)return;
  const minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis),tol=.0005;
  let meta=cell.manualCut||null,guard=0;
  while(meta&&guard++<16){
    const b=meta.parentBounds;
    if(b&&Number.isFinite(Number(b[minK]))&&Number.isFinite(Number(b[maxK]))){
      const a=Number(b[minK]),z=Number(b[maxK]);
      if(a>=parentMin-tol&&a<=parentMax+tol)b[minK]=mapAxis(a);
      if(z>=parentMin-tol&&z<=parentMax+tol)b[maxK]=mapAxis(z);
    }
    meta=meta.parentMeta||null;
  }
}
function selectedCellEditContextFromMeta(root,cell,meta){
  if(!meta?.axis||!meta?.parentBounds)return null;
  const axis=meta.axis,minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis),tol=.003;
  const parent={...meta.parentBounds};
  if(!cellWithinEditParent(cell,parent,tol))return null;
  const selectedLow=selectedLowFromCutSide(meta.side,axis);
  const oldBoundary=selectedLow?Number(cell[maxK]):Number(cell[minK]);
  const affected=(root.cells||[]).filter(c=>cellWithinEditParent(c,parent,tol));
  if(affected.length<2)return null;
  const adjacent=affected.filter(c=>c!==cell&&cellTangentWithin(c,cell,axis,tol)&&
    (selectedLow?Math.abs(Number(c[minK])-oldBoundary)<=tol:Math.abs(Number(c[maxK])-oldBoundary)<=tol));
  const coverage=adjacent.reduce((n,c)=>n+cellTangentOverlapArea(cell,c,axis),0)/cellTangentFaceArea(cell,axis);
  if(coverage<.90)return null;
  return {root,cell,axis,selectedLow,parent,oldBoundary,affectedCells:affected,cutId:meta.id||null,source:'metadata'};
}
function legacySelectedCellAxisContext(root,cell,axis){
  const rb=rootBounds(root),minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis),tol=.003;
  const rootMin=Number(rb[minK]),rootMax=Number(rb[maxK]);
  const options=[];
  for(const selectedLow of [true,false]){
    const boundary=selectedLow?Number(cell[maxK]):Number(cell[minK]);
    if(selectedLow&&Math.abs(boundary-rootMax)<=tol)continue;
    if(!selectedLow&&Math.abs(boundary-rootMin)<=tol)continue;
    const adjacent=(root.cells||[]).filter(c=>c!==cell&&cellTangentWithin(c,cell,axis,tol)&&
      (selectedLow?Math.abs(Number(c[minK])-boundary)<=tol:Math.abs(Number(c[maxK])-boundary)<=tol));
    const coverage=adjacent.reduce((n,c)=>n+cellTangentOverlapArea(cell,c,axis),0)/cellTangentFaceArea(cell,axis);
    if(coverage<.90)continue;
    const opposite=(root.cells||[]).filter(c=>c!==cell&&cellTangentWithin(c,cell,axis,tol)&&
      (selectedLow?Number(c[minK])>=boundary-tol:Number(c[maxK])<=boundary+tol));
    if(!opposite.length)continue;
    const parent={...cellBox(cell)};
    if(selectedLow)parent[maxK]=Math.max(...opposite.map(c=>Number(c[maxK])),Number(cell[maxK]));
    else parent[minK]=Math.min(...opposite.map(c=>Number(c[minK])),Number(cell[minK]));
    const affected=[cell,...opposite.filter(c=>cellWithinEditParent(c,parent,tol))];
    const oppositeLen=selectedLow?Number(parent[maxK])-boundary:boundary-Number(parent[minK]);
    if(!(oppositeLen>.001))continue;
    options.push({root,cell,axis,selectedLow,parent,oldBoundary:boundary,affectedCells:affected,cutId:null,source:'legacy',coverage,oppositeLen});
  }
  // Quando os dois lados são possíveis, prefere crescer no sentido positivo
  // (direita / cima / frente), mantendo o canto mínimo do vão no lugar.
  options.sort((a,b)=>(b.coverage-a.coverage)||((b.selectedLow?1:0)-(a.selectedLow?1:0))||(a.oppositeLen-b.oppositeLen));
  return options[0]||null;
}
function selectedCellEditRelations(root,cell){
  // Projetos novos possuem a árvore manualCut. O irmão original pode ter sido
  // recortado depois; por isso reunimos TODOS os descendentes dentro do pai.
  for(const meta of manualCutMetaChain(cell)){
    const ctx=selectedCellEditContextFromMeta(root,cell,meta);
    if(ctx)return {[ctx.axis]:ctx,preferred:ctx.axis};
  }
  // Projetos antigos (como os criados antes desta ferramenta) não guardavam a
  // árvore do corte. Reconstruímos geometricamente os vizinhos por eixo.
  const out={};
  for(const axis of ['x','y','z']){
    const ctx=legacySelectedCellAxisContext(root,cell,axis);
    if(ctx)out[axis]=ctx;
  }
  const axes=['y','x','z'].filter(a=>out[a]);
  if(axes.length)out.preferred=axes[0];
  return out;
}
function selectedCellEditPair(root,cell,axisWanted=null){
  const rels=selectedCellEditRelations(root,cell);
  const axis=(axisWanted&&rels[axisWanted])?axisWanted:rels.preferred;
  return axis?rels[axis]:null;
}
function cellEditFormatInput(v){
  const n=Number(v);return Number.isFinite(n)?nice(n):'';
}
function updateEditSelectedSpacePreview(){
  const ctx=editSelectedSpaceContext,box=$('editSelectedSpacePreview');if(!ctx||!box)return;
  const field=$(axisSpaceFieldId(ctx.axis));
  const target=parseDecimalInput(field?.value),parentLen=mm(Number(ctx.parent[axisCellMaxKey(ctx.axis)])-Number(ctx.parent[axisCellMinKey(ctx.axis)]));
  const siblingNow=Math.max(0,parentLen-mm(Number(ctx.cell[axisCellMaxKey(ctx.axis)])-Number(ctx.cell[axisCellMinKey(ctx.axis)])));
  const current=mm(Number(ctx.cell[axisCellMaxKey(ctx.axis)])-Number(ctx.cell[axisCellMinKey(ctx.axis)]));
  const newSibling=Number.isFinite(target)?parentLen-target:NaN;
  const fixed=!!$('editSelectedSpaceFixed')?.checked;
  box.innerHTML=`Atual: <b>${nice(current)} mm</b> em ${axisSpaceName(ctx.axis)} · ${ctx.cell.fixedAxes?.[ctx.axis]?'🔒 travado':'🔓 solto'}<br>`+
    (Number.isFinite(target)?`Novo: <b>${nice(target)} mm</b> · vizinho ${nice(newSibling)} mm · ${fixed?'🔒 ficará travado':'🔓 ficará solto'}`:`Digite uma medida válida. Vão vizinho atual: ${nice(siblingNow)} mm.`);
}
function applyEditSelectedSpaceAxis(axis){
  const rels=editSelectedSpaceRelations;if(!rels)return false;
  const ctx=rels[axis]||rels[rels.preferred];if(!ctx)return false;
  editSelectedSpaceContext=ctx;
  const cell=ctx.cell,sz=cellSize(cell);
  for(const a of ['x','y','z']){
    const f=$(axisSpaceFieldId(a));if(f)f.readOnly=a!==ctx.axis;
  }
  const axisSel=$('editSelectedSpaceAxis');if(axisSel)axisSel.value=ctx.axis;
  $('editSelectedSpaceFixed').checked=!!cell.fixedAxes?.[ctx.axis];
  const inherited=['x','y','z'].filter(a=>a!==ctx.axis&&cell.fixedAxes?.[a]).map(a=>a.toUpperCase());
  $('editSelectedSpaceMeasureHelp').textContent=`Edite ${axisSpaceName(ctx.axis)}. As outras duas medidas ficam somente como referência. O espaço vizinho absorve a diferença.`;
  $('editSelectedSpaceFixedHelp').textContent=`Marcado: ${axisShortName(ctx.axis)} deste vão permanece fixa quando o móvel/modelo for redimensionado. Desmarcado: ela fica solta e absorve a diferença.${inherited.length?` Outros travamentos continuam ativos: ${inherited.join(', ')}.`:''}`;
  updateEditSelectedSpacePreview();
  return true;
}
function openEditSelectedSpaceDialog(){
  if(!ctx.selectedSpaceCell){toast('Selecione um espaço/vão');return;}
  const root=getSpaceRoot(ctx.selectedSpaceCell.rootId),cell=getSpaceCell(ctx.selectedSpaceCell.rootId,ctx.selectedSpaceCell.cellId);
  if(!root||!cell){toast('Espaço selecionado não encontrado');return;}
  if((root.cells||[]).length<=1){
    toast('Este é o espaço principal · abrindo edição do móvel inteiro');
    openEditSpaceDialog();return;
  }
  const rels=selectedCellEditRelations(root,cell);
  const axes=['x','y','z'].filter(a=>rels[a]);
  if(!axes.length){toast('Não encontrei uma borda interna ajustável neste espaço');return;}
  editSelectedSpaceRelations=rels;
  const sz=cellSize(cell);
  $('editSelectedSpaceW').value=cellEditFormatInput(mm(sz.width));
  $('editSelectedSpaceD').value=cellEditFormatInput(mm(sz.depth));
  $('editSelectedSpaceH').value=cellEditFormatInput(mm(sz.height));
  const axisSel=$('editSelectedSpaceAxis');
  if(axisSel){
    axisSel.innerHTML=axes.map(a=>`<option value="${a}">${axisShortName(a)}</option>`).join('');
    axisSel.closest('label').style.display=axes.length>1?'block':'none';
  }
  $('editSelectedSpaceInfo').textContent=`${root.name} · espaço selecionado: L ${nice(mm(sz.width))} × P ${nice(mm(sz.depth))} × A ${nice(mm(sz.height))} mm.`;
  applyEditSelectedSpaceAxis(rels.preferred||axes[0]);
  $('spaceActions').style.display='none';
  $('editSelectedSpaceDialog').style.display='flex';
}
function setObjectAxisBoundsForCellEdit(o,axis,newMin,newMax,oldDimsMm){
  const u=o.userData||{},dimK=axisObjectDimKey(axis),newDim=Math.max(.001,Math.abs(newMax-newMin));
  u[dimK]=newDim;
  const newDims={x:Number(u.width)*1000,y:Number(u.height)*1000,z:Number(u.depth)*1000};
  remapMachiningForPieceResize(o,oldDimsMm,newDims);
  if(Array.isArray(u.forms)&&u.forms.length){o.scale.set(1,1,1);rebuildFormGeometry(o);}else o.scale.set(Number(u.width),Number(u.height),Number(u.depth));
  o.position[axis]=(newMin+newMax)/2;
  updateAutoMachiningAfterPieceResize(o);sanitizeMachiningForPiece(o);
}
function resizeSelectedSpaceCell(ctx,targetMm,fixed){
  const {root,cell,axis,selectedLow,parent}=ctx,minK=axisCellMinKey(axis),maxK=axisCellMaxKey(axis);
  const parentMin=Number(parent[minK]),parentMax=Number(parent[maxK]),parentLen=parentMax-parentMin,target=m(targetMm);
  if(!Number.isFinite(target)||target<.001||target>parentLen-.001)throw new Error(`Use uma medida entre 1 e ${nice(Math.max(1,mm(parentLen)-1))} mm`);
  const oldBoundary=Number(ctx.oldBoundary ?? (selectedLow?cell[maxK]:cell[minK]));
  const newBoundary=selectedLow?parentMin+target:parentMax-target;
  const oldCellMin=Number(cell[minK]),oldCellMax=Number(cell[maxK]),wasFixed=!!cell.fixedAxes?.[axis];

  // A medida selecionada pode ser alterada mesmo se já estava travada. Tiramos
  // somente o travamento antigo dela; os demais vãos fixos continuam protegidos.
  if(wasFixed){
    subtractFixedBand(root,axis,oldCellMin,oldCellMax);
    cell.fixedAxes={...(cell.fixedAxes||{})};delete cell.fixedAxes[axis];
  }
  const fixedIntervals=fixedIntervalsFromSpace(root,axis);
  const lowMapper=makeFixedAxisMapper(parentMin,oldBoundary,parentMin,newBoundary,fixedIntervals);
  const highMapper=makeFixedAxisMapper(oldBoundary,parentMax,newBoundary,parentMax,fixedIntervals);
  const mapAxis=v=>{
    v=Number(v);if(!Number.isFinite(v)||v<parentMin-.0005||v>parentMax+.0005)return v;
    return v<=oldBoundary?lowMapper(v):highMapper(v);
  };

  // Guarda as faixas persistentes antes de mover a geometria. Assim um vão
  // travado do lado vizinho mantém exatamente 18,5 / 150 / etc. em vez de escalar.
  const rb=rootBounds(root),rootMin=axis==='x'?rb.minX:axis==='y'?rb.minY:rb.minZ;
  const persistentAbs=(root.fixedBands?.[axis]||[]).map(([a,b])=>[rootMin+Number(a),rootMin+Number(b)]);

  // Captura as peças pertencentes a esta região antes de mover a fronteira.
  const linked=runtimeModel.objects.filter(o=>(o.userData?.spaceRootId===root.id||objectInsideSpaceRoot(o,root))&&objectTouchesCellEditParent(o,parent,axis));
  const states=linked.map(o=>{
    const u=o.userData||{},b=getBounds(o);
    return {o,min:Number(b[minK]),max:Number(b[maxK]),oldDimsMm:{x:Number(u.width)*1000,y:Number(u.height)*1000,z:Number(u.depth)*1000},verticalDivider:axis==='x'&&isVerticalDivisionPiece(o,root)};
  });

  // 1.200.90: o "vizinho" pode ter sido cortado novamente em 2, 3 ou mais
  // vãos. Remapeamos TODOS os descendentes do mesmo bloco, não apenas um irmão.
  const affected=(ctx.affectedCells?.length?ctx.affectedCells:[cell]).filter(c=>(root.cells||[]).includes(c));
  for(const c of affected){
    const a=Number(c[minK]),z=Number(c[maxK]);
    c[minK]=mapAxis(a);c[maxK]=mapAxis(z);
    remapManualCutBoundsInChain(c,axis,parentMin,parentMax,mapAxis);
  }

  // Move as faixas persistentes que pertencem ao trecho editado. Fora dele,
  // nada muda. Divisórias estruturais serão refinadas logo abaixo.
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands[axis]=mergeIntervals(persistentAbs.map(([a,b])=>{
    const na=(a>=parentMin-.0005&&a<=parentMax+.0005)?mapAxis(a):a;
    const nb=(b>=parentMin-.0005&&b<=parentMax+.0005)?mapAxis(b):b;
    return [Math.min(na,nb)-rootMin,Math.max(na,nb)-rootMin];
  }));

  const delta=newBoundary-oldBoundary;
  for(const st of states){
    const o=st.o,u=o.userData||{},axisDim=Number(u[axisObjectDimKey(axis)])||Math.max(.001,st.max-st.min);
    const crosses=st.min<oldBoundary+.0008&&st.max>oldBoundary-.0008;
    const boundaryPiece=crosses&&axisDim<=.12;
    if(boundaryPiece){
      // Divisória/prateleira estrutural na linha do corte: desloca inteira sem
      // deformar a espessura. Isso mantém MDF 18/18,5 mm exatamente como está.
      if(st.verticalDivider)subtractFixedBand(root,'x',st.min,st.max);
      o.position[axis]=Number(o.position[axis])+delta;
      if(st.verticalDivider)registerVerticalDivisionFixedBand(root,o.position.x-axisDim/2,o.position.x+axisDim/2);
      continue;
    }
    const n0=mapAxis(st.min),n1=mapAxis(st.max);
    setObjectAxisBoundsForCellEdit(o,axis,Math.min(n0,n1),Math.max(n0,n1),st.oldDimsMm);
  }

  cell.fixedAxes={...(cell.fixedAxes||{})};
  if(fixed)cell.fixedAxes[axis]=true;else delete cell.fixedAxes[axis];
  if(fixed)addFixedBandForCell(root,cell,axis);
  if(ctx.cutId){
    for(const c of affected)setManualCutFixedInChain(c,ctx.cutId,fixed);
  }else if(cell.manualCut){
    cell.manualCut.isFixed=!!fixed;
  }

  rebuildDrawerSetsForRoot(root);
  renderSpaces();applyDoorVisibility(root);renderMachiningVisuals();
  selectSpaceCellByIds(root.id,cell.id,{showMenu:false});updateMeasureBadge();
  commitHistory();
  return {axis,targetMm,boundaryDeltaMm:mm(delta)};
}
function closeEditSelectedSpaceDialog(){
  $('editSelectedSpaceDialog').style.display='none';editSelectedSpaceContext=null;editSelectedSpaceRelations=null;
}
for(const id of ['editSelectedSpaceW','editSelectedSpaceD','editSelectedSpaceH'])$(id)?.addEventListener('input',updateEditSelectedSpacePreview);
$('editSelectedSpaceAxis')?.addEventListener('change',e=>applyEditSelectedSpaceAxis(e.target.value));
$('editSelectedSpaceFixed')?.addEventListener('change',updateEditSelectedSpacePreview);
$('cancelEditSelectedSpace')?.addEventListener('click',closeEditSelectedSpaceDialog);
$('editSelectedSpaceDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('editSelectedSpaceDialog'))closeEditSelectedSpaceDialog();});
$('confirmEditSelectedSpace')?.addEventListener('click',()=>{
  const ctx=editSelectedSpaceContext;if(!ctx){closeEditSelectedSpaceDialog();return;}
  try{
    const field=$(axisSpaceFieldId(ctx.axis)),target=parseDecimalInput(field?.value);
    const res=resizeSelectedSpaceCell(ctx,target,!!$('editSelectedSpaceFixed')?.checked);
    closeEditSelectedSpaceDialog();
    toast(`Espaço atualizado · ${axisShortName(res.axis)} ${nice(res.targetMm)} mm · ${$('editSelectedSpaceFixed')?.checked?'travado':'solto'}`);
  }catch(err){toast(err.message||'Não foi possível editar o espaço selecionado');}
});

function openEditSpaceDialog(){
  const root=activeSpaceRoot(); if(!root){toast('Selecione um espaço');return;}
  const rb=rootBounds(root);
  $('editSpaceName').value=root.name||'Espaço'; $('editSpaceW').value=mm(root.width); $('editSpaceD').value=mm(root.depth); $('editSpaceH').value=mm(root.height); $('editSpaceBaseY').value=nice(mm(root.yBase));
  $('editSpacePosX').value=nice(mm(rb.minX)); $('editSpacePosY').value=nice(mm(rb.minY)); $('editSpacePosZ').value=nice(mm(rb.minZ));
  $('editSpaceInfo').textContent=`${root.name} · altere tamanho e posição sem apagar ${runtimeModel.objects.filter(o=>o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root)).length} peça(s).`;

  fillSpaceMaterialSelect($('editSpaceDefaultMaterial'),root.defaultMaterialId||'',{allowNone:true});
  $('editSpaceDefaultMaterial').value=root.defaultMaterialId||'';
  $('editSpaceApplyMaterialExisting').checked=false;
  updateEditSpaceMaterialPreview();

  updateEditSpacePreview(); $('editSpaceDialog').style.display='flex';
}
['editSpaceW','editSpaceD','editSpaceH','editSpacePosX','editSpacePosZ'].forEach(id=>$(id)?.addEventListener('input',updateEditSpacePreview));
$('editSpaceBaseY')?.addEventListener('input',()=>{if($('editSpacePosY'))$('editSpacePosY').value=$('editSpaceBaseY').value;updateEditSpacePreview();});
$('editSpacePosY')?.addEventListener('input',()=>{if($('editSpaceBaseY'))$('editSpaceBaseY').value=$('editSpacePosY').value;updateEditSpacePreview();});
$('editSpaceDefaultMaterial').addEventListener('change',updateEditSpaceMaterialPreview);
$('cancelEditSpace').onclick=()=>{$('editSpaceDialog').style.display='none';};
$('editSpaceDialog').addEventListener('pointerdown',e=>{if(e.target===$('editSpaceDialog'))$('editSpaceDialog').style.display='none';});
$('confirmEditSpace').onclick=()=>{
  const root=activeSpaceRoot(); if(!root){toast('Espaço não encontrado');$('editSpaceDialog').style.display='none';return;}
  try{
    const targetX=m($('editSpacePosX').value),targetY=m($('editSpacePosY').value),targetZ=m($('editSpacePosZ').value);
    if(![targetX,targetY,targetZ].every(Number.isFinite))throw new Error('Confira a posição X / Y / Z');
    if(targetY<0)throw new Error('A posição Y não pode ficar abaixo do chão');

    // 1.300.25 · Trocar apenas material/nome NÃO pode passar pelo motor de
    // redimensionamento. Esse motor recalcula vãos por projeto quando a medida
    // externa muda; chamá-lo com as mesmas medidas era a causa de os vãos
    // mudarem ao marcar "aplicar em todas as peças".
    const beforeBounds=rootBounds(root);
    const requestedWidth=m($('editSpaceW').value),requestedDepth=m($('editSpaceD').value),requestedHeight=m($('editSpaceH').value);
    if(![requestedWidth,requestedDepth,requestedHeight].every(Number.isFinite)||requestedWidth<.002||requestedDepth<.002||requestedHeight<.002)throw new Error('Confira as medidas do espaço');
    const requestedName=String($('editSpaceName').value||root.name||'Espaço').trim()||'Espaço';
    const geoEps=.000001; // 0,001 mm
    const sizeChanged=Math.abs(requestedWidth-root.width)>geoEps||Math.abs(requestedDepth-root.depth)>geoEps||Math.abs(requestedHeight-root.height)>geoEps;
    const positionChanged=Math.abs(beforeBounds.minX-targetX)>geoEps||Math.abs(beforeBounds.minY-targetY)>geoEps||Math.abs(beforeBounds.minZ-targetZ)>geoEps;
    const linkedBefore=(sizeChanged||positionChanged)?collectSpaceLinkedObjects(root,beforeBounds):null;

    if(sizeChanged){
      resizeSpaceRoot(root,{width:requestedWidth,depth:requestedDepth,height:requestedHeight,yBase:beforeBounds.minY,name:requestedName});
    }else if(root.name!==requestedName){
      root.name=requestedName;
    }
    const moved=positionChanged
      ? moveSpaceRootToPosition(root,{leftX:targetX,yBase:targetY,backZ:targetZ,linkedObjects:linkedBefore})
      : false;

    // Confirma pelos dados reais do espaço que a posição pedida foi aplicada.
    const check=rootBounds(root),eps=.0005; // 0,5 mm
    if(Math.abs(check.minX-targetX)>eps || Math.abs(check.minY-targetY)>eps || Math.abs(check.minZ-targetZ)>eps){
      throw new Error('A posição X / Y / Z não foi aplicada corretamente');
    }

    const materialId=$('editSpaceDefaultMaterial').value||null;
    const oldMaterialId=root.defaultMaterialId||null,materialChanged=oldMaterialId!==materialId;
    root.defaultMaterialId=materialId;

    let applied=0;
    const mat=productionMaterialById(materialId);
    if(mat&&$('editSpaceApplyMaterialExisting').checked){
      applied=applySpaceMaterialToExistingPieces(root,mat).changed;
    }

    renderSpaces();applyDoorVisibility(root);renderMachiningVisuals();updateMeasureBadge();
    commitHistory(); $('editSpaceDialog').style.display='none';
    const rb=rootBounds(root);
    toast(applied
      ? `Espaço atualizado · material aplicado em ${applied} peça(s)`
      : sizeChanged
        ? `Espaço redimensionado · L ${nice(mm(root.width))} · P ${nice(mm(root.depth))} · A ${nice(mm(root.height))} mm`
        : positionChanged
          ? `Espaço movido · X ${nice(mm(rb.minX))} · Y ${nice(mm(rb.minY))} · Z ${nice(mm(rb.minZ))} mm`
          : materialChanged
            ? 'Material padrão do espaço atualizado'
            : 'Espaço atualizado sem alterar os vãos');
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
  const manualMode=!!$('spaceManualPosition')?.checked;
  const manualFloor=manualMode
    ? (Number($('spacePosY')?.value)||0)
    : (vertical&&ref ? mm(ref.yBase) : (Number($('spaceBaseY').value)||0));
  const rawGap=Number($('spaceGap').value);
  const payload={
    width:Number($('spaceW').value)||1000, depth:Number($('spaceD').value)||600, height:Number($('spaceH').value)||900,
    // O afastamento pode ser negativo: isso permite avançar/sobrepor o novo espaço.
    floor:Math.max(0,manualFloor), gap:Number.isFinite(rawGap)?rawGap:0, relation:newSpaceRelation,
    manualPosition:manualMode,
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
  for(const r of runtimeModel.spaceRoots){ const opt=document.createElement('option'); opt.value=r.id; opt.textContent=r.name; sel.appendChild(opt); }
  const pref=preferredRoot?.id||newSpaceReferenceId||activeSpaceRoot()?.id||runtimeModel.spaceRoots.at(-1)?.id||null;
  if(pref && runtimeModel.spaceRoots.some(r=>r.id===pref)) sel.value=pref;
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
function proposedSpacePlacement({ignoreManual=false}={}){
  const w=m($('spaceW').value),d=m($('spaceD').value),h=m($('spaceH').value),rawFloor=m($('spaceBaseY').value);
  const gapRaw=m($('spaceGap').value),gap=Number.isFinite(gapRaw)?gapRaw:0;
  if(![w,d,h,rawFloor,gap].every(Number.isFinite)||w<=0||d<=0||h<=0)return null;

  // Posição manual usa coordenadas amigáveis ao marceneiro/CAD:
  // X = canto esquerdo, Y = base, Z = canto traseiro.
  // Internamente o espaço continua armazenando X/Z pelo centro.
  const manual=!!$('spaceManualPosition')?.checked&&!ignoreManual;
  if(manual){
    const posX=m($('spacePosX').value),posY=m($('spacePosY').value),posZ=m($('spacePosZ').value);
    if(![posX,posY,posZ].every(Number.isFinite))return null;
    return {x:posX+w/2,yBase:posY,z:posZ+d/2,w,d,h,gap,ref:currentNewSpaceReference(),belowGround:posY<0,manual:true,userX:posX,userY:posY,userZ:posZ};
  }

  const floor=Math.max(0,rawFloor);
  const ref=currentNewSpaceReference();
  if(!ref){ return {x:w/2,yBase:floor,z:d/2,w,d,h,gap,ref:null,belowGround:false,manual:false,userX:0,userY:floor,userZ:0}; }
  const refMinX=ref.x-ref.width/2, refMaxX=ref.x+ref.width/2, refMinZ=ref.z-ref.depth/2, refMaxZ=ref.z+ref.depth/2;
  let x=refMinX+w/2, z=refMinZ+d/2, yBase=floor;
  if(newSpaceRelation==='right') x=refMaxX+gap+w/2;
  else if(newSpaceRelation==='left') x=refMinX-gap-w/2;
  else if(newSpaceRelation==='front') z=refMaxZ+gap+d/2;
  else if(newSpaceRelation==='back') z=refMinZ-gap-d/2;
  else if(newSpaceRelation==='top') yBase=ref.yBase+ref.height+gap;
  else if(newSpaceRelation==='bottom') yBase=ref.yBase-h-gap;
  return {x,yBase,z,w,d,h,gap,ref,belowGround:yBase<0,manual:false,userX:x-w/2,userY:yBase,userZ:z-d/2};
}
function setNewSpaceManualPosition(enabled,{seed=true}={}){
  const cb=$('spaceManualPosition');
  if(cb)cb.checked=!!enabled;
  if(enabled&&seed){
    const auto=proposedSpacePlacement({ignoreManual:true});
    if(auto){
      $('spacePosX').value=nice(mm(auto.x-auto.w/2));
      $('spacePosY').value=nice(mm(auto.yBase));
      $('spacePosZ').value=nice(mm(auto.z-auto.d/2));
    }
  }
  ['spacePosX','spacePosY','spacePosZ'].forEach(id=>{const el=$(id);if(el)el.readOnly=!enabled;});
  updateNewSpacePreview();
}
function updateNewSpacePreview(){
  const p=proposedSpacePlacement(), out=$('spaceCreatePreview'); if(!out)return;
  const ref=currentNewSpaceReference();
  const vertical=newSpaceRelation==='top'||newSpaceRelation==='bottom';
  const manual=!!$('spaceManualPosition')?.checked;
  if($('spaceBaseY')){
    $('spaceBaseY').readOnly=manual||!!(ref&&vertical);
    if(p&&(manual||(ref&&vertical))) $('spaceBaseY').value=nice(mm(p.yBase));
  }
  if(!p){out.textContent='Confira as medidas do novo espaço.';return;}

  // Fora do modo manual, os campos X/Y/Z funcionam como marcador da posição
  // calculada. Ao marcar a opção, passam a ser editáveis e controlam o espaço.
  if(!manual){
    $('spacePosX').value=nice(mm(p.x-p.w/2));
    $('spacePosY').value=nice(mm(p.yBase));
    $('spacePosZ').value=nice(mm(p.z-p.d/2));
  }
  if(p.belowGround){
    out.innerHTML=`<strong style="color:#ff665c">A posição Y deixaria o espaço abaixo do chão.</strong><br>Use Y igual ou maior que 0, ou ajuste a referência/afastamento.`;
    return;
  }
  const coords=`X <strong>${nice(mm(p.x-p.w/2))}</strong> · Y <strong>${nice(mm(p.yBase))}</strong> · Z <strong>${nice(mm(p.z-p.d/2))}</strong> mm`;
  if(manual){
    out.innerHTML=`Novo espaço: <strong>${escapeHtml($('spaceName').value.trim()||'Espaço')}</strong><br><strong>Posição manual</strong> · ${coords}<br>🧱 Material padrão: <strong>${escapeHtml(productionMaterialById($('spaceDefaultMaterial').value)?.name||'sem padrão')}</strong>`;
    return;
  }
  if(!ref){
    out.innerHTML=`<strong>${escapeHtml($('spaceName').value.trim()||'Espaço')}</strong> · primeiro espaço · base a <strong>${mm(p.yBase)} mm</strong> do chão<br>${coords}<br>🧱 Material padrão: <strong>${escapeHtml(productionMaterialById($('spaceDefaultMaterial').value)?.name||'sem padrão')}</strong>`;
    return;
  }
  out.innerHTML=`Novo espaço: <strong>${escapeHtml($('spaceName').value.trim()||'Espaço')}</strong><br>Referência: <strong>${ref.name}</strong> · ${relationLabel(newSpaceRelation)} · afastamento ${nice(mm(p.gap))} mm<br>${coords}<br>🧱 Material padrão: <strong>${escapeHtml(productionMaterialById($('spaceDefaultMaterial').value)?.name||'sem padrão')}</strong>`;
}
function openNewSpaceDialog(preferredRoot=null){
  const prefs=getSpaceCreatePrefs();
  if(prefs){
    $('spaceW').value=prefs.width??1000; $('spaceD').value=prefs.depth??600; $('spaceH').value=prefs.height??900;
    $('spaceBaseY').value=Math.max(0,Number(prefs.floor)||0); $('spaceGap').value=Number.isFinite(Number(prefs.gap))?Number(prefs.gap):0; newSpaceRelation=prefs.relation||'right';
    $('rememberSpaceConfig').checked=true;
    $('spaceManualPosition').checked=!!prefs.manualPosition;
  }else{
    $('spaceW').value=1000; $('spaceD').value=600; $('spaceH').value=900; $('spaceBaseY').value=0;
    $('spaceGap').value=0; $('rememberSpaceConfig').checked=false; newSpaceRelation='right';
    $('spaceManualPosition').checked=false;
  }
  const hasRef=runtimeModel.spaceRoots.length>0;
  $('spaceReferenceBlock').style.display=hasRef?'block':'none';
  $('newSpaceTitle').textContent=hasRef?'Criar outro espaço':'Criar espaço';
  $('newSpaceHelp').textContent=hasRef
    ? 'O espaço selecionado é a referência. Troque a referência abaixo se houver mais de um móvel e escolha em qual lado o novo espaço será criado.'
    : 'No primeiro espaço, X/Z começam na origem. Use Distância do chão para decidir se ele fica apoiado no piso ou elevado.';
  populateSpaceReferenceSelect(preferredRoot||activeSpaceRoot()||runtimeModel.spaceRoots.at(-1)||null);
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

  $('spaceName').value='Espaço '+(runtimeModel.spaceRoots.length+1);
  document.querySelectorAll('[data-space-relation]').forEach(b=>b.classList.toggle('active',b.dataset.spaceRelation===newSpaceRelation));
  $('newSpaceDialog').style.display='flex';
  // Sempre parte da posição automática atual. Se a preferência manual estiver
  // ligada, essa posição vira o ponto inicial editável, sem reaproveitar uma
  // coordenada antiga que poderia sobrepor outro móvel por acidente.
  setNewSpaceManualPosition(!!$('spaceManualPosition').checked,{seed:true});
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
  return {amount:18,side:'left',fixed:false,count:2};
}
function loadCutSpacePrefs(){
  const fallback=defaultCutSpacePrefs();
  try{
    const raw=JSON.parse(localStorage.getItem(cutSpacePrefsStorageKey())||'null');
    if(!raw)return fallback;
    const amount=Number(raw.amount);
    const sides=['left','right','top','bottom','front','back'];
    const count=Math.round(Number(raw.count));
    return {
      amount:Number.isFinite(amount)&&amount>=0?amount:fallback.amount,
      side:sides.includes(raw.side)?raw.side:fallback.side,
      fixed:!!raw.fixed,
      count:Number.isFinite(count)&&count>=1&&count<=50?count:fallback.count
    };
  }catch{
    return fallback;
  }
}
function applyCutSpacePrefs(){
  const p=loadCutSpacePrefs();
  cutSide=p.side;
  $('cutAmount').value=nice(p.amount);
  if($('cutCount'))$('cutCount').value=String(p.count||2);
  $('cutFixed').checked=!!p.fixed;
  document.querySelectorAll('[data-cut-side]').forEach(
    b=>b.classList.toggle('active',b.dataset.cutSide===cutSide)
  );
  $('cutSavedInfo').innerHTML=
    `Configuração carregada: <strong>${nice(p.amount)} mm · ${Number(p.amount)===0?`${p.count||2} vão(s) iguais · `:''}${cutSideName(p.side)} · ${p.fixed?'faixa fixa':'faixa solta'}</strong>.`;
  updateCutPreview();
}
function cutSpaceCountValue({strict=false}={}){
  const raw=String($('cutCount')?.value??'2').trim();
  const n=Number(raw.replace(',','.'));
  if(!Number.isFinite(n)||Math.round(n)!==n||n<1||n>50){
    if(strict)return null;
    return 2;
  }
  return Math.round(n);
}
function saveCutSpacePrefs(){
  const amount=Number(String($('cutAmount').value||'').replace(',','.'));
  const count=cutSpaceCountValue({strict:true});
  if(!Number.isFinite(amount)||amount<0){
    toast('Confira a medida antes de salvar');
    return;
  }
  if(count===null){
    toast('Quantidade de vãos: use um número inteiro entre 1 e 50');
    return;
  }
  const p={amount,side:cutSide,fixed:!!$('cutFixed').checked,count};
  try{
    localStorage.setItem(cutSpacePrefsStorageKey(),JSON.stringify(p));
    $('cutSavedInfo').innerHTML=
      `Salvo para esta conta: <strong>${nice(amount)} mm · ${amount===0?`${count} vão(s) iguais · `:''}${cutSideName(cutSide)} · ${p.fixed?'faixa fixa':'faixa solta'}</strong>.`;
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
  const raw=parseDecimalInput($('cutAmount').value);
  const total=(cutSide==='left'||cutSide==='right') ? mm(info.size.width)
             : (cutSide==='front'||cutSide==='back') ? mm(info.size.depth)
             : mm(info.size.height);
  const equalMode=Number.isFinite(raw)&&Math.abs(raw)<.0000001;
  const count=cutSpaceCountValue();
  const a=Number.isFinite(raw)?raw:0;
  const fixed=$('cutFixed')?.checked;
  $('cutSideLabel').value=cutSideName(cutSide);
  if(equalMode){
    if(count===1){
      $('cutPreview').textContent=`${cutSideName(cutSide)}: 1 vão = MANTER INTEIRO · nenhum corte · ${nice(total)} mm`;
      return;
    }
    const each=total/count;
    $('cutPreview').textContent=`${cutSideName(cutSide)}: 0 = DIVIDIR EM ${count} VÃOS IGUAIS · ${count} × ${nice(each)} mm · ${fixed?'faixas criadas FIXAS':'vãos SOLTOS'} · externo continua ${nice(total)} mm`;
    return;
  }
  $('cutPreview').textContent=`${cutSideName(cutSide)}: ${nice(a)} mm + restante ${nice(Math.max(0,total-a))} mm · ${fixed?'FIXO (não redimensiona)':'SOLTO (pode redimensionar)'} · externo continua ${nice(total)} mm · quantidade de vãos é usada quando a medida = 0`;
}
$('cancelSpace').onclick=()=>{$('newSpaceDialog').style.display='none';};
$('spaceReference').addEventListener('change',()=>{newSpaceReferenceId=$('spaceReference').value||null;const ref=currentNewSpaceReference();if(ref && !(newSpaceRelation==='top'||newSpaceRelation==='bottom')&&!$('spaceManualPosition')?.checked) $('spaceBaseY').value=mm(ref.yBase);updateNewSpacePreview();});
document.querySelectorAll('[data-space-relation]').forEach(b=>b.addEventListener('click',()=>setNewSpaceRelation(b.dataset.spaceRelation)));
$('spaceManualPosition').addEventListener('change',()=>setNewSpaceManualPosition($('spaceManualPosition').checked,{seed:true}));
['spaceName','spaceW','spaceD','spaceH','spaceBaseY','spaceGap','spacePosX','spacePosY','spacePosZ'].forEach(id=>$(id).addEventListener('input',updateNewSpacePreview));
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
  if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
  if(!ctx.selectedSpaceCell)return;
  applyCutSpacePrefs();
  $('cutSpaceDialog').style.display='flex';
};
$('cancelCut').onclick=()=>{$('cutSpaceDialog').style.display='none';};
$('saveCutConfig').onclick=saveCutSpacePrefs;
document.querySelectorAll('[data-cut-side]').forEach(b=>b.onclick=()=>{cutSide=b.dataset.cutSide;document.querySelectorAll('[data-cut-side]').forEach(x=>x.classList.toggle('active',x===b));updateCutPreview();});
$('cutAmount').addEventListener('input',updateCutPreview); $('cutCount')?.addEventListener('input',updateCutPreview); $('cutFixed').addEventListener('change',updateCutPreview);
$('cutCount')?.addEventListener('blur',()=>{const n=cutSpaceCountValue();$('cutCount').value=String(n);updateCutPreview();});
$('confirmCut').onclick=()=>{
  const fixed=$('cutFixed').checked,amount=parseDecimalInput($('cutAmount').value),count=cutSpaceCountValue({strict:true});
  if(count===null){toast('Quantidade de vãos: use um número inteiro entre 1 e 50');return;}
  const res=applySelectedSpaceCut(cutSide,m(amount),fixed,count);
  if(res.ok){
    $('cutSpaceDialog').style.display='none';
    toast(res.noCut?'1 vão · espaço mantido inteiro':(Number(amount)===0?`Espaço dividido em ${res.count} vãos iguais${fixed?' · faixas fixas':' · vãos soltos'}`:(fixed?'Espaço dividido · faixa fixa':'Espaço dividido · faixa solta')));
  }
};
// v61 · Móvel curvo: 3 referências fixas + extras equilibrados somente nos trechos retos.
// Ao reduzir o raio, evita manter uma nervura incompatível de configuração antiga.
  return {axisCellMinKey,axisCellMaxKey,addFixedBandForCell,cellTangentWithin,cellTangentOverlapArea,cellTangentFaceArea,selectedCellEditPair,openEditSelectedSpaceDialog,openEditSpaceDialog,openNewSpaceDialog,applyCutSpacePrefs,cutSpaceCountValue,cutSideName,getCutSide:()=>cutSide,setCutSide:v=>{cutSide=v;},updateCutPreview,updateEditSpacePreview,updateEditSelectedSpacePreview,resizeSelectedSpaceCell,closeEditSelectedSpaceDialog,updateNewSpacePreview};
}
