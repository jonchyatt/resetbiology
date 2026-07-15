import { google, drive_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/vault-encryption'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// ---------------------------------------------------------------------------
// Vault root folder identity contract
//
// Root cause of the duplicate-folder defect (FRICTION-REGISTER.md,
// connect-walkthrough-2026-07-14-5541): the OAuth callback blindly created a
// fresh "Reset Biology Data" tree whenever the Mongo `driveFolder` pointer
// was empty — which is EVERY time, for a brand-new Auth0 user AND every time
// after a disconnect (disconnect/route.ts nulls the pointer). This function
// is the single place that decides reuse vs. create vs. fail-closed; every
// caller that creates or resolves the vault root MUST go through it.
//
// Case -> behavior:
//   0. Known account mismatch: caller supplies the Google account email that
//      owns the stored pointer and the email of the account now connecting;
//      if both are known and differ, this is someone reconnecting with a
//      DIFFERENT Google account than the one their vault lives on. Drive's
//      API can't tell this apart from "folder deleted" (both 404 the same
//      way) or from "genuinely first connect" (both list zero results) once
//      you're inside the new account's visibility — so we short-circuit on
//      the out-of-band email signal BEFORE touching Drive at all -> AMBIGUOUS,
//      never silently spin up a second vault that strands the old one.
//   1. Valid stored pointer (resolves via files.get, not trashed)
//        -> REUSE. Create nothing.
//   2. Pointer stale / deleted / 403-inaccessible
//        -> fall through to discovery (case 3+).
//   3. Discovery, exact match: search by the appProperties stamped at
//      creation time (rbVaultRoot=true, rbUserId=<auth0 sub>). Exactly one
//      hit -> REUSE (repairs the pointer). More than one -> AMBIGUOUS.
//   4. Discovery, broad match: zero exact hits, but at least one folder is
//      visible to this Drive account that is either stamped rbVaultRoot=true
//      for a DIFFERENT user, or matches the legacy name with no
//      appProperties at all (pre-contract tree) -> AMBIGUOUS. Never guess,
//      never auto-adopt a name-only candidate, never create another tree on
//      top of it. Caller persists needsFolderReconciliation and surfaces it.
//   5. Zero candidates anywhere -> CREATE fresh tree, stamped with
//      appProperties so a future pointer loss can rediscover it without
//      creating a duplicate.
export const VAULT_ROOT_FOLDER_NAME = 'Reset Biology Data'
export const VAULT_SUBFOLDERS = [
  'Journal',
  'Nutrition',
  'Workouts',
  'Breath Sessions',
  'Peptides',
  'Vision Training',
  'Memory Training',
  'Profile',
  'Progress Reports',
]

export type VaultRootResolution =
  | { status: 'reused'; folderId: string }
  | { status: 'created'; folderId: string }
  | { status: 'ambiguous'; candidateFolderIds: string[] }

export async function resolveVaultRootFolder(
  drive: drive_v3.Drive,
  userId: string,
  storedFolderId: string | null | undefined,
  accountIdentity?: { stored: string | null | undefined; current: string | null | undefined }
): Promise<VaultRootResolution> {
  // Case 0: known account mismatch — fail closed before touching Drive.
  if (
    storedFolderId &&
    accountIdentity?.stored &&
    accountIdentity?.current &&
    accountIdentity.stored.toLowerCase() !== accountIdentity.current.toLowerCase()
  ) {
    return { status: 'ambiguous', candidateFolderIds: [storedFolderId] }
  }

  // Case 1/2: pointer-first. Any failure here (stale, deleted, or 403)
  // falls through to discovery rather than erroring out.
  if (storedFolderId) {
    try {
      const probe = await drive.files.get({
        fileId: storedFolderId,
        fields: 'id, trashed',
      })
      if (probe.data.id && !probe.data.trashed) {
        return { status: 'reused', folderId: probe.data.id }
      }
    } catch {
      // stale / deleted / inaccessible / wrong-account token — fall through
    }
  }

  // Case 3: exact discovery — this app's own stamp, for this exact user.
  // drive.file scope: files.list only ever returns files the app created
  // and this account has authorized, so this query cannot leak another
  // app's or another user's unrelated Drive contents.
  const exactQuery = [
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    "appProperties has { key='rbVaultRoot' and value='true' }",
    `appProperties has { key='rbUserId' and value='${userId}' }`,
  ].join(' and ')

  const exact = await drive.files.list({
    q: exactQuery,
    fields: 'files(id)',
    spaces: 'drive',
  })
  const exactMatches = (exact.data.files ?? []).filter((f) => f.id)
  if (exactMatches.length === 1) {
    return { status: 'reused', folderId: exactMatches[0].id! }
  }
  if (exactMatches.length > 1) {
    return {
      status: 'ambiguous',
      candidateFolderIds: exactMatches.map((f) => f.id!),
    }
  }

  // Case 4: broad discovery — anything app-visible that could plausibly be
  // a vault root but isn't unambiguously THIS user's: another user's
  // stamped root visible on the same Drive account, or a legacy pre-contract
  // folder matched by name only (no appProperties). Never auto-adopt.
  const broadQuery = [
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    `(appProperties has { key='rbVaultRoot' and value='true' } or name='${VAULT_ROOT_FOLDER_NAME}')`,
  ].join(' and ')

  const broad = await drive.files.list({
    q: broadQuery,
    fields: 'files(id)',
    spaces: 'drive',
  })
  const broadMatches = (broad.data.files ?? []).filter((f) => f.id)
  if (broadMatches.length > 0) {
    return {
      status: 'ambiguous',
      candidateFolderIds: broadMatches.map((f) => f.id!),
    }
  }

  // Case 5: nothing found anywhere — genuinely first connect for this
  // Drive account. Create fresh and stamp it for future discovery.
  const folderId = await createVaultRootFolder(drive, userId)
  return { status: 'created', folderId }
}

async function createVaultRootFolder(
  drive: drive_v3.Drive,
  userId: string
): Promise<string> {
  const folderResponse = await drive.files.create({
    requestBody: {
      name: VAULT_ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description:
        'Your Reset Biology journal entries, workout logs, and nutrition data',
      appProperties: {
        rbVaultRoot: 'true',
        rbUserId: userId,
      },
    },
    fields: 'id',
  })
  const folderId = folderResponse.data.id
  if (!folderId) {
    throw new Error('Drive did not return an id for the created vault root folder')
  }

  for (const subfolder of VAULT_SUBFOLDERS) {
    await drive.files.create({
      requestBody: {
        name: subfolder,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
      },
    })
  }

  return folderId
}

// Get authenticated Drive client for a user.
// Decrypts the stored refresh token; lazily re-encrypts if it was stored
// in the legacy plaintext format AND the encryption key is now provisioned.
export async function getDriveClient(userId: string): Promise<drive_v3.Drive | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleDriveRefreshToken: true,
      driveFolder: true,
    },
  })

  if (!user?.googleDriveRefreshToken || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null
  }

  let refreshToken: string
  try {
    const decrypted = decryptToken(user.googleDriveRefreshToken)
    refreshToken = decrypted.plaintext

    // Lazy migration: if we read a plaintext token AND a key is now configured,
    // re-encrypt it in the background. Don't block the request on this.
    if (!decrypted.wasEncrypted) {
      const reEncrypted = encryptToken(refreshToken)
      if (reEncrypted !== refreshToken) {
        prisma.user
          .update({
            where: { id: userId },
            data: { googleDriveRefreshToken: reEncrypted },
          })
          .catch((err) =>
            console.error('[google-drive] lazy re-encryption failed:', err),
          )
      }
    }
  } catch (err) {
    console.error('[google-drive] token decryption failed:', err)
    return null
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  return google.drive({ version: 'v3', auth: oauth2Client })
}

// Get subfolder ID by name
export async function getSubfolderId(
  drive: drive_v3.Drive,
  parentFolderId: string,
  subfolderName: string
): Promise<string | null> {
  try {
    const response = await drive.files.list({
      q: `name='${subfolderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    })

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id || null
    }

    // Create subfolder if it doesn't exist
    const createResponse = await drive.files.create({
      requestBody: {
        name: subfolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    })

    return createResponse.data.id || null
  } catch (error) {
    console.error(`Error getting/creating subfolder ${subfolderName}:`, error)
    return null
  }
}

// Upload a JSON file to Drive
export async function uploadJsonFile(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  data: Record<string, unknown>
): Promise<string | null> {
  try {
    // Check if file already exists
    const existingFiles = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    })

    const fileContent = JSON.stringify(data, null, 2)

    if (existingFiles.data.files && existingFiles.data.files.length > 0) {
      // Update existing file
      const fileId = existingFiles.data.files[0].id!
      await drive.files.update({
        fileId,
        media: {
          mimeType: 'application/json',
          body: fileContent,
        },
      })
      return fileId
    }

    // Create new file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json',
      },
      media: {
        mimeType: 'application/json',
        body: fileContent,
      },
      fields: 'id',
    })

    return response.data.id || null
  } catch (error) {
    console.error(`Error uploading file ${fileName}:`, error)
    return null
  }
}

// Upload a text/markdown file to Drive
export async function uploadTextFile(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<string | null> {
  try {
    // Check if file already exists
    const existingFiles = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    })

    if (existingFiles.data.files && existingFiles.data.files.length > 0) {
      // Update existing file
      const fileId = existingFiles.data.files[0].id!
      await drive.files.update({
        fileId,
        media: {
          mimeType,
          body: content,
        },
      })
      return fileId
    }

    // Create new file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType,
      },
      media: {
        mimeType,
        body: content,
      },
      fields: 'id',
    })

    return response.data.id || null
  } catch (error) {
    console.error(`Error uploading text file ${fileName}:`, error)
    return null
  }
}

// Format journal entry for Drive
export function formatJournalEntry(entry: {
  createdAt: Date
  content: string
  mood?: string
  weight?: number
  goals?: string
}): string {
  const date = new Date(entry.createdAt)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let content = `# Journal Entry - ${dateStr}\n\n`

  if (entry.mood) {
    content += `**Mood:** ${entry.mood}\n\n`
  }

  if (entry.weight) {
    content += `**Weight:** ${entry.weight} lbs\n\n`
  }

  if (entry.goals) {
    content += `## Goals for Today\n${entry.goals}\n\n`
  }

  if (entry.content) {
    content += `## Entry\n${entry.content}\n`
  }

  return content
}

// Format workout summary for Drive
export function formatWorkoutSummary(session: {
  completedAt: Date
  duration: number
  exercises: Array<{
    name: string
    sets: Array<{
      reps?: number
      weight?: number
      duration?: number
    }>
  }>
  notes?: string
}): string {
  const date = new Date(session.completedAt)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let content = `# Workout - ${dateStr}\n\n`
  content += `**Duration:** ${session.duration} minutes\n\n`
  content += `## Exercises\n\n`

  for (const exercise of session.exercises) {
    content += `### ${exercise.name}\n`
    exercise.sets.forEach((set, idx) => {
      const parts = []
      if (set.reps) parts.push(`${set.reps} reps`)
      if (set.weight) parts.push(`${set.weight} lbs`)
      if (set.duration) parts.push(`${set.duration}s`)
      content += `- Set ${idx + 1}: ${parts.join(', ')}\n`
    })
    content += '\n'
  }

  if (session.notes) {
    content += `## Notes\n${session.notes}\n`
  }

  return content
}

// Format daily tasks for Drive
export function formatDailyTasks(tasks: Array<{
  taskName: string
  completed: boolean
}>, dateStr: string): string {
  let content = `# Daily Tasks — ${dateStr}\n\n`

  for (const task of tasks) {
    content += `- [${task.completed ? 'x' : ' '}] ${task.taskName}\n`
  }

  return content
}

// Format workout check-ins for Drive
export function formatCheckins(checkins: Array<{
  createdAt: Date
  localTime?: string | null
  readinessScore?: number | null
  energyLevel?: number | null
  sorenessLevel?: number | null
  sleepHours?: number | null
  stressLevel?: number | null
  mood?: string | null
  painNotes?: string | null
  notes?: string | null
  tags: string[]
}>, dateStr: string): string {
  let content = `# Workout Check-ins — ${dateStr}\n\n`

  checkins.forEach((checkin, idx) => {
    // Prefer the client's captured local time; the worker runs server-side so
    // formatting createdAt here would render the wrong timezone (Argus MED).
    const timeStr = checkin.localTime || new Date(checkin.createdAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    content += `## Check-in ${idx + 1} - ${timeStr}\n\n`
    if (checkin.readinessScore !== null && checkin.readinessScore !== undefined) {
      content += `**Readiness:** ${checkin.readinessScore}\n`
    }
    if (checkin.energyLevel !== null && checkin.energyLevel !== undefined) {
      content += `**Energy:** ${checkin.energyLevel}\n`
    }
    if (checkin.sorenessLevel !== null && checkin.sorenessLevel !== undefined) {
      content += `**Soreness:** ${checkin.sorenessLevel}\n`
    }
    if (checkin.sleepHours !== null && checkin.sleepHours !== undefined) {
      content += `**Sleep Hours:** ${checkin.sleepHours}\n`
    }
    if (checkin.stressLevel !== null && checkin.stressLevel !== undefined) {
      content += `**Stress:** ${checkin.stressLevel}\n`
    }
    if (checkin.mood) {
      content += `**Mood:** ${checkin.mood}\n`
    }
    if (checkin.painNotes) {
      content += `**Pain Notes:** ${checkin.painNotes}\n`
    }
    if (checkin.notes) {
      content += `**Notes:** ${checkin.notes}\n`
    }
    if (checkin.tags.length > 0) {
      content += `**Tags:** ${checkin.tags.join(', ')}\n`
    }
    content += '\n'
  })

  return content
}

// Format module completions for Drive
export function formatModuleCompletions(mods: Array<{
  moduleId: string
  completedAt: Date
  localTime?: string | null
  audioDuration?: number | null
  fullCompletion: boolean
}>, dateStr: string): string {
  let content = `# Module Completions — ${dateStr}\n\n`

  mods.forEach((mod, idx) => {
    // Prefer the client's captured local time (Argus MED — worker is server-side).
    const timeStr = mod.localTime || new Date(mod.completedAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    content += `## Completion ${idx + 1}\n\n`
    content += `**Module ID:** ${mod.moduleId}\n`
    content += `**Completed At:** ${timeStr}\n`
    content += `**Full Completion:** ${mod.fullCompletion ? 'Yes' : 'No'}\n`
    if (mod.audioDuration !== null && mod.audioDuration !== undefined) {
      content += `**Audio Duration:** ${mod.audioDuration}\n`
    }
    content += '\n'
  })

  return content
}

// Format nutrition log for Drive
export function formatNutritionLog(entries: Array<{
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  mealType: string
  loggedAt: Date
}>): string {
  if (entries.length === 0) return ''

  const date = new Date(entries[0].loggedAt)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let content = `# Nutrition Log - ${dateStr}\n\n`

  // Group by meal type
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack']
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 }

  for (const mealType of mealTypes) {
    const mealEntries = entries.filter(e => e.mealType.toLowerCase() === mealType)
    if (mealEntries.length === 0) continue

    content += `## ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}\n\n`
    content += `| Food | Calories | Protein | Carbs | Fats |\n`
    content += `|------|----------|---------|-------|------|\n`

    for (const entry of mealEntries) {
      content += `| ${entry.name} | ${entry.calories} | ${entry.protein}g | ${entry.carbs}g | ${entry.fats}g |\n`
      totals.calories += entry.calories
      totals.protein += entry.protein
      totals.carbs += entry.carbs
      totals.fats += entry.fats
    }
    content += '\n'
  }

  content += `## Daily Totals\n\n`
  content += `- **Calories:** ${totals.calories}\n`
  content += `- **Protein:** ${totals.protein}g\n`
  content += `- **Carbs:** ${totals.carbs}g\n`
  content += `- **Fats:** ${totals.fats}g\n`

  return content
}

// Format peptide doses for Drive
export function formatPeptideDoses(doses: Array<{
  peptideName: string
  dosage: number
  unit: string
  time: string
  localDate: string
  notes?: string
}>): string {
  if (doses.length === 0) return ''

  const date = doses[0].localDate
  let content = `# Peptide Doses - ${date}\n\n`
  content += `| Time | Peptide | Dosage | Notes |\n`
  content += `|------|---------|--------|-------|\n`

  for (const dose of doses) {
    const notes = dose.notes || '-'
    content += `| ${dose.time} | ${dose.peptideName} | ${dose.dosage}${dose.unit} | ${notes} |\n`
  }

  return content
}

// Format breath sessions for Drive
export function formatBreathSession(session: {
  completedAt: Date
  exerciseName: string
  duration: number
  rounds?: number
  pattern?: string
  notes?: string
}): string {
  const date = new Date(session.completedAt)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  let content = `# Breath Session - ${dateStr}\n\n`
  content += `**Time:** ${timeStr}\n`
  content += `**Exercise:** ${session.exerciseName}\n`
  content += `**Duration:** ${Math.floor(session.duration / 60)} minutes ${session.duration % 60} seconds\n`

  if (session.rounds) {
    content += `**Rounds:** ${session.rounds}\n`
  }
  if (session.pattern) {
    content += `**Pattern:** ${session.pattern}\n`
  }
  if (session.notes) {
    content += `\n## Notes\n${session.notes}\n`
  }

  return content
}

// Format vision sessions for Drive
export function formatVisionSession(session: {
  createdAt: Date
  visionType: string
  exerciseType: string
  distanceCm: number
  accuracy: number
  chartSize: string
  duration: number
  success: boolean
}): string {
  const date = new Date(session.createdAt)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  let content = `# Vision Training - ${dateStr}\n\n`
  content += `**Time:** ${timeStr}\n`
  content += `**Type:** ${session.visionType === 'near' ? 'Near Vision' : 'Far Vision'}\n`
  content += `**Exercise:** ${session.exerciseType}\n`
  content += `**Distance:** ${session.distanceCm} cm\n`
  content += `**Chart Size:** ${session.chartSize}\n`
  content += `**Accuracy:** ${session.accuracy.toFixed(1)}%\n`
  content += `**Duration:** ${Math.floor(session.duration / 60)}:${(session.duration % 60).toString().padStart(2, '0')}\n`
  content += `**Result:** ${session.success ? '✅ Passed' : '❌ Keep practicing'}\n`

  return content
}

// Format N-Back memory sessions for Drive
export function formatNBackSession(session: {
  createdAt: Date
  gameMode: string
  nLevel: number
  totalTrials: number
  overallAccuracy: number
  positionAccuracy: number
  audioAccuracy: number
  letterAccuracy?: number | null
  durationSeconds: number
}): string {
  const date = new Date(session.createdAt)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  let content = `# Memory Training - ${dateStr}\n\n`
  content += `**Time:** ${timeStr}\n`
  content += `**Mode:** ${session.gameMode === 'dual' ? 'Dual N-Back' : 'Triple N-Back'}\n`
  content += `**N-Level:** ${session.nLevel}\n`
  content += `**Trials:** ${session.totalTrials}\n`
  content += `**Duration:** ${Math.floor(session.durationSeconds / 60)}:${(session.durationSeconds % 60).toString().padStart(2, '0')}\n\n`
  content += `## Accuracy Scores\n\n`
  content += `- **Overall:** ${session.overallAccuracy.toFixed(1)}%\n`
  content += `- **Position:** ${session.positionAccuracy.toFixed(1)}%\n`
  content += `- **Audio:** ${session.audioAccuracy.toFixed(1)}%\n`
  if (session.letterAccuracy != null) {
    content += `- **Letter:** ${session.letterAccuracy.toFixed(1)}%\n`
  }

  return content
}

// Generate CSV format for Voice Agent consumption
export function generateTrackerCSV(
  type: 'nutrition' | 'peptides' | 'workouts' | 'breath',
  data: Array<Record<string, unknown>>
): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      // Escape commas and quotes in CSV
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return String(val ?? '')
    }).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

// Sync user profile/preferences for Voice Agent
export async function syncUserProfile(userId: string): Promise<{ success: boolean; error?: string }> {
  const drive = await getDriveClient(userId)
  if (!drive) {
    return { success: false, error: 'Google Drive not connected' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      driveFolder: true,
      name: true,
      email: true,
      profileData: true,
    },
  })

  if (!user?.driveFolder) {
    return { success: false, error: 'No Drive folder configured' }
  }

  try {
    const profileFolderId = await getSubfolderId(drive, user.driveFolder, 'Profile')
    if (profileFolderId) {
      // Merge profile data with base info
      const profileData = (user.profileData as Record<string, unknown>) || {}
      const preferences = {
        name: user.name,
        email: user.email,
        lastUpdated: new Date().toISOString(),
        ...profileData,
      }

      await uploadJsonFile(drive, profileFolderId, 'user_preferences.json', preferences)
      return { success: true }
    }
    return { success: false, error: 'Could not create Profile folder' }
  } catch (error) {
    return { success: false, error: `Profile sync failed: ${error}` }
  }
}

const DRIVE_SYNC_DOMAINS = [
  'journal',
  'workouts',
  'nutrition',
  'peptides',
  'breath',
  'vision',
  'nback',
  'dailyTasks',
  'checkins',
  'modules',
] as const

const DRIVE_SYNC_LABELS: Record<
  typeof DRIVE_SYNC_DOMAINS[number],
  { synced: string; error: string }
> = {
  journal: { synced: 'Journal entries', error: 'Journal sync failed' },
  workouts: { synced: 'Workout sessions', error: 'Workout sync failed' },
  nutrition: { synced: 'Nutrition log', error: 'Nutrition sync failed' },
  peptides: { synced: 'Peptide doses', error: 'Peptide sync failed' },
  breath: { synced: 'Breath sessions', error: 'Breath sync failed' },
  vision: { synced: 'Vision sessions', error: 'Vision sync failed' },
  nback: { synced: 'Memory training', error: 'Memory sync failed' },
  dailyTasks: { synced: 'Daily tasks', error: 'Daily tasks sync failed' },
  checkins: { synced: 'Workout check-ins', error: 'Check-in sync failed' },
  modules: { synced: 'Module completions', error: 'Module sync failed' },
}

function getDateWindow(date: Date) {
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  return { dateStr, startOfDay, endOfDay }
}

async function requireSubfolderId(
  drive: drive_v3.Drive,
  driveFolder: string,
  folderName: string
): Promise<string> {
  const folderId = await getSubfolderId(drive, driveFolder, folderName)
  if (!folderId) {
    throw new Error(`Could not create or access Drive folder ${folderName}`)
  }
  return folderId
}

async function uploadRequiredTextFile(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<void> {
  const fileId = await uploadTextFile(drive, folderId, fileName, content, mimeType)
  if (!fileId) {
    throw new Error(`Drive upload failed for ${fileName}`)
  }
}

async function syncDomainForDateWithResult(
  drive: drive_v3.Drive,
  driveFolder: string,
  userId: string,
  domain: string,
  date: Date
): Promise<string | null> {
  const { dateStr, startOfDay, endOfDay } = getDateWindow(date)

  switch (domain) {
    case 'journal': {
      // Query by the entry's authoritative `date` (user-suppliable, supports
      // historical saves/edits) — NOT createdAt, which pins an edit to the day
      // the row happened to be created (FLW consult-7 HIGH).
      const journalEntries = await prisma.journalEntry.findMany({
        where: {
          userId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (journalEntries.length === 0) return null

      const journalFolderId = await requireSubfolderId(drive, driveFolder, 'Journal')
      for (const journalEntry of journalEntries) {
        // Parse the entry JSON string if it exists
        let parsedEntry: { content?: string; goals?: string } = {}
        try {
          if (journalEntry.entry) {
            parsedEntry = JSON.parse(journalEntry.entry)
          }
        } catch {
          // If parsing fails, treat entry as plain text content
          parsedEntry = { content: journalEntry.entry }
        }

        const content = formatJournalEntry({
          createdAt: journalEntry.createdAt,
          content: parsedEntry.content || '',
          mood: journalEntry.mood || undefined,
          weight: journalEntry.weight || undefined,
          goals: parsedEntry.goals || undefined,
        })
        const fileName = `journal-${dateStr}.md`
        await uploadRequiredTextFile(drive, journalFolderId, fileName, content, 'text/markdown')
      }

      return DRIVE_SYNC_LABELS.journal.synced
    }

    case 'workouts': {
      const workoutSessions = await prisma.workoutSession.findMany({
        where: {
          userId,
          completedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (workoutSessions.length === 0) return null

      const workoutFolderId = await requireSubfolderId(drive, driveFolder, 'Workouts')
      for (const session of workoutSessions) {
        const content = formatWorkoutSummary({
          completedAt: session.completedAt,
          duration: session.duration || 0,
          exercises: (session.exercises as any) || [],
          notes: session.notes || undefined,
        })
        const fileName = `workout-${dateStr}-${session.id.slice(-6)}.md`
        await uploadRequiredTextFile(drive, workoutFolderId, fileName, content, 'text/markdown')
      }

      return DRIVE_SYNC_LABELS.workouts.synced
    }

    case 'dailyTasks': {
      const dailyTasks = await prisma.dailyTask.findMany({
        where: {
          userId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { taskName: 'asc' },
      })

      if (dailyTasks.length === 0) return null

      const progressFolderId = await requireSubfolderId(drive, driveFolder, 'Progress Reports')

      const content = formatDailyTasks(
        dailyTasks.map(task => ({
          taskName: task.taskName,
          completed: task.completed,
        })),
        dateStr
      )
      const fileName = `daily-tasks-${dateStr}.md`
      await uploadRequiredTextFile(drive, progressFolderId, fileName, content, 'text/markdown')

      return DRIVE_SYNC_LABELS.dailyTasks.synced
    }

    case 'checkins': {
      const checkins = await prisma.workoutCheckIn.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      if (checkins.length === 0) return null

      const progressFolderId = await requireSubfolderId(drive, driveFolder, 'Progress Reports')

      const content = formatCheckins(
        checkins.map(checkin => ({
          createdAt: checkin.createdAt,
          localTime: checkin.localTime,
          readinessScore: checkin.readinessScore,
          energyLevel: checkin.energyLevel,
          sorenessLevel: checkin.sorenessLevel,
          sleepHours: checkin.sleepHours,
          stressLevel: checkin.stressLevel,
          mood: checkin.mood,
          painNotes: checkin.painNotes,
          notes: checkin.notes,
          tags: checkin.tags,
        })),
        dateStr
      )
      const fileName = `checkins-${dateStr}.md`
      await uploadRequiredTextFile(drive, progressFolderId, fileName, content, 'text/markdown')

      return DRIVE_SYNC_LABELS.checkins.synced
    }

    case 'modules': {
      const moduleCompletions = await prisma.moduleCompletion.findMany({
        where: {
          userId,
          completedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { completedAt: 'asc' },
      })

      if (moduleCompletions.length === 0) return null

      const progressFolderId = await requireSubfolderId(drive, driveFolder, 'Progress Reports')

      const content = formatModuleCompletions(
        moduleCompletions.map(mod => ({
          moduleId: mod.moduleId,
          completedAt: mod.completedAt,
          localTime: mod.localTime,
          audioDuration: mod.audioDuration,
          fullCompletion: mod.fullCompletion,
        })),
        dateStr
      )
      const fileName = `modules-${dateStr}.md`
      await uploadRequiredTextFile(drive, progressFolderId, fileName, content, 'text/markdown')

      return DRIVE_SYNC_LABELS.modules.synced
    }

    case 'nutrition': {
      const foodEntries = await prisma.foodEntry.findMany({
        where: {
          userId,
          loggedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (foodEntries.length === 0) return null

      const nutritionFolderId = await requireSubfolderId(drive, driveFolder, 'Nutrition')
      const content = formatNutritionLog(
        foodEntries.map(e => ({
          name: e.name,
          calories: e.calories,
          protein: e.protein,
          carbs: e.carbs,
          fats: e.fats,
          mealType: e.mealType,
          loggedAt: e.loggedAt,
        }))
      )
      const fileName = `nutrition-${dateStr}.md`
      await uploadRequiredTextFile(drive, nutritionFolderId, fileName, content, 'text/markdown')

      return DRIVE_SYNC_LABELS.nutrition.synced
    }

    case 'peptides': {
      // Get user's protocols first to filter doses
      const userProtocols = await prisma.user_peptide_protocols.findMany({
        where: { userId },
        select: { id: true },
      })
      const protocolIds = userProtocols.map(p => p.id)

      const peptideDoses = await prisma.peptide_doses.findMany({
        where: {
          localDate: dateStr,
          protocolId: { in: protocolIds },
        },
      })

      if (peptideDoses.length === 0) return null

      const peptideFolderId = await requireSubfolderId(drive, driveFolder, 'Peptides')
      const content = formatPeptideDoses(
        peptideDoses.map(d => ({
          peptideName: d.protocolName || 'Unknown',
          dosage: parseFloat(d.dosage) || 0,
          unit: 'mcg', // Default unit since schema stores dosage as string
          time: d.localTime || d.time || '',
          localDate: d.localDate || dateStr,
          notes: d.notes || undefined,
        }))
      )
      const fileName = `peptides-${dateStr}.md`
      await uploadRequiredTextFile(drive, peptideFolderId, fileName, content, 'text/markdown')

      // Also save as CSV for Voice Agent
      const csvData = peptideDoses.map(d => ({
        date: d.localDate || dateStr,
        time: d.localTime || d.time || '',
        peptide: d.protocolName || 'Unknown',
        dosage: d.dosage,
        notes: d.notes || '',
      }))
      const csvContent = generateTrackerCSV('peptides', csvData)
      await uploadRequiredTextFile(drive, peptideFolderId, `peptide_schedule.csv`, csvContent, 'text/csv')

      return DRIVE_SYNC_LABELS.peptides.synced
    }

    case 'breath': {
      const breathSessions = await prisma.breathSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (breathSessions.length === 0) return null

      const breathFolderId = await requireSubfolderId(drive, driveFolder, 'Breath Sessions')
      for (const session of breathSessions) {
        const content = formatBreathSession({
          completedAt: session.createdAt,
          exerciseName: session.sessionType || 'Breath Exercise',
          duration: session.duration,
          rounds: session.cycles || undefined,
          pattern: undefined,
          notes: undefined,
        })
        const fileName = `breath-${dateStr}-${session.id.slice(-6)}.md`
        await uploadRequiredTextFile(drive, breathFolderId, fileName, content, 'text/markdown')
      }

      return DRIVE_SYNC_LABELS.breath.synced
    }

    case 'vision': {
      const visionSessions = await prisma.visionSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (visionSessions.length === 0) return null

      const visionFolderId = await requireSubfolderId(drive, driveFolder, 'Vision Training')
      for (const session of visionSessions) {
        const content = formatVisionSession({
          createdAt: session.createdAt,
          visionType: session.visionType,
          exerciseType: session.exerciseType,
          distanceCm: session.distanceCm,
          accuracy: session.accuracy,
          chartSize: session.chartSize,
          duration: session.duration,
          success: session.success,
        })
        const fileName = `vision-${dateStr}-${session.id.slice(-6)}.md`
        await uploadRequiredTextFile(drive, visionFolderId, fileName, content, 'text/markdown')
      }

      // Also save as CSV for Voice Agent tracking
      const csvData = visionSessions.map(s => ({
        date: dateStr,
        time: s.createdAt.toLocaleTimeString(),
        type: s.visionType,
        exercise: s.exerciseType,
        distance_cm: s.distanceCm,
        accuracy: s.accuracy,
        chart_size: s.chartSize,
        passed: s.success ? 'Yes' : 'No',
      }))
      const csvContent = generateTrackerCSV('workouts', csvData)
      await uploadRequiredTextFile(drive, visionFolderId, `vision_scores.csv`, csvContent, 'text/csv')

      return DRIVE_SYNC_LABELS.vision.synced
    }

    case 'nback': {
      const nbackSessions = await prisma.nBackSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (nbackSessions.length === 0) return null

      const memoryFolderId = await requireSubfolderId(drive, driveFolder, 'Memory Training')
      for (const session of nbackSessions) {
        const content = formatNBackSession({
          createdAt: session.createdAt,
          gameMode: session.gameMode,
          nLevel: session.nLevel,
          totalTrials: session.totalTrials,
          overallAccuracy: session.overallAccuracy,
          positionAccuracy: session.positionAccuracy,
          audioAccuracy: session.audioAccuracy,
          letterAccuracy: session.letterAccuracy,
          durationSeconds: session.durationSeconds,
        })
        const fileName = `memory-${dateStr}-${session.id.slice(-6)}.md`
        await uploadRequiredTextFile(drive, memoryFolderId, fileName, content, 'text/markdown')
      }

      // Also save as CSV for Voice Agent tracking
      const csvData = nbackSessions.map(s => ({
        date: dateStr,
        time: s.createdAt.toLocaleTimeString(),
        mode: s.gameMode,
        n_level: s.nLevel,
        trials: s.totalTrials,
        overall_accuracy: s.overallAccuracy,
        position_accuracy: s.positionAccuracy,
        audio_accuracy: s.audioAccuracy,
        letter_accuracy: s.letterAccuracy || '',
        duration_sec: s.durationSeconds,
      }))
      const csvContent = generateTrackerCSV('workouts', csvData)
      await uploadRequiredTextFile(drive, memoryFolderId, `memory_scores.csv`, csvContent, 'text/csv')

      return DRIVE_SYNC_LABELS.nback.synced
    }

    default:
      throw new Error(`Unsupported Drive sync domain: ${domain}`)
  }
}

export async function syncDomainForDate(
  drive: drive_v3.Drive,
  driveFolder: string,
  userId: string,
  domain: string,
  date: Date
): Promise<void> {
  await syncDomainForDateWithResult(drive, driveFolder, userId, domain, date)
}

// Sync all user data for a specific date
export async function syncUserDataForDate(
  userId: string,
  date: Date
): Promise<{ success: boolean; synced: string[]; errors: string[] }> {
  const synced: string[] = []
  const errors: string[] = []

  const drive = await getDriveClient(userId)
  if (!drive) {
    return { success: false, synced: [], errors: ['Google Drive not connected'] }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolder: true },
  })

  if (!user?.driveFolder) {
    return { success: false, synced: [], errors: ['No Drive folder configured'] }
  }

  for (const domain of DRIVE_SYNC_DOMAINS) {
    try {
      const result = await syncDomainForDateWithResult(drive, user.driveFolder, userId, domain, date)
      if (result) synced.push(result)
    } catch (error) {
      errors.push(`${DRIVE_SYNC_LABELS[domain].error}: ${error}`)
    }
  }

  return {
    success: errors.length === 0,
    synced,
    errors,
  }
}
