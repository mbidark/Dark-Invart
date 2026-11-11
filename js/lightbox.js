(() => {
  'use strict';
  const state = { ids: [], index: 0, zoom: 1 };

  function el(id) { return document.getElementById(id); }

  function open(id) {
    const items = window.MbiGallery.getItems();
    state.ids = items.map((i) => i.id);
    state.index = state.ids.indexOf(id);
    if (state.index === -1) return;
    const lb = el('lightbox');
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('show'));
    state.zoom = 1;
    render();
    document.body.style.overflow = 'hidden';
  }

  function close() {
    const lb = el('lightbox');
    lb.classList.remove('show');
    setTimeout(() => { lb.hidden = true; document.body.style.overflow = ''; }, 220);
  }

  function getCurrentItem() {
    const id = state.ids[state.index];
    return window.MbiGallery.getItems().find((i) => i.id === id);
  }

  function render() {
    const item = getCurrentItem();
    if (!item) return;
    const loading = el('lightboxLoading');
    loading.hidden = false;
    const img = el('lightboxImg');
    img.onload = () => { loading.hidden = true; };
    img.style.transform = `scale(${state.zoom})`;
    const url = URL.createObjectURL(item.blob);
    img.src = url;
    img.onload = () => { loading.hidden = true; URL.revokeObjectURL(url); };
    el('lightboxName').textContent = item.filename;
    el('lightboxDims').textContent = `${item.width} × ${item.height} · ${U.formatBytes(item.size)}`;
    const favBtn = el('lightboxFav');
    favBtn.classList.toggle('fav', !!item.favorite);
    el('lightboxFavIcon').querySelector('use').setAttribute('href', item.favorite ? '#i-star-fill' : '#i-star');
  }

  function prev() {
    state.index = (state.index - 1 + state.ids.length) % state.ids.length;
    state.zoom = 1;
    render();
  }
  function next() {
    state.index = (state.index + 1) % state.ids.length;
    state.zoom = 1;
    render();
  }

  function bind() {
    el('lightboxClose').addEventListener('click', close);
    el('lightboxBackdrop').addEventListener('click', close);
    el('lightboxPrev').addEventListener('click', prev);
    el('lightboxNext').addEventListener('click', next);
    el('lightboxZoomIn').addEventListener('click', () => {
      state.zoom = Math.min(5, state.zoom + 0.25);
      el('lightboxImg').style.transform = `scale(${state.zoom})`;
    });
    el('lightboxZoomOut').addEventListener('click', () => {
      state.zoom = Math.max(0.25, state.zoom - 0.25);
      el('lightboxImg').style.transform = `scale(${state.zoom})`;
    });
    el('lightboxFav').addEventListener('click', () => {
      const item = getCurrentItem();
      if (item) window.MbiGallery.toggleFavorite(item.id).then(() => {
        const cur = getCurrentItem();
        if (cur) {
          el('lightboxFav').classList.toggle('fav', !!cur.favorite);
          el('lightboxFavIcon').querySelector('use').setAttribute('href', cur.favorite ? '#i-star-fill' : '#i-star');
        }
      });
    });
    el('lightboxDownload').addEventListener('click', () => {
      const item = getCurrentItem();
      if (item) try { U.downloadBlob(item.blob, item.filename); window.MbiUI.toast('Download started.'); } catch { window.MbiUI.toast('Download failed.', true); }
    });
    el('lightboxEdit').addEventListener('click', () => {
      const item = getCurrentItem();
      if (item) { close(); window.MbiEditor.open(item); }
    });
    el('lightboxDelete').addEventListener('click', async () => {
      const item = getCurrentItem();
      if (!item) return;
      if (!confirm(`Delete "${item.filename}" permanently?`)) return;
      await window.MbiApp.deleteItem(item.id);
      if (state.ids.length <= 1) { close(); return; }
      state.ids.splice(state.index, 1);
      if (state.index >= state.ids.length) state.index = state.ids.length - 1;
      render();
    });

    document.addEventListener('keydown', (e) => {
      if (el('lightbox').hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    });
  }

  window.MbiLightbox = { open, close, bind };
})();
