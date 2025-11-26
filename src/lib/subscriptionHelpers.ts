/**
 * Subscription helper functions for checking user subscription access
 */

import { User } from '@prisma/client'

export type SubscriptionTier = 'free' | 'premium'

export interface SubscriptionAccess {
  hasActiveSubscription: boolean
  tier: SubscriptionTier
  expiryDate: Date | null
  daysRemaining: number | null
  isAdmin: boolean
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
 * Check if user has an active subscription
 * Admin users always return true (full access)
 */
export function hasActiveSubscription(user: User | null): boolean {
  if (!user) return false

  // Admin bypass - admins have full access
  if (isAdmin(user)) return true

  // Check subscription status
  if (user.subscriptionStatus !== 'active') return false

  // Check if subscription has expired
  if (user.subscriptionExpiry) {
    return new Date() < user.subscriptionExpiry
  }

  // Active status with no expiry means it's active
  return true
}

/**
 * Get user's subscription access details
 */
export function getSubscriptionAccess(user: User | null): SubscriptionAccess {
  if (!user) {
    return {
      hasActiveSubscription: false,
      tier: 'free',
      expiryDate: null,
      daysRemaining: null,
      isAdmin: false
    }
  }

  const userIsAdmin = isAdmin(user)
  const isActive = hasActiveSubscription(user)
  const expiryDate = user.subscriptionExpiry || null

  let daysRemaining: number | null = null
  if (expiryDate && !userIsAdmin) {
    const diffTime = expiryDate.getTime() - new Date().getTime()
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  return {
    hasActiveSubscription: isActive,
    tier: isActive ? 'premium' : 'free',
    expiryDate: userIsAdmin ? null : expiryDate,
    daysRemaining: userIsAdmin ? null : (daysRemaining && daysRemaining > 0 ? daysRemaining : null),
    isAdmin: userIsAdmin
  }
}

/**
 * Check if user can access premium Mental Mastery modules
 */
export function canAccessPremiumMentalMastery(user: User | null): boolean {
  return hasActiveSubscription(user)
}

/**
 * Check if user can access Breathing app
 */
export function canAccessBreathingApp(user: User | null): boolean {
  return hasActiveSubscription(user)
}

/**
 * Get upgrade message for users without active subscription
 */
export function getUpgradeMessage(feature: 'mental-mastery' | 'breathing-app'): string {
  const featureName = feature === 'mental-mastery'
    ? 'premium Mental Mastery modules'
    : 'the Breathing App'

  return `Upgrade to premium to access ${featureName}. Subscribe now to unlock all features.`
}
