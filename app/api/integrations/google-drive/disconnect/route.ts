import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's refresh token
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        googleDriveRefreshToken: true,
      },
    })

    // Try to revoke the token if we have one
    if (userData?.googleDriveRefreshToken && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({
          refresh_token: userData.googleDriveRefreshToken,
        })

        // Revoke the token
        await oauth2Client.revokeToken(userData.googleDriveRefreshToken)
        console.log('Successfully revoked Google Drive token for user:', user.id)
      } catch (revokeError) {
        // Log but don't fail - token might already be invalid
        console.error('Error revoking Google token:', revokeError)
      }
    }

    // Clear Drive fields from user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleDriveRefreshToken: null,
        driveFolder: null,
        googleDriveConnectedAt: null,
        googleDriveSyncEnabled: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Google Drive disconnected. Your files remain in your Drive.',
    })

  } catch (error) {
    console.error('Google Drive disconnect error:', error)
    return NextResponse.json({
      error: 'Failed to disconnect Google Drive',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
