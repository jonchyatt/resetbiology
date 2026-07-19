// Single source of truth for "does this workout-domain action earn points
// today". Prescribed-session completion, quick-add, the legacy session
// route, and readiness check-ins all call this instead of creating a
// GamificationPoint row themselves — the DailyAward unique index
// (userId, dayKey, awardType) is what makes "first completion of the day
// wins" true no matter which path gets there first (data/rb-workout-rework
// W2 — see prisma/schema.prisma DailyAward comment for the bug this fixes).
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { localDayKey } from '@/lib/localDay';

// Values pending Jon's ratification — keep them named constants so a price
// change is a one-line edit, not a grep-and-replace.
export const WORKOUT_DAILY_POINTS = 40;
export const READINESS_DAILY_POINTS = 10;

export type WorkoutAwardType = 'workout' | 'readiness';

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Anti-abuse drift bound: a real client-local day key should land within a
// day (plus timezone slack) of the server's own clock. Anything further off
// is either a bug or a spoofed date trying to backfill a stale day's award.
const DRIFT_BOUND_MS = 26 * 60 * 60 * 1000;

function resolveDayKey(dayKey?: string | null): string {
  const now = new Date();
  if (dayKey && DAY_KEY_RE.test(dayKey)) {
    const parsed = new Date(`${dayKey}T00:00:00.000Z`);
    // Anchor the comparison at midday UTC of the parsed day, not midnight —
    // midnight-anchoring rejects legitimate evening completions in western
    // timezones (UTC-6 after ~20:00 local already exceeds a 26h midnight
    // bound). Midday keeps the same 26h slack on both sides of the day.
    const anchor = parsed.getTime() + 12 * 60 * 60 * 1000;
    if (!Number.isNaN(parsed.getTime()) && Math.abs(now.getTime() - anchor) <= DRIFT_BOUND_MS) {
      return dayKey;
    }
  }
  return localDayKey(now);
}

// Narrow to ONLY the DailyAward unique-index collision. Any other P2002 (or
// any other error entirely) must rethrow — swallowing an unrelated write
// failure as "already awarded today" would silently drop real errors.
function isDailyAwardUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  return fields.some((f) => f.includes('dayKey')) && fields.some((f) => f.includes('awardType'));
}

export async function awardWorkoutPoints({
  userId,
  awardType,
  source,
  dayKey,
}: {
  userId: string;
  awardType: WorkoutAwardType;
  source: string;
  dayKey?: string | null;
}): Promise<{ awarded: boolean; points: number; dayKey: string }> {
  const resolvedDayKey = resolveDayKey(dayKey);
  const amount = awardType === 'workout' ? WORKOUT_DAILY_POINTS : READINESS_DAILY_POINTS;
  const pointType = awardType === 'workout' ? 'workout' : 'workout_readiness';

  try {
    // Interactive $transaction requires a Mongo replica set (this codebase's
    // deploy target). Not run against a live DB here per ticket constraint —
    // both writes are atomic once applied: the DailyAward row and its
    // matching GamificationPoint either both land or neither does.
    await prisma.$transaction(async (tx) => {
      await tx.dailyAward.create({
        data: { userId, dayKey: resolvedDayKey, awardType },
      });
      await tx.gamificationPoint.create({
        data: {
          userId,
          pointType,
          amount,
          activitySource: `day:${resolvedDayKey}:${source}`,
        },
      });
    });
    return { awarded: true, points: amount, dayKey: resolvedDayKey };
  } catch (error) {
    if (isDailyAwardUniqueViolation(error)) {
      return { awarded: false, points: 0, dayKey: resolvedDayKey };
    }
    throw error;
  }
}
