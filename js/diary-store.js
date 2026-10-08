// ===== Archivio del diario: IndexedDB con copia in memoria =====
// Il resto dell'app lavora in modo sincrono su una copia in memoria (getDiary/setDiary); le modifiche
// vengono scritte in IndexedDB subito, in modo asincrono, solo per le voci cambiate. All'avvio `openDiaryStore`
// carica tutto prima del primo render. Se IndexedDB non è disponibile si ricade su localStorage.
// Il vecchio diario in localStorage (massimo 100 voci) viene migrato alla prima apertura.
export const LS_DIARY_KEY = 'coffee-brew-diary-v1';
const DB_NAME = 'coffee-calc';
const STORE = 'diary';

let cache = [];                 // voci, dalla più recente
let persisted = new Map();      // String(id) -> { id, json }: ciò che c'è nell'archivio
let db = null;                  // null = si usa localStorage
const pending = new Set();      // scritture in corso
let onError = () => {};

export function onDiaryStoreError(fn) { onError = fn; }
export const diaryBackend = () => (db ? 'indexeddb' : 'localstorage');

const byNewest = (a, b) => (new Date(b.date) - new Date(a.date)) || (String(b.id) < String(a.id) ? -1 : 1);

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) return reject(new Error('indexedDB non disponibile'));
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return reject(e); }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('indexedDB bloccato'));
  });
}
const txDone = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('transazione annullata'));
});
function readAll(database) {
  return new Promise((resolve, reject) => {
    const req = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function readLegacy() {
  try { const a = JSON.parse(localStorage.getItem(LS_DIARY_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

// Apre l'archivio e carica il diario. `sanitize` normalizza (o scarta) ogni voce letta.
export async function openDiaryStore(sanitize) {
  let stored = [];
  try {
    db = await openDb();
    stored = await readAll(db);
  } catch (e) {
    db = null;       // ricade su localStorage
  }
  const clean = list => list.map(sanitize).filter(Boolean);
  let entries = clean(stored);
  persisted = new Map(entries.map(e => [String(e.id), { id: e.id, json: JSON.stringify(e) }]));

  // Migrazione dal vecchio localStorage: si aggiungono le voci mancanti, poi si elimina la vecchia copia
  if (db) {
    const legacy = clean(readLegacy()).filter(e => !persisted.has(String(e.id)));
    if (legacy.length || localStorage.getItem(LS_DIARY_KEY) !== null) {
      try {
        if (legacy.length) {
          const tx = db.transaction(STORE, 'readwrite');
          legacy.forEach(e => tx.objectStore(STORE).put(e));
          await txDone(tx);
          legacy.forEach(e => persisted.set(String(e.id), { id: e.id, json: JSON.stringify(e) }));
          entries = entries.concat(legacy);
        }
        localStorage.removeItem(LS_DIARY_KEY);   // solo dopo che la scrittura è confermata
      } catch (e) { onError(e); }
    }
  } else {
    entries = clean(readLegacy());
    persisted = new Map(entries.map(e => [String(e.id), { id: e.id, json: JSON.stringify(e) }]));
  }
  cache = entries.sort(byNewest);
}

// Copia del diario (le voci si possono modificare senza toccare l'archivio finché non si chiama setDiary)
export function getDiary() { return cache.map(e => Object.assign({}, e)); }

export function setDiary(next) {
  cache = next.map(e => Object.assign({}, e));
  const nextMap = new Map(cache.map(e => [String(e.id), { id: e.id, json: JSON.stringify(e) }]));
  const puts = [], dels = [];
  nextMap.forEach((v, k) => { const p = persisted.get(k); if (!p || p.json !== v.json) puts.push(v); });
  persisted.forEach((v, k) => { if (!nextMap.has(k)) dels.push(v.id); });
  persisted = nextMap;
  if (!puts.length && !dels.length) return;
  try {
    if (db) {
      // La transazione parte subito (non in una microtask): IndexedDB esegue le scritture nell'ordine di creazione,
      // e così una chiusura o un ricaricamento della pagina subito dopo il salvataggio perde meno.
      const tx = db.transaction(STORE, 'readwrite');
      const os = tx.objectStore(STORE);
      puts.forEach(v => os.put(JSON.parse(v.json)));
      dels.forEach(id => os.delete(id));
      const p = txDone(tx).catch(e => onError(e)).finally(() => pending.delete(p));
      pending.add(p);
    } else {
      localStorage.setItem(LS_DIARY_KEY, JSON.stringify(cache));
    }
  } catch (e) { onError(e); }
}

// Attende che le scritture in corso siano concluse
export function flushDiary() { return Promise.all([...pending]); }
