import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL + '/api/integrations/google-drive/callback'

// Scopes needed for Google Drive access
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Create/access files created by app
  'https://www.googleapis.com/auth/userinfo.email', // Get user email for folder naming
].join(' ')

/**
 * Validate that a returnTo path cannot trigger an open-redirect.
 * Must start with single "/", must not start with "//" (protocol-relative)
 * or "/\\" (backslash), and must not contain a scheme via ":".
 */
function isSafeReturnTo(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//') || value.startsWith('/\\')) return false
  if (value.includes(':')) return false
  return true
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({
        error: 'Google Drive integration not configured'
      }, { status: 500 })
    }

    // Optional returnTo: relative path the callback should land on after success.
    // Defaults to /profile so legacy callers behave identically.
    // Open-redirect guard: must be a single-segment-prefixed pathname,
    // never protocol-relative ("//evil.com"), absolute URL, or backslash-escaped.
    const requestedReturnTo = req.nextUrl.searchParams.get('returnTo') || '/profile'
    const safeReturnTo = isSafeReturnTo(requestedReturnTo) ? requestedReturnTo : '/profile'

    // Encode userId + returnTo into the OAuth state param (Google echoes this verbatim).
    const state = Buffer.from(
      JSON.stringify({ u: user.id, r: safeReturnTo }),
      'utf-8',
    ).toString('base64url')

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent to get refresh token
      state,
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl)

  } catch (error) {
    console.error('Google Drive connect error:', error)
    return NextResponse.json({
      error: 'Failed to initiate Google Drive connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
