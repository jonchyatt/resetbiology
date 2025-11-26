import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { syncUserDataForDate } from '@/lib/google-drive'

// POST: Manual sync for today or a specific date
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const dateStr = body.date // Optional: YYYY-MM-DD format

    // Use provided date or default to today
    const syncDate = dateStr ? new Date(dateStr) : new Date()

    // Validate date
    if (isNaN(syncDate.getTime())) {
      return NextResponse.json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 })
    }

    // Perform sync
    const result = await syncUserDataForDate(user.id, syncDate)

    if (!result.success && result.errors.includes('Google Drive not connected')) {
      return NextResponse.json({
        error: 'Google Drive not connected',
        message: 'Please connect your Google Drive in Profile settings'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: result.success,
      date: syncDate.toISOString().split('T')[0],
      synced: result.synced,
      errors: result.errors,
      message: result.synced.length > 0
        ? `Successfully synced: ${result.synced.join(', ')}`
        : 'No data to sync for this date'
    })

  } catch (error) {
    console.error('Google Drive sync error:', error)
    return NextResponse.json({
      error: 'Failed to sync data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Get sync status/history
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, just return basic info
    // In the future, we could track sync history in a separate table
    return NextResponse.json({
      success: true,
      message: 'Use POST to trigger a sync',
      syncableData: [
        'Journal entries',
        'Workout sessions',
        'Nutrition logs',
        'Breath sessions (coming soon)',
        'Progress reports (coming soon)'
      ]
    })

  } catch (error) {
    console.error('Google Drive sync status error:', error)
    return NextResponse.json({
      error: 'Failed to get sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
