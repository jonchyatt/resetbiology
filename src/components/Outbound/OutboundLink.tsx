import React from 'react'
import type { ReactNode } from 'react'

type OutboundLinkProps = {
  href: string
  children: ReactNode
  className?: string
}

// Link that leaves this site. Always shows the "leaves this site" label so the
// jump is never a surprise.
export function OutboundLink({ href, children, className }: OutboundLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className ?? 'font-semibold text-primary-300 underline hover:text-primary-200'}>
      {children}
      <span className="ml-2 text-xs font-normal text-gray-400">(leaves this site)</span>
    </a>
  )
}
