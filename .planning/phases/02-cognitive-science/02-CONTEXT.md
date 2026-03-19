# Phase 2: Cognitive Science - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers comprehensive, citation-backed research content for the four cognitive science domains on the /education page: N-Back/Working Memory, Ear Training, Vision Training, and Mental Mastery. Each section uses adult neuroplasticity as the unifying scientific thread, with verified PubMed studies and cross-references to Phase 1 physiology content and between cognitive domains.

</domain>

<decisions>
## Implementation Decisions

### Content Scope & Existing Assets
- Keep existing verified studies if they match requirements: Jaeggi (18378733), Deveau (24508170), Scheiman (10416930), Polat (19084554)
- 4 sections: N-Back/Working Memory, Ear Training, Vision Training, Mental Mastery — matching ROADMAP structure
- 3-4 studies per domain (13 requirements across 4 domains), consistent with Phase 1 depth
- Add "cognitive" category to the category union type alongside existing breath/peptides/exercise/nutrition/general

### Cross-Domain Connections
- Cross-reference Phase 1 content: N-Back→neuromuscular recruitment (WORK-02), ear training→meditation (Phase 4 future), mental mastery→cognition-muscle-bone chain
- Inter-cognitive cross-refs: N-Back↔ear training (dual modality), mental mastery↔all cognitive domains, vision↔perceptual learning
- Practical application portal links: /mental-training (N-Back + pitch recognition), /vision-training, /portal (mental mastery overview)
- Neuroplasticity as central unifying theme — each section explicitly connects to adult neuroplasticity

### Claude's Discretion
- Specific study selection for ear training (less established research area)
- Exact wording of neuroplasticity thread connections
- Study order within sections
- Whether to add additional landmark studies beyond minimum requirements

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/education/page.tsx` — education page with Study interface now including `crossReferences?: string[]` (added in Phase 1)
- Existing vision-science section with 3 verified studies (Deveau, Scheiman, Polat)
- Existing mental-training section with Jaeggi 2008 study
- Category filtering already works for "general" (used by vision/mental)

### Established Patterns
- Phase 1 established: inline cross-references in `relevance` field + `crossReferences` array
- practicalApplication field on each ResearchSection linking to portal feature
- PubMed link format: `https://pubmed.ncbi.nlm.nih.gov/{PMID}/`

### Integration Points
- Education page at `app/education/page.tsx`
- Portal links: /mental-training, /vision-training
- Cross-references to Phase 1 sections: breath-training, exercise-protocols, nutrition-science

</code_context>

<specifics>
## Specific Ideas

- **N-Back**: Jaeggi 2008 is the landmark — keep and enrich with meta-analyses on transfer debate and dose-response
- **Ear Training**: Connect to spaced repetition (FSRS system used in pitch recognition game), auditory neuroplasticity, music therapy
- **Vision Training**: Existing 3 studies are strong — add perceptual learning and adult neuroplasticity angle
- **Mental Mastery**: Cognitive reserve against age-related decline, structured training improving real-world function
- **The Chain**: Sharp mind → neuromuscular control → muscle → bone → longevity (from STATE.md user insights)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
