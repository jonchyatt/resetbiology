"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Users, DollarSign, Calendar, Edit2, Save, X } from "lucide-react"

// Question types (matches AssessmentQuiz.tsx)
interface QuestionOption {
  value: string
  label: string
  score?: number
}

interface Question {
  id: string
  question: string
  subtitle?: string
  type: "text" | "email" | "tel" | "textarea" | "choice"
  placeholder?: string
  required?: boolean
  options?: QuestionOption[]
}

// All 19 questions from AssessmentQuiz.tsx
const QUESTIONS: Question[] = [
  // Contact Info (Q1-Q3)
  {
    id: "name",
    question: "What's your first name?",
    type: "text",
    placeholder: "Enter your name",
    required: true
  },
  {
    id: "email",
    question: "What's your email address?",
    subtitle: "We'll send your personalized results here",
    type: "email",
    placeholder: "you@example.com",
    required: true
  },
  {
    id: "phone",
    question: "Phone number (optional)",
    subtitle: "For priority support and follow-up",
    type: "tel",
    placeholder: "(555) 123-4567",
    required: false
  },

  // Best Practices Questions (Q5-Q14) - 10 points each
  {
    id: "q5_protein_tracking",
    question: "Are you currently tracking your daily protein intake to ensure you're getting 0.8-1g per pound of bodyweight?",
    type: "choice",
    options: [
      { value: "yes-daily", label: "Yes, I track daily", score: 10 },
      { value: "sometimes", label: "Sometimes", score: 5 },
      { value: "no", label: "No, I don't track", score: 0 },
      { value: "dont-know", label: "I don't know my target", score: 0 }
    ]
  },
  {
    id: "q6_stem_cell_support",
    question: "Are you taking any supplements or protocols specifically designed to support stem cell release and tissue repair?",
    type: "choice",
    options: [
      { value: "yes-peptides", label: "Yes, I'm on a peptide or stem cell protocol", score: 10 },
      { value: "basic-supps", label: "I take basic supplements (vitamins, fish oil)", score: 3 },
      { value: "no-supps", label: "No supplements currently", score: 0 },
      { value: "never-heard", label: "I've never heard of this", score: 0 }
    ]
  },
  {
    id: "q7_unified_tracking",
    question: "Do you use a digital system to track your workouts, nutrition, and recovery in one unified platform?",
    type: "choice",
    options: [
      { value: "yes-unified", label: "Yes, everything is tracked digitally", score: 10 },
      { value: "manual", label: "I track some things manually", score: 4 },
      { value: "in-head", label: "I track in my head or sporadically", score: 1 },
      { value: "no-tracking", label: "I don't track consistently", score: 0 }
    ]
  },
  {
    id: "q8_breathwork",
    question: "Are you practicing daily breathwork or meditation to optimize your nervous system and metabolic flexibility?",
    type: "choice",
    options: [
      { value: "daily", label: "Yes, daily practice (10+ min)", score: 10 },
      { value: "weekly", label: "Occasionally (1-2x per week)", score: 4 },
      { value: "rarely", label: "Rarely", score: 1 },
      { value: "never", label: "Never heard of metabolic flexibility training", score: 0 }
    ]
  },
  {
    id: "q9_sleep_tracking",
    question: "Are you tracking your sleep quality and using protocols to ensure 7+ hours of deep, restorative sleep?",
    type: "choice",
    options: [
      { value: "track-optimize", label: "Yes, I track sleep and use optimization protocols", score: 10 },
      { value: "try-7hrs", label: "I try to get 7+ hours but don't track quality", score: 5 },
      { value: "inconsistent", label: "My sleep is inconsistent", score: 2 },
      { value: "struggle", label: "Sleep is a struggle for me", score: 0 }
    ]
  },
  {
    id: "q10_detox_protocols",
    question: "Are you supporting your body's natural detox pathways with chlorella, spirulina, or other cellular cleansing protocols?",
    type: "choice",
    options: [
      { value: "yes-protocol", label: "Yes, I have a detox protocol", score: 10 },
      { value: "tried-before", label: "I've tried detoxing before", score: 3 },
      { value: "no-protocol", label: "No detox protocols currently", score: 0 },
      { value: "dont-know", label: "I don't know what this means", score: 0 }
    ]
  },
  {
    id: "q11_journaling",
    question: "Do you maintain a daily journal to track emotional patterns, stress levels, and their impact on your weight loss?",
    type: "choice",
    options: [
      { value: "daily", label: "Yes, I journal daily", score: 10 },
      { value: "occasional", label: "I journal occasionally", score: 5 },
      { value: "tried-quit", label: "I tried but couldn't stick with it", score: 2 },
      { value: "never", label: "I've never journaled for health", score: 0 }
    ]
  },
  {
    id: "q12_workout_program",
    question: "Are you following a structured, progressive workout program designed for fat loss and muscle preservation?",
    type: "choice",
    options: [
      { value: "structured", label: "Yes, I have a structured program", score: 10 },
      { value: "regular-no-program", label: "I work out regularly but no formal program", score: 5 },
      { value: "sporadic", label: "I work out sporadically", score: 2 },
      { value: "not-working-out", label: "I'm not currently working out", score: 0 }
    ]
  },
  {
    id: "q13_accountability",
    question: "Do you have daily check-ins, notifications, or accountability systems to keep you on track?",
    type: "choice",
    options: [
      { value: "multiple-systems", label: "Yes, I have multiple accountability systems", score: 10 },
      { value: "some-reminders", label: "I have some reminders set up", score: 5 },
      { value: "willpower-only", label: "I rely on willpower alone", score: 1 },
      { value: "often-forget", label: "I often forget my protocols", score: 0 }
    ]
  },
  {
    id: "q14_peptide_knowledge",
    question: "Are you familiar with how peptides like BPC-157, CJC-1295, or Semaglutide can support cellular fat loss and recovery?",
    type: "choice",
    options: [
      { value: "using-peptides", label: "Yes, I'm currently using peptides", score: 10 },
      { value: "heard-never-used", label: "I've heard of them but never used them", score: 5 },
      { value: "curious", label: "I'm curious but don't know where to start", score: 2 },
      { value: "never-heard", label: "I've never heard of peptides for weight loss", score: 0 }
    ]
  },

  // Qualifying Questions (Q15-Q19)
  {
    id: "q15_current_situation",
    question: "Which best describes your current weight loss journey?",
    type: "choice",
    options: [
      { value: "just-starting", label: "Just starting, need guidance on everything" },
      { value: "6-12mo-stuck", label: "Been trying for 6-12 months, some progress but stuck" },
      { value: "1-3yrs-plateaus", label: "Been trying for 1-3 years, multiple plateaus" },
      { value: "3plus-frustrated", label: "Been trying for 3+ years, tried everything, very frustrated" }
    ]
  },
  {
    id: "q16_desired_outcome",
    question: "What is the #1 outcome you want to achieve in the next 90 days?",
    type: "choice",
    options: [
      { value: "lose-15-25lbs", label: "Lose 15-25 lbs of stubborn fat" },
      { value: "break-plateau", label: "Break through my current plateau" },
      { value: "increase-energy", label: "Increase energy and metabolic rate" },
      { value: "sustainable-system", label: "Build a sustainable system that finally works long-term" }
    ]
  },
  {
    id: "q17_biggest_obstacle",
    question: "What do you think is the biggest obstacle stopping you from reaching your goal?",
    type: "choice",
    options: [
      { value: "lack-knowledge", label: "I don't know what I'm doing wrong" },
      { value: "lack-consistency", label: "I can't stay consistent" },
      { value: "metabolism-broken", label: "My metabolism seems broken" },
      { value: "tried-everything", label: "I've tried everything and nothing works" }
    ]
  },
  {
    id: "q18_ideal_solution",
    question: "Which solution sounds most appealing to you?",
    type: "choice",
    options: [
      { value: "diy", label: "DIY: Give me the tools, I'll do it myself ($97-297/mo)" },
      { value: "guided", label: "Guided: Protocols + coaching check-ins ($497-997/mo)" },
      { value: "done-with-you", label: "Done-With-You: Personalized protocols + full tracking + weekly support ($1,497-2,997/mo)" },
      { value: "concierge", label: "Concierge: Do it all for me with 1-on-1 coaching ($3,000+/mo)" }
    ]
  },
  {
    id: "q19_additional_info",
    question: "Is there anything else we should know about your situation, goals, or concerns?",
    subtitle: "This helps us give you better recommendations (optional)",
    type: "textarea",
    placeholder: "Share anything you'd like us to know...",
    required: false
  }
]

export default function AssessmentsAdminPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"submissions" | "questions">("submissions")

  useEffect(() => {
    fetchAssessments()
  }, [])

  const fetchAssessments = async () => {
    try {
      // TODO: Create GET endpoint that returns all assessments (admin only)
      // For now, using placeholder data
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch assessments:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading assessments...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">
            Assessment Funnel Dashboard
          </h1>
          <p className="text-gray-400">
            View submissions, edit questions, and manage the cellular weight loss assessment
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-gray-700">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === "submissions"
                ? "text-primary-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Submissions
            {activeTab === "submissions" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("questions")}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === "questions"
                ? "text-primary-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Questions & Scoring
            {activeTab === "questions" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400" />
            )}
          </button>
        </div>

        {/* SUBMISSIONS TAB */}
        {activeTab === "submissions" && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Submissions</span>
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white">0</div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Avg Score</span>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-white">--</div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">High-Value Leads</span>
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-white">0</div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Conversion Rate</span>
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white">--%</div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-4 mb-6">
              {['all', 'diy', 'guided', 'done-with-you', 'concierge'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setFilter(tier)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === tier
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {tier.charAt(0).toUpperCase() + tier.slice(1).replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* Assessments Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Tier
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Outcome Goal
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {assessments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="text-gray-400 text-lg">
                            No assessments yet. They'll appear here once submissions start coming in.
                          </div>
                          <div className="mt-4">
                            <a
                              href="/assessment"
                              className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                            >
                              View Assessment Page
                            </a>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      assessments.map((assessment: any) => (
                        <tr key={assessment.id} className="hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-white font-semibold">{assessment.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-gray-300">{assessment.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`font-bold ${
                                assessment.score >= 80 ? 'text-green-400' :
                                assessment.score >= 60 ? 'text-yellow-400' :
                                assessment.score >= 40 ? 'text-orange-400' :
                                'text-red-400'
                              }`}>
                                {assessment.score}/100
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              assessment.recommendedTier === 'concierge' ? 'bg-purple-500/20 text-purple-300' :
                              assessment.recommendedTier === 'done-with-you' ? 'bg-blue-500/20 text-blue-300' :
                              assessment.recommendedTier === 'guided' ? 'bg-green-500/20 text-green-300' :
                              'bg-gray-500/20 text-gray-300'
                            }`}>
                              {assessment.recommendedTier}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-300 max-w-xs truncate">
                              {assessment.q16_desired_outcome}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-gray-400 text-sm">
                              {new Date(assessment.completedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* QUESTIONS TAB */}
        {activeTab === "questions" && (
          <div className="space-y-6">
            {/* Section: Contact Info */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Contact Information (Q1-Q3)</h2>
              <p className="text-gray-400 mb-6">Collect basic contact details</p>

              {QUESTIONS.slice(0, 3).map((q, idx) => (
                <div key={q.id} className="mb-6 pb-6 border-b border-gray-700 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          Q{idx + 1}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${q.required ? 'bg-red-500/20 text-red-300' : 'bg-gray-600 text-gray-300'}`}>
                          {q.required ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">{q.question}</h3>
                      {q.subtitle && <p className="text-sm text-gray-400 mb-2">{q.subtitle}</p>}
                      <div className="text-sm text-gray-500">Type: {q.type}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Section: Best Practices (Scoring Questions) */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Best Practices Questions (Q5-Q14)</h2>
              <p className="text-gray-400 mb-2">Creates awareness of cellular optimization gaps</p>
              <p className="text-primary-300 font-semibold mb-6">Scoring: Each question worth 0-10 points (100 total possible)</p>

              {QUESTIONS.slice(3, 13).map((q, idx) => (
                <div key={q.id} className="mb-6 pb-6 border-b border-gray-700 last:border-0">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          Q{idx + 5}
                        </span>
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                          Scored (0-10 pts)
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-3">{q.question}</h3>

                      {/* Answer Options */}
                      <div className="space-y-2 ml-4">
                        {q.options?.map(opt => (
                          <div key={opt.value} className="flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-2">
                            <span className="text-gray-300">{opt.label}</span>
                            <span className={`font-bold ${
                              opt.score === 10 ? 'text-green-400' :
                              opt.score && opt.score > 0 ? 'text-yellow-400' :
                              'text-gray-500'
                            }`}>
                              {opt.score !== undefined ? `${opt.score} pts` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Section: Qualifying Questions */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Qualifying Questions (Q15-Q19)</h2>
              <p className="text-gray-400 mb-6">Understand situation, goals, and budget level</p>

              {QUESTIONS.slice(13, 19).map((q, idx) => (
                <div key={q.id} className="mb-6 pb-6 border-b border-gray-700 last:border-0">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          Q{idx + 15}
                        </span>
                        {q.id === "q18_ideal_solution" && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                            Determines Tier
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-3">{q.question}</h3>
                      {q.subtitle && <p className="text-sm text-gray-400 mb-3">{q.subtitle}</p>}

                      {/* Answer Options */}
                      {q.options && (
                        <div className="space-y-2 ml-4">
                          {q.options.map(opt => (
                            <div key={opt.value} className="flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-2">
                              <span className="text-gray-300">{opt.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Scoring Logic Summary */}
            <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 rounded-xl border border-primary-500/30 p-6">
              <h3 className="text-xl font-bold text-white mb-4">📊 Scoring Algorithm</h3>
              <div className="space-y-3 text-gray-300">
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
                  <span>Master (80-100 pts)</span>
                  <span className="text-green-400 font-semibold">Top 5% - Optimization Master</span>
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
                  <span>Strong (60-79 pts)</span>
                  <span className="text-yellow-400 font-semibold">Strong Foundation, Missing Pieces</span>
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
                  <span>Gaps (40-59 pts)</span>
                  <span className="text-orange-400 font-semibold">Significant Gaps Detected</span>
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
                  <span>Fresh (0-39 pts)</span>
                  <span className="text-blue-400 font-semibold">Starting Fresh</span>
                </div>
              </div>
            </div>

            {/* Note about editing */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                💡 Question Editing
              </h3>
              <p className="text-gray-300">
                Questions are currently hardcoded in <code className="bg-gray-800 px-2 py-1 rounded text-sm">src/components/Assessment/AssessmentQuiz.tsx</code>.
                <br/><br/>
                To make changes:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-gray-400 ml-4">
                <li>Discuss the changes you want to make</li>
                <li>We'll update the question text, options, or scoring</li>
                <li>Adjust score categories and tier recommendations as needed</li>
                <li>Deploy changes to production</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
