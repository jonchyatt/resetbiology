"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

interface QuestionOption {
  value: string
  label: string
  score?: number
}

interface Question {
  id: string
  question: string
  subtitle?: string
  type: "text" | "email" | "tel" | "textarea" | "choice"
  placeholder?: string
  required?: boolean
  options?: QuestionOption[]
}

interface QuizData {
  name: string
  email: string
  phone: string
  q5_protein_tracking: string
  q6_stem_cell_support: string
  q7_unified_tracking: string
  q8_breathwork: string
  q9_sleep_tracking: string
  q10_detox_protocols: string
  q11_journaling: string
  q12_workout_program: string
  q13_accountability: string
  q14_peptide_knowledge: string
  q15_current_situation: string
  q16_desired_outcome: string
  q17_biggest_obstacle: string
  q18_ideal_solution: string
  q19_additional_info: string
}

interface AssessmentQuizProps {
  onComplete: (data: QuizData & { score: number; scoreCategory: string; recommendedTier: string }) => void
}

export function AssessmentQuiz({ onComplete }: AssessmentQuizProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [startTime] = useState(Date.now())
  const [formData, setFormData] = useState<QuizData>({
    name: "",
    email: "",
    phone: "",
    q5_protein_tracking: "",
    q6_stem_cell_support: "",
    q7_unified_tracking: "",
    q8_breathwork: "",
    q9_sleep_tracking: "",
    q10_detox_protocols: "",
    q11_journaling: "",
    q12_workout_program: "",
    q13_accountability: "",
    q14_peptide_knowledge: "",
    q15_current_situation: "",
    q16_desired_outcome: "",
    q17_biggest_obstacle: "",
    q18_ideal_solution: "",
    q19_additional_info: ""
  })

  const questions: Question[] = [
    // Step 0-3: Contact Info
    {
      id: "name",
      question: "What's your first name?",
      type: "text" as const,
      placeholder: "Enter your name",
      required: true
    },
    {
      id: "email",
      question: "What's your email address?",
      subtitle: "We'll send your personalized results here",
      type: "email" as const,
      placeholder: "you@example.com",
      required: true
    },
    {
      id: "phone",
      question: "Phone number (optional)",
      subtitle: "For priority support and follow-up",
      type: "tel" as const,
      placeholder: "(555) 123-4567",
      required: false
    },

    // Step 4-13: Best Practices Questions (Q5-Q14)
    {
      id: "q5_protein_tracking",
      question: "Are you currently tracking your daily protein intake to ensure you're getting 0.8-1g per pound of bodyweight?",
      type: "choice" as const,
      options: [
        { value: "yes-daily", label: "Yes, I track daily", score: 10 },
        { value: "sometimes", label: "Sometimes", score: 5 },
        { value: "no", label: "No, I don't track", score: 0 },
        { value: "dont-know", label: "I don't know my target", score: 0 }
      ]
    },
    {
      id: "q6_stem_cell_support",
      question: "Are you taking any supplements or protocols specifically designed to support stem cell release and tissue repair?",
      type: "choice" as const,
      options: [
        { value: "yes-peptides", label: "Yes, I'm on a peptide or stem cell protocol", score: 10 },
        { value: "basic-supps", label: "I take basic supplements (vitamins, fish oil)", score: 3 },
        { value: "no-supps", label: "No supplements currently", score: 0 },
        { value: "never-heard", label: "I've never heard of this", score: 0 }
      ]
    },
    {
      id: "q7_unified_tracking",
      question: "Do you use a digital system to track your workouts, nutrition, and recovery in one unified platform?",
      type: "choice" as const,
      options: [
        { value: "yes-unified", label: "Yes, everything is tracked digitally", score: 10 },
        { value: "manual", label: "I track some things manually", score: 4 },
        { value: "in-head", label: "I track in my head or sporadically", score: 1 },
        { value: "no-tracking", label: "I don't track consistently", score: 0 }
      ]
    },
    {
      id: "q8_breathwork",
      question: "Are you practicing daily breathwork or meditation to optimize your nervous system and metabolic flexibility?",
      type: "choice" as const,
      options: [
        { value: "daily", label: "Yes, daily practice (10+ min)", score: 10 },
        { value: "weekly", label: "Occasionally (1-2x per week)", score: 4 },
        { value: "rarely", label: "Rarely", score: 1 },
        { value: "never", label: "Never heard of metabolic flexibility training", score: 0 }
      ]
    },
    {
      id: "q9_sleep_tracking",
      question: "Are you tracking your sleep quality and using protocols to ensure 7+ hours of deep, restorative sleep?",
      type: "choice" as const,
      options: [
        { value: "track-optimize", label: "Yes, I track sleep and use optimization protocols", score: 10 },
        { value: "try-7hrs", label: "I try to get 7+ hours but don't track quality", score: 5 },
        { value: "inconsistent", label: "My sleep is inconsistent", score: 2 },
        { value: "struggle", label: "Sleep is a struggle for me", score: 0 }
      ]
    },
    {
      id: "q10_detox_protocols",
      question: "Are you supporting your body's natural detox pathways with chlorella, spirulina, or other cellular cleansing protocols?",
      type: "choice" as const,
      options: [
        { value: "yes-protocol", label: "Yes, I have a detox protocol", score: 10 },
        { value: "tried-before", label: "I've tried detoxing before", score: 3 },
        { value: "no-protocol", label: "No detox protocols currently", score: 0 },
        { value: "dont-know", label: "I don't know what this means", score: 0 }
      ]
    },
    {
      id: "q11_journaling",
      question: "Do you maintain a daily journal to track emotional patterns, stress levels, and their impact on your weight loss?",
      type: "choice" as const,
      options: [
        { value: "daily", label: "Yes, I journal daily", score: 10 },
        { value: "occasional", label: "I journal occasionally", score: 5 },
        { value: "tried-quit", label: "I tried but couldn't stick with it", score: 2 },
        { value: "never", label: "I've never journaled for health", score: 0 }
      ]
    },
    {
      id: "q12_workout_program",
      question: "Are you following a structured, progressive workout program designed for fat loss and muscle preservation?",
      type: "choice" as const,
      options: [
        { value: "structured", label: "Yes, I have a structured program", score: 10 },
        { value: "regular-no-program", label: "I work out regularly but no formal program", score: 5 },
        { value: "sporadic", label: "I work out sporadically", score: 2 },
        { value: "not-working-out", label: "I'm not currently working out", score: 0 }
      ]
    },
    {
      id: "q13_accountability",
      question: "Do you have daily check-ins, notifications, or accountability systems to keep you on track?",
      type: "choice" as const,
      options: [
        { value: "multiple-systems", label: "Yes, I have multiple accountability systems", score: 10 },
        { value: "some-reminders", label: "I have some reminders set up", score: 5 },
        { value: "willpower-only", label: "I rely on willpower alone", score: 1 },
        { value: "often-forget", label: "I often forget my protocols", score: 0 }
      ]
    },
    {
      id: "q14_peptide_knowledge",
      question: "Are you familiar with how peptides like BPC-157, CJC-1295, or Semaglutide can support cellular fat loss and recovery?",
      type: "choice" as const,
      options: [
        { value: "using-peptides", label: "Yes, I'm currently using peptides", score: 10 },
        { value: "heard-never-used", label: "I've heard of them but never used them", score: 5 },
        { value: "curious", label: "I'm curious but don't know where to start", score: 2 },
        { value: "never-heard", label: "I've never heard of peptides for weight loss", score: 0 }
      ]
    },

    // Step 14-18: The Big 5 Qualifying Questions
    {
      id: "q15_current_situation",
      question: "Which best describes your current weight loss journey?",
      type: "choice" as const,
      options: [
        { value: "just-starting", label: "Just starting, need guidance on everything" },
        { value: "6-12mo-stuck", label: "Been trying for 6-12 months, some progress but stuck" },
        { value: "1-3yrs-plateaus", label: "Been trying for 1-3 years, multiple plateaus" },
        { value: "3plus-frustrated", label: "Been trying for 3+ years, tried everything, very frustrated" }
      ]
    },
    {
      id: "q16_desired_outcome",
      question: "What is the #1 outcome you want to achieve in the next 90 days?",
      type: "choice" as const,
      options: [
        { value: "lose-15-25lbs", label: "Lose 15-25 lbs of stubborn fat" },
        { value: "break-plateau", label: "Break through my current plateau" },
        { value: "increase-energy", label: "Increase energy and metabolic rate" },
        { value: "sustainable-system", label: "Build a sustainable system that finally works long-term" }
      ]
    },
    {
      id: "q17_biggest_obstacle",
      question: "What do you think is the biggest obstacle stopping you from reaching your goal?",
      type: "choice" as const,
      options: [
        { value: "lack-knowledge", label: "I don't know what I'm doing wrong" },
        { value: "lack-consistency", label: "I can't stay consistent" },
        { value: "metabolism-broken", label: "My metabolism seems broken" },
        { value: "tried-everything", label: "I've tried everything and nothing works" }
      ]
    },
    {
      id: "q18_ideal_solution",
      question: "Which solution sounds most appealing to you?",
      type: "choice" as const,
      options: [
        { value: "diy", label: "DIY: Give me the tools, I'll do it myself ($97-297/mo)" },
        { value: "guided", label: "Guided: Protocols + coaching check-ins ($497-997/mo)" },
        { value: "done-with-you", label: "Done-With-You: Personalized protocols + full tracking + weekly support ($1,497-2,997/mo)" },
        { value: "concierge", label: "Concierge: Do it all for me with 1-on-1 coaching ($3,000+/mo)" }
      ]
    },
    {
      id: "q19_additional_info",
      question: "Is there anything else we should know about your situation, goals, or concerns?",
      subtitle: "This helps us give you better recommendations (optional)",
      type: "textarea" as const,
      placeholder: "Share anything you'd like us to know...",
      required: false
    }
  ]

  const currentQuestion = questions[currentStep]
  const progress = ((currentStep + 1) / questions.length) * 100

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }))
  }

  const canProceed = () => {
    const currentValue = formData[currentQuestion.id as keyof QuizData]
    if (!currentQuestion.required) return true
    return currentValue && currentValue.trim() !== ""
  }

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const calculateScore = () => {
    let totalScore = 0
    const scoringQuestions = questions.slice(3, 13) // Q5-Q14

    scoringQuestions.forEach(q => {
      const answer = formData[q.id as keyof QuizData]
      const selectedOption = q.options?.find(opt => opt.value === answer)
      if (selectedOption?.score !== undefined) {
        totalScore += selectedOption.score
      }
    })

    return totalScore
  }

  const getScoreCategory = (score: number): string => {
    if (score >= 80) return "master"
    if (score >= 60) return "strong"
    if (score >= 40) return "gaps"
    return "fresh"
  }

  const getRecommendedTier = (): string => {
    const solution = formData.q18_ideal_solution
    if (solution === "concierge") return "concierge"
    if (solution === "done-with-you") return "done-with-you"
    if (solution === "guided") return "guided"
    return "diy"
  }

  const handleSubmit = () => {
    const score = calculateScore()
    const scoreCategory = getScoreCategory(score)
    const recommendedTier = getRecommendedTier()

    onComplete({
      ...formData,
      score,
      scoreCategory,
      recommendedTier
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-400">
              Question {currentStep + 1} of {questions.length}
            </span>
            <span className="text-sm font-semibold text-primary-400">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10 shadow-2xl">
          <div className="space-y-6">
            {/* Question Text */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {currentQuestion.question}
              </h2>
              {currentQuestion.subtitle && (
                <p className="text-gray-400 text-lg">
                  {currentQuestion.subtitle}
                </p>
              )}
            </div>

            {/* Input Fields */}
            {currentQuestion.type === "text" || currentQuestion.type === "email" || currentQuestion.type === "tel" ? (
              <input
                type={currentQuestion.type}
                value={formData[currentQuestion.id as keyof QuizData]}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="w-full px-6 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && canProceed()) {
                    handleNext()
                  }
                }}
              />
            ) : currentQuestion.type === "textarea" ? (
              <textarea
                value={formData[currentQuestion.id as keyof QuizData]}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={currentQuestion.placeholder}
                rows={5}
                className="w-full px-6 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                autoFocus
              />
            ) : currentQuestion.type === "choice" ? (
              <div className="space-y-3">
                {currentQuestion.options?.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleInputChange(option.value)}
                    className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-300 ${
                      formData[currentQuestion.id as keyof QuizData] === option.value
                        ? 'bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border-primary-500 shadow-lg shadow-primary-500/20'
                        : 'bg-gray-700/30 border-gray-600 hover:border-primary-500/50 hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="text-white font-semibold text-lg">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8 pt-8 border-t border-gray-700">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                currentStep === 0
                  ? 'opacity-50 cursor-not-allowed text-gray-500'
                  : 'text-white hover:bg-gray-700/50'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
                canProceed()
                  ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:shadow-lg hover:shadow-primary-500/50 transform hover:scale-105'
                  : 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-400'
              }`}
            >
              {currentStep === questions.length - 1 ? 'View Results' : 'Next'}
              {currentStep === questions.length - 1 ? null : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
