// Row 50 regression harness (mutation-arc parity, data/rb-peptide-library/
// runtime-logs/parity-2026-07-19/mutation-arc-RESULTS.md): the "Add Oral
// Med" quick-add flow's onAdd handler interpolated
// medData.administrationType ("oral") into the notes string only — it never
// forwarded it as its own field to handleSaveProtocol, so the POST body's
// `administrationType || "injection"` default silently stamped every oral
// quick-add protocol as "injection" (wrong icon, syringe-prep UI shown
// instead of the oral "no prep needed" state).
//
// The onAdd callback and handleSaveProtocol both live inside a component
// with top-level hooks (not importable standalone), so the payload
// construction is mirrored here and cross-checked structurally against the
// real source. Idiom follows tests/t2-durable-save-boundary.test.ts
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

// Mirrors the fixed onAdd -> handleSaveProtocol POST-body construction.
function buildProtocolPostBody(medData: { administrationType?: string }) {
  const protocolData = {
    administrationType: medData.administrationType,
  };
  return {
    administrationType: protocolData.administrationType || "injection",
  };
}

try {
  const oralQuickAdd = buildProtocolPostBody({ administrationType: "oral" });
  check(
    "oral quick-add POST body carries administrationType: 'oral' (not the 'injection' default)",
    oralQuickAdd.administrationType === "oral",
    JSON.stringify(oralQuickAdd),
  );

  // Regular Add-Protocol flow (no administrationType from the caller) must
  // keep defaulting to injection — this fix must not change that path.
  const regularAdd = buildProtocolPostBody({});
  check(
    "protocol POST body still defaults to 'injection' when no administrationType is supplied",
    regularAdd.administrationType === "injection",
    JSON.stringify(regularAdd),
  );
} catch (err) {
  check("buildProtocolPostBody mirror ran without error", false, String(err));
}

// ---------------------------------------------------------------------------
// Structural cross-check against the real source.
// ---------------------------------------------------------------------------
try {
  const source = readFileSync(
    join(__dirname, "..", "src", "components", "Peptides", "PeptideTracker.tsx"),
    "utf8",
  );

  const onAddStart = source.indexOf("onAdd={async (medData) => {");
  const onAddEnd = source.indexOf("setShowQuickAddOral(false);", onAddStart);
  check("QuickAddOralMed onAdd handler isolated for inspection", onAddStart !== -1 && onAddEnd !== -1);
  const onAddBody = source.slice(onAddStart, onAddEnd);

  check(
    "onAdd forwards medData.administrationType as its own field to handleSaveProtocol",
    /administrationType:\s*medData\.administrationType/.test(onAddBody),
    onAddBody,
  );

  // The local optimistic newProtocol object (rendered immediately, before
  // any refetch) must also carry the real administrationType, or the card
  // would briefly show the syringe icon / prep-not-set-up state pre-refetch.
  const newProtocolStart = source.indexOf("const newProtocol: PeptideProtocol = {");
  const newProtocolEnd = source.indexOf("setCurrentProtocols([...currentProtocols, newProtocol]);");
  check("newProtocol local-state object isolated for inspection", newProtocolStart !== -1 && newProtocolEnd !== -1);
  const newProtocolBody = source.slice(newProtocolStart, newProtocolEnd);
  check(
    "newProtocol carries administrationType (not silently dropped from optimistic UI state)",
    /administrationType:\s*protocolData\.administrationType/.test(newProtocolBody),
    newProtocolBody,
  );

  // Card rendering itself was already correctly gated (icon + prep UI) — the
  // bug was purely the data never reaching that gate. Confirm the gates
  // still key off administrationType !== "injection" (unchanged).
  const oralGateCount = (source.match(/administrationType(?:\s*&&\s*[\w.]+\.administrationType)?\s*!==\s*"injection"/g) || []).length;
  check(
    "at least one card-rendering gate still checks administrationType !== 'injection' (unchanged)",
    oralGateCount >= 1,
    `count=${oralGateCount}`,
  );
} catch (err) {
  check("structural source cross-check ran without error", false, String(err));
}

if (failed) {
  console.error("\nRow 50 oral-quickadd-administration-type: FAILED");
  process.exit(1);
} else {
  console.log("\nRow 50 oral-quickadd-administration-type: ALL PASS");
}
