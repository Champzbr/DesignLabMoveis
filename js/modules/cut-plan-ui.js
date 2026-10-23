import {sketchupTopContours,sketchupContoursDxf,sketchupContoursSvg} from './imported-mesh.js';
// DesignLabMoveis 1.311.00 · Plano de corte, prévia Aspire e exportações de produção.
import { createCutPlanEngine } from './cut-plan.js?v=1.312.00-r2';

export function createCutPlanUiModule(ctx){
  const { $, nice, mm, escapeHtml, roundMmNumber, toast, safeFileName, downloadText, flatPartInfo, dxfPair, dxfLine, dxfClosedRect, dxfClosedPolyline, dxfCircle, normalizedLayer, machiningLayer, mapPlacedUV, projectOperation, entryAxisName, entryAxisSign, holeSeriesInstances, resolvedMachiningCoords, actualMachiningCount, operationDepthMm, machiningRawCoord, axisLabel, productionMaterialById, productionObjectKind, normalizePieceGrainRotation, furnitureObjects, selectedFurnitureRoot, projects, getProjects, commitHistory, clampSize, layerNum, dlLinearPieceLengthMm, dlPackMetalBars, dlWoodPlanGroups, dlMetalPlanGroups, dlRenderGeneralPartsSummary, dlRenderInlineLinearPlans, repairAllDrawerBottomGrooves, repairAllDrawerDrillingForAspire, repairDrawerBottomGroovesForRoot, repairDrawerDrillingForRoot }=ctx;
  const runtimeModel=ctx.runtimeModel;
  // r14: cutPlanUi nasce antes do módulo projects. A referência `projects` recebida
  // na criação pode ser null para sempre; resolvemos o módulo atual apenas no uso.
  const currentProjects=()=>getProjects?.()||projects||null;
  const currentProjectRecord=()=>currentProjects()?.state?.currentProjectRecord||null;
  // r17 · Aspire: somente layers efetivamente usadas são exportadas.
  // Corte externo/interno/encaixes e corte de seccionadora carregam E=espessura e P=profundidade.
  const aspireLayerIs=(layer,base)=>layer===base||String(layer||'').startsWith(base+'_');
  const aspireThroughLayer=(base,part)=>normalizedLayer(`${base}_E${layerNum(part?.thickness||0)}_P${layerNum(part?.thickness||0)}`);
  const aspirePanelLayer=(placed)=>aspireThroughLayer('CORTE_SECCIONADORA',placed?.[0]||null);
// ============================================================================
// v95 · PRÉVIA ASPIRE
// A tela e o DXF consomem esta mesma função de entidades.
// ============================================================================
let sheetPreviewGroups=[],sheetPreviewIndex=0,sheetPreviewFace='ALL',sheetPreviewSelectedPart=null,sheetPreviewIsolated=false,sheetPreviewView=null,sheetPreviewLastTransform=null;

function buildAspireSheetEntities(placed,cfg,cuts=[]){
  const entities=[{kind:'rect',layer:'CHAPA_REFERENCIA',x:0,y:0,w:cfg.width,h:cfg.height}],layers=new Set(['CHAPA_REFERENCIA']);
  for(const p of placed){
    if(p.customOutline){
      const mapPt=([u,v])=>p.rotated?[p.x+v,p.y+p.faceW-u]:[p.x+u,p.y+v];
      entities.push({kind:'poly',layer:aspireThroughLayer('CORTE_EXTERNO',p),points:p.customOutline.map(mapPt),part:p,role:'outline'});layers.add(aspireThroughLayer('CORTE_EXTERNO',p));
      if(p.customSlots?.length){const slotLayer=aspireThroughLayer('ENCAIXE_MONTANTE',p);layers.add(slotLayer);for(const slot of p.customSlots)entities.push({kind:'poly',layer:slotLayer,points:slot.map(mapPt),part:p,role:'slot'});}
    }else{const outlineLayer=aspireThroughLayer('CORTE_EXTERNO',p);layers.add(outlineLayer);entities.push({kind:'rect',layer:outlineLayer,x:p.x,y:p.y,w:p.placedW,h:p.placedH,part:p,role:'outline'});}
    if(p.customCutouts?.length){const mapCut=([u,v])=>p.rotated?[p.x+v,p.y+p.faceW-u]:[p.x+u,p.y+v];const cutLayer=aspireThroughLayer('CORTE_INTERNO',p);layers.add(cutLayer);for(const cut of p.customCutouts)entities.push({kind:'poly',layer:cutLayer,points:cut.map(mapCut),part:p,role:'cutout'});}
    for(const op of p.machining)for(const e of projectOperation(p,op,p)){if(e){e.part=p;e.op=op;e.role='machining';entities.push(e);layers.add(e.layer);}}
  }
  if(cfg.cutMode==='panel'&&cuts.length){
    const panelLayer=aspirePanelLayer(placed);
    layers.add(panelLayer);
    for(const cut of cuts){
      entities.push({
        kind:'line',layer:panelLayer,
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
  if(e.layer==='CHAPA_REFERENCIA'||aspireLayerIs(e.layer,'CORTE_EXTERNO')||aspireLayerIs(e.layer,'ENCAIXE_MONTANTE')||aspireLayerIs(e.layer,'CORTE_SECCIONADORA'))return true;
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
    if(e.layer==='CHAPA_REFERENCIA'||aspireLayerIs(e.layer,'CORTE_SECCIONADORA')||!sheetPreviewFaceVisible(e))continue;
    let stroke='#25292c',fill=null,line=1.1;
    if(aspireLayerIs(e.layer,'CORTE_EXTERNO')){
      stroke=e.part===sheetPreviewSelectedPart?'#1677d2':'#2f3437';
      fill=e.part===sheetPreviewSelectedPart?'rgba(22,119,210,.14)':'rgba(40,45,48,.035)';
      line=e.part===sheetPreviewSelectedPart?2.2:1.05;
    }else if(e.layer.startsWith('FURO_')){stroke='#d62d7b';line=1.8}
    else if(e.layer.startsWith('RASGO')){stroke='#0099c7';fill='rgba(0,153,199,.10)';line=1.8}
    else if(e.layer==='CORTE_INTERNO'){stroke='#c23f7a';fill='rgba(194,63,122,.06)';line=1.7}
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
  if(metric)metric.innerHTML=`<div class="sheetPreviewMetric"><b>${nice(m.cutLength/1000)} m</b><span>comprimento de corte</span></div><div class="sheetPreviewMetric"><b>${m.cuts.length}</b><span>cortes${m.primaryCuts?` · ${m.primaryCuts} primário(s)`:''}</span></div><div class="sheetPreviewMetric"><b>${nice(waste/1e6)} m²</b><span>área não usada</span></div><div class="sheetPreviewMetric"><b>${cfg.cutMode==='ocl'?optLabel:sheetCutModeLabel(cfg)}</b><span>${cfg.cutMode==='ocl'?'otimização':'modo'}</span></div>`;

  document.querySelectorAll('.cutPlanLegendH,.cutPlanLegendV').forEach(el=>{el.style.display=cfg.cutMode==='cnc'?'none':'grid';});
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
    panelFirst:['auto','length','width'].includes(raw.panelFirst)?raw.panelFirst:'auto',
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
    cutMode:$('sheetCutMode')?.value||'cnc',
    panelFirst:$('sheetPanelFirst')?.value||'auto'
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
  if($('sheetPanelFirst'))$('sheetPanelFirst').value=['length','width'].includes(p.panelFirst)?p.panelFirst:'auto';
  updateSheetCutModeUi();
}
const PANEL_SAW_MAX_CUT_MM=3050;
function productionMaterialIsPlywood(material){
  const id=String(material?.id||'').toLowerCase(),cat=String(material?.category||'').toLowerCase(),name=String(material?.name||'').toLowerCase();
  return id.includes('plywood')||cat.includes('compensado')||name.includes('compensado');
}
function panelSawPartFitsCfg(part,cfg){
  // Seccionadora/Mingli reserva refilo apenas na entrada de cada eixo; o modo
  // Otimizado guilhotina reserva a margem nos dois lados. A checagem usada para
  // escolher automaticamente a chapa do Compensado precisa seguir exatamente
  // a área útil do respectivo otimizador para não aprovar uma chapa que depois
  // seria rejeitada no encaixe real.
  const margin=Math.max(0,Number(cfg?.margin||0));
  const marginFactor=cfg?.cutMode==='panel'?1:2;
  const usableW=Math.max(0,Number(cfg?.width||0)-margin*marginFactor);
  const usableH=Math.max(0,Number(cfg?.height||0)-margin*marginFactor);
  return partOrientations(part,cfg).some(o=>Number(o.w)<=usableW+.001&&Number(o.h)<=usableH+.001);
}
function sheetPrefsForPartGroup(baseCfg,parts=[]){
  const cfg={...(baseCfg||{}),...normalizedSheetPrefs(baseCfg||{})};
  if(externalCutMode&&parts.length&&parts.every(p=>p?.materialCode==='CSV')){
    const out={...cfg,width:externalCutSheetSize.width,height:externalCutSheetSize.height,materialSheet:false,autoMaterialSheet:false};
    if(out.cutMode==='panel'&&Math.max(out.width,out.height)>PANEL_SAW_MAX_CUT_MM+.001)throw new Error(`Chapa externa ${nice(out.width)} × ${nice(out.height)} mm ultrapassa o limite de ${PANEL_SAW_MAX_CUT_MM} mm da seccionadora.`);
    return out;
  }
  const linked=parts.find(p=>p?.materialId)?.materialId||null;
  const material=linked?productionMaterialById(linked):null;
  // 1.312.00-r2 · a chapa é SEMPRE definida pelo cadastro do material.
  // As dimensões globais do plano deixaram de ser uma fonte de verdade: cada
  // grupo de material/espessura usa seu próprio estoque. Assim um mesmo projeto
  // pode misturar MDF 2750×1850 e Compensado Naval 3050×1610 sem qualquer
  // troca manual de configuração entre os grupos.
  const stockW=Number(material?.sheetWidth||0),stockH=Number(material?.sheetHeight||0);
  const hasRegisteredStock=stockW>=100&&stockH>=100;
  const overrideW=Number(cfg.materialOverrideWidth||0),overrideH=Number(cfg.materialOverrideHeight||0);
  const useMaterialOverride=!!cfg.materialOverrideEnabled&&!!material?.id&&String(cfg.materialOverrideId||'')===String(material.id)&&overrideW>=100&&overrideH>=100;
  const out={
    ...cfg,
    width:useMaterialOverride?overrideW:(hasRegisteredStock?stockW:cfg.width),
    height:useMaterialOverride?overrideH:(hasRegisteredStock?stockH:cfg.height),
    grain:!!material?.grain||parts.some(p=>!!p?.materialGrain),
    grainDirection:material?.grainDirection==='width'?'width':'length',
    sheetMaterialId:material?.id||null,
    sheetMaterialName:material?.name||'',
    materialSheet:true,
    materialSheetOverride:useMaterialOverride,
    autoMaterialSheet:hasRegisteredStock&&!useMaterialOverride,
    autoMaterialSheetReason:useMaterialOverride?'manual-material':(hasRegisteredStock?'cadastro-material':'fallback-legado')
  };
  // No modo Seccionadora mantemos somente a limitação física da máquina. Não
  // trocamos a medida do material para caber: o usuário precisa corrigir o
  // cadastro/peça caso a chapa cadastrada ultrapasse o limite do equipamento.
  if(out.cutMode==='panel'&&Math.max(Number(out.width)||0,Number(out.height)||0)>PANEL_SAW_MAX_CUT_MM+.001){
    const origem=useMaterialOverride?'medida manual':'chapa cadastrada';
    throw new Error(`${material?.name||'Material'}: a ${origem} ${nice(out.width)} × ${nice(out.height)} mm ultrapassa o limite de ${PANEL_SAW_MAX_CUT_MM} mm da seccionadora.`);
  }
  return out;
}
function partOrientations(part,cfg){
  const material=productionMaterialById(part?.materialId);
  // 1.312.00-r2 · qualquer material em chapa pode ter veio, inclusive Compensado
  // Naval. Se a peça estiver marcada com veio, ela NUNCA recebe rotação livre de
  // 90° para melhorar encaixe: existe uma única orientação válida, calculada para
  // alinhar o veio da peça ao veio da chapa.
  const grainLocked=!!cfg.grain||!!part.materialGrain;
  const grainRot=normalizePieceGrainRotation(part.materialGrainRotation);
  // 1.312.00-r2: o veio 0° acompanha o MAIOR lado da peça e o veio 90°
  // acompanha o menor lado. Isso preserva o sentido intuitivo para peças altas
  // (ex.: porta 540 × 2990 => 0° acompanha 2990) e largas
  // (ex.: painel 1527 × 451 => 0° acompanha 1527).
  if(grainLocked){
    const sheetAlongLength=(cfg.grainDirection||'length')!=='width';
    const faceWIsMajor=Number(part.faceW)>=Number(part.faceH);
    const pieceAlongFaceW=grainRot===0?faceWIsMajor:!faceWIsMajor;
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
const {
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

}=createCutPlanEngine({partOrientations,cutPlanPartAreaMm2,nice,panelSawMaxCutMm:PANEL_SAW_MAX_CUT_MM});

// 1.312.00-r2 · transferência manual entre chapas.
// O hint vive na própria peça durante a sessão/projeto e é aplicado depois do
// nesting automático, sempre repacotando as duas chapas envolvidas para manter
// cortes/veio/folga válidos. Se não couber em UMA única chapa de destino, não move.
function cutPlanSheetHint(p){
  const n=Number(p?.object?.userData?.cutPlanSheetHint);
  return Number.isInteger(n)&&n>0?n:null;
}
function cutPlanPackSingle(parts,cfg){
  if(!parts.length)return {placements:[],cuts:[],freeRects:[],panelSequence:null,strips:[]};
  let out;
  if(cfg.cutMode==='panel')out=packPartsIntoSheetsPanelSaw(parts,cfg);
  else if(cfg.cutMode==='cnc')out=packPartsIntoSheetsCnc(parts,cfg);
  else out=cutPlanPackOpen(parts,cfg);
  if(out.length!==1)return null;
  return out[0];
}
function cutPlanRawPlacement(p){
  if(typeof rawPartFromPlacement==='function')return rawPartFromPlacement(p);
  const q={...p};for(const k of ['x','y','rotated','placedW','placedH','cutOrder'])delete q[k];return q;
}
function cutPlanApplyManualTransfers(sheets,cfg){
  if(!Array.isArray(sheets)||sheets.length<2)return sheets;
  const original=[...sheets];
  // Só usa hints para chapas que já existem no plano automático atual.
  const hinted=[];
  original.forEach((sh,si)=>sh.placements.forEach(p=>{const h=cutPlanSheetHint(p);if(h)hinted.push({part:p,source:si,target:h-1});}));
  // Aplicação determinística: chapa alvo, depois código/nome.
  hinted.sort((a,b)=>a.target-b.target||String(a.part.cutCode||a.part.name||'').localeCompare(String(b.part.cutCode||b.part.name||''),'pt-BR',{numeric:true}));
  for(const h of hinted){
    const currentSource=sheets.findIndex(sh=>sh.placements.some(p=>p.object===h.part.object||(p.partId&&h.part.partId&&p.partId===h.part.partId)));
    const ti=h.target;
    if(currentSource<0||ti<0||ti>=sheets.length||currentSource===ti)continue;
    const placed=sheets[currentSource].placements.find(p=>p.object===h.part.object||(p.partId&&h.part.partId&&p.partId===h.part.partId));
    if(!placed)continue;
    const moving=cutPlanRawPlacement(placed);
    const srcRaw=sheets[currentSource].placements.filter(p=>p!==placed).map(cutPlanRawPlacement);
    const dstRaw=sheets[ti].placements.map(cutPlanRawPlacement).concat([moving]);
    const newDst=cutPlanPackSingle(dstRaw,cfg);
    if(!newDst)continue; // hint inválido/antigo: preserva plano automático.
    const newSrc=cutPlanPackSingle(srcRaw,cfg);
    if(srcRaw.length&&!newSrc)continue;
    sheets[ti]=newDst;
    sheets[currentSource]=newSrc||{placements:[],cuts:[],freeRects:[],panelSequence:null,strips:[]};
  }
  return sheets.filter(sh=>sh.placements?.length);
}
function cutPlanCanTransferPart(part,targetGroup){
  if(!part||!targetGroup)return {ok:false,reason:'Destino inválido'};
  const cfg=targetGroup.cfg||getSheetPrefs();
  const raw=targetGroup.parts.map(cutPlanRawPlacement).concat([cutPlanRawPlacement(part)]);
  try{
    const sh=cutPlanPackSingle(raw,cfg);
    return sh?{ok:true,sheet:sh}:{ok:false,reason:'A peça não cabe nesta chapa com o veio/folgas atuais.'};
  }catch(err){return {ok:false,reason:err?.message||'A peça não cabe nesta chapa.'};}
}

function legacyV41_updateSheetCutModeUi(){
  const mode=$('sheetCutMode')?.value||'cnc';
  const help=$('sheetCutModeHelp');
  if(!help)return;
  if(mode==='panel'){
    help.className='sheetModeHelp panel';
    help.innerHTML='<strong>Seccionadora:</strong> segue a sequência física do controlador: limpeza/refilo, todos os cortes primários da chapa e depois processa tira por tira. Cada tira pode pedir novo giro se o restante ainda precisar de corte na outra direção. O DesignLab gera <b>1 Mingli .ZAW por chapa física</b> com toda a árvore de Steps dentro do mesmo arquivo.';
  }else{
    help.className='sheetModeHelp cnc';
    help.innerHTML='<strong>CNC:</strong> usa o contorno real de peças curvas/Forma, calcula a área líquida e faz uma segunda passada para encaixar peças nos vazios reais das curvas quando houver espaço. Depois numera o corte do centro para fora.';
  }
}


function buildAspireDxfFromEntities(entities,layers){
  const layerSet=new Set(layers||[]);
  let d=''; d+=dxfPair(0,'SECTION')+dxfPair(2,'HEADER')+dxfPair(9,'$ACADVER')+dxfPair(1,'AC1009')+dxfPair(9,'$MEASUREMENT')+dxfPair(70,1)+dxfPair(9,'$INSUNITS')+dxfPair(70,4)+dxfPair(0,'ENDSEC');
  d+=dxfPair(0,'SECTION')+dxfPair(2,'TABLES')+dxfPair(0,'TABLE')+dxfPair(2,'LAYER')+dxfPair(70,layerSet.size);
  for(const layer of layerSet){const color=aspireLayerIs(layer,'CORTE_EXTERNO')?7:layer==='CHAPA_REFERENCIA'?8:aspireLayerIs(layer,'CORTE_SECCIONADORA')?4:layer.startsWith('FURO_')?1:5;d+=dxfPair(0,'LAYER')+dxfPair(2,layer)+dxfPair(70,0)+dxfPair(62,color)+dxfPair(6,'CONTINUOUS');}
  d+=dxfPair(0,'ENDTAB')+dxfPair(0,'ENDSEC')+dxfPair(0,'SECTION')+dxfPair(2,'ENTITIES');
  for(const e of entities)d+=e.kind==='circle'?dxfCircle(e.layer,e.x,e.y,e.r):e.kind==='poly'?dxfClosedPolyline(e.layer,e.points):e.kind==='line'?dxfLine(e.layer,e.x1,e.y1,e.x2,e.y2):dxfClosedRect(e.layer,e.x,e.y,e.w,e.h);
  d+=dxfPair(0,'ENDSEC')+dxfPair(0,'EOF');
  return d;
}
function buildAspireDxfForSheet(placed,cfg,cuts=[]){
  const built=buildAspireSheetEntities(placed,cfg,cuts),entities=built.entities,layers=new Set(built.layers);
  const d=buildAspireDxfFromEntities(entities,layers);
  const expectedFaceHoles=built.expectedFaceHoles,circleCount=built.circleCount;
  if(expectedFaceHoles!==circleCount)console.warn('DXF Aspire: divergência de furos', {expectedFaceHoles,circleCount});
  return {text:d,layers:[...layers],circleCount,expectedFaceHoles};
}
function aspireOperationFileName(layer,index){
  const clean=String(layer||'OPERACAO').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'OPERACAO';
  return `${String(index).padStart(2,'0')}_${clean}.dxf`;
}
function buildAspireOperationFiles(groups){
  const files=[];
  for(const g of (groups||[])){
    const cfg=g.cfg||getSheetPrefs();
    const built=buildAspireSheetEntities(g.parts||[],cfg,g.panelCuts||[]);
    const refEntities=built.entities.filter(e=>e.layer==='CHAPA_REFERENCIA');
    const opLayers=[...new Set(built.layers.filter(layer=>layer!=='CHAPA_REFERENCIA'))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    const sheetStem=String(g.file||'chapa').replace(/\.dxf$/i,'');
    opLayers.forEach((layer,i)=>{
      const opEntities=built.entities.filter(e=>e.layer===layer);
      if(!opEntities.length)return;
      // Mantém as coordenadas exatas do plano de corte do DesignLab. O contorno da chapa
      // acompanha cada arquivo apenas como referência; nenhuma peça é reposicionada.
      const text=buildAspireDxfFromEntities([...refEntities,...opEntities],['CHAPA_REFERENCIA',layer]);
      files.push({
        name:`ASPIRE_POR_OPERACAO/${sheetStem}/${aspireOperationFileName(layer,i+1)}`,
        data:text,
        sheetFile:g.file,
        layer,
        operationFile:aspireOperationFileName(layer,i+1)
      });
    });
  }
  return files;
}
function buildAspireOperationIndexCsv(operationFiles){
  let c=csvLine(['Arquivo_chapa_completo','Arquivo_por_operacao','Layer','Observacao']);
  for(const f of (operationFiles||[]))c+=csvLine([f.sheetFile,f.name,f.layer,'Mesmas coordenadas do plano de corte; não reposicionar peças no Aspire']);
  return c;
}
function csvCell(v){const t=String(v??'');return /[;"\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t;}
function csvLine(values){return values.map(csvCell).join(';')+'\r\n';}

// 1.200.18 · MingliPanelSaw / Zhongde .ZAW · schema confirmado por Result.zaw nativo
// Serialização ajustada literalmente a partir de dois Result.zaw reais da máquina,
// incluindo um teste com as mesmas peças do DesignLab (26/08/2026).
//
// Grafias/capitalização confirmadas no arquivo .ZAW real da máquina:
// - <!DOCTYPE ZhongdeOptimizationResults>
// - EdgeExcluedWidth e KnifeWidth
// - Width, WidthDirection, OriginX e OriginY
// - UnfinishedProduct
// - UseNums (U e N maiúsculos)
// - materialsNum unit="Zhang" (Z maiúsculo)
// - CutScheme0 usa ProductNums; Scheme0 usa ProductsNum
// - stepformProductID mantém P maiúsculo
// - Ratio e números do bloco <result> usam vírgula decimal
//
// A árvore também segue a semântica nativa:
// - Step000 produz faixas 0A0/0A1/0B0...
// - faixa que já é a peça final NÃO ganha Step filho
// - Step filho só existe quando a faixa ainda precisa de corte transversal
// - Scheme0 é escrito na ordem física/da árvore, intercalando Product e Spare
// - sobras intermediárias consumidas por outro Step não são listadas como sobra final
// Mantemos UM Result.zaw por chapa física.
function mingliXmlAttr(v){
  return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// 1.300.25 · O controlador Mingli desta seccionadora NÃO aceita medidas
// fracionadas nos campos geométricos. Valores como 1614.4 ou 59,251 podem
// ser lidos sem o separador e virar medidas enormes. Todo valor físico enviado
// ao .ZAW é, portanto, quantizado para o milímetro inteiro mais próximo.
function mingliMm(v){
  const n=Number(v);
  return String(Math.round(Number.isFinite(n)?n:0));
}
function mingliDecimal(v,d=2,comma=false){
  const n=Number(v)||0,t=n.toFixed(d);return comma?t.replace('.',','):t;
}
function mingliDateTime(d=new Date()){
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mingliValidateNativeXmlText(xml){
  // 1.200.18 · compatibilidade PC/mobile:
  // O arquivo final PRECISA manter o BOM UTF-8 para ficar byte a byte como o
  // Result.zaw da máquina. Porém, quando esse BOM existe como caractere U+FEFF
  // dentro de uma string JavaScript, alguns DOMParser de desktop tratam o
  // caractere como conteúdo antes da declaração <?xml ...?> e retornam
  // parsererror. Android/WebView costuma tolerar, por isso o erro aparecia só
  // no PC. Para validar, removemos SOMENTE o BOM da cópia usada pelo parser.
  // O conteúdo devolvido/salvo continua com BOM, CRLF e os mesmos bytes.
  const rawText=String(xml||'');
  const text=rawText.replace(/^\uFEFF/,'');
  const required=[
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE ZhongdeOptimizationResults>',
    '<ZhongDeModelResult ',
    ' ModelCreator="ZhongDe. Limited"',
    ' EdgeExcluedWidth="',
    ' KnifeWidth="',
    ' EditMode="Manually"',
    '<result>',
    '<TotalUtilization unit="%">',
    '<materialsNum unit="Zhang">1</materialsNum>',
    '<ProductArea unit="㎡">',
    '<materialArea unit="㎡">',
    '<ProductUseed unit="Piece">',
    '<NotUseProducts unit="Piece">',
    '<Materials SpecificationNum="',
    ' AvailableNums="',
    ' UseNums="',
    '<InputResidualData SpecificationNum="0" Nums="0" />',
    '<ProductData SpecificationNum="',
    ' Turn="False"',
    '<UnfinishedProduct unit="Piece" />',
    '<CutLines>',
    '<CutScheme0 ',
    ' PlateID="B0"',
    ' Width="',
    ' Lenth="',
    ' ProductNums="',
    ' Trim="',
    ' WidthDirection="',
    ' CurrentStep="',
    ' stepform="',
    ' stepcutform="',
    ' stepformProductID="',
    ' Compensate="0"',
    ' ID="Z0"',
    ' RemainID="Trash"',
    '<Scheme0 ',
    ' Thick="',
    ' PlatesNum="1"',
    ' ProductsNum="',
    ' Ratio="',
    ' ProductID="',
    ' OriginX="',
    ' OriginY="',
    ' stepcutform="-2"'
  ];
  for(const token of required)if(!text.includes(token))throw new Error(`ZAW Mingli: estrutura nativa incompleta (${token.trim()}).`);
  const forbidden=[
    ' useNums="',
    'unit="zhang"',
    'EdgeExCluedWidth="',
    'EdgeExcludeWidth="',
    'EdgeExcludedWidth="',
    'knifewidth="',
    ' width="',
    ' widthDirection="',
    ' originX="',
    ' originY="',
    '<unfinishedProduct ',
    'stepformproductID="',
    'stepformproductid="'
  ];
  for(const token of forbidden)if(text.includes(token))throw new Error(`ZAW Mingli: grafia incompatível encontrada (${token.trim()}).`);
  if(!/<Scheme0[^>]*\sRatio="-?\d+,\d{2}"/.test(text))throw new Error('ZAW Mingli: Ratio deve usar vírgula decimal, como no arquivo real da máquina.');
  // 1.300.25 · Medidas físicas nunca podem conter ponto ou vírgula.
  // O Mingli desta máquina interpreta o separador como parte do número e pode
  // transformar 1614.4 em uma peça gigantesca. Percentuais/áreas de relatório
  // continuam no formato nativo e não participam da geometria de corte.
  const integerMmAttrs=new Set(['EdgeExcluedWidth','KnifeWidth','Ply','Width','Length','Lenth','Area','X','Y','Trim','Cut','OriginX','OriginY','Thick']);
  const attrRe=/\s([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g;
  let attrMatch;
  while((attrMatch=attrRe.exec(text))){
    const attr=attrMatch[1],value=attrMatch[2];
    if(integerMmAttrs.has(attr)&&!/^-?\d+$/.test(value))throw new Error(`ZAW Mingli: ${attr} deve ser inteiro em mm, sem ponto nem vírgula (${value}).`);
  }
  if(typeof DOMParser!=='undefined'){
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('ZAW Mingli: XML inválido.');
    const productData=[...doc.querySelectorAll('ProductData > *')];
    const productDataIds=new Set(productData.map(n=>n.getAttribute('ID')).filter(Boolean));
    if(productDataIds.size!==productData.length)throw new Error('ZAW Mingli: IDs duplicados em ProductData.');
    const scheme=doc.querySelector('Scheme0'), cutScheme=doc.querySelector('CutScheme0'), productDataNode=doc.querySelector('ProductData');
    const schemeProducts=[...doc.querySelectorAll('Scheme0 > Product')], schemeRecords=[...doc.querySelectorAll('Scheme0 > Product, Scheme0 > Spare')];
    const expectedProducts=productData.length;
    // Duas mecânicas nativas foram confirmadas:
    // 1) arquivo complexo das fotos (com Steps filhos): SpecificN usa a posição
    //    1-based do registro Product/Spare em Scheme0; Spare ocupa número.
    // 2) arquivo simples original (somente Step000, faixas já finais): SpecificN
    //    é 0-based e contínuo, exatamente como Specific0..Specific10.
    const steps=[...doc.querySelectorAll('CutScheme0 > *')];
    const simpleRootOnly=steps.length===1;
    const productDataById=new Map(productData.map(n=>[n.getAttribute('ID'),n]));
    schemeRecords.forEach((rec,recordIndex)=>{
      if(rec.tagName!=='Product')return;
      const id=rec.getAttribute('ProductID'),node=productDataById.get(id);
      const expectedIndex=simpleRootOnly?recordIndex:recordIndex+1;
      const expectedTag=`Specific${expectedIndex}`;
      if(!node||node.tagName!==expectedTag)throw new Error(`ZAW Mingli: ${id||'?'} deve usar ${expectedTag} em ProductData.`);
    });
    if(!simpleRootOnly&&productData.some(n=>n.tagName==='Specific0'))throw new Error('ZAW Mingli: Specific0 só é válido no modo nativo simples de Step000.');
    if(Number(productDataNode?.getAttribute('SpecificationNum'))!==expectedProducts||Number(productDataNode?.getAttribute('Nums'))!==expectedProducts)throw new Error('ZAW Mingli: contagem ProductData divergente.');
    if(Number(cutScheme?.getAttribute('ProductNums'))!==expectedProducts)throw new Error('ZAW Mingli: ProductNums divergente.');
    if(Number(scheme?.getAttribute('ProductsNum'))!==expectedProducts)throw new Error('ZAW Mingli: ProductsNum divergente.');
    if(schemeProducts.length!==expectedProducts)throw new Error('ZAW Mingli: quantidade de Product no Scheme0 divergente.');
    const usedNode=doc.querySelector('ProductUseed');
    if(Number(usedNode?.textContent)!==schemeRecords.length)throw new Error('ZAW Mingli: ProductUseed divergente do Scheme0.');
    for(const p of schemeProducts){
      const id=p.getAttribute('ProductID');
      if(id&&!productDataIds.has(id))throw new Error(`ZAW Mingli: ProductID ${id} não existe em ProductData.`);
    }
    steps.forEach((st,i)=>{
      const current=Number(st.getAttribute('CurrentStep'));
      if(current!==i)throw new Error(`ZAW Mingli: CurrentStep fora da ordem em ${st.tagName}.`);
      const cuts=[...st.children].filter(n=>/^Cut\d+$/.test(n.tagName));
      if(!cuts.length)throw new Error(`ZAW Mingli: ${st.tagName} sem cortes.`);
      if(i>0){
        const parent=Number(st.getAttribute('stepform')), parentCut=Number(st.getAttribute('stepcutform'));
        if(!Number.isInteger(parent)||parent<0||parent>=i||!steps[parent])throw new Error(`ZAW Mingli: stepform inválido em ${st.tagName}.`);
        const parentCuts=[...steps[parent].children].filter(n=>/^Cut\d+$/.test(n.tagName));
        if(!Number.isInteger(parentCut)||parentCut<0||parentCut>=parentCuts.length)throw new Error(`ZAW Mingli: stepcutform inválido em ${st.tagName}.`);
        if(!st.getAttribute('stepformProductID'))throw new Error(`ZAW Mingli: ${st.tagName} sem stepformProductID.`);
      }
    });
    for(const rec of schemeRecords){
      const sf=Number(rec.getAttribute('stepform')), sc=Number(rec.getAttribute('stepcutform'));
      if(!Number.isInteger(sf)||sf<0||sf>=steps.length)throw new Error(`ZAW Mingli: stepform inválido no Scheme0 (${rec.getAttribute('ProductID')||'?'}).`);
      if(sc>=0){
        const cuts=[...steps[sf].children].filter(n=>/^Cut\d+$/.test(n.tagName));
        if(!Number.isInteger(sc)||sc>=cuts.length)throw new Error(`ZAW Mingli: stepcutform inválido no Scheme0 (${rec.getAttribute('ProductID')||'?'}).`);
      }else if(sc!==-2)throw new Error(`ZAW Mingli: stepcutform negativo inválido no Scheme0 (${rec.getAttribute('ProductID')||'?'}).`);
    }
    const terminal=[...doc.querySelectorAll('Scheme0 > Spare')].find(n=>n.getAttribute('stepform')==='0'&&n.getAttribute('stepcutform')==='-2');
    if(!terminal)throw new Error('ZAW Mingli: sobra terminal da chapa ausente.');
    // Regra confirmada cruzando as fotos (último Cut3 Num=1 => 0Z1) com o
    // Result original simples (Cut0 Num=11 => 0Z11): o sufixo terminal vem
    // do Num do ÚLTIMO CutN de Step000, não é fixo.
    const rootCuts=[...steps[0].children].filter(n=>/^Cut\d+$/.test(n.tagName));
    const lastRootQty=Math.max(1,Number(rootCuts[rootCuts.length-1]?.getAttribute('Num'))||1);
    const expectedTerminalId=`0Z${lastRootQty}`;
    if(terminal.getAttribute('ProductID')!==expectedTerminalId)throw new Error(`ZAW Mingli: sobra terminal deve ser ${expectedTerminalId}.`);
    // Sobras finais dos Steps filhos: nos exemplos reais, direção False usa
    // pelo menos 0002; True usa pelo menos 0001; acima disso acompanha a
    // quantidade total de ocorrências (ex.: Step7, 3 peças => 0Z70003).
    for(const spare of [...doc.querySelectorAll('Scheme0 > Spare')]){
      const sf=Number(spare.getAttribute('stepform'));
      if(!Number.isInteger(sf)||sf<=0||sf>=steps.length)continue;
      const st=steps[sf],wd=st.getAttribute('WidthDirection')==='True';
      const cuts=[...st.children].filter(n=>/^Cut\d+$/.test(n.tagName));
      const outputCount=cuts.reduce((n,c)=>n+Math.max(1,Number(c.getAttribute('Num'))||1),0);
      const suffix=Math.max(wd?1:2,outputCount);
      const expected=`0Z${sf}${String(suffix).padStart(4,'0')}`;
      if(spare.getAttribute('ProductID')!==expected)throw new Error(`ZAW Mingli: sobra ${spare.getAttribute('ProductID')||'?'} deve ser ${expected}.`);
    }
  }
  return true;
}
function mingliStepTagName(i){return `Step${String(i).padStart(3,'0')}`;}
function mingliCutLetter(i){
  const n=Math.max(0,Number(i)||0);
  return n<26?String.fromCharCode(65+n):`A${n}`;
}
function mingliOutputProductId(stepIndex,cutIndex,occurrence){
  const letter=mingliCutLetter(cutIndex),occ=Math.max(0,Number(occurrence)||0);
  if(Number(stepIndex)===0)return `0${letter}${occ}`;
  return `0${letter}${Math.max(0,Number(stepIndex)||0)}${String(occ).padStart(2,'0')}`;
}
function mingliStepSpareId(stepIndex,widthDirection,outputCount=0){
  const step=Math.max(0,Number(stepIndex)||0);
  // Mecânica observada: Step3 False + 1 saída => 0Z30002;
  // Step7 False + 3 saídas => 0Z70003; Step6 True + 1 saída => 0Z60001.
  const suffix=Math.max(widthDirection?1:2,Math.max(0,Number(outputCount)||0));
  return `0Z${step}${String(suffix).padStart(4,'0')}`;
}
function mingliGroupSequentialCuts(items,sizeGetter){
  const groups=[],bindings=[];
  for(let i=0;i<items.length;i++){
    const size=Math.max(.001,Number(sizeGetter(items[i],i))||.001);
    let g=groups[groups.length-1];
    if(!g||Math.abs(g.size-size)>.001){g={size,qty:0};groups.push(g);}
    const occurrence=g.qty++;
    bindings.push({cutIndex:groups.length-1,occurrence});
  }
  return {groups,bindings};
}
function mingliBuildStepStrict({index,x=0,y=0,width,length,trim=0,widthDirection=true,parentStep=-1,parentCut=0,parentProductId='',cuts=[]}){
  const tag=mingliStepTagName(index),lines=[];
  lines.push(`                        <${tag} X="${mingliMm(x)}" Y="${mingliMm(y)}" Width="${mingliMm(width)}" Length="${mingliMm(length)}" Trim="${mingliMm(trim)}" WidthDirection="${widthDirection?'True':'False'}" CurrentStep="${index}" stepform="${parentStep}" stepcutform="${parentCut}" stepformProductID="${mingliXmlAttr(parentProductId)}">`);
  cuts.forEach((c,ci)=>lines.push(`                                <Cut${ci} Cut="${mingliMm(c.size)}" Num="${Math.max(1,Number(c.qty)||1)}" Dri="${widthDirection?'True':'False'}" Compensate="0" ID="Z0" RemainID="Trash" />`));
  lines.push(`                        </${tag}>`);
  return lines;
}
function mingliChildStepGeometry(strip,firstAxis,trim,plateWidth,plateLength){
  const start=trim+Math.max(0,Number(strip?.start)||0),size=Math.max(.001,Number(strip?.size)||.001);
  return firstAxis==='H'
    ? {x:0,y:start,width:plateWidth,length:size,widthDirection:false}
    : {x:start,y:0,width:size,length:plateLength,widthDirection:true};
}
function mingliMixedTrimStepGeometry(strip,it,firstAxis,trim){
  const stripStart=Math.max(0,Number(strip?.start)||0),along=Math.max(0,Number(it?.along)||0);
  const run=Math.max(.001,Number(it?.length)||.001),cross=Math.max(.001,Number(strip?.size)||.001);
  // O retângulo pai já foi isolado pelo Step transversal da faixa. O Step
  // seguinte trabalha somente nessa saída e inverte a direção de corte.
  return firstAxis==='H'
    ? {x:trim+along,y:trim+stripStart,width:run,length:cross,widthDirection:true}
    : {x:trim+stripStart,y:trim+along,width:cross,length:run,widthDirection:false};
}
function mingliPhysicalProductRecord(id,p,stepform,stepcutform,dri){
  const width=Math.max(.1,Number(p?.placedW ?? p?.faceW ?? p?.width)||.1);
  const length=Math.max(.1,Number(p?.placedH ?? p?.faceH ?? p?.height)||.1);
  return {
    kind:'product',id,source:p,width,length,
    originX:Math.max(0,Number(p?.x)||0),originY:Math.max(0,Number(p?.y)||0),
    dri:!!dri,stepform,stepcutform
  };
}
function mingliNestedNodeIsUsed(node){return !!node&&node.kind!=='free';}
function mingliNestedStepRect(node,plan){
  return {x:plan.absX+Number(node.x||0),y:plan.absY+Number(node.y||0),width:Math.max(.001,Number(node.w)||.001),length:Math.max(.001,Number(node.h)||.001)};
}
function mingliBuildNestedTree(node,plan,parent,ctx){
  if(!node)return;
  // Se o retângulo inteiro já é a peça, ela foi produzida diretamente pelo
  // Cut do pai e não precisa de Step adicional.
  if(node.kind==='piece'){
    const p=node.placement?.part||node.placement;
    const rec=mingliPhysicalProductRecord(parent.productId,p,parent.stepIndex,parent.cutIndex,parent.widthDirection);
    ctx.products.push(rec);ctx.schemeRecords.push(rec);return;
  }
  if(node.kind!=='split'||!node.a)return;

  const stepIndex=ctx.nextStepIndex++,rect=mingliNestedStepRect(node,plan),widthDirection=node.axis==='Y';
  const aSize=node.axis==='X'?Number(node.a.w)||0:Number(node.a.h)||0;
  const bUsed=mingliNestedNodeIsUsed(node.b),bSize=bUsed?(node.axis==='X'?Number(node.b.w)||0:Number(node.b.h)||0):0;
  const cuts=[{size:aSize,qty:1}];if(bUsed&&bSize>.001)cuts.push({size:bSize,qty:1});
  ctx.steps.push({index:stepIndex,...rect,trim:0,widthDirection,parentStep:parent.stepIndex,parentCut:parent.cutIndex,parentProductId:parent.productId,cuts});

  const aId=mingliOutputProductId(stepIndex,0,0);
  mingliBuildNestedTree(node.a,plan,{stepIndex,cutIndex:0,productId:aId,widthDirection},ctx);
  if(bUsed){
    const bId=mingliOutputProductId(stepIndex,1,0);
    mingliBuildNestedTree(node.b,plan,{stepIndex,cutIndex:1,productId:bId,widthDirection},ctx);
  }else if(node.b&&node.b.w>.001&&node.b.h>.001){
    const outputCount=cuts.reduce((n,c)=>n+Math.max(1,Number(c.qty)||1),0),r=mingliNestedStepRect(node.b,plan);
    const rec={kind:'spare',id:mingliStepSpareId(stepIndex,widthDirection,outputCount),originX:r.x,originY:r.y,width:r.width,length:r.length,dri:widthDirection,stepform:stepIndex,stepcutform:-2};
    ctx.spares.push(rec);ctx.schemeRecords.push(rec);
  }
}
function mingliBuildStageTree(group,firstAxis,trim,knife,plateWidth,plateLength){
  const strips=(group?.panelStrips||[]).filter(s=>(s?.items||[]).length||(s?.nestedPlans||[]).length);
  if(!strips.length)throw new Error('ZAW: o plano de seccionadora não possui faixas válidas.');

  // Step000: cortes iguais E consecutivos são um único CutN com Num>1.
  const stage0=mingliGroupSequentialCuts(strips,s=>Number(s.size)||0);
  const stage0Dir=firstAxis==='H';
  const steps=[{
    index:0,x:0,y:0,width:plateWidth,length:plateLength,trim,widthDirection:stage0Dir,
    parentStep:-1,parentCut:0,parentProductId:'',cuts:stage0.groups
  }];

  const products=[],spares=[],schemeRecords=[];
  const physicalRun=firstAxis==='H'?plateWidth:plateLength;
  const ctx={steps,products,spares,schemeRecords,nextStepIndex:1};

  strips.forEach((strip,si)=>{
    const rootBinding=stage0.bindings[si];
    const rootProductId=mingliOutputProductId(0,rootBinding.cutIndex,rootBinding.occurrence);
    const items=strip.items||[],nested=(strip.nestedPlans||[])[0]||null;

    // No arquivo nativo, quando a faixa já é uma peça inteira ela sai direto
    // de Step000. Uma faixa com reaproveitamento aninhado nunca entra aqui.
    const only=items.length===1&&!nested?items[0]:null;
    const onlyCross=Math.max(.001,Number(only?.crossSize)||Number(strip.size)||.001);
    const directRootProduct=!!only &&
      Math.abs(Number(only.along)||0)<.001 &&
      Math.abs((Number(only.length)||0)-physicalRun)<.01 &&
      Math.abs(onlyCross-(Number(strip.size)||0))<.01;
    if(directRootProduct){
      const rec=mingliPhysicalProductRecord(rootProductId,only.part,0,rootBinding.cutIndex,stage0Dir);
      products.push(rec);schemeRecords.push(rec);return;
    }

    const stepIndex=ctx.nextStepIndex++,geom=mingliChildStepGeometry(strip,firstAxis,trim,plateWidth,plateLength);
    // Quando existe nested plan, a antiga sobra terminal vira uma saída CutN
    // explícita. runLength já reserva o último KnifeWidth contra a borda.
    const seqItems=[...items];if(nested)seqItems.push({__nestedTail:true,length:nested.runLength});
    const child=mingliGroupSequentialCuts(seqItems,it=>Number(it.length)||0);
    steps.push({
      index:stepIndex,...geom,trim,parentStep:0,parentCut:rootBinding.cutIndex,
      parentProductId:rootProductId,cuts:child.groups
    });

    items.forEach((it,ii)=>{
      const b=child.bindings[ii],segmentId=mingliOutputProductId(stepIndex,b.cutIndex,b.occurrence);
      const crossSize=Math.max(.001,Number(it.crossSize)||Number(strip.size)||.001);
      const crossDelta=Math.max(0,(Number(strip.size)||0)-crossSize);

      if(crossDelta>.01 && panelSawNestedRemainderOk(crossDelta,knife)){
        // 1.300.26 · peça menor dentro de uma faixa maior.
        // O primeiro Step isola o comprimento da saída; este Step filho troca
        // a direção (o operador vira a saída) e destopa somente a largura
        // transversal da peça. Assim 1094x600 e 1561x572 podem compartilhar a
        // mesma faixa de 600, como no Result-2.zaw de referência.
        const trimStepIndex=ctx.nextStepIndex++,trimGeom=mingliMixedTrimStepGeometry(strip,it,firstAxis,trim);
        steps.push({
          index:trimStepIndex,...trimGeom,trim:0,
          parentStep:stepIndex,parentCut:b.cutIndex,parentProductId:segmentId,
          cuts:[{size:crossSize,qty:1}]
        });
        const finalId=mingliOutputProductId(trimStepIndex,0,0);
        const rec=mingliPhysicalProductRecord(finalId,it.part,trimStepIndex,0,trimGeom.widthDirection);
        products.push(rec);schemeRecords.push(rec);

        const axisLength=trimGeom.widthDirection?trimGeom.length:trimGeom.width;
        const cursor=crossSize+knife,remain=Math.max(0,axisLength-cursor);
        if(remain>.001){
          const spare={
            kind:'spare',id:mingliStepSpareId(trimStepIndex,trimGeom.widthDirection,1),
            originX:trimGeom.widthDirection?trimGeom.x:trimGeom.x+cursor,
            originY:trimGeom.widthDirection?trimGeom.y+cursor:trimGeom.y,
            width:trimGeom.widthDirection?trimGeom.width:remain,
            length:trimGeom.widthDirection?remain:trimGeom.length,
            dri:trimGeom.widthDirection,stepform:trimStepIndex,stepcutform:-2
          };
          spares.push(spare);schemeRecords.push(spare);
        }
      }else{
        const rec=mingliPhysicalProductRecord(segmentId,it.part,stepIndex,b.cutIndex,geom.widthDirection);
        products.push(rec);schemeRecords.push(rec);
      }
    });

    if(nested){
      const tailBinding=child.bindings[items.length],tailId=mingliOutputProductId(stepIndex,tailBinding.cutIndex,tailBinding.occurrence);
      mingliBuildNestedTree(nested.tree,nested,{stepIndex,cutIndex:tailBinding.cutIndex,productId:tailId,widthDirection:geom.widthDirection},ctx);
    }else{
      // Só a sobra FINAL desta etapa entra em Scheme0.
      const axisLength=geom.widthDirection?geom.length:geom.width;
      const cursor=trim+Math.max(0,Number(strip.used)||0)+(items.length?knife:0);
      const remain=Math.max(0,axisLength-cursor);
      if(remain>.001){
        const rec={
          kind:'spare',id:mingliStepSpareId(stepIndex,geom.widthDirection,items.length),
          originX:geom.widthDirection?geom.x:geom.x+cursor,
          originY:geom.widthDirection?geom.y+cursor:geom.y,
          width:geom.widthDirection?geom.width:remain,
          length:geom.widthDirection?remain:geom.length,
          dri:geom.widthDirection,stepform:stepIndex,stepcutform:-2
        };
        spares.push(rec);schemeRecords.push(rec);
      }
    }
  });

  // Sobra final da chapa depois do último Cut de Step000.
  const last=strips[strips.length-1],crossAxisLength=stage0Dir?plateLength:plateWidth;
  const crossCursor=trim+Math.max(0,(Number(last?.start)||0)+(Number(last?.size)||0))+(strips.length?knife:0);
  const crossRemain=Math.max(0,crossAxisLength-crossCursor);
  {
    const lastRootQty=Math.max(1,Number(stage0.groups[stage0.groups.length-1]?.qty)||1),terminalId=`0Z${lastRootQty}`;
    const rec=stage0Dir
      ? {kind:'spare',id:terminalId,originX:0,originY:crossCursor,width:plateWidth,length:crossRemain,dri:true,stepform:0,stepcutform:-2}
      : {kind:'spare',id:terminalId,originX:crossCursor,originY:0,width:crossRemain,length:plateLength,dri:false,stepform:0,stepcutform:-2};
    spares.push(rec);schemeRecords.push(rec);
  }
  return {strips,steps,products,spares,schemeRecords};
}
function mingliValidateMasterPlan(group){
  const strips=(group?.panelStrips||[]).filter(s=>(s?.items||[]).length);
  const parts=group?.parts||[];
  if(!strips.length)throw new Error('ZAW: o plano mestre não possui faixas. Abra/recalcule o plano antes de exportar.');
  const fromStrips=[];
  for(const st of strips){
    for(const it of (st.items||[]))if(it?.part)fromStrips.push(it.part);
    for(const plan of (st.nestedPlans||[]))for(const p of (plan.placements||[]))if(p)fromStrips.push(p);
  }
  if(fromStrips.length!==parts.length)throw new Error(`ZAW: plano mestre divergente (${fromStrips.length}/${parts.length} peças). Recalcule o plano.`);
  const count=new Map();
  for(const p of parts){const k=p.partId||p.object?.uuid||`${p.cutCode}|${p.name}|${p.x}|${p.y}`;count.set(k,(count.get(k)||0)+1);}
  for(const p of fromStrips){const k=p.partId||p.object?.uuid||`${p.cutCode}|${p.name}|${p.x}|${p.y}`;const n=count.get(k)||0;if(n<=0)throw new Error(`ZAW: a peça ${p.cutCode||p.name||'?'} não pertence ao plano mestre atual.`);count.set(k,n-1);}
  if([...count.values()].some(n=>n!==0))throw new Error('ZAW: existem peças do desenho fora das faixas da seccionadora. Recalcule o plano.');
  return true;
}
function buildMingliZawSheetJob(group,cfg){
  mingliValidateMasterPlan(group);
  const gc=group?.cfg||cfg||{},plateWidth=Math.max(1,Number(gc.width)||2750),plateLength=Math.max(1,Number(gc.height)||1850);
  const thickness=Math.max(.1,Number(group?.parts?.[0]?.thickness)||18),trim=Math.max(0,Number(gc.margin)||0),knife=Math.max(0,Number(gc.gap)||0);
  const seq=group?.panelSequence||{},firstAxis=seq.firstAxis||group?.panelFirstAxis||'H';
  const tree=mingliBuildStageTree(group,firstAxis,trim,knife,plateWidth,plateLength),products=tree.products,spareRecords=tree.spares,schemeRecords=tree.schemeRecords;
  if(!products.length)throw new Error('ZAW: a chapa não possui peças.');

  const plateArea=plateWidth*plateLength;
  const realProductArea=products.reduce((n,p)=>n+p.width*p.length,0);
  const finalSpareArea=spareRecords.reduce((n,s)=>n+s.width*s.length,0);
  // O controlador chama de ProductArea a área de todos os retângulos finais
  // utilizados no Scheme (peças + sobras finais). Ex.: 2x 3000x270 + sobra
  // 3000x2 = 1,626 m² -> mostra 1,63 m² e 98,55%.
  const usedArea=realProductArea+finalSpareArea;
  const totalUtilization=plateArea?usedArea/plateArea*100:0;
  const ratio=plateArea?realProductArea/plateArea*100:0;
  const lines=[];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<!DOCTYPE ZhongdeOptimizationResults>');
  lines.push(`<ZhongDeModelResult DateTime="${mingliXmlAttr(mingliDateTime())}" ModelCreator="ZhongDe. Limited" EdgeExcluedWidth="${mingliMm(trim)}" KnifeWidth="${mingliMm(knife)}" EditMode="Manually">`);
  lines.push('        <result>');
  lines.push(`                <TotalUtilization unit="%">${mingliDecimal(totalUtilization,2,true)}</TotalUtilization>`);
  lines.push('                <materialsNum unit="Zhang">1</materialsNum>');
  lines.push(`                <ProductArea unit="㎡">${mingliDecimal(usedArea/1e6,2,true)}</ProductArea>`);
  lines.push(`                <materialArea unit="㎡">${mingliDecimal(plateArea/1e6,2,true)}</materialArea>`);
  lines.push(`                <ProductUseed unit="Piece">${schemeRecords.length}</ProductUseed>`);
  lines.push('                <NotUseProducts unit="Piece">0</NotUseProducts>');
  lines.push('        </result>');
  lines.push('        <Materials SpecificationNum="1" Nums="1">');
  lines.push(`                <Specific0 ID="B0" Material="M01" Ply="${mingliMm(thickness)}" Width="${mingliMm(plateWidth)}" Length="${mingliMm(plateLength)}" AvailableNums="1" UseNums="1" Area="${mingliMm(plateArea)}" />`);
  lines.push('        </Materials>');
  lines.push('        <InputResidualData SpecificationNum="0" Nums="0" />');
  lines.push(`        <ProductData SpecificationNum="${products.length}" Nums="${products.length}">`);
  // SpecificN tem duas formas nativas confirmadas pelos dois arquivos reais:
  // - plano complexo (fotos, com Steps filhos): posição 1-based em Scheme0,
  //   contando Spare => Specific1, Specific2, Specific4, Specific6...
  // - plano simples (somente Step000): posição 0-based => Specific0..Specific10.
  const productSpecificIndex=new Map(),simpleRootOnly=tree.steps.length===1;
  schemeRecords.forEach((r,recordIndex)=>{if(r.kind==='product')productSpecificIndex.set(r,simpleRootOnly?recordIndex:recordIndex+1);});
  products.forEach(p=>{
    const specificIndex=productSpecificIndex.get(p);
    if(!Number.isInteger(specificIndex))throw new Error(`ZAW Mingli: produto ${p.id} sem posição Specific nativa.`);
    lines.push(`                <Specific${specificIndex} ID="${p.id}" Material="M01" Ply="${mingliMm(thickness)}" Width="${mingliMm(p.width)}" Length="${mingliMm(p.length)}" AvailableNums="1" UseNums="1" Area="${mingliMm(p.width*p.length)}" Turn="False" />`);
  });
  lines.push('        </ProductData>');
  lines.push('        <UnfinishedProduct unit="Piece" />');
  lines.push('        <CutLines>');
  lines.push(`                <CutScheme0 PlateID="B0" Width="${mingliMm(plateWidth)}" Lenth="${mingliMm(plateLength)}" Nums="1" ProductNums="${products.length}">`);
  tree.steps.forEach(st=>lines.push(...mingliBuildStepStrict(st)));
  lines.push('                </CutScheme0>');
  // IMPORTANTE: no arquivo da máquina o atributo daqui é ProductsNum (com s),
  // embora CutScheme0 use ProductNums (sem s).
  lines.push(`                <Scheme0 PlateID="B0" Width="${mingliMm(plateWidth)}" Lenth="${mingliMm(plateLength)}" Thick="${mingliMm(thickness)}" PlatesNum="1" ProductsNum="${products.length}" Ratio="${mingliDecimal(ratio,2,true)}">`);
  schemeRecords.forEach(r=>{
    if(r.kind==='product')lines.push(`                        <Product ProductID="${r.id}" OriginX="${mingliMm(r.originX)}" OriginY="${mingliMm(r.originY)}" Width="${mingliMm(r.width)}" Length="${mingliMm(r.length)}" Dri="${r.dri?'True':'False'}" stepform="${r.stepform}" stepcutform="${r.stepcutform}" />`);
    else lines.push(`                        <Spare ProductID="${r.id}" OriginX="${mingliMm(r.originX)}" OriginY="${mingliMm(r.originY)}" Width="${mingliMm(r.width)}" Length="${mingliMm(r.length)}" Dri="${r.dri?'True':'False'}" stepform="${r.stepform}" stepcutform="${r.stepcutform}" />`);
  });
  lines.push('                </Scheme0>');
  lines.push('        </CutLines>');
  lines.push('</ZhongDeModelResult>');
  // Valida o XML lógico SEM o BOM. O BOM é um detalhe de codificação do
  // arquivo final, não parte do documento que deve ser entregue ao DOMParser.
  const xmlBody=lines.join('\r\n');
  mingliValidateNativeXmlText(xmlBody);
  return '\ufeff'+xmlBody;
}
function mingliZawSafeBase(group){
  return `CHAPA_${String(group.sheetNo||1).padStart(2,'0')}_${safeFileName(group.key||'material','material')}`;
}
function buildMingliZawFiles(groups,cfg){
  const files=[],notes=[];
  const valid=groups.filter(x=>x.cutMode==='panel'||x.planMode==='panel');
  for(const g of valid){
    const base=mingliZawSafeBase(g),data=buildMingliZawSheetJob(g,cfg);
    files.push({name:`mingli-zaw/${base}/Result.zaw`,data});
    notes.push(`${base}/Result.zaw = chapa física ${g.sheetNo||1} · ${(g.parts||[]).length} peça(s) · estrutura Mingli com referências Step/Cut/produto.`);
  }
  if(!files.length)throw new Error('Não há chapas de seccionadora para gerar ZAW.');
  const readme=`DESIGNLABMOVEIS 1.311.00 · MINGLIPANELSAW / ZAW · FAIXA MISTA + GIRO/DESTOPAR\r\n\r\n`+
    `CORREÇÃO 1.200.18\r\n- Schema agora segue o Result.zaw REAL da máquina, comparado com as mesmas peças.\r\n- EdgeExcluedWidth e KnifeWidth exatamente como no original.\r\n- Width, WidthDirection, OriginX, OriginY e UnfinishedProduct com capitalização nativa.\r\n- materialsNum usa unit="Zhang" e stepformProductID mantém P maiúsculo.\r\n- CutScheme0 usa ProductNums; Scheme0 usa ProductsNum.\r\n- Ratio usa vírgula decimal, igual ao arquivo real da máquina.\r\n- Result.zaw é gravado em UTF-8 COM BOM, CRLF e sem quebra de linha extra no final.\r\n- A formatação/indentação do XML foi aproximada à saída nativa do Prepare.\r\n- A ordem de entrada das peças passa a ser o primeiro critério de desempate da seccionadora; faixas de mesma largura preservam a ordem física de criação, reproduzindo o teste 2500 sozinho antes de 1200+1400.\r\n- SpecificN, stepformProductID e IDs 0Z permanecem com a mecânica já confirmada.\r\n- Validação bloqueia nomes antigos em minúsculas ou grafias incompatíveis antes do download.\r\n\r\n`+
    `CORREÇÃO 1.300.24\r\n- O plano mestre agora reaproveita caudas livres das faixas antes de abrir uma chapa extra.\r\n- Quando necessário, o ZAW cria Steps adicionais encadeados para os cortes de reaproveitamento, mantendo o mesmo desenho do plano visual/CSV.\r\n- A última chapa só é removida quando TODAS as peças dela couberem com cortes guilhotina válidos nas sobras das chapas anteriores.\r\n\r\nCORREÇÃO 1.300.25\r\n- Todas as medidas físicas do ZAW (peças, cortes, coordenadas, chapa, espessura, refilo e faca) saem somente em milímetros INTEIROS.\r\n- Ponto e vírgula foram bloqueados nos atributos geométricos porque o controlador pode interpretar 1614.4 / 1614,4 como uma medida enorme.\r\n- Medidas fracionadas são arredondadas para o milímetro inteiro mais próximo apenas no arquivo Mingli; o projeto e o plano visual continuam com a medida original.\r\n\r\nCORREÇÃO 1.300.26\r\n- O otimizador da seccionadora agora aceita peças menores dentro da mesma faixa primária de uma peça maior.\r\n- Exemplo validado com o Result-2.zaw enviado: 1094x600 e 1561x572 compartilham a faixa de 600 mm; a segunda saída recebe um Step filho para girar 90° e destopar 572 mm.\r\n- O cálculo testa a faixa mista como estratégia adicional e só a escolhe quando melhora o número de chapas; em empate, prefere menos giros/cortes extras.\r\n- Plano visual, CSV e Mingli ZAW usam a mesma geometria; o ZAW mantém as medidas físicas inteiras da 1.300.25.\r\n\r\nTESTE SEGURO\r\nPrimeiro abra o Result.zaw no MingliPanelSaw e confira o desenho e a sequência. NÃO execute o corte automático até conferir medidas, direção e quantidade na tela.\r\n\r\n`+
    notes.map((x,i)=>`${i+1}. ${x}`).join('\r\n')+'\r\n';
  files.push({name:'mingli-zaw/LEIA-ME-ZAW.txt',data:readme});
  return files;
}
function buildPanelSawCutsCsv(groups,cfg){
  let c=csvLine([
    'Grupo','Chapa','Etapa','Acao','Faixa','Ordem_corte','Orientacao',
    'X1_mm','Y1_mm','X2_mm','Y2_mm','Comprimento_mm','Medida_faixa_mm','Pecas','Descricao'
  ]);
  if(cfg.cutMode!=='panel')return c;
  for(const g of groups){
    const seq=g.panelSequence||null;
    if(seq){
      c+=csvLine([g.key,g.sheetNo,0,'CARREGAR_CHAPA','','','','','','','','','','',
        `Carregar chapa ${nice(g.cfg?.width||cfg.width)} x ${nice(g.cfg?.height||cfg.height)} mm · refilo ${nice(g.cfg?.margin??cfg.margin)} mm`]);
      for(const cut of (seq.stage1Cuts||[])){
        c+=csvLine([g.key,g.sheetNo,1,'FORMAR_FAIXA',`F${cut.stripNo||''}`,cut.order,
          cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,
          seq.strips?.find(s=>s.number===cut.stripNo)?.size||'', '',cut.description||'']);
      }
      for(const strip of (seq.strips||[])){
        const pcs=(strip.items||[]).map(it=>`${it.code} ${nice(it.length)}`).join(' | ');
        c+=csvLine([g.key,g.sheetNo,2,'GIRAR_90',`F${strip.number}`,'','','','','','','',strip.size,pcs,
          `Iniciar faixa F${strip.number}: girar 90 graus e concluir todos os cortes desta faixa antes da próxima`]);
        for(const cut of (strip.cuts||[])){
          c+=csvLine([g.key,g.sheetNo,2,'CORTE_FAIXA',`F${strip.number}`,cut.order,
            cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,
            strip.size,pcs,cut.description||'']);
        }
        for(const cut of (strip.trimCuts||[])){
          c+=csvLine([g.key,g.sheetNo,3,'GIRAR_E_DESTOPAR',`F${strip.number}`,cut.order,
            cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,
            strip.size,pcs,cut.description||'Girar saída 90° e destopar peça menor dentro da faixa']);
        }
        for(const plan of (strip.nestedPlans||[]))for(const cut of (plan.cuts||[])){
          const nestedPcs=(plan.placements||[]).map(p=>p.cutCode||p.name||'Peça').join(' | ');
          c+=csvLine([g.key,g.sheetNo,cut.stage||3,'REAPROVEITAR_SOBRA',`F${strip.number}`,cut.order,
            cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,
            strip.size,nestedPcs,cut.description||'Reaproveitamento de sobra']);
        }
      }
      continue;
    }
    for(const cut of (g.panelCuts||[])){
      c+=csvLine([g.key,g.sheetNo,cut.stage||'',cut.action||'CORTE','',cut.order,
        cut.orientation==='V'?'VERTICAL':'HORIZONTAL',cut.x1,cut.y1,cut.x2,cut.y2,cut.length,'','',cut.description||'']);
    }
  }
  return c;
}
function sheetCutModeLabel(cfg){
  return cfg.cutMode==='panel'
    ? 'SECCIONADORA · PLANO MESTRE · SEQUÊNCIA NATIVA'
    : 'CNC · centro para fora';
}
function cutModeReadmeText(cfg){
  return cfg.cutMode==='panel'
    ? 'Modo do plano: SECCIONADORA DE PINÇA / PLANO MESTRE. Todas as peças do mesmo material são otimizadas globalmente em faixas e depois as faixas são distribuídas entre as chapas. O desenho, a impressão, o CSV e o Mingli ZAW usam exatamente essas mesmas faixas e posições.'
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
  const project=currentProjectRecord();
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
  let c=csvLine(['Arquivo_DXF','Grupo','Chapa','Modo_corte','Largura_chapa_mm','Altura_chapa_mm','Pecas','Cortes_retos','Faixas','Giros_90','Area_pecas_m2','Aproveitamento_percentual']);
  for(const g of groups){
    const gc=g.cfg||cfg,area=g.parts.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),pct=area/Math.max(1,(gc.width-2*gc.margin)*(gc.height-2*gc.margin))*100;
    c+=csvLine([g.file,g.key,g.sheetNo,gc.cutMode==='panel'?'SECCIONADORA':'CNC',gc.width,gc.height,g.parts.length,g.panelCuts?.length||0,g.panelSequence?.strips?.length||0,g.panelSequence?.turns||0,(area/1e6).toFixed(3),pct.toFixed(1)]);
  }
  return c;
}
function buildAspireLayerDepthsCsv(groups){
  let c=csvLine(['Arquivo_DXF','Layer','Tipo','Espessura_peca_mm','Profundidade_mm','Face','Observacao']);
  const seen=new Set();
  for(const g of groups){
    if((g.cfg?.cutMode==='panel'||g.panelCuts?.length)&&g.parts?.length){
      const p=g.parts[0],layer=aspirePanelLayer(g.parts),key=`${g.file}|${layer}`;
      if(!seen.has(key)){seen.add(key);c+=csvLine([g.file,layer,'CORTE_SECCIONADORA',p.thickness,p.thickness,'',`Corte total da chapa; profundidade acompanha a espessura real do grupo (${nice(p.thickness)} mm)`]);}
    }
    for(const p of (g.parts||[])){
      const through=[
        ['CORTE_EXTERNO','CORTE_CONTORNO',!!p.customOutline||true],
        ['CORTE_INTERNO','CORTE_INTERNO',!!p.customCutouts?.length],
        ['ENCAIXE_MONTANTE','ENCAIXE',!!p.customSlots?.length]
      ];
      for(const [base,type,active] of through){
        if(!active)continue;
        const layer=aspireThroughLayer(base,p),key=`${g.file}|${layer}`;
        if(seen.has(key))continue;seen.add(key);
        c+=csvLine([g.file,layer,type,p.thickness,p.thickness,'',`Profundidade vem automaticamente da espessura real da peça (${nice(p.thickness)} mm)`]);
      }
      for(const op of (p.machining||[])){
        const layer=machiningLayer(p,op),depth=operationDepthMm(p.object,op),face=entryAxisName(op.entryAxis)===p.thicknessAxis?(entryAxisSign(op.entryAxis)>0?'A':'B'):'BORDA',key=`${g.file}|${layer}`;
        if(seen.has(key))continue;seen.add(key);
        c+=csvLine([g.file,layer,op.type==='hole'?'FURO':'RASGO',p.thickness,depth,face,'Profundidade cadastrada na usinagem do DesignLab']);
      }
    }
  }
  return c;
}

function cutPlanMaterialBucket(p){
  const mat=normalizedLayer(p?.material||'MDF')||'MDF';
  const materialId=String(p?.materialId||'').trim();
  const code=String(p?.materialCode||'').trim();
  // Não misturar na mesma chapa dois cadastros que tenham o mesmo nome, mas
  // medidas/sentido de veio diferentes. O id é interno; o rótulo continua limpo.
  const identity=materialId||code||mat;
  const label=`${mat}_${layerNum(p?.thickness)}mm`;
  return {identity:`${identity}|${layerNum(p?.thickness)}mm`,label};
}
function groupPartArrayForAspire(parts,cfg=getSheetPrefs(),emptyMessage='Não existem peças para exportar'){
  cfg=normalizedSheetPrefs(cfg);
  if(!parts.length)throw new Error(emptyMessage);
  const map=new Map();for(const p of parts){const b=cutPlanMaterialBucket(p);if(!map.has(b.identity))map.set(b.identity,{label:b.label,parts:[]});map.get(b.identity).parts.push(p);}
  const out=[];let fileIndex=0;
  for(const bucket of map.values()){const key=bucket.label,gparts=bucket.parts;
    const groupCfg=sheetPrefsForPartGroup(cfg,gparts);
    const sheets=packPartsIntoSheets(gparts,groupCfg);
    sheets.forEach((sheet,i)=>{
      fileIndex++;
      const file=`${String(fileIndex).padStart(2,'0')}_${key}_CHAPA_${String(i+1).padStart(2,'0')}.dxf`;
      const panelCuts=sheet.cuts||[];
      const built=buildAspireDxfForSheet(sheet.placements,groupCfg,panelCuts);
      out.push({
        key,file,sheetNo:i+1,totalSheets:sheets.length,
        parts:sheet.placements,panelCuts,panelSequence:sheet.panelSequence||null,panelStrips:sheet.strips||[],cutMode:groupCfg.cutMode,cfg:groupCfg,...built
      });
    });
  }
  return out;
}
function groupAspireParts(root,cfg=getSheetPrefs()){
  const parts=furnitureObjects(root).filter(o=>o.userData?.kind!=='space-cell'&&o.userData?.kind!=='cylinder'&&!o.userData?.excludeFromCutList&&o.userData?.kind!=='hardware-visual'&&productionObjectKind(o)==='sheet').map((o,i)=>{const p=flatPartInfo(o,i+1,{production:true});if(p){p.spaceName=root.name||'Espaço';p.spaceRootId=root.id;}return p;}).filter(Boolean);
  return groupPartArrayForAspire(parts,cfg,'Este móvel não possui peças de chapa para exportar');
}
function allProjectFurnitureParts({production=false}={}){
  const parts=[],seen=new Set();let index=0;
  for(const root of runtimeModel.spaceRoots){
    for(const o of furnitureObjects(root)){
      if(seen.has(o) || o.userData?.kind==='space-cell' || o.userData?.kind==='cylinder' || o.userData?.excludeFromCutList || o.userData?.kind==='hardware-visual')continue;
      seen.add(o);const p=flatPartInfo(o,++index,{production});if(!p)continue;p.spaceName=root.name||`Espaço ${runtimeModel.spaceRoots.indexOf(root)+1}`;p.spaceRootId=root.id;parts.push(p);
    }
  }
  return parts;
}
function allProjectProductionPartsByKind(kind){
  return allProjectFurnitureParts({production:true}).filter(p=>(p.productionKind||'sheet')===kind);
}
function groupAspireProjectParts(cfg=getSheetPrefs()){
  return groupPartArrayForAspire(allProjectProductionPartsByKind('sheet'),cfg,'O projeto ainda não possui peças de chapa dentro dos espaços');
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
function isExportPickerActivationError(err){
  const msg=String(err?.message||'').toLowerCase();
  return err?.name==='NotAllowedError'&&(msg.includes('user activation')||msg.includes('activation required')||msg.includes('gesture'));
}
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
  const downloadTarget=()=>({kind:'download',locationLabel:'Downloads · modo compatibilidade'});
  if(!window.isSecureContext)return downloadTarget();
  const mobileLike=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(navigator.maxTouchPoints>1&&innerWidth<900);
  const activationActive=navigator.userActivation?.isActive!==false;
  // File System Access exige uma ativação de usuário ainda válida. Em WebView/Electron/PWA ela pode
  // se perder mesmo tendo vindo de um clique real. Nessa situação usamos download compatível em vez
  // de deixar a exportação falhar com "User activation required".
  if(!activationActive)return downloadTarget();
  if(mobileLike&&typeof window.showSaveFilePicker==='function'){
    try{
      const direct=await pickSaveFileTarget(filename,pickerId,mime);
      if(direct)return direct;
    }catch(err){
      if(isExportPickerCancel(err))throw err;
      if(isExportPickerActivationError(err))return downloadTarget();
    }
  }
  let directoryError=null;
  if(typeof window.showDirectoryPicker==='function'){
    try{
      const target=await pickDirectoryFileTarget(filename,pickerId);
      if(target)return target;
    }catch(err){
      if(isExportPickerCancel(err))throw err;
      if(isExportPickerActivationError(err))return downloadTarget();
      directoryError=err;
    }
  }
  if(typeof window.showSaveFilePicker==='function'){
    try{
      const target=await pickSaveFileTarget(filename,pickerId,mime);
      if(target)return target;
    }catch(err){
      if(isExportPickerCancel(err))throw err;
      if(isExportPickerActivationError(err))return downloadTarget();
      directoryError=directoryError||err;
    }
  }
  if(directoryError&&mobileLike){
    throw new Error('A pasta foi escolhida, mas o Android/navegador não permitiu criar o arquivo nela. Escolha outro local de salvamento.');
  }
  return downloadTarget();
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
  // 1.200.18: recria o anexo com bytes concretos. Alguns Android/WhatsApp
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
  if(target?.kind==='download')return downloadExportFallback(blob,filename);
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
  return `DesignLabMoveis 1.311.00 - Pacote Aspire\r\nMóvel: ${root.name}\r\nUnidade: milímetros\r\nChapa padrão/fallback: ${cfg.width} x ${cfg.height} mm\r\nMargem: ${cfg.margin} mm | Folga: ${cfg.gap} mm | Veio padrão: ${(cfg.grainDirection||'length')==='width'?'LARGURA':'COMPRIMENTO'}\r\n${cutModeReadmeText(cfg)}\r\n\r\nCHAPAS\r\n${[...byKey.entries()].map(([k,n])=>{const g=groups.find(x=>x.key===k),gc=g?.cfg||cfg;return '- '+k+': '+n+' chapa(s) · '+gc.width+' x '+gc.height+' mm'+(g?.parts?.some(p=>p.materialGrain)?' · veio '+((gc.grainDirection||'length')==='width'?'na largura':'no comprimento'):'');}).join('\r\n')}\r\n\r\nARQUIVOS DXF\r\n${groups.map(g=>'- '+g.file+' = '+g.key+' / chapa '+g.sheetNo+' ('+g.parts.length+' peça(s))').join('\r\n')}\r\n- lista-pecas.csv = posição, medidas e identificação de cada peça\r\n- plano-chapas.csv = resumo das chapas e aproveitamento por área\r\n- usinagens.csv = uma linha por furo/rasgo real\r\n- profundidades-layers.csv = mapa automático layer → profundidade para conferência/configuração no Aspire\r\n- ASPIRE_POR_OPERACAO/ = cópias auxiliares por chapa e por layer, SEM alterar o nesting; cada DXF mantém as coordenadas originais do plano\r\n- ASPIRE_POR_OPERACAO/indice-operacoes.csv = mapa arquivo da chapa → arquivo auxiliar → layer\r\n\r\nLAYERS\r\nCHAPA_REFERENCIA = contorno da chapa; NÃO criar toolpath de corte nesta layer\r\nCORTE_EXTERNO_E18_P18 (exemplo) = contorno final; E = espessura da peça e P = profundidade real de corte\r\nCORTE_INTERNO_E18_P18 (exemplo) = recorte interno atravessando a peça\r\nFURO_A_Dx_Py / FURO_B_Dx_Py = furos por face, diâmetro e profundidade; no DXF são entidades CIRCLE\r\nRASGO_A_Wx_Py / RASGO_B_Wx_Py = rasgos manuais\r\nRASGO_FUNDO_A_Wx_Py / RASGO_FUNDO_B_Wx_Py = rasgos de fundo automáticos\r\nENCAIXE_MONTANTE = encaixes das nervuras curvas para os montantes\r\nCORTE_SECCIONADORA_E18_P18 (exemplo) = linhas retas numeradas do modo seccionadora; E = espessura do grupo e P = profundidade total\r\n\r\nIMPORTANTE\r\nO DXF principal continua sendo o plano completo da chapa. A pasta ASPIRE_POR_OPERACAO é apenas auxiliar: NÃO coloque peça por peça e NÃO reposicione nada; os arquivos usam exatamente as mesmas coordenadas do nesting calculado pelo DesignLab.\r\nCada DXF representa UMA chapa física. Se o móvel precisar de 3 chapas MDF 18 mm, serão criados 3 DXFs MDF 18 mm. Materiais e espessuras diferentes nunca são misturados.\r\nQuando “Material madeirado / manter sentido do veio” estiver marcado, nenhuma peça gira 90°. Quando estiver desmarcado, o CAD pode girar automaticamente para melhorar o aproveitamento.\r\nSem rotação, o DXF preserva os eixos naturais da peça: portas/fundos usam X horizontal e Y vertical; bases/prateleiras usam X/Z; laterais usam Z/Y.\r\nCoordenadas negativas são referências do lado oposto: Y=-100 mantém a operação 100 mm do topo mesmo se a peça for redimensionada. O usinagens.csv traz coordenadas reais e também X_ref/Y_ref/Z_ref.\r\nFerragens podem criar FUROS DE BORDA (entrada em eixo diferente da espessura). Esses furos ficam identificados como FURO_BORDA no usinagens.csv e não viram círculo no DXF da face principal, pois exigem usinagem lateral ou virar a peça; isso evita gerar um toolpath vertical incorreto.\r\n\r\nTotal: ${totalParts} peça(s), ${groups.length} chapa(s), ${ops} operação(ões) geométrica(s).\r\nNo Aspire, associe toolpaths às layers conforme ferramenta, profundidade e estratégia de face. As medidas Pxx são lidas automaticamente do projeto; nenhum vetor é duplicado e a geometria do plano não muda.\r\n`;
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
  return `DesignLabMoveis 1.311.00 - Pacote Aspire do projeto completo\r\nUnidade: milímetros\r\nEspaços incluídos: ${spaces.length}\r\n${spaces.map(x=>'- '+x).join('\r\n')}\r\n\r\nChapa padrão/fallback: ${cfg.width} x ${cfg.height} mm\r\nMargem: ${cfg.margin} mm | Folga: ${cfg.gap} mm | Veio padrão: ${(cfg.grainDirection||'length')==='width'?'LARGURA':'COMPRIMENTO'}\r\n${cutModeReadmeText(cfg)}\r\n\r\nCHAPAS\r\n${[...byKey.entries()].map(([k,n])=>{const g=groups.find(x=>x.key===k),gc=g?.cfg||cfg;return '- '+k+': '+n+' chapa(s) · '+gc.width+' x '+gc.height+' mm'+(g?.parts?.some(p=>p.materialGrain)?' · veio '+((gc.grainDirection||'length')==='width'?'na largura':'no comprimento'):'');}).join('\r\n')}\r\n\r\nARQUIVOS DXF\r\n${groups.map(g=>'- '+g.file+' = '+g.key+' / chapa '+g.sheetNo+' ('+g.parts.length+' peça(s))').join('\r\n')}\r\n- lista-pecas.csv = todas as peças do projeto, com espaço de origem\r\n- etiquetas-base.csv = dados estruturados para a futura geração de etiquetas (material, fita por lado, medidas e ID)\r\n- plano-chapas.csv = resumo das chapas e aproveitamento por área\r\n- usinagens.csv = uma linha por furo/rasgo real, com espaço de origem\r\n- profundidades-layers.csv = mapa automático layer → profundidade para conferência/configuração no Aspire\r\n- ASPIRE_POR_OPERACAO/ = cópias auxiliares por chapa e por layer, SEM alterar o nesting; cada DXF mantém as coordenadas originais do plano\r\n- ASPIRE_POR_OPERACAO/indice-operacoes.csv = mapa arquivo da chapa → arquivo auxiliar → layer\r\n\r\nLAYERS\r\nCHAPA_REFERENCIA = contorno da chapa; NÃO criar toolpath nesta layer\r\nCORTE_EXTERNO_E18_P18 (exemplo) = contorno final; E = espessura da peça e P = profundidade real de corte\r\nCORTE_INTERNO_E18_P18 (exemplo) = recorte interno atravessando a peça\r\nFURO_A_Dx_Py / FURO_B_Dx_Py = furos por face, diâmetro e profundidade; no DXF são entidades CIRCLE\r\nRASGO_A_Wx_Py / RASGO_B_Wx_Py = rasgos manuais\r\nRASGO_FUNDO_A_Wx_Py / RASGO_FUNDO_B_Wx_Py = rasgos de fundo automáticos\r\nENCAIXE_MONTANTE = encaixes das nervuras curvas para os montantes\r\nCORTE_SECCIONADORA_E18_P18 (exemplo) = linhas retas numeradas do modo seccionadora; E = espessura do grupo e P = profundidade total\r\n\r\nIMPORTANTE\r\nO DXF principal continua sendo o plano completo da chapa. A pasta ASPIRE_POR_OPERACAO é apenas auxiliar: NÃO coloque peça por peça e NÃO reposicione nada; os arquivos usam exatamente as mesmas coordenadas do nesting calculado pelo DesignLab.\r\nO plano de corte é calculado com TODAS as peças de TODOS os espaços juntas. Peças do mesmo material e espessura podem compartilhar a mesma chapa, melhorando o aproveitamento.\r\nCada DXF representa UMA chapa física. Se forem necessárias 4 chapas MDF 18 mm, serão gerados 4 DXFs MDF 18 mm. Materiais e espessuras diferentes nunca são misturados.\r\nQuando “Material madeirado / manter sentido do veio” estiver marcado, nenhuma peça gira 90°. Quando estiver desmarcado, o CAD pode girar automaticamente para melhorar o aproveitamento.\r\nSem rotação, o DXF preserva os eixos naturais da peça: portas/fundos usam X horizontal e Y vertical; bases/prateleiras usam X/Z; laterais usam Z/Y.\r\nCoordenadas negativas são referências do lado oposto: Y=-100 mantém a operação 100 mm do topo mesmo se a peça for redimensionada. O usinagens.csv traz coordenadas reais e também X_ref/Y_ref/Z_ref.\r\nFerragens podem criar FUROS DE BORDA (entrada em eixo diferente da espessura). Esses furos ficam identificados como FURO_BORDA no usinagens.csv e não viram círculo no DXF da face principal, pois exigem usinagem lateral ou virar a peça; isso evita gerar um toolpath vertical incorreto.\r\n\r\nTotal: ${totalParts} peça(s), ${groups.length} chapa(s), ${ops} operação(ões) geométrica(s).\r\n`;
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
        const row=document.createElement('div');row.className='partRow';const left=document.createElement('div');const nm=document.createElement('div');nm.className='partRowName';nm.textContent=p.name;const meta=document.createElement('div');meta.className='partRowMeta';const origins=[...p.spaceNames];meta.textContent=`${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm · ${p.material}${p.materialCode?' · '+p.materialCode:''}${p.materialGrain?` · VEIO ${normalizePieceGrainRotation(p.materialGrainRotation)}° · 90° bloqueado`:''}${p.edgeBandSummary?' · FITA: '+p.edgeBandSummary:''}${origins.length?' · '+origins.join(', '):''}`;left.append(nm,meta);const qty=document.createElement('div');qty.className='partQty';qty.textContent=`×${p.qty}`;row.append(left,qty);box.appendChild(row);
      }
      const chips=document.createElement('div');chips.style.padding='7px 10px 9px';
      data.sheets.forEach((x,i)=>{const c=document.createElement('span');c.className='sheetChip';c.textContent=`Chapa ${i+1} · ${nice(x.metrics.pct)}%${cfg.cutMode!=='cnc'?` · ${x.metrics.cuts.length} cortes`:''}`;chips.appendChild(c);});
      box.appendChild(chips);list.appendChild(box);
    }
    if(cfg.cutMode==='ocl')$('partsListInfo').textContent=`Projeto completo · plano guilhotina inteligente otimizado: combina ${spaces.length} espaço(s), testa múltiplas ordens/direções e preserva sobras aproveitáveis.`;
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
    if(cfg.cutMode==='panel'){files.push({name:'cortes-seccionadora.csv',data:buildPanelSawCutsCsv(groups,cfg)});files.push(...buildMingliZawFiles(groups,cfg));}
    files.push({name:'usinagens.csv',data:buildMachiningCsv(groups)});
    files.push({name:'profundidades-layers.csv',data:buildAspireLayerDepthsCsv(groups)});
    const operationFiles=buildAspireOperationFiles(groups);
    files.push(...operationFiles.map(({name,data})=>({name,data})));
    files.push({name:'ASPIRE_POR_OPERACAO/indice-operacoes.csv',data:buildAspireOperationIndexCsv(operationFiles)});
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
    if(cfg.cutMode==='panel'){files.push({name:'cortes-seccionadora.csv',data:buildPanelSawCutsCsv(groups,cfg)});files.push(...buildMingliZawFiles(groups,cfg));}
    files.push({name:'usinagens.csv',data:buildMachiningCsv(groups)});
    files.push({name:'profundidades-layers.csv',data:buildAspireLayerDepthsCsv(groups)});
    const operationFiles=buildAspireOperationFiles(groups);
    files.push(...operationFiles.map(({name,data})=>({name,data})));
    files.push({name:'ASPIRE_POR_OPERACAO/indice-operacoes.csv',data:buildAspireOperationIndexCsv(operationFiles)});
    files.push({name:'LEIA-ME.txt',data:buildAspireReadme(root,groups,cfg)});
    const saveResult=await writeExportTarget(target,zipStore(files),filename);

    const ops=groups.reduce((n,g)=>n+g.parts.reduce((m,p)=>m+actualMachiningCount(p),0),0);
    toast(`Aspire ZIP salvo em ${saveResult.locationLabel} · ${groups.length} chapa(s) · ${ops} operação(ões)${grooves.sets?` · RASGOS FUNDO: ${grooves.created}`:''}${repaired.sets?` · FUROS CORREDIÇA: ${repaired.holes}${repaired.forced?` (fallback ${repaired.forced})`:''}`:''}`);
  }catch(err){
    if(isExportPickerCancel(err)){toast('Exportação cancelada');return;}
    toast(err.message||'Não foi possível exportar pacote Aspire');
  }
}



// ============================================================================
// 1.200.18 · PLANO DE CORTE OTIMIZADO
// Mantém a exportação Aspire existente separada. Este bloco cuida somente
// do cálculo e da visualização do plano de corte na interface.
// ============================================================================
const CUT_PLAN_PREFS_KEY='designlabCutPlanV42';
let cutPlanLastGroups=[];
let cutPlanLastValidCfg=null;
let cutPlanRestoreGuard=false;
let cutPlanConfirmedMaterialOverride={enabled:false,id:'',width:0,height:0};

function cutPlanReadExtraPrefs(){
  try{return JSON.parse(localStorage.getItem(CUT_PLAN_PREFS_KEY)||'{}')||{};}catch(_){return {}}
}
function cutPlanAvailableSheetMaterials(){
  const ids=new Set(allProjectProductionPartsByKind('sheet').map(p=>String(p?.materialId||'')).filter(Boolean));
  return [...ids].map(id=>productionMaterialById(id)).filter(m=>m&&Number(m.sheetWidth)>=100&&Number(m.sheetHeight)>=100);
}
function refreshCutPlanMaterialOverrideUi({syncSize=false}={}){
  const enabled=$('sheetMaterialOverrideEnabled'),fields=$('sheetMaterialOverrideFields'),sel=$('sheetMaterialOverrideMaterial');
  if(!enabled||!fields||!sel)return;
  const old=String(sel.value||'');
  const mats=cutPlanAvailableSheetMaterials();
  sel.innerHTML='';
  for(const m of mats){const o=document.createElement('option');o.value=m.id;o.textContent=`${m.name}${m.code?` · ${m.code}`:''} · cadastro ${nice(m.sheetWidth)} × ${nice(m.sheetHeight)} mm`;sel.appendChild(o);}
  const wanted=old&&mats.some(m=>m.id===old)?old:(mats[0]?.id||'');
  sel.value=wanted;
  fields.style.display=enabled.checked?'block':'none';
  const m=productionMaterialById(sel.value);
  if(syncSize&&m){
    if($('sheetMaterialOverrideWidth'))$('sheetMaterialOverrideWidth').value=nice(m.sheetWidth||2750);
    if($('sheetMaterialOverrideHeight'))$('sheetMaterialOverrideHeight').value=nice(m.sheetHeight||1850);
  }
}
function cutPlanSaveExtraPrefs(){
  const confirmed=cutPlanConfirmedMaterialOverride||{enabled:false,id:'',width:0,height:0};
  const p={
    optimization:$('sheetOptimization')?.value||'medium',
    direction:$('sheetDirection')?.value||'auto',
    keepLength:Math.max(0,Number($('sheetKeepLength')?.value)||0),
    keepWidth:Math.max(0,Number($('sheetKeepWidth')?.value)||0),
    materialOverrideEnabled:!!confirmed.enabled,
    materialOverrideId:String(confirmed.id||''),
    materialOverrideWidth:Math.max(0,Number(confirmed.width)||0),
    materialOverrideHeight:Math.max(0,Number(confirmed.height)||0)
  };
  localStorage.setItem(CUT_PLAN_PREFS_KEY,JSON.stringify(p));return p;
}
function cutPlanUpdateMaterialOverrideStatus(){
  const el=$('sheetMaterialOverrideStatus');if(!el)return;
  const c=cutPlanConfirmedMaterialOverride||{};
  if(c.enabled&&c.id&&Number(c.width)>=100&&Number(c.height)>=100){
    const m=productionMaterialById(c.id);
    el.textContent=`Ativo no cálculo: ${m?.name||'material'} · ${nice(c.width)} × ${nice(c.height)} mm.`;
  }else el.textContent='A medida só entra no cálculo depois de confirmar.';
}
function confirmCutPlanMaterialOverride(){
  const enabled=!!$('sheetMaterialOverrideEnabled')?.checked;
  if(!enabled){
    cutPlanConfirmedMaterialOverride={enabled:false,id:'',width:0,height:0};
    cutPlanSaveExtraPrefs();cutPlanUpdateMaterialOverrideStatus();renderPartsList();
    toast('Tamanho manual desativado. O plano voltou ao cadastro dos materiais.');
    return;
  }
  const id=String($('sheetMaterialOverrideMaterial')?.value||'');
  const width=Math.max(0,Number($('sheetMaterialOverrideWidth')?.value)||0);
  const height=Math.max(0,Number($('sheetMaterialOverrideHeight')?.value)||0);
  if(!id){toast('Selecione o material antes de confirmar.');return;}
  if(width<100||height<100){toast('Informe comprimento e largura válidos antes de confirmar.');return;}
  cutPlanConfirmedMaterialOverride={enabled:true,id,width,height};
  cutPlanSaveExtraPrefs();cutPlanUpdateMaterialOverrideStatus();renderPartsList();
  const m=productionMaterialById(id);
  toast(`Medida confirmada para ${m?.name||'material'}: ${nice(width)} × ${nice(height)} mm.`);
}
function applyCutPlanExtraPrefs(){
  const p=cutPlanReadExtraPrefs();
  if($('sheetOptimization'))$('sheetOptimization').value=p.optimization==='medium'?'medium':'advanced';
  if($('sheetDirection'))$('sheetDirection').value=['none','length','width'].includes(p.direction)?p.direction:'auto';
  if($('sheetKeepLength'))$('sheetKeepLength').value=Number.isFinite(Number(p.keepLength))?Number(p.keepLength):100;
  if($('sheetKeepWidth'))$('sheetKeepWidth').value=Number.isFinite(Number(p.keepWidth))?Number(p.keepWidth):100;
  cutPlanConfirmedMaterialOverride={
    enabled:!!p.materialOverrideEnabled,
    id:String(p.materialOverrideId||''),
    width:Math.max(0,Number(p.materialOverrideWidth)||0),
    height:Math.max(0,Number(p.materialOverrideHeight)||0)
  };
  if($('sheetMaterialOverrideEnabled'))$('sheetMaterialOverrideEnabled').checked=!!p.materialOverrideEnabled;
  refreshCutPlanMaterialOverrideUi();
  if($('sheetMaterialOverrideMaterial')&&p.materialOverrideId&&[...$('sheetMaterialOverrideMaterial').options].some(o=>o.value===p.materialOverrideId))$('sheetMaterialOverrideMaterial').value=p.materialOverrideId;
  if($('sheetMaterialOverrideWidth'))$('sheetMaterialOverrideWidth').value=Number(p.materialOverrideWidth)>=100?Number(p.materialOverrideWidth):nice(productionMaterialById($('sheetMaterialOverrideMaterial')?.value)?.sheetWidth||2750);
  if($('sheetMaterialOverrideHeight'))$('sheetMaterialOverrideHeight').value=Number(p.materialOverrideHeight)>=100?Number(p.materialOverrideHeight):nice(productionMaterialById($('sheetMaterialOverrideMaterial')?.value)?.sheetHeight||1850);
  refreshCutPlanMaterialOverrideUi();
  cutPlanUpdateMaterialOverrideStatus();
}
function applyCutPlanCfgToUi(cfg){
  if(!cfg)return;
  applySheetPrefsToUi(cfg);
  if($('sheetOptimization'))$('sheetOptimization').value=cfg.optimization==='medium'?'medium':'advanced';
  if($('sheetDirection'))$('sheetDirection').value=['none','length','width'].includes(cfg.direction)?cfg.direction:'auto';
  if($('sheetKeepLength'))$('sheetKeepLength').value=Math.max(0,Number(cfg.keepLength)||0);
  if($('sheetKeepWidth'))$('sheetKeepWidth').value=Math.max(0,Number(cfg.keepWidth)||0);
  cutPlanConfirmedMaterialOverride={
    enabled:!!cfg.materialOverrideEnabled,
    id:String(cfg.materialOverrideId||''),
    width:Math.max(0,Number(cfg.materialOverrideWidth)||0),
    height:Math.max(0,Number(cfg.materialOverrideHeight)||0)
  };
  if($('sheetMaterialOverrideEnabled'))$('sheetMaterialOverrideEnabled').checked=!!cfg.materialOverrideEnabled;
  refreshCutPlanMaterialOverrideUi();
  if($('sheetMaterialOverrideMaterial')&&cfg.materialOverrideId&&[...$('sheetMaterialOverrideMaterial').options].some(o=>o.value===cfg.materialOverrideId))$('sheetMaterialOverrideMaterial').value=cfg.materialOverrideId;
  if($('sheetMaterialOverrideWidth')&&Number(cfg.materialOverrideWidth)>=100)$('sheetMaterialOverrideWidth').value=Number(cfg.materialOverrideWidth);
  if($('sheetMaterialOverrideHeight')&&Number(cfg.materialOverrideHeight)>=100)$('sheetMaterialOverrideHeight').value=Number(cfg.materialOverrideHeight);
  refreshCutPlanMaterialOverrideUi();
  cutPlanUpdateMaterialOverrideStatus();
  localStorage.setItem(CUT_PLAN_PREFS_KEY,JSON.stringify({
    optimization:cfg.optimization==='medium'?'medium':'advanced',
    direction:['none','length','width'].includes(cfg.direction)?cfg.direction:'auto',
    keepLength:Math.max(0,Number(cfg.keepLength)||0),
    keepWidth:Math.max(0,Number(cfg.keepWidth)||0),
    materialOverrideEnabled:!!cfg.materialOverrideEnabled,
    materialOverrideId:String(cfg.materialOverrideId||''),
    materialOverrideWidth:Math.max(0,Number(cfg.materialOverrideWidth)||0),
    materialOverrideHeight:Math.max(0,Number(cfg.materialOverrideHeight)||0)
  }));
  setSheetPrefs(cfg);
  updateSheetCutModeUi();
}
function cutPlanCfgFromUi(){
  const base=sheetPrefsFromUi(),x=cutPlanSaveExtraPrefs();
  // 1.312.00-r2 · o override manual é uma preferência extra do plano, não faz
  // parte de normalizedSheetPrefs(). Por isso ele precisa seguir explicitamente
  // no cfg usado pelo agrupamento; sem estes campos o cálculo caía de volta na
  // chapa cadastrada (ex.: 2750 × 1850) mesmo com 2750 × 600 ativado na UI.
  return {
    ...base,
    optimization:x.optimization,
    direction:x.direction,
    keepLength:x.keepLength,
    keepWidth:x.keepWidth,
    materialOverrideEnabled:x.materialOverrideEnabled,
    materialOverrideId:x.materialOverrideId,
    materialOverrideWidth:x.materialOverrideWidth,
    materialOverrideHeight:x.materialOverrideHeight
  };
}
function cutPlanModeLabel(cfg){
  return cfg.cutMode==='panel'?'Seccionadora · cortes retos':cfg.cutMode==='cnc'?'CNC / Router · encaixe livre':'Otimizado · cortes guilhotina';
}
function updateSheetCutModeUi(){
  const mode=$('sheetCutMode')?.value||'open',help=$('sheetCutModeHelp');
  document.querySelectorAll('.oclOnly').forEach(el=>el.style.display=mode==='open'?'block':'none');
  document.querySelectorAll('.panelOnly').forEach(el=>el.style.display=mode==='panel'?'':'none');
  if(!help)return;
  if(mode==='panel'){
    help.className='sheetModeHelp panel';
    help.innerHTML='<strong>Seccionadora de pinça · plano mestre:</strong> primeiro otimiza TODAS as peças de cada material, forma as faixas e depois procura a combinação global que use o <b>menor número de chapas</b>. Cada material usa a <b>medida cadastrada da própria chapa</b>. O desenho, a impressão, o CSV e o Mingli .ZAW usam <b>exatamente o mesmo posicionamento</b>. Limite da máquina: <b>3050 mm</b> no maior lado.';
  }else if(mode==='cnc'){
    help.className='sheetModeHelp cnc';
    help.innerHTML='<strong>CNC / Router:</strong> usa encaixe livre para aproveitar área. Não força sequência guilhotina no plano visual.';
  }else{
    help.className='sheetModeHelp open';
    help.innerHTML='<strong>Otimizado:</strong> usa cortes guilhotina, considera refilo e espessura de corte e testa várias ordens/orientações do encaixe. Cada material usa sua <b>chapa cadastrada</b>; o objetivo principal é usar o <b>menor número de chapas</b> e depois concentrar a sobra em retalhos maiores e reaproveitáveis.';
  }
}

function cutPlanCode(index){
  let n=Math.max(0,index|0),s='';
  do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1;}while(n>=0);
  return s;
}
function cutPlanPartSignature(p){
  return [p.name,p.material,p.materialCode||'',roundMmNumber(p.thickness,3),roundMmNumber(p.faceW,3),roundMmNumber(p.faceH,3),p.materialGrain?'1':'0',normalizePieceGrainRotation(p.materialGrainRotation),p.edgeBandSignature||''].join('|');
}
function cutPlanAssignCodes(parts){
  const sigs=[...new Set(parts.map(cutPlanPartSignature))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}));
  const map=new Map(sigs.map((s,i)=>[s,cutPlanCode(i)]));
  return parts.map(p=>({...p,cutCode:map.get(cutPlanPartSignature(p))||'?'}));
}
function cutPlanStableJitter(part,seed,index){
  const text=`${seed}|${part?.partId||part?.cutCode||part?.name||''}|${roundMmNumber(part?.faceW||0,2)}|${roundMmNumber(part?.faceH||0,2)}|${index}`;
  let h=2166136261>>>0;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  // 0,82 .. 1,18: perturba pouco a ordem de área, suficiente para escapar de
  // mínimos locais do guilhotina sem transformar a busca em aleatória.
  return .82+(h/4294967295)*.36;
}
function cutPlanOrder(parts,mode){
  const a=[...parts];
  if(/^jitter\d+$/.test(String(mode||''))){
    const seed=Math.max(1,Number(String(mode).replace('jitter',''))||1);
    return a.map((p,i)=>({p,i,j:cutPlanStableJitter(p,seed,i)})).sort((x,y)=>
      (y.p.faceW*y.p.faceH*y.j-x.p.faceW*x.p.faceH*x.j)||
      (Math.max(y.p.faceW,y.p.faceH)-Math.max(x.p.faceW,x.p.faceH))||
      (x.i-y.i)
    ).map(x=>x.p);
  }
  if(mode==='max')return a.sort((x,y)=>(Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH))||(y.faceW*y.faceH-x.faceW*x.faceH));
  if(mode==='width')return a.sort((x,y)=>(y.faceW-x.faceW)||(y.faceW*y.faceH-x.faceW*x.faceH));
  if(mode==='height')return a.sort((x,y)=>(y.faceH-x.faceH)||(y.faceW*y.faceH-x.faceW*x.faceH));
  if(mode==='perimeter')return a.sort((x,y)=>((y.faceW+y.faceH)-(x.faceW+x.faceH))||(y.faceW*y.faceH-x.faceW*x.faceH));
  return a.sort((x,y)=>(y.faceW*y.faceH-x.faceW*x.faceH)||(Math.max(y.faceW,y.faceH)-Math.max(x.faceW,x.faceH)));
}
function cutPlanSplitRects(free,o,cfg,split){
  const remW=free.w-o.w,remH=free.h-o.h,k=Math.max(0,cfg.gap),out=[];
  if(split==='V'){
    if(remW>k+.001)out.push({x:free.x+o.w+k,y:free.y,w:remW-k,h:free.h});
    if(remH>k+.001)out.push({x:free.x,y:free.y+o.h+k,w:o.w,h:remH-k});
  }else{
    if(remH>k+.001)out.push({x:free.x,y:free.y+o.h+k,w:free.w,h:remH-k});
    if(remW>k+.001)out.push({x:free.x+o.w+k,y:free.y,w:remW-k,h:o.h});
  }
  return out.filter(r=>r.w>.001&&r.h>.001);
}
function cutPlanCandidateScore(free,o,cfg,split,direction='none'){
  if(o.w>free.w+.001||o.h>free.h+.001)return null;
  const kids=cutPlanSplitRects(free,o,cfg,split),waste=free.w*free.h-o.w*o.h;
  const largest=kids.length?Math.max(...kids.map(r=>r.w*r.h)):0;
  const sliverPenalty=kids.reduce((n,r)=>n+(Math.min(r.w,r.h)<Math.max(45,cfg.gap*5)?1:0),0);
  const cutLength=(split==='V'?(free.w-o.w>.001?free.h:0)+(free.h-o.h>.001?o.w:0):(free.h-o.h>.001?free.w:0)+(free.w-o.w>.001?o.h:0));
  const dirPenalty=direction==='length'?(split==='H'?0:1):direction==='width'?(split==='V'?0:1):0;
  const rotatePenalty=o.rotated?.12:0;
  return [sliverPenalty,dirPenalty,waste,-largest,cutLength,rotatePenalty,free.y,free.x];
}
function cutPlanFindPlacement(sheet,part,cfg,direction){
  let best=null;
  for(let fi=0;fi<sheet.freeRects.length;fi++){
    const free=sheet.freeRects[fi];
    for(const o of partOrientations(part,cfg))for(const split of ['H','V']){
      const score=cutPlanCandidateScore(free,o,cfg,split,direction);if(!score)continue;
      if(!best||compareSheetScores(score,best.score)<0)best={fi,free,o,split,score};
    }
  }
  return best;
}
function cutPlanNewSheet(cfg){
  const w=cfg.width-2*cfg.margin,h=cfg.height-2*cfg.margin;
  if(w<=0||h<=0)throw new Error('O refilo é maior que a área útil da chapa.');
  return {freeRects:[{x:0,y:0,w,h}],placements:[],cuts:[]};
}
function cutPlanAddCut(sheet,cut){
  if(!(cut.length>.001))return;
  const key=[cut.orientation,roundMmNumber(cut.x1,2),roundMmNumber(cut.y1,2),roundMmNumber(cut.x2,2),roundMmNumber(cut.y2,2)].join('|');
  if(sheet._cutKeys?.has(key))return;
  if(!sheet._cutKeys)sheet._cutKeys=new Set();sheet._cutKeys.add(key);
  cut.order=sheet.cuts.length+1;sheet.cuts.push(cut);
}
function cutPlanCommitPlacement(sheet,part,cfg,best){
  const free=best.free,o=best.o,k=Math.max(0,cfg.gap),fx=cfg.margin+free.x,fy=cfg.margin+free.y;
  sheet.freeRects.splice(best.fi,1,...cutPlanSplitRects(free,o,cfg,best.split));
  const placed={...part,x:fx,y:fy,rotated:o.rotated,placedW:o.w,placedH:o.h};sheet.placements.push(placed);
  const remW=free.w-o.w,remH=free.h-o.h;
  if(best.split==='V'){
    if(remW>.001)cutPlanAddCut(sheet,{orientation:'V',x1:fx+o.w+k/2,y1:fy,x2:fx+o.w+k/2,y2:fy+free.h,length:free.h});
    if(remH>.001)cutPlanAddCut(sheet,{orientation:'H',x1:fx,y1:fy+o.h+k/2,x2:fx+o.w,y2:fy+o.h+k/2,length:o.w});
  }else{
    if(remH>.001)cutPlanAddCut(sheet,{orientation:'H',x1:fx,y1:fy+o.h+k/2,x2:fx+free.w,y2:fy+o.h+k/2,length:free.w});
    if(remW>.001)cutPlanAddCut(sheet,{orientation:'V',x1:fx+o.w+k/2,y1:fy,x2:fx+o.w+k/2,y2:fy+o.h,length:o.h});
  }
  return placed;
}
function cutPlanPackAttempt(parts,cfg,orderMode,direction){
  const ordered=cutPlanOrder(parts,orderMode),sheets=[];
  const usableW=cfg.width-2*cfg.margin,usableH=cfg.height-2*cfg.margin;
  for(const part of ordered){
    if(!partOrientations(part,cfg).some(o=>o.w<=usableW+.001&&o.h<=usableH+.001))throw new Error(`${part.name}: ${nice(part.faceW)} × ${nice(part.faceH)} mm não cabe na chapa ${nice(cfg.width)} × ${nice(cfg.height)} mm.`);
    let bestSheet=-1,best=null;
    for(let i=0;i<sheets.length;i++){
      const c=cutPlanFindPlacement(sheets[i],part,cfg,direction);if(!c)continue;
      if(!best||compareSheetScores(c.score,best.score)<0){best=c;bestSheet=i;}
    }
    if(bestSheet<0){const s=cutPlanNewSheet(cfg),c=cutPlanFindPlacement(s,part,cfg,direction);if(!c)throw new Error(`${part.name}: não foi possível posicionar.`);cutPlanCommitPlacement(s,part,cfg,c);sheets.push(s);}else cutPlanCommitPlacement(sheets[bestSheet],part,cfg,best);
  }
  return sheets;
}
function cutPlanAttemptScore(sheets,cfg){
  let fragmentation=0,cutLength=0,cutCount=0,largestReusable=0,reusableConcentration=0;
  for(const s of sheets){
    fragmentation+=(s.freeRects||[]).length;
    cutLength+=(s.cuts||[]).reduce((n,c)=>n+c.length,0);cutCount+=(s.cuts||[]).length;
    for(const r of s.freeRects||[]){
      if(r.w>=cfg.keepLength&&r.h>=cfg.keepWidth){
        const a=r.w*r.h;largestReusable=Math.max(largestReusable,a);reusableConcentration+=a*a;
      }
    }
  }
  // Primeiro reduz o número de chapas. Em empate, concentra a sobra em retalhos
  // grandes e reaproveitáveis; só depois compara fragmentação e metragem de corte.
  return [sheets.length,-largestReusable,-reusableConcentration,fragmentation,cutLength,cutCount];
}
function cutPlanPackOpen(parts,cfg){
  const dirs=cfg.direction==='auto'?['none','length','width']:[cfg.direction||'none'];
  // 1.300.25: além das ordens clássicas, fazemos passadas determinísticas
  // levemente perturbadas. Em guilhotina a ordem muda completamente os vazios;
  // testar só 'área' e 'maior lado' podia desperdiçar uma chapa inteira.
  const jitterSeeds=cfg.optimization==='advanced'
    ? [2,3,5,8,13,17,22,30,37,41,53,67,79,91,106,117,131,149,167,181,199,223,251,277,307,337,367,401,433,467,503,541,577,613,653,691,733,773,811,853,887,929,971,1013,1051,1093,1151,1201]
    : [2,3,5,8,13,17,22,30];
  const modes=(cfg.optimization==='advanced'?['area','max','width','height','perimeter']:['area','max'])
    .concat(jitterSeeds.map(n=>`jitter${n}`));
  const usableArea=Math.max(1,(cfg.width-2*cfg.margin)*(cfg.height-2*cfg.margin));
  const totalArea=parts.reduce((n,p)=>n+Math.max(0,Number(p.faceW)||0)*Math.max(0,Number(p.faceH)||0),0);
  const areaLowerBound=Math.max(1,Math.ceil((totalArea-.001)/usableArea));
  let best=null,lastError=null;
  outer: for(const dir of dirs)for(const mode of modes){
    try{
      const sheets=cutPlanPackAttempt(parts,cfg,mode,dir),score=cutPlanAttemptScore(sheets,cfg);
      if(!best||compareSheetScores(score,best.score)<0)best={sheets,score};
      // Não existe solução com menos chapas que a área física total. Se já
      // atingimos esse limite, encerra a busca imediatamente.
      if(best.sheets.length<=areaLowerBound)break outer;
    }catch(err){lastError=err;}
  }
  if(!best)throw lastError||new Error('Não foi possível calcular o plano de corte.');
  return best.sheets;
}
function cutPlanSheetStats(sheet,cfg){
  const area=sheet.placements.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),usable=Math.max(1,(cfg.width-2*cfg.margin)*(cfg.height-2*cfg.margin));
  const cutLength=(sheet.cuts||[]).reduce((n,c)=>n+c.length,0);
  const reusable=(sheet.freeRects||[]).filter(r=>r.w>=cfg.keepLength&&r.h>=cfg.keepWidth).sort((a,b)=>b.w*b.h-a.w*a.h);
  return {area,efficiency:area/usable*100,cutLength,reusable};
}
// Importação isolada: não altera objetos, histórico ou materiais do projeto.
let externalCutRows=[];
let externalCutMode=false;
let externalCutSheetSize={width:3050,height:1600};
function externalCutParseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  text=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(ch===';'&&!quoted){row.push(field);field='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}
    else field+=ch;
  }
  if(quoted)throw new Error('CSV com aspas não fechadas.');
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  const headers=(rows.shift()||[]).map(x=>x.trim().toLowerCase());
  const col=name=>headers.indexOf(name.toLowerCase());
  const length=col('Comprimento'),width=col('Largura'),qty=col('Quantidade');
  if(length<0||width<0||qty<0)throw new Error('CSV precisa das colunas Comprimento, Largura e Quantidade.');
  const mm=value=>{const v=String(value||'').trim().replace(/\s*mm$/i,'').replace(/\s/g,'').replace(',','.');return Number(v);};
  const parts=[];
  rows.forEach((r,i)=>{
    if(r.every(x=>!x.trim()))return;
    const a=mm(r[length]),b=mm(r[width]),q=Number(String(r[qty]||'').trim());
    if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0||!Number.isSafeInteger(q)||q<1||q>10000)throw new Error(`Linha ${i+2}: medida ou quantidade inválida.`);
    parts.push({faceW:a,faceH:b,qty:q});
  });
  if(!parts.length)throw new Error('Nenhuma peça válida no CSV.');
  if(parts.reduce((n,r)=>n+r.qty,0)>20000)throw new Error('Lista excede 20.000 peças.');
  return parts;
}
function externalCutParts(){
  const out=[];
  externalCutRows.forEach((r,i)=>{for(let j=0;j<r.qty;j++)out.push({name:`Peça ${i+1}`,faceW:r.faceW,faceH:r.faceH,thickness:0,material:'LISTA EXTERNA',materialCode:'CSV',materialId:null,materialGrain:false,materialGrainRotation:0,machining:[],edgeBands:[],spaceName:'Lista importada',partId:`csv-${i}-${j}`,qty:1});});
  return out;
}
function externalCutRefresh(){
  const el=$('externalCutStatus');if(!el)return;
  const count=externalCutRows.reduce((n,r)=>n+r.qty,0);
  el.textContent=externalCutRows.length?`${externalCutRows.length} linhas · ${count} peças. Apenas comprimento, largura e quantidade. Chapa configurada nesta janela.`:'Nenhuma lista carregada. O projeto 3D permanece intacto.';
  const tbody=$('externalCutPreview');if(tbody)tbody.textContent='';
  externalCutRows.slice(0,150).forEach((r,i)=>{const tr=document.createElement('tr');[i+1,r.faceW,r.faceH,r.qty].forEach(v=>{const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td)});tbody.appendChild(tr)});
  const generateBtn=$('externalCutGenerate');if(generateBtn)generateBtn.disabled=!count;
}
// r22 · Etiquetas independentes: somente leitura dos grupos calculados.
function productionLabelRows(groups){
  const rows=[];let approximate=false;
  for(const [groupIndex,g] of groups.entries()){
    const pending=[...g.parts];const ordered=[];
    if(g.planMode==='panel'&&g.panelSequence?.strips?.length){
      for(const strip of g.panelSequence.strips){
        for(const item of (strip.items||[])){
          const code=String(item.code||'');
          let index=pending.findIndex(p=>String(p.cutCode||'')===code&&Math.abs(Number(p.faceW)-Number(item.length))<.01);
          if(index<0)index=pending.findIndex(p=>String(p.cutCode||'')===code);
          if(index>=0)ordered.push(pending.splice(index,1)[0]);
          else approximate=true;
        }
      }
    }else approximate=true;
    if(pending.length)approximate=true;
    ordered.push(...pending.sort((a,b)=>(Number(a.cutOrder)||Infinity)-(Number(b.cutOrder)||Infinity)||a.y-b.y||a.x-b.x));
    for(const p of ordered)rows.push({sheet:g.sheetNo,group:groupIndex+1,code:p.cutCode||p.partId||'?',name:p.name||'Peça',length:p.faceW,width:p.faceH,thickness:p.thickness||0,material:p.material||'',space:p.spaceName||'',rotated:!!p.rotated,edgeBands:Object.fromEntries(['uMin','uMax','vMin','vMax'].map(k=>[k,p.edgeBands?.[k]?{name:String(p.edgeBands[k].name||''),code:String(p.edgeBands[k].code||'')}:null]))});
  }
  return {rows,approximate};
}
// Bridge / Seccionadora: somente prismas retangulares geometricamente verificados.
// Não aceitar apenas bounding box: curvas, rasgos e recortes NÃO podem virar um ZAW retangular.
function verifiedSketchupSawBlank(mesh){
  const u=mesh?.userData||{}, a=u.importedMesh?.positions;
  if(!Array.isArray(a)||a.length<36||a.length%9!==0)return null;
  const dims=[u.width,u.height,u.depth].map(v=>Number(v)*1000);
  if(dims.some(v=>!Number.isFinite(v)||v<3||v>10000))return null;
  const thicknessAxis=dims.indexOf(Math.min(...dims));
  const t=dims[thicknessAxis];
  if(t>60||dims.filter((v,i)=>i!==thicknessAxis&&v<t*2).length)return null;
  const faceAreas=new Array(6).fill(0);
  const tolerance=0.002;
  for(let i=0;i<a.length;i+=9){
    const pts=[[a[i],a[i+1],a[i+2]],[a[i+3],a[i+4],a[i+5]],[a[i+6],a[i+7],a[i+8]]];
    if(pts.some(v=>v.some(q=>!Number.isFinite(q)||Math.abs(q)>.501)))return null;
    let flat=-1;
    for(let axis=0;axis<3;axis++)for(let side=0;side<2;side++){
      const value=side?0.5:-0.5;
      if(pts.every(pt=>Math.abs(pt[axis]-value)<tolerance)){flat=axis*2+side;break;}
      if(flat>=0)break;
    }
    if(flat<0)return null;
    const axes=[0,1,2].filter(x=>x!==Math.floor(flat/2));
    const x=axes[0],y=axes[1];
    const area=Math.abs((pts[1][x]-pts[0][x])*(pts[2][y]-pts[0][y])-(pts[2][x]-pts[0][x])*(pts[1][y]-pts[0][y]))/2;
    faceAreas[flat]+=area;
  }
  // Todas as 6 faces devem cobrir integralmente a caixa, sem furos nem saliências.
  if(faceAreas.some(area=>Math.abs(area-1)>.025))return null;
  const axes=[0,1,2].filter(i=>i!==thicknessAxis);
  const w=dims[axes[0]],h=dims[axes[1]];
  return {name:String(u.name||'Peça SketchUp'),thickness:t,faceW:w,faceH:h,
    thicknessAxis:['x','y','z'][thicknessAxis],uAxis:['x','y','z'][axes[0]],vAxis:['x','y','z'][axes[1]],
    dims:{x:dims[0],y:dims[1],z:dims[2]},mesh};
}
function sketchupSawCandidates(){
  const meshes=runtimeModel.objects.filter(o=>o?.userData?.importedMesh?.positions?.length);
  return {all:meshes,valid:meshes.map(verifiedSketchupSawBlank).filter(Boolean)};
}
async function sendImportedSketchupSaw(){
  const {all,valid}=sketchupSawCandidates();
  if(!all.length){toast('Importe primeiro o móvel pelo DesignLab Bridge.');return;}
  if(!valid.length){toast('Nenhuma peça SketchUp é um prisma retangular fechado. Use CNC/DXF para curvas e recortes.');return;}
  const skipped=all.length-valid.length;
  if(skipped&&!confirm(`${skipped} componente(s) curvo(s) ou não verificável(is) ficarão FORA do ZAW. Enviar somente ${valid.length} peça(s) retangular(es)?`))return;
  const orderNumber=prompt('Número do pedido para seccionadora:');if(orderNumber===null)return;
  if(!orderNumber.trim()){toast('Informe o número do pedido.');return;}
  const customer=prompt('Nome do cliente:');if(customer===null)return;
  if(!customer.trim()){toast('Informe o cliente.');return;}
  const material=prompt('Material destas chapas (confirme o nome e a espessura antes da produção):','MDF');
  if(material===null)return;
  if(!material.trim()){toast('Informe o material das chapas.');return;}
  const cfg={...cutPlanCfgFromUi(),cutMode:'panel'};
  if(!confirm(`Preparar plano da seccionadora para ${valid.length} peça(s) retangular(es) em ${material.trim()}?\n\nATENÇÃO: fitas OpenCutList ainda precisam ser conferidas no DesignLab. Confira medidas, material, sentido do veio e cortes no Mingli antes de executar.`))return;
  const api=window.designLabCloud?.apiFetch;
  if(!api){toast('Faça login no DesignLab antes de enviar para produção.');return;}
  const btn=$('sendSketchupSawFromPlan');if(btn)btn.disabled=true;
  try{
    const parts=valid.map((p,i)=>({index:i+1,name:p.name,material:material.trim(),materialId:null,materialCode:'',materialRecord:{},materialGrain:false,materialGrainRotation:0,
      productionKind:'sheet',partId:`BRIDGE_${i+1}`,edgeBands:{},edgeBandSignature:'',edgeBandSummary:'',thickness:Math.round(p.thickness*1000)/1000,
      faceW:Math.round(p.faceW*1000)/1000,faceH:Math.round(p.faceH*1000)/1000,finishedFaceW:p.faceW,finishedFaceH:p.faceH,doorProductionOversizeMm:0,
      thicknessAxis:p.thicknessAxis,uAxis:p.uAxis,vAxis:p.vAxis,dims:p.dims,object:p.mesh,machining:[],
      customOutline:null,customCutouts:[],customSlots:null,spaceName:'SketchUp',spaceRootId:''}));
    const groups=groupPartArrayForAspire(parts,cfg);
    if(!groups.length)throw new Error('O otimizador não produziu chapas válidas.');
    const rawZaw=buildMingliZawFiles(groups,cfg).filter(f=>/\.zaw$/i.test(f.name));
    if(rawZaw.length!==groups.length)throw new Error('Quantidade de arquivos ZAW diferente das chapas.');
    const zawFiles=rawZaw.map((f,i)=>({name:f.name,data:f.data,sheet:i+1,sheetNo:groups[i].sheetNo||i+1,group:groups[i].key||''}));
    const work=currentProjectRecord()?.name||'Projeto SketchUp';
    const rows=productionLabelRows(groups).rows;
    const labels={schema:'designlab-labels-v1',work,item:'',orderNumber:orderNumber.trim(),customer:customer.trim(),sequenceVerified:false,approximate:true,
      printConfig:{width:60,height:40,gap:2,padding:2,feedMode:'driver'},labels:rows.map((r,i)=>({...r,sequence:i+1,total:rows.length}))};
    const esc=v=>escapeHtml(String(v??''));
    const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:60mm 40mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial}.labelPage{width:60mm;height:39.8mm;padding:2mm;overflow:hidden;break-inside:avoid}.labelPage+.labelPage{break-before:page}</style></head><body>${labels.labels.map(r=>`<section class="labelPage"><b>${esc(r.name)}</b><p>Pedido ${esc(labels.orderNumber)} · ${esc(labels.customer)}</p><p>${nice(r.length)} × ${nice(r.width)} × ${nice(r.thickness)} mm</p><p>CHAPA ${r.sheet} · ${esc(r.code)}</p><p>FITAS: CONFERIR NO PROJETO</p></section>`).join('')}</body></html>`;
    const sheetPlans=groups.map((g,i)=>({sheet:i+1,sheetNo:g.sheetNo||i+1,group:g.key||'',width:g.cfg.width,height:g.cfg.height,svg:cutPlanPrintSvg(g)}));
    const result=await api('/production/orders',{method:'POST',body:{name:`${labels.orderNumber} · ${labels.customer} · ${work}`,
      machine:'seccionadora',orderNumber:labels.orderNumber,customer:labels.customer,work,labels,html,zawFiles,sheetPlans,cncFiles:[]},timeoutMs:30000});
    toast(`Pedido ${labels.orderNumber} enviado à seccionadora com ${zawFiles.length} ZAW. Ordem ${String(result?.id||'').slice(0,8)}.`);
  }catch(error){toast('Falha no envio à seccionadora: '+(error?.message||'Erro de comunicação'));}
  finally{if(btn)btn.disabled=false;}
}
async function sendImportedSketchupCnc(){
  const meshes=runtimeModel.objects.filter(o=>o?.userData?.importedMesh?.positions?.length);
  if(!meshes.length){toast('Não há componentes SketchUp importados neste projeto.');return;}
  const api=window.designLabCloud?.apiFetch;
  if(!api){toast('Faça login e conecte o DesignLab à nuvem para enviar à CNC.');return;}
  const orderNumber=prompt('Número do pedido para CNC:');if(orderNumber===null)return;
  if(!orderNumber.trim()){toast('Informe um número de pedido.');return;}
  const customer=prompt('Nome do cliente:');if(customer===null)return;
  if(!customer.trim()){toast('Informe o nome do cliente.');return;}
  const prepared=[];
  try{
    for(let i=0;i<meshes.length;i++){
      const mesh=meshes[i],contours=sketchupTopContours(mesh),name=String(mesh.userData.name||'Componente SketchUp');
      const dxf=sketchupContoursDxf(contours);
      prepared.push({name,contours,sheet:i+1,dxf,svg:sketchupContoursSvg(contours,name)});
    }
  }catch(e){toast('Envio CNC bloqueado: '+e.message);return;}
  if(!confirm(`Enviar ${prepared.length} componente(s) SketchUp para CNC?\nSomente vetores de contorno DXF em milímetros; ainda será necessário definir os toolpaths no Aspire.`))return;
  const work=currentProjectRecord()?.name||'Projeto SketchUp';
  const labels=prepared.map((p,i)=>({sheet:p.sheet,group:p.sheet,code:'SK'+(i+1),name:p.name,length:Math.round(p.contours.width*100)/100,width:Math.round(p.contours.depth*100)/100,thickness:Math.round(p.contours.thickness*100)/100,edgeBands:{},sequence:i+1,total:prepared.length}));
  const payload={schema:'designlab-labels-v1',work,item:'',orderNumber:orderNumber.trim(),customer:customer.trim(),sequenceVerified:false,approximate:false,printConfig:{width:60,height:40,gap:2,padding:2,feedMode:'driver'},labels};
  const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>@page{size:60mm 40mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial}.labelPage{width:60mm;height:39.8mm;padding:2mm;box-sizing:border-box;break-after:page}.labelPage:last-child{break-after:auto}h3{font-size:12px}p{font-size:10px}</style>${labels.map(l=>`<section class="labelPage"><h3>${esc(l.name)}</h3><p>Pedido ${esc(payload.orderNumber)} · Cliente ${esc(payload.customer)}</p><p>${l.length} × ${l.width} × ${l.thickness} mm · CNC ${l.sheet}/${l.total}</p><p>Contorno DXF: conferir no Aspire</p></section>`).join('')}</html>`;
  const cncFiles=prepared.map(p=>({sheet:p.sheet,name:`SKETCHUP_${String(p.sheet).padStart(2,'0')}.dxf`,files:[{name:`SKETCHUP_${String(p.sheet).padStart(2,'0')}.dxf`,data:p.dxf}]}));
  const sheetPlans=prepared.map(p=>({sheet:p.sheet,sheetNo:p.sheet,group:'SketchUp',width:p.contours.width,height:p.contours.depth,svg:p.svg}));
  const btn=document.getElementById('sendSketchupCncBtn');if(btn)btn.disabled=true;
  try{
    const result=await api('/production/orders',{method:'POST',body:{name:`${payload.orderNumber} · ${payload.customer} · ${work}`,machine:'cnc',orderNumber:payload.orderNumber,customer:payload.customer,work,labels:payload,html,cncFiles,sheetPlans,zawFiles:[]},timeoutMs:30000});
    toast(`CNC: pedido ${payload.orderNumber} enviado (${prepared.length} contorno(s) DXF). Ordem ${String(result?.id||'').slice(0,8)}.`);
  }catch(e){toast('Falha no envio CNC: '+(e?.message||'Erro de conexão'));}
  finally{if(btn)btn.disabled=false;}
}
function productionLabelsDialog(){
  const groups=cutPlanLastGroups;
  if(!groups.length){toast('Gere primeiro o plano de corte para preparar as etiquetas.');return;}
  const {rows,approximate}=productionLabelRows(groups);
  let dlg=document.getElementById('productionLabelsDialog');
  if(!dlg){dlg=document.createElement('div');dlg.id='productionLabelsDialog';dlg.className='productionLabelsOverlay';dlg.innerHTML=`<section class="productionLabelsPanel" role="dialog" aria-modal="true" aria-labelledby="productionLabelsTitle"><header><div><small>PRODUÇÃO · IMPRESSÃO EM LOTE</small><h3 id="productionLabelsTitle">Etiquetas de produção</h3><p>Uma etiqueta para cada peça física · 60 × 40 mm</p></div><button type="button" id="productionLabelsClose" class="secondary" aria-label="Fechar">✕</button></header><div class="productionLabelsContent"><div class="productionLabelsTabs"><button type="button" id="productionLabelsTabList" class="secondary">Lista de etiquetas</button><button type="button" id="productionLabelsTabConfig" class="secondary">Configuração de impressão</button></div><div id="productionLabelsListPane"><div class="productionLabelsFields"><label>Obra<input id="productionLabelsWork" type="text" maxlength="90" placeholder="Ex.: COZINHA JOÃO"></label><label>Número do pedido<input id="productionOrderNumber" type="text" maxlength="60" placeholder="Ex.: PED-1042"></label><label>Cliente<input id="productionClientName" type="text" maxlength="90" placeholder="Nome do cliente"></label><label>Item<input id="productionLabelsItem" type="text" maxlength="60" placeholder="Ex.: 15.1"></label></div><p class="productionLabelsWarning" id="productionLabelsWarning"></p><div class="productionLabelsSummary" id="productionLabelsSummary"></div><div class="productionLabelsList" id="productionLabelsList"></div></div><div id="productionLabelsConfigPane" hidden><div class="productionLabelsFields"><label>Largura (mm)<input id="plWidth" type="number" min="25" max="150" step="0.5" value="60"></label><label>Altura (mm)<input id="plHeight" type="number" min="20" max="120" step="0.5" value="40"></label><label>Espaço entre etiquetas (mm)<input id="plGap" type="number" min="0" max="15" step="0.5" value="2"></label><label>Avanço da bobina<select id="plFeedMode"><option value="driver">Automático pelo driver (recomendado)</option><option value="manual">Somar intervalo à página (teste)</option></select></label><label>Margem interna (mm)<input id="plPadding" type="number" min="0" max="8" step="0.5" value="2"></label></div><p class="productionLabelsWarning">A mídia de impressão deve ser configurada no driver da impressora. O espaçamento de 2 mm é entre etiquetas físicas; confira se o driver já reconhece esse intervalo para não duplicá-lo.</p><div id="plConfigPreview" class="productionLabelsSummary"></div><button type="button" id="plReset" class="secondary">Restaurar padrão 60 × 40 + 2 mm</button></div></div><footer><button type="button" id="productionLabelsExport" class="secondary">Salvar lista JSON</button><button type="button" id="productionLabelsDownload" class="secondary">Baixar etiquetas HTML</button><button type="button" id="productionLabelsSend">Enviar para produção</button><button type="button" id="productionLabelsPrint">Imprimir etiquetas</button></footer></section>`;document.body.appendChild(dlg);dlg.querySelector('#productionLabelsClose').onclick=()=>dlg.classList.remove('show');dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.classList.remove('show')});}
  dlg.classList.add('show');
  const work=dlg.querySelector('#productionLabelsWork'),item=dlg.querySelector('#productionLabelsItem');
  const orderNumber=dlg.querySelector('#productionOrderNumber'),customer=dlg.querySelector('#productionClientName');
  if(!work.value)work.value=currentProjectRecord()?.name||'';
  const cfgKey='designlab-production-labels-config-v1';
  const defaults={width:60,height:40,gap:2,padding:2,feedMode:'driver'};
  let stored={};try{stored=JSON.parse(localStorage.getItem(cfgKey)||'{}')||{}}catch{}
  const config={...defaults,...stored};
  const configIds={width:'plWidth',height:'plHeight',gap:'plGap',padding:'plPadding'};
  const feedSelect=dlg.querySelector('#plFeedMode');feedSelect.value=config.feedMode==='manual'?'manual':'driver';
  const limits={width:[25,150],height:[20,120],gap:[0,15],padding:[0,8]};
  const refreshConfig=()=>{
    for(const [key,id] of Object.entries(configIds)){
      const input=dlg.querySelector('#'+id);const n=Number(input.value),[min,max]=limits[key];
      config[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):defaults[key];
    }
    config.feedMode=feedSelect.value==='manual'?'manual':'driver';
    dlg.querySelector('#plConfigPreview').textContent=`Etiqueta ${config.width} × ${config.height} mm · intervalo ${config.gap} mm · margem interna ${config.padding} mm · página ${config.height+(config.feedMode==='manual'?config.gap:0)} mm · avanço ${config.feedMode==='driver'?'pelo driver':'manual'}`;
    try{localStorage.setItem(cfgKey,JSON.stringify(config))}catch{}
  };
  for(const [key,id] of Object.entries(configIds)){
    const input=dlg.querySelector('#'+id);input.value=config[key];input.onchange=refreshConfig;
  }
  feedSelect.onchange=refreshConfig;
  dlg.querySelector('#plReset').onclick=()=>{for(const [key,id] of Object.entries(configIds))dlg.querySelector('#'+id).value=defaults[key];feedSelect.value=defaults.feedMode;refreshConfig()};
  const switchTab=showConfig=>{
    dlg.querySelector('#productionLabelsListPane').hidden=showConfig;
    dlg.querySelector('#productionLabelsConfigPane').hidden=!showConfig;
  };
  dlg.querySelector('#productionLabelsTabList').onclick=()=>switchTab(false);
  dlg.querySelector('#productionLabelsTabConfig').onclick=()=>switchTab(true);
  switchTab(false);refreshConfig();
  const esc=v=>escapeHtml(String(v??''));
  dlg.querySelector('#productionLabelsWarning').textContent=approximate?'⚠ Ordem aproximada: a sequência calculada não identifica inequivocamente todas as peças prontas. Confira com o plano da máquina antes de colar.':'⚠ Ordem por faixas do plano mestre; confira na máquina a ordem efetiva em que cada peça fica pronta.';
  dlg.querySelector('#productionLabelsSummary').textContent=`${rows.length} etiquetas · ${groups.length} chapas · impressão em lote`;
  dlg.querySelector('#productionLabelsList').innerHTML=rows.map((r,i)=>`<div class="productionLabelsRow"><b>${String(i+1).padStart(3,'0')}</b><span>Chapa ${r.sheet} · ${esc(r.code)} · ${esc(r.name)}</span><strong>${nice(r.length)} × ${nice(r.width)}${r.thickness?' × '+nice(r.thickness):''} mm</strong></div>`).join('');
  const data=()=>({schema:'designlab-labels-v1',work:work.value.trim(),item:item.value.trim(),orderNumber:orderNumber.value.trim(),customer:customer.value.trim(),sequenceVerified:false,approximate,printConfig:{...config},labels:rows.map((r,i)=>({...r,sequence:i+1,total:rows.length}))});
  dlg.querySelector('#productionLabelsExport').onclick=()=>{const blob=new Blob([JSON.stringify(data(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${safeFileName(work.value||'pedido')}-etiquetas.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const buildHtml=()=>{
    const payload=data();
    const edges=r=>{
      const b=r.edgeBands||{};
      const label=(k,cls)=>`<span class="edge ${cls} ${b[k]?'active':''}">${b[k]?esc(b[k].code||b[k].name||'FITA'):''}</span>`;
      return `<div class="edgeDrawing">${label('vMax','top')}${label('uMin','left')}<div class="edgeCenter"><div class="pieceName">${esc(r.name||'Peça')}</div><div class="thickness">${r.thickness?nice(r.thickness)+' mm':''}</div><div class="measureHorizontal">${nice(r.length)}</div><div class="measureVertical">${nice(r.width)}</div></div>${label('uMax','right')}${label('vMin','bottom')}</div>`;
    };
    const pages=payload.labels.map(r=>`<article class="label"><div class="head"><b>OBRA: ${esc(payload.work||'—')}</b><span>${String(r.sequence).padStart(3,'0')}/${r.total}</span></div><div class="item">ITEM: ${esc(payload.item||'—')}</div>${edges(r)}<div class="foot"><span>${esc(r.code)} · ${esc(r.name)}</span><b>CHAPA ${r.sheet}</b></div></article>`).join('');
    const c=payload.printConfig;
    const manual=c.feedMode==='manual';
    const pageHeight=c.height+(manual?c.gap:0);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etiquetas · ${esc(payload.work)}</title><style>@page{size:${c.width}mm ${pageHeight}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;color:#111;font-family:Arial,sans-serif}.labelPage{width:${c.width}mm;height:${pageHeight}mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid}.labelPage+.labelPage{break-before:page;page-break-before:always}.label{width:${c.width}mm;height:${c.height}mm;padding:${c.padding}mm;display:flex;flex-direction:column;overflow:hidden;background:white}.head{display:flex;justify-content:space-between;gap:1mm;border-bottom:.2mm solid #111;padding-bottom:.5mm;font-size:2.4mm;flex-shrink:0}.head b{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.head span{white-space:nowrap}.item{font-size:2.6mm;font-weight:bold;margin-top:.7mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex-shrink:0}.edgeDrawing{display:grid;grid-template-columns:5.4mm minmax(0,1fr) 5.4mm;grid-template-rows:3.4mm minmax(0,1fr) 3.4mm;min-height:0;flex:1;margin:.8mm 0;gap:.4mm}.edge{font-size:2.15mm;line-height:1.15;overflow:hidden;text-align:center;white-space:nowrap;color:transparent;display:flex;align-items:center;justify-content:center}.edge.active{background:#111;color:#fff;font-weight:800}.edge.top{grid-column:2;grid-row:1}.edge.bottom{grid-column:2;grid-row:3}.edge.left{grid-column:1;grid-row:2;writing-mode:vertical-rl;transform:rotate(180deg)}.edge.right{grid-column:3;grid-row:2;writing-mode:vertical-rl}.edgeCenter{grid-column:2;grid-row:2;border:.2mm solid #444;position:relative;min-width:0;min-height:0}.pieceName{position:absolute;top:15%;left:9%;right:9%;font-size:2.7mm;font-weight:bold;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.thickness{position:absolute;top:47%;left:0;right:0;text-align:center;font-size:2mm}.measureHorizontal{position:absolute;bottom:.5mm;left:12%;right:12%;font-size:3.5mm;text-align:center;font-weight:bold}.measureVertical{position:absolute;right:.6mm;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;font-size:3.1mm;font-weight:bold}.foot{display:flex;justify-content:space-between;gap:1mm;border-top:.2mm solid #111;padding-top:.5mm;font-size:2mm;flex-shrink:0}.foot span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.foot b{white-space:nowrap}@media screen{body{background:#ddd}.labelPage{background:#f2f2f2;margin:8mm auto;box-shadow:0 2px 10px #999}.labelPage:not(:last-child){margin-bottom:10mm}.label{outline:1px solid #aaa}.labelPage{position:relative}.labelPage::after{content:'Intervalo da bobina: ${c.gap} mm · ${manual?'incluído na página':'controlado pelo driver'}';position:absolute;top:100%;left:0;right:0;text-align:center;font-size:10px;color:#666}}@media print{html,body{width:${c.width}mm}.labelPage{height:${pageHeight-0.2}mm;overflow:hidden}.labelPage::after{display:none}} </style></head><body>${pages.replaceAll('<article class="label">','<section class="labelPage"><article class="label">').replaceAll('</article>','</article></section>')}</body></html>`;
  };
  dlg.querySelector('#productionLabelsSend').onclick=async()=>{
    const api=window.designLabCloud?.apiFetch;
    if(!api){toast('Conecte sua conta e sincronize com a nuvem antes de enviar.');return;}
    const machine=prompt('Destino: seccionadora, cnc ou ambas','seccionadora');
    if(machine===null)return;
    const target=machine.trim().toLowerCase();
    if(!['seccionadora','cnc','ambas'].includes(target)){toast('Escolha seccionadora, cnc ou ambas.');return;}
    const payload=data();
    if(!payload.orderNumber||!payload.customer){toast('Preencha o número do pedido e o nome do cliente antes de enviar.');return;}
    const btn=dlg.querySelector('#productionLabelsSend');btn.disabled=true;
    try{
      let zawFiles=[];
      if(target==='seccionadora'||target==='ambas'){
        const cfg=cutPlanCfgFromUi();
        if(cfg.cutMode!=='panel')throw new Error('Para enviar à seccionadora selecione a estratégia Seccionadora e gere o plano novamente.');
        const groups=prepareSheetPreviewGroups().filter(g=>g.planMode==='panel'||g.cutMode==='panel');
        if(!groups.length)throw new Error('Não há chapas válidas para gerar ZAW.');
        zawFiles=buildMingliZawFiles(groups,cfg).filter(f=>/\.zaw$/i.test(f.name)).map((f,i)=>({name:f.name,data:f.data,sheet:i+1,sheetNo:groups[i]?.sheetNo||i+1,group:groups[i]?.key||''}));
        if(!zawFiles.length)throw new Error('O gerador não retornou arquivos ZAW.');
        if(zawFiles.length!==groups.length)throw new Error('Há chapas sem ZAW; envio interrompido para proteger a produção.');
      }
      // CNC: DXF por chapa e operação a partir do exportador Aspire existente (não gera G-code).
      let cncFiles=[];
      if(target==='cnc'||target==='ambas'){
        const cncCfg={...cutPlanCfgFromUi(),cutMode:'cnc'};
        const cncGroups=groupAspireProjectParts(cncCfg);
        const cncOps=buildAspireOperationFiles(cncGroups);
        cncFiles=cncGroups.map((g,i)=>({
          sheet:i+1,
          name:g.file,
          files:[{name:g.file,data:g.text},...cncOps.filter(f=>f.sheetFile===g.file).map(f=>({name:f.name,data:f.data}))]
        }));
        if(!cncFiles.length||cncFiles.some(g=>!g.files.length||g.files.some(f=>typeof f.data!=='string')))
          throw new Error('A exportação DXF para Aspire não gerou arquivos válidos.');
      }
      // Snapshot do plano por chapa: mesma geometria utilizada na visualização/impressão do DesignLab.
      // Não reconstruir posições usando somente dimensões e etiquetas.
      const planGroups=prepareSheetPreviewGroups();
      const sheetPlans=planGroups.map((g,i)=>({sheet:i+1,sheetNo:g.sheetNo||i+1,group:g.key||'',width:Number(g.cfg?.width)||0,height:Number(g.cfg?.height)||0,svg:cutPlanPrintSvg(g)}));
      if((target==='seccionadora'||target==='ambas')&&sheetPlans.length!==zawFiles.length)throw new Error('A quantidade de desenhos não corresponde à quantidade de arquivos ZAW. Revise o plano antes de enviar.');
      const orderName=`${payload.orderNumber} · ${payload.customer} · ${payload.work||'Projeto'}`;
      const result=await api('/production/orders',{method:'POST',body:{name:orderName,machine:target,orderNumber:payload.orderNumber,customer:payload.customer,work:payload.work,labels:payload,html:buildHtml(),zawFiles,sheetPlans,cncFiles},timeoutMs:30000});
      toast('Ordem '+payload.orderNumber+' enviada: '+result.id.slice(0,8).toUpperCase()+' · '+(zawFiles.length?zawFiles.length+' ZAW incluído(s).':'lista de peças disponível.'));
    }catch(error){toast('Não foi possível enviar: '+(error?.message||'erro de conexão'));}
    finally{btn.disabled=false;}
  };
  dlg.querySelector('#productionLabelsDownload').onclick=()=>{
    const blob=new Blob([buildHtml()],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download=`${safeFileName(work.value||'pedido')}-etiquetas.html`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  dlg.querySelector('#productionLabelsPrint').onclick=()=>{
    const win=window.open('','_blank');
    if(!win){toast('Permita pop-ups para abrir a impressão de etiquetas.');return;}
    win.document.open();win.document.write(buildHtml());win.document.close();win.focus();
  };
}
function cutPlanBuildGroups(cfg=cutPlanCfgFromUi()){
  const raw=externalCutMode?externalCutParts():allProjectProductionPartsByKind('sheet');if(!raw.length)throw new Error('O projeto ainda não possui peças de chapa para o plano de corte.');
  const byMaterial=new Map();
  for(const p of raw){const b=cutPlanMaterialBucket(p);if(!byMaterial.has(b.identity))byMaterial.set(b.identity,{label:b.label,parts:[]});byMaterial.get(b.identity).parts.push(p);}
  const groups=[];
  for(const bucket of byMaterial.values()){const key=bucket.label,baseParts=bucket.parts;
    const parts=cutPlanAssignCodes(baseParts),groupCfg=sheetPrefsForPartGroup(cfg,baseParts);let sheets;
    if(groupCfg.cutMode==='panel')sheets=packPartsIntoSheetsPanelSaw(parts,groupCfg);
    else if(groupCfg.cutMode==='cnc')sheets=packPartsIntoSheetsCnc(parts,groupCfg);
    else sheets=cutPlanPackOpen(parts,groupCfg);
    sheets=cutPlanApplyManualTransfers(sheets,groupCfg);
    sheets.forEach((s,i)=>{
      const stats=cutPlanSheetStats(s,groupCfg),first=s.placements[0];
      const preview=buildAspireSheetEntities(s.placements,groupCfg,s.cuts||[]);
      groups.push({
        key,displayName:`${first?.materialCode||first?.material||'Material'} · ${nice(first?.thickness||0)} mm`,
        sheetNo:i+1,totalSheets:sheets.length,parts:s.placements,panelCuts:s.cuts||[],panelSequence:s.panelSequence||null,panelStrips:s.strips||[],freeRects:s.freeRects||[],stats,cfg:{...groupCfg},planMode:groupCfg.cutMode,
        previewEntities:preview.entities,circleCount:preview.circleCount,expectedFaceHoles:preview.expectedFaceHoles
      });
    });
  }
  return groups;
}
function cutPlanGroupRows(parts){
  const map=new Map();
  for(const p of parts){
    const k=cutPlanPartSignature(p);
    if(!map.has(k))map.set(k,{...p,qty:0,spaceNames:new Set(),sourceObjects:[]});
    const r=map.get(k);r.qty++;if(p.spaceName)r.spaceNames.add(p.spaceName);
    if(p.object&&!r.sourceObjects.includes(p.object))r.sourceObjects.push(p.object);
  }
  return [...map.values()].sort((a,b)=>String(a.cutCode).localeCompare(String(b.cutCode),'en',{numeric:true}));
}
function cutPlanToggleGrainObjects(sourceObjects,{keepPreview=false,previewObject=null}={}){
  const targets=[...new Set((sourceObjects||[]).filter(Boolean))].filter(o=>o.userData?.materialGrain);
  if(!targets.length){toast('Esta peça não usa material madeirado / com veio');return;}
  for(const o of targets){
    const u=o.userData||{};
    u.materialGrainRotation=normalizePieceGrainRotation(u.materialGrainRotation)===90?0:90;
  }
  commitHistory();
  // Recalcula imediatamente porque mudar o veio pode obrigar a peça a girar
  // 90° na chapa e, por consequência, reorganizar todo o plano de corte.
  renderPartsList();
  if(keepPreview){
    const wanted=previewObject||targets[0];
    sheetPreviewGroups=cutPlanLastGroups;
    let foundGroup=-1,foundPart=null;
    for(let gi=0;gi<sheetPreviewGroups.length;gi++){
      const p=sheetPreviewGroups[gi].parts.find(x=>x.object===wanted||(wanted.userData?.partId&&x.partId===wanted.userData.partId));
      if(p){foundGroup=gi;foundPart=p;break;}
    }
    if(foundGroup>=0){
      sheetPreviewIndex=foundGroup;sheetPreviewSelectedPart=foundPart;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw();
    }else{
      sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw();
    }
  }
  const rot=normalizePieceGrainRotation(targets[0].userData?.materialGrainRotation);
  toast(targets.length>1?`Veio alterado em ${targets.length} peças · ${rot}°`:`Veio da peça alterado para ${rot}°`);
}
function renderImportedCncParts(){
  const section=$('partsSketchupCncSection'),list=$('partsSketchupCncList');
  if(!section||!list)return;
  const meshes=runtimeModel.objects.filter(o=>o?.userData?.importedMesh?.positions?.length);
  section.hidden=!meshes.length;
  list.replaceChildren();
  for(const [index,mesh] of meshes.entries()){
    const user=mesh.userData||{};
    const row=document.createElement('div');row.className='partRow';
    const details=document.createElement('div');
    const name=document.createElement('div');name.className='partRowName';name.textContent=`CNC ${index+1} · ${user.name||'Componente SketchUp'}`;
    const meta=document.createElement('div');meta.className='partRowMeta';
    const sizes=[user.width,user.depth,user.height].map(n=>nice(Math.round(Number(n)*1000*100)/100));
    meta.textContent=`${sizes.join(' × ')} mm · peça especial · geometria original preservada`;
    details.append(name,meta);
    const hints=user.bridgeMetadata?.edgeBandCandidates||user.importedMesh?.bridgeMetadata?.edgeBandCandidates||{};
    const hintNames=Object.entries(hints).filter(([,names])=>Array.isArray(names)&&names.length)
      .map(([side,names])=>`${side}: ${names.join(' / ')}`);
    const bandInfo=document.createElement('small');
    bandInfo.style.cssText='display:block;margin-top:4px;color:#f4c77c';
    bandInfo.textContent=hintNames.length?`Materiais nas faces de borda (CONFERIR): ${hintNames.join(' · ')}`:
      'Fitas OpenCutList: não identificadas com segurança — conferir antes de produzir';
    details.append(bandInfo);
    const sawBlank=verifiedSketchupSawBlank(mesh);
    const eligibility=document.createElement('small');eligibility.style.cssText='display:block;margin-top:4px;color:'+(sawBlank?'#66d6a6':'#f0bb75');
    eligibility.textContent=sawBlank?'✓ Retangular verificada · disponível para seccionadora':'Somente CNC · contorno não retangular ou não verificável';
    details.append(eligibility);row.append(details);
    const actions=document.createElement('div');actions.className='cutPlanRowActions';
    const btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.textContent='Baixar contorno DXF';
    btn.onclick=()=>{try{const c=sketchupTopContours(mesh);downloadText(`SKETCHUP_${index+1}_${safeFileName(user.name||'peca')}.dxf`,sketchupContoursDxf(c),'application/dxf');}
      catch(err){toast('Não foi possível gerar o DXF: '+(err?.message||err));}};
    actions.append(btn);row.append(actions);list.append(row);
  }
}
function updateCncOnlyPartsPresentation(){
  const root=$('partsListDialog');
  if(!root)return false;
  const specials=runtimeModel.objects.filter(o=>o?.userData?.importedMesh?.positions?.length).length;
  const normal=['sheet','wood','metal'].reduce((sum,kind)=>sum+allProjectProductionPartsByKind(kind).length,0);
  const onlyCnc=specials>0&&normal===0;
  root.classList.toggle('cutPlanCncOnly',onlyCnc);
  const heading=root.querySelector('.cutPlanTitleRow h3');
  if(heading)heading.textContent=onlyCnc?'Peças especiais · Produção CNC':'Peças gerais · Planos de corte';
  const info=$('partsListInfo');
  if(info&&onlyCnc)info.textContent=`${specials} componente(s) importado(s) do SketchUp. CNC recebe DXF de contornos; seccionadora recebe ZAW apenas de prismas retangulares fechados e verificados.`;
  const general=$('partsGeneralSummary');
  if(general&&onlyCnc){
    general.replaceChildren();
    const grid=document.createElement('div');grid.className='cutPlanSummaryGrid';
    const count=document.createElement('span'),number=document.createElement('b'),label=document.createElement('small');
    number.textContent=String(specials);label.textContent=specials===1?'peça especial CNC':'peças especiais CNC';
    count.append(number,label);grid.append(count);
    const text=document.createElement('div');text.className='cutPlanSummaryText';
    text.textContent='Geometria original preservada. O DXF deve ser conferido no Aspire antes da usinagem.';
    general.append(grid,text);
  }
  return onlyCnc;
}
function renderPartsList(){
  const cfg=cutPlanCfgFromUi();setSheetPrefs(cfg);updateSheetCutModeUi();
  const list=$('partsList'),summary=$('partsSummary');list.innerHTML='';
  dlRenderGeneralPartsSummary();
  renderImportedCncParts();
  const onlyCnc=updateCncOnlyPartsPresentation();
  try{
    const groups=cutPlanBuildGroups(cfg);cutPlanLastGroups=groups;cutPlanLastValidCfg={...cfg};
    const allParts=groups.flatMap(g=>g.parts),spaces=[...new Set(allParts.map(p=>p.spaceName).filter(Boolean))];
    const totalArea=allParts.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),sheetArea=groups.reduce((n,g)=>n+Math.max(1,(g.cfg.width-2*g.cfg.margin)*(g.cfg.height-2*g.cfg.margin)),0),totalEff=sheetArea?totalArea/sheetArea*100:0,totalCut=groups.reduce((n,g)=>n+g.stats.cutLength,0);
    const reusable=groups.reduce((n,g)=>n+g.stats.reusable.length,0),sheetSizes=[...new Set(groups.map(g=>`${nice(g.cfg.width)} × ${nice(g.cfg.height)}`))];
    const sheetText=sheetSizes.length===1?`chapa ${sheetSizes[0]} mm`:`${sheetSizes.length} tamanhos de chapa conforme o material`;
    summary.innerHTML=`<div class="cutPlanSummaryGrid"><span><b>${allParts.length}</b><small>peças</small></span><span><b>${groups.length}</b><small>chapas</small></span><span><b>${nice(totalEff)}%</b><small>aproveitamento</small></span><span><b>${nice(totalCut/1000)} m</b><small>corte estimado</small></span></div><div class="cutPlanSummaryText"><strong>${escapeHtml(cutPlanModeLabel(cfg))}</strong> · ${sheetText} · refilo ${nice(cfg.margin)} mm · corte ${nice(cfg.gap)} mm · ${reusable} sobra(s) útil(eis) · ${spaces.length} espaço(s)</div>`;

    const byKey=new Map();
    groups.forEach((g,gi)=>{if(!byKey.has(g.key))byKey.set(g.key,{name:g.displayName,sheets:[],parts:[]});const d=byKey.get(g.key);d.sheets.push({g,gi});d.parts.push(...g.parts);});
    for(const [key,data] of byKey.entries()){
      const box=document.createElement('div');box.className='partsGroup';
      const eff=data.sheets.reduce((n,x)=>n+x.g.stats.efficiency,0)/Math.max(1,data.sheets.length);
      const head=document.createElement('div');head.className='partsGroupHead';const firstCfg=data.sheets[0]?.g?.cfg||cfg;const autoStock=firstCfg.sheetMaterialName?` · ${escapeHtml(firstCfg.sheetMaterialName)}${firstCfg.materialSheetOverride?' · tamanho manual':''}`:'';head.innerHTML=`<span>${escapeHtml(data.name)}</span><span>${data.sheets.length} chapa(s) · ${nice(firstCfg.width)}×${nice(firstCfg.height)} · ${nice(eff)}%${autoStock}</span>`;box.appendChild(head);
      for(const p of cutPlanGroupRows(data.parts)){
        const row=document.createElement('div');row.className='partRow';
        const left=document.createElement('div');const nm=document.createElement('div');nm.className='partRowName';nm.innerHTML=`<span class="cutPlanCode">${escapeHtml(p.cutCode||'?')}</span>${escapeHtml(p.name||'Peça')}`;
        const meta=document.createElement('div');meta.className='partRowMeta';const origins=[...p.spaceNames];meta.textContent=`${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm${p.materialGrain?` · veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} ${normalizePieceGrainRotation(p.materialGrainRotation)}° · 90° bloqueado`:''}${p.edgeBandSummary?' · FITA: '+p.edgeBandSummary:''}${actualMachiningCount(p)?' · USINAGENS: '+actualMachiningCount(p):''}${origins.length?' · '+origins.join(', '):''}`;left.append(nm,meta);
        const qty=document.createElement('div');qty.className='partQty';qty.textContent=`×${p.qty}`;
        const right=document.createElement('div');right.className='cutPlanRowActions';
        if(p.materialGrain){
          const grainBtn=document.createElement('button');grainBtn.type='button';grainBtn.className='cutPlanGrainBtn';const grainAxis=cutPlanPieceGrainAxis(p,{placed:false});grainBtn.textContent=p.qty>1?`↻ Veio ${grainAxis.localSymbol} ×${p.qty}`:`↻ Veio ${grainAxis.localSymbol}`;grainBtn.title=p.qty>1?'Rotacionar 90° o veio de todas as peças iguais desta linha':'Rotacionar 90° somente o veio desta peça';
          grainBtn.onclick=e=>{e.preventDefault();e.stopPropagation();cutPlanToggleGrainObjects(p.sourceObjects)};
          right.appendChild(grainBtn);
        }
        right.appendChild(qty);row.append(left,right);box.appendChild(row);
      }
      const chips=document.createElement('div');chips.style.padding='8px 10px 10px';
      for(const x of data.sheets){const c=document.createElement('button');c.type='button';c.className='sheetChip';c.innerHTML=`<strong>Chapa ${x.g.sheetNo}</strong> · ${nice(x.g.stats.efficiency)}% · ${nice(x.g.stats.cutLength/1000)} m corte`;c.onclick=()=>openSheetPreviewAt(x.gi);chips.appendChild(c);}box.appendChild(chips);list.appendChild(box);
    }
    const sheetModeInfo=cfg.cutMode==='open'?'Chapas: cortes guilhotina, refilo, espessura de corte, otimização e sobras úteis.':cfg.cutMode==='panel'?'Chapas: seccionadora de pinça com plano mestre global; impressão, CSV e ZAW seguem o mesmo plano.':'Chapas: CNC / Router com encaixe livre por área e exportador Aspire.';
    if(!onlyCnc)$('partsListInfo').textContent=`${externalCutMode?'Lista externa importada':'Peças gerais do projeto'} · ${sheetModeInfo} Madeira maciça e ferro / Metalon aparecem nas seções abaixo.`;
  }catch(err){
    const msg=String(err?.message||'Não foi possível calcular as chapas');
    // 1.312.00-r2 · configuração transacional do plano: uma alteração inválida
    // (ex.: girar a chapa/veio e fazer uma peça deixar de caber) nunca apaga o
    // último nesting válido. O campo volta automaticamente para a configuração
    // anterior e o usuário continua vendo/abrindo o plano normalmente.
    if(cutPlanLastGroups.length&&cutPlanLastValidCfg&&!cutPlanRestoreGuard){
      const failedMsg=msg;
      cutPlanRestoreGuard=true;
      try{
        applyCutPlanCfgToUi(cutPlanLastValidCfg);
        renderPartsList();
      }finally{cutPlanRestoreGuard=false;}
      toast(`Alteração cancelada: ${failedMsg} · O último plano válido foi restaurado.`);
      return;
    }
    cutPlanLastGroups=[];
    if(/não possui peças de chapa|não há peças de chapa|sem peças de chapa/i.test(msg)){
      const specialCount=runtimeModel.objects.filter(o=>o?.userData?.importedMesh?.positions?.length).length;
      summary.innerHTML=`<div class="cutPlanSummaryGrid"><span><b>0</b><small>peças retangulares</small></span><span><b>${specialCount}</b><small>peças especiais CNC</small></span><span><b>0</b><small>chapas otimizadas</small></span></div><div class="cutPlanSummaryText"><strong>${specialCount?'Componentes CNC reconhecidos na seção acima.':'Sem peças de chapa neste projeto.'}</strong> Peças curvas não são enviadas ao corte retangular da seccionadora.</div>`;
      list.innerHTML='<div class="partsGroup"><div class="partsGroupHead"><span>▦ Chapas / painéis</span><span>nenhuma peça</span></div><div class="partRow"><div><div class="partRowName">Sem peças de MDF, lâmina ou outro material em chapa.</div><div class="partRowMeta">As seções de madeira maciça e ferro / Metalon continuam disponíveis abaixo.</div></div></div></div>';
    }else{
      summary.textContent=msg;
    }
    if(!onlyCnc)$('partsListInfo').textContent='Peças gerais do projeto: chapas, madeira maciça e ferro / Metalon reunidos na mesma tela.';
  }
  dlRenderInlineLinearPlans();
}
function openPartsListDialog(){
  externalCutMode=false;
  applySheetPrefsToUi();applyCutPlanExtraPrefs();
  if(!localStorage.getItem(CUT_PLAN_PREFS_KEY+'-mode')){$('sheetCutMode').value='open';localStorage.setItem(CUT_PLAN_PREFS_KEY+'-mode','1');}
  updateSheetCutModeUi();renderPartsList();$('partsListDialog').style.display='flex';
}

function prepareSheetPreviewGroups(){return cutPlanLastGroups.length?cutPlanLastGroups:cutPlanBuildGroups(cutPlanCfgFromUi());}
function refreshSheetPreviewSelect(){
  const sel=$('sheetPreviewSelect');sel.innerHTML='';
  sheetPreviewGroups.forEach((g,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${String(i+1).padStart(2,'0')} · ${g.displayName} · Chapa ${g.sheetNo}/${g.totalSheets} · ${nice(g.stats.efficiency)}%`;sel.appendChild(o)});
  sel.value=String(sheetPreviewIndex);$('sheetPreviewPrev').disabled=sheetPreviewIndex<=0;$('sheetPreviewNext').disabled=sheetPreviewIndex>=sheetPreviewGroups.length-1;
}
function openSheetPreview(){openSheetPreviewAt(0)}
function openSheetPreviewAt(index=0){
  try{
    sheetPreviewGroups=prepareSheetPreviewGroups();if(!sheetPreviewGroups.length)throw new Error('Não há chapas para visualizar.');
    sheetPreviewIndex=Math.max(0,Math.min(sheetPreviewGroups.length-1,Number(index)||0));sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;refreshSheetPreviewSelect();$('sheetPreviewDialog').classList.add('show');requestAnimationFrame(sheetPreviewDraw);
  }catch(err){toast(err.message||'Não foi possível montar o plano de corte');}
}
function closeSheetPreview(){$('sheetPreviewDialog').classList.remove('show');sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;sheetPreviewLastTransform=null}
function selectSheetPreviewIndex(i){i=Math.max(0,Math.min(sheetPreviewGroups.length-1,Number(i)||0));sheetPreviewIndex=i;sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw()}
function cutPlanCanvasSize(){
  const canvas=$('sheetPreviewCanvas'),wrap=canvas.parentElement,r=wrap.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),cssW=Math.max(300,Math.floor(r.width-20)),cssH=Math.max(280,Math.floor(r.height-20));
  if(canvas.width!==Math.floor(cssW*dpr)||canvas.height!==Math.floor(cssH*dpr)){canvas.width=Math.floor(cssW*dpr);canvas.height=Math.floor(cssH*dpr);canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';}
  return {canvas,cssW,cssH,dpr};
}
function cutPlanDrawWaste(ctx,g,cfg,sx,sy,scale){
  if(g.planMode==='cnc'||!$('sheetPreviewWaste')?.checked)return;
  for(const r of g.freeRects||[]){
    const x=cfg.margin+r.x,y=cfg.margin+r.y,rx=sx(x),ry=sy(y+r.h),rw=r.w*scale,rh=r.h*scale,keep=r.w>=cfg.keepLength&&r.h>=cfg.keepWidth;
    ctx.save();ctx.fillStyle=keep?'rgba(107,150,82,.15)':'rgba(80,86,89,.045)';ctx.strokeStyle=keep?'rgba(77,128,64,.68)':'rgba(119,124,126,.38)';ctx.lineWidth=1;ctx.setLineDash(keep?[5,3]:[3,4]);ctx.fillRect(rx,ry,rw,rh);ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);
    if(rw>48&&rh>32){ctx.strokeStyle=keep?'rgba(80,130,67,.35)':'rgba(120,124,126,.23)';ctx.beginPath();ctx.moveTo(rx+5,ry+5);ctx.lineTo(rx+rw-5,ry+rh-5);ctx.moveTo(rx+rw-5,ry+5);ctx.lineTo(rx+5,ry+rh-5);ctx.stroke();ctx.fillStyle=keep?'#4c7541':'#858b8e';ctx.font='600 8px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${nice(r.w)} × ${nice(r.h)}`,rx+rw/2,ry+rh/2);}
    ctx.restore();
  }
}
function cutPlanPieceGrainAxis(p,{placed=true}={}){
  const grainRot=normalizePieceGrainRotation(p?.materialGrainRotation);
  // Mesma convenção do otimizador: 0° = maior lado; 90° = menor lado.
  const faceWIsMajor=Number(p?.faceW)>=Number(p?.faceH);
  const alongFaceW=grainRot===0?faceWIsMajor:!faceWIsMajor;
  // No desenho da chapa, uma peça girada 90° troca também o eixo visual do veio.
  // Assim a seta representa o veio REAL que o operador verá na peça já posicionada.
  const alongX=placed?(alongFaceW!==!!p?.rotated):alongFaceW;
  return {grainRot,alongFaceW,alongX,symbol:alongX?'↔':'↕',localSymbol:alongFaceW?'↔':'↕'};
}
function cutPlanDrawGrain(ctx,p,b,cfg,sx,sy,scale){
  if(!p.materialGrain)return;
  const axis=cutPlanPieceGrainAxis(p),rx=sx(b.x),ry=sy(b.y+b.h),rw=b.w*scale,rh=b.h*scale;
  if(rw<14||rh<14)return;
  const horizontal=axis.alongX;
  // Deixamos a seta fora do centro para não ficar escondida pelo código/letra da peça.
  const cx=horizontal?rx+rw/2:rx+Math.min(rw/2,Math.max(9,rw*.20));
  const cy=horizontal?ry+Math.min(rh/2,Math.max(9,rh*.20)):ry+rh/2;
  const available=horizontal?rw:rh;
  const len=Math.max(12,Math.min(available*.64,110));
  const x1=horizontal?cx-len/2:cx,y1=horizontal?cy:cy+len/2;
  const x2=horizontal?cx+len/2:cx,y2=horizontal?cy:cy-len/2;
  const head=Math.max(4,Math.min(8,len*.13));
  const drawArrow=(stroke,lineWidth)=>{
    ctx.strokeStyle=stroke;ctx.fillStyle=stroke;ctx.lineWidth=lineWidth;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    const headAt=(x,y,dir)=>{
      ctx.beginPath();
      if(horizontal){ctx.moveTo(x,y);ctx.lineTo(x-dir*head,y-head*.62);ctx.moveTo(x,y);ctx.lineTo(x-dir*head,y+head*.62);}
      else{ctx.moveTo(x,y);ctx.lineTo(x-head*.62,y+dir*head);ctx.moveTo(x,y);ctx.lineTo(x+head*.62,y+dir*head);}
      ctx.stroke();
    };
    headAt(x2,y2,1);headAt(x1,y1,-1);
  };
  ctx.save();
  // Halo claro + traço laranja forte: continua legível sobre peças claras,
  // seleção azul e linhas de usinagem.
  drawArrow('rgba(255,255,255,.96)',5.4);
  drawArrow('#b96700',2.35);
  if(rw>62&&rh>38){
    const fs=Math.max(7,Math.min(10,Math.min(rw,rh)*.16));
    ctx.font=`900 ${fs}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const tx=horizontal?cx:cx+Math.min(22,rw*.24),ty=horizontal?cy+Math.min(13,rh*.22):cy;
    ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.96)';ctx.strokeText('VEIO',tx,ty);ctx.fillStyle='#8a4b00';ctx.fillText('VEIO',tx,ty);
  }
  ctx.restore();
}
function cutPlanDrawMachining(ctx,g,sx,sy,scale){
  if(!$('sheetPreviewMachining')?.checked)return;
  // Furos e rasgos das faces principais usam exatamente a mesma projeção usada pelo DXF Aspire.
  for(const e of (g.previewEntities||[])){
    if(e.role!=='machining')continue;
    const face=previewEntityFace(e),isB=face==='B';
    ctx.save();
    if(e.kind==='circle'){
      ctx.strokeStyle=isB?'#7b43d1':'#d62d7b';ctx.fillStyle=isB?'rgba(123,67,209,.08)':'rgba(214,45,123,.10)';ctx.lineWidth=Math.max(1.4,Math.min(2.6,scale*.6));if(isB)ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.arc(sx(e.x),sy(e.y),Math.max(2.4,e.r*scale),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
      // Cruz central ajuda a conferir o centro do furo mesmo em zoom pequeno.
      const cr=Math.max(2.5,Math.min(6,e.r*scale*.55));ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx(e.x)-cr,sy(e.y));ctx.lineTo(sx(e.x)+cr,sy(e.y));ctx.moveTo(sx(e.x),sy(e.y)-cr);ctx.lineTo(sx(e.x),sy(e.y)+cr);ctx.stroke();
    }else if(e.kind==='rect'){
      const rx=sx(e.x),ry=sy(e.y+e.h),rw=e.w*scale,rh=e.h*scale;ctx.strokeStyle=isB?'#15799a':'#0099c7';ctx.fillStyle=isB?'rgba(21,121,154,.07)':'rgba(0,153,199,.12)';ctx.lineWidth=1.8;if(isB)ctx.setLineDash([5,3]);ctx.fillRect(rx,ry,rw,rh);ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);
    }
    ctx.restore();
  }
  // Furo cuja entrada é pela borda não pode ser representado como círculo de face.
  // Mostramos um triângulo laranja no ponto projetado para não esconder a operação.
  for(const p of g.parts||[])for(const mk of previewEdgeHoleMarkers(p)){
    const x=sx(mk.x),y=sy(mk.y),r=5;ctx.save();ctx.fillStyle='#e47a16';ctx.strokeStyle='#7c3a00';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y+r);ctx.lineTo(x-r,y+r);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  // Encaixes/formas também são usinagens do contorno.
  for(const e of (g.previewEntities||[])){
    if(e.layer!=='ENCAIXE_MONTANTE'||!e.points?.length)continue;ctx.save();ctx.strokeStyle='#bf8a00';ctx.fillStyle='rgba(218,168,16,.10)';ctx.lineWidth=1.6;ctx.beginPath();e.points.forEach((pt,i)=>{const x=sx(pt[0]),y=sy(pt[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
}
function cutPlanMachiningSummary(p){
  const out=[];
  for(const op of (p.machining||[])){
    if(op.type==='hole'){const qty=holeSeriesInstances(p.object,op).length,edge=entryAxisName(op.entryAxis)!==p.thicknessAxis,face=edge?'BORDA':(entryAxisSign(op.entryAxis)>0?'A':'B');out.push(`${qty} furo${qty===1?'':'s'} Ø${nice(op.diameter)} × ${nice(operationDepthMm(p.object,op))} mm · ${face}${op.hardwareName?' · '+op.hardwareName:''}`);}
    else{const face=entryAxisSign(op.entryAxis)>0?'A':'B',label=op.preset==='drawer-bottom-groove'?'Rasgo fundo gaveta':op.preset==='back-groove'?'Rasgo de fundo':'Rasgo';out.push(`${label} ${nice(op.length)} × ${nice(op.width)} × ${nice(operationDepthMm(p.object,op))} mm · ${face}`);}
  }
  if(p.customSlots?.length)out.push(`${p.customSlots.length} encaixe(s) de contorno`);
  return out;
}
function cutPlanPanelSequenceHtml(g,{compact=false}={}){
  const seq=g?.panelSequence;if(!seq)return '';
  const cfg=g.cfg||{};
  const direction=seq.firstAxis==='H'
    ? `faixas no comprimento (${nice(Math.max(0,cfg.width-2*cfg.margin))} mm)`
    : `faixas na largura (${nice(Math.max(0,cfg.height-2*cfg.margin))} mm)`;
  const strips=(seq.strips||[]).map(st=>{
    const pcs=(st.items||[]).map(it=>`${escapeHtml(String(it.code||'?'))} ${nice(it.length)}`).join(' · ');
    return `<div class="panelSawSeqStrip"><b>F${st.number} · ${nice(st.size)} mm</b><span>↻ 90° · ${pcs||'sem peças'}</span></div>`;
  }).join('');
  return `<div class="panelSawSeq ${compact?'compact':''}"><div class="panelSawSeqTitle">SEQUÊNCIA DA SECCIONADORA · PLANO MESTRE</div><div><b>1.</b> Formar ${seq.strips?.length||0} faixa(s) · ${direction}</div><div><b>2.</b> Depois das faixas, concluir F1 inteira (com os giros necessários), depois F2, F3… · mesmas posições do plano</div>${strips}</div>`;
}

function cutPlanRenderSide(){
  const g=sheetPreviewGroups[sheetPreviewIndex];if(!g)return;const cfg=g.cfg,st=g.stats,status=$('sheetPreviewStatus');
  const keep=st.reusable.slice(0,4).map(r=>`${nice(r.w)} × ${nice(r.h)}`).join(' · ');
  status.className='sheetPreviewStatus ok';
  const mach=sheetPreviewStats(g),machTotal=mach.holesA+mach.holesB+mach.edge+mach.groovesA+mach.groovesB+mach.slots;
  status.innerHTML=`<strong>${escapeHtml(g.displayName)}</strong><br>Chapa ${g.sheetNo}/${g.totalSheets} · ${g.parts.length} peça(s)<br>Aproveitamento <b>${nice(st.efficiency)}%</b> · corte estimado <b>${nice(st.cutLength/1000)} m</b><br>Usinagens: <b>${machTotal}</b> · furos A ${mach.holesA} · B ${mach.holesB}${mach.edge?` · borda ${mach.edge}`:''} · rasgos ${mach.groovesA+mach.groovesB}<br>Chapa ${nice(cfg.width)} × ${nice(cfg.height)} · refilo ${nice(cfg.margin)} · corte ${nice(cfg.gap)} mm${keep?`<br>Sobras úteis: ${escapeHtml(keep)}`:'<br>Sem sobra útil acima do mínimo configurado.'}${g.planMode==='panel'?cutPlanPanelSequenceHtml(g,{compact:true}):''}`;
  $('sheetPreviewModeText').textContent=g.planMode==='open'?'Otimizado · cortes guilhotina e sobras concentradas.':g.planMode==='panel'?`Seccionadora de pinça · plano mestre · ${g.panelSequence?.turns||0} faixa(s)/giro(s).`:'CNC / Router · encaixe livre por área.';
  const p=sheetPreviewSelectedPart,card=$('sheetPreviewPartCard');
  if(!p||!g.parts.includes(p)){
    sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;card.innerHTML='<h4>Nenhuma peça selecionada</h4><div class="meta">Toque numa peça para ver código, medida, material e origem.</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary" disabled>Ampliar peça</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button></div>';
  }else{
    const same=g.parts.filter(x=>x.cutCode===p.cutCode).length;
    const ops=cutPlanMachiningSummary(p);
    card.innerHTML=`<h4><span class="cutPlanCode">${escapeHtml(p.cutCode||'?')}</span>${escapeHtml(p.name||'Peça')}</h4><div class="meta">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm · ${escapeHtml(p.materialCode||p.material||'MDF')}<br>${same>1?`${same} peça(s) iguais nesta chapa · `:''}${p.rotated?'girada 90° · ':''}${p.materialGrain?`veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} ${normalizePieceGrainRotation(p.materialGrainRotation)}° · `:''}${escapeHtml(p.spaceName||'')}</div><div class="sheetPreviewPartOps"><div class="sheetPreviewOp">Posição na chapa: X ${nice(p.x)} · Y ${nice(p.y)} mm</div>${p.edgeBandSummary?`<div class="sheetPreviewOp">Fitas: ${escapeHtml(p.edgeBandSummary)}</div>`:''}${ops.length?ops.map(x=>`<div class="sheetPreviewOp">${escapeHtml(x)}</div>`).join(''):'<div class="sheetPreviewOp">Sem usinagens nesta peça.</div>'}</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary">${sheetPreviewIsolated?'Voltar à chapa':'Ampliar peça'}</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button><button id="sheetPreviewTransfer" type="button" class="secondary">⇄ Transferir peça</button>${p.materialGrain?`<button id="sheetPreviewRotateGrain" type="button" class="cutPlanPreviewGrainBtn">↻ Veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} · Rotacionar 90°</button>`:''}</div>`;
  }
  $('sheetPreviewIsolate').onclick=()=>{if(sheetPreviewSelectedPart){sheetPreviewIsolated=!sheetPreviewIsolated;sheetPreviewDraw()}};
  $('sheetPreviewFit').onclick=()=>{sheetPreviewIsolated=false;sheetPreviewDraw()};
  const transferBtn=$('sheetPreviewTransfer');if(transferBtn&&sheetPreviewSelectedPart)transferBtn.onclick=()=>cutPlanOpenTransferMenu(sheetPreviewSelectedPart);
  const grainBtn=$('sheetPreviewRotateGrain');
  if(grainBtn&&sheetPreviewSelectedPart?.object)grainBtn.onclick=()=>cutPlanToggleGrainObjects([sheetPreviewSelectedPart.object],{keepPreview:true,previewObject:sheetPreviewSelectedPart.object});
  $('sheetPreviewSheetInfo').innerHTML=`<strong>${escapeHtml(g.displayName)}</strong> · chapa ${g.sheetNo}/${g.totalSheets}`;
  $('sheetPreviewFaceInfo').textContent=`${nice(st.efficiency)}% · ${nice(st.cutLength/1000)} m de corte`;
}

function cutPlanEnsureTransferDialog(){
  let dlg=document.getElementById('cutPlanTransferDialog');if(dlg)return dlg;
  dlg=document.createElement('div');dlg.id='cutPlanTransferDialog';dlg.className='cutPlanTransferDialog';dlg.innerHTML=`<div class="cutPlanTransferBox"><div class="cutPlanTransferHead"><div><strong>Transferir peça</strong><span id="cutPlanTransferPart"></span></div><button id="cutPlanTransferClose" type="button" class="secondary">✕</button></div><div id="cutPlanTransferList" class="cutPlanTransferList"></div><div class="cutPlanTransferHelp">A transferência só é confirmada se a peça couber respeitando veio, rotação permitida, margem e corte. Se não couber, nada muda.</div></div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.classList.remove('show')});
  dlg.querySelector('#cutPlanTransferClose').onclick=()=>dlg.classList.remove('show');
  return dlg;
}
function cutPlanOpenTransferMenu(part){
  const source=sheetPreviewGroups[sheetPreviewIndex];if(!source||!part)return;
  const dlg=cutPlanEnsureTransferDialog(),list=dlg.querySelector('#cutPlanTransferList');
  dlg.querySelector('#cutPlanTransferPart').textContent=`${part.cutCode||''} ${part.name||'Peça'} · ${nice(part.faceW)} × ${nice(part.faceH)} mm`;
  list.innerHTML='';
  const compatible=sheetPreviewGroups.map((g,i)=>({g,i})).filter(x=>x.g.key===source.key&&x.i!==sheetPreviewIndex);
  if(!compatible.length)list.innerHTML='<div class="cutPlanTransferEmpty">Não há outra chapa deste mesmo material/espessura.</div>';
  for(const {g,i} of compatible){
    const test=cutPlanCanTransferPart(part,g),b=document.createElement('button');b.type='button';b.className='cutPlanTransferTarget'+(test.ok?'':' disabled');b.disabled=!test.ok;
    b.innerHTML=`<span><b>Chapa ${g.sheetNo}</b><small>${nice(g.stats?.efficiency||0)}% usado · ${g.parts.length} peça(s)</small></span><em>${test.ok?'Cabe ✓':'Não cabe'}</em>`;
    b.title=test.ok?'Transferir para esta chapa':test.reason;
    if(test.ok)b.onclick=()=>cutPlanTransferPartToSheet(part,g.sheetNo,dlg);
    list.appendChild(b);
  }
  const auto=document.createElement('button');auto.type='button';auto.className='cutPlanTransferTarget auto';auto.innerHTML='<span><b>Voltar ao automático</b><small>Remove a preferência manual desta peça</small></span><em>↺</em>';
  auto.onclick=()=>{if(part.object?.userData)delete part.object.userData.cutPlanSheetHint;commitHistory?.();dlg.classList.remove('show');cutPlanRefreshAfterManualTransfer(part.object);};list.appendChild(auto);
  dlg.classList.add('show');
}
function cutPlanRefreshAfterManualTransfer(wantedObject){
  renderPartsList();
  sheetPreviewGroups=cutPlanLastGroups||[];
  let gi=0,found=null;
  for(let i=0;i<sheetPreviewGroups.length;i++){
    const p=sheetPreviewGroups[i].parts.find(x=>x.object===wantedObject||(wantedObject?.userData?.partId&&x.partId===wantedObject.userData.partId));
    if(p){gi=i;found=p;break;}
  }
  sheetPreviewIndex=Math.max(0,Math.min(gi,Math.max(0,sheetPreviewGroups.length-1)));sheetPreviewSelectedPart=found;sheetPreviewIsolated=false;refreshSheetPreviewSelect();sheetPreviewDraw();
}
function cutPlanTransferPartToSheet(part,targetSheetNo,dlg){
  const target=sheetPreviewGroups.find(g=>g.key===sheetPreviewGroups[sheetPreviewIndex]?.key&&g.sheetNo===targetSheetNo);
  const test=cutPlanCanTransferPart(part,target);
  if(!test.ok){toast(test.reason||'A peça não cabe na chapa escolhida.');return;}
  if(part.object?.userData)part.object.userData.cutPlanSheetHint=targetSheetNo;
  commitHistory?.();
  dlg?.classList.remove('show');
  const name=part.name||'Peça';
  cutPlanRefreshAfterManualTransfer(part.object);
  toast(`${name} transferida para a chapa ${targetSheetNo}.`);
}
function cutPlanPartAtPointerEvent(e){
  const w=sheetPreviewPointerToWorld(e),g=sheetPreviewGroups[sheetPreviewIndex];if(!w||!g)return null;
  const hits=g.parts.filter(p=>pointInPreviewPart(p,w.x,w.y));return hits.length?hits[hits.length-1]:null;
}

function sheetPreviewDraw(){
  const g=sheetPreviewGroups[sheetPreviewIndex],size=cutPlanCanvasSize(),canvas=size.canvas,cssW=size.cssW,cssH=size.cssH,dpr=size.dpr,ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
  if(!g){$('sheetPreviewEmpty').style.display='grid';return}$('sheetPreviewEmpty').style.display='none';const cfg=g.cfg;
  const view=sheetPreviewViewport(g,cfg),pad=34,scale=Math.min((cssW-pad*2)/view.w,(cssH-pad*2)/view.h),ox=(cssW-view.w*scale)/2-view.x*scale,oy=(cssH-view.h*scale)/2+(view.y+view.h)*scale;
  const sx=x=>ox+x*scale,sy=y=>oy-y*scale;sheetPreviewLastTransform={scale,ox,oy,sx,sy,cssW,cssH};
  const x0=sx(0),x1=sx(cfg.width),y0=sy(0),y1=sy(cfg.height);
  ctx.save();ctx.shadowColor='rgba(0,0,0,.26)';ctx.shadowBlur=14;ctx.fillStyle='#fff';ctx.fillRect(x0,y1,x1-x0,y0-y1);ctx.restore();ctx.strokeStyle='#41474b';ctx.lineWidth=1.5;ctx.strokeRect(x0,y1,x1-x0,y0-y1);
  ctx.save();ctx.fillStyle='rgba(140,140,132,.08)';ctx.fillRect(x0,y1,x1-x0,y0-y1);ctx.clearRect(sx(cfg.margin),sy(cfg.height-cfg.margin),(cfg.width-2*cfg.margin)*scale,(cfg.height-2*cfg.margin)*scale);ctx.setLineDash([5,4]);ctx.strokeStyle='#9ba0a2';ctx.lineWidth=1;ctx.strokeRect(sx(cfg.margin),sy(cfg.height-cfg.margin),(cfg.width-2*cfg.margin)*scale,(cfg.height-2*cfg.margin)*scale);ctx.restore();

  cutPlanDrawWaste(ctx,g,cfg,sx,sy,scale);

  for(const p of g.parts){
    const b=sheetPreviewPartBounds(p),rx=sx(b.x),ry=sy(b.y+b.h),rw=b.w*scale,rh=b.h*scale,sel=p===sheetPreviewSelectedPart,outline=sheetPreviewPlacedOutline(p);
    ctx.save();ctx.fillStyle=sel?'#e6f0ff':'#f7f7f5';ctx.strokeStyle=sel?'#2d7dfa':'#262a2d';ctx.lineWidth=sel?2.5:1.25;
    if(outline?.length){
      ctx.beginPath();outline.forEach((pt,i)=>{const px=sx(pt[0]),py=sy(pt[1]);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)});ctx.closePath();ctx.fill();ctx.stroke();
    }else{ctx.fillRect(rx,ry,rw,rh);ctx.strokeRect(rx,ry,rw,rh);}
    cutPlanDrawGrain(ctx,p,b,cfg,sx,sy,scale);
    if($('sheetPreviewLabels')?.checked){
      const codeFs=Math.max(10,Math.min(30,Math.min(rw*.26,rh*.34)));ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#25282a';ctx.font=`900 ${codeFs}px system-ui,sans-serif`;if(rw>24&&rh>20)ctx.fillText(String(p.cutCode||'?'),rx+rw/2,ry+rh/2-(rh>58?5:0));
      if(rw>82&&rh>52){ctx.font='700 8px system-ui,sans-serif';ctx.fillStyle='#5e6569';ctx.fillText(`${nice(p.faceW)} × ${nice(p.faceH)}`,rx+rw/2,ry+rh/2+codeFs*.65);}
      if(rw>125&&rh>74){ctx.font='600 7px system-ui,sans-serif';ctx.fillStyle='#7a8084';ctx.fillText(String(p.name||'Peça').slice(0,28),rx+rw/2,ry+rh-10);}
    }
    ctx.restore();
  }

  cutPlanDrawMachining(ctx,g,sx,sy,scale);

  if($('sheetPreviewEdgeHoles')?.checked)for(const cut of g.panelCuts||[]){
    const col=cut.orientation==='H'?'#168758':'#c9445b';ctx.save();ctx.strokeStyle=col;ctx.globalAlpha=.78;ctx.lineWidth=Math.max(1.2,Math.min(4,cfg.gap*scale*.55));ctx.beginPath();ctx.moveTo(sx(cut.x1),sy(cut.y1));ctx.lineTo(sx(cut.x2),sy(cut.y2));ctx.stroke();ctx.globalAlpha=1;
    if((cut.length||0)*scale>55){const mx=(sx(cut.x1)+sx(cut.x2))/2,my=(sy(cut.y1)+sy(cut.y2))/2;ctx.fillStyle=col;ctx.beginPath();ctx.arc(mx,my,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='800 7px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(cut.order||''),mx,my);}ctx.restore();
  }

  ctx.save();ctx.fillStyle='#32373a';ctx.font='800 9px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(nice(cfg.width)+' mm',(x0+x1)/2,Math.max(11,y1-8));ctx.translate(Math.max(11,x0-11),(y0+y1)/2);ctx.rotate(-Math.PI/2);ctx.fillText(nice(cfg.height)+' mm',0,0);ctx.restore();
  cutPlanRenderSide();
}

// ---------- 1.200.18 · impressão técnica do plano de corte em A4 ----------
// A impressão é propositalmente independente do indicador de veio da tela.
// O sentido continua sendo respeitado no cálculo/encaixe, mas não é desenhado
// nem escrito no relatório impresso.
function cutPlanPrintSvg(group){
  const g=group,cfg=g.cfg,toY=y=>cfg.height-y,parts=[],mach=[],cuts=[],waste=[];
  if($('sheetPreviewWaste')?.checked&&g.planMode!=='cnc')for(const r of (g.freeRects||[])){
    const x=cfg.margin+r.x,y=toY(cfg.margin+r.y+r.h),keep=r.w>=cfg.keepLength&&r.h>=cfg.keepWidth;
    waste.push(`<rect x="${x}" y="${y}" width="${r.w}" height="${r.h}" fill="${keep?'#eef3ea':'#f5f5f3'}" stroke="${keep?'#75866e':'#c3c5c4'}" stroke-width="5" stroke-dasharray="18 12"/>`);
  }
  for(const p of (g.parts||[])){
    const outline=sheetPreviewPlacedOutline(p),b=sheetPreviewPartBounds(p);
    if(outline?.length){
      const pts=outline.map(q=>`${q[0]},${toY(q[1])}`).join(' ');
      parts.push(`<polygon points="${pts}" fill="#fafaf8" stroke="#252525" stroke-width="6"/>`);
    }else parts.push(`<rect x="${b.x}" y="${toY(b.y+b.h)}" width="${b.w}" height="${b.h}" fill="#fafaf8" stroke="#252525" stroke-width="6"/>`);

    // Sem desenho de veio na impressão. Mantemos somente identificação útil.
    const cx=b.x+b.w/2,cy=toY(b.y+b.h/2);
    const codeFs=Math.max(44,Math.min(118,Math.min(b.w,b.h)*.25));
    const nameFs=Math.max(24,Math.min(48,Math.min(b.w,b.h)*.105));
    const dimFs=Math.max(22,Math.min(42,Math.min(b.w,b.h)*.09));
    if($('sheetPreviewLabels')?.checked){
      parts.push(`<text x="${cx}" y="${cy-codeFs*.22}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${codeFs}" font-weight="900" fill="#16191b">${escapeHtml(String(p.cutCode||'?'))}</text>`);
      if(b.w>300&&b.h>180){
        const maxName=String(p.name||'Peça').length>22?String(p.name||'Peça').slice(0,21)+'…':String(p.name||'Peça');
        parts.push(`<text x="${cx}" y="${cy+codeFs*.34}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${nameFs}" font-weight="700" fill="#303437">${escapeHtml(maxName)}</text>`);
      }
      if(b.w>390&&b.h>235)parts.push(`<text x="${cx}" y="${cy+codeFs*.77}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${dimFs}" font-weight="700" fill="#55595b">${escapeHtml(`${nice(p.faceW)} × ${nice(p.faceH)}`)}</text>`);
    }
  }
  if($('sheetPreviewMachining')?.checked){
    for(const e of (g.previewEntities||[])){
      if(e.role!=='machining'&&e.layer!=='ENCAIXE_MONTANTE')continue;
      if(e.kind==='circle')mach.push(`<circle cx="${e.x}" cy="${toY(e.y)}" r="${Math.max(8,e.r)}" fill="none" stroke="#9a2b58" stroke-width="9"/>`);
      else if(e.kind==='rect')mach.push(`<rect x="${e.x}" y="${toY(e.y+e.h)}" width="${e.w}" height="${e.h}" fill="none" stroke="#26728a" stroke-width="9"/>`);
      else if(e.points?.length)mach.push(`<polygon points="${e.points.map(pt=>`${pt[0]},${toY(pt[1])}`).join(' ')}" fill="none" stroke="#8b6f20" stroke-width="9"/>`);
    }
    for(const p of (g.parts||[]))for(const mk of previewEdgeHoleMarkers(p))mach.push(`<polygon points="${mk.x},${toY(mk.y)-18} ${mk.x+17},${toY(mk.y)+15} ${mk.x-17},${toY(mk.y)+15}" fill="#a75d27" stroke="#5e3218" stroke-width="5"/>`);
  }
  if($('sheetPreviewEdgeHoles')?.checked)for(const cut of (g.panelCuts||[])){const mx=(cut.x1+cut.x2)/2,my=toY((cut.y1+cut.y2)/2);cuts.push(`<line x1="${cut.x1}" y1="${toY(cut.y1)}" x2="${cut.x2}" y2="${toY(cut.y2)}" stroke="#6f7476" stroke-width="10"/><circle cx="${mx}" cy="${my}" r="28" fill="#303437"/><text x="${mx}" y="${my+3}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="28" font-weight="900" fill="#fff">${cut.order||''}</text>`);}
  return `<svg class="planSvg" viewBox="-24 -24 ${cfg.width+48} ${cfg.height+48}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano da chapa"><rect x="0" y="0" width="${cfg.width}" height="${cfg.height}" fill="#fff" stroke="#202224" stroke-width="9"/><rect x="${cfg.margin}" y="${cfg.margin}" width="${Math.max(0,cfg.width-2*cfg.margin)}" height="${Math.max(0,cfg.height-2*cfg.margin)}" fill="none" stroke="#a6aaac" stroke-width="5" stroke-dasharray="22 15"/>${waste.join('')}${parts.join('')}${mach.join('')}${cuts.join('')}</svg>`;
}
function cutPlanPrintPartRows(group){
  const by=new Map();
  for(const p of (group.parts||[])){
    const key=[p.cutCode||'',p.name||'',nice(p.faceW),nice(p.faceH),nice(p.thickness),p.materialCode||p.material||''].join('|');
    if(!by.has(key))by.set(key,{...p,count:0});
    by.get(key).count++;
  }
  return [...by.values()].map(p=>`<tr><td class="codeCell">${escapeHtml(String(p.cutCode||'?'))}</td><td><b>${escapeHtml(p.name||'Peça')}</b><small>${escapeHtml(p.materialCode||p.material||'MDF')}</small></td><td class="qtyCell">${p.count}</td><td class="dimCell">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)}</td></tr>`).join('');
}
function cutPlanPrintPanelSequence(group){
  const seq=group?.panelSequence;if(!seq)return '';
  const cfg=group.cfg||{};
  const long=seq.firstAxis==='H'
    ? Math.max(0,cfg.width-2*cfg.margin)
    : Math.max(0,cfg.height-2*cfg.margin);
  const label=seq.firstAxis==='H'?'comprimento':'largura';
  const strips=(seq.strips||[]).map(st=>{
    const pcs=(st.items||[]).map(it=>`<span><b>${escapeHtml(String(it.code||'?'))}</b> ${nice(it.length)}</span>`).join('');
    return `<div class="seqStrip"><div><b>F${st.number}</b><small>${nice(st.size)} mm</small></div><div class="seqTurn">↻ GIRAR 90°</div><div class="seqPieces">${pcs||'<span>—</span>'}</div></div>`;
  }).join('');
  return `<div class="sequencePanel"><div class="panelTitle">SEQUÊNCIA · SECCIONADORA · PLANO MESTRE</div><div class="seqIntro"><b>1. FORMAR FAIXAS</b><span>${seq.strips?.length||0} faixa(s) no ${label} · curso ${nice(long)} mm</span><b>2. GIRAR E CORTAR</b><span>Após os cortes primários, processar F1 até terminar; depois F2, F3… respeitando os giros exigidos.</span></div><div class="seqStrips">${strips}</div></div>`;
}

function cutPlanPrintLinearPages(){
  const pages=[];
  for(const g of dlWoodPlanGroups()){
    const mat=g.material||{},stockLength=Number(mat.stockLength||mat.sheetWidth||6000),stockWidth=Number(mat.stockWidth||mat.sheetHeight||250);
    const cfg={...normalizedSheetPrefs(getSheetPrefs()),width:stockLength,height:stockWidth,margin:0,gap:3,grain:true,grainDirection:'length',cutMode:'cnc',optimization:'advanced',direction:'length',keepLength:100,keepWidth:20};
    let planks=[],err='';try{planks=cutPlanPackOpen(g.parts,cfg);}catch(e){err=String(e?.message||e||'Falha no plano de madeira');}
    const rows=planks.map((pl,i)=>{
      const usedArea=pl.placements.reduce((n,p)=>n+cutPlanPartAreaMm2(p),0),pct=usedArea/Math.max(1,stockLength*stockWidth)*100;
      return `<tr><td><b>Prancha ${i+1}</b><small>${nice(stockLength)} × ${nice(stockWidth)} mm</small></td><td>${pl.placements.map(p=>`${escapeHtml(p.name||'Peça')} · ${nice(p.faceW)}×${nice(p.faceH)}×${nice(p.thickness)} mm`).join('<br>')}</td><td>${nice(pct)}%</td></tr>`;
    }).join('');
    pages.push(`<section class="printCutPage linearPrintPage"><header class="reportHead"><div><div class="brand">DESIGNLABMÓVEIS</div><h1>${escapeHtml(currentProjectRecord()?.name||'DesignLabMoveis')}</h1><h2>🪵 Plano de corte · Madeira maciça</h2></div><div class="sheetTag"><span>PRANCHA</span><b>${planks.length}</b><small>${g.parts.length} peça(s)</small></div></header><div class="summaryGrid linearSummary"><div><span>Material</span><b>${escapeHtml(mat.name||'Madeira maciça')}</b></div><div><span>Espessura</span><b>${nice(g.thickness)} mm</b></div><div><span>Matéria-prima</span><b>${nice(stockLength)} × ${nice(stockWidth)} mm</b></div><div><span>Corte</span><b>3 mm</b></div></div><div class="linearReportBody">${err?`<div class="linearError">${escapeHtml(err)}</div>`:`<table class="linearTable"><thead><tr><th>Prancha</th><th>Peças / cortes</th><th>Aproveit.</th></tr></thead><tbody>${rows}</tbody></table>`}</div><footer><span>Madeira maciça · plano separado das chapas</span><span>DesignLabMoveis 1.311.00</span></footer></section>`);
  }
  for(const g of dlMetalPlanGroups()){
    const mat=g.material||{},stockLength=Number(mat.stockLength||mat.sheetWidth||6000),profile=mat.profileWidth&&mat.profileHeight?`${nice(mat.profileWidth)} × ${nice(mat.profileHeight)} mm`:'perfil cadastrado';
    let bars=[],err='';try{bars=dlPackMetalBars(g.parts,stockLength,3);}catch(e){err=String(e?.message||e||'Falha no plano de ferro');}
    const rows=bars.map(b=>`<tr><td><b>Barra ${b.index}</b><small>${nice(stockLength)} mm</small></td><td>${b.parts.map(p=>`${escapeHtml(p.name||'Peça')} · ${nice(dlLinearPieceLengthMm(p))} mm`).join('<br>')}</td><td>${nice(b.waste)} mm</td></tr>`).join('');
    pages.push(`<section class="printCutPage linearPrintPage"><header class="reportHead"><div><div class="brand">DESIGNLABMÓVEIS</div><h1>${escapeHtml(currentProjectRecord()?.name||'DesignLabMoveis')}</h1><h2>▰ Plano de corte · Ferro / Metalon</h2></div><div class="sheetTag"><span>BARRA</span><b>${bars.length}</b><small>${g.parts.length} peça(s)</small></div></header><div class="summaryGrid linearSummary"><div><span>Material</span><b>${escapeHtml(mat.name||'Perfil metálico')}</b></div><div><span>Perfil</span><b>${escapeHtml(profile)}</b></div><div><span>Barra</span><b>${nice(stockLength)} mm</b></div><div><span>Corte</span><b>3 mm</b></div></div><div class="linearReportBody">${err?`<div class="linearError">${escapeHtml(err)}</div>`:`<table class="linearTable"><thead><tr><th>Barra</th><th>Peças / comprimentos</th><th>Sobra</th></tr></thead><tbody>${rows}</tbody></table>`}</div><footer><span>Ferro / Metalon · plano separado das chapas</span><span>DesignLabMoveis 1.311.00</span></footer></section>`);
  }
  return pages;
}
function cutPlanPrintDocument(groups){
  const project=escapeHtml(currentProjectRecord()?.name||'DesignLabMoveis'),sheetPages=groups.map((g,i)=>{
    const st=g.stats,mach=sheetPreviewStats(g),machTotal=mach.holesA+mach.holesB+mach.edge+mach.groovesA+mach.groovesB+mach.slots;
    const unique=new Set((g.parts||[]).map(p=>p.cutCode||p.name)).size;
    return `<section class="printCutPage">
      <header class="reportHead"><div><div class="brand">DESIGNLABMÓVEIS</div><h1>${project}</h1><h2>${escapeHtml(g.displayName)}</h2></div><div class="sheetTag"><span>CHAPA</span><b>${g.sheetNo}/${g.totalSheets}</b><small>Página ${i+1} de ${groups.length}</small></div></header>
      <div class="summaryGrid"><div><span>Dimensão da chapa</span><b>${nice(g.cfg.width)} × ${nice(g.cfg.height)} mm</b></div><div><span>Aproveitamento</span><b>${nice(st.efficiency)}%</b></div><div><span>Peças</span><b>${g.parts.length}</b></div><div><span>Tipos</span><b>${unique}</b></div><div><span>Corte estimado</span><b>${nice(st.cutLength/1000)} m</b></div><div><span>Usinagens</span><b>${machTotal}</b></div></div>
      <div class="reportBody"><div class="drawingPanel"><div class="panelTitle">PLANO DA CHAPA</div><div class="drawing">${cutPlanPrintSvg(g)}</div></div><aside class="rightPanel">${g.planMode==='panel'?cutPlanPrintPanelSequence(g):''}<div class="partsPanel"><div class="panelTitle">PEÇAS DESTA CHAPA</div><table><thead><tr><th>Cód.</th><th>Peça / material</th><th>Qtd.</th><th>Medidas (mm)</th></tr></thead><tbody>${cutPlanPrintPartRows(g)}</tbody></table></div></aside></div>
      <footer><span>Refilo ${nice(g.cfg.margin)} mm · espessura de corte ${nice(g.cfg.gap)} mm</span><span>DesignLabMoveis 1.311.00</span></footer>
    </section>`;
  });
  const pages=[...sheetPages,...cutPlanPrintLinearPages()].join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Planos de corte · ${project}</title><style>
    @page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#17191a;font-family:Arial,Helvetica,sans-serif}.printCutPage{height:198mm;display:flex;flex-direction:column;gap:2.2mm;break-after:page;page-break-after:always;overflow:hidden}.printCutPage:last-child{break-after:auto;page-break-after:auto}.reportHead{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:.55mm solid #222;padding:0 0 2mm}.brand{font-size:2.35mm;font-weight:900;letter-spacing:.16em;color:#5f6669}h1{font-size:5mm;margin:.6mm 0 0;line-height:1.05}h2{font-size:3mm;margin:1mm 0 0;color:#4d5356}.sheetTag{min-width:31mm;border:.35mm solid #27292a;padding:1.4mm 2mm;text-align:center}.sheetTag span{display:block;font-size:2mm;font-weight:900;letter-spacing:.14em;color:#666}.sheetTag b{display:block;font-size:6mm;line-height:1.05}.sheetTag small{font-size:2mm;color:#666}.summaryGrid{display:grid;grid-template-columns:1.45fr repeat(5,1fr);gap:1.2mm}.summaryGrid>div{border:.25mm solid #b9bdbe;padding:1.4mm 1.7mm;background:#f5f5f3;min-width:0}.summaryGrid span{display:block;font-size:1.8mm;text-transform:uppercase;font-weight:800;color:#6a7073;white-space:nowrap}.summaryGrid b{display:block;margin-top:.45mm;font-size:2.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reportBody{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 82mm;gap:2mm}.rightPanel{min-height:0;display:flex;flex-direction:column;gap:1.5mm}.drawingPanel,.partsPanel,.sequencePanel{min-height:0;border:.25mm solid #aeb2b3;display:flex;flex-direction:column}.partsPanel{flex:1}.panelTitle{height:6mm;display:flex;align-items:center;padding:0 2mm;border-bottom:.25mm solid #aeb2b3;background:#eeeeeb;font-size:2.15mm;font-weight:900;letter-spacing:.05em}.drawing{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:2mm}.planSvg{width:100%;height:100%;display:block}.partsPanel{overflow:hidden}.partsPanel table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2mm}.partsPanel thead{display:table-header-group}.partsPanel th{padding:1.1mm .9mm;text-align:left;background:#f6f6f4;border-bottom:.25mm solid #bfc2c3;font-size:1.7mm;text-transform:uppercase;color:#555}.partsPanel td{padding:1.15mm .9mm;border-bottom:.2mm solid #dedfdf;vertical-align:middle;line-height:1.15;overflow:hidden}.partsPanel th:nth-child(1),.partsPanel td:nth-child(1){width:10mm}.partsPanel th:nth-child(3),.partsPanel td:nth-child(3){width:10mm;text-align:center}.partsPanel th:nth-child(4),.partsPanel td:nth-child(4){width:28mm;text-align:right}.partsPanel small{display:block;margin-top:.35mm;color:#747a7d;font-size:1.65mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.codeCell{font-size:2.5mm;font-weight:900;text-align:center}.qtyCell{font-weight:900}.dimCell{font-weight:800;white-space:nowrap}.partsPanel tbody tr:nth-child(even){background:#fafaf9}.sequencePanel{flex:0 0 auto;max-height:64mm;overflow:hidden}.seqIntro{padding:1.2mm 1.5mm;font-size:1.75mm;display:grid;grid-template-columns:auto 1fr;gap:.5mm 1.2mm;border-bottom:.2mm solid #ddd}.seqIntro b{font-size:1.7mm}.seqIntro span{color:#555}.seqStrips{padding:.7mm 1mm}.seqStrip{display:grid;grid-template-columns:17mm 20mm 1fr;align-items:center;gap:.8mm;padding:.75mm .5mm;border-bottom:.2mm solid #e0e0df;font-size:1.7mm}.seqStrip>div:first-child{display:flex;gap:1mm;align-items:center}.seqStrip small{color:#666}.seqTurn{font-weight:900;font-size:1.55mm}.seqPieces{display:flex;flex-wrap:wrap;gap:.7mm 1.2mm}.seqPieces span{white-space:nowrap}.seqPieces b{font-size:1.8mm}footer{display:flex;justify-content:space-between;border-top:.25mm solid #c4c6c7;padding-top:1.2mm;font-size:2mm;color:#5b6164}.linearSummary{grid-template-columns:repeat(4,1fr)}.linearReportBody{flex:1;min-height:0;border:.25mm solid #aeb2b3;overflow:hidden}.linearTable{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2.4mm}.linearTable th{background:#eeeeeb;text-align:left;padding:2mm;border-bottom:.3mm solid #aaa}.linearTable td{padding:2mm;vertical-align:top;border-bottom:.2mm solid #ddd;line-height:1.45}.linearTable th:first-child,.linearTable td:first-child{width:35mm}.linearTable th:last-child,.linearTable td:last-child{width:30mm;text-align:right}.linearTable small{display:block;color:#666;margin-top:.6mm}.linearError{padding:5mm;font-weight:800;color:#9b1c1c}.linearPrintPage h2{font-size:3.4mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>${pages}</body></html>`;
}
function printCutPlan(){
  try{
    let groups=[];try{groups=prepareSheetPreviewGroups();}catch(_){}
    const hasLinear=dlWoodPlanGroups().length||dlMetalPlanGroups().length;
    if(!groups.length&&!hasLinear)throw new Error('Não há peças de chapa, madeira ou ferro para imprimir.');
    const html=cutPlanPrintDocument(groups),w=window.open('','_blank');
    if(!w){downloadText(`${safeFileName(currentProjectRecord()?.name||'projeto')}-plano-de-corte.html`,html,'text/html;charset=utf-8');toast('O navegador bloqueou a impressão · salvei o plano de corte em HTML');return;}
    w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>{try{w.print()}catch(_){}},400);
  }catch(err){toast(err.message||'Não foi possível imprimir o plano de corte');}
}

function exportPanelSawSequenceCsv(){
  try{
    const cfg=cutPlanCfgFromUi();
    if(cfg.cutMode!=='panel')throw new Error('Selecione a estratégia Seccionadora para gerar a sequência.');
    const groups=prepareSheetPreviewGroups().filter(g=>g.planMode==='panel');
    if(!groups.length)throw new Error('Não há chapas de seccionadora para exportar.');
    const csv=buildPanelSawCutsCsv(groups,cfg);
    const name=`${safeFileName(currentProjectRecord()?.name||'projeto')}-sequencia-seccionadora.csv`;
    downloadText(name,'\ufeff'+csv,'text/csv;charset=utf-8');
    toast(`Sequência da seccionadora gerada · ${groups.length} chapa(s). CSV de integração/conferência.`);
  }catch(err){toast(err.message||'Não foi possível gerar a sequência da seccionadora');}
}


async function exportPanelSawMingliZaw(){
  let target=null;
  try{
    const cfg=cutPlanCfgFromUi();
    if(cfg.cutMode!=='panel')throw new Error('Selecione a estratégia Seccionadora para gerar o Mingli ZAW.');
    const groups=prepareSheetPreviewGroups().filter(g=>g.planMode==='panel'||g.cutMode==='panel');
    if(!groups.length)throw new Error('Não há chapas de seccionadora para exportar.');
    const files=buildMingliZawFiles(groups,cfg);
    const filename=`${safeFileName(currentProjectRecord()?.name||'projeto')}-MINGLI-ZAW-1-POR-CHAPA-TESTE.zip`;
    target=await pickExportTarget(filename,'designlab-export-mingli-zaw','application/zip');
    const result=await writeExportTarget(target,zipStore(files),filename);
    const zawCount=files.filter(f=>/\.zaw$/i.test(f.name)).length;
    toast(`Mingli ZAW salvo em ${result.locationLabel} · ${zawCount} arquivo(s) .zaw, um por chapa. Primeiro confira no software antes de mandar cortar.`);
  }catch(err){
    if(isExportPickerCancel(err)){toast('Exportação ZAW cancelada');return;}
    toast(err.message||'Não foi possível gerar o pacote Mingli ZAW');
  }
}

// Área externa é opcional: nunca impedir a inicialização do CAD se o HTML estiver desatualizado.
const productionLabelsOpen=$('productionLabelsOpen');
if(productionLabelsOpen)productionLabelsOpen.addEventListener('click',productionLabelsDialog);
if(['externalCutOpen','externalCutDialog','externalCutClose','externalCutFile','externalCutGenerate','externalCutSheetWidth','externalCutSheetHeight'].every(id=>!!$(id))){
$('externalCutOpen').onclick=()=>{$('externalCutDialog').style.display='flex';externalCutRefresh();};
$('externalCutClose').onclick=()=>{$('externalCutDialog').style.display='none';};
if($('externalCutCancel'))$('externalCutCancel').onclick=$('externalCutClose').onclick;
$('externalCutFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{externalCutRows=externalCutParseCsv(await file.text());externalCutRefresh();}
  catch(err){externalCutRows=[];externalCutRefresh();toast(err.message||'Falha na leitura do CSV');}
  e.target.value='';
});
$('externalCutGenerate').onclick=()=>{
  const width=Number($('externalCutSheetWidth').value),height=Number($('externalCutSheetHeight').value);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<100||height<100){toast('Informe medidas válidas para a chapa externa.');return;}
  externalCutSheetSize={width,height};
  externalCutMode=true;cutPlanLastGroups=[];cutPlanLastValidCfg=null;
  $('externalCutDialog').style.display='none';
  applySheetPrefsToUi();applyCutPlanExtraPrefs();updateSheetCutModeUi();
  $('partsListDialog').style.display='flex';renderPartsList();
};
}
$('closePartsList').onclick=()=>{$('partsListDialog').style.display='none';};
$('partsListDialog').addEventListener('pointerdown',e=>{if(e.target===$('partsListDialog'))$('partsListDialog').style.display='none';});
['sheetWidth','sheetHeight','sheetMargin','sheetGap','sheetKeepLength','sheetKeepWidth'].forEach(id=>$(id).addEventListener('input',renderPartsList));
$('sheetGrain').addEventListener('change',renderPartsList);
$('sheetGrainDirection').addEventListener('change',renderPartsList);
if($('sendSketchupCncBtn'))$('sendSketchupCncBtn').onclick=sendImportedSketchupCnc;
if($('sendSketchupCncFromPlan'))$('sendSketchupCncFromPlan').onclick=sendImportedSketchupCnc;
if($('sendSketchupSawFromPlan'))$('sendSketchupSawFromPlan').onclick=sendImportedSketchupSaw;
$('sheetCutMode').addEventListener('change',()=>{updateSheetCutModeUi();renderPartsList();});
$('sheetOptimization').addEventListener('change',renderPartsList);
$('sheetDirection').addEventListener('change',renderPartsList);
if($('sheetPanelFirst'))$('sheetPanelFirst').addEventListener('change',renderPartsList);
if($('sheetMaterialOverrideEnabled'))$('sheetMaterialOverrideEnabled').addEventListener('change',()=>{refreshCutPlanMaterialOverrideUi();cutPlanUpdateMaterialOverrideStatus();});
if($('sheetMaterialOverrideMaterial'))$('sheetMaterialOverrideMaterial').addEventListener('change',()=>{refreshCutPlanMaterialOverrideUi({syncSize:true});cutPlanUpdateMaterialOverrideStatus();});
['sheetMaterialOverrideWidth','sheetMaterialOverrideHeight'].forEach(id=>{if($(id))$(id).addEventListener('input',cutPlanUpdateMaterialOverrideStatus);});
if($('sheetMaterialOverrideConfirm'))$('sheetMaterialOverrideConfirm').addEventListener('click',confirmCutPlanMaterialOverride);

$('previewAspireFromPartsBtn').onclick=openSheetPreview;
if($('exportPanelSawSequenceBtn'))$('exportPanelSawSequenceBtn').onclick=exportPanelSawSequenceCsv;
if($('exportPanelSawZawBtn'))$('exportPanelSawZawBtn').onclick=exportPanelSawMingliZaw;
if($('sheetPreviewPanelCsv'))$('sheetPreviewPanelCsv').onclick=exportPanelSawSequenceCsv;
if($('sheetPreviewPanelZaw'))$('sheetPreviewPanelZaw').onclick=exportPanelSawMingliZaw;
$('printCutPlanFromPartsBtn').onclick=printCutPlan;
$('sheetPreviewClose').onclick=closeSheetPreview;
if($('sheetPreviewMobileClose'))$('sheetPreviewMobileClose').onclick=closeSheetPreview;
$('sheetPreviewPrint').onclick=printCutPlan;
$('sheetPreviewExport').onclick=()=>{setSheetPrefs(sheetPrefsFromUi());exportProjectAspireZip();};
$('sheetPreviewPrev').onclick=()=>selectSheetPreviewIndex(sheetPreviewIndex-1);
$('sheetPreviewNext').onclick=()=>selectSheetPreviewIndex(sheetPreviewIndex+1);
$('sheetPreviewSelect').addEventListener('change',e=>selectSheetPreviewIndex(e.target.value));
document.querySelectorAll('[data-sheet-face]').forEach(b=>b.addEventListener('click',()=>{sheetPreviewFace=b.dataset.sheetFace||'ALL';document.querySelectorAll('[data-sheet-face]').forEach(x=>x.classList.toggle('active',x===b));sheetPreviewDraw()}));
$('sheetPreviewLabels').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewMachining').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewEdgeHoles').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewWaste').addEventListener('change',sheetPreviewDraw);
$('sheetPreviewDialog').addEventListener('pointerdown',e=>{if(e.target===$('sheetPreviewDialog'))closeSheetPreview()});
let cutPlanHoldTimer=null,cutPlanHoldStart=null,cutPlanHoldTriggered=false;
function cutPlanCancelHold(){if(cutPlanHoldTimer){clearTimeout(cutPlanHoldTimer);cutPlanHoldTimer=null;}cutPlanHoldStart=null;}
$('sheetPreviewCanvas').addEventListener('pointerdown',e=>{if(e.button!==0)return;cutPlanHoldTriggered=false;cutPlanHoldStart={x:e.clientX,y:e.clientY};const hit=cutPlanPartAtPointerEvent(e);if(!hit)return;cutPlanHoldTimer=setTimeout(()=>{cutPlanHoldTimer=null;cutPlanHoldTriggered=true;sheetPreviewSelectedPart=hit;sheetPreviewIsolated=false;sheetPreviewDraw();cutPlanOpenTransferMenu(hit);},560)});
$('sheetPreviewCanvas').addEventListener('pointermove',e=>{const p=sheetPreviewPointerToWorld(e);$('sheetPreviewPosition').textContent=p?`X ${nice(p.x)} · Y ${nice(p.y)} mm`:'X — · Y — mm';if(cutPlanHoldStart&&Math.hypot(e.clientX-cutPlanHoldStart.x,e.clientY-cutPlanHoldStart.y)>9)cutPlanCancelHold()});
$('sheetPreviewCanvas').addEventListener('pointerleave',()=>{$('sheetPreviewPosition').textContent='X — · Y — mm';cutPlanCancelHold()});
$('sheetPreviewCanvas').addEventListener('pointercancel',cutPlanCancelHold);
$('sheetPreviewCanvas').addEventListener('contextmenu',e=>e.preventDefault());
$('sheetPreviewCanvas').addEventListener('pointerup',e=>{const held=cutPlanHoldTriggered;cutPlanCancelHold();cutPlanHoldTriggered=false;if(held)return;const hit=cutPlanPartAtPointerEvent(e);sheetPreviewSelectedPart=hit;sheetPreviewIsolated=false;sheetPreviewDraw()});
$('sheetPreviewCanvas').addEventListener('dblclick',e=>{const hit=cutPlanPartAtPointerEvent(e);if(hit){sheetPreviewSelectedPart=hit;sheetPreviewIsolated=true;sheetPreviewDraw()}});


  return {
    buildAspireSheetEntities, previewEntityFace, previewEdgeHoleMarkers, sheetPreviewStats, sheetPreviewPlacedOutline, sheetPreviewPartBounds, pointInPreviewPart, polygonAreaMm2, cutPlanPartAreaMm2, sheetPreviewViewport, sheetPreviewPointerToWorld,
    normalizedSheetPrefs, getSheetPrefs, setSheetPrefs, sheetPrefsFromUi, applySheetPrefsToUi, sheetPrefsForPartGroup, partOrientations, csvLine, buildMingliZawFiles, buildPanelSawCutsCsv, buildPartsCsv, buildLabelsBaseCsv, buildMachiningCsv, buildSheetsCsv, buildAspireLayerDepthsCsv, buildAspireOperationFiles, buildAspireOperationIndexCsv, groupPartArrayForAspire, allProjectFurnitureParts, allProjectProductionPartsByKind, groupAspireProjectParts, zipStore, isExportPickerCancel, exportLeafName, pickExportTarget, downloadExportFallback, writeExportTarget, exportProjectAspireZip, exportSelectedAspireDxf,
    cutPlanPartSignature, cutPlanAssignCodes, cutPlanPackOpen, renderPartsList, openPartsListDialog, prepareSheetPreviewGroups, refreshSheetPreviewSelect, openSheetPreview, closeSheetPreview, sheetPreviewDraw, updateSheetCutModeUi, exportPanelSawSequenceCsv, exportPanelSawMingliZaw, printCutPlan
  };
}
