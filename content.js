// Runs in every page (top frame). Reports left mouse-down positions to the background worker while recording.
// It only sends the clicked element's label (button text, aria-label, placeholder...). It never reads typed values.
(() => {
  // Re-injection (install, reload, or recording started): replace the previous instance's listeners.
  if (window.__stepRecorderCleanup) {
    try { window.__stepRecorderCleanup(); } catch (e) { /* previous instance belonged to a reloaded extension */ }
  }

  let recording = false;

  chrome.storage.local.get('rec').then((r) => { recording = r.rec === 'on'; }).catch(() => {});

  const onStorage = (changes, area) => {
    if (area === 'local' && changes.rec) {
      recording = changes.rec.newValue === 'on';
    }
  };
  chrome.storage.onChanged.addListener(onStorage);

  const INTERACTIVE = 'button,a,[role=button],[role=menuitem],[role=tab],[role=link],[role=option],summary,label,input,select,textarea';

  function labelOf(target) {
    const el = target.closest(INTERACTIVE);
    const source = el || target;
    const tag = source.tagName.toLowerCase();
    const type = (source.getAttribute('type') || '').toLowerCase();
    let text = source.getAttribute('aria-label') || '';

    if (!text && tag === 'input') {
      text = ['button', 'submit', 'reset'].indexOf(type) !== -1
        ? source.value
        : source.getAttribute('placeholder') || source.getAttribute('name') || '';
    } else if (!text && (tag === 'select' || tag === 'textarea')) {
      text = source.getAttribute('placeholder') || source.getAttribute('name') || '';
    } else if (!text && el) {
      text = el.innerText || el.getAttribute('title') || el.getAttribute('alt') || '';
    } else if (!text) {
      // non-interactive element: its text may be page data, so only use explicit labels
      text = source.getAttribute('title') || source.getAttribute('alt') || '';
    }

    text = String(text || '').replace(/\s+/g, ' ').trim();
    return text.length > 60 ? text.slice(0, 57) + '...' : text;
  }

  function onMouseDown(e) {
    if (!recording || e.button !== 0) {
      return;
    }
    let target = e.composedPath ? e.composedPath()[0] : e.target;
    if (target && target.nodeType !== 1) {
      target = target.parentElement;
    }
    if (!target || !target.closest) {
      return;
    }

    try {
      chrome.runtime.sendMessage({
        type: 'click',
        x: e.clientX,
        y: e.clientY,
        vw: window.innerWidth,
        vh: window.innerHeight,
        label: labelOf(target),
        title: document.title,
        url: location.href,
      }).catch(() => {});
    } catch (err) {
      // extension was reloaded; this orphaned script will be replaced on next injection
    }
  }

  document.addEventListener('mousedown', onMouseDown, true);

  window.__stepRecorderCleanup = () => {
    document.removeEventListener('mousedown', onMouseDown, true);
    chrome.storage.onChanged.removeListener(onStorage);
  };
})();
