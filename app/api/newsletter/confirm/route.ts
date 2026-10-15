import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  const redirect = (path: string) => NextResponse.redirect(new URL(path, req.url))

  if (!token) {
    return redirect('/?newsletter=invalid')
  }

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { token },
  })

  if (!subscriber) {
    return redirect('/?newsletter=invalid')
  }

  await prisma.newsletterSubscriber.update({
    where: { token },
    data: {
      status: 'confirmed',
      confirmedAt: new Date(),
      pendingExpiresAt: null,
    },
  })

  return redirect('/?newsletter=confirmed')
}
