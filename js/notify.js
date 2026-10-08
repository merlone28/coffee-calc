import { ICON } from './core.js';
import { t } from './i18n.js';
import { $, save, state } from './app.js';
import { showToast } from './share.js';
import { convertText } from './units.js';

// ===== Notifiche di sistema =====
export function updateBellIcon() {
  const btn = $('notifyBtn');
  if (!('Notification' in window)) { btn.style.display = 'none'; return; }
  const enabled = state.notifyEnabled !== false && Notification.permission === 'granted';
  btn.innerHTML = enabled ? ICON.bell : ICON.bellOff;
  btn.style.opacity = enabled ? '' : '.55';
  btn.title = enabled ? t('notifyOn') : t('notifyOff');
}
export function notifyUser(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || state.notifyEnabled === false) return;
  try { new Notification(convertText(title), { body: convertText(body) }); } catch (e) {}
}

export function initNotify() {
  $('notifyBtn').addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      state.notifyEnabled = state.notifyEnabled === false;
    } else if (Notification.permission !== 'denied') {
      try {
        const perm = await Notification.requestPermission();
        state.notifyEnabled = perm === 'granted';
      } catch (e) {}
    } else {
      showToast(t('notifyBlocked'));
    }
    save(); updateBellIcon();
  });
  updateBellIcon();
}
