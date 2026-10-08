<p align="center">
  <img src="logo.png" alt="Coffee Calc" width="180">
</p>

<h1 align="center">Calcolatore Infusioni Caffè</h1>

Web app (PWA) per calcolare dosi, acqua e rapporti di estrazione per sei metodi di infusione: **Hario V60, AeroPress, Kalita 101, Hario Switch, moka e cold brew**.

## Funzionalità

- **Calcolo bidirezionale**: inserisci i grammi di caffè o di acqua e l'altro valore si aggiorna automaticamente in base al rapporto scelto
- **Rapporti corretti per metodo**: ogni tecnica ha il suo range (V60 1:14–1:17, moka 1:7–1:12, AeroPress 1:10–1:17, cold brew concentrato o pronto da bere)
- **Procedura passo-passo** con tempi e quantità ricalcolate in tempo reale: bloom, versate parziali, apertura valvola, diluizione
- **Preset rapidi**: tazze per i pour-over, taglie caldaia per la moka, volumi per il cold brew
- **Profili macinino 1Zpresso** (X-Ultra, X-Pro S, J-Ultra, J-Max S, JX-Pro S, K-Ultra, K-Max, Q2/J): click di partenza e range per ogni metodo in formato giri.numero.click (fasce verificate per X-Ultra), possibilità di salvare il proprio setting per metodo
- **Guida alla macinatura**: come leggere i numeri, taratura dello zero, tabella "nel bicchiere → cosa fare" con i click calcolati sul passo del tuo macinino, consigli per tostatura e freschezza
- **Linee guida sull'acqua** secondo gli standard SCA: TDS, durezza, alcalinità, pH
- **Diario delle infusioni** con voti, note, confronto, statistiche e backup JSON (esporta/importa). Conserva le ultime 100 voci: da 90 in su compare un avviso con il pulsante di esportazione, e quando una voce viene scartata (nuova infusione o import) l'app lo dice
- **Unità di misura**: di default grammi, ml e °C. Il pulsante in alto apre le impostazioni: peso (g / oz), volume (ml / fl oz) e temperatura (°C / °F) si cambiano una per una, oppure con i preset "Tutto metrico" / "Tutto imperiale". Campi, procedure, timer, diario e immagine condivisa si convertono; ricette, diario salvato e link condivisi restano in grammi e °C. La scelta viene ricordata
- **Funziona offline** e salva le tue impostazioni sul dispositivo
- **Italiano e inglese**: alla prima visita la lingua segue il browser (italiano o inglese, altrimenti inglese); il pulsante IT/EN in alto la cambia e la scelta viene ricordata

## Installazione su smartphone

Apri l'app nel browser, poi:

- **Android (Chrome)**: menu ⋮ → *Aggiungi a schermata Home*
- **iPhone (Safari)**: Condividi → *Aggiungi a Home*

L'app si apre a schermo intero con la propria icona, anche senza connessione.

## Tecnologia

Web app statica senza build step e senza dipendenze esterne (font Chakra Petch e JetBrains Mono inclusi in `fonts/`, licenza OFL), stile visivo "Impeccable" con tema chiaro e scuro, con manifest e service worker per l'installazione e l'uso offline. Nessun dato lascia il dispositivo: le impostazioni sono salvate in `localStorage`.

```
index.html          struttura della pagina (carica solo js/main.js)
css/style.css       stili
js/main.js          punto d'ingresso: chiama gli init* nell'ordine e fa il primo render
js/core.js          formattazione, icone SVG
js/data/            metodi (IT/EN) e ricette celebri
js/i18n.js          stringhe IT/EN e helper di traduzione
js/app.js           stato, tab, tostatura/freschezza, helper DOM
js/grinder.js       profili macinino e guida alla macinatura
js/render.js        render principale, banner, tema
js/timer.js         timer guidato / manuale / cold brew
js/notify.js        notifiche  ·  js/share.js  link e immagine
js/diary.js         diario, confronto, import/export
js/units.js         unità metriche/imperiali (conversione dei testi e dei campi)
js/sw-register.js   registrazione del service worker
```

Il codice è in **moduli ES** nativi (`import`/`export`, nessun bundler). I moduli non fanno nulla al caricamento: i listener e le inizializzazioni stanno nelle funzioni `initApp()`, `initGrinder()`, … chiamate da `main.js`, così i riferimenti circolari tra moduli (render ↔ diario ↔ timer) sono sicuri. Poiché i moduli non si caricano da `file://`, serve un server HTTP (`npm start`).

## Sviluppo

```bash
npm start                 # server locale su http://localhost:8000
npm install && npx playwright install chromium
npm test                  # test di calcoli, macinini, import diario e accessibilità
```

Quando modifichi `index.html` o gli asset, incrementa `CACHE` in `sw.js` (e aggiungi eventuali nuovi file a `ASSETS`): gli utenti vedranno il banner "Nuova versione disponibile".

## Licenza

Uso libero. Buon caffè! ☕
