# Requirements: Muscle-Preservation Engine v2.0

**Defined:** 2026-07-21
**True north:** Help a member complete the next safe, progressive session with almost no decision burden, while preserving an honest and inspectable record of training, function, protein support, and weight context.

These requirements preserve the full GODMODE v2 brief and add the research-backed upgrades. They are product contracts, not permission to make medical claims.

## Foundation and Reconciliation

- [ ] **FND-01** — The production reader accepts both protocol shapes: phase length from `durationWeeks` or `weekStart`/`weekEnd`, and session name from `title` or `name`, without changing existing production documents.
- [ ] **FND-02** — Assigning REHIT produces named sessions and the correct six-week, three-session-per-week journey; at least two other protocols are verified through the same reader.
- [ ] **FND-03** — A member has one deterministic active assignment; duplicate or ambiguous active assignments are detected and resolved without fabricating history.
- [ ] **FND-04** — Assignment, plan, rule, and exercise identities are stable and versioned so past sessions retain the exact prescription the member received.
- [ ] **FND-05** — Exercise records have a canonical identity that distinguishes movement variant, equipment, and unit system before historical targets can be reused.
- [ ] **FND-06** — All member-day calculations reuse the shared local-day authority and preserve original timestamps across time zones and midnight.
- [ ] **FND-07** — All changes use the real `app/workout` route and its `src/components/Workout` implementation; the dead `src/app/workout` shadow is never edited.
- [ ] **FND-08** — The five inherited polish items are reconciled against the live site: schema tolerance, mobile header, dropdown contrast, tone/dead-code, and a REHIT title of at most two lines.
- [ ] **FND-09** — Existing feedback, points, readiness, and local-day primitives remain the single authorities; no alert or confirm dialog is introduced.
- [ ] **FND-10** — Data and schema changes are additive, staged, reversible, and safe for existing member records; no protocol reseed is required for compatibility.
- [ ] **FND-11** — The movement-purpose contract and minimum clinically reviewed exercise metadata are frozen before swaps, plan compression, freshness, or comparable performance use them.
- [ ] **FND-12** — The unsupported “13% weight loss / 3% muscle loss randomized trial” claim and other audited overstatements cannot ship; public copy reflects the actual evidence and uncertainty.

## Logging and Data Integrity

- [ ] **LOG-01** — Every set has a stable client-created event identity generated once and replayed unchanged; retrying the same event cannot duplicate sets, transitions, points, or awards.
- [ ] **LOG-02** — The server verifies authentication, ownership, payload shape, and the event identity; a database uniqueness rule returns the original receipt on replay.
- [x] **LOG-03** — The production uniqueness rule is inspected or created and verified through the isolated relay before the event writer is enabled.
- [ ] **LOG-04** — A comparable working set is prefilled from the last valid same-exercise, same-variant, same-equipment, normalized-unit observation; otherwise the reviewed protocol target is used.
- [ ] **LOG-05** — Stale or noncomparable history is shown only as context; a reviewed return ramp seeds a conservative target and explains why.
- [ ] **LOG-06** — An unchanged straight set is accepted with one tap, and changed weight or repetitions are adjustable without interrupting the session.
- [ ] **LOG-07** — The most recent accidental set confirmation has an immediate visible undo implemented as an auditable compensating event.
- [ ] **LOG-08** — Confirming a set starts the correct warm-up or working-set rest period, adjustable by 15 seconds in either direction, without blocking early logging.
- [ ] **LOG-09** — Rest timing uses an absolute deadline so backgrounding, sleep, and delayed rendering do not create timer drift.
- [ ] **LOG-10** — A local session journal survives refresh, crash, weak connectivity, and browser suspension; reconciliation cannot create duplicate work.
- [ ] **LOG-11** — If durable browser storage is unavailable, the interface states that it is online-only and never pretends an unacknowledged action was saved.
- [ ] **LOG-12** — The plate calculator handles bar weight, per-side plates, available inventory, and units with an accessible plain-language result.
- [ ] **LOG-13** — Each exercise exposes clinically reviewed demonstration media or illustrated cues, plain-language form notes, and the protocol stopping rules inside the session.
- [ ] **LOG-14** — One optional final-working-set effort check can inform a transparent progression suggestion; it is never required and never used as medical clearance.

## Guided Session Runtimes

- [ ] **RUN-01** — One canonical plan compiler produces full, reduced, express, and recovery variants from the same assigned plan while retaining both intended and delivered dose.
- [ ] **RUN-02** — A strength session opens into a guided full-screen flow with the current action, reviewed demonstration, prefilled target, and next action always clear.
- [ ] **RUN-03** — The session states its finite contract before starting: exercise count, estimated duration, hard-work duration when relevant, and approximate finish time.
- [ ] **RUN-04** — A member can move down the rescue ladder during a session without losing accepted sets or duplicating work, and the exact removed dose is stated plainly.
- [ ] **RUN-05** — Finishing early preserves completed work as a partial session and uses neutral copy; it never fabricates full completion.
- [ ] **RUN-06** — A session snapshot allows a deliberate resume or discard after reload, crash, or a significant clock jump; it never resumes directly into hard work.
- [ ] **RUN-07** — A best-effort screen wake lock is requested only during an active session and releases on pause, stop, completion, or page exit; unsupported browsers degrade honestly.
- [ ] **RUN-08** — The REHIT player names the compatible modality and acts as a manual timing coach; it never claims to control resistance, measure power, verify maximal effort, or equal dedicated smart-bike hardware.
- [ ] **RUN-09** — REHIT requires the reviewed eligibility, contraindication, and stopping gate plus a non-REHIT alternative before an all-out interval can start.
- [ ] **RUN-10** — REHIT presents the finite dose, then guides warm-up, countdown, two 20-second work blocks, recovery, and cooldown with an adherence-neutral saturated GO cue.
- [ ] **RUN-11** — The final three seconds of every work and recovery block have optional page-owned audio cues, while text and visual cues remain complete in silence.
- [ ] **RUN-12** — A cue preflight confirms sound, visibility, reduced-motion behavior, and the stop control before the first hard interval.
- [ ] **RUN-13** — Timer state is deadline-driven and handles backgrounding or sleep; a large timing discontinuity pauses for a safe member decision.
- [ ] **RUN-14** — Completion uses one tasteful pulse and the shared toast, advances the plan once, and awards exactly 40 workout points once through the existing daily-award authority.
- [ ] **RUN-15** — Tomorrow’s guidance acknowledges the accepted training load without implying that a consumer score measured recovery.

## Readiness and Protection

- [ ] **RDY-01** — Every readiness score has a same-day action: ready at 70 or above, reduced from 40 through 69, and recovery at 39 or below.
- [ ] **RDY-02** — Ready visibly preserves the assigned session; reduced visibly applies a deterministic protocol-appropriate dose change; recovery offers walking or mobility as today’s on-target session.
- [ ] **RDY-03** — The original plan, adjusted plan, exact difference, one-sentence reason, input snapshot, and rule version are retained and inspectable.
- [ ] **RDY-04** — Before substitution logic ships, readiness may trim dose but cannot silently replace an exercise; exercise replacement depends on the reviewed swap graph.
- [ ] **RDY-05** — Recovery guidance cannot be overridden into the full session by points, continuity, streak, or coach pressure; the member can always stop.
- [ ] **RDY-06** — The front/back muscle map is explicitly labeled as an estimate based on logged sets, movement contributions, elapsed time, and readiness context; each region explains its evidence and missing data.
- [ ] **RDY-07** — The activity path compares planned and observed load inside a just-right band, puts planned rest inside the band, overlays completed sessions and adjustments, and shows unknown data as unknown rather than zero.
- [ ] **RDY-08** — Readiness is described as a plan-adjustment tool, not medical clearance, injury prediction, or proof of improved fitness.

## Swaps and Exercise Choice

- [ ] **SWAP-01** — Every eligible exercise offers two or three reviewed alternatives filtered by movement purpose, program role, equipment, skill demand, readiness, joint demands, and contraindications.
- [ ] **SWAP-02** — A same-muscle match alone is insufficient; the chosen alternative must preserve the session’s purpose or explicitly state the changed purpose.
- [ ] **SWAP-03** — “No equipment,” “not for me,” and nonclinical preference reasons are stored as inspectable, resettable preference events for future choices.
- [ ] **SWAP-04** — Pain or injury language never enters preference ranking; it triggers a fixed stop-and-professional-referral path rather than generated advice.
- [ ] **SWAP-05** — A swap updates the current and next actions without duplicating accepted work and retains the original and replacement exercise identities in history.
- [ ] **SWAP-06** — New-movement copy encourages a fair trial without blaming the member, while the swap remains available at all times.

## Evidence, Progress, and Shared Truth

- [ ] **EVD-01** — The primary muscle-preservation view is an evidence ladder showing training exposure, comparable performance anchors, functional checkpoints, protein coverage, and weight context.
- [ ] **EVD-02** — A compact strength trend may summarize comparable working sets across major movement patterns, but it is labeled an estimate and never says it proves tissue composition.
- [ ] **EVD-03** — Every derived score or insight includes a confidence passport: supporting inputs, recency, coverage, comparability, rule version, missing data, and what would improve confidence.
- [ ] **EVD-04** — Performance comparisons normalize body weight and units where justified while preserving raw observations and explaining confounders such as technique, equipment, and exercise familiarity.
- [ ] **EVD-05** — The optional 30-second chair-stand checkpoint stores standardized setup and trend; it is labeled a screen, not a diagnosis, with population limits stated.
- [ ] **EVD-06** — Optional grip-strength entry stores device, hand, and units; it is labeled a trend signal and explicitly not a lower-body-strength measure.
- [ ] **EVD-07** — Workout owns training facts and performance estimates; nutrition owns protein coverage, weight trend, units, and nutrition-day semantics.
- [ ] **EVD-08** — One versioned shared response contract and one shared component render the monthly muscle scorecard on workout and nutrition surfaces without copying business logic.
- [ ] **EVD-09** — The monthly member-owned receipt distinguishes observations from inferences, links evidence one tap away, and exports or shares only on explicit member action.
- [ ] **EVD-10** — Missing workouts, protein days, equipment changes, or external activity remain unknown rather than becoming zero or false precision.

## Journey and Adherence

- [ ] **HAB-01** — The assigned protocol shows week, current session, total sessions, and progress as a ring or timeline on the card and page header.
- [ ] **HAB-02** — A local-day-correct month calendar uses the shared calendar idiom and drills into accepted session details, readiness, and awarded points.
- [ ] **HAB-03** — Full, reduced, express, and recovery completions count toward the weekly target; planned rest days never break continuity.
- [ ] **HAB-04** — Two bounded misses are forgiven silently each week, while rate framing, longest-run record, and lifetime completed-session totals preserve intact history.
- [ ] **HAB-05** — Seven-, 30-, and 100-session milestones use member-initiated private share cards; there are no leaderboards or body comparisons.
- [ ] **HAB-06** — An always-visible, protocol-appropriate 7-to-15-minute express variant preserves the session purpose and states the reduced dose.
- [ ] **HAB-07** — Break or vacation mode pauses continuity without judgment, and all copy avoids failure, shame, loss-aversion, or “don’t lose it” pressure.
- [ ] **HAB-08** — A deterministic insight states weekly progress in neutral language and never treats raw session count as proof of a clinical outcome.

## Workout Coach

- [ ] **COACH-01** — The existing agent family is inventoried before integration; workout uses the same approved personality doctrine and one swappable model-and-endpoint configuration rather than introducing a competing coach.
- [ ] **COACH-02** — The workout dock is grounded only in the member’s authorized training log, readiness history, assigned protocol, and reviewed protocol evidence.
- [ ] **COACH-03** — Injury or pain signals, medication or dosing questions, and eating-disorder or compulsive-exercise signals are intercepted in code by fixed reviewed templates before any model call.
- [ ] **COACH-04** — The model can propose only a narrow structured log, mode change, or reviewed swap; no proposal changes member data until the member sees and confirms it.
- [ ] **COACH-05** — Confirmed coach actions enter the same repeat-safe event path as direct member actions and receive the same ownership and uniqueness checks.
- [ ] **COACH-06** — Educational-not-medical-advice text remains visible in the coach chrome, with graceful failure, retry, and rate-limit states.
- [ ] **COACH-07** — Quality-assurance logging defaults to structured safety and reliability facts; raw transcripts remain off unless separately ratified with retention and access rules.
- [ ] **COACH-08** — Generated anatomy, form instruction, injury assessment, medication advice, and hidden programming changes are prohibited.

## Craft, Accessibility, and Privacy-Safe Learning

- [ ] **UIA-01** — Loading skeletons preserve layout; empty states warmly direct a new member to the protocol library; every failure state offers inline retry and never leaves a blank page.
- [ ] **UIA-02** — At 390 pixels there is zero horizontal scroll, the primary action is thumb-reachable, the timer is legible at arm’s length, and actionable targets are at least 44 by 44 pixels where practical.
- [ ] **UIA-03** — Keyboard navigation, meaningful focus indicators, screen-reader announcements, and numeric accessible labels cover players, timers, rings, maps, charts, dialogs, and forms.
- [ ] **UIA-04** — Color is never the only signal; GO combines text, color, and optional audio, and all animations have a separately verified reduced-motion form.
- [ ] **UIA-05** — Portal glass surfaces, dark gray gradient, teal primary, amber secondary, and shared nutrition/workout patterns form one coherent product without weakening contrast.
- [ ] **UIA-06** — Reviewed media is bandwidth-tolerant, captioned or equivalently described, version-bound to the exercise, and never generated without clinical review.
- [ ] **TEL-01** — Private product telemetry measures taps to first accepted set, taps per unchanged set, adjustment rate, timer skips, interruption/resume, swap continuation, and mode outcomes.
- [ ] **TEL-02** — Telemetry excludes weight and repetition values, pain text, readiness answers, medication data, health notes, raw coach transcripts, and exercise names.
- [ ] **TEL-03** — Tap-count budgets are measured on the real production interaction path and reported per phase rather than inferred from source code.

## Security and Operational Proof

- [ ] **SEC-01** — The exposed production database credential is replaced in the source file by an environment-variable pointer without reproducing the secret in reports or artifacts.
- [ ] **SEC-02** — A new Atlas credential is created, the production environment is updated, and the live site is verified on the new credential before revocation.
- [ ] **SEC-03** — The old credential is revoked and a fresh authentication attempt with it fails; a commit message or removed plaintext is not accepted as revocation proof.
- [ ] **SEC-04** — No secret appears in source, generated artifacts, browser captures, logs, diffs, or final reports.
- [ ] **SEC-05** — Security work has a single named owner and isolated relay; no second worker touches credential state concurrently.
- [ ] **OPS-01** — Every delegation ticket has seven sections: objective, context, allowed write set, forbidden work, acceptance criteria, verification commands, and return format.
- [ ] **OPS-02** — Every implementation slice begins from a clean committed tree and ends in its own clean commit; overlapping uncommitted work is never reused as proof.
- [ ] **OPS-03** — A blind verifier receives only the original task, exact diff, and acceptance criteria, never the builder’s reasoning, and returns a pass or rejection from a clean tree.
- [ ] **OPS-04** — Write-path verification uses only an isolated relay with run-scoped identities and records canonical server readback, ownership, and cleanup.
- [ ] **OPS-05** — Each visual gate has two blind verdicts from one commit-bound recording: Eye 1 checks static text, values, and layout; Eye 2 checks timing, transitions, and transient behavior.
- [ ] **OPS-06** — Visual verdicts cite exact frames or timecodes; audio behavior has an audio-bearing receipt because a silent browser video cannot prove cues.
- [ ] **OPS-07** — Each phase runs a strict production build, pushes only by `git push origin master`, waits for the matching live commit, verifies the real site with the named test account, and cleans only data created by that run.
- [ ] **OPS-08** — Each phase report includes commit hashes, plain-language changes, tap measurements, failures, and both Karpathy rows: build hypothesis/change/check/result/lesson and debug failing-case/cause/fix/post-check/next-threshold.
- [ ] **OPS-09** — Every deviation or creative upgrade is recorded with its reason under the da Vinci clause; no scope change is silent.
- [ ] **OPS-10** — The final production run verifies all ten end-to-end scenarios in the master brief, checks zero console errors, and retains commit-bound dual-eye receipts.

## Deferred Beyond v2.0

- Wearable-derived recovery scoring until provenance, missingness, access, and calibration have their own reviewed design.
- Camera-based form scoring or generated anatomical demonstrations.
- Black-box adaptive programming or automatic hidden load increases.
- Any numeric claim of muscle tissue preserved without a valid measurement source.
- Any new clinical protocol content that has not passed the protocol-library clinical review pipeline.

## Explicitly Rejected

- Readiness presented as medical clearance or injury prediction.
- Same-muscle-only substitutions, universal REHIT suitability, or CAROL-equivalence without controlled hardware.
- Punitive streaks, broken-ring alarms, leaderboards, body comparison, or points for training through recovery guidance.
- Medication-dose-driven workout changes, generated injury advice, or raw sensitive analytics.
- Silent data repair, destructive reseeding, or a missing observation represented as zero.

## Traceability

Roadmap phase ownership is populated and checked by the roadmapper. No requirement is complete until its phase verification and production proof both pass.

| Requirement | Planned phase | Status |
|---|---:|---|
| FND-01 | Phase 6 | Not started |
| FND-02 | Phase 6 | Not started |
| FND-03 | Phase 6 | Not started |
| FND-04 | Phase 6 | Not started |
| FND-05 | Phase 6 | Not started |
| FND-06 | Phase 6 | Not started |
| FND-07 | Phase 6 | Not started |
| FND-08 | Phase 6 | Not started |
| FND-09 | Phase 6 | Not started |
| FND-10 | Phase 6 | Not started |
| FND-11 | Phase 6 | Not started |
| FND-12 | Phase 6 | Not started |
| LOG-01 | Phase 7 | Not started |
| LOG-02 | Phase 7 | Not started |
| LOG-03 | Phase 7 | Complete — 07-03B/07-03B1 production proof PASS |
| LOG-04 | Phase 7 | Not started |
| LOG-05 | Phase 7 | Not started |
| LOG-06 | Phase 7 | Not started |
| LOG-07 | Phase 7 | Not started |
| LOG-08 | Phase 7 | Not started |
| LOG-09 | Phase 7 | Not started |
| LOG-10 | Phase 7 | Not started |
| LOG-11 | Phase 7 | Not started |
| LOG-12 | Phase 7 | Not started |
| LOG-13 | Phase 7 | Not started |
| LOG-14 | Phase 7 | Not started |
| RUN-01 | Phase 8 | Not started |
| RUN-02 | Phase 8 | Not started |
| RUN-03 | Phase 8 | Not started |
| RUN-04 | Phase 8 | Not started |
| RUN-05 | Phase 8 | Not started |
| RUN-06 | Phase 8 | Not started |
| RUN-07 | Phase 8 | Not started |
| RUN-08 | Phase 8 | Not started |
| RUN-09 | Phase 8 | Not started |
| RUN-10 | Phase 8 | Not started |
| RUN-11 | Phase 8 | Not started |
| RUN-12 | Phase 8 | Not started |
| RUN-13 | Phase 8 | Not started |
| RUN-14 | Phase 8 | Not started |
| RUN-15 | Phase 8 | Not started |
| RDY-01 | Phase 9 | Not started |
| RDY-02 | Phase 9 | Not started |
| RDY-03 | Phase 9 | Not started |
| RDY-04 | Phase 9 | Not started |
| RDY-05 | Phase 9 | Not started |
| RDY-06 | Phase 9 | Not started |
| RDY-07 | Phase 9 | Not started |
| RDY-08 | Phase 9 | Not started |
| SWAP-01 | Phase 10 | Not started |
| SWAP-02 | Phase 10 | Not started |
| SWAP-03 | Phase 10 | Not started |
| SWAP-04 | Phase 10 | Not started |
| SWAP-05 | Phase 10 | Not started |
| SWAP-06 | Phase 10 | Not started |
| EVD-01 | Phase 11 | Not started |
| EVD-02 | Phase 11 | Not started |
| EVD-03 | Phase 11 | Not started |
| EVD-04 | Phase 11 | Not started |
| EVD-05 | Phase 11 | Not started |
| EVD-06 | Phase 11 | Not started |
| EVD-07 | Phase 11 | Not started |
| EVD-08 | Phase 11 | Not started |
| EVD-09 | Phase 11 | Not started |
| EVD-10 | Phase 11 | Not started |
| HAB-01 | Phase 11 | Not started |
| HAB-02 | Phase 11 | Not started |
| HAB-03 | Phase 11 | Not started |
| HAB-04 | Phase 11 | Not started |
| HAB-05 | Phase 11 | Not started |
| HAB-06 | Phase 11 | Not started |
| HAB-07 | Phase 11 | Not started |
| HAB-08 | Phase 11 | Not started |
| COACH-01 | Phase 12 | Not started |
| COACH-02 | Phase 12 | Not started |
| COACH-03 | Phase 12 | Not started |
| COACH-04 | Phase 12 | Not started |
| COACH-05 | Phase 12 | Not started |
| COACH-06 | Phase 12 | Not started |
| COACH-07 | Phase 12 | Not started |
| COACH-08 | Phase 12 | Not started |
| UIA-01 | Phase 13 | Not started |
| UIA-02 | Phase 13 | Not started |
| UIA-03 | Phase 13 | Not started |
| UIA-04 | Phase 13 | Not started |
| UIA-05 | Phase 13 | Not started |
| UIA-06 | Phase 13 | Not started |
| TEL-01 | Phase 13 | Not started |
| TEL-02 | Phase 13 | Not started |
| TEL-03 | Phase 13 | Not started |
| SEC-01 | Phase 13 | Not started |
| SEC-02 | Phase 13 | Not started |
| SEC-03 | Phase 13 | Not started |
| SEC-04 | Phase 13 | Not started |
| SEC-05 | Phase 13 | Not started |
| OPS-01 | Phase 13 | Not started |
| OPS-02 | Phase 13 | Not started |
| OPS-03 | Phase 13 | Not started |
| OPS-04 | Phase 13 | Not started |
| OPS-05 | Phase 13 | Not started |
| OPS-06 | Phase 13 | Not started |
| OPS-07 | Phase 13 | Not started |
| OPS-08 | Phase 13 | Not started |
| OPS-09 | Phase 13 | Not started |
| OPS-10 | Phase 13 | Not started |

---
*Requirements defined: 2026-07-21*
*Last updated: 2026-07-21 after state-of-the-art research and foreman classification*
