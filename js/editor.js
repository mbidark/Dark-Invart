(() => {
  'use strict';
  const state = {
    item: null,
    originalImg: null,
    history: [],
    historyIndex: -1,
    activeTab: 'filters',
    pendingFilters: {},
    pendingTransform: { rotate: 0, flipH: false, flipV: false },
    appliedBlob: null,
    previewUrl: null,
  };

  const el = (id) => document.getElementById(id);

  const FILTER_DEFS = [
    { key: 'brightness', label: 'Brightness', min: 0, max: 200, def: 100, unit: '%' },
    { key: 'contrast', label: 'Contrast', min: 0, max: 200, def: 100, unit: '%' },
    { key: 'saturate', label: 'Saturation', min: 0, max: 200, def: 100, unit: '%' },
    { key: 'hueRotate', label: 'Hue', min: -180, max: 180, def: 0, unit: '°' },
    { key: 'blur', label: 'Blur', min: 0, max: 20, def: 0, unit: 'px' },
    { key: 'grayscale', label: 'Grayscale', type: 'toggle' },
    { key: 'sepia', label: 'Sepia', type: 'toggle' },
    { key: 'invert', label: 'Invert', type: 'toggle' },
  ];

  const PRESETS = {
    None: {},
    Noir: { grayscale: true, contrast: 130 },
    Vintage: { sepia: true, contrast: 90, brightness: 110 },
    Cyberpunk: { hueRotate: 180, saturate: 200, contrast: 120 },
    'X-Ray': { invert: true, contrast: 140 },
    Cool: { hueRotate: 30, saturate: 130 },
    Warm: { hueRotate: -20, saturate: 140, brightness: 105 },
    Fade: { contrast: 85, brightness: 110, saturate: 80 },
  };

  async function open(item) {
    state.item = item;
    state.originalImg = await U.loadImageFromBlob(item.blob);
    state.pendingFilters = {};
    state.pendingTransform = { rotate: 0, flipH: false, flipV: false };
    state.history = [];
    state.historyIndex = -1;
    state.activeTab = 'filters';
    el('editorTitle').textContent = `Editing: ${item.filename}`;
    el('editor').hidden = false;
    requestAnimationFrame(() => el('editor').classList.add('show'));
    document.body.style.overflow = 'hidden';
    setActiveTab('filters');
    await redraw();
    pushHistory();
  }

  function close() {
    const editor = el('editor');
    editor.classList.remove('show');
    setTimeout(() => { editor.hidden = true; document.body.style.overflow = ''; }, 220);
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.editor-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    renderPanel();
  }

  function renderPanel() {
    const body = el('editorTabBody');
    body.innerHTML = '';
    if (state.activeTab === 'filters') renderFiltersPanel(body);
    else if (state.activeTab === 'adjust') renderAdjustPanel(body);
    else if (state.activeTab === 'transform') renderTransformPanel(body);
  }

  function renderFiltersPanel(body) {
    const presetWrap = document.createElement('div');
    presetWrap.className = 'editor-ctrl';
    presetWrap.innerHTML = '<div class="editor-ctrl-label">Presets</div>';
    const grid = document.createElement('div');
    grid.className = 'editor-presets';
    Object.keys(PRESETS).forEach((name) => {
      const btn = document.createElement('button');
      btn.className = 'editor-preset';
      btn.type = 'button';
      btn.textContent = name;
      btn.addEventListener('click', () => {
        state.pendingFilters = { ...PRESETS[name] };
        document.querySelectorAll('.editor-preset').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        redraw();
      });
      grid.appendChild(btn);
    });
    presetWrap.appendChild(grid);
    body.appendChild(presetWrap);

    FILTER_DEFS.forEach((def) => {
      if (def.type === 'toggle') {
        const ctrl = document.createElement('div');
        ctrl.className = 'editor-ctrl';
        const label = document.createElement('label');
        label.className = 'editor-ctrl-label';
        label.style.cursor = 'pointer';
        label.innerHTML = `<span>${def.label}</span><input type="checkbox" ${state.pendingFilters[def.key] ? 'checked' : ''} style="width:auto;cursor:pointer">`;
        label.querySelector('input').addEventListener('change', (e) => {
          if (e.target.checked) state.pendingFilters[def.key] = true;
          else delete state.pendingFilters[def.key];
          redraw();
        });
        ctrl.appendChild(label);
        body.appendChild(ctrl);
      } else {
        const ctrl = document.createElement('div');
        ctrl.className = 'editor-ctrl';
        const val = state.pendingFilters[def.key] ?? def.def;
        ctrl.innerHTML = `
          <div class="editor-ctrl-label"><span>${def.label}</span><span class="val">${val}${def.unit}</span></div>
          <input type="range" min="${def.min}" max="${def.max}" value="${val}">
        `;
        const range = ctrl.querySelector('input');
        const valEl = ctrl.querySelector('.val');
        range.addEventListener('input', (e) => {
          const v = parseInt(e.target.value, 10);
          valEl.textContent = `${v}${def.unit}`;
          state.pendingFilters[def.key] = v;
          redraw();
        });
        body.appendChild(ctrl);
      }
    });
  }

  function renderAdjustPanel(body) {
    const row = document.createElement('div');
    row.className = 'editor-btn-row';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn';
    resetBtn.type = 'button';
    resetBtn.innerHTML = '<svg class="icon"><use href="#i-undo"/></svg> Reset all';
    resetBtn.addEventListener('click', () => { state.pendingFilters = {}; renderPanel(); redraw(); });
    row.appendChild(resetBtn);
    body.appendChild(row);

    const info = document.createElement('div');
    info.className = 'settings-desc';
    info.style.marginBottom = '12px';
    info.textContent = 'Fine-tune image adjustments. Changes preview live.';
    body.appendChild(info);

    FILTER_DEFS.forEach((def) => {
      if (def.type === 'toggle') return;
      const ctrl = document.createElement('div');
      ctrl.className = 'editor-ctrl';
      const val = state.pendingFilters[def.key] ?? def.def;
      ctrl.innerHTML = `
        <div class="editor-ctrl-label"><span>${def.label}</span><span class="val">${val}${def.unit}</span></div>
        <input type="range" min="${def.min}" max="${def.max}" value="${val}">
      `;
      const range = ctrl.querySelector('input');
      const valEl = ctrl.querySelector('.val');
      range.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        valEl.textContent = `${v}${def.unit}`;
        state.pendingFilters[def.key] = v;
        redraw();
      });
      body.appendChild(ctrl);
    });
  }

  function renderTransformPanel(body) {
    const rotRow = document.createElement('div');
    rotRow.className = 'editor-btn-row';
    ['-90', '90'].forEach((deg) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.innerHTML = `<svg class="icon"><use href="#i-rotate"/></svg> ${deg}°`;
      btn.addEventListener('click', () => {
        state.pendingTransform.rotate = (state.pendingTransform.rotate + parseInt(deg, 10)) % 360;
        redraw();
      });
      rotRow.appendChild(btn);
    });
    body.appendChild(rotRow);

    const flipRow = document.createElement('div');
    flipRow.className = 'editor-btn-row';
    const flipH = document.createElement('button');
    flipH.className = 'btn';
    flipH.type = 'button';
    flipH.innerHTML = '<svg class="icon"><use href="#i-image"/></svg> Flip H';
    flipH.addEventListener('click', () => { state.pendingTransform.flipH = !state.pendingTransform.flipH; redraw(); });
    const flipV = document.createElement('button');
    flipV.className = 'btn';
    flipV.type = 'button';
    flipV.innerHTML = '<svg class="icon"><use href="#i-image"/></svg> Flip V';
    flipV.addEventListener('click', () => { state.pendingTransform.flipV = !state.pendingTransform.flipV; redraw(); });
    flipRow.append(flipH, flipV);
    body.appendChild(flipRow);

    const reset = document.createElement('button');
    reset.className = 'btn';
    reset.type = 'button';
    reset.style.width = '100%';
    reset.style.justifyContent = 'center';
    reset.innerHTML = '<svg class="icon"><use href="#i-undo"/></svg> Reset transform';
    reset.addEventListener('click', () => { state.pendingTransform = { rotate: 0, flipH: false, flipV: false }; redraw(); });
    body.appendChild(reset);
  }

  async function redraw() {
    if (!state.originalImg) return;
    const canvas = el('editorCanvas');
    const ctx = canvas.getContext('2d');
    const img = state.originalImg;

    const filterStr = window.MbiProcessor.buildFilterString(state.pendingFilters);
    const { rotate, flipH, flipV } = state.pendingTransform;
    const rad = (rotate * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const sw = img.naturalWidth, sh = img.naturalHeight;
    const nw = Math.round(sw * cos + sh * sin);
    const nh = Math.round(sw * sin + sh * cos);

    canvas.width = nw;
    canvas.height = nh;
    ctx.clearRect(0, 0, nw, nh);
    ctx.filter = filterStr || 'none';
    ctx.save();
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  function pushHistory() {
    const snapshot = JSON.stringify({ filters: state.pendingFilters, transform: state.pendingTransform });
    if (state.history[state.historyIndex] === snapshot) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    state.historyIndex++;
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    const snap = JSON.parse(state.history[state.historyIndex]);
    state.pendingFilters = snap.filters;
    state.pendingTransform = snap.transform;
    renderPanel();
    redraw();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    const snap = JSON.parse(state.history[state.historyIndex]);
    state.pendingFilters = snap.filters;
    state.pendingTransform = snap.transform;
    renderPanel();
    redraw();
  }

  async function saveAsNew() {
    const canvas = el('editorCanvas');
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return;
    const originalName = state.item.filename.replace(/\.png$/i, '');
    const filename = U.uniqueName(`${originalName}_edited`, window.MbiGallery.getItems().map((i) => i.filename));
    const thumbRes = await window.MbiProcessor.generateThumbnail(blob, 300);
    const record = {
      id: window.MbiApp.getNextId(),
      originalName: filename,
      filename,
      blob,
      thumbBlob: thumbRes.blob,
      size: blob.size,
      width: canvas.width,
      height: canvas.height,
      createdAt: Date.now(),
      favorite: false,
    };
    await window.MbiDB.putImage(record);
    window.MbiGallery.addItem(record);
    window.MbiUI.toast('Saved edited image.');
    close();
  }

  function bind() {
    el('editorClose').addEventListener('click', close);
    el('editorBackdrop').addEventListener('click', close);
    document.querySelectorAll('.editor-tab').forEach((tab) => tab.addEventListener('click', () => setActiveTab(tab.dataset.tab)));
    el('editorUndo').addEventListener('click', undo);
    el('editorRedo').addEventListener('click', redo);
    el('editorSave').addEventListener('click', saveAsNew);
  }

  window.MbiEditor = { open, close, bind };
})();
