/* ============================================================
   MBI DARK · IMAGE INVERTER PRO
   app.js — application logic
   ============================================================ */

(() => {
  'use strict';

  /* ==========================================================
     STATE
     ========================================================== */
  const state = {
    items: [],
    nextId: 1,
    busy: false,
    settings: {
      maxFiles: 20,
      maxSizeMB: 25,
      theme: 'auto',
      layout: 'grid',
    },
    activeView: 'invert',
  };

  let toastTimer = null;

  /* ==========================================================
     DOM REFS
     ========================================================== */
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    app: $('app'),
    sidebar: $('sidebar'),
    main: $('main'),
    menuToggle: $('menuToggle'),
    themeToggle: $('themeToggle'),
    themeIcon: $('themeIcon'),
    themeSelect: $('themeSelect'),
    maxFilesInput: $('maxFilesInput'),
    maxSizeInput: $('maxSizeInput'),
    breadcrumbCurrent: $('breadcrumbCurrent'),
    statusPill: $('statusPill'),
    statusPillText: $('statusPillText'),

    dropZone: $('dropZone'),
    fileInput: $('fileInput'),
    gallery: $('gallery'),
    galleryFull: $('galleryFull'),
    galleryEmpty: $('galleryEmpty'),
    empty: $('empty'),
    count: $('count'),
    clearBtn: $('clearBtn'),
    zipBtn: $('zipBtn'),
    statusText: $('statusText'),
    progress: $('progress'),
    progressBar: $('progressBar'),
    viewToggle: $('viewToggle'),
    galleryBadge: $('galleryBadge'),
    statProcessed: $('statProcessed'),

    toast: $('toast'),
    toastText: $('toastText'),
    toastIcon: $('toastIcon'),

    metaThemeColor: $('metaThemeColor'),
  };

  /* ==========================================================
     THEME
     ========================================================== */
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme() {
    const theme = state.settings.theme;
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
      updateThemeIcon(systemDark.matches);
      updateMetaTheme(systemDark.matches);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      updateThemeIcon(theme === 'dark');
      updateMetaTheme(theme === 'dark');
    }
    // Sync select
    if (dom.themeSelect) dom.themeSelect.value = theme;
  }

  function updateThemeIcon(isDark) {
    const use = dom.themeIcon.querySelector('use');
    use.setAttribute('href', isDark ? '#icon-sun' : '#icon-moon');
  }

  function updateMetaTheme(isDark) {
    dom.metaThemeColor.setAttribute('content', isDark ? '#0a0a0b' : '#f5f5f7');
  }

  systemDark.addEventListener('change', () => {
    if (state.settings.theme === 'auto') applyTheme();
  });

  dom.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      || (!document.documentElement.hasAttribute('data-theme') && systemDark.matches);
    state.settings.theme = isDark ? 'light' : 'dark';
    applyTheme();
    showToast(`Switched to ${state.settings.theme} theme`);
  });

  dom.themeSelect.addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    applyTheme();
  });

  /* ==========================================================
     NAVIGATION / VIEWS
     ========================================================== */
  const viewTitles = {
    invert: 'Invert',
    gallery: 'Gallery',
    settings: 'Settings',
  };

  function switchView(view) {
    state.activeView = view;

    $$('.view').forEach((el) => el.classList.remove('active'));
    const target = $(`view-${view}`);
    if (target) target.classList.add('active');

    $$('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    dom.breadcrumbCurrent.textContent = viewTitles[view] || view;

    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
      dom.sidebar.classList.remove('open');
    }

    // Update gallery view when switching to it
    if (view === 'gallery') {
      renderGalleryFull();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  dom.menuToggle.addEventListener('click', () => {
    dom.sidebar.classList.toggle('open');
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (
      window.innerWidth <= 768 &&
      dom.sidebar.classList.contains('open') &&
      !dom.sidebar.contains(e.target) &&
      !dom.menuToggle.contains(e.target)
    ) {
      dom.sidebar.classList.remove('open');
    }
  });

  /* ==========================================================
     TOAST
     ========================================================== */
  function showToast(message, isError = false) {
    dom.toastText.textContent = message;
    dom.toastIcon.querySelector('use').setAttribute('href', isError ? '#icon-alert' : '#icon-check');
    dom.toast.classList.toggle('error', isError);
    dom.toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove('show');
    }, 2800);
  }

  /* ==========================================================
     STATUS / PROGRESS
     ========================================================== */
  function setStatus(message) {
    dom.statusText.textContent = message;
  }

  function setPillStatus(type, text) {
    dom.statusPill.classList.remove('busy', 'error');
    if (type === 'busy') dom.statusPill.classList.add('busy');
    if (type === 'error') dom.statusPill.classList.add('error');
    dom.statusPillText.textContent = text;
  }

  function showProgress(show) {
    dom.progress.classList.toggle('show', show);
    if (!show) dom.progressBar.style.width = '0%';
  }

  function setProgress(percent) {
    dom.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }

  /* ==========================================================
     SETTINGS PERSISTENCE (localStorage)
     ========================================================== */
  function loadSettings() {
    try {
      const saved = localStorage.getItem('mbi-dark-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(state.settings, parsed);
      }
    } catch { /* ignore */ }

    // Clamp values
    state.settings.maxFiles = Math.min(50, Math.max(1, state.settings.maxFiles));
    state.settings.maxSizeMB = Math.min(100, Math.max(1, state.settings.maxSizeMB));

    // Apply to UI
    dom.maxFilesInput.value = state.settings.maxFiles;
    dom.maxSizeInput.value = state.settings.maxSizeMB;
    dom.themeSelect.value = state.settings.theme;
  }

  function saveSettings() {
    try {
      localStorage.setItem('mbi-dark-settings', JSON.stringify(state.settings));
    } catch { /* ignore */ }
  }

  dom.maxFilesInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 20;
    val = Math.min(50, Math.max(1, val));
    e.target.value = val;
    state.settings.maxFiles = val;
    saveSettings();
    updateControls();
    showToast(`Batch limit set to ${val} images`);
  });

  dom.maxSizeInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 25;
    val = Math.min(100, Math.max(1, val));
    e.target.value = val;
    state.settings.maxSizeMB = val;
    saveSettings();
    showToast(`Max file size set to ${val} MB`);
  });

  /* ==========================================================
     HELPERS
     ========================================================== */
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function safeBaseName(name) {
    return (name
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 70) || 'image');
  }

  function uniqueName(base) {
    let name = `${base}.png`;
    let n = 1;
    const used = new Set(state.items.map((item) => item.filename.toLowerCase()));
    while (used.has(name.toLowerCase())) {
      name = `${base}_${n++}.png`;
    }
    return name;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('This image format could not be opened.'));
      };
      img.src = url;
    });
  }

  /* ==========================================================
     IMAGE INVERSION
     ========================================================== */
  async function invertFile(file) {
    const img = await loadImage(file);
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    if (!width || !height) {
      throw new Error('Image dimensions are invalid.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is not supported by this browser.');

    ctx.drawImage(img, 0, 0);

    const pixels = ctx.getImageData(0, 0, width, height);
    const data = pixels.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
      // Alpha unchanged
    }

    ctx.putImageData(pixels, 0, 0);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('PNG export failed.'))),
        'image/png'
      );
    });

    return { blob, width, height };
  }

  /* ==========================================================
     DOWNLOAD
     ========================================================== */
  function downloadBlob(blob, filename) {
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('The file is empty or could not be prepared.');
    }

    if (navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    a.setAttribute('aria-label', 'Download ' + filename);
    document.body.appendChild(a);

    try {
      a.click();
    } catch (error) {
      window.open(url, '_blank', 'noopener');
      throw error;
    } finally {
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  /* ==========================================================
     RENDERING — CARD
     ========================================================== */
  function buildCard(item) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = item.id;

    // Head
    const head = document.createElement('div');
    head.className = 'card-head';

    const name = document.createElement('div');
    name.className = 'filename';
    name.textContent = item.originalName;
    name.title = `${item.originalName} — ${formatBytes(item.originalSize)}`;

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.title = 'Remove image';
    remove.setAttribute('aria-label', `Remove ${item.originalName}`);
    remove.innerHTML = '<svg class="icon"><use href="#icon-x"/></svg>';
    remove.addEventListener('click', () => removeItem(item.id));

    head.append(name, remove);

    // Preview
    const preview = document.createElement('div');
    preview.className = 'preview';

    const img = document.createElement('img');
    img.src = item.previewUrl;
    img.alt = `Inverted preview of ${item.originalName}`;
    img.loading = 'lazy';
    preview.appendChild(img);

    // Label
    const label = document.createElement('div');
    label.className = 'preview-label';

    const dims = document.createElement('span');
    dims.textContent = `${item.width} × ${item.height}`;

    const metaRight = document.createElement('span');
    metaRight.className = 'meta-right';
    metaRight.innerHTML = '<svg class="icon"><use href="#icon-invert"/></svg> INVERTED PNG';

    label.append(dims, metaRight);

    // Foot
    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const download = document.createElement('button');
    download.className = 'btn small';
    download.type = 'button';
    download.innerHTML = '<svg class="icon"><use href="#icon-download"/></svg> Download PNG';
    download.addEventListener('click', () => {
      try {
        downloadBlob(item.blob, item.filename);
        showToast(`Downloading ${item.filename}`);
      } catch (error) {
        console.error('PNG download failed:', error);
        showToast('Download failed. Check browser permissions.', true);
      }
    });

    foot.appendChild(download);

    card.append(head, preview, label, foot);
    return card;
  }

  function appendCardToGalleries(item) {
    // Add to both main gallery and full gallery
    const card1 = buildCard(item);
    dom.gallery.appendChild(card1);

    const card2 = buildCard(item);
    dom.galleryFull.appendChild(card2);
  }

  function removeItem(id) {
    const index = state.items.findIndex((entry) => entry.id === id);
    if (index === -1) return;

    const [item] = state.items.splice(index, 1);
    URL.revokeObjectURL(item.previewUrl);

    // Remove DOM cards from both galleries
    $$(`.card[data-id="${id}"]`).forEach((card) => card.remove());

    updateControls();
    updateGalleryEmptyState();
    renderGalleryFull();
    showToast('Image removed.');
  }

  function updateGalleryEmptyState() {
    dom.empty.hidden = state.items.length > 0;
    dom.galleryEmpty.hidden = state.items.length > 0;
  }

  /* ==========================================================
     RENDERING — FULL GALLERY VIEW
     ========================================================== */
  function renderGalleryFull() {
    // Rebuild full gallery from state
    dom.galleryFull.innerHTML = '';

    if (state.items.length === 0) {
      dom.galleryFull.appendChild(dom.galleryEmpty);
      dom.galleryEmpty.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();
    state.items.forEach((item) => {
      fragment.appendChild(buildCard(item));
    });
    dom.galleryFull.appendChild(fragment);
  }

  /* ==========================================================
     CONTROLS
     ========================================================== */
  function updateControls() {
    const count = state.items.length;
    const max = state.settings.maxFiles;

    dom.count.innerHTML = `<strong>${count}</strong> / ${max} images`;
    dom.galleryBadge.textContent = count;
    dom.statProcessed.textContent = count;

    dom.clearBtn.disabled = count === 0 || state.busy;
    dom.zipBtn.disabled = count === 0 || state.busy || typeof JSZip === 'undefined';
    dom.fileInput.disabled = state.busy || count >= max;

    dom.viewToggle.hidden = count === 0;
  }

  /* ==========================================================
     FILE HANDLING
     ========================================================== */
  async function handleFiles(fileList) {
    if (state.busy) return;

    const selected = Array.from(fileList || []);
    const images = selected.filter((file) => file.type.startsWith('image/'));

    if (images.length === 0) {
      showToast('Please select valid image files.', true);
      return;
    }

    const slots = state.settings.maxFiles - state.items.length;
    if (slots <= 0) {
      showToast(`Maximum ${state.settings.maxFiles} images reached.`, true);
      return;
    }

    const queue = images.slice(0, slots);
    if (images.length > slots) {
      showToast(`Only ${slots} more image(s) can be added.`, true);
    }

    state.busy = true;
    updateControls();
    showProgress(true);
    setProgress(0);
    setPillStatus('busy', 'Processing…');

    let done = 0;
    let failed = 0;

    for (const file of queue) {
      try {
        const maxBytes = state.settings.maxSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
          throw new Error(`File exceeds ${state.settings.maxSizeMB} MB limit.`);
        }

        setStatus(`Processing ${file.name}…`);
        const result = await invertFile(file);

        const item = {
          id: state.nextId++,
          originalName: file.name,
          filename: uniqueName(safeBaseName(file.name)),
          blob: result.blob,
          previewUrl: URL.createObjectURL(result.blob),
          width: result.width,
          height: result.height,
          originalSize: file.size,
          processedAt: Date.now(),
        };

        state.items.push(item);
        appendCardToGalleries(item);
        done++;

        updateControls();
        updateGalleryEmptyState();
      } catch (error) {
        console.error('Image conversion failed:', file.name, error);
        failed++;
        setStatus(`Could not convert ${file.name}: ${error.message}`);
      }

      const total = done + failed;
      setProgress((total / queue.length) * 100);
    }

    state.busy = false;
    updateControls();
    showProgress(false);

    if (done > 0) {
      setPillStatus('ok', 'Ready');
      setStatus(`${done} image${done === 1 ? '' : 's'} converted successfully${failed ? ` · ${failed} failed` : ''}.`);
      showToast(`${done} image${done === 1 ? '' : 's'} converted.`);
      renderGalleryFull();
    } else {
      setPillStatus('error', 'Failed');
      setStatus('No images were converted.');
      showToast('No images were converted.', true);
      setTimeout(() => setPillStatus('ok', 'Ready'), 3000);
    }

    dom.fileInput.value = '';
  }

  /* ==========================================================
     CLEAR ALL
     ========================================================== */
  function clearAll() {
    if (state.busy || state.items.length === 0) return;

    state.items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    state.items = [];

    dom.gallery.querySelectorAll('.card').forEach((card) => card.remove());
    dom.galleryFull.innerHTML = '';
    dom.galleryFull.appendChild(dom.galleryEmpty);

    dom.fileInput.value = '';

    updateControls();
    updateGalleryEmptyState();
    setStatus('All images cleared.');
    setPillStatus('ok', 'Ready');
    showToast('Gallery cleared.');
  }

  /* ==========================================================
     ZIP DOWNLOAD
     ========================================================== */
  async function downloadZip() {
    if (state.items.length === 0 || state.busy) return;

    if (typeof JSZip === 'undefined') {
      showToast('ZIP library unavailable. Check your internet connection.', true);
      return;
    }

    state.busy = true;
    updateControls();
    dom.zipBtn.disabled = true;
    setStatus('Preparing ZIP archive…');
    setPillStatus('busy', 'Zipping…');
    showProgress(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      state.items.forEach((item) => zip.file(item.filename, item.blob));

      const blob = await zip.generateAsync(
        { type: 'blob' },
        (metadata) => {
          setProgress(metadata.percent);
        }
      );

      downloadBlob(blob, 'mbi-dark-inverted-images.zip');
      setStatus('ZIP file sent to your browser. Check the Downloads folder.');
      setPillStatus('ok', 'Ready');
      showToast('ZIP download started.');
    } catch (error) {
      console.error(error);
      setStatus('Could not create ZIP archive.');
      setPillStatus('error', 'Failed');
      showToast('ZIP creation failed.', true);
      setTimeout(() => setPillStatus('ok', 'Ready'), 3000);
    } finally {
      state.busy = false;
      showProgress(false);
      updateControls();
    }
  }

  /* ==========================================================
     EVENT LISTENERS
     ========================================================== */

  // Dropzone
  dom.dropZone.addEventListener('click', () => {
    if (!state.busy && state.items.length < state.settings.maxFiles) {
      dom.fileInput.click();
    }
  });

  dom.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dom.dropZone.click();
    }
  });

  dom.fileInput.addEventListener('change', (event) => {
    handleFiles(event.target.files);
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach((type) => {
    dom.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dom.dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    dom.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dom.dropZone.classList.remove('dragover');
    });
  });

  dom.dropZone.addEventListener('drop', (event) => {
    handleFiles(event.dataTransfer.files);
  });

  // Prevent browser from opening dropped files
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // Buttons
  dom.clearBtn.addEventListener('click', clearAll);
  dom.zipBtn.addEventListener('click', downloadZip);

  // Layout toggle
  $$('.view-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.view-toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const layout = btn.dataset.layout;
      state.settings.layout = layout;

      dom.gallery.classList.toggle('list-layout', layout === 'list');
      dom.galleryFull.classList.toggle('list-layout', layout === 'list');
    });
  });

  // Topbar scroll shadow
  dom.main.addEventListener('scroll', () => {
    const topbar = document.querySelector('.topbar');
    topbar.classList.toggle('scrolled', dom.main.scrollTop > 4);
  });

  // Also listen on window scroll (topbar is sticky inside main)
  window.addEventListener('scroll', () => {
    const topbar = document.querySelector('.topbar');
    topbar.classList.toggle('scrolled', window.scrollY > 4);
  });

  /* ==========================================================
     CLEANUP
     ========================================================== */
  window.addEventListener('beforeunload', () => {
    state.items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  });

  /* ==========================================================
     INIT
     ========================================================== */
  function init() {
    loadSettings();
    applyTheme();
    updateControls();
    updateGalleryEmptyState();
    setPillStatus('ok', 'Ready');

    // Apply saved layout
    if (state.settings.layout === 'list') {
      dom.gallery.classList.add('list-layout');
      dom.galleryFull.classList.add('list-layout');
      $$('.view-toggle-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.layout === 'list');
      });
    }

    console.log('%c MBI Dark · Image Inverter Pro ', 'background:#111;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px;', 'v2.0.0');
  }

  init();
})();
