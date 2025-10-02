"use client"

import { useState } from "react"
import { ExternalLink, CheckCircle, Clock, Shield } from "lucide-react"
import type { AssessmentResult } from "@/types"

interface IRBHandoffProps {
  assessmentResults: AssessmentResult
  assessmentResponses: any[]
}

export function IRBHandoff({ assessmentResults, assessmentResponses }: IRBHandoffProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [handoffComplete, setHandoffComplete] = useState(false)

  const handleIRBSubmission = async () => {
    setIsSubmitting(true)
    
    try {
      // Prepare data for cellularpeptide.com
      const irbData = {
        assessmentScore: assessmentResults.score,
        urgencyLevel: assessmentResults.urgencyLevel,
        peptideRecommendation: assessmentResults.peptideRecommendation,
        responses: assessmentResponses,
        timestamp: new Date().toISOString(),
        source: 'resetbiology.com'
      }

      // Call our API to handle IRB submission
      const response = await fetch('/api/irb-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assessmentData: irbData,
          assessmentId: 'temp-id' // TODO: Pass actual assessment ID
        })
      })

      if (response.ok) {
        // Option 1: Direct redirect with assessment data (preferred if cellularpeptide supports)
        const params = new URLSearchParams({
          source: 'resetbiology',
          assessment_score: assessmentResults.score.toString(),
          urgency: assessmentResults.urgencyLevel,
          recommendation: assessmentResults.peptideRecommendation,
          return_url: `${window.location.origin}/portal`
        })
        
        // For now, show completion state (later redirect to cellularpeptide.com)
        const responseData = await response.json()
        console.log('IRB handoff successful:', responseData)
        setHandoffComplete(true)
        setIsSubmitting(false)
        
        // Future: Direct redirect to cellularpeptide.com
        // window.location.href = `https://cellularpeptide.com/irb-application?${params}`
        
      } else {
        throw new Error('Failed to process IRB handoff')
      }

    } catch (error) {
      console.error('IRB handoff error:', error)
      setIsSubmitting(false)
      // Show error message to user
      alert('Unable to connect to IRB partner. Please try again or contact support.')
    }
  }

  if (handoffComplete) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg p-8 shadow-xl">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">IRB Application Submitted</h2>
          <p className="text-gray-600 mb-6">
            Your assessment data has been securely transferred to our IRB-approved partner. 
            You should receive an email confirmation within 24 hours.
          </p>
          
          <div className="bg-primary-50 p-6 rounded-lg border border-primary-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">What Happens Next?</h3>
            <ul className="text-left text-gray-700 space-y-2">
              <li>• Medical review of your assessment (24-48 hours)</li>
              <li>• IRB protocol approval confirmation</li>
              <li>• Personalized treatment plan creation</li>
              <li>• Portal access and welcome sequence</li>
            </ul>
          </div>

          <button className="btn-primary w-full">
            Return to Reset Biology
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg p-8 shadow-xl">
      <div className="text-center mb-6">
        <Shield className="w-16 h-16 mx-auto mb-4 text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">IRB Compliance Application</h2>
        <p className="text-gray-600">
          Your assessment qualifies you for our IRB-approved Retatrutide research protocol.
        </p>
      </div>

      <div className="bg-primary-50 p-6 rounded-lg border border-primary-200 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Assessment Summary</h3>
        <div className="grid gap-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Assessment Score:</span>
            <span className="font-semibold">{Math.round(assessmentResults.score)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Urgency Level:</span>
            <span className={`font-semibold ${
              assessmentResults.urgencyLevel === 'high' ? 'text-red-600' :
              assessmentResults.urgencyLevel === 'medium' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {assessmentResults.urgencyLevel.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Recommended Protocol:</span>
            <span className="font-semibold text-primary-600">{assessmentResults.peptideRecommendation}</span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
        <div className="flex items-start">
          <Clock className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-yellow-800 mb-1">IRB Enrollment Window</h4>
            <p className="text-yellow-700 text-sm">
              Research protocol enrollment is limited. Complete your application today to secure your spot.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={handleIRBSubmission}
          disabled={isSubmitting}
          className="btn-primary w-full mb-4 flex items-center justify-center"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Submitting to IRB Partner...
            </>
          ) : (
            <>
              Continue to IRB Application
              <ExternalLink className="w-4 h-4 ml-2" />
            </>
          )}
        </button>
        
        <p className="text-xs text-gray-500">
          You will be securely transferred to our IRB-approved partner cellularpeptide.com to complete your medical application.
        </p>
      </div>
    </div>
  )
}