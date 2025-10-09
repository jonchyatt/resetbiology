"use client"

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'

// Real client testimonials - using proper names instead of filenames
const testimonials = [
  {
    name: 'Judy',
    location: 'Reset Biology Client',
    videoPath: 'ResetJudy.mov',
    quote: 'The results have been incredible!',
    rating: 5
  },
  {
    name: 'Rob',
    location: 'Reset Biology Client',
    videoPath: 'ResetRob.mov',
    quote: 'This protocol changed my life',
    rating: 5
  },
  {
    name: 'Mike',
    location: 'St. George',
    videoPath: 'StGeorgeMike.mov',
    quote: 'Amazing transformation and results',
    rating: 5
  },
  {
    name: 'Sarah',
    location: 'Utah',
    videoPath: 'Utah MOM.mov',
    quote: 'Best health decision I\'ve made',
    rating: 5
  },
  {
    name: 'Josh',
    location: 'Utah',
    videoPath: 'Youngutah.mp4',
    quote: 'Incredible improvements in my health',
    rating: 5
  }
]

export function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isHovering, setIsHovering] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 12000)

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  // Play video on hover
  useEffect(() => {
    if (videoRef.current) {
      if (isHovering) {
        videoRef.current.play()
      } else {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
    }
  }, [isHovering])

  const handlePrevious = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const handleNext = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const current = testimonials[currentIndex]

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl md:text-2xl font-bold text-white">Real Client Success Stories</h3>
        <div className="flex items-center gap-2">
          {/* Navigation dots */}
          <div className="flex gap-2 mr-4">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsAutoPlaying(false)
                  setCurrentIndex(idx)
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'bg-primary-400 w-6'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>

          {/* Arrow navigation */}
          <button
            onClick={handlePrevious}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video testimonial display */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary-500/10 to-secondary-500/10 p-[2px]">
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          {/* Video container with hover-to-play */}
          <div
            className="aspect-video bg-gray-800 relative group cursor-pointer"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <video
              ref={videoRef}
              key={`/ugc raw/${current.videoPath}`}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
            >
              <source src={`/ugc raw/${current.videoPath}`} type="video/mp4" />
              <source src={`/ugc raw/${current.videoPath}`} type="video/quicktime" />
            </video>

            {/* Play icon overlay - shows when not hovering */}
            {!isHovering && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
                <div className="bg-primary-500/90 rounded-full p-6 group-hover:scale-110 transition-transform">
                  <Play className="w-12 h-12 text-white fill-white" />
                </div>
              </div>
            )}

            {/* Hover instruction */}
            {!isHovering && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
                <p className="text-white text-sm font-medium">Hover to play</p>
              </div>
            )}

            {/* Client info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
              <div className="text-white">
                <div className="font-bold text-lg">{current.name}</div>
                <div className="text-sm text-white/80">{current.location}</div>
              </div>
            </div>
          </div>

          {/* Testimonial info */}
          <div className="p-5 bg-gray-900/50 backdrop-blur-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-gray-300 text-sm italic">"{current.quote}"</p>
              </div>
              <div className="flex gap-1 ml-4">
                {[...Array(current.rating)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="mt-4 flex items-center justify-center gap-4 md:gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Real Client Results
        </span>
        <span>•</span>
        <span>Verified Testimonials</span>
        <span>•</span>
        <span>Actual User Experiences</span>
      </div>
    </div>
  )
}
