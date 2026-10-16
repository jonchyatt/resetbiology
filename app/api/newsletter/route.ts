import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const lastAttempts = new Map<string, number>()
const rateLimitMs = 60 * 1000

type NewsletterRequest = {
  email?: unknown
  source?: unknown
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: NewsletterRequest | null

  try {
    body = await request.json() as NewsletterRequest
  } catch {
    body = null
  }

  if (!body || typeof body.email !== 'string' || typeof body.source !== 'string') {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const email = body.email.trim().toLowerCase()
  if (!emailPattern.test(email)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const now = Date.now()
  const lastAttempt = lastAttempts.get(email)
  if (lastAttempt !== undefined && now - lastAttempt < rateLimitMs) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  lastAttempts.set(email, now)

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email },
  })

  if (existing?.status === 'confirmed') {
    return NextResponse.json({ ok: true, state: 'confirmed' })
  }

  const token = crypto.randomBytes(16).toString('hex')
  const pendingExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000)

  await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: {
      status: 'pending',
      source: body.source,
      token,
      confirmedAt: null,
      unsubscribedAt: null,
      pendingExpiresAt,
    },
    create: {
      email,
      status: 'pending',
      source: body.source,
      token,
      pendingExpiresAt,
    },
  })

  if (process.env.RESEND_API_KEY) {
    const confirmLink = `https://resetbiology.com/api/newsletter/confirm?token=${token}`
    const unsubscribeLink = `https://resetbiology.com/api/newsletter/unsubscribe?token=${token}`

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const result = await resend.emails.send({
        from: process.env.NEWSLETTER_FROM || 'Reset Biology <notes@resetbiology.com>',
        replyTo: 'notes@resetbiology.com',
        to: email,
        subject: 'Confirm your Reset Biology notes',
        text: `Confirm your Reset Biology notes: ${confirmLink}\nUnsubscribe: ${unsubscribeLink}`,
      })
      if (result.error) {
        console.error('newsletter: confirmation mail failed', result.error)
      }
    } catch (error) {
      console.error('newsletter: confirmation mail failed', error)
    }
  } else {
    console.log('newsletter: RESEND_API_KEY absent, stored only')
  }

  return NextResponse.json({ ok: true, state: 'pending' })
}
