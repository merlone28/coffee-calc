import { $ } from './app.js';
import { t } from './i18n.js';
import { backupFile, commitBackup, downloadBackup, previewBackup } from './diary.js';
import { showToast } from './share.js';

// ===== Condivisione del diario tra dispositivi =====
// Invio: il file di backup passa dal foglio di condivisione del sistema (AirDrop, WhatsApp, e-mail, Drive...).
// Ricezione: l'app installata compare tra le destinazioni di "Condividi" per i file .json (share target nel manifest);
// il service worker custodisce il file e la pagina mostra cosa cambierebbe, prima di unire. L'unione non cancella nulla.
const SHARE_CACHE = 'coffee-calc-share';
const SHARED_KEY = new URL('./shared-backup.json', document.baseURI).href;

export function canShareFiles() {
  try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })); } catch (e) { return false; }
}

async function shareDiary() {
  try {
    await navigator.share({ files: [backupFile()], title: t('shareDiaryTitle'), text: t('shareDiaryText') });
    showToast(t('diaryShared'));
  } catch (e) {
    if (e && e.name === 'AbortError') return;      // l'utente ha chiuso il foglio di condivisione
    downloadBackup();                              // il sistema non l'ha accettato: si ripiega sul file scaricato
    showToast(t('diaryExported'));
  }
}

async function takeSharedBackup() {
  if (!('caches' in window)) return null;
  const cache = await caches.open(SHARE_CACHE);
  const res = await cache.match(SHARED_KEY);
  if (!res) return null;
  const text = await res.text();
  await cache.delete(SHARED_KEY);
  return text;
}

// Se la pagina è stata aperta da "Condividi con..." (?shared=1) mostra la conferma prima di unire il file ricevuto
export async function receiveSharedBackup() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('shared')) return;
  params.delete('shared');
  const q = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (q ? '?' + q : ''));
  let plan;
  try {
    const text = await takeSharedBackup();
    if (text == null) { showToast(t('sharedNothing')); return; }
    plan = previewBackup(text);
  } catch (e) { showToast(t('diaryImportInvalid')); return; }
  if (!plan.added && !plan.updated) { showToast(t('sharedNoChanges')); return; }
  $('sharedSummary').textContent = t('sharedSummary')(plan.added, plan.updated, plan.unchanged);
  $('sharedTitleText').textContent = t('sharedTitle');
  $('sharedConfirm').textContent = t('sharedConfirm');
  $('sharedCancel').textContent = t('sharedCancel');
  $('sharedOverlay').classList.add('show');
  $('sharedConfirm').onclick = () => { $('sharedOverlay').classList.remove('show'); showToast(commitBackup(plan)); };
  $('sharedCancel').onclick = $('sharedClose').onclick = () => $('sharedOverlay').classList.remove('show');
}

export function initDiaryShare() {
  const btn = $('diaryShareBtn');
  btn.classList.toggle('hidden', !canShareFiles());
  btn.addEventListener('click', shareDiary);
}
