"use client"

import { motion } from "framer-motion"
import { BreathState, CycleData, BreathSettings } from "@/types/breath"

interface SessionStatsProps {
  state: BreathState
  currentCycle: number
  breathCount: number
  currentHoldDuration: number
  bestExhaleHold: number
  bestInhaleHold: number
  settings: BreathSettings
  cycles: CycleData[]
}

export function SessionStats({
  state,
  currentCycle,
  breathCount,
  currentHoldDuration,
  bestExhaleHold,
  bestInhaleHold,
  settings,
  cycles
}: SessionStatsProps) {
  
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  const isBreathingPhase = state === 'breathing_active'
  const isHoldPhase = state === 'exhale_hold_active' || state === 'inhale_hold_active'

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Session Overview - Professional Dark Theme */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-primary-600/20 to-primary-700/30 backdrop-blur-sm rounded-xl p-5 text-center border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300"
        >
          <div className="text-3xl font-bold text-primary-300 mb-1">{currentCycle}</div>
          <div className="text-sm font-semibold text-white mb-1">Cycle</div>
          <div className="text-xs text-gray-300">of {settings.cyclesTarget}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-blue-600/20 to-blue-700/30 backdrop-blur-sm rounded-xl p-5 text-center border border-blue-400/30 shadow-2xl hover:shadow-blue-400/20 transition-all duration-300"
        >
          <div className="text-3xl font-bold text-blue-300 mb-1">{breathCount}</div>
          <div className="text-sm font-semibold text-white mb-1">Breaths</div>
          <div className="text-xs text-gray-300">of {settings.breathsPerCycle}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-amber-600/20 to-amber-700/30 backdrop-blur-sm rounded-xl p-5 text-center border border-amber-400/30 shadow-2xl hover:shadow-amber-400/20 transition-all duration-300"
        >
          <div className="text-2xl font-bold text-amber-300 mb-1">{formatDuration(bestExhaleHold)}</div>
          <div className="text-sm font-semibold text-white mb-1">Best Exhale</div>
          <div className="text-xs text-gray-300">Hold</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-green-600/20 to-green-700/30 backdrop-blur-sm rounded-xl p-5 text-center border border-green-400/30 shadow-2xl hover:shadow-green-400/20 transition-all duration-300"
        >
          <div className="text-2xl font-bold text-green-300 mb-1">{formatDuration(bestInhaleHold)}</div>
          <div className="text-sm font-semibold text-white mb-1">Best Inhale</div>
          <div className="text-xs text-gray-300">Hold</div>
        </motion.div>
      </div>

      {/* Current Phase Info - Enhanced Professional Design */}
      {(isBreathingPhase || isHoldPhase) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-800/60 to-gray-900/70 backdrop-blur-md rounded-2xl p-8 mb-8 border border-gray-600/30 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle background glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-secondary-500/5 rounded-2xl" />
          
          {isBreathingPhase && (
            <div className="text-center relative z-10">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50" />
                <h3 className="text-2xl font-bold text-blue-300 drop-shadow-lg">Breathing Phase</h3>
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50" />
              </div>
              <div className="text-5xl font-bold text-white mb-4 font-mono tracking-wider drop-shadow-xl">
                {breathCount} / {settings.breathsPerCycle}
              </div>
              <div className="text-lg text-gray-300 mb-6 font-medium">
                Pace: <span className="text-blue-300">{settings.pace.label}</span> • {settings.pace.inhaleMs/1000}s in • {settings.pace.exhaleMs/1000}s out
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-3 backdrop-blur-sm border border-gray-600/30 shadow-inner">
                <motion.div 
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full shadow-lg shadow-blue-500/30"
                  initial={{ width: 0 }}
                  animate={{ width: `${(breathCount / settings.breathsPerCycle) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {isHoldPhase && (
            <div className="text-center relative z-10">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full animate-pulse shadow-lg ${
                  state === 'exhale_hold_active' 
                    ? 'bg-amber-400 shadow-amber-400/50' 
                    : 'bg-green-400 shadow-green-400/50'
                }`} />
                <h3 className={`text-2xl font-bold drop-shadow-lg ${
                  state === 'exhale_hold_active' ? 'text-amber-300' : 'text-green-300'
                }`}>
                  {state === 'exhale_hold_active' ? 'Exhale Hold' : 'Inhale Hold'}
                </h3>
                <div className={`w-3 h-3 rounded-full animate-pulse shadow-lg ${
                  state === 'exhale_hold_active' 
                    ? 'bg-amber-400 shadow-amber-400/50' 
                    : 'bg-green-400 shadow-green-400/50'
                }`} />
              </div>
              <div className="text-6xl font-bold text-white mb-4 font-mono tracking-wider drop-shadow-xl">
                {formatDuration(currentHoldDuration)}
              </div>
              <div className="text-lg text-gray-300 font-medium">
                Current hold duration
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Completed Cycles Summary - Enhanced Professional Design */}
      {cycles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-gray-800/60 to-gray-900/70 backdrop-blur-md rounded-2xl p-8 border border-gray-600/30 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle background glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-2xl" />
          
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-white mb-6 text-center drop-shadow-lg">Completed Cycles</h3>
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600/50">
                    <th className="text-left py-4 px-3 font-semibold text-gray-300">Cycle</th>
                    <th className="text-left py-4 px-3 font-semibold text-gray-300">Breaths</th>
                    <th className="text-left py-4 px-3 font-semibold text-gray-300">Breathing Time</th>
                    <th className="text-left py-4 px-3 font-semibold text-gray-300">Exhale Hold</th>
                    <th className="text-left py-4 px-3 font-semibold text-gray-300">Inhale Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle, index) => (
                    <tr key={index} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors duration-200">
                      <td className="py-4 px-3 font-bold text-white">{cycle.cycleIndex}</td>
                      <td className="py-4 px-3 text-blue-300 font-medium">{cycle.breathing.actualBreaths}</td>
                      <td className="py-4 px-3 text-gray-200">{formatDuration(cycle.breathing.actualDurationMs)}</td>
                      <td className="py-4 px-3 text-amber-400 font-bold">{formatDuration(cycle.exhaleHold.durationMs)}</td>
                      <td className="py-4 px-3 text-green-400 font-bold">{formatDuration(cycle.inhaleHold.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}