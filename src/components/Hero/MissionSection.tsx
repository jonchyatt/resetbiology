"use client"

export function MissionSection() {
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
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-white drop-shadow-lg">
              Is it unreasonable to expect real help instead of another sales pitch?
            </h2>
            
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-lg p-8 mb-8 text-left shadow-xl border border-teal-400/30">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <span className="text-teal-400">📖</span> Our Story
              </h3>
              <p className="text-lg text-gray-300 mb-4 leading-relaxed">
                We built Reset Biology to fix what&apos;s broken: people trying to make change but trapped on 
                health damaging meds, by providers who really should know better. Our founders are medical providers; 
                income comes from hospital work—not from churning you.
              </p>
              <p className="text-lg text-gray-300 mb-4 leading-relaxed">
                We have also partnered with some of our first clients to literally join our team. We know what you 
                are going through. We designed a <strong className="text-teal-400">lean, expert-guided system</strong> that 
                passes efficiency back to you in care and cost.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                We partner with you! When you talk to us you will most likely be communicating with former participants 
                of this research that have become our assets and joined our team.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-lg p-6 border border-green-500/30 shadow-xl">
              <h4 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
                <span className="text-green-400">🎯</span> The Result
              </h4>
              <p className="text-gray-300">
                A high-touch, trust-building experience that&apos;s <strong className="text-green-400">remote-capable, 
                scalable, and affordable</strong>—without sacrificing humanity or results.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}