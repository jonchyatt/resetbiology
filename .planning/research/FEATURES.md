# Feature Landscape: Muscle-Preservation Engine

**Domain:** Consumer workout guidance for people losing weight or using/tapering a GLP-1 medicine  
**Researched:** 2026-07-21  
**Overall confidence:** HIGH for product conventions and the broad value of resistance training during energy restriction; MEDIUM for digital adherence mechanisms; LOW-to-MEDIUM for GLP-1-specific muscle-preservation outcomes because the direct resistance-plus-protein randomized trial is still a protocol.

## Product Outcome

The product can validly optimize one observable outcome: **help a member complete safe, progressive resistance and conditioning sessions consistently while preserving a trustworthy record of strength, function, protein coverage, and body-weight context**.

It cannot directly measure retained skeletal muscle. A flat or rising strength trend while weight falls is encouraging and can be described as **consistent with muscle retention**, but it is not proof that lost weight was fat. Strength also changes with technique, neural adaptation, exercise familiarity, hydration, effort, equipment, pain, and body mass.

This distinction should shape the entire feature hierarchy:

1. Make the next safe action effortless.
2. Preserve comparable, repeat-safe observations.
3. Explain adjustments and uncertainty.
4. Present a multi-signal evidence picture rather than a diagnostic verdict.

## Audit of the 13% Weight-Loss / 3% Muscle-Loss Claim

**Verdict: do not publish this as a 2025 randomized-trial result.** No primary randomized outcome paper matching “GLP-1 plus resistance education plus individualized protein produced about 13% weight loss with only about 3% muscle loss” was found.

The closest identifiable report is a 2025 European Congress on Obesity press report about a six-month prospective cohort of 200 adults taking semaglutide or tirzepatide. Everyone received general guidance on medication use, resistance training, and adequate protein. Body composition was measured with an InBody bioelectrical-impedance device. Men lost 13% of body weight and women 12%, while the report gave muscle change in kilograms rather than a validated “3% muscle loss” endpoint. There was no randomized comparator that could isolate resistance training, protein guidance, medication, adherence, or selection effects. The corresponding press report also said adherence analyses were still being completed.

A later peer-reviewed retrospective study of 269 adults in a multidisciplinary program reported skeletal-muscle-mass maintenance from six to twelve months alongside twice-weekly strength training and sufficient protein. It used an InBody device, had no control group, and explicitly could not support causal conclusions.

The direct four-arm LEAN-PREP randomized trial is the right design: 232 adults starting semaglutide or tirzepatide are assigned to control, resistance exercise, protein supplementation, or both, with magnetic-resonance-imaging-measured quadriceps area as the primary outcome. As of this research, the publication is a **trial protocol**, not an outcome trial.

The randomized SURMOUNT-1 body-composition substudy is useful context but does not test the proposed exercise-plus-protein package. Among 160 participants with dual-energy X-ray absorptiometry data, tirzepatide reduced weight by 21.3%, fat mass by 33.9%, and lean mass by 10.9%; about 25% of lost weight was lean mass in both tirzepatide and placebo groups. It therefore supports honesty about mixed tissue loss, not a claim that coaching already solves it.

**Allowed public framing:**

> Resistance training is one of the best-supported ways to protect strength and lean mass during weight loss. Direct trials testing the best resistance-and-protein strategy during semaglutide or tirzepatide treatment are still underway.

**Not allowed:**

- “Clinical evidence is settled.”
- “This program prevents muscle loss.”
- “Only 3% muscle loss.”
- “Your Strength Score proves the weight you lost was fat.”
- Any use of the 13%/3% figures without naming the observational design, measurement method, and uncertainty.

## Table Stakes

Missing these makes the workout surface feel unreliable or unsafe.

| Feature | Observable member behavior | Complexity | Dependencies and acceptance boundary | Evidence confidence |
|---|---|---:|---|---|
| One assigned action for today | Member lands on one primary session and can start without browsing a library | Medium | Requires a complete, named, versioned assignment and deterministic day selection; express and recovery are explicit escape hatches | MEDIUM: simple, structured interfaces and tailoring are associated with app engagement; the “one decision” mechanism itself is a product hypothesis |
| Comparable target prefill | Each working set shows the last successful comparable weight and repetitions, or a protocol target when no valid history exists | High | Requires canonical exercise identity, unit normalization, equipment/variation identity, completed-set provenance, and stale-history rules; never copy from a different movement variant silently | HIGH as a category convention; clinical outcome effect not established |
| One-tap set confirmation with immediate undo | A normal straight set logs with one tap; an accidental tap can be reversed without a modal | High | Every action needs a client-generated repeat-safe identifier; the undo must compensate the event rather than erase history invisibly | HIGH as a usability requirement; repeat safety is a data-integrity requirement |
| Deadline-based rest timer | Confirming a set starts the correct warm-up or working-set rest period; backgrounding the phone does not create drift | Medium | Store an absolute end time, not only a decrementing counter; allow early next-set logging and member adjustment; audio and screen cues both work | HIGH as a mature category convention, documented by Strong and Hevy |
| Interruption-safe session journal | Refresh, crash, weak connectivity, tab suspension, or phone sleep returns the member to the last accepted action without duplicates | High | Requires local event journal, reconciliation status, immutable identifiers, deterministic replay, and an explicit resume/discard choice | HIGH as reliability engineering; not a clinical claim |
| Finite session contract | Before starting, member sees exercises, estimated duration, hard-work duration, and approximate finish time | Low | Estimate must update when a mode or timer changes; call it an estimate | MEDIUM: time is a known participation barrier; exact retention effect needs product telemetry |
| Current action plus next action | During exertion, the member can answer “what now?” and “what next?” at a glance | Medium | Strength and interval modes share one state-machine concept; screen remains sufficient without sound | HIGH as an exertion-interface requirement; direct outcome evidence is not required |
| Honest partial finish | Member can end early, retain completed work, and receive neutral copy | Medium | Partial and complete states must remain distinct; no fabricated completion, point duplication, or shame language | MEDIUM: abandonment literature supports reducing burden; exact copy effect is a product hypothesis |
| Safe in-session swap | Member gets two or three alternatives that preserve training purpose, movement pattern, equipment, skill demand, readiness, and contraindications | High | Same-muscle matching alone is insufficient; requires reviewed exercise metadata and fixed pain/injury routing | HIGH as program-integrity and safety logic; specific ranking can be tested |
| Form and stopping rules in context | Member can open reviewed demonstration/cues and the protocol stopping rules without leaving the session | High | Media must be clinically reviewed, accessible, bandwidth-tolerant, and version-bound to the exercise; do not generate anatomical instruction | HIGH as beginner and safety requirement |
| Readiness-linked adjusted plan | Each readiness result visibly changes or affirms today’s plan and states what changed and why | High | Preserve original plan, adjusted plan, reason, input snapshot, and rule version; thresholds are product rules, not validated medical cutoffs | MEDIUM for autoregulated resistance training; LOW for claims that a consumer readiness score prevents injury or dropout |
| Recovery day as valid completion | A recovery-tier member sees walking/mobility as today’s on-target plan and continuity remains intact | Medium | Full-session override stays unavailable when fixed safety rules select recovery; member can always stop | MEDIUM as adherence-neutral product design; not proof of better clinical outcomes |
| REHIT eligibility and stopping gate | Member must acknowledge relevant contraindications/stopping rules before an all-out interval player starts | High | Use protocol-library-reviewed content and exercise preparticipation rules; the app does not grant medical clearance | HIGH for the need to screen vigorous exercise; protocol eligibility content requires clinical owner |
| Audio-independent interval guidance | Final-three-second cues work when sound is permitted, while color plus text remain fully usable in silence | Medium | Add a pre-session sound check; Web Audio can lower only page-owned sound and cannot promise to duck Spotify or another app | HIGH as platform truth and accessibility requirement |
| Local-day-correct history | Sessions, readiness, points, and calendar drill-in agree on the member’s day across time zones and midnight | Medium | Reuse the shared local-day authority and preserve original timestamps | HIGH |
| Designed empty, loading, and failure states | A new member sees a warm start; failed network calls expose inline retry; no blank page or layout jump | Medium | Every async surface has explicit states and screen-reader announcements | HIGH |
| Accessible floor-and-phone mode | At 390 pixels the main action is thumb-reachable, timer is legible at arm’s length, controls are at least 44 by 44 pixels where practical, focus is visible, and no meaning depends on color | High | Verify normal motion and reduced motion separately; keyboard and screen-reader paths remain complete | HIGH |

## Differentiators

These features turn a competent logger into a muscle-preservation product while staying honest.

| Feature | Member value | Complexity | Required foundation | Evidence boundary |
|---|---|---:|---|---|
| **Muscle-Preservation Evidence Ladder** | Replaces an opaque verdict with a layered view: training consistency, comparable strength anchors, functional checkpoints, protein coverage, and weight trend | High | Shared nutrition/workout contract; comparable strength observations; measurement provenance | Never says tissue was measured. Leads with “consistent with,” “uncertain,” or “not enough comparable data.” |
| **Confidence Passport** | Every score or insight says which inputs support it, their recency, coverage, comparability, rule version, and what would increase confidence | High | Provenance on all inputs; deterministic confidence rules | Confidence describes data quality, not probability of medical benefit |
| **Purpose-Preserving Rescue Ladder** | A member can move from full to reduced to express to recovery without abandoning the day or losing the session’s intent | High | One canonical plan compiler that produces all variants; safety and movement-purpose metadata | Does not claim variants are physiologically equivalent; states what dose changed |
| **Return Ramp** | After a meaningful gap, stale loads are not blindly presented as current; the session eases back in and explains why | Medium | Last-comparable-session age, configurable rule version, no hard-coded medical claim | Exact gap and reduction values need clinical/program review; Fitbod documents a similar category behavior |
| **Last-Working-Set Effort Check** | One optional three-choice prompt—“3+ reps left / 1–2 / none”—adds context for progression without burdening every set | Medium | Beginner explanation, optional input, no safety reliance, trend calibration | Repetitions-in-reserve supports autoregulation but novice accuracy varies; never present as measured capacity |
| **Explainable Progression Suggestion** | Member sees “match,” “add repetitions,” or “add the smallest available load,” plus the reason and an easy decline | High | Comparable target history, effort check, completion quality, equipment increments, deterministic double-progression rules | Suggestion is educational; no automatic hidden load increases |
| **Movement-Purpose Swap Graph** | Alternatives preserve why the movement exists—horizontal push, knee-dominant lower body, hinge, carry—not merely a broad muscle label | High | Reviewed graph of movement pattern, role, equipment, skill, joint demands, and contraindications | The graph is program metadata, not an injury-diagnosis engine |
| **Preference Learning With Visible Memory** | Repeated “no equipment,” “not for me,” or safe non-pain swaps improve future choices; member can inspect and reset preferences | Medium | Explicit preference events separated from sensitive symptom data | No black-box claim; pain details are not analytics or preference-ranking signals |
| **Manual-Hardware Honesty Mode for REHIT** | A phone can guide timing and safety on compatible equipment without pretending it controlled resistance, measured power, or reproduced a CAROL Bike | Medium | Equipment declaration, reviewed protocol modality, preflight wording, optional self-reported effort | Critical: without controlled resistance/power, do not claim CAROL-equivalent stimulus or personalized REHIT efficacy |
| **Cue Preflight** | Before an interval starts, member verifies volume, screen visibility, reduced-motion behavior, and stopping control | Low | Audio initialization must occur after user gesture; visual cue always primary-equivalent | Prevents a silent or surprising first sprint; not a clinical intervention |
| **What Changed / Why / What Next** | Every readiness or rescue adjustment names the exact set, intensity, or duration change and how tomorrow is determined | Medium | Plan diff renderer, deterministic rules, immutable original plan | Avoids “AI decided” copy and makes the system auditable |
| **Estimated Freshness With Edit-and-Explain** | Body map shows estimated training exposure and time since training; tapping a region shows the observations behind it | High | Exercise-to-muscle contribution map, recent set events, known missing activity, readiness context | Always uses “estimated”; no percentage should imply measured tissue recovery |
| **Just-Right Activity Path With Data-Gap State** | Rest sits inside the desired band; missing logs appear as unknown rather than zero effort | High | Versioned load model, planned and observed session data, imported-data provenance if later added | No injury-risk prediction; no false certainty from incomplete external activity |
| **Functional Checkpoint Protocols** | Optional 30-second chair stand and dynamometer grip entries give members repeatable function signals beyond scale weight | Medium | Standardized instructions, same setup reminders, device/unit provenance, age-scope copy | Screens/trends, not diagnoses. Chair-stand validation is strongest in older adults; grip does not represent lower-body strength |
| **Member-Owned Proof Receipt** | Monthly report lists exactly what was observed, what was inferred, and links to sources; it can be exported or shared only on member action | High | Evidence ladder, provenance, consented export/share card | Avoids social comparison and does not call itself a medical report |
| **Private Tap-Cost Telemetry** | Product measures taps to first set, taps per straight set, interruption/resume, timer skip, swap success, and completion without collecting loads, pain text, medication, or transcripts | Medium | Coarse event schema and retention limits | Product optimization only; not health monitoring |

## State-of-the-Art Upgrades Beyond the Original List

### 1. Lead With an Evidence Ladder, Not the Strength Score

The emotional promise should be “here is the best evidence your work is holding,” not “one number proves your muscle held.” A composite can remain as a compact trend, but it must be subordinate to five independently inspectable signals:

1. **Exposure:** completed resistance sessions and major movement-pattern coverage.
2. **Performance:** same-exercise, same-setup strength anchors with comparability checks.
3. **Function:** standardized chair-stand and optional grip trends.
4. **Support:** protein-target coverage from the nutrition product, with source and missing-data state.
5. **Context:** trend weight and rate of change, without inferring tissue composition.

The panel should explain why confidence rose or fell—for example, “three stable anchors across push, pull, and knee-dominant work; hinge data is missing.” This is more state-of-the-art than a single opaque score because it is calibrated, actionable, and falsifiable.

### 2. Build One Rescue Ladder Instead of Four Separate Session Products

Full, reduced, express, and recovery should be deterministic variants of one canonical assigned plan. The member can slide down the ladder when readiness, time, or interruption changes, while the product preserves the session’s purpose and explicitly names the removed dose. This avoids contradictory logic between readiness, express mode, “finish early,” and recovery days.

Observable acceptance behavior:

- A member can switch mode mid-session without duplicated sets or losing completed work.
- The next action updates immediately.
- The history stores both the intended plan and the delivered dose.
- Copy says “shorter version” or “recovery version,” never “equivalent workout.”

### 3. Add Immediate Undo and Session-Level Reconciliation

One-tap logging increases accidental taps. A visible, time-bounded undo for the most recent set is necessary, but the data model should retain an auditable compensating event. When offline events later sync, the member gets one quiet reconciliation result; conflicts never create duplicate workouts or points.

### 4. Make “Return After a Gap” a First-Class State

Last-session prefill becomes unsafe and discouraging when the last comparable session is stale. After a rule-defined gap, show the old result as context but seed a conservative return target and say why. The exact gap and reduction belong to the reviewed program rules, not an improvised interface constant.

### 5. Treat Manual REHIT as a Timing Coach, Not Smart-Bike Emulation

CAROL’s own material says its distinctive behavior depends on computer-controlled resistance tailored and applied at the correct moment. A browser without bike telemetry cannot verify power, resistance, cadence, or maximal effort and cannot reproduce that mechanism. The upgraded player should:

- Name the compatible modality and equipment the seeded protocol expects.
- Ask the member to set resistance according to reviewed instructions.
- Guide timing, color, text, audio, recovery, and stopping rules.
- Optionally record perceived effort after the sprint.
- Never claim it personalized resistance, verified maximal effort, or delivered a CAROL-equivalent dose.

### 6. Use One Optional Effort Signal, Not More Logging

Repetitions-in-reserve can improve progression context, but asking after every set violates the low-friction constitution. Capture one optional effort response after the final working set of an exercise. If absent, progression remains conservative and based on completed comparable work. If present, it can influence a transparent suggestion but never readiness clearance or injury logic.

### 7. Show Unknown Data as Unknown

A missing workout, missing protein day, equipment change, or untracked external activity must not become zero. The activity path, freshness estimate, and evidence ladder each need an explicit insufficient-data state. This single rule prevents false precision across the milestone.

## Anti-Features

These should be explicitly rejected even if competitors use them.

| Anti-feature | Why avoid it | What to do instead |
|---|---|---|
| Opaque “muscle retained” verdict | Strength and scale data cannot measure tissue composition | Evidence ladder with confidence, coverage, provenance, and “consistent with” language |
| Readiness as medical clearance | Self-report score thresholds are not validated clearance or injury prediction | Call it today’s adjusted training plan; keep fixed symptom and stopping gates separate |
| Acute-to-chronic workload injury prediction | Evidence is heterogeneous and athlete-derived; consumer data are incomplete | Explain recent load and plan changes without forecasting injury |
| Same-muscle-only substitutions | Can replace a staple with a different movement purpose, skill burden, or contraindication | Movement-purpose and safety graph with reviewed alternatives |
| Automatically increasing load | Hidden progression can create surprise, mismatch equipment, or exceed confidence | Explainable suggestion with one-tap accept/adjust/decline |
| Reusing stale last-session loads | A gap, equipment change, or illness makes old performance noncomparable | Return ramp with old value shown as context only |
| Universal REHIT suitability | All-out sprinting is vigorous exercise and aversive responses were more common among lower-fitness participants in one REHIT study | Eligibility/stopping gate, familiarization/progression from protocol content, and non-REHIT alternative |
| CAROL-equivalence without controlled hardware | Browser timing cannot reproduce controlled resistance or verify the intended stimulus | Manual-hardware honesty mode |
| Audio-only countdown or promise to duck other apps | Browser audio cannot reliably control third-party music, and sound may be unavailable | Text, color, and optional owned-audio cues with preflight |
| Punitive streak, broken-ring alarm, leaderboard, or body comparison | Tracking technologies are associated cross-sectionally with guilt, excessive exercise, body-image concerns, and disordered eating; causality is not proven, but this population warrants conservative design | Weekly target, cumulative sessions, quiet forgiveness, vacation mode, private milestones |
| Points for training through recovery guidance | Creates direct pressure to ignore protection | Recovery plan earns the existing completion treatment; no bonus for overriding |
| Medication-dose-driven workout changes | It invites medication advice, requires sensitive dosing data, and exceeds scope | Adapt to member-reported readiness and fixed symptom fences without interpreting dose |
| Coach-generated injury advice | Language generation is not a clinical assessment | Fixed stop-and-referral templates and confirm-before-write actions |
| Generated exercise anatomy or form media | Plausible-looking errors can cause harm | Clinically reviewed media/cues only |
| Silent data repair or reseeding | Can mutate durable clinical content and hide malformed prescriptions | Pure versioned readers that reject ambiguity visibly |
| Raw pain, load, transcript, medication, or health-note analytics | Creates privacy risk with little product-learning value | Coarse, nonclinical tap-cost and reliability telemetry only |
| “Two forgiven misses” foregrounded as currency | Turns compassion into another resource the member can lose | Apply forgiveness silently; explain continuity rules only on request |

## Unsupported or Overstated Claims Register

| Proposed claim | Finding | Safe replacement |
|---|---|---|
| “Clinical evidence is settled” | False. Resistance training during energy restriction is supported; direct semaglutide/tirzepatide resistance-plus-protein outcome trials remain incomplete | “Evidence supports resistance training during weight loss; the best GLP-1-specific strategy is still being studied.” |
| “13% loss with only 3% muscle loss in a 2025 trial” | No matching randomized outcome paper verified; closest report is uncontrolled and uses bioelectrical impedance | Remove numeric headline or label the observational source and limitations in an education card |
| “Two-thirds of lost weight returns within one year” | Weight regain after stopping medication is well supported, but the exact fraction varies by medicine, exposure, follow-up, and analysis | “Weight regain is common after treatment stops; structured exercise may improve maintenance.” |
| “Resistance training 3–5 times per week decides whether loss is fat or muscle” | Directionally overstates frequency specificity and causality | “Regular resistance training helps protect strength and lean mass during energy restriction.” |
| “Retention is the treatment” | Useful product philosophy, not an established clinical causal estimate | “Consistency is the behavior this product is designed to protect.” |
| “Readiness adjustment reduces overreach and dropout” | Direct evidence for these consumer thresholds and this population was not verified | “The adjustment is designed to make the plan more manageable and reduce avoidable overreach.” |
| “REHIT is as enjoyable as steady-state precisely because the hard part is short” | REHIT can produce positive affect; lower-fitness participants had more aversive responses. The causal “precisely” is unsupported | “Many participants rate the very short format positively, but responses vary; choose the safer alternative if it feels wrong.” |
| “Strength Score proves the loss was fat, not muscle” | False; performance is indirect and confounded | “Stable performance while weight falls is consistent with muscle retention.” |
| “73% of fitness apps fail beginners” | No primary source verified for this number | State the design observation without a percentage: “Many exercise products assume lifting knowledge.” |
| “Coordination-heavy movements lose 75% of users after one try” | No primary source verified for this number | Treat staple-first exercise choice as a product hypothesis and measure swap/return behavior privately |
| “Choice paralysis is a top-three quit driver” | No primary ranking verified | “A single recommended session reduces decisions; measure whether it improves starts and completions.” |
| “No consumer product serves this phase” | Market-wide negative claim not established by this research | “Reset Biology is explicitly designed around the weight-loss and taper window.” |

## Feature Dependencies

```text
Protocol shape normalization
  -> Complete named assignment
  -> Canonical exercise identity and movement-purpose metadata
      -> Comparable target prefill
      -> Repeat-safe set-event journal
          -> One-tap logging + undo
          -> Deadline timer
          -> Crash/offline resume
          -> Exactly-once points
      -> Purpose-preserving swap graph
      -> Full / reduced / express / recovery plan compiler
          -> Strength player
          -> Manual-hardware-honest REHIT player
          -> Readiness-adjusted plan
      -> Comparable performance anchors
          -> Strength trend
          -> Confidence passport
              -> Muscle-Preservation Evidence Ladder

Nutrition scorecard contract
  -> Protein coverage + weight trend
  -> Shared evidence ladder and monthly receipt

Stable confirm-before-write action path
  -> Workout coach suggestions
```

The movement-purpose metadata is a blocking dependency, not a later embellishment. It powers safe swaps, readiness trimming, express compression, freshness estimates, movement-pattern coverage, and comparable strength anchors. Building those features against exercise names alone guarantees later rewrites.

## Roadmap Recommendation

Prioritize in this order:

1. **Integrity foundation:** protocol normalization, assignment identity, canonical exercise identity, and immutable plan versions.
2. **Event foundation:** repeat-safe set journal, comparable prefill, one-tap confirmation, undo, deadline timer, offline/reload reconciliation.
3. **Plan compiler:** one canonical session compiled into full, reduced, express, and recovery variants.
4. **Guided runtimes:** strength player first, then manual-hardware-honest REHIT with eligibility, cue preflight, and audio-independent state.
5. **Movement-purpose swap graph:** ship before broad readiness modification or “smart” recommendations.
6. **Readiness and activity story:** deterministic adjustment, explainable estimated freshness, and unknown-data-aware activity path.
7. **Evidence ladder:** comparable strength anchors, functional checkpoints, confidence passport, then the shared nutrition/workout contract.
8. **Habits and coach:** adherence-neutral continuity after event truth is stable; coach only after every proposed action has a repeat-safe confirmation path.

Defer:

- Wearable-based recovery scoring until data access, provenance, missingness, and calibration are independently designed.
- Camera-based form scoring or generated demos; risk exceeds current evidence and clinical-review capacity.
- Adaptive black-box programming; deterministic, inspectable rules are a stronger fit for the mission and present data volume.
- Any numeric claim of muscle preserved until a valid measurement source exists.

## Product Validation Metrics

These are product behavior metrics, not clinical outcomes.

| Question | Minimum observable measure | Privacy boundary |
|---|---|---|
| Did logging interrupt effort? | Median taps from session start to first accepted set; median taps per unchanged straight set; adjustment rate | Record action counts and mode, not weight/repetitions |
| Did interruptions lose work? | Resume success, duplicate-event count, unresolved-sync count | Coarse sync state only |
| Did the daily decision help? | Assigned-session start rate versus library browsing; time to first set | No exercise names in analytics |
| Did rescue modes preserve the day? | Full-to-reduced/express/recovery transitions and partial/completion outcomes | Mode and outcome only |
| Were swaps useful? | Alternative shown, accepted/declined, session continued | Do not export pain reason or exercise text to analytics |
| Did readiness explain itself? | Percentage of adjusted plans whose “what changed/why” panel was opened; member accepted/used safer mode | No raw readiness answers in product analytics |
| Is the score honest? | Percentage of evidence views with sufficient anchors; confidence-tier distribution; missing-data reasons | Aggregate/coarse coverage only |
| Is REHIT guidance reliable? | Cue timing error, block completion, stop use, audio-preflight result | No health symptoms in telemetry |

Do not use session count alone as proof of clinical retention. Report starts, resumptions, safe mode changes, and repeat-safe completion separately.

## Sources

### Primary and Clinical Sources

- [LEAN-PREP randomized trial protocol, PubMed PMID 42020128](https://pubmed.ncbi.nlm.nih.gov/42020128/) — HIGH confidence for trial design; no outcome result yet.
- [Healthy weight-loss maintenance after exercise and liraglutide discontinuation, PubMed PMID 38544798](https://pubmed.ncbi.nlm.nih.gov/38544798/) — HIGH confidence; randomized maintenance trial with post-treatment follow-up, specific to liraglutide and supervised exercise.
- [SURMOUNT-1 body-composition substudy, PubMed PMID 39996356](https://pubmed.ncbi.nlm.nih.gov/39996356/) — HIGH confidence; randomized trial substudy, not a resistance-plus-protein test.
- [Real-world incretin medication body-composition study, PubMed PMID 41322079](https://pubmed.ncbi.nlm.nih.gov/41322079/) — MEDIUM confidence; peer-reviewed retrospective observational study with stated single-center/no-control limitations.
- [Resistance training during caloric restriction in older adults with obesity, PubMed PMID 29596307](https://pubmed.ncbi.nlm.nih.gov/29596307/) — HIGH confidence systematic review/meta-analysis for the broad resistance-training direction.
- [Energy deficiency and resistance-training gains, PubMed PMID 34623696](https://pubmed.ncbi.nlm.nih.gov/34623696/) — HIGH confidence meta-analysis; strength and lean-mass outcomes should not be treated as interchangeable.
- [Autoregulated resistance training network meta-analysis, PubMed PMID 40791980](https://pubmed.ncbi.nlm.nih.gov/40791980/) — HIGH confidence for strength-training autoregulation; indirect to consumer readiness and GLP-1 use.
- [30-second chair-stand validation, PubMed PMID 10380242](https://pubmed.ncbi.nlm.nih.gov/10380242/) — HIGH confidence for reliability/validity in community-residing adults over 60; narrower than all adults.
- [EWGSOP2 sarcopenia consensus, PubMed PMID 30312372](https://pubmed.ncbi.nlm.nih.gov/30312372/) — HIGH confidence that strength, muscle quantity, and physical performance are distinct assessment domains.
- [REHIT perceptual responses, PubMed PMID 31622613](https://pubmed.ncbi.nlm.nih.gov/31622613/) — HIGH confidence for one-session affect/enjoyment findings and the lower-fitness caution; not adherence proof.
- [When and why adults abandon lifestyle apps, PubMed PMID 39693620](https://pubmed.ncbi.nlm.nih.gov/39693620/) — HIGH confidence scoping review for abandonment factors; not specific to set logging.
- [Physical-activity app adherence factors, PubMed PMID 31865054](https://pubmed.ncbi.nlm.nih.gov/31865054/) — HIGH confidence scoping review.
- [Fitness/diet tracking and disordered-eating symptoms, PubMed PMID 39671845](https://pubmed.ncbi.nlm.nih.gov/39671845/) — HIGH confidence systematic review of associations; explicitly cannot establish causality.
- [Gamified health apps meta-analysis, PubMed PMID 39764571](https://pubmed.ncbi.nlm.nih.gov/39764571/) — HIGH confidence that average benefits are modest and do not justify coercive mechanics.
- [Current FDA Wegovy prescribing information](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/215256s029lbl.pdf) — HIGH confidence for medication safety context; the workout product must refer medication questions to a prescriber.
- [ACSM exercise preparticipation screening guidance](https://journals.lww.com/acsm-msse/fulltext/2015/11000/updating_acsm_s_recommendations_for_exercise.28.aspx) — HIGH confidence for vigorous-exercise screening principles.

### Official Product-Pattern Sources

- [Strong automatic rest timer](https://help.strongapp.io/article/231-rest-timer) — HIGH confidence for category convention: auto-start, per-exercise defaults, distinct warm-up and working-set durations.
- [Hevy previous workout values and routine values](https://help.hevyapp.com/hc/en-us/articles/34105442929943-Previous-Workout-Values-Vs-Routine-Values-How-to-Adjust-in-Settings) — HIGH confidence for category convention and the need to distinguish context.
- [Fitbod muscle recovery](https://fitbod.zendesk.com/hc/en-us/sections/360012732693-Feature-Overview) — HIGH confidence for what the product claims/does; not independent validation of the estimate.
- [Fitbod exercise replacement and equipment filtering](https://help.fitbod.me/hc/en-us/sections/31812780318743-Exercise-Workout-Customization) — HIGH confidence for current product behavior; also demonstrates that muscle/equipment filtering alone is not the safety bar proposed here.
- [Gentler Streak Activity Path](https://docs.gentler.app/understanding-your-activity-path/interpret-the-activity-path) — HIGH confidence for current product behavior; not independent evidence for clinical outcomes.
- [Caliber Strength Score explanation](https://caliberstrong.com/blog/introducing-strength-score/) — HIGH confidence for the category pattern; methodology remains proprietary and is not clinical validation.
- [CAROL Bike controlled-resistance design](https://carolbike.com/bike-cards/optimal-design/) — HIGH confidence for CAROL’s official hardware claim and why browser guidance must not claim equivalence.

### Claim-Audit Source

- [ECO 2025 cohort press report](https://medicalxpress.com/news/2025-04-muscle-mass-loss-minimized-weight.html) — LOW-to-MEDIUM confidence: conference press material, not a randomized peer-reviewed outcome paper. Use only to explain why the 13%/3% headline is not release-grade evidence.

