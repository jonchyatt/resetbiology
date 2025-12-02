"use client"

interface PortalHeaderProps {
  section: string
  subtitle?: string
  backLink?: string
  backText?: string
  secondaryBackLink?: string
  secondaryBackText?: string
  showOrderPeptides?: boolean
  showBackLink?: boolean
}

export function PortalHeader({
  section,
  subtitle,
  backLink = "/portal",
  backText = "Back to Portal",
  secondaryBackLink,
  secondaryBackText,
  showOrderPeptides = true,
  showBackLink = true
}: PortalHeaderProps) {
  return (
    <div
      className="fixed left-0 right-0 z-40 bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30"
      style={{ top: "calc(64px + env(safe-area-inset-top, 0px))" }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-row items-center justify-between w-full">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <img
            src="/logo1.png"
            alt="Reset Biology"
            className="h-10 w-auto rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
          />
          <div>
            <div className="flex items-center">
              <a href="/portal" className="text-xl font-bold text-white drop-shadow-lg hover:text-primary-300 transition-colors">
                Portal
              </a>
              <span className="mx-2 text-primary-300">&gt;</span>
              <span className="text-lg text-gray-200 drop-shadow-sm">{section}</span>
            </div>
            {subtitle && (
              <p className="text-xs text-gray-300/90 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {showOrderPeptides && (
              <a href="/order" className="text-primary-300 hover:text-primary-200 font-medium text-xs sm:text-sm transition-colors drop-shadow-sm whitespace-nowrap">
                Order
              </a>
            )}
            <a href="/daily-history" className="text-primary-300 hover:text-primary-200 font-medium text-xs sm:text-sm transition-colors drop-shadow-sm whitespace-nowrap hidden sm:block">
              Daily History
            </a>
            {secondaryBackLink && (
              <a href={secondaryBackLink} className="text-primary-300 hover:text-primary-200 font-medium text-xs sm:text-sm transition-colors drop-shadow-sm whitespace-nowrap">
                ← {secondaryBackText}
              </a>
            )}
            {showBackLink && (
              <a href={backLink} className="text-primary-300 hover:text-primary-200 font-medium text-xs sm:text-sm transition-colors drop-shadow-sm whitespace-nowrap">
                ← {backText}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
