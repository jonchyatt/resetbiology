# Phase 6 Context: Muscle-Preservation Foundation

**Milestone:** v2.0 Muscle-Preservation Engine
**User workstream alias:** Phase 0 — reconcile and verify production
**Status:** Scaffold allowed; runtime changes held until ownership boundaries are clear

## Phase Boundary

Phase 6 establishes the trustworthy foundation every later runtime depends on. It reconciles the inherited polish work against current source and production, normalizes protocol reads without reseeding, makes assignment identity deterministic, freezes versioned exercise and movement-purpose contracts, and repairs the shared visual baseline.

It does not build set logging, players, readiness modifications, swaps, the evidence ladder, habits, coach behavior, or credential rotation. Those remain in Phases 7 through 13.

## Decisions Already Made

- The fresh `rb-muscle-preservation-engine-v2` worktree was opened from recorded `origin/master` commit `afe437ac9ea7cd9c072cc43a130d9471a38a47fa`. During scaffolding, upstream advanced to `3b63de84b76ecbf11862fb3d2db8dfe2db5399e0` through nutrition-only files; the planning branch must be rebased onto that non-overlapping commit before it is declared clean and current.
- The superseded polish worktree is preserved as local evidence only. Its commits are not a release candidate and cannot be promoted wholesale.
- Existing production protocol documents remain in place. Compatibility is reader-side, pure, versioned, and rejects ambiguity visibly.
- The live baseline has 12 protocol cards, not 11.
- The short live REHIT title is already visible, but historical records still require a two-line reader/interface contract.
- The unsupported “13% weight loss / 3% muscle loss randomized trial” wording is blocked. Evidence copy must identify study design and uncertainty accurately.
- The old source-secret scrub does not prove credential revocation. Credential rotation remains a separate Phase 13 security gate with one owner.
- A stock GSD “clear phases” command is intentionally not used because it would delete the completed v1 planning and proof record. Phase numbering continues at 6.

## Required Contracts

### Protocol reader

The reader accepts both known protocol shapes:

- session label from `title` or `name`;
- phase duration from `durationWeeks` or the inclusive `weekStart` through `weekEnd` range;
- malformed, unnamed, zero-length, or ambiguous prescriptions fail visibly rather than fabricating sessions.

One adapter must cover every current protocol and future records that honor this frozen shape.

### Assignment identity

Assignment selection is deterministic and preserves every durable record. Multiple active assignments must remain distinguishable until the product applies an explicit, reversible resolution policy. “First active record returned” is not a policy.

### Exercise identity and movement purpose

Before historical loads, compression, swaps, freshness, or strength trends use exercise data, the foundation must distinguish:

- stable exercise identity and version;
- variation and equipment;
- normalized units;
- movement pattern and program role;
- primary and supporting muscle exposure;
- skill demand, joint demands, contraindications, and stopping rules;
- clinically reviewed demonstration/cue version.

Phase 6 freezes the contract and minimum reviewed fields. Broad content authoring remains with the protocol-library clinical pipeline.

### Shared interface baseline

The production route is `app/workout/page.tsx` through `src/components/Workout`. The `src/app/workout` directory is a dead shadow and is forbidden.

The inherited visual fixes must be proved across the real surfaces they affect:

- readable dropdown choices;
- collision-free 390-pixel PortalHeader on `/workout`, `/voice-training`, `/breath`, `/education`, and `/profile`;
- REHIT title at no more than two lines;
- clinician-warm, adherence-neutral copy and removal of truly dead values;
- shared toast feedback rather than custom success panels or blocking dialogs.

## Reuse Before Build

- `src/lib/localDay.ts` remains the only member-day authority.
- `src/lib/workoutPoints.ts` remains the only daily-award authority; workout and readiness stay at 40 and 10 points.
- `src/lib/workoutReadiness.ts` remains the readiness calculation authority.
- `src/components/ui/Toast.tsx` remains the feedback surface.
- Existing dependencies and native browser features are preferred; no new package is planned.

## Ownership Holds

- **Runtime hold:** overlapping whole-rail and old-candidate ownership must be explicitly released or bounded before source changes.
- **Content hold:** seeded protocol content remains outside this phase unless the clinical content owner transfers a specific write set.
- **Browser hold:** production browser state is not touched until an isolated session or explicit handoff exists.
- **Scorecard hold:** the nutrition-owned shared response contract is serialized with its owner before Phase 11.
- **Credential hold:** Atlas and production environment changes have one named owner and do not share a ticket with normal feature work.

## Verification Doctrine

Every runtime slice follows:

`clean build → clean commit → blind verifier → push master → matching live commit → isolated production test → clean only run-created data → evidence receipt`

Visual proof uses one commit-bound recording with blind verdicts first. Eye 1 checks static text, values, and layout. Eye 2 checks timing, state changes, and transients. Exact frames or timecodes are mandatory. Audio requires a separate audio-bearing receipt.

## Creative Ceiling

The master brief is a floor. A better design may be adopted when it improves safety, honesty, reliability, accessibility, or member effort cost. Every deviation is named with its reason; none is silent.
