# PLUMB — GORR INSTANCE (resume anchor — read FIRST on any fresh/compacted entry)

> Gorr is ACTIVE. Compaction is permitted + ENCOURAGED. On wake: read this, then the Master Goal Spec, then consult FLW, then RESUME — do not restart, do not re-ask, do not re-design. **Keep going until the goal.**

## FIRST ACTION
Read **`scripts/omr/PLUMB-MASTER-GOAL-SPEC.md` in full** — True North (§0–§2), guardrails (§3), mechanical enforcement (§6), state (§7), the full pathway (§8), the operating protocol (§9: Karpathy ratchet + full Mythos + all-eyes + autonomous run).

## What we are building (the why)
The **PLUMB foundry**: raw scanned score in → verified-perfect trainable product out (engraving + plunk that plays plumb-true off the verified score + lyrics), at scale, the system Jon walks away from. We are NOT fixing one song — we are solving the **systemic verification-theater failure** that shipped a wrong engraving and called it "100% green." **Lida Rose is the first proof case.**

## Current state (2026-06-24)
- **A1 DONE** — verification packet frozen: `scripts/omr/lock/lida-rose/` (4 authority pages + 2 engravings SHA256-hashed, page-measure map, 232-row note ledger).
- Mechanical gate `node scripts/omr/verify-packet-ready.mjs` → **PACKET-READINESS GREEN · ENGRAVING-LOCK RED** (0/232 verdicts, no Jon sign-off). The operator CANNOT type "locked" — the script decides it from disk.
- **A2 finding:** automated VISION (Argus + Claude) is too unreliable to be the judge — Argus blind reads diverged from the engraving but vision itself is unreliable on dense notation (Codex+FLW warned). Vision CANNOT be the court.
- **DECISION (Jon):** "deterministic judge first." **Build order (Codex/FLW-approved):** (1) **corrections-diff FIRST** — engraving vs RAW Audiveris source (`scripts/omr/source/lida-196/197/198.xml`), flag every Claude/manual edit = highest-risk suspect rows; LOCK the staff/measure/row mapping first (Codex HIGH). (2) music21/`musicdiff` for structure + golden regression lock. (3) oemer second-OMR LAST (weak auxiliary, never the court; oemer 0.1.8 IS installed; music21 NOT yet). Codex HIGH: corrections-diff alone can't prove page-truth (shares Audiveris errors) → second signal (oemer/Jon) for shared-error rows.
- **DETERMINISTIC JUDGE Layer 1 BUILT + RUN:** `node scripts/omr/build-corrections-diff.mjs` → 232 notes, **19 divergences** (Lead 9, Baritone 10) = exactly our session-2 corrections. Report `scripts/omr/lock/lida-rose/corrections-diff.json`. Narrowed the board's job 232→19.
- **LAYER 2 DONE (2026-06-25, FLW `bw7ac7zmr` APPROVE-WITH-CORRECTIONS + `b1v3xw927` YELLOW/GREEN-for-triage; oemer NOT installed — claim was false, deferred Codex-LAST):** hardened `verify-packet-ready.mjs` (final-verdict vocab {match,ok-non-note,BLOCKING}; non-final tokens RED) · `build-triage-layer2.mjs` → `triage-layer2.json` classified all 232 (209 raw-agreement · 8 deterministic · 10 intervention · **5 page-read-BLOCKING**) · two-eye BLIND vision (Claude + Argus, `vision-reads.json`) on the 5 concentrated Baritone suspects via tight lyric-verified crops (`lock/lida-rose/crops/`) · wrote 5 BLOCKING into the binding ledger + re-hashed. Gate: **5/232 filled · 5 BLOCKING · no sign-off → ENGRAVING-LOCK RED.** Court instrument: `A4-BLOCKING-REPORT.md`. Stratified raw-agreement status: `stratified-sample.json`.
  - **Standout suspect: m9 "shy"=F3** — BOTH eyes read it well BELOW F3 (Claude G2-B2, Argus Eb2); likely a real engraving pitch error. Others (m5/m21/m25-hop/m29) = vision-scatter, need Jon.
  - **MAPPING NOW LOCKED (Codex HIGH closed):** `build-measure-map.mjs` → `measure-map.json`. Authoritative: page-196=eng[1-9], page-197=eng[10-21], page-198=eng[22-34/35]. The 4-way numbering conflict resolved; the 5 BLOCKING page labels CONFIRMED. The printed-manifest reconciled onto it → ALL 4 audit points AGREE by MIDI (manifest m9/m18/m31 "FAILs" = numbering+spelling artifacts, NOT errors). ⇒ **5 BLOCKING set CONFIRMED complete (no hidden m18/m31 suspects)** + 4 baritone bars (eng m4/m10/m20/m34) independently corroborated by the human page-read.
- **A4 COURT — LIVE PHONE SURFACE (2026-06-26, Jon-directed "build it, give me the link"):** `https://resetbiology.com/pitch-defender/score-verify/court` — phone-first; per suspect shows **OUR ENGRAVING** (pre-rendered single-measure PNG, `public/score/crops/engraving-bari-mNN.png`) above **THE PAGE** crop + Correct/Wrong+pitch capture. Jon's read POSTs to `/api/score-verify/verdict` → Vercel Blob `score-verify/lida-rose-a4-verdicts.json` (GET to read it back). Component `ScoreVerifyCourt.tsx`, data `public/score/lida-rose-suspects.json`. ui-specialist-gated; deployed (`32989908`); phone-verified (Playwright 390px, all imgs load, 0 overflow). **DEPLOYED via push origin master — Jon authorized.** WHEN JON SUBMITS: read his verdicts (GET the API or he tells you in chat), apply to `lida-lead-source-corrections.mjs`, rebuild→re-freeze→re-diff→re-gate.
- **NEXT (autonomous, don't stop):** **(A)** A4 read on the 5 BLOCKING = JON court gate — **surfaced** on the live A4 Court (above) + `A4-BLOCKING-REPORT.md`; standout = m9 "shy"=F3. **(B) Loose-end code fix:** migrate `build-baritone-score-health.mjs` printed-audit to use `measure-map.json` + MIDI compare (kills the 3 false FAILs; do NOT touch the manifest pitches = self-grading anti-pattern). **(C)** extend independent coverage of the 227 raw-agreement rows: a Lead printed-manifest + (deferred) oemer second-OMR. **(D)** when Jon clears the 5 → fix in `lida-lead-source-corrections.mjs` (NEVER source) → rebuild → re-freeze → re-diff → re-run gate. Iterate to 0 BLOCKING + all 232 verdict-filled + Jon sign-off → ENGRAVING-LOCK GREEN (A4) → A5 plunk → A6 lyrics → A7 product → ARC B foundry. **DO NOT STOP** except a Jon court gate (A4/A7/money/external), a 3-fail blocker, or True North. Compaction safe — resume here.

## AUTONOMOUS DIRECTIVE (Jon, 2026-06-24, verbatim intent)
*"I do not want it to stop until it reaches the goal of the full verified and tested by all team members true north."* Run §8 (A2→A3→A4→A5→A6→A7→ARC B) **continuously**, all eyes, Karpathy-logged, Mythos-disciplined. **STOP ONLY for:** Jon's court-of-record sign-off gates (A4 lock, A7 product, money/contract/external), a genuine blocker (3 fails → boardroom → Jon), or the True North reached.

## All eyes (Jon granted full permission)
- **Hawkeye** — the live page `resetbiology.com/pitch-defender/score-verify` (the overlay surface) is the visual court. Per-session go GRANTED for this instance.
- **Argus** — `node scripts/boardroom.mjs gemini "<q>" --image <path>` (independent vision; image calls ~120s, retry on timeout / use smaller crops).
- **Codex / FLW** — `node scripts/boardroom.mjs codex "<q>"` (method + the FLW gate; FLW framing = `scripts/omr/FLW-PROMPT.md`, NEVER narrate its approval).
- "Tested by all team members" = Codex + Argus + Hawkeye + Jon.

## Iron rules (the page is the authority)
- NEVER edit primary source: `scripts/omr/source/*.xml`, `public/score/*.jpg`. Corrections go in `scripts/omr/lida-lead-source-corrections.mjs` (Lead + Baritone live there).
- The **printed page** is the court of record; vision = corroboration, never proof.
- Verify the ARTIFACT (re-hash / re-read / screenshot), never the tool's "success" or an agent's words.
- After any correction: rebuild musicxml → re-freeze packet → re-run `verify-packet-ready.mjs` → re-run `verify-score-invariants.mjs` (must stay green).

## Build state
- Repo: `reset-biology-website`, branch `infinitetalk-studio`. Deploy = `git push origin master` (Vercel) ONLY; never the `vercel` CLI.
- Commits: `8aeb64de` (guardrails + A1 freeze), `985b209e` (§8 pathway), plus the §9 + FLW + this instance commit.
- Karpathy log: `scripts/omr/PLUMB-KARPATHY-LOG.md` (gate trail). Plunk gates (G1–G4) + the SYSTEMIC gate already logged.
