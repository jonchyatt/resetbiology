# Reset Biology — Evidence-Grounded Self-Directed Health Platform

## What This Is

A free, private health-education and self-management platform that combines evidence-cited learning with practical tools for training, nutrition, breath, cognition, vision, journaling, and peptide education. The current milestone turns `/workout` into a muscle-preservation engine for people losing weight or tapering a GLP-1 medicine, while keeping decisions understandable and member-controlled.

## Core Value

Members can act on an honest, evidence-cited daily plan without a marketer, paywall, or opaque score standing between them and their own data.

## Current Milestone: v2.0 Muscle-Preservation Engine

**Goal:** Make safe training consistency during weight loss and GLP-1 tapering easier than quitting by turning every offered protocol into a fast, resumable, readiness-aware guided session with honest evidence and one shared nutrition/workout truth.

**Target features:**
- Complete assignment plans for every current protocol through pure, versioned reader adapters.
- Repeat-safe offline set logging, deadline timers, guided strength and REHIT players, safe swaps, and crash resume.
- Concrete readiness prescriptions, estimated muscle freshness, progress and habit views, a confidence-bearing muscle-preservation evidence panel, and one shared nutrition/workout scorecard.
- One safety-fenced workout coach boundary, patient-grade interface craft, production proof, and credential-rotation closure.

## Current State (after v1.0)

**Shipped:** v1.0 Education & Research Justification (2026-03-19)

The /education page now contains 74 verified PubMed studies across 13 research domains with 58 cross-domain connections and portal feature links. Every study was individually verified via HTTP 200 against PubMed. Zero fabricated PMIDs remain.

**Education page stats:**
- 1,782 lines of TypeScript
- 13 research sections (breath, exercise, nutrition, peptides, N-Back, ear training, vision, mental mastery, journaling, accountability, gamification, meditation, general health)
- 74 verified PubMed citations
- 58 cross-domain crossReferences
- 8 category filter buttons
- Honest evidence framing throughout (pilot studies noted, mixed results acknowledged)

## Requirements

### Validated

- ✓ Auth0 authentication with Google OAuth
- ✓ Portal dashboard with 9 module containers
- ✓ Breath training with predefined exercises
- ✓ Workout tracking (30+ exercises)
- ✓ Nutrition tracking with food database
- ✓ Peptide tracker with protocols
- ✓ Vision training (Snellen, accommodation, contrast)
- ✓ N-Back cognitive training (5 modes)
- ✓ Pitch recognition / ear training
- ✓ Daily journal with mood tracking
- ✓ Education page with search/filter — v1.0 (74 verified studies)
- ✓ Peptide Co-op page (Zion Direct Care)
- ✓ Satori Living Foundation grant integration
- ✓ Comprehensive research backing for all 13 domains — v1.0
- ✓ Replace all fake/placeholder PubMed citations with real ones — v1.0
- ✓ Education page fully populated with verified studies — v1.0
- ✓ Cross-references between portal modules and supporting science — v1.0

### Active

- [ ] Every current protocol produces a named, correctly sized, versioned assignment without reseeding production.
- [ ] A member can log a straight set in one tap, resume safely after interruption, and never duplicate an event during replay.
- [ ] Strength and REHIT sessions guide the next action, preserve stopping rules, and record partial or complete work without shame.
- [ ] Every readiness score produces a visible, deterministic same-day prescription and preserves the original plus modified plan.
- [ ] Substitutions preserve movement purpose, equipment, skill, readiness, and contraindications.
- [ ] Progress, functional checkpoints, and the shared nutrition/workout scorecard show evidence with confidence and provenance rather than claiming proof.
- [ ] The workout coach uses one repeat-safe, code-fenced orchestration boundary.
- [ ] Desktop, 390-pixel, accessibility, normal-motion, reduced-motion, audio, security, and cleanup gates pass on production.

### Out of Scope

- The complete cross-product Voice Agent ecosystem — v2 only unifies the workout coach boundary it needs
- Google Drive Vault integration — separate milestone
- Stripe payment enhancements — separate milestone
- New or revised clinical protocol content — stays in the protocol-library evidence pipeline
- Point-value changes — proposals may ship only behind an off-by-default flag for Jon to ratify
- Wearable diagnosis, medical clearance, injury diagnosis, or medication advice
- Leaderboards, body comparison, punitive streaks, and generated anatomical instruction without clinical review

## Context

- Education page at `app/education/page.tsx` — 1,782 lines, 13 sections, 74 studies
- Production at resetbiology.com, auto-deploy on git push to master
- Project has duplicate routes in `app/` and `src/app/` — Next.js serves `app/` over `src/app/`
- All portal pages use glassmorphic styling with hero-background.jpg
- Testing via Chrome DevTools MCP on production
- `/workout` currently shows 12 live protocol cards, readiness, quick add, personalization, assignment state, points, and history
- Persistent protocol documents use more than one historical shape, so reads must normalize without hidden writes or reseeding
- The superseded workout-polish candidate is preserved locally at `c9ecf186` for reference only; v2 starts from clean remote commit `afe437ac`
- Nutrition owns the cross-page scorecard domain, so the shared contract must be versioned and serialized with that rail

## Constraints

- **Citations**: ALL PubMed IDs and DOIs must be real, verifiable studies
- **Styling**: Must match existing glassmorphic design system
- **Deployment**: Auto-deploy on push, ~4 min build time
- **Testing**: Production only via Chrome DevTools MCP
- **Route priority**: Edit files in `app/` directory, not `src/app/`
- **Deployment**: Git push to `master` only; never use the Vercel command-line tool
- **State safety**: Additive, reversible, versioned schemas; repeat-safe events; no fabricated or destructive member-data migration
- **Shared logic**: `src/lib/localDay.ts`, `src/lib/workoutPoints.ts`, and `src/lib/workoutReadiness.ts` remain the single authorities
- **Points**: 40 workout and 10 readiness points remain unchanged; all new awards are off by default
- **Dependencies**: Zero new packages by default; browser-native graphics, timing, wake lock, and audio with honest fallbacks
- **Accessibility**: 44-by-44-pixel targets where practical, keyboard and visible focus, real-value accessible labels, no color-only meaning, normal and reduced motion both verified
- **Evidence**: Estimates are labeled as estimates; case series and trial protocols are never presented as randomized outcome evidence
- **Verification**: Clean committed candidate, blind verifier, production commit proof, isolated test-account writes, exact cleanup, and commit-bound visual plus audio evidence

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use /education page as central research hub | Single location for all science, searchable/filterable | ✓ Good — 13 sections, category filters work well |
| 13 research domains mapped to portal features | Every feature must be justified | ✓ Good — all 13 sections have practicalApplication links |
| Sequential wave execution per phase | All plans modify same file, avoids merge conflicts | ✓ Good — zero merge issues across 17 plans |
| Honest evidence framing | Credibility over marketing — note pilot studies, mixed results | ✓ Good — builds trust, differentiates from competitors |
| crossReferences as data-only field | Wiring stored in study objects, rendered via relevance prose | ⚠️ Revisit — could render as clickable "Related Sections" links |
| Continue GSD numbering at Phase 6 | v1 completed Phases 1 through 5; preserving numbering keeps history unambiguous | — Pending |
| Preserve completed v1 phase folders | The stock new-milestone cleanup deletes verification history and no numbering collision exists | — Pending |
| Fresh worktree instead of hard reset | Reaches exact remote truth without erasing unrelated work in dirty shared checkouts | ✓ Good |
| Pure versioned protocol readers | Production documents are persistent clinical content; page reads may not mutate or depend on reseeding them | — Pending |
| Evidence panel instead of proof score | Strength, function, weight, and protein data support an estimate with confidence, not direct tissue measurement | — Pending |
| Deadline timers and repeat-safe set events | Background tabs and weak gym connections must not drift timers or duplicate logs | — Pending |
| One shared nutrition/workout scorecard | Prevents two products from disagreeing about the same member truth | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Move invalidated requirements to Out of Scope with a reason.
2. Move verified requirements to Validated with the phase reference.
3. Add newly discovered requirements to Active.
4. Record consequential decisions and their outcomes.
5. Recheck that What This Is and Core Value still describe the real product.

**After each milestone:**
1. Review every section against production truth.
2. Reconfirm the Core Value.
3. Re-audit Out of Scope decisions.
4. Update Context with real use and verification evidence.

---
*Last updated: 2026-07-21 after v2.0 milestone confirmation and GODMODE foreman classification*
