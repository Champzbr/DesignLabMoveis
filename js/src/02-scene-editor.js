// ============================================================================
// 1.100.80 · JANELA DE CONFIGURAÇÃO DA PEÇA FLUTUANTE
// ============================================================================
const PIECE_INSPECTOR_POS_KEY='designLabPieceInspectorPosV1';
function clampPieceInspectorPosition(left,top){
  const panel=$('inspector');if(!panel)return {left,top};
  const r=panel.getBoundingClientRect(),margin=6;
  const w=Math.max(80,r.width||Math.min(370,innerWidth-16));
  const h=Math.max(80,Math.min(r.height||420,innerHeight-margin*2));
  return {
    left:Math.max(margin,Math.min(Math.max(margin,innerWidth-w-margin),Number(left)||margin)),
    top:Math.max(margin,Math.min(Math.max(margin,innerHeight-h-margin),Number(top)||margin))
  };
}
function restorePieceInspectorPosition(clampNow=false){
  const panel=$('inspector');if(!panel)return;
  try{
    const pos=JSON.parse(localStorage.getItem(PIECE_INSPECTOR_POS_KEY)||'null');
    if(!pos||!Number.isFinite(pos.left)||!Number.isFinite(pos.top))return;
    const c=clampNow?clampPieceInspectorPosition(pos.left,pos.top):pos;
    panel.style.left=c.left+'px';panel.style.top=c.top+'px';
    panel.style.right='auto';panel.style.bottom='auto';panel.style.width='min(370px,calc(100vw - 16px))';
  }catch{}
}
function savePieceInspectorPosition(){
  const panel=$('inspector');if(!panel||!elementIsVisible(panel))return;
  const r=panel.getBoundingClientRect();
  try{localStorage.setItem(PIECE_INSPECTOR_POS_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}
}
function initPieceInspectorFloating(){
  const panel=$('inspector'),handle=$('inspectorHeader');if(!panel||!handle)return;
  let drag=null,moved=false;
  handle.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,input,select,textarea'))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const r=panel.getBoundingClientRect();
    drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,sx:e.clientX,sy:e.clientY};moved=false;
    handle.setPointerCapture?.(e.pointerId);e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>2)moved=true;
    const c=clampPieceInspectorPosition(e.clientX-drag.dx,e.clientY-drag.dy);
    panel.style.left=c.left+'px';panel.style.top=c.top+'px';
    panel.style.right='auto';panel.style.bottom='auto';panel.style.width='min(370px,calc(100vw - 16px))';
    e.preventDefault();
  });
  const finish=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    handle.releasePointerCapture?.(e.pointerId);drag=null;
    if(moved)savePieceInspectorPosition();
  };
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  window.addEventListener('resize',()=>{
    if(!elementIsVisible(panel))return;
    const r=panel.getBoundingClientRect(),c=clampPieceInspectorPosition(r.left,r.top);
    panel.style.left=c.left+'px';panel.style.top=c.top+'px';panel.style.right='auto';panel.style.bottom='auto';
    savePieceInspectorPosition();
  });
}

function renderToolDockEditor(){
  const list=$('toolDockEditList'); if(!list)return;
  if(!Array.isArray(toolDockDraft))toolDockDraft=[...toolDockPrefs];
  list.innerHTML='';
  const groups=[...new Set(TOOL_DOCK_CATALOG.map(t=>t.group||'Outros'))];
  for(const group of groups){
    const title=document.createElement('div');title.className='toolEditGroup';title.textContent=group;list.appendChild(title);
    const defs=TOOL_DOCK_CATALOG.filter(t=>(t.group||'Outros')===group);
    for(const def of defs){
      const row=document.createElement('div');row.className='toolEditRow';
      const check=document.createElement('input');check.type='checkbox';check.checked=toolDockDraft.includes(def.key);
      check.addEventListener('change',()=>{
        if(check.checked){ if(!toolDockDraft.includes(def.key))toolDockDraft.push(def.key); }
        else toolDockDraft=toolDockDraft.filter(k=>k!==def.key);
        renderToolDockEditor();
      });
      const meta=document.createElement('div');meta.className='meta';meta.innerHTML=`<b>${def.label}</b><span>${def.desc}</span>`;
      const order=document.createElement('div');order.className='order';
      const idx=toolDockDraft.indexOf(def.key);
      for(const [txt,delta] of [['↑',-1],['↓',1]]){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=txt;b.disabled=idx<0||(delta<0&&idx===0)||(delta>0&&idx===toolDockDraft.length-1);
        b.addEventListener('click',()=>{
          const i=toolDockDraft.indexOf(def.key),j=i+delta;if(i<0||j<0||j>=toolDockDraft.length)return;
          [toolDockDraft[i],toolDockDraft[j]]=[toolDockDraft[j],toolDockDraft[i]];renderToolDockEditor();
        });
        order.appendChild(b);
      }
      row.append(check,meta,order);list.appendChild(row);
    }
  }
}function openToolDockEditor(){
  setToolDockOpen(false);
  toolDockDraft=[...toolDockPrefs];renderToolDockEditor();$('toolDockEditDialog').style.display='flex';
}
function initToolDock(){
  renderToolDock(); restoreToolDockPosition(); initToolDockDrag();
  $('toolDockToggle')?.addEventListener('click',()=>setToolDockOpen(!$('toolDock').classList.contains('open')));
  $('toolDockCollapse')?.addEventListener('click',()=>setToolDockOpen(false));
  $('toolDockEditBtn')?.addEventListener('click',openToolDockEditor);
  $('toolDockEditCancel')?.addEventListener('click',()=>{$('toolDockEditDialog').style.display='none';});
  $('toolDockEditDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('toolDockEditDialog'))$('toolDockEditDialog').style.display='none';});
  // v64: tocar fora do painel recolhe sem bloquear o toque no CAD.
  document.addEventListener('pointerdown',e=>{
    const dock=$('toolDock');
    if(!dock?.classList.contains('open'))return;
    if(dock.contains(e.target))return;
    setToolDockOpen(false);
  },true);
  $('toolDockReset')?.addEventListener('click',()=>{toolDockDraft=[...TOOL_DOCK_DEFAULT];renderToolDockEditor();});
  $('toolDockEditSave')?.addEventListener('click',()=>{
    if(!toolDockDraft.length){toast('Escolha ao menos uma ferramenta');return;}
    toolDockPrefs=[...toolDockDraft];saveToolDockPrefs();renderToolDock();$('toolDockEditDialog').style.display='none';toast('Ferramentas favoritas atualizadas');
  });
  window.addEventListener('resize',()=>{
    const r=$('toolDock')?.getBoundingClientRect();if(!r)return;
    const c=clampToolDockPosition(r.left,r.top);$('toolDock').style.left=c.left+'px';$('toolDock').style.top=c.top+'px';
  });
  setToolDockOpen(false);
}

const container = $('canvas-container');


// ============================================================================
// 1.100.10 · FUNDO DO CAD
// ============================================================================
const CAD_BACKGROUND_KEY='miniCadProCadBackgroundV2';
const CAD_GRID_KEY='miniCadProCadGridVisibleV1';
const XRAY_3D_KEY='miniCadProXray3DV2';

// Padrão tipo SketchUp:
// - fundo branco;
// - grade desligada;
// - Raio-X 3D desligado.
let cadBackgroundMode='white';
let cadGridVisible=false;
let xray3DEnabled=false;

try{
  const saved=localStorage.getItem(CAD_BACKGROUND_KEY);
  if(saved==='white'||saved==='dark')cadBackgroundMode=saved;

  const savedGrid=localStorage.getItem(CAD_GRID_KEY);
  if(savedGrid!==null)cadGridVisible=savedGrid==='true';

  const savedXray=localStorage.getItem(XRAY_3D_KEY);
  if(savedXray!==null)xray3DEnabled=savedXray==='1';
}catch{}

function cadBackgroundHex(mode=cadBackgroundMode){
  return mode==='white'?0xf4f4f4:0x171717;
}
function cadFloorHex(mode=cadBackgroundMode){
  return mode==='white'?0xeeeeee:0x202020;
}
function syncCadBackgroundButtons(){
  document.querySelectorAll('[data-cad-bg]').forEach(b=>{
    b.classList.toggle('active',b.dataset.cadBg===cadBackgroundMode);
  });
  if($('cadGridVisibleSetting'))$('cadGridVisibleSetting').checked=!!cadGridVisible;
}
function applyCadGridVisibility(visible,{persist=true,notify=false}={}){
  cadGridVisible=!!visible;

  // No modo apresentação/visual limpo a grade permanece escondida,
  // independentemente da preferência.
  if(typeof grid!=='undefined'&&grid){
    grid.visible=cadGridVisible&&!visualMode;
  }

  if(persist){
    try{localStorage.setItem(CAD_GRID_KEY,String(cadGridVisible));}catch{}
  }

  syncCadBackgroundButtons();

  if(notify)toast(cadGridVisible?'Grade do chão ativada':'Grade do chão desativada');
}
function applyCadBackground(mode,{persist=true,notify=false}={}){
  cadBackgroundMode=mode==='white'?'white':'dark';

  if(typeof scene!=='undefined'&&scene?.background){
    scene.background.setHex(cadBackgroundHex());
  }
  if(typeof visualFloorMat!=='undefined'&&visualFloorMat?.color){
    visualFloorMat.color.setHex(cadFloorHex());
    visualFloorMat.needsUpdate=true;
  }

  document.body.dataset.cadBackground=cadBackgroundMode;
  syncCadBackgroundButtons();

  if(persist){
    try{localStorage.setItem(CAD_BACKGROUND_KEY,cadBackgroundMode);}catch{}
  }
  if(notify)toast(cadBackgroundMode==='white'?'Fundo do CAD: branco':'Fundo do CAD: escuro');
}
function openAppSettings(){
  $('projectMenuPanel')?.classList.remove('show');
  syncCadBackgroundButtons();
  updateXray3DButton();
  $('appSettingsDialog').classList.add('show');
}
function closeAppSettings(){
  $('appSettingsDialog').classList.remove('show');
}


const scene = new THREE.Scene();
scene.background = new THREE.Color(cadBackgroundHex());

const perspectiveCamera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.001, 1000);
perspectiveCamera.position.set(3.4, 2.8, 4.8);
const orthoCamera = new THREE.OrthographicCamera(-1,1,1,-1,0.001,1000);
let camera = perspectiveCamera;
let viewMode2D = false;
let current2DView = null;
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.style.touchAction='none';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.12));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.28);
dirLight.position.set(4, 8, 5);
dirLight.castShadow=true;
dirLight.shadow.mapSize.set(1024,1024);
dirLight.shadow.camera.left=-8; dirLight.shadow.camera.right=8;
dirLight.shadow.camera.top=8; dirLight.shadow.camera.bottom=-8;
dirLight.shadow.camera.near=.1; dirLight.shadow.camera.far=30;
scene.add(dirLight);
const fillLight=new THREE.DirectionalLight(0xcfe2ff,.34);
fillLight.position.set(-4,3,-5); scene.add(fillLight);

// v65: luz de preenchimento inferior. Em CAD o usuário gira a câmera por baixo
// do móvel com frequência; sem uma fonte vinda de baixo, as faces inferiores
// recebiam apenas a componente escura do HemisphereLight e pareciam pretas.
// Esta luz é propositalmente suave: recupera a cor do MDF sem achatar o volume.
const bottomFillLight=new THREE.DirectionalLight(0xfff4df,.58);
bottomFillLight.position.set(2.5,-5.5,3.5);
bottomFillLight.castShadow=false;
scene.add(bottomFillLight);

// Um ambiente mínimo evita preto absoluto em qualquer orientação extrema da câmera.
const cadAmbientLight=new THREE.AmbientLight(0xffffff,.16);
scene.add(cadAmbientLight);

const visualFloorMat=new THREE.MeshStandardMaterial({color:cadFloorHex(),roughness:.95,metalness:0});
const visualFloor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),visualFloorMat);
visualFloor.rotation.x=-Math.PI/2; visualFloor.position.y=-.004; visualFloor.receiveShadow=true; visualFloor.visible=false; scene.add(visualFloor);

const grid = new THREE.GridHelper(20, 200, 0x555555, 0x262626); // linhas a cada 100 mm
scene.add(grid);
applyCadBackground(cadBackgroundMode,{persist:false});
applyCadGridVisibility(cadGridVisible,{persist:false});

// Eixos globais estilo SketchUp.
// X = vermelho, Y(vertical interno) = azul, Z = amarelo.
// 1.100.18: respeitam o depth buffer. Se uma chapa estiver na frente do eixo,
// o trecho encoberto NÃO atravessa mais o móvel.
function makeWorldAxis(points,color){
  const mat=new THREE.LineBasicMaterial({
    color,
    depthTest:true,
    depthWrite:false,
    transparent:true,
    opacity:.96
  });
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat);
  line.renderOrder=4; scene.add(line); return line;
}
const worldAxisX=makeWorldAxis([new THREE.Vector3(-20,.003,0),new THREE.Vector3(20,.003,0)],0xff3b30);
const worldAxisY=makeWorldAxis([new THREE.Vector3(0,-20,0),new THREE.Vector3(0,20,0)],0x2979ff);
const worldAxisZ=makeWorldAxis([new THREE.Vector3(0,.003,-20),new THREE.Vector3(0,.003,20)],0xffd23f);
worldAxisX.userData.tapeAxis='x';
worldAxisY.userData.tapeAxis='y';
worldAxisZ.userData.tapeAxis='z';
const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);

let visualMode=false;
function updateXray3DButton(){
  const b=$('xray3DBtn');
  if(b){
    b.textContent=xray3DEnabled?'◈ Raio-X 3D: ligado':'◇ Raio-X 3D: desligado';
    b.classList.toggle('active',xray3DEnabled);
    b.classList.toggle('secondary',!xray3DEnabled);
  }
  const setting=$('cadXrayVisibleSetting');
  if(setting)setting.checked=!!xray3DEnabled;
}
function xray3DActive(){ return xray3DEnabled && !visualMode && !viewMode2D && camera===perspectiveCamera; }
function setPieceVisualEdgesVisible(show=true){
  // v58: contorno técnico preto permanece visível em todas as peças físicas.
  // `show=false` ainda é respeitado apenas quando uma rotina precisar esconder explicitamente.
  for(const o of objects){
    const e=o.userData?.visualEdges;
    if(!e)continue;
    e.visible=show!==false && o.visible!==false;
    if(e.material){
      const xray=xray3DActive();
      e.material.color.setHex(0x080808);
      e.material.transparent=true;
      e.material.opacity=xray?.86:.96;
      // v60: no 3D técnico, o contorno ignora o depth buffer. Assim uma
      // prateleira continua legível mesmo atrás de porta/lateral fechada.
      e.material.depthTest=!xray;
      e.material.depthWrite=false;
      e.material.needsUpdate=true;
    }
    e.renderOrder=xray3DActive()?88:12;
  }
}
function applyVisualSceneState(){
  grid.visible=cadGridVisible&&!visualMode;
  worldAxisX.visible=!visualMode; worldAxisY.visible=!visualMode; worldAxisZ.visible=!visualMode;
  visualFloor.visible=visualMode;
  if(typeof machiningVisualGroup!=='undefined') machiningVisualGroup.visible=!visualMode;
  if(typeof spacePickMeshes!=='undefined'){
    for(const mesh of spacePickMeshes){
      mesh.visible=!visualMode;
      if(mesh.userData?.spaceEdges) mesh.userData.spaceEdges.visible=!visualMode;
    }
  }
  if(typeof spaceRoots!=='undefined'){ for(const root of spaceRoots){ if(root.group)root.group.visible=!visualMode; } }
  if(typeof constructionGuides!=='undefined'){ for(const g of constructionGuides)g.visible=!visualMode; }
  if(typeof guideX!=='undefined'){ guideX.visible=false; guideY.visible=false; guideZ.visible=false; }
  if(typeof inferenceLines!=='undefined'){ Object.values(inferenceLines).forEach(l=>l.visible=false); }
  setPieceVisualEdgesVisible(true);
  document.body.classList.toggle('visual-mode',visualMode);
  const b=$('visualModeBtn'); if(b){ b.textContent=visualMode?'🛠 Projeto':'👁 Visual'; b.classList.toggle('active',visualMode); b.classList.toggle('secondary',!visualMode); }
  const mb=$('visualModeMoreBtn'); if(mb)mb.textContent=visualMode?'🛠 Voltar ao Projeto':'👁 Visual limpo';
  updateXray3DButton();
  if(typeof syncToolDockButtons==='function')syncToolDockButtons();
}
function visualFurnitureObjects(){
  let root=null;
  try{ root=selected?rootForObject(selected):null; }catch{}
  if(!root && typeof activeSpaceRootId!=='undefined' && activeSpaceRootId)root=getSpaceRoot(activeSpaceRootId);
  let arr=[];
  if(root){
    arr=objects.filter(o=>o.visible!==false && (o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root)));
  }
  if(!arr.length)arr=objects.filter(o=>o.visible!==false);
  return arr;
}
function frameFurnitureVisual(){
  const arr=visualFurnitureObjects(); if(!arr.length){toast('Crie ou selecione um móvel');return false;}
  const box=new THREE.Box3(); arr.forEach(o=>box.expandByObject(o));
  if(box.isEmpty())return false;
  const center=box.getCenter(new THREE.Vector3());
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  const aspect=Math.max(.25,innerWidth/Math.max(1,innerHeight));
  const vfov=THREE.MathUtils.degToRad(perspectiveCamera.fov);
  const hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
  const minFov=Math.max(.20,Math.min(vfov,hfov));
  const dist=Math.max(.8,(sphere.radius/Math.sin(minFov/2))*1.03);
  let dir=perspectiveCamera.position.clone().sub(controls.target);
  if(dir.lengthSq()<1e-6)dir.set(1.25,.85,1.5);
  dir.normalize();
  if(Math.abs(dir.y)>.88)dir.set(1.2,.8,1.45).normalize();
  perspectiveCamera.position.copy(center).addScaledVector(dir,dist);
  perspectiveCamera.up.set(0,1,0);
  controls.target.copy(center); perspectiveCamera.lookAt(center);
  perspectiveCamera.near=.001; perspectiveCamera.far=Math.max(1000,dist*20); perspectiveCamera.updateProjectionMatrix();
  controls.update(); remember3DView();
  return true;
}
function setVisualMode(on,{notify=true,frame=true}={}){
  on=!!on;
  if(on===visualMode){ if(on&&frame)frameFurnitureVisual(); return; }
  if(on){
    if(viewMode2D||camera===orthoCamera)returnTo3D({restore:true,notify:false});
    if(selected)restoreBaseColor(selected);
    visualMode=true; applyVisualSceneState();
    if(frame)frameFurnitureVisual();
    $('morePanel').style.display='none'; $('inspector').style.display='none';
    $('hintText').textContent=desktopSketchupNavigation
      ? 'Visual limpo · rodinha pressionada: orbitar · Shift + rodinha: mover vista · roda: zoom'
      : 'Visual limpo · arraste para girar · pinça para zoom · toque em Projeto para editar';
    if(notify)toast('Modo Visual');
  }else{
    visualMode=false; applyVisualSceneState();
    if(selected)setAllFaces(selected,COLORS.selected);
    $('hintText').textContent=toolMode==='select'?'Selecionar · toque exatamente onde o dedo encostar':'Modo Projeto';
    if(notify)toast('Modo Projeto');
  }
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .09;
controls.target.set(0,.45,0);
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };


// ============================================================================
// 1.100.14 · NAVEGAÇÃO DE MOUSE NO ESTILO SKETCHUP (SOMENTE PC)
// ----------------------------------------------------------------------------
// Mouse com ponteiro preciso:
// - botão esquerdo: reservado para selecionar/mover/desenhar no CAD;
// - botão do meio (rodinha pressionada) + arrastar: ORBITAR;
// - Shift + botão do meio + arrastar: PAN / deslocar a câmera;
// - girar a rodinha: ZOOM normal do OrbitControls.
//
// Em celulares/tablets com ponteiro coarse o mapeamento NÃO é alterado.
// Os gestos touch continuam exatamente como já estavam.
// ============================================================================
const desktopSketchupNavigation=!!window.matchMedia?.('(pointer:fine)').matches;

function applyDesktopSketchupNavigation(){
  if(!desktopSketchupNavigation)return;

  // OrbitControls r160 interpreta Shift/Ctrl/Meta + ação ROTATE como PAN.
  // Portanto mapear MIDDLE para ROTATE entrega:
  // MIDDLE = órbita
  // SHIFT + MIDDLE = pan
  controls.mouseButtons.LEFT=null;
  controls.mouseButtons.MIDDLE=THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT=null;

  // A roda sem pressionar continua chegando ao evento wheel do OrbitControls
  // e mantém o zoom normal.
  controls.enableRotate=true;
  controls.enablePan=true;
  controls.enableZoom=true;

  // SketchUp responde diretamente ao mouse, sem "rastro" ou inércia.
  // O damping do OrbitControls era o delay percebido no PC.
  controls.enableDamping=false;
  controls.dampingFactor=0;
}

applyDesktopSketchupNavigation();
controls.update();

const last3DView = {
  position: perspectiveCamera.position.clone(),
  up: perspectiveCamera.up.clone(),
  target: controls.target.clone()
};
let cameraSwitching = false;

function remember3DView(){
  if(camera===perspectiveCamera && !viewMode2D){
    last3DView.position.copy(perspectiveCamera.position);
    last3DView.up.copy(perspectiveCamera.up);
    last3DView.target.copy(controls.target);
  }
}
function useCamera(next){
  camera=next;
  controls.object=camera;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  controls.update();
}
function orthographicFrustum(viewW,viewH){
  const aspect=Math.max(.2,innerWidth/Math.max(1,innerHeight));
  const w=Math.max(.05,viewW), h=Math.max(.05,viewH);
  const halfV=Math.max(h/2,w/(2*aspect))*1.12;
  orthoCamera.left=-halfV*aspect; orthoCamera.right=halfV*aspect;
  orthoCamera.top=halfV; orthoCamera.bottom=-halfV;
  orthoCamera.near=.001; orthoCamera.far=1000;
  orthoCamera.zoom=1; orthoCamera.updateProjectionMatrix();
}
// Vista técnica 2D: a peça externa voltada para a câmera fica levemente
// transparente para revelar prateleiras, divisões e ferragens internas.
// Ao voltar ao 3D, todos os materiais retornam exatamente ao estado anterior.
const technical2DFaded = [];
function restoreTechnical2DTransparency(){
  while(technical2DFaded.length){
    const rec=technical2DFaded.pop();
    const mesh=rec.mesh;
    if(!mesh)continue;
    if(rec.renderOrder!=null) mesh.renderOrder=rec.renderOrder;
    const mats=mesh.userData?.faceMaterials||[];
    mats.forEach((mat,i)=>{
      const st=rec.materials[i]; if(!mat||!st)return;
      mat.transparent=st.transparent;
      mat.opacity=st.opacity;
      mat.depthWrite=st.depthWrite;
      mat.depthTest=st.depthTest;
      mat.needsUpdate=true;
    });
    const ve=mesh.userData?.visualEdges;
    if(ve&&rec.edge){
      ve.visible=rec.edge.visible;
      ve.renderOrder=rec.edge.renderOrder ?? 12;
      if(ve.material){
        if(rec.edge.color!=null) ve.material.color.setHex(rec.edge.color);
        ve.material.transparent=rec.edge.transparent;
        ve.material.opacity=rec.edge.opacity;
        ve.material.depthTest=rec.edge.depthTest;
        ve.material.depthWrite=rec.edge.depthWrite;
        ve.material.needsUpdate=true;
      }
    }
  }
}
function objectBelongsToRootFor2D(o,root){
  if(!o||!root||o.visible===false)return false;
  return o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root);
}
function pieceIsCameraCover(o,root,view){
  if(!objectBelongsToRootFor2D(o,root) || o.userData?.kind==='cylinder')return false;
  const b=getBounds(o);
  const rb={
    minX:root.x-root.width/2,maxX:root.x+root.width/2,
    minY:root.yBase,maxY:root.yBase+root.height,
    minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2
  };
  const ti=pieceThicknessInfo(o);
  const tol=.003; // 3 mm para tolerar pequenas folgas/vãos
  if(view==='right') return ti?.axis==='x' && Math.abs(b.maxX-rb.maxX)<=tol;
  if(view==='left')  return ti?.axis==='x' && Math.abs(b.minX-rb.minX)<=tol;
  if(view==='front') return ti?.axis==='z' && Math.abs(b.maxZ-rb.maxZ)<=tol;
  if(view==='back')  return ti?.axis==='z' && Math.abs(b.minZ-rb.minZ)<=tol;
  if(view==='top')   return ti?.axis==='y' && Math.abs(b.maxY-rb.maxY)<=tol;
  if(view==='bottom')return ti?.axis==='y' && Math.abs(b.minY-rb.minY)<=tol;
  return false;
}
function applyTechnical2DTransparency(root,view){
  restoreTechnical2DTransparency();
  if(!root||!view)return;
  // v59: contornos X-Ray. Em vista técnica 2D, as bordas de TODAS as peças
  // do móvel são desenhadas acima da casca externa translúcida. Isso garante
  // que uma prateleira vista de lado/frente continue visível mesmo atrás de
  // lateral, porta, fundo, tampo ou base.
  for(const o of objects){
    if(!objectBelongsToRootFor2D(o,root))continue;
    const mats=o.userData?.faceMaterials||[];
    const ve=o.userData?.visualEdges;
    const rec={mesh:o,renderOrder:o.renderOrder,materials:mats.map(mat=>({
      transparent:mat.transparent,opacity:mat.opacity,depthWrite:mat.depthWrite,depthTest:mat.depthTest
    })),edge:null};
    if(ve){
      rec.edge={
        visible:ve.visible,
        renderOrder:ve.renderOrder,
        color:ve.material?.color?.getHex?.(),
        transparent:ve.material?.transparent,
        opacity:ve.material?.opacity,
        depthTest:ve.material?.depthTest,
        depthWrite:ve.material?.depthWrite
      };
      ve.visible=true;
      ve.renderOrder=95;
      if(ve.material){
        ve.material.color.setHex(0x050505);
        ve.material.transparent=true;
        ve.material.opacity=1;
        ve.material.depthTest=false; // X-Ray: não deixa a peça da frente esconder a prateleira
        ve.material.depthWrite=false;
        ve.material.needsUpdate=true;
      }
    }
    technical2DFaded.push(rec);
  }

  const candidates=objects.filter(o=>pieceIsCameraCover(o,root,view));
  for(const mesh of candidates){
    const mats=mesh.userData?.faceMaterials||[];
    mats.forEach(mat=>{
      mat.transparent=true;
      mat.opacity=.14;      // casca bem leve: mantém referência sem tapar o interior
      mat.depthWrite=false; // não grava profundidade, evitando ocultar linhas internas
      mat.depthTest=true;
      mat.needsUpdate=true;
    });
    mesh.renderOrder=10;
  }
}
function setViewModeBadge(view=null){
  const b=$('viewModeBadge'); if(!b)return;
  if(!viewMode2D){b.style.display='none';return;}
  const names={front:'Frente',back:'Trás',left:'Lateral esq.',right:'Lateral dir.',top:'Cima',bottom:'Baixo'};
  b.textContent=`2D ${names[view]||''} · 3D`; b.style.display='block';
}
function returnTo3D({restore=true,notify=true}={}){
  if(cameraSwitching)return; cameraSwitching=true;
  const was2D=viewMode2D||camera===orthoCamera;
  restoreTechnical2DTransparency();
  viewMode2D=false; current2DView=null;
  perspectiveCamera.aspect=innerWidth/Math.max(1,innerHeight);
  perspectiveCamera.updateProjectionMatrix();
  if(restore){
    perspectiveCamera.position.copy(last3DView.position);
    perspectiveCamera.up.copy(last3DView.up);
    controls.target.copy(last3DView.target);
    perspectiveCamera.lookAt(controls.target);
  }
  useCamera(perspectiveCamera);
  setViewModeBadge(null);
  setPieceVisualEdgesVisible(true);
  updateXray3DButton();
  cameraSwitching=false;
  if(was2D&&notify)toast('Vista 3D');
}
controls.addEventListener('end',()=>{ if(!viewMode2D&&camera===perspectiveCamera) remember3DView(); });

const COLORS = {
  default: 0x2d7dfa,

  // 1.100.12: os volumes de espaço usam laranja/âmbar.
  // No fundo branco esse tom mantém contraste sem competir com os eixos.
  space: 0x46b96b,

  panel: 0xd8c5a4,
  selected: 0xff9d2e,
  highlight: 0x00e5ff,
  snap: 0xff2ea6
};

const objects = [];
// Marcadores visuais das usinagens ficam separados da geometria sólida da peça.
const machiningVisualGroup = new THREE.Group();
machiningVisualGroup.userData.isMachiningVisualGroup=true;
scene.add(machiningVisualGroup);
// Prévia temporária: mostra o volume que será removido ANTES de salvar a usinagem.
const machiningDraftPreviewGroup = new THREE.Group();
machiningDraftPreviewGroup.userData.isMachiningDraftPreviewGroup=true;
scene.add(machiningDraftPreviewGroup);
let machiningPreviewOwner=null;
let machiningPreviewActive=false;
// Espaços são volumes paramétricos separados das peças comuns.
const spaceRoots = [];
const spacePickMeshes = [];
let selectedSpaceCell = null; // {rootId, cellId}
let activeSpaceRootId = null; // mantém o espaço ativo mesmo durante ações do menu
let selected = null;
let toolMode = 'select'; // select | pull | move-free | tape
let dragMode = null;     // planar | free | pull-x | pull-y | pull-z | radius
let dragChanged = false;
let dragStartState = null;
let activePointerId = null;
let downClientX = 0, downClientY = 0, gestureLocked = false;
let dragOffset = new THREE.Vector3();
let anchorCoord = 0, lockedA = 0, lockedB = 0, grabSign = 1;
let pullAxis = 'x';
let dragAxisOrigin = new THREE.Vector3();
const freeMovePlane = new THREE.Plane();
const freeMoveStartPoint = new THREE.Vector3();
const freeMoveCurrentPoint = new THREE.Vector3();
const freeMoveStartPosition = new THREE.Vector3();
const freeMovePlaneNormal = new THREE.Vector3();
const movePickPoint = new THREE.Vector3();
const moveAxisDir = new THREE.Vector3();
let moveInferenceAxis = null; // x | y | z | null
let moveGrabIsCorner = false;
let moveGrabKind = 'face';     // face | edge | corner
let moveCornerTarget = null;
let moveSnapKind = null;       // corner | guide | edge | face | null
let moveSnapText = '';
let movingSpaceRoot = null;
let movingSpaceRootStart = null;
let movingSpaceCellStarts = [];
let movingSpaceObjectStarts = [];
const movingSpaceStartPoint = new THREE.Vector3();
const movingSpaceCurrentPoint = new THREE.Vector3();
const moveDownAim = new THREE.Vector2();
const AXIS_INFERENCE_ANGLE = 17 * Math.PI / 180;
const AXIS_INFERENCE_MIN_PX = 10;
let radiusDir = new THREE.Vector3(1,0,0);
let lastEdit = null;
let history = [], historyIndex = -1, historyMuted = false;
let toastTimer = null;

// Em vista 2D:
// - toque simples continua selecionando normalmente;
// - gesto com 2 dedos (pinça/zoom e pan) PERMANECE no 2D;
// - somente um arrasto real com 1 dedo/mouse volta ao 3D.
// Isso evita que o primeiro dedo da pinça seja interpretado como intenção de orbitar.
let orthoNavGesture=null;
const orthoPointers=new Set();
let orthoMultiTouch=false;
renderer.domElement.addEventListener('pointerdown',e=>{
  orthoPointers.add(e.pointerId);
  if(!viewMode2D||toolMode!=='select')return;
  if(orthoPointers.size>=2){
    orthoMultiTouch=true;
    orthoNavGesture=null;
    return;
  }
  if(e.isPrimary!==false){
    orthoMultiTouch=false;
    orthoNavGesture={id:e.pointerId,x:e.clientX,y:e.clientY};
  }
},{passive:true});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!viewMode2D||toolMode!=='select')return;
  // Durante pinça/zoom ou pan com 2 dedos nunca abandonar a vista ortográfica.
  if(orthoMultiTouch||orthoPointers.size>1)return;
  if(!orthoNavGesture||e.pointerId!==orthoNavGesture.id)return;
  if(Math.hypot(e.clientX-orthoNavGesture.x,e.clientY-orthoNavGesture.y)>12){
    orthoNavGesture=null;
    returnTo3D({restore:true,notify:true});
  }
},{passive:true});
function clearOrthoPointer(e){
  if(e)orthoPointers.delete(e.pointerId);
  if(!e||!orthoNavGesture||e.pointerId===orthoNavGesture.id)orthoNavGesture=null;
  // Depois de uma pinça, só permitimos voltar ao 3D em um NOVO gesto de 1 dedo.
  if(orthoPointers.size===0)orthoMultiTouch=false;
}
renderer.domElement.addEventListener('pointerup',clearOrthoPointer,{passive:true});
renderer.domElement.addEventListener('pointercancel',clearOrthoPointer,{passive:true});
renderer.domElement.addEventListener('lostpointercapture',clearOrthoPointer,{passive:true});

// ---------- Trena / guias de construção ----------
const constructionGuides = [];
let tapeStart = null;
let tapeStartClient = null;
let tapePointerMoved = false;
let tapeLastTap = { time:0, x:0, y:0 };
let tapeHover = null;
let tapeEdgeSource = null;     // aresta usada para criar guia paralela
let tapePendingEdge = null;    // aresta candidata no pointerdown
let tapeDragEdgeActive = false;
let tapeTouchActive = false;
let tapeTouchId = null;
let tapeTouchStartX = 0, tapeTouchStartY = 0;
let tapeLastClientX = 0, tapeLastClientY = 0;
let tapeMouseActive = false;
let tapeAim = null; // último alvo reconhecido pela Trena
// Uma única porta de entrada para confirmar toques da Trena. PointerEvent e
// TouchEvent podem representar o MESMO dedo no Android, então deduplicamos aqui.
let tapeConfirmGate = { time:0, x:-9999, y:-9999 };
let tapeLastConfirmedTap = { time:0, x:-9999, y:-9999, key:'' };

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const liveLabel = $('liveLabel');
const measureBadge = $('measureBadge');
const tapeCrosshair = $('tapeCrosshair');
const tapeCrosshairLabel = $('tapeCrosshairLabel');
const tapeSnapDot = $('tapeSnapDot');

function roundMmNumber(v,digits=3){
  const n=Number(v); if(!Number.isFinite(n)) return 0;
  const p=10**digits; return Math.round((n+Number.EPSILON)*p)/p;
}
// mm() continua retornando número (para inputs/cálculos), mas não destrói .5/.25 etc.
function mm(v){ return roundMmNumber(Number(v) * M_TO_MM,3); }
function m(v){ return Number(v) * MM_TO_M; }
function clampSize(v){ return THREE.MathUtils.clamp(v, MIN_SIZE, MAX_SIZE); }
// Texto de medidas em pt-BR: 22,5 em vez de 23; sem zeros desnecessários.
function nice(v){
  const n=roundMmNumber(v,3);
  return String(n).replace('.',',');
}

function toast(text){
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$('toast').classList.remove('show'), 1500);
}


