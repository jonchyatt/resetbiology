---
phase: 01-foundational-physiology
plan: "02"
subsystem: education
tags: [pubmed, exercise-science, research, citations, typescript, nextjs, rehit, sarcopenia]

# Dependency graph
requires:
  - phase: 01-01
    provides: crossReferences field on Study interface; breath-training section with 4 verified PubMed citations
provides:
  - Exercise science section of app/education/page.tsx with 8 verified PubMed citations
  - Keith Baar gelatin + vitamin C collagen synthesis protocol documented (PMID 27852613)
  - REHIT time-efficient VO2 max protocol documented (PMIDs 22124524, 28121184)
  - PGC-1alpha mitochondrial biogenesis mechanism documented (PMID 12563009)
  - Mind-muscle connection EMG evidence documented (PMID 31354928)
  - The sarcopenia-cognition chain documented (PMID 37111070, 34981273, 30513557)
  - Cross-domain references to breath training, nutrition, and peptide sections
affects:
  - 01-03 (nutrition-science section — same file, builds on established patterns)
  - 03-peptide-science (BPC-157 cross-referenced from Baar collagen study)
  - Phase 2 cognitive training (cross-referenced from mind-muscle connection study)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "crossReferences woven into relevance text (established in 01-01, applied to 8 exercise studies here)"
    - "Only HIGH-confidence PubMed PMIDs used — all 8 verified by direct PubMed fetch"
    - "longevity chain narrative: mind-muscle connection → sarcopenia prevention → bone health (explicit in relevance text)"

key-files:
  created: []
  modified:
    - app/education/page.tsx

key-decisions:
  - "Removed PMID 28401638 (generic HIIT meta-analysis) — replaced by more specific REHIT studies (22124524, 28121184) that directly match our protocol"
  - "Retained PMID 30513557 (bone health) as final link in the longevity chain — fits the narrative without redundancy"
  - "crossReferences rendered via relevance text (no UI changes needed — pattern from 01-01 maintained)"

patterns-established:
  - "Longevity chain pattern: each exercise study's relevance text names its position in the chain (mind → neuromuscular → muscle → bone → longevity)"
  - "Cross-domain reference format: 'see Breath Training section' and 'see Nutrition Science section' in relevance text"
  - "REHIT as the preferred sprint protocol over generic HIIT — appears in practicalApplication and 2 dedicated studies"

requirements-completed:
  - WORK-01
  - WORK-02
  - WORK-03
  - WORK-04
  - WORK-05
  - WORK-06

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 1 Plan 02: Exercise Science Research Section Summary

**Replaced 2 generic exercise studies with 8 verified PubMed citations covering Keith Baar collagen protocol, PGC-1alpha mitochondrial biogenesis, REHIT (2 studies), mind-muscle connection EMG evidence, sarcopenia-cognition axis, neuromuscular junction biology, and bone health — with the longevity chain narrative woven explicitly through all relevance fields**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T04:49:39Z
- **Completed:** 2026-03-19T04:52:03Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments
- Removed PMID 28401638 (generic HIIT meta-analysis) and replaced both old studies with 8 comprehensive exercise science studies
- Added Keith Baar gelatin + vitamin C protocol (WORK-01) — the most actionable single finding in connective tissue science
- Added PGC-1alpha study establishing mitochondrial biogenesis mechanism for "raise metabolism through exercise, not caloric restriction" narrative (WORK-03)
- Added two REHIT studies (original 2012 and T2D 2017) documenting time-efficient VO2 max gains from 10-minute sprint protocols (WORK-03)
- Added EMG-verified mind-muscle connection study proving neuromuscular recruitment is a trainable cognitive skill (WORK-02)
- Added sarcopenia-cognition axis study proving the muscle-brain relationship is bidirectional (WORK-04, WORK-05)
- Added neuromuscular junction degeneration study explaining cellular mechanism of sarcopenia (WORK-05)
- Retained bone health study as final link in the longevity chain (WORK-05)
- Cross-references to Breath Training, Nutrition Science, and mental-training sections woven into relevance text (WORK-06)
- TypeScript compiles without errors (`npx tsc --noEmit` exits 0)

## Task Commits

1. **Task 1: Replace exercise-protocols section with verified exercise science studies** - `da751ff0` (feat)

## Files Created/Modified
- `app/education/page.tsx` - Replaced entire exercise-protocols section: 2 old studies removed, 8 verified PubMed studies added with updated section description, practicalApplication, and cross-domain relevance text

## Studies Delivered

| Study ID | PMID | Authors | Year | Covers |
|----------|------|---------|------|--------|
| baar-collagen-1 | 27852613 | Shaw, Baar et al. | 2017 | Keith Baar gelatin + vitamin C collagen synthesis (WORK-01) |
| pgc1a-mitochondria-1 | 12563009 | Pilegaard et al. | 2003 | PGC-1alpha mitochondrial biogenesis mechanism (WORK-03) |
| rehit-original-1 | 22124524 | Metcalfe, Vollaard et al. | 2012 | REHIT original — 10-min sprints, 15% VO2 max gain (WORK-03) |
| rehit-diabetes-1 | 28121184 | Ruffino, Vollaard et al. | 2017 | REHIT in T2D — 7% VO2 max vs 1% walking (WORK-03) |
| mind-muscle-emg-1 | 31354928 | Paoli et al. | 2019 | Mind-muscle connection EMG verified (WORK-02) |
| sarcopenia-cognition-1 | 37111070 | Arosio et al. | 2023 | Sarcopenia-cognition bidirectional axis (WORK-04, WORK-05) |
| neuromuscular-sarcopenia-1 | 34981273 | Moreira-Pais et al. | 2022 | NMJ degeneration pathway in sarcopenia (WORK-05) |
| resistance-bone-1 | 30513557 | Hong & Kim | 2018 | Bone health — final longevity chain link (WORK-05) |

## Decisions Made

- **HIIT meta-analysis removed:** PMID 28401638 (Wewege et al. 2017, generic HIIT meta-analysis) removed because the REHIT studies (22124524 and 28121184) are more specific, more actionable, and directly describe the Reset Biology protocol. The generic HIIT finding is subsumed by the more precise REHIT evidence.
- **Bone health study retained and updated:** PMID 30513557 kept from the existing section as it serves as the final link in the longevity chain narrative. The study entry was updated to add a fourth key finding and a richer relevance text placing it explicitly in "the chain."
- **crossReferences field used on 7 of 8 studies:** The resistance-bone-1 study has the cross-reference embedded in its relevance text (referencing the Baar collagen protocol) but does not add a crossReferences array since the link points back within the same section, not to another section.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Exercise science section is complete with 8 verified citations covering all 6 WORK requirements
- The `crossReferences` field and relevance text pattern is established across both breath (01-01) and exercise (01-02) sections — ready for nutrition-science (01-03) to use the same pattern
- nutrition-science section still has older studies that need replacement (Plan 01-03)
- No blockers for 01-03

---
*Phase: 01-foundational-physiology*
*Completed: 2026-03-19*
