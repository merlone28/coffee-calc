// ===== Notifiche di sistema =====
function updateBellIcon() {
  const btn = $('notifyBtn');
  if (!('Notification' in window)) { btn.style.display = 'none'; return; }
  const enabled = state.notifyEnabled !== false && Notification.permission === 'granted';
  btn.innerHTML = enabled ? ICON.bell : ICON.bellOff;
  btn.style.opacity = enabled ? '' : '.55';
  btn.title = enabled ? t('notifyOn') : t('notifyOff');
}
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
function notifyUser(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || state.notifyEnabled === false) return;
  try { new Notification(title, { body }); } catch (e) {}
}
updateBellIcon();
