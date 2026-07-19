// T1 time contract regression harness — data/rb-peptide-library/runtime-logs/t1-time-contract-9c73.md
//
// formatTime12h and the scheduled-vs-logged derivation live as closures
// inside src/components/Peptides/PeptideTracker.tsx (a React component with
// top-level hooks, not importable standalone by a plain node script). This
// harness mirrors those exact formulas — keep them in sync by hand if either
// one changes; a drift makes this test the tripwire. Idiom follows
// tests/local-day.test.ts (self-checking, `npx tsx`, no framework).

let failed = false;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`);
  } else {
    failed = true;
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// Mirrors PeptideTracker.tsx formatTime12h (T1 R3): TOTAL — only a
// canonical 24h "HH:MM" formats; anything else (legacy "05:08 AM"-style
// rows, garbage) returns unchanged.
function formatTime12h(time: string): string {
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

// --- R3: formatTime12h totality ---
check("08:00 -> 8:00 AM (24h input)", formatTime12h("08:00") === "8:00 AM", formatTime12h("08:00"));
check("20:00 -> 8:00 PM (24h input)", formatTime12h("20:00") === "8:00 PM", formatTime12h("20:00"));
check("00:00 -> 12:00 AM (midnight)", formatTime12h("00:00") === "12:00 AM", formatTime12h("00:00"));
check("12:00 -> 12:00 PM (noon)", formatTime12h("12:00") === "12:00 PM", formatTime12h("12:00"));
check("9:05 -> 9:05 AM (no leading zero on hour)", formatTime12h("9:05") === "9:05 AM", formatTime12h("9:05"));
check("23:59 -> 11:59 PM (upper bound)", formatTime12h("23:59") === "11:59 PM", formatTime12h("23:59"));

check('legacy "05:08 AM" returned unchanged', formatTime12h("05:08 AM") === "05:08 AM", formatTime12h("05:08 AM"));
check('legacy "5:08 PM" returned unchanged', formatTime12h("5:08 PM") === "5:08 PM", formatTime12h("5:08 PM"));
check('garbage "" returned unchanged', formatTime12h("") === "", JSON.stringify(formatTime12h("")));
check('garbage "not-a-time" returned unchanged', formatTime12h("not-a-time") === "not-a-time", formatTime12h("not-a-time"));
check('out-of-range hour "24:00" returned unchanged', formatTime12h("24:00") === "24:00", formatTime12h("24:00"));
check('out-of-range minute "08:60" returned unchanged', formatTime12h("08:60") === "08:60", formatTime12h("08:60"));
check(
  "the original bug never reproduces: no output contains NaN",
  !formatTime12h("05:08 AM").includes("NaN") && !formatTime12h("garbage").includes("NaN"),
);

// Mirrors the `loggedTime24h` construction in logDose() (T1 R4): canonical
// 24h "HH:MM" derived client-side from the log moment.
function canonicalLogTime(now: Date): string {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// --- R4: canonical-time derivation ---
check("08:00:00 -> 08:00", canonicalLogTime(new Date(2026, 0, 1, 8, 0, 0)) === "08:00", canonicalLogTime(new Date(2026, 0, 1, 8, 0, 0)));
check("17:05:30 -> 17:05", canonicalLogTime(new Date(2026, 0, 1, 17, 5, 30)) === "17:05", canonicalLogTime(new Date(2026, 0, 1, 17, 5, 30)));
check("00:03:00 -> 00:03 (midnight hour zero-padded)", canonicalLogTime(new Date(2026, 0, 1, 0, 3, 0)) === "00:03", canonicalLogTime(new Date(2026, 0, 1, 0, 3, 0)));
check(
  "canonical log time always matches formatTime12h's accepted pattern (round-trips cleanly)",
  /^([01]?\d|2[0-3]):[0-5]\d$/.test(canonicalLogTime(new Date())),
);

// Mirrors the `scheduledTime` derivation in logDose() (T1 R1): the row a
// log satisfies keeps the protocol's OWN slot time, never the log moment.
function deriveScheduledTime(
  pendingSlotTime: string | undefined,
  protocolFirstSlotTime: string,
  loggedTime24h: string,
): string {
  return pendingSlotTime ?? protocolFirstSlotTime ?? loggedTime24h;
}

// --- R1: scheduled-vs-logged split ---
check(
  "08:00-scheduled dose logged at 05:08 still shows 08:00 (the reported bug)",
  deriveScheduledTime("08:00", "08:00", "05:08") === "08:00",
);
check(
  "scheduled time is never overwritten by the logged moment",
  deriveScheduledTime("08:00", "08:00", "17:42") !== "17:42",
);
check(
  "unscheduled-override path (no pending row id) falls back to the protocol's own slot, not the clock",
  deriveScheduledTime(undefined, "12:00", "17:42") === "12:00",
);
check(
  "formatTime12h renders the derived scheduled time as 8:00 AM, not 5:00 AM",
  formatTime12h(deriveScheduledTime("08:00", "08:00", "05:08")) === "8:00 AM",
);

if (failed) {
  process.exitCode = 1;
  console.error("\nOne or more T1 time-contract scenarios failed.");
} else {
  console.log("\nAll T1 time-contract scenarios passed.");
}
