// DesignLabMoveis 1.311.00 · binding da interface de móvel curvo.
export function bindCurvedFurnitureUi(ctx){
  const {$,nice,parseDecimalInput,curvedFieldNumber,curvedFurniture,updateCurvedStructurePreview,returnCurvedStructurePreview,previewCurvedStructure3D,createCurvedStructure,openCurvedStructureDialog}=ctx;

  function normalizeCurvedRadiusInputs(){
    const r=parseDecimalInput($('curvedRadius')?.value);
    if(!Number.isFinite(r)||r<20)return;
    const cover=$('curvedCreateCover')?.checked?curvedFieldNumber('curvedCoverThickness',6):0;
    const bandEl=$('curvedBand');
    const band=parseDecimalInput(bandEl?.value);
    const maxBand=r-cover-1;
    if(bandEl&&Number.isFinite(band)&&band>=r-cover&&maxBand>=20)bandEl.value=nice(Math.min(band,maxBand));
  }

  ['curvedRadius','curvedBand','curvedThickness','curvedRibs','curvedPosts','curvedPostWidth','curvedJointDepth','curvedSlotClearance','curvedReliefDiameter','curvedReliefLength','curvedCurveEndInset','curvedEndAInset','curvedEndBInset','curvedCoverThickness','curvedSplitTail'].forEach(id=>{
    $(id)?.addEventListener('input',()=>{if(id==='curvedRadius')normalizeCurvedRadiusInputs();updateCurvedStructurePreview();});
  });
  document.querySelectorAll('[data-curved-orientation]').forEach(b=>b.addEventListener('click',()=>{
    curvedFurniture.state.curvedOrientation=b.dataset.curvedOrientation||'front-right';
    document.querySelectorAll('[data-curved-orientation]').forEach(x=>x.classList.toggle('active',x===b));
    updateCurvedStructurePreview();
  }));
  $('curvedCreateSlots')?.addEventListener('change',updateCurvedStructurePreview);
  $('curvedReliefMode')?.addEventListener('change',updateCurvedStructurePreview);
  $('curvedCreateCover')?.addEventListener('change',updateCurvedStructurePreview);
  $('curvedSplitStructure')?.addEventListener('change',updateCurvedStructurePreview);
  const clearCurvedDialogState=()=>{
    curvedFurniture.state.curved3DPreviewOriginalState=null;
    curvedFurniture.state.curved3DPreviewMeta=null;
    curvedFurniture.state.curvedTargetRootId=null;
    curvedFurniture.state.curvedTargetCellId=null;
    curvedFurniture.state.curvedEditingExisting=false;
  };
  const cancel=$('cancelCurvedStructure');
  if(cancel)cancel.onclick=()=>{
    if(curvedFurniture.state.curved3DPreviewActive)return returnCurvedStructurePreview({reopen:false});
    $('curvedStructureDialog').style.display='none';clearCurvedDialogState();
  };
  $('curvedStructureDialog')?.addEventListener('pointerdown',e=>{
    if(e.target===$('curvedStructureDialog')){$('curvedStructureDialog').style.display='none';clearCurvedDialogState();}
  });
  $('previewCurvedStructure')?.addEventListener('click',previewCurvedStructure3D);
  $('returnCurvedPreview')?.addEventListener('click',()=>returnCurvedStructurePreview({reopen:true}));
  if($('confirmCurvedStructure'))$('confirmCurvedStructure').onclick=()=>createCurvedStructure();
  if($('curvedSpaceBtn'))$('curvedSpaceBtn').onclick=()=>openCurvedStructureDialog();
  return {normalizeCurvedRadiusInputs};
}
