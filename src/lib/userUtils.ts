import { prisma } from './prisma'

// Simplified type definitions since permissions module is missing
type AccessLevel = 'guest' | 'trial' | 'basic' | 'premium' | 'admin'
type UserPermissions = {
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

export interface UserWithPermissions {
  id: string
  email: string | null
  name?: string | null
  accessLevel: AccessLevel
  permissions: UserPermissions
  subscriptionStatus: string
  subscriptionExpiry?: Date | null
  trialStartDate?: Date | null
  trialEndDate?: Date | null
  createdAt: Date
}

/**
 * Get user by ID with all permission information
 */
export async function getUserById(userId: string): Promise<UserWithPermissions | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      accessLevel: true,
      permissions: true,
      subscriptionStatus: true,
      subscriptionExpiry: true,
      trialStartDate: true,
      trialEndDate: true,
      createdAt: true,
    },
  })

  if (!user) return null

  return {
    ...user,
    accessLevel: user.accessLevel as AccessLevel,
    permissions: user.permissions as any as UserPermissions,
  }
}

/**
 * Update user access level and permissions
 */
export async function updateUserAccess(
  userId: string,
  accessLevel: AccessLevel,
  permissions?: Partial<UserPermissions>
): Promise<UserWithPermissions> {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      accessLevel,
      ...(permissions && { permissions }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      accessLevel: true,
      permissions: true,
      subscriptionStatus: true,
      subscriptionExpiry: true,
      trialStartDate: true,
      trialEndDate: true,
      createdAt: true,
    },
  })

  return {
    ...updatedUser,
    accessLevel: updatedUser.accessLevel as AccessLevel,
    permissions: updatedUser.permissions as any as UserPermissions,
  }
}

/**
 * Start a user's trial period
 */
export async function startUserTrial(
  userId: string,
  trialDays: number = 7
): Promise<UserWithPermissions> {
  const now = new Date()
  const trialEnd = new Date()
  trialEnd.setDate(now.getDate() + trialDays)

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      accessLevel: 'trial',
      subscriptionStatus: 'trial',
      trialStartDate: now,
      trialEndDate: trialEnd,
      permissions: {
        assessment: true,
        breathApp: true,
        portalPreview: true,
        audioModules: true, // Trial access
        peptideTracking: true, // Limited features
        workoutPlanning: true,
        nutritionTracking: true,
        education: true, // Limited content
        gamification: true, // Limited rewards
        affiliateSystem: false
      }
    },
    select: {
      id: true,
      email: true,
      name: true,
      accessLevel: true,
      permissions: true,
      subscriptionStatus: true,
      subscriptionExpiry: true,
      trialStartDate: true,
      trialEndDate: true,
      createdAt: true,
    },
  })

  return {
    ...updatedUser,
    accessLevel: updatedUser.accessLevel as AccessLevel,
    permissions: updatedUser.permissions as any as UserPermissions,
  }
}

/**
 * Activate a user's subscription
 */
export async function activateSubscription(
  userId: string,
  accessLevel: AccessLevel = 'basic',
  subscriptionExpiry?: Date
): Promise<UserWithPermissions> {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      accessLevel,
      subscriptionStatus: 'active',
      subscriptionExpiry,
      permissions: {
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
    },
    select: {
      id: true,
      email: true,
      name: true,
      accessLevel: true,
      permissions: true,
      subscriptionStatus: true,
      subscriptionExpiry: true,
      trialStartDate: true,
      trialEndDate: true,
      createdAt: true,
    },
  })

  return {
    ...updatedUser,
    accessLevel: updatedUser.accessLevel as AccessLevel,
    permissions: updatedUser.permissions as any as UserPermissions,
  }
}

/**
 * Check and expire trials that have ended
 */
export async function expireTrials(): Promise<number> {
  const now = new Date()

  const result = await prisma.user.updateMany({
    where: {
      subscriptionStatus: 'trial',
      trialEndDate: {
        lt: now
      }
    },
    data: {
      accessLevel: 'guest',
      subscriptionStatus: 'expired',
      permissions: {
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
      }
    }
  })

  return result.count
}

/**
 * Get all users with specific access level
 */
export async function getUsersByAccessLevel(
  accessLevel: AccessLevel
): Promise<UserWithPermissions[]> {
  const users = await prisma.user.findMany({
    where: { accessLevel },
    select: {
      id: true,
      email: true,
      name: true,
      accessLevel: true,
      permissions: true,
      subscriptionStatus: true,
      subscriptionExpiry: true,
      trialStartDate: true,
      trialEndDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return users.map(user => ({
    ...user,
    accessLevel: user.accessLevel as AccessLevel,
    permissions: user.permissions as any as UserPermissions,
  }))
}

/**
 * Get user statistics for admin dashboard
 */
export async function getUserStats() {
  const [
    totalUsers,
    guestUsers,
    trialUsers,
    activeSubscriptions,
    expiredSubscriptions
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { accessLevel: 'guest' } }),
    prisma.user.count({ where: { accessLevel: 'trial' } }),
    prisma.user.count({ where: { subscriptionStatus: 'active' } }),
    prisma.user.count({ where: { subscriptionStatus: 'expired' } }),
  ])

  return {
    totalUsers,
    guestUsers,
    trialUsers,
    activeSubscriptions,
    expiredSubscriptions,
    conversionRate: totalUsers > 0 ? (activeSubscriptions / totalUsers) * 100 : 0
  }
}