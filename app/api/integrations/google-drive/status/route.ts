import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Drive connection status
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        googleDriveRefreshToken: true,
        driveFolder: true,
        googleDriveConnectedAt: true,
        googleDriveSyncEnabled: true,
      },
    })

    if (!userData) {
      return NextResponse.json({ connected: false })
    }

    const connected = !!(userData.googleDriveRefreshToken && userData.driveFolder)

    return NextResponse.json({
      connected,
      folderId: connected ? userData.driveFolder : null,
      connectedAt: userData.googleDriveConnectedAt,
      syncEnabled: userData.googleDriveSyncEnabled,
    })

  } catch (error) {
    console.error('Google Drive status error:', error)
    return NextResponse.json({
      error: 'Failed to check Google Drive status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
