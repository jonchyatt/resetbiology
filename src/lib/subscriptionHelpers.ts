/**
 * Subscription helper functions for checking user subscription access
 *
 * Access Levels:
 * - guest: No access (default before quiz)
 * - introduction: 7-day limited access after quiz completion + first login
 * - subscriber: Full paid access (will have variations later)
 * - admin: Full access including /admin pages
 *
 * Introduction Tier Access (1 week):
 * - Mental Mastery Module 1
 * - Breathing Module 1
 * - Nutrition tracking/planning
 * - Journal access
 * - Peptide tracker
 * - NO exercise tracking
 * - NO discounts
 */

import { User } from '@prisma/client'

export type AccessLevel = 'guest' | 'introduction' | 'subscriber' | 'admin'
export type SubscriptionTier = 'free' | 'introduction' | 'premium'

export interface SubscriptionAccess {
  hasActiveSubscription: boolean
  tier: SubscriptionTier
  accessLevel: AccessLevel
  expiryDate: Date | null
  daysRemaining: number | null
  isAdmin: boolean
  isIntroduction: boolean
  introductionExpired: boolean
}

/**
 * Check if user is an admin
 * Admin users get full access to all features regardless of subscription
 */
export function isAdmin(user: User | null): boolean {
  if (!user) return false
  return user.role === 'admin' || user.accessLevel === 'admin'
}

/**
 * Check if user has active introduction tier access
 */
export function hasActiveIntroduction(user: User | null): boolean {
  if (!user) return false
  if (user.accessLevel !== 'introduction') return false

  // Check if introduction tier has expired
  if (user.introductionExpiresAt) {
    return new Date() < user.introductionExpiresAt
  }

  return false
}

/**
 * Check if user has an active subscription (paid)
 * Admin users always return true (full access)
 */
export function hasActiveSubscription(user: User | null): boolean {
  if (!user) return false

  // Admin bypass - admins have full access
  if (isAdmin(user)) return true

  // Subscriber level with active status
  if (user.accessLevel === 'subscriber' && user.subscriptionStatus === 'active') {
    // Check if subscription has expired
    if (user.subscriptionExpiry) {
      return new Date() < user.subscriptionExpiry
    }
    return true
  }

  return false
}

/**
 * Check if user has any level of access (introduction OR subscription)
 */
export function hasAnyAccess(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  if (hasActiveIntroduction(user)) return true
  return false
}

/**
 * Get user's subscription access details
 */
export function getSubscriptionAccess(user: User | null): SubscriptionAccess {
  if (!user) {
    return {
      hasActiveSubscription: false,
      tier: 'free',
      accessLevel: 'guest',
      expiryDate: null,
      daysRemaining: null,
      isAdmin: false,
      isIntroduction: false,
      introductionExpired: false
    }
  }

  const userIsAdmin = isAdmin(user)
  const isSubscriptionActive = hasActiveSubscription(user)
  const isIntroActive = hasActiveIntroduction(user)

  // Determine access level
  let accessLevel: AccessLevel = user.accessLevel as AccessLevel || 'guest'

  // Determine tier for display
  let tier: SubscriptionTier = 'free'
  if (userIsAdmin || isSubscriptionActive) {
    tier = 'premium'
  } else if (isIntroActive) {
    tier = 'introduction'
  }

  // Calculate expiry and days remaining
  let expiryDate: Date | null = null
  let daysRemaining: number | null = null

  if (!userIsAdmin) {
    if (isSubscriptionActive && user.subscriptionExpiry) {
      expiryDate = user.subscriptionExpiry
    } else if (isIntroActive && user.introductionExpiresAt) {
      expiryDate = user.introductionExpiresAt
    }

    if (expiryDate) {
      const diffTime = expiryDate.getTime() - new Date().getTime()
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (daysRemaining < 0) daysRemaining = 0
    }
  }

  // Check if introduction expired
  const introductionExpired = user.accessLevel === 'introduction' &&
    user.introductionExpiresAt !== null &&
    new Date() >= user.introductionExpiresAt

  return {
    hasActiveSubscription: isSubscriptionActive,
    tier,
    accessLevel,
    expiryDate: userIsAdmin ? null : expiryDate,
    daysRemaining: userIsAdmin ? null : daysRemaining,
    isAdmin: userIsAdmin,
    isIntroduction: isIntroActive,
    introductionExpired
  }
}

// ================================================
// FEATURE ACCESS CHECKS
// ================================================

/**
 * Check if user can access Mental Mastery Module 1
 * Available to: introduction, subscriber, admin
 */
export function canAccessMentalMasteryModule1(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  if (hasActiveIntroduction(user)) return true
  return false
}

/**
 * Check if user can access premium Mental Mastery modules (2+)
 * Available to: subscriber, admin (NOT introduction)
 */
export function canAccessPremiumMentalMastery(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  return false
}

/**
 * Check if user can access Breathing Module 1
 * Available to: introduction, subscriber, admin
 */
export function canAccessBreathingModule1(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  if (hasActiveIntroduction(user)) return true
  return false
}

/**
 * Check if user can access premium Breathing modules
 * Available to: subscriber, admin (NOT introduction)
 */
export function canAccessBreathingApp(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  return false
}

/**
 * Check if user can access Nutrition Tracking
 * Available to: introduction, subscriber, admin
 */
export function canAccessNutritionTracking(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  if (hasActiveIntroduction(user)) return true
  return false
}

/**
 * Check if user can access Workout/Exercise Tracking
 * Available to: subscriber, admin (NOT introduction)
 */
export function canAccessWorkoutTracking(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  return false
}

/**
 * Check if user can access Journal
 * Available to: introduction, subscriber, admin
 */
export function canAccessJournal(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  if (hasActiveIntroduction(user)) return true
  return false
}

/**
 * Check if user can access Peptide Tracker
 * Available to: introduction, subscriber, admin
 */
export function canAccessPeptideTracker(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  if (hasActiveIntroduction(user)) return true
  return false
}

/**
 * Check if user gets peptide discounts
 * Available to: subscriber, admin (NOT introduction)
 */
export function hasPeptideDiscounts(user: User | null): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (hasActiveSubscription(user)) return true
  return false
}

/**
 * Get upgrade message for users without access
 */
export function getUpgradeMessage(feature: string, user: User | null): string {
  const access = getSubscriptionAccess(user)

  if (access.introductionExpired) {
    return `Your 7-day introduction access has expired. Subscribe to continue using ${feature}.`
  }

  if (access.isIntroduction) {
    return `${feature} is not included in your introduction access. Upgrade to unlock this feature.`
  }

  return `Subscribe to access ${feature}. Start your trial today!`
}
