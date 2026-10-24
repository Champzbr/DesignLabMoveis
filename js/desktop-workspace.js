/* DesignLab r44 · Dock desktop - invoca os botões originais, não duplica funções. */
(()=>{'use strict';
 const desktop=()=>matchMedia('(min-width:1024px) and (hover:hover) and (pointer:fine)').matches;
 const $=id=>document.getElementById(id);
 const groups={
  modelagem:{title:'Modelagem',help:'Espaços, seleção, medidas e visualização.',actions:[['⚙ Configurar selecionado','cadConfigQuickButton'],['📐 Medidas e posição','showInspectorBtn'],['▱ Abrir espaço','openFurnitureSpaceBtn'],['◫ Ocultar espaço','cadHideSelectedSpaceQuick'],['◫ Ocultar peça','cadHideSelectedPieceQuick'],['◩ Mostrar peças','cadShowHiddenPiecesQuick'],['▦ Grade','cadGridQuickToggle'],['👁 Vista 3D','resetCam']]},
  componentes:{title:'Componentes',help:'Portas, gavetas, ferragens e formas; ferramentas originais.',actions:[['🚪 Portas','cadDoorSystemQuick'],['▤ Gavetas e corrediças','editDrawerSetBtn'],['⚙ Ferragens','addHardwareBtn'],['⧉ Copiar ferragens','copyHardwareBtn'],['◜ Forma especial','addShapeBtn'],['◫ Esconder portas/frentes','cadFrontQuickToggle'],['⚙ Peça selecionada','cadConfigQuickButton']]},
  materiais:{title:'Materiais e fitas',help:'O painel original permite associar materiais e fitas à peça.',actions:[['🎨 Catálogo de materiais','materialsToolBtn'],['⚙ Material da peça','cadConfigQuickButton'],['🏷 Etiquetas','labelsToolBtn'],['▱ Mostrar espaços','cadSpaceQuickToggle']]},
  usinagem:{title:'Usinagem',help:'Furos, rasgos e formas, sem alterar as operações CNC.',actions:[['＋ Adicionar furo','addHoleBtn'],['＋ Adicionar rasgo','addGrooveBtn'],['🔧 Gerenciar usinagem','manageMachiningBtn'],['◜ Forma','addShapeBtn'],['👁 Mostrar/ocultar usinagem','toggleMachiningVisibilityBtn'],['⚙ Ferragens','addHardwareBtn']]},
  producao:{title:'Produção',help:'O plano de corte e a configuração da seccionadora continuam na tela original.',actions:[['📐 Layout técnico','layoutToolBtn'],['🏷 Etiquetas das peças','labelsToolBtn'],['⚙ CNC SketchUp','sendSketchupCncBtn'],['✅ Conferir produção','productionSuiteRecheck'],['📦 Pacote de produção','productionSuitePackage']]},
  arquivo:{title:'Arquivo e projeto',help:'Salvar, importar, exportar e navegar nos projetos.',actions:[['💾 Salvar','saveBtn'],['📂 Projetos','loadBtn'],['⇩ Exportar .mcad','exportBtn'],['⇧ Importar .mcad','importBtn'],['▱ Importar SketchUp','importFurnitureBtn'],['↶ Desfazer','undoBtn'],['↷ Refazer','redoBtn']]}
 };
 const KEY='dlProfessionalLayoutR44',POS='dlProfessionalPanelR44';
 let tab='modelagem',minimized=false,mode='left';
 const panel=$('dlWorkPanel'),head=$('dlWorkPanelHead'),body=$('dlWorkPanelBody');
 if(!panel||!desktop)return;
 const safeStorage=(key,value)=>{try{if(value===undefined)return localStorage.getItem(key);localStorage.setItem(key,value)}catch(_){return null}};
 function activeEditor(){const home=$('projectHome');const choice=$('environmentChoice');const gate=$('authGate');return (!home||getComputedStyle(home).display==='none')&&(!choice||choice.hidden)&&(!gate||gate.classList.contains('hidden'));}
 function refreshVisibility(){const eligible=desktop()&&activeEditor();$('dlDesktopSwitch').style.visibility=eligible?'visible':'hidden';$('dlWorkspace').style.visibility=eligible?'visible':'hidden';}
 function render(){const entry=groups[tab];$('dlWorkPanelTitle').textContent=entry.title;body.replaceChildren();const p=document.createElement('p');p.textContent=entry.help;body.appendChild(p);const grid=document.createElement('div');grid.className='dl-work-actions';for(const [label,id] of entry.actions){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.target=id;b.onclick=()=>{const original=$(id);if(!original){return;}if(original.disabled)return;original.click();};grid.appendChild(b);}body.appendChild(grid);document.querySelectorAll('[data-dl-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.dlTab===tab)));}
 function layout(on){document.body.classList.toggle('dl-pro-layout',on&&desktop());$('dlDesktopSwitch').textContent=on?'▤ Layout clássico':'▦ Layout profissional';safeStorage(KEY,on?'pro':'classic');refreshVisibility();}
 function dock(next){mode=next;panel.dataset.dock=next;if(next!=='float'){panel.style.removeProperty('left');panel.style.removeProperty('top');panel.style.removeProperty('right');panel.style.removeProperty('height');}else{panel.style.left='20px';panel.style.top='103px';panel.style.removeProperty('right');panel.style.height='430px';}savePosition();}
 function savePosition(){safeStorage(POS,JSON.stringify({mode,left:panel.style.left,top:panel.style.top,width:panel.style.width,height:panel.style.height}));}
 $('dlDesktopSwitch').onclick=()=>layout(!document.body.classList.contains('dl-pro-layout'));
 document.querySelectorAll('[data-dl-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.dlTab;minimized=false;body.hidden=false;render();});
 $('dlDockLeft').onclick=()=>dock('left');$('dlDockRight').onclick=()=>dock('right');$('dlFloatPanel').onclick=()=>dock('float');
 $('dlMinPanel').onclick=()=>{minimized=!minimized;body.hidden=minimized;panel.style.minHeight=minimized?'0':'';if(minimized)panel.style.height='auto';else if(mode==='float')panel.style.height='430px';};
 head.addEventListener('pointerdown',e=>{if(e.target.closest('button')||!desktop())return;const x=e.clientX,y=e.clientY;const r=panel.getBoundingClientRect();dock('float');panel.style.left=r.left+'px';panel.style.top=r.top+'px';const originX=r.left,originY=r.top;const move=ev=>{panel.style.left=Math.max(0,Math.min(innerWidth-120,originX+ev.clientX-x))+'px';panel.style.top=Math.max(52,Math.min(innerHeight-70,originY+ev.clientY-y))+'px';};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);savePosition();};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});});
 panel.addEventListener('pointerup',()=>savePosition());
 try{const saved=JSON.parse(safeStorage(POS)||'{}');if(['left','right','float'].includes(saved.mode)){dock(saved.mode);if(saved.mode==='float'){for(const k of ['left','top','width','height'])if(/^\d+(\.\d+)?px$/.test(saved[k]||''))panel.style[k]=saved[k];}}}catch(_){}
 render();layout(safeStorage(KEY)!=='classic');
 const observer=new MutationObserver(refreshVisibility);for(const id of ['projectHome','environmentChoice','authGate']){const el=$(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class','style','hidden']});}
 window.addEventListener('resize',()=>{if(!desktop())document.body.classList.remove('dl-pro-layout');else layout(safeStorage(KEY)!=='classic');refreshVisibility();});refreshVisibility();
})();
