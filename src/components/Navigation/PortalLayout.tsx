"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { ReactNode } from "react"

interface PortalLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
}

export function PortalLayout({ children, title, subtitle }: PortalLayoutProps) {
  const pathname = usePathname()
  const isPortalHome = pathname === "/portal"

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Sub-navigation bar */}
        {!isPortalHome && (
          <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
            <div className="container mx-auto px-4">
              <div className="py-3">
                <Link 
                  href="/portal" 
                  className="inline-flex items-center text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm group"
                >
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                  Back to Portal
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Page Title */}
        {title && (
          <div className="text-center py-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 text-shadow-lg animate-fade-in">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm px-4">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="container mx-auto px-4 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}