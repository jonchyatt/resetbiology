import { NextRequest, NextResponse } from 'next/server'
import { auth0Edge } from '@/lib/auth0-edge'

export const dynamic = 'force-dynamic'

const PHOTO_ANALYSIS_UNAVAILABLE =
  'Photo analysis is temporarily unavailable. Use Search to log your meal manually.'

/**
 * POST /api/foods/analyze-image
 *
 * Authenticated fail-closed boundary while the free, grounded photo lane is rebuilt.
 */
export async function POST(_req: NextRequest) {
  const session = await auth0Edge.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ponytail: Phase 1 containment stops before photo bytes are read; Phase 2c upgrades
  // this boundary to the validated free, database-grounded analysis lane.
  return NextResponse.json(
    {
      ok: false,
      error: 'photo_analysis_unavailable',
      message: PHOTO_ANALYSIS_UNAVAILABLE,
    },
    { status: 503 },
  )
}
