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

// Use-of-funds facts. Only the item names come from the application (Q29, Q31).
// Fill an `amount` (a string, e.g. "$6,000") once the exact figure is supplied; null shows a TODO, never a guess.
const BUDGET: { item: string; amount: string | null }[] = [
  { item: 'HIFEM chair', amount: null },
  { item: 'Red-light therapy equipment', amount: null },
];
const EQUIPMENT_LOCATION: string | null = null;
const OPERATOR: string | null = null;
const SUCCESS_MEASURE: string | null = null;

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
            <p className="mt-3">
              The women&apos;s health line is operated by Satori Enterprises, Inc.
            </p>
            <Todo>Say how Satori Enterprises, Inc. relates to Reset Biology. This waits on your answer about who owns the existing equipment today, because the equipment follows whoever&apos;s money buys it.</Todo>
          </section>

          <section aria-labelledby="who-for">
            <h2 id="who-for" className="text-2xl font-semibold text-white">Who it is for</h2>
            <p className="mt-3">
              Women in Southern Utah, especially in perimenopause and after childbirth, have very few affordable options for pelvic floor and reproductive health care. Most of what exists means travelling to Salt Lake City or out of state.
            </p>
            <p className="mt-3">
              This work is for free co-op members with those needs.
            </p>
            <p className="mt-3">
              The practice serves about 1,200 people a year. That figure is taken from the grant application.
            </p>
            <Todo>Confirm the 1,200 against the last S-corp return before the flag goes on. The application&apos;s revenue band is not in the repo, so it is not on the page; paste the exact wording if it should be shown.</Todo>
          </section>

          <section aria-labelledby="what">
            <h2 id="what" className="text-2xl font-semibold text-white">What is being built</h2>
            <ul className="mt-3 list-disc space-y-3 pl-6">
              <li>The Southern Utah Peptides Co-op is being formed. It is a member-owned co-op run by an independent licensed provider. Reset Biology connects people to it; members buy for themselves and take responsibility for their own body.</li>
              <li>Zion direct care consultation vouchers to help women&apos;s health in aging.</li>
              <li>Women&apos;s health services are being added to the practice, offered locally through a direct-care co-op with transparent pricing.</li>
            </ul>
            <Todo>Current status and dates for each item (formed, forming, planned). Add a plain link to Zion Direct Care if wanted.</Todo>
          </section>

          <section aria-labelledby="funds">
            <h2 id="funds" className="text-2xl font-semibold text-white">How the grant would be used</h2>
            <p className="mt-3">
              The $10,000 grant would buy a HIFEM chair and red-light therapy equipment to treat free co-op members with perimenopausal symptoms, including prolapse of the bladder and reproductive organs.
            </p>
            <p className="mt-3">
              The plan is to grow this into a service line that can employ a second clinician within a year.
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-base">
                <caption className="sr-only">Planned use of the $10,000 grant</caption>
                <thead className="bg-white/5 text-sm uppercase tracking-wide text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">Item</th>
                    <th scope="col" className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {BUDGET.map((row) => (
                    <tr key={row.item}>
                      <th scope="row" className="px-4 py-3 font-normal text-slate-200">{row.item}</th>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {row.amount ?? <span className="text-amber-200">TODO</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {BUDGET.some((row) => row.amount === null) && (
              <Todo>Amount for each line above, from the application budget. The amounts are not in the repo, so none is shown.</Todo>
            )}
            <dl className="mt-6 space-y-4">
              <div>
                <dt className="font-semibold text-white">Where the equipment is housed</dt>
                <dd className="mt-1">{EQUIPMENT_LOCATION ?? <Todo>Location of the equipment.</Todo>}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Who operates it</dt>
                <dd className="mt-1">{OPERATOR ?? <Todo>Name and role of the operator.</Todo>}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">How success is measured</dt>
                <dd className="mt-1">{SUCCESS_MEASURE ?? <Todo>The measure and when it is reported.</Todo>}</dd>
              </div>
            </dl>
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
