"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, Clock, BookOpen, Award } from "lucide-react"
import type { MentalMasteryModule } from "@/types"

interface AudioPlayerProps {
  module: MentalMasteryModule
  onProgress?: (progress: number) => void
  onComplete?: () => void
}

export function AudioPlayer({ module, onProgress, onComplete }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [completionReady, setCompletionReady] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      
      // Track progress for gamification
      const progressPercent = (audio.currentTime / duration) * 100
      onProgress?.(progressPercent)
      
      // Enable completion when 90% complete (prevents gaming the system)
      if (progressPercent >= 90 && !completionReady) {
        setCompletionReady(true)
      }
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCompletionReady(true)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [duration, completionReady, onProgress])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seek = (time: number) => {
    const audio = audioRef.current
    if (!audio) return
    
    // Prevent seeking beyond current progress (prevents gaming)
    const maxSeek = Math.max(currentTime, time)
    audio.currentTime = Math.min(maxSeek, duration)
  }

  const skipForward = () => seek(currentTime + 15)
  const skipBackward = () => seek(currentTime - 15)

  const handleSpeedChange = () => {
    const newRate = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : 1
    setPlaybackRate(newRate)
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate
    }
  }

  const handleComplete = () => {
    if (completionReady) {
      onComplete?.()
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg border border-gray-200">
      {/* Module Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <BookOpen className="w-5 h-5 text-primary-500 mr-2" />
            <span className="text-sm font-semibold text-primary-600 uppercase tracking-wide">
              {module.category}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h2>
          <p className="text-gray-600 text-sm">{module.description}</p>
        </div>
        
        <div className="text-right ml-4">
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <Clock className="w-4 h-4 mr-1" />
            {formatTime(module.duration)}
          </div>
          {module.requiredForDeposit && (
            <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">
              Required for Payout
            </div>
          )}
        </div>
      </div>

      {/* Audio Player */}
      <audio
        ref={audioRef}
        src={module.audioUrl}
        preload="metadata"
      />

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 cursor-pointer"
             onClick={(e) => {
               const rect = e.currentTarget.getBoundingClientRect()
               const clickX = e.clientX - rect.left
               const percentage = clickX / rect.width
               seek(duration * percentage)
             }}>
          <div 
            className="bg-gradient-to-r from-primary-400 to-secondary-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={skipBackward}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          
          <button
            onClick={togglePlay}
            className="p-3 rounded-full bg-primary-500 hover:bg-primary-600 text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <button
            onClick={skipForward}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSpeedChange}
            className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
          >
            {playbackRate}x
          </button>
          
          <div className="flex items-center">
            <Volume2 className="w-4 h-4 text-gray-500 mr-1" />
            <span className="text-sm text-gray-500">100%</span>
          </div>
        </div>
      </div>

      {/* Completion Psychology */}
      {progressPercent >= 90 && (
        <div className="mt-6 bg-gradient-to-r from-green-50 to-primary-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-green-800 mb-1">🎉 Module Complete!</h3>
              <p className="text-green-700 text-sm">
                You've unlocked your completion reward. Mark as complete to secure your progress.
              </p>
            </div>
            <button
              onClick={handleComplete}
              disabled={!completionReady}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                completionReady
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {module.requiredForDeposit ? (
                <div className="flex items-center">
                  <Award className="w-4 h-4 mr-2" />
                  Secure Payout Progress
                </div>
              ) : (
                <div className="flex items-center">
                  <Award className="w-4 h-4 mr-2" />
                  Claim +100 Points
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Progress Psychology */}
      {progressPercent > 10 && progressPercent < 90 && (
        <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <p className="text-yellow-800 text-sm">
            <strong>🎯 {Math.round(progressPercent)}% complete</strong> - Don't lose your progress! 
            {module.requiredForDeposit && " This module counts toward your stake security."}
          </p>
        </div>
      )}
    </div>
  )
}