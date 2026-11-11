(() => {
  'use strict';
  const titles = { invert: 'Invert', gallery: 'Gallery', settings: 'Settings' };
  let currentView = 'invert';
  const listeners = [];

  function switchTo(view) {
    if (view === currentView && document.getElementById(`view-${view}`).classList.contains('active')) return;
    currentView = view;
    document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.getElementById('breadcrumbCurrent').textContent = titles[view] || view;
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    listeners.forEach((fn) => fn(view));
  }

  function onViewChange(fn) { listeners.push(fn); }

  window.MbiRouter = { switchTo, onViewChange, getCurrent: () => currentView };
})();
