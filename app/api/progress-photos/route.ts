import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { getDriveClient } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { driveFileId, note = null } = body ?? {}

    if (!driveFileId || typeof driveFileId !== 'string') {
      return NextResponse.json({ error: 'driveFileId is required' }, { status: 400 })
    }

    const drive = await getDriveClient(user.id)
    if (!drive) {
      return NextResponse.json({ error: 'vault_required' }, { status: 409 })
    }

    // Verify the file exists and actually belongs to this user before
    // creating the record — never trust a client-supplied driveFileId blind.
    let meta
    try {
      meta = await drive.files.get({
        fileId: driveFileId,
        fields: 'id, trashed, appProperties',
      })
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (
      meta.data.trashed ||
      !meta.data.appProperties ||
      meta.data.appProperties.rbUserId !== user.id
    ) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const photo = await prisma.progressPhoto.create({
      data: { userId: user.id, driveFileId, note },
    })

    return NextResponse.json({
      id: photo.id,
      driveFileId: photo.driveFileId,
      url: `/api/images/${photo.driveFileId}`,
      takenAt: photo.takenAt,
      note: photo.note,
    })
  } catch (error) {
    console.error('POST /api/progress-photos error', error)
    return NextResponse.json({ error: 'Unable to save progress photo' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const photos = await prisma.progressPhoto.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: 'desc' },
    })

    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        driveFileId: p.driveFileId,
        url: `/api/images/${p.driveFileId}`,
        takenAt: p.takenAt,
        note: p.note,
      })),
    })
  } catch (error) {
    console.error('GET /api/progress-photos error', error)
    return NextResponse.json({ error: 'Unable to load progress photos' }, { status: 500 })
  }
}
