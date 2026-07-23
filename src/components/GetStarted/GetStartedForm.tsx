"use client"

import { useState, type FormEvent } from "react"

const FOCUS_OPTIONS = [
  { id: "weight-loss", label: "Getting the weight off" },
  { id: "muscle-mass", label: "Keeping muscle as I lose weight" },
  { id: "health-control", label: "Feeling in control of my health" },
  { id: "feel-better", label: "Feeling better in general" },
  { id: "tools-assistance", label: "Having tools and support along the way" },
]

export function GetStartedForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [focus, setFocus] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleFocus = (id: string) => {
    setFocus((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!name.trim()) {
      setError("Please tell us what to call you.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.")
      return
    }

    setError(null)
    setSubmitting(true)

    // Save the intake server-side (keyed to email, linked to the account on
    // first login) so nothing depends on this browser's storage surviving
    // the login round-trip.
    try {
      await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          desired_outcome: focus,
          startedAt: new Date().toISOString(),
          referrer: document.referrer || null,
        }),
      })
    } catch {
      // The intake is a personalization nicety — never block entry on it.
    }

    window.location.href = "/auth/login?returnTo=/portal"
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100 sm:py-24">
      <div className="mx-auto max-w-xl">
        <p className="mb-6 text-sm font-semibold tracking-[0.12em] text-primary-300">RESET BIOLOGY</p>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
          Let&apos;s get you set up.
        </h1>
        <p className="mt-4 text-pretty leading-7 text-slate-300">
          Two questions, thirty seconds. Everything inside is free — funded by the Satori Living
          Foundation. We sell nothing. {/* src: LMP §00 */}
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-8">
          <div>
            <label htmlFor="gs-name" className="block text-sm font-medium text-slate-200">
              What should we call you?
            </label>
            <input
              id="gs-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              placeholder="Your preferred name"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            />
          </div>

          <div>
            <label htmlFor="gs-email" className="block text-sm font-medium text-slate-200">
              Email you&apos;ll use to sign in
            </label>
            <input
              id="gs-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-200">
              What matters most right now? <span className="text-slate-400">(optional)</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((opt) => {
                const selected = focus.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFocus(opt.id)}
                    aria-pressed={selected}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      selected
                        ? "border-primary-400 bg-primary-400/15 text-primary-200"
                        : "border-white/15 bg-slate-900 text-slate-300 hover:border-primary-400/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary-400 px-6 py-3 text-base font-semibold text-slate-950 transition-colors hover:bg-primary-300 disabled:opacity-60 sm:w-auto"
            >
              {submitting ? "One moment…" : "Create my free account"}
            </button>
            <p className="mt-3 text-sm text-slate-400">
              Next you&apos;ll create a sign-in, then land in your portal. No payment, ever, on this
              path.
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}
