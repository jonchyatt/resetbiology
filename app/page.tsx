import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { FAQSection } from "@/components/Hero/FAQSection"
import { auth0 } from "@/lib/auth0"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { alternates: { canonical: "/" } }

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Reset Biology",
  url: "https://resetbiology.com",
  logo: "https://resetbiology.com/apple-touch-icon.png",
  description: "Free account, check-in, nutrition, breath and mind training, journal. Reset Biology sells nothing, takes no payment. Education and tools, not medical advice.",
}

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Reset Biology",
  url: "https://resetbiology.com",
}

// Where /api/newsletter/{confirm,unsubscribe} land the member (?newsletter=<state>).
const NEWSLETTER_BANNERS: Record<string, string> = {
  confirmed: "You're confirmed. Free weekly notes, no selling, ever.",
  unsubscribed: "You're unsubscribed.",
  invalid: "That link has expired. Sign up again below.",
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const newsletterParam = (await searchParams)?.newsletter
  const newsletterBanner =
    typeof newsletterParam === "string" ? NEWSLETTER_BANNERS[newsletterParam] : undefined
  const session = await auth0.getSession()

  if (session?.user) {
    const userEmail = (session.user.email || "").toLowerCase()
    const auth0Sub = session.user.sub

    if (userEmail || auth0Sub) {
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: userEmail }, { auth0Sub }] },
      })

      if (existingUser) redirect("/portal")
    }
  }

  return (
    <main className="bg-slate-950 text-slate-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([organization, website]) }} />
      <aside className="border-b border-primary-400/25 bg-slate-900 px-4 py-3 text-center text-sm text-slate-200">
        Free. Funded by the Satori Living Foundation. {/* src: LMP §00 */}
      </aside>
      {newsletterBanner && (
        <p
          role="status"
          className="border-b border-primary-400/25 bg-primary-950/60 px-4 py-2 text-center text-sm text-primary-100"
        >
          {newsletterBanner}
        </p>
      )}

      <section className="relative overflow-hidden border-b border-white/10 px-4 py-20 sm:py-28 lg:py-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(63,191,181,0.14),transparent_70%)]"
        />
        <div className="mx-auto max-w-5xl">
          <div className="max-w-4xl">
            <p className="rb-hero-rise mb-6 text-sm font-semibold tracking-[0.12em] text-primary-300">RESET BIOLOGY</p>
            <h1 className="rb-hero-rise text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.022em] text-white sm:text-5xl sm:leading-[1.08] sm:tracking-[-0.026em] lg:text-6xl lg:leading-[1.05] lg:tracking-[-0.03em]">
              Reset Biology gives people the tools, the education, and an honest map to run their own biology
              <span className="block font-normal text-slate-300">
                — free, private, and with nobody standing between them and a fair price.
              </span>
              {/* src: LMP §00 */}
            </h1>
            <div className="rb-hero-rise mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Link
                href="/get-started"
                className="inline-flex items-center justify-center rounded-lg bg-primary-400 px-6 py-3 text-base font-semibold text-slate-950 rb-press hover:bg-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
              >
                Start free
              </Link>
              <p className="max-w-xl text-pretty text-base leading-7 text-slate-300">
                We sell nothing. {/* src: LMP §00 */}
              </p>
            </div>
            <p className="rb-hero-rise mt-8 inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-950/40 px-3 py-1 text-sm text-primary-100">
              <span className="font-semibold text-primary-300">Sign in with ChatGPT:</span> integration coming soon
              {/* src: OpenAI partner interest form submitted 2026-10-14 (jarvis data/rb-byo-chatgpt/SUBMITTED-RECEIPT-2026-10-14.md); not live, not approved */}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-900/40 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">How it works</h2>
          </div>
          <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            <li className="rounded-xl border border-white/10 p-6">
              <span className="text-sm font-semibold tracking-[0.08em] text-primary-300/60">01</span>
              <h3 className="mt-2 text-lg font-semibold text-primary-300">Tell us where you are</h3>
              <p className="mt-3 text-pretty leading-7 text-slate-300">
                Begin with a short intake. {/* src: LMP §00 */}
              </p>
            </li>
            <li className="rounded-xl border border-white/10 p-6">
              <span className="text-sm font-semibold tracking-[0.08em] text-primary-300/60">02</span>
              <h3 className="mt-2 text-lg font-semibold text-primary-300">Work your day</h3>
              <div className="mt-3 space-y-3 text-pretty leading-7 text-slate-300">
                <p>Use the daily check-in, nutrition, breath, mind training, and journal. {/* src: LMP §2.2 */}</p>
                <p>Your data, your choice: keep it in your Reset Biology account, or in your own Google Drive too. {/* src: RULING-2026-10-11 Drive option A + Jon 'give them the sense of control' */}</p>
              </div>
            </li>
            <li className="rounded-xl border border-white/10 p-6">
              <span className="text-sm font-semibold tracking-[0.08em] text-primary-300/60">03</span>
              <h3 className="mt-2 text-lg font-semibold text-primary-300">Fair access</h3>
              <div className="mt-3 space-y-3 text-pretty leading-7 text-slate-300">
                <p>For members whose path includes peptides, we connect you to a member-owned co-op run by an independent licensed provider. {/* src: LMP §2.2 */}</p>
                <p>Reset Biology sells nothing and takes no payment. {/* src: LMP §2.2 */}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="border-y border-primary-400/20 bg-primary-950/35 px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 md:gap-16">
          <p className="text-balance text-2xl font-semibold leading-snug tracking-[-0.02em] text-white sm:text-3xl">
            Built by a clinician, not a marketer. {/* src: LMP §00 */}
          </p>
          <p className="max-w-xl text-pretty text-lg leading-8 text-primary-100">
            Your data, your choice. Keep it in your Reset Biology account, or connect Google Drive and keep your own copy in a folder you control. {/* src: RULING-2026-10-11 Drive option A + Jon 'give them the sense of control' */}
          </p>
        </div>
      </section>

      <FAQSection />
    </main>
  )
}
