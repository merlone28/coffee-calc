// ===== Ricette celebri (fonti: brew guide ufficiali e canali degli autori) =====
const RECIPES = {
  v60: [
    {
      id: 'kasuya46', author: 'Tetsu Kasuya', chip: '4:6 · Kasuya',
      title: { it: 'Metodo 4:6', en: '4:6 Method' },
      cred: { it: 'campione World Brewers Cup 2016', en: '2016 World Brewers Cup champion' },
      desc: {
        it: '5 versate uguali ogni 45 s con macinatura grossa: il primo 40% regola dolcezza/acidità, il restante 60% la forza.',
        en: '5 equal pours every 45 s with a coarse grind: the first 40% sets sweetness/acidity, the last 60% sets strength.'
      },
      dose: 20, ratio: 15, temp: 92, grind: 6,
      steps: {
        it: (d, w) => [
          `Macina <b>grossa</b> (più del solito per V60). Sciacqua il filtro, aggiungi ${W(d)} di caffè e livella.`,
          `${T('0:00')} — 1ª versata: ${W(w * 0.2)}. Più acqua qui = più acidità, meno = più dolcezza.`,
          `${T('0:45')} — 2ª versata: fino a ${W(w * 0.4)} totali. Fine della fase "4" (gusto).`,
          `${T('1:30')} — 3ª versata: fino a ${W(w * 0.6)} totali. Da qui si regola la forza.`,
          `${T('2:15')} — 4ª versata: fino a ${W(w * 0.8)} totali.`,
          `${T('2:45')} — 5ª versata: fino a ${W(w)} totali. Drawdown completo entro ${T('3:30')}.`
        ],
        en: (d, w) => [
          `Grind <b>coarse</b> (coarser than usual for V60). Rinse the filter, add ${W(d)} of coffee and level.`,
          `${T('0:00')} — 1st pour: ${W(w * 0.2)}. More water here = more acidity, less = more sweetness.`,
          `${T('0:45')} — 2nd pour: up to ${W(w * 0.4)} total. End of the "4" phase (taste).`,
          `${T('1:30')} — 3rd pour: up to ${W(w * 0.6)} total. From here you set the strength.`,
          `${T('2:15')} — 4th pour: up to ${W(w * 0.8)} total.`,
          `${T('2:45')} — 5th pour: up to ${W(w)} total. Full drawdown by ${T('3:30')}.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 210,
        steps: [
          { at: 0, title: en ? '1st pour' : '1ª versata', detail: `${fmt(w * 0.2)} g` },
          { at: 45, title: en ? '2nd pour' : '2ª versata', detail: en ? `Up to ${fmt(w * 0.4)} g total` : `Fino a ${fmt(w * 0.4)} g totali` },
          { at: 90, title: en ? '3rd pour' : '3ª versata', detail: en ? `Up to ${fmt(w * 0.6)} g total` : `Fino a ${fmt(w * 0.6)} g totali` },
          { at: 135, title: en ? '4th pour' : '4ª versata', detail: en ? `Up to ${fmt(w * 0.8)} g total` : `Fino a ${fmt(w * 0.8)} g totali` },
          { at: 165, title: en ? '5th pour' : '5ª versata', detail: en ? `Up to ${fmt(w)} g total, drawdown by 3:30` : `Fino a ${fmt(w)} g totali, drawdown entro 3:30` }
        ]
      })
    },
    {
      id: 'hoffmannv60', author: 'James Hoffmann', chip: 'Ultimate · Hoffmann',
      title: { it: 'Ultimate V60', en: 'Ultimate V60' },
      cred: { it: 'campione World Barista Championship 2007', en: '2007 World Barista Champion' },
      desc: {
        it: 'Una sola struttura in 2 versate con bloom lungo, swirl e stir finale: massima uniformità di estrazione.',
        en: 'Two main pours with a long bloom, swirls and a final stir: maximum extraction evenness.'
      },
      dose: 30, ratio: 16.5, temp: 95, grind: 3,
      steps: {
        it: (d, w) => [
          `Sciacqua bene il filtro. Aggiungi ${W(d)} di caffè (macinatura medio-fine) e crea una fossetta al centro.`,
          `${T('0:00')} — <b>Bloom:</b> versa ${W(d * 2)}, poi fai roteare (swirl) il dripper. Attendi ${T('0:45')}.`,
          `${T('0:45')} — Versa a spirale fino a ${W(w * 0.6)} totali entro ${T('1:15')}.`,
          `${T('1:15')} — Versa più dolcemente fino a ${W(w)} totali entro ${T('1:45')}.`,
          `${T('1:45')} — Mescola delicatamente col cucchiaino (1 giro orario + 1 antiorario), poi a ${T('1:55')} swirl finale per appiattire il letto.`,
          `Drawdown completo entro ${T('3:30')}. Letto piatto = estrazione uniforme.`
        ],
        en: (d, w) => [
          `Rinse the filter well. Add ${W(d)} of coffee (medium-fine grind) and make a small well in the centre.`,
          `${T('0:00')} — <b>Bloom:</b> pour ${W(d * 2)}, then swirl the dripper. Wait until ${T('0:45')}.`,
          `${T('0:45')} — Spiral pour up to ${W(w * 0.6)} total by ${T('1:15')}.`,
          `${T('1:15')} — Pour more gently up to ${W(w)} total by ${T('1:45')}.`,
          `${T('1:45')} — Stir gently with a spoon (1 turn clockwise + 1 counter), then at ${T('1:55')} a final swirl to flatten the bed.`,
          `Full drawdown by ${T('3:30')}. Flat bed = even extraction.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 210,
        steps: [
          { at: 0, title: 'Bloom', detail: en ? `Pour ${fmt(d * 2)} g and swirl` : `Versa ${fmt(d * 2)} g e fai swirl` },
          { at: 45, title: en ? 'First pour' : 'Prima versata', detail: en ? `Up to ${fmt(w * 0.6)} g total by 1:15` : `Fino a ${fmt(w * 0.6)} g totali entro 1:15` },
          { at: 75, title: en ? 'Second pour' : 'Seconda versata', detail: en ? `Up to ${fmt(w)} g total by 1:45` : `Fino a ${fmt(w)} g totali entro 1:45` },
          { at: 105, title: en ? 'Stir + swirl' : 'Stir + swirl', detail: en ? 'Gentle spoon stir, then swirl' : 'Mescola delicatamente, poi swirl' },
          { at: 130, title: en ? 'Drawdown' : 'Drawdown', detail: en ? 'Let it drain, done by 3:30' : 'Lascia drenare, fine entro 3:30' }
        ]
      })
    },
    {
      id: 'winton5', author: 'Matt Winton', chip: '5 versate · Winton',
      title: { it: 'Five-Pour', en: 'Five-Pour' },
      cred: { it: 'campione World Brewers Cup 2021', en: '2021 World Brewers Cup champion' },
      desc: {
        it: '5 versate energiche e uguali, ognuna quando il letto è quasi asciutto: niente swirl, niente stir, solo agitazione dell\'acqua.',
        en: '5 equal aggressive pours, each when the bed is nearly dry: no swirl, no stir, just the water\'s own agitation.'
      },
      dose: 20, ratio: 15, temp: 93, grind: 5,
      steps: {
        it: (d, w) => [
          `Macinatura medio-grossa. Sciacqua il filtro, aggiungi ${W(d)} di caffè e livella.`,
          `${T('0:00')} — 1ª versata: ${W(w * 0.2)} <b>con energia</b>, partendo dal centro e allargando. Attendi ~30 s.`,
          `2ª versata: altri ${W(w * 0.2)} (tot ${W(w * 0.4)}) appena il letto smette quasi di gocciolare.`,
          `3ª versata: fino a ${W(w * 0.6)} totali, sempre quando il letto è quasi asciutto.`,
          `4ª versata: fino a ${W(w * 0.8)} totali.`,
          `5ª versata: fino a ${W(w)} totali. Niente swirl né stir. Fine entro ~${T('3:30')}.`
        ],
        en: (d, w) => [
          `Medium-coarse grind. Rinse the filter, add ${W(d)} of coffee and level.`,
          `${T('0:00')} — 1st pour: ${W(w * 0.2)} <b>aggressively</b>, centre first then outwards. Wait ~30 s.`,
          `2nd pour: another ${W(w * 0.2)} (total ${W(w * 0.4)}) as soon as the bed nearly stops dripping.`,
          `3rd pour: up to ${W(w * 0.6)} total, again when the bed is nearly dry.`,
          `4th pour: up to ${W(w * 0.8)} total.`,
          `5th pour: up to ${W(w)} total. No swirl, no stir. Done by ~${T('3:30')}.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 210,
        steps: [
          { at: 0, title: en ? '1st pour' : '1ª versata', detail: en ? `${fmt(w * 0.2)} g, aggressive, centre out` : `${fmt(w * 0.2)} g con energia, dal centro` },
          { at: 40, title: en ? '2nd pour' : '2ª versata', detail: en ? `Up to ${fmt(w * 0.4)} g when bed is nearly dry` : `Fino a ${fmt(w * 0.4)} g quando il letto è quasi asciutto` },
          { at: 80, title: en ? '3rd pour' : '3ª versata', detail: en ? `Up to ${fmt(w * 0.6)} g` : `Fino a ${fmt(w * 0.6)} g` },
          { at: 120, title: en ? '4th pour' : '4ª versata', detail: en ? `Up to ${fmt(w * 0.8)} g` : `Fino a ${fmt(w * 0.8)} g` },
          { at: 160, title: en ? '5th pour' : '5ª versata', detail: en ? `Up to ${fmt(w)} g, done by ~3:30` : `Fino a ${fmt(w)} g, fine entro ~3:30` }
        ]
      })
    },
    {
      id: 'raov60', author: 'Scott Rao', chip: 'Rao',
      title: { it: 'Metodo Rao', en: 'Rao Method' },
      cred: { it: 'consulente e autore di riferimento del caffè specialty', en: 'leading specialty coffee consultant and author' },
      desc: {
        it: 'Bloom agitato a fondo, una sola versata continua e lo "spin" finale: letto piatto ed estrazione più alta e uniforme.',
        en: 'Thoroughly agitated bloom, one continuous pour and the final "Rao spin": flat bed and higher, even extraction.'
      },
      dose: 22, ratio: 17, temp: 95, grind: 3,
      steps: {
        it: (d, w) => [
          `Sciacqua il filtro, aggiungi ${W(d)} di caffè (macinatura medio-fine) e livella.`,
          `${T('0:00')} — <b>Bloom:</b> ${W(d * 3)} e mescola subito con un cucchiaino o col dito per bagnare ogni granello.`,
          `${T('0:45')} — <b>Una sola versata continua</b> fino a ${W(w)} totali entro ${T('1:45')}, a filo lento e costante.`,
          `Subito dopo, <b>"Rao spin"</b>: una rotazione delicata per staccare i grani dalle pareti.`,
          `Drawdown entro ${T('3:00')} circa: il letto deve risultare perfettamente piatto.`
        ],
        en: (d, w) => [
          `Rinse the filter, add ${W(d)} of coffee (medium-fine grind) and level.`,
          `${T('0:00')} — <b>Bloom:</b> ${W(d * 3)} and stir immediately with a spoon or finger to wet every particle.`,
          `${T('0:45')} — <b>One continuous pour</b> up to ${W(w)} total by ${T('1:45')}, slow and steady.`,
          `Right after, the <b>"Rao spin"</b>: a gentle swirl to knock grounds off the walls.`,
          `Drawdown by about ${T('3:00')}: the bed should end up perfectly flat.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 180,
        steps: [
          { at: 0, title: 'Bloom + stir', detail: en ? `${fmt(d * 3)} g, stir to wet everything` : `${fmt(d * 3)} g, mescola per bagnare tutto` },
          { at: 45, title: en ? 'Continuous pour' : 'Versata continua', detail: en ? `Up to ${fmt(w)} g total by 1:45` : `Fino a ${fmt(w)} g totali entro 1:45` },
          { at: 105, title: 'Rao spin', detail: en ? 'Gentle swirl, then let it drain' : 'Rotazione delicata, poi lascia drenare' }
        ]
      })
    }
  ],
  aeropress: [
    {
      id: 'hoffmannap', author: 'James Hoffmann', chip: 'Ultimate · Hoffmann',
      title: { it: 'Ultimate AeroPress', en: 'Ultimate AeroPress' },
      cred: { it: 'campione World Barista Championship 2007', en: '2007 World Barista Champion' },
      desc: {
        it: 'Niente risciacquo né preriscaldo, acqua appena bollita, 2 minuti di attesa, swirl e pressione dolce.',
        en: 'No rinse, no preheat, water just off the boil, 2-minute wait, swirl and a gentle press.'
      },
      dose: 11, ratio: 18, temp: 96, grind: 2,
      steps: {
        it: (d, w) => [
          `Filtro nel cappuccio <b>senza risciacquo</b>, AeroPress dritta sul server. Aggiungi ${W(d)} (macinatura medio-fine).`,
          `${T('0:00')} — Versa ${W(w)} di acqua <b>appena bollita</b>, bagnando tutto il caffè.`,
          `Inserisci subito lo stantuffo di ~1 cm: il vuoto ferma il gocciolamento.`,
          `Attendi fino a ${T('2:00')}, poi solleva appena e fai roteare (swirl) delicatamente.`,
          `${T('2:30')} — Premi con dolcezza per ~30 secondi, fermandoti al sibilo. Totale ~${T('3:00')}.`
        ],
        en: (d, w) => [
          `Filter in the cap, <b>no rinse</b>, AeroPress upright on the server. Add ${W(d)} (medium-fine grind).`,
          `${T('0:00')} — Pour ${W(w)} of water <b>just off the boil</b>, wetting all the coffee.`,
          `Immediately insert the plunger ~1 cm: the vacuum stops the dripping.`,
          `Wait until ${T('2:00')}, then lift slightly and gently swirl.`,
          `${T('2:30')} — Press gently for ~30 seconds, stop at the hiss. Total ~${T('3:00')}.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 180,
        steps: [
          { at: 0, title: en ? 'Pour + plunger' : 'Versa + stantuffo', detail: en ? `${fmt(w)} g all at once, plunger 1 cm in` : `${fmt(w)} g in un colpo, stantuffo dentro di 1 cm` },
          { at: 120, title: 'Swirl', detail: en ? 'Gentle swirl' : 'Rotea delicatamente' },
          { at: 150, title: en ? 'Press' : 'Premi', detail: en ? '~30 s, gentle pressure' : '~30 s, pressione dolce' }
        ]
      })
    },
    {
      id: 'adler', author: 'Alan Adler', chip: 'Originale · Adler',
      title: { it: 'Ricetta originale', en: 'Original recipe' },
      cred: { it: 'inventore dell\'AeroPress', en: 'inventor of the AeroPress' },
      desc: {
        it: 'La ricetta del manuale: concentrato stile espresso a 80 °C in un minuto, da allungare a piacere.',
        en: 'The manual\'s recipe: espresso-style concentrate at 80 °C in one minute, to be diluted to taste.'
      },
      dose: 14, ratio: 6, temp: 80, grind: 2,
      steps: {
        it: (d, w) => [
          `Filtro nel cappuccio, avvita e appoggia su una tazza robusta. Aggiungi ${W(d)} macinato fine.`,
          `Versa ${W(w)} di acqua a <b>80 °C</b> (una temperatura bassa è la scelta deliberata di Adler).`,
          `Mescola per <b>10 secondi</b>.`,
          `Premi dolcemente per 20–40 secondi, fermandoti al sibilo.`,
          `È un concentrato: bevilo così stile espresso o allunga con acqua calda stile americano.`
        ],
        en: (d, w) => [
          `Filter in the cap, screw on and place on a sturdy mug. Add ${W(d)} of fine grind.`,
          `Pour ${W(w)} of water at <b>80 °C</b> (the low temperature is Adler's deliberate choice).`,
          `Stir for <b>10 seconds</b>.`,
          `Press gently for 20–40 seconds, stop at the hiss.`,
          `It's a concentrate: drink as-is espresso-style, or top up with hot water americano-style.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'manual',
        steps: en ? [
          `Filter in cap, ${fmt(d)} g fine grind in the chamber`,
          `Pour ${fmt(w)} g of water at 80 °C`,
          'Stir 10 seconds',
          'Press gently 20–40 s',
          'Dilute to taste'
        ] : [
          `Filtro nel cappuccio, ${fmt(d)} g macinato fine`,
          `Versa ${fmt(w)} g d'acqua a 80 °C`,
          'Mescola 10 secondi',
          'Premi dolcemente 20–40 s',
          'Allunga a piacere'
        ]
      })
    },
    {
      id: 'wendelboe', author: 'Tim Wendelboe', chip: 'Wendelboe',
      title: { it: 'Ricetta standard', en: 'Standard recipe' },
      cred: { it: 'campione World Barista Championship 2004', en: '2004 World Barista Champion' },
      desc: {
        it: 'Acqua a 96°, esattamente 3 giri di cucchiaino prima e dopo il minuto di infusione, pressione col peso del corpo.',
        en: 'Water at 96°, exactly 3 stirs before and after the one-minute steep, press with your body weight.'
      },
      dose: 14, ratio: 14.5, temp: 96, grind: 2,
      steps: {
        it: (d, w) => [
          `Sciacqua il filtro per 10 secondi. AeroPress dritta sul server, aggiungi ${W(d)} macinato fine.`,
          `${T('0:00')} — Versa ${W(w)} d'acqua a 96 °C e mescola <b>esattamente 3 volte</b> avanti e indietro.`,
          `Appoggia lo stantuffo sulla camera (il vuoto ferma il gocciolamento) e attendi ${T('1:00')}.`,
          `Togli lo stantuffo e mescola <b>di nuovo 3 volte</b>: né di più né di meno, cambia l'estrazione.`,
          `Premi col peso del corpo, senza forzare, per ~30 secondi. Totale ~${T('2:00')}.`
        ],
        en: (d, w) => [
          `Rinse the filter for 10 seconds. AeroPress upright on the server, add ${W(d)} of fine grind.`,
          `${T('0:00')} — Pour ${W(w)} of water at 96 °C and stir <b>exactly 3 times</b> back and forth.`,
          `Rest the plunger on the chamber (the vacuum stops the dripping) and wait ${T('1:00')}.`,
          `Remove the plunger and stir <b>3 more times</b>: no more, no less — it changes the extraction.`,
          `Press with your body weight, no forcing, for ~30 seconds. Total ~${T('2:00')}.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 120,
        steps: [
          { at: 0, title: en ? 'Pour + 3 stirs' : 'Versa + 3 giri', detail: en ? `${fmt(w)} g at 96 °C, stir 3 times, plunger on top` : `${fmt(w)} g a 96 °C, 3 giri, stantuffo appoggiato` },
          { at: 60, title: en ? '3 stirs + press' : '3 giri + premi', detail: en ? 'Stir exactly 3 times, then press ~30 s' : 'Mescola esattamente 3 volte, poi premi ~30 s' }
        ]
      })
    }
  ],
  kalita: [
    {
      id: 'osmotic', author: 'Tradizione giapponese', chip: 'Osmotic flow',
      title: { it: 'Osmotic flow', en: 'Osmotic flow' },
      cred: { it: 'la tecnica dei kissaten giapponesi', en: 'the Japanese kissaten technique' },
      desc: {
        it: 'Filo d\'acqua sottile e continuo solo al centro: l\'acqua migra verso i bordi per osmosi. Tazza densa e sciropposa.',
        en: 'A thin, continuous stream only in the centre: water migrates outwards by osmosis. A dense, syrupy cup.'
      },
      dose: 16, ratio: 15, temp: 90, grind: 4,
      steps: {
        it: (d, w) => [
          `Sciacqua il filtro a ventaglio, aggiungi ${W(d)} di caffè e livella con cura.`,
          `${T('0:00')} — <b>Bloom:</b> ${W(d * 2)} versati goccia a goccia solo al centro. Attendi ${T('0:40')}.`,
          `${T('0:40')} — Versa un <b>filo sottile e continuo al centro</b>, a 2–3 cm dal letto: mai sulle pareti.`,
          `Mantieni il livello basso e costante fino a ${W(w)} totali entro ${T('2:30')}.`,
          `Lascia drenare: fine entro ${T('3:00–3:30')}. Il centro scuro e i bordi chiari sono normali.`
        ],
        en: (d, w) => [
          `Rinse the fan filter, add ${W(d)} of coffee and level carefully.`,
          `${T('0:00')} — <b>Bloom:</b> ${W(d * 2)} poured drop by drop only in the centre. Wait ${T('0:40')}.`,
          `${T('0:40')} — Pour a <b>thin, continuous stream in the centre</b>, 2–3 cm above the bed: never on the walls.`,
          `Keep the level low and steady up to ${W(w)} total by ${T('2:30')}.`,
          `Let it drain: done by ${T('3:00–3:30')}. A dark centre and pale edges are normal.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 200,
        steps: [
          { at: 0, title: 'Bloom', detail: en ? `${fmt(d * 2)} g drop by drop in the centre` : `${fmt(d * 2)} g goccia a goccia al centro` },
          { at: 40, title: en ? 'Continuous centre stream' : 'Filo continuo al centro', detail: en ? `Thin stream up to ${fmt(w)} g by 2:30` : `Filo sottile fino a ${fmt(w)} g entro 2:30` },
          { at: 150, title: 'Drawdown', detail: en ? 'Let it drain until the end' : 'Lascia drenare fino alla fine' }
        ]
      })
    }
  ],
  switch: [
    {
      id: 'kasuyahybrid', author: 'Tetsu Kasuya', chip: 'Hybrid · Kasuya',
      title: { it: 'Metodo Hybrid', en: 'Hybrid Method' },
      cred: { it: 'campione World Brewers Cup 2016', en: '2016 World Brewers Cup champion' },
      desc: {
        it: 'Percolazione a 93° per dolcezza e acidità, poi immersione finale a 70° per un corpo pulito senza amaro.',
        en: 'Pour-over at 93° for sweetness and acidity, then a final 70° immersion for a clean body without bitterness.'
      },
      dose: 20, ratio: 14, temp: 93, grind: 4,
      steps: {
        it: (d, w) => [
          `Valvola <b>aperta</b>, filtro sciacquato. Aggiungi ${W(d)} di caffè (macinatura media).`,
          `${T('0:00')} — 1ª versata: ${W(d * 3)} a 93 °C, dal centro verso l'esterno.`,
          `${T('0:45')} — 2ª versata: fino a ${W(d * 6)} totali. Intanto <b>abbassa l'acqua a ~70 °C</b> aggiungendo acqua fredda al bollitore.`,
          `${T('1:15')} — <b>Chiudi la valvola</b> e versa ${W(w - d * 6)} a 70 °C (totale ${W(w)}).`,
          `${T('1:45')} — <b>Apri la valvola</b> e lascia drenare.`,
          `Drawdown entro ${T('3:00')} circa. Se risulta troppo forte, allunga con poca acqua calda.`
        ],
        en: (d, w) => [
          `Valve <b>open</b>, rinsed filter. Add ${W(d)} of coffee (medium grind).`,
          `${T('0:00')} — 1st pour: ${W(d * 3)} at 93 °C, centre outwards.`,
          `${T('0:45')} — 2nd pour: up to ${W(d * 6)} total. Meanwhile <b>cool your water to ~70 °C</b> by adding cold water to the kettle.`,
          `${T('1:15')} — <b>Close the valve</b> and pour ${W(w - d * 6)} at 70 °C (total ${W(w)}).`,
          `${T('1:45')} — <b>Open the valve</b> and let it drain.`,
          `Drawdown by about ${T('3:00')}. If too strong, top up with a little hot water.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 180,
        steps: [
          { at: 0, title: en ? '1st pour (valve open)' : '1ª versata (valvola aperta)', detail: `${fmt(d * 3)} g · 93 °C` },
          { at: 45, title: en ? '2nd pour' : '2ª versata', detail: en ? `Up to ${fmt(d * 6)} g total · cool water to 70 °C` : `Fino a ${fmt(d * 6)} g totali · porta l'acqua a 70 °C` },
          { at: 75, title: en ? 'Close valve + pour' : 'Chiudi valvola + versa', detail: en ? `${fmt(w - d * 6)} g at 70 °C (total ${fmt(w)} g)` : `${fmt(w - d * 6)} g a 70 °C (totale ${fmt(w)} g)` },
          { at: 105, title: en ? 'Open valve' : 'Apri la valvola', detail: en ? 'Let it drain until ~3:00' : 'Lascia drenare fino a ~3:00' }
        ]
      })
    },
    {
      id: 'hoffmannswitch', author: 'James Hoffmann', chip: 'Immersione · Hoffmann',
      title: { it: 'Immersione + drenaggio', en: 'Immersion + drain' },
      cred: { it: 'campione World Barista Championship 2007', en: '2007 World Barista Champion' },
      desc: {
        it: 'Tutta l\'infusione a valvola chiusa con stir a metà, poi apertura e drenaggio: semplicissima e ripetibile.',
        en: 'The whole steep with the valve closed and a mid-brew stir, then open and drain: dead simple and repeatable.'
      },
      dose: 20, ratio: 16.5, temp: 95, grind: 4,
      steps: {
        it: (d, w) => [
          `Valvola <b>chiusa</b>, filtro sciacquato e Switch preriscaldato. Aggiungi ${W(d)} di caffè con una fossetta al centro.`,
          `${T('0:00')} — <b>Bloom:</b> versa ${W(d * 3)} bagnando tutto il caffè, poi swirl delicato.`,
          `${T('0:45')} — Versa a spirale fino a ${W(w)} totali entro ${T('1:30')}. Valvola sempre chiusa.`,
          `${T('2:00')} — Mescola delicatamente 2–3 volte col cucchiaino.`,
          `${T('2:30')} — <b>Apri la valvola</b> e lascia drenare completamente.`,
          `Fine entro ${T('3:30')}. Swirl finale nella server e servi.`
        ],
        en: (d, w) => [
          `Valve <b>closed</b>, rinsed filter, preheated Switch. Add ${W(d)} of coffee with a small well in the centre.`,
          `${T('0:00')} — <b>Bloom:</b> pour ${W(d * 3)} wetting all the coffee, then a gentle swirl.`,
          `${T('0:45')} — Spiral pour up to ${W(w)} total by ${T('1:30')}. Valve stays closed.`,
          `${T('2:00')} — Stir gently 2–3 times with a spoon.`,
          `${T('2:30')} — <b>Open the valve</b> and let it drain completely.`,
          `Done by ${T('3:30')}. Final swirl in the server and serve.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'guided', total: 210,
        steps: [
          { at: 0, title: en ? 'Bloom (valve closed)' : 'Bloom (valvola chiusa)', detail: en ? `${fmt(d * 3)} g + gentle swirl` : `${fmt(d * 3)} g + swirl delicato` },
          { at: 45, title: en ? 'Pour to full' : 'Versa tutto', detail: en ? `Up to ${fmt(w)} g total by 1:30` : `Fino a ${fmt(w)} g totali entro 1:30` },
          { at: 120, title: 'Stir', detail: en ? 'Gently, 2–3 times' : 'Delicato, 2–3 volte' },
          { at: 150, title: en ? 'Open valve' : 'Apri la valvola', detail: en ? 'Full drain by 3:30' : 'Drenaggio completo entro 3:30' }
        ]
      })
    }
  ],
  moka: [
    {
      id: 'tradizionale', author: 'Tradizione italiana', chip: 'Tradizionale',
      title: { it: 'Metodo tradizionale', en: 'Traditional method' },
      cred: { it: 'la moka come si è sempre fatta', en: 'the moka as it\'s always been made' },
      desc: {
        it: 'Acqua fredda, rapporto più intenso e fiamma bassa: più corpo e il profilo classico della moka di casa.',
        en: 'Cold water, a stronger ratio and low flame: more body and the classic homestyle moka profile.'
      },
      dose: 20, ratio: 8,
      steps: {
        it: (d, w) => [
          `Riempi la caldaia con ${W(w)} di acqua <b>fredda</b> fino alla valvola.`,
          `Riempi il filtro con ${W(d)} di caffè formando una leggera montagnetta, senza pressare.`,
          `Avvita bene e metti su <b>fiamma bassa</b>, coperchio chiuso.`,
          `Quando senti il caffè salire, apri il coperchio e controlla il flusso.`,
          `Al primo borbottio togli dal fuoco: l'erogazione finirà con il calore residuo. Mescola e servi.`
        ],
        en: (d, w) => [
          `Fill the boiler with ${W(w)} of <b>cold</b> water up to the valve.`,
          `Fill the basket with ${W(d)} of coffee forming a slight mound, without tamping.`,
          `Screw on tightly and place on a <b>low flame</b>, lid closed.`,
          `When you hear the coffee rising, open the lid and watch the flow.`,
          `At the first gurgle remove from heat: residual heat finishes the brew. Stir and serve.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'manual',
        steps: en ? [
          `Boiler with ${fmt(w)} g of cold water to the valve`,
          `Basket with ${fmt(d)} g, slight mound, no tamping`,
          'Low flame, lid closed',
          'Coffee rising → open lid and watch',
          'First gurgle → off the heat, stir and serve'
        ] : [
          `Caldaia con ${fmt(w)} g di acqua fredda fino alla valvola`,
          `Filtro con ${fmt(d)} g, montagnetta leggera, senza pressare`,
          'Fiamma bassa, coperchio chiuso',
          'Caffè che sale → apri il coperchio e controlla',
          'Primo borbottio → via dal fuoco, mescola e servi'
        ]
      })
    },
    {
      id: 'hoffmannmoka', author: 'James Hoffmann', chip: 'Hoffmann',
      title: { it: 'Moka tecnica', en: 'Technical moka' },
      cred: { it: 'campione World Barista Championship 2007', en: '2007 World Barista Champion' },
      desc: {
        it: 'Acqua già calda, filtro di carta sopra il caffè e stop anticipato: la moka più pulita e dolce possibile.',
        en: 'Pre-heated water, a paper filter on top of the basket and an early cut: the cleanest, sweetest moka possible.'
      },
      dose: 18, ratio: 10,
      steps: {
        it: (d, w) => [
          `Riempi la caldaia con ${W(w)} di acqua <b>già calda</b> fino alla valvola.`,
          `Riempi il filtro con ${W(d)} di caffè, raso e senza pressare. Appoggia sopra un <b>filtro di carta</b> (tipo AeroPress) bagnato: tazza più pulita.`,
          `Avvita con un panno e metti su fuoco <b>medio-basso</b>, coperchio aperto.`,
          `Il caffè deve salire con un flusso lento e cremoso: se sputacchia, abbassa il fuoco.`,
          `Appena il flusso diventa chiaro o senti il gorgoglio, <b>togli dal fuoco e raffredda la base</b> sotto acqua fredda: fermi l'estrazione sul dolce.`
        ],
        en: (d, w) => [
          `Fill the boiler with ${W(w)} of <b>pre-heated</b> water up to the valve.`,
          `Fill the basket with ${W(d)} of coffee, level, no tamping. Place a wet <b>paper filter</b> (AeroPress type) on top: cleaner cup.`,
          `Screw on with a cloth and place on <b>medium-low</b> heat, lid open.`,
          `The coffee should rise slow and creamy: if it sputters, lower the heat.`,
          `As soon as the flow turns pale or gurgles, <b>remove from heat and cool the base</b> under cold water: you stop the extraction on the sweet side.`
        ]
      },
      timer: (d, w, en) => ({
        type: 'manual',
        steps: en ? [
          `Boiler with ${fmt(w)} g of hot water to the valve`,
          `${fmt(d)} g in the basket + wet paper filter on top`,
          'Medium-low heat, lid open',
          'Slow creamy flow → lower heat if it sputters',
          'Pale flow or gurgle → off heat, cool the base'
        ] : [
          `Caldaia con ${fmt(w)} g di acqua calda fino alla valvola`,
          `${fmt(d)} g nel filtro + filtro di carta bagnato sopra`,
          'Fuoco medio-basso, coperchio aperto',
          'Flusso lento e cremoso → abbassa se sputacchia',
          'Flusso chiaro o gorgoglio → via dal fuoco, raffredda la base'
        ]
      })
    }
  ],
  coldbrew: [
    {
      id: 'hoffmanncb', author: 'James Hoffmann', chip: 'Metodo Hoffmann',
      title: { it: 'Cold brew 12 ore', en: '12-hour cold brew' },
      cred: { it: 'campione World Barista Championship 2007', en: '2007 World Barista Champion' },
      desc: {
        it: 'Pronto da bere a 60 g/L, 12 ore esatte in frigo e doppia filtrazione: pulito, dolce, mai amaro.',
        en: 'Ready to drink at 60 g/L, exactly 12 hours in the fridge and double filtration: clean, sweet, never bitter.'
      },
      dose: 60, ratio: 16, cbMode: 'rtd',
      steps: {
        it: (d, w) => [
          `Macina medio-grossa ${W(d)} di caffè e mettilo nel contenitore.`,
          `Versa ${W(w)} di acqua fredda (≈ 60 g/L) e mescola bene per bagnare tutto.`,
          `Copri e metti in <b>frigo per 12 ore esatte</b>: oltre le 14 ore aumenta solo l'amaro.`,
          `Filtra due volte: prima colino a maglia fine, poi filtro di carta per una tazza limpida.`,
          `Pronto da bere liscio con ghiaccio. In frigo si conserva fino a 1 settimana.`
        ],
        en: (d, w) => [
          `Grind ${W(d)} of coffee medium-coarse and place it in the container.`,
          `Pour ${W(w)} of cold water (≈ 60 g/L) and stir well to wet everything.`,
          `Cover and refrigerate for <b>exactly 12 hours</b>: beyond 14 hours you only gain bitterness.`,
          `Filter twice: fine mesh strainer first, then a paper filter for a clean cup.`,
          `Ready to drink straight over ice. Keeps in the fridge up to 1 week.`
        ]
      },
      timer: (d, w, en) => ({ type: 'longform', hours: 12, dose: d, water: w })
    },
    {
      id: 'toddy', author: 'Toddy', chip: 'Toddy classico',
      title: { it: 'Concentrato Toddy', en: 'Toddy concentrate' },
      cred: { it: 'la ricetta ufficiale del sistema che ha reso famoso il cold brew', en: 'the official recipe of the system that made cold brew famous' },
      desc: {
        it: 'Concentrato 1:5 a temperatura ambiente con bagnatura a strati e senza mescolare: da diluire 1:2 o 1:3.',
        en: 'A 1:5 room-temperature concentrate with layered wetting and no stirring: dilute 1:2 or 1:3.'
      },
      dose: 100, ratio: 5, cbMode: 'conc',
      steps: {
        it: (d, w) => [
          `Macina <b>grossa</b> ${W(d)} di caffè.`,
          `Versa metà dell'acqua (${W(w / 2)}) nel contenitore, poi aggiungi il caffè <b>a strati, senza mescolare</b>.`,
          `Attendi 5 minuti, poi versa lentamente il resto dell'acqua (${W(w / 2)}) bagnando i grani asciutti in superficie. Premi delicatamente con il dorso di un cucchiaio, ma <b>non mescolare</b>.`,
          `Copri e lascia in infusione <b>12–24 ore a temperatura ambiente</b> (consigliate ~16).`,
          `Filtra senza strizzare. <b>Diluizione:</b> 1 parte di concentrato + 2–3 di acqua o latte, anche caldo.`,
          `Il concentrato si conserva in frigo fino a 2 settimane.`
        ],
        en: (d, w) => [
          `Grind ${W(d)} of coffee <b>coarse</b>.`,
          `Pour half the water (${W(w / 2)}) into the container, then add the coffee <b>in layers, without stirring</b>.`,
          `Wait 5 minutes, then slowly pour the remaining water (${W(w / 2)}) wetting the dry grounds on top. Press gently with the back of a spoon, but <b>do not stir</b>.`,
          `Cover and steep <b>12–24 hours at room temperature</b> (~16 recommended).`,
          `Filter without squeezing. <b>Dilution:</b> 1 part concentrate + 2–3 parts water or milk, hot works too.`,
          `The concentrate keeps in the fridge up to 2 weeks.`
        ]
      },
      timer: (d, w, en) => ({ type: 'longform', hours: 16, dose: d, water: w })
    }
  ]
};
function activeRecipe(key) {
  const v = state.vals && state.vals[key];
  if (!v || !v.recipe || !RECIPES[key]) return null;
  return RECIPES[key].find(r => r.id === v.recipe) || null;
}
