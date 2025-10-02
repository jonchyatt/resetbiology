"use client"

import { Share2, BarChart3, DollarSign } from "lucide-react"

export function ReferralSection() {
  return (
    <section className="bg-gradient-to-br from-gray-900 to-gray-800 py-16 relative"
             style={{
               backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(/hero-background.jpg)',
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundAttachment: 'fixed'
             }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white drop-shadow-lg">
              &ldquo;Share the Reset&rdquo; (Referral Rewards)
            </h2>
            
            <p className="text-lg text-gray-300 mb-8 max-w-3xl mx-auto">
              Our mission grows through you. We keep this section small because honestly, when we partner together 
              it happens naturally. But we do want to acknowledge that when you partner with us it goes both ways. 
              We give back.
            </p>
          
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-lg p-6 shadow-xl border border-teal-400/30 hover:shadow-teal-400/20 transition-all duration-300">
              <Share2 className="w-12 h-12 mx-auto mb-4 text-teal-400" />
              <h3 className="text-lg font-semibold mb-3 text-white">Unique Referral Link</h3>
              <p className="text-gray-300 text-sm">
                Your unique referral link gives friends a welcome discount; you help others, 
                you get more help yourself earn toward your rewards or your next package.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-lg p-6 shadow-xl border border-blue-500/30 hover:shadow-blue-400/20 transition-all duration-300">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-blue-400" />
              <h3 className="text-lg font-semibold mb-3 text-white">Simple Dashboard</h3>
              <p className="text-gray-300 text-sm">
                Simple dashboard shows clicks, sign-ups, and rewards.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-lg p-6 shadow-xl border border-amber-400/30 hover:shadow-amber-400/20 transition-all duration-300">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-amber-400" />
              <h3 className="text-lg font-semibold mb-3 text-white">Efficient Growth</h3>
              <p className="text-gray-300 text-sm">
                Built to align with our efficiency model—high-trust, low-cost growth.
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-lg text-gray-300 italic">
              <strong className="text-green-400">Is it crazy</strong> to be rewarded for helping people you already care about?
            </p>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}