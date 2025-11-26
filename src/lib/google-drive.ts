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

  return {
    success: errors.length === 0,
    synced,
    errors,
  }
}
