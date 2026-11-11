(() => {
  'use strict';

  const state = {
    nextId: 1,
    busy: false,
    settings: { maxFiles: 20, maxSizeMB: 25, theme: 'auto', layout: 'grid', thumbSize: 300 },
    objectUrls: new Map(),
  };

  const el = (id) => document.getElementById(id);

  function loadSettings() {
    try {
      const saved = localStorage.getItem('mbi-dark-settings');
      if (saved) Object.assign(state.settings, JSON.parse(saved));
    } catch { /* ignore */ }
    el('maxFilesInput').value = state.settings.maxFiles;
    el('maxSizeInput').value = state.settings.maxSizeMB;
    el('themeSelect').value = state.settings.theme;
    el('layoutSelect').value = state.settings.layout;
    el('thumbSizeSelect').value = state.settings.thumbSize;
    window.MbiTheme.apply(state.settings.theme);
    window.MbiGallery.setLayout(state.settings.layout);
    updateLimitHints();
  }

  function saveSettings() {
    try { localStorage.setItem('mbi-dark-settings', JSON.stringify(state.settings)); } catch { /* ignore */ }
  }

  function updateLimitHints() {
    el('dropLimitHint').textContent = `batch of ${state.settings.maxFiles}`;
    el('dropSizeHint').textContent = `${state.settings.maxSizeMB} MB`;
  }

  function bindSettings() {
    el('themeSelect').addEventListener('change', (e) => { state.settings.theme = e.target.value; window.MbiTheme.apply(e.target.value); saveSettings(); });
    el('layoutSelect').addEventListener('change', (e) => { state.settings.layout = e.target.value; window.MbiGallery.setLayout(e.target.value); saveSettings(); });
    el('thumbSizeSelect').addEventListener('change', (e) => { state.settings.thumbSize = parseInt(e.target.value, 10); saveSettings(); });
    el('maxFilesInput').addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10) || 20;
      v = U.clamp(v, 1, 200);
      e.target.value = v;
      state.settings.maxFiles = v;
      saveSettings();
      updateLimitHints();
    });
    el('maxSizeInput').addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10) || 25;
      v = U.clamp(v, 1, 100);
      e.target.value = v;
      state.settings.maxSizeMB = v;
      saveSettings();
      updateLimitHints();
    });
    el('themeToggle').addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const next = isDark ? 'light' : 'dark';
      state.settings.theme = next;
      window.MbiTheme.apply(next);
      saveSettings();
      window.MbiUI.toast(`Theme: ${next}`);
    });
  }

  async function refreshDbStats() {
    try {
      const count = await window.MbiDB.countImages();
      const all = await window.MbiDB.getAllImages();
      const size = all.reduce((s, i) => s + (i.size || 0), 0);
      el('dbStatusBadge').textContent = 'Ready';
      el('dbStatusBadge').className = 'badge ok';
      el('dbStatusDesc').textContent = 'IndexedDB is available and working.';
      el('dbCountBadge').textContent = count;
      el('dbSizeBadge').textContent = U.formatBytes(size);
      el('statDb').textContent = 'OK';
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.quota) el('dbQuotaBadge').textContent = `${U.formatBytes(est.usage || 0)} / ${U.formatBytes(est.quota)}`;
      } else {
        el('dbQuotaBadge').textContent = 'N/A';
      }
    } catch (err) {
      el('dbStatusBadge').textContent = 'Error';
      el('dbStatusBadge').className = 'badge err';
      el('dbStatusDesc').textContent = err.message || 'IndexedDB unavailable.';
      el('statDb').textContent = 'Err';
    }
  }

  async function handleFiles(fileList) {
    if (state.busy) return;
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) { window.MbiUI.toast('No valid images selected.', true); return; }

    const queue = files.slice(0, state.settings.maxFiles);
    if (files.length > queue.length) window.MbiUI.toast(`Batch limited to ${state.settings.maxFiles}.`, true);

    state.busy = true;
    el('clearBtn').disabled = true;
    el('zipBtn').disabled = true;
    window.MbiUI.showProgress(true);
    window.MbiUI.setProgress(0);
    window.MbiUI.setPillStatus('busy', 'Processing…');
    window.MbiUI.showLoading('Inverting images…');

    let done = 0, failed = 0;
    const maxBytes = state.settings.maxSizeMB * 1024 * 1024;

    for (const file of queue) {
      try {
        if (file.size > maxBytes) throw new Error(`Exceeds ${state.settings.maxSizeMB} MB.`);
        window.MbiUI.setStatus(`Processing ${file.name}…`);
        const result = await window.MbiProcessor.invertImageFile(file, state.settings.maxSizeMB);
        const base = U.safeBaseName(file.name);
        const filename = U.uniqueName(base, window.MbiGallery.getItems().map((i) => i.filename));
        const thumbRes = await window.MbiProcessor.generateThumbnail(result.blob, state.settings.thumbSize);
        const record = {
          id: state.nextId++,
          originalName: file.name,
          filename,
          blob: result.blob,
          thumbBlob: thumbRes.blob,
          size: result.blob.size,
          width: result.width,
          height: result.height,
          createdAt: Date.now(),
          favorite: false,
        };
        await window.MbiDB.putImage(record);
        window.MbiGallery.addItem(record);
        done++;
      } catch (err) {
        console.error('Convert failed:', file.name, err);
        failed++;
        window.MbiUI.setStatus(`Failed: ${file.name} — ${err.message}`);
      }
      window.MbiUI.setProgress(((done + failed) / queue.length) * 100);
    }

    state.busy = false;
    window.MbiUI.showProgress(false);
    window.MbiUI.hideLoading();
    el('clearBtn').disabled = window.MbiGallery.getItems().length === 0;
    el('zipBtn').disabled = window.MbiGallery.getItems().length === 0;
    refreshDbStats();
    el('fileInput').value = '';

    if (done > 0) {
      window.MbiUI.setPillStatus('ok', 'Ready');
      window.MbiUI.setStatus(`${done} image${done === 1 ? '' : 's'} saved${failed ? ` · ${failed} failed` : ''}.`);
      window.MbiUI.toast(`${done} image${done === 1 ? '' : 's'} saved to storage.`);
    } else {
      window.MbiUI.setPillStatus('error', 'Failed');
      window.MbiUI.setStatus('No images converted.');
      window.MbiUI.toast('Conversion failed.', true);
      setTimeout(() => window.MbiUI.setPillStatus('ok', 'Ready'), 3000);
    }
  }

  async function deleteItem(id) {
    if (state.busy) return;
    try {
      await window.MbiDB.deleteImage(id);
      window.MbiGallery.removeItem(id);
      refreshDbStats();
      window.MbiUI.toast('Image deleted.');
    } catch (err) { window.MbiUI.toast('Delete failed.', true); }
  }

  async function clearAll() {
    const items = window.MbiGallery.getItems();
    if (items.length === 0) return;
    if (!confirm(`Delete ALL ${items.length} stored image(s)? Cannot be undone.`)) return;
    state.busy = true;
    window.MbiUI.showLoading('Clearing storage…');
    try {
      await window.MbiDB.clearAllImages();
      items.forEach((i) => { if (i._previewUrl) URL.revokeObjectURL(i._previewUrl); });
      window.MbiGallery.setItems([]);
      refreshDbStats();
      window.MbiUI.toast('All images cleared.');
    } catch (err) { window.MbiUI.toast('Clear failed.', true); }
    finally { state.busy = false; window.MbiUI.hideLoading(); }
  }

  async function downloadZip() {
    const items = window.MbiGallery.getItems();
    if (items.length === 0 || state.busy) return;
    if (typeof JSZip === 'undefined') { window.MbiUI.toast('ZIP unavailable.', true); return; }
    state.busy = true;
    window.MbiUI.showLoading('Building ZIP…');
    window.MbiUI.setPillStatus('busy', 'Zipping…');
    try {
      const zip = new JSZip();
      items.forEach((it) => zip.file(it.filename, it.blob));
      const blob = await zip.generateAsync({ type: 'blob' });
      U.downloadBlob(blob, 'mbi-dark-inverted-images.zip');
      window.MbiUI.toast('ZIP download started.');
      window.MbiUI.setPillStatus('ok', 'Ready');
    } catch (err) {
      console.error(err);
      window.MbiUI.toast('ZIP creation failed.', true);
      window.MbiUI.setPillStatus('error', 'Failed');
      setTimeout(() => window.MbiUI.setPillStatus('ok', 'Ready'), 3000);
    } finally { state.busy = false; window.MbiUI.hideLoading(); }
  }

  async function exportMetadata() {
    const items = window.MbiGallery.getItems().map((i) => ({
      id: i.id, filename: i.filename, originalName: i.originalName,
      width: i.width, height: i.height, size: i.size, createdAt: i.createdAt, favorite: i.favorite,
    }));
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    U.downloadBlob(blob, 'mbi-dark-metadata.json');
    window.MbiUI.toast('Metadata exported.');
  }

  function bindUI() {
    document.querySelectorAll('.nav-item').forEach((b) => b.addEventListener('click', () => window.MbiRouter.switchTo(b.dataset.view)));
    el('menuToggle').addEventListener('click', () => el('sidebar').classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && el('sidebar').classList.contains('open') &&
        !el('sidebar').contains(e.target) && !el('menuToggle').contains(e.target)) {
        el('sidebar').classList.remove('open');
      }
    });

    el('dropZone').addEventListener('click', () => { if (!state.busy) el('fileInput').click(); });
    el('dropZone').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el('dropZone').click(); } });
    el('fileInput').addEventListener('change', (e) => handleFiles(e.target.files));

    ['dragenter', 'dragover'].forEach((t) => el('dropZone').addEventListener(t, (e) => { e.preventDefault(); e.stopPropagation(); el('dropZone').classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach((t) => el('dropZone').addEventListener(t, (e) => { e.preventDefault(); e.stopPropagation(); el('dropZone').classList.remove('dragover'); }));
    el('dropZone').addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

    // Global drop overlay
    let dragCounter = 0;
    const globalDrop = el('globalDrop');
    window.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounter++;
      globalDrop.hidden = false;
      requestAnimationFrame(() => globalDrop.classList.add('show'));
    });
    window.addEventListener('dragleave', (e) => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) {
        globalDrop.classList.remove('show');
        setTimeout(() => { globalDrop.hidden = true; }, 200);
      }
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      globalDrop.classList.remove('show');
      setTimeout(() => { globalDrop.hidden = true; }, 200);
      if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
    });

    el('clearBtn').addEventListener('click', clearAll);
    el('zipBtn').addEventListener('click', downloadZip);
    el('exportDbBtn').addEventListener('click', downloadZip);
    el('backupBtn').addEventListener('click', exportMetadata);
    el('clearDbBtn').addEventListener('click', clearAll);

    document.querySelectorAll('.view-toggle-btn').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const layout = b.dataset.layout;
      state.settings.layout = layout;
      window.MbiGallery.setLayout(layout);
      saveSettings();
    }));

    // Gallery toolbar
    el('searchInput').addEventListener('input', U.debounce((e) => window.MbiGallery.setSearch(e.target.value), 150));
    el('sortSelect').addEventListener('change', (e) => window.MbiGallery.setSort(e.target.value));
    el('favFilterBtn').addEventListener('click', () => {
      const on = el('favFilterBtn').classList.toggle('active');
      el('favFilterBtn').style.background = on ? 'var(--text)' : '';
      el('favFilterBtn').style.color = on ? 'var(--bg)' : '';
      window.MbiGallery.setOnlyFav(on);
    });
    el('selectModeBtn').addEventListener('click', () => window.MbiGallery.toggleSelectMode(true));
    el('bulkCancelBtn').addEventListener('click', () => window.MbiGallery.toggleSelectMode(false));
    el('bulkDelBtn').addEventListener('click', () => window.MbiGallery.bulkDelete());
    el('bulkFavBtn').addEventListener('click', () => window.MbiGallery.bulkFavorite());
    el('bulkZipBtn').addEventListener('click', () => window.MbiGallery.bulkZip());

    window.MbiRouter.onViewChange((v) => { if (v === 'settings') refreshDbStats(); });
  }

  function registerCommands() {
    const cmd = window.MbiCommandPalette;
    cmd.register({ title: 'Open file picker', icon: 'i-upload', shortcut: 'Ctrl+O', run: () => el('fileInput').click() });
    cmd.register({ title: 'Download all as ZIP', icon: 'i-download', shortcut: 'Ctrl+S', run: () => downloadZip() });
    cmd.register({ title: 'Clear all images', icon: 'i-trash', run: () => clearAll() });
    cmd.register({ title: 'Go to Invert', icon: 'i-invert', run: () => window.MbiRouter.switchTo('invert') });
    cmd.register({ title: 'Go to Gallery', icon: 'i-grid', run: () => window.MbiRouter.switchTo('gallery') });
    cmd.register({ title: 'Go to Settings', icon: 'i-settings', run: () => window.MbiRouter.switchTo('settings') });
    cmd.register({ title: 'Toggle theme', icon: 'i-moon', run: () => el('themeToggle').click() });
    cmd.register({ title: 'Export metadata (JSON)', icon: 'i-clipboard', run: () => exportMetadata() });
    cmd.register({ title: 'Toggle select mode', icon: 'i-check', run: () => window.MbiGallery.toggleSelectMode() });
  }

  async function boot() {
    loadSettings();
    bindUI();
    bindSettings();
    window.MbiLightbox.bind();
    window.MbiEditor.bind();
    window.MbiCommandPalette.bind();
    window.MbiShortcuts.bind();
    registerCommands();

    window.MbiUI.showLoading('Loading stored images…');
    try {
      const stored = await window.MbiDB.getAllImages();
      const items = stored.map((r) => ({
        id: r.id,
        originalName: r.originalName || r.filename,
        filename: r.filename,
        blob: r.blob,
        thumbBlob: r.thumbBlob || r.blob,
        size: r.size || (r.blob ? r.blob.size : 0),
        width: r.width,
        height: r.height,
        createdAt: r.createdAt || Date.now(),
        favorite: !!r.favorite,
      }));
      state.nextId = items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
      window.MbiGallery.setItems(items);
      refreshDbStats();
      window.MbiUI.setPillStatus('ok', 'Ready');
      window.MbiUI.setStatus(`Loaded ${items.length} stored image${items.length === 1 ? '' : 's'}.`);
    } catch (err) {
      console.error('Boot error:', err);
      window.MbiUI.toast('Failed to load storage.', true);
      window.MbiUI.setPillStatus('error', 'Storage error');
    } finally {
      window.MbiUI.hideLoading();
    }

    // Topbar scroll shadow
    window.addEventListener('scroll', () => {
      document.querySelector('.topbar')?.classList.toggle('scrolled', window.scrollY > 4);
    });

    // Persist request
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then((persisted) => {
        if (!persisted) navigator.storage.persist().catch(() => {});
      }).catch(() => {});
    }

    console.log('%c MBI Dark · Image Lab ', 'background:#111;color:#fff;font-weight:bold;padding:3px 8px;border-radius:4px;', 'v4.0.0');
  }

  // Expose for other modules
  window.MbiApp = {
    deleteItem,
    getNextId: () => state.nextId++,
    clearAll,
  };

  boot();
})();
