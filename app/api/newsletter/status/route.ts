import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Answers only for the signed-in member's own email, so it cannot be used to
// probe whether an arbitrary address is subscribed.
export async function GET() {
  try {
    const session = await auth0.getSession()
    const email = session?.user?.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ subscribed: false })
    }

    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { status: true },
    })

    return NextResponse.json({ subscribed: subscriber?.status === 'confirmed' })
  } catch {
    // Fail closed for the card: if we cannot tell, do not show it.
    return NextResponse.json({ subscribed: true })
  }
}
