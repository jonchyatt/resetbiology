"use client"

import { ReactNode, useEffect, useState } from "react"

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ProtectedRoute({
  children,
  fallback
}: ProtectedRouteProps) {
  const [status, setStatus] = useState<"checking" | "authed">("checking")

  useEffect(() => {
    let cancelled = false
    fetch("/auth/profile")
      .then(res => {
        if (cancelled) return
        if (res.ok) {
          setStatus("authed")
        } else {
          window.location.href =
            `/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`
        }
      })
      .catch(() => {
        if (!cancelled) {
          window.location.href =
            `/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`
        }
      })
    return () => { cancelled = true }
  }, [])

  if (status !== "authed") {
    return <>{fallback ?? null}</>
  }

  return <>{children}</>
}
