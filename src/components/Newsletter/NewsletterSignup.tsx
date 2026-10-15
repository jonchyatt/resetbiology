'use client'

import { useState, type FormEvent } from 'react'

type NewsletterSignupProps = {
  source: string
}

type NewsletterState = 'idle' | 'sent' | 'error'

export function NewsletterSignup({ source }: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<NewsletterState>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('idle')

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      })

      setState(response.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-slate-950 p-5 text-slate-300">
      <h2 className="text-lg font-semibold text-white">
        Free weekly notes on running your own biology. No selling, ever.
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setState('idle')
          }}
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@example.com"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 text-white placeholder:text-slate-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
        />
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary-400 px-5 font-semibold text-slate-950 transition-colors hover:bg-primary-300"
        >
          Subscribe
        </button>
      </form>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm">
        {state === 'sent' && 'Check your inbox to confirm.'}
        {state === 'error' && 'That address did not go through. Try again.'}
      </p>
    </section>
  )
}
