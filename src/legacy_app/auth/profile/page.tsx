import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 pt-24 pb-8 relative"
           style={{
             backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        <div className="relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <div className="mb-8 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-shadow-lg animate-fade-in">
                  Account <span className="text-primary-400">Profile</span>
                </h1>
                <p className="text-xl text-gray-200 font-medium drop-shadow-sm">
                  Manage your Reset Biology account settings and permissions
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-4">🔧 Profile Management</h2>
                  <p className="text-gray-300 mb-6">
                    Account management features will be available once the authentication system is implemented.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 bg-primary-600/20 rounded-lg border border-primary-400/30">
                      <h3 className="font-semibold text-primary-300">Coming Soon:</h3>
                      <ul className="text-sm text-gray-300 mt-2 space-y-1">
                        <li>• Account settings and preferences</li>
                        <li>• Subscription and trial management</li>
                        <li>• Progress tracking and analytics</li>
                        <li>• Data export and privacy controls</li>
                      </ul>
                    </div>
                    <a 
                      href="/portal" 
                      className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-colors inline-block"
                    >
                      ← Back to Portal
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}