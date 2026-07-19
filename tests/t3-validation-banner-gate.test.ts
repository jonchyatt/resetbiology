// T3 validation-banner interaction-gate regression harness.
//
// Covers DosageCalculator.tsx's `errors` (computed every render, unchanged)
// vs `hasInteracted` (presentation-only latch, T3) split. A React component
// with top-level hooks isn't importable standalone by a plain node script,
// so this harness mirrors the exact control-flow and cross-checks it against
// the real source structurally. Idiom follows tests/t1-time-contract.test.ts
// and tests/t2-durable-save-boundary.test.ts (self-checking, `npx tsx`, no
// framework).
//
// Fix-wave (on top of 1564db2b): the original mirror modeled the latch as
// "effect ran more than once" — which is indistinguishable from StrictMode's
// double-invoke of the SAME mount, and from a programmatic setInputs seed
// (imported peptide, deep-link ?peptide=<slug>) re-running the same effect.
// Both blind-verification failures traced to that exact equivalence. The
// latch now lives ONLY in real user event handlers; the validation effect
// is pure and never touches it, no matter how many times it runs.

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
// Mirrors the validation useEffect (pure — recomputes `errors`, never
// touches the latch) + hasInteracted (set only from event-handler call
// sites: field onChange/onBlur, select onChange, submit attempts) in
// DosageCalculator.tsx. Same validation rule (desiredDose <= 0) as the
// reported bug.
// ---------------------------------------------------------------------------
class ValidationLatch {
  hasInteracted = false;
  errors: string[] = [];

  // Mirrors the `useEffect(() => {...}, [inputs])` body post-fix: pure
  // computation, no latch write. Safe to call any number of times —
  // StrictMode double-invoke and repeated programmatic seeds included.
  runValidationEffect(desiredDose: number) {
    const e: string[] = [];
    if (desiredDose <= 0) e.push("Desired dose must be greater than 0.");
    this.errors = e;
  }

  // Mirrors a real onChange/onBlur handler: setHasInteracted(true) then
  // setInputs(...), i.e. the actual code shape in the fixed component
  // (e.g. desiredDose input onChange at DosageCalculator.tsx).
  fieldOnChange(desiredDose: number) {
    this.hasInteracted = true;
    this.runValidationEffect(desiredDose);
  }

  // Mirrors a programmatic seed: loadPeptideFromLibrary called from the
  // deep-link initialPeptideSlug effect, or the importedPeptide mount
  // effect — both call setInputs directly, never through an onChange
  // handler, so they must NOT touch the latch.
  programmaticSeed(desiredDose: number) {
    this.runValidationEffect(desiredDose);
  }

  // Mirrors setHasInteracted(true) at the top of handleSave /
  // handleProtocolSave.
  attemptSubmit() {
    this.hasInteracted = true;
  }

  get bannerVisible(): boolean {
    return this.hasInteracted && this.errors.length > 0;
  }

  // Mirrors the submit-button `disabled` expression's `errors.length > 0`
  // clause — must stay independent of hasInteracted.
  get invalidForSubmit(): boolean {
    return this.errors.length > 0;
  }
}

try {
  // 1. Show-nothing-on-mount: addProtocol mode seeds desiredDose: 0, which
  // is invalid. The mount run of the validation effect must not surface
  // the banner.
  const onMount = new ValidationLatch();
  onMount.runValidationEffect(0);
  check(
    "mount with invalid desiredDose:0 computes errors but does NOT show the banner",
    onMount.errors.length > 0 && onMount.bannerVisible === false,
    `errors=${JSON.stringify(onMount.errors)} bannerVisible=${onMount.bannerVisible}`,
  );

  // 1b. StrictMode double-invoke: dev-mode re-runs the SAME mount's effect
  // a second time on the same instance (refs/state preserved). Must still
  // stay clean — this is the exact HIGH finding from blind verification.
  const strictMode = new ValidationLatch();
  strictMode.runValidationEffect(0); // effect setup #1 (StrictMode)
  strictMode.runValidationEffect(0); // effect setup #2 (StrictMode replay)
  check(
    "StrictMode double-invoke of the validation effect does NOT trip the banner",
    strictMode.bannerVisible === false,
    `bannerVisible=${strictMode.bannerVisible}`,
  );

  // 1c. Programmatic seed (deep-link ?peptide=<slug> / imported peptide):
  // setInputs runs from a non-interactive effect, re-running validation,
  // but the member touched nothing. Must stay clean — the other HIGH
  // finding from blind verification.
  const deepLink = new ValidationLatch();
  deepLink.runValidationEffect(0); // initial mount, no slug yet
  deepLink.programmaticSeed(0); // loadPeptideFromLibrary sets desiredDose:0
  check(
    "programmatic seed (deep-link / imported peptide) does NOT trip the banner",
    deepLink.bannerVisible === false,
    `bannerVisible=${deepLink.bannerVisible}`,
  );

  // 2. Show-after-interaction: member edits the dose field through the real
  // onChange code path and leaves it invalid. Banner must now appear.
  const afterEdit = new ValidationLatch();
  afterEdit.runValidationEffect(0); // mount
  afterEdit.fieldOnChange(0); // real onChange, still invalid
  check(
    "editing a relevant field via onChange and leaving it invalid shows the banner",
    afterEdit.bannerVisible === true,
  );

  // 2b. Show-after-submit-attempt: member never edited anything but hits
  // submit while invalid (defensive path — button disabled attribute
  // already blocks the click in the browser, but the latch itself must
  // not depend on that).
  const afterSubmitAttempt = new ValidationLatch();
  afterSubmitAttempt.runValidationEffect(0); // mount
  afterSubmitAttempt.attemptSubmit();
  check(
    "a submit attempt while invalid shows the banner even with no prior field edit",
    afterSubmitAttempt.bannerVisible === true,
  );

  // 3. Disabled-while-invalid, unchanged: submit must stay disabled purely
  // off `errors.length > 0`, on mount AND after interaction — hasInteracted
  // must never leak into that expression.
  const disabledCheck = new ValidationLatch();
  disabledCheck.runValidationEffect(0);
  check(
    "submit stays disabled on mount while dose is 0 (pre-interaction)",
    disabledCheck.invalidForSubmit === true,
  );
  disabledCheck.fieldOnChange(500); // member fixes the dose
  check(
    "submit becomes enabled once the field is actually valid",
    disabledCheck.invalidForSubmit === false,
  );
  check(
    "banner also clears once the field is valid, even though hasInteracted stays true",
    disabledCheck.bannerVisible === false && disabledCheck.hasInteracted === true,
  );
} catch (err) {
  check("ValidationLatch mirror ran without error", false, String(err));
}

// ---------------------------------------------------------------------------
// Structural cross-check against the real source: the banner render must be
// gated by hasInteracted, disabled expressions must NOT reference
// hasInteracted (disabled logic is unchanged per the ticket), the effect-
// run-count heuristic must be gone, and the latch must only be set from
// event-handler call sites, not from the validation effect body.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { join } from "node:path";

try {
  const source = readFileSync(
    join(__dirname, "..", "src", "components", "Peptides", "DosageCalculator.tsx"),
    "utf8",
  );

  check(
    "banner render condition is gated by hasInteracted",
    /\{hasInteracted\s*&&\s*errors\.length\s*>\s*0\s*&&\s*\(/.test(source),
  );

  const disabledLines = source
    .split("\n")
    .filter((line) => /disabled=\{.*errors\.length > 0/.test(line));
  check(
    "at least one submit-button disabled expression checks errors.length > 0",
    disabledLines.length >= 1,
    JSON.stringify(disabledLines),
  );
  check(
    "no disabled expression references hasInteracted (disabled logic unchanged)",
    disabledLines.every((line) => !line.includes("hasInteracted")),
    JSON.stringify(disabledLines),
  );

  check(
    "validation useEffect still recomputes errors unconditionally (setErrors(e) present)",
    /setErrors\(e\);/.test(source),
  );

  check(
    "effect-run-count heuristic (isFirstValidationRunRef) is gone",
    !source.includes("isFirstValidationRunRef"),
  );

  // Isolate the validation useEffect body (setErrors(e) through its closing
  // `}, [inputs]);`) and assert it never calls setHasInteracted — the latch
  // must not be settable from effect re-runs, only from event handlers.
  const effectStart = source.indexOf("setErrors(e);");
  const effectEnd = source.indexOf("}, [inputs]);", effectStart);
  check(
    "validation effect body isolated for inspection",
    effectStart !== -1 && effectEnd !== -1,
  );
  const effectBody = source.slice(effectStart, effectEnd);
  check(
    "validation effect body does NOT call setHasInteracted (latch is event-handler-only)",
    !effectBody.includes("setHasInteracted"),
    effectBody,
  );

  // The deep-link seed (initialPeptideSlug effect) and the imported-peptide
  // mount effect must not call setHasInteracted either — same class as
  // above, the other HIGH finding.
  const initialSlugEffectStart = source.indexOf("if (!initialPeptideSlug ||");
  const initialSlugEffectEnd = source.indexOf("[initialPeptideSlug, peptideLibrary, loadPeptideFromLibrary]);");
  check(
    "deep-link initialPeptideSlug effect isolated for inspection",
    initialSlugEffectStart !== -1 && initialSlugEffectEnd !== -1,
  );
  const initialSlugEffectBody = source.slice(initialSlugEffectStart, initialSlugEffectEnd);
  check(
    "deep-link initialPeptideSlug effect does NOT call setHasInteracted",
    !initialSlugEffectBody.includes("setHasInteracted"),
    initialSlugEffectBody,
  );

  const importedPeptideEffectStart = source.indexOf("if (!importedPeptide) return;");
  const importedPeptideEffectEnd = source.indexOf("}, [importedPeptide]);");
  check(
    "importedPeptide mount effect isolated for inspection",
    importedPeptideEffectStart !== -1 && importedPeptideEffectEnd !== -1,
  );
  const importedPeptideEffectBody = source.slice(importedPeptideEffectStart, importedPeptideEffectEnd);
  check(
    "importedPeptide mount effect does NOT call setHasInteracted",
    !importedPeptideEffectBody.includes("setHasInteracted"),
    importedPeptideEffectBody,
  );

  // At least the totalVolume/peptideAmount/desiredDose onChange handlers
  // must set the latch — this is the positive half of the fix (real
  // interaction still trips the banner).
  const setHasInteractedCount = (source.match(/setHasInteracted\(true\)/g) || []).length;
  check(
    "setHasInteracted(true) appears at multiple real call sites (handlers + submit, not just one)",
    setHasInteractedCount >= 5,
    `count=${setHasInteractedCount}`,
  );
} catch (err) {
  check("structural source cross-check ran without error", false, String(err));
}

if (failed) {
  console.error("\nT3 validation-banner-gate: FAILED");
  process.exit(1);
} else {
  console.log("\nT3 validation-banner-gate: ALL PASS");
}
