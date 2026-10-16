// RB-FIX-2: an empty-string schedule field means "not provided", never "blank
// the stored value" (a client once sent frequency:"" and wiped the row).
export function ignoreEmptyString<T>(value: T): T | undefined {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}
