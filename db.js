// Tiny IndexedDB wrapper shared by the background worker (importScripts), the popup and the steps page.
// Steps hold a Blob (the clean screenshot), so they live in IndexedDB rather than chrome.storage.
const stepDb = (() => {
  const DB_NAME = 'clickshot';
  const STORE = 'steps';

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result;
      const req = fn(tx.objectStore(STORE));
      if (req) {
        req.onsuccess = () => { result = req.result; };
      }
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }

  return {
    add: (step) => run('readwrite', (s) => s.add(step)),
    put: (step) => run('readwrite', (s) => s.put(step)),
    get: (id) => run('readonly', (s) => s.get(id)),
    all: () => run('readonly', (s) => s.getAll()),
    count: () => run('readonly', (s) => s.count()),
    delete: (id) => run('readwrite', (s) => s.delete(id)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
})();
