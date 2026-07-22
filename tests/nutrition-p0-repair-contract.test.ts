import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/nutrition/p0-repair/route.ts', import.meta.url), 'utf8');

for (const exactValue of [
  '6a5caa5258a4662f3c70e1f2',
  'uniquenursinggifts@gmail.com',
  'P0-RESTORE-150-2026-07-22',
  '6a60026629f9719a3b37123c',
  '6a60026529f9719a3b37123a',
  '6a6011582f2e4303ce6875ec',
  '6a6011704d9b7eec4d44765a',
  '6a601217ec612432331bfff3',
  '2026-07-21T23:30:00.000Z',
]) {
  assert.ok(route.includes(exactValue), `repair route must freeze exact value ${exactValue}`);
}

assert.match(route, /session\?\.user\?\.email !== TARGET_EMAIL/);
assert.match(route, /prisma\.user\.findUnique\([\s\S]*?where: \{ id: TARGET_USER_ID \}/, 'authorization must resolve the frozen database ID read-only');
assert.match(route, /user\.id !== TARGET_USER_ID \|\| user\.email !== TARGET_EMAIL \|\| user\.auth0Sub !== session\.user\.sub/);
assert.doesNotMatch(route, /getUserFromSession/, 'plan authorization must not auto-create or auto-link a user');
assert.match(route, /return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/);
assert.doesNotMatch(route, /console\.(?:log|error|warn)/, 'repair route must not log health or Journal content');

const getBlock = route.match(/export async function GET\(\) \{([\s\S]*?)\n\}/)?.[1];
assert.ok(getBlock, 'repair route must expose GET plan');
assert.match(getBlock, /buildSnapshot/);
assert.doesNotMatch(getBlock, /\.(?:create|update|delete|deleteMany)\(/, 'GET must be plan-only');

assert.match(route, /sameIds\(Object\.keys\(input\), \['confirmation', 'manifestHash'\]\)/, 'POST must reject arbitrary IDs and extra controls');
assert.match(route, /input\.confirmation !== CONFIRMATION/);
assert.match(route, /\^\[a-f0-9\]\{64\}\$/, 'manifest hash must be a lowercase SHA-256');
assert.match(route, /createHash\('sha256'\)/);
assert.match(route, /timingSafeEqual/);

const postBlock = route.match(/export async function POST\(request: Request\) \{([\s\S]*)$/)?.[1];
assert.ok(postBlock, 'repair route must expose POST apply');
assert.match(postBlock, /prisma\.\$transaction\(async \(tx\) =>/);
assert.match(postBlock, /const before = await buildSnapshot\(tx\)/, 'manifest must be recomputed inside the transaction');
assert.ok(postBlock.indexOf("before.phase !== 'applyReady'") < postBlock.indexOf('tx.journalEntry.update('), 'all apply preconditions must precede writes');
assert.ok(postBlock.indexOf('hashMatches(') < postBlock.indexOf('tx.journalEntry.update('), 'candidate hash comparison must precede writes');
assert.match(postBlock, /before\.phase === 'alreadyRestored'[\s\S]*?writesPerformed: 0/, 'second apply must be an exact no-write success');

assert.match(route, /const PRE_PROOF_TOTAL = 190/);
assert.match(route, /const APPLY_TOTAL = 200/);
assert.match(route, /const BASELINE_TOTAL = 150/);
assert.match(route, /candidatePoints\.length === 5 && legacyCount === 4 && proofCount === 1/);
assert.match(route, /candidatePoints\.reduce\([\s\S]*?APPLY_TOTAL - BASELINE_TOTAL/);
assert.match(route, /point\.userId === TARGET_USER_ID && point\.earnedAt\.getTime\(\) >= POINT_CUTOFF\.getTime\(\)/);
assert.match(route, /proofAwards\.length === 1 && awardsExact/);
assert.match(route, /affectedIdsExact/);
assert.match(route, /duplicateRowsExact/);
assert.match(route, /canonicalJournal\.mood === null[\s\S]*?canonicalJournal\.weight === null/);
assert.match(route, /journal\.mood === null[\s\S]*?journal\.weight === null/);
assert.match(route, /containsOnlyCanonicalMemberContent/);
assert.match(route, /wrongDayFoodLogCount === 0/);
assert.match(route, /foodLogCount === 0/);
assert.match(route, /originalTaskExact/);
assert.match(route, /noWrongDayJournal/);

assert.match(route, /journalJsonShapesHash: sha256\(parsedEntries\)/, 'plan must expose only a hash of Journal JSON shapes');
assert.match(route, /candidateNutritionPoints: candidatePoints\.map/);
assert.match(route, /proofNutritionDailyAwards: proofAwards\.map/);
assert.match(route, /wrongDayMealsTaskId: wrongDayMealsTasks\[0\]\?\.id \?\? null/);
assert.doesNotMatch(route.match(/type SafeManifest = \{([\s\S]*?)\n\};/)?.[1] ?? '', /\bentry\b|nutritionNotes/, 'manifest must not expose Journal text');

assert.match(postBlock, /tx\.journalEntry\.deleteMany\([\s\S]*?DUPLICATE_JOURNAL_IDS/);
assert.match(postBlock, /tx\.gamificationPoint\.deleteMany\([\s\S]*?candidateNutritionPoints\.map/);
assert.match(postBlock, /tx\.dailyAward\.deleteMany\([\s\S]*?proofNutritionDailyAwards\[0\]\.id/);
assert.match(postBlock, /tx\.dailyTask\.deleteMany\([\s\S]*?wrongDayMealsTaskId/);
assert.match(postBlock, /duplicateDelete\.count !== DUPLICATE_JOURNAL_IDS\.length/);
assert.match(postBlock, /pointDelete\.count !== 5/);
assert.match(postBlock, /awardDelete\.count !== 1/);
assert.match(postBlock, /const after = await buildSnapshot\(tx\)/);
assert.match(postBlock, /after\.phase !== 'alreadyRestored'/, 'post-state must be verified inside the transaction');

assert.match(route, /canonicalBaselineNoteRestored/);
assert.match(route, /onlyCanonicalAffectedDayJournal/);
assert.match(route, /originalMealsTaskIntact/);
assert.match(route, /wrongDayMealsTaskAbsent/);
assert.match(route, /proofNutritionDailyAwardCount/);

console.log('nutrition P0 repair security + manifest contract: PASS');
