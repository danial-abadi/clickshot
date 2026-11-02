const $ = (id) => document.getElementById(id);

const bitmaps = new Map();
let steps = [];

// ---------- drawing (screenshots are stored clean; marker and hidden areas are applied when drawing) ----------

function drawMarker(ctx, x, y, number, imageWidth) {
  const s = Math.max(1, imageWidth / 1400);
  const radius = 20 * s;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
  ctx.fill();
  ctx.lineWidth = 4 * s;
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();

  const bx = x + radius * 0.9;
  const by = y - radius * 0.9;
  ctx.beginPath();
  ctx.arc(bx, by, 13 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + 16 * s + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), bx, by + s);
  ctx.restore();
}

function drawRedaction(ctx, bitmap, r) {
  if (r.mode === 'pixel') {
    const block = Math.max(8, Math.round(Math.min(r.w, r.h) / 4));
    const tw = Math.max(1, Math.round(r.w / block));
    const th = Math.max(1, Math.round(r.h / block));
    const tmp = document.createElement('canvas');
    tmp.width = tw;
    tmp.height = th;
    tmp.getContext('2d').drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, tw, th);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tw, th, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

function drawStep(canvas, step, index, bitmap, previewRect) {
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  for (const r of step.redactions || []) {
    drawRedaction(ctx, bitmap, r);
  }
  if (step.showMarker && step.x !== null) {
    drawMarker(ctx, step.x, step.y, index + 1, bitmap.width);
  }
  if (previewRect) {
    ctx.save();
    ctx.lineWidth = Math.max(2, bitmap.width / 700);
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = '#2563eb';
    ctx.strokeRect(previewRect.x, previewRect.y, previewRect.w, previewRect.h);
    ctx.restore();
  }
}

async function getBitmap(step) {
  if (!bitmaps.has(step.id)) {
    bitmaps.set(step.id, await createImageBitmap(step.blob));
  }
  return bitmaps.get(step.id);
}

async function renderToBlob(step, index) {
  const canvas = document.createElement('canvas');
  drawStep(canvas, step, index, await getBitmap(step));
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// ---------- data ----------

async function load() {
  steps = (await stepDb.all()).sort((a, b) => a.order - b.order || a.id - b.id);
  await render();
  $('banner').hidden = true;
}

function notifyBadge() {
  chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
}

function save(step) {
  return stepDb.put(step);
}

// ---------- UI ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function button(text, onClick) {
  const b = el('button', '', text);
  b.addEventListener('click', onClick);
  return b;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, 1200);
}

async function buildCard(step, index) {
  const bitmap = await getBitmap(step);
  const card = el('section', 'card');

  const head = el('div', 'card-head');
  head.appendChild(el('span', 'num', 'Step ' + (index + 1)));
  head.appendChild(el('span', 'meta', step.title || step.url || ''));
  card.appendChild(head);

  const caption = document.createElement('textarea');
  caption.rows = 1;
  caption.value = step.caption || '';
  let timer = null;
  caption.addEventListener('input', () => {
    step.caption = caption.value;
    clearTimeout(timer);
    timer = setTimeout(() => save(step), 300);
  });
  card.appendChild(caption);

  const canvas = document.createElement('canvas');
  drawStep(canvas, step, index, bitmap);
  card.appendChild(canvas);

  // drag to hide an area
  let start = null;
  const toImage = (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: Math.max(0, Math.min(canvas.width, Math.round((e.clientX - rect.left) * sx))),
      y: Math.max(0, Math.min(canvas.height, Math.round((e.clientY - rect.top) * sy))),
    };
  };
  const rectOf = (a, b) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) {
      return;
    }
    start = toImage(e);
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (start) {
      drawStep(canvas, step, index, bitmap, rectOf(start, toImage(e)));
    }
  });
  canvas.addEventListener('pointerup', async (e) => {
    if (!start) {
      return;
    }
    const r = rectOf(start, toImage(e));
    start = null;
    if (r.w > 4 && r.h > 4) {
      step.redactions = (step.redactions || []).concat([{ ...r, mode: $('mode').value }]);
      await save(step);
    }
    drawStep(canvas, step, index, bitmap);
  });

  const tools = el('div', 'tools');

  const copyBtn = button('Copy image', async () => {
    try {
      const blob = await renderToBlob(step, index);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash(copyBtn, 'Copied');
    } catch (e) {
      flash(copyBtn, 'Copy failed');
      console.error(e);
    }
  });
  tools.appendChild(copyBtn);

  tools.appendChild(button('Download PNG', async () => {
    downloadBlob(await renderToBlob(step, index), 'step-' + pad(index + 1) + '.png');
  }));

  if (step.x !== null) {
    const label = el('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = step.showMarker;
    check.addEventListener('change', async () => {
      step.showMarker = check.checked;
      await save(step);
      drawStep(canvas, step, index, bitmap);
    });
    label.appendChild(check);
    label.appendChild(document.createTextNode('Click marker'));
    tools.appendChild(label);
  }

  const undo = button('Undo hide', async () => {
    if (!step.redactions || !step.redactions.length) {
      return;
    }
    step.redactions = step.redactions.slice(0, -1);
    await save(step);
    drawStep(canvas, step, index, bitmap);
  });
  tools.appendChild(undo);

  tools.appendChild(el('span', 'spacer'));

  const up = button('Up', () => move(index, -1));
  up.disabled = index === 0;
  tools.appendChild(up);
  const down = button('Down', () => move(index, 1));
  down.disabled = index === steps.length - 1;
  tools.appendChild(down);

  const del = button('Delete', async () => {
    await stepDb.delete(step.id);
    bitmaps.delete(step.id);
    notifyBadge();
    load();
  });
  del.className = 'danger';
  tools.appendChild(del);

  card.appendChild(tools);
  return card;
}

async function render() {
  const scroll = window.scrollY;
  const list = $('list');
  const cards = [];
  for (let i = 0; i < steps.length; i++) {
    cards.push(await buildCard(steps[i], i));
  }
  list.replaceChildren(...cards);
  $('total').textContent = steps.length ? '(' + steps.length + ')' : '';
  $('empty').hidden = steps.length > 0;
  window.scrollTo(0, scroll);
}

async function move(index, delta) {
  const a = steps[index];
  const b = steps[index + delta];
  if (!a || !b) {
    return;
  }
  const order = a.order;
  a.order = b.order;
  b.order = order;
  await save(a);
  await save(b);
  load();
}

// ---------- export ----------

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function downloadZip() {
  if (!steps.length) {
    return;
  }
  const encoder = new TextEncoder();
  const files = [];
  let markdown = '# Steps\n\n';

  for (let i = 0; i < steps.length; i++) {
    const name = 'step-' + pad(i + 1) + '.png';
    const blob = await renderToBlob(steps[i], i);
    files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
    markdown += '## ' + (i + 1) + '. ' + (steps[i].caption || 'Step ' + (i + 1)).replace(/\n+/g, ' ') + '\n\n';
    markdown += '![](' + name + ')\n\n';
  }
  files.push({ name: 'steps.md', data: encoder.encode(markdown) });

  const now = new Date();
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
  downloadBlob(makeZip(files), 'steps-' + stamp + '.zip');
}

// ---------- wiring ----------

$('zip').addEventListener('click', downloadZip);
$('refresh').addEventListener('click', load);
$('bannerRefresh').addEventListener('click', load);
$('clear').addEventListener('click', async () => {
  if (!confirm('Delete all recorded steps?')) {
    return;
  }
  await stepDb.clear();
  bitmaps.clear();
  notifyBadge();
  load();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'steps-changed') {
    return;
  }
  // do not re-render under the user's cursor while they are typing a caption
  if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
    $('banner').hidden = false;
  } else {
    load();
  }
});

load();
