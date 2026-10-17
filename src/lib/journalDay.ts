// ONE way to find/append-to a member's journal entry for their LOCAL day.
// JournalEntry.date stores the member's day key as UTC midnight
// (dayKeyToUtcMidnight), so lookups must use that same [midnight, +1d) window.
// Never use the server's setHours(0,0,0,0): after 18:00 MDT (00:00 UTC) it
// misses today's entry and spawns a duplicate (RB-FIX-8 F-1).
import { dayKeyToUtcMidnight, isValidDayKey, todayLocalKey } from '@/lib/localDay'

type JournalDb = {
  journalEntry: {
    findFirst: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
    create: (args: any) => Promise<any>
  }
}

/** Member day key from a client-sent localDate, falling back to the server day. */
export function resolveDayKey(localDate: unknown): string {
  return isValidDayKey(localDate) ? localDate : todayLocalKey()
}

export function journalDayWindow(dayKey: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = dayKeyToUtcMidnight(dayKey)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
  return { dayStart, dayEnd }
}

export async function findJournalEntryForDay(db: JournalDb, userId: string, dayKey: string) {
  const { dayStart, dayEnd } = journalDayWindow(dayKey)
  return db.journalEntry.findFirst({
    where: { userId, date: { gte: dayStart, lt: dayEnd } },
    orderBy: { createdAt: 'asc' },
  })
}

const BLANK_ENTRY = {
  reasonsValidation: '',
  affirmationGoal: '',
  affirmationBecause: '',
  affirmationMeans: '',
  peptideNotes: '',
  workoutNotes: '',
  nutritionNotes: '',
  breathNotes: '',
  moduleNotes: '',
}

/** Append `note` as a new line in entry[field] for the member's day (creating the entry if none) and tick tasksCompleted[taskKey]. */
export async function appendJournalNote(
  db: JournalDb,
  userId: string,
  dayKey: string,
  field: 'workoutNotes' | 'breathNotes' | 'moduleNotes',
  note: string,
  taskKey?: string,
) {
  const existing = await findJournalEntryForDay(db, userId, dayKey)
  if (existing) {
    let entryData: any = {}
    try {
      entryData = existing.entry ? JSON.parse(existing.entry as string) : {}
    } catch {
      entryData = {}
    }
    const prev = typeof entryData[field] === 'string' && entryData[field] ? `${entryData[field]}\n` : ''
    entryData[field] = `${prev}${note}`
    if (taskKey) {
      const tasks = typeof entryData.tasksCompleted === 'object' && entryData.tasksCompleted !== null ? { ...entryData.tasksCompleted } : {}
      tasks[taskKey] = true
      entryData.tasksCompleted = tasks
    }
    await db.journalEntry.update({ where: { id: existing.id }, data: { entry: JSON.stringify(entryData) } })
    return
  }
  await db.journalEntry.create({
    data: {
      userId,
      entry: JSON.stringify({ ...BLANK_ENTRY, [field]: note, tasksCompleted: taskKey ? { [taskKey]: true } : {}, localDate: dayKey }),
      mood: null,
      weight: null,
      date: dayKeyToUtcMidnight(dayKey),
    },
  })
}
