"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"

export function HeroSection() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative" 
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-12">
            <img 
              src="/logo1.png" 
              alt="Reset Biology - DNA Reset Science" 
              className="h-24 md:h-32 lg:h-36 w-auto mx-auto rounded-2xl drop-shadow-2xl hover:drop-shadow-[0_0_40px_rgba(63,191,181,0.3)] transition-all duration-500 bg-white/5 backdrop-blur-sm p-4 border border-white/10"
            />
          </div>
          
          {/* Strong Warning Message */}
          <div className="mb-6 max-w-2xl mx-auto">
            <div className="bg-red-500/20 border-2 border-red-400 rounded-xl p-6 backdrop-blur-sm">
              <p className="text-red-300 font-bold text-xl md:text-2xl text-center leading-tight">
                STOP!! You're not losing weight... you're losing <span className="text-red-200 underline">MUSCLE!</span>
              </p>
            </div>
          </div>

          {/* Simple CTA to continue */}
          <div className="mb-8">
            <p className="text-lg md:text-xl text-gray-300 font-medium max-w-2xl mx-auto">
              Ready to learn the truth about safe, effective metabolic reset?
            </p>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce-subtle">
          <ChevronDown className="w-6 h-6 text-white" />
        </div>
      </section>
    </div>
  )
}