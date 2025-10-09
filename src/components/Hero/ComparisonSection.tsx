"use client"

import Link from "next/link"

export function ComparisonSection() {
  return (
    <section className="bg-gradient-to-br from-gray-900 to-gray-800 py-16 relative"
             style={{
               backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(/hero-background.jpg)',
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundAttachment: 'fixed'
             }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white drop-shadow-lg">
                Maybe you haven&apos;t found a system that actually works... yet.
              </h2>
              <h3 className="text-2xl font-semibold mb-8 text-gray-300">How We&apos;re Different</h3>
            </div>
          
          {/* Comparison Table */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden mb-16 border border-gray-600/30">
            <div className="grid md:grid-cols-2">
              <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 p-8 border-r border-gray-600/30">
                <h4 className="text-2xl font-bold mb-4 text-red-400 text-center">❌ Typical Clinics</h4>
              </div>
              <div className="bg-gradient-to-br from-teal-500/20 to-green-500/20 p-8">
                <h4 className="text-2xl font-bold mb-4 text-teal-400 text-center">✅ Reset Biology</h4>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 divide-x divide-gray-600/30">
              <div className="p-8 space-y-5">
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg">Push lifetime semaglutide and Tirzepatide dependency</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg">Ignore psychological drivers</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg">Sell unregulated, dangerous peptides</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg">Scale profits over patient care</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg">Promise quick weight loss</span>
                </div>
              </div>
              
              <div className="p-8 space-y-5">
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-teal-400 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg font-medium">Use Retatrutide as a bridge to independence</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-teal-400 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg font-medium">Incentivize mental/emotional health and control</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-teal-400 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg font-medium">Deliver IRB-approved, monitored protocols</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-teal-400 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg font-medium">Scale with community support</span>
                </div>
                <div className="flex items-start">
                  <div className="w-3 h-3 bg-teal-400 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-300 text-lg font-medium">Deliver metabolic restoration and longevity</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Testimonials */}
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-10 text-white drop-shadow-lg">Real-World Outcomes & Voices</h3>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <blockquote className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm p-6 rounded-xl border border-blue-500/30 shadow-xl hover:shadow-blue-400/20 transition-all duration-300 hover:border-blue-400/50">
                <p className="text-gray-200 italic text-lg font-medium">&ldquo;65 lbs down… changed my life.&rdquo;</p>
                <div className="flex text-blue-400 mt-3 justify-center">
                  <span>★★★★★</span>
                </div>
              </blockquote>
              <blockquote className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm p-6 rounded-xl border border-amber-400/30 shadow-xl hover:shadow-amber-400/20 transition-all duration-300 hover:border-amber-400/50">
                <p className="text-gray-200 italic text-lg font-medium">&ldquo;First time ever in control.&rdquo;</p>
                <div className="flex text-amber-400 mt-3 justify-center">
                  <span>★★★★★</span>
                </div>
              </blockquote>
              <blockquote className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm p-6 rounded-xl border border-green-500/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300 hover:border-green-500/50">
                <p className="text-gray-200 italic text-lg font-medium">&ldquo;Like they flipped a switch.&rdquo;</p>
                <div className="flex text-green-400 mt-3 justify-center">
                  <span>★★★★★</span>
                </div>
              </blockquote>
            </div>
          </div>
          
          {/* Strategic CTA */}
          <div className="text-center">
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-8 max-w-2xl mx-auto shadow-xl border border-teal-400/30">
              <h3 className="text-2xl font-bold mb-4 text-white">Ready to Experience the Difference?</h3>
              <p className="text-gray-300 mb-6">Join thousands who've already made the switch to science-backed metabolic freedom.</p>
              <Link href="/quiz" className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white text-lg px-10 py-4 rounded-lg inline-block font-bold transition-all hover:scale-105 shadow-lg border border-teal-400/30 backdrop-blur-sm">
                Tell us What WORKS for You
              </Link>
              <p className="text-sm text-gray-400 mt-3">
                <em>Most people are surprised</em> by their personalized results
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}