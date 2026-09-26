// DesignLabMoveis 1.311.00 · aparência do CAD, visual limpo, sombras, grade e Raio-X.
export const CAD_APPEARANCE_KEYS={
  background:'miniCadProCadBackgroundV2',
  grid:'miniCadProCadGridVisibleV1',
  xray:'miniCadProXray3DV2',
  shadows:'miniCadProShadowsVisibleV1',
  hardware:'designLabCadHardwareVisibleV1',
  machining:'designLabCadMachiningVisibleV1'
};
export function cadBackgroundHex(mode='white'){return mode==='white'?0xf4f4f4:0x171717;}
export function cadFloorHex(mode='white'){return mode==='white'?0xeeeeee:0x202020;}
export function loadCadAppearancePreferences(storage=globalThis.localStorage){
  const p={cadBackgroundMode:'white',cadGridVisible:true,xray3DEnabled:false,cadShadowsVisible:true,cadHardwareVisible:true,cadMachiningVisible:true};
  try{
    const bg=storage.getItem(CAD_APPEARANCE_KEYS.background);if(bg==='white'||bg==='dark')p.cadBackgroundMode=bg;
    const grid=storage.getItem(CAD_APPEARANCE_KEYS.grid);if(grid!==null)p.cadGridVisible=grid==='true';
    const xray=storage.getItem(CAD_APPEARANCE_KEYS.xray);if(xray!==null)p.xray3DEnabled=xray==='1';
    const shadows=storage.getItem(CAD_APPEARANCE_KEYS.shadows);if(shadows!==null)p.cadShadowsVisible=shadows!=='0';
    p.cadHardwareVisible=storage.getItem(CAD_APPEARANCE_KEYS.hardware)!=='0';
    p.cadMachiningVisible=storage.getItem(CAD_APPEARANCE_KEYS.machining)!=='0';
  }catch{}
  return p;
}

export function createCadAppearanceModule(ctx){
  const {$,THREE,state,scene,renderer,dirLight,visualFloor,visualFloorMat,grid,worldAxisX,worldAxisY,worldAxisZ,perspectiveCamera,orthoCamera,controls,COLORS,toast}=ctx;
  const runtimeModel=ctx.runtimeModel;

  function syncCadBackgroundButtons(){
    document.querySelectorAll('[data-cad-bg]').forEach(b=>b.classList.toggle('active',b.dataset.cadBg===state.cadBackgroundMode));
    if($('cadGridVisibleSetting'))$('cadGridVisibleSetting').checked=!!state.cadGridVisible;
    if($('cadGridQuickToggle'))$('cadGridQuickToggle').classList.toggle('active',!!state.cadGridVisible);
  }
  function applyCadGridVisibility(visible,{persist=true,notify=false}={}){
    state.cadGridVisible=!!visible;
    if(grid)grid.visible=state.cadGridVisible&&!state.visualMode;
    if(persist){try{localStorage.setItem(CAD_APPEARANCE_KEYS.grid,String(state.cadGridVisible));}catch{}}
    syncCadBackgroundButtons();
    if(notify)toast(state.cadGridVisible?'Grade do chão ativada':'Grade do chão desativada');
  }
  function applyCadBackground(mode,{persist=true,notify=false}={}){
    state.cadBackgroundMode=mode==='white'?'white':'dark';
    scene?.background?.setHex(cadBackgroundHex(state.cadBackgroundMode));
    if(visualFloorMat?.color){visualFloorMat.color.setHex(cadFloorHex(state.cadBackgroundMode));visualFloorMat.needsUpdate=true;}
    if(grid?.material){grid.material.transparent=true;grid.material.opacity=state.cadBackgroundMode==='white'?.52:.34;grid.material.needsUpdate=true;}
    document.body.dataset.cadBackground=state.cadBackgroundMode;
    syncCadBackgroundButtons();
    if(persist){try{localStorage.setItem(CAD_APPEARANCE_KEYS.background,state.cadBackgroundMode);}catch{}}
    if(notify)toast(state.cadBackgroundMode==='white'?'Fundo do CAD: branco':'Fundo do CAD: escuro');
  }
  function syncCadShadowSetting(){const setting=$('cadShadowsVisibleSetting');if(setting)setting.checked=!!state.cadShadowsVisible;}
  function applyCadShadows(visible,{persist=true,notify=false}={}){
    state.cadShadowsVisible=!!visible;
    if(renderer?.shadowMap)renderer.shadowMap.enabled=state.cadShadowsVisible;
    if(dirLight)dirLight.castShadow=state.cadShadowsVisible;
    if(visualFloor)visualFloor.receiveShadow=state.cadShadowsVisible;
    scene?.traverse?.(o=>{if(o?.isMesh&&o!==visualFloor){o.castShadow=state.cadShadowsVisible;o.receiveShadow=state.cadShadowsVisible;}});
    syncCadShadowSetting();ctx.syncToolDockButtons?.();
    if(persist){try{localStorage.setItem(CAD_APPEARANCE_KEYS.shadows,state.cadShadowsVisible?'1':'0');}catch{}}
    if(notify)toast(state.cadShadowsVisible?'Sombras das peças ativadas':'Sombras das peças desativadas · modo projeto limpo');
  }
  function updateXray3DButton(){
    const b=$('xray3DBtn');
    if(b){b.textContent=state.xray3DEnabled?'◈ Raio-X 3D: ligado':'◇ Raio-X 3D: desligado';b.classList.toggle('active',state.xray3DEnabled);b.classList.toggle('secondary',!state.xray3DEnabled);}
    const setting=$('cadXrayVisibleSetting');if(setting)setting.checked=!!state.xray3DEnabled;
  }
  function xray3DActive(){return state.xray3DEnabled&&!state.visualMode&&!state.viewMode2D&&state.camera===perspectiveCamera;}
  function setPieceVisualEdgesVisible(show=true){
    for(const o of runtimeModel.objects){
      const e=o.userData?.visualEdges;if(!e)continue;
      e.visible=show!==false&&o.visible!==false;
      if(e.material){const xray=xray3DActive();e.material.color.setHex(xray?0x111111:0x2b2f30);e.material.transparent=true;e.material.opacity=xray?.82:.68;e.material.depthTest=!xray;e.material.depthWrite=false;e.material.needsUpdate=true;}
      e.renderOrder=xray3DActive()?88:12;
    }
  }
  function syncCadDetailVisibilityButtons(){
    const hb=$('toggleHardwareVisibilityBtn');if(hb){hb.textContent=state.cadHardwareVisible?'🔩 Ferragens: visíveis':'🔩 Ferragens: ocultas';hb.classList.toggle('active',state.cadHardwareVisible);hb.classList.toggle('secondary',!state.cadHardwareVisible);}
    const mb=$('toggleMachiningVisibilityBtn');if(mb){mb.textContent=state.cadMachiningVisible?'🟣 Usinagens: visíveis':'🟣 Usinagens: ocultas';mb.classList.toggle('active',state.cadMachiningVisible);mb.classList.toggle('secondary',!state.cadMachiningVisible);}
    ctx.syncToolDockButtons?.();
  }
  function applyCadDetailVisibility({persist=false,notify=false}={}){
    if(persist){try{localStorage.setItem(CAD_APPEARANCE_KEYS.hardware,state.cadHardwareVisible?'1':'0');localStorage.setItem(CAD_APPEARANCE_KEYS.machining,state.cadMachiningVisible?'1':'0');}catch{}}
    for(const o of runtimeModel.objects){
      if(o?.userData?.kind!=='hardware-visual')continue;
      if(o.userData?.doorHandleVisual){ctx.updateDoorHandleVisualTransform?.(o);continue;}
      o.visible=!!state.cadHardwareVisible;if(o.userData?.visualEdges)o.userData.visualEdges.visible=!!state.cadHardwareVisible;
    }
    const machiningVisualGroup=runtimeModel.machiningVisualGroup;
    if(machiningVisualGroup)machiningVisualGroup.visible=!!state.cadMachiningVisible&&!state.visualMode&&!state.machiningPreviewActive;
    setPieceVisualEdgesVisible(true);syncCadDetailVisibilityButtons();
    if(notify)toast(`Ferragens ${state.cadHardwareVisible?'visíveis':'ocultas'} · usinagens ${state.cadMachiningVisible?'visíveis':'ocultas'}`);
  }
  function toggleCadHardwareVisibility(){state.cadHardwareVisible=!state.cadHardwareVisible;applyCadDetailVisibility({persist:true,notify:true});}
  function toggleCadMachiningVisibility(){state.cadMachiningVisible=!state.cadMachiningVisible;applyCadDetailVisibility({persist:true,notify:true});}
  function applyVisualSceneState(){
    grid.visible=state.cadGridVisible&&!state.visualMode;
    worldAxisX.visible=!state.visualMode;worldAxisY.visible=!state.visualMode;worldAxisZ.visible=!state.visualMode;
    visualFloor.visible=state.visualMode;
    const machiningVisualGroup=runtimeModel.machiningVisualGroup;if(machiningVisualGroup)machiningVisualGroup.visible=state.cadMachiningVisible&&!state.visualMode&&!state.machiningPreviewActive;
    for(const o of runtimeModel.objects){if(o?.userData?.kind==='hardware-visual'){if(o.userData?.doorHandleVisual)ctx.updateDoorHandleVisualTransform?.(o);else o.visible=!!state.cadHardwareVisible;}}
    const showSpaces=!state.visualMode&&!state.quickSpacesHidden;
    for(const mesh of runtimeModel.spacePickMeshes){mesh.visible=showSpaces;if(mesh.userData?.spaceEdges)mesh.userData.spaceEdges.visible=showSpaces;}
    for(const root of runtimeModel.spaceRoots){if(root.group)root.group.visible=showSpaces;}
    for(const g of runtimeModel.constructionGuides)g.visible=!state.visualMode;
    const guides=ctx.getGuides?.()||{};for(const g of Object.values(guides))if(g)g.visible=false;
    const inference=ctx.getInferenceLines?.();if(inference)Object.values(inference).forEach(l=>l.visible=false);
    setPieceVisualEdgesVisible(true);
    document.body.classList.toggle('visual-mode',state.visualMode);
    const b=$('visualModeBtn');if(b){b.textContent=state.visualMode?'🛠 Projeto':'👁 Visual';b.classList.toggle('active',state.visualMode);b.classList.toggle('secondary',!state.visualMode);}
    const mb=$('visualModeMoreBtn');if(mb)mb.textContent=state.visualMode?'🛠 Voltar ao Projeto':'👁 Visual limpo';
    updateXray3DButton();ctx.syncToolDockButtons?.();
  }
  function visualFurnitureObjects(){
    let root=null;try{root=state.selected?ctx.rootForObject?.(state.selected):null;}catch{}
    if(!root&&state.activeSpaceRootId)root=ctx.getSpaceRoot?.(state.activeSpaceRootId);
    let arr=[];if(root)arr=runtimeModel.objects.filter(o=>o.visible!==false&&(o.userData?.spaceRootId===root.id||ctx.objectInsideSpaceRoot?.(o,root)));
    if(!arr.length)arr=runtimeModel.objects.filter(o=>o.visible!==false);return arr;
  }
  function frameFurnitureVisual(){
    const arr=visualFurnitureObjects();if(!arr.length){toast('Crie ou selecione um móvel');return false;}
    const box=new THREE.Box3();arr.forEach(o=>box.expandByObject(o));if(box.isEmpty())return false;
    const center=box.getCenter(new THREE.Vector3()),sphere=box.getBoundingSphere(new THREE.Sphere());
    const aspect=Math.max(.25,innerWidth/Math.max(1,innerHeight)),vfov=THREE.MathUtils.degToRad(perspectiveCamera.fov),hfov=2*Math.atan(Math.tan(vfov/2)*aspect),minFov=Math.max(.20,Math.min(vfov,hfov));
    const dist=Math.max(.8,(sphere.radius/Math.sin(minFov/2))*1.03);let dir=perspectiveCamera.position.clone().sub(controls.target);if(dir.lengthSq()<1e-6)dir.set(1.25,.85,1.5);dir.normalize();if(Math.abs(dir.y)>.88)dir.set(1.2,.8,1.45).normalize();
    perspectiveCamera.position.copy(center).addScaledVector(dir,dist);perspectiveCamera.up.set(0,1,0);controls.target.copy(center);perspectiveCamera.lookAt(center);perspectiveCamera.near=.001;perspectiveCamera.far=Math.max(1000,dist*20);perspectiveCamera.updateProjectionMatrix();controls.update();ctx.remember3DView?.();return true;
  }
  function setVisualMode(on,{notify=true,frame=true}={}){
    on=!!on;ctx.setDesignLabVisualizationOnly?.(on);if(on===state.visualMode){if(on&&frame)frameFurnitureVisual();return;}
    if(on){
      if(state.viewMode2D||state.camera===orthoCamera)ctx.returnTo3D?.({restore:true,notify:false});
      if(state.selected)ctx.restoreBaseColor?.(state.selected);
      state.visualMode=true;applyVisualSceneState();if(frame)frameFurnitureVisual();
      if($('morePanel'))$('morePanel').style.display='none';if($('inspector'))$('inspector').style.display='none';
      if($('hintText'))$('hintText').textContent=ctx.isDesktopCadNavigation?.()?'Visual limpo · rodinha pressionada: orbitar · Shift + rodinha: mover vista · roda: zoom':'Visual limpo · arraste para girar · pinça para zoom · toque em Projeto para editar';
      if(notify)toast('Modo Visual');
    }else{
      state.visualMode=false;applyVisualSceneState();if(state.selected)ctx.setAllFaces?.(state.selected,COLORS.selected);
      if($('hintText'))$('hintText').textContent=state.toolMode==='select'?'Selecionar · toque exatamente onde o dedo encostar':'Modo Projeto';
      if(notify)toast('Modo Projeto');
    }
  }
  function openAppSettings(){
    $('projectMenuPanel')?.classList.remove('show');ctx.syncDesignLabThemeButtons?.();syncCadBackgroundButtons();updateXray3DButton();syncCadShadowSetting();$('appSettingsDialog')?.classList.add('show');
  }
  function closeAppSettings(){$('appSettingsDialog')?.classList.remove('show');}

  return {syncCadBackgroundButtons,applyCadGridVisibility,applyCadBackground,syncCadShadowSetting,applyCadShadows,openAppSettings,closeAppSettings,syncCadDetailVisibilityButtons,applyCadDetailVisibility,toggleCadHardwareVisibility,toggleCadMachiningVisibility,updateXray3DButton,xray3DActive,setPieceVisualEdgesVisible,applyVisualSceneState,visualFurnitureObjects,frameFurnitureVisual,setVisualMode};
}
