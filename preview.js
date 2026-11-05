// Runs inside the Markdown preview. VS Code only forwards *real* clicks on
// <a> elements, so each checkbox is wrapped in a vscode:// link that the
// extension's URI handler receives and turns into an edit of the .md file.
(function () {
  function sourceUri() {
    try {
      const el = document.getElementById('vscode-markdown-preview-data');
      return JSON.parse(el.getAttribute('data-settings')).source;
    } catch { return undefined; }
  }

  function wrap() {
    const src = sourceUri();
    if (!src) return;
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.parentElement && cb.parentElement.classList.contains('mpu-box')) return;
      const item = cb.closest('[data-line]');
      if (!item) return;
      cb.removeAttribute('disabled');
      const a = document.createElement('a');
      a.className = 'mpu-box';
      a.href = 'vscode://local.markdown-planner-utils/toggle?' + new URLSearchParams({
        file: src, line: item.getAttribute('data-line')
      });
      cb.replaceWith(a);
      a.appendChild(cb);
    });
    hideDoneSubheaders();
  }

  // Once a [..](SyncHeader) item is ticked, hide its [..](SyncSubheader) items.
  function hideDoneSubheaders() {
    document.querySelectorAll('.mpu-syncheader').forEach(h => {
      const li = h.closest('li');
      if (!li) return;
      const cb = li.querySelector('input[type="checkbox"]');
      const done = !!(cb && cb.checked);
      li.querySelectorAll('.mpu-syncsubheader').forEach(s => {
        const sub = s.closest('li');
        if (sub && sub !== li) sub.style.display = done ? 'none' : '';
      });
    });
  }

  wrap();
  window.addEventListener('vscode.markdown.updateContent', wrap);
  new MutationObserver(wrap).observe(document.body, { childList: true, subtree: true });
})();
