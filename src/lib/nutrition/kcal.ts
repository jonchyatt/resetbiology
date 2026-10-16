// FDC lists Energy twice (kJ and kcal). Rows cached before the mapFdc fix can
// carry the kJ number as kcal (banana: 371 instead of 89). Rule, applied on
// every cache read:
//   flag  = kcal > 4.5*(protein+carb) + 9.5*fat + 10   (more than food can hold)
//   AND kcal/4.184 sits within 15% (+5) of the Atwater estimate 4P+4C+9F
// The second test keeps alcohol-heavy foods (vodka, wine) from being "repaired".
// Flagged rows are converted kJ -> kcal (exact, /4.184).
import type { Nutrients } from './types';

export function repairStaleKj<T extends Nutrients | null | undefined>(nutrients: T): T {
  if (!nutrients || typeof nutrients.kcal !== 'number') return nutrients;
  const p = nutrients.protein_g ?? 0;
  const c = nutrients.carb_g ?? 0;
  const f = nutrients.fat_g ?? 0;
  if (!(nutrients.kcal > 4.5 * (p + c) + 9.5 * f + 10)) return nutrients;
  const atwater = 4 * (p + c) + 9 * f;
  const asKcal = nutrients.kcal / 4.184;
  if (Math.abs(asKcal - atwater) > 0.15 * atwater + 5) return nutrients;
  return { ...nutrients, kcal: Math.round(asKcal) };
}
