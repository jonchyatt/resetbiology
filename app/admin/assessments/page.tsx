"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Users, DollarSign, Calendar } from "lucide-react"

export default function AssessmentsAdminPage() {
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")

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
            View and manage cellular weight loss assessment submissions
          </p>
        </div>

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

        {/* Implementation Note */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            📊 Next Steps for Full Dashboard
          </h3>
          <div className="text-gray-300 space-y-2">
            <p>To complete this admin dashboard:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Create GET endpoint at /api/assessment/list (admin auth required)</li>
              <li>Add pagination for large datasets</li>
              <li>Add export to CSV functionality</li>
              <li>Add email/CRM integration hooks</li>
              <li>Add detailed view modal for each submission</li>
              <li>Add filtering by date range, score, and tier</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
