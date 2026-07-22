# Domain Pitfalls: Reset Biology Muscle-Preservation Engine

**Domain:** Clinician-warm workout guidance for members tapering GLP-1 medication
**Project:** Reset Biology `/workout` GODMODE v2
**Researched:** 2026-07-21
**Overall confidence:** HIGH for browser, Next.js, Prisma, MongoDB, and security mechanics; MEDIUM for product-specific clinical interpretation pending formal clinical review

## Operating Position

The most dangerous failures in this build will not look like failures. The screen can say “saved,” the celebration can fire once, and a silent test video can look perfect while the server has recorded the session twice, the points ledger has advanced twice, or the audio cue never played. Therefore, a visual pass is necessary but never sufficient for data writes, audio, authentication, or clinical safety.

This document treats every workout action as a safety-sensitive, replayable event. **Idempotency** means repeating the same action has no additional effect. The server and database must enforce that rule; browser locks and disabled buttons only make duplicate attempts less likely.

The release posture is additive and reversible:

1. Readers understand both old and new records.
2. New database rules are proven against existing production data.
3. Writers begin creating the new shape.
4. Old data is backfilled only when necessary and with a restartable process.
5. Old compatibility paths are removed only in a later, separately proven change.

## Critical Pitfalls

### Pitfall 1: “Looks successful twice” — replay creates duplicate sets, advancement, or points

**GSD owner:** Phase 7 owns the durable workout event and offline queue; Phase 8 owns session completion, plan advancement, and exactly-once points.

**What goes wrong:** A member taps once, but the browser retries after a network timeout. Or two tabs complete the same set. Or a page refresh replays a queued completion whose first response was lost. If each request is treated as new, the product can create duplicate sets, advance the plan twice, or award more than the existing 40 workout points. A one-time button animation is not proof of a one-time write.

**Warning signs:**

- Requests have no stable member-created event identifier.
- The server generates a new identifier on every retry.
- Points are awarded in a separate request from completion.
- A `200` response is treated as proof without reading the canonical saved event back.
- Duplicate prevention depends only on a disabled button, React state, or a browser lock.
- The existing `DailyAward` database rule protects daily points, but session advancement or set creation has no equivalent database rule.

**Prevention:**

- Give every logical action a stable event identifier before its first network attempt. The same identifier travels through offline replay, refresh recovery, and manual retry.
- Put the saved workout event, completion state, plan advancement, and existing `DailyAward` points award in one server-owned **transaction**, meaning an all-or-nothing database operation, where the current MongoDB deployment supports it.
- Add a database uniqueness rule for the stable event identifier. A pre-check followed by an insert is race-prone; the database must be the final referee.
- Return the already-saved canonical result when the same event is replayed. A replay is success, not an error and not a new award.
- Keep the existing named values of 40 workout points and 10 readiness points. Any new award stays disabled behind a flag.
- Distinguish retryable failures, such as a network interruption or temporary server error, from permanent failures, such as an invalid payload. A malformed event must not retry forever.

**Verification:**

- Send the identical completion event concurrently from two browser contexts and by a direct isolated relay. Prove one workout event, one plan transition, one `DailyAward`, and one 40-point ledger entry.
- Drop the first response after the server commits, then replay. The second response must return the original result without another effect.
- Refresh and close the tab at each boundary: before send, during send, after commit but before acknowledgement, and during celebration.
- Verify the result from a fresh authenticated read, not from the submitting page's local state.
- Blind verifier receives only the task, committed diff, acceptance criteria, and test setup. The verifier must not receive the worker's explanation.

### Pitfall 2: A browser lock is mistaken for a global lock

**GSD owner:** Phase 7 owns multi-tab queue coordination; Phase 8 owns active-session conflict handling.

**What goes wrong:** The Web Locks API can coordinate same-origin tabs and workers in one browser profile, but it cannot coordinate a second device, another browser profile, an isolated test relay, or a server retry. Treating it as the source of truth leaves cross-device duplication possible. A crashed tab can also strand a poorly designed custom lease.

**Warning signs:**

- “Only one tab can sync” is cited as the duplicate-write guarantee.
- The server accepts two writes with the same logical event identifier.
- Queue ownership has no expiry, heartbeat, or crash recovery.
- Two devices can open the same active session without a visible reconciliation rule.
- The queue says an event is complete before the canonical server response is persisted.

**Prevention:**

- Use a **Web Lock**, meaning a same-browser coordination lock, only to choose one local sync leader and reduce waste.
- Use the server's unique event rule and atomic write as the correctness boundary.
- Give any fallback lease an expiry and recovery path. Persist queue states such as pending, sending, acknowledged, and rejected so a crash can be diagnosed.
- Decide the cross-device policy explicitly: merge distinct set events, deduplicate identical events, and require a fresh canonical version before advancing the plan.
- Use **compare-and-set**, meaning update only if the saved version still matches what the member saw, for transitions that cannot safely merge.

**Verification:**

- Run the same event from two tabs, two incognito contexts, and two different browser engines.
- Kill the sync leader during send and prove another context safely resumes.
- Leave a lease behind, advance the clock beyond expiry, and prove recovery without duplicate effects.
- Verify that the local queue is not the only source showing the event as saved.

### Pitfall 3: A flexible MongoDB schema hides an unsafe rollout

**GSD owner:** Phase 6 owns schema inventory and compatibility rules; each later phase owns its additive fields and production index receipt.

**What goes wrong:** MongoDB permits old and new document shapes to coexist, while Prisma presents a typed model that can make the collection appear more uniform than it is. Adding a required field, assuming missing and `null` are equivalent, or building a unique index over dirty production data can break reads or deployment. Prisma Migrate does not manage MongoDB migrations; `db push` does not create a reviewable migration history.

**Warning signs:**

- A new field is required before old records contain it.
- Code uses truthiness to collapse “missing,” `null`, zero, and false.
- A Prisma schema change is called a completed production migration without inspecting the live index.
- Someone reaches for `prisma db push --accept-data-loss` on production.
- No duplicate aggregation was run before a unique index build.
- A unique index includes legacy documents with missing or null event identifiers.

**Prevention:**

- Add optional fields first and use explicit reader fallbacks for old production documents.
- Include a schema version where interpretation changes, and keep transforms deterministic.
- Preflight existing values and duplicates before adding any uniqueness rule.
- Use a **partial unique index**, meaning uniqueness applies only to documents that contain a qualifying new field, when legacy records cannot safely participate.
- Treat an index as deployed only after the live database reports it. A schema file is an intention, not a receipt.
- Keep transactions short. MongoDB transactions require a replica set; Atlas normally provides one, but the production topology must be confirmed.
- Do not backfill in a request path. A backfill must be restartable, bounded, observable, and safe to rerun.

**Verification:**

- Run old-shape, new-shape, missing-field, explicit-null, zero-value, and duplicate fixtures through every reader.
- Query production for duplicates and missing values before the index change, then inspect the live index definition afterward.
- Deploy reader compatibility before the new writer, and prove both app versions can coexist during rollout.
- Restore a production-shaped snapshot into an isolated database and execute the rollout twice.

### Pitfall 4: Countdown state is derived from browser ticks instead of elapsed time

**GSD owner:** Phase 7 owns rest timers; Phase 8 owns the REHIT interval state machine and crash resume.

**What goes wrong:** Browsers throttle timers in background tabs, stop animation frames, and may check long-background timers only about once per minute. A countdown that subtracts one each callback can drift, skip blocks, extend a sprint, or resume at the wrong point after sleep. REHIT timing is a product and safety contract, not decoration.

**Warning signs:**

- State changes when a `setInterval` callback fires rather than when an absolute deadline is reached.
- The remaining time is persisted without the block start time, target deadline, and session state.
- Backgrounding the phone pauses or stretches the workout silently.
- The same callback both paints the screen and decides which clinical block is active.
- A resumed session cannot explain whether it is safe to continue, restart the block, or finish early.

**Prevention:**

- Use a **deadline-based timer**, meaning every display value is recomputed from a monotonic clock and a saved target time, rather than counting callbacks.
- Make the REHIT flow an explicit state machine: preflight, warm-up, countdown, sprint, recovery, second countdown, second sprint, cooldown, complete, paused, and safely ended.
- Persist block identity, planned duration, start time, last acknowledged transition, and session version. Never infer a high-intensity state solely from a stale remaining-seconds number.
- On a large time jump or crash resume, enter a safe paused decision instead of silently continuing a sprint.
- Keep visual repainting separate from state transition logic.

**Verification:**

- Background the tab for 10 seconds, 60 seconds, and several minutes during every block.
- Lock the phone, change tabs, sleep the laptop, alter CPU throttling, and resume after the deadline.
- Compare frame timecodes to the absolute schedule; cite the exact frames where every state changes.
- Confirm the player never extends hard work because a callback arrived late.

### Pitfall 5: A silent video is accepted as proof that audio worked

**GSD owner:** Phase 8 owns audio cues; Phase 13 owns the final temporal and accessibility proof bundle.

**What goes wrong:** Autoplay policy can leave a Web Audio context suspended until a member gesture. The schedule can appear correct in code and the visual countdown can pass while no sound is heard. Gemini, Argus, or any human reviewing a silent recording can prove visual timing, but cannot prove audible cues.

**Warning signs:**

- The receipt has no audio track or waveform.
- A console message saying “cue scheduled” is treated as proof that sound reached the member.
- The audio context is created on page load rather than started or resumed inside the member's explicit start gesture.
- Muted device, silent mode, Bluetooth routing, or denied playback has no visible fallback.
- Only the sprint's last three seconds are tested even though the contract requires the final three seconds of every work and rest block.

**Prevention:**

- Create or resume the `AudioContext` during the member's Start tap and expose a short cue test before the workout.
- Schedule from the same absolute deadlines as the visual state machine.
- Pair every audio cue with visible text and countdown. Audio can assist but cannot be the only signal.
- Detect suspended or interrupted audio state and show a calm, actionable fallback.
- Bind the audio receipt and video receipt to the same commit identifier and run.

**Verification:**

- Capture an audio-bearing recording or synchronized waveform with timecodes. Cite the final-three-second cues for every warm-up, work, recovery, and cooldown transition.
- Independently test AudioContext state changes after navigation, backgrounding, device mute, and reconnecting headphones.
- The temporal reviewer receives the recording blind, states whether audio is actually present, and cites timestamps before seeing the static review.
- Label a silent capture honestly: it proves the visual state only and is a failed audio receipt.

### Pitfall 6: Screen wake lock is assumed to be durable

**GSD owner:** Phase 8 owns wake behavior and fallback; Phase 13 owns device-level production proof.

**What goes wrong:** A Screen Wake Lock can be rejected by the browser or operating system, released when the document becomes hidden, or withdrawn because of low battery. Assuming it always holds makes the phone go dark mid-session and can also hide timer-resume bugs.

**Warning signs:**

- Failure to acquire the lock rejects Start or breaks the player.
- There is no handler for the lock's release event.
- The app does not reacquire after returning to a visible page.
- “Keep screen awake” is promised without browser support qualification.

**Prevention:**

- Treat wake lock as progressive enhancement, meaning the core session remains safe without it.
- Request it after member intent, handle rejection, observe release, and attempt reacquisition only when visible and appropriate.
- Keep deadline-based session state independent of display state.
- Give a plain fallback such as “Your timer will continue; tap the screen if your phone dims.”

**Verification:**

- Exercise supported, unsupported, denied, low-battery, hidden-tab, and returning-visible cases.
- Prove that loss of the lock neither resets nor extends the session.
- Record actual phone behavior; desktop emulation is not sufficient for this gate.

### Pitfall 7: Phone-guided REHIT is presented as equivalent to controlled hardware

**GSD owner:** Phase 8 owns the REHIT player; Phase 13 owns the final honesty and safety audit.

**What goes wrong:** CAROL's commercial REHIT experience uses computer-controlled resistance. A phone can guide time and effort, but it cannot measure or control resistance. Copy that implies hardware equivalence, guaranteed adaptation, or universal suitability turns a useful interval guide into an unsupported clinical claim.

**Warning signs:**

- Copy says “CAROL workout” or promises the same dose without controlled resistance.
- A generic “go hard” cue lacks an equipment setup and safety preflight.
- Existing contraindications or stopping rules are hidden behind the player.
- The player starts after one tap without confirming the member can perform the protocol today.
- Completion framing pressures an unfit or symptomatic member to finish.

**Prevention:**

- Call it a phone-guided REHIT-style interval protocol and state what the phone does not control.
- Preserve every existing contraindication, citation, progression, and stopping rule.
- Put a fixed preflight before Start: equipment stable, surroundings clear, member understands effort, and no current stop signal.
- Surface a permanent Stop path. Chest pain, faintness, severe shortness of breath, or other vetted stop signals end the session and show fixed referral guidance.
- Individualize progression. Evidence on enjoyment is promising but includes more aversive responses among some lower-fitness participants.

**Verification:**

- Clinical reviewer audits every claim and every transition copy against the cited protocol evidence.
- Test every contraindication and stop-signal branch without invoking generated coach text.
- A blind reviewer must identify what is finite, what is hard, what is optional, and when to stop from the screen alone.

### Pitfall 8: Readiness becomes coercion or a disguised medical clearance

**GSD owner:** Phase 9 owns readiness prescription; Phase 13 owns adherence-neutral copy and accessibility audit.

**What goes wrong:** A score can look authoritative even when it is based on subjective sliders or missing values. “Ready” can be misread as medically cleared; “recover” can feel like failure; and a streak can pressure a member to override symptoms. The current rule allowing a raw score to override components also makes provenance important.

**Warning signs:**

- Missing values are converted to zero.
- The screen shows a score without the exact same-day change it causes.
- “Ready” says it is safe to exercise despite symptoms.
- A recover day can be overridden into a full session to protect continuity.
- The member cannot see what changed, why it changed, or which rule version produced it.
- Boundary values 39/40 and 69/70 behave inconsistently between the banner and player.

**Prevention:**

- Present readiness as a conservative planning aid, not diagnosis, injury prediction, or medical clearance.
- Persist input provenance, rule version, original session, modified session, and one-sentence rationale.
- Unknown stays unknown; never silently convert missing data into poor readiness.
- Apply deterministic boundaries: 70 and above planned; 40–69 reduced; 39 and below recovery, subject to clinician-approved stop rules that always override the score.
- Count recovery mobility or walking as on-target and never expose a streak-pressure bypass into the full session.
- Keep colors supportive and pair them with labels and actions.

**Verification:**

- Test 39, 40, 69, 70, missing, invalid, stale, and conflicting inputs.
- Confirm the modified session itself—not merely explanatory text—loses a set, caps effort, shortens intervals, or changes to recovery as specified.
- Test that a high score never bypasses an injury or symptom fence.
- Log yesterday's session and prove today's explanation changes from a fresh server read.

### Pitfall 9: “Same muscle” swaps violate movement or safety intent

**GSD owner:** Phase 7 owns basic swap interaction; Phase 10 owns the movement-purpose and safety substitution graph.

**What goes wrong:** Two exercises can train the same named muscle while differing materially in joint stress, balance demand, spinal loading, skill, equipment, impact, or contraindications. A knee-discomfort reason that simply offers another quadriceps exercise can make the member's problem worse. Preferences can also override safety if the scoring order is wrong.

**Warning signs:**

- Alternatives are grouped only by muscle name.
- A generated model chooses swaps directly.
- “Joint discomfort” is treated as a preference rather than a possible stop signal.
- Equipment availability is the only filter.
- The same disliked exercise repeatedly returns with no deterministic memory.
- A favorite or focus exercise outranks an active limitation.

**Prevention:**

- Model movement purpose, movement pattern, primary and secondary muscles, equipment, stability demand, impact, loaded joint positions, complexity, and vetted exclusions.
- Apply ordering: fixed safety exclusions first, then equipment and environment, then protocol purpose, then member preference.
- Route sharp pain, inability to bear weight, sudden loss of function, or other clinician-approved signals to a fixed stop-and-referral response instead of another exercise.
- Keep the three-try preference rule separate from safety. Never require three attempts through pain.
- Return only vetted deterministic alternatives; the coach may explain a choice but does not invent it.
- Detect cycles and ensure each protocol has a safe no-alternative outcome.

**Verification:**

- Use a substitution matrix covering every movement purpose, equipment setting, limitation, and protocol.
- Prove a safety exclusion always beats favorite, focus, and “just don't like it” preference scores.
- Test cycles, empty candidate sets, and repeated rejection.
- Clinical reviewer approves the taxonomy and fixed safety branches before production.

### Pitfall 10: Strength Score manufactures certainty about retained muscle

**GSD owner:** Phase 11 owns the Strength Score, checkpoints, education panel, and monthly scorecard.

**What goes wrong:** A bodyweight-adjusted strength number can rise simply because bodyweight fell while absolute performance stayed flat. Changes in exercise, equipment, range of motion, technique, fatigue, or logging quality can also move the score without reflecting tissue change. The product's emotional promise makes this especially dangerous: “proof the muscle held” is stronger than the data can support.

**Warning signs:**

- The score is presented without the raw performance anchor and bodyweight denominator.
- Missing movement groups are treated as zero or extrapolated.
- A machine press and dumbbell press are merged as the same measurement.
- The score updates after every noisy set while claiming a weekly trend.
- Copy says the loss “was fat, not muscle.”
- Chair-stand or grip results are described as diagnosis or whole-body muscle mass.

**Prevention:**

- Call it an estimated strength trend, not a muscle-mass measurement.
- Show relative and absolute anchors separately so denominator effects are visible.
- Compare standardized movement, equipment, unit, range-of-motion, and rep conditions; otherwise mark a new baseline.
- Require minimum coverage and data quality before calculating. Show “not enough comparable data yet” instead of fabricating a number.
- Freeze a documented weekly calculation version and preserve old versions for historical interpretation.
- Explain that the 30-second chair stand is a functional screen and grip reflects grip performance, not lower-body strength or a diagnosis.
- Use “consistent with strength being maintained” only when the evidence supports it; never state tissue composition as fact.

**Verification:**

- Golden-data tests cover bodyweight decrease with flat strength, strength increase with flat weight, missing groups, equipment changes, unit changes, partial sessions, and outliers.
- An independent reviewer reproduces every displayed score from the canonical events and documented formula.
- Copy audit removes causal or tissue-certainty claims.
- Clinical reviewer signs off on checkpoint instructions and interpretation.

### Pitfall 11: The shared nutrition scorecard develops two truths

**GSD owner:** Phase 11 owns the read-only workout integration; the nutrition surface remains the owner of nutrition facts.

**What goes wrong:** Workout code can reimplement protein hit-rate, trend weight, timezone, or unit rules and gradually disagree with the nutrition page. A shared component alone does not create shared truth if each route computes its inputs differently.

**Warning signs:**

- The workout route queries raw nutrition records and calculates hit-rate itself.
- “No entry” is displayed as “missed target.”
- Pounds and kilograms are mixed or converted in multiple components.
- The nutrition and workout pages disagree at a local-day boundary.
- A breaking payload change is deployed without a version or compatibility test.

**Prevention:**

- Give the nutrition domain one versioned, read-only summary contract. A **contract** is the documented shape and meaning of data exchanged between features.
- Put protein target logic, trend-weight logic, units, and local-day interpretation behind that contract.
- Distinguish missing, not applicable, and false explicitly.
- Make workout a consumer; it must not mutate nutrition truth.
- Add fields compatibly and maintain older contract versions until all consumers have moved.

**Verification:**

- Run the same member fixtures through both pages and compare serialized values, not screenshots alone.
- Cover daylight-saving changes, timezone travel, no-entry days, edited entries, kilograms, pounds, and target changes.
- Fail the release if either page can display a different monthly value for the same contract response.

### Pitfall 12: The coach bypasses authentication, safety fences, or confirm-before-write

**GSD owner:** Phase 12 owns coach unification, authentication, grounding, safety routing, and proposed actions.

**What goes wrong:** A language model is probabilistic and can follow a malicious instruction in chat history or grounded content. If it receives direct database tools, excessive permissions, or a client-supplied user identifier, it can write the wrong member's data, invent a swap, or turn symptoms into generated advice. Rate limiting is not authentication. The visible peptide-chat route pattern must not be copied without separately proving an Auth0 session and fixed server-side fences.

**Warning signs:**

- The route derives member identity from request JSON, email, or URL.
- The model can call a generic database mutation.
- “Please confirm” exists only in the prompt.
- Injury, medication, eating-disorder, or compulsive-exercise detection happens after generation.
- The model invents exercise identifiers or payload fields.
- An upstream provider error body is returned to the browser.
- Full conversations are logged automatically “for QA” without retention and access rules.

**Prevention:**

- Authenticate every request with the server-side Auth0 session and derive the canonical member identifier there.
- Apply fixed code fences before generation. Vetted injury, medication, eating-disorder, and compulsive-exercise signals return fixed templates and never reach the open-ended answer path.
- Let the model emit a narrow proposed intent only. Validate it against a server-owned allowlist, current member state, protocol rules, and exercise catalog.
- Require a new member gesture to confirm the exact proposed action. Confirmation creates the same stable event used by the normal logging path.
- Give the model no direct write credential and no generic mutation tool.
- Treat member text and retrieved content as untrusted. Never allow either to change system permissions.
- Map provider failures to a plain retry message. Log only a sanitized internal error code.

**Verification:**

- Attempt cross-user identifiers, prompt injection, fabricated exercise identifiers, replayed confirmations, altered proposal payloads, and stale proposals.
- Verify “sharp pain,” “can't lift arm,” dosing questions, and compulsive-exercise language return exact fixed templates with no generated continuation.
- Confirm the database remains unchanged before the member's explicit action.
- Force provider timeout, malformed output, and rate limit. The page must stay usable and reveal no upstream response body, secret, or private prompt.

### Pitfall 13: Sensitive health telemetry and coach transcripts become a shadow medical record

**GSD owner:** Phase 7 owns tap-count event minimization; Phase 12 owns conversation handling; Phase 13 owns retention, deletion, access, and security review.

**What goes wrong:** Readiness inputs, pain reasons, exercise limitations, medication questions, bodyweight, strength trends, and coach conversations can reveal sensitive health information even if Reset Biology is not a HIPAA covered entity. The FTC's Health Breach Notification Rule can apply to many health apps outside HIPAA. Debug logs, analytics payloads, error trackers, and copied provider prompts can silently create a broader and longer-lived record than the product needs.

**Warning signs:**

- Analytics accepts arbitrary event properties.
- Email, Auth0 identifiers, raw chat, readiness slider values, pain text, or database identifiers appear in browser requests or console logs.
- “QA logging” has no purpose, owner, access list, deletion mechanism, or expiry.
- A vendor receives health content before its retention and model-training behavior is verified.
- A user deletion removes workout rows but leaves logs, analytics, queues, backups, or coach transcripts.
- The product claims HIPAA compliance merely because the data is health-related, or claims HIPAA does not matter and stops the legal analysis there.

**Prevention:**

- Create a server-enforced telemetry allowlist containing coarse operational measures only, such as tap count, duration bucket, anonymous feature version, success or failure class, and commit identifier.
- Exclude free text, symptoms, medication, readiness details, bodyweight, exercise loads, access tokens, session identifiers, connection strings, and direct member identifiers.
- Set a written purpose, retention period, access role, deletion path, and audit trail for each store. A **TTL index** is a database rule that automatically expires records after a defined time; use one where suitable, but verify it rather than assuming immediate deletion.
- Keep coach QA collection off by default unless Jon ratifies a minimal redacted design and the external provider terms are verified.
- Complete counsel-led review for FTC, state privacy, breach notification, and any actual HIPAA relationship. Do not make categorical legal claims from product copy.
- Sanitize error inputs and prevent newline injection into logs.

**Verification:**

- Inspect network requests, browser storage, server logs, provider requests, and error payloads during normal use and forced failures.
- Search the captured evidence bundle for emails, tokens, connection strings, free-text symptoms, and raw conversations.
- Prove expiry, user deletion, and access control in an isolated test store.
- Record the vendor privacy and retention decision as a release gate, not an assumption.

### Pitfall 14: Authentication is present in the page but absent at the write boundary

**GSD owner:** Phase 6 owns identity inventory; every write phase owns server-side member binding; Phase 13 owns cross-user penetration tests.

**What goes wrong:** A protected page can still call an API that trusts a client-supplied member ID. Offline events make this worse because their payloads are durable and editable. A signed-in user may write to another member, or queued events from the previous account may sync after logout and login.

**Warning signs:**

- API routes accept `userId`, email, or Auth0 subject as authority from JSON.
- Logout does not quarantine the old account's queue.
- Service worker or IndexedDB data lacks an authenticated owner partition.
- A queue sync begins before the current server identity is confirmed.
- Read and write authorization use different identifiers.

**Prevention:**

- Derive identity only from the verified server session for every read and write.
- Bind each local queue partition to an opaque server-issued member key and halt sync when identity changes.
- On logout, close the local database handle, clear sensitive in-memory state, and require explicit safe handling of unsynced events.
- Validate ownership again when replaying; old authorization is not portable.
- Keep authentication errors distinct from network retries so unauthorized events do not loop.

**Verification:**

- Alter every client identity field and prove it has no authority.
- Queue an event, logout, login as another isolated test identity, and prove the event cannot sync.
- Test expired session, revoked session, unverified email, and account deletion.
- Read the canonical saved record and prove it belongs to the server-session member.

### Pitfall 15: The shared fixed header is repaired on `/workout` and broken elsewhere

**GSD owner:** Phase 6 owns the reconciliation fix; Phase 13 owns the shared-route visual matrix.

**What goes wrong:** `PortalHeader` is a shared component with fixed positioning. A wrap or truncation change that fixes a 390-pixel workout title can change header height, obscure page content, clip controls, or create horizontal scroll on other portal routes. Static desktop inspection will miss safe-area and long-title failures.

**Warning signs:**

- Only `/workout` is captured after changing the shared header.
- Page content assumes a hardcoded top offset that no longer matches the header.
- Long display names, auth loading state, or browser text scaling are not tested.
- A truncation fix removes access to the full title or a control.
- Horizontal scroll is hidden with `overflow-x-hidden` rather than fixing the child width.

**Prevention:**

- Treat the header as a consumer contract: maximum rows, stable control sizes, safe title shrink, safe-area inset, focus order, and documented content offset.
- Prefer minimum-width fixes, constrained wrapping, and explicit truncation over global overflow masking.
- Inventory every route using the component before editing it.
- Keep touch targets at least 40 pixels and test 200 percent zoom and long strings.

**Verification:**

- Capture every header consumer at 390 pixels, desktop, 200 percent zoom, signed-in, signed-out/loading, and long-name states.
- Measure zero horizontal overflow from the document root.
- Use Eye 1 for static text, values, clipping, and focus truth; the temporal eye verifies open/close and transition behavior. Blind verdicts come before comparison.

### Pitfall 16: Production proof is actually proof of an old commit or cached state

**GSD owner:** Every phase owns deployment binding; Phase 13 owns the final evidence manifest.

**What goes wrong:** `git push origin master` starts a deployment but does not prove that the requested commit is live. A `200` response may come from an older deployment, client router state, service worker, or cached data. Screenshots can be accurate and still belong to the wrong build.

**Warning signs:**

- Testing starts immediately after push without checking the production commit identifier.
- Evidence filenames omit commit, route, viewport, account, and time.
- A warm browser is the only production client.
- Build success is treated as proof that the live route uses the changed component.
- A service worker update can claim clients mid-session without a version receipt.

**Prevention:**

- Bind each recording and screenshot set to the exact Git commit identifier, meaning the immutable revision hash, and production deployment.
- Expose or inspect a safe build identifier that contains no secret; Vercel can provide `VERCEL_GIT_COMMIT_SHA` when system variables are enabled.
- Verify in both a fresh browser context and a controlled existing-member context.
- Keep the service worker versioned. Do not add a second hidden workout write queue to the existing worker while the page already owns one.
- Remember that Next.js 15 route caching, client router caches, and local data each have separate invalidation behavior. Read back from a new context after writes.

**Verification:**

- Prove the live build identifier equals the pushed commit before the test begins.
- Record request/response evidence for the actual `https://resetbiology.com/workout` route and its write APIs.
- Reload, hard-navigate, and open a fresh authenticated context after every material write.
- A static screenshot proves static truth only; countdowns, audio, loading, transitions, and duplicate suppression require temporal and server receipts.

### Pitfall 17: Production test cleanup deletes too much—or leaves persuasive fake history

**GSD owner:** Every phase owns its test ledger and cleanup; Phase 13 owns final restoration and residue audit.

**What goes wrong:** The authorized test account contains persistent plans, points, readiness, and workout history. A blanket cleanup can destroy legitimate baseline data. Incomplete cleanup can leave fake streaks, strength trends, protocol advancement, milestones, or points that make later tests pass for the wrong reason.

**Warning signs:**

- The phase starts without a baseline inventory.
- Test records have no run identifier or creation manifest.
- Cleanup means deleting “today's data” or all records for the account.
- The test creates a `DailyAward` but cleanup removes only the workout.
- A failed cleanup is reported as non-blocking.
- The UI appears correct only because prior test history remains.

**Prevention:**

- Before each write test, record the exact account identity, canonical baseline identifiers, totals, assignment, points, and local day.
- Tag every test-created event with a unique run identifier where the schema permits; otherwise keep an exact returned-identifier manifest.
- Delete or reverse only records created by that run, in dependency-safe order, and restore mutated baseline fields from the recorded snapshot.
- Never use broad date-based or account-wide deletion.
- Treat cleanup failure as a release hold.

**Verification:**

- Compare the post-cleanup canonical state to the pre-test manifest field by field.
- Check workout events, active session, protocol assignment, plan position, readiness, `DailyAward`, points ledger, milestones, calendar, score inputs, coach actions, and offline queues.
- Open a fresh context after cleanup and prove no test residue remains.

### Pitfall 18: Credential rotation updates the app but leaves the exposed credential alive

**GSD owner:** Phase 13 security closeout, with a named human operator for Atlas and Vercel dashboard actions.

**What goes wrong:** Replacing the string in `CLAUDE.md` or updating the Vercel environment does not revoke a credential already present in public Git history. Rotating the existing password before the new path is live can cause an outage; leaving the old database user enabled preserves the breach. A successful page load is not enough because it may not touch MongoDB.

**Warning signs:**

- The closeout says “removed from file” but not “old database user revoked.”
- The replacement secret is prefixed `NEXT_PUBLIC` or placed in `next.config` environment configuration, which would expose it to browser bundles.
- No fresh deployment follows the dashboard environment change.
- Verification checks only static pages or an existing pooled connection.
- The old credential is printed into terminal output, screenshots, CI logs, or the final report.
- The new user retains broad Atlas roles unrelated to this app.

**Prevention:**

- Create a new named, least-privilege Atlas database user first.
- Enter the new secret only through the Vercel dashboard server environment. Never place it in a client-exposed environment variable or committed file.
- Trigger the fresh deployment through the required `git push origin master` path, then wait for and prove the exact live commit.
- Exercise authenticated DB-backed reads and writes with the new connection.
- Revoke or delete the old Atlas database user. Removing the public text is hygiene; revocation is containment.
- Replace the committed plaintext with an environment-variable pointer. Do not rewrite public history as a substitute for revocation.
- Never show either secret. A negative test reports only that a fresh connection with the old credential was rejected.

**Verification:**

- Prove the live deployment's exact commit and complete several database-backed paths using the new credential.
- After revocation, open a fresh isolated connection using the old credential and capture only the authentication-failed result, fully redacted.
- Inspect Atlas user state and activity receipt without revealing secret material.
- Search the current tree and generated browser bundle for the known secret pattern using redacted output.
- Restart or replace any relevant pooled connection before declaring the old credential dead; an already-open pool is not a valid negative test.

## Moderate Pitfalls

### Pitfall 19: Local-day and daylight-saving drift corrupts continuity

**GSD owner:** Phase 7 owns event day keys; Phase 11 owns calendar and habit continuity.

**What goes wrong:** UTC slicing, device timezone changes, and daylight-saving transitions can move a late workout to another day, award readiness twice, or break a rest shield. A calendar heatmap can look plausible while its ledger is wrong.

**Warning signs:** Any workout code uses `toISOString().slice(0, 10)`, constructs a day from a bare UTC timestamp, or calculates consecutive days as fixed 24-hour gaps.

**Prevention:** Use the existing `src/lib/localDay.ts` for every day operation. Persist the canonical local day and relevant timezone context at event creation, within the existing drift bound. Define how travel affects an already-created event.

**Verification:** Test spring-forward, fall-back, month/year boundary, near-midnight, timezone travel, and replay after travel. Reconcile calendar, points, readiness, weekly target, and rest shields to one ledger.

### Pitfall 20: Partial completion and express mode inflate adherence or block honest continuation

**GSD owner:** Phase 8 owns partial completion; Phase 11 owns express and continuity rules.

**What goes wrong:** “You showed up” can accidentally become full clinical dose credit, full plan advancement, or a second award when the member later resumes. Conversely, marking partial as failure undermines the adherence-neutral design.

**Warning signs:** One Boolean named `completed` drives points, plan advancement, Strength Score inclusion, and protocol dose; express and recovery have no explicit types.

**Prevention:** Store explicit session outcome and dose: full, partial, express, recovery, safely stopped, and abandoned-before-start. Define independently what each outcome does to history, weekly target, points, plan progression, strength calculation, and readiness load.

**Verification:** Test finish early before and after each exercise, resume, convert to express, recover day, and safe stop. Prove the UI copy and every downstream calculation agree.

### Pitfall 21: The old service worker becomes a second source of queue truth

**GSD owner:** Phase 7 owns offline architecture; Phase 13 owns update and recovery proof.

**What goes wrong:** The repository already has a service worker for push notifications. Adding write replay there while Dexie and the page also manage replay creates duplicate senders and upgrade races. Caching authenticated responses can expose one account's data to another or serve stale plans.

**Warning signs:** Both page code and service worker register background sync; authenticated API responses are placed in a broad cache; worker activation uses immediate claim without an in-session compatibility plan.

**Prevention:** Choose one write-queue owner. For v2, keep Dexie as the durable local event journal and one elected foreground sync leader unless a later, separately researched background-sync phase proves value. Do not cache authenticated workout API responses in the service worker. Version worker messages and tolerate old clients during update.

**Verification:** Upgrade the worker with an active session and pending events, close/reopen, switch accounts, and go offline. Prove no duplicate sender, no cross-account cache, and no lost event.

### Pitfall 22: Accessibility is postponed until the state machine is expensive to change

**GSD owner:** Phases 7–12 own accessible behavior as built; Phase 13 audits rather than invents it.

**What goes wrong:** Color-only readiness, a visually giant but semantically silent timer, focus lost during full-screen transitions, or motion-heavy GO states can make the player unusable. Retrofitting announcements after the timer architecture hardens creates churn.

**Warning signs:** Timer updates announce every second to a screen reader; color is the only state; focus jumps to the document body; reduced-motion merely turns off CSS while JavaScript animation continues; swap and finish controls are below 40 pixels.

**Prevention:** Give every state a text label, expose useful numbers in accessible names, announce block changes rather than every tick, preserve logical focus, support keyboard operation, and use reduced-motion state from the start. Audio never replaces visible and textual information.

**Verification:** Keyboard-only, screen-reader, 200 percent zoom, reduced-motion, muted-audio, high contrast, and color-vision checks at each player phase. Measure targets and horizontal overflow at 390 pixels.

## Phase-Specific Warning Map

| GSD phase | Highest-consequence pitfall | Release-blocking proof |
|---|---|---|
| 6 — foundation and reconciliation | Old/new schema mismatch; dead-shadow edit; shared-header regression | Live assignment for REHIT and two other protocols, production index/schema inventory, all header consumers at 390 pixels, exact live commit |
| 7 — logging and offline journal | Duplicate events; cross-account queue; multi-tab collision | Same event replayed across tabs and isolated relay with one canonical write; logout/login isolation; queue crash recovery |
| 8 — guided players | Timer drift; silent audio; unsafe crash resume; double completion | Deadline/frame citations, audio-bearing receipt, background/sleep matrix, one completion/advance/award under concurrency |
| 9 — readiness prescription | Score without actual modification; threshold disagreement; coercive override | Boundary matrix at 39/40/69/70; visible deterministic session change; high score cannot override fixed safety signals |
| 10 — substitution intelligence | “Same muscle” violates joint, movement, or protocol purpose | Clinician-approved substitution matrix; safety exclusions outrank preference; safe empty-state proof |
| 11 — evidence and habit layer | Strength Score claims muscle tissue certainty; nutrition contract drift; local-day errors | Independent formula reproduction, denominator-artifact fixtures, shared-contract parity, daylight-saving calendar ledger |
| 12 — coach | Missing server authentication; generated safety advice; direct model writes | Cross-user and injection attacks fail; fixed safety templates; no mutation before fresh member confirmation |
| 13 — craft, telemetry, security, final proof | Sensitive data leakage; wrong production commit; incomplete cleanup; old credential remains live | Redacted telemetry audit, exact commit-bound evidence, baseline restoration, fresh old-credential authentication failure |

## Non-Negotiable Evidence Boundaries

| Claim | What can prove it | What cannot prove it |
|---|---|---|
| Text, values, clipping, and layout are correct | Looked-at screenshots from the exact production commit and viewport | A clean build or component snapshot alone |
| Countdown and GO state change at the right time | Video with frame/time citations tied to the exact commit | Still screenshots |
| Audio cue was audible | Recording with an audio track or synchronized waveform and cited timestamps | Silent video, console log, or scheduled-node assertion alone |
| A write happened exactly once | Fresh canonical server/database read after concurrent replay | One toast, disabled button, or one network response |
| The correct member was written | Server-session identity plus canonical ownership read | Client-provided email or user identifier |
| The old database credential is dead | Fresh isolated authentication attempt fails after Atlas revocation | Removing it from the current file or seeing the app work with the new secret |
| Test data is clean | Pre/post canonical manifest equality | A visually empty current screen |
| Production contains the change | Live build identifier equals the commit under test | Successful push, successful build, or HTTP 200 alone |

## GSD Release-Hold Rules

Stop the phase and do not promote when any of these is true:

- The local tree is not committed and clean before blind verification.
- A verifier received the worker's reasoning instead of only the ticket, diff, and acceptance criteria.
- A write-path test ran outside the isolated relay or lacks canonical read-back.
- A visual or temporal receipt cannot be tied to the exact production commit.
- A silent video is being offered as audio proof.
- Production test cleanup does not return the account to its recorded baseline.
- Any citation, contraindication, stopping rule, or honesty language was weakened.
- Any new points value is enabled without Jon's ratification.
- The coach can mutate without a fresh member confirmation.
- The old MongoDB credential can still authenticate.
- A deviation from the master build is missing its da Vinci entry: what changed, why it is better, evidence, risk, and rollback.

## Sources

### Browser timing, locks, audio, and wake behavior

- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) — background tabs stop animation frames and throttle timers. **Confidence: HIGH.**
- [Chrome: Background tabs timer throttling](https://developer.chrome.com/blog/background_tabs) — documents background timer budget behavior. **Confidence: HIGH.**
- [MDN: `setTimeout`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout) — callbacks can run late, including intensive background throttling. **Confidence: HIGH.**
- [MDN: Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) — same-origin tab and worker coordination. **Confidence: HIGH.**
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) and [IDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) — durable browser data and transaction scopes. **Confidence: HIGH.**
- [MDN: Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) and [autoplay behavior](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) — user-gesture and suspended-context constraints. **Confidence: HIGH.**
- [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — rejection, release, visibility, and support constraints. **Confidence: HIGH.**

### Database and deployment

- [Prisma: MongoDB connector](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/mongodb) — replica-set transaction requirement, missing-versus-null behavior, and MongoDB schema workflow. **Confidence: HIGH.**
- [Prisma: `db push`](https://docs.prisma.io/docs/cli/db/push) and [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate) — `db push` has no migration history and Prisma Migrate does not support MongoDB. **Confidence: HIGH.**
- [MongoDB: Unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/) and [index properties](https://www.mongodb.com/docs/manual/core/indexes/index-properties/) — duplicate, missing-value, partial-index, and build constraints. **Confidence: HIGH.**
- [Prisma: Transactions and batch queries](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — transaction and concurrency semantics. **Confidence: HIGH.**
- [Next.js: Environment variables](https://nextjs.org/docs/app/guides/environment-variables) — browser exposure of `NEXT_PUBLIC` variables. **Confidence: HIGH.**
- [Next.js: `next.config.js` environment variables](https://nextjs.org/docs/pages/api-reference/config/next-config-js/env) — configured values are included in the JavaScript bundle. **Confidence: HIGH.**
- [Next.js 15 release notes](https://nextjs.org/blog/next-15) and [caching guide](https://nextjs.org/docs/15/app/guides/caching) — route and client cache behavior. **Confidence: HIGH.**
- [Vercel: Environment variables](https://vercel.com/docs/environment-variables), [deployment management](https://vercel.com/docs/deployments/managing-deployments), and [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables) — deployment-scoped environment changes and commit identifiers. **Confidence: HIGH.**
- [MongoDB Atlas: Database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/) — roles, password changes, cluster restrictions, and user deletion. **Confidence: HIGH.**

### Authentication, AI actions, and privacy

- [Auth0: Next.js quickstart](https://auth0.com/docs/quickstart/webapp/nextjs) and [Auth0 Next.js SDK](https://auth0.github.io/nextjs-auth0/) — server-side session patterns for App Router routes. **Confidence: HIGH.**
- [OWASP: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) — minimize model functionality, permissions, and autonomy. **Confidence: HIGH.**
- [OWASP: Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) — excludes health data, tokens, credentials, and other sensitive values from logs. **Confidence: HIGH.**
- [FTC: Health Breach Notification Rule](https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule), [2024 amendments](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule), and [business basics](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business) — application to many consumer health apps outside HIPAA. **Confidence: HIGH for the rule; product applicability requires counsel.**
- [HHS: Covered entities and business associates](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html) — HIPAA status depends on entity and relationship, not merely health-related data. **Confidence: HIGH.**

### Clinical honesty and workout safety

- [ACSM: Updated preparticipation screening recommendations](https://journals.lww.com/acsm-msse/fulltext/2015/11000/updating_acsm_s_recommendations_for_exercise.28.aspx) — symptom and screening considerations for exercise participation. **Confidence: HIGH.**
- [REHIT perceptual responses, PubMed 31622613](https://pubmed.ncbi.nlm.nih.gov/31622613/) — generally positive response with more aversive responses among some lower-fitness participants. **Confidence: HIGH.**
- [CAROL: Controlled resistance design](https://carolbike.com/bike-cards/optimal-design/) — official product description of computer-controlled resistance; useful for defining what a phone cannot reproduce. **Confidence: MEDIUM because it is a manufacturer source.**
- [SURMOUNT-1 DXA substudy, PubMed 39996356](https://pubmed.ncbi.nlm.nih.gov/39996356/) — body composition context without supporting individual tissue-certainty claims from workout logs. **Confidence: HIGH.**
- [EWGSOP2 consensus, PubMed 30312372](https://pubmed.ncbi.nlm.nih.gov/30312372/) — distinguishes muscle strength, quantity, and physical performance. **Confidence: HIGH.**
- [30-second chair-stand validation, PubMed 10380242](https://pubmed.ncbi.nlm.nih.gov/10380242/) — supports a standardized functional screen in the studied population, not diagnosis. **Confidence: HIGH.**
- [Fitness apps and disordered eating, PubMed 39671845](https://pubmed.ncbi.nlm.nih.gov/39671845/) — supports caution around compulsive or rigid app mechanics. **Confidence: MEDIUM for direct application to this product.**

## What Still Needs Phase-Specific Research

- The precise clinician-approved REHIT eligibility, equipment, progression, and stop-signal copy before Phase 8 implementation.
- A vetted movement-purpose and joint-position taxonomy before Phase 10 substitution data is authored.
- The exact Strength Score formula, minimum coverage, and wording before Phase 11; the roadmap must not treat “proof the muscle held” as an accepted claim.
- The nutrition summary contract and its current owner before Phase 11 integration.
- Cloudflare Workers AI data use, retention, geographic processing, and contractual settings before Phase 12 sends any sensitive member context.
- Counsel review of telemetry, conversation retention, breach notification, deletion, and state privacy obligations before Phase 13.
