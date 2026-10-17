import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'About Reset Biology' },
  description:
    'Free account, check-in, nutrition, breath and mind training, journal. Education and tools, not medical advice.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-20 text-slate-100 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">About Reset Biology</h1>

        <div className="mt-8 space-y-6 text-lg leading-8 text-slate-300">
          <p>
            Reset Biology offers free tools: free sign-up, peptide tracker, meal tracker, daily journal, and hypnosis modules.
          </p>
          <p>
            Reset Biology takes no payment on this site. It provides education and tools, not medical advice.
          </p>
          <p>
            Ordering and management happen through a member-owned peptide co-op run by Adam Hyatt, FNP, at Zion Direct Care under his own license.
          </p>
          <p>
            Built by a clinician, not a marketer. Free. Funded by the Satori Living Foundation.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/get-started"
            className="rounded-lg bg-primary-400 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-primary-300"
          >
            Get started
          </Link>
          <Link
            href="/education/peptides"
            className="rounded-lg border border-white/10 px-5 py-3 font-semibold text-slate-100 transition-colors hover:border-primary-300 hover:text-primary-300"
          >
            Peptide education
          </Link>
        </div>
      </div>
    </main>
  );
}
