
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { escapeHtml, roundMmNumber, nice, uid } from './modules/editor.js?v=1.310.00-r12';
import { createAuthModule, authUserName, authUserInitials } from './modules/auth.js?v=1.310.00-r12';
import { makeCadEdgeMaterial, makeBoxVisualEdges, updateCadEdgeResolution } from './modules/3d-engine.js?v=1.310.00-r12';
import { spaceSelectionKey, buildDoorRegionEnvelope, createDoorsDrawersModule } from './modules/doors-drawers.js?v=1.310.00-r12';
import { createCutPlanUiModule } from './modules/cut-plan-ui.js?v=1.310.00-r12';
import { createAdminModule } from './modules/admin.js?v=1.310.00-r12';
import { createMachiningShapesModule } from './modules/machining-shapes.js?v=1.310.00-r12';
import { createProductionMaterialsModule } from './modules/production-materials.js?v=1.310.00-r12';
import { createProjectsModule } from './modules/projects.js?v=1.310.00-r12';
import { createCurvedFurnitureModule } from './modules/curved-furniture.js?v=1.310.00-r12';
import { createLibraryModule } from './modules/library.js?v=1.310.00-r12';
import { createCadIoModule } from './modules/cad-io.js?v=1.310.00-r12';
import { createSpacesCutsModule } from './modules/spaces-cuts.js?v=1.310.00-r12';
import { createTapeMovementModule } from './modules/tape-movement.js?v=1.310.00-r12';
import { createCameraNavigationModule } from './modules/camera-navigation.js?v=1.310.00-r12';
import { createSelection3DModule } from './modules/selection-3d.js?v=1.310.00-r12';
import { createPieceEditorModule } from './modules/piece-editor.js?v=1.310.00-r12';
import { createTechnicalLayoutModule } from './modules/technical-layout.js?v=1.310.00-r12';
import { createProductionSuiteModule } from './modules/production-suite.js?v=1.310.00-r12';
import { createToolDockModule } from './modules/tool-dock.js?v=1.310.00-r12';
import { createGeometryCoreModule } from './modules/geometry-core.js?v=1.310.00-r12';
import { createPieceInspectorModule } from './modules/piece-inspector.js?v=1.310.00-r12';
import { createEditorHistoryModule } from './modules/editor-history.js?v=1.310.00-r12';
import { createPieceGeometryModule } from './modules/piece-geometry.js?v=1.310.00-r12';
import { createAppUpdateModule } from './modules/app-update.js?v=1.310.00-r12';
import { createCloudAccountModule } from './modules/cloud-account.js?v=1.310.00-r12';
import { createUiOverlaysModule } from './modules/ui-overlays.js?v=1.310.00-r12';
import { createBackNavigationModule } from './modules/back-navigation.js?v=1.310.00-r12';
import { bindUiEvents } from './modules/ui-events.js?v=1.310.00-r12';
import { startRuntimeBootstrap } from './modules/runtime-bootstrap.js?v=1.310.00-r12';
import { M_TO_MM,MM_TO_M,MIN_SIZE,MAX_SIZE,SNAP_THRESHOLD,REAIM_THRESHOLD_PX,CORNER_PICK_PX,CORNER_SNAP_PX,STORAGE_KEY,LEGACY_STORAGE_KEY_V22,LEGACY_STORAGE_KEY_V18,LEGACY_STORAGE_KEY_V15,LEGACY_STORAGE_KEY,LEGACY_STORAGE_KEY_V13,LEGACY_STORAGE_KEY_V12,LEGACY_STORAGE_KEY_V11,LEGACY_STORAGE_KEY_V10,LEGACY_STORAGE_KEY_V9,GUIDE_EXTENT,TAPE_AIM_SNAP_PX,TAPE_POINT_TOUCH_OFFSET_PX,TAPE_POINT_CORNER_SNAP_TOUCH_PX,TAPE_POINT_EDGE_SNAP_TOUCH_PX,TAPE_POINT_LINE_SNAP_TOUCH_PX,TAPE_POINT_CORNER_SNAP_MOUSE_PX,TAPE_POINT_EDGE_SNAP_MOUSE_PX,TAPE_POINT_LINE_SNAP_MOUSE_PX,TAPE_AXIS_ANGLE,EDGE_PICK_PX,EDGE_SNAP_PX,GUIDE_SNAP_PX,GUIDE_OBJECT_SNAP_WORLD,CAD_ZOOM_DEFAULT_SPEED,CAD_ZOOM_TOUCH_SPEED,CAD_ZOOM_CLOSE_SPEED,CAD_ZOOM_SLOW_ZONE,CAD_ZOOM_SURFACE_GAP,CAD_ZOOM_NEAR_DEFAULT,CAD_ZOOM_NEAR_MIN,AXIS_INFERENCE_ANGLE,AXIS_INFERENCE_MIN_PX,COLORS } from './modules/runtime-config.js?v=1.310.00-r12';
import { createAppThemeModule } from './modules/app-theme.js?v=1.310.00-r12';
import { createSpaceHealingModule } from './modules/space-healing.js?v=1.310.00-r12';
import { createInteractionHelpers } from './modules/interaction-helpers.js?v=1.310.00-r12';
import { createProductionExportHelpers } from './modules/production-export-helpers.js?v=1.310.00-r12';
import { createToolController } from './modules/tool-controller.js?v=1.310.00-r12';
import { createSpaceEditorModule } from './modules/space-editor.js?v=1.310.00-r12';
import { createRuntimeHelpers } from './modules/runtime-helpers.js?v=1.310.00-r12';
import { createCadScene } from './modules/cad-scene.js?v=1.310.00-r12';
import { createRuntimeModel } from './modules/runtime-model.js?v=1.310.00-r12';
import { createModuleRegistry } from './modules/module-registry.js?v=1.310.00-r12';
import { installCadInputNavigation } from './modules/cad-input.js?v=1.310.00-r12';
import { CAD_APPEARANCE_KEYS, loadCadAppearancePreferences, cadBackgroundHex, cadFloorHex, createCadAppearanceModule } from './modules/cad-appearance.js?v=1.310.00-r12';
import { bindCurvedFurnitureUi } from './modules/curved-ui.js?v=1.310.00-r12';

// 1.310.00 · constantes compartilhadas em js/modules/runtime-config.js.

const $ = id => document.getElementById(id);
const runtimeHelpers=createRuntimeHelpers({THREE,roundMmNumber,M_TO_MM,MM_TO_M,MIN_SIZE,MAX_SIZE,$});
const {mm,m,clampSize,toast}=runtimeHelpers;
const moduleRegistry=createModuleRegistry();
window.__DESIGNLAB_APP_BOOTED='1.310.00-r12';
let auth=null;
let projects=null;
let projectIsoMs,cloudSaveProjectRecord,syncCloudProjects,claimLegacyProject,claimAllLegacyProjects,projectNow,projectStateHasContent,updateProjectHomeWelcome,scrollProjectHomeTo,openHomeModeling,openHomeMaterials,projectCurrentOwnerId,projectBelongsToCurrentOwner,projectEmergencyKey,prepareProjectAccountSwitch,applyProjectAccountScope,projectDbGet,projectDbPut,captureProjectCamera,restoreProjectCamera,captureProjectThumbnail,updateProjectChrome,markCurrentProjectDirty,projectAutosaveNow,applyProjectPresentationScene,resetProjectHistory,enterProjectEditor,renderProjectHome,showProjectHome,openProjectMetaDialog,closeProjectMetaDialog,readProjectMeta,createNewProject,saveCurrentProject,saveAsCurrentProject,renameCurrentProject,duplicateProjectById,deleteProjectById,exportProjectRecordFile,exportCurrentProjectFile,importProjectFile,requestOpenProject,recoverPendingProject,discardPendingRecovery,closeProjectCardMenu,initProjectHub;
let doorsDrawers=null;
let machiningShapes=null,productionMaterials=null,curvedFurniture=null;
let mmPrec=null,shapeCopyPieceEligible=null,shapeDeepClone=null;
let library=null,cadIo=null;
let spacesCuts=null;
let tapeMovement=null;
let cameraNavigation=null;
let resetSpaceDoubleTap=()=>{},updateLiveLabel=()=>{};
let selection3D=null,pieceEditor=null,cutPlanUi=null,technicalLayout=null,productionSuite=null;
let toolDockUi=null,geometryCore=null,pieceInspector=null,editorHistory=null,pieceGeometry=null;
let uiOverlays=null;
let backNavigation=null;
let spaceHealing=null,interactionHelpers=null,productionExportHelpers=null,toolController=null,spaceEditor=null;
let SPACE_HEAL_TOL=.0008,SPACE_HEAL_MAX_GAP=.120;
let cellAxisMin,cellAxisMax,setCellAxisMin,setCellAxisMax,tangentAxesForSpace,almostSpace,sameCellTangents,cellBox,boxAxisMin,boxAxisMax,setBoxAxisMin,setBoxAxisMax,boxOverlapMeters,boxesOverlapVolume,gapBoxBetweenCells,objectOccupiesSpaceGap,anotherCellOccupiesGap,mergedCellFromPair,repairOrphanSpaceGaps,repairAllOrphanSpaceGaps,bestCellNearPoint,isSpaceCuttingPieceForHeal,reclaimDeletedPieceSpace,deleteSelected;
let getClientPoint,getPointerNDC,intersectPlane,intersectGround,closestParamOnAxis,worldAxisForFace,worldToClient,inferMoveAxis,axisVector;
let flatPartInfo,layerNum,normalizedLayer,dxfPair,dxfLine,dxfClosedRect,dxfClosedPolyline,dxfCircle,machiningLayer,mapPlacedUV,projectOperation;
let ensureTapeModeChooser,openTapeModeChooser,setTool;
let axisCellMinKey,axisCellMaxKey,addFixedBandForCell,cellTangentWithin,cellTangentOverlapArea,cellTangentFaceArea,selectedCellEditPair,openEditSelectedSpaceDialog,openEditSpaceDialog,openNewSpaceDialog,applyCutSpacePrefs,cutSpaceCountValue,cutSideName,getCutSide=()=>'left',setCutSide=()=>{},updateCutPreview,updateEditSpacePreview,updateEditSelectedSpacePreview,resizeSelectedSpaceCell,closeEditSelectedSpaceDialog,updateNewSpacePreview;
let designLabRouteEnterWorkspace=()=>{},designLabRouteMarkHomeTop=()=>{},designLabRouteEnsureHomeRoot=()=>{},designLabRunNativeBackCascade=async()=> 'root';
let elementIsVisible=()=>false,closeInspectorOutside=()=>{},closeSpaceActionsOutside=()=>{},installOutsideMenuClose=()=>{};
let TOOL_DOCK_CATALOG=[],toolDockPrefs=[];
let syncToolDockButtons=()=>{},renderToolDock=()=>{},applyXray3D=()=>{},toggleDockXray=()=>{},closeToolDockBeforeMenu=()=>{},quickDockSubmenuVisible=()=>false,closeQuickDockSubmenu=()=>{},initQuickDock=()=>{},setToolDockOpen=()=>{},initSpaceActionsDrag=()=>{},restorePieceInspectorPosition=()=>{},initPieceInspectorFloating=()=>{},initToolDock=()=>{},saveToolDockPrefs=()=>{};
let setAllFaces,restoreBaseColor,createBox,createCylinder;
let selectObject,openPieceInspector,updateInspector,updateMeasureBadge;
let captureObjects,captureGuides,captureSpaces,captureState,stateString,commitHistory,clearConstructionGuides,clearScene,normalizeStateToGround,applyState,undo,redo;
let normalizePieceManualGeometryDelta,pieceGeometrySnapshot,accumulatePieceManualGeometryDelta,normalizePieceSavedConfig,loadPieceRelativeInputs,pieceParametricBaseFromRecord,pieceMappedGeometryWithManualDelta,pieceRelativeNumber,resetPieceRelativeInputs,pieceRelativeEditable,pieceLocalAxisVector,syncPieceRotationMetadata,applyPieceRelativeConfig,resetPieceRelativeConfig,setDimensions,applyExactPanel,rotateBox,rotateSelectedPieceGrain,setSelectedPieceDoNotProduce,cancelDuplicateConfirmation,requestDuplicateSelected,confirmDuplicateSelected,duplicateSelected,deleteSelectedFromInspector;
let savePieceThicknessPreference,savePieceCreateConfig,selectPieceCreateTypeButton,quickCreatePieceFromTypeButton,openCreatePiecesDialog,updateCreatePiecesUI,createPiecesInSelectedCell;
let openTechnicalLayoutDialog,dlLayoutState,dlLayoutIsDoor,dlLayoutIsFront,dlLayoutPopulateScope,dlLayoutBuildDirectCanvas,dlLayoutDownloadBlob,dlLayoutCanvasJpegData,dlLayoutPdfWithJpegs,dlLayoutWithTemporaryState,closeLayoutPrintPreview;
let dlLinearPieceLengthMm,dlPackMetalBars,dlWoodPlanGroups,dlMetalPlanGroups,dlRenderGeneralPartsSummary=()=>{},dlRenderInlineLinearPlans=()=>{};
let buildAspireSheetEntities,previewEntityFace,previewEdgeHoleMarkers,sheetPreviewStats,sheetPreviewPlacedOutline,sheetPreviewPartBounds,pointInPreviewPart,polygonAreaMm2,cutPlanPartAreaMm2,sheetPreviewViewport,sheetPreviewPointerToWorld,normalizedSheetPrefs,getSheetPrefs,setSheetPrefs,sheetPrefsFromUi,applySheetPrefsToUi,sheetPrefsForPartGroup,partOrientations,csvLine,buildMingliZawFiles,buildPanelSawCutsCsv,buildPartsCsv,buildLabelsBaseCsv,buildMachiningCsv,buildSheetsCsv,groupPartArrayForAspire,allProjectFurnitureParts,allProjectProductionPartsByKind,groupAspireProjectParts,zipStore,isExportPickerCancel,exportLeafName,pickExportTarget,downloadExportFallback,writeExportTarget,exportProjectAspireZip,exportSelectedAspireDxf,cutPlanPartSignature,cutPlanAssignCodes,cutPlanPackOpen,renderPartsList,openPartsListDialog,prepareSheetPreviewGroups,refreshSheetPreviewSelect,openSheetPreview,closeSheetPreview,sheetPreviewDraw,updateSheetCutModeUi,exportPanelSawSequenceCsv,exportPanelSawMingliZaw,printCutPlan;
let cadZoomPhysicalObjects,cadZoomSurfaceDistance,cadZoomAdaptiveSpeed,cadZoomTuneNearPlane,cadZoomPrepareIn,cadZoomStableTouchDistance,cadZoomPrepareTouchIn,cadZoomResetOut,remember3DView,useCamera,orthographicFrustum,restoreTechnical2DTransparency,objectBelongsToRootFor2D,pieceIsCameraCover,applyTechnical2DTransparency,setViewModeBadge,returnTo3D;
let guideX,guideY,guideZ,inferenceLines,moveGrip,cornerMarker;
let getBounds,axisFeatures,findMoveSnap,snapFaceCoordinate,guide,makeDashedMaterial,setLinePoints,guideAxisColor,createConstructionGuide,tapePieceName,tapeSetBoxHelper,tapeMeasurablePieces,getTapePieceAtEvent,tapeClosestIntervalPoints,tapeDistanceBetweenPieces,tapeShowPieceDistance,tapeUpdatePiecePrompt,resetTapeMeasure,hideTapeCrosshair,clearLatchedTapeMeasurement,restoreCadNavigationAfterTape,closeTapeAfterCommittedMeasurement,tapePointAimEvent,tapePointAimClient,setTapeCrosshair,nearestAnyCornerToClient,getBoxEdges,refineTapeEdgeScreenPick,nearestAnyEdgeToClient,nearestEdgeOnMeshToClient,nearestGuideToClient,closestPointOnInfiniteLine,nearestGlobalAxisHit,nearestReferenceLineByRay,resolveTapeAim,getTapePick,distancePointToSegment2D,nearestGlobalAxisAtClient,inferTapeAxis,projectPointToAxis,activateTapeEdgeSource,parallelGuideGeometryFromPick,commitTapeParallelAtEvent,tapePointKindLabel,tapePointPickIsValid,tapeShowPointDistance,updateTapePointPreview,handleTapePointTap,updateTapePreview,createInfiniteAxisGuide,tapePickKey,handleTapeTap,getBoxCorners,getFaceCorners,nearestCornerToClient,findTargetCornerSnap,findMoveInferenceTarget,snapMovingObjectFeaturesToGuide,setMoveTargetMarker,showGuide,hideInference,showInference,hideGuides;
let getSpaceRoot,getSpaceCell,cellSize,cellCenter,disposeSpaceMeshes,updateSpaceSelectionVisuals,renderSpaces,referenceMeshes,applyQuickFrontVisibility,isManuallyHideablePiece,manuallyHiddenPieces,syncManualPieceVisibilityButtons,applyManualVisibilityToObject,hideSelectedPieceQuick,showAllManuallyHiddenPieces,hasIndividuallyHiddenSpaces,syncQuickSpaceVisibilityButton,applyQuickSpaceVisibility,showAllSpacesGeneral,quickToggleAllSpaces,hideQuickSelectedSpace,openQuickSelectedConfiguration,updateSpaceVisibilityToggleButton,largestVisibleCell,spaceCellLabel,nearestVisibleCell,toggleActiveSpaceVisibility,showAllHiddenSpaces,setSpaceActionCellMode,selectSpaceRootOnly,distanceSqPointToCell,bestVisibleCellForObject,rootForObject,openSpaceFromObject,activeSpaceRoot,clearSpaceSelection,selectSpaceCellByIds,createSpace,createSpaceFromState,viewSpace,perspectiveFrontToSpace,frontViewToSpace,setFrontWorldView,divideSelectedSpaceEvenly,applySelectedSpaceCut,cutSelectedSpace,rootBounds,mapPersistentFixedBands,updateAutoMachiningAfterPieceResize,isVerticalDivisionPiece,verticalDivisionNominalThicknessM,registerVerticalDivisionFixedBand,repairVerticalDivisionThickness,resizeSpaceRoot,objectInsideSpaceRoot,disposeObject,deleteSelectedSpaceRoot,cellContainsObjectCompletely,manualCutSibling,removeFixedBandForDeletedCell,removeManualCutNodeFromChain,expandManualCutParentBoundsAtDeletedBoundary,selectedSpaceCellDeleteContext,selectedSpaceCellDeletePreview,openDeleteSelectedSpaceCellDialog,deleteSelectedSpaceCell;
let persistLibrary,libraryFolderById,uniqueLibraryFolderName,createLibraryFolder,selectedCellInfo,createCabinetInCell,mergeIntervals,fixedIntervalsFromSpace,stableFixedIntervalsFromSpace,explicitFixedIntervalsFromManualCuts,stableFixedIntervalsForParametricSpace,fixedGapPlan,libraryPartRecordIsStructural,structuralFixedIntervalsFromPartRecords,structuralFixedIntervalsFromRoot,makeFixedAxisMapper,makeBalancedFixedAxisMapper,balancedAxisCellCrossArea,balancedAxisRootCrossArea,balancedAxisPrimaryBoundaries,balancedAxisSegmentFixedByCells,makeBalancedSpaceAxisMapper,layoutBoundsFromSpace,libraryCurvedConfigForTarget,libraryCurvedPostPlacementForTarget,copyLibraryPartMeta,createLibraryTemplatePart,libraryMapBounds,libraryCloneTargetManualCut,libraryTransformManualCut,libraryInstallSpaceTopology,libraryRemapPartCellRefs,libraryInfoForPart,placeCustomTemplate,placeLibraryItem,builtinLibraryItems,globalLibraryFolderById,setLibraryScope,globalTemplateFromFurniture,updateLibraryFolderUi,libraryItemElement,renderLibrary,openLibraryRoot,newLibraryFolder,renameActiveLibraryFolder,deleteActiveLibraryFolder,deleteLibraryItem,importLibraryTemplate,saveCurrentFurnitureToLibrary,slattedPanelEligible,slattedPanelReadConfig,slattedPanelLayoutFor,renderSlattedPanelPreview,openSlattedPanelDialog,closeSlattedPanelDialog,createSlattedPanel;
let safeFileName,downloadText,selectedFurnitureRoot,objectBounds,objectBelongsToRoot,furnitureObjects,captureFurniture,dxfModelCleanLayerName,dxfModelNumber,designLabUtf8ToBase64,designLabBase64ToUtf8,designLabDxfPayloadComments,dxfPairs,designLabRecordFromDxfPayload,dxfImportedPartName,dxfFallbackNewBounds,dxfFallbackAddPoint,dxfFallbackBoundsValid,dxfFallbackLayerThicknessMm,dxfFallbackObjectFrom3DBounds,dxfFallbackObjectFromPlanarBounds,dxfFallbackPlanarSpace,designLabFallbackRecordFromDxf,designLabFurnitureRecordFromImportedFile,designLabFurnitureRecordFromFile,importLibraryFile,exportSelectedFurniture,designLabStlTrailer,designLabRecordFromStlBuffer,furnitureModelTriangleCount,buildFurnitureModelStl,dxfModelFace,furnitureModelMeshes,buildFurnitureModelDxf,designLabIsMobileLike,projectMaxX,importFurnitureData;
let curvedPostSamplesMm,curvedPostPlacementFromSampleMm,curvedPostOutlineMm,createCurvedPost,createCurvedRib,createCurvedCover,openCurvedStructureDialog,curvedFieldNumber,updateCurvedStructurePreview,previewCurvedStructure3D,returnCurvedStructurePreview,createCurvedStructure;
let remapMachiningForPieceResize,cloneMachiningForTargetSize,cloneMachining,pieceThicknessInfo,axisLabel,entryAxisName,entryAxisSign,localCoordField,parseDecimalInput,grooveLengthIsFull,setGrooveLengthFull,syncGrooveLengthButton,toggleMachiningCoordSign,machiningRawCoord,resolvedMachiningCoords,shapeCadUndo,shapeCadRedo,shapeCadSetTool,shapeCadClear,shapeCadCloseContour,shapeCadRender,shapeCadPointerDown,shapeCadPointerMove,shapeCadPointerUp,shapeCadPointerLeave,shapeCadSyncUi,refreshShapeCornerLabels,loadSelectedShapePresetToEditor,newShapePreset,editSelectedShapePreset,saveShapePresetLibrary,deleteShapePresetLibrary,rebuildFormGeometry,updateShapePreview,openShapeDialog,previewShape3D,returnShapePreview,applyShapeToPiece,closeShapeDialog,updateMachiningPresetInfo,applySelectedMachiningPreset,saveCurrentMachiningPreset,deleteSelectedMachiningPreset,holeSeriesInstances,actualMachiningCount,updateHoleSeriesVisibility,updateBackGrooveVisibility,applyHole32Preset,applyBackGroovePreset,operationDepthMm,remapMachiningAxes,sanitizeMachiningForPiece,clearMachiningVisuals,renderMachiningVisuals,updateMachiningVisualTransforms,clearMachiningDraftPreview,showMachining3DPreview,closeMachining3DPreview,setMachiningType,setMachiningSurfaceCoordinate,updateMachiningUI,openMachiningDialog,saveMachining,shapeCadFitView,shapeCadZoomBy,shapeCadZoomWheel,setShapeLibraryScope,shapeFormatTypeChanged,applyParametricFormatToPiece,shapeCornerSelectFromEvent,shapeSetCornerStyle,shapeApplyCornerEdit,shapeResetCorners,shapeSetMode,shapeTransformEditor,publishSelectedShapePresetGlobal,openCopyShapeTool,closeCopyShapeTool,shapeCopyHandlePick;
let canonicalFactoryMaterialId,defaultProjectProduction,productionClone,productionColorInt,setProjectProductionState,mergeProjectProductionState,captureProductionState,productionMaterialById,productionMaterialUsesPieceThickness,productionMaterialKind,productionObjectKind,normalizePieceEdgeBands,applyPieceProductionEdgeColors,pieceEdgeBandSignature,pieceEdgeBandSummary,spaceDefaultMaterial,applySpaceDefaultMaterialToObject,applySpaceMaterialToExistingPieces,spaceMaterialText,normalizePieceGrainRotation,makeMaterials,refreshPieceNamePresetSelect,applyPieceNamePreset,createPieceNamePreset,fillPieceMaterialSelect,updatePieceMaterialQuickInfo,applySelectedPieceMaterialFromInspector,productionUpdateMaterialKindFields,productionLoadMaterialFields,productionLoadBandFields,openProductionDialog,closeProductionDialog,labelsPrefs,labelsSavePrefs,labelsApplyPrefs,labelsBuildItems,renderLabelsPreview,openLabelsDialog,closeLabelsDialog,labelsPrintDocument,labelsPrint,labelsSaveHtml,productionEditMaterialStock,productionNewMaterial,productionSaveMaterial,productionDeleteMaterial,productionApplyMaterial,productionNewBand,productionSaveBand,productionDeleteBand,productionAssignEdge,productionClearSelectedBands,fillSpaceMaterialSelect,preferredDefaultMaterialId,updateSpaceMaterialPreview,updateEditSpaceMaterialPreview,findHardwarePreset,setHardwareScope,objectBoundsMm,pointWithinPieceTangents,hardwareHoleOp,updateHardwarePanel,updateHardwareBuilderUi,openHardwareBuilder,saveHardwareBuilder,publishSelectedHardwarePreset,removeHardwareLinkedToObjects,deleteSelectedHardwarePreset,previewHardware3D,applySelectedHardware,fillHardwareShelfPinExample,fillHardwareDowelExample,openCopyHardwareTool,closeCopyHardwareTool,hardwareCopyHandlePick;
let spaceMultiSelectionEntries,spaceMultiSelectionInfo,ensureSpaceMultiSelectBar,updateSpaceMultiSelectBar,clearSpaceMultiSelection,setSingleSpaceDoorReference,toggleSpaceMultiSelection,pieceCreationTargetInfo,openDoorFromSpaceSelection,ensureSpaceQuickCreateMenu,closeSpaceQuickCreateMenu,prepareSpaceQuickMenuTarget,openSpaceQuickCreateMenu,pickSpaceCellAtClient,openDrawerFromSpaceSelection,isDoorObject,doorObjectsForRoot,doorObjectShouldBeVisible,syncQuickFrontVisibilityButton,applyDoorVisibility,applyAllDoorVisibility,updateDoorsToggleButton,toggleDoorsForActiveSpace,captureDoorCreateConfig,readDoorCreateConfig,applyDoorCreateConfig,saveDoorCreateConfig,doorFieldNumber,doorAutoHingeCount,doorHingeCountResolved,syncDoorCavaPositionOptions,doorCreationConfig,doorHingeSideForIndex,doorHingePositionsMm,doorHandleOwnerForVisual,doorHandleVisualSpec,updateDoorHandleVisualTransform,updateDoorHandleVisuals,createDoorHandleVisual,removeDoorHandleVisualsForOwners,doorMountPanelCandidate,appendDoorHingeDrilling,doorInspectorRuntimeConfig,removeDoorAutomaticHinges,setSelectedDoorHingeSide,updateDoorCreationVisibility,getDrawerSlideLibrary,setDrawerSlideLibrary,refreshDrawerSlideLibrarySelect,captureDrawerSlidePreset,saveDrawerSlidePresetLibrary,applyDrawerSlidePresetLibrary,deleteDrawerSlidePresetLibrary,drawerParseDrillOffsets,drawerDrillTableOffsets,drawerCatalogCodeForLength,drawerDrillDefaults,drawerDrillValuesFromUi,drawerAbsoluteDrillPositions,drawerSetDrillingUiFromPreset,updateDrawerDrillingFields,drawerPreset,drawerSetObjects,drawerSetRepresentative,drawerSetIdsForTarget,drawerPrimarySetIdForTarget,removeDrawerSetsForTarget,drawerConfigFromSet,drawerUniqueConfigsForRoot,drawerTarget,drawerAutoLengthMm,drawerResolvedLengthMm,drawerApplyPresetDefaults,drawerReadConfig,updateDrawerSystemPreview,updateDrawerBottomMachiningFields,updateDrawerFrontFields,openDrawerSystemDialog,drawerReferenceGeometry,drawerFindSidePanel,drawerRemoveMachining,drawerRemoveCabinetDrilling,removeDrawerSet,drawerCreatePiece,drawerAddBottomGroove,drawerRemoveBottomGrooves,drawerExpectedBottomGrooves,drawerBottomGrooveCount,drawerEnsureBottomGroovesForSet,repairDrawerBottomGroovesForRoot,repairAllDrawerBottomGrooves,drawerAddCabinetDrilling,createDrawerSetFromConfig,sanitizeDrawerSet,saveDrawerSystem,deleteDrawerSystem,rebuildDrawerSetsForRoot,doorSystemReadOversizePrefs,doorSystemPreferredOversize,doorSystemRememberOversize,persistDoorLibrary,doorSystemBuiltinRecord,doorSystemBoundsFromParts,doorSystemDetectFacePartIds,doorSystemBuiltinModels,doorSystemIsBuiltinId,doorSystemGlobalMeta,doorSystemHiddenBuiltinIds,doorSystemVisibleOfficialItems,doorSystemModels,doorSystemModelById,doorSystemTemplateItem,doorSystemSelectedRoot,doorSystemDefaultPosition,doorSystemCloudStatusText,doorSystemUpdateAdminUi,doorSystemUpdateModelInfo,renderDoorSystemModels,loadGlobalDoorModels,doorSystemEnsureModelRecord,openDoorSystemDialog,closeDoorSystemDialog,doorSystemUseSelectedDimensions,doorSystemCreate,doorSystemModelPayloadFromRoot,doorSystemPayloadFromModel,doorSystemAdminAddNew,doorSystemAdminReplaceSelected,doorSystemAdminRenameSelected,doorSystemAdminDeleteSelected,doorSystemAdminRestoreBuiltin,saveSelectedDoorModel,deleteSelectedDoorModel,drawerLevelsFromSet,drawerForceNearestSidePair,drawerAddCabinetDrillingOnOwners,repairDrawerDrillingForRoot,repairAllDrawerDrillingForAspire,createDoorsInRegion,resetDrawerDialogState,bindDoorsDrawersUI;

// 1.310.00 · estado do gerenciador de projetos movido para js/modules/projects.js.

// 1.310.00 · atualização/PWA extraídos para js/modules/app-update.js.
let appUpdate=null;
let DESIGNLAB_APP_VERSION='1.310.00',DESIGNLAB_JS_BUILD='1.310.00-r12';
let designLabRuntimeBuild=()=>'',setDesignLabVisualizationOnly=()=>{},designLabVisualizationOnlyActive=()=>false,checkDesignLabUpdate=async()=>null,applyDesignLabUpdate=async()=>{},forceDesignLabServerRefresh=async()=>{},initDesignLabInstallExperience=()=>{},initDesignLabServiceWorker=async()=>null,showBannedAccount=()=>{},updateCacheStatusUI=()=>{},closeUpdateDialog=()=>{};

let isLocalAuthDevelopment,offlineLicensePublicKey,offlineLicenseStoredToken,offlineLicenseLastSeenKey,clearOfflinePremiumLicense,verifyOfflinePremiumToken,loadOfflinePremiumLicense,storeOfflinePremiumLicense,offlineLicenseRecheckDue,scheduleOfflineLicenseExpiry,handleOfflineLicenseDeadline,showOfflineLicenseExpired,activateOfflinePremiumAccess,tryOfflinePremiumStartup,setAuthStatus,ensurePremiumAccessPanel,hidePremiumAccessPanel,premiumRenderQr,premiumMoney,premiumPurchaseSetStatus,closePremiumPurchase,renderPremiumPurchase,openPremiumPurchase,copyPremiumPix,markPremiumPaymentPaid,verifyPremiumPayment,stopPremiumAccessWatch,premiumWorkspaceAllowed,premiumUntilText,showPremiumAccessRequired,schedulePremiumAccessWatch,verifyPremiumWorkspaceAccess,updateIdentityChrome,lockOnlineApp,unlockOnlineApp,localAuthContinue,waitForNetlifyIdentity,bindIdentityEvents,initOnlineIdentity,authFriendlyError,showAuthInlineForm,authSetBusy,getReadyGoTrue,authSubmitLogin,authSubmitSignup,authSubmitForgot,openIdentityMode,logoutOnlineIdentity;

let cloudAccount=null;
let cloudApiFetch=async()=>{throw new Error('Nuvem ainda não inicializada');},syncCloudAccount=async()=>null,syncCloudPreferences=async()=>null,saveCloudPreferences=async()=>null,updateCloudAccountChrome=()=>{};
cloudAccount=createCloudAccountModule({
  $,escapeHtml,toast,authUserName,
  updateAdminVisibility:(...a)=>moduleRegistry.callIfReady('admin','updateAdminVisibility',...a),
  getAuth:()=>auth,
  storeOfflinePremiumLicense:(...a)=>moduleRegistry.callIfReady('auth','storeOfflinePremiumLicense',...a),
  premiumWorkspaceAllowed:(...a)=>moduleRegistry.callIfReady('auth','premiumWorkspaceAllowed',...a),
  clearOfflinePremiumLicense:(...a)=>moduleRegistry.callIfReady('auth','clearOfflinePremiumLicense',...a),
  showPremiumAccessRequired:(...a)=>moduleRegistry.callIfReady('auth','showPremiumAccessRequired',...a),
  syncCloudProjects:(...a)=>moduleRegistry.callIfReady('projects','syncCloudProjects',...a),
  renderProjectHome:(...a)=>moduleRegistry.callIfReady('projects','renderProjectHome',...a),
  showBannedAccount:(...a)=>moduleRegistry.callIfReady('appUpdate','showBannedAccount',...a)
});
({cloudApiFetch,syncCloudAccount,syncCloudPreferences,saveCloudPreferences,updateCloudAccountChrome}=cloudAccount);
moduleRegistry.register('cloudAccount',cloudAccount);

const admin=createAdminModule({
  $,escapeHtml,toast,cloudApiFetch,
  getCloudAccountState:()=>cloudAccount.cloudAccountState,
  getCurrentIdentityUser:()=>auth?.currentIdentityUser
});
const {
  adminPanelState,
  adminAllowed,
  updateAdminVisibility,
  adminMoney,
  adminDate,
  adminSetStatus,
  adminSetTab,
  renderAdminStats,
  renderAdminUsers,
  renderAdminPayments,
  renderAdminSettings,
  loadAdminSettings,
  saveAdminSettings,
  loadAdminStats,
  loadAdminUsers,
  loadAdminPayments,
  refreshAdminPanel,
  openAdminPanel,
  closeAdminPanel,
  adminPremium,
  adminRevokePremium,
  adminBanUser,
  adminPaymentAction
}=admin;
moduleRegistry.register('admin',admin);

// 1.310.00 · sincronização e persistência de projetos movidas para js/modules/projects.js.

// 1.310.00 · preferências visuais, palco 3D e coleções centrais separados do runtime.
const appearancePrefs=loadCadAppearancePreferences();
let cadHardwareVisible=appearancePrefs.cadHardwareVisible;
let cadMachiningVisible=appearancePrefs.cadMachiningVisible;
let cadBackgroundMode=appearancePrefs.cadBackgroundMode;
let cadGridVisible=appearancePrefs.cadGridVisible;
let xray3DEnabled=appearancePrefs.xray3DEnabled;
let cadShadowsVisible=appearancePrefs.cadShadowsVisible;
let visualMode=false;
let quickFrontFacesHidden=false;
let quickSpacesHidden=false;

const container=$('canvas-container');
const appTheme=createAppThemeModule({toast});
const {syncDesignLabThemeButtons,applyDesignLabAppTheme}=appTheme;
moduleRegistry.register('appTheme',appTheme);

const cadScene=createCadScene({THREE,OrbitControls,container,cadBackgroundHex:()=>cadBackgroundHex(cadBackgroundMode),cadFloorHex:()=>cadFloorHex(cadBackgroundMode),cadShadowsVisible});
const {scene,perspectiveCamera,orthoCamera,renderer,cadRenderPixelRatio,dirLight,visualFloorMat,visualFloor,grid,worldAxisX,worldAxisY,worldAxisZ,groundPlane,controls}=cadScene;
let camera=perspectiveCamera;
let viewMode2D=false;
let current2DView=null;

const runtimeModel=createRuntimeModel({THREE,scene,$});

let machiningPreviewOwner=null;
let machiningPreviewActive=false;
let selectedSpaceCell=null;
let doorRegionSelectionMode=false;
let activeSpaceRootId=null;
let selected=null;
let toolMode='select';
let dragMode=null;
let dragChanged=false;
let dragStartState=null;
let activePointerId=null;
let downClientX=0,downClientY=0,gestureLocked=false;
let anchorCoord=0,lockedA=0,lockedB=0,grabSign=1;
let pullAxis='x';
let moveInferenceAxis=null;
let moveGrabIsCorner=false;
let moveGrabKind='face';
let moveCornerTarget=null;
let moveSnapKind=null;
let moveSnapText='';
let movingSpaceRoot=null;
let movingSpaceRootStart=null;
let movingSpaceCellStarts=[];
let movingSpaceObjectStarts=[];
let lastEdit=null;
let history=[],historyIndex=-1,historyMuted=false;
let tapeStart=null;
let tapeStartClient=null;
let tapePointerMoved=false;
let tapeLastTap={time:0,x:0,y:0};
let tapeHover=null;
let tapeEdgeSource=null;
let tapePendingEdge=null;
let tapeDragEdgeActive=false;
let tapeTouchActive=false;
let tapeTouchId=null;
let tapePointPinchNavigating=false;
let tapePointPinchSuppressUntil=0;
let tapeTouchStartX=0,tapeTouchStartY=0;
let tapeLastClientX=0,tapeLastClientY=0;
let tapeMouseActive=false;
let tapeAim=null;
let tapeConfirmGate={time:0,x:-9999,y:-9999};
let tapeLastConfirmedTap={time:0,x:-9999,y:-9999,key:''};
let desktopCadNavigation=false;
let last3DView={position:perspectiveCamera.position.clone(),up:perspectiveCamera.up.clone(),target:controls.target.clone()};
let cameraSwitching=false;

const cadAppearanceState={};
Object.defineProperties(cadAppearanceState,{
  cadHardwareVisible:{get:()=>cadHardwareVisible,set:v=>{cadHardwareVisible=!!v}},
  cadMachiningVisible:{get:()=>cadMachiningVisible,set:v=>{cadMachiningVisible=!!v}},
  cadBackgroundMode:{get:()=>cadBackgroundMode,set:v=>{cadBackgroundMode=v}},
  cadGridVisible:{get:()=>cadGridVisible,set:v=>{cadGridVisible=!!v}},
  xray3DEnabled:{get:()=>xray3DEnabled,set:v=>{xray3DEnabled=!!v}},
  cadShadowsVisible:{get:()=>cadShadowsVisible,set:v=>{cadShadowsVisible=!!v}},
  visualMode:{get:()=>visualMode,set:v=>{visualMode=!!v}},
  quickSpacesHidden:{get:()=>quickSpacesHidden,set:v=>{quickSpacesHidden=!!v}},
  selected:{get:()=>selected,set:v=>{selected=v}},
  activeSpaceRootId:{get:()=>activeSpaceRootId,set:v=>{activeSpaceRootId=v}},
  viewMode2D:{get:()=>viewMode2D,set:v=>{viewMode2D=!!v}},
  camera:{get:()=>camera,set:v=>{camera=v}},
  toolMode:{get:()=>toolMode,set:v=>{toolMode=v}},
  machiningPreviewActive:{get:()=>machiningPreviewActive,set:v=>{machiningPreviewActive=!!v}}
});
const cadAppearance=createCadAppearanceModule({runtimeModel,moduleRegistry,
  $,THREE,state:cadAppearanceState,scene,renderer,dirLight,visualFloor,visualFloorMat,grid,worldAxisX,worldAxisY,worldAxisZ,perspectiveCamera,orthoCamera,controls,COLORS,toast,
  getObjects:()=>runtimeModel.objects,getMachiningVisualGroup:()=>runtimeModel.machiningVisualGroup,getSpacePickMeshes:()=>runtimeModel.spacePickMeshes,getSpaceRoots:()=>runtimeModel.spaceRoots,getConstructionGuides:()=>runtimeModel.constructionGuides,
  getGuides:()=>({guideX,guideY,guideZ}),getInferenceLines:()=>inferenceLines,rootForObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','rootForObject',...a),getSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','getSpaceRoot',...a),objectInsideSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','objectInsideSpaceRoot',...a),
  updateDoorHandleVisualTransform:(...a)=>moduleRegistry.callIfReady('doorsDrawers','updateDoorHandleVisualTransform',...a),syncToolDockButtons:(...a)=>moduleRegistry.callIfReady('toolDockUi','syncToolDockButtons',...a),syncDesignLabThemeButtons,
  setDesignLabVisualizationOnly:(...a)=>moduleRegistry.callIfReady('appUpdate','setDesignLabVisualizationOnly',...a),restoreBaseColor:(...a)=>moduleRegistry.callIfReady('geometryCore','restoreBaseColor',...a),setAllFaces:(...a)=>moduleRegistry.callIfReady('geometryCore','setAllFaces',...a),remember3DView:(...a)=>moduleRegistry.callIfReady('cameraNavigation','remember3DView',...a),returnTo3D:(...a)=>moduleRegistry.callIfReady('cameraNavigation','returnTo3D',...a),isDesktopCadNavigation:()=>desktopCadNavigation
});
const {syncCadBackgroundButtons,applyCadGridVisibility,applyCadBackground,syncCadShadowSetting,applyCadShadows,openAppSettings,closeAppSettings,syncCadDetailVisibilityButtons,applyCadDetailVisibility,toggleCadHardwareVisibility,toggleCadMachiningVisibility,updateXray3DButton,xray3DActive,setPieceVisualEdgesVisible,applyVisualSceneState,visualFurnitureObjects,frameFurnitureVisual,setVisualMode}=cadAppearance;
moduleRegistry.register('cadAppearance',cadAppearance);
applyCadShadows(cadShadowsVisible,{persist:false,notify:false});
applyCadBackground(cadBackgroundMode,{persist:false});
applyCadGridVisibility(cadGridVisible,{persist:false});

appUpdate=createAppUpdateModule({runtimeModel,moduleRegistry,
  $,controls,toast,
  setTool:(...a)=>moduleRegistry.callIfReady('toolController','setTool',...a),
  setDragMode:v=>{dragMode=v;},
  getProjects:()=>projects,
  projectAutosaveNow:(...a)=>moduleRegistry.callIfReady('projects','projectAutosaveNow',...a),
  setCloudAccountBanned:v=>{if(cloudAccount?.cloudAccountState)cloudAccount.cloudAccountState.banned=!!v;},
  setAuthStatus:(...a)=>moduleRegistry.callIfReady('auth','setAuthStatus',...a)
});
({DESIGNLAB_APP_VERSION,DESIGNLAB_JS_BUILD,designLabRuntimeBuild,setDesignLabVisualizationOnly,designLabVisualizationOnlyActive,checkDesignLabUpdate,applyDesignLabUpdate,forceDesignLabServerRefresh,initDesignLabInstallExperience,initDesignLabServiceWorker,showBannedAccount,updateCacheStatusUI,closeUpdateDialog}=appUpdate);
moduleRegistry.register('appUpdate',appUpdate);

// 1.310.00 · cad-input é instalado depois de camera-navigation.
const cadZoomRaycaster=new THREE.Raycaster();
const cadZoomNdc=new THREE.Vector2();

// 1.310.00 · mm/m/clamp/toast em js/modules/runtime-helpers.js.

// ============================================================================
// 1.100.16 · PRODUÇÃO: MATERIAIS, FITAS E BASE PARA ETIQUETAS
// ============================================================================
// 1.310.00 · domínio movido para módulo (3697-4187).
// 1.310.00 · bloco movido para módulo dedicado.

// 1.310.00 · bloco movido para módulo dedicado.

// 1.310.00 · Trena/guias/inferência movidas para js/modules/tape-movement.js.

// 1.310.00 · bloco movido para módulo dedicado.



// ============================================================================
// 1.100.32 · AJUSTES RELATIVOS / POR FACE
// ============================================================================

// 1.200.95 · CONFIGURAÇÃO MANUAL PERSISTENTE DA PEÇA
// ----------------------------------------------------
// manualGeometryDelta guarda o efeito geométrico LÍQUIDO de tudo que o usuário
// alterou pela configuração da peça. É propositalmente independente do tamanho
// do móvel: no redimensionamento/Biblioteca primeiro recalculamos a peça-base e
// só então reaplicamos estes deltas em metros (e rotações em radianos).
// 1.310.00 · bloco movido para módulo dedicado.

// 1.310.00 · reparo de vãos/exclusão em js/modules/space-healing.js.

// 1.310.00 · helpers de interação em js/modules/interaction-helpers.js.

// 1.310.00 · seleção 3D e gestos movidos para js/modules/selection-3d.js.

// 1.310.00 · criação de peças movida para js/modules/piece-editor.js.

// ---------- Biblioteca / modelos ----------
// 1.310.00 · domínio movido para js/modules/library.js.

// ---------- Importação / exportação CAD ----------
// 1.310.00 · domínio movido para js/modules/cad-io.js.

// 1.310.00 · helpers de produção/DXF em js/modules/production-export-helpers.js.

// 1.310.00 · prévia/exportação/plano de corte movidos para js/modules/cut-plan-ui.js.

// 1.310.00 · controle de ferramentas/Trena em js/modules/tool-controller.js.

// 1.310.00 · edição/criação/corte de espaços em js/modules/space-editor.js.

// 1.310.00 · helpers centrais extraídos do runtime.
spaceHealing=createSpaceHealingModule({runtimeModel,moduleRegistry,
  state:{get selected(){return selected;},set selected(v){selected=v;}},
  objectInsideSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','objectInsideSpaceRoot',...a),pieceThicknessInfo:(...a)=>moduleRegistry.callIfReady('machiningShapes','pieceThicknessInfo',...a),getBounds:(...a)=>moduleRegistry.callIfReady('tapeMovement','getBounds',...a),uid,rootBounds:(...a)=>moduleRegistry.callIfReady('spacesCuts','rootBounds',...a),renderSpaces:(...a)=>moduleRegistry.callIfReady('spacesCuts','renderSpaces',...a),distanceSqPointToCell:(...a)=>moduleRegistry.callIfReady('spacesCuts','distanceSqPointToCell',...a),isDoorObject:(...a)=>moduleRegistry.callIfReady('doorsDrawers','isDoorObject',...a),isVerticalDivisionPiece:(...a)=>moduleRegistry.callIfReady('spacesCuts','isVerticalDivisionPiece',...a),rootForObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','rootForObject',...a),removeHardwareLinkedToObjects:(...a)=>moduleRegistry.callIfReady('productionMaterials','removeHardwareLinkedToObjects',...a),removeDoorHandleVisualsForOwners:(...a)=>moduleRegistry.callIfReady('doorsDrawers','removeDoorHandleVisualsForOwners',...a),disposeObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','disposeObject',...a),selectObject:(...a)=>moduleRegistry.callIfReady('pieceInspector','selectObject',...a),removeDrawerSet:(...a)=>moduleRegistry.callIfReady('doorsDrawers','removeDrawerSet',...a),toast,renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),commitHistory:(...a)=>moduleRegistry.callIfReady('editorHistory','commitHistory',...a),largestVisibleCell:(...a)=>moduleRegistry.callIfReady('spacesCuts','largestVisibleCell',...a),selectSpaceCellByIds:(...a)=>moduleRegistry.callIfReady('spacesCuts','selectSpaceCellByIds',...a),selectSpaceRootOnly:(...a)=>moduleRegistry.callIfReady('spacesCuts','selectSpaceRootOnly',...a)
});
({SPACE_HEAL_TOL,SPACE_HEAL_MAX_GAP,cellAxisMin,cellAxisMax,setCellAxisMin,setCellAxisMax,tangentAxesForSpace,almostSpace,sameCellTangents,cellBox,boxAxisMin,boxAxisMax,setBoxAxisMin,setBoxAxisMax,boxOverlapMeters,boxesOverlapVolume,gapBoxBetweenCells,objectOccupiesSpaceGap,anotherCellOccupiesGap,mergedCellFromPair,repairOrphanSpaceGaps,repairAllOrphanSpaceGaps,bestCellNearPoint,isSpaceCuttingPieceForHeal,reclaimDeletedPieceSpace,deleteSelected}=spaceHealing);
moduleRegistry.register('spaceHealing',spaceHealing);

interactionHelpers=createInteractionHelpers({runtimeModel,moduleRegistry,THREE,renderer,groundPlane,AXIS_INFERENCE_ANGLE,AXIS_INFERENCE_MIN_PX,getCamera:()=>camera});
({getClientPoint,getPointerNDC,intersectPlane,intersectGround,closestParamOnAxis,worldAxisForFace,worldToClient,inferMoveAxis,axisVector}=interactionHelpers);
moduleRegistry.register('interactionHelpers',interactionHelpers);

productionExportHelpers=createProductionExportHelpers({runtimeModel,moduleRegistry,
  roundMmNumber,pieceThicknessInfo:(...a)=>moduleRegistry.callIfReady('machiningShapes','pieceThicknessInfo',...a),curvedPostOutlineMm:(...a)=>moduleRegistry.callIfReady('curvedFurniture','curvedPostOutlineMm',...a),productionObjectKind:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionObjectKind',...a),productionClone:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionClone',...a)??JSON.parse(JSON.stringify(a[0]??null)),productionMaterialById:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionMaterialById',...a),normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,pieceEdgeBandSignature:(...a)=>moduleRegistry.callIfReady('productionMaterials','pieceEdgeBandSignature',...a)||'',pieceEdgeBandSummary:(...a)=>moduleRegistry.callIfReady('productionMaterials','pieceEdgeBandSummary',...a)||'',cloneMachining:(...a)=>moduleRegistry.callIfReady('machiningShapes','cloneMachining',...a)??[],entryAxisName:(...a)=>moduleRegistry.callIfReady('machiningShapes','entryAxisName',...a),entryAxisSign:(...a)=>moduleRegistry.callIfReady('machiningShapes','entryAxisSign',...a),axisLabel:(...a)=>moduleRegistry.callIfReady('machiningShapes','axisLabel',...a),operationDepthMm:(...a)=>moduleRegistry.callIfReady('machiningShapes','operationDepthMm',...a)??0,holeSeriesInstances:(...a)=>moduleRegistry.callIfReady('machiningShapes','holeSeriesInstances',...a)??[],resolvedMachiningCoords:(...a)=>moduleRegistry.callIfReady('machiningShapes','resolvedMachiningCoords',...a)??{}
});
({flatPartInfo,layerNum,normalizedLayer,dxfPair,dxfLine,dxfClosedRect,dxfClosedPolyline,dxfCircle,machiningLayer,mapPlacedUV,projectOperation}=productionExportHelpers);
moduleRegistry.register('productionExportHelpers',productionExportHelpers);

toolController=createToolController({runtimeModel,moduleRegistry,
  $,THREE,controls,toast,
  state:{get visualMode(){return visualMode;},get toolMode(){return toolMode;},set toolMode(v){toolMode=v;},get tapeTouchActive(){return tapeTouchActive;},set tapeTouchActive(v){tapeTouchActive=!!v;},get tapeTouchId(){return tapeTouchId;},set tapeTouchId(v){tapeTouchId=v;},get tapeMouseActive(){return tapeMouseActive;},set tapeMouseActive(v){tapeMouseActive=!!v;},get tapePointPinchNavigating(){return tapePointPinchNavigating;},set tapePointPinchNavigating(v){tapePointPinchNavigating=!!v;},get tapePointPinchSuppressUntil(){return tapePointPinchSuppressUntil;},set tapePointPinchSuppressUntil(v){tapePointPinchSuppressUntil=Number(v)||0;}},
  getTapeMovement:()=>tapeMovement,setToolDockOpen:(...a)=>moduleRegistry.callIfReady('toolDockUi','setToolDockOpen',...a),closeQuickDockSubmenu:(...a)=>moduleRegistry.callIfReady('toolDockUi','closeQuickDockSubmenu',...a),setVisualMode,resetTapeMeasure:(...a)=>moduleRegistry.callIfReady('tapeMovement','resetTapeMeasure',...a),hideTapeCrosshair:(...a)=>moduleRegistry.callIfReady('tapeMovement','hideTapeCrosshair',...a),syncToolDockButtons:(...a)=>moduleRegistry.callIfReady('toolDockUi','syncToolDockButtons',...a)
});
({ensureTapeModeChooser,openTapeModeChooser,setTool}=toolController);
moduleRegistry.register('toolController',toolController);

spaceEditor=createSpaceEditorModule({runtimeModel,moduleRegistry,
  $,mm,m,nice,toast,escapeHtml,rootBounds:(...a)=>moduleRegistry.callIfReady('spacesCuts','rootBounds',...a),cellAxisMin,cellAxisMax,cellBox,activeSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','activeSpaceRoot',...a),parseDecimalInput:(...a)=>moduleRegistry.callIfReady('machiningShapes','parseDecimalInput',...a),getBounds:(...a)=>moduleRegistry.callIfReady('tapeMovement','getBounds',...a),mergeIntervals:(...a)=>moduleRegistry.call('library','mergeIntervals',...a),tangentAxesForSpace,productionMaterialById:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionMaterialById',...a),cellSize:(...a)=>moduleRegistry.callIfReady('spacesCuts','cellSize',...a),getSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','getSpaceRoot',...a),getSpaceCell:(...a)=>moduleRegistry.callIfReady('spacesCuts','getSpaceCell',...a),remapMachiningForPieceResize:(...a)=>moduleRegistry.callIfReady('machiningShapes','remapMachiningForPieceResize',...a),rebuildFormGeometry:(...a)=>moduleRegistry.callIfReady('machiningShapes','rebuildFormGeometry',...a),updateAutoMachiningAfterPieceResize:(...a)=>moduleRegistry.callIfReady('spacesCuts','updateAutoMachiningAfterPieceResize',...a),sanitizeMachiningForPiece:(...a)=>moduleRegistry.callIfReady('machiningShapes','sanitizeMachiningForPiece',...a),fixedIntervalsFromSpace:(...a)=>moduleRegistry.call('library','fixedIntervalsFromSpace',...a),objectInsideSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','objectInsideSpaceRoot',...a),isVerticalDivisionPiece:(...a)=>moduleRegistry.callIfReady('spacesCuts','isVerticalDivisionPiece',...a),registerVerticalDivisionFixedBand:(...a)=>moduleRegistry.callIfReady('spacesCuts','registerVerticalDivisionFixedBand',...a),rebuildDrawerSetsForRoot:(...a)=>moduleRegistry.callIfReady('doorsDrawers','rebuildDrawerSetsForRoot',...a),renderSpaces:(...a)=>moduleRegistry.callIfReady('spacesCuts','renderSpaces',...a),applyDoorVisibility:(...a)=>moduleRegistry.callIfReady('doorsDrawers','applyDoorVisibility',...a),renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),updateMeasureBadge:(...a)=>moduleRegistry.callIfReady('pieceInspector','updateMeasureBadge',...a),commitHistory:(...a)=>moduleRegistry.callIfReady('editorHistory','commitHistory',...a),makeFixedAxisMapper:(...a)=>moduleRegistry.callIfReady('library','makeFixedAxisMapper',...a),selectSpaceCellByIds:(...a)=>moduleRegistry.callIfReady('spacesCuts','selectSpaceCellByIds',...a),resizeSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','resizeSpaceRoot',...a),fillSpaceMaterialSelect:(...a)=>moduleRegistry.callIfReady('productionMaterials','fillSpaceMaterialSelect',...a),updateEditSpaceMaterialPreview:(...a)=>moduleRegistry.callIfReady('productionMaterials','updateEditSpaceMaterialPreview',...a),applySpaceMaterialToExistingPieces:(...a)=>moduleRegistry.callIfReady('productionMaterials','applySpaceMaterialToExistingPieces',...a),preferredDefaultMaterialId:(...a)=>moduleRegistry.callIfReady('productionMaterials','preferredDefaultMaterialId',...a),selectedCellInfo:(...a)=>moduleRegistry.callIfReady('library','selectedCellInfo',...a),updateSpaceMaterialPreview:(...a)=>moduleRegistry.callIfReady('productionMaterials','updateSpaceMaterialPreview',...a),projectCurrentOwnerId:(...a)=>moduleRegistry.callIfReady('projects','projectCurrentOwnerId',...a),createSpace:(...a)=>moduleRegistry.callIfReady('spacesCuts','createSpace',...a),setVisualMode,applySelectedSpaceCut:(...a)=>moduleRegistry.callIfReady('spacesCuts','applySelectedSpaceCut',...a),
  get selectedSpaceCell(){return selectedSpaceCell;},get visualMode(){return visualMode;}
});
({axisCellMinKey,axisCellMaxKey,addFixedBandForCell,cellTangentWithin,cellTangentOverlapArea,cellTangentFaceArea,selectedCellEditPair,openEditSelectedSpaceDialog,openEditSpaceDialog,openNewSpaceDialog,applyCutSpacePrefs,cutSpaceCountValue,cutSideName,getCutSide,setCutSide,updateCutPreview,updateEditSpacePreview,updateEditSelectedSpacePreview,resizeSelectedSpaceCell,closeEditSelectedSpaceDialog,updateNewSpacePreview}=spaceEditor);
moduleRegistry.register('spaceEditor',spaceEditor);

// 1.310.00 · binding da interface de móvel curvo movido para js/modules/curved-ui.js.

const doorsDrawersState={};
Object.defineProperties(doorsDrawersState,{
  activeSpaceRootId:{get:()=>activeSpaceRootId,set:v=>{activeSpaceRootId=v}},
  cadHardwareVisible:{get:()=>cadHardwareVisible,set:v=>{cadHardwareVisible=v}},
  doorRegionSelectionMode:{get:()=>doorRegionSelectionMode,set:v=>{doorRegionSelectionMode=v}},
  historyMuted:{get:()=>historyMuted,set:v=>{historyMuted=v}},
  lastEdit:{get:()=>lastEdit,set:v=>{lastEdit=v}},
  pieceCreateType:{get:()=>pieceEditor?.state?.pieceCreateType||'left',set:v=>{if(pieceEditor)pieceEditor.state.pieceCreateType=v}},
  quickFrontFacesHidden:{get:()=>quickFrontFacesHidden,set:v=>{quickFrontFacesHidden=v}},
  selected:{get:()=>selected,set:v=>{selected=v}},
  selectedSpaceCell:{get:()=>selectedSpaceCell,set:v=>{selectedSpaceCell=v}},
  visualMode:{get:()=>visualMode,set:v=>{visualMode=v}}
});
// ============================================================================
// 1.310.00 · DOMÍNIOS EXTRAÍDOS DO RUNTIME
// ============================================================================
// 1.310.00 · núcleo do runtime agora também é modular.
geometryCore=createGeometryCoreModule({runtimeModel,moduleRegistry,
  $,THREE,COLORS,clampSize,
  canonicalFactoryMaterialId:(...a)=>moduleRegistry.callIfReady('productionMaterials','canonicalFactoryMaterialId',...a),productionMaterialById:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionMaterialById',...a),productionColorInt:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionColorInt',...a),makeMaterials:(...a)=>moduleRegistry.callIfReady('productionMaterials','makeMaterials',...a),normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,normalizePieceEdgeBands:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceEdgeBands',...a)??{},uid,productionClone:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionClone',...a)??JSON.parse(JSON.stringify(a[0]??null)),applySpaceDefaultMaterialToObject:(...a)=>moduleRegistry.callIfReady('productionMaterials','applySpaceDefaultMaterialToObject',...a),makeCadEdgeMaterial,makeBoxVisualEdges,xray3DActive,scene,isDoorObject:(...a)=>moduleRegistry.callIfReady('doorsDrawers','isDoorObject',...a),getSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','getSpaceRoot',...a),doorObjectShouldBeVisible:(...a)=>moduleRegistry.callIfReady('doorsDrawers','doorObjectShouldBeVisible',...a)??true,rebuildFormGeometry:(...a)=>moduleRegistry.callIfReady('machiningShapes','rebuildFormGeometry',...a),applyPieceProductionEdgeColors:(...a)=>moduleRegistry.callIfReady('productionMaterials','applyPieceProductionEdgeColors',...a),renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),selectObject:(...a)=>moduleRegistry.callIfReady('pieceInspector','selectObject',...a),commitHistory:(...a)=>moduleRegistry.callIfReady('editorHistory','commitHistory',...a)
});
({setAllFaces,restoreBaseColor,createBox,createCylinder}=geometryCore);
moduleRegistry.register('geometryCore',geometryCore);

pieceInspector=createPieceInspectorModule({runtimeModel,moduleRegistry,
  $,state:{get selected(){return selected;},set selected(v){selected=v;},get lastEdit(){return lastEdit;},set lastEdit(v){lastEdit=v;},get visualMode(){return visualMode;},set visualMode(v){visualMode=!!v;},get selectedSpaceCell(){return selectedSpaceCell;},set selectedSpaceCell(v){selectedSpaceCell=v;}},
  clearSpaceSelection:(...a)=>moduleRegistry.callIfReady('spacesCuts','clearSpaceSelection',...a),restoreBaseColor,hideGuides:(...a)=>moduleRegistry.callIfReady('tapeMovement','hideGuides',...a),setAllFaces,COLORS,cancelDuplicateConfirmation:(...a)=>moduleRegistry.callIfReady('pieceGeometry','cancelDuplicateConfirmation',...a),syncManualPieceVisibilityButtons:(...a)=>moduleRegistry.callIfReady('spacesCuts','syncManualPieceVisibilityButtons',...a),designLabVisualizationOnlyActive,setVisualMode,restorePieceInspectorPosition:(...a)=>moduleRegistry.callIfReady('toolDockUi','restorePieceInspectorPosition',...a),pieceThicknessInfo:(...a)=>moduleRegistry.callIfReady('machiningShapes','pieceThicknessInfo',...a),normalizePieceEdgeBands:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceEdgeBands',...a)??{},fillPieceMaterialSelect:(...a)=>moduleRegistry.callIfReady('productionMaterials','fillPieceMaterialSelect',...a),refreshPieceNamePresetSelect:(...a)=>moduleRegistry.callIfReady('productionMaterials','refreshPieceNamePresetSelect',...a),rootForObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','rootForObject',...a),doorAutoHingeCount:(...a)=>moduleRegistry.callIfReady('doorsDrawers','doorAutoHingeCount',...a)??2,normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,loadPieceRelativeInputs:(...a)=>moduleRegistry.callIfReady('pieceGeometry','loadPieceRelativeInputs',...a),getSpaceCell:(...a)=>moduleRegistry.callIfReady('spacesCuts','getSpaceCell',...a),cellSize:(...a)=>moduleRegistry.callIfReady('spacesCuts','cellSize',...a),mm
});
({selectObject,openPieceInspector,updateInspector,updateMeasureBadge}=pieceInspector);
moduleRegistry.register('pieceInspector',pieceInspector);

editorHistory=createEditorHistoryModule({runtimeModel,moduleRegistry,
  state:{get history(){return history;},set history(v){history=v;},get historyIndex(){return historyIndex;},set historyIndex(v){historyIndex=v;},get historyMuted(){return historyMuted;},set historyMuted(v){historyMuted=!!v;}},THREE,canonicalFactoryMaterialId:(...a)=>moduleRegistry.callIfReady('productionMaterials','canonicalFactoryMaterialId',...a),normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,productionClone:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionClone',...a)??JSON.parse(JSON.stringify(a[0]??null)),captureProductionState:(...a)=>moduleRegistry.callIfReady('productionMaterials','captureProductionState',...a),STORAGE_KEY,markCurrentProjectDirty:(...a)=>moduleRegistry.callIfReady('projects','markCurrentProjectDirty',...a),scene,resetTapeMeasure:(...a)=>moduleRegistry.callIfReady('tapeMovement','resetTapeMeasure',...a),clearMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','clearMachiningVisuals',...a),getProductionMaterials:()=>productionMaterials,defaultProjectProduction:(...a)=>moduleRegistry.callIfReady('productionMaterials','defaultProjectProduction',...a),disposeObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','disposeObject',...a),disposeSpaceMeshes:(...a)=>moduleRegistry.callIfReady('spacesCuts','disposeSpaceMeshes',...a),clearSpaceSelection:(...a)=>moduleRegistry.callIfReady('spacesCuts','clearSpaceSelection',...a),selectObject,setProjectProductionState:(...a)=>moduleRegistry.callIfReady('productionMaterials','setProjectProductionState',...a),createCylinder,createCurvedRib:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedRib',...a),createCurvedCover:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedCover',...a),createCurvedPost:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedPost',...a),createBox,createConstructionGuide:(...a)=>moduleRegistry.callIfReady('tapeMovement','createConstructionGuide',...a),createSpaceFromState:(...a)=>moduleRegistry.callIfReady('spacesCuts','createSpaceFromState',...a),repairVerticalDivisionThickness:(...a)=>moduleRegistry.callIfReady('spacesCuts','repairVerticalDivisionThickness',...a),repairOrphanSpaceGaps,removeDrawerSet:(...a)=>moduleRegistry.callIfReady('doorsDrawers','removeDrawerSet',...a),drawerEnsureBottomGroovesForSet:(...a)=>moduleRegistry.callIfReady('doorsDrawers','drawerEnsureBottomGroovesForSet',...a),renderSpaces:(...a)=>moduleRegistry.callIfReady('spacesCuts','renderSpaces',...a),applyAllDoorVisibility:(...a)=>moduleRegistry.callIfReady('doorsDrawers','applyAllDoorVisibility',...a),applyManualVisibilityToObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','applyManualVisibilityToObject',...a),renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),applyCadDetailVisibility,syncManualPieceVisibilityButtons:(...a)=>moduleRegistry.callIfReady('spacesCuts','syncManualPieceVisibilityButtons',...a),toast
});
({captureObjects,captureGuides,captureSpaces,captureState,stateString,commitHistory,clearConstructionGuides,clearScene,normalizeStateToGround,applyState,undo,redo}=editorHistory);
moduleRegistry.register('editorHistory',editorHistory);

pieceGeometry=createPieceGeometryModule({runtimeModel,moduleRegistry,
  $,THREE,state:{get selected(){return selected;},set selected(v){selected=v;}},nice,m,MIN_SIZE,MAX_SIZE,toast,openDrawerSystemDialog:(...a)=>moduleRegistry.callIfReady('doorsDrawers','openDrawerSystemDialog',...a),renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),updateInspector,updateMeasureBadge,commitHistory,clampSize,rebuildFormGeometry:(...a)=>moduleRegistry.callIfReady('machiningShapes','rebuildFormGeometry',...a),remapMachiningForPieceResize:(...a)=>moduleRegistry.callIfReady('machiningShapes','remapMachiningForPieceResize',...a),sanitizeMachiningForPiece:(...a)=>moduleRegistry.callIfReady('machiningShapes','sanitizeMachiningForPiece',...a),remapMachiningAxes:(...a)=>moduleRegistry.callIfReady('machiningShapes','remapMachiningAxes',...a),normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,productionClone:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionClone',...a)??JSON.parse(JSON.stringify(a[0]??null)),createCylinder,createCurvedRib:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedRib',...a),createCurvedCover:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedCover',...a),createCurvedPost:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedPost',...a),createBox,openPieceInspector,deleteSelected
});
({normalizePieceManualGeometryDelta,pieceGeometrySnapshot,accumulatePieceManualGeometryDelta,normalizePieceSavedConfig,loadPieceRelativeInputs,pieceParametricBaseFromRecord,pieceMappedGeometryWithManualDelta,pieceRelativeNumber,resetPieceRelativeInputs,pieceRelativeEditable,pieceLocalAxisVector,syncPieceRotationMetadata,applyPieceRelativeConfig,resetPieceRelativeConfig,setDimensions,applyExactPanel,rotateBox,rotateSelectedPieceGrain,setSelectedPieceDoNotProduce,cancelDuplicateConfirmation,requestDuplicateSelected,confirmDuplicateSelected,duplicateSelected,deleteSelectedFromInspector}=pieceGeometry);
moduleRegistry.register('pieceGeometry',pieceGeometry);

uiOverlays=createUiOverlaysModule({runtimeModel,moduleRegistry,
  $,
  cancelDuplicateConfirmation,
  closeCopyHardwareTool:(...a)=>moduleRegistry.callIfReady('productionMaterials','closeCopyHardwareTool',...a),
  closeCopyShapeTool:(...a)=>moduleRegistry.callIfReady('machiningShapes','closeCopyShapeTool',...a),
  closeProjectCardMenu:(...a)=>moduleRegistry.callIfReady('projects','closeProjectCardMenu',...a),
  setToolDockOpen:(...a)=>moduleRegistry.callIfReady('toolDockUi','setToolDockOpen',...a),
  getProductionMaterials:()=>productionMaterials,
  getMachiningShapes:()=>machiningShapes
});
({elementIsVisible,closeInspectorOutside,closeSpaceActionsOutside,installOutsideMenuClose}=uiOverlays);
moduleRegistry.register('uiOverlays',uiOverlays);

toolDockUi=createToolDockModule({runtimeModel,moduleRegistry,
  $,state:{get cadShadowsVisible(){return cadShadowsVisible;},set cadShadowsVisible(v){cadShadowsVisible=!!v;},get current2DView(){return current2DView;},set current2DView(v){current2DView=v;},get cutSide(){return getCutSide();},set cutSide(v){setCutSide(v);},get selectedSpaceCell(){return selectedSpaceCell;},set selectedSpaceCell(v){selectedSpaceCell=v;},get selected(){return selected;},set selected(v){selected=v;},get toolMode(){return toolMode;},set toolMode(v){toolMode=v;},get viewMode2D(){return viewMode2D;},set viewMode2D(v){viewMode2D=!!v;},get visualMode(){return visualMode;},set visualMode(v){visualMode=!!v;},get xray3DEnabled(){return xray3DEnabled;},set xray3DEnabled(v){xray3DEnabled=!!v;},get cadHardwareVisible(){return cadHardwareVisible;},set cadHardwareVisible(v){cadHardwareVisible=!!v;},get cadMachiningVisible(){return cadMachiningVisible;},set cadMachiningVisible(v){cadMachiningVisible=!!v;}},
  activeSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','activeSpaceRoot',...a),applyCadShadows,applyCutSpacePrefs,
  // r6: tool-dock nasce antes de spacesCuts/cameraNavigation. Dependências desses
  // módulos precisam ser resolvidas no momento do clique; referências diretas
  // congelavam undefined e faziam o corte rápido/vistas falharem silenciosamente.
  applySelectedSpaceCut:(...a)=>moduleRegistry.callIfReady('spacesCuts','applySelectedSpaceCut',...a),
  applyTechnical2DTransparency:(...a)=>moduleRegistry.callIfReady('cameraNavigation','applyTechnical2DTransparency',...a),
  cutSideName,cutSpaceCountValue,deleteSelected,deleteSelectedSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','deleteSelectedSpaceRoot',...a),duplicateSelected,elementIsVisible,exportProjectAspireZip:(...a)=>moduleRegistry.callIfReady('cutPlanUi','exportProjectAspireZip',...a),exportSelectedAspireDxf:(...a)=>moduleRegistry.callIfReady('cutPlanUi','exportSelectedAspireDxf',...a),exportSelectedFurniture:(...a)=>moduleRegistry.callIfReady('cadIo','exportSelectedFurniture',...a),largestVisibleCell:(...a)=>moduleRegistry.callIfReady('spacesCuts','largestVisibleCell',...a),m,openCopyHardwareTool:(...a)=>moduleRegistry.callIfReady('productionMaterials','openCopyHardwareTool',...a),openCopyShapeTool:(...a)=>moduleRegistry.callIfReady('machiningShapes','openCopyShapeTool',...a),openCurvedStructureDialog:(...a)=>moduleRegistry.callIfReady('curvedFurniture','openCurvedStructureDialog',...a),openDeleteSelectedSpaceCellDialog:(...a)=>moduleRegistry.callIfReady('spacesCuts','openDeleteSelectedSpaceCellDialog',...a),openDoorSystemDialog:(...a)=>moduleRegistry.callIfReady('doorsDrawers','openDoorSystemDialog',...a),openDrawerSystemDialog:(...a)=>moduleRegistry.callIfReady('doorsDrawers','openDrawerSystemDialog',...a),openEditSpaceDialog,openLabelsDialog:(...a)=>moduleRegistry.callIfReady('productionMaterials','openLabelsDialog',...a),openMachiningDialog:(...a)=>moduleRegistry.callIfReady('machiningShapes','openMachiningDialog',...a),openNewSpaceDialog,openPartsListDialog:(...a)=>moduleRegistry.callIfReady('cutPlanUi','openPartsListDialog',...a),openProductionDialog:(...a)=>moduleRegistry.callIfReady('productionMaterials','openProductionDialog',...a),openShapeDialog:(...a)=>moduleRegistry.callIfReady('machiningShapes','openShapeDialog',...a),openSlattedPanelDialog:(...a)=>moduleRegistry.callIfReady('library','openSlattedPanelDialog',...a),openSpaceFromObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','openSpaceFromObject',...a),openTapeModeChooser,openTechnicalLayoutDialog:(...a)=>moduleRegistry.callIfReady('technicalLayout','openTechnicalLayoutDialog',...a),parseDecimalInput:(...a)=>moduleRegistry.callIfReady('machiningShapes','parseDecimalInput',...a),quickCreatePieceFromTypeButton:(...a)=>moduleRegistry.callIfReady('pieceEditor','quickCreatePieceFromTypeButton',...a),redo,
  returnTo3D:(...a)=>moduleRegistry.callIfReady('cameraNavigation','returnTo3D',...a),
  selectPieceCreateTypeButton:(...a)=>moduleRegistry.callIfReady('pieceEditor','selectPieceCreateTypeButton',...a),selectSpaceCellByIds:(...a)=>moduleRegistry.callIfReady('spacesCuts','selectSpaceCellByIds',...a),
  setFrontWorldView:(...a)=>moduleRegistry.callIfReady('spacesCuts','setFrontWorldView',...a),
  setPieceVisualEdgesVisible,setTool,setVisualMode,showAllHiddenSpaces:(...a)=>moduleRegistry.callIfReady('spacesCuts','showAllHiddenSpaces',...a),toast,toggleActiveSpaceVisibility:(...a)=>moduleRegistry.callIfReady('spacesCuts','toggleActiveSpaceVisibility',...a),toggleCadHardwareVisibility,toggleCadMachiningVisibility,toggleDoorsForActiveSpace:(...a)=>moduleRegistry.callIfReady('doorsDrawers','toggleDoorsForActiveSpace',...a),undo,updateCutPreview,updateSpaceSelectionVisuals:(...a)=>moduleRegistry.callIfReady('spacesCuts','updateSpaceSelectionVisuals',...a),updateXray3DButton,
  viewSpace:(...a)=>moduleRegistry.callIfReady('spacesCuts','viewSpace',...a),
  worldAxisX,worldAxisY,worldAxisZ,XRAY_3D_KEY:CAD_APPEARANCE_KEYS.xray
});
TOOL_DOCK_CATALOG=toolDockUi.TOOL_DOCK_CATALOG;toolDockPrefs=toolDockUi.toolDockPrefs;
({syncToolDockButtons,renderToolDock,applyXray3D,toggleDockXray,closeToolDockBeforeMenu,quickDockSubmenuVisible,closeQuickDockSubmenu,initQuickDock,setToolDockOpen,initSpaceActionsDrag,restorePieceInspectorPosition,initPieceInspectorFloating,initToolDock,saveToolDockPrefs}=toolDockUi);
moduleRegistry.register('toolDockUi',toolDockUi);

cameraNavigation=createCameraNavigationModule({runtimeModel,moduleRegistry,
  THREE,perspectiveCamera,renderer,controls,cadZoomNdc,cadZoomRaycaster,CAD_ZOOM_DEFAULT_SPEED,CAD_ZOOM_TOUCH_SPEED,CAD_ZOOM_CLOSE_SPEED,CAD_ZOOM_SLOW_ZONE,CAD_ZOOM_SURFACE_GAP,CAD_ZOOM_NEAR_DEFAULT,CAD_ZOOM_NEAR_MIN,last3DView,orthoCamera,
  objectInsideSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','objectInsideSpaceRoot',...a),getBounds:(...a)=>moduleRegistry.callIfReady('tapeMovement','getBounds',...a),pieceThicknessInfo:(...a)=>moduleRegistry.callIfReady('machiningShapes','pieceThicknessInfo',...a),$,setPieceVisualEdgesVisible,updateXray3DButton,toast,
  get camera(){return camera;},set camera(v){camera=v;},get viewMode2D(){return viewMode2D;},set viewMode2D(v){viewMode2D=!!v;},get current2DView(){return current2DView;},set current2DView(v){current2DView=v;},get cameraSwitching(){return cameraSwitching;},set cameraSwitching(v){cameraSwitching=!!v;}
});
({cadZoomPhysicalObjects,cadZoomSurfaceDistance,cadZoomAdaptiveSpeed,cadZoomTuneNearPlane,cadZoomPrepareIn,cadZoomStableTouchDistance,cadZoomPrepareTouchIn,cadZoomResetOut,remember3DView,useCamera,orthographicFrustum,restoreTechnical2DTransparency,objectBelongsToRootFor2D,pieceIsCameraCover,applyTechnical2DTransparency,setViewModeBadge,returnTo3D}=cameraNavigation);
moduleRegistry.register('cameraNavigation',cameraNavigation);

const cadInput=installCadInputNavigation({runtimeModel,moduleRegistry,
  THREE,renderer,controls,perspectiveCamera,CAD_ZOOM_DEFAULT_SPEED,CAD_ZOOM_TOUCH_SPEED,CAD_ZOOM_SURFACE_GAP,last3DView,
  getCamera:()=>camera,getViewMode2D:()=>viewMode2D,getToolMode:()=>toolMode,
  cadZoomPrepareIn,cadZoomPrepareTouchIn,cadZoomResetOut,returnTo3D,remember3DView
});
desktopCadNavigation=cadInput.desktopCadNavigation;
moduleRegistry.register('cadInput',cadInput);

tapeMovement=createTapeMovementModule({runtimeModel,moduleRegistry,
  $,THREE,referenceMeshes:(...a)=>moduleRegistry.callIfReady('spacesCuts','referenceMeshes',...a)??[],SNAP_THRESHOLD,CORNER_PICK_PX,EDGE_PICK_PX,GUIDE_SNAP_PX,TAPE_AIM_SNAP_PX,COLORS,scene,commitHistory,getPointerNDC,get camera(){return camera;},worldToClient,mm,nice,toast,controls,syncToolDockButtons,renderer,TAPE_POINT_TOUCH_OFFSET_PX,axisVector,GUIDE_EXTENT,closestParamOnAxis,worldAxisX,worldAxisY,worldAxisZ,worldAxisForFace,groundPlane,TAPE_POINT_CORNER_SNAP_TOUCH_PX,TAPE_POINT_CORNER_SNAP_MOUSE_PX,TAPE_POINT_EDGE_SNAP_TOUCH_PX,TAPE_POINT_EDGE_SNAP_MOUSE_PX,TAPE_POINT_LINE_SNAP_TOUCH_PX,TAPE_POINT_LINE_SNAP_MOUSE_PX,TAPE_AXIS_ANGLE,MIN_SIZE,CORNER_SNAP_PX,EDGE_SNAP_PX,GUIDE_OBJECT_SNAP_WORLD,
  get toolMode(){return toolMode;},set toolMode(v){toolMode=v;},get tapeStart(){return tapeStart;},set tapeStart(v){tapeStart=v;},get tapeStartClient(){return tapeStartClient;},set tapeStartClient(v){tapeStartClient=v;},get tapeHover(){return tapeHover;},set tapeHover(v){tapeHover=v;},get tapeEdgeSource(){return tapeEdgeSource;},set tapeEdgeSource(v){tapeEdgeSource=v;},get tapePendingEdge(){return tapePendingEdge;},set tapePendingEdge(v){tapePendingEdge=v;},get tapeDragEdgeActive(){return tapeDragEdgeActive;},set tapeDragEdgeActive(v){tapeDragEdgeActive=v;},get tapeTouchActive(){return tapeTouchActive;},set tapeTouchActive(v){tapeTouchActive=v;},get tapeTouchId(){return tapeTouchId;},set tapeTouchId(v){tapeTouchId=v;},get tapeMouseActive(){return tapeMouseActive;},set tapeMouseActive(v){tapeMouseActive=v;},get tapePointPinchNavigating(){return tapePointPinchNavigating;},set tapePointPinchNavigating(v){tapePointPinchNavigating=v;},get tapePointPinchSuppressUntil(){return tapePointPinchSuppressUntil;},set tapePointPinchSuppressUntil(v){tapePointPinchSuppressUntil=v;},get tapeLastConfirmedTap(){return tapeLastConfirmedTap;},set tapeLastConfirmedTap(v){tapeLastConfirmedTap=v;},get tapeConfirmGate(){return tapeConfirmGate;},set tapeConfirmGate(v){tapeConfirmGate=v;},get tapeAim(){return tapeAim;},set tapeAim(v){tapeAim=v;},get moveSnapKind(){return moveSnapKind;},set moveSnapKind(v){moveSnapKind=v;},get moveSnapText(){return moveSnapText;},set moveSnapText(v){moveSnapText=v;},get moveGrabIsCorner(){return moveGrabIsCorner;},set moveGrabIsCorner(v){moveGrabIsCorner=v;},get selected(){return selected;},set selected(v){selected=v;},get moveInferenceAxis(){return moveInferenceAxis;},set moveInferenceAxis(v){moveInferenceAxis=v;},get moveCornerTarget(){return moveCornerTarget;},set moveCornerTarget(v){moveCornerTarget=v;}
});
({getBounds,axisFeatures,findMoveSnap,snapFaceCoordinate,guide,makeDashedMaterial,setLinePoints,guideAxisColor,createConstructionGuide,tapePieceName,tapeSetBoxHelper,tapeMeasurablePieces,getTapePieceAtEvent,tapeClosestIntervalPoints,tapeDistanceBetweenPieces,tapeShowPieceDistance,tapeUpdatePiecePrompt,resetTapeMeasure,hideTapeCrosshair,clearLatchedTapeMeasurement,restoreCadNavigationAfterTape,closeTapeAfterCommittedMeasurement,tapePointAimEvent,tapePointAimClient,setTapeCrosshair,nearestAnyCornerToClient,getBoxEdges,refineTapeEdgeScreenPick,nearestAnyEdgeToClient,nearestEdgeOnMeshToClient,nearestGuideToClient,closestPointOnInfiniteLine,nearestGlobalAxisHit,nearestReferenceLineByRay,resolveTapeAim,getTapePick,distancePointToSegment2D,nearestGlobalAxisAtClient,inferTapeAxis,projectPointToAxis,activateTapeEdgeSource,parallelGuideGeometryFromPick,commitTapeParallelAtEvent,tapePointKindLabel,tapePointPickIsValid,tapeShowPointDistance,updateTapePointPreview,handleTapePointTap,updateTapePreview,createInfiniteAxisGuide,tapePickKey,handleTapeTap,getBoxCorners,getFaceCorners,nearestCornerToClient,findTargetCornerSnap,findMoveInferenceTarget,snapMovingObjectFeaturesToGuide,setMoveTargetMarker,showGuide,hideInference,showInference,hideGuides,guideX,guideY,guideZ,inferenceLines,moveGrip,cornerMarker}=tapeMovement);
moduleRegistry.register('tapeMovement',tapeMovement);


selection3D=createSelection3DModule({runtimeModel,moduleRegistry,
  $,THREE,renderer,controls,getPointerNDC,designLabVisualizationOnlyActive,selectObject,clearSpaceSelection:(...a)=>moduleRegistry.callIfReady('spacesCuts','clearSpaceSelection',...a),rootForObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','rootForObject',...a),openSpaceFromObject:(...a)=>moduleRegistry.callIfReady('spacesCuts','openSpaceFromObject',...a),openPieceInspector,isDoorObject:(...a)=>moduleRegistry.callIfReady('doorsDrawers','isDoorObject',...a),objectInsideSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','objectInsideSpaceRoot',...a),worldAxisForFace,nearestCornerToClient,nearestEdgeOnMeshToClient,worldToClient,getBounds,updateMeasureBadge,updateInspector,renderSpaces:(...a)=>moduleRegistry.callIfReady('spacesCuts','renderSpaces',...a),setAllFaces,commitHistory,renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),stateString,intersectPlane,axisVector,closestParamOnAxis,inferMoveAxis,showInference,hideInference,findMoveInferenceTarget,snapMovingObjectFeaturesToGuide,setMoveTargetMarker,snapFaceCoordinate,hideGuides,showGuide,moveGrip,cornerMarker,COLORS,clampSize,REAIM_THRESHOLD_PX,updateTapePreview,tapePointAimClient,tapePointAimEvent,handleTapeTap,desktopCadNavigation,
  getSpaceRoot:(...a)=>moduleRegistry.callIfReady('spacesCuts','getSpaceRoot',...a),getSpaceCell:(...a)=>moduleRegistry.callIfReady('spacesCuts','getSpaceCell',...a),selectSpaceCellByIds:(...a)=>moduleRegistry.callIfReady('spacesCuts','selectSpaceCellByIds',...a),toggleSpaceMultiSelection:(...a)=>moduleRegistry.callIfReady('doorsDrawers','toggleSpaceMultiSelection',...a),clearSpaceMultiSelection:(...a)=>moduleRegistry.callIfReady('doorsDrawers','clearSpaceMultiSelection',...a),openSpaceQuickCreateMenu:(...a)=>moduleRegistry.callIfReady('doorsDrawers','openSpaceQuickCreateMenu',...a),referenceMeshes:(...a)=>moduleRegistry.callIfReady('spacesCuts','referenceMeshes',...a)??[],hardwareCopyHandlePick:(...a)=>moduleRegistry.callIfReady('productionMaterials','hardwareCopyHandlePick',...a),shapeCopyHandlePick:(...a)=>moduleRegistry.callIfReady('machiningShapes','shapeCopyHandlePick',...a),CORNER_PICK_PX,EDGE_PICK_PX,findMoveSnap,guideX,guideY,guideZ,mm,toast,pickSpaceCellAtClient:(...a)=>moduleRegistry.callIfReady('doorsDrawers','pickSpaceCellAtClient',...a),spaceSelectionKey,
  get dragMode(){return dragMode;},set dragMode(v){dragMode=v;},get toolMode(){return toolMode;},set toolMode(v){toolMode=v;},get tapePointPinchNavigating(){return tapePointPinchNavigating;},set tapePointPinchNavigating(v){tapePointPinchNavigating=!!v;},get moveGrabKind(){return moveGrabKind;},set moveGrabKind(v){moveGrabKind=v;},get tapeMeasureMode(){return tapeMovement?.state?.tapeMeasureMode||'piece';},set tapeMeasureMode(v){if(tapeMovement)tapeMovement.state.tapeMeasureMode=v;},get dragChanged(){return dragChanged;},set dragChanged(v){dragChanged=!!v;},get grabSign(){return grabSign;},set grabSign(v){grabSign=v;},get tapePointPinchSuppressUntil(){return tapePointPinchSuppressUntil;},set tapePointPinchSuppressUntil(v){tapePointPinchSuppressUntil=v;},get activePointerId(){return activePointerId;},set activePointerId(v){activePointerId=v;},get movingSpaceRoot(){return movingSpaceRoot;},set movingSpaceRoot(v){movingSpaceRoot=v;},get pullAxis(){return pullAxis;},set pullAxis(v){pullAxis=v;},get tapeTouchActive(){return tapeTouchActive;},set tapeTouchActive(v){tapeTouchActive=!!v;},get tapePointerMoved(){return tapePointerMoved;},set tapePointerMoved(v){tapePointerMoved=!!v;},get movingSpaceCellStarts(){return movingSpaceCellStarts;},set movingSpaceCellStarts(v){movingSpaceCellStarts=v;},get dragStartState(){return dragStartState;},set dragStartState(v){dragStartState=v;},get movingSpaceRootStart(){return movingSpaceRootStart;},set movingSpaceRootStart(v){movingSpaceRootStart=v;},get movingSpaceObjectStarts(){return movingSpaceObjectStarts;},set movingSpaceObjectStarts(v){movingSpaceObjectStarts=v;},get lastEdit(){return lastEdit;},set lastEdit(v){lastEdit=v;},get gestureLocked(){return gestureLocked;},set gestureLocked(v){gestureLocked=!!v;},get moveGrabIsCorner(){return moveGrabIsCorner;},set moveGrabIsCorner(v){moveGrabIsCorner=!!v;},get moveInferenceAxis(){return moveInferenceAxis;},set moveInferenceAxis(v){moveInferenceAxis=v;},get moveCornerTarget(){return moveCornerTarget;},set moveCornerTarget(v){moveCornerTarget=v;},get tapeMouseActive(){return tapeMouseActive;},set tapeMouseActive(v){tapeMouseActive=!!v;},get tapeTouchId(){return tapeTouchId;},set tapeTouchId(v){tapeTouchId=v;},get moveSnapKind(){return moveSnapKind;},set moveSnapKind(v){moveSnapKind=v;},get moveSnapText(){return moveSnapText;},set moveSnapText(v){moveSnapText=v;},get selected(){return selected;},set selected(v){selected=v;},get selectedSpaceCell(){return selectedSpaceCell;},set selectedSpaceCell(v){selectedSpaceCell=v;},get activeSpaceRootId(){return activeSpaceRootId;},set activeSpaceRootId(v){activeSpaceRootId=v;},get camera(){return camera;},get downClientX(){return downClientX;},set downClientX(v){downClientX=v;},get downClientY(){return downClientY;},set downClientY(v){downClientY=v;},get anchorCoord(){return anchorCoord;},set anchorCoord(v){anchorCoord=v;},get lockedA(){return lockedA;},set lockedA(v){lockedA=v;},get lockedB(){return lockedB;},set lockedB(v){lockedB=v;},get tapeLastClientX(){return tapeLastClientX;},set tapeLastClientX(v){tapeLastClientX=v;},get tapeLastClientY(){return tapeLastClientY;},set tapeLastClientY(v){tapeLastClientY=v;}
});
({resetSpaceDoubleTap,updateLiveLabel}=selection3D);
moduleRegistry.register('selection3D',selection3D);

spacesCuts=createSpacesCutsModule({runtimeModel,moduleRegistry,
  $,THREE,scene,COLORS,controls,perspectiveCamera,orthoCamera,m,mm,nice,escapeHtml,spaceMaterialText:(...a)=>moduleRegistry.callIfReady('productionMaterials','spaceMaterialText',...a)||'',toast,clampSize,uid,spaceSelectionKey,SPACE_HEAL_TOL,
  updateSpaceMultiSelectBar:(...a)=>moduleRegistry.callIfReady('doorsDrawers','updateSpaceMultiSelectBar',...a),applyVisualSceneState,applyAllDoorVisibility:(...a)=>moduleRegistry.callIfReady('doorsDrawers','applyAllDoorVisibility',...a),renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),
  isDoorObject:(...a)=>moduleRegistry.callIfReady('doorsDrawers','isDoorObject',...a),doorObjectShouldBeVisible:(...a)=>moduleRegistry.callIfReady('doorsDrawers','doorObjectShouldBeVisible',...a),restoreBaseColor,selectObject,commitHistory,designLabVisualizationOnlyActive,openPieceInspector,hideGuides,updateDoorsToggleButton:(...a)=>moduleRegistry.callIfReady('doorsDrawers','updateDoorsToggleButton',...a),updateMeasureBadge,
  objectBelongsToRoot:(...a)=>moduleRegistry.callIfReady('cadIo','objectBelongsToRoot',...a),selectedFurnitureRoot:(...a)=>moduleRegistry.callIfReady('cadIo','selectedFurnitureRoot',...a),canonicalFactoryMaterialId:(...a)=>moduleRegistry.callIfReady('productionMaterials','canonicalFactoryMaterialId',...a),resetSpaceDoubleTap,restoreTechnical2DTransparency,setVisualMode,frameFurnitureVisual,remember3DView,orthographicFrustum,useCamera,setViewModeBadge,applyTechnical2DTransparency,returnTo3D,
  cellBox,addFixedBandForCell,
  // r5: library é inicializada depois de spaces-cuts. Estes helpers precisam
  // ser resolvidos no momento da chamada; passar as variáveis por shorthand
  // congelava `undefined` dentro do módulo e causava `mergeIntervals is not a function`.
  mergeIntervals:(...a)=>moduleRegistry.call('library','mergeIntervals',...a),
  fixedIntervalsFromSpace:(...a)=>moduleRegistry.call('library','fixedIntervalsFromSpace',...a),
  structuralFixedIntervalsFromRoot:(...a)=>moduleRegistry.call('library','structuralFixedIntervalsFromRoot',...a),
  makeBalancedSpaceAxisMapper:(...a)=>moduleRegistry.call('library','makeBalancedSpaceAxisMapper',...a),
  pieceThicknessInfo:(...a)=>moduleRegistry.callIfReady('machiningShapes','pieceThicknessInfo',...a),productionMaterialById:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionMaterialById',...a),productionMaterialUsesPieceThickness:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionMaterialUsesPieceThickness',...a),normalizePieceManualGeometryDelta,remapMachiningForPieceResize:(...a)=>moduleRegistry.callIfReady('machiningShapes','remapMachiningForPieceResize',...a),rebuildFormGeometry:(...a)=>moduleRegistry.callIfReady('machiningShapes','rebuildFormGeometry',...a),sanitizeMachiningForPiece:(...a)=>moduleRegistry.callIfReady('machiningShapes','sanitizeMachiningForPiece',...a),rebuildDrawerSetsForRoot:(...a)=>moduleRegistry.callIfReady('doorsDrawers','rebuildDrawerSetsForRoot',...a),applyDoorVisibility:(...a)=>moduleRegistry.callIfReady('doorsDrawers','applyDoorVisibility',...a),getBounds,removeHardwareLinkedToObjects:(...a)=>moduleRegistry.callIfReady('productionMaterials','removeHardwareLinkedToObjects',...a),sameCellTangents,almostSpace,cellAxisMax,cellAxisMin,boxAxisMin,axisCellMinKey,axisCellMaxKey,selectedCellEditPair,cellTangentWithin,cellTangentOverlapArea,cellTangentFaceArea,mergedCellFromPair,setCellAxisMin,setCellAxisMax,removeDrawerSet:(...a)=>moduleRegistry.callIfReady('doorsDrawers','removeDrawerSet',...a),
  get selectedSpaceCell(){return selectedSpaceCell;},set selectedSpaceCell(v){selectedSpaceCell=v;},get activeSpaceRootId(){return activeSpaceRootId;},set activeSpaceRootId(v){activeSpaceRootId=v;},
  get quickSpacesHidden(){return quickSpacesHidden;},set quickSpacesHidden(v){quickSpacesHidden=!!v;},
  // r6: applyQuickFrontVisibility altera este estado. Sem setter, o clique em
  // “Ocultar portas/frentes” lançava TypeError em módulo ES (strict mode).
  get quickFrontFacesHidden(){return quickFrontFacesHidden;},set quickFrontFacesHidden(v){quickFrontFacesHidden=!!v;},get cadHardwareVisible(){return cadHardwareVisible;},
  get doorRegionSelectionMode(){return doorRegionSelectionMode;},set doorRegionSelectionMode(v){doorRegionSelectionMode=!!v;},get lastEdit(){return lastEdit;},set lastEdit(v){lastEdit=v;},
  get visualMode(){return visualMode;},get current2DView(){return current2DView;},set current2DView(v){current2DView=v;},get viewMode2D(){return viewMode2D;},get camera(){return camera;},
  get selected(){return selected;},set selected(v){selected=v;}
});
({getSpaceRoot,getSpaceCell,cellSize,cellCenter,disposeSpaceMeshes,updateSpaceSelectionVisuals,renderSpaces,referenceMeshes,applyQuickFrontVisibility,isManuallyHideablePiece,manuallyHiddenPieces,syncManualPieceVisibilityButtons,applyManualVisibilityToObject,hideSelectedPieceQuick,showAllManuallyHiddenPieces,hasIndividuallyHiddenSpaces,syncQuickSpaceVisibilityButton,applyQuickSpaceVisibility,showAllSpacesGeneral,quickToggleAllSpaces,hideQuickSelectedSpace,openQuickSelectedConfiguration,updateSpaceVisibilityToggleButton,largestVisibleCell,spaceCellLabel,nearestVisibleCell,toggleActiveSpaceVisibility,showAllHiddenSpaces,setSpaceActionCellMode,selectSpaceRootOnly,distanceSqPointToCell,bestVisibleCellForObject,rootForObject,openSpaceFromObject,activeSpaceRoot,clearSpaceSelection,selectSpaceCellByIds,createSpace,createSpaceFromState,viewSpace,perspectiveFrontToSpace,frontViewToSpace,setFrontWorldView,divideSelectedSpaceEvenly,applySelectedSpaceCut,cutSelectedSpace,rootBounds,mapPersistentFixedBands,updateAutoMachiningAfterPieceResize,isVerticalDivisionPiece,verticalDivisionNominalThicknessM,registerVerticalDivisionFixedBand,repairVerticalDivisionThickness,resizeSpaceRoot,objectInsideSpaceRoot,disposeObject,deleteSelectedSpaceRoot,cellContainsObjectCompletely,manualCutSibling,removeFixedBandForDeletedCell,removeManualCutNodeFromChain,expandManualCutParentBoundsAtDeletedBoundary,selectedSpaceCellDeleteContext,selectedSpaceCellDeletePreview,openDeleteSelectedSpaceCellDialog,deleteSelectedSpaceCell}=spacesCuts);
moduleRegistry.register('spacesCuts',spacesCuts);


cutPlanUi=createCutPlanUiModule({runtimeModel,moduleRegistry,
  $,nice,mm,escapeHtml,roundMmNumber,toast,downloadText:(...a)=>moduleRegistry.callIfReady('cadIo','downloadText',...a),safeFileName:(...a)=>moduleRegistry.callIfReady('cadIo','safeFileName',...a)||'arquivo',flatPartInfo,dxfPair,dxfLine,dxfClosedRect,dxfClosedPolyline,dxfCircle,normalizedLayer,machiningLayer,mapPlacedUV,projectOperation,
  entryAxisName:(...a)=>moduleRegistry.callIfReady('machiningShapes','entryAxisName',...a),entryAxisSign:(...a)=>moduleRegistry.callIfReady('machiningShapes','entryAxisSign',...a),holeSeriesInstances:(...a)=>moduleRegistry.callIfReady('machiningShapes','holeSeriesInstances',...a)??[],resolvedMachiningCoords:(...a)=>moduleRegistry.callIfReady('machiningShapes','resolvedMachiningCoords',...a)??{},actualMachiningCount:(...a)=>moduleRegistry.callIfReady('machiningShapes','actualMachiningCount',...a)??0,operationDepthMm:(...a)=>moduleRegistry.callIfReady('machiningShapes','operationDepthMm',...a)??0,machiningRawCoord:(...a)=>moduleRegistry.callIfReady('machiningShapes','machiningRawCoord',...a)??0,axisLabel:(...a)=>moduleRegistry.callIfReady('machiningShapes','axisLabel',...a)??'',
  productionMaterialById:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionMaterialById',...a),productionObjectKind:(...a)=>moduleRegistry.callIfReady('productionMaterials','productionObjectKind',...a),normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,
  furnitureObjects:(...a)=>moduleRegistry.callIfReady('cadIo','furnitureObjects',...a)??[],selectedFurnitureRoot:(...a)=>moduleRegistry.callIfReady('cadIo','selectedFurnitureRoot',...a)??null,projects,commitHistory,clampSize,layerNum,
  dlLinearPieceLengthMm:(...a)=>moduleRegistry.callIfReady('productionSuite','dlLinearPieceLengthMm',...a)??0,dlPackMetalBars:(...a)=>moduleRegistry.callIfReady('productionSuite','dlPackMetalBars',...a)??[],dlWoodPlanGroups:(...a)=>moduleRegistry.callIfReady('productionSuite','dlWoodPlanGroups',...a)??[],dlMetalPlanGroups:(...a)=>moduleRegistry.callIfReady('productionSuite','dlMetalPlanGroups',...a)??[],dlRenderGeneralPartsSummary:(...a)=>moduleRegistry.callIfReady('productionSuite','dlRenderGeneralPartsSummary',...a),dlRenderInlineLinearPlans:(...a)=>moduleRegistry.callIfReady('productionSuite','dlRenderInlineLinearPlans',...a),
  repairAllDrawerBottomGrooves:(...a)=>moduleRegistry.callIfReady('doorsDrawers','repairAllDrawerBottomGrooves',...a),repairAllDrawerDrillingForAspire:(...a)=>moduleRegistry.callIfReady('doorsDrawers','repairAllDrawerDrillingForAspire',...a),repairDrawerBottomGroovesForRoot:(...a)=>moduleRegistry.callIfReady('doorsDrawers','repairDrawerBottomGroovesForRoot',...a),repairDrawerDrillingForRoot:(...a)=>moduleRegistry.callIfReady('doorsDrawers','repairDrawerDrillingForRoot',...a)
});
moduleRegistry.register('cutPlanUi',cutPlanUi);
({buildAspireSheetEntities,previewEntityFace,previewEdgeHoleMarkers,sheetPreviewStats,sheetPreviewPlacedOutline,sheetPreviewPartBounds,pointInPreviewPart,polygonAreaMm2,cutPlanPartAreaMm2,sheetPreviewViewport,sheetPreviewPointerToWorld,normalizedSheetPrefs,getSheetPrefs,setSheetPrefs,sheetPrefsFromUi,applySheetPrefsToUi,sheetPrefsForPartGroup,partOrientations,csvLine,buildMingliZawFiles,buildPanelSawCutsCsv,buildPartsCsv,buildLabelsBaseCsv,buildMachiningCsv,buildSheetsCsv,groupPartArrayForAspire,allProjectFurnitureParts,allProjectProductionPartsByKind,groupAspireProjectParts,zipStore,isExportPickerCancel,exportLeafName,pickExportTarget,downloadExportFallback,writeExportTarget,exportProjectAspireZip,exportSelectedAspireDxf,cutPlanPartSignature,cutPlanAssignCodes,cutPlanPackOpen,renderPartsList,openPartsListDialog,prepareSheetPreviewGroups,refreshSheetPreviewSelect,openSheetPreview,closeSheetPreview,sheetPreviewDraw,updateSheetCutModeUi,exportPanelSawSequenceCsv,exportPanelSawMingliZaw,printCutPlan}=cutPlanUi);

library=createLibraryModule({runtimeModel,moduleRegistry,
  $,uid,toast,nice,adminDate,getSpaceRoot,getSpaceCell,cellSize,cellCenter,createBox,COLORS,commitHistory,mm,isSpaceCuttingPieceForHeal,objectInsideSpaceRoot,rootBounds,MM_TO_M,
  curvedPostSamplesMm:(...a)=>moduleRegistry.callIfReady('curvedFurniture','curvedPostSamplesMm',...a),curvedPostPlacementFromSampleMm:(...a)=>moduleRegistry.callIfReady('curvedFurniture','curvedPostPlacementFromSampleMm',...a),
  normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,normalizePieceEdgeBands:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceEdgeBands',...a)??(a[0]||{}),productionClone:(v)=>moduleRegistry.callIfReady('productionMaterials','productionClone',v)??(v==null?v:JSON.parse(JSON.stringify(v))),
  restoreBaseColor,cloneMachiningForTargetSize:(...a)=>moduleRegistry.callIfReady('machiningShapes','cloneMachiningForTargetSize',...a)??[],createCylinder,createCurvedRib:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedRib',...a),createCurvedCover:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedCover',...a),createCurvedPost:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedPost',...a),
  pieceMappedGeometryWithManualDelta,renderSpaces,selectSpaceCellByIds,pieceParametricBaseFromRecord,renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),cloudApiFetch,adminAllowed,
  selectedFurnitureRoot:(...a)=>moduleRegistry.callIfReady('cadIo','selectedFurnitureRoot',...a),safeFileName:(...a)=>moduleRegistry.callIfReady('cadIo','safeFileName',...a),captureFurniture:(...a)=>moduleRegistry.callIfReady('cadIo','captureFurniture',...a),pieceThicknessInfo:(...a)=>moduleRegistry.callIfReady('machiningShapes','pieceThicknessInfo',...a),parseDecimalInput:(...a)=>moduleRegistry.callIfReady('machiningShapes','parseDecimalInput',...a),
  setVisualMode,roundMmNumber,pieceLocalAxisVector,selectObject,disposeObject,updateMeasureBadge,m,
  get selectedSpaceCell(){return selectedSpaceCell;},get selected(){return selected;},get visualMode(){return visualMode;},get cloudAccountState(){return cloudAccount.cloudAccountState;},get historyMuted(){return historyMuted;},set historyMuted(v){historyMuted=!!v;}
});
moduleRegistry.register('library',library);
({persistLibrary,libraryFolderById,uniqueLibraryFolderName,createLibraryFolder,selectedCellInfo,createCabinetInCell,mergeIntervals,fixedIntervalsFromSpace,stableFixedIntervalsFromSpace,explicitFixedIntervalsFromManualCuts,stableFixedIntervalsForParametricSpace,fixedGapPlan,libraryPartRecordIsStructural,structuralFixedIntervalsFromPartRecords,structuralFixedIntervalsFromRoot,makeFixedAxisMapper,makeBalancedFixedAxisMapper,balancedAxisCellCrossArea,balancedAxisRootCrossArea,balancedAxisPrimaryBoundaries,balancedAxisSegmentFixedByCells,makeBalancedSpaceAxisMapper,layoutBoundsFromSpace,libraryCurvedConfigForTarget,libraryCurvedPostPlacementForTarget,copyLibraryPartMeta,createLibraryTemplatePart,libraryMapBounds,libraryCloneTargetManualCut,libraryTransformManualCut,libraryInstallSpaceTopology,libraryRemapPartCellRefs,libraryInfoForPart,placeCustomTemplate,placeLibraryItem,builtinLibraryItems,globalLibraryFolderById,setLibraryScope,globalTemplateFromFurniture,updateLibraryFolderUi,libraryItemElement,renderLibrary,openLibraryRoot,newLibraryFolder,renameActiveLibraryFolder,deleteActiveLibraryFolder,deleteLibraryItem,importLibraryTemplate,saveCurrentFurnitureToLibrary,slattedPanelEligible,slattedPanelReadConfig,slattedPanelLayoutFor,renderSlattedPanelPreview,openSlattedPanelDialog,closeSlattedPanelDialog,createSlattedPanel}=library);

cadIo=createCadIoModule({runtimeModel,moduleRegistry,
  $,THREE,COLORS,MM_TO_M,scene,getSpaceRoot,getBounds,captureSpaces,
  normalizePieceGrainRotation:(...a)=>moduleRegistry.callIfReady('productionMaterials','normalizePieceGrainRotation',...a)??0,productionClone:(v)=>moduleRegistry.callIfReady('productionMaterials','productionClone',v)??(v==null?v:JSON.parse(JSON.stringify(v))),captureProductionState:(...a)=>moduleRegistry.callIfReady('productionMaterials','captureProductionState',...a)??null,mm,adminAllowed,
  globalLibraryFolderById:library.globalLibraryFolderById,cloudApiFetch,loadGlobalLibraryItems:library.loadGlobalLibraryItems,loadGlobalLibraryFolders:library.loadGlobalLibraryFolders,renderLibrary:library.renderLibrary,toast,importLibraryTemplate:library.importLibraryTemplate,
  exportLeafName,isExportPickerCancel,downloadExportFallback,pickExportTarget,mergeProjectProductionState:(...a)=>moduleRegistry.callIfReady('productionMaterials','mergeProjectProductionState',...a),uid,createSpaceFromState,createCylinder,
  createCurvedRib:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedRib',...a),createCurvedCover:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedCover',...a),curvedPostSamplesMm:(...a)=>moduleRegistry.callIfReady('curvedFurniture','curvedPostSamplesMm',...a),curvedPostPlacementFromSampleMm:(...a)=>moduleRegistry.callIfReady('curvedFurniture','curvedPostPlacementFromSampleMm',...a),createCurvedPost:(...a)=>moduleRegistry.callIfReady('curvedFurniture','createCurvedPost',...a),createBox,
  copyLibraryPartMeta:library.copyLibraryPartMeta,repairOrphanSpaceGaps,renderSpaces,applyAllDoorVisibility:(...a)=>moduleRegistry.callIfReady('doorsDrawers','applyAllDoorVisibility',...a),renderMachiningVisuals:(...a)=>moduleRegistry.callIfReady('machiningShapes','renderMachiningVisuals',...a),selectSpaceCellByIds,frontViewToSpace,commitHistory,libraryState:library.state,
  get selectedSpaceCell(){return selectedSpaceCell;},get selected(){return selected;},get activeSpaceRootId(){return activeSpaceRootId;},get historyMuted(){return historyMuted;},set historyMuted(v){historyMuted=!!v;}
});
moduleRegistry.register('cadIo',cadIo);
({safeFileName,downloadText,selectedFurnitureRoot,objectBounds,objectBelongsToRoot,furnitureObjects,captureFurniture,dxfModelCleanLayerName,dxfModelNumber,designLabUtf8ToBase64,designLabBase64ToUtf8,designLabDxfPayloadComments,dxfPairs,designLabRecordFromDxfPayload,dxfImportedPartName,dxfFallbackNewBounds,dxfFallbackAddPoint,dxfFallbackBoundsValid,dxfFallbackLayerThicknessMm,dxfFallbackObjectFrom3DBounds,dxfFallbackObjectFromPlanarBounds,dxfFallbackPlanarSpace,designLabFallbackRecordFromDxf,designLabFurnitureRecordFromImportedFile,designLabFurnitureRecordFromFile,importLibraryFile,exportSelectedFurniture,designLabStlTrailer,designLabRecordFromStlBuffer,furnitureModelTriangleCount,buildFurnitureModelStl,dxfModelFace,furnitureModelMeshes,buildFurnitureModelDxf,designLabIsMobileLike,projectMaxX,importFurnitureData}=cadIo);

machiningShapes=createMachiningShapesModule({runtimeModel,moduleRegistry,
  $,COLORS,MM_TO_M,M_TO_MM,THREE,adminAllowed,cloudApiFetch,commitHistory,controls,m,
  makeBoxVisualEdges,makeCadEdgeMaterial,nice,perspectiveCamera,referenceMeshes,restoreBaseColor,returnTo3D,
  roundMmNumber,scene,selectObject,setAllFaces,setDesignLabVisualizationOnly,setDimensions,setTool,setVisualMode,toast,uid,updateInspector,xray3DActive,
  get selected(){return selected;},set selected(value){selected=value;},get visualMode(){return visualMode;},
  get machiningPreviewActive(){return machiningPreviewActive;},set machiningPreviewActive(value){machiningPreviewActive=!!value;},
  get machiningPreviewOwner(){return machiningPreviewOwner;},set machiningPreviewOwner(value){machiningPreviewOwner=value;},
  get cadMachiningVisible(){return cadMachiningVisible;},get viewMode2D(){return viewMode2D;},get camera(){return camera;},
  get hardwarePreviewOps(){return productionMaterials?.state?.hardwarePreviewOps||[];},set hardwarePreviewOps(value){if(productionMaterials)productionMaterials.state.hardwarePreviewOps=value;},
  get hardwareScope(){return productionMaterials?.state?.hardwareScope||'local';},set hardwareScope(value){if(productionMaterials)productionMaterials.state.hardwareScope=value;},
  get hardwareCopyState(){return productionMaterials?.state?.hardwareCopyState||{active:false};},
  refreshHardwarePresetSelect:(...a)=>moduleRegistry.callIfReady('productionMaterials','refreshHardwarePresetSelect',...a),
  hardwareInstanceSummary:(...a)=>moduleRegistry.callIfReady('productionMaterials','hardwareInstanceSummary',...a),deleteHardwareInstance:(...a)=>moduleRegistry.callIfReady('productionMaterials','deleteHardwareInstance',...a),
  hardwareSourceApplications:(...a)=>moduleRegistry.callIfReady('productionMaterials','hardwareSourceApplications',...a),setHardwareScope:(...a)=>moduleRegistry.callIfReady('productionMaterials','setHardwareScope',...a),
  appliedHardwareStats:(...a)=>moduleRegistry.callIfReady('productionMaterials','appliedHardwareStats',...a),removeAppliedHardware:(...a)=>moduleRegistry.callIfReady('productionMaterials','removeAppliedHardware',...a),
  refreshAfterHardwareRemoval:(...a)=>moduleRegistry.callIfReady('productionMaterials','refreshAfterHardwareRemoval',...a),closeCopyHardwareTool:(...a)=>moduleRegistry.callIfReady('productionMaterials','closeCopyHardwareTool',...a)
});
moduleRegistry.register('machiningShapes',machiningShapes);
({remapMachiningForPieceResize,cloneMachiningForTargetSize,cloneMachining,mmPrec,pieceThicknessInfo,axisLabel,entryAxisName,entryAxisSign,localCoordField,parseDecimalInput,grooveLengthIsFull,setGrooveLengthFull,syncGrooveLengthButton,toggleMachiningCoordSign,machiningRawCoord,resolvedMachiningCoords,shapeDeepClone,shapeCopyPieceEligible,shapeCadUndo,shapeCadRedo,shapeCadSetTool,shapeCadClear,shapeCadCloseContour,shapeCadRender,shapeCadPointerDown,shapeCadPointerMove,shapeCadPointerUp,shapeCadPointerLeave,shapeCadSyncUi,refreshShapeCornerLabels,loadSelectedShapePresetToEditor,newShapePreset,editSelectedShapePreset,saveShapePresetLibrary,deleteShapePresetLibrary,rebuildFormGeometry,updateShapePreview,openShapeDialog,previewShape3D,returnShapePreview,applyShapeToPiece,closeShapeDialog,updateMachiningPresetInfo,applySelectedMachiningPreset,saveCurrentMachiningPreset,deleteSelectedMachiningPreset,holeSeriesInstances,actualMachiningCount,updateHoleSeriesVisibility,updateBackGrooveVisibility,applyHole32Preset,applyBackGroovePreset,operationDepthMm,remapMachiningAxes,sanitizeMachiningForPiece,clearMachiningVisuals,renderMachiningVisuals,updateMachiningVisualTransforms,clearMachiningDraftPreview,showMachining3DPreview,closeMachining3DPreview,setMachiningType,setMachiningSurfaceCoordinate,updateMachiningUI,openMachiningDialog,saveMachining,shapeCadFitView,shapeCadZoomBy,shapeCadZoomWheel,setShapeLibraryScope,shapeFormatTypeChanged,applyParametricFormatToPiece,shapeCornerSelectFromEvent,shapeSetCornerStyle,shapeApplyCornerEdit,shapeResetCorners,shapeSetMode,shapeTransformEditor,publishSelectedShapePresetGlobal,openCopyShapeTool,closeCopyShapeTool,shapeCopyHandlePick}=machiningShapes);
productionMaterials=createProductionMaterialsModule({runtimeModel,moduleRegistry,
  $,COLORS,THREE,adminAllowed,allProjectFurnitureParts,axisLabel,cadMachiningVisible,clearMachiningDraftPreview,closeCopyShapeTool,cloudAccountState:cloudAccount.cloudAccountState,cloudApiFetch,
  commitHistory,controls,cutPlanAssignCodes,cutPlanPartSignature,downloadText,entryAxisName,entryAxisSign,escapeHtml,flatPartInfo,furnitureObjects,getSpaceRoot,holeSeriesInstances,
  machiningRawCoord,mmPrec,nice,objectBelongsToRoot,operationDepthMm,parseDecimalInput,perspectiveCamera,pieceThicknessInfo,referenceMeshes,
  renderMachiningList:machiningShapes.renderMachiningList,renderMachiningVisuals,renderSpaces,resolvedMachiningCoords,restoreBaseColor,returnTo3D,rootForObject,roundMmNumber,safeFileName,sanitizeMachiningForPiece,scene,
  selectObject,selectedFurnitureRoot,setAllFaces,setDesignLabVisualizationOnly,setTool,setVisualMode,shapeCopyPieceEligible,shapeDeepClone,toast,uid,updateDraftPreviewTransforms:machiningShapes.updateDraftPreviewTransforms,updateInspector,updateMeasureBadge,
  get selected(){return selected;},get currentProjectRecord(){return projects.state.currentProjectRecord;},get visualMode(){return visualMode;},
  get machiningPreviewActive(){return machiningPreviewActive;},set machiningPreviewActive(value){machiningPreviewActive=!!value;},
  get machiningPreviewOwner(){return machiningPreviewOwner;},set machiningPreviewOwner(value){machiningPreviewOwner=value;},
  get camera(){return camera;},get shapeCopyState(){return machiningShapes?.state?.shapeCopyState||{active:false};}
});
moduleRegistry.register('productionMaterials',productionMaterials);
({canonicalFactoryMaterialId,defaultProjectProduction,productionClone,productionColorInt,setProjectProductionState,mergeProjectProductionState,captureProductionState,productionMaterialById,productionMaterialUsesPieceThickness,productionMaterialKind,productionObjectKind,normalizePieceEdgeBands,applyPieceProductionEdgeColors,pieceEdgeBandSignature,pieceEdgeBandSummary,spaceDefaultMaterial,applySpaceDefaultMaterialToObject,applySpaceMaterialToExistingPieces,spaceMaterialText,normalizePieceGrainRotation,makeMaterials,refreshPieceNamePresetSelect,applyPieceNamePreset,createPieceNamePreset,fillPieceMaterialSelect,updatePieceMaterialQuickInfo,applySelectedPieceMaterialFromInspector,productionUpdateMaterialKindFields,productionLoadMaterialFields,productionLoadBandFields,openProductionDialog,closeProductionDialog,labelsPrefs,labelsSavePrefs,labelsApplyPrefs,labelsBuildItems,renderLabelsPreview,openLabelsDialog,closeLabelsDialog,labelsPrintDocument,labelsPrint,labelsSaveHtml,productionEditMaterialStock,productionNewMaterial,productionSaveMaterial,productionDeleteMaterial,productionApplyMaterial,productionNewBand,productionSaveBand,productionDeleteBand,productionAssignEdge,productionClearSelectedBands,fillSpaceMaterialSelect,preferredDefaultMaterialId,updateSpaceMaterialPreview,updateEditSpaceMaterialPreview,findHardwarePreset,setHardwareScope,objectBoundsMm,pointWithinPieceTangents,hardwareHoleOp,updateHardwarePanel,updateHardwareBuilderUi,openHardwareBuilder,saveHardwareBuilder,publishSelectedHardwarePreset,removeHardwareLinkedToObjects,deleteSelectedHardwarePreset,previewHardware3D,applySelectedHardware,fillHardwareShelfPinExample,fillHardwareDowelExample,openCopyHardwareTool,closeCopyHardwareTool,hardwareCopyHandlePick}=productionMaterials);

curvedFurniture=createCurvedFurnitureModule({runtimeModel,moduleRegistry,
  $,COLORS,MM_TO_M,applySpaceDefaultMaterialToObject,applyState,commitHistory,disposeObject,frameFurnitureVisual,getSpaceCell,getSpaceRoot,mm,nice,
  parseDecimalInput,removeHardwareLinkedToObjects,renderMachiningVisuals,renderSpaces,rootForObject,scene,selectObject,selectSpaceRootOnly,setDesignLabVisualizationOnly,
  setVisualMode,stateString,toast,uid,xray3DActive,
  getSelectedSpaceCell:()=>selectedSpaceCell,getActiveSpaceRootId:()=>activeSpaceRootId,getSelected:()=>selected,setSelected:v=>{selected=v},
  getVisualMode:()=>visualMode,setHistoryMuted:v=>{historyMuted=!!v}
});
moduleRegistry.register('curvedFurniture',curvedFurniture);
({curvedPostSamplesMm,curvedPostPlacementFromSampleMm,curvedPostOutlineMm,createCurvedPost,createCurvedRib,createCurvedCover,openCurvedStructureDialog,curvedFieldNumber,updateCurvedStructurePreview,previewCurvedStructure3D,returnCurvedStructurePreview,createCurvedStructure}=curvedFurniture);
bindCurvedFurnitureUi({runtimeModel,moduleRegistry,$,nice,parseDecimalInput,curvedFieldNumber,curvedFurniture,updateCurvedStructurePreview,returnCurvedStructurePreview,previewCurvedStructure3D,createCurvedStructure,openCurvedStructureDialog});

projects=createProjectsModule({runtimeModel,moduleRegistry,
  $,DESIGNLAB_APP_VERSION,STORAGE_KEY,LEGACY_STORAGE_KEY_V22,LEGACY_STORAGE_KEY_V18,LEGACY_STORAGE_KEY_V15,LEGACY_STORAGE_KEY,LEGACY_STORAGE_KEY_V13,LEGACY_STORAGE_KEY_V12,LEGACY_STORAGE_KEY_V11,LEGACY_STORAGE_KEY_V10,LEGACY_STORAGE_KEY_V9,
  activeSpaceRoot,applyState,authUserName,captureState,clearScene,closeCopyHardwareTool,closeCopyShapeTool,controls,cloudApiFetch,designLabRouteEnterWorkspace:(...a)=>moduleRegistry.callIfReady('backNavigation','designLabRouteEnterWorkspace',...a),designLabRouteMarkHomeTop:(...a)=>moduleRegistry.callIfReady('backNavigation','designLabRouteMarkHomeTop',...a),escapeHtml,
  frameFurnitureVisual,last3DView,remember3DView,openProductionDialog,orthoCamera,perspectiveCamera,renderer,returnTo3D,scene,setDesignLabVisualizationOnly,setFrontWorldView,setPieceVisualEdgesVisible,setVisualMode,stateString,toast,viewSpace,
  get auth(){return auth;},get cloudAccountState(){return cloudAccount.cloudAccountState;},get camera(){return camera;},get visualMode(){return visualMode;},get cadBackgroundMode(){return cadBackgroundMode;},
  get viewMode2D(){return viewMode2D;},get current2DView(){return current2DView;},set current2DView(value){current2DView=value;},
  get historyIndex(){return historyIndex;},set historyIndex(value){historyIndex=value;},setHistory:value=>{history=value;},updateIdentityChrome:(...a)=>moduleRegistry.callIfReady('auth','updateIdentityChrome',...a)
});
moduleRegistry.register('projects',projects);
({projectIsoMs,cloudSaveProjectRecord,syncCloudProjects,claimLegacyProject,claimAllLegacyProjects,projectNow,projectStateHasContent,updateProjectHomeWelcome,scrollProjectHomeTo,openHomeModeling,openHomeMaterials,projectCurrentOwnerId,projectBelongsToCurrentOwner,projectEmergencyKey,prepareProjectAccountSwitch,applyProjectAccountScope,projectDbGet,projectDbPut,captureProjectCamera,restoreProjectCamera,captureProjectThumbnail,updateProjectChrome,markCurrentProjectDirty,projectAutosaveNow,applyProjectPresentationScene,resetProjectHistory,enterProjectEditor,renderProjectHome,showProjectHome,openProjectMetaDialog,closeProjectMetaDialog,readProjectMeta,createNewProject,saveCurrentProject,saveAsCurrentProject,renameCurrentProject,duplicateProjectById,deleteProjectById,exportProjectRecordFile,exportCurrentProjectFile,importProjectFile,requestOpenProject,recoverPendingProject,discardPendingRecovery,closeProjectCardMenu,initProjectHub}=projects);
auth=createAuthModule({runtimeModel,moduleRegistry,$,escapeHtml,cloudApiFetch,syncCloudAccount,updateCloudAccountChrome,updateProjectHomeWelcome,projectAutosaveNow,prepareProjectAccountSwitch,applyProjectAccountScope,get cloudAccountState(){return cloudAccount.cloudAccountState;},setCloudAccountState:value=>{cloudAccount.cloudAccountState=value;}});
moduleRegistry.register('auth',auth);

pieceEditor=createPieceEditorModule({runtimeModel,moduleRegistry,
  $,toast,MIN_SIZE,parseDecimalInput,m,createBox,mm,nice,cellSize,selectSpaceCellByIds,projectCurrentOwnerId,selectedCellInfo,activeSpaceRoot,clearSpaceSelection,COLORS,uid,renderSpaces,getSpaceCell,registerVerticalDivisionFixedBand,commitHistory,setVisualMode,
  pieceCreationTargetInfo:(...a)=>moduleRegistry.callIfReady('doorsDrawers','pieceCreationTargetInfo',...a),spaceDefaultMaterial:productionMaterials.spaceDefaultMaterial,productionMaterialUsesPieceThickness:productionMaterials.productionMaterialUsesPieceThickness,
  saveDoorCreateConfig:(...a)=>moduleRegistry.callIfReady('doorsDrawers','saveDoorCreateConfig',...a),applyDoorCreateConfig:(...a)=>moduleRegistry.callIfReady('doorsDrawers','applyDoorCreateConfig',...a),spaceMultiSelectionInfo:(...a)=>moduleRegistry.callIfReady('doorsDrawers','spaceMultiSelectionInfo',...a),ensureSpaceMultiSelectBar:(...a)=>moduleRegistry.callIfReady('doorsDrawers','ensureSpaceMultiSelectBar',...a),updateDoorCreationVisibility:(...a)=>moduleRegistry.callIfReady('doorsDrawers','updateDoorCreationVisibility',...a),doorCreationConfig:(...a)=>moduleRegistry.callIfReady('doorsDrawers','doorCreationConfig',...a),createDoorsInRegion:(...a)=>moduleRegistry.callIfReady('doorsDrawers','createDoorsInRegion',...a),getSpaceRoot,cellBox,
  get historyMuted(){return historyMuted;},set historyMuted(v){historyMuted=!!v;},get selectedSpaceCell(){return selectedSpaceCell;},set selectedSpaceCell(v){selectedSpaceCell=v;},get doorRegionSelectionMode(){return doorRegionSelectionMode;},set doorRegionSelectionMode(v){doorRegionSelectionMode=!!v;},get visualMode(){return visualMode;}
});
moduleRegistry.register('pieceEditor',pieceEditor);
({savePieceThicknessPreference,savePieceCreateConfig,selectPieceCreateTypeButton,quickCreatePieceFromTypeButton,openCreatePiecesDialog,updateCreatePiecesUI,createPiecesInSelectedCell}=pieceEditor);
({isLocalAuthDevelopment,offlineLicensePublicKey,offlineLicenseStoredToken,offlineLicenseLastSeenKey,clearOfflinePremiumLicense,verifyOfflinePremiumToken,loadOfflinePremiumLicense,storeOfflinePremiumLicense,offlineLicenseRecheckDue,scheduleOfflineLicenseExpiry,handleOfflineLicenseDeadline,showOfflineLicenseExpired,activateOfflinePremiumAccess,tryOfflinePremiumStartup,setAuthStatus,ensurePremiumAccessPanel,hidePremiumAccessPanel,premiumRenderQr,premiumMoney,premiumPurchaseSetStatus,closePremiumPurchase,renderPremiumPurchase,openPremiumPurchase,copyPremiumPix,markPremiumPaymentPaid,verifyPremiumPayment,stopPremiumAccessWatch,premiumWorkspaceAllowed,premiumUntilText,showPremiumAccessRequired,schedulePremiumAccessWatch,verifyPremiumWorkspaceAccess,updateIdentityChrome,lockOnlineApp,unlockOnlineApp,localAuthContinue,waitForNetlifyIdentity,bindIdentityEvents,initOnlineIdentity,authFriendlyError,showAuthInlineForm,authSetBusy,getReadyGoTrue,authSubmitLogin,authSubmitSignup,authSubmitForgot,openIdentityMode,logoutOnlineIdentity}=auth);

doorsDrawers=createDoorsDrawersModule({runtimeModel,moduleRegistry,$,COLORS,MM_TO_M,THREE,activeSpaceRoot,adminAllowed,applyState,buildDoorRegionEnvelope,camera,captureFurniture,captureState,cellCenter,cellSize,cloudAccountState:cloudAccount.cloudAccountState,cloudApiFetch,commitHistory,createBox,createSpace,designLabBase64ToUtf8,disposeObject,escapeHtml,flatPartInfo,frontViewToSpace,furnitureObjects,getBounds,getSheetPrefs,getSpaceCell,getSpaceRoot,groupPartArrayForAspire,hardwareHoleOp,hideGuides,largestVisibleCell,layoutBoundsFromSpace,m,mm,nice,objectBoundsMm,openCreatePiecesDialog,parseDecimalInput,pieceThicknessInfo,placeCustomTemplate,pointWithinPieceTangents,productionObjectKind,projectMaxX,referenceMeshes,removeHardwareLinkedToObjects,renderMachiningVisuals,renderSpaces,renderer,resolvedMachiningCoords,restoreBaseColor,rootForObject,roundMmNumber,sanitizeMachiningForPiece,savePieceThicknessPreference,selectObject,selectSpaceCellByIds,selectedCellInfo,selectedFurnitureRoot,setVisualMode,spaceDefaultMaterial,spaceSelectionKey,toast,uid,updateInspector,updateMeasureBadge,updateSpaceSelectionVisuals,state:doorsDrawersState});
moduleRegistry.register('doorsDrawers',doorsDrawers);
({spaceMultiSelectionEntries,spaceMultiSelectionInfo,ensureSpaceMultiSelectBar,updateSpaceMultiSelectBar,clearSpaceMultiSelection,setSingleSpaceDoorReference,toggleSpaceMultiSelection,pieceCreationTargetInfo,openDoorFromSpaceSelection,ensureSpaceQuickCreateMenu,closeSpaceQuickCreateMenu,prepareSpaceQuickMenuTarget,openSpaceQuickCreateMenu,pickSpaceCellAtClient,openDrawerFromSpaceSelection,isDoorObject,doorObjectsForRoot,doorObjectShouldBeVisible,syncQuickFrontVisibilityButton,applyDoorVisibility,applyAllDoorVisibility,updateDoorsToggleButton,toggleDoorsForActiveSpace,captureDoorCreateConfig,readDoorCreateConfig,applyDoorCreateConfig,saveDoorCreateConfig,doorFieldNumber,doorAutoHingeCount,doorHingeCountResolved,syncDoorCavaPositionOptions,doorCreationConfig,doorHingeSideForIndex,doorHingePositionsMm,doorHandleOwnerForVisual,doorHandleVisualSpec,updateDoorHandleVisualTransform,updateDoorHandleVisuals,createDoorHandleVisual,removeDoorHandleVisualsForOwners,doorMountPanelCandidate,appendDoorHingeDrilling,doorInspectorRuntimeConfig,removeDoorAutomaticHinges,setSelectedDoorHingeSide,updateDoorCreationVisibility,getDrawerSlideLibrary,setDrawerSlideLibrary,refreshDrawerSlideLibrarySelect,captureDrawerSlidePreset,saveDrawerSlidePresetLibrary,applyDrawerSlidePresetLibrary,deleteDrawerSlidePresetLibrary,drawerParseDrillOffsets,drawerDrillTableOffsets,drawerCatalogCodeForLength,drawerDrillDefaults,drawerDrillValuesFromUi,drawerAbsoluteDrillPositions,drawerSetDrillingUiFromPreset,updateDrawerDrillingFields,drawerPreset,drawerSetObjects,drawerSetRepresentative,drawerSetIdsForTarget,drawerPrimarySetIdForTarget,removeDrawerSetsForTarget,drawerConfigFromSet,drawerUniqueConfigsForRoot,drawerTarget,drawerAutoLengthMm,drawerResolvedLengthMm,drawerApplyPresetDefaults,drawerReadConfig,updateDrawerSystemPreview,updateDrawerBottomMachiningFields,updateDrawerFrontFields,openDrawerSystemDialog,drawerReferenceGeometry,drawerFindSidePanel,drawerRemoveMachining,drawerRemoveCabinetDrilling,removeDrawerSet,drawerCreatePiece,drawerAddBottomGroove,drawerRemoveBottomGrooves,drawerExpectedBottomGrooves,drawerBottomGrooveCount,drawerEnsureBottomGroovesForSet,repairDrawerBottomGroovesForRoot,repairAllDrawerBottomGrooves,drawerAddCabinetDrilling,createDrawerSetFromConfig,sanitizeDrawerSet,saveDrawerSystem,deleteDrawerSystem,rebuildDrawerSetsForRoot,doorSystemReadOversizePrefs,doorSystemPreferredOversize,doorSystemRememberOversize,persistDoorLibrary,doorSystemBuiltinRecord,doorSystemBoundsFromParts,doorSystemDetectFacePartIds,doorSystemBuiltinModels,doorSystemIsBuiltinId,doorSystemGlobalMeta,doorSystemHiddenBuiltinIds,doorSystemVisibleOfficialItems,doorSystemModels,doorSystemModelById,doorSystemTemplateItem,doorSystemSelectedRoot,doorSystemDefaultPosition,doorSystemCloudStatusText,doorSystemUpdateAdminUi,doorSystemUpdateModelInfo,renderDoorSystemModels,loadGlobalDoorModels,doorSystemEnsureModelRecord,openDoorSystemDialog,closeDoorSystemDialog,doorSystemUseSelectedDimensions,doorSystemCreate,doorSystemModelPayloadFromRoot,doorSystemPayloadFromModel,doorSystemAdminAddNew,doorSystemAdminReplaceSelected,doorSystemAdminRenameSelected,doorSystemAdminDeleteSelected,doorSystemAdminRestoreBuiltin,saveSelectedDoorModel,deleteSelectedDoorModel,drawerLevelsFromSet,drawerForceNearestSidePair,drawerAddCabinetDrillingOnOwners,repairDrawerDrillingForRoot,repairAllDrawerDrillingForAspire,createDoorsInRegion,resetDrawerDialogState,bindDoorsDrawersUI}=doorsDrawers);
bindDoorsDrawersUI();

$('createPiecesBtn').onclick=()=>openCreatePiecesDialog('left',{doorRegion:false});
$('savePieceCreateConfig').onclick=savePieceCreateConfig;
$('cancelCreatePieces').onclick=()=>{$('createPiecesDialog').style.display='none';pieceEditor.state.pieceTypeLastClickButton=null;pieceEditor.state.pieceTypeLastClickAt=0;doorRegionSelectionMode=false;updateSpaceMultiSelectBar();};
$('createPiecesDialog').addEventListener('pointerdown',e=>{if(e.target===$('createPiecesDialog')){$('createPiecesDialog').style.display='none';doorRegionSelectionMode=false;updateSpaceMultiSelectBar();}});
document.querySelectorAll('[data-piece-type]').forEach(b=>{
  b.title='1 clique seleciona · 2 cliques rápidos criam';
  b.onclick=()=>{
    const now=performance.now();
    const isDouble=pieceEditor.state.pieceTypeLastClickButton===b && (now-pieceEditor.state.pieceTypeLastClickAt)<=pieceEditor.state.PIECE_TYPE_DOUBLE_CLICK_MS;

    selectPieceCreateTypeButton(b);

    if(isDouble){
      pieceEditor.state.pieceTypeLastClickButton=null;
      pieceEditor.state.pieceTypeLastClickAt=0;
      quickCreatePieceFromTypeButton(b);
    }else{
      pieceEditor.state.pieceTypeLastClickButton=b;
      pieceEditor.state.pieceTypeLastClickAt=now;
    }
  };
});
['pieceThickness','pieceFrontInset','pieceBackInset','pieceBackPassLeft','pieceBackPassRight','pieceBackPassTop','pieceBackPassBottom','pieceBackGrooveClearance','piecePosition','pieceCount','pieceDivisionMeasure','doorCount','doorGapLeft','doorGapRight','doorGapTop','doorGapBottom','doorGapMiddle','doorHandleSize','doorHingeCupDiameter','doorHingeCupDepth','doorHingeCupEdge','doorHingeEdgeY','doorMountFrontOffset','doorMountSpacing','doorMountDiameter','doorMountDepth'].forEach(id=>$(id).addEventListener('input',()=>{
  if(id==='pieceThickness')savePieceThicknessPreference({silent:true});
  updateCreatePiecesUI();
}));
$('pieceDivisionSide').addEventListener('change',updateCreatePiecesUI);
$('pieceBackMachine')?.addEventListener('change',updateCreatePiecesUI);
['pieceBackGrooveLeft','pieceBackGrooveRight','pieceBackGrooveTop','pieceBackGrooveBottom'].forEach(id=>$(id)?.addEventListener('change',updateCreatePiecesUI));
['doorHandleType','doorHandleOrientation','doorCavaPosition','doorHingeCount','doorHingeSide'].forEach(id=>$(id).addEventListener('change',()=>{
  if(id==='doorHandleOrientation')syncDoorCavaPositionOptions();
  updateDoorCreationVisibility();updateCreatePiecesUI();
}));
['doorCreateHingeHoles','doorCreateSideHoles'].forEach(id=>$(id).addEventListener('change',()=>{updateDoorCreationVisibility();updateCreatePiecesUI();}));
let createPiecesConfirmBusy=false;
$('confirmCreatePieces').onclick=()=>{
  if(createPiecesConfirmBusy)return;
  createPiecesConfirmBusy=true;
  const btn=$('confirmCreatePieces');
  if(btn)btn.disabled=true;
  try{
    if(createPiecesInSelectedCell()){
      savePieceThicknessPreference({silent:true});
      $('createPiecesDialog').style.display='none';
      pieceEditor.state.pieceTypeLastClickButton=null;
      pieceEditor.state.pieceTypeLastClickAt=0;
    }
  }finally{
    // Evita duas criações quando há duplo clique/toque rápido no botão Criar.
    setTimeout(()=>{createPiecesConfirmBusy=false;if(btn)btn.disabled=false;},250);
  }
};

























// 1.310.00 · navegação Voltar/History movida para js/modules/back-navigation.js.
backNavigation=createBackNavigationModule({runtimeModel,moduleRegistry,
  $,
  state:{get machiningPreviewActive(){return machiningPreviewActive;},get toolMode(){return toolMode;},get viewMode2D(){return viewMode2D;},get camera(){return camera;},get visualMode(){return visualMode;}},
  clearSpaceMultiSelection,quickDockSubmenuVisible,closeQuickDockSubmenu,productionMaterials,closeCopyHardwareTool,machiningShapes,closeCopyShapeTool,curvedFurniture,returnCurvedStructurePreview,returnShapePreview,closeMachining3DPreview,elementIsVisible,closeInspectorOutside,closeSpaceActionsOutside,closeProjectCardMenu,setToolDockOpen,setTool,orthoCamera,returnTo3D,setVisualMode,showAuthInlineForm,projects,showProjectHome
});
moduleRegistry.register('backNavigation',backNavigation);
({designLabRouteEnterWorkspace,designLabRouteMarkHomeTop,designLabRouteEnsureHomeRoot,designLabRunNativeBackCascade}=backNavigation);

// 1.310.00 · eventos da interface movidos para js/modules/ui-events.js.
bindUiEvents({runtimeModel,moduleRegistry,
  $,
  state:{get visualMode(){return visualMode;},get selectedSpaceCell(){return selectedSpaceCell;},get selected(){return selected;},get quickFrontFacesHidden(){return quickFrontFacesHidden;},get cadGridVisible(){return cadGridVisible;},get machiningPreviewActive(){return machiningPreviewActive;},set machiningPreviewActive(v){machiningPreviewActive=!!v;},get machiningPreviewOwner(){return machiningPreviewOwner;},set machiningPreviewOwner(v){machiningPreviewOwner=v;}},
  COLORS,activateOfflinePremiumAccess,activeSpaceRoot,applyBackGroovePreset,applyCadBackground,applyCadGridVisibility,applyCadShadows,applyDesignLabAppTheme,applyDesignLabUpdate,applyExactPanel,applyHole32Preset,applyParametricFormatToPiece,applyPieceNamePreset,applyPieceRelativeConfig,applyQuickFrontVisibility,applySelectedHardware,applySelectedMachiningPreset,applySelectedPieceMaterialFromInspector,applyShapeToPiece,applyState,applyXray3D,auth,authSubmitForgot,authSubmitLogin,authSubmitSignup,cancelDuplicateConfirmation,checkDesignLabUpdate,claimAllLegacyProjects,claimLegacyProject,clampSize,clearConstructionGuides,clearMachiningDraftPreview,clearScene,closeAppSettings,closeLabelsDialog,closeMachining3DPreview,closePremiumPurchase,closeProductionDialog,closeProjectCardMenu,closeProjectMetaDialog,closeShapeDialog,closeUpdateDialog,cloudAccount,commitHistory,confirmDuplicateSelected,copyPremiumPix,createBox,createNewProject,createPieceNamePreset,deleteActiveLibraryFolder,deleteProjectById,deleteSelected,deleteSelectedFromInspector,deleteSelectedHardwarePreset,deleteSelectedMachiningPreset,deleteSelectedSpaceCell,deleteSelectedSpaceRoot,deleteShapePresetLibrary,designLabFurnitureRecordFromFile,designLabRouteEnterWorkspace,discardPendingRecovery,duplicateProjectById,editSelectedShapePreset,enterProjectEditor,exportCurrentProjectFile,exportProjectAspireZip,exportProjectRecordFile,exportSelectedAspireDxf,exportSelectedFurniture,fillHardwareDowelExample,fillHardwareShelfPinExample,fillPieceMaterialSelect,findHardwarePreset,forceDesignLabServerRefresh,globalLibraryFolderById,grooveLengthIsFull,hideQuickSelectedSpace,hideSelectedPieceQuick,importFurnitureData,importLibraryFile,importProjectFile,initOnlineIdentity,labelsApplyPrefs,labelsPrint,labelsSaveHtml,labelsSavePrefs,library,libraryFolderById,loadOfflinePremiumLicense,loadSelectedShapePresetToEditor,localAuthContinue,localCoordField,lockOnlineApp,logoutOnlineIdentity,m,machiningShapes,markPremiumPaymentPaid,newLibraryFolder,newShapePreset,openAppSettings,openCopyHardwareTool,openCopyShapeTool,openDeleteSelectedSpaceCellDialog,openDoorSystemDialog,openEditSelectedSpaceDialog,openEditSpaceDialog,openHardwareBuilder,openHomeMaterials,openHomeModeling,openLabelsDialog,openLibraryRoot,openMachiningDialog,openNewSpaceDialog,openPieceInspector,openProductionDialog,openProjectMetaDialog,openQuickSelectedConfiguration,openShapeDialog,openSlattedPanelDialog,openSpaceFromObject,parseDecimalInput,previewHardware3D,previewShape3D,productionApplyMaterial,productionAssignEdge,productionClearSelectedBands,productionDeleteBand,productionDeleteMaterial,productionEditMaterialStock,productionLoadBandFields,productionLoadMaterialFields,productionMaterials,productionNewBand,productionNewMaterial,productionSaveBand,productionSaveMaterial,productionUpdateMaterialKindFields,projectAutosaveNow,projectDbGet,projects,publishSelectedHardwarePreset,publishSelectedShapePresetGlobal,quickToggleAllSpaces,readProjectMeta,recoverPendingProject,redo,refreshShapeCornerLabels,renameActiveLibraryFolder,renameCurrentProject,renderLabelsPreview,renderLibrary,requestDuplicateSelected,resetPieceRelativeConfig,returnShapePreview,returnTo3D,rotateBox,rotateSelectedPieceGrain,saveAsCurrentProject,saveCloudPreferences,saveCurrentFurnitureToLibrary,saveCurrentMachiningPreset,saveCurrentProject,saveHardwareBuilder,saveMachining,saveShapePresetLibrary,scrollProjectHomeTo,setAuthStatus,setDesignLabVisualizationOnly,setFrontWorldView,setGrooveLengthFull,setHardwareScope,setLibraryScope,setMachiningSurfaceCoordinate,setMachiningType,setSelectedPieceDoNotProduce,setShapeLibraryScope,setSheetPrefs,setVisualMode,shapeApplyCornerEdit,shapeCadClear,shapeCadCloseContour,shapeCadFitView,shapeCadPointerDown,shapeCadPointerLeave,shapeCadPointerMove,shapeCadPointerUp,shapeCadRedo,shapeCadRender,shapeCadSetTool,shapeCadSyncUi,shapeCadUndo,shapeCadZoomBy,shapeCadZoomWheel,shapeCornerSelectFromEvent,shapeFormatTypeChanged,shapeResetCorners,shapeSetCornerStyle,shapeSetMode,shapeTransformEditor,sheetPrefsFromUi,showAllHiddenSpaces,showAllManuallyHiddenPieces,showAuthInlineForm,showMachining3DPreview,showProjectHome,syncCloudAccount,syncGrooveLengthButton,syncManualPieceVisibilityButtons,syncQuickSpaceVisibilityButton,toast,toggleActiveSpaceVisibility,toggleCadHardwareVisibility,toggleCadMachiningVisibility,toggleDockXray,toggleDoorsForActiveSpace,toggleMachiningCoordSign,undo,unlockOnlineApp,updateBackGrooveVisibility,updateHardwareBuilderUi,updateHardwarePanel,updateHoleSeriesVisibility,updateInspector,updateMachiningPresetInfo,updateMachiningUI,updatePieceMaterialQuickInfo,updateShapePreview,verifyPremiumPayment,viewSpace,selectedCellInfo,mm,nice,adminAllowed,openAdminPanel,closeAdminPanel,adminSetTab,refreshAdminPanel,saveAdminSettings,adminPanelState,loadAdminUsers,loadAdminPayments,loadAdminStats,adminPremium,adminRevokePremium,adminBanUser,adminPaymentAction
});

// 1.310.00 · ciclo de vida e inicialização final movidos para js/modules/runtime-bootstrap.js.
startRuntimeBootstrap({runtimeModel,moduleRegistry,
  $,
  state:{get viewMode2D(){return viewMode2D;},get current2DView(){return current2DView;},get camera(){return camera;},get dragMode(){return dragMode;}},
  installOutsideMenuClose,sheetPreviewDraw,renderer,updateCadEdgeResolution,perspectiveCamera,activeSpaceRoot,viewSpace,designLabRuntimeBuild,DESIGNLAB_JS_BUILD,updateCacheStatusUI,initDesignLabInstallExperience,initDesignLabServiceWorker,checkDesignLabUpdate,auth,offlineLicenseRecheckDue,verifyPremiumWorkspaceAccess,cloudAccount,syncCloudPreferences,saveCloudPreferences,loadOfflinePremiumLicense,showOfflineLicenseExpired,designLabRouteEnsureHomeRoot,setFrontWorldView,stateString,
  setHistory:v=>{history=v;},setHistoryIndex:v=>{historyIndex=v;},initToolDock,initSpaceActionsDrag,initPieceInspectorFloating,initProjectHub,toast,initOnlineIdentity,setAuthStatus,controls,updateLiveLabel,updateMachiningVisualTransforms,updateDoorHandleVisuals,scene,updateXray3DButton,applyCadDetailVisibility,setPieceVisualEdgesVisible
});

// 1.310.00 · layout técnico movido para js/modules/technical-layout.js.

// 1.310.00 · produção/histórico/montagem movidos para js/modules/production-suite.js.

// ============================================================================
// 1.310.00 · LAYOUT TÉCNICO + PRODUÇÃO EM MÓDULOS
// ============================================================================
technicalLayout=createTechnicalLayoutModule({runtimeModel,moduleRegistry,
  $,THREE,objectBelongsToRoot,getSpaceRoot,selectedFurnitureRoot,activeSpaceRoot,rootBounds,projects,safeFileName,downloadText,toast,setToolDockOpen,
  get activeSpaceRootId(){return activeSpaceRootId;}
});
moduleRegistry.register('technicalLayout',technicalLayout);
({openTechnicalLayoutDialog,dlLayoutState,dlLayoutIsDoor,dlLayoutIsFront,dlLayoutPopulateScope,dlLayoutBuildDirectCanvas,dlLayoutDownloadBlob,dlLayoutCanvasJpegData,dlLayoutPdfWithJpegs,dlLayoutWithTemporaryState,closeLayoutPrintPreview}=technicalLayout);

productionSuite=createProductionSuiteModule({runtimeModel,moduleRegistry,
  $,THREE,projects,toast,projectStateHasContent,projectNow,projectDbGet,projectDbPut,projectBelongsToCurrentOwner,projectIsoMs,cloudSaveProjectRecord,auth,projectAutosaveNow,projectCurrentOwnerId,projectEmergencyKey,captureProjectThumbnail,STORAGE_KEY,escapeHtml,captureState,captureProjectCamera,restoreProjectCamera,DESIGNLAB_APP_VERSION,updateProjectChrome,applyProjectPresentationScene,applyState,resetProjectHistory,
  normalizePieceEdgeBands:(...a)=>productionMaterials.normalizePieceEdgeBands(...a)??(a[0]||{}),productionObjectKind:productionMaterials.productionObjectKind,productionMaterialById:productionMaterials.productionMaterialById,productionMaterialKind:productionMaterials.productionMaterialKind,pieceThicknessInfo,productionMaterialUsesPieceThickness:productionMaterials.productionMaterialUsesPieceThickness,normalizePieceGrainRotation:(...a)=>productionMaterials.normalizePieceGrainRotation(...a)??0,
  groupAspireProjectParts,buildMingliZawFiles,getSheetPrefs,normalizedSheetPrefs,cutPlanPartAreaMm2,allProjectFurnitureParts,allProjectProductionPartsByKind,cutPlanAssignCodes,cutPlanPackOpen,nice,csvLine,layerNum,frameFurnitureVisual,orthoCamera,returnTo3D,setVisualMode,viewSpace,safeFileName,downloadText,scene,labelsPrefs,labelsBuildItems,labelsPrintDocument,buildPartsCsv,buildLabelsBaseCsv,buildMachiningCsv,buildSheetsCsv,buildPanelSawCutsCsv,zipStore,
  dlLayoutState,dlLayoutIsDoor,dlLayoutIsFront,dlLayoutPopulateScope,dlLayoutBuildDirectCanvas,dlLayoutDownloadBlob,dlLayoutCanvasJpegData,dlLayoutPdfWithJpegs,dlLayoutWithTemporaryState,openTechnicalLayoutDialog,openProductionDialog,closeProductionDialog,closeToolDockBeforeMenu,syncToolDockButtons,TOOL_DOCK_CATALOG,toolDockPrefs,saveToolDockPrefs,renderToolDock,initQuickDock,
  repairAllDrawerBottomGrooves:doorsDrawers.repairAllDrawerBottomGrooves,repairAllDrawerDrillingForAspire:doorsDrawers.repairAllDrawerDrillingForAspire,activeSpaceRoot,
  get cloudAccountState(){return cloudAccount.cloudAccountState;},get visualMode(){return visualMode;},get viewMode2D(){return viewMode2D;},get current2DView(){return current2DView;},get camera(){return camera;},
  getMarkCurrentProjectDirty:()=>markCurrentProjectDirty,setMarkCurrentProjectDirty:fn=>{markCurrentProjectDirty=fn;},getSaveCurrentProject:()=>saveCurrentProject,setSaveCurrentProject:fn=>{saveCurrentProject=fn;},getRunDockTool:()=>toolDockUi.getRunDockTool(),setRunDockTool:fn=>toolDockUi.setRunDockTool(fn)
});
moduleRegistry.register('productionSuite',productionSuite);
({dlLinearPieceLengthMm,dlPackMetalBars,dlWoodPlanGroups,dlMetalPlanGroups,dlRenderGeneralPartsSummary,dlRenderInlineLinearPlans}=productionSuite);

