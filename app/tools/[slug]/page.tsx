import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EmailCaptureCard } from '@/components/Newsletter/EmailCaptureCard'
import { COOP_JOIN_URL } from '@/config/sellerLinks'
import { TOOL_PAGES, TOOL_PAGES_ENABLED, getToolPage } from '@/config/toolPages'

export function generateStaticParams() {
  return TOOL_PAGES.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = getToolPage((await params).slug)
  if (!tool) return {}
  return {
    title: tool.name,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
  }
}

export default async function ToolLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getToolPage((await params).slug)
  if (!TOOL_PAGES_ENABLED || !tool) notFound()

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-20 text-slate-100 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-300">Free tool</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{tool.name}</h1>
        <p className="mt-6 text-lg leading-8 text-slate-300">
          {tool.description} {/* src: {tool.src} */}
        </p>
        <p className="mt-4 text-lg leading-8 text-slate-300">
          Free. Funded by the Satori Living Foundation. Education and tools, not medical advice.
          {/* src: app/about/page.tsx */}
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/get-started"
            className="inline-flex items-center justify-center rounded-lg bg-primary-400 px-6 py-3 text-base font-semibold text-slate-950 hover:bg-primary-300"
          >
            Start free
          </Link>
          <Link
            href={tool.href}
            className="inline-flex items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-base font-semibold text-white hover:border-primary-300"
          >
            Open {tool.name}
          </Link>
        </div>
        <p className="mt-10 text-base leading-7 text-slate-400">
          Ordering and management happen through a member-owned peptide co-op run by Adam Hyatt, FNP, at Zion Direct
          Care under his own license. {/* src: app/about/page.tsx */}{' '}
          <Link href={COOP_JOIN_URL} className="text-primary-300 underline">
            Ask about the co-op
          </Link>
        </p>
      </div>
      <EmailCaptureCard source={`tool-page-${tool.slug}`} />
    </main>
  )
}
