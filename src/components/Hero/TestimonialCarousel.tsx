"use client"

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { VideoTestimonial } from './VideoTestimonial'
import { WrittenTestimonial } from './WrittenTestimonial'

// Sample data - in production this would come from a database
const testimonials = [
  {
    type: 'video',
    videoUrl: '/testimonials/video1.mp4',
    thumbnailUrl: '/testimonials/thumb1.jpg',
    name: 'Sarah Johnson',
    title: 'Lost 47 lbs in 4 months',
    duration: '2:15'
  },
  {
    type: 'written',
    name: 'Michael Chen',
    location: 'San Francisco, CA',
    rating: 5,
    date: '2 weeks ago',
    content: 'The peptide protocols completely changed my weight loss journey. I maintained my muscle mass while losing 35 pounds!',
    verified: true,
    highlight: 'maintained my muscle mass'
  },
  {
    type: 'written',
    name: 'Jennifer Adams',
    location: 'Austin, TX',
    rating: 5,
    date: '1 month ago',
    content: 'Reset Biology gave me the tools and knowledge I needed. The personalized approach made all the difference in my success.',
    verified: true,
    highlight: 'personalized approach'
  },
  {
    type: 'video',
    videoUrl: '/testimonials/video2.mp4',
    thumbnailUrl: '/testimonials/thumb2.jpg',
    name: 'David Martinez',
    title: 'Transformed at 52',
    duration: '3:20'
  },
  {
    type: 'written',
    name: 'Lisa Thompson',
    location: 'Miami, FL',
    rating: 5,
    date: '3 weeks ago',
    content: 'Finally, a program that understands the science! I feel stronger and more energetic than I have in years.',
    verified: true,
    highlight: 'understands the science'
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
    }, 8000) // Change every 8 seconds

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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Success Stories</h3>
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
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Testimonial display with fade animation */}
      <div className="relative min-h-[300px]">
        <div className="transition-opacity duration-500">
          {current.type === 'video' ? (
            <VideoTestimonial {...current as any} />
          ) : (
            <WrittenTestimonial {...current as any} />
          )}
        </div>
      </div>

      {/* Trust indicators */}
      <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-400">
        <span>⭐ 4.9/5 Average Rating</span>
        <span>• 2,847 Success Stories</span>
        <span>• Verified Results</span>
      </div>
    </div>
  )
}