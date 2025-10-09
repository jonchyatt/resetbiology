export interface QuizResponses {
  // Question 1: Personal info
  preferredName: string
  email: string

  // Question 2: Holistic approach
  holisticApproach: 'yes' | 'no' | null

  // Question 3: Guidance level (1-10)
  guidanceLevel: number | null

  // Question 4: Free tools belief
  freeToolsBelief: 'yes' | 'no' | null

  // Question 5: Interest in additional assistance (1-10)
  assistanceInterest: number | null

  // Question 6: Success definition (open text for goals/affirmations)
  successDefinition: string

  // Question 7: Importance level (1-10)
  importanceLevel: number | null

  // Question 7 Follow-up: Justification for desire to succeed
  successJustification: string

  // Question 8: Process importance (for goals/affirmations)
  processImportance: string

  // Question 8: Achievement feeling (short-term "Echo" storage)
  achievementFeeling: string

  // Question 9: Superior peptide choice
  peptideChoice: 'yes' | 'no' | null
  watchedPeptideVideo: boolean

  // Question 10: Partnership with Reset Biology (1-10)
  partnershipInterest: number | null

  // Question 11: Metabolic control belief (1-10)
  metabolicControlBelief: number | null

  // Question 12: Top priorities (multi-select)
  topPriorities: string[]

  // Metadata
  startedAt: string
  completedAt?: string
  currentStep: number
  totalSteps: number
}

// Quiz outcome categories
export type QuizOutcome =
  | 'peptides-only'           // Just purchase peptides (majority, high-margin)
  | 'irb-partnership'         // IRB backing with Cellular Peptide
  | 'reset-biology-partner'   // Grey market with Reset Biology tools
  | 'free-tools-only'         // Outlier: Just wants free tools

export const INITIAL_QUIZ_STATE: QuizResponses = {
  preferredName: '',
  email: '',
  holisticApproach: null,
  guidanceLevel: null,
  freeToolsBelief: null,
  assistanceInterest: null,
  successDefinition: '',
  importanceLevel: null,
  successJustification: '',
  processImportance: '',
  achievementFeeling: '',
  peptideChoice: null,
  watchedPeptideVideo: false,
  partnershipInterest: null,
  metabolicControlBelief: null,
  topPriorities: [],
  startedAt: new Date().toISOString(),
  currentStep: 1,
  totalSteps: 12
}

// Determine quiz outcome based on responses
export const determineQuizOutcome = (quiz: QuizResponses): QuizOutcome => {
  // NOTE: Sliders are standardized: 10 = "Just want peptides/no assistance"
  // Q10 and Q11 need to be flipped in UI to match this

  // Check for free tools only outlier first
  // High interest in tools/assistance but explicitly doesn't want peptides
  const wantsTools = quiz.topPriorities.includes('tools-assistance')
  const noWeightLoss = !quiz.topPriorities.includes('weight-loss')
  const highAssistance = quiz.assistanceInterest && quiz.assistanceInterest <= 3

  if (wantsTools && noWeightLoss && highAssistance && quiz.peptideChoice === 'no') {
    return 'free-tools-only'
  }

  // Peptides Only - Majority of customers, high margin, no support needed
  // They score high (8-10) on "just want peptides" questions
  const justPeptides = quiz.guidanceLevel && quiz.guidanceLevel >= 8
  const lowPartnership = quiz.partnershipInterest && quiz.partnershipInterest >= 8  // Will flip UI
  const lowAssistance = quiz.assistanceInterest && quiz.assistanceInterest >= 8

  if (justPeptides || (lowPartnership && lowAssistance)) {
    return 'peptides-only'  // Your best customers - high margin, no support
  }

  // IRB Partnership - Rule followers wanting legitimate medical backing
  const wantsFullProtocol = quiz.guidanceLevel && quiz.guidanceLevel <= 3
  const highPartnership = quiz.partnershipInterest && quiz.partnershipInterest <= 3  // Will flip UI
  const wantsAssistance = quiz.assistanceInterest && quiz.assistanceInterest <= 4
  const wantsHolistic = quiz.holisticApproach === 'yes'

  if (wantsFullProtocol && wantsHolistic && (highPartnership || wantsAssistance)) {
    return 'irb-partnership'
  }

  // Default: Reset Biology Grey Market + Tools - Middle ground
  // They want some support and tools but also want cheaper peptides
  return 'reset-biology-partner'
}

export const QUIZ_STORAGE_KEY = 'resetbiology_quiz_responses'

// Helper functions for localStorage
export const saveQuizToStorage = (quiz: QuizResponses) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quiz))
  }
}

export const loadQuizFromStorage = (): QuizResponses | null => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(QUIZ_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  }
  return null
}

export const clearQuizFromStorage = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(QUIZ_STORAGE_KEY)
  }
}
