# Retro Blaster enemy-dive preview candidate

Card: `t_73382fea`  
Route: `/pitch-defender/retro-2`  
Candidate base: `a9c1378339157b76eb94a78d58887a03905b81d5`

## Reconciliation

The card was cut from the July 13 handoff, but the requested enemy-dive unit is already present on current `origin/master`:

- `9d8517bdeb1033a9e9dbecba2c4fd30b6480b313` — authored dive encounters
- `510a85288c1b86233175e94ce295253749febb46` — full browser dive gate
- `a9584d02a22a47e506bb42066673db1c826c2187` — FSRS soul binding to roster and dives

No duplicate combat implementation was added. This candidate adds a current-first-journey play-through harness and fresh evidence against the live product at the exact current product base.

## Requested behaviors proven

- Formation break-out: engine fixture PASS; recorded attack 1 moved from `(306.5, 76.5)` through 17 sampled positions to `(351.5, 188.19)`.
- Curved authored path: attack 1 and mirrored attack 2 show changing X/Y samples through the authored knee and vertical channel.
- Return to formation: attack 2 wrong answer enters `returning`; final state is exact anchor `(216.5, 76.5)`.
- Difficulty ramp: Cadet/Pilot/Ace/Commander placement table is live; True Play advances one tier and remains capped at Commander. The fixture measured easy at 45.02 required APM (54.5 ceiling) and true at 57.18 required APM (75 ceiling).
- 80s arcade feel: CRT cabinet, pixel HUD, starfield, shield bar, score, bright target reticle, impact bloom, note controls, and coaching banner are visible in the frame archive.

## Runnable checks

- `npx tsx scripts/retro-blaster/r3c-dive-fixture.ts` — PASS at `a9c1378339157b76eb94a78d58887a03905b81d5`.
- `node scripts/retro-blaster/t_73382fea-preview-playthrough.mjs https://resetbiology.com/pitch-defender/retro-2 data/retro-blaster-rework/runtime-logs/t_73382fea-prod-playthrough` — PASS.
- `npx tsc --noEmit` — repository baseline FAIL only in unrelated Prisma-generated types; no Retro Blaster errors.
- Targeted ESLint could not start because the shared installed ESLint 9.39.1 throws `preprocessConfig` before linting any file.
- `npm run test:retro-family` includes a PASS row for `R3c authored dives`; the aggregate remains FAIL on stale protected hashes and unrelated sibling drift introduced after the frozen Retro baselines.

## Recorded evidence

- Result: `data/retro-blaster-rework/runtime-logs/t_73382fea-prod-playthrough/result.json`
- Video: `data/retro-blaster-rework/runtime-logs/t_73382fea-prod-playthrough/video/ebad5a86594a59f39376288a531c5ed8.webm`
- Video SHA-256: `3AAD9E368E1A7D4D8D264DBA30F717995D30E7F0EFFB0245F5FF665E70E87A59`
- Frames: `01-formation.png` through `05-return-to-formation.png`
- Browser result: PASS, 640×360 logical canvas, 0px horizontal overflow, 0 page errors.

The final delivery receipt is written after the branch push and protected preview complete so it can cite the pushed candidate commit and preview URL without a self-referential commit hash.
