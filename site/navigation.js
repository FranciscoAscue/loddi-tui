(() => {
  const commands = [
    { label: 'Home', detail: 'Landing', href: 'index.html', key: 'H' },
    { label: 'Installation', detail: 'Windows · macOS · Linux', href: 'documentation.html#install', key: 'I' },
    { label: 'Quick start', detail: 'Create or open a manuscript', href: 'documentation.html#quick-start', key: 'Q' },
    { label: 'Navigation', detail: 'Search and commands', href: 'documentation.html#navigation', key: 'N' },
    { label: 'Editor', detail: 'Markdown and shortcuts', href: 'documentation.html#editor', key: 'E' },
    { label: 'Citations', detail: 'BibTeX and Zotero', href: 'documentation.html#citations', key: 'C' },
    { label: 'Publishing', detail: 'EPUB and PDF', href: 'documentation.html#publishing', key: 'P' },
    { label: 'Project files', detail: 'Manuscript structure', href: 'documentation.html#files', key: 'F' },
    { label: 'Demo', detail: 'Terminal recordings', href: 'index.html#demo', key: 'D' },
    { label: 'GitHub', detail: 'Source repository', href: 'https://github.com/FranciscoAscue/loddi-tui', key: 'G' },
  ];

  const dialog = document.createElement('dialog');
  dialog.className = 'site-dialog';
  dialog.innerHTML = `<div class="dialog-bar"><span class="prompt">LODDI</span><span id="dialog-title"></span><button type="button" class="dialog-close" aria-label="Close dialog">Esc</button></div><div class="dialog-body"></div>`;
  document.body.append(dialog);
  const title = dialog.querySelector('#dialog-title');
  const body = dialog.querySelector('.dialog-body');
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

  function openHelp() {
    title.textContent = 'keyboard shortcuts';
    body.innerHTML = `<p class="dialog-intro">On this website</p><div class="dialog-help"><div><kbd>/</kbd><span>Open commands</span></div><div><kbd>?</kbd><span>Show shortcuts</span></div><div><kbd>↑ / ↓</kbd><span>Select command</span></div><div><kbd>Enter</kbd><span>Follow command</span></div><div><kbd>Esc</kbd><span>Close overlay</span></div></div><p class="dialog-intro">In the Loddi TUI</p><div class="dialog-help"><div><kbd>/</kbd><span>Launcher commands</span></div><div><kbd>?</kbd><span>Contextual shortcuts</span></div><div><kbd>Ctrl+P</kbd><span>Insert palette in editor</span></div><div><kbd>Ctrl+S</kbd><span>Save document</span></div></div><p class="dialog-foot"><a href="documentation.html#editor">All editor shortcuts →</a></p>`;
    dialog.showModal();
  }

  function openPalette() {
    title.textContent = 'commands';
    body.innerHTML = '<label class="palette-label" for="palette-input">Where do you want to go?</label><input id="palette-input" type="search" autocomplete="off" spellcheck="false" placeholder="Type a command or topic..."><div class="palette-list" role="listbox" aria-label="Navigation commands"></div><p class="dialog-foot">↑ ↓ select · Enter open · Esc close</p>';
    const input = body.querySelector('input');
    const list = body.querySelector('.palette-list');
    let filtered = commands;
    let selected = 0;

    function render() {
      const query = input.value.trim().toLowerCase();
      filtered = commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(query));
      selected = Math.min(selected, Math.max(filtered.length - 1, 0));
      list.replaceChildren();
      for (const [index, command] of filtered.entries()) {
        const link = document.createElement('a');
        link.href = command.href;
        link.className = `palette-item${index === selected ? ' selected' : ''}`;
        link.setAttribute('role', 'option');
        link.setAttribute('aria-selected', String(index === selected));
        link.innerHTML = `<span class="palette-key"></span><span class="palette-name"></span><span class="palette-detail"></span>`;
        link.querySelector('.palette-key').textContent = command.key;
        link.querySelector('.palette-name').textContent = command.label;
        link.querySelector('.palette-detail').textContent = command.detail;
        link.addEventListener('pointermove', () => { selected = index; updateSelection(); });
        list.append(link);
      }
      if (!filtered.length) list.innerHTML = '<p class="palette-empty">No matching command.</p>';
    }

    function updateSelection() {
      for (const [index, item] of [...list.querySelectorAll('.palette-item')].entries()) {
        item.classList.toggle('selected', index === selected);
        item.setAttribute('aria-selected', String(index === selected));
      }
      list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', () => { selected = 0; render(); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!filtered.length) return;
        selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
        updateSelection();
      } else if (event.key === 'Enter' && filtered.length) {
        event.preventDefault();
        window.location.href = filtered[selected].href;
      }
    });
    render();
    dialog.showModal();
    input.focus();
  }

  document.querySelectorAll('[data-open-palette]').forEach((button) => button.addEventListener('click', openPalette));
  document.querySelectorAll('[data-open-help]').forEach((button) => button.addEventListener('click', openHelp));
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || dialog.open || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')) return;
    if (event.key === '/') { event.preventDefault(); openPalette(); }
    if (event.key === '?') { event.preventDefault(); openHelp(); }
  });
})();
