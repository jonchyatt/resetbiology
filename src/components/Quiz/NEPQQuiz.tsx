"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react"
import {
  nepqConfig,
  NEPQSection,
  getSectionQuestions,
  getSectionById,
  calculateAuditScore,
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
  desired_outcome: string[]  // Now ranked array
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

  const [answers, setAnswers] = useState<NEPQAnswers>({
    name: "",
    email: "",
    phone: "",
    audit_practices: [],
    journey_stage: "",
    desired_outcome: [],
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

  // Handle input changes
  const handleInputChange = (questionId: string, value: string | number | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }))
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

  // Handle ranked select toggle (click to add in order, click again to remove)
  const handleRankedSelectToggle = (questionId: string, value: string, maxSelections: number = 3) => {
    setAnswers(prev => {
      const currentValues = prev[questionId as keyof NEPQAnswers] as string[]
      // If already selected, remove it (and others move up automatically)
      if (currentValues.includes(value)) {
        return { ...prev, [questionId]: currentValues.filter(v => v !== value) }
      }
      // If not selected and under limit, add it
      if (currentValues.length < maxSelections) {
        return { ...prev, [questionId]: [...currentValues, value] }
      }
      // Already have max choices, don't add more
      return prev
    })
  }

  // Get rank label
  const getRankLabel = (index: number): string => {
    const labels = ["1st", "2nd", "3rd"]
    return labels[index] || ""
  }

  // Get rank color
  const getRankColor = (index: number): string => {
    const colors = [
      "bg-yellow-500 text-yellow-900", // 1st - gold
      "bg-gray-400 text-gray-900",      // 2nd - silver
      "bg-orange-600 text-orange-100",  // 3rd - bronze
    ]
    return colors[index] || colors[2]
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
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
      return
    }

    const sections: NEPQSection[] = ["contact", "audit", "journey", "vision", "amplification"]
    const currentSectionIndex = sections.indexOf(currentSection)

    if (currentSectionIndex > 0) {
      const prevSection = sections[currentSectionIndex - 1]
      setCurrentSection(prevSection)
      // Contact section is special (combined) - just set index to 0
      if (prevSection === "contact") {
        setCurrentQuestionIndex(0)
      } else {
        const prevSectionQuestions = getSectionQuestions(prevSection)
        setCurrentQuestionIndex(prevSectionQuestions.length - 1)
      }
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
          <textarea
            value={String(value || "")}
            onChange={(e) => handleInputChange(currentQuestion.id, e.target.value)}
            placeholder={currentQuestion.placeholder}
            rows={5}
            className="w-full px-6 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            autoFocus
          />
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

      case "rankedSelect":
        const rankedValues = (value as string[]) || []
        const maxRanked = currentQuestion.maxRankedSelect || 3
        return (
          <div className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-300 text-sm text-center">
                Select up to {maxRanked} options in order of importance (click again to remove)
              </p>
            </div>
            <div className="space-y-3">
              {currentQuestion.options?.map((option) => {
                const rankIndex = rankedValues.indexOf(option.value)
                const isRankedSelected = rankIndex !== -1
                return (
                  <button
                    key={option.value}
                    onClick={() => handleRankedSelectToggle(currentQuestion.id, option.value, maxRanked)}
                    className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-300 ${
                      isRankedSelected
                        ? "bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border-primary-500 shadow-lg shadow-primary-500/20"
                        : "bg-gray-700/30 border-gray-600 hover:border-primary-500/50 hover:bg-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold text-lg flex-1">
                        {option.label}
                      </span>
                      {isRankedSelected && (
                        <span className={`ml-3 px-3 py-1 rounded-full text-sm font-bold flex-shrink-0 ${getRankColor(rankIndex)}`}>
                          {getRankLabel(rankIndex)} choice
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 text-center">
              <span className="text-gray-400 text-sm">
                {rankedValues.length} of {maxRanked} choices selected
              </span>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // Special render for contact section (combined name + email like /quiz)
  const renderContactSection = () => {
    const canProceedContact = answers.name.trim() !== "" && answers.email.trim() !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)

    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="max-w-2xl w-full">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">Step 1 of 12</span>
              <span className="text-sm text-primary-300">8% Complete</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-primary-400 to-secondary-400 h-2 rounded-full transition-all duration-500"
                style={{ width: '8%' }}
              />
            </div>
          </div>

          {/* Quiz Card */}
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl">
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-4">Let's Get Started</h1>
                <p className="text-gray-300 text-lg leading-relaxed">
                  We want to get it right. We only want to get you to where <span className="text-primary-300 font-semibold">YOU</span> want to go.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  What do you want to be called here at Reset Biology?
                </label>
                <input
                  type="text"
                  value={answers.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Your preferred name..."
                  className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  What is the best email address for you to use to log into our site?
                </label>
                <input
                  type="email"
                  value={answers.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && canProceedContact) {
                      // Skip past the email and phone questions to next section
                      setCurrentSection("audit")
                      setCurrentQuestionIndex(0)
                    }
                  }}
                />
              </div>

              <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-4 mt-6">
                <p className="text-gray-300 text-sm leading-relaxed">
                  We are going to go through some questions that will help us get to know you and you to have the opportunity to get to know us. By the end of this short quiz we will help get you to where you want to be.
                </p>
              </div>
            </div>

            {/* Navigation Button */}
            <div className="mt-8">
              <button
                onClick={() => {
                  // Skip past the email and phone questions to next section
                  setCurrentSection("audit")
                  setCurrentQuestionIndex(0)
                }}
                disabled={!canProceedContact}
                className={`w-full py-3 px-6 rounded-lg font-bold transition-all duration-300 ${
                  canProceedContact
                    ? "bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white hover:shadow-lg hover:shadow-primary-400/20"
                    : "opacity-50 cursor-not-allowed bg-gray-700 text-gray-400"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show special contact section
  if (currentSection === "contact") {
    return renderContactSection()
  }

  return (
    <div
      className="min-h-screen px-4 py-8 md:py-12"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
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
            <span className="text-sm text-gray-400">
              Step {currentProgress} of {totalQuestions}
            </span>
            <span className="text-sm text-primary-300">
              {progressPercent}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary-400 to-secondary-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl">
          <div className="space-y-6">
            {/* Section Title */}
            {currentQuestionIndex === 0 && (
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-4">{sectionInfo?.title}</h1>
                {sectionInfo?.subtitle && (
                  <p className="text-gray-300 text-lg">{sectionInfo.subtitle}</p>
                )}
              </div>
            )}

            {/* Question Text */}
            {currentQuestionIndex > 0 && (
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {currentQuestion?.question}
                </h2>
                {currentQuestion?.subtitle && (
                  <p className="text-gray-400 text-lg">{currentQuestion.subtitle}</p>
                )}
              </div>
            )}

            {/* First question in section: show question in context */}
            {currentQuestionIndex === 0 && currentQuestion && (
              <div>
                <p className="text-xl text-gray-200 mb-6">
                  {currentQuestion.question}
                </p>
              </div>
            )}

            {/* Input */}
            {renderQuestionInput()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all duration-300 ${
                canProceed()
                  ? "bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white hover:shadow-lg hover:shadow-primary-400/20"
                  : "opacity-50 cursor-not-allowed bg-gray-700 text-gray-400"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NEPQQuiz
