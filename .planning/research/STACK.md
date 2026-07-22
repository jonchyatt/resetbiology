# Technology Stack: Muscle-Preservation Engine

**Project:** Reset Biology v2.0 Muscle-Preservation Engine  
**Researched:** 2026-07-21  
**Confidence:** HIGH for repository and browser-platform choices; MEDIUM for production index rollout until Atlas state is inspected

## Recommendation in one sentence

Keep the current stack and add no packages: use the installed Dexie wrapper over the browser's IndexedDB database for a durable local event outbox, authenticated Next.js route handlers for replay, Prisma plus MongoDB unique indexes for server-side repeat safety, persisted deadline timestamps for timers, browser-native wake lock and Web Audio as progressive enhancements, inline SVG plus HTML summaries for progress, one versioned server read model for the nutrition/workout scorecard, and one code-fenced Cloudflare Workers AI boundary for coaching.

The important upgrade is architectural, not a library purchase: record each member action once as an immutable event, meaning a fact that is appended rather than edited in place, and let both local and server state derive from that event. This makes offline replay, crash recovery, exactly-once points, coach confirmations, and audit receipts one coherent system instead of five unrelated fixes.

## Installed stack to keep

Versions below are the exact versions locked in `package-lock.json`, not guesses from declared version ranges.

| Technology | Locked version | Purpose in this milestone | Decision |
|---|---:|---|---|
| Next.js App Router, the repository's page-and-server routing framework | 15.5.7 | Patient interface and authenticated server endpoints under `app/api/` | Keep; new endpoints remain route handlers in the live `app/` tree. |
| React, the interface component runtime | 19.1.0 | Guided players, status views, SVG graphics, and shared scorecard | Keep; use ordinary state plus narrowly scoped hooks rather than a new global state package. |
| TypeScript, the compile-time type checker | 5.9.3 | Versioned event, scorecard, readiness, and coach contracts | Keep strict mode; pair types with small runtime validators because TypeScript types disappear at runtime. |
| Prisma Client, the typed MongoDB access layer | 6.19.0 | Authenticated event ingestion, projections, points, scorecard reads, rate limits, and bounded receipts | Keep; MongoDB support remains on Prisma 6, and the lockfile already has the current recommended Prisma 6 release. |
| MongoDB Atlas, the production document database | Existing | Canonical workout events, sessions, readiness snapshots, weekly evidence snapshots, rate-limit windows, and short-lived diagnostic receipts | Keep; add staged indexes instead of a second database. |
| Dexie, the installed promise-based IndexedDB wrapper | 4.2.1 | Local event outbox and crash-resumable player snapshot | Reuse; the repository already uses Dexie in `src/lib/breathStorage.ts`, so no package or unfamiliar storage engine is required. Do not copy that file's `localStorage` fallback for workout events. |
| Auth0 Next.js SDK, the existing session boundary | 4.13.2 | Identify the server-side member for every read and write | Keep; derive `userId` from the authenticated server session and never accept it from the request body. |
| Tailwind CSS, the existing utility styling system | 4.1.17 | Portal glass styling, responsive states, visible focus, and reduced-motion overrides | Keep; no charting or animation package is needed. |
| Web Audio API, the browser's low-latency audio graph | Browser native | Count-in cues, app-owned audio ducking, mute, volume, and cue diagnostics | Use as a progressive enhancement after a member gesture. |
| Screen Wake Lock API, the browser request to keep the display awake | Browser native | Reduce phone sleep during an active guided session | Use only when supported; timer correctness cannot depend on it. |
| SVG, the browser's vector drawing format | Browser native | Progress rings, trend lines, just-right band, and freshness diagram | Use with an adjacent text summary and real numeric accessible labels. |
| Playwright plus axe, the installed browser and accessibility test tools | 1.57.0 and 4.11.0 | Replay/race checks, mobile visual capture, keyboard checks, and automated accessibility checks | Keep; temporal video and audible output still need the separate harness receipts required by the master build. |
| Cloudflare Workers AI REST endpoint, the existing hosted model interface | Service API | Member-triggered workout coach responses | Reuse the existing REST pattern; centralize model and endpoint configuration instead of adding another AI client. |

## Implementation-ready capability map

### 1. Repeat-safe offline set events

#### Local durable outbox

Create one workout-specific Dexie database rather than extending `BreathTrainingDB`. An **outbox** is a local table of actions waiting for the server to acknowledge them.

Recommended integration point: `src/lib/workoutRuntimeDb.ts`, a browser-only module that owns:

- `events`, an append-only table keyed by `eventId`;
- `runtimeSnapshots`, a replaceable, versioned snapshot keyed by `assignmentId + sessionId` for fast crash resume; and
- `receipts`, a bounded local table of server and audio acknowledgements.

Every one-tap set action should create one `eventId` with `crypto.randomUUID()`, the browser's cryptographically random identifier generator, at the instant of the tap. Persist the event and update the local player projection in one Dexie transaction. Dexie's explicit string primary key rejects accidental reuse locally; the same identifier travels unchanged on every retry. The event carries explicit fields rather than an unbounded blob: contract version, assignment, session, exercise, set ordinal, event kind, canonical payload, client time, local-day key from `src/lib/localDay.ts`, payload digest, sync status, attempt count, and next retry time.

Use a **payload digest**, a SHA-256 fingerprint of fields serialized in a fixed order, to distinguish a legitimate replay from an identifier reused with different content. Web Crypto can produce the client digest and Node's built-in `crypto` module can recompute it on the server; no hashing package is needed.

Do not use `localStorage` for set events. It has no multi-record transaction, encourages overwrite-style state, and the existing breath fallback would make a set appear saved even if its paired snapshot write failed. If IndexedDB is denied or unavailable, degrade honestly to online-only logging and require a server acknowledgement before showing the set as safely saved.

Ask `navigator.storage.persist()`, the browser request to reduce automatic storage eviction, only after the member starts or deliberately enables offline sessions. The browser may deny it, so show whether offline protection is active and keep the server acknowledgement as canonical truth. Never promise that unsynced browser data survives device loss, privacy-mode exit, or storage eviction.

#### Server ingestion and authoritative idempotency

Recommended integration point: `app/api/workout/events/route.ts`, an authenticated batch endpoint, plus a pure validator in `src/lib/workoutEvents.ts`.

Add a `WorkoutEvent` Prisma model mapped to a new MongoDB collection. The critical server constraint is `@@unique([userId, eventId])`, a compound unique index that allows a member's event identifier only once. A duplicate request with the same digest returns the original success receipt; the same identifier with a different digest returns a conflict and never mutates data. The API response should name each event as created, already accepted, permanently rejected, or retryable.

Process a bounded batch, with an implementation ceiling such as 50 events and a byte-size limit, so one bad or enormous request cannot monopolize a server invocation. Validate every event before writes; reject unknown contract versions, invalid numbers, missing ownership, stale assignment snapshots, and payloads outside the allowlist. The server never trusts client readiness, points, elapsed time, or `userId` as authority.

For completion, use the existing `awardWorkoutPoints()` function in `src/lib/workoutPoints.ts` inside the same MongoDB transaction as the canonical completion projection. The existing `DailyAward` unique index remains the final once-per-day points gate. A repeated completion event returns the same outcome rather than awarding again.

Sync attempts should run immediately after enqueue, on page start, after a successful authenticated read, when the page becomes visible, and when the browser emits an online hint. `navigator.onLine`, the browser's rough connectivity flag, is not truth; always let the real fetch result decide. Retry temporary failures with capped exponential backoff and jitter. Background Sync, the service-worker API that asks the browser to retry later, may be added only as an optional accelerator because it is not supported by all major browsers and cannot be the correctness path.

#### Non-negotiable database rollout gate

The current Vercel build command runs `prisma generate`, which generates a client but does not create MongoDB indexes. Prisma Migrate also does not support MongoDB; Prisma's official path for MongoDB indexes is `prisma db push`, a schema synchronization command. Therefore code that merely declares `@@unique([userId, eventId])` is not repeat-safe in production until the real Atlas index is created and inspected.

Release order:

1. Add the collection/model and ingestion code behind an off switch.
2. Through the named isolated database relay, create and verify the compound unique index against the intended Atlas database; do not put a credential in a command or report.
3. Race-test two simultaneous requests with the same event and confirm one canonical row.
4. Enable client replay only after that test passes.

This gate is the highest stack risk in the milestone.

### 2. Deadline timers, wake lock, and crash resume

Store timer truth as `deadlineEpochMs`, an absolute wall-clock time in milliseconds, together with `startedAtEpochMs`, `durationMs`, block identifier, and contract version. Derive remaining time as `max(0, deadlineEpochMs - Date.now())`; never decrement an integer each second. Background tabs throttle timers and usually stop animation frames, but the deadline still resolves correctly when the page returns.

Recommended integration points:

- `src/lib/workoutTimer.ts`, a pure deadline/state-transition engine with fake-clock tests;
- `src/hooks/useWorkoutDeadline.ts`, the visible React update loop; and
- the Dexie `runtimeSnapshots` table, which persists the active block and deadline before the interface advances.

Use `requestAnimationFrame()`, the browser's per-paint callback, only to make the visible countdown smooth. On `visibilitychange`, the browser event for a tab becoming hidden or visible, persist current state when hidden and recompute from the deadline when visible. A timeout callback may request a repaint or cue, but it must never be the fact that makes a block complete.

Request `navigator.wakeLock.request('screen')`, the browser's screen-awake request, from the explicit Start Session tap. Listen for the lock's release, show a quiet status, and reacquire when the page becomes visible if the session is still active. Release it at pause, finish, or unmount. Low battery, platform policy, an inactive document, or an older browser may deny or revoke it; the player must continue correctly with deadline and resume logic.

### 3. Audio cues and honest receipts

Create or resume one shared `AudioContext`, the browser's audio scheduling clock, inside the Start Session tap so autoplay policy is satisfied. Route every sound the page owns through one `GainNode`, a volume-control node, so cues can lower only Reset Biology audio. The site cannot lower Spotify, Apple Music, or any other app, and the interface must never claim it can.

For the final spoken three-count, prefer tiny, locally hosted, human-reviewed `3`, `2`, `1`, `go`, `rest`, and `done` clips decoded into `AudioBuffer` objects and scheduled against `AudioContext.currentTime`. This is more deterministic than `speechSynthesis`, the browser's variable text-to-speech service, and adds no package. A simple oscillator tone remains the no-asset fallback. Preload and decode before the first timed block, expose mute and volume, and retain text plus color for silent users.

Recommended integration points:

- `src/lib/workoutAudio.ts`, one audio graph and scheduler;
- `public/audio/workout/`, reviewed short cue assets if the asset owner approves them; and
- a small `AudioCueReceipt` contract in `src/lib/workoutReceipts.ts`.

An audio receipt should record the cue key, intended deadline, actual scheduling time, audio-context state, mute state, and whether the cue was missed during suspension. It proves that the app scheduled a cue; it does not prove that the speaker produced audible sound. The final acceptance gate therefore still needs a separate operating-system audio or microphone recording. Playwright's silent video is not audio evidence.

When the audio context returns from suspension, reconcile against the current deadline. Never play a burst of stale queued cues. Mark past cues missed, resume with the next valid cue, and keep the visible timer authoritative.

### 4. SVG progress, freshness, and activity views

Use inline React SVG, meaning vector elements rendered directly in the page, plus ordinary CSS and Tailwind. No chart library is needed for rings, trend lines, the just-right band, or the finite set of reviewed muscle regions.

Recommended split:

- pure math in `src/lib/workoutProgress.ts` and `src/lib/workoutFreshness.ts`;
- presentation in `src/components/Workout/Progress/`; and
- one shared scorecard view in a nutrition-owned shared component after its contract is frozen.

Use a responsive `viewBox`, `pathLength="100"` for percentage-like paths, and explicit numeric bounds. Give each chart `role="img"` plus an accessible name and description, then repeat the real values in adjacent HTML text or a compact table. For the body diagram, use clinically reviewed static paths only; do not generate anatomical instruction. Color is an extra channel, not the only channel: every region also has a label, freshness word, numeric estimate, and explanation. Put any drill-in controls in 44-by-44-pixel HTML buttons rather than relying on tiny SVG paths as touch targets.

Respect `prefers-reduced-motion`, the operating-system preference for reduced animation. In reduced mode, remove pulses, zooms, animated path drawing, and full-screen transitions; update numbers and state directly. The REHIT GO state still changes text and color and can still use user-enabled audio without flashing.

### 5. One cross-page scorecard contract

Do not make `/workout` call the existing nutrition entries endpoint and assemble its own interpretation in the browser. That would create a second truth and inherit the current nutrition route's UTC-day boundaries. Build one authenticated server read model, meaning a response assembled from canonical records without copying ownership.

Recommended integration points after the nutrition owner freezes the contract:

- `src/lib/muscleScorecardContract.ts`, the shared versioned TypeScript shape plus hand-written runtime validator;
- `src/lib/muscleScorecardReadModel.ts`, the server-only aggregator;
- `app/api/muscle-scorecard/route.ts`, the authenticated private response with `Cache-Control: private, no-store`; and
- one shared component imported by both `/nutrition` and `/workout`.

The version-one response should include a contract version, requested local-day window, source freshness, missing-data status, Strength Score estimate with coverage/confidence, sessions completed, protein hit days over observed days, trend weight, and per-metric provenance. `0`, not measured, not applicable, and unavailable must remain different states. Send only local-day keys produced by `src/lib/localDay.ts`; never use `toISOString().split('T')[0]` as the member's calendar day.

Read canonical inputs from `WorkoutSession`, `FoodEntry`, `JournalEntry.weight`, nutrition goals in `User.profileData.macroGoals`, and weekly Strength Score snapshots. Do not duplicate food totals or weight as workout-owned fields. Store a weekly Strength Score snapshot only because the trend requires historical formula/version/coverage provenance; recompute the current score from canonical events and compare before publishing it.

No schema-validation package is necessary. The contract is small enough for an explicit allowlist validator, and the consumer tests should include old version, future version, missing field, `null`, zero, and wrong-unit fixtures.

### 6. Coach unification and safety fences

The current coach paths are genuinely split: `src/lib/agents/AgentOrchestrator.ts` and `src/lib/agents/BaseAgent.ts` call paid OpenAI, `ExerciseAgent.ts` and `BioCoach.ts` can write directly to the Vault, `app/api/voice/chat/route.ts` performs paid transcription/response/speech, and `app/api/peptide-chat/[slug]/route.ts` separately calls Cloudflare Workers AI. The new workout dock must not wrap those paths and call them "unified."

Create one server-only orchestration boundary, meaning the sole function allowed to classify safety, gather context, call a model, and return a proposed action. Recommended integration points are `src/lib/coach/` for the boundary and `app/api/coach/workout/route.ts` for the authenticated endpoint. Centralize endpoint, model name, token ceiling, timeout, and personality import in `src/lib/coach/config.ts`; keep the model swappable without changing safety code.

Order is mandatory:

1. Authenticate and validate length/history.
2. Run pure code safety classifiers before any model call.
3. For pain/injury, medication/dosing, eating-disorder, or compulsive-exercise categories, return the fixed reviewed template and do not generate advice.
4. Build a bounded member-context object from canonical workout/readiness/protocol data.
5. Call the existing Cloudflare Workers AI REST endpoint with no write tools.
6. Validate and return text plus an optional typed proposed action.
7. A separate confirm endpoint revalidates the action against current server state and emits it through the same repeat-safe workout event path.

Do not let a model write a log, swap, readiness decision, or Vault file. `ExerciseAgent.handleLogging()` and `BioCoach.handleLogging()` are bypasses under the new contract and must not be reused for workout writes. The generated answer may propose; only member confirmation creates the event.

Keep the direct Cloudflare REST call already proven in the peptide route. Do not add the Vercel AI SDK or another model client. Cloudflare documents a free allowance of 10,000 neurons per day and failure after the limit; therefore retain a graceful no-coach state, cap input/history/output, and show evidence cards independently of AI. Keep the current model until a repository-owned golden-set evaluation proves a cheaper model passes safety, grounding, tone, and usefulness; central configuration makes that later swap one change.

Replace the existing per-process `Map` rate limiter for this endpoint. A serverless instance-local counter is not a global limit. Use a small MongoDB rate-window collection keyed by authenticated member plus window and a separate global key; conditional atomic increment, compound uniqueness, and an expiry field make the limit consistent across instances. Return a plain retry time. Never rate-limit authenticated members by raw IP when a stable member identity exists.

Cloudflare states that Workers AI customer content is not used to train models or improve services without explicit consent. Still send only the context needed for the answer. Do not send complete longitudinal histories, raw pain notes, medication details, or unrelated Vault material.

### 7. Bounded telemetry and retention

Keep product telemetry first-party and allowlisted. Recommended events are mode, action count, time to first set, interruption, resume, sync outcome, elapsed-time bucket, session outcome, coarse failure code, contract version, and production commit. Do not include exercise names, weight, repetitions, pain or swap reason text, medication, readiness answers, model transcript, or free-form notes.

Use an authenticated `app/api/workout/telemetry/route.ts` endpoint and a separate MongoDB collection. Accept enum-like values and bounded integers only; reject arbitrary object keys. `navigator.sendBeacon()`, the browser's small asynchronous analytics post, can make a best-effort send when the page becomes hidden, but telemetry loss is acceptable and it must never carry workout events or other canonical state. Normal fetches during the session remain the primary path.

Use an Atlas time-to-live index, meaning a database index that automatically deletes documents after a fixed period, on an `expiresAt` date for telemetry, audio diagnostics, rate windows, and any approved coach quality log. TTL deletion is not immediate, so policy wording should allow a short operational delay. Create and verify TTL indexes through the same isolated database migration rail as the unique workout-event index.

For coach quality, default to structured fields such as safety category, template identifier, model, latency, grounding sources, proposed-action kind, and member-confirmed outcome. Raw conversations are health-adjacent content and should remain on hold unless the privacy owner approves explicit consent, access controls, and a short retention period. This structured log is enough to find safety-routing and model-quality failures without building a shadow health record.

## Progressive-enhancement and browser-risk matrix

| Capability | Current platform reality | Required fallback |
|---|---|---|
| IndexedDB through Dexie | Broad support and transactional, but private browsing, user settings, quota pressure, or browser shutdown can abort or remove unsynced data. Persistent-storage requests may be denied. | Online-only logging with explicit acknowledgement; visible pending count; server remains canonical. Never silently fall back to `localStorage`. |
| Background Sync | Limited availability and dependent on a service worker plus browser policy. | Foreground replay on enqueue, mount, visibility return, connectivity hint, and manual retry. Server idempotency makes every retry safe. |
| Browser connectivity flag | `navigator.onLine` can say online with no Internet or offline behind a blocked probe. | Treat it as a hint only; the authenticated fetch response decides. |
| Timers and animation frames | Hidden tabs throttle timeouts and usually stop `requestAnimationFrame()`. Mobile operating systems can suspend the page entirely. | Persist absolute deadlines; recompute on resume; never count callback ticks. |
| Screen Wake Lock | Available on current browsers but newer than the other APIs; requires HTTPS, an active visible document, and may be denied or released for battery/platform reasons. | No-wake-lock session with the same persisted deadlines, resume state, and an unobtrusive status. |
| Web Audio | Widely available, but autoplay requires user activation and mobile browsers may suspend the context. | Start/resume from the Start tap; visible numerals and text always work; mute is explicit; reconcile missed cues on resume. |
| Audio scheduling | `AudioContext.currentTime` supports accurate app-owned cue scheduling while the context runs; it cannot control external audio or prove speaker output. | App-owned gain only; separate audible acceptance recording; no external-music promise. |
| SVG and reduced motion | Inline SVG and `prefers-reduced-motion` are broadly available. SVG alone is not a sufficient accessible data explanation. | Adjacent HTML values/table, accessible name/description, non-color labels, and static reduced-motion state. |
| `sendBeacon()` telemetry | Widely available for small analytics posts, but mobile lifecycle events are not guaranteed and the method offers no useful server response. | Telemetry may drop. Never use it for a set, completion, points, or cleanup operation. |
| Workers AI free allocation | 10,000 neurons per day, then requests fail on the free plan. Model availability and economics can change. | One config location, tight context/output budgets, database-backed rate limits, cited non-AI content, and a friendly unavailable state. |

## What not to add

| Do not add | Why | Use instead |
|---|---|---|
| Dexie Cloud, PouchDB, a conflict-free replicated data type system, or another sync platform | One member is not collaboratively editing sets; server unique indexes and an outbox solve the actual retry problem with less data exposure and fewer failure modes. | Installed Dexie locally plus authenticated batch replay to MongoDB. |
| Redux, Zustand, or another global state library | The hard problem is durable events, not component state. Another store would still need the same outbox and server rules. | Pure event reducer plus React state scoped to the active player. |
| A chart library such as D3 or Recharts | Rings, small trends, a band, and a fixed body diagram do not justify package size or a second visual idiom. | Inline SVG plus HTML summaries. |
| Tone.js, Howler, or a speech-synthesis package | The cue set is tiny and Web Audio already supplies scheduling and gain. Extra abstraction does not remove autoplay or suspension rules. | One small native audio module and reviewed local clips. |
| A timer package or Web Worker timer | Workers and timers can still be throttled or suspended, so they do not replace deadline truth. | Persisted absolute deadlines and visibility reconciliation. |
| Background Sync as a required path | It excludes browsers and can be withheld by policy. | Foreground retry plus optional Background Sync registration. |
| A second analytics vendor or replay recorder | Health-adjacent session replay expands privacy, consent, retention, and secret-handling risk. | First-party allowlisted coarse events with TTL deletion. |
| A second AI SDK or model router | The existing Cloudflare REST pattern already supports a swappable model. More clients create more keys, policy surfaces, and failure modes. | One server config and one direct Workers AI adapter. |
| Model function calling for writes | A generated tool call is not member confirmation and can bypass deterministic safety rules. | Typed proposal followed by a separate member-confirmed, server-revalidated event. |
| Raw transcript logging by default | It creates a second health-adjacent record and is unnecessary for most QA. | Structured quality outcomes; raw text only after explicit privacy approval and short retention. |
| A copied workout-owned nutrition aggregate | It will drift from nutrition and can misbucket days. | One shared authenticated server read model, owned and versioned with nutrition. |
| Web Speech for timing-critical spoken counts | Voice availability, startup, pronunciation, and timing vary by device. | Tiny reviewed audio buffers scheduled on the Web Audio clock. |

## Release and verification implications

1. The event engine cannot leave its feature switch until the production compound unique index is inspected and a concurrent duplicate race passes.
2. Offline verification must cover: enqueue then reload; enqueue offline then reconnect; duplicate batch replay; same identifier with changed payload; two tabs replaying together; storage denial; and server success followed by lost client response.
3. Timer verification must fake long background gaps instead of waiting in real time, then use the commit-bound production video for visible temporal truth.
4. Audio verification needs two artifacts: the app's cue-scheduling receipt and an independently captured audible recording. Either alone is insufficient.
5. The scorecard remains on hold until nutrition freezes the version-one schema and local-day semantics. Both pages then consume exactly the same response and component.
6. Coach verification must prove safety classification happens before the model, generated output cannot write, confirmation emits one event, a retry does not duplicate it, rate limiting works across concurrent requests, and quota failure leaves the cited workout surface usable.
7. Telemetry verification must send an unknown key and a forbidden health field and prove both are rejected, then inspect the Atlas TTL index without exposing connection material.

## Sources

### Browser platform

- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — transactional offline structured storage and same-origin boundary. **HIGH confidence.**
- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) — transaction lifetime, shutdown aborts, and why unload-time writes are unsafe. **HIGH confidence.**
- [Dexie documentation](https://dexie.org/docs) and [Dexie transaction API](https://dexie.org/docs/Dexie/Dexie.transaction%28%29) — installed wrapper's schema, primary-key, and atomic transaction behavior. **HIGH confidence.**
- [MDN: `crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) — secure browser-generated version-four identifiers. **HIGH confidence.**
- [MDN: persistent storage request](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) — browser may grant or deny eviction protection. **HIGH confidence.**
- [MDN: Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) — useful but not Baseline across major browsers. **HIGH confidence.**
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) and [MDN: timeout throttling](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout) — hidden-page timer and animation behavior. **HIGH confidence.**
- [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — secure-context requirement, revocation, and visibility-based reacquisition. **HIGH confidence.**
- [MDN: Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) and [MDN: scheduled audio start](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/start) — user activation and audio-clock scheduling. **HIGH confidence.**
- [MDN: reduced-motion media query](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) and [MDN: accessible labels](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) — reduced motion and accessible naming. **HIGH confidence.**
- [MDN: `navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) — connectivity flag is inherently unreliable. **HIGH confidence.**
- [MDN: `sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) — small analytics posts, visibility lifecycle, and why unload hooks are unsafe. **HIGH confidence.**

### Server, database, and AI

- [Next.js: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — authenticated request handlers belong under `app/**/route.ts`. **HIGH confidence.**
- [Prisma: MongoDB connector](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/mongodb) — MongoDB transactions require a replica set, Prisma Migrate is unavailable, and indexes use `db push`. **HIGH confidence.**
- [Prisma: schema reference for compound uniqueness](https://docs.prisma.io/docs/orm/reference/prisma-schema-reference) — `@@unique` is enforced by a MongoDB unique index. **HIGH confidence.**
- [MongoDB: unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/) — compound uniqueness and live index-build constraints. **HIGH confidence.**
- [MongoDB: TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/) — automatic expiry, Atlas management, single-field restriction, and non-immediate deletion. **HIGH confidence.**
- [Cloudflare Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) — current direct execution endpoint and token requirements. **HIGH confidence.**
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) — 10,000 free neurons per day and failure beyond the free allocation. **HIGH confidence as of 2026-07-21; recheck before release because pricing changes.**
- [Cloudflare Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/) — customer content ownership and no training/service improvement without explicit consent. **HIGH confidence.**

## Remaining validation gaps

- Inspect the production Atlas index list; repository source cannot prove that declared Prisma indexes exist remotely.
- Confirm the production browser matrix that Jon actually supports, especially installed iOS Safari versions; the design feature-detects every optional API, so this does not block architecture.
- Freeze the scorecard contract and local-day ownership with the nutrition rail before implementation.
- Run a golden-set evaluation before changing the current Cloudflare model; official pricing proves cost, not clinical-safety or coaching quality.
- Decide the reviewed voice/audio asset owner. Until that gate passes, ship deterministic tones plus visible counts rather than generated or unreviewed speech.
