"use client"

import Link from "next/link"
import { Shield, Mail, Phone, MapPin } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <img 
                src="/reset-logo-pro.png" 
                alt="Reset Biology" 
                className="h-40 w-auto rounded-xl drop-shadow-lg hover:drop-shadow-xl transition-all duration-300 bg-white/10 backdrop-blur-sm p-4 border border-white/20 hover:border-primary-400/40"
              />
              <div className="flex-1">
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Licensed medical provider-led, IRB-approved program for safe, effective peptide therapy 
                  and metabolic independence. Your bridge to lasting health transformation.
                </p>
                <div className="flex items-center gap-2 text-primary-400 font-medium">
                  <Shield className="w-5 h-5" />
                  <span>IRB-Approved Research Protocol</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/assessment" className="text-gray-300 hover:text-primary-400 transition-colors">Free Assessment</Link></li>
              <li><Link href="/process" className="text-gray-300 hover:text-primary-400 transition-colors">How It Works</Link></li>
              <li><Link href="/portal" className="text-gray-300 hover:text-primary-400 transition-colors">Client Portal</Link></li>
              <li><Link href="/trial" className="text-gray-300 hover:text-primary-400 transition-colors">Try Sample Module</Link></li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className="text-lg font-bold mb-4">Contact</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary-400" />
                <a href="mailto:support@resetbiology.com" className="hover:text-primary-400 transition-colors">
                  support@resetbiology.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary-400" />
                <span>(435) 216-6364</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary-400 mt-1 flex-shrink-0" />
                <span className="leading-tight">Licensed in all 50 states<br />Telemedicine available</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-400 text-sm">
              <p>&copy; 2025 Reset Biology. All rights reserved. | IRB-approved research protocols. Individual results may vary. Medical supervision included.</p>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-primary-400 transition-colors">Terms of Service</Link>
              <Link href="/disclaimer" className="hover:text-primary-400 transition-colors">Medical Disclaimer</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}