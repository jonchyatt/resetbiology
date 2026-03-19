# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Every protocol and recommendation must be justified by real peer-reviewed research
**Current focus:** Phase 1 - Foundational Physiology (breath, exercise, nutrition)

## Current Position

Phase: 1 of 5 (Foundational Physiology)
Plan: 1 of 4 in current phase
Status: In progress
Last activity: 2026-03-19 -- Completed 01-01-PLAN.md (breath-training section)

Progress: [█░░░░░░░░░░░░░░░░░░░] 6% (1/16 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 2 min
- Total execution time: 0.03 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundational-physiology | 1 completed | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: 01-01 (2 min)
- Trend: --

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Grouped breath/exercise/nutrition as Phase 1 due to deep metabolic interconnections (VO2 max, mitochondria, recovery)
- [Roadmap]: Cognitive domains (N-Back, ear, vision, mental mastery) grouped as Phase 2 sharing neuroplasticity thread
- [Roadmap]: Peptides in Phase 3 so exercise/nutrition context exists for synergy cross-references
- [Roadmap]: QA as Phase 5 to sweep all domains after research is written
- [01-01]: 4-7-8 dedicated PMID excluded (MEDIUM confidence); pattern covered by Laborde 2022 slow-breathing meta-analysis
- [01-01]: Box breathing PMID excluded (MEDIUM confidence); covered by meta-analysis umbrella
- [01-01]: WHM autophagy framed as mechanistic inference only — no direct WHM study proves autophagy in humans
- [01-01]: crossReferences field renders via relevance text (no UI changes needed for Phase 1)

### Pending Todos

None yet.

### Blockers/Concerns

- exercise-protocols section still has older studies — Plan 01-02 replaces them
- nutrition-science section still has older studies — Plan 01-03 replaces them
- Duplicate route structure (app/ vs src/app/) -- always edit in app/ directory

## Autonomous Mode

**ACTIVE: Run `/gsd:autonomous` after `/clear` to continue.**

This milestone is approved for fully autonomous execution:
- Plan each phase → execute each plan → commit → advance to next phase
- Sequential, full opus quality with cross-domain awareness
- All 5 phases, 16 plans, 54 requirements
- Push to GitHub after each phase (auto-deploys to production)
- No user approval needed between phases — keep going until all 5 complete

**Critical research rules:**
- ALL PubMed IDs must be REAL — verify every citation exists
- Web search for actual studies, do NOT fabricate PMIDs
- Cross-domain connections are essential (breath↔exercise↔nutrition↔peptides↔cognition)
- Edit `app/education/page.tsx` (NOT `src/app/education/page.tsx` — Next.js serves app/ over src/app/)
- Test on production (resetbiology.com) not localhost
- User's key insights to weave throughout:
  - Keith Baar tendon/ligament protocol (gelatin + vitamin C)
  - REHIT for VO2 max, mitochondrial biogenesis
  - Wim Hof style breathing → autophagy AND VO2 max
  - Dr. Boz insulin ratio, FGF21 pathway, fructose as metabolic medicine
  - Low calorie diets KILL BMR (anti-starvation-diet evidence)
  - The chain: sharp mind → neuromuscular control → muscle → bone → longevity
  - Raising metabolism builds mitochondria, not caloric restriction

## Session Continuity

Last session: 2026-03-19T04:46:55Z
Stopped at: Completed 01-01-PLAN.md — breath-training section replaced with 4 verified PubMed studies
Resume file: None
