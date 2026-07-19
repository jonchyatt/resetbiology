"use client"

import { type ReactNode, useState } from "react"
import { ChevronDown } from "lucide-react"

interface FAQItem {
  question: string
  answer: ReactNode
}

const faqs: FAQItem[] = [
  {
    question: "What is Reset Biology?",
    answer: <p>Reset Biology offers free tools, education, and an honest map for people who want to run their own biology. {/* src: LMP §00 */}</p>,
  },
  {
    question: "What does it cost?",
    answer: <p>Nothing. {/* src: LMP §00 */} Free access is funded by the Satori Living Foundation. {/* src: LMP §00 */} Reset Biology sells nothing. {/* src: LMP §00 */}</p>,
  },
  {
    question: "Who runs the co-op?",
    answer: <p>The member-owned co-op is run by an independent licensed provider on his own license. {/* src: LMP §2.2 */}</p>,
  },
  {
    question: "What data do you hold?",
    answer: <p>Your data lives in your own Google Drive. {/* src: LMP §00 */}</p>,
  },
]

export function FAQSection() {
  const [openItem, setOpenItem] = useState<number | null>(null)

  return (
    <section className="bg-slate-900 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">Questions, answered plainly</h2>
        </div>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {faqs.map((faq, index) => {
            const isOpen = openItem === index

            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenItem(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium text-white transition-colors hover:text-primary-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-300"
                >
                  {faq.question}
                  <ChevronDown className={`h-5 w-5 shrink-0 text-primary-300 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {isOpen && <div className="max-w-3xl pb-6 text-pretty leading-7 text-slate-300">{faq.answer}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
