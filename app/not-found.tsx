import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-[70vh] bg-[#020617] text-slate-200 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold text-white mb-3">Page not found</h1>
        <p className="text-slate-300 mb-8">The page may have moved. These will get you back on track.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-lg bg-primary-400 px-5 font-semibold text-slate-950">Home</Link>
          <Link href="/education" className="inline-flex min-h-11 items-center rounded-lg border border-slate-600 px-5 text-slate-200">Learn</Link>
          <Link href="/portal" className="inline-flex min-h-11 items-center rounded-lg border border-slate-600 px-5 text-slate-200">Your portal</Link>
        </div>
      </div>
    </div>
  )
}
