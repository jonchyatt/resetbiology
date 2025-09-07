"use client"

import { useSession } from "next-auth/react"
import { ReactNode } from "react"
import { SignInButton } from "./SignInButton"
import { hasPermission, getUpgradeMessage } from "@/lib/permissions"
import type { UserPermissions } from "@/lib/permissions"

interface ProtectedRouteProps {
  children: ReactNode
  requiredPermission?: keyof UserPermissions
  fallback?: ReactNode
  showUpgradePrompt?: boolean
}

export function ProtectedRoute({ 
  children, 
  requiredPermission, 
  fallback,
  showUpgradePrompt = true 
}: ProtectedRouteProps) {
  const { data: sessionData, status } = useSession()
  const session = sessionData as any

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  // Not authenticated
  if (!session) {
    if (fallback) return <>{fallback}</>
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Required
            </h2>
            <p className="text-gray-600">
              Please sign in to access this area of the portal.
            </p>
          </div>
          <SignInButton className="w-full" />
          <p className="mt-4 text-sm text-gray-500">
            New to Reset Biology? Sign up takes less than 30 seconds.
          </p>
        </div>
      </div>
    )
  }

  // Check specific permission
  if (requiredPermission && !hasPermission(session, requiredPermission)) {
    if (fallback) return <>{fallback}</>
    
    if (!showUpgradePrompt) return null
    
    const upgradeMessage = getUpgradeMessage(session, requiredPermission)
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Upgrade Required
            </h2>
            <p className="text-gray-600 mb-4">
              {upgradeMessage}
            </p>
          </div>
          <button
            className="w-full bg-teal-600 text-white py-3 px-4 rounded-md hover:bg-teal-700 transition-colors font-medium"
            onClick={() => {
              // TODO: Redirect to upgrade/trial flow
              console.log("Upgrade clicked")
            }}
          >
            {session.user?.accessLevel === 'guest' ? 'Start Free Trial' : 'Upgrade Now'}
          </button>
          <p className="mt-4 text-sm text-gray-500">
            Current access level: {session.user?.accessLevel || 'Guest'}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}