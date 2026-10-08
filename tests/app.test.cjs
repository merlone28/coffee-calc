// Test della logica dell'app nel browser reale (l'app è un singolo index.html).
// Uso: npm install && npm test   (serve Chromium: npx playwright install chromium)
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
let server, browser, page, base;

before(async () => {
  server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox']
  });
  page = await browser.newPage({ locale: 'it-IT' });
  // L'app è fatta di moduli ES: i test importano le stesse istanze (singleton) usate dalla pagina.
  await page.addInitScript(() => {
    window.__mods = async () => Object.assign({},
      await import('/js/core.js'), await import('/js/data/methods.js'), await import('/js/i18n.js'),
      await import('/js/app.js'), await import('/js/grinder.js'), await import('/js/diary.js'));
  });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(base);
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('la pagina si carica senza errori JS', () => {
  assert.deepStrictEqual(page.errors, []);
});

test('ogni metodo: rapporto di default nel range, dose valida', async () => {
  const bad = await page.evaluate(async () => { const { METHODS } = await window.__mods(); return Object.entries(METHODS).filter(([k, m]) =>
    !(m.dose > 0 && m.ratio >= m.min && m.ratio <= m.max)).map(([k]) => k); });
  assert.deepStrictEqual(bad, []);
});

test('procedure e timer: nessun NaN/undefined, tempi crescenti (IT e EN)', async () => {
  const problems = await page.evaluate(async () => {
    const { METHODS, state, mSteps, mTimerCfg } = await window.__mods();
    const out = [];
    for (const lang of ['it', 'en']) {
      state.lang = lang;
      for (const [key, m] of Object.entries(METHODS)) {
        const d = m.dose, w = Math.round(d * m.ratio);
        for (const mode of ['conc', 'rtd']) {
          state.cbMode = mode;
          const steps = mSteps(key, d, w, mode);
          if (!Array.isArray(steps) || !steps.length) out.push(`${lang}/${key}: nessuno step`);
          steps.forEach(s => /NaN|undefined|Infinity/.test(s) && out.push(`${lang}/${key}/${mode}: "${s}"`));
          const cfg = mTimerCfg(key, d, w, mode);
          if (cfg && cfg.steps) {
            let prev = -1;
            cfg.steps.forEach(s => {
              if (s.at < prev) out.push(`${lang}/${key}: timer non crescente`);
              if (cfg.total && s.at > cfg.total) out.push(`${lang}/${key}: step oltre il totale`);
              prev = s.at;
            });
          }
        }
      }
    }
    state.lang = 'it';
    return out;
  });
  assert.deepStrictEqual(problems, []);
});

test('macinini: start dentro il range, formato giri.numero.click reversibile', async () => {
  const problems = await page.evaluate(async () => {
    const { METHODS, GRINDERS, gSuggest, gParse, gFmtPos } = await window.__mods();
    const out = [];
    for (const [gk, g] of Object.entries(GRINDERS)) {
      for (const key of Object.keys(METHODS)) {
        const s = gSuggest(gk, key);
        if (s && !(s.lo <= s.start && s.start <= s.hi)) out.push(`${gk}/${key}: start fuori range`);
      }
      for (let c = 0; c <= 300; c++) {
        if (gParse(g, gFmtPos(g, c)) !== c) { out.push(`${gk}: ${c} -> ${gFmtPos(g, c)} non reversibile`); break; }
      }
      if (gParse(g, 'abc') !== null || gParse(g, '1.99.0') !== null) out.push(`${gk}: input non valido accettato`);
    }
    return out;
  });
  assert.deepStrictEqual(problems, []);
});

test('sanitizeEntry: scarta voci invalide e limita i range', async () => {
  const r = await page.evaluate(async () => { const { sanitizeEntry } = await window.__mods(); return ({
    noMethod: sanitizeEntry({ dose: 18, water: 270, ratio: 15 }),
    negDose: sanitizeEntry({ methodName: 'x', dose: -1, water: 1, ratio: 1 }),
    huge: sanitizeEntry({ methodName: 'x', dose: 18, water: 270, ratio: 15, rating: 1e9 }),
    evil: sanitizeEntry({ methodName: 'ok', dose: 18, water: 270, ratio: 15, id: 'a"><script>', temp: '<b>', extra: 1 }),
    good: sanitizeEntry({ methodName: 'V60', dose: 18, water: 270, ratio: 15, rating: 4, temp: 93, id: 7, date: '2026-01-02T00:00:00Z', method: 'v60' })
  }); });
  assert.strictEqual(r.noMethod, null);
  assert.strictEqual(r.negDose, null);
  assert.strictEqual(r.huge.rating, 0);
  assert.strictEqual(r.evil.id, 'ascript');
  assert.strictEqual(r.evil.temp, undefined);
  assert.strictEqual(r.evil.extra, undefined);
  assert.deepStrictEqual(
    [r.good.id, r.good.rating, r.good.temp, r.good.method, r.good.date],
    [7, 4, 93, 'v60', '2026-01-02T00:00:00.000Z']);
});

test('import del diario: HTML iniettato non viene eseguito né inserito', async () => {
  const payload = { diary: [{ methodName: '<img src=x onerror="window.__xss=1">', dose: 18, water: 270, ratio: 15,
    rating: 3, id: '1" onmouseover="window.__xss=1', temp: '<img src=x onerror="window.__xss=1">' }] };
  await page.evaluate(() => localStorage.removeItem('coffee-brew-diary-v1'));
  await page.reload();
  await page.setInputFiles('#diaryImportFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('#diaryList img').length,
    items: document.querySelectorAll('#diaryList .diary-item').length }));
  assert.strictEqual(res.xss, undefined);
  assert.strictEqual(res.imgs, 0);
  assert.strictEqual(res.items, 1);
});

test('accessibilità: pulsanti solo-icona con nome, tab con ruolo, input con etichetta', async () => {
  await page.reload();
  const res = await page.evaluate(() => {
    const unnamed = [...document.querySelectorAll('button')].filter(b =>
      b.offsetParent !== null && !b.textContent.trim() && !b.getAttribute('aria-label') && !b.title).map(b => b.id || b.className);
    const tab = document.querySelector('#tabs .tab.active');
    return {
      unnamed,
      tabRole: tab && tab.getAttribute('role'), tabSel: tab && tab.getAttribute('aria-selected'),
      doseLabelled: document.querySelector('label[for="doseInput"]') !== null,
      closeLabel: document.getElementById('timerClose').getAttribute('aria-label')
    };
  });
  assert.deepStrictEqual(res.unnamed, []);
  assert.strictEqual(res.tabRole, 'tab');
  assert.strictEqual(res.tabSel, 'true');
  assert.ok(res.doseLabelled);
  assert.strictEqual(res.closeLabel, 'Chiudi');
  assert.deepStrictEqual(page.errors, []);
});

test('asset caricati: font e CSS risolti (nessuna richiesta fallita)', async () => {
  const failed = [];
  const p2 = await browser.newPage();
  p2.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
  await p2.goto(base);
  await p2.evaluate(() => document.fonts.ready);
  const loaded = await p2.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').length);
  await p2.close();
  assert.deepStrictEqual(failed, []);
  assert.ok(loaded >= 1);
});

test('lingua iniziale: segue il browser alla prima visita, rispetta la scelta salvata', async () => {
  const run = async (locale, preset) => {
    const ctx = await browser.newContext({ locale });
    const pg = await ctx.newPage();
    if (preset) await pg.addInitScript(p => localStorage.setItem('coffee-brew-calc-v1', JSON.stringify(p)), preset);
    await pg.goto(base);
    const r = await pg.evaluate(() => ({ btn: document.getElementById('langBtn').textContent, html: document.documentElement.lang,
      saved: JSON.parse(localStorage.getItem('coffee-brew-calc-v1') || 'null') }));
    await ctx.close();
    return r;
  };
  assert.strictEqual((await run('en-US')).btn, 'EN');
  assert.strictEqual((await run('it-IT')).btn, 'IT');
  assert.strictEqual((await run('fr-FR')).html, 'en');
  // scelta già salvata: il browser inglese non la sovrascrive
  assert.strictEqual((await run('en-US', { method: 'v60', lang: 'it', vals: {} })).btn, 'IT');
  assert.strictEqual((await run('it-IT', { method: 'v60', lang: 'en', vals: {} })).btn, 'EN');
});

test('detectLang: prima lingua supportata, altrimenti inglese', async () => {
  const r = await page.evaluate(async () => {
    const { detectLang } = await window.__mods();
    return [detectLang(['it-IT', 'en']), detectLang(['fr-FR', 'it']), detectLang(['EN_gb']), detectLang(['de', 'fr']), detectLang([]), detectLang(undefined)];
  });
  assert.deepStrictEqual(r, ['it', 'it', 'en', 'en', 'en', 'en']);
});

test('diario: avviso vicino al limite di 100 voci e quando una voce viene scartata', async () => {
  const mk = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, date: new Date(2026, 0, 1, 0, i).toISOString(),
    method: 'v60', methodName: 'Hario V60', dose: 20, water: 300, ratio: 15, rating: 3, note: '' })).reverse();
  const open = async n => {
    const pg = await browser.newPage({ locale: 'it-IT' });
    await pg.addInitScript(d => localStorage.setItem('coffee-brew-diary-v1', JSON.stringify(d)), mk(n));
    await pg.goto(base);
    return pg;
  };
  const note = pg => pg.evaluate(() => ({ hidden: document.getElementById('diaryLimitNote').classList.contains('hidden'),
    text: document.getElementById('diaryLimitText').textContent }));

  let pg = await open(89);
  assert.strictEqual((await note(pg)).hidden, true);
  await pg.close();

  pg = await open(92);
  let n = await note(pg);
  assert.strictEqual(n.hidden, false);
  assert.match(n.text, /92/);
  assert.match(n.text, /100/);
  await pg.close();

  // diario pieno: salvare una nuova voce scarta la più vecchia e lo dice
  pg = await open(100);
  n = await note(pg);
  assert.match(n.text, /pieno/i);
  await pg.click('#diaryAddBtn');
  await pg.click('#diarySaveBtn');
  const toast = await pg.textContent('#toast');
  assert.match(toast, /eliminata/);
  const stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1')));
  assert.strictEqual(stored.length, 100);
  assert.ok(!stored.some(e => e.id === 1), 'la voce più vecchia (id 1) deve essere stata scartata');
  await pg.close();

  // sotto il limite: nessun avviso di scarto
  pg = await open(50);
  await pg.click('#diaryAddBtn');
  await pg.click('#diarySaveBtn');
  assert.doesNotMatch(await pg.textContent('#toast'), /eliminata/);
  await pg.close();

  // inglese
  const ctx = await browser.newContext({ locale: 'en-US' });
  pg = await ctx.newPage();
  await pg.addInitScript(d => localStorage.setItem('coffee-brew-diary-v1', JSON.stringify(d)), mk(95));
  await pg.goto(base);
  assert.match((await note(pg)).text, /keeps the latest 100/);
  await ctx.close();
});

test('diario: l\'import oltre il limite avvisa quante voci non sono state conservate', async () => {
  const entry = i => ({ id: 1000 + i, date: new Date(2026, 5, 1, 0, i).toISOString(), methodName: 'Hario V60', dose: 20, water: 300, ratio: 15 });
  const existing = Array.from({ length: 95 }, (_, i) => ({ ...entry(i), id: i + 1, date: new Date(2026, 0, 1, 0, i).toISOString() }));
  const pg = await browser.newPage({ locale: 'it-IT' });
  await pg.addInitScript(d => localStorage.setItem('coffee-brew-diary-v1', JSON.stringify(d)), existing);
  await pg.goto(base);
  const incoming = { diary: Array.from({ length: 10 }, (_, i) => entry(i)) };
  await pg.setInputFiles('#diaryImportFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await pg.waitForFunction(() => /importat/.test(document.getElementById('toast').textContent));
  const toast = await pg.textContent('#toast');
  assert.match(toast, /5 più vecchi oltre il limite di 100/);
  const stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1')));
  assert.strictEqual(stored.length, 100);
  await pg.close();
});
