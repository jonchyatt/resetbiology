/**
 * NEPQ Quiz Configuration
 *
 * Based on Neuro-Emotional Persuasion Questioning (NEPQ) framework
 * with Chris Voss "No-oriented" closing techniques and Motivational Interviewing
 *
 * 7 Sections:
 * 1. Contact Intake
 * 2. Authority/Best Practices Audit (scored, multi-select)
 * 3. Journey/Qualifying Questions (situation awareness)
 * 4. Black Swan - Success Definition (open-ended)
 * 5. Desire Amplification (MI technique)
 * 6. Energy Spin Up (placeholder for Phase 2 audio)
 * 7. Commitment/Close (No-oriented questions)
 */

export type NEPQSection =
  | 'contact'
  | 'audit'
  | 'journey'
  | 'challenges'
  | 'vision'
  | 'amplification'
  | 'energySpin'
  | 'mentalMastery'
  | 'close'

export type NEPQQuestionType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'choice'
  | 'choiceWithOther'
  | 'scale'
  | 'multiSelect'
  | 'rankedSelect'

export type NEPQOption = {
  value: string
  label: string
  score?: number
  sublabel?: string
  // Category scoring for personalized recommendations
  categoryScores?: {
    mentalMastery?: number
    breathwork?: number
    tracking?: number
    workout?: number
    accountability?: number
    peptides?: number
  }
}

// Recommendation categories
export type RecommendationCategory =
  | 'mentalMastery'
  | 'breathwork'
  | 'tracking'
  | 'workout'
  | 'accountability'
  | 'peptides'

export type CategoryScores = Record<RecommendationCategory, number>

export type NEPQQuestion = {
  id: string
  section: NEPQSection
  question: string
  subtitle?: string
  type: NEPQQuestionType
  placeholder?: string
  required?: boolean
  options?: NEPQOption[]
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
  maxRankedSelect?: number // For rankedSelect type
}

export type NEPQOffer = {
  id: string
  tier: 'diy' | 'guided' | 'doneWithYou' | 'concierge' | 'other'
  title: string
  subtitle: string
  trialPrice: string
  monthlyPrice: string
  features: string[]
  badge?: string
  accentColor: 'teal' | 'blue' | 'purple' | 'gold' | 'gray'
  stripeLink?: string
  highlighted?: boolean
}

export type NEPQConfig = {
  sections: {
    id: NEPQSection
    title: string
    subtitle?: string
    progressLabel: string
  }[]
  questions: NEPQQuestion[]
  offers: NEPQOffer[]
  closeQuestion: {
    question: string
    yesText: string
    noText: string
  }
}

// Best Practices Audit scoring weights
export const AUDIT_CATEGORIES = {
  proteinTracking: { weight: 1, maxScore: 10 },
  stemCell: { weight: 1.2, maxScore: 10 },
  digitalTracking: { weight: 1, maxScore: 10 },
  breathwork: { weight: 1.1, maxScore: 10 },
  sleepOptimization: { weight: 1.2, maxScore: 10 },
  journaling: { weight: 0.8, maxScore: 10 },
  workoutProgram: { weight: 1, maxScore: 10 },
  accountability: { weight: 1.1, maxScore: 10 },
  peptideKnowledge: { weight: 0.9, maxScore: 10 },
} as const

export const nepqConfig: NEPQConfig = {
  sections: [
    {
      id: 'contact',
      title: 'Welcome to Reset Biology',
      subtitle: 'Let\'s start with the basics so we can personalize your experience',
      progressLabel: 'Getting Started',
    },
    {
      id: 'audit',
      title: 'Current Practices Audit',
      subtitle: 'Select all that apply to your current health routine',
      progressLabel: 'Your Foundation',
    },
    {
      id: 'journey',
      title: 'Your Journey So Far',
      subtitle: 'Help us understand where you are right now',
      progressLabel: 'Your Journey',
    },
    {
      id: 'challenges',
      title: 'Your Challenges',
      subtitle: 'Help us understand what you\'re working against',
      progressLabel: 'Your Challenges',
    },
    {
      id: 'vision',
      title: 'Defining Success',
      subtitle: 'Paint a picture of what success looks like for you',
      progressLabel: 'Your Vision',
    },
    {
      id: 'amplification',
      title: 'Why This Matters',
      subtitle: 'Let\'s explore what\'s driving you to make a change',
      progressLabel: 'Your Why',
    },
    {
      id: 'energySpin',
      title: 'Energy Activation',
      subtitle: 'A brief guided experience to connect with your goals',
      progressLabel: 'Activation',
    },
    {
      id: 'mentalMastery',
      title: 'Mental Mastery Preview',
      subtitle: 'Experience a sample of our guided visualization',
      progressLabel: 'Preview',
    },
    {
      id: 'close',
      title: 'Your Personalized Results',
      subtitle: 'Based on your answers, here\'s what we recommend',
      progressLabel: 'Your Results',
    },
  ],

  questions: [
    // Section 1: Contact Intake
    {
      id: 'name',
      section: 'contact',
      question: 'What would you like to be called at Reset Biology?',
      type: 'text',
      placeholder: 'Your preferred name',
      required: true,
    },
    {
      id: 'email',
      section: 'contact',
      question: 'What\'s your email address?',
      subtitle: 'We\'ll use this to save your progress and send your personalized results',
      type: 'email',
      placeholder: 'you@example.com',
      required: true,
    },
    {
      id: 'phone',
      section: 'contact',
      question: 'Phone number (optional)',
      subtitle: 'For priority support and faster responses',
      type: 'tel',
      placeholder: '(555) 123-4567',
      required: false,
    },

    // Section 2: Authority/Best Practices Audit (Multi-select, Scored)
    {
      id: 'audit_practices',
      section: 'audit',
      question: 'Which of these are you currently doing?',
      subtitle: 'Select all that apply - be honest, this helps us identify gaps',
      type: 'multiSelect',
      options: [
        {
          value: 'stem_cell_protocols',
          label: 'Peptide Research Protocol',
          sublabel: 'Using regenerative medicine approaches',
          score: 10,
        },
        {
          value: 'digital_tracking',
          label: 'Nutrition tracking',
          sublabel: 'Tracking meals, calories, and macros',
          score: 10,
        },
        {
          value: 'breathwork_meditation',
          label: 'Daily breathwork or meditation',
          sublabel: '10+ minutes of intentional practice',
          score: 10,
        },
        {
          value: 'journaling',
          label: 'Journaling for emotional patterns',
          sublabel: 'Tracking stress, mood, and their health impact',
          score: 10,
        },
        {
          value: 'structured_workout',
          label: 'Structured workout program',
          sublabel: 'Progressive training designed for your goals',
          score: 10,
        },
        {
          value: 'accountability_systems',
          label: 'Accountability systems',
          sublabel: 'Daily check-ins, reminders, or coaching',
          score: 10,
        },
      ],
    },

    // Section 3: Journey/Qualifying Questions
    {
      id: 'journey_stage',
      section: 'journey',
      question: 'Where are you in your health optimization journey?',
      type: 'choice',
      required: true,
      options: [
        {
          value: 'starting',
          label: 'Just getting started',
          sublabel: 'Ready to build the right foundation from day one',
        },
        {
          value: 'stuck_6_12mo',
          label: 'Been at it 6-12 months',
          sublabel: 'Made some progress but hit a plateau',
        },
        {
          value: 'plateaus_1_3yr',
          label: 'Trying for 1-3 years',
          sublabel: 'Multiple plateaus, looking for what actually works',
        },
        {
          value: 'frustrated_3yr_plus',
          label: 'Over 3 years, tried everything',
          sublabel: 'Ready for a completely different approach',
        },
      ],
    },
    {
      id: 'desired_outcome',
      section: 'journey',
      question: 'Which of these is most important to you in the next 90 days?',
      subtitle: 'Select up to 3 in order of importance (click again to remove)',
      type: 'rankedSelect',
      maxRankedSelect: 3,
      required: true,
      options: [
        {
          value: 'lose_fat',
          label: 'Lose stubborn body fat',
          sublabel: 'Finally break through and see real changes',
        },
        {
          value: 'energy_vitality',
          label: 'Increase energy and vitality',
          sublabel: 'Feel alive, focused, and motivated again',
        },
        {
          value: 'break_plateau',
          label: 'Break through my plateau',
          sublabel: 'Get unstuck and start progressing again',
        },
        {
          value: 'sustainable_system',
          label: 'Build a sustainable system',
          sublabel: 'Something that actually works long-term',
        },
      ],
    },
    {
      id: 'biggest_obstacle',
      section: 'journey',
      question: 'Which of these frustrations do you have? What is holding you back the most?',
      type: 'choiceWithOther',
      required: true,
      options: [
        {
          value: 'knowledge_gap',
          label: 'I don\'t know what I\'m missing',
          sublabel: 'Feel like there\'s something I haven\'t figured out',
        },
        {
          value: 'consistency',
          label: 'I can\'t stay consistent',
          sublabel: 'Start strong but fade over time',
        },
        {
          value: 'broken_metabolism',
          label: 'My body doesn\'t respond anymore',
          sublabel: 'What used to work doesn\'t work now',
        },
        {
          value: 'overwhelm',
          label: 'Too many conflicting approaches',
          sublabel: 'Information overload, don\'t know what to follow',
        },
        {
          value: 'other',
          label: 'Other',
          sublabel: 'Tell us what\'s really holding you back',
        },
      ],
    },

    // Section 4: Challenges Assessment (Category Scoring)
    {
      id: 'eating_patterns',
      section: 'challenges',
      question: 'Which of these feel familiar to you?',
      subtitle: 'Select all that apply - this helps us personalize your recommendations',
      type: 'multiSelect',
      required: true,
      options: [
        {
          value: 'stress_eating',
          label: 'I eat when stressed, anxious, or upset',
          sublabel: 'Food helps me cope with emotions',
          categoryScores: { mentalMastery: 2, breathwork: 1 },
        },
        {
          value: 'cant_stop',
          label: 'I have trouble stopping once I start eating',
          sublabel: 'Hard to feel satisfied or know when to stop',
          categoryScores: { mentalMastery: 2, peptides: 1 },
        },
        {
          value: 'large_portions',
          label: 'I eat larger portions than I intend to',
          sublabel: 'Portion control is a struggle',
          categoryScores: { mentalMastery: 1, tracking: 1 },
        },
        {
          value: 'social_eating',
          label: 'I eat differently around others vs alone',
          sublabel: 'Social situations affect my eating',
          categoryScores: { mentalMastery: 2, accountability: 1 },
        },
        {
          value: 'distracted_eating',
          label: 'I snack while watching TV or on my phone',
          sublabel: 'Often eat without paying attention',
          categoryScores: { tracking: 2, mentalMastery: 1 },
        },
        {
          value: 'skip_then_overeat',
          label: 'I skip meals then overeat later',
          sublabel: 'Irregular eating patterns',
          categoryScores: { tracking: 2, mentalMastery: 1 },
        },
        {
          value: 'reward_food',
          label: 'I reward myself with food',
          sublabel: 'Food is tied to accomplishment or comfort',
          categoryScores: { mentalMastery: 2 },
        },
        {
          value: 'eat_fast',
          label: 'I eat fast and often feel too full after',
          sublabel: 'Don\'t take time to enjoy meals',
          categoryScores: { mentalMastery: 1, breathwork: 1 },
        },
      ],
    },
    {
      id: 'obstacles',
      section: 'challenges',
      question: 'What gets in your way?',
      subtitle: 'Select all that apply',
      type: 'multiSelect',
      required: true,
      options: [
        {
          value: 'high_stress',
          label: 'High stress or poor sleep',
          sublabel: 'Life feels overwhelming',
          categoryScores: { breathwork: 2, peptides: 1 },
        },
        {
          value: 'no_meal_planning',
          label: 'Lack of meal planning or prep time',
          sublabel: 'Don\'t know what to eat or when',
          categoryScores: { tracking: 2 },
        },
        {
          value: 'constant_hunger',
          label: 'Constant hunger or cravings',
          sublabel: 'Always thinking about food',
          categoryScores: { peptides: 2, mentalMastery: 1 },
        },
        {
          value: 'no_workout',
          label: 'No structured workout routine',
          sublabel: 'Exercise is inconsistent or non-existent',
          categoryScores: { workout: 2 },
        },
        {
          value: 'motivation',
          label: 'Trouble staying motivated or consistent',
          sublabel: 'Start strong but fade over time',
          categoryScores: { accountability: 2, mentalMastery: 1 },
        },
        {
          value: 'dont_know_what',
          label: 'Don\'t know what to eat',
          sublabel: 'Confused about nutrition',
          categoryScores: { tracking: 2 },
        },
        {
          value: 'low_energy',
          label: 'Low energy or fatigue',
          sublabel: 'Feel tired most of the time',
          categoryScores: { peptides: 2, workout: 1 },
        },
        {
          value: 'no_accountability',
          label: 'No one holding me accountable',
          sublabel: 'Doing this alone',
          categoryScores: { accountability: 2 },
        },
      ],
    },

    // Section 5: Your Vision - Success Definition
    {
      id: 'why_change',
      section: 'amplification',
      question: 'Really, only you know why you are here. What is it you are wanting?',
      subtitle: 'Why are you even thinking about making a change right now?',
      type: 'textarea',
      placeholder: 'I\'m here because...',
      required: true,
    },
    {
      id: 'readiness_scale',
      section: 'amplification',
      question: 'On a scale of 1-10, how ready are you to commit to a real change?',
      subtitle: '1 = Not ready at all, 10 = Completely ready to start today',
      type: 'scale',
      min: 1,
      max: 10,
      minLabel: 'Not ready',
      maxLabel: 'All in',
      required: true,
    },
    {
      id: 'why_not_lower',
      section: 'amplification',
      question: 'Interesting. Why didn\'t you pick a lower number?',
      subtitle: 'What\'s making you more ready than not?',
      type: 'textarea',
      placeholder: 'I didn\'t pick a lower number because...',
      required: true,
    },

    // Section 5: Your Vision - Success Definition
    {
      id: 'success_vision',
      section: 'vision',
      question: 'Imagine it\'s 90 days from now and you\'ve succeeded. What would that be?',
      subtitle: 'Describe what you would see, feel, and experience. The more specific, the better.',
      type: 'textarea',
      placeholder: 'When I wake up in 90 days, I\'ll notice... I\'ll feel... People will see...',
      required: true,
    },
    {
      id: 'success_feeling',
      section: 'vision',
      question: 'What would achieving this mean to you emotionally?',
      subtitle: 'Beyond the physical changes, how would you feel about yourself?',
      type: 'textarea',
      placeholder: 'I would feel... It would mean...',
      required: true,
    },
  ],

  // No-Oriented Commitment Question
  closeQuestion: {
    question: 'Would it be a bad idea to at least explore which option might fit your goals?',
    yesText: 'No, let me see my options',
    noText: 'I\'m not ready yet',
  },

  // Offer Options
  offers: [
    {
      id: 'diy',
      tier: 'diy',
      title: 'DIY Explorer',
      subtitle: 'Tools to run your own experiment',
      trialPrice: '$1',
      monthlyPrice: '$12.99/mo',
      features: [
        'Breath training protocols',
        'Workout tracking system',
        'Nutrition logging',
        'Progress dashboard',
        'Basic peptide education',
      ],
      accentColor: 'blue',
    },
    {
      id: 'guided',
      tier: 'guided',
      title: 'All Protocols + AI Coaching',
      subtitle: 'Everything plus personalized guidance',
      trialPrice: '$1',
      monthlyPrice: '$29/mo',
      features: [
        'Everything in DIY',
        'All training modules unlocked',
        'AI-powered coaching chat',
        'Individualized protocol plan',
        'Beginner Partnership peptide discounts',
        'Weekly progress insights',
      ],
      badge: 'Most Popular',
      accentColor: 'teal',
      highlighted: true,
    },
    {
      id: 'done-with-you',
      tier: 'doneWithYou',
      title: 'Done-With-You',
      subtitle: 'Personal guidance every step of the way',
      trialPrice: '$99',
      monthlyPrice: '$149/mo',
      features: [
        'Everything in Guided',
        '1-on-1 planning session',
        'Email support within 24hrs',
        'Monthly video check-ins',
        'Custom protocol adjustments',
        'Full Partnership peptide discounts',
      ],
      accentColor: 'purple',
    },
    {
      id: 'concierge',
      tier: 'concierge',
      title: 'Concierge',
      subtitle: 'Complete white-glove service',
      trialPrice: 'Book a call',
      monthlyPrice: '$5,000+/mo',
      features: [
        'Everything above',
        'Weekly 1-on-1 calls',
        'Direct access messaging',
        'Fully managed protocols',
        'Quarterly in-person options',
        'Complete accountability system',
      ],
      badge: 'VIP',
      accentColor: 'gold',
    },
    {
      id: 'other',
      tier: 'other',
      title: 'Something Else?',
      subtitle: 'Let\'s figure out what works for you',
      trialPrice: 'Talk to us',
      monthlyPrice: 'Custom',
      features: [
        'Maybe you need something different',
        'We\'re open to creative solutions',
        'Let\'s have a conversation',
      ],
      accentColor: 'gray',
    },
  ],
}

// Helper functions
export function getSectionQuestions(section: NEPQSection): NEPQQuestion[] {
  return nepqConfig.questions.filter(q => q.section === section)
}

export function getSectionById(sectionId: NEPQSection) {
  return nepqConfig.sections.find(s => s.id === sectionId)
}

export function calculateAuditScore(selectedPractices: string[]): {
  score: number
  maxScore: number
  percentage: number
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
} {
  const auditQuestion = nepqConfig.questions.find(q => q.id === 'audit_practices')
  if (!auditQuestion?.options) {
    return { score: 0, maxScore: 90, percentage: 0, level: 'beginner' }
  }

  const score = selectedPractices.reduce((total, practice) => {
    const option = auditQuestion.options?.find(o => o.value === practice)
    return total + (option?.score || 0)
  }, 0)

  const maxScore = auditQuestion.options.reduce((total, opt) => total + (opt.score || 0), 0)
  const percentage = Math.round((score / maxScore) * 100)

  let level: 'beginner' | 'intermediate' | 'advanced' | 'expert' = 'beginner'
  if (percentage >= 80) level = 'expert'
  else if (percentage >= 60) level = 'advanced'
  else if (percentage >= 30) level = 'intermediate'

  return { score, maxScore, percentage, level }
}

// Calculate category scores from challenges questions
export function calculateCategoryScores(
  eatingPatterns: string[],
  obstacles: string[]
): CategoryScores {
  const scores: CategoryScores = {
    mentalMastery: 0,
    breathwork: 0,
    tracking: 0,
    workout: 0,
    accountability: 0,
    peptides: 0,
  }

  // Get the questions with options
  const eatingQuestion = nepqConfig.questions.find(q => q.id === 'eating_patterns')
  const obstaclesQuestion = nepqConfig.questions.find(q => q.id === 'obstacles')

  // Score eating patterns
  eatingPatterns.forEach(value => {
    const option = eatingQuestion?.options?.find(o => o.value === value)
    if (option?.categoryScores) {
      Object.entries(option.categoryScores).forEach(([category, score]) => {
        scores[category as RecommendationCategory] += score
      })
    }
  })

  // Score obstacles
  obstacles.forEach(value => {
    const option = obstaclesQuestion?.options?.find(o => o.value === value)
    if (option?.categoryScores) {
      Object.entries(option.categoryScores).forEach(([category, score]) => {
        scores[category as RecommendationCategory] += score
      })
    }
  })

  return scores
}

// Get top recommendations based on scores
export type Recommendation = {
  category: RecommendationCategory
  score: number
  title: string
  description: string
  icon: string
  features: string[]
  priority: 'high' | 'medium' | 'low'
}

export const RECOMMENDATION_INFO: Record<RecommendationCategory, Omit<Recommendation, 'category' | 'score' | 'priority'>> = {
  mentalMastery: {
    title: 'Mental Mastery Modules',
    description: 'Address emotional eating patterns and build a healthier relationship with food',
    icon: 'Brain',
    features: [
      'Guided visualizations for food cravings',
      'Emotional eating pattern recognition',
      'Mindful eating techniques',
      'Stress-response reprogramming',
    ],
  },
  breathwork: {
    title: 'Breathwork & Meditation',
    description: 'Reduce stress and improve sleep through proven breathing protocols',
    icon: 'Wind',
    features: [
      'Vagal reset breathing exercises',
      'Sleep optimization protocols',
      'Stress reduction techniques',
      'Daily meditation guidance',
    ],
  },
  tracking: {
    title: 'Nutrition Tracking System',
    description: 'Take control of your nutrition with smart planning and tracking tools',
    icon: 'Apple',
    features: [
      'Meal planning templates',
      'Macro and calorie tracking',
      'Food diary with insights',
      'Portion guidance',
    ],
  },
  workout: {
    title: 'Structured Workout Program',
    description: 'Build consistent exercise habits with progressive training plans',
    icon: 'Dumbbell',
    features: [
      'Personalized workout plans',
      'Progressive overload tracking',
      'Exercise video library',
      'Recovery guidance',
    ],
  },
  accountability: {
    title: 'Accountability System',
    description: 'Stay consistent with check-ins, reminders, and support',
    icon: 'Target',
    features: [
      'Daily task check-ins',
      'Progress milestones',
      'Streak tracking',
      'Community support',
    ],
  },
  peptides: {
    title: 'Peptide Protocols',
    description: 'Optimize metabolism and control hunger with research-backed peptides',
    icon: 'Syringe',
    features: [
      'Hunger control peptides',
      'Metabolism optimization',
      'Energy enhancement',
      'Personalized dosing guidance',
    ],
  },
}

export function getTopRecommendations(scores: CategoryScores, limit: number = 3): Recommendation[] {
  const recommendations: Recommendation[] = Object.entries(scores)
    .map(([category, score]) => {
      const info = RECOMMENDATION_INFO[category as RecommendationCategory]
      let priority: 'high' | 'medium' | 'low' = 'low'
      if (score >= 4) priority = 'high'
      else if (score >= 2) priority = 'medium'

      return {
        category: category as RecommendationCategory,
        score,
        priority,
        ...info,
      }
    })
    .filter(r => r.score > 0) // Only include categories with scores
    .sort((a, b) => b.score - a.score) // Sort by score descending

  return recommendations.slice(0, limit)
}

export default nepqConfig
