const $ = (id) => document.getElementById(id);

async function refresh() {
  const { rec = 'off' } = await chrome.storage.local.get('rec');
  const count = await stepDb.count();

  $('state').textContent = rec === 'on' ? 'Recording' : rec === 'paused' ? 'Paused' : 'Not recording';
  $('dot').className = rec === 'off' ? '' : rec;
  $('count').textContent = count + (count === 1 ? ' step' : ' steps');

  $('start').hidden = rec !== 'off';
  $('running').hidden = rec === 'off';
  $('pause').textContent = rec === 'paused' ? 'Resume' : 'Pause';
  $('pause').dataset.next = rec === 'paused' ? 'on' : 'paused';
}

async function setRec(value) {
  await chrome.storage.local.set({ rec: value });
  await refresh();
}

$('start').addEventListener('click', () => setRec('on'));
$('pause').addEventListener('click', () => setRec($('pause').dataset.next));
$('stop').addEventListener('click', () => setRec('off'));

$('manual').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'manual' });
  setTimeout(refresh, 900);
});

$('open').addEventListener('click', async () => {
  const url = chrome.runtime.getURL('steps.html');
  const [existing] = await chrome.tabs.query({ url });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
  window.close();
});

$('clear').addEventListener('click', async () => {
  if (!confirm('Delete all recorded steps?')) {
    return;
  }
  await stepDb.clear();
  await chrome.runtime.sendMessage({ type: 'refresh' });
  chrome.runtime.sendMessage({ type: 'steps-changed' }).catch(() => {});
  await refresh();
});

refresh();
