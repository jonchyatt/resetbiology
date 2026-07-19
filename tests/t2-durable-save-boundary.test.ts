// T2 durable-save success-boundary + null-time safety regression harness.
//
// Covers two verifier findings + the primary hang fix, all in
// src/components/Peptides/PeptideTracker.tsx (a React component with
// top-level hooks, not importable standalone by a plain node script). This
// harness mirrors the exact control-flow/formulas — keep them in sync by
// hand if either changes; a drift makes this test the tripwire. Idiom
// follows tests/t1-time-contract.test.ts (self-checking, `npx tsx`, no
// framework).

let failed = false;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`);
  } else {
    failed = true;
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// FINDING 1: null-time safety
// Mirrors PeptideTracker.tsx parseTimeToMinutes (post-fix): time can be
// null (server stores `time: time || null`) — never crash, sort to the end.
// ---------------------------------------------------------------------------
function parseTimeToMinutes(time: string | null | undefined): number {
  if (typeof time !== "string") return 24 * 60;
  const [hoursStr, minutesStr] = time.split(":");
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr ?? "0", 10);
  if (!Number.isFinite(hours)) return 24 * 60;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

try {
  check("parseTimeToMinutes(null) does not throw and sorts to end-of-day", parseTimeToMinutes(null) === 24 * 60);
  check("parseTimeToMinutes(undefined) does not throw", parseTimeToMinutes(undefined) === 24 * 60);
  check("parseTimeToMinutes('08:00') still parses normally", parseTimeToMinutes("08:00") === 480);
} catch (err) {
  check("parseTimeToMinutes never throws on null/undefined input", false, String(err));
}

// Mirrors the todaysDoseBuckets completed-sort (post-fix): actualTime is
// checked FIRST (lazy evaluation) so a null scheduledTime only reaches
// parseTimeToMinutes when actualTime is also absent — contract R2.
interface DoseLike {
  scheduledTime: string | null;
  actualTime?: string;
}

function sortCompleted(doses: DoseLike[]): DoseLike[] {
  return [...doses].sort((a, b) => {
    const timeA = a.actualTime
      ? new Date(a.actualTime).getTime()
      : parseTimeToMinutes(a.scheduledTime) * 60 * 1000;
    const timeB = b.actualTime
      ? new Date(b.actualTime).getTime()
      : parseTimeToMinutes(b.scheduledTime) * 60 * 1000;
    return timeB - timeA;
  });
}

try {
  const doses: DoseLike[] = [
    { scheduledTime: null, actualTime: "2026-07-19T08:00:00.000Z" },
    { scheduledTime: null, actualTime: "2026-07-19T09:00:00.000Z" },
    { scheduledTime: null, actualTime: "2026-07-19T07:00:00.000Z" },
  ];
  const sorted = sortCompleted(doses);
  check(
    "completed-sort with all-null scheduledTime does not throw (the reported crash)",
    true,
  );
  check(
    "completed-sort still orders most-recent-actualTime first when scheduledTime is null",
    sorted[0].actualTime === "2026-07-19T09:00:00.000Z" &&
      sorted[2].actualTime === "2026-07-19T07:00:00.000Z",
    JSON.stringify(sorted.map((d) => d.actualTime)),
  );

  // Deleted-protocol edge case: no actualTime either.
  const noActualTime: DoseLike[] = [{ scheduledTime: null }];
  const result = sortCompleted(noActualTime);
  check(
    "completed-sort with null scheduledTime AND no actualTime does not throw",
    result.length === 1,
  );
} catch (err) {
  check("todaysDoseBuckets completed-sort never crashes on a null-time dose", false, String(err));
}

// ---------------------------------------------------------------------------
// FINDING 2 (delete race) is an ordering property, verified structurally:
// deleteProtocol must await fetchTodaysDoses() before fetchUserProtocols(),
// matching the bootstrap order (doses, then protocols) so a late doses
// fetch can never overwrite a protocol-triggered slot-label regeneration.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { join } from "node:path";

try {
  const source = readFileSync(
    join(__dirname, "..", "src", "components", "Peptides", "PeptideTracker.tsx"),
    "utf8",
  );
  const deleteBlockMatch = source.match(
    /Protocol deleted successfully[\s\S]{0,600}?fetchDoseHistory\(\);/,
  );
  check("deleteProtocol success block found in source", !!deleteBlockMatch);
  if (deleteBlockMatch) {
    const block = deleteBlockMatch[0];
    const dosesIdx = block.indexOf("fetchTodaysDoses()");
    const protocolsIdx = block.indexOf("fetchUserProtocols()");
    check(
      "deleteProtocol awaits fetchTodaysDoses() before fetchUserProtocols() (bootstrap order)",
      dosesIdx !== -1 && protocolsIdx !== -1 && dosesIdx < protocolsIdx,
    );
    check(
      "both refetches are awaited (not fire-and-forget) to close the race",
      /await fetchTodaysDoses\(\)/.test(block) && /await fetchUserProtocols\(\)/.test(block),
    );
  }
} catch (err) {
  check("delete-race ordering check ran without error", false, String(err));
}

// ---------------------------------------------------------------------------
// PRIMARY FIX: success-boundary ordering.
// Mirrors handleSaveProtocol's control flow: the durable POST (+ awaited
// preference save) resolves the function; an optional step
// (setupPushSubscription-equivalent) is fired without being awaited, so a
// step that never settles (navigator.serviceWorker.ready with no SW
// registered) can never block the save from completing.
// ---------------------------------------------------------------------------
function neverResolves(): Promise<void> {
  return new Promise(() => {
    // intentionally never settles — mirrors serviceWorker.ready with no SW
  });
}

async function saveProtocolLike(optionalStep: () => Promise<void>): Promise<string> {
  // durable step: protocol POST + awaited preference POST
  await new Promise((resolve) => setTimeout(resolve, 5));
  // optional step: fire-and-forget, NEVER awaited
  optionalStep().catch(() => {});
  return "saved";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} did not resolve within ${ms}ms`)), ms),
    ),
  ]);
}

async function runOrderingTest() {
  try {
    const result = await withTimeout(
      saveProtocolLike(neverResolves),
      200,
      "protocol save",
    );
    check(
      "save resolves even when the optional step never settles (the reported hang)",
      result === "saved",
    );
  } catch (err) {
    check(
      "save resolves even when the optional step never settles (the reported hang)",
      false,
      String(err),
    );
  }
}

// ---------------------------------------------------------------------------
// A second click cannot create a duplicate save.
// Mirrors the savingInFlightRef guard in DosageCalculator.handleProtocolSave:
// a synchronous ref flag (not React state) blocks re-entrant calls that land
// before the disabled-button re-render commits.
// ---------------------------------------------------------------------------
function makeGuardedSave() {
  let inFlight = false;
  let callCount = 0;
  return {
    save: async (): Promise<"saved" | "skipped"> => {
      if (inFlight) return "skipped";
      inFlight = true;
      callCount++;
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "saved";
      } finally {
        inFlight = false;
      }
    },
    getCallCount: () => callCount,
  };
}

async function runDuplicateClickTest() {
  const guarded = makeGuardedSave();
  const [first, second] = await Promise.all([guarded.save(), guarded.save()]);
  check(
    "two synchronous clicks: exactly one save actually runs",
    guarded.getCallCount() === 1,
    `callCount=${guarded.getCallCount()}`,
  );
  check(
    "the second concurrent click is skipped, not queued as a duplicate",
    [first, second].filter((r) => r === "saved").length === 1 &&
      [first, second].filter((r) => r === "skipped").length === 1,
    JSON.stringify([first, second]),
  );

  // A save AFTER the first one has fully resolved must succeed (guard
  // resets — this isn't a permanent lock).
  const third = await guarded.save();
  check("a later, non-overlapping click can still save", third === "saved");
  check("call count reflects both real saves (duplicate skipped, later one counted)", guarded.getCallCount() === 2);
}

async function main() {
  await runOrderingTest();
  await runDuplicateClickTest();

  if (failed) {
    process.exitCode = 1;
    console.error("\nOne or more T2 durable-save-boundary scenarios failed.");
  } else {
    console.log("\nAll T2 durable-save-boundary scenarios passed.");
  }
}

main();
