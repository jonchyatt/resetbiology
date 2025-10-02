export const dynamic = 'force-dynamic';

async function getStatus() {
  // Use relative URL for API call - will work on both local and production
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/health/db`, { 
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    
    return await res.json();
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Failed to fetch' };
  }
}

export default async function AdminDbPage() {
  const status = await getStatus();
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Database Health Monitor</h1>
        
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${status.ok ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-lg font-medium text-white">
              Status: {status.ok ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <pre className="text-sm bg-gray-900 text-green-400 p-4 rounded overflow-x-auto font-mono">
{JSON.stringify(status, null, 2)}
          </pre>
        </div>
        
        <div className="mt-4 text-gray-400 text-sm">
          <p>Endpoint: /api/health/db</p>
          <p>Runtime: Node.js (no caching)</p>
          <p>Database: MongoDB via Prisma</p>
        </div>
      </div>
    </main>
  );
}