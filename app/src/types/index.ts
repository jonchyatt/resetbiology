// Reset Biology Type Definitions

export interface User {
  id: string
  googleId: string
  email: string
  name?: string
  image?: string
  drivePermissions?: Record<string, unknown>
  driveFolder?: string
  profileData?: Record<string, unknown>
  irbApprovalStatus?: string
  irbSubmissionDate?: Date
}

export interface AssessmentResponse {
  questionId: string
  question: string
  answer: string | number | boolean
  weight?: number
}

export interface AssessmentResult {
  score: number
  recommendations: string[]
  peptideRecommendation: string
  urgencyLevel: 'low' | 'medium' | 'high'
  irbEligible: boolean
}

export interface MentalMasteryModule {
  id: string
  title: string
  description: string
  audioUrl: string
  duration: number
  category: string
  requiredForDeposit: boolean
  order: number
}

export interface GamificationPoint {
  id: string
  pointType: 'daily_checkin' | 'module_completion' | 'streak_bonus' | 'breath_session' | 'variable_reward'
  amount: number
  activitySource?: string
  earnedAt: Date
}

export interface SuccessDeposit {
  id: string
  amount: number
  status: 'active' | 'earning' | 'completed' | 'refunded'
  payoutConditions: {
    modulesRequired: number
    checkinsRequired: number
    timeframe: number
  }
  partnerShare?: number
  progress: {
    modulesCompleted: number
    checkinStreak: number
    daysRemaining: number
  }
}

export interface BreathSession {
  id: string
  sessionType: 'guided' | 'freeform' | 'challenge'
  duration: number
  cycles?: number
  progressScore?: number
  improvements?: {
    heartRateVariability?: number
    relaxationScore?: number
  }
}

export interface VariableReward {
  id: string
  rewardType: 'daily_spinner' | 'streak_bonus' | 'jackpot' | 'surprise'
  amount: number
  probability?: number
  description: string
}

export interface AffiliateStats {
  referralCode: string
  clicks: number
  conversions: number
  commissions: number
  conversionRate: number
}