"use client"

import Link from "next/link"
import { Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 px-4 py-12 text-slate-300">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1fr_auto] md:items-start">
        <div className="max-w-2xl">
          <img src="/reset-logo-pro.png" alt="Reset Biology" className="h-16 w-auto object-contain" />
          <p className="mt-6 text-sm leading-6">Educational content only. Not medical advice. Reset Biology sells no products and provides no medical care.</p>
          <p className="mt-2 text-sm leading-6">Free access funded by the Satori Living Foundation. {/* src: LMP §00 */}</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <nav aria-label="Footer navigation">
            <h2 className="text-sm font-semibold text-white">Explore</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/get-started" className="transition-colors hover:text-primary-300">Get started</Link></li>
              <li><Link href="/education" className="transition-colors hover:text-primary-300">Education</Link></li>
              <li><Link href="/portal" className="transition-colors hover:text-primary-300">Portal</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="text-sm font-semibold text-white">Contact</h2>
            <a href="mailto:support@resetbiology.com" className="mt-3 inline-flex items-center gap-2 text-sm transition-colors hover:text-primary-300">
              <Mail className="h-4 w-4" />
              support@resetbiology.com
            </a>
            <div className="mt-5 flex gap-4 text-sm">
              <Link href="/privacy" className="transition-colors hover:text-primary-300">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-primary-300">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
