// Row 16 regression harness (mutation-arc parity, data/rb-peptide-library/
// runtime-logs/parity-2026-07-19/mutation-arc-RESULTS.md): when
// /api/products/storefront fails, PeptideTracker.tsx falls back to
// `fallbackLibrary`. The helper text below the Add-Protocol dropdown
// unconditionally promises "+ Custom option available", but fallbackLibrary
// had no entry with id "custom" — so a member in the fallback state had no
// way to log a non-catalog peptide despite the UI's promise.
//
// fallbackLibrary is a plain array literal inside a component with top-level
// hooks (not importable standalone), so this is a structural source
// cross-check — same idiom as tests/t3-validation-banner-gate.test.ts
// (self-checking, `npx tsx`, no framework).

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

try {
  const source = readFileSync(
    join(__dirname, "..", "src", "components", "Peptides", "PeptideTracker.tsx"),
    "utf8",
  );

  const arrayStart = source.indexOf("const fallbackLibrary:");
  const arrayEnd = source.indexOf("const handleSaveProtocol = async");
  check("fallbackLibrary isolated for inspection", arrayStart !== -1 && arrayEnd !== -1);
  const arrayBody = source.slice(arrayStart, arrayEnd);

  check(
    'fallbackLibrary contains an id: "custom" entry',
    /id:\s*"custom"/.test(arrayBody),
    arrayBody,
  );
  check(
    'fallbackLibrary\'s custom entry is named "Other (Custom)" — matches the successful-fetch path',
    /id:\s*"custom"[\s\S]{0,80}name:\s*"Other \(Custom\)"/.test(arrayBody),
  );

  // Both places setPeptideLibrary(fallbackLibrary) is called (error branch +
  // catch block of fetchPeptideLibrary) must reference the same array, so
  // fixing the array once fixes both call sites — no duplicated custom-entry
  // literal to drift out of sync.
  const fallbackUsages = (source.match(/setPeptideLibrary\(fallbackLibrary\)/g) || []).length;
  check(
    "fallbackLibrary is reused (not duplicated) across its call sites",
    fallbackUsages >= 2,
    `count=${fallbackUsages}`,
  );
} catch (err) {
  check("structural source cross-check ran without error", false, String(err));
}

if (failed) {
  console.error("\nRow 16 fallback-custom-option: FAILED");
  process.exit(1);
} else {
  console.log("\nRow 16 fallback-custom-option: ALL PASS");
}
