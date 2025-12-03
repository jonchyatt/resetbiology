"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NEPQQuiz, NEPQAnswers } from "@/components/Quiz"
import { Loader2, CheckCircle, ArrowRight } from "lucide-react"

type SubmissionResult = {
  success: boolean
  submissionId: string
  selectedOffer: string | null
  recommendedAction: {
    action: string
    url: string
    message: string
  }
}

function GetStartedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmissionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startTime] = useState(Date.now())

  // Get UTM params from URL
  const utmSource = searchParams.get("utm_source")
  const utmMedium = searchParams.get("utm_medium")
  const utmCampaign = searchParams.get("utm_campaign")

  const handleQuizComplete = async (
    data: NEPQAnswers & {
      auditScore: number
      auditLevel: string
      selectedOffer: string | null
      completedEnergySpin: boolean
    }
  ) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          startedAt: new Date(startTime).toISOString(),
          utmSource,
          utmMedium,
          utmCampaign,
          referrer: document.referrer || null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit quiz")
      }

      const result = await response.json()
      setSubmitResult(result)
    } catch (err) {
      console.error("Quiz submission error:", err)
      setError("Something went wrong. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    router.push("/")
  }

  // Show loading state while submitting
  if (isSubmitting && !submitResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-xl font-medium">Saving your responses...</p>
          <p className="text-gray-400 mt-2">Setting up your personalized experience</p>
        </div>
      </div>
    )
  }

  // Show success/redirect state
  if (submitResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-primary-900/20 to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            You're all set!
          </h1>

          <p className="text-gray-300 text-lg mb-8">
            {submitResult.recommendedAction.message}
          </p>

          {submitResult.selectedOffer && (
            <div className="bg-gray-800/50 rounded-xl p-6 mb-8 border border-primary-500/20">
              <p className="text-gray-400 text-sm mb-2">You selected</p>
              <p className="text-white font-semibold text-lg capitalize">
                {submitResult.selectedOffer.replace(/-/g, " ")} Plan
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <a
              href={submitResult.recommendedAction.url}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </a>

            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Return to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
            <span className="text-red-400 text-3xl">!</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Oops!</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setIsSubmitting(false)
            }}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Show quiz
  return <NEPQQuiz onComplete={handleQuizComplete} onClose={handleClose} />
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
        <p className="text-white text-xl font-medium">Loading...</p>
      </div>
    </div>
  )
}

export default function GetStartedPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GetStartedContent />
    </Suspense>
  )
}
