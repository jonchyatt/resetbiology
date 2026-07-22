# Architecture: Reset Biology Muscle-Preservation Engine

**Project:** Reset Biology `/workout` GODMODE v2
**Researched:** 2026-07-21
**Architecture posture:** One event truth, deterministic clinical rules, progressive browser enhancement, and no new packages

## True-North Architecture

The product should behave like a calm training instrument, not a collection of widgets. A member action becomes one durable event; the server accepts that event at most once; deterministic projectors turn accepted events into the current session, readiness plan, scorecard, calendar, and points; the interface then explains that truth in plain language.

```text
Member tap
   |
   v
Guided player reducer ──> immediate local view
   |
   v
Dexie outbox ───────────> authenticated batch route
(durable browser queue)       |
                              v
                      validate identity + contract
                              |
                              v
                 MongoDB unique event boundary
                              |
                              v
                 atomic canonical projections
                    /       |        \
                   v        v         v
            session/readiness  points  progress views
```

**Event** means an immutable fact such as “set 2 was confirmed,” not an editable copy of the whole workout. **Projection** means a current view calculated from accepted facts, such as “session 8 of 18.” The event is the durable truth; a projection may be rebuilt.

## Zero-New-Package Correction

Do not add an IndexedDB library. Dexie 4.2.1—the already-installed wrapper around the browser's IndexedDB database—is present and already used elsewhere in the repository. Reuse it for the workout outbox and crash snapshot.

This milestone adds no npm packages:

- Dexie handles durable browser events and transactions.
- React handles active player state; no Redux, Zustand, or other global state library.
- SVG and CSS handle rings, heatmaps, and body diagrams.
- Web Audio handles cues.
- Screen Wake Lock requests keep the display awake when supported.
- Next.js route handlers, Prisma, and MongoDB handle authenticated writes and server truth.
- The existing Cloudflare Workers AI REST pattern handles the coach; no second AI client.

Do not use the existing breath database or its `localStorage` fallback. Workout events need their own versioned Dexie database, and a browser without IndexedDB must degrade honestly to online-only acknowledgement.

## Module Seams

| Module | Plain-English responsibility | May depend on | Must not do |
|---|---|---|---|
| `src/lib/workout/events/` — workout event contracts | Defines allowed event kinds, versions, payload limits, and pure validation | Local-day helper and shared primitive types | Read databases, award points, or render the interface |
| `src/lib/workout/clientDb.ts` — browser workout database | Stores the durable Dexie outbox and replaceable crash snapshots | Dexie, which is already installed | Become server truth or fall back to `localStorage` |
| `src/lib/workout/reducer.ts` — pure player state reducer | Turns ordered events and snapshots into the active local view | Event contracts and protocol snapshots | Perform network, audio, wake-lock, or database work |
| `src/lib/workout/sync.ts` — foreground replay coordinator | Sends bounded event batches and reconciles canonical receipts | Client database and authenticated event route | Decide points, trust client identity, or create a second service-worker queue |
| `app/api/workout/events/route.ts` — authenticated event boundary | Derives member identity, validates events, deduplicates, and returns canonical receipts | Auth0 server session, Prisma transaction, event service | Trust `userId`, readiness score, points, or elapsed time from the browser |
| `src/lib/workout/eventService.ts` — canonical write service | Applies accepted events once and updates session projections atomically | Prisma, points helper, protocol/readiness rule services | Import React or browser APIs |
| `src/lib/workout/protocolSnapshot.ts` — assigned-plan contract | Freezes the protocol version and exact session prescription used by an assignment | Existing tolerant protocol reader | Mutate seeded protocol documents or author new clinical content |
| `src/lib/workout/readinessPrescription.ts` — deterministic readiness rules | Produces planned, reduced, or recovery variants with a reason and rule version | Existing readiness logic and protocol snapshot | Claim medical clearance or accept generated rules |
| `src/lib/workout/sessionMachine.ts` — guided-session state machine | Defines legal strength and REHIT transitions, resume behavior, and completion outcome | Pure event and snapshot types | Read clocks directly inside transition rules or write the database |
| `src/lib/workout/runtime/` — browser session adapters | Supplies clock, audio, visibility, and wake-lock behavior to the state machine | Browser-native APIs | Decide clinical state or block core use when an enhancement fails |
| `src/lib/workout/swaps/` — vetted substitution service | Filters approved alternatives by safety, purpose, equipment, and preference | Exercise catalog and fixed safety classifier | Ask the language model to invent an exercise |
| `src/lib/muscleScorecard/` — shared scorecard contract | Defines the versioned read model used by nutrition and workout | Canonical nutrition and workout readers | Duplicate protein, weight, or local-day logic |
| `app/api/muscle-scorecard/route.ts` — private scorecard response | Returns one authenticated, non-cached cross-page truth | Scorecard service and Auth0 session | Let workout mutate nutrition records |
| `src/lib/coach/` — sole coach orchestration boundary | Applies code safety fences, gathers bounded grounding, calls the model, and emits a proposal | Auth0-derived member, Cloudflare configuration, read-only context | Write a log, assign a swap, or give generated injury/dosing advice |
| `app/api/coach/workout/route.ts` — workout coach endpoint | Authenticates, rate-limits, and returns answer plus proposed intent | Coach boundary | Accept client identity or execute the proposal |
| `src/components/Workout/` — live workout interface | Renders assigned action, players, readiness, evidence, progress, and coach dock | Typed services and existing shared UI primitives | Recalculate server truth or bypass the event path |

The live route remains `app/workout/page.tsx` to `WorkoutTracker.tsx`. The `src/app/workout` directory is a dead shadow and receives no edits.

## Canonical Data Contracts

### Workout event

Every member action receives an `eventId`, meaning a stable random identifier created once with the browser's `crypto.randomUUID()` function. It keeps the same identifier on retry.

Required event envelope:

- contract version;
- event identifier;
- assignment, session, exercise, and set identifiers when relevant;
- event kind and a narrow validated payload;
- client-created time and local-day key from `src/lib/localDay.ts`;
- protocol snapshot version and readiness prescription version;
- payload digest, meaning a stable fingerprint used to detect an identifier reused with different content.

The client never supplies authoritative member identity, points, server completion time, or readiness classification.

### Local outbox and runtime snapshot

The workout Dexie database has two essential tables:

1. `outboxEvents`, the immutable pending/acknowledged event journal keyed by event identifier.
2. `runtimeSnapshots`, the replaceable fast-resume state keyed by assignment plus session.

One Dexie transaction stores the event and updates the local snapshot. A **transaction** means both changes succeed together or neither does. Outbox states are pending, sending, acknowledged, permanently rejected, or retryable, with attempt count and next retry time.

The runtime snapshot contains active block, exercise/set cursor, absolute deadline, completed local event identifiers, audio-cue ledger, and state-machine version. It is a convenience, not a second history; the reducer can rebuild it from events plus the assigned protocol snapshot.

### Protocol assignment snapshot

Assignment stores an immutable snapshot of the protocol interpretation used that day:

- source protocol identifier and content version;
- phase and session name resolved through the reader-side fallback for old `title`/`name` and phase shapes;
- total weeks, planned frequency, and derived total session count;
- prescribed exercises, sets, repetitions, rest, equipment, form cues, citations, contraindications, and stopping rules;
- snapshot creation time and rule version.

Protocol-library documents remain the content source. A later seed edit cannot silently rewrite a session already performed, and this experience build does not author new clinical protocols.

### Readiness prescription snapshot

Each readiness result stores inputs and provenance, computed score, tier, rule version, original session, modified session, and one-sentence explanation. The three tiers are deterministic: 70 or higher planned, 40–69 reduced, and 39 or lower recovery, while fixed symptom and contraindication rules always win.

The snapshot records exactly which set, effort cap, interval, or recovery action changed. “Unknown” remains unknown. The score is a planning aid, not a clearance or injury forecast.

### Completion outcome

Do not overload one Boolean. Completion records one explicit outcome: full, partial, express, recovery, safely stopped, or abandoned before start. Separate rules determine plan advancement, points, weekly adherence, Strength Score inclusion, and readiness load.

## End-to-End Event Flow

1. The assigned protocol and latest readiness prescription load from the authenticated server.
2. The member starts a session; the browser stores a versioned runtime snapshot before entering the first timed block.
3. A one-tap set confirmation creates one event identifier, updates the local reducer, and commits event plus snapshot in one Dexie transaction.
4. The foreground sync leader obtains a Web Lock—a same-browser coordination lock—to reduce duplicate local senders, then submits a bounded batch.
5. The route derives identity from the Auth0 server session and validates contract version, ownership, snapshot references, numeric bounds, event kind, and payload size.
6. The server inserts under a compound unique rule for member plus event identifier. The same identifier and same digest returns the original receipt; the same identifier with different content returns conflict.
7. The server transaction applies the canonical session projection. Completion also advances the plan and calls the existing points function inside the same all-or-nothing operation.
8. The response classifies each event as created, already accepted, permanently rejected, or retryable and returns the canonical projection version.
9. The browser marks acknowledged events, reconciles its reducer to the canonical response, and exposes immediate Undo as a compensating event, meaning a new fact that reverses an earlier fact rather than deleting history.
10. Fresh server reads drive calendar, journey, readiness history, evidence views, and the shared scorecard.

The Web Lock reduces same-browser collisions but never replaces the production unique index. Two devices, separate browsers, and delayed retries remain safe because the server owns idempotency, meaning repeat attempts have no second effect.

## Production Unique-Index Gate

The event engine stays behind a disabled feature switch until production proves the compound unique index on member plus event identifier.

Required gate sequence:

1. Deploy readers and models that tolerate the absence of new documents and fields.
2. Through the named isolated database relay, inspect duplicates and missing values without exposing credentials.
3. Create the intended unique index in Atlas. Use a partial rule if legacy documents without identifiers share the collection; a separate new event collection avoids that ambiguity.
4. Inspect the live index definition and archive a redacted receipt.
5. Race the same event from two independent browser contexts and the isolated relay.
6. Prove one event, one completion, one plan transition, one `DailyAward`, and one 40-point ledger result from a fresh canonical read.
7. Only then enable event writes for production.

A Prisma schema declaration is not proof the production index exists. MongoDB has no Prisma Migrate history, so every index change needs a checked-in runbook, live receipt, rollback, and phase report.

## Guided Player Architecture

### State machine

Strength and REHIT players share a pure state-machine shell but have separate legal block graphs. The strength graph moves through exercise, set, rest, swap, finish-early, and complete. The REHIT graph moves through preflight, warm-up, countdown, sprint, recovery, second countdown, second sprint, cooldown, safely stopped, and complete.

Every transition emits an event before the visible state advances. Crash resume reconciles the saved state against accepted and pending events. A large elapsed-time jump never resumes directly into hard work; it enters a calm paused decision.

### Deadline timers

Timer truth is an absolute `deadlineEpochMs`, meaning the wall-clock millisecond when the block ends, plus start time, planned duration, block identifier, and version. The screen derives remaining time from deadline minus current time. Browser callbacks repaint the value but do not define elapsed time.

Visibility return, device wake, and audio resume all reconcile against the deadline. The player may skip expired visual frames, but it never extends a sprint because a callback arrived late.

### Audio adapter

The explicit Start tap creates or resumes one AudioContext, meaning the browser's native sound engine. Audio cues use the same block deadlines as the visual player and count the final three seconds of every work and rest block.

The adapter tracks scheduled and played cue identifiers so resume never releases a burst of stale sound. Suspended, muted, interrupted, or unavailable audio produces a visible calm fallback. Audio is always paired with text and visual state.

An audio-bearing recording or synchronized waveform proves sound. A silent video proves only the visual sequence.

### Wake-lock adapter

The Start tap requests a screen wake lock when supported. The adapter listens for release and may reacquire after visibility returns while the session is active. Rejection or revocation never changes timer truth or blocks the workout. Pause, finish, and unmount release the lock.

## Swap Safety Architecture

The substitution service is deterministic and data-driven. It filters in this order:

1. Fixed symptom and contraindication exclusions.
2. Equipment and training environment.
3. Movement purpose and protocol intent.
4. Joint position, impact, stability, complexity, and loaded-range constraints.
5. Member preference and the three-honest-tries rule.

Each exercise needs a vetted movement-purpose record rather than only a muscle tag. “Joint discomfort” first passes through a fixed safety classifier. Sharp pain, sudden loss of function, inability to bear weight, or other clinician-approved stop signals return a stop-and-referral template, not alternatives.

The service returns two or three catalog identifiers with plain reasons or a safe no-alternative result. The coach may explain these results but cannot create, reorder above safety, or write a swap. Confirmation uses the ordinary repeat-safe event route.

## Read Models and Ownership

### Workout-owned views

Workout owns session state, protocol journey, completion calendar, readiness prescriptions, freshness estimates, movement substitutions, functional checkpoints, and weekly Strength Score snapshots. The **Strength Score** is explicitly an estimated performance trend with formula version, comparable-movement coverage, absolute anchors, bodyweight denominator, and confidence. It never claims direct muscle mass.

Freshness and activity-path views are pure explainable projections of accepted set events, days since trained, readiness snapshots, and planned load. SVG color is paired with text, real-number accessible labels, and an HTML summary.

### Nutrition-owned shared scorecard

Nutrition owns protein hit-rate, trend weight, goal semantics, unit conversion, and nutrition local-day interpretation. One versioned scorecard service reads canonical nutrition and workout inputs and returns the same serialized response to both pages.

Workout receives a private, non-cached, read-only response. It neither copies nutrition facts into workout records nor recalculates them. The shared component is released only after the nutrition contract is frozen and parity fixtures prove both routes render the same values.

## Coach Boundary

There is one server-only coach orchestrator. It performs these steps in order:

1. Authenticate from the server session and rate-limit the member.
2. Run fixed code safety classifiers before any model call.
3. Gather a bounded read-only snapshot of accepted training events, latest readiness prescription, assigned protocol, and cited evidence cards.
4. Build the BioCoach personality from one imported doctrine constant and central model configuration.
5. Call the existing Cloudflare Workers AI REST endpoint with timeout and token limits.
6. Validate the response into either educational text or a narrow proposed intent.
7. Return the proposal without executing it.
8. On a fresh member confirmation, validate again against current state and create a normal repeat-safe event.

Injury, medication/dosing, eating-disorder, and compulsive-exercise signals return fixed templates outside generation. The model has no database credential, generic write tool, or authority to invent exercise identifiers. Provider errors become an opaque retry message, not leaked upstream text.

Structured quality telemetry may record safety category, template identifier, model, latency, grounding identifiers, proposal kind, and confirmed outcome. Raw health-adjacent conversations remain off until retention, consent, access, provider terms, and deletion are ratified.

## Schema Rollout and Rollback

### Forward rollout

1. **Inventory:** Record current production shapes, indexes, assignment variants, and baseline counts.
2. **Compatible readers:** Accept old and new fields, including existing protocol name/title and phase fallbacks.
3. **Optional additions:** Add optional versioned fields and new collections; never make an old record invalid.
4. **Production indexes:** Preflight, create through the isolated relay, and inspect live definitions.
5. **Shadow calculation:** Compute new projections without showing or writing member-facing conclusions; compare against fixtures and canonical history.
6. **Flagged writers:** Enable the new event writer for the test account only, then a bounded cohort if ratified.
7. **Read cutover:** Make new projections visible after server, accessibility, and production visual gates pass.
8. **Deferred cleanup:** Remove compatibility logic only in a later milestone after old records are measured at zero or intentionally retained.

### Rollback

- Turn off the new writer and player feature switches first.
- Keep tolerant readers so already-created events remain readable.
- Preserve immutable events; do not destroy or fabricate member history.
- Rebuild old projections from the last compatible checkpoint if needed.
- Do not drop the unique event index during an application rollback; it protects against replay.
- Roll back optional UI and projection readers independently of the event ledger.
- A bad backfill is reversed by its recorded compensating plan, not an account-wide delete.
- Every phase records the previous commit, feature-switch state, new schema/index receipts, and exact recovery action.

## Dependency-Ordered Release Slices

These slices continue GSD numbering after the completed v1 milestone. Each slice must build clean, deploy by `git push origin master`, bind proof to the exact live commit, restore the test account baseline, and finish its Karpathy row before the next slice opens.

| Slice | Deliverable | Depends on | Exit gate |
|---|---|---|---|
| **6 — Reconcile and freeze contracts** | Verify the five polish fixes, map real schemas and routes, preserve reader fallbacks, freeze event/protocol/readiness contracts, repair shared header | Existing v1 | REHIT plus two protocols assign correctly on production; all header consumers pass 390 pixels; no dead-shadow edit |
| **7 — Durable logging foundation** | Dexie event outbox, pure reducer, comparable prefill, one-tap confirm, Undo, deadline rest timer, foreground replay, basic vetted swap | Slice 6 contracts | Production unique index inspected; concurrent replay creates one canonical event; offline/reload and cross-account tests pass |
| **8 — Guided strength and REHIT players** | Finite session contract, crash resume, audio, wake lock, partial outcome, completion/advance/points transaction | Slice 7 event truth | Background/sleep matrix, audio-bearing receipts, frame citations, and exactly-one completion/award race pass |
| **9 — Readiness prescription** | Versioned original/modified session snapshots, three tiers, activity path, freshness projection | Slices 7–8 canonical events | 39/40/69/70 boundary matrix and real visible session modifications pass; stop rules always outrank score |
| **10 — Safety substitution intelligence** | Clinician-vetted movement-purpose graph and deterministic filtering | Slice 7 swap shell; Slice 9 safety context | Complete substitution matrix, safe empty result, and fixed pain/referral branches approved |
| **11 — Evidence and adherence views** | Strength trend with confidence, checkpoints, journey, calendar, rescue ladder, habit layer, shared scorecard | Stable events; nutrition contract | Independent formula reproduction, local-day suite, scorecard parity, and no tissue-certainty copy |
| **12 — Unified workout coach** | One authenticated Cloudflare boundary, fixed fences, read-only grounding, confirm-before-action | Safe swap and repeat-safe confirmation paths | Cross-user, injection, fixed-template, provider-failure, replay, and no-preconfirm-write tests pass |
| **13 — Craft, privacy, security, and full production proof** | Empty/loading/error states, accessibility, bounded telemetry, full dual-eye journeys, credential rotation | All prior slices | Exact-commit evidence manifest, audio proof, test cleanup equality, zero console errors, and fresh old-credential authentication failure |

Security setup that changes the new Atlas credential may be prepared earlier when Jon authorizes the operator action; final revocation proof remains Slice 13. The exposed old credential is not considered fixed until a fresh connection using it fails.

## Verification Architecture

Every delegated implementation uses a seven-section ticket:

1. plain-English objective;
2. starting evidence and governing constraints;
3. exact write set, meaning the only files the worker may edit;
4. acceptance criteria;
5. runnable checks;
6. visual or temporal evidence contract;
7. rollback and cleanup.

Verification begins from a committed clean tree. The blind verifier gets the ticket, diff, and acceptance criteria but not the worker's reasoning. Write-path proof uses only the isolated relay and a fresh canonical read.

Visual gates use two blind eyes before comparison:

- Eye 1 judges static truth: text, values, layout, focus, clipping, and 390-pixel behavior.
- The temporal eye judges transitions, countdown, rest, resume, celebration, and motion from commit-bound recordings.
- Gemini may independently inspect the same captured video at its highest available reasoning level, but it cannot infer sound from a silent recording.
- Every verdict cites frames or timestamps and names the exact live commit.

Each build row records hypothesis, change, verification, result, and lesson. Each debug row records failing case, candidate cause, fix attempt, post-check, and next threshold. Any creative improvement beyond the specification gets a da Vinci record with rationale, evidence, risk, and rollback; no deviation is silent.

## Architectural Decisions to Freeze Before Coding

- One immutable workout event contract and one production compound unique index are the write foundation.
- Dexie is the installed local database wrapper; no new offline package is allowed.
- Foreground replay is the only outbox sender in v2; the existing service worker does not own workout writes or cache authenticated workout responses.
- Protocol and readiness decisions are versioned snapshots, so later rules never rewrite history silently.
- Absolute deadlines are timer truth; audio and wake lock are optional adapters.
- Safety rules are deterministic code and vetted data, never model judgment.
- Nutrition owns nutrition truth; both pages consume one shared scorecard response.
- The coach proposes; the member confirms; the normal event service writes.
- Unique indexes survive application rollback because they preserve idempotency.
- No phase is accepted on screenshots alone when the claim concerns time, sound, identity, or database effects.
