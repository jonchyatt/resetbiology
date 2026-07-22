'use client'

import { useEffect, useId, useState } from 'react'
import { TrendingUp, Eye, Calendar, Award, Activity } from 'lucide-react'

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

// ---- Measured Progress (W2.5) ----
// engineResults-derived trend series from GET /api/vision/progress `metricTrends`.
// Metrics are training-performance proxies, never clinical measurements (plan §4.9) —
// the only acuity language allowed here is around the user's own logged Snellen self-tests.
interface MetricPoint {
  date: string
  value: number
  exerciseId: string
}

interface SnellenPoint {
  date: string
  value: number
  raw: string
}

interface SessionScorePoint {
  date: string
  score: number
  week?: number
}

interface MetricTrendsResponse {
  snellenTrend?: { near: SnellenPoint[]; far: SnellenPoint[] }
  sessionScores?: SessionScorePoint[]
  [metricKey: string]: unknown
}

const PHASE_GATE_WEEKS = [2, 4, 6, 8, 10, 12]

const KNOWN_METRICS: Record<string, { label: string; unit: string; direction: 'higher' | 'lower' }> = {
  contrastThresholdPct: { label: 'Contrast Threshold', unit: '%', direction: 'lower' },
  accuracyPct: { label: 'Accuracy', unit: '%', direction: 'higher' },
  npcCm: { label: 'Near Point of Convergence', unit: 'cm', direction: 'lower' },
  peakBpm: { label: 'Peak Tempo Reached', unit: 'bpm', direction: 'higher' },
  tempoBpm: { label: 'Tempo Reached', unit: 'bpm', direction: 'higher' },
  smoothnessScore: { label: 'Tracking Smoothness', unit: 'pts', direction: 'higher' },
  meanReactionMs: { label: 'Reaction Time', unit: 'ms', direction: 'lower' },
  smallestClearLine: { label: 'Furthest Clear Line (Walks)', unit: 'lvl', direction: 'higher' },
  timeOnTargetPct: { label: 'Time On Target', unit: '%', direction: 'higher' },
  detectionPct: { label: 'Detection Rate', unit: '%', direction: 'higher' },
  fixationCompliancePct: { label: 'Fixation Compliance', unit: '%', direction: 'higher' },
  maxEccentricityRing: { label: 'Peripheral Range', unit: '%', direction: 'higher' },
  falsePositives: { label: 'False Positives', unit: '', direction: 'lower' },
  lateralityErrorRate: { label: 'Laterality Error Rate', unit: '%', direction: 'lower' },
  clearPct: { label: 'Clear Steps', unit: '%', direction: 'higher' },
  stepsCompleted: { label: 'Steps Completed', unit: '', direction: 'higher' },
  roundsCompleted: { label: 'Rounds Completed', unit: '', direction: 'higher' },
  repsCompleted: { label: 'Reps Completed', unit: '', direction: 'higher' },
  cyclesCompleted: { label: 'Breathing Cycles', unit: '', direction: 'higher' },
  expectedCycles: { label: 'Target Cycles', unit: '', direction: 'higher' },
  stagesCompleted: { label: 'Stages Completed', unit: '', direction: 'higher' },
}

// These fields prove the guided controller is behaving correctly, but they
// are protocol internals rather than member-facing progress. Preserve points
// from every other exercise when a shared metric such as accuracy is present.
const GABOR_INTERNAL_METRICS = new Set([
  'trials',
  'accuracyPct',
  'measurementAccuracyPct',
  'totalExposures',
  'localizationExposures',
  'scheduledExposures',
  'measurementResponses',
  'adaptiveTrials',
  'reversals',
  'thresholdValid',
  'easyTrials',
  'transferTrials',
  'flankerTrials',
  'catchTrials',
  'catchFalseAlarms',
  'lapses',
  'warmStarted',
  'protocolVersion',
  'anchorSpatialFrequencyCyclesPerPatch',
  'stopValid',
  'stopMeasurementCap',
  'stopExposureCap',
  'stopTimeCap',
])

function metricMeta(key: string): { label: string; unit: string; direction: 'higher' | 'lower' } {
  if (KNOWN_METRICS[key]) return KNOWN_METRICS[key]
  const lowerBetter = /reaction|error|latency|falsePositive/i.test(key)
  const unit = /Pct$/.test(key) ? '%' : /Ms$/.test(key) ? 'ms' : /Cm$/.test(key) ? 'cm' : /Bpm$/.test(key) ? 'bpm' : ''
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
  return { label, unit, direction: lowerBetter ? 'lower' : 'higher' }
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type TrendDirection = 'up' | 'down' | 'flat'

function trendDirection(values: number[]): TrendDirection {
  if (values.length < 2) return 'flat'
  const chunk = Math.max(1, Math.floor(values.length / 3))
  const early = values.slice(0, chunk).reduce((a, v) => a + v, 0) / chunk
  const recent = values.slice(-chunk).reduce((a, v) => a + v, 0) / chunk
  const delta = recent - early
  const threshold = Math.max(Math.abs(early) * 0.03, 0.01)
  if (Math.abs(delta) < threshold) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

function trendBadge(direction: TrendDirection, better: 'higher' | 'lower'): { label: string; color: string } {
  if (direction === 'flat') return { label: 'Holding steady', color: '#3FBFB5' }
  const improving = (direction === 'up' && better === 'higher') || (direction === 'down' && better === 'lower')
  if (improving) return { label: direction === 'up' ? 'Improving ↑' : 'Improving ↓', color: '#72C247' }
  return { label: direction === 'up' ? 'Trending up ↑' : 'Trending down ↓', color: '#fbbf24' }
}

/**
 * Self-contained inline SVG line/area sparkline. No chart library — responsive
 * width via viewBox + preserveAspectRatio, fixed logical height.
 */
function Sparkline({
  values,
  color,
  height = 120,
  milestoneIndices,
}: {
  values: number[]
  color: string
  height?: number
  milestoneIndices?: number[]
}) {
  const gradId = useId()
  const width = 300
  const padding = 8

  if (values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const flat = max === min
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0

  const coords = values.map((v, i) => {
    const x = padding + i * stepX
    const norm = flat ? 0.5 : (v - min) / (max - min)
    const y = height - padding - norm * (height - padding * 2)
    return [x, y] as const
  })

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${height - padding} L${coords[0][0].toFixed(1)},${height - padding} Z`
      : ''

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {milestoneIndices?.map((i) => {
        if (i < 0 || i >= coords.length) return null
        const x = coords[i][0]
        return (
          <line
            key={`milestone-${i}`}
            x1={x}
            x2={x}
            y1={0}
            y2={height}
            stroke="#9ca3af"
            strokeOpacity={0.3}
            strokeDasharray="2,3"
          />
        )
      })}
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 3.5 : 2} fill={color} />
      ))}
    </svg>
  )
}

function MetricCard({ metricKey, points }: { metricKey: string; points: MetricPoint[] }) {
  if (points.length === 0) return null
  const meta = metricMeta(metricKey)
  const values = points.map(p => p.value)
  const direction = trendDirection(values)
  const badge = trendBadge(direction, meta.direction)
  const last = points[points.length - 1]

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20">
      <div className="flex items-center justify-between mb-1 gap-2">
        <h5 className="text-white font-semibold text-sm">{meta.label}</h5>
        <span className="text-xs font-bold whitespace-nowrap" style={{ color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <p className="text-2xl font-bold text-white mb-2">
        {last.value}
        {meta.unit ? <span className="text-sm text-gray-400 ml-1">{meta.unit}</span> : null}
      </p>
      <Sparkline values={values} color={badge.color} height={90} />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{formatShortDate(points[0].date)}</span>
        <span>{formatShortDate(last.date)}</span>
      </div>
    </div>
  )
}

function SessionScoreChart({ points }: { points: SessionScorePoint[] }) {
  if (points.length === 0) return null
  const values = points.map(p => p.score)
  const direction = trendDirection(values)
  const badge = trendBadge(direction, 'higher')

  const milestoneIndices: number[] = []
  const seenWeeks = new Set<number>()
  points.forEach((p, i) => {
    if (p.week === undefined) return
    if (PHASE_GATE_WEEKS.includes(p.week) && !seenWeeks.has(p.week)) {
      seenWeeks.add(p.week)
      milestoneIndices.push(i)
    }
  })

  return (
    <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-primary-400/30 rounded-lg p-6 backdrop-blur-sm shadow-inner">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-400" />
          Session Score Trend
        </h4>
        <span className="text-xs font-bold whitespace-nowrap" style={{ color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <p className="text-gray-400 text-xs mb-3">
        Guided-session performance score over time. Dashed lines mark 2-week phase gates.
      </p>
      <Sparkline values={values} color={badge.color} height={120} milestoneIndices={milestoneIndices} />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{formatShortDate(points[0].date)}</span>
        <span>{formatShortDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}

function SnellenTrendCard({ title, points }: { title: string; points: SnellenPoint[] }) {
  if (points.length === 0) return null
  const values = points.map(p => p.value)
  // Smaller denominator ("20/20" beats "20/40") = better, so this is lower-better.
  const direction = trendDirection(values)
  const badge = trendBadge(direction, 'lower')
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20">
      <div className="flex items-center justify-between mb-1 gap-2">
        <h5 className="text-white font-semibold text-sm">{title} Self-Test Trend</h5>
        <span className="text-xs font-bold whitespace-nowrap" style={{ color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <p className="text-gray-400 text-xs mb-2">
        Started {first.raw} → Now {last.raw} (your own logged Snellen self-tests)
      </p>
      <Sparkline values={values} color={badge.color} height={90} />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{formatShortDate(first.date)}</span>
        <span>{formatShortDate(last.date)}</span>
      </div>
    </div>
  )
}

export default function ProgressDashboard() {
  const [progress, setProgress] = useState<VisionProgress[]>([])
  const [recentSessions, setRecentSessions] = useState<VisionSession[]>([])
  const [weeklyStats, setWeeklyStats] = useState({
    sessionsThisWeek: 0,
    avgAccuracyThisWeek: 0,
    successRateThisWeek: 0
  })
  const [metricTrends, setMetricTrends] = useState<MetricTrendsResponse | null>(null)
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
        setMetricTrends(data.metricTrends || null)
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const nearProgress = progress.find(p => p.visionType === 'near')
  const farProgress = progress.find(p => p.visionType === 'far')

  const metricEntries: [string, MetricPoint[]][] = metricTrends
    ? Object.entries(metricTrends).flatMap(([key, value]) => {
        if (key === 'snellenTrend' || key === 'sessionScores' || !Array.isArray(value)) return []
        const points = value as MetricPoint[]
        const publicPoints = GABOR_INTERNAL_METRICS.has(key)
          ? points.filter(point => point.exerciseId !== 'gabor-contrast')
          : points
        return publicPoints.length > 0 ? [[key, publicPoints] as [string, MetricPoint[]]] : []
      })
    : []
  const sessionScorePoints = metricTrends?.sessionScores ?? []
  const nearSnellenTrend = metricTrends?.snellenTrend?.near ?? []
  const farSnellenTrend = metricTrends?.snellenTrend?.far ?? []
  const hasMeasuredProgress =
    metricEntries.length > 0 || sessionScorePoints.length > 0 || nearSnellenTrend.length > 0 || farSnellenTrend.length > 0

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

      {/* Measured Progress (W2.5) — guided-session trend lines, additive */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary-400" />
          Measured Progress
        </h3>

        {!hasMeasuredProgress ? (
          <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-8 shadow-inner text-center">
            <p className="text-gray-400 text-sm">
              Run guided sessions to start building your progress picture.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessionScorePoints.length > 0 && <SessionScoreChart points={sessionScorePoints} />}

            {(nearSnellenTrend.length > 0 || farSnellenTrend.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SnellenTrendCard title="Near Vision" points={nearSnellenTrend} />
                <SnellenTrendCard title="Far Vision" points={farSnellenTrend} />
              </div>
            )}

            {metricEntries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metricEntries.map(([key, points]) => (
                  <MetricCard key={key} metricKey={key} points={points} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
