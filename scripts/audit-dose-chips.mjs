#!/usr/bin/env node
// Deterministic self-check for the verifier S1 fix (2026-07-18): dose chips
// must only ever be derived from a regimen's structured dose_value, never
// scraped from free text. Mirrors RegimenSourcePicker.tsx's `hasCitableDose`
// gate exactly: a chip exists iff dose_value != null && !is_range_or_multi.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "data", "peptide-education");

const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
let totalChips = 0;
let violations = 0;

for (const file of files) {
  const card = JSON.parse(readFileSync(path.join(dataDir, file), "utf8"));
  const doseRegimens = (card.structured_regimens || []).filter((r) => r.field === "dose");

  let cardChips = 0;
  for (const r of doseRegimens) {
    // SAME rule as RegimenSourcePicker.tsx `hasCitableDose`.
    const hasCitableDose = r.dose_value != null && !r.is_range_or_multi;
    if (!hasCitableDose) continue; // no chip rendered for this regimen — nothing to assert
    cardChips++;
    totalChips++;
    // INDEPENDENT invariant (does NOT re-test the gate above): a chip's value
    // must trace verbatim to its own quote. The killed bug fabricated numbers
    // that appeared nowhere as a real dose; this fires if a dose_value doesn't
    // literally occur as a number token in the regimen's own quote text.
    const quoteNums = String(r.quote || "").match(/\d+(?:\.\d+)?/g) || [];
    if (!quoteNums.includes(String(r.dose_value))) {
      violations++;
      console.error(
        `VIOLATION ${file}: chip dose_value ${r.dose_value} not found in its quote ->`,
        JSON.stringify(r.quote),
      );
    }
  }
  console.log(`${file}: ${cardChips} chip(s)`);
}

console.log(`\n${files.length} cards scanned, ${totalChips} total chip(s), ${violations} violation(s).`);
if (violations > 0) process.exit(1);
