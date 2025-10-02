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
    const { name, email } = body
    
    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { auth0Sub: session.user.sub },
      data: {
        name: name || null,
        email: email || null,
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      user: {
        name: updatedUser.name,
        email: updatedUser.email
      }
    })
    
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ 
      error: 'Failed to update profile' 
    }, { status: 500 })
  }
}