'use client'

import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle,
  Circle,
  Clock,
  Lock,
  Play,
  RotateCcw
} from 'lucide-react'
import { visionMasterProgram } from '@/data/visionProtocols'

interface CompletedSession {
  week: number
  day: number
  sessionTitle: string
  completedAt: string
  localDate: string
}

interface LessonHistoryProps {
  enrollment: {
    startDate?: string
    currentWeek: number
    currentDay: number
  }
  completedSessions: CompletedSession[]
  onMakeUpLesson: (week: number, day: number, localDate?: string) => Promise<void>
  onStartSession: (week: number, day: number) => void
}

type LessonStatus = 'completed' | 'today' | 'missed' | 'upcoming'

interface LessonDay {
  week: number
  day: number
  title: string
  focus: string
  minutes: number
  exerciseCount: number
  localDate?: string
  status: LessonStatus
}

function keyFor(week: number, day: number) {
  return `${week}-${day}`
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function scheduledDate(startDate: string | undefined, week: number, day: number) {
  if (!startDate) return undefined
  const date = new Date(startDate)
  date.setDate(date.getDate() + (week - 1) * 7 + day - 1)
  return formatLocalDate(date)
}

function statusClasses(status: LessonStatus, selected: boolean) {
  const base = selected ? 'ring-2 ring-white/70 ' : ''
  if (status === 'completed') return `${base}bg-green-600/25 border-green-400/50 text-green-100`
  if (status === 'today') return `${base}bg-primary-600/30 border-primary-400/60 text-white`
  if (status === 'missed') return `${base}bg-yellow-600/20 border-yellow-400/40 text-yellow-100`
  return `${base}bg-gray-800/35 border-gray-600/30 text-gray-400`
}

function StatusIcon({ status }: { status: LessonStatus }) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-300" />
  if (status === 'today') return <Play className="w-4 h-4 text-primary-300" />
  if (status === 'missed') return <Clock className="w-4 h-4 text-yellow-300" />
  return <Lock className="w-4 h-4 text-gray-500" />
}

export default function LessonHistory({
  enrollment,
  completedSessions,
  onMakeUpLesson,
  onStartSession
}: LessonHistoryProps) {
  const [markingKey, setMarkingKey] = useState<string | null>(null)

  const completedMap = useMemo(() => {
    return new Map(completedSessions.map((session) => [keyFor(session.week, session.day), session]))
  }, [completedSessions])

  const currentOrdinal = (enrollment.currentWeek - 1) * 5 + Math.min(enrollment.currentDay, 5)

  const lessons = useMemo<LessonDay[]>(() => {
    return visionMasterProgram.weeklyPlans.flatMap((weekPlan) =>
      weekPlan.sessions.map((session) => {
        const key = keyFor(weekPlan.week, session.day)
        const ordinal = (weekPlan.week - 1) * 5 + session.day
        const completed = completedMap.has(key)
        const status: LessonStatus = completed
          ? 'completed'
          : ordinal === currentOrdinal
            ? 'today'
            : ordinal < currentOrdinal
              ? 'missed'
              : 'upcoming'

        return {
          week: weekPlan.week,
          day: session.day,
          title: session.title,
          focus: session.focus,
          minutes: session.baselineMinutes + session.exerciseMinutes,
          exerciseCount: session.exerciseIds.length,
          localDate: scheduledDate(enrollment.startDate, weekPlan.week, session.day),
          status
        }
      })
    )
  }, [completedMap, currentOrdinal, enrollment.startDate])

  const initialLesson = lessons.find((lesson) => lesson.status === 'missed')
    || lessons.find((lesson) => lesson.status === 'today')
    || lessons[0]
  const [selectedKey, setSelectedKey] = useState(() => initialLesson ? keyFor(initialLesson.week, initialLesson.day) : '')

  const selectedLesson = lessons.find((lesson) => keyFor(lesson.week, lesson.day) === selectedKey) || initialLesson
  const completedCount = lessons.filter((lesson) => lesson.status === 'completed').length
  const missedCount = lessons.filter((lesson) => lesson.status === 'missed').length
  const upcomingCount = lessons.filter((lesson) => lesson.status === 'upcoming').length

  const handleMakeUp = async (lesson: LessonDay) => {
    const key = keyFor(lesson.week, lesson.day)
    setMarkingKey(key)
    try {
      await onMakeUpLesson(lesson.week, lesson.day, lesson.localDate)
    } finally {
      setMarkingKey(null)
    }
  }

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary-400" />
            Lesson History
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Review completed, missed, and upcoming lessons across the 12-week plan.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-300"><CheckCircle className="w-3 h-3" />{completedCount}</span>
          <span className="flex items-center gap-1 text-yellow-300"><Clock className="w-3 h-3" />{missedCount}</span>
          <span className="flex items-center gap-1 text-gray-400"><Circle className="w-3 h-3" />{upcomingCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <div className="space-y-3">
          {visionMasterProgram.weeklyPlans.map((weekPlan) => (
            <div key={weekPlan.week} className="bg-gray-900/35 rounded-lg p-3 border border-gray-700/35">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white font-semibold text-sm">Week {weekPlan.week}</p>
                  <p className="text-xs text-gray-500">{weekPlan.title}</p>
                </div>
                <p className="text-xs text-primary-300">{weekPlan.phase}</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {lessons
                  .filter((lesson) => lesson.week === weekPlan.week)
                  .map((lesson) => {
                    const key = keyFor(lesson.week, lesson.day)
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedKey(key)}
                        className={`min-h-[52px] rounded-lg border p-2 text-left transition-all hover:border-white/40 ${statusClasses(lesson.status, selectedKey === key)}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">D{lesson.day}</span>
                          <StatusIcon status={lesson.status} />
                        </div>
                        <p className="text-[10px] mt-1 truncate" title={lesson.title}>{lesson.title}</p>
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        {selectedLesson && (
          <div className="bg-gray-900/45 rounded-xl p-4 border border-primary-400/20 h-fit sticky top-32">
            <div className="flex items-center gap-2 mb-3">
              <StatusIcon status={selectedLesson.status} />
              <span className="text-xs uppercase tracking-wide text-gray-400">
                Week {selectedLesson.week}, Day {selectedLesson.day}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{selectedLesson.title}</h3>
            <p className="text-sm text-gray-300 mb-3">{selectedLesson.focus}</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-white font-semibold">{selectedLesson.minutes} min</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Exercises</p>
                <p className="text-white font-semibold">{selectedLesson.exerciseCount}</p>
              </div>
            </div>

            {selectedLesson.localDate && (
              <p className="text-xs text-gray-500 mb-4">Scheduled: {selectedLesson.localDate}</p>
            )}

            {selectedLesson.status === 'completed' && (
              <div className="rounded-lg bg-green-600/15 border border-green-400/30 p-3 text-sm text-green-200">
                Completed{completedMap.get(keyFor(selectedLesson.week, selectedLesson.day))?.localDate
                  ? ` on ${completedMap.get(keyFor(selectedLesson.week, selectedLesson.day))?.localDate}`
                  : ''}
              </div>
            )}

            {selectedLesson.status === 'today' && (
              <button
                onClick={() => onStartSession(selectedLesson.week, selectedLesson.day)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start today's lesson
              </button>
            )}

            {selectedLesson.status === 'missed' && (
              <button
                onClick={() => handleMakeUp(selectedLesson)}
                disabled={markingKey === keyFor(selectedLesson.week, selectedLesson.day)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 text-white font-semibold py-3 transition-colors"
              >
                {markingKey === keyFor(selectedLesson.week, selectedLesson.day)
                  ? <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
                  : <RotateCcw className="w-4 h-4" />}
                Make up this lesson
              </button>
            )}

            {selectedLesson.status === 'upcoming' && (
              <div className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-3 text-sm text-gray-400">
                This lesson unlocks as the program calendar advances.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
