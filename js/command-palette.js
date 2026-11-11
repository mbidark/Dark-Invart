(() => {
  'use strict';
  const commands = [];
  let filtered = [];
  let activeIndex = 0;

  function register(cmd) { commands.push(cmd); }

  function open() {
    const cp = document.getElementById('commandPalette');
    cp.hidden = false;
    requestAnimationFrame(() => cp.classList.add('show'));
    const input = document.getElementById('commandInput');
    input.value = '';
    filtered = commands.slice();
    activeIndex = 0;
    render();
    setTimeout(() => input.focus(), 50);
  }

  function close() {
    const cp = document.getElementById('commandPalette');
    cp.classList.remove('show');
    setTimeout(() => { cp.hidden = true; }, 220);
  }

  function render() {
    const list = document.getElementById('commandList');
    list.innerHTML = '';
    if (filtered.length === 0) {
      list.innerHTML = '<div class="command-empty">No commands found.</div>';
      return;
    }
    filtered.forEach((cmd, i) => {
      const item = document.createElement('div');
      item.className = 'command-item' + (i === activeIndex ? ' active' : '');
      item.innerHTML = `<svg class="icon"><use href="#${cmd.icon}"/></svg><span class="command-item-title">${cmd.title}</span>${cmd.shortcut ? `<kbd>${cmd.shortcut}</kbd>` : ''}`;
      item.addEventListener('click', () => { close(); cmd.run(); });
      item.addEventListener('mouseenter', () => { activeIndex = i; render(); });
      list.appendChild(item);
    });
  }

  function filter(q) {
    const query = q.toLowerCase().trim();
    filtered = commands.filter((c) => c.title.toLowerCase().includes(query));
    activeIndex = 0;
    render();
  }

  function bind() {
    document.getElementById('commandBtn').addEventListener('click', open);
    document.getElementById('commandBackdrop').addEventListener('click', close);
    document.getElementById('commandInput').addEventListener('input', (e) => filter(e.target.value));
    document.getElementById('commandInput').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(filtered.length - 1, activeIndex + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(0, activeIndex - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[activeIndex]?.run(); close(); }
      else if (e.key === 'Escape') { close(); }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (document.getElementById('commandPalette').hidden) open();
        else close();
      }
    });
  }

  window.MbiCommandPalette = { register, open, close, bind };
})();
