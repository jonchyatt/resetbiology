"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
// Temporarily removed Auth0 useUser due to Next.js 15 compatibility

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // Temporarily simplified due to Auth0 Next.js 15 compatibility issues
  const user = null as any; // Will be replaced with proper Auth0 once compatibility is resolved
  const isLoading = false;

  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
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
            <Link href="/process" className="text-gray-700 hover:text-teal-600 font-medium transition-colors">
              How It Works
            </Link>
            <Link href="/breath" className="text-gray-700 hover:text-teal-600 font-medium transition-colors">
              Breath Training
            </Link>
            <Link href="/education" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Research
            </Link>
            <Link href="/order" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
              Order
            </Link>
            <Link href="/peptides" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              Peptides
            </Link>
            <Link href="/modules" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Modules
            </Link>
            <Link href="/portal" className="text-gray-700 hover:text-teal-600 font-medium transition-colors">
              Portal
            </Link>
            <Link href="/profile" className="text-gray-700 hover:text-teal-600 font-medium transition-colors">
              Profile
            </Link>
            <Link href="/admin" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">
              Admin
            </Link>
            {!isLoading && (
              user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700">Hello, {user.name || user.email}</span>
                  <a 
                    href="/api/auth/logout" 
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Logout
                  </a>
                </div>
              ) : (
                <a 
                  href="/api/auth/login" 
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  Login
                </a>
              )
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
              <Link href="/process" className="text-gray-700 hover:text-teal-600 font-medium">
                How It Works
              </Link>
              <Link href="/breath" className="text-gray-700 hover:text-teal-600 font-medium">
                Breath Training
              </Link>
              <Link href="/education" className="text-gray-700 hover:text-blue-600 font-medium">
                Research
              </Link>
              <Link href="/order" className="text-gray-700 hover:text-green-600 font-medium">
                Order
              </Link>
              <Link href="/peptides" className="text-gray-700 hover:text-primary-600 font-medium">
                Peptides
              </Link>
              <Link href="/modules" className="text-gray-700 hover:text-purple-600 font-medium">
                Modules
              </Link>
              <Link href="/portal" className="text-gray-700 hover:text-teal-600 font-medium">
                Portal
              </Link>
              <Link href="/profile" className="text-gray-700 hover:text-teal-600 font-medium">
                Profile
              </Link>
              <Link href="/admin" className="text-gray-700 hover:text-orange-600 font-medium">
                Admin
              </Link>
              {!isLoading && (
                <div className="pt-2">
                  {user ? (
                    <div className="space-y-2">
                      <div className="text-gray-700">Hello, {user.name || user.email}</div>
                      <a 
                        href="/api/auth/logout" 
                        className="block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-center"
                      >
                        Logout
                      </a>
                    </div>
                  ) : (
                    <a 
                      href="/api/auth/login" 
                      className="block px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-center"
                    >
                      Login
                    </a>
                  )}
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}