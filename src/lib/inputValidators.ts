// Small input validators shared by client forms and API routes (RB-FIX-7 I-3, I-4).
export const USERNAME_RULE = 'Username: 3 to 30 characters, using letters, numbers, underscore or dot.'

export function validateUsername(v: string): string | null {
  if (!v) return null // blank = no username
  return /^[A-Za-z0-9_.]{3,30}$/.test(v) ? null : USERNAME_RULE
}

export const WEIGHT_LIMITS = { lb: [50, 1500], kg: [20, 700] } as const

export function validateWeight(value: number, unit: 'lb' | 'kg' = 'lb'): string | null {
  const [min, max] = WEIGHT_LIMITS[unit]
  if (!Number.isFinite(value) || value < min || value > max) {
    return `Weight must be between ${min} and ${max} ${unit}.`
  }
  return null
}
