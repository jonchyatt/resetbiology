# Phase 2: Cognitive Science - Research

**Researched:** 2026-03-19
**Domain:** Adult neuroplasticity across N-Back/working memory, ear training, vision training, and mental mastery
**Confidence:** HIGH for landmark studies (verified PubMed), MEDIUM for newer supporting studies

---

## Summary

Phase 2 adds four cognitive science sections to the education page (`app/education/page.tsx`):
N-Back/Working Memory, Ear Training/Auditory Neuroplasticity, Vision Training/Eye Health, and
Mental Mastery/Cognitive Reserve. Each section uses adult neuroplasticity as its unifying thread
and cross-references both Phase 1 physiology content and the other cognitive domains.

**Critical discovery:** All four existing PMIDs in the current code are WRONG — they point to
completely unrelated papers. The Jaeggi PMID in the code (`18378733`) is a critical care nursing
article; the Deveau PMID (`24508170`) is an ant genome study; the Scheiman PMID (`10416930`) is
a myopia-in-children spectacle study; the Polat PMID (`19084554`) is a fish beta-defensin study.
Every one of these must be replaced with the real verified PMIDs documented below.

**Primary recommendation:** Replace all four bogus PMIDs with verified ones and expand each
cognitive section from its current sparse state (1-3 studies each) to 3-4 verified studies matching
the depth of Phase 1 sections. Add "cognitive" to the category union type and split the current
combined `mental-training` section into separate `nback-working-memory` and `ear-training` sections,
retaining the existing `vision-science` section ID.

---

## Standard Stack

No new libraries needed. Phase 2 is a pure content addition to `app/education/page.tsx` using the
exact same TypeScript data structures established in Phase 1.

### Existing TypeScript Interfaces (Reuse As-Is)

```typescript
interface Study {
  id: string
  title: string
  authors: string
  journal: string
  year: number
  doi?: string
  pmid?: string
  category: "breath" | "peptides" | "exercise" | "nutrition" | "general"
  // Must add: "cognitive" to this union
  summary: string
  keyFindings: string[]
  relevance: string
  link?: string
  crossReferences?: string[]
}

interface ResearchSection {
  id: string
  title: string
  description: string
  category: "breath" | "peptides" | "exercise" | "nutrition" | "general"
  // Must add: "cognitive" to this union
  studies: Study[]
  practicalApplication: string
}
```

### Category Enum Change Required

Add `"cognitive"` to the category union type in both interfaces (two places), and add a category
filter button for "Cognitive Science" in the `categories` array in the component (line ~773).

---

## Architecture Patterns

### Current Page Structure (from Phase 1)

The education page at `app/education/page.tsx` contains a `researchData: ResearchSection[]` array.
Phase 1 added/updated: `breath-training`, `exercise-protocols`, `nutrition-science`.
Phase 2 adds/updates: `nback-working-memory`, `ear-training`, `vision-science` (update existing),
`mental-mastery` (new, replacing the existing sparse `mental-training`).

### Section ID Strategy

| Existing Section ID | Phase 2 Action |
|--------------------|---------------|
| `mental-training` | REPLACE with two sections: `nback-working-memory` + `ear-training` |
| `vision-science` | UPDATE in-place: replace 3 bogus PMIDs with verified ones + enrich content |
| (new) | ADD `mental-mastery` section |

The existing `mental-training` section contains Jaeggi (bogus PMID), a spaced repetition study
(PMID 24932672 — not yet verified), and a pitch training study (PMID 23424073 — not yet verified).
Replace the entire section with the properly structured content below.

### Cross-Reference Pattern (Established in Phase 1)

Cross-references appear inline in the `relevance` field with explicit "see X section" language
AND in the `crossReferences?: string[]` array using section IDs. Follow this exact pattern:

```typescript
{
  relevance: "...Cross-reference: N-Back training shares the neuroplasticity foundation that
    makes attentional control trainable (see N-Back section above). The ear training FSRS system
    builds on the spacing effect to consolidate auditory memory across sleep cycles.",
  crossReferences: ["nback-working-memory", "exercise-protocols"]
}
```

---

## Verified Studies by Domain

### Domain 1: N-Back / Working Memory

**Requirement coverage:** NBACK-01 (Jaeggi + meta-analyses), NBACK-02 (dose-response), NBACK-03 (cross-references)

#### Study 1 — Landmark / NBACK-01
- **Title:** Improving fluid intelligence with training on working memory
- **Authors:** Jaeggi SM, Buschkuehl M, Jonides J, Perrig WJ
- **Journal:** Proceedings of the National Academy of Sciences
- **Year:** 2008
- **PMID:** 18443283 (VERIFIED — matches title and abstract)
- **DOI:** 10.1073/pnas.0801268105
- **Link:** https://pubmed.ncbi.nlm.nih.gov/18443283/
- **Key findings:**
  - Dual N-Back training improved fluid intelligence (Gf) scores in a dose-dependent manner
  - More training sessions produced larger Gf improvements — dose-response confirmed
  - Transfer effects occurred to untrained cognitive tasks
  - Launched the modern cognitive training field

#### Study 2 — Meta-Analysis Supporting / NBACK-01
- **Title:** Improving fluid intelligence with training on working memory: a meta-analysis
- **Authors:** Au J, Sheehan E, Tsai N, Duncan GJ, Buschkuehl M, Jaeggi SM
- **Journal:** Psychonomic Bulletin & Review
- **Year:** 2015
- **PMID:** 25102926 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/25102926/
- **Key findings:**
  - Meta-analysis of 20 N-back training studies
  - Modest but statistically significant positive effect on fluid intelligence
  - Several moderating factors identified affecting cognitive transfer

#### Study 3 — Honest Counterbalance / NBACK-02
- **Title:** Working Memory Training Does Not Improve Performance on Measures of Intelligence or Other Measures of "Far Transfer": Evidence From a Meta-Analytic Review
- **Authors:** Melby-Lervåg M, Redick TS, Hulme C
- **Journal:** Perspectives on Psychological Science
- **Year:** 2016
- **PMID:** 27474138 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/27474138/
- **Key findings:**
  - 87 publications, 145 experimental comparisons
  - Reliable improvements on working memory tasks themselves (near transfer)
  - No convincing evidence of far transfer to intelligence or real-world skills
  - Training produces specific effects that don't always generalize

**FRAMING NOTE:** Present all three studies together with honest framing: Jaeggi 2008 established
the possibility, Au et al. 2015 found modest supportive meta-analytic evidence, Melby-Lervåg 2016
shows the debate is real. The value of N-Back is in training the working memory process itself
(near transfer is reliable) and the neuroplasticity it exercises — not guaranteed far transfer to IQ.
This honest framing is MORE compelling than overclaiming.

#### Study 4 — Multi-Level Meta-Analysis / NBACK-02 dose-response
- **Title:** Working memory training revisited: A multi-level meta-analysis of n-back training studies
- **Authors:** Soveri A, Antfolk J, Karlsson L, Salo B, Laine M
- **Journal:** Psychonomic Bulletin & Review
- **Year:** 2017
- **PMID:** 28116702 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/28116702/
- **Key findings:**
  - 203 effect sizes from 33 randomized controlled trials
  - Medium-sized transfer to untrained n-back tasks confirmed
  - Very small effect sizes for fluid intelligence and cognitive control
  - No significant moderating effect from training dose

**RECOMMENDATION:** Use 3 studies for N-Back section: Jaeggi 2008 (18443283), Au 2015 (25102926),
and Melby-Lervåg 2016 (27474138). The honest presentation of the scientific debate is stronger
than cherry-picking only positive results, and it matches the Phase 1 pattern of framing limitations
honestly (as done with WHM breathing).

---

### Domain 2: Ear Training / Auditory Neuroplasticity

**Requirement coverage:** EAR-01 (pitch trainability), EAR-02 (auditory cognitive sharpness),
EAR-03 (spaced repetition + music therapy), EAR-04 (cross-references)

#### Study 1 — Auditory Neuroplasticity / EAR-01 + EAR-02
- **Title:** Music training for the development of auditory skills
- **Authors:** Kraus N, Chandrasekaran B
- **Journal:** Nature Reviews Neuroscience
- **Year:** 2010
- **PMID:** 20648064 (VERIFIED)
- **DOI:** 10.1038/nrn2882
- **Link:** https://pubmed.ncbi.nlm.nih.gov/20648064/
- **Key findings:**
  - Music training leads to changes throughout the auditory system
  - These changes prime musicians for listening challenges beyond music
  - Benefits extend to speech and language processing
  - Music functions like exercise — conditioning the brain for enhanced auditory abilities

#### Study 2 — Musical Training as Brain Plasticity Framework / EAR-01 + EAR-02
- **Title:** Musical training as a framework for brain plasticity: behavior, function, and structure
- **Authors:** Herholz SC, Zatorre RJ
- **Journal:** Neuron
- **Year:** 2012
- **PMID:** 23141061 (VERIFIED)
- **DOI:** 10.1016/j.neuron.2012.10.011
- **Link:** https://pubmed.ncbi.nlm.nih.gov/23141061/
- **Key findings:**
  - Musical training involves multiple modalities and higher-order cognitive functions
  - Results in behavioral, structural, and functional brain changes on timescales of days to years
  - Controlled training studies provide clear experimental evidence for training-induced plasticity
  - Synthesizes common patterns across broad neuroplasticity research

#### Study 3 — Spacing Effect / EAR-03 + FSRS connection
- **Title:** Spacing effects in learning: a temporal ridgeline of optimal retention
- **Authors:** Cepeda NJ, Vul E, Rohrer D, Wixted JT, Pashler H
- **Journal:** Psychological Science
- **Year:** 2008
- **PMID:** 19076480 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/19076480/
- **Key findings:**
  - Over 1,350 participants studied across gaps up to 3.5 months, tested up to 1 year later
  - Optimal study gap is approximately 20-40% of the eventual test interval
  - Increasing the interstudy gap first increases then gradually reduces final retention
  - Many educational practices are highly inefficient by ignoring spacing-delay interactions

**NOTE ON EXISTING SPACED REPETITION STUDY (24932672):** PMID 24932672 has NOT been verified
against PubMed in this research session. The existing code uses this PMID. Cepeda 2008 (19076480)
is a superior, more foundational citation for the FSRS/spacing connection and is fully verified.
Replace 24932672 with 19076480.

#### Study 4 — Music Therapy Cognitive Benefits / EAR-03 + EAR-04
- **Title:** Musical practice as an enhancer of cognitive function in healthy aging — A systematic review and meta-analysis
- **Authors:** Román-Caballero R, Arnedo M, Triviño M, Lupiáñez J
- **Journal:** PLoS One
- **Year:** 2018
- **PMID:** 30481227 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/30481227/
- **Key findings:**
  - 13 studies: 9 cross-sectional (musicians vs non-musicians), 4 short-term training RCTs
  - Musical practice yields cognitive and cerebral benefits in domain-specific AND general functions
  - Protects cognitive functions that typically decline with aging
  - Three mechanisms: direct skill development, improved compensatory processes, preserved processing speed

**RECOMMENDATION:** Use 3 studies: Kraus & Chandrasekaran 2010 (20648064), Herholz & Zatorre 2012
(23141061), Cepeda 2008 (19076480). The Román-Caballero 2018 meta-analysis (30481227) may be added
as a 4th study if the planner wants explicit music therapy coverage for EAR-03.

---

### Domain 3: Vision Training

**Requirement coverage:** VISN-01 (accommodation exercises), VISN-02 (adult visual neuroplasticity),
VISN-03 (at least 3 studies with real PubMed links)

**Critical fix:** ALL THREE existing PMIDs are wrong. The studies referenced (Deveau baseball,
Scheiman accommodation, Polat amblyopia) are real studies — but the PMIDs in the code point to
completely different papers.

#### Study 1 — Perceptual Learning in Baseball / VISN-01 + VISN-03
- **Title:** Improved vision and on-field performance in baseball through perceptual learning
- **Authors:** Deveau J, Ozer DJ, Seitz AR
- **Journal:** Current Biology
- **Year:** 2014
- **PMID:** 24556432 (VERIFIED — the existing code has 24508170 which is an ant genome study)
- **DOI:** 10.1016/j.cub.2014.01.004
- **Link:** https://pubmed.ncbi.nlm.nih.gov/24556432/
- **Key findings:**
  - Perceptual learning program improved visual acuity in college baseball players
  - Trained players had decreased strikeouts and created more runs
  - Training led to potentially 4-5 additional team wins
  - Perceptual learning transfers to real-world visual tasks

#### Study 2 — Perceptual Learning as Practical Vision Improvement / VISN-02 + VISN-03
- **Title:** Making perceptual learning practical to improve visual functions
- **Authors:** Polat U
- **Journal:** Vision Research
- **Year:** 2009
- **PMID:** 19520103 (VERIFIED — the existing code has 19084554 which is a fish immune study)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/19520103/
- **Key findings:**
  - Contrast detection training transfers to unrelated visual functions
  - Improved contrast sensitivity in amblyopia and presbyopia cases
  - Some presbyopia subjects eliminated need for reading glasses
  - Perceptual learning is a practical method for people with impaired or blurred vision

#### Study 3 — Treating Amblyopia by Perceptual Learning / VISN-02 + VISN-03
- **Title:** Treatment of children with amblyopia by perceptual learning
- **Authors:** Polat U, Ma-Naim T, Spierer A
- **Journal:** Vision Research
- **Year:** 2009
- **PMID:** 19622368 (VERIFIED — a real Polat 2009 study in Vision Research)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/19622368/
- **Key findings:**
  - Perceptual learning improved visual acuity by 1.5 Snellen lines / 2.12 ETDRS lines
  - Enhanced contrast sensitivity to normal levels in amblyopic children
  - Computer-based visual training succeeded after conventional patching failed
  - Visual cortex retains plasticity even after critical period

**NOTE ON SCHEIMAN:** The Scheiman 1988 paper on normative accommodative facility data
(PMID 3364515 — from search results but not individually verified) establishes normative values
for accommodation. However, for VISN-01 (accommodation exercises as a training modality),
a better verified option exists: Allen PM et al. 2010 "Changes in dynamics of accommodation after
accommodative facility training" (PMID 20304003 — VERIFIED). This shows accommodation facility
training objectively improves accommodation dynamics in both myopes and emmetropes.

#### Study 4 (Optional, strengthens VISN-01) — Accommodation Facility Training / VISN-01
- **Title:** Changes in dynamics of accommodation after accommodative facility training in myopes and emmetropes
- **Authors:** Allen PM, Charman WN, Radhakrishnan H
- **Journal:** Vision Research
- **Year:** 2010
- **PMID:** 20304003 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/20304003/
- **Key findings:**
  - Accommodation facility training improved facility rates in both myopes and emmetropes
  - Improvements correlated with changes in accommodation time constants and peak velocity
  - 3-day training protocol (5 min monocular right eye + 5 min left eye + 5 min binocular)
  - Objective PowerRefractor measurements confirmed training-induced changes

**RECOMMENDATION:** Use 3 studies for VISN-03 minimum: Deveau 2014 (24556432), Polat 2009 making
perceptual learning practical (19520103), and Polat 2009 amblyopia treatment (19622368). Add
Allen 2010 (20304003) as the fourth study for explicit accommodation exercise coverage (VISN-01).

---

### Domain 4: Mental Mastery / Cognitive Reserve

**Requirement coverage:** MMOD-01 (structured cognitive training → real-world function),
MMOD-02 (cognitive reserve against age-related decline), MMOD-03 (cross-references)

#### Study 1 — Cognitive Reserve Theory / MMOD-02
- **Title:** Cognitive reserve in ageing and Alzheimer's disease
- **Authors:** Stern Y
- **Journal:** Lancet Neurology
- **Year:** 2012
- **PMID:** 23079557 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/23079557/
- **Key findings:**
  - Lifelong experiences including education, occupation, and leisure activities increase cognitive reserve
  - Two reserve types: brain reserve (structural) and cognitive reserve (functional task performance)
  - Enhanced understanding could lead to interventions slowing cognitive aging
  - Epidemiological studies suggest cognitive reserve decreases dementia risk by ~46%

#### Study 2 — ACTIVE Trial 5-Year Real-World Function / MMOD-01
- **Title:** Long-term effects of cognitive training on everyday functional outcomes in older adults
- **Authors:** Willis SL, Tennstedt SL, Marsiske M, Ball K, et al. (ACTIVE Study Group)
- **Journal:** JAMA
- **Year:** 2006
- **PMID:** 17179457 (VERIFIED)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/17179457/
- **Key findings:**
  - 2,832 participants; mean age 73.6 years; 5-year follow-up
  - Reasoning training group reported significantly less difficulty with instrumental activities of daily living
  - Training-specific cognitive ability improvements persisted across 5 years
  - Booster training enhanced performance gains for reasoning and speed groups

#### Study 3 — Neuroplasticity in Aging Brain / MMOD-01 + MMOD-02
- **Title:** The aging mind: neuroplasticity in response to cognitive training
- **Authors:** Park DC, Bischof GN
- **Journal:** Dialogues in Clinical Neuroscience
- **Year:** 2013
- **PMID:** 23576894 (VERIFIED — fetched PMC article, PMID confirmed)
- **Link:** https://pubmed.ncbi.nlm.nih.gov/23576894/
- **Key findings:**
  - Aging brain demonstrates considerable plasticity through cognitive training
  - Brain can increase neural activity and develop compensatory mechanisms
  - Increases in neural volume represent clearest evidence of plasticity
  - Demanding leisure activities with sustained cognitive effort may be superior to passive programs
  - Training effects persist with continued engagement

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PubMed ID lookup | Custom scraper | Verified manually in this doc | PMIDs must be verified by fetching actual PubMed pages |
| Cognitive category filtering | New filter system | Add `"cognitive"` to existing union type | Category filtering already works, just extend the type |
| New section component | New React component | Reuse existing ResearchSection pattern | Phase 1 established the expandable section pattern |

---

## Common Pitfalls

### Pitfall 1: The Fabricated PMID Problem (ALREADY PRESENT IN CODE)

**What goes wrong:** The existing code contains 4 PMIDs that point to completely wrong papers.
This is the primary problem to fix in Phase 2.

**The wrong PMIDs in the code:**
- `18378733` (claimed Jaeggi 2008) → actually a critical care nursing article
- `24508170` (claimed Deveau 2014) → actually an ant genome study
- `10416930` (claimed Scheiman 1999) → actually a myopia-in-children spectacle study
- `19084554` (claimed Polat 2009) → actually a fish beta-defensin immune study

**Correct verified PMIDs:**
- Jaeggi 2008: `18443283`
- Deveau 2014: `24556432`
- Polat 2009 (practical vision): `19520103`
- Polat 2009 (amblyopia treatment): `19622368`

**How to avoid:** Every PMID must be verified by fetching https://pubmed.ncbi.nlm.nih.gov/{PMID}/
and confirming the title matches before committing.

### Pitfall 2: Overclaiming N-Back Transfer

**What goes wrong:** Stating N-Back training improves IQ or general intelligence as established fact.

**Why it happens:** The original Jaeggi 2008 finding was exciting but subsequent meta-analyses
showed the effect is smaller and more specific than initial claims.

**How to avoid:** Frame N-Back as training the working memory system itself (near transfer is
reliable), while honestly noting the scientific debate about far transfer. This is more credible
and matches the existing Phase 1 pattern of honest framing (WHM breathing, adaptive thermogenesis).

### Pitfall 3: Wrong Section IDs in crossReferences

**What goes wrong:** `crossReferences` array uses a section ID that doesn't exist or was renamed.

**Existing section IDs to reference correctly:**
- `"breath-training"` (Phase 1)
- `"exercise-protocols"` (Phase 1)
- `"nutrition-science"` (Phase 1)
- `"nback-working-memory"` (Phase 2 new)
- `"ear-training"` (Phase 2 new)
- `"vision-science"` (Phase 2 updated)
- `"mental-mastery"` (Phase 2 new)

Do NOT reference `"mental-training"` (the old Phase 2 section being replaced).

### Pitfall 4: Duplicate Section IDs

**What goes wrong:** Phase 2 adds new sections but keeps the old `mental-training` section,
creating duplicate coverage and confusion.

**How to avoid:** The plan must explicitly REPLACE `mental-training` with the two new sections
`nback-working-memory` and `ear-training`. Don't append — splice in replacement.

### Pitfall 5: Category Filter Not Updated

**What goes wrong:** New cognitive sections use category `"cognitive"` but the TypeScript union
type still only has `"breath" | "peptides" | "exercise" | "nutrition" | "general"`, causing a
TypeScript compile error.

**How to avoid:** Add `"cognitive"` to both union types and add the filter button to the
`categories` array before any section uses the new category value.

---

## Code Examples

### Pattern: Adding a new ResearchSection with correct crossReferences

```typescript
// Source: Pattern established in Phase 1, app/education/page.tsx
{
  id: "nback-working-memory",
  title: "N-Back Training & Working Memory",
  description: "How systematic dual N-Back practice trains the working memory system — the cognitive buffer that holds and manipulates information — and the active scientific debate about how far these improvements transfer.",
  category: "cognitive",
  practicalApplication: "Our N-Back trainer at /mental-training implements the dual and higher-order N-Back tasks from the Jaeggi protocol. Begin with 2-Back and progress when you achieve >80% accuracy consistently.",
  studies: [
    {
      id: "nback-fluid-jaeggi",
      title: "Improving fluid intelligence with training on working memory",
      authors: "Jaeggi SM, Buschkuehl M, Jonides J, Perrig WJ",
      journal: "Proceedings of the National Academy of Sciences",
      year: 2008,
      pmid: "18443283",
      doi: "10.1073/pnas.0801268105",
      category: "cognitive",
      summary: "...",
      keyFindings: [...],
      relevance: "...Cross-reference: neuromuscular research (see Exercise Science section) shows that intentional attentional control — the same skill N-Back trains — directly translates to better mind-muscle connection and motor unit recruitment. N-Back also provides the dual-modality training that maximally engages both auditory and visual working memory simultaneously (see Ear Training section).",
      crossReferences: ["exercise-protocols", "ear-training"],
      link: "https://pubmed.ncbi.nlm.nih.gov/18443283/"
    }
  ]
}
```

### Pattern: Extending the category union type

```typescript
// In the Study interface (line ~16 in current file):
category: "breath" | "peptides" | "exercise" | "nutrition" | "general" | "cognitive"

// In the ResearchSection interface (line ~27):
category: "breath" | "peptides" | "exercise" | "nutrition" | "general" | "cognitive"

// In the categories array (line ~773):
{ id: "cognitive", name: "Cognitive Science", icon: "🧠" }
```

---

## Cross-Domain Connection Map

The planner must ensure these connections appear (via `crossReferences` + inline `relevance` text):

| From Section | To Section | Connection |
|-------------|-----------|-----------|
| nback-working-memory | exercise-protocols | WORK-02 mind-muscle connection: N-Back trains attentional control which translates to neuromuscular recruitment |
| nback-working-memory | ear-training | Dual N-Back engages both auditory and visual working memory simultaneously — cross-modal training |
| ear-training | nback-working-memory | FSRS spaced repetition used in pitch recognition mirrors working memory consolidation during sleep |
| ear-training | mental-mastery | Auditory processing contributes to cognitive reserve and mental clarity |
| vision-science | mental-mastery | Perceptual learning and visual neuroplasticity share cortical plasticity mechanisms with cognitive training |
| mental-mastery | exercise-protocols | The sharp-mind→neuromuscular-control→muscle-bone-longevity chain (WORK-04) — N-Back is the cognitive anchor |
| mental-mastery | nback-working-memory | Cognitive reserve encompasses all structured training including N-Back and pitch recognition |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Absolute pitch framing (you either have it or you don't) | Adult pitch trainability well-documented (Kraus, Herholz/Zatorre) | Ear training is legitimate adult neuroplasticity practice |
| N-Back = proven IQ booster | N-Back = reliable working memory training with honest debate about far transfer | More credible, scientifically accurate framing |
| Perceptual learning only for rehabilitation | Perceptual learning effective in healthy adults for acuity and contrast sensitivity | Vision training applicable to anyone, not just those with deficits |

---

## Open Questions

1. **Spaced repetition PMID 24932672 (in existing code)**
   - What we know: PMID 24932672 exists in the current code for "A Model of How Spaced Practice Improves Learning" attributed to Lindsey RV 2014, Psychological Review
   - What's unclear: This PMID was NOT verified against PubMed in this research session
   - Recommendation: Planner should use the verified Cepeda 2008 (PMID 19076480) instead, which is a stronger foundational spacing effect study

2. **Pitch training PMID 23424073 (in existing code)**
   - What we know: PMID 23424073 is in the existing code for "Absolute Pitch May Not Be So Absolute" by Hedger SC 2013 Psychological Science
   - What's unclear: This PMID was NOT verified against PubMed in this research session
   - Recommendation: Use the verified Kraus 2010 (20648064) and Herholz 2012 (23141061) instead, which are higher-quality neuroplasticity evidence

3. **Scheiman accommodation normative data**
   - What we know: The existing Scheiman PMID 10416930 is completely wrong (spectacle/myopia study)
   - What's unclear: The real Scheiman 1988 accommodative facility normative study (PMID 3364515) was found in search but NOT individually verified
   - Recommendation: Use Allen 2010 (20304003, VERIFIED) for VISN-01 accommodation exercise coverage — it directly demonstrates training effects, which is more relevant than normative data

---

## Sources

### Primary (HIGH confidence — verified by fetching PubMed page)

| PMID | Study | Verified Against |
|------|-------|-----------------|
| 18443283 | Jaeggi 2008 N-Back fluid intelligence PNAS | PubMed page fetched, title + abstract confirmed |
| 24556432 | Deveau 2014 baseball perceptual learning | PubMed page fetched, title confirmed |
| 19520103 | Polat 2009 practical perceptual learning | PubMed page fetched, abstract confirmed |
| 19622368 | Polat 2009 amblyopia treatment | PubMed page fetched, abstract confirmed |
| 20304003 | Allen 2010 accommodation facility training | PubMed page fetched, abstract confirmed |
| 25102926 | Au 2015 N-Back meta-analysis | PubMed page fetched, title + authors confirmed |
| 27474138 | Melby-Lervåg 2016 working memory meta-analysis | PubMed page fetched, title + findings confirmed |
| 28116702 | Soveri 2017 multilevel N-Back meta-analysis | PubMed page fetched, title + findings confirmed |
| 20648064 | Kraus & Chandrasekaran 2010 music training | PubMed page fetched, abstract confirmed |
| 23141061 | Herholz & Zatorre 2012 musical brain plasticity | PubMed page fetched, abstract confirmed |
| 19076480 | Cepeda 2008 spacing effects | PubMed page fetched, abstract confirmed |
| 30481227 | Román-Caballero 2018 musical practice aging meta-analysis | PubMed page fetched, abstract confirmed |
| 23079557 | Stern 2012 cognitive reserve Lancet Neurology | PubMed page fetched, abstract confirmed |
| 17179457 | Willis 2006 ACTIVE trial JAMA | PubMed page fetched, abstract confirmed |
| 23576894 | Park & Bischof 2013 aging mind neuroplasticity | PMC article fetched, PMID confirmed |

### Secondary (MEDIUM confidence — found in WebSearch, URL confirmed, content plausible)

- Cepeda 2006 spacing effect meta-analysis (PMID 16719566) — found at PubMed URL, title confirmed via search; not individually fetched

### Known Wrong PMIDs (DO NOT USE)

| Wrong PMID | Claimed Study | Actual Study at That PMID |
|-----------|--------------|--------------------------|
| 18378733 | Jaeggi 2008 N-Back | Critical care nursing article (vasoactive medication) |
| 24508170 | Deveau 2014 baseball | Clonal raider ant genome (Cerapachys biroi) |
| 10416930 | Scheiman 1999 accommodation | Spectacle intervention on myopia in children |
| 19084554 | Polat 2009 amblyopia | Medaka fish beta-defensin immune study |

---

## Metadata

**Confidence breakdown:**
- N-Back studies: HIGH — Jaeggi, Au, Melby-Lervåg all individually fetched from PubMed
- Vision studies: HIGH — Deveau, both Polat papers, Allen all individually fetched from PubMed
- Ear training studies: HIGH — Kraus, Herholz/Zatorre, Cepeda all individually fetched from PubMed
- Mental mastery studies: HIGH — Stern, Willis, Park/Bischof all individually fetched from PubMed
- Wrong PMID identification: HIGH — confirmed by fetching all four and reading actual titles

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable science, 90-day estimate)
