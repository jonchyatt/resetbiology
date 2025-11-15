import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { summarizeAssignmentPlan } from '@/lib/workoutProtocolService';
import { AssignmentPlan, PlanSessionStatus } from '@/types/workout';

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

const normalizePlan = (value: any): AssignmentPlan => {
  if (!value) {
    return {
      createdAt: new Date().toISOString(),
      sessions: [],
    };
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as AssignmentPlan;
    } catch {
      return { createdAt: new Date().toISOString(), sessions: [] };
    }
  }
  // Ensure deep clone so we can safely mutate
  return JSON.parse(JSON.stringify(value)) as AssignmentPlan;
};

const logCompletedSession = async ({
  assignmentId,
  planSession,
  userId,
  protocolId,
  notes,
}: {
  assignmentId: string;
  planSession: any;
  userId: string;
  protocolId: string;
  notes?: string | null;
}) => {
  const exercisesFromPlan = (planSession.blocks ?? []).flatMap((block: any) => block.exercises ?? []);
  const exercises = exercisesFromPlan.map((exercise: any, index: number) => ({
    id: `${assignmentId}-${planSession.id}-${index}`,
    name: exercise.name,
    category: exercise.pattern,
    intensity: planSession.intensity,
    notes: exercise.description,
    sets: (exercise.sets ?? []).map((set: any) => ({
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      tempo: set.tempo,
      restSeconds: set.restSeconds,
      completed: true,
    })),
    source: 'protocol-plan',
  }));

  await prisma.workoutSession.create({
    data: {
      userId,
      programId: protocolId,
      exercises,
      duration: Math.round((planSession.durationMinutes ?? 40) * 60),
      notes: notes ?? planSession.summary,
      completedAt: new Date(),
    },
  });
};

export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const user = await resolveUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;
    const body = await request.json();
    const { action, sessionId, status, notes } = body ?? {};

    const assignment = await prisma.workoutAssignment.findFirst({
      where: { id: assignmentId, userId: user.id },
      include: { protocol: true },
    });

    if (!assignment) {
      return NextResponse.json({ ok: false, error: 'Assignment not found' }, { status: 404 });
    }

    if (!action) {
      return NextResponse.json({ ok: false, error: 'Missing action' }, { status: 400 });
    }

    const plan = normalizePlan(assignment.plan);

    if (action === 'update-status') {
      if (!status) {
        return NextResponse.json({ ok: false, error: 'Missing status' }, { status: 400 });
      }
      const updated = await prisma.workoutAssignment.update({
        where: { id: assignment.id },
        data: { status },
        include: { protocol: true },
      });
      return NextResponse.json({ ok: true, assignment: updated });
    }

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Missing sessionId' }, { status: 400 });
    }

    const sessionIndex = plan.sessions.findIndex((session) => session.id === sessionId);
    if (sessionIndex === -1) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    const nextStatus: PlanSessionStatus = action === 'complete-session' ? 'completed' : 'skipped';
    plan.sessions[sessionIndex].status = nextStatus;
    plan.sessions[sessionIndex].updatedAt = new Date().toISOString();
    plan.sessions[sessionIndex].sessionNotes = notes ?? null;

    if (action === 'complete-session') {
      await logCompletedSession({
        assignmentId: assignment.id,
        planSession: plan.sessions[sessionIndex],
        userId: user.id,
        protocolId: assignment.protocolId,
        notes,
      });
    }

    const summary = summarizeAssignmentPlan(plan);
    const nextIndex =
      plan.sessions.findIndex((session) => session.status === 'planned' || session.status === 'in-progress') ??
      plan.sessions.length;

    const updated = await prisma.workoutAssignment.update({
      where: { id: assignment.id },
      data: {
        plan: plan as any,
        progress: summary as any,
        currentSessionIndex: nextIndex > -1 ? nextIndex : plan.sessions.length,
      },
      include: { protocol: true },
    });

    return NextResponse.json({ ok: true, assignment: updated });
  } catch (error: any) {
    console.error('PATCH /api/workouts/assignments/[id] error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to update assignment' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const user = await resolveUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;

    const assignment = await prisma.workoutAssignment.findFirst({
      where: { id: assignmentId, userId: user.id },
    });

    if (!assignment) {
      return NextResponse.json({ ok: false, error: 'Assignment not found' }, { status: 404 });
    }

    const updated = await prisma.workoutAssignment.update({
      where: { id: assignment.id },
      data: { status: 'archived' },
    });

    return NextResponse.json({ ok: true, assignment: updated });
  } catch (error: any) {
    console.error('DELETE /api/workouts/assignments/[id] error', error);
    return NextResponse.json({ ok: false, error: 'Unable to archive assignment' }, { status: 500 });
  }
}
