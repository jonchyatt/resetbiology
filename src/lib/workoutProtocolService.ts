import { prisma } from '@/lib/prisma';
import { curatedWorkoutProtocols } from '@/data/workoutProtocolsLibrary';
import {
  AssignmentPersonalization,
  AssignmentPlan,
  AssignmentPlanSession,
  CuratedWorkoutProtocol,
  ProtocolPhase,
  ProtocolSession,
} from '@/types/workout';

type ProtocolLike = {
  id?: string;
  slug?: string;
  name: string;
  durationWeeks?: number | null;
  sessionsPerWeek?: number | null;
  phases: any;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const normalizePhases = (phases: any): ProtocolPhase[] => {
  if (!phases) return [];
  if (Array.isArray(phases)) return phases as ProtocolPhase[];
  if (typeof phases === 'string') {
    try {
      const parsed = JSON.parse(phases);
      return Array.isArray(parsed) ? (parsed as ProtocolPhase[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const buildAssignmentPlan = (
  protocol: ProtocolLike,
  options?: { startDate?: Date; personalization?: AssignmentPersonalization; sessionsPerWeekOverride?: number }
): AssignmentPlan => {
  const phases = normalizePhases(protocol.phases);
  const sessionsPerWeek = options?.sessionsPerWeekOverride ?? protocol.sessionsPerWeek ?? 3;
  const cadenceDays = Math.max(1, Math.floor(7 / Math.max(1, sessionsPerWeek)));
  const startDate = options?.startDate ?? new Date();

  const sessions: AssignmentPlanSession[] = [];
  let cursor = new Date(startDate);
  let sequence = 0;

  phases.forEach((phase) => {
    const weeks = Math.max(1, phase.durationWeeks ?? 1);
    for (let week = 1; week <= weeks; week += 1) {
      phase.sessions.forEach((session: ProtocolSession) => {
        sequence += 1;
        const blocks = session.blocks ?? [];
        const summary = blocks
          .map((block) => `${block.label}: ${block.exercises.map((exercise) => exercise.name).join(', ')}`)
          .join(' | ');
        sessions.push({
          id: `${phase.key}-w${week}-${session.key}-${sequence}`,
          phaseKey: phase.key,
          week,
          sequence,
          sessionKey: session.key,
          title: session.title,
          summary,
          scheduledDate: cursor.toISOString(),
          intensity: session.intensity,
          durationMinutes: session.durationMinutes,
          status: 'planned',
          readinessTips: session.readinessTips,
          blocks: blocks.map((block) => ({
            label: block.label,
            focus: block.focus,
            notes: block.notes,
            exercises: block.exercises,
          })),
        });
        cursor = addDays(cursor, cadenceDays);
      });
    }
  });

  return {
    createdAt: new Date().toISOString(),
    personalization: options?.personalization,
    sessions,
  };
};

export const summarizeAssignmentPlan = (plan?: AssignmentPlan) => {
  if (!plan) {
    return {
      totalSessions: 0,
      completedSessions: 0,
      skippedSessions: 0,
      completionRate: 0,
      nextSession: null,
    };
  }

  const totalSessions = plan.sessions.length;
  const completedSessions = plan.sessions.filter((session) => session.status === 'completed').length;
  const skippedSessions = plan.sessions.filter((session) => session.status === 'skipped').length;
  const nextSession =
    plan.sessions.find((session) => session.status === 'planned' || session.status === 'in-progress') ?? null;

  return {
    totalSessions,
    completedSessions,
    skippedSessions,
    completionRate: totalSessions > 0 ? completedSessions / totalSessions : 0,
    nextSession,
  };
};

export const ensureCuratedWorkoutProtocols = async () => {
  await Promise.all(
    curatedWorkoutProtocols.map(async (protocol: CuratedWorkoutProtocol) => {
      await prisma.workoutProtocol.upsert({
        where: { slug: protocol.slug },
        update: {
          name: protocol.name,
          summary: protocol.summary,
          goal: protocol.goal,
          level: protocol.trainingLevel,
          durationWeeks: protocol.durationWeeks,
          sessionsPerWeek: protocol.sessionsPerWeek,
          tags: protocol.tags,
          focusAreas: protocol.focusAreas,
          equipment: protocol.equipment,
          readinessNotes: protocol.readinessGuidelines,
          aiInsights: protocol.aiInsights,
          researchLinks: protocol.researchLinks as any,
          phases: protocol.phases as any,
        },
        create: {
          slug: protocol.slug,
          name: protocol.name,
          summary: protocol.summary,
          goal: protocol.goal,
          level: protocol.trainingLevel,
          durationWeeks: protocol.durationWeeks,
          sessionsPerWeek: protocol.sessionsPerWeek,
          tags: protocol.tags,
          focusAreas: protocol.focusAreas,
          equipment: protocol.equipment,
          readinessNotes: protocol.readinessGuidelines,
          aiInsights: protocol.aiInsights,
          researchLinks: protocol.researchLinks as any,
          phases: protocol.phases as any,
          isPublic: true,
        },
      });
    })
  );
};

export const getAvailableWorkoutProtocols = async (userId: string) => {
  await ensureCuratedWorkoutProtocols();
  const protocols = await prisma.workoutProtocol.findMany({
    where: {
      OR: [{ isPublic: true }, { createdBy: userId }],
    },
    orderBy: {
      name: 'asc',
    },
  });

  return protocols;
};
