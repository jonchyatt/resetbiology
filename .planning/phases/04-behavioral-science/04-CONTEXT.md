# Phase 4: Behavioral Science - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds four new research sections to the /education page covering the behavioral science domains: Journaling, Daily Accountability, Gamification & Stakes, and Deep Meditation. Each section must have verified PubMed studies with cross-references to prior phases (especially breath training and cognitive science) and between behavioral domains.

</domain>

<decisions>
## Implementation Decisions

### Content Scope
- 4 sections: Journaling, Daily Accountability, Gamification & Stakes, Deep Meditation
- 3-4 studies per domain (13 requirements across 4 domains)
- Add "behavioral" to the category union type
- Meditation section explicitly cross-references breath-training (parasympathetic overlap) and ear-training (sound-based practices)

### Cross-Domain & Practical Applications
- Meditation-breath overlap: meditation→breath-training (parasympathetic), meditation→ear-training (sound-based), journaling→meditation (reflective practices)
- Gamification/stakes framing: honest — loss aversion is real but commitment devices have mixed results
- Practical application links: /journal, /portal (daily tasks + gamification), /breath (meditation overlap)
- VR meditation: include per MEDT-02 if real PubMed studies exist, note emerging/limited evidence

### Claude's Discretion
- Specific study selection per domain
- Exact framing of gamification evidence limitations
- VR meditation study selection (if available)
- Order of sections within the behavioral science group

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/education/page.tsx` — education page with Study interface including crossReferences
- Categories: "breath" | "peptides" | "exercise" | "nutrition" | "general" | "cognitive" — need to add "behavioral"
- Established patterns from 3 prior phases

### Established Patterns
- Inline cross-references in relevance text + crossReferences array
- practicalApplication field with portal feature URL
- Evidence-focused accessible tone with honest limitations

### Integration Points
- Cross-references to: breath-training (parasympathetic), ear-training (sound-based meditation), nback-working-memory (cognitive training)
- Portal links: /journal, /portal, /breath

</code_context>

<specifics>
## Specific Ideas

- **Journaling**: Pennebaker's expressive writing is the landmark — foundational 1988 study and subsequent health outcomes research
- **Accountability**: Self-monitoring is well-studied in health behavior — daily check-ins, habit formation literature
- **Gamification**: Loss aversion (Kahneman/Tversky), commitment devices (stickK-style deposit contracts), wellness app gamification
- **Meditation**: DMN/default mode network studies, mindfulness meta-analyses (Grossman, Goyal), VR meditation if real studies exist
- **The meditation-breath bridge**: Parasympathetic overlap is a key narrative — both activate vagal tone

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
