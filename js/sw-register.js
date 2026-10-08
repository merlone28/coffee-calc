import { $ } from './app.js';
import { t } from './i18n.js';

if ("serviceWorker" in navigator) {
  let updating = false;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then(reg => {
      const offer = sw => {
        $('updateBannerText').textContent = t('updateAvailable');
        $('updateBtn').textContent = t('updateBtn');
        $('updateBanner').classList.remove('hidden');
        $('updateBtn').onclick = () => { updating = true; sw.postMessage('SKIP_WAITING'); };
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw);
        });
      });
      reg.update().catch(() => {});
    }).catch(() => {});
    // Si ricarica solo dopo che l'utente ha toccato "Aggiorna": la prima installazione (clients.claim)
    // o l'aggiornamento fatto da un'altra scheda non devono ricaricare la pagina sotto i piedi.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updating) { updating = false; window.location.reload(); }
    });
  });
}
