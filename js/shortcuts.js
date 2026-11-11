(() => {
  'use strict';
  function bind() {
    document.addEventListener('keydown', (e) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (inInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        document.getElementById('fileInput').click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        document.getElementById('zipBtn').click();
      }
      if (e.key === 'Escape') {
        if (!document.getElementById('lightbox').hidden) window.MbiLightbox.close();
        if (!document.getElementById('editor').hidden) window.MbiEditor.close();
        if (!document.getElementById('commandPalette').hidden) window.MbiCommandPalette.close();
      }
    });
  }
  window.MbiShortcuts = { bind };
})();
