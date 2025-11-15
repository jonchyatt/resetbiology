import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { buildAssignmentPlan } from '@/lib/workoutProtocolService';
import { AssignmentPersonalization } from '@/types/workout';

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

    const assignments = await prisma.workoutAssignment.findMany({
      where: { userId: user.id },
      include: {
        protocol: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, items: assignments });
  } catch (error: any) {
    console.error('GET /api/workouts/assignments error', error);
    return NextResponse.json({ ok: false, error: 'Unable to load assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await resolveUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      protocolId,
      startDate,
      personalization,
      readinessRules,
    }: {
      protocolId?: string;
      startDate?: string;
      personalization?: AssignmentPersonalization;
      readinessRules?: any;
    } = body || {};

    if (!protocolId) {
      return NextResponse.json({ ok: false, error: 'Missing protocolId' }, { status: 400 });
    }

    const protocol = await prisma.workoutProtocol.findUnique({ where: { id: protocolId } });
    if (!protocol) {
      return NextResponse.json({ ok: false, error: 'Protocol not found' }, { status: 404 });
    }

    const startDateValue = startDate ? new Date(startDate) : new Date();
    const plan = buildAssignmentPlan(protocol, {
      startDate: startDateValue,
      personalization,
    });

    const assignment = await prisma.workoutAssignment.create({
      data: {
        userId: user.id,
        protocolId: protocol.id,
        status: 'active',
        startDate: startDateValue,
        personalization: personalization as any,
        readinessRules: readinessRules ?? null,
        plan: plan as any,
        currentSessionIndex: 0,
        progress: {
          totalSessions: plan.sessions.length,
          completedSessions: 0,
          skippedSessions: 0,
        } as any,
      },
      include: {
        protocol: true,
      },
    });

    return NextResponse.json({ ok: true, assignment });
  } catch (error: any) {
    console.error('POST /api/workouts/assignments error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to save assignment' }, { status: 500 });
  }
}
