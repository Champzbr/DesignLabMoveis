// DesignLabMoveis 1.310.00 · utilidades de overlays, painéis flutuantes e clique fora.
export function createUiOverlaysModule(ctx){
  const { $, cancelDuplicateConfirmation, closeCopyHardwareTool, closeCopyShapeTool, closeProjectCardMenu, setToolDockOpen, getProductionMaterials, getMachiningShapes } = ctx;
function installMinusButtons(){
  document.querySelectorAll('input[data-minus-button="1"]').forEach(input=>{
    if(input.dataset.minusInstalled==='1')return;
    input.dataset.minusInstalled='1';

    const parent=input.parentNode;
    const wrap=document.createElement('div');
    wrap.className='signedMinusWrap';
    parent.insertBefore(wrap,input);

    const minus=document.createElement('button');
    minus.type='button';
    minus.className='signedMinusBtn';
    minus.textContent='−';
    minus.setAttribute('aria-label','Usar valor negativo');
    minus.title='Valor negativo';

    const plus=document.createElement('button');
    plus.type='button';
    plus.className='signedPlusBtn';
    plus.textContent='+';
    plus.setAttribute('aria-label','Usar valor positivo');
    plus.title='Valor positivo';

    wrap.appendChild(minus);
    wrap.appendChild(input);
    wrap.appendChild(plus);

    const formatSignedValue=(value)=>{
      const step=Number(input.step);
      if(Number.isFinite(step)&&step>0&&step<1){
        const decimals=Math.min(6,Math.max(0,String(step).split('.')[1]?.length||0));
        input.value=String(Number(value.toFixed(decimals)));
      }else{
        input.value=String(value);
      }
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      input.focus({preventScroll:true});
    };

    minus.addEventListener('click',()=>{
      let n=Number(String(input.value??'0').trim().replace(',','.'));
      if(!Number.isFinite(n))n=0;
      formatSignedValue(-Math.abs(n));
    });

    plus.addEventListener('click',()=>{
      let n=Number(String(input.value??'0').trim().replace(',','.'));
      if(!Number.isFinite(n))n=0;
      formatSignedValue(Math.abs(n));
    });
  });
}
installMinusButtons();


// ============================================================================
// v98 · FECHAR MENUS / PAINÉIS AO TOCAR FORA
// ----------------------------------------------------------------------------
// Regra geral:
// - menus flutuantes fecham ao tocar fora, sem bloquear o toque no CAD;
// - o próprio botão que abriu o menu continua podendo fechá-lo normalmente;
// - diálogos de tela cheia fecham ao tocar no fundo escuro, usando o mesmo
//   botão Cancelar/Fechar para preservar qualquer rotina de limpeza existente.
// ============================================================================
function elementIsVisible(el){
  if(!el)return false;
  const cs=getComputedStyle(el);
  return cs.display!=='none' && cs.visibility!=='hidden';
}
function hideFloatingPanel(id){
  const el=$(id);
  if(el&&elementIsVisible(el))el.style.display='none';
}
function closeInspectorOutside(){
  const el=$('inspector');
  if(!el||!elementIsVisible(el))return;
  cancelDuplicateConfirmation?.();
  el.classList.add('compact');
  el.style.display='none';
}
function closeSpaceActionsOutside(){
  const el=$('spaceActions');
  if(el&&elementIsVisible(el))el.style.display='none';
}
function clickBackdropCancel(dialogId,buttonId){
  const dlg=$(dialogId),btn=$(buttonId);
  if(!dlg||!btn)return;
  dlg.addEventListener('pointerdown',e=>{
    if(e.target!==dlg)return;
    e.preventDefault();
    btn.click();
  });
}
function installOutsideMenuClose(){
  // Menus / painéis leves: captura primeiro, fecha e deixa o toque seguir
  // para o CAD normalmente.
  document.addEventListener('pointerdown',e=>{
    const target=e.target;

    // MAIS FERRAMENTAS
    const more=$('morePanel');
    const moreTrigger=target.closest?.('[data-dock-tool="more"]');
    if(more&&more.style.display==='block'&&!more.contains(target)&&!moreTrigger){
      more.style.display='none';
    }

    // MEDIDAS / POSIÇÃO (inspector)
    const inspector=$('inspector');
    const inspectorTrigger=target.closest?.('#showInspectorBtn,[data-dock-tool="inspector"]');
    if(inspector&&elementIsVisible(inspector)&&!inspector.contains(target)&&!inspectorTrigger){
      closeInspectorOutside();
    }

    // MENU DO ESPAÇO/DIVISÃO
    const spaceActions=$('spaceActions');
    // Ferramentas que trabalham diretamente com o espaço não contam como
    // "fora" durante o próprio toque que as aciona.
    const spaceTrigger=target.closest?.(
      '#spaceActions,[data-dock-tool="cutSpace"],[data-dock-tool="createPieces"],'+
      '[data-dock-tool="drawers"],[data-dock-tool="curvedStructure"],'+
      '[data-dock-tool="library"],[data-dock-tool="editSpace"]'
    );
    if(spaceActions&&elementIsVisible(spaceActions)&&!spaceActions.contains(target)&&!spaceTrigger){
      closeSpaceActionsOutside();
    }
  },true);

  // Diálogos que ainda não tinham fechamento pelo fundo escuro.
  clickBackdropCancel('newPanelDialog','cancelPanel');
  clickBackdropCancel('newSpaceDialog','cancelSpace');
  clickBackdropCancel('cutSpaceDialog','cancelCut');
  clickBackdropCancel('libraryDialog','closeLibrary');
  clickBackdropCancel('recoveryDialog','recoveryCancel');
  clickBackdropCancel('productionDialog','closeProductionDialog');
  clickBackdropCancel('labelsDialog','closeLabelsDialog');
  clickBackdropCancel('adminDialog','closeAdminDialog');

  // ESC também segue o comportamento padrão dos menus leves.
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.defaultPrevented)return;

    if(typeof getProductionMaterials?.()?.state?.hardwareCopyState!=='undefined'&&getProductionMaterials()?.state?.hardwareCopyState?.active){closeCopyHardwareTool(false);return;}
    if(typeof getMachiningShapes?.()?.state?.shapeCopyState!=='undefined'&&getMachiningShapes()?.state?.shapeCopyState?.active){closeCopyShapeTool(false);return;}

    if($('projectCardMenu')?.classList.contains('show')){
      closeProjectCardMenu(); return;
    }
    if($('projectMenuPanel')?.classList.contains('show')){
      $('projectMenuPanel').classList.remove('show'); return;
    }
    if($('toolDock')?.classList.contains('open')){
      setToolDockOpen(false); return;
    }
    if($('morePanel')?.style.display==='block'){
      $('morePanel').style.display='none'; return;
    }
    if(elementIsVisible($('inspector'))){
      closeInspectorOutside(); return;
    }
    if(elementIsVisible($('spaceActions'))){
      closeSpaceActionsOutside(); return;
    }
  });
}



  return {installMinusButtons,elementIsVisible,hideFloatingPanel,closeInspectorOutside,closeSpaceActionsOutside,clickBackdropCancel,installOutsideMenuClose};
}
