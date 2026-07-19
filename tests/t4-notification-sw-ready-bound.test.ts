// T4: bounded service-worker-ready wait, same hang class as T2's
// setupPushSubscription fix in PeptideTracker.tsx.
//
// navigator.serviceWorker.ready never settles when no service worker is
// registered for the current scope. Originally both
// NotificationPreferences.tsx and PushUnavailableWarning.tsx `await`ed it
// directly on a user-triggered path, which froze the button's loading state
// forever. Master's bba8d99e refactor (−94 lines) routed
// NotificationPreferences' push flow through the new shared helper
// src/lib/pushSubscribe.ts — which reintroduced the same unbounded await.
// The bound now lives in that shared helper (fixes every consumer:
// NotificationPreferences, the vision reminders card, and future callers).
// PushUnavailableWarning.tsx keeps its own local waitForServiceWorkerReady()
// helper (master did not touch that file).
//
// Idiom follows tests/t2-durable-save-boundary.test.ts (self-checking,
// `npx tsx`, no framework).

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

// ---------------------------------------------------------------------------
// Behavioral proof: the bounded-race pattern settles even when the
// underlying "ready" promise never resolves.
// ---------------------------------------------------------------------------
function neverResolves<T>(): Promise<T> {
  return new Promise(() => {
    // intentionally never settles — mirrors serviceWorker.ready with no SW
  });
}

async function waitWithTimeout<T>(readyPromise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    readyPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Service worker not ready (timed out)")), timeoutMs),
    ),
  ]);
}

async function runBoundedRaceTest() {
  const start = Date.now();
  try {
    await waitWithTimeout(neverResolves<ServiceWorkerRegistration>(), 50);
    check("bounded race rejects (not hangs) when ready-promise never settles", false);
  } catch (err) {
    const elapsed = Date.now() - start;
    check(
      "bounded race rejects within the timeout window instead of hanging forever",
      elapsed < 500,
      `elapsed=${elapsed}ms`,
    );
    check(
      "rejection is the expected timeout error",
      err instanceof Error && /timed out/.test(err.message),
      String(err),
    );
  }
}

async function runSuccessPathUnaffectedTest() {
  const readyValue = { scope: "/mock" } as unknown as ServiceWorkerRegistration;
  const result = await waitWithTimeout(Promise.resolve(readyValue), 5000);
  check("bounded race still resolves normally when ready-promise settles quickly", result === readyValue);
}

// ---------------------------------------------------------------------------
// Source-level proof: the file routes through a local bounded helper — no
// remaining raw `await navigator.serviceWorker.ready` on the user-triggered
// path, and the helper races against a timeout.
// ---------------------------------------------------------------------------
function checkFileIsBounded(relPath: string) {
  const source = readFileSync(join(__dirname, "..", relPath), "utf8");

  const helperMatch = source.match(
    /function waitForServiceWorkerReady\(\)[\s\S]{0,400}?\n\}/,
  );
  check(`${relPath}: defines a waitForServiceWorkerReady() helper`, !!helperMatch);
  if (helperMatch) {
    const helper = helperMatch[0];
    check(
      `${relPath}: helper races navigator.serviceWorker.ready against a timeout`,
      /Promise\.race/.test(helper) && /navigator\.serviceWorker\.ready/.test(helper) && /setTimeout/.test(helper),
    );
  }

  // Only live (non-comment) occurrence of the raw ready-promise must be
  // inside the helper itself — every call site must go through
  // waitForServiceWorkerReady().
  const liveReadyLines = source
    .split("\n")
    .filter((line) => /navigator\.serviceWorker\.ready/.test(line) && !/^\s*\/\//.test(line));
  check(
    `${relPath}: exactly one live reference to navigator.serviceWorker.ready (inside the bounded helper)`,
    liveReadyLines.length === 1,
    `found ${liveReadyLines.length}: ${JSON.stringify(liveReadyLines)}`,
  );

  const callSiteMatch = source.match(/await\s+waitForServiceWorkerReady\(\)/);
  check(`${relPath}: call site uses the bounded helper (await waitForServiceWorkerReady())`, !!callSiteMatch);

  const unboundedCallSite = /await\s+navigator\.serviceWorker\.ready/.test(source);
  check(`${relPath}: no remaining unbounded "await navigator.serviceWorker.ready"`, !unboundedCallSite);
}

// ---------------------------------------------------------------------------
// Source-level proof: NotificationPreferences.tsx no longer holds any raw
// service-worker wait at all (bounded or otherwise) — it delegates the
// entire push flow to the shared src/lib/pushSubscribe.ts helper.
// ---------------------------------------------------------------------------
function checkDelegatesToSharedHelper(relPath: string) {
  const source = readFileSync(join(__dirname, "..", relPath), "utf8");

  check(
    `${relPath}: imports subscribeToPush from '@/lib/pushSubscribe'`,
    /import\s*\{\s*subscribeToPush\s*\}\s*from\s*['"]@\/lib\/pushSubscribe['"]/.test(source),
  );
  check(
    `${relPath}: calls subscribeToPush()`,
    /await\s+subscribeToPush\(\)/.test(source),
  );
  check(
    `${relPath}: no raw "navigator.serviceWorker.ready" reference (delegates entirely)`,
    !/navigator\.serviceWorker\.ready/.test(source),
  );
  check(
    `${relPath}: no local waitForServiceWorkerReady() helper (bound lives in shared helper now)`,
    !/function waitForServiceWorkerReady/.test(source),
  );
}

async function main() {
  await runBoundedRaceTest();
  await runSuccessPathUnaffectedTest();
  checkDelegatesToSharedHelper("src/components/Notifications/NotificationPreferences.tsx");
  checkFileIsBounded("src/lib/pushSubscribe.ts");
  checkFileIsBounded("src/components/Notifications/PushUnavailableWarning.tsx");

  if (failed) {
    process.exitCode = 1;
    console.error("\nOne or more T4 notification-sw-ready-bound scenarios failed.");
  } else {
    console.log("\nAll T4 notification-sw-ready-bound scenarios passed.");
  }
}

main();
