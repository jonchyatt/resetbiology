import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PatronWall } from '@/components/Patrons/PatronWall'
import { PATRONS, visiblePatrons } from '@/config/patrons'
import { SYNTHETIC_PATRONS } from '../../tests/fixtures/patrons.synthetic'

// Patron wall. Hidden until Jonathan sets NEXT_PUBLIC_RB_PATRON_WALL=on (project rule 15).
// 'preview' shows synthetic names, and only outside production.
export const metadata: Metadata = {
  title: { absolute: 'Patrons | Reset Biology' },
  description: 'The people who keep Reset Biology free for the co-op.',
  alternates: { canonical: '/patrons' },
  robots: { index: false, follow: false },
}

export default function PatronsPage() {
  const flag = process.env.NEXT_PUBLIC_RB_PATRON_WALL
  const preview = flag === 'preview' && process.env.NODE_ENV !== 'production'
  if (flag !== 'on' && !preview) notFound()

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-20 text-slate-100 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-300">Community</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Patrons</h1>
        <p className="mt-4 text-lg leading-8 text-slate-300">
          Thank you to the people who keep Reset Biology free for the co-op.
        </p>
        <PatronWall patrons={visiblePatrons(preview ? SYNTHETIC_PATRONS : PATRONS)} sample={preview} />
      </div>
    </main>
  )
}
