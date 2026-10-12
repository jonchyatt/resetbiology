import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { isAdminRequest } from '@/lib/adminGuard'

// ponytail: one env switch parks the whole shop (Jon ruling 2026-10-11, option A).
// Unset = parked. COMMERCE_PUBLIC=true in Vercel reopens it. Admins always pass.
export const COMMERCE_PUBLIC = process.env.COMMERCE_PUBLIC === 'true'

export async function commerceAllowed(opts: { allowStripeCustomer?: boolean } = {}): Promise<boolean> {
  if (COMMERCE_PUBLIC) return true
  if (await isAdminRequest()) return true
  if (opts.allowStripeCustomer) {
    const email = (await auth0.getSession())?.user?.email?.toLowerCase()
    if (email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { stripeCustomerId: true } })
      if (u?.stripeCustomerId) return true // an existing payer keeps "Manage subscription"
    }
  }
  return false
}

export async function parkCommercePage(opts?: { allowStripeCustomer?: boolean }) {
  if (!(await commerceAllowed(opts))) redirect('/order') // 307, temporary
}
