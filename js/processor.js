(() => {
  'use strict';
  let worker = null;
  let pending = new Map();
  let nextTaskId = 1;

  function getWorker() {
    if (worker) return worker;
    try {
      worker = new Worker('js/worker.js');
      worker.onmessage = (e) => {
        const { id, ok, result, error } = e.data;
        const task = pending.get(id);
        if (!task) return;
        pending.delete(id);
        if (ok) task.resolve(result);
        else task.reject(new Error(error));
      };
      worker.onerror = (err) => {
        console.error('Worker error:', err);
        pending.forEach((t) => t.reject(new Error('Worker crashed.')));
        pending.clear();
        worker = null;
      };
    } catch (err) {
      console.warn('Web Worker unavailable, using main thread.', err);
      worker = null;
    }
    return worker;
  }

  function runWorker(type, payload) {
    const w = getWorker();
    if (!w) return null;
    return new Promise((resolve, reject) => {
      const id = nextTaskId++;
      pending.set(id, { resolve, reject });
      w.postMessage({ id, type, payload });
    });
  }

  /* Fallback: main-thread inversion */
  async function invertMainThread(file, maxSizeMB) {
    const img = await U.loadImageFromFile(file);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error('Invalid dimensions.');
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, w, h);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error('PNG export failed.')), 'image/png'));
    return { blob, width: w, height: h };
  }

  async function invertImageFile(file, maxSizeMB) {
    if (file.size > maxSizeMB * 1024 * 1024) throw new Error(`Exceeds ${maxSizeMB} MB.`);
    if (worker !== null || true) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await runWorker('invert', { buffer: arrayBuffer, mime: file.type });
        if (result) return result;
      } catch (err) {
        console.warn('Worker invert failed, falling back:', err);
      }
    }
    return invertMainThread(file, maxSizeMB);
  }

  async function applyFiltersToBlob(sourceBlob, filters) {
    const w = getWorker();
    if (w) {
      try {
        const buffer = await sourceBlob.arrayBuffer();
        const result = await runWorker('filters', { buffer, mime: sourceBlob.type, filters });
        if (result) return result;
      } catch (err) {
        console.warn('Worker filter failed, falling back:', err);
      }
    }
    // Fallback: apply on main thread
    const img = await U.loadImageFromBlob(sourceBlob);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.filter = buildFilterString(filters);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    return { blob, width: canvas.width, height: canvas.height };
  }

  function buildFilterString(filters) {
    const f = filters || {};
    const parts = [];
    if (f.brightness != null) parts.push(`brightness(${f.brightness}%)`);
    if (f.contrast != null) parts.push(`contrast(${f.contrast}%)`);
    if (f.saturate != null) parts.push(`saturate(${f.saturate}%)`);
    if (f.grayscale) parts.push(`grayscale(100%)`);
    if (f.sepia) parts.push(`sepia(100%)`);
    if (f.invert) parts.push(`invert(100%)`);
    if (f.blur) parts.push(`blur(${f.blur}px)`);
    if (f.hueRotate) parts.push(`hue-rotate(${f.hueRotate}deg)`);
    return parts.join(' ') || 'none';
  }

  async function generateThumbnail(blob, maxDim = 300) {
    const w = getWorker();
    if (w) {
      try {
        const buffer = await blob.arrayBuffer();
        const result = await runWorker('thumbnail', { buffer, mime: blob.type, maxDim });
        if (result) return result;
      } catch (err) {
        console.warn('Thumbnail worker failed, fallback.', err);
      }
    }
    const img = await U.loadImageFromBlob(blob);
    const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
    const ww = Math.round(img.naturalWidth * ratio);
    const hh = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = ww; canvas.height = hh;
    canvas.getContext('2d').drawImage(img, 0, 0, ww, hh);
    return new Promise((res) => canvas.toBlob((b) => res({ blob: b, width: ww, height: hh }), 'image/png'));
  }

  async function transformBlob(sourceBlob, opts) {
    const { rotate = 0, flipH = false, flipV = false, crop = null } = opts || {};
    const img = await U.loadImageFromBlob(sourceBlob);
    let sw = img.naturalWidth, sh = img.naturalHeight;
    if (crop) { sw = crop.w; sh = crop.h; }
    const rotateRad = (rotate * Math.PI) / 180;
    const rotCanvas = document.createElement('canvas');
    const cos = Math.abs(Math.cos(rotateRad)), sin = Math.abs(Math.sin(rotateRad));
    rotCanvas.width = Math.round(sw * cos + sh * sin);
    rotCanvas.height = Math.round(sw * sin + sh * cos);
    const rctx = rotCanvas.getContext('2d');
    rctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rctx.rotate(rotateRad);
    const sx = crop ? crop.x : 0;
    const sy = crop ? crop.y : 0;
    rctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);

    const out = document.createElement('canvas');
    out.width = rotCanvas.width;
    out.height = rotCanvas.height;
    const octx = out.getContext('2d');
    octx.translate(flipH ? out.width : 0, flipV ? out.height : 0);
    octx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    octx.drawImage(rotCanvas, 0, 0);

    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    return { blob, width: out.width, height: out.height };
  }

  window.MbiProcessor = { invertImageFile, applyFiltersToBlob, generateThumbnail, transformBlob, buildFilterString };
})();
