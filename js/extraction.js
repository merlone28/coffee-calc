// ===== Resa di estrazione (EY) e TDS =====
// EY (%) = TDS (%) × bevanda ottenuta (g) / caffè (g). L'intervallo 18–22 % è quello SCA per il filtro.
export const EY_TARGET = { lo: 18, hi: 22 };
// Acqua trattenuta dai fondi, in grammi per grammo di caffè (valore tipico: ~2 g/g)
export const RETAINED_WATER_PER_G = 2;
export const TDS_RANGE = { min: 0.05, max: 30 };

// Bevanda attesa quando non si pesa: acqua versata meno quella trattenuta dai fondi
export function estimateOut(water, dose) {
  return Math.max(0, water - RETAINED_WATER_PER_G * dose);
}
export function extractionYield(tds, dose, out) {
  if (!(tds > 0) || !(dose > 0) || !(out > 0)) return null;
  return tds * out / dose;
}
export function eyVerdict(ey) {
  return ey < EY_TARGET.lo ? 'under' : ey > EY_TARGET.hi ? 'over' : 'ok';
}
// Dati di estrazione di una voce del diario, o null se non ha il TDS
export function entryExtraction(e) {
  if (!e || !(e.tds > 0)) return null;
  const estimated = !(e.out > 0);
  const out = estimated ? estimateOut(e.water, e.dose) : e.out;
  const ey = extractionYield(e.tds, e.dose, out);
  return ey == null ? null : { tds: e.tds, out, estimated, ey, verdict: eyVerdict(ey) };
}
