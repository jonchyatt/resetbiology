import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/?newsletter=invalid', request.url));
  }

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { token },
  });

  if (!subscriber) {
    return NextResponse.redirect(new URL('/?newsletter=invalid', request.url));
  }

  await prisma.newsletterSubscriber.update({
    where: { token },
    data: {
      status: 'unsubscribed',
      unsubscribedAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL('/?newsletter=unsubscribed', request.url));
}
