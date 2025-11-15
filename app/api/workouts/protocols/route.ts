import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { getAvailableWorkoutProtocols } from '@/lib/workoutProtocolService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resolveUser = async () => {
  const session = await auth0.getSession();
  const authUser = session?.user;
  if (!authUser) return null;

  let user = authUser.sub ? await prisma.user.findUnique({ where: { auth0Sub: authUser.sub } }) : null;
  if (!user && authUser.email) {
    user = await prisma.user.findUnique({ where: { email: authUser.email } });
  }

  return user;
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
