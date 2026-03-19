# Phase 1: Foundational Physiology - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers comprehensive, citation-backed research content for the three foundational physiology domains on the /education page: Breath Training, Exercise Science, and Nutrition Science. Each section must contain real, verified PubMed studies with cross-references between domains forming a coherent metabolic system narrative.

</domain>

<decisions>
## Implementation Decisions

### Content Structure & Study Format
- 2-3 studies per sub-topic, matching REQUIREMENTS spec of 2-4 per area
- Extend existing Study interface with optional `crossReferences` field for cross-domain links
- 3 main sections: "Breath Training & Metabolic Health", "Exercise & Movement Science", "Nutrition Science" — each with expandable sub-categories
- Replace existing fake PMIDs in-place — same section IDs, new real study data

### Research Verification & Citation Format
- Web search for actual studies on each topic, use known landmark papers (Baar, Wim Hof, Dr. Boz, etc.)
- Include both DOI and PMID when available — existing interface supports both fields
- PubMed link format: `https://pubmed.ncbi.nlm.nih.gov/{PMID}/`
- Study summary tone: evidence-focused but accessible ("demonstrates", "validates", "supports")

### Cross-Domain Integration Style
- Cross-references via inline `relevance` field text + dedicated `crossReferences` array on Study interface
- Subtle but explicit cross-links — mention in key findings or relevance, not separate visual blocks
- User's key insights woven throughout as connecting threads (Baar protocol, REHIT, Dr. Boz ratio, metabolism > mitochondria chain)
- Keep existing `practicalApplication` field on each section, linking to portal feature URL

### Claude's Discretion
- Specific study selection within each topic area (as long as they are real, verified PubMed studies)
- Exact wording of summaries and key findings
- Order of studies within each section

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/education/page.tsx` — 738-line education page with search, filter, expand functionality
- `Study` interface: id, title, authors, journal, year, doi?, pmid?, category, summary, keyFindings[], relevance, link?
- `ResearchSection` interface: id, title, description, category, studies[], practicalApplication
- `PortalHeader` component with section prop
- Existing sections: breath-training, peptide-science, exercise-protocols, vision-science, mental-training

### Established Patterns
- Research data stored as `const researchData: ResearchSection[]` inline in the page component
- Categories: "breath" | "peptides" | "exercise" | "nutrition" | "general"
- Studies rendered with expandable cards, search filtering, category tabs
- PubMed links formatted as `https://pubmed.ncbi.nlm.nih.gov/{PMID}/`

### Integration Points
- Education page at `app/education/page.tsx` (NOT `src/app/education/page.tsx`)
- Portal navigation includes Education link
- Cross-links to portal features: /breath, /workout, /nutrition, /peptides

</code_context>

<specifics>
## Specific Ideas

User's key research angles to weave throughout (from STATE.md):
- **Keith Baar tendon/ligament protocol** — gelatin + vitamin C pre-exercise for collagen synthesis
- **REHIT for VO2 max** — Reduced Exertion High Intensity Training, mitochondrial biogenesis
- **Wim Hof style breathing** — autophagy induction AND VO2 max improvement via intermittent hypoxia
- **Dr. Boz insulin ratio** — glucose/ketone ratio as metabolic health marker
- **FGF21 pathway** — fructose as counterintuitive metabolic medicine via FGF21 stimulation
- **Anti-starvation-diet evidence** — low calorie diets KILL BMR, raising metabolism builds mitochondria
- **The chain** — sharp mind > neuromuscular control > muscle preservation > bone density > longevity
- **Protein timing** — distribution for muscle protein synthesis supporting workout recovery

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
