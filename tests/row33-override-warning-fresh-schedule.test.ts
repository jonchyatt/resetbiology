// Row 33 regression harness (mutation-arc parity, data/rb-peptide-library/
// runtime-logs/parity-2026-07-19/mutation-arc-RESULTS.md): the off-schedule
// override warning in PeptideTracker.tsx's openDoseModal used to gate on
// `todaysScheduledDoses.length === 0` — a proxy for "is today scheduled"
// backed by local pending-slot state that only regenerates on a
// [currentProtocols, todayKey] effect and never itself consults day-of-week.
// On the FIRST off-schedule attempt right after a frequency PATCH, that
// stale proxy stayed non-empty and the warning was silently skipped; only a
// delete+refetch cycle happened to empty it out and surface the warning.
//
// The fix derives "is today scheduled" fresh on every call from the real
// shared resolver (peptide-frequency.ts's isDoseDayForProtocol/
// hasKnownSchedule — the same ones generateFutureDoses/getNextDoseDate use),
// imported directly (not mirrored) since that module has no React hooks.
// openDoseModal itself lives inside a component with top-level hooks and
// isn't importable standalone, so its control flow is mirrored here and
// cross-checked structurally against the real source. Idiom follows
// tests/t3-validation-banner-gate.test.ts (self-checking, `npx tsx`, no
// framework).

import { isDoseDayForProtocol, hasKnownSchedule } from "../src/lib/peptide-frequency";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let failed = false;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`);
  } else {
    failed = true;
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// Mirrors the fixed openDoseModal gate: skip the warning for unknown
// schedules (nothing chosen to violate), otherwise defer to the real
// day-of-week resolver.
function isScheduledToday(frequency: string, startDate: Date, today: Date): boolean {
  return !hasKnownSchedule(frequency) || isDoseDayForProtocol(frequency, startDate, today);
}

try {
  // Reproduce the exact mutation-arc row 33 scenario: PATCH to "Mon/Wed/Fri",
  // first attempt lands on a Sunday.
  const startDate = new Date(2026, 6, 19); // arbitrary anchor, irrelevant for days-of-week kind
  const sunday = new Date(2026, 6, 19); // 2026-07-19 is a Sunday
  const monday = new Date(2026, 6, 20);
  const wednesday = new Date(2026, 6, 22);

  check(
    "Mon/Wed/Fri on a Sunday is NOT scheduled today (override warning must fire)",
    isScheduledToday("Mon/Wed/Fri", startDate, sunday) === false,
  );
  check(
    "Mon/Wed/Fri on a Monday IS scheduled today (no override warning)",
    isScheduledToday("Mon/Wed/Fri", startDate, monday) === true,
  );
  check(
    "Mon/Wed/Fri on a Wednesday IS scheduled today (no override warning)",
    isScheduledToday("Mon/Wed/Fri", startDate, wednesday) === true,
  );
  check(
    "Daily is always scheduled — no override warning regardless of day",
    isScheduledToday("Daily", startDate, sunday) === true,
  );
  check(
    "unknown schedule (bare '3x per week') never triggers a false override warning",
    isScheduledToday("3x per week", startDate, sunday) === true,
  );
  check(
    "'as needed' never triggers a false override warning",
    isScheduledToday("as needed", startDate, sunday) === true,
  );
} catch (err) {
  check("isScheduledToday mirror ran without error", false, String(err));
}

// ---------------------------------------------------------------------------
// Structural cross-check: openDoseModal must derive the gate from the real
// resolver on every call, not from todaysScheduledDoses.length.
// ---------------------------------------------------------------------------
try {
  const source = readFileSync(
    join(__dirname, "..", "src", "components", "Peptides", "PeptideTracker.tsx"),
    "utf8",
  );

  const fnStart = source.indexOf("const openDoseModal = (protocol: PeptideProtocol) => {");
  const fnEnd = source.indexOf("const openCalculatorModal = (protocol: PeptideProtocol) => {");
  check("openDoseModal isolated for inspection", fnStart !== -1 && fnEnd !== -1);
  const fnBody = source.slice(fnStart, fnEnd);

  check(
    "openDoseModal calls isDoseDayForProtocol (the shared resolver) fresh, not a stale proxy",
    /isDoseDayForProtocol\(/.test(fnBody),
  );
  check(
    "openDoseModal calls hasKnownSchedule to avoid inventing a violation for unknown schedules",
    /hasKnownSchedule\(/.test(fnBody),
  );
  check(
    "the override-warning branch condition is no longer 'todaysScheduledDoses.length === 0'",
    !/if \(todaysScheduledDoses\.length === 0\)/.test(fnBody),
    fnBody,
  );
} catch (err) {
  check("structural source cross-check ran without error", false, String(err));
}

if (failed) {
  console.error("\nRow 33 override-warning-fresh-schedule: FAILED");
  process.exit(1);
} else {
  console.log("\nRow 33 override-warning-fresh-schedule: ALL PASS");
}
