// DesignLabMoveis 1.311.00 · módulo machining-shapes.
export function createMachiningShapesModule(ctx){
// 1.311.00-r5 · corrige referência de cor de seleção após migração state→ctx.
// COLORS.ctx.selected era inválido e quebrava ao aplicar/reconstruir uma Forma.
  const { $, COLORS, MM_TO_M, M_TO_MM, THREE, adminAllowed, cloudApiFetch, commitHistory, controls, m, makeBoxVisualEdges, makeCadEdgeMaterial, nice, perspectiveCamera, referenceMeshes, restoreBaseColor, returnTo3D, roundMmNumber, scene, selectObject, setAllFaces, setDesignLabVisualizationOnly, setDimensions, setTool, setVisualMode, toast, uid, updateInspector, xray3DActive }=ctx;
  const runtimeModel=ctx.runtimeModel;
  // ---- domínio extraído do runtime: linhas 4877-4952 ----
  // 1.200.52 · USINAGENS/FERRAGENS ACOMPANHAM O REDIMENSIONAMENTO DA PEÇA
  // ============================================================================
  // Uma operação salva em 100 mm da borda deve continuar a 100 mm da mesma
  // borda quando um modelo/espaço cresce. Operações próximas da borda oposta
  // passam a usar referência negativa; operações centrais permanecem centradas.
  function machiningResizeRawCoord(op,axis){
    const r=op?.coordRef?.[axis];
    if(Number.isFinite(Number(r)))return Number(r);
    const v=Number(op?.[axis]);return Number.isFinite(v)?v:0;
  }
  function machiningResizeSpan(op,axis){
    if(op?.type!=='groove')return 0;
    if(op.lengthAxis===axis)return Math.max(0,Number(op.length)||0);
    const da=String(op.entryAxis||'').slice(-1);
    if(axis!==da&&axis!==op.lengthAxis)return Math.max(0,Number(op.width)||0);
    return 0;
  }
  function machiningResizeAnchorForAxis(op,axis,oldDim,span){
    op.resizeAnchor=op.resizeAnchor&&typeof op.resizeAnchor==='object'?op.resizeAnchor:{};
    op.resizeAnchorOffset=op.resizeAnchorOffset&&typeof op.resizeAnchorOffset==='object'?op.resizeAnchorOffset:{};
    let anchor=op.resizeAnchor[axis];
    const raw=machiningResizeRawCoord(op,axis);
    const maxPos=Math.max(0,Number(oldDim)||0)-Math.max(0,Number(span)||0);
    const pos=raw<0?maxPos+raw:raw;
    if(!['start','end','center'].includes(anchor)){
      if(raw<0)anchor='end';
      else{
        const center=maxPos/2;
        const centerTol=Math.max(1.5,Math.min(12,Math.max(0,Number(oldDim)||0)*0.025));
        if(Math.abs(pos-center)<=centerTol)anchor='center';
        else anchor=pos<=center?'start':'end';
      }
      op.resizeAnchor[axis]=anchor;
      if(anchor==='start')op.resizeAnchorOffset[axis]=Math.max(0,pos);
      else if(anchor==='end')op.resizeAnchorOffset[axis]=Math.max(0,maxPos-pos);
      else op.resizeAnchorOffset[axis]=pos-maxPos/2;
    }else if(!Number.isFinite(Number(op.resizeAnchorOffset[axis]))){
      if(anchor==='start')op.resizeAnchorOffset[axis]=Math.max(0,pos);
      else if(anchor==='end')op.resizeAnchorOffset[axis]=Math.max(0,maxPos-pos);
      else op.resizeAnchorOffset[axis]=pos-maxPos/2;
    }
    return {anchor,offset:Number(op.resizeAnchorOffset[axis])||0};
  }
  function remapMachiningArrayForPieceResize(machining,oldDims,newDims){
    if(!Array.isArray(machining)||!machining.length)return machining;
    oldDims=oldDims||{};newDims=newDims||{};
    for(const op of machining){
      if(!op)continue;
      op.coordRef=op.coordRef&&typeof op.coordRef==='object'?op.coordRef:{};
      const da=String(op.entryAxis||'').slice(-1);
      for(const axis of ['x','y','z']){
        if(axis===da)continue;
        const od=Number(oldDims[axis]),nd=Number(newDims[axis]);
        if(!Number.isFinite(od)||!Number.isFinite(nd)||od<=0||nd<=0)continue;
        const span=machiningResizeSpan(op,axis);
        const {anchor,offset}=machiningResizeAnchorForAxis(op,axis,od,span);
        const maxNew=Math.max(0,nd-span);
        let raw;
        if(anchor==='start')raw=offset;
        else if(anchor==='end')raw=-offset;
        else raw=maxNew/2+offset;
        op.coordRef[axis]=raw;
      }
    }
    return machining;
  }
  function remapMachiningForPieceResize(obj,oldDims,newDims){
    const arr=obj?.userData?.machining;
    if(!Array.isArray(arr)||!arr.length)return;
    remapMachiningArrayForPieceResize(arr,oldDims,newDims);
  }
  function cloneMachiningForTargetSize(machining,oldDims,newDims){
    const copy=JSON.parse(JSON.stringify(Array.isArray(machining)?machining:[]));
    remapMachiningArrayForPieceResize(copy,oldDims,newDims);
    return copy;
  }
  // ---- domínio extraído do runtime: linhas 10867-10963 ----
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
    if(!ctx.selected)return;const ti=pieceThicknessInfo(ctx.selected);if(!ti)return;const axis=$('machiningLengthAxis').value;
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
  // ---- domínio extraído do runtime: linhas 11559-11817 ----
  const SHAPE_PRESET_KEY='miniCadProV78_shapePresets';
  const BUILTIN_SHAPES=[
    {id:'builtin-r50',locked:true,folder:'Cantos',name:'Canto R50',type:'round-corner',radius:50},
    {id:'builtin-r100',locked:true,folder:'Cantos',name:'Canto R100',type:'round-corner',radius:100},
    {id:'builtin-r150',locked:true,folder:'Cantos',name:'Canto R150',type:'round-corner',radius:150}
  ];
  let shapePresetEditId=null;
  let shapeSelectedCorners=new Set(['bl']);
  let shapePreviewOwner=null, shapePreviewOriginalForms=null, shapePreviewActive=false;
  
  // ---------- 1.200.42 · Mini CAD Forma com inferência magnética estilo SketchUp ----------
  const shapeCadState={
    tool:'edit',points:[],closed:false,undo:[],redo:[],draft:[],pointer:null,dragIndex:-1,
    current:null,rawCurrent:null,baseW:0,baseH:0,loadedPresetId:null,hoverSnap:null,guides:[],
    lastPointerType:'mouse'
  };
  function shapeCadOwnerInfo(){const o=shapePreviewOwner||ctx.selected,ti=pieceThicknessInfo(o);return {o,ti,W:ti?.faceW||1,H:ti?.faceH||1};}
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
    const labels=shapeCornerLabels(shapePreviewOwner||ctx.selected);
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
    const group=new THREE.Group();group.userData.isVisualEdge=true;const mat=new THREE.LineBasicMaterial({color:xray3DActive()?0x111111:0x2b2f30,transparent:true,opacity:xray3DActive()?.82:.68,depthTest:!xray3DActive(),depthWrite:false});group.material=mat;const t=ti.thickness/2;
    for(const side of [-t,t]){const arr=pts.map(([u,v])=>formLocalPoint(ti,u,v,side));if(arr.length)arr.push(arr[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),mat);line.userData.isVisualEdge=true;group.add(line);}
    // Só quatro ligações de espessura. Não desenha uma linha em cada segmento do arco.
    const anchors=[[0,0],[ti.faceW,0],[ti.faceW,ti.faceH],[0,ti.faceH]],seg=[];for(const a of anchors){let best=pts[0],bd=Infinity;for(const p of pts){const d=(p[0]-a[0])**2+(p[1]-a[1])**2;if(d<bd){bd=d;best=p;}}seg.push(formLocalPoint(ti,best[0],best[1],-t),formLocalPoint(ti,best[0],best[1],t));}
    const sides=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),mat);sides.userData.isVisualEdge=true;group.add(sides);group.renderOrder=xray3DActive()?88:12;return group;
  }
  function rebuildFormGeometry(o){
    if(!o||o.userData?.kind==='cylinder'||o.userData?.kind==='curved-panel'||o.userData?.curvedRole)return;
    const ti=pieceThicknessInfo(o);if(!ti)return;disposeVisualEdgeTree(o);o.geometry?.dispose?.();
    const forms=Array.isArray(o.userData.forms)?o.userData.forms:[];
    if(!forms.length){o.geometry=new THREE.BoxGeometry(1,1,1);o.scale.set(o.userData.width,o.userData.height,o.userData.depth);delete o.userData.formProfile;const mat=makeCadEdgeMaterial({color:xray3DActive()?0x111111:0x2b2f30,transparent:true,opacity:xray3DActive()?.82:.68,depthTest:!xray3DActive(),depthWrite:false,linewidth:xray3DActive()?1.45:1.1,xray:xray3DActive()});const e=makeBoxVisualEdges(mat,{xray:xray3DActive()});o.add(e);o.userData.visualEdges=e;return;}
    const pts=formOutlinePointsMm(o,forms,48);if(pts.length<4)return;
    const shape=new THREE.Shape();pts.forEach(([u,v],i)=>{const x=(u-ti.faceW/2)*MM_TO_M,y=(v-ti.faceH/2)*MM_TO_M;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);});shape.closePath();
    const geom=new THREE.ExtrudeGeometry(shape,{depth:ti.thickness*MM_TO_M,bevelEnabled:false,steps:1,curveSegments:64});geom.translate(0,0,-ti.thickness*MM_TO_M/2);formMapExtrudeGeometry(geom,ti);o.geometry=geom;o.scale.set(1,1,1);
    o.userData.formProfile={type:'forms',points:pts.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),bboxW:ti.faceW,bboxH:ti.faceH,thicknessAxis:ti.thicknessAxis,uAxis:ti.uAxis,vAxis:ti.vAxis};
    const edges=makeFormVisualEdges(o,pts,ti);o.add(edges);o.userData.visualEdges=edges;
  }
  function shapeDraftOperation(){
    const type=$('shapeType')?.value||'round-corner',name=String($('shapeName').value||'Forma').trim()||'Forma',folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',presetId=$('shapePresetSelect')?.value||null;
    const ti=pieceThicknessInfo(shapePreviewOwner||ctx.selected);if(!ti)throw new Error('Selecione uma peça retangular');
    if(type==='custom-profile'){
      const points=shapeCadProfilePoints();
      return {id:uid('form'),type:'custom-profile',name,folder,presetId,points:points.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),baseW:ti.faceW,baseH:ti.faceH};
    }
    const radius=Number($('shapeRadius').value);if(!(radius>0))throw new Error('Confira o raio');if(!shapeSelectedCorners.size)throw new Error('Escolha pelo menos um canto');if(radius>Math.min(ti.faceW,ti.faceH)/2+.001)throw new Error(`Raio máximo nesta peça: ${nice(Math.min(ti.faceW,ti.faceH)/2)} mm`);
    return {id:uid('form'),type:'round-corner',name,radius,folder,presetId,corners:[...shapeSelectedCorners]};
  }
  function updateShapePreview(){
    const owner=shapePreviewOwner||ctx.selected,svg=$('shapePreviewSvg');if(!owner||!svg)return;const ti=pieceThicknessInfo(owner);if(!ti)return;
    let forms=cloneForms(owner.userData.forms||[]),op=null,msg='';try{op=shapeDraftOperation();forms.push(op);}catch(err){msg=err.message||'Confira a forma';}
    const pts=formOutlinePointsMm(owner,forms,24),W=ti.faceW,H=ti.faceH,pad=22,sw=420,sh=260,scale=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H)),ox=(sw-W*scale)/2,oy=(sh-H*scale)/2;
    const d=pts.map(([u,v],i)=>`${i?'L':'M'} ${(ox+u*scale).toFixed(2)} ${(sh-(oy+v*scale)).toFixed(2)}`).join(' ')+' Z';
    svg.innerHTML=`<path d="${d}" fill="#c8b591" stroke="#080808" stroke-width="2.2"/><text x="${sw/2}" y="18" text-anchor="middle" fill="#53d6e8" font-size="12">${nice(W)} × ${nice(H)} mm</text>`;
    $('shapePreviewText').textContent=msg||(op?.type==='custom-profile'?`${op?.name||'Forma'} · Mini CAD · ${op?.points?.length||0} pontos · contorno fechado.`:`${op?.name||'Forma'} · raio ${nice(op?.radius||0)} mm · ${op?.corners?.length||0} canto(s) selecionado(s).`);
  }
  function renderAppliedShapes(){
    const list=$('shapeAppliedList');if(!list)return;list.innerHTML='';const owner=shapePreviewOwner||ctx.selected,forms=owner?.userData?.forms||[],labels=shapeCornerLabels(owner);
    if(!forms.length){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma Forma aplicada nesta peça.';list.appendChild(d);return;}
    for(const f of forms){const item=document.createElement('div');item.className='shapeAppliedItem';const text=document.createElement('div');text.innerHTML=`<strong></strong><span></span>`;text.querySelector('strong').textContent=f.name||'Forma';text.querySelector('span').textContent=f.type==='custom-profile'?`Mini CAD · ${(f.points||[]).length} pontos · contorno personalizado`:`R ${nice(f.radius)} mm · ${(f.corners||[]).map(c=>labels[c]||c).join(' + ')}`;const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteAppliedShape(f.id);item.append(text,del);list.appendChild(item);}
  }
  function deleteAppliedShape(id){
    const owner=shapePreviewOwner||ctx.selected;if(!owner)return;const arr=owner.userData.forms||[],f=arr.find(x=>x.id===id);if(!f)return;if(!window.confirm(`Excluir a Forma “${f.name||'Forma'}” desta peça?`))return;owner.userData.forms=arr.filter(x=>x.id!==id);rebuildFormGeometry(owner);renderAppliedShapes();updateShapePreview();renderMachiningVisuals();commitHistory();toast('Forma removida da peça');
  }
  function openShapeDialog(){
    if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
    if(!ctx.selected){toast('Selecione uma peça');return;}if(ctx.selected.userData?.kind==='cylinder'||ctx.selected.userData?.kind==='curved-panel'||ctx.selected.userData?.curvedRole){toast('Forma disponível para peças retangulares');return;}
    shapePreviewOwner=ctx.selected;shapePreviewOriginalForms=null;shapePreviewActive=false;shapePresetEditId=null;shapeSelectedCorners=new Set(['bl']);$('morePanel').style.display='none';$('machiningDialog').style.display='none';
    const ti=pieceThicknessInfo(ctx.selected);$('shapePartInfo').textContent=`${ctx.selected.userData.name||'Peça'} · face ${nice(ti.faceW)} × ${nice(ti.faceH)} mm · espessura ${nice(ti.thickness)} mm. A Forma altera o contorno real e será exportada em CORTE_EXTERNO.`;
    refreshShapePresetSelect('builtin-r150');refreshShapeCornerLabels();shapeCadInitForOwner({forceRect:true});shapeCadSyncUi();renderAppliedShapes();updateShapePreview();$('shapeDialog').style.display='flex';
  }
  function restoreShapePreview(){
    if(shapePreviewActive&&shapePreviewOwner&&runtimeModel.objects.includes(shapePreviewOwner)){shapePreviewOwner.userData.forms=cloneForms(shapePreviewOriginalForms||[]);rebuildFormGeometry(shapePreviewOwner);}
    shapePreviewActive=false;shapePreviewOriginalForms=null;$('shape3DPreviewBar').style.display='none';setDesignLabVisualizationOnly(false);renderMachiningVisuals();
  }
  function previewShape3D(){
    const owner=shapePreviewOwner||ctx.selected;if(!owner)return;try{restoreShapePreview();shapePreviewOwner=owner;shapePreviewOriginalForms=cloneForms(owner.userData.forms||[]);const forms=cloneForms(shapePreviewOriginalForms);forms.push(shapeDraftOperation());owner.userData.forms=forms;rebuildFormGeometry(owner);shapePreviewActive=true;$('shapeDialog').style.display='none';$('shape3DPreviewBar').style.display='flex';setDesignLabVisualizationOnly(true);$('shape3DPreviewInfo').textContent=`${owner.userData.name||'Peça'} · prévia temporária; volte para aplicar ou ajustar.`;selectObject(owner);toast('Prévia 3D da Forma');}catch(err){restoreShapePreview();toast(err.message||'Não foi possível visualizar');}
  }
  function returnShapePreview(){restoreShapePreview();if(shapePreviewOwner&&runtimeModel.objects.includes(shapePreviewOwner))selectObject(shapePreviewOwner);$('shapeDialog').style.display='flex';updateShapePreview();}
  function applyShapeToPiece(){
    const owner=shapePreviewOwner||ctx.selected;if(!owner)return;try{restoreShapePreview();shapePreviewOwner=owner;const op=shapeDraftOperation(),arr=cloneForms(owner.userData.forms||[]);arr.push(op);owner.userData.forms=arr;rebuildFormGeometry(owner);renderAppliedShapes();updateShapePreview();renderMachiningVisuals();updateInspector();commitHistory();toast(`${op.name} aplicada`);}catch(err){toast(err.message||'Forma inválida');}
  }
  function closeShapeDialog(){restoreShapePreview();$('shapeDialog').style.display='none';shapePreviewOwner=null;shapePresetEditId=null;}
  // ---- domínio extraído do runtime: linhas 12210-13439 ----
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
    const ti=pieceThicknessInfo(ctx.selected); if(!ti)throw new Error('Selecione uma peça retangular');
    const side=entryAxisSign($('machiningFace').value)<0?-1:1;
    const data={entrySide:side,coords:{x:machiningFieldNumber('machiningX'),y:machiningFieldNumber('machiningY'),z:machiningFieldNumber('machiningZ')},through:$('machiningThrough').checked};
    if(!Object.values(data.coords).every(Number.isFinite))throw new Error('Confira X, Y e Z');
    if(machiningType==='hole')Object.assign(data,{diameter:Number($('machiningDiameter').value),depth:Number($('machiningDepthHole').value),seriesEnabled:$('machiningSeries').checked,seriesCount:Number($('machiningSeriesCount').value),seriesStep:Number($('machiningSeriesStep').value),seriesAxis:$('machiningSeriesAxis').value,seriesDirection:Number($('machiningSeriesDirection').value)<0?-1:1});
    else {const fullLength=grooveLengthIsFull();Object.assign(data,{lengthAxis:$('machiningLengthAxis').value,fullLength,length:fullLength?null:parseDecimalInput($('machiningLength').value),width:Number($('machiningWidth').value),depth:Number($('machiningDepthGroove').value),backGroove:$('machiningBackGroove').checked,rearOffset:Number($('machiningRearOffset').value)});}
    return data;
  }
  function applyMachiningPresetData(p){
    if(!ctx.selected||!p)return; const ti=pieceThicknessInfo(ctx.selected); if(!ti)return;
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
    if(!ctx.selected)return; const ti=pieceThicknessInfo(ctx.selected),sel=$('machiningSeriesAxis'); if(!ti||!sel)return; sel.innerHTML='';
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
    if(!ctx.selected)return; const ti=pieceThicknessInfo(ctx.selected); if(!ti)return;
    if(![ti.uAxis,ti.vAxis].includes('z')){toast('Nesta orientação, Z é a espessura; use a série manual');return;}
    const seriesAxis=[ti.uAxis,ti.vAxis].find(a=>a!=='z');
    $('machiningSeries').checked=true; populateMachiningSeriesAxes(seriesAxis); $('machiningSeriesAxis').value=seriesAxis;
    $('machiningSeriesCount').value=10; $('machiningSeriesStep').value=32; $('machiningSeriesDirection').value='1'; $('machiningDiameter').value=5;
    // 37 mm da frente: frente = Z máximo; valor é o centro do furo.
    $('machiningZ').value=-37;
    updateHoleSeriesVisibility(); updateMachiningUI();
  }
  function applyBackGroovePreset(){
    if(!ctx.selected)return; const ti=pieceThicknessInfo(ctx.selected); if(!ti)return;
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
    while(runtimeModel.machiningVisualGroup.children.length){
      const v=runtimeModel.machiningVisualGroup.children[0]; runtimeModel.machiningVisualGroup.remove(v);
      v.geometry?.dispose?.();
      if(Array.isArray(v.material))v.material.forEach(m=>m?.dispose?.()); else v.material?.dispose?.();
    }
  }
  function renderMachiningVisuals(){
    clearMachiningVisuals();
    for(const owner of runtimeModel.objects){
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
          v.userData={machiningOwner:owner,machiningOp:op,machiningPoint:point}; v.renderOrder=88; runtimeModel.machiningVisualGroup.add(v);
        }
      }
    }
    updateMachiningVisualTransforms();
    runtimeModel.machiningVisualGroup.visible=ctx.cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive;
  }
  function updateMachiningVisualTransforms(){
    for(const v of runtimeModel.machiningVisualGroup.children){
      const o=v.userData.machiningOwner,op=v.userData.machiningOp;
      if(!o || !runtimeModel.objects.includes(o) || !op){v.visible=false;continue;} v.visible=ctx.cadMachiningVisible&&o.visible!==false;
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
    while(runtimeModel.machiningDraftPreviewGroup.children.length){
      const v=runtimeModel.machiningDraftPreviewGroup.children[0]; runtimeModel.machiningDraftPreviewGroup.remove(v);
      v.geometry?.dispose?.();
      if(Array.isArray(v.material))v.material.forEach(m=>m?.dispose?.()); else v.material?.dispose?.();
    }
  }
  function updateDraftPreviewTransforms(){
    for(const v of runtimeModel.machiningDraftPreviewGroup.children){
      const o=v.userData.machiningOwner,op=v.userData.machiningOp;
      if(!o || !runtimeModel.objects.includes(o) || !op){v.visible=false;continue;}
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
      v.renderOrder=99; runtimeModel.machiningDraftPreviewGroup.add(v);
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
      const owner=ctx.selected,op=machiningDraft();
      if(!owner)throw new Error('Selecione uma peça');
      ctx.machiningPreviewOwner=owner; ctx.machiningPreviewActive=true;
      renderMachiningDraftPreview(owner,op);
      runtimeModel.machiningVisualGroup.visible=false;
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
      clearMachiningDraftPreview(); ctx.machiningPreviewActive=false; runtimeModel.machiningVisualGroup.visible=ctx.cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive;
      setDesignLabVisualizationOnly(false);
      toast(err.message||'Não foi possível visualizar a usinagem');
    }
  }
  function closeMachining3DPreview({reopen=true}={}){
    clearMachiningDraftPreview(); ctx.hardwarePreviewOps=[];
    ctx.machiningPreviewActive=false; runtimeModel.machiningVisualGroup.visible=ctx.cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive;
    setDesignLabVisualizationOnly(false);
    $('machining3DPreviewBar').style.display='none';
    if(ctx.machiningPreviewOwner&&runtimeModel.objects.includes(ctx.machiningPreviewOwner))selectObject(ctx.machiningPreviewOwner);
    ctx.machiningPreviewOwner=null; ctx.hardwarePreviewOps=[];
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
    if(hardware){ctx.refreshHardwarePresetSelect();renderMachiningList();return;}
    if(reset) setDefaultMachiningValues();
    updateHoleSeriesVisibility(); updateBackGrooveVisibility();
    refreshMachiningPresetSelect();
    updateMachiningUI();
  }
  function populateMachiningFaceOptions(keep=null){
    if(!ctx.selected)return; const opts=machiningFaceOptions(ctx.selected),sel=$('machiningFace'); sel.innerHTML='';
    for(const o of opts){const el=document.createElement('option');el.value=o.value;el.textContent=o.label;sel.appendChild(el);}
    const preferred=opts.some(o=>o.value===keep)?keep:opts.at(-1)?.value; if(preferred)sel.value=preferred;
    populateMachiningLengthAxes(); setMachiningSurfaceCoordinate();
  }
  function populateMachiningLengthAxes(keep=null){
    if(!ctx.selected)return; const ti=pieceThicknessInfo(ctx.selected),sel=$('machiningLengthAxis'); if(!ti)return; sel.innerHTML='';
    for(const a of [ti.uAxis,ti.vAxis]){const el=document.createElement('option');el.value=a;el.textContent=`Eixo ${axisLabel(a)} · ${nice(ti.dims[a])} mm`;sel.appendChild(el);}
    sel.value=[ti.uAxis,ti.vAxis].includes(keep)?keep:ti.uAxis;
    populateMachiningSeriesAxes();
  }
  function setMachiningSurfaceCoordinate(){
    if(!ctx.selected)return; const ti=pieceThicknessInfo(ctx.selected),face=$('machiningFace').value;if(!ti||!face)return;
    const a=entryAxisName(face),sign=entryAxisSign(face); localCoordField(a).value=sign>0?0:ti.dims[a];
  }
  function setDefaultMachiningValues(){
    if(!ctx.selected)return; const ti=pieceThicknessInfo(ctx.selected);if(!ti)return;
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
    if(!ctx.selected)throw new Error('Selecione uma peça'); const ti=pieceThicknessInfo(ctx.selected); if(!ti)throw new Error('Usinagem disponível para peças retangulares');
    const entry=$('machiningFace').value,da=entryAxisName(entry),through=$('machiningThrough').checked;
    const raw={x:machiningFieldNumber('machiningX'),y:machiningFieldNumber('machiningY'),z:machiningFieldNumber('machiningZ')};
    if(!Object.values(raw).every(Number.isFinite))throw new Error('Confira X, Y e Z');
    const op={id:machiningEditId||uid('mach'),type:machiningType,entryAxis:entry,coordRef:{...raw},x:0,y:0,z:0,through};
    if(machiningType==='hole'){
      op.diameter=Number($('machiningDiameter').value);op.depth=through?ti.thickness:Number($('machiningDepthHole').value);
      op.seriesEnabled=$('machiningSeries').checked;op.seriesCount=op.seriesEnabled?Math.round(Number($('machiningSeriesCount').value)||1):1;op.seriesStep=Number($('machiningSeriesStep').value)||32;op.seriesAxis=$('machiningSeriesAxis').value;op.seriesDirection=Number($('machiningSeriesDirection').value)<0?-1:1;
      if(!(op.diameter>0&&op.depth>0))throw new Error('Diâmetro e profundidade devem ser maiores que zero');if(op.depth>ti.thickness+.001)throw new Error(`Profundidade máxima: ${nice(ti.thickness)} mm`);
      if(op.seriesEnabled&&(!(op.seriesCount>=1)||op.seriesCount>999||!(op.seriesStep>0)||![ti.uAxis,ti.vAxis].includes(op.seriesAxis)))throw new Error('Confira quantidade, passo e eixo da série');
      Object.assign(op,resolvedMachiningCoords(ctx.selected,op));
      const r=op.diameter/2,pts=holeSeriesInstances(ctx.selected,op);for(const p of pts)for(const a of [ti.uAxis,ti.vAxis])if(p[a]<r-.001||p[a]>ti.dims[a]-r+.001)throw new Error(`Furo ${p.index} da série ultrapassa a peça no eixo ${axisLabel(a)}`);
    }else{
      const autoBack=$('machiningBackGroove').checked;op.lengthAxis=$('machiningLengthAxis').value;const fullLength=grooveLengthIsFull();op.fullLength=fullLength;op.length=fullLength?ti.dims[op.lengthAxis]:parseDecimalInput($('machiningLength').value);op.width=Number($('machiningWidth').value);op.depth=through?ti.thickness:Number($('machiningDepthGroove').value);
      if(fullLength)op.coordRef[op.lengthAxis]=0;
      if(autoBack){
        if(![ti.uAxis,ti.vAxis].includes('z'))throw new Error('Rasgo de fundo automático exige Z na face da peça');
        op.preset='back-groove';op.autoLength=true;op.rearOffset=Math.max(0,Number($('machiningRearOffset').value)||0);op.lengthAxis=[ti.uAxis,ti.vAxis].find(a=>a!=='z');op.length=ti.dims[op.lengthAxis];op.coordRef[op.lengthAxis]=0;op.coordRef.z=op.rearOffset;
      }else{op.preset=null;op.autoLength=!!fullLength;}
      if(![ti.uAxis,ti.vAxis].includes(op.lengthAxis))throw new Error('Direção do rasgo inválida');if(!(op.length>0&&op.width>0&&op.depth>0))throw new Error('Comprimento, largura e profundidade devem ser maiores que zero');if(op.depth>ti.thickness+.001)throw new Error(`Profundidade máxima: ${nice(ti.thickness)} mm`);
      Object.assign(op,resolvedMachiningCoords(ctx.selected,op));
      const wa=op.lengthAxis===ti.uAxis?ti.vAxis:ti.uAxis;
      if(op[op.lengthAxis]<-.001||op[op.lengthAxis]+op.length>ti.dims[op.lengthAxis]+.001)throw new Error(`Rasgo ultrapassa a peça no eixo ${axisLabel(op.lengthAxis)}. Com referência negativa, a distância é medida pela borda oposta do rasgo.`);
      if(op[wa]<-.001||op[wa]+op.width>ti.dims[wa]+.001)throw new Error(`Rasgo ultrapassa a peça no eixo ${axisLabel(wa)}. Com referência negativa, a distância é medida pela borda oposta do rasgo.`);
    }
    return op;
  }
  function updateMachiningUI(){
    if(!ctx.selected)return; const ti=pieceThicknessInfo(ctx.selected);if(!ti)return;setMachiningSurfaceCoordinate();
    const through=$('machiningThrough').checked;$('machiningDepthHole').disabled=through;$('machiningDepthGroove').disabled=through;
    let txt='';try{
      const op=machiningDraft(),face=$('machiningFace').selectedOptions[0]?.textContent||op.entryAxis,res=resolvedMachiningCoords(ctx.selected,op),real=machiningHasNegativeRef(op)?` → posição real X ${nice(res.x)} Y ${nice(res.y)} Z ${nice(res.z)}`:'';
      if(op.type==='hole'){const count=holeSeriesInstances(ctx.selected,op).length;txt=`${count>1?`Série ${count}× · passo ${nice(op.seriesStep)} mm · `:''}Furo Ø ${nice(op.diameter)} mm · profundidade ${nice(op.depth)} mm · ${face} · referência ${machiningCoordRefText(op)}${real}${count>1?` · eixo ${axisLabel(op.seriesAxis)}`:''}`;}
      else txt=`${op.preset==='back-groove'?'Rasgo de fundo automático · ':op.fullLength?'Rasgo X (tamanho da peça) · ':''}Rasgo ${nice(op.length)} × ${nice(op.width)} mm · profundidade ${nice(op.depth)} mm · comprimento em ${axisLabel(op.lengthAxis)} · ${face} · referência ${machiningCoordRefText(op)}${real}`;
    }catch(err){txt=err.message||'Confira a usinagem';}
    $('machiningPreview').textContent=txt;$('saveMachining').textContent=machiningEditId?'Salvar alteração':(machiningType==='hole'?'Adicionar furo':'Adicionar rasgo');
  }
  function renderMachiningList(){
    const list=$('machiningList');list.innerHTML='';if(!ctx.selected)return;
    const ops=Array.isArray(ctx.selected.userData?.machining)?ctx.selected.userData.machining:[];
    const renderedInstances=new Set();let rows=0;
  
    function appendHardwareRow(instanceId,name,sourceOnly=false){
      if(!instanceId||renderedInstances.has(instanceId))return;
      const st=ctx.hardwareInstanceSummary(instanceId);if(!st.operations)return;
      renderedInstances.add(instanceId);rows++;
      const item=document.createElement('div');item.className='machiningItem';
      const text=document.createElement('div');text.innerHTML='<div class="miName"></div><div class="miInfo"></div>';
      text.querySelector('.miName').textContent=`⚙ ${name||st.name||'Ferragem'}`;
      text.querySelector('.miInfo').textContent=`${st.operations} furação(ões) em ${st.pieces} peça(s) · ${sourceOnly?'aplicada a partir desta peça':'ferragem vinculada'} · toque em Excluir para remover a aplicação inteira`;
      const btns=document.createElement('div');btns.className='miBtns';
      const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>ctx.deleteHardwareInstance(instanceId,name||st.name);
      btns.append(del);item.append(text,btns);list.appendChild(item);
    }
  
    for(const op of ops){
      if(op?.hardwareInstanceId){appendHardwareRow(op.hardwareInstanceId,op.hardwareName,false);continue;}
      rows++;
      const item=document.createElement('div');item.className='machiningItem';const text=document.createElement('div'),depth=operationDepthMm(ctx.selected,op),res=resolvedMachiningCoords(ctx.selected,op),neg=machiningHasNegativeRef(op);
      text.innerHTML=`<div class="miName"></div><div class="miInfo"></div>`;
      text.querySelector('.miName').textContent=op.type==='hole'?(op.seriesEnabled&&op.seriesCount>1?`Série ${op.seriesCount}× · Ø ${nice(op.diameter)} mm`:`Furo Ø ${nice(op.diameter)} mm`):(op.preset==='back-groove'?`Rasgo de fundo · ${nice(op.length)} × ${nice(op.width)} mm`:op.preset==='drawer-bottom-groove'?`Rasgo fundo gaveta · ${nice(op.length)} × ${nice(op.width)} mm`:`Rasgo ${nice(op.length)} × ${nice(op.width)} mm`);
      text.querySelector('.miInfo').textContent=`${op.entryAxis.toUpperCase()} · ref. ${machiningCoordRefText(op)}${neg?` · real X ${nice(res.x)} Y ${nice(res.y)} Z ${nice(res.z)}`:''} · prof. ${nice(depth)} mm${op.seriesEnabled&&op.seriesCount>1?` · ${axisLabel(op.seriesAxis)} / ${nice(op.seriesStep)} mm`:''}${op.preset==='back-groove'?` · traseira ${nice(op.rearOffset)} mm`:''}${op.through?' · atravessa':''}`;
      const btns=document.createElement('div');btns.className='miBtns';const edit=document.createElement('button');edit.className='secondary';edit.textContent='Editar';edit.onclick=()=>loadMachiningForEdit(op.id);const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteMachining(op.id);btns.append(edit,del);item.append(text,btns);list.appendChild(item);
    }
  
    // Ferragens como pino de prateleira podem furar somente as laterais. Nesse
    // caso a prateleira é a origem da aplicação, mas não possui um furo próprio.
    // Mesmo assim a aplicação precisa aparecer no histórico da prateleira.
    for(const app of ctx.hardwareSourceApplications(ctx.selected))appendHardwareRow(app.instanceId,app.name,true);
  
    if(!rows){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma usinagem ou ferragem aplicada nesta peça.';list.appendChild(d);}
  }
  function openMachiningDialog(type='hole'){
    if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
    clearMachiningDraftPreview(); ctx.machiningPreviewActive=false; runtimeModel.machiningVisualGroup.visible=ctx.cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive; $('machining3DPreviewBar').style.display='none'; ctx.machiningPreviewOwner=null;
    if(!ctx.selected){toast('Selecione uma peça');return;} if(ctx.selected.userData?.kind==='cylinder'){toast('Furo/rasgo em cilindro ainda não está disponível');return;}
    $('morePanel').style.display='none'; machiningEditId=null; machiningType=type==='groove'?'groove':type==='hardware'?'hardware':'hole'; $('machiningTitle').textContent=`Usinagem · ${ctx.selected.userData.name||'Peça'}`;
    const ti=pieceThicknessInfo(ctx.selected); $('machiningPartInfo').textContent=`Peça ${nice(ti.faceW)} × ${nice(ti.faceH)} × ${nice(ti.thickness)} mm · espessura no eixo ${axisLabel(ti.thicknessAxis)}. X=esquerda→direita, Y=baixo→cima, Z=trás→frente. Valor negativo mede do lado oposto (ex.: Y −100 = 100 mm do topo). DXF sem giro: ${axisLabel(ti.uAxis)} horizontal × ${axisLabel(ti.vAxis)} vertical.`;
    populateMachiningFaceOptions(); setMachiningType(machiningType,machiningType!=='hardware'); if(machiningType!=='hardware')refreshMachiningPresetSelect(); else ctx.setHardwareScope(ctx.hardwareScope); renderMachiningList(); $('machiningDialog').style.display='flex';
  }
  function saveMachining(){
    clearMachiningDraftPreview(); ctx.machiningPreviewActive=false; runtimeModel.machiningVisualGroup.visible=ctx.cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive; $('machining3DPreviewBar').style.display='none'; ctx.machiningPreviewOwner=null;
    try{const op=machiningDraft(); const arr=ctx.selected.userData.machining||(ctx.selected.userData.machining=[]); const i=arr.findIndex(x=>x.id===op.id); if(i>=0)arr[i]=op; else arr.push(op); machiningEditId=null; sanitizeMachiningForPiece(ctx.selected); renderMachiningVisuals(); renderMachiningList(); updateInspector(); commitHistory(); setDefaultMachiningValues(); updateMachiningUI(); toast(op.type==='hole'?'Furo salvo':'Rasgo salvo');}catch(err){toast(err.message||'Usinagem inválida');}
  }
  function loadMachiningForEdit(id){
    const op=(ctx.selected?.userData?.machining||[]).find(x=>x.id===id); if(!op)return; machiningEditId=id; machiningType=op.type; setMachiningType(op.type,false); populateMachiningFaceOptions(op.entryAxis); populateMachiningLengthAxes(op.lengthAxis); $('machiningFace').value=op.entryAxis; $('machiningX').value=machiningRawCoord(op,'x'); $('machiningY').value=machiningRawCoord(op,'y'); $('machiningZ').value=machiningRawCoord(op,'z'); $('machiningThrough').checked=!!op.through;
    if(op.type==='hole'){$('machiningDiameter').value=op.diameter;$('machiningDepthHole').value=op.depth;$('machiningSeries').checked=!!op.seriesEnabled;$('machiningSeriesCount').value=op.seriesCount||1;$('machiningSeriesStep').value=op.seriesStep||32;populateMachiningSeriesAxes(op.seriesAxis);$('machiningSeriesAxis').value=op.seriesAxis||pieceThicknessInfo(ctx.selected).uAxis;$('machiningSeriesDirection').value=String(Number(op.seriesDirection)<0?-1:1);}else{$('machiningLengthAxis').value=op.lengthAxis;$('machiningLength').value=op.fullLength?'X':op.length;syncGrooveLengthButton();$('machiningWidth').value=op.width;$('machiningDepthGroove').value=op.depth;$('machiningBackGroove').checked=op.preset==='back-groove';$('machiningRearOffset').value=op.rearOffset??10;} updateHoleSeriesVisibility();updateBackGrooveVisibility();updateMachiningUI();
  }
  function deleteMachining(id){
    if(!ctx.selected)return;
    const arr=ctx.selected.userData.machining||[],op=arr.find(x=>x.id===id);if(!op)return;
    if(op.hardwareInstanceId){
      const instanceId=op.hardwareInstanceId,st=ctx.appliedHardwareStats(x=>x.hardwareInstanceId===instanceId);
      const name=op.hardwareName||'Ferragem';
      if(!window.confirm(`Excluir a ferragem aplicada “${name}” inteira?
  
  Serão removidas ${st.operations} furação(ões) de ${st.pieces} peça(s) vinculada(s) a esta aplicação.`))return;
      ctx.removeAppliedHardware(x=>x.hardwareInstanceId===instanceId);
      if(machiningEditId===id)machiningEditId=null;
      commitHistory();toast(`${name} removida por completo`);return;
    }
    const i=arr.findIndex(x=>x.id===id);if(i<0)return;if(!window.confirm('Excluir esta usinagem?'))return;
    arr.splice(i,1);if(machiningEditId===id)machiningEditId=null;ctx.refreshAfterHardwareRemoval();commitHistory();toast('Usinagem excluída');
  }
  
  
  
  
  // ---------- 1.200.42 · Forma estilo Haixun: esboço local + zoom + grade CAD ----------
  // O Mini CAD deixa de nascer como o retângulo inteiro da peça. O usuário cria apenas
  // um esboço local fechado e ele é aplicado como recorte interno real na peça. Presets
  // antigos de contorno completo continuam compatíveis.
  shapeCadState.zoom=1;
  shapeCadState.viewCx=0;
  shapeCadState.viewCy=0;
  shapeCadState.panPointer=null;
  shapeCadState.panStart=null;
  
  function shapeCadSketchBounds(pts=shapeCadState.points){
    if(!pts?.length)return {minX:0,minY:0,maxX:0,maxY:0,w:0,h:0};
    const xs=pts.map(p=>Number(p[0])||0),ys=pts.map(p=>Number(p[1])||0);
    const minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);
    return {minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
  }
  function shapeCadFitView(){
    const {W,H}=shapeCadOwnerInfo(),b=shapeCadSketchBounds();
    shapeCadState.zoom=1;
    if(b.w>.5&&b.h>.5){
      shapeCadState.viewCx=(b.minX+b.maxX)/2;shapeCadState.viewCy=(b.minY+b.maxY)/2;
      const sw=640,sh=390,pad=54,fit=Math.min((sw-pad*2)/Math.max(1,b.w),(sh-pad*2)/Math.max(1,b.h));
      const base=Math.min((sw-56)/Math.max(1,W),(sh-56)/Math.max(1,H));
      shapeCadState.zoom=Math.max(.45,Math.min(12,fit/Math.max(.00001,base)));
    }else{shapeCadState.viewCx=W/2;shapeCadState.viewCy=H/2;}
    shapeCadRender();shapeCadUpdateZoomLabel();
  }
  function shapeCadUpdateZoomLabel(){const el=$('shapeCadZoomValue');if(el)el.textContent=`${Math.round((shapeCadState.zoom||1)*100)}%`;}
  shapeCadMap=function(){
    const {W,H}=shapeCadOwnerInfo(),sw=640,sh=390,pad=28;
    const base=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H));
    const z=Math.max(.25,Math.min(16,Number(shapeCadState.zoom)||1)),s=base*z;
    if(!Number.isFinite(shapeCadState.viewCx))shapeCadState.viewCx=W/2;if(!Number.isFinite(shapeCadState.viewCy))shapeCadState.viewCy=H/2;
    const cx=shapeCadState.viewCx,cy=shapeCadState.viewCy;
    return {W,H,sw,sh,pad,s,cx,cy,sx:x=>sw/2+(x-cx)*s,sy:y=>sh/2-(y-cy)*s,ux:x=>cx+(x-sw/2)/s,uy:y=>cy-(y-sh/2)/s};
  };
  function shapeCadZoomBy(factor,screenPoint=null){
    const old=shapeCadMap(),sp=screenPoint||[old.sw/2,old.sh/2],world=[old.ux(sp[0]),old.uy(sp[1])];
    shapeCadState.zoom=Math.max(.25,Math.min(16,(shapeCadState.zoom||1)*factor));
    const next=shapeCadMap();shapeCadState.viewCx=world[0]-(sp[0]-next.sw/2)/next.s;shapeCadState.viewCy=world[1]+(sp[1]-next.sh/2)/next.s;
    shapeCadRender();shapeCadUpdateZoomLabel();
  }
  function shapeCadZoomWheel(e){
    if($('shapeType')?.value!=='custom-profile')return;e.preventDefault();
    const svg=$('shapeCadSvg'),r=svg.getBoundingClientRect(),sx=(e.clientX-r.left)*(640/Math.max(1,r.width)),sy=(e.clientY-r.top)*(390/Math.max(1,r.height));
    shapeCadZoomBy(e.deltaY<0?1.18:1/1.18,[sx,sy]);
  }
  shapeCadResetToPieceRect=function({record=true}={}){
    if(record)shapeCadPushUndo();const {W,H}=shapeCadOwnerInfo();
    shapeCadState.points=[];shapeCadState.closed=false;shapeCadState.draft=[];shapeCadState.hoverSnap=null;shapeCadState.guides=[];
    shapeCadState.zoom=1;shapeCadState.viewCx=W/2;shapeCadState.viewCy=H/2;shapeCadRender();shapeCadUpdateZoomLabel();updateShapePreview();
  };
  shapeCadInitForOwner=function({forceRect=false}={}){
    const {W,H}=shapeCadOwnerInfo(),changed=Math.abs(W-shapeCadState.baseW)>.01||Math.abs(H-shapeCadState.baseH)>.01;
    shapeCadState.baseW=W;shapeCadState.baseH=H;
    if(changed||!Number.isFinite(shapeCadState.viewCx)){shapeCadState.viewCx=W/2;shapeCadState.viewCy=H/2;shapeCadState.zoom=1;}
    if(forceRect){shapeCadState.points=[];shapeCadState.closed=false;shapeCadState.undo=[];shapeCadState.redo=[];shapeCadState.draft=[];}
    shapeCadRender();shapeCadUpdateZoomLabel();
  };
  shapeCadSetTool=function(tool){
    shapeCadState.tool=tool;shapeCadState.draft=[];shapeCadState.dragIndex=-1;shapeCadState.hoverSnap=null;shapeCadState.guides=[];
    document.querySelectorAll('[data-shape-cad-tool]').forEach(b=>b.classList.toggle('active',b.dataset.shapeCadTool===tool));
    const msgs={pan:'Arraste o fundo para mover a área de trabalho.',edit:'Arraste qualquer ponto. No celular a área de captura é maior e o ponto encaixa sozinho.',line:'Toque em sequência para desenhar apenas o esboço da forma.',rect:'Toque em dois cantos opostos do esboço.',circle:'Toque no centro e depois na borda do círculo.',arc:'Defina início, ponto intermediário e final do arco.',curve:'Defina início, controle e final da curva.',fillet:'Toque num vértice para aplicar o raio informado.',chamfer:'Toque num vértice para criar o chanfro informado.',trim:'Toque em um ponto para apará-lo/removê-lo.'};
    shapeCadSetStatus(msgs[tool]||'Mini CAD');shapeCadRender();
  };
  shapeCadLoadPreset=function(p){
    if(p?.type!=='custom-profile')return;const {W,H}=shapeCadOwnerInfo();
    if(Array.isArray(p.sketchPoints)&&p.sketchPoints.length>=3){
      const sw=Math.max(.001,Number(p.sketchW)||1),sh=Math.max(.001,Number(p.sketchH)||1),x0=Math.max(0,(W-sw)/2),y0=Math.max(0,(H-sh)/2);
      shapeCadState.points=p.sketchPoints.map(q=>shapeCadClampPoint([x0+(Number(q[0])||0),y0+(Number(q[1])||0)]));shapeCadState.closed=p.closed!==false;
    }else{
      const norm=p.profileNormalized||p.pointsNormalized||null;
      if(Array.isArray(norm)&&norm.length>=3)shapeCadState.points=norm.map(q=>[Number(q[0])*W,Number(q[1])*H]);else shapeCadState.points=[];
      shapeCadState.closed=Array.isArray(norm)&&norm.length>=3?p.closed!==false:false;
    }
    shapeCadState.undo=[];shapeCadState.redo=[];shapeCadState.draft=[];shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadState.loadedPresetId=p.id||null;shapeCadFitView();updateShapePreview();
  };
  newShapePreset=function(){
    shapePresetEditId=null;$('shapeFolder').value='Formas personalizadas';$('shapeName').value='Minha forma';$('shapeType').value='custom-profile';$('shapeRadius').value=150;$('saveShapePreset').textContent='💾 Salvar na biblioteca';shapeCadResetToPieceRect({record:false});shapeCadSyncUi();updateShapePreview();$('shapeName').focus();
  };
  saveShapePresetLibrary=function(){
    const name=String($('shapeName').value||'').trim(),folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',radius=Number($('shapeRadius').value),type=$('shapeType').value||'round-corner';
    if(!name){toast('Dê um nome para a forma');return;}if(type==='round-corner'&&!(radius>0)){toast('Confira o raio');return;}
    let extra={};
    if(type==='custom-profile'){
      let pts;try{pts=shapeCadProfilePoints();}catch(err){toast(err.message||'Confira o esboço do Mini CAD');return;}
      const b=shapeCadSketchBounds(pts);extra={sketchPoints:pts.map(p=>[roundMmNumber(p[0]-b.minX,3),roundMmNumber(p[1]-b.minY,3)]),sketchW:roundMmNumber(b.w,3),sketchH:roundMmNumber(b.h,3),closed:true,profileVersion:2,operation:'cutout'};
    }
    const arr=getUserShapePresets();
    if(shapePresetEditId){const i=arr.findIndex(x=>x.id===shapePresetEditId);if(i>=0)arr[i]={...arr[i],name,folder,radius,type,...extra};else shapePresetEditId=null;}
    if(!shapePresetEditId){const item={id:uid('shapePreset'),name,folder,radius,type,...extra};arr.push(item);shapePresetEditId=item.id;}
    setUserShapePresets(arr);refreshShapePresetSelect(shapePresetEditId);toast('Esboço salvo na biblioteca');
  };
  shapeDraftOperation=function(){
    const type=$('shapeType')?.value||'round-corner',name=String($('shapeName').value||'Forma').trim()||'Forma',folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',presetId=$('shapePresetSelect')?.value||null;
    const ti=pieceThicknessInfo(shapePreviewOwner||ctx.selected);if(!ti)throw new Error('Selecione uma peça retangular');
    if(type==='custom-profile'){
      const points=shapeCadProfilePoints(),b=shapeCadSketchBounds(points);
      return {id:uid('form'),type:'custom-profile',operation:'cutout',profileVersion:2,name,folder,presetId,points:points.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),sketchW:roundMmNumber(b.w,3),sketchH:roundMmNumber(b.h,3),baseW:ti.faceW,baseH:ti.faceH};
    }
    const radius=Number($('shapeRadius').value);if(!(radius>0))throw new Error('Confira o raio');if(!shapeSelectedCorners.size)throw new Error('Escolha pelo menos um canto');if(radius>Math.min(ti.faceW,ti.faceH)/2+.001)throw new Error(`Raio máximo nesta peça: ${nice(Math.min(ti.faceW,ti.faceH)/2)} mm`);
    return {id:uid('form'),type:'round-corner',name,radius,folder,presetId,corners:[...shapeSelectedCorners]};
  };
  formOutlinePointsMm=function(o,formsOverride=null,segments=48){
    const ti=pieceThicknessInfo(o);if(!ti)return [];const forms=(formsOverride??o.userData?.forms??[]);
    const custom=[...forms].reverse().find(f=>f?.type==='custom-profile'&&f?.operation!=='cutout'&&Array.isArray(f.points)&&f.points.length>=3);
    if(custom)return custom.points.map(p=>[Math.max(0,Math.min(ti.faceW,Number(p[0])||0)),Math.max(0,Math.min(ti.faceH,Number(p[1])||0))]);
    const W=ti.faceW,H=ti.faceH,r=formCornerRadii(o,forms);if(!r)return [];
    const pts=[];const add=(x,y)=>{const last=pts.at(-1);if(!last||Math.hypot(last[0]-x,last[1]-y)>.0001)pts.push([x,y]);};
    const arc=(cx,cy,rr,a0,a1)=>{if(rr<=.0001){add(cx,cy);return;}for(let i=0;i<=segments;i++){const a=a0+(a1-a0)*(i/segments);add(cx+rr*Math.cos(a),cy+rr*Math.sin(a));}};
    add(r.bl,0);add(W-r.br,0);if(r.br)arc(W-r.br,r.br,r.br,-Math.PI/2,0);else add(W,0);add(W,H-r.tr);if(r.tr)arc(W-r.tr,H-r.tr,r.tr,0,Math.PI/2);else add(W,H);add(r.tl,H);if(r.tl)arc(r.tl,H-r.tl,r.tl,Math.PI/2,Math.PI);else add(0,H);add(0,r.bl);if(r.bl)arc(r.bl,r.bl,r.bl,Math.PI,Math.PI*1.5);else add(0,0);return pts;
  };
  function formCutoutPointsMm(o,formsOverride=null){
    const ti=pieceThicknessInfo(o);if(!ti)return [];const forms=(formsOverride??o.userData?.forms??[]),out=[];
    for(const f of forms){if(f?.type!=='custom-profile'||f?.operation!=='cutout'||!Array.isArray(f.points)||f.points.length<3)continue;const pts=f.points.map(p=>[Math.max(0,Math.min(ti.faceW,Number(p[0])||0)),Math.max(0,Math.min(ti.faceH,Number(p[1])||0))]);if(Math.abs(shapeCadPolygonArea(pts))>.5)out.push(pts);}
    return out;
  }
  function makeFormVisualEdgesWithCutouts(o,outer,cutouts,ti){
    const group=makeFormVisualEdges(o,outer,ti),mat=group.material||new THREE.LineBasicMaterial({color:0x080808});const t=ti.thickness/2;
    for(const hole of cutouts)for(const side of [-t,t]){const arr=hole.map(([u,v])=>formLocalPoint(ti,u,v,side));if(arr.length)arr.push(arr[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),mat);line.userData.isVisualEdge=true;group.add(line);}return group;
  }
  rebuildFormGeometry=function(o){
    if(!o||o.userData?.kind==='cylinder'||o.userData?.kind==='curved-panel'||o.userData?.curvedRole)return;const ti=pieceThicknessInfo(o);if(!ti)return;disposeVisualEdgeTree(o);o.geometry?.dispose?.();
    const forms=Array.isArray(o.userData.forms)?o.userData.forms:[];
    if(!forms.length){o.geometry=new THREE.BoxGeometry(1,1,1);o.scale.set(o.userData.width,o.userData.height,o.userData.depth);delete o.userData.formProfile;const mat=makeCadEdgeMaterial({color:xray3DActive()?0x111111:0x2b2f30,transparent:true,opacity:xray3DActive()?.82:.68,depthTest:!xray3DActive(),depthWrite:false,linewidth:xray3DActive()?1.45:1.1,xray:xray3DActive()});const e=makeBoxVisualEdges(mat,{xray:xray3DActive()});o.add(e);o.userData.visualEdges=e;return;}
    const pts=formOutlinePointsMm(o,forms,48),cutouts=formCutoutPointsMm(o,forms);if(pts.length<4)return;
    const shape=new THREE.Shape();pts.forEach(([u,v],i)=>{const x=(u-ti.faceW/2)*MM_TO_M,y=(v-ti.faceH/2)*MM_TO_M;i?shape.lineTo(x,y):shape.moveTo(x,y);});shape.closePath();
    const outerSign=Math.sign(shapeCadPolygonArea(pts))||1;
    for(const src of cutouts){let holePts=src.slice();if((Math.sign(shapeCadPolygonArea(holePts))||1)===outerSign)holePts=holePts.slice().reverse();const path=new THREE.Path();holePts.forEach(([u,v],i)=>{const x=(u-ti.faceW/2)*MM_TO_M,y=(v-ti.faceH/2)*MM_TO_M;i?path.lineTo(x,y):path.moveTo(x,y);});path.closePath();shape.holes.push(path);}
    const geom=new THREE.ExtrudeGeometry(shape,{depth:ti.thickness*MM_TO_M,bevelEnabled:false,steps:1,curveSegments:64});geom.translate(0,0,-ti.thickness*MM_TO_M/2);formMapExtrudeGeometry(geom,ti);o.geometry=geom;o.scale.set(1,1,1);
    o.userData.formProfile={type:'forms',points:pts.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),cutouts:cutouts.map(h=>h.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)])),bboxW:ti.faceW,bboxH:ti.faceH,thicknessAxis:ti.thicknessAxis,uAxis:ti.uAxis,vAxis:ti.vAxis};
    const edges=makeFormVisualEdgesWithCutouts(o,pts,cutouts,ti);o.add(edges);o.userData.visualEdges=edges;
  };
  updateShapePreview=function(){
    const owner=shapePreviewOwner||ctx.selected,svg=$('shapePreviewSvg');if(!owner||!svg)return;const ti=pieceThicknessInfo(owner);if(!ti)return;
    let forms=cloneForms(owner.userData.forms||[]),op=null,msg='';try{op=shapeDraftOperation();forms.push(op);}catch(err){msg=err.message||'Confira a forma';}
    const outer=formOutlinePointsMm(owner,forms,24),holes=formCutoutPointsMm(owner,forms),W=ti.faceW,H=ti.faceH,pad=22,sw=420,sh=260,scale=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H)),ox=(sw-W*scale)/2,oy=(sh-H*scale)/2;
    const path=(pts)=>pts.map(([u,v],i)=>`${i?'L':'M'} ${(ox+u*scale).toFixed(2)} ${(sh-(oy+v*scale)).toFixed(2)}`).join(' ')+' Z';let d=path(outer);for(const h of holes)d+=' '+path(h);
    svg.innerHTML=`<path d="${d}" fill="#c8b591" fill-rule="evenodd" stroke="#080808" stroke-width="2.2"/><text x="${sw/2}" y="18" text-anchor="middle" fill="#53d6e8" font-size="12">${nice(W)} × ${nice(H)} mm</text>`;
    $('shapePreviewText').textContent=msg||(op?.type==='custom-profile'?`${op?.name||'Forma'} · esboço local · ${op?.points?.length||0} pontos · recorte real na peça.`:`${op?.name||'Forma'} · raio ${nice(op?.radius||0)} mm · ${op?.corners?.length||0} canto(s) selecionado(s).`);
  };
  renderAppliedShapes=function(){
    const list=$('shapeAppliedList');if(!list)return;list.innerHTML='';const owner=shapePreviewOwner||ctx.selected,forms=owner?.userData?.forms||[],labels=shapeCornerLabels(owner);
    if(!forms.length){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma Forma aplicada nesta peça.';list.appendChild(d);return;}
    for(const f of forms){const item=document.createElement('div');item.className='shapeAppliedItem';const text=document.createElement('div');text.innerHTML=`<strong></strong><span></span>`;text.querySelector('strong').textContent=f.name||'Forma';text.querySelector('span').textContent=f.type==='custom-profile'?(f.operation==='cutout'?`Esboço local · recorte interno · ${(f.points||[]).length} pontos`:`Mini CAD legado · ${(f.points||[]).length} pontos · contorno completo`):`R ${nice(f.radius)} mm · ${(f.corners||[]).map(c=>labels[c]||c).join(' + ')}`;const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteAppliedShape(f.id);item.append(text,del);list.appendChild(item);}
  };
  openShapeDialog=function(){
    if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});if(!ctx.selected){toast('Selecione uma peça');return;}if(ctx.selected.userData?.kind==='cylinder'||ctx.selected.userData?.kind==='curved-panel'||ctx.selected.userData?.curvedRole){toast('Forma disponível para peças retangulares');return;}
    shapePreviewOwner=ctx.selected;shapePreviewOriginalForms=null;shapePreviewActive=false;shapePresetEditId=null;shapeSelectedCorners=new Set(['bl']);$('morePanel').style.display='none';$('machiningDialog').style.display='none';
    const ti=pieceThicknessInfo(ctx.selected);$('shapePartInfo').textContent=`${ctx.selected.userData.name||'Peça'} · face ${nice(ti.faceW)} × ${nice(ti.faceH)} mm · espessura ${nice(ti.thickness)} mm. No Mini CAD você desenha somente o esboço local; a peça inteira fica apenas como referência.`;
    refreshShapePresetSelect('builtin-r150');refreshShapeCornerLabels();shapeCadInitForOwner({forceRect:true});shapeCadSyncUi();renderAppliedShapes();updateShapePreview();$('shapeDialog').style.display='flex';
  };
  shapeCadRender=function(){
    const svg=$('shapeCadSvg');if(!svg)return;const m=shapeCadMap(),grid=Math.max(.1,Number($('shapeCadGrid')?.value)||10),parts=[];parts.push('<rect width="640" height="390" fill="#0b1116"/>');
    // Grade quadriculada ocupa TODO o fundo visível, inclusive quando há zoom.
    const minX=m.ux(0),maxX=m.ux(m.sw),minY=m.uy(m.sh),maxY=m.uy(0),startX=Math.floor(minX/grid)*grid,startY=Math.floor(minY/grid)*grid;
    let count=0;for(let x=startX;x<=maxX+grid&&count<500;x+=grid,count++){const sx=m.sx(x),major=Math.abs(Math.round(x/grid))%5===0;parts.push(`<line x1="${sx.toFixed(2)}" y1="0" x2="${sx.toFixed(2)}" y2="390" stroke="${major?'#2e4451':'#1b2932'}" stroke-width="${major?1:.65}"/>`);}count=0;
    for(let y=startY;y<=maxY+grid&&count<500;y+=grid,count++){const sy=m.sy(y),major=Math.abs(Math.round(y/grid))%5===0;parts.push(`<line x1="0" y1="${sy.toFixed(2)}" x2="640" y2="${sy.toFixed(2)}" stroke="${major?'#2e4451':'#1b2932'}" stroke-width="${major?1:.65}"/>`);}
    if(m.sx(0)>=0&&m.sx(0)<=640)parts.push(`<line x1="${m.sx(0)}" y1="0" x2="${m.sx(0)}" y2="390" stroke="#4c6e7e" stroke-width="1.4"/>`);if(m.sy(0)>=0&&m.sy(0)<=390)parts.push(`<line x1="0" y1="${m.sy(0)}" x2="640" y2="${m.sy(0)}" stroke="#4c6e7e" stroke-width="1.4"/>`);
    // Limite da peça é só referência; ele não vira a forma automaticamente.
    parts.push(`<rect x="${m.sx(0)}" y="${m.sy(m.H)}" width="${m.W*m.s}" height="${m.H*m.s}" fill="rgba(200,181,145,.025)" stroke="#73838c" stroke-width="1.2" stroke-dasharray="8 6"/>`);
    for(const g of shapeCadState.guides||[])parts.push(shapeCadGuideSvg(g,m));
    const anchor=shapeCadActiveAnchor();if(anchor&&shapeCadState.current&&shapeCadState.tool!=='edit'&&shapeCadState.tool!=='pan'&&!shapeCadState.closed)parts.push(`<line x1="${m.sx(anchor[0]).toFixed(2)}" y1="${m.sy(anchor[1]).toFixed(2)}" x2="${m.sx(shapeCadState.current[0]).toFixed(2)}" y2="${m.sy(shapeCadState.current[1]).toFixed(2)}" stroke="#ffd36a" stroke-width="1.5" stroke-dasharray="5 4" opacity=".9"/>`);
    if(shapeCadState.points.length){const d=shapeCadState.points.map((p,i)=>`${i?'L':'M'} ${m.sx(p[0]).toFixed(2)} ${m.sy(p[1]).toFixed(2)}`).join(' ')+(shapeCadState.closed?' Z':'');parts.push(`<path d="${d}" fill="${shapeCadState.closed?'rgba(83,214,232,.13)':'none'}" stroke="#53d6e8" stroke-width="2.8" stroke-linejoin="round"/>`);shapeCadState.points.forEach((p,i)=>{const r=shapeCadTouchLike()?5.5:4.3;parts.push(`<circle cx="${m.sx(p[0]).toFixed(2)}" cy="${m.sy(p[1]).toFixed(2)}" r="${i===shapeCadState.dragIndex?r+2:r}" fill="${i===0?'#7fe594':'#f8f8f8'}" stroke="#071116" stroke-width="1.2"/>`);});}
    if(shapeCadState.draft.length)for(const p of shapeCadState.draft)parts.push(`<circle cx="${m.sx(p[0]).toFixed(2)}" cy="${m.sy(p[1]).toFixed(2)}" r="5" fill="#ffd36a"/>`);
    parts.push(shapeCadSnapMarkerSvg(shapeCadState.hoverSnap,m));parts.push(`<text x="8" y="18" fill="#8fa0aa" font-size="11">grade ${nice(grid)} mm · peça ${nice(m.W)} × ${nice(m.H)} mm</text>`);svg.innerHTML=parts.join('');
    const pts=shapeCadState.points,b=shapeCadSketchBounds(pts);if($('shapeCadMeasure'))$('shapeCadMeasure').textContent=pts.length?`${pts.length} pontos · ${shapeCadState.closed?'esboço fechado':'esboço aberto'} · ${nice(b.w)} × ${nice(b.h)} mm${shapeCadState.closed?` · área ${nice(Math.abs(shapeCadPolygonArea(pts)))} mm²`:''}`:'Esboço vazio';shapeCadUpdateZoomLabel();
  };
  shapeCadPointerDown=function(e){
    if($('shapeType')?.value!=='custom-profile')return;e.preventDefault();shapeCadState.lastPointerType=e.pointerType||shapeCadState.lastPointerType;
    if(shapeCadState.tool==='pan'){shapeCadState.panPointer=e.pointerId;shapeCadState.panStart={x:e.clientX,y:e.clientY,cx:shapeCadState.viewCx,cy:shapeCadState.viewCy,s:shapeCadMap().s};try{$('shapeCadSvg').setPointerCapture(e.pointerId);}catch{}return;}
    const raw=shapeCadEventRawPoint(e);if(shapeCadState.tool==='edit'){const i=shapeCadNearestIndex(raw,shapeCadSnapRadiusPx(e)+5);if(i>=0){shapeCadPushUndo();shapeCadState.dragIndex=i;shapeCadState.pointer=e.pointerId;shapeCadState.hoverSnap={point:shapeCadState.points[i],kind:'endpoint',label:'Mover ponto',index:i};shapeCadState.current=shapeCadState.points[i];try{$('shapeCadSvg').setPointerCapture(e.pointerId);}catch{}shapeCadRender();}else{shapeCadState.hoverSnap=null;shapeCadState.guides=[];shapeCadRender();}}else{const p=shapeCadPointerPoint(e);shapeCadState.current=p;const tag=shapeCadState.hoverSnap?.kind&&shapeCadState.hoverSnap.kind!=='grid'?` · ${shapeCadState.hoverSnap.label}`:'';if($('shapeCadCoords'))$('shapeCadCoords').textContent=`X ${nice(p[0])} · Y ${nice(p[1])} mm${tag}`;shapeCadApplyToolPoint(p);}
  };
  shapeCadPointerMove=function(e){
    if($('shapeType')?.value!=='custom-profile')return;if(shapeCadState.panPointer===e.pointerId&&shapeCadState.panStart){e.preventDefault();const st=shapeCadState.panStart;shapeCadState.viewCx=st.cx-(e.clientX-st.x)/st.s;shapeCadState.viewCy=st.cy+(e.clientY-st.y)/st.s;shapeCadRender();return;}
    const p=shapeCadPointerPoint(e,{endpoints:true,excludeIndex:shapeCadState.dragIndex});shapeCadState.current=p;const tag=shapeCadState.hoverSnap?.kind&&shapeCadState.hoverSnap.kind!=='grid'?` · ${shapeCadState.hoverSnap.label}`:'';if($('shapeCadCoords'))$('shapeCadCoords').textContent=`X ${nice(p[0])} · Y ${nice(p[1])} mm${tag}`;if(shapeCadState.dragIndex>=0&&shapeCadState.pointer===e.pointerId){e.preventDefault();shapeCadState.points[shapeCadState.dragIndex]=p;shapeCadRender();updateShapePreview();}else shapeCadRender();
  };
  shapeCadPointerUp=function(e){if(shapeCadState.panPointer===e.pointerId){shapeCadState.panPointer=null;shapeCadState.panStart=null;return;}if(shapeCadState.pointer===e.pointerId){shapeCadState.pointer=null;shapeCadState.dragIndex=-1;shapeCadRender();updateShapePreview();}};
  
  // ---------- 1.200.42b · Esboço de borda + cotas automáticas ----------
  // Um esboço ABERTO com as duas pontas na borda da peça substitui somente aquele
  // trecho do contorno. Assim é possível desenhar entalhes, degraus e recortes tipo Haixun
  // sem redesenhar a chapa inteira. Esboço FECHADO continua sendo recorte interno.
  const shapeCadInferenceBase=shapeCadInferenceCandidates;
  shapeCadInferenceCandidates=function(raw,opts={}){
    const c=shapeCadInferenceBase(raw,opts),m=shapeCadMap(),limit=shapeCadTouchLike(opts.event)?34:16;
    const add=(point,label)=>{const dist=shapeCadPxDistance(raw,point,m);if(dist<=limit)c.push({point:shapeCadClampPoint(point),kind:'piece-edge',label,priority:3,dist});};
    add([0,raw[1]],'Borda esquerda');add([m.W,raw[1]],'Borda direita');add([raw[0],0],'Borda inferior');add([raw[0],m.H],'Borda superior');
    return c;
  };
  function shapeCadBoundaryRef(p,W,H,tol=.08){
    const x=Number(p[0])||0,y=Number(p[1])||0,c=[];
    if(Math.abs(y)<=tol)c.push({edge:'bottom',t:Math.max(0,Math.min(W,x)),point:[Math.max(0,Math.min(W,x)),0]});
    if(Math.abs(x-W)<=tol)c.push({edge:'right',t:W+Math.max(0,Math.min(H,y)),point:[W,Math.max(0,Math.min(H,y))]});
    if(Math.abs(y-H)<=tol)c.push({edge:'top',t:W+H+(W-Math.max(0,Math.min(W,x))),point:[Math.max(0,Math.min(W,x)),H]});
    if(Math.abs(x)<=tol)c.push({edge:'left',t:2*W+H+(H-Math.max(0,Math.min(H,y))),point:[0,Math.max(0,Math.min(H,y))]});
    return c[0]||null;
  }
  function shapeCadBoundaryPointAtT(t,W,H){const P=2*(W+H);t=((t%P)+P)%P;if(t<=W)return [t,0];t-=W;if(t<=H)return [W,t];t-=H;if(t<=W)return [W-t,H];t-=W;return [0,H-t];}
  function shapeCadBoundaryPathCCW(fromT,toT,W,H){
    const P=2*(W+H),out=[shapeCadBoundaryPointAtT(fromT,W,H)];let a=fromT,b=toT;if(b<=a+1e-7)b+=P;
    const corners=[W,W+H,2*W+H,P,2*W+H+P,W+P,W+H+P,P+P].sort((x,y)=>x-y);
    for(const t of corners)if(t>a+1e-6&&t<b-1e-6)out.push(shapeCadBoundaryPointAtT(t,W,H));out.push(shapeCadBoundaryPointAtT(toT,W,H));return out;
  }
  function formEdgeProfileOutlineMm(o,src){
    const ti=pieceThicknessInfo(o);if(!ti||!Array.isArray(src)||src.length<2)return null;const W=ti.faceW,H=ti.faceH,clamp=p=>[Math.max(0,Math.min(W,Number(p[0])||0)),Math.max(0,Math.min(H,Number(p[1])||0))],pts=src.map(clamp),a=shapeCadBoundaryRef(pts[0],W,H),b=shapeCadBoundaryRef(pts.at(-1),W,H);if(!a||!b)return null;
    const P=2*(W+H),ccw=(b.t-a.t+P)%P,cw=P-ccw;let profile=pts.slice(),start=a,end=b;
    // Usa o menor trecho periférico como trecho substituído; se necessário, inverte o esboço.
    if(ccw>cw){profile=profile.slice().reverse();start=b;end=a;}
    const boundary=shapeCadBoundaryPathCCW(end.t,start.t,W,H),outer=profile.concat(boundary.slice(1,-1));
    if(Math.abs(shapeCadPolygonArea(outer))<1)return null;return shapeCadPolygonArea(outer)<0?outer.slice().reverse():outer;
  }
  shapeDraftOperation=function(){
    const type=$('shapeType')?.value||'round-corner',name=String($('shapeName').value||'Forma').trim()||'Forma',folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',presetId=$('shapePresetSelect')?.value||null;
    const ti=pieceThicknessInfo(shapePreviewOwner||ctx.selected);if(!ti)throw new Error('Selecione uma peça retangular');
    if(type==='custom-profile'){
      const pts=shapeCadState.points.map(shapeCadClampPoint);if(pts.length<2)throw new Error('Desenhe o esboço no Mini CAD');
      if(shapeCadState.closed){if(pts.length<3||Math.abs(shapeCadPolygonArea(pts))<.5)throw new Error('Feche um esboço com área válida');if(pts.some(q=>shapeCadBoundaryRef(q,ti.faceW,ti.faceH)))throw new Error('Para recorte na borda, deixe o esboço aberto e termine nas bordas da peça');const b=shapeCadSketchBounds(pts);return {id:uid('form'),type:'custom-profile',operation:'cutout',profileVersion:2,name,folder,presetId,points:pts.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),sketchW:roundMmNumber(b.w,3),sketchH:roundMmNumber(b.h,3),baseW:ti.faceW,baseH:ti.faceH};}
      const a=shapeCadBoundaryRef(pts[0],ti.faceW,ti.faceH),b=shapeCadBoundaryRef(pts.at(-1),ti.faceW,ti.faceH);if(!a||!b)throw new Error('Esboço aberto: comece e termine na borda tracejada da peça');
      const outline=formEdgeProfileOutlineMm(shapePreviewOwner||ctx.selected,pts);if(!outline)throw new Error('Não foi possível montar o recorte de borda');
      return {id:uid('form'),type:'custom-profile',operation:'edge-profile',profileVersion:2,name,folder,presetId,points:pts.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),baseW:ti.faceW,baseH:ti.faceH,startEdge:a.edge,endEdge:b.edge};
    }
    const radius=Number($('shapeRadius').value);if(!(radius>0))throw new Error('Confira o raio');if(!shapeSelectedCorners.size)throw new Error('Escolha pelo menos um canto');if(radius>Math.min(ti.faceW,ti.faceH)/2+.001)throw new Error(`Raio máximo nesta peça: ${nice(Math.min(ti.faceW,ti.faceH)/2)} mm`);return {id:uid('form'),type:'round-corner',name,radius,folder,presetId,corners:[...shapeSelectedCorners]};
  };
  const formOutlineBeforeEdgeProfile=formOutlinePointsMm;
  formOutlinePointsMm=function(o,formsOverride=null,segments=48){
    const forms=(formsOverride??o.userData?.forms??[]),edge=[...forms].reverse().find(f=>f?.type==='custom-profile'&&f?.operation==='edge-profile'&&Array.isArray(f.points)&&f.points.length>=2);if(edge){const out=formEdgeProfileOutlineMm(o,edge.points);if(out?.length>=3)return out;}return formOutlineBeforeEdgeProfile(o,formsOverride,segments);
  };
  saveShapePresetLibrary=function(){
    const name=String($('shapeName').value||'').trim(),folder=String($('shapeFolder').value||'Cantos').trim()||'Cantos',radius=Number($('shapeRadius').value),type=$('shapeType').value||'round-corner';if(!name){toast('Dê um nome para a forma');return;}if(type==='round-corner'&&!(radius>0)){toast('Confira o raio');return;}let extra={};
    if(type==='custom-profile'){
      const pts=shapeCadState.points.map(shapeCadClampPoint);if(shapeCadState.closed){if(pts.length<3||Math.abs(shapeCadPolygonArea(pts))<.5){toast('Feche um esboço válido');return;}const {W,H}=shapeCadOwnerInfo();if(pts.some(q=>shapeCadBoundaryRef(q,W,H))){toast('Para forma na borda, deixe o esboço aberto');return;}const b=shapeCadSketchBounds(pts);extra={sketchPoints:pts.map(p=>[roundMmNumber(p[0]-b.minX,3),roundMmNumber(p[1]-b.minY,3)]),sketchW:roundMmNumber(b.w,3),sketchH:roundMmNumber(b.h,3),closed:true,profileVersion:2,operation:'cutout'};}
      else{const {W,H}=shapeCadOwnerInfo();if(pts.length<2||!shapeCadBoundaryRef(pts[0],W,H)||!shapeCadBoundaryRef(pts.at(-1),W,H)){toast('Esboço aberto precisa começar e terminar na borda da peça');return;}extra={profileNormalized:shapeCadNormalizePoints(pts,W,H),closed:false,profileVersion:2,operation:'edge-profile'};}
    }
    const arr=getUserShapePresets();if(shapePresetEditId){const i=arr.findIndex(x=>x.id===shapePresetEditId);if(i>=0)arr[i]={...arr[i],name,folder,radius,type,...extra};else shapePresetEditId=null;}if(!shapePresetEditId){const item={id:uid('shapePreset'),name,folder,radius,type,...extra};arr.push(item);shapePresetEditId=item.id;}setUserShapePresets(arr);refreshShapePresetSelect(shapePresetEditId);toast('Esboço salvo na biblioteca');
  };
  renderAppliedShapes=function(){
    const list=$('shapeAppliedList');if(!list)return;list.innerHTML='';const owner=shapePreviewOwner||ctx.selected,forms=owner?.userData?.forms||[],labels=shapeCornerLabels(owner);if(!forms.length){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma Forma aplicada nesta peça.';list.appendChild(d);return;}
    for(const f of forms){const item=document.createElement('div');item.className='shapeAppliedItem';const text=document.createElement('div');text.innerHTML=`<strong></strong><span></span>`;text.querySelector('strong').textContent=f.name||'Forma';text.querySelector('span').textContent=f.type==='custom-profile'?(f.operation==='cutout'?`Esboço fechado · recorte interno · ${(f.points||[]).length} pontos`:f.operation==='edge-profile'?`Esboço aberto · recorte de borda · ${(f.points||[]).length} pontos`:`Mini CAD legado · ${(f.points||[]).length} pontos · contorno completo`):`R ${nice(f.radius)} mm · ${(f.corners||[]).map(c=>labels[c]||c).join(' + ')}`;const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteAppliedShape(f.id);item.append(text,del);list.appendChild(item);}
  };
  const shapeCadRenderBase=shapeCadRender;
  shapeCadRender=function(){
    shapeCadRenderBase();const svg=$('shapeCadSvg');if(!svg||$('shapeCadShowDims')?.checked===false||shapeCadState.points.length<2)return;const m=shapeCadMap(),segs=shapeCadSegments(),labels=[];let shown=0;
    for(const seg of segs){if(shown>=24)break;const len=Math.hypot(seg.b[0]-seg.a[0],seg.b[1]-seg.a[1]),px=len*m.s;if(len<.5||px<42)continue;const x=(m.sx(seg.a[0])+m.sx(seg.b[0]))/2,y=(m.sy(seg.a[1])+m.sy(seg.b[1]))/2;labels.push(`<g pointer-events="none"><rect x="${(x-21).toFixed(1)}" y="${(y-8).toFixed(1)}" width="42" height="16" rx="4" fill="rgba(5,10,13,.88)" stroke="rgba(127,229,148,.38)"/><text x="${x.toFixed(1)}" y="${(y+3.4).toFixed(1)}" text-anchor="middle" fill="#c9f7d2" font-size="9" font-weight="800">${nice(len)}</text></g>`);shown++;}
    if(labels.length)svg.insertAdjacentHTML('beforeend',labels.join(''));
  };
  
  // ============================================================================
  // 1.200.42 · FORMA ESTILO HAIXUN
  // Formatos paramétricos + editor de cantos + esboço livre + biblioteca global.
  // ============================================================================
  const BUILTIN_FORMAT_SHAPES_V37=[
    {id:'builtin-format-rect',locked:true,folder:'Formatos rápidos',name:'Retangular',type:'piece-format',formatConfig:{format:'rectangle'}},
    {id:'builtin-format-ellipse',locked:true,folder:'Formatos rápidos',name:'Elipse',type:'piece-format',formatConfig:{format:'ellipse'}},
    {id:'builtin-format-circle',locked:true,folder:'Formatos rápidos',name:'Circular',type:'piece-format',formatConfig:{format:'circle'}},
    {id:'builtin-format-l',locked:true,folder:'Formatos rápidos',name:'Tampo em L',type:'piece-format',formatConfig:{format:'l-top',cutW:200,cutH:125,lCorner:'tr'}},
    {id:'builtin-format-cut',locked:true,folder:'Formatos rápidos',name:'Cantos cortados',type:'piece-format',formatConfig:{format:'cut-corners',cutX:60,cutY:60,corners:['tl','tr']}},
    {id:'builtin-format-round',locked:true,folder:'Formatos rápidos',name:'Cantos arredondados',type:'piece-format',formatConfig:{format:'rounded-rect',radius:50}},
    {id:'builtin-format-chamfer',locked:true,folder:'Formatos rápidos',name:'Tampo chanfrado',type:'piece-format',formatConfig:{format:'chamfered',cutX:60,cutY:60}}
  ];
  let shapeUiMode='format';
  let shapeLibraryScope='local';
  let shapeCornerSelectedIndex=0;
  let shapeCornerStyle='round';
  let shapePreviewOriginalDims=null;
  let shapeLoadedFormatCornerEdits={};
  const globalShapeState={loaded:false,loading:false,error:'',items:[]};
  
  function shapeDeepClone(v){return JSON.parse(JSON.stringify(v));}
  function shapeCurrentLocalPresets(){return [...BUILTIN_FORMAT_SHAPES_V37,...BUILTIN_SHAPES,...getUserShapePresets()];}
  function shapeCurrentPresets(){return shapeLibraryScope==='global'?globalShapeState.items:shapeCurrentLocalPresets();}
  allShapePresets=function(){return shapeCurrentLocalPresets();};
  findShapePreset=function(id){return shapeCurrentPresets().find(x=>x.id===id)||null;};
  
  async function loadGlobalShapePresets(force=false){
    if(globalShapeState.loading||(!force&&globalShapeState.loaded))return;
    globalShapeState.loading=true;globalShapeState.error='';
    try{const data=await cloudApiFetch('/shapes/global',{timeoutMs:20000});globalShapeState.items=Array.isArray(data?.items)?data.items:[];globalShapeState.loaded=true;}
    catch(err){globalShapeState.error=err?.message||'Não foi possível carregar as Formas globais.';}
    finally{globalShapeState.loading=false;if(shapeLibraryScope==='global')refreshShapePresetSelect();}
  }
  function shapeSyncScopeUi(){
    $('shapeLocalTab')?.classList.toggle('active',shapeLibraryScope==='local');$('shapeLocalTab')?.classList.toggle('secondary',shapeLibraryScope!=='local');
    $('shapeGlobalTab')?.classList.toggle('active',shapeLibraryScope==='global');$('shapeGlobalTab')?.classList.toggle('secondary',shapeLibraryScope!=='global');
    const admin=adminAllowed();
    if($('shapeGlobalHint'))$('shapeGlobalHint').textContent=shapeLibraryScope==='global'?(globalShapeState.loading?'Carregando formas globais…':globalShapeState.error||'Compartilhadas com todas as contas'):'Minhas formas e padrões';
    if($('publishShapePreset'))$('publishShapePreset').style.display=shapeLibraryScope==='local'&&admin?'block':'none';
    for(const id of ['newShapePreset','editShapePreset','saveShapePreset','deleteShapePreset']){const b=$(id);if(!b)continue;b.disabled=shapeLibraryScope==='global'&&!admin;}
  }
  function setShapeLibraryScope(scope){
    shapeLibraryScope=scope==='global'?'global':'local';shapePresetEditId=null;shapeSyncScopeUi();
    if(shapeLibraryScope==='global'&&!globalShapeState.loaded&&!globalShapeState.loading)loadGlobalShapePresets();
    else refreshShapePresetSelect();
  }
  
  function shapeFormatDefaultDims(){const ti=pieceThicknessInfo(shapePreviewOwner||ctx.selected);return {W:ti?.faceW||800,H:ti?.faceH||500};}
  function shapeFormatSelectedCorners(){return [...document.querySelectorAll('[data-shape-format-corner]:checked')].map(x=>x.dataset.shapeFormatCorner);}
  function shapeFormatConfigFromUi(){
    const d=shapeFormatDefaultDims(),format=$('shapeFormatType')?.value||'rectangle';
    let W=Math.max(1,Number($('shapeFormatWidth')?.value)||d.W),H=Math.max(1,Number($('shapeFormatHeight')?.value)||d.H);
    if(format==='circle'){const dia=Math.max(1,Number($('shapeFormatDiameter')?.value)||Math.min(W,H));W=dia;H=dia;}
    return {format,width:W,height:H,cutW:Math.max(.1,Number($('shapeFormatCutW')?.value)||Math.min(200,W/3)),cutH:Math.max(.1,Number($('shapeFormatCutH')?.value)||Math.min(125,H/3)),lCorner:$('shapeFormatLCorner')?.value||'tr',cutX:Math.max(.1,Number($('shapeFormatCutX')?.value)||60),cutY:Math.max(.1,Number($('shapeFormatCutY')?.value)||60),corners:shapeFormatSelectedCorners(),radius:Math.max(.1,Number($('shapeFormatRadius')?.value)||50)};
  }
  function shapeFormatPopulate(cfg={}){
    const d=shapeFormatDefaultDims(),f=cfg.format||'rectangle';if($('shapeFormatType'))$('shapeFormatType').value=f;
    if($('shapeFormatWidth'))$('shapeFormatWidth').value=nice(Number(cfg.width)||d.W);if($('shapeFormatHeight'))$('shapeFormatHeight').value=nice(Number(cfg.height)||d.H);
    if($('shapeFormatDiameter'))$('shapeFormatDiameter').value=nice(Number(cfg.width)||Math.min(d.W,d.H));
    if($('shapeFormatCutW'))$('shapeFormatCutW').value=nice(Number(cfg.cutW)||Math.min(200,d.W/3));if($('shapeFormatCutH'))$('shapeFormatCutH').value=nice(Number(cfg.cutH)||Math.min(125,d.H/3));if($('shapeFormatLCorner'))$('shapeFormatLCorner').value=cfg.lCorner||'tr';
    if($('shapeFormatCutX'))$('shapeFormatCutX').value=nice(Number(cfg.cutX)||60);if($('shapeFormatCutY'))$('shapeFormatCutY').value=nice(Number(cfg.cutY)||60);if($('shapeFormatRadius'))$('shapeFormatRadius').value=nice(Number(cfg.radius)||50);
    const cs=new Set(Array.isArray(cfg.corners)?cfg.corners:['tl','tr']);document.querySelectorAll('[data-shape-format-corner]').forEach(x=>x.checked=cs.has(x.dataset.shapeFormatCorner));shapeFormatUpdateFields();
  }
  function shapeFormatTypeChanged(){shapeLoadedFormatCornerEdits={};shapeFormatUpdateFields();}
  function shapeFormatUpdateFields(){
    const f=$('shapeFormatType')?.value||'rectangle';if($('shapeFormatLFields'))$('shapeFormatLFields').style.display=f==='l-top'?'grid':'none';if($('shapeFormatCutFields'))$('shapeFormatCutFields').style.display=['cut-corners','chamfered'].includes(f)?'grid':'none';if($('shapeFormatRadiusFields'))$('shapeFormatRadiusFields').style.display=f==='rounded-rect'?'grid':'none';if($('shapeFormatDiameterLabel'))$('shapeFormatDiameterLabel').style.display=f==='circle'?'grid':'none';if($('shapeFormatWidthLabel'))$('shapeFormatWidthLabel').style.display=f==='circle'?'none':'grid';if($('shapeFormatHeightLabel'))$('shapeFormatHeightLabel').style.display=f==='circle'?'none':'grid';updateShapePreview();
  }
  function shapeCutRectangle(W,H,corners,dx,dy){
    const c=new Set(corners||[]),x=Math.min(Math.max(.01,dx),W*.49),y=Math.min(Math.max(.01,dy),H*.49),p=[];
    c.has('bl')?p.push([x,0],[0,y]):p.push([0,0]);
    c.has('br')?p.push([W-x,0],[W,y]):p.push([W,0]);
    c.has('tr')?p.push([W,H-y],[W-x,H]):p.push([W,H]);
    c.has('tl')?p.push([x,H],[0,H-y]):p.push([0,H]);return p;
  }
  function shapeFormatBasePolygon(cfg,W,H,segments=56){
    cfg=cfg||{format:'rectangle'};const f=cfg.format||'rectangle';
    if(f==='ellipse'||f==='circle'){const out=[],cx=W/2,cy=H/2,rx=W/2,ry=H/2,n=Math.max(24,segments);for(let i=0;i<n;i++){const a=Math.PI*2*i/n;out.push([cx+rx*Math.cos(a),cy+ry*Math.sin(a)]);}return out;}
    if(f==='l-top'){
      const cw=Math.min(Math.max(.1,Number(cfg.cutW)||W/3),W-.1),ch=Math.min(Math.max(.1,Number(cfg.cutH)||H/3),H-.1),c=cfg.lCorner||'tr';
      if(c==='tr')return [[0,0],[W,0],[W,H-ch],[W-cw,H-ch],[W-cw,H],[0,H]];
      if(c==='tl')return [[0,0],[W,0],[W,H],[cw,H],[cw,H-ch],[0,H-ch]];
      if(c==='br')return [[0,0],[W-cw,0],[W-cw,ch],[W,ch],[W,H],[0,H]];
      return [[cw,0],[W,0],[W,H],[0,H],[0,ch],[cw,ch]];
    }
    if(f==='cut-corners')return shapeCutRectangle(W,H,cfg.corners||['tl','tr'],Number(cfg.cutX)||60,Number(cfg.cutY)||60);
    if(f==='chamfered')return shapeCutRectangle(W,H,['bl','br','tr','tl'],Number(cfg.cutX)||60,Number(cfg.cutY)||60);
    return [[0,0],[W,0],[W,H],[0,H]];
  }
  function shapeApplyCornerEdits(poly,edits={},samples=9){
    if(!Array.isArray(poly)||poly.length<3)return poly||[];const out=[];
    const add=p=>{const q=[Number(p[0])||0,Number(p[1])||0],last=out.at(-1);if(!last||Math.hypot(last[0]-q[0],last[1]-q[1])>.001)out.push(q);};
    for(let i=0;i<poly.length;i++){
      const B=poly[i],A=poly[(i-1+poly.length)%poly.length],C=poly[(i+1)%poly.length],e=edits?.[String(i)];if(!e||e.style==='straight'){add(B);continue;}
      const d1=Math.hypot(A[0]-B[0],A[1]-B[1]),d2=Math.hypot(C[0]-B[0],C[1]-B[1]);if(d1<.01||d2<.01){add(B);continue;}
      const val=Math.max(.01,Number(e.value)||0),d=Math.min(val,d1*.45,d2*.45),u1=[(A[0]-B[0])/d1,(A[1]-B[1])/d1],u2=[(C[0]-B[0])/d2,(C[1]-B[1])/d2],P1=[B[0]+u1[0]*d,B[1]+u1[1]*d],P2=[B[0]+u2[0]*d,B[1]+u2[1]*d];
      if(e.style==='chamfer'){add(P1);add(P2);continue;}
      add(P1);for(let k=1;k<samples;k++){const t=k/samples,s=1-t;add([s*s*P1[0]+2*s*t*B[0]+t*t*P2[0],s*s*P1[1]+2*s*t*B[1]+t*t*P2[1]]);}add(P2);
    }return out;
  }
  function shapePieceFormatForm(o,formsOverride=null){const forms=formsOverride??o?.userData?.forms??[];return [...forms].reverse().find(f=>f?.type==='piece-format')||null;}
  function shapePieceFormatRawPolygon(o,formsOverride=null){const ti=pieceThicknessInfo(o);if(!ti)return [];const f=shapePieceFormatForm(o,formsOverride);if(!f)return [[0,0],[ti.faceW,0],[ti.faceW,ti.faceH],[0,ti.faceH]];return shapeFormatBasePolygon(f.config||{format:'rectangle'},ti.faceW,ti.faceH,64);}
  function shapePieceFormatOutline(o,formsOverride=null){const base=shapePieceFormatRawPolygon(o,formsOverride),f=shapePieceFormatForm(o,formsOverride);return shapeApplyCornerEdits(base,f?.cornerEdits||{},9);}
  function shapePolylinePerimeter(pts){if(!Array.isArray(pts)||pts.length<2)return 0;let n=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];n+=Math.hypot(b[0]-a[0],b[1]-a[1]);}return n;}
  
  const formOutlineV36=formOutlinePointsMm;
  formOutlinePointsMm=function(o,formsOverride=null,segments=48){
    const forms=formsOverride??o.userData?.forms??[];
    const edge=[...forms].reverse().find(f=>f?.type==='custom-profile'&&f?.operation==='edge-profile');if(edge)return formOutlineV36(o,formsOverride,segments);
    const legacy=[...forms].reverse().find(f=>f?.type==='custom-profile'&&!f.operation&&Array.isArray(f.points)&&f.points.length>=3);if(legacy)return formOutlineV36(o,formsOverride,segments);
    if(shapePieceFormatForm(o,forms))return shapePieceFormatOutline(o,forms);
    return formOutlineV36(o,formsOverride,segments);
  };
  const rebuildFormV36=rebuildFormGeometry;
  rebuildFormGeometry=function(o){rebuildFormV36(o);if(o?.userData?.formProfile){const outer=o.userData.formProfile.points||[],holes=o.userData.formProfile.cutouts||[];const perimeter=shapePolylinePerimeter(outer)+holes.reduce((n,h)=>n+shapePolylinePerimeter(h),0);o.userData.formProfile.perimeterMm=roundMmNumber(perimeter,2);o.userData.formPerimeterMm=roundMmNumber(perimeter,2);}};
  
  function shapeResizeFace(o,Wmm,Hmm){
    const ti=pieceThicknessInfo(o);if(!ti)return;const dims={x:o.userData.width,y:o.userData.height,z:o.userData.depth};dims[ti.uAxis]=Wmm*MM_TO_M;dims[ti.vAxis]=Hmm*MM_TO_M;setDimensions(o,dims.x,dims.z,dims.y,true);
  }
  function shapeFormatRecordFromConfig(cfg,name=null,folder=null,cornerEdits=null){
    const e=shapeDeepClone(cornerEdits||{});if(cfg.format==='rounded-rect'&&!Object.keys(e).length){for(let i=0;i<4;i++)e[String(i)]={style:'round',value:cfg.radius||50};}
    return {id:uid('form'),type:'piece-format',name:name||({rectangle:'Retangular',ellipse:'Elipse',circle:'Circular','l-top':'Tampo em L','cut-corners':'Cantos cortados','rounded-rect':'Cantos arredondados',chamfered:'Tampo chanfrado'}[cfg.format]||'Formato'),folder:folder||'Formatos',config:shapeDeepClone(cfg),cornerEdits:e};
  }
  function shapeApplyFormatConfig(owner,cfg,{commit=false,name=null,folder=null,cornerEdits=null}={}){
    if(!owner)return;shapeResizeFace(owner,cfg.width,cfg.height);owner.userData.forms=[shapeFormatRecordFromConfig(cfg,name,folder,cornerEdits)];rebuildFormGeometry(owner);renderMachiningVisuals();updateInspector?.();if(commit)commitHistory();
  }
  function applyParametricFormatToPiece(){
    const owner=shapePreviewOwner||ctx.selected;if(!owner)return;try{restoreShapePreview();shapePreviewOwner=owner;const cfg=shapeFormatConfigFromUi();if(cfg.format==='l-top'&&(cfg.cutW>=cfg.width||cfg.cutH>=cfg.height))throw new Error('O recorte do L precisa ser menor que a peça');shapeApplyFormatConfig(owner,cfg,{commit:true,name:$('shapeName')?.value||null,folder:$('shapeFolder')?.value||null,cornerEdits:shapeLoadedFormatCornerEdits});renderAppliedShapes();shapeCornerSelectedIndex=0;shapeCornerRender();updateShapePreview();toast('Formato aplicado à peça');}catch(err){toast(err.message||'Não foi possível aplicar o formato');}
  }
  
  function shapeEnsurePieceFormat(owner){let f=shapePieceFormatForm(owner);if(f)return f;f=shapeFormatRecordFromConfig({format:'rectangle',width:pieceThicknessInfo(owner).faceW,height:pieceThicknessInfo(owner).faceH},'Retangular','Formatos');owner.userData.forms=[...(owner.userData.forms||[]).filter(x=>x?.type==='custom-profile'&&x?.operation==='cutout'),f];return f;}
  function shapeCornerBaseInfo(ensure=false){const owner=shapePreviewOwner||ctx.selected;if(!owner)return null;let f=shapePieceFormatForm(owner);if(!f){const ti=pieceThicknessInfo(owner);f=shapeFormatRecordFromConfig({format:'rectangle',width:ti.faceW,height:ti.faceH},'Retangular','Formatos');if(ensure)owner.userData.forms=[...(owner.userData.forms||[]).filter(x=>x?.type==='custom-profile'&&x?.operation==='cutout'),f];}const ti=pieceThicknessInfo(owner),base=shapeFormatBasePolygon(f.config||{format:'rectangle'},ti.faceW,ti.faceH,64);if(['ellipse','circle'].includes(f.config?.format))return {owner,f,base,disabled:true,temporary:!shapePieceFormatForm(owner)};return {owner,f,base,disabled:false,temporary:!shapePieceFormatForm(owner)};}
  function shapeCornerRender(){
    const svg=$('shapeCornerEditSvg');if(!svg)return;const info=shapeCornerBaseInfo();if(!info)return;const {owner,f,base}=info,ti=pieceThicknessInfo(owner),W=ti.faceW,H=ti.faceH,sw=640,sh=340,pad=34,s=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H)),ox=(sw-W*s)/2,oy=(sh-H*s)/2,sx=x=>ox+x*s,sy=y=>sh-(oy+y*s),outer=shapeApplyCornerEdits(base,f.cornerEdits||{},9),parts=['<rect width="640" height="340" fill="#fbfcfa"/>'];
    const grid=50,px=grid*s;if(px>=10){for(let x=0;x<=W+.1;x+=grid)parts.push(`<line x1="${sx(x)}" y1="${sy(0)}" x2="${sx(x)}" y2="${sy(H)}" stroke="#e7eaeb" stroke-width="1"/>`);for(let y=0;y<=H+.1;y+=grid)parts.push(`<line x1="${sx(0)}" y1="${sy(y)}" x2="${sx(W)}" y2="${sy(y)}" stroke="#e7eaeb" stroke-width="1"/>`);}
    const d=outer.map((p,i)=>`${i?'L':'M'} ${sx(p[0]).toFixed(2)} ${sy(p[1]).toFixed(2)}`).join(' ')+' Z';parts.push(`<path d="${d}" fill="#e7e5df" stroke="#4c5559" stroke-width="2"/>`);
    if(info.disabled){parts.push('<text x="320" y="170" text-anchor="middle" fill="#586268" font-size="14">Este formato não possui cantos retos para editar.</text>');shapeCornerSelectedIndex=0;}else{shapeCornerSelectedIndex=Math.max(0,Math.min(base.length-1,shapeCornerSelectedIndex));base.forEach((p,i)=>{const active=i===shapeCornerSelectedIndex;parts.push(`<circle data-shape-corner-index="${i}" cx="${sx(p[0]).toFixed(2)}" cy="${sy(p[1]).toFixed(2)}" r="${active?9:7}" fill="${active?'#d85862':'#36a684'}" stroke="#fff" stroke-width="2" style="cursor:pointer"/>`);});}
    svg.innerHTML=parts.join('');if($('shapeCornerSelectedText'))$('shapeCornerSelectedText').textContent=info.disabled?'Elipse/círculo: use o formato diretamente.':`Canto selecionado: ${shapeCornerSelectedIndex+1} de ${base.length} · ${f.cornerEdits?.[String(shapeCornerSelectedIndex)]?.style==='chamfer'?'Chanfro':f.cornerEdits?.[String(shapeCornerSelectedIndex)]?.style==='round'?'Arco':'Reto'}`;
  }
  function shapeCornerSelectFromEvent(e){const t=e.target?.closest?.('[data-shape-corner-index]');if(!t)return;shapeCornerSelectedIndex=Number(t.dataset.shapeCornerIndex)||0;shapeCornerRender();}
  function shapeSetCornerStyle(style){shapeCornerStyle=['round','chamfer','straight'].includes(style)?style:'round';document.querySelectorAll('[data-shape-corner-style]').forEach(b=>{b.classList.toggle('active',b.dataset.shapeCornerStyle===shapeCornerStyle);b.classList.toggle('secondary',b.dataset.shapeCornerStyle!==shapeCornerStyle);});}
  function shapeApplyCornerEdit(all=false){
    const info=shapeCornerBaseInfo(true);if(!info||info.disabled){toast('Este formato não possui cantos editáveis');return;}const val=Math.max(.1,Number($('shapeCornerEditValue')?.value)||30),idx=all?info.base.map((_,i)=>i):[shapeCornerSelectedIndex];info.f.cornerEdits=info.f.cornerEdits||{};for(const i of idx){if(shapeCornerStyle==='straight')delete info.f.cornerEdits[String(i)];else info.f.cornerEdits[String(i)]={style:shapeCornerStyle,value:val};}rebuildFormGeometry(info.owner);renderMachiningVisuals();commitHistory();shapeCornerRender();renderAppliedShapes();updateShapePreview();toast(all?'Cantos atualizados':'Canto atualizado');
  }
  function shapeResetCorners(){const info=shapeCornerBaseInfo(false);if(!info||info.disabled||info.temporary){toast('A peça já está com cantos retos');return;}info.f.cornerEdits={};if(info.f.config?.format==='rounded-rect')info.f.config.format='rectangle';rebuildFormGeometry(info.owner);renderMachiningVisuals();commitHistory();shapeCornerRender();renderAppliedShapes();updateShapePreview();toast('Cantos resetados');}
  
  function shapeSetMode(mode){
    shapeUiMode=['format','corners','sketch'].includes(mode)?mode:'format';document.querySelectorAll('[data-shape-mode]').forEach(b=>{const on=b.dataset.shapeMode===shapeUiMode;b.classList.toggle('active',on);b.classList.toggle('secondary',!on);});
    if($('shapeFormatPanel'))$('shapeFormatPanel').style.display=shapeUiMode==='format'?'grid':'none';if($('shapeCornersPanel'))$('shapeCornersPanel').style.display=shapeUiMode==='corners'?'grid':'none';if($('shapeSketchPanel'))$('shapeSketchPanel').style.display=shapeUiMode==='sketch'?'grid':'none';if($('applyShape'))$('applyShape').style.display=shapeUiMode==='sketch'?'inline-block':'none';if($('shapeType'))$('shapeType').value=shapeUiMode==='sketch'?'custom-profile':'piece-format';if(shapeUiMode==='sketch'){shapeCadInitForOwner();shapeCadFitView();}if(shapeUiMode==='corners')shapeCornerRender();updateShapePreview();
  }
  const shapeCadSyncUiV36=shapeCadSyncUi;
  shapeCadSyncUi=function(){if($('shapeMiniCad'))$('shapeMiniCad').style.display=shapeUiMode==='sketch'?'grid':'none';if(shapeUiMode==='sketch')shapeCadSyncUiV36();};
  
  function shapePreviewSvgRender(outer,holes,W,H,msg){
    const svg=$('shapePreviewSvg');if(!svg)return;const pad=22,sw=420,sh=260,scale=Math.min((sw-pad*2)/Math.max(1,W),(sh-pad*2)/Math.max(1,H)),ox=(sw-W*scale)/2,oy=(sh-H*scale)/2,path=pts=>pts.map(([u,v],i)=>`${i?'L':'M'} ${(ox+u*scale).toFixed(2)} ${(sh-(oy+v*scale)).toFixed(2)}`).join(' ')+' Z';let d=path(outer);for(const h of holes||[])d+=' '+path(h);svg.innerHTML=`<rect width="420" height="260" fill="#fafbf9"/><path d="${d}" fill="#d9d6cf" fill-rule="evenodd" stroke="#232829" stroke-width="2.2"/><text x="210" y="18" text-anchor="middle" fill="#317d70" font-size="12" font-weight="800">${nice(W)} × ${nice(H)} mm</text>`;const peri=shapePolylinePerimeter(outer)+(holes||[]).reduce((n,h)=>n+shapePolylinePerimeter(h),0);if($('shapePerimeterInfo'))$('shapePerimeterInfo').textContent=`Perímetro real ${nice(peri)} mm`;if($('shapePreviewText'))$('shapePreviewText').textContent=msg||'Prévia da forma.';
  }
  const updateShapePreviewV36b=updateShapePreview;
  updateShapePreview=function(){
    const owner=shapePreviewOwner||ctx.selected;if(!owner)return;
    if(shapeUiMode==='format'){
      const cfg=shapeFormatConfigFromUi(),W=cfg.width,H=cfg.height,base=shapeFormatBasePolygon(cfg,W,H,64),edits=shapeDeepClone(shapeLoadedFormatCornerEdits||{});if(cfg.format==='rounded-rect'&&!Object.keys(edits).length)for(let i=0;i<4;i++)edits[String(i)]={style:'round',value:cfg.radius};const outer=shapeApplyCornerEdits(base,edits,9);shapePreviewSvgRender(outer,[],W,H,`${({rectangle:'Retangular',ellipse:'Elipse',circle:'Circular','l-top':'Tampo em L','cut-corners':'Cantos cortados','rounded-rect':'Cantos arredondados',chamfered:'Tampo chanfrado'}[cfg.format]||'Formato')} · prévia paramétrica.`);return;
    }
    if(shapeUiMode==='corners'){const ti=pieceThicknessInfo(owner),outer=formOutlinePointsMm(owner,owner.userData.forms||[],48),holes=formCutoutPointsMm(owner,owner.userData.forms||[]);shapePreviewSvgRender(outer,holes,ti.faceW,ti.faceH,'Selecione os cantos na prévia acima e aplique Arco, Chanfro ou Reto.');return;}
    updateShapePreviewV36b();const ti=pieceThicknessInfo(owner),outer=formOutlinePointsMm(owner,[...(owner.userData.forms||[]),(()=>{try{return shapeDraftOperation();}catch{return null;}})()].filter(Boolean),48);if(outer?.length&&ti&&$('shapePerimeterInfo'))$('shapePerimeterInfo').textContent=`Perímetro real ${nice(shapePolylinePerimeter(outer))} mm`;
  };
  
  function shapeTransformEditor(kind){
    if(shapeUiMode==='sketch'){
      const {W,H}=shapeCadOwnerInfo();if(!shapeCadState.points.length){toast('Desenhe ou carregue um esboço primeiro');return;}shapeCadPushUndo();let pts=shapeCadState.points.map(p=>p.slice());if(kind==='h')pts=pts.map(([x,y])=>[W-x,y]);else if(kind==='v')pts=pts.map(([x,y])=>[x,H-y]);else{const b=shapeCadSketchBounds(pts),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;pts=pts.map(([x,y])=>[cx-(y-cy),cy+(x-cx)]);const nb=shapeCadSketchBounds(pts),scale=Math.min(1,(W-2)/Math.max(1,nb.w),(H-2)/Math.max(1,nb.h)),ncx=(nb.minX+nb.maxX)/2,ncy=(nb.minY+nb.maxY)/2;pts=pts.map(([x,y])=>[W/2+(x-ncx)*scale,H/2+(y-ncy)*scale]);}shapeCadState.points=pts.map(shapeCadClampPoint);shapeCadRender();updateShapePreview();return;
    }
    const cfg=shapeFormatConfigFromUi(),mapH={tr:'tl',tl:'tr',br:'bl',bl:'br'},mapV={tr:'br',br:'tr',tl:'bl',bl:'tl'},mapR={tr:'tl',tl:'bl',bl:'br',br:'tr'};const mapCorners=m=>{cfg.corners=(cfg.corners||[]).map(c=>m[c]||c);};if(kind==='h'){if(cfg.lCorner)cfg.lCorner=mapH[cfg.lCorner]||cfg.lCorner;mapCorners(mapH);}if(kind==='v'){if(cfg.lCorner)cfg.lCorner=mapV[cfg.lCorner]||cfg.lCorner;mapCorners(mapV);}if(kind==='r'){if(cfg.lCorner)cfg.lCorner=mapR[cfg.lCorner]||cfg.lCorner;mapCorners(mapR);[cfg.width,cfg.height]=[cfg.height,cfg.width];[cfg.cutW,cfg.cutH]=[cfg.cutH,cfg.cutW];[cfg.cutX,cfg.cutY]=[cfg.cutY,cfg.cutX];}shapeFormatPopulate(cfg);updateShapePreview();
  }
  
  refreshShapePresetSelect=function(preferred=null){
    const sel=$('shapePresetSelect');if(!sel)return;const all=shapeCurrentPresets();sel.innerHTML='';if(shapeLibraryScope==='global'&&globalShapeState.loading){const o=document.createElement('option');o.textContent='Carregando…';sel.appendChild(o);shapeSyncScopeUi();return;}if(shapeLibraryScope==='global'&&globalShapeState.error){const o=document.createElement('option');o.textContent='Falha ao carregar';sel.appendChild(o);shapeSyncScopeUi();return;}if(!all.length){const o=document.createElement('option');o.textContent=shapeLibraryScope==='global'?'Nenhuma forma global publicada':'Nenhuma forma';sel.appendChild(o);shapeSyncScopeUi();return;}
    const groups=new Map();for(const p of all){const g=String(p.folder||'Sem pasta').trim()||'Sem pasta';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(p);}for(const [g,arr] of groups){const og=document.createElement('optgroup');og.label=g;for(const p of arr){const o=document.createElement('option');o.value=p.id;o.textContent=p.name+(p.locked?' · padrão':p.global?' · global':'');og.appendChild(o);}sel.appendChild(og);}const wanted=preferred&&all.some(x=>x.id===preferred)?preferred:(all.find(x=>x.id==='builtin-format-rect')?.id||all[0]?.id);if(wanted)sel.value=wanted;shapeSyncScopeUi();loadSelectedShapePresetToEditor(false);
  };
  function shapeLoadPieceFormatPreset(p){const cfg={...shapeFormatConfigFromUi(),...(p.formatConfig||p.config||{})};shapeLoadedFormatCornerEdits=shapeDeepClone(p.cornerEdits||{});shapeFormatPopulate(cfg);shapeSetMode('format');}
  loadSelectedShapePresetToEditor=function(setEdit=false){
    const p=findShapePreset($('shapePresetSelect')?.value);if(!p)return;if($('shapeFolder'))$('shapeFolder').value=p.folder||'Formas';if($('shapeName'))$('shapeName').value=p.name||'Forma';shapePresetEditId=setEdit&&!p.locked&&(!p.global||adminAllowed())?p.id:null;$('saveShapePreset').textContent=shapePresetEditId?'💾 Salvar alteração':(shapeLibraryScope==='global'?'💾 Salvar global':'💾 Salvar na biblioteca');
    if(p.type==='piece-format'){shapeLoadPieceFormatPreset(p);return;}if(p.type==='custom-profile'){if($('shapeType'))$('shapeType').value='custom-profile';shapeSetMode('sketch');shapeCadLoadPreset(p);shapeCadFitView();updateShapePreview();return;}if(p.type==='round-corner'){shapeSetMode('corners');shapeSetCornerStyle('round');if($('shapeCornerEditValue'))$('shapeCornerEditValue').value=nice(p.radius||50);shapeCornerRender();updateShapePreview();}
  };
  newShapePreset=function(){shapePresetEditId=null;if(shapeLibraryScope==='global'&&!adminAllowed()){toast('Somente o administrador pode criar Formas globais');return;}$('shapeFolder').value=shapeLibraryScope==='global'?'Formas globais':'Formas personalizadas';$('shapeName').value='Minha forma';shapeSetMode('sketch');shapeCadResetToPieceRect({record:false});$('saveShapePreset').textContent=shapeLibraryScope==='global'?'💾 Salvar global':'💾 Salvar na biblioteca';$('shapeName').focus();};
  editSelectedShapePreset=function(){const p=findShapePreset($('shapePresetSelect')?.value);if(!p)return;if(p.global&&!adminAllowed()){toast('Somente o administrador pode editar Formas globais');return;}if(p.locked){shapePresetEditId=null;$('shapeName').value=(p.name||'Forma')+' personalizada';toast('Forma padrão aberta como cópia editável');}else shapePresetEditId=p.id;loadSelectedShapePresetToEditor(true);};
  function shapePresetFromEditor(){
    const name=String($('shapeName')?.value||'').trim(),folder=String($('shapeFolder')?.value||'Formas').trim()||'Formas';if(!name)throw new Error('Dê um nome para a forma');
    if(shapeUiMode==='format'){return {name,folder,type:'piece-format',formatConfig:shapeFormatConfigFromUi()};}
    if(shapeUiMode==='corners'){const info=shapeCornerBaseInfo();if(!info)throw new Error('Selecione uma peça');return {name,folder,type:'piece-format',formatConfig:{...(info.f.config||{}),width:pieceThicknessInfo(info.owner).faceW,height:pieceThicknessInfo(info.owner).faceH},cornerEdits:shapeDeepClone(info.f.cornerEdits||{})};}
    const pts=shapeCadState.points.map(shapeCadClampPoint);if(shapeCadState.closed){if(pts.length<3||Math.abs(shapeCadPolygonArea(pts))<.5)throw new Error('Feche um esboço válido');const {W,H}=shapeCadOwnerInfo();if(pts.some(q=>shapeCadBoundaryRef(q,W,H)))throw new Error('Para forma na borda, deixe o esboço aberto');const b=shapeCadSketchBounds(pts);return {name,folder,type:'custom-profile',sketchPoints:pts.map(p=>[roundMmNumber(p[0]-b.minX,3),roundMmNumber(p[1]-b.minY,3)]),sketchW:roundMmNumber(b.w,3),sketchH:roundMmNumber(b.h,3),closed:true,profileVersion:2,operation:'cutout'};}
    const {W,H}=shapeCadOwnerInfo();if(pts.length<2||!shapeCadBoundaryRef(pts[0],W,H)||!shapeCadBoundaryRef(pts.at(-1),W,H))throw new Error('Esboço aberto precisa começar e terminar na borda da peça');return {name,folder,type:'custom-profile',profileNormalized:shapeCadNormalizePoints(pts,W,H),closed:false,profileVersion:2,operation:'edge-profile'};
  }
  saveShapePresetLibrary=async function(){
    try{const p=shapePresetFromEditor();if(shapeLibraryScope==='global'){if(!adminAllowed())throw new Error('Somente o administrador pode salvar Formas globais');let data;if(shapePresetEditId)data=await cloudApiFetch(`/admin/shapes/global/${encodeURIComponent(shapePresetEditId)}`,{method:'PUT',body:{preset:p},timeoutMs:20000});else data=await cloudApiFetch('/admin/shapes/global',{method:'POST',body:{preset:p},timeoutMs:20000});shapePresetEditId=data?.item?.id||shapePresetEditId;await loadGlobalShapePresets(true);refreshShapePresetSelect(shapePresetEditId);toast('Forma global salva para todos');return;}const arr=getUserShapePresets();if(shapePresetEditId){const i=arr.findIndex(x=>x.id===shapePresetEditId);if(i>=0)arr[i]={...arr[i],...p,id:shapePresetEditId};else shapePresetEditId=null;}if(!shapePresetEditId){const item={...p,id:uid('shapePreset')};arr.push(item);shapePresetEditId=item.id;}setUserShapePresets(arr);refreshShapePresetSelect(shapePresetEditId);toast('Forma salva na biblioteca');}catch(err){toast(err.message||'Não foi possível salvar a forma');}
  };
  deleteShapePresetLibrary=async function(){
    const id=$('shapePresetSelect')?.value,p=findShapePreset(id);if(!p)return;if(p.locked){toast('As formas padrão não podem ser excluídas');return;}if(shapeLibraryScope==='global'){if(!adminAllowed()){toast('Somente o administrador pode excluir Formas globais');return;}if(!window.confirm(`Excluir a Forma global “${p.name}”?`))return;try{await cloudApiFetch(`/admin/shapes/global/${encodeURIComponent(id)}`,{method:'DELETE',body:{},timeoutMs:20000});await loadGlobalShapePresets(true);refreshShapePresetSelect();toast('Forma global excluída');}catch(err){toast(err.message||'Falha ao excluir Forma global');}return;}if(!window.confirm(`Excluir a forma “${p.name}” da sua biblioteca?`))return;setUserShapePresets(getUserShapePresets().filter(x=>x.id!==id));shapePresetEditId=null;refreshShapePresetSelect();toast('Forma removida da biblioteca');
  };
  async function publishSelectedShapePresetGlobal(){const p=findShapePreset($('shapePresetSelect')?.value);if(!p||shapeLibraryScope!=='local')return;if(!adminAllowed()){toast('Somente o administrador pode publicar Formas globais');return;}try{const copy=shapeDeepClone(p);delete copy.id;delete copy.locked;delete copy.global;if(copy.type==='piece-format'){const d=shapeFormatDefaultDims();copy.formatConfig={width:d.W,height:d.H,...(copy.formatConfig||{})};}const data=await cloudApiFetch('/admin/shapes/global',{method:'POST',body:{preset:copy},timeoutMs:20000});globalShapeState.loaded=false;toast(`Forma “${data?.item?.name||p.name}” publicada para todos`);}catch(err){toast(err.message||'Não foi possível publicar a Forma');}}
  
  const renderAppliedShapesV36=renderAppliedShapes;
  renderAppliedShapes=function(){
    const list=$('shapeAppliedList');if(!list)return;list.innerHTML='';const owner=shapePreviewOwner||ctx.selected,forms=owner?.userData?.forms||[],labels=shapeCornerLabels(owner);if(!forms.length){const d=document.createElement('div');d.className='dialogHelp';d.textContent='Nenhuma Forma aplicada nesta peça.';list.appendChild(d);return;}
    for(const f of forms){const item=document.createElement('div');item.className='shapeAppliedItem';const text=document.createElement('div');text.innerHTML='<strong></strong><span></span>';text.querySelector('strong').textContent=f.name||'Forma';let detail='';if(f.type==='piece-format'){const fmt=f.config?.format||'rectangle';detail=`Formato ${fmt} · ${Object.keys(f.cornerEdits||{}).length} canto(s) editado(s)`;}else if(f.type==='custom-profile')detail=f.operation==='cutout'?`Esboço fechado · recorte interno · ${(f.points||[]).length} pontos`:f.operation==='edge-profile'?`Esboço aberto · recorte de borda · ${(f.points||[]).length} pontos`:`Mini CAD · ${(f.points||[]).length} pontos`;else detail=`R ${nice(f.radius)} mm · ${(f.corners||[]).map(c=>labels[c]||c).join(' + ')}`;text.querySelector('span').textContent=detail;const del=document.createElement('button');del.className='danger';del.textContent='Excluir';del.onclick=()=>deleteAppliedShape(f.id);item.append(text,del);list.appendChild(item);}
  };
  
  const restoreShapePreviewV36=restoreShapePreview;
  restoreShapePreview=function(){
    if(shapePreviewActive&&shapePreviewOwner&&runtimeModel.objects.includes(shapePreviewOwner)&&shapePreviewOriginalDims){shapePreviewOwner.userData.forms=cloneForms(shapePreviewOriginalForms||[]);setDimensions(shapePreviewOwner,shapePreviewOriginalDims.width,shapePreviewOriginalDims.depth,shapePreviewOriginalDims.height,true);rebuildFormGeometry(shapePreviewOwner);shapePreviewActive=false;shapePreviewOriginalForms=null;shapePreviewOriginalDims=null;$('shape3DPreviewBar').style.display='none';setDesignLabVisualizationOnly(false);renderMachiningVisuals();return;}restoreShapePreviewV36();shapePreviewOriginalDims=null;
  };
  previewShape3D=function(){
    const owner=shapePreviewOwner||ctx.selected;if(!owner)return;try{restoreShapePreview();shapePreviewOwner=owner;shapePreviewOriginalForms=cloneForms(owner.userData.forms||[]);shapePreviewOriginalDims={width:owner.userData.width,depth:owner.userData.depth,height:owner.userData.height};if(shapeUiMode==='format'){shapeApplyFormatConfig(owner,shapeFormatConfigFromUi(),{commit:false,name:$('shapeName')?.value||null,folder:$('shapeFolder')?.value||null,cornerEdits:shapeLoadedFormatCornerEdits});shapePreviewActive=true;}else if(shapeUiMode==='sketch'){const forms=cloneForms(shapePreviewOriginalForms);forms.push(shapeDraftOperation());owner.userData.forms=forms;rebuildFormGeometry(owner);shapePreviewActive=true;}else{shapePreviewOriginalForms=null;shapePreviewOriginalDims=null;shapePreviewActive=false;}$('shapeDialog').style.display='none';$('shape3DPreviewBar').style.display='flex';setDesignLabVisualizationOnly(true);$('shape3DPreviewInfo').textContent=`${owner.userData.name||'Peça'} · prévia 3D; gire e aproxime, depois volte.`;selectObject(owner);toast('Prévia 3D da Forma');}catch(err){restoreShapePreview();toast(err.message||'Não foi possível visualizar');}
  };
  returnShapePreview=function(){restoreShapePreview();if(shapePreviewOwner&&runtimeModel.objects.includes(shapePreviewOwner))selectObject(shapePreviewOwner);$('shapeDialog').style.display='flex';if(shapeUiMode==='corners')shapeCornerRender();updateShapePreview();};
  
  openShapeDialog=function(){
    if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});if(!ctx.selected){toast('Selecione uma peça');return;}if(ctx.selected.userData?.kind==='cylinder'||ctx.selected.userData?.kind==='curved-panel'||ctx.selected.userData?.curvedRole){toast('Forma disponível para peças planas');return;}shapePreviewOwner=ctx.selected;shapePreviewOriginalForms=null;shapePreviewOriginalDims=null;shapePreviewActive=false;shapePresetEditId=null;shapeLibraryScope='local';$('morePanel').style.display='none';$('machiningDialog').style.display='none';const ti=pieceThicknessInfo(ctx.selected);$('shapePartInfo').textContent=`Formato: ${ctx.selected.userData.name||'Peça'} · ${nice(ti.faceW)} × ${nice(ti.faceH)} × ${nice(ti.thickness)} mm. Formatos e esboços alteram o contorno real exportado no DXF.`;shapeLoadedFormatCornerEdits={};shapeFormatPopulate({format:'rectangle',width:ti.faceW,height:ti.faceH});shapeSetMode('format');shapeSyncScopeUi();refreshShapePresetSelect('builtin-format-rect');shapeCadInitForOwner({forceRect:true});renderAppliedShapes();shapeCornerRender();updateShapePreview();$('shapeDialog').style.display='flex';
  };
  
  // ---------- 1.200.43 · Forma 3D fechada e visual limpo ----------
  // A geometria ExtrudeGeometry já é sólida/fechada. O aspecto de "peça aberta"
  // vinha das quatro linhas verticais artificiais usadas para representar espessura.
  // Agora só desenhamos ligações verticais em cantos geométricos reais. Curvas e
  // elipses ficam contínuas, sem a emenda preta falsa vista na prévia 3D.
  function formVisualSharpCornerIndices(pts,{thresholdDeg=18,maxCorners=32}={}){
    if(!Array.isArray(pts)||pts.length<3)return [];
    const threshold=thresholdDeg*Math.PI/180,out=[];
    for(let i=0;i<pts.length;i++){
      const a=pts[(i-1+pts.length)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
      const v1=[b[0]-a[0],b[1]-a[1]],v2=[c[0]-b[0],c[1]-b[1]],l1=Math.hypot(v1[0],v1[1]),l2=Math.hypot(v2[0],v2[1]);
      if(l1<1e-6||l2<1e-6)continue;
      const dot=Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(l1*l2))),turn=Math.acos(dot);
      if(turn>=threshold)out.push(i);
    }
    if(out.length>maxCorners)return [];
    return out;
  }
  makeFormVisualEdges=function(o,pts,ti){
    const group=new THREE.Group();group.userData.isVisualEdge=true;
    const xray=xray3DActive(),outlineMat=new THREE.LineBasicMaterial({color:0x15120e,transparent:true,opacity:xray?.82:.82,depthTest:!xray,depthWrite:false});
    const cornerMat=new THREE.LineBasicMaterial({color:0x1b1711,transparent:true,opacity:xray?.76:.62,depthTest:!xray,depthWrite:false});
    group.material=outlineMat;const t=ti.thickness/2;
    // Contorno superior e inferior contínuos: mostram a espessura sem "abrir" a peça.
    for(const side of [-t,t]){
      const arr=pts.map(([u,v])=>formLocalPoint(ti,u,v,side));
      if(arr.length){arr.push(arr[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),outlineMat);line.userData.isVisualEdge=true;group.add(line);}
    }
    // Só cantos reais recebem linha vertical. Em círculos/elipses nenhuma emenda é criada.
    const sharp=formVisualSharpCornerIndices(pts),seg=[];
    for(const i of sharp){const p=pts[i];seg.push(formLocalPoint(ti,p[0],p[1],-t),formLocalPoint(ti,p[0],p[1],t));}
    if(seg.length){const sides=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),cornerMat);sides.userData.isVisualEdge=true;group.add(sides);}
    group.renderOrder=xray?88:12;return group;
  };
  function focusPieceForShapePreview(o){
    if(!o)return;
    returnTo3D({restore:false,notify:false});
    // Box3 usa a geometria já transformada e inclui corretamente formatos redondos/L/chanfrados.
    const box=new THREE.Box3().setFromObject(o),center=new THREE.Vector3(),size=new THREE.Vector3();box.getCenter(center);box.getSize(size);
    const span=Math.max(size.x,size.y,size.z,.12),dist=Math.max(.32,span*1.65);
    perspectiveCamera.up.set(0,1,0);
    perspectiveCamera.position.set(center.x+dist*.72,center.y+dist*.52,center.z+dist*.88);
    controls.target.copy(center);perspectiveCamera.lookAt(center);controls.update();
  }
  
  
  // ---------- 1.200.47 · Forma aplicada: sólido fechado igual à peça normal ----------
  // A 1.200.44/46 tentou montar manualmente tampas e paredes com BufferGeometry.
  // Apesar de o contorno existir, em alguns formatos a malha podia parecer uma
  // "casca" incompleta. A partir daqui a Forma usa o gerador sólido do próprio
  // Three.js (ExtrudeGeometry), que fecha automaticamente tampa superior, tampa
  // inferior e TODA a parede lateral, incluindo o segmento último→primeiro.
  // A posição da peça não é alterada; só a geometria do contorno muda.
  function formV47CleanLoop(loop){
    const out=[];
    for(const p of (loop||[])){
      const q=[Number(p?.[0]),Number(p?.[1])];
      if(!q.every(Number.isFinite))continue;
      const last=out.at(-1);
      if(!last||Math.hypot(last[0]-q[0],last[1]-q[1])>.0001)out.push(q);
    }
    if(out.length>2&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<.0001)out.pop();
    return out;
  }
  // ---------- 1.200.48 · sólido sem reflexão de eixos ----------
  // O mapeamento antigo formMapExtrudeGeometry() fazia uma troca direta de eixos.
  // Para peças cuja espessura é X ou Y essa troca tem determinante negativo:
  // geometricamente é uma REFLEXÃO. A malha continuava existindo, porém o winding
  // das faces ficava invertido e o FrontSide fazia tampas/laterais parecerem abertas.
  //
  // Agora cada orientação é construída no plano correto e depois recebe somente
  // ROTAÇÕES (determinante +1). Assim as normais e o lado externo das faces ficam
  // iguais aos de uma BoxGeometry tradicional.
  function formV48PathFromLoop(loop,ti,PathCtor){
    const pts=formV47CleanLoop(loop);if(pts.length<3)return null;
    const path=new PathCtor();
    pts.forEach(([u,v],i)=>{
      const su=(u-ti.faceW/2)*MM_TO_M,sv=(v-ti.faceH/2)*MM_TO_M;
      let x=su,y=sv;
      // Para orientar a extrusão por rotação sem espelhar o sólido, pré-invertemos
      // uma coordenada do perfil nos eixos que seriam reflexões no mapeamento antigo.
      if(ti.thicknessAxis==='y')y=-sv;
      else if(ti.thicknessAxis==='x')x=-su;
      if(i===0)path.moveTo(x,y);else path.lineTo(x,y);
    });
    path.closePath();
    return path;
  }
  function formV48SolidGeometry(outer,holes,ti){
    outer=formV47CleanLoop(outer);
    holes=(holes||[]).map(formV47CleanLoop).filter(h=>h.length>=3);
    if(outer.length<3)return null;
  
    const shape=formV48PathFromLoop(outer,ti,THREE.Shape);
    if(!shape)return null;
    for(const h of holes){
      const hole=formV48PathFromLoop(h,ti,THREE.Path);
      if(hole)shape.holes.push(hole);
    }
  
    let g=null;
    try{
      g=new THREE.ExtrudeGeometry(shape,{
        depth:ti.thickness*MM_TO_M,
        bevelEnabled:false,
        steps:1,
        curveSegments:128
      });
    }catch(_){return null;}
    if(!g?.attributes?.position?.count)return null;
  
    const half=ti.thickness*MM_TO_M/2;
    // Primeiro centraliza a espessura no eixo Z local da ExtrudeGeometry.
    g.translate(0,0,-half);
    // Depois só ROTACIONA para o eixo real da espessura da peça.
    // Y: [su,-sv,st] --Rx(-90°)--> [su,st,sv]
    // X: [-su,sv,st] --Ry(+90°)--> [st,sv,su]
    if(ti.thicknessAxis==='y')g.rotateX(-Math.PI/2);
    else if(ti.thicknessAxis==='x')g.rotateY(Math.PI/2);
  
    // ExtrudeGeometry usa material 0 nas tampas e 1 nas paredes. Mantemos esses
    // grupos e garantimos que todos apontem para materiais existentes da peça.
    if(!Array.isArray(g.groups)||!g.groups.length){
      const count=g.index?.count||g.attributes.position.count;
      g.clearGroups();g.addGroup(0,count,0);
    }else{
      for(const group of g.groups){
        if(!Number.isFinite(group.materialIndex)||group.materialIndex<0)group.materialIndex=0;
        if(group.materialIndex>1)group.materialIndex=1;
      }
    }
    g.computeVertexNormals();
    g.computeBoundingBox();g.computeBoundingSphere();
    return g;
  }
  function formV47VisualEdges(o,outer,holes,ti){
    const group=new THREE.Group();group.userData.isVisualEdge=true;
    const xray=xray3DActive(),t=ti.thickness/2;
    const strongSide=ti.thicknessAxis==='z'?-t:t,weakSide=-strongSide;
    const strongMat=new THREE.LineBasicMaterial({color:0x15120e,transparent:true,opacity:xray?.82:.84,depthTest:!xray,depthWrite:false});
    const weakMat=new THREE.LineBasicMaterial({color:0x221c15,transparent:true,opacity:xray?.50:.30,depthTest:!xray,depthWrite:false});
    const cornerMat=new THREE.LineBasicMaterial({color:0x1b1711,transparent:true,opacity:xray?.62:.48,depthTest:!xray,depthWrite:false});
    group.material=strongMat;
    const addLoop=(loop,side,mat)=>{
      const pts=formV47CleanLoop(loop),arr=pts.map(([u,v])=>formLocalPoint(ti,u,v,side));
      if(!arr.length)return;arr.push(arr[0].clone());
      const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),mat);l.userData.isVisualEdge=true;group.add(l);
    };
    addLoop(outer,strongSide,strongMat);addLoop(outer,weakSide,weakMat);
    for(const h of holes){addLoop(h,strongSide,strongMat);addLoop(h,weakSide,weakMat);}
  
    // Linhas verticais somente em quinas geométricas reais. O fechamento do sólido
    // NÃO depende destas linhas; elas são apenas acabamento visual.
    const cleanOuter=formV47CleanLoop(outer),sharp=formVisualSharpCornerIndices(cleanOuter,{thresholdDeg:22,maxCorners:48}),seg=[];
    for(const i of sharp){const p=cleanOuter[i];if(!p)continue;seg.push(formLocalPoint(ti,p[0],p[1],-t),formLocalPoint(ti,p[0],p[1],t));}
    if(seg.length){const l=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),cornerMat);l.userData.isVisualEdge=true;group.add(l);}
    group.renderOrder=xray?88:12;return group;
  }
  function formV47RestoreOpaqueMaterials(o){
    // Fora das vistas técnicas 2D, uma Forma deve ter a mesma leitura sólida de
    // uma peça tradicional: material opaco e depth buffer ativo.
    if(ctx.viewMode2D)return;
    for(const mat of (o?.userData?.faceMaterials||[])){
      if(!mat)continue;
      mat.transparent=false;mat.opacity=1;mat.depthWrite=true;mat.depthTest=true;
      mat.side=THREE.FrontSide;mat.needsUpdate=true;
    }
  }
  // Círculos/elipses recebem resolução alta para não parecerem facetados.
  const shapeFormatBasePolygonV43=shapeFormatBasePolygon;
  shapeFormatBasePolygon=function(cfg,W,H,segments=64){
    const f=cfg?.format||'rectangle';
    if(f==='ellipse'||f==='circle'){
      const out=[],cx=W/2,cy=H/2,rx=W/2,ry=H/2,n=Math.max(256,Math.ceil(Number(segments||64)*4));
      for(let i=0;i<n;i++){const a=Math.PI*2*i/n;out.push([cx+rx*Math.cos(a),cy+ry*Math.sin(a)]);}return out;
    }
    return shapeFormatBasePolygonV43(cfg,W,H,segments);
  };
  const rebuildFormGeometryV43=rebuildFormGeometry;
  rebuildFormGeometry=function(o){
    if(!o||o.userData?.kind==='cylinder'||o.userData?.kind==='curved-panel'||o.userData?.curvedRole)return rebuildFormGeometryV43(o);
    const forms=Array.isArray(o.userData?.forms)?o.userData.forms:[];
    if(!forms.length)return rebuildFormGeometryV43(o);
    const ti=pieceThicknessInfo(o);if(!ti)return rebuildFormGeometryV43(o);
    const outer=formOutlinePointsMm(o,forms,128),holes=formCutoutPointsMm(o,forms);if(outer.length<3)return rebuildFormGeometryV43(o);
    const geom=formV48SolidGeometry(outer,holes,ti);if(!geom)return rebuildFormGeometryV43(o);
  
    disposeVisualEdgeTree(o);o.geometry?.dispose?.();o.geometry=geom;o.scale.set(1,1,1);
    if(Array.isArray(o.userData?.faceMaterials)&&o.userData.faceMaterials.length)o.material=o.userData.faceMaterials;
    formV47RestoreOpaqueMaterials(o);
    if(o===ctx.selected&&!ctx.visualMode)setAllFaces(o,COLORS.selected);else restoreBaseColor(o);
  
    const perimeter=shapePolylinePerimeter(outer)+holes.reduce((n,h)=>n+shapePolylinePerimeter(h),0);
    o.userData.formProfile={type:'forms',points:outer.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)]),cutouts:holes.map(h=>h.map(p=>[roundMmNumber(p[0],3),roundMmNumber(p[1],3)])),bboxW:ti.faceW,bboxH:ti.faceH,thicknessAxis:ti.thicknessAxis,uAxis:ti.uAxis,vAxis:ti.vAxis,perimeterMm:roundMmNumber(perimeter,2),solidVersion:48};
    o.userData.formPerimeterMm=roundMmNumber(perimeter,2);
    const edges=formV47VisualEdges(o,outer,holes,ti);o.add(edges);o.userData.visualEdges=edges;
  };
  
  
  // ============================================================================
  // 1.200.50 · COPIAR FORMA EM LOTE
  // Uma peça é a origem. Depois o usuário toca em quantas peças destino quiser e
  // aplica de uma vez. Só a Forma é copiada: posição, material, espessura,
  // usinagens e vínculos das peças destino permanecem próprios.
  // ============================================================================
  const shapeCopyState={active:false,phase:'source',source:null,targets:new Set(),helpers:null};
  
  function shapeCopyPieceEligible(o){
    if(!o||!runtimeModel.objects.includes(o))return false;
    if(o.userData?.kind==='space-cell'||o.userData?.kind==='cylinder'||o.userData?.kind==='curved-panel'||o.userData?.curvedRole)return false;
    return !!pieceThicknessInfo(o);
  }
  function shapeCopySourceHasForm(o){return shapeCopyPieceEligible(o)&&Array.isArray(o.userData?.forms)&&o.userData.forms.length>0;}
  function shapeCopyDisposeHelpers(){
    const g=shapeCopyState.helpers;if(!g)return;
    g.traverse?.(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.();});
    scene.remove(g);shapeCopyState.helpers=null;
  }
  function shapeCopyRefreshHelpers(){
    shapeCopyDisposeHelpers();if(!shapeCopyState.active)return;
    const g=new THREE.Group();g.userData.isShapeCopyHelper=true;
    if(shapeCopyState.source&&runtimeModel.objects.includes(shapeCopyState.source)){
      const h=new THREE.BoxHelper(shapeCopyState.source,0x53d6e8);h.userData.isShapeCopyHelper=true;g.add(h);
    }
    for(const o of shapeCopyState.targets){
      if(!runtimeModel.objects.includes(o))continue;const h=new THREE.BoxHelper(o,0x7fe594);h.userData.isShapeCopyHelper=true;g.add(h);
    }
    scene.add(g);shapeCopyState.helpers=g;
  }
  function shapeCopyEnsureBar(){
    let bar=document.getElementById('shapeCopyBar');if(bar)return bar;
    bar=document.createElement('div');bar.id='shapeCopyBar';bar.className='shapeCopyBar';
    bar.innerHTML=`<div class="shapeCopyBarText"><strong id="shapeCopyBarTitle">⧉ Copiar Forma</strong><span id="shapeCopyBarStatus"></span></div><div class="shapeCopyBarActions"><button id="shapeCopyChangeSource" class="secondary">Trocar origem</button><button id="shapeCopyApplyBtn">Aplicar</button><button id="shapeCopyCancelBtn" class="secondary">Cancelar</button></div>`;
    document.body.appendChild(bar);
    bar.querySelector('#shapeCopyChangeSource').onclick=shapeCopyChooseSourceAgain;
    bar.querySelector('#shapeCopyApplyBtn').onclick=shapeCopyApplyBatch;
    bar.querySelector('#shapeCopyCancelBtn').onclick=()=>closeCopyShapeTool(true);
    return bar;
  }
  function shapeCopyUpdateBar(){
    const bar=shapeCopyEnsureBar(),status=bar.querySelector('#shapeCopyBarStatus'),apply=bar.querySelector('#shapeCopyApplyBtn'),change=bar.querySelector('#shapeCopyChangeSource');
    bar.style.display=shapeCopyState.active?'flex':'none';if(!shapeCopyState.active)return;
    if(shapeCopyState.phase==='source'){
      status.textContent='Toque na peça que já possui a Forma que será copiada.';apply.disabled=true;apply.textContent='Aplicar';change.style.display='none';
    }else{
      const n=shapeCopyState.targets.size,name=shapeCopyState.source?.userData?.name||'Peça origem';
      status.textContent=`Origem: ${name} · toque nas peças destino para marcar/desmarcar · ${n} selecionada(s).`;
      apply.disabled=n===0;apply.textContent=n?`Aplicar em ${n}`:'Aplicar';change.style.display='inline-flex';
    }
  }
  function shapeCopyChooseSourceAgain(){
    shapeCopyState.phase='source';shapeCopyState.source=null;shapeCopyState.targets.clear();shapeCopyRefreshHelpers();shapeCopyUpdateBar();toast('Selecione a peça de origem da Forma');
  }
  function openCopyShapeTool(){
    if(typeof ctx.closeCopyHardwareTool==='function'&&typeof ctx.hardwareCopyState!=='undefined'&&ctx.hardwareCopyState.active)ctx.closeCopyHardwareTool(false);
    if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
    setTool('select');
    shapeCopyState.active=true;shapeCopyState.targets.clear();
    if(shapeCopySourceHasForm(ctx.selected)){shapeCopyState.source=ctx.selected;shapeCopyState.phase='targets';toast('Origem definida. Selecione as peças destino.');}
    else{shapeCopyState.source=null;shapeCopyState.phase='source';toast('Selecione a peça que contém a Forma a copiar');}
    shapeCopyRefreshHelpers();shapeCopyUpdateBar();
  }
  function closeCopyShapeTool(notify=false){
    if(!shapeCopyState.active)return;shapeCopyState.active=false;shapeCopyState.phase='source';shapeCopyState.source=null;shapeCopyState.targets.clear();shapeCopyDisposeHelpers();const bar=document.getElementById('shapeCopyBar');if(bar)bar.style.display='none';if(notify)toast('Copiar Forma cancelado');
  }
  function shapeCopyHandlePick(){
    if(!shapeCopyState.active)return false;
    runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,ctx.camera);const hits=runtimeModel.raycaster.intersectObjects(referenceMeshes(),false);
    const obj=hits.map(h=>h.object).find(o=>shapeCopyPieceEligible(o));
    if(!obj){toast(shapeCopyState.phase==='source'?'Toque em uma peça que tenha Forma':'Toque em uma peça plana para marcar como destino');return true;}
    if(shapeCopyState.phase==='source'){
      if(!shapeCopySourceHasForm(obj)){toast('Essa peça ainda não possui uma Forma para copiar');return true;}
      shapeCopyState.source=obj;shapeCopyState.phase='targets';shapeCopyState.targets.clear();selectObject(obj);shapeCopyRefreshHelpers();shapeCopyUpdateBar();toast('Origem definida. Agora selecione uma ou várias peças destino.');return true;
    }
    if(obj===shapeCopyState.source){toast('Esta é a peça de origem');return true;}
    if(shapeCopyState.targets.has(obj))shapeCopyState.targets.delete(obj);else shapeCopyState.targets.add(obj);
    shapeCopyRefreshHelpers();shapeCopyUpdateBar();return true;
  }
  function shapeCopyAdaptForms(source,target){
    const srcTi=pieceThicknessInfo(source),dstTi=pieceThicknessInfo(target),forms=cloneForms(source.userData?.forms||[]);if(!srcTi||!dstTi)return [];
    const sx=dstTi.faceW/Math.max(.001,srcTi.faceW),sy=dstTi.faceH/Math.max(.001,srcTi.faceH),maxR=Math.min(dstTi.faceW,dstTi.faceH)/2;
    return forms.map(f=>{
      f.id=uid('form');
      if(f.type==='round-corner')f.radius=Math.max(0,Math.min(maxR,Number(f.radius)||0));
      if(f.type==='piece-format'&&f.config){
        f.config.width=dstTi.faceW;f.config.height=dstTi.faceH;
        if(f.config.format==='rounded-rect')f.config.radius=Math.max(.1,Math.min(maxR,Number(f.config.radius)||50));
        if(Number.isFinite(Number(f.config.cutW)))f.config.cutW=Math.min(Math.max(.1,Number(f.config.cutW)),Math.max(.1,dstTi.faceW-.1));
        if(Number.isFinite(Number(f.config.cutH)))f.config.cutH=Math.min(Math.max(.1,Number(f.config.cutH)),Math.max(.1,dstTi.faceH-.1));
        if(Number.isFinite(Number(f.config.cutX)))f.config.cutX=Math.min(Math.max(.1,Number(f.config.cutX)),dstTi.faceW*.49);
        if(Number.isFinite(Number(f.config.cutY)))f.config.cutY=Math.min(Math.max(.1,Number(f.config.cutY)),dstTi.faceH*.49);
      }
      if(f.type==='custom-profile'&&Array.isArray(f.points)){
        f.points=f.points.map(p=>[roundMmNumber((Number(p[0])||0)*sx,3),roundMmNumber((Number(p[1])||0)*sy,3)]);
        if(Number.isFinite(Number(f.sketchW)))f.sketchW=roundMmNumber(Number(f.sketchW)*sx,3);
        if(Number.isFinite(Number(f.sketchH)))f.sketchH=roundMmNumber(Number(f.sketchH)*sy,3);
        f.baseW=dstTi.faceW;f.baseH=dstTi.faceH;
      }
      return f;
    });
  }
  function shapeCopyApplyBatch(){
    const source=shapeCopyState.source,targets=[...shapeCopyState.targets].filter(shapeCopyPieceEligible);
    if(!shapeCopySourceHasForm(source)){toast('Selecione novamente a peça de origem');shapeCopyChooseSourceAgain();return;}
    if(!targets.length){toast('Selecione pelo menos uma peça destino');return;}
    const replacing=targets.filter(o=>Array.isArray(o.userData?.forms)&&o.userData.forms.length).length;
    if(replacing&&!window.confirm(`${replacing} peça(s) destino já possuem Forma. A Forma atual delas será substituída pela Forma da origem. Continuar?`))return;
    shapeCopyDisposeHelpers();
    let done=0;
    for(const o of targets){
      const forms=shapeCopyAdaptForms(source,o);if(!forms.length)continue;o.userData.forms=forms;rebuildFormGeometry(o);done++;
    }
    renderMachiningVisuals();updateInspector?.();commitHistory();closeCopyShapeTool(false);toast(`Forma copiada para ${done} peça(s) · medidas, posição e usinagens preservadas`);
  }
  const state={get machiningType(){return machiningType;}, set machiningType(value){machiningType=value;},get machiningEditId(){return machiningEditId;}, set machiningEditId(value){machiningEditId=value;},get shapeCadState(){return shapeCadState;},get shapeSelectedCorners(){return shapeSelectedCorners;}, set shapeSelectedCorners(value){shapeSelectedCorners=value;},get shapePreviewActive(){return shapePreviewActive;}, set shapePreviewActive(value){shapePreviewActive=value;},get shapeCopyState(){return shapeCopyState;},get shapeCornerStyle(){return shapeCornerStyle;}, set shapeCornerStyle(value){shapeCornerStyle=value;}};
  return { state, machiningResizeRawCoord, machiningResizeSpan, machiningResizeAnchorForAxis, remapMachiningArrayForPieceResize, remapMachiningForPieceResize, cloneMachiningForTargetSize, cloneMachining, mmPrec, axisSizeMmFromUserData, pieceThicknessInfo, axisLabel, machiningFaceOptions, entryAxisName, entryAxisSign, localCoordField, parseDecimalInput, machiningFieldNumber, grooveLengthIsFull, setGrooveLengthFull, syncGrooveLengthButton, formatCoordInputValue, toggleMachiningCoordSign, machiningRawCoord, resolveSignedMachiningCoord, resolvedMachiningCoords, machiningCoordRefText, machiningHasNegativeRef, shapeCadOwnerInfo, shapeCadSnapshot, shapeCadRestoreSnapshot, shapeCadPushUndo, shapeCadUndo, shapeCadRedo, shapeCadClampPoint, shapeCadMap, shapeCadTouchLike, shapeCadSnapRadiusPx, shapeCadEdgeRadiusPx, shapeCadPxDistance, shapeCadNearestIndex, shapeCadSegments, shapeCadClosestOnSegment, shapeCadSegmentIntersection, shapeCadActiveAnchor, shapeCadInferenceCandidates, shapeCadResolveSnap, shapeCadEventRawPoint, shapeCadSnapPoint, shapeCadPointerPoint, shapeCadSetStatus, shapeCadSetTool, shapeCadResetToPieceRect, shapeCadClear, shapeCadCloseContour, shapeCadPolygonArea, shapeCadNormalizePoints, shapeCadLoadNormalized, shapeCadProfilePoints, shapeCadArcThrough, shapeCadQuad, shapeCadFilletAt, shapeCadChamferAt, shapeCadApplyToolPoint, shapeCadGuideSvg, shapeCadSnapMarkerSvg, shapeCadRender, shapeCadPointerDown, shapeCadPointerMove, shapeCadPointerUp, shapeCadPointerLeave, shapeCadInitForOwner, shapeCadSyncUi, shapeCadLoadPreset, cloneForms, getUserShapePresets, setUserShapePresets, allShapePresets, findShapePreset, shapeCornerLabels, refreshShapeCornerLabels, refreshShapePresetSelect, loadSelectedShapePresetToEditor, newShapePreset, editSelectedShapePreset, saveShapePresetLibrary, deleteShapePresetLibrary, formCornerRadii, formOutlinePointsMm, disposeVisualEdgeTree, formMapExtrudeGeometry, formLocalPoint, makeFormVisualEdges, rebuildFormGeometry, shapeDraftOperation, updateShapePreview, renderAppliedShapes, deleteAppliedShape, openShapeDialog, restoreShapePreview, previewShape3D, returnShapePreview, applyShapeToPiece, closeShapeDialog, getUserMachiningPresets, setUserMachiningPresets, allMachiningPresets, refreshMachiningPresetSelect, findMachiningPreset, updateMachiningPresetInfo, captureMachiningPresetData, applyMachiningPresetData, applySelectedMachiningPreset, saveCurrentMachiningPreset, deleteSelectedMachiningPreset, populateMachiningSeriesAxes, holeSeriesInstances, actualMachiningCount, updateHoleSeriesVisibility, updateBackGrooveVisibility, applyHole32Preset, applyBackGroovePreset, operationDepthMm, remapMachiningAxes, sanitizeMachiningForPiece, clearMachiningVisuals, renderMachiningVisuals, updateMachiningVisualTransforms, clearMachiningDraftPreview, updateDraftPreviewTransforms, renderMachiningDraftPreview, focusPieceForMachiningPreview, showMachining3DPreview, closeMachining3DPreview, setMachiningType, populateMachiningFaceOptions, populateMachiningLengthAxes, setMachiningSurfaceCoordinate, setDefaultMachiningValues, machiningDraft, updateMachiningUI, renderMachiningList, openMachiningDialog, saveMachining, loadMachiningForEdit, deleteMachining, shapeCadSketchBounds, shapeCadFitView, shapeCadUpdateZoomLabel, shapeCadZoomBy, shapeCadZoomWheel, formCutoutPointsMm, makeFormVisualEdgesWithCutouts, shapeCadBoundaryRef, shapeCadBoundaryPointAtT, shapeCadBoundaryPathCCW, formEdgeProfileOutlineMm, shapeDeepClone, shapeCurrentLocalPresets, shapeCurrentPresets, loadGlobalShapePresets, shapeSyncScopeUi, setShapeLibraryScope, shapeFormatDefaultDims, shapeFormatSelectedCorners, shapeFormatConfigFromUi, shapeFormatPopulate, shapeFormatTypeChanged, shapeFormatUpdateFields, shapeCutRectangle, shapeFormatBasePolygon, shapeApplyCornerEdits, shapePieceFormatForm, shapePieceFormatRawPolygon, shapePieceFormatOutline, shapePolylinePerimeter, shapeResizeFace, shapeFormatRecordFromConfig, shapeApplyFormatConfig, applyParametricFormatToPiece, shapeEnsurePieceFormat, shapeCornerBaseInfo, shapeCornerRender, shapeCornerSelectFromEvent, shapeSetCornerStyle, shapeApplyCornerEdit, shapeResetCorners, shapeSetMode, shapePreviewSvgRender, shapeTransformEditor, shapeLoadPieceFormatPreset, shapePresetFromEditor, publishSelectedShapePresetGlobal, formVisualSharpCornerIndices, focusPieceForShapePreview, formV47CleanLoop, formV48PathFromLoop, formV48SolidGeometry, formV47VisualEdges, formV47RestoreOpaqueMaterials, shapeCopyPieceEligible, shapeCopySourceHasForm, shapeCopyDisposeHelpers, shapeCopyRefreshHelpers, shapeCopyEnsureBar, shapeCopyUpdateBar, shapeCopyChooseSourceAgain, openCopyShapeTool, closeCopyShapeTool, shapeCopyHandlePick, shapeCopyAdaptForms, shapeCopyApplyBatch };
}
