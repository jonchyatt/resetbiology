"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { SignInButton } from "@/components/Auth/SignInButton"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
            <Link href="/portal" className="text-gray-700 hover:text-teal-600 font-medium transition-colors">
              Portal
            </Link>
            <Link href="/auth/profile" className="text-gray-700 hover:text-teal-600 font-medium transition-colors">
              Profile
            </Link>
            <Link href="/admin" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">
              Admin
            </Link>
            <SignInButton />
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
              <Link href="/portal" className="text-gray-700 hover:text-teal-600 font-medium">
                Portal
              </Link>
              <Link href="/auth/profile" className="text-gray-700 hover:text-teal-600 font-medium">
                Profile
              </Link>
              <Link href="/admin" className="text-gray-700 hover:text-orange-600 font-medium">
                Admin
              </Link>
              <div className="pt-2">
                <SignInButton showUserInfo={true} />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}