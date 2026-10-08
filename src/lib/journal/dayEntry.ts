import { createHash } from 'node:crypto'

export function journalEntryIdForDay(userId: string, localDate: string): string {
  return createHash('sha256')
    .update(`${userId}:${localDate}`)
    .digest('hex')
    .slice(0, 24)
}
