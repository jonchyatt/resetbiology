"use client"

import { useState } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

interface VideoTestimonialProps {
  videoUrl: string
  thumbnailUrl?: string
  name: string
  title?: string
  duration?: string
}

export function VideoTestimonial({
  videoUrl,
  thumbnailUrl,
  name,
  title,
  duration = "2:45"
}: VideoTestimonialProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)

  return (
    <div className="relative group">
      {/* Video container with gradient border */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary-500/20 to-secondary-500/20 p-[2px]">
        <div className="relative bg-gray-900 rounded-xl overflow-hidden">
          {/* Video player placeholder - would be replaced with actual video element */}
          <div className="aspect-video bg-gray-800 relative">
            {!isPlaying && thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={`${name} testimonial`}
                className="w-full h-full object-cover"
              />
            )}

            {/* Play overlay when not playing */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <button
                  onClick={() => setIsPlaying(true)}
                  className="bg-primary-500/90 hover:bg-primary-400 text-white rounded-full p-4 transform hover:scale-110 transition-all duration-300 shadow-[0_0_30px_rgba(114,194,71,0.5)]"
                >
                  <Play className="w-8 h-8 ml-1" fill="white" />
                </button>
              </div>
            )}

            {/* Video controls overlay */}
            {isPlaying && showControls && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="text-white hover:text-primary-300 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-white hover:text-primary-300 transition-colors"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                  <span className="text-white/80 text-sm">{duration}</span>
                </div>
              </div>
            )}
          </div>

          {/* Testimonial info */}
          <div className="p-4 bg-gray-900/50 backdrop-blur-sm">
            <p className="text-white font-semibold">{name}</p>
            {title && <p className="text-gray-400 text-sm">{title}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}