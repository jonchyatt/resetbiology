"use client"

import { Zap, Target, TrendingUp } from "lucide-react"

export function ValuePropSection() {
    return (
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10">
            <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
                Answer these 15 questions so we can measure and optimize:
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Item 1 */}
                <div className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 rounded-2xl p-6 border border-primary-500/20">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center mb-4">
                        <Zap className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                        🧬 Your Cellular Fat-Burning Environment
                    </h3>
                    <p className="text-gray-300">
                        Peptide optimization, stem cell health, and metabolic activation protocols
                    </p>
                </div>

                {/* Item 2 */}
                <div className="bg-gradient-to-br from-secondary-500/10 to-secondary-600/5 rounded-2xl p-6 border border-secondary-500/20">
                    <div className="w-14 h-14 bg-gradient-to-br from-secondary-400 to-secondary-600 rounded-xl flex items-center justify-center mb-4">
                        <Target className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                        📊 Your Precision Tracking Systems
                    </h3>
                    <p className="text-gray-300">
                        Nutrition, workouts, peptide protocols, and recovery monitoring
                    </p>
                </div>

                {/* Item 3 */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl p-6 border border-blue-500/20">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                        <TrendingUp className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                        🎯 Your Comprehensive Support Stack
                    </h3>
                    <p className="text-gray-300">
                        Breathwork, journaling, accountability systems, and stress management
                    </p>
                </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-200 text-center text-lg font-semibold">
                    ⚠️ Most people focus on #2 and ignore #1 and #3—which is why they plateau.
                </p>
            </div>
        </div>
    )
}
