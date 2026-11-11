(() => {
  'use strict';
  const stack = () => document.getElementById('toastStack');

  function toast(message, isError = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.innerHTML = `<svg class="icon"><use href="#${isError ? 'i-alert' : 'i-check'}"/></svg><span>${message}</span>`;
    stack().appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2800);
  }

  function showLoading(text = 'Loading…') {
    const o = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = text;
    o.hidden = false;
    requestAnimationFrame(() => o.classList.add('show'));
  }
  function hideLoading() {
    const o = document.getElementById('loadingOverlay');
    o.classList.remove('show');
    setTimeout(() => { o.hidden = true; }, 260);
  }

  function setPillStatus(type, text) {
    const p = document.getElementById('statusPill');
    p.classList.remove('busy', 'error');
    if (type === 'busy') p.classList.add('busy');
    if (type === 'error') p.classList.add('error');
    document.getElementById('statusPillText').textContent = text;
  }

  function setStatus(text) { document.getElementById('statusText').textContent = text; }
  function showProgress(show) {
    const p = document.getElementById('progress');
    p.classList.toggle('show', show);
    if (!show) document.getElementById('progressBar').style.width = '0%';
  }
  function setProgress(pct) {
    document.getElementById('progressBar').style.width = `${U.clamp(pct, 0, 100)}%`;
  }

  window.MbiUI = { toast, showLoading, hideLoading, setPillStatus, setStatus, showProgress, setProgress };
})();
