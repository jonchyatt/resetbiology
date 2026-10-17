import type { Patron } from '../../src/config/patrons'

// Synthetic names only (project rule 4). None of these is a real person.
export const SYNTHETIC_PATRONS: Patron[] = [
  { displayName: 'Sample Patron A', tier: 'founding', consented: true },
  { displayName: 'Sample Patron B', tier: 'supporter', consented: true },
  { displayName: 'Sample Patron C (no consent)', tier: 'supporter', consented: false },
]
