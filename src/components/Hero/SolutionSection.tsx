"use client"

export function SolutionSection() {
  return (
    <section className="bg-gradient-to-br from-gray-800 to-gray-900 py-16 relative"
             style={{
               backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(/hero-background.jpg)',
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundAttachment: 'fixed'
             }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white drop-shadow-lg">
              What happens when cutting-edge peptide science meets behavioral mastery?
            </h2>
            
            <div className="grid gap-8 md:grid-cols-3">
              {/* IRB-Approved Retatrutide */}
              <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-lg p-8 shadow-xl border border-teal-400/30 hover:shadow-teal-400/20 transition-all duration-300">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-teal-500/20 to-teal-600/20 rounded-full flex items-center justify-center border border-teal-400/30">
                  <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-white text-center">IRB-Approved Retatrutide Protocols</h3>
                <p className="text-gray-300 text-center">
                  Access to Legal. Tested. <strong className="text-teal-400">Retatrutide</strong>—the triple-receptor 
                  peptide that makes semaglutide and tirzepatide obsolete. Legal, monitored, and exponentially more 
                  effective for true metabolic restoration, not just symptom suppression.
                </p>
              </div>

              {/* Mental Mastery Integration */}
              <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-lg p-8 shadow-xl border border-amber-400/30 hover:shadow-amber-400/20 transition-all duration-300">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-full flex items-center justify-center border border-amber-400/30">
                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-white text-center">Mental Mastery Integration</h3>
                <p className="text-gray-300 text-center">
                  <em>Should we keep ignoring</em> the emotional aspects that created the weight problem? 
                  Our guided coaching transforms temporary pharmaceutical effects into permanent behavioral change.
                </p>
              </div>

              {/* Metabolic Partnership */}
              <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-lg p-8 shadow-xl border border-green-500/30 hover:shadow-green-400/20 transition-all duration-300">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-full flex items-center justify-center border border-green-500/30">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-white text-center">Metabolic Partnership Until Independence</h3>
                <p className="text-gray-300 text-center">
                  We don&apos;t rent you results. Through home monitoring, data dashboards, structured tapering, 
                  and psychological support—<em>you can</em> achieve true metabolic freedom.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}