import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    // Handle the Auth0 callback
    const response = await auth0.callback(req)

    // Get the user session after successful login
    const session = await auth0.getSession()

    if (session?.user) {
      console.log('🔍 Auth0 Login - User:', {
        sub: session.user.sub,
        email: session.user.email,
        name: session.user.name,
        picture: session.user.picture
      })

      // Check if user exists by Auth0 ID
      let user = await prisma.user.findUnique({
        where: { auth0Sub: session.user.sub }
      })

      // If not found by auth0Sub, try by email
      if (!user && session.user.email) {
        user = await prisma.user.findUnique({
          where: { email: session.user.email }
        })

        if (user) {
          // Update existing user with Auth0 ID
          console.log('📝 Updating existing user with Auth0 ID')
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              auth0Sub: session.user.sub,
              name: session.user.name || user.name,
              image: session.user.picture || user.image,
              updatedAt: new Date()
            }
          })
        }
      }

      // If still no user, create new one
      if (!user) {
        console.log('✨ Creating new user in database')
        user = await prisma.user.create({
          data: {
            auth0Sub: session.user.sub,
            email: session.user.email!,
            name: session.user.name || session.user.email!.split('@')[0],
            image: session.user.picture,
            emailVerified: session.user.email_verified ? new Date() : null,
            role: 'basic',
            accessLevel: 'member',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
        console.log(`✅ New user created: ${user.email} (${user.id})`)
      } else {
        console.log(`✅ Existing user logged in: ${user.email} (${user.id})`)
      }
    }

    return response
  } catch (error) {
    console.error('❌ Auth0 callback error:', error)

    // Return a more user-friendly error page
    return new NextResponse(
      `
      <html>
        <body style="font-family: system-ui, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>Login Error</h1>
          <p>There was an issue logging you in. Please try again.</p>
          <p style="color: #666; font-size: 14px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <a href="/auth/login" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3FBFB5; color: white; text-decoration: none; border-radius: 5px;">Try Again</a>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }
}