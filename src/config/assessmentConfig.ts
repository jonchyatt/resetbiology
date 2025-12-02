export type AssessmentQuestionOption = {
  value: string
  label: string
  score?: number
}

export type AssessmentQuestion = {
  id: string
  question: string
  subtitle?: string
  type: "text" | "email" | "tel" | "textarea" | "choice"
  placeholder?: string
  required?: boolean
  options?: AssessmentQuestionOption[]
  multiSelect?: boolean
  maxMultiSelect?: number
}

export type AssessmentOffer = {
  id: string
  title: string
  subtitle?: string
  bullets?: string[]
  ctaText: string
  ctaLink: string
  badge?: string
  accentColor?: "yellow" | "blue" | "green" | "purple" | "red" | "gray"
}

export type AssessmentConfig = {
  updatedAt: string
  landing: {
    headline: string
    subheadline: string
    supportingPoints: string[]
  }
  questions: AssessmentQuestion[]
  resultsOffer: {
    title: string
    subtitle: string
    offers: AssessmentOffer[]
  }
}

export const defaultAssessmentConfig: AssessmentConfig = {
  updatedAt: new Date(2024, 0, 1).toISOString(),
  landing: {
    headline: "Feeling frustrated that you're not losing weight even though you're doing everything right?",
    subheadline:
      "Answer 15 questions to discover the 3 cellular optimization gaps keeping you stuck—and what to do about them.",
    supportingPoints: [
      "Track how cellular health, peptides, and recovery impact fat loss",
      "Spot gaps across nutrition, workouts, sleep, stress, and accountability",
      "Get an immediate readiness score plus a tailored next step",
    ],
  },
  questions: [
    {
      id: "name",
      question: "What's your first name?",
      type: "text",
      placeholder: "Enter your name",
      required: true,
    },
    {
      id: "email",
      question: "What's your email address?",
      subtitle: "We'll send your personalized results here",
      type: "email",
      placeholder: "you@example.com",
      required: true,
    },
    {
      id: "phone",
      question: "Phone number (optional)",
      subtitle: "For priority support and follow-up",
      type: "tel",
      placeholder: "(555) 123-4567",
      required: false,
    },
    {
      id: "q5_protein_tracking",
      question:
        "Are you currently tracking your daily protein intake to ensure you're getting 0.8-1g per pound of bodyweight?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "yes-daily", label: "Yes, I track daily", score: 10 },
        { value: "sometimes", label: "Sometimes", score: 5 },
        { value: "no", label: "No, I don't track", score: 0 },
        { value: "dont-know", label: "I don't know my target", score: 0 },
      ],
    },
    {
      id: "q6_stem_cell_support",
      question:
        "Are you taking any supplements or protocols specifically designed to support stem cell release and tissue repair?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "yes-peptides", label: "Yes, I'm on a peptide or stem cell protocol", score: 10 },
        { value: "basic-supps", label: "I take basic supplements (vitamins, fish oil)", score: 3 },
        { value: "no-supps", label: "No supplements currently", score: 0 },
        { value: "never-heard", label: "I've never heard of this", score: 0 },
      ],
    },
    {
      id: "q7_unified_tracking",
      question: "Do you use a digital system to track your workouts, nutrition, and recovery in one unified platform?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "yes-unified", label: "Yes, everything is tracked digitally", score: 10 },
        { value: "manual", label: "I track some things manually", score: 4 },
        { value: "in-head", label: "I track in my head or sporadically", score: 1 },
        { value: "no-tracking", label: "I don't track consistently", score: 0 },
      ],
    },
    {
      id: "q8_breathwork",
      question: "Are you practicing daily breathwork or meditation to optimize your nervous system and metabolic flexibility?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "daily", label: "Yes, daily practice (10+ min)", score: 10 },
        { value: "weekly", label: "Occasionally (1-2x per week)", score: 4 },
        { value: "rarely", label: "Rarely", score: 1 },
        { value: "never", label: "Never heard of metabolic flexibility training", score: 0 },
      ],
    },
    {
      id: "q9_sleep_tracking",
      question: "Are you tracking your sleep quality and using protocols to ensure 7+ hours of deep, restorative sleep?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "track-optimize", label: "Yes, I track sleep and use optimization protocols", score: 10 },
        { value: "try-7hrs", label: "I try to get 7+ hours but don't track quality", score: 5 },
        { value: "inconsistent", label: "My sleep is inconsistent", score: 2 },
        { value: "struggle", label: "Sleep is a struggle for me", score: 0 },
      ],
    },
    {
      id: "q10_detox_protocols",
      question:
        "Are you supporting your body's natural detox pathways with chlorella, spirulina, or other cellular cleansing protocols?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "yes-protocol", label: "Yes, I have a detox protocol", score: 10 },
        { value: "tried-before", label: "I've tried detoxing before", score: 3 },
        { value: "no-protocol", label: "No detox protocols currently", score: 0 },
        { value: "dont-know", label: "I don't know what this means", score: 0 },
      ],
    },
    {
      id: "q11_journaling",
      question:
        "Do you maintain a daily journal to track emotional patterns, stress levels, and their impact on your weight loss?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "daily", label: "Yes, I journal daily", score: 10 },
        { value: "occasional", label: "I journal occasionally", score: 5 },
        { value: "tried-quit", label: "I tried but couldn't stick with it", score: 2 },
        { value: "never", label: "I've never journaled for health", score: 0 },
      ],
    },
    {
      id: "q12_workout_program",
      question: "Are you following a structured, progressive workout program designed for fat loss and muscle preservation?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "structured", label: "Yes, I have a structured program", score: 10 },
        { value: "regular-no-program", label: "I work out regularly but no formal program", score: 5 },
        { value: "sporadic", label: "I work out sporadically", score: 2 },
        { value: "not-working-out", label: "I'm not currently working out", score: 0 },
      ],
    },
    {
      id: "q13_accountability",
      question: "Do you have daily check-ins, notifications, or accountability systems to keep you on track?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "multiple-systems", label: "Yes, I have multiple accountability systems", score: 10 },
        { value: "some-reminders", label: "I have some reminders set up", score: 5 },
        { value: "willpower-only", label: "I rely on willpower alone", score: 1 },
        { value: "often-forget", label: "I often forget my protocols", score: 0 },
      ],
    },
    {
      id: "q14_peptide_knowledge",
      question:
        "Are you familiar with how peptides like BPC-157, CJC-1295, or Semaglutide can support cellular fat loss and recovery?",
      type: "choice",
      multiSelect: true,
      maxMultiSelect: 4,
      options: [
        { value: "using-peptides", label: "Yes, I'm currently using peptides", score: 10 },
        { value: "heard-never-used", label: "I've heard of them but never used them", score: 5 },
        { value: "curious", label: "I'm curious but don't know where to start", score: 2 },
        { value: "never-heard", label: "I've never heard of peptides for weight loss", score: 0 },
      ],
    },
    {
      id: "q15_current_situation",
      question: "Which best describes your current weight loss journey?",
      type: "choice",
      options: [
        { value: "just-starting", label: "Just starting, need guidance on everything" },
        { value: "6-12mo-stuck", label: "Been trying for 6-12 months, some progress but stuck" },
        { value: "1-3yrs-plateaus", label: "Been trying for 1-3 years, multiple plateaus" },
        { value: "3plus-frustrated", label: "Been trying for 3+ years, tried everything, very frustrated" },
      ],
    },
    {
      id: "q16_desired_outcome",
      question: "What is the #1 outcome you want to achieve in the next 90 days?",
      type: "choice",
      options: [
        { value: "lose-15-25lbs", label: "Lose 15-25 lbs of stubborn fat" },
        { value: "break-plateau", label: "Break through my current plateau" },
        { value: "increase-energy", label: "Increase energy and metabolic rate" },
        { value: "sustainable-system", label: "Build a sustainable system that finally works long-term" },
      ],
    },
    {
      id: "q17_biggest_obstacle",
      question: "What do you think is the biggest obstacle stopping you from reaching your goal?",
      type: "choice",
      options: [
        { value: "lack-knowledge", label: "I don't know what I'm doing wrong" },
        { value: "lack-consistency", label: "I can't stay consistent" },
        { value: "metabolism-broken", label: "My metabolism seems broken" },
        { value: "tried-everything", label: "I've tried everything and nothing works" },
      ],
    },
    {
      id: "q18_ideal_solution",
      question: "Which solution sounds most appealing to you?",
      type: "choice",
      options: [
        { value: "diy", label: "DIY: Give me the tools, I'll do it myself ($97-297/mo)" },
        { value: "guided", label: "Guided: Protocols + coaching check-ins ($497-997/mo)" },
        { value: "done-with-you", label: "Done-With-You: Personalized protocols + full tracking + weekly support ($1,497-2,997/mo)" },
        { value: "concierge", label: "Concierge: Do it all for me with 1-on-1 coaching ($3,000+/mo)" },
      ],
    },
    {
      id: "q19_additional_info",
      question: "Is there anything else we should know about your situation, goals, or concerns?",
      subtitle: "This helps us give you better recommendations (optional)",
      type: "textarea",
      placeholder: "Share anything you'd like us to know...",
      required: false,
    },
  ],
  resultsOffer: {
    title: "Choose your trial offer to experience Reset Biology",
    subtitle: "Pick the fast start that fits you best—every option includes personal guidance.",
    offers: [
      {
        id: "guided-trial",
        title: "Guided Trial - 14 days",
        subtitle: "Coaching check-ins + portal access + peptide education",
        bullets: [
          "Personal setup call and readiness review",
          "Access to breathwork + tracking stack",
          "Applies as credit if you continue",
        ],
        ctaText: "Start Guided Trial",
        ctaLink: "/store",
        badge: "Most Popular",
        accentColor: "yellow",
      },
      {
        id: "diy-trial",
        title: "DIY Sprint - 14 days",
        subtitle: "Tools and protocols to run your own experiment",
        bullets: [
          "Cellular optimization checklist",
          "Progress tracker + reminders",
          "Upgrade anytime without losing progress",
        ],
        ctaText: "Start DIY Sprint",
        ctaLink: "/portal",
        accentColor: "blue",
      },
      {
        id: "concierge-trial",
        title: "Concierge Accelerator - 30 days",
        subtitle: "1:1 support + peptide protocol + accountability",
        bullets: [
          "Weekly calls, daily check-ins",
          "Custom peptide and recovery roadmap",
          "Priority support and results review",
        ],
        ctaText: "Book Concierge Call",
        ctaLink: "https://calendly.com/resetbiology",
        badge: "White-glove",
        accentColor: "purple",
      },
    ],
  },
}

export function getDefaultAssessmentConfig(): AssessmentConfig {
  return { ...defaultAssessmentConfig, questions: [...defaultAssessmentConfig.questions] }
}
