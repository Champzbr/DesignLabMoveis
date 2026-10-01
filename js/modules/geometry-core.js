// DesignLabMoveis 1.311.00 · Núcleo geométrico de peças.
export function createGeometryCoreModule(ctx){
  const { $, THREE, COLORS, clampSize, canonicalFactoryMaterialId, productionMaterialById, productionColorInt, makeMaterials, normalizePieceGrainRotation, normalizePieceEdgeBands, uid, productionClone, applySpaceDefaultMaterialToObject, makeCadEdgeMaterial, makeBoxVisualEdges, xray3DActive, scene, isDoorObject, getSpaceRoot, doorObjectShouldBeVisible, rebuildFormGeometry, applyPieceProductionEdgeColors, renderMachiningVisuals, selectObject, commitHistory }=ctx;
  const runtimeModel=ctx.runtimeModel;

function setAllFaces(mesh, color){
  const mats = mesh.userData.faceMaterials || [];
  mats.forEach(mat=>mat.color.set(color));
  // Mesmo selecionada, a peça continua mostrando quais bordas têm fita.
  applyPieceProductionEdgeColors(mesh);
}
function restoreBaseColor(mesh){ setAllFaces(mesh, mesh.userData.baseColor ?? COLORS.default); }


// 1.311.00 · Espaços/cortes movidos para js/modules/spaces-cuts.js.

function createBox({width=1, depth=1, height=1, x=0, yBase=0, z=0, name='Cubo', kind='box', materialType='genérico', baseColor=COLORS.default, materialId=null, materialCode='', materialGrain=false, materialGrainRotation=0, materialCoreColor=null, edgeBands={}, partId=null, labelMeta=null, spaceRootId=null, machining=[], forms=[], rotationX=0, rotationY=0, rotationZ=0, divisionNominalThicknessM=null, curvedRole=null, curvedConfig=null, drawerSetId=null, drawerRole=null, drawerIndex=null, drawerConfig=null, doorConfig=null, doorSystem=null, doorHandleVisual=false, doorHandleOwnerPartId=null, hiddenByUser=false, excludeFromCutList=false, spaceCutting=false, spaceCutParentBounds=null, manualGeometryDelta=null, pieceSavedConfig=null, cutPlanSheetHint=null}={}, doHistory=true){
  // 1.200.95 · migra automaticamente IDs antigos (Branco TX 6/15/18 etc.)
  // para o cadastro único do material, preservando a espessura da própria peça.
  const canonicalMaterialId=canonicalFactoryMaterialId(materialId);
  const canonicalMaterial=productionMaterialById(canonicalMaterialId);
  if(canonicalMaterial?.factory){
    materialId=canonicalMaterial.id;
    materialType=canonicalMaterial.name;
    materialCode=canonicalMaterial.code||'';
    materialGrain=!!canonicalMaterial.grain;
    materialCoreColor=canonicalMaterial.coreColor||null;
    baseColor=productionColorInt(canonicalMaterial.color,baseColor);
  }else materialId=canonicalMaterialId||materialId;
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  const mats=makeMaterials(baseColor,6);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mats);
  mesh.scale.set(width,height,depth);
  mesh.position.set(x,yBase+height/2,z);
  mesh.rotation.order='XYZ';
  mesh.rotation.set(Number(rotationX)||0,Number(rotationY)||0,Number(rotationZ)||0);
  mesh.userData={
    kind,width,depth,height,name,materialType,baseColor,
    materialId:materialId||null,
    materialCode:String(materialCode||''),
    materialGrain:!!materialGrain,
    materialGrainRotation:normalizePieceGrainRotation(materialGrainRotation),
    materialCoreColor:materialCoreColor||null,
    edgeBands:normalizePieceEdgeBands(edgeBands||{}),
    partId:partId||uid('part'),
    labelMeta:labelMeta?productionClone(labelMeta):{schemaVersion:1,enabled:true,custom:{}},
    faceMaterials:mats,spaceRootId:spaceRootId||null,
    machining:Array.isArray(machining)?JSON.parse(JSON.stringify(machining)):[],
    forms:Array.isArray(forms)?JSON.parse(JSON.stringify(forms)):[],
    rotationX:Number(rotationX)||0,rotationY:Number(rotationY)||0,rotationZ:Number(rotationZ)||0,
    divisionNominalThicknessM:Number.isFinite(Number(divisionNominalThicknessM))&&Number(divisionNominalThicknessM)>0?Number(divisionNominalThicknessM):null,
    curvedRole:curvedRole||null,
    curvedConfig:curvedConfig?JSON.parse(JSON.stringify(curvedConfig)):null,
    drawerSetId:drawerSetId||null,drawerRole:drawerRole||null,
    drawerIndex:Number.isFinite(Number(drawerIndex))?Number(drawerIndex):null,
    drawerConfig:drawerConfig?JSON.parse(JSON.stringify(drawerConfig)):null,
    doorConfig:doorConfig?JSON.parse(JSON.stringify(doorConfig)):null,
    // 1.300.17 · metadados do Sistema de Portas.
    doorSystem:doorSystem?JSON.parse(JSON.stringify(doorSystem)):null,
    // 1.300.17 · puxador externo simples, apenas visual (não entra em produção).
    doorHandleVisual:!!doorHandleVisual,
    doorHandleOwnerPartId:doorHandleOwnerPartId?String(doorHandleOwnerPartId):null,
    hiddenByUser:!!hiddenByUser,
    excludeFromCutList:!!excludeFromCutList,
    spaceCutting:!!spaceCutting,
    // Guarda o vão ORIGINAL no qual esta peça estrutural foi criada. Isso
    // permite devolver somente a espessura da peça ao vão correto ao apagá-la,
    // sem misturar com divisões vizinhas do mesmo espaço.
    spaceCutParentBounds:spaceCutParentBounds?JSON.parse(JSON.stringify(spaceCutParentBounds)):null,
    // 1.200.95 · ajustes manuais da configuração da peça ficam separados da
    // geometria paramétrica. Assim Biblioteca/redimensionamento recalculam a
    // peça-base e reaplicam exatamente os mesmos milímetros/posição depois.
    manualGeometryDelta:manualGeometryDelta?JSON.parse(JSON.stringify(manualGeometryDelta)):null,
    pieceSavedConfig:pieceSavedConfig?JSON.parse(JSON.stringify(pieceSavedConfig)):null
  };
  mesh.castShadow=true; mesh.receiveShadow=true;

  // Se a peça não recebeu material explicitamente, herda o material padrão
  // do espaço quando a espessura nominal da chapa corresponde à peça.
  // Isso evita aplicar MDF 18 mm automaticamente em um fundo de gaveta 6 mm.
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});
  // 1.300.38 · recua só o depth das faces (não a geometria nem a cor) para que
  // o contorno nativo do Firefox não brigue pixel a pixel com a própria peça.
  for(const mat of (mesh.userData?.faceMaterials||[])){
    if(!mat)continue;
    mat.polygonOffset=true;mat.polygonOffsetFactor=1;mat.polygonOffsetUnits=1;mat.needsUpdate=true;
  }

  const visualEdgeMat=makeCadEdgeMaterial({color:xray3DActive()?0x111111:0x2b2f30,transparent:true,opacity:xray3DActive()?.82:.68,depthTest:!xray3DActive(),depthWrite:false,linewidth:xray3DActive()?1.45:1.1,xray:xray3DActive()});
  const visualEdges=makeBoxVisualEdges(visualEdgeMat,{xray:xray3DActive()});
  visualEdges.visible=true;
  mesh.add(visualEdges); mesh.userData.visualEdges=visualEdges;
  scene.add(mesh); runtimeModel.objects.push(mesh);
  // 1.200.75: se a visualização rápida de frentes estiver oculta, qualquer
  // porta/frente de gaveta criada enquanto ela estiver ativa já nasce escondida.
  if(isDoorObject(mesh)){
    const doorRoot=mesh.userData?.spaceRootId?getSpaceRoot(mesh.userData.spaceRootId):null;
    mesh.visible=doorObjectShouldBeVisible(mesh,doorRoot);
    mesh.userData.hiddenByDoors=!mesh.visible;
  }
  if(mesh.userData.hiddenByUser){
    mesh.visible=false;
    if(mesh.userData.visualEdges)mesh.userData.visualEdges.visible=false;
  }
  if(mesh.userData.forms.length) rebuildFormGeometry(mesh);
  restoreBaseColor(mesh);
  selectObject(mesh);
  if(mesh.userData.machining.length) renderMachiningVisuals();
  if(doHistory) commitHistory();
  return mesh;
}

// 1.311.00 · móveis curvos movidos para js/modules/curved-furniture.js

function createCylinder({diameter=1,height=1,x=0,yBase=0,z=0,name='Cilindro'}={}, doHistory=true){
  diameter=clampSize(diameter); height=clampSize(height);
  const mats=makeMaterials(COLORS.default,3);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,48),mats);
  mesh.scale.set(diameter,height,diameter);
  mesh.position.set(x,yBase+height/2,z);
  mesh.userData={kind:'cylinder',width:diameter,depth:diameter,height,name,materialType:'genérico',baseColor:COLORS.default,faceMaterials:mats};
  mesh.castShadow=true; mesh.receiveShadow=true;
  scene.add(mesh); runtimeModel.objects.push(mesh); selectObject(mesh);
  if(doHistory) commitHistory();
  return mesh;
}

  return { setAllFaces, restoreBaseColor, createBox, createCylinder };
}
