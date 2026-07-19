import Link from 'next/link';
import { Mail, Phone, ArrowLeft, MessageCircle } from 'lucide-react';

export const metadata = {
  title: 'Contact Us - Reset Biology',
  description: 'Contact Reset Biology for tools and education.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm border-b border-primary-400/30">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-primary-300 hover:text-primary-200 transition-colors"><ArrowLeft className="w-4 h-4" />Back to Home</Link>
        </div>
      </div>
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">Contact <span className="text-primary-400">Reset Biology</span></h1>
            <p className="text-xl text-gray-300">Reset Biology provides tools and education, and sells nothing. {/* src: LMP §00 */}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <a href="mailto:support@resetbiology.com" className="group bg-gradient-to-br from-primary-900/40 to-secondary-900/40 backdrop-blur-md border border-primary-400/30 rounded-2xl p-8 hover:border-primary-400/60 transition-all hover:shadow-2xl hover:shadow-primary-400/20">
              <div className="flex items-start gap-4"><div className="bg-primary-400/20 p-4 rounded-xl group-hover:bg-primary-400/30 transition-colors"><Mail className="w-8 h-8 text-primary-300" /></div><div className="flex-1"><h2 className="text-xl font-bold text-white mb-2">Email Us</h2><p className="text-gray-300 mb-3">Send us a message and we&apos;ll get back to you. {/* src: LMP §00 */}</p><p className="text-primary-300 font-medium group-hover:text-primary-200 transition-colors">support@resetbiology.com</p></div></div>
            </a>
            <a href="tel:+14352166364" className="group bg-gradient-to-br from-secondary-900/40 to-primary-900/40 backdrop-blur-md border border-secondary-400/30 rounded-2xl p-8 hover:border-secondary-400/60 transition-all hover:shadow-2xl hover:shadow-secondary-400/20">
              <div className="flex items-start gap-4"><div className="bg-secondary-400/20 p-4 rounded-xl group-hover:bg-secondary-400/30 transition-colors"><Phone className="w-8 h-8 text-secondary-300" /></div><div className="flex-1"><h2 className="text-xl font-bold text-white mb-2">Call Us</h2><p className="text-gray-300 mb-3">Call during business hours. {/* src: LMP §00 */}</p><p className="text-secondary-300 font-medium group-hover:text-secondary-200 transition-colors">(435) 216-6364</p></div></div>
            </a>
          </div>
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md border border-gray-600/30 rounded-2xl p-8">
            <div className="flex items-start gap-4"><div className="bg-blue-400/20 p-4 rounded-xl"><MessageCircle className="w-8 h-8 text-blue-300" /></div><div className="flex-1"><h2 className="text-xl font-bold text-white mb-2">What We Can Help With</h2><ul className="text-gray-300 space-y-2"><li>Questions about Reset Biology&apos;s tools and education. {/* src: LMP §00 */}</li><li>Help finding the right place to begin. {/* src: LMP §00 */}</li><li>Questions about the member-owned co-op connection. {/* src: LMP §2.2 */}</li></ul></div></div>
          </div>
          <div className="mt-12 text-center"><p className="text-gray-400 mb-4">Looking for something specific?</p><div className="flex flex-wrap gap-4 justify-center"><Link href="/get-started" className="bg-primary-500/20 border border-primary-400/40 text-primary-300 px-6 py-3 rounded-lg hover:bg-primary-500/30 transition-colors">Get Started</Link><Link href="/process" className="bg-secondary-500/20 border border-secondary-400/40 text-secondary-300 px-6 py-3 rounded-lg hover:bg-secondary-500/30 transition-colors">How It Works</Link><Link href="/portal" className="bg-amber-500/20 border border-amber-400/40 text-amber-300 px-6 py-3 rounded-lg hover:bg-amber-500/30 transition-colors">Member Portal</Link></div></div>
        </div>
      </main>
    </div>
  );
}
