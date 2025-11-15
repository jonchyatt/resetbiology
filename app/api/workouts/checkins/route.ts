import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';

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

    const checkIns = await prisma.workoutCheckIn.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ ok: true, items: checkIns });
  } catch (error: any) {
    console.error('GET /api/workouts/checkins error', error);
    return NextResponse.json({ ok: false, error: 'Unable to load check-ins' }, { status: 500 });
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
      assignmentId,
      readinessScore,
      energyLevel,
      sorenessLevel,
      sleepHours,
      stressLevel,
      mood,
      notes,
      tags,
    } = body ?? {};

    if (assignmentId) {
      const assignment = await prisma.workoutAssignment.findFirst({
        where: { id: assignmentId, userId: user.id },
      });
      if (!assignment) {
        return NextResponse.json({ ok: false, error: 'Invalid assignment' }, { status: 400 });
      }
    }

    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now
      .getDate())
      .padStart(2, '0')}`;
    const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}`;

    const checkIn = await prisma.workoutCheckIn.create({
      data: {
        userId: user.id,
        assignmentId: assignmentId ?? null,
        readinessScore: readinessScore ?? null,
        energyLevel: energyLevel ?? null,
        sorenessLevel: sorenessLevel ?? null,
        sleepHours: sleepHours ?? null,
        stressLevel: stressLevel ?? null,
        mood: mood ?? null,
        notes: notes ?? null,
        tags: Array.isArray(tags) ? tags : [],
        localDate,
        localTime,
      },
    });

    if (assignmentId) {
      const assignment = await prisma.workoutAssignment.findUnique({ where: { id: assignmentId } });
      if (assignment) {
        const existingProgress =
          (assignment.progress && typeof assignment.progress === 'object'
            ? (assignment.progress as Record<string, any>)
            : {}) ?? {};
        await prisma.workoutAssignment.update({
          where: { id: assignmentId },
          data: {
            progress: {
              ...existingProgress,
              lastReadinessScore: readinessScore ?? null,
              lastCheckInAt: now.toISOString(),
            },
          },
        });
      }
    }

    return NextResponse.json({ ok: true, checkIn });
  } catch (error: any) {
    console.error('POST /api/workouts/checkins error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to save check-in' }, { status: 500 });
  }
}
