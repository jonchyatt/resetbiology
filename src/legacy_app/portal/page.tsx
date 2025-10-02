// Simplified Auth0 implementation due to Next.js 15 compatibility issues
export default async function PortalPage() {
  // For now, render the portal without Auth0 session checks
  // This will be updated once Auth0 Next.js 15 compatibility is resolved

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600/10 to-secondary-600/20 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
          <h1 className="text-3xl font-bold text-white mb-6">Client Portal</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-primary-600/20 to-primary-700/30 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4">Welcome to the Portal</h2>
              <p className="text-gray-300">Access your personalized wellness dashboard and track your progress.</p>
            </div>
            
            <div className="bg-gradient-to-br from-secondary-600/20 to-secondary-700/30 backdrop-blur-sm rounded-xl p-4 border border-secondary-400/30 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-2">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
                  📊 View Progress
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
                  🫁 Breath Training
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
                  💊 Peptide Tracking
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <a 
              href="/auth/logout" 
              className="inline-block px-6 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-400/30 rounded-lg text-white transition-colors"
            >
              Logout
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}