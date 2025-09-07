"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: "How is Reset Biology different?",
    answer: "We fix biology *and* behavior: medication quiets hunger and resets metabolism; coaching anchors lasting change."
  },
  {
    question: "Is Retatrutide safe if it's not FDA-approved?",
    answer: "It's provided under **IRB-approved clinical research** with medical monitoring. Early trials show promising efficacy. The ongoing research shows amazing side benefits on multiple fronts not just weight loss, enhanced metabolism, reduced addictive behaviors, reduction in anxiety. And you actually have a chance to KEEP YOUR MUSCLE MASS!"
  },
  {
    question: "Will I regain weight later?",
    answer: "We build habits and identity that sustain results—on a maintenance dose or after tapering off. We walk with you."
  }
]

export function FAQSection() {
  const [openItems, setOpenItems] = useState<number[]>([])

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  return (
    <section className="bg-gradient-to-br from-gray-800 to-gray-900 py-16 relative"
             style={{
               backgroundImage: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(/hero-background.jpg)',
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundAttachment: 'fixed'
             }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white drop-shadow-lg">
              Frequently Asked Questions
            </h2>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-lg shadow-xl border border-teal-400/30 hover:shadow-teal-400/20 transition-all duration-300">
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-700/50 transition-all"
                >
                  <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                  {openItems.includes(index) ? (
                    <ChevronUp className="w-5 h-5 text-teal-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-teal-400" />
                  )}
                </button>
                
                {openItems.includes(index) && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400 italic">
              <strong className="text-amber-400">Medical Disclaimer:</strong> IRB-approved research protocols. Individual results vary. Medical supervision included.
            </p>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}