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
  - **NEW SYSTEMIC FINDING — the staff/measure/page mapping is NOT locked (Codex HIGH still open):** FOUR conflicting numberings (engraving 1-34 / raw source 32 / printed-manifest pre-insert / lock-packet PAGE_MAP coarse-guess). The baritone `printed-score-audit` m9/m18/m31 FAILs are **likely numbering artifacts, NOT engraving errors** — did NOT act on them (silent-offset trap). The 5 BLOCKING are safe (lyric-anchored).
- **NEXT (autonomous, don't stop):** **(A)** the A4 read on the 5 BLOCKING is a JON court gate — surfaced. **(B) Build the authoritative `engraving-measure → page → source-bar → lyric` map** (Codex HIGH "lock the mapping first"), reconcile the printed-manifest onto it → real independent cross-check for the 227 raw-agreement rows → fill their verdicts. **(C)** when Jon clears the 5 (esp. m9 F3) → fix in `lida-lead-source-corrections.mjs` (NEVER source) → rebuild → re-freeze → re-diff → re-run gate. Iterate to 0 BLOCKING + all 232 verdict-filled + Jon sign-off → ENGRAVING-LOCK GREEN (A4) → A5 plunk → A6 lyrics → A7 product → ARC B foundry. **DO NOT STOP** except a Jon court gate (A4/A7/money/external), a 3-fail blocker, or True North. Compaction safe — resume here.

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
