import Link from 'next/link';
import { ArrowRight, ClipboardList, Compass, Users, Waypoints } from 'lucide-react';

const steps = [
  { icon: ClipboardList, title: 'Start with the intake', copy: 'Begin at /get-started to share where you are and choose your next step.' },
  { icon: Compass, title: 'Use your daily toolset', copy: 'Use the daily toolset in the portal to support your own work.' },
  { icon: Users, title: 'Connect to the co-op when it fits', copy: 'If your path includes peptides, Reset Biology can connect you to the provider-independent member-owned co-op.' },
  { icon: Waypoints, title: 'Graduate into independence', copy: 'The aim is practical independence with your own tools and decisions.' },
];

export default function ProcessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="relative z-10">
        <section className="pt-24 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white text-shadow-lg">How the Process Works</h1>
            <p className="text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">Start with the tools, make your own decisions, and build toward independence. {/* src: LMP §00 */}</p>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-12">
              {steps.map(({ icon: Icon, title, copy }, index) => (
                <div key={title} className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30">
                  <div className={`flex flex-col ${index % 2 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8`}>
                    <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg">{index + 1}</div>
                    <div className={`flex-1 text-center ${index % 2 ? 'md:text-right' : 'md:text-left'}`}>
                      <h2 className="text-2xl font-bold text-white mb-3 drop-shadow-sm">{title}</h2>
                      <p className="text-gray-300 leading-relaxed">{copy} {/* src: LMP §00, §2.2 */}</p>
                      <div className={`flex items-center text-primary-400 mt-4 justify-center ${index % 2 ? 'md:justify-end' : 'md:justify-start'}`}>
                        <Icon className="w-5 h-5 mr-2" />
                        <span className="font-semibold">Step {index + 1}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-12 max-w-4xl mx-auto border border-primary-400/30 shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white drop-shadow-lg">Ready to Begin?</h2>
              <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">Begin with the intake and take the next step from there. {/* src: LMP §00 */}</p>
              <Link href="/get-started" className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 hover:scale-105 shadow-2xl text-lg inline-flex items-center">Get started <ArrowRight className="w-5 h-5 ml-2" /></Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
