import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserFromSession } from '@/lib/getUserFromSession';
import { prisma } from '@/lib/prisma';
import { enqueueDriveSync } from '@/lib/driveSyncQueue';
import { awardWorkoutPoints } from '@/lib/workoutPoints';
import { effectiveReadiness } from '@/lib/workoutReadiness';

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
      localDate: clientLocalDate,
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
    // The visitor's real calendar day, sent by the client -- falls back to
    // the server clock (UTC on Vercel) only when the client didn't send one,
    // fixing check-ins that landed on the wrong day for non-UTC visitors.
    const localDate =
      typeof clientLocalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientLocalDate)
        ? clientLocalDate
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}`;

    // Server-computed effective readiness (PRIMARY slider, else DERIVED blend)
    // -- what actually drives guidance/actuation, not just the raw slider.
    const effReadiness = effectiveReadiness({ readinessScore, energyLevel, sorenessLevel, sleepHours, stressLevel });

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
              lastReadinessScore: effReadiness,
              lastCheckInAt: now.toISOString(),
            },
          },
        });
      }
    }

    const award = await awardWorkoutPoints({
      userId: user.id,
      awardType: 'readiness',
      source: 'checkin',
      dayKey: localDate,
    });

    // Queue Google Drive sync (awaited — Vercel freezes the lambda after the response, killing un-awaited work)
    await enqueueDriveSync(user.id, new Date(), ['checkins']).catch(err => console.error('Drive enqueue failed:', err))

    return NextResponse.json({ ok: true, checkIn, pointsAwarded: award.points, effectiveReadiness: effReadiness });
  } catch (error: any) {
    console.error('POST /api/workouts/checkins error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to save check-in' }, { status: 500 });
  }
}
