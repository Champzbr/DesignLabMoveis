// DesignLabMoveis 1.311.00 · Barra de ferramentas, barra rápida e painéis flutuantes.
export function createToolDockModule(ctx){
  const {
    $, state, activeSpaceRoot, applyCadShadows, applyCutSpacePrefs, applySelectedSpaceCut, applyTechnical2DTransparency,
    cutSideName, cutSpaceCountValue, deleteSelected, deleteSelectedSpaceRoot, duplicateSelected, elementIsVisible,
    exportProjectAspireZip, exportSelectedAspireDxf, exportSelectedFurniture, largestVisibleCell, m,
    openCopyHardwareTool, openCopyShapeTool, openCurvedStructureDialog, openDeleteSelectedSpaceCellDialog, openDoorSystemDialog,
    openDrawerSystemDialog, openEditSpaceDialog, openLabelsDialog, openMachiningDialog, openNewSpaceDialog, openPartsListDialog,
    openProductionDialog, openShapeDialog, openSlattedPanelDialog, openSpaceFromObject, openTapeModeChooser, openTechnicalLayoutDialog,
    parseDecimalInput, quickCreatePieceFromTypeButton, redo, returnTo3D, selectPieceCreateTypeButton, selectSpaceCellByIds,
    setFrontWorldView, setPieceVisualEdgesVisible, setTool, setVisualMode, showAllHiddenSpaces, toast,
    toggleActiveSpaceVisibility, toggleCadHardwareVisibility, toggleCadMachiningVisibility, toggleDoorsForActiveSpace, undo,
    updateCutPreview, updateSpaceSelectionVisuals, updateXray3DButton, viewSpace, worldAxisX, worldAxisY, worldAxisZ, XRAY_3D_KEY
  }=ctx;
  const runtimeModel=ctx.runtimeModel;

const TOOL_DOCK_PREFS_KEY='miniCadToolDockPrefsV62';
const TOOL_DOCK_LEGACY_PREFS_KEY='miniCadToolDockPrefsV61';
const TOOL_DOCK_POS_KEY='miniCadToolDockPosV61';
const TOOL_DOCK_DEFAULT=['space','select','move','tape','parts','materials','labels','layout','machining','toggleHardwareVisibility','toggleMachiningVisibility','toggleShadows','visual','more'];
const TOOL_DOCK_CATALOG=[
  // Projeto / navegação
  {group:'Projeto',key:'space',label:'＋ Espaço',desc:'Criar outro espaço'},
  {group:'Projeto',key:'select',label:'Selecionar',desc:'Selecionar peças e espaços'},
  {group:'Projeto',key:'move',label:'✥ Mover',desc:'Mover com snap e inferências'},
  {group:'Projeto',key:'tape',label:'📏 Trena',desc:'Medir entre peças ou entre pontos/quinas'},
  {group:'Projeto',key:'parts',label:'📋 Peças gerais',desc:'Lista geral e cálculo de chapas'},
  {group:'Projeto',key:'materials',label:'🎨 Materiais / fitas',desc:'Materiais do projeto e fita de borda'},
  {group:'Projeto',key:'labels',label:'🏷 Etiquetas',desc:'Visualizar e imprimir etiquetas das peças'},
  {group:'Projeto',key:'layout',label:'📐 Gerar layout',desc:'Frente, planta, laterais, cortes, cotas e exportação PDF/DXF'},
  {group:'Projeto',key:'visual',label:'👁 Visual',desc:'Alternar Projeto / Visual'},
  {group:'Projeto',key:'toggleShadows',label:'☀ Sombras',desc:'Ligar ou desligar as sombras projetadas no móvel e no chão'},
  {group:'Projeto',key:'xray',label:'◈ Raio-X 3D',desc:'Mostrar contornos internos através das chapas'},
  {group:'Projeto',key:'toggleHardwareVisibility',label:'🔩 Ocultar / mostrar ferragens',desc:'Esconder ou exibir corrediças e outras ferragens visuais sem apagar nada'},
  {group:'Projeto',key:'toggleMachiningVisibility',label:'🟣 Ocultar / mostrar usinagens',desc:'Esconder ou exibir os marcadores de furos e rasgos sem apagar as operações'},
  {group:'Projeto',key:'view3d',label:'◇ Vista 3D',desc:'Voltar à perspectiva 3D'},
  {group:'Projeto',key:'undo',label:'↶ Desfazer',desc:'Voltar uma alteração'},
  {group:'Projeto',key:'redo',label:'↷ Refazer',desc:'Refazer alteração'},

  // Peça / usinagem
  {group:'Peça / Usinagem',key:'inspector',label:'📐 Medidas / posição',desc:'Editar medidas da peça selecionada'},
  {group:'Peça / Usinagem',key:'openSpace',label:'▣ Abrir espaço do móvel',desc:'Abrir o espaço ligado à peça'},
  {group:'Peça / Usinagem',key:'hole',label:'● Furo',desc:'Criar furo na peça selecionada'},
  {group:'Peça / Usinagem',key:'groove',label:'▱ Rasgo',desc:'Criar rasgo na peça selecionada'},
  {group:'Peça / Usinagem',key:'hardware',label:'⚙ Ferragens',desc:'Aplicar/criar ferragens inteligentes'},
  {group:'Peça / Usinagem',key:'copyHardware',label:'⧉ Copiar Ferragens',desc:'Copiar todas as ferragens de uma peça para várias peças em lote'},
  {group:'Peça / Usinagem',key:'shape',label:'◜ Forma',desc:'Alterar o contorno externo da peça'},
  {group:'Peça / Usinagem',key:'slattedPanel',label:'▥ Painel ripado',desc:'Transformar a peça selecionada em ripados com largura e vão configuráveis'},
  {group:'Peça / Usinagem',key:'copyShape',label:'⧉ Copiar Forma',desc:'Copiar a Forma de uma peça para várias peças de uma vez'},
  {group:'Peça / Usinagem',key:'machining',label:'🛠 Usinagens',desc:'Abrir lista e editor de usinagens'},
  {group:'Peça / Usinagem',key:'duplicate',label:'⧉ Duplicar peça',desc:'Duplicar a peça selecionada'},
  {group:'Peça / Usinagem',key:'deleteSelected',label:'🗑 Excluir peça',desc:'Excluir a peça selecionada'},

  // Espaço / móvel
  {group:'Espaço / Móvel',key:'cutSpace',label:'✂ Corte',desc:'Cortar a divisão selecionada'},
  {group:'Espaço / Móvel',key:'createPieces',label:'▰ Criar peças',desc:'Criar laterais, base, prateleiras, portas etc.'},
  {group:'Espaço / Móvel',key:'drawers',label:'▤ Gavetas / corrediças',desc:'Criar gavetas paramétricas com corrediças e furação automática'},
  {group:'Espaço / Móvel',key:'curvedStructure',label:'◒ Móvel curvo',desc:'Criar estrutura curva dentro do espaço selecionado'},
  {group:'Espaço / Móvel',key:'library',label:'▦ Biblioteca',desc:'Abrir biblioteca de modelos por pastas'},
  {group:'Espaço / Móvel',key:'doorSystem',label:'🚪 Sistema de portas',desc:'Biblioteca paramétrica de portas completas'},
  {group:'Espaço / Móvel',key:'editSpace',label:'✎ Editar espaço',desc:'Alterar tamanho do móvel sem apagar peças'},
  {group:'Espaço / Móvel',key:'adjacentSpace',label:'＋ Outro espaço',desc:'Criar espaço relativo ao móvel atual'},
  {group:'Espaço / Móvel',key:'toggleSpace',label:'◫ Ocultar divisão',desc:'Ocultar a divisão selecionada'},
  {group:'Espaço / Móvel',key:'toggleDoors',label:'▥ Ocultar / mostrar portas',desc:'Alternar visibilidade das portas'},
  {group:'Espaço / Móvel',key:'showHiddenSpaces',label:'◩ Mostrar divisões ocultas',desc:'Reexibir todas as divisões ocultas'},
  {group:'Espaço / Móvel',key:'exportFurniture',label:'⇩ Exportar móvel STL',desc:'Exportar o modelo 3D completo em STL'},
  {group:'Espaço / Móvel',key:'aspireFurniture',label:'DXF Aspire · móvel',desc:'Gerar Aspire ZIP do móvel selecionado'},
  {group:'Espaço / Móvel',key:'aspireProject',label:'DXF Aspire · projeto',desc:'Gerar todas as chapas do projeto inteiro'},
  {group:'Espaço / Móvel',key:'deleteSpace',label:'🗑 Excluir espaço',desc:'Excluir o móvel/espaço selecionado'},

  // Vistas técnicas
  {group:'Vistas',key:'front',label:'Vista frontal',desc:'Vista 2D frontal'},
  {group:'Vistas',key:'back',label:'Vista traseira',desc:'Vista 2D traseira'},
  {group:'Vistas',key:'left',label:'Vista lateral esq.',desc:'Vista 2D lateral esquerda'},
  {group:'Vistas',key:'right',label:'Vista lateral dir.',desc:'Vista 2D lateral direita'},
  {group:'Vistas',key:'top',label:'Vista de cima',desc:'Vista 2D superior'},
  {group:'Vistas',key:'bottom',label:'Vista de baixo',desc:'Vista 2D inferior'},

  // Arquivo / manutenção
  {group:'Arquivo / Manutenção',key:'save',label:'💾 Salvar',desc:'Salvar projeto atual e atualizar a miniatura'},
  {group:'Arquivo / Manutenção',key:'load',label:'📂 Projetos',desc:'Voltar à tela inicial e abrir outro projeto'},
  {group:'Arquivo / Manutenção',key:'exportProject',label:'⇩ Exportar .mcad',desc:'Baixar uma cópia portátil do projeto'},
  {group:'Arquivo / Manutenção',key:'importProject',label:'⇧ Abrir arquivo',desc:'Abrir arquivo .mcad ou JSON antigo'},
  {group:'Arquivo / Manutenção',key:'importFurniture',label:'⇧ Importar móvel',desc:'Adicionar um móvel exportado ao projeto'},
  {group:'Arquivo / Manutenção',key:'clearGuides',label:'⌫ Limpar guias',desc:'Remover todas as guias da Trena'},
  {group:'Arquivo / Manutenção',key:'clearProject',label:'⚠ Limpar projeto',desc:'Apagar todo o projeto atual'},
  {group:'Arquivo / Manutenção',key:'more',label:'Mais ⋯',desc:'Abrir o menu completo original'}
];
let toolDockPrefs=loadToolDockPrefs();
let toolDockDraft=null;

function loadToolDockPrefs(){
  try{
    const stored=localStorage.getItem(TOOL_DOCK_PREFS_KEY) || localStorage.getItem(TOOL_DOCK_LEGACY_PREFS_KEY);
    const raw=JSON.parse(stored||'null');
    if(Array.isArray(raw)){
      const valid=raw.filter(k=>TOOL_DOCK_CATALOG.some(t=>t.key===k));
      // v62: inclui Usinagens na migração caso o usuário ainda esteja com o conjunto padrão antigo.
      if(valid.length){
        if(!valid.includes('machining') && valid.includes('more')) valid.splice(Math.max(0,valid.indexOf('more')),0,'machining');
        if(!valid.includes('layout')) valid.splice(Math.max(0,valid.indexOf('machining')>=0?valid.indexOf('machining'):valid.indexOf('more')),0,'layout');
        if(!valid.includes('curvedStructure')) valid.splice(Math.min(valid.length,Math.max(1,valid.indexOf('space')+1)),0,'curvedStructure');
        if(!valid.includes('drawers')) valid.splice(Math.min(valid.length,Math.max(1,valid.indexOf('curvedStructure'))),0,'drawers');
        // 1.200.42: os dois controles de limpeza visual entram automaticamente no painel existente.
        const visualAt=valid.indexOf('visual')>=0?valid.indexOf('visual'):Math.max(0,valid.indexOf('more'));
        if(!valid.includes('toggleHardwareVisibility'))valid.splice(visualAt>=0?visualAt:valid.length,0,'toggleHardwareVisibility');
        const visualAt2=valid.indexOf('visual')>=0?valid.indexOf('visual'):Math.max(0,valid.indexOf('more'));
        if(!valid.includes('toggleMachiningVisibility'))valid.splice(visualAt2>=0?visualAt2:valid.length,0,'toggleMachiningVisibility');
        // 1.300.35: Sombras aparece no painel mesmo para usuários que já tinham uma barra personalizada salva.
        const visualAt3=valid.indexOf('visual')>=0?valid.indexOf('visual'):Math.max(0,valid.indexOf('more'));
        if(!valid.includes('toggleShadows'))valid.splice(visualAt3>=0?visualAt3:valid.length,0,'toggleShadows');
        return valid;
      }
    }
  }catch{}
  return [...TOOL_DOCK_DEFAULT];
}
function saveToolDockPrefs(){
  try{localStorage.setItem(TOOL_DOCK_PREFS_KEY,JSON.stringify(toolDockPrefs));}catch{}
}
function toolDockDef(key){return TOOL_DOCK_CATALOG.find(t=>t.key===key)||null;}
function toolDockLabel(key){
  if(key==='visual')return state.visualMode?'🛠 Projeto':'👁 Visual';
  if(key==='toggleShadows')return state.cadShadowsVisible?'☀ Sombras: ligadas':'☀ Sombras: desligadas';
  if(key==='xray')return state.xray3DEnabled?'◈ Raio-X: ligado':'◈ Raio-X: desligado';
  if(key==='toggleHardwareVisibility')return state.cadHardwareVisible?'🔩 Ferragens: visíveis':'🔩 Ferragens: ocultas';
  if(key==='toggleMachiningVisibility')return state.cadMachiningVisible?'🟣 Usinagens: visíveis':'🟣 Usinagens: ocultas';
  return toolDockDef(key)?.label||key;
}
function syncToolDockButtons(){
  document.querySelectorAll('#toolDockTools [data-dock-tool]').forEach(b=>{
    const key=b.dataset.dockTool;
    b.textContent=toolDockLabel(key);
    const active=(key==='select'&&state.toolMode==='select')||(key==='move'&&state.toolMode==='move-free')||(key==='tape'&&state.toolMode==='tape')||(key==='visual'&&state.visualMode)||(key==='xray'&&state.xray3DEnabled)||(key==='toggleHardwareVisibility'&&state.cadHardwareVisible)||(key==='toggleMachiningVisibility'&&state.cadMachiningVisible)||(key==='toggleShadows'&&state.cadShadowsVisible);
    b.classList.toggle('active',active);
    b.classList.toggle('secondary',!active);
  });
  syncQuickDockButtons();
}
function renderToolDock(){
  const box=$('toolDockTools'); if(!box)return;
  box.innerHTML='';
  for(const key of toolDockPrefs){
    const def=toolDockDef(key); if(!def)continue;
    const b=document.createElement('button');
    b.type='button'; b.dataset.dockTool=key; b.className='secondary'; b.textContent=toolDockLabel(key);
    b.addEventListener('click',()=>runDockTool(key));
    box.appendChild(b);
  }
  syncToolDockButtons();
}
function toggleMorePanel(){
  const panel=$('morePanel'); if(!panel)return;
  const show=panel.style.display!=='block';
  panel.style.display=show?'block':'none';
  if(show){
    const ok=!!state.selected&&state.selected.userData?.kind!=='cylinder';
    for(const id of ['addHoleBtn','addGrooveBtn','addHardwareBtn','addShapeBtn','manageMachiningBtn']){
      const el=$(id); if(el)el.disabled=!ok;
    }
    const mmgr=$('manageMachiningBtn');
    if(mmgr)mmgr.textContent=ok&&state.selected.userData?.machining?.length?`Usinagens (${state.selected.userData.machining.length})`:'Usinagens';
  }
}
function applyXray3D(enabled,{persist=true,notify=false}={}){
  state.xray3DEnabled=!!enabled;

  if(persist){
    try{localStorage.setItem(XRAY_3D_KEY,state.xray3DEnabled?'1':'0');}catch{}
  }

  if(state.viewMode2D){
    // As vistas técnicas 2D continuam com seu próprio X-Ray interno.
    // A opção abaixo controla principalmente o 3D em perspectiva.
    const root=activeSpaceRoot();
    applyTechnical2DTransparency(root,state.current2DView||'front');
  }else{
    // DESLIGADO: depthTest normal -> o que estiver atrás da chapa some.
    // LIGADO: linhas ignoram o depth buffer -> todos os contornos aparecem.
    setPieceVisualEdgesVisible(true);
  }

  // Eixos globais nunca atravessam o móvel. O Raio-X é reservado para
  // contornos técnicos das peças, não para os eixos XYZ.
  for(const axis of [worldAxisX,worldAxisY,worldAxisZ]){
    if(axis?.material){
      axis.material.depthTest=true;
      axis.material.depthWrite=false;
      axis.material.needsUpdate=true;
    }
  }
  updateSpaceSelectionVisuals();
  updateXray3DButton();
  syncToolDockButtons();

  if(notify){
    toast(state.xray3DEnabled
      ? 'Raio-X 3D ligado · contornos internos visíveis'
      : 'Visual sólido · linhas internas ocultas');
  }
}
function toggleDockXray(){
  applyXray3D(!state.xray3DEnabled,{persist:true,notify:true});
}
function dockEnsurePiece(){
  if(!state.selected){toast('Selecione uma peça primeiro');return false;}
  return true;
}
function dockEnsureSpace(needsCell=false){
  let root=activeSpaceRoot();
  if(!root && state.selected){openSpaceFromObject(state.selected);root=activeSpaceRoot();}
  if(!root){toast('Selecione um espaço ou uma peça do móvel');return false;}
  if(needsCell && !state.selectedSpaceCell){
    const cell=largestVisibleCell(root);
    if(cell)selectSpaceCellByIds(root.id,cell.id);
  }
  if(needsCell && !state.selectedSpaceCell){toast('Este móvel não tem divisão livre para esta ferramenta');return false;}
  return true;
}
function dockClick(id){const el=$(id);if(!el){toast('Ferramenta indisponível');return false;}el.click();return true;}
function dockView(view){if(!dockEnsureSpace(false))return;const root=activeSpaceRoot();if(root)viewSpace(root,view);}
// v64: o painel flutuante fecha sempre que uma ação abrir outra janela/menu.
// Ferramentas de alternância permanecem abertas para permitir ligar/desligar rapidamente.
function closeToolDockBeforeMenu(){
  setToolDockOpen(false);
}
function runDockTool(key){
  if(key==='space'){ if(state.visualMode)setVisualMode(false,{notify:false,frame:false}); closeToolDockBeforeMenu(); openNewSpaceDialog(activeSpaceRoot()||runtimeModel.spaceRoots.at(-1)||null); }
  else if(key==='select')setTool('select');
  else if(key==='move')setTool('move-free');
  else if(key==='tape')openTapeModeChooser();
  else if(key==='parts'){closeToolDockBeforeMenu();openPartsListDialog();}
  else if(key==='materials'){closeToolDockBeforeMenu();openProductionDialog();}
  else if(key==='labels'){closeToolDockBeforeMenu();openLabelsDialog();}
  else if(key==='layout'){closeToolDockBeforeMenu();openTechnicalLayoutDialog();}
  else if(key==='visual')setVisualMode(!state.visualMode,{frame:true});
  else if(key==='toggleShadows')applyCadShadows(!state.cadShadowsVisible,{persist:true,notify:true});
  else if(key==='xray')toggleDockXray();
  else if(key==='toggleHardwareVisibility')toggleCadHardwareVisibility();
  else if(key==='toggleMachiningVisibility')toggleCadMachiningVisibility();
  else if(key==='view3d'){returnTo3D({restore:true,notify:false});setFrontWorldView();toast('Vista 3D');}
  else if(key==='undo')undo();
  else if(key==='redo')redo();

  else if(key==='inspector'){if(dockEnsurePiece()){closeToolDockBeforeMenu();dockClick('showInspectorBtn');}}
  else if(key==='openSpace'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openSpaceFromObject(state.selected);}}
  else if(key==='hole'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog('hole');}}
  else if(key==='groove'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog('groove');}}
  else if(key==='hardware'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog('hardware');}}
  else if(key==='copyHardware'){closeToolDockBeforeMenu();openCopyHardwareTool();}
  else if(key==='shape'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openShapeDialog();}}
  else if(key==='slattedPanel'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openSlattedPanelDialog();}}
  else if(key==='copyShape'){closeToolDockBeforeMenu();openCopyShapeTool();}
  else if(key==='machining'){if(dockEnsurePiece()){closeToolDockBeforeMenu();openMachiningDialog((state.selected?.userData?.machining||[])[0]?.type||'hole');}}
  else if(key==='duplicate'){if(dockEnsurePiece())duplicateSelected();}
  else if(key==='deleteSelected'){if(dockEnsurePiece())deleteSelected();}

  else if(key==='cutSpace'){if(dockEnsureSpace(true)){closeToolDockBeforeMenu();dockClick('cutSpaceBtn');}}
  else if(key==='createPieces'){if(dockEnsureSpace(true)){closeToolDockBeforeMenu();dockClick('createPiecesBtn');}}
  else if(key==='drawers'){closeToolDockBeforeMenu();openDrawerSystemDialog();}
  else if(key==='curvedStructure'){closeToolDockBeforeMenu();openCurvedStructureDialog();}
  else if(key==='library'){if(dockEnsureSpace(true)){closeToolDockBeforeMenu();dockClick('openLibraryBtn');}}
  else if(key==='doorSystem'){closeToolDockBeforeMenu();openDoorSystemDialog();}
  else if(key==='editSpace'){if(dockEnsureSpace(false)){closeToolDockBeforeMenu();openEditSpaceDialog();}}
  else if(key==='adjacentSpace'){if(dockEnsureSpace(false)){if(state.visualMode)setVisualMode(false,{notify:false,frame:false});closeToolDockBeforeMenu();openNewSpaceDialog(activeSpaceRoot());}}
  else if(key==='toggleSpace'){if(dockEnsureSpace(true))toggleActiveSpaceVisibility();}
  else if(key==='toggleDoors'){if(dockEnsureSpace(false))toggleDoorsForActiveSpace();}
  else if(key==='showHiddenSpaces')showAllHiddenSpaces();
  else if(key==='exportFurniture'){if(dockEnsureSpace(false))exportSelectedFurniture();}
  else if(key==='aspireFurniture'){if(dockEnsureSpace(false))exportSelectedAspireDxf();}
  else if(key==='aspireProject')exportProjectAspireZip();
  else if(key==='deleteSpace'){if(dockEnsureSpace(false)){closeToolDockBeforeMenu();deleteSelectedSpaceRoot();}}
  else if(key==='deleteSpaceCell'){if(dockEnsureSpace(true)){closeToolDockBeforeMenu();openDeleteSelectedSpaceCellDialog();}}

  else if(key==='front')dockView('front');
  else if(key==='back')dockView('back');
  else if(key==='left')dockView('left');
  else if(key==='right')dockView('right');
  else if(key==='top')dockView('top');
  else if(key==='bottom')dockView('bottom');

  else if(key==='save')dockClick('saveBtn');
  else if(key==='load')dockClick('loadBtn');
  else if(key==='exportProject')dockClick('exportBtn');
  else if(key==='importProject'){closeToolDockBeforeMenu();dockClick('importBtn');}
  else if(key==='importFurniture'){closeToolDockBeforeMenu();dockClick('importFurnitureBtn');}
  else if(key==='clearGuides')dockClick('clearGuidesBtn');
  else if(key==='clearProject')dockClick('clearBtn');
  else if(key==='more'){closeToolDockBeforeMenu();toggleMorePanel();}
  syncToolDockButtons();
}

// ============================================================================
// 1.200.59 · BARRA INFERIOR VISUAL 1.200.56 + SUBMENUS FLUTUANTES
// ============================================================================
const QUICK_DOCK_PREFS_KEY='designLabQuickDockV2';
const QUICK_DOCK_LEGACY_PREFS_KEY='designLabQuickDockV1';
const QUICK_DOCK_DEFAULT=[
  'deleteSelected','space','createPieces','cutSpace','machining',
  'hardware','copyShape','copyHardware','undo','select'
];
let quickDockConfig=loadQuickDockConfig();
let quickDockDraft=null;
let quickDockPage=0;

function quickDockKnownKey(key){
  return TOOL_DOCK_CATALOG.some(t=>t.key===key)||key==='productionSuite'||key==='assembly'||key==='spaceMenu'||key==='viewMenu';
}
function normalizeQuickDockConfig(raw){
  const count=[3,4,5].includes(Number(raw?.count))?Number(raw.count):4;
  const total=count*2;
  const items=[];
  const push=k=>{k=String(k||'');if(k&&quickDockKnownKey(k)&&!items.includes(k))items.push(k);};
  if(Array.isArray(raw?.items))raw.items.forEach(push);
  QUICK_DOCK_DEFAULT.forEach(push);
  TOOL_DOCK_CATALOG.forEach(t=>push(t.key));
  return {count,items:items.slice(0,total)};
}
function loadQuickDockConfig(){
  try{
    const raw=localStorage.getItem(QUICK_DOCK_PREFS_KEY) || localStorage.getItem(QUICK_DOCK_LEGACY_PREFS_KEY);
    return normalizeQuickDockConfig(JSON.parse(raw||'null'));
  }catch{return normalizeQuickDockConfig(null);}
}
function saveQuickDockConfig(){
  quickDockConfig=normalizeQuickDockConfig(quickDockConfig);
  try{localStorage.setItem(QUICK_DOCK_PREFS_KEY,JSON.stringify(quickDockConfig));}catch{}
}
function quickDockPresentation(key){
  const map={
    deleteSelected:['🗑','Apagar'],space:['＋','Espaço'],createPieces:['▰','Peças'],hardware:['⚙','Ferragens'],select:['⌖','Selecionar'],
    move:['✥','Mover'],tape:['📏','Trena'],hole:['●','Furo'],groove:['▱','Rasgo'],shape:['◜','Forma'],slattedPanel:['▥','Ripado'],copyShape:['⧉','C. Forma'],
    copyHardware:['⧉','C. Ferr.'],machining:['🛠','Usinagem'],cutSpace:['✂','Corte'],drawers:['▤','Gavetas'],library:['▦','Biblioteca'],doorSystem:['🚪','Portas'],
    editSpace:['✎','Editar'],deleteSpaceCell:['🧩','Unir vão'],undo:['↶','Desfazer'],redo:['↷','Refazer'],xray:['◈','Raio-X'],
    toggleHardwareVisibility:['🔩','Ferragens'],toggleMachiningVisibility:['🟣','Usinagens'],materials:['🎨','Materiais'],layout:['📐','Layout'],
    save:['💾','Salvar'],more:['•••','Mais'],productionSuite:['✅','Produção'],assembly:['🧩','Montagem'],spaceMenu:['▦','Espaço+'],viewMenu:['◫','Vistas'],duplicate:['⧉','Duplicar'],
    inspector:['📐','Medidas'],openSpace:['▣','Abrir espaço'],front:['▥','Frente'],back:['▥','Trás'],left:['▥','Esq.'],right:['▥','Dir.'],
    top:['▥','Cima'],bottom:['▥','Baixo'],visual:['👁','Visual'],view3d:['◇','3D'],parts:['📋','Peças'],labels:['🏷','Etiquetas']
  };
  if(map[key])return map[key];
  const def=toolDockDef(key);
  const label=String(def?.label||key).trim();
  const m=label.match(/^([^\p{L}\p{N}]+)\s*(.*)$/u);
  const icon=(m?.[1]||'•').trim().slice(0,3)||'•';
  const text=(m?.[2]||label).replace(/\s*\/\s*/g,'/').trim().slice(0,11)||'Atalho';
  return [icon,text];
}
function quickDockToolActive(key){
  return (key==='select'&&state.toolMode==='select')||(key==='move'&&state.toolMode==='move-free')||(key==='tape'&&state.toolMode==='tape')||
    (key==='visual'&&state.visualMode)||(key==='xray'&&state.xray3DEnabled)||(key==='toggleHardwareVisibility'&&state.cadHardwareVisible)||
    (key==='toggleMachiningVisibility'&&state.cadMachiningVisible);
}

const QUICK_DOCK_SUBMENUS={
  deleteSelected:{
    title:'Apagar',kind:'delete',items:[
      {label:'Apagar móvel',icon:'🗑',tool:'deleteSpace'},
      {label:'Apagar espaço',icon:'🧩',tool:'deleteSpaceCell'},
      {label:'Apagar peça',icon:'▰',tool:'deleteSelected'}
    ]
  },
  cutSpace:{
    title:'Cortar espaço',kind:'cut',items:[
      {label:'Esquerda',cutSide:'left',pieceIcon:'left'},
      {label:'Direita',cutSide:'right',pieceIcon:'right'},
      {label:'Em cima',cutSide:'top',pieceIcon:'top'},
      {label:'Em baixo',cutSide:'bottom',pieceIcon:'base'},
      {label:'Frente',cutSide:'front',pieceIcon:'front'},
      {label:'Fundo',cutSide:'back',pieceIcon:'back'}
    ]
  },
  createPieces:{
    title:'Criar peças',kind:'pieces',items:[
      {label:'Lat. esq.',pieceType:'left',pieceIcon:'left'},
      {label:'Lat. dir.',pieceType:'right',pieceIcon:'right'},
      {label:'Base',pieceType:'base',pieceIcon:'base'},
      {label:'Chapéu',pieceType:'top',pieceIcon:'top'},
      {label:'Frente',pieceType:'front',pieceIcon:'front'},
      {label:'Fundo',pieceType:'back',pieceIcon:'back'},
      {label:'Prateleira',pieceType:'shelf',pieceIcon:'shelf'},
      {label:'Divisão',pieceType:'division',pieceIcon:'division'},
      {label:'Ripas',pieceType:'slat',pieceIcon:'slat'},
      {label:'Sarr. sup. frente',pieceType:'rail',railFace:'front',railLevel:'top',pieceIcon:'railFront'},
      {label:'Sarr. sup. trás',pieceType:'rail',railFace:'back',railLevel:'top',pieceIcon:'railBack'},
      {label:'Sarr. inf. frente',pieceType:'rail',railFace:'front',railLevel:'bottom',pieceIcon:'railFrontBottom'},
      {label:'Sarr. inf. trás',pieceType:'rail',railFace:'back',railLevel:'bottom',pieceIcon:'railBackBottom'}
    ]
  },
  machining:{
    title:'Usinagem',kind:'machining',items:[
      {label:'Furo',icon:'●',tool:'hole'},
      {label:'Rasgo',icon:'▱',tool:'groove'},
      {label:'Ferragens',icon:'⚙',tool:'hardware'},
      {label:'Forma',icon:'◜',tool:'shape'},
      {label:'Ripado',icon:'▥',tool:'slattedPanel'},
      {label:'C. Forma',icon:'⧉',tool:'copyShape'},
      {label:'C. Ferr.',icon:'⧉',tool:'copyHardware'},
      {label:'Gerenciar',icon:'🛠',tool:'machining'},
      {label:'Ocultar',icon:'◉',tool:'toggleMachiningVisibility'}
    ]
  },
  spaceMenu:{
    title:'Espaço / móvel',kind:'space',items:[
      {label:'Novo',icon:'＋',tool:'space'},
      {label:'Corte',icon:'✂',tool:'cutSpace'},
      {label:'Peças',icon:'▰',tool:'createPiecesDirect'},
      {label:'Gavetas',icon:'▤',tool:'drawers'},
      {label:'Biblioteca',icon:'▦',tool:'library'},
      {label:'Editar',icon:'✎',tool:'editSpace'},
      {label:'Unir vão',icon:'🧩',tool:'deleteSpaceCell'},
      {label:'Ocultar',icon:'◫',tool:'toggleSpace'}
    ]
  },
  viewMenu:{
    title:'Vistas',kind:'views',items:[
      {label:'Frente',icon:'▥',tool:'front'},
      {label:'Trás',icon:'▥',tool:'back'},
      {label:'Esq.',icon:'▥',tool:'left'},
      {label:'Dir.',icon:'▥',tool:'right'},
      {label:'Cima',icon:'▤',tool:'top'},
      {label:'Baixo',icon:'▤',tool:'bottom'},
      {label:'3D',icon:'◇',tool:'view3d'},
      {label:'Raio-X',icon:'◈',tool:'xray'}
    ]
  }
};
let quickDockSubmenuKey=null;
function quickDockHasSubmenu(key){return !!QUICK_DOCK_SUBMENUS[key];}
function quickDockSubmenuVisible(){const p=$('quickDockSubmenu');return !!(p&&p.classList.contains('show'));}
function ensureQuickDockSubmenu(){
  let p=$('quickDockSubmenu');
  if(p)return p;
  if(!$('quickDock'))return null;
  p=document.createElement('div');p.id='quickDockSubmenu';p.setAttribute('role','menu');p.setAttribute('aria-label','Submenu de atalhos');
  const h=document.createElement('div');h.className='quickDockSubmenuHeader';
  const title=document.createElement('b');title.id='quickDockSubmenuTitle';
  const hint=document.createElement('span');hint.id='quickDockSubmenuHint';hint.textContent='toque em uma opção';h.append(title,hint);
  const tools=document.createElement('div');tools.id='quickDockSubmenuTools';
  // 1.200.59: o submenu fica fora do flex da barra. Assim a barra conserva
  // exatamente as dimensões/visual da 1.200.56 e o submenu apenas flutua acima.
  p.append(h,tools);document.body.appendChild(p);return p;
}
function closeQuickDockSubmenu(){
  const p=$('quickDockSubmenu');if(p)p.classList.remove('show');
  quickDockSubmenuKey=null;
  document.querySelectorAll('#quickDockTools .quickDockTool.submenu-open').forEach(b=>b.classList.remove('submenu-open'));
}
function quickDockPieceIcon(kind){
  const w=document.createElement('span');w.className='quickSubPieceIconSvg';w.setAttribute('aria-hidden','true');
  const faces={
    left:'10,18 32,30 32,56 10,44',
    right:'32,30 54,18 54,44 32,56',
    base:'10,43 32,55 54,43 32,31',
    top:'32,6 54,18 32,30 10,18',
    front:'13,22 44,22 44,49 13,49',
    back:'20,14 49,22 49,46 20,38',
    shelf:'10,31 32,43 54,31 32,19',
    division:'27,14 37,20 37,48 27,42',
    slat:'10,27 54,27 54,37 10,37',
    rail:'10,24 54,24 54,40 10,40',
    railFront:'13,20 44,20 44,31 13,31',
    railBack:'20,13 49,21 49,31 20,23',
    railFrontBottom:'13,33 44,33 44,44 13,44',
    railBackBottom:'20,34 49,42 49,52 20,44'
  };
  const fill=faces[kind]||faces.left;
  w.innerHTML=`<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
    <defs><linearGradient id="qdp-${kind}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#62d8ff"/><stop offset="1" stop-color="#0879d8"/></linearGradient></defs>
    <polygon class="quickPieceFace" points="${fill}" fill="url(#qdp-${kind})"/>
    <path class="quickPieceWire" d="M32 6 54 18 54 44 32 56 10 44 10 18 32 6Zm0 24L10 18m22 12 22-12m-22 12v26"/>
    ${kind==='shelf'?'<path class="quickPieceAccent" d="M10 31 32 43 54 31"/>':''}
    ${kind==='division'?'<path class="quickPieceAccent" d="M32 7v49"/>':''}
    ${kind==='slat'?'<path class="quickPieceAccent" d="M10 27 54 27M10 37 54 37"/>':''}
    ${kind==='rail'?'<path class="quickPieceAccent" d="M10 24 54 24M10 40 54 40"/>':''}
    ${kind==='railFront'?'<path class="quickPieceAccent" d="M13 20 44 20M13 31 44 31"/>':''}
    ${kind==='railBack'?'<path class="quickPieceAccent" d="M20 13 49 21M20 23 49 31"/>':''}
    ${kind==='railFrontBottom'?'<path class="quickPieceAccent" d="M13 33 44 33M13 44 44 44"/>':''}
    ${kind==='railBackBottom'?'<path class="quickPieceAccent" d="M20 34 49 42M20 44 49 52"/>':''}
  </svg>`;
  return w;
}
function quickDockPreparePieceType(type,railFace=null,railLevel=null){
  if(!dockEnsureSpace(true))return null;
  closeToolDockBeforeMenu();
  const opener=$('createPiecesBtn');if(!opener){toast('Criar peças indisponível');return null;}
  opener.click();
  const selector=type==='rail'&&railFace
    ? `[data-piece-type="rail"][data-rail-face="${railFace}"]${railLevel?`[data-rail-level="${railLevel}"]`:''}`
    : `[data-piece-type="${type}"]`;
  const b=document.querySelector(selector)||document.querySelector(`[data-piece-type="${type}"]`);
  if(b)selectPieceCreateTypeButton(b);
  return b||null;
}
function quickDockOpenPieceType(type,railFace=null,railLevel=null){
  closeQuickDockSubmenu();
  quickDockPreparePieceType(type,railFace,railLevel);
}
function quickDockDirectCreatePieceType(type,railFace=null,railLevel=null){
  closeQuickDockSubmenu();
  const b=quickDockPreparePieceType(type,railFace,railLevel);
  if(!b)return;
  quickCreatePieceFromTypeButton(b);
}
function bindQuickDockPieceSubTool(button,item){
  let holdTimer=0,longPress=false;
  const clearHold=()=>{if(holdTimer){clearTimeout(holdTimer);holdTimer=0;}};
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.stopPropagation();longPress=false;clearHold();
    holdTimer=setTimeout(()=>{holdTimer=0;longPress=true;quickDockOpenPieceType(item.pieceType,item.railFace||null,item.railLevel||null);},520);
  });
  button.addEventListener('pointerup',e=>{
    e.stopPropagation();const wasLong=longPress;clearHold();
    if(!wasLong)quickDockDirectCreatePieceType(item.pieceType,item.railFace||null,item.railLevel||null);
    longPress=false;
  });
  button.addEventListener('pointercancel',()=>{clearHold();longPress=false;});
  button.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')clearHold();});
  button.addEventListener('contextmenu',e=>e.preventDefault());
  // Teclado/acessibilidade: Enter/Espaço equivalem ao toque simples.
  button.addEventListener('click',e=>{if(e.detail===0){e.stopPropagation();quickDockDirectCreatePieceType(item.pieceType,item.railFace||null,item.railLevel||null);}});
}
function quickDockPrepareCutSide(side){
  if(!dockEnsureSpace(true))return false;
  closeToolDockBeforeMenu();
  applyCutSpacePrefs();
  state.cutSide=side;
  document.querySelectorAll('[data-cut-side]').forEach(b=>b.classList.toggle('active',b.dataset.cutSide===state.cutSide));
  updateCutPreview();
  return true;
}
function quickDockOpenCutSide(side){
  closeQuickDockSubmenu();
  if(quickDockPrepareCutSide(side))$('cutSpaceDialog').style.display='flex';
}
function quickDockDirectCutSide(side){
  closeQuickDockSubmenu();
  if(!quickDockPrepareCutSide(side))return;
  const amount=parseDecimalInput($('cutAmount')?.value);
  const fixed=!!$('cutFixed')?.checked;
  const count=cutSpaceCountValue();
  const res=applySelectedSpaceCut(side,m(amount),fixed,count);
  if(res.ok)toast(res.noCut?`${cutSideName(side)} · 1 vão, sem corte`:(Number(amount)===0?`${cutSideName(side)} · ${res.count} vãos iguais`:`${cutSideName(side)} · corte aplicado`));
}
function bindQuickDockCutSubTool(button,item){
  let holdTimer=0,longPress=false;
  const clear=()=>{if(holdTimer){clearTimeout(holdTimer);holdTimer=0;}};
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.stopPropagation();longPress=false;clear();
    holdTimer=setTimeout(()=>{holdTimer=0;longPress=true;quickDockOpenCutSide(item.cutSide);},520);
  });
  button.addEventListener('pointerup',e=>{e.stopPropagation();const wasLong=longPress;clear();if(!wasLong)quickDockDirectCutSide(item.cutSide);longPress=false;});
  button.addEventListener('pointercancel',()=>{clear();longPress=false;});
  button.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')clear();});
  button.addEventListener('contextmenu',e=>e.preventDefault());
  button.addEventListener('click',e=>{if(e.detail===0){e.stopPropagation();quickDockDirectCutSide(item.cutSide);}});
}
function runQuickDockSubItem(item){
  if(!item)return;
  if(item.pieceType){quickDockDirectCreatePieceType(item.pieceType,item.railFace||null,item.railLevel||null);return;}
  if(item.cutSide){quickDockDirectCutSide(item.cutSide);return;}
  closeQuickDockSubmenu();
  if(item.tool==='createPiecesDirect'){runDockTool('createPieces');return;}
  if(item.tool)runDockTool(item.tool);
}
function openQuickDockSubmenu(key,anchor=null){
  const def=QUICK_DOCK_SUBMENUS[key];if(!def)return false;
  const p=ensureQuickDockSubmenu();if(!p)return false;
  if(quickDockSubmenuKey===key&&p.classList.contains('show')){closeQuickDockSubmenu();return true;}
  quickDockSubmenuKey=key;
  const title=$('quickDockSubmenuTitle');if(title)title.textContent=def.title;
  const hint=$('quickDockSubmenuHint');if(hint)hint.textContent=def.kind==='pieces'?'toque cria · segure para opções':def.kind==='cut'?'toque corta · segure para medida/opções':'toque em uma opção';
  p.dataset.kind=def.kind||'';
  const box=$('quickDockSubmenuTools');if(!box)return false;
  box.innerHTML='';box.style.setProperty('--quick-sub-count',String(Math.max(1,Math.min(8,def.items.length))));
  def.items.forEach(item=>{
    const b=document.createElement('button');b.type='button';b.className='quickDockSubTool secondary';b.setAttribute('role','menuitem');b.title=item.label;
    const icon=item.pieceIcon?quickDockPieceIcon(item.pieceIcon):document.createElement('span');
    if(!item.pieceIcon){icon.className='quickDockSubIcon';icon.textContent=item.icon||'•';}
    const txt=document.createElement('span');txt.className='quickDockSubText';txt.textContent=item.label;
    b.append(icon,txt);
    if(item.pieceType){
      b.title=`${item.label} · toque cria · segure para opções`;
      bindQuickDockPieceSubTool(b,item);
    }else if(item.cutSide){
      b.title=`${item.label} · toque corta · segure para medida/opções`;
      bindQuickDockCutSubTool(b,item);
    }else{
      b.addEventListener('click',e=>{e.stopPropagation();runQuickDockSubItem(item);});
    }
    box.appendChild(b);
  });
  p.classList.add('show');
  document.querySelectorAll('#quickDockTools .quickDockTool').forEach(b=>b.classList.toggle('submenu-open',b===anchor));
  return true;
}
function runQuickDockTool(key,anchor){
  if(quickDockHasSubmenu(key)){openQuickDockSubmenu(key,anchor);return;}
  closeQuickDockSubmenu();runDockTool(key);
}

function syncQuickDockButtons(){
  document.querySelectorAll('#quickDockTools [data-quick-tool]').forEach(b=>{
    const active=quickDockToolActive(b.dataset.quickTool);
    b.classList.toggle('active',active);b.classList.toggle('secondary',!active);
  });
}
function syncQuickDockSwapButton(){
  const b=$('quickDockSwap');if(!b)return;
  const start=quickDockPage*quickDockConfig.count+1;
  const end=start+quickDockConfig.count-1;
  b.dataset.page=String(quickDockPage+1);
  b.title=`Trocar atalhos · mostrando ${start}–${end} de ${quickDockConfig.count*2}`;
  b.setAttribute('aria-label',`Trocar para página ${quickDockPage===0?2:1} de atalhos`);
}
function renderQuickDock(animate=false){
  const box=$('quickDockTools');if(!box)return;
  quickDockConfig=normalizeQuickDockConfig(quickDockConfig);
  if(quickDockPage>1)quickDockPage=0;
  box.innerHTML='';
  box.style.gridTemplateColumns=`repeat(${quickDockConfig.count},minmax(0,1fr))`;
  const start=quickDockPage*quickDockConfig.count;
  quickDockConfig.items.slice(start,start+quickDockConfig.count).forEach(key=>{
    const def=toolDockDef(key);
    const [icon,text]=quickDockPresentation(key);
    const b=document.createElement('button');b.type='button';b.className='quickDockTool secondary';b.dataset.quickTool=key;
    b.title=def?.label||text;b.setAttribute('aria-label',def?.label||text);
    const i=document.createElement('span');i.className='quickDockIcon';i.textContent=icon;
    const t=document.createElement('span');t.className='quickDockText';t.textContent=text;
    b.append(i,t);b.addEventListener('click',()=>runQuickDockTool(key,b));box.appendChild(b);
  });
  syncQuickDockButtons();syncQuickDockSwapButton();
  if(animate&&box.animate){
    const dir=quickDockPage===1?-1:1;
    box.animate([{opacity:.2,transform:`translateX(${dir*10}px)`},{opacity:1,transform:'translateX(0)'}],{duration:150,easing:'ease-out'});
  }
}
function swapQuickDockPage(){
  closeQuickDockSubmenu();
  quickDockPage=quickDockPage===0?1:0;
  renderQuickDock(true);
}
function quickDockBuildSelect(current,index){
  const sel=document.createElement('select');sel.className='quickDockSelect';sel.dataset.quickSlot=String(index);
  const submenuGroup=document.createElement('optgroup');submenuGroup.label='Submenus rápidos';
  [['spaceMenu','▦ Espaço / móvel · submenu'],['viewMenu','◫ Vistas · submenu']].forEach(([key,label])=>{
    const o=document.createElement('option');o.value=key;o.textContent=label;o.selected=key===current;submenuGroup.appendChild(o);
  });
  sel.appendChild(submenuGroup);
  const groups=[...new Set(TOOL_DOCK_CATALOG.map(t=>t.group||'Outros'))];
  for(const group of groups){
    const og=document.createElement('optgroup');og.label=group;
    TOOL_DOCK_CATALOG.filter(t=>(t.group||'Outros')===group).forEach(def=>{
      const o=document.createElement('option');o.value=def.key;o.textContent=def.label;o.selected=def.key===current;og.appendChild(o);
    });
    sel.appendChild(og);
  }
  return sel;
}
function renderQuickDockEditor(){
  if(!quickDockDraft)quickDockDraft=normalizeQuickDockConfig(quickDockConfig);
  document.querySelectorAll('#quickDockCountChoices [data-quick-count]').forEach(b=>{
    const active=Number(b.dataset.quickCount)===quickDockDraft.count;b.classList.toggle('active',active);b.classList.toggle('secondary',!active);
  });
  const list=$('quickDockSlotList');if(!list)return;list.innerHTML='';
  const total=quickDockDraft.count*2;
  for(let i=0;i<total;i++){
    if(i===0||i===quickDockDraft.count){
      const head=document.createElement('div');head.className='quickDockPageHeader';
      head.innerHTML=`<b>Página ${i===0?1:2}</b><span>atalhos ${i+1}–${i+quickDockDraft.count}</span>`;
      list.appendChild(head);
    }
    const row=document.createElement('label');row.className='quickDockSlotRow';
    const n=document.createElement('span');n.className='quickDockSlotNumber';n.textContent=String(i+1);
    const sel=quickDockBuildSelect(quickDockDraft.items[i],i);
    sel.addEventListener('change',()=>{
      const next=sel.value,old=quickDockDraft.items[i];
      const other=quickDockDraft.items.findIndex((v,j)=>j!==i&&v===next);
      if(other>=0)quickDockDraft.items[other]=old;
      quickDockDraft.items[i]=next;renderQuickDockEditor();
    });
    row.append(n,sel);list.appendChild(row);
  }
}
function openQuickDockEditor(){
  closeQuickDockSubmenu();
  quickDockDraft=normalizeQuickDockConfig(quickDockConfig);renderQuickDockEditor();
  const dlg=$('quickDockConfigDialog');if(dlg)dlg.style.display='flex';
}
function closeQuickDockEditor(){const dlg=$('quickDockConfigDialog');if(dlg)dlg.style.display='none';quickDockDraft=null;}
function initQuickDock(){
  renderQuickDock();ensureQuickDockSubmenu();
  $('quickDockSwap')?.addEventListener('click',swapQuickDockPage);
  $('quickDockSettings')?.addEventListener('click',openQuickDockEditor);
  document.querySelectorAll('#quickDockCountChoices [data-quick-count]').forEach(b=>b.addEventListener('click',()=>{
    if(!quickDockDraft)quickDockDraft=normalizeQuickDockConfig(quickDockConfig);
    quickDockDraft.count=Number(b.dataset.quickCount);quickDockDraft=normalizeQuickDockConfig(quickDockDraft);renderQuickDockEditor();
  }));
  $('quickDockReset')?.addEventListener('click',()=>{quickDockDraft={count:5,items:[...QUICK_DOCK_DEFAULT]};renderQuickDockEditor();});
  $('quickDockCancel')?.addEventListener('click',closeQuickDockEditor);
  $('quickDockConfigDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('quickDockConfigDialog'))closeQuickDockEditor();});
  $('quickDockSave')?.addEventListener('click',()=>{
    if(!quickDockDraft)return;
    quickDockConfig=normalizeQuickDockConfig(quickDockDraft);quickDockPage=0;saveQuickDockConfig();renderQuickDock();closeQuickDockEditor();
    toast(`Barra rápida salva · ${quickDockConfig.count*2} atalhos em 2 páginas`);
  });
  document.addEventListener('pointerdown',e=>{
    if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    if(!quickDockSubmenuVisible())return;
    const p=$('quickDockSubmenu');
    if(p?.contains(e.target)||e.target?.closest?.('#quickDockTools .quickDockTool'))return;
    closeQuickDockSubmenu();
  },{capture:true});
}

function setToolDockOpen(open){
  const dock=$('toolDock'); if(!dock)return;
  dock.classList.toggle('open',!!open);
  const t=$('toolDockToggle'); if(t){t.textContent=open?'⌃':'⌄';t.setAttribute('aria-label',open?'Fechar ferramentas':'Abrir ferramentas');}
}
function clampToolDockPosition(left,top){
  const dock=$('toolDock'); if(!dock)return {left,top};
  const rect=dock.getBoundingClientRect();
  const maxL=Math.max(6,innerWidth-rect.width-6);
  const maxT=Math.max(6,innerHeight-Math.min(rect.height,520)-6);
  return {left:Math.max(6,Math.min(maxL,left)),top:Math.max(6,Math.min(maxT,top))};
}
function restoreToolDockPosition(){
  const dock=$('toolDock'); if(!dock)return;
  try{
    const pos=JSON.parse(localStorage.getItem(TOOL_DOCK_POS_KEY)||'null');
    if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){
      const c=clampToolDockPosition(pos.left,pos.top);
      dock.style.left=c.left+'px'; dock.style.top=c.top+'px';
    }
  }catch{}
}
function saveToolDockPosition(){
  const dock=$('toolDock'); if(!dock)return;
  const r=dock.getBoundingClientRect();
  try{localStorage.setItem(TOOL_DOCK_POS_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}
}
function initToolDockDrag(){
  const dock=$('toolDock'),head=$('toolDockHeader'); if(!dock||!head)return;
  let drag=null,moved=false;
  head.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    const r=dock.getBoundingClientRect();
    drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    moved=false; head.setPointerCapture?.(e.pointerId);
  });
  head.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    moved=true;
    const c=clampToolDockPosition(e.clientX-drag.dx,e.clientY-drag.dy);
    dock.style.left=c.left+'px';dock.style.top=c.top+'px';
    e.preventDefault();
  });
  const end=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    head.releasePointerCapture?.(e.pointerId);
    drag=null; if(moved)saveToolDockPosition();
  };
  head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
}

// 1.200.18 · painel Espaço/Divisão flutuante com posição persistente.
// 1.200.18 · Exportar/Importar móvel: STL 3D. Aspire e usinagem continuam em DXF.
// O usuário arrasta pelo cabeçalho (nome + medidas) e a posição é lembrada
// na conta e restaurada depois de fechar/reabrir o app ou trocar de aparelho.
const SPACE_ACTIONS_POS_KEY='designLabSpaceActionsPosV1';
function clampSpaceActionsPosition(left,top){
  const panel=$('spaceActions'); if(!panel)return {left,top};
  const rect=panel.getBoundingClientRect();
  const margin=6;
  const maxL=Math.max(margin,innerWidth-rect.width-margin);
  const visibleH=Math.min(rect.height,Math.max(60,innerHeight-margin*2));
  const maxT=Math.max(margin,innerHeight-visibleH-margin);
  return {
    left:Math.max(margin,Math.min(maxL,Number(left)||margin)),
    top:Math.max(margin,Math.min(maxT,Number(top)||margin))
  };
}
function restoreSpaceActionsPosition(){
  const panel=$('spaceActions'); if(!panel)return;
  try{
    const pos=JSON.parse(localStorage.getItem(SPACE_ACTIONS_POS_KEY)||'null');
    if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){
      const c=clampSpaceActionsPosition(pos.left,pos.top);
      panel.style.left=c.left+'px';
      panel.style.top=c.top+'px';
      panel.style.right='auto';
      panel.style.bottom='auto';
    }
  }catch{}
}
function saveSpaceActionsPosition(){
  const panel=$('spaceActions'); if(!panel)return;
  const r=panel.getBoundingClientRect();
  try{localStorage.setItem(SPACE_ACTIONS_POS_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}
}
function initSpaceActionsDrag(){
  const panel=$('spaceActions'),handle=$('spaceActionsDragHandle');
  if(!panel||!handle)return;
  restoreSpaceActionsPosition();
  let drag=null,moved=false;

  handle.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const r=panel.getBoundingClientRect();
    drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    moved=false;
    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    moved=true;
    const c=clampSpaceActionsPosition(e.clientX-drag.dx,e.clientY-drag.dy);
    panel.style.left=c.left+'px';
    panel.style.top=c.top+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
    e.preventDefault();
  });
  const finish=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    handle.releasePointerCapture?.(e.pointerId);
    drag=null;
    if(moved)saveSpaceActionsPosition();
  };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);

  window.addEventListener('resize',()=>{
    const r=panel.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const c=clampSpaceActionsPosition(r.left,r.top);
    panel.style.left=c.left+'px';
    panel.style.top=c.top+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
    saveSpaceActionsPosition();
  });
}

// ============================================================================
// 1.100.96 · JANELA DE CONFIGURAÇÃO DA PEÇA FLUTUANTE
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
    if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
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


  return {
    TOOL_DOCK_CATALOG,
    get toolDockPrefs(){ return toolDockPrefs; },
    saveToolDockPrefs, syncToolDockButtons, renderToolDock, applyXray3D, toggleDockXray, closeToolDockBeforeMenu,
    quickDockSubmenuVisible, closeQuickDockSubmenu, initQuickDock, setToolDockOpen, initSpaceActionsDrag,
    restorePieceInspectorPosition, initPieceInspectorFloating, initToolDock,
    getRunDockTool(){ return runDockTool; },
    setRunDockTool(fn){ if(typeof fn==='function')runDockTool=fn; }
  };
}
