// DesignLabMoveis 1.311.00 · troca de ferramentas e seletor da Trena.
export function createToolController(ctx){
  const {$,THREE,controls,toast,state}=ctx;
  const runtimeModel=ctx.runtimeModel;
  function tapeMovement(){return ctx.getTapeMovement?.();}
  function ensureTapeModeChooser(){
    let wrap=document.getElementById('tapeModeChooser');
    if(wrap)return wrap;
    wrap=document.createElement('div');
    wrap.id='tapeModeChooser';
    wrap.style.cssText='display:none;position:fixed;inset:0;z-index:140;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.68);backdrop-filter:blur(4px);touch-action:auto;';
    wrap.innerHTML=`<div style="width:min(430px,100%);background:#1b1b1b;border:1px solid #444;border-radius:18px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.55)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px"><div><strong style="display:block;font-size:20px">📏 Trena</strong><span style="display:block;color:#aaa;font-size:12px;margin-top:3px">Como você quer medir?</span></div><button id="tapeModeClose" type="button" style="border:0;background:#303030;color:#fff;width:38px;height:38px;border-radius:11px;font-size:20px">×</button></div>
      <div style="display:grid;gap:10px">
        <button id="tapeModePiece" type="button" style="text-align:left;padding:15px;border-radius:14px;border:1px solid #3d5664;background:#16232b;color:#fff"><b style="display:block;font-size:16px">▣ Medir peça</b><span style="display:block;color:#b8c8d1;font-size:12px;margin-top:4px;line-height:1.35">Como está hoje: toque em uma peça e depois em outra. Mostra a menor distância entre elas.</span></button>
        <button id="tapeModePoint" type="button" style="text-align:left;padding:15px;border-radius:14px;border:1px solid #37634d;background:#14251d;color:#fff"><b style="display:block;font-size:16px">⌖ Medir ponto</b><span style="display:block;color:#b9d6c5;font-size:12px;margin-top:4px;line-height:1.35">Estilo SketchUp: arraste a mira acima do dedo até a quina/aresta/ponto. Entre o 1º e o 2º ponto, use pinça com 2 dedos para aproximar e afastar sem perder a medição.</span></button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const close=()=>{wrap.style.display='none';};
    wrap.querySelector('#tapeModeClose').onclick=close;
    wrap.addEventListener('pointerdown',e=>{if(e.target===wrap)close();});
    wrap.querySelector('#tapeModePiece').onclick=()=>{close();tapeMovement().state.tapeMeasureMode='piece';setTool('tape');};
    wrap.querySelector('#tapeModePoint').onclick=()=>{close();tapeMovement().state.tapeMeasureMode='point';setTool('tape');};
    return wrap;
  }
  function openTapeModeChooser(){
    try{ctx.setToolDockOpen?.(false);}catch{}
    try{ctx.closeQuickDockSubmenu?.();}catch{}
    try{if($('morePanel'))$('morePanel').style.display='none';}catch{}
    const wrap=ensureTapeModeChooser();
    wrap.style.display='flex';
  }
  function setTool(mode){
    if(state.visualMode&&mode!=='select')ctx.setVisualMode(false,{notify:false,frame:false});
    if(mode==='tape'){
      try{ctx.setToolDockOpen?.(false);}catch{}
      try{ctx.closeQuickDockSubmenu?.();}catch{}
      try{if($('morePanel'))$('morePanel').style.display='none';}catch{}
      try{if($('spaceMoreDialog'))$('spaceMoreDialog').style.display='none';}catch{}
    }
    if(mode==='pull')mode='select';
    state.toolMode=mode;
    const pointTapeTouchNav=mode==='tape'&&tapeMovement()?.state?.tapeMeasureMode==='point';
    if(controls?.touches){
      controls.touches.ONE=pointTapeTouchNav?-1:THREE.TOUCH.ROTATE;
      controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
    }
    if(mode!=='tape'){
      state.tapeTouchActive=false;state.tapeTouchId=null;state.tapeMouseActive=false;
      runtimeModel.tapePointTouchPointers.clear();state.tapePointPinchNavigating=false;state.tapePointPinchSuppressUntil=0;
      controls.enabled=true;
      ctx.resetTapeMeasure?.();ctx.hideTapeCrosshair?.();
    }else{
      runtimeModel.tapePointTouchPointers.clear();state.tapePointPinchNavigating=false;state.tapePointPinchSuppressUntil=0;
      controls.enabled=true;
      runtimeModel.tapeCrosshair.style.left=(innerWidth/2)+'px';
      runtimeModel.tapeCrosshair.style.top=(innerHeight/2)+'px';
      runtimeModel.tapeCrosshair.style.display='block';
      runtimeModel.tapeSnapDot.style.display='none';
      ctx.resetTapeMeasure?.();
      runtimeModel.tapeCrosshairLabel.textContent=tapeMovement()?.state?.tapeMeasureMode==='point'?'1º ponto':'1ª peça';
      toast(tapeMovement()?.state?.tapeMeasureMode==='point'?'Trena ponto: mire acima do dedo · pinça com 2 dedos continua liberada':'Trena peça: toque na 1ª peça');
    }
    $('hintText').textContent=mode==='select'?'Selecionar · toque exatamente onde o dedo encostar'
      :mode==='move-free'?'Mover · reconhece quina, guia, aresta e face'
      :(tapeMovement()?.state?.tapeMeasureMode==='point'
        ?'Trena · Medir ponto · 1 dedo mira · 2 dedos dão zoom/pan · encaixe o 1º e depois o 2º ponto'
        :'Trena · Medir peça · toque na 1ª peça e depois na 2ª peça');
    ctx.syncToolDockButtons?.();
  }
  return {ensureTapeModeChooser,openTapeModeChooser,setTool};
}
