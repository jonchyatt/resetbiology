"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, SkipForward, Volume2, VolumeX, Brain, Sparkles } from "lucide-react"

interface MentalMasteryPreviewProps {
  userName: string
  onComplete: () => void
  onSkip: () => void
}

export function MentalMasteryPreview({ userName, onComplete, onSkip }: MentalMasteryPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setProgress((audio.currentTime / audio.duration) * 100)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setIsComplete(true)
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
      setHasStarted(true)
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.muted = !audio.muted
    setIsMuted(!isMuted)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    audio.currentTime = percentage * duration
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-2xl w-full">
        <audio ref={audioRef} src="/audio/mental-mastery-preview.mp3" preload="metadata" />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-4">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Mental Mastery Preview
          </h1>
          <p className="text-gray-300 text-lg">
            {userName ? `${userName}, experience` : "Experience"} a sample of our guided visualization
          </p>
        </div>

        {/* Audio Player Card */}
        <div className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-sm rounded-xl p-8 border border-purple-400/30 shadow-2xl">
          {!hasStarted ? (
            // Initial state - prompt to start
            <div className="text-center space-y-6">
              <div className="space-y-4">
                <Sparkles className="w-12 h-12 text-purple-400 mx-auto" />
                <h2 className="text-2xl font-semibold text-white">
                  Energetic Visualization for Boundless Confidence
                </h2>
                <p className="text-gray-300">
                  This 4-minute guided visualization will help you tap into a state of
                  confidence and clarity. Find a comfortable position and prepare to relax.
                </p>
              </div>

              <button
                onClick={togglePlay}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold rounded-full transition-all shadow-lg hover:shadow-purple-500/30"
              >
                <Play className="w-6 h-6" />
                Start Visualization
              </button>

              <p className="text-sm text-gray-400">
                Duration: ~4 minutes
              </p>
            </div>
          ) : (
            // Playing state - show player
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-2">
                  Energetic Visualization for Boundless Confidence
                </h2>
                <p className="text-gray-400 text-sm">
                  {isComplete ? "Visualization complete!" : "Close your eyes and listen..."}
                </p>
              </div>

              {/* Progress Bar */}
              <div
                className="w-full h-2 bg-gray-700 rounded-full cursor-pointer overflow-hidden"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-sm text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={toggleMute}
                  className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                <button
                  onClick={togglePlay}
                  className="p-5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white transition-all shadow-lg hover:shadow-purple-500/30"
                >
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                </button>

                <button
                  onClick={onSkip}
                  className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 transition-colors"
                  title="Skip to results"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          {isComplete ? (
            <button
              onClick={onComplete}
              className="px-8 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-primary-500/30"
            >
              See My Personalized Results
            </button>
          ) : (
            <button
              onClick={onSkip}
              className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Skip to Results
            </button>
          )}
        </div>

        {/* Benefits Note */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            This is just one of many guided experiences available in our Mental Mastery Modules
          </p>
        </div>
      </div>
    </div>
  )
}
