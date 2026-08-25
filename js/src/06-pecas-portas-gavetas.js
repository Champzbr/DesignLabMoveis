// ---------- Criar peças dentro da divisão ----------
let pieceCreateType='left';
let pieceTypeLastClickButton=null;
let pieceTypeLastClickAt=0;
let pieceTypeQuickCreateBusy=false;
const PIECE_TYPE_DOUBLE_CLICK_MS=520;
function selectPieceCreateTypeButton(button){
  if(!button)return;
  pieceCreateType=button.dataset.pieceType||'left';
  document.querySelectorAll('[data-piece-type]').forEach(x=>x.classList.toggle('active',x===button));
  updateCreatePiecesUI();
}
function quickCreatePieceFromTypeButton(button){
  if(pieceTypeQuickCreateBusy||!button)return;
  pieceTypeQuickCreateBusy=true;
  try{
    selectPieceCreateTypeButton(button);
    if(createPiecesInSelectedCell()){
      savePieceThicknessPreference({silent:true});
      $('createPiecesDialog').style.display='none';
    }
  } finally {
    // trava somente durante a chamada atual; o diálogo já fecha quando deu certo.
    pieceTypeQuickCreateBusy=false;
    pieceTypeLastClickButton=null;
    pieceTypeLastClickAt=0;
  }
}
function pieceTypeName(type){
  return ({left:'Lateral esquerda',right:'Lateral direita',division:'Divisão vertical',base:'Base',top:'Chapéu',shelf:'Prateleira',shelves:'Prateleiras',back:'Fundo',front:'Frente',doors:'Portas'})[type]||'Peça';
}
function pieceDivisionLayoutMm(widthM,thicknessM){
  const total=mm(widthM),thickness=mm(thicknessM);
  const free=total-thickness;
  if(!(free>0))return {ok:false,total,thickness,gap1:0,gap2:0,message:'A espessura da divisão ocupa toda a largura.'};

  let measure=Number($('pieceDivisionMeasure')?.value);
  if(!Number.isFinite(measure)||measure<0)measure=0;
  const side=$('pieceDivisionSide')?.value==='gap2'?'gap2':'gap1';

  let gap1,gap2,centered=measure<=.000001;
  if(centered){
    gap1=free/2;
    gap2=free-gap1;
  }else if(side==='gap2'){
    gap2=measure;
    gap1=free-gap2;
  }else{
    gap1=measure;
    gap2=free-gap1;
  }

  const minMm=mm(MIN_SIZE);
  const ok=gap1>=minMm-.001&&gap2>=minMm-.001;
  return {
    ok,total,thickness,free,gap1,gap2,measure,side,centered,minMm,
    message:ok?'':`Cada vão precisa ter pelo menos ${nice(minMm)} mm.`
  };
}
// ---------- 1.100.94 · Configuração salva de portas ----------
const DOOR_CREATE_CONFIG_KEY='designLabDoorCreateConfigV1';
function captureDoorCreateConfig(){
  return {
    version:1,
    count:String($('doorCount')?.value||'2'),
    gapMiddle:String($('doorGapMiddle')?.value||'2'),
    gapLeft:String($('doorGapLeft')?.value||'2'),
    gapRight:String($('doorGapRight')?.value||'2'),
    gapTop:String($('doorGapTop')?.value||'2'),
    gapBottom:String($('doorGapBottom')?.value||'2'),
    handleType:String($('doorHandleType')?.value||'none'),
    handleSize:String($('doorHandleSize')?.value||'20'),
    cavaPosition:String($('doorCavaPosition')?.value||'top'),
    createHingeHoles:!!$('doorCreateHingeHoles')?.checked,
    hingeCount:String($('doorHingeCount')?.value||'auto'),
    hingeSide:String($('doorHingeSide')?.value||'auto'),
    cupDiameter:String($('doorHingeCupDiameter')?.value||'35'),
    cupDepth:String($('doorHingeCupDepth')?.value||'12'),
    cupEdge:String($('doorHingeCupEdge')?.value||'22.5'),
    hingeEdgeY:String($('doorHingeEdgeY')?.value||'100'),
    createSideHoles:!!$('doorCreateSideHoles')?.checked,
    mountFrontOffset:String($('doorMountFrontOffset')?.value||'37'),
    mountSpacing:String($('doorMountSpacing')?.value||'32'),
    mountDiameter:String($('doorMountDiameter')?.value||'5'),
    mountDepth:String($('doorMountDepth')?.value||'12'),
    savedAt:new Date().toISOString()
  };
}
function readDoorCreateConfig(){
  try{
    const cfg=JSON.parse(localStorage.getItem(DOOR_CREATE_CONFIG_KEY)||'null');
    return cfg&&typeof cfg==='object'?cfg:null;
  }catch(_){return null;}
}
function applyDoorCreateConfig(cfg=readDoorCreateConfig()){
  if(!cfg)return false;
  const set=(id,value)=>{const el=$(id);if(el&&value!==undefined&&value!==null)el.value=String(value);};
  set('doorCount',cfg.count);
  set('doorGapMiddle',cfg.gapMiddle);
  set('doorGapLeft',cfg.gapLeft);
  set('doorGapRight',cfg.gapRight);
  set('doorGapTop',cfg.gapTop);
  set('doorGapBottom',cfg.gapBottom);
  set('doorHandleType',cfg.handleType);
  set('doorHandleSize',cfg.handleSize);
  set('doorCavaPosition',cfg.cavaPosition);
  if($('doorCreateHingeHoles')&&typeof cfg.createHingeHoles==='boolean')$('doorCreateHingeHoles').checked=cfg.createHingeHoles;
  set('doorHingeCount',cfg.hingeCount);
  set('doorHingeSide',cfg.hingeSide);
  set('doorHingeCupDiameter',cfg.cupDiameter);
  set('doorHingeCupDepth',cfg.cupDepth);
  set('doorHingeCupEdge',cfg.cupEdge);
  set('doorHingeEdgeY',cfg.hingeEdgeY);
  if($('doorCreateSideHoles')&&typeof cfg.createSideHoles==='boolean')$('doorCreateSideHoles').checked=cfg.createSideHoles;
  set('doorMountFrontOffset',cfg.mountFrontOffset);
  set('doorMountSpacing',cfg.mountSpacing);
  set('doorMountDiameter',cfg.mountDiameter);
  set('doorMountDepth',cfg.mountDepth);
  updateDoorCreationVisibility();
  return true;
}
function saveDoorCreateConfig(){
  if(pieceCreateType!=='doors'){toast('Selecione Portas para salvar esta configuração');return false;}
  try{
    const cfg=captureDoorCreateConfig();
    localStorage.setItem(DOOR_CREATE_CONFIG_KEY,JSON.stringify(cfg));
    savePieceThicknessPreference({silent:true});
    toast('Configuração de portas salva · será carregada nas próximas criações');
    return true;
  }catch(err){
    console.error('Salvar configuração de portas:',err);
    toast('Não foi possível salvar a configuração de portas');
    return false;
  }
}

// ---------- 1.100.94 · Portas paramétricas + dobradiças ----------
function doorFieldNumber(id,fallback=0,min=-Infinity,max=Infinity){
  const n=parseDecimalInput($(id)?.value);
  const v=Number.isFinite(n)?n:fallback;
  return Math.max(min,Math.min(max,v));
}
function doorAutoHingeCount(heightMm){
  const h=Math.max(0,Number(heightMm)||0);
  if(h<=900)return 2;
  if(h<=1500)return 3;
  if(h<=2100)return 4;
  return 5;
}
function doorHingeCountResolved(heightMm){
  const raw=String($('doorHingeCount')?.value||'auto');
  return raw==='auto'?doorAutoHingeCount(heightMm):Math.max(1,Math.min(6,Math.round(Number(raw)||2)));
}
function doorCreationConfig(size){
  const count=Math.max(1,Math.min(12,Math.round(doorFieldNumber('doorCount',2,1,12))));
  const gl=doorFieldNumber('doorGapLeft',2,0),gr=doorFieldNumber('doorGapRight',2,0),gt=doorFieldNumber('doorGapTop',2,0),gb=doorFieldNumber('doorGapBottom',2,0),gm=doorFieldNumber('doorGapMiddle',2,0);
  const handleType=String($('doorHandleType')?.value||'none');
  const handleSize=handleType==='none'?0:doorFieldNumber('doorHandleSize',20,0,1000);
  const cavaPosition=String($('doorCavaPosition')?.value||'top')==='bottom'?'bottom':'top';
  const cavaDiscount=handleType==='cava'?handleSize:0;
  const totalW=mm(size.width),totalH=mm(size.height);
  const doorW=(totalW-gl-gr-gm*Math.max(0,count-1))/count;
  const doorH=totalH-gt-gb-cavaDiscount;
  const bottomLift=handleType==='cava'&&cavaPosition==='bottom'?handleSize:0;
  const hingeEnabled=!!$('doorCreateHingeHoles')?.checked;
  const mountEnabled=hingeEnabled&&!!$('doorCreateSideHoles')?.checked;
  const hingeCount=hingeEnabled?doorHingeCountResolved(doorH):0;
  return {
    count,gl,gr,gt,gb,gm,doorW,doorH,bottomLift,handleType,handleSize,cavaPosition,cavaDiscount,
    hingeEnabled,mountEnabled,hingeCount,hingeSide:String($('doorHingeSide')?.value||'auto'),
    cupDiameter:doorFieldNumber('doorHingeCupDiameter',35,.5,100),cupDepth:doorFieldNumber('doorHingeCupDepth',12,.5,100),
    cupEdge:doorFieldNumber('doorHingeCupEdge',22.5,1,500),hingeEdgeY:doorFieldNumber('doorHingeEdgeY',100,5,1000),
    mountFrontOffset:doorFieldNumber('doorMountFrontOffset',37,0,1000),mountSpacing:doorFieldNumber('doorMountSpacing',32,0,500),
    mountDiameter:doorFieldNumber('doorMountDiameter',5,.5,50),mountDepth:doorFieldNumber('doorMountDepth',12,.5,100)
  };
}
function doorHingeSideForIndex(index,count,mode){
  if(mode==='left'||mode==='right')return mode;
  if(count<=1)return 'left';
  return index < count/2 ? 'left' : 'right';
}
function doorHingePositionsMm(heightMm,count,edgeMm){
  const h=Math.max(1,Number(heightMm)||1),n=Math.max(1,Math.round(Number(count)||1));
  if(n===1)return [h/2];
  const edge=Math.max(5,Math.min(Number(edgeMm)||100,Math.max(5,h/2-1)));
  const span=Math.max(0,h-2*edge);
  if(span<.001)return [h/2];
  const out=[];for(let i=0;i<n;i++)out.push(edge+span*(i/(n-1)));
  return out;
}
function doorMountPanelCandidate(door,hingeSide,rootId,hingeWorldY){
  const db=objectBoundsMm(door),edgeX=hingeSide==='left'?db.minX:db.maxX;
  let best=null;
  for(const o of objects){
    if(o===door||o.userData?.spaceRootId!==rootId||isDoorObject(o)||o.userData?.kind==='hardware-visual'||o.userData?.kind==='cylinder')continue;
    const ti=pieceThicknessInfo(o);if(!ti||ti.thicknessAxis!=='x')continue;
    const b=objectBoundsMm(o);
    if(hingeWorldY<b.minY-2||hingeWorldY>b.maxY+2)continue;
    if(hingeSide==='left'&&o.position.x>door.position.x+.03)continue;
    if(hingeSide==='right'&&o.position.x<door.position.x-.03)continue;
    const faceX=hingeSide==='left'?b.maxX:b.minX;
    const distance=Math.abs(faceX-edgeX);
    if(distance>80)continue;
    const frontDistance=Math.abs(b.maxZ-db.maxZ);
    const name=String(o.userData?.name||'');
    const structural=/lateral|divis[aã]o vertical/i.test(name)?-8:0;
    const score=distance+Math.min(50,frontDistance*.08)+structural;
    if(!best||score<best.score)best={object:o,bounds:b,score,distance};
  }
  return best?.object||null;
}
function appendDoorHingeDrilling(door,root,cfg,hingeSide){
  if(!cfg.hingeEnabled)return {hinges:0,mountHoles:0,missingMount:0};
  const db=objectBoundsMm(door),positions=doorHingePositionsMm(cfg.doorH,cfg.hingeCount,cfg.hingeEdgeY);
  const cupR=cfg.cupDiameter/2;
  const cupEdge=Math.max(cupR,Math.min(cfg.cupEdge,cfg.doorW-cupR));
  let hinges=0,mountHoles=0,missingMount=0;
  for(const localY of positions){
    const worldY=db.minY+localY;
    const target=cfg.mountEnabled?doorMountPanelCandidate(door,hingeSide,root.id,worldY):null;
    const instanceId=uid('doorhinge');
    const metaBase={presetId:'builtin-door-hinge-auto',name:'Dobradiça de porta',sourcePartId:door.userData.partId||null,contactPartId:target?.userData?.partId||null};
    const cupWorld={x:hingeSide==='left'?db.minX+cupEdge:db.maxX-cupEdge,y:worldY,z:db.minZ};
    const cupOp=hardwareHoleOp(door,cupWorld,'+z',{diameter:cfg.cupDiameter,depth:cfg.cupDepth},{...metaBase,role:'selected',contactName:target?.userData?.name||'Lateral do móvel'},instanceId);
    (door.userData.machining||(door.userData.machining=[])).push(cupOp);hinges++;
    if(cfg.mountEnabled){
      if(!target){missingMount++;continue;}
      const tb=objectBoundsMm(target),r=cfg.mountDiameter/2;
      const z=Math.max(tb.minZ+r,Math.min(tb.maxZ-r,tb.maxZ-cfg.mountFrontOffset));
      const entry=target.position.x<door.position.x?'-x':'+x';
      const offsets=cfg.mountSpacing>.001?[-cfg.mountSpacing/2,cfg.mountSpacing/2]:[0];
      let made=0;
      for(const off of offsets){
        const y=worldY+off;if(y<tb.minY+r-.01||y>tb.maxY-r+.01)continue;
        const op=hardwareHoleOp(target,{x:target.position.x*1000,y,z},entry,{diameter:cfg.mountDiameter,depth:cfg.mountDepth},{...metaBase,role:'contact',contactName:door.userData?.name||'Porta'},instanceId);
        (target.userData.machining||(target.userData.machining=[])).push(op);made++;mountHoles++;
      }
      if(!made)missingMount++;
      sanitizeMachiningForPiece(target);
    }
  }
  sanitizeMachiningForPiece(door);
  return {hinges,mountHoles,missingMount};
}
// 1.100.94 · inverter lado da dobradiça pelo menu de configuração da porta.
function doorInspectorRuntimeConfig(door){
  const h=door?.userData?.doorConfig?.hinge||{};
  const doorW=mm(door?.userData?.width||0),doorH=mm(door?.userData?.height||0);
  return {
    doorW,doorH,
    hingeEnabled:h.enabled!==false,
    mountEnabled:h.mountEnabled!==false,
    hingeCount:Math.max(1,Math.min(6,Math.round(Number(h.count)||doorAutoHingeCount(doorH)))),
    cupDiameter:Math.max(.5,Number(h.cupDiameter)||35),
    cupDepth:Math.max(.5,Number(h.cupDepth)||12),
    cupEdge:Math.max(1,Number(h.cupEdge)||22.5),
    hingeEdgeY:Math.max(5,Number(h.edgeY)||100),
    mountFrontOffset:Math.max(0,Number(h.mountFrontOffset)||37),
    mountSpacing:Math.max(0,Number(h.mountSpacing)||32),
    mountDiameter:Math.max(.5,Number(h.mountDiameter)||5),
    mountDepth:Math.max(.5,Number(h.mountDepth)||12)
  };
}
function removeDoorAutomaticHinges(door){
  if(!door)return {instances:0,operations:0};
  const partId=String(door.userData?.partId||'');
  const ids=new Set();
  for(const o of objects){
    for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
      if(op?.hardwarePresetId!=='builtin-door-hinge-auto'||!op.hardwareInstanceId)continue;
      if(o===door || (partId && String(op.hardwareSourcePartId||'')===partId))ids.add(op.hardwareInstanceId);
    }
  }
  let operations=0;
  if(ids.size){
    for(const o of objects){
      const arr=Array.isArray(o.userData?.machining)?o.userData.machining:null;
      if(!arr)continue;
      const keep=arr.filter(op=>!op?.hardwareInstanceId||!ids.has(op.hardwareInstanceId));
      operations+=arr.length-keep.length;
      if(keep.length!==arr.length)o.userData.machining=keep;
    }
  }
  return {instances:ids.size,operations};
}
function setSelectedDoorHingeSide(side){
  const door=selected;
  if(!door?.userData?.doorConfig){
    toast('Selecione uma porta');return false;
  }
  side=side==='right'?'right':'left';
  const root=rootForObject(door);
  if(!root){toast('Não encontrei o espaço desta porta');return false;}
  const dc=door.userData.doorConfig;
  dc.hinge=dc.hinge||{};
  if(dc.hinge.enabled===false){toast('Esta porta está sem furação automática de dobradiça');return false;}
  const current=dc.hinge.side==='right'?'right':'left';
  if(current===side){toast(`A dobradiça já está no lado ${side==='left'?'esquerdo':'direito'}`);return true;}

  removeDoorAutomaticHinges(door);
  dc.hinge.side=side;
  const cfg=doorInspectorRuntimeConfig(door);
  const st=appendDoorHingeDrilling(door,root,cfg,side);
  renderMachiningVisuals();
  updateInspector();
  commitHistory();
  const extra=st.missingMount?` · ${st.missingMount} posição(ões) sem lateral/divisão encontrada`:'';
  toast(`Dobradiça invertida para o lado ${side==='left'?'esquerdo':'direito'} · ${st.hinges} dobradiça(s)${extra}`);
  return true;
}

function updateDoorCreationVisibility(){
  const isDoors=pieceCreateType==='doors';
  $('saveDoorCreateConfig')?.classList.toggle('hiddenField',!isDoors);
  const handleType=String($('doorHandleType')?.value||'none');
  $('doorHandleSizeLabel')?.classList.toggle('hiddenField',!isDoors||handleType==='none');
  $('doorCavaPositionLabel')?.classList.toggle('hiddenField',!isDoors||handleType!=='cava');
  const hingeOn=isDoors&&!!$('doorCreateHingeHoles')?.checked;
  if($('doorHingeFields'))$('doorHingeFields').style.display=hingeOn?'block':'none';
  const mountOn=hingeOn&&!!$('doorCreateSideHoles')?.checked;
  if($('doorMountFields'))$('doorMountFields').style.display=mountOn?'block':'none';
}

function updateCreatePiecesUI(){
  const info=selectedCellInfo(); if(!info)return;
  const s=info.size, t=Math.max(.001,m($('pieceThickness').value)||.018);
  const front=Math.max(0,m($('pieceFrontInset').value)||0), back=Math.max(0,m($('pieceBackInset').value)||0);
  const usableDepth=Math.max(.001,s.depth-front-back);
  const isShelf=pieceCreateType==='shelf', isMulti=pieceCreateType==='shelves';
  const isDepthPiece=pieceCreateType==='back'||pieceCreateType==='front';
  const isDoors=pieceCreateType==='doors';
  const isDivision=pieceCreateType==='division';
  $('piecePositionLabel').classList.toggle('hiddenField',!isShelf);
  $('pieceCountLabel').classList.toggle('hiddenField',!isMulti);
  $('pieceDistributionLabel').classList.toggle('hiddenField',!isMulti);
  $('pieceDivisionFields').classList.toggle('hiddenField',!isDivision);
  $('doorGapFields').classList.toggle('hiddenField',!isDoors);
  updateDoorCreationVisibility();
  // Fundo/Frente ocupam a profundidade pela própria espessura; recuos não se aplicam.
  // A divisão usa os mesmos recuos das laterais, para poder ser mais rasa que o móvel.
  $('pieceFrontInsetLabel').classList.toggle('hiddenField',isDepthPiece||isDoors);
  $('pieceBackInsetLabel').classList.toggle('hiddenField',isDepthPiece||isDoors);
  $('pieceTarget').textContent=`Divisão: ${mm(s.width)} × ${mm(s.depth)} × ${mm(s.height)} mm`;
  let text='';
  if(pieceCreateType==='left'||pieceCreateType==='right') text=`${pieceTypeName(pieceCreateType)}: ${mm(t)} × ${mm(usableDepth)} × ${mm(s.height)} mm`;
  else if(isDivision){
    const d=pieceDivisionLayoutMm(s.width,t);
    const mode=d.centered?'centralizada':(d.side==='gap1'?'medida aplicada no 1º vão':'medida aplicada no 2º vão');
    $('pieceDivisionPreview').innerHTML=d.ok
      ? `<strong>Vão 1:</strong> ${nice(d.gap1)} mm &nbsp;·&nbsp; <strong>Divisão:</strong> ${nice(d.thickness)} mm &nbsp;·&nbsp; <strong>Vão 2:</strong> ${nice(d.gap2)} mm<br><span style="color:var(--muted)">${mode}</span>`
      : `<strong style="color:#ff7169">${d.message}</strong><br>Vão 1: ${nice(d.gap1)} mm · Divisão: ${nice(d.thickness)} mm · Vão 2: ${nice(d.gap2)} mm`;
    text=d.ok
      ? `Divisão vertical: ${nice(d.thickness)} × ${nice(mm(usableDepth))} × ${nice(mm(s.height))} mm · Vão 1 ${nice(d.gap1)} mm · Vão 2 ${nice(d.gap2)} mm`
      : d.message;
  }
  else if(pieceCreateType==='base'||pieceCreateType==='top') text=`${pieceTypeName(pieceCreateType)}: ${mm(s.width)} × ${mm(usableDepth)} × ${mm(t)} mm`;
  else if(isDepthPiece) text=`${pieceTypeName(pieceCreateType)}: ${mm(s.width)} × ${mm(t)} × ${mm(s.height)} mm`;
  else if(isDoors){
    const dc=doorCreationConfig(s);
    const handleText=dc.handleType==='cava'?` · cava ${nice(dc.handleSize)} mm em ${dc.cavaPosition==='top'?'cima':'baixo'} (descontada)`:dc.handleType==='external'?` · puxador externo ${nice(dc.handleSize)} mm`:' · sem puxador';
    const hingeText=dc.hingeEnabled?` · ${dc.hingeCount} dobradiça(s)/porta · copo Ø${nice(dc.cupDiameter)} × ${nice(dc.cupDepth)} mm${dc.mountEnabled?' + placa na lateral':''}`:' · sem furação de dobradiça';
    text=(dc.doorW>0&&dc.doorH>0) ? `${dc.count} porta(s): cada uma ${nice(dc.doorW)} × ${mm(t)} × ${nice(dc.doorH)} mm · vãos E ${nice(dc.gl)} / D ${nice(dc.gr)} / C ${nice(dc.gt)} / B ${nice(dc.gb)} / M ${nice(dc.gm)} mm${handleText}${hingeText}` : 'Os vãos/desconto informados não cabem nesta divisão.';
    if($('doorHingePreview'))$('doorHingePreview').textContent=dc.hingeEnabled
      ? `${dc.hingeCount} dobradiça(s) por porta · copo Ø${nice(dc.cupDiameter)} mm · ${dc.mountEnabled?`placa: linha ${nice(dc.mountFrontOffset)} mm da frente / ${nice(dc.mountSpacing)} mm entre furos`:'somente furo na porta'}`
      : 'Furação de dobradiça desativada';
  } else if(isShelf){
    let rawPos=Number($('piecePosition').value);
    if(!Number.isFinite(rawPos)||rawPos<0)rawPos=0;

    // 1.100.2: zero significa CENTRALIZAR.
    // Ex.: vão 900 mm, prateleira 18 mm:
    // espaço livre = 882 mm -> 441 mm embaixo + 18 + 441 mm em cima.
    const freeH=Math.max(0,s.height-t);
    let pos=rawPos<=.000001?freeH/2:m(rawPos);
    pos=Math.min(Math.max(0,pos),freeH);

    const bottomGap=pos;
    const topGap=Math.max(0,s.height-t-pos);
    text=rawPos<=.000001
      ? `Prateleira: ${mm(s.width)} × ${mm(usableDepth)} × ${mm(t)} mm · CENTRALIZADA · vão baixo ${mm(bottomGap)} mm · vão cima ${mm(topGap)} mm`
      : `Prateleira: ${mm(s.width)} × ${mm(usableDepth)} × ${mm(t)} mm · base a ${mm(pos)} mm do piso desta divisão`;
  } else if(isMulti){
    const n=Math.max(1,Math.min(50,Math.round(Number($('pieceCount').value)||1)));
    const free=s.height-n*t;
    if(free<=0) text=`As ${n} prateleiras (${mm(n*t)} mm) não cabem na altura de ${mm(s.height)} mm.`;
    else { const gap=free/(n+1); text=`${n} prateleiras de ${mm(t)} mm · ${n+1} vãos iguais de ${mm(gap)} mm (espessuras já descontadas).`; }
  }
  $('pieceCreateInfo').textContent=text;
}
function replaceCellWithFreeRegions(root, oldCell, regions, preferred='largest'){
  const idx=root.cells.findIndex(c=>c.id===oldCell.id);
  if(idx<0) throw new Error('A divisão selecionada não existe mais');
  const valid=regions.filter(c=>(c.maxX-c.minX)>=MIN_SIZE && (c.maxY-c.minY)>=MIN_SIZE && (c.maxZ-c.minZ)>=MIN_SIZE)
                     .map(c=>({...c,id:uid('cell')}));
  root.cells.splice(idx,1,...valid);
  renderSpaces();
  // Se a peça preencher 100% da divisão selecionada (por exemplo, um Fundo
  // de 6 mm dentro de um corte de 6 mm), não existe sobra dentro daquela
  // célula. Nesse caso, selecionamos automaticamente o maior vão livre que
  // já existia no mesmo espaço em vez de simplesmente perder a seleção.
  if(!valid.length){
    if(root.cells.length){
      const target=root.cells.reduce((a,b)=>{
        const sa=cellSize(a), sb=cellSize(b);
        return (sb.width*sb.depth*sb.height)>(sa.width*sa.depth*sa.height)?b:a;
      },root.cells[0]);
      selectSpaceCellByIds(root.id,target.id);
      return target;
    }
    clearSpaceSelection();
    return null;
  }
  let target=valid[0];
  if(preferred==='last') target=valid[valid.length-1];
  else if(preferred==='largest'){
    target=valid.reduce((a,b)=>{
      const sa=cellSize(a), sb=cellSize(b);
      const va=sa.width*sa.depth*sa.height, vb=sb.width*sb.depth*sb.height;
      return vb>va?b:a;
    },valid[0]);
  }
  selectSpaceCellByIds(root.id,target.id);
  return target;
}

// Tolerância de encaixe entre uma peça e uma divisão criada manualmente.
// 0,5 mm evita bloquear por pequenas diferenças de ponto flutuante.
const PIECE_FIT_TOL=.0005;
function pieceFitsWholeAxis(pieceSize,cellSizeM){
  return Math.abs(pieceSize-cellSizeM)<=PIECE_FIT_TOL;
}

function createPiecesInSelectedCell(){
  const info=selectedCellInfo(); if(!info){toast('Selecione uma divisão');return false;}
  const root=info.root, c={...info.cell}, s=info.size;
  const t=m($('pieceThickness').value),front=m($('pieceFrontInset').value),back=m($('pieceBackInset').value);
  if(![t,front,back].every(Number.isFinite)||t<.001||front<0||back<0){toast('Confira as medidas');return false;}
  const depth=s.depth-front-back;
  if(depth<.001){toast('Os recuos ultrapassam a profundidade');return false;}
  // Trás/fundo é -Z e frente é +Z na vista frontal.
  const z=(c.minZ+back + c.maxZ-front)/2;
  const common={depth,kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)};
  const newFree=[];
  let createdCount=0;
  let affectsSpace=true;
  let divisionFixedInterval=null;
  historyMuted=true;
  try{
    if(pieceCreateType==='left'){
      const fillsWhole=pieceFitsWholeAxis(t,s.width);
      if(t>s.width+PIECE_FIT_TOL) throw new Error('A espessura da lateral é maior que esta divisão');
      if(!fillsWhole && t>s.width-MIN_SIZE) throw new Error('A lateral não deixa espaço livre suficiente');
      const pieceW=fillsWhole?s.width:t;
      createBox({...common,width:pieceW,height:s.height,x:fillsWhole?info.center.x:c.minX+pieceW/2,yBase:c.minY,z,name:'Lateral esquerda'},false);
      if(!fillsWhole) newFree.push({...c,minX:c.minX+pieceW});
      createdCount=1;
    } else if(pieceCreateType==='right'){
      const fillsWhole=pieceFitsWholeAxis(t,s.width);
      if(t>s.width+PIECE_FIT_TOL) throw new Error('A espessura da lateral é maior que esta divisão');
      if(!fillsWhole && t>s.width-MIN_SIZE) throw new Error('A lateral não deixa espaço livre suficiente');
      const pieceW=fillsWhole?s.width:t;
      createBox({...common,width:pieceW,height:s.height,x:fillsWhole?info.center.x:c.maxX-pieceW/2,yBase:c.minY,z,name:'Lateral direita'},false);
      if(!fillsWhole) newFree.push({...c,maxX:c.maxX-pieceW});
      createdCount=1;
    } else if(pieceCreateType==='division'){
      if(t>=s.width-2*MIN_SIZE) throw new Error('A divisão não deixa dois vãos livres suficientes');
      const d=pieceDivisionLayoutMm(s.width,t);
      if(!d.ok) throw new Error(d.message||'Confira a medida da divisão');

      const gap1=m(d.gap1),gap2=m(d.gap2);
      const x0=c.minX+gap1;
      const x1=x0+t;

      // Peça vertical no ponto definido. Vão 1 = esquerda; Vão 2 = direita
      // olhando o móvel de frente.
      const divisionPiece=createBox({
        ...common,
        width:t,
        height:s.height,
        x:(x0+x1)/2,
        yBase:c.minY,
        z,
        name:'Divisão vertical'
      },false);
      divisionPiece.userData.divisionNominalThicknessM=t;
      divisionFixedInterval={x0,x1};

      newFree.push({...c,maxX:x0});
      newFree.push({...c,minX:x1});
      createdCount=1;
    } else if(pieceCreateType==='base'){
      const fillsWhole=pieceFitsWholeAxis(t,s.height);
      if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura da base é maior que esta divisão');
      if(!fillsWhole && t>s.height-MIN_SIZE) throw new Error('A base não deixa espaço livre suficiente');
      const pieceH=fillsWhole?s.height:t;
      createBox({...common,width:s.width,height:pieceH,x:info.center.x,yBase:c.minY,z,name:'Base'},false);
      if(!fillsWhole) newFree.push({...c,minY:c.minY+pieceH});
      createdCount=1;
    } else if(pieceCreateType==='top'){
      const fillsWhole=pieceFitsWholeAxis(t,s.height);
      if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura do chapéu é maior que esta divisão');
      if(!fillsWhole && t>s.height-MIN_SIZE) throw new Error('O chapéu não deixa espaço livre suficiente');
      const pieceH=fillsWhole?s.height:t;
      createBox({...common,width:s.width,height:pieceH,x:info.center.x,yBase:fillsWhole?c.minY:c.maxY-pieceH,z,name:'Chapéu'},false);
      if(!fillsWhole) newFree.push({...c,maxY:c.maxY-pieceH});
      createdCount=1;
    } else if(pieceCreateType==='back'){
      const fillsWhole=pieceFitsWholeAxis(t,s.depth);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura do fundo é maior que esta divisão');
      if(!fillsWhole && t>s.depth-MIN_SIZE) throw new Error('O fundo não deixa espaço livre suficiente');
      const pieceD=fillsWhole?s.depth:t;
      createBox({width:s.width,depth:pieceD,height:s.height,x:info.center.x,yBase:c.minY,z:fillsWhole?info.center.z:c.minZ+pieceD/2,name:'Fundo',kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)},false);
      if(!fillsWhole) newFree.push({...c,minZ:c.minZ+pieceD});
      createdCount=1;
    } else if(pieceCreateType==='front'){
      const fillsWhole=pieceFitsWholeAxis(t,s.depth);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura da frente é maior que esta divisão');
      if(!fillsWhole && t>s.depth-MIN_SIZE) throw new Error('A frente não deixa espaço livre suficiente');
      const pieceD=fillsWhole?s.depth:t;
      createBox({width:s.width,depth:pieceD,height:s.height,x:info.center.x,yBase:c.minY,z:fillsWhole?info.center.z:c.maxZ-pieceD/2,name:'Frente',kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,spaceCutting:true,spaceCutParentBounds:cellBox(c)},false);
      if(!fillsWhole) newFree.push({...c,maxZ:c.maxZ-pieceD});
      createdCount=1;
    } else if(pieceCreateType==='doors'){
      const dc=doorCreationConfig(s);
      if(dc.doorW<mm(MIN_SIZE)||dc.doorH<mm(MIN_SIZE)) throw new Error('Os vãos ou o desconto do puxador ultrapassam o tamanho desta divisão');
      if(dc.hingeEnabled && dc.cupEdge<dc.cupDiameter/2) throw new Error('O centro do copo precisa ficar pelo menos a metade do diâmetro para dentro da porta');
      const fillsWholeDepth=pieceFitsWholeAxis(t,s.depth);
      if(t>s.depth+PIECE_FIT_TOL) throw new Error('A espessura da porta é maior que a profundidade desta divisão');
      if(!fillsWholeDepth && t>s.depth-MIN_SIZE) throw new Error('A porta não deixa espaço livre suficiente atrás dela');
      const pieceD=fillsWholeDepth?s.depth:t;
      const zDoor=fillsWholeDepth?info.center.z:c.maxZ-pieceD/2;
      const yDoor=c.minY+m(dc.gb+dc.bottomLift);
      const doors=[];
      for(let i=0;i<dc.count;i++){
        const xMm=dc.gl+dc.doorW/2+i*(dc.doorW+dc.gm);
        const x=c.minX+m(xMm);
        const name=dc.count===1?'Porta 1':(dc.count===2?(i===0?'Porta esquerda':'Porta direita'):`Porta ${i+1}`);
        const doorCfg={schemaVersion:1,index:i+1,count:dc.count,gaps:{left:dc.gl,right:dc.gr,top:dc.gt,bottom:dc.gb,middle:dc.gm},handle:{type:dc.handleType,size:dc.handleSize,position:dc.cavaPosition},hinge:{enabled:dc.hingeEnabled,count:dc.hingeCount,side:doorHingeSideForIndex(i,dc.count,dc.hingeSide),cupDiameter:dc.cupDiameter,cupDepth:dc.cupDepth,cupEdge:dc.cupEdge,edgeY:dc.hingeEdgeY,mountEnabled:dc.mountEnabled,mountFrontOffset:dc.mountFrontOffset,mountSpacing:dc.mountSpacing,mountDiameter:dc.mountDiameter,mountDepth:dc.mountDepth}};
        const door=createBox({width:m(dc.doorW),depth:pieceD,height:m(dc.doorH),x,yBase:yDoor,z:zDoor,name,kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,doorConfig:doorCfg},false);
        doors.push(door);
        if(root.doorsHidden){door.visible=false;door.userData.hiddenByDoors=true;}
      }
      let hingeStats={hinges:0,mountHoles:0,missingMount:0};
      if(dc.hingeEnabled){
        for(let i=0;i<doors.length;i++){
          const side=doorHingeSideForIndex(i,dc.count,dc.hingeSide);
          const st=appendDoorHingeDrilling(doors[i],root,dc,side);
          hingeStats.hinges+=st.hinges;hingeStats.mountHoles+=st.mountHoles;hingeStats.missingMount+=st.missingMount;
        }
        renderMachiningVisuals();
      }
      createdCount=doors.length;affectsSpace=false;
      window.__lastDoorCreateStats={...hingeStats,count:doors.length,handleType:dc.handleType,handleSize:dc.handleSize};
    } else if(pieceCreateType==='shelf'){
      const fillsWhole=pieceFitsWholeAxis(t,s.height);
      if(t>s.height+PIECE_FIT_TOL) throw new Error('A espessura da prateleira é maior que esta divisão');
      if(!fillsWhole && t>s.height-MIN_SIZE) throw new Error('A prateleira não cabe nessa altura');
      if(fillsWhole){
        createBox({...common,width:s.width,height:s.height,x:info.center.x,yBase:c.minY,z,name:'Prateleira'},false);
        createdCount=1;
      } else {
      let rawPos=Number($('piecePosition').value);
      if(!Number.isFinite(rawPos)||rawPos<0)rawPos=0;

      const freeH=Math.max(0,s.height-t);
      // Zero = centro exato do espaço livre, já descontando a espessura.
      // Valor > 0 continua sendo a medida da base da prateleira a partir
      // do piso do vão selecionado.
      let pos=rawPos<=.000001?freeH/2:m(rawPos);
      pos=Math.min(Math.max(0,pos),freeH);

      const y0=c.minY+pos, y1=y0+t;
      createBox({...common,width:s.width,height:t,x:info.center.x,yBase:y0,z,name:'Prateleira'},false);
      if(y0-c.minY>=MIN_SIZE) newFree.push({...c,maxY:y0});
      if(c.maxY-y1>=MIN_SIZE) newFree.push({...c,minY:y1});
      createdCount=1;
      }
    } else if(pieceCreateType==='shelves'){
      const n=Math.max(1,Math.min(50,Math.round(Number($('pieceCount').value)||1)));
      const free=s.height-n*t;
      if(free<(n+1)*MIN_SIZE) throw new Error('As prateleiras não deixam vãos suficientes nessa altura');
      const gap=free/(n+1);
      let cursor=c.minY;
      for(let i=0;i<n;i++){
        const gapEnd=cursor+gap;
        newFree.push({...c,minY:cursor,maxY:gapEnd});
        const shelfBase=gapEnd;
        createBox({...common,width:s.width,height:t,x:info.center.x,yBase:shelfBase,z,name:`Prateleira ${i+1}`},false);
        cursor=shelfBase+t;
        createdCount++;
      }
      newFree.push({...c,minY:cursor,maxY:c.maxY});
    }

    // A própria peça vira o "corte": a região ocupada desaparece da lista de
    // vãos livres e somente os espaços restantes continuam selecionáveis.
    if(affectsSpace) replaceCellWithFreeRegions(root,c,newFree,'largest');
    else selectSpaceCellByIds(root.id,c.id);

    // A faixa ocupada pela Divisão vertical fica fixa na espessura da chapa.
    // O restante do móvel é que absorve futuros redimensionamentos.
    if(divisionFixedInterval){
      registerVerticalDivisionFixedBand(root,divisionFixedInterval.x0,divisionFixedInterval.x1);
    }
  } catch(err){
    historyMuted=false;
    toast(err.message||'Não foi possível criar');
    return false;
  }
  historyMuted=false;
  commitHistory();
  const filledWhole = affectsSpace && createdCount===1 && newFree.length===0;
  if(pieceCreateType==='doors'){
    const st=window.__lastDoorCreateStats||{count:createdCount,hinges:0,mountHoles:0,missingMount:0};
    const hingeText=st.hinges?` · ${st.hinges} copo(s) de dobradiça · ${st.mountHoles} furo(s) de placa`:'';
    const missing=st.missingMount?` · ${st.missingMount} dobradiça(s) sem lateral/divisão encontrada`:'';
    toast(`${st.count||createdCount} porta(s) criada(s)${hingeText}${missing}`);
    window.__lastDoorCreateStats=null;
  }
  else if(pieceCreateType==='division'){
    const d=pieceDivisionLayoutMm(s.width,t);
    toast(`Divisão criada · Vão 1 ${nice(d.gap1)} mm · Vão 2 ${nice(d.gap2)} mm`);
  }
  else if(pieceCreateType==='shelf' && Number($('piecePosition').value)<=0){
    toast('Prateleira criada no centro · espessura descontada do vão');
  }
  else toast(createdCount>1 ? `${createdCount} prateleiras criadas · espaço dividido` : (filledWhole ? 'Peça criada · corte preenchido' : 'Peça criada · espaço dividido automaticamente'));
  return true;
}

// ---------- v86: Gavetas / corrediças paramétricas ----------
const DRAWER_SLIDE_PRESETS={
  telescopic:{
    id:'telescopic',
    name:'Häfele H45 P · telescópica 30 kg',
    manufacturer:'Häfele',
    model:'H45 P / Matrix Runner BB S',
    sideClearance:12.7,
    railHeight:45.7,
    railWidth:12.7,
    railFrontInset:2,
    mountY:22.85,
    holeDiameter:5,
    holeDepth:10,
    drillFrontRef:37,
    drillOffsets:[0,128,224],
    drillAutoByLength:true,
    drillByLength:{
      250:[0,128],
      300:[0,128,224],
      350:[0,128,224],
      400:[0,128,224,320],
      450:[0,128,224,352],
      500:[0,128,224,352,416],
      550:[0,128,224,352,448],
      600:[0,128,224,352,480],
      650:[0,128,224,352,544],
      700:[0,128,224,352,544]
    },
    catalogByLength:{
      250:'420.50.627',300:'420.50.632',350:'420.50.637',400:'420.50.642',
      450:'420.50.647',500:'420.50.652',550:'420.50.657',600:'420.50.662',
      650:'420.50.667',700:'420.50.672'
    },
    lengths:[250,300,350,400,450,500,550,600,650,700]
  },
  undermount:{
    id:'undermount',
    name:'Oculta · Matrix Runner UM A25',
    manufacturer:'Häfele',
    model:'Matrix Runner UM A25',
    sideClearance:21,
    railHeight:12,
    railWidth:39,
    railExtraLength:18,
    railFrontInset:0,
    mountY:10,
    holeDiameter:5,
    holeDepth:10,
    drillFrontRef:37,
    drillOffsets:[0,128,224],
    lengths:[250,270,300,350,400,450,500,550]
  },
  generic:{id:'generic',name:'Genérica lateral',sideClearance:12.5,railHeight:35,railWidth:9,mountY:18,holeDiameter:5,holeDepth:10,drillFrontRef:37,drillOffsets:[0,64],lengths:[250,300,350,400,450,500,550,600]}
};
let drawerTargetRootId=null,drawerTargetCellId=null,drawerEditingSetId=null;
const DRAWER_SLIDE_LIBRARY_KEY='miniCadProV88_drawerSlideLibrary';
function getDrawerSlideLibrary(){
  try{const a=JSON.parse(localStorage.getItem(DRAWER_SLIDE_LIBRARY_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name):[];}catch(_){return [];}
}
function setDrawerSlideLibrary(a){try{localStorage.setItem(DRAWER_SLIDE_LIBRARY_KEY,JSON.stringify(a||[]));}catch(_){}}
function refreshDrawerSlideLibrarySelect(keep=''){
  const sel=$('drawerSavedSlideSelect');if(!sel)return;
  const arr=getDrawerSlideLibrary();sel.innerHTML='<option value="">Configuração atual / padrão</option>';
  for(const item of arr){const o=document.createElement('option');o.value=item.id;o.textContent=item.name;sel.appendChild(o);}
  if(keep&&arr.some(x=>x.id===keep))sel.value=keep;else sel.value='';
  $('deleteDrawerSlidePreset').disabled=!sel.value;
}
function captureDrawerSlidePreset(){
  return {
    version:4,
    slideType:$('drawerSlideType').value,
    lengthMode:$('drawerLengthMode').value,
    sideClearance:Number($('drawerSideClearance').value),
    frontInset:Number($('drawerFrontInset').value),
    rearClearance:Number($('drawerRearClearance').value),
    createSlides:!!$('drawerCreateSlides').checked,
    createDrilling:!!$('drawerCreateDrilling').checked,

    // Guarda também a caixa e o fundo ligados a esta configuração,
    // para o usuário configurar uma vez e reutilizar.
    boxHeight:Number($('drawerBoxHeight').value),
    boxThickness:Number($('drawerBoxThickness').value),
    edgeGap:Number($('drawerEdgeGap').value),
    bottomThickness:Number($('drawerBottomThickness2').value),
    bottomOffset:Number($('drawerBottomOffset').value),
    bottomPassLeft:Number($('drawerBottomPassLeft').value),
    bottomPassRight:Number($('drawerBottomPassRight').value),
    bottomPassFront:Number($('drawerBottomPassFront').value),
    bottomPassBack:Number($('drawerBottomPassBack').value),
    machineBottom:!!$('drawerMachineBottom').checked,
    bottomGrooveClearance:Number($('drawerBottomGrooveClearance').value),
    bottomGrooveDepth:Number($('drawerBottomGrooveDepth').value),
    grooveLeft:!!$('drawerGrooveLeft').checked,
    grooveRight:!!$('drawerGrooveRight').checked,
    grooveFront:!!$('drawerGrooveFront').checked,
    grooveBack:!!$('drawerGrooveBack').checked,
    drillFrontRef:Number($('drawerDrillFrontRef').value),
    drillOffsets:drawerParseDrillOffsets($('drawerDrillOffsets').value),
    drillAutoByLength:!!$('drawerDrillAutoByLength').checked,
    drillMountY:Number($('drawerDrillMountY').value),
    drillDiameter:Number($('drawerDrillDiameter').value),
    drillDepth:Number($('drawerDrillDepth').value)
  };
}
function saveDrawerSlidePresetLibrary(){
  const data=captureDrawerSlidePreset();
  if(!Number.isFinite(data.sideClearance)||data.sideClearance<0||!Number.isFinite(data.frontInset)||!Number.isFinite(data.rearClearance)){toast('Confira as medidas da corrediça');return;}

  const arr=getDrawerSlideLibrary(),selectedId=$('drawerSavedSlideSelect').value;
  let item=selectedId?arr.find(x=>x.id===selectedId):null;

  let name=String($('drawerSavedSlideName').value||'').trim();
  if(!name&&item)name=item.name;
  if(!name){
    const typeName=$('drawerSlideType').selectedOptions?.[0]?.textContent?.trim()||'Corrediça';
    const length=$('drawerLengthMode').value;
    name=`${typeName}${length==='auto'?' · automática':` · ${length} mm`}`;
  }

  if(item){
    Object.assign(item,data,{name,updatedAt:new Date().toISOString()});
  }else{
    item={id:uid('slidePreset'),name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...data};
    arr.push(item);
  }

  setDrawerSlideLibrary(arr);
  refreshDrawerSlideLibrarySelect(item.id);
  $('drawerSavedSlideName').value=item.name;
  toast(selectedId?'Configuração da corrediça atualizada':'Configuração da corrediça salva');
}
function applyDrawerSlidePresetLibrary(){
  const id=$('drawerSavedSlideSelect').value,item=getDrawerSlideLibrary().find(x=>x.id===id);
  $('deleteDrawerSlidePreset').disabled=!item;
  if(!item){$('drawerSavedSlideName').value='';return;}

  $('drawerSavedSlideName').value=item.name;
  $('drawerSlideType').value=item.slideType||'telescopic';
  $('drawerLengthMode').value=item.lengthMode||'auto';
  $('drawerSideClearance').value=nice(item.sideClearance??drawerPreset(item.slideType).sideClearance);
  $('drawerFrontInset').value=nice(item.frontInset??5);
  $('drawerRearClearance').value=nice(item.rearClearance??10);
  $('drawerCreateSlides').checked=item.createSlides!==false;
  $('drawerCreateDrilling').checked=item.createDrilling!==false;

  if(Number.isFinite(Number(item.boxHeight)))$('drawerBoxHeight').value=nice(item.boxHeight);
  if(Number.isFinite(Number(item.boxThickness)))$('drawerBoxThickness').value=nice(item.boxThickness);
  if(Number.isFinite(Number(item.edgeGap)))$('drawerEdgeGap').value=nice(item.edgeGap);
  if(Number.isFinite(Number(item.bottomThickness)))$('drawerBottomThickness2').value=nice(item.bottomThickness);
  if(Number.isFinite(Number(item.bottomOffset)))$('drawerBottomOffset').value=nice(item.bottomOffset);
  if(Number.isFinite(Number(item.bottomPassLeft)))$('drawerBottomPassLeft').value=nice(item.bottomPassLeft);
  if(Number.isFinite(Number(item.bottomPassRight)))$('drawerBottomPassRight').value=nice(item.bottomPassRight);
  if(Number.isFinite(Number(item.bottomPassFront)))$('drawerBottomPassFront').value=nice(item.bottomPassFront);
  if(Number.isFinite(Number(item.bottomPassBack)))$('drawerBottomPassBack').value=nice(item.bottomPassBack);
  if(typeof item.machineBottom==='boolean')$('drawerMachineBottom').checked=item.machineBottom;
  if(Number.isFinite(Number(item.bottomGrooveClearance)))$('drawerBottomGrooveClearance').value=nice(item.bottomGrooveClearance);
  if(Number.isFinite(Number(item.bottomGrooveDepth)))$('drawerBottomGrooveDepth').value=nice(item.bottomGrooveDepth);

  $('drawerGrooveLeft').checked=item.grooveLeft!==false;
  $('drawerGrooveRight').checked=item.grooveRight!==false;
  $('drawerGrooveFront').checked=item.grooveFront===true;
  $('drawerGrooveBack').checked=item.grooveBack===true;

  const savedDrillPreset=drawerPreset(item.slideType||'telescopic');
  const drillDefault=drawerDrillDefaults(savedDrillPreset);
  $('drawerDrillFrontRef').value=nice(Number.isFinite(Number(item.drillFrontRef))?Number(item.drillFrontRef):drillDefault.frontRef);
  $('drawerDrillOffsets').value=drawerParseDrillOffsets(item.drillOffsets?.length?item.drillOffsets:drillDefault.offsets).map(n=>nice(n)).join(', ');
  $('drawerDrillAutoByLength').checked=typeof item.drillAutoByLength==='boolean'
    ? item.drillAutoByLength
    : !!savedDrillPreset.drillByLength;
  $('drawerDrillMountY').value=nice(Number.isFinite(Number(item.drillMountY))?Number(item.drillMountY):drillDefault.mountY);
  $('drawerDrillDiameter').value=nice(Number.isFinite(Number(item.drillDiameter))?Number(item.drillDiameter):drillDefault.diameter);
  $('drawerDrillDepth').value=nice(Number.isFinite(Number(item.drillDepth))?Number(item.drillDepth):drillDefault.depth);

  drawerApplyPresetDefaults(false);
  updateDrawerBottomMachiningFields();
  updateDrawerDrillingFields();
}
function deleteDrawerSlidePresetLibrary(){
  const id=$('drawerSavedSlideSelect').value,item=getDrawerSlideLibrary().find(x=>x.id===id);if(!item){toast('Escolha uma corrediça salva');return;}
  if(!window.confirm(`Excluir “${item.name}” da biblioteca?`))return;
  setDrawerSlideLibrary(getDrawerSlideLibrary().filter(x=>x.id!==id));refreshDrawerSlideLibrarySelect();$('drawerSavedSlideName').value='';toast('Corrediça removida da biblioteca');
}


function drawerParseDrillOffsets(raw){
  const source=Array.isArray(raw)?raw:String(raw??'').trim().split(/[;\s|/]+|,(?=\s*\d)/);
  const out=[];
  for(const v of source){
    const n=Number(String(v).trim().replace(',','.'));
    if(!Number.isFinite(n)||n<0)continue;
    if(!out.some(x=>Math.abs(x-n)<.001))out.push(n);
  }
  return out.sort((a,b)=>a-b);
}
function drawerDrillTableOffsets(presetOrId,length){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  const table=p?.drillByLength;
  if(!table)return null;
  const key=String(Math.round(Number(length)||0));
  const row=table[key]??table[Number(key)];
  return Array.isArray(row)?drawerParseDrillOffsets(row):null;
}
function drawerCatalogCodeForLength(presetOrId,length){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  if(!p?.catalogByLength)return '';
  const key=String(Math.round(Number(length)||0));
  return String(p.catalogByLength[key]??p.catalogByLength[Number(key)]??'');
}
function drawerDrillDefaults(presetOrId){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  return {
    frontRef:Number.isFinite(Number(p?.drillFrontRef))?Number(p.drillFrontRef):37,
    offsets:drawerParseDrillOffsets(p?.drillOffsets?.length?p.drillOffsets:[0,64,128]),
    mountY:Number.isFinite(Number(p?.mountY))?Number(p.mountY):10,
    diameter:Number.isFinite(Number(p?.holeDiameter))?Number(p.holeDiameter):5,
    depth:Number.isFinite(Number(p?.holeDepth))?Number(p.holeDepth):10
  };
}
function drawerDrillValuesFromUi(){
  const p=drawerPreset($('drawerSlideType')?.value),d=drawerDrillDefaults(p);
  const frontRef=Number($('drawerDrillFrontRef')?.value),mountY=Number($('drawerDrillMountY')?.value),diameter=Number($('drawerDrillDiameter')?.value),depth=Number($('drawerDrillDepth')?.value);
  const offsets=drawerParseDrillOffsets($('drawerDrillOffsets')?.value);
  return {
    frontRef:Number.isFinite(frontRef)?frontRef:d.frontRef,
    offsets:offsets.length?offsets:d.offsets,
    autoByLength:!!$('drawerDrillAutoByLength')?.checked,
    mountY:Number.isFinite(mountY)?mountY:d.mountY,
    diameter:Number.isFinite(diameter)?diameter:d.diameter,
    depth:Number.isFinite(depth)?depth:d.depth
  };
}
function drawerAbsoluteDrillPositions(cfg,preset=null){
  const p=preset||drawerPreset(cfg?.slideType),d=drawerDrillDefaults(p);
  const frontRef=Number.isFinite(Number(cfg?.drillFrontRef))?Number(cfg.drillFrontRef):d.frontRef;
  const length=Number(cfg?.resolvedLength)||Infinity;

  const useAuto=(cfg?.drillAutoByLength!==false)&&!!p?.drillByLength;
  const tableOffsets=useAuto?drawerDrillTableOffsets(p,length):null;
  const offsets=tableOffsets?.length
    ? tableOffsets
    : drawerParseDrillOffsets(cfg?.drillOffsets?.length?cfg.drillOffsets:d.offsets);

  return offsets.map(v=>frontRef+v).filter(v=>v>=0&&v<=length-15+.001);
}
function drawerSetDrillingUiFromPreset(presetOrId){
  const p=typeof presetOrId==='string'?drawerPreset(presetOrId):presetOrId;
  const d=drawerDrillDefaults(p);
  $('drawerDrillFrontRef').value=nice(d.frontRef);
  $('drawerDrillOffsets').value=d.offsets.map(n=>nice(n)).join(', ');
  $('drawerDrillAutoByLength').checked=!!p?.drillByLength && p.drillAutoByLength!==false;
  $('drawerDrillMountY').value=nice(d.mountY);
  $('drawerDrillDiameter').value=nice(d.diameter);
  $('drawerDrillDepth').value=nice(d.depth);
}
function updateDrawerDrillingFields(){
  const on=!!$('drawerCreateDrilling')?.checked;
  if($('drawerDrillingFields'))$('drawerDrillingFields').style.display=on?'block':'none';

  try{
    const vals=drawerDrillValuesFromUi(),target=drawerTarget(),preset=drawerPreset($('drawerSlideType').value);
    const resolved=target
      ? drawerResolvedLengthMm(target.cell,preset,$('drawerLengthMode').value,Number($('drawerFrontInset').value)||0,Number($('drawerRearClearance').value)||0)
      : {length:Number($('drawerLengthMode').value)||0};

    const hasTable=!!preset?.drillByLength;
    $('drawerDrillAutoRow').style.display=hasTable?'flex':'none';

    const auto=hasTable&&vals.autoByLength;
    const row=auto?drawerDrillTableOffsets(preset,resolved.length):null;

    if(auto&&row?.length){
      $('drawerDrillOffsets').value=row.map(n=>nice(n)).join(', ');
      $('drawerDrillOffsets').readOnly=true;
    }else{
      $('drawerDrillOffsets').readOnly=false;
    }

    if(on&&$('drawerDrillResult')){
      const cfg={
        slideType:preset.id,
        resolvedLength:resolved.length,
        drillFrontRef:vals.frontRef,
        drillOffsets:auto&&row?.length?row:vals.offsets,
        drillAutoByLength:auto
      };
      const abs=drawerAbsoluteDrillPositions(cfg,preset);
      const code=drawerCatalogCodeForLength(preset,resolved.length);
      const rel=auto&&row?.length?row:vals.offsets;
      $('drawerDrillResult').innerHTML=
        `<strong>${auto?'Catálogo automático':'Manual'}:</strong> `+
        `${nice(vals.frontRef)} + [${rel.map(n=>nice(n)).join(', ')}] = `+
        `<strong>${abs.length?abs.map(n=>nice(n)).join(' / '):'nenhum ponto válido'} mm</strong> desde a frente`+
        `${code?` · Häfele ${code}`:''}`+
        ` · linha Y ${nice(vals.mountY)} mm · Ø${nice(vals.diameter)} × ${nice(vals.depth)} mm.`;
    }
  }catch(_){}

  updateDrawerSystemPreview();
}

function drawerPreset(id){return DRAWER_SLIDE_PRESETS[id]||DRAWER_SLIDE_PRESETS.telescopic;}
function drawerSetObjects(id){return objects.filter(o=>o.userData?.drawerSetId===id);}
function drawerSetRepresentative(id){return drawerSetObjects(id).find(o=>o.userData?.drawerConfig)||null;}
function drawerSetIdsForTarget(rootId,cellId){
  const ids=new Set();
  for(const o of objects){
    const u=o.userData;
    if(!u?.drawerSetId||!u.drawerConfig)continue;
    const cfg=u.drawerConfig;
    if(cfg.targetRootId===rootId&&cfg.targetCellId===cellId)ids.add(u.drawerSetId);
  }
  return [...ids];
}
function drawerPrimarySetIdForTarget(rootId,cellId){
  const ids=drawerSetIdsForTarget(rootId,cellId);
  return ids.length?ids[0]:null;
}
function removeDrawerSetsForTarget(rootId,cellId,{exceptId=null}={}){
  const ids=drawerSetIdsForTarget(rootId,cellId).filter(id=>id&&id!==exceptId);
  let removed=0;
  for(const id of ids)removed+=removeDrawerSet(id,{commit:false,keepSelection:true});
  return {ids,removed};
}
function drawerConfigFromSet(id){const o=drawerSetRepresentative(id);return o?.userData?.drawerConfig?JSON.parse(JSON.stringify(o.userData.drawerConfig)):null;}
function drawerUniqueConfigsForRoot(rootId){
  const map=new Map();
  for(const o of objects){
    const u=o.userData;if(u?.spaceRootId!==rootId||!u.drawerSetId||!u.drawerConfig||map.has(u.drawerSetId))continue;
    map.set(u.drawerSetId,JSON.parse(JSON.stringify(u.drawerConfig)));
  }
  return [...map.values()];
}
function drawerTarget(){
  const root=drawerTargetRootId?getSpaceRoot(drawerTargetRootId):null;
  const cell=root&&drawerTargetCellId?getSpaceCell(root.id,drawerTargetCellId):null;
  return root&&cell?{root,cell,size:cellSize(cell),center:cellCenter(cell)}:null;
}
function drawerAutoLengthMm(cell,preset,frontInset,rearClear){
  const available=mm(cell.maxZ-cell.minZ)-frontInset-rearClear;
  const lengths=(preset.lengths||[]).filter(v=>v<=available+.001);
  return lengths.length?Math.max(...lengths):0;
}
function drawerResolvedLengthMm(cell,preset,mode,frontInset,rearClear){
  const available=mm(cell.maxZ-cell.minZ)-frontInset-rearClear;
  const requested=String(mode||'auto')==='auto'?drawerAutoLengthMm(cell,preset,frontInset,rearClear):Number(mode);
  return {length:Number(requested)||0,available};
}
function drawerApplyPresetDefaults(force=false){
  const p=drawerPreset($('drawerSlideType')?.value);
  if(force||!Number.isFinite(Number($('drawerSideClearance')?.value)))$('drawerSideClearance').value=nice(p.sideClearance);
  if(force||!Number.isFinite(Number($('drawerDrillFrontRef')?.value)))drawerSetDrillingUiFromPreset(p);
  const d=drawerDrillDefaults(p),pattern=`${nice(d.frontRef)} + [${d.offsets.map(n=>nice(n)).join(', ')}]`;
  $('drawerPresetHint').textContent=p.id==='undermount'
    ? `${p.name} · folga ${nice(p.sideClearance)} mm/lado (caixa = vão - ${nice(p.sideClearance*2)} mm) · furação ${pattern}. Tudo pode ser ajustado abaixo.`
    : p.id==='telescopic'
      ? `${p.name} · folga EXATA ${nice(p.sideClearance)} mm/lado · altura ${nice(p.railHeight)} mm · 37 mm da frente · pontos automáticos conforme 250–700 mm.`
      : `${p.name} · comprimentos ${p.lengths.join(' / ')} mm · furação ${pattern}. Tudo pode ser ajustado abaixo.`;
}
function drawerReadConfig(){
  const target=drawerTarget();if(!target)throw new Error('Selecione uma divisão');
  const preset=drawerPreset($('drawerSlideType').value);
  const count=Math.max(1,Math.min(20,Math.round(Number($('drawerCount').value)||1)));
  const sideClearance=Number($('drawerSideClearance').value),boxHeight=Number($('drawerBoxHeight').value),boxThickness=Number($('drawerBoxThickness').value),bottomThickness=Number($('drawerBottomThickness2').value),frontInset=Number($('drawerFrontInset').value),rearClearance=Number($('drawerRearClearance').value),edgeGap=Number($('drawerEdgeGap').value);
  const bottomOffset=Number($('drawerBottomOffset').value),bottomPassLeft=Number($('drawerBottomPassLeft').value),bottomPassRight=Number($('drawerBottomPassRight').value),bottomPassFront=Number($('drawerBottomPassFront').value),bottomPassBack=Number($('drawerBottomPassBack').value);
  const machineBottom=!!$('drawerMachineBottom').checked,bottomGrooveClearance=Number($('drawerBottomGrooveClearance').value),bottomGrooveDepth=Number($('drawerBottomGrooveDepth').value);
  const grooveLeft=!!$('drawerGrooveLeft').checked,grooveRight=!!$('drawerGrooveRight').checked,grooveFront=!!$('drawerGrooveFront').checked,grooveBack=!!$('drawerGrooveBack').checked;
  const createFronts=!!$('drawerCreateFronts').checked,frontThickness=Number($('drawerFrontThickness').value),frontGapLeft=Number($('drawerFrontGapLeft').value),frontGapRight=Number($('drawerFrontGapRight').value),frontGapTop=Number($('drawerFrontGapTop').value),frontGapBottom=Number($('drawerFrontGapBottom').value),frontGapBetween=Number($('drawerFrontGapBetween').value);
  const drillUi=drawerDrillValuesFromUi();
  const drillFrontRef=drillUi.frontRef,drillOffsets=drillUi.offsets,drillAutoByLength=drillUi.autoByLength,drillMountY=drillUi.mountY,drillDiameter=drillUi.diameter,drillDepth=drillUi.depth;

  if(![sideClearance,boxHeight,boxThickness,bottomThickness,frontInset,rearClearance,edgeGap,bottomOffset,bottomPassLeft,bottomPassRight,bottomPassFront,bottomPassBack,bottomGrooveClearance,bottomGrooveDepth,drillFrontRef,drillMountY,drillDiameter,drillDepth].every(Number.isFinite))throw new Error('Confira as medidas das gavetas');
  if(Math.min(sideClearance,frontInset,rearClearance,edgeGap,bottomPassLeft,bottomPassRight,bottomPassFront,bottomPassBack,bottomGrooveClearance,drillFrontRef,drillMountY)<0||boxHeight<=0||boxThickness<=0||bottomThickness<=0||bottomGrooveDepth<=0||drillDiameter<=0||drillDepth<=0)throw new Error('Confira as medidas das gavetas');
  if($('drawerCreateDrilling').checked&&!drillOffsets.length)throw new Error('Informe pelo menos um ponto de furação da corrediça');
  if(machineBottom){
    const grooveW=bottomThickness+bottomGrooveClearance;
    if(bottomOffset<0)throw new Error('Para usinar o fundo, a posição vertical não pode ser negativa');
    if(bottomOffset+grooveW>boxHeight+.001)throw new Error('O rasgo do fundo ultrapassa a altura da caixa');
    if(bottomGrooveDepth>boxThickness+.001)throw new Error(`Profundidade máxima do rasgo: ${nice(boxThickness)} mm`);
    if(!grooveLeft&&!grooveRight&&!grooveFront&&!grooveBack)throw new Error('Marque pelo menos um lado para usinar o fundo');
  }
  if(createFronts){
    if(![frontThickness,frontGapLeft,frontGapRight,frontGapTop,frontGapBottom,frontGapBetween].every(Number.isFinite)||frontThickness<=0)throw new Error('Confira as medidas das frentes');
    if(Math.max(Math.abs(frontGapLeft),Math.abs(frontGapRight),Math.abs(frontGapTop),Math.abs(frontGapBottom),Math.abs(frontGapBetween))>1000)throw new Error('Folga das frentes fora do limite');
  }

  const resolved=drawerResolvedLengthMm(target.cell,preset,$('drawerLengthMode').value,frontInset,rearClearance);
  if(resolved.available<100)throw new Error('A profundidade útil é muito pequena para uma corrediça');
  if(resolved.length<=0)throw new Error(`Nenhum comprimento padrão cabe nos ${nice(resolved.available)} mm úteis`);
  if(resolved.length>resolved.available+.001)throw new Error(`Corrediça de ${nice(resolved.length)} mm não cabe. Disponível: ${nice(resolved.available)} mm`);

  const openingW=mm(target.size.width),openingH=mm(target.size.height),outerW=openingW-sideClearance*2,innerW=outerW-boxThickness*2;
  if(outerW<=boxThickness*2+10)throw new Error('A folga lateral não deixa largura suficiente para a caixa');

  let frontW=0,frontH=0;
  if(createFronts){
    frontW=openingW-frontGapLeft-frontGapRight;
    const availableFrontH=openingH-frontGapTop-frontGapBottom-frontGapBetween*(count-1);
    frontH=availableFrontH/count;
    if(frontW<=10||frontH<=10)throw new Error('As folgas das frentes ultrapassam o tamanho do vão');
    if(boxHeight>frontH+.001)throw new Error(`A caixa (${nice(boxHeight)} mm) é mais alta que cada frente (${nice(frontH)} mm)`);
  }else{
    if(boxHeight+edgeGap*2>openingH+.001)throw new Error('A altura da caixa + folgas não cabe neste vão');
    if(count>1 && openingH-edgeGap*2-boxHeight<1)throw new Error('Não há altura suficiente para distribuir as gavetas');
  }

  const bottomBaseW=innerW,bottomBaseD=Math.max(1,resolved.length-boxThickness*2);
  const bottomW=bottomBaseW+bottomPassLeft+bottomPassRight;
  const bottomD=bottomBaseD+bottomPassFront+bottomPassBack;
  if(bottomW<=1||bottomD<=1)throw new Error('Confira o tamanho final do fundo');
  if(bottomOffset+bottomThickness>boxHeight+50||bottomOffset<-50)throw new Error('Confira a posição vertical do fundo');

  // 1.100.4:
  // Quando o fundo avança para frente/atrás, ele atravessaria fisicamente
  // a contra frente / contra fundo. Nesse caso cortamos o painel por baixo
  // até o topo do fundo.
  const bottomTop=Math.max(0,bottomOffset+bottomThickness);
  const bottomCutFront=bottomPassFront>.001?bottomTop:0;
  const bottomCutBack=bottomPassBack>.001?bottomTop:0;
  if(bottomCutFront>=boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra frente');
  if(bottomCutBack>=boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra fundo');

  return {
    id:drawerEditingSetId||uid('drawerset'),name:`${count} gaveta${count>1?'s':''} · ${preset.name}`,
    targetRootId:target.root.id,targetCellId:target.cell.id,
    slideType:preset.id,slideName:preset.name,lengthMode:$('drawerLengthMode').value,
    resolvedLength:resolved.length,availableDepth:resolved.available,sideClearance,boxHeight,boxThickness,bottomThickness,frontInset,rearClearance,edgeGap,count,
    bottomOffset,bottomPassLeft,bottomPassRight,bottomPassFront,bottomPassBack,bottomW,bottomD,bottomCutFront,bottomCutBack,
    machineBottom,bottomGrooveClearance,bottomGrooveDepth,grooveLeft,grooveRight,grooveFront,grooveBack,
    createFronts,frontThickness,frontGapLeft,frontGapRight,frontGapTop,frontGapBottom,frontGapBetween,frontW,frontH,
    createSlides:!!$('drawerCreateSlides').checked,createDrilling:!!$('drawerCreateDrilling').checked,
    drillFrontRef,drillOffsets,drillAutoByLength,drillMountY,drillDiameter,drillDepth,
    openingW,openingH,openingD:mm(target.size.depth),outerW,innerW,
    version:4
  };
}
function updateDrawerSystemPreview(){
  const target=drawerTarget(),preview=$('drawerPreview'),status=$('drawerHardwareStatus');
  if(!target){if(preview)preview.textContent='Selecione uma divisão.';return;}
  try{
    const cfg=drawerReadConfig(),p=drawerPreset(cfg.slideType);
    $('drawerResolvedLength').value=`${nice(cfg.resolvedLength)} mm`;
    $('drawerTargetInfo').innerHTML=`<strong>${target.root.name}</strong> · vão L ${nice(cfg.openingW)} × P ${nice(cfg.openingD)} × A ${nice(cfg.openingH)} mm`;
    const freeSpan=cfg.openingH-2*cfg.edgeGap-cfg.boxHeight;
    const step=cfg.count>1?freeSpan/(cfg.count-1):0;
    const frontTxt=cfg.createFronts
      ? `<br><strong>Frentes:</strong> ${cfg.count} × ${nice(cfg.frontW)} × ${nice(cfg.frontThickness)} × ${nice(cfg.frontH)} mm · folgas E ${nice(cfg.frontGapLeft)} / D ${nice(cfg.frontGapRight)} / C ${nice(cfg.frontGapTop)} / B ${nice(cfg.frontGapBottom)} / entre ${nice(cfg.frontGapBetween)} mm`
      : '<br><strong>Frentes:</strong> não criar';
    const grooveSides=[];
    if(cfg.grooveLeft)grooveSides.push('lateral E');
    if(cfg.grooveRight)grooveSides.push('lateral D');
    if(cfg.grooveFront&&!(cfg.bottomCutFront>0))grooveSides.push('contra frente');
    if(cfg.grooveBack&&!(cfg.bottomCutBack>0))grooveSides.push('contra fundo');
    const groovePieces=grooveSides.length;
    const grooveTotal=cfg.count*groovePieces;
    const grooveTxt=cfg.machineBottom
      ? ` · <strong>rasgos automáticos:</strong> ${grooveTotal} total · ${grooveSides.join(' + ')} · ${nice(cfg.bottomThickness+cfg.bottomGrooveClearance)} mm largura × ${nice(cfg.bottomGrooveDepth)} mm profundidade${(cfg.grooveFront&&cfg.bottomCutFront>0)||(cfg.grooveBack&&cfg.bottomCutBack>0)?' · peça recortada não recebe rasgo':''}`
      : ` · <strong style="color:#ffae52">usinagem do fundo desligada</strong>`;
    const autoCutTxt=(cfg.bottomCutFront>0||cfg.bottomCutBack>0)
      ? `<br><strong>Recorte automático:</strong> contra frente ${nice(cfg.bottomCutFront)} mm · contra fundo ${nice(cfg.bottomCutBack)} mm, medidos por baixo até o topo do fundo`
      : '';
    const bottomTxt=`<br><strong>Fundo:</strong> ${nice(cfg.bottomW)} × ${nice(cfg.bottomD)} × ${nice(cfg.bottomThickness)} mm · posição ${nice(cfg.bottomOffset)} mm · passa E ${nice(cfg.bottomPassLeft)} / D ${nice(cfg.bottomPassRight)} / F ${nice(cfg.bottomPassFront)} / T ${nice(cfg.bottomPassBack)} mm${autoCutTxt}${grooveTxt}`;
    preview.innerHTML=`<strong>Caixa externa:</strong> ${nice(cfg.outerW)} × ${nice(cfg.resolvedLength)} × ${nice(cfg.boxHeight)} mm<br><strong>Contra frente/fundo entre laterais:</strong> ${nice(cfg.innerW)} mm · MDF ${nice(cfg.boxThickness)} mm${bottomTxt}${frontTxt}<br><strong>Distribuição:</strong> ${cfg.count} gaveta(s)${!cfg.createFronts&&cfg.count>1?` · passo vertical ${nice(step)} mm`:cfg.createFronts?' · caixas centralizadas atrás das frentes':''}<br><strong>Corrediça:</strong> ${p.name} · ${nice(cfg.resolvedLength)} mm · folga ${nice(cfg.sideClearance)} mm por lado`;
    const left=drawerFindSidePanel(cfg,'left'),right=drawerFindSidePanel(cfg,'right');
    const drillPos=drawerAbsoluteDrillPositions(cfg,p);
    const catCode=drawerCatalogCodeForLength(p,cfg.resolvedLength);
    status.textContent=cfg.createDrilling
      ? `Furação automática: E ${left?'OK':'não encontrada'} · D ${right?'OK':'não encontrada'} · ${cfg.drillAutoByLength&&p.drillByLength?'CATÁLOGO':'manual'} · posições ${drillPos.map(n=>nice(n)).join(' / ')} mm desde a frente${catCode?` · Häfele ${catCode}`:''} · linha ${nice(cfg.drillMountY)} mm · Ø${nice(cfg.drillDiameter)} × ${nice(cfg.drillDepth)} mm.`
      : 'Furação automática desligada.';
  }catch(err){
    $('drawerResolvedLength').value='—';
    preview.innerHTML=`<strong style="color:#ff7169">${err.message||'Confira as medidas'}</strong>`;
    if(status)status.textContent='Ajuste as medidas para calcular.';
  }
}
function updateDrawerBottomMachiningFields(){
  const on=!!$('drawerMachineBottom')?.checked;
  if($('drawerBottomMachiningFields'))$('drawerBottomMachiningFields').style.display=on?'grid':'none';
  if($('drawerBottomMachiningHelp'))$('drawerBottomMachiningHelp').style.display=on?'block':'none';
  updateDrawerSystemPreview();
}
function updateDrawerFrontFields(){
  const on=!!$('drawerCreateFronts')?.checked;
  if($('drawerFrontFields'))$('drawerFrontFields').style.display=on?'block':'none';
  updateDrawerSystemPreview();
}
function openDrawerSystemDialog(source=null){
  if(visualMode)setVisualMode(false,{notify:false,frame:false});

  let existingId=source?.userData?.drawerSetId||selected?.userData?.drawerSetId||null;

  // Se o usuário abriu a ferramenta pelo VÃO, detecta automaticamente se já
  // existe um conjunto de gavetas naquele mesmo vão. Assim "Gavetas /
  // corrediças" vira edição, em vez de criar um segundo conjunto por cima.
  if(!existingId&&selectedSpaceCell){
    existingId=drawerPrimarySetIdForTarget(selectedSpaceCell.rootId,selectedSpaceCell.cellId);
  }

  drawerEditingSetId=existingId;
  let cfg=existingId?drawerConfigFromSet(existingId):null;

  if(cfg){
    drawerTargetRootId=cfg.targetRootId;
    drawerTargetCellId=cfg.targetCellId;
  }else{
    if(!selectedSpaceCell){
      let root=activeSpaceRoot();
      if(!root&&selected)root=rootForObject(selected);
      if(root){
        const cell=largestVisibleCell(root);if(cell)selectSpaceCellByIds(root.id,cell.id);
      }
    }
    if(!selectedSpaceCell){toast('Selecione uma divisão para criar as gavetas');return;}
    drawerTargetRootId=selectedSpaceCell.rootId;
    drawerTargetCellId=selectedSpaceCell.cellId;

    // Segunda chance: o maior vão selecionado automaticamente também pode já
    // possuir gavetas de um projeto antigo.
    existingId=drawerPrimarySetIdForTarget(drawerTargetRootId,drawerTargetCellId);
    if(existingId){
      drawerEditingSetId=existingId;
      cfg=drawerConfigFromSet(existingId);
    }
  }
  const target=drawerTarget();
  if(!target){toast('A divisão original deste conjunto não existe mais');drawerEditingSetId=null;return;}
  const preset=drawerPreset(cfg?.slideType||'telescopic');
  $('drawerSlideType').value=cfg?.slideType||preset.id;
  $('drawerLengthMode').value=cfg?.lengthMode||'auto';
  $('drawerCount').value=cfg?.count??3;
  $('drawerBoxHeight').value=cfg?.boxHeight??120;
  const rootMaterial=spaceDefaultMaterial(target.root);
  $('drawerBoxThickness').value=cfg?.boxThickness??rootMaterial?.thickness??15;
  $('drawerBottomThickness2').value=cfg?.bottomThickness??6;
  $('drawerBottomOffset').value=cfg?.bottomOffset??0;
  $('drawerBottomPassLeft').value=cfg?.bottomPassLeft??0;
  $('drawerBottomPassRight').value=cfg?.bottomPassRight??0;
  $('drawerBottomPassFront').value=cfg?.bottomPassFront??0;
  $('drawerBottomPassBack').value=cfg?.bottomPassBack??0;
  $('drawerMachineBottom').checked=cfg ? !!cfg.machineBottom : true;
  $('drawerBottomGrooveClearance').value=cfg?.bottomGrooveClearance??0.5;
  $('drawerBottomGrooveDepth').value=cfg?.bottomGrooveDepth??6;
  $('drawerGrooveLeft').checked=cfg?.grooveLeft!==false;
  $('drawerGrooveRight').checked=cfg?.grooveRight!==false;
  $('drawerGrooveFront').checked=cfg?.grooveFront===true;
  $('drawerGrooveBack').checked=cfg?.grooveBack===true;
  $('drawerFrontInset').value=cfg?.frontInset??5;
  $('drawerRearClearance').value=cfg?.rearClearance??10;
  $('drawerEdgeGap').value=cfg?.edgeGap??20;
  $('drawerSideClearance').value=cfg?.sideClearance??preset.sideClearance;
  $('drawerCreateFronts').checked=cfg?.createFronts!==false;
  $('drawerFrontThickness').value=cfg?.frontThickness??rootMaterial?.thickness??18;
  $('drawerFrontGapLeft').value=cfg?.frontGapLeft??2;
  $('drawerFrontGapRight').value=cfg?.frontGapRight??2;
  $('drawerFrontGapTop').value=cfg?.frontGapTop??2;
  $('drawerFrontGapBottom').value=cfg?.frontGapBottom??2;
  $('drawerFrontGapBetween').value=cfg?.frontGapBetween??2;
  $('drawerCreateSlides').checked=cfg?.createSlides!==false;
  $('drawerCreateDrilling').checked=cfg?.createDrilling!==false;
  const openDrillPreset=drawerPreset(cfg?.slideType||preset.id);
  const drillDefault=drawerDrillDefaults(openDrillPreset);
  $('drawerDrillFrontRef').value=nice(Number.isFinite(Number(cfg?.drillFrontRef))?Number(cfg.drillFrontRef):drillDefault.frontRef);
  $('drawerDrillOffsets').value=drawerParseDrillOffsets(cfg?.drillOffsets?.length?cfg.drillOffsets:drillDefault.offsets).map(n=>nice(n)).join(', ');
  $('drawerDrillAutoByLength').checked=typeof cfg?.drillAutoByLength==='boolean'
    ? cfg.drillAutoByLength
    : !!openDrillPreset.drillByLength;
  $('drawerDrillMountY').value=nice(Number.isFinite(Number(cfg?.drillMountY))?Number(cfg.drillMountY):drillDefault.mountY);
  $('drawerDrillDiameter').value=nice(Number.isFinite(Number(cfg?.drillDiameter))?Number(cfg.drillDiameter):drillDefault.diameter);
  $('drawerDrillDepth').value=nice(Number.isFinite(Number(cfg?.drillDepth))?Number(cfg.drillDepth):drillDefault.depth);
  $('drawerDialogTitle').textContent=cfg?'▤ Editar gavetas / corrediças':'▤ Gavetas / corrediças';
  $('drawerEditBadge').style.display=cfg?'block':'none';
  $('deleteDrawerSet').style.display=cfg?'block':'none';
  $('confirmDrawerSystem').textContent=cfg?'Atualizar conjunto':'Criar gavetas';
  drawerApplyPresetDefaults(false);
  refreshDrawerSlideLibrarySelect();

  // Se está editando um conjunto existente, já deixa um nome útil pronto.
  // Basta ajustar e tocar em "Salvar configuração".
  if(cfg){
    const typeName=$('drawerSlideType').selectedOptions?.[0]?.textContent?.trim()||cfg.slideName||'Corrediça';
    $('drawerSavedSlideName').value=cfg.savedSlidePresetName||`${typeName} · ${cfg.lengthMode==='auto'?'automática':cfg.lengthMode+' mm'}`;
  }else{
    $('drawerSavedSlideName').value='';
  }

  $('drawerSystemDialog').style.display='flex';
  updateDrawerFrontFields();
  updateDrawerBottomMachiningFields();
  updateDrawerDrillingFields();
}
function drawerReferenceGeometry(cfg){
  const set=drawerSetObjects(cfg.id);
  const leftBoxes=set.filter(o=>o.userData?.drawerRole==='side-left');
  const rightBoxes=set.filter(o=>o.userData?.drawerRole==='side-right');
  const allBoxes=[...leftBoxes,...rightBoxes];
  if(!allBoxes.length)return null;

  let minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const o of allBoxes){
    const b=getBounds(o);
    minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY);
    minZ=Math.min(minZ,b.minZ);maxZ=Math.max(maxZ,b.maxZ);
  }

  const leftOuter=leftBoxes.length?Math.min(...leftBoxes.map(o=>getBounds(o).minX)):null;
  const rightOuter=rightBoxes.length?Math.max(...rightBoxes.map(o=>getBounds(o).maxX)):null;
  return {
    leftInner:Number.isFinite(leftOuter)?leftOuter-m(Number(cfg.sideClearance)||0):null,
    rightInner:Number.isFinite(rightOuter)?rightOuter+m(Number(cfg.sideClearance)||0):null,
    minY,maxY,minZ,maxZ,
    frontZ:maxZ
  };
}
function drawerFindSidePanel(cfg,side){
  const root=getSpaceRoot(cfg.targetRootId);
  if(!root)return null;
  const cell=getSpaceCell(root.id,cfg.targetCellId);
  const ref=drawerReferenceGeometry(cfg);

  // Primeira referência: a geometria REAL da caixa da gaveta.
  // Fallback: limites do espaço antigo.
  const target=side==='left'
    ? (Number.isFinite(ref?.leftInner)?ref.leftInner:cell?.minX)
    : (Number.isFinite(ref?.rightInner)?ref.rightInner:cell?.maxX);
  if(!Number.isFinite(target))return null;

  const y0=Number.isFinite(ref?.minY)?ref.minY:(cell?.minY??-Infinity);
  const y1=Number.isFinite(ref?.maxY)?ref.maxY:(cell?.maxY??Infinity);
  const z0=Number.isFinite(ref?.minZ)?ref.minZ:(cell?.minZ??-Infinity);
  const z1=Number.isFinite(ref?.maxZ)?ref.maxZ:(cell?.maxZ??Infinity);

  let best=null;
  for(const o of objects){
    const u=o.userData;
    if(u?.drawerSetId||u?.kind==='hardware-visual'||u?.kind==='cylinder'||u?.kind==='space-cell')continue;

    // Aceita peças explicitamente ligadas ao móvel OU peças geometricamente
    // dentro do mesmo móvel. Isso cobre projetos antigos/importados.
    const sameRoot=u?.spaceRootId===root.id || rootForObject(o)?.id===root.id;
    if(!sameRoot)continue;

    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!=='x')continue;

    const b=getBounds(o);
    const innerFace=side==='left'?b.maxX:b.minX;
    const gap=Math.abs(innerFace-target);

    // Busca até 80 mm e escolhe SEMPRE a peça mais próxima da face prevista.
    // Isso é só fallback de exportação; a pontuação de sobreposição impede
    // escolher uma lateral distante de outro nicho.
    if(gap>.08)continue;

    const oy=Math.max(0,Math.min(b.maxY,y1)-Math.max(b.minY,y0));
    const oz=Math.max(0,Math.min(b.maxZ,z1)-Math.max(b.minZ,z0));
    if(oy<.02||oz<.08)continue;

    // Precisa estar do lado correto da gaveta.
    if(side==='left'&&innerFace>target+.03)continue;
    if(side==='right'&&innerFace<target-.03)continue;

    const overlapBonus=Math.min(.5,oy)*.02+Math.min(.7,oz)*.02;
    const thicknessPenalty=Math.abs(ti.thickness-18)*.00015;
    const score=gap+thicknessPenalty-overlapBonus;
    if(!best||score<best.score)best={o,score,gap,oy,oz};
  }
  return best?.o||null;
}
function drawerRemoveMachining(setId){
  let n=0;
  for(const o of objects){
    const arr=o.userData?.machining;if(!Array.isArray(arr)||!arr.length)continue;
    const next=arr.filter(op=>op.drawerSetId!==setId);n+=arr.length-next.length;o.userData.machining=next;
  }
  return n;
}

// 1.100.5:
// Ao REFAZER somente a furação das corrediças no gabinete, não podemos usar
// drawerRemoveMachining(), pois os rasgos do fundo também possuem drawerSetId.
// Esta função remove exclusivamente os furos automáticos da corrediça.
function drawerRemoveCabinetDrilling(setId){
  let n=0;
  for(const o of objects){
    const arr=o.userData?.machining;
    if(!Array.isArray(arr)||!arr.length)continue;

    const next=arr.filter(op=>{
      if(op?.drawerSetId!==setId)return true;
      const isAutoSlideDrill =
        op?.drawerAutoDrilling===true ||
        !!op?.drawerSlideType ||
        String(op?.hardwarePresetId||'').startsWith('drawer-');
      return !isAutoSlideDrill;
    });

    n+=arr.length-next.length;
    o.userData.machining=next;
  }
  return n;
}
function removeDrawerSet(setId,{commit=false,keepSelection=false}={}){
  if(!setId)return 0;
  const doomed=objects.filter(o=>o.userData?.drawerSetId===setId);
  removeHardwareLinkedToObjects(doomed);
  drawerRemoveMachining(setId);
  for(const o of doomed){const i=objects.indexOf(o);if(i>=0)objects.splice(i,1);disposeObject(o);}
  if(selected&&doomed.includes(selected)&&!keepSelection)selectObject(null);
  renderMachiningVisuals();if(commit)commitHistory();return doomed.length;
}
function drawerCreatePiece(opts,cfg,role,index,kind='panel',exclude=false){
  const o=createBox({...opts,kind,materialType:kind==='hardware-visual'?'Ferragem':'MDF',baseColor:kind==='hardware-visual'?0x60656b:COLORS.panel,spaceRootId:cfg.targetRootId,drawerSetId:cfg.id,drawerRole:role,drawerIndex:index,drawerConfig:cfg,excludeFromCutList:exclude},false);
  return o;
}
function drawerAddBottomGroove(owner,cfg,index,role){
  if(!cfg.machineBottom||!owner)return 0;
  const ti=pieceThicknessInfo(owner);if(!ti)return 0;
  const width=Math.min(ti.faceH,Math.max(.1,Number(cfg.bottomThickness)+Number(cfg.bottomGrooveClearance||0)));
  const depth=Math.min(ti.thickness,Math.max(.1,Number(cfg.bottomGrooveDepth)||.1));
  const y=Math.max(0,Number(cfg.bottomOffset)||0);
  let lengthAxis=null,entryAxis=null;
  if(role==='side-left'){lengthAxis='z';entryAxis='-x';}
  else if(role==='side-right'){lengthAxis='z';entryAxis='+x';}
  else if(role==='box-front'){lengthAxis='x';entryAxis='+z';}
  else if(role==='box-back'){lengthAxis='x';entryAxis='-z';}
  else return 0;
  if(![ti.uAxis,ti.vAxis].includes(lengthAxis))return 0;
  const op={
    id:uid('mach'),type:'groove',entryAxis,coordRef:{x:0,y,z:0},x:0,y:0,z:0,
    through:false,fullLength:true,autoLength:true,lengthAxis,length:ti.dims[lengthAxis],
    width,depth,preset:'drawer-bottom-groove',drawerSetId:cfg.id,drawerIndex:index,
    drawerMachiningRole:'bottom-groove'
  };
  op.coordRef[lengthAxis]=0;
  Object.assign(op,resolvedMachiningCoords(owner,op));
  (owner.userData.machining||(owner.userData.machining=[])).push(op);
  sanitizeMachiningForPiece(owner);
  return 1;
}
function drawerRemoveBottomGrooves(setId){
  let n=0;
  for(const o of drawerSetObjects(setId)){
    const arr=o.userData?.machining;
    if(!Array.isArray(arr)||!arr.length)continue;
    const next=arr.filter(op=>!(op?.drawerSetId===setId&&op?.preset==='drawer-bottom-groove'));
    n+=arr.length-next.length;
    o.userData.machining=next;
  }
  return n;
}
function drawerExpectedBottomGrooves(cfg){
  if(!cfg?.machineBottom)return 0;
  const count=Math.max(1,Number(cfg.count)||1);
  let perDrawer=0;
  if(cfg.grooveLeft!==false)perDrawer++;
  if(cfg.grooveRight!==false)perDrawer++;
  if(cfg.grooveFront===true&&!(Number(cfg.bottomCutFront)||0))perDrawer++;
  if(cfg.grooveBack===true&&!(Number(cfg.bottomCutBack)||0))perDrawer++;
  return count*perDrawer;
}
function drawerBottomGrooveCount(setId){
  let n=0;
  for(const o of drawerSetObjects(setId)){
    for(const op of (o.userData?.machining||[])){
      if(op?.drawerSetId===setId&&op?.preset==='drawer-bottom-groove')n++;
    }
  }
  return n;
}
function drawerEnsureBottomGroovesForSet(setId){
  const cfg=drawerConfigFromSet(setId);
  if(!cfg?.machineBottom)return {setId,enabled:false,expected:0,created:0,before:drawerBottomGrooveCount(setId)};

  // Normaliza dados de versões anteriores.
  cfg.bottomThickness=Number(cfg.bottomThickness)||6;
  cfg.bottomGrooveClearance=Number.isFinite(Number(cfg.bottomGrooveClearance))?Number(cfg.bottomGrooveClearance):.5;
  cfg.bottomGrooveDepth=Number.isFinite(Number(cfg.bottomGrooveDepth))?Number(cfg.bottomGrooveDepth):6;
  cfg.bottomOffset=Number(cfg.bottomOffset)||0;
  if(typeof cfg.grooveLeft!=='boolean')cfg.grooveLeft=true;
  if(typeof cfg.grooveRight!=='boolean')cfg.grooveRight=true;
  if(typeof cfg.grooveFront!=='boolean')cfg.grooveFront=false;
  if(typeof cfg.grooveBack!=='boolean')cfg.grooveBack=false;

  const bottomTop=Math.max(0,cfg.bottomOffset+cfg.bottomThickness);
  cfg.bottomCutFront=Number(cfg.bottomPassFront||0)>.001?bottomTop:0;
  cfg.bottomCutBack=Number(cfg.bottomPassBack||0)>.001?bottomTop:0;

  const before=drawerBottomGrooveCount(setId);
  drawerRemoveBottomGrooves(setId);

  let created=0;
  for(const o of drawerSetObjects(setId)){
    const role=o.userData?.drawerRole;
    const idx=Number(o.userData?.drawerIndex)||0;

    if(role==='side-left'&&cfg.grooveLeft){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }else if(role==='side-right'&&cfg.grooveRight){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }else if(role==='box-front'&&cfg.grooveFront&&!(cfg.bottomCutFront>0)){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }else if(role==='box-back'&&cfg.grooveBack&&!(cfg.bottomCutBack>0)){
      created+=drawerAddBottomGroove(o,cfg,idx,role);
    }

    // Mantém a configuração atualizada em todas as peças do conjunto.
    o.userData.drawerConfig=JSON.parse(JSON.stringify(cfg));
  }

  const expected=drawerExpectedBottomGrooves(cfg);
  return {setId,enabled:true,expected,created,before};
}
function repairDrawerBottomGroovesForRoot(root){
  if(!root)return {sets:0,expected:0,created:0,repaired:0};
  const ids=new Set();
  for(const o of objects){
    const u=o.userData;
    if(u?.spaceRootId===root.id&&u?.drawerSetId&&u?.drawerConfig?.machineBottom)ids.add(u.drawerSetId);
  }

  let expected=0,created=0,repaired=0;
  for(const id of ids){
    const r=drawerEnsureBottomGroovesForSet(id);
    expected+=r.expected;
    created+=r.created;
    if(r.before!==r.created)repaired++;
  }
  return {sets:ids.size,expected,created,repaired};
}
function repairAllDrawerBottomGrooves(){
  let sets=0,expected=0,created=0,repaired=0;
  for(const root of spaceRoots){
    const r=repairDrawerBottomGroovesForRoot(root);
    sets+=r.sets;expected+=r.expected;created+=r.created;repaired+=r.repaired;
  }
  if(sets)renderMachiningVisuals();
  return {sets,expected,created,repaired};
}

function drawerAddCabinetDrilling(cfg,levels){
  if(!cfg.createDrilling)return {holes:0,left:false,right:false};
  const root=getSpaceRoot(cfg.targetRootId);if(!root)return {holes:0,left:false,right:false};
  const cell=getSpaceCell(root.id,cfg.targetCellId);
  const ref=drawerReferenceGeometry(cfg);
  const p=drawerPreset(cfg.slideType),left=drawerFindSidePanel(cfg,'left'),right=drawerFindSidePanel(cfg,'right');
  let holes=0;

  // A referência longitudinal é a FRENTE DO ARMÁRIO.
  const cabinetFrontZ=cell?mm(cell.maxZ):(Number.isFinite(ref?.frontZ)?mm(ref.frontZ)+Number(cfg.frontInset||0):0);
  const d=drawerDrillDefaults(p);
  const drillMountY=Number.isFinite(Number(cfg.drillMountY))?Number(cfg.drillMountY):d.mountY;
  const drillDiameter=Number.isFinite(Number(cfg.drillDiameter))?Number(cfg.drillDiameter):d.diameter;
  const drillDepth=Number.isFinite(Number(cfg.drillDepth))?Number(cfg.drillDepth):d.depth;
  const drillPositions=drawerAbsoluteDrillPositions(cfg,p);

  // Níveis reais das laterais de gaveta têm prioridade.
  const actualLevels=drawerLevelsFromSet(cfg);
  const useLevels=actualLevels.length?actualLevels:levels;

  for(const [side,owner] of [['left',left],['right',right]]){
    if(!owner)continue;
    const entry=side==='left'?'+x':'-x';
    const ob=objectBoundsMm(owner);
    const x=side==='left'?ob.maxX:ob.minX;

    useLevels.forEach((baseM,idx)=>{
      const y=mm(baseM)+Math.min(Number(cfg.boxHeight||120)-5,drillMountY);
      for(const pos of drillPositions){
        const world={x,y,z:cabinetFrontZ-pos};

        // 2 mm de tolerância tangencial: suficiente para diferenças de
        // arredondamento, sem jogar furo para fora da peça.
        if(!pointWithinPieceTangents(owner,world,'x',2.0))continue;

        const op=hardwareHoleOp(
          owner,world,entry,
          {diameter:drillDiameter,depth:drillDepth},
          {presetId:`drawer-${p.id}`,name:`Corrediça ${p.name}`,role:'contact',contactName:`Gaveta ${idx+1}`},
          cfg.id
        );
        op.drawerSetId=cfg.id;
        op.drawerIndex=idx;
        op.drawerSlideType=p.id;
        op.drawerAutoDrilling=true;
        op.exportAspireFaceHole=true;
        (owner.userData.machining||(owner.userData.machining=[])).push(op);
        holes++;
      }
    });

    sanitizeMachiningForPiece(owner);
  }
  return {holes,left:!!left,right:!!right};
}
function createDrawerSetFromConfig(input,{doHistory=true}={}){
  const cfg=JSON.parse(JSON.stringify(input||{}));
  // Compatibilidade com conjuntos criados na v86: mantém o conjunto antigo
  // funcionando até o usuário abrir "Editar gavetas / corrediças".
  if(!Number.isFinite(Number(cfg.bottomOffset)))cfg.bottomOffset=0;
  if(!Number.isFinite(Number(cfg.bottomPassLeft)))cfg.bottomPassLeft=0;
  if(!Number.isFinite(Number(cfg.bottomPassRight)))cfg.bottomPassRight=0;
  if(!Number.isFinite(Number(cfg.bottomPassFront)))cfg.bottomPassFront=0;
  if(!Number.isFinite(Number(cfg.bottomPassBack)))cfg.bottomPassBack=0;
  if(typeof cfg.machineBottom!=='boolean')cfg.machineBottom=false;
  if(!Number.isFinite(Number(cfg.bottomGrooveClearance)))cfg.bottomGrooveClearance=.5;
  if(!Number.isFinite(Number(cfg.bottomGrooveDepth)))cfg.bottomGrooveDepth=6;
  if(typeof cfg.grooveLeft!=='boolean')cfg.grooveLeft=true;
  if(typeof cfg.grooveRight!=='boolean')cfg.grooveRight=true;
  if(typeof cfg.grooveFront!=='boolean')cfg.grooveFront=false;
  if(typeof cfg.grooveBack!=='boolean')cfg.grooveBack=false;
  if(typeof cfg.createFronts!=='boolean')cfg.createFronts=false;
  if(!Number.isFinite(Number(cfg.frontThickness)))cfg.frontThickness=18;
  if(!Number.isFinite(Number(cfg.frontGapLeft)))cfg.frontGapLeft=2;
  if(!Number.isFinite(Number(cfg.frontGapRight)))cfg.frontGapRight=2;
  if(!Number.isFinite(Number(cfg.frontGapTop)))cfg.frontGapTop=2;
  if(!Number.isFinite(Number(cfg.frontGapBottom)))cfg.frontGapBottom=2;
  if(!Number.isFinite(Number(cfg.frontGapBetween)))cfg.frontGapBetween=2;
  const root=getSpaceRoot(cfg.targetRootId),cell=root&&getSpaceCell(root.id,cfg.targetCellId);
  if(!root||!cell)throw new Error('A divisão original das gavetas não existe mais');
  const preset=drawerPreset(cfg.slideType),s=cellSize(cell);
  {
    const d=drawerDrillDefaults(preset);
    if(!Number.isFinite(Number(cfg.drillFrontRef)))cfg.drillFrontRef=d.frontRef;
    cfg.drillOffsets=drawerParseDrillOffsets(cfg.drillOffsets?.length?cfg.drillOffsets:d.offsets);
    if(!cfg.drillOffsets.length)cfg.drillOffsets=d.offsets;
    if(typeof cfg.drillAutoByLength!=='boolean')cfg.drillAutoByLength=!!preset.drillByLength;
    if(!Number.isFinite(Number(cfg.drillMountY)))cfg.drillMountY=d.mountY;
    if(!Number.isFinite(Number(cfg.drillDiameter)))cfg.drillDiameter=d.diameter;
    if(!Number.isFinite(Number(cfg.drillDepth)))cfg.drillDepth=d.depth;
  }
  // Recalcula ao criar/editar e também quando o móvel muda de tamanho.
  cfg.openingW=mm(s.width);cfg.openingH=mm(s.height);cfg.openingD=mm(s.depth);
  const rr=drawerResolvedLengthMm(cell,preset,cfg.lengthMode,cfg.frontInset,cfg.rearClearance);
  cfg.resolvedLength=rr.length;cfg.availableDepth=rr.available;
  if(cfg.resolvedLength<=0||cfg.resolvedLength>cfg.availableDepth+.001)throw new Error('A corrediça escolhida não cabe mais nesta profundidade');
  cfg.outerW=cfg.openingW-cfg.sideClearance*2;cfg.innerW=cfg.outerW-cfg.boxThickness*2;
  if(cfg.outerW<=cfg.boxThickness*2+10)throw new Error('A caixa não cabe na largura disponível');
  const span=cfg.openingH-2*cfg.edgeGap-cfg.boxHeight;
  if(!cfg.createFronts&&span<-.001)throw new Error('A altura da caixa não cabe no vão');
  const step=!cfg.createFronts&&cfg.count>1?span/(cfg.count-1):0;
  if(!cfg.createFronts&&cfg.count>1&&step<1)throw new Error('As gavetas não cabem na altura informada');
  if(cfg.createFronts){
    const availableFrontH=cfg.openingH-cfg.frontGapTop-cfg.frontGapBottom-cfg.frontGapBetween*(cfg.count-1);
    cfg.frontH=availableFrontH/cfg.count;
    cfg.frontW=cfg.openingW-cfg.frontGapLeft-cfg.frontGapRight;
    if(cfg.frontH<=10||cfg.frontW<=10)throw new Error('As folgas das frentes não cabem no vão');
    if(cfg.boxHeight>cfg.frontH+.001)throw new Error('A caixa é mais alta que a frente calculada');
  }
  cfg.bottomW=cfg.innerW+cfg.bottomPassLeft+cfg.bottomPassRight;
  cfg.bottomD=Math.max(1,cfg.resolvedLength-cfg.boxThickness*2)+cfg.bottomPassFront+cfg.bottomPassBack;

  // Recalcula sempre, inclusive em projetos antigos e após redimensionar o móvel.
  const bottomTopMm=Math.max(0,Number(cfg.bottomOffset||0)+Number(cfg.bottomThickness||0));
  cfg.bottomCutFront=Number(cfg.bottomPassFront||0)>.001?bottomTopMm:0;
  cfg.bottomCutBack=Number(cfg.bottomPassBack||0)>.001?bottomTopMm:0;
  if(cfg.bottomCutFront>=cfg.boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra frente');
  if(cfg.bottomCutBack>=cfg.boxHeight-1)throw new Error('O fundo deixa menos de 1 mm de contra fundo');

  cfg.slideName=preset.name;cfg.name=`${cfg.count} gaveta${cfg.count>1?'s':''} · ${preset.name}`;
  const t=m(cfg.boxThickness),bt=m(cfg.bottomThickness),outerW=m(cfg.outerW),innerW=m(cfg.innerW),len=m(cfg.resolvedLength),sideH=m(cfg.boxHeight);
  const frontZ=cell.maxZ-m(cfg.frontInset),backZ=frontZ-len,zCenter=(frontZ+backZ)/2;
  const leftX=cell.minX+m(cfg.sideClearance)+t/2,rightX=cell.maxX-m(cfg.sideClearance)-t/2;
  const levels=[];
  historyMuted=true;
  try{
    for(let i=0;i<cfg.count;i++){
      let frontYBase=null;
      if(cfg.createFronts)frontYBase=cell.minY+m(cfg.frontGapBottom+i*(cfg.frontH+cfg.frontGapBetween));
      const yBase=cfg.createFronts
        ? frontYBase+m((cfg.frontH-cfg.boxHeight)/2)
        : cell.minY+m(cfg.edgeGap+(cfg.count>1?step*i:span/2));
      levels.push(yBase);
      const sideLeft=drawerCreatePiece({width:t,depth:len,height:sideH,x:leftX,yBase,z:zCenter,name:`G${i+1} · Lateral esquerda`},cfg,'side-left',i);
      const sideRight=drawerCreatePiece({width:t,depth:len,height:sideH,x:rightX,yBase,z:zCenter,name:`G${i+1} · Lateral direita`},cfg,'side-right',i);

      // Se o fundo passa para frente/atrás, a contra frente / contra fundo
      // é encurtada por baixo até o topo do fundo.
      const frontCut=m(cfg.bottomCutFront||0),backCut=m(cfg.bottomCutBack||0);
      const frontH=Math.max(m(.001),sideH-frontCut);
      const backH=Math.max(m(.001),sideH-backCut);

      const boxFront=drawerCreatePiece({
        width:innerW,depth:t,height:frontH,
        x:(leftX+rightX)/2,
        yBase:yBase+frontCut,
        z:frontZ-t/2,
        name:`G${i+1} · Contra frente${frontCut>0?` · corte ${nice(cfg.bottomCutFront)} mm`:''}`
      },cfg,'box-front',i);

      const boxBack=drawerCreatePiece({
        width:innerW,depth:t,height:backH,
        x:(leftX+rightX)/2,
        yBase:yBase+backCut,
        z:backZ+t/2,
        name:`G${i+1} · Contra fundo${backCut>0?` · corte ${nice(cfg.bottomCutBack)} mm`:''}`
      },cfg,'box-back',i);

      if(cfg.machineBottom){
        if(cfg.grooveLeft)drawerAddBottomGroove(sideLeft,cfg,i,'side-left');
        if(cfg.grooveRight)drawerAddBottomGroove(sideRight,cfg,i,'side-right');

        // Contra frente/fundo só recebem rasgo se o usuário marcou.
        // Se houver recorte inferior porque o fundo passa pela peça, o
        // recorte prevalece e o rasgo é ignorado.
        if(cfg.grooveFront&&!(cfg.bottomCutFront>0))drawerAddBottomGroove(boxFront,cfg,i,'box-front');
        if(cfg.grooveBack&&!(cfg.bottomCutBack>0))drawerAddBottomGroove(boxBack,cfg,i,'box-back');
      }
      const bottomBaseDepth=Math.max(m(.001),len-2*t);
      const bottomW=m(cfg.innerW+cfg.bottomPassLeft+cfg.bottomPassRight);
      const bottomDepth=Math.max(m(.001),bottomBaseDepth+m(cfg.bottomPassFront+cfg.bottomPassBack));
      const bottomX=(leftX+rightX)/2+m((cfg.bottomPassRight-cfg.bottomPassLeft)/2);
      const bottomZ=zCenter+m((cfg.bottomPassFront-cfg.bottomPassBack)/2);
      const bottomY=yBase+m(cfg.bottomOffset);
      drawerCreatePiece({width:bottomW,depth:bottomDepth,height:bt,x:bottomX,yBase:bottomY,z:bottomZ,name:`G${i+1} · Fundo ${nice(cfg.bottomThickness)} mm`},cfg,'bottom',i);

      if(cfg.createFronts){
        const fw=m(cfg.frontW),fh=m(cfg.frontH),ft=m(cfg.frontThickness);
        const fx=cell.minX+m(cfg.frontGapLeft)+fw/2;
        const fz=cell.maxZ+ft/2;
        const front=drawerCreatePiece({width:fw,depth:ft,height:fh,x:fx,yBase:frontYBase,z:fz,name:`G${i+1} · Frente externa`},cfg,'drawer-front',i);
        if(root.doorsHidden){front.visible=false;front.userData.hiddenByDoors=true;}
      }

      if(cfg.createSlides){
        const isUnder=cfg.slideType==='undermount';

        // Corrediça oculta: o trilho fica embaixo da caixa e não dentro da
        // folga lateral. Por isso sua largura visual não deve ser limitada
        // aos 21 mm de folga. A referência técnica UM A25 usa ~39 mm na
        // seção inferior; o comprimento físico ocupa NL + 18 mm.
        const railWidthMm=isUnder
          ? Number(preset.railWidth||39)
          : Math.max(2,Math.min(Number(preset.railWidth||10),cfg.sideClearance));
        const railDepthMm=isUnder
          ? Number(cfg.resolvedLength||0)+Number(preset.railExtraLength||0)
          : Number(cfg.resolvedLength||0);

        const rw=m(railWidthMm),rh=m(preset.railHeight),railDepth=m(railDepthMm);
        const railY=isUnder?yBase:yBase+Math.max(0,(sideH-rh)/2);

        const lx=isUnder
          ? cell.minX+rw/2
          : cell.minX+m(cfg.sideClearance/2);
        const rx=isUnder
          ? cell.maxX-rw/2
          : cell.maxX-m(cfg.sideClearance/2);

        const railFrontZ=cfg.slideType==='telescopic'
          ? cell.maxZ-m(Number(preset.railFrontInset||0))
          : cell.maxZ-m(Number(preset.railFrontInset||0));
        const railZ=railFrontZ-railDepth/2;

        drawerCreatePiece({
          width:rw,depth:railDepth,height:rh,x:lx,yBase:railY,z:railZ,
          name:`G${i+1} · Corrediça esquerda ${cfg.resolvedLength}`
        },cfg,'slide-left',i,'hardware-visual',true);

        drawerCreatePiece({
          width:rw,depth:railDepth,height:rh,x:rx,yBase:railY,z:railZ,
          name:`G${i+1} · Corrediça direita ${cfg.resolvedLength}`
        },cfg,'slide-right',i,'hardware-visual',true);
      }
    }
    const drill=drawerAddCabinetDrilling(cfg,levels);
    for(const o of drawerSetObjects(cfg.id))o.userData.drawerConfig=JSON.parse(JSON.stringify(cfg));

    // Garantia final: se "Usinar encaixe do fundo" estiver ligado, as
    // laterais precisam sair daqui já com os rasgos.
    const bottomGrooves=drawerEnsureBottomGroovesForSet(cfg.id);

    sanitizeDrawerSet(cfg.id);
    renderMachiningVisuals();updateInspector();
    historyMuted=false;if(doHistory)commitHistory();
    return {cfg,drill,levels,bottomGrooves};
  }catch(err){historyMuted=false;removeDrawerSet(cfg.id,{commit:false});throw err;}
}
function sanitizeDrawerSet(setId){
  for(const o of drawerSetObjects(setId)){
    if(o.userData.kind==='hardware-visual'){o.userData.excludeFromCutList=true;continue;}
    sanitizeMachiningForPiece(o);
  }
}
function saveDrawerSystem(){
  // Guarda um snapshot para que uma falha durante a troca nunca deixe o
  // móvel sem as gavetas antigas.
  const before=captureState();
  const editingBefore=drawerEditingSetId;
  const targetRootBefore=drawerTargetRootId;
  const targetCellBefore=drawerTargetCellId;

  try{
    const cfg=drawerReadConfig();

    // Em edição, preserva o mesmo ID. Se o diálogo foi aberto pelo espaço,
    // pega automaticamente o set que já pertence ao vão.
    const existingIds=drawerSetIdsForTarget(cfg.targetRootId,cfg.targetCellId);
    const primaryId=editingBefore||existingIds[0]||null;
    if(primaryId)cfg.id=primaryId;

    // REGRA 1.100.3:
    // Um vão possui um único conjunto paramétrico de gavetas. Antes de criar
    // a versão editada, apaga SEMPRE todos os conjuntos antigos desse vão.
    // Isso também limpa duplicatas deixadas por versões anteriores.
    const idsToRemove=new Set(existingIds);
    if(editingBefore)idsToRemove.add(editingBefore);

    let removedObjects=0;
    for(const id of idsToRemove){
      if(!id)continue;
      removedObjects+=removeDrawerSet(id,{commit:false,keepSelection:true});
    }

    // Segurança extra: depois da limpeza, não pode restar nenhum objeto de
    // outro set apontando para o mesmo target.
    const leftovers=drawerSetIdsForTarget(cfg.targetRootId,cfg.targetCellId);
    for(const id of leftovers){
      removedObjects+=removeDrawerSet(id,{commit:false,keepSelection:true});
    }

    const result=createDrawerSetFromConfig(cfg,{doHistory:true});

    // Verificação pós-criação: deve existir exatamente UM set no vão.
    const finalIds=drawerSetIdsForTarget(cfg.targetRootId,cfg.targetCellId);
    if(finalIds.length!==1||finalIds[0]!==cfg.id){
      throw new Error('Falha de consistência ao substituir o conjunto de gavetas');
    }

    $('drawerSystemDialog').style.display='none';
    drawerEditingSetId=null;
    drawerTargetRootId=null;
    drawerTargetCellId=null;

    const d=result.drill;
    const replaced=idsToRemove.size>0||removedObjects>0;
    toast(`${replaced?'Gavetas atualizadas':'Gavetas criadas'} · ${cfg.count} · corrediça ${cfg.resolvedLength} mm · ${d.holes} furo(s) no gabinete`);
  }catch(err){
    // Se qualquer etapa falhar depois da remoção, restaura exatamente o
    // estado anterior. Assim nunca fica conjunto duplicado nem edição pela metade.
    try{
      historyMuted=true;
      applyState(before);
      historyMuted=false;
      drawerEditingSetId=editingBefore;
      drawerTargetRootId=targetRootBefore;
      drawerTargetCellId=targetCellBefore;
    }catch(rollbackErr){
      historyMuted=false;
      console.error('Rollback das gavetas:',rollbackErr);
    }
    toast(err.message||'Não foi possível atualizar as gavetas');
    updateDrawerSystemPreview();
  }
}
function deleteDrawerSystem(){
  if(!drawerEditingSetId)return;
  const cfg=drawerConfigFromSet(drawerEditingSetId);
  if(!window.confirm(`Excluir “${cfg?.name||'conjunto de gavetas'}”?\\n\\nAs furações automáticas deste conjunto também serão removidas.`))return;
  removeDrawerSet(drawerEditingSetId,{commit:true});
  $('drawerSystemDialog').style.display='none';drawerEditingSetId=null;drawerTargetRootId=null;drawerTargetCellId=null;toast('Conjunto removido');
}
function rebuildDrawerSetsForRoot(root){
  if(!root)return;
  const configs=drawerUniqueConfigsForRoot(root.id);if(!configs.length)return;
  for(const cfg of configs){
    if(!getSpaceCell(root.id,cfg.targetCellId))continue;
    removeDrawerSet(cfg.id,{commit:false,keepSelection:true});
    try{createDrawerSetFromConfig(cfg,{doHistory:false});}catch(err){console.warn('Gavetas após redimensionar:',err);}
  }
}

