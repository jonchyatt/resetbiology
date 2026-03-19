# Phase 3: Peptide Science - Research

**Researched:** 2026-03-19
**Domain:** Therapeutic peptides — PubMed citation verification for 9 peptides (BPC-157, TB-500, Semaglutide, Ipamorelin, Epithalon, GHK-Cu, DSIP, MOTS-c, 5-Amino-1MQ) plus co-op sourcing documentation
**Confidence:** HIGH (all PMIDs directly verified on PubMed; abstracts confirmed match claimed content)

---

## Summary

Phase 3 replaces eight fabricated PMIDs in the existing `peptide-science` section with ~20 real, verified PubMed studies for all 9 tracked peptides, adds co-op sourcing documentation, and wires explicit cross-references to exercise-protocols and nutrition-science sections already built in Phases 1-2.

Every PMID in this document was individually fetched from `pubmed.ncbi.nlm.nih.gov/{PMID}/` and the title, authors, journal, year, and abstract were confirmed to match. No PMIDs are inferred, guessed, or taken from training memory alone.

The research landscape for the 9 peptides varies significantly by peptide maturity: Semaglutide has multiple large RCTs; BPC-157 has extensive pre-clinical evidence with no human RCTs; Epithalon and DSIP are primarily 1980s-2000s animal/cell studies from single research groups. This variation is honest and must be reflected in the safety-profile language for each.

**Primary recommendation:** Use 2-3 verified studies per peptide. Match study selection to what the evidence actually shows — Semaglutide STEP-1 trial is the strongest evidence; Epithalon and 5-Amino-1MQ are primarily animal/preclinical. Acknowledge this honestly in keyFindings and safety profiles.

---

## Standard Stack

This phase is data-content only — no new libraries are needed. All existing code patterns from Phases 1-2 apply directly.

### Core (Existing, No Changes)
| Asset | Location | Purpose |
|-------|----------|---------|
| `app/education/page.tsx` | Project root | Target file — single edit replaces fabricated peptide section |
| `Study` TypeScript interface | Lines 7-21 | `id, title, authors, journal, year, doi?, pmid?, category, summary, keyFindings[], relevance, link?, crossReferences?[]` |
| `ResearchSection` interface | Lines 23-30 | Wraps studies array with `id, title, description, category, studies, practicalApplication` |
| `"peptides"` category | Line 15 | Already in union type — no TypeScript changes needed |

### Supporting Patterns
| Pattern | Example from Phase 1/2 | Use |
|---------|------------------------|-----|
| PubMed link format | `https://pubmed.ncbi.nlm.nih.gov/{PMID}/` | Set as `link` field on every study |
| Cross-reference via relevance text | "see Exercise Science section" | Embed in `relevance` string for PEPT-04 synergies |
| `crossReferences` array | `["exercise-protocols", "nutrition-science"]` | Used by planner for section IDs |
| Safety honest framing | WHM autophagy pattern (01-01) | Note "mostly animal data" where true |

---

## Architecture Patterns

### Project Structure (Unchanged)
```
app/
└── education/
    └── page.tsx    ← single file containing all researchData; edit in-place
```

### Pattern: Replace Peptide Section In-Place (From Phase 1/2)
**What:** Find the `id: "peptide-science"` section object in `researchData` array and replace its entire `studies: [...]` array.
**When to use:** This is the locked approach per CONTEXT.md.
**What NOT to do:** Do not change the section `id`, `title`, or `category`. Do not create new section objects. Do not move the section.

### Pattern: Study Object Structure
```typescript
// Source: app/education/page.tsx lines 7-21
{
  id: "bpc157-1",                               // peptide-name + number, kebab-case
  title: "Exact title from PubMed abstract",
  authors: "Last F, Last F, et al.",             // First listed author + et al. if >3
  journal: "Journal Name",
  year: 2021,
  pmid: "34267654",                             // VERIFIED — do NOT fabricate
  category: "peptides",
  summary: "2-3 sentence plain-English description of what the study found.",
  keyFindings: [
    "Specific quantified finding",              // 3-4 bullets per study
    "Mechanism or pathway identified",
    "Safety finding or limitation noted",
  ],
  relevance: "Why this matters for our protocols. Includes cross-reference text for PEPT-04.",
  link: "https://pubmed.ncbi.nlm.nih.gov/34267654/",
  crossReferences: ["exercise-protocols"],       // section IDs — only when synergy documented
}
```

### Pattern: Section-Level Updates for PEPT-04
Update `practicalApplication` and `description` strings on the section object to reference exercise and nutrition cross-domain connections explicitly.

### Anti-Patterns to Avoid
- **Fabricated PMIDs:** Zero tolerance. Never guess, extrapolate, or use training-memory PMIDs without PubMed verification.
- **Overstating evidence tier:** Do not describe animal-only studies as "clinical evidence." Use "preclinical evidence" or "animal studies demonstrate."
- **Missing the link field:** Every study must have `link: "https://pubmed.ncbi.nlm.nih.gov/{PMID}/"` for QUAL-01.
- **Touching other sections:** Only edit the `peptide-science` section object. Phase 1/2 content is complete and correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-reference UI | New link components | `relevance` text string | Already renders correctly in existing study cards |
| Safety warnings | Modal/popup overlays | `keyFindings` bullets with honest language | Pattern established in Phase 1 |
| Peptide categories | New category type values | Existing `"peptides"` category | Already in union type; adding new values breaks TypeScript |
| Study ordering | Alphabetical sort logic | Natural peptide grouping by theme | Planner decides order, no runtime sort needed |

**Key insight:** The education page data model already handles everything this phase needs. The entire implementation is a data replacement in a single array.

---

## Common Pitfalls

### Pitfall 1: Fabricated or Misremembered PMIDs
**What goes wrong:** Claude's training data contains peptide PMIDs that look plausible but may not exist or may point to unrelated articles.
**Why it happens:** Training data includes research summaries that cite PMIDs without full verification; memory conflates similar articles.
**How to avoid:** All PMIDs in this document were fetched directly from PubMed and individually verified. Use ONLY the PMIDs listed in the Code Examples section below.
**Warning signs:** PMID in the 37,000,000-38,000,000 range for pre-2022 studies (those were all fabricated in the original code); any PMID that returns a 404 or nursing/unrelated article.

### Pitfall 2: Overstating Evidence Tier
**What goes wrong:** BPC-157, Epithalon, DSIP, MOTS-c, and 5-Amino-1MQ have NO published human RCTs. Describing them as having "clinical" evidence misleads users.
**Why it happens:** It feels better to present stronger evidence; animal studies sometimes use clinical-sounding language.
**How to avoid:** Use tiered language:
- Semaglutide: "Phase 3 RCT (STEP-1)" — strongest evidence
- Ipamorelin: "animal models and early endocrinology research"
- BPC-157, TB-500: "extensive pre-clinical evidence; no human RCTs published"
- Epithalon, DSIP, MOTS-c, 5-Amino-1MQ, GHK-Cu: "preclinical / cell studies; human evidence limited"

### Pitfall 3: Editing src/app/ Instead of app/
**What goes wrong:** The project has both `app/` and `src/app/` directories. Next.js serves `app/` over `src/app/`.
**Why it happens:** IDE autocomplete may suggest `src/app/education/page.tsx`.
**How to avoid:** Always edit `app/education/page.tsx` (project root `app/` directory). This is documented in STATE.md blockers.
**Warning signs:** Edit appears to save but production site doesn't update.

### Pitfall 4: Duplicate PMID (MOTS-c already uses 37456789 which is also the fake Ipamorelin PMID)
**What goes wrong:** The existing code uses PMID 37456789 for BOTH ipamorelin-1 AND motsc-1 — confirming both are fabricated.
**Why it happens:** Whoever wrote the original data reused fake PMIDs.
**How to avoid:** Use exclusively the verified PMIDs from this research file.

---

## Code Examples: Verified Studies Per Peptide

All PMIDs individually verified on PubMed 2026-03-19. Each entry includes verification notes.

---

### BPC-157 (Body Protection Compound-157)
*Primary researcher: Sikiric P, University of Zagreb*
*Evidence tier: Extensive pre-clinical (animal); no published human RCTs*
*Cross-reference: exercise-protocols (Baar tendon protocol)*

**Study 1 — Tendon healing mechanism**
```typescript
{
  id: "bpc157-1",
  title: "The promoting effect of pentadecapeptide BPC 157 on tendon healing involves tendon outgrowth, cell survival, and cell migration",
  authors: "Chang CH, Tsai WC, Lin MS, Hsu YH, Pang JH",
  journal: "Journal of Applied Physiology",
  year: 2011,
  pmid: "21030672",
  category: "peptides",
  summary: "In vitro study demonstrating that BPC-157 significantly accelerates tendon fibroblast outgrowth, survival under oxidative stress, and migration through FAK-paxillin pathway activation — the core cellular mechanism behind its documented tendon repair effects.",
  keyFindings: [
    "Significantly accelerated outgrowth of rat Achilles tendon explants",
    "Improved tendon fibroblast survival under hydrogen peroxide oxidative stress",
    "Markedly increased fibroblast migration in dose-dependent manner",
    "Mechanism identified as FAK-paxillin pathway activation",
    "Study is in vitro (rat cells); human clinical trials have not been published"
  ],
  relevance: "Explains the cellular mechanism behind BPC-157 tendon repair protocols. Directly synergizes with the Baar protocol in the Exercise Science section — BPC-157 promotes fibroblast migration while gelatin + vitamin C supplies collagen precursors. See Exercise Science section for the Baar protocol.",
  link: "https://pubmed.ncbi.nlm.nih.gov/21030672/",
  crossReferences: ["exercise-protocols"]
}
```
*Verified: PMID 21030672 confirmed as Chang et al. 2011, J Appl Physiol. Achilles tendon fibroblast study.*

**Study 2 — Wound healing and tissue repair review**
```typescript
{
  id: "bpc157-2",
  title: "Stable Gastric Pentadecapeptide BPC 157 and Wound Healing",
  authors: "Seiwerth S, Milavic M, Vukojevic J, et al.",
  journal: "Frontiers in Pharmacology",
  year: 2021,
  pmid: "34267654",
  category: "peptides",
  summary: "Comprehensive review showing BPC-157 facilitates tissue repair across skin wounds, burns, diabetic ulcers, tendons, ligaments, muscles, bones, and nerves at uniform dosages through multiple administration routes, with no documented toxicity in prior clinical applications.",
  keyFindings: [
    "Promotes healing across multiple tissue types: skin, tendon, ligament, muscle, bone, nerve, cornea",
    "Works via resolving vessel constriction and normalizing coagulation cascade",
    "Effective through systemic (oral, intraperitoneal) and local (topical) administration routes",
    "No documented toxicity in prior clinical applications — all evidence remains preclinical",
    "Gene expression changes accelerate healing; VEGF upregulation promotes angiogenesis"
  ],
  relevance: "Broad tissue-repair evidence supporting BPC-157 protocols for recovery from musculoskeletal injuries. The multi-tissue evidence explains synergy with resistance training: damaged tendons and ligaments from exercise stress are primary targets.",
  link: "https://pubmed.ncbi.nlm.nih.gov/34267654/"
}
```
*Verified: PMID 34267654 confirmed as Seiwerth et al. 2021, Front Pharmacol, University of Zagreb Sikiric group.*

**Study 3 — Musculoskeletal soft tissue review (independent group)**
```typescript
{
  id: "bpc157-3",
  title: "Gastric pentadecapeptide body protection compound BPC 157 and its role in accelerating musculoskeletal soft tissue healing",
  authors: "Gwyer D, Wragg NM, Wilson SL",
  journal: "Cell and Tissue Research",
  year: 2019,
  pmid: "30915550",
  category: "peptides",
  summary: "Independent review (not Sikiric group) of BPC-157 evidence for tendon, ligament, and skeletal muscle repair, noting consistent positive findings in animal studies while acknowledging human efficacy remains unconfirmed and precise healing mechanisms require further study.",
  keyFindings: [
    "Animal studies consistently demonstrate BPC-157 accelerates soft tissue healing",
    "Effective for traumatic and systemic musculoskeletal injuries in preclinical models",
    "Few reported adverse reactions across animal studies reviewed",
    "Authors caution: human efficacy remains unconfirmed — no published human RCTs",
    "Mechanism of action not yet fully characterized"
  ],
  relevance: "Independent (non-Sikiric) confirmation of BPC-157 musculoskeletal healing evidence, providing external validation of the primary research group's findings.",
  link: "https://pubmed.ncbi.nlm.nih.gov/30915550/"
}
```
*Verified: PMID 30915550 confirmed as Gwyer et al. 2019, Cell Tissue Res. Independent UK group.*

---

### TB-500 (Thymosin Beta-4)
*Primary researchers: Goldstein AL (George Washington University), Malinda KM, Kleinman HK*
*Evidence tier: Animal and cell studies; limited human data*
*Cross-reference: exercise-protocols (tendon repair synergy with Baar protocol)*

**Study 1 — Wound healing acceleration**
```typescript
{
  id: "tb500-1",
  title: "Thymosin beta4 accelerates wound healing",
  authors: "Malinda KM, Sidhu GS, Mani H, et al.",
  journal: "Journal of Investigative Dermatology",
  year: 1999,
  pmid: "10469335",
  category: "peptides",
  summary: "Rat wound healing study showing topical or systemic thymosin beta-4 increased skin regrowth 42% at day 4 and 61% by day 7, with enhanced collagen deposition, angiogenesis, and keratinocyte migration — even at doses as low as 10 picograms.",
  keyFindings: [
    "42% increase in skin wound regrowth at day 4; 61% by day 7 vs. saline controls",
    "Enhanced collagen deposition and wound contraction in treated animals",
    "Increased angiogenesis (new blood vessel formation) at wound sites",
    "Stimulated keratinocyte migration in vitro at 10 picogram doses",
    "Animal study (rat model); human clinical trials remain limited"
  ],
  relevance: "Foundational wound healing evidence for thymosin beta-4 (TB-500). The angiogenesis and collagen deposition mechanisms directly complement the Baar tendon protocol in the Exercise Science section — new blood supply is essential for collagen fiber organization. See Exercise Science section.",
  link: "https://pubmed.ncbi.nlm.nih.gov/10469335/",
  crossReferences: ["exercise-protocols"]
}
```
*Verified: PMID 10469335 confirmed as Malinda et al. 1999, J Invest Dermatol. Goldstein/Kleinman group.*

**Study 2 — Clinical applications review**
```typescript
{
  id: "tb500-2",
  title: "Advances in the basic and clinical applications of thymosin β4",
  authors: "Goldstein AL, Kleinman HK",
  journal: "Expert Opinion on Biological Therapy",
  year: 2015,
  pmid: "26096726",
  category: "peptides",
  summary: "Review by the discoverers of thymosin beta-4's repair properties summarizing evidence for tissue regeneration applications including eye injuries, dermal wounds, myocardial infarction, stroke, kidney, liver, spinal cord, bone, and ligament damage.",
  keyFindings: [
    "Multifunctional peptide with documented repair activity across multiple organ systems",
    "Promising human applications in eye injuries, skin wounds, and cardiac ischemia repair",
    "Potential in kidney, liver, spinal cord, bone, and ligament regeneration",
    "Emerging evidence for anti-aging and antiviral properties",
    "As of 2015, human clinical evidence remains primarily from ophthalmic trials; broader human RCT data limited"
  ],
  relevance: "Comprehensive evidence base for TB-500's tissue repair role from the primary research group, supporting its use alongside BPC-157 in musculoskeletal recovery protocols.",
  link: "https://pubmed.ncbi.nlm.nih.gov/26096726/"
}
```
*Verified: PMID 26096726 confirmed as Goldstein AL, Kleinman HK 2015, Expert Opin Biol Ther.*

---

### Semaglutide (GLP-1 Receptor Agonist)
*Primary researcher: Wilding JPH; STEP trial program*
*Evidence tier: Phase 3 RCT — strongest evidence of all 9 peptides*
*Cross-reference: exercise-protocols (sarcopenia/muscle loss risk)*

**Study 1 — STEP-1 Phase 3 RCT (primary efficacy)**
```typescript
{
  id: "semaglutide-1",
  title: "Once-Weekly Semaglutide in Adults with Overweight or Obesity",
  authors: "Wilding JPH, Batterham RL, Calanna S, et al. (STEP 1 Study Group)",
  journal: "New England Journal of Medicine",
  year: 2021,
  pmid: "33567185",
  category: "peptides",
  summary: "Phase 3 RCT (STEP-1, n=1,961) demonstrating once-weekly subcutaneous semaglutide 2.4mg produced 14.9% mean body weight reduction vs. 2.4% with placebo over 68 weeks, with 86.4% of semaglutide participants achieving ≥5% weight loss.",
  keyFindings: [
    "-14.9% mean body weight with semaglutide vs. -2.4% placebo (treatment difference: -12.4 percentage points)",
    "86.4% of participants achieved ≥5% weight loss; 69.1% achieved ≥10%",
    "Superior improvements in cardiovascular risk factors, blood pressure, and HbA1c",
    "Most common side effects: nausea and diarrhea — typically transient and mild-to-moderate",
    "High-quality Phase 3 RCT published in the New England Journal of Medicine"
  ],
  relevance: "Gold-standard Phase 3 evidence for semaglutide's weight loss efficacy. Critical caveat: the 14.9% weight loss includes approximately 25-39% lean mass loss, making resistance exercise integration essential — see the sarcopenia risk evidence in the Exercise Science section.",
  link: "https://pubmed.ncbi.nlm.nih.gov/33567185/",
  crossReferences: ["exercise-protocols"]
}
```
*Verified: PMID 33567185 confirmed as Wilding et al. 2021, N Engl J Med. STEP-1 trial.*

**Study 2 — Muscle loss / sarcopenia risk with GLP-1 drugs**
```typescript
{
  id: "semaglutide-2",
  title: "Incretin-Based Weight Loss Pharmacotherapy: Can Resistance Exercise Optimize Changes in Body Composition?",
  authors: "Locatelli JC, Costa JG, Haynes A, et al.",
  journal: "Diabetes Care",
  year: 2024,
  pmid: "38687506",
  category: "peptides",
  summary: "2024 review quantifying that GLP-1 receptor agonists (semaglutide, liraglutide) and dual agonists cause rapid loss of lean mass averaging approximately 10% (~6 kg) — comparable to a decade or more of age-related muscle loss — and showing resistance exercise as the primary countermeasure.",
  keyFindings: [
    "GLP-1 drugs (semaglutide, liraglutide) cause ~10% lean mass loss (~6 kg) alongside 15-24% total weight loss",
    "Lean mass loss comparable to a decade or more of aging-related sarcopenia",
    "Supervised resistance exercise >10 weeks produces ~3 kg lean mass gain and ~25% strength increase",
    "Resistance training is identified as the primary intervention to offset medication-induced muscle loss",
    "Protein intake optimization alongside exercise is recommended to preserve muscle"
  ],
  relevance: "Critical safety evidence: semaglutide's weight loss includes substantial muscle loss, making resistance training non-optional for long-term metabolic health. This directly cross-references the sarcopenia chain in Exercise Science (resistance training → muscle preservation → bone density → longevity). See Exercise Science section.",
  link: "https://pubmed.ncbi.nlm.nih.gov/38687506/",
  crossReferences: ["exercise-protocols"]
}
```
*Verified: PMID 38687506 confirmed as Locatelli et al. 2024, Diabetes Care.*

---

### Ipamorelin (Growth Hormone Secretagogue)
*Primary researcher: Raun K, Novo Nordisk/Danish group*
*Evidence tier: Animal pharmacology; no published human RCTs for body composition*
*Cross-reference: exercise-protocols (GH for recovery)*

**Study 1 — Defining characterization (first selective GH secretagogue)**
```typescript
{
  id: "ipamorelin-1",
  title: "Ipamorelin, the first selective growth hormone secretagogue",
  authors: "Raun K, Hansen BS, Johansen NL, et al.",
  journal: "European Journal of Endocrinology",
  year: 1998,
  pmid: "9849822",
  category: "peptides",
  summary: "Original characterization study demonstrating ipamorelin is the first GHRP-receptor agonist with GH-release selectivity comparable to GHRH, without the ACTH or cortisol elevation seen with other secretagogues like GHRP-6 — establishing its favorable safety profile.",
  keyFindings: [
    "Ipamorelin releases GH at potency similar to GHRP-6 in rat pituitary cells",
    "Unlike GHRP-6, does not significantly elevate ACTH or cortisol — selective for GH axis only",
    "First documented GHRP-receptor agonist with GHRH-comparable selectivity",
    "Animal pharmacology (rat); human clinical trial data not available from this study",
    "Favorable selectivity profile makes it preferred over non-selective GH secretagogues"
  ],
  relevance: "Establishes ipamorelin's key clinical advantage: selective GH release without adrenal stress-axis stimulation, supporting its use for recovery enhancement rather than stress induction. GH release during sleep and post-exercise supports the recovery chain documented in the Exercise Science section.",
  link: "https://pubmed.ncbi.nlm.nih.gov/9849822/",
  crossReferences: ["exercise-protocols"]
}
```
*Verified: PMID 9849822 confirmed as Raun K et al. 1998, Eur J Endocrinol.*

**Study 2 — Bone and longitudinal growth effects**
```typescript
{
  id: "ipamorelin-2",
  title: "Ipamorelin, a new growth-hormone-releasing peptide, induces longitudinal bone growth in rats",
  authors: "Johansen PB, Nowak J, Skjaerbaek C, et al.",
  journal: "Growth Hormone & IGF Research",
  year: 1999,
  pmid: "10373343",
  category: "peptides",
  summary: "Dose-response study demonstrating ipamorelin induces longitudinal bone growth in female rats through GH/IGF-1 axis activation, with dose-dependent increases in growth rate and pronounced body weight effects — supporting its anabolic potential for bone and soft tissue.",
  keyFindings: [
    "Dose-dependent increases in longitudinal bone growth rate in adult female rats",
    "Elevated IGF-1 levels confirm GH-axis activation as the mechanism",
    "Pronounced body weight effects consistent with anabolic GH/IGF-1 signaling",
    "Animal study (rat); human data on bone effects not available",
    "Results support anabolic rationale for recovery and tissue-building protocols"
  ],
  relevance: "Demonstrates ipamorelin's bone and anabolic tissue effects through GH/IGF-1 axis — connecting to the bone density link in the Exercise Science section (resistance training → bone density → longevity) and supporting its role in recovery from high-intensity training.",
  link: "https://pubmed.ncbi.nlm.nih.gov/10373343/",
  crossReferences: ["exercise-protocols"]
}
```
*Verified: PMID 10373343 confirmed as Johansen PB et al. 1999, Growth Horm IGF Res.*

---

### Epithalon (Epitalon / Tetrapeptide Bioregulator)
*Primary researcher: Khavinson VKh, St. Petersburg Institute of Bioregulation and Gerontology*
*Evidence tier: Cell biology and animal studies; primarily Russian research group*
*Note: Epithalon is Ala-Glu-Asp-Gly (4 amino acids) from pineal gland*

**Study 1 — Telomerase activation (foundational)**
```typescript
{
  id: "epithalon-1",
  title: "Epithalon peptide induces telomerase activity and telomere elongation in human somatic cells",
  authors: "Khavinson VKh, Bondarev IE, Butyugov AA",
  journal: "Bulletin of Experimental Biology and Medicine",
  year: 2003,
  pmid: "12937682",
  category: "peptides",
  summary: "Cell study demonstrating that Epithalon introduced into telomerase-negative human fetal fibroblasts activated telomerase catalytic subunit and produced telomere elongation, suggesting reactivation of silenced telomerase genes in somatic cells.",
  keyFindings: [
    "Activated telomerase enzymatic activity in normally telomerase-negative human fibroblasts",
    "Produced measurable telomere elongation in treated somatic cells",
    "Mechanism: reactivation of telomerase catalytic subunit gene expression",
    "Cell study in human fetal fibroblasts — not an in vivo human study",
    "Research from a single group (Khavinson, St. Petersburg); independent replication limited"
  ],
  relevance: "Foundational cell biology evidence for Epithalon's telomere-extending mechanism — the core rationale for its anti-aging application. Note the evidence is cell-level; whole-organism longevity effects in humans have not been demonstrated in RCTs.",
  link: "https://pubmed.ncbi.nlm.nih.gov/12937682/"
}
```
*Verified: PMID 12937682 confirmed as Khavinson et al. 2003, Bull Exp Biol Med. Telomerase activation study.*

**Study 2 — Extended cellular lifespan (Hayflick limit)**
```typescript
{
  id: "epithalon-2",
  title: "Peptide promotes overcoming of the division limit in human somatic cell",
  authors: "Khavinson VKh, Bondarev IE, Butyugov AA, Smirnova TD",
  journal: "Bulletin of Experimental Biology and Medicine",
  year: 2004,
  pmid: "15455129",
  category: "peptides",
  summary: "Follow-up study showing Epithalon extended human fetal fibroblasts approximately 10 divisions beyond the normal Hayflick limit (passage 44 vs. 34 in controls), with treated cells reaching telomere lengths comparable to early passages, demonstrating functional lifespan extension at the cellular level.",
  keyFindings: [
    "Epithalon-treated cells completed ~10 additional divisions beyond normal Hayflick limit",
    "Treated cells reached passage 44 vs. passage 34 in untreated controls",
    "Telomere lengths in treated cells comparable to early-passage (younger) cell populations",
    "Demonstrates functional cellular lifespan extension, not just telomerase activation",
    "Cell study only; whole-organism anti-aging effects in humans remain undemonstrated"
  ],
  relevance: "Extends the foundational telomere research to show functional cellular lifespan effects, strengthening the mechanistic rationale for Epithalon's anti-aging protocols.",
  link: "https://pubmed.ncbi.nlm.nih.gov/15455129/"
}
```
*Verified: PMID 15455129 confirmed as Khavinson et al. 2004, Bull Exp Biol Med. Hayflick limit extension.*

**Study 3 — Retinal protection (tissue-level evidence)**
```typescript
{
  id: "epithalon-3",
  title: "Effect of epithalon on age-specific changes in the retina in rats with hereditary pigmentary dystrophy",
  authors: "Khavinson VKh, Razumovskii MI, Trofimova SV, et al.",
  journal: "Bulletin of Experimental Biology and Medicine",
  year: 2002,
  pmid: "12170316",
  category: "peptides",
  summary: "Animal study demonstrating that Epithalon administered from birth preserved retinal morphological structure, increased bioelectrical activity, and improved retinal function in rats with hereditary retinal degeneration — showing tissue-protective effects beyond cell culture models.",
  keyFindings: [
    "Protected morphological structure of retina against age-related degeneration",
    "Increased retinal bioelectrical activity vs. untreated dystrophic controls",
    "Improved retinal function in a hereditary disease model",
    "Evidence of tissue-level (in vivo) protective effects beyond cell culture",
    "Animal model (Campbell rats with hereditary dystrophy); human clinical data absent"
  ],
  relevance: "Extends Epithalon's evidence base from cell culture to tissue-level protection in vivo, supporting its role in age-related tissue health protocols. All evidence remains preclinical.",
  link: "https://pubmed.ncbi.nlm.nih.gov/12170316/"
}
```
*Verified: PMID 12170316 confirmed as Khavinson et al. 2002, Bull Exp Biol Med. Retinal protection study.*

---

### GHK-Cu (Glycyl-L-Histidyl-L-Lysine Copper Complex)
*Primary researcher: Pickart L (Skin Biology, Bellevue WA); Maquart FX*
*Evidence tier: Cell/animal and molecular biology; some cosmetic human studies*

**Study 1 — Foundational collagen synthesis (1988)**
```typescript
{
  id: "ghkcu-1",
  title: "Stimulation of collagen synthesis in fibroblast cultures by the tripeptide-copper complex glycyl-L-histidyl-L-lysine-Cu2+",
  authors: "Maquart FX, Pickart L, Laurent M, et al.",
  journal: "FEBS Letters",
  year: 1988,
  pmid: "3169264",
  category: "peptides",
  summary: "Foundational study demonstrating that the GHK-copper complex dose-dependently stimulates collagen synthesis in human fibroblast cultures, with effects beginning at 10-12 molar concentration and peaking at 10-9 M, proposing wound-site release as the natural mechanism.",
  keyFindings: [
    "Dose-dependent stimulation of collagen synthesis in human fibroblast cultures",
    "Effect begins at 10⁻¹² M (picomolar range) — active at extremely low concentrations",
    "Peak effect at 10⁻⁹ M, independent of changes in cell number",
    "Proposed mechanism: released by proteases at wound sites to stimulate local healing",
    "In vitro human fibroblast study; topical/systemic human clinical trials limited"
  ],
  relevance: "Foundational collagen synthesis evidence for GHK-Cu, explaining the molecular mechanism behind its skin repair and wound healing applications. Collagen type I and III are also primary components of tendons — connecting to the tendon repair chain in the Exercise Science section.",
  link: "https://pubmed.ncbi.nlm.nih.gov/3169264/"
}
```
*Verified: PMID 3169264 confirmed as Maquart FX, Pickart L et al. 1988, FEBS Lett.*

**Study 2 — Multiple cellular pathway review**
```typescript
{
  id: "ghkcu-2",
  title: "GHK Peptide as a Natural Modulator of Multiple Cellular Pathways in Skin Regeneration",
  authors: "Pickart L, Vasquez-Soltero JM, Margolina A",
  journal: "BioMed Research International",
  year: 2015,
  pmid: "26236730",
  category: "peptides",
  summary: "Review documenting that GHK-Cu (which declines significantly with age) accelerates wound healing, stimulates collagen, elastin, and glycosaminoglycan synthesis, modulates inflammation, and can up- or down-regulate at least 4,000 human genes relevant to tissue repair and anti-aging.",
  keyFindings: [
    "GHK levels decline significantly with aging — from ~200 ng/mL at 20 to ~80 ng/mL at 60",
    "Accelerates wound healing and skin repair when complexed with copper",
    "Stimulates synthesis of collagen, elastin, and glycosaminoglycans",
    "Modulates expression of at least 4,000 human genes",
    "Improved skin elasticity, reduced wrinkle depth in cosmetic studies; systemic human RCTs limited"
  ],
  relevance: "Comprehensive mechanistic review supporting GHK-Cu for skin health, anti-aging, and wound healing protocols. The age-related decline framing positions supplementation within the broader Reset Biology longevity framework.",
  link: "https://pubmed.ncbi.nlm.nih.gov/26236730/"
}
```
*Verified: PMID 26236730 confirmed as Pickart L et al. 2015, Biomed Res Int.*

**Study 3 — Neurological and cognitive gene expression**
```typescript
{
  id: "ghkcu-3",
  title: "The Effect of the Human Peptide GHK on Gene Expression Relevant to Nervous System Function and Cognitive Decline",
  authors: "Pickart L, Vasquez-Soltero JM, Margolina A",
  journal: "Brain Sciences",
  year: 2017,
  pmid: "28212278",
  category: "peptides",
  summary: "Connectivity Map analysis showing GHK modulates gene expression relevant to neurological health, demonstrating anti-oxidant, anti-inflammatory, anti-pain, and anti-anxiety effects alongside nerve growth promotion, with implications for neurodegenerative disease pathways including Alzheimer's and Parkinson's.",
  keyFindings: [
    "Anti-oxidant, anti-inflammatory, anti-pain, and anti-anxiety gene expression effects documented",
    "Promotes nerve growth factor expression and neuronal regeneration pathways",
    "Modulates genes dysregulated in Alzheimer's and Parkinson's disease pathways",
    "Connectivity Map analysis method — computational/bioinformatic study, not a clinical trial",
    "Suggests broader systemic effects beyond skin repair for this age-declining peptide"
  ],
  relevance: "Extends GHK-Cu evidence beyond collagen/skin to neurological health maintenance — connecting to the cognitive sharpness chain in Mental Training (sharp mind → neuromuscular control → longevity).",
  link: "https://pubmed.ncbi.nlm.nih.gov/28212278/",
  crossReferences: ["nback-working-memory"]
}
```
*Verified: PMID 28212278 confirmed as Pickart L et al. 2017, Brain Sci.*

---

### DSIP (Delta Sleep-Inducing Peptide)
*Primary researcher: Schoenenberger GA (original discovery); Iyer KS, McCann SM (mechanism)*
*Evidence tier: Older research (1980s-2000s); mechanism debated*
*Note: DSIP is a nonapeptide (9 amino acids); exact sleep-promotion mechanism remains unresolved*

**Study 1 — Original human sleep study**
```typescript
{
  id: "dsip-1",
  title: "The influence of synthetic DSIP (delta-sleep-inducing-peptide) on disturbed human sleep",
  authors: "Schneider-Helmert D, Schoenenberger GA",
  journal: "Experientia",
  year: 1981,
  pmid: "7028502",
  category: "peptides",
  summary: "Early clinical study in six chronic insomniacs showing intravenous DSIP (25 nmol/kg) produced longer sleep duration, higher sleep quality with fewer interruptions, and slightly more REM sleep with no daytime sedation, with sleep benefits primarily in the second hour post-injection.",
  keyFindings: [
    "Longer sleep duration and improved sleep quality in chronic insomniacs",
    "Fewer sleep interruptions with slightly more REM sleep",
    "No daytime sedation — normalizing rather than sedating effect",
    "Small study (n=6); intravenous administration only; not replicated in large RCTs",
    "Results suggest DSIP has a physiological sleep-normalizing rather than hypnotic mechanism"
  ],
  relevance: "Original human evidence for DSIP's sleep-normalizing effects. The GH release connection documented in preclinical research connects to ipamorelin and recovery-sleep protocols — adequate slow-wave sleep is the primary window for growth hormone secretion.",
  link: "https://pubmed.ncbi.nlm.nih.gov/7028502/"
}
```
*Verified: PMID 7028502 confirmed as Schneider-Helmert D, Schoenenberger GA 1981, Experientia.*

**Study 2 — Slow-wave sleep and GH release mechanism**
```typescript
{
  id: "dsip-2",
  title: "Evidence for a role of delta sleep-inducing peptide in slow-wave sleep and sleep-related growth hormone release in the rat",
  authors: "Iyer KS, Marks GA, Kastin AJ, McCann SM",
  journal: "Proceedings of the National Academy of Sciences USA",
  year: 1988,
  pmid: "3368469",
  category: "peptides",
  summary: "Mechanistic animal study showing that when DSIP antiserum was injected into rat brains during sleep deprivation, the normal compensatory increase in both slow-wave sleep and growth hormone secretion was blocked — providing causal evidence that endogenous DSIP is necessary for sleep-related GH release.",
  keyFindings: [
    "DSIP antiserum blocked sleep-deprivation-induced increase in slow-wave sleep",
    "Same antiserum blocked compensatory growth hormone secretion during recovery sleep",
    "Demonstrates endogenous DSIP is necessary (not just sufficient) for sleep-related GH release",
    "Animal study (rat, intraventricular injection); human mechanism extrapolated, not confirmed",
    "Establishes DSIP as part of the GH secretion regulatory circuit during sleep"
  ],
  relevance: "Links DSIP's sleep effects directly to growth hormone regulation — the primary recovery hormone released during slow-wave sleep. DSIP and ipamorelin operate complementary channels: DSIP promotes the sleep stage; ipamorelin amplifies the GH pulse. See Exercise Science section for GH recovery chain.",
  link: "https://pubmed.ncbi.nlm.nih.gov/3368469/",
  crossReferences: ["exercise-protocols"]
}
```
*Verified: PMID 3368469 confirmed as Iyer KS, Marks GA, Kastin AJ, McCann SM 1988, Proc Natl Acad Sci.*

---

### MOTS-c (Mitochondrial Open Reading Frame of the 12S rRNA Type-c)
*Primary researcher: Lee C, USC Leonard Davis School of Gerontology*
*Evidence tier: Animal studies and cell biology; emerging human genetic association data*
*Cross-reference: nutrition-science (mitochondrial biogenesis, BMR)*

**Study 1 — Discovery paper (Cell Metabolism 2015)**
```typescript
{
  id: "motsc-1",
  title: "The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces obesity and insulin resistance",
  authors: "Lee C, Zeng J, Drew BG, et al.",
  journal: "Cell Metabolism",
  year: 2015,
  pmid: "25738459",
  category: "peptides",
  summary: "Discovery study identifying MOTS-c as a 16-amino-acid peptide encoded within mitochondrial DNA that targets skeletal muscle to enhance insulin responsiveness via AMPK activation, preventing age-related and diet-induced insulin resistance and obesity in mouse models.",
  keyFindings: [
    "MOTS-c is a mitochondrial-derived peptide (MDP) encoded within the 12S rRNA gene",
    "Targets skeletal muscle to enhance insulin sensitivity via AMPK pathway activation",
    "Inhibits folate cycle and purine biosynthesis, triggering AICAR-mediated AMPK activation",
    "Prevented both age-related and high-fat-diet-induced insulin resistance in mice",
    "Mouse model study; human clinical trials are ongoing but not yet published"
  ],
  relevance: "Foundational discovery establishing MOTS-c as a mitochondria-to-muscle signaling peptide — directly connecting to the metabolic optimization framework in Nutrition Science (AMPK activation, mitochondrial biogenesis, raising BMR). See Nutrition Science section.",
  link: "https://pubmed.ncbi.nlm.nih.gov/25738459/",
  crossReferences: ["nutrition-science"]
}
```
*Verified: PMID 25738459 confirmed as Lee C et al. 2015, Cell Metab. Original MOTS-c discovery.*

**Study 2 — Muscle and fat metabolism mechanisms**
```typescript
{
  id: "motsc-2",
  title: "MOTS-c: A novel mitochondrial-derived peptide regulating muscle and fat metabolism",
  authors: "Lee C, Kim KH, Cohen P",
  journal: "Free Radical Biology and Medicine",
  year: 2016,
  pmid: "27216708",
  category: "peptides",
  summary: "Follow-up mechanistic review showing MOTS-c targets skeletal muscle to enhance glucose metabolism, with implications for obesity, type 2 diabetes, exercise physiology, and longevity through mitochondrial signaling to the nuclear genome.",
  keyFindings: [
    "Targets skeletal muscle specifically to enhance glucose metabolism",
    "Part of a broader class of mitochondria-derived peptides with systemic metabolic signaling roles",
    "Connects mitochondrial function to nuclear genome signaling (mitonuclear communication)",
    "Relevance to exercise physiology, obesity, diabetes, and longevity pathways",
    "Review; primary evidence remains animal model data with emerging human genetic associations"
  ],
  relevance: "Establishes MOTS-c's role in the mitochondria → muscle → metabolism chain, supporting its use as a metabolic optimization peptide. Directly cross-references the 'raising BMR builds mitochondria' research thread in Nutrition Science.",
  link: "https://pubmed.ncbi.nlm.nih.gov/27216708/",
  crossReferences: ["nutrition-science"]
}
```
*Verified: PMID 27216708 confirmed as Lee C, Kim KH, Cohen P 2016, Free Radic Biol Med.*

---

### 5-Amino-1MQ (5-Amino-1-Methylquinolinium / NNMT Inhibitor)
*Primary researcher: Neelakantan H, Watowich SJ (University of Texas Medical Branch)*
*Evidence tier: Animal studies; no human clinical trials published*
*Cross-reference: nutrition-science (NAD+ metabolism, BMR raising)*

**Study 1 — Primary anti-obesity study**
```typescript
{
  id: "5amino1mq-1",
  title: "Selective and membrane-permeable small molecule inhibitors of nicotinamide N-methyltransferase reverse high fat diet-induced obesity in mice",
  authors: "Neelakantan H, Vance V, Wetzel MD, et al.",
  journal: "Biochemical Pharmacology",
  year: 2018,
  pmid: "29155147",
  category: "peptides",
  summary: "Preclinical study demonstrating that 5-amino-1MQ and related NNMT inhibitors reduced body weight and white adipose mass in diet-induced obese mice by elevating intracellular NAD+ and SAM, suppressing lipogenesis — with no impact on food consumption.",
  keyFindings: [
    "Significantly reduced body weight and white adipose tissue mass in obese mice",
    "Decreased adipocyte size and lowered plasma total cholesterol",
    "Mechanism: elevated intracellular NAD+ and SAM, suppressing adipocyte lipogenesis",
    "Weight loss occurred without reduction in food intake — metabolic rather than appetite mechanism",
    "Preclinical mouse model; no human clinical trials for this compound are published"
  ],
  relevance: "Primary anti-obesity evidence for NNMT inhibition via 5-amino-1MQ. The NAD+ elevation mechanism connects directly to the 'raising BMR through metabolic activation' research in Nutrition Science — this is not caloric restriction but metabolic rate enhancement. See Nutrition Science section.",
  link: "https://pubmed.ncbi.nlm.nih.gov/29155147/",
  crossReferences: ["nutrition-science"]
}
```
*Verified: PMID 29155147 confirmed as Neelakantan H et al. 2018, Biochem Pharmacol.*

**Study 2 — Muscle regeneration in aged tissue**
```typescript
{
  id: "5amino1mq-2",
  title: "Small molecule nicotinamide N-methyltransferase inhibitor activates senescent muscle stem cells and improves regenerative capacity of aged skeletal muscle",
  authors: "Neelakantan H, Brightwell CR, Graber TG, et al.",
  journal: "Biochemical Pharmacology",
  year: 2019,
  pmid: "30753815",
  category: "peptides",
  summary: "Animal study showing NNMT inhibition in 24-month-old (aged) mice activated dormant muscle stem cells post-injury, increasing cross-sectional area nearly 2-fold vs. controls and improving peak torque ~70%, via SIRT1 activity restoration through NAD+ preservation.",
  keyFindings: [
    "Activated senescent muscle stem cells in 24-month-old (aged) mice post-injury",
    "~2-fold greater muscle fiber cross-sectional area vs. untreated aged controls",
    "~70% improvement in peak torque (muscle strength) post-injury",
    "Mechanism: preserved NAD+ salvage pathway, restoring SIRT1 sirtuin activity",
    "Aged mouse model; relevant to sarcopenia prevention — human trials not published"
  ],
  relevance: "Extends 5-amino-1MQ evidence from fat loss to muscle preservation and regeneration — directly relevant to the sarcopenia prevention goal and the longevity chain (muscle → bone → long life). Connects to the semaglutide muscle loss concern and the resistance training evidence in Exercise Science.",
  link: "https://pubmed.ncbi.nlm.nih.gov/30753815/",
  crossReferences: ["exercise-protocols", "nutrition-science"]
}
```
*Verified: PMID 30753815 confirmed as Neelakantan H et al. 2019, Biochem Pharmacol. Aged muscle study.*

---

### Co-op Sourcing Documentation (COOP-01, COOP-02)

**Study — Peptide impurity and false biological activity**
```typescript
{
  id: "coop-purity-1",
  title: "The influence of peptide impurity profiles on functional tissue-organ bath response: the 11-mer peptide INSL6[151-161] case",
  authors: "Verbeken M, Wynendaele E, Lefebvre RA, et al.",
  journal: "Analytical Biochemistry",
  year: 2012,
  pmid: "22033292",
  category: "peptides",
  summary: "Analytical chemistry study demonstrating that crude peptide (~70% purity) produced strong contractile responses in biological tissue, while highly purified peptide (≥95%) showed no effect — proving synthesis by-products create false positive biological results and that peptide quality control is essential for valid outcomes.",
  keyFindings: [
    "Crude peptide (~70% purity) produced false-positive biological contractile responses",
    "Highly purified peptide (≥95%) showed no biological effect — impurities were the active component",
    "Synthesis by-products from peptide manufacturing can masquerade as therapeutic activity",
    "Authors conclude: 'peptide quality is generally neglected, possibly leading to misinterpretation'",
    "Third-party purity verification (≥95% HPLC) is necessary for reliable outcomes"
  ],
  relevance: "Scientific rationale for third-party COA (Certificate of Analysis) testing in the Reset Biology co-op. Peptides from unverified sources may contain synthesis by-products that produce misleading results, mask therapeutic failures, or introduce unknown safety risks. Our direct sourcing with third-party HPLC verification ensures you receive what the study evidence was actually tested on.",
  link: "https://pubmed.ncbi.nlm.nih.gov/22033292/"
}
```
*Verified: PMID 22033292 confirmed as Verbeken M et al. 2012, Anal Biochem.*

**Study — Compounding pharmacy quality risks**
```typescript
{
  id: "coop-quality-1",
  title: "Potential risks of pharmacy compounding",
  authors: "Gudeman J, Jozwiakowski M, Chollet J, Randell M",
  journal: "Drugs in R&D",
  year: 2013,
  pmid: "23526368",
  category: "peptides",
  summary: "Regulatory analysis showing that independent testing by FDA and state agencies consistently finds compounded drugs fail quality specifications at significantly higher rates than FDA-approved drugs, with documented contamination outbreaks and lack of Good Manufacturing Practice (GMP) requirements.",
  keyFindings: [
    "FDA and state agency testing finds compounded drugs fail specifications at higher rates than FDA-approved drugs",
    "Three documented meningitis outbreaks traced to contaminated compounded sterile injections",
    "Compounded drugs exempt from Good Manufacturing Practice (GMP) requirements",
    "Quality testing to assess product quality is inconsistent across compounding pharmacies",
    "Direct sourcing with GMP-compliant manufacturing and third-party COA provides the verification layer absent from standard compounding"
  ],
  relevance: "Establishes the quality-control gap that the Reset Biology co-op model addresses. By sourcing directly with mandatory third-party COA testing (HPLC purity ≥95%, mass spectrometry identity confirmation), members receive the verification layer that standard compounding cannot guarantee.",
  link: "https://pubmed.ncbi.nlm.nih.gov/23526368/"
}
```
*Verified: PMID 23526368 confirmed as Gudeman J et al. 2013, Drugs R D.*

---

## Section-Level Updates Required

### Description Update
Current description is vague and mentions only "metabolic optimization, fat loss, and muscle preservation." The planner should update it to reflect the full 9-peptide scope:

```
"Clinical and preclinical research on nine therapeutic peptides spanning tissue repair (BPC-157, TB-500), metabolic optimization (Semaglutide, 5-Amino-1MQ, MOTS-c), recovery enhancement (Ipamorelin, DSIP), longevity (Epithalon, GHK-Cu), and co-op sourcing quality standards."
```

### Practical Application Update
Current text is generic. Update to include cross-domain connections and portal links per PEPT-04 and COOP requirements:

```
"Each peptide protocol in our /peptides portal is grounded in the research above. Note that BPC-157 and TB-500 work synergistically with the Baar tendon protocol in Exercise Science — peptides supply healing signals while gelatin + vitamin C supplies structural materials. Semaglutide users must review the sarcopenia risk evidence and pair with resistance training. MOTS-c and 5-Amino-1MQ connect to the mitochondrial biogenesis research in Nutrition Science. Co-op membership (available at /order) includes third-party COA testing — the research above explains why purity verification is non-negotiable."
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 8 fabricated PMIDs for 8 peptides | 20 verified real PMIDs for 9 peptides | PEPT-03 satisfied; zero fabrications |
| Only generic metabolic claims | Evidence-tiered descriptions (RCT vs. animal) | Honest framing, user trust |
| No cross-references | Explicit exercise/nutrition synergies | PEPT-04 satisfied |
| Single study per peptide | 2-3 studies per peptide | PEPT-01 satisfied (2-4 range) |
| No co-op citations | 2 peer-reviewed quality/sourcing papers | COOP-01, COOP-02 satisfied |

**Deprecated/outdated in the original code:**
- PMID 37456789 (used TWICE — ipamorelin and MOTS-c): Does not correspond to these studies
- PMID 35789234: Not a Sikiric BPC-157 study in Current Pharmaceutical Design
- PMID 37891234: Not a TB-500 study in Journal of Peptide Science
- PMID 38123456: Not a Khavinson Epithalon study in Biogerontology
- PMID 36789456: Not an DSIP study in Sleep Medicine Reviews
- PMID 35678912: Not a Pickart GHK-Cu study in IJMS
- PMID 38567890: Not a Neelakantan 5-Amino-1MQ study in Science Translational Medicine

---

## Open Questions

1. **Semaglutide DOI for STEP-1**
   - What we know: PMID 33567185 is the correct NEJM paper; the DOI is `10.1056/NEJMoa2032183`
   - What's unclear: Whether adding the DOI field improves user experience vs. just the PMID link
   - Recommendation: Include both `pmid` and `doi` fields for STEP-1 to match the existing pattern in Phase 1 studies; omit DOI for studies where it's not readily available

2. **TB-500 vs. Thymosin Beta-4: Terminology**
   - What we know: "TB-500" is a commercial name for a fragment of thymosin beta-4; the published research is on the full thymosin beta-4 molecule
   - What's unclear: Whether the fragment has identical pharmacology to the full peptide
   - Recommendation: Label studies as "Thymosin Beta-4 (TB-500 parent molecule)" in summaries and note this distinction in keyFindings for transparency

3. **Epithalon independent replication**
   - What we know: All identified Epithalon studies are from the Khavinson group at St. Petersburg; no independent replication found on PubMed
   - What's unclear: Whether independent replication exists in non-English literature
   - Recommendation: Note "research from a single group; independent replication limited" in keyFindings — consistent with the honest-framing approach from Phase 1 (WHM autophagy pattern)

4. **COOP section placement**
   - What we know: CONTEXT.md specifies "co-op documentation added as studies within the peptide-science section"
   - What's unclear: Whether co-op studies should be at the end of the studies array (after all 9 peptides) or interleaved
   - Recommendation: Place co-op studies at the end of the studies array with ids `coop-purity-1` and `coop-quality-1`

---

## Sources

### Primary (HIGH confidence — directly verified on PubMed)

| PMID | Peptide | Verification |
|------|---------|-------------|
| 21030672 | BPC-157 | Chang et al. 2011, J Appl Physiol — tendon fibroblast outgrowth |
| 34267654 | BPC-157 | Seiwerth/Sikiric et al. 2021, Front Pharmacol — wound healing review |
| 30915550 | BPC-157 | Gwyer et al. 2019, Cell Tissue Res — musculoskeletal soft tissue |
| 10469335 | TB-500 | Malinda et al. 1999, J Invest Dermatol — wound healing 42%/61% |
| 26096726 | TB-500 | Goldstein, Kleinman 2015, Expert Opin Biol Ther — clinical review |
| 33567185 | Semaglutide | Wilding et al. 2021, N Engl J Med — STEP-1 RCT |
| 38687506 | Semaglutide | Locatelli et al. 2024, Diabetes Care — muscle loss sarcopenia |
| 9849822 | Ipamorelin | Raun K et al. 1998, Eur J Endocrinol — first selective GH secretagogue |
| 10373343 | Ipamorelin | Johansen PB et al. 1999, Growth Horm IGF Res — bone growth |
| 12937682 | Epithalon | Khavinson et al. 2003, Bull Exp Biol Med — telomerase activation |
| 15455129 | Epithalon | Khavinson et al. 2004, Bull Exp Biol Med — Hayflick limit extension |
| 12170316 | Epithalon | Khavinson et al. 2002, Bull Exp Biol Med — retinal protection |
| 3169264 | GHK-Cu | Maquart, Pickart et al. 1988, FEBS Lett — collagen synthesis |
| 26236730 | GHK-Cu | Pickart L et al. 2015, Biomed Res Int — multiple pathways review |
| 28212278 | GHK-Cu | Pickart L et al. 2017, Brain Sci — nervous system gene expression |
| 7028502 | DSIP | Schneider-Helmert, Schoenenberger 1981, Experientia — human sleep study |
| 3368469 | DSIP | Iyer KS, McCann SM et al. 1988, PNAS — slow-wave sleep and GH |
| 25738459 | MOTS-c | Lee C et al. 2015, Cell Metab — discovery paper |
| 27216708 | MOTS-c | Lee C, Kim KH, Cohen P 2016, Free Radic Biol Med — muscle/fat |
| 29155147 | 5-Amino-1MQ | Neelakantan H et al. 2018, Biochem Pharmacol — anti-obesity |
| 30753815 | 5-Amino-1MQ | Neelakantan H et al. 2019, Biochem Pharmacol — muscle stem cells |
| 22033292 | Co-op COOP-01 | Verbeken M et al. 2012, Anal Biochem — impurity false positives |
| 23526368 | Co-op COOP-02 | Gudeman J et al. 2013, Drugs R D — compounding risks |

### Tertiary (LOW confidence — not used, noted for context)
- Epithalon study PMID 12809170 (Djeridane/Khavinson 2003): Found NO melatonin effect — not suitable for positive claims
- DSIP PMID 16539679 (Kovalzon/Strekalova 2006): Explicitly states DSIP sleep evidence is "unresolved" — use this framing in keyFindings, but not as a supportive evidence source

---

## Metadata

**Confidence breakdown:**
- BPC-157 studies: HIGH — 3 verified PMIDs from Sikiric group + independent group
- TB-500 studies: HIGH — 2 verified PMIDs from Goldstein/Kleinman group (original discoverers)
- Semaglutide studies: HIGH — Phase 3 RCT in NEJM + 2024 Diabetes Care review
- Ipamorelin studies: HIGH — Raun 1998 is the defining pharmacology paper; verified directly
- Epithalon studies: HIGH (as citations); MEDIUM (as evidence) — single group, no independent replication
- GHK-Cu studies: HIGH — 3 PMIDs across 1988, 2015, 2017; Pickart is the primary researcher
- DSIP studies: HIGH (as citations) — 1981 and 1988 papers verified; evidence tier honestly LOW
- MOTS-c studies: HIGH — Lee 2015 Cell Metabolism is the defining paper; 2016 review confirmed
- 5-Amino-1MQ studies: HIGH — Both Neelakantan 2018 and 2019 papers verified directly
- Co-op documentation: HIGH — Both quality/contamination papers verified

**Research date:** 2026-03-19
**Valid until:** 2027-03-19 (stable citations — PubMed IDs are permanent; evidence tiers stable)

**Total verified PMIDs:** 23 (21 peptide studies + 2 co-op studies)
**Studies per peptide:** BPC-157 (3), TB-500 (2), Semaglutide (2), Ipamorelin (2), Epithalon (3), GHK-Cu (3), DSIP (2), MOTS-c (2), 5-Amino-1MQ (2), Co-op (2)
**Fabricated PMIDs to replace:** 8 (7 unique PMIDs — 37456789 used twice)
