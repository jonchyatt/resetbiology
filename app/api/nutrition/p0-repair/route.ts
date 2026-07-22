import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth0 } from '@/lib/auth0';
import { dayKeyToUtcMidnight } from '@/lib/localDay';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGET_USER_ID = '6a5caa5258a4662f3c70e1f2';
const TARGET_EMAIL = 'uniquenursinggifts@gmail.com';
const CONFIRMATION = 'P0-RESTORE-150-2026-07-22';
const PROOF_DAY_KEY = '2026-07-21';
const WRONG_DAY_KEY = '2026-07-22';
const BASELINE_TOTAL = 150;
const PRE_PROOF_TOTAL = 190;
const APPLY_TOTAL = 200;
const POINT_CUTOFF = new Date('2026-07-21T23:30:00.000Z');
const LEGACY_SOURCE = 'Logged nutrition for today';
const PROOF_SOURCE = 'day:2026-07-21:nutrition-food-log';
const BASELINE_NUTRITION_NOTE = 'Nutrition tracked at 11:36 PM';
const CANONICAL_JOURNAL_ID = '6a60026629f9719a3b37123c';
const ORIGINAL_MEALS_TASK_ID = '6a60026529f9719a3b37123a';
const DUPLICATE_JOURNAL_IDS = [
  '6a6011582f2e4303ce6875ec',
  '6a6011704d9b7eec4d44765a',
  '6a601217ec612432331bfff3',
] as const;
const EXPECTED_AFFECTED_JOURNAL_IDS = [CANONICAL_JOURNAL_ID, ...DUPLICATE_JOURNAL_IDS].sort();
const TEST_NOTE_RE = /^Nutrition tracked at \d{1,2}:\d{2} (?:AM|PM)$/;

type RepairDb = Prisma.TransactionClient;
type JsonRecord = Record<string, unknown>;
type RepairPhase = 'preProof' | 'applyReady' | 'alreadyRestored' | 'mismatch';

type SafeManifest = {
  version: 1;
  targetUserId: string;
  proofDayKey: string;
  baselineTotal: number;
  currentTotal: number;
  expectedFinalTotal: number;
  canonicalJournalId: string | null;
  affectedDayJournalIds: string[];
  duplicateJournalIds: string[];
  journalJsonShapesHash: string;
  originalMealsTaskId: string | null;
  wrongDayMealsTaskId: string | null;
  candidateNutritionPoints: Array<{
    id: string;
    userId: string;
    amount: number;
    activitySource: string | null;
    earnedAt: string;
  }>;
  proofNutritionDailyAwards: Array<{
    id: string;
    userId: string;
    dayKey: string;
    awardType: string;
    createdAt: string;
  }>;
  foodLogCount: number;
  wrongDayFoodLogCount: number;
  wrongDayJournalCount: number;
};

type RepairSnapshot = {
  manifest: SafeManifest;
  manifestHash: string;
  phase: RepairPhase;
  checks: Record<string, boolean>;
  canonicalEntry: JsonRecord | null;
};

class RepairInvariantError extends Error {}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
    .join(',')}}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value), 'utf8').digest('hex');
}

function parseEntry(value: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value as JsonRecord).some(hasMeaningfulValue);
  return true;
}

function containsOnlyCanonicalMemberContent(candidate: JsonRecord, canonical: JsonRecord): boolean {
  for (const [key, value] of Object.entries(candidate)) {
    if (key === 'nutritionNotes' || key === 'localDate' || !hasMeaningfulValue(value)) continue;
    const survivorValue = canonical[key];
    if (stableJson(value) === stableJson(survivorValue)) continue;
    if (
      value && survivorValue &&
      typeof value === 'object' && !Array.isArray(value) &&
      typeof survivorValue === 'object' && !Array.isArray(survivorValue) &&
      containsOnlyCanonicalMemberContent(value as JsonRecord, survivorValue as JsonRecord)
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function hasOnlyTestNutritionNotes(entry: JsonRecord): boolean {
  const notes = entry.nutritionNotes;
  return typeof notes === 'string' && notes.split('\n').every((line) => TEST_NOTE_RE.test(line));
}

function sameIds(actual: string[], expected: readonly string[]): boolean {
  return stableJson([...actual].sort()) === stableJson([...expected].sort());
}

function hashMatches(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

async function resolveExactRepairUser() {
  try {
    const session = await auth0.getSession();
    if (session?.user?.email !== TARGET_EMAIL || typeof session.user.sub !== 'string') return null;
    const user = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      select: { id: true, email: true, auth0Sub: true },
    });
    if (!user || user.id !== TARGET_USER_ID || user.email !== TARGET_EMAIL || user.auth0Sub !== session.user.sub) return null;
    return user;
  } catch {
    return null;
  }
}

async function buildSnapshot(db: RepairDb): Promise<RepairSnapshot> {
  const dayStart = dayKeyToUtcMidnight(PROOF_DAY_KEY);
  const nextDay = dayKeyToUtcMidnight(WRONG_DAY_KEY);
  const dayAfterWrong = new Date(nextDay);
  dayAfterWrong.setUTCDate(dayAfterWrong.getUTCDate() + 1);

  const [
    affectedJournals,
    wrongDayJournalCount,
    originalMealsTask,
    wrongDayMealsTasks,
    candidatePoints,
    proofAwards,
    foodLogCount,
    wrongDayFoodLogCount,
    total,
  ] = await Promise.all([
    db.journalEntry.findMany({
      where: { userId: TARGET_USER_ID, date: { gte: dayStart, lt: nextDay } },
      select: { id: true, userId: true, entry: true, mood: true, weight: true, date: true },
      orderBy: { id: 'asc' },
    }),
    db.journalEntry.count({
      where: { userId: TARGET_USER_ID, date: { gte: nextDay, lt: dayAfterWrong } },
    }),
    db.dailyTask.findUnique({
      where: { id: ORIGINAL_MEALS_TASK_ID },
      select: { id: true, userId: true, date: true, taskName: true, completed: true },
    }),
    db.dailyTask.findMany({
      where: { userId: TARGET_USER_ID, date: nextDay, taskName: 'meals' },
      select: { id: true, userId: true, date: true, taskName: true, completed: true },
      orderBy: { id: 'asc' },
    }),
    db.gamificationPoint.findMany({
      where: {
        userId: TARGET_USER_ID,
        pointType: 'nutrition',
        amount: 10,
        earnedAt: { gte: POINT_CUTOFF },
      },
      select: { id: true, userId: true, amount: true, activitySource: true, earnedAt: true },
      orderBy: [{ earnedAt: 'asc' }, { id: 'asc' }],
    }),
    db.dailyAward.findMany({
      where: { userId: TARGET_USER_ID, dayKey: PROOF_DAY_KEY, awardType: 'nutrition' },
      select: { id: true, userId: true, dayKey: true, awardType: true, createdAt: true },
      orderBy: { id: 'asc' },
    }),
    db.foodLog.count({ where: { userId: TARGET_USER_ID } }),
    db.foodLog.count({
      where: {
        userId: TARGET_USER_ID,
        OR: [
          { localDate: WRONG_DAY_KEY },
          { localDate: null, loggedAt: { gte: nextDay, lt: dayAfterWrong } },
        ],
      },
    }),
    db.gamificationPoint.aggregate({ where: { userId: TARGET_USER_ID }, _sum: { amount: true } }),
  ]);

  const parsedEntries = affectedJournals.map((journal) => ({ id: journal.id, entry: parseEntry(journal.entry) }));
  const canonicalJournal = affectedJournals.find((journal) => journal.id === CANONICAL_JOURNAL_ID) ?? null;
  const canonicalEntry = canonicalJournal ? parseEntry(canonicalJournal.entry) : null;
  const duplicateJournals = affectedJournals.filter((journal) => DUPLICATE_JOURNAL_IDS.includes(journal.id as typeof DUPLICATE_JOURNAL_IDS[number]));
  const duplicateEntries = duplicateJournals.map((journal) => parseEntry(journal.entry));
  const currentTotal = total._sum.amount ?? 0;

  const manifest: SafeManifest = {
    version: 1,
    targetUserId: TARGET_USER_ID,
    proofDayKey: PROOF_DAY_KEY,
    baselineTotal: BASELINE_TOTAL,
    currentTotal,
    expectedFinalTotal: BASELINE_TOTAL,
    canonicalJournalId: canonicalJournal?.id ?? null,
    affectedDayJournalIds: affectedJournals.map((journal) => journal.id),
    duplicateJournalIds: duplicateJournals.map((journal) => journal.id),
    journalJsonShapesHash: sha256(parsedEntries),
    originalMealsTaskId: originalMealsTask?.id ?? null,
    wrongDayMealsTaskId: wrongDayMealsTasks[0]?.id ?? null,
    candidateNutritionPoints: candidatePoints.map((point) => ({
      ...point,
      earnedAt: point.earnedAt.toISOString(),
    })),
    proofNutritionDailyAwards: proofAwards.map((award) => ({
      ...award,
      createdAt: award.createdAt.toISOString(),
    })),
    foodLogCount,
    wrongDayFoodLogCount,
    wrongDayJournalCount,
  };

  const canonicalExact = Boolean(
    canonicalJournal && canonicalEntry &&
    canonicalJournal.userId === TARGET_USER_ID &&
    canonicalJournal.date.getTime() === dayStart.getTime() &&
    canonicalJournal.mood === null &&
    canonicalJournal.weight === null &&
    canonicalEntry.nutritionNotes === BASELINE_NUTRITION_NOTE,
  );
  const originalTaskExact = Boolean(
    originalMealsTask &&
    originalMealsTask.userId === TARGET_USER_ID &&
    originalMealsTask.date.getTime() === dayStart.getTime() &&
    originalMealsTask.taskName === 'meals' &&
    originalMealsTask.completed === true,
  );
  const wrongTaskBounded = wrongDayMealsTasks.length <= 1 && wrongDayFoodLogCount === 0;
  const noFoodLogs = foodLogCount === 0;
  const noWrongDayJournal = wrongDayJournalCount === 0;
  const duplicateIdsExact = sameIds(duplicateJournals.map((journal) => journal.id), DUPLICATE_JOURNAL_IDS);
  const affectedIdsExact = sameIds(affectedJournals.map((journal) => journal.id), EXPECTED_AFFECTED_JOURNAL_IDS);
  const duplicateRowsExact = Boolean(
    canonicalEntry && duplicateIdsExact && duplicateJournals.every((journal, index) => {
      const entry = duplicateEntries[index];
      return Boolean(
        entry &&
        journal.userId === TARGET_USER_ID &&
        journal.date.getTime() === dayStart.getTime() &&
        journal.mood === null &&
        journal.weight === null &&
        (entry.localDate === undefined || entry.localDate === PROOF_DAY_KEY) &&
        hasOnlyTestNutritionNotes(entry) &&
        containsOnlyCanonicalMemberContent(entry, canonicalEntry),
      );
    }),
  );
  const candidatesOwnedAndRecent = candidatePoints.every(
    (point) => point.userId === TARGET_USER_ID && point.earnedAt.getTime() >= POINT_CUTOFF.getTime(),
  );
  const legacyCount = candidatePoints.filter((point) => point.activitySource === LEGACY_SOURCE).length;
  const proofCount = candidatePoints.filter((point) => point.activitySource === PROOF_SOURCE).length;
  const candidateSourcesExact = candidatePoints.every(
    (point) => point.activitySource === LEGACY_SOURCE || point.activitySource === PROOF_SOURCE,
  );
  const awardsExact = proofAwards.every(
    (award) => award.userId === TARGET_USER_ID && award.dayKey === PROOF_DAY_KEY && award.awardType === 'nutrition',
  );

  const commonChecks = {
    canonicalExact,
    originalTaskExact,
    wrongTaskBounded,
    noFoodLogs,
    noWrongDayJournal,
  };
  const preProofChecks = {
    ...commonChecks,
    affectedIdsExact,
    duplicateRowsExact,
    preProofTotal: currentTotal === PRE_PROOF_TOTAL,
    fourLegacyPoints: candidatePoints.length === 4 && legacyCount === 4 && proofCount === 0,
    candidateSourcesExact,
    candidatesOwnedAndRecent,
    noProofAward: proofAwards.length === 0,
  };
  const applyChecks = {
    ...commonChecks,
    affectedIdsExact,
    duplicateRowsExact,
    applyTotal: currentTotal === APPLY_TOTAL,
    fiveCandidatePoints: candidatePoints.length === 5 && legacyCount === 4 && proofCount === 1,
    fullDelta: candidatePoints.reduce((sum, point) => sum + point.amount, 0) === APPLY_TOTAL - BASELINE_TOTAL,
    candidateSourcesExact,
    candidatesOwnedAndRecent,
    oneProofAward: proofAwards.length === 1 && awardsExact,
  };
  const restoredChecks = {
    ...commonChecks,
    restoredTotal: currentTotal === BASELINE_TOTAL,
    onlyCanonicalJournal: sameIds(affectedJournals.map((journal) => journal.id), [CANONICAL_JOURNAL_ID]),
    duplicateJournalsAbsent: duplicateJournals.length === 0,
    candidatePointsAbsent: candidatePoints.length === 0,
    proofAwardsAbsent: proofAwards.length === 0,
    wrongDayTaskAbsent: wrongDayMealsTasks.length === 0,
  };

  let phase: RepairPhase = 'mismatch';
  let checks: Record<string, boolean> = applyChecks;
  if (Object.values(restoredChecks).every(Boolean)) {
    phase = 'alreadyRestored';
    checks = restoredChecks;
  } else if (Object.values(applyChecks).every(Boolean)) {
    phase = 'applyReady';
    checks = applyChecks;
  } else if (Object.values(preProofChecks).every(Boolean)) {
    phase = 'preProof';
    checks = preProofChecks;
  }

  return { manifest, manifestHash: sha256(manifest), phase, checks, canonicalEntry };
}

function safePlan(snapshot: RepairSnapshot) {
  return {
    ok: snapshot.phase !== 'mismatch',
    mode: 'plan',
    phase: snapshot.phase,
    manifest: snapshot.manifest,
    manifestHash: snapshot.manifestHash,
    checks: snapshot.checks,
  };
}

function postReceipt(snapshot: RepairSnapshot) {
  return {
    totalPoints: snapshot.manifest.currentTotal,
    expectedTotalPoints: BASELINE_TOTAL,
    duplicateJournalIdsAbsent: snapshot.manifest.duplicateJournalIds.length === 0,
    onlyCanonicalAffectedDayJournal:
      sameIds(snapshot.manifest.affectedDayJournalIds, [CANONICAL_JOURNAL_ID]),
    canonicalBaselineNoteRestored: snapshot.checks.canonicalExact === true,
    originalMealsTaskIntact: snapshot.manifest.originalMealsTaskId === ORIGINAL_MEALS_TASK_ID,
    wrongDayMealsTaskAbsent: snapshot.manifest.wrongDayMealsTaskId === null,
    foodLogCount: snapshot.manifest.foodLogCount,
    proofNutritionDailyAwardCount: snapshot.manifest.proofNutritionDailyAwards.length,
  };
}

export async function GET() {
  const user = await resolveExactRepairUser();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const snapshot = await buildSnapshot(prisma as unknown as RepairDb);
  return NextResponse.json(safePlan(snapshot), { status: snapshot.phase === 'mismatch' ? 409 : 200 });
}

export async function POST(request: Request) {
  const user = await resolveExactRepairUser();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (!sameIds(Object.keys(input), ['confirmation', 'manifestHash'])) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (input.confirmation !== CONFIRMATION || typeof input.manifestHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.manifestHash)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const before = await buildSnapshot(tx);

      if (before.phase === 'alreadyRestored') {
        return {
          status: 200,
          body: {
            ok: true,
            alreadyRestored: true,
            writesPerformed: 0,
            receipt: postReceipt(before),
          },
        };
      }

      if (before.phase !== 'applyReady') {
        return { status: 409, body: { ...safePlan(before), error: 'Repair preconditions do not match' } };
      }
      if (!hashMatches(input.manifestHash as string, before.manifestHash)) {
        return { status: 409, body: { ...safePlan(before), error: 'Candidate manifest changed' } };
      }
      if (!before.canonicalEntry) throw new RepairInvariantError('Canonical entry unavailable');

      const restoredCanonicalEntry = {
        ...before.canonicalEntry,
        nutritionNotes: BASELINE_NUTRITION_NOTE,
      };
      await tx.journalEntry.update({
        where: { id: CANONICAL_JOURNAL_ID },
        data: { entry: JSON.stringify(restoredCanonicalEntry) },
      });

      const duplicateDelete = await tx.journalEntry.deleteMany({
        where: { id: { in: [...DUPLICATE_JOURNAL_IDS] }, userId: TARGET_USER_ID },
      });
      const pointDelete = await tx.gamificationPoint.deleteMany({
        where: {
          id: { in: before.manifest.candidateNutritionPoints.map((point) => point.id) },
          userId: TARGET_USER_ID,
        },
      });
      const awardDelete = await tx.dailyAward.deleteMany({
        where: {
          id: before.manifest.proofNutritionDailyAwards[0].id,
          userId: TARGET_USER_ID,
          dayKey: PROOF_DAY_KEY,
          awardType: 'nutrition',
        },
      });
      const wrongTaskDelete = before.manifest.wrongDayMealsTaskId
        ? await tx.dailyTask.deleteMany({
            where: {
              id: before.manifest.wrongDayMealsTaskId,
              userId: TARGET_USER_ID,
              date: dayKeyToUtcMidnight(WRONG_DAY_KEY),
              taskName: 'meals',
            },
          })
        : { count: 0 };

      if (
        duplicateDelete.count !== DUPLICATE_JOURNAL_IDS.length ||
        pointDelete.count !== 5 ||
        awardDelete.count !== 1 ||
        wrongTaskDelete.count !== (before.manifest.wrongDayMealsTaskId ? 1 : 0)
      ) {
        throw new RepairInvariantError('Exact delete count changed');
      }

      const after = await buildSnapshot(tx);
      if (after.phase !== 'alreadyRestored') {
        throw new RepairInvariantError('Post-transaction state did not match baseline');
      }

      return {
        status: 200,
        body: {
          ok: true,
          alreadyRestored: false,
          writesPerformed: 1 + duplicateDelete.count + pointDelete.count + awardDelete.count + wrongTaskDelete.count,
          appliedManifestHash: before.manifestHash,
          receipt: postReceipt(after),
        },
      };
    });

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    const status = error instanceof RepairInvariantError ? 409 : 500;
    return NextResponse.json({ ok: false, error: 'Repair aborted without changes' }, { status });
  }
}
