import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { encryptToken } from '@/lib/vault-encryption'
import { migratePeptidesToVault } from '@/lib/migratePeptidesToVault'
import { resolveVaultRootFolder } from '@/lib/google-drive'

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

    // P2.5-HIGH-1 fix: bind state.userId to the current Auth0 session so a
    // crafted state param can't redirect another user's tokens into our DB.
    // The connect route signed state with the *current session* user.id;
    // verify the same session is in play here.
    const session = await auth0.getSession()
    const sessionUser = await getUserFromSession(session)
    if (!sessionUser) {
      return redirectToReturn(returnTo, 'drive=error&reason=session_required')
    }
    if (sessionUser.id !== state) {
      console.warn('[oauth-callback] state.userId does not match session user — refusing', {
        sessionUserId: sessionUser.id,
        stateUserId: state,
      })
      return redirectToReturn(returnTo, 'drive=error&reason=session_mismatch')
    }

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

    // Best-effort: which Google account is connecting right now. Used only
    // to detect an account-swap against the stored pointer's owning account
    // (case 0 of resolveVaultRootFolder) — a failure here just means we
    // skip that specific check, not that the connect fails.
    let currentAccountEmail: string | null = null
    try {
      const userinfo = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get()
      currentAccountEmail = userinfo.data.email ?? null
    } catch (err: any) {
      console.warn('[oauth-callback] could not fetch account email:', err?.message)
    }

    // Folder identity: look up the user's stored pointer, validate it, and
    // fall back to appProperties-based discovery before ever creating a new
    // tree. See resolveVaultRootFolder() in google-drive.ts for the full
    // contract — this is the shared path every caller routes through.
    const existingUser = await prisma.user.findUnique({
      where: { id: state },
      select: { driveFolder: true, driveAccountEmail: true },
    })

    const resolution = await resolveVaultRootFolder(drive, state, existingUser?.driveFolder, {
      stored: existingUser?.driveAccountEmail,
      current: currentAccountEmail,
    })

    if (resolution.status === 'ambiguous') {
      // Zero unambiguous candidates to reuse and refuse to guess or create
      // another tree — flag for a human-visible reconciliation step instead.
      console.warn('[oauth-callback] ambiguous vault root, flagging for reconciliation:', {
        userId: state,
        candidateFolderIds: resolution.candidateFolderIds,
      })
      await prisma.user.update({
        where: { id: state },
        data: {
          googleDriveRefreshToken: encryptToken(tokens.refresh_token),
          googleDriveConnectedAt: new Date(),
          googleDriveSyncEnabled: false,
          driveVaultState: {
            needsFolderReconciliation: true,
            candidateFolderIds: resolution.candidateFolderIds,
            flaggedAt: new Date().toISOString(),
          },
          // NOT touching driveFolder or driveAccountEmail here — the old
          // pointer (and whichever account it belongs to) stays exactly as
          // it was until a human reconciles it.
        },
      })
      return redirectToReturn(returnTo, 'drive=needs_reconciliation')
    }

    const folderId = resolution.folderId
    // Structured resolution log (Argus catch, coexec 2026-07-15): which
    // strategy won — 'pointer' | 'appProperties' | 'created' — so Phase-3
    // post-deploy verification of appProperties discovery is provable from
    // Vercel runtime logs without manual Drive inspection.
    console.log('[oauth-callback] vault root resolved:', {
      userId: state,
      status: resolution.status,
      method: resolution.method,
      folderId,
    })

    // Update user with Drive credentials. Refresh token is encrypted at rest
    // via VAULT_TOKEN_KEY (AES-256-GCM); falls through to plaintext if the env
    // var isn't set yet — see vault-encryption.ts for graceful-degradation contract.
    await prisma.user.update({
      where: { id: state },
      data: {
        googleDriveRefreshToken: encryptToken(tokens.refresh_token),
        driveFolder: folderId,
        driveAccountEmail: currentAccountEmail,
        googleDriveConnectedAt: new Date(),
        googleDriveSyncEnabled: true,
        driveVaultState: null, // clear any stale reconciliation flag from a prior attempt
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
