"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { BreathOrb } from "./BreathOrb"
import { PhaseTimer } from "./PhaseTimer"
import { Controls } from "./Controls"
import { Configurator } from "./Configurator"
import { SessionStats } from "./SessionStats"
import { BreathStorage } from "@/lib/breathStorage"
import { BreathState, BreathSettings, DEFAULT_SETTINGS, CycleData, SessionData } from "@/types/breath"

interface BreathTrainingAppProps {
  onSessionComplete?: (session: any) => void
}

export function BreathTrainingApp({ onSessionComplete }: BreathTrainingAppProps) {
  // Core state machine
  const [state, setState] = useState<BreathState>('idle')
  const [settings, setSettings] = useState<BreathSettings>(() => {
    // Check for test override
    if (typeof window !== 'undefined') {
      const override = localStorage.getItem('breath-test-override')
      if (override) {
        try {
          const testSettings = JSON.parse(override)
          return { ...DEFAULT_SETTINGS, ...testSettings }
        } catch (e) {
          console.log('Invalid test override, using defaults')
        }
      }
    }
    return DEFAULT_SETTINGS
  })
  
  // Session data
  const [sessionId, setSessionId] = useState('')
  const [currentCycle, setCurrentCycle] = useState(1)
  const [breathCount, setBreathCount] = useState(0)
  const [completedCycles, setCompletedCycles] = useState<CycleData[]>([])
  
  // Timing state - high precision with performance.now()
  const [sessionStartTime, setSessionStartTime] = useState(0)
  const [phaseStartTime, setPhaseStartTime] = useState(0)
  const [breathStartTime, setBreathStartTime] = useState(0)
  const [currentPhaseTime, setCurrentPhaseTime] = useState(0)
  const [isInhale, setIsInhale] = useState(true)
  
  // Hold tracking
  const [cycleBreathingStart, setCycleBreathingStart] = useState(0)
  const [exhaleHoldStart, setExhaleHoldStart] = useState(0)
  const [inhaleHoldStart, setInhaleHoldStart] = useState(0)
  const [currentHoldDuration, setCurrentHoldDuration] = useState(0)
  const [exhaleHoldDuration, setExhaleHoldDuration] = useState(0)
  const [inhaleHoldDuration, setInhaleHoldDuration] = useState(0)
  
  // Performance tracking
  const [bestExhaleHold, setBestExhaleHold] = useState(0)
  const [bestInhaleHold, setBestInhaleHold] = useState(0)
  
  // Animation frame and timing
  const rafRef = useRef<number | null>(null)
  const lastFrameTime = useRef(0)
  const pausedElapsed = useRef(0)
  const stateRef = useRef(state)
  const breathStartTimeRef = useRef(0)
  const cycleBreathingStartRef = useRef(0)
  const isInhaleRef = useRef(true)
  const breathCountRef = useRef(0)
  const settingsRef = useRef(settings)
  const exhaleHoldStartRef = useRef(0)
  const inhaleHoldStartRef = useRef(0)
  const storage = BreathStorage.getInstance()

  // Keep refs updated
  useEffect(() => {
    stateRef.current = state
  }, [state])
  
  useEffect(() => {
    breathStartTimeRef.current = breathStartTime
  }, [breathStartTime])
  
  useEffect(() => {
    cycleBreathingStartRef.current = cycleBreathingStart
  }, [cycleBreathingStart])
  
  useEffect(() => {
    isInhaleRef.current = isInhale
  }, [isInhale])
  
  useEffect(() => {
    breathCountRef.current = breathCount
  }, [breathCount])
  
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  
  useEffect(() => {
    exhaleHoldStartRef.current = exhaleHoldStart
  }, [exhaleHoldStart])
  
  useEffect(() => {
    inhaleHoldStartRef.current = inhaleHoldStart
  }, [inhaleHoldStart])


  // Animation loop for real-time updates - use ref to avoid dependency issues
  const animationLoop = useCallback(() => {
    const now = performance.now()
    const currentState = stateRef.current
    
    if (currentState === 'breathing_active') {
      const elapsed = now - breathStartTimeRef.current
      const breathDuration = isInhaleRef.current ? settingsRef.current.pace.inhaleMs : settingsRef.current.pace.exhaleMs
      
      // DO NOT update any hold timers during breathing - timer should be hidden
      
      // Check if current breath phase is complete
      if (elapsed >= breathDuration) {
        if (isInhaleRef.current) {
          setIsInhale(false)
          setBreathStartTime(now)
        } else {
          const newCount = breathCountRef.current + 1
          setBreathCount(newCount)
          
          if (newCount >= settingsRef.current.breathsPerCycle) {
            // Automatically transition to exhale hold (timer starts immediately)
            setExhaleHoldStart(now)
            setCurrentHoldDuration(0)
            setCurrentPhaseTime(0)
            setState('exhale_hold_active')
            // Continue animation loop for exhale hold timing
          }
          
          setIsInhale(true)
          setBreathStartTime(now)
        }
      }
    } else if (currentState === 'exhale_hold_active') {
      // Exhale hold timer: starts at 0, counts up during exhale hold only
      const duration = now - exhaleHoldStartRef.current
      setCurrentHoldDuration(duration)
    } else if (currentState === 'inhale_hold_active') {
      // Inhale hold timer: starts at 0, counts up during inhale hold only  
      const duration = now - inhaleHoldStartRef.current
      setCurrentHoldDuration(duration)
    }
    
    // Continue the loop for active states
    if (['breathing_active', 'exhale_hold_active', 'inhale_hold_active'].includes(currentState)) {
      rafRef.current = requestAnimationFrame(animationLoop)
    }
  }, [])

  // State transition handlers
  const startSession = () => {
    const newSessionId = storage.generateSessionId()
    setSessionId(newSessionId)
    
    const now = performance.now()
    setSessionStartTime(Date.now()) // Use Date.now() for session duration calculation
    setCycleBreathingStart(now)
    setBreathStartTime(now)
    setCurrentCycle(1)
    setBreathCount(0)
    setCompletedCycles([])
    setIsInhale(true)
    setBestExhaleHold(0)
    setBestInhaleHold(0)
    
    // Reset all hold timing state
    setCurrentHoldDuration(0)
    setExhaleHoldStart(0)
    setInhaleHoldStart(0)
    setExhaleHoldDuration(0)
    setInhaleHoldDuration(0)
    
    setState('breathing_active')
    lastFrameTime.current = 0
    rafRef.current = requestAnimationFrame(animationLoop)
  }

  const pauseSession = () => {
    pausedElapsed.current = performance.now()
    setState('paused')
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const resumeSession = () => {
    const pauseDuration = performance.now() - pausedElapsed.current
    
    // Adjust all timing references to account for pause
    setBreathStartTime(prev => prev + pauseDuration)
    if (exhaleHoldStart > 0) setExhaleHoldStart(prev => prev + pauseDuration)
    if (inhaleHoldStart > 0) setInhaleHoldStart(prev => prev + pauseDuration)
    
    setState('breathing_active')
    lastFrameTime.current = 0
    rafRef.current = requestAnimationFrame(animationLoop)
  }

  const startExhaleHold = () => {
    const now = performance.now()
    setExhaleHoldStart(now)
    setCurrentHoldDuration(0)
    setState('exhale_hold_active')
    rafRef.current = requestAnimationFrame(animationLoop)
  }

  const startInhaleHold = () => {
    // Store exhale hold duration and update best time
    setExhaleHoldDuration(currentHoldDuration)
    if (currentHoldDuration > bestExhaleHold) {
      setBestExhaleHold(currentHoldDuration)
    }
    
    // Immediately start inhale hold
    const now = performance.now()
    setInhaleHoldStart(now)
    setCurrentHoldDuration(0) // Start inhale timer at 0
    setState('inhale_hold_active')
    // Animation loop continues automatically
  }

  const beginInhaleHold = () => {
    // This function is no longer needed since we go directly to active
    startInhaleHold()
  }

  const endInhaleHold = () => {
    const now = performance.now()
    const currentInhaleHoldDuration = now - inhaleHoldStart
    setInhaleHoldDuration(currentInhaleHoldDuration)
    
    // Update best inhale time (exhale already updated in startInhaleHold)
    if (currentInhaleHoldDuration > bestInhaleHold) {
      setBestInhaleHold(currentInhaleHoldDuration)
    }
    
    // Create cycle data with precise timing
    const cycleData: CycleData = {
      cycleIndex: currentCycle,
      breathing: {
        targetBreaths: settings.breathsPerCycle,
        actualBreaths: breathCount,
        startAt: new Date(sessionStartTime + (currentCycle - 1) * 240000).toISOString(), // Estimated
        endAt: new Date(exhaleHoldStart).toISOString(),
        actualDurationMs: exhaleHoldStart - cycleBreathingStart
      },
      exhaleHold: {
        startAt: new Date(exhaleHoldStart).toISOString(),
        durationMs: exhaleHoldDuration
      },
      inhaleHold: {
        startAt: new Date(inhaleHoldStart).toISOString(),
        durationMs: currentInhaleHoldDuration
      }
    }

    setCompletedCycles(prev => [...prev, cycleData])
    
    // Automatically continue to next cycle or end session
    if (currentCycle < settingsRef.current.cyclesTarget) {
      // Continue to next cycle immediately
      setCurrentCycle(prev => prev + 1)
      setBreathCount(0)
      setIsInhale(true)
      setCurrentHoldDuration(0)
      setExhaleHoldStart(0)
      setInhaleHoldStart(0)
      setCycleBreathingStart(performance.now())
      setBreathStartTime(performance.now())
      setState('breathing_active')
      rafRef.current = requestAnimationFrame(animationLoop)
    } else {
      // Session complete
      finishSession()
    }
  }

  const nextCycle = () => {
    if (currentCycle < settings.cyclesTarget) {
      setCurrentCycle(prev => prev + 1)
      setCycleBreathingStart(performance.now())
      setBreathStartTime(performance.now())
      setState('breathing_active')
      lastFrameTime.current = 0
      rafRef.current = requestAnimationFrame(animationLoop)
    } else {
      finishSession()
    }
  }

  const finishSession = async () => {
    setState('session_complete')
    
    const sessionData: SessionData = {
      sessionId,
      startedAt: new Date(sessionStartTime).toISOString(),
      endedAt: new Date().toISOString(),
      settings,
      cycles: completedCycles,
      cyclesCompleted: completedCycles.length
    }

    await storage.saveSession(sessionData)
    onSessionComplete?.(sessionData)
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const endSession = () => {
    if (window.confirm('Are you sure you want to end this session? Session data up to now will be saved.')) {
      finishSession()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  // Auto-pause on page visibility change (mobile background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && ['breathing_active', 'exhale_hold_active', 'inhale_hold_active'].includes(state)) {
        pauseSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state])

  // Prevent accidental navigation during active session
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state !== 'idle' && state !== 'session_complete') {
        e.preventDefault()
        e.returnValue = 'You have an active breathing session. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [state])

  const getBreathProgress = () => {
    if (state !== 'breathing_active') return 0
    return breathCount / settings.breathsPerCycle
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Portal Header - Added mt-16 to create proper space below fixed nav */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16 relative">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20" />
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Portal</h1>
                <span className="mx-2 text-primary-300">•</span>
                <span className="text-lg text-gray-200 drop-shadow-sm">Breath Training</span>
              </div>
              <div className="flex items-center gap-4">
                <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                  ← Back to Portal
                </a>
              </div>
            </div>
          </div>
        </div>
      
        {/* Training Description */}
        <div className="text-center py-12">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 text-shadow-lg animate-fade-in">
            Guided <span className="text-primary-400">Breath Training</span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm mb-4">
            Master your nervous system through conscious breathing. Enhance your metabolic reset with precision breathing techniques.
          </p>
        </div>

      {/* Main Training Interface */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-7xl">
          {/* Three Column Layout: Left = Controls, Center = Orb, Right = How it Works */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Side: Breath Count and Settings side by side on top, then keyboard shortcuts */}
            <div className="space-y-4 flex flex-col items-center">
              {/* Keyboard Shortcuts - moved to top, same size as Start Session */}
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-primary-400/30 max-w-lg">
                <div className="flex items-center justify-center gap-4 text-sm text-gray-200 flex-wrap">
                  <div className="flex items-center gap-1">
                    <kbd className="bg-primary-600/30 text-primary-100 px-2 py-1 rounded border border-primary-400/40 font-mono font-bold shadow-lg text-xs">Space</kbd>
                    <span className="text-white text-xs">advance</span>
                  </div>
                  <span className="text-gray-500">•</span>
                  <div className="flex items-center gap-1">
                    <kbd className="bg-amber-600/30 text-amber-100 px-2 py-1 rounded border border-amber-400/40 font-mono font-bold shadow-lg text-xs">P</kbd>
                    <span className="text-white text-xs">pause</span>
                  </div>
                  <span className="text-gray-500">•</span>
                  <div className="flex items-center gap-1">
                    <kbd className="bg-red-600/30 text-red-100 px-2 py-1 rounded border border-red-400/40 font-mono font-bold shadow-lg text-xs">Esc</kbd>
                    <span className="text-white text-xs">end</span>
                  </div>
                </div>
              </div>

              {/* Breath Count and Settings side by side - much smaller */}
              <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                {/* Breath Count Card - half width, centered content */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-3 shadow-2xl border border-primary-400/30">
                  <h3 className="text-sm font-bold text-white mb-2 text-center">Breath Count</h3>
                  <div className="text-center mb-3">
                    <div className="text-2xl font-bold text-primary-300 mb-1">{breathCount}</div>
                    <div className="text-xs text-gray-300">of {settings.breathsPerCycle}</div>
                  </div>
                  <div className="border-t border-primary-400/30 pt-2">
                    <div className="text-xs text-gray-300 mb-1 text-center">Pace: {settings.pace.label}</div>
                    <div className="text-xs text-gray-400 text-center">{settings.pace.inhaleMs/1000}s in • {settings.pace.exhaleMs/1000}s out</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-primary-400/30">
                    <div className="text-xs text-gray-300 mb-1 text-center">Cycle {currentCycle} of {settings.cyclesTarget}</div>
                    <div className="w-full bg-primary-900/50 rounded-full h-1">
                      <div 
                        className="bg-gradient-to-r from-primary-400 to-secondary-400 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(currentCycle / settings.cyclesTarget) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Settings - much smaller to match Breath Count */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-3 shadow-2xl border border-primary-400/30">
                  <div className="flex items-center justify-center mb-2">
                    <h3 className="text-sm font-bold text-white">Settings</h3>
                  </div>
                  <div className="flex justify-center">
                    <Configurator
                      settings={settings}
                      onSettingsChange={setSettings}
                      isSessionActive={state !== 'idle' && state !== 'session_complete'}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Breath Orb */}
            <div className="flex flex-col items-center space-y-8">
              {/* Breath Orb - hide during session complete */}
              {state !== 'session_complete' && (
                <BreathOrb
                  state={state}
                  isInhale={isInhale}
                  progress={getBreathProgress()}
                  motionReduced={settings.motionReduced}
                />
              )}

              {/* Session Active Indicator - Below Orb with consistent height to prevent jump */}
              <div className="h-12 flex items-center justify-center">
                {state !== 'idle' && state !== 'session_complete' && (
                  <div className="inline-flex items-center bg-gradient-to-r from-primary-600/30 to-secondary-600/30 backdrop-blur-sm text-primary-200 px-6 py-3 rounded-full font-medium border border-primary-400/50 shadow-lg">
                    Session Active • Cycle {currentCycle} of {settings.cyclesTarget}
                  </div>
                )}
              </div>

              {/* Phase Timer - ONLY show during hold phases (not breathing) */}
              {(state === 'exhale_hold_active' || state === 'inhale_hold_active') && (
                <PhaseTimer
                  timeMs={currentHoldDuration}
                  phase={state === 'exhale_hold_active' ? 'exhale hold' : 'inhale hold'}
                  isActive={true}
                  className="mb-4"
                />
              )}

              {/* Phase Timer - ONLY show during hold phases (not breathing) */}
              {(state === 'exhale_hold_active' || state === 'inhale_hold_active') && (
                <PhaseTimer
                  timeMs={currentHoldDuration}
                  phase={state === 'exhale_hold_active' ? 'exhale hold' : 'inhale hold'}
                  isActive={true}
                  className="mb-4"
                />
              )}

              {/* Start Session Controls - moved from left column */}
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-primary-400/30 max-w-lg mb-8">
                <Controls
                  state={state}
                  onStart={startSession}
                  onPause={pauseSession}
                  onResume={resumeSession}
                  onStartExhaleHold={startExhaleHold}
                  onStartInhaleHold={startInhaleHold}
                  onBeginInhaleHold={beginInhaleHold}
                  onEndInhaleHold={endInhaleHold}
                  onNextCycle={nextCycle}
                  onEndSession={endSession}
                />
              </div>
            </div>

            {/* Right Side: How it Works */}
            <div className="space-y-4">
              {/* How It Works - moved to right side, always visible */}
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm p-6 rounded-xl border border-primary-400/30 shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-3 drop-shadow-sm">How It Works</h3>
                  <ol className="space-y-2 text-gray-200">
                    <li className="flex items-start">
                      <span className="bg-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">1</span>
                      <span><strong>Breathing Phase:</strong> Follow the orb rhythm for {settings.breathsPerCycle} breaths at your selected pace</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">2</span>
                      <span><strong>Exhale Hold:</strong> After the final exhale, press Space to start your exhale hold</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">3</span>
                      <span><strong>Inhale Hold:</strong> When ready, press Space to inhale and hold as long as possible</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">4</span>
                      <span><strong>Complete Cycle:</strong> Press Space to exhale and finish the cycle</span>
                    </li>
                  </ol>
                  <div className="mt-6 p-3 bg-gradient-to-br from-primary-600/20 to-secondary-600/30 backdrop-blur-sm rounded-xl border border-primary-400/30 shadow-xl">
                    <div className="text-center">
                      <div className="group relative inline-block">
                        <a href="/education" className="text-primary-300 hover:text-primary-200 text-sm underline transition-colors">
                          *nerd stuff - studies and research papers
                        </a>
                        <div className="absolute bottom-full left-0 mb-2 w-80 p-3 bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-md rounded-lg border border-primary-400/40 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50">
                          <p className="text-xs text-gray-200 leading-relaxed">
                            <strong>Low oxygen practice</strong> stimulates autophagy better than HIIT, while <strong>hypercarbia</strong> stimulates growth hormone - both crucial for reducing loose skin during weight loss.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {/* Mobile: Show stats at bottom on small screens */}
          <div className="lg:hidden mt-12">
            <SessionStats
              state={state}
              currentCycle={currentCycle}
              breathCount={breathCount}
              currentHoldDuration={currentHoldDuration}
              bestExhaleHold={bestExhaleHold}
              bestInhaleHold={bestInhaleHold}
              settings={settings}
              cycles={completedCycles}
            />
          </div>
        </div>
      </div>

      {/* Session Complete Modal */}
      {state === 'session_complete' && completedCycles.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-2xl">🌬️</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Session Complete!</h2>
                <p className="text-lg text-gray-600">You've mastered another breathing session</p>
              </div>
              
              {/* Performance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
                <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                  <div className="text-2xl font-bold text-amber-600">{(bestExhaleHold / 1000).toFixed(1)}s</div>
                  <div className="text-sm text-amber-700 font-medium">Best Exhale Hold</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{(bestInhaleHold / 1000).toFixed(1)}s</div>
                  <div className="text-sm text-green-700 font-medium">Best Inhale Hold</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{completedCycles.length}</div>
                  <div className="text-sm text-blue-700 font-medium">Cycles Completed</div>
                </div>
              </div>

              {/* Detailed Cycle Results */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Cycle Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Cycle</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Breaths</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Breathing Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Exhale Hold</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Inhale Hold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedCycles.map((cycle, index) => (
                        <tr key={index} className="border-t border-gray-100">
                          <td className="py-3 px-4 font-medium">{cycle.cycleIndex}</td>
                          <td className="py-3 px-4">{cycle.breathing.actualBreaths}</td>
                          <td className="py-3 px-4">{Math.round(cycle.breathing.actualDurationMs / 1000)}s</td>
                          <td className="py-3 px-4 text-amber-600 font-medium">
                            {(cycle.exhaleHold.durationMs / 1000).toFixed(1)}s
                          </td>
                          <td className="py-3 px-4 text-green-600 font-medium">
                            {(cycle.inhaleHold.durationMs / 1000).toFixed(1)}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="flex gap-4 mb-4">
                <a
                  href="/portal" 
                  className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 px-6 rounded-xl transition-colors text-center"
                >
                  Continue to Portal →
                </a>
                <button
                  onClick={() => {
                    setState('idle')
                    setCompletedCycles([])
                  }}
                  className="bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-4 px-6 rounded-xl transition-colors"
                >
                  New Session
                </button>
              </div>

              {/* Secondary Actions */}
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const sessions = await storage.getAllSessions(1)
                    if (sessions.length > 0) {
                      const csv = storage.exportToCSV([sessions[0]])
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `breath-session-${new Date().toISOString().split('T')[0]}.csv`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors text-sm"
                >
                  Export CSV
                </button>
                <button
                  onClick={async () => {
                    try {
                      const sessions = await storage.getAllSessions(1)
                      if (sessions.length > 0) {
                        const proceed = confirm(`Export to Google Sheets?\n\nThis will:\n• Create or update your breath training spreadsheet\n• Track progress across multiple sessions\n• Calculate trends and improvements\n\nNote: Requires Google account authorization.`)
                        
                        if (proceed) {
                          // Call the Google Drive export API
                          const response = await fetch('/api/breath/export', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessions })
                          })
                          
                          const result = await response.json()
                          
                          if (response.ok) {
                            alert(`✅ Export successful!\n\nYour breath training data has been exported to Google Sheets.\n\nSpreadsheet URL: ${result.spreadsheetUrl}`)
                          } else {
                            alert(`❌ Export failed: ${result.error}\n\nPlease make sure you're signed in with Google.`)
                          }
                        }
                      }
                    } catch (error) {
                      alert('Export error: ' + error)
                    }
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                  </svg>
                  Export to Sheets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}