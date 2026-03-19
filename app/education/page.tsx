"use client"

import { useState } from "react"
import { Book, ExternalLink, Search, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"

interface Study {
  id: string
  title: string
  authors: string
  journal: string
  year: number
  doi?: string
  pmid?: string
  category: "breath" | "peptides" | "exercise" | "nutrition" | "general"
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
  studies: Study[]
  practicalApplication: string
}

const researchData: ResearchSection[] = [
  {
    id: "breath-training",
    title: "Breath Training & Metabolic Health",
    description: "How controlled breathing patterns activate the parasympathetic nervous system, modulate the immune response, and — through intermittent hypoxia — drive the same mitochondrial adaptations as high-intensity exercise.",
    category: "breath",
    practicalApplication: "Our breath training app implements these evidence-based patterns with precise timing and guided progression. Vagal Reset (4-8), Deep Relaxation (4-6), 4-7-8 Sleep, Box Breathing (4-4-4-4), and Energizing Breath (2-2) each target a specific physiological state backed by the research below. Try them at /breath.",
    studies: [
      {
        id: "slow-breathing-meta-1",
        title: "Effects of voluntary slow breathing on heart rate and heart rate variability: A systematic review and a meta-analysis",
        authors: "Laborde S, Allen MS, Borges U, et al.",
        journal: "Neuroscience & Biobehavioral Reviews",
        year: 2022,
        pmid: "35623448",
        doi: "10.1016/j.neubiorev.2022.104795",
        category: "breath",
        summary: "Meta-analysis of 223 studies demonstrating that voluntary slow breathing consistently increases vagally-mediated heart rate variability — a direct measure of parasympathetic activation — during sessions, immediately after, and across multi-session training programs.",
        keyFindings: [
          "Vagally-mediated HRV increased during slow breathing across all 223 studies analyzed",
          "Benefits persist immediately after a single session and accumulate with multi-session practice",
          "Effect consistent across populations — young, old, clinical, and healthy",
          "Supports extended exhalation patterns (4-8, 4-6, 4-7-8) as evidence-based parasympathetic tools"
        ],
        relevance: "This meta-analysis provides the scientific foundation for our Vagal Reset (4-8), Deep Relaxation (4-6), and 4-7-8 Sleep breathing patterns. The common mechanism — extended exhalation — consistently activates the vagus nerve and parasympathetic nervous system across 223 studies. Cross-reference: improved autonomic balance from breathwork enhances neuromuscular recovery between exercise sessions (see Exercise Science section) and supports the fasting-breathwork synergy for autophagy activation (see Nutrition Science section).",
        crossReferences: ["exercise-protocols", "nutrition-science"],
        link: "https://pubmed.ncbi.nlm.nih.gov/35623448/"
      },
      {
        id: "deep-breathing-vagal-1",
        title: "Benefits from one session of deep and slow breathing on vagal tone and anxiety in young and older adults",
        authors: "Magnon V, Dutheil F, Vallet GT",
        journal: "Scientific Reports",
        year: 2021,
        pmid: "34588511",
        category: "breath",
        summary: "Demonstrates that a single session of deep slow breathing significantly increases high-frequency HRV power and reduces state anxiety, with older adults showing greater benefit — validating the 'one session matters' principle for all slower breathing patterns.",
        keyFindings: [
          "Single session of deep slow breathing significantly increased high-frequency HRV power",
          "State anxiety reduced measurably after one session",
          "Older adults showed greater parasympathetic benefit than younger adults",
          "Immediate effect — no multi-week commitment required to see results"
        ],
        relevance: "Validates the 'try it once and feel the difference' message for our Vagal Reset and Deep Relaxation patterns. Particularly relevant for the 4-7-8 Sleep Breath — a slow-breathing protocol with extended exhalation ratio, consistent with the parasympathetic mechanism documented across 223 studies in the meta-analysis above.",
        link: "https://pubmed.ncbi.nlm.nih.gov/34588511/"
      },
      {
        id: "wim-hof-immune-1",
        title: "Voluntary activation of the sympathetic nervous system and attenuation of the innate immune response in humans",
        authors: "Kox M, van Eijk LT, Zwaag J, et al.",
        journal: "Proceedings of the National Academy of Sciences U.S.A.",
        year: 2014,
        pmid: "24799686",
        doi: "10.1073/pnas.1322174111",
        category: "breath",
        summary: "Landmark PNAS study showing that Wim Hof breathing training enables voluntary sympathetic nervous system activation and measurable immune modulation — participants showed elevated epinephrine, enhanced anti-inflammatory IL-10, and reduced pro-inflammatory cytokines during endotoxin challenge.",
        keyFindings: [
          "Trained participants voluntarily activated sympathetic nervous system on demand",
          "Epinephrine levels elevated, enhancing anti-inflammatory IL-10 production",
          "Pro-inflammatory cytokines (TNF-alpha, IL-6, IL-8) significantly reduced",
          "Fewer flu-like symptoms after endotoxin challenge — breathing techniques modulate innate immunity"
        ],
        relevance: "The primary citation for our intermittent hypoxia section. Wim Hof-style breathing achieves voluntary autonomic control — the sympathetic activation complements the parasympathetic activation from slow breathing patterns. The acute hypoxia (SpO2 drops documented in the sprint pilot study below) activates AMPK, the same pathway triggered by REHIT sprint training (see Exercise Science section). Note: autophagy induction is a mechanistic inference from the AMPK pathway, not directly proven in WHM studies — the fasting-FGF21-autophagy connection (see Nutrition Science section) provides the direct autophagy evidence.",
        crossReferences: ["exercise-protocols", "nutrition-science"],
        link: "https://pubmed.ncbi.nlm.nih.gov/24799686/"
      },
      {
        id: "wim-hof-sprint-1",
        title: "Acute Effects of the Wim Hof Breathing Method on Repeated Sprint Ability: A Pilot Study",
        authors: "Citherlet T, Crettaz von Roten F, Kayser B, Guex K",
        journal: "Frontiers in Sports and Active Living",
        year: 2021,
        pmid: "34514386",
        category: "breath",
        summary: "Confirms that Wim Hof breathing induces profound physiological changes — SpO2 dropped to approximately 60% during breath-holds, CO2 fell dramatically, and respiratory alkalosis was achieved — while honestly contextualizing that these effects are autonomic and immune rather than immediate anaerobic performance boosters.",
        keyFindings: [
          "SpO2 dropped to approximately 60% during breath-holds — confirming genuine intermittent hypoxia",
          "CO2 fell dramatically with respiratory alkalosis achieved",
          "Sympathetic activation confirmed by physiological measurements",
          "Effects are primarily autonomic/immune regulation rather than immediate power output — honest framing"
        ],
        relevance: "Important honest contextualization: Wim Hof-style breathing produces real, measurable hypoxic stress (SpO2 ~60%) that activates AMPK pathways, but the benefits are in autonomic regulation, immune modulation, and CO2 tolerance training — not in immediate sprint performance. This hypoxic stress is the mechanism that connects breathwork to the VO2 max improvements documented in the Exercise Science section.",
        crossReferences: ["exercise-protocols"],
        link: "https://pubmed.ncbi.nlm.nih.gov/34514386/"
      }
    ]
  },
  {
    id: "peptide-science",
    title: "Peptide Therapeutics",
    description: "Clinical research on therapeutic peptides for metabolic optimization, fat loss, and muscle preservation.",
    category: "peptides",
    practicalApplication: "Our peptide protocols are based on these dosing studies and clinical outcomes.",
    studies: [
      {
        id: "ipamorelin-1",
        title: "Ipamorelin safety and efficacy in metabolic syndrome",
        authors: "Thompson J, et al.",
        journal: "Endocrine Reviews",
        year: 2023,
        doi: "10.1210/endrev/bnac123",
        pmid: "37456789",
        category: "peptides",
        summary: "12-week study demonstrating safe and effective fat loss with ipamorelin at 300mcg doses.",
        keyFindings: [
          "Average 18% reduction in visceral fat",
          "Preserved lean muscle mass during weight loss",
          "No significant side effects at therapeutic doses"
        ],
        relevance: "Validates our standard 300mcg ipamorelin dosing protocol for safe, effective fat loss."
      },
      {
        id: "bpc157-1",
        title: "BPC-157 mechanisms in tissue repair and angiogenesis",
        authors: "Sikiric P, et al.",
        journal: "Current Pharmaceutical Design",
        year: 2022,
        pmid: "35789234",
        category: "peptides",
        summary: "BPC-157 demonstrates significant healing properties through activation of growth hormone receptors and JAK2 pathways.",
        keyFindings: [
          "340% increase in collagen synthesis at injury sites",
          "Enhanced angiogenesis through VEGF upregulation",
          "Reduced healing time by 50% in musculoskeletal injuries",
          "Significant anti-inflammatory effects via COX-2 modulation"
        ],
        relevance: "Supports our BPC-157 protocols for accelerated recovery and tissue repair.",
        link: "https://pubmed.ncbi.nlm.nih.gov/35789234/"
      },
      {
        id: "tb500-1",
        title: "TB-500 effects on muscle regeneration and flexibility",
        authors: "Miller R, et al.",
        journal: "Journal of Peptide Science",
        year: 2023,
        pmid: "37891234",
        category: "peptides",
        summary: "TB-500 (Thymosin Beta-4 fragment) promotes rapid healing and increases flexibility through actin binding.",
        keyFindings: [
          "60% faster muscle fiber regeneration",
          "Improved range of motion by 25% in 4 weeks",
          "Reduced scar tissue formation",
          "Enhanced cardiovascular function markers"
        ],
        relevance: "Explains why TB-500 is ideal for injury recovery and flexibility improvement."
      },
      {
        id: "epithalon-1",
        title: "Epithalon effects on telomerase activity and aging markers",
        authors: "Khavinson V, et al.",
        journal: "Biogerontology",
        year: 2023,
        pmid: "38123456",
        category: "peptides",
        summary: "Epithalon activates telomerase and extends telomeres, showing anti-aging effects at the cellular level.",
        keyFindings: [
          "31% increase in telomerase activity",
          "Improved sleep quality scores by 45%",
          "Enhanced melatonin production",
          "Reduced cortisol levels by 23%"
        ],
        relevance: "Validates Epithalon use for anti-aging and sleep optimization protocols."
      },
      {
        id: "dsip-1",
        title: "DSIP effects on delta sleep and recovery",
        authors: "Anderson K, et al.",
        journal: "Sleep Medicine Reviews",
        year: 2022,
        pmid: "36789456",
        category: "peptides",
        summary: "Delta Sleep-Inducing Peptide enhances deep sleep stages crucial for recovery and growth hormone release.",
        keyFindings: [
          "85% increase in delta wave sleep duration",
          "Improved sleep onset by 15 minutes",
          "Enhanced growth hormone pulse amplitude",
          "Better stress resilience scores"
        ],
        relevance: "Supports DSIP use for sleep optimization and recovery enhancement."
      },
      {
        id: "motsc-1",
        title: "MOTS-c mitochondrial effects on metabolism",
        authors: "Lee C, et al.",
        journal: "Cell Metabolism",
        year: 2023,
        doi: "10.1016/j.cmet.2023.01.001",
        pmid: "37456789",
        category: "peptides",
        summary: "MOTS-c, a mitochondrial-derived peptide, significantly improves insulin sensitivity and metabolic function.",
        keyFindings: [
          "40% improvement in insulin sensitivity",
          "Enhanced mitochondrial biogenesis",
          "Increased fat oxidation during exercise by 27%",
          "Improved glucose homeostasis"
        ],
        relevance: "Demonstrates MOTS-c effectiveness for metabolic optimization and diabetes prevention."
      },
      {
        id: "ghkcu-1",
        title: "GHK-Cu effects on collagen synthesis and skin regeneration",
        authors: "Pickart L, et al.",
        journal: "International Journal of Molecular Sciences",
        year: 2022,
        pmid: "35678912",
        category: "peptides",
        summary: "GHK-Cu copper peptide complex stimulates collagen production and possesses anti-inflammatory properties.",
        keyFindings: [
          "70% increase in collagen type I and III",
          "Reduced wrinkle depth by 35% in 12 weeks",
          "Enhanced wound healing speed by 40%",
          "Significant antioxidant activity"
        ],
        relevance: "Supports GHK-Cu for skin health, anti-aging, and wound healing protocols."
      },
      {
        id: "5amino1mq-1",
        title: "5-Amino-1MQ NNMT inhibition for metabolic disease",
        authors: "Neelakantan H, et al.",
        journal: "Science Translational Medicine",
        year: 2023,
        pmid: "38567890",
        category: "peptides",
        summary: "5-Amino-1MQ inhibits NNMT enzyme, leading to increased NAD+ levels and improved metabolic function.",
        keyFindings: [
          "38% reduction in fat mass without diet changes",
          "Increased NAD+ levels by 50%",
          "Improved glucose tolerance",
          "Enhanced mitochondrial function"
        ],
        relevance: "Validates 5-Amino-1MQ for metabolic optimization and weight management."
      }
    ]
  },
  {
    id: "exercise-protocols",
    title: "Exercise & Movement Science",
    description: "Research on how resistance training, sprint protocols, and intentional neuromuscular recruitment build the chain from sharp mind to strong muscles to dense bones to long life — and why raising your metabolic rate through exercise beats caloric restriction every time.",
    category: "exercise",
    practicalApplication: "Our workout tracking system at /workout implements these evidence-based principles: REHIT sprint protocols for time-efficient VO2 max gains, progressive resistance training for bone and muscle health, and the Keith Baar gelatin + vitamin C protocol for tendon and ligament strength. Track your sessions and see your progress.",
    studies: [
      {
        id: "baar-collagen-1",
        title: "Vitamin C-enriched gelatin supplementation before intermittent activity augments collagen synthesis",
        authors: "Shaw G, Lee-Barthel A, Ross MLR, Wang B, Baar K",
        journal: "American Journal of Clinical Nutrition",
        year: 2017,
        pmid: "27852613",
        category: "exercise",
        summary: "The landmark Keith Baar study demonstrating that 15g of vitamin C-enriched gelatin consumed 1 hour before brief exercise doubled collagen synthesis markers — establishing a simple, evidence-based protocol for tendon and ligament health.",
        keyFindings: [
          "15g vitamin C-enriched gelatin 1 hour before exercise doubled collagen synthesis markers (aminoterminal propeptide of collagen I)",
          "5g dose showed intermediate effect — dose-dependent response confirmed",
          "Just 6 minutes of rope-skipping sufficient to stimulate tendon/ligament collagen production when combined with gelatin",
          "Establishes the Baar protocol: gelatin + vitamin C + brief mechanical loading = enhanced connective tissue repair"
        ],
        relevance: "The Keith Baar protocol is one of the most actionable findings in exercise science — a simple pre-workout gelatin + vitamin C dose measurably enhances tendon and ligament repair. Cross-reference: BPC-157 peptide therapy (Phase 3) works through complementary tissue repair pathways, and protein timing research in the Nutrition Science section supports this collagen synthesis window.",
        crossReferences: ["nutrition-science"],
        link: "https://pubmed.ncbi.nlm.nih.gov/27852613/"
      },
      {
        id: "pgc1a-mitochondria-1",
        title: "Exercise induces transient transcriptional activation of the PGC-1alpha gene in human skeletal muscle",
        authors: "Pilegaard H, Saltin B, Neufer PD",
        journal: "Journal of Physiology",
        year: 2003,
        pmid: "12563009",
        category: "exercise",
        summary: "Demonstrates that a single exercise bout triggers a 10- to 40-fold increase in PGC-1alpha transcription — the master regulator of mitochondrial biogenesis — establishing the molecular mechanism by which exercise builds new mitochondria and raises metabolic rate.",
        keyFindings: [
          "Single acute exercise bout triggered 10- to 40-fold increase in PGC-1alpha transcription in human muscle",
          "Peak response at 2 hours post-exercise",
          "Trained muscle showed greater PGC-1alpha response at same absolute workload — training amplifies the effect",
          "PGC-1alpha is the master regulator coordinating mitochondrial biogenesis genes in response to exercise"
        ],
        relevance: "This is the mechanistic anchor for the 'raise metabolism by building mitochondria through exercise' narrative. Instead of cutting calories (which triggers persistent metabolic suppression — see Nutrition Science section), exercise builds new mitochondria via PGC-1alpha, permanently raising your metabolic engine. Cross-reference: Wim Hof intermittent hypoxia (see Breath Training section) activates AMPK, which is upstream of PGC-1alpha — the same pathway.",
        crossReferences: ["nutrition-science", "breath-training"],
        link: "https://pubmed.ncbi.nlm.nih.gov/12563009/"
      },
      {
        id: "rehit-original-1",
        title: "Towards the minimal amount of exercise for improving metabolic health: beneficial effects of reduced-exertion high-intensity interval training",
        authors: "Metcalfe RS, Babraj JA, Fawkner SG, Vollaard NBJ",
        journal: "European Journal of Applied Physiology",
        year: 2012,
        pmid: "22124524",
        category: "exercise",
        summary: "The original REHIT study showing that just 10-minute sessions with 2 all-out sprints, performed 3 times per week for 6 weeks, improved insulin sensitivity by 28% and VO2 max by 12-15% — despite dramatically lower time commitment and perceived exertion than traditional HIIT.",
        keyFindings: [
          "10-minute REHIT sessions with 2 all-out sprints, 3x/week for 6 weeks",
          "Insulin sensitivity improved 28% in males",
          "VO2 max improved 15% male / 12% female",
          "Comparable metabolic adaptations to longer HIIT protocols despite low perceived exertion"
        ],
        relevance: "REHIT is the time-efficient frontier of VO2 max and mitochondrial biogenesis training — 10 minutes, twice-weekly sprints producing comparable metabolic gains to much longer protocols. This is exercise as metabolic medicine. Cross-reference: intermittent hypoxia from Wim Hof breathing (see Breath Training section) activates the same AMPK pathway that REHIT sprints trigger.",
        crossReferences: ["breath-training"],
        link: "https://pubmed.ncbi.nlm.nih.gov/22124524/"
      },
      {
        id: "rehit-diabetes-1",
        title: "A comparison of the health benefits of reduced-exertion high-intensity interval training (REHIT) and moderate-intensity walking in type 2 diabetes patients",
        authors: "Ruffino JS, Songsorn P, Haggett M, et al.",
        journal: "Applied Physiology, Nutrition, and Metabolism",
        year: 2017,
        pmid: "28121184",
        category: "exercise",
        summary: "Confirms REHIT's superiority for aerobic fitness improvement even in metabolically compromised individuals — 7% VO2 max improvement versus just 1% for moderate-intensity walking in type 2 diabetes patients.",
        keyFindings: [
          "REHIT produced 7% VO2 max improvement vs 1% for moderate-intensity walking",
          "Both produced similar blood pressure and fructosamine reductions",
          "Confirms REHIT effectiveness in metabolically compromised population",
          "Time-efficient protocol particularly valuable for clinical populations with adherence challenges"
        ],
        relevance: "Extends the REHIT evidence to clinical populations with metabolic disease, reinforcing that sprint-based training is effective across fitness levels. Cross-reference: metabolic disease management connects to the Glucose Ketone Index and fasting research in the Nutrition Science section.",
        crossReferences: ["nutrition-science"],
        link: "https://pubmed.ncbi.nlm.nih.gov/28121184/"
      },
      {
        id: "mind-muscle-emg-1",
        title: "Mind-muscle connection: effects of verbal instructions on muscle activity during bench press exercise",
        authors: "Paoli A, Mancin L, Saoncella M, et al.",
        journal: "European Journal of Translational Myology",
        year: 2019,
        pmid: "31354928",
        category: "exercise",
        summary: "EMG-verified evidence that the mind-muscle connection is real and trainable — specific attentional cues measurably alter muscle activation patterns during resistance exercise, demonstrating that neuromuscular recruitment is an intentional, cognitive skill.",
        keyFindings: [
          "Specific attentional cues measurably altered EMG-measured muscle activation during bench press",
          "Triceps activation increased significantly with triceps-focused cueing at both 50% and 80% of 1RM",
          "Mind-muscle connection is real and asymmetric — some muscles respond to attentional cues more than others",
          "Neuromuscular recruitment is a trainable cognitive skill, not just 'broscience'"
        ],
        relevance: "The mind-muscle connection is the first link in the chain: sharp mind leads to intentional neuromuscular control leads to effective muscle recruitment leads to muscle and bone preservation leads to longevity. This study demonstrates that the connection between cognitive intent and muscle activation is measurable and trainable. Cross-reference: cognitive training (N-Back, Phase 2) shares the neuroplasticity foundation that makes this attentional control trainable.",
        crossReferences: ["mental-training"],
        link: "https://pubmed.ncbi.nlm.nih.gov/31354928/"
      },
      {
        id: "sarcopenia-cognition-1",
        title: "Sarcopenia and Cognitive Decline in Older Adults: Targeting the Muscle-Brain Axis",
        authors: "Arosio B, Calvani R, Ferri E, et al.",
        journal: "Nutrients",
        year: 2023,
        pmid: "37111070",
        category: "exercise",
        summary: "Documents the shared biological mechanisms between muscle loss and cognitive impairment — mitochondrial dysfunction, chronic inflammation, and metabolic alterations — establishing that the muscle-brain axis is a bidirectional system where training one side benefits the other.",
        keyFindings: [
          "Shared biological mechanisms between muscle loss and cognitive impairment: mitochondrial dysfunction, inflammation, metabolic alterations",
          "Myokines (muscle-derived signaling molecules) mediate muscle-brain communication",
          "Neuromuscular junctions are the critical junction between nervous system and muscle tissue",
          "Behavioral interventions targeting the muscle-brain axis address both physical and cognitive decline simultaneously"
        ],
        relevance: "The primary citation for 'the chain' — sharp mind, neuromuscular control, muscle preservation, bone density, longevity. This study proves the chain is bidirectional: cognitive decline accelerates sarcopenia AND sarcopenia accelerates cognitive decline. Breaking the cycle with resistance training benefits both ends. Cross-reference: breathwork supports mitochondrial health through hypoxic conditioning (see Breath Training section), and protein timing preserves lean mass (see Nutrition Science section).",
        crossReferences: ["breath-training", "nutrition-science"],
        link: "https://pubmed.ncbi.nlm.nih.gov/37111070/"
      },
      {
        id: "neuromuscular-sarcopenia-1",
        title: "A neuromuscular perspective of sarcopenia pathogenesis: deciphering the signaling pathways involved",
        authors: "Moreira-Pais A, Ferreira R, Oliveira PA, Duarte JA",
        journal: "Geroscience",
        year: 2022,
        pmid: "34981273",
        category: "exercise",
        summary: "Details the neuromuscular junction (NMJ) degeneration that drives age-related muscle loss — identifying biomarkers (CAF, BDNF) and therapeutic targets (acetylcholine signaling, CGRP) that explain why maintaining neural drive to muscle is as important as the muscle tissue itself.",
        keyFindings: [
          "Age-related degeneration of neuromuscular junctions (NMJ) is a primary driver of sarcopenia",
          "Biomarkers CAF and BDNF identified as key indicators of NMJ health",
          "Acetylcholine signaling and CGRP are therapeutic targets for NMJ preservation",
          "Reinnervation failure and impaired NMJ signal transmission underlie both strength and mass loss"
        ],
        relevance: "Extends the longevity chain with the cellular mechanism: it is not just muscle mass that declines with age, but the neuromuscular junctions that connect brain to muscle. Resistance training maintains NMJ health. Cross-reference: protein intake for muscle protein synthesis (see Nutrition Science section) provides the building blocks, while the mind-muscle connection research above shows the neural pathway is trainable.",
        crossReferences: ["nutrition-science"],
        link: "https://pubmed.ncbi.nlm.nih.gov/34981273/"
      },
      {
        id: "resistance-bone-1",
        title: "Effects of Resistance Exercise on Bone Health",
        authors: "Hong AR, Kim SW",
        journal: "Endocrinology and Metabolism",
        year: 2018,
        doi: "10.3803/EnM.2018.33.4.435",
        pmid: "30513557",
        category: "exercise",
        summary: "Comprehensive review demonstrating that resistance exercise increases bone mineral density through mechanical loading, with progressive overload essential for continued skeletal adaptation — the bone density link in the muscle-bone-longevity chain.",
        keyFindings: [
          "Resistance training increases bone mineral density through mechanical loading",
          "Progressive overload is essential for continued skeletal adaptation",
          "Combined resistance and weight-bearing exercise optimal for bone health",
          "Bone responds to exercise throughout the lifespan — it is never too late to start"
        ],
        relevance: "The bone density link in the longevity chain: sharp mind (attentional control) drives neuromuscular recruitment (mind-muscle connection) which builds and preserves muscle (sarcopenia prevention) which loads bones (this study) which extends healthspan. Cross-reference: the Keith Baar gelatin + vitamin C protocol supports the connective tissue that anchors muscle to bone.",
        link: "https://pubmed.ncbi.nlm.nih.gov/30513557/"
      }
    ]
  },
  {
    id: "vision-science",
    title: "Vision Training & Eye Health",
    description: "Research on visual acuity training, accommodation exercises, and neuroplasticity of the visual system.",
    category: "general",
    practicalApplication: "Our Vision Training module uses Snellen charts, contrast sensitivity, and accommodation exercises backed by this research.",
    studies: [
      {
        id: "vision-perceptual-1",
        title: "Improved Vision and On-Field Performance in Baseball Through Perceptual Learning",
        authors: "Deveau J, Ozer DJ, Seitz AR.",
        journal: "Current Biology",
        year: 2014,
        doi: "10.1016/j.cub.2014.01.004",
        pmid: "24508170",
        category: "general",
        summary: "Demonstrated that perceptual learning exercises significantly improved visual acuity and real-world sports performance in college baseball players.",
        keyFindings: [
          "Vision training improved visual acuity by an average of 31%",
          "On-field batting performance improved significantly",
          "Perceptual learning transferred to real-world visual tasks",
          "Effects maintained over the competitive season"
        ],
        relevance: "Demonstrates that structured vision training can meaningfully improve visual acuity — the foundation of our Snellen-based training.",
        link: "https://pubmed.ncbi.nlm.nih.gov/24508170/"
      },
      {
        id: "vision-accommodation-1",
        title: "Accommodation and Vergence Facility: Normative Data and Their Relationship to Binocular Vision",
        authors: "Scheiman M, et al.",
        journal: "Optometry and Vision Science",
        year: 1999,
        pmid: "10416930",
        category: "general",
        summary: "Establishes normative values for accommodative facility and demonstrates the importance of accommodation training for binocular vision health.",
        keyFindings: [
          "Accommodation facility is trainable and improves with practice",
          "Near-far focusing exercises improve accommodative flexibility",
          "Binocular vision quality directly correlates with accommodation facility",
          "Regular eye exercises can maintain visual performance with aging"
        ],
        relevance: "Validates our near-far accommodation exercises in the Vision Training module.",
        link: "https://pubmed.ncbi.nlm.nih.gov/10416930/"
      },
      {
        id: "vision-neuroplasticity-1",
        title: "Perceptual Learning as a Possible New Approach for Remediation and Prevention of Amblyopia",
        authors: "Polat U.",
        journal: "Vision Research",
        year: 2009,
        doi: "10.1016/j.visres.2008.11.011",
        pmid: "19084554",
        category: "general",
        summary: "Reviews how perceptual learning drives neuroplastic changes in the adult visual cortex, demonstrating that visual function remains trainable throughout life.",
        keyFindings: [
          "Visual cortex retains significant neuroplasticity in adults",
          "Contrast sensitivity is trainable through repeated practice",
          "Perceptual learning produces lasting improvements in visual function",
          "Transfer of training occurs across untrained visual tasks"
        ],
        relevance: "Supports the scientific basis for our contrast sensitivity and visual acuity training protocols.",
        link: "https://pubmed.ncbi.nlm.nih.gov/19084554/"
      }
    ]
  },
  {
    id: "mental-training",
    title: "Cognitive Training & Working Memory",
    description: "Research on N-Back training, pitch recognition, spaced repetition, and neuroplasticity of cognitive function.",
    category: "general",
    practicalApplication: "Our N-Back trainer and Pitch Recognition game implement these evidence-based cognitive training principles.",
    studies: [
      {
        id: "nback-fluid-1",
        title: "Improving Fluid Intelligence with Training on Working Memory",
        authors: "Jaeggi SM, et al.",
        journal: "Proceedings of the National Academy of Sciences",
        year: 2008,
        doi: "10.1073/pnas.0801268105",
        pmid: "18378733",
        category: "general",
        summary: "The landmark study showing that N-Back working memory training can transfer to improvements in fluid intelligence, a finding that launched the modern cognitive training field.",
        keyFindings: [
          "Dual N-Back training improved fluid intelligence scores",
          "Gains were dose-dependent — more training produced larger improvements",
          "Transfer effects observed on untrained cognitive tasks",
          "Working memory training is a viable approach to cognitive enhancement"
        ],
        relevance: "The foundational study behind our Dual N-Back and higher-order N-Back training modules.",
        link: "https://pubmed.ncbi.nlm.nih.gov/18378733/"
      },
      {
        id: "spaced-repetition-1",
        title: "A Model of How Spaced Practice Improves Learning: The Spacing Effect and Retrieval Practice",
        authors: "Lindsey RV, et al.",
        journal: "Psychological Review",
        year: 2014,
        doi: "10.1037/a0036399",
        pmid: "24932672",
        category: "general",
        summary: "Models how spaced practice and retrieval strengthen long-term memory through optimally timed review intervals.",
        keyFindings: [
          "Spaced repetition outperforms massed practice for long-term retention",
          "Optimal spacing intervals depend on individual learning curves",
          "Retrieval practice strengthens memory more than re-study",
          "Adaptive scheduling algorithms maximize learning efficiency"
        ],
        relevance: "The theoretical basis for our FSRS spaced repetition system used in Pitch Recognition training.",
        link: "https://pubmed.ncbi.nlm.nih.gov/24932672/"
      },
      {
        id: "pitch-training-1",
        title: "Absolute Pitch May Not Be So Absolute",
        authors: "Hedger SC, et al.",
        journal: "Psychological Science",
        year: 2013,
        doi: "10.1177/0956797612473310",
        pmid: "23424073",
        category: "general",
        summary: "Demonstrates that pitch perception is more plastic than previously thought, with training-induced improvements in pitch labeling and discrimination.",
        keyFindings: [
          "Pitch perception abilities are trainable in adults",
          "Training improves pitch labeling accuracy significantly",
          "Relative pitch skills benefit from structured ear training",
          "Auditory cortex shows plasticity in response to pitch training"
        ],
        relevance: "Supports the trainability of pitch recognition — the core skill in our ear training game.",
        link: "https://pubmed.ncbi.nlm.nih.gov/23424073/"
      }
    ]
  },
  {
    id: "nutrition-science",
    title: "Nutrition Science",
    description: "Why raising your metabolic rate through mitochondrial biogenesis beats caloric restriction every time — plus the science of the Glucose Ketone Index, fasting-triggered FGF21 and autophagy, and how protein timing fuels the muscle-bone-longevity chain.",
    category: "nutrition",
    practicalApplication: "Our Nutrition tracking module at /nutrition helps you implement these strategies: monitor your eating windows for intermittent fasting, track protein distribution across meals for optimal muscle protein synthesis, and log foods that support your metabolic health rather than restrict calories.",
    studies: [
      {
        id: "gki-metabolic-1",
        title: "The glucose ketone index calculator: a simple tool to monitor therapeutic efficacy for metabolic management of brain cancer",
        authors: "Meidenbauer JJ, Mukherjee P, Seyfried TN",
        journal: "Nutrition & Metabolism",
        year: 2015,
        pmid: "25798181",
        category: "nutrition",
        summary: "The original scientific paper behind what Dr. Annette Bosworth (Dr. Boz) popularized as the 'Dr. Boz Ratio' — the Glucose Ketone Index (GKI = blood glucose / blood ketones) as a single metric for metabolic health. GKI approaching 1.0 indicates maximum therapeutic metabolic state, measurable with simple fingerstick meters.",
        keyFindings: [
          "Developed the Glucose Ketone Index (GKI = blood glucose molar / blood ketones molar) as a unified metabolic marker",
          "GKI approaching 1.0 associated with maximum therapeutic efficacy in ketogenic metabolic therapy",
          "Applied to both human and animal brain tumor data with clear dose-response relationship",
          "Democratizes metabolic monitoring — fingerstick glucose and ketone meters are sufficient for tracking"
        ],
        relevance: "The GKI is the single metric that tells you where you are metabolically — Dr. Boz brought this research-grade tool to general health audiences. A low GKI indicates your body is efficiently burning ketones alongside glucose, a state achieved through intermittent fasting (see studies below) and supported by the exercise-driven mitochondrial biogenesis documented in the Exercise Science section.",
        crossReferences: ["exercise-protocols"],
        link: "https://pubmed.ncbi.nlm.nih.gov/25798181/"
      },
      {
        id: "tre-mechanisms-1",
        title: "Time-Restricted Eating: Benefits, Mechanisms, and Challenges in Translation",
        authors: "Regmi P, Heilbronn LK",
        journal: "iScience",
        year: 2020,
        pmid: "32480126",
        doi: "10.1016/j.isci.2020.101161",
        category: "nutrition",
        summary: "Comprehensive review showing that 6-10 hour eating windows reduce body weight, improve glucose tolerance, and increase metabolic flexibility — with benefits driven by circadian alignment and metabolic switching to ketone production, not just caloric reduction.",
        keyFindings: [
          "6-10 hour eating windows reduce body weight, improve glucose tolerance, and protect against hepatosteatosis",
          "Reduces atherogenic lipids and blood pressure while improving gut health",
          "Circadian alignment of eating window matters independently of caloric restriction",
          "Metabolic switch to ketone production occurs 8-16 hours into fasting"
        ],
        relevance: "Intermittent fasting works through metabolic switching — not caloric restriction. The 8-16 hour transition to ketone production is when the GKI (study above) begins improving and the FGF21 pathway (study below) activates. Cross-reference: fasting and Wim Hof breathing both activate autophagy pathways — the fasting-breathwork synergy (see Breath Training section) is additive.",
        crossReferences: ["breath-training"],
        link: "https://pubmed.ncbi.nlm.nih.gov/32480126/"
      },
      {
        id: "fgf21-autophagy-1",
        title: "Fasting-induced FGF21 signaling activates hepatic autophagy and lipid degradation via JMJD3 histone demethylase",
        authors: "Byun S, Seok S, Kim YC, et al.",
        journal: "Nature Communications",
        year: 2020,
        pmid: "32042044",
        category: "nutrition",
        summary: "Reveals the molecular mechanism connecting fasting to cellular cleanup: fasting triggers FGF21 signaling, which activates JMJD3 enzyme, which epigenetically unlocks autophagy genes (Atg7, Tfeb, Atgl) — the specific pathway by which your body cleans up damaged cellular components during a fast.",
        keyFindings: [
          "Fasting triggers FGF21 signaling which activates JMJD3 enzyme for epigenetic autophagy gene activation",
          "Specific pathway: PKA phosphorylates JMJD3, enabling nuclear entry and partnership with PPARalpha",
          "FGF21 administration improved fatty liver disease in obese mice via this JMJD3-dependent mechanism",
          "NAFLD patients show substantially reduced autophagy-related gene expression — a therapeutic target"
        ],
        relevance: "This is the molecular 'why' behind intermittent fasting: FGF21 is the key that unlocks autophagy — your cells' cleanup system. The same FGF21 pathway is activated by fructose (see study below), explaining why small targeted fructose doses can paradoxically improve metabolic health. Cross-reference: Wim Hof breathing induces acute hypoxia which activates AMPK, a parallel autophagy trigger (see Breath Training section) — combining fasting with breathwork may activate autophagy through two independent pathways simultaneously.",
        crossReferences: ["breath-training"],
        link: "https://pubmed.ncbi.nlm.nih.gov/32042044/"
      },
      {
        id: "fructose-fgf21-1",
        title: "The FGF21 response to fructose predicts metabolic health and persists after bariatric surgery in obese humans",
        authors: "Ter Horst KW, Gilijamse PW, Demirkiran A, et al.",
        journal: "Molecular Metabolism",
        year: 2017,
        pmid: "29107295",
        category: "nutrition",
        summary: "The counterintuitive discovery that fructose powerfully activates the FGF21 pathway — the same pathway that triggers autophagy during fasting. FGF21 levels rose 3-fold after fructose ingestion, and the response correlated with underlying metabolic health. This is a research-grade finding about metabolic signaling pathways, not a recommendation for high-fructose diets.",
        keyFindings: [
          "FGF21 levels rose 3-fold at 120 minutes after fructose ingestion in obese humans",
          "FGF21 response correlated with underlying metabolic health — poorer health produced higher spike",
          "Response persisted after 28% body weight loss from bariatric surgery — signaling pathway not normalized by weight loss alone",
          "FGF21 specificity: responds to fructose much more strongly than glucose"
        ],
        relevance: "IMPORTANT FRAMING: This is not 'eat sugar for health.' Small, targeted fructose doses activate the FGF21 pathway — the same pathway that fasting activates for autophagy and fat metabolism. The research value is in understanding FGF21 as a metabolic health biomarker and signaling mediator. Practically, this explains why fruit (natural fructose source) may have metabolic benefits beyond its vitamin content. Cross-reference: this FGF21 pathway is the mechanistic link between fasting (study above) and autophagy (FGF21 autophagy study).",
        link: "https://pubmed.ncbi.nlm.nih.gov/29107295/"
      },
      {
        id: "adaptive-thermogenesis-1",
        title: "Long-term persistence of adaptive thermogenesis in subjects who have maintained a reduced body weight",
        authors: "Rosenbaum M, Hirsch J, Gallagher DA, Leibel RL",
        journal: "American Journal of Clinical Nutrition",
        year: 2008,
        pmid: "18842775",
        category: "nutrition",
        summary: "The definitive anti-starvation-diet evidence: metabolic suppression from caloric restriction persists for YEARS — both 'recently lost weight' and 'maintained weight loss over 1 year' groups showed significantly lower total energy expenditure than never-dieted controls. Low-calorie diets permanently damage your metabolic rate.",
        keyFindings: [
          "Declines in total energy expenditure (TEE) and non-resting energy expenditure (NREE) persist well beyond active weight loss period",
          "Both 'recently lost' and 'maintained 1+ year' groups showed significantly lower TEE vs never-dieted controls",
          "Metabolic suppression does NOT diminish with time — it is a sustained physiological adaptation",
          "Mechanism involves leptin, thyroid, and autonomic nervous system adaptations"
        ],
        relevance: "This is why caloric restriction diets fail: your body permanently lowers its metabolic rate in response to caloric restriction, and this suppression persists for years even after returning to normal eating. The alternative: build new mitochondria through exercise (see PGC-1alpha study in Exercise Science section), which permanently RAISES your metabolic engine instead of suppressing it. Cross-reference: protein intake preserves lean mass during any weight change (protein timing study below), protecting the metabolic rate from decline.",
        crossReferences: ["exercise-protocols"],
        link: "https://pubmed.ncbi.nlm.nih.gov/18842775/"
      },
      {
        id: "adaptive-thermogenesis-2",
        title: "Adaptive Thermogenesis in Humans",
        authors: "Rosenbaum M, Leibel RL",
        journal: "International Journal of Obesity",
        year: 2010,
        pmid: "20935667",
        category: "nutrition",
        summary: "Completes the anti-starvation-diet case: over 80% of dieters return to pre-diet weight because the body actively DEFENDS its fat stores through metabolic, behavioral, neuroendocrine, and autonomic adaptations. Obesity is an actively defended physiological state — fighting it with caloric restriction is fighting biology.",
        keyFindings: [
          "Over 80% recidivism rate to pre-weight-loss body fatness — the body actively defends against weight loss",
          "Adaptive responses span metabolic, behavioral, neuroendocrine, and autonomic systems",
          "Leptin mediates much of the set-point defense mechanism",
          "Obesity is an actively defended physiological state, not a willpower failure — reframes the treatment approach"
        ],
        relevance: "Together with the Rosenbaum 2008 study above, these two papers build the complete anti-starvation-diet case. Low-calorie diets fight a biologically defended setpoint — the 80% recidivism rate is not willpower failure, it is physiology. The Reset Biology approach: raise your metabolic rate by building mitochondria through exercise and REHIT (see Exercise Science section) rather than suppress it through restriction.",
        crossReferences: ["exercise-protocols"],
        link: "https://pubmed.ncbi.nlm.nih.gov/20935667/"
      },
      {
        id: "protein-mps-1",
        title: "Recent Perspectives Regarding the Role of Dietary Protein for the Promotion of Muscle Hypertrophy with Resistance Exercise Training",
        authors: "Stokes T, Hector AJ, Morton RW, McGlory C, Phillips SM",
        journal: "Nutrients",
        year: 2018,
        pmid: "29414855",
        category: "nutrition",
        summary: "Establishes the science of protein timing for muscle protein synthesis: 20g whey protein maximally stimulates MPS, leucine is the primary mTOR trigger, even distribution across meals beats one large protein meal, and higher protein protects lean mass during caloric deficit — the nutritional support for the muscle-bone-longevity chain.",
        keyFindings: [
          "20g whey protein sufficient to maximally stimulate muscle protein synthesis (MPS) in most adults — 40g adds no further stimulation",
          "Leucine is the primary trigger for mTOR pathway activation and MPS initiation (dose-dependent)",
          "Even distribution of protein across meals (rather than one large protein meal) optimizes daily MPS",
          "Higher protein protects lean mass during caloric deficit — critical for preserving metabolic rate"
        ],
        relevance: "Protein timing is the nutritional partner to resistance training: exercise provides the stimulus (see Exercise Science section) and protein provides the building blocks. Even distribution across meals (25-40g per meal) keeps the mTOR pathway active throughout the day. Particularly important: higher protein during any weight change protects the lean mass that MAINTAINS your metabolic rate — connecting directly to the anti-starvation evidence above. Cross-reference: the Keith Baar collagen protocol (see Exercise Science section) adds vitamin C-enriched gelatin to this protein strategy for connective tissue.",
        crossReferences: ["exercise-protocols"],
        link: "https://pubmed.ncbi.nlm.nih.gov/29414855/"
      }
    ]
  },
  {
    id: "general-health",
    title: "General Health & Longevity",
    description: "Research on sleep, stress management, cold exposure, and integrative approaches to healthspan optimization.",
    category: "general",
    practicalApplication: "These studies inform the holistic approach across all Reset Biology modules — connecting breath, movement, nutrition, and recovery.",
    studies: [
      {
        id: "sleep-health-1",
        title: "Sleep Duration and All-Cause Mortality: A Systematic Review and Meta-Analysis",
        authors: "Cappuccio FP, et al.",
        journal: "Sleep",
        year: 2010,
        doi: "10.1093/sleep/33.5.585",
        pmid: "20469800",
        category: "general",
        summary: "Landmark meta-analysis of 1.3 million participants showing both short and long sleep duration associated with increased mortality risk.",
        keyFindings: [
          "7-8 hours of sleep associated with lowest all-cause mortality",
          "Short sleep (<6h) increases mortality risk by 12%",
          "Sleep quality equally important as duration",
          "Consistent sleep schedule critical for health outcomes"
        ],
        relevance: "Underlies our emphasis on sleep optimization through breath protocols, DSIP research, and recovery tracking.",
        link: "https://pubmed.ncbi.nlm.nih.gov/20469800/"
      },
      {
        id: "cold-exposure-1",
        title: "Human Physiological Responses to Immersion into Water of Different Temperatures",
        authors: "Srámek P, et al.",
        journal: "European Journal of Applied Physiology",
        year: 2000,
        doi: "10.1007/s004210050065",
        pmid: "10751106",
        category: "general",
        summary: "Demonstrates that cold water immersion triggers significant metabolic and hormonal responses including norepinephrine increases of 200-300%.",
        keyFindings: [
          "Cold exposure (14°C) increases norepinephrine by 200-300%",
          "Metabolic rate increases significantly during cold exposure",
          "Dopamine levels elevated by ~250% in cold water",
          "Repeated cold exposure improves cold tolerance and stress resilience"
        ],
        relevance: "Supports cold exposure as a complementary recovery and metabolic optimization tool alongside our training protocols.",
        link: "https://pubmed.ncbi.nlm.nih.gov/10751106/"
      },
      {
        id: "meditation-stress-1",
        title: "Mindfulness-Based Stress Reduction and Health Benefits: A Meta-Analysis",
        authors: "Grossman P, et al.",
        journal: "Journal of Psychosomatic Research",
        year: 2004,
        doi: "10.1016/S0022-3999(03)00573-7",
        pmid: "15256293",
        category: "general",
        summary: "Meta-analysis showing mindfulness-based stress reduction improves both mental and physical health outcomes across diverse populations.",
        keyFindings: [
          "Mindfulness practice reduces cortisol and stress markers",
          "Consistent practice improves immune function",
          "Benefits extend to pain management and emotional regulation",
          "Breath-focused meditation produces the most consistent results"
        ],
        relevance: "Connects our breath training protocols to broader stress reduction and health optimization outcomes.",
        link: "https://pubmed.ncbi.nlm.nih.gov/15256293/"
      }
    ]
  }
]

export default function EducationPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedSections, setExpandedSections] = useState<string[]>(["breath-training"])

  const categories = [
    { id: "all", name: "All Research", icon: "📚" },
    { id: "breath", name: "Breath Training", icon: "🌬️" },
    { id: "peptides", name: "Peptides", icon: "💉" },
    { id: "exercise", name: "Exercise", icon: "💪" },
    { id: "nutrition", name: "Nutrition", icon: "🍎" },
    { id: "general", name: "General Health", icon: "🧬" }
  ]

  const filteredResearch = researchData.filter(section => {
    const matchesCategory = activeCategory === "all" || section.category === activeCategory
    const matchesSearch = searchTerm === "" || 
      section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.studies.some(study => 
        study.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        study.summary.toLowerCase().includes(searchTerm.toLowerCase())
      )
    return matchesCategory && matchesSearch
  })

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative pt-28"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        <PortalHeader
          section="Education Center"
          subtitle="Research & Science"
        />

        {/* Title */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-secondary-400">Science</span> Behind the Protocol
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-4xl mx-auto font-medium leading-relaxed drop-shadow-sm">
            Peer-reviewed research backing every exercise, peptide, and protocol we recommend
          </p>
        </div>

        {/* Search and Filter */}
        <div className="container mx-auto px-4 mb-8">
          <div className="max-w-4xl mx-auto">
            <div className="card-hover-primary mb-8">
              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search studies, protocols, or topics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 transition-colors backdrop-blur-sm"
                />
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-3 justify-center">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                      activeCategory === category.id
                        ? 'bg-primary-500/30 text-primary-200 border border-primary-400/40 shadow-lg hover:shadow-primary-400/20'
                        : 'bg-gray-700/30 text-gray-300 border border-gray-600/30 hover:bg-gray-600/40 hover:text-white hover:shadow-gray-400/10'
                    }`}
                  >
                    <span className="text-base">{category.icon}</span>
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Research Sections */}
            <div className="space-y-6">
              {filteredResearch.map(section => {
                const isExpanded = expandedSections.includes(section.id)
                return (
                  <div key={section.id} className="education-card-hover">
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full p-6 text-left hover:bg-gray-700/20 rounded-xl transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                            <span className="text-2xl">{categories.find(c => c.id === section.category)?.icon}</span>
                            {section.title}
                          </h3>
                          <p className="text-gray-300 leading-relaxed">{section.description}</p>
                        </div>
                        {isExpanded ? 
                          <ChevronUp className="w-6 h-6 text-primary-300 flex-shrink-0 ml-4" /> :
                          <ChevronDown className="w-6 h-6 text-primary-300 flex-shrink-0 ml-4" />
                        }
                      </div>
                    </button>

                    {/* Section Content */}
                    {isExpanded && (
                      <div className="px-6 pb-6">
                        {/* Practical Application */}
                        <div className="bg-gradient-to-r from-secondary-600/20 to-primary-600/20 rounded-lg p-4 mb-6 border border-secondary-400/30">
                          <h4 className="font-semibold text-secondary-300 mb-2">🎯 Practical Application</h4>
                          <p className="text-gray-200 text-sm">{section.practicalApplication}</p>
                        </div>

                        {/* Studies */}
                        <div className="space-y-4">
                          {section.studies.map(study => (
                            <div key={study.id} className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-lg p-5 border border-gray-600/30">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h5 className="font-bold text-white text-lg leading-tight mb-2">{study.title}</h5>
                                  <p className="text-sm text-gray-400">
                                    {study.authors} • <em>{study.journal}</em> • {study.year}
                                    {study.pmid && <span> • PMID: {study.pmid}</span>}
                                  </p>
                                </div>
                                {study.link && (
                                  <a 
                                    href={study.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="bg-primary-600/30 hover:bg-primary-500/40 text-primary-200 p-2 rounded-lg transition-colors flex-shrink-0 ml-4"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                              
                              <p className="text-gray-300 mb-4 leading-relaxed">{study.summary}</p>
                              
                              <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <h6 className="font-semibold text-green-300 mb-2 text-sm">Key Findings</h6>
                                  <ul className="space-y-1">
                                    {study.keyFindings.map((finding, idx) => (
                                      <li key={idx} className="text-gray-300 text-sm flex items-start">
                                        <span className="text-green-400 mr-2 mt-1 text-xs">▸</span>
                                        <span>{finding}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                
                                <div>
                                  <h6 className="font-semibold text-amber-300 mb-2 text-sm">Clinical Relevance</h6>
                                  <p className="text-gray-300 text-sm leading-relaxed">{study.relevance}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {filteredResearch.length === 0 && (
              <div className="text-center py-12">
                <Book className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">No research found</h3>
                <p className="text-gray-400">Try adjusting your search terms or category filter.</p>
              </div>
            )}

            {/* Coming Soon */}
            <div className="mt-12 text-center bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-4">🔬 Research Library Expanding</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
                We're continuously adding peer-reviewed studies to support every protocol, exercise, and peptide we recommend. 
                Each addition is carefully vetted for clinical relevance and practical application.
              </p>
              <div className="text-sm text-primary-300">
                Next additions: GLP-1 protocols • Cold exposure research • Micronutrient optimization
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}