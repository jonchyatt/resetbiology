"use client"

import { Shield, Users, Award, Clock } from "lucide-react"

export function TrustSignals() {
  return (
    <section className="bg-gray-900 py-12 border-t border-gray-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <Shield className="w-8 h-8 mx-auto mb-2 text-primary-400" />
            <div className="text-white font-bold text-lg">IRB-Approved</div>
            <div className="text-gray-400 text-sm">Medical Research</div>
          </div>
          
          <div className="text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-primary-400" />
            <div className="text-white font-bold text-lg">2,847+</div>
            <div className="text-gray-400 text-sm">Active Clients</div>
          </div>
          
          <div className="text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-primary-400" />
            <div className="text-white font-bold text-lg">94%</div>
            <div className="text-gray-400 text-sm">Success Rate</div>
          </div>
          
          <div className="text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-primary-400" />
            <div className="text-white font-bold text-lg">&lt;48hrs</div>
            <div className="text-gray-400 text-sm">Response Time</div>
          </div>
        </div>
      </div>
    </section>
  )
}