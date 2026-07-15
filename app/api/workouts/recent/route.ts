import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserFromSession} from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth0.getSession();
    const authUser = session?.user;

    if (!authUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(session);

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 25;

    const sessions = await prisma.workoutSession.findMany({
      where: { userId: user.id },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ ok: true, items: sessions });
  } catch (error: any) {
    console.error('GET /api/workouts/recent error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to load workout history' }, { status: 500 });
  }
}
