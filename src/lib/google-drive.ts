import { google, drive_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// Get authenticated Drive client for a user
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

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    refresh_token: user.googleDriveRefreshToken,
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

  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  // Sync journal entries
  try {
    const journalFolderId = await getSubfolderId(drive, user.driveFolder, 'Journal')
    if (journalFolderId) {
      const journalEntries = await prisma.journalEntry.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (journalEntries.length > 0) {
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
          await uploadTextFile(drive, journalFolderId, fileName, content, 'text/markdown')
        }
        synced.push('Journal entries')
      }
    }
  } catch (error) {
    errors.push(`Journal sync failed: ${error}`)
  }

  // Sync workout sessions
  try {
    const workoutFolderId = await getSubfolderId(drive, user.driveFolder, 'Workouts')
    if (workoutFolderId) {
      const workoutSessions = await prisma.workoutSession.findMany({
        where: {
          userId,
          completedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (workoutSessions.length > 0) {
        for (const session of workoutSessions) {
          const content = formatWorkoutSummary({
            completedAt: session.completedAt,
            duration: session.duration || 0,
            exercises: (session.exercises as any) || [],
            notes: session.notes || undefined,
          })
          const fileName = `workout-${dateStr}-${session.id.slice(-6)}.md`
          await uploadTextFile(drive, workoutFolderId, fileName, content, 'text/markdown')
        }
        synced.push('Workout sessions')
      }
    }
  } catch (error) {
    errors.push(`Workout sync failed: ${error}`)
  }

  // Sync nutrition logs
  try {
    const nutritionFolderId = await getSubfolderId(drive, user.driveFolder, 'Nutrition')
    if (nutritionFolderId) {
      const foodEntries = await prisma.foodEntry.findMany({
        where: {
          userId,
          loggedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (foodEntries.length > 0) {
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
        await uploadTextFile(drive, nutritionFolderId, fileName, content, 'text/markdown')
        synced.push('Nutrition log')
      }
    }
  } catch (error) {
    errors.push(`Nutrition sync failed: ${error}`)
  }

  // Sync peptide doses
  try {
    const peptideFolderId = await getSubfolderId(drive, user.driveFolder, 'Peptides')
    if (peptideFolderId) {
      // Get user's protocols first to filter doses
      const userProtocols = await prisma.user_peptide_protocols.findMany({
        where: { userId },
        select: { id: true }
      })
      const protocolIds = userProtocols.map(p => p.id)

      const peptideDoses = await prisma.peptide_doses.findMany({
        where: {
          localDate: dateStr,
          protocolId: { in: protocolIds },
        },
      })

      if (peptideDoses.length > 0) {
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
        await uploadTextFile(drive, peptideFolderId, fileName, content, 'text/markdown')

        // Also save as CSV for Voice Agent
        const csvData = peptideDoses.map(d => ({
          date: d.localDate || dateStr,
          time: d.localTime || d.time || '',
          peptide: d.protocolName || 'Unknown',
          dosage: d.dosage,
          notes: d.notes || '',
        }))
        const csvContent = generateTrackerCSV('peptides', csvData)
        await uploadTextFile(drive, peptideFolderId, `peptide_schedule.csv`, csvContent, 'text/csv')

        synced.push('Peptide doses')
      }
    }
  } catch (error) {
    errors.push(`Peptide sync failed: ${error}`)
  }

  // Sync breath sessions
  try {
    const breathFolderId = await getSubfolderId(drive, user.driveFolder, 'Breath Sessions')
    if (breathFolderId) {
      const breathSessions = await prisma.breathSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (breathSessions.length > 0) {
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
          await uploadTextFile(drive, breathFolderId, fileName, content, 'text/markdown')
        }
        synced.push('Breath sessions')
      }
    }
  } catch (error) {
    errors.push(`Breath sync failed: ${error}`)
  }

  // Sync vision sessions
  try {
    const visionFolderId = await getSubfolderId(drive, user.driveFolder, 'Vision Training')
    if (visionFolderId) {
      const visionSessions = await prisma.visionSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (visionSessions.length > 0) {
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
          await uploadTextFile(drive, visionFolderId, fileName, content, 'text/markdown')
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
        await uploadTextFile(drive, visionFolderId, `vision_scores.csv`, csvContent, 'text/csv')

        synced.push('Vision sessions')
      }
    }
  } catch (error) {
    errors.push(`Vision sync failed: ${error}`)
  }

  // Sync N-Back memory sessions
  try {
    const memoryFolderId = await getSubfolderId(drive, user.driveFolder, 'Memory Training')
    if (memoryFolderId) {
      const nbackSessions = await prisma.nBackSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      if (nbackSessions.length > 0) {
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
          await uploadTextFile(drive, memoryFolderId, fileName, content, 'text/markdown')
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
        await uploadTextFile(drive, memoryFolderId, `memory_scores.csv`, csvContent, 'text/csv')

        synced.push('Memory training')
      }
    }
  } catch (error) {
    errors.push(`Memory sync failed: ${error}`)
  }

  return {
    success: errors.length === 0,
    synced,
    errors,
  }
}
