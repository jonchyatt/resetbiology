// app/portal-test/page.tsx - Professional Portal Design Test
export default function PortalTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Header Section */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-shadow-lg animate-fade-in">
              Welcome to Your <span className="text-primary-400">Portal</span>
            </h1>
            <p className="text-xl text-gray-200 font-medium drop-shadow-sm">
              Your complete wellness and metabolic optimization dashboard
            </p>
          </div>

          {/* Stats Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-300 mb-2">47</div>
                <div className="text-sm text-gray-300">Days Active</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-secondary-400/30">
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary-300 mb-2">12.3%</div>
                <div className="text-sm text-gray-300">Body Fat Reduction</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-300 mb-2">156</div>
                <div className="text-sm text-gray-300">Breath Sessions</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-secondary-400/30">
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary-300 mb-2">$847</div>
                <div className="text-sm text-gray-300">Affiliate Earnings</div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Progress Tracking */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
                <h2 className="text-2xl font-bold text-white mb-6">Progress Tracking</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gradient-to-br from-primary-600/20 to-primary-700/30 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 shadow-xl">
                    <h3 className="text-lg font-semibold text-white mb-3">Peptide Protocol</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Ipamorelin</span>
                        <span className="text-primary-300">Day 23/30</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-primary-400 h-2 rounded-full" style={{width: '76%'}}></div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">CJC-1295</span>
                        <span className="text-primary-300">Day 18/30</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-primary-400 h-2 rounded-full" style={{width: '60%'}}></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-secondary-600/20 to-secondary-700/30 backdrop-blur-sm rounded-xl p-4 border border-secondary-400/30 shadow-xl">
                    <h3 className="text-lg font-semibold text-white mb-3">Breath Training</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">This Week</span>
                        <span className="text-secondary-300">5/7 days</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-secondary-400 h-2 rounded-full" style={{width: '71%'}}></div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Average Hold</span>
                        <span className="text-secondary-300">2:47</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <button className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-lg transition-colors">
                    View Detailed Analytics
                  </button>
                </div>
              </div>
            </div>
            
            {/* Quick Actions & Tools */}
            <div className="space-y-6">
              
              {/* Quick Actions */}
              <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-secondary-400/30">
                <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full text-left px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white flex items-center">
                    <span className="mr-3">🫁</span>
                    Start Breath Session
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white flex items-center">
                    <span className="mr-3">💊</span>
                    Log Peptide Dose
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white flex items-center">
                    <span className="mr-3">📊</span>
                    Record Metrics
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white flex items-center">
                    <span className="mr-3">🎯</span>
                    View Goals
                  </button>
                </div>
              </div>
              
              {/* Affiliate Program */}
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
                <h3 className="text-xl font-bold text-white mb-4">Affiliate Program</h3>
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-300 mb-1">$847.32</div>
                    <div className="text-sm text-gray-300">Total Earnings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-secondary-300 mb-1">23 Referrals</div>
                    <div className="text-sm text-gray-300">This Month</div>
                  </div>
                  <button className="w-full bg-secondary-600/20 hover:bg-secondary-600/30 border border-secondary-400/30 rounded-lg py-2 text-white transition-colors">
                    Generate Referral Link
                  </button>
                  <button className="w-full bg-primary-600/20 hover:bg-primary-600/30 border border-primary-400/30 rounded-lg py-2 text-white transition-colors">
                    View Commission Details
                  </button>
                </div>
              </div>
              
            </div>
          </div>
          
          {/* Recent Activity */}
          <div className="mt-8">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-600/30">
                  <div className="flex items-center">
                    <span className="mr-3 text-primary-400">💊</span>
                    <div>
                      <div className="text-white font-medium">Ipamorelin dose logged</div>
                      <div className="text-sm text-gray-400">300mcg - Morning protocol</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">2 hours ago</div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-600/30">
                  <div className="flex items-center">
                    <span className="mr-3 text-secondary-400">🫁</span>
                    <div>
                      <div className="text-white font-medium">Breath training completed</div>
                      <div className="text-sm text-gray-400">4 cycles, 2:34 average hold</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">5 hours ago</div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <span className="mr-3 text-primary-400">🎯</span>
                    <div>
                      <div className="text-white font-medium">Weekly goal achieved</div>
                      <div className="text-sm text-gray-400">Breath training consistency: 85%</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">1 day ago</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Logout */}
          <div className="mt-8 text-center">
            <a 
              href="/auth/logout" 
              className="inline-block px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-400/30 rounded-lg text-white transition-colors font-medium"
            >
              Logout
            </a>
          </div>
          
        </div>
      </div>
    </div>
  );
}