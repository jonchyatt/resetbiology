import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { ModuleLibrary } from "@/components/Audio/ModuleLibrary"

export default function AudioPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
           style={{
             backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        <div className="relative z-10">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 drop-shadow-lg" />
                  <div>
                    <h1 className="text-xl font-bold text-white drop-shadow-lg">Portal</h1>
                    <span className="text-lg text-gray-200 drop-shadow-sm">• Mental Mastery Modules</span>
                  </div>
                </div>
                <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                  ← Back to Portal
                </a>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="container mx-auto px-4 py-8">
            <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <ModuleLibrary userId="current-user" />
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}