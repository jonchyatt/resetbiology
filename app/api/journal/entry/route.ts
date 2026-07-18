import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { enqueueDriveSync } from '@/lib/driveSyncQueue'
import { getDriveClient, getSubfolderId, uploadTextFile, formatJournalEntry } from '@/lib/google-drive'
import { parseJournalDayFile } from '@/lib/journal-day-file'
import { gatherAuthorityContext, computeAuthorityActive, decideJournalRead } from '@/lib/drive-read-authority'

type TasksPayload = Record<string, boolean>

type EntryPayload = {
  reasonsValidation: string
  affirmationGoal: string
  affirmationBecause: string
  affirmationMeans: string
  peptideNotes: string
  workoutNotes: string
  nutritionNotes: string
  breathNotes: string
  moduleNotes: string
  tasksCompleted: TasksPayload
}

const JOURNAL_DOMAIN = 'journal'

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toUtcDateStr(date: Date): string {
  // Canonical key (D-C5): UTC ISO calendar date of the instant — matches
  // live sync (google-drive.ts getDateWindow) and the migration harness.
  return date.toISOString().split('T')[0]
}

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeTasks(value: unknown): TasksPayload {
  if (!value || typeof value !== 'object') return {}
  const out: TasksPayload = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'boolean') {
      out[key] = val
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Drive I/O glue for the journal day file (Phase C, cf-c2-journal-inversion).
// Authority gating lives in drive-read-authority.ts; this route owns the
// actual Drive read/write calls, same separation as protocols-store.ts.
// ---------------------------------------------------------------------------

async function journalFolderFor(userId: string): Promise<
  | { ok: true; drive: Awaited<ReturnType<typeof getDriveClient>>; journalFolderId: string }
  | { ok: false; error: string }
> {
  const drive = await getDriveClient(userId)
  if (!drive) return { ok: false, error: 'Google Drive not connected' }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolder: true },
  })
  if (!user?.driveFolder) return { ok: false, error: 'No Drive vault folder configured' }

  const journalFolderId = await getSubfolderId(drive, user.driveFolder, 'Journal')
  if (!journalFolderId) return { ok: false, error: 'Could not access Journal Drive folder' }

  return { ok: true, drive, journalFolderId }
}

async function fetchJournalDayFile(
  userId: string,
  dateStr: string
): Promise<{ found: true; content: string; modifiedTime: Date } | { found: false }> {
  const location = await journalFolderFor(userId)
  if (!location.ok) throw new Error(location.error)
  const { drive, journalFolderId } = location

  const fileName = `journal-${dateStr}.md`
  const list = await drive!.files.list({
    q: `name='${fileName}' and '${journalFolderId}' in parents and trashed=false`,
    fields: 'files(id, modifiedTime)',
  })
  const file = list.data.files?.[0]
  if (!file?.id) return { found: false }

  const contentRes = await drive!.files.get({ fileId: file.id, alt: 'media' })
  const content = typeof contentRes.data === 'string' ? contentRes.data : JSON.stringify(contentRes.data)
  return { found: true, content, modifiedTime: new Date(file.modifiedTime || Date.now()) }
}

function stableIdForDegradedEntry(content: string | null): string {
  // ponytail: a hand-edited file that lost its front matter has no rowId to
  // key on. A content hash keeps that section stable across re-reads/writes
  // of the same unedited text without building front-matter recovery
  // heuristics here. Upgrade path: reconstruction heuristics if this shows
  // up in production telemetry.
  return `legacy-${createHash('sha1').update(content ?? '').digest('hex').slice(0, 20)}`
}

async function writeJournalDayFileEntry(
  userId: string,
  dateStr: string,
  row: {
    rowId: string
    createdAt: Date
    content: string
    mood: string | null
    weight: number | null
    payload: Record<string, unknown>
  }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const location = await journalFolderFor(userId)
    if (!location.ok) return { success: false, error: location.error }
    const { drive, journalFolderId } = location

    const fileName = `journal-${dateStr}.md`
    const existing = await drive!.files.list({
      q: `name='${fileName}' and '${journalFolderId}' in parents and trashed=false`,
      fields: 'files(id)',
    })
    const existingFileId = existing.data.files?.[0]?.id

    let otherEntries: Array<{ rowId: string; createdAt: Date; content: string; mood?: string | null; weight?: number | null; payload?: Record<string, unknown> | null }> = []
    if (existingFileId) {
      const contentRes = await drive!.files.get({ fileId: existingFileId, alt: 'media' })
      const raw = typeof contentRes.data === 'string' ? contentRes.data : JSON.stringify(contentRes.data)
      const parsed = parseJournalDayFile(raw)
      otherEntries = parsed
        .map((e) => ({
          rowId: e.rowId ?? stableIdForDegradedEntry(e.content),
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(0),
          content: e.content ?? '',
          mood: e.mood,
          weight: e.weight,
          // Fix-wave 2 (F1): preserve a sibling same-day row's full payload
          // too — merge/replace only touches THIS entry.
          payload: e.payload,
        }))
        .filter((e) => e.rowId !== row.rowId) // merge/replace: drop the section we're about to re-emit
    }

    // Shared emitter (HIGH-2: every same-day row preserved as its own
    // section — merge/replace only touches THIS entry, siblings untouched).
    const content = formatJournalEntry(dateStr, [...otherEntries, row])
    const uploadedId = await uploadTextFile(drive!, journalFolderId, fileName, content, 'text/markdown')
    if (!uploadedId) return { success: false, error: `Drive upload failed for ${fileName}` }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Drive error' }
  }
}

/**
 * Fix-wave 2 (F3): a single query serves BOTH the pending-outbox check AND
 * driveLastConfirmedAt — no new schema field, no write amplification. The
 * DriveSyncOutbox row's `updatedAt` (Prisma `@updatedAt`, auto-bumped) IS the
 * last time this user/day/domain's background drain confirmed status 'done'
 * against Drive; when status isn't 'done' there's no persisted confirmation
 * signal to report (null — never a stale guess).
 */
async function getOutboxSignal(
  userId: string,
  dateStr: string
): Promise<{ pending: boolean; lastConfirmedAt: Date | null }> {
  const row = await prisma.driveSyncOutbox.findUnique({
    where: { userId_domain_dateStr: { userId, domain: JOURNAL_DOMAIN, dateStr } },
    select: { status: true, updatedAt: true },
  })
  return {
    pending: row?.status === 'pending' || row?.status === 'inflight',
    lastConfirmedAt: row?.status === 'done' ? row.updatedAt : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const entryDate = body?.date ? new Date(body.date) : new Date()
    const dayStart = startOfDay(entryDate)
    const nextDay = new Date(dayStart)
    nextDay.setDate(nextDay.getDate() + 1)

    const entryPayload: EntryPayload = {
      reasonsValidation: normalizeString(body?.reasonsValidation),
      affirmationGoal: normalizeString(body?.affirmationGoal),
      affirmationBecause: normalizeString(body?.affirmationBecause),
      affirmationMeans: normalizeString(body?.affirmationMeans),
      peptideNotes: normalizeString(body?.peptideNotes),
      workoutNotes: normalizeString(body?.workoutNotes),
      nutritionNotes: normalizeString(body?.nutritionNotes),
      breathNotes: normalizeString(body?.breathNotes),
      moduleNotes: normalizeString(body?.moduleNotes),
      tasksCompleted: normalizeTasks(body?.tasksCompleted)
    }

    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: dayStart,
          lt: nextDay
        }
      }
    })

    let previous: EntryPayload | Record<string, unknown> = {}
    if (existingEntry) {
      try {
        previous = existingEntry.entry ? JSON.parse(existingEntry.entry as string) : {}
      } catch (error) {
        previous = {}
      }
    }

    const tasksMerged = existingEntry
      ? {
          ...(typeof (previous as any)?.tasksCompleted === 'object' ? (previous as any).tasksCompleted : {}),
          ...entryPayload.tasksCompleted,
        }
      : entryPayload.tasksCompleted

    const mergedEntry = existingEntry
      ? { ...previous, ...entryPayload, tasksCompleted: tasksMerged }
      : entryPayload

    const moodValue = normalizeString(body?.mood) || null
    const weightValue = typeof body?.weight === 'number' ? body.weight : body?.weight ? Number(body.weight) : null

    // Read-path authority gate (dark by default — see drive-read-authority.ts).
    const authorityContext = await gatherAuthorityContext(user.id)
    const authorityActive = computeAuthorityActive(authorityContext)

    let journalEntry

    if (authorityActive) {
      // Drive-first synchronous write (HIGH-1): Drive must succeed BEFORE
      // Mongo is touched — no silent custody, no Mongo-only success.
      const rowId = existingEntry?.id ?? randomBytes(12).toString('hex')
      const dateStr = toUtcDateStr(entryDate)

      const driveWrite = await writeJournalDayFileEntry(user.id, dateStr, {
        rowId,
        createdAt: existingEntry?.createdAt ?? new Date(),
        content: typeof (mergedEntry as any).content === 'string' ? (mergedEntry as any).content : '',
        mood: moodValue,
        weight: weightValue,
        // Fix-wave 2 (F1): the FULL structured entry, not just the vestigial
        // content/goals slot — this is what makes a Drive-truth read return
        // the real 10 dashboard fields instead of an empty content string.
        payload: mergedEntry as Record<string, unknown>,
      })

      if (!driveWrite.success) {
        console.error('[journal/entry POST] Drive-first write failed, Mongo NOT touched:', driveWrite.error)
        return NextResponse.json(
          {
            error:
              "Could not save to your Google Drive right now. Your entry was NOT saved — please try again once you're reconnected.",
          },
          { status: 502 }
        )
      }

      journalEntry = existingEntry
        ? await prisma.journalEntry.update({
            where: { id: existingEntry.id },
            data: { entry: JSON.stringify(mergedEntry), mood: moodValue, weight: weightValue },
          })
        : await prisma.journalEntry.create({
            data: {
              id: rowId,
              userId: user.id,
              entry: JSON.stringify(mergedEntry),
              mood: moodValue,
              weight: weightValue,
              date: entryDate,
            },
          })
    } else {
      // Authority inactive: today's path, byte-identical to pre-Phase-C behavior.
      journalEntry = existingEntry
        ? await prisma.journalEntry.update({
            where: { id: existingEntry.id },
            data: { entry: JSON.stringify(mergedEntry), mood: moodValue, weight: weightValue },
          })
        : await prisma.journalEntry.create({
            data: {
              userId: user.id,
              entry: JSON.stringify(mergedEntry),
              mood: moodValue,
              weight: weightValue,
              date: entryDate,
            },
          })
    }

    // Mark journal daily task as completed and award points once per day
    const existingTask = await prisma.dailyTask.findUnique({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: dayStart,
          taskName: 'journal'
        }
      }
    })

    let pointsAwarded = 0

    if (!existingTask || !existingTask.completed) {
      await prisma.dailyTask.upsert({
        where: {
          userId_date_taskName: {
            userId: user.id,
            date: dayStart,
            taskName: 'journal'
          }
        },
        update: { completed: true },
        create: {
          userId: user.id,
          date: dayStart,
          taskName: 'journal',
          completed: true
        }
      })

      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: 'daily_task',
          amount: 20,
          activitySource: 'journal'
        }
      })
      pointsAwarded = 20
    }

    let entryJson: any = {}
    try {
      entryJson = journalEntry.entry ? JSON.parse(journalEntry.entry as string) : {}
    } catch {
      entryJson = {}
    }

    const responsePayload = {
      success: true,
      journalEntry: {
        ...journalEntry,
        entry: entryJson,
      },
      pointsAwarded,
    }

    // Queue Google Drive sync for the entry's OWN day — historical saves/edits
    // must sync their own date, not today (awaited — Vercel freezes the lambda after the response, killing un-awaited work)
    await enqueueDriveSync(user.id, journalEntry.date, ['journal']).catch(err => console.error('Drive enqueue failed:', err))

    return NextResponse.json(responsePayload)

  } catch (error) {
    console.error('Failed to save journal entry:', error)
    return NextResponse.json(
      { error: 'Failed to save journal entry' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const journalEntry = await prisma.journalEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // Read-path authority gate (dark by default — see drive-read-authority.ts).
    const authorityContext = await gatherAuthorityContext(user.id)
    if (!computeAuthorityActive(authorityContext)) {
      // Byte-identical to pre-Phase-C behavior: the branch below never runs.
      if (journalEntry) {
        return NextResponse.json({
          ...journalEntry,
          entry: journalEntry.entry ? JSON.parse(journalEntry.entry as string) : null,
        })
      }
      return NextResponse.json({ entry: null })
    }

    // Fix-wave 2 (F4): keyed on "right now" (matches POST's entryDate default
    // of `new Date()`), NOT startOfDay(new Date()) — startOfDay is LOCAL
    // midnight, so converting it to a UTC date string could diverge from
    // POST's key by a day on a non-UTC host. `today`/`tomorrow` above remain
    // untouched — they only bound the (pre-existing, flag-off-shared) Mongo
    // row lookup, not the Drive dateStr.
    const dateStr = toUtcDateStr(new Date())

    let driveModifiedTime: Date | null = null
    let driveContent: string | null = null
    let driveReadFailed = false
    try {
      const dayFile = await fetchJournalDayFile(user.id, dateStr)
      if (dayFile.found) {
        driveModifiedTime = dayFile.modifiedTime
        driveContent = dayFile.content
      }
    } catch (err) {
      console.error('[journal/entry GET] Drive read failed:', err)
      driveReadFailed = true
    }

    const outboxSignal = await getOutboxSignal(user.id, dateStr)
    const mongoUpdatedAt = journalEntry?.updatedAt ?? journalEntry?.createdAt ?? null

    const decision = decideJournalRead({
      ...authorityContext,
      mongoUpdatedAt,
      driveModifiedTime,
      pendingOutbox: outboxSignal.pending,
      driveReadFailed,
    })

    if (decision.provenance === 'drive') {
      if (!driveContent) {
        return NextResponse.json({ entry: null, provenance: 'drive' })
      }
      const parsedEntries = parseJournalDayFile(driveContent)
      const matched =
        (journalEntry && parsedEntries.find((e) => e.rowId === journalEntry.id)) ||
        parsedEntries[parsedEntries.length - 1] ||
        null

      if (!matched) {
        return NextResponse.json({ entry: null, provenance: 'drive' })
      }

      return NextResponse.json({
        id: journalEntry?.id ?? matched.rowId ?? null,
        userId: user.id,
        date: matched.date,
        mood: matched.mood,
        weight: matched.weight,
        createdAt: matched.createdAt,
        // Fix-wave 2 (F1): the full recovered structured entry — falls back
        // to {content} only for pre-fix-wave-2 files that never got a
        // payload block, so the dashboard prefill fields survive a 'drive'
        // read instead of reading back blank.
        entry: matched.payload ?? { content: matched.content },
        provenance: 'drive',
      })
    }

    // 'syncing' or 'app-cache' (HIGH-1 / MED-3): serve the Mongo copy — a
    // just-saved entry never vanishes or reads back stale, and a Drive outage
    // (or a missing Drive file per F2) is never silent.
    const basePayload = journalEntry
      ? { ...journalEntry, entry: journalEntry.entry ? JSON.parse(journalEntry.entry as string) : null }
      : { entry: null }

    return NextResponse.json({
      ...basePayload,
      provenance: decision.provenance,
      ...(decision.provenance === 'app-cache'
        ? { mongoUpdatedAt, driveLastConfirmedAt: outboxSignal.lastConfirmedAt }
        : {}),
    })
  } catch (error) {
    console.error('Failed to load journal entry:', error)
    return NextResponse.json(
      { error: 'Failed to load journal entry' },
      { status: 500 }
    )
  }
}
