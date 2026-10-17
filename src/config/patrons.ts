// Patron wall data. Empty on purpose: a real name is added only with that person's written consent
// (project rule 4 and red 3). Each entry must carry consented: true or it is never rendered.
export type PatronTier = 'founding' | 'supporter'

export interface Patron {
  displayName: string
  tier: PatronTier
  consented: boolean
}

export const PATRONS: Patron[] = []

export const TIER_LABEL: Record<PatronTier, string> = {
  founding: 'Founding patrons',
  supporter: 'Supporters',
}

export function visiblePatrons(patrons: Patron[]): Patron[] {
  return patrons.filter((p) => p.consented && p.displayName.trim() !== '')
}
