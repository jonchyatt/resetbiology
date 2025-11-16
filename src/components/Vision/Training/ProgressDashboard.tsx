'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Eye, Calendar, Award } from 'lucide-react'

interface VisionProgress {
  id: string
  visionType: string
  currentLevel: number
  maxDistanceCm: number
  lastSessionDate: string
  totalSessions: number
}

interface VisionSession {
  id: string
  visionType: string
  exerciseType: string
  distanceCm: number
  accuracy: number
  chartSize: string
  duration: number
  success: boolean
  createdAt: string
}

export default function ProgressDashboard() {
  const [progress, setProgress] = useState<VisionProgress[]>([])
  const [recentSessions, setRecentSessions] = useState<VisionSession[]>([])
  const [weeklyStats, setWeeklyStats] = useState({
    sessionsThisWeek: 0,
    avgAccuracyThisWeek: 0,
    successRateThisWeek: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProgress()
  }, [])

  const loadProgress = async () => {
    try {
      const response = await fetch('/api/vision/progress')
      const data = await response.json()

      if (data.success) {
        setProgress(data.progress || [])
        setRecentSessions(data.recentSessions || [])
        setWeeklyStats(data.weeklyStats || {
          sessionsThisWeek: 0,
          avgAccuracyThisWeek: 0,
          successRateThisWeek: 0
        })
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const nearProgress = progress.find(p => p.visionType === 'near')
  const farProgress = progress.find(p => p.visionType === 'far')

  if (loading) {
    return (
      <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-8 shadow-inner text-center">
        <p className="text-gray-400">Loading progress...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Weekly overview */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-primary-400/30 rounded-lg p-6 backdrop-blur-sm shadow-inner">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary-400" />
          This Week's Progress
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900/40 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Sessions Completed</p>
            <p className="text-3xl font-bold text-white">{weeklyStats.sessionsThisWeek}</p>
          </div>
          <div className="bg-gray-900/40 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Average Accuracy</p>
            <p className="text-3xl font-bold text-secondary-400">
              {weeklyStats.avgAccuracyThisWeek.toFixed(0)}%
            </p>
          </div>
          <div className="bg-gray-900/40 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Success Rate</p>
            <p className="text-3xl font-bold text-primary-400">
              {weeklyStats.successRateThisWeek.toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Vision type progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Near vision */}
        <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-6 shadow-inner">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-primary-400" />
            <h4 className="text-lg font-bold text-white">Near Vision</h4>
          </div>
          {nearProgress ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Level:</span>
                <span className="text-white font-bold text-xl">
                  Level {nearProgress.currentLevel}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Best Distance:</span>
                <span className="text-secondary-400 font-semibold">
                  {nearProgress.maxDistanceCm} cm
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Sessions:</span>
                <span className="text-white font-semibold">
                  {nearProgress.totalSessions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Last Session:</span>
                <span className="text-gray-300 text-sm">
                  {new Date(nearProgress.lastSessionDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No near vision training yet</p>
          )}
        </div>

        {/* Far vision */}
        <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-6 shadow-inner">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-secondary-400" />
            <h4 className="text-lg font-bold text-white">Far Vision</h4>
          </div>
          {farProgress ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Level:</span>
                <span className="text-white font-bold text-xl">
                  Level {farProgress.currentLevel}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Best Distance:</span>
                <span className="text-secondary-400 font-semibold">
                  {(farProgress.maxDistanceCm / 100).toFixed(1)} m
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Sessions:</span>
                <span className="text-white font-semibold">
                  {farProgress.totalSessions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Last Session:</span>
                <span className="text-gray-300 text-sm">
                  {new Date(farProgress.lastSessionDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No far vision training yet</p>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-6 shadow-inner">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-400" />
          Recent Sessions
        </h4>
        {recentSessions.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentSessions.slice(0, 10).map((session) => (
              <div
                key={session.id}
                className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      session.visionType === 'near'
                        ? 'bg-primary-500/20 text-primary-300'
                        : 'bg-secondary-500/20 text-secondary-300'
                    }`}>
                      {session.visionType}
                    </span>
                    <span className="text-white font-semibold text-sm">
                      {session.chartSize}
                    </span>
                    {session.success && (
                      <Award className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(session.createdAt).toLocaleString()} • {
                      session.visionType === 'near'
                        ? `${session.distanceCm} cm`
                        : `${(session.distanceCm / 100).toFixed(1)} m`
                    }
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    session.accuracy >= 80 ? 'text-secondary-400' : 'text-yellow-400'
                  }`}>
                    {session.accuracy.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-400">
                    {Math.floor(session.duration / 60)}:{(session.duration % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No training sessions yet. Start training to see your progress!</p>
        )}
      </div>
    </div>
  )
}
