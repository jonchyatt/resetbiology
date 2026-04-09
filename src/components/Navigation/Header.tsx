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
      className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img 
              src="/reset-logo-pro.png" 
              alt="Reset Biology" 
              className="h-14 w-auto rounded-xl drop-shadow-lg hover:drop-shadow-xl transition-all duration-300 bg-white/10 backdrop-blur-sm p-2 border border-white/20"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {/* Public/Logged Out Navigation */}
            {!user && (
              <>
                <Link href="/order" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                  Peptide Co-op
                </Link>
                <a
                  href="/auth/login?returnTo=/portal"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  Login / Sign Up
                </a>
              </>
            )}
            
            {/* Logged In Navigation */}
            {user && (
              <>
                <Link href="/portal" className="text-gray-700 hover:text-teal-600 font-medium transition-colors">
                  Portal
                </Link>
                <Link href="/order" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                  Peptide Co-op
                </Link>
                <Link href="/education" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                  Education
                </Link>
                <Link href="/profile" className="text-gray-700 hover:text-teal-600 font-medium transition-colors flex items-center">
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
                    className="flex items-center space-x-2 text-gray-700 hover:text-teal-600 font-medium transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>{user.name || user.email || 'Account'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex items-center px-4 py-2 text-orange-600 hover:bg-orange-50 transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Admin Dashboard
                        </Link>
                      )}
                      
                      <hr className="my-2 border-gray-200" />
                      
                      <a 
                        href="/auth/logout" 
                        className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
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
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4">
              {!user ? (
                <>
                  <Link href="/order" className="text-gray-700 hover:text-green-600 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Peptide Co-op
                  </Link>
                  <a
                    href="/auth/login?returnTo=/portal"
                    className="block px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Login / Sign Up
                  </a>
                </>
              ) : (
                <>
                  <Link href="/portal" className="text-gray-700 hover:text-teal-600 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Portal
                  </Link>
                  <Link href="/order" className="text-gray-700 hover:text-green-600 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Peptide Co-op
                  </Link>
                  <Link href="/education" className="text-gray-700 hover:text-primary-600 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Education
                  </Link>
                  <Link href="/profile" className="text-gray-700 hover:text-teal-600 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="text-orange-600 hover:text-orange-700 font-medium" onClick={() => setIsMenuOpen(false)}>
                      Admin Dashboard
                    </Link>
                  )}
                  <div className="pt-2 space-y-2">
                    <div className="text-gray-700">Hello, {user.name || user.email}</div>
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