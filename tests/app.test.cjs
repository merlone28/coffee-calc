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
let swSuffix = '';   // accodato a sw.js per simulare una nuova versione del service worker

before(async () => {
  server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (path.basename(f) === 'sw.js') return res.end(fs.readFileSync(f, 'utf8') + swSuffix);
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
      await import('/js/app.js'), await import('/js/grinder.js'), await import('/js/diary.js'), await import('/js/units.js'), await import('/js/extraction.js'), await import('/js/insights.js'), await import('/js/diary-sync.js'));
  });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await go(page);
});

after(async () => {
  await browser?.close();
  server?.close();
});

// L'app parte in modo asincrono (il diario si carica da IndexedDB): si attende `data-ready` su <html>
async function go(pg) { await pg.goto(base); await pg.waitForSelector('html[data-ready]', { state: 'attached' }); }
async function reload(pg) { await pg.reload(); await pg.waitForSelector('html[data-ready]', { state: 'attached' }); }
// Contenuto reale di IndexedDB (dopo aver atteso le scritture in corso), dalla voce più recente
async function readDiaryDB(pg) {
  return pg.evaluate(async () => {
    await (await import('/js/diary-store.js')).flushDiary();
    const db = await new Promise((res, rej) => { const r = indexedDB.open('coffee-calc', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = await new Promise((res, rej) => { const r = db.transaction('diary').objectStore('diary').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  });
}
// Diario "vecchio" in localStorage (come lo salvava la versione precedente), inserito una sola volta per pagina
// Attende le scritture in corso nell'archivio (un ricaricamento nello stesso millisecondo del salvataggio le annullerebbe)
const settle = pg => pg.evaluate(async () => (await import('/js/diary-store.js')).flushDiary());
const seedLegacy = (pg, entries) => pg.addInitScript(d => {
  if (!localStorage.getItem('__seeded')) { localStorage.setItem('coffee-brew-diary-v1', JSON.stringify(d)); localStorage.setItem('__seeded', '1'); }
}, entries);
const mkEntries = (n, startId = 1) => Array.from({ length: n }, (_, i) => ({ id: startId + i, date: new Date(2026, 0, 1, 0, i).toISOString(),
  method: 'v60', methodName: 'Hario V60', dose: 20, water: 300, ratio: 15, rating: 3, note: '' }));

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
  await page.evaluate(async () => { const m = await import('/js/diary-store.js'); m.setDiary([]); await m.flushDiary(); });
  await reload(page);
  await page.setInputFiles('#diaryImportFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('#diaryList img').length,
    items: document.querySelectorAll('#diaryList .diary-item').length }));
  assert.strictEqual(res.xss, undefined);
  assert.strictEqual(res.imgs, 0);
  assert.strictEqual(res.items, 1);
});

test('accessibilità: pulsanti solo-icona con nome, tab con ruolo, input con etichetta', async () => {
  await reload(page);
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
  await go(p2);
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
    await go(pg);
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

test('diario IndexedDB: migrazione dal vecchio localStorage, senza duplicati né voci non valide', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await seedLegacy(pg, [...mkEntries(3), { id: 99, methodName: '', dose: 1 }, { dose: 18 }]);
  await go(pg);
  const stored = await readDiaryDB(pg);
  assert.deepStrictEqual(stored.map(e => e.id).sort(), [1, 2, 3]);
  assert.strictEqual(await pg.evaluate(() => localStorage.getItem('coffee-brew-diary-v1')), null, 'la vecchia copia viene eliminata');
  assert.strictEqual(await pg.locator('#diaryList .diary-item').count(), 3);
  assert.ok(await pg.evaluate(() => document.getElementById('diaryStorageNote').classList.contains('hidden')));

  // una copia vecchia rimasta (es. migrazione interrotta) non duplica le voci già migrate
  await pg.evaluate(d => localStorage.setItem('coffee-brew-diary-v1', JSON.stringify(d)), mkEntries(4));
  await reload(pg);
  assert.deepStrictEqual((await readDiaryDB(pg)).map(e => e.id).sort(), [1, 2, 3, 4]);
  assert.strictEqual(await pg.evaluate(() => localStorage.getItem('coffee-brew-diary-v1')), null);
  assert.deepStrictEqual(errs, []);
  await pg.close();
});

test('diario IndexedDB: nessun limite di 100 voci, elenco a pagine', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await seedLegacy(pg, mkEntries(150));
  await go(pg);
  assert.strictEqual((await readDiaryDB(pg)).length, 150);
  assert.strictEqual(await pg.locator('#diaryList .diary-item').count(), 50);
  assert.strictEqual(await pg.textContent('.dstat-val'), '150');
  assert.match(await pg.textContent('#diaryMore'), /Mostra altre 50/);
  await pg.click('#diaryMore');
  assert.strictEqual(await pg.locator('#diaryList .diary-item').count(), 100);
  await pg.click('#diaryMore');
  assert.strictEqual(await pg.locator('#diaryList .diary-item').count(), 150);
  assert.ok(await pg.evaluate(() => document.getElementById('diaryMore').classList.contains('hidden')));

  // salvare una nuova infusione non scarta più nulla
  await pg.click('#diaryAddBtn');
  await pg.click('#diarySaveBtn');
  const after = await readDiaryDB(pg);
  assert.strictEqual(after.length, 151);
  assert.ok(after.some(e => e.id === 1), 'la voce più vecchia è ancora lì');
  await pg.close();
});

test('diario IndexedDB: aggiunte, modifiche ed eliminazioni restano dopo il ricaricamento', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await go(pg);
  await pg.click('#diaryAddBtn');
  await pg.fill('#diaryNote', 'prima');
  await pg.click('#diarySaveBtn');
  await pg.click('#diaryAddBtn');
  await pg.fill('#diaryNote', 'seconda');
  await pg.click('#diarySaveBtn');
  assert.strictEqual((await readDiaryDB(pg)).length, 2);

  await settle(pg);
  await reload(pg);
  assert.strictEqual(await pg.locator('#diaryList .diary-item').count(), 2);

  // modifica della prima voce in elenco (la più recente)
  await pg.locator('#diaryList .diary-edit').first().click();
  await pg.fill('#diaryNote', 'seconda, modificata');
  await pg.click('#diarySaveBtn');
  await settle(pg);
  await reload(pg);
  assert.match(await pg.textContent('#diaryList .diary-item-note'), /seconda, modificata/);

  // eliminazione (doppio tocco di conferma)
  await pg.locator('#diaryList .diary-del').first().click();
  await pg.locator('#diaryList .diary-del.confirm').first().click();
  await settle(pg);
  await reload(pg);
  assert.strictEqual(await pg.locator('#diaryList .diary-item').count(), 1);
  const left = await readDiaryDB(pg);
  assert.strictEqual(left.length, 1);
  assert.strictEqual(left[0].note, 'prima');
  await pg.close();
});

test('diario IndexedDB: senza IndexedDB ricade su localStorage e avvisa che è più fragile', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await pg.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }));
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await go(pg);
  assert.ok(await pg.evaluate(() => !document.getElementById('diaryStorageNote').classList.contains('hidden')));
  assert.match(await pg.textContent('#diaryStorageText'), /backup/);
  await pg.click('#diaryAddBtn');
  await pg.fill('#diaryNote', 'senza idb');
  await pg.click('#diarySaveBtn');
  await pg.evaluate(async () => (await import('/js/diary-store.js')).flushDiary());
  const ls = await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-diary-v1')));
  assert.strictEqual(ls.length, 1);
  await reload(pg);
  assert.match(await pg.textContent('#diaryList .diary-item-note'), /senza idb/);
  assert.deepStrictEqual(errs, []);
  await pg.close();
});

test('diario IndexedDB: l\'import non ha più il limite di 100 voci', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await seedLegacy(pg, mkEntries(95));
  await go(pg);
  const incoming = { diary: mkEntries(10, 1000).map(e => ({ ...e, date: new Date(2026, 5, 1, 0, e.id - 1000).toISOString() })) };
  await pg.setInputFiles('#diaryImportFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await pg.waitForFunction(() => /importat/.test(document.getElementById('toast').textContent));
  assert.doesNotMatch(await pg.textContent('#toast'), /oltre il limite/);
  assert.strictEqual((await readDiaryDB(pg)).length, 105);
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
  await go(pg);
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
  await reload(pg);
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
  await go(pg);
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
  const entry = (await readDiaryDB(pg))[0];
  assert.ok(Math.abs(entry.dose - 28.3495) < 0.01);
  assert.ok(entry.water > 400 && entry.water < 440);
  await pg.close();
});

test('unità imperiali: timer guidato e cold brew mostrano once', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await go(pg);
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
  await go(pg);
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
  await reload(pg);
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
  await go(pg);
  const preview = () => pg.evaluate(() => { const b = document.getElementById('diaryEyPreview'); return b.classList.contains('hidden') ? '' : b.textContent; });

  // senza TDS: nessuna anteprima, la voce si salva come prima
  await pg.click('#diaryAddBtn');
  assert.strictEqual(await preview(), '');
  await pg.click('#diarySaveBtn');
  let stored = await readDiaryDB(pg);
  assert.strictEqual(stored[0].tds, undefined);
  assert.strictEqual(await pg.locator('.diary-item-ey').count(), 0);

  // TDS + bevanda pesata: 1,38 % × 285 g / 20 g = 19,7 %
  await pg.click('#diaryAddBtn');
  await pg.fill('#diaryTds', '1.38');
  await pg.fill('#diaryOut', '285');
  assert.match(await preview(), /EY 19,7 % · nel target \(target SCA 18–22 %\)/);
  await pg.click('#diarySaveBtn');
  stored = await readDiaryDB(pg);
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
  stored = await readDiaryDB(pg);
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
  await go(pg);
  await setUnits(pg, { weight: 'oz' });
  await pg.click('#diaryAddBtn');
  assert.match(await pg.textContent('#diaryOutLabel'), /\(oz\)/);
  await pg.fill('#diaryTds', '1.38');
  await pg.fill('#diaryOut', '10');          // 10 oz = 283,5 g
  assert.match(await pg.textContent('#diaryEyPreview'), /EY 19,6 %/);
  await pg.click('#diarySaveBtn');
  const e = (await readDiaryDB(pg))[0];
  assert.ok(Math.abs(e.out - 283.495) < 0.01);
  await pg.close();
});

test('aggiornamento: la prima installazione non mostra il banner né ricarica; una nuova versione lo mostra e si applica solo al tocco', async () => {
  swSuffix = '';
  const ctx = await browser.newContext({ locale: 'it-IT' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await go(pg);
  await pg.evaluate(() => { window.__marker = 'prima-versione'; });
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.waitForFunction(() => navigator.serviceWorker.controller);   // il SW ha preso il controllo (clients.claim)
  await pg.waitForTimeout(500);
  assert.strictEqual(await pg.evaluate(() => window.__marker), 'prima-versione', 'la prima installazione non deve ricaricare la pagina');
  assert.ok(await pg.evaluate(() => document.getElementById('updateBanner').classList.contains('hidden')));

  // esce una nuova versione di sw.js: resta in attesa e compare il banner, senza ricaricare
  swSuffix = '\n// nuova versione 1\n';
  await pg.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await pg.waitForSelector('#updateBanner:not(.hidden)');
  assert.match(await pg.textContent('#updateBannerText'), /Nuova versione disponibile/);
  assert.strictEqual(await pg.textContent('#updateBtn'), 'Aggiorna');
  assert.strictEqual(await pg.evaluate(() => window.__marker), 'prima-versione', 'non si ricarica da sola');
  assert.ok(await pg.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), 'la nuova versione è in attesa');

  // ricaricando senza toccare il banner, la versione in attesa viene riproposta
  await reload(pg);
  await pg.waitForSelector('#updateBanner:not(.hidden)');
  await pg.evaluate(() => { window.__marker = 'prima-del-tocco'; });

  // il tocco attiva la nuova versione e ricarica la pagina
  const reloaded = pg.waitForEvent('load');
  await pg.click('#updateBtn');
  await reloaded;
  await pg.waitForSelector('html[data-ready]', { state: 'attached' });
  assert.strictEqual(await pg.evaluate(() => window.__marker), undefined, 'la pagina è stata ricaricata');
  const reg = await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { waiting: !!r.waiting, active: r.active && r.active.state }; });
  assert.deepStrictEqual(reg, { waiting: false, active: 'activated' });
  assert.ok(await pg.evaluate(() => document.getElementById('updateBanner').classList.contains('hidden')));
  assert.deepStrictEqual(errs, []);
  swSuffix = '';
  await ctx.close();
});

test('aggiornamento: il tocco funziona anche nella prima sessione, senza ricaricare prima', async () => {
  swSuffix = '';
  const ctx = await browser.newContext({ locale: 'it-IT' });
  const pg = await ctx.newPage();
  await go(pg);
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.waitForFunction(() => navigator.serviceWorker.controller);
  await pg.evaluate(() => { window.__marker = 'sessione-1'; });

  swSuffix = '\n// nuova versione 2\n';
  await pg.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await pg.waitForSelector('#updateBanner:not(.hidden)');
  const reloaded = pg.waitForEvent('load', { timeout: 10000 });
  await pg.click('#updateBtn');
  await reloaded;
  await pg.waitForSelector('html[data-ready]', { state: 'attached' });
  assert.strictEqual(await pg.evaluate(() => window.__marker), undefined, 'la pagina deve ricaricarsi dopo il tocco');
  swSuffix = '';
  await ctx.close();
});

// ----- Andamento nel tempo -----
const DAY_MS = 86400000;
// Voci di prova relative a "adesso": giorni fa, metodo, voto, TDS opzionale
const mkInsight = specs => specs.map(([daysAgo, method, rating, tds], i) => ({
  id: i + 1, date: new Date(Date.now() - daysAgo * DAY_MS).toISOString(), method, methodName: { v60: 'Hario V60', moka: 'Moka', aeropress: 'AeroPress' }[method],
  dose: 20, water: 300, ratio: 15, rating, note: '', ...(tds ? { tds, out: 280 } : {})
}));

test('andamento: calcoli di filtro, serie, metodi e sintesi', async () => {
  const r = await page.evaluate(async (DAY) => {
    const { filterEntries, ratingSeries, eySeries, methodStats, summary } = await window.__mods();
    const now = Date.now();
    const e = (d, method, rating, extra = {}) => ({ id: Math.random(), date: new Date(now - d * DAY).toISOString(), method, methodName: method, dose: 20, water: 300, ratio: 15, rating, ...extra });
    const diary = [e(2, 'v60', 4, { tds: 1.4, out: 280 }), e(10, 'v60', 5), e(40, 'moka', 3), e(100, 'v60', 0), e(200, 'moka', 2, { tds: 1.0, out: 280 })];
    const out = {};
    out.r30 = filterEntries(diary, { range: '30' }, now).length;
    out.r90 = filterEntries(diary, { range: '90' }, now).length;
    out.all = filterEntries(diary, { range: 'all' }, now).length;
    out.moka = filterEntries(diary, { method: 'moka' }, now).length;
    out.perBrew = ratingSeries(diary);
    // tante infusioni in poche settimane -> media settimanale; su molti mesi -> media mensile
    const many = (n, spacing) => Array.from({ length: n }, (_, i) => e(i * spacing, 'v60', 1 + (i % 5)));
    out.weekGrain = ratingSeries(many(40, 2)).grain;
    out.monthGrain = ratingSeries(many(40, 10)).grain;
    out.weekPoints = ratingSeries(many(40, 2)).points.every(p => p.n >= 1) && ratingSeries(many(40, 2)).points.reduce((s, p) => s + p.n, 0);
    out.ey = eySeries(diary).map(p => [Math.round(p.y * 10) / 10, p.verdict]);
    out.methods = methodStats(diary).map(m => [m.method, m.n, m.nRated, m.avg]);
    out.sumAll = summary(diary, { range: 'all' }, now);
    out.sum30 = summary(diary, { range: '30' }, now);
    out.sum90 = summary(diary, { range: '90' }, now);
    return out;
  }, DAY_MS);
  assert.deepStrictEqual([r.r30, r.r90, r.all, r.moka], [2, 3, 5, 2]);
  assert.deepStrictEqual(r.perBrew.points.map(p => p.y), [2, 3, 5, 4], 'voti in ordine di data, senza i non votati');
  assert.strictEqual(r.perBrew.grain, 'brew');
  assert.strictEqual(r.weekGrain, 'week');
  assert.strictEqual(r.monthGrain, 'month');
  assert.strictEqual(r.weekPoints, 40, 'la media settimanale non perde infusioni');
  assert.strictEqual(r.ey.length, 2);
  assert.strictEqual(r.ey[0][1], 'under');          // la più vecchia: TDS 1.0 × 280 / 20 = 14 %
  assert.strictEqual(r.ey[1][1], 'ok');             // la più recente: 19,6 %
  assert.deepStrictEqual(r.methods.map(m => m[0]), ['v60', 'moka'], 'ordinati per voto medio');
  assert.deepStrictEqual(r.methods[0].slice(1), [3, 2, 4.5]);
  assert.deepStrictEqual(r.methods[1].slice(1), [2, 2, 2.5]);
  assert.strictEqual(r.sumAll.prev, null, 'con "tutto" non c\'è un periodo precedente');
  assert.deepStrictEqual([r.sum30.cur.n, r.sum30.prev.n], [2, 1]);       // 30 gg: 2; i 30 precedenti (30–60): la voce di 40 giorni fa
  assert.deepStrictEqual([r.sum90.cur.n, r.sum90.prev.n], [3, 1]);
  assert.strictEqual(r.sum30.cur.rating, 4.5);
  assert.strictEqual(r.sum30.prev.rating, 3);
});

test('andamento: filtri, riquadri, grafici, tooltip, tastiera e tabella', async () => {
  const pg = await browser.newPage({ locale: 'it-IT', viewport: { width: 420, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  // 36 infusioni (media settimanale) su V60/Moka/AeroPress; TDS ogni 4ª: alcune nel target, altre no
  const specs = Array.from({ length: 36 }, (_, i) => [3 * i + 1, ['v60', 'moka', 'aeropress'][i % 3], 1 + (i % 5), i % 4 === 0 ? [1.0, 1.4, 1.5, 1.2][(i / 4) % 4] : 0]);
  await seedLegacy(pg, mkInsight(specs));
  await go(pg);
  assert.strictEqual(await pg.locator('#insightsBody').innerHTML(), '', 'chiuso: non disegna nulla');
  await pg.click('#insightsCard summary');

  const tile = n => pg.locator('.viz-tile-val').nth(n).textContent();
  assert.strictEqual(await tile(0), '36');
  assert.strictEqual(await pg.locator('.viz-fig').count(), 3);
  assert.strictEqual(await pg.locator('#insightsBody svg.viz-svg').count(), 3);
  assert.deepStrictEqual(errs, []);

  // grafico dell'EY: punti pieni = nel target, vuoti = fuori; la fascia target c'è
  const ey = await pg.evaluate(() => {
    const fig = document.querySelectorAll('.viz-fig')[1];
    return { filled: fig.querySelectorAll('.viz-dot:not(.hollow):not(.active)').length, hollow: fig.querySelectorAll('.viz-dot.hollow').length, band: fig.querySelectorAll('.viz-band').length };
  });
  assert.strictEqual(ey.filled + ey.hollow, 9);
  assert.ok(ey.filled > 0 && ey.hollow > 0);
  assert.strictEqual(ey.band, 1);

  // tooltip al passaggio del puntatore
  const svg = pg.locator('.viz-fig').nth(1).locator('svg.viz-svg');
  await svg.scrollIntoViewIfNeeded();
  const bb = await svg.boundingBox();
  await pg.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height * 0.5);
  const tip = pg.locator('.viz-fig').nth(1).locator('.viz-tip');
  assert.ok(await tip.isVisible());
  assert.match(await tip.textContent(), /%/);
  await pg.mouse.move(bb.x - 40, bb.y - 40);
  assert.ok(!(await tip.isVisible()), 'il tooltip sparisce quando il puntatore esce');

  // tastiera: il grafico si mette a fuoco e le frecce spostano il punto
  await svg.focus();
  const t1 = await tip.textContent();
  await pg.keyboard.press('ArrowLeft');
  assert.notStrictEqual(await tip.textContent(), t1);
  await pg.keyboard.press('Escape');
  assert.ok(!(await tip.isVisible()));

  // tabella gemella: stessi punti
  await pg.locator('.viz-fig').nth(1).locator('.viz-toggle').click();
  assert.strictEqual(await pg.locator('.viz-fig').nth(1).locator('tbody tr').count(), 9);
  assert.ok(!(await pg.locator('.viz-fig').nth(1).locator('svg.viz-svg').isVisible()));
  await pg.locator('.viz-fig').nth(1).locator('.viz-toggle').click();

  // filtro per periodo: 30 giorni -> 10 infusioni (giorni fa 1, 4, ..., 28) e variazione sul periodo precedente
  await pg.locator('.viz-chips button', { hasText: '30 giorni' }).click();
  assert.strictEqual(await tile(0), '10');
  assert.match(await pg.locator('.viz-tile-delta').first().textContent(), /vs 30 gg prima/);
  await pg.locator('.viz-chips button', { hasText: 'Tutto' }).click();
  assert.strictEqual(await tile(0), '36');

  // filtro per metodo: un solo metodo -> riquadro al posto del grafico a barre
  await pg.selectOption('.viz-select', 'moka');
  assert.strictEqual(await tile(0), '12');
  assert.strictEqual(await pg.locator('.viz-bar').count(), 0);
  await pg.selectOption('.viz-select', '');
  assert.strictEqual(await pg.locator('.viz-bar').count(), 3);

  // un'infusione nuova aggiorna subito l'andamento (la sezione è aperta)
  await pg.click('#diaryAddBtn');
  await pg.click('#diarySaveBtn');
  assert.strictEqual(await tile(0), '37');
  assert.deepStrictEqual(errs, []);
  await pg.close();
});

test('andamento: stati vuoti, colori del tema e nessuna conversione di unità sui numeri', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await go(pg);
  await pg.click('#insightsCard summary');
  await pg.waitForSelector('#insightsBody .viz-empty');   // l'evento toggle di <details> è asincrono
  assert.match(await pg.textContent('#insightsBody'), /almeno 2 infusioni/);

  // senza TDS: grafico dei voti sì, EY vuoto con il suggerimento
  await pg.evaluate(async (entries) => { const m = await import('/js/diary-store.js'); m.setDiary(entries); await m.flushDiary(); (await import('/js/diary.js')).renderDiary(); },
    mkInsight([[2, 'v60', 4], [9, 'v60', 5], [20, 'moka', 3]]));
  assert.strictEqual(await pg.locator('.viz-fig').count(), 3);
  assert.match(await pg.locator('.viz-fig').nth(1).textContent(), /Annota il TDS in almeno 2 infusioni/);
  assert.strictEqual(await pg.locator('.viz-fig').nth(0).locator('svg.viz-svg').count(), 1);

  // periodo senza infusioni
  await pg.evaluate(async (entries) => { const m = await import('/js/diary-store.js'); m.setDiary(entries); (await import('/js/diary.js')).renderDiary(); }, mkInsight([[300, 'v60', 4], [310, 'v60', 5]]));
  await pg.locator('.viz-chips button', { hasText: '30 giorni' }).click();
  assert.match(await pg.textContent('#insightsBody'), /Nessuna infusione in questo periodo/);

  // il colore della serie segue il tema (valori validati: chiaro #ae4d1b, scuro #d4733c)
  const color = () => pg.evaluate(() => getComputedStyle(document.getElementById('insightsBody')).getPropertyValue('--viz-1').trim());
  await pg.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  assert.strictEqual(await color(), '#ae4d1b');
  await pg.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  assert.strictEqual(await color(), '#d4733c');

  // con le once non si altera nessun numero dei grafici (voti, EY, conteggi)
  await pg.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await pg.locator('.viz-chips button', { hasText: 'Tutto' }).click();
  const before = await pg.textContent('#insightsBody');
  await setUnits(pg, 'imperial');
  assert.strictEqual(await pg.textContent('#insightsBody'), before);
  await pg.close();
});

// ----- Condivisione del diario tra dispositivi -----
test('condivisione: unione di due diari, lettura e nome del backup', async () => {
  const r = await page.evaluate(async () => {
    const { mergeDiaries, parseBackup, buildBackup, backupFileName, sanitizeEntry } = await window.__mods();
    const e = (id, extra = {}) => ({ id, date: new Date(2026, 0, id).toISOString(), method: 'v60', methodName: 'Hario V60', dose: 20, water: 300, ratio: 15, rating: 3, note: 'a', ...extra });
    const mine = [e(3, { note: 'mia', updated: 1000 }), e(2), e(1)];
    const theirs = [e(3, { note: 'sua, più recente', updated: 2000 }), e(2, { note: 'diversa ma non più recente' }), e(4), { methodName: '', dose: 1 }, e(5, { id: undefined })];
    const m = mergeDiaries(mine, theirs, sanitizeEntry);
    const older = mergeDiaries([e(3, { note: 'mia', updated: 5000 })], [e(3, { note: 'vecchia', updated: 1000 })], sanitizeEntry);
    return {
      counts: [m.added, m.updated, m.unchanged, m.invalid],
      notes: Object.fromEntries(m.merged.map(x => [x.id, x.note])),
      order: m.merged.slice(0, 2).map(x => x.id),
      mineUntouched: mine[0].note,
      olderKept: older.merged[0].note,
      parseArray: parseBackup(JSON.stringify([e(1)])).incoming.length,
      parseObj: parseBackup(JSON.stringify({ diary: [e(1), e(2)], settings: { roast: 'dark' } })),
      invalid: ['{"a":1}', 'non json', '"testo"'].map(t => { try { parseBackup(t); return 'ok'; } catch (err) { return 'errore'; } }),
      backup: buildBackup([e(1)], { roast: 'light' }, new Date('2026-03-04T10:00:00Z')),
      names: [backupFileName('it', new Date('2026-03-04T10:00:00Z')), backupFileName('en', new Date('2026-03-04T10:00:00Z'))]
    };
  });
  assert.deepStrictEqual(r.counts, [2, 1, 1, 1], 'aggiunte (id 4 e quella senza id), 1 aggiornata, 1 invariata, 1 non valida');
  assert.strictEqual(r.notes[3], 'sua, più recente');
  assert.strictEqual(r.notes[2], 'a', 'una copia non più recente non sovrascrive');
  assert.strictEqual(r.mineUntouched, 'mia', 'il diario di partenza non viene modificato sul posto');
  assert.strictEqual(r.olderKept, 'mia');
  assert.strictEqual(r.parseArray, 1);
  assert.strictEqual(r.parseObj.incoming.length, 2);
  assert.strictEqual(r.parseObj.settings.roast, 'dark');
  assert.deepStrictEqual(r.invalid, ['errore', 'errore', 'errore']);
  assert.strictEqual(r.backup.app, 'coffee-brew-calc');
  assert.deepStrictEqual(r.names, ['diario-caffe-2026-03-04.json', 'coffee-diary-2026-03-04.json']);
});

test('condivisione: una modifica segna `updated` e l\'import la propaga all\'altro dispositivo', async () => {
  const pg = await browser.newPage({ locale: 'it-IT' });
  await seedLegacy(pg, mkEntries(2));
  await go(pg);
  const before = Date.now();
  await pg.locator('#diaryList .diary-edit').first().click();
  await pg.fill('#diaryNote', 'modificata qui');
  await pg.click('#diarySaveBtn');
  const edited = (await readDiaryDB(pg)).find(e => e.note === 'modificata qui');
  assert.ok(edited.updated >= before, 'la modifica registra la data di aggiornamento');

  // un file con la stessa voce più recente la aggiorna; una più vecchia non la tocca
  const base1 = { ...edited };
  const newer = { diary: [{ ...base1, note: 'modificata altrove', updated: edited.updated + 1000 }] };
  await pg.setInputFiles('#diaryImportFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(newer)) });
  await pg.waitForFunction(() => /aggiornat/.test(document.getElementById('toast').textContent));
  assert.ok((await readDiaryDB(pg)).some(e => e.note === 'modificata altrove'));
  const older = { diary: [{ ...base1, note: 'vecchia', updated: 1 }] };
  await pg.setInputFiles('#diaryImportFile', { name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(older)) });
  await pg.waitForFunction(() => /già presente/.test(document.getElementById('toast').textContent));
  assert.ok((await readDiaryDB(pg)).some(e => e.note === 'modificata altrove'), 'la copia più vecchia non sovrascrive');
  await pg.close();
});

test('condivisione: il pulsante usa il foglio di condivisione del sistema e ripiega sul file', async () => {
  // senza supporto ai file il pulsante non c'è (c'è già "Esporta")
  const plain = await browser.newPage({ locale: 'it-IT' });
  await plain.addInitScript(() => { delete Navigator.prototype.share; delete Navigator.prototype.canShare; });
  await go(plain);
  assert.ok(await plain.evaluate(() => document.getElementById('diaryShareBtn').classList.contains('hidden')));
  await plain.close();

  const pg = await browser.newPage({ locale: 'it-IT' });
  await pg.addInitScript(() => {
    window.__shares = [];
    window.__shareMode = 'ok';
    Navigator.prototype.canShare = () => true;
    Navigator.prototype.share = async function (data) {
      window.__shares.push({ name: data.files[0].name, type: data.files[0].type, text: await data.files[0].text(), title: data.title });
      if (window.__shareMode === 'abort') throw new DOMException('annullato', 'AbortError');
      if (window.__shareMode === 'fail') throw new DOMException('non permesso', 'NotAllowedError');
    };
  });
  await seedLegacy(pg, mkEntries(3));
  await go(pg);
  assert.ok(await pg.evaluate(() => !document.getElementById('diaryShareBtn').classList.contains('hidden')));

  await pg.click('#diaryShareBtn');
  await pg.waitForFunction(() => window.__shares.length === 1);
  const sent = await pg.evaluate(() => window.__shares[0]);
  assert.match(sent.name, /^diario-caffe-\d{4}-\d{2}-\d{2}\.json$/);
  assert.strictEqual(sent.type, 'application/json');
  assert.strictEqual(JSON.parse(sent.text).diary.length, 3);
  assert.match(await pg.textContent('#toast'), /Diario condiviso/);

  // l'utente chiude il foglio: nessun messaggio d'errore, nessun download
  await pg.evaluate(() => { window.__shareMode = 'abort'; document.getElementById('toast').textContent = ''; });
  let downloads = 0; pg.on('download', () => downloads++);
  await pg.click('#diaryShareBtn');
  await pg.waitForFunction(() => window.__shares.length === 2);
  await pg.waitForTimeout(200);
  assert.strictEqual(downloads, 0);
  assert.strictEqual(await pg.textContent('#toast'), '');

  // il sistema rifiuta: si scarica il file
  await pg.evaluate(() => { window.__shareMode = 'fail'; });
  const dl = pg.waitForEvent('download');
  await pg.click('#diaryShareBtn');
  assert.match((await dl).suggestedFilename(), /^diario-caffe-.*\.json$/);
  await pg.close();
});

test('condivisione: l\'app è una destinazione di "Condividi" e chiede conferma prima di unire il file ricevuto', async () => {
  const man = await (await fetch(base + 'manifest.json')).json();
  assert.strictEqual(man.share_target.method, 'POST');
  assert.strictEqual(man.share_target.enctype, 'multipart/form-data');
  assert.strictEqual(man.share_target.params.files[0].name, 'backup');

  const ctx = await browser.newContext({ locale: 'it-IT' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await seedLegacy(pg, mkEntries(2));
  await go(pg);
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.waitForFunction(() => navigator.serviceWorker.controller);

  // il sistema invia il file con una POST: il service worker lo tiene da parte e rimanda all'app
  const incoming = { app: 'coffee-brew-calc', version: 2, settings: { roast: 'dark', roastDate: null }, diary: [...mkEntries(2), ...mkEntries(2, 10).map(e => ({ ...e, note: 'dall\'altro telefono' }))] };
  const post = await pg.evaluate(async (json) => {
    const fd = new FormData();
    fd.append('backup', new File([json], 'diario.json', { type: 'application/json' }));
    const r = await fetch('./share-target', { method: 'POST', body: fd, redirect: 'manual' });
    const kept = await (await caches.open('coffee-calc-share')).keys();
    return { type: r.type, kept: kept.length };
  }, JSON.stringify(incoming));
  assert.strictEqual(post.type, 'opaqueredirect', 'risponde con un reindirizzamento');
  assert.strictEqual(post.kept, 1, 'il file ricevuto è custodito dal service worker');

  // si annulla: il diario non cambia e il parametro sparisce dall'indirizzo
  await pg.goto(base + '?shared=1');
  await pg.waitForSelector('html[data-ready]', { state: 'attached' });
  assert.ok(await pg.isVisible('#sharedOverlay'));
  assert.match(await pg.textContent('#sharedSummary'), /2 infusioni nuove/);
  assert.match(await pg.textContent('#sharedSummary'), /2 già presenti/);
  assert.ok(!new URL(pg.url()).search.includes('shared'));
  await pg.click('#sharedCancel');
  assert.ok(!(await pg.isVisible('#sharedOverlay')));
  assert.strictEqual((await readDiaryDB(pg)).length, 2);

  // il file era stato consumato: riaprire ?shared=1 non ripropone nulla
  await pg.goto(base + '?shared=1');
  await pg.waitForSelector('html[data-ready]', { state: 'attached' });
  assert.ok(!(await pg.isVisible('#sharedOverlay')));
  assert.match(await pg.textContent('#toast'), /Nessun backup ricevuto/);

  // di nuovo il file, questa volta si conferma: le voci si uniscono e le impostazioni si ripristinano
  await pg.evaluate(async (json) => {
    const fd = new FormData(); fd.append('backup', new File([json], 'diario.json', { type: 'application/json' }));
    await fetch('./share-target', { method: 'POST', body: fd });
  }, JSON.stringify(incoming));
  await pg.goto(base + '?shared=1');
  await pg.waitForSelector('html[data-ready]', { state: 'attached' });
  await pg.click('#sharedConfirm');
  await pg.waitForFunction(() => /importat/.test(document.getElementById('toast').textContent));
  const all = await readDiaryDB(pg);
  assert.strictEqual(all.length, 4);
  assert.ok(all.some(e => e.note === 'dall\'altro telefono'));
  assert.strictEqual(await pg.evaluate(() => JSON.parse(localStorage.getItem('coffee-brew-calc-v1')).roast), 'dark');

  // un file non valido non cambia nulla e lo dice
  await pg.evaluate(async () => {
    const fd = new FormData(); fd.append('backup', new File(['questo non è un diario'], 'x.json', { type: 'application/json' }));
    await fetch('./share-target', { method: 'POST', body: fd });
  });
  await pg.goto(base + '?shared=1');
  await pg.waitForSelector('html[data-ready]', { state: 'attached' });
  assert.match(await pg.textContent('#toast'), /File non valido/);
  assert.strictEqual((await readDiaryDB(pg)).length, 4);
  assert.deepStrictEqual(errs, []);
  await ctx.close();
});
