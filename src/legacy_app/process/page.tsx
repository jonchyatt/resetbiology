import Link from "next/link"
import { ArrowRight, Shield, Users, Target } from "lucide-react"

export default function ProcessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Header */}
        <section className="pt-24 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white text-shadow-lg">
              How Our Process Works
            </h1>
            <p className="text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">
              Proven bridge from peptide dependency to a working metabolism!
            </p>
          </div>
        </section>

        {/* Process Steps */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="space-y-12">
              
                {/* Step 1 */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg">
                      1
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-sm">60-Second Assessment</h3>
                      <p className="text-gray-300 mb-4 leading-relaxed">
                        Quick evaluation of your current treatment, muscle loss concerns, and metabolic goals. 
                        No sales pressure—just honest evaluation of whether our approach fits your situation.
                      </p>
                      <Link href="/assessment" className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg inline-flex items-center">
                        Take Assessment
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30">
                  <div className="flex flex-col md:flex-row-reverse items-center gap-8">
                    <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg">
                      2
                    </div>
                    <div className="flex-1 text-center md:text-right">
                      <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-sm">IRB Medical Review</h3>
                      <p className="text-gray-300 mb-4 leading-relaxed">
                        Qualified candidates are securely transferred to our IRB-approved partner for medical 
                        clearance and Retatrutide protocol approval. Legal, monitored, legitimate.
                      </p>
                      <div className="flex items-center text-primary-400 justify-center md:justify-end">
                        <Shield className="w-5 h-5 mr-2" />
                        <span className="font-semibold">IRB-Approved Protocol</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg">
                      3
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-sm">Partner Success Program</h3>
                      <p className="text-gray-300 mb-4 leading-relaxed">
                        Place your refundable success deposit, access Mental Mastery audio modules, 
                        track progress, and earn rewards. We partner with your success—literally.
                      </p>
                      <div className="flex items-center text-primary-400 justify-center md:justify-start">
                        <Target className="w-5 h-5 mr-2" />
                        <span className="font-semibold">Gamified Success Tracking</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30">
                  <div className="flex flex-col md:flex-row-reverse items-center gap-8">
                    <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg">
                      4
                    </div>
                    <div className="flex-1 text-center md:text-right">
                      <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-sm">Metabolic Independence</h3>
                      <p className="text-gray-300 mb-4 leading-relaxed">
                        Structured tapering protocol, habit anchoring, and psychological support to achieve 
                        true metabolic freedom. Graduate from medication dependency permanently.
                      </p>
                      <div className="flex items-center text-primary-400 justify-center md:justify-end">
                        <Users className="w-5 h-5 mr-2" />
                        <span className="font-semibold">Former Clients Now Team Members</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-12 max-w-4xl mx-auto border border-primary-400/30 shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white drop-shadow-lg">Ready to Start Your Reset?</h2>
              <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
                <em>Is it unreasonable</em> to want a clear path to metabolic independence?
              </p>
              
              <Link href="/assessment" className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 hover:scale-105 shadow-2xl text-lg">
                Take the 60-Second Assessment
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}