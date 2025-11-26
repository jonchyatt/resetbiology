import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL + '/api/integrations/google-drive/callback'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // User ID
    const error = searchParams.get('error')

    // Handle user denial
    if (error) {
      console.log('User denied Google Drive access:', error)
      return NextResponse.redirect(
        new URL('/profile?drive=denied', process.env.NEXT_PUBLIC_BASE_URL!)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/profile?drive=error&reason=missing_params', process.env.NEXT_PUBLIC_BASE_URL!)
      )
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        new URL('/profile?drive=error&reason=not_configured', process.env.NEXT_PUBLIC_BASE_URL!)
      )
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      console.error('No refresh token received from Google')
      return NextResponse.redirect(
        new URL('/profile?drive=error&reason=no_refresh_token', process.env.NEXT_PUBLIC_BASE_URL!)
      )
    }

    oauth2Client.setCredentials(tokens)

    // Create a folder in user's Google Drive
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Check if folder already exists
    const existingFolders = await drive.files.list({
      q: "name='Reset Biology Data' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
    })

    let folderId: string

    if (existingFolders.data.files && existingFolders.data.files.length > 0) {
      // Use existing folder
      folderId = existingFolders.data.files[0].id!
      console.log('Using existing Reset Biology folder:', folderId)
    } else {
      // Create new folder
      const folderResponse = await drive.files.create({
        requestBody: {
          name: 'Reset Biology Data',
          mimeType: 'application/vnd.google-apps.folder',
          description: 'Your Reset Biology journal entries, workout logs, and nutrition data',
        },
        fields: 'id',
      })
      folderId = folderResponse.data.id!
      console.log('Created new Reset Biology folder:', folderId)

      // Create subfolders
      const subfolders = ['Journal', 'Nutrition', 'Workouts', 'Breath Sessions', 'Progress Reports']
      for (const subfolder of subfolders) {
        await drive.files.create({
          requestBody: {
            name: subfolder,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [folderId],
          },
        })
      }
    }

    // Update user with Drive credentials
    await prisma.user.update({
      where: { id: state },
      data: {
        googleDriveRefreshToken: tokens.refresh_token,
        driveFolder: folderId,
        googleDriveConnectedAt: new Date(),
        googleDriveSyncEnabled: true,
      },
    })

    // Redirect back to profile with success
    return NextResponse.redirect(
      new URL('/profile?drive=connected', process.env.NEXT_PUBLIC_BASE_URL!)
    )

  } catch (error) {
    console.error('Google Drive callback error:', error)
    return NextResponse.redirect(
      new URL('/profile?drive=error&reason=callback_failed', process.env.NEXT_PUBLIC_BASE_URL!)
    )
  }
}
