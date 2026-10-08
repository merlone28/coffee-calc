// ===== Copia e unione del diario tra dispositivi =====
// Funzioni pure (nessun accesso al DOM): costruzione e lettura del file di backup e unione di due diari.
// L'unione non cancella mai nulla: le voci nuove si aggiungono, quelle già presenti si aggiornano solo se
// la copia in arrivo è stata modificata più di recente (campo `updated`), altrimenti restano com'erano.

export const BACKUP_APP = 'coffee-brew-calc';

export function buildBackup(diary, settings, now = new Date()) {
  return { app: BACKUP_APP, version: 2, exportedAt: now.toISOString(), settings, diary };
}

export function backupFileName(lang, now = new Date()) {
  return `${lang === 'en' ? 'coffee-diary' : 'diario-caffe'}-${now.toISOString().slice(0, 10)}.json`;
}

// Legge un backup (anche un semplice array di voci). Lancia un errore se il file non è un diario.
export function parseBackup(text) {
  const data = JSON.parse(text);
  const incoming = Array.isArray(data) ? data : (data && Array.isArray(data.diary) ? data.diary : null);
  if (!incoming) throw new Error('invalid');
  const settings = !Array.isArray(data) && data.settings && typeof data.settings === 'object' ? data.settings : null;
  return { incoming, settings };
}

// Unisce `incoming` (voci grezze) a `existing` (voci già valide). `sanitize` normalizza ogni voce in arrivo.
export function mergeDiaries(existing, incoming, sanitize) {
  const byId = new Map(existing.map((e, i) => [String(e.id), i]));
  const merged = existing.map(e => Object.assign({}, e));
  let added = 0, updated = 0, unchanged = 0, invalid = 0;
  incoming.forEach(raw => {
    const entry = sanitize(raw);
    if (!entry) { invalid++; return; }
    const key = raw && raw.id != null && raw.id !== '' ? String(entry.id) : null;
    if (key != null && byId.has(key)) {
      const i = byId.get(key);
      if ((entry.updated || 0) > (merged[i].updated || 0)) { merged[i] = entry; updated++; } else unchanged++;
      return;
    }
    byId.set(String(entry.id), merged.push(entry) - 1);
    added++;
  });
  merged.sort((a, b) => (new Date(b.date || 0) - new Date(a.date || 0)) || (String(b.id) < String(a.id) ? -1 : 1));
  return { merged, added, updated, unchanged, invalid };
}
