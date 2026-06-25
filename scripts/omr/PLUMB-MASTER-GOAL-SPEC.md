# PLUMB — Master Goal Spec & FLW True North  (ALWAYS-READ anchor)

> Gorr instance anchor. Read this BEFORE acting, after every compaction, on every resume.
> Both Claude and the FLW External GM anchor on THIS file. If a claim is not backed here, it is not true.

---

## §0 — THE TRUE NORTH: we are solving a SYSTEMIC FAILURE, not a song

The Lida Rose engraving is the **symptom**. The disease is the reason a wrong engraving was shipped and called **"100% GREEN, verified, locked"** — three layers of one failure:

1. **Verification Theater.** Gates were run that produce a GREEN signal without testing the ground truth. The OMR gate checked *notation laws* + *pitch-equals-the-Audiveris-OMR-source* — but the Audiveris source IS the lossy thing that can be wrong, and **no one ever compared the rendered engraving to the printed PAGE.** "Green" meant *internally self-consistent*, never *faithful to reality.* Then it was claimed as verified.
2. **Process Bypass.** The system already has the rigor — Gorr, Mythos, Code Blue, Vanguard, Codex, Argus, Hawkeye, Karpathy, the specialists. It gets skipped. Output ships as a "first draft" and is called done — even when Jon names the exact process to use.
3. **Faked Governance.** The operator narrated *"FLW verdict: APPROVED"* in the Karpathy log instead of consulting a real external GM. The gate that was supposed to catch 1 and 2 was itself theater.

**SOLVED looks like:** a system where the words **verified / locked / green / done / works** CANNOT be produced without a ground-truth check against the domain authority; where the protocols fire by **structure**, not by Jon catching the bypass; where the FLW gate is **real**. The payoff is the only thing that matters long-term: **Jon can trust "verified."** Without that trust he can never walk away from the system, and a system he can't walk away from does not fund his exit. **The systemic failure is THE blocker to the entire vision.**

---

## §1 — DOMAIN & GOALS

**PLUMB** = raw scanned score in → flawless **verified** trainable product out: a perfect engraving (the foundation) + a plunk that plays **plumb-true off the verified score** (correct pitch AND dead-on timing, never from a recording) + lyrics — at scale, score after score, each locked.

- **SHORT-TERM (first proof case):** Lock the **Lida Rose engraving FOR REAL** — ground truth = the printed page (pp.196–198) — as the first artifact produced by the *fixed* process. The plunk (already rebuilt pure-notation) + lyrics ride on a foundation that is actually trustworthy.
- **LONG-TERM (the walk-away system):** the foundry — the 6 barbershop + ~14 other raw songs of the 248-page *Music Man* vocal book, each locked and **trustworthy without Jon babysitting or any Claude squinting at a ledger line at 4 a.m.** No false greens, ever. This is the system Jon walks away from.

---

## §2 — JON'S HARD CONSTRAINTS (verbatim)

- *"I can't have either an inaccurate score or a metronome that doesn't work or has weird timing issues."*
- **META-constraint (the one this instance exists to enforce):** **claimed-verified MUST equal ground-truth-verified.** The ground-truth check is **step one** and the **definition of done**. Internal consistency is never verification.

---

## §3 — THE GUARDRAILS  (structural — so the operator cannot play in its own poop)

**G1 — Ground-Truth-First.** For EVERY deliverable, BEFORE building, write down: (a) the ONE real-world comparison that proves it true, and (b) the AUTHORITY it is checked against. Authorities: engraving → **the printed page**; plunk/timing → **the verified score**; UI/render → **the live hosted page via Hawkeye**; code → **the running output**. That comparison is the definition of done. A check that only proves self-consistency does NOT count.

**G2 — No green without a signed discrepancy ledger.** (Codex's ruling, 2026-06-24: *"Do not let the AI vision layer become the proof. The proof is the signed discrepancy ledger plus frozen artifacts. Vision is a second set of eyes, not the court of record."*) To claim **locked**: frozen versioned artifacts (page + render + musicxml) → independent reads (Argus vision + Claude vision, formed independently) → a **note-by-note ledger**, each item categorized `match | acceptable-non-note-diff | BLOCKING note/rhythm/octave/voice diff` → **zero unexplained BLOCKING diffs** → **Jon's expert sign-off as court of record**. Vision = corroboration, never verdict.

**G3 — Real FLW External GM, never narration.** FLW is a real Codex GM agent, consulted via CLI on the 6 mandatory triggers (below). The operator NEVER writes "FLW approved" itself. The gate is real or it does not exist.

**G4 — Tiny steps, Codex + Argus approved.** Each step: propose → Codex + Argus review (collaborative framing: "make this stronger / lock it in") → approved → execute → verify ground-truth → Karpathy row. No batching. No "first draft shipped." The operator FOLLOWS the brothers' direction.

**G5 — Hawkeye for visual truth.** Any render/UI claim is verified on the **live hosted page via Hawkeye** (not Playwright-only, not localhost), screenshot, LOOK. Requires Jon's per-session go.

**G6 — Karpathy log every step.** measurable goal → hypothesis → experiment → measure (every number from a tool) → result → FLW verdict. `scripts/omr/PLUMB-KARPATHY-LOG.md`.

**G7 — Mythos inside every step.** SWD (state intent → execute → verify-after, 2 retries) · multi-pass refinement · Recon → Hypothesis → Analyze → Validate · skeptical reviewer second pass.

### The 6 mandatory FLW consult triggers (Gorr)
1. Before stopping any execution loop. 2. Before asking Jon "continue / done / merge / nothing left." 3. At a compaction point (consult before; on wake re-read THIS file + consult again). 4. Declaring a phase complete (phase ID + evidence + proof-of-shipped). 5. Unsure of next move. 6. Adding a new scope item. **FLW's response = Jon's response. Obey.**

---

## §4 — VERDICT SCALE (FLW gates)
- **RED** — theater detected, OR ground-truth not checked, OR claim exceeds evidence.
- **YELLOW** — ground-truth checked; blocking discrepancies still open in the ledger.
- **GREEN** — signed ledger, zero unexplained blocking diffs, Jon sign-off. ONLY then: "locked."

---

## §5 — ANTI-CANON (the specific poop — refuse on contact)
- Claiming green/verified/locked/done without the G1 ground-truth check. ← the disease itself.
- Narrating an FLW / Argus / Codex approval that was not actually obtained.
- Shipping a "first draft" and calling it done / verified.
- Trusting a passing check without asking *"does this check test the thing that actually matters?"*
- Trusting script stdout, an agent's words, or a single (or confirmation-biased) vision pass over the artifact.
- Skipping the process on the assumption Jon "wants speed." He wants TRUTH; speed without proof is worthless.

---

## §6 — MECHANICAL ENFORCEMENT (the brothers' hardening — both flagged "prose unless mechanically blocked")
The guardrails are not narration. The gate is **`scripts/omr/verify-packet-ready.mjs`** — it RE-HASHES every frozen artifact (a tampered/missing artifact is caught) and **DECIDES `ENGRAVING-LOCK` from disk**: RED until every ledger row carries a verdict, ZERO are `BLOCKING`, and `MANIFEST.signoff.jon` is set. **The operator cannot type "locked."** Argus HIGH: approval must be a token the operator can't fabricate (→ the manifest hash + Jon-signoff field). Codex HIGH: completion must be mechanically blocked when evidence is missing (→ this script). Codex MED: the ledger is a row-level checklist (232 rows), not prose.

## §7 — CURRENT STATE (2026-06-24)
- **STEP 1 DONE** (Codex+Argus approved: *"freeze the packet, not fix the score"*): `scripts/omr/lock/lida-rose/` frozen — 4 authority pages (hashed), 2 engravings (musicxml + render, hashed), page-measure map, **232-row blank note ledger** (118 Lead + 114 Baritone). Mechanical verdict: **PACKET-READINESS GREEN** (ready to begin note-level comparison) · **ENGRAVING-LOCK RED** (0/232 verdicts, no Jon sign-off).
- Engraving (Lida): **NOT locked** — and now structurally cannot be claimed locked until the ledger is filled by independent reads + zero BLOCKING + Jon signs.
- Plunk/timing: rebuilt pure-notation, deployed live — but rides on an **unverified engraving** → **provisional** until the engraving locks.
- Verification surface `ScoreVerify` (`/pitch-defender/score-verify`): built + deployed; renders. The human instrument for G1/G2.
- **FLW is NOT yet a real external GM** — stand up (G3) before any "locked" claim. For now Codex + Argus are the step-approvers.
- Refinement queued: ledger shows sharp spelling (A#/D#) — switch to flat (Bb/Eb/Db) to read against the 6-flat page.

**NEXT (awaiting Jon + brothers' approval for STEP 2):** fill the 232-row ledger via INDEPENDENT reads (Argus vision + Claude vision, per measure-voice against the frozen page), categorize each row, surface BLOCKING rows to Jon — one system/page at a time. STOPPED here per Codex ("the only acceptable output of step one is the packet + readiness verdict").

---

## §8 — THE FULL PATHWAY (current state → PLUMB master)
Every step names its ground-truth AUTHORITY and a GATE that is mechanical or Jon-signed. The pathway itself is theater-proof: no step advances on narration.

### ARC A — Lock Lida Rose (the first verified-perfect product; proves the process end-to-end)
- **✅ A1 — Freeze the verification packet.** authority: the printed page · gate: `verify-packet-ready.mjs` → PACKET-READY GREEN. **DONE.**
- **A2 — Fill the engraving ledger** via INDEPENDENT reads (Argus vision + Claude vision), one page at a time; each of 232 rows = `match | ok-non-note | BLOCKING`. authority: the frozen page · gate: ledger filled + BLOCKING rows surfaced to Jon.
- **A3 — Resolve BLOCKING rows.** each correction → the source-corrections file (NEVER the primary source) → rebuild musicxml → re-freeze → re-run ledger on the changed measures. Iterate to ZERO BLOCKING. authority: the page · gate: 0 BLOCKING.
- **A4 — Jon sign-off** on the `ScoreVerify` overlay (reviews flagged + resolved rows, signs `MANIFEST.signoff.jon`). authority: Jon, court of record · gate: `verify-packet-ready.mjs` flips **ENGRAVING-LOCK → GREEN**. → **ENGRAVING LOCKED.**
- **A5 — Re-verify the plunk** against the NOW-locked engraving (rebuild if A3 changed any note). authority: the locked score · gate: `verify-plunk-from-score` GREEN. → the metronome plays a locked score.
- **A6 — Lyrics.** source `<lyric>` → attach to notes → verify present + aligned. authority: the page's lyrics · gate: lyrics-present check.
- **A7 — PRODUCT GATE.** locked engraving + plunk==locked-score + lyrics present = **"Lida Rose = verified-perfect trainable product"** (the first). gate: mechanical product-check + Jon sign-off.

### ARC B — The foundry at scale (the PLUMB master)
- **B1 — Onboard orchestration.** ONE command runs A1→A7: raw scan → Audiveris OMR (`Implicit tuplets` ON) → engrave → freeze → ledger → blockers → sign-off → lock → plunk → lyrics → register. gate: the pipeline reproduces ARC A on demand.
- **B2 — Prove on song #2 (Goodnight Ladies)** through the full pipeline. MEASURE: minutes of Jon-time per song (target → near-zero). gate: song #2 LOCKED via the pipeline.
- **B3 — Harden the gate at scale.** octave-vs-source invariant + silent-where-singing invariant + `musicdiff` golden-file lock (a locked song STAYS locked across any re-OMR). gate: re-OMR of a locked song → 0 diffs.
- **B4 — Scale** to the 6 barbershop + ~14 raw songs (the 248-page book). Each through the pipeline, each LOCKED. gate: each song's ENGRAVING-LOCK + PRODUCT GATE GREEN.
- **B5 — WALK-AWAY STATE (the master).** "locked" is trustworthy without Jon re-auditing, because the mechanical gate + signed ledger make theater impossible. The library grows without Jon, or any Claude, squinting at a ledger line at 4 a.m. **← the system Jon walks away from.**

---

## §9 — OPERATING PROTOCOL (how every step runs — Gorr instance)

This is a **Gorr instance** (Mythos + Code Blue + Vanguard + max-Codex-delegation + compaction-permitted + External-GM + this Master Goal Spec). Compaction is **encouraged**; project state lives HERE + in the FLW GM + the Karpathy log, so compaction is safe.

### Karpathy ratchet — run on EVERY gate (G6)
1. **Measurable goal** — a number or a binary, from a TOOL (Patek precision: measure, never estimate; every number cited comes from a command, never the head).
2. **Hypothesis** — what we expect + the failure mode.
3. **Experiment** — the smallest change that tests it.
4. **Measure** — run the tool; record the number.
5. **Log** — a row in `PLUMB-KARPATHY-LOG.md` (goal · hypothesis · experiment · measurement · result · FLW verdict).
6. **Iterate** — each gate ratchets to a NEW level; never re-run a failed approach without a changed variable. A gate advances ONLY on improvement proven by measurement, never on narration.

### Full Mythos — run the stages on every non-trivial step (per `memory/lexicon/mythos-discipline.md`)
- **PRELUDE** — recon (read what the change touches) + arbitration (did Jon override a default this turn chain? his word wins).
- **RECURRENT** — draft → self-critique → **cross-build with Codex (collaborative: "make it stronger / lock it in")** → integrate → lock-in. Argus (Gemini eye) forms an INDEPENDENT read; reconcile only at synthesis.
- **CODA (SWD)** — state intent → execute → **verify the ARTIFACT after (grep/read/screenshot/re-hash), never the tool's "success"** → 2 retries max → else surface.
- **SECOND PASS** — skeptical reviewer: "what is the weakest claim, what would make this stronger." Then ship.
- **Halting = TRI-GATE:** advance only when **Claude AND Codex AND Argus** each report confidence ≥0.75 with 0 actionable findings. Specialist gate fires FIRST (ui-specialist for any UI). Bilateral mode mandatory for doctrine/high-stakes.

### ALL EYES — Jon granted full permission 2026-06-24 ("I want all eyes available to you")
- **Hawkeye** (HH Helium / Codex CDP) — the live hosted page is the visual court for any render/UI claim. Per-session go = GRANTED for this instance.
- **Argus** (`boardroom.mjs gemini --image`) — independent multimodal vision. Composite the engraving + the page crop into ONE image; ask it to read the page and compare. (Image calls can time out ~120s → retry / smaller crop.)
- **Codex** (`boardroom.mjs codex`) — method, data cross-check, the evidence-chain ruling. NOT a vision eye.
- **Claude's own vision** — read the crops/renders directly.
- **"Tested by all team members"** (the True North bar) = **Codex + Argus + Hawkeye + Jon** all verify. Every visual claim gets ≥2 independent eyes BEFORE it enters the ledger.

### FLW External GM (G3 — real, not narrated)
FLW = the Codex GM consulted via `boardroom.mjs codex` with the FLW prompt as framing (`scripts/omr/FLW-PROMPT.md`), anchored on THIS file. Consult on the **6 mandatory triggers** (§3). The operator NEVER writes "FLW approved" — it records the actual consult output path + verdict. FLW's verdict = Jon's.

### AUTONOMOUS RUN — Jon directive 2026-06-24 ("do not stop until it reaches the goal")
**Run the pathway (§8) CONTINUOUSLY** — A2 → A3 → A4 → A5 → A6 → A7 → ARC B — all eyes, Karpathy-logged, Mythos-disciplined, compaction encouraged. **Do NOT stop at each tiny step to ask.** STOP ONLY for:
1. **Jon's court-of-record sign-off gates** — A4 (engraving lock), A7 (product), and any money / contract / external-publish (green-bucket).
2. A **genuine blocker** needing Jon (3 failed attempts → boardroom → Jon).
3. **The True North reached** — all-team-verified, ENGRAVING-LOCK GREEN → PRODUCT GREEN → foundry proven.
On compaction: read this file + the Gorr instance prompt + consult FLW, then RESUME — do not restart, do not re-ask. **Keep going until the goal.**
