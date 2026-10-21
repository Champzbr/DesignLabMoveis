// DesignLabMoveis 1.311.00 · bindings de UI/DOM separados do runtime.
export function bindUiEvents(ctx){
  const state=ctx.state;
  const { $, COLORS,activateOfflinePremiumAccess,activeSpaceRoot,applyBackGroovePreset,applyCadBackground,applyCadGridVisibility,applyCadShadows,applyDesignLabAppTheme,applyDesignLabUpdate,applyExactPanel,applyHole32Preset,applyParametricFormatToPiece,applyPieceNamePreset,applyPieceRelativeConfig,applyQuickFrontVisibility,applySelectedHardware,applySelectedMachiningPreset,applySelectedPieceMaterialFromInspector,applyShapeToPiece,applyState,applyXray3D,auth,authSubmitForgot,authSubmitLogin,authSubmitSignup,cancelDuplicateConfirmation,checkDesignLabUpdate,claimAllLegacyProjects,claimLegacyProject,clampSize,clearConstructionGuides,clearMachiningDraftPreview,clearScene,closeAppSettings,closeLabelsDialog,closeMachining3DPreview,closePremiumPurchase,closeProductionDialog,closeProjectCardMenu,closeProjectMetaDialog,closeShapeDialog,closeUpdateDialog,cloudAccount,commitHistory,confirmDuplicateSelected,copyPremiumPix,createBox,createNewProject,createPieceNamePreset,deleteActiveLibraryFolder,deleteProjectById,deleteSelected,deleteSelectedFromInspector,deleteSelectedHardwarePreset,deleteSelectedMachiningPreset,deleteSelectedSpaceCell,deleteSelectedSpaceRoot,deleteShapePresetLibrary,designLabFurnitureRecordFromFile,designLabRouteEnterWorkspace,discardPendingRecovery,duplicateProjectById,editSelectedShapePreset,enterProjectEditor,exportCurrentProjectFile,exportProjectAspireZip,exportProjectRecordFile,exportSelectedAspireDxf,exportSelectedFurniture,fillHardwareDowelExample,fillHardwareShelfPinExample,fillPieceMaterialSelect,findHardwarePreset,forceDesignLabServerRefresh,globalLibraryFolderById,grooveLengthIsFull,hideQuickSelectedSpace,hideSelectedPieceQuick,importFurnitureData,importLibraryFile,importProjectFile,initOnlineIdentity,labelsApplyPrefs,labelsPrint,labelsSaveHtml,labelsSavePrefs,library,libraryFolderById,loadOfflinePremiumLicense,loadSelectedShapePresetToEditor,localAuthContinue,localCoordField,lockOnlineApp,logoutOnlineIdentity,m,machiningShapes,markPremiumPaymentPaid,newLibraryFolder,newShapePreset,openAppSettings,openCopyHardwareTool,openCopyShapeTool,openDeleteSelectedSpaceCellDialog,openDoorSystemDialog,openEditSelectedSpaceDialog,openEditSpaceDialog,openHardwareBuilder,openHomeMaterials,openHomeModeling,openLabelsDialog,openLibraryRoot,openMachiningDialog,openNewSpaceDialog,openPieceInspector,openProductionDialog,openProjectMetaDialog,openQuickSelectedConfiguration,openShapeDialog,openSlattedPanelDialog,openSpaceFromObject,parseDecimalInput,previewHardware3D,previewShape3D,productionApplyMaterial,productionAssignEdge,productionClearSelectedBands,productionDeleteBand,productionDeleteMaterial,productionEditMaterialStock,productionLoadBandFields,productionLoadMaterialFields,productionMaterials,productionNewBand,productionNewMaterial,productionSaveBand,productionSaveMaterial,productionUpdateMaterialKindFields,projectAutosaveNow,projectDbGet,projects,publishSelectedHardwarePreset,publishSelectedShapePresetGlobal,quickToggleAllSpaces,readProjectMeta,recoverPendingProject,redo,refreshShapeCornerLabels,renameActiveLibraryFolder,renameCurrentProject,renderLabelsPreview,renderLibrary,requestDuplicateSelected,resetPieceRelativeConfig,returnShapePreview,returnTo3D,rotateBox,rotateSelectedPieceGrain,saveAsCurrentProject,saveCloudPreferences,saveCurrentFurnitureToLibrary,saveCurrentMachiningPreset,saveCurrentProject,saveHardwareBuilder,saveMachining,saveShapePresetLibrary,scrollProjectHomeTo,setAuthStatus,setDesignLabVisualizationOnly,setFrontWorldView,setGrooveLengthFull,setHardwareScope,setLibraryScope,setMachiningSurfaceCoordinate,setMachiningType,setSelectedPieceDoNotProduce,setShapeLibraryScope,setSheetPrefs,setVisualMode,shapeApplyCornerEdit,shapeCadClear,shapeCadCloseContour,shapeCadFitView,shapeCadPointerDown,shapeCadPointerLeave,shapeCadPointerMove,shapeCadPointerUp,shapeCadRedo,shapeCadRender,shapeCadSetTool,shapeCadSyncUi,shapeCadUndo,shapeCadZoomBy,shapeCadZoomWheel,shapeCornerSelectFromEvent,shapeFormatTypeChanged,shapeResetCorners,shapeSetCornerStyle,shapeSetMode,shapeTransformEditor,sheetPrefsFromUi,showAllHiddenSpaces,showAllManuallyHiddenPieces,showAuthInlineForm,showMachining3DPreview,showProjectHome,syncCloudAccount,syncGrooveLengthButton,syncManualPieceVisibilityButtons,syncQuickSpaceVisibilityButton,toast,toggleActiveSpaceVisibility,toggleCadHardwareVisibility,toggleCadMachiningVisibility,toggleDockXray,toggleDoorsForActiveSpace,toggleMachiningCoordSign,undo,unlockOnlineApp,updateBackGrooveVisibility,updateHardwareBuilderUi,updateHardwarePanel,updateHoleSeriesVisibility,updateInspector,updateMachiningPresetInfo,updateMachiningUI,updatePieceMaterialQuickInfo,updateShapePreview,verifyPremiumPayment,viewSpace,selectedCellInfo,mm,nice,adminAllowed,openAdminPanel,closeAdminPanel,adminSetTab,refreshAdminPanel,saveAdminSettings,adminPanelState,loadAdminUsers,loadAdminPayments,loadAdminStats,adminPremium,adminRevokePremium,adminBanUser,adminPaymentAction }=ctx;
  const runtimeModel=ctx.runtimeModel;
$('openLibraryBtn').onclick=()=>{if(state.visualMode)setVisualMode(false,{notify:false,frame:false});if(!state.selectedSpaceCell)return;openLibraryRoot();};
$('editSelectedSpaceBtn').onclick=()=>{if(state.visualMode)setVisualMode(false,{notify:false,frame:false});openEditSelectedSpaceDialog();};
$('closeLibrary').onclick=()=>{$('libraryDialog').style.display='none';library.state.activeLibraryFolderId=null;};
$('spaceMoreBtn').onclick=()=>{const info=selectedCellInfo();const root=info?.root||activeSpaceRoot();if(!root){toast('Selecione um espaço');return;}const s=info?.size||{width:root.width,depth:root.depth,height:root.height};$('spaceMoreInfo').textContent=`${root.name} · L ${mm(s.width)} · P ${mm(s.depth)} · A ${mm(s.height)} mm${info?'':' · móvel completo'}`;$('spaceMoreDialog').style.display='flex';};
$('closeSpaceMore').onclick=()=>{$('spaceMoreDialog').style.display='none';};
$('spaceMoreDialog').addEventListener('pointerdown',e=>{if(e.target===$('spaceMoreDialog'))$('spaceMoreDialog').style.display='none';});
$('editSpaceBtn').onclick=()=>{if(state.visualMode)setVisualMode(false,{notify:false,frame:false});$('spaceMoreDialog').style.display='none';openEditSpaceDialog();};
$('frontSpaceBtn').onclick=()=>{const root=selectedCellInfo()?.root||activeSpaceRoot();$('spaceMoreDialog').style.display='none';if(root)viewSpace(root,'front');else toast('Selecione um espaço');};
$('backSpaceBtn').onclick=()=>{const root=selectedCellInfo()?.root||activeSpaceRoot();$('spaceMoreDialog').style.display='none';if(root)viewSpace(root,'back');else toast('Selecione um espaço');};
$('leftSpaceBtn').onclick=()=>{const root=selectedCellInfo()?.root||activeSpaceRoot();$('spaceMoreDialog').style.display='none';if(root)viewSpace(root,'left');else toast('Selecione um espaço');};
$('rightSpaceBtn').onclick=()=>{const root=selectedCellInfo()?.root||activeSpaceRoot();$('spaceMoreDialog').style.display='none';if(root)viewSpace(root,'right');else toast('Selecione um espaço');};
$('topSpaceBtn').onclick=()=>{const root=selectedCellInfo()?.root||activeSpaceRoot();$('spaceMoreDialog').style.display='none';if(root)viewSpace(root,'top');else toast('Selecione um espaço');};
$('bottomSpaceBtn').onclick=()=>{const root=selectedCellInfo()?.root||activeSpaceRoot();$('spaceMoreDialog').style.display='none';if(root)viewSpace(root,'bottom');else toast('Selecione um espaço');};
$('toggleSpaceBtn').onclick=()=>{toggleActiveSpaceVisibility();$('spaceMoreDialog').style.display='none';};
$('hideSelectedSpaceBtn').onclick=()=>toggleActiveSpaceVisibility();
$('deleteSelectedSpaceBtn').onclick=()=>deleteSelectedSpaceRoot();
$('deleteSpaceCellBtn').onclick=openDeleteSelectedSpaceCellDialog;
$('cancelDeleteSpaceCell').onclick=()=>{$('deleteSpaceCellDialog').style.display='none';};
$('confirmDeleteSpaceCell').onclick=deleteSelectedSpaceCell;
$('deleteSpaceCellDialog').addEventListener('pointerdown',e=>{if(e.target===$('deleteSpaceCellDialog'))$('deleteSpaceCellDialog').style.display='none';});
$('showHiddenSpacesMoreBtn').onclick=()=>{showAllHiddenSpaces();$('spaceMoreDialog').style.display='none';};
$('toggleDoorsBtn').onclick=()=>{toggleDoorsForActiveSpace();};
$('newAdjacentSpaceBtn').onclick=()=>{if(state.visualMode)setVisualMode(false,{notify:false,frame:false});const root=activeSpaceRoot();$('spaceMoreDialog').style.display='none';openNewSpaceDialog(root);};
$('exportFurnitureBtn').onclick=()=>{exportSelectedFurniture();};
$('exportAspireBtn').onclick=()=>{exportSelectedAspireDxf();};

$('closeProductionDialog').onclick=closeProductionDialog;
$('productionDialog').addEventListener('pointerdown',e=>{if(e.target===$('productionDialog'))closeProductionDialog();});
$('productionMaterialSelect').addEventListener('change',()=>{if($('productionMaterialSelect').value)productionLoadMaterialFields();});
$('productionMaterialKind')?.addEventListener('change',productionUpdateMaterialKindFields);
$('productionBandSelect').addEventListener('change',()=>{if($('productionBandSelect').value)productionLoadBandFields();});
$('productionMaterialNew').onclick=productionNewMaterial;
$('productionMaterialEditStock').onclick=productionEditMaterialStock;
$('productionMaterialSave').onclick=productionSaveMaterial;
$('productionMaterialDelete').onclick=productionDeleteMaterial;
$('productionMaterialApply').onclick=productionApplyMaterial;
$('productionBandNew').onclick=productionNewBand;
$('productionBandSave').onclick=productionSaveBand;
$('productionBandDelete').onclick=productionDeleteBand;
document.querySelectorAll('[data-edge-key]').forEach(sel=>sel.addEventListener('change',()=>productionAssignEdge(sel.dataset.edgeKey,sel.value)));
$('productionClearBands').onclick=productionClearSelectedBands;
$('openLabelsFromProduction').onclick=()=>{closeProductionDialog();openLabelsDialog();};
$('printLabelsFromProduction').onclick=()=>{closeProductionDialog();labelsApplyPrefs();$('labelsScope').value='project';labelsSavePrefs();labelsPrint();};
$('labelsToolBtn').onclick=()=>openLabelsDialog();
$('closeLabelsDialog').onclick=closeLabelsDialog;
$('closeLabelsDialogTop').onclick=closeLabelsDialog;
$('labelsDialog').addEventListener('pointerdown',e=>{if(e.target===$('labelsDialog'))closeLabelsDialog();});
$('refreshLabelsPreview').onclick=renderLabelsPreview;
$('printLabelsBtn').onclick=labelsPrint;
$('saveLabelsHtml').onclick=labelsSaveHtml;
['labelsScope','labelsMode','labelsWidth','labelsHeight','labelsPaper','labelsMarginLeft','labelsMarginRight','labelsMarginTop','labelsMarginBottom','labelsGapHorizontal','labelsGapVertical','labelsSort','labelsShowProject','labelsShowSpace','labelsShowBands','labelsShowMachining','labelsShowGrain','labelsShowId'].forEach(id=>$(id).addEventListener(id.startsWith('labelsShow')?'change':'input',renderLabelsPreview));


// 1.311.00 · interface otimizada do plano de corte movida para js/modules/cut-plan-ui.js.

$('exportAspireFromPartsBtn').onclick=()=>{setSheetPrefs(sheetPrefsFromUi());exportProjectAspireZip();};
$('deleteSpaceBtn').onclick=()=>deleteSelectedSpaceRoot();
$('libraryLocalTab').onclick=()=>setLibraryScope('local');
$('libraryGlobalTab').onclick=()=>setLibraryScope('global');
$('libraryBackBtn').onclick=()=>{library.state.activeLibraryFolderId=null;renderLibrary();};
$('newLibraryFolderBtn').onclick=newLibraryFolder;
$('renameLibraryFolderBtn').onclick=renameActiveLibraryFolder;
$('deleteLibraryFolderBtn').onclick=deleteActiveLibraryFolder;
$('saveFurnitureLibraryBtn').onclick=saveCurrentFurnitureToLibrary;
$('importLibraryBtn').onclick=()=>{
  const ok=library.state.libraryScope==='global'?(adminAllowed()&&!!globalLibraryFolderById(library.state.activeLibraryFolderId)):!!libraryFolderById(library.state.activeLibraryFolderId);
  if(!ok){toast(library.state.libraryScope==='global'?'Abra uma pasta global como administrador':'Abra uma pasta para importar');return;}
  $('libraryImportFile').click();
};
$('libraryImportFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{await importLibraryFile(f);}catch(err){toast('Modelo inválido: '+(err.message||err));}
  e.target.value='';
});













$('visualModeMoreBtn').onclick=()=>setVisualMode(!state.visualMode,{frame:true});
$('xray3DBtn').onclick=()=>{toggleDockXray();$('morePanel').style.display='none';};
$('toggleHardwareVisibilityBtn').onclick=()=>toggleCadHardwareVisibility();
$('toggleMachiningVisibilityBtn').onclick=()=>toggleCadMachiningVisibility();
$('cancelPanel').onclick=()=>{$('newPanelDialog').style.display='none';};
$('createPanel').onclick=()=>{
  const w=clampSize(m($('newW').value)),d=clampSize(m($('newD').value)),h=clampSize(m($('newT').value));
  if(![w,d,h].every(Number.isFinite)){toast('Confira as medidas');return;}
  createBox({width:w,depth:d,height:h,name:$('newName').value.trim()||'Peça MDF',kind:'panel',materialType:'MDF',baseColor:COLORS.panel});
  $('newPanelDialog').style.display='none'; toast('Peça MDF criada');
};
document.querySelectorAll('[data-thickness]').forEach(b=>b.onclick=()=>{$('newT').value=b.dataset.thickness;});
$('applyExact').onclick=applyExactPanel;
$('pieceNamePresetSelect')?.addEventListener('change',e=>{if(e.target.value)applyPieceNamePreset(e.target.value);});
$('pieceNameCustomAddBtn')?.addEventListener('click',createPieceNamePreset);
$('pieceNameCustomInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();createPieceNamePreset();}});
$('applyPieceRelative').onclick=applyPieceRelativeConfig;
$('resetPieceRelative').onclick=resetPieceRelativeConfig;
$('duplicateBtn').onclick=requestDuplicateSelected;
$('confirmDuplicateBtn').onclick=confirmDuplicateSelected;
$('cancelDuplicateBtn').onclick=cancelDuplicateConfirmation;
$('deletePieceInspectorBtn').onclick=deleteSelectedFromInspector;


$('partNameInput').addEventListener('change',()=>{if(state.selected){state.selected.userData.name=$('partNameInput').value.trim()||'Peça';updateInspector();commitHistory();}});
$('pieceMaterialSearch')?.addEventListener('input',()=>fillPieceMaterialSelect(state.selected?.userData?.materialId||'',$('pieceMaterialSearch').value));
$('pieceMaterialSelect')?.addEventListener('change',updatePieceMaterialQuickInfo);
$('pieceMaterialApply')?.addEventListener('click',applySelectedPieceMaterialFromInspector);
$('pieceDoNotProduce').addEventListener('change',e=>setSelectedPieceDoNotProduce(e.target.checked));
$('rotatePieceGrainBtn').onclick=rotateSelectedPieceGrain;

// 1.311.00 · overlays e fechamento por clique externo movidos para js/modules/ui-overlays.js.

$('closeInspector').onclick=()=>{cancelDuplicateConfirmation();$('inspector').classList.add('compact');$('inspector').style.display='none';};

$('showInspectorBtn').onclick=()=>{if(!state.selected){toast('Selecione uma peça');return;}openPieceInspector(state.selected);};
$('openFurnitureSpaceBtn').onclick=()=>{openSpaceFromObject(state.selected);};
$('openLinkedSpaceBtn').onclick=()=>{openSpaceFromObject(state.selected);};
$('addHoleBtn').onclick=()=>openMachiningDialog('hole');
$('addGrooveBtn').onclick=()=>openMachiningDialog('groove');
$('addHardwareBtn').onclick=()=>openMachiningDialog('hardware');
$('addShapeBtn').onclick=()=>openShapeDialog();
$('copyShapeBtn').onclick=()=>openCopyShapeTool();
$('copyHardwareBtn').onclick=()=>openCopyHardwareTool();
$('copyHardwareFromDialog').onclick=()=>{$('machiningDialog').style.display='none';openCopyHardwareTool();};
$('manageMachiningBtn').onclick=()=>openMachiningDialog((state.selected?.userData?.machining||[])[0]?.type||'hole');
$('materialsToolBtn').onclick=openProductionDialog;
document.querySelectorAll('[data-machining-type]').forEach(b=>b.onclick=()=>{machiningShapes.state.machiningEditId=null;const type=b.dataset.machiningType;if(type==='shape'){openShapeDialog();return;}if(type==='slattedPanel'){$('machiningDialog').style.display='none';openSlattedPanelDialog();return;}setMachiningType(type,true);});
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
['shapeFolder','shapeName','shapeRadius'].forEach(id=>$(id)?.addEventListener('input',updateShapePreview));
$('shapeType')?.addEventListener('change',()=>{shapeCadSyncUi();updateShapePreview();});
document.querySelectorAll('[data-shape-cad-tool]').forEach(b=>b.addEventListener('click',()=>shapeCadSetTool(b.dataset.shapeCadTool)));
$('shapeCadUndo')?.addEventListener('click',shapeCadUndo);
$('shapeCadRedo')?.addEventListener('click',shapeCadRedo);
$('shapeCadClose')?.addEventListener('click',shapeCadCloseContour);
$('shapeCadClear')?.addEventListener('click',shapeCadClear);
$('shapeCadZoomIn')?.addEventListener('click',()=>shapeCadZoomBy(1.25));
$('shapeCadZoomOut')?.addEventListener('click',()=>shapeCadZoomBy(1/1.25));
$('shapeCadZoomFit')?.addEventListener('click',shapeCadFitView);
$('shapeCadGrid')?.addEventListener('input',shapeCadRender);
$('shapeCadSnap')?.addEventListener('change',()=>{machiningShapes.state.shapeCadState.hoverSnap=null;machiningShapes.state.shapeCadState.guides=[];shapeCadRender();});
$('shapeCadShowDims')?.addEventListener('change',shapeCadRender);
$('shapeCadSvg')?.addEventListener('pointerdown',shapeCadPointerDown);
$('shapeCadSvg')?.addEventListener('pointermove',shapeCadPointerMove);
$('shapeCadSvg')?.addEventListener('pointerup',shapeCadPointerUp);
$('shapeCadSvg')?.addEventListener('pointercancel',shapeCadPointerUp);
$('shapeCadSvg')?.addEventListener('pointerleave',shapeCadPointerLeave);
$('shapeCadSvg')?.addEventListener('wheel',shapeCadZoomWheel,{passive:false});
document.querySelectorAll('[data-shape-corner]').forEach(b=>b.addEventListener('click',()=>{const c=b.dataset.shapeCorner;if(machiningShapes.state.shapeSelectedCorners.has(c))machiningShapes.state.shapeSelectedCorners.delete(c);else machiningShapes.state.shapeSelectedCorners.add(c);refreshShapeCornerLabels();updateShapePreview();}));
$('previewShape3D').onclick=previewShape3D;
$('returnShapePreview').onclick=returnShapePreview;
$('applyShape').onclick=applyShapeToPiece;
$('cancelShape').onclick=closeShapeDialog;
$('shapeDialog').addEventListener('pointerdown',e=>{if(e.target===$('shapeDialog'))closeShapeDialog();});

document.querySelectorAll('[data-shape-mode]').forEach(b=>b.addEventListener('click',()=>shapeSetMode(b.dataset.shapeMode)));
$('shapeLocalTab')?.addEventListener('click',()=>setShapeLibraryScope('local'));
$('shapeGlobalTab')?.addEventListener('click',()=>setShapeLibraryScope('global'));
$('publishShapePreset')?.addEventListener('click',publishSelectedShapePresetGlobal);
$('shapeFormatType')?.addEventListener('change',shapeFormatTypeChanged);
['shapeFormatWidth','shapeFormatHeight','shapeFormatDiameter','shapeFormatCutW','shapeFormatCutH','shapeFormatCutX','shapeFormatCutY','shapeFormatRadius'].forEach(id=>$(id)?.addEventListener('input',updateShapePreview));
$('shapeFormatLCorner')?.addEventListener('change',updateShapePreview);
document.querySelectorAll('[data-shape-format-corner]').forEach(x=>x.addEventListener('change',updateShapePreview));
$('shapeApplyFormat')?.addEventListener('click',applyParametricFormatToPiece);
$('shapeCornerEditSvg')?.addEventListener('click',shapeCornerSelectFromEvent);
document.querySelectorAll('[data-shape-corner-style]').forEach(b=>b.addEventListener('click',()=>shapeSetCornerStyle(b.dataset.shapeCornerStyle)));
$('shapeCornerApplyOne')?.addEventListener('click',()=>shapeApplyCornerEdit(false));
$('shapeCornerApplyAll')?.addEventListener('click',()=>shapeApplyCornerEdit(true));
$('shapeCornerReset')?.addEventListener('click',shapeResetCorners);
$('shapeMirrorH')?.addEventListener('click',()=>shapeTransformEditor('h'));
$('shapeMirrorV')?.addEventListener('click',()=>shapeTransformEditor('v'));
$('shapeRotate90')?.addEventListener('click',()=>shapeTransformEditor('r'));


$('hardwarePresetSelect').addEventListener('change',updateHardwarePanel);
$('hardwareLocalTab').onclick=()=>setHardwareScope('local');
$('hardwareGlobalTab').onclick=()=>setHardwareScope('global');
$('createHardwarePreset').onclick=()=>openHardwareBuilder(null);
$('editHardwarePreset').onclick=()=>{const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(p)openHardwareBuilder(p);};
$('publishHardwarePreset').onclick=publishSelectedHardwarePreset;
$('deleteHardwarePreset').onclick=deleteSelectedHardwarePreset;
$('previewHardware3D').onclick=previewHardware3D;
$('applyHardware').onclick=applySelectedHardware;
$('cancelHardware').onclick=()=>{$('machiningDialog').style.display='none';machiningShapes.state.machiningEditId=null;};
['hardwareContactAxis','hardwareContactSide','hardwareBMode','hardwareAAnchor','hardwareBAnchor','hardwareBSeriesAnchor','hardwareBSeriesDirection'].forEach(id=>$(id).addEventListener('change',updateHardwareBuilderUi));
['hardwareContactTolerance','hardwareAOffset','hardwareBOffset','hardwareBEdge','hardwareBSeriesOffset','hardwareBSeriesCount','hardwareBSeriesStep','hardwareSourceDiameter','hardwareSourceDepth','hardwareTargetDiameter','hardwareTargetDepth','hardwareName'].forEach(id=>$(id).addEventListener('input',updateHardwareBuilderUi));
['hardwareSourceEnabled','hardwareTargetEnabled'].forEach(id=>$(id).addEventListener('change',updateHardwareBuilderUi));
function toggleHardwareSigned(id){const f=$(id);let n=parseDecimalInput(f.value);if(!Number.isFinite(n))n=0;f.value=nice(Math.abs(n)<1e-9?0:-n);updateHardwareBuilderUi();f.focus();}
$('hardwareAOffsetSign').onclick=()=>toggleHardwareSigned('hardwareAOffset');
$('hardwareBOffsetSign').onclick=()=>toggleHardwareSigned('hardwareBOffset');
$('hardwareBSeriesOffsetSign').onclick=()=>toggleHardwareSigned('hardwareBSeriesOffset');
$('hardwareExampleShelfPin').onclick=fillHardwareShelfPinExample;
$('hardwareExampleDowel').onclick=fillHardwareDowelExample;
$('cancelHardwareBuilder').onclick=()=>{$('hardwareBuilderDialog').style.display='none';productionMaterials.state.hardwareBuilderEditId=null;};
$('saveHardwareBuilder').onclick=saveHardwareBuilder;
$('hardwareBuilderDialog').addEventListener('pointerdown',e=>{if(e.target===$('hardwareBuilderDialog')){$('hardwareBuilderDialog').style.display='none';productionMaterials.state.hardwareBuilderEditId=null;}});

$('machiningBackGroove').addEventListener('change',()=>{updateBackGrooveVisibility();updateMachiningUI();});
$('machiningPresetBackGroove').onclick=applyBackGroovePreset;
$('saveMachining').onclick=saveMachining;
$('previewMachining3D').onclick=showMachining3DPreview;
$('returnMachiningPreview').onclick=()=>closeMachining3DPreview({reopen:true});
$('cancelMachining').onclick=()=>{clearMachiningDraftPreview();state.machiningPreviewActive=false;runtimeModel.machiningVisualGroup.visible=true;setDesignLabVisualizationOnly(false);$('machining3DPreviewBar').style.display='none';state.machiningPreviewOwner=null;$('machiningDialog').style.display='none';machiningShapes.state.machiningEditId=null;};
$('machiningDialog').addEventListener('pointerdown',e=>{if(e.target===$('machiningDialog')){clearMachiningDraftPreview();state.machiningPreviewActive=false;runtimeModel.machiningVisualGroup.visible=true;setDesignLabVisualizationOnly(false);$('machining3DPreviewBar').style.display='none';state.machiningPreviewOwner=null;$('machiningDialog').style.display='none';machiningShapes.state.machiningEditId=null;}});
$('rotX').onclick=()=>rotateBox('x'); $('rotY').onclick=()=>rotateBox('y'); $('rotZ').onclick=()=>rotateBox('z');
$('undoBtn').onclick=undo; $('redoBtn').onclick=redo; $('deleteBtn').onclick=deleteSelected;
$('clearGuidesBtn').onclick=()=>{ if(!runtimeModel.constructionGuides.length){toast('Não há guias');return;} clearConstructionGuides(); commitHistory(); toast('Guias removidas'); };
$('showHiddenSpacesBtn').onclick=()=>{ showAllHiddenSpaces(); $('morePanel').style.display='none'; };
$('importFurnitureBtn').onclick=()=>{ $('morePanel').style.display='none'; $('furnitureImportFile').click(); };
$('furnitureImportFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const parsed=await designLabFurnitureRecordFromFile(file);
    importFurnitureData(parsed.record);
    if(parsed.sketchup){
      toast(`SketchUp: ${parsed.recognized} peças importadas${parsed.skipped?' · '+parsed.skipped+' malhas ignoradas':''}. Confira medidas e espessuras antes de produzir.`);
    }else if(parsed.stl){
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
$('clearBtn').onclick=()=>{if(!runtimeModel.objects.length && !runtimeModel.constructionGuides.length && !runtimeModel.spaceRoots.length)return; clearScene();commitHistory();toast('Projeto limpo');};
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
$('homeSaveAsProject').onclick=$('menuSaveAsProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); if(projects.state.currentProjectId)openProjectMetaDialog('saveas'); };
$('homeSettings').onclick=$('menuAppSettings').onclick=()=>openAppSettings();
document.querySelectorAll('[data-app-theme-choice]').forEach(btn=>{
  btn.addEventListener('click',()=>applyDesignLabAppTheme(btn.dataset.appThemeChoice,{persist:true,notify:true}));
});
$('appSettingsClose').onclick=closeAppSettings;
$('appSettingsDialog').addEventListener('pointerdown',e=>{if(e.target===$('appSettingsDialog'))closeAppSettings();});
document.querySelectorAll('[data-cad-bg]').forEach(b=>b.addEventListener('click',()=>{
  applyCadBackground(b.dataset.cadBg,{persist:true,notify:true});
}));
$('cadGridVisibleSetting').addEventListener('change',e=>{
  applyCadGridVisibility(e.target.checked,{persist:true,notify:true});
});
$('cadGridQuickToggle')?.addEventListener('click',()=>applyCadGridVisibility(!state.cadGridVisible,{persist:true,notify:true}));
$('cadHideSelectedPieceQuick')?.addEventListener('click',hideSelectedPieceQuick);
$('cadShowHiddenPiecesQuick')?.addEventListener('click',showAllManuallyHiddenPieces);
$('cadDoorSystemQuick')?.addEventListener('click',openDoorSystemDialog);
$('cadFrontQuickToggle')?.addEventListener('click',()=>applyQuickFrontVisibility(!state.quickFrontFacesHidden,{notify:true}));
$('cadSpaceQuickToggle')?.addEventListener('click',quickToggleAllSpaces);
$('cadHideSelectedSpaceQuick')?.addEventListener('click',hideQuickSelectedSpace);
$('cadConfigQuickButton')?.addEventListener('click',openQuickSelectedConfiguration);
syncQuickSpaceVisibilityButton();
syncManualPieceVisibilityButtons();
$('cadShadowsVisibleSetting')?.addEventListener('change',e=>{
  applyCadShadows(e.target.checked,{persist:true,notify:true});
});
$('cadXrayVisibleSetting').addEventListener('change',e=>{
  applyXray3D(e.target.checked,{persist:true,notify:true});
});
$('menuOpenProjects').onclick=$('menuProjectHome').onclick=()=>showProjectHome();
$('menuRenameProject').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); if(projects.state.currentProjectId)openProjectMetaDialog('rename',projects.state.currentProjectRecord); };
$('menuDuplicateProject').onclick=async()=>{ $('projectMenuPanel').classList.remove('show'); if(projects.state.currentProjectId)await duplicateProjectById(projects.state.currentProjectId); };
$('menuExportProjectFile').onclick=()=>{ $('projectMenuPanel').classList.remove('show'); exportCurrentProjectFile(); };
$('projectMenuBtn').onclick=e=>{e.stopPropagation();$('projectMenuPanel').classList.toggle('show');};
$('presentationBack').onclick=()=>showProjectHome();
$('presentationEdit').onclick=enterProjectEditor;
$('projectMetaCancel').onclick=closeProjectMetaDialog;
$('projectMetaConfirm').onclick=async()=>{
  try{
    const meta=readProjectMeta();
    if(projects.state.projectMetaMode==='new')await createNewProject(meta);
    else if(projects.state.projectMetaMode==='saveas')await saveAsCurrentProject(meta);
    else await renameCurrentProject(meta,projects.state.currentProjectRecord);
  }catch(err){toast(err.message||'Não foi possível salvar os dados do projeto');}
};
$('projectMetaDialog').addEventListener('pointerdown',e=>{if(e.target===$('projectMetaDialog'))closeProjectMetaDialog();});
$('recoveryRestore').onclick=recoverPendingProject;
$('recoveryDiscard').onclick=discardPendingRecovery;
$('recoveryCancel').onclick=()=>{$('recoveryDialog').classList.remove('show');projects.state.pendingRecovery=null;};
$('cardMenuRename').onclick=async()=>{const rec=await projectDbGet(projects.state.projectCardMenuId);closeProjectCardMenu();if(rec)openProjectMetaDialog('rename',rec);};
$('cardMenuDuplicate').onclick=async()=>{const id=projects.state.projectCardMenuId;closeProjectCardMenu();if(id)await duplicateProjectById(id);};
$('cardMenuExport').onclick=async()=>{const id=projects.state.projectCardMenuId;closeProjectCardMenu();const rec=await projectDbGet(id);if(rec)await exportProjectRecordFile(rec);};
$('cardMenuDelete').onclick=async()=>{const id=projects.state.projectCardMenuId;if(id)await deleteProjectById(id);};
$('projectFileInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(typeof designLabRouteEnterWorkspace==='function')designLabRouteEnterWorkspace('presentation');
  try{await importProjectFile(file);}catch(err){toast(err.message||'Arquivo de projeto inválido');}
  e.target.value='';
});
document.addEventListener('pointerdown',e=>{
  if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(!e.target.closest('#projectMenuPanel')&&!e.target.closest('#projectMenuBtn'))$('projectMenuPanel').classList.remove('show');
  if(!e.target.closest('#projectCardMenu')&&!e.target.closest('[data-project-action="menu"]'))closeProjectCardMenu();
});
// Atalhos CAD no navegador desktop; sempre chamam as mesmas ações dos botões.
window.addEventListener('keydown',e=>{
  if(e.defaultPrevented || e.repeat || e.isComposing || e.altKey)return;
  const target=e.target;
  const editable='input,textarea,select,[contenteditable],[role="textbox"]';
  if(target?.closest?.(editable) || document.activeElement?.closest?.(editable))return;
  if(document.body.classList.contains('visualization-only') || document.body.classList.contains('presentation-active') || state.visualMode)return;
  if(window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(pointer: fine)').matches)return;
  const blockingIds=['authDialog','appSettingsDialog','deleteSpaceCellDialog','newSpaceDialog','editSpaceDialog','spaceMoreDialog','productionDialog','libraryDialog','machiningDialog','shapeDialog','projectVersionsDialog'];
  if(document.querySelector('.projectModal.show, [role="dialog"][open], [aria-modal="true"].show'))return;
  if(blockingIds.some(id=>{const el=$(id);return el && getComputedStyle(el).display!=='none' && getComputedStyle(el).visibility!=='hidden' && el.getClientRects().length>0;}))return;
  const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(mod){
    if(key==='d' && !e.shiftKey){if(!state.selected)return;e.preventDefault();requestDuplicateSelected();return;}
    if(key==='z'){e.preventDefault();(e.shiftKey?redo:undo)();return;}
    if(key==='y' && !e.shiftKey){e.preventDefault();redo();return;}
    return;
  }
  if(e.shiftKey)return;
  if(key==='delete'||key==='backspace'){
    if(state.selected){e.preventDefault();deleteSelectedFromInspector();return;}
    if(ctx.selectedSpaceCell?.rootId){e.preventDefault();openDeleteSelectedSpaceCellDialog();return;}
    if(ctx.activeSpaceRootId){e.preventDefault();deleteSelectedSpaceRoot();}
    return;
  }
  const tool={v:'select',m:'move-free',t:'tape'}[key];
  if(tool){e.preventDefault();ctx.setTool(tool);return;}
  if(key==='escape' && state.toolMode!=='select'){e.preventDefault();ctx.setTool('select');}
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
    if(e.shiftKey){if(projects.state.currentProjectId)openProjectMetaDialog('saveas');}
    else saveCurrentProject();
  }else if(key==='o'){
    e.preventDefault();$('projectFileInput').click();
  }else if(key==='n'){
    e.preventDefault();openProjectMetaDialog('new');
  }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){projectAutosaveNow();if(auth.currentIdentityUser&&cloudAccount.cloudAccountState.ok)saveCloudPreferences({silent:true});}});
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
  const cached=await loadOfflinePremiumLicense();
  if(cached.valid&&!navigator.onLine){await activateOfflinePremiumAccess(cached,{message:'Premium offline autorizado.'});return;}
  if(auth.identityClient){
    const user=auth.identityClient.currentUser?.();
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
$('settingsForceRefresh').onclick=forceDesignLabServerRefresh;
$('updateLaterBtn').onclick=closeUpdateDialog;
$('updateNowBtn').onclick=applyDesignLabUpdate;
$('updateDialog').addEventListener('pointerdown',e=>{if(e.target===$('updateDialog'))closeUpdateDialog();});

$('homeNavStart').onclick=()=>scrollProjectHomeTo('projectHome');
$('homeNavProjects').onclick=()=>scrollProjectHomeTo('homeRecentSection');
$('homeNavModeling').onclick=openHomeModeling;
$('homeNavMaterials').onclick=openHomeMaterials;
$('homeNavAccount').onclick=()=>scrollProjectHomeTo('projectWelcomeCard');


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
$('adminSavePaymentSettingsBtn')?.addEventListener('click',saveAdminSettings);
$('premiumPurchaseClose')?.addEventListener('click',closePremiumPurchase);
$('premiumPurchaseDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('premiumPurchaseDialog'))closePremiumPurchase();});
$('premiumPixCopyBtn')?.addEventListener('click',copyPremiumPix);
$('premiumPixPaidBtn')?.addEventListener('click',markPremiumPaymentPaid);
$('premiumPixVerifyBtn')?.addEventListener('click',verifyPremiumPayment);
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


  return true;
}
