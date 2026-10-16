// RB-FIX-2: the journal line for a logged dose belongs to the MEMBER's day
// (the dose row's localDate), never the server's/UTC day. JournalEntry.date
// stores the day key as UTC midnight (dayKeyToUtcMidnight), same as foods/log.
import { dayKeyToUtcMidnight, isValidDayKey, localDayKey } from '@/lib/localDay'

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
  })

  const note = `${payload.peptideName} dose ${payload.dosage} at ${payload.timeLabel}`

  if (existing) {
    let entryData: any = {}
    try {
      entryData = existing.entry ? JSON.parse(existing.entry as string) : {}
    } catch {
      entryData = {}
    }

    const previous = typeof entryData.peptideNotes === 'string' && entryData.peptideNotes.length > 0 ? `${entryData.peptideNotes}\n` : ''
    entryData.peptideNotes = `${previous}${note}`

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
