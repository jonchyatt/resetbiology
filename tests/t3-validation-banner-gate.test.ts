// T3 validation-banner interaction-gate regression harness.
//
// Covers DosageCalculator.tsx's `errors` (computed every render, unchanged)
// vs `hasInteracted` (presentation-only latch, T3) split. A React component
// with top-level hooks isn't importable standalone by a plain node script,
// so this harness mirrors the exact control-flow and cross-checks it against
// the real source structurally. Idiom follows tests/t1-time-contract.test.ts
// and tests/t2-durable-save-boundary.test.ts (self-checking, `npx tsx`, no
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
// Mirrors the validation useEffect + hasInteracted latch in
// DosageCalculator.tsx: `errors` recomputes on every inputs change
// (including the mount run); `hasInteracted` flips true on the first
// post-mount run, or on a submit attempt. Same validation rule
// (desiredDose <= 0) as the reported bug.
// ---------------------------------------------------------------------------
class ValidationLatch {
  hasInteracted = false;
  private isFirstRun = true;
  errors: string[] = [];

  // Mirrors the `useEffect(() => {...}, [inputs])` body.
  runValidationEffect(desiredDose: number) {
    const e: string[] = [];
    if (desiredDose <= 0) e.push("Desired dose must be greater than 0.");
    this.errors = e;
    if (this.isFirstRun) {
      this.isFirstRun = false;
    } else {
      this.hasInteracted = true;
    }
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

  // 2. Show-after-interaction: member edits the dose field and leaves it
  // invalid (e.g. types then clears it back to 0) — a second inputs change,
  // still invalid. Banner must now appear.
  const afterEdit = new ValidationLatch();
  afterEdit.runValidationEffect(0); // mount
  afterEdit.runValidationEffect(0); // field edit, still invalid
  check(
    "editing a relevant field and leaving it invalid shows the banner",
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
  disabledCheck.runValidationEffect(500); // member fixes the dose
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
// gated by hasInteracted, and the disabled expressions must NOT reference
// hasInteracted (disabled logic is unchanged per the ticket).
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
} catch (err) {
  check("structural source cross-check ran without error", false, String(err));
}

if (failed) {
  console.error("\nT3 validation-banner-gate: FAILED");
  process.exit(1);
} else {
  console.log("\nT3 validation-banner-gate: ALL PASS");
}
