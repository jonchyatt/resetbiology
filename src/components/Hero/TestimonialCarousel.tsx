"use client"

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from 'lucide-react'

// Real client testimonials with detailed written testimonials
const testimonials = [
  {
    name: 'Judy',
    location: 'Reset Biology Client',
    videoPath: 'ResetJudy-web.mp4',
    quote: '"I lost 35 pounds while maintaining my muscle mass and energy levels. The peptide protocol made all the difference in preserving my strength while shedding fat."',
    rating: 5,
    results: 'Lost 35 lbs, Maintained muscle mass'
  },
  {
    name: 'Rob',
    location: 'Reset Biology Client',
    videoPath: 'ResetRob-web.mp4',
    quote: '"This protocol changed my life. I feel stronger, more energetic, and healthier than I have in years. The muscle preservation was incredible."',
    rating: 5,
    results: 'Increased energy, Better strength'
  },
  {
    name: 'Mike',
    location: 'St. George',
    videoPath: 'StGeorgeMike-web.mp4',
    quote: '"Amazing transformation. I dropped weight without the typical muscle loss you get with other programs. My body composition completely changed."',
    rating: 5,
    results: 'Transformed body composition'
  },
  {
    name: 'Sarah',
    location: 'Utah',
    videoPath: 'UtahMom-web.mp4',
    quote: '"Best health decision I\'ve made. As a busy mom, I needed something that worked efficiently. The results were beyond my expectations."',
    rating: 5,
    results: 'Sustainable weight loss'
  },
  {
    name: 'Josh',
    location: 'Utah',
    videoPath: 'Youngutah-web.mp4',
    quote: '"Incredible improvements in my health markers and physical appearance. I built muscle while losing fat - something I thought was impossible."',
    rating: 5,
    results: 'Built muscle, Lost fat'
  }
]

export function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isHovering, setIsHovering] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
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

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
    }
  }

  const current = testimonials[currentIndex]

  return (
    <div className="relative">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Two-column layout: Vertical video on left, written testimonial on right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* Left: Vertical Video */}
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary-500/10 to-secondary-500/10 p-[2px]">
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div
              className="relative group cursor-pointer bg-gray-800"
              style={{ aspectRatio: '9/16' }}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <video
                ref={videoRef}
                key={`/testimonials/${current.videoPath}`}
                className="w-full h-full object-cover"
                muted={isMuted}
                loop
                playsInline
              >
                <source src={`/testimonials/${current.videoPath}`} type="video/mp4" />
              </video>

              {/* Play icon overlay */}
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

              {/* Volume control button - appears when hovering */}
              {isHovering && (
                <button
                  onClick={toggleMute}
                  className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white p-3 rounded-full transition-all z-10"
                  aria-label={isMuted ? "Unmute video" : "Mute video"}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              )}

              {/* Client info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                <div className="text-white">
                  <div className="font-bold text-lg">{current.name}</div>
                  <div className="text-sm text-white/80">{current.location}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Written Testimonial */}
        <div className="flex flex-col justify-center h-full bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          {/* Star rating */}
          <div className="flex gap-1 mb-4">
            {[...Array(current.rating)].map((_, i) => (
              <svg key={i} className="w-6 h-6 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>

          {/* Quote */}
          <blockquote className="text-gray-200 text-lg md:text-xl italic leading-relaxed mb-6">
            {current.quote}
          </blockquote>

          {/* Results badge */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border border-primary-400/30 rounded-full px-4 py-2 mb-4">
            <svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-primary-300 font-semibold text-sm">{current.results}</span>
          </div>

          {/* Client attribution */}
          <div className="text-gray-400 text-sm">
            <span className="font-bold text-white">{current.name}</span>
            <span className="mx-2">•</span>
            <span>{current.location}</span>
          </div>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="mt-6 flex items-center justify-center gap-4 md:gap-6 text-xs text-gray-400">
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
