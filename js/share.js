import { fmt, val2 } from './core.js';
import { METHODS } from './data/methods.js';
import { mSpecsOf, mType, t } from './i18n.js';
import { $, getVals, state } from './app.js';
import { GRINDERS, gClicksTxt, gFmtPos, grinderSettingFor, gt } from './grinder.js';

// ===== Condivisione ricetta =====
function buildShareUrl() {
  const key = state.method;
  const v = getVals(key);
  const params = new URLSearchParams();
  params.set('m', key);
  params.set('d', v.dose);
  params.set('r', v.ratio);
  if (METHODS[key].temp && v.temp != null) params.set('tw', v.temp);
  if (v.recipe) params.set('rc', v.recipe);
  params.set('lang', state.lang || 'it');
  if (METHODS[key].coldbrew) params.set('cb', state.cbMode);
  const url = new URL(window.location.href);
  url.search = params.toString();
  return url.toString();
}
export function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ===== Immagine ricetta condivisibile =====
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function buildRecipeCanvas() {
  const key = state.method, m = METHODS[key], v = getVals(key);
  const water = Math.round(v.dose * v.ratio);
  const W_ = 1080, H_ = 1350, pad = 84;
  const canvas = document.createElement('canvas');
  canvas.width = W_; canvas.height = H_;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return null;

  const paper = '#f5f1ea', ink = '#24201b', inkSoft = '#655c50', inkFaint = '#6f6556', line = '#e4dccc', accent = '#ae4d1b';

  ctx.fillStyle = paper; ctx.fillRect(0, 0, W_, H_);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, W_, 16);

  ctx.fillStyle = inkFaint;
  ctx.font = '700 26px "Chakra Petch", -apple-system, sans-serif';
  ctx.fillText(t('canvasHeader'), pad, 110);

  ctx.fillStyle = ink;
  ctx.font = '600 76px "Chakra Petch", -apple-system, sans-serif';
  ctx.fillText(m.name, pad, 210);

  ctx.fillStyle = inkSoft;
  ctx.font = '500 32px "Chakra Petch", -apple-system, sans-serif';
  ctx.fillText(mType(key), pad, 254);

  ctx.strokeStyle = line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, 300); ctx.lineTo(W_ - pad, 300); ctx.stroke();

  const colW = (W_ - pad * 2) / 3;
  function stat(i, label, value, color) {
    const x = pad + i * colW;
    ctx.fillStyle = color;
    ctx.font = '700 88px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.fillText(value, x, 470);
    ctx.fillStyle = inkFaint;
    ctx.font = '700 24px "Chakra Petch", -apple-system, sans-serif';
    ctx.fillText(label, x, 508);
  }
  stat(0, t('canvasCoffee'), fmt(v.dose) + 'g', ink);
  stat(1, t('canvasWater'), water + 'g', ink);
  stat(2, t('canvasRatio'), '1:' + v.ratio, accent);

  const barY = 570, barH = 28, barW = W_ - pad * 2;
  const cPct = v.dose / (v.dose + water);
  roundRectPath(ctx, pad, barY, barW, barH, barH / 2);
  ctx.fillStyle = line; ctx.fill();
  roundRectPath(ctx, pad, barY, Math.max(barH, barW * cPct), barH, barH / 2);
  ctx.fillStyle = accent; ctx.fill();

  ctx.fillStyle = inkSoft;
  ctx.font = '500 26px "Chakra Petch", -apple-system, sans-serif';
  ctx.fillText(t('canvasPct')((cPct * 100).toFixed(1), (100 - cPct * 100).toFixed(1)), pad, 642);

  let y = 722;
  Object.entries(mSpecsOf(key)).forEach(([k2, val]) => {
    ctx.fillStyle = inkFaint;
    ctx.font = '700 24px "Chakra Petch", -apple-system, sans-serif';
    ctx.fillText(k2.toUpperCase(), pad, y);
    ctx.fillStyle = ink;
    ctx.font = '500 32px "Chakra Petch", -apple-system, sans-serif';
    ctx.fillText(val2(k2, val), pad, y + 38);
    y += 92;
  });

  ctx.fillStyle = inkFaint;
  ctx.font = '700 24px "Chakra Petch", -apple-system, sans-serif';
  const roastLabel = t('roastLabelShort')[state.roast || 'medium'];
  ctx.fillText(t('canvasRoastGrind'), pad, y + 10);
  ctx.fillStyle = ink;
  ctx.font = '500 32px "Chakra Petch", -apple-system, sans-serif';
  ctx.fillText(`${roastLabel} · ${t('canvasLevel')(m.grind)}`, pad, y + 48);

  const gs = grinderSettingFor(key);
  if (gs) {
    const gr = GRINDERS[state.grinder];
    ctx.fillStyle = inkFaint;
    ctx.font = '700 24px "Chakra Petch", -apple-system, sans-serif';
    ctx.fillText(gt('canvasGrinder'), pad, y + 100);
    ctx.fillStyle = ink;
    ctx.font = '500 32px "Chakra Petch", -apple-system, sans-serif';
    ctx.fillText(`${gr.name} · ${gFmtPos(gr, gs.clicks)} (${gClicksTxt(gs.clicks)})`, pad, y + 138);
  }

  ctx.strokeStyle = line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, H_ - 110); ctx.lineTo(W_ - pad, H_ - 110); ctx.stroke();
  ctx.fillStyle = inkFaint;
  ctx.font = '500 26px "Chakra Petch", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(t('canvasFooter'), W_ / 2, H_ - 60);
  ctx.textAlign = 'left';

  return canvas;
}
function shareRecipeImage() {
  const canvas = buildRecipeCanvas();
  if (!canvas || !canvas.toBlob) { showToast(t('imgNotSupported')); return; }
  canvas.toBlob(async (blob) => {
    if (!blob) { showToast(t('imgFailed')); return; }
    const key = state.method, m = METHODS[key];
    const fileName = `ricetta-${key}.png`;
    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: t('shareTitle'), text: t('shareImageText')(m.name) });
          return;
        } catch (e) { if (e && e.name === 'AbortError') return; }
      }
    } catch (e) {}
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(t('imgDownloaded'));
  }, 'image/png');
}

export function initShare() {
  $('shareBtn').addEventListener('click', async () => {
    const url = buildShareUrl();
    const m = METHODS[state.method];
    if (navigator.share) {
      try { await navigator.share({ title: t('shareTitle'), text: t('shareText')(m.name), url }); return; } catch (e) {}
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('linkCopied'));
    } catch (e) {
      showToast(url);
    }
  });
  $('shareImageBtn').addEventListener('click', shareRecipeImage);
}
