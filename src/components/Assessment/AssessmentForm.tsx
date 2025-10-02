"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft, Clock } from "lucide-react"
import { IRBHandoff } from "./IRBHandoff"
import type { AssessmentResponse, AssessmentResult } from "@/types"

interface Question {
  id: string
  question: string
  type: 'multiple-choice' | 'scale' | 'yes-no'
  options?: string[]
  weight: number
}

const assessmentQuestions: Question[] = [
  {
    id: "current-treatment",
    question: "What GLP-1 medication are you currently using?",
    type: "multiple-choice",
    options: ["Semaglutide (Ozempic/Wegovy)", "Tirzepatide (Mounjaro/Zepbound)", "Compounded GLP-1", "Not currently using any", "Other"],
    weight: 10
  },
  {
    id: "treatment-duration",
    question: "How long have you been on your current treatment?",
    type: "multiple-choice", 
    options: ["Less than 3 months", "3-6 months", "6-12 months", "Over 1 year", "Not applicable"],
    weight: 8
  },
  {
    id: "muscle-loss",
    question: "Have you noticed muscle loss or weakness since starting your current medication?",
    type: "scale",
    weight: 15
  },
  {
    id: "energy-levels",
    question: "How would you rate your current energy levels?",
    type: "scale",
    weight: 8
  },
  {
    id: "weight-plateaus",
    question: "Are you experiencing weight loss plateaus on your current treatment?",
    type: "yes-no",
    weight: 12
  },
  {
    id: "side-effects",
    question: "How severe are your current medication side effects?",
    type: "scale",
    weight: 10
  },
  {
    id: "dependency-concerns",
    question: "Are you concerned about long-term dependency on your current medication?",
    type: "scale",
    weight: 15
  },
  {
    id: "provider-support",
    question: "How satisfied are you with your current provider's ongoing support?",
    type: "scale",
    weight: 8
  },
  {
    id: "metabolic-goals",
    question: "What is your primary metabolic health goal?",
    type: "multiple-choice",
    options: ["Sustainable weight loss", "Muscle preservation", "Energy optimization", "Medication independence", "Overall metabolic health"],
    weight: 10
  },
  {
    id: "investment-readiness",
    question: "Are you ready to invest in a comprehensive metabolic restoration program?",
    type: "scale",
    weight: 12
  }
]

export function AssessmentForm() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [responses, setResponses] = useState<AssessmentResponse[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [results, setResults] = useState<AssessmentResult | null>(null)
  const [showIRBHandoff, setShowIRBHandoff] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(60)
  const [psychologicalInvestment, setPsychologicalInvestment] = useState(0)

  const handleAnswer = (answer: string | number) => {
    const question = assessmentQuestions[currentQuestion]
    const response: AssessmentResponse = {
      questionId: question.id,
      question: question.question,
      answer,
      weight: question.weight
    }

    const newResponses = [...responses]
    const existingIndex = newResponses.findIndex(r => r.questionId === question.id)
    
    if (existingIndex >= 0) {
      newResponses[existingIndex] = response
    } else {
      newResponses.push(response)
    }
    
    setResponses(newResponses)
    
    // Psychological investment increases with each answer
    setPsychologicalInvestment(prev => prev + question.weight)

    if (currentQuestion < assessmentQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      calculateResults(newResponses)
    }
  }

  const calculateResults = (allResponses: AssessmentResponse[]) => {
    let totalScore = 0
    let maxScore = 0
    
    allResponses.forEach(response => {
      maxScore += response.weight || 1
      
      if (typeof response.answer === 'number') {
        totalScore += (response.answer / 10) * (response.weight || 1)
      } else if (response.answer === 'yes') {
        totalScore += response.weight || 1
      } else if (typeof response.answer === 'string') {
        // Weight certain responses higher for Retatrutide recommendation
        if (response.questionId === 'current-treatment' && 
            (response.answer.includes('Semaglutide') || response.answer.includes('Tirzepatide'))) {
          totalScore += response.weight || 1
        }
        if (response.questionId === 'muscle-loss' && response.answer === 'yes') {
          totalScore += (response.weight || 1) * 1.5
        }
      }
    })

    const normalizedScore = (totalScore / maxScore) * 100
    
    const assessmentResult: AssessmentResult = {
      score: normalizedScore,
      recommendations: generateRecommendations(normalizedScore, allResponses),
      peptideRecommendation: normalizedScore > 60 ? 'Retatrutide Protocol' : 'Consultation Required',
      urgencyLevel: normalizedScore > 80 ? 'high' : normalizedScore > 60 ? 'medium' : 'low',
      irbEligible: normalizedScore > 50
    }

    setResults(assessmentResult)
    setIsComplete(true)
  }

  const generateRecommendations = (score: number, responses: AssessmentResponse[]): string[] => {
    const recs = []
    
    if (score > 70) {
      recs.push("You're an excellent candidate for our IRB-approved Retatrutide protocol")
      recs.push("Consider our comprehensive Mental Mastery program for lasting results")
    }
    
    if (responses.some(r => r.questionId === 'muscle-loss' && typeof r.answer === 'number' && r.answer > 7)) {
      recs.push("Urgent: Your current medication may be causing significant muscle loss")
    }
    
    if (responses.some(r => r.questionId === 'dependency-concerns' && typeof r.answer === 'number' && r.answer > 8)) {
      recs.push("Our tapering protocol can help you achieve medication independence")
    }
    
    return recs
  }

  const goBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const progress = ((currentQuestion + 1) / assessmentQuestions.length) * 100

  if (showIRBHandoff && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
           style={{
             backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <IRBHandoff assessmentResults={results} assessmentResponses={responses} />
        </div>
      </div>
    )
  }

  if (isComplete && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
           style={{
             backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30"
          >
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl drop-shadow-lg">{Math.round(results.score)}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">Your Personalized Reset Protocol</h2>
            <p className="text-gray-200 mb-2">
              <strong>You've invested {Math.round((psychologicalInvestment / 100) * 100)}% of your assessment</strong>
            </p>
            <p className="text-gray-200">
              Protocol Urgency: <span className={`font-semibold ${
                results.urgencyLevel === 'high' ? 'text-red-400' :
                results.urgencyLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'
              }`}>{results.urgencyLevel === 'high' ? 'IMMEDIATE ACTION NEEDED' : 
                  results.urgencyLevel === 'medium' ? 'WITHIN 30 DAYS' : 'CONSULTATION RECOMMENDED'}</span>
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-white drop-shadow-sm">Personalized Recommendations:</h3>
            {results.recommendations.map((rec, index) => (
              <div key={index} className="bg-gradient-to-br from-primary-600/20 to-primary-700/30 p-4 rounded-lg border-l-4 border-primary-400/70 backdrop-blur-sm shadow-lg">
                <p className="text-gray-200">{rec}</p>
              </div>
            ))}
          </div>

          {results.irbEligible ? (
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white p-6 rounded-lg text-center">
              <h3 className="text-xl font-bold mb-2">🎯 You Qualify for Advanced Protocol</h3>
              <p className="mb-2"><strong>IRB-Approved Retatrutide Research</strong></p>
              <p className="mb-4 text-primary-100">Your responses indicate you're experiencing the exact problems Retatrutide solves. Don't let your current medication continue damaging your muscle mass.</p>
              <div className="bg-white/10 p-3 rounded mb-4">
                <p className="text-sm"><strong>Time-Sensitive:</strong> Limited research spots available</p>
              </div>
              <button 
                onClick={() => setShowIRBHandoff(true)}
                className="bg-white text-primary-600 hover:bg-gray-100 font-semibold py-4 px-8 rounded-lg transition-colors text-lg"
              >
                Secure Your Research Spot Now
              </button>
              <p className="text-xs text-primary-200 mt-2">No cost consultation • IRB-approved protocol • Medical supervision included</p>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-6 rounded-lg text-center">
              <h3 className="text-xl font-bold mb-2">⚠️ Consultation Required First</h3>
              <p className="mb-4">Your responses suggest we need to discuss your specific situation before recommending a protocol. This ensures your safety and success.</p>
              <div className="bg-white/10 p-3 rounded mb-4">
                <p className="text-sm"><strong>Good news:</strong> 94% of consultations lead to protocol approval</p>
              </div>
              <button className="bg-white text-orange-600 hover:bg-gray-100 font-semibold py-4 px-8 rounded-lg transition-colors text-lg">
                Schedule Your Strategy Call
              </button>
              <p className="text-xs text-orange-200 mt-2">Free 15-minute consultation • No pressure • Clear next steps</p>
            </div>
          )}
          </motion.div>
        </div>
      </div>
    )
  }

  const currentQ = assessmentQuestions[currentQuestion]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img src="/reset-logo-pro.png" alt="Reset Biology" className="h-12 w-auto mr-4 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-2 border border-white/20" />
              <Clock className="w-6 h-6 text-primary-400 mr-2 drop-shadow-lg" />
              <span className="text-white text-lg font-medium drop-shadow-lg">60-Second Reset Assessment</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-900/50 rounded-full h-3 mb-4 backdrop-blur-sm border border-gray-600/30">
              <motion.div 
                className="bg-gradient-to-r from-primary-400/70 to-secondary-400/70 h-full rounded-full shadow-lg shadow-primary-400/30"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            <p className="text-gray-200 text-sm drop-shadow-sm">
              Question {currentQuestion + 1} of {assessmentQuestions.length}
            </p>
          </div>

          {/* Question Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30"
            >
            <h2 className="text-xl font-semibold text-white mb-6 text-center drop-shadow-sm">
              {currentQ.question}
            </h2>

            <div className="space-y-3">
              {currentQ.type === 'multiple-choice' && currentQ.options && (
                <>
                  {currentQ.options.map((option, index) => {
                    // Cycle through different color schemes like breath training boxes
                    const colorSchemes = [
                      'from-primary-600/20 to-primary-700/30 hover:from-primary-500/30 hover:to-primary-600/40 border-primary-400/30 hover:border-primary-400/50 shadow-primary-400/20',
                      'from-blue-600/20 to-blue-700/30 hover:from-blue-500/30 hover:to-blue-600/40 border-blue-400/30 hover:border-blue-400/50 shadow-blue-400/20',
                      'from-amber-600/20 to-amber-700/30 hover:from-amber-500/30 hover:to-amber-600/40 border-amber-400/30 hover:border-amber-400/50 shadow-amber-400/20',
                      'from-green-600/20 to-green-700/30 hover:from-green-500/30 hover:to-green-600/40 border-green-400/30 hover:border-green-400/50 shadow-green-400/20',
                      'from-purple-600/20 to-purple-700/30 hover:from-purple-500/30 hover:to-purple-600/40 border-purple-400/30 hover:border-purple-400/50 shadow-purple-400/20'
                    ];
                    const colorScheme = colorSchemes[index % colorSchemes.length];
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswer(option)}
                        className={`w-full p-5 text-left bg-gradient-to-br ${colorScheme} border-2 rounded-xl transition-all duration-200 hover:shadow-2xl hover:scale-[1.02] font-medium text-white backdrop-blur-sm shadow-xl`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </>
              )}

              {currentQ.type === 'scale' && (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Not at all</span>
                    <span>Extremely</span>
                  </div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                      // Different colors for different value ranges
                      let colorScheme;
                      if (value <= 2) {
                        colorScheme = 'from-red-600/20 to-red-700/30 hover:from-red-500/30 hover:to-red-600/40 border-red-400/30 hover:border-red-400/50 shadow-red-400/20';
                      } else if (value <= 4) {
                        colorScheme = 'from-orange-600/20 to-orange-700/30 hover:from-orange-500/30 hover:to-orange-600/40 border-orange-400/30 hover:border-orange-400/50 shadow-orange-400/20';
                      } else if (value <= 6) {
                        colorScheme = 'from-amber-600/20 to-amber-700/30 hover:from-amber-500/30 hover:to-amber-600/40 border-amber-400/30 hover:border-amber-400/50 shadow-amber-400/20';
                      } else if (value <= 8) {
                        colorScheme = 'from-blue-600/20 to-blue-700/30 hover:from-blue-500/30 hover:to-blue-600/40 border-blue-400/30 hover:border-blue-400/50 shadow-blue-400/20';
                      } else {
                        colorScheme = 'from-green-600/20 to-green-700/30 hover:from-green-500/30 hover:to-green-600/40 border-green-400/30 hover:border-green-400/50 shadow-green-400/20';
                      }
                      
                      return (
                        <button
                          key={value}
                          onClick={() => handleAnswer(value)}
                          className={`w-14 h-14 bg-gradient-to-br ${colorScheme} border-2 rounded-xl font-bold transition-all duration-200 hover:scale-110 hover:shadow-2xl text-white backdrop-blur-sm shadow-xl`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentQ.type === 'yes-no' && (
                <div className="flex gap-4">
                  <button
                    onClick={() => handleAnswer('yes')}
                    className="flex-1 p-6 bg-gradient-to-br from-primary-600/70 to-primary-700/80 hover:from-primary-500/80 hover:to-primary-600/90 text-white rounded-xl font-bold transition-all duration-200 hover:scale-105 hover:shadow-xl text-xl backdrop-blur-sm border border-primary-400/30"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleAnswer('no')}
                    className="flex-1 p-6 bg-gradient-to-br from-gray-600/70 to-gray-700/80 hover:from-gray-500/80 hover:to-gray-600/90 text-white rounded-xl font-bold transition-all duration-200 hover:scale-105 hover:shadow-xl text-xl backdrop-blur-sm border border-gray-500/30"
                  >
                    No
                  </button>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <button
                onClick={goBack}
                disabled={currentQuestion === 0}
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors backdrop-blur-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </button>
              
              <span className="text-gray-300 text-sm self-center drop-shadow-sm">
                {Math.max(0, 60 - (currentQuestion * 6))}s remaining
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>
  )
}