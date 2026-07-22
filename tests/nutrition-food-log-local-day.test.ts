import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { awardNutritionPoints, NUTRITION_DAILY_POINTS } from '../src/lib/nutritionPoints';

const route = readFileSync(new URL('../app/api/foods/log/route.ts', import.meta.url), 'utf8');

assert.equal(NUTRITION_DAILY_POINTS, 10, 'nutrition daily award must remain the named 10-point constant');
assert.match(route, /const dayKey = isValidDayKey\(localDate\) \? localDate : localDayKey\(logTimestamp\)/);
assert.match(route, /const dayStart = dayKeyToUtcMidnight\(dayKey\)/);
assert.match(route, /nextDay\.setUTCDate\(nextDay\.getUTCDate\(\) \+ 1\)/);
assert.doesNotMatch(route, /setHours\(/, 'food-log route must not retain a server-local day bucket');
assert.doesNotMatch(route, /existingCountToday|foodLog\.count\(/, 'FoodLog existence must not gate awards');
assert.match(route, /localDate: dayKey/, 'FoodLog and created Journal JSON must carry the resolved day key');
assert.match(route, /date: dayStart/, 'DailyTask and Journal create must share the UTC-midnight container');
assert.match(route, /gte: dayStart[\s\S]*?lt: nextDay/, 'Journal lookup must use the same local-day container');
assert.match(route, /orderBy: \{ createdAt: 'desc' \}/, 'Journal merge target must be deterministic');
assert.match(route, /entryData\.localDate = dayKey/, 'an updated legacy Journal JSON must gain the day key when missing');
assert.match(route, /awardNutritionPoints\(\{ userId: user\.id, dayKey \}\)/);

const serverInstant = new Date('2026-07-22T00:43:03.059Z');
const browserDay = '2026-07-21';
const resolvedDay = /^\d{4}-\d{2}-\d{2}$/.test(browserDay)
  ? browserDay
  : `${serverInstant.getUTCFullYear()}-${String(serverInstant.getUTCMonth() + 1).padStart(2, '0')}-${String(serverInstant.getUTCDate()).padStart(2, '0')}`;
const dayStart = new Date(`${resolvedDay}T00:00:00.000Z`);
const nextDay = new Date(dayStart);
nextDay.setUTCDate(nextDay.getUTCDate() + 1);

assert.equal(resolvedDay, '2026-07-21', 'browser July 21 must win over the server July 22 instant');
assert.equal(dayStart.toISOString(), '2026-07-21T00:00:00.000Z');
assert.equal(nextDay.toISOString(), '2026-07-22T00:00:00.000Z');

const createdJournal = { date: dayStart, entry: { localDate: resolvedDay, tasksCompleted: { meals: true } } };
const updatedJournal = { nutritionNotes: 'existing', localDate: undefined as string | undefined };
if (!updatedJournal.localDate) updatedJournal.localDate = resolvedDay;
assert.equal(createdJournal.date.toISOString(), dayStart.toISOString());
assert.equal(createdJournal.entry.localDate, browserDay);
assert.equal(updatedJournal.localDate, browserDay);

function p2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('unique collision', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

class FakeNutritionDb {
  readonly dailyAwards = new Set<string>();
  readonly points: Array<{ userId: string; amount: number; activitySource: string }> = [];
  readonly foodLogs: string[] = [];
  nextAwardError: unknown = null;

  async $transaction<T>(callback: (tx: {
    dailyAward: { create: (args: { data: { userId: string; dayKey: string; awardType: string } }) => Promise<void> };
    gamificationPoint: { create: (args: { data: { userId: string; amount: number; activitySource: string } }) => Promise<void> };
  }) => Promise<T>): Promise<T> {
    return callback({
      dailyAward: {
        create: async ({ data }) => {
          if (this.nextAwardError) {
            const error = this.nextAwardError;
            this.nextAwardError = null;
            throw error;
          }
          const key = `${data.userId}:${data.dayKey}:${data.awardType}`;
          if (this.dailyAwards.has(key)) {
            throw p2002(['userId', 'dayKey', 'awardType']);
          }
          this.dailyAwards.add(key);
        },
      },
      gamificationPoint: {
        create: async ({ data }) => {
          this.points.push(data);
        },
      },
    });
  }
}

const userId = 'fixture-user';

async function main() {
  const fake = new FakeNutritionDb();
  const client = fake as unknown as Parameters<typeof awardNutritionPoints>[1];

  const [first, concurrent] = await Promise.all([
    awardNutritionPoints({ userId, dayKey: browserDay }, client),
    awardNutritionPoints({ userId, dayKey: browserDay }, client),
  ]);
  assert.deepEqual([first.points, concurrent.points].sort((a, b) => a - b), [0, 10]);
  assert.equal(fake.points.length, 1, 'concurrent calls must create only one point row');
  assert.equal(fake.points[0].activitySource, 'day:2026-07-21:nutrition-food-log');

  fake.foodLogs.push('temporary-food-log');
  fake.foodLogs.length = 0;
  const afterFoodDeletion = await awardNutritionPoints({ userId, dayKey: browserDay }, client);
  assert.deepEqual(afterFoodDeletion, { awarded: false, points: 0, dayKey: browserDay });
  assert.equal(fake.points.length, 1, 'deleting every FoodLog must not reopen the DailyAward gate');

  const unrelated = new FakeNutritionDb();
  unrelated.nextAwardError = p2002(['email']);
  await assert.rejects(
    awardNutritionPoints({ userId, dayKey: browserDay }, unrelated as unknown as Parameters<typeof awardNutritionPoints>[1]),
    (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002',
    'an unrelated P2002 must rethrow',
  );

  const general = new FakeNutritionDb();
  general.nextAwardError = new Error('database unavailable');
  await assert.rejects(
    awardNutritionPoints({ userId, dayKey: browserDay }, general as unknown as Parameters<typeof awardNutritionPoints>[1]),
    /database unavailable/,
    'a general database error must rethrow',
  );

  console.log('nutrition food-log local-day + DailyAward contract: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
