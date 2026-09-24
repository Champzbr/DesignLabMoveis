// DesignLabMoveis 1.310.00 · helpers pequenos e estáveis do runtime.
export function createRuntimeHelpers({THREE,roundMmNumber,M_TO_MM,MM_TO_M,MIN_SIZE,MAX_SIZE,$}){
  let toastTimer=null;
  const mm=v=>roundMmNumber(Number(v)*M_TO_MM,3);
  const m=v=>Number(v)*MM_TO_M;
  const clampSize=v=>THREE.MathUtils.clamp(v,MIN_SIZE,MAX_SIZE);
  function toast(text){
    const el=$('toast');
    if(!el)return;
    el.textContent=text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('show'),1800);
  }
  return {mm,m,clampSize,toast};
}
