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
      <section className="min-h-screen flex items-center justify-center px-4 pt-8">
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

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-8 text-white text-shadow-lg animate-fade-in leading-tight max-w-4xl mx-auto">
            The Safest, Most Effective Path to{" "}
            <span className="text-primary-400 block">Permanent Metabolic Freedom</span>
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto animate-slide-up leading-relaxed font-medium">
            Licensed medical providers. IRB-approved protocols. Proven bridge from{" "}
            <strong className="text-primary-400">peptide dependency to independence.</strong>
          </p>
          
          {/* Trust Badge */}
          <div className="mb-8 flex justify-center">
            <div className="bg-green-600/20 border border-green-400 rounded-full px-6 py-2 backdrop-blur-sm">
              <span className="text-green-300 font-semibold text-sm uppercase tracking-wide">
                🏥 IRB-Approved Medical Research Protocol
              </span>
            </div>
          </div>
          

          {/* Primary CTA */}
          <div className="mb-8 animate-scale-in">
            <Link href="/assessment" className="inline-block bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-xl md:text-2xl font-bold px-12 py-6 rounded-2xl transition-all duration-300 hover:scale-105 shadow-2xl hover:shadow-primary-400/30 border-2 border-primary-300/50 backdrop-blur-sm">
              🎯 Take the 60-Second Reset Assessment
            </Link>
          </div>
          
          <p className="text-lg md:text-xl text-gray-300 mb-8 font-medium max-w-2xl mx-auto">
            <em>Most people are surprised</em> how quickly their personalized path becomes clear.
          </p>

          {/* Video Section - More Compact */}
          <div className="mb-8 bg-gray-800/50 rounded-xl p-6 max-w-2xl mx-auto border border-gray-700/50 backdrop-blur-sm">
            <div 
              className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center cursor-pointer hover:from-gray-600 hover:to-gray-700 transition-all duration-300 group border border-gray-600/30"
              onClick={() => alert('Video player would open here. Ready to embed your actual video!')}
            >
              <div className="text-center text-gray-300">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center group-hover:from-primary-500 group-hover:to-primary-600 transition-all group-hover:scale-110 transform duration-200 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-white transition-colors">&ldquo;The Truth About Your Current GLP-1&rdquo;</h3>
                <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-2 mb-2">
                  <p className="text-red-300 font-semibold text-sm">🚨 STOP LOSING MUSCLE!</p>
                </div>
                <p className="text-xs text-primary-400 font-medium">▶ 4-minute video • Click to play</p>
              </div>
            </div>
          </div>
          
          {/* Secondary CTA */}
          <div className="mb-8">
            <Link href="/process" className="text-primary-400 hover:text-primary-300 text-lg underline underline-offset-4 decoration-2 hover:decoration-primary-300 transition-all">
              Not ready? <em>See how our process works first</em> →
            </Link>
          </div>
          
          {/* Trust Strip */}
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 max-w-3xl mx-auto border border-primary-400/30">
            <p className="text-gray-200 text-lg font-medium leading-relaxed">
              <span className="text-primary-300 font-semibold">&ldquo;Because we partner with your success&rdquo;</span>—earn rewards for completing steps, tracking progress, and achieving independence.
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