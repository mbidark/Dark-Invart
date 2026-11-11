(() => {
  'use strict';
  const DB_NAME = 'mbi-dark-images';
  const DB_VERSION = 2;
  const STORE = 'images';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unsupported.'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('filename', 'filename', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('favorite', 'favorite', { unique: false });
        } else {
          const store = e.target.transaction.objectStore(STORE);
          if (!store.indexNames.contains('favorite')) store.createIndex('favorite', 'favorite', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  const tx = (mode = 'readonly') => openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));

  const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  async function putImage(record) { return wrap((await tx('readwrite')).put(record)); }
  async function getImage(id) { return wrap((await tx()).get(id)); }
  async function getAllImages() {
    const list = await wrap((await tx()).getAll());
    return (list || []).sort((a, b) => b.createdAt - a.createdAt);
  }
  async function deleteImage(id) { return wrap((await tx('readwrite')).delete(id)); }
  async function clearAllImages() { return wrap((await tx('readwrite')).clear()); }
  async function countImages() { return wrap((await tx()).count()); }
  async function putMany(records) {
    const store = await tx('readwrite');
    return Promise.all(records.map((r) => wrap(store.put(r))));
  }

  window.MbiDB = { openDB, putImage, getImage, getAllImages, deleteImage, clearAllImages, countImages, putMany };
})();
