export default async function SuccessPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const sessionId = params['session_id'];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-12 shadow-2xl border border-primary-400/30 max-w-2xl mx-auto text-center hover:shadow-primary-400/20 transition-all duration-300">
            <div className="mb-6">
              <svg className="w-24 h-24 mx-auto text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-4">
              Order <span className="text-primary-400">Successful!</span>
            </h1>
            
            <p className="text-xl text-gray-300 mb-4">
              Thank you for your purchase!
            </p>
            
            {sessionId && (
              <p className="text-sm text-gray-400 mb-8 font-mono">
                Order ID: {sessionId.slice(0, 20)}...
              </p>
            )}
            
            <p className="text-gray-300 mb-8">
              You will receive an email confirmation shortly with your order details.
            </p>
            
            <div className="space-y-4">
              <a 
                href="/portal"
                className="inline-block bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-primary-500/30 transition-all duration-200"
              >
                Go to Portal
              </a>
              
              <div>
                <a 
                  href="/order"
                  className="inline-block text-primary-400 hover:text-primary-300 font-medium transition-colors"
                >
                  Continue Shopping →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}