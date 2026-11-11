(() => {
  'use strict';
  const state = {
    items: [],
    filtered: [],
    selected: new Set(),
    selectMode: false,
    search: '',
    sort: 'newest',
    onlyFav: false,
    layout: 'grid',
  };
  const listeners = [];

  const getObjectUrl = (item) => {
    if (!item._previewUrl) item._previewUrl = URL.createObjectURL(item.thumbBlob || item.blob);
    return item._previewUrl;
  };

  const fmtSize = (n) => U.formatBytes(n);

  function buildCard(item) {
    const card = document.createElement('article');
    card.className = 'card' + (item.favorite ? ' fav' : '') + (state.selected.has(item.id) ? ' selected' : '');
    card.dataset.id = item.id;

    const sel = document.createElement('button');
    sel.className = 'card-select';
    sel.type = 'button';
    sel.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>';
    sel.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect(item.id); });
    card.appendChild(sel);

    const fav = document.createElement('button');
    fav.className = 'card-fav';
    fav.type = 'button';
    fav.title = item.favorite ? 'Unfavorite' : 'Favorite';
    fav.innerHTML = `<svg class="icon"><use href="#${item.favorite ? 'i-star-fill' : 'i-star'}"/></svg>`;
    fav.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(item.id); });
    card.appendChild(fav);

    const head = document.createElement('div');
    head.className = 'card-head';
    const name = document.createElement('div');
    name.className = 'filename';
    name.textContent = item.originalName || item.filename;
    name.title = `${item.originalName || item.filename} — ${fmtSize(item.size)}`;
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.title = 'Delete';
    remove.innerHTML = '<svg class="icon"><use href="#i-x"/></svg>';
    remove.addEventListener('click', (e) => { e.stopPropagation(); window.MbiApp.deleteItem(item.id); });
    head.append(name, remove);

    const preview = document.createElement('div');
    preview.className = 'preview';
    const img = document.createElement('img');
    img.src = getObjectUrl(item);
    img.alt = item.originalName || item.filename;
    img.loading = 'lazy';
    preview.appendChild(img);
    preview.addEventListener('click', () => {
      if (state.selectMode) toggleSelect(item.id);
      else window.MbiLightbox.open(item.id);
    });

    const label = document.createElement('div');
    label.className = 'preview-label';
    label.innerHTML = `<span>${item.width} × ${item.height}</span><span class="meta-right"><svg class="icon"><use href="#i-invert"/></svg>${fmtSize(item.size)}</span>`;

    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const dl = document.createElement('button');
    dl.className = 'btn small';
    dl.type = 'button';
    dl.innerHTML = '<svg class="icon"><use href="#i-download"/></svg> Download';
    dl.addEventListener('click', (e) => { e.stopPropagation(); try { U.downloadBlob(item.blob, item.filename); window.MbiUI.toast(`Downloading ${item.filename}`); } catch (err) { window.MbiUI.toast('Download failed.', true); } });
    foot.appendChild(dl);

    card.append(head, preview, label, foot);
    return card;
  }

  function applyFiltersAndSort() {
    const q = state.search.trim().toLowerCase();
    let list = state.items.filter((it) => {
      if (state.onlyFav && !it.favorite) return false;
      if (q && !(it.originalName || '').toLowerCase().includes(q) && !(it.filename || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const cmp = {
      newest: (a, b) => b.createdAt - a.createdAt,
      oldest: (a, b) => a.createdAt - b.createdAt,
      'name-asc': (a, b) => (a.filename || '').localeCompare(b.filename || ''),
      'name-desc': (a, b) => (b.filename || '').localeCompare(a.filename || ''),
      'size-desc': (a, b) => (b.size || 0) - (a.size || 0),
      'size-asc': (a, b) => (a.size || 0) - (b.size || 0),
    }[state.sort] || ((a, b) => b.createdAt - a.createdAt);
    list = list.slice().sort(cmp);
    state.filtered = list;
  }

  function render() {
    applyFiltersAndSort();
    const el = document.getElementById('galleryFull');
    const emptyEl = document.getElementById('galleryEmpty');
    el.innerHTML = '';
    if (state.filtered.length === 0) {
      el.appendChild(emptyEl);
      emptyEl.hidden = false;
    } else {
      const frag = document.createDocumentFragment();
      state.filtered.forEach((it) => frag.appendChild(buildCard(it)));
      el.appendChild(frag);
    }
    // Also render main gallery (active/invert view) with full unfiltered list
    const main = document.getElementById('gallery');
    const mainEmpty = document.getElementById('empty');
    main.innerHTML = '';
    if (state.items.length === 0) {
      main.appendChild(mainEmpty);
      mainEmpty.hidden = false;
    } else {
      const frag = document.createDocumentFragment();
      state.items.forEach((it) => frag.appendChild(buildCard(it)));
      main.appendChild(frag);
    }
    mainEmpty.hidden = state.items.length > 0;

    document.getElementById('gallery').classList.toggle('list-layout', state.layout === 'list');
    document.getElementById('galleryFull').classList.toggle('list-layout', state.layout === 'list');

    updateBulkBar();
    updateSelectMode();
    updateCounters();
    listeners.forEach((fn) => fn());
  }

  function updateCounters() {
    const badge = document.getElementById('galleryBadge');
    if (badge) badge.textContent = state.items.length;
    const count = document.getElementById('count');
    if (count) count.innerHTML = `<strong>${state.items.length}</strong> image${state.items.length === 1 ? '' : 's'} saved`;
    const stat = document.getElementById('statProcessed');
    if (stat) stat.textContent = state.items.length;
    const size = state.items.reduce((s, i) => s + (i.size || 0), 0);
    const statS = document.getElementById('statStorage');
    if (statS) statS.textContent = U.formatBytes(size);
    const toggle = document.getElementById('viewToggle');
    if (toggle) toggle.hidden = state.items.length === 0;
  }

  function updateBulkBar() {
    const bar = document.getElementById('bulkActions');
    const btn = document.getElementById('selectModeBtn');
    if (!bar) return;
    if (state.selectMode) {
      bar.hidden = false;
      btn.hidden = true;
      document.getElementById('bulkCount').textContent = `${state.selected.size} selected`;
    } else {
      bar.hidden = true;
      btn.hidden = false;
    }
  }

  function updateSelectMode() {
    document.body.classList.toggle('select-mode', state.selectMode);
  }

  function toggleSelectMode(force) {
    state.selectMode = typeof force === 'boolean' ? force : !state.selectMode;
    if (!state.selectMode) state.selected.clear();
    render();
  }

  function toggleSelect(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    render();
  }

  async function toggleFavorite(id) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    item.favorite = !item.favorite;
    try {
      await window.MbiDB.putImage({ ...item, _previewUrl: undefined });
      window.MbiUI.toast(item.favorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (e) { window.MbiUI.toast('Could not save favorite.', true); }
    render();
  }

  async function bulkDelete() {
    if (!state.selected.size) return;
    if (!confirm(`Delete ${state.selected.size} image(s) permanently?`)) return;
    for (const id of state.selected) {
      try { await window.MbiDB.deleteImage(id); } catch { /* skip */ }
      const idx = state.items.findIndex((i) => i.id === id);
      if (idx !== -1) { const [it] = state.items.splice(idx, 1); if (it._previewUrl) URL.revokeObjectURL(it._previewUrl); }
    }
    state.selected.clear();
    state.selectMode = false;
    window.MbiUI.toast('Deleted selected images.');
    render();
  }

  async function bulkFavorite() {
    if (!state.selected.size) return;
    for (const id of state.selected) {
      const item = state.items.find((i) => i.id === id);
      if (item && !item.favorite) {
        item.favorite = true;
        try { await window.MbiDB.putImage({ ...item, _previewUrl: undefined }); } catch { /* skip */ }
      }
    }
    window.MbiUI.toast('Added to favorites.');
    render();
  }

  async function bulkZip() {
    if (!state.selected.size) return;
    if (typeof JSZip === 'undefined') { window.MbiUI.toast('ZIP unavailable.', true); return; }
    window.MbiUI.showLoading('Building ZIP…');
    try {
      const zip = new JSZip();
      state.selected.forEach((id) => {
        const it = state.items.find((i) => i.id === id);
        if (it) zip.file(it.filename, it.blob);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      U.downloadBlob(blob, 'mbi-dark-selected.zip');
      window.MbiUI.toast('ZIP download started.');
    } catch (e) { window.MbiUI.toast('ZIP failed.', true); }
    finally { window.MbiUI.hideLoading(); }
  }

  /* Public API */
  window.MbiGallery = {
    state,
    setItems(items) { state.items = items; render(); },
    addItem(item) { state.items.unshift(item); render(); },
    removeItem(id) {
      const idx = state.items.findIndex((i) => i.id === id);
      if (idx !== -1) { const [it] = state.items.splice(idx, 1); if (it._previewUrl) URL.revokeObjectURL(it._previewUrl); }
      state.selected.delete(id);
      render();
    },
    render,
    toggleSelectMode,
    bulkDelete,
    bulkFavorite,
    bulkZip,
    toggleFavorite,
    getItems: () => state.items,
    getSelected: () => [...state.selected],
    setLayout(layout) { state.layout = layout; render(); },
    setSearch(q) { state.search = q; render(); },
    setSort(s) { state.sort = s; render(); },
    setOnlyFav(v) { state.onlyFav = v; render(); },
    onUpdate(fn) { listeners.push(fn); },
  };
})();
