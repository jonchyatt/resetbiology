"use client"

import { ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

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
  // Router pathname, not window.location: during a client-side navigation the
  // address bar still shows the PREVIOUS (public) page when this first renders,
  // which let the member UI through for logged-out visitors.
  const pathname = usePathname() ?? ""
  const publicPath = isPublicPath(pathname)

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
            `/auth/login?returnTo=${encodeURIComponent(pathname)}`
        }
      })
      .catch(() => {
        if (!cancelled) {
          window.location.href =
            `/auth/login?returnTo=${encodeURIComponent(pathname)}`
        }
      })
    return () => { cancelled = true }
  }, [publicPath, pathname])

  if (publicPath) {
    return <>{children}</>
  }

  if (status !== "authed") {
    return <>{fallback ?? null}</>
  }

  return <>{children}</>
}
