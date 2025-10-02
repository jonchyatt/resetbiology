"use client"

import { X, Check } from "lucide-react"

export function ProblemSolution() {
  return (
    <section className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-16 relative" 
             style={{
               backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundAttachment: 'fixed'
             }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-white text-shadow-lg animate-fade-in leading-tight">
            Is it unreasonable to expect <span className="text-primary-400">real help</span> instead of another sales pitch?
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium">
            Maybe you're tired of treatments that abandon you and peptides that harm you
          </p>
        </div>
        
        <div className="grid gap-12 lg:grid-cols-2 max-w-6xl mx-auto">
          {/* Left Column: Current Reality */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-red-500/30">
            <h3 className="text-2xl font-bold mb-6 text-red-300">Your Current Reality</h3>
            <ul className="space-y-5 text-gray-200">
              <li className="flex items-start">
                <X className="w-5 h-5 text-red-400 mr-3 mt-1 flex-shrink-0" />
                Afraid you&apos;ll gain it all back when inferior peptides stop working
              </li>
              <li className="flex items-start">
                <X className="w-5 h-5 text-red-400 mr-3 mt-1 flex-shrink-0" />
                Frustrated by clinics pushing dangerous semaglutide and tirzepatide
              </li>
              <li className="flex items-start">
                <X className="w-5 h-5 text-red-400 mr-3 mt-1 flex-shrink-0" />
                Worried your metabolism is permanently broken
              </li>
              <li className="flex items-start">
                <X className="w-5 h-5 text-red-400 mr-3 mt-1 flex-shrink-0" />
                Fed up with providers who disappear after taking your money
              </li>
            </ul>
          </div>
          
          {/* Right Column: Transformation */}  
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border-2 border-primary-400/50 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-primary-300">Your Transformation</h3>
            <ul className="space-y-5 text-gray-200">
              <li className="flex items-start">
                <Check className="w-5 h-5 text-primary-400 mr-3 mt-1 flex-shrink-0" />
                <em>Maybe you haven&apos;t</em> experienced true metabolic reset... yet
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-primary-400 mr-3 mt-1 flex-shrink-0" />
                A legal, IRB-approved bridge to peptide independence
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-primary-400 mr-3 mt-1 flex-shrink-0" />
                Partners who address the real drivers behind weight struggles
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-primary-400 mr-3 mt-1 flex-shrink-0" />
                <strong className="text-primary-300">Gain back control, energy, and life—permanently</strong>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Gamification Section - MOVED HERE */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 max-w-3xl mx-auto border border-primary-400/30 mb-12">
            <p className="text-gray-200 text-lg font-medium leading-relaxed">
              <span className="text-primary-300 font-semibold">"Because we partner with your success"</span>—earn rewards for completing steps, tracking progress, and achieving independence.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 max-w-4xl mx-auto border border-primary-400/30">
            <p className="text-gray-200 text-xl font-medium leading-relaxed mb-6">
              <span className="text-primary-300 font-semibold">"You deserve better than broken promises"</span>—experience what happens when medical providers earn their living from hospitals, not your wallet.
            </p>
            
            {/* MOVED CONTENT HERE */}
            <div className="mb-8">
              <h3 className="text-3xl md:text-4xl font-bold mb-6 text-white leading-tight">
                The Safest, Most Effective Path to{" "}
                <span className="text-primary-400 block">Permanent Metabolic Freedom</span>
              </h3>
              
              <p className="text-xl md:text-2xl mb-6 text-gray-200 max-w-3xl mx-auto leading-relaxed font-medium">
                Licensed medical providers. IRB-approved protocols. Proven bridge from{" "}
                <strong className="text-primary-400">peptide dependency to independence.</strong>
              </p>
              
              {/* Trust Badge */}
              <div className="mb-6 flex justify-center">
                <div className="bg-green-600/20 border border-green-400 rounded-full px-6 py-2 backdrop-blur-sm">
                  <span className="text-green-300 font-semibold text-sm uppercase tracking-wide">
                    🏥 IRB-Approved Medical Research Protocol
                  </span>
                </div>
              </div>
              
              {/* Primary CTA */}
              <div className="mb-6">
                <a href="/assessment" className="inline-block bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-xl md:text-2xl font-bold px-12 py-6 rounded-2xl transition-all duration-300 hover:scale-105 shadow-2xl hover:shadow-primary-400/30 border-2 border-primary-300/50 backdrop-blur-sm">
                  🎯 Take the 60-Second Reset Assessment
                </a>
              </div>
              
              <p className="text-lg md:text-xl text-gray-300 mb-8 font-medium max-w-2xl mx-auto">
                <em>Most people are surprised</em> how quickly their personalized path becomes clear.
              </p>

              {/* Video Section */}
              <div className="mb-6 bg-gray-800/50 rounded-xl p-6 max-w-2xl mx-auto border border-gray-700/50 backdrop-blur-sm">
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
                    <h3 className="text-lg font-bold mb-2 group-hover:text-white transition-colors">"The Truth About Your Current GLP-1"</h3>
                    <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-2 mb-2">
                      <p className="text-red-300 font-semibold text-sm">🚨 STOP LOSING MUSCLE!</p>
                    </div>
                    <p className="text-xs text-primary-400 font-medium">▶ 4-minute video • Click to play</p>
                  </div>
                </div>
              </div>
              
              {/* Secondary CTA */}
              <div className="mb-6">
                <a href="/process" className="text-primary-400 hover:text-primary-300 text-lg underline underline-offset-4 decoration-2 hover:decoration-primary-300 transition-all">
                  Not ready? <em>See how our process works first</em> →
                </a>
              </div>
            </div>
            
            <a href="/assessment" className="inline-block bg-primary-400 hover:bg-primary-500 text-white text-lg font-bold px-8 py-4 rounded-xl transition-all duration-300 hover:scale-105 shadow-2xl hover:shadow-primary-400/25">
              See Your Personalized Path
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}