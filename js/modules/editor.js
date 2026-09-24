export function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

export function roundMmNumber(value,digits=3){
  const n=Number(value);
  if(!Number.isFinite(n)) return 0;
  const p=10**digits;
  return Math.round((n+Number.EPSILON)*p)/p;
}

export function nice(value){
  const n=roundMmNumber(value,3);
  return String(n).replace('.',',');
}

export function uid(prefix='id'){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}
