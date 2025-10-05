import { PortalHeader } from "@/components/Navigation/PortalHeader"

export default function ModulesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        <PortalHeader
          section="Mental Mastery Modules"
          subtitle="Transform your mindset and metabolic health"
          showOrderPeptides={false}
        />

        {/* Title Section - Matching Tracker Pages */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-primary-400">Mental Mastery</span> Modules
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm">
            Transform your mindset and achieve metabolic mastery through comprehensive audio training
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Module Series */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Foundation Series */}
            <div className="card-hover-primary">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🧠</div>
                <h2 className="text-2xl font-bold text-white mb-2">Foundation Series</h2>
                <p className="text-gray-300">30 core modules for metabolic awakening</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <span className="text-white font-medium">Module 1: Appetite Reset</span>
                  <span className="text-green-400">✓</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <span className="text-white font-medium">Module 2: Metabolic Awakening</span>
                  <span className="text-green-400">✓</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <span className="text-white font-medium">Module 3: Stress & Cortisol</span>
                  <span className="text-blue-400">●</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <span className="text-gray-400 font-medium">Module 4: Sleep Optimization</span>
                  <span className="text-gray-500">○</span>
                </div>
              </div>
              
              <a href="/modules/foundation" className="action-btn-primary w-full py-3 px-6 text-center block">
                🎧 Start Audio Training
              </a>
            </div>

            {/* Integration Series */}
            <div className="card-hover-primary">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">⚡</div>
                <h2 className="text-2xl font-bold text-white mb-2">Integration Series</h2>
                <p className="text-gray-300">Advanced real-world application modules</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-600/20 border border-blue-400/30">
                  <span className="text-gray-400 font-medium">Module 31: Real-World Application</span>
                  <span className="text-gray-500">🔒</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-600/20 border border-blue-400/30">
                  <span className="text-gray-400 font-medium">Module 32: Social Situations</span>
                  <span className="text-gray-500">🔒</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-600/20 border border-blue-400/30">
                  <span className="text-gray-400 font-medium">Module 33: Travel & Events</span>
                  <span className="text-gray-500">🔒</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-600/20 border border-blue-400/30">
                  <span className="text-gray-400 font-medium">Module 34: Long-term Habits</span>
                  <span className="text-gray-500">🔒</span>
                </div>
              </div>

              <a href="/modules/integration" className="action-btn-primary w-full py-3 px-6 text-center block">
                🎧 Start Audio Training
              </a>
            </div>

            {/* Mastery Series */}
            <div className="card-hover-primary">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🎯</div>
                <h2 className="text-2xl font-bold text-white mb-2">Mastery Series</h2>
                <p className="text-gray-300">Peptide independence & maintenance</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-600/20 border border-purple-400/30">
                  <span className="text-gray-400 font-medium">Module 61: Peptide Tapering</span>
                  <span className="text-gray-500">🔒</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-600/20 border border-purple-400/30">
                  <span className="text-gray-400 font-medium">Module 62: Independence</span>
                  <span className="text-gray-500">🔒</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-600/20 border border-purple-400/30">
                  <span className="text-gray-400 font-medium">Module 63: Maintenance</span>
                  <span className="text-gray-500">🔒</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-600/20 border border-purple-400/30">
                  <span className="text-gray-400 font-medium">Module 64: Mastery</span>
                  <span className="text-gray-500">🔒</span>
                </div>
              </div>

              <a href="/modules/mastery" className="action-btn-primary w-full py-3 px-6 text-center block">
                🎧 Start Audio Training
              </a>
            </div>
          </div>

          {/* Progress Stats */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stat-card-hover p-6 text-center">
              <div className="text-3xl font-bold text-primary-300 mb-2">12/30</div>
              <div className="text-gray-300">Foundation Modules</div>
            </div>
            <div className="stat-card-hover p-6 text-center">
              <div className="text-3xl font-bold text-blue-300 mb-2">0/30</div>
              <div className="text-gray-300">Integration Modules</div>
            </div>
            <div className="stat-card-hover p-6 text-center">
              <div className="text-3xl font-bold text-purple-300 mb-2">0/30</div>
              <div className="text-gray-300">Mastery Modules</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const metadata = {
  title: "Mental Mastery Modules - Reset Biology",
  description: "Transform your mindset and achieve metabolic mastery through our comprehensive audio training program.",
}