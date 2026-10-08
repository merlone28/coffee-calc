import { $ } from './app.js';
import { METHODS } from './data/methods.js';
import { t } from './i18n.js';
import { loadDiary } from './diary.js';
import { EY_TARGET, entryExtraction } from './extraction.js';

// ===== Andamento nel tempo del diario =====
// Tre viste sullo stesso insieme di voci, filtrato da un'unica riga di filtri: voto nel tempo, EY nel
// tempo (con la fascia target) e voto medio per metodo, più tre riquadri di sintesi con la variazione
// rispetto al periodo precedente. Le funzioni di calcolo sono pure e testabili; il disegno è SVG.
const DAY = 86400000;
const RANGES = { '30': 30, '90': 90, '365': 365, all: null };
const MAX_POINTS_PER_BREW = 30;   // oltre, i voti si mediano per settimana o per mese

// ----- Calcolo -----
export function filterEntries(diary, { range = 'all', method = null } = {}, now = Date.now()) {
  const days = RANGES[range];
  return diary.filter(e => (!method || e.method === method) && (days == null || new Date(e.date).getTime() >= now - days * DAY));
}

// Inizio della settimana (lunedì, ora locale) o del mese
const weekStart = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const monthStart = ms => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

// Serie dei voti: una voce per infusione se sono poche, altrimenti la media per settimana (o per mese se il periodo è lungo)
export function ratingSeries(entries) {
  const rated = entries.filter(e => e.rating > 0).map(e => ({ e, x: new Date(e.date).getTime() })).sort((a, b) => a.x - b.x);
  if (rated.length <= MAX_POINTS_PER_BREW) {
    return { grain: 'brew', points: rated.map(({ e, x }) => ({ x, y: e.rating, n: 1, label: e.methodName })) };
  }
  const span = rated[rated.length - 1].x - rated[0].x;
  const grain = span <= 140 * DAY ? 'week' : 'month';
  const key = grain === 'week' ? weekStart : monthStart;
  const groups = new Map();
  rated.forEach(({ e, x }) => { const k = key(x); (groups.get(k) || groups.set(k, []).get(k)).push(e.rating); });
  const points = [...groups.entries()].sort((a, b) => a[0] - b[0])
    .map(([x, r]) => ({ x, y: r.reduce((s, v) => s + v, 0) / r.length, n: r.length, label: '' }));
  return { grain, points };
}

// Serie dell'EY: una voce per ogni infusione con il TDS annotato
export function eySeries(entries) {
  return entries.map(e => ({ e, ex: entryExtraction(e) })).filter(o => o.ex)
    .map(({ e, ex }) => ({ x: new Date(e.date).getTime(), y: ex.ey, tds: ex.tds, estimated: ex.estimated, verdict: ex.verdict, label: e.methodName }))
    .sort((a, b) => a.x - b.x);
}

// Voto medio e numero di infusioni per metodo (i voti a 0 sono "non votato")
export function methodStats(entries) {
  const by = new Map();
  entries.forEach(e => {
    const k = e.method || e.methodName;
    const o = by.get(k) || by.set(k, { method: k, name: e.methodName, n: 0, nRated: 0, sum: 0 }).get(k);
    o.n++; if (e.rating > 0) { o.nRated++; o.sum += e.rating; }
  });
  return [...by.values()].map(o => ({ method: o.method, name: o.name, n: o.n, nRated: o.nRated, avg: o.nRated ? o.sum / o.nRated : null }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.n - a.n);
}

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
// Sintesi del periodo e del periodo precedente di pari lunghezza (delta solo per 30/90/365 giorni)
export function summary(diary, { range = 'all', method = null } = {}, now = Date.now()) {
  const stats = es => {
    const ex = es.map(entryExtraction).filter(Boolean);
    return { n: es.length, rating: mean(es.filter(e => e.rating > 0).map(e => e.rating)), ey: mean(ex.map(x => x.ey)),
      onTarget: ex.filter(x => x.verdict === 'ok').length, measured: ex.length };
  };
  const cur = stats(filterEntries(diary, { range, method }, now));
  const days = RANGES[range];
  if (days == null) return { cur, prev: null, days: null };
  const m = diary.filter(e => !method || e.method === method);
  const prevEntries = m.filter(e => { const x = new Date(e.date).getTime(); return x >= now - 2 * days * DAY && x < now - days * DAY; });
  return { cur, prev: stats(prevEntries), days };
}

// ----- Formato -----
const loc = () => t('localeCode');
const fmtNum = (x, d = 1) => x.toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDay = (ms, withYear) => new Date(ms).toLocaleDateString(loc(), withYear ? { day: 'numeric', month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' });
const fmtMonth = ms => new Date(ms).toLocaleDateString(loc(), { month: 'short', year: '2-digit' });

// ----- Disegno -----
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (text != null) n.textContent = text;
  return n;
}
function html(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

const view = { range: 'all', method: null, tables: {} };   // filtri e vista (grafico/tabella) di ogni figura

// Scheletro di una figura: titolo, pulsante grafico/tabella, area del grafico, tabella, tooltip
function figure(host, id, title, sub) {
  host.textContent = '';
  const fig = html('figure', 'viz-fig');
  const head = html('div', 'viz-head');
  const titles = html('div');
  titles.append(html('div', 'viz-title', title));
  if (sub) titles.append(html('div', 'viz-sub', sub));
  const toggle = html('button', 'viz-toggle', view.tables[id] ? t('insChartBtn') : t('insTableBtn'));
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', String(!!view.tables[id]));
  toggle.addEventListener('click', () => { view.tables[id] = !view.tables[id]; renderInsights(); });
  head.append(titles, toggle);
  const plot = html('div', 'viz-plot');
  const tip = html('div', 'viz-tip');
  tip.hidden = true;
  tip.setAttribute('role', 'status');
  const tableWrap = html('div', 'viz-table-wrap');
  fig.append(head, plot, tableWrap, tip);
  host.append(fig);
  plot.hidden = !!view.tables[id];
  tableWrap.hidden = !view.tables[id];
  return { fig, plot, tip, tableWrap };
}
function fillTable(wrap, headers, rows, caption) {
  const tb = html('table', 'viz-table');
  tb.append(html('caption', 'sr-only', caption));
  const hr = html('tr');
  headers.forEach(h => { const th = html('th', '', h); th.scope = 'col'; hr.append(th); });
  const thead = html('thead');
  thead.append(hr);
  tb.append(thead);
  const body = html('tbody');
  rows.forEach(r => { const tr = html('tr'); r.forEach(c => tr.append(html('td', '', c))); body.append(tr); });
  tb.append(body);
  wrap.append(tb);
}
function empty(host, id, title, message) {
  const f = figure(host, id, title);
  f.plot.hidden = false; f.tableWrap.hidden = true;
  f.fig.querySelector('.viz-toggle').remove();
  f.plot.append(html('div', 'viz-empty', message));
}

// Tooltip: valore in evidenza, etichetta secondaria, riga con tratto del colore della serie
function showTip(fig, tip, px, py, lines) {
  tip.textContent = '';
  const val = html('div', 'viz-tip-val');
  val.append(html('span', 'viz-tip-key'), html('b', '', lines.value));
  tip.append(val);
  lines.rest.filter(Boolean).forEach(l => tip.append(html('div', 'viz-tip-row', l)));
  tip.hidden = false;
  const w = fig.clientWidth, tw = tip.offsetWidth;
  tip.style.left = Math.max(4, Math.min(w - tw - 4, px - tw / 2)) + 'px';
  tip.style.top = Math.max(4, py - tip.offsetHeight - 14) + 'px';
}

// Grafico a linee su asse temporale con una sola serie. opts: yDomain, yTicks, band, filled(p), tip(p), unit, label
function lineChart(f, points, opts) {
  const W = Math.max(260, f.plot.clientWidth || 320), H = 210;
  const m = { l: 34, r: 14, t: 12, b: 28 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xs = points.map(p => p.x);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 === x0) { x0 -= DAY; x1 += DAY; }
  const [y0, y1] = opts.yDomain;
  const X = x => m.l + (x - x0) / (x1 - x0) * pw;
  const Y = y => m.t + (1 - (y - y0) / (y1 - y0)) * ph;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz-svg', role: 'img', tabindex: 0, 'aria-label': opts.label });
  // fascia di riferimento (neutra: non è un dato)
  if (opts.band) {
    svg.append(el('rect', { class: 'viz-band', x: m.l, y: Y(opts.band[1]), width: pw, height: Y(opts.band[0]) - Y(opts.band[1]) }));
    svg.append(el('text', { class: 'viz-text', x: m.l + 6, y: Y(opts.band[1]) + 13 }, opts.bandLabel));
  }
  opts.yTicks.forEach(v => {
    svg.append(el('line', { class: v === y0 ? 'viz-axis' : 'viz-grid', x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }));
    svg.append(el('text', { class: 'viz-text viz-num', x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmtNum(v, 0)));
  });
  // etichette dell'asse X: quattro, dalla prima all'ultima
  const withYear = (x1 - x0) > 300 * DAY;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * i / (n - 1);
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    svg.append(el('text', { class: 'viz-text', x: X(x), y: H - 8, 'text-anchor': anchor }, opts.grain === 'month' ? fmtMonth(x) : fmtDay(x, withYear)));
  }
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  if (opts.area && points.length > 1) {
    svg.append(el('path', { class: 'viz-area', d: `${d}L${X(points[points.length - 1].x).toFixed(1)} ${Y(y0)}L${X(points[0].x).toFixed(1)} ${Y(y0)}Z` }));
  }
  svg.append(el('path', { class: 'viz-line', d }));
  // punti: pieno = nel target / normale, vuoto = fuori target; oltre ~40 punti restano solo l'ultimo e quello attivo
  const dense = points.length > 40;
  points.forEach((p, i) => {
    if (dense && i !== points.length - 1) return;
    const hollow = opts.filled && !opts.filled(p);
    svg.append(el('circle', { class: 'viz-dot' + (hollow ? ' hollow' : ''), cx: X(p.x), cy: Y(p.y), r: 4 }));
  });
  // etichetta diretta sull'ultimo valore
  const last = points[points.length - 1];
  svg.append(el('text', { class: 'viz-label', x: Math.min(X(last.x), W - m.r - 2), y: Y(last.y) - 10, 'text-anchor': X(last.x) > W - 40 ? 'end' : 'middle' }, fmtNum(last.y, opts.dec ?? 1)));
  // cursore e punto attivo
  const cross = el('line', { class: 'viz-cross', y1: m.t, y2: m.t + ph, visibility: 'hidden' });
  const active = el('circle', { class: 'viz-dot active', r: 6, visibility: 'hidden' });
  svg.append(cross, active);

  let idx = points.length - 1;
  const show = i => {
    idx = Math.max(0, Math.min(points.length - 1, i));
    const p = points[idx], px = X(p.x), py = Y(p.y);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    active.setAttribute('cx', px); active.setAttribute('cy', py); active.setAttribute('visibility', 'visible');
    showTip(f.fig, f.tip, px, py + f.plot.offsetTop, opts.tip(p));
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); active.setAttribute('visibility', 'hidden'); f.tip.hidden = true; };
  const nearest = ev => {
    const r = svg.getBoundingClientRect();
    const x = (ev.clientX - r.left) * (W / r.width);
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(X(p.x) - x) < Math.abs(X(points[best].x) - x)) best = i; });
    return best;
  };
  svg.addEventListener('pointermove', ev => show(nearest(ev)));
  svg.addEventListener('pointerdown', ev => show(nearest(ev)));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(idx));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft') { show(idx - 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { show(idx + 1); ev.preventDefault(); }
    else if (ev.key === 'Escape') hide();
  });
  f.plot.append(svg);
}

// Barre orizzontali: voto medio per metodo (una sola serie, quindi un solo colore e nessuna legenda)
function barChart(f, rows) {
  const W = Math.max(260, f.plot.clientWidth || 320);
  const bar = 18, gap = 14, m = { l: 108, r: 40, t: 6, b: 26 };
  const H = m.t + m.b + rows.length * (bar + gap) - gap;
  const pw = W - m.l - m.r;
  const X = v => m.l + v / 5 * pw;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz-svg', role: 'img', 'aria-label': t('insMethodAria') });
  [0, 1, 2, 3, 4, 5].forEach(v => {
    svg.append(el('line', { class: v === 0 ? 'viz-axis' : 'viz-grid', x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }));
    svg.append(el('text', { class: 'viz-text viz-num', x: X(v), y: H - 8, 'text-anchor': 'middle' }, String(v)));
  });
  rows.forEach((r, i) => {
    const y = m.t + i * (bar + gap);
    const g = el('g', { class: 'viz-bar-g', tabindex: 0, role: 'img', 'aria-label': `${r.name}: ${r.avg != null ? fmtNum(r.avg) : '—'}, ${t('insBrewsCount')(r.n)}` });
    svg.append(el('text', { class: 'viz-text viz-cat', x: m.l - 10, y: y + bar / 2 + 4, 'text-anchor': 'end' }, `${r.name}`));
    if (r.avg != null) {
      const w = Math.max(2, X(r.avg) - m.l);
      const rad = Math.min(4, w / 2);
      // barra con lato dati arrotondato (4px) e base squadrata sull'asse
      g.append(el('path', { class: 'viz-bar', d: `M${m.l} ${y}H${m.l + w - rad}Q${m.l + w} ${y} ${m.l + w} ${y + rad}V${y + bar - rad}Q${m.l + w} ${y + bar} ${m.l + w - rad} ${y + bar}H${m.l}Z` }));
      g.append(el('text', { class: 'viz-label', x: m.l + w + 6, y: y + bar / 2 + 4, 'text-anchor': 'start' }, fmtNum(r.avg)));
    } else {
      g.append(el('text', { class: 'viz-text', x: m.l + 6, y: y + bar / 2 + 4 }, t('insNoRatings')));
    }
    // area sensibile più alta della barra (include lo spazio tra le barre)
    g.append(el('rect', { class: 'viz-hit', x: 0, y: y - gap / 2, width: W, height: bar + gap }));
    const show = () => showTip(f.fig, f.tip, r.avg != null ? X(r.avg) : m.l, y + f.plot.offsetTop, {
      value: r.avg != null ? fmtNum(r.avg) : '—', rest: [r.name, t('insBrewsCount')(r.n) + (r.nRated && r.nRated !== r.n ? ` · ${t('insRatedCount')(r.nRated)}` : '')]
    });
    g.addEventListener('pointerenter', show); g.addEventListener('pointermove', show); g.addEventListener('focus', show);
    g.addEventListener('pointerleave', () => { f.tip.hidden = true; }); g.addEventListener('blur', () => { f.tip.hidden = true; });
    svg.append(g);
  });
  f.plot.append(svg);
}

// Riquadro di sintesi: etichetta, valore, variazione rispetto al periodo precedente (freccia + testo, mai solo il colore)
function tile(label, value, delta, upIsGood = true) {
  const d = html('div', 'viz-tile');
  d.append(html('div', 'viz-tile-lab', label), html('div', 'viz-tile-val', value));
  if (delta) {
    const good = delta.sign === 0 ? null : (delta.sign > 0) === upIsGood;
    d.append(html('div', 'viz-tile-delta' + (good === null ? '' : good ? ' good' : ' bad'), delta.text));
  }
  return d;
}
function deltaOf(cur, prev, days, dec, suffix = '') {
  if (cur == null || prev == null) return null;
  const diff = cur - prev;
  const eps = Math.pow(10, -dec) / 2;
  const sign = Math.abs(diff) < eps ? 0 : diff > 0 ? 1 : -1;
  const arrow = sign > 0 ? '▲' : sign < 0 ? '▼' : '=';
  return { sign, text: `${arrow} ${sign > 0 ? '+' : sign < 0 ? '−' : ''}${fmtNum(Math.abs(diff), dec)}${suffix} ${t('insVsPrev')(days)}` };
}

// ----- Vista -----
export function renderInsights() {
  const card = $('insightsCard');
  if (!card || !card.open) return;
  const all = loadDiary();
  const body = $('insightsBody');
  body.textContent = '';

  if (all.length < 2) {
    body.append(html('div', 'viz-empty', t('insNeedMore')));
    return;
  }

  // Filtri: una sola riga sopra i grafici; l'intervallo di date per primo
  const filters = html('div', 'viz-filters');
  const ranges = html('div', 'viz-chips');
  ranges.setAttribute('role', 'group'); ranges.setAttribute('aria-label', t('insRangeAria'));
  Object.keys(RANGES).forEach(k => {
    const b = html('button', 'diary-filter-chip' + (view.range === k ? ' active' : ''), t(k === 'all' ? 'insAll' : 'insRange' + k));
    b.type = 'button'; b.setAttribute('aria-pressed', String(view.range === k));
    b.addEventListener('click', () => { view.range = k; renderInsights(); });
    ranges.append(b);
  });
  filters.append(ranges);
  const methods = [...new Set(all.map(e => e.method))].filter(k => METHODS[k]);
  if (methods.length > 1) {
    if (view.method && !methods.includes(view.method)) view.method = null;
    const sel = html('select', 'viz-select');
    sel.setAttribute('aria-label', t('insMethodAria'));
    sel.append(new Option(t('insAllMethods'), ''));
    methods.forEach(k => sel.append(new Option(METHODS[k].name, k, false, view.method === k)));
    sel.value = view.method || '';
    sel.addEventListener('change', () => { view.method = sel.value || null; renderInsights(); });
    filters.append(sel);
  } else view.method = null;
  body.append(filters);

  const now = Date.now();
  const sel = { range: view.range, method: view.method };
  const entries = filterEntries(all, sel, now);
  const sm = summary(all, sel, now);

  // Riquadri di sintesi
  const tiles = html('div', 'viz-tiles');
  const pd = sm.prev && sm.prev.n > 0 && sm.days;   // senza infusioni nel periodo precedente il confronto non ha senso
  tiles.append(
    tile(t('insBrews'), String(sm.cur.n), pd ? deltaOf(sm.cur.n, sm.prev.n, sm.days, 0) : null),
    tile(t('insAvgRating'), sm.cur.rating != null ? fmtNum(sm.cur.rating) + '★' : '—', pd ? deltaOf(sm.cur.rating, sm.prev.rating, sm.days, 1) : null),
    tile(t('insAvgEy'), sm.cur.ey != null ? fmtNum(sm.cur.ey) + ' %' : '—',
      sm.cur.measured ? { sign: 0, text: t('insOnTargetCount')(sm.cur.onTarget, sm.cur.measured) } : null));
  body.append(tiles);

  if (!entries.length) { body.append(html('div', 'viz-empty', t('insNoData'))); return; }

  // 1. Voto nel tempo
  const host1 = html('div'); body.append(host1);
  const rs = ratingSeries(entries);
  if (rs.points.length < 2) empty(host1, 'rating', t('insRatingTitle'), t('insRatingEmpty'));
  else {
    const sub = rs.grain === 'brew' ? t('insPerBrew') : rs.grain === 'week' ? t('insPerWeek') : t('insPerMonth');
    const f = figure(host1, 'rating', t('insRatingTitle'), sub);
    const fmtP = p => rs.grain === 'month' ? fmtMonth(p.x) : rs.grain === 'week' ? t('insWeekOf')(fmtDay(p.x)) : fmtDay(p.x, true);
    fillTable(f.tableWrap, [t('insColPeriod'), t('insColRating'), t('insColBrews')], rs.points.map(p => [fmtP(p), fmtNum(p.y), String(p.n)]), t('insRatingTitle'));
    lineChart(f, rs.points, {
      yDomain: [1, 5], yTicks: [1, 2, 3, 4, 5], area: true, grain: rs.grain, label: t('insRatingAria')(rs.points.length),
      tip: p => ({ value: fmtNum(p.y), rest: [fmtP(p), p.label || (p.n > 1 ? t('insBrewsCount')(p.n) : '')] })
    });
  }

  // 2. EY nel tempo, con la fascia target
  const host2 = html('div'); body.append(host2);
  const ey = eySeries(entries);
  if (ey.length < 2) empty(host2, 'ey', t('insEyTitle'), t('insEyEmpty'));
  else {
    const f = figure(host2, 'ey', t('insEyTitle'), t('insEySub'));
    const verdictTxt = p => (p.estimated ? '~' : '') + t('ey_' + p.verdict);
    fillTable(f.tableWrap, [t('insColDate'), t('insColMethod'), 'TDS', 'EY', t('insColVerdict')],
      ey.map(p => [fmtDay(p.x, true), p.label, fmtNum(p.tds, 2) + ' %', (p.estimated ? '~' : '') + fmtNum(p.y) + ' %', t('ey_' + p.verdict)]), t('insEyTitle'));
    const lo = Math.floor((Math.min(...ey.map(p => p.y), EY_TARGET.lo) - 1) / 2) * 2;
    const hi = Math.ceil((Math.max(...ey.map(p => p.y), EY_TARGET.hi) + 1) / 2) * 2;
    const step = hi - lo > 14 ? 4 : 2;
    const ticks = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
    lineChart(f, ey, {
      yDomain: [lo, ticks[ticks.length - 1]], yTicks: ticks, band: [EY_TARGET.lo, EY_TARGET.hi], bandLabel: t('eyTarget')(EY_TARGET.lo, EY_TARGET.hi),
      filled: p => p.verdict === 'ok', label: t('insEyAria')(ey.length),
      tip: p => ({ value: (p.estimated ? '~' : '') + fmtNum(p.y) + ' %', rest: [`${verdictTxt(p)} · TDS ${fmtNum(p.tds, 2)} %`, `${p.label} · ${fmtDay(p.x, true)}`] })
    });
    f.fig.append(html('div', 'viz-key', t('insEyKey')));
  }

  // 3. Voto medio per metodo
  const host3 = html('div'); body.append(host3);
  const ms = methodStats(entries);
  if (ms.length < 2) {
    const only = ms[0];
    const f = figure(host3, 'methods', t('insMethodTitle'));
    f.fig.querySelector('.viz-toggle').remove();
    f.plot.hidden = false; f.tableWrap.hidden = true;
    f.plot.append(tile(only.name, only.avg != null ? fmtNum(only.avg) + '★' : '—', null),
      html('div', 'viz-sub', t('insBrewsCount')(only.n)));
  } else {
    const f = figure(host3, 'methods', t('insMethodTitle'), t('insMethodSub'));
    fillTable(f.tableWrap, [t('insColMethod'), t('insColRating'), t('insColBrews')], ms.map(r => [r.name, r.avg != null ? fmtNum(r.avg) : '—', String(r.n)]), t('insMethodTitle'));
    barChart(f, ms);
  }
}

// I grafici hanno la larghezza reale del contenitore: si ridisegnano solo se cambia la larghezza
let resizeTimer = null, lastWidth = 0;
export function initInsights() {
  $('insightsCard').addEventListener('toggle', renderInsights);
  new ResizeObserver(entries => {
    const w = Math.round(entries[0].contentRect.width);
    if (!$('insightsCard').open || !w || w === lastWidth) return;
    lastWidth = w;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderInsights, 120);
  }).observe($('insightsBody'));
}
