(() => {
  'use strict';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  let current = 'auto';

  function apply(theme) {
    current = theme;
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
      updateIcon(systemDark.matches);
      updateMeta(systemDark.matches);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      updateIcon(theme === 'dark');
      updateMeta(theme === 'dark');
    }
    const sel = document.getElementById('themeSelect');
    if (sel) sel.value = theme;
  }

  function updateIcon(isDark) {
    const use = document.getElementById('themeIcon')?.querySelector('use');
    if (use) use.setAttribute('href', isDark ? '#i-sun' : '#i-moon');
  }
  function updateMeta(isDark) {
    document.getElementById('metaThemeColor')?.setAttribute('content', isDark ? '#0a0a0b' : '#f5f5f7');
  }

  systemDark.addEventListener('change', () => { if (current === 'auto') apply('auto'); });

  window.MbiTheme = { apply, getCurrent: () => current };
})();
