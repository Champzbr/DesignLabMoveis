// ============================================================================
// 1.200.18 · GERAR LAYOUT TÉCNICO / APRESENTAÇÃO
// ----------------------------------------------------------------------------
// Extrai desenhos 2D diretamente da geometria 3D do projeto. Não depende da
// câmera e não altera nenhuma peça. Gera vistas, cortes A-A/B-B, cotas,
// identificação de peças e exportação SVG / PNG / PDF / DXF.
// ============================================================================
const DL_LAYOUT_VERSION='1.200.42';
const DL_LAYOUT_VIEWS={
  front:'Vista frontal',frontOpen:'Frente sem portas/frentes',back:'Vista traseira',left:'Lateral esquerda',right:'Lateral direita',
  top:'Planta baixa',bottom:'Vista inferior',perspective:'Vista perspectiva',sectionX:'Corte A-A',sectionY:'Corte B-B',sheet:'Folha técnica'
};
const dlLayoutEdgeCache=new WeakMap();
const dlLayoutState={
  view:'sheet',mode:'technical',profile:'marcenaria',showDimensions:true,showInternal:true,showLabels:true,
  showHidden:true,showHatch:true,hideDoors:false,hideFronts:false,visibleDimsOnly:true,scale:'20',page:'A4',scopeValue:'',sectionXPct:50,sectionYPct:50,
  hiddenDims:new Set(),pickSection:null,lastMappings:[],dimHits:[],lastSvg:'',lastWidth:1800,lastHeight:1200,lastContext:null,renderToken:0
};

function dlLayoutEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function dlLayoutAscii(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');}
function dlLayoutNum(v,d=3){const n=Number(v);return Number.isFinite(n)?Number(n.toFixed(d)):0;}
function dlLayoutMmText(v){
  const n=Number(v)||0;
  if(Math.abs(n-Math.round(n))<.005)return String(Math.round(n));
  const d1=Math.round(n*10)/10;
  if(Math.abs(n-d1)<.005)return d1.toFixed(1).replace('.',',');
  return (Math.round(n*100)/100).toFixed(2).replace('.',',').replace(/0+$/,'').replace(/,$/,'');
}
function dlLayoutModeHasDimensions(){return dlLayoutState.showDimensions&&dlLayoutState.mode!=='presentation';}
function dlLayoutModeShowsSections(){return dlLayoutState.mode==='technical';}
function dlLayoutModeLabel(){return dlLayoutState.mode==='cleanprint'?'limpo para impressão':(dlLayoutState.mode==='presentation'?'apresentação':'técnico');}
function dlLayoutProfileLabel(){return dlLayoutState.profile==='production'?'Produção':'Marcenaria';}
function dlLayoutSheetNote(){return dlLayoutState.mode==='cleanprint'?'Cotas úteis · desenho limpo':(dlLayoutState.mode==='presentation'?'Apresentação sem cotas':'Cortes A-A / B-B · cotas em mm');}
function dlLayoutSetProfile(profile,{render=true}={}){
  dlLayoutState.profile=profile==='production'?'production':'marcenaria';
  dlLayoutState.visibleDimsOnly=true;
  if($('layoutUsefulOnly'))$('layoutUsefulOnly').checked=true;
  if($('layoutProfile'))$('layoutProfile').value=dlLayoutState.profile;
  try{localStorage.setItem('designlabLayoutProfile',dlLayoutState.profile);}catch{}
  const hint=$('layoutProfileHint');
  if(hint)hint.textContent=dlLayoutState.profile==='production'
    ? 'Produção: ao exportar a Folha técnica em PDF, gera 2 páginas: técnica + limpa.'
    : 'Marcenaria: prioriza somente as cotas realmente úteis e visíveis.';
  if(render)dlLayoutRender();
}
function dlLayoutHexColor(o){
  const v=Number(o?.userData?.baseColor);
  return Number.isFinite(v)?`#${Math.max(0,Math.min(0xffffff,v)).toString(16).padStart(6,'0')}`:'#d9d9d9';
}
function dlLayoutEligiblePiece(o){
  const u=o?.userData||{};
  return !!o && u.kind!=='hardware-visual' && u.kind!=='cylinder' && !u.isMachiningDraftPreview && !u.isSpacePickMesh;
}
function dlLayoutIsDoor(o){
  const u=o?.userData||{},n=String(u.name||'');
  return !!o && (!!u.doorConfig || /^Porta(?:\s|$)/i.test(n));
}
function dlLayoutIsFront(o){
  const u=o?.userData||{},n=String(u.name||'');
  return !!o && (u.drawerRole==='drawer-front' || /^Frente de gaveta(?:\s|$)/i.test(n));
}
function dlLayoutPiecesForView(ctx,view){
  const internal=view==='frontOpen';
  return ctx.pieces.filter(o=>{
    if((internal||dlLayoutState.hideDoors)&&dlLayoutIsDoor(o))return false;
    if((internal||dlLayoutState.hideFronts)&&dlLayoutIsFront(o))return false;
    return true;
  });
}
function dlLayoutRootFromValue(v){
  const s=String(v||'');
  if(!s.startsWith('space:'))return null;
  return getSpaceRoot(s.slice(6))||null;
}
function dlLayoutActiveRoot(){
  return selectedFurnitureRoot?.() || activeSpaceRoot?.() || (activeSpaceRootId?getSpaceRoot(activeSpaceRootId):null) || spaceRoots?.[0] || null;
}
function dlLayoutWorldBounds(o){
  try{
    o.updateMatrixWorld?.(true);
    const b=new THREE.Box3().setFromObject(o);
    return {minX:b.min.x*1000,maxX:b.max.x*1000,minY:b.min.y*1000,maxY:b.max.y*1000,minZ:b.min.z*1000,maxZ:b.max.z*1000};
  }catch{
    const u=o?.userData||{},x=(Number(o?.position?.x)||0)*1000,y=(Number(o?.position?.y)||0)*1000,z=(Number(o?.position?.z)||0)*1000;
    const w=(Number(u.width)||0)*1000,h=(Number(u.height)||0)*1000,d=(Number(u.depth)||0)*1000;
    return {minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2};
  }
}
function dlLayoutAggregateBounds(pieces,root=null){
  if(root){
    const b=rootBounds(root);return {minX:b.minX*1000,maxX:b.maxX*1000,minY:b.minY*1000,maxY:b.maxY*1000,minZ:b.minZ*1000,maxZ:b.maxZ*1000};
  }
  const out={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const o of pieces){const b=dlLayoutWorldBounds(o);for(const a of ['X','Y','Z']){out['min'+a]=Math.min(out['min'+a],b['min'+a]);out['max'+a]=Math.max(out['max'+a],b['max'+a]);}}
  if(!Number.isFinite(out.minX))return {minX:0,maxX:1000,minY:0,maxY:1000,minZ:0,maxZ:600};
  return out;
}
function dlLayoutContext(){
  const scope=$('layoutScopeSelect')?.value||dlLayoutState.scopeValue||'';
  const root=dlLayoutRootFromValue(scope);
  const pieces=(scope==='project'||!root)
    ? objects.filter(dlLayoutEligiblePiece)
    : objects.filter(o=>dlLayoutEligiblePiece(o)&&(o.userData?.spaceRootId===root.id||objectBelongsToRoot(o,root)));
  const bounds=dlLayoutAggregateBounds(pieces,root);
  const label=scope==='project'?'Projeto inteiro':(root?.name||'Móvel');
  return {scope,root,pieces,bounds,label};
}
function dlLayoutPopulateScope(preferCurrent=true){
  const sel=$('layoutScopeSelect');if(!sel)return;
  const prev=sel.value;
  sel.innerHTML='<option value="project">Projeto inteiro</option>'+spaceRoots.map(r=>`<option value="space:${dlLayoutEsc(r.id)}">${dlLayoutEsc(r.name||'Móvel')}</option>`).join('');
  let target=prev;
  if(preferCurrent||![...sel.options].some(o=>o.value===target)){
    const root=dlLayoutActiveRoot();target=root?`space:${root.id}`:'project';
  }
  sel.value=[...sel.options].some(o=>o.value===target)?target:'project';
  dlLayoutState.scopeValue=sel.value;
}
function dlLayoutPieceEdges3D(o){
  const out=[];
  try{
    o.updateMatrixWorld(true);
    const sig=`${o.geometry?.uuid||''}|${o.matrixWorld.elements.map(v=>Number(v).toFixed(6)).join(',')}`;
    const cached=dlLayoutEdgeCache.get(o);if(cached?.sig===sig)return cached.edges;
    const eg=new THREE.EdgesGeometry(o.geometry,1);
    const a=eg.getAttribute('position');
    for(let i=0;i+1<a.count;i+=2){
      const p1=new THREE.Vector3(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(o.matrixWorld).multiplyScalar(1000);
      const p2=new THREE.Vector3(a.getX(i+1),a.getY(i+1),a.getZ(i+1)).applyMatrix4(o.matrixWorld).multiplyScalar(1000);
      if(p1.distanceToSquared(p2)>.0001)out.push([p1,p2]);
    }
    eg.dispose();if(out.length){dlLayoutEdgeCache.set(o,{sig,edges:out});return out;}
  }catch{}
  if(out.length)return out;
  const b=dlLayoutWorldBounds(o),P=(x,y,z)=>new THREE.Vector3(x,y,z);
  const c=[P(b.minX,b.minY,b.minZ),P(b.maxX,b.minY,b.minZ),P(b.maxX,b.maxY,b.minZ),P(b.minX,b.maxY,b.minZ),P(b.minX,b.minY,b.maxZ),P(b.maxX,b.minY,b.maxZ),P(b.maxX,b.maxY,b.maxZ),P(b.minX,b.maxY,b.maxZ)];
  for(const [i,j] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])out.push([c[i],c[j]]);
  return out;
}
function dlLayoutProjectPoint(p,view){
  switch(view){
    case 'back':return {u:-p.x,v:p.y,d:-p.z};
    case 'left':return {u:p.z,v:p.y,d:-p.x};
    case 'right':return {u:-p.z,v:p.y,d:p.x};
    case 'top':return {u:p.x,v:-p.z,d:p.y};
    case 'bottom':return {u:p.x,v:p.z,d:-p.y};
    case 'perspective':{const c=.8660254;return {u:c*(p.x-p.z),v:p.y+.32*(p.x+p.z),d:p.x+p.z};}
    default:return {u:p.x,v:p.y,d:p.z};
  }
}
function dlLayoutProjectWorldBounds(b,view){
  const pts=[];
  for(const x of [b.minX,b.maxX])for(const y of [b.minY,b.maxY])for(const z of [b.minZ,b.maxZ])pts.push(dlLayoutProjectPoint({x,y,z},view));
  return {minU:Math.min(...pts.map(p=>p.u)),maxU:Math.max(...pts.map(p=>p.u)),minV:Math.min(...pts.map(p=>p.v)),maxV:Math.max(...pts.map(p=>p.v))};
}
function dlLayoutRectOverlapRatio(a,b){
  const w=Math.max(0,Math.min(a.maxU,b.maxU)-Math.max(a.minU,b.minU)),h=Math.max(0,Math.min(a.maxV,b.maxV)-Math.max(a.minV,b.minV));
  const area=Math.max(.001,(a.maxU-a.minU)*(a.maxV-a.minV));return (w*h)/area;
}
function dlLayoutConvexHull(points){
  const pts=points.map(p=>({u:Number(p.u),v:Number(p.v)})).filter(p=>Number.isFinite(p.u)&&Number.isFinite(p.v)).sort((a,b)=>a.u-b.u||a.v-b.v);
  const uniq=[];for(const p of pts){const q=uniq.at(-1);if(!q||Math.abs(q.u-p.u)>.001||Math.abs(q.v-p.v)>.001)uniq.push(p);}if(uniq.length<3)return uniq;
  const cross=(o,a,b)=>(a.u-o.u)*(b.v-o.v)-(a.v-o.v)*(b.u-o.u),lo=[],up=[];
  for(const p of uniq){while(lo.length>=2&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}for(let i=uniq.length-1;i>=0;i--){const p=uniq[i];while(up.length>=2&&cross(up.at(-2),up.at(-1),p)<=0)up.pop();up.push(p);}lo.pop();up.pop();return lo.concat(up);
}
function dlLayoutPointInHull(p,h){
  if(!h||h.length<3)return false;
  const edgeTol=.08;
  for(let i=0,j=h.length-1;i<h.length;j=i++){
    const a=h[j],b=h[i],dx=b.u-a.u,dy=b.v-a.v,l2=dx*dx+dy*dy;
    if(l2>1e-12){
      const t=Math.max(0,Math.min(1,((p.u-a.u)*dx+(p.v-a.v)*dy)/l2));
      const qx=a.u+t*dx,qy=a.v+t*dy;
      if(Math.hypot(p.u-qx,p.v-qy)<=edgeTol)return true;
    }
  }
  let inside=false;
  for(let i=0,j=h.length-1;i<h.length;j=i++){const a=h[i],b=h[j];const hit=((a.v>p.v)!==(b.v>p.v))&&(p.u<(b.u-a.u)*(p.v-a.v)/((b.v-a.v)||1e-9)+a.u);if(hit)inside=!inside;}
  return inside;
}
function dlLayoutSegmentCovered(seg,nearer){
  const samples=[.2,.5,.8];
  return samples.every(t=>{const p={u:seg.a.u+(seg.b.u-seg.a.u)*t,v:seg.a.v+(seg.b.v-seg.a.v)*t};return nearer.some(n=>{const b=n.box;if(p.u<b.minU-.02||p.u>b.maxU+.02||p.v<b.minV-.02||p.v>b.maxV+.02)return false;return n.hull?.length>=3?dlLayoutPointInHull(p,n.hull):true;});});
}
function dlLayoutPieceProjected(o,view,index){
  const seg3=dlLayoutPieceEdges3D(o),segments=[],pts=[];let depth=0,n=0;
  for(const [a,b] of seg3){const p=dlLayoutProjectPoint(a,view),q=dlLayoutProjectPoint(b,view);segments.push({a:p,b:q});pts.push(p,q);depth+=(p.d+q.d)/2;n++;}
  const box={minU:Math.min(...pts.map(p=>p.u)),maxU:Math.max(...pts.map(p=>p.u)),minV:Math.min(...pts.map(p=>p.v)),maxV:Math.max(...pts.map(p=>p.v))};
  return {o,index,name:o.userData?.name||`Peça ${index+1}`,partId:o.userData?.partId||'',segments,points:pts,hull:dlLayoutConvexHull(pts),box,depth:n?depth/n:0,hidden:false,cut:false,color:dlLayoutHexColor(o),world:dlLayoutWorldBounds(o)};
}
function dlLayoutSectionItem(o,axis,plane,index){
  const b=dlLayoutWorldBounds(o),eps=.2;
  const cut=axis==='x'?(b.minX<=plane+eps&&b.maxX>=plane-eps):(b.minY<=plane+eps&&b.maxY>=plane-eps);
  const beyond=axis==='x'?b.maxX>=plane-eps:b.minY<=plane+eps;
  if(!cut&&!beyond)return null;
  const view=axis==='x'?'left':'top',item=dlLayoutPieceProjected(o,view,index);item.cut=cut;
  // A seção usa a caixa efetivamente atravessada para hachura/espessura.
  if(cut){
    if(axis==='x')item.sectionBox={minU:b.minZ,maxU:b.maxZ,minV:b.minY,maxV:b.maxY};
    else item.sectionBox={minU:b.minX,maxU:b.maxX,minV:-b.maxZ,maxV:-b.minZ};
  }
  // Elementos além do plano permanecem visíveis em linha fina; a superfície
  // realmente atravessada recebe linha grossa + hachura e é desenhada por cima.
  item.hidden=false;item.depth=cut?1e9:item.depth;return item;
}
function dlLayoutModel(view,ctx){
  const bx=ctx.bounds,sectionX=bx.minX+(bx.maxX-bx.minX)*(dlLayoutState.sectionXPct/100),sectionY=bx.minY+(bx.maxY-bx.minY)*(dlLayoutState.sectionYPct/100);
  let items=[],projection=view==='frontOpen'?'front':view;
  const pieces=dlLayoutPiecesForView(ctx,view);
  if(view==='sectionX'){projection='left';items=pieces.map((o,i)=>dlLayoutSectionItem(o,'x',sectionX,ctx.pieces.indexOf(o))).filter(Boolean);}
  else if(view==='sectionY'){projection='top';items=pieces.map((o,i)=>dlLayoutSectionItem(o,'y',sectionY,ctx.pieces.indexOf(o))).filter(Boolean);}
  else items=pieces.map(o=>dlLayoutPieceProjected(o,projection,ctx.pieces.indexOf(o)));
  if(view!=='sectionX'&&view!=='sectionY'){
    const nearest=[...items].sort((a,b)=>b.depth-a.depth),opaque=[];
    for(const it of nearest){
      for(const seg of it.segments)seg.hidden=dlLayoutSegmentCovered(seg,opaque);
      it.hidden=it.segments.length?it.segments.every(seg=>seg.hidden):opaque.some(r=>dlLayoutRectOverlapRatio(it.box,r)>.96);
      if(!it.hidden)opaque.push(it);
    }
  }
  const pb=dlLayoutProjectWorldBounds(bx,projection);
  return {view,projection,items,bounds:pb,worldBounds:bx,sectionX,sectionY,ctx};
}
const DL_LAYOUT_DIM_TOL=.02;
function dlLayoutVisibleDimensionBounds(model){
  const pts=[];
  for(const it of model.items){
    if(it.hidden&&!it.cut)continue;
    if(it.cut&&it.sectionBox){const q=it.sectionBox;pts.push({u:q.minU,v:q.minV},{u:q.maxU,v:q.maxV});continue;}
    for(const seg of it.segments||[]){if(seg.hidden)continue;pts.push(seg.a,seg.b);}
  }
  if(!pts.length)return model.bounds;
  return {minU:Math.min(...pts.map(p=>p.u)),maxU:Math.max(...pts.map(p=>p.u)),minV:Math.min(...pts.map(p=>p.v)),maxV:Math.max(...pts.map(p=>p.v))};
}
function dlLayoutFaceItems(model){
  if(['frontOpen','sectionX','sectionY','perspective'].includes(model.view))return [];
  return model.items.filter(it=>!it.cut&&!it.hidden&&(dlLayoutIsDoor(it.o)||dlLayoutIsFront(it.o)));
}
function dlLayoutItemBounds(items){
  const pts=[];
  for(const it of items||[]){
    if(it.cut&&it.sectionBox){const q=it.sectionBox;pts.push({u:q.minU,v:q.minV},{u:q.maxU,v:q.maxV});continue;}
    for(const seg of it.segments||[]){if(seg.hidden)continue;pts.push(seg.a,seg.b);}
  }
  if(!pts.length)return null;
  return {minU:Math.min(...pts.map(p=>p.u)),maxU:Math.max(...pts.map(p=>p.u)),minV:Math.min(...pts.map(p=>p.v)),maxV:Math.max(...pts.map(p=>p.v))};
}
function dlLayoutFaceDimensionInfo(model){
  const items=dlLayoutFaceItems(model),bounds=dlLayoutItemBounds(items);
  return items.length&&bounds?{items,bounds}:null;
}
function dlLayoutDimensionSourceItems(model){
  const visible=model.items.filter(it=>!it.hidden||it.cut);
  if(!visible.length)return [];
  const faceItems=dlLayoutFaceItems(model);
  if(faceItems.length)return faceItems;
  return visible;
}
function dlLayoutInternalBoundaries(model,axis,dimBounds=null){
  const vals=[],b=dimBounds||model.bounds,sourceItems=dlLayoutDimensionSourceItems(model);
  for(const it of sourceItems){
    if(it.cut&&it.sectionBox){const q=it.sectionBox;vals.push(axis==='u'?q.minU:q.minV,axis==='u'?q.maxU:q.maxV);continue;}
    if(it.hidden)continue;
    for(const seg of it.segments||[]){
      if(seg.hidden)continue;
      const du=Math.abs(seg.b.u-seg.a.u),dv=Math.abs(seg.b.v-seg.a.v);
      if(axis==='u'){if(du>DL_LAYOUT_DIM_TOL||dv<.5)continue;vals.push((seg.a.u+seg.b.u)/2);}
      else{if(dv>DL_LAYOUT_DIM_TOL||du<.5)continue;vals.push((seg.a.v+seg.b.v)/2);}
    }
  }
  const min=axis==='u'?b.minU:b.minV,max=axis==='u'?b.maxU:b.maxV;
  vals.push(min,max);
  const sorted=vals.filter(Number.isFinite).map(v=>Math.round(v*100)/100).filter(v=>v>=min-DL_LAYOUT_DIM_TOL&&v<=max+DL_LAYOUT_DIM_TOL).sort((a,b)=>a-b);
  const out=[];
  for(const v of sorted){if(!out.length||Math.abs(v-out[out.length-1])>DL_LAYOUT_DIM_TOL)out.push(v);else out[out.length-1]=(out[out.length-1]+v)/2;}
  return out;
}
function dlLayoutFilterUsefulDimensionParts(model,axis,parts,b){
  let keep=parts.filter(p=>p.len>DL_LAYOUT_DIM_TOL);
  const info=dlLayoutFaceDimensionInfo(model);
  if(info){
    const min=axis==='u'?b.minU:b.minV,max=axis==='u'?b.maxU:b.maxV;
    const smin=axis==='u'?info.bounds.minU:info.bounds.minV,smax=axis==='u'?info.bounds.maxU:info.bounds.maxV;
    keep=keep.filter(p=>{
      const startsAtMin=Math.abs(p.a-min)<=DL_LAYOUT_DIM_TOL,endsAtMax=Math.abs(p.b-max)<=DL_LAYOUT_DIM_TOL;
      const beforeFace=p.b<=smin+DL_LAYOUT_DIM_TOL,afterFace=p.a>=smax-DL_LAYOUT_DIM_TOL;
      if((startsAtMin&&beforeFace)||(endsAtMax&&afterFace))return false;
      if(p.b<smin-DL_LAYOUT_DIM_TOL||p.a>smax+DL_LAYOUT_DIM_TOL)return false;
      return true;
    });
    if(!keep.length)keep=parts.filter(p=>p.len>DL_LAYOUT_DIM_TOL&&p.a>=smin-DL_LAYOUT_DIM_TOL&&p.b<=smax+DL_LAYOUT_DIM_TOL);
  }
  if(dlLayoutState.visibleDimsOnly&&keep.length){
    const overall=(axis==='u'?b.maxU-b.minU:b.maxV-b.minV),maxCount=info?6:8;
    if(keep.length>maxCount){
      const score=p=>(p.len>=overall*.45?200000:0)+(p.len>=overall*.18?80000:0)+p.len;
      keep=[...keep].sort((a,b)=>score(b)-score(a)).slice(0,maxCount).sort((a,b)=>a.a-b.a);
    }
  }
  return keep;
}
function dlLayoutDimensionModel(model){
  if(model.view==='perspective')return [];
  const b=dlLayoutVisibleDimensionBounds(model),dims=[];
  dims.push({id:`${model.view}-overall-u`,axis:'u',a:b.minU,b:b.maxU,text:dlLayoutMmText(b.maxU-b.minU),overall:true});
  dims.push({id:`${model.view}-overall-v`,axis:'v',a:b.minV,b:b.maxV,text:dlLayoutMmText(b.maxV-b.minV),overall:true});
  if(dlLayoutState.showInternal){
    for(const axis of ['u','v']){
      const arr=dlLayoutInternalBoundaries(model,axis,b),parts=[];
      const min=axis==='u'?b.minU:b.minV,max=axis==='u'?b.maxU:b.maxV,overall=max-min;
      for(let i=0;i<arr.length-1;i++){
        const a=arr[i],bb=arr[i+1],len=bb-a;
        if(len<=DL_LAYOUT_DIM_TOL)continue;
        if(Math.abs(a-min)<=DL_LAYOUT_DIM_TOL&&Math.abs(bb-max)<=DL_LAYOUT_DIM_TOL)continue;
        parts.push({a,b:bb,len});
      }
      let keep=dlLayoutFilterUsefulDimensionParts(model,axis,parts,b);
      if(!keep.length)keep=parts;
      if(keep.length>14){
        keep=[...keep].sort((a,b)=>{
          const pa=(a.len>=overall*.18?50000:0)+a.len;
          const pb=(b.len>=overall*.18?50000:0)+b.len;
          return pb-pa;
        }).slice(0,14).sort((a,b)=>a.a-b.a);
      }
      for(const p of keep)dims.push({id:`${model.view}-internal-${axis}-${Math.round(p.a*100)}-${Math.round(p.b*100)}`,axis,a:p.a,b:p.b,text:dlLayoutMmText(p.len),overall:false});
    }
  }
  return dims;
}
function dlLayoutViewMap(model,rect,{sheet=false}={}){
  const titleH=sheet?30:42,dimPad=dlLayoutModeHasDimensions()?(sheet?42:76):(sheet?18:35);
  const inner={x:rect.x+dimPad,y:rect.y+titleH+12,w:Math.max(40,rect.w-dimPad*1.45),h:Math.max(40,rect.h-titleH-dimPad*1.35)};
  const b=model.bounds,wu=Math.max(1,b.maxU-b.minU),hv=Math.max(1,b.maxV-b.minV),s=Math.min(inner.w/wu,inner.h/hv);
  const drawW=wu*s,drawH=hv*s,ox=inner.x+(inner.w-drawW)/2,oy=inner.y+(inner.h-drawH)/2;
  return {view:model.view,projection:model.projection,rect,inner,minU:b.minU,maxU:b.maxU,minV:b.minV,maxV:b.maxV,scale:s,ox,oy,sx:u=>ox+(u-b.minU)*s,sy:v=>oy+(b.maxV-v)*s,invU:x=>b.minU+(x-ox)/s,invV:y=>b.maxV-(y-oy)/s};
}
function dlLayoutSvgDefs(){return `<defs>
  <marker id="dlArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M8,0 L0,4 L8,8" fill="none" stroke="#000" stroke-width="1.15"/></marker>
  <pattern id="dlHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#000" stroke-width="1"/></pattern>
  <style>
    svg{font-family:Arial,Helvetica,sans-serif;background:rgb(255,255,255);color:#000;color-scheme:only light;forced-color-adjust:none}
    .dl-dim{cursor:pointer}.dl-dim:hover text{font-weight:800}
    .dl-piece-line{vector-effect:non-scaling-stroke;shape-rendering:geometricPrecision}
    .dl-hidden{stroke-dasharray:8 5}
    .dl-section-line{stroke-dasharray:14 5 3 5}
    text{fill:#000}
  </style>
</defs>`;}
function dlLayoutPolygonSvg(points,map,attrs=''){
  if(!points?.length)return '';
  return `<polygon points="${points.map(p=>`${dlLayoutNum(map.sx(p.u),2)},${dlLayoutNum(map.sy(p.v),2)}`).join(' ')}" ${attrs}/>`;
}
function dlLayoutRenderDimensions(model,map,{sheet=false}={}){
  if(!dlLayoutModeHasDimensions())return '';
  const b=model.bounds,parts=[],font=sheet?12:15;
  for(const d of dlLayoutDimensionModel(model)){
    if(dlLayoutState.hiddenDims.has(d.id))continue;
    const off=d.overall?(sheet?30:55):(sheet?15:28),tick=sheet?6:8;
    if(d.axis==='u'){
      const y=map.sy(b.minV)+off,x1=map.sx(d.a),x2=map.sx(d.b);
      dlLayoutState.dimHits.push({id:d.id,x1:Math.min(x1,x2)-10,x2:Math.max(x1,x2)+10,y1:y-18,y2:y+18});
      parts.push(`<g class="dl-dim" data-dim-id="${dlLayoutEsc(d.id)}"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#000" stroke-width="1" marker-start="url(#dlArrow)" marker-end="url(#dlArrow)"/><line x1="${x1}" y1="${y-tick}" x2="${x1}" y2="${y+tick}" stroke="#000"/><line x1="${x2}" y1="${y-tick}" x2="${x2}" y2="${y+tick}" stroke="#000"/><rect x="${(x1+x2)/2-22}" y="${y-font+1}" width="44" height="${font+4}" fill="#fff"/><text x="${(x1+x2)/2}" y="${y-3}" text-anchor="middle" font-size="${font}" fill="#000">${dlLayoutEsc(d.text)}</text></g>`);
    }else{
      const x=map.sx(b.minU)-off,y1=map.sy(d.a),y2=map.sy(d.b),ym=(y1+y2)/2;
      dlLayoutState.dimHits.push({id:d.id,x1:x-22,x2:x+22,y1:Math.min(y1,y2)-10,y2:Math.max(y1,y2)+10});
      parts.push(`<g class="dl-dim" data-dim-id="${dlLayoutEsc(d.id)}"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#000" stroke-width="1" marker-start="url(#dlArrow)" marker-end="url(#dlArrow)"/><line x1="${x-tick}" y1="${y1}" x2="${x+tick}" y2="${y1}" stroke="#000"/><line x1="${x-tick}" y1="${y2}" x2="${x+tick}" y2="${y2}" stroke="#000"/><g transform="translate(${x-5},${ym}) rotate(-90)"><rect x="-22" y="-${font-1}" width="44" height="${font+4}" fill="#fff"/><text x="0" y="-3" text-anchor="middle" font-size="${font}" fill="#000">${dlLayoutEsc(d.text)}</text></g></g>`);
    }
  }
  return parts.join('');
}
function dlLayoutRenderSectionMarks(model,map,{sheet=false}={}){
  if(model.view!=='front'||!dlLayoutModeShowsSections())return '';
  const b=model.bounds,font=sheet?13:17,out=[];
  const x=map.sx(model.sectionX),yt=map.sy(b.maxV),yb=map.sy(b.minV),y=map.sy(model.sectionY),xl=map.sx(b.minU),xr=map.sx(b.maxU);
  out.push(`<g class="dl-section-line" stroke="#000" stroke-width="${sheet?1.35:1.8}" fill="#000"><line x1="${x}" y1="${yt}" x2="${x}" y2="${yb}"/><text x="${x+6}" y="${yt+font}" font-size="${font}">A</text><text x="${x+6}" y="${yb-5}" font-size="${font}">A</text><line x1="${xl}" y1="${y}" x2="${xr}" y2="${y}"/><text x="${xl+5}" y="${y-6}" font-size="${font}">B</text><text x="${xr-font}" y="${y-6}" font-size="${font}">B</text></g>`);
  return out.join('');
}
function dlLayoutRenderLabels(model,map,{sheet=false}={}){
  if(!dlLayoutState.showLabels)return '';
  const font=sheet?11:14,r=sheet?9:12,out=[];
  const visible=model.items.filter(it=>!it.hidden||it.cut);
  visible.slice(0,60).forEach((it,k)=>{
    const box=it.sectionBox||it.box,cx=(box.minU+box.maxU)/2,cy=(box.minV+box.maxV)/2;
    const x=map.sx(cx),y=map.sy(cy),dx=(k%2?1:-1)*(sheet?18:26),dy=((k%3)-1)*(sheet?12:18),lx=x+dx,ly=y+dy;
    const shortName=String(it.name||`Peça ${it.index+1}`).slice(0,sheet?0:26);
    out.push(`<g class="dl-part-label"><line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="#000" stroke-width="1"/><circle cx="${lx}" cy="${ly}" r="${r}" fill="#fff" stroke="#000" stroke-width="1.4"/><text x="${lx}" y="${ly+font*.32}" text-anchor="middle" font-size="${font}" font-weight="700" fill="#000">${it.index+1}</text>${!sheet?`<text x="${lx+r+5}" y="${ly+font*.32}" font-size="${font-1}" fill="#000">${dlLayoutEsc(shortName)}</text>`:''}</g>`);
  });
  return out.join('');
}
function dlLayoutRenderPieces(model,map,{sheet=false}={}){
  const out=[],items=[...model.items].sort((a,b)=>a.depth-b.depth),line=sheet?1.35:1.9;
  for(const it of items){
    if(it.hidden&&!it.cut&&!dlLayoutState.showHidden)continue;
    const box=it.sectionBox||it.box,hull=it.cut&&it.sectionBox?[{u:box.minU,v:box.minV},{u:box.maxU,v:box.minV},{u:box.maxU,v:box.maxV},{u:box.minU,v:box.maxV}]:it.hull;
    if(it.cut&&dlLayoutState.showHatch){out.push(dlLayoutPolygonSvg(hull,map,`fill="url(#dlHatch)" stroke="none" opacity=".95"`));}
    else if(!it.hidden){out.push(dlLayoutPolygonSvg(hull,map,`fill="rgb(255,255,255)" fill-opacity="1" stroke="none"`));}
    const stroke='#000';
    if(it.cut&&it.sectionBox){
      const p=[{u:box.minU,v:box.minV},{u:box.maxU,v:box.minV},{u:box.maxU,v:box.maxV},{u:box.minU,v:box.maxV}];
      out.push(dlLayoutPolygonSvg(p,map,`fill="none" stroke="${stroke}" stroke-width="${sheet?2.8:3.8}" class="dl-piece-line"`));
    }else for(const seg of it.segments){const hidden=!!seg.hidden;if(hidden&&!dlLayoutState.showHidden)continue;const sw=hidden?line*.72:line,dash=hidden?' class="dl-piece-line dl-hidden" opacity=".55"':' class="dl-piece-line"';out.push(`<line${dash} x1="${dlLayoutNum(map.sx(seg.a.u),2)}" y1="${dlLayoutNum(map.sy(seg.a.v),2)}" x2="${dlLayoutNum(map.sx(seg.b.u),2)}" y2="${dlLayoutNum(map.sy(seg.b.v),2)}" stroke="${stroke}" stroke-width="${sw}"/>`);}
  }
  return out.join('');
}
function dlLayoutRenderOne(view,rect,ctx,{sheet=false}={}){
  const model=dlLayoutModel(view,ctx),map=dlLayoutViewMap(model,rect,{sheet});dlLayoutState.lastMappings.push(map);
  const title=DL_LAYOUT_VIEWS[view]||view,sub=(view==='sectionX'?`X = ${dlLayoutMmText(model.sectionX-model.worldBounds.minX)} mm`:(view==='sectionY'?`Y = ${dlLayoutMmText(model.sectionY-model.worldBounds.minY)} mm`:''));
  const titleY=rect.y+(sheet?30:42);
  return `<g data-layout-view="${view}"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="rgb(255,255,255)" stroke="#000" stroke-width="${sheet?1:1.25}"/><line x1="${rect.x}" y1="${titleY}" x2="${rect.x+rect.w}" y2="${titleY}" stroke="#000" stroke-width=".75"/><text x="${rect.x+12}" y="${rect.y+(sheet?20:28)}" font-size="${sheet?15:20}" font-weight="700" fill="#000">${dlLayoutEsc(title)}</text>${sub?`<text x="${rect.x+rect.w-12}" y="${rect.y+(sheet?20:28)}" text-anchor="end" font-size="${sheet?11:13}" fill="#000">${dlLayoutEsc(sub)}</text>`:''}${dlLayoutRenderPieces(model,map,{sheet})}${dlLayoutRenderSectionMarks(model,map,{sheet})}${dlLayoutRenderDimensions(model,map,{sheet})}${dlLayoutRenderLabels(model,map,{sheet})}</g>`;
}
function dlLayoutProjectTitle(ctx){return currentProjectRecord?.name||ctx.root?.name||'Projeto';}
function dlLayoutScaleText(){return dlLayoutState.scale==='fit'?'Automática':`1:${dlLayoutState.scale}`;}
function dlLayoutRenderSheet(ctx){
  const W=1800,H=1200,titleH=132,g=16,top=16,usableH=H-titleH-top*2,cellW=(W-g*5)/4,cellH=(usableH-g*3)/2;
  const views=['front','frontOpen','top','right','left','perspective','sectionX','sectionY'];let body='';
  views.forEach((v,i)=>{const col=i%4,row=Math.floor(i/4);body+=dlLayoutRenderOne(v,{x:g+(cellW+g)*col,y:top+(cellH+g)*row,w:cellW,h:cellH},ctx,{sheet:true});});
  const y=H-titleH,legend=ctx.pieces.slice(0,12).map((o,i)=>`${i+1} · ${String(o.userData?.name||`Peça ${i+1}`).slice(0,18)}`),row1=legend.slice(0,6),row2=legend.slice(6,12),legendText=(arr,yy)=>arr.map((t,i)=>`<text x="${34+i*153}" y="${yy}" font-size="11">${dlLayoutEsc(t)}</text>`).join('');
  body+=`<g class="dl-title-block"><rect x="18" y="${y}" width="${W-36}" height="${titleH-14}" fill="rgb(255,255,255)" stroke="#111" stroke-width="1.5"/><line x1="${W*0.55}" y1="${y}" x2="${W*0.55}" y2="${H-14}" stroke="#111"/><line x1="${W*0.78}" y1="${y}" x2="${W*0.78}" y2="${H-14}" stroke="#111"/><text x="34" y="${y+26}" font-size="22" font-weight="700">${dlLayoutEsc(dlLayoutProjectTitle(ctx))}</text><text x="34" y="${y+48}" font-size="13">${dlLayoutEsc(ctx.label)} · ${ctx.pieces.length} peça(s)</text>${legendText(row1,y+75)}${legendText(row2,y+96)}${ctx.pieces.length>12?`<text x="34" y="${y+116}" font-size="10" fill="#555">+ ${ctx.pieces.length-12} peça(s) na legenda completa do DesignLab</text>`:''}<text x="${W*0.55+18}" y="${y+30}" font-size="16" font-weight="700">DesignLabMoveis ${DL_LAYOUT_VERSION}</text><text x="${W*0.55+18}" y="${y+57}" font-size="14">Layout ${dlLayoutModeLabel()}</text><text x="${W*0.55+18}" y="${y+84}" font-size="12">${dlLayoutEsc(dlLayoutSheetNote())}</text><text x="${W*0.78+18}" y="${y+30}" font-size="16">Escala ${dlLayoutEsc(dlLayoutScaleText())}</text><text x="${W*0.78+18}" y="${y+57}" font-size="14">${new Date().toLocaleDateString('pt-BR')}</text><text x="${W*0.78+18}" y="${y+84}" font-size="12">Folha ${dlLayoutEsc(dlLayoutState.page)} horizontal</text></g>`;
  return {W,H,body};
}
function dlLayoutRenderSingle(ctx,view){const W=1400,H=960;return {W,H,body:dlLayoutRenderOne(view,{x:22,y:22,w:W-44,h:H-44},ctx,{sheet:false})};}
function dlLayoutUpdateLegend(ctx){
  const box=$('layoutPieceLegend');if(!box)return;
  box.innerHTML=ctx.pieces.slice(0,80).map((o,i)=>`<div><span>${i+1}</span><b>${dlLayoutEsc(o.userData?.name||`Peça ${i+1}`)}</b></div>`).join('')+(ctx.pieces.length>80?`<small>+ ${ctx.pieces.length-80} peças</small>`:'');
}
function dlLayoutUpdateSectionUi(ctx){
  const b=ctx.bounds,x=b.minX+(b.maxX-b.minX)*dlLayoutState.sectionXPct/100,y=b.minY+(b.maxY-b.minY)*dlLayoutState.sectionYPct/100;
  if($('layoutSectionXPct'))$('layoutSectionXPct').value=dlLayoutState.sectionXPct;
  if($('layoutSectionYPct'))$('layoutSectionYPct').value=dlLayoutState.sectionYPct;
  if($('layoutSectionXInfo'))$('layoutSectionXInfo').textContent=`A-A · ${dlLayoutMmText(x-b.minX)} mm da esquerda`;
  if($('layoutSectionYInfo'))$('layoutSectionYInfo').textContent=`B-B · ${dlLayoutMmText(y-b.minY)} mm do piso`;
}
// 1.200.23: renderização CAD DIRETA em Canvas 2D + cotas somente do que está visível.
// Não rasteriza mais SVG no Android. O Auto Dark do WebView atuava justamente
// na etapa SVG -> Image -> Canvas e gravava o cinza dentro do PNG/PDF.
function dlLayoutCanvasSetFont(g,size,{bold=false}={}){g.font=`${bold?'700 ':'400 '}${size}px Arial,Helvetica,sans-serif`;g.fillStyle='#000';g.textBaseline='alphabetic';}
function dlLayoutCanvasLine(g,x1,y1,x2,y2,{width=1,dash=null,alpha=1}={}){g.save();g.strokeStyle='#000';g.lineWidth=width;g.globalAlpha=alpha;g.setLineDash(dash||[]);g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();g.restore();}
function dlLayoutCanvasPolyPath(g,pts,map){if(!pts?.length)return false;g.beginPath();g.moveTo(map.sx(pts[0].u),map.sy(pts[0].v));for(let i=1;i<pts.length;i++)g.lineTo(map.sx(pts[i].u),map.sy(pts[i].v));g.closePath();return true;}
function dlLayoutCanvasHatch(g,pts,map,W,H){g.save();if(!dlLayoutCanvasPolyPath(g,pts,map)){g.restore();return;}g.clip();g.strokeStyle='#000';g.lineWidth=1;g.globalAlpha=.92;const step=8;for(let x=-H;x<W+H;x+=step){g.beginPath();g.moveTo(x,H);g.lineTo(x+H,0);g.stroke();}g.restore();}
function dlLayoutCanvasArrow(g,x,y,dir,size=7){g.save();g.strokeStyle='#000';g.lineWidth=1;g.beginPath();if(dir==='right'){g.moveTo(x,y);g.lineTo(x+size,y-size*.45);g.moveTo(x,y);g.lineTo(x+size,y+size*.45);}else if(dir==='left'){g.moveTo(x,y);g.lineTo(x-size,y-size*.45);g.moveTo(x,y);g.lineTo(x-size,y+size*.45);}else if(dir==='down'){g.moveTo(x,y);g.lineTo(x-size*.45,y+size);g.moveTo(x,y);g.lineTo(x+size*.45,y+size);}else{g.moveTo(x,y);g.lineTo(x-size*.45,y-size);g.moveTo(x,y);g.lineTo(x+size*.45,y-size);}g.stroke();g.restore();}
function dlLayoutCanvasText(g,text,x,y,size,{bold=false,align='left',rotate=0}={}){g.save();dlLayoutCanvasSetFont(g,size,{bold});g.textAlign=align;if(rotate){g.translate(x,y);g.rotate(rotate);g.fillText(String(text??''),0,0);}else g.fillText(String(text??''),x,y);g.restore();}
function dlLayoutCanvasPieces(g,model,map,{sheet=false,W=1800,H=1200}={}){
  const items=[...model.items].sort((a,b)=>a.depth-b.depth),line=sheet?1.35:1.9;
  for(const it of items){
    if(it.hidden&&!it.cut&&!dlLayoutState.showHidden)continue;
    const box=it.sectionBox||it.box,hull=it.cut&&it.sectionBox?[{u:box.minU,v:box.minV},{u:box.maxU,v:box.minV},{u:box.maxU,v:box.maxV},{u:box.minU,v:box.maxV}]:it.hull;
    if(it.cut&&dlLayoutState.showHatch)dlLayoutCanvasHatch(g,hull,map,W,H);
    else if(!it.hidden){g.save();g.fillStyle='#fff';if(dlLayoutCanvasPolyPath(g,hull,map))g.fill();g.restore();}
    if(it.cut&&it.sectionBox){g.save();g.strokeStyle='#000';g.lineWidth=sheet?2.8:3.8;if(dlLayoutCanvasPolyPath(g,hull,map))g.stroke();g.restore();}
    else for(const seg of it.segments){const hidden=!!seg.hidden;if(hidden&&!dlLayoutState.showHidden)continue;dlLayoutCanvasLine(g,map.sx(seg.a.u),map.sy(seg.a.v),map.sx(seg.b.u),map.sy(seg.b.v),{width:hidden?line*.72:line,dash:hidden?[8,5]:null,alpha:hidden?.55:1});}
  }
}
function dlLayoutCanvasDimensions(g,model,map,{sheet=false}={}){
  if(!dlLayoutModeHasDimensions())return;
  const b=model.bounds,font=sheet?12:15;
  for(const d of dlLayoutDimensionModel(model)){
    if(dlLayoutState.hiddenDims.has(d.id))continue;
    const off=d.overall?(sheet?30:55):(sheet?15:28),tick=sheet?6:8;
    if(d.axis==='u'){
      const y=map.sy(b.minV)+off,x1=map.sx(d.a),x2=map.sx(d.b),xm=(x1+x2)/2;
      dlLayoutCanvasLine(g,x1,y,x2,y);dlLayoutCanvasLine(g,x1,y-tick,x1,y+tick);dlLayoutCanvasLine(g,x2,y-tick,x2,y+tick);
      dlLayoutCanvasArrow(g,x1,y,'right',sheet?5:7);dlLayoutCanvasArrow(g,x2,y,'left',sheet?5:7);
      g.save();g.fillStyle='#fff';g.fillRect(xm-23,y-font-1,46,font+6);g.restore();dlLayoutCanvasText(g,d.text,xm,y-3,font,{align:'center'});
    }else{
      const x=map.sx(b.minU)-off,y1=map.sy(d.a),y2=map.sy(d.b),ym=(y1+y2)/2;
      dlLayoutCanvasLine(g,x,y1,x,y2);dlLayoutCanvasLine(g,x-tick,y1,x+tick,y1);dlLayoutCanvasLine(g,x-tick,y2,x+tick,y2);
      dlLayoutCanvasArrow(g,x,y1,'down',sheet?5:7);dlLayoutCanvasArrow(g,x,y2,'up',sheet?5:7);
      g.save();g.translate(x-5,ym);g.rotate(-Math.PI/2);g.fillStyle='#fff';g.fillRect(-23,-font,46,font+6);g.restore();dlLayoutCanvasText(g,d.text,x-5,ym-3,font,{align:'center',rotate:-Math.PI/2});
    }
  }
}
function dlLayoutCanvasSectionMarks(g,model,map,{sheet=false}={}){
  if(model.view!=='front'||!dlLayoutModeShowsSections())return;
  const b=model.bounds,font=sheet?13:17,x=map.sx(model.sectionX),yt=map.sy(b.maxV),yb=map.sy(b.minV),y=map.sy(model.sectionY),xl=map.sx(b.minU),xr=map.sx(b.maxU),dash=[14,5,3,5];
  dlLayoutCanvasLine(g,x,yt,x,yb,{width:sheet?1.35:1.8,dash});dlLayoutCanvasLine(g,xl,y,xr,y,{width:sheet?1.35:1.8,dash});
  dlLayoutCanvasText(g,'A',x+6,yt+font,font,{bold:true});dlLayoutCanvasText(g,'A',x+6,yb-5,font,{bold:true});dlLayoutCanvasText(g,'B',xl+5,y-6,font,{bold:true});dlLayoutCanvasText(g,'B',xr-font,y-6,font,{bold:true});
}
function dlLayoutCanvasLabels(g,model,map,{sheet=false}={}){
  if(!dlLayoutState.showLabels)return;const font=sheet?11:14,r=sheet?9:12;
  model.items.filter(it=>!it.hidden||it.cut).slice(0,60).forEach((it,k)=>{const box=it.sectionBox||it.box,cx=(box.minU+box.maxU)/2,cy=(box.minV+box.maxV)/2,x=map.sx(cx),y=map.sy(cy),dx=(k%2?1:-1)*(sheet?18:26),dy=((k%3)-1)*(sheet?12:18),lx=x+dx,ly=y+dy;dlLayoutCanvasLine(g,x,y,lx,ly);g.save();g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=1.4;g.beginPath();g.arc(lx,ly,r,0,Math.PI*2);g.fill();g.stroke();g.restore();dlLayoutCanvasText(g,it.index+1,lx,ly+font*.32,font,{bold:true,align:'center'});if(!sheet)dlLayoutCanvasText(g,String(it.name||`Peça ${it.index+1}`).slice(0,26),lx+r+5,ly+font*.32,font-1);});
}
function dlLayoutCanvasView(g,view,rect,ctx,{sheet=false,W=1800,H=1200}={}){
  const model=dlLayoutModel(view,ctx),map=dlLayoutViewMap(model,rect,{sheet}),title=DL_LAYOUT_VIEWS[view]||view,sub=view==='sectionX'?`X = ${dlLayoutMmText(model.sectionX-model.worldBounds.minX)} mm`:view==='sectionY'?`Y = ${dlLayoutMmText(model.sectionY-model.worldBounds.minY)} mm`:'';
  const titleY=rect.y+(sheet?30:42);g.save();g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=sheet?1:1.25;g.fillRect(rect.x,rect.y,rect.w,rect.h);g.strokeRect(rect.x+.5,rect.y+.5,rect.w-1,rect.h-1);g.restore();dlLayoutCanvasLine(g,rect.x,titleY,rect.x+rect.w,titleY,{width:.75});dlLayoutCanvasText(g,title,rect.x+12,rect.y+(sheet?20:28),sheet?15:20,{bold:true});if(sub)dlLayoutCanvasText(g,sub,rect.x+rect.w-12,rect.y+(sheet?20:28),sheet?11:13,{align:'right'});dlLayoutCanvasPieces(g,model,map,{sheet,W,H});dlLayoutCanvasSectionMarks(g,model,map,{sheet});dlLayoutCanvasDimensions(g,model,map,{sheet});dlLayoutCanvasLabels(g,model,map,{sheet});
}
function dlLayoutCanvasSheet(g,ctx,W,H){
  const titleH=132,gap=16,top=16,usableH=H-titleH-top*2,cellW=(W-gap*5)/4,cellH=(usableH-gap*3)/2,views=['front','frontOpen','top','right','left','perspective','sectionX','sectionY'];
  views.forEach((v,i)=>{const col=i%4,row=Math.floor(i/4);dlLayoutCanvasView(g,v,{x:gap+(cellW+gap)*col,y:top+(cellH+gap)*row,w:cellW,h:cellH},ctx,{sheet:true,W,H});});
  const y=H-titleH;g.save();g.fillStyle='#fff';g.strokeStyle='#111';g.lineWidth=1.5;g.fillRect(18,y,W-36,titleH-14);g.strokeRect(18,y,W-36,titleH-14);g.restore();dlLayoutCanvasLine(g,W*.55,y,W*.55,H-14);dlLayoutCanvasLine(g,W*.78,y,W*.78,H-14);
  dlLayoutCanvasText(g,dlLayoutProjectTitle(ctx),34,y+26,22,{bold:true});dlLayoutCanvasText(g,`${ctx.label} · ${ctx.pieces.length} peça(s)`,34,y+48,13);
  const legend=ctx.pieces.slice(0,12).map((o,i)=>`${i+1} · ${String(o.userData?.name||`Peça ${i+1}`).slice(0,18)}`);legend.slice(0,6).forEach((t,i)=>dlLayoutCanvasText(g,t,34+i*153,y+75,11));legend.slice(6,12).forEach((t,i)=>dlLayoutCanvasText(g,t,34+i*153,y+96,11));if(ctx.pieces.length>12)dlLayoutCanvasText(g,`+ ${ctx.pieces.length-12} peça(s) na legenda completa do DesignLab`,34,y+116,10);
  dlLayoutCanvasText(g,`DesignLabMoveis ${DL_LAYOUT_VERSION}`,W*.55+18,y+30,16,{bold:true});dlLayoutCanvasText(g,`Layout ${dlLayoutModeLabel()}`,W*.55+18,y+57,14);dlLayoutCanvasText(g,dlLayoutSheetNote(),W*.55+18,y+84,12);dlLayoutCanvasText(g,`Escala ${dlLayoutScaleText()}`,W*.78+18,y+30,16);dlLayoutCanvasText(g,new Date().toLocaleDateString('pt-BR'),W*.78+18,y+57,14);dlLayoutCanvasText(g,`Folha ${dlLayoutState.page} horizontal`,W*.78+18,y+84,12);
}
function dlLayoutBuildDirectCanvas(scale=1){
  const ctx=dlLayoutState.lastContext||dlLayoutContext(),baseW=dlLayoutState.view==='sheet'?1800:1400,baseH=dlLayoutState.view==='sheet'?1200:960,c=document.createElement('canvas');c.width=Math.max(1,Math.round(baseW*scale));c.height=Math.max(1,Math.round(baseH*scale));const g=c.getContext('2d',{alpha:false});g.setTransform(scale,0,0,scale,0,0);g.fillStyle='#fff';g.fillRect(0,0,baseW,baseH);g.lineCap='butt';g.lineJoin='miter';g.imageSmoothingEnabled=true;if(dlLayoutState.view==='sheet')dlLayoutCanvasSheet(g,ctx,baseW,baseH);else dlLayoutCanvasView(g,dlLayoutState.view,{x:22,y:22,w:baseW-44,h:baseH-44},ctx,{sheet:false,W:baseW,H:baseH});return c;
}
function dlLayoutPaintPreviewBitmap(wrap,svg,W,H){
  const token=++dlLayoutState.renderToken;
  try{
    const c=dlLayoutBuildDirectCanvas(1);if(token!==dlLayoutState.renderToken)return;
    const holder=document.createElement('div');holder.className='layoutPreviewImageHolder';const preview=document.createElement('img');preview.id='technicalLayoutPreviewSurface';preview.className='layoutPreviewImage';preview.alt='Layout técnico CAD em papel branco';preview.width=c.width;preview.height=c.height;preview.src=c.toDataURL('image/png');holder.appendChild(preview);wrap.replaceChildren(holder);
  }catch(err){console.error('Layout Canvas direto:',err);wrap.innerHTML='<div class="layoutEmpty">Não foi possível desenhar a prévia.</div>';}
}
function dlLayoutRender(){
  const wrap=$('layoutSvgWrap');if(!wrap)return;
  const ctx=dlLayoutContext();dlLayoutState.lastContext=ctx;dlLayoutState.lastMappings=[];dlLayoutState.dimHits=[];
  if(!ctx.pieces.length){wrap.innerHTML='<div class="layoutEmpty">Não há peças para gerar o layout.</div>';return;}
  dlLayoutUpdateSectionUi(ctx);dlLayoutUpdateLegend(ctx);
  const pack=dlLayoutState.view==='sheet'?dlLayoutRenderSheet(ctx):dlLayoutRenderSingle(ctx,dlLayoutState.view);
  const svg=`<svg id="technicalLayoutSvg" xmlns="http://www.w3.org/2000/svg" width="${pack.W}" height="${pack.H}" viewBox="0 0 ${pack.W} ${pack.H}" role="img" aria-label="Layout técnico"><rect width="100%" height="100%" fill="#fff"/>${dlLayoutSvgDefs()}${pack.body}</svg>`;
  dlLayoutState.lastSvg=svg;dlLayoutState.lastWidth=pack.W;dlLayoutState.lastHeight=pack.H;
  // 1.200.18: a prévia é rasterizada em CANVAS. O Chrome/Samsung com
  // "modo escuro para sites" alterava as cores do SVG DOM e transformava o
  // papel branco em cinza. Pixels do canvas não recebem essa transformação.
  dlLayoutPaintPreviewBitmap(wrap,svg,pack.W,pack.H);
  const status=$('layoutStatus');if(status)status.textContent=`${ctx.label} · ${ctx.pieces.length} peça(s) · ${DL_LAYOUT_VIEWS[dlLayoutState.view]} · escala ${dlLayoutScaleText()}`;
  document.querySelectorAll('[data-layout-view-btn]').forEach(b=>b.classList.toggle('active',b.dataset.layoutViewBtn===dlLayoutState.view));
}
function openTechnicalLayoutDialog(){
  dlLayoutPopulateScope(true);dlLayoutState.hiddenDims.clear();dlLayoutState.pickSection=null;
  let savedProfile='marcenaria';try{savedProfile=localStorage.getItem('designlabLayoutProfile')||'marcenaria';}catch{}
  dlLayoutSetProfile(savedProfile,{render:false});
  const dlg=$('technicalLayoutDialog');if(!dlg)return;
  dlg.classList.add('show');dlg.style.display='flex';
  setToolDockOpen?.(false);if($('morePanel'))$('morePanel').style.display='none';if($('spaceMoreDialog'))$('spaceMoreDialog').style.display='none';
  dlLayoutRender();
}
function closeTechnicalLayoutDialog(){const dlg=$('technicalLayoutDialog');if(dlg){dlg.classList.remove('show');dlg.style.display='none';}dlLayoutState.pickSection=null;}
function dlLayoutSetMode(mode){
  dlLayoutState.mode=mode==='presentation'?'presentation':(mode==='cleanprint'?'cleanprint':'technical');
  if(dlLayoutState.mode==='presentation'){
    dlLayoutState.showHidden=false;dlLayoutState.showHatch=false;dlLayoutState.showDimensions=false;dlLayoutState.showLabels=false;
  }else if(dlLayoutState.mode==='cleanprint'){
    dlLayoutState.showHidden=false;dlLayoutState.showHatch=false;dlLayoutState.showDimensions=true;dlLayoutState.showLabels=false;
  }else{
    dlLayoutState.showHidden=true;dlLayoutState.showHatch=true;dlLayoutState.showDimensions=true;dlLayoutState.showLabels=true;
  }
  $('layoutShowHidden').checked=dlLayoutState.showHidden;$('layoutShowHatch').checked=dlLayoutState.showHatch;$('layoutShowDimensions').checked=dlLayoutState.showDimensions;$('layoutShowLabels').checked=dlLayoutState.showLabels;
  dlLayoutRender();
}
function dlLayoutPickSection(axis){
  dlLayoutState.pickSection=axis;$('layoutViewFront').click();
  const info=$('layoutPickInfo');if(info)info.textContent=axis==='x'?'Toque na vista frontal para posicionar o corte A-A.':'Toque na vista frontal para posicionar o corte B-B.';
  toast(axis==='x'?'Toque na vista frontal onde deseja o corte A-A':'Toque na vista frontal onde deseja o corte B-B');
}
function dlLayoutHandleSvgClick(e){
  const canvas=$('technicalLayoutPreviewSurface')||$('technicalLayoutCanvas');if(!canvas)return;
  const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  const x=(e.clientX-r.left)*(dlLayoutState.lastWidth/r.width),y=(e.clientY-r.top)*(dlLayoutState.lastHeight/r.height);
  const dim=dlLayoutState.dimHits.find(h=>x>=h.x1&&x<=h.x2&&y>=h.y1&&y<=h.y2);
  if(dim&&!dlLayoutState.pickSection){dlLayoutState.hiddenDims.add(dim.id);dlLayoutRender();return;}
  if(!dlLayoutState.pickSection)return;
  const map=dlLayoutState.lastMappings.find(m=>m.view==='front'&&x>=m.rect.x&&x<=m.rect.x+m.rect.w&&y>=m.rect.y&&y<=m.rect.y+m.rect.h);
  if(!map){toast('Toque dentro da vista frontal');return;}
  const ctx=dlLayoutState.lastContext,b=ctx.bounds;
  if(dlLayoutState.pickSection==='x')dlLayoutState.sectionXPct=Math.max(0,Math.min(100,(map.invU(x)-b.minX)/(Math.max(1,b.maxX-b.minX))*100));
  else dlLayoutState.sectionYPct=Math.max(0,Math.min(100,(map.invV(y)-b.minY)/(Math.max(1,b.maxY-b.minY))*100));
  dlLayoutState.pickSection=null;if($('layoutPickInfo'))$('layoutPickInfo').textContent='Clique em uma cota para ocultá-la. Use “Restaurar cotas” para trazer de volta.';dlLayoutRender();
}
function dlLayoutFileBase(){const ctx=dlLayoutState.lastContext||dlLayoutContext(),view=DL_LAYOUT_VIEWS[dlLayoutState.view]||'layout';return safeFileName?.(`${dlLayoutProjectTitle(ctx)}-${view}`,'layout')||'layout';}
function dlLayoutDownloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
function dlLayoutExportSvg(){if(!dlLayoutState.lastSvg)dlLayoutRender();downloadText(`${dlLayoutFileBase()}.svg`,dlLayoutState.lastSvg,'image/svg+xml;charset=utf-8');}
async function dlLayoutSvgCanvas({jpeg=false}={}){
  if(!dlLayoutState.lastContext)dlLayoutRender();
  const maxPx=jpeg?3000:3400,baseW=dlLayoutState.view==='sheet'?1800:1400,baseH=dlLayoutState.view==='sheet'?1200:960,scale=Math.max(1,Math.min(2,maxPx/Math.max(baseW,baseH)));
  return dlLayoutBuildDirectCanvas(scale);
}
async function dlLayoutExportPng(){
  try{const c=await dlLayoutSvgCanvas();const blob=await new Promise(res=>c.toBlob(res,'image/png'));if(!blob)throw new Error('PNG indisponível');dlLayoutDownloadBlob(`${dlLayoutFileBase()}.png`,blob);}catch(err){toast(err.message||'Não foi possível gerar PNG');}
}
function dlLayoutConcatBytes(parts){let len=0;for(const p of parts)len+=typeof p==='string'?new TextEncoder().encode(p).length:p.length;const out=new Uint8Array(len);let off=0;for(const p0 of parts){const p=typeof p0==='string'?new TextEncoder().encode(p0):p0;out.set(p,off);off+=p.length;}return out;}
function dlLayoutCanvasJpegData(c,quality=.96){
  const data=c.toDataURL('image/jpeg',quality),bin=atob(data.split(',')[1]),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return {bytes,width:c.width,height:c.height};
}
function dlLayoutPdfWithJpegs(images,page='A4'){
  const pagePt=page==='A3'?{w:1190.55,h:841.89}:{w:841.89,h:595.28},margin=22,n=Math.max(1,images.length),objects=[];
  const pageRefs=[];
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  for(let i=0;i<n;i++)pageRefs.push(`${3+i*3} 0 R`);
  objects[2]=`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${n} >>`;
  for(let i=0;i<n;i++){
    const img=images[i],pageObj=3+i*3,imgObj=pageObj+1,contentObj=pageObj+2;
    const fit=Math.min((pagePt.w-margin*2)/img.width,(pagePt.h-margin*2)/img.height),dw=img.width*fit,dh=img.height*fit,dx=(pagePt.w-dw)/2,dy=(pagePt.h-dh)/2;
    objects[pageObj]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pagePt.w.toFixed(2)} ${pagePt.h.toFixed(2)}] /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[imgObj]={head:`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`,bin:img.bytes,tail:'\nendstream'};
    const stream=`q\n${dw.toFixed(3)} 0 0 ${dh.toFixed(3)} ${dx.toFixed(3)} ${dy.toFixed(3)} cm\n/Im0 Do\nQ\n`;
    objects[contentObj]=`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`;
  }
  const maxObj=2+n*3,chunks=['%PDF-1.4\n%âãÏÓ\n'],offsets=[0];let total=new TextEncoder().encode(chunks[0]).length;
  for(let i=1;i<=maxObj;i++){
    offsets[i]=total;const pre=`${i} 0 obj\n`,post='\nendobj\n';chunks.push(pre);total+=new TextEncoder().encode(pre).length;
    const obj=objects[i];if(typeof obj==='string'){chunks.push(obj);total+=new TextEncoder().encode(obj).length;}else{chunks.push(obj.head,obj.bin,obj.tail);total+=new TextEncoder().encode(obj.head).length+obj.bin.length+new TextEncoder().encode(obj.tail).length;}
    chunks.push(post);total+=new TextEncoder().encode(post).length;
  }
  const xref=total;let xs=`xref\n0 ${maxObj+1}\n0000000000 65535 f \n`;for(let i=1;i<=maxObj;i++)xs+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;xs+=`trailer\n<< /Size ${maxObj+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  chunks.push(xs);return new Blob([dlLayoutConcatBytes(chunks)],{type:'application/pdf'});
}
function dlLayoutWithTemporaryState(patch,fn){
  const keys=Object.keys(patch),saved={};for(const k of keys)saved[k]=dlLayoutState[k];
  try{Object.assign(dlLayoutState,patch);return fn();}finally{Object.assign(dlLayoutState,saved);}
}
function dlLayoutPdfWithJpeg(jpegBytes,imgW,imgH,page='A4'){
  const pagePt=page==='A3'?{w:1190.55,h:841.89}:{w:841.89,h:595.28},margin=22,fit=Math.min((pagePt.w-margin*2)/imgW,(pagePt.h-margin*2)/imgH),dw=imgW*fit,dh=imgH*fit,dx=(pagePt.w-dw)/2,dy=(pagePt.h-dh)/2;
  const objects=[];
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pagePt.w.toFixed(2)} ${pagePt.h.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`;
  objects[4]={head:`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,bin:jpegBytes,tail:'\nendstream'};
  const stream=`q\n${dw.toFixed(3)} 0 0 ${dh.toFixed(3)} ${dx.toFixed(3)} ${dy.toFixed(3)} cm\n/Im0 Do\nQ\n`;
  objects[5]=`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`;
  const chunks=['%PDF-1.4\n%âãÏÓ\n'],offsets=[0];let total=new TextEncoder().encode(chunks[0]).length;
  for(let i=1;i<=5;i++){
    offsets[i]=total;const pre=`${i} 0 obj\n`,post='\nendobj\n';chunks.push(pre);total+=new TextEncoder().encode(pre).length;
    const obj=objects[i];if(typeof obj==='string'){chunks.push(obj);total+=new TextEncoder().encode(obj).length;}else{chunks.push(obj.head,obj.bin,obj.tail);total+=new TextEncoder().encode(obj.head).length+obj.bin.length+new TextEncoder().encode(obj.tail).length;}
    chunks.push(post);total+=new TextEncoder().encode(post).length;
  }
  const xref=total;let xs='xref\n0 6\n0000000000 65535 f \n';for(let i=1;i<=5;i++)xs+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;xs+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  chunks.push(xs);return new Blob([dlLayoutConcatBytes(chunks)],{type:'application/pdf'});
}
async function dlLayoutExportPdf(){
  try{
    if(dlLayoutState.profile==='production'&&dlLayoutState.view==='sheet'){
      const technical=dlLayoutWithTemporaryState({mode:'technical',showHidden:true,showHatch:true,showDimensions:true,showLabels:true,visibleDimsOnly:true},()=>dlLayoutCanvasJpegData(dlLayoutBuildDirectCanvas(1.65)));
      const clean=dlLayoutWithTemporaryState({mode:'cleanprint',showHidden:false,showHatch:false,showDimensions:true,showLabels:false,visibleDimsOnly:true},()=>dlLayoutCanvasJpegData(dlLayoutBuildDirectCanvas(1.65)));
      const pdf=dlLayoutPdfWithJpegs([technical,clean],dlLayoutState.page);
      dlLayoutDownloadBlob(`${dlLayoutFileBase()}-producao-2-folhas.pdf`,pdf);
      toast('PDF de produção gerado com 2 páginas: técnica + limpa');
      return;
    }
    const c=await dlLayoutSvgCanvas({jpeg:true}),img=dlLayoutCanvasJpegData(c),pdf=dlLayoutPdfWithJpegs([img],dlLayoutState.page);
    dlLayoutDownloadBlob(`${dlLayoutFileBase()}.pdf`,pdf);
  }catch(err){console.error(err);toast(err.message||'Não foi possível gerar PDF');}
}
function dlLayoutDxfHeader(){return '0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nSECTION\r\n2\r\nENTITIES\r\n';}
function dlLayoutDxfLine(layer,x1,y1,x2,y2){return `0\r\nLINE\r\n8\r\n${layer}\r\n10\r\n${dlLayoutNum(x1,3)}\r\n20\r\n${dlLayoutNum(y1,3)}\r\n30\r\n0\r\n11\r\n${dlLayoutNum(x2,3)}\r\n21\r\n${dlLayoutNum(y2,3)}\r\n31\r\n0\r\n`;}
function dlLayoutDxfText(layer,x,y,text,h=12){return `0\r\nTEXT\r\n8\r\n${layer}\r\n10\r\n${dlLayoutNum(x,3)}\r\n20\r\n${dlLayoutNum(y,3)}\r\n30\r\n0\r\n40\r\n${h}\r\n1\r\n${dlLayoutAscii(text)}\r\n`;}
function dlLayoutDxfView(view,ctx,offsetX=0,offsetY=0){
  const model=dlLayoutModel(view,ctx),b=model.bounds,out=[];
  for(const it of model.items){
    if(it.hidden&&!it.cut&&!dlLayoutState.showHidden)continue;
    const layer=it.cut?'CORTE':(it.hidden?'LINHA_OCULTA':'CONTORNO_VISIVEL');
    for(const s of it.segments)out.push(dlLayoutDxfLine(layer,s.a.u-b.minU+offsetX,s.a.v-b.minV+offsetY,s.b.u-b.minU+offsetX,s.b.v-b.minV+offsetY));
    if(it.cut&&it.sectionBox){const q=it.sectionBox,p=[[q.minU,q.minV],[q.maxU,q.minV],[q.maxU,q.maxV],[q.minU,q.maxV],[q.minU,q.minV]];for(let i=0;i<4;i++)out.push(dlLayoutDxfLine('CORTE',p[i][0]-b.minU+offsetX,p[i][1]-b.minV+offsetY,p[i+1][0]-b.minU+offsetX,p[i+1][1]-b.minV+offsetY));}
  }
  out.push(dlLayoutDxfText('TEXTO',offsetX,offsetY+(b.maxV-b.minV)+25,DL_LAYOUT_VIEWS[view],14));
  if(dlLayoutState.showLabels)for(const it of model.items.filter(x=>!x.hidden||x.cut)){
    const q=it.sectionBox||it.box,tx=(q.minU+q.maxU)/2-b.minU+offsetX,ty=(q.minV+q.maxV)/2-b.minV+offsetY;
    out.push(dlLayoutDxfText('TEXTO',tx,ty,`${it.index+1} - ${it.name}`,10));
  }
  if(dlLayoutModeHasDimensions()){
    for(const d of dlLayoutDimensionModel(model)){
      if(dlLayoutState.hiddenDims.has(d.id))continue;
      const off=d.overall?55:28;
      if(d.axis==='u'){
        const y=offsetY-off,x1=d.a-b.minU+offsetX,x2=d.b-b.minU+offsetX;
        out.push(dlLayoutDxfLine('COTAS',x1,y,x2,y),dlLayoutDxfLine('COTAS',x1,y-5,x1,y+5),dlLayoutDxfLine('COTAS',x2,y-5,x2,y+5),dlLayoutDxfText('COTAS',(x1+x2)/2,y+7,d.text,9));
      }else{
        const x=offsetX-off,y1=d.a-b.minV+offsetY,y2=d.b-b.minV+offsetY;
        out.push(dlLayoutDxfLine('COTAS',x,y1,x,y2),dlLayoutDxfLine('COTAS',x-5,y1,x+5,y1),dlLayoutDxfLine('COTAS',x-5,y2,x+5,y2),dlLayoutDxfText('COTAS',x+7,(y1+y2)/2,d.text,9));
      }
    }
  }
  if(view==='front'&&dlLayoutModeShowsSections()){
    const sx=model.sectionX-b.minU+offsetX,sy=model.sectionY-b.minV+offsetY,w=b.maxU-b.minU,h=b.maxV-b.minV;
    out.push(dlLayoutDxfLine('LINHA_CORTE',sx,offsetY,sx,offsetY+h),dlLayoutDxfText('LINHA_CORTE',sx+5,offsetY+h-10,'A',10),dlLayoutDxfText('LINHA_CORTE',sx+5,offsetY+5,'A',10));
    out.push(dlLayoutDxfLine('LINHA_CORTE',offsetX,sy,offsetX+w,sy),dlLayoutDxfText('LINHA_CORTE',offsetX+5,sy+5,'B',10),dlLayoutDxfText('LINHA_CORTE',offsetX+w-10,sy+5,'B',10));
  }
  return {text:out.join(''),w:b.maxU-b.minU,h:b.maxV-b.minV};
}
function dlLayoutExportDxf(){
  const ctx=dlLayoutState.lastContext||dlLayoutContext();let out=dlLayoutDxfHeader();
  if(dlLayoutState.view==='sheet'){
    const views=['front','frontOpen','top','right','left','perspective','sectionX','sectionY'];let x=0,y=0,rowH=0;
    views.forEach((v,i)=>{const r=dlLayoutDxfView(v,ctx,x,y);out+=r.text;x+=r.w+150;rowH=Math.max(rowH,r.h);if(i===3){x=0;y+=rowH+180;rowH=0;}});
  }else out+=dlLayoutDxfView(dlLayoutState.view,ctx).text;
  out+='0\r\nENDSEC\r\n0\r\nEOF\r\n';downloadText(`${dlLayoutFileBase()}.dxf`,out,'application/dxf;charset=us-ascii');
}
let dlLayoutPrintPreviewZoom=1;
function dlLayoutApplyPrintPreviewZoom(){
  const img=$('layoutPrintPreviewImage'),label=$('layoutPrintPreviewZoomLabel');if(!img)return;
  dlLayoutPrintPreviewZoom=Math.max(.35,Math.min(3,Number(dlLayoutPrintPreviewZoom)||1));
  img.style.width=`${Math.round(dlLayoutPrintPreviewZoom*100)}%`;
  if(label)label.textContent=`${Math.round(dlLayoutPrintPreviewZoom*100)}%`;
}
function dlLayoutFitPrintPreview(){
  const img=$('layoutPrintPreviewImage'),vp=$('layoutPrintPreviewViewport');if(!img||!vp)return;
  const natural=Number(img.naturalWidth)||Number(img.width)||1;
  const available=Math.max(120,vp.clientWidth-24);
  dlLayoutPrintPreviewZoom=Math.min(1,available/natural);
  dlLayoutApplyPrintPreviewZoom();
  vp.scrollTo({left:0,top:0,behavior:'auto'});
}
function openLayoutPrintPreview(){
  try{
    const dlg=$('layoutPrintPreviewDialog'),img=$('layoutPrintPreviewImage');if(!dlg||!img)return;
    const c=dlLayoutBuildDirectCanvas(1.75);
    img.onload=()=>requestAnimationFrame(dlLayoutFitPrintPreview);
    img.src=c.toDataURL('image/png');
    const viewName=({sheet:'Folha técnica',front:'Vista frontal',frontOpen:'Frente interna',top:'Planta baixa',left:'Lateral esquerda',right:'Lateral direita',back:'Vista traseira',bottom:'Vista inferior',perspective:'Perspectiva',sectionX:'Corte A-A',sectionY:'Corte B-B'})[dlLayoutState.view]||'Folha técnica';
    const scale=dlLayoutState.scale==='fit'?'escala automática':`escala 1:${dlLayoutState.scale}`;
    const info=$('layoutPrintPreviewInfo');if(info)info.textContent=`${viewName} · ${dlLayoutState.page} horizontal · ${scale}. Confira antes de imprimir.`;
    dlg.classList.add('show');dlg.style.display='flex';
    dlLayoutPrintPreviewZoom=1;
  }catch(err){console.error(err);toast('Não foi possível gerar a prévia de impressão');}
}
function closeLayoutPrintPreview(){
  const dlg=$('layoutPrintPreviewDialog');if(dlg){dlg.classList.remove('show');dlg.style.display='none';}
}
function dlLayoutPrintNow(){
  try{
    const c=dlLayoutBuildDirectCanvas(1.75),data=c.toDataURL('image/png'),w=window.open('','_blank');if(!w){toast('Permita pop-ups para imprimir');return;}
    w.document.write(`<!doctype html><html><head><title>${dlLayoutEsc(dlLayoutFileBase())}</title><style>@page{size:${dlLayoutState.page} landscape;margin:8mm}html,body{margin:0;background:#fff;color-scheme:only light}img{width:100%;height:auto;display:block;background:#fff}</style></head><body><img src="${data}" onload="setTimeout(()=>print(),250)"></body></html>`);w.document.close();
  }catch(err){console.error(err);toast('Não foi possível preparar a impressão');}
}
function dlLayoutPrint(){openLayoutPrintPreview();}

// ---------- Eventos da ferramenta ----------
$('closeTechnicalLayout')?.addEventListener('click',closeTechnicalLayoutDialog);
$('layoutToolBtn')?.addEventListener('click',()=>{openTechnicalLayoutDialog();});
$('spaceLayoutBtn')?.addEventListener('click',()=>{openTechnicalLayoutDialog();});
$('layoutScopeSelect')?.addEventListener('change',e=>{dlLayoutState.scopeValue=e.target.value;dlLayoutState.hiddenDims.clear();dlLayoutState.sectionXPct=50;dlLayoutState.sectionYPct=50;dlLayoutRender();});
$('layoutMode')?.addEventListener('change',e=>dlLayoutSetMode(e.target.value));
$('layoutProfile')?.addEventListener('change',e=>dlLayoutSetProfile(e.target.value));
$('layoutScale')?.addEventListener('change',e=>{dlLayoutState.scale=e.target.value;dlLayoutRender();});
$('layoutPage')?.addEventListener('change',e=>{dlLayoutState.page=e.target.value;dlLayoutRender();});
for(const [id,key] of [['layoutShowDimensions','showDimensions'],['layoutShowInternal','showInternal'],['layoutUsefulOnly','visibleDimsOnly'],['layoutShowLabels','showLabels'],['layoutShowHidden','showHidden'],['layoutShowHatch','showHatch'],['layoutHideDoors','hideDoors'],['layoutHideFronts','hideFronts']])$(id)?.addEventListener('change',e=>{dlLayoutState[key]=!!e.target.checked;dlLayoutRender();});
document.querySelectorAll('[data-layout-view-btn]').forEach(b=>b.addEventListener('click',()=>{dlLayoutState.view=b.dataset.layoutViewBtn;dlLayoutRender();}));
$('layoutSectionXPct')?.addEventListener('input',e=>{dlLayoutState.sectionXPct=Number(e.target.value)||0;dlLayoutRender();});
$('layoutSectionYPct')?.addEventListener('input',e=>{dlLayoutState.sectionYPct=Number(e.target.value)||0;dlLayoutRender();});
$('layoutPickSectionA')?.addEventListener('click',()=>dlLayoutPickSection('x'));
$('layoutPickSectionB')?.addEventListener('click',()=>dlLayoutPickSection('y'));
$('layoutRestoreDims')?.addEventListener('click',()=>{dlLayoutState.hiddenDims.clear();dlLayoutRender();});
$('layoutSvgWrap')?.addEventListener('click',dlLayoutHandleSvgClick);
$('layoutExportSvg')?.addEventListener('click',dlLayoutExportSvg);
$('layoutExportPng')?.addEventListener('click',dlLayoutExportPng);
$('layoutExportPdf')?.addEventListener('click',dlLayoutExportPdf);
$('layoutExportDxf')?.addEventListener('click',dlLayoutExportDxf);
$('layoutPrintPreview')?.addEventListener('click',openLayoutPrintPreview);
$('layoutPrint')?.addEventListener('click',dlLayoutPrint);
$('closeLayoutPrintPreview')?.addEventListener('click',closeLayoutPrintPreview);
$('layoutPrintPreviewBack')?.addEventListener('click',closeLayoutPrintPreview);
$('layoutPrintPreviewPdf')?.addEventListener('click',dlLayoutExportPdf);
$('layoutPrintPreviewConfirm')?.addEventListener('click',dlLayoutPrintNow);
$('layoutPrintPreviewMinus')?.addEventListener('click',()=>{dlLayoutPrintPreviewZoom-=.15;dlLayoutApplyPrintPreviewZoom();});
$('layoutPrintPreviewPlus')?.addEventListener('click',()=>{dlLayoutPrintPreviewZoom+=.15;dlLayoutApplyPrintPreviewZoom();});
$('layoutPrintPreviewFit')?.addEventListener('click',dlLayoutFitPrintPreview);
$('layoutPrintPreviewDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('layoutPrintPreviewDialog'))closeLayoutPrintPreview();});
$('technicalLayoutDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('technicalLayoutDialog'))closeTechnicalLayoutDialog();});
window.addEventListener('resize',()=>{if($('technicalLayoutDialog')?.classList.contains('show'))requestAnimationFrame(dlLayoutRender);});
