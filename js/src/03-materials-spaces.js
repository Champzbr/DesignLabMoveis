// ============================================================================
// 1.100.16 · PRODUÇÃO: MATERIAIS, FITAS E BASE PARA ETIQUETAS
// ============================================================================
const PRODUCTION_SCHEMA_VERSION=1;

function defaultProjectProduction(){
  return {
    version:PRODUCTION_SCHEMA_VERSION,
    materials:[
      {id:'mat-mdf-branco-18',name:'MDF Branco 18 mm',code:'MDF-BR18',thickness:18,color:'#e7e1d4',coreColor:'#c6a77b',grain:false},
      {id:'mat-mdf-madeirado-18',name:'MDF Madeirado 18 mm',code:'MDF-MAD18',thickness:18,color:'#b88955',coreColor:'#b99665',grain:true},
      {id:'mat-mdf-branco-6',name:'MDF Branco 6 mm',code:'MDF-BR6',thickness:6,color:'#efede7',coreColor:'#c6a77b',grain:false}
    ],
    edgeBands:[
      {id:'band-branca-045',name:'Fita branca 0,45 mm',code:'FB-045',thickness:.45,width:22,color:'#f5f5f2'},
      {id:'band-madeirada-045',name:'Fita madeirada 0,45 mm',code:'FM-045',thickness:.45,width:22,color:'#b88955'},
      {id:'band-preta-045',name:'Fita preta 0,45 mm',code:'FP-045',thickness:.45,width:22,color:'#202020'}
    ],
    labelTemplate:{
      version:1,
      configurableLater:true,
      availableFields:[
        'project','client','environment','space','partId','partName','dimensions',
        'material','materialCode','grain','edgeBands','machining'
      ]
    }
  };
}
let projectProduction=defaultProjectProduction();

function productionClone(v){return JSON.parse(JSON.stringify(v));}
function productionColor(v,fallback='#d8c5a4'){
  const s=String(v||'').trim();
  return /^#[0-9a-f]{6}$/i.test(s)?s:fallback;
}
function productionColorInt(v,fallback=COLORS.panel){
  const s=productionColor(v,'');
  return s?parseInt(s.slice(1),16):fallback;
}
function normalizeProductionMaterial(m){
  if(!m)return null;
  const thickness=Number(m.thickness);
  return {
    id:String(m.id||uid('mat')),
    name:String(m.name||'Material').trim()||'Material',
    code:String(m.code||'').trim(),
    thickness:Number.isFinite(thickness)&&thickness>0?thickness:18,
    color:productionColor(m.color,'#d8c5a4'),
    coreColor:productionColor(m.coreColor,'#c6a77b'),
    grain:!!m.grain
  };
}
function normalizeProductionBand(b){
  if(!b)return null;
  const thickness=Number(b.thickness),width=Number(b.width);
  return {
    id:String(b.id||uid('band')),
    name:String(b.name||'Fita de borda').trim()||'Fita de borda',
    code:String(b.code||'').trim(),
    thickness:Number.isFinite(thickness)&&thickness>0?thickness:.45,
    width:Number.isFinite(width)&&width>0?width:22,
    color:productionColor(b.color,'#f5f5f2')
  };
}
function setProjectProductionState(raw){
  if(!raw){
    projectProduction=defaultProjectProduction();
    return;
  }
  projectProduction={
    version:PRODUCTION_SCHEMA_VERSION,
    materials:Array.isArray(raw.materials)?raw.materials.map(normalizeProductionMaterial).filter(Boolean):[],
    edgeBands:Array.isArray(raw.edgeBands)?raw.edgeBands.map(normalizeProductionBand).filter(Boolean):[],
    labelTemplate:raw.labelTemplate?productionClone(raw.labelTemplate):defaultProjectProduction().labelTemplate
  };
}
function mergeProjectProductionState(raw){
  if(!raw)return;
  const mats=Array.isArray(raw.materials)?raw.materials.map(normalizeProductionMaterial).filter(Boolean):[];
  const bands=Array.isArray(raw.edgeBands)?raw.edgeBands.map(normalizeProductionBand).filter(Boolean):[];
  for(const m of mats){
    if(!projectProduction.materials.some(x=>x.id===m.id))projectProduction.materials.push(m);
  }
  for(const b of bands){
    if(!projectProduction.edgeBands.some(x=>x.id===b.id))projectProduction.edgeBands.push(b);
  }
}
function captureProductionState(){return productionClone(projectProduction);}
function productionMaterialById(id){return projectProduction.materials.find(x=>x.id===id)||null;}
function productionBandById(id){return projectProduction.edgeBands.find(x=>x.id===id)||null;}
function productionBandSnapshot(id){
  const b=productionBandById(id);
  return b?productionClone(b):null;
}
function normalizePieceEdgeBands(v){
  const out={};
  for(const key of ['uMin','uMax','vMin','vMax']){
    const rec=v?.[key];
    if(!rec)continue;
    if(typeof rec==='string'){
      const b=productionBandSnapshot(rec);
      if(b)out[key]=b;
    }else{
      const b=normalizeProductionBand(rec);
      if(b)out[key]=b;
    }
  }
  return out;
}
function boxFaceMaterialIndex(axis,sign){
  if(axis==='x')return sign>0?0:1;
  if(axis==='y')return sign>0?2:3;
  return sign>0?4:5;
}
function pieceEdgeFaceDefinitions(o){
  const ti=pieceThicknessInfo(o);if(!ti)return {};
  return {
    uMin:{axis:ti.uAxis,sign:-1},
    uMax:{axis:ti.uAxis,sign:1},
    vMin:{axis:ti.vAxis,sign:-1},
    vMax:{axis:ti.vAxis,sign:1}
  };
}
function pieceEdgeDisplayDefinitions(o){
  const ti=pieceThicknessInfo(o);if(!ti)return {};
  if(ti.thicknessAxis==='z'){
    return {
      uMin:{label:'Esquerda',axis:`−${axisLabel(ti.uAxis)}`},
      uMax:{label:'Direita',axis:`+${axisLabel(ti.uAxis)}`},
      vMin:{label:'Baixo',axis:`−${axisLabel(ti.vAxis)}`},
      vMax:{label:'Cima',axis:`+${axisLabel(ti.vAxis)}`}
    };
  }
  if(ti.thicknessAxis==='y'){
    return {
      uMin:{label:'Esquerda',axis:`−${axisLabel(ti.uAxis)}`},
      uMax:{label:'Direita',axis:`+${axisLabel(ti.uAxis)}`},
      vMin:{label:'Trás',axis:`−${axisLabel(ti.vAxis)}`},
      vMax:{label:'Frente',axis:`+${axisLabel(ti.vAxis)}`}
    };
  }
  return {
    uMin:{label:'Trás',axis:`−${axisLabel(ti.uAxis)}`},
    uMax:{label:'Frente',axis:`+${axisLabel(ti.uAxis)}`},
    vMin:{label:'Baixo',axis:`−${axisLabel(ti.vAxis)}`},
    vMax:{label:'Cima',axis:`+${axisLabel(ti.vAxis)}`}
  };
}
function applyPieceProductionEdgeColors(mesh){
  if(!mesh||mesh.userData?.kind==='cylinder')return;
  const mats=mesh.userData?.faceMaterials||[];
  if(mats.length<6)return;
  const defs=pieceEdgeFaceDefinitions(mesh);
  const material=productionMaterialById(mesh.userData?.materialId);
  const coreColor=mesh.userData?.materialCoreColor||material?.coreColor||null;

  // Quando há material de produção aplicado, a borda sem fita mostra o miolo.
  if(coreColor){
    for(const key of ['uMin','uMax','vMin','vMax']){
      const d=defs[key];if(!d)continue;
      mats[boxFaceMaterialIndex(d.axis,d.sign)]?.color?.set(productionColorInt(coreColor));
    }
  }

  // A fita substitui visualmente o miolo somente no lado escolhido.
  const bands=normalizePieceEdgeBands(mesh.userData?.edgeBands||{});
  mesh.userData.edgeBands=bands;
  for(const key of ['uMin','uMax','vMin','vMax']){
    const b=bands[key],d=defs[key];if(!b||!d)continue;
    mats[boxFaceMaterialIndex(d.axis,d.sign)]?.color?.set(productionColorInt(b.color,0xffffff));
  }
}
function pieceEdgeBandSignature(o){
  const bands=normalizePieceEdgeBands(o?.userData?.edgeBands||{});
  return ['uMin','uMax','vMin','vMax'].map(k=>bands[k]?.id||bands[k]?.name||'').join('|');
}
function pieceEdgeBandSummary(o){
  if(!o)return '';
  const defs=pieceEdgeDisplayDefinitions(o),bands=normalizePieceEdgeBands(o.userData?.edgeBands||{});
  const parts=[];
  for(const key of ['uMin','uMax','vMin','vMax']){
    if(!bands[key])continue;
    parts.push(`${defs[key]?.label||key}: ${bands[key].code||bands[key].name}`);
  }
  return parts.join(' · ');
}

// ============================================================================
// 1.100.19 · MATERIAL PADRÃO POR ESPAÇO
// ============================================================================
function spaceDefaultMaterial(rootOrId){
  const root=typeof rootOrId==='string'?getSpaceRoot(rootOrId):rootOrId;
  return root?.defaultMaterialId?productionMaterialById(root.defaultMaterialId):null;
}
function productionApplyMaterialRecordToObject(o,m,{keepSelection=true}={}){
  if(!o||!m)return false;
  const u=o.userData||{};
  if(u.kind==='hardware-visual'||u.kind==='cylinder'||u.excludeFromCutList)return false;

  u.materialId=m.id;
  u.materialType=m.name;
  u.materialCode=m.code||'';
  u.materialGrain=!!m.grain;
  u.materialCoreColor=m.coreColor||null;
  u.baseColor=productionColorInt(m.color,COLORS.panel);
  u.labelMeta={...(u.labelMeta||{}),schemaVersion:1,enabled:true};

  // Peças retangulares usam material por face; perfis curvos normalmente
  // possuem um único material. Ambos recebem a cor do cadastro.
  const mats=u.faceMaterials||[];
  for(const mat of mats)mat?.color?.set?.(u.baseColor);
  if(mats.length>=6)applyPieceProductionEdgeColors(o);

  if(keepSelection&&o===selected&&!visualMode)setAllFaces(o,COLORS.selected);
  return true;
}
function applySpaceDefaultMaterialToObject(o,rootOrId,{requireThicknessMatch=true}={}){
  if(!o||o.userData?.materialId)return false;
  const root=typeof rootOrId==='string'?getSpaceRoot(rootOrId):rootOrId;
  const mat=spaceDefaultMaterial(root);
  if(!root||!mat)return false;
  if(o.userData?.kind==='hardware-visual'||o.userData?.kind==='cylinder'||o.userData?.excludeFromCutList)return false;

  if(requireThicknessMatch){
    const ti=pieceThicknessInfo(o);
    if(ti&&Math.abs(Number(ti.thickness)-Number(mat.thickness))>.25)return false;
  }
  return productionApplyMaterialRecordToObject(o,mat,{keepSelection:false});
}
function spaceEligibleProductionPieces(root){
  if(!root)return [];
  return objects.filter(o=>{
    if(o.userData?.kind==='hardware-visual'||o.userData?.kind==='cylinder'||o.userData?.excludeFromCutList)return false;
    return o.userData?.spaceRootId===root.id || objectBelongsToRoot(o,root);
  });
}
function applySpaceMaterialToExistingPieces(root,material){
  if(!root||!material)return {changed:0,skipped:0};
  let changed=0,skipped=0;
  for(const o of spaceEligibleProductionPieces(root)){
    const ti=pieceThicknessInfo(o);
    // Ao aplicar em peças existentes, a espessura geométrica nunca é alterada.
    // Mesmo se houver diferença, o material é aplicado e o usuário pode ver
    // o aviso/lista depois. Isso é uma ação explícita do usuário.
    if(productionApplyMaterialRecordToObject(o,material,{keepSelection:false}))changed++;
    else skipped++;
  }
  if(selected&&spaceEligibleProductionPieces(root).includes(selected)&&!visualMode)setAllFaces(selected,COLORS.selected);
  return {changed,skipped};
}
function spaceMaterialText(rootOrId){
  const m=spaceDefaultMaterial(rootOrId);
  return m?`${m.name}${m.code?` · ${m.code}`:''} · ${nice(m.thickness)} mm${m.grain?' · veio':''}`:'Sem material padrão';
}


function pieceProductionLabelData(o){
  if(!o)return null;
  const u=o.userData||{},ti=pieceThicknessInfo(o),root=rootForObject(o);
  return {
    schemaVersion:1,
    partId:u.partId||'',
    project:typeof currentProjectRecord!=='undefined'?(currentProjectRecord?.name||''):'',
    client:typeof currentProjectRecord!=='undefined'?(currentProjectRecord?.client||''):'',
    environment:typeof currentProjectRecord!=='undefined'?(currentProjectRecord?.environment||''):'',
    space:root?.name||'',
    partName:u.name||'Peça',
    material:u.materialType||'MDF',
    materialCode:u.materialCode||'',
    grain:!!u.materialGrain,
    thickness:ti?.thickness||0,
    faceW:ti?.faceW||0,
    faceH:ti?.faceH||0,
    edgeBands:productionClone(u.edgeBands||{}),
    edgeBandSummary:pieceEdgeBandSummary(o),
    machiningCount:(u.machining||[]).length
  };
}


function makeMaterials(baseColor, count=6){
  return Array.from({length:count},()=>new THREE.MeshStandardMaterial({ color:baseColor, roughness:.72, metalness:0 }));
}
function setAllFaces(mesh, color){
  const mats = mesh.userData.faceMaterials || [];
  mats.forEach(mat=>mat.color.set(color));
  // Mesmo selecionada, a peça continua mostrando quais bordas têm fita.
  applyPieceProductionEdgeColors(mesh);
}
function restoreBaseColor(mesh){ setAllFaces(mesh, mesh.userData.baseColor ?? COLORS.default); }


function uid(prefix='id'){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }
function getSpaceRoot(id){ return spaceRoots.find(r=>r.id===id) || null; }
function getSpaceCell(rootId,cellId){ const r=getSpaceRoot(rootId); return r?.cells.find(c=>c.id===cellId) || null; }
function cellSize(c){ return {width:c.maxX-c.minX, depth:c.maxZ-c.minZ, height:c.maxY-c.minY}; }
function cellCenter(c){ return new THREE.Vector3((c.minX+c.maxX)/2,(c.minY+c.maxY)/2,(c.minZ+c.maxZ)/2); }
function disposeSpaceMeshes(){
  // Limpa TODOS os grupos de espaço que ainda estiverem na cena, inclusive
  // grupos órfãos de um espaço que já foi removido de spaceRoots.
  const groups = scene.children.filter(o=>o?.userData?.isSpaceRoot);
  for(const group of groups){
    group.traverse(o=>{
      if(o.isMesh || o.isLineSegments || o.isLine){
        o.geometry?.dispose?.();
        if(Array.isArray(o.material)) o.material.forEach(m=>m?.dispose?.());
        else o.material?.dispose?.();
      }
    });
    scene.remove(group);
  }
  for(const root of spaceRoots) root.group=null;
  spacePickMeshes.length=0;
}
function updateSpaceSelectionVisuals(){
  for(const mesh of spacePickMeshes){
    const active=!!selectedSpaceCell && mesh.userData.spaceRootId===selectedSpaceCell.rootId && mesh.userData.spaceCellId===selectedSpaceCell.cellId;

    // 1.100.30:
    // - o espaço INATIVO continua claramente reconhecível;
    // - o selecionado fica mais forte;
    // - DoubleSide facilita enxergar o volume aberto de qualquer ângulo;
    // - depthTest continua ligado, então nada atravessa MDF quando o Raio-X está desligado.
    mesh.material.opacity=active ? .30 : .065;
    mesh.material.side=THREE.DoubleSide;
    mesh.material.depthTest=true;
    mesh.material.depthWrite=false;
    mesh.material.needsUpdate=true;
    mesh.renderOrder=active?18:8;

    const edge=mesh.userData.spaceEdges;
    if(edge){
      const cell=getSpaceCell(mesh.userData.spaceRootId,mesh.userData.spaceCellId);
      const isFixed=!!(cell?.fixedAxes && (cell.fixedAxes.x||cell.fixedAxes.y||cell.fixedAxes.z));

      // Contorno do espaço selecionado é forte, mas só onde estiver realmente
      // visível para a câmera. Nada de linhas verdes atravessando as chapas.
      edge.material.color.set(active?0x16a34a:(isFixed?0xffc107:0x4f8995));
      edge.material.opacity=active?1:.48;
      edge.material.depthTest=true;
      edge.material.depthWrite=false;
      edge.material.needsUpdate=true;
      edge.renderOrder=active?19:7;
    }
  }
}
function renderSpaces(){
  disposeSpaceMeshes();
  for(const root of spaceRoots){
    const group=new THREE.Group(); group.userData.isSpaceRoot=true; root.group=group; scene.add(group);

    // 1.100.79: o espaço criado originalmente continua sendo o espaço PRINCIPAL.
    // Os cortes são apenas subdivisões independentes dentro dele. O contorno
    // principal fica como referência e não participa da seleção.
    const rootOutlineMat=new THREE.LineBasicMaterial({
      color:0x6b8790, transparent:true, opacity:.22, depthTest:true, depthWrite:false
    });
    const rootOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),rootOutlineMat);
    rootOutline.scale.set(root.width,root.height,root.depth);
    rootOutline.position.set(root.x,root.yBase+root.height/2,root.z);
    rootOutline.renderOrder=5;
    rootOutline.userData={kind:'space-root-outline',spaceRootId:root.id};
    group.add(rootOutline);

    for(const c of root.cells){
      // v34: cada divisão pode ser ocultada individualmente.
      // A divisão oculta deixa de ser desenhada e também deixa de participar
      // da seleção/snap, mas as outras divisões do mesmo espaço continuam visíveis.
      if(c.hidden) continue;
      const sz=cellSize(c), ctr=cellCenter(c);
      const mat=new THREE.MeshBasicMaterial({
        color:COLORS.space,
        transparent:true,
        opacity:.065,
        side:THREE.DoubleSide,
        depthWrite:false,
        depthTest:true
      });
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
      mesh.scale.set(sz.width,sz.height,sz.depth); mesh.position.copy(ctr);
      mesh.userData={kind:'space-cell',name:root.name,width:sz.width,depth:sz.depth,height:sz.height,baseColor:COLORS.space,faceMaterials:[mat],spaceRootId:root.id,spaceCellId:c.id};
      const isFixed=!!(c.fixedAxes && (c.fixedAxes.x||c.fixedAxes.y||c.fixedAxes.z));
      const edgeMat=new THREE.LineBasicMaterial({
        color:isFixed?0xffc107:0x4f8995,
        transparent:true,
        opacity:.48,
        depthTest:true,
        depthWrite:false
      });
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),edgeMat);
      edges.scale.copy(mesh.scale); edges.position.copy(mesh.position); edges.renderOrder=7;
      mesh.userData.spaceEdges=edges; mesh.renderOrder=8;
      group.add(mesh,edges); spacePickMeshes.push(mesh);
    }
  }
  updateSpaceSelectionVisuals();
  if(visualMode)applyVisualSceneState();
}
function referenceMeshes(exclude=null){ return [...objects,...spacePickMeshes].filter(o=>o!==exclude && o.visible!==false); }
function isDoorObject(o){
  return !!o && (/^Porta\s/i.test(String(o.userData?.name||'')) || o.userData?.drawerRole==='drawer-front');
}
function doorObjectsForRoot(rootId){
  return objects.filter(o=>o.userData?.spaceRootId===rootId && isDoorObject(o));
}
function applyDoorVisibility(root){
  if(!root) return;
  const visible=!root.doorsHidden;
  for(const o of doorObjectsForRoot(root.id)){
    o.visible=visible;
    o.userData.hiddenByDoors=!visible;
  }
  if(selected && selected.userData?.spaceRootId===root.id && isDoorObject(selected) && !visible){
    restoreBaseColor(selected); selected=null; $('inspector').style.display='none';
  }
}
function applyAllDoorVisibility(){ for(const root of spaceRoots) applyDoorVisibility(root); }
function updateDoorsToggleButton(root=null){
  const btn=$('toggleDoorsBtn'); if(!btn) return;
  root=root || (selectedSpaceCell ? getSpaceRoot(selectedSpaceCell.rootId) : null);
  btn.textContent=(root && root.doorsHidden) ? 'Mostrar portas' : 'Ocultar portas';
}
function toggleDoorsForActiveSpace(){
  const root=selectedSpaceCell ? getSpaceRoot(selectedSpaceCell.rootId) : (activeSpaceRootId ? getSpaceRoot(activeSpaceRootId) : null);
  if(!root){ toast('Selecione um espaço'); return; }
  const doors=doorObjectsForRoot(root.id);
  if(!doors.length){ toast('Este espaço ainda não tem portas'); return; }
  root.doorsHidden=!root.doorsHidden;
  applyDoorVisibility(root); updateDoorsToggleButton(root); commitHistory();
  toast(root.doorsHidden ? 'Portas ocultadas' : 'Portas exibidas');
}
function updateSpaceVisibilityToggleButton(){
  const btn=$('toggleSpaceBtn');
  if(btn)btn.textContent='Ocultar divisão';
  const direct=$('hideSelectedSpaceBtn');
  if(direct)direct.textContent='◫ Ocultar selecionado';
}
function largestVisibleCell(root){
  if(!root) return null;
  let best=null, bestVol=-1;
  for(const c of root.cells){
    if(c.hidden) continue;
    const sz=cellSize(c), vol=sz.width*sz.depth*sz.height;
    if(vol>bestVol){ bestVol=vol; best=c; }
  }
  return best;
}
function spaceCellLabel(root,cell){
  const cells=root?.cells||[];
  const idx=Math.max(0,cells.findIndex(c=>c.id===cell?.id));
  return cells.length<=1?'principal':`corte ${idx+1} de ${cells.length}`;
}
function nearestVisibleCell(root,sourceCell){
  const visible=(root?.cells||[]).filter(c=>!c.hidden && c.id!==sourceCell?.id);
  if(!visible.length)return null;
  const sc=cellCenter(sourceCell);
  // Primeiro favorece um corte que ocupe a mesma região frontal (X/Y),
  // útil para ocultar uma faixa de porta e cair direto no vão atrás dela.
  let best=null,bestScore=Infinity;
  for(const c of visible){
    const cc=cellCenter(c);
    const overlapX=Math.max(0,Math.min(sourceCell.maxX,c.maxX)-Math.max(sourceCell.minX,c.minX));
    const overlapY=Math.max(0,Math.min(sourceCell.maxY,c.maxY)-Math.max(sourceCell.minY,c.minY));
    const sameFace=overlapX>1e-6 && overlapY>1e-6;
    const dx=cc.x-sc.x,dy=cc.y-sc.y,dz=cc.z-sc.z;
    const dist=dx*dx+dy*dy+dz*dz;
    const score=dist+(sameFace?0:1000);
    if(score<bestScore){bestScore=score;best=c;}
  }
  return best||visible[0];
}
function toggleActiveSpaceVisibility(){
  if(!selectedSpaceCell){ toast('Selecione a divisão que deseja ocultar'); return; }
  const root=getSpaceRoot(selectedSpaceCell.rootId);
  const cell=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId);
  if(!root || !cell){ toast('Divisão não encontrada'); return; }

  // Oculta somente a divisão clicada. As peças ligadas ao espaço permanecem visíveis.
  cell.hidden=true;
  const rootId=root.id;
  renderSpaces();

  // Depois de esconder o corte atual, tenta selecionar o corte mais próximo.
  // Em cortes de frente/trás isso normalmente leva direto ao espaço de dentro.
  const next=nearestVisibleCell(root,cell);
  if(next) selectSpaceCellByIds(rootId,next.id);
  else selectSpaceRootOnly(root);

  commitHistory();
  toast('Corte ocultado · espaço principal mantido');
}
function showAllHiddenSpaces(){
  let count=0;
  for(const root of spaceRoots){
    // Compatibilidade com projetos v32/v33 que ocultavam o espaço inteiro.
    if(root.spaceHidden){ root.spaceHidden=false; }
    for(const c of root.cells){
      if(c.hidden){ c.hidden=false; count++; }
    }
  }
  if(!count){ toast('Não há divisões ocultas'); return; }
  renderSpaces();
  updateSpaceVisibilityToggleButton();
  commitHistory();
  toast(count===1 ? 'Divisão oculta exibida' : `${count} divisões ocultas exibidas`);
}
function setSpaceActionCellMode(hasCell){
  for(const id of ['cutSpaceBtn','createPiecesBtn','openLibraryBtn','hideSelectedSpaceBtn','deleteSelectedSpaceBtn']){
    const b=$(id);if(b)b.disabled=!hasCell;
  }
}
function selectSpaceRootOnly(root,{showMenu}={}){
  if(!root){ clearSpaceSelection(); return; }
  const panel=$('spaceActions');
  const wasOpen=panel?.style.display==='block';
  if(selected){ restoreBaseColor(selected); selected=null; }
  lastEdit=null; liveLabel.style.display='none'; hideGuides(); $('inspector').style.display='none';
  selectedSpaceCell=null; activeSpaceRootId=root.id; updateSpaceSelectionVisuals();
  $('spaceActionTitle').textContent=root.name+' · principal';
  $('spaceActionDims').innerHTML=`L ${mm(root.width)} · P ${mm(root.depth)} · A ${mm(root.height)} mm<br><span style="color:var(--muted)">Espaço principal · selecione um corte para editar/ocultar</span>`;
  if(panel)panel.style.display=(showMenu===undefined?wasOpen:!!showMenu)?'block':'none';
  setSpaceActionCellMode(false); updateDoorsToggleButton(root); updateSpaceVisibilityToggleButton(root); updateMeasureBadge();
}
function distanceSqPointToCell(point,c){
  const dx=point.x<c.minX?c.minX-point.x:point.x>c.maxX?point.x-c.maxX:0;
  const dy=point.y<c.minY?c.minY-point.y:point.y>c.maxY?point.y-c.maxY:0;
  const dz=point.z<c.minZ?c.minZ-point.z:point.z>c.maxZ?point.z-c.maxZ:0;
  return dx*dx+dy*dy+dz*dz;
}
function bestVisibleCellForObject(root,obj=null){
  const cells=(root?.cells||[]).filter(c=>!c.hidden);
  if(!cells.length)return null;
  if(!obj)return largestVisibleCell(root);
  const p=obj.position.clone();
  return cells.reduce((best,c)=>distanceSqPointToCell(p,c)<distanceSqPointToCell(p,best)?c:best,cells[0]);
}
function rootForObject(obj){
  if(!obj)return null;
  const rootId=obj.userData?.spaceRootId;
  if(rootId){ const r=getSpaceRoot(rootId); if(r)return r; }
  return spaceRoots.find(r=>objectBelongsToRoot(obj,r))||null;
}
function openSpaceFromObject(obj=null){
  obj=obj||selected;
  const root=rootForObject(obj)||selectedFurnitureRoot();
  if(!root){ toast('Selecione uma peça que pertença a um móvel'); return false; }
  const cell=bestVisibleCellForObject(root,obj);
  if(cell) selectSpaceCellByIds(root.id,cell.id,{showMenu:true});
  else selectSpaceRootOnly(root,{showMenu:true});
  $('morePanel').style.display='none';
  toast(cell ? `Espaço aberto · ${root.name}` : `Móvel aberto · ${root.name}`);
  return true;
}
function activeSpaceRoot(){
  if(selectedSpaceCell){ const r=getSpaceRoot(selectedSpaceCell.rootId); if(r)return r; }
  if(activeSpaceRootId){ const r=getSpaceRoot(activeSpaceRootId); if(r)return r; }
  return selectedFurnitureRoot();
}

function clearSpaceSelection(){ selectedSpaceCell=null; activeSpaceRootId=null; $('spaceActions').style.display='none'; setSpaceActionCellMode(true); updateDoorsToggleButton(null); updateSpaceVisibilityToggleButton(null); updateSpaceSelectionVisuals(); }
function selectSpaceCellByIds(rootId,cellId,{showMenu}={}){
  const panel=$('spaceActions');
  const wasOpen=panel?.style.display==='block';
  if(selected){ restoreBaseColor(selected); selected=null; }
  lastEdit=null; liveLabel.style.display='none'; hideGuides(); $('inspector').style.display='none';
  const root=getSpaceRoot(rootId), cell=getSpaceCell(rootId,cellId); if(!root||!cell){clearSpaceSelection();updateMeasureBadge();return;}
  selectedSpaceCell={rootId,cellId}; activeSpaceRootId=rootId; updateSpaceSelectionVisuals();
  const sz=cellSize(cell); const cutLabel=spaceCellLabel(root,cell); $('spaceActionTitle').textContent=root.name+' · '+cutLabel;
  const fixed=[]; if(cell.fixedAxes?.x)fixed.push(`X ${mm(sz.width)} mm`); if(cell.fixedAxes?.y)fixed.push(`Y ${mm(sz.height)} mm`); if(cell.fixedAxes?.z)fixed.push(`Z ${mm(sz.depth)} mm`);
  $('spaceActionDims').innerHTML=`L ${mm(sz.width)} · P ${mm(sz.depth)} · A ${mm(sz.height)} mm${root.cells.length>1?`<br><span style="color:var(--muted)">Corte individual do espaço principal</span>`:''}${fixed.length?`<br><span class="fixedBadge">🔒 Fixo: ${fixed.join(' · ')}</span>`:''}<br><span style="color:#9fd6ac">🧱 ${escapeHtml(spaceMaterialText(root))}</span>`;
  if(panel)panel.style.display=(showMenu===undefined?wasOpen:!!showMenu)?'block':'none';
  setSpaceActionCellMode(true); updateDoorsToggleButton(root); updateSpaceVisibilityToggleButton(root); updateMeasureBadge();
}
function createSpace({width=1,depth=.6,height=.9,x=0,yBase=0,z=0,name='Espaço',defaultMaterialId=null}={},doHistory=true){
  width=clampSize(width); depth=clampSize(depth); height=clampSize(height);
  // O chão do projeto é Y=0. Espaços de mobiliário nunca nascem abaixo dele.
  yBase=Math.max(0,Number(yBase)||0);
  const root={id:uid('space'),name,width,depth,height,x,yBase,z,defaultMaterialId:defaultMaterialId||null,doorsHidden:false,spaceHidden:false,fixedBands:{x:[],y:[],z:[]},cells:[{id:uid('cell'),hidden:false,fixedAxes:{},minX:x-width/2,maxX:x+width/2,minY:yBase,maxY:yBase+height,minZ:z-depth/2,maxZ:z+depth/2}]};
  spaceRoots.push(root); renderSpaces();
  // 1.100.79: criar o espaço principal apenas o seleciona. O menu nunca abre
  // automaticamente; toque e segure o espaço para abrir as opções.
  selectSpaceCellByIds(root.id,root.cells[0].id,{showMenu:false});
  resetSpaceDoubleTap();
  frontViewToSpace(root);
  if(doHistory) commitHistory(); return root;
}
function createSpaceFromState(data){
  const legacyWholeHidden=!!data.spaceHidden;
  const root={id:data.id||uid('space'),name:data.name||'Espaço',width:data.width,depth:data.depth,height:data.height,x:data.x||0,yBase:data.yBase||0,z:data.z||0,defaultMaterialId:data.defaultMaterialId||null,doorsHidden:!!data.doorsHidden,spaceHidden:false,fixedBands:{x:(data.fixedBands?.x||[]).map(v=>[...v]),y:(data.fixedBands?.y||[]).map(v=>[...v]),z:(data.fixedBands?.z||[]).map(v=>[...v])},cells:(data.cells||[]).map(c=>({...c,id:c.id||uid('cell'),hidden:!!c.hidden||legacyWholeHidden,fixedAxes:{...(c.fixedAxes||{})}}))};
  if(!root.cells.length) root.cells=[{id:uid('cell'),hidden:legacyWholeHidden,fixedAxes:{},minX:root.x-root.width/2,maxX:root.x+root.width/2,minY:root.yBase,maxY:root.yBase+root.height,minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2}];
  spaceRoots.push(root); return root;
}
function viewSpace(root=null,view='front'){
  restoreTechnical2DTransparency();
  if(visualMode)setVisualMode(false,{notify:false,frame:false});
  let center=new THREE.Vector3(0,.8,0), w=2.2, h=1.6, depth=2.2;
  if(root){
    center.set(root.x,root.yBase+root.height/2,root.z);
    if(view==='left'||view==='right'){w=root.depth;h=root.height;depth=root.width;}
    else if(view==='top'||view==='bottom'){w=root.width;h=root.depth;depth=root.height;}
    else {w=root.width;h=root.height;depth=root.depth;}
  }
  if(camera===perspectiveCamera&&!viewMode2D)remember3DView();
  orthographicFrustum(w,h);
  const dist=Math.max(5,depth*4,Math.max(w,h)*3);
  orthoCamera.up.set(0,1,0);
  if(view==='back') orthoCamera.position.set(center.x,center.y,center.z-dist);
  else if(view==='left') orthoCamera.position.set(center.x-dist,center.y,center.z);
  else if(view==='right') orthoCamera.position.set(center.x+dist,center.y,center.z);
  else if(view==='top'){ orthoCamera.up.set(0,0,-1); orthoCamera.position.set(center.x,center.y+dist,center.z); }
  else if(view==='bottom'){ orthoCamera.up.set(0,0,1); orthoCamera.position.set(center.x,center.y-dist,center.z); }
  else orthoCamera.position.set(center.x,center.y,center.z+dist);
  controls.target.copy(center);
  orthoCamera.lookAt(center);
  viewMode2D=true; current2DView=view;
  useCamera(orthoCamera);
  setViewModeBadge(view);
  applyTechnical2DTransparency(root,view);
  const names={front:'frontal',back:'traseira',left:'lateral esquerda',right:'lateral direita',top:'superior',bottom:'inferior'};
  toast(`Vista ${names[view]||'2D'} · X-Ray interno`);
}
function perspectiveFrontToSpace(root=null){
  returnTo3D({restore:false,notify:false});
  let center=new THREE.Vector3(0,.8,0), span=2.2;
  if(root){center.set(root.x,root.yBase+root.height/2,root.z);span=Math.max(root.width,root.height,root.depth);}
  const dist=Math.max(2.4,span*2.15);
  perspectiveCamera.up.set(0,1,0);
  perspectiveCamera.position.set(center.x+dist*.55,center.y+dist*.45,center.z+dist);
  controls.target.copy(center); perspectiveCamera.lookAt(center); controls.update(); remember3DView();
}
function frontViewToSpace(root=null){ perspectiveFrontToSpace(root); }
function setFrontWorldView(){
  returnTo3D({restore:false,notify:false});
  perspectiveCamera.up.set(0,1,0);
  perspectiveCamera.position.set(3.4,2.8,4.8);
  controls.target.set(0,.8,0); perspectiveCamera.lookAt(controls.target); controls.update(); remember3DView();
}

function cutSelectedSpace(side,amountM,isFixed=false){
  // 1.100.79: cortar nunca cria outro móvel principal. O root continua sendo
  // o espaço original; apenas a célula selecionada vira dois cortes irmãos.
  if(!selectedSpaceCell) return false;
  const root=getSpaceRoot(selectedSpaceCell.rootId), cell=getSpaceCell(selectedSpaceCell.rootId,selectedSpaceCell.cellId); if(!root||!cell)return false;
  const sz=cellSize(cell);
  const limit=(side==='left'||side==='right') ? sz.width
             : (side==='front'||side==='back') ? sz.depth
             : sz.height;

  // v85: medida 0 significa "dividir exatamente no meio".
  // Vale para TODOS os lados: esquerda, direita, cima, baixo, frente e trás.
  if(Number.isFinite(amountM) && Math.abs(amountM)<.0000001) amountM=limit/2;

  if(!Number.isFinite(amountM)||amountM<.001||amountM>limit-.001){
    toast(`Use 0 para dividir ao meio ou uma medida entre 1 e ${Math.max(1,mm(limit)-1)} mm`);
    return false;
  }
  const a={...cell,id:uid('cell')}, b={...cell,id:uid('cell')}; let cutCell=a;
  if(side==='left'){ const p=cell.minX+amountM; a.maxX=p; b.minX=p; cutCell=a; }
  if(side==='right'){ const p=cell.maxX-amountM; a.minX=p; b.maxX=p; cutCell=a; }
  if(side==='bottom'){ const p=cell.minY+amountM; a.maxY=p; b.minY=p; cutCell=a; }
  if(side==='top'){ const p=cell.maxY-amountM; a.minY=p; b.maxY=p; cutCell=a; }
  // Frente = lado mais próximo da câmera na vista frontal (+Z).
  // Trás   = fundo do móvel (-Z).
  if(side==='front'){ const p=cell.maxZ-amountM; a.minZ=p; b.maxZ=p; cutCell=a; }
  if(side==='back'){ const p=cell.minZ+amountM; a.maxZ=p; b.minZ=p; cutCell=a; }
  // Um corte fixo guarda a dimensão daquela faixa no eixo do corte.
  // Ao reutilizar o modelo em outro espaço, os trechos fixos mantêm sua medida
  // e apenas os trechos soltos absorvem o aumento/redução.
  a.fixedAxes={...(a.fixedAxes||{})}; b.fixedAxes={...(b.fixedAxes||{})};
  if(isFixed){
    const axis=(side==='left'||side==='right')?'x':((side==='front'||side==='back')?'z':'y');
    cutCell.fixedAxes={...(cutCell.fixedAxes||{}),[axis]:true};
    root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
    const rb=rootBounds(root);
    const rootMin=axis==='x'?rb.minX:(axis==='y'?rb.minY:rb.minZ);
    const cMin=axis==='x'?cutCell.minX:(axis==='y'?cutCell.minY:cutCell.minZ);
    const cMax=axis==='x'?cutCell.maxX:(axis==='y'?cutCell.maxY:cutCell.maxZ);
    root.fixedBands[axis]=mergeIntervals([...(root.fixedBands[axis]||[]),[cMin-rootMin,cMax-rootMin]]);
  }
  const i=root.cells.findIndex(c=>c.id===cell.id); root.cells.splice(i,1,a,b); renderSpaces(); selectSpaceCellByIds(root.id,cutCell.id); commitHistory(); return true;
}
function rootBounds(root){
  return {minX:root.x-root.width/2,maxX:root.x+root.width/2,minY:root.yBase,maxY:root.yBase+root.height,minZ:root.z-root.depth/2,maxZ:root.z+root.depth/2};
}
function mapPersistentFixedBands(root,axis,mapper,srcMin,dstMin){
  const bands=(root.fixedBands?.[axis]||[]);
  return mergeIntervals(bands.map(([a,b])=>{
    const na=mapper(srcMin+Number(a))-dstMin;
    const nb=mapper(srcMin+Number(b))-dstMin;
    return [Math.min(na,nb),Math.max(na,nb)];
  }));
}
function updateAutoMachiningAfterPieceResize(obj){
  const u=obj?.userData; if(!u||!Array.isArray(u.machining)||!u.machining.length)return;
  const ti=pieceThicknessInfo(obj); if(!ti)return;
  for(const op of u.machining){
    // Medidas de usinagem ficam absolutas em mm. Apenas operações automáticas
    // que dependem do comprimento da peça acompanham o novo tamanho.
    if(op.type==='groove' && op.preset==='back-groove' && op.autoLength){
      if([ti.uAxis,ti.vAxis].includes(op.lengthAxis)) op.length=ti.dims[op.lengthAxis];
      else { op.lengthAxis=[ti.uAxis,ti.vAxis].find(a=>a!=='z')||ti.uAxis; op.length=ti.dims[op.lengthAxis]; }
      op.coordRef=op.coordRef&&typeof op.coordRef==='object'?op.coordRef:{};
      op.coordRef[op.lengthAxis]=0;
      if(Number.isFinite(Number(op.rearOffset))) op.coordRef.z=Number(op.rearOffset);
    }
    if(op.through) op.depth=ti.thickness;
  }
}

// ============================================================================
// 1.100.34 · ESPESSURA FIXA DA DIVISÃO VERTICAL
// ============================================================================
//
// A divisão vertical é uma chapa estrutural. Ao redimensionar o móvel,
// largura/altura/profundidade do módulo podem mudar, mas a ESPESSURA da chapa
// não pode ser escalada junto com o vão.
//
function isVerticalDivisionPiece(obj,root=null){
  if(!obj)return false;
  const u=obj.userData||{};
  if(root&&u.spaceRootId!==root.id)return false;
  return /^Divisão vertical$/i.test(String(u.name||'').trim());
}
function verticalDivisionNominalThicknessM(obj){
  if(!obj)return .018;

  // Projeto novo: se existir um valor nominal salvo no objeto, ele vence.
  const saved=Number(obj.userData?.divisionNominalThicknessM);
  if(Number.isFinite(saved)&&saved>.0001)return saved;

  // Projetos antigos: recupera a espessura nominal pelo material da peça.
  const material=productionMaterialById(obj.userData?.materialId);
  const mt=Number(material?.thickness);
  if(Number.isFinite(mt)&&mt>.1)return m(mt);

  // Último fallback: espessura atual da peça.
  const current=Number(obj.userData?.width);
  return Number.isFinite(current)&&current>.0001?current:.018;
}
function registerVerticalDivisionFixedBand(root,x0,x1){
  if(!root)return;
  const rb=rootBounds(root);
  const a=Math.max(rb.minX,Math.min(rb.maxX,Number(x0)));
  const b=Math.max(rb.minX,Math.min(rb.maxX,Number(x1)));
  if(!(b>a))return;
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands.x=mergeIntervals([
    ...(root.fixedBands.x||[]),
    [a-rb.minX,b-rb.minX]
  ]);
}
function repairVerticalDivisionThickness(root){
  if(!root)return 0;
  const dividers=objects.filter(o=>isVerticalDivisionPiece(o,root));
  if(!dividers.length)return 0;

  let repaired=0;
  for(const obj of dividers){
    const u=obj.userData||{};
    const target=verticalDivisionNominalThicknessM(obj);
    if(!(target>.0001)||target>=root.width)continue;

    const center=Number(obj.position.x);
    if(!Number.isFinite(center))continue;

    const current=Number(u.width)||target;
    const oldMin=center-current/2;
    const oldMax=center+current/2;
    const targetMin=center-target/2;
    const targetMax=center+target/2;

    // Os vãos criados pela divisão têm suas bordas exatamente encostadas
    // na chapa. Reposicionamos essas bordas antes de recalcular o móvel.
    const tol=.002; // 2 mm: tolera ponto flutuante sem capturar outra divisão.
    for(const c of root.cells||[]){
      if(Math.abs(Number(c.maxX)-oldMin)<=tol)c.maxX=targetMin;
      if(Math.abs(Number(c.minX)-oldMax)<=tol)c.minX=targetMax;
    }

    u.divisionNominalThicknessM=target;
    u.width=target;

    // A Divisão vertical é uma caixa comum; X é sempre a espessura.
    if(!(Array.isArray(u.forms)&&u.forms.length)){
      obj.scale.x=target;
    }
    obj.updateMatrixWorld?.(true);

    registerVerticalDivisionFixedBand(root,targetMin,targetMax);
    repaired++;
  }
  return repaired;
}


function resizeSpaceRoot(root,{width,depth,height,yBase,name}={}){
  if(!root) throw new Error('Espaço não encontrado');
  width=Number(width); depth=Number(depth); height=Number(height); yBase=Number(yBase);
  if(![width,depth,height,yBase].every(Number.isFinite)||width<.002||depth<.002||height<.002) throw new Error('Confira as medidas do espaço');
  if(yBase<0) throw new Error('A altura do chão não pode ser negativa');

  // Antes de redimensionar, restaura qualquer Divisão vertical antiga para a
  // espessura nominal da chapa e registra essa faixa como fixa.
  repairVerticalDivisionThickness(root);

  const src=rootBounds(root);
  const dst={minX:src.minX,maxX:src.minX+width,minY:yBase,maxY:yBase+height,minZ:src.minZ,maxZ:src.minZ+depth};
  const fixedX=fixedIntervalsFromSpace(root,'x'), fixedY=fixedIntervalsFromSpace(root,'y'), fixedZ=fixedIntervalsFromSpace(root,'z');
  const mapX=makeFixedAxisMapper(src.minX,src.maxX,dst.minX,dst.maxX,fixedX);
  const mapY=makeFixedAxisMapper(src.minY,src.maxY,dst.minY,dst.maxY,fixedY);
  const mapZ=makeFixedAxisMapper(src.minZ,src.maxZ,dst.minZ,dst.maxZ,fixedZ);

  // Captura as peças antes de alterar os limites do espaço.
  const linked=objects.filter(o=>o.userData?.spaceRootId===root.id || objectInsideSpaceRoot(o,root));
  const pieceStates=linked.map(o=>{
    const u=o.userData;
    return {o, minX:o.position.x-u.width/2,maxX:o.position.x+u.width/2,minY:o.position.y-u.height/2,maxY:o.position.y+u.height/2,minZ:o.position.z-u.depth/2,maxZ:o.position.z+u.depth/2};
  });

  // Primeiro remapeia as divisões/vãos internos.
  for(const c of root.cells){
    c.minX=mapX(c.minX); c.maxX=mapX(c.maxX);
    c.minY=mapY(c.minY); c.maxY=mapY(c.maxY);
    c.minZ=mapZ(c.minZ); c.maxZ=mapZ(c.maxZ);
  }

  // Remapeia as peças. Trechos dentro de faixas fixas preservam espessura;
  // trechos soltos absorvem o aumento/redução do móvel.
  for(const st of pieceStates){
    const o=st.o,u=o.userData;
    const nx0=mapX(st.minX), nx1=mapX(st.maxX), ny0=mapY(st.minY), ny1=mapY(st.maxY), nz0=mapZ(st.minZ), nz1=mapZ(st.maxZ);
    const nw=Math.max(.001,Math.abs(nx1-nx0)), nh=Math.max(.001,Math.abs(ny1-ny0)), nd=Math.max(.001,Math.abs(nz1-nz0));
    u.width=nw; u.height=nh; u.depth=nd;
    if(Array.isArray(u.forms)&&u.forms.length){o.scale.set(1,1,1);rebuildFormGeometry(o);}else o.scale.set(nw,nh,nd);
    o.position.set((nx0+nx1)/2,(ny0+ny1)/2,(nz0+nz1)/2);
    updateAutoMachiningAfterPieceResize(o);
  }

  // Mantém as faixas fixas persistentes corretas para futuros redimensionamentos.
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands.x=mapPersistentFixedBands(root,'x',mapX,src.minX,dst.minX);
  root.fixedBands.y=mapPersistentFixedBands(root,'y',mapY,src.minY,dst.minY);
  root.fixedBands.z=mapPersistentFixedBands(root,'z',mapZ,src.minZ,dst.minZ);

  root.width=width; root.depth=depth; root.height=height; root.yBase=yBase;
  root.x=dst.minX+width/2; root.z=dst.minZ+depth/2;
  if(String(name||'').trim()) root.name=String(name).trim();

  // Conjuntos de gaveta não são deformados como blocos comuns: são
  // recalculados a partir do vão e da corrediça, no estilo paramétrico.
  rebuildDrawerSetsForRoot(root);
  renderSpaces(); applyDoorVisibility(root); renderMachiningVisuals();
  const currentId=selectedSpaceCell?.rootId===root.id?selectedSpaceCell.cellId:null;
  const current=currentId?getSpaceCell(root.id,currentId):null;
  if(current) selectSpaceCellByIds(root.id,current.id); else selectSpaceRootOnly(root);
  updateMeasureBadge();
}
function objectInsideSpaceRoot(obj,root,tol=.003){
  if(obj.userData.spaceRootId===root.id) return true;
  const a=getBounds(obj), b=rootBounds(root);
  return a.minX>=b.minX-tol && a.maxX<=b.maxX+tol && a.minY>=b.minY-tol && a.maxY<=b.maxY+tol && a.minZ>=b.minZ-tol && a.maxZ<=b.maxZ+tol;
}
function disposeObject(obj){
  const ve=obj.userData?.visualEdges;
  if(ve){ve.geometry?.dispose?.();ve.material?.dispose?.();obj.remove(ve);}
  scene.remove(obj);
  obj.geometry?.dispose();
  (obj.userData.faceMaterials||[]).forEach(m=>m.dispose?.());
}
function deleteSelectedSpaceRoot(){
  const rootId=selectedSpaceCell?.rootId || activeSpaceRootId;
  if(!rootId){toast('Selecione um espaço');return false;}

  const i=spaceRoots.findIndex(r=>r.id===rootId);
  if(i<0){toast('Espaço não encontrado');return false;}

  const root=spaceRoots[i];
  const linked=objects.filter(o=>objectInsideSpaceRoot(o,root));
  const cells=(root.cells||[]).length;
  const extra=linked.length
    ? `\n\nTambém serão apagadas ${linked.length} peça(s) que pertencem a este móvel.`
    : '';

  const ok=window.confirm(
    `Apagar o espaço / móvel “${root.name}”?`+
    `\n\nEste móvel possui ${cells} divisão(ões)/vão(s).`+
    extra+
    `\n\nSe foi criado por engano, pode apagar com segurança. A ação ainda pode ser revertida em Desfazer.`
  );
  if(!ok)return false;

  // Fecha qualquer painel relacionado antes de remover a seleção.
  $('spaceActions').style.display='none';
  $('spaceMoreDialog').style.display='none';
  $('editSpaceDialog').style.display='none';

  // Remove também ferragens que ligavam peças deste móvel a outras peças.
  removeHardwareLinkedToObjects(linked);

  for(const obj of linked){
    const oi=objects.indexOf(obj);
    if(oi>=0)objects.splice(oi,1);
    disposeObject(obj);
  }
  if(selected&&linked.includes(selected))selected=null;

  // Remove o grupo visual deste espaço ANTES de tirá-lo de spaceRoots.
  if(root.group){
    root.group.traverse(o=>{
      if(o.isMesh||o.isLineSegments||o.isLine){
        o.geometry?.dispose?.();
        if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());
        else o.material?.dispose?.();
      }
    });
    scene.remove(root.group);
    root.group=null;
  }

  spaceRoots.splice(i,1);
  clearSpaceSelection();
  renderSpaces();
  renderMachiningVisuals();
  updateMeasureBadge();
  commitHistory();

  toast(linked.length
    ? `“${root.name}” apagado · ${linked.length} peça(s) removida(s)`
    : `“${root.name}” apagado`
  );
  return true;
}

function createBox({width=1, depth=1, height=1, x=0, yBase=0, z=0, name='Cubo', kind='box', materialType='genérico', baseColor=COLORS.default, materialId=null, materialCode='', materialGrain=false, materialCoreColor=null, edgeBands={}, partId=null, labelMeta=null, spaceRootId=null, machining=[], forms=[], rotationX=0, rotationY=0, rotationZ=0, divisionNominalThicknessM=null, curvedRole=null, curvedConfig=null, drawerSetId=null, drawerRole=null, drawerIndex=null, drawerConfig=null, doorConfig=null, excludeFromCutList=false, spaceCutting=false, spaceCutParentBounds=null}={}, doHistory=true){
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
    excludeFromCutList:!!excludeFromCutList,
    spaceCutting:!!spaceCutting,
    // Guarda o vão ORIGINAL no qual esta peça estrutural foi criada. Isso
    // permite devolver somente a espessura da peça ao vão correto ao apagá-la,
    // sem misturar com divisões vizinhas do mesmo espaço.
    spaceCutParentBounds:spaceCutParentBounds?JSON.parse(JSON.stringify(spaceCutParentBounds)):null
  };
  mesh.castShadow=true; mesh.receiveShadow=true;

  // Se a peça não recebeu material explicitamente, herda o material padrão
  // do espaço quando a espessura nominal da chapa corresponde à peça.
  // Isso evita aplicar MDF 18 mm automaticamente em um fundo de gaveta 6 mm.
  applySpaceDefaultMaterialToObject(mesh,spaceRootId,{requireThicknessMatch:true});

  const visualEdgeMat=new THREE.LineBasicMaterial({color:0x080808,transparent:true,opacity:xray3DActive()?.86:.96,depthTest:!xray3DActive(),depthWrite:false});
  const visualEdges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),visualEdgeMat);
  visualEdges.userData.isVisualEdge=true; visualEdges.visible=true; visualEdges.renderOrder=xray3DActive()?88:12;
  mesh.add(visualEdges); mesh.userData.visualEdges=visualEdges;
  scene.add(mesh); objects.push(mesh);
  if(mesh.userData.forms.length) rebuildFormGeometry(mesh);
  restoreBaseColor(mesh);
  selectObject(mesh);
  if(mesh.userData.machining.length) renderMachiningVisuals();
  if(doHistory) commitHistory();
  return mesh;
}

