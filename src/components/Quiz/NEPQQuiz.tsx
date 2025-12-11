"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Check, Sparkles, CheckCircle2, Zap, Target, TrendingUp } from "lucide-react"
import Image from "next/image"
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
  biggest_obstacle_other: string  // Custom frustration text when "other" selected
  // Section 4: Vision (now before Amplification)
  success_vision: string
  success_feeling: string
  // Section 5: Amplification
  why_change: string
  readiness_scale: number
  why_not_lower: string
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
  const [showLanding, setShowLanding] = useState(false)
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
    biggest_obstacle_other: "",
    success_vision: "",
    success_feeling: "",
    why_change: "",
    readiness_scale: 5,
    why_not_lower: "",
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

    // Move to next section (skip energySpin - go directly to close after vision)
    const sections: NEPQSection[] = ["contact", "audit", "journey", "vision", "amplification", "close"]
    const currentSectionIndex = sections.indexOf(currentSection)

    if (currentSectionIndex < sections.length - 1) {
      const nextSection = sections[currentSectionIndex + 1]

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

  // Render Landing Page
  if (showLanding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
           style={{
             backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        <section className="min-h-screen flex items-center justify-center px-4 pt-32 pb-16">
          <div className="max-w-5xl mx-auto w-full space-y-12">

            {/* Hook Section */}
            <div className="text-center space-y-6">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black leading-tight">
                <span className="block bg-gradient-to-r from-gray-100 via-white to-gray-100 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  Feeling frustrated that you're not losing weight
                </span>
                <span className="block mt-3 bg-gradient-to-r from-[#3FBFB5] via-[#5dd9cc] to-[#72C247] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(63,191,181,0.5)]">
                  even though you're doing everything right?
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto font-semibold">
                Answer 15 questions to discover the 3 cellular optimization gaps keeping you stuck—and what to do about them.
              </p>
            </div>

            {/* Logo Showcase */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-secondary-400 blur-3xl opacity-30 animate-pulse"></div>
                <div className="relative bg-white rounded-3xl p-6 shadow-2xl">
                  <Image
                    src="/logo1.png"
                    alt="Reset Biology Logo"
                    width={150}
                    height={150}
                    className="w-32 h-32 md:w-40 md:h-40 object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Value Proposition - 3 Things We Measure */}
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10">
              <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
                Answer these 15 questions so we can measure and optimize:
              </h2>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Item 1 */}
                <div className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 rounded-2xl p-6 border border-primary-500/20">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center mb-4">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    🧬 Your Cellular Fat-Burning Environment
                  </h3>
                  <p className="text-gray-300">
                    Peptide optimization, stem cell health, and metabolic activation protocols
                  </p>
                </div>

                {/* Item 2 */}
                <div className="bg-gradient-to-br from-secondary-500/10 to-secondary-600/5 rounded-2xl p-6 border border-secondary-500/20">
                  <div className="w-14 h-14 bg-gradient-to-br from-secondary-400 to-secondary-600 rounded-xl flex items-center justify-center mb-4">
                    <Target className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    📊 Your Precision Tracking Systems
                  </h3>
                  <p className="text-gray-300">
                    Nutrition, workouts, peptide protocols, and recovery monitoring
                  </p>
                </div>

                {/* Item 3 */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl p-6 border border-blue-500/20">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    🎯 Your Comprehensive Support Stack
                  </h3>
                  <p className="text-gray-300">
                    Breathwork, journaling, accountability systems, and stress management
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-200 text-center text-lg font-semibold">
                  ⚠️ Most people focus on #2 and ignore #1 and #3—which is why they plateau.
                </p>
              </div>
            </div>

            {/* Credibility Section */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-3xl font-bold text-white">
                    RB
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">
                    Track how cellular health, peptides, and recovery impact fat loss
                  </h3>
                  <div className="space-y-2 text-gray-300">
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                      <span>Clinical peptide studies showing 15-25% body fat reduction in 12 weeks</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                      <span>Stem cell mobilization protocols from StemRegen research</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                      <span>Breathwork studies demonstrating 30% improvement in metabolic flexibility</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="text-center space-y-4">
              <button
                onClick={() => setShowLanding(false)}
                className="group relative inline-block"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#3FBFB5] to-[#72C247] rounded-2xl blur-xl group-hover:blur-2xl opacity-50 group-hover:opacity-75 transition-all duration-500"></div>
                <div className="relative bg-gradient-to-r from-[#3FBFB5] to-[#72C247] rounded-2xl px-12 py-6 shadow-2xl group-hover:shadow-[0_0_60px_rgba(63,191,181,0.8)] transition-all duration-500 transform group-hover:scale-105">
                  <span className="text-2xl md:text-3xl font-black text-white">
                    Start Your Free Assessment
                  </span>
                </div>
              </button>

              <div className="flex flex-wrap items-center justify-center gap-6 text-gray-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Only 3 minutes to complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Completely free, no credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Get immediate recommendations</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
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
          setCurrentSection("vision")
          setCurrentQuestionIndex(getSectionQuestions("vision").length - 1)
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
                    // No auto-advance - let user click Next to proceed
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

      case "choiceWithOther":
        const otherFieldId = `${currentQuestion.id}_other` as keyof NEPQAnswers
        const otherValue = answers[otherFieldId] || ""
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option) => {
              const isSelected = value === option.value
              const isOther = option.value === "other"
              return (
                <div key={option.value}>
                  <button
                    onClick={() => {
                      handleInputChange(currentQuestion.id, option.value)
                      // No auto-advance - wait for user to click Next
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
                  {/* Show text input when "other" is selected */}
                  {isOther && isSelected && (
                    <div className="mt-3 ml-10">
                      <textarea
                        value={String(otherValue)}
                        onChange={(e) => handleInputChange(otherFieldId, e.target.value)}
                        placeholder="Tell us what's holding you back..."
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-700/50 border border-primary-500/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        autoFocus
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        Your frustration helps us understand how to help you better
                      </p>
                    </div>
                  )}
                </div>
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
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                        isRankedSelected
                          ? "bg-primary-500 border-primary-500"
                          : "border-gray-500"
                      }`}
                    >
                      {isRankedSelected && (
                        <span className="text-white text-xs font-bold">{rankIndex + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-semibold text-lg block">
                        {option.label}
                      </span>
                      {option.sublabel && (
                        <span className="text-gray-400 text-sm">{option.sublabel}</span>
                      )}
                    </div>
                    {isRankedSelected && (
                      <span className={`px-3 py-1 rounded-full text-sm font-bold flex-shrink-0 ${getRankColor(rankIndex)}`}>
                        {getRankLabel(rankIndex)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
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
              {sectionInfo?.progressLabel}
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
          {/* Section Labels - BELOW the progress bar */}
          <div className="flex justify-between items-start mt-3 overflow-x-auto">
            {allSections.map((section, idx) => {
              const isActive = section.id === currentSection
              const isCompleted = idx < sectionIndex
              return (
                <div
                  key={section.id}
                  className={`flex flex-col items-center min-w-0 flex-1 px-1 ${
                    isActive ? "opacity-100" : isCompleted ? "opacity-70" : "opacity-40"
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full mb-1 ${
                      isActive
                        ? "bg-primary-400 ring-2 ring-primary-400/50"
                        : isCompleted
                        ? "bg-primary-500"
                        : "bg-gray-600"
                    }`}
                  />
                  <span
                    className={`text-xs whitespace-nowrap ${
                      isActive ? "text-primary-300 font-semibold" : "text-gray-400"
                    }`}
                  >
                    {section.progressLabel}
                  </span>
                </div>
              )
            })}
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
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  {currentQuestion?.question}
                </h2>
                {currentQuestion?.subtitle && (
                  currentQuestion.subtitle.includes('(') ? (
                    <div className="text-gray-400 text-lg">
                      <p>{currentQuestion.subtitle.split('(')[0].trim()}</p>
                      <p className="mt-1">({currentQuestion.subtitle.split('(')[1]}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-lg">{currentQuestion.subtitle}</p>
                  )
                )}
              </div>
            )}

            {/* First question in section: show question in context */}
            {currentQuestionIndex === 0 && currentQuestion && (
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  {currentQuestion.question}
                </h2>
                {currentQuestion?.subtitle && (
                  currentQuestion.subtitle.includes('(') ? (
                    <div className="text-gray-400 text-lg">
                      <p>{currentQuestion.subtitle.split('(')[0].trim()}</p>
                      <p className="mt-1">({currentQuestion.subtitle.split('(')[1]}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-lg">{currentQuestion.subtitle}</p>
                  )
                )}
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
