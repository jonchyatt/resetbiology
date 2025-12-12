import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'

/**
 * Admin Users API
 * Allows admins to view and manage user access levels
 */

// Check if current user is admin
async function checkAdminAccess(): Promise<{ isAdmin: boolean; error?: string }> {
  try {
    const session = await auth0.getSession()
    if (!session?.user?.email) {
      return { isAdmin: false, error: 'Not authenticated' }
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { auth0Sub: session.user.sub },
          { email: session.user.email }
        ]
      }
    })

    if (!user || (user.role !== 'admin' && user.accessLevel !== 'admin')) {
      return { isAdmin: false, error: 'Not authorized' }
    }

    return { isAdmin: true }
  } catch {
    return { isAdmin: false, error: 'Authentication error' }
  }
}

/**
 * GET - List all users with their access levels
 */
export async function GET() {
  const { isAdmin, error } = await checkAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        memberID: true,
        role: true,
        accessLevel: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        introductionStartDate: true,
        introductionExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

/**
 * PATCH - Update user access level or grant free subscription time
 */
export async function PATCH(req: NextRequest) {
  const { isAdmin, error } = await checkAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { userId, accessLevel, role, grantDays, setSubscriberUntil } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const validAccessLevels = ['guest', 'introduction', 'subscriber', 'admin']
    const validRoles = ['basic', 'admin']

    const updateData: Record<string, unknown> = {}

    // Handle granting free subscription days
    if (grantDays && typeof grantDays === 'number' && grantDays > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionExpiry: true, accessLevel: true }
      })

      // Start from current expiry or now, whichever is later
      const baseDate = user?.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date()
        ? new Date(user.subscriptionExpiry)
        : new Date()

      const newExpiry = new Date(baseDate)
      newExpiry.setDate(newExpiry.getDate() + grantDays)

      updateData.subscriptionExpiry = newExpiry
      updateData.subscriptionStatus = 'active'
      // Also set to subscriber if they're a guest
      if (user?.accessLevel === 'guest') {
        updateData.accessLevel = 'subscriber'
      }
    }

    // Handle setting specific expiry date
    if (setSubscriberUntil) {
      const expiryDate = new Date(setSubscriberUntil)
      if (isNaN(expiryDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
      }
      updateData.subscriptionExpiry = expiryDate
      updateData.subscriptionStatus = expiryDate > new Date() ? 'active' : 'expired'
      updateData.accessLevel = 'subscriber'
    }

    if (accessLevel && validAccessLevels.includes(accessLevel)) {
      updateData.accessLevel = accessLevel

      // If setting to introduction, set expiry to 7 days from now
      if (accessLevel === 'introduction') {
        const now = new Date()
        const expiresAt = new Date(now)
        expiresAt.setDate(expiresAt.getDate() + 7)
        updateData.introductionStartDate = now
        updateData.introductionExpiresAt = expiresAt
      }

      // If setting to subscriber without expiry, set 30 days
      if (accessLevel === 'subscriber' && !updateData.subscriptionExpiry) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)
        updateData.subscriptionExpiry = expiresAt
        updateData.subscriptionStatus = 'active'
      }

      // If setting to admin, also set role to admin
      if (accessLevel === 'admin') {
        updateData.role = 'admin'
      }
    }

    if (role && validRoles.includes(role)) {
      updateData.role = role
      // If setting role to admin, also set accessLevel to admin
      if (role === 'admin') {
        updateData.accessLevel = 'admin'
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        memberID: true,
        role: true,
        accessLevel: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        introductionStartDate: true,
        introductionExpiresAt: true,
      }
    })

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

/**
 * POST - Create a new admin user (or promote existing user to admin)
 */
export async function POST(req: NextRequest) {
  const { isAdmin, error } = await checkAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email }
    })

    if (existingUser) {
      // Promote existing user to admin
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'admin',
          accessLevel: 'admin'
        },
        select: {
          id: true,
          email: true,
          name: true,
          memberID: true,
          role: true,
          accessLevel: true,
        }
      })

      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: 'Existing user promoted to admin'
      })
    }

    // Generate member ID for new user
    const lastUser = await prisma.user.findFirst({
      where: { memberID: { not: null } },
      orderBy: { memberID: 'desc' },
      select: { memberID: true }
    })

    let nextNumber = 1
    if (lastUser?.memberID) {
      const match = lastUser.memberID.match(/RB-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    const memberID = `RB-${nextNumber.toString().padStart(6, '0')}`

    // Create new admin user
    const newUser = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        memberID,
        role: 'admin',
        accessLevel: 'admin',
      },
      select: {
        id: true,
        email: true,
        name: true,
        memberID: true,
        role: true,
        accessLevel: true,
      }
    })

    return NextResponse.json({
      success: true,
      user: newUser,
      message: 'New admin user created'
    })
  } catch (error) {
    console.error('Error creating admin user:', error)
    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
  }
}
