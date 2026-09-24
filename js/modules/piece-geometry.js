// DesignLabMoveis 1.310.00 · Geometria/configuração manual das peças.
export function createPieceGeometryModule(ctx){
  const { $, THREE, state, nice, m, MIN_SIZE, MAX_SIZE, toast, openDrawerSystemDialog, renderMachiningVisuals, updateInspector, updateMeasureBadge, commitHistory, clampSize, rebuildFormGeometry, remapMachiningForPieceResize, sanitizeMachiningForPiece, remapMachiningAxes, normalizePieceGrainRotation, productionClone, createCylinder, createCurvedRib, createCurvedCover, createCurvedPost, createBox, openPieceInspector, deleteSelected } = ctx;

function normalizePieceManualGeometryDelta(v){
  const src=v&&typeof v==='object'?v:{};
  const out={};
  for(const k of ['dw','dd','dh','dx','dyBase','dz','drx','dry','drz']){
    const n=Number(src[k]);out[k]=Number.isFinite(n)?n:0;
  }
  return out;
}
function pieceGeometrySnapshot(mesh){
  if(!mesh)return null;const u=mesh.userData||{};
  return {
    width:Number(u.width)||0,depth:Number(u.depth)||0,height:Number(u.height)||0,
    x:Number(mesh.position.x)||0,yBase:(Number(mesh.position.y)||0)-(Number(u.height)||0)/2,z:Number(mesh.position.z)||0,
    rx:Number(mesh.rotation.x)||0,ry:Number(mesh.rotation.y)||0,rz:Number(mesh.rotation.z)||0
  };
}
function accumulatePieceManualGeometryDelta(mesh,before){
  if(!mesh||!before)return;const after=pieceGeometrySnapshot(mesh),u=mesh.userData||{};
  const d=normalizePieceManualGeometryDelta(u.manualGeometryDelta);
  d.dw+=after.width-before.width;d.dd+=after.depth-before.depth;d.dh+=after.height-before.height;
  d.dx+=after.x-before.x;d.dyBase+=after.yBase-before.yBase;d.dz+=after.z-before.z;
  d.drx+=after.rx-before.rx;d.dry+=after.ry-before.ry;d.drz+=after.rz-before.rz;
  for(const k of Object.keys(d))if(Math.abs(d[k])<1e-12)d[k]=0;
  u.manualGeometryDelta=d;
}
function normalizePieceSavedConfig(v){
  const src=v&&typeof v==='object'?v:{};
  const num=(obj,k)=>{const n=Number(obj?.[k]);return Number.isFinite(n)?n:0;};
  return {
    move:{x:num(src.move,'x'),y:num(src.move,'y'),z:num(src.move,'z')},
    faces:{left:num(src.faces,'left'),right:num(src.faces,'right'),back:num(src.faces,'back'),front:num(src.faces,'front'),bottom:num(src.faces,'bottom'),top:num(src.faces,'top')},
    rotation:{x:num(src.rotation,'x'),y:num(src.rotation,'y'),z:num(src.rotation,'z')}
  };
}
function loadPieceRelativeInputs(mesh=state.selected){
  const cfg=normalizePieceSavedConfig(mesh?.userData?.pieceSavedConfig);
  const values={
    pieceMoveX:cfg.move.x,pieceMoveY:cfg.move.y,pieceMoveZ:cfg.move.z,
    pieceFaceLeft:cfg.faces.left,pieceFaceRight:cfg.faces.right,pieceFaceBack:cfg.faces.back,pieceFaceFront:cfg.faces.front,
    pieceFaceBottom:cfg.faces.bottom,pieceFaceTop:cfg.faces.top,
    pieceRotX:cfg.rotation.x,pieceRotY:cfg.rotation.y,pieceRotZ:cfg.rotation.z
  };
  for(const [id,val] of Object.entries(values)){const el=$(id);if(el)el.value=nice(val);}
}
function pieceParametricBaseFromRecord(p){
  const d=normalizePieceManualGeometryDelta(p?.manualGeometryDelta);
  const width=Math.max(.001,(Number(p?.width)||0)-d.dw),depth=Math.max(.001,(Number(p?.depth)||0)-d.dd),height=Math.max(.001,(Number(p?.height)||0)-d.dh);
  return {d,width,depth,height,x:(Number(p?.x)||0)-d.dx,yBase:(Number(p?.yBase)||0)-d.dyBase,z:(Number(p?.z)||0)-d.dz};
}
function pieceMappedGeometryWithManualDelta(p,mapX,mapY,mapZ){
  const b=pieceParametricBaseFromRecord(p),d=b.d;
  const x0=mapX(b.x-b.width/2),x1=mapX(b.x+b.width/2),y0=mapY(b.yBase),y1=mapY(b.yBase+b.height),z0=mapZ(b.z-b.depth/2),z1=mapZ(b.z+b.depth/2);
  const baseW=Math.max(.001,Math.abs(x1-x0)),baseH=Math.max(.001,Math.abs(y1-y0)),baseD=Math.max(.001,Math.abs(z1-z0));
  return {
    width:Math.max(.001,baseW+d.dw),height:Math.max(.001,baseH+d.dh),depth:Math.max(.001,baseD+d.dd),
    x:(x0+x1)/2+d.dx,yBase:Math.min(y0,y1)+d.dyBase,z:(z0+z1)/2+d.dz
  };
}

const PIECE_RELATIVE_INPUT_IDS=[
  'pieceMoveX','pieceMoveY','pieceMoveZ',
  'pieceFaceLeft','pieceFaceRight',
  'pieceFaceBack','pieceFaceFront',
  'pieceFaceBottom','pieceFaceTop',
  'pieceRotX','pieceRotY','pieceRotZ'
];

function pieceRelativeNumber(id){
  const raw=String($(id)?.value??'0').trim().replace(',','.');
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}
function resetPieceRelativeInputs(){
  for(const id of PIECE_RELATIVE_INPUT_IDS){
    const el=$(id);if(el)el.value='0';
  }
}
function pieceRelativeEditable(mesh){
  if(!mesh)return {ok:false,message:'Selecione uma peça'};
  const u=mesh.userData||{};
  if(u.kind==='hardware-visual')return {ok:false,message:'Esta é uma ferragem visual. Edite pelo sistema de ferragens/corrediças.'};
  if(u.drawerSetId)return {ok:false,message:'Esta peça pertence a um conjunto paramétrico de gavetas. Edite pela ferramenta Gavetas / corrediças.'};
  if(u.kind==='curved-panel'||u.curvedRole)return {ok:false,message:'Peças do móvel curvo continuam sendo editadas pela ferramenta Móvel curvo.'};
  if(u.kind==='cylinder')return {ok:false,message:'Este ajuste é destinado às peças retangulares.'};
  return {ok:true};
}
function pieceLocalAxisVector(mesh,axis){
  const v=axis==='x'
    ? new THREE.Vector3(1,0,0)
    : axis==='y'
      ? new THREE.Vector3(0,1,0)
      : new THREE.Vector3(0,0,1);
  return v.applyQuaternion(mesh.quaternion).normalize();
}
function syncPieceRotationMetadata(mesh){
  if(!mesh)return;
  mesh.userData.rotationX=Number(mesh.rotation.x)||0;
  mesh.userData.rotationY=Number(mesh.rotation.y)||0;
  mesh.userData.rotationZ=Number(mesh.rotation.z)||0;
}
function applyPieceRelativeConfig(){
  const check=pieceRelativeEditable(state.selected);
  if(!check.ok){
    toast(check.message);
    if(state.selected?.userData?.drawerSetId)openDrawerSystemDialog(state.selected);
    return;
  }

  // Os campos agora representam o AJUSTE TOTAL salvo da peça, e não uma ação
  // descartável. Se o usuário tinha -18 e muda para -20, aplicamos somente -2.
  const desired=normalizePieceSavedConfig({
    move:{x:pieceRelativeNumber('pieceMoveX'),y:pieceRelativeNumber('pieceMoveY'),z:pieceRelativeNumber('pieceMoveZ')},
    faces:{left:pieceRelativeNumber('pieceFaceLeft'),right:pieceRelativeNumber('pieceFaceRight'),back:pieceRelativeNumber('pieceFaceBack'),front:pieceRelativeNumber('pieceFaceFront'),bottom:pieceRelativeNumber('pieceFaceBottom'),top:pieceRelativeNumber('pieceFaceTop')},
    rotation:{x:pieceRelativeNumber('pieceRotX'),y:pieceRelativeNumber('pieceRotY'),z:pieceRelativeNumber('pieceRotZ')}
  });
  const saved=normalizePieceSavedConfig(state.selected.userData?.pieceSavedConfig);
  const sub=(a,b)=>Number(a)-Number(b);
  const moveMm={x:sub(desired.move.x,saved.move.x),y:sub(desired.move.y,saved.move.y),z:sub(desired.move.z,saved.move.z)};
  const faceMm={
    left:sub(desired.faces.left,saved.faces.left),right:sub(desired.faces.right,saved.faces.right),
    back:sub(desired.faces.back,saved.faces.back),front:sub(desired.faces.front,saved.faces.front),
    bottom:sub(desired.faces.bottom,saved.faces.bottom),top:sub(desired.faces.top,saved.faces.top)
  };
  const rotDeg={x:sub(desired.rotation.x,saved.rotation.x),y:sub(desired.rotation.y,saved.rotation.y),z:sub(desired.rotation.z,saved.rotation.z)};

  const nums=[...Object.values(moveMm),...Object.values(faceMm),...Object.values(rotDeg)];
  if(!nums.every(Number.isFinite)){toast('Confira os valores da configuração');return;}

  const before=pieceGeometrySnapshot(state.selected);
  const u=state.selected.userData;
  const oldW=Number(u.width)||0,oldD=Number(u.depth)||0,oldH=Number(u.height)||0;
  const newW=oldW+m(faceMm.left+faceMm.right);
  const newD=oldD+m(faceMm.back+faceMm.front);
  const newH=oldH+m(faceMm.bottom+faceMm.top);
  if(newW<MIN_SIZE||newD<MIN_SIZE||newH<MIN_SIZE){toast('O ajuste deixaria a peça com medida menor que 1 mm');return;}
  if(newW>MAX_SIZE||newD>MAX_SIZE||newH>MAX_SIZE){toast('O ajuste ultrapassa a medida máxima permitida');return;}

  const shiftLocalX=m((faceMm.right-faceMm.left)/2);
  const shiftLocalY=m((faceMm.top-faceMm.bottom)/2);
  const shiftLocalZ=m((faceMm.front-faceMm.back)/2);
  if(Math.abs(shiftLocalX)>1e-12)state.selected.position.addScaledVector(pieceLocalAxisVector(state.selected,'x'),shiftLocalX);
  if(Math.abs(shiftLocalY)>1e-12)state.selected.position.addScaledVector(pieceLocalAxisVector(state.selected,'y'),shiftLocalY);
  if(Math.abs(shiftLocalZ)>1e-12)state.selected.position.addScaledVector(pieceLocalAxisVector(state.selected,'z'),shiftLocalZ);

  if(Math.abs(newW-oldW)>1e-12||Math.abs(newD-oldD)>1e-12||Math.abs(newH-oldH)>1e-12)setDimensions(state.selected,newW,newD,newH,false);
  state.selected.position.x+=m(moveMm.x);state.selected.position.y+=m(moveMm.y);state.selected.position.z+=m(moveMm.z);
  state.selected.rotation.order='XYZ';
  state.selected.rotation.x+=THREE.MathUtils.degToRad(rotDeg.x);state.selected.rotation.y+=THREE.MathUtils.degToRad(rotDeg.y);state.selected.rotation.z+=THREE.MathUtils.degToRad(rotDeg.z);
  syncPieceRotationMetadata(state.selected);

  // Só depois de aplicar a diferença, a configuração digitada vira o novo
  // estado persistente. Isso impede clicar duas vezes em Aplicar de duplicar o ajuste.
  u.pieceSavedConfig=desired;
  accumulatePieceManualGeometryDelta(state.selected,before);
  state.selected.updateMatrixWorld(true);
  if(Array.isArray(u.machining)&&u.machining.length)renderMachiningVisuals();
  updateInspector();updateMeasureBadge();commitHistory();

  const changedFaces=Object.entries(faceMm).filter(([,v])=>Math.abs(v)>1e-12).map(([k])=>({left:'esquerda',right:'direita',back:'trás',front:'frente',bottom:'baixo',top:'cima'}[k]));
  const parts=[];if(moveMm.x||moveMm.y||moveMm.z)parts.push('posição salva');if(changedFaces.length)parts.push(`faces: ${changedFaces.join(', ')}`);if(rotDeg.x||rotDeg.y||rotDeg.z)parts.push('rotação salva');
  toast(parts.length?`Configuração da peça salva · ${parts.join(' · ')}`:'Configuração já estava aplicada');
}
function resetPieceRelativeConfig(){
  for(const id of PIECE_RELATIVE_INPUT_IDS){const el=$(id);if(el)el.value='0';}
  applyPieceRelativeConfig();
}

function setDimensions(mesh,width,depth,height,keepBase=true,followMachining=true){
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  const oldDimsMm={x:Number(mesh.userData.width)*1000,y:Number(mesh.userData.height)*1000,z:Number(mesh.userData.depth)*1000};
  const oldBase=mesh.position.y-mesh.userData.height/2;
  if(mesh.userData.kind==='cylinder'){
    const d=width; mesh.scale.set(d,height,d); mesh.userData.width=d; mesh.userData.depth=d; mesh.userData.height=height;
  }else{
    mesh.userData.width=width; mesh.userData.depth=depth; mesh.userData.height=height;
    if(Array.isArray(mesh.userData.forms)&&mesh.userData.forms.length){mesh.scale.set(1,1,1);rebuildFormGeometry(mesh);}else mesh.scale.set(width,height,depth);
  }
  if(keepBase) mesh.position.y=oldBase+height/2;
  if(followMachining)remapMachiningForPieceResize(mesh,oldDimsMm,{x:Number(mesh.userData.width)*1000,y:Number(mesh.userData.height)*1000,z:Number(mesh.userData.depth)*1000});
  sanitizeMachiningForPiece(mesh);
}

function applyExactPanel(){
  if(!state.selected) return;
  if(state.selected.userData?.kind==='curved-panel'||state.selected.userData?.curvedRole){toast('Edite estruturas curvas/capas pela ferramenta Móvel curvo');return;}
  if(state.selected.userData?.drawerSetId){toast('Edite este conjunto pela ferramenta Gavetas / corrediças');openDrawerSystemDialog(state.selected);return;}
  const w=clampSize(m($('dimW').value)), d=clampSize(m($('dimD').value)), h=clampSize(m($('dimH').value));
  const x=m($('posX').value), yBase=m($('posY').value), z=m($('posZ').value);
  if(![w,d,h,x,yBase,z].every(Number.isFinite)){ toast('Confira os valores'); return; }
  const before=pieceGeometrySnapshot(state.selected);
  state.selected.userData.name=$('partNameInput').value.trim() || state.selected.userData.name || 'Peça';
  setDimensions(state.selected,w,d,h,false);
  state.selected.position.set(x,yBase+h/2,z);
  syncPieceRotationMetadata(state.selected);
  accumulatePieceManualGeometryDelta(state.selected,before);
  updateInspector(); updateMeasureBadge(); commitHistory(); toast('Medidas / posição salvas na peça');
}

function rotateBox(axis){
  if(!state.selected) return;
  if(Array.isArray(state.selected.userData?.forms)&&state.selected.userData.forms.length){toast('Remova ou edite a Forma antes de girar a peça');return;}
  if(state.selected.userData.kind==='cylinder'){ toast('Rotação de cilindro ainda não é necessária'); return; }
  const before=pieceGeometrySnapshot(state.selected);
  const u=state.selected.userData;
  const base=state.selected.position.y-u.height/2;
  let w=u.width,d=u.depth,h=u.height;
  if(axis==='x'){ remapMachiningAxes(u,'y','z'); [d,h]=[h,d]; }
  if(axis==='y'){ remapMachiningAxes(u,'x','z'); [w,d]=[d,w]; }
  if(axis==='z'){ remapMachiningAxes(u,'x','y'); [w,h]=[h,w]; }
  setDimensions(state.selected,w,d,h,false,false);
  state.selected.position.y=base+h/2;
  if(u.kind==='panel') u.materialType='MDF';
  accumulatePieceManualGeometryDelta(state.selected,before);
  updateInspector(); updateMeasureBadge(); commitHistory();
}

function rotateSelectedPieceGrain(){
  if(!state.selected){toast('Selecione uma peça');return;}
  const u=state.selected.userData||{};
  if(u.kind==='cylinder'||u.kind==='hardware-visual'){toast('Esta opção é para peças de chapa');return;}
  if(!u.materialGrain){toast('O material desta peça não está marcado como madeirado / com veio');return;}
  u.materialGrainRotation=normalizePieceGrainRotation(u.materialGrainRotation)===90?0:90;
  updateInspector();
  commitHistory();
  toast(u.materialGrainRotation===90?'Veio da peça rotacionado 90° · geometria não foi alterada':'Veio da peça voltou ao sentido original');
}

function setSelectedPieceDoNotProduce(enabled){
  if(!state.selected){toast('Selecione uma peça');return;}
  const u=state.selected.userData||{};
  if(u.kind==='cylinder'||u.kind==='hardware-visual')return;
  u.excludeFromCutList=!!enabled;
  updateInspector();
  commitHistory();
  toast(u.excludeFromCutList?'Peça marcada como NÃO PRODUZIR · removida do plano de corte':'Peça voltou para produção · será incluída no plano de corte');
}

let duplicatePieceLocked=false;
let duplicatePieceUnlockTimer=null;

function cancelDuplicateConfirmation(){
  const row=$('duplicateConfirmRow');if(row)row.classList.remove('show');
  const btn=$('duplicateBtn');if(btn&&!duplicatePieceLocked)btn.disabled=false;
}
function requestDuplicateSelected(){
  if(!state.selected){toast('Selecione uma peça');return;}
  if(state.selected.userData?.drawerSetId){
    toast('O conjunto de gavetas é paramétrico. Edite ou crie outro conjunto pelo espaço.');
    openDrawerSystemDialog(state.selected);return;
  }
  const row=$('duplicateConfirmRow'),txt=$('duplicateConfirmText');
  if(txt)txt.textContent=`Duplicar “${state.selected.userData?.name||'Peça'}”? Toque em Confirmar duplicação.`;
  row?.classList.add('show');
}
function confirmDuplicateSelected(){
  const row=$('duplicateConfirmRow');row?.classList.remove('show');
  duplicateSelected();
}

function duplicateSelected(){
  if(!state.selected)return;

  if(state.selected.userData?.drawerSetId){
    toast('O conjunto de gavetas é paramétrico. Edite ou crie outro conjunto pelo espaço.');
    openDrawerSystemDialog(state.selected);
    return;
  }

  // Proteção para Android/touch: um acionamento nunca pode criar 2 cópias.
  if(duplicatePieceLocked)return;
  duplicatePieceLocked=true;

  const btn=$('duplicateBtn');
  if(btn)btn.disabled=true;

  const source=state.selected;
  const u=source.userData;
  const yBase=source.position.y-u.height/2;

  const opts={
    width:u.width,depth:u.depth,height:u.height,
    x:source.position.x+.03,yBase,z:source.position.z+.03,
    name:(u.name||'Peça')+' cópia',
    kind:u.kind,materialType:u.materialType,baseColor:u.baseColor,
    materialId:u.materialId||null,materialCode:u.materialCode||'',
    materialGrain:!!u.materialGrain,materialGrainRotation:normalizePieceGrainRotation(u.materialGrainRotation),materialCoreColor:u.materialCoreColor||null,
    edgeBands:productionClone(u.edgeBands||{}),
    labelMeta:{...(u.labelMeta||{}),schemaVersion:1},
    spaceRootId:u.spaceRootId||null,
    machining:JSON.parse(JSON.stringify(u.machining||[])),
    forms:JSON.parse(JSON.stringify(u.forms||[])),
    rotationX:Number(source.rotation.x)||0,
    rotationY:Number(source.rotation.y)||0,
    rotationZ:Number(source.rotation.z)||0,
    excludeFromCutList:!!u.excludeFromCutList,
    spaceCutting:!!u.spaceCutting,
    spaceCutParentBounds:u.spaceCutParentBounds?JSON.parse(JSON.stringify(u.spaceCutParentBounds)):null,
    manualGeometryDelta:u.manualGeometryDelta?JSON.parse(JSON.stringify(u.manualGeometryDelta)):null,
    pieceSavedConfig:u.pieceSavedConfig?JSON.parse(JSON.stringify(u.pieceSavedConfig)):null
  };

  let copy=null;
  try{
    // Todos os criadores recebem doHistory=false. No fim fazemos um único commit.
    if(u.kind==='cylinder'){
      copy=createCylinder({
        diameter:u.width,height:u.height,x:opts.x,yBase,z:opts.z,name:opts.name
      },false);
    }else if(u.kind==='curved-panel'&&u.customProfile?.cfg){
      copy=createCurvedRib({
        cfg:u.customProfile.cfg,yBase,
        x:(Number.isFinite(u.curvedTargetX)?u.curvedTargetX:source.position.x)+.03,
        z:(Number.isFinite(u.curvedTargetZ)?u.curvedTargetZ:source.position.z)+.03,
        name:opts.name,spaceRootId:u.spaceRootId||null,
        part:u.customProfile.part||u.curvedPart||'full'
      },false);
    }else if(u.curvedRole==='cover'&&u.curvedConfig){
      copy=createCurvedCover({
        cfg:u.curvedConfig,yBase,x:opts.x,z:opts.z,name:opts.name,
        spaceRootId:u.spaceRootId||null,
        part:u.curvedPart||u.curvedConfig.coverPart||'full'
      },false);
    }else if(u.curvedRole==='post'&&u.curvedConfig){
      copy=createCurvedPost({
        cfg:u.curvedConfig,yBase,x:opts.x,z:opts.z,name:opts.name,
        spaceRootId:u.spaceRootId||null,
        rotationY:Number(source.rotation.y)||0
      },false);
    }else{
      copy=createBox(opts,false);
    }

    if(copy){
      copy.userData.excludeFromCutList=!!u.excludeFromCutList;
      copy.userData.spaceCutting=!!u.spaceCutting;
      commitHistory();
      openPieceInspector(copy);
      toast('1 cópia criada');
    }
  }finally{
    clearTimeout(duplicatePieceUnlockTimer);
    duplicatePieceUnlockTimer=setTimeout(()=>{
      duplicatePieceLocked=false;
      if(btn)btn.disabled=false;
    },700);
  }
}

function deleteSelectedFromInspector(){
  if(!state.selected){
    toast('Selecione uma peça');
    return;
  }

  // Gaveta paramétrica usa a confirmação própria da rotina existente.
  if(state.selected.userData?.drawerSetId){
    deleteSelected();
    return;
  }

  const name=state.selected.userData?.name||'Peça';
  if(!window.confirm(`Apagar a peça “${name}”?\n\nO espaço será recalculado quando necessário.`))return;

  deleteSelected();
  $('inspector').classList.add('compact');
  $('inspector').style.display='none';
}

  return { normalizePieceManualGeometryDelta, pieceGeometrySnapshot, accumulatePieceManualGeometryDelta, normalizePieceSavedConfig, loadPieceRelativeInputs, pieceParametricBaseFromRecord, pieceMappedGeometryWithManualDelta, pieceRelativeNumber, resetPieceRelativeInputs, pieceRelativeEditable, pieceLocalAxisVector, syncPieceRotationMetadata, applyPieceRelativeConfig, resetPieceRelativeConfig, setDimensions, applyExactPanel, rotateBox, rotateSelectedPieceGrain, setSelectedPieceDoNotProduce, cancelDuplicateConfirmation, requestDuplicateSelected, confirmDuplicateSelected, duplicateSelected, deleteSelectedFromInspector };
}
