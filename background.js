importScripts('db.js');

// Chrome allows ~2 captureVisibleTab calls per second; keep a gap and process captures one by one.
const MIN_GAP_MS = 550;
let queue = Promise.resolve();
let lastCaptureAt = 0;
let lastOrder = 0;

function enqueue(job) {
  queue = queue.then(job).catch((e) => console.error('[clickshot]', e));
  return queue;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getRec() {
  const { rec = 'off' } = await chrome.storage.local.get('rec');
  return rec;
}

async function updateBadge() {
  const rec = await getRec();
  if (rec === 'off') {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Clickshot' });
    return;
  }
  const count = await stepDb.count();
  await chrome.action.setBadgeBackgroundColor({ color: rec === 'on' ? '#dc2626' : '#d97706' });
  await chrome.action.setBadgeText({ text: String(count) });
  await chrome.action.setTitle({ title: 'Clickshot - ' + (rec === 'on' ? 'recording' : 'paused') });
}

async function flashError(message) {
  console.warn('[clickshot]', message);
  await chrome.action.setBadgeBackgroundColor({ color: '#7f1d1d' });
  await chrome.action.setBadgeText({ text: '!' });
  await chrome.action.setTitle({ title: 'Clickshot - could not capture: ' + message });
  setTimeout(updateBadge, 2000);
}

// Content scripts only load on pages opened after install/reload, so push them into open tabs too.
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (e) {
      // restricted pages (Web Store, discarded tabs...) - nothing to do
    }
  }
}

async function capture(windowId, info) {
  const wait = lastCaptureAt + MIN_GAP_MS - Date.now();
  if (wait > 0) {
    await sleep(wait);
  }

  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  } catch (e) {
    await flashError(e.message || String(e));
    return;
  } finally {
    lastCaptureAt = Date.now();
  }

  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();

  // click position (CSS px of the viewport) -> screenshot pixels
  let x = null;
  let y = null;
  if (info.click) {
    x = Math.round(info.click.x * width / info.click.vw);
    y = Math.round(info.click.y * height / info.click.vh);
  }

  lastOrder = Math.max(Date.now(), lastOrder + 1);
  await stepDb.add({
    blob,
    w: width,
    h: height,
    x,
    y,
    order: lastOrder,
    title: info.title || '',
    url: info.url || '',
    label: info.label || '',
    caption: info.caption,
    showMarker: x !== null,
    redactions: [],
  });

  await updateBadge();
  chrome.runtime.sendMessage({ type: 'steps-changed' }).catch(() => {});
}

async function handleClick(msg, tab) {
  await capture(tab.windowId, {
    click: { x: msg.x, y: msg.y, vw: msg.vw, vh: msg.vh },
    title: msg.title,
    url: msg.url,
    label: msg.label,
    caption: msg.label ? 'Click "' + msg.label + '"' : 'Click',
  });
}

async function handleManual() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) {
    return;
  }
  await capture(tab.windowId, {
    title: tab.title,
    url: tab.url,
    caption: 'Screenshot',
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'click' && sender.tab) {
    getRec().then((rec) => {
      if (rec === 'on') {
        enqueue(() => handleClick(msg, sender.tab));
      }
    });
  } else if (msg.type === 'manual') {
    enqueue(handleManual);
  } else if (msg.type === 'refresh') {
    updateBadge();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'manual-capture') {
    enqueue(handleManual);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.rec) {
    updateBadge();
    if (changes.rec.newValue === 'on') {
      injectIntoOpenTabs();
    }
  }
});

chrome.runtime.onInstalled.addListener(() => { updateBadge(); });
chrome.runtime.onStartup.addListener(() => { updateBadge(); });
updateBadge();
