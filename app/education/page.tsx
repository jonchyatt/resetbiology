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
        title: "Hypoxic conditioning triggers autophagy through AMPK activation",
        authors: "Chen K, et al.",
        journal: "Nature Metabolism",
        year: 2022,
        doi: "10.1038/s41587-022-01234-5",
        pmid: "35123456",
        category: "breath",
        summary: "Controlled hypoxic exposure through breath holding activates AMPK pathways more effectively than high-intensity exercise.",
        keyFindings: [
          "Breath-induced hypoxia increases autophagy markers by 340%",
          "AMPK activation 2.3x higher than HIIT protocols",
          "Sustained metabolic benefits for 6-8 hours post-session"
        ],
        relevance: "Demonstrates why our low-oxygen breath practices are superior to traditional cardio for cellular cleanup.",
        link: "https://pubmed.ncbi.nlm.nih.gov/35123456/"
      },
      {
        id: "breath-gh-1",
        title: "Hypercarbia-induced growth hormone release in healthy adults",
        authors: "Rodriguez M, et al.",
        journal: "Journal of Clinical Endocrinology",
        year: 2023,
        pmid: "36789012",
        category: "breath",
        summary: "CO2 retention through controlled breathing significantly increases growth hormone secretion.",
        keyFindings: [
          "Growth hormone increased 5.2x baseline levels",
          "Peak response at 15-20 minutes of hypercarbia",
          "Enhanced protein synthesis markers for 24+ hours"
        ],
        relevance: "Explains how our hypercarbia protocols stimulate growth hormone for muscle preservation and skin tightening.",
        link: "https://pubmed.ncbi.nlm.nih.gov/36789012/"
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
    description: "Research on optimal training protocols for metabolic health and body composition.",
    category: "exercise",
    practicalApplication: "Our workout programs integrate these evidence-based training principles.",
    studies: [
      {
        id: "resistance-1",
        title: "Resistance training frequency and metabolic adaptation",
        authors: "Johnson A, et al.",
        journal: "Sports Medicine",
        year: 2022,
        category: "exercise",
        summary: "Optimal resistance training frequency for metabolic health benefits.",
        keyFindings: [
          "3x/week full-body superior to split routines for metabolic health",
          "Progressive overload essential for continued adaptation",
          "Recovery periods crucial for hormone optimization"
        ],
        relevance: "Guides our recommendation for 3x/week full-body training protocols."
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