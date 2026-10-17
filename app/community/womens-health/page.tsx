import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Funder page. Hidden until Jonathan sets NEXT_PUBLIC_FUNDER_PAGE=on (project rule 15).
export const metadata: Metadata = {
  title: { absolute: "Women's health in Southern Utah | Reset Biology" },
  description:
    "How a one-person anesthesia practice in Saint George, Utah is adding women's health, and what a grant would buy for free co-op members.",
  alternates: { canonical: '/community/womens-health' },
  robots: { index: false, follow: false },
};

function Todo({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-base leading-7 text-amber-200">
      <strong>TODO (Jonathan):</strong> {children}
    </p>
  );
}

export default function WomensHealthPage() {
  if (process.env.NEXT_PUBLIC_FUNDER_PAGE !== 'on') notFound();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-20 text-slate-100 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-300">Community</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Women&apos;s health in Southern Utah
        </h1>

        <div className="mt-8 space-y-10 text-lg leading-8 text-slate-300">
          <section aria-labelledby="who">
            <h2 id="who" className="text-2xl font-semibold text-white">Who is doing this</h2>
            <p className="mt-3">
              A one-person anesthesia practice in Saint George, Utah is adding women&apos;s health to the care it offers.
            </p>
            <Todo>Name the applicant and how it relates to Reset Biology (Satori Enterprises, Inc. is unverified on this site).</Todo>
          </section>

          <section aria-labelledby="who-for">
            <h2 id="who-for" className="text-2xl font-semibold text-white">Who it is for</h2>
            <p className="mt-3">
              Free co-op members in Southern Utah who have perimenopausal pelvic-floor symptoms.
            </p>
            <Todo>How many people are in the community, and how this reaches under-resourced residents. No figure is stated here because none was supplied.</Todo>
          </section>

          <section aria-labelledby="what">
            <h2 id="what" className="text-2xl font-semibold text-white">What is being built</h2>
            <ul className="mt-3 list-disc space-y-3 pl-6">
              <li>The Southern Utah Peptides Co-op is being formed. It is a member-owned group run by an independent licensed provider. Reset Biology connects people to it and does not sell or fulfil anything. Members buy for themselves and take responsibility for their own body.</li>
              <li>Zion direct care consultation vouchers for women&apos;s health in aging.</li>
              <li>Women&apos;s health added to the practice.</li>
            </ul>
            <Todo>Current status and dates for each item (formed, forming, planned). Add a plain link to Zion Direct Care if wanted.</Todo>
          </section>

          <section aria-labelledby="funds">
            <h2 id="funds" className="text-2xl font-semibold text-white">How the grant would be used</h2>
            <p className="mt-3">
              The grant would buy a HIFEM device and red-light therapy for free co-op members with perimenopausal pelvic-floor symptoms.
            </p>
            <Todo>Budget lines and amounts, where the equipment is housed, who operates it, and how success is measured.</Todo>
          </section>

          <section aria-labelledby="free">
            <h2 id="free" className="text-2xl font-semibold text-white">What stays free</h2>
            <p className="mt-3">
              The Reset Biology tools stay free. They provide education and tracking, not medical advice.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/order"
            className="rounded-lg bg-primary-400 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-primary-300"
          >
            Join the co-op
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-white/10 px-5 py-3 font-semibold text-slate-100 transition-colors hover:border-primary-300 hover:text-primary-300"
          >
            About Reset Biology
          </Link>
        </div>
      </div>
    </main>
  );
}
