"use client"

import { Star, Quote } from 'lucide-react'

interface WrittenTestimonialProps {
  name: string
  location?: string
  rating: number
  date: string
  content: string
  verified?: boolean
  highlight?: string // Key phrase to highlight
}

export function WrittenTestimonial({
  name,
  location,
  rating,
  date,
  content,
  verified = false,
  highlight
}: WrittenTestimonialProps) {
  // Highlight specific phrases in the content
  const renderContent = () => {
    if (!highlight) return content

    const parts = content.split(highlight)
    return (
      <>
        {parts[0]}
        <span className="text-primary-300 font-semibold">{highlight}</span>
        {parts[1]}
      </>
    )
  }

  return (
    <div className="relative">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-secondary-500/10 rounded-xl blur-xl"></div>

      {/* Main testimonial card */}
      <div className="relative bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:border-primary-500/50 transition-all duration-300">
        {/* Quote icon */}
        <Quote className="absolute top-4 right-4 w-8 h-8 text-primary-500/20 rotate-180" />

        {/* Rating stars */}
        <div className="flex items-center gap-1 mb-3">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-5 h-5 ${
                i < rating
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-600'
              }`}
            />
          ))}
          {verified && (
            <span className="ml-2 text-xs text-green-400 font-medium">
              ✓ Verified Purchase
            </span>
          )}
        </div>

        {/* Testimonial content */}
        <p className="text-gray-200 text-lg leading-relaxed mb-4">
          "{renderContent()}"
        </p>

        {/* Author info */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
          <div>
            <p className="text-white font-semibold">{name}</p>
            {location && (
              <p className="text-gray-400 text-sm">{location}</p>
            )}
          </div>
          <p className="text-gray-500 text-sm">{date}</p>
        </div>
      </div>
    </div>
  )
}