"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  QuizResponses,
  INITIAL_QUIZ_STATE,
  saveQuizToStorage,
  loadQuizFromStorage
} from "@/types/quiz"

export default function QuizPage() {
  const router = useRouter()
  const [quiz, setQuiz] = useState<QuizResponses>(INITIAL_QUIZ_STATE)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load quiz from localStorage on mount
  useEffect(() => {
    const savedQuiz = loadQuizFromStorage()
    if (savedQuiz) {
      setQuiz(savedQuiz)
    }
  }, [])

  // Save to localStorage whenever quiz changes
  useEffect(() => {
    saveQuizToStorage(quiz)
  }, [quiz])

  const updateQuiz = (updates: Partial<QuizResponses>) => {
    setQuiz(prev => ({ ...prev, ...updates }))
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!quiz.preferredName.trim()) {
        newErrors.preferredName = "Please tell us what to call you"
      }
      if (!quiz.email.trim()) {
        newErrors.email = "Please provide an email address"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quiz.email)) {
        newErrors.email = "Please provide a valid email address"
      }
    }

    if (step === 2) {
      if (quiz.holisticApproach === null) {
        newErrors.holisticApproach = "Please select an option"
      }
    }

    if (step === 3) {
      if (quiz.guidanceLevel === null) {
        newErrors.guidanceLevel = "Please select your guidance level"
      }
    }

    if (step === 4) {
      if (quiz.freeToolsBelief === null) {
        newErrors.freeToolsBelief = "Please select an option"
      }
    }

    if (step === 5) {
      if (quiz.assistanceInterest === null) {
        newErrors.assistanceInterest = "Please select your interest level"
      }
    }

    if (step === 6) {
      if (!quiz.successDefinition.trim()) {
        newErrors.successDefinition = "Please share what success looks like for you"
      }
    }

    if (step === 7) {
      if (quiz.importanceLevel === null) {
        newErrors.importanceLevel = "Please select how important this is to you"
      }
      // Only require justification if they've selected an importance level
      if (quiz.importanceLevel !== null && !quiz.successJustification.trim()) {
        newErrors.successJustification = "Please share why this matters to you"
      }
    }

    if (step === 8) {
      if (!quiz.processImportance.trim()) {
        newErrors.processImportance = "Please share what's most important about this process"
      }
      if (!quiz.achievementFeeling.trim()) {
        newErrors.achievementFeeling = "Please share what achieving this would feel like"
      }
    }

    if (step === 9) {
      if (quiz.peptideChoice === null) {
        newErrors.peptideChoice = "Please select an option"
      }
    }

    if (step === 10) {
      if (quiz.partnershipInterest === null) {
        newErrors.partnershipInterest = "Please select your partnership interest level"
      }
    }

    if (step === 11) {
      if (quiz.metabolicControlBelief === null) {
        newErrors.metabolicControlBelief = "Please select your belief level"
      }
    }

    if (step === 12) {
      if (quiz.topPriorities.length === 0) {
        newErrors.topPriorities = "Please select at least one priority"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(quiz.currentStep)) {
      if (quiz.currentStep < quiz.totalSteps) {
        updateQuiz({ currentStep: quiz.currentStep + 1 })
      } else {
        // Quiz complete - save completion and redirect to Auth0 login
        updateQuiz({ completedAt: new Date().toISOString() })
        // After Auth0 login, user will be redirected to results page
        router.push('/auth/login?returnTo=/quiz/results')
      }
    }
  }

  const togglePriority = (priority: string) => {
    const current = quiz.topPriorities
    if (current.includes(priority)) {
      updateQuiz({ topPriorities: current.filter(p => p !== priority) })
    } else {
      updateQuiz({ topPriorities: [...current, priority] })
    }
  }

  const handleBack = () => {
    if (quiz.currentStep > 1) {
      updateQuiz({ currentStep: quiz.currentStep - 1 })
      setErrors({})
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4"
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
            <span className="text-sm text-gray-400">Step {quiz.currentStep} of {quiz.totalSteps}</span>
            <span className="text-sm text-primary-300">{Math.round((quiz.currentStep / quiz.totalSteps) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary-400 to-secondary-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(quiz.currentStep / quiz.totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Quiz Card */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl">

          {/* Question 1: Personal Info */}
          {quiz.currentStep === 1 && (
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
                  value={quiz.preferredName}
                  onChange={(e) => updateQuiz({ preferredName: e.target.value })}
                  placeholder="Your preferred name..."
                  className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                />
                {errors.preferredName && (
                  <p className="text-red-400 text-sm mt-1">{errors.preferredName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  What is the best email address for you to use to log into our site?
                </label>
                <input
                  type="email"
                  value={quiz.email}
                  onChange={(e) => updateQuiz({ email: e.target.value })}
                  placeholder="your.email@example.com"
                  className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                />
                {errors.email && (
                  <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-4 mt-6">
                <p className="text-gray-300 text-sm leading-relaxed">
                  We are going to go through some questions that will help us get to know you and you to have the opportunity to get to know us. By the end of this short quiz we will help get you to where you want to be.
                </p>
              </div>
            </div>
          )}

          {/* Question 2: Holistic Approach */}
          {quiz.currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Your Approach to Weight Loss
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  Do you, <span className="text-primary-300 font-semibold">{quiz.preferredName}</span>, feel like there is more to weight loss than pills and peptides?
                </p>

                <div className="space-y-4">
                  <button
                    onClick={() => updateQuiz({ holisticApproach: 'yes' })}
                    className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-300 ${
                      quiz.holisticApproach === 'yes'
                        ? 'bg-primary-500/20 border-primary-400 shadow-lg shadow-primary-400/20'
                        : 'bg-gray-800/50 border-gray-600/30 hover:border-primary-400/50'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 mt-1 ${
                        quiz.holisticApproach === 'yes'
                          ? 'border-primary-400 bg-primary-400'
                          : 'border-gray-500'
                      }`}>
                        {quiz.holisticApproach === 'yes' && (
                          <div className="w-3 h-3 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg mb-1">Yes, definitely</div>
                        <div className="text-gray-400 text-sm">Mental, emotional, physical, habits, etc.</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => updateQuiz({ holisticApproach: 'no' })}
                    className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-300 ${
                      quiz.holisticApproach === 'no'
                        ? 'bg-primary-500/20 border-primary-400 shadow-lg shadow-primary-400/20'
                        : 'bg-gray-800/50 border-gray-600/30 hover:border-primary-400/50'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 mt-1 ${
                        quiz.holisticApproach === 'no'
                          ? 'border-primary-400 bg-primary-400'
                          : 'border-gray-500'
                      }`}>
                        {quiz.holisticApproach === 'no' && (
                          <div className="w-3 h-3 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg mb-1">No</div>
                        <div className="text-gray-400 text-sm">I just want the best peptide combination to do the work</div>
                      </div>
                    </div>
                  </button>
                </div>

                {errors.holisticApproach && (
                  <p className="text-red-400 text-sm mt-2">{errors.holisticApproach}</p>
                )}
              </div>
            </div>
          )}

          {/* Question 3: Guidance Level */}
          {quiz.currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Level of Guidance
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  It is important for me to have guidance as I take my weight loss journey.
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Full Protocol</span>
                    <span>Just the Peptides</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={quiz.guidanceLevel || 5}
                    onChange={(e) => updateQuiz({ guidanceLevel: parseInt(e.target.value) })}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />

                  <div className="flex justify-between text-xs text-gray-500">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <span key={num} className={quiz.guidanceLevel === num ? 'text-primary-300 font-bold' : ''}>
                        {num}
                      </span>
                    ))}
                  </div>

                  <div className="bg-gray-800/50 border border-primary-400/30 rounded-lg p-4 mt-4">
                    <div className="text-center">
                      <div className="text-primary-300 font-bold text-2xl mb-2">Level {quiz.guidanceLevel || 5}</div>
                      <div className="text-gray-300 text-sm">
                        {quiz.guidanceLevel && quiz.guidanceLevel <= 3 && (
                          "Full IRB research protocol - told what to take and when to take it"
                        )}
                        {quiz.guidanceLevel && quiz.guidanceLevel >= 4 && quiz.guidanceLevel <= 7 && (
                          "Balanced approach - guidance with flexibility"
                        )}
                        {quiz.guidanceLevel && quiz.guidanceLevel >= 8 && (
                          "I'm solid - just give me the peptides"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {errors.guidanceLevel && (
                  <p className="text-red-400 text-sm mt-2">{errors.guidanceLevel}</p>
                )}
              </div>

            </div>
          )}

          {/* Question 4: Free Tools Belief */}
          {quiz.currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Our Commitment to You
                </h2>
              </div>

              <div className="mb-6">
                <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-6 mb-6">
                  <p className="text-gray-200 text-lg leading-relaxed mb-4">
                    We provide <span className="text-primary-300 font-semibold">free access to tools</span> for assistance here at Reset Biology.
                  </p>
                  <p className="text-gray-300 text-base leading-relaxed">
                    From assistance with <strong>Accountability and Mental Strength</strong> to <strong>Nutrition and Workout Tracking</strong>, <strong>Unique Breathwork Exercises</strong> with little known biologic benefits, and opportunity to make <strong>journal notes</strong> across your entire experience.
                  </p>
                  <p className="text-gray-400 text-sm mt-4 italic">
                    But none of this is required.
                  </p>
                </div>

                <p className="text-xl text-gray-200 mb-6 text-center">
                  Is it impossible to believe it was built to actually provide value without asking for anything in return?
                </p>

                <div className="space-y-4">
                  <button
                    onClick={() => updateQuiz({ freeToolsBelief: 'yes' })}
                    className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-300 ${
                      quiz.freeToolsBelief === 'yes'
                        ? 'bg-primary-500/20 border-primary-400 shadow-lg shadow-primary-400/20'
                        : 'bg-gray-800/50 border-gray-600/30 hover:border-primary-400/50'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 mt-1 ${
                        quiz.freeToolsBelief === 'yes'
                          ? 'border-primary-400 bg-primary-400'
                          : 'border-gray-500'
                      }`}>
                        {quiz.freeToolsBelief === 'yes' && (
                          <div className="w-3 h-3 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg">Yes</div>
                        <div className="text-gray-400 text-sm">That sounds too good to be true</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => updateQuiz({ freeToolsBelief: 'no' })}
                    className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-300 ${
                      quiz.freeToolsBelief === 'no'
                        ? 'bg-primary-500/20 border-primary-400 shadow-lg shadow-primary-400/20'
                        : 'bg-gray-800/50 border-gray-600/30 hover:border-primary-400/50'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 mt-1 ${
                        quiz.freeToolsBelief === 'no'
                          ? 'border-primary-400 bg-primary-400'
                          : 'border-gray-500'
                      }`}>
                        {quiz.freeToolsBelief === 'no' && (
                          <div className="w-3 h-3 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg">No</div>
                        <div className="text-gray-400 text-sm">I believe genuine value can be offered freely</div>
                      </div>
                    </div>
                  </button>
                </div>

                {errors.freeToolsBelief && (
                  <p className="text-red-400 text-sm mt-2">{errors.freeToolsBelief}</p>
                )}
              </div>

            </div>
          )}

          {/* Question 5: Assistance Interest */}
          {quiz.currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Assistance in Your Journey
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  Could you use some assistance in these areas of your journey to health?
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Yes, definitely!</span>
                    <span>Just the peptides</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={quiz.assistanceInterest || 5}
                    onChange={(e) => updateQuiz({ assistanceInterest: parseInt(e.target.value) })}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />

                  <div className="flex justify-between text-xs text-gray-500">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <span key={num} className={quiz.assistanceInterest === num ? 'text-primary-300 font-bold' : ''}>
                        {num}
                      </span>
                    ))}
                  </div>

                  <div className="bg-gray-800/50 border border-primary-400/30 rounded-lg p-4 mt-4">
                    <div className="text-center">
                      <div className="text-primary-300 font-bold text-2xl mb-2">Level {quiz.assistanceInterest || 5}</div>
                      <div className="text-gray-300 text-sm">
                        {quiz.assistanceInterest && quiz.assistanceInterest <= 3 && (
                          "Yes definitely! - I want comprehensive support"
                        )}
                        {quiz.assistanceInterest && quiz.assistanceInterest >= 4 && quiz.assistanceInterest <= 7 && (
                          "I could be interested - selective assistance"
                        )}
                        {quiz.assistanceInterest && quiz.assistanceInterest >= 8 && (
                          "No thanks - I just want the peptides"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {errors.assistanceInterest && (
                  <p className="text-red-400 text-sm mt-2">{errors.assistanceInterest}</p>
                )}
              </div>

            </div>
          )}

          {/* Question 6: Success Definition */}
          {quiz.currentStep === 6 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Your Vision of Success
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  What would a successful journey to feeling better be for you?
                </p>

                <textarea
                  value={quiz.successDefinition}
                  onChange={(e) => updateQuiz({ successDefinition: e.target.value })}
                  placeholder="Describe what success looks like for you... (e.g., having energy to play with my kids, feeling confident in my body, reducing chronic pain, etc.)"
                  rows={6}
                  className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 resize-none"
                />

                {errors.successDefinition && (
                  <p className="text-red-400 text-sm mt-2">{errors.successDefinition}</p>
                )}

                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4 mt-4">
                  <p className="text-blue-200 text-sm">
                    <strong>💡 Note:</strong> Your answer will be used to create personalized goals and affirmations throughout your journey.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Question 7: Importance Level + Follow-up */}
          {quiz.currentStep === 7 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Your Commitment Level
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  How important is it for you to achieve this?
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Not important</span>
                    <span>Extremely important</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={quiz.importanceLevel || 5}
                    onChange={(e) => updateQuiz({ importanceLevel: parseInt(e.target.value) })}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />

                  <div className="flex justify-between text-xs text-gray-500">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <span key={num} className={quiz.importanceLevel === num ? 'text-primary-300 font-bold' : ''}>
                        {num}
                      </span>
                    ))}
                  </div>

                  <div className="bg-gray-800/50 border border-primary-400/30 rounded-lg p-4 mt-4">
                    <div className="text-center">
                      <div className="text-primary-300 font-bold text-2xl mb-2">
                        Importance: {quiz.importanceLevel || 5}/10
                      </div>
                    </div>
                  </div>
                </div>

                {errors.importanceLevel && (
                  <p className="text-red-400 text-sm mt-2">{errors.importanceLevel}</p>
                )}
              </div>

              {/* Follow-up question appears after they select importance */}
              {quiz.importanceLevel !== null && (
                <div className="mb-6 animate-fade-in">
                  <p className="text-xl text-gray-200 mb-6">
                    Why isn't that answer less?
                  </p>

                  <textarea
                    value={quiz.successJustification}
                    onChange={(e) => updateQuiz({ successJustification: e.target.value })}
                    placeholder="What drives you to make this change? Why does this matter to you?"
                    rows={5}
                    className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 resize-none"
                  />

                  {errors.successJustification && (
                    <p className="text-red-400 text-sm mt-2">{errors.successJustification}</p>
                  )}

                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-4 mt-4">
                    <p className="text-amber-200 text-sm">
                      <strong>💪 Keep this in mind:</strong> Your "why" will be your anchor when things get challenging. We'll remind you of this throughout your journey.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question 8: Process Importance & Achievement Feeling */}
          {quiz.currentStep === 8 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Your Process & Vision
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  What is most important to you about this process?
                </p>

                <textarea
                  value={quiz.processImportance}
                  onChange={(e) => updateQuiz({ processImportance: e.target.value })}
                  placeholder="What matters most to you? (e.g., feeling in control, building sustainable habits, understanding what works for my body...)"
                  rows={5}
                  className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 resize-none"
                />

                {errors.processImportance && (
                  <p className="text-red-400 text-sm mt-2">{errors.processImportance}</p>
                )}

                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4 mt-4">
                  <p className="text-blue-200 text-sm">
                    <strong>💡 Note:</strong> This will be used to personalize your goals and affirmations.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  What would it feel like to achieve this?
                </p>

                <textarea
                  value={quiz.achievementFeeling}
                  onChange={(e) => updateQuiz({ achievementFeeling: e.target.value })}
                  placeholder="Imagine you've achieved your goals. How does it feel? (e.g., energized, confident, proud, peaceful...)"
                  rows={4}
                  className="w-full bg-gray-800/50 border border-primary-400/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 resize-none"
                />

                {errors.achievementFeeling && (
                  <p className="text-red-400 text-sm mt-2">{errors.achievementFeeling}</p>
                )}

              </div>

              <div className="bg-secondary-500/10 border border-secondary-400/30 rounded-lg p-6 mt-6">
                <p className="text-gray-200 font-semibold mb-3">Ready for a mental exercise?</p>
                <p className="text-gray-300 text-sm mb-4">
                  Experience one of our unique breathwork and mental strength exercises designed to support your journey.
                </p>
                <a
                  href="/breathwork"
                  className="inline-block bg-gradient-to-r from-secondary-500 to-primary-500 hover:from-secondary-400 hover:to-primary-400 text-white font-medium py-2 px-5 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-secondary-400/20"
                >
                  Try one of our mini mind exercises →
                </a>
              </div>
            </div>
          )}

          {/* Question 9: Superior Peptide Choice */}
          {quiz.currentStep === 9 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Understanding Your Options
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  Have you considered that you might naturally choose the superior peptide once you understand the difference?
                </p>

                <div className="space-y-4">
                  <button
                    onClick={() => updateQuiz({ peptideChoice: 'yes' })}
                    className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-300 ${
                      quiz.peptideChoice === 'yes'
                        ? 'bg-primary-500/20 border-primary-400 shadow-lg shadow-primary-400/20'
                        : 'bg-gray-800/50 border-gray-600/30 hover:border-primary-400/50'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 mt-1 ${
                        quiz.peptideChoice === 'yes'
                          ? 'border-primary-400 bg-primary-400'
                          : 'border-gray-500'
                      }`}>
                        {quiz.peptideChoice === 'yes' && (
                          <div className="w-3 h-3 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg">Yes</div>
                        <div className="text-gray-400 text-sm">I'd like to understand the difference</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => updateQuiz({ peptideChoice: 'no' })}
                    className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-300 ${
                      quiz.peptideChoice === 'no'
                        ? 'bg-primary-500/20 border-primary-400 shadow-lg shadow-primary-400/20'
                        : 'bg-gray-800/50 border-gray-600/30 hover:border-primary-400/50'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 mt-1 ${
                        quiz.peptideChoice === 'no'
                          ? 'border-primary-400 bg-primary-400'
                          : 'border-gray-500'
                      }`}>
                        {quiz.peptideChoice === 'no' && (
                          <div className="w-3 h-3 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg">No</div>
                        <div className="text-gray-400 text-sm">I'm already familiar with my options</div>
                      </div>
                    </div>
                  </button>
                </div>

                {errors.peptideChoice && (
                  <p className="text-red-400 text-sm mt-2">{errors.peptideChoice}</p>
                )}
              </div>

              {/* Video Link - appears after selection */}
              {quiz.peptideChoice !== null && (
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-primary-400/40 rounded-lg p-6 animate-fade-in">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg mb-2">Learn About Retatrutide</h3>
                      <p className="text-gray-300 text-sm mb-4">
                        Discover why Retatrutide represents the next evolution in GLP-1 peptides and how it compares to other options.
                      </p>
                      <button
                        onClick={() => {
                          updateQuiz({ watchedPeptideVideo: true })
                          // TODO: Open video modal/popup here
                          alert('Video popup will be implemented - showing Retatrutide comparison')
                        }}
                        className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-primary-400/20"
                      >
                        {quiz.watchedPeptideVideo ? '✓ Watched Video' : 'Watch Video'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question 10: Partnership Interest */}
          {quiz.currentStep === 10 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Your Journey with Reset Biology
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  Would it feel better to partner with Reset Biology as you achieve{' '}
                  <span className="text-primary-300 italic">"{quiz.achievementFeeling || 'your goals'}"</span>?
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Yes, absolutely!</span>
                    <span>No, I prefer to go it alone</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={quiz.partnershipInterest || 5}
                    onChange={(e) => updateQuiz({ partnershipInterest: parseInt(e.target.value) })}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />

                  <div className="flex justify-between text-xs text-gray-500">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <span key={num} className={quiz.partnershipInterest === num ? 'text-primary-300 font-bold' : ''}>
                        {num}
                      </span>
                    ))}
                  </div>

                  <div className="bg-gray-800/50 border border-primary-400/30 rounded-lg p-4 mt-4">
                    <div className="text-center">
                      <div className="text-primary-300 font-bold text-2xl mb-2">
                        Partnership Level: {quiz.partnershipInterest || 5}/10
                      </div>
                      <div className="text-gray-300 text-sm">
                        {quiz.partnershipInterest && quiz.partnershipInterest <= 3 && (
                          "Yes absolutely! - Ready to partner for success"
                        )}
                        {quiz.partnershipInterest && quiz.partnershipInterest >= 4 && quiz.partnershipInterest <= 7 && (
                          "Open to partnership with the right support"
                        )}
                        {quiz.partnershipInterest && quiz.partnershipInterest >= 8 && (
                          "I prefer to go it alone"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {errors.partnershipInterest && (
                  <p className="text-red-400 text-sm mt-2">{errors.partnershipInterest}</p>
                )}
              </div>
            </div>
          )}

          {/* Question 11: Metabolic Control Belief */}
          {quiz.currentStep === 11 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Taking Control of Your Future
                </h2>
              </div>

              <div className="mb-6">
                <p className="text-xl text-gray-200 mb-6">
                  Do you think it is impossible to take control of your metabolic future today and experience{' '}
                  <span className="text-primary-300 italic">"{quiz.successDefinition || 'your ideal outcome'}"</span>?
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Yes, seems outside my control</span>
                    <span>No, not impossible</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={quiz.metabolicControlBelief || 5}
                    onChange={(e) => updateQuiz({ metabolicControlBelief: parseInt(e.target.value) })}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />

                  <div className="flex justify-between text-xs text-gray-500">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <span key={num} className={quiz.metabolicControlBelief === num ? 'text-primary-300 font-bold' : ''}>
                        {num}
                      </span>
                    ))}
                  </div>

                  <div className="bg-gray-800/50 border border-primary-400/30 rounded-lg p-4 mt-4">
                    <div className="text-center">
                      <div className="text-primary-300 font-bold text-2xl mb-2">
                        Belief Level: {quiz.metabolicControlBelief || 5}/10
                      </div>
                      <div className="text-gray-300 text-sm">
                        {quiz.metabolicControlBelief && quiz.metabolicControlBelief >= 8 && (
                          "I believe I can take control - it's possible!"
                        )}
                        {quiz.metabolicControlBelief && quiz.metabolicControlBelief >= 4 && quiz.metabolicControlBelief <= 7 && (
                          "Uncertain - could go either way"
                        )}
                        {quiz.metabolicControlBelief && quiz.metabolicControlBelief <= 3 && (
                          "Feels outside my control - seems impossible"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {errors.metabolicControlBelief && (
                  <p className="text-red-400 text-sm mt-2">{errors.metabolicControlBelief}</p>
                )}
              </div>

              {/* Encouragement based on answer */}
              {quiz.metabolicControlBelief !== null && quiz.metabolicControlBelief <= 5 && (
                <div className="bg-secondary-500/10 border border-secondary-400/30 rounded-lg p-6 animate-fade-in">
                  <p className="text-secondary-200 font-semibold mb-2">💚 You're Not Alone</p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Many people feel this way at the start. That's exactly why we created Reset Biology - to make what seems impossible, possible. We'll guide you every step of the way.
                  </p>
                </div>
              )}

              {quiz.metabolicControlBelief !== null && quiz.metabolicControlBelief >= 6 && (
                <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-6 animate-fade-in">
                  <p className="text-primary-200 font-semibold mb-2">🎯 That's the Spirit!</p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Your belief in what's possible is the first step toward making it real. Let's turn that belief into results together.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* Question 12: Top Priorities */}
          {quiz.currentStep === 12 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Your Top Priorities
                </h2>
                <p className="text-gray-300">
                  Which of these is most important to you? (Select all that apply)
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'weight-loss', label: 'Getting the weight off' },
                  { id: 'muscle-mass', label: 'Keeping my muscle mass as I lose weight' },
                  { id: 'health-control', label: 'Feeling in control of my health' },
                  { id: 'feel-better', label: 'Feeling better in general' },
                  { id: 'tools-assistance', label: 'Having tools and assistance as I make this journey' }
                ].map((priority) => (
                  <button
                    key={priority.id}
                    onClick={() => togglePriority(priority.id)}
                    className={`w-full text-left p-5 rounded-lg border-2 transition-all duration-300 ${
                      quiz.topPriorities.includes(priority.id)
                        ? 'bg-primary-500/20 border-primary-400 shadow-lg shadow-primary-400/20'
                        : 'bg-gray-800/50 border-gray-600/30 hover:border-primary-400/50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-4 ${
                        quiz.topPriorities.includes(priority.id)
                          ? 'border-primary-400 bg-primary-400'
                          : 'border-gray-500'
                      }`}>
                        {quiz.topPriorities.includes(priority.id) && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-white font-medium text-lg">{priority.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {errors.topPriorities && (
                <p className="text-red-400 text-sm mt-2">{errors.topPriorities}</p>
              )}

              <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-4 mt-6">
                <p className="text-gray-300 text-sm leading-relaxed text-center">
                  Ready to see your personalized results? Click below to create your account and get started.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {quiz.currentStep > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-primary-400/20"
            >
              {quiz.currentStep === quiz.totalSteps ? 'See Your Personalized Results →' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom slider styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3FBFB5, #72C247);
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 0 10px rgba(63, 191, 181, 0.5);
        }

        .slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3FBFB5, #72C247);
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 0 10px rgba(63, 191, 181, 0.5);
        }
      `}</style>
    </div>
  )
}
