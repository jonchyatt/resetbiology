"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { User, LogOut } from "lucide-react"

interface SignInButtonProps {
  className?: string
  showUserInfo?: boolean
}

export function SignInButton({ className = "", showUserInfo = false }: SignInButtonProps) {
  const { data: sessionData, status } = useSession()
  const session = sessionData as any

  if (status === "loading") {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-10 w-24 bg-gray-200 rounded-md"></div>
      </div>
    )
  }

  if (session) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {showUserInfo && (
          <div className="flex items-center gap-2">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="text-sm">
              <div className="font-medium">{session.user?.name}</div>
              <div className="text-gray-500 capitalize">
                {session.user?.accessLevel || 'Guest'} Access
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => signIn("google")}
      className={`inline-flex items-center justify-center gap-3 px-6 py-3 text-white bg-teal-600 border border-transparent rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors ${className}`}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Sign in with Google
    </button>
  )
}