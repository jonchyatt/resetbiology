// RB-FIX-2: the journal line for a logged dose belongs to the MEMBER's day
// (the dose row's localDate), never the server's/UTC day. JournalEntry.date
// stores the day key as UTC midnight (dayKeyToUtcMidnight), same as foods/log.
import { dayKeyToUtcMidnight, isValidDayKey, localDayKey } from '@/lib/localDay'

// RB-FIX-3: every dose adds its own line; earlier lines are never replaced,
// and only an exact duplicate line is skipped.
const NL = String.fromCharCode(10)

export function appendNoteLine(current: unknown, line: string): string {
  const cur = typeof current === 'string' ? current : ''
  if (!cur) return line
  return cur.split(NL).includes(line) ? cur : cur + NL + line
}

// Dashboard saves send their own (possibly stale) peptideNotes; keep any lines
// already stored for the day and add the incoming ones after them.
export function mergeNoteLines(stored: unknown, incoming: unknown): string {
  let out = typeof stored === 'string' ? stored : ''
  for (const line of (typeof incoming === 'string' ? incoming : '').split(NL)) {
    if (line) out = appendNoteLine(out, line)
  }
  return out
}

type JournalDb = {
  journalEntry: {
    findFirst: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
    create: (args: any) => Promise<any>
  }
}

export async function appendPeptideDoseToJournal(
  db: JournalDb,
  userId: string,
  doseDate: Date,
  localDate: unknown,
  payload: { peptideName: string; dosage: string; timeLabel: string },
) {
  const dayKey = isValidDayKey(localDate) ? localDate : localDayKey(doseDate)
  const dayStart = dayKeyToUtcMidnight(dayKey)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const existing = await db.journalEntry.findFirst({
    where: { userId, date: { gte: dayStart, lt: dayEnd } },
    orderBy: { createdAt: 'asc' },
  })

  const note = `${payload.peptideName} dose ${payload.dosage} at ${payload.timeLabel}`

  if (existing) {
    let entryData: any = {}
    try {
      entryData = existing.entry ? JSON.parse(existing.entry as string) : {}
    } catch {
      entryData = {}
    }

    entryData.peptideNotes = appendNoteLine(entryData.peptideNotes, note)

    const tasksCompleted = typeof entryData.tasksCompleted === 'object' && entryData.tasksCompleted !== null
      ? { ...entryData.tasksCompleted }
      : {}
    tasksCompleted.peptides = true
    entryData.tasksCompleted = tasksCompleted

    await db.journalEntry.update({
      where: { id: existing.id },
      data: { entry: JSON.stringify(entryData) },
    })
  } else {
    const entryData = {
      reasonsValidation: '',
      affirmationGoal: '',
      affirmationBecause: '',
      affirmationMeans: '',
      peptideNotes: note,
      workoutNotes: '',
      nutritionNotes: '',
      breathNotes: '',
      moduleNotes: '',
      tasksCompleted: { peptides: true },
      localDate: dayKey,
    }

    await db.journalEntry.create({
      data: {
        userId,
        entry: JSON.stringify(entryData),
        mood: null,
        weight: null,
        date: dayStart,
      },
    })
  }
}
