import { notFound } from 'next/navigation'
import { NewsletterSignup } from '@/components/Newsletter/NewsletterSignup'

// Local-only preview of the email capture card with the flag treated as on.
// Returns 404 in production builds, so nothing public is added.
export const dynamic = 'force-dynamic'

export default function EmailCapturePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-10 text-slate-200">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold text-white">Email capture card preview</h1>
        <p className="text-sm text-slate-400">
          Local only. On the free tools the card also needs NEXT_PUBLIC_RB_EMAIL_CAPTURE=true and a
          visitor who is not already subscribed. This page skips both so the card can be read and
          tried. Submitting here writes a pending row to whatever DATABASE_URL points at, so use a
          local database.
        </p>
        <NewsletterSignup source="preview" idPrefix="preview" />
      </div>
    </main>
  )
}
