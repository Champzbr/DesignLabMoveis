// DesignLabMoveis 1.310.00 · helpers de produção/DXF compartilhados.
export function createProductionExportHelpers(ctx){
  const { roundMmNumber, pieceThicknessInfo, curvedPostOutlineMm, productionObjectKind, productionClone, productionMaterialById, normalizePieceGrainRotation, pieceEdgeBandSignature, pieceEdgeBandSummary, cloneMachining, entryAxisName, entryAxisSign, axisLabel, operationDepthMm, holeSeriesInstances, resolvedMachiningCoords } = ctx;
function flatPartInfo(o,index,{production=false}={}){
  const u=o.userData;if(u?.excludeFromCutList||u?.kind==='hardware-visual')return null;const ti=pieceThicknessInfo(o); if(!ti)return null;
  const cp=u.customProfile||null,fp=u.formProfile||null;
  const postProfile=(!cp&&u.curvedRole==='post'&&u.curvedConfig)?curvedPostOutlineMm(u.curvedConfig):null;
  // 1.300.17 · medida acabada no CAD; sobremedida somente para fabricação.
  const ds=u.doorSystem||null,doorFace=String(ds?.role||'').startsWith('leaf-face');
  const over=(production&&doorFace)?Math.max(0,Number(ds?.productionOversizeMm)||0):0;
  const baseFaceW=cp?.bboxW||fp?.bboxW||postProfile?.bboxW||ti.faceW;
  const baseFaceH=cp?.bboxH||fp?.bboxH||postProfile?.bboxH||ti.faceH;
  return {
    index,name:u.name||`Peça ${index}`,
    material:u.materialType||'MDF',materialId:u.materialId||null,materialCode:u.materialCode||'',productionKind:productionObjectKind(o),
    materialRecord:productionClone(productionMaterialById(u.materialId)||{}),materialGrain:!!u.materialGrain,materialGrainRotation:normalizePieceGrainRotation(u.materialGrainRotation),
    partId:u.partId||'',edgeBands:productionClone(u.edgeBands||{}),edgeBandSignature:pieceEdgeBandSignature(o),edgeBandSummary:pieceEdgeBandSummary(o),
    thickness:ti.thickness,faceW:baseFaceW+over*2,faceH:baseFaceH+over*2,finishedFaceW:baseFaceW,finishedFaceH:baseFaceH,doorProductionOversizeMm:over,
    thicknessAxis:cp?'y':ti.thicknessAxis,uAxis:cp?'x':ti.uAxis,vAxis:cp?'z':ti.vAxis,dims:ti.dims,object:o,
    machining:cloneMachining(u.machining||[]),
    customOutline:fp?.points?JSON.parse(JSON.stringify(fp.points)):(cp?.points?JSON.parse(JSON.stringify(cp.points)):(postProfile?.points?JSON.parse(JSON.stringify(postProfile.points)):null)),
    customCutouts:fp?.cutouts?JSON.parse(JSON.stringify(fp.cutouts)):[],
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

// 1.310.00 · prévia/exportação/plano de corte movidos para js/modules/cut-plan-ui.js.
  return {flatPartInfo,layerNum,normalizedLayer,dxfPair,dxfLine,dxfClosedRect,dxfClosedPolyline,dxfCircle,machiningLayer,mapPlacedUV,projectOperation};
}
