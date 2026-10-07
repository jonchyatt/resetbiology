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

  // Hide on full-screen immersive routes so the fixed nav bar doesn't cover
  // the content. Each such route owns its own navigation (← Back links).
  if (shouldHideHeader(pathname)) return null

  return (
    <header
      className="fixed top-0 w-full z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img 
              src="/reset-logo-pro.png" 
              alt="Reset Biology" 
              className="h-12 w-auto rounded-lg border border-slate-800 bg-slate-900 p-1 transition-opacity duration-200"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-5">
            {/* Public/Logged Out Navigation — only renders once auth has resolved
                (isLoading=false), otherwise the logged-out nav flashes before
                Auth0 confirms the user is signed in, which makes Education
                appear to "get erased by another tab" on first paint. */}
            {!isLoading && !user && (
              <>
                <Link href="/order" className="min-h-11 inline-flex items-center text-slate-300 hover:text-primary-300 font-medium transition-colors">
                  Peptide Co-op
                </Link>
                <Link href="/get-started" className="min-h-11 inline-flex items-center text-slate-100 hover:text-primary-300 font-medium transition-colors">
                  Get started
                </Link>
                <a
                  href="/auth/login?returnTo=/portal"
                  className="min-h-11 inline-flex items-center rounded-lg bg-primary-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-primary-300"
                >
                  Log in
                </a>
              </>
            )}
            
            {/* Logged In Navigation */}
            {!isLoading && user && (
              <>
                <Link href="/portal" className="text-slate-300 hover:text-primary-300 font-medium transition-colors">
                  Portal
                </Link>
                <Link href="/peptides" className="text-slate-300 hover:text-primary-300 font-medium transition-colors">
                  Peptides
                </Link>
                <Link href="/nutrition" className="text-slate-300 hover:text-primary-300 font-medium transition-colors">
                  Meals
                </Link>
                <Link href="/journal" className="text-slate-300 hover:text-primary-300 font-medium transition-colors">
                  Journal
                </Link>
                <Link href="/modules" className="text-slate-300 hover:text-primary-300 font-medium transition-colors">
                  Hypnosis
                </Link>
                <Link href="/profile" className="text-slate-300 hover:text-primary-300 font-medium transition-colors flex items-center">
                  <Settings className="w-4 h-4 mr-1" />
                  Profile
                </Link>

                {/* User Menu Dropdown */}
                <div className="relative user-menu-container">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsUserMenuOpen(!isUserMenuOpen)
                    }}
                    className="min-h-11 flex items-center space-x-2 text-slate-300 hover:text-primary-300 font-medium transition-colors"
                    aria-expanded={isUserMenuOpen}
                    aria-label="Open account menu"
                  >
                    <User className="w-4 h-4" />
                    <span>Account</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-700 bg-slate-900 py-2 shadow-lg">
                      {/* Show which account is signed in (the email used to be in
                          the trigger button itself, but it widened the nav bar
                          enough to cause a visible layout shift on auth resolve). */}
                      <div className="px-4 py-2 text-sm text-slate-400 truncate" title={user.email || ''}>
                        Signed in as<br />
                        <span className="text-slate-100 font-medium">{user.name || user.email}</span>
                      </div>

                      <hr className="my-2 border-slate-700" />

                      <Link href="/education" className="flex min-h-11 items-center px-4 py-2 text-slate-200 hover:bg-slate-800" onClick={() => setIsUserMenuOpen(false)}>
                        Education
                      </Link>
                      <Link href="/order" className="flex min-h-11 items-center px-4 py-2 text-slate-200 hover:bg-slate-800" onClick={() => setIsUserMenuOpen(false)}>
                        Peptide Co-op
                      </Link>

                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex min-h-11 items-center px-4 py-2 text-amber-300 hover:bg-slate-800 transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Admin Dashboard
                        </Link>
                      )}

                      {isAdmin && <hr className="my-2 border-slate-700" />}

                      <a
                        href="/auth/logout"
                        className="flex min-h-11 items-center px-4 py-2 text-red-300 hover:bg-slate-800 transition-colors"
                      >
                        Logout
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden min-h-11 min-w-11 p-2 text-slate-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <nav className="flex flex-col space-y-4">
              {!isLoading && !user ? (
                <>
                  <Link href="/order" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Peptide Co-op
                  </Link>
                  <Link href="/get-started" className="min-h-11 flex items-center text-slate-100 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Get started
                  </Link>
                  <a
                    href="/auth/login?returnTo=/portal"
                    className="min-h-11 flex items-center justify-center rounded-lg bg-primary-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-primary-300"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Log in
                  </a>
                </>
              ) : !isLoading && user ? (
                <>
                  <Link href="/portal" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Portal
                  </Link>
                  <Link href="/peptides" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Peptides
                  </Link>
                  <Link href="/nutrition" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Meals
                  </Link>
                  <Link href="/journal" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Journal
                  </Link>
                  <Link href="/modules" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Hypnosis
                  </Link>
                  <Link href="/education" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Education
                  </Link>
                  <Link href="/order" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Peptide Co-op
                  </Link>
                  <Link href="/profile" className="min-h-11 flex items-center text-slate-300 hover:text-primary-300 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="min-h-11 flex items-center text-amber-300 hover:text-amber-200 font-medium" onClick={() => setIsMenuOpen(false)}>
                      Admin Dashboard
                    </Link>
                  )}
                  <div className="pt-2 space-y-2">
                    <div className="text-slate-400">Hello, {user.name || user.email}</div>
                    <a
                      href="/auth/logout"
                      className="min-h-11 flex items-center justify-center rounded-lg border border-red-400/40 px-4 py-2 text-red-200 transition-colors hover:bg-red-950"
                    >
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