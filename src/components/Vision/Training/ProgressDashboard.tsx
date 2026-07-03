'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { TrendingUp, Eye, Calendar, Award, Activity, BarChart3 } from 'lucide-react'

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

interface SnellenTrendPoint {
  x: number
  week: number | null
  day: number | null
  date: string
  denominator: number
  display: string
  label: string
  baseline?: boolean
}

interface AccuracyTrendPoint {
  x: number
  week: number | null
  date: string
  label: string
  accuracy: number
  visionType: string
  exerciseType: string
}

interface WeeklyMinutesTrend {
  week: number
  baselineMinutes: number
  exerciseMinutes: number
  totalMinutes: number
  sessions: number
}

interface TrendData {
  phaseBoundaries: number[]
  snellen: {
    near: SnellenTrendPoint[]
    far: SnellenTrendPoint[]
  }
  accuracy: AccuracyTrendPoint[]
  weeklyMinutes: WeeklyMinutesTrend[]
}

interface ChartPoint {
  x: number
  value: number
  label: string
  display: string
  baseline?: boolean
}

interface ChartSeries {
  label: string
  color: string
  points: ChartPoint[]
}

const DEFAULT_TREND_DATA: TrendData = {
  phaseBoundaries: [2, 4, 6, 8, 10],
  snellen: {
    near: [],
    far: []
  },
  accuracy: [],
  weeklyMinutes: []
}

const CHART = {
  width: 720,
  height: 260,
  top: 22,
  right: 20,
  bottom: 36,
  left: 52
}

function getYRange(values: number[], fallbackMin: number, fallbackMax: number) {
  if (values.length === 0) return { min: fallbackMin, max: fallbackMax }

  const minValue = Math.min(...values, fallbackMin)
  const maxValue = Math.max(...values, fallbackMax)
  if (minValue === maxValue) {
    return {
      min: Math.max(0, minValue - 1),
      max: maxValue + 1
    }
  }

  return {
    min: minValue,
    max: maxValue
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ChartFrame({
  title,
  icon,
  children,
  legend
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  legend?: ReactNode
}) {
  return (
    <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-5 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h4 className="text-lg font-bold text-white flex items-center gap-2">
          {icon}
          {title}
        </h4>
        {legend}
      </div>
      {children}
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="min-h-[220px] rounded-lg border border-dashed border-gray-700 bg-gray-950/30 flex items-center justify-center px-6 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

function LineTrendChart({
  title,
  icon,
  series,
  phaseBoundaries,
  emptyMessage,
  yFormatter,
  fallbackMin,
  fallbackMax,
  lowerIsBetter = false
}: {
  title: string
  icon: ReactNode
  series: ChartSeries[]
  phaseBoundaries: number[]
  emptyMessage: string
  yFormatter: (value: number) => string
  fallbackMin: number
  fallbackMax: number
  lowerIsBetter?: boolean
}) {
  const allPoints = series.flatMap(item => item.points)
  const values = allPoints.map(point => point.value)
  const hasData = allPoints.length > 0
  const yRange = getYRange(values, fallbackMin, fallbackMax)
  const innerWidth = CHART.width - CHART.left - CHART.right
  const innerHeight = CHART.height - CHART.top - CHART.bottom
  const toX = (x: number) => CHART.left + (Math.max(0, Math.min(12, x)) / 12) * innerWidth
  const toY = (value: number) => {
    const ratio = (value - yRange.min) / (yRange.max - yRange.min || 1)
    return lowerIsBetter
      ? CHART.top + ratio * innerHeight
      : CHART.top + (1 - ratio) * innerHeight
  }
  const ticks = [yRange.min, (yRange.min + yRange.max) / 2, yRange.max]

  return (
    <ChartFrame
      title={title}
      icon={icon}
      legend={
        <div className="flex flex-wrap gap-3 text-xs">
          {series.map(item => (
            <span key={item.label} className="flex items-center gap-1 text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      }
    >
      {!hasData ? (
        <EmptyChart message={emptyMessage} />
      ) : (
        <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="w-full h-auto" role="img" aria-label={title}>
          <rect x="0" y="0" width={CHART.width} height={CHART.height} rx="8" fill="rgba(17,24,39,0.35)" />
          {ticks.map(tick => (
            <g key={tick}>
              <line
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={toY(tick)}
                y2={toY(tick)}
                stroke="rgba(75,85,99,0.45)"
                strokeDasharray="4 4"
              />
              <text x={CHART.left - 10} y={toY(tick) + 4} textAnchor="end" className="fill-gray-400 text-[11px]">
                {yFormatter(tick)}
              </text>
            </g>
          ))}
          {phaseBoundaries.map(week => (
            <g key={week}>
              <line
                x1={toX(week)}
                x2={toX(week)}
                y1={CHART.top}
                y2={CHART.height - CHART.bottom}
                stroke="rgba(251,191,36,0.55)"
                strokeDasharray="3 5"
              />
              <text x={toX(week) + 4} y={CHART.top + 12} className="fill-yellow-300 text-[10px]">
                W{week}
              </text>
            </g>
          ))}
          <line x1={CHART.left} x2={CHART.width - CHART.right} y1={CHART.height - CHART.bottom} y2={CHART.height - CHART.bottom} stroke="rgba(156,163,175,0.45)" />
          <text x={CHART.left} y={CHART.height - 10} className="fill-gray-400 text-[11px]">Baseline</text>
          <text x={CHART.width - CHART.right} y={CHART.height - 10} textAnchor="end" className="fill-gray-400 text-[11px]">Week 12</text>

          {series.map(item => {
            const sortedPoints = [...item.points].sort((a, b) => a.x - b.x)
            const path = sortedPoints
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.x)} ${toY(point.value)}`)
              .join(' ')

            return (
              <g key={item.label}>
                {sortedPoints.length > 1 && (
                  <path d={path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {sortedPoints.map((point, index) => (
                  <g key={`${item.label}-${point.label}-${index}`}>
                    <circle
                      cx={toX(point.x)}
                      cy={toY(point.value)}
                      r={point.baseline ? 6 : 4}
                      fill={point.baseline ? '#111827' : item.color}
                      stroke={item.color}
                      strokeWidth={point.baseline ? 3 : 2}
                    >
                      <title>{`${item.label} ${point.label}: ${point.display}`}</title>
                    </circle>
                    {point.baseline && (
                      <text x={toX(point.x) + 8} y={toY(point.value) - 8} className="fill-gray-300 text-[10px]">
                        Baseline
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )
          })}
        </svg>
      )}
    </ChartFrame>
  )
}

function WeeklyMinutesChart({
  data,
  phaseBoundaries
}: {
  data: WeeklyMinutesTrend[]
  phaseBoundaries: number[]
}) {
  const hasData = data.some(item => item.totalMinutes > 0 || item.exerciseMinutes > 0)
  const maxMinutes = Math.max(20, ...data.map(item => item.totalMinutes))
  const innerWidth = CHART.width - CHART.left - CHART.right
  const innerHeight = CHART.height - CHART.top - CHART.bottom
  const toX = (week: number) => CHART.left + ((week - 0.5) / 12) * innerWidth
  const boundaryX = (week: number) => CHART.left + (week / 12) * innerWidth
  const toY = (value: number) => CHART.top + (1 - value / maxMinutes) * innerHeight
  const barWidth = innerWidth / 12 * 0.55
  const ticks = [0, maxMinutes / 2, maxMinutes]

  return (
    <ChartFrame
      title="Weekly Practice Minutes"
      icon={<BarChart3 className="w-5 h-5 text-secondary-400" />}
      legend={
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1 text-gray-300">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary-400" />
            Exercise
          </span>
          <span className="flex items-center gap-1 text-gray-300">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-400" />
            Baseline
          </span>
        </div>
      }
    >
      {!hasData ? (
        <EmptyChart message="Weekly minutes will appear after daily program sessions are completed." />
      ) : (
        <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="w-full h-auto" role="img" aria-label="Weekly practice minutes">
          <rect x="0" y="0" width={CHART.width} height={CHART.height} rx="8" fill="rgba(17,24,39,0.35)" />
          {ticks.map(tick => (
            <g key={tick}>
              <line
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={toY(tick)}
                y2={toY(tick)}
                stroke="rgba(75,85,99,0.45)"
                strokeDasharray="4 4"
              />
              <text x={CHART.left - 10} y={toY(tick) + 4} textAnchor="end" className="fill-gray-400 text-[11px]">
                {Math.round(tick)}
              </text>
            </g>
          ))}
          {phaseBoundaries.map(week => (
            <g key={week}>
              <line
                x1={boundaryX(week)}
                x2={boundaryX(week)}
                y1={CHART.top}
                y2={CHART.height - CHART.bottom}
                stroke="rgba(251,191,36,0.55)"
                strokeDasharray="3 5"
              />
              <text x={boundaryX(week) + 4} y={CHART.top + 12} className="fill-yellow-300 text-[10px]">
                W{week}
              </text>
            </g>
          ))}
          <line x1={CHART.left} x2={CHART.width - CHART.right} y1={CHART.height - CHART.bottom} y2={CHART.height - CHART.bottom} stroke="rgba(156,163,175,0.45)" />
          {data.map(item => {
            const exerciseTop = toY(item.exerciseMinutes)
            const baselineTop = toY(item.exerciseMinutes + item.baselineMinutes)
            const baseY = CHART.height - CHART.bottom
            const x = toX(item.week) - barWidth / 2

            return (
              <g key={item.week}>
                {item.exerciseMinutes > 0 && (
                  <rect
                    x={x}
                    y={exerciseTop}
                    width={barWidth}
                    height={baseY - exerciseTop}
                    rx="4"
                    fill="#34d399"
                  >
                    <title>{`Week ${item.week}: ${item.exerciseMinutes} exercise minutes`}</title>
                  </rect>
                )}
                {item.baselineMinutes > 0 && (
                  <rect
                    x={x}
                    y={baselineTop}
                    width={barWidth}
                    height={exerciseTop - baselineTop}
                    rx="4"
                    fill="#38bdf8"
                  >
                    <title>{`Week ${item.week}: ${item.baselineMinutes} baseline minutes`}</title>
                  </rect>
                )}
                <text x={toX(item.week)} y={CHART.height - 10} textAnchor="middle" className="fill-gray-400 text-[10px]">
                  {item.week}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </ChartFrame>
  )
}

export default function ProgressDashboard() {
  const [progress, setProgress] = useState<VisionProgress[]>([])
  const [recentSessions, setRecentSessions] = useState<VisionSession[]>([])
  const [trendData, setTrendData] = useState<TrendData>(DEFAULT_TREND_DATA)
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
        setTrendData(data.trendData || DEFAULT_TREND_DATA)
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
  const snellenSeries: ChartSeries[] = [
    {
      label: 'Near',
      color: '#38bdf8',
      points: trendData.snellen.near.map(point => ({
        x: point.x,
        value: point.denominator,
        label: point.label,
        display: point.display,
        baseline: point.baseline
      }))
    },
    {
      label: 'Far',
      color: '#a78bfa',
      points: trendData.snellen.far.map(point => ({
        x: point.x,
        value: point.denominator,
        label: point.label,
        display: point.display,
        baseline: point.baseline
      }))
    }
  ]
  const accuracySeries: ChartSeries[] = [
    {
      label: 'Near',
      color: '#2dd4bf',
      points: trendData.accuracy
        .filter(point => point.visionType === 'near')
        .map(point => ({
          x: point.x,
          value: point.accuracy,
          label: `${point.label} ${formatDate(point.date)}`,
          display: `${point.accuracy.toFixed(0)}%`
        }))
    },
    {
      label: 'Far',
      color: '#f59e0b',
      points: trendData.accuracy
        .filter(point => point.visionType === 'far')
        .map(point => ({
          x: point.x,
          value: point.accuracy,
          label: `${point.label} ${formatDate(point.date)}`,
          display: `${point.accuracy.toFixed(0)}%`
        }))
    },
    {
      label: 'Daily',
      color: '#f472b6',
      points: trendData.accuracy
        .filter(point => point.visionType === 'daily')
        .map(point => ({
          x: point.x,
          value: point.accuracy,
          label: `${point.label} ${formatDate(point.date)}`,
          display: `${point.accuracy.toFixed(0)}%`
        }))
    }
  ]

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

      {/* Trend charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LineTrendChart
          title="Snellen Acuity Trend"
          icon={<Eye className="w-5 h-5 text-primary-400" />}
          series={snellenSeries}
          phaseBoundaries={trendData.phaseBoundaries}
          emptyMessage="Snellen trends will appear after a baseline or daily Snellen result is recorded."
          yFormatter={(value) => `20/${Math.round(value)}`}
          fallbackMin={15}
          fallbackMax={80}
          lowerIsBetter
        />
        <LineTrendChart
          title="Session Accuracy Trend"
          icon={<Activity className="w-5 h-5 text-secondary-400" />}
          series={accuracySeries}
          phaseBoundaries={trendData.phaseBoundaries}
          emptyMessage="Accuracy trends will appear after focus-training sessions are recorded."
          yFormatter={(value) => `${Math.round(value)}%`}
          fallbackMin={0}
          fallbackMax={100}
        />
        <div className="xl:col-span-2">
          <WeeklyMinutesChart
            data={trendData.weeklyMinutes}
            phaseBoundaries={trendData.phaseBoundaries}
          />
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
                    {new Date(session.createdAt).toLocaleString()} - {
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
          <p className="text-gray-400 text-sm">No training sessions yet. Start training to see your progress.</p>
        )}
      </div>
    </div>
  )
}
