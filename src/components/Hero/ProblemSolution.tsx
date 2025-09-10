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
        
        {/* CTA Section */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 max-w-4xl mx-auto border border-primary-400/30">
            <p className="text-gray-200 text-xl font-medium leading-relaxed mb-6">
              <span className="text-primary-300 font-semibold">"You deserve better than broken promises"</span>—experience what happens when medical providers earn their living from hospitals, not your wallet.
            </p>
            <a href="/assessment" className="inline-block bg-primary-400 hover:bg-primary-500 text-white text-lg font-bold px-8 py-4 rounded-xl transition-all duration-300 hover:scale-105 shadow-2xl hover:shadow-primary-400/25">
              See Your Personalized Path
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}