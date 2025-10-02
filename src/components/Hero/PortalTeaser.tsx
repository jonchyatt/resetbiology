"use client"

import Link from "next/link"
import { Trophy, Target, Gift, Users } from "lucide-react"

export function PortalTeaser() {
  return (
    <section className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-20 relative overflow-hidden"
             style={{
               backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(/hero-background.jpg)',
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundAttachment: 'fixed'
             }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight text-white drop-shadow-lg">
                How the Client Portal Helps You Win
              </h2>
              <p className="text-2xl text-gray-200 font-medium max-w-3xl mx-auto">
                Make progress feel like a game you&apos;re built to win.
              </p>
              <div className="mt-6 inline-flex items-center bg-teal-500/20 backdrop-blur-sm rounded-full px-6 py-2 border border-teal-400/30">
                <span className="text-teal-200 text-sm font-medium">🎯 Psychology-driven design for lasting success</span>
              </div>
            </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-16">
            {/* Success Deposit */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-2xl p-8 text-center border border-teal-400/30 hover:border-teal-400/50 transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-teal-400/20">
              <div className="bg-gradient-to-br from-teal-500/20 to-teal-600/20 w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center border border-teal-400/30">
                <Target className="w-8 h-8 text-teal-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Success Deposit</h3>
              <p className="text-gray-300 leading-relaxed">
                Put down a refundable stake; earn it back (and more) by sticking to the plan. 
                <span className="block mt-2 font-medium text-teal-300">(Loss aversion works for you.)</span>
              </p>
            </div>

            {/* Daily Check-ins */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-2xl p-8 text-center border border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-blue-400/20">
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center border border-blue-500/30">
                <Gift className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Daily/Weekly Check-ins</h3>
              <p className="text-gray-300 leading-relaxed">
                Unlock variable rewards and streak bonuses (keeps it fun, sticky, and self-reinforcing).
              </p>
            </div>

            {/* Milestones & Badges */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-2xl p-8 text-center border border-amber-400/30 hover:border-amber-400/50 transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-amber-400/20">
              <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center border border-amber-400/30">
                <Trophy className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Milestones & Badges</h3>
              <p className="text-gray-300 leading-relaxed">
                Bronze → Platinum status, public recognition, occasional jackpot prizes for consistency.
              </p>
            </div>

            {/* Mental Mastery Library */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-2xl p-8 text-center border border-green-500/30 hover:border-green-500/50 transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-green-400/20">
              <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center border border-green-500/30">
                <Users className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Mental Mastery Library</h3>
              <p className="text-gray-300 leading-relaxed">
                Foundation → Integration → Mastery: from &ldquo;Reset Your Relationship with Food&rdquo; 
                to &ldquo;The Freedom Formula.&rdquo;
              </p>
            </div>
          </div>
          
          <div className="text-center mb-12">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-2xl p-8 max-w-2xl mx-auto border border-teal-400/30 shadow-xl">
              <h3 className="text-2xl font-bold mb-4 text-white">Experience the Difference</h3>
              <p className="text-gray-300 mb-6">See how our Mental Mastery modules feel different from everything else you've tried.</p>
              <Link href="/trial" className="bg-gradient-to-r from-teal-500/80 to-green-500/80 hover:from-teal-400/90 hover:to-green-400/90 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg backdrop-blur-sm border border-teal-400/30">
                Try a Sample Module Free →
              </Link>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-xl text-gray-300 italic font-light max-w-3xl mx-auto leading-relaxed">
              <em>Does it make sense</em> how progress accelerates when accountability, rewards, and identity all point the same direction?
            </p>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}