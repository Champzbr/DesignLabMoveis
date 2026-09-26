// DesignLabMoveis 1.311.00 · coleções e objetos mutáveis centrais do editor.
export function createRuntimeModel({THREE,scene,$}){
  const objects=[];

  const machiningVisualGroup=new THREE.Group();
  machiningVisualGroup.userData.isMachiningVisualGroup=true;
  scene.add(machiningVisualGroup);

  const machiningDraftPreviewGroup=new THREE.Group();
  machiningDraftPreviewGroup.userData.isMachiningDraftPreviewGroup=true;
  scene.add(machiningDraftPreviewGroup);

  const spaceRoots=[];
  const spacePickMeshes=[];
  const selectedSpaceCells=new Map();

  const dragOffset=new THREE.Vector3();
  const dragAxisOrigin=new THREE.Vector3();
  const freeMovePlane=new THREE.Plane();
  const freeMoveStartPoint=new THREE.Vector3();
  const freeMoveCurrentPoint=new THREE.Vector3();
  const freeMoveStartPosition=new THREE.Vector3();
  const freeMovePlaneNormal=new THREE.Vector3();
  const movePickPoint=new THREE.Vector3();
  const moveAxisDir=new THREE.Vector3();
  const movingSpaceStartPoint=new THREE.Vector3();
  const movingSpaceCurrentPoint=new THREE.Vector3();
  const moveDownAim=new THREE.Vector2();
  const radiusDir=new THREE.Vector3(1,0,0);

  const constructionGuides=[];
  const tapePointTouchPointers=new Set();
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();

  return {
    objects,
    machiningVisualGroup,
    machiningDraftPreviewGroup,
    spaceRoots,
    spacePickMeshes,
    selectedSpaceCells,
    dragOffset,
    dragAxisOrigin,
    freeMovePlane,
    freeMoveStartPoint,
    freeMoveCurrentPoint,
    freeMoveStartPosition,
    freeMovePlaneNormal,
    movePickPoint,
    moveAxisDir,
    movingSpaceStartPoint,
    movingSpaceCurrentPoint,
    moveDownAim,
    radiusDir,
    constructionGuides,
    tapePointTouchPointers,
    raycaster,
    pointer,
    liveLabel:$('liveLabel'),
    measureBadge:$('measureBadge'),
    tapeCrosshair:$('tapeCrosshair'),
    tapeCrosshairLabel:$('tapeCrosshairLabel'),
    tapeSnapDot:$('tapeSnapDot')
  };
}
