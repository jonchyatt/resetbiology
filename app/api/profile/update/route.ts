import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'

export async function POST(request: NextRequest) {
  try {
    // Get the session from Auth0
    const session = await auth0.getSession(request)
    
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    const { name, email, username } = body

    // Validate username format if provided
    if (username && !/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({
        error: 'Username can only contain lowercase letters, numbers, and underscores'
      }, { status: 400 })
    }

    // Check username uniqueness if changed
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: username,
          NOT: { auth0Sub: session.user.sub }
        }
      })
      if (existingUser) {
        return NextResponse.json({
          error: 'This username is already taken'
        }, { status: 400 })
      }
    }

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { auth0Sub: session.user.sub },
      data: {
        name: name || null,
        email: email || null,
        username: username || null,
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        username: updatedUser.username,
        memberID: updatedUser.memberID,
      }
    })
    
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ 
      error: 'Failed to update profile' 
    }, { status: 500 })
  }
}