"use client"

import { ReactNode, useEffect, useState } from "react"

const PUBLIC_PATHS = [
  "/",
  "/get-started",
  "/order",
  "/education",
  "/specialists",
  "/breath",
  "/terms",
  "/privacy",
  "/contact",
  "/about"
]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ProtectedRoute({
  children,
  fallback
}: ProtectedRouteProps) {
  const [status, setStatus] = useState<"checking" | "authed">("checking")
  const publicPath =
    typeof window !== "undefined" && isPublicPath(window.location.pathname)

  useEffect(() => {
    if (publicPath) return
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
  }, [publicPath])

  if (publicPath) {
    return <>{children}</>
  }

  if (status !== "authed") {
    return <>{fallback ?? null}</>
  }

  return <>{children}</>
}
