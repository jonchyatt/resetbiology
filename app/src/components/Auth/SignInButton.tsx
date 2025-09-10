"use client"

import { User } from "lucide-react"

interface SignInButtonProps {
  className?: string
  showUserInfo?: boolean
}

export function SignInButton({ className = "", showUserInfo = false }: SignInButtonProps) {
  // For now, just show a simple sign in button without authentication
  // Authentication will be implemented later
  
  return (
    <button
      onClick={() => {
        // TODO: Implement authentication
        console.log("Sign in clicked")
      }}
      className={`flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors ${className}`}
    >
      <User className="w-4 h-4" />
      Sign In
    </button>
  )
}