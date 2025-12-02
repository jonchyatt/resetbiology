"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Users, DollarSign, Calendar, Save } from "lucide-react"
import { AssessmentConfig, AssessmentQuestionOption, defaultAssessmentConfig } from "@/config/assessmentConfig"

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
  multiSelect?: boolean
  maxMultiSelect?: number
}

// All 19 questions from AssessmentQuiz.tsx
export default function AssessmentsAdminPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"submissions" | "questions">("submissions")
  const [config, setConfig] = useState<AssessmentConfig>(defaultAssessmentConfig)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    const bootstrap = async () => {
      await Promise.all([fetchAssessments(), fetchConfig()])
      setLoading(false)
    }
    bootstrap()
  }, [])

  const fetchAssessments = async () => {
    try {
      // TODO: Create GET endpoint that returns all assessments (admin only)
      // For now, using placeholder data
    } catch (error) {
      console.error('Failed to fetch assessments:', error)
    }
  }

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/assessment-config', { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as AssessmentConfig
        setConfig(data)
      }
    } catch (error) {
      console.error('Failed to load assessment config', error)
      setConfig(defaultAssessmentConfig)
    }
  }

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    setConfig(prev => {
      const next = [...prev.questions]
      next[index] = { ...next[index], ...updates }
      return { ...prev, questions: next }
    })
  }

  const updateOption = (qIdx: number, optIdx: number, updates: Partial<AssessmentQuestionOption>) => {
    setConfig(prev => {
      const nextQuestions = [...prev.questions]
      const opts = [...(nextQuestions[qIdx].options || [])]
      opts[optIdx] = { ...opts[optIdx], ...updates }
      nextQuestions[qIdx] = { ...nextQuestions[qIdx], options: opts }
      return { ...prev, questions: nextQuestions }
    })
  }

  const addOption = (qIdx: number) => {
    setConfig(prev => {
      const nextQuestions = [...prev.questions]
      const opts = [...(nextQuestions[qIdx].options || [])]
      opts.push({ value: `option-${Date.now()}`, label: "New option", score: 0 })
      nextQuestions[qIdx] = { ...nextQuestions[qIdx], options: opts }
      return { ...prev, questions: nextQuestions }
    })
  }

  const updateOffer = (offerIdx: number, field: keyof AssessmentConfig["resultsOffer"]["offers"][0], value: string | string[]) => {
    setConfig(prev => {
      const offers = [...prev.resultsOffer.offers]
      const existing = offers[offerIdx]
      offers[offerIdx] = { ...existing, [field]: value }
      return { ...prev, resultsOffer: { ...prev.resultsOffer, offers } }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/admin/assessment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.ok) {
        const saved = (await res.json()) as AssessmentConfig
        setConfig(saved)
        setSaveMessage("Saved.")
      } else {
        setSaveMessage("Save failed.")
      }
    } catch (error) {
      console.error('Failed to save config', error)
      setSaveMessage("Save failed.")
    } finally {
      setSaving(false)
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Assessment Builder</h2>
                <p className="text-gray-400">Edit lead page copy, quiz questions, and trial offers.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Last saved: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "Not saved yet"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {saveMessage && <span className="text-sm text-gray-300">{saveMessage}</span>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all ${
                    saving ? 'bg-gray-700 text-gray-400' : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
                <h3 className="text-xl font-bold text-white">Lead Page Copy</h3>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Headline</label>
                  <textarea
                    value={config.landing.headline}
                    onChange={(e) => setConfig(prev => ({ ...prev, landing: { ...prev.landing, headline: e.target.value } }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Subheadline</label>
                  <textarea
                    value={config.landing.subheadline}
                    onChange={(e) => setConfig(prev => ({ ...prev, landing: { ...prev.landing, subheadline: e.target.value } }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Supporting points (one per line)</label>
                  <textarea
                    value={config.landing.supportingPoints.join("\n")}
                    onChange={(e) => setConfig(prev => ({ ...prev, landing: { ...prev.landing, supportingPoints: e.target.value.split("\n") } }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    rows={3}
                  />
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 rounded-xl border border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-white mb-3">Lead Preview</h4>
                <div className="space-y-3">
                  <p className="text-2xl font-bold text-white leading-tight">{config.landing.headline}</p>
                  <p className="text-gray-300">{config.landing.subheadline}</p>
                  <ul className="space-y-2 mt-3">
                    {config.landing.supportingPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-300">
                        <span className="text-primary-400 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Questions & Scoring</h3>
                  <p className="text-gray-400 text-sm">Toggle required, edit copy, options, and scores.</p>
                </div>
              </div>

              {config.questions.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-sm font-semibold">Q{idx + 1}</span>
                      <span className="text-xs bg-gray-700 text-gray-200 px-2 py-1 rounded">{q.type}</span>
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={!!q.required}
                          onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                        />
                        Required
                      </label>
                      {q.type === "choice" && (
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={!!q.multiSelect}
                            onChange={(e) => updateQuestion(idx, { multiSelect: e.target.checked })}
                          />
                          Multi-select (cap {q.maxMultiSelect || 4})
                        </label>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{q.id}</span>
                  </div>

                  <input
                    value={q.question}
                    onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                  <input
                    value={q.subtitle || ""}
                    onChange={(e) => updateQuestion(idx, { subtitle: e.target.value })}
                    placeholder="Subtitle (optional)"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />

                  {q.type === "choice" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-gray-400 text-sm">Options {q.multiSelect ? `(scores weighted, max ${q.maxMultiSelect || 4})` : ''}</p>
                        {q.multiSelect && (
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={q.maxMultiSelect || 4}
                            onChange={(e) => updateQuestion(idx, { maxMultiSelect: parseInt(e.target.value) || 4 })}
                            className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        {q.options?.map((opt, optIdx) => (
                          <div key={opt.value} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-gray-800/60 border border-gray-700 rounded-lg p-2">
                            <input
                              value={opt.label}
                              onChange={(e) => updateOption(idx, optIdx, { label: e.target.value })}
                              className="md:col-span-6 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                            />
                            <input
                              value={opt.value}
                              onChange={(e) => updateOption(idx, optIdx, { value: e.target.value })}
                              className="md:col-span-4 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                            />
                            <input
                              type="number"
                              value={opt.score ?? 0}
                              onChange={(e) => updateOption(idx, optIdx, { score: parseInt(e.target.value) || 0 })}
                              className="md:col-span-2 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => addOption(idx)}
                          className="text-primary-300 text-sm font-semibold hover:text-primary-200"
                        >
                          + Add option
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white">Results / Offer Section</h3>
                  <p className="text-gray-400 text-sm">Control the trial offers shown after the quiz.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {config.resultsOffer.offers.map((offer, idx) => (
                  <div key={offer.id} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-2">
                    <input
                      value={offer.title}
                      onChange={(e) => updateOffer(idx, "title", e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    />
                    <input
                      value={offer.subtitle || ""}
                      onChange={(e) => updateOffer(idx, "subtitle", e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                      placeholder="Subtitle"
                    />
                    <textarea
                      value={(offer.bullets || []).join("\n")}
                      onChange={(e) => updateOffer(idx, "bullets", e.target.value.split("\n"))}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                      rows={3}
                      placeholder="Bullets (one per line)"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={offer.ctaText}
                        onChange={(e) => updateOffer(idx, "ctaText", e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        placeholder="CTA text"
                      />
                      <input
                        value={offer.ctaLink}
                        onChange={(e) => updateOffer(idx, "ctaLink", e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        placeholder="CTA link"
                      />
                    </div>
                    <input
                      value={offer.badge || ""}
                      onChange={(e) => updateOffer(idx, "badge", e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm w-full"
                      placeholder="Badge (optional)"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
