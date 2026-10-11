import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const dataPath = resolve(root, "src/data/peptideProtocolReferences.ts");
const trackerPath = resolve(root, "src/components/Peptides/PeptideTracker.tsx");
const dataSource = readFileSync(dataPath, "utf8");
const tracker = readFileSync(trackerPath, "utf8");
const arrayLiteral = dataSource.match(/export const peptideProtocolReferences[^=]*= (\[[\s\S]*\]);\s*$/)?.[1];
assert.ok(arrayLiteral, "protocol reference export must be a literal array");
const peptideProtocolReferences = vm.runInNewContext(`(${arrayLiteral})`);
const originalReferenceIds = new Set([
  "reference-bpc-157",
  "reference-ipamorelin",
  "reference-semaglutide",
  "reference-tirzepatide",
  "reference-retatrutide",
]);
const requiredCategories = new Set(["Recovery", "Metabolic", "Immune", "Cognitive"]);
const exactRecordCount = 17;
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

check(peptideProtocolReferences.length === exactRecordCount, `expected ${exactRecordCount} reference records`);
check(new Set(peptideProtocolReferences.map((reference) => reference.id)).size === exactRecordCount, "reference ids must be unique");
check(originalReferenceIds.isSubsetOf(new Set(peptideProtocolReferences.map((reference) => reference.id))), "all five RB-04 references must remain");
check(peptideProtocolReferences.length - originalReferenceIds.size >= 12, "must add at least twelve source-backed records");
for (const category of requiredCategories) {
  check(peptideProtocolReferences.some((reference) => reference.category === category), `missing ${category} category`);
}

for (const reference of peptideProtocolReferences) {
  const corpusPath = resolve(root, reference.sourcePath);
  check(existsSync(corpusPath), `${reference.name}: corpus file missing`);
  check(reference.sourceHref === `/education/peptides/${reference.sourcePath.match(/([^/]+)\.json$/)?.[1]}`, `${reference.name}: source details link must target its corpus slug`);
  check(reference.doseRange.length > 0 && reference.frequency.length > 0, `${reference.name}: dose and schedule fields are required`);

  const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
  const hunter = corpus.experts?.["hunter-williams"];
  if (reference.sourceEvidence === "baseline_protocol") {
    const baseline = hunter?.baseline_protocol;
    check(Boolean(baseline), `${reference.name}: missing Hunter baseline protocol`);
    check(reference.doseRange === baseline.dose, `${reference.name}: displayed dose differs from corpus baseline`);
    check(reference.vialAmount === baseline.vial_mg, `${reference.name}: vial amount differs from corpus baseline`);
    check(reference.reconstitution === baseline.bac_mL, `${reference.name}: reconstitution differs from corpus baseline`);
    check(reference.timing === baseline.timing, `${reference.name}: timing differs from corpus baseline`);
    check(reference.frequency === baseline.frequency, `${reference.name}: frequency differs from corpus baseline`);
    check(reference.duration === baseline.duration, `${reference.name}: duration differs from corpus baseline`);
    check(reference.source === baseline.source, `${reference.name}: source differs from corpus baseline`);
  } else {
    const topDoses = hunter?.summary?.top_doses ?? [];
    check(topDoses.some((entry) => entry.dose === reference.doseRange), `${reference.name}: displayed dose is not present in corpus top doses`);
    for (const field of [reference.vialAmount, reference.reconstitution, reference.timing, reference.frequency, reference.duration]) {
      check(field === "Not stated in corpus record", `${reference.name}: unavailable schedule fields must state the corpus omission`);
    }
  }
}

for (const expectedText of [
  "protocol-reference-search",
  "protocol-reference-category",
  "filteredProtocolReferences",
  "Source details:",
  "reference material, not your saved protocol",
  "sm:grid-cols-[minmax(0,1fr)_auto]",
  "min-w-0",
]) {
  check(tracker.includes(expectedText), `tracker missing ${expectedText}`);
}
for (const category of requiredCategories) {
  check(tracker.includes(`\"${category}\"`), `tracker filter missing ${category}`);
}

console.log(`RB-22 protocol library PASS: records=${peptideProtocolReferences.length}; additions=${peptideProtocolReferences.length - originalReferenceIds.size}; categories=${requiredCategories.size}; sourceAssertions=${assertions}; keyboardLabels=2; viewportAssertions=2`);
