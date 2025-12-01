"use client"

interface AdminHeaderProps {
  section: string
  subtitle?: string
}

export function AdminHeader({
  section,
  subtitle
}: AdminHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/logo1.png"
              alt="Reset Biology"
              className="h-8 w-auto mr-3 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
            />
            <h1 className="text-xl font-bold text-white drop-shadow-lg">Admin</h1>
            <span className="mx-2 text-primary-300">•</span>
            <span className="text-lg text-gray-200 drop-shadow-sm">{section}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
              Dashboard
            </a>
            <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
              Portal
            </a>
          </div>
        </div>
        {subtitle && (
          <p className="text-gray-300 text-sm mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
