"use client"

interface PortalHeaderProps {
  section: string
  subtitle?: string
  secondaryBackLink?: string
  secondaryBackText?: string
  showPeptideInfo?: boolean
}

export function PortalHeader({
  section,
  subtitle,
  secondaryBackLink,
  secondaryBackText,
  showPeptideInfo = true,
}: PortalHeaderProps) {
  return (
    <div
      data-rb-portal-header
      className="fixed left-0 right-0 z-40 bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30"
      style={{ top: "calc(64px + env(safe-area-inset-top, 0px))" }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-row items-center justify-between w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <img
              src="/logo1.png"
              alt="Reset Biology"
              className="hidden sm:block h-10 w-auto rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
            />
            <div className="min-w-0">
              <div className="flex items-center min-w-0">
                <a
                  href="/portal"
                  className="text-xl font-bold text-white drop-shadow-lg hover:text-primary-300 transition-colors"
                >
                  Portal
                </a>
                <span className="mx-2 text-primary-300">&gt;</span>
                <span className="text-lg text-gray-200 drop-shadow-sm truncate">{section}</span>
              </div>
              {subtitle && <p className="text-xs text-gray-300/90 mt-1">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            {showPeptideInfo && (
              <a
                href="/order"
                className="text-primary-300 hover:text-primary-200 font-medium text-xs sm:text-sm transition-colors drop-shadow-sm whitespace-nowrap"
              >
                <span className="sm:hidden">Co-op</span><span className="hidden sm:inline">Peptide Co-op</span>
              </a>
            )}
            <a
              href="/portal"
              className="text-primary-300 hover:text-primary-200 font-medium text-xs sm:text-sm transition-colors drop-shadow-sm whitespace-nowrap hidden sm:block"
            >
              Dashboard
            </a>
            {secondaryBackLink && (
              <a
                href={secondaryBackLink}
                className="text-primary-300 hover:text-primary-200 font-medium text-xs sm:text-sm transition-colors drop-shadow-sm whitespace-nowrap"
              >
                &larr; {secondaryBackText}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

