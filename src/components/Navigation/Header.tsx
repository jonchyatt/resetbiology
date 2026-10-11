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
  // Full-screen tools intentionally render no site header. Keep the Auth0
  // profile hook out of those routes so they do not make an unused request.
  if (shouldHideHeader(pathname)) return null
  return <HeaderContent />
}

function HeaderContent() {
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

  return (
    <header
      data-rb-site-header
      className="fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 py-2 transition-opacity hover:opacity-80">
            <span className="relative block h-[52px] w-[58px] shrink-0 overflow-hidden">
              <img
                src="/reset-logo-pro.png"
                alt=""
                width={96}
                height={96}
                className="absolute -left-5 -top-3.5 h-24 w-24 max-w-none mix-blend-lighten"
              />
            </span>
            <span className="text-lg font-semibold tracking-[-0.01em] text-white">Reset Biology</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {/* Public/Logged Out Navigation — only renders once auth has resolved
                (isLoading=false), otherwise the logged-out nav flashes before
                Auth0 confirms the user is signed in, which makes Education
                appear to "get erased by another tab" on first paint. */}
            {!isLoading && !user && (
              <>
                <a
                  href="/auth/login?returnTo=/portal"
                  className="rounded-lg border border-primary-400/50 px-4 py-2 text-primary-200 transition-colors hover:bg-primary-400/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300"
                >
                  Log in
                </a>
                <Link
                  href="/get-started"
                  aria-current={pathname === '/get-started' ? 'page' : undefined}
                  className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
                >
                  Start free
                </Link>
              </>
            )}
            
            {/* Logged In Navigation */}
            {!isLoading && user && (
              <>
                <Link href="/portal" aria-current={pathname === '/portal' ? 'page' : undefined} className="text-slate-300 hover:text-white font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 rounded-sm">
                  Portal
                </Link>
                <Link href="/education" aria-current={pathname === '/education' ? 'page' : undefined} className="text-slate-300 hover:text-white font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 rounded-sm">
                  Education
                </Link>
                <Link href="/profile" aria-current={pathname === '/profile' ? 'page' : undefined} className="text-slate-300 hover:text-white font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 rounded-sm flex items-center">
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
                    className="flex items-center space-x-2 text-slate-300 hover:text-white font-medium transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>Account</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg border border-white/10 bg-slate-900 py-2 shadow-2xl">
                      {/* Show which account is signed in (the email used to be in
                          the trigger button itself, but it widened the nav bar
                          enough to cause a visible layout shift on auth resolve). */}
                      <div className="px-4 py-2 text-xs text-slate-400 truncate" title={user.email || ''}>
                        Signed in as<br />
                        <span className="text-slate-100 font-medium">{user.name || user.email}</span>
                      </div>

                      <hr className="my-2 border-white/10" />

                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex items-center px-4 py-2 text-orange-300 hover:bg-white/5 transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Admin Dashboard
                        </Link>
                      )}

                      {isAdmin && <hr className="my-2 border-white/10" />}

                      <a
                        href="/auth/logout"
                        className="flex items-center px-4 py-2 text-red-300 hover:bg-white/5 transition-colors"
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
            className="md:hidden p-2 text-slate-200"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="rb-mobile-nav"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div id="rb-mobile-nav" className="md:hidden py-4 border-t border-white/10">
            <nav className="flex flex-col space-y-4">
              {!user ? (
                <>
                  <a
                    href="/auth/login?returnTo=/portal"
                    className="block rounded-lg border border-primary-400/50 px-4 py-2 text-center text-primary-200 transition-colors hover:bg-primary-400/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Log in
                  </a>
                  <Link
                    href="/get-started"
                    aria-current={pathname === '/get-started' ? 'page' : undefined}
                    className="block rounded-lg bg-primary-400 px-4 py-3 text-center font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Start free
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/portal" aria-current={pathname === '/portal' ? 'page' : undefined} className="text-slate-300 hover:text-white font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 rounded-sm" onClick={() => setIsMenuOpen(false)}>
                    Portal
                  </Link>
                  <Link href="/education" aria-current={pathname === '/education' ? 'page' : undefined} className="text-slate-300 hover:text-white font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 rounded-sm" onClick={() => setIsMenuOpen(false)}>
                    Education
                  </Link>
                  <Link href="/profile" aria-current={pathname === '/profile' ? 'page' : undefined} className="text-slate-300 hover:text-white font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 rounded-sm" onClick={() => setIsMenuOpen(false)}>
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="text-orange-300 hover:text-orange-200 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 rounded-sm" onClick={() => setIsMenuOpen(false)}>
                      Admin Dashboard
                    </Link>
                  )}
                  <div className="pt-2 space-y-2">
                    <div className="text-slate-300">Hello, {user.name || user.email}</div>
                    <a
                      href="/auth/logout"
                      className="block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-center"
                    >
                      Logout
                    </a>
                  </div>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
