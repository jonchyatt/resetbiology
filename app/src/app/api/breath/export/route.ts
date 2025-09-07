import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions) as any
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in with Google." },
        { status: 401 }
      )
    }

    const { sessions } = await request.json()
    
    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: "No breath training sessions found to export." },
        { status: 400 }
      )
    }

    // Get the user's Google account from the database
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google"
      }
    })

    if (!account?.access_token) {
      return NextResponse.json({
        error: "Google authentication expired. Please sign out and sign in again to refresh your Google permissions."
      }, { status: 401 })
    }

    // Initialize Google APIs with user's access token
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    auth.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    })

    try {
      // Create the Google Sheet
      const spreadsheetUrl = await createGoogleSheet(auth, sessions, session.user.email!)
      
      return NextResponse.json({
        success: true,
        message: "Your breath training data has been exported to Google Sheets!",
        spreadsheetUrl
      })
    } catch (apiError: any) {
      console.error("Google API error:", apiError)
      return NextResponse.json({
        error: `Failed to create Google Sheet: ${apiError.message}. You may need to sign out and sign in again to refresh permissions.`
      }, { status: 500 })
    }

  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: "Failed to export breath training data" },
      { status: 500 }
    )
  }
}

async function createGoogleSheet(auth: any, sessions: any[], userEmail: string) {
  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  // Step 1: Find or create "Reset Biology" folder
  let folderId = await findOrCreateResetBiologyFolder(drive)

  // Step 2: Find existing breath training sheet or create new one
  const sheetTitle = "Reset Biology - Breath Training Data"
  let spreadsheetId = await findExistingSheet(drive, folderId, sheetTitle)
  
  if (!spreadsheetId) {
    // Create new spreadsheet in the Reset Biology folder
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: sheetTitle
        },
        sheets: [{
          properties: {
            title: 'Sessions'
          }
        }]
      }
    })
    
    spreadsheetId = spreadsheet.data.spreadsheetId!
    
    // Move to Reset Biology folder
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: 'root'
    })

    // Set permissions
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'owner',
        type: 'user',
        emailAddress: userEmail
      }
    })
  }

  // Step 3: Prepare data with timestamps for updating
  const headers = ['Export Date', 'Session Date', 'Duration (s)', 'Cycles', 'Best Exhale Hold (s)', 'Best Inhale Hold (s)', 'Notes']
  const newRows = sessions.map(session => [
    new Date().toLocaleString(), // When this export happened
    new Date(session.date).toLocaleDateString(),
    Math.round(session.totalDuration / 1000),
    session.cycles?.length || 0,
    Math.round((session.bestExhaleHold || 0) / 1000),
    Math.round((session.bestInhaleHold || 0) / 1000),
    `Settings: ${session.settings?.cyclesTarget || 'N/A'} cycles, ${session.settings?.breathsPerCycle || 'N/A'} breaths/cycle`
  ])

  // Step 4: Get existing data to append (not overwrite)
  let existingData: any[] = []
  try {
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sessions!A:G'
    })
    existingData = existingResponse.data.values || []
  } catch (e) {
    // Sheet might be empty, that's ok
  }

  // Step 5: Combine data (headers + existing + new)
  let allData: any[]
  if (existingData.length === 0) {
    // First time - add headers + new data
    allData = [headers, ...newRows]
  } else {
    // Append new sessions to existing data
    allData = [...existingData, ...newRows]
  }

  // Step 6: Update the sheet with all data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sessions!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: allData
    }
  })

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
}

async function findOrCreateResetBiologyFolder(drive: any): Promise<string> {
  // Check if Reset Biology folder exists
  const folderQuery = await drive.files.list({
    q: "name='Reset Biology' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id, name)'
  })

  if (folderQuery.data.files && folderQuery.data.files.length > 0) {
    return folderQuery.data.files[0].id
  }

  // Create the folder if it doesn't exist
  const folder = await drive.files.create({
    requestBody: {
      name: 'Reset Biology',
      mimeType: 'application/vnd.google-apps.folder'
    }
  })

  return folder.data.id
}

async function findExistingSheet(drive: any, folderId: string, sheetTitle: string): Promise<string | null> {
  const query = await drive.files.list({
    q: `'${folderId}' in parents and name='${sheetTitle}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)'
  })

  if (query.data.files && query.data.files.length > 0) {
    return query.data.files[0].id
  }

  return null
}