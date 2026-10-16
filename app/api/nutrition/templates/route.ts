import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { cleanTags } from '@/lib/nutrition/templateValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveUser() {
  const session = await auth0.getSession()
  const authUser = session?.user
  if (!authUser) return null
  let user = authUser.sub ? await prisma.user.findUnique({ where: { auth0Sub: authUser.sub } }) : null
  if (!user && authUser.email) user = await prisma.user.findUnique({ where: { email: authUser.email } })
  return user
}


export async function GET() {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const templates = await prisma.mealTemplate.findMany({ where: { userId: user.id }, orderBy: [{ favorite: 'desc' }, { updatedAt: 'desc' }] })
  return NextResponse.json({ ok: true, templates })
}

export async function POST(req: Request) {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const sourceMealId = typeof body?.sourceMealId === 'string' ? body.sourceMealId : null
  if (!name || name.length > 120 || !sourceMealId) return NextResponse.json({ ok: false, error: 'A template name and source meal are required' }, { status: 400 })
  const source = await prisma.foodLog.findFirst({ where: { id: sourceMealId, userId: user.id } })
  if (!source) return NextResponse.json({ ok: false, error: 'Source meal not found' }, { status: 404 })
  const existing = await prisma.mealTemplate.findFirst({ where: { userId: user.id, sourceMealId, name } })
  if (existing) return NextResponse.json({ ok: true, template: existing, duplicate: true })
  const template = await prisma.mealTemplate.create({
    data: {
      userId: user.id,
      name,
      sourceMealId,
      ingredients: { itemName: source.itemName, brand: source.brand, quantity: source.quantity, unit: source.unit, gramWeight: source.gramWeight, mealType: source.mealType, nutrients: source.nutrients },
      notes: typeof body?.notes === 'string' ? body.notes.trim().slice(0, 1000) : null,
      tags: cleanTags(body?.tags),
    },
  })
  return NextResponse.json({ ok: true, template }, { status: 201 })
}


