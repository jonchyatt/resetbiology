# Roadmap: Reset Biology Education & Research Justification

## Overview

This milestone transforms the Reset Biology platform from a feature-rich wellness app into a science-backed authority by documenting the peer-reviewed research justifying every portal feature. Work progresses through five phases: foundational physiology research (breath, exercise, nutrition share deep metabolic connections), cognitive science research (neuroplasticity thread across N-Back, ear training, vision, mental mastery), peptide science (builds on exercise/nutrition context established in Phase 1), behavioral science (journaling, accountability, gamification, meditation), and a final quality assurance pass ensuring every citation is real and every cross-reference is connected.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundational Physiology** - Research breath training, exercise science, and nutrition as an interconnected metabolic system (COMPLETE 2026-03-19)
- [x] **Phase 2: Cognitive Science** - Research N-Back, ear training, vision training, and mental mastery through the neuroplasticity lens (5/5 plans DONE, EAR-04 gap closed 2026-03-19)
- [x] **Phase 3: Peptide Science** - Research all 9 peptides plus co-op documentation, building on exercise/nutrition context from Phase 1 (completed 2026-03-19)
- [ ] **Phase 4: Behavioral Science** - Research journaling, accountability, gamification/stakes, and deep meditation (2/3 plans done)
- [ ] **Phase 5: Quality Assurance & Cross-Domain Integration** - Replace all fake PMIDs, verify every link, weave cross-domain connections, deploy

## Phase Details

### Phase 1: Foundational Physiology
**Goal**: The education page presents breath training, exercise science, and nutrition as a deeply interconnected metabolic system, each section grounded in verified PubMed research
**Depends on**: Nothing (first phase)
**Requirements**: BRTH-01, BRTH-02, BRTH-03, BRTH-04, BRTH-05, WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, NUTR-01, NUTR-02, NUTR-03, NUTR-04, NUTR-05, NUTR-06, NUTR-07
**Success Criteria** (what must be TRUE):
  1. A visitor to /education can expand the Breath Training section and find research for each breathing pattern (Vagal Reset, Deep Relaxation, 4-7-8, Box Breathing, Energizing) plus intermittent hypoxia and CO2 tolerance, with every study linking to a real PubMed page
  2. A visitor can expand the Exercise Science section and find research on Keith Baar's collagen protocol, neuromuscular recruitment, VO2 max / REHIT training, the cognition-muscle-bone-longevity chain, and sarcopenia prevention, all with verified citations
  3. A visitor can expand the Nutrition Science section and find research on Dr. Boz ratio, intermittent fasting / FGF21, fructose as metabolic medicine, metabolism / BMR raising, anti-starvation-diet evidence, and protein timing, all with verified citations
  4. Cross-references between these three domains are explicit -- breath sections mention VO2 max connections to exercise, nutrition sections reference exercise recovery, exercise sections cite breath and nutrition support
  5. Zero placeholder or fabricated PMIDs remain in the Breath Training, Exercise, or Nutrition sections
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md -- Breath training research: replace fabricated PMIDs with 4 verified studies covering all breathing patterns, Wim Hof/hypoxia, CO2 tolerance (DONE 2026-03-19, commit 6491b491)
- [x] 01-02-PLAN.md -- Exercise science research: 8 verified studies covering Baar protocol, neuromuscular EMG, REHIT/VO2 max, sarcopenia-cognition chain, bone health (DONE 2026-03-19, commit da751ff0)
- [x] 01-03-PLAN.md -- Nutrition science research: 7 verified studies covering GKI/Dr. Boz, FGF21/autophagy, fructose signaling, anti-starvation evidence, protein timing (DONE 2026-03-19, commit 496ee62c)
- [x] 01-04-PLAN.md -- Cross-domain integration: audit confirmed all 6 connection threads present, portal URLs verified, zero fabricated PMIDs in 19 Phase 1 studies (DONE 2026-03-19)

### Phase 2: Cognitive Science
**Goal**: The education page presents N-Back training, ear training, vision training, and mental mastery as facets of adult neuroplasticity, each with verified research
**Depends on**: Phase 1 (neuromuscular and VO2 max research informs cognitive-physical connections)
**Requirements**: NBACK-01, NBACK-02, NBACK-03, EAR-01, EAR-02, EAR-03, EAR-04, VISN-01, VISN-02, VISN-03, MMOD-01, MMOD-02, MMOD-03
**Success Criteria** (what must be TRUE):
  1. A visitor can expand the N-Back / Working Memory section and find Jaeggi 2008, meta-analyses on transfer, and dose-response research, all linking to real PubMed pages
  2. A visitor can expand the Ear Training section and find research on pitch trainability, auditory neuroplasticity, spaced repetition for auditory learning, and music therapy outcomes
  3. A visitor can expand the Vision Training section and find at least 3 verified studies on accommodation exercises, perceptual learning, and adult visual neuroplasticity
  4. A visitor can expand the Mental Mastery section and find research on structured cognitive training and cognitive reserve against age-related decline
  5. Cross-references connect these cognitive domains to each other (N-Back to ear training dual modality, mental mastery to neuromuscular recruitment from Phase 1) with explicit call-outs
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md -- Category type infrastructure + N-Back/working memory research (Jaeggi 2008, Au 2015 meta-analysis, Melby-Lervag 2016 honest counterbalance) (DONE 2026-03-19, commits 36b4f3a0/900bdaf7)
- [x] 02-02-PLAN.md -- Ear training research (Kraus 2010 auditory neuroplasticity, Herholz 2012 brain plasticity, Cepeda 2008 spacing effect, Roman-Caballero 2018 music therapy) (DONE 2026-03-19, commit 9af805dc)
- [x] 02-03-PLAN.md -- Vision science PMID correction (replace 3 bogus PMIDs with Deveau 24556432, Polat 19520103/19622368, Allen 20304003) (DONE 2026-03-19, commit 6a6b280a)
- [x] 02-04-PLAN.md -- Mental mastery research (Stern 23079557, Willis ACTIVE 17179457, Park 23576894) + all 7 cross-domain connections verified present (DONE 2026-03-19, commits 5f32dde8/3fda1389)
- [x] 02-05-PLAN.md -- Gap closure: added "breath-training" to Kraus 2010 crossReferences + meditative listening/pitch discrimination synergy sentence (DONE 2026-03-19, commit dbe4fc61)

### Phase 3: Peptide Science
**Goal**: The education page provides comprehensive, citation-backed research for all 9 tracked peptides plus co-op sourcing documentation, connecting peptide use to the exercise and nutrition science from Phase 1
**Depends on**: Phase 1 (peptide-exercise synergies reference tendon repair, GH recovery, metabolic peptides)
**Requirements**: PEPT-01, PEPT-02, PEPT-03, PEPT-04, COOP-01, COOP-02
**Success Criteria** (what must be TRUE):
  1. A visitor can expand the Peptide Therapeutics section and find 2-4 real PubMed studies for each of the 9 peptides (BPC-157, TB-500, Semaglutide, Ipamorelin, Epithalon, GHK-Cu, DSIP, MOTS-c, 5-Amino-1MQ)
  2. Each peptide entry includes mechanism of action, clinical findings, and safety profile -- all cited with verified sources
  3. Peptide-exercise synergies are explicitly documented (BPC-157/TB-500 for tendon repair referencing Baar protocol, Semaglutide muscle loss risk referencing sarcopenia research, Ipamorelin GH for recovery)
  4. The Peptide Co-op section includes documentation on third-party COA testing for purity and direct sourcing benefits, with authoritative references
  5. Zero placeholder or fabricated PMIDs remain in the Peptide Therapeutics section
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Peptide research batch 1: replace 8 fabricated PMIDs with 12 verified studies for BPC-157 (3), TB-500 (2), Semaglutide (2), Ipamorelin (2), Epithalon (3) with exercise-protocol cross-references (DONE 2026-03-19, commit d59ae13c)
- [x] 03-02-PLAN.md -- Peptide research batch 2: append 11 verified studies for GHK-Cu (3), DSIP (2), MOTS-c (2), 5-Amino-1MQ (2) plus 2 co-op sourcing studies with nutrition-science cross-references (DONE 2026-03-19, commit bd53977b)
- [x] 03-03-PLAN.md -- Synergy cross-references and final audit: update practicalApplication with portal links and cross-domain synergy text, verify all 23 PMIDs present with zero fabricated (DONE 2026-03-19, commit e4aaa305)

### Phase 4: Behavioral Science
**Goal**: The education page documents the science of behavior change -- journaling, accountability, gamification with financial stakes, and deep meditation -- each grounded in verified research
**Depends on**: Phase 1 (meditation cross-references breath training), Phase 2 (meditation references cognitive benefits)
**Requirements**: JRNL-01, JRNL-02, JRNL-03, ACCT-01, ACCT-02, ACCT-03, GAME-01, GAME-02, GAME-03, MEDT-01, MEDT-02, MEDT-03, MEDT-04
**Success Criteria** (what must be TRUE):
  1. A visitor can expand the Journaling section and find Pennebaker's expressive writing research, gratitude/mood-tracking studies, and at least 3 studies demonstrating health/psychological outcomes, all with real PubMed links
  2. A visitor can expand the Daily Accountability section and find research on self-monitoring, habit formation, accountability systems, and at least 3 studies on daily check-ins improving outcomes
  3. A visitor can expand the Gamification & Stakes section and find research on loss aversion, commitment devices / deposit contracts, and gamification elements in wellness apps
  4. A visitor can expand the Deep Meditation section and find research on neurological changes / default mode network, VR-enhanced meditation, and stress reduction meta-analyses (Grossman, Goyal)
  5. Cross-references connect meditation to breath training and journaling, and accountability to gamification, with explicit call-outs
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Add "behavioral" category type + Journaling section (Pennebaker 1988, Petrie 1995, Redwine 2016 gratitude/HRV, Smyth 1998 meta-analysis) + Accountability section (Burke 2011 self-monitoring, Patel 2021 digital tracking, Wing 1999 social accountability RCT) (DONE 2026-03-19, commits 873c12cd/79d3dfbe)
- [x] 04-02-PLAN.md -- Gamification section (Rewley 2021 loss aversion, Volpp 2008 deposit contracts, Halpern 2015 reward vs deposit, Nishi 2024 gamification meta-analysis) + Meditation section (Brewer 2011 DMN, Tang 2020 gray matter, Chavez 2020 VR pilot, Goyal 2014 JAMA, Grossman 2004 MBSR) (DONE 2026-03-19, commits 7acab35e/3853aa77)
- [ ] 04-03-PLAN.md -- Cross-domain integration: wire 5 required connections (meditation-breath, meditation-ear, journaling-meditation, accountability-gamification, meditation-nback), remove duplicate Grossman from general-health, final 16-PMID audit

### Phase 5: Quality Assurance & Cross-Domain Integration
**Goal**: Every citation on the education page is verified real, every section links to its portal feature, and cross-domain connections form a coherent web of systems
**Depends on**: Phases 1-4 (all research must be written before QA sweep)
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. Every PubMed link on the /education page resolves to a real study page (no 404s, no fabricated IDs)
  2. Zero placeholder PMIDs remain anywhere on the page -- a search for "PMID: 00000000" or similar patterns returns zero results
  3. Each research section includes a "Practical Application" note that links to the relevant portal feature (e.g., Breath Training research links to /breath)
  4. Cross-domain connections are called out in every section -- the web of systems (breath-exercise-nutrition triangle, cognitive chain, peptide-exercise synergies, meditation-breath overlap) is explicitly visible to readers
**Plans**: TBD

Plans:
- [ ] 05-01: Full PMID verification sweep and link testing
- [ ] 05-02: Practical application links and cross-domain connection audit
- [ ] 05-03: Final review and deploy

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundational Physiology | 4/4 | Complete    | 2026-03-19 |
| 2. Cognitive Science | 5/5 | Complete    | 2026-03-19 |
| 3. Peptide Science | 3/3 | Complete    | 2026-03-19 |
| 4. Behavioral Science | 1/3 | In progress | - |
| 5. Quality Assurance | 0/3 | Not started | - |
