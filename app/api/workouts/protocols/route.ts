import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserFromSession } from '@/lib/getUserFromSession';
import { getAvailableWorkoutProtocols } from '@/lib/workoutProtocolService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resolveUser = async () => {
  const session = await auth0.getSession();
  return getUserFromSession(session);
};

export async function GET() {
  try {
    const user = await resolveUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const protocols = await getAvailableWorkoutProtocols(user.id);
    return NextResponse.json({ ok: true, items: protocols });
  } catch (error: any) {
    console.error('GET /api/workouts/protocols error', error);
    return NextResponse.json({ ok: false, error: 'Unable to load protocols' }, { status: 500 });
  }
}
