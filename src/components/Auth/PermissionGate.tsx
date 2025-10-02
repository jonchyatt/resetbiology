"use client"

import { ReactNode } from "react"
import { hasPermission, getUpgradeMessage, canStartTrial } from "@/lib/permissions"
import type { UserPermissions } from "@/lib/permissions"

interface PermissionGateProps {
  children: ReactNode
  permission: keyof UserPermissions
  fallback?: ReactNode
  showUpgradePrompt?: boolean
}

export function PermissionGate({ 
  children, 
  permission, 
  fallback,
  showUpgradePrompt = true 
}: PermissionGateProps) {
  // Mock session for Auth0 transition - assume trial access for logged-in users
  const mockSession = {
    user: {
      email: "user@example.com", // This would come from Auth0 context
      accessLevel: "trial" as const
    }
  }

  if (hasPermission(mockSession, permission)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showUpgradePrompt) {
    return null
  }

  const upgradeMessage = getUpgradeMessage(mockSession, permission)
  const canTrial = canStartTrial(mockSession)

  return (
    <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm border border-primary-400/30 rounded-lg p-6 text-center shadow-xl">
      <div className="max-w-md mx-auto">
        <h3 className="text-lg font-semibold text-white mb-2">
          Premium Feature
        </h3>
        <p className="text-gray-300 mb-4">
          {upgradeMessage}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {canTrial ? (
            <button
              className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 transition-colors font-medium"
              onClick={() => {
                // TODO: Start trial flow
                console.log("Start trial clicked")
              }}
            >
              Start 7-Day Free Trial
            </button>
          ) : (
            <button
              className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 transition-colors font-medium"
              onClick={() => {
                // TODO: Upgrade flow
                console.log("Upgrade clicked")
              }}
            >
              Upgrade Access
            </button>
          )}
          <button
            className="text-primary-400 px-6 py-2 rounded-md border border-primary-400/50 hover:bg-primary-600/20 transition-colors font-medium"
            onClick={() => {
              // TODO: Learn more about features
              console.log("Learn more clicked")
            }}
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}