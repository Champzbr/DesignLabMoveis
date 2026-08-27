// ---------- v75: móvel curvo + 3 montantes obrigatórios + extras só na frente ----------
let curvedTargetRootId=null, curvedTargetCellId=null, curvedOrientation='front-right', curvedEditingExisting=false;
let curved3DPreviewActive=false, curved3DPreviewOriginalState=null, curved3DPreviewMeta=null;
function curvedSelectedTarget(){
  let root=null,cell=null;
  if(selectedSpaceCell){ root=getSpaceRoot(selectedSpaceCell.rootId); cell=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId); }
  if(!root && activeSpaceRootId) root=getSpaceRoot(activeSpaceRootId);
  if(!root && selected) root=rootForObject(selected);
  if(!root) return null;
  if(cell){
    return {root,cell,width:cell.maxX-cell.minX,depth:cell.maxZ-cell.minZ,height:cell.maxY-cell.minY,x:(cell.minX+cell.maxX)/2,z:(cell.minZ+cell.maxZ)/2,yBase:cell.minY,label:`${root.name} · divisão`};
  }
  return {root,cell:null,width:root.width,depth:root.depth,height:root.height,x:root.x,z:root.z,yBase:root.yBase,label:`${root.name} · espaço completo`};
}
function curvedTargetFromStored(){
  const root=curvedTargetRootId?getSpaceRoot(curvedTargetRootId):null;
  if(!root)return null;
  const cell=curvedTargetCellId?getSpaceCell(root.id,curvedTargetCellId):null;
  if(cell)return {root,cell,width:cell.maxX-cell.minX,depth:cell.maxZ-cell.minZ,height:cell.maxY-cell.minY,x:(cell.minX+cell.maxX)/2,z:(cell.minZ+cell.maxZ)/2,yBase:cell.minY,label:`${root.name} · divisão`};
  return {root,cell:null,width:root.width,depth:root.depth,height:root.height,x:root.x,z:root.z,yBase:root.yBase,label:`${root.name} · espaço completo`};
}
function curvedOrientationName(v){
  return v==='front-left'?'Frente esquerda'
    :v==='back-left'?'Trás esquerda'
    :v==='back-right'?'Trás direita'
    :'Frente direita';
}
function curvedTransformPointMm(cfg,x,z){
  const W=Number(cfg.targetW)||(Number(cfg.straightA)+Number(cfg.radius));
  const D=Number(cfg.targetD)||(Number(cfg.radius)+Number(cfg.straightB));
  const o=cfg.orientation||'front-right';
  if(o==='front-left'||o==='back-left')x=W-x;
  if(o==='back-left'||o==='back-right')z=D-z;
  return {x,z};
}
function curvedTransformVector(cfg,tx,tz){
  const o=cfg.orientation||'front-right';
  if(o==='front-left'||o==='back-left')tx=-tx;
  if(o==='back-left'||o==='back-right')tz=-tz;
  return {tx,tz};
}
function curvedCoverOffsetMm(cfg){
  return cfg.createCover===false?0:Math.max(0,Number(cfg.coverThickness)||0);
}
function curvedProfilePointsMm(cfg,part='full'){
  const a=Math.max(0,Number(cfg.straightA)||0), b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500), cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover), band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50)), Rin=Rout-band;
  const seg=Math.max(160,Math.min(320,Math.ceil(R/2.5))), pts=[];
  const split=(part==='full')?0:curvedSplitInfo(cfg).splitX;
  if(part==='straight'){
    if(split<=.001)return [];
    pts.push([0,cover],[split,cover],[split,cover+band],[0,cover+band]);
  }else{
    const x0=part==='curve'?split:0;
    pts.push([x0,cover],[a,cover]);
    for(let i=1;i<=seg;i++){
      const ang=-Math.PI/2+(Math.PI/2)*(i/seg);
      pts.push([a+Rout*Math.cos(ang),R+Rout*Math.sin(ang)]);
    }
    if(b>.001)pts.push([a+Rout,R+b],[a+Rin,R+b]);
    else pts.push([a+Rin,R]);
    if(b>.001)pts.push([a+Rin,R]);
    for(let i=1;i<=seg;i++){
      const ang=0-(Math.PI/2)*(i/seg);
      pts.push([a+Rin*Math.cos(ang),R+Rin*Math.sin(ang)]);
    }
    pts.push([x0,cover+band]);
  }
  return pts.map(([x,z])=>{const p=curvedTransformPointMm(cfg,x,z);return [p.x,p.z];});
}
function curvedPathSampleMm(cfg,t){
  const a=Math.max(0,Number(cfg.straightA)||0), b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500), cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover), band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50));
  const rc=Math.max(.5,Rout-band/2), arc=rc*Math.PI/2, total=a+arc+b, s=THREE.MathUtils.clamp(Number(t)||0,0,1)*total;
  let x,z,tx,tz,segment;
  if(s<=a){x=s;z=cover+band/2;tx=1;tz=0;segment='straightA';}
  else if(s<=a+arc){
    const q=(s-a)/arc, ang=-Math.PI/2+q*Math.PI/2;
    x=a+rc*Math.cos(ang);z=R+rc*Math.sin(ang);tx=-Math.sin(ang);tz=Math.cos(ang);segment='curve';
  }else{x=a+rc;z=R+(s-a-arc);tx=0;tz=1;segment='straightB';}
  const nx=-tz,nz=tx;
  const p=curvedTransformPointMm(cfg,x,z),v=curvedTransformVector(cfg,tx,tz),n=curvedTransformVector(cfg,nx,nz);
  return {x:p.x,z:p.z,phi:Math.atan2(v.tz,v.tx),tx:v.tx,tz:v.tz,nx:n.tx,nz:n.tz,segment,s,total};
}
function curvedPathTotalMm(cfg){
  const a=Math.max(0,Number(cfg.straightA)||0), b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500), cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover), band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50));
  return a+Math.max(.5,Rout-band/2)*Math.PI/2+b;
}
function curvedPathMetricsMm(cfg){
  const a=Math.max(0,Number(cfg.straightA)||0),b=Math.max(0,Number(cfg.straightB)||0);
  const R=Math.max(10,Number(cfg.radius)||500),cover=curvedCoverOffsetMm(cfg);
  const Rout=Math.max(1,R-cover),band=Math.max(1,Math.min(Rout-1,Number(cfg.band)||50));
  const rc=Math.max(.5,Rout-band/2),arc=rc*Math.PI/2,total=a+arc+b;
  return {a,b,R,cover,Rout,band,rc,arc,total};
}
function curvedSampleAtDistanceMm(cfg,s,tag=null){
  const m=curvedPathMetricsMm(cfg),ss=THREE.MathUtils.clamp(Number(s)||0,0,m.total);
  const sample=curvedPathSampleMm(cfg,m.total>0?ss/m.total:0);
  sample.s=ss;
  if(tag){sample.structuralTag=tag;sample.segment='curve';}
  return sample;
}
const CURVED_CURVE_END_INSET_MM=17;
const CURVED_END_A_INSET_MM=0;
const CURVED_END_B_INSET_MM=0;
function curvedPostSamplesMm(cfg){
  const m=curvedPathMetricsMm(cfg),T=Math.max(1,Number(cfg.thickness)||18);
  const requested=Math.max(4,Math.round(Number(cfg.posts)||5));
  const samples=[];
  const push=(s,tag=null,forceSegment=null)=>{
    const sm=curvedSampleAtDistanceMm(cfg,s,tag);
    if(forceSegment)sm.segment=forceSegment;
    if(samples.some(v=>Math.abs(v.s-sm.s)<.25))return false;
    samples.push(sm);return true;
  };

  // v63 — as duas pontas do conjunto passam a ter distância configurável.
  // A medida é da BORDA do móvel até a BORDA do montante. 0 = rente.
  // Além delas permanecem as referências estruturais do arco: centro e final
  // recuado. Em 2 partes, o trecho de emenda continua totalmente livre.
  const curveStart=m.a,curveEnd=m.a+m.arc;
  const endAInset=Number.isFinite(Number(cfg.endAInset))?Math.max(0,Number(cfg.endAInset)):CURVED_END_A_INSET_MM;
  const endBInset=Number.isFinite(Number(cfg.endBInset))?Math.max(0,Number(cfg.endBInset)):CURVED_END_B_INSET_MM;
  const curveInset=Number.isFinite(Number(cfg.curveEndInset))?Math.max(0,Number(cfg.curveEndInset)):CURVED_CURVE_END_INSET_MM;
  const startCenter=Math.min(m.total,Math.max(0,endAInset+T/2));
  const finishCenter=Math.max(0,Math.min(m.total,m.total-endBInset-T/2));
  const curveCenterInset=curveInset+T/2;
  const curveEndCenter=Math.max(curveStart+T/2,curveEnd-Math.min(curveCenterInset,Math.max(0,m.arc/2-.25)));

  push(startCenter,'end-a',m.a>.001?'straightA':'curve');
  push(curveStart+m.arc/2,'curve-mid','curve');
  push(curveEndCenter,'curve-end-inset','curve');
  push(finishCenter,'end-b',m.b>.001?'straightB':'curve');

  let extras=Math.max(0,requested-samples.length);
  if(extras){
    const split=curvedSplitInfoBase(cfg);
    const upperA=Math.max(0,(cfg.splitStructure&&split.enabled&&split.valid?split.splitX:m.a));
    // Reserva o espaço já ocupado pelo montante final A.
    const lowerA=Math.min(upperA,Math.max(0,endAInset+T));
    const lengthA=Math.max(0,upperA-lowerA);
    // No lado B reserva a ponta ocupada pelo montante final B.
    const upperB=Math.max(curveEnd,Math.min(m.total,m.total-endBInset-T));
    const lowerB=curveEnd;
    const lengthB=Math.max(0,upperB-lowerB);

    const gapFor=(length,n)=>{
      const free=length-n*T;
      return free>=-.001?Math.max(0,free)/(n+1):-Infinity;
    };
    let best=null;
    for(let nA=0;nA<=extras;nA++){
      const nB=extras-nA,ga=gapFor(lengthA,nA),gb=gapFor(lengthB,nB);
      if(!Number.isFinite(ga)||!Number.isFinite(gb))continue;
      const score=Math.max(ga,gb)*100000+Math.abs(ga-gb)*100+Math.abs(nA-nB);
      if(!best||score<best.score-.001)best={nA,nB,score};
    }
    if(!best){
      let left=extras,nA=0,nB=0;
      while(left>0){
        const canA=Number.isFinite(gapFor(lengthA,nA+1)),canB=Number.isFinite(gapFor(lengthB,nB+1));
        if(!canA&&!canB)break;
        const ga=canA?gapFor(lengthA,nA+1):-1,gb=canB?gapFor(lengthB,nB+1):-1;
        if(gb>ga)nB++;else nA++;
        left--;
      }
      best={nA,nB};
    }
    if(best.nA>0){
      const g=gapFor(lengthA,best.nA);
      for(let i=0;i<best.nA;i++)push(lowerA+g+T/2+i*(T+g),'straight-a','straightA');
    }
    if(best.nB>0){
      const g=gapFor(lengthB,best.nB);
      for(let i=0;i<best.nB;i++)push(lowerB+g+T/2+i*(T+g),'straight-b','straightB');
    }
  }

  samples.sort((u,v)=>u.s-v.s);
  samples.forEach((v,i)=>v.postIndex=i);
  return samples;
}
function curvedPostSampleMm(cfg,index,count){
  // Compatibilidade com chamadas antigas: a lista usa as regras estruturais fixas da v58.
  const list=curvedPostSamplesMm({...cfg,posts:Math.max(3,Math.round(Number(count)||Number(cfg.posts)||5))});
  return list[Math.max(0,Math.min(list.length-1,Math.round(Number(index)||0)))]||curvedSampleAtDistanceMm(cfg,0);
}
function curvedSplitInfoBase(cfg){
  const a=Math.max(0,Number(cfg.straightA)||0);
  const tail=Math.max(0,Number(cfg.splitTail)||60);
  if(!cfg.splitStructure)return {enabled:false,valid:true,splitX:0,tail,lastPostIndex:-1,lastPost:null,straightLength:0,curveTail:a};
  // v58: a emenda fica no trecho reto antes da curva. O valor configurado
  // é preservado como trecho de emenda entre o corte e o começo do arco.
  const splitX=a-tail;
  return {
    enabled:true,
    valid:splitX>=20&&splitX<=a+.001,
    splitX,
    tail,
    lastPostIndex:-1,
    lastPost:null,
    outerEdge:a,
    straightLength:Math.max(0,splitX),
    curveTail:Math.max(0,a-splitX),
    reason:splitX<20?'Não há trecho reto suficiente para o espaço de emenda escolhido. Reduza a emenda ou aumente o trecho reto antes da curva.':''
  };
}
function curvedSplitInfo(cfg){
  const info=curvedSplitInfoBase(cfg);
  if(!info.enabled)return info;
  const list=curvedPostSamplesMm({...cfg,splitStructure:false});
  const before=list.filter(s=>s.s<info.splitX-.001);
  const ref=before.length?before[before.length-1]:null;
  return {...info,lastPostIndex:ref?list.indexOf(ref):-1,lastPost:ref};
}
function curvedPostPlacementFromSampleMm(cfg,sample){
  const band=Math.max(1,Number(cfg.band)||50),postWidth=Math.max(1,Number(cfg.postWidth)||100);
  const offset=(postWidth-band)/2;
  return {...sample,x:sample.x+sample.nx*offset,z:sample.z+sample.nz*offset,rotationY:Math.atan2(-sample.nz,sample.nx)};
}
function curvedPostPlacementMm(cfg,index,count){
  return curvedPostPlacementFromSampleMm(cfg,curvedPostSampleMm(cfg,index,count));
}
function curvedRotatePtsAround(anchor,pts,angle){
  const c=Math.cos(angle),s=Math.sin(angle),ax=anchor[0],ay=anchor[1];
  return (pts||[]).map(([x,y])=>{const dx=x-ax,dy=y-ay;return [ax+dx*c-dy*s,ay+dx*s+dy*c];});
}
function curvedDiagonalReliefSequence2D(cx,cy,dx,dy,px,py,diameter,length,steps=14){
  // v65 — comprimento é a penetração real além do canto e pode chegar a 0,5 mm.
  // O começo do canal fica dentro do encaixe; não forçamos mais o comprimento ao Ø da fresa.
  // Alívio diagonal (dog-bone) a 45°. O começo do canal fica dentro do
  // encaixe e somente a ponta avança para o material, por isso não aparece mais
  // como uma lingueta reta saindo pela frente da peça.
  const mag=Math.hypot(dx,dy)||1,pmag=Math.hypot(px,py)||1;
  dx/=mag;dy/=mag;px/=pmag;py/=pmag;
  const r=Math.max(.4,Number(diameter)||6)/2;
  const len=Math.max(.5,Number(length)||18);
  const sx=cx-dx*r,sy=cy-dy*r;
  const ex=cx+dx*(len-r),ey=cy+dy*(len-r);
  const startPlus=[sx+px*r,sy+py*r];
  const endPlus=[ex+px*r,ey+py*r];
  const endMinus=[ex-px*r,ey-py*r];
  const startMinus=[sx-px*r,sy-py*r];
  const seq=[startPlus,endPlus];
  for(let i=1;i<=steps;i++){
    const a=Math.PI*(i/steps);
    // +P -> +D -> -P: semicírculo da ponta, sempre voltado para fora do encaixe.
    const vx=px*Math.cos(a)+dx*Math.sin(a),vy=py*Math.cos(a)+dy*Math.sin(a);
    seq.push([ex+vx*r,ey+vy*r]);
  }
  seq.push(startMinus);
  return {seq,startPlus,startMinus,r,len,cornerOffset:Math.SQRT2*r};
}
function curvedPointInOrOnPolygonMm(point,poly,tol=.45){
  if(!Array.isArray(poly)||poly.length<3)return true;
  const x=Number(point?.[0]),y=Number(point?.[1]);
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const tol2=tol*tol;
  // Considera a própria borda como madeira válida. Isso evita falso negativo
  // nos encaixes que terminam exatamente no contorno da nervura.
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const ax=Number(poly[j]?.[0]),ay=Number(poly[j]?.[1]),bx=Number(poly[i]?.[0]),by=Number(poly[i]?.[1]);
    if(![ax,ay,bx,by].every(Number.isFinite))continue;
    const vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy;
    const t=den>1e-12?THREE.MathUtils.clamp(((x-ax)*vx+(y-ay)*vy)/den,0,1):0;
    const dx=x-(ax+vx*t),dy=y-(ay+vy*t);
    if(dx*dx+dy*dy<=tol2)return true;
  }
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=Number(poly[i]?.[0]),yi=Number(poly[i]?.[1]),xj=Number(poly[j]?.[0]),yj=Number(poly[j]?.[1]);
    if(![xi,yi,xj,yj].every(Number.isFinite))continue;
    const hit=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);
    if(hit)inside=!inside;
  }
  return inside;
}
function curvedReliefFitsWoodMm(relief,localToWorld,hostPolygon){
  if(!relief||typeof localToWorld!=='function'||!Array.isArray(hostPolygon)||hostPolygon.length<3)return true;
  // v64 — cada entrada é validada separadamente. Se qualquer trecho da cápsula
  // sair para fora do contorno da madeira, aquele alívio não é criado.
  return (relief.seq||[]).every(([u,v])=>curvedPointInOrOnPolygonMm(localToWorld(u,v),hostPolygon,.55));
}
function curvedSlotPolygonMm(cfg,sample,postThickness,clearance,visualInset=0,hostPolygon=null){
  const band=Math.max(1,Number(cfg.band)||50);
  const rawDepth=Math.min(band,Math.max(1,Number(cfg.jointDepth)||band/2));
  const inset=Math.max(0,Math.min(rawDepth/3,Number(visualInset)||0));
  const depth=Math.max(.2,rawDepth-inset*2),rawTw=Math.max(1,Number(postThickness)+Number(clearance||0)),tw=Math.max(.2,rawTw-inset*2);
  const tx=sample.tx,tz=sample.tz,nx=sample.nx,nz=sample.nz;
  const ht=tw/2;
  const deep=band/2-rawDepth+inset,outer=band/2-inset;
  const innerLimit=-band/2+inset;
  const local=(u,v)=>[sample.x+tx*u+nx*v,sample.z+tz*u+nz*v];
  const mode=['single','double','none'].includes(cfg.reliefMode)?cfg.reliefMode:'single';
  if(mode==='none')return [local(-ht,deep),local(ht,deep),local(ht,outer),local(-ht,outer)];

  // v64 — a entrada continua diagonal, porém só existe se houver madeira real
  // no lado para onde ela avança. Nas pontas/recortes do móvel, uma entrada que
  // cairia no vazio é automaticamente ignorada, sem criar linguetas/loops feios.
  const requestedDia=Math.max(.8,Number(cfg.reliefDiameter)||6);
  const diaByWidth=mode==='double'?Math.max(.8,tw*.42):Math.max(.8,tw*.82);
  const diaByDepth=Math.max(.8,rawDepth*1.25);
  const entryDia=Math.max(.8,Math.min(requestedDia,diaByWidth,diaByDepth));
  const diagonalRoom=Math.max(entryDia,(deep-innerLimit)*Math.SQRT2-.5);
  const requestedLen=Math.max(.5,Number(cfg.reliefLength)||18);
  const entryLen=Math.min(requestedLen,diagonalRoom);
  if(entryLen<.5)return [local(-ht,deep),local(ht,deep),local(ht,outer),local(-ht,outer)];

  const q=Math.SQRT1_2,pts=[];
  pts.push(local(-ht,outer),local(ht,outer));

  const right=curvedDiagonalReliefSequence2D(ht,deep,q,-q,q,q,entryDia,entryLen,14);
  const rightOk=curvedReliefFitsWoodMm(right,local,hostPolygon);
  if(rightOk)for(const [u,v] of right.seq)pts.push(local(u,v));
  else pts.push(local(ht,deep));

  if(mode==='double'){
    const left=curvedDiagonalReliefSequence2D(-ht,deep,-q,-q,q,-q,entryDia,entryLen,14);
    const leftOk=curvedReliefFitsWoodMm(left,local,hostPolygon);
    if(leftOk)for(const [u,v] of left.seq)pts.push(local(u,v));
    else pts.push(local(-ht,deep));
  }else{
    pts.push(local(-ht,deep));
  }
  pts.push(local(-ht,outer));
  return pts;
}
function curvedPostOutlineMm(cfg){
  const W=Math.max(1,Number(cfg.postWidth)||100),H=Math.max(1,Number(cfg.height)||900);
  const T=Math.max(1,Number(cfg.thickness)||18),clear=Math.max(0,Number(cfg.slotClearance)||0);
  const depth=Math.min(W-.001,Math.max(1,Number(cfg.jointDepth)||25));
  const ribs=Math.max(2,Math.round(Number(cfg.ribs)||3)),intervals=[];
  for(let i=0;i<ribs;i++){
    const y=(ribs===1?0:(H-T)*(i/(ribs-1)));
    intervals.push([Math.max(0,y-clear/2),Math.min(H,y+T+clear/2)]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const iv of intervals){
    const last=merged.at(-1);
    if(last&&iv[0]<=last[1]+.001)last[1]=Math.max(last[1],iv[1]);
    else merged.push([...iv]);
  }

  // v62 — no montante de 100 mm o alívio também sai em diagonal.
  // 1 entrada = canto inferior interno; 2 entradas = superior + inferior; sem = quadrado.
  const mode=['single','double','none'].includes(cfg.reliefMode)?cfg.reliefMode:'single';
  const requestedDia=Math.max(.8,Number(cfg.reliefDiameter)||6);
  const requestedLen=Math.max(.5,Number(cfg.reliefLength)||18);
  const eps=.001,q=Math.SQRT1_2,pts=[];
  const push=(pt)=>{
    if(!pt)return;
    const last=pts.at(-1);
    if(last&&Math.abs(last[0]-pt[0])<1e-6&&Math.abs(last[1]-pt[1])<1e-6)return;
    pts.push(pt);
  };
  const first=merged[0],topOpen=!!first&&first[0]<=eps;
  push([topOpen?depth:0,0]);
  let cy=0;

  for(const [y0,y1] of merged){
    const topInternal=y0>eps,bottomInternal=y1<H-eps;
    const slotH=Math.max(.5,y1-y0);
    const diaBySlot=mode==='double'?Math.max(.8,slotH*.42):Math.max(.8,slotH*.82);
    const diaByDepth=Math.max(.8,depth*1.25);
    const entryDia=Math.max(.8,Math.min(requestedDia,diaBySlot,diaByDepth));
    const room=Math.max(entryDia,(W-depth)*Math.SQRT2-.5);
    const entryLen=Math.min(requestedLen,room);
    const canRelief=mode!=='none'&&entryLen>=.5;
    const rectFits=rel=>(rel?.seq||[]).every(([x,y])=>x>=-eps&&x<=W+eps&&y>=-eps&&y<=H+eps);
    const topRel=canRelief&&mode==='double'&&topInternal?curvedDiagonalReliefSequence2D(depth,y0,q,-q,-q,-q,entryDia,entryLen,14):null;
    const bottomRel=canRelief&&bottomInternal?curvedDiagonalReliefSequence2D(depth,y1,q,q,q,-q,entryDia,entryLen,14):null;
    const doTop=!!topRel&&rectFits(topRel);
    const doBottom=!!bottomRel&&rectFits(bottomRel);

    if(topInternal){
      if(y0>cy+eps)push([0,y0]);
      if(doTop){
        // v64: só abre o alívio se toda a entrada continuar dentro da madeira.
        topRel.seq.forEach(push);
      }else push([depth,y0]);
    }else if(Math.abs(y0)>eps){
      push([depth,y0]);
    }

    const offset=Math.SQRT2*(entryDia/2);
    const wallTop=doTop?Math.min(y1,y0+offset):y0;
    const wallBottom=doBottom?Math.max(wallTop,y1-offset):y1;
    if(wallBottom>wallTop+eps)push([depth,wallBottom]);

    if(bottomInternal){
      if(doBottom){
        // v64: idem para a entrada inferior; se cair no vazio, fica sem alívio.
        bottomRel.seq.forEach(push);
      }
      push([0,y1]);
    }else{
      push([depth,y1]);
    }
    cy=y1;
  }

  if(cy<H-eps)push([0,H]);
  push([W,H]);push([W,0]);
  return {points:pts,bboxW:W,bboxH:H};
}
function makeManualEdgeGroupFromLoops(loops,depth,opts={}){
  const group=new THREE.Group();
  group.userData.isVisualEdge=true;
  const color=opts.color??0x080808, opacity=opts.opacity??(xray3DActive()?.86:.96);
  const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:opts.depthTest??!xray3DActive(),depthWrite:false});
  group.material=mat; // compatibilidade com as rotinas globais de Raio-X/2D
  const z0=-depth/2,z1=depth/2;
  for(const loop of loops){
    if(!Array.isArray(loop)||loop.length<2)continue;
    const front=[],back=[];
    for(const p of loop){front.push(new THREE.Vector3(p[0],p[1],z0));back.push(new THREE.Vector3(p[0],p[1],z1));}
    front.push(front[0].clone());back.push(back[0].clone());
    const lf=new THREE.Line(new THREE.BufferGeometry().setFromPoints(front),mat);
    const lb=new THREE.Line(new THREE.BufferGeometry().setFromPoints(back),mat);
    lf.userData.isVisualEdge=lb.userData.isVisualEdge=true;group.add(lf,lb);
    const seg=[];
    for(const p of loop){seg.push(new THREE.Vector3(p[0],p[1],z0),new THREE.Vector3(p[0],p[1],z1));}
    const side=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),mat);side.userData.isVisualEdge=true;group.add(side);
  }
  group.renderOrder=xray3DActive()?88:12;
  group.traverse(o=>{if(o.material)o.renderOrder=group.renderOrder;});
  return group;
}
function makeManualCurvedRibEdges(pts,slots,cx,cz,T){
  const conv=poly=>poly.map(([px,pz])=>[(px-cx)*MM_TO_M,-(pz-cz)*MM_TO_M]);
  return makeManualEdgeGroupFromLoops([conv(pts),...(slots||[]).map(conv)],T*MM_TO_M,{color:0x080808});
}
function makeManualCurvedCoverEdges(pairs,H){
  const group=new THREE.Group();group.userData.isVisualEdge=true;
  const mat=new THREE.LineBasicMaterial({color:0x17120c,transparent:true,opacity:.82,depthTest:!xray3DActive(),depthWrite:false});
  group.material=mat; // compatibilidade com as rotinas globais de Raio-X/2D
  const y0=-H*MM_TO_M/2,y1=H*MM_TO_M/2;
  const paths=[
    pairs.map(p=>new THREE.Vector3(p.ox*MM_TO_M,y0,p.oz*MM_TO_M)),
    pairs.map(p=>new THREE.Vector3(p.ox*MM_TO_M,y1,p.oz*MM_TO_M)),
    pairs.map(p=>new THREE.Vector3(p.ix*MM_TO_M,y0,p.iz*MM_TO_M)),
    pairs.map(p=>new THREE.Vector3(p.ix*MM_TO_M,y1,p.iz*MM_TO_M))
  ];
  for(const arr of paths){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),mat);l.userData.isVisualEdge=true;group.add(l);}
  if(pairs.length){
    const ends=[pairs[0],pairs[pairs.length-1]],seg=[];
    for(const p of ends){
      const o0=new THREE.Vector3(p.ox*MM_TO_M,y0,p.oz*MM_TO_M),o1=new THREE.Vector3(p.ox*MM_TO_M,y1,p.oz*MM_TO_M),i0=new THREE.Vector3(p.ix*MM_TO_M,y0,p.iz*MM_TO_M),i1=new THREE.Vector3(p.ix*MM_TO_M,y1,p.iz*MM_TO_M);
      seg.push(o0,o1,o1,i1,i1,i0,i0,o0);
    }
    const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg),mat);ls.userData.isVisualEdge=true;group.add(ls);
  }
  group.renderOrder=xray3DActive()?88:12;return group;
}
function createCurvedPost({cfg,yBase=0,x=0,z=0,name='Montante curvo',spaceRootId=null,rotationY=0}={},doHistory=true){
  const prof=curvedPostOutlineMm(cfg),W=Math.max(1,Number(cfg.postWidth)||100),H=Math.max(1,Number(cfg.height)||900),T=Math.max(1,Number(cfg.thickness)||18);
  const shape=new THREE.Shape();
  prof.points.forEach(([px,py],i)=>{const sx=(px-W/2)*MM_TO_M,sy=(py-H/2)*MM_TO_M;if(i===0)shape.moveTo(sx,sy);else shape.lineTo(sx,sy);});shape.closePath();
  const geom=new THREE.ExtrudeGeometry(shape,{depth:T*MM_TO_M,bevelEnabled:false,steps:1,curveSegments:4});
  geom.translate(0,0,-T*MM_TO_M/2);geom.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:COLORS.panel,roughness:.72,metalness:0,side:THREE.DoubleSide,flatShading:false});
  const mesh=new THREE.Mesh(geom,mat);mesh.rotation.y=Number(rotationY)||0;mesh.position.set(x,yBase+H*MM_TO_M/2,z);
  mesh.userData={kind:'panel',name,materialType:'MDF',baseColor:COLORS.panel,materialId:null,materialCode:'',materialGrain:false,materialCoreColor:null,edgeBands:{},partId:uid('part'),labelMeta:{schemaVersion:1,enabled:true,custom:{}},faceMaterials:[mat],spaceRootId:spaceRootId||null,machining:[],curvedRole:'post',curvedConfig:JSON.parse(JSON.stringify(cfg)),width:W*MM_TO_M,depth:T*MM_TO_M,height:H*MM_TO_M,rotationY:Number(rotationY)||0};
  mesh.castShadow=true;mesh.receiveShadow=true;
  // bordas manuais do perfil; nenhuma aresta de triangulação interna é desenhada.
  const postLoop=prof.points.map(([px,py])=>[(px-W/2)*MM_TO_M,(py-H/2)*MM_TO_M]);
  const edges=makeManualEdgeGroupFromLoops([postLoop],T*MM_TO_M,{color:0x080808});edges.visible=true;mesh.add(edges);mesh.userData.visualEdges=edges;
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});
  scene.add(mesh);objects.push(mesh);selectObject(mesh);if(doHistory)commitHistory();return mesh;
}
function curvedRibPartSlotSamples(cfg,part){
  const out=[],samples=curvedPostSamplesMm(cfg),split=curvedSplitInfo(cfg);
  for(const sample of samples){
    if(part==='full')out.push(sample);
    else if(part==='straight'){
      if(sample.s<split.splitX-.001)out.push(sample);
    }else if(part==='curve'){
      if(sample.s>=split.splitX-.001)out.push(sample);
    }
  }
  return out;
}
function createCurvedRib({cfg,yBase=0,x=0,z=0,name='Nervura curva',spaceRootId=null,index=1,part='full'}={},doHistory=true){
  const pts=curvedProfilePointsMm(cfg,part);if(pts.length<3)return null;
  const samples=curvedRibPartSlotSamples(cfg,part),slots=[];
  if(cfg.createSlots!==false)for(const sample of samples)slots.push(curvedSlotPolygonMm(cfg,sample,Number(cfg.thickness),Number(cfg.slotClearance)||0,0,pts));
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),BW=maxX-minX,BH=maxZ-minZ,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,T=Number(cfg.thickness);
  const shape=new THREE.Shape();
  pts.forEach(([px,pz],i)=>{const lx=(px-cx)*MM_TO_M,ly=-(pz-cz)*MM_TO_M;if(i===0)shape.moveTo(lx,ly);else shape.lineTo(lx,ly);});shape.closePath();
  if(cfg.createSlots!==false){
    for(const sample of samples){
      const poly=curvedSlotPolygonMm(cfg,sample,Number(cfg.thickness),Number(cfg.slotClearance)||0,.18,pts),hole=new THREE.Path();
      poly.slice().reverse().forEach(([px,pz],j)=>{const lx=(px-cx)*MM_TO_M,ly=-(pz-cz)*MM_TO_M;if(j===0)hole.moveTo(lx,ly);else hole.lineTo(lx,ly);});hole.closePath();shape.holes.push(hole);
    }
  }
  const geom=new THREE.ExtrudeGeometry(shape,{depth:T*MM_TO_M,bevelEnabled:false,steps:1,curveSegments:160});geom.translate(0,0,-T*MM_TO_M/2);geom.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:COLORS.panel,roughness:.72,metalness:0,side:THREE.DoubleSide,flatShading:false});
  const mesh=new THREE.Mesh(geom,mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x+(cx-cfg.targetW/2)*MM_TO_M,yBase+T*MM_TO_M/2,z+(cz-cfg.targetD/2)*MM_TO_M);
  const normalizedPts=pts.map(([px,pz])=>[px-minX,pz-minZ]),normalizedSlots=slots.map(poly=>poly.map(([px,pz])=>[px-minX,pz-minZ]));
  const role=part==='full'?'rib':part==='curve'?'rib-curve':'rib-straight';
  mesh.userData={kind:'curved-panel',name,materialType:'MDF',baseColor:COLORS.panel,materialId:null,materialCode:'',materialGrain:false,materialCoreColor:null,edgeBands:{},partId:uid('part'),labelMeta:{schemaVersion:1,enabled:true,custom:{}},faceMaterials:[mat],spaceRootId:spaceRootId||null,machining:[],curvedRole:role,curvedPart:part,curvedTargetX:x,curvedTargetZ:z,width:BW*MM_TO_M,depth:BH*MM_TO_M,height:T*MM_TO_M,customProfile:{type:'quarter-rail',part,points:normalizedPts,slots:normalizedSlots,bboxW:BW,bboxH:BH,cfg:JSON.parse(JSON.stringify(cfg))}};
  mesh.castShadow=true;mesh.receiveShadow=true;
  // v73: contorno explícito da nervura + encaixes, sem diagonais internas da triangulação.
  const edges=makeManualCurvedRibEdges(pts,slots,cx,cz,T);edges.visible=true;mesh.add(edges);mesh.userData.visualEdges=edges;
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});
  scene.add(mesh);objects.push(mesh);selectObject(mesh);if(doHistory)commitHistory();return mesh;
}
function curvedCoverPathPairsMm(cfg,part='full'){
  const a=Math.max(0,Number(cfg.straightA)||0),b=Math.max(0,Number(cfg.straightB)||0),R=Math.max(10,Number(cfg.radius)||500),t=Math.max(.1,Number(cfg.coverThickness)||6),seg=120,pairs=[];
  const split=(part==='full')?0:curvedSplitInfo(cfg).splitX;
  const add=(ox,oz,ix,iz)=>{const o=curvedTransformPointMm(cfg,ox,oz),inn=curvedTransformPointMm(cfg,ix,iz);pairs.push({ox:o.x,oz:o.z,ix:inn.x,iz:inn.z});};
  if(part==='straight'){
    if(split<=.001)return [];
    add(0,0,0,t);add(split,0,split,t);return pairs;
  }
  const x0=part==='curve'?split:0;
  add(x0,0,x0,t);add(a,0,a,t);
  for(let i=1;i<=seg;i++){
    const ang=-Math.PI/2+(Math.PI/2)*(i/seg);
    add(a+R*Math.cos(ang),R+R*Math.sin(ang),a+(R-t)*Math.cos(ang),R+(R-t)*Math.sin(ang));
  }
  if(b>.001)add(a+R,R+b,a+R-t,R+b);
  return pairs;
}
function curvedCoverDevelopedLengthMm(cfg,part='full'){
  const a=Math.max(0,Number(cfg.straightA)||0),b=Math.max(0,Number(cfg.straightB)||0),R=Math.max(10,Number(cfg.radius)||500),t=Math.max(.1,Number(cfg.coverThickness)||6),neutral=Math.max(.1,R-t/2),split=curvedSplitInfo(cfg).splitX;
  if(part==='straight')return Math.max(0,split);
  if(part==='curve')return Math.max(0,a-split)+neutral*Math.PI/2+b;
  return a+neutral*Math.PI/2+b;
}
function createCurvedCover({cfg,yBase=0,x=0,z=0,name='Capa externa curva',spaceRootId=null,part='full'}={},doHistory=true){
  const pairs=curvedCoverPathPairsMm(cfg,part);if(pairs.length<2)return null;
  const H=Math.max(1,Number(cfg.height)||900),T=Math.max(.1,Number(cfg.coverThickness)||6),W=Number(cfg.targetW),D=Number(cfg.targetD),verts=[],idx=[];
  for(const p of pairs){
    const ox=(p.ox-W/2)*MM_TO_M,oz=(p.oz-D/2)*MM_TO_M,ix=(p.ix-W/2)*MM_TO_M,iz=(p.iz-D/2)*MM_TO_M,y0=-H*MM_TO_M/2,y1=H*MM_TO_M/2;
    verts.push(ox,y0,oz, ox,y1,oz, ix,y0,iz, ix,y1,iz);
  }
  for(let i=0;i<pairs.length-1;i++){
    const a=i*4,b=(i+1)*4;
    idx.push(a,b,b+1,a,b+1,a+1);              // face externa
    idx.push(a+2,a+3,b+3,a+2,b+3,b+2);        // face interna
    idx.push(a+1,b+1,b+3,a+1,b+3,a+3);        // topo
    idx.push(a,a+2,b+2,a,b+2,b);              // base
  }
  const s0=0,se=(pairs.length-1)*4;idx.push(s0,s0+1,s0+3,s0,s0+3,s0+2);idx.push(se,se+2,se+3,se,se+3,se+1);
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.setIndex(idx);geom.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:0xc9b28d,roughness:.76,metalness:0,side:THREE.DoubleSide,flatShading:false});
  const mesh=new THREE.Mesh(geom,mat);mesh.position.set(x,yBase+H*MM_TO_M/2,z);
  const dev=curvedCoverDevelopedLengthMm(cfg,part);
  mesh.userData={kind:'panel',name,materialType:'MDF flexível',baseColor:0xc9b28d,materialId:null,materialCode:'',materialGrain:false,materialCoreColor:null,edgeBands:{},partId:uid('part'),labelMeta:{schemaVersion:1,enabled:true,custom:{}},faceMaterials:[mat],spaceRootId:spaceRootId||null,machining:[],curvedRole:'cover',curvedPart:part,curvedConfig:{...JSON.parse(JSON.stringify(cfg)),coverPart:part},width:dev*MM_TO_M,depth:T*MM_TO_M,height:H*MM_TO_M};
  mesh.castShadow=true;mesh.receiveShadow=true;
  // v74: capa com apenas as quatro bordas longitudinais e as duas extremidades.
  const localPairs=pairs.map(p=>({ox:p.ox-W/2,oz:p.oz-D/2,ix:p.ix-W/2,iz:p.iz-D/2}));
  const edges=makeManualCurvedCoverEdges(localPairs,H);mesh.add(edges);mesh.userData.visualEdges=edges;
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});
  scene.add(mesh);objects.push(mesh);selectObject(mesh);if(doHistory)commitHistory();return mesh;
}
function curvedExistingConfig(root){
  if(!root)return null;
  const candidates=objects.filter(o=>o.userData?.spaceRootId===root.id&&(o.userData?.curvedRole||o.userData?.kind==='curved-panel'||/^Montante curvo/i.test(o.userData?.name||'')));
  // Prefere nervura: guarda a configuração-base completa sem campos específicos de capa/montante.
  const rib=candidates.find(o=>o.userData?.kind==='curved-panel'&&o.userData?.customProfile?.cfg);
  const src=rib?.userData?.customProfile?.cfg
    || candidates.find(o=>o.userData?.curvedRole==='cover'&&o.userData?.curvedConfig)?.userData?.curvedConfig
    || candidates.find(o=>o.userData?.curvedRole==='post'&&o.userData?.curvedConfig)?.userData?.curvedConfig;
  return src?JSON.parse(JSON.stringify(src)):null;
}
function curvedTargetUsingExisting(root,cfg,fallback){
  if(!root||!cfg)return fallback;
  const cell=cfg.targetCellId?getSpaceCell(root.id,cfg.targetCellId):null;
  if(cell)return {root,cell,width:cell.maxX-cell.minX,depth:cell.maxZ-cell.minZ,height:cell.maxY-cell.minY,x:(cell.minX+cell.maxX)/2,z:(cell.minZ+cell.maxZ)/2,yBase:cell.minY,label:`${root.name} · divisão`};
  return fallback;
}
function setCurvedFormFromConfig(c){
  if(!c)return;
  const set=(id,v)=>{const el=$(id);if(el&&v!==undefined&&v!==null&&Number.isFinite(Number(v)))el.value=nice(Number(v));};
  set('curvedRadius',c.radius); set('curvedBand',c.band); set('curvedThickness',c.thickness);
  set('curvedRibs',c.ribs); set('curvedPosts',Math.max(4,Number(c.posts)||5)); set('curvedPostWidth',c.postWidth);
  set('curvedJointDepth',c.jointDepth); set('curvedSlotClearance',c.slotClearance);
  set('curvedReliefDiameter',c.reliefDiameter??6); set('curvedReliefLength',c.reliefLength??18); set('curvedCurveEndInset',c.curveEndInset??CURVED_CURVE_END_INSET_MM); set('curvedEndAInset',c.endAInset??CURVED_END_A_INSET_MM); set('curvedEndBInset',c.endBInset??CURVED_END_B_INSET_MM);
  if($('curvedReliefMode'))$('curvedReliefMode').value=['single','double','none'].includes(c.reliefMode)?c.reliefMode:'single';
  set('curvedCoverThickness',c.coverThickness); set('curvedSplitTail',c.splitTail);
  if($('curvedCreateSlots'))$('curvedCreateSlots').checked=c.createSlots!==false;
  if($('curvedCreateCover'))$('curvedCreateCover').checked=c.createCover!==false;
  if($('curvedSplitStructure'))$('curvedSplitStructure').checked=!!c.splitStructure;
  curvedOrientation=c.orientation||'front-right';
  document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.classList.toggle('active',b.dataset.curvedOrientation===curvedOrientation));
}
function openCurvedStructureDialog(){
  if(curved3DPreviewActive)returnCurvedStructurePreview({reopen:false});
  curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  let target=curvedSelectedTarget();if(!target){toast('Selecione primeiro o espaço ou uma peça do móvel curvo');return false;}
  const existingCfg=curvedExistingConfig(target.root);
  if(existingCfg)target=curvedTargetUsingExisting(target.root,existingCfg,target);
  curvedTargetRootId=target.root.id;curvedTargetCellId=target.cell?.id||null;
  curvedEditingExisting=!!existingCfg;
  if(existingCfg)setCurvedFormFromConfig(existingCfg);
  else document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.classList.toggle('active',b.dataset.curvedOrientation===curvedOrientation));
  const W=mm(target.width),D=mm(target.depth),H=mm(target.height),minSide=Math.min(W,D);let r=parseDecimalInput($('curvedRadius')?.value);
  if(!Number.isFinite(r)||r<20||r>=minSide)r=Math.max(20,Math.min(minSide-1,Math.round(minSide*.7)));$('curvedRadius').value=nice(r);
  let band=parseDecimalInput($('curvedBand')?.value);if(!Number.isFinite(band)||band<20||band>=r)$('curvedBand').value=nice(Math.max(20,Math.min(r-1,50)));
  $('curvedTargetSpaceInfo').innerHTML=`<b>${target.label}</b><br>L ${nice(W)} × P ${nice(D)} × A ${nice(H)} mm · base ${nice(mm(target.yBase))} mm do chão`;
  if($('curvedDialogTitle'))$('curvedDialogTitle').textContent=curvedEditingExisting?'◒ Editar móvel curvo':'◒ Móvel curvo no espaço';
  if($('curvedDialogHelp'))$('curvedDialogHelp').textContent=curvedEditingExisting?'Altere qualquer configuração abaixo. Ao salvar, o conjunto existente será reconstruído no mesmo espaço.':'A estrutura usa automaticamente as medidas do espaço/divisão selecionado. Você configura somente a geometria da curva e a estrutura interna.';
  if($('curvedEditStatus')){
    $('curvedEditStatus').style.display=curvedEditingExisting?'block':'none';
    $('curvedEditStatus').innerHTML=curvedEditingExisting?'<b>EDITANDO ESTRUTURA EXISTENTE</b><br>Raio, réguas, nervuras, capa, encaixes e divisão em 2 partes podem ser alterados.':'';
  }
  if($('confirmCurvedStructure'))$('confirmCurvedStructure').textContent=curvedEditingExisting?'Salvar alterações':'Criar no espaço';
  $('curvedStructureDialog').style.display='flex';updateCurvedStructurePreview();return true;
}
function curvedFieldNumber(id,fallback){
  const v=parseDecimalInput($(id)?.value);
  return Number.isFinite(v)?v:Number(fallback);
}
function curvedFormConfig(){
  const target=curvedTargetFromStored();if(!target)throw new Error('Selecione um espaço');
  const W=mm(target.width),D=mm(target.depth),H=mm(target.height);
  // v79: raio de 150 mm e campos auxiliares vazios não bloqueiam a criação.
  const R=curvedFieldNumber('curvedRadius',150);
  const createCover=!!$('curvedCreateCover')?.checked;
  const createSlots=!!$('curvedCreateSlots')?.checked;
  const splitStructure=!!$('curvedSplitStructure')?.checked;
  return {
    name:target.root.name||'Móvel curvo',
    height:H,
    straightA:W-R,
    radius:R,
    straightB:D-R,
    band:curvedFieldNumber('curvedBand',50),
    thickness:curvedFieldNumber('curvedThickness',18),
    ribs:Math.round(curvedFieldNumber('curvedRibs',3)),
    posts:Math.round(curvedFieldNumber('curvedPosts',5)),
    postWidth:curvedFieldNumber('curvedPostWidth',100),
    jointDepth:curvedFieldNumber('curvedJointDepth',25),
    slotClearance:curvedFieldNumber('curvedSlotClearance',0.5),
    reliefMode:['single','double','none'].includes($('curvedReliefMode')?.value)?$('curvedReliefMode').value:'single',
    reliefDiameter:curvedFieldNumber('curvedReliefDiameter',6),
    reliefLength:curvedFieldNumber('curvedReliefLength',18),
    curveEndInset:curvedFieldNumber('curvedCurveEndInset',CURVED_CURVE_END_INSET_MM),
    endAInset:curvedFieldNumber('curvedEndAInset',CURVED_END_A_INSET_MM),
    endBInset:curvedFieldNumber('curvedEndBInset',CURVED_END_B_INSET_MM),
    orientation:curvedOrientation,
    floor:mm(target.yBase),
    createSlots,
    createCover,
    coverThickness:curvedFieldNumber('curvedCoverThickness',6),
    splitStructure,
    splitTail:curvedFieldNumber('curvedSplitTail',60),
    targetW:W,targetD:D,targetRootId:target.root.id,targetCellId:target.cell?.id||null
  };
}
function validateCurvedConfig(c){
  const required=[
    ['altura',c.height],['trecho reto frontal',c.straightA],['raio',c.radius],
    ['trecho reto lateral',c.straightB],['largura da nervura',c.band],
    ['espessura do MDF',c.thickness],['nervuras',c.ribs],['montantes',c.posts],
    ['largura do montante',c.postWidth],['encaixe',c.jointDepth],
    ['folga do encaixe',c.slotClearance],['Ø da entrada',c.reliefDiameter],['comprimento da entrada',c.reliefLength],['recuo do final da curva',c.curveEndInset],['distância do montante lado A',c.endAInset],['distância do montante lado B',c.endBInset],['altura do chão',c.floor],
    ['largura do espaço',c.targetW],['profundidade do espaço',c.targetD],
    ['espessura da capa',c.coverThickness],['sobra da emenda',c.splitTail]
  ];
  const invalid=required.find(([,v])=>!Number.isFinite(v));
  if(invalid)throw new Error(`Confira ${invalid[0]}`);
  if(c.radius<20||c.radius>Math.min(c.targetW,c.targetD))throw new Error(`O raio deve ficar entre 20 e ${nice(Math.min(c.targetW,c.targetD))} mm`);
  if(c.straightA<-.001||c.straightB<-.001)throw new Error('O raio é maior que o espaço selecionado');
  if(c.coverThickness<1)throw new Error('A capa externa deve ter pelo menos 1 mm');
  const availableRadius=c.radius-(c.createCover?c.coverThickness:0);
  if(c.band<20||c.band>=availableRadius)throw new Error('A nervura + capa precisam caber dentro do raio');
  if(c.thickness<3||c.ribs<2||c.posts<4||c.postWidth<20)throw new Error('Confira espessura, nervuras e montantes (mínimo 4)');
  if(c.reliefDiameter<1||c.reliefDiameter>20)throw new Error('Ø da entrada da fresa deve ficar entre 1 e 20 mm');
  if(c.reliefLength<.5||c.reliefLength>60)throw new Error('Comprimento da entrada deve ficar entre 0,5 e 60 mm');
  if(c.curveEndInset<0||c.curveEndInset>100)throw new Error('Recuo do final da curva deve ficar entre 0 e 100 mm');
  if(c.endAInset<0||c.endAInset>500||c.endBInset<0||c.endBInset>500)throw new Error('A distância dos últimos montantes deve ficar entre 0 e 500 mm');
  if(c.jointDepth<=0||c.jointDepth>c.band||c.jointDepth>c.postWidth)throw new Error('O encaixe deve caber na nervura e no montante');
  if(c.height<c.thickness*2)throw new Error('Altura do espaço pequena para as nervuras');
  if(c.splitTail<0)throw new Error('A sobra da emenda não pode ser negativa');
  if(c.splitStructure){
    const sp=curvedSplitInfo(c);
    if(!sp.valid)throw new Error(sp.reason||'Não foi possível calcular a emenda em 2 partes');
  }
  return c;
}
function updateCurvedStructurePreview(){
  try{
    const c=validateCurvedConfig(curvedFormConfig()),devFull=curvedCoverDevelopedLengthMm(c,'full'),sp=curvedSplitInfo(c);
    if($('curvedCoverInfo'))$('curvedCoverInfo').value=c.createCover?`${nice(devFull)} × ${nice(c.height)} mm`:'desligada';
    $('curvedCoverThickness').disabled=!c.createCover;
    $('curvedSplitTail').disabled=!c.splitStructure;
    if($('curvedReliefMode'))$('curvedReliefMode').disabled=!c.createSlots;
    if($('curvedReliefDiameter'))$('curvedReliefDiameter').disabled=!c.createSlots||c.reliefMode==='none';
    if($('curvedReliefLength'))$('curvedReliefLength').disabled=!c.createSlots||c.reliefMode==='none';
    if($('curvedSplitInfo'))$('curvedSplitInfo').value=c.splitStructure?`${nice(sp.splitX)} mm`:'inteira';
    const splitText=c.splitStructure
      ?`2 PARTES · espaço de emenda ${nice(c.splitTail)} mm · corte em ${nice(sp.splitX)} mm<br>Parte reta: ${nice(sp.straightLength)} mm · parte curva mantém ${nice(sp.curveTail)} mm retos antes do arco`
      :'INTEIRA';
    $('curvedStructurePreview').innerHTML=`Ocupa exatamente: <b>${nice(c.targetW)} × ${nice(c.targetD)} × ${nice(c.height)} mm</b><br><b>${curvedOrientationName(c.orientation)}</b> · raio final externo ${nice(c.radius)} mm · nervura ${nice(c.band)} mm${c.createCover?` recuada ${nice(c.coverThickness)} mm para receber a capa`:''}<br>Montante ${nice(c.postWidth)} mm · encaixe ${nice(c.jointDepth)} mm nas duas peças<br>${c.ribs} nervura(s) MDF ${nice(c.thickness)} mm · ${c.posts} montante(s) no total<br><b>Montantes fixos:</b> ponta A a ${nice(c.endAInset)} mm da borda + centro da curva + final da curva recuado ${nice(c.curveEndInset)} mm + ponta B a ${nice(c.endBInset)} mm da borda<br>Montantes extras: divisão equilibrada somente nos vãos retos livres${c.splitStructure?` · em 2 partes preserva ${nice(c.splitTail)} mm da emenda`:''}<br>Entrada da fresa: <b>${c.reliefMode==='none'?'sem alívio':`${c.reliefMode==='double'?'2 entradas diagonais':'1 entrada diagonal'} · Ø${nice(c.reliefDiameter)} × ${nice(c.reliefLength)} mm`}</b><br>Capa externa: <b>${c.createCover?`${nice(c.coverThickness)} mm · desenvolvimento ${nice(devFull)} mm`:'NÃO'}</b><br>Estrutura: <b>${splitText}</b>`;
  }catch(err){
    if($('curvedSplitTail'))$('curvedSplitTail').disabled=!$('curvedSplitStructure')?.checked;
    const slotsOn=!!$('curvedCreateSlots')?.checked,reliefOn=$('curvedReliefMode')?.value!=='none';
    if($('curvedReliefMode'))$('curvedReliefMode').disabled=!slotsOn;
    if($('curvedReliefDiameter'))$('curvedReliefDiameter').disabled=!slotsOn||!reliefOn;
    if($('curvedReliefLength'))$('curvedReliefLength').disabled=!slotsOn||!reliefOn;
    if($('curvedSplitInfo'))$('curvedSplitInfo').value='—';
    $('curvedStructurePreview').textContent=err.message||'Confira as medidas';
  }
}
function removeExistingCurvedStructure(root){
  const doomed=objects.filter(o=>o.userData?.spaceRootId===root.id&&(o.userData?.curvedRole||o.userData?.kind==='curved-panel'||/^Montante curvo/i.test(o.userData?.name||'')));
  removeHardwareLinkedToObjects(doomed);
  for(const o of doomed){if(selected===o)selected=null;disposeObject(o);const idx=objects.indexOf(o);if(idx>=0)objects.splice(idx,1);}renderMachiningVisuals();return doomed.length;
}
function buildCurvedStructureObjects(c,target){
  const root=target.root,H=target.height,T=c.thickness*MM_TO_M,xCenter=target.x,zCenter=target.z,yBase=target.yBase;
  removeExistingCurvedStructure(root);
  for(let i=0;i<c.ribs;i++){
    const yy=yBase+(c.ribs===1?0:(H-T)*(i/(c.ribs-1)));
    if(c.splitStructure){
      createCurvedRib({cfg:c,yBase:yy,x:xCenter,z:zCenter,name:`Nervura curva ${i+1}`,spaceRootId:root.id,index:i+1,part:'curve'},false);
      createCurvedRib({cfg:c,yBase:yy,x:xCenter,z:zCenter,name:`Nervura reta ${i+1}`,spaceRootId:root.id,index:i+1,part:'straight'},false);
    }else createCurvedRib({cfg:c,yBase:yy,x:xCenter,z:zCenter,name:`Nervura curva ${i+1}`,spaceRootId:root.id,index:i+1,part:'full'},false);
  }
  const postSamples=curvedPostSamplesMm(c);
  let extraNo=0;
  for(const sample of postSamples){
    const plc=curvedPostPlacementFromSampleMm(c,sample),x=xCenter+(plc.x-c.targetW/2)*MM_TO_M,z=zCenter+(plc.z-c.targetD/2)*MM_TO_M;
    const nm=sample.structuralTag==='end-a'?`Montante final A - ${c.endAInset>0?`${nice(c.endAInset)} mm da borda`:'rente'}`:sample.structuralTag==='end-b'?`Montante final B - ${c.endBInset>0?`${nice(c.endBInset)} mm da borda`:'rente'}`:sample.structuralTag==='curve-mid'?'Montante curva - centro':sample.structuralTag==='curve-end-inset'?`Montante curva - final recuado ${nice(c.curveEndInset)} mm`:sample.structuralTag==='straight-a'?`Montante reto A ${++extraNo}`:sample.structuralTag==='straight-b'?`Montante reto B ${++extraNo}`:`Montante reto ${++extraNo}`;
    createCurvedPost({cfg:{...c,postStructuralTag:sample.structuralTag||'extra',postSampleIndex:sample.postIndex,postSampleS:sample.s},yBase,x,z,name:nm,spaceRootId:root.id,rotationY:plc.rotationY},false);
  }
  if(c.createCover){
    if(c.splitStructure){
      createCurvedCover({cfg:c,yBase,x:xCenter,z:zCenter,name:'Capa externa curva',spaceRootId:root.id,part:'curve'},false);
      createCurvedCover({cfg:c,yBase,x:xCenter,z:zCenter,name:'Capa externa reta',spaceRootId:root.id,part:'straight'},false);
    }else createCurvedCover({cfg:c,yBase,x:xCenter,z:zCenter,name:'Capa externa',spaceRootId:root.id,part:'full'},false);
  }
  renderSpaces();renderMachiningVisuals();
  return root;
}
function previewCurvedStructure3D(){
  let c;try{c=validateCurvedConfig(curvedFormConfig());}catch(err){toast(err.message||'Confira as medidas');return false;}
  const target=curvedTargetFromStored();if(!target){toast('O espaço selecionado não existe mais');return false;}
  const original=stateString();
  const meta={rootId:curvedTargetRootId,cellId:curvedTargetCellId,editing:curvedEditingExisting,orientation:curvedOrientation};
  try{
    curved3DPreviewOriginalState=original;curved3DPreviewMeta=meta;
    historyMuted=true;buildCurvedStructureObjects(c,target);historyMuted=false;
    curved3DPreviewActive=true;
    $('curvedStructureDialog').style.display='none';
    $('curved3DPreviewBar').style.display='flex';
    setDesignLabVisualizationOnly(true);
    if($('curved3DPreviewInfo'))$('curved3DPreviewInfo').textContent=`Raio ${nice(c.radius)} mm · ${c.ribs} nervura(s) · ${curvedPostSamplesMm(c).length} montante(s) · prévia temporária, ainda não salva.`;
    selectObject(null);frameFurnitureVisual();
    toast('Prévia 3D · gire/zoom e toque em Voltar e editar');
    return true;
  }catch(err){
    historyMuted=false;
    try{applyState(JSON.parse(original));}catch(_){ }
    curvedTargetRootId=meta.rootId;curvedTargetCellId=meta.cellId;curvedEditingExisting=meta.editing;curvedOrientation=meta.orientation;
    curved3DPreviewActive=false;curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;
    setDesignLabVisualizationOnly(false);
    if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';
    toast(err.message||'Não foi possível visualizar o móvel curvo');
    return false;
  }
}
function returnCurvedStructurePreview({reopen=true}={}){
  if(!curved3DPreviewActive){if(reopen)$('curvedStructureDialog').style.display='flex';return;}
  const snapshot=curved3DPreviewOriginalState,meta=curved3DPreviewMeta||{};
  curved3DPreviewActive=false;curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;
  setDesignLabVisualizationOnly(false);
  if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';
  if(snapshot){
    try{applyState(JSON.parse(snapshot));}catch(err){toast('Não foi possível restaurar a prévia');}
  }
  curvedTargetRootId=meta.rootId||null;curvedTargetCellId=meta.cellId||null;curvedEditingExisting=!!meta.editing;curvedOrientation=meta.orientation||curvedOrientation;
  document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.classList.toggle('active',b.dataset.curvedOrientation===curvedOrientation));
  if(reopen){$('curvedStructureDialog').style.display='flex';updateCurvedStructurePreview();}
}
function createCurvedStructure(){
  let c;try{c=validateCurvedConfig(curvedFormConfig());}catch(err){toast(err.message);return false;}
  const target=curvedTargetFromStored();if(!target){toast('O espaço selecionado não existe mais');return false;}
  const root=target.root;
  const existing=objects.filter(o=>o.userData?.spaceRootId===root.id&&(o.userData?.curvedRole||o.userData?.kind==='curved-panel'||/^Montante curvo/i.test(o.userData?.name||'')));
  if(existing.length&&!curvedEditingExisting&&!confirm(`Este espaço já possui ${existing.length} peça(s) de estrutura curva/capa. Substituir pela nova estrutura?`))return false;
  const wasEditing=curvedEditingExisting;
  historyMuted=true;buildCurvedStructureObjects(c,target);historyMuted=false;commitHistory();
  $('curvedStructureDialog').style.display='none';if($('curved3DPreviewBar'))$('curved3DPreviewBar').style.display='none';setDesignLabVisualizationOnly(false);selectSpaceRootOnly(root);frameFurnitureVisual();
  curved3DPreviewActive=false;curved3DPreviewOriginalState=null;curved3DPreviewMeta=null;
  curvedEditingExisting=false;curvedTargetRootId=null;curvedTargetCellId=null;
  toast(`${wasEditing?'Móvel curvo atualizado':'Móvel curvo criado'} · ${c.splitStructure?'2 partes':'inteiro'} · ${c.createCover?'com capa externa':'sem capa'}`);return true;
}

function createCylinder({diameter=1,height=1,x=0,yBase=0,z=0,name='Cilindro'}={}, doHistory=true){
  diameter=clampSize(diameter); height=clampSize(height);
  const mats=makeMaterials(COLORS.default,3);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,48),mats);
  mesh.scale.set(diameter,height,diameter);
  mesh.position.set(x,yBase+height/2,z);
  mesh.userData={kind:'cylinder',width:diameter,depth:diameter,height,name,materialType:'genérico',baseColor:COLORS.default,faceMaterials:mats};
  mesh.castShadow=true; mesh.receiveShadow=true;
  scene.add(mesh); objects.push(mesh); selectObject(mesh);
  if(doHistory) commitHistory();
  return mesh;
}

function selectObject(mesh){
  if(mesh)clearSpaceSelection();
  if(selected&&selected!==mesh)restoreBaseColor(selected);
  selected=mesh;
  lastEdit=null;
  liveLabel.style.display='none';
  hideGuides();

  if(selected){
    if(!visualMode)setAllFaces(selected,COLORS.selected);
    else restoreBaseColor(selected);
    updateInspector();

    // 1.100.96: um clique apenas seleciona.
    // A configuração abre ao clicar/tocar e SEGURAR a mesma peça.
    cancelDuplicateConfirmation?.();
    $('inspector').classList.add('compact');
    $('inspector').style.display='none';
  }else{
    $('inspector').classList.add('compact');
    $('inspector').style.display='none';
  }
  updateMeasureBadge();
}

// 1.200.17 · nomes rápidos de peças + biblioteca pessoal de nomes.
const PIECE_NAME_PRESET_KEY='designLabPieceNamePresetsV1';
const PIECE_NAME_BUILTINS=[
  'Lateral esquerda','Lateral direita','Base','Chapéu','Prateleira','Divisão central','Divisão esquerda','Divisão direita',
  'Fundo','Tampo','Rodapé','Travessa','Régua','Montante','Painel','Painel lateral','Painel frontal',
  'Porta esquerda','Porta direita','Porta central','Frente de gaveta','Lateral de gaveta esquerda','Lateral de gaveta direita',
  'Contra frente','Contra fundo','Fundo de gaveta','Nicho','Capa','Testeira'
];
function pieceNameCustomPresets(){
  try{const a=JSON.parse(localStorage.getItem(PIECE_NAME_PRESET_KEY)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[];}catch{return [];}
}
function savePieceNameCustomPresets(list){
  const clean=[...new Set((list||[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,120);
  localStorage.setItem(PIECE_NAME_PRESET_KEY,JSON.stringify(clean));return clean;
}
function refreshPieceNamePresetSelect(current=''){
  const sel=$('pieceNamePresetSelect');if(!sel)return;
  const keep=String(current||'').trim();sel.innerHTML='';
  const first=document.createElement('option');first.value='';first.textContent='Escolher um nome…';sel.appendChild(first);
  const addGroup=(label,items)=>{if(!items.length)return;const g=document.createElement('optgroup');g.label=label;for(const name of items){const o=document.createElement('option');o.value=name;o.textContent=name;g.appendChild(o);}sel.appendChild(g);};
  addGroup('Nomes padrão',PIECE_NAME_BUILTINS);addGroup('Meus nomes',pieceNameCustomPresets());
  sel.value=[...sel.options].some(o=>o.value===keep)?keep:'';
}
function applyPieceNamePreset(name){
  if(!selected)return;name=String(name||'').trim();if(!name)return;
  selected.userData.name=name;
  if($('partNameInput'))$('partNameInput').value=name;
  $('objectName').textContent=name;
  refreshPieceNamePresetSelect(name);
  updateMeasureBadge();commitHistory();toast(`Nome alterado para “${name}”`);
}
function createPieceNamePreset(){
  const input=$('pieceNameCustomInput');const name=String(input?.value||'').trim();
  if(!name){toast('Digite o nome que deseja criar');input?.focus();return;}
  const list=pieceNameCustomPresets();if(!list.some(x=>x.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))list.push(name);
  savePieceNameCustomPresets(list);if(input)input.value='';refreshPieceNamePresetSelect(name);applyPieceNamePreset(name);
}

function openPieceInspector(mesh=selected){
  if(!mesh)return;
  if(typeof designLabVisualizationOnlyActive==='function'&&designLabVisualizationOnlyActive())return;
  if(mesh!==selected)selectObject(mesh);
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  cancelDuplicateConfirmation?.();
  updateInspector();
  $('morePanel').style.display='none';
  $('inspector').classList.remove('compact');
  $('inspector').style.display='block';
  requestAnimationFrame(()=>restorePieceInspectorPosition(true));
}

function updateInspector(){
  if(!selected) return;
  const u=selected.userData;
  $('objectName').textContent=u.name || 'Peça';
  const machineCount=(u.machining||[]).length;
  const ti=u.kind==='cylinder'?null:pieceThicknessInfo(selected);
  const bandCount=Object.keys(normalizePieceEdgeBands(u.edgeBands||{})).length;
  const matTxt=u.materialType&&u.materialType!=='genérico'?` · ${u.materialType}${u.materialCode?` (${u.materialCode})`:''}`:'';
  $('objectType').textContent = u.kind==='panel'
    ? `MDF · ${ti?.thickness||mm(u.height)} mm${matTxt}${bandCount?` · ${bandCount} fita(s)`:''}${machineCount?` · ${machineCount} usinagem(ns)`:''}`
    : (u.kind==='cylinder' ? 'Cilindro' : `Cubo${matTxt}${bandCount?` · ${bandCount} fita(s)`:''}${machineCount?` · ${machineCount} usinagem(ns)`:''}`);
  $('partNameInput').value=u.name || '';
  refreshPieceNamePresetSelect(u.name||'');
  $('dimW').value=mm(u.width); $('dimD').value=mm(u.depth); $('dimH').value=mm(u.height);
  $('posX').value=mm(selected.position.x);
  $('posY').value=mm(selected.position.y-u.height/2);
  $('posZ').value=mm(selected.position.z);
  const linkedBtn=$('openLinkedSpaceBtn');
  if(linkedBtn) linkedBtn.style.display=rootForObject(selected) ? 'block' : 'none';
  const drawerBtn=$('editDrawerSetBtn');
  if(drawerBtn) drawerBtn.style.display=u.drawerSetId?'block':'none';
  if(u.drawerSetId){
    const cfg=u.drawerConfig||{};
    $('objectType').textContent=(u.kind==='hardware-visual'?'Ferragem · ':'MDF · ')+(cfg.slideName||'Conjunto de gavetas')+` · gaveta ${(Number(u.drawerIndex)||0)+1}`;
  }

  // 1.100.96: a troca do lado da dobradiça só existe no menu de uma PORTA.
  const doorHingeSection=$('doorInspectorHingeSection');
  const isParametricDoor=!!u.doorConfig;
  if(doorHingeSection)doorHingeSection.style.display=isParametricDoor?'block':'none';
  if(isParametricDoor){
    const side=u.doorConfig?.hinge?.side==='right'?'right':'left';
    $('doorHingeLeftInspectorBtn')?.classList.toggle('active',side==='left');
    $('doorHingeRightInspectorBtn')?.classList.toggle('active',side==='right');
    const h=u.doorConfig?.hinge||{};
    const count=Math.max(1,Math.round(Number(h.count)||doorAutoHingeCount(mm(u.height))));
    const enabled=h.enabled!==false;
    $('doorInspectorHingeStatus').textContent=enabled
      ?`Atual: lado ${side==='left'?'esquerdo':'direito'} · ${count} dobradiça(s). Ao trocar, o copo da porta e os furos da lateral/divisão são refeitos no novo lado.`
      :'Esta porta está sem furação automática de dobradiça.';
  }

  const productionSection=$('pieceProductionSection');
  const doNotProduce=$('pieceDoNotProduce');
  const productionToggle=$('pieceProductionToggle');
  const canControlProduction=u.kind!=='cylinder'&&u.kind!=='hardware-visual';
  if(productionSection)productionSection.style.display=canControlProduction?'block':'none';
  if(doNotProduce)doNotProduce.checked=!!u.excludeFromCutList;
  productionToggle?.classList.toggle('isExcluded',!!u.excludeFromCutList);
  if(u.excludeFromCutList&&canControlProduction){
    $('objectType').textContent += ' · 🚫 NÃO PRODUZIR';
  }

  // 1.100.96: o veio pode girar 90° sem alterar a geometria/posição da peça.
  const grainSection=$('pieceGrainSection'),grainBtn=$('rotatePieceGrainBtn'),grainStatus=$('pieceGrainStatus');
  const hasGrain=canControlProduction&&!!u.materialGrain;
  const grainRot=normalizePieceGrainRotation(u.materialGrainRotation);
  if(grainSection)grainSection.style.display=hasGrain?'block':'none';
  if(grainBtn)grainBtn.textContent=grainRot===90?'↻ Voltar veio ao original':'↻ Rotacionar veio 90°';
  if(grainStatus){
    grainStatus.textContent=grainRot===90?'Veio rotacionado 90° nesta peça.':'Veio no sentido original desta peça.';
    grainStatus.classList.toggle('rotated',grainRot===90);
  }
  if(hasGrain)$('objectType').textContent += grainRot===90?' · VEIO 90°':' · VEIO 0°';

  // Os campos relativos sempre começam em zero quando a seleção muda/atualiza.
  resetPieceRelativeInputs();
}
function updateMeasureBadge(){
  if(selected){
    const u=selected.userData;
    measureBadge.style.display='block';
    measureBadge.style.color='var(--yellow)';
    measureBadge.textContent=`L ${mm(u.width)} · P ${mm(u.depth)} · A ${mm(u.height)} mm`;
    return;
  }
  if(selectedSpaceCell){
    const c=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId);
    if(c){
      const z=cellSize(c);
      measureBadge.style.display='block';
      measureBadge.style.color='#5fd080';
      measureBadge.textContent=`ESPAÇO · L ${mm(z.width)} · P ${mm(z.depth)} · A ${mm(z.height)} mm`;
      return;
    }
  }
  measureBadge.style.display='none';
}

function getBounds(mesh){
  mesh.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(mesh);
  const c=new THREE.Vector3(); b.getCenter(c);
  return { minX:b.min.x,maxX:b.max.x,centerX:c.x,minY:b.min.y,maxY:b.max.y,centerY:c.y,minZ:b.min.z,maxZ:b.max.z,centerZ:c.z };
}
function axisFeatures(bounds,axis){
  return axis==='x' ? [bounds.minX,bounds.centerX,bounds.maxX]
       : axis==='y' ? [bounds.minY,bounds.centerY,bounds.maxY]
       : [bounds.minZ,bounds.centerZ,bounds.maxZ];
}
function findMoveSnap(mesh,axis){
  const mine=getBounds(mesh), myF=axisFeatures(mine,axis);
  let best=null;
  for(const o of referenceMeshes(mesh)){
    const otherF=axisFeatures(getBounds(o),axis);
    for(const a of myF) for(const b of otherF){
      const delta=b-a;
      if(Math.abs(delta)<=SNAP_THRESHOLD && (!best || Math.abs(delta)<Math.abs(best.delta))) best={delta,line:b};
    }
  }
  return best;
}
function snapFaceCoordinate(mesh,axis,coord){
  let best=null;
  for(const o of referenceMeshes(mesh)){
    const f=axisFeatures(getBounds(o),axis);
    for(const val of f){
      const delta=val-coord;
      if(Math.abs(delta)<=SNAP_THRESHOLD && (!best || Math.abs(delta)<Math.abs(best.delta))) best={coord:val,delta,line:val};
    }
  }
  return best;
}

const guideMat=new THREE.LineBasicMaterial({color:COLORS.snap,depthTest:false,transparent:true,opacity:.95});
function guide(points, material=guideMat){ const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material); l.visible=false; l.renderOrder=99; scene.add(l); return l; }
const guideX=guide([new THREE.Vector3(0,.002,-15),new THREE.Vector3(0,.002,15)]);
const guideZ=guide([new THREE.Vector3(-15,.002,0),new THREE.Vector3(15,.002,0)]);
const guideY=guide([new THREE.Vector3(0,-10,0),new THREE.Vector3(0,20,0)]);
const axisMats={
  x:new THREE.LineBasicMaterial({color:0xff3b30,depthTest:false,transparent:true,opacity:.98}),
  y:new THREE.LineBasicMaterial({color:0x2979ff,depthTest:false,transparent:true,opacity:.98}),
  z:new THREE.LineBasicMaterial({color:0xffd23f,depthTest:false,transparent:true,opacity:.98})
};
const inferenceLines={
  x:guide([new THREE.Vector3(-20,0,0),new THREE.Vector3(20,0,0)],axisMats.x),
  y:guide([new THREE.Vector3(0,-20,0),new THREE.Vector3(0,20,0)],axisMats.y),
  z:guide([new THREE.Vector3(0,0,-20),new THREE.Vector3(0,0,20)],axisMats.z)
};
const moveGrip=new THREE.Mesh(new THREE.SphereGeometry(.012,12,12),new THREE.MeshBasicMaterial({color:COLORS.cyan,depthTest:false}));
moveGrip.visible=false; moveGrip.renderOrder=101; scene.add(moveGrip);
const cornerMarker=new THREE.Mesh(new THREE.SphereGeometry(.016,14,14),new THREE.MeshBasicMaterial({color:0x34d058,depthTest:false}));
cornerMarker.visible=false; cornerMarker.renderOrder=103; scene.add(cornerMarker);

