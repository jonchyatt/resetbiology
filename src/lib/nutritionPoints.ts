import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const NUTRITION_DAILY_POINTS = 10;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

type NutritionPointsClient = Pick<typeof prisma, '$transaction'>;

function isDailyAwardUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = (error.meta as { target?: unknown } | undefined)?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  return ['userId', 'dayKey', 'awardType'].every((field) => fields.some((value) => value.includes(field)));
}

export async function awardNutritionPoints(
  { userId, dayKey }: { userId: string; dayKey: string },
  client: NutritionPointsClient = prisma,
): Promise<{ awarded: boolean; points: number; dayKey: string }> {
  if (!DAY_KEY_RE.test(dayKey)) {
    throw new RangeError('Nutrition awards require a YYYY-MM-DD day key');
  }

  try {
    await client.$transaction(async (tx) => {
      await tx.dailyAward.create({
        data: { userId, dayKey, awardType: 'nutrition' },
      });
      await tx.gamificationPoint.create({
        data: {
          userId,
          pointType: 'nutrition',
          amount: NUTRITION_DAILY_POINTS,
          activitySource: `day:${dayKey}:nutrition-food-log`,
        },
      });
    });

    return { awarded: true, points: NUTRITION_DAILY_POINTS, dayKey };
  } catch (error) {
    if (isDailyAwardUniqueViolation(error)) {
      return { awarded: false, points: 0, dayKey };
    }
    throw error;
  }
}
