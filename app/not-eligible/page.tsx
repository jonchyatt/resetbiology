"use client"

import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export default function NotEligiblePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white px-4 py-16">
      <div className="max-w-3xl mx-auto text-center space-y-6 bg-gray-900/70 border border-primary-400/20 rounded-3xl p-10 shadow-2xl">
        <div className="flex justify-center">
          <div className="bg-red-500/20 p-4 rounded-full">
            <ShieldAlert className="w-12 h-12 text-red-300" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-black">Peptides Aren't Available Yet</h1>
        <p className="text-lg text-gray-200 leading-relaxed">
          Maybe peptides are not right for you right now. However, you can still benefit from our
          free tools for breathwork, workouts, journaling, nutrition tracking, and mindset training.
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
          >
            Explore Reset Biology
          </Link>
          <Link
            href="/portal"
            className="block w-full bg-gray-800/70 hover:bg-gray-700/80 text-gray-100 font-semibold py-3 px-6 rounded-xl border border-gray-600 transition-all duration-300"
          >
            See Our Free Tools
          </Link>
        </div>

        <p className="text-sm text-gray-400">
          When you're ready and eligible, we'll be here to guide you safely.
        </p>
      </div>
    </div>
  )
}
