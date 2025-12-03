"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react"
import {
  nepqConfig,
  NEPQSection,
  NEPQQuestion,
  getSectionQuestions,
  getSectionById,
  calculateAuditScore,
  generateMirrorResponse,
  generateLabelResponse,
} from "@/config/nepqQuizConfig"
import { NEPQClose } from "./NEPQClose"
import { EnergySpin } from "./EnergySpin"

export interface NEPQAnswers {
  // Section 1: Contact
  name: string
  email: string
  phone: string
  // Section 2: Audit
  audit_practices: string[]
  // Section 3: Journey
  journey_stage: string
  desired_outcome: string
  biggest_obstacle: string
  // Section 4: Vision
  success_vision: string
  success_feeling: string
  // Section 5: Amplification
  why_change: string
  readiness_scale: number
  why_not_lower: string
  positive_outcomes: string
  why_important: string
}

interface NEPQQuizProps {
  onComplete: (data: NEPQAnswers & {
    auditScore: number
    auditLevel: string
    selectedOffer: string | null
    completedEnergySpin: boolean
  }) => void
  onClose?: () => void
}

export function NEPQQuiz({ onComplete, onClose }: NEPQQuizProps) {
  const [currentSection, setCurrentSection] = useState<NEPQSection>("contact")
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [startTime] = useState(Date.now())
  const [showEnergySpin, setShowEnergySpin] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [completedEnergySpin, setCompletedEnergySpin] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const [answers, setAnswers] = useState<NEPQAnswers>({
    name: "",
    email: "",
    phone: "",
    audit_practices: [],
    journey_stage: "",
    desired_outcome: "",
    biggest_obstacle: "",
    success_vision: "",
    success_feeling: "",
    why_change: "",
    readiness_scale: 5,
    why_not_lower: "",
    positive_outcomes: "",
    why_important: "",
  })

  // Get questions for current section
  const sectionQuestions = getSectionQuestions(currentSection)
  const currentQuestion = sectionQuestions[currentQuestionIndex]
  const sectionInfo = getSectionById(currentSection)

  // Calculate overall progress
  const allSections = nepqConfig.sections.filter(s => s.id !== "energySpin" && s.id !== "close")
  const sectionIndex = allSections.findIndex(s => s.id === currentSection)
  const totalQuestions = allSections.reduce((sum, s) => sum + getSectionQuestions(s.id).length, 0)
  const questionsBeforeCurrentSection = allSections
    .slice(0, sectionIndex)
    .reduce((sum, s) => sum + getSectionQuestions(s.id).length, 0)
  const currentProgress = questionsBeforeCurrentSection + currentQuestionIndex + 1
  const progressPercent = Math.round((currentProgress / totalQuestions) * 100)

  // Generate feedback when answer changes
  const generateFeedback = useCallback((question: NEPQQuestion, value: string | number) => {
    if (!question.feedbackType || question.feedbackType === "none") {
      setFeedbackMessage(null)
      return
    }

    const strValue = String(value)
    if (strValue.length < 10) {
      setFeedbackMessage(null)
      return
    }

    if (question.feedbackType === "mirror") {
      setFeedbackMessage(generateMirrorResponse(strValue))
    } else if (question.feedbackType === "label" && question.labelPrefix) {
      setFeedbackMessage(generateLabelResponse(strValue, question.labelPrefix))
    }
  }, [])

  // Handle input changes
  const handleInputChange = (questionId: string, value: string | number | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }))

    // Generate feedback for textarea responses
    if (currentQuestion?.feedbackType && typeof value === "string") {
      generateFeedback(currentQuestion, value)
    }
  }

  // Handle multi-select toggle
  const handleMultiSelectToggle = (questionId: string, value: string) => {
    setAnswers(prev => {
      const currentValues = prev[questionId as keyof NEPQAnswers] as string[]
      if (currentValues.includes(value)) {
        return { ...prev, [questionId]: currentValues.filter(v => v !== value) }
      }
      return { ...prev, [questionId]: [...currentValues, value] }
    })
  }

  // Check if we can proceed to next question
  const canProceed = (): boolean => {
    if (!currentQuestion) return false

    const value = answers[currentQuestion.id as keyof NEPQAnswers]

    if (!currentQuestion.required) return true

    if (Array.isArray(value)) {
      return value.length > 0
    }

    if (typeof value === "number") {
      return value >= (currentQuestion.min || 1) && value <= (currentQuestion.max || 10)
    }

    return value !== undefined && value !== null && String(value).trim() !== ""
  }

  // Navigate to next question/section
  const handleNext = () => {
    setFeedbackMessage(null)

    // If there are more questions in this section
    if (currentQuestionIndex < sectionQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      return
    }

    // Move to next section
    const sections: NEPQSection[] = ["contact", "audit", "journey", "vision", "amplification", "energySpin", "close"]
    const currentSectionIndex = sections.indexOf(currentSection)

    if (currentSectionIndex < sections.length - 1) {
      const nextSection = sections[currentSectionIndex + 1]

      if (nextSection === "energySpin") {
        setShowEnergySpin(true)
        return
      }

      if (nextSection === "close") {
        setShowClose(true)
        return
      }

      setCurrentSection(nextSection)
      setCurrentQuestionIndex(0)
    }
  }

  // Navigate to previous question/section
  const handleBack = () => {
    setFeedbackMessage(null)

    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
      return
    }

    const sections: NEPQSection[] = ["contact", "audit", "journey", "vision", "amplification"]
    const currentSectionIndex = sections.indexOf(currentSection)

    if (currentSectionIndex > 0) {
      const prevSection = sections[currentSectionIndex - 1]
      setCurrentSection(prevSection)
      const prevSectionQuestions = getSectionQuestions(prevSection)
      setCurrentQuestionIndex(prevSectionQuestions.length - 1)
    }
  }

  // Handle Energy Spin completion
  const handleEnergySpinComplete = () => {
    setCompletedEnergySpin(true)
    setShowEnergySpin(false)
    setShowClose(true)
  }

  // Handle Energy Spin skip
  const handleEnergySpinSkip = () => {
    setShowEnergySpin(false)
    setShowClose(true)
  }

  // Handle offer selection and completion
  const handleOfferSelect = (offerId: string | null) => {
    const auditResult = calculateAuditScore(answers.audit_practices)

    onComplete({
      ...answers,
      auditScore: auditResult.score,
      auditLevel: auditResult.level,
      selectedOffer: offerId,
      completedEnergySpin,
    })
  }

  // Render Energy Spin
  if (showEnergySpin) {
    return (
      <EnergySpin
        userName={answers.name}
        onComplete={handleEnergySpinComplete}
        onSkip={handleEnergySpinSkip}
      />
    )
  }

  // Render Close/Offers
  if (showClose) {
    return (
      <NEPQClose
        answers={answers}
        auditScore={calculateAuditScore(answers.audit_practices)}
        onSelect={handleOfferSelect}
        onBack={() => {
          setShowClose(false)
          setCurrentSection("amplification")
          setCurrentQuestionIndex(getSectionQuestions("amplification").length - 1)
        }}
      />
    )
  }

  // Render question
  const renderQuestionInput = () => {
    if (!currentQuestion) return null

    const value = answers[currentQuestion.id as keyof NEPQAnswers]

    switch (currentQuestion.type) {
      case "text":
      case "email":
      case "tel":
        return (
          <input
            type={currentQuestion.type}
            value={String(value || "")}
            onChange={(e) => handleInputChange(currentQuestion.id, e.target.value)}
            placeholder={currentQuestion.placeholder}
            className="w-full px-6 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
            onKeyPress={(e) => {
              if (e.key === "Enter" && canProceed()) {
                handleNext()
              }
            }}
          />
        )

      case "textarea":
        return (
          <div className="space-y-4">
            <textarea
              value={String(value || "")}
              onChange={(e) => handleInputChange(currentQuestion.id, e.target.value)}
              placeholder={currentQuestion.placeholder}
              rows={5}
              className="w-full px-6 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              autoFocus
            />
            {/* Feedback Message */}
            {feedbackMessage && (
              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4 animate-fade-in">
                <p className="text-primary-300 italic">{feedbackMessage}</p>
              </div>
            )}
          </div>
        )

      case "scale":
        return (
          <div className="space-y-6">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{currentQuestion.minLabel}</span>
              <span>{currentQuestion.maxLabel}</span>
            </div>
            <div className="flex justify-center gap-2">
              {Array.from(
                { length: (currentQuestion.max || 10) - (currentQuestion.min || 1) + 1 },
                (_, i) => (currentQuestion.min || 1) + i
              ).map((num) => (
                <button
                  key={num}
                  onClick={() => handleInputChange(currentQuestion.id, num)}
                  className={`w-12 h-12 rounded-full font-bold text-lg transition-all ${
                    value === num
                      ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white scale-110 shadow-lg shadow-primary-500/30"
                      : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="text-center">
              <span className="text-4xl font-bold text-white">{value}</span>
              <span className="text-gray-400 ml-2">/ {currentQuestion.max || 10}</span>
            </div>
          </div>
        )

      case "choice":
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option) => {
              const isSelected = value === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    handleInputChange(currentQuestion.id, option.value)
                    // Auto-advance after selection
                    setTimeout(() => {
                      if (canProceed()) handleNext()
                    }, 300)
                  }}
                  className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-300 ${
                    isSelected
                      ? "bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border-primary-500 shadow-lg shadow-primary-500/20"
                      : "bg-gray-700/30 border-gray-600 hover:border-primary-500/50 hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                        isSelected
                          ? "bg-primary-500 border-primary-500"
                          : "border-gray-500"
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <span className="text-white font-semibold text-lg block">
                        {option.label}
                      </span>
                      {option.sublabel && (
                        <span className="text-gray-400 text-sm">{option.sublabel}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )

      case "multiSelect":
        const selectedValues = (value as string[]) || []
        return (
          <div className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-300 text-sm text-center">
                Select all that currently apply to you ({selectedValues.length} selected)
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {currentQuestion.options?.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => handleMultiSelectToggle(currentQuestion.id, option.value)}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-300 ${
                      isSelected
                        ? "bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border-primary-500"
                        : "bg-gray-700/30 border-gray-600 hover:border-primary-500/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                          isSelected
                            ? "bg-primary-500 border-primary-500"
                            : "border-gray-500"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <span className="text-white font-medium block text-sm">
                          {option.label}
                        </span>
                        {option.sublabel && (
                          <span className="text-gray-400 text-xs">{option.sublabel}</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 px-4 py-8 md:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-400">
              {sectionInfo?.progressLabel}
            </span>
            <span className="text-sm font-semibold text-primary-400">
              {progressPercent}% Complete
            </span>
          </div>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Section indicators */}
          <div className="flex justify-between mt-4">
            {allSections.map((section, idx) => (
              <div
                key={section.id}
                className={`flex flex-col items-center ${
                  idx <= sectionIndex ? "text-primary-400" : "text-gray-600"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full mb-1 ${
                    idx < sectionIndex
                      ? "bg-primary-500"
                      : idx === sectionIndex
                      ? "bg-primary-400 ring-2 ring-primary-500/30"
                      : "bg-gray-700"
                  }`}
                />
                <span className="text-xs hidden md:block">{section.progressLabel}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10 shadow-2xl">
          <div className="space-y-6">
            {/* Section Title */}
            {currentQuestionIndex === 0 && (
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-primary-400" />
                <span className="text-primary-400 font-semibold uppercase tracking-wide text-sm">
                  {sectionInfo?.title}
                </span>
              </div>
            )}

            {/* Question Text */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {currentQuestion?.question}
              </h2>
              {currentQuestion?.subtitle && (
                <p className="text-gray-400 text-lg">{currentQuestion.subtitle}</p>
              )}
            </div>

            {/* Input */}
            {renderQuestionInput()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8 pt-8 border-t border-gray-700">
            <button
              onClick={handleBack}
              disabled={currentSection === "contact" && currentQuestionIndex === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                currentSection === "contact" && currentQuestionIndex === 0
                  ? "opacity-50 cursor-not-allowed text-gray-500"
                  : "text-white hover:bg-gray-700/50"
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
                  ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:shadow-lg hover:shadow-primary-500/50 transform hover:scale-105"
                  : "opacity-50 cursor-not-allowed bg-gray-700 text-gray-400"
              }`}
            >
              Continue
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NEPQQuiz
