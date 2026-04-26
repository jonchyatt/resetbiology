import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/vault-encryption'
import { migratePeptidesToVault } from '@/lib/migratePeptidesToVault'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL + '/api/integrations/google-drive/callback'

export async function GET(req: NextRequest) {
  // Validate returnTo can't trigger an open-redirect.
  function isSafeReturnTo(value: unknown): value is string {
    if (typeof value !== 'string' || !value) return false
    if (!value.startsWith('/')) return false
    if (value.startsWith('//') || value.startsWith('/\\')) return false
    if (value.includes(':')) return false
    return true
  }

  // Decode state into { userId, returnTo }. Falls back to legacy "raw user id" form
  // for any OAuth round-trip that started before this deploy.
  function decodeState(raw: string | null): { userId: string; returnTo: string } | null {
    if (!raw) return null
    try {
      const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
      const parsed = JSON.parse(decoded)
      if (typeof parsed?.u === 'string') {
        const returnTo = isSafeReturnTo(parsed?.r) ? parsed.r : '/profile'
        return { userId: parsed.u, returnTo }
      }
    } catch {
      // Legacy form: state IS the userId
      if (/^[a-f0-9]{24}$/i.test(raw)) {
        return { userId: raw, returnTo: '/profile' }
      }
    }
    return null
  }

  function redirectToReturn(returnTo: string, query: string) {
    const url = new URL(returnTo, process.env.NEXT_PUBLIC_BASE_URL!)
    const sep = url.search ? '&' : '?'
    return NextResponse.redirect(`${url.toString()}${sep}${query}`)
  }

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const stateRaw = searchParams.get('state')
    const error = searchParams.get('error')
    const stateDecoded = decodeState(stateRaw)
    const returnTo = stateDecoded?.returnTo ?? '/profile'

    // Handle user denial
    if (error) {
      console.log('User denied Google Drive access:', error)
      return redirectToReturn(returnTo, 'drive=denied')
    }

    if (!code || !stateDecoded) {
      return redirectToReturn(returnTo, 'drive=error&reason=missing_params')
    }
    const state = stateDecoded.userId

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return redirectToReturn(returnTo, 'drive=error&reason=not_configured')
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
      return redirectToReturn(returnTo, 'drive=error&reason=no_refresh_token')
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
      const subfolders = ['Journal', 'Nutrition', 'Workouts', 'Breath Sessions', 'Peptides', 'Vision Training', 'Memory Training', 'Profile', 'Progress Reports']
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

    // Update user with Drive credentials. Refresh token is encrypted at rest
    // via VAULT_TOKEN_KEY (AES-256-GCM); falls through to plaintext if the env
    // var isn't set yet — see vault-encryption.ts for graceful-degradation contract.
    await prisma.user.update({
      where: { id: state },
      data: {
        googleDriveRefreshToken: encryptToken(tokens.refresh_token),
        driveFolder: folderId,
        googleDriveConnectedAt: new Date(),
        googleDriveSyncEnabled: true,
      },
    })

    // P2.5 — opportunistic migration of existing Mongo-canonical peptide
    // protocols into the Vault. Idempotent; failures don't block the connect
    // (the user can retry from a future tracker visit, or hit the explicit
    // POST /api/vault/migrate-peptides endpoint). Awaited because serverless
    // tears down after the response, no fire-and-forget option.
    try {
      const migration = await migratePeptidesToVault(state)
      console.log('[oauth-callback] post-connect migration:', migration)
    } catch (migrationError: any) {
      console.error('[oauth-callback] migration failed (non-fatal):', migrationError?.message)
    }

    // Redirect back to the requested return path with success
    return redirectToReturn(returnTo, 'drive=connected')

  } catch (error) {
    console.error('Google Drive callback error:', error)
    // returnTo not in scope here — fall back to profile so this still resolves.
    return NextResponse.redirect(
      new URL('/profile?drive=error&reason=callback_failed', process.env.NEXT_PUBLIC_BASE_URL!)
    )
  }
}
