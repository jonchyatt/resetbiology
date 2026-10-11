'use client'

import Link from "next/link"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error // never render error.message or a stack
  return (
    <div className="min-h-[70vh] bg-[#020617] text-slate-200 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold text-white mb-3">Something went wrong</h1>
        <p className="text-slate-300 mb-8">Please try again. If it keeps happening, contact us.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => reset()} className="inline-flex min-h-11 items-center rounded-lg bg-primary-400 px-5 font-semibold text-slate-950">Try again</button>
          <Link href="/contact" className="inline-flex min-h-11 items-center rounded-lg border border-slate-600 px-5 text-slate-200">Contact us</Link>
        </div>
      </div>
    </div>
  )
}
