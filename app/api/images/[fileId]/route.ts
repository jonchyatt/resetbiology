import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { getDriveClient } from '@/lib/google-drive'

// Only render path for vault photos. Fetches via the CALLER's own Drive
// client (not a shared/service credential) and verifies appProperties.rbUserId
// before streaming — never leaks existence of a file that isn't the caller's.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params

  const session = await auth0.getSession()
  const user = await getUserFromSession(session)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const drive = await getDriveClient(user.id)
  if (!drive) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let meta
  try {
    meta = await drive.files.get({
      fileId,
      fields: 'id, mimeType, trashed, appProperties',
    })
  } catch {
    // Deleted / inaccessible from this account — same response as
    // "not yours", so existence is never leaked either way.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (
    meta.data.trashed ||
    !meta.data.appProperties ||
    meta.data.appProperties.rbUserId !== user.id
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let mediaRes
  try {
    mediaRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    )
  } catch {
    // Deleted between the meta-check above and this fetch — same 404 as
    // "not yours", never a 500 leak.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const webStream = Readable.toWeb(
    mediaRes.data as unknown as Readable
  ) as unknown as ReadableStream<Uint8Array>

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': meta.data.mimeType || 'application/octet-stream',
      // Private (per-user, authed route) + long-lived — the fileId is
      // content-addressed enough that we never mutate an existing photo.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
