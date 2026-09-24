// DesignLabMoveis 1.310.00 · módulo production-materials.
export function createProductionMaterialsModule(ctx){
  const { $, COLORS, THREE, adminAllowed, allProjectFurnitureParts, axisLabel, cadMachiningVisible, clearMachiningDraftPreview, closeCopyShapeTool, cloudAccountState, cloudApiFetch, commitHistory, controls, cutPlanAssignCodes, cutPlanPartSignature, downloadText, entryAxisName, entryAxisSign, escapeHtml, flatPartInfo, furnitureObjects, getSpaceRoot, holeSeriesInstances, machiningRawCoord, mmPrec, nice, objectBelongsToRoot, operationDepthMm, parseDecimalInput, perspectiveCamera, pieceThicknessInfo, referenceMeshes, renderMachiningList, renderMachiningVisuals, renderSpaces, resolvedMachiningCoords, restoreBaseColor, returnTo3D, rootForObject, roundMmNumber, safeFileName, sanitizeMachiningForPiece, scene, selectObject, selectedFurnitureRoot, setAllFaces, setDesignLabVisualizationOnly, setTool, setVisualMode, shapeCopyPieceEligible, shapeDeepClone, toast, uid, updateDraftPreviewTransforms, updateInspector, updateMeasureBadge }=ctx;
  const runtimeModel=ctx.runtimeModel;
  // ---- domínio extraído do runtime: linhas 3697-4187 ----
  const PRODUCTION_SCHEMA_VERSION=5;
  
  // 1.200.95 · CATÁLOGO PADRÃO COM UMA ENTRADA POR MATERIAL
  // A espessura NÃO faz mais parte do cadastro dos padrões de fábrica. Branco TX,
  // Carvalho, Freijó etc. aparecem uma única vez; a espessura efetiva é sempre a
  // espessura geométrica da peça (6, 15, 18, 18,5, 25 mm ou qualquer outra).
  const FACTORY_MATERIAL_PATTERNS=[
    {key:'mdf-cru',name:'MDF Cru',category:'MDF · Cru',code:'CRU',grain:false,color:'#c7aa78',coreColor:'#b89263'},
    {key:'branco-tx',name:'Branco TX',category:'MDF · Cores básicas',code:'BRTX',grain:false,color:'#f2f2ed',coreColor:'#c8a977'},
    {key:'maxi-branco',name:'Maxi Branco',category:'MDF · Cores básicas',code:'MBR',grain:false,color:'#fafaf7',coreColor:'#c8a977'},
    {key:'preto-tx',name:'Preto TX',category:'MDF · Cores básicas',code:'PTX',grain:false,color:'#202224',coreColor:'#b89263'},
    {key:'grafite',name:'Grafite',category:'MDF · Cores básicas',code:'GRA',grain:false,color:'#53565a',coreColor:'#b89263'},
    {key:'cinza',name:'Cinza',category:'MDF · Cores básicas',code:'CIN',grain:false,color:'#9b9d9d',coreColor:'#b89263'},
    {key:'areia',name:'Areia',category:'MDF · Cores básicas',code:'ARE',grain:false,color:'#c7b9a0',coreColor:'#b89263'},
    {key:'nuvem',name:'Nuvem',category:'MDF · Cores básicas',code:'NUV',grain:false,color:'#d9d8d2',coreColor:'#b89263'},
    {key:'brisa',name:'Brisa',category:'MDF · Cores básicas',code:'BRI',grain:false,color:'#c9d2ce',coreColor:'#b89263'},
    {key:'lume',name:'Lume',category:'MDF · Cores básicas',code:'LUM',grain:false,color:'#d6c9ae',coreColor:'#b89263'},
    {key:'carvalho-natural',name:'Carvalho Natural',category:'MDF · Madeirados',code:'CAR-NAT',grain:true,color:'#b58d5f',coreColor:'#b89263'},
    {key:'freijo',name:'Freijó',category:'MDF · Madeirados',code:'FRE',grain:true,color:'#bc915f',coreColor:'#b89263'},
    {key:'tauari',name:'Tauari',category:'MDF · Madeirados',code:'TAU',grain:true,color:'#c5a477',coreColor:'#b89263'},
    {key:'savana',name:'Savana',category:'MDF · Madeirados',code:'SAV',grain:true,color:'#9f764d',coreColor:'#b89263'},
    {key:'nogal',name:'Nogal',category:'MDF · Madeirados',code:'NOG',grain:true,color:'#765039',coreColor:'#b89263'},
    {key:'nogueira',name:'Nogueira',category:'MDF · Madeirados',code:'NOGU',grain:true,color:'#704933',coreColor:'#b89263'},
    {key:'carvalho',name:'Carvalho',category:'MDF · Madeirados',code:'CAR',grain:true,color:'#aa7d50',coreColor:'#b89263'}
  ];
  const FACTORY_SOLID_WOODS=[
    {key:'carvalho',name:'Carvalho',code:'CAR',color:'#a97b50'},
    {key:'freijo',name:'Freijó',code:'FRE',color:'#b88d5d'},
    {key:'tauari',name:'Tauari',code:'TAU',color:'#c4a274'},
    {key:'nogueira',name:'Nogueira',code:'NOGU',color:'#704933'},
    {key:'jequitiba',name:'Jequitibá',code:'JEQ',color:'#b88758'},
    {key:'pinus',name:'Pinus',code:'PIN',color:'#d1b37e'}
  ];
  // 1.300.17 · Compensados. O naval usa como padrão de estoque a chapa
  // 3050 × 1610 mm; o usuário pode editar a medida e salvar uma variação no projeto.
  const FACTORY_PLYWOODS=[
    // Compensado Naval: por padrão não trava o sentido do veio no plano de corte.
    // Se o usuário quiser preservar um sentido específico, basta marcar
    // “Material madeirado / manter sentido do veio” no plano.
    {key:'naval',name:'Compensado Naval',code:'NAV',color:'#c9a46f',coreColor:'#b88f5f',sheetWidth:3050,sheetHeight:1610,grain:false}
  ];
  // 1.200.99 · perfis lineares separados das chapas.
  const FACTORY_METAL_PROFILES=[
    {key:'metalon-20x30',name:'Metalon 20×30',code:'MET-20X30',color:'#555b60',profileWidth:20,profileHeight:30,stockLength:6000}
  ];
  const FACTORY_VENEERS=[
    {key:'carvalho',name:'Carvalho',code:'CAR',color:'#a97b50'},
    {key:'freijo',name:'Freijó',code:'FRE',color:'#b88d5d'},
    {key:'tauari',name:'Tauari',code:'TAU',color:'#c4a274'},
    {key:'nogueira',name:'Nogueira',code:'NOGU',color:'#704933'}
  ];
  function factoryMaterialId(kind,key){return `mat-factory-${kind}-${key}`;}
  function factoryBandId(kind,key){return `band-factory-${kind}-${key}`;}
  function factoryBandFamily(kind,key){return `${kind}-${key}`;}
  function canonicalFactoryMaterialId(id){
    const s=String(id||'');if(!s)return '';
    if(s==='mat-mdf-branco-18'||s==='mat-mdf-branco-6')return factoryMaterialId('mdf','branco-tx');
    for(const [kind,list] of [['mdf',FACTORY_MATERIAL_PATTERNS],['plywood',FACTORY_PLYWOODS],['wood',FACTORY_SOLID_WOODS],['veneer',FACTORY_VENEERS],['metal',FACTORY_METAL_PROFILES]]){
      for(const p of list){const canonical=factoryMaterialId(kind,p.key);if(s===canonical||s.startsWith(canonical+'-'))return canonical;}
    }
    return s;
  }
  function canonicalFactoryBandId(id){
    const s=String(id||'');if(!s)return '';
    for(const [kind,list] of [['mdf',FACTORY_MATERIAL_PATTERNS],['wood',FACTORY_SOLID_WOODS],['veneer',FACTORY_VENEERS]]){
      for(const p of list){const canonical=factoryBandId(kind,p.key);if(s===canonical||s.startsWith(canonical+'-'))return canonical;}
    }
    return s;
  }
  function buildFactoryProductionCatalog(){
    const materials=[],edgeBands=[];
    for(const p of FACTORY_MATERIAL_PATTERNS)materials.push({
      id:factoryMaterialId('mdf',p.key),name:p.name,code:`MDF-${p.code}`,
      category:p.category,pattern:p.name,family:factoryBandFamily('mdf',p.key),factory:true,flexibleThickness:true,productionKind:'sheet',
      thickness:18,sheetWidth:2750,sheetHeight:1850,grainDirection:'length',color:p.color,coreColor:p.coreColor,grain:!!p.grain
    });
    for(const p of FACTORY_PLYWOODS)materials.push({
      id:factoryMaterialId('plywood',p.key),name:p.name,code:`CP-${p.code}`,
      category:'Compensado · Naval',pattern:p.name,family:'',factory:true,flexibleThickness:true,productionKind:'sheet',
      thickness:18,sheetWidth:p.sheetWidth,sheetHeight:p.sheetHeight,grainDirection:'length',color:p.color,coreColor:p.coreColor,grain:!!p.grain
    });
    for(const p of FACTORY_SOLID_WOODS)materials.push({
      id:factoryMaterialId('wood',p.key),name:`Madeira maciça ${p.name}`,code:`MAC-${p.code}`,
      category:'Madeira maciça · Prancha',pattern:p.name,family:factoryBandFamily('wood',p.key),factory:true,flexibleThickness:true,productionKind:'wood',
      thickness:18,sheetWidth:6000,sheetHeight:250,stockLength:6000,stockWidth:250,grainDirection:'length',color:p.color,coreColor:p.color,grain:true
    });
    for(const p of FACTORY_VENEERS)materials.push({
      id:factoryMaterialId('veneer',p.key),name:`Lâmina ${p.name}`,code:`LAM-${p.code}`,
      category:'Lâmina natural',pattern:p.name,family:factoryBandFamily('veneer',p.key),factory:true,flexibleThickness:true,productionKind:'sheet',
      thickness:18,sheetWidth:2750,sheetHeight:1850,grainDirection:'length',color:p.color,coreColor:p.color,grain:true
    });
    for(const p of FACTORY_METAL_PROFILES)materials.push({
      id:factoryMaterialId('metal',p.key),name:p.name,code:p.code,
      category:'Ferro · Perfil metálico',pattern:p.name,family:'',factory:true,flexibleThickness:true,productionKind:'metal',
      thickness:p.profileWidth,sheetWidth:p.stockLength,sheetHeight:p.profileHeight,stockLength:p.stockLength,profileWidth:p.profileWidth,profileHeight:p.profileHeight,
      grainDirection:'length',color:p.color,coreColor:p.color,grain:false
    });
    const bandFamilies=[];
    for(const p of FACTORY_MATERIAL_PATTERNS)bandFamilies.push({kind:'mdf',key:p.key,name:p.name,category:p.category,color:p.color,code:p.code});
    for(const p of FACTORY_SOLID_WOODS)bandFamilies.push({kind:'wood',key:p.key,name:p.name,category:'Fitas · Madeira maciça',color:p.color,code:`MAC-${p.code}`});
    for(const p of FACTORY_VENEERS)bandFamilies.push({kind:'veneer',key:p.key,name:p.name,category:'Fitas · Lâmina natural',color:p.color,code:`LAM-${p.code}`});
    for(const p of bandFamilies)edgeBands.push({
      id:factoryBandId(p.kind,p.key),name:`Fita ${p.name}`,code:`F-${p.code}`,
      category:p.category.replace(/^MDF · /,'Fitas · MDF · '),family:factoryBandFamily(p.kind,p.key),factory:true,dynamicWidth:true,
      thickness:.45,width:18,color:p.color
    });
    return {materials,edgeBands};
  }
  const FACTORY_PRODUCTION_CATALOG=buildFactoryProductionCatalog();
  
  function defaultProjectProduction(){
    return {
      version:PRODUCTION_SCHEMA_VERSION,
      materials:FACTORY_PRODUCTION_CATALOG.materials.map(x=>({...x})),
      edgeBands:FACTORY_PRODUCTION_CATALOG.edgeBands.map(x=>({...x})),
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
  function inferProductionKind(m){
    const explicit=String(m?.productionKind||'').toLowerCase();
    if(['sheet','wood','metal'].includes(explicit))return explicit;
    const hay=`${m?.category||''} ${m?.name||''} ${m?.code||''}`.toLowerCase();
    if(/metalon|metal|ferro|perfil/.test(hay))return 'metal';
    if(/madeira maci[cç]a|prancha/.test(hay))return 'wood';
    return 'sheet';
  }
  function normalizeProductionMaterial(m){
    if(!m)return null;
    const thickness=parseDecimalInput(m.thickness),sheetWidth=parseDecimalInput(m.sheetWidth),sheetHeight=parseDecimalInput(m.sheetHeight);
    const stockLength=parseDecimalInput(m.stockLength),stockWidth=parseDecimalInput(m.stockWidth);
    const profileWidth=parseDecimalInput(m.profileWidth),profileHeight=parseDecimalInput(m.profileHeight);
    const productionKind=inferProductionKind(m);
    const normalizedSheetWidth=Number.isFinite(sheetWidth)&&sheetWidth>=100?sheetWidth:2750;
    const normalizedSheetHeight=Number.isFinite(sheetHeight)&&sheetHeight>=10?sheetHeight:1850;
    return {
      id:String(m.id||uid('mat')),
      name:String(m.name||'Material').trim()||'Material',
      code:String(m.code||'').trim(),
      thickness:Number.isFinite(thickness)&&thickness>0?thickness:18,
      sheetWidth:normalizedSheetWidth,
      sheetHeight:normalizedSheetHeight,
      stockLength:Number.isFinite(stockLength)&&stockLength>=100?stockLength:normalizedSheetWidth,
      stockWidth:Number.isFinite(stockWidth)&&stockWidth>=10?stockWidth:normalizedSheetHeight,
      profileWidth:Number.isFinite(profileWidth)&&profileWidth>0?profileWidth:(productionKind==='metal'?20:0),
      profileHeight:Number.isFinite(profileHeight)&&profileHeight>0?profileHeight:(productionKind==='metal'?30:0),
      productionKind,
      grainDirection:m.grainDirection==='width'?'width':'length',
      color:productionColor(m.color,'#d8c5a4'),
      coreColor:productionColor(m.coreColor,'#c6a77b'),
      grain:!!m.grain,
      category:String(m.category||'Personalizados').trim()||'Personalizados',
      pattern:String(m.pattern||'').trim(),
      family:String(m.family||'').trim(),
      factory:!!m.factory,
      flexibleThickness:!!m.flexibleThickness
    };
  }
  function normalizeProductionBand(b){
    if(!b)return null;
    const thickness=parseDecimalInput(b.thickness),width=parseDecimalInput(b.width);
    return {
      id:String(b.id||uid('band')),
      name:String(b.name||'Fita de borda').trim()||'Fita de borda',
      code:String(b.code||'').trim(),
      thickness:Number.isFinite(thickness)&&thickness>0?thickness:.45,
      width:Number.isFinite(width)&&width>0?width:22,
      color:productionColor(b.color,'#f5f5f2'),
      category:String(b.category||'Fitas personalizadas').trim()||'Fitas personalizadas',
      family:String(b.family||'').trim(),
      factory:!!b.factory,
      dynamicWidth:!!b.dynamicWidth
    };
  }
  function ensureFactoryProductionCatalog(){
    if(!projectProduction)projectProduction={version:PRODUCTION_SCHEMA_VERSION,materials:[],edgeBands:[],labelTemplate:defaultProjectProduction().labelTemplate};
    projectProduction.materials=Array.isArray(projectProduction.materials)?projectProduction.materials:[];
    projectProduction.edgeBands=Array.isArray(projectProduction.edgeBands)?projectProduction.edgeBands:[];
    // Remove as antigas cópias 6/15/18 dos padrões de fábrica. Materiais personalizados
    // continuam intocados; somente os registros factory são consolidados.
    projectProduction.materials=projectProduction.materials.filter(x=>!x?.factory||canonicalFactoryMaterialId(x.id)===x.id);
    projectProduction.edgeBands=projectProduction.edgeBands.filter(x=>!x?.factory||canonicalFactoryBandId(x.id)===x.id);
    for(const rec of FACTORY_PRODUCTION_CATALOG.materials){
      const existing=projectProduction.materials.find(x=>x.id===rec.id);
      if(existing)Object.assign(existing,normalizeProductionMaterial(rec));
      else projectProduction.materials.push(normalizeProductionMaterial(rec));
    }
    for(const rec of FACTORY_PRODUCTION_CATALOG.edgeBands){
      const existing=projectProduction.edgeBands.find(x=>x.id===rec.id);
      if(existing)Object.assign(existing,normalizeProductionBand(rec));
      else projectProduction.edgeBands.push(normalizeProductionBand(rec));
    }
    projectProduction.version=PRODUCTION_SCHEMA_VERSION;
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
    // Projetos antigos ganham automaticamente os padrões de fábrica sem perder
    // materiais e fitas personalizados que já estavam salvos.
    ensureFactoryProductionCatalog();
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
  function captureProductionState(){
    return productionClone({
      version:PRODUCTION_SCHEMA_VERSION,
      materials:projectProduction.materials.filter(x=>!x.factory),
      edgeBands:projectProduction.edgeBands.filter(x=>!x.factory),
      labelTemplate:projectProduction.labelTemplate
    });
  }
  function productionMaterialById(id){
    const wanted=String(id||'');
    return projectProduction.materials.find(x=>x.id===wanted)||projectProduction.materials.find(x=>x.id===canonicalFactoryMaterialId(wanted))||null;
  }
  function productionBandById(id){
    const wanted=String(id||'');
    return projectProduction.edgeBands.find(x=>x.id===wanted)||projectProduction.edgeBands.find(x=>x.id===canonicalFactoryBandId(wanted))||null;
  }
  function productionMaterialUsesPieceThickness(m){return !!m?.flexibleThickness;}
  function productionMaterialKind(m){return inferProductionKind(m);}
  function productionMaterialKindLabel(m){
    const k=productionMaterialKind(m);
    return k==='wood'?'Madeira maciça / prancha':k==='metal'?'Ferro / perfil em barra':'Chapa';
  }
  function productionMaterialStockText(m){
    const k=productionMaterialKind(m);
    if(k==='wood')return `prancha ${nice(m.stockLength||m.sheetWidth||6000)} × ${nice(m.stockWidth||m.sheetHeight||250)} mm`;
    if(k==='metal')return `barra ${nice(m.stockLength||m.sheetWidth||6000)} mm · perfil ${nice(m.profileWidth||20)} × ${nice(m.profileHeight||30)} mm`;
    return `chapa ${nice(m.sheetWidth||2750)} × ${nice(m.sheetHeight||1850)} mm`;
  }
  function productionObjectKind(o){
    const m=productionMaterialById(o?.userData?.materialId);
    return productionMaterialKind(m||{name:o?.userData?.materialType||''});
  }
  function productionMaterialEffectiveThickness(m,o=null){
    if(!m)return 0;
    if(productionMaterialUsesPieceThickness(m)){
      const ti=o?pieceThicknessInfo(o):null;
      if(ti?.thickness>0)return Number(ti.thickness);
    }
    return Number(m.thickness)||18;
  }
  function productionBandSnapshot(id){
    const b=productionBandById(id);
    return b?productionClone(b):null;
  }
  function productionBandSnapshotForPiece(id,o=ctx.selected){
    const b=productionBandSnapshot(id);if(!b)return null;
    if(b.dynamicWidth){const ti=o?pieceThicknessInfo(o):null;if(ti?.thickness>0)b.width=Number(ti.thickness);}
    return b;
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
        let b=normalizeProductionBand(rec);
        if(!b)continue;
        const factory=productionBandById(b.id);
        if(factory?.factory){
          const width=Number(b.width)||Number(factory.width)||18;
          b=productionClone(factory);
          if(b.dynamicWidth)b.width=width;
        }
        out[key]=b;
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
  
    if(keepSelection&&o===ctx.selected&&!ctx.visualMode)setAllFaces(o,COLORS.ctx.selected);
    return true;
  }
  function applySpaceDefaultMaterialToObject(o,rootOrId,{requireThicknessMatch=true}={}){
    if(!o||o.userData?.materialId)return false;
    const root=typeof rootOrId==='string'?getSpaceRoot(rootOrId):rootOrId;
    const mat=spaceDefaultMaterial(root);
    if(!root||!mat)return false;
    if(o.userData?.kind==='hardware-visual'||o.userData?.kind==='cylinder'||o.userData?.excludeFromCutList)return false;
  
    if(requireThicknessMatch&&!productionMaterialUsesPieceThickness(mat)){
      const ti=pieceThicknessInfo(o);
      if(ti&&Math.abs(Number(ti.thickness)-Number(mat.thickness))>.25)return false;
    }
    return productionApplyMaterialRecordToObject(o,mat,{keepSelection:false});
  }
  function spaceEligibleProductionPieces(root){
    if(!root)return [];
    return runtimeModel.objects.filter(o=>{
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
    if(ctx.selected&&spaceEligibleProductionPieces(root).includes(ctx.selected)&&!ctx.visualMode)setAllFaces(ctx.selected,COLORS.ctx.selected);
    return {changed,skipped};
  }
  function spaceMaterialText(rootOrId){
    const m=spaceDefaultMaterial(rootOrId);
    return m?`${m.name}${m.code?` · ${m.code}`:''}${productionMaterialUsesPieceThickness(m)?' · espessura pela peça':` · ${nice(m.thickness)} mm`} · ${productionMaterialStockText(m)}${m.grain?` · veio no ${m.grainDirection==='width'?'largura':'comprimento'}`:''}`:'Sem material padrão';
  }
  
  
  function normalizePieceGrainRotation(value){
    const n=Number(value)||0;
    return Math.abs(Math.round(n/90))%2?90:0;
  }
  function pieceGrainRotation(o){
    return normalizePieceGrainRotation(o?.userData?.materialGrainRotation);
  }
  
  function pieceProductionLabelData(o){
    if(!o)return null;
    const u=o.userData||{},ti=pieceThicknessInfo(o),root=rootForObject(o);
    return {
      schemaVersion:1,
      partId:u.partId||'',
      project:typeof ctx.currentProjectRecord!=='undefined'?(ctx.currentProjectRecord?.name||''):'',
      client:typeof ctx.currentProjectRecord!=='undefined'?(ctx.currentProjectRecord?.client||''):'',
      environment:typeof ctx.currentProjectRecord!=='undefined'?(ctx.currentProjectRecord?.environment||''):'',
      space:root?.name||'',
      partName:u.name||'Peça',
      material:u.materialType||'MDF',
      materialCode:u.materialCode||'',
      grain:!!u.materialGrain,
      grainRotation:normalizePieceGrainRotation(u.materialGrainRotation),
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
  // ---- domínio extraído do runtime: linhas 6218-6323 ----
  const PIECE_NAME_PRESET_KEY='designLabPieceNamePresetsV1';
  const PIECE_NAME_BUILTINS=[
    'Lateral esquerda','Lateral direita','Base','Chapéu','Prateleira','Divisão central','Divisão esquerda','Divisão direita',
    'Fundo','Tampo','Rodapé','Travessa','Régua','Montante','Painel','Painel lateral','Painel frontal',
    'Porta esquerda','Porta direita','Porta central','Frente de gaveta','Lateral de gaveta esquerda','Lateral de gaveta direita',
    'Contra frente','Contra fundo','Fundo de gaveta','Nicho','Capa','Testeira'
  ];
  function pieceNameCustomPresets(){
    try{const a=JSON.parse(localStorage.getItem(PIECE_NAME_PRESET_KEY)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[];}catch{return [];}
  }
  function savePieceNameCustomPresets(list){
    const clean=[...new Set((list||[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,120);
    localStorage.setItem(PIECE_NAME_PRESET_KEY,JSON.stringify(clean));return clean;
  }
  function refreshPieceNamePresetSelect(current=''){
    const sel=$('pieceNamePresetSelect');if(!sel)return;
    const keep=String(current||'').trim();sel.innerHTML='';
    const first=document.createElement('option');first.value='';first.textContent='Escolher um nome…';sel.appendChild(first);
    const addGroup=(label,items)=>{if(!items.length)return;const g=document.createElement('optgroup');g.label=label;for(const name of items){const o=document.createElement('option');o.value=name;o.textContent=name;g.appendChild(o);}sel.appendChild(g);};
    addGroup('Nomes padrão',PIECE_NAME_BUILTINS);addGroup('Meus nomes',pieceNameCustomPresets());
    sel.value=[...sel.options].some(o=>o.value===keep)?keep:'';
  }
  function applyPieceNamePreset(name){
    if(!ctx.selected)return;name=String(name||'').trim();if(!name)return;
    ctx.selected.userData.name=name;
    if($('partNameInput'))$('partNameInput').value=name;
    $('objectName').textContent=name;
    refreshPieceNamePresetSelect(name);
    updateMeasureBadge();commitHistory();toast(`Nome alterado para “${name}”`);
  }
  function createPieceNamePreset(){
    const input=$('pieceNameCustomInput');const name=String(input?.value||'').trim();
    if(!name){toast('Digite o nome que deseja criar');input?.focus();return;}
    const list=pieceNameCustomPresets();if(!list.some(x=>x.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))list.push(name);
    savePieceNameCustomPresets(list);if(input)input.value='';refreshPieceNamePresetSelect(name);applyPieceNamePreset(name);
  }
  
  // 1.200.95 · troca rápida de material com busca e uma entrada por padrão.
  function pieceMaterialBandFor(material,actualThickness){
    if(!material?.family)return null;
    const candidates=projectProduction.edgeBands.filter(b=>b.family===material.family);
    if(!candidates.length)return null;
    const target=Number(actualThickness)||18;
    return candidates.slice().sort((a,b)=>Math.abs(Number(a.width)-target)-Math.abs(Number(b.width)-target))[0]||null;
  }
  function materialSearchText(m){
    return `${m?.name||''} ${m?.code||''} ${m?.category||''} ${m?.pattern||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  }
  function fillPieceMaterialSelect(currentId='',query=null){
    const sel=$('pieceMaterialSelect');if(!sel)return;
    const old=canonicalFactoryMaterialId(currentId||sel.value||'');
    const q=String(query??$('pieceMaterialSearch')?.value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
    sel.innerHTML='<option value="">Sem material definido</option>';
    const groups=new Map();
    for(const m of projectProduction.materials){
      if(q&&!materialSearchText(m).includes(q))continue;
      const label=m.category||'Personalizados';
      if(!groups.has(label))groups.set(label,[]);
      groups.get(label).push(m);
    }
    let count=0;
    for(const [label,list] of groups){
      const g=document.createElement('optgroup');g.label=label;
      list.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR',{numeric:true})).forEach(m=>{
        const op=document.createElement('option');op.value=m.id;op.textContent=m.name;g.appendChild(op);count++;
      });
      sel.appendChild(g);
    }
    if(q&&!count){const op=document.createElement('option');op.disabled=true;op.textContent='Nenhum material encontrado';sel.appendChild(op);}
    if(old&&[...sel.options].some(o=>o.value===old))sel.value=old;
    updatePieceMaterialQuickInfo();
  }
  function updatePieceMaterialQuickInfo(){
    const info=$('pieceMaterialInfo'),sel=$('pieceMaterialSelect');if(!info||!sel)return;
    const material=productionMaterialById(sel.value);
    if(!material){info.textContent='Escolha um material. A espessura usada será sempre a espessura atual da peça.';return;}
    const ti=ctx.selected?pieceThicknessInfo(ctx.selected):null,actual=ti?.thickness||0;
    const mismatch=ctx.selected&&!productionMaterialUsesPieceThickness(material)&&Math.abs(Number(material.thickness)-Number(actual))>.2;
    const band=pieceMaterialBandFor(material,actual);
    info.innerHTML=`<strong>${escapeHtml(material.name)}</strong> · espessura desta peça: <strong>${nice(actual)} mm</strong> · chapa ${nice(material.sheetWidth)} × ${nice(material.sheetHeight)} mm${material.grain?' · com veio':''}`+
      `${mismatch?`<br><span style="color:#ffbd68">⚠ Material personalizado cadastrado com ${nice(material.thickness)} mm; a geometria da peça será mantida em ${nice(actual)} mm.</span>`:''}`+
      `${band?`<br>Fita compatível: <strong>${escapeHtml(band.name)}</strong> · largura ${nice(actual)} mm`:''}`;
  }
  function applySelectedPieceMaterialFromInspector(){
    if(!productionSelectedIsPiece()){toast('Selecione uma peça para trocar o material');return;}
    const material=productionMaterialById($('pieceMaterialSelect')?.value);
    if(!material){toast('Escolha um material');return;}
    const ti=pieceThicknessInfo(ctx.selected),actual=ti?.thickness||0;
    productionApplyMaterialRecordToObject(ctx.selected,material,{keepSelection:true});
    let synced=0;
    if($('pieceMaterialSyncBands')?.checked){
      const current=normalizePieceEdgeBands(ctx.selected.userData?.edgeBands||{});
      const replacement=pieceMaterialBandFor(material,actual);
      if(replacement){
        for(const key of ['uMin','uMax','vMin','vMax']){
          if(current[key]){current[key]=productionBandSnapshotForPiece(replacement.id,ctx.selected);synced++;}
        }
        ctx.selected.userData.edgeBands=current;
        restoreBaseColor(ctx.selected);
        if(!ctx.visualMode)setAllFaces(ctx.selected,COLORS.ctx.selected);
      }
    }
    updateInspector();productionRefreshSelectedPiece();commitHistory();
    const mismatch=!productionMaterialUsesPieceThickness(material)&&Math.abs(Number(material.thickness)-Number(actual))>.2;
    toast(`${material.name} aplicado · ${nice(actual)} mm${synced?` · ${synced} fita(s) combinadas`:''}${mismatch?' · espessura da peça mantida':''}`);
  }
  // ---- domínio extraído do runtime: linhas 10969-11555 ----
  function productionFillSelect(select,items,emptyText){
    if(!select)return;
    const old=select.value;
    select.innerHTML='';
    const none=document.createElement('option');
    none.value='';none.textContent=emptyText;select.appendChild(none);
    const groups=new Map();
    for(const item of items){
      const label=item.category|| (item.factory?'Padrões do aplicativo':'Personalizados');
      if(!groups.has(label))groups.set(label,[]);
      groups.get(label).push(item);
    }
    for(const [label,list] of groups){
      const g=document.createElement('optgroup');g.label=label;
      list.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR',{numeric:true})).forEach(item=>{
        const op=document.createElement('option');
        op.value=item.id;
        op.textContent=item.code?`${item.name} · ${item.code}`:item.name;
        g.appendChild(op);
      });
      select.appendChild(g);
    }
    if([...select.options].some(o=>o.value===old))select.value=old;
  }
  function productionSelectedIsPiece(){
    return !!ctx.selected && ctx.selected.userData?.kind!=='cylinder' && ctx.selected.userData?.kind!=='hardware-visual' && !ctx.selected.userData?.excludeFromCutList;
  }
  function productionUpdateMaterialKindFields(){
    const kind=$('productionMaterialKind')?.value||'sheet';
    const show=(id,on)=>{const el=$(id);if(el)el.style.display=on?'':'none';};
    show('productionSheetLengthField',kind==='sheet');
    show('productionSheetWidthField',kind==='sheet');
    show('productionStockLengthField',kind==='wood'||kind==='metal');
    show('productionStockWidthField',kind==='wood');
    show('productionProfileWidthField',kind==='metal');
    show('productionProfileHeightField',kind==='metal');
    show('productionMaterialGrainField',kind!=='metal');
    const check=$('productionMaterialGrain')?.closest?.('.productionCheck');
    if(check)check.style.display=kind==='metal'?'none':'';
  }
  function productionLoadMaterialFields(){
    const m=productionMaterialById($('productionMaterialSelect').value);
    if(!m)return;
    $('productionMaterialName').value=m.name;
    $('productionMaterialCode').value=m.code||'';
    if($('productionMaterialKind'))$('productionMaterialKind').value=productionMaterialKind(m);
    const tInput=$('productionMaterialThickness');
    if(tInput){
      const ti=ctx.selected?pieceThicknessInfo(ctx.selected):null;
      tInput.value=nice(productionMaterialUsesPieceThickness(m)?(ti?.thickness||18):m.thickness);
      tInput.disabled=!!m.flexibleThickness;
      tInput.title=m.flexibleThickness?'Padrão do aplicativo: usa automaticamente a espessura da peça.':'';
    }
    $('productionMaterialSheetWidth').value=nice(m.sheetWidth||2750);
    $('productionMaterialSheetHeight').value=nice(m.sheetHeight||1850);
    if($('productionMaterialStockLength'))$('productionMaterialStockLength').value=nice(m.stockLength||m.sheetWidth||6000);
    if($('productionMaterialStockWidth'))$('productionMaterialStockWidth').value=nice(m.stockWidth||m.sheetHeight||250);
    if($('productionMaterialProfileWidth'))$('productionMaterialProfileWidth').value=nice(m.profileWidth||20);
    if($('productionMaterialProfileHeight'))$('productionMaterialProfileHeight').value=nice(m.profileHeight||30);
    $('productionMaterialGrainDirection').value=m.grainDirection==='width'?'width':'length';
    $('productionMaterialColor').value=productionColor(m.color,'#d8c5a4');
    $('productionMaterialCoreColor').value=productionColor(m.coreColor,'#c6a77b');
    $('productionMaterialGrain').checked=!!m.grain;
    productionUpdateMaterialKindFields();
  }
  function productionLoadBandFields(){
    const b=productionBandById($('productionBandSelect').value);
    if(!b)return;
    $('productionBandName').value=b.name;
    $('productionBandCode').value=b.code||'';
    $('productionBandThickness').value=nice(b.thickness);
    const wInput=$('productionBandWidth');
    if(wInput){
      const ti=ctx.selected?pieceThicknessInfo(ctx.selected):null;
      wInput.value=nice(b.dynamicWidth?(ti?.thickness||18):b.width);
      wInput.disabled=!!b.dynamicWidth;
      wInput.title=b.dynamicWidth?'Fita padrão: a largura acompanha automaticamente a espessura da peça.':'';
    }
    $('productionBandColor').value=productionColor(b.color,'#f5f5f2');
  }
  function productionRefreshCatalogSelects(){
    ensureFactoryProductionCatalog();
    productionFillSelect($('productionMaterialSelect'),projectProduction.materials,'＋ Novo / selecione material');
    productionFillSelect($('productionBandSelect'),projectProduction.edgeBands,'＋ Nova / selecione fita');
    for(const id of ['productionEdgeUMin','productionEdgeUMax','productionEdgeVMin','productionEdgeVMax']){
      const sel=$(id),old=sel.value;
      sel.innerHTML='<option value="">Sem fita</option>';
      for(const b of projectProduction.edgeBands){
        const op=document.createElement('option');
        op.value=b.id;op.textContent=b.code?`${b.name} · ${b.code}`:b.name;sel.appendChild(op);
      }
      if([...sel.options].some(o=>o.value===old))sel.value=old;
    }
    refreshSpaceMaterialSelects();
    if($('pieceMaterialSelect'))fillPieceMaterialSelect(ctx.selected?.userData?.materialId||'');
  }
  function productionRefreshSelectedPiece(){
    const ok=productionSelectedIsPiece();
    const info=$('productionSelectedPieceInfo');
    const edgeBox=$('productionEdgeAssignments');
    $('productionMaterialApply').disabled=!ok;
    $('productionClearBands').disabled=!ok;
  
    for(const sel of document.querySelectorAll('[data-edge-key]'))sel.disabled=!ok;
  
    if(!ok){
      info.textContent='Selecione uma peça para definir o material de produção.';
      $('productionLabelPreview').innerHTML='<strong>Etiquetas:</strong> selecione uma peça para visualizar os dados que já estão preparados.';
      return;
    }
  
    const u=ctx.selected.userData,ti=pieceThicknessInfo(ctx.selected),defs=pieceEdgeDisplayDefinitions(ctx.selected);
    const material=productionMaterialById(u.materialId);
    const actualT=ti?.thickness||0;
    const mismatch=material&&!productionMaterialUsesPieceThickness(material)&&Math.abs(Number(material.thickness)-actualT)>.2;
  
    info.innerHTML=
      `<strong>${escapeHtml(u.name||'Peça')}</strong> · ${nice(ti?.faceW||0)} × ${nice(ti?.faceH||0)} × ${nice(actualT)} mm`+
      `<br>Material: <strong>${escapeHtml(u.materialType||'não definido')}</strong>${u.materialCode?` · ${escapeHtml(u.materialCode)}`:''}${material?` · <em>${escapeHtml(productionMaterialKindLabel(material))}</em>`:''}`+
      `${mismatch?`<br><span style="color:#ffb14a">⚠ Material cadastrado com ${nice(material.thickness)} mm, mas a peça tem ${nice(actualT)} mm. A geometria não foi alterada.</span>`:''}`;
  
    for(const [key,d] of Object.entries(defs)){
      const cap=key[0].toUpperCase()+key.slice(1);
      $(`productionEdgeLabel${cap}`).textContent=d.label;
      $(`productionEdgeAxis${cap}`).textContent=d.axis;
    }
  
    const bands=normalizePieceEdgeBands(u.edgeBands||{});
    for(const [key,id] of Object.entries({
      uMin:'productionEdgeUMin',uMax:'productionEdgeUMax',vMin:'productionEdgeVMin',vMax:'productionEdgeVMax'
    })){
      $(id).value=bands[key]?.id||'';
    }
  
    const ld=pieceProductionLabelData(ctx.selected);
    $('productionLabelPreview').innerHTML=
      `<strong>ID ${escapeHtml(ld.partId||'—')}</strong> · ${escapeHtml(ld.partName)}<br>`+
      `Material: ${escapeHtml(ld.material)}${ld.materialCode?` (${escapeHtml(ld.materialCode)})`:''} · `+
      `${nice(ld.faceW)} × ${nice(ld.faceH)} × ${nice(ld.thickness)} mm · veio ${ld.grain?'SIM':'NÃO'}<br>`+
      `Fitas: ${escapeHtml(ld.edgeBandSummary||'nenhuma')} · Usinagens: ${ld.machiningCount}<br>`+
      `<span style="color:#8ca397">Projeto/cliente/ambiente/espaço também já fazem parte da estrutura. Na etapa de etiquetas escolheremos quais campos imprimir.</span>`;
  }
  function productionRefreshDialog(){
    productionRefreshCatalogSelects();
    productionRefreshSelectedPiece();
  }
  function openProductionDialog(){
    $('morePanel').style.display='none';
    productionRefreshDialog();
    $('productionDialog').style.display='flex';
  }
  function closeProductionDialog(){
    $('productionDialog').style.display='none';
  }
  
  // ---------- 1.100.96 · Etiquetas A4 com margens e espaçamentos independentes ----------
  const LABELS_PREFS_KEY='designlabLabelsV110075';
  function labelsPrefs(){
    const d={scope:'project',mode:'piece',width:70,height:40,paper:'a4',marginLeft:8,marginRight:8,marginTop:8,marginBottom:8,gapHorizontal:3,gapVertical:0,sort:'code',showProject:true,showSpace:true,showBands:true,showMachining:true,showGrain:true,showId:true};
    try{
      const raw=JSON.parse(localStorage.getItem(LABELS_PREFS_KEY)||'{}')||{};
      // Migração das versões antigas, que tinham uma margem única para os 4 lados.
      const legacy=Math.max(0,Number(raw.margin)||0);
      return {...d,...raw,
        marginLeft:Number.isFinite(Number(raw.marginLeft))?Number(raw.marginLeft):(raw.margin!=null?legacy:d.marginLeft),
        marginRight:Number.isFinite(Number(raw.marginRight))?Number(raw.marginRight):(raw.margin!=null?legacy:d.marginRight),
        marginTop:Number.isFinite(Number(raw.marginTop))?Number(raw.marginTop):(raw.margin!=null?legacy:d.marginTop),
        marginBottom:Number.isFinite(Number(raw.marginBottom))?Number(raw.marginBottom):(raw.margin!=null?legacy:d.marginBottom),
        // Migração 1.100.96: o espaçamento antigo passa a representar somente o vão horizontal.
        // Na vertical começamos em 0 mm para etiquetas que são coladas entre as linhas.
        gapHorizontal:Number.isFinite(Number(raw.gapHorizontal))?Number(raw.gapHorizontal):(Number.isFinite(Number(raw.gap))?Number(raw.gap):d.gapHorizontal),
        gapVertical:Number.isFinite(Number(raw.gapVertical))?Number(raw.gapVertical):d.gapVertical
      };
    }catch(_){return d}
  }
  function labelsSavePrefs(){
    const p={
      scope:$('labelsScope')?.value||'project',mode:$('labelsMode')?.value||'piece',
      width:Math.max(30,Number($('labelsWidth')?.value)||70),height:Math.max(20,Number($('labelsHeight')?.value)||40),
      paper:$('labelsPaper')?.value||'a4',
      marginLeft:Math.max(0,Number($('labelsMarginLeft')?.value)||0),marginRight:Math.max(0,Number($('labelsMarginRight')?.value)||0),
      marginTop:Math.max(0,Number($('labelsMarginTop')?.value)||0),marginBottom:Math.max(0,Number($('labelsMarginBottom')?.value)||0),
      gapHorizontal:Math.max(0,Number($('labelsGapHorizontal')?.value)||0),gapVertical:Math.max(0,Number($('labelsGapVertical')?.value)||0),sort:$('labelsSort')?.value||'code',
      showProject:!!$('labelsShowProject')?.checked,showSpace:!!$('labelsShowSpace')?.checked,showBands:!!$('labelsShowBands')?.checked,
      showMachining:!!$('labelsShowMachining')?.checked,showGrain:!!$('labelsShowGrain')?.checked,showId:!!$('labelsShowId')?.checked
    };
    localStorage.setItem(LABELS_PREFS_KEY,JSON.stringify(p));return p;
  }
  function labelsApplyPrefs(){
    const p=labelsPrefs(),set=(id,v)=>{if($(id))$(id).value=v},chk=(id,v)=>{if($(id))$(id).checked=!!v};
    set('labelsScope',p.scope);set('labelsMode',p.mode);set('labelsWidth',p.width);set('labelsHeight',p.height);set('labelsPaper',p.paper);
    set('labelsMarginLeft',p.marginLeft);set('labelsMarginRight',p.marginRight);set('labelsMarginTop',p.marginTop);set('labelsMarginBottom',p.marginBottom);set('labelsGapHorizontal',p.gapHorizontal);set('labelsGapVertical',p.gapVertical);set('labelsSort',p.sort);
    chk('labelsShowProject',p.showProject);chk('labelsShowSpace',p.showSpace);chk('labelsShowBands',p.showBands);chk('labelsShowMachining',p.showMachining);chk('labelsShowGrain',p.showGrain);chk('labelsShowId',p.showId);
  }
  function labelsSourceParts(scope){
    let parts=[];
    if(scope==='ctx.selected'){
      if(!productionSelectedIsPiece())throw new Error('Selecione uma peça para gerar a etiqueta.');
      const p=flatPartInfo(ctx.selected,1,{production:true});if(p){const r=rootForObject(ctx.selected);p.spaceName=r?.name||'';p.spaceRootId=r?.id||'';parts=[p];}
    }else if(scope==='furniture'){
      const root=selectedFurnitureRoot();if(!root)throw new Error('Selecione um móvel/espaço para gerar as etiquetas.');
      parts=furnitureObjects(root).filter(o=>o.userData?.kind!=='space-cell'&&o.userData?.kind!=='cylinder'&&!o.userData?.excludeFromCutList&&o.userData?.kind!=='hardware-visual').map((o,i)=>{const p=flatPartInfo(o,i+1,{production:true});if(p){p.spaceName=root.name||'Espaço';p.spaceRootId=root.id;}return p;}).filter(Boolean);
    }else parts=allProjectFurnitureParts({production:true});
    if(!parts.length)throw new Error('Não existem peças disponíveis para etiquetas.');
    return cutPlanAssignCodes(parts);
  }
  function labelsSignature(p){return cutPlanPartSignature(p)}
  function labelsBuildItems(prefs=labelsSavePrefs()){
    const parts=labelsSourceParts(prefs.scope),counts=new Map();
    for(const p of parts)counts.set(labelsSignature(p),(counts.get(labelsSignature(p))||0)+1);
    const seen=new Map(),items=[];
    if(prefs.mode==='group'){
      const grouped=new Map();
      for(const p of parts){const k=labelsSignature(p);if(!grouped.has(k))grouped.set(k,{...p,qty:0});grouped.get(k).qty++;}
      items.push(...grouped.values().map(p=>({...p,seq:1,total:p.qty,grouped:true})));
    }else{
      for(const p of parts){const k=labelsSignature(p),seq=(seen.get(k)||0)+1;seen.set(k,seq);items.push({...p,qty:1,seq,total:counts.get(k)||1});}
    }
    const cmp=(a,b)=>String(a||'').localeCompare(String(b||''),'pt-BR',{numeric:true,sensitivity:'base'});
    items.sort((a,b)=>{
      if(prefs.sort==='space')return cmp(a.spaceName,b.spaceName)||cmp(a.cutCode,b.cutCode)||cmp(a.name,b.name);
      if(prefs.sort==='material')return cmp(a.material,b.material)||cmp(a.cutCode,b.cutCode)||cmp(a.name,b.name);
      if(prefs.sort==='name')return cmp(a.name,b.name)||cmp(a.cutCode,b.cutCode);
      return cmp(a.cutCode,b.cutCode)||cmp(a.name,b.name);
    });
    return items;
  }
  function labelMachiningStats(p){
    const ops=p.machining||[];let holes=0,grooves=0;
    for(const op of ops){if(op.type==='hole')holes+=holeSeriesInstances(p.object,op).length;else if(op.type==='groove')grooves++;}
    return {holes,grooves,total:holes+grooves};
  }
  function labelEdgeData(p){
    const defs=p.object?pieceEdgeDisplayDefinitions(p.object):{},fallback={uMin:'U−',uMax:'U+',vMin:'V−',vMax:'V+'},out=[];
    for(const k of ['uMin','uMax','vMin','vMax']){const b=p.edgeBands?.[k],side=defs?.[k]?.label||fallback[k];out.push({key:k,side,on:!!b,text:b?(b.code||b.name||'Fita'):'—'});}return out;
  }
  function labelCodeText(p){if(p.grouped)return p.cutCode||'?';return p.total>1&&p.seq?`${p.cutCode||'?'} · ${p.seq}/${p.total}`:(p.cutCode||'?')}
  function labelHtmlCard(p,prefs,{preview=false}={}){
    const project=typeof ctx.currentProjectRecord!=='undefined'?ctx.currentProjectRecord:null,m=labelMachiningStats(p),edges=labelEdgeData(p);
    const cls=preview?'labelCardPreview':'printLabel';
    const projectLine=[project?.name,project?.client].filter(Boolean).map(escapeHtml).join(' · ');
    const spaceLine=[project?.environment,p.spaceName].filter(Boolean).map(escapeHtml).join(' · ');
    const edgeHtml=prefs.showBands?`<div class="lpEdges">${edges.map(e=>`<span class="lpEdge${e.on?' on':''}">${e.side}: ${escapeHtml(e.text)}</span>`).join('')}</div>`:'';
    const machine=prefs.showMachining?`<div>Usinagem: ${m.holes} furo(s) · ${m.grooves} rasgo(s)</div>`:'';
    const info=[];if(prefs.showProject&&projectLine)info.push(`<div>${projectLine}</div>`);if(prefs.showSpace&&spaceLine)info.push(`<div>${spaceLine}</div>`);if(machine)info.push(machine);
    return `<article class="${cls}"><div class="lpHead"><div class="lpCode">${escapeHtml(labelCodeText(p))}</div><div class="lpName">${escapeHtml(p.name||'Peça')}</div>${p.qty>1?`<div class="lpQty">×${p.qty}</div>`:''}</div><div class="lpDims">${nice(p.faceW)} × ${nice(p.faceH)} × ${nice(p.thickness)} mm</div><div class="lpMaterial">${escapeHtml(p.material||'MDF')}${p.materialCode?` · ${escapeHtml(p.materialCode)}`:''}</div><div class="lpMeta"><div>${info.join('')}</div>${prefs.showGrain&&p.materialGrain?`<div class="lpGrain" title="Sentido do veio · ${normalizePieceGrainRotation(p.materialGrainRotation)}°">${normalizePieceGrainRotation(p.materialGrainRotation)===90?'↔':'↕'}</div>`:''}</div>${edgeHtml}<div class="lpFoot">${prefs.showId?`<span class="lpId">ID ${escapeHtml(p.partId||'—')}</span>`:'<span></span>'}<span>${p.materialGrain?`VEIO ${normalizePieceGrainRotation(p.materialGrainRotation)}°`:'SEM VEIO'}</span></div></article>`;
  }
  function labelsA4Layout(prefs){
    const pageW=210,pageH=297,left=Math.max(0,prefs.marginLeft||0),right=Math.max(0,prefs.marginRight||0),top=Math.max(0,prefs.marginTop||0),bottom=Math.max(0,prefs.marginBottom||0);
    const gapHorizontal=Math.max(0,prefs.gapHorizontal||0),gapVertical=Math.max(0,prefs.gapVertical||0);
    const usableW=pageW-left-right,usableH=pageH-top-bottom;
    if(usableW<=0||usableH<=0)throw new Error('As margens ocupam toda a folha A4.');
    if(prefs.width>usableW+.001||prefs.height>usableH+.001)throw new Error('A etiqueta não cabe na área útil da folha A4 com essas margens.');
    const cols=Math.max(1,Math.floor((usableW+gapHorizontal)/(prefs.width+gapHorizontal)+1e-9));
    const rows=Math.max(1,Math.floor((usableH+gapVertical)/(prefs.height+gapVertical)+1e-9));
    return {pageW,pageH,left,right,top,bottom,gapHorizontal,gapVertical,usableW,usableH,cols,rows,perPage:cols*rows};
  }
  function labelsPreviewA4(items,prefs){
    const lay=labelsA4Layout(prefs),scale=2,totalPages=Math.max(1,Math.ceil(items.length/lay.perPage)),previewPages=Math.min(totalPages,3),pages=[];
    for(let pi=0;pi<previewPages;pi++){
      const chunk=items.slice(pi*lay.perPage,(pi+1)*lay.perPage),cards=[];
      chunk.forEach((p,i)=>{
        const col=i%lay.cols,row=Math.floor(i/lay.cols),x=lay.left+col*(prefs.width+lay.gapHorizontal),y=lay.top+row*(prefs.height+lay.gapVertical);
        cards.push(labelHtmlCard(p,prefs,{preview:true}).replace('class="labelCardPreview"',`class="labelCardPreview" style="left:${x*scale}px;top:${y*scale}px;width:${prefs.width*scale}px;height:${prefs.height*scale}px"`));
      });
      pages.push(`<section class="labelsPreviewPage" data-page-label="A4 · página ${pi+1}/${totalPages}"><div class="labelsPreviewMarginGuide" style="left:${lay.left*scale}px;top:${lay.top*scale}px;width:${lay.usableW*scale}px;height:${lay.usableH*scale}px"></div>${cards.join('')}</section>`);
    }
    return {html:pages.join(''),layout:lay,totalPages,previewPages};
  }
  function renderLabelsPreview(){
    const grid=$('labelsPreviewGrid'),sum=$('labelsSummary');if(!grid||!sum)return;
    grid.innerHTML='';
    try{
      const prefs=labelsSavePrefs(),items=labelsBuildItems(prefs),physical=prefs.mode==='group'?items.reduce((n,p)=>n+(p.qty||1),0):items.length;
      if(prefs.paper==='roll'){
        const first=items[0];grid.innerHTML=first?`<div class="labelsRollPreview">${labelHtmlCard(first,prefs,{preview:true})}</div>`:'';
        sum.innerHTML=`<strong>${items.length} etiqueta(s)</strong> · ${physical} peça(s) física(s) · ${nice(prefs.width)} × ${nice(prefs.height)} mm.<br>Prévia da etiquetadora: uma etiqueta por página.`;
      }else{
        const pv=labelsPreviewA4(items,prefs);
        grid.innerHTML=pv.html;
        sum.innerHTML=`<strong>${items.length} etiqueta(s)</strong> na impressão · ${physical} peça(s) física(s) · ${pv.layout.cols} coluna(s) × ${pv.layout.rows} linha(s) por A4 · ${pv.totalPages} página(s).<br>Margens A4: esquerda ${nice(prefs.marginLeft)} · direita ${nice(prefs.marginRight)} · cima ${nice(prefs.marginTop)} · baixo ${nice(prefs.marginBottom)} mm.<br>Entre etiquetas: horizontal ${nice(prefs.gapHorizontal)} mm · vertical ${nice(prefs.gapVertical)} mm${pv.totalPages>pv.previewPages?` · prévia mostrando ${pv.previewPages} página(s)`:''}.`;
      }
    }catch(err){sum.textContent=err.message||'Não foi possível gerar as etiquetas';grid.innerHTML='';}
  }
  function openLabelsDialog({scope=null}={}){
    $('morePanel').style.display='none';labelsApplyPrefs();if(scope&&$('labelsScope'))$('labelsScope').value=scope;$('labelsDialog').style.display='flex';renderLabelsPreview();
  }
  function closeLabelsDialog(){$('labelsDialog').style.display='none'}
  function labelsPrintDocument(items,prefs){
    const common=`*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}.printLabel{border:.25mm solid #111;padding:2.2mm;background:#fff;overflow:hidden;display:flex;flex-direction:column}.lpHead{display:flex;align-items:flex-start;gap:2mm;border-bottom:.6mm solid #111;padding-bottom:1mm}.lpCode{font-size:7mm;font-weight:900;line-height:1}.lpName{font-size:3.6mm;font-weight:900;line-height:1.05;flex:1;overflow:hidden}.lpQty{font-size:3mm;font-weight:900;border:.3mm solid #111;border-radius:1mm;padding:.5mm 1mm}.lpDims{font-size:4.5mm;font-weight:900;margin-top:1mm;white-space:nowrap}.lpMaterial{font-size:2.8mm;font-weight:800;margin-top:.6mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lpMeta{font-size:2.15mm;line-height:1.28;margin-top:.7mm;display:grid;grid-template-columns:1fr auto;gap:1.2mm}.lpGrain{font-size:5mm;font-weight:900}.lpEdges{display:grid;grid-template-columns:1fr 1fr;gap:.5mm;margin-top:.8mm}.lpEdge{font-size:1.9mm;border:.25mm solid #aaa;border-radius:.6mm;padding:.45mm .65mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.lpEdge.on{border:.55mm solid #111;font-weight:900;padding:.15mm .35mm}.lpFoot{margin-top:auto;border-top:.25mm solid #999;padding-top:.6mm;font-size:1.75mm;display:flex;justify-content:space-between;gap:1mm}.lpId{font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media print{.printLabel{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    if(prefs.paper==='roll'){
      const cards=items.map(p=>`<section class="rollPage">${labelHtmlCard(p,prefs).replace('class="printLabel"',`class="printLabel" style="width:${prefs.width}mm;height:${prefs.height}mm"`)}</section>`).join('');
      return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas · ${escapeHtml(ctx.currentProjectRecord?.name||'DesignLabMoveis')}</title><style>@page{size:${prefs.width}mm ${prefs.height}mm;margin:0}${common}.rollPage{width:${prefs.width}mm;height:${prefs.height}mm;break-after:page;page-break-after:always}.rollPage:last-child{break-after:auto;page-break-after:auto}</style></head><body>${cards}</body></html>`;
    }
    const lay=labelsA4Layout(prefs),totalPages=Math.max(1,Math.ceil(items.length/lay.perPage)),pages=[];
    for(let pi=0;pi<totalPages;pi++){
      const chunk=items.slice(pi*lay.perPage,(pi+1)*lay.perPage),cards=[];
      chunk.forEach((p,i)=>{
        const col=i%lay.cols,row=Math.floor(i/lay.cols),x=lay.left+col*(prefs.width+lay.gapHorizontal),y=lay.top+row*(prefs.height+lay.gapVertical);
        cards.push(labelHtmlCard(p,prefs).replace('class="printLabel"',`class="printLabel" style="position:absolute;left:${x}mm;top:${y}mm;width:${prefs.width}mm;height:${prefs.height}mm"`));
      });
      pages.push(`<section class="printPage">${cards.join('')}</section>`);
    }
    return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas · ${escapeHtml(ctx.currentProjectRecord?.name||'DesignLabMoveis')}</title><style>@page{size:A4 portrait;margin:0}${common}.printPage{position:relative;width:210mm;height:297mm;break-after:page;page-break-after:always;overflow:hidden}.printPage:last-child{break-after:auto;page-break-after:auto}</style></head><body>${pages.join('')}</body></html>`;
  }
  function labelsPrint(){
    try{
      const prefs=labelsSavePrefs(),items=labelsBuildItems(prefs),html=labelsPrintDocument(items,prefs),w=window.open('','_blank');
      if(!w){downloadText('etiquetas-designlab.html',html,'text/html;charset=utf-8');toast('O navegador bloqueou a janela de impressão · salvei o HTML das etiquetas');return;}
      w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>{try{w.print()}catch(_){}},350);
    }catch(err){toast(err.message||'Não foi possível imprimir as etiquetas')}
  }
  function labelsSaveHtml(){
    try{const prefs=labelsSavePrefs(),items=labelsBuildItems(prefs),html=labelsPrintDocument(items,prefs);downloadText(`${safeFileName(ctx.currentProjectRecord?.name||'projeto')}-etiquetas.html`,html,'text/html;charset=utf-8');toast('Arquivo de etiquetas salvo');}catch(err){toast(err.message||'Não foi possível salvar as etiquetas')}
  }
  
  function productionEditMaterialStock(){
    const m=productionMaterialById($('productionMaterialSelect')?.value);
    if(!m){toast('Selecione um material para editar as medidas');return;}
    productionLoadMaterialFields();
    const kind=productionMaterialKind(m);
    const target=kind==='wood'?$('productionMaterialStockLength'):kind==='metal'?$('productionMaterialStockLength'):$('productionMaterialSheetWidth');
    try{target?.focus();target?.select?.();}catch{}
    if(m.factory){
      toast('Edite as medidas e toque em Salvar material · será criada uma variação neste projeto');
    }else{
      toast('Edite as medidas e toque em Salvar material');
    }
  }
  
  function productionNewMaterial(){
    $('productionMaterialSelect').value='';
    $('productionMaterialThickness').disabled=false;
    $('productionMaterialThickness').title='';
    $('productionMaterialName').value='';
    $('productionMaterialCode').value='';
    if($('productionMaterialKind'))$('productionMaterialKind').value='sheet';
    $('productionMaterialThickness').value=18;
    $('productionMaterialSheetWidth').value=2750;
    $('productionMaterialSheetHeight').value=1850;
    if($('productionMaterialStockLength'))$('productionMaterialStockLength').value=6000;
    if($('productionMaterialStockWidth'))$('productionMaterialStockWidth').value=250;
    if($('productionMaterialProfileWidth'))$('productionMaterialProfileWidth').value=20;
    if($('productionMaterialProfileHeight'))$('productionMaterialProfileHeight').value=30;
    $('productionMaterialGrainDirection').value='length';
    $('productionMaterialColor').value='#e7e1d4';
    $('productionMaterialCoreColor').value='#c6a77b';
    $('productionMaterialGrain').checked=false;
    productionUpdateMaterialKindFields();
    $('productionMaterialName').focus();
  }
  function productionSaveMaterial(){
    const name=String($('productionMaterialName').value||'').trim();
    const productionKind=$('productionMaterialKind')?.value||'sheet';
    const thickness=parseDecimalInput($('productionMaterialThickness').value);
    const sheetWidth=parseDecimalInput($('productionMaterialSheetWidth').value),sheetHeight=parseDecimalInput($('productionMaterialSheetHeight').value);
    const stockLength=parseDecimalInput($('productionMaterialStockLength')?.value);
    const stockWidth=parseDecimalInput($('productionMaterialStockWidth')?.value);
    const profileWidth=parseDecimalInput($('productionMaterialProfileWidth')?.value),profileHeight=parseDecimalInput($('productionMaterialProfileHeight')?.value);
    if(!name){toast('Digite o nome do material');return;}
    if(!Number.isFinite(thickness)||thickness<=0){toast('Confira a espessura do material');return;}
    if(productionKind==='sheet'&&(!Number.isFinite(sheetWidth)||sheetWidth<100||!Number.isFinite(sheetHeight)||sheetHeight<100)){toast('Confira o tamanho da chapa');return;}
    if((productionKind==='wood'||productionKind==='metal')&&(!Number.isFinite(stockLength)||stockLength<100)){toast('Confira o comprimento da matéria-prima');return;}
    if(productionKind==='wood'&&(!Number.isFinite(stockWidth)||stockWidth<10)){toast('Confira a largura da prancha');return;}
    if(productionKind==='metal'&&(!(profileWidth>0)||!(profileHeight>0))){toast('Confira as medidas do perfil metálico');return;}
  
    const selectedId=$('productionMaterialSelect').value;
    let m=selectedId?productionMaterialById(selectedId):null;
    const factorySource=m?.factory?m:null;
    const editingFactory=!!factorySource;
    if(editingFactory)m=null;
    const categoryDefault=productionKind==='wood'?'Madeira maciça · Personalizada':productionKind==='metal'?'Ferro · Perfil metálico personalizado':'Personalizados';
    const data=normalizeProductionMaterial({
      id:m?.id||uid('mat'),
      name,
      code:$('productionMaterialCode').value,
      productionKind,
      thickness,
      sheetWidth:productionKind==='sheet'?sheetWidth:(Number.isFinite(stockLength)?stockLength:6000),
      sheetHeight:productionKind==='sheet'?sheetHeight:(productionKind==='wood'?(Number.isFinite(stockWidth)?stockWidth:250):(Number.isFinite(profileHeight)?profileHeight:30)),
      stockLength,
      stockWidth,
      profileWidth,
      profileHeight,
      grainDirection:$('productionMaterialGrainDirection').value==='width'?'width':'length',
      color:$('productionMaterialColor').value,
      coreColor:$('productionMaterialCoreColor').value,
      grain:productionKind==='metal'?false:$('productionMaterialGrain').checked,
      flexibleThickness:editingFactory?!!factorySource?.flexibleThickness:!!m?.flexibleThickness,
      category:m?.category||factorySource?.category||categoryDefault,
      pattern:m?.pattern||factorySource?.pattern||'',family:m?.family||factorySource?.family||'',factory:false
    });
  
    if(m)Object.assign(m,data);
    else{m=data;projectProduction.materials.push(m);}
  
    for(const o of runtimeModel.objects){
      if(o.userData?.materialId!==m.id)continue;
      o.userData.materialType=m.name;
      o.userData.materialCode=m.code;
      o.userData.materialGrain=!!m.grain;
      o.userData.materialCoreColor=m.coreColor;
      o.userData.baseColor=productionColorInt(m.color,COLORS.panel);
      restoreBaseColor(o);
    }
    if(ctx.selected&&!ctx.visualMode)setAllFaces(ctx.selected,COLORS.ctx.selected);
  
    productionRefreshCatalogSelects();
    $('productionMaterialSelect').value=m.id;
    productionLoadMaterialFields();
    productionRefreshSelectedPiece();
    commitHistory();
    const kindText=productionMaterialKindLabel(m);
    toast(editingFactory?`Material padrão copiado · ${kindText}`:(selectedId?`Material atualizado · ${kindText}`:`Material salvo · ${kindText}`));
  }
  function productionDeleteMaterial(){
    const id=$('productionMaterialSelect').value,m=productionMaterialById(id);if(!m)return;
    if(m.factory){toast('Este é um material padrão do aplicativo · crie um personalizado se quiser outra variação');return;}
    if(!window.confirm(`Excluir o material “${m.name}” da biblioteca do projeto? As peças mantêm o nome/cor atuais, mas deixam de ficar vinculadas ao cadastro.`))return;
    projectProduction.materials=projectProduction.materials.filter(x=>x.id!==id);
    for(const o of runtimeModel.objects){
      if(o.userData?.materialId!==id)continue;
      o.userData.materialId=null;
    }
    for(const root of runtimeModel.spaceRoots){
      if(root.defaultMaterialId===id)root.defaultMaterialId=null;
    }
    productionNewMaterial();productionRefreshDialog();renderSpaces();commitHistory();toast('Material removido da biblioteca e dos padrões de espaço');
  }
  function productionApplyMaterial(){
    if(!productionSelectedIsPiece()){toast('Selecione uma peça');return;}
    const m=productionMaterialById($('productionMaterialSelect').value);
    if(!m){toast('Selecione um material salvo');return;}
  
    productionApplyMaterialRecordToObject(ctx.selected,m,{keepSelection:true});
    updateInspector();productionRefreshSelectedPiece();commitHistory();
  
    const ti=pieceThicknessInfo(ctx.selected);
    const mismatch=!productionMaterialUsesPieceThickness(m)&&Math.abs(Number(m.thickness)-(ti?.thickness||0))>.2;
    toast(mismatch?`Material aplicado · atenção: peça ${nice(ti?.thickness||0)} mm / material ${nice(m.thickness)} mm`:`Material aplicado · ${nice(ti?.thickness||0)} mm`);
  }
  function productionNewBand(){
    $('productionBandSelect').value='';
    $('productionBandWidth').disabled=false;
    $('productionBandWidth').title='';
    $('productionBandName').value='';
    $('productionBandCode').value='';
    $('productionBandThickness').value='0,45';
    $('productionBandWidth').value=22;
    $('productionBandColor').value='#f5f5f2';
    $('productionBandName').focus();
  }
  function productionSaveBand(){
    const name=String($('productionBandName').value||'').trim();
    const thickness=parseDecimalInput($('productionBandThickness').value),width=parseDecimalInput($('productionBandWidth').value);
    if(!name){toast('Digite o nome da fita');return;}
    if(!(thickness>0&&width>0)){toast('Confira espessura e largura da fita');return;}
  
    const selectedId=$('productionBandSelect').value;
    let b=selectedId?productionBandById(selectedId):null;
    const editingFactory=!!b?.factory;
    if(editingFactory)b=null;
    const data=normalizeProductionBand({
      id:b?.id||uid('band'),name,code:$('productionBandCode').value,
      thickness,width,color:$('productionBandColor').value,
      category:b?.category||'Fitas personalizadas',family:b?.family||'',factory:false
    });
    if(b)Object.assign(b,data);
    else{b=data;projectProduction.edgeBands.push(b);}
  
    // Atualiza snapshots das peças que usam essa fita.
    for(const o of runtimeModel.objects){
      const bands=normalizePieceEdgeBands(o.userData?.edgeBands||{});
      let changed=false;
      for(const key of ['uMin','uMax','vMin','vMax']){
        if(bands[key]?.id===b.id){bands[key]=productionClone(b);changed=true;}
      }
      if(changed){o.userData.edgeBands=bands;restoreBaseColor(o);}
    }
    if(ctx.selected&&!ctx.visualMode)setAllFaces(ctx.selected,COLORS.ctx.selected);
  
    productionRefreshCatalogSelects();
    $('productionBandSelect').value=b.id;
    productionLoadBandFields();
    productionRefreshSelectedPiece();
    commitHistory();
    toast(editingFactory?'Fita padrão copiada como personalizada':(selectedId?'Fita atualizada':'Fita salva no projeto'));
  }
  function productionDeleteBand(){
    const id=$('productionBandSelect').value,b=productionBandById(id);if(!b)return;
    if(b.factory){toast('Esta é uma fita padrão do aplicativo · crie uma personalizada se precisar');return;}
    if(!window.confirm(`Excluir a fita “${b.name}”? As aplicações desta fita serão removidas das peças.`))return;
  
    projectProduction.edgeBands=projectProduction.edgeBands.filter(x=>x.id!==id);
    for(const o of runtimeModel.objects){
      const bands=normalizePieceEdgeBands(o.userData?.edgeBands||{});
      let changed=false;
      for(const key of ['uMin','uMax','vMin','vMax']){
        if(bands[key]?.id===id){delete bands[key];changed=true;}
      }
      if(changed){o.userData.edgeBands=bands;restoreBaseColor(o);}
    }
    if(ctx.selected&&!ctx.visualMode)setAllFaces(ctx.selected,COLORS.ctx.selected);
  
    productionNewBand();productionRefreshDialog();commitHistory();toast('Fita removida');
  }
  function productionAssignEdge(key,bandId){
    if(!productionSelectedIsPiece())return;
    const bands=normalizePieceEdgeBands(ctx.selected.userData?.edgeBands||{});
    if(!bandId)delete bands[key];
    else{
      const snap=productionBandSnapshotForPiece(bandId,ctx.selected);
      if(snap)bands[key]=snap;
    }
    ctx.selected.userData.edgeBands=bands;
    ctx.selected.userData.labelMeta={...(ctx.selected.userData.labelMeta||{}),schemaVersion:1,enabled:true};
    restoreBaseColor(ctx.selected);
    if(!ctx.visualMode)setAllFaces(ctx.selected,COLORS.ctx.selected);
    productionRefreshSelectedPiece();commitHistory();
  }
  function productionClearSelectedBands(){
    if(!productionSelectedIsPiece())return;
    ctx.selected.userData.edgeBands={};
    restoreBaseColor(ctx.selected);
    if(!ctx.visualMode)setAllFaces(ctx.selected,COLORS.ctx.selected);
    productionRefreshSelectedPiece();commitHistory();toast('Fitas removidas desta peça');
  }
  
  
  
  function fillSpaceMaterialSelect(select,preferredId=null,{allowNone=true}={}){
    if(!select)return;
    const old=canonicalFactoryMaterialId(preferredId??select.value);
    select.innerHTML='';
    if(allowNone){
      const none=document.createElement('option');
      none.value='';
      none.textContent='Sem material padrão';
      select.appendChild(none);
    }
    for(const m of projectProduction.materials){
      const op=document.createElement('option');
      op.value=m.id;
      op.textContent=`${m.name}${m.code?` · ${m.code}`:''} · ${nice(m.sheetWidth||2750)}×${nice(m.sheetHeight||1850)}${m.grain?` · veio ${m.grainDirection==='width'?'largura':'comprimento'}`:''}`;
      select.appendChild(op);
    }
    if(old&&[...select.options].some(o=>o.value===old))select.value=old;
    else if(!allowNone&&select.options.length)select.selectedIndex=0;
  }
  function preferredDefaultMaterialId(){
    const preferred=projectProduction.materials.find(m=>m.id===factoryMaterialId('mdf','branco-tx'))
      || projectProduction.materials.find(m=>m.category?.startsWith('MDF'))
      || projectProduction.materials[0];
    return preferred?.id||'';
  }
  function refreshSpaceMaterialSelects(){
    const newSel=$('spaceDefaultMaterial');
    if(newSel){
      const current=newSel.value;
      fillSpaceMaterialSelect(newSel,current,{allowNone:true});
    }
    const editSel=$('editSpaceDefaultMaterial');
    if(editSel){
      const current=editSel.value;
      fillSpaceMaterialSelect(editSel,current,{allowNone:true});
    }
    updateSpaceMaterialPreview();
    updateEditSpaceMaterialPreview();
  }
  function updateSpaceMaterialPreview(){
    const out=$('spaceDefaultMaterialPreview'),sel=$('spaceDefaultMaterial');
    if(!out||!sel)return;
    const m=productionMaterialById(sel.value);
    out.innerHTML=m
      ? `${productionMaterialUsesPieceThickness(m)?'Cada peça mantém a <strong>espessura que você definir nela</strong> e recebe automaticamente':`Novas peças de <strong>${nice(m.thickness)} mm</strong> recebem automaticamente`} <strong>${escapeHtml(m.name)}</strong>. Matéria-prima: <strong>${escapeHtml(productionMaterialStockText(m))}</strong>${m.grain?` · veio no <strong>${m.grainDirection==='width'?'sentido da largura':'sentido do comprimento'}</strong>`:''}.`
      : 'Sem padrão: as novas peças continuam com o material genérico até você aplicar um material manualmente.';
  }
  function updateEditSpaceMaterialPreview(){
    const out=$('editSpaceMaterialPreview'),sel=$('editSpaceDefaultMaterial');
    if(!out||!sel)return;
    const m=productionMaterialById(sel.value);
    const apply=$('editSpaceApplyMaterialExisting');
    if(apply)apply.disabled=!m;
    out.innerHTML=m
      ? `Padrão escolhido: <strong>${escapeHtml(m.name)}</strong>${productionMaterialUsesPieceThickness(m)?' · espessura de cada peça preservada':` · ${nice(m.thickness)} mm`}${m.code?` · ${escapeHtml(m.code)}`:''}.`
      : 'Este espaço ficará sem material padrão. Peças já existentes não serão alteradas.';
  }
  // ---- domínio extraído do runtime: linhas 11820-12208 ----
  const HARDWARE_PRESET_KEY='miniCadProV54_hardwarePresets';
  const HARDWARE_SCOPE_KEY='designLabHardwareScopeV1';
  let hardwareBuilderEditId=null;
  let hardwareBuilderScope='local';
  let hardwarePreviewOps=[];
  let hardwareScope=localStorage.getItem(HARDWARE_SCOPE_KEY)==='local'?'local':'global';
  const globalHardwareState={items:[],loaded:false,loading:false,error:''};
  
  function getHardwarePresets(){
    try{const a=JSON.parse(localStorage.getItem(HARDWARE_PRESET_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name):[];}catch(_){return [];}
  }
  function setHardwarePresets(a){localStorage.setItem(HARDWARE_PRESET_KEY,JSON.stringify(a));}
  function currentHardwarePresets(){return hardwareScope==='global'?globalHardwareState.items:getHardwarePresets();}
  function findHardwarePreset(id){
    if(hardwareScope==='global')return globalHardwareState.items.find(x=>x.id===id)||null;
    return getHardwarePresets().find(x=>x.id===id)||null;
  }
  async function loadGlobalHardwarePresets({force=false}={}){
    if(globalHardwareState.loading)return;
    if(globalHardwareState.loaded&&!force)return;
    if(!cloudAccountState.ok){
      globalHardwareState.error='Entre na sua conta para acessar as Ferragens globais.';
      globalHardwareState.loaded=false;refreshHardwarePresetSelect();return;
    }
    globalHardwareState.loading=true;globalHardwareState.error='';refreshHardwarePresetSelect();
    try{
      const data=await cloudApiFetch('/hardware/global',{timeoutMs:20000});
      globalHardwareState.items=Array.isArray(data?.items)?data.items.filter(x=>x&&x.id&&x.name):[];
      globalHardwareState.loaded=true;
    }catch(err){
      globalHardwareState.items=[];globalHardwareState.loaded=false;
      globalHardwareState.error=err.message||'Não foi possível carregar as Ferragens globais.';
    }finally{
      globalHardwareState.loading=false;refreshHardwarePresetSelect();
    }
  }
  function setHardwareScope(scope){
    hardwareScope=scope==='local'?'local':'global';
    localStorage.setItem(HARDWARE_SCOPE_KEY,hardwareScope);
    $('hardwareLocalTab')?.classList.toggle('active',hardwareScope==='local');
    $('hardwareGlobalTab')?.classList.toggle('active',hardwareScope==='global');
    refreshHardwarePresetSelect();
    if(hardwareScope==='global'&&!globalHardwareState.loaded&&!globalHardwareState.loading)loadGlobalHardwarePresets();
  }
  function objectBoundsMm(o){
    const u=o.userData;return {minX:mmPrec(o.position.x-u.width/2),maxX:mmPrec(o.position.x+u.width/2),minY:mmPrec(o.position.y-u.height/2),maxY:mmPrec(o.position.y+u.height/2),minZ:mmPrec(o.position.z-u.depth/2),maxZ:mmPrec(o.position.z+u.depth/2)};
  }
  function boundsAxisMin(b,a){return b[a==='x'?'minX':a==='y'?'minY':'minZ'];}
  function boundsAxisMax(b,a){return b[a==='x'?'maxX':a==='y'?'maxY':'maxZ'];}
  function tangentAxesForContact(a){return a==='x'?['y','z']:a==='y'?['x','z']:['x','y'];}
  function contactAxisName(a){return a==='x'?'X · esquerda/direita':a==='y'?'Y · baixo/cima':'Z · trás/frente';}
  function contactSideName(a,d){if(a==='x')return d<0?'esquerda':'direita';if(a==='y')return d<0?'baixo':'cima';return d<0?'trás':'frente';}
  function overlapMm(a0,a1,b0,b1){return Math.min(a1,b1)-Math.max(a0,b0);}
  function rawContactsForAxis(source,target,axis,tol){
    const sb=objectBoundsMm(source),tb=objectBoundsMm(target),[a1,a2]=tangentAxesForContact(axis);
    const ov1=overlapMm(boundsAxisMin(sb,a1),boundsAxisMax(sb,a1),boundsAxisMin(tb,a1),boundsAxisMax(tb,a1));
    const ov2=overlapMm(boundsAxisMin(sb,a2),boundsAxisMax(sb,a2),boundsAxisMin(tb,a2),boundsAxisMax(tb,a2));
    if(ov1<=.01||ov2<=.01)return [];
    const out=[];
    const gp=Math.abs(boundsAxisMax(sb,axis)-boundsAxisMin(tb,axis));
    const gn=Math.abs(boundsAxisMin(sb,axis)-boundsAxisMax(tb,axis));
    if(gp<=tol+.001)out.push({source,target,axis,dir:1,gap:gp,area:ov1*ov2});
    if(gn<=tol+.001)out.push({source,target,axis,dir:-1,gap:gn,area:ov1*ov2});
    return out;
  }
  function hardwareContacts(source,preset){
    if(!source)return [];
    const tol=Math.max(0,Math.min(20,Number(preset?.tolerance)||2));
    const candidates=runtimeModel.objects.filter(o=>o!==source&&o.visible!==false&&o.userData?.kind!=='cylinder'&&(!source.userData?.spaceRootId||!o.userData?.spaceRootId||o.userData.spaceRootId===source.userData.spaceRootId));
    let found=[];
    const axes=preset?.contactAxis&&preset.contactAxis!=='auto'?[preset.contactAxis]:['x','y','z'];
    for(const o of candidates)for(const a of axes)found.push(...rawContactsForAxis(source,o,a,tol));
    if((preset?.contactAxis||'auto')==='auto'&&found.length){
      // v63: o eixo automático não pode ser escolhido só pela quantidade de
      // peças encostando. Portas/fundo podem somar mais contatos que as laterais,
      // embora os pontos configurados da ferragem não caibam neles. Simulamos os
      // pontos em cada eixo e priorizamos o eixo que realmente produz mais pontos
      // válidos para as peças que serão furadas.
      const score={x:{validPoints:0,validContacts:0,n:0,a:0},y:{validPoints:0,validContacts:0,n:0,a:0},z:{validPoints:0,validContacts:0,n:0,a:0}};
      for(const c of found){
        const sc=score[c.axis];sc.n++;sc.a+=c.area;
        let valid=0;
        for(const w of hardwarePointWorlds(source,c,preset)){
          const srcOk=!preset.sourceEnabled||pointWithinPieceTangents(source,w,c.axis,.02);
          const tgtOk=!preset.targetEnabled||pointWithinPieceTangents(c.target,w,c.axis,.02);
          if(srcOk&&tgtOk)valid++;
        }
        if(valid){sc.validContacts++;sc.validPoints+=valid;}
      }
      const chosen=['x','y','z'].sort((a,b)=>
        (score[b].validPoints-score[a].validPoints)||
        (score[b].validContacts-score[a].validContacts)||
        (score[b].a-score[a].a)||
        (score[b].n-score[a].n)
      )[0];
      found=found.filter(c=>c.axis===chosen);
    }
    const side=preset?.contactSide||'both';
    if(side==='negative')found=found.filter(c=>c.dir<0);else if(side==='positive')found=found.filter(c=>c.dir>0);
    const seen=new Set();return found.filter(c=>{const k=`${runtimeModel.objects.indexOf(c.target)}|${c.axis}|${c.dir}`;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>a.dir-b.dir||a.gap-b.gap);
  }
  function anchoredWorldCoord(bounds,axis,anchor,offset){
    const lo=boundsAxisMin(bounds,axis),hi=boundsAxisMax(bounds,axis),base=anchor==='end'?hi:anchor==='center'?(lo+hi)/2:lo;return base+(Number(offset)||0);
  }
  function hardwarePointWorlds(source,contact,preset){
    const sb=objectBoundsMm(source),[a,b]=tangentAxesForContact(contact.axis);
    const wa=anchoredWorldCoord(sb,a,preset.aAnchor||'center',Number(preset.aOffset)||0);
    let bs=[];const mode=preset.bMode||'single';
    if(mode==='ends'){
      // Nunca deixe a distância das extremidades ultrapassar metade do vão.
      // Isso evita gerar dois pontos invertidos/fora da peça em contatos estreitos.
      const lo=boundsAxisMin(sb,b),hi=boundsAxisMax(sb,b),span=Math.max(0,hi-lo);
      const edge=Math.min(span/2,Math.max(0,Number(preset.bEdge)||0));
      bs=[lo+edge,hi-edge];if(Math.abs(bs[1]-bs[0])<.001)bs=[bs[0]];
    }else if(mode==='series'){
      const first=anchoredWorldCoord(sb,b,preset.bSeriesAnchor||'start',Number(preset.bSeriesOffset)||0),count=Math.max(1,Math.min(100,Math.round(Number(preset.bSeriesCount)||1))),step=Math.max(.001,Math.abs(Number(preset.bSeriesStep)||32)),dir=Number(preset.bSeriesDirection)<0?-1:1;for(let i=0;i<count;i++)bs.push(first+i*step*dir);
    }else bs=[anchoredWorldCoord(sb,b,preset.bAnchor||'center',Number(preset.bOffset)||0)];
    const normal=contact.dir>0?(boundsAxisMax(sb,contact.axis)+boundsAxisMin(objectBoundsMm(contact.target),contact.axis))/2:(boundsAxisMin(sb,contact.axis)+boundsAxisMax(objectBoundsMm(contact.target),contact.axis))/2;
    return bs.map(v=>{const p={x:0,y:0,z:0};p[contact.axis]=normal;p[a]=wa;p[b]=v;return p;});
  }
  function pointWithinPieceTangents(o,world,normalAxis,tol=.01){
    const b=objectBoundsMm(o);for(const a of tangentAxesForContact(normalAxis)){const v=world[a];if(v<boundsAxisMin(b,a)-tol||v>boundsAxisMax(b,a)+tol)return false;}return true;
  }
  function worldPointToLocalMm(o,p){const b=objectBoundsMm(o);return {x:p.x-b.minX,y:p.y-b.minY,z:p.z-b.minZ};}
  function hardwareHoleOp(owner,world,entryAxis,cfg,meta,instanceId){
    const ti=pieceThicknessInfo(owner),local=worldPointToLocalMm(owner,world),da=entryAxisName(entryAxis),sign=entryAxisSign(entryAxis);
    local[da]=sign>0?0:ti.dims[da];
    const maxDepth=ti.dims[da],depth=Math.max(.1,Math.min(Number(cfg.depth)||.1,maxDepth));
    return {id:uid('mach'),type:'hole',entryAxis,coordRef:{...local},x:local.x,y:local.y,z:local.z,through:false,diameter:Math.max(.1,Number(cfg.diameter)||5),depth,seriesEnabled:false,seriesCount:1,seriesStep:32,seriesAxis:ti.uAxis,seriesDirection:1,allowAnyEntryAxis:true,hardwareInstanceId:instanceId,hardwarePresetId:meta.presetId,hardwareName:meta.name,hardwareRole:meta.role,hardwareContactName:meta.contactName,hardwareSourcePartId:meta.sourcePartId||null,hardwareContactPartId:meta.contactPartId||null};
  }
  function hardwarePlan(source,preset,{instanceId=uid('hwinst')}={}){
    if(!source||!preset)throw new Error('Selecione uma peça e uma ferragem');
    if(!preset.sourceEnabled&&!preset.targetEnabled)throw new Error('A ferragem precisa furar pelo menos uma das peças');
    const contacts=hardwareContacts(source,preset);if(!contacts.length)throw new Error('Nenhuma peça em contato encontrada para esta regra');
    const operations=[],used=[];
    for(const c of contacts){
      const pts=hardwarePointWorlds(source,c,preset);let validCount=0;
      for(const w of pts){
        const srcOk=!preset.sourceEnabled||pointWithinPieceTangents(source,w,c.axis,.02),tgtOk=!preset.targetEnabled||pointWithinPieceTangents(c.target,w,c.axis,.02);
        if(!srcOk||!tgtOk)continue;
        validCount++;
        if(preset.sourceEnabled){const entry=c.dir>0?`-${c.axis}`:`+${c.axis}`;operations.push({owner:source,op:hardwareHoleOp(source,w,entry,{diameter:preset.sourceDiameter,depth:preset.sourceDepth},{presetId:preset.id,name:preset.name,role:'ctx.selected',contactName:c.target.userData?.name||'Contato',sourcePartId:source.userData?.partId||null,contactPartId:c.target.userData?.partId||null},instanceId)});}
        if(preset.targetEnabled){const entry=c.dir>0?`+${c.axis}`:`-${c.axis}`;operations.push({owner:c.target,op:hardwareHoleOp(c.target,w,entry,{diameter:preset.targetDiameter,depth:preset.targetDepth},{presetId:preset.id,name:preset.name,role:'contact',contactName:source.userData?.name||'Origem',sourcePartId:source.userData?.partId||null,contactPartId:c.target.userData?.partId||null},instanceId)});}
      }
      if(validCount)used.push({...c,points:validCount});
    }
    if(!operations.length)throw new Error('Nenhum ponto válido para esta ferragem. No modo Automático, confira as distâncias; ou escolha manualmente o eixo de contato.');
    return {instanceId,contacts:used,operations};
  }
  function refreshHardwarePresetSelect(keep=''){
    const sel=$('hardwarePresetSelect');if(!sel)return;
    const local=hardwareScope==='local',list=currentHardwarePresets();
    $('hardwareLocalTab')?.classList.toggle('active',local);
    $('hardwareGlobalTab')?.classList.toggle('active',!local);
    sel.innerHTML='';
    const e=document.createElement('option');e.value='';
    if(!local&&globalHardwareState.loading)e.textContent='Carregando ferragens globais…';
    else if(!local&&globalHardwareState.error)e.textContent='Ferragens globais indisponíveis';
    else e.textContent=list.length?'Escolha uma ferragem…':(local?'Nenhuma ferragem criada':'Nenhuma ferragem global publicada');
    sel.appendChild(e);
    for(const p of list){const o=document.createElement('option');o.value=p.id;o.textContent=(local?'':'🌐 ')+p.name;sel.appendChild(o);}
    if(list.some(p=>p.id===keep))sel.value=keep;
    updateHardwarePanel();
  }
  function updateHardwarePanel(){
    const p=findHardwarePreset($('hardwarePresetSelect')?.value),del=$('deleteHardwarePreset'),edit=$('editHardwarePreset'),create=$('createHardwarePreset'),publish=$('publishHardwarePreset');
    const local=hardwareScope==='local',admin=adminAllowed();
    if(create){create.disabled=!local&&!admin;create.textContent=local?'＋ Nova ferragem':'＋ Nova ferragem global';}
    if(edit)edit.disabled=!p||(!local&&!admin);
    if(del)del.disabled=!p||(!local&&!admin);
    if(publish){publish.style.display=local&&admin&&p?'inline-flex':'none';publish.disabled=!p;}
    if($('hardwareScopeLabel'))$('hardwareScopeLabel').textContent=local?'Minhas ferragens':'Ferragens globais';
    if($('hardwareScopeHint'))$('hardwareScopeHint').textContent=local
      ?(admin?'Ferragens da sua conta. Selecione uma e use “Publicar selecionada para todos” para disponibilizar globalmente.':'Ferragens pessoais salvas na sua conta e sincronizadas entre seus aparelhos.')
      :(admin?'Ferragens oficiais: você pode criar, editar e excluir. Todos os usuários conectados enxergam esta lista.':'Ferragens oficiais publicadas pelo administrador. Você pode aplicar normalmente, mas somente o administrador altera a lista.');
    const info=$('hardwarePresetInfo'),sum=$('hardwareContactSummary'),applied=$('hardwareAppliedInfo');if(!info||!sum)return;
    if(!p){
      if(!local&&globalHardwareState.loading){info.textContent='Carregando Ferragens globais…';sum.textContent='Aguarde o carregamento.';}
      else if(!local&&globalHardwareState.error){info.textContent=globalHardwareState.error;sum.textContent='Confira sua conexão e a configuração da API.';}
      else {info.textContent=local?'Crie uma ferragem definindo contato, posição e os furos de cada lado da união.':'Escolha uma Ferragem global publicada pelo administrador.';sum.textContent='Selecione uma ferragem.';}
      if(applied)applied.textContent=hardwareSourceHistoryText(ctx.selected);return;
    }
    const contacts=hardwareContacts(ctx.selected,p),axis=contacts[0]?.axis||(p.contactAxis==='auto'?'automático':p.contactAxis),[a,b]=tangentAxesForContact(axis==='auto'?'x':axis);
    info.textContent=`${!local?'GLOBAL · ':''}${p.name} · contato ${p.contactAxis==='auto'?'automático':contactAxisName(p.contactAxis)} · ${p.sourceEnabled?'fura selecionada':''}${p.sourceEnabled&&p.targetEnabled?' + ':''}${p.targetEnabled?'fura contato':''}.`;
    sum.textContent=contacts.length?`${contacts.length} contato(s) encontrado(s): ${contacts.map(c=>`${c.target.userData?.name||'Peça'} (${contactSideName(c.axis,c.dir)}, ${c.points||hardwarePointWorlds(ctx.selected,c,p).length} ponto(s))`).join(' · ')}. Eixos de posição: ${axisLabel(a)} e ${axisLabel(b)}.`:'Nenhum contato compatível encontrado com a peça selecionada. Confira eixo, lado e tolerância.';
    if(applied)applied.textContent=hardwareSourceHistoryText(ctx.selected);
  }
  function hardwareBuilderAxis(){
    let a=$('hardwareContactAxis')?.value||'auto';if(a!=='auto')return a;const tmp={contactAxis:'auto',contactSide:$('hardwareContactSide')?.value||'both',tolerance:Number($('hardwareContactTolerance')?.value)||2};return hardwareContacts(ctx.selected,tmp)[0]?.axis||'x';
  }
  function updateHardwareBuilderUi(){
    const axis=hardwareBuilderAxis(),[a,b]=tangentAxesForContact(axis);$('hardwareAxisALabel').textContent=`Posição no eixo ${axisLabel(a)}`;$('hardwareAxisBLabel').textContent=`Pontos no eixo ${axisLabel(b)}`;
    const mode=$('hardwareBMode').value;$('hardwareBSingleFields').style.display=mode==='single'?'grid':'none';$('hardwareBEndsFields').style.display=mode==='ends'?'block':'none';$('hardwareBSeriesFields').style.display=mode==='series'?'block':'none';
    const src=$('hardwareSourceEnabled').checked,tgt=$('hardwareTargetEnabled').checked;for(const id of ['hardwareSourceDiameter','hardwareSourceDepth'])$(id).disabled=!src;for(const id of ['hardwareTargetDiameter','hardwareTargetDepth'])$(id).disabled=!tgt;
    const p=readHardwareBuilder(false);if(p){const side=p.contactSide==='both'?'ambos os lados':p.contactSide==='negative'?'lado −':'lado +';$('hardwareBuilderPreview').textContent=`${p.name||'Ferragem'} · contato ${p.contactAxis==='auto'?'automático':axisLabel(p.contactAxis)} · ${side} · ${p.bMode==='ends'?'2 pontos nas extremidades':p.bMode==='series'?`${p.bSeriesCount} pontos em série`:'1 ponto'} · ${p.sourceEnabled?`selecionada Ø${nice(p.sourceDiameter)} × ${nice(p.sourceDepth)} mm`:''}${p.sourceEnabled&&p.targetEnabled?' · ':''}${p.targetEnabled?`contato Ø${nice(p.targetDiameter)} × ${nice(p.targetDepth)} mm`:''}`;}
  }
  function decimalFrom(id,def=0){const n=parseDecimalInput($(id)?.value);return Number.isFinite(n)?n:def;}
  function readHardwareBuilder(strict=true){
    const p={id:hardwareBuilderEditId||uid('hardware'),name:String($('hardwareName')?.value||'').trim(),contactAxis:$('hardwareContactAxis').value,contactSide:$('hardwareContactSide').value,tolerance:Number($('hardwareContactTolerance').value),aAnchor:$('hardwareAAnchor').value,aOffset:decimalFrom('hardwareAOffset',0),bMode:$('hardwareBMode').value,bAnchor:$('hardwareBAnchor').value,bOffset:decimalFrom('hardwareBOffset',0),bEdge:Number($('hardwareBEdge').value),bSeriesAnchor:$('hardwareBSeriesAnchor').value,bSeriesOffset:decimalFrom('hardwareBSeriesOffset',0),bSeriesCount:Number($('hardwareBSeriesCount').value),bSeriesStep:Number($('hardwareBSeriesStep').value),bSeriesDirection:Number($('hardwareBSeriesDirection').value)<0?-1:1,sourceEnabled:$('hardwareSourceEnabled').checked,sourceDiameter:Number($('hardwareSourceDiameter').value),sourceDepth:Number($('hardwareSourceDepth').value),targetEnabled:$('hardwareTargetEnabled').checked,targetDiameter:Number($('hardwareTargetDiameter').value),targetDepth:Number($('hardwareTargetDepth').value)};
    if(!strict)return p;if(!p.name)throw new Error('Digite um nome para a ferragem');if(!p.sourceEnabled&&!p.targetEnabled)throw new Error('Marque pelo menos uma peça para furar');if(!(p.tolerance>=0&&p.tolerance<=20))throw new Error('Confira a tolerância de contato');if(p.bMode==='ends'&&!(p.bEdge>=0))throw new Error('Confira a distância das extremidades');if(p.bMode==='series'&&(!(p.bSeriesCount>=1)||p.bSeriesCount>100||!(p.bSeriesStep>0)))throw new Error('Confira a série de pontos');for(const [on,d,dep,label] of [[p.sourceEnabled,p.sourceDiameter,p.sourceDepth,'peça selecionada'],[p.targetEnabled,p.targetDiameter,p.targetDepth,'peça de contato']])if(on&&(!(d>0)||!(dep>0)))throw new Error(`Confira diâmetro/profundidade da ${label}`);return p;
  }
  function openHardwareBuilder(existing=null){
    hardwareBuilderScope=hardwareScope;
    if(hardwareBuilderScope==='global'&&!adminAllowed()){toast('Somente o administrador pode criar ou editar Ferragens globais');return;}
    hardwareBuilderEditId=existing?.id||null;$('hardwareName').value=existing?.name||'Nova ferragem';$('hardwareContactAxis').value=existing?.contactAxis||'auto';$('hardwareContactSide').value=existing?.contactSide||'both';$('hardwareContactTolerance').value=existing?.tolerance??2;$('hardwareAAnchor').value=existing?.aAnchor||'center';$('hardwareAOffset').value=nice(existing?.aOffset??0);$('hardwareBMode').value=existing?.bMode||'single';$('hardwareBAnchor').value=existing?.bAnchor||'center';$('hardwareBOffset').value=nice(existing?.bOffset??50);$('hardwareBEdge').value=existing?.bEdge??50;$('hardwareBSeriesAnchor').value=existing?.bSeriesAnchor||'start';$('hardwareBSeriesOffset').value=nice(existing?.bSeriesOffset??50);$('hardwareBSeriesCount').value=existing?.bSeriesCount??2;$('hardwareBSeriesStep').value=existing?.bSeriesStep??100;$('hardwareBSeriesDirection').value=String(Number(existing?.bSeriesDirection)<0?-1:1);$('hardwareSourceEnabled').checked=!!existing?.sourceEnabled;$('hardwareSourceDiameter').value=existing?.sourceDiameter??8;$('hardwareSourceDepth').value=existing?.sourceDepth??20;$('hardwareTargetEnabled').checked=existing?.targetEnabled!==false;$('hardwareTargetDiameter').value=existing?.targetDiameter??5;$('hardwareTargetDepth').value=existing?.targetDepth??10;
    $('hardwareBuilderDialog').querySelector('h3').textContent=hardwareBuilderScope==='global'?'🌐 Criar / editar Ferragem global':'⚙ Criar ferragem';
    $('saveHardwareBuilder').textContent=hardwareBuilderScope==='global'?'Salvar para todos':'Salvar ferragem';
    updateHardwareBuilderUi();$('hardwareBuilderDialog').style.display='flex';
  }
  async function saveHardwareBuilder(){
    try{
      const p=readHardwareBuilder(true);
      if(hardwareBuilderScope==='global'){
        if(!adminAllowed())throw new Error('Somente o administrador pode salvar Ferragens globais.');
        let data;
        if(hardwareBuilderEditId){
          data=await cloudApiFetch(`/admin/hardware/global/${encodeURIComponent(hardwareBuilderEditId)}`,{method:'PUT',body:{preset:p},timeoutMs:20000});
        }else{
          data=await cloudApiFetch('/admin/hardware/global',{method:'POST',body:{preset:p},timeoutMs:20000});
        }
        $('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;
        await loadGlobalHardwarePresets({force:true});
        refreshHardwarePresetSelect(data?.item?.id||data?.preset?.id||'');
        toast('Ferragem global salva para todos');
        return;
      }
      const arr=getHardwarePresets(),i=arr.findIndex(x=>x.id===p.id);if(i>=0)arr[i]=p;else arr.push(p);setHardwarePresets(arr);
      $('hardwareBuilderDialog').style.display='none';hardwareBuilderEditId=null;refreshHardwarePresetSelect(p.id);toast('Ferragem salva');
    }catch(err){toast(err.message||'Não foi possível salvar a ferragem');}
  }
  async function publishSelectedHardwarePreset(){
    if(!adminAllowed()){toast('Somente o administrador pode publicar Ferragens globais');return;}
    const p=hardwareScope==='local'?findHardwarePreset($('hardwarePresetSelect')?.value):null;if(!p){toast('Selecione uma ferragem pessoal para publicar');return;}
    if(!window.confirm(`Publicar “${p.name}” para todas as contas?`))return;
    try{
      const data=await cloudApiFetch('/admin/hardware/global',{method:'POST',body:{preset:p},timeoutMs:20000});
      await loadGlobalHardwarePresets({force:true});setHardwareScope('global');refreshHardwarePresetSelect(data?.item?.id||'');toast('Ferragem publicada para todos');
    }catch(err){toast(err.message||'Não foi possível publicar a ferragem');}
  }
  function appliedHardwareStats(match){
    let operations=0,pieces=0,instances=new Set();
    for(const o of runtimeModel.objects){
      const arr=Array.isArray(o.userData?.machining)?o.userData.machining:[];
      const hits=arr.filter(match);
      if(hits.length){pieces++;operations+=hits.length;for(const op of hits)if(op.hardwareInstanceId)instances.add(op.hardwareInstanceId);}
    }
    return {operations,pieces,instances};
  }
  function hardwareInstanceSummary(instanceId){
    let operations=0;const pieces=new Set();let name='Ferragem',presetId='',sourcePartId='';
    for(const o of runtimeModel.objects){
      for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
        if(op?.hardwareInstanceId!==instanceId)continue;
        operations++;pieces.add(o);name=op.hardwareName||name;presetId=op.hardwarePresetId||presetId;sourcePartId=op.hardwareSourcePartId||sourcePartId;
      }
    }
    return {instanceId,operations,pieces:pieces.size,name,presetId,sourcePartId};
  }
  function hardwareSourceApplications(source){
    const partId=String(source?.userData?.partId||'');if(!partId)return [];
    const ids=new Set();
    for(const o of runtimeModel.objects)for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
      if(op?.hardwareInstanceId&&String(op.hardwareSourcePartId||'')===partId)ids.add(op.hardwareInstanceId);
    }
    return [...ids].map(hardwareInstanceSummary).filter(x=>x.operations>0);
  }
  function hardwareSourceHistoryText(source){
    const list=hardwareSourceApplications(source);
    if(!list.length)return 'Nenhuma ferragem aplicada a partir desta peça.';
    return `Ferragens aplicadas a partir desta peça: ${list.map(x=>`${x.name} (${x.operations} furo(s) / ${x.pieces} peça(s))`).join(' · ')}`;
  }
  function hardwareInstancesForSourcePreset(source,presetId){
    const partId=String(source?.userData?.partId||'');const ids=new Set();if(!partId||!presetId)return ids;
    for(const o of runtimeModel.objects)for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
      if(op?.hardwareInstanceId&&op.hardwarePresetId===presetId&&String(op.hardwareSourcePartId||'')===partId)ids.add(op.hardwareInstanceId);
    }
    return ids;
  }
  function refreshAfterHardwareRemoval(){
    clearMachiningDraftPreview();hardwarePreviewOps=[];ctx.machiningPreviewActive=false;ctx.machiningPreviewOwner=null;
    runtimeModel.machiningVisualGroup.visible=cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive;$('machining3DPreviewBar').style.display='none';
    renderMachiningVisuals();renderMachiningList();updateInspector();updateHardwarePanel();
  }
  function removeAppliedHardware(match,{refresh=true}={}){
    let removed=0,pieces=0;
    for(const o of runtimeModel.objects){
      const arr=Array.isArray(o.userData?.machining)?o.userData.machining:null;if(!arr)continue;
      const keep=arr.filter(op=>!match(op)),n=arr.length-keep.length;
      if(n){removed+=n;pieces++;o.userData.machining=keep;}
    }
    if(refresh)refreshAfterHardwareRemoval();
    return {removed,pieces};
  }
  function removeHardwareInstances(ids,{refresh=true}={}){
    const set=ids instanceof Set?ids:new Set(Array.isArray(ids)?ids:[ids]);
    return removeAppliedHardware(op=>op?.hardwareInstanceId&&set.has(op.hardwareInstanceId),{refresh});
  }
  function deleteHardwareInstance(instanceId,name='Ferragem'){
    const st=hardwareInstanceSummary(instanceId);if(!st.operations)return;
    if(!window.confirm(`Excluir a ferragem aplicada “${name||st.name}” inteira?
  
  Serão removidas ${st.operations} furação(ões) de ${st.pieces} peça(s) vinculada(s) a esta aplicação.`))return;
    removeHardwareInstances(new Set([instanceId]),{refresh:true});
    commitHistory();toast(`${name||st.name} removida por completo`);
  }
  
  // 1.100.96 — ciclo de vida das ferragens.
  // Uma aplicação de ferragem pode gerar furos em duas ou mais peças. Se uma
  // dessas peças for apagada, toda a aplicação ligada a ela deve desaparecer,
  // inclusive os marcadores 3D que pertencem às peças de contato.
  function hardwareInstancesLinkedToObjects(doomed){
    const list=(Array.isArray(doomed)?doomed:[doomed]).filter(Boolean);
    const partIds=new Set(list.map(o=>String(o.userData?.partId||'')).filter(Boolean));
    const names=new Set(list.map(o=>String(o.userData?.name||'').trim()).filter(Boolean));
    const ids=new Set();
  
    for(const o of list){
      for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
        if(op?.hardwareInstanceId)ids.add(op.hardwareInstanceId);
      }
    }
  
    for(const o of runtimeModel.objects){
      for(const op of (Array.isArray(o.userData?.machining)?o.userData.machining:[])){
        if(!op?.hardwareInstanceId)continue;
        const src=String(op.hardwareSourcePartId||''),contact=String(op.hardwareContactPartId||'');
        if((src&&partIds.has(src))||(contact&&partIds.has(contact))){ids.add(op.hardwareInstanceId);continue;}
        if(!src&&!contact&&names.has(String(op.hardwareContactName||'').trim()))ids.add(op.hardwareInstanceId);
      }
    }
    return ids;
  }
  function removeHardwareLinkedToObjects(doomed,{refresh=false}={}){
    const ids=hardwareInstancesLinkedToObjects(doomed);
    let operations=0,pieces=0;
    if(ids.size){
      const r=removeHardwareInstances(ids,{refresh:false});operations=r.removed;pieces=r.pieces;
    }
    clearMachiningDraftPreview();hardwarePreviewOps=[];ctx.machiningPreviewActive=false;ctx.machiningPreviewOwner=null;
    runtimeModel.machiningVisualGroup.visible=cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive;$('machining3DPreviewBar').style.display='none';
    if(refresh)refreshAfterHardwareRemoval();
    return {instances:ids.size,operations,pieces};
  }
  async function deleteSelectedHardwarePreset(){
    const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(!p)return;
    if(hardwareScope==='global'){
      if(!adminAllowed()){toast('Somente o administrador pode excluir Ferragens globais');return;}
      if(!window.confirm(`Excluir a Ferragem global “${p.name}”?
  
  Ela deixará de aparecer para todos. Ferragens já aplicadas em projetos existentes não serão alteradas.`))return;
      try{
        await cloudApiFetch(`/admin/hardware/global/${encodeURIComponent(p.id)}`,{method:'DELETE',body:{},timeoutMs:20000});
        await loadGlobalHardwarePresets({force:true});refreshHardwarePresetSelect();toast('Ferragem global excluída');
      }catch(err){toast(err.message||'Não foi possível excluir a Ferragem global');}
      return;
    }
    const st=appliedHardwareStats(op=>op.hardwarePresetId===p.id);
    const msg=st.operations
      ?`Excluir a ferragem “${p.name}”?
  
  Ela está aplicada em ${st.pieces} peça(s), com ${st.operations} furação(ões). Ao excluir, essas furações também serão removidas do projeto e do desenho 3D.`
      :`Excluir a ferragem “${p.name}” da biblioteca?`;
    if(!window.confirm(msg))return;
    if(st.operations)removeAppliedHardware(op=>op.hardwarePresetId===p.id,{refresh:true});
    setHardwarePresets(getHardwarePresets().filter(x=>x.id!==p.id));refreshHardwarePresetSelect();commitHistory();
    toast(st.operations?`Ferragem excluída · ${st.operations} furação(ões) removida(s)`:'Ferragem excluída da biblioteca');
  }
  function renderHardwarePreviewOps(plan){
    clearMachiningDraftPreview();hardwarePreviewOps=plan.operations;
    for(const x of plan.operations){const mat=new THREE.MeshBasicMaterial({color:0xffc83d,transparent:true,opacity:.82,depthTest:false,depthWrite:false}),v=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,32),mat);v.userData={machiningOwner:x.owner,machiningOp:x.op,machiningPoint:null};v.renderOrder=100;runtimeModel.machiningDraftPreviewGroup.add(v);}updateDraftPreviewTransforms();
  }
  function focusHardwarePlan(plan){
    const set=[...new Set(plan.operations.map(x=>x.owner))];if(!set.length)return;returnTo3D({restore:false,notify:false});const box=new THREE.Box3();for(const o of set){o.updateMatrixWorld(true);box.expandByObject(o);}const center=new THREE.Vector3(),size=new THREE.Vector3();box.getCenter(center);box.getSize(size);const span=Math.max(size.x,size.y,size.z,.3),dist=span*2.2;perspectiveCamera.position.set(center.x+dist*.7,center.y+dist*.55,center.z+dist*.85);controls.target.copy(center);perspectiveCamera.lookAt(center);controls.update();
  }
  function previewHardware3D(){try{const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(!p)throw new Error('Escolha uma ferragem');const plan=hardwarePlan(ctx.selected,p,{instanceId:'preview'});renderHardwarePreviewOps(plan);ctx.machiningPreviewOwner=ctx.selected;ctx.machiningPreviewActive=true;runtimeModel.machiningVisualGroup.visible=false;$('machiningDialog').style.display='none';$('machining3DPreviewBar').style.display='flex';setDesignLabVisualizationOnly(true);$('machining3DPreviewInfo').textContent=`${p.name} · ${plan.contacts.length} contato(s) · ${plan.operations.length} furação(ões) · ainda não salvo`;focusHardwarePlan(plan);toast('Prévia 3D · amarelo = furos da ferragem');}catch(err){clearMachiningDraftPreview();ctx.machiningPreviewActive=false;runtimeModel.machiningVisualGroup.visible=cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive;setDesignLabVisualizationOnly(false);toast(err.message||'Não foi possível visualizar a ferragem');}}
  function applySelectedHardware(){
    clearMachiningDraftPreview();runtimeModel.machiningVisualGroup.visible=cadMachiningVisible&&!ctx.visualMode&&!ctx.machiningPreviewActive;$('machining3DPreviewBar').style.display='none';
    try{
      const p=findHardwarePreset($('hardwarePresetSelect')?.value);if(!p)throw new Error('Escolha uma ferragem');
      const oldIds=hardwareInstancesForSourcePreset(ctx.selected,p.id);
      const plan=hardwarePlan(ctx.selected,p);
      if(oldIds.size)removeHardwareInstances(oldIds,{refresh:false});
      for(const x of plan.operations){const arr=x.owner.userData.machining||(x.owner.userData.machining=[]);arr.push(x.op);sanitizeMachiningForPiece(x.owner);}
      renderMachiningVisuals();updateInspector();commitHistory();updateHardwarePanel();renderMachiningList();
      toast(`${p.name} ${oldIds.size?'atualizada':'aplicada'} · ${plan.operations.length} furação(ões)`);
    }catch(err){toast(err.message||'Não foi possível aplicar a ferragem');}
  }
  function fillHardwareShelfPinExample(){hardwareBuilderEditId=null;$('hardwareName').value='Pino de prateleira';$('hardwareContactAxis').value='x';$('hardwareContactSide').value='both';$('hardwareContactTolerance').value=2;$('hardwareAAnchor').value='start';$('hardwareAOffset').value='-5';$('hardwareBMode').value='ends';$('hardwareBEdge').value=50;$('hardwareSourceEnabled').checked=false;$('hardwareTargetEnabled').checked=true;$('hardwareTargetDiameter').value=5;$('hardwareTargetDepth').value=10;updateHardwareBuilderUi();}
  function fillHardwareDowelExample(){hardwareBuilderEditId=null;$('hardwareName').value='Cavilha base/lateral';$('hardwareContactAxis').value='x';$('hardwareContactSide').value='both';$('hardwareContactTolerance').value=2;$('hardwareAAnchor').value='center';$('hardwareAOffset').value='0';$('hardwareBMode').value='ends';$('hardwareBEdge').value=50;$('hardwareSourceEnabled').checked=true;$('hardwareSourceDiameter').value=8;$('hardwareSourceDepth').value=20;$('hardwareTargetEnabled').checked=true;$('hardwareTargetDiameter').value=8;$('hardwareTargetDepth').value=15;updateHardwareBuilderUi();}
  // ---- domínio extraído do runtime: linhas 13447-13592 ----
  const hardwareCopyState={active:false,phase:'source',source:null,targets:new Set(),helpers:null,mirrorFace:false};
  
  function hardwareCopyPieceEligible(o){return shapeCopyPieceEligible(o);}
  function hardwareCopyOpsOnPiece(o){
    if(!hardwareCopyPieceEligible(o))return [];
    return (Array.isArray(o.userData?.machining)?o.userData.machining:[]).filter(op=>op&&op.hardwareInstanceId);
  }
  function hardwareCopySourceHasHardware(o){return hardwareCopyOpsOnPiece(o).length>0;}
  function hardwareCopyGroups(o){
    const m=new Map();
    for(const op of hardwareCopyOpsOnPiece(o)){
      const id=String(op.hardwareInstanceId||uid('hwsrc'));
      if(!m.has(id))m.set(id,[]);
      m.get(id).push(op);
    }
    return [...m.entries()].map(([instanceId,ops])=>({instanceId,ops,name:ops.find(x=>x.hardwareName)?.hardwareName||'Ferragem'}));
  }
  function hardwareCopyDisposeHelpers(){
    const g=hardwareCopyState.helpers;if(!g)return;
    g.traverse?.(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.();});
    scene.remove(g);hardwareCopyState.helpers=null;
  }
  function hardwareCopyRefreshHelpers(){
    hardwareCopyDisposeHelpers();if(!hardwareCopyState.active)return;
    const g=new THREE.Group();g.userData.isHardwareCopyHelper=true;
    if(hardwareCopyState.source&&runtimeModel.objects.includes(hardwareCopyState.source)){
      const h=new THREE.BoxHelper(hardwareCopyState.source,0xffc83d);h.userData.isHardwareCopyHelper=true;g.add(h);
    }
    for(const o of hardwareCopyState.targets){
      if(!runtimeModel.objects.includes(o))continue;
      const h=new THREE.BoxHelper(o,0x7fe594);h.userData.isHardwareCopyHelper=true;g.add(h);
    }
    scene.add(g);hardwareCopyState.helpers=g;
  }
  function hardwareCopyEnsureBar(){
    let bar=document.getElementById('hardwareCopyBar');if(bar)return bar;
    bar=document.createElement('div');bar.id='hardwareCopyBar';bar.className='shapeCopyBar';
    bar.innerHTML=`<div class="shapeCopyBarText"><strong>⧉ Copiar Ferragens</strong><span id="hardwareCopyBarStatus"></span></div><div class="shapeCopyBarActions"><button id="hardwareCopyChangeSource" class="secondary">Trocar origem</button><button id="hardwareCopyMirror" class="secondary">Face: igual</button><button id="hardwareCopyApplyBtn">Aplicar</button><button id="hardwareCopyCancelBtn" class="secondary">Cancelar</button></div>`;
    document.body.appendChild(bar);
    bar.querySelector('#hardwareCopyChangeSource').onclick=hardwareCopyChooseSourceAgain;
    bar.querySelector('#hardwareCopyMirror').onclick=()=>{hardwareCopyState.mirrorFace=!hardwareCopyState.mirrorFace;hardwareCopyUpdateBar();toast(hardwareCopyState.mirrorFace?'Face de entrada será invertida nos destinos':'Face de entrada será mantida igual à origem');};
    bar.querySelector('#hardwareCopyApplyBtn').onclick=hardwareCopyApplyBatch;
    bar.querySelector('#hardwareCopyCancelBtn').onclick=()=>closeCopyHardwareTool(true);
    return bar;
  }
  function hardwareCopyUpdateBar(){
    const bar=hardwareCopyEnsureBar(),status=bar.querySelector('#hardwareCopyBarStatus'),apply=bar.querySelector('#hardwareCopyApplyBtn'),change=bar.querySelector('#hardwareCopyChangeSource'),mirror=bar.querySelector('#hardwareCopyMirror');
    bar.style.display=hardwareCopyState.active?'flex':'none';if(!hardwareCopyState.active)return;
    mirror.textContent=hardwareCopyState.mirrorFace?'Face: espelhada':'Face: igual';
    if(hardwareCopyState.phase==='source'){
      status.textContent='Toque na peça que contém as ferragens que serão copiadas.';apply.disabled=true;apply.textContent='Aplicar';change.style.display='none';mirror.style.display='none';
    }else{
      const ops=hardwareCopyOpsOnPiece(hardwareCopyState.source),apps=hardwareCopyGroups(hardwareCopyState.source),n=hardwareCopyState.targets.size,name=hardwareCopyState.source?.userData?.name||'Peça origem';
      status.textContent=`Origem: ${name} · ${apps.length} ferragem(ns) / ${ops.length} operação(ões) · marque os destinos · ${n} selecionada(s).`;
      apply.disabled=n===0;apply.textContent=n?`Aplicar em ${n}`:'Aplicar';change.style.display='inline-flex';mirror.style.display='inline-flex';
    }
  }
  function hardwareCopyChooseSourceAgain(){
    hardwareCopyState.phase='source';hardwareCopyState.source=null;hardwareCopyState.targets.clear();hardwareCopyRefreshHelpers();hardwareCopyUpdateBar();toast('Selecione a peça de origem das ferragens');
  }
  function openCopyHardwareTool(){
    if(typeof closeCopyShapeTool==='function'&&typeof ctx.shapeCopyState!=='undefined'&&ctx.shapeCopyState.active)closeCopyShapeTool(false);
    if(ctx.visualMode)setVisualMode(false,{notify:false,frame:false});
    const dlg=$('machiningDialog');if(dlg)dlg.style.display='none';
    setTool('select');hardwareCopyState.active=true;hardwareCopyState.targets.clear();hardwareCopyState.mirrorFace=false;
    if(hardwareCopySourceHasHardware(ctx.selected)){hardwareCopyState.source=ctx.selected;hardwareCopyState.phase='targets';toast('Origem definida. Selecione as peças destino.');}
    else{hardwareCopyState.source=null;hardwareCopyState.phase='source';toast('Selecione a peça que contém as ferragens a copiar');}
    hardwareCopyRefreshHelpers();hardwareCopyUpdateBar();
  }
  function closeCopyHardwareTool(notify=false){
    if(!hardwareCopyState.active)return;
    hardwareCopyState.active=false;hardwareCopyState.phase='source';hardwareCopyState.source=null;hardwareCopyState.targets.clear();hardwareCopyState.mirrorFace=false;
    hardwareCopyDisposeHelpers();const bar=document.getElementById('hardwareCopyBar');if(bar)bar.style.display='none';if(notify)toast('Copiar Ferragens cancelado');
  }
  function hardwareCopyHandlePick(){
    if(!hardwareCopyState.active)return false;
    runtimeModel.raycaster.setFromCamera(runtimeModel.pointer,ctx.camera);const hits=runtimeModel.raycaster.intersectObjects(referenceMeshes(),false);
    const obj=hits.map(h=>h.object).find(o=>hardwareCopyPieceEligible(o));
    if(!obj){toast(hardwareCopyState.phase==='source'?'Toque em uma peça que tenha ferragens':'Toque em uma peça plana para marcar como destino');return true;}
    if(hardwareCopyState.phase==='source'){
      if(!hardwareCopySourceHasHardware(obj)){toast('Essa peça ainda não possui ferragens para copiar');return true;}
      hardwareCopyState.source=obj;hardwareCopyState.phase='targets';hardwareCopyState.targets.clear();selectObject(obj);hardwareCopyRefreshHelpers();hardwareCopyUpdateBar();toast('Origem definida. Agora selecione uma ou várias peças destino.');return true;
    }
    if(obj===hardwareCopyState.source){toast('Esta é a peça de origem');return true;}
    if(hardwareCopyState.targets.has(obj))hardwareCopyState.targets.delete(obj);else hardwareCopyState.targets.add(obj);
    hardwareCopyRefreshHelpers();hardwareCopyUpdateBar();return true;
  }
  function hardwareCopyAxisMap(srcTi,dstTi,axis){
    if(axis===srcTi.thicknessAxis)return dstTi.thicknessAxis;
    if(axis===srcTi.uAxis)return dstTi.uAxis;
    if(axis===srcTi.vAxis)return dstTi.vAxis;
    return axis;
  }
  function hardwareCopyClampRawRef(raw,dim,margin=0){
    raw=Number(raw);dim=Math.max(0,Number(dim)||0);margin=Math.max(0,Math.min(Number(margin)||0,dim/2));
    if(!Number.isFinite(raw))raw=0;
    if(raw<0){const real=Math.max(margin,Math.min(dim+raw,dim-margin));return roundMmNumber(real-dim,3);}
    return roundMmNumber(Math.max(margin,Math.min(raw,dim-margin)),3);
  }
  function hardwareCopyMappedOp(source,target,srcOp,newInstanceId,{mirrorFace=false}={}){
    const srcTi=pieceThicknessInfo(source),dstTi=pieceThicknessInfo(target);if(!srcTi||!dstTi)return null;
    const op=shapeDeepClone(srcOp),axisMap={};for(const a of ['x','y','z'])axisMap[a]=hardwareCopyAxisMap(srcTi,dstTi,a);
    const mappedRef={x:0,y:0,z:0};
    for(const a of ['x','y','z'])mappedRef[axisMap[a]]=machiningRawCoord(srcOp,a);
    op.id=uid('mach');op.hardwareInstanceId=newInstanceId;op.coordRef=mappedRef;
    const srcEntry=entryAxisName(srcOp.entryAxis),dstEntry=axisMap[srcEntry]||dstTi.thicknessAxis;
    let sign=entryAxisSign(srcOp.entryAxis);if(mirrorFace)sign*=-1;op.entryAxis=`${sign<0?'-':'+'}${dstEntry}`;
    if(srcOp.seriesAxis)op.seriesAxis=axisMap[srcOp.seriesAxis]||dstTi.uAxis;
    if(srcOp.lengthAxis)op.lengthAxis=axisMap[srcOp.lengthAxis]||dstTi.uAxis;
    op.hardwareSourcePartId=target.userData?.partId||null;op.hardwareContactPartId=null;
    op.hardwareCopiedFromPartId=source.userData?.partId||null;op.hardwareCopiedFromInstanceId=srcOp.hardwareInstanceId||null;op.hardwareCopiedDetached=true;
    const r=op.type==='hole'?Math.max(0,(Number(op.diameter)||0)/2):0;
    for(const a of ['x','y','z']){
      if(a===dstEntry){op.coordRef[a]=0;continue;}
      op.coordRef[a]=hardwareCopyClampRawRef(op.coordRef[a],dstTi.dims[a],r);
    }
    for(const a of ['x','y','z'])op[a]=Number(op.coordRef[a])||0;
    return op;
  }
  function hardwareCopySignature(owner,op){
    const r=resolvedMachiningCoords(owner,op),v=n=>roundMmNumber(Number(n)||0,2);
    return [op.hardwarePresetId||'',op.hardwareName||'',op.type||'',op.entryAxis||'',v(r.x),v(r.y),v(r.z),v(op.diameter),v(operationDepthMm(owner,op)),op.lengthAxis||'',v(op.length),v(op.width)].join('|');
  }
  function hardwareCopyApplyBatch(){
    const source=hardwareCopyState.source,targets=[...hardwareCopyState.targets].filter(hardwareCopyPieceEligible),groups=hardwareCopyGroups(source);
    if(!hardwareCopySourceHasHardware(source)){toast('Selecione novamente a peça de origem');hardwareCopyChooseSourceAgain();return;}
    if(!targets.length){toast('Selecione pelo menos uma peça destino');return;}
    hardwareCopyDisposeHelpers();let piecesDone=0,added=0,duplicates=0;
    for(const target of targets){
      const arr=target.userData.machining||(target.userData.machining=[]),existing=new Set(arr.filter(op=>op?.hardwareInstanceId).map(op=>hardwareCopySignature(target,op)));let targetAdded=0;
      for(const group of groups){
        const newInstanceId=uid('hwinst');
        for(const srcOp of group.ops){
          const op=hardwareCopyMappedOp(source,target,srcOp,newInstanceId,{mirrorFace:hardwareCopyState.mirrorFace});if(!op)continue;
          arr.push(op);sanitizeMachiningForPiece(target);
          const sig=hardwareCopySignature(target,op);
          if(existing.has(sig)){const i=arr.indexOf(op);if(i>=0)arr.splice(i,1);duplicates++;continue;}
          existing.add(sig);targetAdded++;added++;
        }
      }
      if(targetAdded)piecesDone++;
    }
    renderMachiningVisuals();renderMachiningList();updateInspector?.();updateHardwarePanel?.();commitHistory();
    const mirrored=hardwareCopyState.mirrorFace;closeCopyHardwareTool(false);
    toast(`Ferragens copiadas para ${piecesDone} peça(s) · ${added} operação(ões)${duplicates?` · ${duplicates} duplicada(s) ignorada(s)`:''}${mirrored?' · face espelhada':''}`);
  }
  const state={get projectProduction(){return projectProduction;}, set projectProduction(value){projectProduction=value;},get hardwareBuilderEditId(){return hardwareBuilderEditId;}, set hardwareBuilderEditId(value){hardwareBuilderEditId=value;},get hardwarePreviewOps(){return hardwarePreviewOps;}, set hardwarePreviewOps(value){hardwarePreviewOps=value;},get hardwareScope(){return hardwareScope;}, set hardwareScope(value){hardwareScope=value;},get hardwareCopyState(){return hardwareCopyState;}};
  return { state, factoryMaterialId, factoryBandId, factoryBandFamily, canonicalFactoryMaterialId, canonicalFactoryBandId, buildFactoryProductionCatalog, defaultProjectProduction, productionClone, productionColor, productionColorInt, inferProductionKind, normalizeProductionMaterial, normalizeProductionBand, ensureFactoryProductionCatalog, setProjectProductionState, mergeProjectProductionState, captureProductionState, productionMaterialById, productionBandById, productionMaterialUsesPieceThickness, productionMaterialKind, productionMaterialKindLabel, productionMaterialStockText, productionObjectKind, productionMaterialEffectiveThickness, productionBandSnapshot, productionBandSnapshotForPiece, normalizePieceEdgeBands, boxFaceMaterialIndex, pieceEdgeFaceDefinitions, pieceEdgeDisplayDefinitions, applyPieceProductionEdgeColors, pieceEdgeBandSignature, pieceEdgeBandSummary, spaceDefaultMaterial, productionApplyMaterialRecordToObject, applySpaceDefaultMaterialToObject, spaceEligibleProductionPieces, applySpaceMaterialToExistingPieces, spaceMaterialText, normalizePieceGrainRotation, pieceGrainRotation, pieceProductionLabelData, makeMaterials, pieceNameCustomPresets, savePieceNameCustomPresets, refreshPieceNamePresetSelect, applyPieceNamePreset, createPieceNamePreset, pieceMaterialBandFor, materialSearchText, fillPieceMaterialSelect, updatePieceMaterialQuickInfo, applySelectedPieceMaterialFromInspector, productionFillSelect, productionSelectedIsPiece, productionUpdateMaterialKindFields, productionLoadMaterialFields, productionLoadBandFields, productionRefreshCatalogSelects, productionRefreshSelectedPiece, productionRefreshDialog, openProductionDialog, closeProductionDialog, labelsPrefs, labelsSavePrefs, labelsApplyPrefs, labelsSourceParts, labelsSignature, labelsBuildItems, labelMachiningStats, labelEdgeData, labelCodeText, labelHtmlCard, labelsA4Layout, labelsPreviewA4, renderLabelsPreview, openLabelsDialog, closeLabelsDialog, labelsPrintDocument, labelsPrint, labelsSaveHtml, productionEditMaterialStock, productionNewMaterial, productionSaveMaterial, productionDeleteMaterial, productionApplyMaterial, productionNewBand, productionSaveBand, productionDeleteBand, productionAssignEdge, productionClearSelectedBands, fillSpaceMaterialSelect, preferredDefaultMaterialId, refreshSpaceMaterialSelects, updateSpaceMaterialPreview, updateEditSpaceMaterialPreview, getHardwarePresets, setHardwarePresets, currentHardwarePresets, findHardwarePreset, loadGlobalHardwarePresets, setHardwareScope, objectBoundsMm, boundsAxisMin, boundsAxisMax, tangentAxesForContact, contactAxisName, contactSideName, overlapMm, rawContactsForAxis, hardwareContacts, anchoredWorldCoord, hardwarePointWorlds, pointWithinPieceTangents, worldPointToLocalMm, hardwareHoleOp, hardwarePlan, refreshHardwarePresetSelect, updateHardwarePanel, hardwareBuilderAxis, updateHardwareBuilderUi, decimalFrom, readHardwareBuilder, openHardwareBuilder, saveHardwareBuilder, publishSelectedHardwarePreset, appliedHardwareStats, hardwareInstanceSummary, hardwareSourceApplications, hardwareSourceHistoryText, hardwareInstancesForSourcePreset, refreshAfterHardwareRemoval, removeAppliedHardware, removeHardwareInstances, deleteHardwareInstance, hardwareInstancesLinkedToObjects, removeHardwareLinkedToObjects, deleteSelectedHardwarePreset, renderHardwarePreviewOps, focusHardwarePlan, previewHardware3D, applySelectedHardware, fillHardwareShelfPinExample, fillHardwareDowelExample, hardwareCopyPieceEligible, hardwareCopyOpsOnPiece, hardwareCopySourceHasHardware, hardwareCopyGroups, hardwareCopyDisposeHelpers, hardwareCopyRefreshHelpers, hardwareCopyEnsureBar, hardwareCopyUpdateBar, hardwareCopyChooseSourceAgain, openCopyHardwareTool, closeCopyHardwareTool, hardwareCopyHandlePick, hardwareCopyAxisMap, hardwareCopyClampRawRef, hardwareCopyMappedOp, hardwareCopySignature, hardwareCopyApplyBatch };
}
