const METHODS = {
  v60: {
    name: 'Hario V60', icon: '🌀', type: 'Percolazione', dose: 20, ratio: 15, min: 14, max: 17, grind: 3, temp: [92, 96],
    desc: 'Pour-over conico: tazza pulita e brillante. Il rapporto classico è 1:15 (≈ 60 g/L).',
    specs: { 'Macinatura': 'media-fine (zucchero)', 'Temperatura': '92–96 °C', 'Tempo': '2:30–3:30' },
    hint: '1:14 più intenso · 1:17 più leggero e delicato',
    presets: [{ label: '1 tazza (250 g)', water: 250 }, { label: '2 tazze (400 g)', water: 400 }, { label: 'Caraffa (600 g)', water: 600 }],
    steps: (d, w) => [
      `Sciacqua il filtro con acqua calda, scaldando la V60. Aggiungi ${W(d)} di caffè e livella il letto.`,
      `${T('0:00')} — <b>Bloom:</b> versa ${W(d * 3)} d'acqua (3× la dose), ruota il dripper. Attendi ${T('0:45')}.`,
      `${T('0:45')} — Versa a spirale fino a ${W(w * 0.6)} totali entro ${T('1:15')}.`,
      `${T('1:30')} — Completa fino a ${W(w)} totali entro ${T('2:00')}, con versate lente al centro.`,
      `Percolazione completa entro ${T('2:45–3:15')}. Se è più lenta, macina più grosso.`
    ],
    timer: (d, w) => ({
      type: 'guided', total: 200,
      steps: [
        { at: 0, title: 'Bloom', detail: `Versa ${fmt(d * 3)} g d'acqua e ruota il dripper` },
        { at: 45, title: 'Prima versata', detail: `Versa a spirale fino a ${fmt(w * 0.6)} g totali` },
        { at: 90, title: 'Seconda versata', detail: `Completa fino a ${fmt(w)} g totali, versate lente al centro` },
        { at: 165, title: 'Ultimi minuti', detail: 'Lascia percolare fino alla fine' }
      ]
    })
  },
  aeropress: {
    name: 'AeroPress', icon: '💨', type: 'Immersione + pressione', dose: 15, ratio: 13, min: 6, max: 18.5, grind: 3, temp: [80, 96],
    desc: 'Versatile e corposo. Rapporti concentrati (1:10–1:12) per stile "espresso", 1:15–1:17 per tazza filtro.',
    specs: { 'Macinatura': 'media-fine', 'Temperatura': '85–92 °C', 'Tempo': '~2:00' },
    hint: '1:6 stile espresso · 1:13 equilibrato · 1:18 filtro leggero',
    presets: [{ label: 'Concentrato (150 g)', water: 150 }, { label: 'Standard (200 g)', water: 200 }, { label: 'Massimo (250 g)', water: 250 }],
    steps: (d, w) => [
      `Metodo classico: filtro sciacquato nel cappuccio, AeroPress sul server. Aggiungi ${W(d)} di caffè.`,
      `${T('0:00')} — Versa ${W(w)} d'acqua in un colpo solo e mescola 10 secondi.`,
      `Avvita il cappuccio (o inserisci lo stantuffo di 1 cm per fermare il flusso).`,
      `${T('1:30')} — Premi con pressione costante per ~30 secondi. Fermati al sibilo.`,
      `Totale ~${T('2:00')}. Con rapporto sotto 1:12, allunga con acqua calda a piacere.`
    ],
    timer: (d, w) => ({
      type: 'guided', total: 125,
      steps: [
        { at: 0, title: "Versa l'acqua", detail: `${fmt(w)} g in un colpo solo, mescola 10 secondi` },
        { at: 90, title: 'Premi', detail: 'Pressione costante per ~30 secondi, fermati al sibilo' }
      ]
    })
  },
  kalita: {
    name: 'Kalita 101', icon: '💧', type: 'Percolazione', dose: 16, ratio: 16, min: 15, max: 17, grind: 4, temp: [90, 94],
    desc: 'Dripper a fondo piatto per 1–2 tazze: estrazione uniforme e tollerante. Rapporto tipico 1:16.',
    specs: { 'Macinatura': 'media', 'Temperatura': '90–94 °C', 'Tempo': '3:00–3:45' },
    hint: '1:15 più corpo · 1:17 più tè-like',
    presets: [{ label: '1 tazza (180 g)', water: 180 }, { label: '2 tazze (300 g)', water: 300 }],
    steps: (d, w) => [
      `Sciacqua il filtro a ventaglio, aggiungi ${W(d)} di caffè.`,
      `${T('0:00')} — <b>Bloom:</b> ${W(d * 2.5)} d'acqua, attendi ${T('0:45')}.`,
      `${T('0:45')} — Versa fino a ${W(w * 0.5)} totali con movimento circolare lento.`,
      `${T('1:30')} — Versa fino a ${W(w * 0.75)} totali.`,
      `${T('2:15')} — Completa fino a ${W(w)} totali. Fine entro ${T('3:00–3:45')}.`
    ],
    timer: (d, w) => ({
      type: 'guided', total: 230,
      steps: [
        { at: 0, title: 'Bloom', detail: `Versa ${fmt(d * 2.5)} g d'acqua` },
        { at: 45, title: 'Prima versata', detail: `Fino a ${fmt(w * 0.5)} g totali, movimento circolare lento` },
        { at: 90, title: 'Seconda versata', detail: `Fino a ${fmt(w * 0.75)} g totali` },
        { at: 135, title: 'Terza versata', detail: `Completa fino a ${fmt(w)} g totali` },
        { at: 195, title: 'Ultimi minuti', detail: 'Lascia drenare fino alla fine' }
      ]
    })
  },
  switch: {
    name: 'Hario Switch', icon: '🔀', type: 'Immersione ibrida', dose: 20, ratio: 15, min: 14, max: 17, grind: 4, temp: [90, 93],
    desc: 'V60 con valvola: immersione controllata + percolazione finale. Estrazione dolce e ripetibile.',
    specs: { 'Macinatura': 'media', 'Temperatura': '90–93 °C', 'Tempo': '3:00–3:30' },
    hint: '1:15 standard · con caffè chiari prova 1:16',
    presets: [{ label: '1 tazza (240 g)', water: 240 }, { label: 'Piena (360 g)', water: 360 }],
    steps: (d, w) => [
      `Valvola <b>chiusa</b>, filtro sciacquato (aprila per scaricare l'acqua di risciacquo, poi richiudi). Aggiungi ${W(d)} di caffè.`,
      `${T('0:00')} — Versa tutti i ${W(w)} d'acqua e mescola delicatamente.`,
      `Lascia in immersione a valvola chiusa.`,
      `${T('2:00')} — <b>Apri la valvola</b> e lascia drenare.`,
      `Drenaggio completo entro ${T('3:00–3:30')}. Variante: apri a 1:30 per più acidità, a 2:30 per più corpo.`
    ],
    timer: (d, w) => ({
      type: 'guided', total: 220,
      steps: [
        { at: 0, title: "Versa tutta l'acqua", detail: `${fmt(w)} g in un colpo solo, mescola delicatamente. Valvola chiusa` },
        { at: 120, title: 'Apri la valvola', detail: 'Lascia drenare fino alla fine' }
      ]
    })
  },
  moka: {
    name: 'Moka', icon: '🔥', type: 'Pressione a vapore', dose: 16.5, ratio: 10, min: 7, max: 12, waterDriven: true, grind: 2,
    desc: "L'acqua è determinata dalla caldaia (fino alla valvola): scegli la taglia e ottieni la dose corretta. Rapporto tipico 1:10.",
    specs: { 'Macinatura': 'medio-fine (più grossa dell\'espresso)', 'Acqua': 'calda, fino alla valvola', 'Fuoco': 'medio-basso' },
    hint: '1:7–1:8 più intenso · 1:10 classico · 1:12 più leggero',
    presets: [{ label: '1 tazza (60 g)', water: 60 }, { label: '2 tazze (110 g)', water: 110 }, { label: '3 tazze (165 g)', water: 165 }, { label: '6 tazze (300 g)', water: 300 }],
    steps: (d, w) => [
      `Riempi la caldaia con ${W(w)} di acqua <b>già calda</b> fino alla valvola (mai oltre): riduce il tempo sul fuoco e l'amaro metallico.`,
      `Riempi il filtro con ${W(d)} di caffè: raso, senza pressare, livellato con un colpetto.`,
      `Avvita (con un panno, la base scotta) e metti su fuoco medio-basso, coperchio aperto.`,
      `Quando il caffè sale con flusso cremoso e costante, abbassa il fuoco.`,
      `Al primo gorgoglio <b>togli dal fuoco</b> e raffredda la base sotto acqua fredda per fermare l'estrazione. Mescola nel raccoglitore prima di servire.`
    ],
    timer: (d, w) => ({
      type: 'manual',
      steps: [
        `Caldaia con ${fmt(w)} g d'acqua calda fino alla valvola`,
        `Filtro con ${fmt(d)} g di caffè, livellato senza pressare`,
        'Fuoco medio-basso, coperchio aperto',
        'Flusso cremoso e costante → abbassa il fuoco',
        'Primo gorgoglio → togli dal fuoco e raffredda la base'
      ]
    })
  },
  coldbrew: {
    name: 'Cold Brew', icon: '❄️', type: 'Immersione a freddo', dose: 60, ratio: 8, min: 5, max: 10, coldbrew: true, grind: 7,
    desc: 'Estrazione lunga a freddo: dolce, senza acidità. Concentrato 1:5–1:10 (da diluire) o pronto da bere 1:12–1:16.',
    specs: { 'Macinatura': 'grossa (pangrattato)', 'Temperatura': 'ambiente o frigo', 'Tempo': '12–24 h' },
    hint: 'Concentrato: 1:8 classico. Diluizione finale 1:1 con acqua o latte.',
    presets: [{ label: '500 g acqua', water: 500 }, { label: '1 L acqua', water: 1000 }, { label: '2 L acqua', water: 2000 }],
    steps: (d, w, mode) => {
      const s = [
        `Macina grosso ${W(d)} di caffè e mettilo nel contenitore (french press, barattolo o toddy).`,
        `Versa ${W(w)} di acqua fredda o a temperatura ambiente. Mescola bene per bagnare tutto il caffè.`,
        `Copri e lascia in infusione: <b>in frigo ${mode === 'conc' ? '18–24 h' : '12–16 h'}</b>, a temperatura ambiente riduci di ~4 h.`,
        `Filtra con filtro di carta o panno fine (doppio passaggio per una tazza più pulita).`
      ];
      if (mode === 'conc') {
        s.push(`<b>Diluizione:</b> è un concentrato — servi 1:1, es. ${W(150)} di concentrato + ${W(150)} di acqua/latte/ghiaccio.`);
      } else {
        s.push(`Pronto da bere: servi liscio con ghiaccio, senza diluire.`);
      }
      s.push(`Si conserva in frigo fino a 2 settimane (concentrato) o 1 settimana (pronto).`);
      return s;
    },
    timer: (d, w, mode) => ({
      type: 'longform', hours: mode === 'conc' ? 20 : 14, dose: d, water: w
    })
  }
};

const ORDER = ['v60', 'aeropress', 'kalita', 'switch', 'moka', 'coldbrew'];
const LS_KEY = 'coffee-brew-calc-v1';
