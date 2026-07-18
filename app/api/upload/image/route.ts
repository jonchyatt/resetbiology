import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { getDriveClient, getSubfolderId } from '@/lib/google-drive'

// D2 fail-closed: zero RB-side custody of client photos. There is no
// fallback host and no temporary hold — if the vault isn't connected, the
// upload is refused outright (409), never buffered anywhere on our side.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const MAX_BYTES = 4 * 1024 * 1024 // 4MB — Vercel serverless inbound cap is ~4.5MB

const VAULT_REQUIRED_MESSAGE =
  "Your photos aren't stored anywhere unless you connect your own Drive vault — you're in charge of what's yours. Connect your vault and every photo you take lands in YOUR Google Drive, under your control, not ours."

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Same "connected" definition as /api/integrations/google-drive/status.
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { googleDriveRefreshToken: true, driveFolder: true },
    })

    if (!userData?.googleDriveRefreshToken || !userData.driveFolder) {
      return NextResponse.json(
        { error: 'vault_required', message: VAULT_REQUIRED_MESSAGE },
        { status: 409 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: JPEG, PNG, WEBP, HEIC.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image is too large. Max size is ${MAX_BYTES / (1024 * 1024)}MB.` },
        { status: 400 }
      )
    }

    const drive = await getDriveClient(user.id)
    if (!drive) {
      // getDriveClient failed even though the pointer looked connected
      // (e.g. decryption failure) — same fail-closed response, not a 500.
      return NextResponse.json(
        { error: 'vault_required', message: VAULT_REQUIRED_MESSAGE },
        { status: 409 }
      )
    }

    const photosFolderId = await getSubfolderId(drive, userData.driveFolder, 'Photos')
    if (!photosFolderId) {
      return NextResponse.json(
        { error: 'Could not access your Drive Photos folder' },
        { status: 500 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const created = await drive.files.create({
      requestBody: {
        name: `photo-${Date.now()}-${file.name || 'upload'}`,
        parents: [photosFolderId],
        appProperties: { rbUserId: user.id, rbKind: 'photo' },
      },
      media: { mimeType: file.type, body: Readable.from(buffer) },
      fields: 'id',
    })

    const driveFileId = created.data.id
    if (!driveFileId) {
      return NextResponse.json({ error: 'Drive upload failed' }, { status: 500 })
    }

    // NEVER return webContentLink/webViewLink — those are unauthenticated
    // bearer links. The only render path is our own authed /api/images/[id].
    return NextResponse.json({
      success: true,
      driveFileId,
      url: `/api/images/${driveFileId}`,
    })
  } catch (error) {
    console.error('Error uploading image:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
