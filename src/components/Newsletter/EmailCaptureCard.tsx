'use client'

import { useEffect, useState } from 'react'
import { NewsletterSignup } from '@/components/Newsletter/NewsletterSignup'

type EmailCaptureCardProps = {
  source: string
}

// Off unless NEXT_PUBLIC_RB_EMAIL_CAPTURE is exactly 'true'. Read as a literal
// so Next inlines it at build time.
const captureEnabled = process.env.NEXT_PUBLIC_RB_EMAIL_CAPTURE === 'true'

export function EmailCaptureCard({ source }: EmailCaptureCardProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!captureEnabled) return
    const controller = new AbortController()

    fetch('/api/newsletter/status', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { subscribed: true }))
      .then((data: { subscribed?: boolean }) => setShow(data.subscribed === false))
      .catch(() => setShow(false))

    return () => controller.abort()
  }, [])

  if (!captureEnabled || !show) return null

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <NewsletterSignup source={source} idPrefix={`capture-${source}`} />
    </div>
  )
}
