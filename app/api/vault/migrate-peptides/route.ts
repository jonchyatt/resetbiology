import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { migratePeptidesToVault } from '@/lib/migratePeptidesToVault'

export const dynamic = 'force-dynamic'

/**
 * POST /api/vault/migrate-peptides — explicit user-triggered migration of
 * existing Mongo-routed peptide protocols into the Drive Vault.
 *
 * Idempotent. Auto-fired from the OAuth callback after a successful
 * Drive connect, but exposed as a route for retries / admin debugging.
 */
export async function POST() {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await migratePeptidesToVault(user.id)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (error: any) {
    console.error('POST /api/vault/migrate-peptides error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 },
    )
  }
}
