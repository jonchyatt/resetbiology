"use client"

import { ReactNode } from "react"

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ProtectedRoute({ 
  children, 
  fallback
}: ProtectedRouteProps) {
  // For now, just render children without authentication
  // Authentication will be implemented later
  return <>{children}</>
}