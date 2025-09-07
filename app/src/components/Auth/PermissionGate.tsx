"use client"

import { useSession } from "next-auth/react"
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
  const { data: sessionData } = useSession()
  const session = sessionData as any

  if (hasPermission(session, permission)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showUpgradePrompt) {
    return null
  }

  const upgradeMessage = getUpgradeMessage(session, permission)
  const canTrial = canStartTrial(session)

  return (
    <div className="bg-gradient-to-r from-teal-50 to-green-50 border border-teal-200 rounded-lg p-6 text-center">
      <div className="max-w-md mx-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Premium Feature
        </h3>
        <p className="text-gray-600 mb-4">
          {upgradeMessage}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {canTrial ? (
            <button
              className="bg-teal-600 text-white px-6 py-2 rounded-md hover:bg-teal-700 transition-colors font-medium"
              onClick={() => {
                // TODO: Start trial flow
                console.log("Start trial clicked")
              }}
            >
              Start 7-Day Free Trial
            </button>
          ) : (
            <button
              className="bg-teal-600 text-white px-6 py-2 rounded-md hover:bg-teal-700 transition-colors font-medium"
              onClick={() => {
                // TODO: Upgrade flow
                console.log("Upgrade clicked")
              }}
            >
              Upgrade Access
            </button>
          )}
          <button
            className="text-teal-600 px-6 py-2 rounded-md border border-teal-600 hover:bg-teal-50 transition-colors font-medium"
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