# Phase 3: Peptide Science - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase replaces all fabricated PMIDs in the peptide-science section with verified PubMed studies for all 9 tracked peptides (BPC-157, TB-500, Semaglutide, Ipamorelin, Epithalon, GHK-Cu, DSIP, MOTS-c, 5-Amino-1MQ), adds co-op sourcing documentation, and builds explicit peptide-exercise-nutrition synergy cross-references.

</domain>

<decisions>
## Implementation Decisions

### Peptide Content Scope
- 2-3 verified PubMed studies per peptide (matching PEPT-01 requirement of 2-4), totaling ~20-27 studies across 9 peptides
- Replace existing fabricated section in-place — same `peptide-science` section ID, all new verified study data
- Co-op documentation (COOP-01, COOP-02) added as studies within the peptide-science section covering COA testing and supply chain integrity
- Safety profiles included in keyFindings per PEPT-02 — note limitations honestly (mostly animal data for several peptides)

### Peptide-Exercise Synergy & Cross-Domain
- Explicit cross-refs per PEPT-04: BPC-157/TB-500→Baar tendon protocol (exercise-protocols), Semaglutide→sarcopenia risk (exercise-protocols), Ipamorelin→GH recovery (exercise-protocols)
- MOTS-c and 5-Amino-1MQ cross-reference nutrition-science (mitochondrial biogenesis, BMR raising)
- Practical application links: `/peptides` portal page + `/order` co-op page
- Keep existing `"peptides"` category — already in the TypeScript type union

### Claude's Discretion
- Specific study selection per peptide (as long as real, verified PubMed studies)
- Exact wording of safety profile notes
- Order of peptides within the section
- Level of detail on co-op sourcing documentation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/education/page.tsx` — education page with Study interface including `crossReferences?: string[]`
- Existing `peptide-science` section with 8 fabricated studies (PMIDs: 37456789, 35789234, 37891234, 38123456, 36789456, 37456789, 35678912, 38567890)
- "peptides" category already in type union

### Established Patterns
- Phase 1/2 pattern: replace fabricated data in-place, verify with grep, cross-reference via relevance text + crossReferences array
- PubMed link format: `https://pubmed.ncbi.nlm.nih.gov/{PMID}/`
- Evidence-focused but accessible tone

### Integration Points
- Cross-references to: exercise-protocols (Baar tendon, sarcopenia), nutrition-science (mitochondria, BMR)
- Portal links: /peptides, /order

</code_context>

<specifics>
## Specific Ideas

- **BPC-157**: Sikiric is the primary researcher — look for his real published studies on tissue repair
- **TB-500**: Thymosin Beta-4 — look for real wound healing and muscle regeneration studies
- **Semaglutide**: FDA-approved GLP-1 agonist — well-studied, multiple real RCTs available (STEP trials)
- **Ipamorelin**: Growth hormone secretagogue — look for real clinical trials on GH release
- **Epithalon**: Khavinson is the primary researcher — telomerase activation studies
- **GHK-Cu**: Pickart is the primary researcher — copper peptide collagen studies
- **DSIP**: Delta sleep-inducing peptide — older research from 1970s-2000s
- **MOTS-c**: Mitochondrial peptide — Lee is the primary researcher, metabolic effects
- **5-Amino-1MQ**: NNMT inhibitor — Neelakantan is the primary researcher

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
