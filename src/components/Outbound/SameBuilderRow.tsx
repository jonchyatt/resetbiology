import React from 'react'
import { OutboundLink } from '@/components/Outbound/OutboundLink'
import { sameBuilderUrl } from '@/lib/sameBuilder'

// Renders nothing unless the flag and URL are both set (see src/lib/sameBuilder.ts).
export function SameBuilderRow() {
  if (!sameBuilderUrl) return null

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20 shadow-lg">
        <p className="text-sm text-gray-300">
          From the same builder:{' '}
          <OutboundLink href={sameBuilderUrl}>What Am I Appreciating Now</OutboundLink>
        </p>
        <p className="mt-1 text-xs text-gray-400">A separate site with its own terms and privacy policy. Reset Biology shares nothing with it.</p>
      </div>
    </div>
  )
}
