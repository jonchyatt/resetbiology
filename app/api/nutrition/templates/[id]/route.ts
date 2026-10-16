import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { cleanTags, validIngredients } from '@/lib/nutrition/templateValidation'

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  const data: Record<string, unknown> = {}
  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (!name || name.length > 120) return NextResponse.json({ ok: false, error: 'Template name is invalid' }, { status: 400 })
    data.name = name
  }
  if (typeof body?.notes === 'string') data.notes = body.notes.trim().slice(0, 1000)
  if (Array.isArray(body?.tags)) data.tags = cleanTags(body.tags)
  if (body?.ingredients !== undefined) {
    if (!validIngredients(body.ingredients)) return NextResponse.json({ ok: false, error: 'Ingredients must be an object' }, { status: 400 })
    data.ingredients = body.ingredients
  }
  if (typeof body?.favorite === 'boolean') data.favorite = body.favorite
  if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: 'No valid changes supplied' }, { status: 400 })
  const result = await prisma.mealTemplate.updateMany({ where: { id, userId: user.id }, data })
  if (!result.count) return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 })
  const template = await prisma.mealTemplate.findFirst({ where: { id, userId: user.id } })
  return NextResponse.json({ ok: true, template })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const result = await prisma.mealTemplate.deleteMany({ where: { id, userId: user.id } })
  if (!result.count) return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
