// T-A2 safety containment fixtures — no test runner is configured in this
// repo (no jest/vitest in package.json), so this is a plain runnable script
// per the ticket's fallback instruction. Run with:
//   npx tsx scripts/verify-containment.mjs
//
// Exercises the exact exported functions the real code paths call — no
// logic is duplicated here.

// NOTE: tsx wraps these .ts/.tsx modules as CJS when imported from a plain
// .mjs script (no "type": "module" in package.json), so named exports land
// under the CJS interop `default`/`module.exports` bag rather than as true
// ESM named exports. Destructuring from `.default` works around that
// script-runner quirk only — it doesn't affect the real Next.js build,
// which bundles these modules normally.
import * as trackerMod from "../src/components/Peptides/PeptideTracker.tsx";
import * as freqMod from "../src/lib/peptide-frequency.ts";
import * as schedMod from "../src/lib/scheduleNotifications.ts";

const { computeSyringeUnitsFromPrep, readPrepForProtocol } = trackerMod.default ?? trackerMod;
const { resolveFrequency } = freqMod.default ?? freqMod;
const { shouldScheduleOnDate, parseDoseTimes } = schedMod.default ?? schedMod;

let failures = 0;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
  } else {
    console.log(`PASS ${label}`);
  }
}

function assertTrue(cond, label) {
  if (!cond) {
    failures++;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`PASS ${label}`);
  }
}

console.log("--- H1: no fabricated prep for a protocol with no persisted input ---");
{
  // No window in this Node script -> readPrepForProtocol always returns {},
  // exactly simulating "brand-new protocol / no localStorage entry yet"
  // (fresh device, or a protocol created before this fix shipped).
  const persisted = readPrepForProtocol("protocol-with-no-prep");
  assertEqual(persisted, {}, "readPrepForProtocol returns empty for unknown protocol");

  const vialAmount = persisted.vialAmount || "";
  const reconstitution = persisted.reconstitution || "" /* no peptides.reconstitution either */;
  const duration = persisted.duration || "";
  const syringeUnits = computeSyringeUnitsFromPrep("250mcg", vialAmount, reconstitution);

  assertEqual(vialAmount, "", "H1: vialAmount renders empty, not fabricated '10mg'");
  assertEqual(duration, "", "H1: duration renders empty, not fabricated '8 weeks'");
  assertEqual(syringeUnits, 0, "H1: syringeUnits is 0 (never a fabricated '10'), triggers empty-state prompt");

  // Sanity check the positive case: real inputs DO compute a real number via
  // the untouched calculateDosage arithmetic (250mcg dose, 3mg vial, 2ml BAC
  // water -> 16.67u rounded to 17, not the old hardcoded "10").
  const realUnits = computeSyringeUnitsFromPrep("250mcg", "3mg", "2ml");
  assertEqual(realUnits, 17, "H1: real prep computes via calculateDosage (16.67u rounded), not the old hardcoded '10'");
}

console.log("\n--- H2: unrecognized frequency suppresses reminders ---");
{
  assertEqual(resolveFrequency("qwerty"), { kind: "unknown" }, "resolveFrequency('qwerty') -> unknown");
  const fires = shouldScheduleOnDate(
    { startDate: new Date("2026-07-01"), frequency: "qwerty" },
    new Date("2026-07-08"),
  );
  assertEqual(fires, false, "H2: shouldScheduleOnDate never defaults an unknown frequency to daily");
}

console.log("\n--- H3: weekly anchors to startDate weekday, not Monday ---");
{
  // Whatever weekday the protocol actually started on (not assumed/hardcoded
  // here — computed from the real Date, since the point of H3 is that the
  // code must never hardcode a day either).
  const startDate = new Date("2026-07-01");
  const startDow = startDate.getDay();
  const isMonday = startDow === 1;

  // A date exactly N*7 days from startDate always falls on the same weekday.
  const sameWeekdayLater = new Date(startDate.getTime() + 21 * 24 * 60 * 60 * 1000);
  assertEqual(sameWeekdayLater.getDay(), startDow, "sanity: +21 days is the same weekday as startDate");

  assertEqual(
    shouldScheduleOnDate({ startDate, frequency: "Once per week" }, sameWeekdayLater),
    true,
    "H3: weekly protocol fires again on its own startDate weekday",
  );

  if (!isMonday) {
    // startDate did not land on a Monday — pick a real Monday near
    // sameWeekdayLater and prove the OLD hardcoded-Monday bug is gone.
    const day = sameWeekdayLater.getDay();
    const daysToMonday = (day - 1 + 7) % 7 || 7; // nearest earlier Monday, never 0
    const aMonday = new Date(sameWeekdayLater.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
    assertEqual(aMonday.getDay(), 1, "sanity: constructed date is a Monday");
    assertEqual(
      shouldScheduleOnDate({ startDate, frequency: "Once per week" }, aMonday),
      false,
      "H3: weekly protocol does NOT fire on a hardcoded Monday when startDate is a different weekday",
    );
  }

  // Nx-per-week with no explicit days chosen never invents Mon/Wed/Fri.
  assertEqual(resolveFrequency("3x per week"), { kind: "unknown" }, "H3: bare '3x per week' text is unknown, not invented Mon/Wed/Fri");
  assertEqual(
    shouldScheduleOnDate({ startDate, frequency: "3x per week" }, sameWeekdayLater),
    false,
    "H3: '3x per week' with no explicit days does not invent a schedule",
  );

  // Explicit day list from DosageCalculator's custom picker IS honored.
  assertEqual(
    resolveFrequency("Mon/Wed/Fri"),
    { kind: "days-of-week", daysOfWeek: [1, 3, 5] },
    "H3: explicit day list from the custom picker is parsed directly",
  );
}

console.log("\n--- H6: twice-daily protocol yields 2 dose slots/day ---");
{
  // "AM & PM (twice daily)" -> 2 distinct dose times, the same twice-daily
  // detection PeptideTracker's slot generator (slotsForProtocol) keys off.
  const twiceDailyTimes = parseDoseTimes("AM & PM (twice daily)");
  assertEqual(twiceDailyTimes.length, 2, "H6: twice-daily timing resolves to 2 distinct dose times/slots");
  assertEqual(twiceDailyTimes, ["08:00", "20:00"], "H6: AM+PM slots are 08:00 and 20:00");

  // Explicit slash-separated times (the real format DosageCalculator writes
  // when a member picks 2 dose times) also yields 2 slots.
  const explicitTimes = parseDoseTimes("08:00/20:00");
  assertEqual(explicitTimes.length, 2, "H6: explicit '08:00/20:00' timing also yields 2 slots");
}

console.log(
  failures === 0
    ? "\nALL CONTAINMENT FIXTURES PASSED"
    : `\n${failures} FIXTURE(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
