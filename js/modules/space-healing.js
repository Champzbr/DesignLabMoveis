// DesignLabMoveis 1.311.00 · reparo de vãos e exclusão estrutural de peças.
export function createSpaceHealingModule(ctx){
  const { state, objectInsideSpaceRoot, pieceThicknessInfo, getBounds, uid, rootBounds, renderSpaces, distanceSqPointToCell, isDoorObject, isVerticalDivisionPiece, rootForObject, removeHardwareLinkedToObjects, removeDoorHandleVisualsForOwners, disposeObject, selectObject, removeDrawerSet, toast, renderMachiningVisuals, commitHistory, largestVisibleCell, selectSpaceCellByIds, selectSpaceRootOnly }=ctx;
  const runtimeModel=ctx.runtimeModel;
const SPACE_HEAL_TOL=.0008;
const SPACE_HEAL_MAX_GAP=.120;

function cellAxisMin(c,axis){return axis==='x'?c.minX:axis==='y'?c.minY:c.minZ;}
function cellAxisMax(c,axis){return axis==='x'?c.maxX:axis==='y'?c.maxY:c.maxZ;}
function setCellAxisMin(c,axis,v){if(axis==='x')c.minX=v;else if(axis==='y')c.minY=v;else c.minZ=v;}
function setCellAxisMax(c,axis,v){if(axis==='x')c.maxX=v;else if(axis==='y')c.maxY=v;else c.maxZ=v;}
function tangentAxesForSpace(axis){return axis==='x'?['y','z']:axis==='y'?['x','z']:['x','y'];}
function almostSpace(a,b,tol=SPACE_HEAL_TOL){return Math.abs(Number(a)-Number(b))<=tol;}
function sameCellTangents(a,b,axis,tol=SPACE_HEAL_TOL){
  const [u,v]=tangentAxesForSpace(axis);
  return almostSpace(cellAxisMin(a,u),cellAxisMin(b,u),tol)
      && almostSpace(cellAxisMax(a,u),cellAxisMax(b,u),tol)
      && almostSpace(cellAxisMin(a,v),cellAxisMin(b,v),tol)
      && almostSpace(cellAxisMax(a,v),cellAxisMax(b,v),tol);
}
function cellBox(c){return {minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ};}
function boxAxisMin(b,a){return a==='x'?b.minX:a==='y'?b.minY:b.minZ;}
function boxAxisMax(b,a){return a==='x'?b.maxX:a==='y'?b.maxY:b.maxZ;}
function setBoxAxisMin(b,a,v){if(a==='x')b.minX=v;else if(a==='y')b.minY=v;else b.minZ=v;}
function setBoxAxisMax(b,a,v){if(a==='x')b.maxX=v;else if(a==='y')b.maxY=v;else b.maxZ=v;}
function boxOverlapMeters(a,b,axis){
  return Math.min(boxAxisMax(a,axis),boxAxisMax(b,axis))-Math.max(boxAxisMin(a,axis),boxAxisMin(b,axis));
}
function boxesOverlapVolume(a,b,tol=SPACE_HEAL_TOL){
  return boxOverlapMeters(a,b,'x')>tol && boxOverlapMeters(a,b,'y')>tol && boxOverlapMeters(a,b,'z')>tol;
}
function gapBoxBetweenCells(a,b,axis){
  const box={...cellBox(a)};
  const a0=cellAxisMin(a,axis),a1=cellAxisMax(a,axis),b0=cellAxisMin(b,axis),b1=cellAxisMax(b,axis);
  if(a1<b0){
    setBoxAxisMin(box,axis,a1);setBoxAxisMax(box,axis,b0);
  }else if(b1<a0){
    setBoxAxisMin(box,axis,b1);setBoxAxisMax(box,axis,a0);
  }else return null;
  return box;
}
function objectOccupiesSpaceGap(root,gapBox,axis,exclude=null){
  const [u,v]=tangentAxesForSpace(axis);
  for(const o of runtimeModel.objects){
    if(o===exclude)continue;
    const ud=o.userData||{};
    if(ud.kind==='hardware-visual'||ud.kind==='cylinder')continue;
    const belongs=ud.spaceRootId===root.id || objectInsideSpaceRoot(o,root,.006);
    if(!belongs)continue;

    // Só uma peça cuja ESPESSURA está no mesmo eixo do GAP pode bloquear
    // a recomposição daquele vão. Ex.: prateleira => GAP em Y.
    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!==axis)continue;

    const b=getBounds(o);
    const axisOv=boxOverlapMeters(b,gapBox,axis);
    if(axisOv<=SPACE_HEAL_TOL)continue;

    const ovU=boxOverlapMeters(b,gapBox,u),ovV=boxOverlapMeters(b,gapBox,v);
    if(ovU>.004&&ovV>.004)return true;
  }
  return false;
}
function anotherCellOccupiesGap(root,gapBox,ignore=[]){
  const ignored=new Set(ignore);
  return root.cells.some(c=>!ignored.has(c)&&boxesOverlapVolume(cellBox(c),gapBox,.0002));
}
function mergedCellFromPair(a,b,axis){
  const c={
    id:uid('cell'),
    hidden:!!(a.hidden&&b.hidden),
    fixedAxes:{
      x:!!(a.fixedAxes?.x&&b.fixedAxes?.x),
      y:!!(a.fixedAxes?.y&&b.fixedAxes?.y),
      z:!!(a.fixedAxes?.z&&b.fixedAxes?.z)
    },
    minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),
    minY:Math.min(a.minY,b.minY),maxY:Math.max(a.maxY,b.maxY),
    minZ:Math.min(a.minZ,b.minZ),maxZ:Math.max(a.maxZ,b.maxZ)
  };
  setCellAxisMin(c,axis,Math.min(cellAxisMin(a,axis),cellAxisMin(b,axis)));
  setCellAxisMax(c,axis,Math.max(cellAxisMax(a,axis),cellAxisMax(b,axis)));
  return c;
}
function tryMergeOneOrphanGap(root,exclude=null){
  for(const axis of ['x','y','z']){
    for(let i=0;i<root.cells.length;i++){
      const a=root.cells[i];
      for(let j=i+1;j<root.cells.length;j++){
        const b=root.cells[j];
        if(!sameCellTangents(a,b,axis))continue;
        const gap=gapBoxBetweenCells(a,b,axis);if(!gap)continue;
        const size=boxAxisMax(gap,axis)-boxAxisMin(gap,axis);
        if(size<=SPACE_HEAL_TOL||size>SPACE_HEAL_MAX_GAP)continue;
        if(objectOccupiesSpaceGap(root,gap,axis,exclude))continue;
        if(anotherCellOccupiesGap(root,gap,[a,b]))continue;
        const merged=mergedCellFromPair(a,b,axis);
        root.cells.splice(j,1);root.cells.splice(i,1,merged);
        return {kind:'merge',axis,size,cell:merged};
      }
    }
  }
  return null;
}
function blockingIntervalsInBoundaryGap(root,gapBox,axis,exclude=null){
  const [u,v]=tangentAxesForSpace(axis),out=[];
  for(const o of runtimeModel.objects){
    if(o===exclude)continue;
    const ud=o.userData||{};
    if(ud.kind==='hardware-visual'||ud.kind==='cylinder')continue;
    const belongs=ud.spaceRootId===root.id || objectInsideSpaceRoot(o,root,.006);
    if(!belongs)continue;

    const ti=pieceThicknessInfo(o);
    if(!ti||ti.thicknessAxis!==axis)continue;

    const b=getBounds(o);
    if(boxOverlapMeters(b,gapBox,axis)<=SPACE_HEAL_TOL)continue;
    if(boxOverlapMeters(b,gapBox,u)<=.004||boxOverlapMeters(b,gapBox,v)<=.004)continue;

    const a=Math.max(boxAxisMin(b,axis),boxAxisMin(gapBox,axis));
    const z=Math.min(boxAxisMax(b,axis),boxAxisMax(gapBox,axis));
    if(z-a>SPACE_HEAL_TOL)out.push([a,z]);
  }
  return out;
}
function tryHealOneBoundaryGap(root,exclude=null){
  const rb=rootBounds(root);
  for(const axis of ['x','y','z']){
    const rootMin=boxAxisMin(rb,axis),rootMax=boxAxisMax(rb,axis);

    for(const c of root.cells){
      for(const side of ['min','max']){
        const edge=side==='min'?cellAxisMin(c,axis):cellAxisMax(c,axis);
        const boundary=side==='min'?rootMin:rootMax;
        const rawSize=side==='min'?edge-boundary:boundary-edge;
        if(rawSize<=SPACE_HEAL_TOL||rawSize>SPACE_HEAL_MAX_GAP)continue;

        const gap={...cellBox(c)};
        if(side==='min'){
          setBoxAxisMin(gap,axis,boundary);
          setBoxAxisMax(gap,axis,edge);
        }else{
          setBoxAxisMin(gap,axis,edge);
          setBoxAxisMax(gap,axis,boundary);
        }

        if(anotherCellOccupiesGap(root,gap,[c]))continue;

        // Em vez de cancelar o reparo porque existe uma base/lateral/chapéu
        // dentro do GAP, encontramos a peça legítima mais próxima do vão.
        // O espaço cresce ATÉ essa peça, cobrindo somente a faixa órfã.
        const blockers=blockingIntervalsInBoundaryGap(root,gap,axis,exclude);
        let target=boundary;

        if(side==='min'){
          // Ex.: raiz 0, base 0..18, prateleira apagada 18..36,
          // vão atual começa em 36. O alvo correto é 18, não 0.
          for(const [,end] of blockers){
            if(end<=edge+SPACE_HEAL_TOL)target=Math.max(target,end);
          }
          const healSize=edge-target;
          if(healSize<=SPACE_HEAL_TOL||healSize>SPACE_HEAL_MAX_GAP)continue;

          const orphan={...cellBox(c)};
          setBoxAxisMin(orphan,axis,target);
          setBoxAxisMax(orphan,axis,edge);
          if(anotherCellOccupiesGap(root,orphan,[c]))continue;

          setCellAxisMin(c,axis,target);
          c.hidden=false;
          return {kind:'boundary',axis,size:healSize,cell:c,target};
        }else{
          for(const [start] of blockers){
            if(start>=edge-SPACE_HEAL_TOL)target=Math.min(target,start);
          }
          const healSize=target-edge;
          if(healSize<=SPACE_HEAL_TOL||healSize>SPACE_HEAL_MAX_GAP)continue;

          const orphan={...cellBox(c)};
          setBoxAxisMin(orphan,axis,edge);
          setBoxAxisMax(orphan,axis,target);
          if(anotherCellOccupiesGap(root,orphan,[c]))continue;

          setCellAxisMax(c,axis,target);
          c.hidden=false;
          return {kind:'boundary',axis,size:healSize,cell:c,target};
        }
      }
    }
  }
  return null;
}
function repairOrphanSpaceGaps(root,{exclude=null,maxPasses=80}={}){
  if(!root||!Array.isArray(root.cells)||!root.cells.length)return {changes:0,cell:null};
  let changes=0,lastCell=null;
  for(let n=0;n<maxPasses;n++){
    const r=tryMergeOneOrphanGap(root,exclude);
    if(!r)break;changes++;lastCell=r.cell;
  }
  for(let n=0;n<maxPasses;n++){
    const r=tryHealOneBoundaryGap(root,exclude);
    if(!r)break;changes++;lastCell=r.cell;
  }
  return {changes,cell:lastCell};
}
function repairAllOrphanSpaceGaps(){
  let changes=0;
  for(const root of runtimeModel.spaceRoots)changes+=repairOrphanSpaceGaps(root).changes;
  if(changes){
    renderSpaces();
    console.info(`DesignLabMoveis: ${changes} faixa(s) órfã(s) recuperada(s).`);
  }
  return changes;
}
function bestCellNearPoint(root,p){
  const visible=(root?.cells||[]).filter(c=>!c.hidden);
  if(!visible.length)return null;
  const inside=visible.find(c=>p.x>=c.minX-SPACE_HEAL_TOL&&p.x<=c.maxX+SPACE_HEAL_TOL&&p.y>=c.minY-SPACE_HEAL_TOL&&p.y<=c.maxY+SPACE_HEAL_TOL&&p.z>=c.minZ-SPACE_HEAL_TOL&&p.z<=c.maxZ+SPACE_HEAL_TOL);
  if(inside)return inside;
  return visible.reduce((best,c)=>distanceSqPointToCell(p,c)<distanceSqPointToCell(p,best)?c:best,visible[0]);
}

// 1.200.18 · ao apagar uma peça estrutural, devolve exatamente a faixa que ela ocupava
// ao(s) vão(s) vizinho(s). Isso resolve principalmente lateral esquerda/direita,
// base, chapéu, prateleira, fundo/frente e divisão vertical.
function isSpaceCuttingPieceForHeal(o){
  if(!o||o.userData?.kind!=='panel'||isDoorObject(o)||o.userData?.drawerRole||o.userData?.curvedRole)return false;
  if(o.userData?.spaceCutting===true)return true;
  const n=String(o.userData?.name||'').trim();
  return /^(Lateral esquerda|Lateral direita|Divisão vertical|Base|Chapéu|Prateleira(?:\s+\d+)?|Fundo|Frente)$/i.test(n);
}
function deletedPieceAxisBounds(b,axis){
  return axis==='x'?[b.minX,b.maxX]:axis==='y'?[b.minY,b.maxY]:[b.minZ,b.maxZ];
}
function deletedPieceTangentOverlap(cell,b,axis){
  const [u,v]=tangentAxesForSpace(axis);
  return boxOverlapMeters(cellBox(cell),b,u)>SPACE_HEAL_TOL && boxOverlapMeters(cellBox(cell),b,v)>SPACE_HEAL_TOL;
}
function removeDeletedDivisionFixedBand(root,o,b,axis){
  if(!root||axis!=='x'||!isVerticalDivisionPiece(o,root))return 0;
  const rb=rootBounds(root),rootMin=rb.minX;
  const a=b.minX-rootMin,z=b.maxX-rootMin,tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  const before=(root.fixedBands?.x||[]).length;
  root.fixedBands=root.fixedBands||{x:[],y:[],z:[]};
  root.fixedBands.x=(root.fixedBands.x||[]).filter(([s,e])=>!(Math.abs(Number(s)-a)<=tol&&Math.abs(Number(e)-z)<=tol));
  return before-root.fixedBands.x.length;
}
function spaceBoundaryRoleForHeal(o,axis){
  const n=String(o?.userData?.name||'').trim().toLowerCase();
  if(axis==='x'){
    if(/^lateral esquerda$/i.test(n))return 'min';
    if(/^lateral direita$/i.test(n))return 'max';
  }
  if(axis==='y'){
    if(/^base$/i.test(n))return 'min';
    if(/^(chapéu|chapeu|topo)$/i.test(n))return 'max';
  }
  if(axis==='z'){
    if(/^fundo(?: 6 mm)?$/i.test(n))return 'min';
    if(/^frente$/i.test(n))return 'max';
  }
  return null;
}
function validStoredSpaceCutParentBounds(o){
  const b=o?.userData?.spaceCutParentBounds;
  if(!b)return null;
  const keys=['minX','maxX','minY','maxY','minZ','maxZ'];
  if(!keys.every(k=>Number.isFinite(Number(b[k]))))return null;
  const out={};for(const k of keys)out[k]=Number(b[k]);
  return out.maxX>out.minX&&out.maxY>out.minY&&out.maxZ>out.minZ?out:null;
}
function cellTangentOverlapWithDeletedPiece(c,b,axis){
  const [u,v]=tangentAxesForSpace(axis);
  return boxOverlapMeters(cellBox(c),b,u)>SPACE_HEAL_TOL && boxOverlapMeters(cellBox(c),b,v)>SPACE_HEAL_TOL;
}
function restoreBoundaryPieceThickness(root,o,b,axis,role){
  const [d0,d1]=deletedPieceAxisBounds(b,axis),tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  const parent=validStoredSpaceCutParentBounds(o);
  // Para peças criadas a partir desta versão, o limite é o limite original do
  // vão. Para projetos antigos usamos a própria face externa da peça: isso é
  // suficiente para devolver exatamente a espessura sem atravessar o corte
  // manual que existe do outro lado da lateral/base/chapéu/fundo/frente.
  const target=role==='min'
    ? (parent?Math.max(boxAxisMin(parent,axis),Math.min(d0,d1)):d0)
    : (parent?Math.min(boxAxisMax(parent,axis),Math.max(d0,d1)):d1);
  const insideFace=role==='min'?d1:d0;
  let changes=0,lastCell=null;
  const candidates=root.cells.filter(c=>cellTangentOverlapWithDeletedPiece(c,b,axis));
  for(const c of candidates){
    const touchesInside=role==='min'
      ? almostSpace(cellAxisMin(c,axis),insideFace,tol)
      : almostSpace(cellAxisMax(c,axis),insideFace,tol);
    if(!touchesInside)continue;
    const gap={...cellBox(c)};
    if(role==='min'){
      setBoxAxisMin(gap,axis,target);setBoxAxisMax(gap,axis,cellAxisMin(c,axis));
    }else{
      setBoxAxisMin(gap,axis,cellAxisMax(c,axis));setBoxAxisMax(gap,axis,target);
    }
    if(boxAxisMax(gap,axis)-boxAxisMin(gap,axis)<=SPACE_HEAL_TOL)continue;
    // Outra divisão pode encostar no lado de fora, mas não pode ocupar o volume
    // que era da peça apagada. Assim o vão de 60 mm volta a 60 mm sem juntar
    // com os espaços grandes à esquerda/direita.
    if(objectOccupiesSpaceGap(root,gap,axis,null)||anotherCellOccupiesGap(root,gap,[c]))continue;
    if(role==='min')setCellAxisMin(c,axis,target);else setCellAxisMax(c,axis,target);
    c.hidden=false;changes++;lastCell=c;
  }
  // Caso a peça ocupasse 100% do vão, não existe célula interna para expandir.
  // Se conhecemos o vão original, recriamos a célula inteira.
  if(!changes&&parent){
    const free={id:uid('cell'),hidden:false,fixedAxes:{},...parent};
    if(!root.cells.some(c=>boxesOverlapVolume(cellBox(c),parent,.0002)) && !objectOccupiesSpaceGap(root,parent,axis,null)){
      root.cells.push(free);changes++;lastCell=free;
    }
  }
  return {changes,cell:lastCell};
}
function reclaimDeletedPieceSpace(root,o,deletedBounds){
  if(!root||!deletedBounds||!isSpaceCuttingPieceForHeal(o))return {changes:0,cell:null};
  const ti=pieceThicknessInfo(o);if(!ti)return {changes:0,cell:null};
  const axis=ti.thicknessAxis,[d0,d1]=deletedPieceAxisBounds(deletedBounds,axis),tol=Math.max(SPACE_HEAL_TOL*4,.0025);
  let changes=0,lastCell=null;

  removeDeletedDivisionFixedBand(root,o,deletedBounds,axis);

  // Laterais/base/chapéu/fundo/frente são bordas DO VÃO EM QUE FORAM CRIADAS,
  // não necessariamente bordas do móvel principal. Ao apagar, devolvemos só a
  // espessura da peça para dentro daquele vão. Esse é o caso de um corte de
  // 60 mm com duas laterais: 60 -> 24 livres; apagando ambas volta exatamente 60.
  const boundaryRole=spaceBoundaryRoleForHeal(o,axis);
  if(boundaryRole){
    const r=restoreBoundaryPieceThickness(root,o,deletedBounds,axis,boundaryRole);
    return r;
  }

  // Peças internas, como Divisão vertical e Prateleira, realmente separam dois
  // vãos. Ao apagar, une somente os dois compartimentos que encostavam nas duas
  // faces da peça.
  let merged=true;
  while(merged){
    merged=false;
    outer:
    for(let i=0;i<root.cells.length;i++){
      const a=root.cells[i];
      if(!deletedPieceTangentOverlap(a,deletedBounds,axis))continue;
      for(let j=i+1;j<root.cells.length;j++){
        const c=root.cells[j];
        if(!deletedPieceTangentOverlap(c,deletedBounds,axis)||!sameCellTangents(a,c,axis,tol))continue;
        const aLow=almostSpace(cellAxisMax(a,axis),d0,tol)&&almostSpace(cellAxisMin(c,axis),d1,tol);
        const cLow=almostSpace(cellAxisMax(c,axis),d0,tol)&&almostSpace(cellAxisMin(a,axis),d1,tol);
        if(!aLow&&!cLow)continue;
        const gap=gapBoxBetweenCells(a,c,axis);
        if(!gap||objectOccupiesSpaceGap(root,gap,axis,null)||anotherCellOccupiesGap(root,gap,[a,c]))continue;
        const joined=mergedCellFromPair(a,c,axis);
        root.cells.splice(j,1);root.cells.splice(i,1,joined);
        changes++;lastCell=joined;merged=true;break outer;
      }
    }
  }

  // Compatibilidade: se uma peça estrutural antiga estiver na borda real do
  // móvel e não tiver metadados do vão, ainda recupera a faixa até o root.
  if(!changes){
    const rb=rootBounds(root),r0=boxAxisMin(rb,axis),r1=boxAxisMax(rb,axis);
    const touchesMin=d0<=r0+tol,touchesMax=d1>=r1-tol;
    if(touchesMin||touchesMax){
      const role=touchesMin?'min':'max';
      const r=restoreBoundaryPieceThickness(root,o,deletedBounds,axis,role);
      changes+=r.changes;lastCell=r.cell||lastCell;
    }
  }
  return {changes,cell:lastCell};
}

function deleteSelected(){
  if(!state.selected) return;
  const setId=state.selected.userData?.drawerSetId;
  if(setId){
    const cfg=state.selected.userData?.drawerConfig||{};
    if(!window.confirm(`Excluir o conjunto de gavetas “${cfg.name||cfg.slideName||'Gavetas'}” inteiro?\n\nAs furações automáticas ligadas às corrediças também serão removidas.`))return;
    removeDrawerSet(setId,{commit:true});
    toast('Conjunto de gavetas excluído');
    return;
  }

  const o=state.selected;
  const root=rootForObject(o);
  const oldCenter=o.position.clone();
  const deletedBounds=root?{...getBounds(o)}:null;

  // Antes de remover a peça, elimina a aplicação completa das ferragens
  // vinculadas a ela nas outras peças. Assim não sobram pontos rosa no ar.
  const hardwareRemoved=removeHardwareLinkedToObjects([o]);
  const handleVisualRemoved=removeDoorHandleVisualsForOwners([o]);

  const i=runtimeModel.objects.indexOf(o);if(i>=0)runtimeModel.objects.splice(i,1);
  disposeObject(o);
  selectObject(null);

  let healed=0,targetCell=null;
  if(root){
    // Primeiro devolve diretamente ao espaço a faixa ocupada pela peça apagada.
    // Depois roda o reparo genérico para consolidar qualquer faixa órfã restante.
    const direct=reclaimDeletedPieceSpace(root,o,deletedBounds);
    const first=repairOrphanSpaceGaps(root,{exclude:o});
    const second=repairOrphanSpaceGaps(root);
    healed=direct.changes+first.changes+second.changes;

    if(healed){
      renderSpaces();
      targetCell=bestCellNearPoint(root,oldCenter)||second.cell||first.cell||direct.cell||largestVisibleCell(root);
      if(targetCell)selectSpaceCellByIds(root.id,targetCell.id,{showMenu:false});
      else selectSpaceRootOnly(root,{showMenu:false});
    }
  }

  if(root){
    // Garante que a geometria visual das células reflita imediatamente
    // os limites recalculados, inclusive quando a peça estava colada na base.
    renderSpaces();
    targetCell=bestCellNearPoint(root,oldCenter)||targetCell||largestVisibleCell(root);
    if(targetCell)selectSpaceCellByIds(root.id,targetCell.id);
  }

  renderMachiningVisuals();
  commitHistory();
  const hwCount=(hardwareRemoved.instances||0)+(handleVisualRemoved||0);
  const hwText=hwCount?` · ${hwCount} ferragem(ns) visual/vinculada(s) removida(s)`:'';
  toast((healed?`Peça excluída · espaço recalculado (${healed} ajuste${healed===1?'':'s'})`:'Peça excluída')+hwText);
}

  return {SPACE_HEAL_TOL,SPACE_HEAL_MAX_GAP,cellAxisMin,cellAxisMax,setCellAxisMin,setCellAxisMax,tangentAxesForSpace,almostSpace,sameCellTangents,cellBox,boxAxisMin,boxAxisMax,setBoxAxisMin,setBoxAxisMax,boxOverlapMeters,boxesOverlapVolume,gapBoxBetweenCells,objectOccupiesSpaceGap,anotherCellOccupiesGap,mergedCellFromPair,repairOrphanSpaceGaps,repairAllOrphanSpaceGaps,bestCellNearPoint,isSpaceCuttingPieceForHeal,reclaimDeletedPieceSpace,deleteSelected};
}
