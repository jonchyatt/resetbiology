"use client"

import { useState } from "react"
import { AssessmentLanding } from "@/components/Assessment/AssessmentLanding"
import { AssessmentQuiz } from "@/components/Assessment/AssessmentQuiz"
import { AssessmentResults } from "@/components/Assessment/AssessmentResults"

type Step = "landing" | "quiz" | "results"

export default function AssessmentPage() {
  const [step, setStep] = useState<Step>("landing")
  const [resultsData, setResultsData] = useState<any>(null)
  const [startTime] = useState(Date.now())

  const handleStartQuiz = () => {
    setStep("quiz")
  }

  const handleQuizComplete = async (data: any) => {
    // Calculate time to complete
    const timeToComplete = Math.floor((Date.now() - startTime) / 1000)

    // Submit to API
    try {
      const response = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          timeToComplete
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Assessment saved:', result.assessmentId)
      }
    } catch (error) {
      console.error('Failed to save assessment:', error)
      // Still show results even if save fails
    }

    // Show results
    setResultsData(data)
    setStep("results")

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBookCall = () => {
    // TODO: Integrate with Calendly or booking system
    window.open('https://calendly.com/resetbiology', '_blank')
  }

  return (
    <div className="min-h-screen">
      {step === "landing" && (
        <AssessmentLanding onStartQuiz={handleStartQuiz} />
      )}

      {step === "quiz" && (
        <AssessmentQuiz onComplete={handleQuizComplete} />
      )}

      {step === "results" && resultsData && (
        <AssessmentResults
          results={resultsData}
          onBookCall={handleBookCall}
        />
      )}
    </div>
  )
}