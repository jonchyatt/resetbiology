# Reset Biology Muscle-Preservation Engine — Research Summary

**Project:** Reset Biology `/workout` GODMODE v2  
**Domain:** Consumer workout guidance for people losing weight or using or tapering a GLP-1 medicine  
**Researched:** 2026-07-21  
**Overall confidence:** HIGH for the technical foundation and release controls; MEDIUM for product-specific clinical interpretation; LOW-to-MEDIUM for direct GLP-1 resistance-plus-protein outcome claims

## Executive Summary

This product should be built as a calm, beginner-first training instrument, not a collection of workout widgets. The true north is one safe action for today, logging that does not interrupt effort, and a trustworthy history that survives refreshes, weak connectivity, retries, multiple tabs, and accidental taps. The strongest architecture records each member action once as an immutable event, meaning a fact that is appended rather than silently edited, then derives the active session, readiness plan, calendar, points, and progress views from those accepted facts.

The research supports a meaningful upgrade to the original vision. Do not make a single Strength Score the emotional or clinical verdict. Lead with a **Muscle-Preservation Evidence Ladder**: comparable strength anchors, completed resistance exposure, functional checkpoints, protein coverage, and weight trend, each with provenance, recency, coverage, and an honest confidence explanation. A flat or rising strength trend while weight falls is encouraging and can be described as consistent with strength being maintained; it cannot prove that lost weight was fat or that skeletal muscle was preserved.

The main risks are hidden rather than visual: duplicated writes or points after replay, a production database index that exists in code but not in Atlas, timers that drift while a phone sleeps, sound that never played despite a perfect silent video, unsafe substitutions, readiness presented as medical clearance, health-adjacent telemetry, and production evidence captured from the wrong commit. The roadmap must therefore establish event integrity and production database constraints before advanced players, build accessibility and safety into each state machine, and hold every write, visual, temporal, audio, identity, and credential claim to the evidence type that can actually prove it.

### Conflict Disposition

| Research conflict | Disposition |
|---|---|
| The brief treats 13% weight loss / 3% muscle loss as a settled 2025 trial result | **UNRESOLVED AND RELEASE-BLOCKING:** no matching randomized outcome paper was verified. Use the conservative framing below and do not publish the numeric claim. |
| One track considered adding an offline database helper | **RESOLVED:** Dexie 4.2.1 is already installed. Reuse it in a dedicated workout database; add no package. |
| The Prisma schema may declare a unique event rule, but production Atlas state is unknown | **UNRESOLVED UNTIL LIVE INSPECTION:** the writer remains off until the real index is inspected, created if absent, and race-tested through the isolated relay. |
| Feature research puts safe movement metadata before readiness, while the draft slice order puts readiness before the full substitution graph | **RESOLVED CONDITIONALLY:** freeze the metadata contract and a reviewed minimum set in Phase 6. Phase 9 may trim dose without Phase 10, but any readiness-driven exercise replacement makes Phase 10 a prerequisite. |

## Key Findings

### Recommended Stack

Keep the current repository stack and add no npm packages. The architectural change matters more than a library purchase.

| Technology | Decision and plain-English role |
|---|---|
| Next.js App Router 15.5.7 and React 19.1.0 | Keep for the live page, guided players, and authenticated server routes. New routes remain under the live `app/` tree; `src/app/workout` is a dead shadow and must not be edited. |
| TypeScript 5.9.3 | Keep strict types, paired with small runtime validators because compile-time types do not validate network input. |
| Dexie 4.2.1 | Reuse the already-installed wrapper around the browser's IndexedDB database for a workout-specific durable outbox, meaning a local queue of actions waiting for server acknowledgement, and crash-resume snapshots. Do not add another offline package and do not copy the existing breath module's `localStorage` fallback. |
| Prisma 6.19.0 and MongoDB Atlas | Keep as canonical server storage. Use authenticated writes, short transactions, and a production compound unique index, meaning a database rule that permits a member's event identifier only once. |
| Auth0 Next.js SDK 4.13.2 | Derive member identity from the verified server session on every read and write; never trust an email or member identifier from the browser payload. |
| Tailwind 4.1.17, inline SVG, and CSS | Keep the portal visual language and build rings, paths, heatmaps, and the body diagram without a chart or animation dependency. Every visual also needs adjacent text and real numeric accessible labels. |
| Web Audio and Screen Wake Lock | Use the browser's native sound engine and optional keep-awake request as progressive enhancements, meaning the session remains safe and complete when either is unavailable. |
| Playwright 1.57.0 and axe 4.11.0 | Reuse the installed browser and accessibility tools. They do not replace commit-bound video, audible recordings, or canonical database read-back. |
| Cloudflare Workers AI REST endpoint | Reuse one centralized, server-only model boundary for the coach. Do not add another model client and never give the model direct write authority. |

The durable event path is the foundation: a stable event identifier is created once at the member's tap, stored locally with a payload fingerprint, replayed unchanged, authenticated on the server, and accepted at most once. The browser can optimistically show the set, but the server remains canonical. If IndexedDB is unavailable, degrade honestly to online-only logging and wait for server acknowledgement before saying the action is safely saved.

### Expected Features

**Must have — table stakes:**

- One assigned action for today, with full, reduced, express, and recovery as explicit escape paths rather than a library-first decision.
- Comparable target prefill that respects exercise variation, equipment, units, range of motion, and stale-history rules.
- One-tap set confirmation plus immediate Undo, implemented as a compensating event, meaning a new fact that reverses the tap without erasing history.
- Automatic rest timing based on an absolute deadline, so background tabs and phone sleep do not stretch the session.
- A crash- and interruption-safe local event journal with visible pending and reconciliation states.
- A finite session contract, current action, and next action that remain usable without sound.
- Honest partial completion with explicit outcomes: full, partial, express, recovery, safely stopped, or abandoned before start.
- Safe substitutions filtered by fixed safety exclusions, equipment, movement purpose, joint demands, skill, and preference—in that order.
- Clinically reviewed form cues, demonstrations, contraindications, citations, and stopping rules inside the session.
- Readiness that visibly changes or affirms the actual session and explains what changed and why; the score is a planning aid, not medical clearance.
- Phone-guided REHIT with eligibility and stop gates, cue preflight, text-and-color guidance, optional audio, and honest language that it cannot reproduce controlled smart-bike resistance.
- Local-day-correct history using the existing local-day authority for sessions, readiness, points, calendar, and continuity.
- Designed loading, empty, retry, reduced-motion, keyboard, screen-reader, muted-audio, and 390-pixel floor-and-phone states from the first player phase.

**Should have — differentiators:**

- The Muscle-Preservation Evidence Ladder, which combines exposure, comparable performance, function, protein support, and weight context without claiming tissue measurement.
- A Confidence Passport that shows data coverage, comparability, recency, rule version, missing inputs, and what would increase confidence.
- One Purpose-Preserving Rescue Ladder that compiles full, reduced, express, and recovery versions from the same assigned plan and records intended versus delivered dose.
- A Return Ramp that treats old loads as context rather than current targets after a reviewed gap.
- One optional last-working-set effort check, not a prompt after every set.
- Explainable progression suggestions that can be accepted, adjusted, or declined and never increase load invisibly.
- A reviewed movement-purpose swap graph, visible preference memory, and a safe no-alternative outcome.
- Estimated freshness and a just-right activity path that expose their inputs and show missing data as unknown, never zero.
- Standardized chair-stand and optional grip checkpoints described as functional screens, not diagnoses.
- A member-owned monthly proof receipt and privacy-minimized tap-cost telemetry that excludes loads, pain text, medication, readiness answers, and transcripts.

**Explicit anti-features and deferred work:**

- Reject opaque “muscle retained” verdicts, readiness as clearance, injury prediction, same-muscle-only swaps, hidden progression, stale target reuse, CAROL-equivalence, audio-only cues, punitive streaks, leaderboards, body comparison, medication-dose interpretation, model-generated injury advice, generated form media, silent reseeding, and raw health-content analytics.
- Defer wearable recovery scoring until provenance, missingness, and calibration are designed.
- Defer camera form scoring and generated anatomy media; the safety and review burden exceeds current value.
- Defer black-box adaptive programming; deterministic, inspectable rules fit the mission and current data volume better.
- Defer any numeric claim of muscle preserved until there is a valid measurement source.

### Unresolved Evidence Conflict: the 13% / 3% Claim

Do not publish “about 13% weight loss with only 3% muscle loss” as a 2025 randomized-trial result. The closest identified source is an uncontrolled conference report using bioelectrical impedance, with muscle change reported in kilograms and adherence analysis incomplete. A later retrospective program report also lacks a control group. The direct four-arm LEAN-PREP resistance-plus-protein trial is still a protocol, not an outcome paper.

The randomized SURMOUNT-1 body-composition substudy supports honesty about mixed tissue loss during tirzepatide treatment, but it did not test the proposed resistance-plus-protein package. Safe public framing is: **“Evidence supports resistance training during weight loss; the best GLP-1-specific resistance-and-protein strategy is still being studied.”** “Clinical evidence is settled,” “only 3% muscle loss,” and “Strength Score proves the loss was fat” are release-blocking claims.

### Architecture Approach

The architecture has one event truth and several rebuildable views. A pure player state machine creates stable events; a dedicated Dexie workout database stores the local outbox and crash snapshot; one foreground sync leader replays bounded batches; an authenticated Next.js route derives member identity; MongoDB enforces uniqueness; a short server transaction updates the canonical session, plan position, and existing points award together; fresh server reads drive readiness, calendar, evidence, and the shared nutrition/workout scorecard.

Major boundaries:

1. **Event contract and browser journal** — version narrow event payloads, persist locally in one transaction, partition by authenticated member, and never use the existing service worker as a second write queue.
2. **Canonical event service** — validate ownership and rules, accept each event at most once, return original receipts on legitimate replay, and reject identifier reuse with changed content.
3. **Protocol and readiness snapshots** — freeze the exact interpreted plan, citations, rules, and modification version used on that day so later changes never rewrite history.
4. **Plan compiler and guided state machines** — derive full, reduced, express, and recovery variants from one plan; strength and REHIT share a shell but keep separate legal transitions.
5. **Browser runtime adapters** — compute time from absolute deadlines; audio, visibility, and wake lock report capability but never decide clinical state.
6. **Vetted substitution service** — deterministic catalog filtering; fixed pain and stop branches run before preference or model output.
7. **Evidence and shared scorecard read model** — workout owns accepted training facts and estimated performance; nutrition owns protein, weight, units, and nutrition day semantics; both pages consume one versioned response and one shared component.
8. **Coach boundary** — fixed code safety classification comes before generation; the model returns educational text or a narrow proposal; only a fresh member confirmation emits a normal repeat-safe event.

### Non-Negotiable Production Index Gate

A Prisma schema declaration is intent, not proof. The current build runs `prisma generate`, which creates code but does not create MongoDB indexes; Prisma Migrate does not manage MongoDB. The event writer must remain off until the real Atlas database has been inspected and the unique member-plus-event rule has been created and verified through the named isolated database relay.

Required sequence: deploy tolerant readers and the disabled writer; inspect production shapes, duplicates, missing fields, and current indexes; create a separate event collection or a safe partial unique index; inspect the live definition and save a redacted receipt; race the same event from independent contexts; prove one event, one plan transition, one existing DailyAward record, and one 40-point result from a fresh canonical read; only then enable client replay. Never use a destructive production `db push` shortcut, print a credential, or treat a successful application build as the index receipt.

### Critical Holds

1. **Duplicate-effect hold** — no writer promotion without a stable client-created event identifier, database uniqueness, atomic completion/advance/points behavior, concurrent replay, lost-response replay, and fresh canonical read-back.
2. **Identity hold** — every route derives identity from the server session; queued events are isolated across logout and account changes; client identity fields have no authority.
3. **Timer and resume hold** — timed blocks use absolute deadlines; a large sleep or crash returns to a calm paused decision and never resumes directly into hard work.
4. **Audio-evidence hold** — a scheduling receipt plus an audible recording are both required. Silent video, console output, or visual timing cannot prove sound.
5. **Clinical-honesty hold** — no weakened citation, contraindication, stopping rule, tissue-certainty claim, medical-clearance language, generated injury advice, or smart-bike equivalence.
6. **Swap-safety hold** — broad substitutions stay off until a clinician-reviewed movement-purpose and joint-demand taxonomy exists; safety exclusions always outrank preference.
7. **Shared-truth hold** — the scorecard stays off until nutrition freezes a versioned contract and both pages pass parity fixtures, including missing data and local-day boundaries.
8. **Privacy hold** — telemetry accepts only allowlisted coarse fields; raw coach conversation storage stays off until purpose, consent, access, retention, provider terms, deletion, and legal review are ratified.
9. **Production-proof hold** — each artifact names the exact live commit, route, viewport, account context, and time; visual truth, temporal truth, audible truth, write truth, and credential truth each use their proper evidence.
10. **Cleanup and security hold** — production test cleanup must exactly restore its recorded baseline; the exposed database credential is not fixed until the new least-privilege path is live and a fresh isolated attempt with the revoked old credential fails.

## Implications for the Roadmap

Continue GSD numbering after the completed v1 milestone.

### Phase 6: Reconcile Production and Freeze Contracts

**Why first:** Every later feature depends on real production protocol shapes, routes, member identity, plan identity, and current database indexes.  
**Delivers:** Verification of the five polish fixes; tolerant reader fallbacks; live route and dead-shadow map; production shape/index inventory; immutable event, protocol snapshot, readiness snapshot, completion outcome, canonical exercise identity, and movement-purpose metadata contracts; shared header repair.  
**Exit gate:** REHIT plus two other protocols assign correctly on production; all shared-header consumers pass at 390 pixels; exact live commit is proven; no dead-shadow edit.

### Phase 7: Durable Logging Foundation

**Why now:** Prefill, one-tap confirmation, Undo, rest timing, swaps, points safety, and every later coach action need a repeat-safe event path.  
**Delivers:** Dedicated Dexie workout journal; pure reducer; member-partitioned foreground replay; comparable prefill; one-tap confirm; compensating Undo; deadline rest timer; basic swaps limited to a preapproved subset; coarse tap-cost telemetry contract.  
**Exit gate:** Production unique index inspected; simultaneous replay creates one canonical event; lost-response, offline/reload, storage-denial, multiple-tab, and logout/login isolation tests pass.

### Phase 8: Guided Strength and Honest REHIT Players

**Why now:** The players can trust the logging and replay foundation and can persist every transition before presenting it.  
**Delivers:** One canonical plan compiler; strength state machine; phone-guided REHIT state machine; finite contract; crash resume; cue preflight; absolute-deadline audio and visuals; optional wake lock; partial and safe-stop outcomes; one completion/advance/points transaction.  
**Exit gate:** Background/sleep matrix, frame citations, audible receipts, reduced-motion path, safe resume, and exactly-one completion/award race pass.

### Phase 9: Readiness Prescription

**Why now:** Readiness must modify a canonical, runnable plan rather than decorate a score.  
**Delivers:** Versioned original and modified plan snapshots; planned, reduced, and recovery tiers; What Changed / Why / What Next; rescue-ladder transitions; estimated freshness and an unknown-data-aware activity path.  
**Dependency reconciliation:** Phase 9 may precede the full substitution graph only if it modifies dose by reviewed set, effort, or interval rules and never invents or dynamically substitutes exercises. If readiness changes exercise selection, Phase 10 becomes a hard prerequisite.  
**Exit gate:** Boundary fixtures at 39, 40, 69, and 70; visible deterministic plan changes; unknown stays unknown; fixed symptoms and stopping rules always outrank a high score.

### Phase 10: Safety Substitution Intelligence

**Why separate:** The metadata shape is required in Phase 6, but authoring and clinically approving the complete movement-purpose, joint-position, equipment, complexity, and exclusion graph is its own safety workstream.  
**Delivers:** Reviewed substitution graph; deterministic ranking; preference memory; three-honest-tries behavior that never applies through pain; cycle detection; safe no-alternative outcome.  
**Exit gate:** Complete substitution matrix, fixed pain/referral branches, empty-result behavior, and clinical approval.

### Phase 11: Evidence and Adherence Views

**Why later:** Evidence needs stable comparable events, explicit session outcomes, reviewed exercise identity, and a frozen nutrition contract.  
**Delivers:** Evidence Ladder and Confidence Passport; weekly estimated strength trend with absolute and bodyweight-adjusted anchors; functional checkpoints; protocol journey; local-day calendar; Purpose-Preserving Rescue Ladder; adherence-neutral continuity; shared nutrition/workout scorecard; member-owned monthly receipt.  
**Exit gate:** Independent formula reproduction; bodyweight-denominator, missing-group, equipment-change, and outlier fixtures; nutrition parity; daylight-saving and travel suite; no tissue-certainty copy.

### Phase 12: Unified Workout Coach

**Why late:** The coach may propose only actions already representable, safety-filtered, and repeat-safe in the normal product.  
**Delivers:** One authenticated Cloudflare boundary; centralized swappable configuration; fixed pre-generation safety fences; bounded read-only grounding; narrow proposal contract; fresh confirm-before-action; database-backed rate limiting; graceful quota/provider failure.  
**Exit gate:** Cross-user, injection, fabricated identifier, stale proposal, provider failure, replay, and no-write-before-confirm tests pass. Raw transcripts remain off unless separately ratified.

### Phase 13: Craft, Privacy, Security, and Full Production Proof

**Why last:** This phase closes the whole system; it must audit rather than invent accessibility or safety that earlier phases skipped.  
**Delivers:** Final loading/empty/error polish; 390-pixel and 200-percent-zoom matrix; bounded telemetry retention and deletion; full blind dual-eye recordings with frame citations; exact baseline cleanup; least-privilege credential rotation and old-user revocation.  
**Exit gate:** Exact-commit evidence manifest; static, temporal, and audible receipts; zero console errors; pre/post test-account equality; live database-backed reads and writes on the new credential; a fresh fully redacted old-credential authentication failure.

### Phase-Ordering Rules

- Movement-purpose **contract and minimum reviewed metadata** belong in Phase 6 because prefill comparability, safe trimming, freshness, and later swaps depend on them. Full taxonomy authoring and broad substitution exposure remain Phase 10.
- The event foundation and live database uniqueness rule precede any feature that logs, advances, awards, resumes, or confirms a coach proposal.
- One plan compiler precedes separate players and readiness modes; full, reduced, express, and recovery are variants of one prescription, not four products.
- The evidence layer follows canonical comparable history; the coach follows every deterministic safety and confirm-before-write path it is allowed to use.
- Accessibility, reduced motion, privacy minimization, local-day correctness, clean-tree blind verification, Karpathy build/debug rows, and da Vinci deviation records are phase requirements, not final cleanup items.

## Requirements Implications

The requirements document should turn these conclusions into explicit acceptance criteria:

- Define the observable product outcome as safe, consistent completion plus a trustworthy multi-signal record—not measured muscle retention.
- Replace the single-score promise with the Evidence Ladder; a compact Strength Score may remain subordinate and estimated.
- Mark the 13%/3% headline and “clinical evidence is settled” language as forbidden until a qualifying primary outcome source exists.
- Specify one immutable event envelope, member-bound queue partition, payload fingerprint, production uniqueness rule, receipt classes, replay behavior, and compensating Undo.
- Specify exact outcome semantics for full, partial, express, recovery, safely stopped, and abandoned: plan advancement, points, weekly target, readiness load, and evidence inclusion must be independent decisions.
- Freeze the movement-purpose metadata contract early and make clinical approval a requirement before broad substitutions.
- Treat missing, not measured, unavailable, not applicable, and zero as distinct values across readiness, freshness, scorecard, and analytics.
- Define evidence receipts by claim type: screenshots for static truth, video for temporal truth, audio-bearing capture for audible truth, canonical read-back for write truth, server session plus ownership read for identity, and fresh failed authentication for credential revocation.
- Require feature switches and additive, reversible rollout for new writers, score views, coach actions, and any new award, with new awards defaulting off.
- Define test-data baseline manifests and exact cleanup as release-blocking requirements for every production write phase.

## Research Flags

**Needs deeper phase research or named owner approval:**

- **Phase 8:** clinician-approved REHIT eligibility, compatible equipment, progression, familiarization, stopping copy, and ownership of reviewed audio clips.
- **Phase 10:** complete movement-purpose and joint-demand taxonomy plus clinical review.
- **Phase 11:** exact strength-trend formula, minimum comparable coverage, wording, and nutrition contract owner.
- **Phase 12:** current Cloudflare data use, retention, geographic processing, contract settings, quota, and a repository-owned model golden set before any model change.
- **Phase 13:** counsel review of telemetry, coach retention, deletion, breach notification, state privacy duties, and actual HIPAA relationships; named Atlas and Vercel operators for credential rotation.

**Established patterns that do not need another broad research phase:**

- **Phases 6–7 technical foundation:** Next.js route handling, Auth0 server identity, Dexie transactions, absolute deadlines, MongoDB uniqueness, and additive rollout are covered by official documentation; production state still must be inspected.
- **Phase 8 browser mechanics:** visibility, wake lock, Web Audio, and reduced-motion behavior are well documented; device proof remains mandatory.
- **Phase 13 commit binding and credential containment:** Vercel deployment identifiers, server-only environment variables, least-privilege Atlas users, and revocation mechanics are documented; execution must remain redacted and operator-controlled.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Exact installed versions were inspected; browser, Next.js, Prisma, MongoDB, Auth0, and Cloudflare decisions rely mainly on official documentation. Production Atlas index state remains unverified until live inspection. |
| Features | MEDIUM-HIGH | Logging, timing, safety, and accessibility table stakes are strong product and engineering requirements. Exact retention effects and several numerical market claims are not established. |
| Architecture | HIGH | One immutable event path, server-owned identity, database uniqueness, versioned snapshots, deterministic plan compilation, and progressive enhancement directly address the identified failure modes. |
| Pitfalls | HIGH for engineering and security; MEDIUM for clinical interpretation | Timing, audio, replay, authentication, index, secret, and privacy mechanics are strongly documented. Product-specific exercise and readiness rules still require clinical approval. |
| Clinical claims | LOW-to-MEDIUM for direct GLP-1 outcomes | Broad resistance-training direction is supported. The claimed 13%/3% randomized result was not verified, and the direct resistance-plus-protein randomized trial has not reported outcomes. |

### Remaining Gaps

- Live production protocol shapes, Atlas indexes, transaction support, and deployment commit identity must be inspected; repository declarations cannot prove them.
- Supported mobile browser and real-device matrix needs ratification, especially iOS Safari versions.
- REHIT clinical content, substitution taxonomy, strength formula, and score wording need named clinician ownership.
- Nutrition must freeze one versioned scorecard contract and local-day semantics before cross-page implementation.
- Coach provider terms and health-adjacent privacy obligations must be refreshed at release time because provider pricing, terms, and laws can change.

## Source Confidence

**Primary and official sources — HIGH confidence:** MDN browser platform documentation; Next.js, Prisma, MongoDB, Auth0, Vercel, and Cloudflare official documentation; ACSM exercise screening guidance; LEAN-PREP trial protocol; randomized SURMOUNT-1 body-composition substudy; randomized liraglutide-plus-exercise maintenance follow-up; resistance-training meta-analyses; EWGSOP2 consensus; chair-stand validation; REHIT perceptual study; FDA prescribing information; OWASP security guidance; FTC and HHS regulatory guidance.

**Product-pattern sources — MEDIUM confidence for design conventions, not clinical effect:** Strong, Hevy, Fitbod, Gentler Streak, Caliber, and CAROL product documentation.

**Claim-audit source — LOW-to-MEDIUM confidence:** the ECO 2025 conference press report explains the origin and limitations of the 13% headline but is not a randomized peer-reviewed outcome paper and does not support a 3% muscle-loss claim.

---
*Research completed: 2026-07-21*  
*Ready for requirements and roadmap: yes, with the named clinical, database, privacy, and nutrition holds above*
