import { T, W, fmt } from '../core.js';

// ===== English content for all methods (mirrors METHODS text fields) =====
export const METHODS_EN = {
  v60: {
    type: 'Pour-over',
    desc: 'Conical pour-over: a clean, bright cup. The classic ratio is 1:15 (≈ 60 g/L).',
    specs: { 'Grind': 'medium-fine (sugar-like)', 'Temperature': '92–96 °C', 'Time': '2:30–3:30' },
    hint: '1:14 stronger · 1:17 lighter and more delicate',
    presets: ['1 cup (250 g)', '2 cups (400 g)', 'Carafe (600 g)'],
    steps: (d, w) => [
      `Rinse the filter with hot water, warming the V60. Add ${W(d)} of coffee and level the bed.`,
      `${T('0:00')} — <b>Bloom:</b> pour ${W(d * 3)} of water (3× the dose), swirl the dripper. Wait ${T('0:45')}.`,
      `${T('0:45')} — Pour in a spiral up to ${W(w * 0.6)} total within ${T('1:15')}.`,
      `${T('1:30')} — Finish up to ${W(w)} total within ${T('2:00')}, with slow pours in the center.`,
      `Full drawdown within ${T('2:45–3:15')}. If it's slower, grind coarser.`
    ],
    timerText: () => ({ items: [
      { title: 'Bloom', detail: `Pour ${fmt(0)} g placeholder` }
    ] })
  }
};
METHODS_EN.v60.timerText = (d, w) => ({ items: [
  { title: 'Bloom', detail: `Pour ${fmt(d * 3)} g of water and swirl the dripper` },
  { title: 'First pour', detail: `Pour in a spiral up to ${fmt(w * 0.6)} g total` },
  { title: 'Second pour', detail: `Finish up to ${fmt(w)} g total, slow pours in the center` },
  { title: 'Final minutes', detail: 'Let it drain until the end' }
] });

METHODS_EN.aeropress = {
  type: 'Immersion + pressure',
  desc: 'Versatile and full-bodied. Concentrated ratios (1:10–1:12) for an "espresso" style, 1:15–1:17 for filter-style.',
  specs: { 'Grind': 'medium-fine', 'Temperature': '85–92 °C', 'Time': '~2:00' },
  hint: '1:6 espresso style · 1:13 balanced · 1:18 light filter',
  presets: ['Concentrated (150 g)', 'Standard (200 g)', 'Maximum (250 g)'],
  steps: (d, w) => [
    `Classic method: rinsed filter in the cap, AeroPress on the server. Add ${W(d)} of coffee.`,
    `${T('0:00')} — Pour ${W(w)} of water all at once and stir for 10 seconds.`,
    `Screw on the cap (or insert the plunger 1 cm to stop the flow).`,
    `${T('1:30')} — Press with steady pressure for ~30 seconds. Stop at the hiss.`,
    `Total ~${T('2:00')}. With a ratio under 1:12, top up with hot water to taste.`
  ],
  timerText: (d, w) => ({ items: [
    { title: 'Pour the water', detail: `${fmt(w)} g all at once, stir for 10 seconds` },
    { title: 'Press', detail: 'Steady pressure for ~30 seconds, stop at the hiss' }
  ] })
};

METHODS_EN.kalita = {
  type: 'Pour-over',
  desc: 'Flat-bottom dripper for 1–2 cups: even, forgiving extraction. Typical ratio 1:16.',
  specs: { 'Grind': 'medium', 'Temperature': '90–94 °C', 'Time': '3:00–3:45' },
  hint: '1:15 more body · 1:17 more tea-like',
  presets: ['1 cup (180 g)', '2 cups (300 g)'],
  steps: (d, w) => [
    `Rinse the fan filter, add ${W(d)} of coffee.`,
    `${T('0:00')} — <b>Bloom:</b> ${W(d * 2.5)} of water, wait ${T('0:45')}.`,
    `${T('0:45')} — Pour up to ${W(w * 0.5)} total with a slow circular motion.`,
    `${T('1:30')} — Pour up to ${W(w * 0.75)} total.`,
    `${T('2:15')} — Finish up to ${W(w)} total. Done within ${T('3:00–3:45')}.`
  ],
  timerText: (d, w) => ({ items: [
    { title: 'Bloom', detail: `Pour ${fmt(d * 2.5)} g of water` },
    { title: 'First pour', detail: `Up to ${fmt(w * 0.5)} g total, slow circular motion` },
    { title: 'Second pour', detail: `Up to ${fmt(w * 0.75)} g total` },
    { title: 'Third pour', detail: `Finish up to ${fmt(w)} g total` },
    { title: 'Final minutes', detail: 'Let it drain until the end' }
  ] })
};

METHODS_EN.switch = {
  type: 'Hybrid immersion',
  desc: 'V60 with a valve: controlled immersion + final drawdown. Sweet, repeatable extraction.',
  specs: { 'Grind': 'medium', 'Temperature': '90–93 °C', 'Time': '3:00–3:30' },
  hint: '1:15 standard · with light roasts try 1:16',
  presets: ['1 cup (240 g)', 'Full (360 g)'],
  steps: (d, w) => [
    `Valve <b>closed</b>, rinsed filter (open it to drain the rinse water, then close again). Add ${W(d)} of coffee.`,
    `${T('0:00')} — Pour all ${W(w)} of water and stir gently.`,
    `Leave to steep with the valve closed.`,
    `${T('2:00')} — <b>Open the valve</b> and let it drain.`,
    `Full drainage within ${T('3:00–3:30')}. Variation: open at 1:30 for more acidity, at 2:30 for more body.`
  ],
  timerText: (d, w) => ({ items: [
    { title: 'Pour all the water', detail: `${fmt(w)} g at once, stir gently. Valve closed` },
    { title: 'Open the valve', detail: 'Let it drain until the end' }
  ] })
};

METHODS_EN.moka = {
  type: 'Steam pressure',
  desc: "Water is set by the boiler (up to the valve): pick the size and get the right dose. Typical ratio 1:10.",
  specs: { 'Grind': 'medium-fine (coarser than espresso)', 'Water': 'hot, up to the valve', 'Heat': 'medium-low' },
  hint: '1:7–1:8 stronger · 1:10 classic · 1:12 lighter',
  presets: ['1 cup (60 g)', '2 cups (110 g)', '3 cups (165 g)', '6 cups (300 g)'],
  steps: (d, w) => [
    `Fill the boiler with ${W(w)} of <b>already hot</b> water up to the valve (never over): it cuts stove time and metallic bitterness.`,
    `Fill the basket with ${W(d)} of coffee: level, without tamping, tap to settle.`,
    `Screw on (use a cloth, the base gets hot) and put on medium-low heat, lid open.`,
    `When the coffee rises with a creamy, steady flow, lower the heat.`,
    `At the first gurgle <b>remove from heat</b> and cool the base under cold water to stop extraction. Stir in the pot before serving.`
  ],
  timerText: (d, w) => ({ items: [
    `Boiler with ${fmt(w)} g of hot water up to the valve`,
    `Basket with ${fmt(d)} g of coffee, leveled without tamping`,
    'Medium-low heat, lid open',
    'Creamy, steady flow → lower the heat',
    'First gurgle → remove from heat and cool the base'
  ] })
};

METHODS_EN.coldbrew = {
  type: 'Cold immersion',
  desc: 'Long cold extraction: sweet, no acidity. Concentrate 1:5–1:10 (to dilute) or ready-to-drink 1:12–1:16.',
  specs: { 'Grind': 'coarse (breadcrumb-like)', 'Temperature': 'room temp or fridge', 'Time': '12–24 h' },
  hint: 'Concentrate: 1:8 classic. Final dilution 1:1 with water or milk.',
  presets: ['500 g water', '1 L water', '2 L water'],
  steps: (d, w, mode) => {
    const s = [
      `Coarsely grind ${W(d)} of coffee and place it in the container (French press, jar or toddy).`,
      `Pour ${W(w)} of cold or room-temperature water. Stir well to wet all the coffee.`,
      `Cover and steep: <b>in the fridge ${mode === 'conc' ? '18–24 h' : '12–16 h'}</b>, reduce by ~4 h at room temperature.`,
      `Filter with a paper filter or fine cloth (double pass for a cleaner cup).`
    ];
    if (mode === 'conc') {
      s.push(`<b>Dilution:</b> this is a concentrate — serve 1:1, e.g. ${W(150)} of concentrate + ${W(150)} of water/milk/ice.`);
    } else {
      s.push(`Ready to drink: serve straight over ice, no dilution needed.`);
    }
    s.push(`Keeps in the fridge up to 2 weeks (concentrate) or 1 week (ready-to-drink).`);
    return s;
  },
  timerText: () => ({ items: [] })
};
