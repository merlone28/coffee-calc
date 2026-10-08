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
      await import('/js/app.js'), await import('/js/grinder.js'), await import('/js/diary.js'), await import('/js/units.js'), await import('/js/extraction.js'));
  });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(base);
});

after(async () => {
  await browser?.close();
  server?.close();
});

// Apre la finestra delle unità, applica le scelte (es. { weight: 'oz', temp: 'f' } o 'imperial'/'metric') e la chiude.
async function setUnits(pg, choice) {
  await pg.click('#unitsBtn');
  if (choice === 'imperial') await pg.click('#unitsPresetImperial');
  else if (choice === 'metric') await pg.click('#unitsPresetMetric');
  else for (const [k, v] of Object.entries(choice)) await pg.click(`#unitsOverlay [data-k="${k}"][data-v="${v}"]`);
  await pg.click('#unitsClose');
}

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

test('unità: convertText converte pesi, volumi e temperature, è idempotente e non tocca i rapporti', async () => {
  const r = await page.evaluate(async () => {
    const { convertText, state } = await window.__mods();
    const out = {};
    const all = { weight: 'oz', volume: 'floz', temp: 'f' };
    state.lang = 'en';
    out.mass = convertText('Pour 60 g of water', all);
    out.range = convertText('Dose 15–18 g', all);
    out.ml = convertText('200 ml cups', all);
    out.temp = convertText('Range 92–96 °C', all);
    out.single = convertText('at 93 °C', all);
    out.label = convertText('Coffee (g) / Water (g / ml)', all);
    out.ratio = convertText('about 60 g/L, 1:15, 12.5 µm, 2:30', all);
    out.twice = convertText(convertText('60 g at 93 °C', all), all);
    out.metric = convertText('60 g at 93 °C', { weight: 'g', volume: 'ml', temp: 'c' });
    // impostazioni indipendenti: solo la temperatura, solo il peso, solo il volume
    out.onlyTemp = convertText('60 g, 200 ml a 93 °C', { weight: 'g', volume: 'ml', temp: 'f' });
    out.onlyWeight = convertText('60 g, 200 ml a 93 °C', { weight: 'oz', volume: 'ml', temp: 'c' });
    out.onlyVolume = convertText('60 g, 200 ml a 93 °C', { weight: 'g', volume: 'floz', temp: 'c' });
    out.labelG = convertText('Coffee (g)', { weight: 'g', volume: 'ml', temp: 'f' });
    state.lang = 'it';
    out.it = convertText('60 g', all);
    return out;
  });
  assert.strictEqual(r.mass, 'Pour 2.12 oz of water');
  assert.strictEqual(r.range, 'Dose 0.53–0.63 oz');
  assert.strictEqual(r.ml, '6.76 fl oz cups');
  assert.strictEqual(r.temp, 'Range 198–205 °F');
  assert.strictEqual(r.single, 'at 199 °F');
  assert.strictEqual(r.label, 'Coffee (oz) / Water (oz)');
  assert.strictEqual(r.ratio, 'about 60 g/L, 1:15, 12.5 µm, 2:30');
  assert.strictEqual(r.twice, '2.12 oz at 199 °F');
  assert.strictEqual(r.metric, '60 g at 93 °C');
  assert.strictEqual(r.it, '2,12 oz');
  assert.strictEqual(r.onlyTemp, '60 g, 200 ml a 199 °F');
  assert.strictEqual(r.onlyWeight, '2.12 oz, 200 ml a 93 °C');
  assert.strictEqual(r.onlyVolume, '60 g, 6.76 fl oz a 93 °C');
  assert.strictEqual(r.labelG, 'Coffee (g)');
});

test('unità imperiali: nessuna quantità metrica resta visibile, e tornando a metriche il testo è identico', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(base);
  const body = () => pg.evaluate(() => document.body.innerText);
  const leftovers = txt => (txt.match(/[^\n]*(\d\s?g\b(?![\/\w])|\d\s?ml\b|°\s?C|\(g\)|\(g \/ ml\))[^\n]*/g) || []).map(l => l.trim());
  const methods = await pg.evaluate(() => [...document.querySelectorAll('#tabs .tab')].map(b => b.dataset.m));

  // istantanea metrica di ogni metodo/ricetta
  const snap = async () => {
    const out = {};
    for (const m of methods) {
      await pg.click(`#tabs .tab[data-m="${m}"]`);
      const n = await pg.locator('.recipe-chip').count();
      for (let i = 0; i < Math.max(n, 1); i++) {
        if (n) await pg.locator('.recipe-chip').nth(i).click();
        out[`${m}/${i}`] = await body();
      }
    }
    return out;
  };
  const metric = await snap();
  await setUnits(pg, 'imperial');
  const imperial = await snap();
  const bad = Object.entries(imperial).flatMap(([k, txt]) => leftovers(txt).map(l => `${k}: ${l}`));
  assert.deepStrictEqual(bad, []);
  assert.match(imperial['v60/0'], /0,71 oz/);
  assert.match(imperial['v60/0'], /201 °F/);

  // le unità si ricordano dopo il ricaricamento
  await pg.reload();
  assert.ok(await pg.evaluate(() => document.getElementById('unitsBtn').classList.contains('on')));
  assert.match(await pg.inputValue('#doseInput'), /^\d+\.\d+$/);

  // ritorno alle metriche: stesso testo di prima
  await setUnits(pg, 'metric');
  assert.ok(await pg.evaluate(() => !document.getElementById('unitsBtn').classList.contains('on')));
  const back = await snap();
  assert.deepStrictEqual(Object.keys(back), Object.keys(metric));
  const diff = Object.keys(metric).filter(k => back[k] !== metric[k]);
  assert.deepStrictEqual(diff, []);
  assert.deepStrictEqual(errs, []);
  await pg.close();
});

test('unità imperiali: i campi accettano once, i dati restano in grammi, le note non vengono convertite', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await pg.goto(base);
  await setUnits(pg, 'imperial');
  await pg.fill('#doseInput', '1');
  await pg.dispatchEvent('#doseInput', 'input');
  const stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-calc-v1')));
  assert.ok(Math.abs(stored.vals.v60.dose - 28.3495) < 0.01, 'dose salvata in grammi');
  assert.deepStrictEqual(stored.units, { weight: 'oz', volume: 'floz', temp: 'f' });
  assert.match(await pg.textContent('#resultBanner'), /1 oz/);

  // diario: la riga è in once, ma la nota dell'utente resta com'è e il dato salvato è metrico
  await pg.click('#diaryAddBtn');
  await pg.fill('#diaryNote', 'macinato 20 g a 93 °C');
  await pg.click('#diarySaveBtn');
  const item = await pg.textContent('#diaryList .diary-item-recipe');
  assert.match(item, /oz/);
  assert.doesNotMatch(item, /\d g\b/);
  assert.match(await pg.textContent('#diaryList .diary-item-note'), /macinato 20 g a 93 °C/);
  const entry = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1'))[0]);
  assert.ok(Math.abs(entry.dose - 28.3495) < 0.01);
  assert.ok(entry.water > 400 && entry.water < 440);
  await pg.close();
});

test('unità imperiali: timer guidato e cold brew mostrano once', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await pg.goto(base);
  await setUnits(pg, 'imperial');
  for (const m of ['v60', 'coldbrew']) {
    await pg.click(`#tabs .tab[data-m="${m}"]`);
    await pg.click('#openTimerBtn');
    const txt = await pg.evaluate(() => document.body.innerText);
    if (m === 'v60') assert.match(txt, /\d oz/, 'v60: once nel timer');
    assert.doesNotMatch(txt, /\d\s?g\b(?![\/\w])/, `${m}: grammi nel timer`);
    assert.doesNotMatch(txt, /°\s?C/, `${m}: °C nel timer`);
    await pg.click('#timerClose');
  }
  await pg.close();
});

test('unità: di default grammi e °C; le impostazioni si cambiano una per una', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await pg.goto(base);
  // default: tutto metrico, nessun salvataggio necessario
  assert.strictEqual(await pg.inputValue('#doseInput'), '20');
  assert.match(await pg.textContent('#resultBanner'), /20 g/);
  assert.match(await pg.textContent('#tempVal'), /°C/);
  assert.ok(await pg.evaluate(() => !document.getElementById('unitsBtn').classList.contains('on')));

  // solo la temperatura in °F: i grammi restano
  await setUnits(pg, { temp: 'f' });
  assert.match(await pg.textContent('#tempVal'), /°F/);
  assert.match(await pg.textContent('#resultBanner'), /20 g/);
  assert.strictEqual(await pg.inputValue('#doseInput'), '20');
  assert.doesNotMatch(await pg.evaluate(() => document.getElementById('mSteps').innerText), /°C/);
  assert.match(await pg.textContent('#doseLabel'), /\(g\)/);

  // solo il peso in once: la temperatura resta in °F, il volume in ml
  await setUnits(pg, { weight: 'oz' });
  assert.match(await pg.textContent('#doseLabel'), /\(oz\)/);
  assert.match(await pg.textContent('#resultBanner'), /0,71 oz/);
  assert.match(await pg.textContent('#tempVal'), /°F/);

  // si torna ai grammi mantenendo i °F
  await setUnits(pg, { weight: 'g' });
  assert.strictEqual(await pg.inputValue('#doseInput'), '20');
  assert.match(await pg.textContent('#tempVal'), /°F/);
  const stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-calc-v1')).units);
  assert.deepStrictEqual(stored, { weight: 'g', volume: 'ml', temp: 'f' });

  // stato salvato malformato (es. valore vecchio): si torna ai default senza errori
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('coffee-brew-calc-v1')); s.units = 'imperial'; localStorage.setItem('coffee-brew-calc-v1', JSON.stringify(s)); });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.reload();
  assert.strictEqual(await pg.inputValue('#doseInput'), '20');
  assert.match(await pg.textContent('#tempVal'), /°C/);
  assert.deepStrictEqual(errs, []);
  await pg.close();
});

test('TDS/EY: formule, stima della bevanda e giudizio', async () => {
  const r = await page.evaluate(async () => {
    const { extractionYield, estimateOut, eyVerdict, entryExtraction, sanitizeEntry } = await window.__mods();
    const base = { methodName: 'V60', dose: 20, water: 300, ratio: 15 };
    return {
      ey: extractionYield(1.4, 20, 280),
      est: estimateOut(300, 20),
      bad: [extractionYield(0, 20, 280), extractionYield(1.4, 0, 280), extractionYield(1.4, 20, 0)],
      verdicts: [eyVerdict(17.99), eyVerdict(18), eyVerdict(22), eyVerdict(22.01)],
      weighed: entryExtraction({ ...base, tds: 1.4, out: 280 }),
      estimated: entryExtraction({ ...base, tds: 1.4 }),
      none: entryExtraction({ ...base }),
      kept: sanitizeEntry({ ...base, tds: 1.38, out: 285 }),
      dropped: [sanitizeEntry({ ...base, tds: -1 }).tds, sanitizeEntry({ ...base, tds: 99 }).tds, sanitizeEntry({ ...base, tds: 'x', out: 0 }).out]
    };
  });
  assert.ok(Math.abs(r.ey - 19.6) < 1e-9);
  assert.strictEqual(r.est, 260);
  assert.deepStrictEqual(r.bad, [null, null, null]);
  assert.deepStrictEqual(r.verdicts, ['under', 'ok', 'ok', 'over']);
  assert.strictEqual(r.weighed.estimated, false);
  assert.strictEqual(r.weighed.verdict, 'ok');
  assert.strictEqual(r.estimated.estimated, true);
  assert.ok(Math.abs(r.estimated.ey - 18.2) < 1e-9);
  assert.strictEqual(r.none, null);
  assert.deepStrictEqual([r.kept.tds, r.kept.out], [1.38, 285]);
  assert.deepStrictEqual(r.dropped, [undefined, undefined, undefined]);
});

test('TDS/EY: modulo del diario, elenco, modifica e confronto', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(base);
  const preview = () => pg.evaluate(() => { const b = document.getElementById('diaryEyPreview'); return b.classList.contains('hidden') ? '' : b.textContent; });

  // senza TDS: nessuna anteprima, la voce si salva come prima
  await pg.click('#diaryAddBtn');
  assert.strictEqual(await preview(), '');
  await pg.click('#diarySaveBtn');
  let stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1')));
  assert.strictEqual(stored[0].tds, undefined);
  assert.strictEqual(await pg.locator('.diary-item-ey').count(), 0);

  // TDS + bevanda pesata: 1,38 % × 285 g / 20 g = 19,7 %
  await pg.click('#diaryAddBtn');
  await pg.fill('#diaryTds', '1.38');
  await pg.fill('#diaryOut', '285');
  assert.match(await preview(), /EY 19,7 % · nel target \(target SCA 18–22 %\)/);
  await pg.click('#diarySaveBtn');
  stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1')));
  assert.deepStrictEqual([stored[0].tds, stored[0].out], [1.38, 285]);
  assert.match(await pg.textContent('#diaryList .diary-item-ey'), /TDS 1,38 % · EY 19,7 % · nel target/);

  // solo TDS: bevanda stimata (300 − 2×20 = 260 g) e consiglio se sotto-estratto
  await pg.click('#diaryAddBtn');
  await pg.fill('#diaryTds', '1.1');
  const est = await preview();
  assert.match(est, /EY ~14,3 % · sotto-estratto/);
  assert.match(est, /più fine/);
  assert.match(est, /stimata/);
  await pg.click('#diarySaveBtn');
  assert.match(await pg.locator('#diaryList .diary-item-ey').first().textContent(), /EY ~14,3 %/);

  // modifica di una voce esistente: aggiunge il TDS dopo
  await pg.locator('#diaryList .diary-edit').last().click();
  assert.strictEqual(await pg.inputValue('#diaryTds'), '');
  await pg.fill('#diaryTds', '1.6');
  await pg.fill('#diaryOut', '280');
  assert.match(await preview(), /EY 22,4 % · sovra-estratto/);
  await pg.click('#diarySaveBtn');
  stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1')));
  assert.ok(stored.some(e => e.tds === 1.6 && e.out === 280));

  // confronto: mostra TDS ed EY
  await pg.click('#diaryCompareBtn');
  await pg.locator('.diary-compare-check').nth(0).click();
  await pg.locator('.diary-compare-check').nth(1).click();
  await pg.waitForSelector('#compareOverlay.show');
  const cmp = await pg.textContent('#compareGrid');
  assert.match(cmp, /TDS/);
  assert.match(cmp, /EY/);
  assert.deepStrictEqual(errs, []);
  await pg.close();
});

test('TDS/EY: con le once il campo bevanda è in once ma si salva in grammi', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await pg.goto(base);
  await setUnits(pg, { weight: 'oz' });
  await pg.click('#diaryAddBtn');
  assert.match(await pg.textContent('#diaryOutLabel'), /\(oz\)/);
  await pg.fill('#diaryTds', '1.38');
  await pg.fill('#diaryOut', '10');          // 10 oz = 283,5 g
  assert.match(await pg.textContent('#diaryEyPreview'), /EY 19,6 %/);
  await pg.click('#diarySaveBtn');
  const e = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1'))[0]);
  assert.ok(Math.abs(e.out - 283.495) < 0.01);
  await pg.close();
});
