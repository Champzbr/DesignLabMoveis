// Engine do plano de corte: MaxRects, CNC por contorno e seccionadora.
// Mantém os algoritmos independentes da UI e do estado do editor.
export function createCutPlanEngine({partOrientations,cutPlanPartAreaMm2,nice,panelSawMaxCutMm=3050}){
  if(typeof partOrientations!=='function'||typeof cutPlanPartAreaMm2!=='function')
    throw new Error('CutPlanEngine: dependências inválidas');
  const PANEL_SAW_MAX_CUT_MM=Number(panelSawMaxCutMm)||3050;

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

  // ---------- 1.200.18 · CNC por contorno real ----------
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

  function panelSawStableJitter(part,seed,index){
    const text=`${seed}|${part?.partId||part?.cutCode||part?.name||''}|${Number(part?.faceW||0).toFixed(2)}|${Number(part?.faceH||0).toFixed(2)}|${index}`;
    let h=2166136261>>>0;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return .80+(h/4294967295)*.40;
  }
  function panelSawOrder(parts,mode='area'){
    const a=[...parts];
    if(/^jitter\d+$/.test(String(mode||''))){
      const seed=Math.max(1,Number(String(mode).replace('jitter',''))||1);
      return a.map((p,i)=>({p,i,j:panelSawStableJitter(p,seed,i)})).sort((x,y)=>
        (y.p.faceW*y.p.faceH*y.j-x.p.faceW*x.p.faceH*x.j)||
        (Math.max(y.p.faceW,y.p.faceH)-Math.max(x.p.faceW,x.p.faceH))||
        (x.i-y.i)
      ).map(x=>x.p);
    }
    if(mode==='source')return a;
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
    if(mode==='perimeter')return a.sort((x,y)=>
      ((y.faceW+y.faceH)-(x.faceW+x.faceH))||(y.faceW*y.faceH-x.faceW*x.faceH)
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

  // 1.200.18 · Seccionadora de pinça sem giro automático · plano mestre
  // Sequência física igual ao controlador:
  // 1) aplica o refilo/limpeza;
  // 2) faz TODOS os cortes primários da chapa (Step000);
  // 3) volta para a primeira tira, gira e processa essa tira até concluir;
  // 4) se um restante precisar de corte na outra direção, cria Step filho,
  //    pede novo giro e termina aquele ramo ANTES de seguir para a tira seguinte;
  // 5) só então passa para a tira 2, tira 3... até acabar a chapa.
  function panelSawTwoStageNewSheet(cfg,firstAxis){
    return {placements:[],cuts:[],freeRects:[],strips:[],panelFirstAxis:firstAxis,panelSequence:null};
  }
  function panelSawTwoStageLimits(cfg,firstAxis){
    // O Prepare/Mingli aplica o Trim apenas na borda de entrada de cada eixo.
    // Não reserva um segundo refilo na borda oposta: 2700 mm com Trim=10 deixa
    // 2690 mm úteis no eixo, exatamente como no Result.zaw original.
    const usableW=cfg.width-cfg.margin,usableH=cfg.height-cfg.margin;
    return firstAxis==='V'
      ? {cross:usableW,run:usableH}
      : {cross:usableH,run:usableW};
  }
  function panelSawTwoStageDims(o,firstAxis){
    return firstAxis==='V'
      ? {stripSize:o.w,pieceLen:o.h}
      : {stripSize:o.h,pieceLen:o.w};
  }
  function panelSawTwoStageCandidate(sheet,part,cfg,firstAxis){
    const lim=panelSawTwoStageLimits(cfg,firstAxis),gap=Math.max(0,cfg.gap||0);
    let best=null;
    for(const o of partOrientations(part,cfg)){
      const d=panelSawTwoStageDims(o,firstAxis);
      if(d.stripSize>lim.cross+.001||d.pieceLen>lim.run+.001)continue;
      for(let i=0;i<sheet.strips.length;i++){
        const strip=sheet.strips[i];
        if(Math.abs(strip.size-d.stripSize)>.01)continue;
        const start=strip.items.length?strip.used+gap:0;
        if(start+d.pieceLen>lim.run+.001)continue;
        const score=[0,lim.run-(start+d.pieceLen),o.rotated?1:0,i];
        if(!best||compareSheetScores(score,best.score)<0)best={o,d,stripIndex:i,newStrip:false,start,score};
      }
      const usedCross=sheet.strips.length?(sheet.strips[sheet.strips.length-1].start+sheet.strips[sheet.strips.length-1].size):0;
      const startCross=sheet.strips.length?usedCross+gap:0;
      if(startCross+d.stripSize<=lim.cross+.001){
        const score=[1,lim.cross-(startCross+d.stripSize),lim.run-d.pieceLen,o.rotated?1:0];
        if(!best||compareSheetScores(score,best.score)<0)best={o,d,newStrip:true,startCross,start:0,score};
      }
    }
    return best;
  }
  function panelSawTwoStageCommit(sheet,part,cfg,firstAxis,c){
    const gap=Math.max(0,cfg.gap||0);let strip;
    if(c.newStrip){
      strip={index:sheet.strips.length+1,start:c.startCross,size:c.d.stripSize,used:0,items:[]};
      sheet.strips.push(strip);
    }else strip=sheet.strips[c.stripIndex];
    const along=strip.items.length?strip.used+gap:0;
    const x=cfg.margin+(firstAxis==='V'?strip.start:along);
    const y=cfg.margin+(firstAxis==='V'?along:strip.start);
    const placed={...part,x,y,rotated:c.o.rotated,placedW:c.o.w,placedH:c.o.h,panelStrip:strip.index,panelStripAlong:along};
    sheet.placements.push(placed);
    strip.items.push({part:placed,along,length:c.d.pieceLen});
    strip.used=along+c.d.pieceLen;
    return placed;
  }
  function panelSawTwoStageFinalize(sheet,cfg,firstAxis){
    const lim=panelSawTwoStageLimits(cfg,firstAxis),gap=Math.max(0,cfg.gap||0),m=cfg.margin;
    const cuts=[];let order=0,mixedTrimCount=0;

    // ETAPA 1: formar as faixas sem girar a chapa durante a sequência.
    for(const strip of sheet.strips){
      const edge=strip.start+strip.size;
      if(edge+gap/2<lim.cross-.001){
        const cut=firstAxis==='V'
          ? {orientation:'V',x1:m+edge+gap/2,y1:m,x2:m+edge+gap/2,y2:m+lim.run,length:lim.run}
          : {orientation:'H',x1:m,y1:m+edge+gap/2,x2:m+lim.run,y2:m+edge+gap/2,length:lim.run};
        cut.order=++order;cut.stage=1;cut.stripNo=strip.index;cut.action='FORMAR_FAIXA';
        cut.description=`Etapa 1 · formar faixa F${strip.index} · ${nice(strip.size)} mm`;
        cuts.push(cut);
      }
    }

    // ETAPA 2: cada faixa é girada manualmente e recebe os cortes no sentido
    // longitudinal. Na 1.300.26 uma faixa pode conter peças de larguras
    // transversais diferentes. Quando isso acontece, a saída daquela peça pede
    // um novo giro e um corte transversal de destopo (Etapa 3), exatamente como o plano
    // nativo do Mingli/Prepare enviado como referência.
    for(const strip of sheet.strips){
      strip.crossCuts=[];strip.trimCuts=[];
      for(let i=0;i<strip.items.length;i++){
        const it=strip.items[i],end=it.along+it.length;
        const hasAfter=i<strip.items.length-1 || end+gap/2<lim.run-.001;
        if(hasAfter){
          const cut=firstAxis==='V'
            ? {orientation:'H',x1:m+strip.start,y1:m+end+gap/2,x2:m+strip.start+strip.size,y2:m+end+gap/2,length:strip.size}
            : {orientation:'V',x1:m+end+gap/2,y1:m+strip.start,x2:m+end+gap/2,y2:m+strip.start+strip.size,length:strip.size};
          cut.order=++order;cut.stage=2;cut.stripNo=strip.index;cut.action='CORTE_FAIXA';
          cut.description=`Etapa 2 · F${strip.index} · ${nice(it.length)} mm · ${it.part.cutCode||it.part.name||'peça'}`;
          cuts.push(cut);strip.crossCuts.push(cut);
        }

        const crossSize=Math.max(.001,Number(it.crossSize)||strip.size);
        const crossDelta=Math.max(0,Number(strip.size||0)-crossSize);
        if(crossDelta>.01 && panelSawNestedRemainderOk(crossDelta,gap)){
          const cut=firstAxis==='V'
            ? {
                orientation:'V',
                x1:m+strip.start+crossSize+gap/2,y1:m+it.along,
                x2:m+strip.start+crossSize+gap/2,y2:m+it.along+it.length,
                length:it.length
              }
            : {
                orientation:'H',
                x1:m+it.along,y1:m+strip.start+crossSize+gap/2,
                x2:m+it.along+it.length,y2:m+strip.start+crossSize+gap/2,
                length:it.length
              };
          cut.order=++order;cut.stage=3;cut.stripNo=strip.index;cut.action='DESTOPAR_FAIXA';
          cut.description=`Etapa 3 · F${strip.index} · girar saída e destopar ${nice(crossSize)} mm · ${it.part.cutCode||it.part.name||'peça'}`;
          cuts.push(cut);strip.trimCuts.push(cut);mixedTrimCount++;
        }
      }
    }
    sheet.cuts=cuts;

    // Sobras reais do plano. Além da cauda final da faixa, registra também a
    // sobra transversal criada por uma peça menor dentro de uma faixa maior.
    const free=[];
    for(const strip of sheet.strips){
      strip.nestedPlans=Array.isArray(strip.nestedPlans)?strip.nestedPlans:[];
      const start=strip.used+(strip.items.length?gap:0),remain=lim.run-start;
      if(remain>.001){
        if(firstAxis==='V')free.push({x:strip.start,y:start,w:strip.size,h:remain,kind:'strip-tail',stripIndex:strip.index});
        else free.push({x:start,y:strip.start,w:remain,h:strip.size,kind:'strip-tail',stripIndex:strip.index});
      }
      for(const it of strip.items){
        const crossSize=Math.max(.001,Number(it.crossSize)||strip.size);
        const rem=Math.max(0,Number(strip.size||0)-crossSize-gap);
        if(rem<=.001)continue;
        if(firstAxis==='V'){
          free.push({
            x:strip.start+crossSize+gap,y:it.along,w:rem,h:it.length,
            kind:'item-cross-tail',stripIndex:strip.index
          });
        }else{
          free.push({
            x:it.along,y:strip.start+crossSize+gap,w:it.length,h:rem,
            kind:'item-cross-tail',stripIndex:strip.index
          });
        }
      }
    }
    const usedCross=sheet.strips.length?(sheet.strips[sheet.strips.length-1].start+sheet.strips[sheet.strips.length-1].size+gap):0;
    if(lim.cross-usedCross>.001){
      if(firstAxis==='V')free.push({x:usedCross,y:0,w:lim.cross-usedCross,h:lim.run,kind:'cross-tail'});
      else free.push({x:0,y:usedCross,w:lim.run,h:lim.cross-usedCross,kind:'cross-tail'});
    }
    sheet.freeRects=free;
    sheet.panelSequence={
      firstAxis,
      turns:sheet.strips.length+mixedTrimCount,
      mixedTrimCount,
      refilo:cfg.margin,
      stage1Cuts:cuts.filter(c=>c.stage===1),
      strips:sheet.strips.map(strip=>({
        number:strip.index,size:strip.size,used:strip.used,
        items:strip.items.map(it=>({
          code:it.part.cutCode||'?',name:it.part.name||'Peça',length:it.length,
          crossSize:Math.max(.001,Number(it.crossSize)||strip.size),
          needsCrossTrim:Math.max(0,Number(strip.size||0)-(Number(it.crossSize)||strip.size))>.01,
          faceW:it.part.faceW,faceH:it.part.faceH
        })),
        cuts:strip.crossCuts||[],
        trimCuts:strip.trimCuts||[],
        nestedPlans:strip.nestedPlans||[]
      }))
    };
    return sheet;
  }

  // 1.300.25 · REAPROVEITAMENTO DE CAUDAS / SOBRAS INTERNAS
  // ---------------------------------------------------------------------------
  // O plano mestre clássico é deliberadamente simples: Step000 cria faixas e
  // cada faixa recebe um segundo estágio transversal. Esse formato é ótimo para
  // a máquina, mas não consegue colocar uma peça menor dentro da cauda de uma
  // faixa maior (ex.: peça 378x150 dentro de uma sobra 1840x572). A partir daqui
  // tentamos eliminar a ÚLTIMA chapa inteira usando somente essas caudas, sem
  // mover as peças já posicionadas nas chapas anteriores.
  //
  // O encaixe abaixo é guilhotinado de verdade. Cada inserção cria no máximo
  // dois cortes ortogonais e guarda uma árvore binária; essa mesma árvore é
  // usada pelo desenho, CSV e pelo gerador Mingli para criar Steps adicionais.
  function panelSawNestedFreeLeaves(node,out=[]){
    if(!node)return out;
    if(node.kind==='free')out.push(node);
    else if(node.kind==='split'){panelSawNestedFreeLeaves(node.a,out);panelSawNestedFreeLeaves(node.b,out);}
    return out;
  }
  function panelSawNestedCloneTree(node){
    if(!node)return null;
    const c={...node};
    if(node.a)c.a=panelSawNestedCloneTree(node.a);
    if(node.b)c.b=panelSawNestedCloneTree(node.b);
    return c;
  }
  function panelSawNestedRemainderOk(rem,gap){
    return rem<=.01 || rem>=Math.max(.01,gap)-.001;
  }
  function panelSawNestedCandidateScore(leaf,o,style,rotated,binIndex){
    const rw=Math.max(0,leaf.w-o.w),rh=Math.max(0,leaf.h-o.h);
    const stylePenalty=(style==='V'?(rw<=rh):(rh<rw))?0:1;
    return [leaf.w*leaf.h-o.w*o.h,Math.max(rw,rh),Math.min(rw,rh),stylePenalty,rotated?0.02:0,binIndex];
  }
  function panelSawNestedApplyPlacement(leaf,placement,gap,style){
    const pw=placement.placedW,ph=placement.placedH;
    const rw=Math.max(0,leaf.w-pw),rh=Math.max(0,leaf.h-ph);
    function makeNode(x,y,w,h){return {kind:'free',x,y,w:Math.max(0,w),h:Math.max(0,h)};}
    function makePiece(node){node.kind='piece';node.placement=placement;delete node.a;delete node.b;return node;}
    const splitX=rw>.01,splitY=rh>.01;
    if(!splitX&&!splitY){makePiece(leaf);return leaf;}
    if((style==='V'&&splitX)||!splitY){
      const left=makeNode(leaf.x,leaf.y,pw,leaf.h);
      const rightW=Math.max(0,leaf.w-pw-gap),right=rightW>.001?makeNode(leaf.x+pw+gap,leaf.y,rightW,leaf.h):null;
      leaf.kind='split';leaf.axis='X';leaf.gap=gap;leaf.a=left;leaf.b=right;
      if(splitY){
        const top=makeNode(left.x,left.y,pw,ph),bottomH=Math.max(0,left.h-ph-gap),bottom=bottomH>.001?makeNode(left.x,left.y+ph+gap,pw,bottomH):null;
        left.kind='split';left.axis='Y';left.gap=gap;left.a=top;left.b=bottom;makePiece(top);
      }else makePiece(left);
      return leaf;
    }
    const top=makeNode(leaf.x,leaf.y,leaf.w,ph);
    const bottomH=Math.max(0,leaf.h-ph-gap),bottom=bottomH>.001?makeNode(leaf.x,leaf.y+ph+gap,leaf.w,bottomH):null;
    leaf.kind='split';leaf.axis='Y';leaf.gap=gap;leaf.a=top;leaf.b=bottom;
    if(splitX){
      const left=makeNode(top.x,top.y,pw,ph),rightW=Math.max(0,top.w-pw-gap),right=rightW>.001?makeNode(top.x+pw+gap,top.y,rightW,ph):null;
      top.kind='split';top.axis='X';top.gap=gap;top.a=left;top.b=right;makePiece(left);
    }else makePiece(top);
    return leaf;
  }
  function panelSawNestedPartOrders(parts){
    const source=[...parts];
    const orderBy=fn=>[...source].sort((a,b)=>fn(b)-fn(a));
    const orders=[
      orderBy(p=>(Number(p.faceW)||0)*(Number(p.faceH)||0)),
      orderBy(p=>Math.max(Number(p.faceW)||0,Number(p.faceH)||0)),
      orderBy(p=>Number(p.faceW)||0),
      orderBy(p=>Number(p.faceH)||0),
      [...source]
    ];
    // remove ordens idênticas sem depender de partId ser único
    const seen=new Set();return orders.filter(arr=>{const k=arr.map(p=>p.partId||p.cutCode||`${p.faceW}x${p.faceH}`).join('|');if(seen.has(k))return false;seen.add(k);return true;});
  }
  function panelSawTryNestedPack(parts,tailBins,cfg){
    const gap=Math.max(0,Number(cfg.gap)||0),orders=panelSawNestedPartOrders(parts);
    let best=null;
    for(const ordered of orders){
      for(const styleBias of ['auto','V','H']){
        const bins=tailBins.map((b,i)=>({...b,binIndex:i,root:{kind:'free',x:0,y:0,w:b.w,h:b.h}}));
        const placed=[];let failed=false;
        for(const part of ordered){
          let choice=null;
          for(let bi=0;bi<bins.length;bi++){
            const bin=bins[bi];
            for(const leaf of panelSawNestedFreeLeaves(bin.root,[])){
              for(const o of partOrientations(part,cfg)){
                const rw=leaf.w-o.w,rh=leaf.h-o.h;
                if(rw<-.001||rh<-.001||!panelSawNestedRemainderOk(rw,gap)||!panelSawNestedRemainderOk(rh,gap))continue;
                for(const style of ['V','H']){
                  const score=panelSawNestedCandidateScore(leaf,o,style,o.rotated,bi);
                  if(styleBias!=='auto'&&style!==styleBias)score[3]+=.35;
                  if(!choice||compareSheetScores(score,choice.score)<0)choice={bin,leaf,o,style,score};
                }
              }
            }
          }
          if(!choice){failed=true;break;}
          const placement={part,localX:choice.leaf.x,localY:choice.leaf.y,placedW:choice.o.w,placedH:choice.o.h,rotated:choice.o.rotated};
          panelSawNestedApplyPlacement(choice.leaf,placement,gap,choice.style);placed.push({...placement,binIndex:choice.bin.binIndex});
        }
        if(failed)continue;
        const freeArea=bins.reduce((n,b)=>n+panelSawNestedFreeLeaves(b.root,[]).reduce((m,r)=>m+r.w*r.h,0),0);
        const fragments=bins.reduce((n,b)=>n+panelSawNestedFreeLeaves(b.root,[]).length,0);
        const usedBins=bins.filter(b=>b.root.kind!=='free').length;
        const score=[usedBins,fragments,freeArea];
        if(!best||compareSheetScores(score,best.score)<0)best={bins,placed,score};
      }
    }
    return best;
  }
  function panelSawNestedTreeCuts(plan,node,cuts,state,depth=0){
    if(!node||node.kind!=='split')return;
    const gap=Math.max(0,Number(node.gap)||0),a=node.a;
    if(a){
      const ax=plan.absX+a.x,ay=plan.absY+a.y;
      const cut=node.axis==='X'
        ? {orientation:'V',x1:ax+a.w+gap/2,y1:plan.absY+node.y,x2:ax+a.w+gap/2,y2:plan.absY+node.y+node.h,length:node.h}
        : {orientation:'H',x1:plan.absX+node.x,y1:ay+a.h+gap/2,x2:plan.absX+node.x+node.w,y2:ay+a.h+gap/2,length:node.w};
      cut.order=++state.order;cut.stage=3+depth;cut.stripNo=plan.stripIndex;cut.action='REAPROVEITAR_SOBRA';
      cut.description=`Etapa ${cut.stage} · reaproveitar sobra F${plan.stripIndex}`;cuts.push(cut);
    }
    panelSawNestedTreeCuts(plan,node.a,cuts,state,depth+1);panelSawNestedTreeCuts(plan,node.b,cuts,state,depth+1);
  }
  function panelSawCollectNestedFreeRects(plan,node,out=[]){
    if(!node)return out;
    if(node.kind==='free')out.push({x:plan.tailX+node.x,y:plan.tailY+node.y,w:node.w,h:node.h,kind:'nested-tail',stripIndex:plan.stripIndex,nestedPlanId:plan.id});
    else if(node.kind==='split'){panelSawCollectNestedFreeRects(plan,node.a,out);panelSawCollectNestedFreeRects(plan,node.b,out);}
    return out;
  }
  function panelSawTrySalvageLastSheet(sheets,cfg,firstAxis){
    if(!Array.isArray(sheets)||sheets.length<2)return false;
    const source=sheets[sheets.length-1],sourceParts=[...(source.placements||[])];
    if(!sourceParts.length)return false;
    const gap=Math.max(0,Number(cfg.gap)||0),m=Math.max(0,Number(cfg.margin)||0),tails=[];
    for(let si=0;si<sheets.length-1;si++){
      const sh=sheets[si];
      for(let ri=0;ri<(sh.freeRects||[]).length;ri++){
        const r=sh.freeRects[ri];if(r.kind!=='strip-tail'||!r.stripIndex)continue;
        // Para transformar a antiga sobra terminal em uma saída CutN do Step da
        // faixa, reservamos um kerf no fim do curso. Assim a soma Trim + cortes
        // + KnifeWidth nunca ultrapassa a dimensão física da chapa.
        const w=firstAxis==='H'?Math.max(0,r.w-gap):r.w;
        const h=firstAxis==='V'?Math.max(0,r.h-gap):r.h;
        if(w<=.01||h<=.01)continue;
        tails.push({sheetIndex:si,rectIndex:ri,tail:r,w,h,stripIndex:r.stripIndex});
      }
    }
    if(!tails.length)return false;
    const packed=panelSawTryNestedPack(sourceParts,tails,cfg);if(!packed)return false;

    // Commit somente depois que TODAS as peças da última chapa couberem. Até
    // aqui nenhuma geometria do plano original foi alterada.
    const byBin=new Map();
    packed.placed.forEach(pp=>{if(!byBin.has(pp.binIndex))byBin.set(pp.binIndex,[]);byBin.get(pp.binIndex).push(pp);});
    const consumedBySheet=new Map();
    for(const [binIndex,pps] of byBin){
      const bin=packed.bins[binIndex],meta=tails[binIndex],target=sheets[meta.sheetIndex],strip=target.strips.find(st=>st.index===meta.stripIndex);
      if(!strip)continue;
      const plan={
        id:`nested_${meta.sheetIndex}_${meta.stripIndex}_${Math.random().toString(36).slice(2,8)}`,
        stripIndex:meta.stripIndex,tailX:meta.tail.x,tailY:meta.tail.y,w:meta.w,h:meta.h,
        absX:m+meta.tail.x,absY:m+meta.tail.y,runLength:firstAxis==='H'?meta.w:meta.h,
        tree:bin.root,placements:[],cuts:[]
      };
      for(const pp of pps){
        const placed={...pp.part,x:plan.absX+pp.localX,y:plan.absY+pp.localY,rotated:pp.rotated,placedW:pp.placedW,placedH:pp.placedH,panelStrip:strip.index,panelNested:true,panelNestedPlanId:plan.id};
        // Faz cada folha da árvore apontar para a MESMA peça física usada no
        // desenho/grupo, não para a cópia antiga da última chapa.
        const rewrite=node=>{if(!node)return;if(node.kind==='piece'&&node.placement?.part===pp.part)node.placement={...node.placement,part:placed};else if(node.kind==='split'){rewrite(node.a);rewrite(node.b);}};rewrite(plan.tree);
        plan.placements.push(placed);target.placements.push(placed);
      }
      strip.nestedPlans=Array.isArray(strip.nestedPlans)?strip.nestedPlans:[];strip.nestedPlans.push(plan);
      const state={order:(target.cuts||[]).reduce((n,c)=>Math.max(n,Number(c.order)||0),0)};
      panelSawNestedTreeCuts(plan,plan.tree,plan.cuts,state,0);target.cuts.push(...plan.cuts);
      if(!consumedBySheet.has(meta.sheetIndex))consumedBySheet.set(meta.sheetIndex,new Set());consumedBySheet.get(meta.sheetIndex).add(meta.rectIndex);
    }
    for(const [sheetIndex,set] of consumedBySheet){
      const sh=sheets[sheetIndex],kept=(sh.freeRects||[]).filter((_,i)=>!set.has(i)),added=[];
      for(const st of sh.strips||[])for(const plan of (st.nestedPlans||[]))panelSawCollectNestedFreeRects(plan,plan.tree,added);
      sh.freeRects=[...kept,...added];
      if(sh.panelSequence){
        sh.panelSequence.nestedSalvage=true;
        sh.panelSequence.strips=(sh.strips||[]).map(strip=>({
          number:strip.index,size:strip.size,used:strip.used,
          items:strip.items.map(it=>({
            code:it.part.cutCode||'?',name:it.part.name||'Peça',length:it.length,
            crossSize:Math.max(.001,Number(it.crossSize)||strip.size),
            needsCrossTrim:Math.max(0,Number(strip.size||0)-(Number(it.crossSize)||strip.size))>.01,
            faceW:it.part.faceW,faceH:it.part.faceH
          })),
          cuts:strip.crossCuts||[],trimCuts:strip.trimCuts||[],nestedPlans:strip.nestedPlans||[]
        }));
      }
    }
    sheets.pop();
    return true;
  }

  // 1.200.18 · PLANO MESTRE DA SECCIONADORA
  // ---------------------------------------------------------------------------
  // A versão anterior montava as faixas enquanto já distribuía as peças entre
  // chapas. Isso podia "fechar" uma chapa cedo e impedir combinações melhores
  // que o próprio plano visual já mostrava (por exemplo J + C na mesma faixa).
  //
  // Agora fazemos em duas fases GLOBAIS:
  // 1) formar as melhores faixas usando TODAS as peças do material;
  // 2) distribuir essas faixas prontas entre as chapas por best-fit.
  //
  // Resultado: plano visual, impressão, CSV e Mingli .ZAW usam a MESMA geometria
  // e a MESMA lista de faixas. O exportador não cria um segundo plano escondido.
  function panelSawGlobalStripCandidate(strips,part,cfg,firstAxis,bias='compact'){
    const lim=panelSawTwoStageLimits(cfg,firstAxis),gap=Math.max(0,cfg.gap||0);
    const allowMixed=bias==='mixed';
    let best=null;
    for(const o of partOrientations(part,cfg)){
      const d=panelSawTwoStageDims(o,firstAxis);
      if(d.stripSize>lim.cross+.001||d.pieceLen>lim.run+.001)continue;

      // 1.300.26 · FAIXA MISTA / DESTOPO
      // Além de completar uma faixa da MESMA medida, uma tentativa separada
      // pode colocar uma peça MENOR dentro de uma faixa maior. A peça ocupa o
      // mesmo corte longitudinal e depois a máquina pede um novo giro/destopo
      // para reduzir somente a largura transversal daquela saída.
      //
      // Isso reproduz a lógica do Result-2.zaw da máquina: por exemplo uma peça
      // 1094x600 abre a faixa de 600; no restante da MESMA faixa entra 1561x572
      // e o controlador cria um Step adicional para destopar 572.
      for(let i=0;i<strips.length;i++){
        const st=strips[i],crossDelta=Number(st.size||0)-d.stripSize;
        const exact=Math.abs(crossDelta)<=.01;
        if(!exact){
          if(!allowMixed||crossDelta<-.001)continue;
          // Se a diferença for menor que a espessura da serra, não existe sobra
          // física suficiente para criar o corte transversal adicional.
          if(!panelSawNestedRemainderOk(crossDelta,gap))continue;
        }
        const along=st.items.length?st.used+gap:0;
        if(along+d.pieceLen>lim.run+.001)continue;
        const remain=lim.run-(along+d.pieceLen);
        const crossWaste=exact?0:Math.max(0,crossDelta)*d.pieceLen;
        const score=[0,exact?0:1,crossWaste,Math.max(0,crossDelta),remain,o.rotated?0.05:0,i];
        if(!best||compareSheetScores(score,best.score)<0)best={newStrip:false,stripIndex:i,o,d,along,score,mixed:!exact};
      }

      // Se precisar de faixa nova, prefere a menor largura de faixa possível.
      // Isto aumenta a chance de colocar mais faixas na mesma chapa.
      const rotatePenalty=bias==='unrotated'?(o.rotated?1:0):0;
      const runRemain=lim.run-d.pieceLen;
      const score=[1,0,0,d.stripSize,runRemain,rotatePenalty,o.rotated?0.03:0];
      if(!best||compareSheetScores(score,best.score)<0)best={newStrip:true,o,d,along:0,score,mixed:false};
    }
    return best;
  }
  function panelSawBuildGlobalStrips(parts,cfg,firstAxis,orderMode,bias='compact'){
    const ordered=panelSawOrder(parts,orderMode),gap=Math.max(0,cfg.gap||0),strips=[];
    for(const part of ordered){
      const c=panelSawGlobalStripCandidate(strips,part,cfg,firstAxis,bias);
      if(!c)throw new Error(`${part.name}: ${nice(part.faceW)} × ${nice(part.faceH)} mm não cabe no plano de seccionadora.`);
      let st;
      if(c.newStrip){st={size:c.d.stripSize,used:0,items:[],sourceOrder:strips.length};strips.push(st);}else st=strips[c.stripIndex];
      const along=st.items.length?st.used+gap:0;
      st.items.push({
        rawPart:part,o:c.o,along,length:c.d.pieceLen,
        crossSize:c.d.stripSize,
        needsCrossTrim:Math.max(0,Number(st.size||0)-c.d.stripSize)>.01
      });
      st.used=along+c.d.pieceLen;
    }
    return strips;
  }
  function panelSawBestStripSubset(remaining,cross,gap){
    if(!remaining.length)return [];
    // Cada faixa consome size + gap, exceto a última. Somando gap também à
    // capacidade, a inequação fica simples: sum(size+gap) <= cross+gap.
    const cap=Math.max(1,Math.floor(cross+gap+.0001));
    const weights=remaining.map(st=>Math.max(1,Math.ceil(Number(st.size||0)+gap-.000001)));
    // Valor = área REAL das peças daquela faixa. Assim as primeiras chapas
    // recebem o máximo de material possível e a sobra fica concentrada na
    // última chapa, em vez de espalhada entre todas.
    const values=remaining.map(st=>(st.items||[]).reduce((n,it)=>{
      const p=it.rawPart||it.part||{};return n+Math.max(0,Number(p.faceW)||0)*Math.max(0,Number(p.faceH)||0);
    },0));
    const best=new Float64Array(cap+1);best.fill(-1);best[0]=0;
    // Cadeia imutável: evita corromper a reconstrução quando um estado de DP
    // é melhorado por outra peça em iterações posteriores.
    const path=new Array(cap+1).fill(null);
    for(let i=0;i<weights.length;i++){
      const w=weights[i],value=values[i];if(w>cap)continue;
      for(let sum=cap-w;sum>=0;sum--){
        if(best[sum]<0)continue;
        const next=sum+w,nv=best[sum]+value;
        if(nv>best[next]+.0001){best[next]=nv;path[next]={item:i,prev:path[sum]};}
      }
    }
    let target=0;
    for(let sum=1;sum<=cap;sum++)if(best[sum]>best[target]+.0001||(Math.abs(best[sum]-best[target])<=.0001&&sum>target))target=sum;
    if(target<=0)return [0];
    const idx=[];let node=path[target],guard=0;
    while(node&&guard++<=remaining.length){idx.push(node.item);node=node.prev;}
    // Segurança contra qualquer repetição acidental.
    const unique=[...new Set(idx)];
    unique.sort((a,b)=>remaining[b].size-remaining[a].size);
    const physical=()=>unique.reduce((n,i)=>n+Number(remaining[i].size||0),0)+Math.max(0,unique.length-1)*gap;
    while(unique.length>1&&physical()>cross+.001)unique.pop();
    return unique.length?unique:[0];
  }
  function panelSawStripRealArea(st){
    return (st?.items||[]).reduce((n,it)=>{
      const p=it.rawPart||it.part||{};
      return n+Math.max(0,Number(p.faceW)||0)*Math.max(0,Number(p.faceH)||0);
    },0);
  }
  function panelSawStripBinsBestFit(strips,cross,gap){
    // A faixa consome size+gap. A capacidade recebe +gap para que a última faixa
    // termine exatamente no limite sem exigir uma folga depois dela.
    const cap=Math.max(0,cross)+gap;
    const ordered=[...strips].sort((a,b)=>
      (Number(b.size||0)-Number(a.size||0))||
      (panelSawStripRealArea(b)-panelSawStripRealArea(a))||
      (Number(b.used||0)-Number(a.used||0))||
      (Number(a.sourceOrder||0)-Number(b.sourceOrder||0))
    );
    const bins=[];
    for(const st of ordered){
      const weight=Math.max(0,Number(st.size)||0)+gap;
      let best=-1,bestRemain=Infinity;
      for(let i=0;i<bins.length;i++){
        const remain=cap-(bins[i].used+weight);
        if(remain>=-.001&&remain<bestRemain-.001){best=i;bestRemain=remain;}
      }
      if(best<0)bins.push({used:weight,items:[st]});
      else{bins[best].used+=weight;bins[best].items.push(st);}
    }
    return bins;
  }
  function panelSawTryExactStripBins(strips,cross,gap,target,{nodeLimit=120000,timeLimitMs=32}={}){
    // Refinamento exato e limitado: só entra quando o Best-Fit ainda está acima
    // do limite matemático. A busca é podada por simetria e por tempo para não
    // travar celular/projetos grandes.
    const cap=Math.max(0,cross)+gap;
    const items=[...strips].map(st=>({st,weight:Math.max(0,Number(st.size)||0)+gap,area:panelSawStripRealArea(st)}))
      .sort((a,b)=>(b.weight-a.weight)||(b.area-a.area));
    if(!items.length)return [];
    if(items[0].weight>cap+.001)return null;
    const started=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
    let nodes=0,timedOut=false,solution=null;
    const used=new Array(target).fill(0),binItems=Array.from({length:target},()=>[]);
    const suffix=new Array(items.length+1).fill(0);
    for(let i=items.length-1;i>=0;i--)suffix[i]=suffix[i+1]+items[i].weight;
    function now(){return (typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();}
    function dfs(pos){
      if(solution||timedOut)return !!solution;
      if(++nodes>nodeLimit||now()-started>timeLimitMs){timedOut=true;return false;}
      if(pos>=items.length){solution=binItems.map(a=>a.slice());return true;}
      const free=target*cap-used.reduce((n,v)=>n+v,0);
      if(suffix[pos]>free+.001)return false;
      const item=items[pos],candidates=[];
      for(let i=0;i<target;i++)if(used[i]+item.weight<=cap+.001)candidates.push(i);
      // Best-fit primeiro. Estados com a mesma ocupação são equivalentes.
      candidates.sort((a,b)=>used[b]-used[a]);
      const seen=new Set();
      for(const bi of candidates){
        const sig=Math.round(used[bi]*1000);if(seen.has(sig))continue;seen.add(sig);
        const was=used[bi];used[bi]+=item.weight;binItems[bi].push(item.st);
        if(dfs(pos+1))return true;
        binItems[bi].pop();used[bi]=was;
        if(was<.001)break;
      }
      return false;
    }
    dfs(0);
    return solution;
  }
  function panelSawPackStripsGlobally(strips,cross,gap){
    if(!strips.length)return [];
    const cap=Math.max(0,cross)+gap;
    const total=[...strips].reduce((n,st)=>n+Math.max(0,Number(st.size)||0)+gap,0);
    const lower=Math.max(1,Math.ceil((total-.001)/Math.max(1,cap)));
    let bins=panelSawStripBinsBestFit(strips,cross,gap);
    // Se o Best-Fit já alcançou o limite matemático, o nº de chapas é ótimo.
    // Caso contrário, tenta provar/achar uma solução menor com busca limitada.
    if(bins.length>lower&&strips.length<=44){
      for(let target=lower;target<bins.length;target++){
        const exact=panelSawTryExactStripBins(strips,cross,gap,target,{
          nodeLimit:strips.length<=28?220000:90000,
          timeLimitMs:strips.length<=28?55:28
        });
        if(exact){bins=exact.map(items=>({items,used:items.reduce((n,st)=>n+Math.max(0,Number(st.size)||0)+gap,0)}));break;}
      }
    }
    // Mostra as chapas mais cheias primeiro e concentra a sobra nas últimas.
    bins.sort((a,b)=>{
      const aa=(a.items||[]).reduce((n,st)=>n+panelSawStripRealArea(st),0),ba=(b.items||[]).reduce((n,st)=>n+panelSawStripRealArea(st),0);
      return (ba-aa)||(b.used-a.used);
    });
    return bins.map(b=>b.items||[]);
  }
  function panelSawPackGlobalStrips(strips,cfg,firstAxis){
    const lim=panelSawTwoStageLimits(cfg,firstAxis),gap=Math.max(0,cfg.gap||0);
    // 1.300.25: a distribuição das faixas agora é GLOBAL. Antes o algoritmo
    // enchia a primeira chapa ao máximo e só depois olhava as seguintes; isso
    // podia deixar uma peça sozinha na última chapa mesmo existindo uma
    // combinação de faixas com menos chapas. Agora o objetivo nº 1 é minimizar
    // o total de chapas físicas; só depois concentramos a sobra.
    const packedSheets=panelSawPackStripsGlobally(strips,lim.cross,gap);

    const built=[];
    for(const list of packedSheets){
      const sheet=panelSawTwoStageNewSheet(cfg,firstAxis);let cross=0;
      // Ordem física continua simples: faixas maiores primeiro; empate = faixa
      // mais preenchida. Isso preserva a árvore Mingli/Step já validada.
      const physical=[...list].sort((a,b)=>(b.size-a.size)||(b.used-a.used)||(a.sourceOrder-b.sourceOrder));
      physical.forEach((src,idx)=>{
        const start=idx?cross+gap:0;
        const strip={index:idx+1,start,size:src.size,used:src.used,items:[]};
        for(const it of src.items){
          const x=cfg.margin+(firstAxis==='V'?start:it.along);
          const y=cfg.margin+(firstAxis==='V'?it.along:start);
          const crossSize=Math.max(.001,Number(it.crossSize)||src.size);
          const needsCrossTrim=Math.max(0,Number(src.size||0)-crossSize)>.01;
          const placed={
            ...it.rawPart,x,y,rotated:it.o.rotated,placedW:it.o.w,placedH:it.o.h,
            panelStrip:strip.index,panelStripAlong:it.along,
            panelStripCrossSize:crossSize,panelNeedsCrossTrim:needsCrossTrim
          };
          sheet.placements.push(placed);
          strip.items.push({part:placed,along:it.along,length:it.length,crossSize,needsCrossTrim});
        }
        sheet.strips.push(strip);cross=start+src.size;
      });
      sheet._globalStripRunWaste=sheet.strips.reduce((n,st)=>n+Math.max(0,lim.run-st.used),0);
      sheet._globalCrossWaste=Math.max(0,lim.cross-cross);
      built.push(panelSawTwoStageFinalize(sheet,cfg,firstAxis));
    }
    // 1.300.25: antes de aceitar uma chapa final pouco ocupada, tenta mover
    // TODAS as peças dela para as caudas das faixas das chapas anteriores.
    // Só confirma quando a chapa inteira desaparece; nunca piora um plano que
    // já estava válido. Uma passagem é intencionalmente conservadora para não
    // reprocessar sobras já aninhadas sem necessidade.
    panelSawTrySalvageLastSheet(built,cfg,firstAxis);
    return built;
  }
  function packPanelSawTwoStageAttempt(parts,cfg,firstAxis,orderMode,bias='compact'){
    const strips=panelSawBuildGlobalStrips(parts,cfg,firstAxis,orderMode,bias);
    return panelSawPackGlobalStrips(strips,cfg,firstAxis);
  }
  function panelSawTwoStageScore(sheets,cfg){
    const turns=sheets.reduce((n,s)=>n+(s.panelSequence?.turns||0),0);
    const cutLength=sheets.reduce((n,s)=>n+(s.cuts||[]).reduce((m,c)=>m+(c.length||0),0),0);
    const cutCount=sheets.reduce((n,s)=>n+(s.cuts||[]).length,0);
    const nestedCuts=sheets.reduce((n,s)=>n+(s.cuts||[]).filter(c=>Number(c.stage)>=3).length,0);
    const runWaste=sheets.reduce((n,s)=>n+(s._globalStripRunWaste||0),0);
    const crossWaste=sheets.reduce((n,s)=>n+(s._globalCrossWaste||0),0);
    const fragments=sheets.reduce((n,s)=>n+(s.freeRects||[]).length,0);
    let largestFree=0,freeConcentration=0;
    for(const s of sheets)for(const r of (s.freeRects||[])){
      const a=Math.max(0,Number(r.w)||0)*Math.max(0,Number(r.h)||0);
      largestFree=Math.max(largestFree,a);freeConcentration+=a*a;
    }
    // Objetivo principal: menor número de chapas. Em empate, concentra a sobra
    // em áreas grandes/reaproveitáveis antes de penalizar cortes e giros extras.
    return [sheets.length,-largestFree,-freeConcentration,fragments,nestedCuts,turns,cutCount,cutLength,runWaste,crossWaste];
  }
  function packPartsIntoSheetsPanelSaw(parts,cfg){
    const machineSide=Math.max(Number(cfg?.width||0),Number(cfg?.height||0));
    if(machineSide>PANEL_SAW_MAX_CUT_MM+.001){
      throw new Error(`Seccionadora: o maior lado da chapa pode ter no máximo ${nice(PANEL_SAW_MAX_CUT_MM)} mm. Chapa atual: ${nice(cfg.width)} × ${nice(cfg.height)} mm.`);
    }
    const pref=cfg.panelFirst||'auto';
    const axes=pref==='length'?['H']:pref==='width'?['V']:['H','V'];
    const modes=cfg.optimization==='advanced'
      ? ['source','area','max','width','height','perimeter','jitter2','jitter3','jitter5','jitter8','jitter13','jitter21','jitter34','jitter55','jitter89','jitter144','jitter233','jitter377']
      : ['source','area','max','width','height'];
    let best=null,lastError=null;
    for(const axis of axes)for(const mode of modes)for(const bias of ['compact','unrotated','mixed']){
      try{
        const sheets=packPanelSawTwoStageAttempt(parts,cfg,axis,mode,bias),score=panelSawTwoStageScore(sheets,cfg);
        if(!best||compareSheetScores(score,best.score)<0)best={sheets,score,axis,mode,bias};
      }catch(err){lastError=err;}
    }
    if(!best)throw lastError||new Error('Não foi possível montar a sequência da seccionadora.');
    for(const s of best.sheets){
      if(s.panelSequence){
        s.panelSequence.source='PLANO_MESTRE';
        s.panelSequence.optimization=`${best.mode}/${best.bias}`;
        s.panelSequence.masterPlan=true;
      }
    }
    return best.sheets;
  }

  function packPartsIntoSheets(parts,cfg){
    return cfg.cutMode==='panel'
      ? packPartsIntoSheetsPanelSaw(parts,cfg)
      : packPartsIntoSheetsCnc(parts,cfg);
  }

  return {
    sheetFreeRectContains,
    pruneSheetFreeRects,
    splitSheetFreeRect,
    newSmartSheet,
    scorePartInFreeRect,
    compareSheetScores,
    findSmartSheetPlacement,
    commitSmartSheetPlacement,
    placePartOnSheet,
    smartPackOrder,
    compactSheetsWithSecondPass,
    packPartsIntoSheetsCompact,
    rawPartFromPlacement,
    compactPackOrder,
    compactPackingTieScore,
    chooseBestCompactPacking,
    clampSheetValue,
    cncCandidatePositions,
    scoreCncCenterPlacement,
    findCncCenterPlacement,
    centerPackSingleSheet,
    cncCenterQuality,
    centerWholeCncCluster,
    assignCncCutOrder,
    repackCncSheetCenterOut,
    contourPlacedPolygon,
    contourPolyBounds,
    contourPointInPoly,
    contourOrient,
    contourOnSegment,
    contourSegmentsIntersect,
    contourPointSegDist,
    contourPolysClear,
    contourCandidateFitsSheet,
    contourCandidateClear,
    contourCandidateSeeds,
    findContourAwarePlacement,
    contourAwareCompactCncSheets,
    packPartsIntoSheetsCnc,
    newPanelSawSheet,
    panelSawOrder,
    panelSawSplitRects,
    panelSawCandidateScore,
    findPanelSawPlacement,
    panelSawAddCut,
    commitPanelSawPlacement,
    packPanelSawAttempt,
    panelSawPackingTieScore,
    panelSawTwoStageNewSheet,
    panelSawTwoStageLimits,
    panelSawTwoStageDims,
    panelSawTwoStageCandidate,
    panelSawTwoStageCommit,
    panelSawTwoStageFinalize,
    panelSawNestedFreeLeaves,
    panelSawNestedCloneTree,
    panelSawNestedRemainderOk,
    panelSawNestedCandidateScore,
    panelSawNestedApplyPlacement,
    panelSawNestedPartOrders,
    panelSawTryNestedPack,
    panelSawNestedTreeCuts,
    panelSawCollectNestedFreeRects,
    panelSawTrySalvageLastSheet,
    panelSawGlobalStripCandidate,
    panelSawBuildGlobalStrips,
    panelSawBestStripSubset,
    panelSawStripRealArea,
    panelSawStripBinsBestFit,
    panelSawTryExactStripBins,
    panelSawPackStripsGlobally,
    panelSawPackGlobalStrips,
    packPanelSawTwoStageAttempt,
    panelSawTwoStageScore,
    packPartsIntoSheetsPanelSaw,
    packPartsIntoSheets
  };
}
