// Auth0-adapted permissions system for Reset Biology
export type AccessLevel = 'guest' | 'trial' | 'basic' | 'premium' | 'platinum'
export type SubscriptionStatus = 'none' | 'trial' | 'active' | 'expired'

export interface UserPermissions {
  assessment: boolean
  breathApp: boolean
  portalPreview: boolean
  audioModules: boolean
  peptideTracking: boolean
  workoutPlanning: boolean
  nutritionTracking: boolean
  education: boolean
  gamification: boolean
  affiliateSystem: boolean
}

export const DEFAULT_PERMISSIONS: Record<AccessLevel, UserPermissions> = {
  guest: {
    assessment: true,
    breathApp: true,
    portalPreview: true,
    audioModules: false,
    peptideTracking: false,
    workoutPlanning: false,
    nutritionTracking: false,
    education: false,
    gamification: false,
    affiliateSystem: false
  },
  trial: {
    assessment: true,
    breathApp: true,
    portalPreview: true,
    audioModules: true, // Limited access
    peptideTracking: true, // Limited features
    workoutPlanning: true,
    nutritionTracking: true,
    education: true, // Limited content
    gamification: true, // Limited rewards
    affiliateSystem: false
  },
  basic: {
    assessment: true,
    breathApp: true,
    portalPreview: true,
    audioModules: true,
    peptideTracking: true,
    workoutPlanning: true,
    nutritionTracking: true,
    education: true,
    gamification: true,
    affiliateSystem: true
  },
  premium: {
    assessment: true,
    breathApp: true,
    portalPreview: true,
    audioModules: true,
    peptideTracking: true,
    workoutPlanning: true,
    nutritionTracking: true,
    education: true,
    gamification: true,
    affiliateSystem: true
  },
  platinum: {
    assessment: true,
    breathApp: true,
    portalPreview: true,
    audioModules: true,
    peptideTracking: true,
    workoutPlanning: true,
    nutritionTracking: true,
    education: true,
    gamification: true,
    affiliateSystem: true
  }
}

// Mock session interface for Auth0 adaptation
interface MockSession {
  user?: {
    email?: string
    name?: string
    accessLevel?: AccessLevel
    subscriptionStatus?: SubscriptionStatus
    permissions?: UserPermissions
    trialEndDate?: string
    trialStartDate?: string
    subscriptionExpiry?: string
  }
}

export function hasPermission(
  session: MockSession | null,
  permission: keyof UserPermissions
): boolean {
  // For now, during Auth0 transition, give trial-level access to logged-in users
  if (!session?.user) return false
  
  const userPermissions = session.user.permissions as UserPermissions
  if (!userPermissions) {
    // Fall back to trial access level for logged-in users during transition
    const accessLevel = (session.user.accessLevel as AccessLevel) || 'trial'
    return DEFAULT_PERMISSIONS[accessLevel][permission]
  }
  
  return userPermissions[permission] || false
}

export function isTrialExpired(session: MockSession | null): boolean {
  if (!session?.user?.trialEndDate) return false
  return new Date() > new Date(session.user.trialEndDate)
}

export function isSubscriptionActive(session: MockSession | null): boolean {
  if (!session?.user) return false
  
  const { subscriptionStatus, subscriptionExpiry } = session.user
  
  if (subscriptionStatus === 'active') {
    if (subscriptionExpiry) {
      return new Date() <= new Date(subscriptionExpiry)
    }
    return true
  }
  
  return false
}

export function getAccessLevel(session: MockSession | null): AccessLevel {
  if (!session?.user) return 'guest'
  
  // During Auth0 transition, give trial access to logged-in users
  if (session.user.email) {
    return 'trial'
  }
  
  // Check if subscription is active
  if (isSubscriptionActive(session)) {
    return (session.user.accessLevel as AccessLevel) || 'basic'
  }
  
  // Check if trial is active
  if (session.user.subscriptionStatus === 'trial' && !isTrialExpired(session)) {
    return 'trial'
  }
  
  return 'guest'
}

export function getUpgradeMessage(
  session: MockSession | null,
  requiredPermission: keyof UserPermissions
): string {
  const currentAccess = getAccessLevel(session)
  
  if (currentAccess === 'guest') {
    return "Start your 7-day free trial to unlock this feature!"
  }
  
  if (currentAccess === 'trial') {
    if (isTrialExpired(session)) {
      return "Your trial has expired. Upgrade to continue accessing premium features."
    }
    return "This feature requires a full membership. Upgrade to unlock unlimited access."
  }
  
  return "Upgrade your membership to access this premium feature."
}

export function canStartTrial(session: MockSession | null): boolean {
  if (!session?.user) return false
  
  return (
    session.user.subscriptionStatus === 'none' &&
    !session.user.trialStartDate
  )
}

export function getRemainingTrialDays(session: MockSession | null): number | null {
  if (!session?.user?.trialEndDate) return null
  
  const now = new Date()
  const trialEnd = new Date(session.user.trialEndDate)
  const diffTime = trialEnd.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays)
}