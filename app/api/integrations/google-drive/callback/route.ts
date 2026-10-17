import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { encryptToken } from '@/lib/vault-encryption'
import { migratePeptidesToVault } from '@/lib/migratePeptidesToVault'
import { backfillOnConnect } from '@/lib/driveSyncQueue'
import { resolveVaultRootFolder } from '@/lib/google-drive'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL + '/api/integrations/google-drive/callback'

// Token save + migration + backfill (up to 500 rows + a profile copy) can run past the default limit.
export const maxDuration = 60

type Step = 'state' | 'session' | 'token' | 'userinfo' | 'resolve' | 'save' | 'migrate' | 'backfill'

// Another hit on this URL (browser retry/prefetch) may be finishing the connect while this one
// fails on the already-used one-time code. Wait up to ~15 s for that hit to land.
async function waitForConnected(userId: string, timeoutMs = 15000): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(userId)) return false
  const deadline = Date.now() + timeoutMs
  while (true) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleDriveSyncEnabled: true, googleDriveConnectedAt: true },
    })
    if (u?.googleDriveSyncEnabled && u.googleDriveConnectedAt && Date.now() - u.googleDriveConnectedAt.getTime() < 2 * 60 * 1000) {
      return true
    }
    if (Date.now() >= deadline) return false
    await new Promise(r => setTimeout(r, 1000))
  }
}

export async function GET(req: NextRequest) {
  // Hoisted so the catch below can still return the member to where they started.
  let fallbackReturnTo = '/profile'
  let fallbackUserId: string | null = null
  let step: Step = 'state'
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
    fallbackReturnTo = returnTo
    fallbackUserId = stateDecoded?.userId ?? null

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
    step = 'session'
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

    step = 'token'
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      console.error('No refresh token received from Google')
      return redirectToReturn(returnTo, 'drive=error&reason=no_refresh_token')
    }

    // RB-FIX-10: Google's granular consent lets the member leave the Drive box unticked; the
    // token then has no drive.file scope and every Drive call 403s (rerun 8: step=resolve).
    if (typeof tokens.scope === 'string' && !tokens.scope.split(' ').includes('https://www.googleapis.com/auth/drive.file')) {
      console.warn('[oauth-callback] token missing drive.file scope:', tokens.scope)
      return redirectToReturn(returnTo, 'drive=error&reason=drive_scope_missing')
    }

    // Wave J4.4: encrypt once, before touching Drive. Without a valid
    // VAULT_TOKEN_KEY we refuse to store the token unencrypted.
    let encryptedRefreshToken: string
    try {
      encryptedRefreshToken = encryptToken(tokens.refresh_token)
    } catch (encryptError) {
      console.error('[oauth-callback] refusing to store Drive token:', encryptError)
      return redirectToReturn(returnTo, 'drive=error&reason=vault_key')
    }

    oauth2Client.setCredentials(tokens)

    // Create a folder in user's Google Drive
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Best-effort: which Google account is connecting right now. Used only
    // to detect an account-swap against the stored pointer's owning account
    // (case 0 of resolveVaultRootFolder) — a failure here just means we
    // skip that specific check, not that the connect fails.
    step = 'userinfo'
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
    step = 'resolve'
    const existingUser = await prisma.user.findUnique({
      where: { id: state },
      select: { driveFolder: true, driveAccountEmail: true },
    })

    // RB-FIX-10: a freshly granted token can 403/404 on its first Drive calls for a few seconds
    // (rerun 8: first connect fails at step=resolve, an immediate retry works). Retry before failing.
    let resolution!: Awaited<ReturnType<typeof resolveVaultRootFolder>>
    for (let attempt = 1; ; attempt++) {
      try {
        resolution = await resolveVaultRootFolder(drive, state, existingUser?.driveFolder, {
          stored: existingUser?.driveAccountEmail,
          current: currentAccountEmail,
        })
        break
      } catch (resolveError: any) {
        console.warn('[oauth-callback] resolve attempt failed:', { attempt, message: resolveError?.message, code: resolveError?.code })
        if (attempt >= 4) throw resolveError
        await new Promise(r => setTimeout(r, 1500 * attempt))
      }
    }

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
          googleDriveRefreshToken: encryptedRefreshToken,
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
    // via VAULT_TOKEN_KEY (AES-256-GCM); never stored as plaintext (Wave J4.4).
    step = 'save'
    await prisma.user.update({
      where: { id: state },
      data: {
        googleDriveRefreshToken: encryptedRefreshToken,
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
    step = 'migrate'
    try {
      const migration = await migratePeptidesToVault(state)
      console.log('[oauth-callback] post-connect migration:', migration)
    } catch (migrationError: any) {
      console.error('[oauth-callback] migration failed (non-fatal):', migrationError?.message)
    }

    // RB-FIX-7 I-2: copy everything the member already has, retry old "not connected" failures.
    step = 'backfill'
    try {
      console.log('[oauth-callback] post-connect backfill:', await backfillOnConnect(state))
    } catch (backfillError: any) {
      console.error('[oauth-callback] backfill failed (non-fatal; the cron sweep retries):', backfillError?.message)
    }

    // Redirect back to the requested return path with success
    return redirectToReturn(returnTo, 'drive=connected')

  } catch (error) {
    const err = error as any
    console.error('Google Drive callback error:', { step, message: err?.message, code: err?.code ?? err?.response?.data?.error }, error)
    // RB-FIX-8 F-4: a duplicate hit on this URL (browser retry/prefetch) re-uses the one-time
    // Google code and throws AFTER the first hit already saved tokens and ran the backfill.
    // If this member got connected moments ago, report success, not an error.
    try {
      if (fallbackUserId && /^[a-f0-9]{24}$/i.test(fallbackUserId)) {
        const u = await prisma.user.findUnique({
          where: { id: fallbackUserId },
          select: { googleDriveSyncEnabled: true, googleDriveConnectedAt: true },
        })
        if (u?.googleDriveSyncEnabled && u.googleDriveConnectedAt && Date.now() - u.googleDriveConnectedAt.getTime() < 5 * 60 * 1000) {
          return redirectToReturn(fallbackReturnTo, 'drive=connected')
        }
        // invalid_grant / any token-step failure: the first hit may still be running, so poll for it.
        if (step === 'token' && await waitForConnected(fallbackUserId)) {
          return redirectToReturn(fallbackReturnTo, 'drive=connected')
        }
      }
    } catch (checkError) {
      console.error('[oauth-callback] post-failure connected check failed:', checkError)
    }
    return redirectToReturn(fallbackReturnTo, `drive=error&reason=callback_failed&step=${step}`)
  }
}
