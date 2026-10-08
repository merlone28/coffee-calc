import { $ } from './app.js';
import { t } from './i18n.js';

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then(reg => {
      const offer = sw => {
        $('updateBannerText').textContent = t('updateAvailable');
        $('updateBtn').textContent = t('updateBtn');
        $('updateBanner').classList.remove('hidden');
        $('updateBtn').onclick = () => sw.postMessage('SKIP_WAITING');
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
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return; reloaded = true; window.location.reload();
    });
  });
}
