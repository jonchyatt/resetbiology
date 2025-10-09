"use client"

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Real testimonials from ugc raw folder
const testimonials = [
  {
    name: 'Judy',
    location: 'Reset Biology Client',
    videoFile: '/ugc raw/ResetJudy.mov',
    quote: 'Amazing results with the protocol',
    rating: 5
  },
  {
    name: 'Rob',
    location: 'Reset Biology Client',
    videoFile: '/ugc raw/ResetRob.mov',
    quote: 'Life-changing experience',
    rating: 5
  },
  {
    name: 'Mike',
    location: 'St George',
    videoFile: '/ugc raw/StGeorgeMike.mov',
    quote: 'Incredible transformation',
    rating: 5
  },
  {
    name: 'Utah Mom',
    location: 'Utah',
    videoFile: '/ugc raw/Utah MOM.mov',
    quote: 'Best decision for my health',
    rating: 5
  },
  {
    name: 'Young Utah Client',
    location: 'Utah',
    videoFile: '/ugc raw/Youngutah.mp4',
    quote: 'Remarkable improvements',
    rating: 5
  }
]

export function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 10000) // Change every 10 seconds

    return () => clearInterval(interval)
  }, [isAutoPlaying])

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
        <h3 className="text-xl font-bold text-white">Real Client Testimonials</h3>
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
              />
            ))}
          </div>

          {/* Arrow navigation */}
          <button
            onClick={handlePrevious}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video testimonial display */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary-500/10 to-secondary-500/10 p-[2px]">
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          {/* Video container */}
          <div className="aspect-video bg-gray-800 relative group">
            <video
              key={current.videoFile}
              className="w-full h-full object-cover"
              controls
              preload="metadata"
            >
              <source src={current.videoFile} type="video/mp4" />
              <source src={current.videoFile} type="video/quicktime" />
              Your browser does not support the video tag.
            </video>

            {/* Video overlay with info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-white">
                <div className="font-semibold">{current.name}</div>
                <div className="text-sm text-white/80">{current.location}</div>
              </div>
            </div>
          </div>

          {/* Testimonial info */}
          <div className="p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-semibold">{current.name}</p>
                <p className="text-gray-400 text-sm">{current.location}</p>
              </div>
              <div className="flex gap-1">
                {[...Array(current.rating)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="text-gray-300 text-sm mt-2 italic">"{current.quote}"</p>
          </div>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-400">
        <span>⭐ Real Client Results</span>
        <span>• Video Testimonials</span>
        <span>• Verified Users</span>
      </div>
    </div>
  )
}
