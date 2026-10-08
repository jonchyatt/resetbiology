import { auth0 } from "@/lib/auth0"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

const launchFeatures = [
  { href: "/peptides", title: "Track peptides", description: "Log doses, timing, protocols, and progress." },
  { href: "/nutrition", title: "Track meals", description: "Record meals and follow your nutrition patterns." },
  { href: "/journal", title: "Daily journal", description: "Review one timeline for meals, peptides, modules, and reflections." },
  { href: "/audio", title: "Hypnosis modules", description: "Listen to 29 Mental Mastery sessions in Jon's cloned voice." },
]

export default async function Home() {
  const session = await auth0.getSession()

  if (session?.user) {
    const userEmail = (session.user.email || '').toLowerCase()
    const auth0Sub = session.user.sub

    if (userEmail || auth0Sub) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userEmail },
            { auth0Sub },
          ],
        },
      })

      if (existingUser) redirect('/portal')
    }
  }

  return (
    <main className="rb-launch min-h-screen bg-slate-950 px-4 pb-20 pt-28 text-white">
      <section className="mx-auto max-w-6xl text-center">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-teal-300">Free to start · no trial clock</p>
        <h1 className="mx-auto max-w-4xl text-5xl font-black leading-tight md:text-7xl">
          Track what you do. Learn what helps. Build your reset.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 md:text-xl">
          Reset Biology begins with a small set of practical tools: your peptides, meals, daily journal, and hypnosis modules.
          Upgrades can come later if you choose them.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/get-started"
            className="rounded-xl bg-teal-400 px-7 py-3 font-bold text-slate-950 transition-colors hover:bg-teal-300"
          >
            Create my free account
          </Link>
          <a
            href="/auth/login?returnTo=/portal"
            className="rounded-xl border border-white/20 px-7 py-3 font-bold transition-colors hover:bg-white/10"
          >
            Sign in
          </a>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
        {launchFeatures.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left shadow-xl backdrop-blur-sm transition hover:-translate-y-1 hover:border-teal-300/50 hover:bg-white/10"
          >
            <h2 className="text-xl font-bold text-teal-200">{feature.title}</h2>
            <p className="mt-2 leading-relaxed text-slate-300">{feature.description}</p>
          </Link>
        ))}
      </section>

      <p className="mx-auto mt-12 max-w-3xl text-center text-sm leading-relaxed text-slate-400">
        Reset Biology does not sell products or paid protocols during this free-first launch. Commercial surfaces remain preserved for a later, separately approved release.
      </p>
    </main>
  )
}
