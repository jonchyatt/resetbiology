export type LocalDateTime = {
  localDate: string
  localTime: string
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = LOCAL_DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

export function localDateToUtcStart(localDate: string): Date {
  if (!isLocalDate(localDate)) {
    throw new Error('Invalid local date')
  }
  return new Date(`${localDate}T00:00:00.000Z`)
}

export function getLocalDateTime(date: Date = new Date()): LocalDateTime {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return {
    localDate: `${year}-${month}-${day}`,
    localTime: `${hours}:${minutes}:${seconds}`,
  }
}

// FoodLog IDs are Mongo ObjectIds. Supplying the ID from the browser makes a
// retried request atomic: Mongo's primary-key uniqueness prevents a second log.
export function createFoodLogRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}