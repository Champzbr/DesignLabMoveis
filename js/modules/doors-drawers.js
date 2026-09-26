export function spaceSelectionKey(rootId,cellId){
  return `${rootId}:${cellId}`;
}

export function buildDoorRegionEnvelope(entries,{frontTol=.006}={}){
  if(!Array.isArray(entries)||!entries.length){
    return {ok:false,reason:'Selecione pelo menos um espaço.'};
  }
  const root=entries[0].root;
  if(entries.some(entry=>entry.root?.id!==root?.id)){
    return {ok:false,reason:'Selecione espaços do mesmo móvel.'};
  }
  const frontZ=Math.max(...entries.map(entry=>entry.cell.maxZ));
  if(entries.some(entry=>Math.abs(entry.cell.maxZ-frontZ)>frontTol)){
    return {ok:false,reason:'Os espaços selecionados precisam estar na mesma frente do móvel.'};
  }
  const minX=Math.min(...entries.map(entry=>entry.cell.minX));
  const maxX=Math.max(...entries.map(entry=>entry.cell.maxX));
  const minY=Math.min(...entries.map(entry=>entry.cell.minY));
  const maxY=Math.max(...entries.map(entry=>entry.cell.maxY));
  const minZ=Math.min(...entries.map(entry=>entry.cell.minZ));
  return {
    ok:true,root,frontZ,
    cell:{id:'multi-region',hidden:false,fixedAxes:{},minX,maxX,minY,maxY,minZ,maxZ:frontZ},
    cells:entries.map(entry=>entry.cell),
    cellIds:entries.map(entry=>entry.cellId),
    selectedCount:entries.length,
    isDoorRegion:true
  };
}

// 1.311.00 · domínio completo de portas e gavetas.
export function createDoorsDrawersModule(ctx){
  const { $, COLORS, MM_TO_M, THREE, activeSpaceRoot, adminAllowed, applyState, buildDoorRegionEnvelope, camera, captureFurniture, captureState, cellCenter, cellSize, cloudAccountState, cloudApiFetch, commitHistory, createBox, createSpace, designLabBase64ToUtf8, disposeObject, escapeHtml, flatPartInfo, frontViewToSpace, furnitureObjects, getBounds, getSheetPrefs, getSpaceCell, getSpaceRoot, groupPartArrayForAspire, hardwareHoleOp, hideGuides, largestVisibleCell, layoutBoundsFromSpace, m, mm, nice, objectBoundsMm, openCreatePiecesDialog, parseDecimalInput, pieceThicknessInfo, placeCustomTemplate, pointWithinPieceTangents, productionObjectKind, projectMaxX, referenceMeshes, removeHardwareLinkedToObjects, renderMachiningVisuals, renderSpaces, renderer, resolvedMachiningCoords, restoreBaseColor, rootForObject, roundMmNumber, sanitizeMachiningForPiece, savePieceThicknessPreference, selectObject, selectSpaceCellByIds, selectedCellInfo, selectedFurnitureRoot, setVisualMode, spaceDefaultMaterial, spaceSelectionKey, toast, uid, updateInspector, updateMeasureBadge, updateSpaceSelectionVisuals }=ctx;
  const runtimeModel=ctx.runtimeModel;
  const state=ctx.state;

  // 1.300.35 · seleção de vários vãos para criar uma frente/porta única.
  function spaceMultiSelectionEntries() {
      const out = [];
      for (const [key, ref] of [...runtimeModel.selectedSpaceCells.entries()]) {
          const root = getSpaceRoot(ref.rootId), cell = getSpaceCell(ref.rootId, ref.cellId);
          if (!root || !cell) {
              runtimeModel.selectedSpaceCells.delete(key);
              continue;
          }
          out.push({ key, root, cell, rootId: ref.rootId, cellId: ref.cellId });
      }
      return out;
  }
  
  function spaceMultiSelectionInfo() {
      const entries = spaceMultiSelectionEntries();
      const envelope = buildDoorRegionEnvelope(entries, { frontTol: .006 });
      if (!envelope.ok)
          return envelope;
      const cell = envelope.cell;
      return {
          ...envelope,
          size: cellSize(cell), center: cellCenter(cell)
      };
  }
  
  // 1.311.00-r2 · o menu persistente inferior de seleção foi aposentado.
  // A API é mantida para compatibilidade com os módulos existentes, mas a única
  // interface visível para Porta/Gaveta passa a ser o menu rápido central
  // (duplo clique no PC / toque longo no celular). No celular, a seleção múltipla
  // é feita com duplo toque; no PC, com Ctrl+clique.
  function ensureSpaceMultiSelectBar() {
      let bar = document.getElementById('spaceMultiSelectBar');
      if (!bar) {
          bar = document.createElement('div');
          bar.id = 'spaceMultiSelectBar';
          bar.hidden = true;
          bar.style.display = 'none';
          document.body.appendChild(bar);
      }
      bar.hidden = true;
      bar.style.display = 'none';
      return bar;
  }
  
  function updateSpaceMultiSelectBar() {
      const bar = document.getElementById('spaceMultiSelectBar');
      if (bar) {
          bar.hidden = true;
          bar.style.display = 'none';
      }
  }
  
  function clearSpaceMultiSelection({ notify = false } = {}) {
      const had = runtimeModel.selectedSpaceCells.size > 0;
      runtimeModel.selectedSpaceCells.clear();
      state.doorRegionSelectionMode = false;
      updateSpaceSelectionVisuals();
      updateSpaceMultiSelectBar();
      if (notify && had)
          toast('Seleção múltipla cancelada');
  }
  
  function setSingleSpaceDoorReference(rootId, cellId) {
      const root = getSpaceRoot(rootId), cell = getSpaceCell(rootId, cellId);
      if (!root || !cell)
          return false;
      runtimeModel.selectedSpaceCells.clear();
      runtimeModel.selectedSpaceCells.set(spaceSelectionKey(rootId, cellId), { rootId, cellId });
      state.doorRegionSelectionMode = false;
      updateSpaceSelectionVisuals();
      updateSpaceMultiSelectBar();
      return true;
  }
  
  function toggleSpaceMultiSelection(rootId, cellId, { notify = true } = {}) {
      const root = getSpaceRoot(rootId), cell = getSpaceCell(rootId, cellId);
      if (!root || !cell)
          return false;
      const existing = spaceMultiSelectionEntries();
      if (existing.length && existing[0].rootId !== rootId) {
          runtimeModel.selectedSpaceCells.clear();
          state.doorRegionSelectionMode = false;
      }
      const key = spaceSelectionKey(rootId, cellId), wasSelected = runtimeModel.selectedSpaceCells.has(key);
      if (wasSelected)
          runtimeModel.selectedSpaceCells.delete(key);
      else
          runtimeModel.selectedSpaceCells.set(key, { rootId, cellId });
      if (state.selected) {
          restoreBaseColor(state.selected);
          state.selected = null;
          $('inspector').style.display = 'none';
      }
      $('spaceActions').style.display = 'none';
      state.lastEdit = null;
      runtimeModel.liveLabel.style.display = 'none';
      hideGuides();
      const remaining = spaceMultiSelectionEntries();
      if (remaining.length) {
          const preferred = (!wasSelected) ? { rootId, cellId } : remaining[remaining.length - 1];
          state.selectedSpaceCell = { rootId: preferred.rootId, cellId: preferred.cellId };
          state.activeSpaceRootId = preferred.rootId;
      }
      else {
          state.selectedSpaceCell = null;
          state.activeSpaceRootId = null;
      }
      updateSpaceSelectionVisuals();
      updateSpaceMultiSelectBar();
      updateMeasureBadge();
      if (notify) {
          if (remaining.length)
              toast(`${remaining.length} espaço(s) selecionado(s) · ${navigator.maxTouchPoints ? '2 toques selecionam outro · segure para abrir' : 'Ctrl + clique em outro espaço'}`);
          else
              toast('Seleção múltipla vazia');
      }
      return true;
  }
  
  function pieceCreationTargetInfo() {
      if (state.pieceCreateType === 'doors' && state.doorRegionSelectionMode) {
          const info = spaceMultiSelectionInfo();
          return info.ok ? info : null;
      }
      return selectedCellInfo();
  }
  
  function openDoorFromSpaceSelection() {
      const info = spaceMultiSelectionInfo();
      if (!info.ok) {
          toast(info.reason);
          return false;
      }
      state.doorRegionSelectionMode = true;
      openCreatePiecesDialog('doors', { doorRegion: true });
      return true;
  }
  
  // 1.300.38 · menu rápido do vão: segurar no celular ou duplo clique no PC.
  // Porta usa todas as referências selecionadas; Gavetas usa o vão tocado por último.
  let spaceQuickMenuTarget = null;
  
  function ensureSpaceQuickCreateMenu() {
      let overlay = document.getElementById('spaceQuickCreateMenu');
      if (overlay)
          return overlay;
      overlay = document.createElement('div');
      overlay.id = 'spaceQuickCreateMenu';
      overlay.className = 'spaceQuickCreateMenu';
      overlay.innerHTML = `<div class="spaceQuickCreateCard" role="dialog" aria-modal="true" aria-labelledby="spaceQuickCreateTitle">
      <div class="spaceQuickCreateHead"><div><strong id="spaceQuickCreateTitle">Adicionar ao espaço</strong><span id="spaceQuickCreateInfo"></span></div><button id="spaceQuickCreateClose" class="spaceQuickClose" aria-label="Fechar">×</button></div>
      <div class="spaceQuickCreateGrid">
        <button id="spaceQuickDoorBtn" class="spaceQuickAction"><b>🚪</b><span><strong>Criar porta</strong><small>Usa os espaços selecionados</small></span></button>
        <button id="spaceQuickDrawerBtn" class="spaceQuickAction"><b>▤</b><span><strong>Criar gavetas</strong><small>Usa este vão como referência</small></span></button>
      </div>
      <button id="spaceQuickRemoveRef" class="spaceQuickRemove" style="display:none">− Remover este espaço da seleção</button>
    </div>`;
      document.body.appendChild(overlay);
      const close = () => closeSpaceQuickCreateMenu();
      overlay.querySelector('#spaceQuickCreateClose').addEventListener('click', close);
      overlay.addEventListener('pointerdown', e => { if (e.target === overlay)
          close(); });
      overlay.querySelector('#spaceQuickDoorBtn').addEventListener('click', () => {
          closeSpaceQuickCreateMenu();
          openDoorFromSpaceSelection();
      });
      overlay.querySelector('#spaceQuickDrawerBtn').addEventListener('click', () => {
          const t = spaceQuickMenuTarget;
          closeSpaceQuickCreateMenu();
          if (!t)
              return;
          selectSpaceCellByIds(t.rootId, t.cellId, { showMenu: false, preserveMulti: true });
          openDrawerSystemDialog();
      });
      overlay.querySelector('#spaceQuickRemoveRef').addEventListener('click', () => {
          const t = spaceQuickMenuTarget;
          if (!t)
              return;
          const key = spaceSelectionKey(t.rootId, t.cellId);
          if (runtimeModel.selectedSpaceCells.size > 1 && runtimeModel.selectedSpaceCells.has(key)) {
              runtimeModel.selectedSpaceCells.delete(key);
              const rem = spaceMultiSelectionEntries();
              if (rem.length) {
                  const last = rem[rem.length - 1];
                  selectSpaceCellByIds(last.rootId, last.cellId, { showMenu: false, preserveMulti: true });
              }
              updateSpaceSelectionVisuals();
              updateSpaceMultiSelectBar();
              updateMeasureBadge();
          }
          closeSpaceQuickCreateMenu();
      });
      return overlay;
  }
  
  function closeSpaceQuickCreateMenu() {
      const el = document.getElementById('spaceQuickCreateMenu');
      if (el)
          el.classList.remove('show');
      spaceQuickMenuTarget = null;
  }
  
  function prepareSpaceQuickMenuTarget(rootId, cellId, { addReference = false } = {}) {
      const root = getSpaceRoot(rootId), cell = getSpaceCell(rootId, cellId);
      if (!root || !cell)
          return false;
      const key = spaceSelectionKey(rootId, cellId), entries = spaceMultiSelectionEntries();
      const sameRoot = !entries.length || entries.every(e => e.rootId === rootId);
      if (!sameRoot) {
          runtimeModel.selectedSpaceCells.clear();
      }
      if (!runtimeModel.selectedSpaceCells.size) {
          selectSpaceCellByIds(rootId, cellId, { showMenu: false });
          setSingleSpaceDoorReference(rootId, cellId);
      }
      else {
          if (addReference && !runtimeModel.selectedSpaceCells.has(key))
              runtimeModel.selectedSpaceCells.set(key, { rootId, cellId });
          else if (!runtimeModel.selectedSpaceCells.has(key)) {
              runtimeModel.selectedSpaceCells.clear();
              runtimeModel.selectedSpaceCells.set(key, { rootId, cellId });
          }
          selectSpaceCellByIds(rootId, cellId, { showMenu: false, preserveMulti: true });
          updateSpaceSelectionVisuals();
          updateSpaceMultiSelectBar();
          updateMeasureBadge();
      }
      return true;
  }
  
  function openSpaceQuickCreateMenu(rootId, cellId, { addReference = false } = {}) {
      if (!prepareSpaceQuickMenuTarget(rootId, cellId, { addReference }))
          return false;
      const root = getSpaceRoot(rootId), cell = getSpaceCell(rootId, cellId), sz = cellSize(cell);
      spaceQuickMenuTarget = { rootId, cellId };
      const overlay = ensureSpaceQuickCreateMenu(), count = runtimeModel.selectedSpaceCells.size;
      const info = overlay.querySelector('#spaceQuickCreateInfo');
      if (info)
          info.textContent = `${count} espaço(s) selecionado(s) · este vão L ${nice(mm(sz.width))} × A ${nice(mm(sz.height))} mm`;
      const door = overlay.querySelector('#spaceQuickDoorBtn'), multi = spaceMultiSelectionInfo();
      if (door) {
          door.disabled = !multi.ok;
          door.title = multi.ok ? 'Criar porta na região selecionada' : multi.reason;
      }
      const remove = overlay.querySelector('#spaceQuickRemoveRef');
      if (remove)
          remove.style.display = (count > 1 && runtimeModel.selectedSpaceCells.has(spaceSelectionKey(rootId, cellId))) ? 'block' : 'none';
      overlay.classList.add('show');
      return true;
  }
  
  function pickSpaceCellAtClient(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height)
          return null;
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      runtimeModel.raycaster.setFromCamera(ndc, camera);
      const hits = runtimeModel.raycaster.intersectObjects(referenceMeshes(), false);
      const hit = hits.find(h => h.object?.userData?.kind === 'space-cell');
      if (!hit)
          return null;
      return { rootId: hit.object.userData.spaceRootId, cellId: hit.object.userData.spaceCellId };
  }
  
  function openDrawerFromSpaceSelection() {
      const t = state.selectedSpaceCell || spaceMultiSelectionEntries().at(-1);
      if (!t) {
          toast('Selecione um espaço para criar as gavetas');
          return false;
      }
      selectSpaceCellByIds(t.rootId, t.cellId, { showMenu: false, preserveMulti: true });
      openDrawerSystemDialog();
      return true;
  }
  
  function isDoorObject(o) {
      if (!o)
          return false;
      const u = o.userData || {}, name = String(u.name || '');
      const doorSystemFace = String(u.doorSystem?.role || '').startsWith('leaf-face');
      return doorSystemFace || !!u.doorConfig || /^Porta(?:\s|$)/i.test(name) || u.drawerRole === 'drawer-front' || /^Frente de gaveta(?:\s|$)/i.test(name);
  }
  
  function doorObjectsForRoot(rootId) {
      return runtimeModel.objects.filter(o => o.userData?.spaceRootId === rootId && isDoorObject(o));
  }
  
  function doorObjectShouldBeVisible(o, root = null) {
      if (!isDoorObject(o))
          return o?.visible !== false;
      root = root || (o.userData?.spaceRootId ? getSpaceRoot(o.userData.spaceRootId) : null);
      return !o?.userData?.hiddenByUser && !state.quickFrontFacesHidden && !(root?.doorsHidden);
  }
  
  function syncQuickFrontVisibilityButton() {
      const btn = $('cadFrontQuickToggle');
      if (!btn)
          return;
      btn.classList.toggle('active', !!state.quickFrontFacesHidden);
      btn.setAttribute('aria-pressed', state.quickFrontFacesHidden ? 'true' : 'false');
      btn.textContent = state.quickFrontFacesHidden ? '◩ Mostrar portas/frentes' : '◫ Ocultar portas/frentes';
      btn.title = state.quickFrontFacesHidden ? 'Mostrar portas e frentes de gaveta' : 'Ocultar portas e frentes de gaveta';
  }
  
  function applyDoorVisibility(root) {
      if (!root)
          return;
      for (const o of doorObjectsForRoot(root.id)) {
          const visible = doorObjectShouldBeVisible(o, root);
          o.visible = visible;
          o.userData.hiddenByDoors = !visible;
      }
      if (state.selected && state.selected.userData?.spaceRootId === root.id && isDoorObject(state.selected) && state.selected.visible === false) {
          restoreBaseColor(state.selected);
          state.selected = null;
          $('inspector').style.display = 'none';
      }
      updateDoorHandleVisuals();
  }
  
  function applyAllDoorVisibility() {
      for (const root of runtimeModel.spaceRoots)
          applyDoorVisibility(root);
      // Também cobre uma porta/frente importada que ainda não esteja vinculada a um espaço.
      for (const o of runtimeModel.objects) {
          if (!isDoorObject(o) || o.userData?.spaceRootId)
              continue;
          const visible = doorObjectShouldBeVisible(o, null);
          o.visible = visible;
          o.userData.hiddenByDoors = !visible;
          if (state.selected === o && !visible) {
              restoreBaseColor(o);
              state.selected = null;
              $('inspector').style.display = 'none';
          }
      }
      syncQuickFrontVisibilityButton();
  }
  
  function updateDoorsToggleButton(root = null) {
      const btn = $('toggleDoorsBtn');
      if (!btn)
          return;
      root = root || (state.selectedSpaceCell ? getSpaceRoot(state.selectedSpaceCell.rootId) : null);
      btn.textContent = (root && root.doorsHidden) ? 'Mostrar portas' : 'Ocultar portas';
  }
  
  function toggleDoorsForActiveSpace() {
      const root = state.selectedSpaceCell ? getSpaceRoot(state.selectedSpaceCell.rootId) : (state.activeSpaceRootId ? getSpaceRoot(state.activeSpaceRootId) : null);
      if (!root) {
          toast('Selecione um espaço');
          return;
      }
      const doors = doorObjectsForRoot(root.id);
      if (!doors.length) {
          toast('Este espaço ainda não tem portas');
          return;
      }
      root.doorsHidden = !root.doorsHidden;
      applyDoorVisibility(root);
      updateDoorsToggleButton(root);
      commitHistory();
      toast(root.doorsHidden ? 'Portas ocultadas' : 'Portas exibidas');
  }
  
  // ---------- 1.300.17 · Puxador externo visual 35 mm horizontal / vertical ----------
  // ---------- 1.100.96 · Configuração salva de portas ----------
  const DOOR_CREATE_CONFIG_KEY = 'designLabDoorCreateConfigV1';
  
  function captureDoorCreateConfig() {
      return {
          version: 1,
          count: String($('doorCount')?.value || '2'),
          gapMiddle: String($('doorGapMiddle')?.value || '2'),
          gapLeft: String($('doorGapLeft')?.value || '2'),
          gapRight: String($('doorGapRight')?.value || '2'),
          gapTop: String($('doorGapTop')?.value || '2'),
          gapBottom: String($('doorGapBottom')?.value || '2'),
          handleType: String($('doorHandleType')?.value || 'none'),
          handleSize: String($('doorHandleSize')?.value || '20'),
          handleOrientation: String($('doorHandleOrientation')?.value || 'horizontal'),
          cavaPosition: String($('doorCavaPosition')?.value || 'top'),
          createHingeHoles: !!$('doorCreateHingeHoles')?.checked,
          hingeCount: String($('doorHingeCount')?.value || 'auto'),
          hingeSide: String($('doorHingeSide')?.value || 'auto'),
          cupDiameter: String($('doorHingeCupDiameter')?.value || '35'),
          cupDepth: String($('doorHingeCupDepth')?.value || '12'),
          cupEdge: String($('doorHingeCupEdge')?.value || '22.5'),
          hingeEdgeY: String($('doorHingeEdgeY')?.value || '100'),
          createSideHoles: !!$('doorCreateSideHoles')?.checked,
          mountFrontOffset: String($('doorMountFrontOffset')?.value || '37'),
          mountSpacing: String($('doorMountSpacing')?.value || '32'),
          mountDiameter: String($('doorMountDiameter')?.value || '5'),
          mountDepth: String($('doorMountDepth')?.value || '12'),
          savedAt: new Date().toISOString()
      };
  }
  
  function readDoorCreateConfig() {
      try {
          const cfg = JSON.parse(localStorage.getItem(DOOR_CREATE_CONFIG_KEY) || 'null');
          return cfg && typeof cfg === 'object' ? cfg : null;
      }
      catch (_) {
          return null;
      }
  }
  
  function applyDoorCreateConfig(cfg = readDoorCreateConfig()) {
      if (!cfg)
          return false;
      const set = (id, value) => { const el = $(id); if (el && value !== undefined && value !== null)
          el.value = String(value); };
      set('doorCount', cfg.count);
      set('doorGapMiddle', cfg.gapMiddle);
      set('doorGapLeft', cfg.gapLeft);
      set('doorGapRight', cfg.gapRight);
      set('doorGapTop', cfg.gapTop);
      set('doorGapBottom', cfg.gapBottom);
      // 1.300.17: o puxador externo foi removido. Configurações antigas migram para "Sem puxador".
      set('doorHandleType', cfg.handleType === 'cava' ? 'cava' : 'none');
      set('doorHandleSize', cfg.handleSize);
      set('doorHandleOrientation', cfg.handleOrientation || 'horizontal');
      syncDoorCavaPositionOptions(cfg.cavaPosition);
      if ($('doorCreateHingeHoles') && typeof cfg.createHingeHoles === 'boolean')
          $('doorCreateHingeHoles').checked = cfg.createHingeHoles;
      set('doorHingeCount', cfg.hingeCount);
      set('doorHingeSide', cfg.hingeSide);
      set('doorHingeCupDiameter', cfg.cupDiameter);
      set('doorHingeCupDepth', cfg.cupDepth);
      set('doorHingeCupEdge', cfg.cupEdge);
      set('doorHingeEdgeY', cfg.hingeEdgeY);
      if ($('doorCreateSideHoles') && typeof cfg.createSideHoles === 'boolean')
          $('doorCreateSideHoles').checked = cfg.createSideHoles;
      set('doorMountFrontOffset', cfg.mountFrontOffset);
      set('doorMountSpacing', cfg.mountSpacing);
      set('doorMountDiameter', cfg.mountDiameter);
      set('doorMountDepth', cfg.mountDepth);
      updateDoorCreationVisibility();
      return true;
  }
  
  function saveDoorCreateConfig({ silent = false } = {}) {
      if (state.pieceCreateType !== 'doors') {
          if (!silent)
              toast('Selecione Portas para salvar esta configuração');
          return false;
      }
      try {
          const cfg = captureDoorCreateConfig();
          localStorage.setItem(DOOR_CREATE_CONFIG_KEY, JSON.stringify(cfg));
          savePieceThicknessPreference({ silent: true });
          if (!silent)
              toast('Configuração de portas salva · será carregada nas próximas criações');
          return true;
      }
      catch (err) {
          console.error('Salvar configuração de portas:', err);
          if (!silent)
              toast('Não foi possível salvar a configuração de portas');
          return false;
      }
  }
  
  // ---------- 1.100.96 · Portas paramétricas + dobradiças ----------
  function doorFieldNumber(id, fallback = 0, min = -Infinity, max = Infinity) {
      const n = parseDecimalInput($(id)?.value);
      const v = Number.isFinite(n) ? n : fallback;
      return Math.max(min, Math.min(max, v));
  }
  
  function doorAutoHingeCount(heightMm) {
      const h = Math.max(0, Number(heightMm) || 0);
      if (h <= 900)
          return 2;
      if (h <= 1500)
          return 3;
      if (h <= 2100)
          return 4;
      return 5;
  }
  
  function doorHingeCountResolved(heightMm) {
      const raw = String($('doorHingeCount')?.value || 'auto');
      return raw === 'auto' ? doorAutoHingeCount(heightMm) : Math.max(1, Math.min(6, Math.round(Number(raw) || 2)));
  }
  
  function syncDoorCavaPositionOptions(preferred = null) {
      const sel = $('doorCavaPosition');
      if (!sel)
          return;
      const orientation = String($('doorHandleOrientation')?.value || 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
      const old = String(preferred ?? sel.value ?? '');
      const opts = orientation === 'vertical'
          ? [['left', 'Esquerda'], ['right', 'Direita']]
          : [['top', 'Cima'], ['bottom', 'Baixo']];
      sel.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
      const valid = opts.some(([v]) => v === old);
      sel.value = valid ? old : opts[0][0];
  }
  
  function doorCreationConfig(size) {
      const count = Math.max(1, Math.min(12, Math.round(doorFieldNumber('doorCount', 2, 1, 12))));
      // Valores negativos nas bordas significam recobrimento (sobreposição)
      // sobre lateral/topo/base; o vão entre folhas continua sempre >= 0.
      const gl = doorFieldNumber('doorGapLeft', 2, -1000), gr = doorFieldNumber('doorGapRight', 2, -1000), gt = doorFieldNumber('doorGapTop', 2, -1000), gb = doorFieldNumber('doorGapBottom', 2, -1000), gm = doorFieldNumber('doorGapMiddle', 2, 0);
      // 1.300.17: somente Sem puxador ou Cava/perfil. O antigo puxador externo visual foi aposentado.
      const handleType = String($('doorHandleType')?.value || 'none') === 'cava' ? 'cava' : 'none';
      const handleSize = handleType === 'cava' ? doorFieldNumber('doorHandleSize', 20, 0, 1000) : 0;
      const handleOrientation = String($('doorHandleOrientation')?.value || 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
      const rawPos = String($('doorCavaPosition')?.value || '');
      const cavaPosition = handleOrientation === 'vertical'
          ? (rawPos === 'right' ? 'right' : 'left')
          : (rawPos === 'bottom' ? 'bottom' : 'top');
      const cavaDiscount = handleType === 'cava' ? handleSize : 0;
      const totalW = mm(size.width), totalH = mm(size.height);
      const doorSlotW = (totalW - gl - gr - gm * Math.max(0, count - 1)) / count;
      const doorSlotH = totalH - gt - gb;
      const verticalDiscount = handleType === 'cava' && handleOrientation === 'vertical' ? cavaDiscount : 0;
      const horizontalDiscount = handleType === 'cava' && handleOrientation === 'horizontal' ? cavaDiscount : 0;
      const doorW = doorSlotW - verticalDiscount;
      const doorH = doorSlotH - horizontalDiscount;
      const leftLift = verticalDiscount && cavaPosition === 'left' ? verticalDiscount : 0;
      const bottomLift = horizontalDiscount && cavaPosition === 'bottom' ? horizontalDiscount : 0;
      const hingeEnabled = !!$('doorCreateHingeHoles')?.checked;
      const mountEnabled = hingeEnabled && !!$('doorCreateSideHoles')?.checked;
      const hingeCount = hingeEnabled ? doorHingeCountResolved(doorH) : 0;
      return {
          count, gl, gr, gt, gb, gm, doorSlotW, doorSlotH, doorW, doorH, leftLift, bottomLift,
          handleType, handleSize, handleOrientation, cavaPosition, cavaDiscount, verticalDiscount, horizontalDiscount,
          hingeEnabled, mountEnabled, hingeCount, hingeSide: String($('doorHingeSide')?.value || 'auto'),
          cupDiameter: doorFieldNumber('doorHingeCupDiameter', 35, .5, 100), cupDepth: doorFieldNumber('doorHingeCupDepth', 12, .5, 100),
          cupEdge: doorFieldNumber('doorHingeCupEdge', 22.5, 1, 500), hingeEdgeY: doorFieldNumber('doorHingeEdgeY', 100, 5, 1000),
          mountFrontOffset: doorFieldNumber('doorMountFrontOffset', 37, 0, 1000), mountSpacing: doorFieldNumber('doorMountSpacing', 32, 0, 500),
          mountDiameter: doorFieldNumber('doorMountDiameter', 5, .5, 50), mountDepth: doorFieldNumber('doorMountDepth', 12, .5, 100)
      };
  }
  
  function doorHingeSideForIndex(index, count, mode) {
      if (mode === 'left' || mode === 'right')
          return mode;
      if (count <= 1)
          return 'left';
      return index < count / 2 ? 'left' : 'right';
  }
  
  function doorHingePositionsMm(heightMm, count, edgeMm) {
      const h = Math.max(1, Number(heightMm) || 1), n = Math.max(1, Math.round(Number(count) || 1));
      if (n === 1)
          return [h / 2];
      const edge = Math.max(5, Math.min(Number(edgeMm) || 100, Math.max(5, h / 2 - 1)));
      const span = Math.max(0, h - 2 * edge);
      if (span < .001)
          return [h / 2];
      const out = [];
      for (let i = 0; i < n; i++)
          out.push(edge + span * (i / (n - 1)));
      return out;
  }
  
  // 1.300.17 · PUXADOR VISUAL SIMPLES
  // Sem STL e sem interferir no plano de corte: um pequeno volume de ferragem
  // acompanha a porta e aparece no 3D, nas vistas ortográficas e no layout técnico.
  const DOOR_HANDLE_VISUAL_LENGTH_MM = 35;
  
  const DOOR_HANDLE_VISUAL_BAR_MM = 10;
  
  const DOOR_HANDLE_VISUAL_PROJECTION_MM = 12;
  
  const DOOR_HANDLE_VISUAL_EDGE_MM = 55;
  
  function doorHandleOwnerForVisual(v) {
      const id = String(v?.userData?.doorHandleOwnerPartId || '');
      return id ? runtimeModel.objects.find(o => String(o?.userData?.partId || '') === id) || null : null;
  }
  
  function doorHandleVisualSpec(owner) {
      const cfg = owner?.userData?.doorConfig;
      if (!cfg || cfg.handle?.type !== 'external')
          return null;
      const orientation = String(cfg.handle?.orientation || 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
      const b = getBounds(owner), w = Math.max(.001, b.maxX - b.minX), h = Math.max(.001, b.maxY - b.minY);
      const hingeSide = String(cfg.hinge?.side || 'left') === 'right' ? 'right' : 'left';
      const inset = Math.min(m(DOOR_HANDLE_VISUAL_EDGE_MM), Math.max(m(15), w * .18));
      const x = hingeSide === 'left' ? b.maxX - inset : b.minX + inset;
      const y = (b.minY + b.maxY) / 2;
      const z = b.maxZ + m(DOOR_HANDLE_VISUAL_PROJECTION_MM) / 2;
      const maxLen = orientation === 'vertical' ? Math.max(m(20), h * .45) : Math.max(m(20), w * .45);
      const len = Math.min(m(DOOR_HANDLE_VISUAL_LENGTH_MM), maxLen);
      const bar = m(DOOR_HANDLE_VISUAL_BAR_MM), depth = m(DOOR_HANDLE_VISUAL_PROJECTION_MM);
      return orientation === 'vertical'
          ? { width: bar, height: len, depth, x, yBase: y - len / 2, z, orientation }
          : { width: len, height: bar, depth, x, yBase: y - bar / 2, z, orientation };
  }
  
  function updateDoorHandleVisualTransform(v) {
      const owner = doorHandleOwnerForVisual(v), spec = doorHandleVisualSpec(owner);
      if (!owner || !spec) {
          v.visible = false;
          return false;
      }
      v.userData.width = spec.width;
      v.userData.height = spec.height;
      v.userData.depth = spec.depth;
      v.scale.set(spec.width, spec.height, spec.depth);
      v.position.set(spec.x, spec.yBase + spec.height / 2, spec.z);
      v.rotation.set(0, 0, 0);
      v.userData.name = `Puxador visual · ${spec.orientation === 'vertical' ? 'vertical' : 'horizontal'}`;
      const root = owner.userData?.spaceRootId ? getSpaceRoot(owner.userData.spaceRootId) : null;
      const shown = !!state.cadHardwareVisible && doorObjectShouldBeVisible(owner, root);
      v.visible = shown;
      if (v.userData?.visualEdges)
          v.userData.visualEdges.visible = shown;
      return true;
  }
  
  function updateDoorHandleVisuals() {
      for (const v of runtimeModel.objects) {
          if (v?.userData?.doorHandleVisual)
              updateDoorHandleVisualTransform(v);
      }
  }
  
  function createDoorHandleVisual(owner) {
      const spec = doorHandleVisualSpec(owner);
      if (!spec)
          return null;
      const previous = state.selected;
      const v = createBox({
          width: spec.width, height: spec.height, depth: spec.depth, x: spec.x, yBase: spec.yBase, z: spec.z,
          name: `Puxador visual · ${spec.orientation === 'vertical' ? 'vertical' : 'horizontal'}`,
          kind: 'hardware-visual', materialType: 'Ferragem', baseColor: 0x555b60,
          spaceRootId: owner.userData?.spaceRootId || null, excludeFromCutList: true,
          labelMeta: { schemaVersion: 1, enabled: false, custom: {} },
          doorHandleVisual: true, doorHandleOwnerPartId: owner.userData?.partId || null
      }, false);
      updateDoorHandleVisualTransform(v);
      if (previous && runtimeModel.objects.includes(previous))
          selectObject(previous);
      return v;
  }
  
  function removeDoorHandleVisualsForOwners(owners) {
      const ids = new Set((owners || []).map(o => String(o?.userData?.partId || '')).filter(Boolean));
      if (!ids.size)
          return 0;
      let n = 0;
      for (const v of [...runtimeModel.objects]) {
          if (!v?.userData?.doorHandleVisual || !ids.has(String(v.userData.doorHandleOwnerPartId || '')))
              continue;
          const i = runtimeModel.objects.indexOf(v);
          if (i >= 0)
              runtimeModel.objects.splice(i, 1);
          disposeObject(v);
          n++;
      }
      return n;
  }
  
  function doorMountPanelCandidate(door, hingeSide, rootId, hingeWorldY) {
      const db = objectBoundsMm(door), edgeX = hingeSide === 'left' ? db.minX : db.maxX;
      let best = null;
      for (const o of runtimeModel.objects) {
          if (o === door || o.userData?.spaceRootId !== rootId || isDoorObject(o) || o.userData?.kind === 'hardware-visual' || o.userData?.kind === 'cylinder')
              continue;
          const ti = pieceThicknessInfo(o);
          if (!ti || ti.thicknessAxis !== 'x')
              continue;
          const b = objectBoundsMm(o);
          if (hingeWorldY < b.minY - 2 || hingeWorldY > b.maxY + 2)
              continue;
          if (hingeSide === 'left' && o.position.x > door.position.x + .03)
              continue;
          if (hingeSide === 'right' && o.position.x < door.position.x - .03)
              continue;
          const faceX = hingeSide === 'left' ? b.maxX : b.minX;
          const distance = Math.abs(faceX - edgeX);
          if (distance > 80)
              continue;
          const frontDistance = Math.abs(b.maxZ - db.maxZ);
          const name = String(o.userData?.name || '');
          const structural = /lateral|divis[aã]o vertical/i.test(name) ? -8 : 0;
          const score = distance + Math.min(50, frontDistance * .08) + structural;
          if (!best || score < best.score)
              best = { object: o, bounds: b, score, distance };
      }
      return best?.object || null;
  }
  
  function appendDoorHingeDrilling(door, root, cfg, hingeSide) {
      if (!cfg.hingeEnabled)
          return { hinges: 0, mountHoles: 0, missingMount: 0 };
      const db = objectBoundsMm(door), positions = doorHingePositionsMm(cfg.doorH, cfg.hingeCount, cfg.hingeEdgeY);
      const cupR = cfg.cupDiameter / 2;
      const cupEdge = Math.max(cupR, Math.min(cfg.cupEdge, cfg.doorW - cupR));
      let hinges = 0, mountHoles = 0, missingMount = 0;
      for (const localY of positions) {
          const worldY = db.minY + localY;
          const target = cfg.mountEnabled ? doorMountPanelCandidate(door, hingeSide, root.id, worldY) : null;
          const instanceId = uid('doorhinge');
          const metaBase = { presetId: 'builtin-door-hinge-auto', name: 'Dobradiça de porta', sourcePartId: door.userData.partId || null, contactPartId: target?.userData?.partId || null };
          const cupWorld = { x: hingeSide === 'left' ? db.minX + cupEdge : db.maxX - cupEdge, y: worldY, z: db.minZ };
          const cupOp = hardwareHoleOp(door, cupWorld, '+z', { diameter: cfg.cupDiameter, depth: cfg.cupDepth }, { ...metaBase, role: 'selected', contactName: target?.userData?.name || 'Lateral do móvel' }, instanceId);
          (door.userData.machining || (door.userData.machining = [])).push(cupOp);
          hinges++;
          if (cfg.mountEnabled) {
              if (!target) {
                  missingMount++;
                  continue;
              }
              const tb = objectBoundsMm(target), r = cfg.mountDiameter / 2;
              const z = Math.max(tb.minZ + r, Math.min(tb.maxZ - r, tb.maxZ - cfg.mountFrontOffset));
              const entry = target.position.x < door.position.x ? '-x' : '+x';
              const offsets = cfg.mountSpacing > .001 ? [-cfg.mountSpacing / 2, cfg.mountSpacing / 2] : [0];
              let made = 0;
              for (const off of offsets) {
                  const y = worldY + off;
                  if (y < tb.minY + r - .01 || y > tb.maxY - r + .01)
                      continue;
                  const op = hardwareHoleOp(target, { x: target.position.x * 1000, y, z }, entry, { diameter: cfg.mountDiameter, depth: cfg.mountDepth }, { ...metaBase, role: 'contact', contactName: door.userData?.name || 'Porta' }, instanceId);
                  (target.userData.machining || (target.userData.machining = [])).push(op);
                  made++;
                  mountHoles++;
              }
              if (!made)
                  missingMount++;
              sanitizeMachiningForPiece(target);
          }
      }
      sanitizeMachiningForPiece(door);
      return { hinges, mountHoles, missingMount };
  }
  
  // 1.100.96 · inverter lado da dobradiça pelo menu de configuração da porta.
  function doorInspectorRuntimeConfig(door) {
      const h = door?.userData?.doorConfig?.hinge || {};
      const doorW = mm(door?.userData?.width || 0), doorH = mm(door?.userData?.height || 0);
      return {
          doorW, doorH,
          hingeEnabled: h.enabled !== false,
          mountEnabled: h.mountEnabled !== false,
          hingeCount: Math.max(1, Math.min(6, Math.round(Number(h.count) || doorAutoHingeCount(doorH)))),
          cupDiameter: Math.max(.5, Number(h.cupDiameter) || 35),
          cupDepth: Math.max(.5, Number(h.cupDepth) || 12),
          cupEdge: Math.max(1, Number(h.cupEdge) || 22.5),
          hingeEdgeY: Math.max(5, Number(h.edgeY) || 100),
          mountFrontOffset: Math.max(0, Number(h.mountFrontOffset) || 37),
          mountSpacing: Math.max(0, Number(h.mountSpacing) || 32),
          mountDiameter: Math.max(.5, Number(h.mountDiameter) || 5),
          mountDepth: Math.max(.5, Number(h.mountDepth) || 12)
      };
  }
  
  function removeDoorAutomaticHinges(door) {
      if (!door)
          return { instances: 0, operations: 0 };
      const partId = String(door.userData?.partId || '');
      const ids = new Set();
      for (const o of runtimeModel.objects) {
          for (const op of (Array.isArray(o.userData?.machining) ? o.userData.machining : [])) {
              if (op?.hardwarePresetId !== 'builtin-door-hinge-auto' || !op.hardwareInstanceId)
                  continue;
              if (o === door || (partId && String(op.hardwareSourcePartId || '') === partId))
                  ids.add(op.hardwareInstanceId);
          }
      }
      let operations = 0;
      if (ids.size) {
          for (const o of runtimeModel.objects) {
              const arr = Array.isArray(o.userData?.machining) ? o.userData.machining : null;
              if (!arr)
                  continue;
              const keep = arr.filter(op => !op?.hardwareInstanceId || !ids.has(op.hardwareInstanceId));
              operations += arr.length - keep.length;
              if (keep.length !== arr.length)
                  o.userData.machining = keep;
          }
      }
      return { instances: ids.size, operations };
  }
  
  function setSelectedDoorHingeSide(side) {
      const door = state.selected;
      if (!door?.userData?.doorConfig) {
          toast('Selecione uma porta');
          return false;
      }
      side = side === 'right' ? 'right' : 'left';
      const root = rootForObject(door);
      if (!root) {
          toast('Não encontrei o espaço desta porta');
          return false;
      }
      const dc = door.userData.doorConfig;
      dc.hinge = dc.hinge || {};
      if (dc.hinge.enabled === false) {
          toast('Esta porta está sem furação automática de dobradiça');
          return false;
      }
      const current = dc.hinge.side === 'right' ? 'right' : 'left';
      if (current === side) {
          toast(`A dobradiça já está no lado ${side === 'left' ? 'esquerdo' : 'direito'}`);
          return true;
      }
      removeDoorAutomaticHinges(door);
      dc.hinge.side = side;
      const cfg = doorInspectorRuntimeConfig(door);
      const st = appendDoorHingeDrilling(door, root, cfg, side);
      renderMachiningVisuals();
      updateInspector();
      commitHistory();
      const extra = st.missingMount ? ` · ${st.missingMount} posição(ões) sem lateral/divisão encontrada` : '';
      toast(`Dobradiça invertida para o lado ${side === 'left' ? 'esquerdo' : 'direito'} · ${st.hinges} dobradiça(s)${extra}`);
      return true;
  }
  
  function updateDoorCreationVisibility() {
      const isDoors = state.pieceCreateType === 'doors';
      const handleType = String($('doorHandleType')?.value || 'none') === 'cava' ? 'cava' : 'none';
      const cavaOn = isDoors && handleType === 'cava';
      $('doorHandleSizeLabel')?.classList.toggle('hiddenField', !cavaOn);
      $('doorHandleOrientationLabel')?.classList.toggle('hiddenField', !cavaOn);
      $('doorCavaPositionLabel')?.classList.toggle('hiddenField', !cavaOn);
      if (cavaOn)
          syncDoorCavaPositionOptions();
      const hingeOn = isDoors && !!$('doorCreateHingeHoles')?.checked;
      if ($('doorHingeFields'))
          $('doorHingeFields').style.display = hingeOn ? 'block' : 'none';
      const mountOn = hingeOn && !!$('doorCreateSideHoles')?.checked;
      if ($('doorMountFields'))
          $('doorMountFields').style.display = mountOn ? 'block' : 'none';
  }
  
  // ---------- v86: Gavetas / corrediças paramétricas ----------
  const DRAWER_SLIDE_PRESETS = {
      telescopic: {
          id: 'telescopic',
          name: 'Häfele H45 P · telescópica 30 kg',
          manufacturer: 'Häfele',
          model: 'H45 P / Matrix Runner BB S',
          sideClearance: 12.7,
          railHeight: 45.7,
          railWidth: 12.7,
          railFrontInset: 2,
          mountY: 22.85,
          holeDiameter: 5,
          holeDepth: 10,
          drillFrontRef: 37,
          drillOffsets: [0, 128, 224],
          drillAutoByLength: true,
          drillByLength: {
              250: [0, 128],
              300: [0, 128, 224],
              350: [0, 128, 224],
              400: [0, 128, 224, 320],
              450: [0, 128, 224, 352],
              500: [0, 128, 224, 352, 416],
              550: [0, 128, 224, 352, 448],
              600: [0, 128, 224, 352, 480],
              650: [0, 128, 224, 352, 544],
              700: [0, 128, 224, 352, 544]
          },
          catalogByLength: {
              250: '420.50.627', 300: '420.50.632', 350: '420.50.637', 400: '420.50.642',
              450: '420.50.647', 500: '420.50.652', 550: '420.50.657', 600: '420.50.662',
              650: '420.50.667', 700: '420.50.672'
          },
          lengths: [250, 300, 350, 400, 450, 500, 550, 600, 650, 700]
      },
      undermount: {
          id: 'undermount',
          name: 'Oculta · Matrix Runner UM A25',
          manufacturer: 'Häfele',
          model: 'Matrix Runner UM A25',
          sideClearance: 21,
          railHeight: 12,
          railWidth: 39,
          railExtraLength: 18,
          railFrontInset: 0,
          mountY: 10,
          holeDiameter: 5,
          holeDepth: 10,
          drillFrontRef: 37,
          drillOffsets: [0, 128, 224],
          lengths: [250, 270, 300, 350, 400, 450, 500, 550]
      },
      generic: { id: 'generic', name: 'Genérica lateral', sideClearance: 12.5, railHeight: 35, railWidth: 9, mountY: 18, holeDiameter: 5, holeDepth: 10, drillFrontRef: 37, drillOffsets: [0, 64], lengths: [250, 300, 350, 400, 450, 500, 550, 600] }
  };
  
  let drawerTargetRootId = null, drawerTargetCellId = null, drawerEditingSetId = null;
  
  const DRAWER_SLIDE_LIBRARY_KEY = 'miniCadProV88_drawerSlideLibrary';
  
  function getDrawerSlideLibrary() {
      try {
          const a = JSON.parse(localStorage.getItem(DRAWER_SLIDE_LIBRARY_KEY) || '[]');
          return Array.isArray(a) ? a.filter(x => x && x.id && x.name) : [];
      }
      catch (_) {
          return [];
      }
  }
  
  function setDrawerSlideLibrary(a) { try {
      localStorage.setItem(DRAWER_SLIDE_LIBRARY_KEY, JSON.stringify(a || []));
  }
  catch (_) { } }
  
  function refreshDrawerSlideLibrarySelect(keep = '') {
      const sel = $('drawerSavedSlideSelect');
      if (!sel)
          return;
      const arr = getDrawerSlideLibrary();
      sel.innerHTML = '<option value="">Configuração atual / padrão</option>';
      for (const item of arr) {
          const o = document.createElement('option');
          o.value = item.id;
          o.textContent = item.name;
          sel.appendChild(o);
      }
      if (keep && arr.some(x => x.id === keep))
          sel.value = keep;
      else
          sel.value = '';
      $('deleteDrawerSlidePreset').disabled = !sel.value;
  }
  
  function drawerNumberInputValue(value, fallback = '') {
      const n = Number(value);
      return Number.isFinite(n) ? String(roundMmNumber(n, 3)) : String(fallback ?? '');
  }
  
  function captureDrawerSlidePreset() {
      return {
          version: 6,
          slideType: $('drawerSlideType').value,
          lengthMode: $('drawerLengthMode').value,
          sideClearance: (()=>{ const v=Number(String($('drawerSideClearance')?.value ?? '').replace(',', '.')); return Number.isFinite(v) ? v : drawerPreset($('drawerSlideType')?.value).sideClearance; })(),
          frontInset: Number($('drawerFrontInset').value),
          rearClearance: Number($('drawerRearClearance').value),
          createSlides: !!$('drawerCreateSlides').checked,
          createDrilling: !!$('drawerCreateDrilling').checked,
          // Configuração completa da gaveta: quantidade, caixa, frentes, fundo,
          // usinagem, furação e tamponamento ficam reutilizáveis em outro vão.
          count: Number($('drawerCount').value),
          boxHeight: Number($('drawerBoxHeight').value),
          boxThickness: Number($('drawerBoxThickness').value),
          edgeGap: Number($('drawerEdgeGap').value),
          createFronts: !!$('drawerCreateFronts').checked,
          frontThickness: Number($('drawerFrontThickness').value),
          frontGapLeft: Number($('drawerFrontGapLeft').value),
          frontGapRight: Number($('drawerFrontGapRight').value),
          frontGapTop: Number($('drawerFrontGapTop').value),
          frontGapBottom: Number($('drawerFrontGapBottom').value),
          frontGapBetween: Number($('drawerFrontGapBetween').value),
          createTampon: !!$('drawerCreateTampon')?.checked,
          tamponSide: $('drawerTamponSide')?.value || 'left',
          tamponThickness: Number($('drawerTamponThickness')?.value),
          tamponPanelThickness: Number($('drawerTamponPanelThickness')?.value),
          tamponStripDepth: Number($('drawerTamponStripDepth')?.value),
          tamponFrontStrip: !!$('drawerTamponFrontStrip')?.checked,
          tamponRearStrip: !!$('drawerTamponRearStrip')?.checked,
          tamponFrontInset: Number($('drawerTamponFrontInset')?.value),
          tamponRearInset: Number($('drawerTamponRearInset')?.value),
          bottomThickness: Number($('drawerBottomThickness2').value),
          bottomOffset: Number($('drawerBottomOffset').value),
          bottomPassLeft: Number($('drawerBottomPassLeft').value),
          bottomPassRight: Number($('drawerBottomPassRight').value),
          bottomPassFront: Number($('drawerBottomPassFront').value),
          bottomPassBack: Number($('drawerBottomPassBack').value),
          machineBottom: !!$('drawerMachineBottom').checked,
          bottomGrooveClearance: Number($('drawerBottomGrooveClearance').value),
          bottomGrooveDepth: Number($('drawerBottomGrooveDepth').value),
          grooveLeft: !!$('drawerGrooveLeft').checked,
          grooveRight: !!$('drawerGrooveRight').checked,
          grooveFront: !!$('drawerGrooveFront').checked,
          grooveBack: !!$('drawerGrooveBack').checked,
          drillFrontRef: Number($('drawerDrillFrontRef').value),
          drillOffsets: drawerParseDrillOffsets($('drawerDrillOffsets').value),
          drillAutoByLength: !!$('drawerDrillAutoByLength').checked,
          drillVerticalMode: $('drawerDrillVerticalMode')?.value === 'fixed' ? 'fixed' : 'center',
          drillSide: ['left', 'right'].includes($('drawerDrillSide')?.value) ? $('drawerDrillSide').value : 'both',
          drillMountY: Number($('drawerDrillMountY').value),
          drillDiameter: Number($('drawerDrillDiameter').value),
          drillDepth: Number($('drawerDrillDepth').value)
      };
  }
  
  function saveDrawerSlidePresetLibrary() {
      const data = captureDrawerSlidePreset();
      if (!Number.isFinite(data.sideClearance) || data.sideClearance < 0 || !Number.isFinite(data.frontInset) || !Number.isFinite(data.rearClearance)) {
          toast('Confira as medidas da corrediça');
          return;
      }
      const arr = getDrawerSlideLibrary(), selectedId = $('drawerSavedSlideSelect').value;
      let item = selectedId ? arr.find(x => x.id === selectedId) : null;
      let name = String($('drawerSavedSlideName').value || '').trim();
      if (!name && item)
          name = item.name;
      if (!name) {
          const typeName = $('drawerSlideType').selectedOptions?.[0]?.textContent?.trim() || 'Corrediça';
          const length = $('drawerLengthMode').value;
          name = `${typeName}${length === 'auto' ? ' · automática' : ` · ${length} mm`}`;
      }
      if (item) {
          Object.assign(item, data, { name, updatedAt: new Date().toISOString() });
      }
      else {
          item = { id: uid('slidePreset'), name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data };
          arr.push(item);
      }
      setDrawerSlideLibrary(arr);
      refreshDrawerSlideLibrarySelect(item.id);
      $('drawerSavedSlideName').value = item.name;
      toast(selectedId ? 'Configuração da gaveta atualizada' : 'Configuração da gaveta salva');
  }
  
  function applyDrawerSlidePresetLibrary() {
      const id = $('drawerSavedSlideSelect').value, item = getDrawerSlideLibrary().find(x => x.id === id);
      $('deleteDrawerSlidePreset').disabled = !item;
      if (!item) {
          $('drawerSavedSlideName').value = '';
          return;
      }
      $('drawerSavedSlideName').value = item.name;
      $('drawerSlideType').value = item.slideType || 'telescopic';
      $('drawerLengthMode').value = item.lengthMode || 'auto';
      { const savedGap = Number(item.sideClearance); const defGap = drawerPreset(item.slideType).sideClearance; $('drawerSideClearance').value = drawerNumberInputValue(Number.isFinite(savedGap) && savedGap > 0 ? savedGap : defGap, defGap); }
      $('drawerFrontInset').value = drawerNumberInputValue(item.frontInset ?? 5, 5);
      $('drawerRearClearance').value = drawerNumberInputValue(item.rearClearance ?? 10, 10);
      $('drawerCreateSlides').checked = item.createSlides !== false;
      $('drawerCreateDrilling').checked = item.createDrilling !== false;
      if (Number.isFinite(Number(item.count))) $('drawerCount').value = Math.max(1, Math.min(20, Math.round(Number(item.count))));
      if (typeof item.createFronts === 'boolean') $('drawerCreateFronts').checked = item.createFronts;
      if (Number.isFinite(Number(item.frontThickness))) $('drawerFrontThickness').value = drawerNumberInputValue(item.frontThickness);
      if (Number.isFinite(Number(item.frontGapLeft))) $('drawerFrontGapLeft').value = drawerNumberInputValue(item.frontGapLeft);
      if (Number.isFinite(Number(item.frontGapRight))) $('drawerFrontGapRight').value = drawerNumberInputValue(item.frontGapRight);
      if (Number.isFinite(Number(item.frontGapTop))) $('drawerFrontGapTop').value = drawerNumberInputValue(item.frontGapTop);
      if (Number.isFinite(Number(item.frontGapBottom))) $('drawerFrontGapBottom').value = drawerNumberInputValue(item.frontGapBottom);
      if (Number.isFinite(Number(item.frontGapBetween))) $('drawerFrontGapBetween').value = drawerNumberInputValue(item.frontGapBetween);
      if ($('drawerCreateTampon')) $('drawerCreateTampon').checked = item.createTampon === true;
      if ($('drawerTamponSide')) $('drawerTamponSide').value = ['left','right','both'].includes(item.tamponSide) ? item.tamponSide : 'left';
      if (Number.isFinite(Number(item.tamponThickness)) && $('drawerTamponThickness')) $('drawerTamponThickness').value = drawerNumberInputValue(item.tamponThickness);
      if (Number.isFinite(Number(item.tamponPanelThickness)) && $('drawerTamponPanelThickness')) $('drawerTamponPanelThickness').value = drawerNumberInputValue(item.tamponPanelThickness);
      else if ($('drawerTamponPanelThickness')) $('drawerTamponPanelThickness').value = '18';
      if (Number.isFinite(Number(item.tamponStripDepth)) && $('drawerTamponStripDepth')) $('drawerTamponStripDepth').value = drawerNumberInputValue(item.tamponStripDepth);
      if ($('drawerTamponFrontStrip')) $('drawerTamponFrontStrip').checked = item.tamponFrontStrip !== false;
      if ($('drawerTamponRearStrip')) $('drawerTamponRearStrip').checked = item.tamponRearStrip === true;
      if (Number.isFinite(Number(item.tamponFrontInset)) && $('drawerTamponFrontInset')) $('drawerTamponFrontInset').value = drawerNumberInputValue(item.tamponFrontInset);
      if (Number.isFinite(Number(item.tamponRearInset)) && $('drawerTamponRearInset')) $('drawerTamponRearInset').value = drawerNumberInputValue(item.tamponRearInset);
      if (Number.isFinite(Number(item.boxHeight)))
          $('drawerBoxHeight').value = drawerNumberInputValue(item.boxHeight);
      if (Number.isFinite(Number(item.boxThickness)))
          $('drawerBoxThickness').value = drawerNumberInputValue(item.boxThickness);
      if (Number.isFinite(Number(item.edgeGap)))
          $('drawerEdgeGap').value = drawerNumberInputValue(item.edgeGap);
      if (Number.isFinite(Number(item.bottomThickness)))
          $('drawerBottomThickness2').value = drawerNumberInputValue(item.bottomThickness);
      if (Number.isFinite(Number(item.bottomOffset)))
          $('drawerBottomOffset').value = drawerNumberInputValue(item.bottomOffset);
      if (Number.isFinite(Number(item.bottomPassLeft)))
          $('drawerBottomPassLeft').value = drawerNumberInputValue(item.bottomPassLeft);
      if (Number.isFinite(Number(item.bottomPassRight)))
          $('drawerBottomPassRight').value = drawerNumberInputValue(item.bottomPassRight);
      if (Number.isFinite(Number(item.bottomPassFront)))
          $('drawerBottomPassFront').value = drawerNumberInputValue(item.bottomPassFront);
      if (Number.isFinite(Number(item.bottomPassBack)))
          $('drawerBottomPassBack').value = drawerNumberInputValue(item.bottomPassBack);
      if (typeof item.machineBottom === 'boolean')
          $('drawerMachineBottom').checked = item.machineBottom;
      if (Number.isFinite(Number(item.bottomGrooveClearance)))
          $('drawerBottomGrooveClearance').value = drawerNumberInputValue(item.bottomGrooveClearance);
      if (Number.isFinite(Number(item.bottomGrooveDepth)))
          $('drawerBottomGrooveDepth').value = drawerNumberInputValue(item.bottomGrooveDepth);
      $('drawerGrooveLeft').checked = item.grooveLeft !== false;
      $('drawerGrooveRight').checked = item.grooveRight !== false;
      $('drawerGrooveFront').checked = item.grooveFront === true;
      $('drawerGrooveBack').checked = item.grooveBack === true;
      const savedDrillPreset = drawerPreset(item.slideType || 'telescopic');
      const drillDefault = drawerDrillDefaults(savedDrillPreset);
      $('drawerDrillFrontRef').value = drawerNumberInputValue(Number.isFinite(Number(item.drillFrontRef)) ? Number(item.drillFrontRef) : drillDefault.frontRef);
      $('drawerDrillOffsets').value = drawerParseDrillOffsets(item.drillOffsets?.length ? item.drillOffsets : drillDefault.offsets).map(n => nice(n)).join(', ');
      $('drawerDrillAutoByLength').checked = typeof item.drillAutoByLength === 'boolean'
          ? item.drillAutoByLength
          : !!savedDrillPreset.drillByLength;
      // Configurações antigas continuam em medida fixa para não deslocar furos já existentes.
      $('drawerDrillVerticalMode').value = item.drillVerticalMode === 'center' ? 'center' : 'fixed';
      $('drawerDrillSide').value = ['left', 'right'].includes(item.drillSide) ? item.drillSide : 'both';
      $('drawerDrillMountY').value = drawerNumberInputValue(Number.isFinite(Number(item.drillMountY)) ? Number(item.drillMountY) : drillDefault.mountY);
      $('drawerDrillDiameter').value = drawerNumberInputValue(Number.isFinite(Number(item.drillDiameter)) ? Number(item.drillDiameter) : drillDefault.diameter);
      $('drawerDrillDepth').value = drawerNumberInputValue(Number.isFinite(Number(item.drillDepth)) ? Number(item.drillDepth) : drillDefault.depth);
      drawerApplyPresetDefaults(false);
      updateDrawerBottomMachiningFields();
      updateDrawerDrillingFields();
      updateDrawerTamponFields();
      updateDrawerFrontFields();
  }
  
  function deleteDrawerSlidePresetLibrary() {
      const id = $('drawerSavedSlideSelect').value, item = getDrawerSlideLibrary().find(x => x.id === id);
      if (!item) {
          toast('Escolha uma configuração salva');
          return;
      }
      if (!window.confirm(`Excluir “${item.name}” da biblioteca?`))
          return;
      setDrawerSlideLibrary(getDrawerSlideLibrary().filter(x => x.id !== id));
      refreshDrawerSlideLibrarySelect();
      $('drawerSavedSlideName').value = '';
      toast('Corrediça removida da biblioteca');
  }
  
  function drawerParseDrillOffsets(raw) {
      const source = Array.isArray(raw) ? raw : String(raw ?? '').trim().split(/[;\s|/]+|,(?=\s*\d)/);
      const out = [];
      for (const v of source) {
          const n = Number(String(v).trim().replace(',', '.'));
          if (!Number.isFinite(n) || n < 0)
              continue;
          if (!out.some(x => Math.abs(x - n) < .001))
              out.push(n);
      }
      return out.sort((a, b) => a - b);
  }
  
  function drawerDrillTableOffsets(presetOrId, length) {
      const p = typeof presetOrId === 'string' ? drawerPreset(presetOrId) : presetOrId;
      const table = p?.drillByLength;
      if (!table)
          return null;
      const key = String(Math.round(Number(length) || 0));
      const row = table[key] ?? table[Number(key)];
      return Array.isArray(row) ? drawerParseDrillOffsets(row) : null;
  }
  
  function drawerCatalogCodeForLength(presetOrId, length) {
      const p = typeof presetOrId === 'string' ? drawerPreset(presetOrId) : presetOrId;
      if (!p?.catalogByLength)
          return '';
      const key = String(Math.round(Number(length) || 0));
      return String(p.catalogByLength[key] ?? p.catalogByLength[Number(key)] ?? '');
  }
  
  function drawerDrillDefaults(presetOrId) {
      const p = typeof presetOrId === 'string' ? drawerPreset(presetOrId) : presetOrId;
      return {
          frontRef: Number.isFinite(Number(p?.drillFrontRef)) ? Number(p.drillFrontRef) : 37,
          offsets: drawerParseDrillOffsets(p?.drillOffsets?.length ? p.drillOffsets : [0, 64, 128]),
          mountY: Number.isFinite(Number(p?.mountY)) ? Number(p.mountY) : 10,
          diameter: Number.isFinite(Number(p?.holeDiameter)) ? Number(p.holeDiameter) : 5,
          depth: Number.isFinite(Number(p?.holeDepth)) ? Number(p.holeDepth) : 10
      };
  }
  
  function drawerDrillValuesFromUi() {
      const p = drawerPreset($('drawerSlideType')?.value), d = drawerDrillDefaults(p);
      const frontRef = Number($('drawerDrillFrontRef')?.value), mountY = Number($('drawerDrillMountY')?.value), diameter = Number($('drawerDrillDiameter')?.value), depth = Number($('drawerDrillDepth')?.value);
      const offsets = drawerParseDrillOffsets($('drawerDrillOffsets')?.value);
      return {
          frontRef: Number.isFinite(frontRef) ? frontRef : d.frontRef,
          offsets: offsets.length ? offsets : d.offsets,
          autoByLength: !!$('drawerDrillAutoByLength')?.checked,
          verticalMode: $('drawerDrillVerticalMode')?.value === 'fixed' ? 'fixed' : 'center',
          side: ['left', 'right'].includes($('drawerDrillSide')?.value) ? $('drawerDrillSide').value : 'both',
          mountY: Number.isFinite(mountY) ? mountY : d.mountY,
          diameter: Number.isFinite(diameter) ? diameter : d.diameter,
          depth: Number.isFinite(depth) ? depth : d.depth
      };
  }
  
  function drawerAbsoluteDrillPositions(cfg, preset = null) {
      const p = preset || drawerPreset(cfg?.slideType), d = drawerDrillDefaults(p);
      const frontRef = Number.isFinite(Number(cfg?.drillFrontRef)) ? Number(cfg.drillFrontRef) : d.frontRef;
      const length = Number(cfg?.resolvedLength) || Infinity;
      const useAuto = (cfg?.drillAutoByLength !== false) && !!p?.drillByLength;
      const tableOffsets = useAuto ? drawerDrillTableOffsets(p, length) : null;
      const offsets = tableOffsets?.length
          ? tableOffsets
          : drawerParseDrillOffsets(cfg?.drillOffsets?.length ? cfg.drillOffsets : d.offsets);
      return offsets.map(v => frontRef + v).filter(v => v >= 0 && v <= length - 15 + .001);
  }
  
  function drawerSetDrillingUiFromPreset(presetOrId) {
      const p = typeof presetOrId === 'string' ? drawerPreset(presetOrId) : presetOrId;
      const d = drawerDrillDefaults(p);
      $('drawerDrillFrontRef').value = nice(d.frontRef);
      $('drawerDrillOffsets').value = d.offsets.map(n => nice(n)).join(', ');
      $('drawerDrillAutoByLength').checked = !!p?.drillByLength && p.drillAutoByLength !== false;
      $('drawerDrillVerticalMode').value = 'center';
      $('drawerDrillSide').value = 'both';
      $('drawerDrillMountY').value = nice(d.mountY);
      $('drawerDrillDiameter').value = nice(d.diameter);
      $('drawerDrillDepth').value = nice(d.depth);
  }
  
  function updateDrawerDrillingFields() {
      const on = !!$('drawerCreateDrilling')?.checked;
      if ($('drawerDrillingFields'))
          $('drawerDrillingFields').style.display = on ? 'block' : 'none';
      try {
          const vals = drawerDrillValuesFromUi(), target = drawerTarget(), preset = drawerPreset($('drawerSlideType').value);
          const drillFrontReserve = (Number($('drawerFrontInset').value) || 0) + ($('drawerCreateFronts')?.checked ? (Number($('drawerFrontThickness').value) || 0) : 0);
          const resolved = target
              ? drawerResolvedLengthMm(target.cell, preset, $('drawerLengthMode').value, drillFrontReserve, Number($('drawerRearClearance').value) || 0)
              : { length: Number($('drawerLengthMode').value) || 0 };
          const hasTable = !!preset?.drillByLength;
          $('drawerDrillAutoRow').style.display = hasTable ? 'flex' : 'none';
          const auto = hasTable && vals.autoByLength;
          const row = auto ? drawerDrillTableOffsets(preset, resolved.length) : null;
          if (auto && row?.length) {
              $('drawerDrillOffsets').value = row.map(n => nice(n)).join(', ');
              $('drawerDrillOffsets').readOnly = true;
          }
          else {
              $('drawerDrillOffsets').readOnly = false;
          }
          const centerMode = vals.verticalMode === 'center';
          if ($('drawerDrillMountY'))
              $('drawerDrillMountY').disabled = centerMode;
          if ($('drawerDrillMountYLabel'))
              $('drawerDrillMountYLabel').style.opacity = centerMode ? '.55' : '1';
          if (on && $('drawerDrillResult')) {
              const cfg = {
                  slideType: preset.id,
                  resolvedLength: resolved.length,
                  drillFrontRef: vals.frontRef,
                  drillOffsets: auto && row?.length ? row : vals.offsets,
                  drillAutoByLength: auto
              };
              const abs = drawerAbsoluteDrillPositions(cfg, preset);
              const code = drawerCatalogCodeForLength(preset, resolved.length);
              const rel = auto && row?.length ? row : vals.offsets;
              const boxHeight = Math.max(0, Number($('drawerBoxHeight')?.value) || 0);
              const yText = centerMode
                  ? `centro automático da lateral (${nice(boxHeight / 2)} mm nesta gaveta)`
                  : `${nice(vals.mountY)} mm a partir da base`;
              const sideText = vals.side === 'left' ? 'esquerda' : vals.side === 'right' ? 'direita' : 'ambas';
              $('drawerDrillResult').innerHTML =
                  `<strong>${auto ? 'Catálogo automático' : 'Manual'}:</strong> ` +
                      `${nice(vals.frontRef)} + [${rel.map(n => nice(n)).join(', ')}] = ` +
                      `<strong>${abs.length ? abs.map(n => nice(n)).join(' / ') : 'nenhum ponto válido'} mm</strong> desde a frente` +
                      `${code ? ` · Häfele ${code}` : ''}` +
                      ` · linha Y: ${yText} · lateral: ${sideText} · Ø${nice(vals.diameter)} × ${nice(vals.depth)} mm.`;
          }
      }
      catch (_) { }
      updateDrawerSystemPreview();
  }
  
  function drawerPreset(id) { return DRAWER_SLIDE_PRESETS[id] || DRAWER_SLIDE_PRESETS.telescopic; }
  
  function drawerSetObjects(id) { return runtimeModel.objects.filter(o => o.userData?.drawerSetId === id); }
  
  function drawerSetRepresentative(id) { return drawerSetObjects(id).find(o => o.userData?.drawerConfig) || null; }
  
  function drawerSetIdsForTarget(rootId, cellId) {
      const ids = new Set();
      for (const o of runtimeModel.objects) {
          const u = o.userData;
          if (!u?.drawerSetId || !u.drawerConfig)
              continue;
          const cfg = u.drawerConfig;
          if (cfg.targetRootId === rootId && cfg.targetCellId === cellId)
              ids.add(u.drawerSetId);
      }
      return [...ids];
  }
  
  function drawerPrimarySetIdForTarget(rootId, cellId) {
      const ids = drawerSetIdsForTarget(rootId, cellId);
      return ids.length ? ids[0] : null;
  }
  
  function removeDrawerSetsForTarget(rootId, cellId, { exceptId = null } = {}) {
      const ids = drawerSetIdsForTarget(rootId, cellId).filter(id => id && id !== exceptId);
      let removed = 0;
      for (const id of ids)
          removed += removeDrawerSet(id, { commit: false, keepSelection: true });
      return { ids, removed };
  }
  
  function drawerConfigFromSet(id) { const o = drawerSetRepresentative(id); return o?.userData?.drawerConfig ? JSON.parse(JSON.stringify(o.userData.drawerConfig)) : null; }
  
  function drawerUniqueConfigsForRoot(rootId) {
      const map = new Map();
      for (const o of runtimeModel.objects) {
          const u = o.userData;
          if (u?.spaceRootId !== rootId || !u.drawerSetId || !u.drawerConfig || map.has(u.drawerSetId))
              continue;
          map.set(u.drawerSetId, JSON.parse(JSON.stringify(u.drawerConfig)));
      }
      return [...map.values()];
  }
  
  function drawerTarget() {
      const root = drawerTargetRootId ? getSpaceRoot(drawerTargetRootId) : null;
      const cell = root && drawerTargetCellId ? getSpaceCell(root.id, drawerTargetCellId) : null;
      return root && cell ? { root, cell, size: cellSize(cell), center: cellCenter(cell) } : null;
  }
  
  function drawerAutoLengthMm(cell, preset, frontInset, rearClear) {
      const available = mm(cell.maxZ - cell.minZ) - frontInset - rearClear;
      const lengths = (preset.lengths || []).filter(v => v <= available + .001);
      return lengths.length ? Math.max(...lengths) : 0;
  }
  
  function drawerResolvedLengthMm(cell, preset, mode, frontInset, rearClear) {
      const available = mm(cell.maxZ - cell.minZ) - frontInset - rearClear;
      const requested = String(mode || 'auto') === 'auto' ? drawerAutoLengthMm(cell, preset, frontInset, rearClear) : Number(mode);
      return { length: Number(requested) || 0, available };
  }
  
  function drawerApplyPresetDefaults(force = false) {
      const p = drawerPreset($('drawerSlideType')?.value);
      if (force || !Number.isFinite(Number($('drawerSideClearance')?.value)))
          $('drawerSideClearance').value = nice(p.sideClearance);
      if (force || !Number.isFinite(Number($('drawerDrillFrontRef')?.value)))
          drawerSetDrillingUiFromPreset(p);
      const d = drawerDrillDefaults(p), pattern = `${nice(d.frontRef)} + [${d.offsets.map(n => nice(n)).join(', ')}]`;
      $('drawerPresetHint').textContent = p.id === 'undermount'
          ? `${p.name} · folga ${nice(p.sideClearance)} mm/lado (caixa = vão - ${nice(p.sideClearance * 2)} mm) · furação ${pattern}. Tudo pode ser ajustado abaixo.`
          : p.id === 'telescopic'
              ? `${p.name} · folga EXATA ${nice(p.sideClearance)} mm/lado · altura ${nice(p.railHeight)} mm · 37 mm da frente · pontos automáticos conforme 250–700 mm.`
              : `${p.name} · comprimentos ${p.lengths.join(' / ')} mm · furação ${pattern}. Tudo pode ser ajustado abaixo.`;
  }
  
  function drawerReadConfig() {
      const target = drawerTarget();
      if (!target)
          throw new Error('Selecione uma divisão');
      const preset = drawerPreset($('drawerSlideType').value);
      const count = Math.max(1, Math.min(20, Math.round(Number($('drawerCount').value) || 1)));
      const sideClearance = Number($('drawerSideClearance').value), boxHeight = Number($('drawerBoxHeight').value), boxThickness = Number($('drawerBoxThickness').value), bottomThickness = Number($('drawerBottomThickness2').value), frontInset = Number($('drawerFrontInset').value), rearClearance = Number($('drawerRearClearance').value), edgeGap = Number($('drawerEdgeGap').value);
      const bottomOffset = Number($('drawerBottomOffset').value), bottomPassLeft = Number($('drawerBottomPassLeft').value), bottomPassRight = Number($('drawerBottomPassRight').value), bottomPassFront = Number($('drawerBottomPassFront').value), bottomPassBack = Number($('drawerBottomPassBack').value);
      const machineBottom = !!$('drawerMachineBottom').checked, bottomGrooveClearance = Number($('drawerBottomGrooveClearance').value), bottomGrooveDepth = Number($('drawerBottomGrooveDepth').value);
      const grooveLeft = !!$('drawerGrooveLeft').checked, grooveRight = !!$('drawerGrooveRight').checked, grooveFront = !!$('drawerGrooveFront').checked, grooveBack = !!$('drawerGrooveBack').checked;
      const createFronts = !!$('drawerCreateFronts').checked, frontThickness = Number($('drawerFrontThickness').value), frontGapLeft = Number($('drawerFrontGapLeft').value), frontGapRight = Number($('drawerFrontGapRight').value), frontGapTop = Number($('drawerFrontGapTop').value), frontGapBottom = Number($('drawerFrontGapBottom').value), frontGapBetween = Number($('drawerFrontGapBetween').value);
      const createTampon = !!$('drawerCreateTampon')?.checked;
      const tamponSide = ['left','right','both'].includes($('drawerTamponSide')?.value) ? $('drawerTamponSide').value : 'left';
      const tamponThickness = Number($('drawerTamponThickness')?.value), tamponPanelThickness = Number($('drawerTamponPanelThickness')?.value), tamponStripDepth = Number($('drawerTamponStripDepth')?.value), tamponFrontInset = Number($('drawerTamponFrontInset')?.value), tamponRearInset = Number($('drawerTamponRearInset')?.value);
      const tamponFrontStrip = !!$('drawerTamponFrontStrip')?.checked, tamponRearStrip = !!$('drawerTamponRearStrip')?.checked;
      const tamponLeft = createTampon && (tamponSide === 'left' || tamponSide === 'both') ? tamponThickness : 0;
      const tamponRight = createTampon && (tamponSide === 'right' || tamponSide === 'both') ? tamponThickness : 0;
      const drillUi = drawerDrillValuesFromUi();
      const drillFrontRef = drillUi.frontRef, drillOffsets = drillUi.offsets, drillAutoByLength = drillUi.autoByLength, drillVerticalMode = drillUi.verticalMode, drillSide = drillUi.side, drillMountY = drillUi.mountY, drillDiameter = drillUi.diameter, drillDepth = drillUi.depth;
      if (![sideClearance, boxHeight, boxThickness, bottomThickness, frontInset, rearClearance, edgeGap, bottomOffset, bottomPassLeft, bottomPassRight, bottomPassFront, bottomPassBack, bottomGrooveClearance, bottomGrooveDepth, drillFrontRef, drillMountY, drillDiameter, drillDepth, tamponThickness, tamponPanelThickness, tamponStripDepth, tamponFrontInset, tamponRearInset].every(Number.isFinite))
          throw new Error('Confira as medidas das gavetas');
      if (createTampon && (tamponThickness <= 0 || tamponPanelThickness <= 0 || tamponStripDepth <= 0 || tamponFrontInset < 0 || tamponRearInset < 0))
          throw new Error('Confira as medidas do tamponamento');
      if (createTampon && !tamponFrontStrip && !tamponRearStrip)
          throw new Error('Marque ripa frontal e/ou ripa traseira no tamponamento');
      if (Math.min(sideClearance, frontInset, rearClearance, edgeGap, bottomPassLeft, bottomPassRight, bottomPassFront, bottomPassBack, bottomGrooveClearance, drillFrontRef, drillMountY) < 0 || boxHeight <= 0 || boxThickness <= 0 || bottomThickness <= 0 || bottomGrooveDepth <= 0 || drillDiameter <= 0 || drillDepth <= 0)
          throw new Error('Confira as medidas das gavetas');
      if ($('drawerCreateDrilling').checked && !drillOffsets.length)
          throw new Error('Informe pelo menos um ponto de furação da corrediça');
      if (machineBottom) {
          const grooveW = bottomThickness + bottomGrooveClearance;
          if (bottomOffset < 0)
              throw new Error('Para usinar o fundo, a posição vertical não pode ser negativa');
          if (bottomOffset + grooveW > boxHeight + .001)
              throw new Error('O rasgo do fundo ultrapassa a altura da caixa');
          if (bottomGrooveDepth > boxThickness + .001)
              throw new Error(`Profundidade máxima do rasgo: ${nice(boxThickness)} mm`);
          if (!grooveLeft && !grooveRight && !grooveFront && !grooveBack)
              throw new Error('Marque pelo menos um lado para usinar o fundo');
      }
      if (createFronts) {
          if (![frontThickness, frontGapLeft, frontGapRight, frontGapTop, frontGapBottom, frontGapBetween].every(Number.isFinite) || frontThickness <= 0)
              throw new Error('Confira as medidas das frentes');
          if (Math.max(Math.abs(frontGapLeft), Math.abs(frontGapRight), Math.abs(frontGapTop), Math.abs(frontGapBottom), Math.abs(frontGapBetween)) > 1000)
              throw new Error('Folga das frentes fora do limite');
      }
      // 1.311.00-r2: quando houver frente de gaveta, ela passa a ocupar o
      // próprio vão (não fica mais do lado de fora). Portanto a profundidade útil
      // da caixa/corrediça também desconta a espessura da frente.
      const frontReserve = frontInset + (createFronts ? frontThickness : 0);
      const resolved = drawerResolvedLengthMm(target.cell, preset, $('drawerLengthMode').value, frontReserve, rearClearance);
      if (resolved.available < 100)
          throw new Error('A profundidade útil é muito pequena para uma corrediça');
      if (resolved.length <= 0)
          throw new Error(`Nenhum comprimento padrão cabe nos ${nice(resolved.available)} mm úteis`);
      if (resolved.length > resolved.available + .001)
          throw new Error(`Corrediça de ${nice(resolved.length)} mm não cabe. Disponível: ${nice(resolved.available)} mm`);
      const openingW = mm(target.size.width), openingH = mm(target.size.height), openingD = mm(target.size.depth);
      // 1.311.00-r2 · tamponamento em duas etapas, como no conjunto físico:
      // 1) a ripa curta frontal/traseira cria o afastamento lateral (ex. 18 mm);
      // 2) depois dela existe uma LATERAL INTERNA inteira (ex. MDF 18 mm),
      //    com altura e profundidade do vão. Só então começam corrediça e gaveta.
      const tamponPanelLeft = createTampon && (tamponSide === 'left' || tamponSide === 'both') ? tamponPanelThickness : 0;
      const tamponPanelRight = createTampon && (tamponSide === 'right' || tamponSide === 'both') ? tamponPanelThickness : 0;
      const tamponTotalLeft = tamponLeft + tamponPanelLeft;
      const tamponTotalRight = tamponRight + tamponPanelRight;
      const usableW = openingW - tamponTotalLeft - tamponTotalRight;
      const drawerStartLeft = tamponTotalLeft + sideClearance;
      const drawerStartRight = tamponTotalRight + sideClearance;
      const outerW = usableW - sideClearance * 2, innerW = outerW - boxThickness * 2;
      if (createTampon && tamponFrontStrip && tamponFrontInset + tamponStripDepth > openingD + .001)
          throw new Error('Ripa frontal do tamponamento ultrapassa a profundidade do vão');
      if (createTampon && tamponRearStrip && tamponRearInset + tamponStripDepth > openingD + .001)
          throw new Error('Ripa traseira do tamponamento ultrapassa a profundidade do vão');
      if (outerW <= boxThickness * 2 + 10)
          throw new Error('Tamponamento + folga lateral não deixam largura suficiente para a caixa');
      let frontW = 0, frontH = 0;
      if (createFronts) {
          frontW = usableW - frontGapLeft - frontGapRight;
          const availableFrontH = openingH - frontGapTop - frontGapBottom - frontGapBetween * (count - 1);
          frontH = availableFrontH / count;
          if (frontW <= 10 || frontH <= 10)
              throw new Error('As folgas das frentes ultrapassam o tamanho do vão');
          if (boxHeight > frontH + .001)
              throw new Error(`A caixa (${nice(boxHeight)} mm) é mais alta que cada frente (${nice(frontH)} mm)`);
      }
      else {
          if (boxHeight + edgeGap * 2 > openingH + .001)
              throw new Error('A altura da caixa + folgas não cabe neste vão');
          if (count > 1 && openingH - edgeGap * 2 - boxHeight < 1)
              throw new Error('Não há altura suficiente para distribuir as gavetas');
      }
      const bottomBaseW = innerW, bottomBaseD = Math.max(1, resolved.length - boxThickness * 2);
      const bottomW = bottomBaseW + bottomPassLeft + bottomPassRight;
      const bottomD = bottomBaseD + bottomPassFront + bottomPassBack;
      if (bottomW <= 1 || bottomD <= 1)
          throw new Error('Confira o tamanho final do fundo');
      if (bottomOffset + bottomThickness > boxHeight + 50 || bottomOffset < -50)
          throw new Error('Confira a posição vertical do fundo');
      // 1.100.4:
      // Quando o fundo avança para frente/atrás, ele atravessaria fisicamente
      // a contra frente / contra fundo. Nesse caso cortamos o painel por baixo
      // até o topo do fundo.
      const bottomTop = Math.max(0, bottomOffset + bottomThickness);
      const bottomCutFront = bottomPassFront > .001 ? bottomTop : 0;
      const bottomCutBack = bottomPassBack > .001 ? bottomTop : 0;
      if (bottomCutFront >= boxHeight - 1)
          throw new Error('O fundo deixa menos de 1 mm de contra frente');
      if (bottomCutBack >= boxHeight - 1)
          throw new Error('O fundo deixa menos de 1 mm de contra fundo');
      return {
          id: drawerEditingSetId || uid('drawerset'), name: `${count} gaveta${count > 1 ? 's' : ''} · ${preset.name}`,
          targetRootId: target.root.id, targetCellId: target.cell.id,
          slideType: preset.id, slideName: preset.name, lengthMode: $('drawerLengthMode').value,
          resolvedLength: resolved.length, availableDepth: resolved.available, sideClearance, boxHeight, boxThickness, bottomThickness, frontInset, rearClearance, edgeGap, count,
          bottomOffset, bottomPassLeft, bottomPassRight, bottomPassFront, bottomPassBack, bottomW, bottomD, bottomCutFront, bottomCutBack,
          machineBottom, bottomGrooveClearance, bottomGrooveDepth, grooveLeft, grooveRight, grooveFront, grooveBack,
          createFronts, frontThickness, frontGapLeft, frontGapRight, frontGapTop, frontGapBottom, frontGapBetween, frontW, frontH,
          createTampon, tamponSide, tamponThickness, tamponPanelThickness, tamponStripDepth, tamponFrontStrip, tamponRearStrip, tamponFrontInset, tamponRearInset, tamponLeft, tamponRight, tamponPanelLeft, tamponPanelRight, tamponTotalLeft, tamponTotalRight, usableW, drawerStartLeft, drawerStartRight,
          createSlides: !!$('drawerCreateSlides').checked, createDrilling: !!$('drawerCreateDrilling').checked,
          drillFrontRef, drillOffsets, drillAutoByLength, drillVerticalMode, drillSide, drillMountY, drillDiameter, drillDepth,
          openingW, openingH, openingD, outerW, innerW,
          version: 9
      };
  }
  
  function updateDrawerSystemPreview() {
      const target = drawerTarget(), preview = $('drawerPreview'), status = $('drawerHardwareStatus');
      if (!target) {
          if (preview)
              preview.textContent = 'Selecione uma divisão.';
          return;
      }
      try {
          const cfg = drawerReadConfig(), p = drawerPreset(cfg.slideType);
          $('drawerResolvedLength').value = `${nice(cfg.resolvedLength)} mm`;
          $('drawerTargetInfo').innerHTML = `<strong>${target.root.name}</strong> · vão L ${nice(cfg.openingW)} × P ${nice(cfg.openingD)} × A ${nice(cfg.openingH)} mm`;
          const freeSpan = cfg.openingH - 2 * cfg.edgeGap - cfg.boxHeight;
          const step = cfg.count > 1 ? freeSpan / (cfg.count - 1) : 0;
          const frontTxt = cfg.createFronts
              ? `<br><strong>Frentes dentro do vão:</strong> ${cfg.count} × ${nice(cfg.frontW)} × ${nice(cfg.frontThickness)} × ${nice(cfg.frontH)} mm · folgas E ${nice(cfg.frontGapLeft)} / D ${nice(cfg.frontGapRight)} / C ${nice(cfg.frontGapTop)} / B ${nice(cfg.frontGapBottom)} / entre ${nice(cfg.frontGapBetween)} mm · caixa inicia atrás da frente`
              : '<br><strong>Frentes:</strong> não criar';
          const grooveSides = [];
          if (cfg.grooveLeft)
              grooveSides.push('lateral E');
          if (cfg.grooveRight)
              grooveSides.push('lateral D');
          if (cfg.grooveFront && !(cfg.bottomCutFront > 0))
              grooveSides.push('contra frente');
          if (cfg.grooveBack && !(cfg.bottomCutBack > 0))
              grooveSides.push('contra fundo');
          const groovePieces = grooveSides.length;
          const grooveTotal = cfg.count * groovePieces;
          const grooveTxt = cfg.machineBottom
              ? ` · <strong>rasgos automáticos:</strong> ${grooveTotal} total · ${grooveSides.join(' + ')} · ${nice(cfg.bottomThickness + cfg.bottomGrooveClearance)} mm largura × ${nice(cfg.bottomGrooveDepth)} mm profundidade${(cfg.grooveFront && cfg.bottomCutFront > 0) || (cfg.grooveBack && cfg.bottomCutBack > 0) ? ' · peça recortada não recebe rasgo' : ''}`
              : ` · <strong style="color:#ffae52">usinagem do fundo desligada</strong>`;
          const autoCutTxt = (cfg.bottomCutFront > 0 || cfg.bottomCutBack > 0)
              ? `<br><strong>Recorte automático:</strong> contra frente ${nice(cfg.bottomCutFront)} mm · contra fundo ${nice(cfg.bottomCutBack)} mm, medidos por baixo até o topo do fundo`
              : '';
          const bottomTxt = `<br><strong>Fundo:</strong> ${nice(cfg.bottomW)} × ${nice(cfg.bottomD)} × ${nice(cfg.bottomThickness)} mm · posição ${nice(cfg.bottomOffset)} mm · passa E ${nice(cfg.bottomPassLeft)} / D ${nice(cfg.bottomPassRight)} / F ${nice(cfg.bottomPassFront)} / T ${nice(cfg.bottomPassBack)} mm${autoCutTxt}${grooveTxt}`;
          const tamponTxt = cfg.createTampon
              ? `<br><strong>Tamponamento:</strong> ${cfg.tamponSide === 'both' ? 'esquerdo + direito' : cfg.tamponSide === 'right' ? 'direito' : 'esquerdo'} · ripa ${nice(cfg.tamponStripDepth)} mm de profundidade × ${nice(cfg.tamponThickness)} mm de afastamento · lateral interna MDF ${nice(cfg.tamponPanelThickness)} mm${cfg.tamponFrontStrip ? ` · frontal após ${nice(cfg.tamponFrontInset)} mm` : ''}${cfg.tamponRearStrip ? ` · traseira após ${nice(cfg.tamponRearInset)} mm` : ''} · largura útil ${nice(cfg.usableW)} mm`
                + `<br><strong>Início da caixa:</strong> esquerda ${nice(cfg.drawerStartLeft)} mm / direita ${nice(cfg.drawerStartRight)} mm a partir da borda do vão (tamponamento + folga da corrediça).`
              : '';
          preview.innerHTML = `<strong>Caixa externa:</strong> ${nice(cfg.outerW)} × ${nice(cfg.resolvedLength)} × ${nice(cfg.boxHeight)} mm<br><strong>Contra frente/fundo entre laterais:</strong> ${nice(cfg.innerW)} mm · MDF ${nice(cfg.boxThickness)} mm${tamponTxt}${bottomTxt}${frontTxt}<br><strong>Distribuição:</strong> ${cfg.count} gaveta(s)${!cfg.createFronts && cfg.count > 1 ? ` · passo vertical ${nice(step)} mm` : cfg.createFronts ? ' · caixas centralizadas atrás das frentes' : ''}<br><strong>Corrediça:</strong> ${p.name} · ${nice(cfg.resolvedLength)} mm · folga ${nice(cfg.sideClearance)} mm por lado`;
          const left = drawerFindSidePanel(cfg, 'left'), right = drawerFindSidePanel(cfg, 'right');
          const drillPos = drawerAbsoluteDrillPositions(cfg, p);
          const catCode = drawerCatalogCodeForLength(p, cfg.resolvedLength);
          const leftStatus = cfg.drillSide === 'right' ? 'não usada' : left ? 'OK' : 'não encontrada';
          const rightStatus = cfg.drillSide === 'left' ? 'não usada' : right ? 'OK' : 'não encontrada';
          const yStatus = cfg.drillVerticalMode === 'center'
              ? `centro automático (${nice(cfg.boxHeight / 2)} mm)`
              : `${nice(cfg.drillMountY)} mm da base`;
          status.textContent = cfg.createDrilling
              ? `Furação automática: E ${leftStatus} · D ${rightStatus} · ${cfg.drillAutoByLength && p.drillByLength ? 'CATÁLOGO' : 'manual'} · posições ${drillPos.map(n => nice(n)).join(' / ')} mm desde a frente${catCode ? ` · Häfele ${catCode}` : ''} · linha ${yStatus} · Ø${nice(cfg.drillDiameter)} × ${nice(cfg.drillDepth)} mm.`
              : 'Furação automática desligada.';
      }
      catch (err) {
          $('drawerResolvedLength').value = '—';
          preview.innerHTML = `<strong style="color:#ff7169">${err.message || 'Confira as medidas'}</strong>`;
          if (status)
              status.textContent = 'Ajuste as medidas para calcular.';
      }
  }
  
  function updateDrawerBottomMachiningFields() {
      const on = !!$('drawerMachineBottom')?.checked;
      if ($('drawerBottomMachiningFields'))
          $('drawerBottomMachiningFields').style.display = on ? 'grid' : 'none';
      if ($('drawerBottomMachiningHelp'))
          $('drawerBottomMachiningHelp').style.display = on ? 'block' : 'none';
      updateDrawerSystemPreview();
  }
  
  function updateDrawerTamponFields() {
      const on = !!$('drawerCreateTampon')?.checked;
      if ($('drawerTamponFields')) $('drawerTamponFields').style.display = on ? 'block' : 'none';
      updateDrawerSystemPreview();
  }

  function updateDrawerFrontFields() {
      const on = !!$('drawerCreateFronts')?.checked;
      if ($('drawerFrontFields'))
          $('drawerFrontFields').style.display = on ? 'block' : 'none';
      updateDrawerSystemPreview();
  }
  
  function openDrawerSystemDialog(source = null) {
      if (state.visualMode)
          setVisualMode(false, { notify: false, frame: false });
      let existingId = source?.userData?.drawerSetId || state.selected?.userData?.drawerSetId || null;
      // Se o usuário abriu a ferramenta pelo VÃO, detecta automaticamente se já
      // existe um conjunto de gavetas naquele mesmo vão. Assim "Gavetas /
      // corrediças" vira edição, em vez de criar um segundo conjunto por cima.
      if (!existingId && state.selectedSpaceCell) {
          existingId = drawerPrimarySetIdForTarget(state.selectedSpaceCell.rootId, state.selectedSpaceCell.cellId);
      }
      drawerEditingSetId = existingId;
      let cfg = existingId ? drawerConfigFromSet(existingId) : null;
      if (cfg) {
          drawerTargetRootId = cfg.targetRootId;
          drawerTargetCellId = cfg.targetCellId;
      }
      else {
          if (!state.selectedSpaceCell) {
              let root = activeSpaceRoot();
              if (!root && state.selected)
                  root = rootForObject(state.selected);
              if (root) {
                  const cell = largestVisibleCell(root);
                  if (cell)
                      selectSpaceCellByIds(root.id, cell.id);
              }
          }
          if (!state.selectedSpaceCell) {
              toast('Selecione uma divisão para criar as gavetas');
              return;
          }
          drawerTargetRootId = state.selectedSpaceCell.rootId;
          drawerTargetCellId = state.selectedSpaceCell.cellId;
          // Segunda chance: o maior vão selecionado automaticamente também pode já
          // possuir gavetas de um projeto antigo.
          existingId = drawerPrimarySetIdForTarget(drawerTargetRootId, drawerTargetCellId);
          if (existingId) {
              drawerEditingSetId = existingId;
              cfg = drawerConfigFromSet(existingId);
          }
      }
      const target = drawerTarget();
      if (!target) {
          toast('A divisão original deste conjunto não existe mais');
          drawerEditingSetId = null;
          return;
      }
      const preset = drawerPreset(cfg?.slideType || 'telescopic');
      $('drawerSlideType').value = cfg?.slideType || preset.id;
      $('drawerLengthMode').value = cfg?.lengthMode || 'auto';
      $('drawerCount').value = cfg?.count ?? 3;
      $('drawerBoxHeight').value = cfg?.boxHeight ?? 120;
      const rootMaterial = spaceDefaultMaterial(target.root);
      // Espessura estrutural da caixa: escolha explícita 15 ou 18 mm.
      // Projetos antigos com outra medida continuam editáveis sem perder a configuração.
      const boxThicknessSelect = $('drawerBoxThickness');
      const savedBoxThickness = Number(cfg?.boxThickness);
      const initialBoxThickness = Number.isFinite(savedBoxThickness) ? savedBoxThickness : 15;
      if (boxThicknessSelect) {
          const value = String(initialBoxThickness);
          if (![...boxThicknessSelect.options].some(o => o.value === value)) {
              const legacy = document.createElement('option');
              legacy.value = value;
              legacy.textContent = `${nice(initialBoxThickness)} mm · projeto existente`;
              boxThicknessSelect.appendChild(legacy);
          }
          boxThicknessSelect.value = value;
      }
      $('drawerBottomThickness2').value = cfg?.bottomThickness ?? 6;
      $('drawerBottomOffset').value = cfg?.bottomOffset ?? 0;
      $('drawerBottomPassLeft').value = cfg?.bottomPassLeft ?? 0;
      $('drawerBottomPassRight').value = cfg?.bottomPassRight ?? 0;
      $('drawerBottomPassFront').value = cfg?.bottomPassFront ?? 0;
      $('drawerBottomPassBack').value = cfg?.bottomPassBack ?? 0;
      $('drawerMachineBottom').checked = cfg ? !!cfg.machineBottom : true;
      $('drawerBottomGrooveClearance').value = cfg?.bottomGrooveClearance ?? 0.5;
      $('drawerBottomGrooveDepth').value = cfg?.bottomGrooveDepth ?? 6;
      $('drawerGrooveLeft').checked = cfg?.grooveLeft !== false;
      $('drawerGrooveRight').checked = cfg?.grooveRight !== false;
      $('drawerGrooveFront').checked = cfg?.grooveFront === true;
      $('drawerGrooveBack').checked = cfg?.grooveBack === true;
      $('drawerFrontInset').value = cfg?.frontInset ?? 5;
      $('drawerRearClearance').value = cfg?.rearClearance ?? 10;
      $('drawerEdgeGap').value = cfg?.edgeGap ?? 20;
      if ($('drawerCreateTampon')) $('drawerCreateTampon').checked = cfg?.createTampon === true;
      if ($('drawerTamponSide')) $('drawerTamponSide').value = ['left','right','both'].includes(cfg?.tamponSide) ? cfg.tamponSide : 'left';
      if ($('drawerTamponThickness')) $('drawerTamponThickness').value = cfg?.tamponThickness ?? 18;
      if ($('drawerTamponPanelThickness')) $('drawerTamponPanelThickness').value = cfg?.tamponPanelThickness ?? 18;
      if ($('drawerTamponStripDepth')) $('drawerTamponStripDepth').value = cfg?.tamponStripDepth ?? 60;
      if ($('drawerTamponFrontStrip')) $('drawerTamponFrontStrip').checked = cfg?.tamponFrontStrip !== false;
      if ($('drawerTamponRearStrip')) $('drawerTamponRearStrip').checked = cfg?.tamponRearStrip === true;
      if ($('drawerTamponFrontInset')) $('drawerTamponFrontInset').value = cfg?.tamponFrontInset ?? 50;
      if ($('drawerTamponRearInset')) $('drawerTamponRearInset').value = cfg?.tamponRearInset ?? 50;
      $('drawerSideClearance').value = cfg?.sideClearance ?? preset.sideClearance;
      $('drawerCreateFronts').checked = cfg?.createFronts !== false;
      $('drawerFrontThickness').value = cfg?.frontThickness ?? rootMaterial?.thickness ?? 18;
      $('drawerFrontGapLeft').value = cfg?.frontGapLeft ?? 2;
      $('drawerFrontGapRight').value = cfg?.frontGapRight ?? 2;
      $('drawerFrontGapTop').value = cfg?.frontGapTop ?? 2;
      $('drawerFrontGapBottom').value = cfg?.frontGapBottom ?? 2;
      $('drawerFrontGapBetween').value = cfg?.frontGapBetween ?? 2;
      $('drawerCreateSlides').checked = cfg?.createSlides !== false;
      $('drawerCreateDrilling').checked = cfg?.createDrilling !== false;
      const openDrillPreset = drawerPreset(cfg?.slideType || preset.id);
      const drillDefault = drawerDrillDefaults(openDrillPreset);
      $('drawerDrillFrontRef').value = nice(Number.isFinite(Number(cfg?.drillFrontRef)) ? Number(cfg.drillFrontRef) : drillDefault.frontRef);
      $('drawerDrillOffsets').value = drawerParseDrillOffsets(cfg?.drillOffsets?.length ? cfg.drillOffsets : drillDefault.offsets).map(n => nice(n)).join(', ');
      $('drawerDrillAutoByLength').checked = typeof cfg?.drillAutoByLength === 'boolean'
          ? cfg.drillAutoByLength
          : !!openDrillPreset.drillByLength;
      // Novos conjuntos começam centralizados. Projetos antigos continuam com a medida fixa que já usavam.
      $('drawerDrillVerticalMode').value = cfg ? (cfg.drillVerticalMode === 'center' ? 'center' : 'fixed') : 'center';
      $('drawerDrillSide').value = cfg && ['left', 'right'].includes(cfg.drillSide) ? cfg.drillSide : 'both';
      $('drawerDrillMountY').value = nice(Number.isFinite(Number(cfg?.drillMountY)) ? Number(cfg.drillMountY) : drillDefault.mountY);
      $('drawerDrillDiameter').value = nice(Number.isFinite(Number(cfg?.drillDiameter)) ? Number(cfg.drillDiameter) : drillDefault.diameter);
      $('drawerDrillDepth').value = nice(Number.isFinite(Number(cfg?.drillDepth)) ? Number(cfg.drillDepth) : drillDefault.depth);
      $('drawerDialogTitle').textContent = cfg ? '▤ Editar gavetas / corrediças' : '▤ Gavetas / corrediças';
      $('drawerEditBadge').style.display = cfg ? 'block' : 'none';
      $('deleteDrawerSet').style.display = cfg ? 'block' : 'none';
      $('confirmDrawerSystem').textContent = cfg ? 'Atualizar conjunto' : 'Criar gavetas';
      drawerApplyPresetDefaults(false);
      refreshDrawerSlideLibrarySelect();
      // Se está editando um conjunto existente, já deixa um nome útil pronto.
      // Basta ajustar e tocar em "Salvar configuração".
      if (cfg) {
          const typeName = $('drawerSlideType').selectedOptions?.[0]?.textContent?.trim() || cfg.slideName || 'Corrediça';
          $('drawerSavedSlideName').value = cfg.savedSlidePresetName || `${typeName} · ${cfg.lengthMode === 'auto' ? 'automática' : cfg.lengthMode + ' mm'}`;
      }
      else {
          $('drawerSavedSlideName').value = '';
      }
      $('drawerSystemDialog').style.display = 'flex';
      updateDrawerTamponFields();
      updateDrawerFrontFields();
      updateDrawerBottomMachiningFields();
      updateDrawerDrillingFields();
  }
  
  function drawerReferenceGeometry(cfg) {
      const set = drawerSetObjects(cfg.id);
      const leftBoxes = set.filter(o => o.userData?.drawerRole === 'side-left');
      const rightBoxes = set.filter(o => o.userData?.drawerRole === 'side-right');
      const allBoxes = [...leftBoxes, ...rightBoxes];
      if (!allBoxes.length)
          return null;
      let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const o of allBoxes) {
          const b = getBounds(o);
          minY = Math.min(minY, b.minY);
          maxY = Math.max(maxY, b.maxY);
          minZ = Math.min(minZ, b.minZ);
          maxZ = Math.max(maxZ, b.maxZ);
      }
      const leftOuter = leftBoxes.length ? Math.min(...leftBoxes.map(o => getBounds(o).minX)) : null;
      const rightOuter = rightBoxes.length ? Math.max(...rightBoxes.map(o => getBounds(o).maxX)) : null;
      return {
          leftInner: Number.isFinite(leftOuter) ? leftOuter - m(Number(cfg.sideClearance) || 0) : null,
          rightInner: Number.isFinite(rightOuter) ? rightOuter + m(Number(cfg.sideClearance) || 0) : null,
          minY, maxY, minZ, maxZ,
          frontZ: maxZ
      };
  }
  
  function drawerFindSidePanel(cfg, side) {
      const root = getSpaceRoot(cfg.targetRootId);
      if (!root)
          return null;
      // Se houver tamponamento para livrar a dobradiça, a corrediça/furação
      // passa a usar essa peça como apoio em vez da lateral externa do móvel.
      const tamponRole = side === 'left' ? 'tampon-left' : 'tampon-right';
      const tamponEnabled = cfg.createTampon === true && (cfg.tamponSide === 'both' || cfg.tamponSide === side);
      const tampon = tamponEnabled ? drawerSetObjects(cfg.id).find(o => o.userData?.drawerRole === tamponRole) : null;
      if (tampon) return tampon;
      const cell = getSpaceCell(root.id, cfg.targetCellId);
      const ref = drawerReferenceGeometry(cfg);
      // Primeira referência: a geometria REAL da caixa da gaveta.
      // Fallback: limites do espaço antigo.
      const target = side === 'left'
          ? (Number.isFinite(ref?.leftInner) ? ref.leftInner : cell?.minX)
          : (Number.isFinite(ref?.rightInner) ? ref.rightInner : cell?.maxX);
      if (!Number.isFinite(target))
          return null;
      const y0 = Number.isFinite(ref?.minY) ? ref.minY : (cell?.minY ?? -Infinity);
      const y1 = Number.isFinite(ref?.maxY) ? ref.maxY : (cell?.maxY ?? Infinity);
      const z0 = Number.isFinite(ref?.minZ) ? ref.minZ : (cell?.minZ ?? -Infinity);
      const z1 = Number.isFinite(ref?.maxZ) ? ref.maxZ : (cell?.maxZ ?? Infinity);
      let best = null;
      for (const o of runtimeModel.objects) {
          const u = o.userData;
          if (u?.drawerSetId || u?.kind === 'hardware-visual' || u?.kind === 'cylinder' || u?.kind === 'space-cell')
              continue;
          // Aceita peças explicitamente ligadas ao móvel OU peças geometricamente
          // dentro do mesmo móvel. Isso cobre projetos antigos/importados.
          const sameRoot = u?.spaceRootId === root.id || rootForObject(o)?.id === root.id;
          if (!sameRoot)
              continue;
          const ti = pieceThicknessInfo(o);
          if (!ti || ti.thicknessAxis !== 'x')
              continue;
          const b = getBounds(o);
          const innerFace = side === 'left' ? b.maxX : b.minX;
          const gap = Math.abs(innerFace - target);
          // Busca até 80 mm e escolhe SEMPRE a peça mais próxima da face prevista.
          // Isso é só fallback de exportação; a pontuação de sobreposição impede
          // escolher uma lateral distante de outro nicho.
          if (gap > .08)
              continue;
          const oy = Math.max(0, Math.min(b.maxY, y1) - Math.max(b.minY, y0));
          const oz = Math.max(0, Math.min(b.maxZ, z1) - Math.max(b.minZ, z0));
          if (oy < .02 || oz < .08)
              continue;
          // Precisa estar do lado correto da gaveta.
          if (side === 'left' && innerFace > target + .03)
              continue;
          if (side === 'right' && innerFace < target - .03)
              continue;
          const overlapBonus = Math.min(.5, oy) * .02 + Math.min(.7, oz) * .02;
          const thicknessPenalty = Math.abs(ti.thickness - 18) * .00015;
          const score = gap + thicknessPenalty - overlapBonus;
          if (!best || score < best.score)
              best = { o, score, gap, oy, oz };
      }
      return best?.o || null;
  }
  
  function drawerRemoveMachining(setId) {
      let n = 0;
      for (const o of runtimeModel.objects) {
          const arr = o.userData?.machining;
          if (!Array.isArray(arr) || !arr.length)
              continue;
          const next = arr.filter(op => op.drawerSetId !== setId);
          n += arr.length - next.length;
          o.userData.machining = next;
      }
      return n;
  }
  
  // 1.100.5:
  // Ao REFAZER somente a furação das corrediças no gabinete, não podemos usar
  // drawerRemoveMachining(), pois os rasgos do fundo também possuem drawerSetId.
  // Esta função remove exclusivamente os furos automáticos da corrediça.
  function drawerRemoveCabinetDrilling(setId) {
      let n = 0;
      for (const o of runtimeModel.objects) {
          const arr = o.userData?.machining;
          if (!Array.isArray(arr) || !arr.length)
              continue;
          const next = arr.filter(op => {
              if (op?.drawerSetId !== setId)
                  return true;
              const isAutoSlideDrill = op?.drawerAutoDrilling === true ||
                  !!op?.drawerSlideType ||
                  String(op?.hardwarePresetId || '').startsWith('drawer-');
              return !isAutoSlideDrill;
          });
          n += arr.length - next.length;
          o.userData.machining = next;
      }
      return n;
  }
  
  function removeDrawerSet(setId, { commit = false, keepSelection = false } = {}) {
      if (!setId)
          return 0;
      const doomed = runtimeModel.objects.filter(o => o.userData?.drawerSetId === setId);
      removeHardwareLinkedToObjects(doomed);
      drawerRemoveMachining(setId);
      for (const o of doomed) {
          const i = runtimeModel.objects.indexOf(o);
          if (i >= 0)
              runtimeModel.objects.splice(i, 1);
          disposeObject(o);
      }
      if (state.selected && doomed.includes(state.selected) && !keepSelection)
          selectObject(null);
      renderMachiningVisuals();
      if (commit)
          commitHistory();
      return doomed.length;
  }
  
  function drawerCreatePiece(opts, cfg, role, index, kind = 'panel', exclude = false) {
      const o = createBox({ ...opts, kind, materialType: kind === 'hardware-visual' ? 'Ferragem' : 'MDF', baseColor: kind === 'hardware-visual' ? 0x60656b : COLORS.panel, spaceRootId: cfg.targetRootId, drawerSetId: cfg.id, drawerRole: role, drawerIndex: index, drawerConfig: cfg, excludeFromCutList: exclude }, false);
      if (kind === 'hardware-visual' && !state.cadHardwareVisible) {
          o.visible = false;
          if (o.userData?.visualEdges)
              o.userData.visualEdges.visible = false;
      }
      return o;
  }
  
  function drawerAddBottomGroove(owner, cfg, index, role) {
      if (!cfg.machineBottom || !owner)
          return 0;
      const ti = pieceThicknessInfo(owner);
      if (!ti)
          return 0;
      const width = Math.min(ti.faceH, Math.max(.1, Number(cfg.bottomThickness) + Number(cfg.bottomGrooveClearance || 0)));
      const depth = Math.min(ti.thickness, Math.max(.1, Number(cfg.bottomGrooveDepth) || .1));
      const y = Math.max(0, Number(cfg.bottomOffset) || 0);
      let lengthAxis = null, entryAxis = null;
      if (role === 'side-left') {
          lengthAxis = 'z';
          entryAxis = '-x';
      }
      else if (role === 'side-right') {
          lengthAxis = 'z';
          entryAxis = '+x';
      }
      else if (role === 'box-front') {
          lengthAxis = 'x';
          entryAxis = '+z';
      }
      else if (role === 'box-back') {
          lengthAxis = 'x';
          entryAxis = '-z';
      }
      else
          return 0;
      if (![ti.uAxis, ti.vAxis].includes(lengthAxis))
          return 0;
      const op = {
          id: uid('mach'), type: 'groove', entryAxis, coordRef: { x: 0, y, z: 0 }, x: 0, y: 0, z: 0,
          through: false, fullLength: true, autoLength: true, lengthAxis, length: ti.dims[lengthAxis],
          width, depth, preset: 'drawer-bottom-groove', drawerSetId: cfg.id, drawerIndex: index,
          drawerMachiningRole: 'bottom-groove'
      };
      op.coordRef[lengthAxis] = 0;
      Object.assign(op, resolvedMachiningCoords(owner, op));
      (owner.userData.machining || (owner.userData.machining = [])).push(op);
      sanitizeMachiningForPiece(owner);
      return 1;
  }
  
  function drawerRemoveBottomGrooves(setId) {
      let n = 0;
      for (const o of drawerSetObjects(setId)) {
          const arr = o.userData?.machining;
          if (!Array.isArray(arr) || !arr.length)
              continue;
          const next = arr.filter(op => !(op?.drawerSetId === setId && op?.preset === 'drawer-bottom-groove'));
          n += arr.length - next.length;
          o.userData.machining = next;
      }
      return n;
  }
  
  function drawerExpectedBottomGrooves(cfg) {
      if (!cfg?.machineBottom)
          return 0;
      const count = Math.max(1, Number(cfg.count) || 1);
      let perDrawer = 0;
      if (cfg.grooveLeft !== false)
          perDrawer++;
      if (cfg.grooveRight !== false)
          perDrawer++;
      if (cfg.grooveFront === true && !(Number(cfg.bottomCutFront) || 0))
          perDrawer++;
      if (cfg.grooveBack === true && !(Number(cfg.bottomCutBack) || 0))
          perDrawer++;
      return count * perDrawer;
  }
  
  function drawerBottomGrooveCount(setId) {
      let n = 0;
      for (const o of drawerSetObjects(setId)) {
          for (const op of (o.userData?.machining || [])) {
              if (op?.drawerSetId === setId && op?.preset === 'drawer-bottom-groove')
                  n++;
          }
      }
      return n;
  }
  
  function drawerEnsureBottomGroovesForSet(setId) {
      const cfg = drawerConfigFromSet(setId);
      if (!cfg?.machineBottom)
          return { setId, enabled: false, expected: 0, created: 0, before: drawerBottomGrooveCount(setId) };
      // Normaliza dados de versões anteriores.
      cfg.bottomThickness = Number(cfg.bottomThickness) || 6;
      cfg.bottomGrooveClearance = Number.isFinite(Number(cfg.bottomGrooveClearance)) ? Number(cfg.bottomGrooveClearance) : .5;
      cfg.bottomGrooveDepth = Number.isFinite(Number(cfg.bottomGrooveDepth)) ? Number(cfg.bottomGrooveDepth) : 6;
      cfg.bottomOffset = Number(cfg.bottomOffset) || 0;
      if (typeof cfg.grooveLeft !== 'boolean')
          cfg.grooveLeft = true;
      if (typeof cfg.grooveRight !== 'boolean')
          cfg.grooveRight = true;
      if (typeof cfg.grooveFront !== 'boolean')
          cfg.grooveFront = false;
      if (typeof cfg.grooveBack !== 'boolean')
          cfg.grooveBack = false;
      const bottomTop = Math.max(0, cfg.bottomOffset + cfg.bottomThickness);
      cfg.bottomCutFront = Number(cfg.bottomPassFront || 0) > .001 ? bottomTop : 0;
      cfg.bottomCutBack = Number(cfg.bottomPassBack || 0) > .001 ? bottomTop : 0;
      const before = drawerBottomGrooveCount(setId);
      drawerRemoveBottomGrooves(setId);
      let created = 0;
      for (const o of drawerSetObjects(setId)) {
          const role = o.userData?.drawerRole;
          const idx = Number(o.userData?.drawerIndex) || 0;
          if (role === 'side-left' && cfg.grooveLeft) {
              created += drawerAddBottomGroove(o, cfg, idx, role);
          }
          else if (role === 'side-right' && cfg.grooveRight) {
              created += drawerAddBottomGroove(o, cfg, idx, role);
          }
          else if (role === 'box-front' && cfg.grooveFront && !(cfg.bottomCutFront > 0)) {
              created += drawerAddBottomGroove(o, cfg, idx, role);
          }
          else if (role === 'box-back' && cfg.grooveBack && !(cfg.bottomCutBack > 0)) {
              created += drawerAddBottomGroove(o, cfg, idx, role);
          }
          // Mantém a configuração atualizada em todas as peças do conjunto.
          o.userData.drawerConfig = JSON.parse(JSON.stringify(cfg));
      }
      const expected = drawerExpectedBottomGrooves(cfg);
      return { setId, enabled: true, expected, created, before };
  }
  
  function repairDrawerBottomGroovesForRoot(root) {
      if (!root)
          return { sets: 0, expected: 0, created: 0, repaired: 0 };
      const ids = new Set();
      for (const o of runtimeModel.objects) {
          const u = o.userData;
          if (u?.spaceRootId === root.id && u?.drawerSetId && u?.drawerConfig?.machineBottom)
              ids.add(u.drawerSetId);
      }
      let expected = 0, created = 0, repaired = 0;
      for (const id of ids) {
          const r = drawerEnsureBottomGroovesForSet(id);
          expected += r.expected;
          created += r.created;
          if (r.before !== r.created)
              repaired++;
      }
      return { sets: ids.size, expected, created, repaired };
  }
  
  function repairAllDrawerBottomGrooves() {
      let sets = 0, expected = 0, created = 0, repaired = 0;
      for (const root of runtimeModel.spaceRoots) {
          const r = repairDrawerBottomGroovesForRoot(root);
          sets += r.sets;
          expected += r.expected;
          created += r.created;
          repaired += r.repaired;
      }
      if (sets)
          renderMachiningVisuals();
      return { sets, expected, created, repaired };
  }
  
  function drawerAddCabinetDrilling(cfg, levels) {
      if (!cfg.createDrilling)
          return { holes: 0, left: false, right: false };
      const root = getSpaceRoot(cfg.targetRootId);
      if (!root)
          return { holes: 0, left: false, right: false };
      const cell = getSpaceCell(root.id, cfg.targetCellId);
      const ref = drawerReferenceGeometry(cfg);
      const p = drawerPreset(cfg.slideType), left = drawerFindSidePanel(cfg, 'left'), right = drawerFindSidePanel(cfg, 'right');
      let holes = 0;
      // A referência longitudinal é a FRENTE DO ARMÁRIO.
      const cabinetFrontZ = cell ? mm(cell.maxZ) : (Number.isFinite(ref?.frontZ) ? mm(ref.frontZ) + Number(cfg.frontInset || 0) : 0);
      const d = drawerDrillDefaults(p);
      const drillMountY = Number.isFinite(Number(cfg.drillMountY)) ? Number(cfg.drillMountY) : d.mountY;
      const drillDiameter = Number.isFinite(Number(cfg.drillDiameter)) ? Number(cfg.drillDiameter) : d.diameter;
      const drillDepth = Number.isFinite(Number(cfg.drillDepth)) ? Number(cfg.drillDepth) : d.depth;
      const drillPositions = drawerAbsoluteDrillPositions(cfg, p);
      const drillSide = ['left', 'right'].includes(cfg?.drillSide) ? cfg.drillSide : 'both';
      const allowLeft = drillSide !== 'right', allowRight = drillSide !== 'left';
      const centerVertical = cfg?.drillVerticalMode === 'center';
      // Níveis reais das laterais de gaveta têm prioridade.
      const actualLevels = drawerLevelsFromSet(cfg);
      const useLevels = actualLevels.length ? actualLevels : levels;
      for (const [side, owner] of [['left', left], ['right', right]]) {
          if (side === 'left' && !allowLeft)
              continue;
          if (side === 'right' && !allowRight)
              continue;
          if (!owner)
              continue;
          const entry = side === 'left' ? '+x' : '-x';
          const ob = objectBoundsMm(owner);
          const x = side === 'left' ? ob.maxX : ob.minX;
          useLevels.forEach((baseM, idx) => {
              // Centro automático: sempre metade da altura REAL da lateral da gaveta.
              // Se o usuário trocar a altura da caixa, o furo acompanha sem editar o modelo.
              const yOffset = centerVertical
                  ? Number(cfg.boxHeight || 120) / 2
                  : Math.min(Number(cfg.boxHeight || 120) - 5, drillMountY);
              const y = mm(baseM) + yOffset;
              for (const pos of drillPositions) {
                  const world = { x, y, z: cabinetFrontZ - pos };
                  // 2 mm de tolerância tangencial: suficiente para diferenças de
                  // arredondamento, sem jogar furo para fora da peça.
                  if (!pointWithinPieceTangents(owner, world, 'x', 2.0))
                      continue;
                  const op = hardwareHoleOp(owner, world, entry, { diameter: drillDiameter, depth: drillDepth }, { presetId: `drawer-${p.id}`, name: `Corrediça ${p.name}`, role: 'contact', contactName: `Gaveta ${idx + 1}` }, cfg.id);
                  op.drawerSetId = cfg.id;
                  op.drawerIndex = idx;
                  op.drawerSlideType = p.id;
                  op.drawerAutoDrilling = true;
                  op.exportAspireFaceHole = true;
                  (owner.userData.machining || (owner.userData.machining = [])).push(op);
                  holes++;
              }
          });
          sanitizeMachiningForPiece(owner);
      }
      return { holes, left: allowLeft ? !!left : true, right: allowRight ? !!right : true };
  }
  
  function createDrawerSetFromConfig(input, { doHistory = true } = {}) {
      const cfg = JSON.parse(JSON.stringify(input || {}));
      // Compatibilidade com conjuntos criados na v86: mantém o conjunto antigo
      // funcionando até o usuário abrir "Editar gavetas / corrediças".
      if (!Number.isFinite(Number(cfg.bottomOffset)))
          cfg.bottomOffset = 0;
      if (!Number.isFinite(Number(cfg.bottomPassLeft)))
          cfg.bottomPassLeft = 0;
      if (!Number.isFinite(Number(cfg.bottomPassRight)))
          cfg.bottomPassRight = 0;
      if (!Number.isFinite(Number(cfg.bottomPassFront)))
          cfg.bottomPassFront = 0;
      if (!Number.isFinite(Number(cfg.bottomPassBack)))
          cfg.bottomPassBack = 0;
      if (typeof cfg.machineBottom !== 'boolean')
          cfg.machineBottom = false;
      if (!Number.isFinite(Number(cfg.bottomGrooveClearance)))
          cfg.bottomGrooveClearance = .5;
      if (!Number.isFinite(Number(cfg.bottomGrooveDepth)))
          cfg.bottomGrooveDepth = 6;
      if (typeof cfg.grooveLeft !== 'boolean')
          cfg.grooveLeft = true;
      if (typeof cfg.grooveRight !== 'boolean')
          cfg.grooveRight = true;
      if (typeof cfg.grooveFront !== 'boolean')
          cfg.grooveFront = false;
      if (typeof cfg.grooveBack !== 'boolean')
          cfg.grooveBack = false;
      if (typeof cfg.createFronts !== 'boolean')
          cfg.createFronts = false;
      if (!Number.isFinite(Number(cfg.frontThickness)))
          cfg.frontThickness = 18;
      if (!Number.isFinite(Number(cfg.frontGapLeft)))
          cfg.frontGapLeft = 2;
      if (!Number.isFinite(Number(cfg.frontGapRight)))
          cfg.frontGapRight = 2;
      if (!Number.isFinite(Number(cfg.frontGapTop)))
          cfg.frontGapTop = 2;
      if (!Number.isFinite(Number(cfg.frontGapBottom)))
          cfg.frontGapBottom = 2;
      if (!Number.isFinite(Number(cfg.frontGapBetween)))
          cfg.frontGapBetween = 2;
      const root = getSpaceRoot(cfg.targetRootId), cell = root && getSpaceCell(root.id, cfg.targetCellId);
      if (!root || !cell)
          throw new Error('A divisão original das gavetas não existe mais');
      const preset = drawerPreset(cfg.slideType), s = cellSize(cell);
      {
          const d = drawerDrillDefaults(preset);
          if (!Number.isFinite(Number(cfg.drillFrontRef)))
              cfg.drillFrontRef = d.frontRef;
          cfg.drillOffsets = drawerParseDrillOffsets(cfg.drillOffsets?.length ? cfg.drillOffsets : d.offsets);
          if (!cfg.drillOffsets.length)
              cfg.drillOffsets = d.offsets;
          if (typeof cfg.drillAutoByLength !== 'boolean')
              cfg.drillAutoByLength = !!preset.drillByLength;
          // Migração segura: conjuntos antigos sem este campo mantêm a altura fixa histórica.
          if (!['center', 'fixed'].includes(cfg.drillVerticalMode))
              cfg.drillVerticalMode = 'fixed';
          if (!['both', 'left', 'right'].includes(cfg.drillSide))
              cfg.drillSide = 'both';
          if (!Number.isFinite(Number(cfg.drillMountY)))
              cfg.drillMountY = d.mountY;
          if (!Number.isFinite(Number(cfg.drillDiameter)))
              cfg.drillDiameter = d.diameter;
          if (!Number.isFinite(Number(cfg.drillDepth)))
              cfg.drillDepth = d.depth;
      }
      // Recalcula ao criar/editar e também quando o móvel muda de tamanho.
      cfg.openingW = mm(s.width);
      cfg.openingH = mm(s.height);
      cfg.openingD = mm(s.depth);
      cfg.createTampon = cfg.createTampon === true;
      cfg.tamponSide = ['left','right','both'].includes(cfg.tamponSide) ? cfg.tamponSide : 'left';
      cfg.tamponThickness = Number.isFinite(Number(cfg.tamponThickness)) ? Number(cfg.tamponThickness) : 18;
      cfg.tamponPanelThickness = Number.isFinite(Number(cfg.tamponPanelThickness)) ? Number(cfg.tamponPanelThickness) : 18;
      cfg.tamponStripDepth = Number.isFinite(Number(cfg.tamponStripDepth)) ? Number(cfg.tamponStripDepth) : 60;
      cfg.tamponFrontStrip = cfg.tamponFrontStrip !== false;
      cfg.tamponRearStrip = cfg.tamponRearStrip === true;
      cfg.tamponFrontInset = Number.isFinite(Number(cfg.tamponFrontInset)) ? Number(cfg.tamponFrontInset) : 0;
      cfg.tamponRearInset = Number.isFinite(Number(cfg.tamponRearInset)) ? Number(cfg.tamponRearInset) : 0;
      cfg.tamponLeft = cfg.createTampon && (cfg.tamponSide === 'left' || cfg.tamponSide === 'both') ? cfg.tamponThickness : 0;
      cfg.tamponRight = cfg.createTampon && (cfg.tamponSide === 'right' || cfg.tamponSide === 'both') ? cfg.tamponThickness : 0;
      cfg.tamponPanelLeft = cfg.createTampon && (cfg.tamponSide === 'left' || cfg.tamponSide === 'both') ? cfg.tamponPanelThickness : 0;
      cfg.tamponPanelRight = cfg.createTampon && (cfg.tamponSide === 'right' || cfg.tamponSide === 'both') ? cfg.tamponPanelThickness : 0;
      cfg.tamponTotalLeft = cfg.tamponLeft + cfg.tamponPanelLeft;
      cfg.tamponTotalRight = cfg.tamponRight + cfg.tamponPanelRight;
      cfg.usableW = cfg.openingW - cfg.tamponTotalLeft - cfg.tamponTotalRight;
      if (cfg.createTampon && (cfg.tamponThickness <= 0 || cfg.tamponPanelThickness <= 0 || cfg.tamponStripDepth <= 0 || cfg.tamponFrontInset < 0 || cfg.tamponRearInset < 0))
          throw new Error('Confira espessuras, ripa e recuos do tamponamento');
      if (cfg.createTampon && cfg.tamponFrontStrip && cfg.tamponFrontInset + cfg.tamponStripDepth > cfg.openingD + .001)
          throw new Error('Ripa frontal do tamponamento ultrapassa a profundidade do vão');
      if (cfg.createTampon && cfg.tamponRearStrip && cfg.tamponRearInset + cfg.tamponStripDepth > cfg.openingD + .001)
          throw new Error('Ripa traseira do tamponamento ultrapassa a profundidade do vão');
      const frontReserve = Number(cfg.frontInset || 0) + (cfg.createFronts ? Number(cfg.frontThickness || 0) : 0);
      const rr = drawerResolvedLengthMm(cell, preset, cfg.lengthMode, frontReserve, cfg.rearClearance);
      cfg.resolvedLength = rr.length;
      cfg.availableDepth = rr.available;
      if (cfg.resolvedLength <= 0 || cfg.resolvedLength > cfg.availableDepth + .001)
          throw new Error('A corrediça escolhida não cabe mais nesta profundidade');
      cfg.outerW = cfg.usableW - cfg.sideClearance * 2;
      cfg.innerW = cfg.outerW - cfg.boxThickness * 2;
      if (cfg.outerW <= cfg.boxThickness * 2 + 10)
          throw new Error('A caixa não cabe na largura disponível');
      const span = cfg.openingH - 2 * cfg.edgeGap - cfg.boxHeight;
      if (!cfg.createFronts && span < -.001)
          throw new Error('A altura da caixa não cabe no vão');
      const step = !cfg.createFronts && cfg.count > 1 ? span / (cfg.count - 1) : 0;
      if (!cfg.createFronts && cfg.count > 1 && step < 1)
          throw new Error('As gavetas não cabem na altura informada');
      if (cfg.createFronts) {
          const availableFrontH = cfg.openingH - cfg.frontGapTop - cfg.frontGapBottom - cfg.frontGapBetween * (cfg.count - 1);
          cfg.frontH = availableFrontH / cfg.count;
          cfg.frontW = cfg.usableW - cfg.frontGapLeft - cfg.frontGapRight;
          if (cfg.frontH <= 10 || cfg.frontW <= 10)
              throw new Error('As folgas das frentes não cabem no vão');
          if (cfg.boxHeight > cfg.frontH + .001)
              throw new Error('A caixa é mais alta que a frente calculada');
      }
      cfg.bottomW = cfg.innerW + cfg.bottomPassLeft + cfg.bottomPassRight;
      cfg.bottomD = Math.max(1, cfg.resolvedLength - cfg.boxThickness * 2) + cfg.bottomPassFront + cfg.bottomPassBack;
      // Recalcula sempre, inclusive em projetos antigos e após redimensionar o móvel.
      const bottomTopMm = Math.max(0, Number(cfg.bottomOffset || 0) + Number(cfg.bottomThickness || 0));
      cfg.bottomCutFront = Number(cfg.bottomPassFront || 0) > .001 ? bottomTopMm : 0;
      cfg.bottomCutBack = Number(cfg.bottomPassBack || 0) > .001 ? bottomTopMm : 0;
      if (cfg.bottomCutFront >= cfg.boxHeight - 1)
          throw new Error('O fundo deixa menos de 1 mm de contra frente');
      if (cfg.bottomCutBack >= cfg.boxHeight - 1)
          throw new Error('O fundo deixa menos de 1 mm de contra fundo');
      cfg.slideName = preset.name;
      cfg.name = `${cfg.count} gaveta${cfg.count > 1 ? 's' : ''} · ${preset.name}`;
      const t = m(cfg.boxThickness), bt = m(cfg.bottomThickness), outerW = m(cfg.outerW), innerW = m(cfg.innerW), len = m(cfg.resolvedLength), sideH = m(cfg.boxHeight);
      // Frente de gaveta agora fica DENTRO do vão. A caixa começa atrás da
      // espessura da frente + recuo configurado, evitando qualquer sobreposição.
      const frontFaceReserve = Number(cfg.frontInset || 0) + (cfg.createFronts ? Number(cfg.frontThickness || 0) : 0);
      const frontZ = cell.maxZ - m(frontFaceReserve), backZ = frontZ - len, zCenter = (frontZ + backZ) / 2;
      const usableMinX = cell.minX + m(cfg.tamponTotalLeft || 0), usableMaxX = cell.maxX - m(cfg.tamponTotalRight || 0);
      const leftX = usableMinX + m(cfg.sideClearance) + t / 2, rightX = usableMaxX - m(cfg.sideClearance) - t / 2;
      const levels = [];
      state.historyMuted = true;
      try {
          // 1.311.00-r2 · conjunto físico do tamponamento:
          // [lateral do móvel] -> [ripas curtas de afastamento] -> [lateral interna inteira]
          // -> [corrediça] -> [caixa da gaveta]. A frente também respeita essa lateral,
          // ficando embutida no vão útil restante.
          if (cfg.createTampon) {
              const td = m(cfg.tamponStripDepth || 60);
              const ty = cell.minY, th = m(cfg.openingH), spacer = m(cfg.tamponThickness || 18);
              const panelT = m(cfg.tamponPanelThickness || 18), fullDepth = Math.max(m(.001), cell.maxZ - cell.minZ);
              const centerZ = (cell.minZ + cell.maxZ) / 2;
              const createSide = (side) => {
                  const isLeft = side === 'left';
                  const enabled = isLeft ? cfg.tamponLeft > 0 : cfg.tamponRight > 0;
                  if (!enabled) return;
                  const stripX = isLeft ? cell.minX + spacer / 2 : cell.maxX - spacer / 2;
                  const panelX = isLeft ? cell.minX + spacer + panelT / 2 : cell.maxX - spacer - panelT / 2;
                  if (cfg.tamponFrontStrip) {
                      const z = cell.maxZ - m(cfg.tamponFrontInset) - td / 2;
                      drawerCreatePiece({ width: spacer, depth: td, height: th, x: stripX, yBase: ty, z, name: `Tamponamento ${isLeft ? 'esquerdo' : 'direito'} · ripa frontal` }, cfg, `tampon-strip-${side}-front`, -1);
                  }
                  if (cfg.tamponRearStrip) {
                      const z = cell.minZ + m(cfg.tamponRearInset) + td / 2;
                      drawerCreatePiece({ width: spacer, depth: td, height: th, x: stripX, yBase: ty, z, name: `Tamponamento ${isLeft ? 'esquerdo' : 'direito'} · ripa traseira` }, cfg, `tampon-strip-${side}-rear`, -1);
                  }
                  drawerCreatePiece({ width: panelT, depth: fullDepth, height: th, x: panelX, yBase: ty, z: centerZ, name: `Tamponamento ${isLeft ? 'esquerdo' : 'direito'} · lateral interna` }, cfg, isLeft ? 'tampon-left' : 'tampon-right', -1);
              };
              createSide('left');
              createSide('right');
          }
          for (let i = 0; i < cfg.count; i++) {
              let frontYBase = null;
              if (cfg.createFronts)
                  frontYBase = cell.minY + m(cfg.frontGapBottom + i * (cfg.frontH + cfg.frontGapBetween));
              const yBase = cfg.createFronts
                  ? frontYBase + m((cfg.frontH - cfg.boxHeight) / 2)
                  : cell.minY + m(cfg.edgeGap + (cfg.count > 1 ? step * i : span / 2));
              levels.push(yBase);
              const sideLeft = drawerCreatePiece({ width: t, depth: len, height: sideH, x: leftX, yBase, z: zCenter, name: `G${i + 1} · Lateral esquerda` }, cfg, 'side-left', i);
              const sideRight = drawerCreatePiece({ width: t, depth: len, height: sideH, x: rightX, yBase, z: zCenter, name: `G${i + 1} · Lateral direita` }, cfg, 'side-right', i);
              // Se o fundo passa para frente/atrás, a contra frente / contra fundo
              // é encurtada por baixo até o topo do fundo.
              const frontCut = m(cfg.bottomCutFront || 0), backCut = m(cfg.bottomCutBack || 0);
              const frontH = Math.max(m(.001), sideH - frontCut);
              const backH = Math.max(m(.001), sideH - backCut);
              const boxFront = drawerCreatePiece({
                  width: innerW, depth: t, height: frontH,
                  x: (leftX + rightX) / 2,
                  yBase: yBase + frontCut,
                  z: frontZ - t / 2,
                  name: `G${i + 1} · Contra frente${frontCut > 0 ? ` · corte ${nice(cfg.bottomCutFront)} mm` : ''}`
              }, cfg, 'box-front', i);
              const boxBack = drawerCreatePiece({
                  width: innerW, depth: t, height: backH,
                  x: (leftX + rightX) / 2,
                  yBase: yBase + backCut,
                  z: backZ + t / 2,
                  name: `G${i + 1} · Contra fundo${backCut > 0 ? ` · corte ${nice(cfg.bottomCutBack)} mm` : ''}`
              }, cfg, 'box-back', i);
              if (cfg.machineBottom) {
                  if (cfg.grooveLeft)
                      drawerAddBottomGroove(sideLeft, cfg, i, 'side-left');
                  if (cfg.grooveRight)
                      drawerAddBottomGroove(sideRight, cfg, i, 'side-right');
                  // Contra frente/fundo só recebem rasgo se o usuário marcou.
                  // Se houver recorte inferior porque o fundo passa pela peça, o
                  // recorte prevalece e o rasgo é ignorado.
                  if (cfg.grooveFront && !(cfg.bottomCutFront > 0))
                      drawerAddBottomGroove(boxFront, cfg, i, 'box-front');
                  if (cfg.grooveBack && !(cfg.bottomCutBack > 0))
                      drawerAddBottomGroove(boxBack, cfg, i, 'box-back');
              }
              const bottomBaseDepth = Math.max(m(.001), len - 2 * t);
              const bottomW = m(cfg.innerW + cfg.bottomPassLeft + cfg.bottomPassRight);
              const bottomDepth = Math.max(m(.001), bottomBaseDepth + m(cfg.bottomPassFront + cfg.bottomPassBack));
              const bottomX = (leftX + rightX) / 2 + m((cfg.bottomPassRight - cfg.bottomPassLeft) / 2);
              const bottomZ = zCenter + m((cfg.bottomPassFront - cfg.bottomPassBack) / 2);
              const bottomY = yBase + m(cfg.bottomOffset);
              drawerCreatePiece({ width: bottomW, depth: bottomDepth, height: bt, x: bottomX, yBase: bottomY, z: bottomZ, name: `G${i + 1} · Fundo ${nice(cfg.bottomThickness)} mm` }, cfg, 'bottom', i);
              if (cfg.createFronts) {
                  const fw = m(cfg.frontW), fh = m(cfg.frontH), ft = m(cfg.frontThickness);
                  const fx = usableMinX + m(cfg.frontGapLeft) + fw / 2;
                  // A face frontal fica alinhada ao limite frontal do vão e toda
                  // a espessura permanece para DENTRO do espaço selecionado.
                  const fz = cell.maxZ - ft / 2;
                  const front = drawerCreatePiece({ width: fw, depth: ft, height: fh, x: fx, yBase: frontYBase, z: fz, name: `G${i + 1} · Frente de gaveta` }, cfg, 'drawer-front', i);
                  if (root.doorsHidden) {
                      front.visible = false;
                      front.userData.hiddenByDoors = true;
                  }
              }
              if (cfg.createSlides) {
                  const isUnder = cfg.slideType === 'undermount';
                  // Corrediça oculta: o trilho fica embaixo da caixa e não dentro da
                  // folga lateral. Por isso sua largura visual não deve ser limitada
                  // aos 21 mm de folga. A referência técnica UM A25 usa ~39 mm na
                  // seção inferior; o comprimento físico ocupa NL + 18 mm.
                  const railWidthMm = isUnder
                      ? Number(preset.railWidth || 39)
                      : Math.max(2, Math.min(Number(preset.railWidth || 10), cfg.sideClearance));
                  const railDepthMm = isUnder
                      ? Number(cfg.resolvedLength || 0) + Number(preset.railExtraLength || 0)
                      : Number(cfg.resolvedLength || 0);
                  const rw = m(railWidthMm), rh = m(preset.railHeight), railDepth = m(railDepthMm);
                  const railY = isUnder ? yBase : yBase + Math.max(0, (sideH - rh) / 2);
                  const lx = isUnder
                      ? usableMinX + rw / 2
                      : usableMinX + m(cfg.sideClearance / 2);
                  const rx = isUnder
                      ? usableMaxX - rw / 2
                      : usableMaxX - m(cfg.sideClearance / 2);
                  const railFrontBase = cell.maxZ - m(cfg.createFronts ? Number(cfg.frontThickness || 0) : 0);
                  const railFrontZ = railFrontBase - m(Number(preset.railFrontInset || 0));
                  const railZ = railFrontZ - railDepth / 2;
                  drawerCreatePiece({
                      width: rw, depth: railDepth, height: rh, x: lx, yBase: railY, z: railZ,
                      name: `G${i + 1} · Corrediça esquerda ${cfg.resolvedLength}`
                  }, cfg, 'slide-left', i, 'hardware-visual', true);
                  drawerCreatePiece({
                      width: rw, depth: railDepth, height: rh, x: rx, yBase: railY, z: railZ,
                      name: `G${i + 1} · Corrediça direita ${cfg.resolvedLength}`
                  }, cfg, 'slide-right', i, 'hardware-visual', true);
              }
          }
          const drill = drawerAddCabinetDrilling(cfg, levels);
          for (const o of drawerSetObjects(cfg.id))
              o.userData.drawerConfig = JSON.parse(JSON.stringify(cfg));
          // Garantia final: se "Usinar encaixe do fundo" estiver ligado, as
          // laterais precisam sair daqui já com os rasgos.
          const bottomGrooves = drawerEnsureBottomGroovesForSet(cfg.id);
          sanitizeDrawerSet(cfg.id);
          renderMachiningVisuals();
          updateInspector();
          state.historyMuted = false;
          if (doHistory)
              commitHistory();
          return { cfg, drill, levels, bottomGrooves };
      }
      catch (err) {
          state.historyMuted = false;
          removeDrawerSet(cfg.id, { commit: false });
          throw err;
      }
  }
  
  function sanitizeDrawerSet(setId) {
      for (const o of drawerSetObjects(setId)) {
          if (o.userData.kind === 'hardware-visual') {
              o.userData.excludeFromCutList = true;
              continue;
          }
          sanitizeMachiningForPiece(o);
      }
  }
  
  function saveDrawerSystem() {
      // Guarda um snapshot para que uma falha durante a troca nunca deixe o
      // móvel sem as gavetas antigas.
      const before = captureState();
      const editingBefore = drawerEditingSetId;
      const targetRootBefore = drawerTargetRootId;
      const targetCellBefore = drawerTargetCellId;
      try {
          const cfg = drawerReadConfig();
          // Em edição, preserva o mesmo ID. Se o diálogo foi aberto pelo espaço,
          // pega automaticamente o set que já pertence ao vão.
          const existingIds = drawerSetIdsForTarget(cfg.targetRootId, cfg.targetCellId);
          const primaryId = editingBefore || existingIds[0] || null;
          if (primaryId)
              cfg.id = primaryId;
          // REGRA 1.100.3:
          // Um vão possui um único conjunto paramétrico de gavetas. Antes de criar
          // a versão editada, apaga SEMPRE todos os conjuntos antigos desse vão.
          // Isso também limpa duplicatas deixadas por versões anteriores.
          const idsToRemove = new Set(existingIds);
          if (editingBefore)
              idsToRemove.add(editingBefore);
          let removedObjects = 0;
          for (const id of idsToRemove) {
              if (!id)
                  continue;
              removedObjects += removeDrawerSet(id, { commit: false, keepSelection: true });
          }
          // Segurança extra: depois da limpeza, não pode restar nenhum objeto de
          // outro set apontando para o mesmo target.
          const leftovers = drawerSetIdsForTarget(cfg.targetRootId, cfg.targetCellId);
          for (const id of leftovers) {
              removedObjects += removeDrawerSet(id, { commit: false, keepSelection: true });
          }
          const result = createDrawerSetFromConfig(cfg, { doHistory: true });
          // Verificação pós-criação: deve existir exatamente UM set no vão.
          const finalIds = drawerSetIdsForTarget(cfg.targetRootId, cfg.targetCellId);
          if (finalIds.length !== 1 || finalIds[0] !== cfg.id) {
              throw new Error('Falha de consistência ao substituir o conjunto de gavetas');
          }
          $('drawerSystemDialog').style.display = 'none';
          drawerEditingSetId = null;
          drawerTargetRootId = null;
          drawerTargetCellId = null;
          const d = result.drill;
          const replaced = idsToRemove.size > 0 || removedObjects > 0;
          toast(`${replaced ? 'Gavetas atualizadas' : 'Gavetas criadas'} · ${cfg.count} · corrediça ${cfg.resolvedLength} mm · ${d.holes} furo(s) no gabinete`);
      }
      catch (err) {
          // Se qualquer etapa falhar depois da remoção, restaura exatamente o
          // estado anterior. Assim nunca fica conjunto duplicado nem edição pela metade.
          try {
              state.historyMuted = true;
              applyState(before);
              state.historyMuted = false;
              drawerEditingSetId = editingBefore;
              drawerTargetRootId = targetRootBefore;
              drawerTargetCellId = targetCellBefore;
          }
          catch (rollbackErr) {
              state.historyMuted = false;
              console.error('Rollback das gavetas:', rollbackErr);
          }
          toast(err.message || 'Não foi possível atualizar as gavetas');
          updateDrawerSystemPreview();
      }
  }
  
  function deleteDrawerSystem() {
      if (!drawerEditingSetId)
          return;
      const cfg = drawerConfigFromSet(drawerEditingSetId);
      if (!window.confirm(`Excluir “${cfg?.name || 'conjunto de gavetas'}”?\\n\\nAs furações automáticas deste conjunto também serão removidas.`))
          return;
      removeDrawerSet(drawerEditingSetId, { commit: true });
      $('drawerSystemDialog').style.display = 'none';
      drawerEditingSetId = null;
      drawerTargetRootId = null;
      drawerTargetCellId = null;
      toast('Conjunto removido');
  }
  
  function rebuildDrawerSetsForRoot(root) {
      if (!root)
          return;
      const configs = drawerUniqueConfigsForRoot(root.id);
      if (!configs.length)
          return;
      for (const cfg of configs) {
          if (!getSpaceCell(root.id, cfg.targetCellId))
              continue;
          removeDrawerSet(cfg.id, { commit: false, keepSelection: true });
          try {
              createDrawerSetFromConfig(cfg, { doHistory: false });
          }
          catch (err) {
              console.warn('Gavetas após redimensionar:', err);
          }
      }
  }
  
  // ============================================================================
  // 1.300.17 · SISTEMA DE PORTAS / BIBLIOTECA DE PORTAS
  // O primeiro modelo oficial foi capturado diretamente do Espaço 3 final
  // enviado pelo usuário. O CAD guarda a medida acabada; a fabricação pode
  // acrescentar uma sobremedida somente às faces da folha.
  // ============================================================================
  const DOOR_SYSTEM_LIBRARY_KEY = 'designLabDoorLibraryV130001';
  
  const DOOR_SYSTEM_OVERSIZE_PREFS_KEY = 'designLabDoorOversizePrefsV130009';
  
  function doorSystemReadOversizePrefs() {
      try {
          const v = JSON.parse(localStorage.getItem(DOOR_SYSTEM_OVERSIZE_PREFS_KEY) || '{}');
          return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
      }
      catch (_) {
          return {};
      }
  }
  
  function doorSystemPreferredOversize(model) {
      const prefs = doorSystemReadOversizePrefs(), n = Number(prefs?.[model?.id]);
      if (Number.isFinite(n) && n >= 0 && n <= 100)
          return n;
      const def = Number(model?.productionOversizeMm);
      return Number.isFinite(def) && def >= 0 ? def : 10;
  }
  
  function doorSystemRememberOversize(modelId, value) {
      const n = Number(value);
      if (!modelId || !Number.isFinite(n) || n < 0 || n > 100)
          return;
      try {
          const prefs = doorSystemReadOversizePrefs();
          prefs[modelId] = n;
          localStorage.setItem(DOOR_SYSTEM_OVERSIZE_PREFS_KEY, JSON.stringify(prefs));
      }
      catch (_) { }
  }
  
  const DOOR_SYSTEM_BUILTIN_PIVOT_B64 = 'eyJ0eXBlIjoibWluaS1jYWQtZnVybml0dXJlIiwidmVyc2lvbiI6NTcsInVuaXQiOiJtZXRlciIsIm5hbWUiOiJQb3J0YSBQaXZvdGFudGUgMDEiLCJjcmVhdGVkQXQiOiIyMDI2LTA5LTA3VDIyOjE3OjMyLjM4MloiLCJvYmplY3RzIjpbeyJraW5kIjoicGFuZWwiLCJuYW1lIjoiQmF0ZW50ZSBkaXJlaXRvIiwibWF0ZXJpYWxUeXBlIjoiQ2FydmFsaG8iLCJiYXNlQ29sb3IiOjExMTczMjAwLCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWRmLWNhcnZhbGhvIiwibWF0ZXJpYWxDb2RlIjoiTURGLUNBUiIsIm1hdGVyaWFsR3JhaW4iOnRydWUsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjYjg5MjYzIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJlZ2poZV84bDZ3ZGUiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWF4WCI6MC44NzU5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAuMDY1LCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOi0wLjAyMjQ5OTk5OTk5OTk5OTk5MiwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6IjowfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjU1LCJmcm9udCI6MTAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC4wMTYwMDAwMDAwMDAwMDAwMTQsImRlcHRoIjowLjI2LCJoZWlnaHQiOjIuNSwieCI6MC44Njc5OTk5OTk5OTk5OTk5LCJ5QmFzZSI6MCwieiI6MC4wNzUwMDAwMDAwMDAwMDAwMX0seyJraW5kIjoicGFuZWwiLCJuYW1lIjoiRmVjaGFtZW50byBiYXRlbnRlIGRpcmVpdG8iLCJtYXRlcmlhbFR5cGUiOiJDYXJ2YWxobyIsImJhc2VDb2xvciI6MTExNzMyMDAsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZGYtY2FydmFsaG8iLCJtYXRlcmlhbENvZGUiOiJNREYtQ0FSIiwibWF0ZXJpYWxHcmFpbiI6dHJ1ZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiNiODkyNjMiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cmVqcnJlX2YyNGJoZSIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC44NzU5OTk5OTk5OTk5OTk5LCJtYXhYIjowLjg5MTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MC4xMzUsIm1heFoiOjAuMTk1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAuMDM1LCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDI3NDk5OTk5OTk5OTk5OTk3LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjEwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjozNSwiYm90dG9tIjowLCJ0b3AiOjB9LCJyb3RhdGlvbiI6eyJ4IjowLCJ5IjowLCJ6IjowfX0sInJvdGF0aW9uWCI6MC4wLCJyb3RhdGlvblkiOjAuMCwicm90YXRpb25aIjowLjAsIndpZHRoIjowLjAxNjAwMDAwMDAwMDAwMDAxNCwiZGVwdGgiOjAuMDk1LCJoZWlnaHQiOjIuNSwieCI6MC44ODM5OTk5OTk5OTk5OTk5LCJ5QmFzZSI6MCwieiI6MC4xOTI1fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJGZWNoYW1lbnRvIHRyYXNlaXJvIGJhdGVudGUgZGlyZWl0byIsIm1hdGVyaWFsVHlwZSI6IkNhcnZhbGhvIiwiYmFzZUNvbG9yIjoxMTE3MzIwMCwibWF0ZXJpYWxJZCI6Im1hdC1mYWN0b3J5LW1kZi1jYXJ2YWxobyIsIm1hdGVyaWFsQ29kZSI6Ik1ERi1DQVIiLCJtYXRlcmlhbEdyYWluIjp0cnVlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiI2I4OTI2MyIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRyZW1xcmNfMTFvM3RpIiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjg3NTk5OTk5OTk5OTk5OTksIm1heFgiOjAuODkxOTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjA2fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAsImRoIjowLCJkeCI6MCwiZHlCYXNlIjowLCJkeiI6MCwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6IjowfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuMDE2MDAwMDAwMDAwMDAwMDE0LCJkZXB0aCI6MC4wNiwiaGVpZ2h0IjoyLjUsIngiOjAuODgzOTk5OTk5OTk5OTk5OSwieUJhc2UiOjAsInoiOjAuMDN9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkJhdGVudGUgZXNxdWVyZG8iLCJtYXRlcmlhbFR5cGUiOiJDYXJ2YWxobyIsImJhc2VDb2xvciI6MTExNzMyMDAsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZGYtY2FydmFsaG8iLCJtYXRlcmlhbENvZGUiOiJNREYtQ0FSIiwibWF0ZXJpYWxHcmFpbiI6dHJ1ZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiNiODkyNjMiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cmV0dDNvX2o5b3NzZSIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wMDgsIm1heFgiOjAuMDI0LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAuMDg5MDAwMDAwMDAwMDAwMDIsImRoIjowLCJkeCI6MCwiZHlCYXNlIjowLCJkeiI6LTAuMDEwNDk5OTk5OTk5OTk5OTk1LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6NTUsImZyb250IjozNCwiYm90dG9tIjowLCJ0b3AiOjB9LCJyb3RhdGlvbiI6eyJ4IjowLCJ5IjowLCJ6IjowfX0sInJvdGF0aW9uWCI6MC4wLCJyb3RhdGlvblkiOjAuMCwicm90YXRpb25aIjowLjAsIndpZHRoIjowLjAxNiwiZGVwdGgiOjAuMjg0MDAwMDAwMDAwMDAwMDMsImhlaWdodCI6Mi41LCJ4IjowLjAxNiwieUJhc2UiOjAsInoiOjAuMDg3MDAwMDAwMDAwMDAwMDF9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkZlY2hhbWVudG8gYmF0ZW50ZSBlc3F1ZXJkbyIsIm1hdGVyaWFsVHlwZSI6IkNhcnZhbGhvIiwiYmFzZUNvbG9yIjoxMTE3MzIwMCwibWF0ZXJpYWxJZCI6Im1hdC1mYWN0b3J5LW1kZi1jYXJ2YWxobyIsIm1hdGVyaWFsQ29kZSI6Ik1ERi1DQVIiLCJtYXRlcmlhbEdyYWluIjp0cnVlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiI2I4OTI2MyIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRyZXR2ZmhfeW42YnppIiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjAyNCwibWF4WCI6MC4wNCwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xOTV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA1NDk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjU1fSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuMDE2LCJkZXB0aCI6MC4wNDAwMDAwMDAwMDAwMDAwMSwiaGVpZ2h0IjoyLjUsIngiOjAuMDMyLCJ5QmFzZSI6MCwieiI6MC4yMjk5OTk5OTk5OTk5OTk5OH0seyJraW5kIjoicGFuZWwiLCJuYW1lIjoiRm9saGEgUG9ydGEiLCJtYXRlcmlhbFR5cGUiOiJMw6JtaW5hIENhcnZhbGhvIiwiYmFzZUNvbG9yIjoxMTEwNzE1MiwibWF0ZXJpYWxJZCI6Im1hdC1mYWN0b3J5LXZlbmVlci1jYXJ2YWxobyIsIm1hdGVyaWFsQ29kZSI6IkxBTS1DQVIiLCJtYXRlcmlhbEdyYWluIjp0cnVlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiI2E5N2I1MCIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRyZjZvaTdfc3g2cG5iIiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xODUsIm1heFoiOjAuMTk1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MC4wMDYwMDAwMDAwMDAwMDAwMDUsImRkIjowLCJkaCI6MCwiZHgiOjAuMDA4MDAwMDAwMDAwMDAwMDA3LCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6LTUsInJpZ2h0IjoxMSwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC44MjU5OTk5OTk5OTk5OTk4LCJkZXB0aCI6MC4wMTAwMDAwMDAwMDAwMDAwMDksImhlaWdodCI6Mi40OSwieCI6MC40NTc5OTk5OTk5OTk5OTk5NiwieUJhc2UiOjAuMDA0OTk5OTk5OTk5OTk5ODkzLCJ6IjowLjI0fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJGb2xoYSBQb3J0YSIsIm1hdGVyaWFsVHlwZSI6IkzDom1pbmEgQ2FydmFsaG8iLCJiYXNlQ29sb3IiOjExMTA3MTUyLCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktdmVuZWVyLWNhcnZhbGhvIiwibWF0ZXJpYWxDb2RlIjoiTEFNLUNBUiIsIm1hdGVyaWFsR3JhaW4iOnRydWUsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjYTk3YjUwIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJmNnh0ZF85bDBldDkiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE0NSwibWF4WiI6MC4xNTV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLjAwNjAwMDAwMDAwMDAwMDAwNSwiZGQiOjAsImRoIjowLCJkeCI6LTAuMDA4MDAwMDAwMDAwMDAwMDA3LCJkeUJhc2UiOjAsImR6IjowLjA1MDAwMDAwMDAwMDAwMDAyLCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MTEsInJpZ2h0IjotNSwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC44MjU5OTk5OTk5OTk5OTk4LCJkZXB0aCI6MC4wMTAwMDAwMDAwMDAwMDAwMDksImhlaWdodCI6Mi40OSwieCI6MC40NDE5OTk5OTk5OTk5OTk5NSwieUJhc2UiOjAuMDA0OTk5OTk5OTk5OTk5ODkzLCJ6IjowLjJ9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkVzdHJ1dHVyYSBtYWRlaXJhIiwibWF0ZXJpYWxUeXBlIjoiTWFkZWlyYSBtYWNpw6dhIFRhdWFyaSIsImJhc2VDb2xvciI6MTI4ODY2NDQsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS13b29kLXRhdWFyaSIsIm1hdGVyaWFsQ29kZSI6Ik1BQy1UQVUiLCJtYXRlcmlhbEdyYWluIjp0cnVlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiI2M0YTI3NCIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRycmFuNDBfN3FvanFpIiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjEyLCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOi0wLjAwNTAwMDAwMDAwMDAwMDAwNDQsImRkIjowLCJkaCI6MCwiZHgiOjAuMDAyNTAwMDAwMDAwMDAwMDAyMiwiZHlCYXNlIjowLCJkeiI6MC4wNDk5OTk5OTk5OTk5OTk5OSwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6Ijo1MH0sImZhY2VzIjp7ImxlZnQiOi01LCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC4wNzQ5OTk5OTk5OTk5OTk5OCwiZGVwdGgiOjAuMDMsImhlaWdodCI6Mi40OSwieCI6MC4wODI1LCJ5QmFzZSI6MC4wMDQ5OTk5OTk5OTk5OTk4OTMsInoiOjAuMjE5OTk5OTk5OTk5OTk5OTd9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkVzdHJ1dHVyYSBtYWRlaXJhIiwibWF0ZXJpYWxUeXBlIjoiTWFkZWlyYSBtYWNpw6dhIFRhdWFyaSIsImJhc2VDb2xvciI6MTI4ODY2NDQsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS13b29kLXRhdWFyaSIsIm1hdGVyaWFsQ29kZSI6Ik1BQy1UQVUiLCJtYXRlcmlhbEdyYWluIjp0cnVlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiI2M0YTI3NCIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRycmFwd3FfcjEwaXZoIiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjIuNDE1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAsImRoIjowLCJkeCI6MCwiZHlCYXNlIjowLCJkeiI6MC4wNDk5OTk5OTk5OTk5OTk5OSwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6Ijo1MH0sImZhY2VzIjp7ImxlZnQiOjAsInJpZ2h0IjowLCJiYWNrIjowLCJmcm9udCI6MCwiYm90dG9tIjowLCJ0b3AiOjB9LCJyb3RhdGlvbiI6eyJ4IjowLCJ5IjowLCJ6IjowfX0sInJvdGF0aW9uWCI6MC4wLCJyb3RhdGlvblkiOjAuMCwicm90YXRpb25aIjowLjAsIndpZHRoIjowLjY1NDk5OTk5OTk5OTk5OTksImRlcHRoIjowLjAzLCJoZWlnaHQiOjAuMDgwMDAwMDAwMDAwMDAwMDcsIngiOjAuNDQ3NDk5OTk5OTk5OTk5OTUsInlCYXNlIjoyLjQxNSwieiI6MC4yMTk5OTk5OTk5OTk5OTk5N30seyJraW5kIjoicGFuZWwiLCJuYW1lIjoiTWV0YWxvbiAyMHgzMCIsIm1hdGVyaWFsVHlwZSI6Ik1ldGFsb24gMjDDlzMwIiwiYmFzZUNvbG9yIjo1NTkzOTUyLCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWV0YWwtbWV0YWxvbi0yMHgzMCIsIm1hdGVyaWFsQ29kZSI6Ik1FVC0yMFgzMCIsIm1hdGVyaWFsR3JhaW4iOmZhbHNlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiIzU1NWI2MCIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRycmh5dGRfM3h3ZWxhIiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjYwNzk5OTk5OTk5OTk5OTksIm1heFgiOjAuNjI3OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOjAsImRkIjowLCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDQ5OTk5OTk5OTk5OTk5OTksImRyeCI6MCwiZHJ5IjowLCJkcnoiOjB9LCJwaWVjZVNhdmVkQ29uZmlnIjp7Im1vdmUiOnsieCI6MCwieSI6MCwieiI6NTB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC4wMjAwMDAwMDAwMDAwMDAwMTgsImRlcHRoIjowLjAzLCJoZWlnaHQiOjIuMjksIngiOjAuNjE3OTk5OTk5OTk5OTk5OSwieUJhc2UiOjAuMTA0OTk5OTk5OTk5OTk5OTgsInoiOjAuMjE5OTk5OTk5OTk5OTk5OTd9LHsia2luZCI6InBhbmVsIiwibmFtZSI6Ik1ldGFsb24gMjB4MzAiLCJtYXRlcmlhbFR5cGUiOiJNZXRhbG9uIDIww5czMCIsImJhc2VDb2xvciI6NTU5Mzk1MiwibWF0ZXJpYWxJZCI6Im1hdC1mYWN0b3J5LW1ldGFsLW1ldGFsb24tMjB4MzAiLCJtYXRlcmlhbENvZGUiOiJNRVQtMjBYMzAiLCJtYXRlcmlhbEdyYWluIjpmYWxzZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiM1NTViNjAiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cnJpMm1jX2J1cmIyYSIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuMTU3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAsImRoIjowLCJkeCI6MCwiZHlCYXNlIjowLCJkeiI6MC4wNDk5OTk5OTk5OTk5OTk5OSwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6Ijo1MH0sImZhY2VzIjp7ImxlZnQiOjAsInJpZ2h0IjowLCJiYWNrIjowLCJmcm9udCI6MCwiYm90dG9tIjowLCJ0b3AiOjB9LCJyb3RhdGlvbiI6eyJ4IjowLCJ5IjowLCJ6IjowfX0sInJvdGF0aW9uWCI6MC4wLCJyb3RhdGlvblkiOjAuMCwicm90YXRpb25aIjowLjAsIndpZHRoIjowLjAxOTk5OTk5OTk5OTk5OTk5LCJkZXB0aCI6MC4wMywiaGVpZ2h0IjoyLjI5LCJ4IjowLjE0NzAwMDAwMDAwMDAwMDAyLCJ5QmFzZSI6MC4xMDQ5OTk5OTk5OTk5OTk5OCwieiI6MC4yMTk5OTk5OTk5OTk5OTk5N30seyJraW5kIjoicGFuZWwiLCJuYW1lIjoiTWV0YWxvbiAyMHgzMCIsIm1hdGVyaWFsVHlwZSI6Ik1ldGFsb24gMjDDlzMwIiwiYmFzZUNvbG9yIjo1NTkzOTUyLCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWV0YWwtbWV0YWxvbi0yMHgzMCIsIm1hdGVyaWFsQ29kZSI6Ik1FVC0yMFgzMCIsIm1hdGVyaWFsR3JhaW4iOmZhbHNlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiIzU1NWI2MCIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRycmljY3NfcmZnbzRhIiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDg1LCJtYXhZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuNjU0OTk5OTk5OTk5OTk5OSwiZGVwdGgiOjAuMDMsImhlaWdodCI6MC4wMjAwMDAwMDAwMDAwMDAwMDQsIngiOjAuNDQ3NDk5OTk5OTk5OTk5OTUsInlCYXNlIjowLjA4NDk5OTk5OTk5OTk5OTk5LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJNZXRhbG9uIDIweDMwIiwibWF0ZXJpYWxUeXBlIjoiTWV0YWxvbiAyMMOXMzAiLCJiYXNlQ29sb3IiOjU1OTM5NTIsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZXRhbC1tZXRhbG9uLTIweDMwIiwibWF0ZXJpYWxDb2RlIjoiTUVULTIwWDMwIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjNTU1YjYwIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJyaWZ2el9oeTFpamgiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuNjc3NSwibWF4WSI6MC42OTc1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuNDE2OTk5OTk5OTk5OTk5NzYsImRlcHRoIjowLjAzLCJoZWlnaHQiOjAuMDIwMDAwMDAwMDAwMDAwMDE4LCJ4IjowLjM4MjQ5OTk5OTk5OTk5OTg0LCJ5QmFzZSI6MC42Nzc1LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJNZXRhbG9uIDIweDMwIiwibWF0ZXJpYWxUeXBlIjoiTWV0YWxvbiAyMMOXMzAiLCJiYXNlQ29sb3IiOjU1OTM5NTIsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZXRhbC1tZXRhbG9uLTIweDMwIiwibWF0ZXJpYWxDb2RlIjoiTUVULTIwWDMwIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjNTU1YjYwIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJyaWllb19uYTRxODUiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjEuMjUsIm1heFkiOjEuMjcsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOjAsImRkIjowLCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDQ5OTk5OTk5OTk5OTk5OTksImRyeCI6MCwiZHJ5IjowLCJkcnoiOjB9LCJwaWVjZVNhdmVkQ29uZmlnIjp7Im1vdmUiOnsieCI6MCwieSI6MCwieiI6NTB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC40MTY5OTk5OTk5OTk5OTk3NiwiZGVwdGgiOjAuMDMsImhlaWdodCI6MC4wMjAwMDAwMDAwMDAwMDAwMTgsIngiOjAuMzgyNDk5OTk5OTk5OTk5ODQsInlCYXNlIjoxLjI1LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJNZXRhbG9uIDIweDMwIiwibWF0ZXJpYWxUeXBlIjoiTWV0YWxvbiAyMMOXMzAiLCJiYXNlQ29sb3IiOjU1OTM5NTIsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZXRhbC1tZXRhbG9uLTIweDMwIiwibWF0ZXJpYWxDb2RlIjoiTUVULTIwWDMwIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjNTU1YjYwIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJyaWt6aF8xa2Jsb2MiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjEuODIyNSwibWF4WSI6MS44NDI1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuNDE2OTk5OTk5OTk5OTk5NzYsImRlcHRoIjowLjAzLCJoZWlnaHQiOjAuMDIwMDAwMDAwMDAwMDAwMDE4LCJ4IjowLjM4MjQ5OTk5OTk5OTk5OTg0LCJ5QmFzZSI6MS44MjI1LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJNZXRhbG9uIDIweDMwIiwibWF0ZXJpYWxUeXBlIjoiTWV0YWxvbiAyMMOXMzAiLCJiYXNlQ29sb3IiOjU1OTM5NTIsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZXRhbC1tZXRhbG9uLTIweDMwIiwibWF0ZXJpYWxDb2RlIjoiTUVULTIwWDMwIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjNTU1YjYwIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJyaW5scV8xcmVpaHkiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6Mi4zOTUsIm1heFkiOjIuNDE1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuNjU0OTk5OTk5OTk5OTk5OSwiZGVwdGgiOjAuMDMsImhlaWdodCI6MC4wMjAwMDAwMDAwMDAwMDAwMTgsIngiOjAuNDQ3NDk5OTk5OTk5OTk5OTUsInlCYXNlIjoyLjM5NTAwMDAwMDAwMDAwMDUsInoiOjAuMjE5OTk5OTk5OTk5OTk5OTd9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkVzdHJ1dHVyYSBwb3J0YSIsIm1hdGVyaWFsVHlwZSI6Ik1ERiBDcnUiLCJiYXNlQ29sb3IiOjEzMDg1MzA0LCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWRmLW1kZi1jcnUiLCJtYXRlcmlhbENvZGUiOiJNREYtQ1JVIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjYjg5MjYzIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJyaXZsNl9mZjhwZW0iLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTU3LCJtYXhYIjowLjE3NCwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOjAsImRkIjowLCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDQ5OTk5OTk5OTk5OTk5OTksImRyeCI6MCwiZHJ5IjowLCJkcnoiOjB9LCJwaWVjZVNhdmVkQ29uZmlnIjp7Im1vdmUiOnsieCI6MCwieSI6MCwieiI6NTB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC4wMTY5OTk5OTk5OTk5OTk5ODcsImRlcHRoIjowLjAzLCJoZWlnaHQiOjIuMjksIngiOjAuMTY1NDk5OTk5OTk5OTk5OTgsInlCYXNlIjowLjEwNDk5OTk5OTk5OTk5OTk4LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJFc3RydXR1cmEgcG9ydGEiLCJtYXRlcmlhbFR5cGUiOiJNREYgQ3J1IiwiYmFzZUNvbG9yIjoxMzA4NTMwNCwibWF0ZXJpYWxJZCI6Im1hdC1mYWN0b3J5LW1kZi1tZGYtY3J1IiwibWF0ZXJpYWxDb2RlIjoiTURGLUNSVSIsIm1hdGVyaWFsR3JhaW4iOmZhbHNlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiI2I4OTI2MyIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRycml5ODNfZXZtdGd1IiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjEzNywibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOjAsImRkIjowLCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDQ5OTk5OTk5OTk5OTk5OTksImRyeCI6MCwiZHJ5IjowLCJkcnoiOjB9LCJwaWVjZVNhdmVkQ29uZmlnIjp7Im1vdmUiOnsieCI6MCwieSI6MCwieiI6NTB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC4wMTcwMDAwMDAwMDAwMDAwMTUsImRlcHRoIjowLjAzLCJoZWlnaHQiOjIuMjksIngiOjAuMTI4NSwieUJhc2UiOjAuMTA0OTk5OTk5OTk5OTk5OTgsInoiOjAuMjE5OTk5OTk5OTk5OTk5OTd9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkVzdHJ1dHVyYSBwb3J0YSIsIm1hdGVyaWFsVHlwZSI6Ik1ERiBDcnUiLCJiYXNlQ29sb3IiOjEzMDg1MzA0LCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWRmLW1kZi1jcnUiLCJtYXRlcmlhbENvZGUiOiJNREYtQ1JVIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjYjg5MjYzIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJyajBwdl9wa2l1NjciLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWF4WCI6MC42MDc5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAsImRoIjowLCJkeCI6MCwiZHlCYXNlIjowLCJkeiI6MC4wNDk5OTk5OTk5OTk5OTk5OSwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6Ijo1MH0sImZhY2VzIjp7ImxlZnQiOjAsInJpZ2h0IjowLCJiYWNrIjowLCJmcm9udCI6MCwiYm90dG9tIjowLCJ0b3AiOjB9LCJyb3RhdGlvbiI6eyJ4IjowLCJ5IjowLCJ6IjowfX0sInJvdGF0aW9uWCI6MC4wLCJyb3RhdGlvblkiOjAuMCwicm90YXRpb25aIjowLjAsIndpZHRoIjowLjAxNzAwMDAwMDAwMDAwMDEyNiwiZGVwdGgiOjAuMDMsImhlaWdodCI6Mi4yOSwieCI6MC41OTk0OTk5OTk5OTk5OTk4LCJ5QmFzZSI6MC4xMDQ5OTk5OTk5OTk5OTk5OCwieiI6MC4yMTk5OTk5OTk5OTk5OTk5N30seyJraW5kIjoicGFuZWwiLCJuYW1lIjoiRXN0cnV0dXJhIHBvcnRhIiwibWF0ZXJpYWxUeXBlIjoiTURGIENydSIsImJhc2VDb2xvciI6MTMwODUzMDQsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZGYtbWRmLWNydSIsIm1hdGVyaWFsQ29kZSI6Ik1ERi1DUlUiLCJtYXRlcmlhbEdyYWluIjpmYWxzZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiNiODkyNjMiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cnJqMjAxXzk4MGVvayIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC42Mjc5OTk5OTk5OTk5OTk5LCJtYXhYIjowLjY0NDk5OTk5OTk5OTk5OTgsIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuMDE2OTk5OTk5OTk5OTk5OTA0LCJkZXB0aCI6MC4wMywiaGVpZ2h0IjoyLjI5LCJ4IjowLjYzNjQ5OTk5OTk5OTk5OTgsInlCYXNlIjowLjEwNDk5OTk5OTk5OTk5OTk4LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJFc3RydXR1cmEgbWFkZWlyYSIsIm1hdGVyaWFsVHlwZSI6Ik1hZGVpcmEgbWFjacOnYSBUYXVhcmkiLCJiYXNlQ29sb3IiOjEyODg2NjQ0LCJtYXRlcmlhbElkIjoibWF0LWZhY3Rvcnktd29vZC10YXVhcmkiLCJtYXRlcmlhbENvZGUiOiJNQUMtVEFVIiwibWF0ZXJpYWxHcmFpbiI6dHJ1ZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiNjNGEyNzQiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cnJqbWlnXzFkM3U3dCIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtYXhYIjowLjg1NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAsImRoIjowLCJkeCI6MCwiZHlCYXNlIjowLCJkeiI6MC4wNDk5OTk5OTk5OTk5OTk5OSwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6Ijo1MH0sImZhY2VzIjp7ImxlZnQiOjAsInJpZ2h0IjowLCJiYWNrIjowLCJmcm9udCI6MCwiYm90dG9tIjowLCJ0b3AiOjB9LCJyb3RhdGlvbiI6eyJ4IjowLCJ5IjowLCJ6IjowfX0sInJvdGF0aW9uWCI6MC4wLCJyb3RhdGlvblkiOjAuMCwicm90YXRpb25aIjowLjAsIndpZHRoIjowLjA3OTk5OTk5OTk5OTk5OTk2LCJkZXB0aCI6MC4wMywiaGVpZ2h0IjoyLjQ5LCJ4IjowLjgxNSwieUJhc2UiOjAuMDA0OTk5OTk5OTk5OTk5ODkzLCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJFc3RydXR1cmEgbWFkZWlyYSIsIm1hdGVyaWFsVHlwZSI6Ik1hZGVpcmEgbWFjacOnYSBUYXVhcmkiLCJiYXNlQ29sb3IiOjEyODg2NjQ0LCJtYXRlcmlhbElkIjoibWF0LWZhY3Rvcnktd29vZC10YXVhcmkiLCJtYXRlcmlhbENvZGUiOiJNQUMtVEFVIiwibWF0ZXJpYWxHcmFpbiI6dHJ1ZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiNjNGEyNzQiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cnJqeXJnX2FhMGI4aSIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6MC4wODUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOjAsImRkIjowLCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDQ5OTk5OTk5OTk5OTk5OTksImRyeCI6MCwiZHJ5IjowLCJkcnoiOjB9LCJwaWVjZVNhdmVkQ29uZmlnIjp7Im1vdmUiOnsieCI6MCwieSI6MCwieiI6NTB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC42NTQ5OTk5OTk5OTk5OTk5LCJkZXB0aCI6MC4wMywiaGVpZ2h0IjowLjA4LCJ4IjowLjQ0NzQ5OTk5OTk5OTk5OTk1LCJ5QmFzZSI6MC4wMDQ5OTk5OTk5OTk5OTk5OTc1LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fSx7ImtpbmQiOiJwYW5lbCIsIm5hbWUiOiJFc3RydXR1cmEgcG9ydGEiLCJtYXRlcmlhbFR5cGUiOiJNREYgQ3J1IiwiYmFzZUNvbG9yIjoxMzA4NTMwNCwibWF0ZXJpYWxJZCI6Im1hdC1mYWN0b3J5LW1kZi1tZGYtY3J1IiwibWF0ZXJpYWxDb2RlIjoiTURGLUNSVSIsIm1hdGVyaWFsR3JhaW4iOmZhbHNlLCJtYXRlcmlhbEdyYWluUm90YXRpb24iOjAsIm1hdGVyaWFsQ29yZUNvbG9yIjoiI2I4OTI2MyIsImVkZ2VCYW5kcyI6e30sInBhcnRJZCI6InBhcnRfbXRycmttdDRfZ2NpZDJ4IiwibGFiZWxNZXRhIjp7InNjaGVtYVZlcnNpb24iOjEsImVuYWJsZWQiOnRydWUsImN1c3RvbSI6e319LCJzcGFjZVJvb3RJZCI6InNwYWNlX210cTdwNWl3X2NqMXRjbyIsIm1hY2hpbmluZyI6W10sImZvcm1zIjpbXSwiY3VzdG9tUHJvZmlsZSI6bnVsbCwiY3VydmVkUm9sZSI6bnVsbCwiY3VydmVkUGFydCI6bnVsbCwiY3VydmVkQ29uZmlnIjpudWxsLCJkcmF3ZXJTZXRJZCI6bnVsbCwiZHJhd2VyUm9sZSI6bnVsbCwiZHJhd2VySW5kZXgiOjAsImRyYXdlckNvbmZpZyI6bnVsbCwiZG9vckNvbmZpZyI6bnVsbCwiZG9vclN5c3RlbSI6bnVsbCwiZXhjbHVkZUZyb21DdXRMaXN0IjpmYWxzZSwic3BhY2VDdXR0aW5nIjp0cnVlLCJzcGFjZUN1dFBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjY5NzUsIm1heFkiOjAuNzE0NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwiZGl2aXNpb25Ob21pbmFsVGhpY2tuZXNzTSI6bnVsbCwibWFudWFsR2VvbWV0cnlEZWx0YSI6eyJkdyI6MCwiZGQiOjAsImRoIjowLCJkeCI6MCwiZHlCYXNlIjowLCJkeiI6MC4wNDk5OTk5OTk5OTk5OTk5OSwiZHJ4IjowLCJkcnkiOjAsImRyeiI6MH0sInBpZWNlU2F2ZWRDb25maWciOnsibW92ZSI6eyJ4IjowLCJ5IjowLCJ6Ijo1MH0sImZhY2VzIjp7ImxlZnQiOjAsInJpZ2h0IjowLCJiYWNrIjowLCJmcm9udCI6MCwiYm90dG9tIjowLCJ0b3AiOjB9LCJyb3RhdGlvbiI6eyJ4IjowLCJ5IjowLCJ6IjowfX0sInJvdGF0aW9uWCI6MC4wLCJyb3RhdGlvblkiOjAuMCwicm90YXRpb25aIjowLjAsIndpZHRoIjowLjQxNjk5OTk5OTk5OTk5OTc2LCJkZXB0aCI6MC4wMywiaGVpZ2h0IjowLjAxNzAwMDAwMDAwMDAwMDAxNSwieCI6MC4zODI0OTk5OTk5OTk5OTk4NCwieUJhc2UiOjAuNjk3NSwieiI6MC4yMTk5OTk5OTk5OTk5OTk5N30seyJraW5kIjoicGFuZWwiLCJuYW1lIjoiRXN0cnV0dXJhIHBvcnRhIiwibWF0ZXJpYWxUeXBlIjoiTURGIENydSIsImJhc2VDb2xvciI6MTMwODUzMDQsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZGYtbWRmLWNydSIsIm1hdGVyaWFsQ29kZSI6Ik1ERi1DUlUiLCJtYXRlcmlhbEdyYWluIjpmYWxzZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiNiODkyNjMiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cnJrcDZpX3ZiamczeCIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC42NjA1LCJtYXhZIjowLjY3NzUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOjAsImRkIjowLCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDQ5OTk5OTk5OTk5OTk5OTksImRyeCI6MCwiZHJ5IjowLCJkcnoiOjB9LCJwaWVjZVNhdmVkQ29uZmlnIjp7Im1vdmUiOnsieCI6MCwieSI6MCwieiI6NTB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC40MTY5OTk5OTk5OTk5OTk3NiwiZGVwdGgiOjAuMDMsImhlaWdodCI6MC4wMTcwMDAwMDAwMDAwMDAwMTUsIngiOjAuMzgyNDk5OTk5OTk5OTk5ODQsInlCYXNlIjowLjY2MDUwMDAwMDAwMDAwMDEsInoiOjAuMjE5OTk5OTk5OTk5OTk5OTd9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkVzdHJ1dHVyYSBwb3J0YSIsIm1hdGVyaWFsVHlwZSI6Ik1ERiBDcnUiLCJiYXNlQ29sb3IiOjEzMDg1MzA0LCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWRmLW1kZi1jcnUiLCJtYXRlcmlhbENvZGUiOiJNREYtQ1JVIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjYjg5MjYzIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJya3N0aV9kY2F3OTQiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjEuMjMzLCJtYXhZIjoxLjI1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuNDE2OTk5OTk5OTk5OTk5NzYsImRlcHRoIjowLjAzLCJoZWlnaHQiOjAuMDE2OTk5OTk5OTk5OTk5OTA0LCJ4IjowLjM4MjQ5OTk5OTk5OTk5OTg0LCJ5QmFzZSI6MS4yMzMsInoiOjAuMjE5OTk5OTk5OTk5OTk5OTd9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkVzdHJ1dHVyYSBwb3J0YSIsIm1hdGVyaWFsVHlwZSI6Ik1ERiBDcnUiLCJiYXNlQ29sb3IiOjEzMDg1MzA0LCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWRmLW1kZi1jcnUiLCJtYXRlcmlhbENvZGUiOiJNREYtQ1JVIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjYjg5MjYzIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJya3V5MF9kbGI4dzAiLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjEuMjcsIm1heFkiOjEuMjg3LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuNDE2OTk5OTk5OTk5OTk5NzYsImRlcHRoIjowLjAzLCJoZWlnaHQiOjAuMDE2OTk5OTk5OTk5OTk5OTA0LCJ4IjowLjM4MjQ5OTk5OTk5OTk5OTg0LCJ5QmFzZSI6MS4yNywieiI6MC4yMTk5OTk5OTk5OTk5OTk5N30seyJraW5kIjoicGFuZWwiLCJuYW1lIjoiRXN0cnV0dXJhIHBvcnRhIiwibWF0ZXJpYWxUeXBlIjoiTURGIENydSIsImJhc2VDb2xvciI6MTMwODUzMDQsIm1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZGYtbWRmLWNydSIsIm1hdGVyaWFsQ29kZSI6Ik1ERi1DUlUiLCJtYXRlcmlhbEdyYWluIjpmYWxzZSwibWF0ZXJpYWxHcmFpblJvdGF0aW9uIjowLCJtYXRlcmlhbENvcmVDb2xvciI6IiNiODkyNjMiLCJlZGdlQmFuZHMiOnt9LCJwYXJ0SWQiOiJwYXJ0X210cnJreWU0X2s3ajhmOCIsImxhYmVsTWV0YSI6eyJzY2hlbWFWZXJzaW9uIjoxLCJlbmFibGVkIjp0cnVlLCJjdXN0b20iOnt9fSwic3BhY2VSb290SWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJtYWNoaW5pbmciOltdLCJmb3JtcyI6W10sImN1c3RvbVByb2ZpbGUiOm51bGwsImN1cnZlZFJvbGUiOm51bGwsImN1cnZlZFBhcnQiOm51bGwsImN1cnZlZENvbmZpZyI6bnVsbCwiZHJhd2VyU2V0SWQiOm51bGwsImRyYXdlclJvbGUiOm51bGwsImRyYXdlckluZGV4IjowLCJkcmF3ZXJDb25maWciOm51bGwsImRvb3JDb25maWciOm51bGwsImRvb3JTeXN0ZW0iOm51bGwsImV4Y2x1ZGVGcm9tQ3V0TGlzdCI6ZmFsc2UsInNwYWNlQ3V0dGluZyI6dHJ1ZSwic3BhY2VDdXRQYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MS44MDU1LCJtYXhZIjoxLjgyMjUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sImRpdmlzaW9uTm9taW5hbFRoaWNrbmVzc00iOm51bGwsIm1hbnVhbEdlb21ldHJ5RGVsdGEiOnsiZHciOjAsImRkIjowLCJkaCI6MCwiZHgiOjAsImR5QmFzZSI6MCwiZHoiOjAuMDQ5OTk5OTk5OTk5OTk5OTksImRyeCI6MCwiZHJ5IjowLCJkcnoiOjB9LCJwaWVjZVNhdmVkQ29uZmlnIjp7Im1vdmUiOnsieCI6MCwieSI6MCwieiI6NTB9LCJmYWNlcyI6eyJsZWZ0IjowLCJyaWdodCI6MCwiYmFjayI6MCwiZnJvbnQiOjAsImJvdHRvbSI6MCwidG9wIjowfSwicm90YXRpb24iOnsieCI6MCwieSI6MCwieiI6MH19LCJyb3RhdGlvblgiOjAuMCwicm90YXRpb25ZIjowLjAsInJvdGF0aW9uWiI6MC4wLCJ3aWR0aCI6MC40MTY5OTk5OTk5OTk5OTk3NiwiZGVwdGgiOjAuMDMsImhlaWdodCI6MC4wMTY5OTk5OTk5OTk5OTk5MDQsIngiOjAuMzgyNDk5OTk5OTk5OTk5ODQsInlCYXNlIjoxLjgwNTUsInoiOjAuMjE5OTk5OTk5OTk5OTk5OTd9LHsia2luZCI6InBhbmVsIiwibmFtZSI6IkVzdHJ1dHVyYSBwb3J0YSIsIm1hdGVyaWFsVHlwZSI6Ik1ERiBDcnUiLCJiYXNlQ29sb3IiOjEzMDg1MzA0LCJtYXRlcmlhbElkIjoibWF0LWZhY3RvcnktbWRmLW1kZi1jcnUiLCJtYXRlcmlhbENvZGUiOiJNREYtQ1JVIiwibWF0ZXJpYWxHcmFpbiI6ZmFsc2UsIm1hdGVyaWFsR3JhaW5Sb3RhdGlvbiI6MCwibWF0ZXJpYWxDb3JlQ29sb3IiOiIjYjg5MjYzIiwiZWRnZUJhbmRzIjp7fSwicGFydElkIjoicGFydF9tdHJybDBial9rajR5Nm4iLCJsYWJlbE1ldGEiOnsic2NoZW1hVmVyc2lvbiI6MSwiZW5hYmxlZCI6dHJ1ZSwiY3VzdG9tIjp7fX0sInNwYWNlUm9vdElkIjoic3BhY2VfbXRxN3A1aXdfY2oxdGNvIiwibWFjaGluaW5nIjpbXSwiZm9ybXMiOltdLCJjdXN0b21Qcm9maWxlIjpudWxsLCJjdXJ2ZWRSb2xlIjpudWxsLCJjdXJ2ZWRQYXJ0IjpudWxsLCJjdXJ2ZWRDb25maWciOm51bGwsImRyYXdlclNldElkIjpudWxsLCJkcmF3ZXJSb2xlIjpudWxsLCJkcmF3ZXJJbmRleCI6MCwiZHJhd2VyQ29uZmlnIjpudWxsLCJkb29yQ29uZmlnIjpudWxsLCJkb29yU3lzdGVtIjpudWxsLCJleGNsdWRlRnJvbUN1dExpc3QiOmZhbHNlLCJzcGFjZUN1dHRpbmciOnRydWUsInNwYWNlQ3V0UGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjEuODQyNSwibWF4WSI6MS44NTk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJkaXZpc2lvbk5vbWluYWxUaGlja25lc3NNIjpudWxsLCJtYW51YWxHZW9tZXRyeURlbHRhIjp7ImR3IjowLCJkZCI6MCwiZGgiOjAsImR4IjowLCJkeUJhc2UiOjAsImR6IjowLjA0OTk5OTk5OTk5OTk5OTk5LCJkcngiOjAsImRyeSI6MCwiZHJ6IjowfSwicGllY2VTYXZlZENvbmZpZyI6eyJtb3ZlIjp7IngiOjAsInkiOjAsInoiOjUwfSwiZmFjZXMiOnsibGVmdCI6MCwicmlnaHQiOjAsImJhY2siOjAsImZyb250IjowLCJib3R0b20iOjAsInRvcCI6MH0sInJvdGF0aW9uIjp7IngiOjAsInkiOjAsInoiOjB9fSwicm90YXRpb25YIjowLjAsInJvdGF0aW9uWSI6MC4wLCJyb3RhdGlvbloiOjAuMCwid2lkdGgiOjAuNDE2OTk5OTk5OTk5OTk5NzYsImRlcHRoIjowLjAzLCJoZWlnaHQiOjAuMDE2OTk5OTk5OTk5OTk5OTA0LCJ4IjowLjM4MjQ5OTk5OTk5OTk5OTg0LCJ5QmFzZSI6MS44NDI1LCJ6IjowLjIxOTk5OTk5OTk5OTk5OTk3fV0sInNwYWNlcyI6W3siaWQiOiJzcGFjZV9tdHE3cDVpd19jajF0Y28iLCJuYW1lIjoiUG9ydGEgUGl2b3RhbnRlIDAxIiwid2lkdGgiOjAuOSwiZGVwdGgiOjAuMTk1LCJoZWlnaHQiOjIuNSwieCI6MC40NSwieUJhc2UiOjAsInoiOjAuMDk3NSwiZGVmYXVsdE1hdGVyaWFsSWQiOiJtYXQtZmFjdG9yeS1tZGYtYnJhbmNvLXR4IiwiZG9vcnNIaWRkZW4iOmZhbHNlLCJzcGFjZUhpZGRlbiI6ZmFsc2UsImRvb3JTeXN0ZW0iOm51bGwsImZpeGVkQmFuZHMiOnsieCI6W1swLDAuMTc0XSxbMC41OTA5OTk5OTk5OTk5OTk3LDAuODk5OTk5OTk5OTk5OTk5OV1dLCJ5IjpbWzAsMC4xMDUwMDAwMDAwMDAwMDAwMV0sWzAuNjYwNSwwLjcxNDVdLFsxLjIzMywxLjI4N10sWzEuODA1NSwxLjg1OTVdLFsyLjM5NSwyLjVdXSwieiI6W1swLDAuMDZdLFswLjEzNSwwLjE5NV1dfSwiY2VsbHMiOlt7ImlkIjoiY2VsbF9tdHJlZnNwel80M3huZDYiLCJoaWRkZW4iOmZhbHNlLCJmaXhlZEF4ZXMiOnsieCI6dHJ1ZX0sIm1hbnVhbEN1dCI6eyJpZCI6ImN1dF9tdHJlZnNwel9taHN5anYiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLCJtYXhYIjowLjAyNCwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWY0OW1fbnR3bTA1IiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MCwibWF4WCI6MC4wNCwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRtam9femt2YW04IiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjpudWxsLCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJtaW5YIjowLCJtYXhYIjowLjAwOCwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0seyJpZCI6ImNlbGxfbXRyZW1tamFfNm52eGxmIiwiaGlkZGVuIjpmYWxzZSwiZml4ZWRBeGVzIjp7IngiOnRydWV9LCJtYW51YWxDdXQiOnsiaWQiOiJjdXRfbXRyZW1tamFfZmZyY21nIiwiYXhpcyI6InoiLCJzaWRlIjoiYmFjayIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjg3NTk5OTk5OTk5OTk5OTksIm1heFgiOjAuODkxOTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjEzNX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWpwZzZfMWcwZWFsIiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC44NzU5OTk5OTk5OTk5OTk5LCJtYXhYIjowLjg5MTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVmd3RlX2I1NHV1cSIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC44NzU5OTk5OTk5OTk5OTk5LCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVmMTJ1X29mYW1reCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkcHJnX3U3YjhsYSIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRtam9femt2YW04IiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjpudWxsLCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJtaW5YIjowLjg3NTk5OTk5OTk5OTk5OTksIm1heFgiOjAuODkxOTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0seyJpZCI6ImNlbGxfbXRyZWZ3dGVfdzBqdHhvIiwiaGlkZGVuIjpmYWxzZSwiZml4ZWRBeGVzIjp7IngiOnRydWV9LCJtYW51YWxDdXQiOnsiaWQiOiJjdXRfbXRyZWZ3dGVfYjU0dXVxIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjg3NTk5OTk5OTk5OTk5OTksIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWYxMnVfb2ZhbWt4IiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjg1OTk5OTk5OTk5OTk5OTksIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRwcmdfdTdiOGxhIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZG1qb196a3ZhbTgiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAsIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOm51bGwsImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJtaW5YIjowLjg5MTk5OTk5OTk5OTk5OTksIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0seyJpZCI6ImNlbGxfbXRyZXRwc3FfaGtxY3g2IiwiaGlkZGVuIjpmYWxzZSwiZml4ZWRBeGVzIjp7IngiOnRydWV9LCJtYW51YWxDdXQiOnsiaWQiOiJjdXRfbXRyZXRwc3FfYW85YmtuIiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wMjQsIm1heFgiOjAuMDQsIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVzd2J2Xzc5NXh0bSIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wMjQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRwcmdfdTdiOGxhIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZG1qb196a3ZhbTgiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAsIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOm51bGwsImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJtaW5YIjowLjAyNCwibWF4WCI6MC4wNCwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE1NX0seyJpZCI6ImNlbGxfbXRyZjU1Z3JfYTVtMG8wIiwiaGlkZGVuIjpmYWxzZSwiZml4ZWRBeGVzIjp7InkiOnRydWV9LCJtYW51YWxDdXQiOnsiaWQiOiJjdXRfbXRyZjU1Z3JfbXdlMnRvIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZXN3YnZfNzk1eHRtIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjAyNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZHByZ191N2I4bGEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkbWpvX3prdmFtOCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6bnVsbCwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sIm1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6Mi40OTUsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LHsiaWQiOiJjZWxsX210cmY1YjNpX2Riem1ldiIsImhpZGRlbiI6ZmFsc2UsImZpeGVkQXhlcyI6eyJ5Ijp0cnVlfSwibWFudWFsQ3V0Ijp7ImlkIjoiY3V0X210cmY1YjNpXzV3djVhdSIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjU1Z3JfbXdlMnRvIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZXN3YnZfNzk1eHRtIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjAyNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZHByZ191N2I4bGEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkbWpvX3prdmFtOCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6bnVsbCwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjAuMDA1LCJtaW5aIjowLCJtYXhaIjowLjE5NX0seyJpZCI6ImNlbGxfbXRyZmo5Z3FfMmM5OTRxIiwiaGlkZGVuIjpmYWxzZSwiZml4ZWRBeGVzIjp7InoiOnRydWUsIngiOnRydWV9LCJtYW51YWxDdXQiOnsiaWQiOiJjdXRfbXRyZmo5Z3FfYzRneGVxIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjY4aXNfcDN6MG52IiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNXlrMV9maTJ2ZW0iLCJheGlzIjoieiIsInNpZGUiOiJmcm9udCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY1YjNpXzV3djVhdSIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjU1Z3JfbXdlMnRvIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZXN3YnZfNzk1eHRtIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjAyNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZHByZ191N2I4bGEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkbWpvX3prdmFtOCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6bnVsbCwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJtaW5YIjowLjg1NDk5OTk5OTk5OTk5OTksIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LHsiaWQiOiJjZWxsX210cnI2NW9iXzZwZHdwbCIsImhpZGRlbiI6ZmFsc2UsImZpeGVkQXhlcyI6eyJ6Ijp0cnVlLCJ4Ijp0cnVlfSwibWFudWFsQ3V0Ijp7ImlkIjoiY3V0X210cnI2NW9iXzFqZThrdiIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTM3LCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1cTd4X3YwdWkxZiIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNW1pNV9raWJ5cWsiLCJheGlzIjoieSIsInNpZGUiOiJib3R0b20iLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjA4NSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjVpc25fOWFmYWFhIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wODUsIm1heFkiOjIuNDE1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1NHM1X3FxZXExNiIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQxNSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNTFzbF83Znc3aWYiLCJheGlzIjoieSIsInNpZGUiOiJ0b3AiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjR6MTJfYWJpMmxzIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC44NTQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjRzNWhfYXgwYTY5IiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmajlncV9jNGd4ZXEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNjhpc19wM3owbnYiLCJheGlzIjoieiIsInNpZGUiOiJmcm9udCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MCwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY1eWsxX2ZpMnZlbSIsImF4aXMiOiJ6Iiwic2lkZSI6ImZyb250IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjViM2lfNXd2NWF1IiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNTVncl9td2UydG8iLCJheGlzIjoieSIsInNpZGUiOiJ0b3AiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlc3didl83OTV4dG0iLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDI0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkcHJnX3U3YjhsYSIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRtam9femt2YW04IiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjpudWxsLCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwibWluWCI6MC42NDQ5OTk5OTk5OTk5OTk4LCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LHsiaWQiOiJjZWxsX210cnJhMmZhXzFxbGh0eiIsImhpZGRlbiI6ZmFsc2UsImZpeGVkQXhlcyI6eyJ6Ijp0cnVlfSwibWFudWFsQ3V0Ijp7ImlkIjoiY3V0X210cnJhMmZhX2VhenhvayIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjoxLjg0MjUsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5NjRkXzJ2d3Y2cCIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjoxLjgyMjUsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5MXRoX3M1Zm1iaSIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyOHByc19qcmJpd2MiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTU3LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI4bDM5X3J4dnd0aCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjZyNjRfY3hvYm8xIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNjA3OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjZrd2Ffc2l1bzQyIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNjI3OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjZoN25fZ2F5Njk5IiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNjQ0OTk5OTk5OTk5OTk5OCwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjY1b2JfMWplOGt2IiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjVxN3hfdjB1aTFmIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1bWk1X2tpYnlxayIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDg1LCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNWlzbl85YWZhYWEiLCJheGlzIjoieSIsInNpZGUiOiJ0b3AiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjA4NSwibWF4WSI6Mi40MTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjU0czVfcXFlcTE2IiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDE1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1MXNsXzdmdzdpZiIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNHoxMl9hYmkybHMiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjg1NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNHM1aF9heDBhNjkiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmZqOWdxX2M0Z3hlcSIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY2OGlzX3AzejBudiIsImF4aXMiOiJ6Iiwic2lkZSI6ImZyb250IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjV5azFfZmkydmVtIiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNWIzaV81d3Y1YXUiLCJheGlzIjoieSIsInNpZGUiOiJib3R0b20iLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjQ5NSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY1NWdyX213ZTJ0byIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVzd2J2Xzc5NXh0bSIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wMjQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRwcmdfdTdiOGxhIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZG1qb196a3ZhbTgiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAsIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOm51bGwsImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOmZhbHNlLCJlcXVhbERpdmlzaW9uQ291bnQiOjQsImVxdWFsRGl2aXNpb25JbmRleCI6MX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MS44NTk1LCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSx7ImlkIjoiY2VsbF9tdHJyYTRteV9zNDZucXciLCJoaWRkZW4iOmZhbHNlLCJmaXhlZEF4ZXMiOnsieiI6dHJ1ZX0sIm1hbnVhbEN1dCI6eyJpZCI6ImN1dF9tdHJyYTRteV84NG5nZ2oiLCJheGlzIjoieSIsInNpZGUiOiJib3R0b20iLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MS4yNywibWF4WSI6MS44MDU1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5djA2X2xpYm1weSIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjoxLjI3LCJtYXhZIjoxLjgyMjUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjk4aHRfOTNsaGYxIiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjEuMjUsIm1heFkiOjEuODIyNSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyOTF0aF81MmxyMjQiLCJheGlzIjoieSIsInNpZGUiOiJ0b3AiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6MS44MjI1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5MXRoX3M1Zm1iaSIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyOHByc19qcmJpd2MiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTU3LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI4bDM5X3J4dnd0aCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjZyNjRfY3hvYm8xIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNjA3OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjZrd2Ffc2l1bzQyIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNjI3OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjZoN25fZ2F5Njk5IiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNjQ0OTk5OTk5OTk5OTk5OCwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjY1b2JfMWplOGt2IiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMzcsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjVxN3hfdjB1aTFmIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1bWk1X2tpYnlxayIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDg1LCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNWlzbl85YWZhYWEiLCJheGlzIjoieSIsInNpZGUiOiJ0b3AiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjA4NSwibWF4WSI6Mi40MTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjU0czVfcXFlcTE2IiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDE1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1MXNsXzdmdzdpZiIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNHoxMl9hYmkybHMiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjg1NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNHM1aF9heDBhNjkiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmZqOWdxX2M0Z3hlcSIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY2OGlzX3AzejBudiIsImF4aXMiOiJ6Iiwic2lkZSI6ImZyb250IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjV5azFfZmkydmVtIiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNWIzaV81d3Y1YXUiLCJheGlzIjoieSIsInNpZGUiOiJib3R0b20iLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjQ5NSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY1NWdyX213ZTJ0byIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVzd2J2Xzc5NXh0bSIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wMjQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRwcmdfdTdiOGxhIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZG1qb196a3ZhbTgiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAsIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOm51bGwsImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOmZhbHNlLCJlcXVhbERpdmlzaW9uQ291bnQiOjQsImVxdWFsRGl2aXNpb25JbmRleCI6MX0sImlzRml4ZWQiOmZhbHNlLCJlcXVhbERpdmlzaW9uQ291bnQiOjQsImVxdWFsRGl2aXNpb25JbmRleCI6Mn0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sIm1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjEuMjg3LCJtYXhZIjoxLjgwNTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0seyJpZCI6ImNlbGxfbXRycmE3a2pfaWNnaGZqIiwiaGlkZGVuIjpmYWxzZSwiZml4ZWRBeGVzIjp7InoiOnRydWV9LCJtYW51YWxDdXQiOnsiaWQiOiJjdXRfbXRycmE3a2pfdGVyejBkIiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuNjk3NSwibWF4WSI6MS4yMzMsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjlzaGVfaDZ0a2Y3IiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuNjk3NSwibWF4WSI6MS4yNSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyOWRrd19yb2N2b2QiLCJheGlzIjoieSIsInNpZGUiOiJib3R0b20iLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC42Nzc1LCJtYXhZIjoxLjI1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5MXRoX2R4dW5qZCIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoxLjI1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5MXRoXzUybHIyNCIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoxLjgyMjUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjkxdGhfczVmbWJpIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI4cHJzX2pyYml3YyIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNTcsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjhsMzlfcnh2d3RoIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNnI2NF9jeG9ibzEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC42MDc5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNmt3YV9zaXVvNDIiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC42Mjc5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNmg3bl9nYXk2OTkiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC42NDQ5OTk5OTk5OTk5OTk4LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNjVvYl8xamU4a3YiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNXE3eF92MHVpMWYiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjVtaTVfa2lieXFrIiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wODUsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1aXNuXzlhZmFhYSIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDg1LCJtYXhZIjoyLjQxNSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNTRzNV9xcWVxMTYiLCJheGlzIjoieSIsInNpZGUiOiJib3R0b20iLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40MTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjUxc2xfN2Z3N2lmIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI0ejEyX2FiaTJscyIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuODU0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI0czVoX2F4MGE2OSIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZmo5Z3FfYzRneGVxIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjY4aXNfcDN6MG52IiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNXlrMV9maTJ2ZW0iLCJheGlzIjoieiIsInNpZGUiOiJmcm9udCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY1YjNpXzV3djVhdSIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjU1Z3JfbXdlMnRvIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZXN3YnZfNzk1eHRtIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjAyNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZHByZ191N2I4bGEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkbWpvX3prdmFtOCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6bnVsbCwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6ZmFsc2UsImVxdWFsRGl2aXNpb25Db3VudCI6NCwiZXF1YWxEaXZpc2lvbkluZGV4IjoxfSwiaXNGaXhlZCI6ZmFsc2UsImVxdWFsRGl2aXNpb25Db3VudCI6NCwiZXF1YWxEaXZpc2lvbkluZGV4IjoyfSwiaXNGaXhlZCI6ZmFsc2UsImVxdWFsRGl2aXNpb25Db3VudCI6NCwiZXF1YWxEaXZpc2lvbkluZGV4IjozfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC43MTQ1LCJtYXhZIjoxLjIzMywibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSx7ImlkIjoiY2VsbF9tdHJyOXE2MF9xMG5oangiLCJoaWRkZW4iOmZhbHNlLCJmaXhlZEF4ZXMiOnsieiI6dHJ1ZX0sIm1hbnVhbEN1dCI6eyJpZCI6ImN1dF9tdHJyOXE2MF9pc2ppdnAiLCJheGlzIjoieSIsInNpZGUiOiJ0b3AiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNzQsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6MC42Nzc1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5MXRoX2R4dW5qZCIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoxLjI1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI5MXRoXzUybHIyNCIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjE3NCwibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoxLjgyMjUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjkxdGhfczVmbWJpIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI4cHJzX2pyYml3YyIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xNTcsIm1heFgiOjAuNTkwOTk5OTk5OTk5OTk5NywibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjhsMzlfcnh2d3RoIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC41OTA5OTk5OTk5OTk5OTk3LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNnI2NF9jeG9ibzEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC42MDc5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNmt3YV9zaXVvNDIiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC42Mjc5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNmg3bl9nYXk2OTkiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC42NDQ5OTk5OTk5OTk5OTk4LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNjVvYl8xamU4a3YiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEzNywibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjEwNTAwMDAwMDAwMDAwMDAxLCJtYXhZIjoyLjM5NSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNXE3eF92MHVpMWYiLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4xMDUwMDAwMDAwMDAwMDAwMSwibWF4WSI6Mi4zOTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjVtaTVfa2lieXFrIiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wODUsIm1heFkiOjIuMzk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI1aXNuXzlhZmFhYSIsImF4aXMiOiJ5Iiwic2lkZSI6InRvcCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjEyLCJtYXhYIjowLjc3NDk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDg1LCJtYXhZIjoyLjQxNSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJyNTRzNV9xcWVxMTYiLCJheGlzIjoieSIsInNpZGUiOiJib3R0b20iLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4xMiwibWF4WCI6MC43NzQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40MTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRycjUxc2xfN2Z3N2lmIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuNzc0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI0ejEyX2FiaTJscyIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMTIsIm1heFgiOjAuODU0OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLjE1NSwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cnI0czVoX2F4MGE2OSIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTQ5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZmo5Z3FfYzRneGVxIiwiYXhpcyI6IngiLCJzaWRlIjoicmlnaHQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAuMTU1LCJtYXhaIjowLjE4NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjY4aXNfcDN6MG52IiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTg1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNXlrMV9maTJ2ZW0iLCJheGlzIjoieiIsInNpZGUiOiJmcm9udCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY1YjNpXzV3djVhdSIsImF4aXMiOiJ5Iiwic2lkZSI6ImJvdHRvbSIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjU1Z3JfbXdlMnRvIiwiYXhpcyI6InkiLCJzaWRlIjoidG9wIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZXN3YnZfNzk1eHRtIiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjAyNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlZHByZ191N2I4bGEiLCJheGlzIjoieCIsInNpZGUiOiJyaWdodCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkbWpvX3prdmFtOCIsImF4aXMiOiJ4Iiwic2lkZSI6ImxlZnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MCwibWF4WCI6MC44OTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6bnVsbCwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6ZmFsc2UsImVxdWFsRGl2aXNpb25Db3VudCI6NCwiZXF1YWxEaXZpc2lvbkluZGV4IjoxfSwiaXNGaXhlZCI6ZmFsc2UsImVxdWFsRGl2aXNpb25Db3VudCI6NCwiZXF1YWxEaXZpc2lvbkluZGV4IjoyfSwiaXNGaXhlZCI6ZmFsc2UsImVxdWFsRGl2aXNpb25Db3VudCI6NCwiZXF1YWxEaXZpc2lvbkluZGV4IjozfSwiaXNGaXhlZCI6dHJ1ZX0sIm1pblgiOjAuMTc0LCJtYXhYIjowLjU5MDk5OTk5OTk5OTk5OTcsIm1pblkiOjAuMTA1MDAwMDAwMDAwMDAwMDEsIm1heFkiOjAuNjYwNSwibWluWiI6MC4xNTUsIm1heFoiOjAuMTg1fSx7ImlkIjoiY2VsbF9tdHJmNmYwMV80MWRkY3ciLCJoaWRkZW4iOmZhbHNlLCJmaXhlZEF4ZXMiOnt9LCJtYW51YWxDdXQiOnsiaWQiOiJjdXRfbXRyZjZmMDFfeHVqN3Z3IiwiYXhpcyI6InoiLCJzaWRlIjoiZnJvbnQiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLjAwNSwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTU1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNjhpc19wM3owbnYiLCJheGlzIjoieiIsInNpZGUiOiJmcm9udCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLjA0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAuMDA1LCJtYXhZIjoyLjQ5NSwibWluWiI6MCwibWF4WiI6MC4xODV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmY1eWsxX2ZpMnZlbSIsImF4aXMiOiJ6Iiwic2lkZSI6ImZyb250IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZjViM2lfNXd2NWF1IiwiYXhpcyI6InkiLCJzaWRlIjoiYm90dG9tIiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi40OTUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJmNTVncl9td2UydG8iLCJheGlzIjoieSIsInNpZGUiOiJ0b3AiLCJwYXJlbnRCb3VuZHMiOnsibWluWCI6MC4wNCwibWF4WCI6MC44NTk5OTk5OTk5OTk5OTk5LCJtaW5ZIjowLCJtYXhZIjoyLjUsIm1pbloiOjAsIm1heFoiOjAuMTk1fSwicGFyZW50TWV0YSI6eyJpZCI6ImN1dF9tdHJlc3didl83OTV4dG0iLCJheGlzIjoieCIsInNpZGUiOiJsZWZ0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDI0LCJtYXhYIjowLjg1OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjp7ImlkIjoiY3V0X210cmVkcHJnX3U3YjhsYSIsImF4aXMiOiJ4Iiwic2lkZSI6InJpZ2h0IiwicGFyZW50Qm91bmRzIjp7Im1pblgiOjAuMDQsIm1heFgiOjAuODk5OTk5OTk5OTk5OTk5OSwibWluWSI6MCwibWF4WSI6Mi41LCJtaW5aIjowLCJtYXhaIjowLjE5NX0sInBhcmVudE1ldGEiOnsiaWQiOiJjdXRfbXRyZWRtam9femt2YW04IiwiYXhpcyI6IngiLCJzaWRlIjoibGVmdCIsInBhcmVudEJvdW5kcyI6eyJtaW5YIjowLCJtYXhYIjowLjg5OTk5OTk5OTk5OTk5OTksIm1pblkiOjAsIm1heFkiOjIuNSwibWluWiI6MCwibWF4WiI6MC4xOTV9LCJwYXJlbnRNZXRhIjpudWxsLCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sImlzRml4ZWQiOnRydWV9LCJpc0ZpeGVkIjp0cnVlfSwiaXNGaXhlZCI6dHJ1ZX0sIm1pblgiOjAuMDQsIm1heFgiOjAuODU5OTk5OTk5OTk5OTk5OSwibWluWSI6MC4wMDUsIm1heFkiOjIuNDk1LCJtaW5aIjowLCJtYXhaIjowLjE0NX1dfV0sInByb2R1Y3Rpb24iOnsidmVyc2lvbiI6NSwibWF0ZXJpYWxzIjpbXSwiZWRnZUJhbmRzIjpbXSwibGFiZWxUZW1wbGF0ZSI6eyJ2ZXJzaW9uIjoxLCJjb25maWd1cmFibGVMYXRlciI6dHJ1ZSwiYXZhaWxhYmxlRmllbGRzIjpbInByb2plY3QiLCJjbGllbnQiLCJlbnZpcm9ubWVudCIsInNwYWNlIiwicGFydElkIiwicGFydE5hbWUiLCJkaW1lbnNpb25zIiwibWF0ZXJpYWwiLCJtYXRlcmlhbENvZGUiLCJncmFpbiIsImVkZ2VCYW5kcyIsIm1hY2hpbmluZyJdfX19';
  
  const DOOR_SYSTEM_BUILTIN_FACE_IDS = ["part_mtrf6oi7_sx6pnb", "part_mtrf6xtd_9l0et9"];
  
  let customDoorLibrary = [];
  
  try {
      customDoorLibrary = JSON.parse(localStorage.getItem(DOOR_SYSTEM_LIBRARY_KEY) || '[]');
      if (!Array.isArray(customDoorLibrary))
          customDoorLibrary = [];
  }
  catch (_) {
      customDoorLibrary = [];
  }
  
  function persistDoorLibrary() {
      try {
          localStorage.setItem(DOOR_SYSTEM_LIBRARY_KEY, JSON.stringify(customDoorLibrary));
      }
      catch (err) {
          toast('A Biblioteca de Portas ficou grande demais para este dispositivo');
      }
  }
  
  let doorSystemBuiltinCache = null;
  
  function doorSystemBuiltinRecord() {
      if (doorSystemBuiltinCache)
          return doorSystemBuiltinCache;
      doorSystemBuiltinCache = JSON.parse(designLabBase64ToUtf8(DOOR_SYSTEM_BUILTIN_PIVOT_B64));
      return doorSystemBuiltinCache;
  }
  
  function doorSystemBoundsFromParts(parts) {
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const p of parts || []) {
          const w = Number(p.width), d = Number(p.depth), h = Number(p.height), x = Number(p.x), yb = Number(p.yBase), z = Number(p.z);
          if (![w, d, h, x, yb, z].every(Number.isFinite))
              continue;
          minX = Math.min(minX, x - w / 2);
          maxX = Math.max(maxX, x + w / 2);
          minY = Math.min(minY, yb);
          maxY = Math.max(maxY, yb + h);
          minZ = Math.min(minZ, z - d / 2);
          maxZ = Math.max(maxZ, z + d / 2);
      }
      return Number.isFinite(minX) ? { minX, maxX, minY, maxY, minZ, maxZ } : null;
  }
  
  function doorSystemDetectFacePartIds(record) {
      const candidates = (record?.objects || []).map((p, i) => {
          const dims = [Number(p.width) * 1000, Number(p.height) * 1000, Number(p.depth) * 1000].filter(Number.isFinite).sort((a, b) => a - b);
          const thickness = dims[0] || 0, area = (dims[1] || 0) * (dims[2] || 0), name = String(p.name || '');
          const score = (/folha\s*porta/i.test(name) ? 100 : /face\s*(externa|interna)/i.test(name) ? 90 : /^frente$/i.test(name) ? 70 : 0) + (thickness <= 12.5 ? 20 : 0);
          return { p, i, score, area };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || b.area - a.area);
      return candidates.slice(0, 2).map(x => x.p.partId).filter(Boolean);
  }
  
  function doorSystemBuiltinModels() {
      const record = doorSystemBuiltinRecord(), sp = record.spaces?.[0];
      return [{
              id: 'door-pivotante-01', name: 'Porta Pivotante 01', kind: 'pivotante', builtin: true, builtinBase: true,
              description: 'Modelo-mestre completo · batentes + duas faces + miolo MDF Cru + Tauari + Metalon 20×30',
              reference: { widthMm: Math.round(Number(sp?.width || .9) * 1000), heightMm: Math.round(Number(sp?.height || 2.5) * 1000), depthMm: Math.round(Number(sp?.depth || .195) * 1000) },
              productionOversizeMm: 15,
              facePartIds: [...DOOR_SYSTEM_BUILTIN_FACE_IDS], rules: { parametricMode: 'fixed-bands' },
              record
          }];
  }
  
  // 1.300.17 · Biblioteca oficial de portas. A nuvem faz override por ID, então
  // o ADM pode renomear a Pivotante 01 sem recriar a geometria nem quebrar projetos.
  const globalDoorLibraryState = { items: [], records: new Map(), loaded: false, loading: false, error: '', updatedAt: null };
  
  function doorSystemIsBuiltinId(id) { return doorSystemBuiltinModels().some(m => m.id === id); }
  
  function doorSystemGlobalMeta(id) { return globalDoorLibraryState.items.find(m => m.id === id) || null; }
  
  function doorSystemHiddenBuiltinIds() { return new Set(globalDoorLibraryState.items.filter(m => m?.rules?.hiddenBuiltin === true).map(m => m.id)); }
  
  function doorSystemVisibleOfficialItems() { return globalDoorLibraryState.items.filter(m => m?.rules?.hiddenBuiltin !== true); }
  
  function doorSystemModels() {
      const builtins = doorSystemBuiltinModels(), globals = doorSystemVisibleOfficialItems(), hidden = doorSystemHiddenBuiltinIds();
      const byId = new Map(globals.map(m => [m.id, m]));
      const out = [];
      for (const base of builtins) {
          if (hidden.has(base.id))
              continue;
          const g = byId.get(base.id);
          if (g) {
              const cached = globalDoorLibraryState.records.get(g.id);
              out.push({ ...base, ...g, builtin: false, builtinBase: true, global: true, official: true, record: cached?.record || null, cloudMeta: g });
              byId.delete(base.id);
          }
          else
              out.push(base);
      }
      for (const g of byId.values()) {
          const cached = globalDoorLibraryState.records.get(g.id);
          out.push({ ...g, builtin: false, builtinBase: false, global: true, official: true, record: cached?.record || null, cloudMeta: g });
      }
      const custom = customDoorLibrary.map(m => ({ ...m, builtin: false, builtinBase: false, global: false, official: false, localCustom: true }));
      return [...out, ...custom];
  }
  
  function doorSystemModelById(id) { return doorSystemModels().find(m => m.id === id) || doorSystemModels()[0] || null; }
  
  function doorSystemTemplateItem(model, systemId, oversizeMm) {
      const record = JSON.parse(JSON.stringify(model.record || {})), parts = record.objects || [], space = record.spaces?.[0];
      if (!parts.length || !space)
          throw new Error('Modelo de porta sem peças ou espaço de referência');
      const faceIds = (model.facePartIds?.length ? model.facePartIds : doorSystemDetectFacePartIds(record));
      let faceOrdinal = 0;
      for (const p of parts) {
          const isFace = faceIds.includes(p.partId);
          p.doorSystem = {
              schemaVersion: 1, systemId, templateId: model.id, templateName: model.name,
              kind: model.kind || 'porta', role: isFace ? (faceOrdinal++ === 0 ? 'leaf-face-inner' : 'leaf-face-outer') : 'component',
              productionOversizeMm: isFace ? Math.max(0, Number(oversizeMm) || 0) : 0
          };
      }
      return {
          id: model.id, name: model.name,
          sourceBounds: doorSystemBoundsFromParts(parts) || layoutBoundsFromSpace(space),
          parts,
          layout: { space: JSON.parse(JSON.stringify(space)) }
      };
  }
  
  function doorSystemSelectedRoot() {
      const r = selectedFurnitureRoot();
      return r || null;
  }
  
  function doorSystemDefaultPosition(widthMm, depthMm) {
      const r = doorSystemSelectedRoot();
      if (r)
          return { xMm: Math.round(r.x * 1000), yMm: Math.round(r.yBase * 1000), zMm: Math.round(r.z * 1000) };
      const width = Number(widthMm) / 1000 || .9, depth = Number(depthMm) / 1000 || .195;
      return { xMm: runtimeModel.spaceRoots.length ? Math.round((projectMaxX() + .2 + width / 2) * 1000) : 0, yMm: 0, zMm: Math.round(depth / 2 * 1000) };
  }
  
  function doorSystemCloudStatusText() {
      const el = $('doorSystemCloudStatus');
      if (!el)
          return;
      if (globalDoorLibraryState.loading) {
          el.textContent = 'Carregando modelos oficiais da nuvem…';
          return;
      }
      if (globalDoorLibraryState.error) {
          el.textContent = 'Nuvem: ' + globalDoorLibraryState.error;
          return;
      }
      if (!cloudAccountState.ok) {
          el.textContent = 'Entre na conta para sincronizar os modelos oficiais.';
          return;
      }
      const n = doorSystemVisibleOfficialItems().length;
      el.textContent = `${n} modelo(s) oficial(is) carregado(s) da nuvem.`;
  }
  
  function doorSystemUpdateAdminUi(model) {
      const box = $('doorSystemAdminBox'), admin = adminAllowed();
      if (box)
          box.style.display = admin ? 'block' : 'none';
      const ids = ['doorSystemAdminAdd', 'doorSystemAdminReplace', 'doorSystemAdminRename', 'doorSystemAdminDelete', 'doorSystemAdminRefresh'];
      for (const id of ids) {
          const b = $(id);
          if (b)
              b.disabled = !admin || globalDoorLibraryState.loading;
      }
      const canModel = !!model;
      if ($('doorSystemAdminRename'))
          $('doorSystemAdminRename').disabled = !admin || !canModel || globalDoorLibraryState.loading;
      if ($('doorSystemAdminDelete'))
          $('doorSystemAdminDelete').disabled = !admin || !canModel || globalDoorLibraryState.loading;
      if ($('doorSystemAdminReplace'))
          $('doorSystemAdminReplace').disabled = !admin || !canModel || globalDoorLibraryState.loading;
      const restore = $('doorSystemAdminRestoreBuiltin'), hidden = [...doorSystemHiddenBuiltinIds()].filter(doorSystemIsBuiltinId);
      if (restore) {
          restore.style.display = admin && hidden.length ? 'block' : 'none';
          restore.disabled = !admin || globalDoorLibraryState.loading;
          restore.dataset.modelId = hidden[0] || '';
      }
      doorSystemCloudStatusText();
  }
  
  function doorSystemUpdateModelInfo({ resetDimensions = false } = {}) {
      const select = $('doorSystemModel'), model = doorSystemModelById(select?.value);
      if (!model) {
          const info = $('doorSystemModelInfo');
          if (info)
              info.innerHTML = '<strong>Nenhum modelo disponível</strong><small>O administrador pode publicar um novo modelo.</small>';
          doorSystemUpdateAdminUi(null);
          return;
      }
      const ref = model.reference || { widthMm: 900, heightMm: 2500, depthMm: 195 };
      if (resetDimensions) {
          $('doorSystemWidth').value = String(roundMmNumber(ref.widthMm, 3));
          $('doorSystemHeight').value = String(roundMmNumber(ref.heightMm, 3));
          $('doorSystemDepth').value = String(roundMmNumber(ref.depthMm, 3));
          $('doorSystemOversize').value = String(roundMmNumber(doorSystemPreferredOversize(model), 3));
          const pos = doorSystemDefaultPosition(ref.widthMm, ref.depthMm);
          $('doorSystemPosX').value = String(roundMmNumber(pos.xMm, 3));
          $('doorSystemPosY').value = String(roundMmNumber(pos.yMm, 3));
          $('doorSystemPosZ').value = String(roundMmNumber(pos.zMm, 3));
      }
      const count = model.record?.objects?.length || Number(model.part_count) || 0, faces = (model.facePartIds?.length || Number(model.face_count) || doorSystemDetectFacePartIds(model.record).length);
      const source = model.official ? '🌐 Oficial do ADM' : model.builtinBase ? '★ Padrão embutido' : model.localCustom ? '📱 Modelo local' : 'Modelo';
      const rule = model.builtinBase || model.rules?.parametricMode === 'fixed-bands' ? ' · regra: peças fixas preservadas, vãos livres redistribuídos' : '';
      const info = $('doorSystemModelInfo');
      if (info)
          info.innerHTML = `<strong>${escapeHtml(model.name)}</strong><span>${source} · ${escapeHtml(model.description || 'Modelo de porta')} · ${count} peça(s) · ${faces} face(s)</span><small>Referência: X ${nice(ref.widthMm)} · Y ${nice(ref.heightMm)} · Z ${nice(ref.depthMm)} mm${escapeHtml(rule)}</small>`;
      doorSystemUpdateAdminUi(model);
  }
  
  function renderDoorSystemModels({ resetDimensions = false } = {}) {
      const sel = $('doorSystemModel');
      if (!sel)
          return;
      const keep = sel.value, models = doorSystemModels();
      sel.innerHTML = '';
      for (const m of models) {
          const o = document.createElement('option');
          o.value = m.id;
          o.textContent = (m.official ? '🌐 ' : m.builtinBase ? '★ ' : m.localCustom ? '📱 ' : '') + m.name;
          sel.appendChild(o);
      }
      if (models.some(m => m.id === keep))
          sel.value = keep;
      else if (models[0])
          sel.value = models[0].id;
      doorSystemUpdateModelInfo({ resetDimensions });
  }
  
  async function loadGlobalDoorModels({ force = false } = {}) {
      if (globalDoorLibraryState.loading)
          return false;
      if (globalDoorLibraryState.loaded && !force)
          return true;
      if (!cloudAccountState.ok) {
          globalDoorLibraryState.error = 'conta ainda não sincronizada';
          doorSystemCloudStatusText();
          return false;
      }
      globalDoorLibraryState.loading = true;
      globalDoorLibraryState.error = '';
      doorSystemUpdateAdminUi(doorSystemModelById($('doorSystemModel')?.value));
      try {
          const data = await cloudApiFetch('/doors/global', { timeoutMs: 20000 });
          globalDoorLibraryState.items = Array.isArray(data?.items) ? data.items : [];
          globalDoorLibraryState.loaded = true;
          globalDoorLibraryState.updatedAt = new Date().toISOString();
          // Descarta apenas records que não existem mais; os demais permanecem em cache.
          const ids = new Set(globalDoorLibraryState.items.map(x => x.id));
          for (const id of [...globalDoorLibraryState.records.keys()])
              if (!ids.has(id))
                  globalDoorLibraryState.records.delete(id);
          return true;
      }
      catch (err) {
          globalDoorLibraryState.error = err.message || 'não foi possível carregar a biblioteca oficial';
          return false;
      }
      finally {
          globalDoorLibraryState.loading = false;
          renderDoorSystemModels({ resetDimensions: false });
          doorSystemCloudStatusText();
      }
  }
  
  async function doorSystemEnsureModelRecord(model) {
      if (!model)
          return null;
      if (model.record?.objects?.length)
          return model;
      if (!model.official)
          throw new Error('Modelo sem geometria disponível');
      let payload = globalDoorLibraryState.records.get(model.id);
      if (!payload) {
          payload = await cloudApiFetch(`/doors/global/${encodeURIComponent(model.id)}`, { timeoutMs: 30000 });
          globalDoorLibraryState.records.set(model.id, payload);
      }
      const merged = { ...model, ...(payload?.item || {}), record: payload?.record || null, official: true, global: true };
      if (!merged.record?.objects?.length)
          throw new Error('O arquivo do modelo oficial está inválido');
      return merged;
  }
  
  async function openDoorSystemDialog() {
      if (state.visualMode)
          setVisualMode(false, { notify: false, frame: false });
      renderDoorSystemModels({ resetDimensions: true });
      $('doorSystemDialog').style.display = 'flex';
      if (cloudAccountState.ok)
          loadGlobalDoorModels({ force: true }).then(() => renderDoorSystemModels({ resetDimensions: false }));
  }
  
  function closeDoorSystemDialog() { $('doorSystemDialog').style.display = 'none'; }
  
  function doorSystemUseSelectedDimensions() {
      const r = doorSystemSelectedRoot();
      if (!r) {
          toast('Selecione um espaço para copiar as medidas');
          return;
      }
      $('doorSystemWidth').value = String(roundMmNumber(r.width * 1000, 3));
      $('doorSystemHeight').value = String(roundMmNumber(r.height * 1000, 3));
      $('doorSystemDepth').value = String(roundMmNumber(r.depth * 1000, 3));
      $('doorSystemPosX').value = String(roundMmNumber(r.x * 1000, 3));
      $('doorSystemPosY').value = String(roundMmNumber(r.yBase * 1000, 3));
      $('doorSystemPosZ').value = String(roundMmNumber(r.z * 1000, 3));
      toast('Medidas e posição copiadas do espaço selecionado');
  }
  
  async function doorSystemCreate() {
      let model = doorSystemModelById($('doorSystemModel')?.value);
      if (!model) {
          toast('Selecione um modelo de porta');
          return;
      }
      try {
          model = await doorSystemEnsureModelRecord(model);
      }
      catch (err) {
          toast(err.message || 'Não foi possível abrir o modelo oficial');
          return;
      }
      const wMm = parseDecimalInput($('doorSystemWidth')?.value), hMm = parseDecimalInput($('doorSystemHeight')?.value), dMm = parseDecimalInput($('doorSystemDepth')?.value);
      const xMm = parseDecimalInput($('doorSystemPosX')?.value), yMm = parseDecimalInput($('doorSystemPosY')?.value), zMm = parseDecimalInput($('doorSystemPosZ')?.value);
      const over = parseDecimalInput($('doorSystemOversize')?.value);
      if (!(wMm > 100 && hMm > 100 && dMm > 20)) {
          toast('Confira as medidas X, Y e Z do vão');
          return;
      }
      if (![xMm, yMm, zMm].every(Number.isFinite)) {
          toast('Confira a posição X, Y e Z');
          return;
      }
      if (!(over >= 0 && over <= 100)) {
          toast('Confira a sobremedida de produção');
          return;
      }
      doorSystemRememberOversize(model.id, over);
      const systemId = uid('doorsys');
      const doorMeta = { schemaVersion: 1, systemId, templateId: model.id, templateName: model.name, kind: model.kind || 'porta',
          reference: { widthMm: wMm, heightMm: hMm, depthMm: dMm }, productionOversizeMm: over, createdAt: new Date().toISOString() };
      const root = createSpace({ width: wMm * MM_TO_M, height: hMm * MM_TO_M, depth: dMm * MM_TO_M, x: xMm * MM_TO_M, yBase: Math.max(0, yMm * MM_TO_M), z: zMm * MM_TO_M, name: model.name, doorSystem: doorMeta }, false);
      const info = { root, cell: root.cells[0], size: cellSize(root.cells[0]), center: cellCenter(root.cells[0]) };
      let item;
      try {
          item = doorSystemTemplateItem(model, systemId, over);
      }
      catch (err) {
          const ri = runtimeModel.spaceRoots.indexOf(root);
          if (ri >= 0)
              runtimeModel.spaceRoots.splice(ri, 1);
          renderSpaces();
          toast(err.message || 'Modelo de porta inválido');
          return;
      }
      const ok = placeCustomTemplate(item, info, { commit: false, notify: false });
      if (!ok) {
          toast('Não foi possível criar a porta');
          return;
      }
      root.doorSystem = doorMeta;
      renderSpaces();
      applyAllDoorVisibility();
      renderMachiningVisuals();
      const cell = root.cells.find(c => !c.hidden) || root.cells[0];
      if (cell)
          selectSpaceCellByIds(root.id, cell.id, { showMenu: false });
      frontViewToSpace(root);
      commitHistory();
      closeDoorSystemDialog();
      const faces = furnitureObjects(root).filter(o => String(o.userData?.doorSystem?.role || '').startsWith('leaf-face')).length;
      toast(`${model.name} criada · ${furnitureObjects(root).length} peça(s) · ${faces} face(s) · bruto +${nice(over)} mm/lado`);
  }
  
  function doorSystemModelPayloadFromRoot(root, name, { rules = {} } = {}) {
      if (!root)
          throw new Error('Selecione o espaço completo da porta');
      const record = captureFurniture(root), facePartIds = doorSystemDetectFacePartIds(record);
      if (facePartIds.length < 2)
          throw new Error('Não encontrei as duas faces da Folha Porta neste espaço');
      const ref = { widthMm: Math.round(root.width * 1000), heightMm: Math.round(root.height * 1000), depthMm: Math.round(root.depth * 1000) };
      const n = Number(root.doorSystem?.productionOversizeMm), productionOversizeMm = Number.isFinite(n) && n >= 0 ? n : 15;
      return { name, kind: root.doorSystem?.kind || 'personalizada', description: 'Modelo oficial do DesignLabMoveis', reference: ref, productionOversizeMm, facePartIds, rules: { parametricMode: 'fixed-bands', ...rules }, record };
  }
  
  function doorSystemPayloadFromModel(model, newName, { rulesOverride = null } = {}) {
      if (!model?.record?.objects?.length)
          throw new Error('Modelo sem geometria carregada');
      return {
          name: newName || model.name, kind: model.kind || 'porta', description: model.description || 'Modelo oficial do DesignLabMoveis',
          reference: model.reference || {}, productionOversizeMm: Number(model.productionOversizeMm) || 0,
          facePartIds: (model.facePartIds?.length ? model.facePartIds : doorSystemDetectFacePartIds(model.record)),
          rules: rulesOverride || model.rules || {}, record: JSON.parse(JSON.stringify(model.record))
      };
  }
  
  async function doorSystemAdminAddNew() {
      if (!adminAllowed()) {
          toast('Somente o ADM pode adicionar modelos oficiais');
          return;
      }
      const root = doorSystemSelectedRoot();
      if (!root) {
          toast('Selecione o espaço completo da porta que será o novo modelo');
          return;
      }
      const suggested = (root.doorSystem?.templateName || root.name || 'Nova porta').trim();
      const name = (window.prompt('Nome do novo modelo oficial:', suggested) || '').trim();
      if (!name)
          return;
      try {
          const model = doorSystemModelPayloadFromRoot(root, name);
          const data = await cloudApiFetch('/admin/doors/global', { method: 'POST', body: { model }, timeoutMs: 40000 });
          await loadGlobalDoorModels({ force: true });
          renderDoorSystemModels();
          if (data?.item?.id)
              $('doorSystemModel').value = data.item.id;
          doorSystemUpdateModelInfo({ resetDimensions: true });
          toast(`Modelo oficial “${name}” adicionado`);
      }
      catch (err) {
          toast(err.message || 'Não foi possível adicionar o modelo oficial');
      }
  }
  
  async function doorSystemAdminReplaceSelected() {
      if (!adminAllowed()) {
          toast('Somente o ADM pode substituir modelos oficiais');
          return;
      }
      const selectedModel = doorSystemModelById($('doorSystemModel')?.value);
      if (!selectedModel) {
          toast('Selecione o modelo que será substituído');
          return;
      }
      const root = doorSystemSelectedRoot();
      if (!root) {
          toast('Selecione no CAD a porta completa que será usada como novo modelo');
          return;
      }
      if (!window.confirm(`Substituir “${selectedModel.name}” pela porta selecionada no CAD?\n\nO ID do modelo será mantido.`))
          return;
      try {
          const model = doorSystemModelPayloadFromRoot(root, selectedModel.name, { rules: selectedModel.rules || {} });
          await cloudApiFetch(`/admin/doors/global/${encodeURIComponent(selectedModel.id)}`, { method: 'PUT', body: { model }, timeoutMs: 40000 });
          globalDoorLibraryState.records.delete(selectedModel.id);
          await loadGlobalDoorModels({ force: true });
          renderDoorSystemModels();
          $('doorSystemModel').value = selectedModel.id;
          doorSystemUpdateModelInfo({ resetDimensions: true });
          toast(`“${selectedModel.name}” substituído sem trocar o ID`);
      }
      catch (err) {
          toast(err.message || 'Não foi possível substituir o modelo');
      }
  }
  
  async function doorSystemAdminRenameSelected() {
      if (!adminAllowed()) {
          toast('Somente o ADM pode renomear modelos oficiais');
          return;
      }
      let model = doorSystemModelById($('doorSystemModel')?.value);
      if (!model)
          return;
      const name = (window.prompt('Novo nome do modelo:', model.name) || '').trim();
      if (!name || name === model.name)
          return;
      try {
          model = await doorSystemEnsureModelRecord(model);
          const payload = doorSystemPayloadFromModel(model, name);
          await cloudApiFetch(`/admin/doors/global/${encodeURIComponent(model.id)}`, { method: 'PUT', body: { model: payload }, timeoutMs: 40000 });
          globalDoorLibraryState.records.delete(model.id);
          await loadGlobalDoorModels({ force: true });
          renderDoorSystemModels();
          $('doorSystemModel').value = model.id;
          doorSystemUpdateModelInfo({ resetDimensions: false });
          toast(`Modelo renomeado para “${name}” · geometria preservada`);
      }
      catch (err) {
          toast(err.message || 'Não foi possível renomear o modelo');
      }
  }
  
  async function doorSystemAdminDeleteSelected() {
      if (!adminAllowed()) {
          toast('Somente o ADM pode excluir modelos oficiais');
          return;
      }
      let model = doorSystemModelById($('doorSystemModel')?.value);
      if (!model)
          return;
      const builtinId = doorSystemIsBuiltinId(model.id);
      const msg = builtinId
          ? `Ocultar o modelo padrão “${model.name}” para todos os usuários?\n\nA geometria embutida não será destruída e poderá ser restaurada pelo ADM.`
          : `Excluir o modelo oficial “${model.name}” para todos os usuários?\n\nProjetos já criados não serão alterados.`;
      if (!window.confirm(msg))
          return;
      try {
          if (builtinId) {
              model = await doorSystemEnsureModelRecord(model);
              const payload = doorSystemPayloadFromModel(model, model.name, { rulesOverride: { ...(model.rules || {}), hiddenBuiltin: true, hiddenAt: new Date().toISOString() } });
              await cloudApiFetch(`/admin/doors/global/${encodeURIComponent(model.id)}`, { method: 'PUT', body: { model: payload }, timeoutMs: 40000 });
          }
          else if (model.official) {
              await cloudApiFetch(`/admin/doors/global/${encodeURIComponent(model.id)}`, { method: 'DELETE', body: {}, timeoutMs: 30000 });
          }
          else if (model.localCustom) {
              customDoorLibrary = customDoorLibrary.filter(m => m.id !== model.id);
              persistDoorLibrary();
          }
          globalDoorLibraryState.records.delete(model.id);
          await loadGlobalDoorModels({ force: true });
          renderDoorSystemModels({ resetDimensions: true });
          toast(builtinId ? 'Modelo padrão ocultado para todos' : 'Modelo excluído da Biblioteca de Portas');
      }
      catch (err) {
          toast(err.message || 'Não foi possível excluir o modelo');
      }
  }
  
  async function doorSystemAdminRestoreBuiltin() {
      if (!adminAllowed())
          return;
      const id = $('doorSystemAdminRestoreBuiltin')?.dataset?.modelId || [...doorSystemHiddenBuiltinIds()][0];
      if (!id)
          return;
      if (!window.confirm('Restaurar o modelo padrão oculto para todos os usuários?'))
          return;
      try {
          await cloudApiFetch(`/admin/doors/global/${encodeURIComponent(id)}`, { method: 'DELETE', body: {}, timeoutMs: 30000 });
          globalDoorLibraryState.records.delete(id);
          await loadGlobalDoorModels({ force: true });
          renderDoorSystemModels({ resetDimensions: true });
          if (doorSystemModels().some(m => m.id === id))
              $('doorSystemModel').value = id;
          doorSystemUpdateModelInfo({ resetDimensions: true });
          toast('Modelo padrão restaurado');
      }
      catch (err) {
          toast(err.message || 'Não foi possível restaurar o modelo padrão');
      }
  }
  
  // Compatibilidade com modelos locais antigos. A partir da 1.300.17, publicação
  // e manutenção da biblioteca compartilhada são exclusivas do ADM.
  function saveSelectedDoorModel() {
      if (adminAllowed())
          return doorSystemAdminAddNew();
      toast('Somente o ADM pode adicionar modelos de portas');
  }
  
  function deleteSelectedDoorModel() { return doorSystemAdminDeleteSelected(); }
  
  function drawerLevelsFromSet(cfg) {
      const levels = new Array(Math.max(1, Number(cfg.count) || 1)).fill(null);
      for (const o of drawerSetObjects(cfg.id)) {
          if (o.userData?.drawerRole !== 'side-left')
              continue;
          const i = Math.max(0, Math.min(levels.length - 1, Number(o.userData.drawerIndex) || 0));
          levels[i] = getBounds(o).minY;
      }
      // Fallback paramétrico se alguma lateral de caixa não estiver disponível.
      const root = getSpaceRoot(cfg.targetRootId), cell = root && getSpaceCell(root.id, cfg.targetCellId);
      if (root && cell) {
          const openingH = mm(cell.maxY - cell.minY);
          const createFronts = !!cfg.createFronts;
          let frontH = Number(cfg.frontH);
          if (createFronts && !(frontH > 0)) {
              frontH = (openingH - Number(cfg.frontGapTop || 0) - Number(cfg.frontGapBottom || 0) - Number(cfg.frontGapBetween || 0) * (levels.length - 1)) / levels.length;
          }
          const span = openingH - 2 * Number(cfg.edgeGap || 0) - Number(cfg.boxHeight || 120);
          const step = levels.length > 1 ? span / (levels.length - 1) : 0;
          for (let i = 0; i < levels.length; i++) {
              if (levels[i] != null)
                  continue;
              const yMm = createFronts
                  ? mm(cell.minY) + Number(cfg.frontGapBottom || 0) + i * (frontH + Number(cfg.frontGapBetween || 0)) + (frontH - Number(cfg.boxHeight || 120)) / 2
                  : mm(cell.minY) + Number(cfg.edgeGap || 0) + (levels.length > 1 ? step * i : span / 2);
              levels[i] = m(yMm);
          }
      }
      return levels.filter(Number.isFinite);
  }
  
  function drawerForceNearestSidePair(cfg) {
      const ref = drawerReferenceGeometry(cfg);
      if (!ref)
          return { left: null, right: null };
      const candidates = [];
      for (const o of runtimeModel.objects) {
          const u = o.userData;
          if (u?.drawerSetId || u?.kind === 'hardware-visual' || u?.kind === 'cylinder' || u?.kind === 'space-cell')
              continue;
          const ti = pieceThicknessInfo(o);
          if (!ti || ti.thicknessAxis !== 'x')
              continue;
          const b = getBounds(o);
          const oy = Math.max(0, Math.min(b.maxY, ref.maxY) - Math.max(b.minY, ref.minY));
          const oz = Math.max(0, Math.min(b.maxZ, ref.maxZ) - Math.max(b.minZ, ref.minZ));
          if (oy < .02 || oz < .08)
              continue;
          candidates.push({ o, b, oy, oz });
      }
      let left = null, right = null;
      for (const c of candidates) {
          const lg = Math.abs(c.b.maxX - ref.leftInner);
          if (c.b.maxX <= ref.leftInner + .04 && (!left || lg < left.gap))
              left = { o: c.o, gap: lg };
          const rg = Math.abs(c.b.minX - ref.rightInner);
          if (c.b.minX >= ref.rightInner - .04 && (!right || rg < right.gap))
              right = { o: c.o, gap: rg };
      }
      return { left: left?.o || null, right: right?.o || null };
  }
  
  function drawerAddCabinetDrillingOnOwners(cfg, levels, left, right) {
      if (!cfg.createDrilling)
          return { holes: 0, left: !!left, right: !!right };
      const p = drawerPreset(cfg.slideType), ref = drawerReferenceGeometry(cfg), d = drawerDrillDefaults(p);
      const frontZ = Number.isFinite(ref?.frontZ) ? mm(ref.frontZ) : 0;
      const drillPositions = drawerAbsoluteDrillPositions(cfg, p);
      const drillMountY = Number.isFinite(Number(cfg.drillMountY)) ? Number(cfg.drillMountY) : d.mountY;
      const drillDiameter = Number.isFinite(Number(cfg.drillDiameter)) ? Number(cfg.drillDiameter) : d.diameter;
      const drillDepth = Number.isFinite(Number(cfg.drillDepth)) ? Number(cfg.drillDepth) : d.depth;
      const drillSide = ['left', 'right'].includes(cfg?.drillSide) ? cfg.drillSide : 'both';
      const allowLeft = drillSide !== 'right', allowRight = drillSide !== 'left';
      const centerVertical = cfg?.drillVerticalMode === 'center';
      let holes = 0;
      for (const [side, owner] of [['left', left], ['right', right]]) {
          if (side === 'left' && !allowLeft)
              continue;
          if (side === 'right' && !allowRight)
              continue;
          if (!owner)
              continue;
          const entry = side === 'left' ? '+x' : '-x', ob = objectBoundsMm(owner), x = side === 'left' ? ob.maxX : ob.minX;
          levels.forEach((baseM, idx) => {
              const yOffset = centerVertical ? Number(cfg.boxHeight || 120) / 2 : Math.min(Number(cfg.boxHeight || 120) - 5, drillMountY);
              const y = mm(baseM) + yOffset;
              for (const off of drillPositions) {
                  const world = { x, y, z: frontZ - off };
                  if (!pointWithinPieceTangents(owner, world, 'x', 3.0))
                      continue;
                  const op = hardwareHoleOp(owner, world, entry, { diameter: drillDiameter, depth: drillDepth }, { presetId: `drawer-${p.id}`, name: `Corrediça ${p.name}`, role: 'contact', contactName: `Gaveta ${idx + 1}` }, cfg.id);
                  op.drawerSetId = cfg.id;
                  op.drawerIndex = idx;
                  op.drawerSlideType = p.id;
                  op.drawerAutoDrilling = true;
                  op.exportAspireFaceHole = true;
                  (owner.userData.machining || (owner.userData.machining = [])).push(op);
                  holes++;
              }
          });
          sanitizeMachiningForPiece(owner);
      }
      return { holes, left: allowLeft ? !!left : true, right: allowRight ? !!right : true };
  }
  
  function repairDrawerDrillingForRoot(root) {
      if (!root)
          return { sets: 0, holes: 0, missingSides: 0, forced: 0 };
      const configs = drawerUniqueConfigsForRoot(root.id).filter(c => c?.createDrilling);
      let sets = 0, holes = 0, missingSides = 0, forced = 0;
      for (const cfg of configs) {
          sets++;
          drawerRemoveCabinetDrilling(cfg.id);
          const levels = drawerLevelsFromSet(cfg);
          let r = drawerAddCabinetDrilling(cfg, levels);
          // Se a busca normal falhar ou gerar ZERO furos, usa a geometria das
          // próprias gavetas para escolher o par de laterais mais próximo.
          if (r.holes === 0 || !r.left || !r.right) {
              drawerRemoveCabinetDrilling(cfg.id);
              const pair = drawerForceNearestSidePair(cfg);
              r = drawerAddCabinetDrillingOnOwners(cfg, levels, pair.left, pair.right);
              if (r.holes > 0)
                  forced++;
          }
          holes += r.holes;
          if (!r.left || !r.right)
              missingSides++;
      }
      return { sets, holes, missingSides, forced };
  }
  
  function repairAllDrawerDrillingForAspire() {
      let sets = 0, holes = 0, missingSides = 0, forced = 0;
      for (const root of runtimeModel.spaceRoots) {
          const r = repairDrawerDrillingForRoot(root);
          sets += r.sets;
          holes += r.holes;
          missingSides += r.missingSides;
          forced += r.forced || 0;
      }
      if (sets)
          renderMachiningVisuals();
      return { sets, holes, missingSides, forced };
  }
  
  

  function createDoorsInRegion(info,thicknessM,{minSizeM=.001,fitTol=.0005}={}){
    if(!info?.root||!info?.cell||!info?.size)throw new Error('A seleção de espaços não é mais válida');
    const root=info.root,c={...info.cell},s=info.size,t=Number(thicknessM);
    const dc=doorCreationConfig(s);
    if(dc.doorW<mm(minSizeM)||dc.doorH<mm(minSizeM))throw new Error('Os vãos ou o desconto do puxador ultrapassam o tamanho desta divisão');
    if(dc.hingeEnabled&&dc.cupEdge<dc.cupDiameter/2)throw new Error('O centro do copo precisa ficar pelo menos a metade do diâmetro para dentro da porta');
    const fillsWholeDepth=Math.abs(t-s.depth)<=fitTol;
    if(t>s.depth+fitTol)throw new Error('A espessura da porta é maior que a profundidade desta divisão');
    if(!fillsWholeDepth&&t>s.depth-minSizeM)throw new Error('A porta não deixa espaço livre suficiente atrás dela');
    const pieceD=fillsWholeDepth?s.depth:t,regionDoor=!!info.isDoorRegion;
    const zDoor=regionDoor?c.maxZ+pieceD/2:((c.minZ+c.maxZ)/2);
    const yDoor=c.minY+m(dc.gb+dc.bottomLift),doors=[];
    for(let i=0;i<dc.count;i++){
      const slotStartMm=dc.gl+i*(dc.doorSlotW+dc.gm),xMm=slotStartMm+dc.leftLift+dc.doorW/2,x=c.minX+m(xMm);
      const name=dc.count===1?'Porta 1':(dc.count===2?(i===0?'Porta esquerda':'Porta direita'):`Porta ${i+1}`);
      const doorCfg={schemaVersion:1,index:i+1,count:dc.count,gaps:{left:dc.gl,right:dc.gr,top:dc.gt,bottom:dc.gb,middle:dc.gm},handle:{type:dc.handleType,size:dc.handleSize,orientation:dc.handleOrientation,position:dc.cavaPosition},hinge:{enabled:dc.hingeEnabled,count:dc.hingeCount,side:doorHingeSideForIndex(i,dc.count,dc.hingeSide),cupDiameter:dc.cupDiameter,cupDepth:dc.cupDepth,cupEdge:dc.cupEdge,edgeY:dc.hingeEdgeY,mountEnabled:dc.mountEnabled,mountFrontOffset:dc.mountFrontOffset,mountSpacing:dc.mountSpacing,mountDiameter:dc.mountDiameter,mountDepth:dc.mountDepth},regionSelection:regionDoor?{cellIds:[...(info.cellIds||[])],outside:true}:null};
      const door=createBox({width:m(dc.doorW),depth:pieceD,height:m(dc.doorH),x,yBase:yDoor,z:zDoor,name,kind:'panel',materialType:'MDF',baseColor:COLORS.panel,spaceRootId:root.id,doorConfig:doorCfg},false);
      doors.push(door);if(root.doorsHidden){door.visible=false;door.userData.hiddenByDoors=true;}
    }
    const stats={hinges:0,mountHoles:0,missingMount:0,count:doors.length,handleType:dc.handleType,handleSize:dc.handleSize,handleOrientation:dc.handleOrientation};
    if(dc.hingeEnabled){for(let i=0;i<doors.length;i++){const side=doorHingeSideForIndex(i,dc.count,dc.hingeSide),st=appendDoorHingeDrilling(doors[i],root,dc,side);stats.hinges+=st.hinges;stats.mountHoles+=st.mountHoles;stats.missingMount+=st.missingMount;}renderMachiningVisuals();}
    return {doors,createdCount:doors.length,stats};
  }

  function resetDrawerDialogState(){
    if($('drawerSystemDialog'))$('drawerSystemDialog').style.display='none';
    drawerEditingSetId=null;drawerTargetRootId=null;drawerTargetCellId=null;
  }

  function bindDoorsDrawersUI(){
    $('drawerSpaceBtn')?.addEventListener('click',()=>openDrawerSystemDialog());
    $('drawerMoreBtn')?.addEventListener('click',()=>{if($('spaceMoreDialog'))$('spaceMoreDialog').style.display='none';openDrawerSystemDialog();});
    $('editDrawerSetBtn')?.addEventListener('click',()=>openDrawerSystemDialog(state.selected));
    $('drawerSlideType')?.addEventListener('change',()=>{drawerApplyPresetDefaults(true);updateDrawerDrillingFields();});
    ['drawerLengthMode','drawerSideClearance','drawerCount','drawerBoxHeight','drawerBoxThickness','drawerBottomThickness2','drawerBottomOffset','drawerBottomPassLeft','drawerBottomPassRight','drawerBottomPassFront','drawerBottomPassBack','drawerBottomGrooveClearance','drawerBottomGrooveDepth','drawerFrontInset','drawerRearClearance','drawerEdgeGap','drawerFrontThickness','drawerFrontGapLeft','drawerFrontGapRight','drawerFrontGapTop','drawerFrontGapBottom','drawerFrontGapBetween','drawerTamponThickness','drawerTamponPanelThickness','drawerTamponStripDepth','drawerTamponFrontInset','drawerTamponRearInset'].forEach(id=>$(id)?.addEventListener('input',updateDrawerSystemPreview));
    ['drawerDrillFrontRef','drawerDrillOffsets','drawerDrillMountY','drawerDrillDiameter','drawerDrillDepth'].forEach(id=>$(id)?.addEventListener('input',updateDrawerDrillingFields));
    $('drawerDrillAutoByLength')?.addEventListener('change',updateDrawerDrillingFields);$('drawerDrillVerticalMode')?.addEventListener('change',updateDrawerDrillingFields);$('drawerDrillSide')?.addEventListener('change',updateDrawerDrillingFields);$('drawerLengthMode')?.addEventListener('change',updateDrawerDrillingFields);
    $('drawerCreateSlides')?.addEventListener('change',updateDrawerSystemPreview);$('drawerCreateDrilling')?.addEventListener('change',updateDrawerDrillingFields);
    $('drawerResetDrillingPattern')?.addEventListener('click',()=>{drawerSetDrillingUiFromPreset($('drawerSlideType')?.value);updateDrawerDrillingFields();toast('Padrão de furação restaurado');});
    $('drawerCreateFronts')?.addEventListener('change',updateDrawerFrontFields);
    $('drawerCreateTampon')?.addEventListener('change',updateDrawerTamponFields);
    $('drawerTamponSide')?.addEventListener('change',updateDrawerSystemPreview);$('drawerMachineBottom')?.addEventListener('change',updateDrawerBottomMachiningFields);
    ['drawerGrooveLeft','drawerGrooveRight','drawerGrooveFront','drawerGrooveBack'].forEach(id=>$(id)?.addEventListener('change',updateDrawerSystemPreview));
    $('drawerSavedSlideSelect')?.addEventListener('change',applyDrawerSlidePresetLibrary);$('saveDrawerSlidePreset')?.addEventListener('click',saveDrawerSlidePresetLibrary);$('deleteDrawerSlidePreset')?.addEventListener('click',deleteDrawerSlidePresetLibrary);
    $('confirmDrawerSystem')?.addEventListener('click',saveDrawerSystem);$('deleteDrawerSet')?.addEventListener('click',deleteDrawerSystem);$('cancelDrawerSystem')?.addEventListener('click',resetDrawerDialogState);
    $('drawerSystemDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('drawerSystemDialog'))resetDrawerDialogState();});
    $('doorSystemModel')?.addEventListener('change',async()=>{doorSystemUpdateModelInfo({resetDimensions:true});const model=doorSystemModelById($('doorSystemModel')?.value);if(model?.official&&!model.record){try{await doorSystemEnsureModelRecord(model);}catch{}}doorSystemUpdateModelInfo({resetDimensions:false});});
    $('doorSystemUseSelected')?.addEventListener('click',doorSystemUseSelectedDimensions);$('doorSystemAdminAdd')?.addEventListener('click',doorSystemAdminAddNew);$('doorSystemAdminReplace')?.addEventListener('click',doorSystemAdminReplaceSelected);$('doorSystemAdminRename')?.addEventListener('click',doorSystemAdminRenameSelected);$('doorSystemAdminDelete')?.addEventListener('click',doorSystemAdminDeleteSelected);
    $('doorSystemAdminRefresh')?.addEventListener('click',async()=>{await loadGlobalDoorModels({force:true});renderDoorSystemModels();toast(globalDoorLibraryState.error?'Não foi possível atualizar':'Biblioteca de portas atualizada');});
    $('doorSystemAdminRestoreBuiltin')?.addEventListener('click',doorSystemAdminRestoreBuiltin);$('doorSystemClose')?.addEventListener('click',closeDoorSystemDialog);$('doorSystemCreate')?.addEventListener('click',doorSystemCreate);$('doorSystemDialog')?.addEventListener('pointerdown',e=>{if(e.target===$('doorSystemDialog'))closeDoorSystemDialog();});
    $('doorHingeLeftInspectorBtn')?.addEventListener('click',()=>setSelectedDoorHingeSide('left'));$('doorHingeRightInspectorBtn')?.addEventListener('click',()=>setSelectedDoorHingeSide('right'));
  }

  return {
    spaceMultiSelectionEntries,
    spaceMultiSelectionInfo,
    ensureSpaceMultiSelectBar,
    updateSpaceMultiSelectBar,
    clearSpaceMultiSelection,
    setSingleSpaceDoorReference,
    toggleSpaceMultiSelection,
    pieceCreationTargetInfo,
    openDoorFromSpaceSelection,
    ensureSpaceQuickCreateMenu,
    closeSpaceQuickCreateMenu,
    prepareSpaceQuickMenuTarget,
    openSpaceQuickCreateMenu,
    pickSpaceCellAtClient,
    openDrawerFromSpaceSelection,
    isDoorObject,
    doorObjectsForRoot,
    doorObjectShouldBeVisible,
    syncQuickFrontVisibilityButton,
    applyDoorVisibility,
    applyAllDoorVisibility,
    updateDoorsToggleButton,
    toggleDoorsForActiveSpace,
    captureDoorCreateConfig,
    readDoorCreateConfig,
    applyDoorCreateConfig,
    saveDoorCreateConfig,
    doorFieldNumber,
    doorAutoHingeCount,
    doorHingeCountResolved,
    syncDoorCavaPositionOptions,
    doorCreationConfig,
    doorHingeSideForIndex,
    doorHingePositionsMm,
    doorHandleOwnerForVisual,
    doorHandleVisualSpec,
    updateDoorHandleVisualTransform,
    updateDoorHandleVisuals,
    createDoorHandleVisual,
    removeDoorHandleVisualsForOwners,
    doorMountPanelCandidate,
    appendDoorHingeDrilling,
    doorInspectorRuntimeConfig,
    removeDoorAutomaticHinges,
    setSelectedDoorHingeSide,
    updateDoorCreationVisibility,
    getDrawerSlideLibrary,
    setDrawerSlideLibrary,
    refreshDrawerSlideLibrarySelect,
    captureDrawerSlidePreset,
    saveDrawerSlidePresetLibrary,
    applyDrawerSlidePresetLibrary,
    deleteDrawerSlidePresetLibrary,
    drawerParseDrillOffsets,
    drawerDrillTableOffsets,
    drawerCatalogCodeForLength,
    drawerDrillDefaults,
    drawerDrillValuesFromUi,
    drawerAbsoluteDrillPositions,
    drawerSetDrillingUiFromPreset,
    updateDrawerDrillingFields,
    drawerPreset,
    drawerSetObjects,
    drawerSetRepresentative,
    drawerSetIdsForTarget,
    drawerPrimarySetIdForTarget,
    removeDrawerSetsForTarget,
    drawerConfigFromSet,
    drawerUniqueConfigsForRoot,
    drawerTarget,
    drawerAutoLengthMm,
    drawerResolvedLengthMm,
    drawerApplyPresetDefaults,
    drawerReadConfig,
    updateDrawerSystemPreview,
    updateDrawerBottomMachiningFields,
    updateDrawerFrontFields,
    openDrawerSystemDialog,
    drawerReferenceGeometry,
    drawerFindSidePanel,
    drawerRemoveMachining,
    drawerRemoveCabinetDrilling,
    removeDrawerSet,
    drawerCreatePiece,
    drawerAddBottomGroove,
    drawerRemoveBottomGrooves,
    drawerExpectedBottomGrooves,
    drawerBottomGrooveCount,
    drawerEnsureBottomGroovesForSet,
    repairDrawerBottomGroovesForRoot,
    repairAllDrawerBottomGrooves,
    drawerAddCabinetDrilling,
    createDrawerSetFromConfig,
    sanitizeDrawerSet,
    saveDrawerSystem,
    deleteDrawerSystem,
    rebuildDrawerSetsForRoot,
    doorSystemReadOversizePrefs,
    doorSystemPreferredOversize,
    doorSystemRememberOversize,
    persistDoorLibrary,
    doorSystemBuiltinRecord,
    doorSystemBoundsFromParts,
    doorSystemDetectFacePartIds,
    doorSystemBuiltinModels,
    doorSystemIsBuiltinId,
    doorSystemGlobalMeta,
    doorSystemHiddenBuiltinIds,
    doorSystemVisibleOfficialItems,
    doorSystemModels,
    doorSystemModelById,
    doorSystemTemplateItem,
    doorSystemSelectedRoot,
    doorSystemDefaultPosition,
    doorSystemCloudStatusText,
    doorSystemUpdateAdminUi,
    doorSystemUpdateModelInfo,
    renderDoorSystemModels,
    loadGlobalDoorModels,
    doorSystemEnsureModelRecord,
    openDoorSystemDialog,
    closeDoorSystemDialog,
    doorSystemUseSelectedDimensions,
    doorSystemCreate,
    doorSystemModelPayloadFromRoot,
    doorSystemPayloadFromModel,
    doorSystemAdminAddNew,
    doorSystemAdminReplaceSelected,
    doorSystemAdminRenameSelected,
    doorSystemAdminDeleteSelected,
    doorSystemAdminRestoreBuiltin,
    saveSelectedDoorModel,
    deleteSelectedDoorModel,
    drawerLevelsFromSet,
    drawerForceNearestSidePair,
    drawerAddCabinetDrillingOnOwners,
    repairDrawerDrillingForRoot,
    repairAllDrawerDrillingForAspire,
    createDoorsInRegion,
    resetDrawerDialogState,
    bindDoorsDrawersUI,
  };
}
