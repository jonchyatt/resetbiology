# Phase 5: Quality Assurance & Cross-Domain Integration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Final QA sweep of the entire /education page. Verify every PubMed link resolves, zero placeholder PMIDs remain, every section has a Practical Application note linking to its portal feature, and cross-domain connections form a coherent web across all 13 research sections.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/QA phase. The work is:
1. Verify every PMID on the page links to a real PubMed study (no 404s)
2. Verify zero placeholder/fabricated PMIDs remain (search for suspicious patterns like sequential round numbers)
3. Verify every section has a practicalApplication field linking to the correct portal feature
4. Verify cross-domain connections are explicitly present in every section
5. Fix any gaps found during the sweep

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/education/page.tsx` — ~1780 lines, 13 research sections with ~70 total studies
- All studies follow the Study interface with pmid, link, crossReferences fields
- Phases 1-4 each ran their own PMID audits, but no full-page sweep has been done

### Established Patterns
- PubMed link format: `https://pubmed.ncbi.nlm.nih.gov/{PMID}/`
- practicalApplication field on each ResearchSection
- crossReferences array on studies for cross-domain linking

### Integration Points
- Portal feature URLs: /breath, /workout, /nutrition, /peptides, /order, /mental-training, /vision-training, /journal, /portal

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
