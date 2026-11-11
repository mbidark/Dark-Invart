(() => {
  'use strict';
  const U = {
    $: (id) => document.getElementById(id),
    $$: (sel, root = document) => root.querySelectorAll(sel),
    formatBytes(bytes) {
      if (!bytes || bytes < 0) return '0 B';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 ** 3) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    },
    safeBaseName(name) {
      return (name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 70) || 'image');
    },
    uniqueName(base, existingNames) {
      let name = `${base}.png`, n = 1;
      const used = new Set(existingNames.map((s) => s.toLowerCase()));
      while (used.has(name.toLowerCase())) name = `${base}_${n++}.png`;
      return name;
    },
    downloadBlob(blob, filename) {
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Empty blob.');
      if (navigator.msSaveOrOpenBlob) { navigator.msSaveOrOpenBlob(blob, filename); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a);
      try { a.click(); } catch (e) { window.open(url, '_blank', 'noopener'); throw e; }
      finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    },
    loadImageFromBlob(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed.')); };
        img.src = url;
      });
    },
    loadImageFromFile(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid image.')); };
        img.src = url;
      });
    },
    debounce(fn, ms) {
      let t;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    },
    clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },
  };
  window.U = U;
})();
