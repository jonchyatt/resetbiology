import { NextRequest, NextResponse } from 'next/server'
import { EmailFailureLogger } from '@/lib/emailFailureLogger'
import { auth0 } from '@/lib/auth0'

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth0.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hours = parseInt(req.nextUrl.searchParams.get('hours') || '24')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

    const failures = await EmailFailureLogger.getRecentFailures(hours, limit)
    const stats = await EmailFailureLogger.getFailureStats(hours)

    return NextResponse.json({
      failures,
      stats
    })
  } catch (error: any) {
    console.error('Error fetching email failures:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
