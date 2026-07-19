import Link from "next/link"
import { redirect } from "next/navigation"
import { FAQSection } from "@/components/Hero/FAQSection"
import { auth0 } from "@/lib/auth0"
import { prisma } from "@/lib/prisma"

export default async function Home() {
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
      <aside className="border-b border-primary-400/25 bg-slate-900 px-4 py-3 text-center text-sm text-slate-200">
        Free. Funded by the Satori Living Foundation. {/* src: LMP §00 */}
      </aside>

      <section className="relative overflow-hidden border-b border-white/10 px-4 py-20 sm:py-28 lg:py-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(63,191,181,0.14),transparent_70%)]"
        />
        <div className="mx-auto max-w-5xl">
          <div className="max-w-4xl">
            <p className="mb-6 text-sm font-semibold tracking-[0.12em] text-primary-300">RESET BIOLOGY</p>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
              Reset Biology gives people the tools, the education, and an honest map to run their own biology — free, private, and with nobody standing between them and a fair price.
              {/* src: LMP §00 */}
            </h1>
            <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Link
                href="/get-started"
                className="inline-flex items-center justify-center rounded-lg bg-primary-400 px-6 py-3 text-base font-semibold text-slate-950 transition-colors hover:bg-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
              >
                Start Free
              </Link>
              <p className="max-w-xl text-pretty text-base leading-7 text-slate-300">
                Free. Funded by the Satori Living Foundation. We sell nothing. {/* src: LMP §00 */}
              </p>
            </div>
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
                <p>Your data lives in your own Google Drive. {/* src: LMP §00 */}</p>
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
            Your data is yours — literally. It lives in your own Google Drive. {/* src: LMP §00 */}
          </p>
        </div>
      </section>

      <FAQSection />
    </main>
  )
}
