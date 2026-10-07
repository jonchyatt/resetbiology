import Link from 'next/link';

export const metadata = {
  title: 'Affiliate updates | Reset Biology',
  description: 'Get notified when Reset Biology opens its affiliate program.',
};

export default function AffiliatesPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-20 pt-28 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-teal-400/20 bg-white/5 p-8 text-center shadow-2xl md:p-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">Coming soon</p>
        <h1 className="mb-5 text-4xl font-bold md:text-5xl">Reset Biology affiliates</h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-slate-300">
          We are designing a transparent partner program. Commission terms and eligible offers are not final yet,
          so we are not accepting applications or promising payouts today.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/contact?source=affiliates" className="rounded-xl bg-teal-500 px-6 py-3 font-semibold text-slate-950 transition-colors hover:bg-teal-400">
            Ask for program updates
          </Link>
          <Link href="/education/peptides" className="rounded-xl border border-white/20 px-6 py-3 font-semibold transition-colors hover:bg-white/10">
            Explore the free library
          </Link>
        </div>
      </div>
    </main>
  );
}
