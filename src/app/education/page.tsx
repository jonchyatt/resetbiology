"use client"

import { useState } from "react"
import { Book, ExternalLink, Search, Filter, ChevronDown, ChevronUp } from "lucide-react"

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
    description: "Scientific evidence for controlled breathing protocols on autophagy, growth hormone, and metabolic optimization.",
    category: "breath",
    practicalApplication: "Our breath training app implements these protocols with precise timing and progression tracking.",
    studies: [
      {
        id: "breath-autophagy-1",
        title: "AMPK-mTOR signaling participates in the protective effect of chronic intermittent hypobaric hypoxia on vascular endothelium of metabolic syndrome rats",
        authors: "Cui F, et al.",
        journal: "The Chinese Journal of Physiology",
        year: 2022,
        doi: "10.4103/cjp.cjp_84_21",
        pmid: "35488670",
        category: "breath",
        summary: "Chronic intermittent hypobaric hypoxia activates AMPK-mTOR signaling pathways, providing protective metabolic effects in a metabolic syndrome model.",
        keyFindings: [
          "Intermittent hypoxia activates AMPK-mTOR autophagy signaling",
          "Protective effects on vascular endothelium in metabolic syndrome",
          "Supports hypoxic conditioning as a metabolic intervention"
        ],
        relevance: "Demonstrates how intermittent hypoxic exposure activates AMPK pathways relevant to metabolic health.",
        link: "https://pubmed.ncbi.nlm.nih.gov/35488670/"
      },
      {
        id: "breath-gh-1",
        title: "The effect of changes in arterial PCO2 on neuroendocrine function in man",
        authors: "Leach RM, et al.",
        journal: "Experimental Physiology",
        year: 2004,
        doi: "10.1113/expphysiol.2003.026682",
        pmid: "15123564",
        category: "breath",
        summary: "Examines how changes in arterial CO2 levels affect neuroendocrine responses including growth hormone secretion in healthy humans.",
        keyFindings: [
          "Arterial CO2 changes directly modulate neuroendocrine function",
          "Hypercarbia triggers measurable hormonal responses",
          "CO2 levels influence growth hormone and other pituitary hormones"
        ],
        relevance: "Explains the neuroendocrine basis for how CO2-modulating breath protocols affect growth hormone release.",
        link: "https://pubmed.ncbi.nlm.nih.gov/15123564/"
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
        title: "Prospective, randomized, controlled, proof-of-concept study of the ghrelin mimetic ipamorelin for the management of postoperative ileus in bowel resection patients",
        authors: "Beck DE, et al.",
        journal: "International Journal of Colorectal Disease",
        year: 2014,
        doi: "10.1007/s00384-014-2030-8",
        pmid: "25331030",
        category: "peptides",
        summary: "Randomized controlled trial evaluating ipamorelin safety and efficacy as a ghrelin mimetic in surgical patients.",
        keyFindings: [
          "Ipamorelin demonstrated a favorable safety profile",
          "Ghrelin mimetic activity confirmed in clinical setting",
          "Supports further investigation of ipamorelin for metabolic applications"
        ],
        relevance: "Provides clinical safety data for ipamorelin as a ghrelin-receptor agonist peptide.",
        link: "https://pubmed.ncbi.nlm.nih.gov/25331030/"
      },
      {
        id: "bpc157-1",
        title: "Gastric pentadecapeptide body protection compound BPC 157 and its role in accelerating musculoskeletal soft tissue healing",
        authors: "Gwyer D, et al.",
        journal: "Cell and Tissue Research",
        year: 2019,
        doi: "10.1007/s00441-019-03016-8",
        pmid: "30915550",
        category: "peptides",
        summary: "Comprehensive review of BPC-157 mechanisms in musculoskeletal soft tissue healing including tendon, ligament, and muscle repair.",
        keyFindings: [
          "BPC-157 accelerates tendon and ligament healing",
          "Promotes angiogenesis and collagen organization",
          "Demonstrates anti-inflammatory properties in musculoskeletal injuries",
          "Supports multiple healing pathways including NO system modulation"
        ],
        relevance: "Supports our BPC-157 protocols for accelerated musculoskeletal recovery and tissue repair.",
        link: "https://pubmed.ncbi.nlm.nih.gov/30915550/"
      },
      {
        id: "tb500-1",
        title: "Muscle injury-induced thymosin beta4 acts as a chemoattractant for myoblasts",
        authors: "Tokura Y, et al.",
        journal: "Journal of Biochemistry",
        year: 2011,
        doi: "10.1093/jb/mvq115",
        pmid: "20880960",
        category: "peptides",
        summary: "Demonstrates that thymosin beta-4 is released after muscle injury and recruits myoblasts to the injury site, promoting muscle regeneration.",
        keyFindings: [
          "Thymosin beta-4 released from injured muscle tissue",
          "Acts as a chemoattractant to recruit myoblast precursor cells",
          "Promotes muscle fiber regeneration at injury sites",
          "Supports actin-mediated cellular migration mechanisms"
        ],
        relevance: "Explains the mechanism by which TB-500 (thymosin beta-4) promotes muscle repair and regeneration.",
        link: "https://pubmed.ncbi.nlm.nih.gov/20880960/"
      },
      {
        id: "epithalon-1",
        title: "Overview of Epitalon - Highly Bioactive Pineal Tetrapeptide with Promising Properties",
        authors: "Araj SK, et al.",
        journal: "International Journal of Molecular Sciences",
        year: 2025,
        doi: "10.3390/ijms26062691",
        pmid: "40141333",
        category: "peptides",
        summary: "Comprehensive review of epitalon (epithalon), a synthetic tetrapeptide that activates telomerase and modulates pineal gland function.",
        keyFindings: [
          "Epitalon activates telomerase reverse transcriptase",
          "Modulates melatonin secretion via pineal gland activity",
          "Demonstrates anti-aging properties at the cellular level",
          "Shows neuroprotective and immunomodulatory effects"
        ],
        relevance: "Validates Epithalon use for anti-aging, telomerase activation, and sleep optimization protocols.",
        link: "https://pubmed.ncbi.nlm.nih.gov/40141333/"
      },
      {
        id: "dsip-1",
        title: "Neuropeptides and human sleep",
        authors: "Steiger A, et al.",
        journal: "Sleep",
        year: 1997,
        pmid: "9456470",
        category: "peptides",
        summary: "Classic review examining how neuropeptides including DSIP (delta sleep-inducing peptide) modulate sleep architecture and growth hormone release.",
        keyFindings: [
          "DSIP modulates delta wave sleep architecture",
          "Neuropeptides regulate sleep-wake cycles and sleep depth",
          "Growth hormone release linked to slow-wave sleep stages",
          "DSIP interacts with stress-response and recovery systems"
        ],
        relevance: "Supports DSIP use for sleep optimization and recovery enhancement.",
        link: "https://pubmed.ncbi.nlm.nih.gov/9456470/"
      },
      {
        id: "motsc-1",
        title: "MOTS-c: A promising mitochondrial-derived peptide for therapeutic exploitation",
        authors: "Zheng Y, et al.",
        journal: "Frontiers in Endocrinology",
        year: 2023,
        doi: "10.3389/fendo.2023.1120533",
        pmid: "36761202",
        category: "peptides",
        summary: "Review of MOTS-c, a mitochondrial-derived peptide that regulates metabolic homeostasis including insulin sensitivity and energy metabolism.",
        keyFindings: [
          "MOTS-c improves insulin sensitivity and glucose metabolism",
          "Enhances mitochondrial function and biogenesis",
          "Regulates fat metabolism and energy homeostasis",
          "Promising therapeutic target for metabolic diseases"
        ],
        relevance: "Demonstrates MOTS-c effectiveness for metabolic optimization and diabetes prevention.",
        link: "https://pubmed.ncbi.nlm.nih.gov/36761202/"
      },
      {
        id: "ghkcu-1",
        title: "GHK Peptide as a Natural Modulator of Multiple Cellular Pathways in Skin Regeneration",
        authors: "Pickart L, et al.",
        journal: "BioMed Research International",
        year: 2015,
        doi: "10.1155/2015/648108",
        pmid: "26236730",
        category: "peptides",
        summary: "Review of GHK copper peptide as a modulator of skin regeneration pathways including collagen synthesis, anti-inflammatory, and antioxidant activity.",
        keyFindings: [
          "GHK-Cu stimulates collagen synthesis and skin remodeling",
          "Modulates multiple cellular pathways including TGF-beta",
          "Promotes wound healing and tissue regeneration",
          "Demonstrates anti-inflammatory and antioxidant properties"
        ],
        relevance: "Supports GHK-Cu for skin health, anti-aging, and wound healing protocols.",
        link: "https://pubmed.ncbi.nlm.nih.gov/26236730/"
      },
      {
        id: "5amino1mq-1",
        title: "Nicotinamide N-methyltransferase inhibition mitigates obesity-related metabolic dysfunction",
        authors: "Babula JJ, et al.",
        journal: "Diabetes, Obesity & Metabolism",
        year: 2024,
        doi: "10.1111/dom.15879",
        pmid: "39161060",
        category: "peptides",
        summary: "NNMT inhibition demonstrates potential for treating obesity-related metabolic dysfunction through NAD+ pathway modulation.",
        keyFindings: [
          "NNMT inhibition improves metabolic parameters in obesity",
          "Modulates NAD+ salvage pathway for enhanced cellular energy",
          "Reduces obesity-related metabolic dysfunction",
          "Supports NNMT as a therapeutic target for metabolic disease"
        ],
        relevance: "Validates NNMT inhibition (the mechanism of 5-Amino-1MQ) for metabolic optimization and weight management.",
        link: "https://pubmed.ncbi.nlm.nih.gov/39161060/"
      }
    ]
  },
  {
    id: "exercise-protocols",
    title: "Exercise & Movement Science",
    description: "Research on optimal training protocols for metabolic health, body composition, and muscle preservation.",
    category: "exercise",
    practicalApplication: "Our workout programs integrate these evidence-based training principles for maximum metabolic benefit.",
    studies: [
      {
        id: "resistance-1",
        title: "Effects of Resistance Exercise on Bone Health",
        authors: "Hong AR, Kim SW.",
        journal: "Endocrinology and Metabolism",
        year: 2018,
        doi: "10.3803/EnM.2018.33.4.435",
        pmid: "30513557",
        category: "exercise",
        summary: "Comprehensive review of how resistance exercise affects bone mineral density, muscle-bone crosstalk, and skeletal health across the lifespan.",
        keyFindings: [
          "Resistance training increases bone mineral density through mechanical loading",
          "Progressive overload is essential for continued skeletal adaptation",
          "Combined resistance and weight-bearing exercise optimal for bone health"
        ],
        relevance: "Supports our emphasis on progressive resistance training for long-term metabolic and skeletal health.",
        link: "https://pubmed.ncbi.nlm.nih.gov/30513557/"
      },
      {
        id: "hiit-metabolic-1",
        title: "High-Intensity Interval Training and Isocaloric Moderate-Intensity Continuous Training Result in Similar Improvements in Body Composition and Fitness",
        authors: "Wewege M, et al.",
        journal: "Obesity Reviews",
        year: 2017,
        doi: "10.1111/obr.12532",
        pmid: "28401638",
        category: "exercise",
        summary: "Meta-analysis comparing HIIT vs moderate continuous training showing both effective for body composition, with HIIT requiring less time commitment.",
        keyFindings: [
          "HIIT and moderate continuous training produce similar fat loss outcomes",
          "HIIT achieves results in ~40% less time commitment",
          "Both modalities improve cardiovascular fitness markers"
        ],
        relevance: "Validates our inclusion of both HIIT and steady-state protocols in workout programming.",
        link: "https://pubmed.ncbi.nlm.nih.gov/28401638/"
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
    title: "Nutrition & Metabolic Optimization",
    description: "Research on dietary strategies, micronutrients, and metabolic health for body composition and longevity.",
    category: "nutrition",
    practicalApplication: "Our Nutrition tracking module helps implement these evidence-based dietary strategies.",
    studies: [
      {
        id: "protein-timing-1",
        title: "Dietary Protein and Muscle Mass: Translating Science to Application and Health Benefit",
        authors: "Lonnie M, et al.",
        journal: "Nutrients",
        year: 2018,
        doi: "10.3390/nu10020180",
        pmid: "29414855",
        category: "nutrition",
        summary: "Comprehensive review on optimal protein intake for muscle protein synthesis, preservation of lean mass, and the role of protein distribution across meals.",
        keyFindings: [
          "1.6-2.2 g/kg/day protein optimal for muscle protein synthesis",
          "Even distribution across meals (25-40g per meal) maximizes muscle benefit",
          "Protein quality (leucine content) matters for anabolic signaling",
          "Higher protein intake protects lean mass during caloric deficit"
        ],
        relevance: "Guides our nutrition tracking recommendations for protein intake and meal distribution.",
        link: "https://pubmed.ncbi.nlm.nih.gov/29414855/"
      },
      {
        id: "time-restricted-1",
        title: "Effects of Time-Restricted Eating on Weight Loss and Other Metabolic Parameters",
        authors: "Regmi P, Heilbronn LK.",
        journal: "Nature Reviews Endocrinology",
        year: 2020,
        doi: "10.1038/s41574-020-0339-y",
        pmid: "32341528",
        category: "nutrition",
        summary: "Reviews the metabolic effects of time-restricted eating including improvements in insulin sensitivity, body composition, and circadian rhythm alignment.",
        keyFindings: [
          "8-10 hour eating windows improve metabolic markers",
          "Time-restricted eating enhances insulin sensitivity",
          "Circadian alignment of meals improves metabolic health",
          "Benefits observed independent of caloric restriction"
        ],
        relevance: "Supports meal timing strategies tracked in our Nutrition module.",
        link: "https://pubmed.ncbi.nlm.nih.gov/32341528/"
      },
      {
        id: "micronutrient-1",
        title: "Micronutrient Inadequacies in the US Population: An Overview",
        authors: "Bird JK, et al.",
        journal: "Nutrients",
        year: 2017,
        doi: "10.3390/nu9121243",
        pmid: "29137137",
        category: "nutrition",
        summary: "Documents widespread micronutrient deficiencies in the US population and their health implications, supporting targeted supplementation strategies.",
        keyFindings: [
          "Vitamin D, magnesium, and omega-3 are most commonly deficient",
          "Micronutrient gaps worsen with age and dietary restriction",
          "Targeted supplementation can address population-wide deficiencies",
          "Whole-food-first approach with strategic supplementation is optimal"
        ],
        relevance: "Informs our emphasis on tracking micronutrient-dense food intake in the Nutrition module.",
        link: "https://pubmed.ncbi.nlm.nih.gov/29137137/"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20" />
                <div>
                  <h1 className="text-xl font-bold text-white drop-shadow-lg">Education Center</h1>
                  <span className="text-lg text-gray-200 drop-shadow-sm">• Research & Science</span>
                </div>
              </div>
              <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Portal
              </a>
            </div>
          </div>
        </div>

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
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl mb-8">
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
              <div className="flex flex-wrap gap-3">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeCategory === category.id
                        ? 'bg-primary-500/30 text-primary-200 border border-primary-400/40 shadow-lg'
                        : 'bg-gray-700/30 text-gray-300 border border-gray-600/30 hover:bg-gray-600/40 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{category.icon}</span>
                    <span className="text-sm">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Research Sections */}
            <div className="space-y-6">
              {filteredResearch.map(section => {
                const isExpanded = expandedSections.includes(section.id)
                return (
                  <div key={section.id} className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl border border-primary-400/30 shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
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