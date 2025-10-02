"use client"

import { ReactNode } from "react"
// Temporarily removed Auth0 UserProvider due to Next.js 15 compatibility

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      {children}
    </>
  )
}