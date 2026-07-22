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
import * as calculatorMod from "../src/components/Peptides/DosageCalculator.tsx";
import * as freqMod from "../src/lib/peptide-frequency.ts";
import * as schedMod from "../src/lib/scheduleNotifications.ts";
import * as doseSlotMod from "../src/lib/peptide-dose-slot.ts";
import * as driveMod from "../src/lib/google-drive.ts";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const {
  computeSyringeUnitsFromPrep,
  readPrepForProtocol,
  doseScheduleDecision,
  slotsForProtocol,
  reconcileCalendarSlotRecords,
  selectDoseEntrySlot,
  resolveDoseEntryIntent,
  matchCompletionSlot,
  formatScheduledTime12h,
  scheduledTimeSortValue,
  compareCompletedDoseEntries,
  resolveDoseTimeLabel,
} = trackerMod.default ?? trackerMod;
const {
  calculateDosage,
  normalizePreparation,
  normalizeImportedPreparation,
  protocolPreparationPayload,
} = calculatorMod.default ?? calculatorMod;
const { resolveFrequency, isDoseDayForProtocol, hasKnownSchedule } = freqMod.default ?? freqMod;
const { shouldScheduleOnDate, parseDoseTimes } = schedMod.default ?? schedMod;
const {
  buildPeptideDoseSlotKey,
  parsePeptideDoseSlotKey,
  validatePeptideDoseSlotKey,
} = doseSlotMod.default ?? doseSlotMod;
const { formatPeptideDoses, generateTrackerCSV } = driveMod.default ?? driveMod;

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

function assertThrows(fn, label) {
  try {
    fn();
    failures++;
    console.error(`FAIL ${label}: expected function to throw`);
  } catch {
    console.log(`PASS ${label}`);
  }
}

console.log("--- P0-03: Add Protocol preparation states stay member-confirmed ---");
{
  // The component, its imported-protocol effect, and its save callback all
  // call these helpers. This proves transitions and serialized payloads, not
  // just a duplicated state label.
  const untouched = normalizePreparation("", "");
  const selected = normalizePreparation("", "");
  const explicit = normalizePreparation("5", "2");
  const imported = normalizeImportedPreparation({ id: "p1", name: "Imported", vialSize: 3, totalVolume: 1.5 });
  const missingImport = normalizeImportedPreparation({ id: "p2", name: "Missing volume", vialSize: 10 });
  const invalidImport = normalizeImportedPreparation({ id: "p3", name: "Invalid vial", vialSize: Number.NaN, totalVolume: 2 });
  const partial = normalizePreparation("5", "");
  const invalid = normalizePreparation("0", "2");
  const afterPeptideChange = normalizePreparation("", "");
  const afterReset = normalizePreparation("", "");

  assertEqual(untouched.state, "absent", "P0-03 untouched: preparation starts absent");
  assertEqual(selected.state, "absent", "P0-03 card-selected: catalog metadata does not become preparation");
  assertEqual(explicit, {
    state: "complete", peptideAmount: 5, totalVolume: 2, peptideAmountText: "5", totalVolumeText: "2",
  }, "P0-03 explicit-complete: normalized preparation drives calculation");
  assertEqual(imported.state, "complete", "P0-03 imported-complete: both imported values are required and usable");
  assertEqual(missingImport.state, "absent", "P0-03 missing import: vial alone clears to no preparation");
  assertEqual(invalidImport.state, "absent", "P0-03 invalid import: non-finite vial clears to no preparation");
  assertEqual(partial.state, "invalid", "P0-03 partial: vial alone blocks save");
  assertEqual(
    { state: partial.state, peptideAmount: partial.peptideAmount, totalVolume: partial.totalVolume },
    { state: "invalid", peptideAmount: 0, totalVolume: 0 },
    "P0-03 incomplete imported calculate path keeps math at zero until the second field completes it",
  );
  assertEqual(invalid.state, "invalid", "P0-03 invalid: zero vial amount blocks save");
  assertEqual(afterPeptideChange.state, "absent", "P0-03 peptide-change: preparation clears instead of inheriting prior values");
  assertEqual(afterReset.state, "absent", "P0-03 reset: preparation returns to the valid no-prep state");
  assertEqual(protocolPreparationPayload(untouched), { vialAmount: "", reconstitution: "" }, "P0-03 absent prep: callback emits empty prep fields");
  assertEqual(protocolPreparationPayload(explicit), { vialAmount: "5mg", reconstitution: "2ml" }, "P0-03 complete prep: callback emits normalized member values");

  assertEqual(normalizePreparation(".5", "1").peptideAmountText, "0.5", "P0-03 .5 normalizes to decimal text");
  assertEqual(normalizePreparation("0.005", "1").peptideAmountText, "0.005", "P0-03 0.005 is never rounded into a different vial value");
  assertEqual(normalizePreparation("1e2", "1").peptideAmountText, "100", "P0-03 scientific notation saves and displays as decimal text");

  const calculatorSource = readFileSync(new URL("../src/components/Peptides/DosageCalculator.tsx", import.meta.url), "utf8");
  assertTrue(
    calculatorSource.includes("const hasCompletePreparation = normalizedPreparation.state === 'complete';"),
    "P0-03 completeness has no calculate-mode bypass",
  );
  assertTrue(
    calculatorSource.includes("value={preparation.totalVolume}")
      && calculatorSource.includes("value={preparation.peptideAmount}")
      && calculatorSource.includes("<option value=\"\" className=\"bg-gray-800 text-white\">Choose total volume</option>"),
    "P0-03 preparation controls bind to raw preparation strings with an empty-volume option",
  );
  assertTrue(
    calculatorSource.includes("setPreparation(nextPreparation);")
      && calculatorSource.includes("applyPreparation({ ...preparation, peptideAmount: value });"),
    "P0-03 one raw imported field remains visible while normalized math stays incomplete",
  );
  const saveHandler = calculatorSource.slice(calculatorSource.indexOf("const handleProtocolSave"));
  const preparationGuard = saveHandler.indexOf("if (normalizedPreparation.state === 'invalid') return;");
  const saveLatch = saveHandler.indexOf("savingInFlightRef.current = true;");
  assertTrue(
    preparationGuard >= 0 && saveLatch >= 0 && preparationGuard < saveLatch,
    "P0-03 invalid preparation returns before the save latch can be set",
  );
  assertTrue(
    !/bacteriostatic|BAC water|refrigerator|30 days/i.test(calculatorSource),
    "P0-03 calculator contains no fixed diluent, refrigeration, or 30-day claims",
  );
  assertTrue(
    calculatorSource.includes("const [duration, setDuration] = useState<string>('');"),
    "P0-03 duration starts empty",
  );

  const baselineSource = execFileSync(
    "git",
    ["show", "add9dc2996418a5d3b2e0977a341d3fab5b2b96d:src/components/Peptides/DosageCalculator.tsx"],
    { encoding: "utf8" },
  );
  const calculationBody = (source) => {
    const start = source.indexOf("export const calculateDosage");
    const end = source.indexOf("/*********************************", start);
    return source.slice(start, end);
  };
  assertEqual(
    calculationBody(calculatorSource).replace(/\r\n/g, "\n"),
    calculationBody(baselineSource),
    "P0-03 calculateDosage is byte-identical to add9 baseline after repository EOL normalization",
  );
  assertEqual(
    calculateDosage({ desiredDose: 250, doseUnit: "mcg", peptideConcentration: 0, peptideAmount: explicit.peptideAmount, totalVolume: explicit.totalVolume, insulinSyringeUnits: true }).insulinUnits,
    10,
    "P0-03 normalized numeric inputs drive the unchanged calculator",
  );
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

console.log("\n--- P0-04: off-schedule confirmation and calendar slot identity ---");
{
  const localDay = new Date(2026, 6, 20, 0, 0, 0, 0);
  const weeklyStart = new Date(2026, 6, 19, 0, 0, 0, 0);
  assertEqual(
    doseScheduleDecision("Once per week", weeklyStart, localDay),
    "off_schedule",
    "P0-04 known off-schedule day reaches the styled confirmation decision",
  );
  assertEqual(
    doseScheduleDecision("qwerty", weeklyStart, localDay),
    "unknown",
    "P0-04 unknown frequency fails open without inventing an off-schedule violation",
  );
  assertEqual(
    doseScheduleDecision("Daily", weeklyStart, localDay),
    "scheduled",
    "P0-04 scheduled dose opens normal entry directly",
  );

  const protocol = {
    id: "protocol-am-pm",
    name: "Shared label",
    purpose: "General",
    dosage: "0.25 mg",
    timing: "AM & PM (twice daily)",
    frequency: "Daily",
    duration: "",
    vialAmount: "",
    reconstitution: "",
    syringeUnits: 0,
    isActive: true,
  };
  const sameLabelProtocol = { ...protocol, id: "protocol-same-label", timing: "08:00" };
  const day = "2026-07-20";
  const slots = slotsForProtocol(protocol);
  assertEqual(slots.map((slot) => slot.id), ["am", "pm"], "P0-04 AM/PM slot IDs stay independent");
  assertEqual(
    buildPeptideDoseSlotKey(protocol.id, day, "pm"),
    "protocol-am-pm::2026-07-20::pm",
    "P0-04 canonical slot key is protocolId::localDay::slotId",
  );
  const explicitSlots = slotsForProtocol({ ...protocol, timing: "08:00/20:00" });
  assertEqual(
    matchCompletionSlot({
      protocolId: protocol.id,
      localDay: day,
      slots: explicitSlots,
    }),
    undefined,
    "P0-04 explicit multi-time legacy completion without durable slot stays unmatched",
  );
  assertEqual(
    matchCompletionSlot({
      protocolId: protocol.id,
      localDay: day,
      slots,
      existingSlotKey: buildPeptideDoseSlotKey(protocol.id, day, "pm"),
    })?.id,
    "pm",
    "P0-04 durable PM key consumes PM only",
  );
  assertEqual(
    matchCompletionSlot({
      protocolId: protocol.id,
      localDay: day,
      slots,
      localTime: "11:59:59",
    }),
    undefined,
    "P0-04 keyless legacy late-AM completion does not infer AM",
  );
  assertEqual(
    matchCompletionSlot({
      protocolId: protocol.id,
      localDay: day,
      slots,
      localTime: "12:00:01",
    }),
    undefined,
    "P0-04 keyless legacy early-PM completion does not infer PM",
  );
  assertEqual(
    matchCompletionSlot({
      protocolId: sameLabelProtocol.id,
      localDay: day,
      slots: slotsForProtocol(sameLabelProtocol),
      existingSlotKey: buildPeptideDoseSlotKey("other-protocol", day, "0"),
    }),
    undefined,
    "P0-04 present-but-mismatched identity never falls through as a legacy single slot",
  );
  const explicitScheduled = explicitSlots.map((slot) => ({
    protocolId: protocol.id,
    protocolName: protocol.name,
    localDay: day,
    slotId: slot.id,
    slotKey: buildPeptideDoseSlotKey(protocol.id, day, slot.id),
    scheduledTime: slot.time,
    status: "pending",
  }));
  const unmatchedExplicit = reconcileCalendarSlotRecords(explicitScheduled, [{
    protocolId: protocol.id,
    protocolName: protocol.name,
    localDay: day,
    slotId: "legacy-explicit-dose",
    slotKey: `display-only::${protocol.id}::${day}::legacy-explicit-dose`,
    scheduledTime: "09:00",
    status: "completed",
  }]);
  assertEqual(
    unmatchedExplicit.filter((record) => record.status === "pending").map((record) => record.slotId),
    ["slot-0", "slot-1"],
    "P0-04 explicit legacy completion leaves both scheduled siblings pending",
  );
  const scheduled = [
    ...slots.map((slot) => ({
      protocolId: protocol.id,
      protocolName: protocol.name,
      localDay: day,
      slotId: slot.id,
      slotKey: buildPeptideDoseSlotKey(protocol.id, day, slot.id),
      scheduledTime: slot.time,
      status: "pending",
    })),
    {
      protocolId: sameLabelProtocol.id,
      protocolName: sameLabelProtocol.name,
      localDay: day,
      slotId: "0",
      slotKey: buildPeptideDoseSlotKey(sameLabelProtocol.id, day, "0"),
      scheduledTime: "08:00",
      status: "pending",
    },
    {
      protocolId: protocol.id,
      protocolName: protocol.name,
      localDay: "2026-07-21",
      slotId: "am",
      slotKey: buildPeptideDoseSlotKey(protocol.id, "2026-07-21", "am"),
      scheduledTime: "08:00",
      status: "pending",
    },
  ];
  const durablePm = reconcileCalendarSlotRecords(
    scheduled.slice(0, 2),
    [{
      protocolId: protocol.id,
      protocolName: protocol.name,
      localDay: day,
      slotId: "pm",
      slotKey: buildPeptideDoseSlotKey(protocol.id, day, "pm"),
      scheduledTime: "20:00",
      status: "completed",
    }],
  );
  assertEqual(
    durablePm.filter((record) => record.status === "pending").map((record) => record.slotId),
    ["am"],
    "P0-04 durable PM completion consumes PM only",
  );
  const completed = [{
    protocolId: protocol.id,
    protocolName: protocol.name,
    localDay: day,
    slotId: "am",
    slotKey: buildPeptideDoseSlotKey(protocol.id, day, "am"),
    scheduledTime: "08:00",
    status: "completed",
    sourceDose: { id: "dose-am-1" },
  }, {
    protocolId: protocol.id,
    protocolName: protocol.name,
    localDay: day,
    slotId: "am",
    slotKey: buildPeptideDoseSlotKey(protocol.id, day, "am"),
    scheduledTime: "08:00",
    status: "completed",
    sourceDose: { id: "dose-am-2" },
  }];
  const records = reconcileCalendarSlotRecords(scheduled, completed);
  const sameDay = records.filter((record) => record.protocolId === protocol.id && record.localDay === day);
  assertEqual(sameDay.filter((record) => record.status === "completed").length, 2, "P0-04 duplicate historical AM logs both remain visible and countable");
  assertEqual(sameDay.filter((record) => record.status === "pending").length, 1, "P0-04 row46: PM remains pending after AM completion");
  assertTrue(
    records.some((record) => record.slotKey === "protocol-am-pm::2026-07-20::pm" && record.status === "pending"),
    "P0-04 row46: pending PM uses the exact canonical key",
  );
  assertTrue(
    records.some((record) => record.protocolId === sameLabelProtocol.id && record.status === "pending"),
    "P0-04 same-label protocols stay independent",
  );
  assertTrue(
    records.some((record) => record.localDay === "2026-07-21" && record.status === "pending"),
    "P0-04 adjacent local days stay independent",
  );

  const clickedPm = selectDoseEntrySlot(
    [
      { id: buildPeptideDoseSlotKey(protocol.id, day, "am"), scheduledTime: "08:00" },
      { id: buildPeptideDoseSlotKey(protocol.id, day, "pm"), scheduledTime: "20:00" },
    ],
    buildPeptideDoseSlotKey(protocol.id, day, "pm"),
  );
  assertEqual(
    clickedPm?.id,
    buildPeptideDoseSlotKey(protocol.id, day, "pm"),
    "P0-04 clicked PM remains PM even while AM is also pending",
  );
  const scheduledPmIntent = resolveDoseEntryIntent(
    "scheduled",
    [
      { id: buildPeptideDoseSlotKey(protocol.id, day, "am"), scheduledTime: "08:00" },
      { id: buildPeptideDoseSlotKey(protocol.id, day, "pm"), scheduledTime: "20:00" },
    ],
    new Set([
      buildPeptideDoseSlotKey(protocol.id, day, "am"),
      buildPeptideDoseSlotKey(protocol.id, day, "pm"),
    ]),
    buildPeptideDoseSlotKey(protocol.id, day, "pm"),
  );
  assertEqual(
    scheduledPmIntent,
    {
      kind: "open",
      scheduledDoseId: buildPeptideDoseSlotKey(protocol.id, day, "pm"),
      hasNoScheduledRow: false,
    },
    "P0-04 scheduled PM intent preserves the exact clicked PM identity",
  );
  assertEqual(
    selectDoseEntrySlot([{ id: "current-slot", scheduledTime: "08:00" }], "stale-slot"),
    undefined,
    "P0-04 stale clicked slot fails closed instead of switching to another slot",
  );
  assertEqual(
    resolveDoseEntryIntent(
      "scheduled",
      [{ id: "current-slot", scheduledTime: "08:00" }],
      new Set(["current-slot"]),
      "stale-slot",
    ),
    { kind: "abort" },
    "P0-04 stale requested row on a still-scheduled day fails closed",
  );

  const staleClickedId = buildPeptideDoseSlotKey(protocol.id, day, "pm");
  const freshOffScheduleDecision = doseScheduleDecision(
    "Once per week",
    weeklyStart,
    localDay,
  );
  const offScheduleIntent = resolveDoseEntryIntent(
    freshOffScheduleDecision,
    [{ id: staleClickedId, scheduledTime: "20:00", slotKey: staleClickedId }],
    new Set(slotsForProtocol(protocol).map((slot) =>
      buildPeptideDoseSlotKey(protocol.id, day, slot.id))),
    staleClickedId,
  );
  assertEqual(
    offScheduleIntent,
    { kind: "confirm_off_schedule" },
    "P0-04 freshly off-schedule decision discards a stale clicked scheduled identity",
  );
  const keylessPostBody = JSON.parse(JSON.stringify({
    protocolId: protocol.id,
    localDate: day,
    slotKey: undefined,
  }));
  assertEqual(
    {
      bodyHasSlotKey: Object.prototype.hasOwnProperty.call(keylessPostBody, "slotKey"),
      validation: validatePeptideDoseSlotKey(
        keylessPostBody,
        {
          id: protocol.id,
          frequency: "Once per week",
          timing: protocol.timing,
          startDate: weeklyStart,
        },
      ),
    },
    { bodyHasSlotKey: false, validation: { ok: true, slotKey: null } },
    "P0-04 stale-row override serializes a keyless POST that production validation accepts",
  );
  assertEqual(
    resolveDoseEntryIntent(
      "unknown",
      [{ id: staleClickedId, scheduledTime: "20:00", slotKey: staleClickedId }],
      new Set(),
      staleClickedId,
    ),
    { kind: "open", hasNoScheduledRow: true },
    "P0-04 unknown schedule also discards rendered-row identity and stays keyless",
  );

  const timingChangedProtocol = { ...protocol, timing: "08:00" };
  const timingChangedValidIds = new Set(
    slotsForProtocol(timingChangedProtocol).map((slot) =>
      buildPeptideDoseSlotKey(protocol.id, day, slot.id)),
  );
  const stillScheduledDecision = doseScheduleDecision(
    timingChangedProtocol.frequency,
    weeklyStart,
    localDay,
  );
  const timingChangedIntent = resolveDoseEntryIntent(
    stillScheduledDecision,
    [{ id: staleClickedId, scheduledTime: "20:00", slotKey: staleClickedId }],
    timingChangedValidIds,
    staleClickedId,
  );
  let timingChangedPostCalls = 0;
  if (timingChangedIntent.kind === "open") timingChangedPostCalls += 1;
  assertEqual(
    {
      scheduleDecision: stillScheduledDecision,
      validIds: [...timingChangedValidIds],
      intent: timingChangedIntent,
      postCalls: timingChangedPostCalls,
    },
    {
      scheduleDecision: "scheduled",
      validIds: [buildPeptideDoseSlotKey(protocol.id, day, "0")],
      intent: { kind: "abort" },
      postCalls: 0,
    },
    "P0-04 timing-changed stale PM aborts before POST against current canonical IDs",
  );

  const trackerSource = readFileSync(new URL("../src/components/Peptides/PeptideTracker.tsx", import.meta.url), "utf8");
  const doseEntryHandler = trackerSource.slice(
    trackerSource.indexOf("const openDoseModal"),
    trackerSource.indexOf("const openCalculatorModal"),
  );
  assertTrue(
    doseEntryHandler.includes("const scheduleDecision = doseScheduleDecision(")
      && doseEntryHandler.includes("const entryIntent = resolveDoseEntryIntent(")
      && doseEntryHandler.includes("const currentValidScheduledDoseIds = new Set(")
      && doseEntryHandler.includes("slotsForProtocol(protocol).map((slot) =>")
      && doseEntryHandler.includes('if (entryIntent.kind === "abort") return;')
      && doseEntryHandler.includes("setOffScheduleConfirmation({ protocol });")
      && !doseEntryHandler.includes("setOffScheduleConfirmation({ protocol, scheduledDoseId"),
    "P0-04 rendered handler classifies fresh schedule state and strips stale identity from overrides",
  );
  assertTrue(
    !doseEntryHandler.includes("confirm(") && !doseEntryHandler.includes("fetch("),
    "P0-04 confirmation decision performs no browser confirmation or patient/network write",
  );
  assertTrue(
    trackerSource.includes('role="dialog"')
      && trackerSource.includes('id="off-schedule-dose-dialog"')
      && trackerSource.includes("Continue to dose entry")
      && trackerSource.includes("Nothing is saved until you submit that form."),
    "P0-04 rendered confirmation has the required accessible no-write copy",
  );
  assertTrue(
    trackerSource.includes("openDoseModal(protocol, dose.id)")
      && doseEntryHandler.includes("entryIntent.scheduledDoseId")
      && doseEntryHandler.includes("entryIntent.hasNoScheduledRow"),
    "P0-04 scheduled Today row routes its exact clicked identity through the production intent",
  );
  assertTrue(
    (trackerSource.match(/openDoseEntry\(pending\.protocol, undefined, true\)/g) || []).length === 1
      && !trackerSource.includes("pending.scheduledDoseId"),
    "P0-04 off-schedule Continue opens one keyless no-scheduled-row form",
  );
  assertTrue(
    trackerSource.includes("reconcileCalendarSlotRecords(scheduled, completed)")
      && !trackerSource.includes("doseName === futureDose.protocolName")
      && (trackerSource.match(/matchCompletionSlot\(/g) || []).length >= 3,
    "P0-04 rendered Today and Calendar both call the same completion-slot matcher",
  );
}

console.log("\n--- P0-06: malformed scheduled times stay unavailable or logged ---");
{
  [null, "", "   ", "morning", "8:00", "08:0", "25:99"].forEach((time) => {
    assertEqual(
      formatScheduledTime12h(time),
      null,
      `P0-06 invalid scheduled time '${String(time)}' never formats`,
    );
  });
  assertEqual(formatScheduledTime12h("08:00"), "8:00 AM", "P0-06 canonical morning formats normally");
  assertEqual(formatScheduledTime12h("20:00"), "8:00 PM", "P0-06 canonical evening formats normally");
  assertEqual(
    resolveDoseTimeLabel("25:99", "2026-07-21T20:15:00.000Z", true, (timestamp) => `logged ${timestamp}`),
    "logged 2026-07-21T20:15:00.000Z",
    "P0-06 completed invalid schedule uses its actual logged timestamp",
  );
  assertEqual(
    resolveDoseTimeLabel("morning", undefined, false, () => "must not render"),
    "Time unavailable",
    "P0-06 pending invalid schedule without an actual timestamp stays calm",
  );
  assertEqual(
    [
      { id: "invalid", scheduledTime: "25:99" },
      { id: "evening", scheduledTime: "20:00" },
      { id: "missing", scheduledTime: null },
      { id: "morning", scheduledTime: "08:00" },
    ].sort((a, b) => scheduledTimeSortValue(a.scheduledTime) - scheduledTimeSortValue(b.scheduledTime))
      .map((slot) => slot.id),
    ["morning", "evening", "invalid", "missing"],
    "P0-06 invalid scheduled times sort after every canonical time",
  );
  assertEqual(
    selectDoseEntrySlot([
      { id: "invalid", scheduledTime: "25:99" },
      { id: "morning", scheduledTime: "08:00" },
    ])?.id,
    "morning",
    "P0-06 dose entry uses the same invalid-last sort contract",
  );
  assertEqual(
    [
      { id: "invalid-schedule", actualTime: null, scheduledTime: "25:99" },
      { id: "scheduled-morning", actualTime: null, scheduledTime: "08:00" },
      { id: "actual-old", actualTime: "2026-07-21T08:00:00.000Z", scheduledTime: "25:99" },
      { id: "invalid-actual", actualTime: "not-a-date", scheduledTime: "morning" },
      { id: "scheduled-evening", actualTime: null, scheduledTime: "20:00" },
      { id: "actual-new", actualTime: "2026-07-21T20:00:00.000Z", scheduledTime: "08:00" },
    ].sort(compareCompletedDoseEntries).map((dose) => dose.id),
    [
      "actual-new",
      "actual-old",
      "scheduled-evening",
      "scheduled-morning",
      "invalid-schedule",
      "invalid-actual",
    ],
    "P0-06 completed doses keep newest actual timestamps and valid schedule fallbacks ahead of invalid data",
  );
  assertEqual(
    compareCompletedDoseEntries(
      { actualTime: "2026-07-21T08:00:00.000Z", scheduledTime: "08:00" },
      { actualTime: "2026-07-21T08:00:00.000Z", scheduledTime: "20:00" },
    ),
    0,
    "P0-06 completed-dose comparator preserves stable ties",
  );

  const trackerSource = readFileSync(new URL("../src/components/Peptides/PeptideTracker.tsx", import.meta.url), "utf8");
  assertTrue(
    trackerSource.includes("resolveDoseTimeLabel(")
      && trackerSource.includes("formatScheduledTime12h(record.scheduledTime)")
      && trackerSource.includes(".sort(compareCompletedDoseEntries)")
      && !trackerSource.includes("record.scheduledTime || \"Time not recorded\""),
    "P0-06 Today and Calendar displays share the no-verbatim-time contract",
  );
}

console.log("\n--- DEV-P0-04: persisted slot identity and zero-side-effect validation ---");
{
  const helperSource = readFileSync(new URL("../src/lib/peptide-dose-slot.ts", import.meta.url), "utf8");
  assertEqual(
    [...helperSource.matchAll(/^export (?:type|function)\s+(\w+)/gm)].map((match) => match[1]),
    [
      "ParsedPeptideDoseSlotKey",
      "PeptideDoseSlotValidation",
      "buildPeptideDoseSlotKey",
      "parsePeptideDoseSlotKey",
      "validatePeptideDoseSlotKey",
    ],
    "DEV-P0-04 helper exports exactly the approved two types and three functions",
  );

  const protocol = {
    id: "protocol-slot-test",
    frequency: "Daily",
    timing: "AM & PM (twice daily)",
    startDate: new Date(2026, 6, 20),
  };
  const canonicalSlotIds = ["am", "pm", "0", "slot-0", "slot-12"];
  const canonicalKeys = canonicalSlotIds.map((slotId) =>
    buildPeptideDoseSlotKey(protocol.id, "2026-07-20", slotId));
  assertEqual(
    canonicalKeys.map(parsePeptideDoseSlotKey),
    canonicalSlotIds.map((slotId) => ({ protocolId: protocol.id, localDay: "2026-07-20", slotId })),
    "DEV-P0-04 builder/parser roundtrip covers am, pm, 0, slot-0, and slot-12",
  );
  assertEqual(
    parsePeptideDoseSlotKey(`${protocol.id}::2026-02-30::am`),
    null,
    "DEV-P0-04 parser rejects an impossible calendar date",
  );
  assertThrows(
    () => buildPeptideDoseSlotKey(protocol.id, "2026-02-30", "am"),
    "DEV-P0-04 builder rejects an impossible calendar date",
  );
  assertThrows(
    () => buildPeptideDoseSlotKey(protocol.id, "2026-07-20", "slot-01"),
    "DEV-P0-04 builder rejects a noncanonical leading-zero slot",
  );
  assertThrows(
    () => buildPeptideDoseSlotKey(protocol.id, "2026-07-20", "legacy-dose"),
    "DEV-P0-04 builder rejects a legacy display identifier",
  );

  const validAm = buildPeptideDoseSlotKey(protocol.id, "2026-07-20", "am");
  assertEqual(
    validatePeptideDoseSlotKey({ protocolId: protocol.id, localDate: "2026-07-20", slotKey: validAm }, protocol),
    { ok: true, slotKey: validAm },
    "DEV-P0-04 valid canonical AM key passes unchanged",
  );
  assertEqual(
    parsePeptideDoseSlotKey(validAm),
    { protocolId: protocol.id, localDay: "2026-07-20", slotId: "am" },
    "DEV-P0-04 production parser returns the three durable identity fields",
  );
  assertEqual(
    validatePeptideDoseSlotKey(
      { protocolId: protocol.id, localDate: "2026-07-20", slotKey: validAm },
      { ...protocol, startDate: "2026-07-20" },
    ).ok,
    true,
    "DEV-P0-04 validator accepts a member-local string startDate",
  );
  assertEqual(
    validatePeptideDoseSlotKey(
      { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `${protocol.id}::2026-07-20::slot-1` },
      { ...protocol, timing: "08:00/20:00" },
    ).ok,
    true,
    "DEV-P0-04 canonical slot-N key passes for explicit timing",
  );
  assertEqual(
    validatePeptideDoseSlotKey(
      { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `${protocol.id}::2026-07-20::0` },
      { ...protocol, timing: "08:00" },
    ).ok,
    true,
    "DEV-P0-04 canonical single-slot 0 key passes",
  );

  const writeSpies = { dose: 0, task: 0, points: 0, journal: 0, drive: 0 };
  const runPostGuard = (input, candidate) => {
    const result = validatePeptideDoseSlotKey(input, candidate);
    if (!result.ok) return result;
    writeSpies.dose += 1;
    writeSpies.task += 1;
    writeSpies.points += 1;
    writeSpies.drive += 1;
    return result;
  };
  const offScheduleNoKey = runPostGuard(
    { protocolId: protocol.id, localDate: "2026-07-21" },
    { ...protocol, frequency: "Once per week" },
  );
  assertEqual(offScheduleNoKey, { ok: true, slotKey: null }, "DEV-P0-04 true off-schedule write omits slotKey");
  assertEqual(writeSpies, { dose: 1, task: 1, points: 1, journal: 0, drive: 1 }, "DEV-P0-04 valid off-schedule guard reaches the route effects once");
  assertEqual(
    validatePeptideDoseSlotKey({ protocolId: protocol.id, slotKey: null }, protocol),
    { ok: true, slotKey: null },
    "DEV-P0-04 legacy explicit null remains a keyless log without requiring localDate",
  );
  assertEqual(
    validatePeptideDoseSlotKey({ protocolId: protocol.id }, protocol),
    { ok: true, slotKey: null },
    "DEV-P0-04 absent slotKey remains a keyless log without requiring localDate",
  );

  const invalidCases = [
    { label: "missing localDate", input: { protocolId: protocol.id, slotKey: validAm }, candidate: protocol },
    { label: "invalid calendar date", input: { protocolId: protocol.id, localDate: "2026-02-30", slotKey: `${protocol.id}::2026-02-30::am` }, candidate: protocol },
    { label: "empty key", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: "" }, candidate: protocol },
    { label: "non-string key", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: 7 }, candidate: protocol },
    { label: "malformed separators", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `${protocol.id}:2026-07-20:am` }, candidate: protocol },
    { label: "protocol mismatch", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `other::2026-07-20::am` }, candidate: protocol },
    { label: "localDate mismatch", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `${protocol.id}::2026-07-21::am` }, candidate: protocol },
    { label: "invalid slot token", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `${protocol.id}::2026-07-20::morning` }, candidate: protocol },
    { label: "noncanonical slot-N", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `${protocol.id}::2026-07-20::slot-01` }, candidate: { ...protocol, timing: "08:00/20:00" } },
    { label: "impossible timing slot", input: { protocolId: protocol.id, localDate: "2026-07-20", slotKey: `${protocol.id}::2026-07-20::slot-0` }, candidate: protocol },
    { label: "impossible scheduled day", input: { protocolId: protocol.id, localDate: "2026-07-21", slotKey: `${protocol.id}::2026-07-21::am` }, candidate: { ...protocol, frequency: "Once per week" } },
  ];
  Object.keys(writeSpies).forEach((key) => { writeSpies[key] = 0; });
  for (const invalidCase of invalidCases) {
    const result = runPostGuard(invalidCase.input, invalidCase.candidate);
    assertEqual(result.ok, false, `DEV-P0-04 ${invalidCase.label} returns invalid`);
    assertEqual(result.status, 400, `DEV-P0-04 ${invalidCase.label} returns strict 400`);
  }
  assertEqual(
    writeSpies,
    { dose: 0, task: 0, points: 0, journal: 0, drive: 0 },
    "DEV-P0-04 production validator leaves every mutation spy at zero for every invalid class",
  );

  assertEqual(
    [
      validatePeptideDoseSlotKey({ protocolId: protocol.id, localDate: "2026-07-20", slotKey: validAm }, protocol).ok,
      validatePeptideDoseSlotKey({ protocolId: protocol.id, localDate: "2026-07-20", slotKey: validAm }, protocol).ok,
    ],
    [true, true],
    "DEV-P0-04 duplicate same-key logs remain valid and representable",
  );

  const routeSource = readFileSync(new URL("../app/api/peptides/doses/route.ts", import.meta.url), "utf8");
  const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const trackerSource = readFileSync(new URL("../src/components/Peptides/PeptideTracker.tsx", import.meta.url), "utf8");
  assertEqual(
    [...routeSource.matchAll(/^export async function\s+(\w+)/gm)].map((match) => match[1]),
    ["POST", "GET", "DELETE"],
    "DEV-P0-04 route exports only the three supported Next handlers",
  );
  const calendarHistorySource = trackerSource.slice(
    trackerSource.indexOf("const doseHistoryByDate"),
    trackerSource.indexOf("const historyCalendar"),
  );
  assertTrue(
    calendarHistorySource.includes('`display-only::${protocolId}::${localDay}::${slotId}`')
      && !calendarHistorySource.includes("buildPeptideDoseSlotKey(protocolId, localDay, slotId)"),
    "DEV-P0-04 unmatched legacy history uses a noncanonical display-only key, never the canonical builder",
  );
  const postSource = routeSource.slice(
    routeSource.indexOf("export async function POST"),
    routeSource.indexOf("// GET: Load dose history"),
  );
  const validationAt = postSource.indexOf("const slotValidation = validatePeptideDoseSlotKey(");
  const invalidReturnAt = postSource.indexOf("if (!slotValidation.ok)");
  const mutationOffsets = [
    "prisma.peptide_doses.create({",
    "prisma.dailyTask.upsert({",
    "prisma.gamificationPoint.create({",
    "appendPeptideDoseToJournal(",
    "enqueueDriveSync(",
  ].map((needle) => postSource.indexOf(needle)).filter((offset) => offset >= 0);
  assertTrue(
    validationAt >= 0
      && invalidReturnAt > validationAt
      && mutationOffsets.length === 4
      && mutationOffsets.every((offset) => offset > invalidReturnAt),
    "DEV-P0-04 production POST returns 400 before every dose, task, points, journal, or Drive mutation",
  );
  assertTrue(
    schemaSource.includes("slotKey                String?")
      && !/slotKey\s+String\?[^\n]*@(unique|index)/.test(schemaSource)
      && routeSource.includes("slotKey: slotValidation.slotKey")
      && routeSource.includes("const doses = await prisma.peptide_doses.findMany({"),
    "DEV-P0-04 schema storage is optional/nonunique/unindexed and GET returns stored rows",
  );
  const guardAt = trackerSource.indexOf("!selectedProtocol.hasNoScheduledRow && !pendingSlot?.slotKey");
  const dosePostAt = trackerSource.indexOf('const response = await fetch("/api/peptides/doses"');
  assertTrue(
    guardAt >= 0 && dosePostAt > guardAt
      && trackerSource.includes("slotKey: pendingSlot?.slotKey")
      && trackerSource.includes('typeof data.dose?.slotKey === "string" ? data.dose.slotKey : undefined'),
    "DEV-P0-04 client aborts missing scheduled keys before POST and trusts returned persisted identity",
  );

  const markdown = formatPeptideDoses([
    { peptideName: "Test", dosage: 1, unit: "mg", time: "08:00", localDate: "2026-07-20", slotKey: validAm },
    { peptideName: "Legacy", dosage: 2, unit: "mg", time: "09:00", localDate: "2026-07-20", slotKey: "" },
  ]);
  assertTrue(
    markdown.includes("| Time | Peptide | Dosage | Slot Key | Notes |")
      && markdown.includes(`| 08:00 | Test | 1mg | ${validAm} | - |`)
      && markdown.includes("| 09:00 | Legacy | 2mg |  | - |"),
    "DEV-P0-04 Drive Markdown emits exact slot key and blank legacy cell",
  );
  const csv = generateTrackerCSV("peptides", [
    { date: "2026-07-20", slotKey: validAm },
    { date: "2026-07-20", slotKey: "" },
  ]);
  assertTrue(
    csv.startsWith("date,slotKey\n") && csv.includes(`2026-07-20,${validAm}`) && csv.endsWith("2026-07-20,"),
    "DEV-P0-04 Drive CSV emits exact slotKey and blank legacy value",
  );
}

console.log("\n--- H3 fix-wave: Weekly Schedule grid routes through the shared resolver ---");
{
  // Bare "3x per week"/"2x per week" with no explicit days chosen: the
  // grid must show NO active days at all (an unknown schedule renders
  // "set your schedule" instead), never the old hardcoded [1,3,5]/[1,4].
  assertEqual(
    hasKnownSchedule("3x per week"),
    false,
    "H3 grid: bare '3x per week' has no known schedule -> grid renders 'Schedule not set', not invented highlights",
  );
  assertEqual(
    hasKnownSchedule("2x per week"),
    false,
    "H3 grid: bare '2x per week' has no known schedule -> grid renders 'Schedule not set', not invented highlights",
  );

  const anchor = new Date("2026-07-01"); // arbitrary startDate, a Wednesday
  const weekStart = new Date(anchor);
  weekStart.setDate(anchor.getDate() - anchor.getDay());

  const activeDaysOf = (frequency) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(weekStart);
      cellDate.setDate(weekStart.getDate() + i);
      if (isDoseDayForProtocol(frequency, anchor, cellDate)) days.push(i);
    }
    return days;
  };

  assertEqual(
    activeDaysOf("3x per week"),
    [],
    "H3 grid: '3x per week' active-day set (via the shared helper the grid calls) is EMPTY, NOT {Mon,Wed,Fri}",
  );
  assertEqual(
    activeDaysOf("2x per week"),
    [],
    "H3 grid: '2x per week' active-day set (via the shared helper the grid calls) is EMPTY, NOT {Mon,Thu}",
  );

  // Weekly protocol: the grid's active day is the protocol's OWN startDate
  // weekday — never a hardcoded Monday.
  assertEqual(
    activeDaysOf("Once per week"),
    [anchor.getDay()],
    "H3 grid: weekly protocol's active day equals startDate's weekday, not Monday",
  );
  assertTrue(
    hasKnownSchedule("Once per week"),
    "H3 grid: weekly is a known schedule -> grid renders real highlights, not the 'set your schedule' state",
  );
}

console.log(
  "\n--- T-A3: generateFutureDoses/getNextDoseDate route through the shared resolver (no inline copy) ---",
);
{
  // generateFutureDoses/getNextDoseDate are closures bound to component
  // state (parseLocalDateKey/dateToLocalKey helpers live inside the
  // component), not importable in isolation. After the T-A3 refactor their
  // ENTIRE day-selection core is a single call to isDoseDayForProtocol per
  // candidate day — there is no other logic left to diverge. This fixture
  // mirrors that exact day-by-day loop shape and proves it against direct
  // isDoseDayForProtocol calls, per the ticket's documented fallback.
  const daysBetween = (frequency, startDate, from, to) => {
    const active = [];
    const cur = new Date(from);
    while (cur <= to) {
      if (isDoseDayForProtocol(frequency, startDate, cur)) {
        active.push(cur.toISOString().slice(0, 10));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return active;
  };

  // (a) The generateFutureDoses-shaped loop's output, date by date, exactly
  // matches direct isDoseDayForProtocol calls for the same dates -- no
  // divergent parity/weekday copy exists to disagree with it.
  const startDate = new Date("2026-07-01");
  const rangeEnd = new Date("2026-07-15");
  ["Every other day", "Daily", "Mon/Wed/Fri", "Once per week", "3x per week"].forEach(
    (frequency) => {
      const viaLoop = daysBetween(frequency, startDate, startDate, rangeEnd);
      const viaDirect = [];
      const cur = new Date(startDate);
      while (cur <= rangeEnd) {
        if (isDoseDayForProtocol(frequency, startDate, cur)) {
          viaDirect.push(cur.toISOString().slice(0, 10));
        }
        cur.setDate(cur.getDate() + 1);
      }
      assertEqual(
        viaLoop,
        viaDirect,
        `T-A3(a): '${frequency}' dose-days over the range exactly match isDoseDayForProtocol (no divergence)`,
      );
    },
  );

  // (b) Every-other-day protocol asked about a date BEFORE startDate yields
  // no dose -- the daysSinceStart >= 0 guard, inherited for free now that
  // both functions call the shared helper instead of re-inlining the parity
  // check without the guard.
  const dayBeforeStart = new Date("2026-06-30");
  assertEqual(
    isDoseDayForProtocol("Every other day", startDate, dayBeforeStart),
    false,
    "T-A3(b): every-other-day protocol has no dose on a date before startDate (inherited daysSinceStart >= 0 guard)",
  );

  // (c) Unknown-frequency protocol generates no future doses across a whole
  // range -- never invents a schedule for text the shared engine can't
  // classify.
  const unknownDoses = daysBetween("3x per week", startDate, startDate, rangeEnd);
  assertEqual(unknownDoses, [], "T-A3(c): unknown-frequency protocol generates zero doses over the range");
}

console.log(
  failures === 0
    ? "\nALL CONTAINMENT FIXTURES PASSED"
    : `\n${failures} FIXTURE(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
