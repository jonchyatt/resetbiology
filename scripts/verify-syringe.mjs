// F8.3 fix fixture — proves the unified SyringeModel never clamps the
// readout, and correctly raises the syringe-overdraw and vial-overdraw
// warning flags. No test runner is configured in this repo (no jest/vitest
// in package.json), so this is a plain runnable script per convention
// (scripts/verify-containment.mjs). Run with:
//   npx tsx scripts/verify-syringe.mjs
//
// Exercises the exact exported pure function the real component calls — no
// logic is duplicated here.

import * as syringeMod from "../src/components/Peptides/SyringeModel.tsx";

// NOTE: tsx wraps .tsx modules as CJS when imported from a plain .mjs script
// (no "type": "module" in package.json) — see verify-containment.mjs for the
// full explanation of this script-runner quirk.
const { evaluateSyringe, pickDefaultSyringeSize } = syringeMod.default ?? syringeMod;

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

console.log("--- (a) true units readout is never clamped (60u on a 50u barrel reads 60, not 50) ---");
{
  const result = evaluateSyringe(60, 50);
  assertEqual(result.readoutUnits, 60, "readoutUnits is the true 60, not the clamped 50");
}

console.log("--- (b) 60u dose on a 50u syringe raises the overdraw warning flag ---");
{
  const result = evaluateSyringe(60, 50);
  assertTrue(result.overSyringe === true, "overSyringe flag raised for 60u on 50u barrel");
  assertEqual(result.fillRatio, 1, "fill visually caps at 1 (100%) even though readout is 60");
}

console.log("--- (c) dose exceeding vial capacity raises the vial-overdraw flag ---");
{
  // e.g. a 2ml reconstituted vial holds 200 units total (2ml * 100u/ml);
  // a 250-unit draw exceeds what the vial actually contains.
  const result = evaluateSyringe(250, 100, 200);
  assertTrue(result.overVial === true, "overVial flag raised when trueUnits > vialCapacityUnits");
}

console.log("--- (d) dose within capacity raises no warning; fillRatio = trueUnits/size ---");
{
  const result = evaluateSyringe(30, 50, 200);
  assertTrue(result.overSyringe === false, "no syringe-overdraw warning within capacity");
  assertTrue(result.overVial === false, "no vial-overdraw warning within capacity");
  assertEqual(result.fillRatio, 30 / 50, "fillRatio = trueUnits / size exactly, no rounding surprises");
  assertEqual(result.readoutUnits, 30, "readoutUnits equals the true input");
}

console.log("--- default syringe-size selection: smallest that fits, else 100 ---");
{
  assertEqual(pickDefaultSyringeSize(20), 30, "20u picks the 30u syringe");
  assertEqual(pickDefaultSyringeSize(45), 50, "45u picks the 50u syringe");
  assertEqual(pickDefaultSyringeSize(60), 100, "60u (fits none of 30/50) falls through to 100u");
  assertEqual(pickDefaultSyringeSize(150), 100, "150u (exceeds even 100u) still returns 100 — largest supported");
}

console.log("--- vialCapacityUnits omitted -> overVial never fires (no fabricated guard) ---");
{
  const result = evaluateSyringe(60, 50);
  assertTrue(result.overVial === false, "overVial stays false when vialCapacityUnits is not provided");
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
