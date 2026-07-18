/**
 * Shared frequency resolver — single source of truth for "which calendar
 * days does this protocol fire on" (T-A2 safety containment, H2/H3).
 *
 * Before this file, three separate parsers (PeptideTracker.tsx's
 * generateFutureDoses + getNextDoseDate, scheduleNotifications.ts's
 * shouldScheduleOnDate) each hand-rolled their own frequency-text matching,
 * disagreed on which phrases they recognized, and — critically — silently
 * defaulted UNRECOGNIZED frequency text to "daily" (MRI F8.1) or invented
 * Mon/Wed/Fri / Mon/Thu day patterns for "Nx per week" text that was never
 * actually chosen by the member (MRI F8.1 sibling). DosageCalculator's
 * custom-day picker writes real day-list frequency strings (e.g.
 * "Mon/Wed/Fri") that none of the three legacy parsers understood at all,
 * so those fell through to the same "default to daily" bug.
 *
 * `resolveFrequency` is intentionally minimal: it classifies a frequency
 * string into one of five kinds and — for 'unknown' — refuses to guess.
 * Callers are responsible for the "every other day" alternating-parity rule
 * (unaffected by this bug, already anchors correctly to startDate) and for
 * anchoring 'weekly' results to the protocol's own startDate weekday
 * (H3 — never hardcode Monday).
 *
 * CONTAINMENT SCOPE: this replaces the divergent inline day-of-week
 * detection in the three call sites. It is not a scheduling rewrite.
 */

export type FrequencyKind =
  | "daily"
  | "weekly"
  | "twice-daily"
  | "days-of-week"
  | "unknown";

export interface FrequencyResolution {
  kind: FrequencyKind;
  /** 0=Sun..6=Sat. Present only for kind 'days-of-week'. */
  daysOfWeek?: number[];
  /** Present only for kind 'twice-daily'. */
  timesPerDay?: number;
}

const DAY_TOKENS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DAY_TOKEN_RE = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/g;

export function resolveFrequency(text: string): FrequencyResolution {
  const lower = (text || "").trim().toLowerCase();

  if (!lower) return { kind: "unknown" };

  // Twice-daily / "AM & PM" — checked first so "AM & PM (twice daily)"
  // doesn't fall into the plain daily bucket below.
  if (lower.includes("twice") || (lower.includes("am") && lower.includes("pm"))) {
    return { kind: "twice-daily", timesPerDay: 2 };
  }

  // "once per week" / "once a week" / "weekly" — anchors to startDate
  // weekday in the caller (H3), never a hardcoded Monday.
  if (/\bonce\s*(per|a)\s*week\b/.test(lower) || lower.includes("weekly")) {
    return { kind: "weekly" };
  }

  if (lower.includes("daily") || lower.includes("every day")) {
    return { kind: "daily" };
  }

  // "Mon-Fri" / legacy "5 days on" phrasing — explicit weekday range.
  if (lower.includes("mon-fri") || lower.includes("5 days on")) {
    return { kind: "days-of-week", daysOfWeek: [1, 2, 3, 4, 5] };
  }

  // Explicit day-name list written by DosageCalculator's custom-day picker,
  // e.g. "Mon/Wed/Fri" or "Mon, Thu". Parsed directly from the named days —
  // never inferred from an "Nx per week" count (that would be inventing a
  // schedule the member never chose; see the 'unknown' fallback below).
  const dayMatches = [...lower.matchAll(DAY_TOKEN_RE)].map((m) => DAY_TOKENS[m[1]]);
  if (dayMatches.length > 0) {
    return { kind: "days-of-week", daysOfWeek: [...new Set(dayMatches)].sort((a, b) => a - b) };
  }

  // Includes bare "Nx per week" / "3x/week" text with no explicit days
  // chosen, and any genuinely unparseable string. Both cases refuse to
  // invent a schedule — the caller must suppress reminders and surface an
  // explicit "set your schedule" prompt to the member instead (H2/H3).
  return { kind: "unknown" };
}

/**
 * Single source of truth for "is a dose scheduled on this calendar date",
 * shared by the reminder scheduler (scheduleNotifications.ts) and the
 * Weekly Schedule display grid (PeptideTracker.tsx) so they can never
 * disagree again (H3). Both callers already resolve `startDate` to a Date
 * their own (correct) way before calling this — kept a pure primitive
 * rather than accepting raw protocol/string shapes.
 */
export function isDoseDayForProtocol(
  frequency: string,
  startDate: Date,
  date: Date,
): boolean {
  const lower = (frequency || "").trim().toLowerCase();

  // "Every other day" is an alternating-parity rule, not a day-of-week
  // rule — it anchors directly to startDate and stays outside the kinds
  // resolveFrequency classifies.
  if (lower.includes("every other day")) {
    const daysSinceStart = Math.floor(
      (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSinceStart >= 0 && daysSinceStart % 2 === 0;
  }

  const resolved = resolveFrequency(frequency);
  const dayOfWeek = date.getDay();

  switch (resolved.kind) {
    case "daily":
    case "twice-daily":
      return true;
    case "weekly":
      // H3: anchors to the protocol's OWN startDate weekday, never a
      // hardcoded Monday.
      return dayOfWeek === startDate.getDay();
    case "days-of-week":
      return (resolved.daysOfWeek ?? []).includes(dayOfWeek);
    case "unknown":
    default:
      // H2/H3: an unrecognized frequency schedules NOTHING — never
      // invents Mon/Wed/Fri, Mon/Thu, or an index-parity pattern.
      return false;
  }
}

/**
 * True when `frequency` resolves to a concrete, known schedule — either a
 * resolveFrequency kind other than 'unknown', or the special-cased "every
 * other day" alternation. False means the display layer must show a
 * "schedule not set" state instead of inventing active days (H3).
 */
export function hasKnownSchedule(frequency: string): boolean {
  const lower = (frequency || "").trim().toLowerCase();
  return lower.includes("every other day") || resolveFrequency(frequency).kind !== "unknown";
}

/**
 * Parse dose times out of a protocol's timing string. Moved here (from
 * scheduleNotifications.ts, which is server-only via its `prisma` import)
 * so the client-side Weekly Schedule grid can reuse the exact same parse
 * instead of hardcoding "8:00 AM" — scheduleNotifications.ts re-exports
 * this for backward compatibility.
 * Examples: "08:00", "08:00/20:00", "Daily 08:00", "AM & PM (twice daily)".
 */
export function parseDoseTimes(text: string): string[] {
  const times: string[] = [];

  const timeRegex = /\b(\d{1,2}):(\d{2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = timeRegex.exec(text)) !== null) {
    const hours = match[1].padStart(2, "0");
    const minutes = match[2];
    times.push(`${hours}:${minutes}`);
  }

  if (times.length === 0) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes("twice") || (lowerText.includes("am") && lowerText.includes("pm"))) {
      times.push("08:00", "20:00");
    } else if (lowerText.includes("am") || lowerText.includes("morning")) {
      times.push("08:00");
    } else if (lowerText.includes("pm") || lowerText.includes("evening")) {
      times.push("20:00");
    } else if (lowerText.includes("daily") || lowerText.includes("once")) {
      times.push("12:00");
    }
  }

  return [...new Set(times)];
}

// ---------------------------------------------------------------------------
// Self-test — run directly with `npx tsx src/lib/peptide-frequency.ts`.
// ---------------------------------------------------------------------------
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`FAIL ${label}: expected ${e}, got ${a}`);
  }
  console.log(`PASS ${label}`);
}

export function runSelfTest() {
  assertEqual(resolveFrequency("Daily"), { kind: "daily" }, "daily");
  assertEqual(
    resolveFrequency("AM & PM (twice daily)"),
    { kind: "twice-daily", timesPerDay: 2 },
    "twice daily / AM & PM",
  );
  assertEqual(resolveFrequency("Once per week"), { kind: "weekly" }, "weekly");
  assertEqual(
    resolveFrequency("Mon-Fri"),
    { kind: "days-of-week", daysOfWeek: [1, 2, 3, 4, 5] },
    "Mon-Fri",
  );
  assertEqual(resolveFrequency("3x/week"), { kind: "unknown" }, "3x/week (no explicit days — unknown, not invented)");
  assertEqual(resolveFrequency("qwerty"), { kind: "unknown" }, "unrecognized garbage");
  assertEqual(
    resolveFrequency("Mon/Wed/Fri"),
    { kind: "days-of-week", daysOfWeek: [1, 3, 5] },
    "explicit day list from custom picker",
  );

  // H3: shared (frequency, startDate, date) -> active-day primitive used by
  // both the reminder scheduler and the display grid.
  const aSunday = new Date(2026, 6, 19); // 2026-07-19 is a Sunday
  const aMonday = new Date(2026, 6, 20);
  assertEqual(
    isDoseDayForProtocol("3x per week", aSunday, aMonday),
    false,
    "3x/week with no explicit days never invents an active day",
  );
  assertEqual(
    isDoseDayForProtocol("2x per week", aSunday, aMonday),
    false,
    "2x/week with no explicit days never invents an active day",
  );
  assertEqual(
    isDoseDayForProtocol("Once per week", aSunday, aSunday),
    true,
    "weekly is active on the protocol's own startDate weekday",
  );
  assertEqual(
    isDoseDayForProtocol("Once per week", aSunday, aMonday),
    false,
    "weekly is NOT active on a non-anchor weekday (never hardcoded Monday)",
  );
  assertEqual(hasKnownSchedule("3x per week"), false, "bare 3x/week has no known schedule");
  assertEqual(hasKnownSchedule("Every other day"), true, "every-other-day is a known schedule");
  assertEqual(hasKnownSchedule("Daily"), true, "daily is a known schedule");

  console.log("peptide-frequency self-test: all assertions passed");
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop() || "\0");

if (isDirectRun) {
  runSelfTest();
}
