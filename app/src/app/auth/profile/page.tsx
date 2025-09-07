import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { UserManagement } from "@/components/Auth/UserManagement"

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
              
              <UserManagement />
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}