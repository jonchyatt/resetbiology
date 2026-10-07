"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Menu, X, ChevronDown, User, Settings, Shield } from "lucide-react"
import { useUser } from '@auth0/nextjs-auth0'

// Routes where the Header is hidden entirely (full-screen immersive tools).
// Pitch Defender and all its sub-routes use fixed inset-0 layouts that don't
// leave room for a nav bar — past sessions had Jon deleting the header via
// devtools just to reach the Composer's Save button. Hide instead of covering.
const HEADER_HIDDEN_PREFIXES = ['/pitch-defender']
function shouldHideHeader(pathname: string | null): boolean {
  if (!pathname) return false
  return HEADER_HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export function Header() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { user, isLoading } = useUser()
  const isAdmin = user?.role === 'admin'

  // Hide on full-screen immersive routes so the fixed nav bar doesn't cover
  // the content. Each such route owns its own navigation (← Back links).
  if (shouldHideHeader(pathname)) return null

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isUserMenuOpen && !(e.target as Element).closest('.user-menu-container')) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isUserMenuOpen])

  return (
    <header
      className="fixed top-0 z-50 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex transition-opacity hover:opacity-80">
            <img
              src="/reset-logo-pro.png"
              alt="Reset Biology"
              className="h-8 w-auto"
            />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {!isLoading && !user && (
              <>
                <Link href="/get-started" className="font-medium text-slate-200 transition-colors hover:text-primary-300">
                  Get started
                </Link>
                <a
                  href="/auth/login?returnTo=/portal"
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-primary-300"
                >
                  Log in
                </a>
              </>
            )}

            {!isLoading && user && (
              <>
                <Link href="/peptides" className="font-medium text-slate-200 transition-colors hover:text-primary-300">Peptides</Link>
                <Link href="/nutrition" className="font-medium text-slate-200 transition-colors hover:text-primary-300">Meals</Link>
                <Link href="/journal" className="font-medium text-slate-200 transition-colors hover:text-primary-300">Journal</Link>
                <Link href="/audio" className="font-medium text-slate-200 transition-colors hover:text-primary-300">Hypnosis</Link>
                <Link href="/profile" className="flex items-center font-medium text-slate-200 transition-colors hover:text-primary-300">
                  <Settings className="mr-1 h-4 w-4" />
                  Profile
                </Link>

                <div className="relative user-menu-container">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsUserMenuOpen(!isUserMenuOpen)
                    }}
                    className="flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-primary-300"
                  >
                    <User className="h-4 w-4" />
                    <span>Account</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-800 bg-slate-900 py-2 shadow-lg">
                      <div className="truncate px-4 py-2 text-xs text-slate-400" title={user.email || ''}>
                        Signed in as<br />
                        <span className="font-medium text-slate-100">{user.name || user.email}</span>
                      </div>

                      <hr className="my-2 border-slate-800" />

                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex items-center px-4 py-2 text-amber-300 transition-colors hover:bg-slate-800"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      )}

                      {isAdmin && <hr className="my-2 border-slate-800" />}

                      <a href="/auth/logout" className="flex min-h-11 items-center px-4 py-2 text-slate-200 transition-colors hover:bg-slate-800">
                        Logout
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>

          <button
            className="min-h-11 min-w-11 rounded-lg p-2 text-slate-100 transition-colors hover:bg-slate-800 md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="border-t border-slate-800 py-4 md:hidden">
            <nav className="flex flex-col gap-2">
              {!isLoading && !user ? (
                <>
                  <Link href="/get-started" className="min-h-11 px-2 py-2 font-medium text-slate-200 hover:text-primary-300" onClick={() => setIsMenuOpen(false)}>
                    Get started
                  </Link>
                  <a
                    href="/auth/login?returnTo=/portal"
                    className="block min-h-11 rounded-lg bg-primary-400 px-4 py-3 text-center font-semibold text-slate-950 transition-colors hover:bg-primary-300"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Log in
                  </a>
                </>
              ) : !isLoading && user ? (
                <>
                  <Link href="/peptides" className="min-h-11 px-2 py-2 font-medium text-slate-200 hover:text-primary-300" onClick={() => setIsMenuOpen(false)}>Peptides</Link>
                  <Link href="/nutrition" className="min-h-11 px-2 py-2 font-medium text-slate-200 hover:text-primary-300" onClick={() => setIsMenuOpen(false)}>Meals</Link>
                  <Link href="/journal" className="min-h-11 px-2 py-2 font-medium text-slate-200 hover:text-primary-300" onClick={() => setIsMenuOpen(false)}>Journal</Link>
                  <Link href="/audio" className="min-h-11 px-2 py-2 font-medium text-slate-200 hover:text-primary-300" onClick={() => setIsMenuOpen(false)}>Hypnosis</Link>
                  <Link href="/profile" className="min-h-11 px-2 py-2 font-medium text-slate-200 hover:text-primary-300" onClick={() => setIsMenuOpen(false)}>Profile</Link>
                  {isAdmin && (
                    <Link href="/admin" className="min-h-11 px-2 py-2 font-medium text-amber-300 hover:text-amber-200" onClick={() => setIsMenuOpen(false)}>
                      Admin Dashboard
                    </Link>
                  )}
                  <div className="space-y-2 border-t border-slate-800 pt-3">
                    <div className="px-2 text-slate-300">Hello, {user.name || user.email}</div>
                    <a href="/auth/logout" className="block min-h-11 rounded-lg bg-slate-800 px-4 py-3 text-center font-semibold text-slate-100 transition-colors hover:bg-slate-700">
                      Logout
                    </a>
                  </div>
                </>
              ) : null}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
