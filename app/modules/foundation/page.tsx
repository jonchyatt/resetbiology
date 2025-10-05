"use client"

import { useState, useRef, useEffect } from "react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { Play, Pause, RotateCcw, Volume2, CheckCircle } from "lucide-react"

export default function FoundationModulesPage() {
  const [currentModule, setCurrentModule] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [completedModules, setCompletedModules] = useState(new Set([1, 2]))
  const audioRef = useRef<HTMLAudioElement>(null)

  const modules = [
    { id: 1, title: "Appetite Reset Foundation", description: "Master your hunger signals and metabolic awareness", audioFile: "/1mmm1.mp3" },
    { id: 2, title: "Metabolic Awakening", description: "Activate your body's natural fat-burning systems", audioFile: "/1mmm1.mp3" },
    { id: 3, title: "Stress & Cortisol Management", description: "Transform stress responses for optimal metabolism", audioFile: "/1mmm1.mp3" },
    { id: 4, title: "Sleep Optimization Protocol", description: "Enhance recovery and hormonal balance", audioFile: "/1mmm1.mp3" },
    { id: 5, title: "Mindful Eating Mastery", description: "Develop conscious consumption patterns", audioFile: "/1mmm1.mp3" }
  ]

  const currentModuleData = modules.find(m => m.id === currentModule)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      setCompletedModules(prev => new Set([...prev, currentModule]))
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [currentModule])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const resetAudio = () => {
    const audio = audioRef.current
    if (!audio) return
    
    audio.currentTime = 0
    setCurrentTime(0)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

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
          section="Foundation Series"
          subtitle="30 core modules for metabolic awakening"
          secondaryBackLink="/modules"
          secondaryBackText="Back to Mental Mastery Modules"
          showOrderPeptides={false}
        />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Audio Player */}
          <div className="card-hover-primary mb-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Module {currentModule}: {currentModuleData?.title}
              </h2>
              <p className="text-gray-300">{currentModuleData?.description}</p>
            </div>

            {/* Audio Element */}
            <audio 
              ref={audioRef} 
              src={currentModuleData?.audioFile}
              preload="metadata"
            />

            {/* Player Controls */}
            <div className="bg-primary-600/20 rounded-xl p-6 border border-primary-400/30">
              
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-300 mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-primary-400 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={resetAudio}
                  className="p-3 bg-secondary-600/60 hover:bg-secondary-500/80 rounded-full transition-colors"
                >
                  <RotateCcw className="w-5 h-5 text-white" />
                </button>
                
                <button
                  onClick={togglePlayPause}
                  className="p-4 bg-primary-600 hover:bg-primary-500 rounded-full transition-colors shadow-lg"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-white" />
                  ) : (
                    <Play className="w-8 h-8 text-white ml-1" />
                  )}
                </button>

                <button className="p-3 bg-secondary-600/60 hover:bg-secondary-500/80 rounded-full transition-colors">
                  <Volume2 className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Module List */}
          <div className="card-hover-primary">
            <h3 className="text-xl font-bold text-white mb-6">Foundation Series Modules</h3>
            <div className="space-y-3">
              {modules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => setCurrentModule(module.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                    currentModule === module.id
                      ? 'bg-primary-600/40 border-primary-400/60'
                      : 'bg-primary-600/20 border-primary-400/30 hover:bg-primary-600/30'
                  }`}
                >
                  <div className="flex items-center text-left">
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center mr-4 text-sm font-bold text-white">
                      {module.id}
                    </div>
                    <div>
                      <div className="font-medium text-white">{module.title}</div>
                      <div className="text-sm text-gray-300">{module.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {completedModules.has(module.id) && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                    {currentModule === module.id && isPlaying && (
                      <div className="flex space-x-1">
                        <div className="w-1 h-4 bg-primary-400 animate-pulse rounded"></div>
                        <div className="w-1 h-4 bg-primary-400 animate-pulse rounded" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-1 h-4 bg-primary-400 animate-pulse rounded" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Progress Stats */}
            <div className="mt-6 pt-6 border-t border-primary-400/30">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Progress:</span>
                <span className="text-primary-300 font-medium">
                  {completedModules.size}/30 modules completed
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(completedModules.size / 30) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}