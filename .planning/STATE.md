---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Muscle-Preservation Engine
status: control_plan_accepted_runtime_hold
last_updated: "2026-07-21T19:00:18.5538069-06:00"
last_activity: 2026-07-21
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 1
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-21)

**Core value:** Members can act on an honest, evidence-cited daily plan without a marketer, paywall, or opaque score standing between them and their own data.
**Current focus:** Phase 6 — reconcile production protocol truth and freeze the identities, contracts, and reviewed metadata required by the v2.0 engine.

## Current Position

Phase: 6 of 13 — Production Reconciliation & Contract Foundation
Plan: 06-01 control-plane establishment accepted; runtime plans remain held
Status: Blind plan check passed at `e37d808f`; no FND requirement credit and no runtime authorization
Last activity: 2026-07-21 — 06-01 blind PASS after executor, write-set, coverage, and FND verification hardening

Progress: [----------] 0%

## Performance Metrics

**Velocity:**

- v1.0 plans completed: 17
- Average v1.0 plan duration: ~5.4 min
- Total recorded v1.0 execution time: ~1.53 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundational-physiology | 4 completed | 13 min | 3.25 min |
| 02-cognitive-science | 5 completed | 31 min | 6.2 min |
| 03-peptide-science | 3 completed | 8 min | 2.7 min |
| 04-behavioral-science | 3 completed | 14 min | 4.7 min |
| 05-quality-assurance | 2 completed | 26 min | 13 min |

**Recent Trend:**

- Last 5 plans: 04-01 (6 min), 04-02 (5 min), 04-03 (3 min), 05-01 (8 min), 05-02 (18 min)
- Trend: stable; 05-02 longer due to full build verification on Windows

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2 Roadmap]: Continue numbering at Phases 6-13 and preserve every v1 phase directory and archive.
- [v2 Roadmap]: Map all 105 v2 requirement IDs exactly once: FND→6, LOG→7, RUN→8, RDY→9, SWAP→10, EVD/HAB→11, COACH→12, and UIA/TEL/SEC/OPS→13.
- [v2 Roadmap]: Phase 9 may modify reviewed dose only; readiness-driven exercise replacement remains unavailable until the Phase 10 swap graph is approved.
- [v2 Roadmap]: Production event replay remains disabled until the live member-plus-event uniqueness rule is inspected and race-proven through the isolated relay.
- [v2 Roadmap]: Phase 13 owns final proof of the cross-cutting operational requirements, while each implementation phase must still produce its required clean-tree, commit-bound, cleanup-safe receipts.
- [v2 Roadmap]: No `.planning/config.json` exists; standard granularity was applied to the eight user-defined delivery boundaries without changing them.
- [Roadmap]: Grouped breath/exercise/nutrition as Phase 1 due to deep metabolic interconnections (VO2 max, mitochondria, recovery)
- [Roadmap]: Cognitive domains (N-Back, ear, vision, mental mastery) grouped as Phase 2 sharing neuroplasticity thread
- [Roadmap]: Peptides in Phase 3 so exercise/nutrition context exists for synergy cross-references
- [Roadmap]: QA as Phase 5 to sweep all domains after research is written
- [01-01]: 4-7-8 dedicated PMID excluded (MEDIUM confidence); pattern covered by Laborde 2022 slow-breathing meta-analysis
- [01-01]: Box breathing PMID excluded (MEDIUM confidence); covered by meta-analysis umbrella
- [01-01]: WHM autophagy framed as mechanistic inference only — no direct WHM study proves autophagy in humans
- [01-01]: crossReferences field renders via relevance text (no UI changes needed for Phase 1)
- [01-02]: HIIT meta-analysis PMID 28401638 removed; replaced by specific REHIT studies that directly match our protocol
- [01-02]: Bone health study PMID 30513557 retained and enriched — serves as final link in the longevity chain narrative
- [01-02]: crossReferences rendered via relevance text across all 8 exercise studies; pattern consistent with 01-01
- [01-03]: Old micronutrient study (PMID 29137137) and wrong-journal TRE study (PMID 32341528) removed; replaced by 7 verified studies covering GKI, FGF21, anti-starvation evidence, and protein MPS
- [01-03]: Fructose study (PMID 29107295) framed explicitly as signaling pathway research — "not a recommendation for high-fructose diets"
- [01-03]: Dr. Boz cited under Meidenbauer/Seyfried 2015 (PMID 25798181) — scientific origin of GKI, with Dr. Boz acknowledged as popularizer
- [01-03]: PMID 29414855 author attribution corrected from Lonnie M et al. to Stokes et al. 2018
- [01-04]: Verification-only plan — all 6 cross-domain connections and 19 verified PMIDs were already present from 01-01 through 01-03; no code changes required
- [01-04]: Phase 1 audit confirmed: 'see Exercise Science section' (4x), 'see Nutrition Science section' (5x), 'see Breath Training section' (5x) — all exceed minimum of 2
- [02-01]: All 3 PMIDs in old mental-training section were bogus (18378733=nursing article, 24932672=unverified, 23424073=unverified); replaced with verified Jaeggi 18443283, Au 25102926, Melby-Lervag 27474138
- [02-01]: Melby-Lervag 2016 counterbalance included intentionally — honest framing (near transfer reliable, far transfer debated) matches Phase 1 WHM autophagy pattern
- [02-01]: Section renamed mental-training → nback-working-memory to accurately scope before ear-training section arrives in 02-02
- [02-01]: cognitive category union type established — all Phase 2 plans can now use category: "cognitive" without TypeScript errors
- [02-02]: Cepeda 2008 (19076480) chosen over unverified PMID 24932672 from old code — Cepeda is foundational spacing-effect study, fully PubMed-verified
- [02-02]: Roman-Caballero 2018 meta-analysis (30481227) included as 4th study to establish EAR-04 cross-reference bridge to mental-mastery (cognitive reserve)
- [02-02]: FSRS named explicitly in practicalApplication connecting pitch recognition algorithm to peer-reviewed spacing science
- [02-03]: Deveau 2014 correct PMID is 24556432 (not 24508170=ant genome); Polat practical correct PMID is 19520103 (not 19084554=fish immune); Polat amblyopia 19622368 replaces Scheiman 10416930=myopia spectacles
- [02-03]: Allen 2010 (20304003) added as 4th study -- PowerRefractor-measured objective accommodation facility training for VISN-01
- [02-03]: vision-science category changed from "general" to "cognitive" -- visual neuroplasticity is a cognitive domain
- [02-04]: mental-mastery section placed after ear-training and before nutrition-science -- all 4 cognitive sections grouped together
- [02-04]: Task 2 audit found all 7 cross-domain connections already present from prior plans -- no code changes required for audit
- [02-04]: Phase 2 complete with 14 verified studies across 4 cognitive domains (3+4+4+3)
- [02-05]: Kraus 2010 chosen as EAR-04 gap target -- "music training as exercise for the brain" framing naturally extends to sound-based breath practices; relevance text appended (not replaced) to preserve N-Back cross-reference
- [03-01]: All 8 fabricated PMIDs removed (37456789 used twice, 35789234, 37891234, 38123456, 36789456, 35678912, 38567890); 12 verified PMIDs inserted for 5 peptides
- [03-01]: Study ordering: BPC-157 (3) → TB-500 (2) → Semaglutide (2) → Ipamorelin (2) → Epithalon (3) — highest cross-reference priority first
- [03-01]: semaglutide-1 is the only Phase 3 RCT in peptide section; semaglutide-2 frames muscle loss as making resistance training "non-optional"
- [03-01]: Epithalon studies note single Khavinson group provenance and absent independent replication — honest framing matches WHM autophagy pattern
- [03-01]: practicalApplication left unchanged — Plan 03-03 will update with full cross-reference text
- [03-02]: ghkcu-3 wired to nback-working-memory: GHK neurological gene expression (NGF, Alzheimer's/Parkinson's pathways) connects brain health chain
- [03-02]: dsip-2 wired to exercise-protocols: causal DSIP/GH release evidence creates DSIP+ipamorelin complementary protocol framing
- [03-02]: 5amino1mq-2 wired to both exercise-protocols and nutrition-science: spans sarcopenia prevention and NAD+/SIRT1 metabolic chains
- [03-02]: Co-op studies placed at end of 23-study array (coop-purity-1, coop-quality-1) — COOP-01 and COOP-02 both satisfied
- [03-03]: practicalApplication uses /peptides (not full URL) for brevity — matches other section patterns (/breath, /workout, /nutrition)
- [03-03]: Baar tendon protocol named explicitly — closes peptide healing signals ↔ gelatin+vitamin C structural substrate loop
- [03-03]: sarcopenia chosen over "muscle loss" — matches exact term in semaglutide-2 keyFindings (grep finds both instances)
- [03-03]: Final audit passed first attempt — all 23 PMIDs present, zero fabricated, cross-refs exceed minimums, TypeScript clean
- [04-01]: behavioral union type added to BOTH Study and ResearchSection interfaces — same dual-interface pattern as cognitive in 02-01
- [04-01]: journaling-petrie cross-references only meditation-science (not breath-training) — Petrie 1995 is immune antibody RCT, no HRV component; only Pennebaker and Redwine bridge to breath-training
- [04-01]: accountability studies forward-wire to gamification-stakes before Plan 02 lands — valid since all plans modify same file; cross-references resolve when 04-02 adds that section
- [04-02]: meditation-science uses all 5 studies (M-1 through M-5) — 5-study section is the first in Phase 4; evidence base supported it per RESEARCH.md upgrade path
- [04-02]: PMID 15256293 (Grossman MBSR) intentionally duplicated between meditation-science and general-health — Plan 04-03 audit will clean duplication
- [04-02]: Goyal JAMA cross-references exercise-protocols: "no advantage over active interventions like exercise" directly links meditation and exercise evidence chains
- [04-03]: ear-training added to Brewer DMN crossReferences — Brewer is foundational DMN/attention study, most natural bridge to auditory neuroplasticity
- [04-03]: Sound-based meditation sentence appended to Brewer relevance text (not replacing prior content) — both breath-training and ear-training connections preserved
- [04-03]: meditation-stress-1 removed from general-health without replacement — dedicated meditation-science section provides rich coverage; general-health retains 2 strong studies
- [04-03]: Final PMID audit: all 16 behavioral PMIDs present; zero fabricated; TypeScript clean; Phase 4 COMPLETE
- [05-01]: Verification-only plan — all 74 PMIDs on /education returned HTTP 200; zero duplicates, zero placeholders, 1:1 pmid-link parity; no code changes required; QUAL-01 and QUAL-02 satisfied
- [05-02]: general-health practicalApplication updated to include /breath, /workout, /portal — was the only section missing specific portal URLs
- [05-02]: sleep-health-1 crossReferences: ["breath-training", "meditation-science"] — sleep connects to parasympathetic breath activation and MBSR
- [05-02]: cold-exposure-1 crossReferences: ["exercise-protocols", "breath-training"] — cold exposure bridges REHIT recovery and Wim Hof breathing
- [05-02]: Final crossReferences count: 58 (was 56); 13/13 sections now have outgoing cross-domain connections; QUAL-03 and QUAL-04 satisfied

### Pending Todos

- After ownership release, plan separate Phase 6 runtime slices from all FND-01 through FND-12 acceptance cases.
- Keep runtime source held until the workout-content, nutrition-scorecard, security, and Hawkeye ownership boundaries are transferred or serialized.

### Blockers/Concerns

- No blocker to phase planning.
- Runtime implementation is held by the milestone operating boundary until named ownership transfers are complete.
- Live production protocol shapes, Atlas indexes, transaction support, and deployment commit identity remain execution-time evidence gates; repository declarations are not proof.
- Phase 8 REHIT content, Phase 10 movement taxonomy, Phase 11 strength formula and nutrition contract, and Phase 12-13 provider/privacy decisions require the named reviews identified in research.
- Duplicate route structure remains live: use `app/workout` and `src/components/Workout`; never edit the dead `src/app/workout` shadow.

## Milestone Operating Boundary

Roadmap creation is complete. Runtime implementation, production writes, credentials, browser state, external services, seeds, and clinical content remain untouched.

- Preserve all v1 phase directories and history.
- Plan and execute v2.0 sequentially from Phase 6 through Phase 13 unless an explicit dependency decision changes the order.
- Use additive, reversible rollout and keep every new writer off until its production integrity gate passes.
- Push only with `git push origin master`; never run the Vercel CLI from this repository.
- Treat production proof and exact cleanup as part of delivery, not as a later documentation task.

## Session Continuity

Last session: 2026-07-21T19:00:18.5538069-06:00
Stopped at: v2.0 roadmap complete; 105/105 requirements mapped exactly once across Phases 6-13; ready to plan Phase 6.
Resume file: .planning/ROADMAP.md
