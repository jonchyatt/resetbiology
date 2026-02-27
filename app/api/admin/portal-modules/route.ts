import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'

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
    return { isAdmin: false, error: 'Auth check failed' }
  }
}

// GET - public, portal needs this
export async function GET(request: NextRequest) {
  try {
    const enabledOnly = request.nextUrl.searchParams.get('enabled') === 'true'

    const modules = await prisma.portalModule.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(modules)
  } catch (error) {
    console.error('Error fetching portal modules:', error)
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 })
  }
}

// PATCH - admin only, toggle enabled or update order
export async function PATCH(request: NextRequest) {
  const { isAdmin, error } = await checkAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { slug, enabled, order } = body

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (typeof enabled === 'boolean') updateData.enabled = enabled
    if (typeof order === 'number') updateData.order = order

    const updated = await prisma.portalModule.update({
      where: { slug },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating portal module:', error)
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 })
  }
}
