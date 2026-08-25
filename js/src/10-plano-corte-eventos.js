// ============================================================================
// 1.100.88 · PLANO DE CORTE OTIMIZADO
// Mantém a exportação Aspire existente separada. Este bloco cuida somente
// do cálculo e da visualização do plano de corte na interface.
// ============================================================================
const CUT_PLAN_PREFS_KEY='designlabCutPlanV42';
let cutPlanLastGroups=[];

function cutPlanReadExtraPrefs(){
  try{return JSON.parse(localStorage.getItem(CUT_PLAN_PREFS_KEY)||'{}')||{};}catch(_){return {}}
}
function cutPlanSaveExtraPrefs(){
  const p={
    optimization:$('sheetOptimization')?.value||'medium',
    direction:$('sheetDirection')?.value||'auto',
    keepLength:Math.max(0,Number($('sheetKeepLength')?.value)||0),
    keepWidth:Math.max(0,Number($('sheetKeepWidth')?.value)||0)
  };
  localStorage.setItem(CUT_PLAN_PREFS_KEY,JSON.stringify(p));return p;
}
function applyCutPlanExtraPrefs(){
  const p=cutPlanReadExtraPrefs();
  if($('sheetOptimization'))$('sheetOptimization').value=p.optimization==='advanced'?'advanced':'medium';
  if($('sheetDirection'))$('sheetDirection').value=['none','length','width'].includes(p.direction)?p.direction:'auto';
  if($('sheetKeepLength'))$('sheetKeepLength').value=Number.isFinite(Number(p.keepLength))?Number(p.keepLength):100;
  if($('sheetKeepWidth'))$('sheetKeepWidth').value=Number.isFinite(Number(p.keepWidth))?Number(p.keepWidth):100;
}
function cutPlanCfgFromUi(){
  const base=sheetPrefsFromUi(),x=cutPlanSaveExtraPrefs();
  return {...base,optimization:x.optimization,direction:x.direction,keepLength:x.keepLength,keepWidth:x.keepWidth};
}
function cutPlanModeLabel(cfg){
  return cfg.cutMode==='panel'?'Seccionadora · cortes retos':cfg.cutMode==='cnc'?'CNC / Router · encaixe livre':'Otimizado · cortes guilhotina';
}
function updateSheetCutModeUi(){
  const mode=$('sheetCutMode')?.value||'open',help=$('sheetCutModeHelp');
  document.querySelectorAll('.oclOnly').forEach(el=>el.style.display=mode==='open'?'block':'none');
  if(!help)return;
  if(mode==='panel'){
    help.className='sheetModeHelp panel';
    help.innerHTML='<strong>Seccionadora:</strong> prioriza cortes horizontais/verticais em guilhotina. É uma alternativa simples para execução manual; a exportação Aspire continua no fluxo existente.';
  }else if(mode==='cnc'){
    help.className='sheetModeHelp cnc';
    help.innerHTML='<strong>CNC / Router:</strong> usa encaixe livre para aproveitar área. Não força sequência guilhotina no plano visual.';
  }else{
    help.className='sheetModeHelp open';
    help.innerHTML='<strong>Otimizado:</strong> usa cortes guilhotina, considera refilo e espessura de corte, testa orientações e tenta concentrar a sobra em retalhos maiores e reaproveitáveis.';
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
function cutPlanOrder(parts,mode){
  const a=[...parts];
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
  let fragmentation=0,cutLength=0,cutCount=0,largestReusable=0;
  for(const s of sheets){
    fragmentation+=(s.freeRects||[]).length;
    cutLength+=(s.cuts||[]).reduce((n,c)=>n+c.length,0);cutCount+=(s.cuts||[]).length;
    for(const r of s.freeRects||[])if(r.w>=cfg.keepLength&&r.h>=cfg.keepWidth)largestReusable=Math.max(largestReusable,r.w*r.h);
  }
  return [sheets.length,fragmentation,cutLength,cutCount,-largestReusable];
}
function cutPlanPackOpen(parts,cfg){
  const dirs=cfg.direction==='auto'?['none','length','width']:[cfg.direction||'none'];
  const modes=cfg.optimization==='advanced'?['area','max','width','height','perimeter']:['area','max'];
  let best=null,lastError=null;
  for(const dir of dirs)for(const mode of modes){
    try{
      const sheets=cutPlanPackAttempt(parts,cfg,mode,dir),score=cutPlanAttemptScore(sheets,cfg);
      if(!best||compareSheetScores(score,best.score)<0)best={sheets,score};
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
function cutPlanBuildGroups(cfg=cutPlanCfgFromUi()){
  const raw=allProjectFurnitureParts();if(!raw.length)throw new Error('O projeto ainda não possui peças para o plano de corte.');
  const byMaterial=new Map();
  for(const p of raw){const mat=normalizedLayer(p.material||'MDF')||'MDF',key=`${mat}_${layerNum(p.thickness)}mm`;if(!byMaterial.has(key))byMaterial.set(key,[]);byMaterial.get(key).push(p);}
  const groups=[];
  for(const [key,baseParts] of byMaterial.entries()){
    const parts=cutPlanAssignCodes(baseParts),groupCfg=sheetPrefsForPartGroup(cfg,baseParts);let sheets;
    if(groupCfg.cutMode==='panel')sheets=packPartsIntoSheetsPanelSaw(parts,groupCfg);
    else if(groupCfg.cutMode==='cnc')sheets=packPartsIntoSheetsCnc(parts,groupCfg);
    else sheets=cutPlanPackOpen(parts,groupCfg);
    sheets.forEach((s,i)=>{
      const stats=cutPlanSheetStats(s,groupCfg),first=s.placements[0];
      const preview=buildAspireSheetEntities(s.placements,groupCfg,s.cuts||[]);
      groups.push({
        key,displayName:`${first?.materialCode||first?.material||'Material'} · ${nice(first?.thickness||0)} mm`,
        sheetNo:i+1,totalSheets:sheets.length,parts:s.placements,panelCuts:s.cuts||[],freeRects:s.freeRects||[],stats,cfg:{...groupCfg},planMode:groupCfg.cutMode,
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
function renderPartsList(){
  const cfg=cutPlanCfgFromUi();setSheetPrefs(cfg);updateSheetCutModeUi();
  const list=$('partsList'),summary=$('partsSummary');list.innerHTML='';
  try{
    const groups=cutPlanBuildGroups(cfg);cutPlanLastGroups=groups;
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
      const head=document.createElement('div');head.className='partsGroupHead';const firstCfg=data.sheets[0]?.g?.cfg||cfg;head.innerHTML=`<span>${escapeHtml(data.name)}</span><span>${data.sheets.length} chapa(s) · ${nice(firstCfg.width)}×${nice(firstCfg.height)} · ${nice(eff)}%</span>`;box.appendChild(head);
      for(const p of cutPlanGroupRows(data.parts)){
        const row=document.createElement('div');row.className='partRow';
        const left=document.createElement('div');const nm=document.createElement('div');nm.className='partRowName';nm.innerHTML=`<span class="cutPlanCode">${escapeHtml(p.cutCode||'?')}</span>${escapeHtml(p.name||'Peça')}`;
        const meta=document.createElement('div');meta.className='partRowMeta';const origins=[...p.spaceNames];meta.textContent=`${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm${p.materialGrain?` · veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} ${normalizePieceGrainRotation(p.materialGrainRotation)}°`:''}${p.edgeBandSummary?' · FITA: '+p.edgeBandSummary:''}${actualMachiningCount(p)?' · USINAGENS: '+actualMachiningCount(p):''}${origins.length?' · '+origins.join(', '):''}`;left.append(nm,meta);
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
    $('partsListInfo').textContent=cfg.cutMode==='open'?'Plano otimizado: cortes guilhotina, refilo, espessura de corte, nível de otimização, direção preferida e sobras úteis.':'Plano calculado com a estratégia selecionada. O Aspire continua com o exportador existente da versão anterior.';
  }catch(err){cutPlanLastGroups=[];summary.textContent=err.message||'Não foi possível calcular as chapas';$('partsListInfo').textContent='Lista geral de peças de todos os espaços do projeto.';}
}
function openPartsListDialog(){
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
  const alongFaceW=grainRot===90;
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
function cutPlanRenderSide(){
  const g=sheetPreviewGroups[sheetPreviewIndex];if(!g)return;const cfg=g.cfg,st=g.stats,status=$('sheetPreviewStatus');
  const keep=st.reusable.slice(0,4).map(r=>`${nice(r.w)} × ${nice(r.h)}`).join(' · ');
  status.className='sheetPreviewStatus ok';
  const mach=sheetPreviewStats(g),machTotal=mach.holesA+mach.holesB+mach.edge+mach.groovesA+mach.groovesB+mach.slots;
  status.innerHTML=`<strong>${escapeHtml(g.displayName)}</strong><br>Chapa ${g.sheetNo}/${g.totalSheets} · ${g.parts.length} peça(s)<br>Aproveitamento <b>${nice(st.efficiency)}%</b> · corte estimado <b>${nice(st.cutLength/1000)} m</b><br>Usinagens: <b>${machTotal}</b> · furos A ${mach.holesA} · B ${mach.holesB}${mach.edge?` · borda ${mach.edge}`:''} · rasgos ${mach.groovesA+mach.groovesB}<br>Chapa ${nice(cfg.width)} × ${nice(cfg.height)} · refilo ${nice(cfg.margin)} · corte ${nice(cfg.gap)} mm${keep?`<br>Sobras úteis: ${escapeHtml(keep)}`:'<br>Sem sobra útil acima do mínimo configurado.'}`;
  $('sheetPreviewModeText').textContent=g.planMode==='open'?'Otimizado · cortes guilhotina e sobras concentradas.':g.planMode==='panel'?'Seccionadora · cortes retos em guilhotina.':'CNC / Router · encaixe livre por área.';
  const p=sheetPreviewSelectedPart,card=$('sheetPreviewPartCard');
  if(!p||!g.parts.includes(p)){
    sheetPreviewSelectedPart=null;sheetPreviewIsolated=false;card.innerHTML='<h4>Nenhuma peça selecionada</h4><div class="meta">Toque numa peça para ver código, medida, material e origem.</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary" disabled>Ampliar peça</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button></div>';
  }else{
    const same=g.parts.filter(x=>x.cutCode===p.cutCode).length;
    const ops=cutPlanMachiningSummary(p);
    card.innerHTML=`<h4><span class="cutPlanCode">${escapeHtml(p.cutCode||'?')}</span>${escapeHtml(p.name||'Peça')}</h4><div class="meta">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm · ${escapeHtml(p.materialCode||p.material||'MDF')}<br>${same>1?`${same} peça(s) iguais nesta chapa · `:''}${p.rotated?'girada 90° · ':''}${p.materialGrain?`veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} ${normalizePieceGrainRotation(p.materialGrainRotation)}° · `:''}${escapeHtml(p.spaceName||'')}</div><div class="sheetPreviewPartOps"><div class="sheetPreviewOp">Posição na chapa: X ${nice(p.x)} · Y ${nice(p.y)} mm</div>${p.edgeBandSummary?`<div class="sheetPreviewOp">Fitas: ${escapeHtml(p.edgeBandSummary)}</div>`:''}${ops.length?ops.map(x=>`<div class="sheetPreviewOp">${escapeHtml(x)}</div>`).join(''):'<div class="sheetPreviewOp">Sem usinagens nesta peça.</div>'}</div><div class="sheetPreviewPartActions"><button id="sheetPreviewIsolate" type="button" class="secondary">${sheetPreviewIsolated?'Voltar à chapa':'Ampliar peça'}</button><button id="sheetPreviewFit" type="button" class="secondary">Ver chapa inteira</button>${p.materialGrain?`<button id="sheetPreviewRotateGrain" type="button" class="cutPlanPreviewGrainBtn">↻ Veio ${cutPlanPieceGrainAxis(p,{placed:false}).localSymbol} · Rotacionar 90°</button>`:''}</div>`;
  }
  $('sheetPreviewIsolate').onclick=()=>{if(sheetPreviewSelectedPart){sheetPreviewIsolated=!sheetPreviewIsolated;sheetPreviewDraw()}};
  $('sheetPreviewFit').onclick=()=>{sheetPreviewIsolated=false;sheetPreviewDraw()};
  const grainBtn=$('sheetPreviewRotateGrain');
  if(grainBtn&&sheetPreviewSelectedPart?.object)grainBtn.onclick=()=>cutPlanToggleGrainObjects([sheetPreviewSelectedPart.object],{keepPreview:true,previewObject:sheetPreviewSelectedPart.object});
  $('sheetPreviewSheetInfo').innerHTML=`<strong>${escapeHtml(g.displayName)}</strong> · chapa ${g.sheetNo}/${g.totalSheets}`;
  $('sheetPreviewFaceInfo').textContent=`${nice(st.efficiency)}% · ${nice(st.cutLength/1000)} m de corte`;
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

// ---------- 1.100.88 · impressão técnica do plano de corte em A4 ----------
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
  if($('sheetPreviewEdgeHoles')?.checked)for(const cut of (g.panelCuts||[]))cuts.push(`<line x1="${cut.x1}" y1="${toY(cut.y1)}" x2="${cut.x2}" y2="${toY(cut.y2)}" stroke="#6f7476" stroke-width="10"/>`);
  return `<svg class="planSvg" viewBox="0 0 ${cfg.width} ${cfg.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano da chapa"><rect x="0" y="0" width="${cfg.width}" height="${cfg.height}" fill="#fff" stroke="#202224" stroke-width="9"/><rect x="${cfg.margin}" y="${cfg.margin}" width="${Math.max(0,cfg.width-2*cfg.margin)}" height="${Math.max(0,cfg.height-2*cfg.margin)}" fill="none" stroke="#a6aaac" stroke-width="5" stroke-dasharray="22 15"/>${waste.join('')}${parts.join('')}${mach.join('')}${cuts.join('')}</svg>`;
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
function cutPlanPrintDocument(groups){
  const project=escapeHtml(currentProjectRecord?.name||'DesignLabMoveis'),pages=groups.map((g,i)=>{
    const st=g.stats,mach=sheetPreviewStats(g),machTotal=mach.holesA+mach.holesB+mach.edge+mach.groovesA+mach.groovesB+mach.slots;
    const unique=new Set((g.parts||[]).map(p=>p.cutCode||p.name)).size;
    return `<section class="printCutPage">
      <header class="reportHead"><div><div class="brand">DESIGNLABMÓVEIS</div><h1>${project}</h1><h2>${escapeHtml(g.displayName)}</h2></div><div class="sheetTag"><span>CHAPA</span><b>${g.sheetNo}/${g.totalSheets}</b><small>Página ${i+1} de ${groups.length}</small></div></header>
      <div class="summaryGrid"><div><span>Dimensão da chapa</span><b>${nice(g.cfg.width)} × ${nice(g.cfg.height)} mm</b></div><div><span>Aproveitamento</span><b>${nice(st.efficiency)}%</b></div><div><span>Peças</span><b>${g.parts.length}</b></div><div><span>Tipos</span><b>${unique}</b></div><div><span>Corte estimado</span><b>${nice(st.cutLength/1000)} m</b></div><div><span>Usinagens</span><b>${machTotal}</b></div></div>
      <div class="reportBody"><div class="drawingPanel"><div class="panelTitle">PLANO DA CHAPA</div><div class="drawing">${cutPlanPrintSvg(g)}</div></div><aside class="partsPanel"><div class="panelTitle">PEÇAS DESTA CHAPA</div><table><thead><tr><th>Cód.</th><th>Peça / material</th><th>Qtd.</th><th>Medidas (mm)</th></tr></thead><tbody>${cutPlanPrintPartRows(g)}</tbody></table></aside></div>
      <footer><span>Refilo ${nice(g.cfg.margin)} mm · espessura de corte ${nice(g.cfg.gap)} mm</span><span>DesignLabMoveis 1.100.88</span></footer>
    </section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Plano de corte · ${project}</title><style>
    @page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#17191a;font-family:Arial,Helvetica,sans-serif}.printCutPage{height:198mm;display:flex;flex-direction:column;gap:2.2mm;break-after:page;page-break-after:always;overflow:hidden}.printCutPage:last-child{break-after:auto;page-break-after:auto}.reportHead{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:.55mm solid #222;padding:0 0 2mm}.brand{font-size:2.35mm;font-weight:900;letter-spacing:.16em;color:#5f6669}h1{font-size:5mm;margin:.6mm 0 0;line-height:1.05}h2{font-size:3mm;margin:1mm 0 0;color:#4d5356}.sheetTag{min-width:31mm;border:.35mm solid #27292a;padding:1.4mm 2mm;text-align:center}.sheetTag span{display:block;font-size:2mm;font-weight:900;letter-spacing:.14em;color:#666}.sheetTag b{display:block;font-size:6mm;line-height:1.05}.sheetTag small{font-size:2mm;color:#666}.summaryGrid{display:grid;grid-template-columns:1.45fr repeat(5,1fr);gap:1.2mm}.summaryGrid>div{border:.25mm solid #b9bdbe;padding:1.4mm 1.7mm;background:#f5f5f3;min-width:0}.summaryGrid span{display:block;font-size:1.8mm;text-transform:uppercase;font-weight:800;color:#6a7073;white-space:nowrap}.summaryGrid b{display:block;margin-top:.45mm;font-size:2.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reportBody{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 78mm;gap:2mm}.drawingPanel,.partsPanel{min-height:0;border:.25mm solid #aeb2b3;display:flex;flex-direction:column}.panelTitle{height:6mm;display:flex;align-items:center;padding:0 2mm;border-bottom:.25mm solid #aeb2b3;background:#eeeeeb;font-size:2.15mm;font-weight:900;letter-spacing:.05em}.drawing{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:2mm}.planSvg{width:100%;height:100%;display:block}.partsPanel{overflow:hidden}.partsPanel table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2mm}.partsPanel thead{display:table-header-group}.partsPanel th{padding:1.1mm .9mm;text-align:left;background:#f6f6f4;border-bottom:.25mm solid #bfc2c3;font-size:1.7mm;text-transform:uppercase;color:#555}.partsPanel td{padding:1.15mm .9mm;border-bottom:.2mm solid #dedfdf;vertical-align:middle;line-height:1.15;overflow:hidden}.partsPanel th:nth-child(1),.partsPanel td:nth-child(1){width:10mm}.partsPanel th:nth-child(3),.partsPanel td:nth-child(3){width:10mm;text-align:center}.partsPanel th:nth-child(4),.partsPanel td:nth-child(4){width:28mm;text-align:right}.partsPanel small{display:block;margin-top:.35mm;color:#747a7d;font-size:1.65mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.codeCell{font-size:2.5mm;font-weight:900;text-align:center}.qtyCell{font-weight:900}.dimCell{font-weight:800;white-space:nowrap}.partsPanel tbody tr:nth-child(even){background:#fafaf9}footer{display:flex;justify-content:space-between;border-top:.25mm solid #c4c6c7;padding-top:1.2mm;font-size:2mm;color:#5b6164}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>${pages}</body></html>`;
}
function printCutPlan(){
  try{
    const groups=prepareSheetPreviewGroups();if(!groups.length)throw new Error('Não há chapas para imprimir.');
    const html=cutPlanPrintDocument(groups),w=window.open('','_blank');
    if(!w){downloadText(`${safeFileName(currentProjectRecord?.name||'projeto')}-plano-de-corte.html`,html,'text/html;charset=utf-8');toast('O navegador bloqueou a impressão · salvei o plano de corte em HTML');return;}
    w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>{try{w.print()}catch(_){}},400);
  }catch(err){toast(err.message||'Não foi possível imprimir o plano de corte');}
}

$('closePartsList').onclick=()=>{$('partsListDialog').style.display='none';};
$('partsListDialog').addEventListener('pointerdown',e=>{if(e.target===$('partsListDialog'))$('partsListDialog').style.display='none';});
['sheetWidth','sheetHeight','sheetMargin','sheetGap','sheetKeepLength','sheetKeepWidth'].forEach(id=>$(id).addEventListener('input',renderPartsList));
$('sheetGrain').addEventListener('change',renderPartsList);
$('sheetGrainDirection').addEventListener('change',renderPartsList);
$('sheetCutMode').addEventListener('change',()=>{updateSheetCutModeUi();renderPartsList();});
$('sheetOptimization').addEventListener('change',renderPartsList);
$('sheetDirection').addEventListener('change',renderPartsList);

$('previewAspireFromPartsBtn').onclick=openSheetPreview;
$('printCutPlanFromPartsBtn').onclick=printCutPlan;
$('sheetPreviewClose').onclick=closeSheetPreview;
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
$('sheetPreviewCanvas').addEventListener('pointermove',e=>{const p=sheetPreviewPointerToWorld(e);$('sheetPreviewPosition').textContent=p?`X ${nice(p.x)} · Y ${nice(p.y)} mm`:'X — · Y — mm'});
$('sheetPreviewCanvas').addEventListener('pointerleave',()=>{$('sheetPreviewPosition').textContent='X — · Y — mm'});
$('sheetPreviewCanvas').addEventListener('pointerup',e=>{const w=sheetPreviewPointerToWorld(e),g=sheetPreviewGroups[sheetPreviewIndex];if(!w||!g)return;const hits=g.parts.filter(p=>pointInPreviewPart(p,w.x,w.y));sheetPreviewSelectedPart=hits.length?hits[hits.length-1]:null;sheetPreviewIsolated=false;sheetPreviewDraw()});
$('sheetPreviewCanvas').addEventListener('dblclick',e=>{const w=sheetPreviewPointerToWorld(e),g=sheetPreviewGroups[sheetPreviewIndex];if(!w||!g)return;const hits=g.parts.filter(p=>pointInPreviewPart(p,w.x,w.y));if(hits.length){sheetPreviewSelectedPart=hits[hits.length-1];sheetPreviewIsolated=true;sheetPreviewDraw()}});

$('exportAspireFromPartsBtn').onclick=()=>{setSheetPrefs(sheetPrefsFromUi());exportProjectAspireZip();};
$('deleteSpaceBtn').onclick=()=>deleteSelectedSpaceRoot();
$('libraryLocalTab').onclick=()=>setLibraryScope('local');
$('libraryGlobalTab').onclick=()=>setLibraryScope('global');
$('libraryBackBtn').onclick=()=>{activeLibraryFolderId=null;renderLibrary();};
$('newLibraryFolderBtn').onclick=newLibraryFolder;
$('renameLibraryFolderBtn').onclick=renameActiveLibraryFolder;
$('deleteLibraryFolderBtn').onclick=deleteActiveLibraryFolder;
$('saveFurnitureLibraryBtn').onclick=saveCurrentFurnitureToLibrary;
$('importLibraryBtn').onclick=()=>{
  const ok=libraryScope==='global'?(adminAllowed()&&!!globalLibraryFolderById(activeLibraryFolderId)):!!libraryFolderById(activeLibraryFolderId);
  if(!ok){toast(libraryScope==='global'?'Abra uma pasta global como administrador':'Abra uma pasta para importar');return;}
  $('libraryImportFile').click();
};
$('libraryImportFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{await importLibraryFile(f);}catch(err){toast('Modelo inválido: '+(err.message||err));}
  e.target.value='';
});

$('visualModeMoreBtn').onclick=()=>setVisualMode(!visualMode,{frame:true});
$('xray3DBtn').onclick=()=>{toggleDockXray();$('morePanel').style.display='none';};
$('cancelPanel').onclick=()=>{$('newPanelDialog').style.display='none';};
$('createPanel').onclick=()=>{
  const w=clampSize(m($('newW').value)),d=clampSize(m($('newD').value)),h=clampSize(m($('newT').value));
  if(![w,d,h].every(Number.isFinite)){toast('Confira as medidas');return;}
  createBox({width:w,depth:d,height:h,name:$('newName').value.trim()||'Peça MDF',kind:'panel',materialType:'MDF',baseColor:COLORS.panel});
  $('newPanelDialog').style.display='none'; toast('Peça MDF criada');
};
document.querySelectorAll('[data-thickness]').forEach(b=>b.onclick=()=>{$('newT').value=b.dataset.thickness;});
$('applyExact').onclick=applyExactPanel;
$('applyPieceRelative').onclick=applyPieceRelativeConfig;
$('resetPieceRelative').onclick=resetPieceRelativeInputs;
$('duplicateBtn').onclick=requestDuplicateSelected;
$('confirmDuplicateBtn').onclick=confirmDuplicateSelected;
$('cancelDuplicateBtn').onclick=cancelDuplicateConfirmation;
$('deletePieceInspectorBtn').onclick=deleteSelectedFromInspector;
$('doorHingeLeftInspectorBtn').onclick=()=>setSelectedDoorHingeSide('left');
$('doorHingeRightInspectorBtn').onclick=()=>setSelectedDoorHingeSide('right');
$('partNameInput').addEventListener('change',()=>{if(selected){selected.userData.name=$('partNameInput').value.trim()||'Peça';updateInspector();commitHistory();}});
$('pieceDoNotProduce').addEventListener('change',e=>setSelectedPieceDoNotProduce(e.target.checked));
$('rotatePieceGrainBtn').onclick=rotateSelectedPieceGrain;

function installMinusButtons(){
  document.querySelectorAll('input[data-minus-button="1"]').forEach(input=>{
    if(input.dataset.minusInstalled==='1')return;
    input.dataset.minusInstalled='1';

    const parent=input.parentNode;
    const wrap=document.createElement('div');
    wrap.className='signedMinusWrap';
    parent.insertBefore(wrap,input);

    const minus=document.createElement('button');
    minus.type='button';
    minus.className='signedMinusBtn';
    minus.textContent='−';
    minus.setAttribute('aria-label','Usar valor negativo');
    minus.title='Valor negativo';

    const plus=document.createElement('button');
    plus.type='button';
    plus.className='signedPlusBtn';
    plus.textContent='+';
    plus.setAttribute('aria-label','Usar valor positivo');
    plus.title='Valor positivo';

    wrap.appendChild(minus);
    wrap.appendChild(input);
    wrap.appendChild(plus);

    const formatSignedValue=(value)=>{
      const step=Number(input.step);
      if(Number.isFinite(step)&&step>0&&step<1){
        const decimals=Math.min(6,Math.max(0,String(step).split('.')[1]?.length||0));
        input.value=String(Number(value.toFixed(decimals)));
      }else{
        input.value=String(value);
      }
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      input.focus({preventScroll:true});
    };

    minus.addEventListener('click',()=>{
      let n=Number(String(input.value??'0').trim().replace(',','.'));
      if(!Number.isFinite(n))n=0;
      formatSignedValue(-Math.abs(n));
    });

    plus.addEventListener('click',()=>{
      let n=Number(String(input.value??'0').trim().replace(',','.'));
      if(!Number.isFinite(n))n=0;
      formatSignedValue(Math.abs(n));
    });
  });
}
installMinusButtons();


// ============================================================================
// v98 · FECHAR MENUS / PAINÉIS AO TOCAR FORA
// ----------------------------------------------------------------------------
// Regra geral:
// - menus flutuantes fecham ao tocar fora, sem bloquear o toque no CAD;
// - o próprio botão que abriu o menu continua podendo fechá-lo normalmente;
// - diálogos de tela cheia fecham ao tocar no fundo escuro, usando o mesmo
//   botão Cancelar/Fechar para preservar qualquer rotina de limpeza existente.
// ============================================================================
function elementIsVisible(el){
  if(!el)return false;
  const cs=getComputedStyle(el);
  return cs.display!=='none' && cs.visibility!=='hidden';
}
function hideFloatingPanel(id){
  const el=$(id);
  if(el&&elementIsVisible(el))el.style.display='none';
}
function closeInspectorOutside(){
  const el=$('inspector');
  if(!el||!elementIsVisible(el))return;
  cancelDuplicateConfirmation?.();
  el.classList.add('compact');
  el.style.display='none';
}
function closeSpaceActionsOutside(){
  const el=$('spaceActions');
  if(el&&elementIsVisible(el))el.style.display='none';
}
function clickBackdropCancel(dialogId,buttonId){
  const dlg=$(dialogId),btn=$(buttonId);
  if(!dlg||!btn)return;
  dlg.addEventListener('pointerdown',e=>{
    if(e.target!==dlg)return;
    e.preventDefault();
    btn.click();
  });
}
function installOutsideMenuClose(){
  // Menus / painéis leves: captura primeiro, fecha e deixa o toque seguir
  // para o CAD normalmente.
  document.addEventListener('pointerdown',e=>{
    const target=e.target;

    // MAIS FERRAMENTAS
    const more=$('morePanel');
    const moreTrigger=target.closest?.('[data-dock-tool="more"]');
    if(more&&more.style.display==='block'&&!more.contains(target)&&!moreTrigger){
      more.style.display='none';
    }

    // MEDIDAS / POSIÇÃO (inspector)
    const inspector=$('inspector');
    const inspectorTrigger=target.closest?.('#showInspectorBtn,[data-dock-tool="inspector"]');
    if(inspector&&elementIsVisible(inspector)&&!inspector.contains(target)&&!inspectorTrigger){
      closeInspectorOutside();
    }

    // MENU DO ESPAÇO/DIVISÃO
    const spaceActions=$('spaceActions');
    // Ferramentas que trabalham diretamente com o espaço não contam como
    // "fora" durante o próprio toque que as aciona.
    const spaceTrigger=target.closest?.(
      '#spaceActions,[data-dock-tool="cutSpace"],[data-dock-tool="createPieces"],'+
      '[data-dock-tool="drawers"],[data-dock-tool="curvedStructure"],'+
      '[data-dock-tool="library"],[data-dock-tool="editSpace"]'
    );
    if(spaceActions&&elementIsVisible(spaceActions)&&!spaceActions.contains(target)&&!spaceTrigger){
      closeSpaceActionsOutside();
    }
  },true);

  // Diálogos que ainda não tinham fechamento pelo fundo escuro.
  clickBackdropCancel('newPanelDialog','cancelPanel');
  clickBackdropCancel('newSpaceDialog','cancelSpace');
  clickBackdropCancel('cutSpaceDialog','cancelCut');
  clickBackdropCancel('libraryDialog','closeLibrary');
  clickBackdropCancel('recoveryDialog','recoveryCancel');
  clickBackdropCancel('productionDialog','closeProductionDialog');
  clickBackdropCancel('labelsDialog','closeLabelsDialog');
  clickBackdropCancel('adminDialog','closeAdminDialog');

  // ESC também segue o comportamento padrão dos menus leves.
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;

    if($('projectCardMenu')?.classList.contains('show')){
      closeProjectCardMenu(); return;
    }
    if($('projectMenuPanel')?.classList.contains('show')){
      $('projectMenuPanel').classList.remove('show'); return;
    }
    if($('toolDock')?.classList.contains('open')){
      setToolDockOpen(false); return;
    }
    if($('morePanel')?.style.display==='block'){
      $('morePanel').style.display='none'; return;
    }
    if(elementIsVisible($('inspector'))){
      closeInspectorOutside(); return;
    }
    if(elementIsVisible($('spaceActions'))){
      closeSpaceActionsOutside(); return;
    }
  });
}


$('closeInspector').onclick=()=>{cancelDuplicateConfirmation();$('inspector').classList.add('compact');$('inspector').style.display='none';};

$('showInspectorBtn').onclick=()=>{if(!selected){toast('Selecione uma peça');return;}openPieceInspector(selected);};
$('openFurnitureSpaceBtn').onclick=()=>{openSpaceFromObject(selected);};
$('openLinkedSpaceBtn').onclick=()=>{openSpaceFromObject(selected);};
$('addHoleBtn').onclick=()=>openMachiningDialog('hole');
$('addGrooveBtn').onclick=()=>openMachiningDialog('groove');
$('addHardwareBtn').onclick=()=>openMachiningDialog('hardware');
$('addShapeBtn').onclick=()=>openShapeDialog();
$('manageMachiningBtn').onclick=()=>openMachiningDialog((selected?.userData?.machining||[])[0]?.type||'hole');
$('materialsToolBtn').onclick=openProductionDialog;
document.querySelectorAll('[data-machining-type]').forEach(b=>b.onclick=()=>{machiningEditId=null;if(b.dataset.machiningType==='shape'){openShapeDialog();return;}setMachiningType(b.dataset.machiningType,true);});
$('machiningFace').addEventListener('change',()=>{setMachiningSurfaceCoordinate();updateMachiningUI();});
$('machiningLengthAxis').addEventListener('change',()=>{if(grooveLengthIsFull()){const a=$('machiningLengthAxis').value;localCoordField(a).value=0;}updateMachiningUI();});
['machiningX','machiningY','machiningZ','machiningDiameter','machiningDepthHole','machiningLength','machiningWidth','machiningDepthGroove','machiningSeriesCount','machiningSeriesStep','machiningRearOffset'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='machiningLength')syncGrooveLengthButton();updateMachiningUI();}));
$('machiningLengthFull').onclick=setGrooveLengthFull;
document.querySelectorAll('[data-signed-axis]').forEach(btn=>{btn.addEventListener('click',()=>toggleMachiningCoordSign(btn.dataset.signedAxis));});
$('machiningThrough').addEventListener('change',updateMachiningUI);
$('machiningSeries').addEventListener('change',()=>{updateHoleSeriesVisibility();updateMachiningUI();});
$('machiningSeriesAxis').addEventListener('change',updateMachiningUI);
$('machiningSeriesDirection').addEventListener('change',updateMachiningUI);
$('machiningPreset32').onclick=applyHole32Preset;
$('machiningPresetSelect').addEventListener('change',()=>{updateMachiningPresetInfo();applySelectedMachiningPreset();});
$('saveMachiningPreset').onclick=saveCurrentMachiningPreset;
$('deleteMachiningPreset').onclick=deleteSelectedMachiningPreset;


$('shapePresetSelect').addEventListener('change',()=>loadSelectedShapePresetToEditor(false));
$('newShapePreset').onclick=newShapePreset;
$('editShapePreset').onclick=editSelectedShapePreset;
$('saveShapePreset').onclick=saveShapePresetLibrary;
$('deleteShapePreset').onclick=deleteShapePresetLibrary;
['shapeFolder','shapeName','shapeRadius','shapeType'].forEach(id=>$(id)?.addEventListener('input',updateShapePreview));
document.querySelectorAll('[data-shape-corner]').forEach(b=>b.addEventListener('click',()=>{const c=b.dataset.shapeCorner;if(shapeSelectedCorners.has(c))shapeSelectedCorners.delete(c);else shapeSelectedCorners.add(c);refreshShapeCornerLabels();updateShapePreview();}));
$('previewShape3D').onclick=previewShape3D;
$('returnShapePreview').onclick=returnShapePreview;
$('applyShape').onclick=applyShapeToPiece;
$('cancelShape').onclick=closeShapeDialog;
$('shapeDialog').addEventListener('pointerdown',e=>{if(e.target===$('shapeDialog'))closeShapeDialog();});

$('hardwarePresetSelect').addEventListener('change',updateHardwarePanel);
$('hardwareLocalTab').onclick=()=>setHardwareScope('local');
$('hardwareGlobalTab').onclick=()=>setHardwareScope('global');
$('createHardwarePreset').onclick=()=>openHardwareBuilder(null);
$('editHardwarePreset').onclick=()=>{const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(p)openHardwareBuilder(p);};
$('publishHardwarePreset').onclick=publishSelectedHardwarePreset;
$('deleteHardwarePreset').onclick=deleteSelectedHardwarePreset;
$('previewHardware3D').onclick=previewHardware3D;
$('applyHardware').onclick=applySelectedHardware;
$('cancelHardware').onclick=()=>{$('machiningDialog').style.display='none';machiningEditId=null;};
['hardwareContactAxis','hardwareContactSide','hardwareBMode','hardwareAAnchor','hardwareBAnchor','hardwareBSeriesAnchor','hardwareBSeriesDirection'].forEach(id=>$(id).addEventListener('change',updateHardwareBuilderUi));
['hardwareContactTolerance','hardwareAOffset','hardwareBOffset','hardwareBEdge','hardwareBSeriesOffset','hardwareBSeriesCount','hardwareBSeriesStep','hardwareSourceDiameter','hardwareSourceDepth','hardwareTargetDiameter','hardwareTargetDepth','hardwareName'].forEach(id=>$(id).addEventListener('input',updateHardwareBuilderUi));
['hardwareSourceEnabled','hardwareTargetEnabled'].forEach(id=>$(id).addEventListener('change',updateHardwareBuilderUi));
function toggleHardwareSigned(id){const f=$(id);let n=parseDecimalInput(f.value);if(!Number.isFinite(n))n=0;f.value=nice(Math.abs(n)<1e-9?0:-n);updateHardwareBuilderUi();f.focus();}
$('hardwareAOffsetSign').onclick=()=>toggleHardwareSigned('hardwareAOffset');
$('hardwareBOffsetSign').onclick=()=>toggleHardwareSigned('hardwareBOffset');
$('hardwareBSeriesOffsetSign').onclick=()=>toggleHardwareSigned('hardwareBSeriesOffset');
$('hardwareExampleShelfPin').onclick=fillHardwareShelfPinExample;
$('hardwareExampleDowel').onclick=fillHardwareDowelExample;
$('cancelHardwareBuilder').onclick=()=>{$('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;};
$('saveHardwareBuilder').onclick=saveHardwareBuilder;
$('hardwareBuilderDialog').addEventListener('pointerdown',e=>{if(e.target===$('hardwareBuilderDialog')){$('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;}});

$('machiningBackGroove').addEventListener('change',()=>{updateBackGrooveVisibility();updateMachiningUI();});
$('machiningPresetBackGroove').onclick=applyBackGroovePreset;
$('saveMachining').onclick=saveMachining;
$('previewMachining3D').onclick=showMachining3DPreview;
$('returnMachiningPreview').onclick=()=>closeMachining3DPreview({reopen:true});
$('cancelMachining').onclick=()=>{clearMachiningDraftPreview();machiningPreviewActive=false;machiningVisualGroup.visible=true;$('machining3DPreviewBar').style.display='none';machiningPreviewOwner=null;$('machiningDialog').style.display='none';machiningEditId=null;};
$('machiningDialog').addEventListener('pointerdown',e=>{if(e.target===$('machiningDialog')){clearMachiningDraftPreview();machiningPreviewActive=false;machiningVisualGroup.visible=true;$('machining3DPreviewBar').style.display='none';machiningPreviewOwner=null;$('machiningDialog').style.display='none';machiningEditId=null;}});
$('rotX').onclick=()=>rotateBox('x'); $('rotY').onclick=()=>rotateBox('y'); $('rotZ').onclick=()=>rotateBox('z');
$('undoBtn').onclick=undo; $('redoBtn').onclick=redo; $('deleteBtn').onclick=deleteSelected;
$('clearGuidesBtn').onclick=()=>{ if(!constructionGuides.length){toast('Não há guias');return;} clearConstructionGuides(); commitHistory(); toast('Guias removidas'); };
$('showHiddenSpacesBtn').onclick=()=>{ showAllHiddenSpaces(); $('morePanel').style.display='none'; };
$('importFurnitureBtn').onclick=()=>{ $('morePanel').style.display='none'; $('furnitureImportFile').click(); };
$('furnitureImportFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const parsed=await designLabFurnitureRecordFromFile(file);
    importFurnitureData(parsed.record);
    if(parsed.stl){
      toast('STL DesignLab importado preservando a geometria curva e as configurações do móvel.');
    }else if(parsed.fallback){
      toast(parsed.record?.dxfFallbackMode==='2d'
        ?'DXF 2D importado como painéis planos; a montagem 3D original não existe no arquivo.'
        :'DXF sem dados internos do DesignLab: importado pela geometria disponível.');
    }else if(!parsed.legacyJson){
      toast('DXF DesignLab importado preservando curvas, peças e configurações.');
    }
  }catch(err){ toast(err.message||'Móvel inválido'); }
  e.target.value='';
});
$('resetCam').onclick=()=>{setFrontWorldView();$('morePanel').style.display='none';toast('Vista 3D');};
$('viewModeBadge').onclick=()=>returnTo3D({restore:true,notify:true});
$('saveBtn').onclick=()=>saveCurrentProject();
$('loadBtn').onclick=()=>showProjectHome();
$('clearBtn').onclick=()=>{if(!objects.length && !constructionGuides.length && !spaceRoots.length)return; clearScene();commitHistory();toast('Projeto limpo');};
$('exportBtn').onclick=()=>exportCurrentProjectFile();
$('importBtn').onclick=()=>$('projectFileInput').click();
$('importFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{ const data=JSON.parse(await file.text()); const state=Array.isArray(data)?data:data; if(!Array.isArray(state) && !Array.isArray(state?.objects))throw new Error(); applyState(state);commitHistory();toast('Projeto importado'); }
  catch{toast('JSON inválido');} e.target.value='';
});


// ---------- v93 · eventos do gerenciador de projetos ----------
$('homeNewProject').onclick=$('heroNewProject').onclick=$('menuNewProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); openProjectMetaDialog('new'); };
$('homeOpenFile').onclick=$('heroOpenFile').onclick=$('menuOpenProjectFile').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); $('projectFileInput').click(); };
$('legacyImportAllBtn').onclick=claimAllLegacyProjects;
$('legacyProjectCards').addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-legacy-import]');
  if(!btn)return;
  claimLegacyProject(btn.dataset.legacyImport).catch(err=>toast(err.message||'Não foi possível importar'));
});
$('homeSaveProject').onclick=$('menuSaveProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); saveCurrentProject(); };
$('homeSaveAsProject').onclick=$('menuSaveAsProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); if(currentProjectId)openProjectMetaDialog('saveas'); };
$('homeSettings').onclick=$('menuAppSettings').onclick=()=>openAppSettings();
$('appSettingsClose').onclick=closeAppSettings;
$('appSettingsDialog').addEventListener('pointerdown',e=>{if(e.target===$('appSettingsDialog'))closeAppSettings();});
document.querySelectorAll('[data-cad-bg]').forEach(b=>b.addEventListener('click',()=>{
  applyCadBackground(b.dataset.cadBg,{persist:true,notify:true});
}));
$('cadGridVisibleSetting').addEventListener('change',e=>{
  applyCadGridVisibility(e.target.checked,{persist:true,notify:true});
});
$('cadXrayVisibleSetting').addEventListener('change',e=>{
  applyXray3D(e.target.checked,{persist:true,notify:true});
});
$('menuOpenProjects').onclick=$('menuProjectHome').onclick=()=>showProjectHome();
$('menuRenameProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); if(currentProjectId)openProjectMetaDialog('rename',currentProjectRecord); };
$('menuDuplicateProject').onclick=async()=>{ $('projectMenuPanel').classList.remove('show'); if(currentProjectId)await duplicateProjectById(currentProjectId); };
$('menuExportProjectFile').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); exportCurrentProjectFile(); };
$('projectMenuBtn').onclick=e=>{e.stopPropagation();$('projectMenuPanel').classList.toggle('show');};
$('presentationBack').onclick=()=>showProjectHome();
$('presentationEdit').onclick=enterProjectEditor;
$('projectMetaCancel').onclick=closeProjectMetaDialog;
$('projectMetaConfirm').onclick=async()=>{
  try{
    const meta=readProjectMeta();
    if(projectMetaMode==='new')await createNewProject(meta);
    else if(projectMetaMode==='saveas')await saveAsCurrentProject(meta);
    else await renameCurrentProject(meta,currentProjectRecord);
  }catch(err){toast(err.message||'Não foi possível salvar os dados do projeto');}
};
$('projectMetaDialog').addEventListener('pointerdown',e=>{if(e.target===$('projectMetaDialog'))closeProjectMetaDialog();});
$('recoveryRestore').onclick=recoverPendingProject;
$('recoveryDiscard').onclick=discardPendingRecovery;
$('recoveryCancel').onclick=()=>{$('recoveryDialog').classList.remove('show');pendingRecovery=null;};
$('cardMenuRename').onclick=async()=>{const rec=await projectDbGet(projectCardMenuId);closeProjectCardMenu();if(rec)openProjectMetaDialog('rename',rec);};
$('cardMenuDuplicate').onclick=async()=>{const id=projectCardMenuId;closeProjectCardMenu();if(id)await duplicateProjectById(id);};
$('cardMenuExport').onclick=async()=>{const id=projectCardMenuId;closeProjectCardMenu();const rec=await projectDbGet(id);if(rec)await exportProjectRecordFile(rec);};
$('cardMenuDelete').onclick=async()=>{const id=projectCardMenuId;if(id)await deleteProjectById(id);};
$('projectFileInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{await importProjectFile(file);}catch(err){toast(err.message||'Arquivo de projeto inválido');}
  e.target.value='';
});
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('#projectMenuPanel')&&!e.target.closest('#projectMenuBtn'))$('projectMenuPanel').classList.remove('show');
  if(!e.target.closest('#projectCardMenu')&&!e.target.closest('[data-project-action="menu"]'))closeProjectCardMenu();
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('appSettingsDialog')?.classList.contains('show')){
    closeAppSettings();
    return;
  }
  const mod=e.ctrlKey||e.metaKey;if(!mod)return;
  const key=e.key.toLowerCase();
  if(key==='s'){
    e.preventDefault();
    if(e.shiftKey){if(currentProjectId)openProjectMetaDialog('saveas');}
    else saveCurrentProject();
  }else if(key==='o'){
    e.preventDefault();$('projectFileInput').click();
  }else if(key==='n'){
    e.preventDefault();openProjectMetaDialog('new');
  }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){projectAutosaveNow();if(currentIdentityUser&&cloudAccountState.ok)saveCloudPreferences({silent:true});}});
window.addEventListener('pagehide',()=>{projectAutosaveNow();});


$('authLoginBtn').onclick=()=>showAuthInlineForm('login');
$('authSignupBtn').onclick=()=>showAuthInlineForm('signup');
$('authForgotBtn').onclick=()=>showAuthInlineForm('forgot');
document.querySelectorAll('[data-auth-back]').forEach(b=>b.onclick=()=>showAuthInlineForm('main'));
$('authLoginForm').addEventListener('submit',authSubmitLogin);
$('authSignupForm').addEventListener('submit',authSubmitSignup);
$('authForgotForm').addEventListener('submit',authSubmitForgot);
$('authRetryBtn').onclick=async()=>{
  setAuthStatus('Verificando sessão…','');
  if(identityClient){
    const user=identityClient.currentUser?.();
    if(user){
      unlockOnlineApp(user,{message:'Sessão encontrada.'});
      setTimeout(()=>syncCloudAccount({silent:false}),100);
    }else lockOnlineApp('Nenhuma sessão ativa. Entre ou crie uma conta.');
  }else{
    await initOnlineIdentity();
  }
};
$('authLocalBtn').onclick=localAuthContinue;
$('homeLogoutBtn').onclick=logoutOnlineIdentity;
$('homeCheckUpdate').onclick=()=>checkDesignLabUpdate({manual:true,force:true});
$('menuCheckUpdate').onclick=()=>checkDesignLabUpdate({manual:true,force:true});
$('settingsCheckUpdate').onclick=()=>checkDesignLabUpdate({manual:true,force:true});
$('updateLaterBtn').onclick=closeUpdateDialog;
$('updateNowBtn').onclick=applyDesignLabUpdate;
$('updateDialog').addEventListener('pointerdown',e=>{if(e.target===$('updateDialog'))closeUpdateDialog();});

$('homeNavStart').onclick=()=>scrollProjectHomeTo('projectHome');
$('homeNavProjects').onclick=()=>scrollProjectHomeTo('homeRecentSection');
$('homeNavModeling').onclick=openHomeModeling;
$('homeNavMaterials').onclick=openHomeMaterials;
$('homeNavAccount').onclick=()=>scrollProjectHomeTo('projectWelcomeCard');

$('homeModelsSection').addEventListener('click',e=>{
  if(!e.target.closest?.('.homeModelCard'))return;
  toast('A biblioteca de modelos será a próxima etapa do layout');
});

$('authBannedLogout').onclick=logoutOnlineIdentity;
$('homeAdminPanel').onclick=openAdminPanel;
$('homeAdminShortcut').onclick=openAdminPanel;
$('menuAdminPanel').onclick=openAdminPanel;
$('closeAdminDialog').onclick=closeAdminPanel;
$('adminDialog').addEventListener('pointerdown',e=>{if(e.target===$('adminDialog'))closeAdminPanel();});
$('adminUsersTabBtn').onclick=async()=>{adminSetTab('users');await refreshAdminPanel();};
$('adminPaymentsTabBtn').onclick=async()=>{adminSetTab('payments');await refreshAdminPanel();};
$('adminSettingsTabBtn').onclick=async()=>{adminSetTab('settings');await refreshAdminPanel();};
$('adminSaveSettingsBtn').onclick=saveAdminSettings;
$('adminRefreshBtn').onclick=refreshAdminPanel;
$('adminUserSearchBtn').onclick=async()=>{adminPanelState.search=$('adminUserSearch').value.trim();await loadAdminUsers();};
$('adminUserSearch').addEventListener('keydown',async e=>{if(e.key==='Enter'){e.preventDefault();adminPanelState.search=$('adminUserSearch').value.trim();await loadAdminUsers();}});
$('adminPaymentFilter').addEventListener('change',async e=>{adminPanelState.paymentStatus=e.target.value;await loadAdminPayments();});
$('adminPaymentRefreshBtn').onclick=async()=>{await Promise.all([loadAdminStats(),loadAdminPayments()]);};
$('adminUsersList').addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-admin-action]');if(!btn)return;
  const card=btn.closest('[data-admin-user]');if(!card)return;
  const id=card.dataset.adminUser,action=btn.dataset.adminAction;
  if(action==='premium7')adminPremium(id,7);
  else if(action==='premium30')adminPremium(id,30);
  else if(action==='premium90')adminPremium(id,90);
  else if(action==='revoke')adminRevokePremium(id);
  else if(action==='ban')adminBanUser(id,true);
  else if(action==='unban')adminBanUser(id,false);
});
$('adminPaymentsList').addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-admin-payment-action]');if(!btn)return;
  const card=btn.closest('[data-admin-payment]');if(!card)return;
  adminPaymentAction(card.dataset.adminPayment,btn.dataset.adminPaymentAction);
});

installOutsideMenuClose();

window.addEventListener('resize',()=>{if($('sheetPreviewDialog')?.classList.contains('show'))requestAnimationFrame(sheetPreviewDraw);});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);perspectiveCamera.aspect=innerWidth/Math.max(1,innerHeight);perspectiveCamera.updateProjectionMatrix();if(viewMode2D){const root=activeSpaceRoot();viewSpace(root,current2DView||'front');}else camera.updateProjectionMatrix();});

initDesignLabServiceWorker().catch(()=>{});
setTimeout(()=>checkDesignLabUpdate({force:true}),1200);
window.addEventListener('online',()=>{updateCacheStatusUI();checkDesignLabUpdate({force:true}).catch(()=>{});if(currentIdentityUser&&cloudAccountState.ok)syncCloudPreferences({silent:true,allowReload:false}).then(r=>r?.ok?saveCloudPreferences({silent:true}):null);});
window.addEventListener('offline',updateCacheStatusUI);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')checkDesignLabUpdate().catch(()=>{});
});
window.addEventListener('pageshow',()=>checkDesignLabUpdate().catch(()=>{}));

// Início limpo e frontal. O CAD inicializa normalmente por baixo da tela de projetos.
setFrontWorldView();
history=[stateString()]; historyIndex=0;
initToolDock();
initSpaceActionsDrag();
initPieceInspectorFloating();
initProjectHub().catch(err=>{console.error(err);toast('Não foi possível abrir o gerenciador de projetos');});
initOnlineIdentity().catch(err=>{console.error(err);setAuthStatus('Falha ao iniciar a autenticação.','error');});

function animate(){
  requestAnimationFrame(animate); controls.update(); if(dragMode) updateLiveLabel(); updateMachiningVisualTransforms(); renderer.render(scene,camera);
}
updateXray3DButton();
setPieceVisualEdgesVisible(true);
animate();
