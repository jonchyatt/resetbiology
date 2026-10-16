import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { parseIngredients, totalsFor } from '../route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function currentUser() {
  const session = await auth0.getSession()
  if (!session?.user) return null
  return prisma.user.findFirst({ where: { OR: [{ auth0Sub: session.user.sub }, ...(session.user.email ? [{ email: session.user.email }] : [])] } })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const existing = await prisma.recipe.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ ok: false, error: 'Recipe not found' }, { status: 404 })
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) return NextResponse.json({ ok: false, error: 'Invalid recipe name' }, { status: 400 })
      data.name = body.name.trim()
    }
    if (body.notes !== undefined) data.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    if (body.servings !== undefined) {
      const servings = Number(body.servings)
      if (!Number.isFinite(servings) || servings <= 0 || servings > 100) return NextResponse.json({ ok: false, error: 'Invalid servings' }, { status: 400 })
      data.servings = servings
    }
    if (body.ingredients !== undefined) {
      const ingredients = parseIngredients(body.ingredients)
      if (!ingredients) return NextResponse.json({ ok: false, error: 'At least one valid ingredient is required' }, { status: 400 })
      data.ingredients = ingredients
      data.totals = totalsFor(ingredients)
    }
    if (body.favorite !== undefined) data.favorite = Boolean(body.favorite)
    if (body.archived !== undefined) data.archived = Boolean(body.archived)
    const recipe = await prisma.recipe.update({ where: { id }, data })
    return NextResponse.json({ ok: true, recipe })
  } catch (error) {
    console.error('PATCH /api/nutrition/recipes/[id] error', error)
    return NextResponse.json({ ok: false, error: 'Unable to update recipe' }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const recipe = await prisma.recipe.findFirst({ where: { id, userId: user.id } })
    if (!recipe || recipe.archived) return NextResponse.json({ ok: false, error: 'Recipe not found or archived' }, { status: 404 })
    const body = await request.json()
    const servings = Number(body?.servings)
    const clientRequestId = typeof body?.clientRequestId === 'string' ? body.clientRequestId.trim() : ''
    if (!Number.isFinite(servings) || servings <= 0 || servings > 100 || !clientRequestId || clientRequestId.length > 100) return NextResponse.json({ ok: false, error: 'Positive servings and request id are required' }, { status: 400 })
    const existing = await prisma.foodLog.findFirst({ where: { userId: user.id, clientRequestId } })
    if (existing) return NextResponse.json({ ok: true, duplicate: true, meal: existing })
    const totals = (recipe.totals || {}) as Record<string, number>
    const scaled = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value) * servings / recipe.servings]))
    const now = new Date()
    const meal = await prisma.foodLog.create({ data: { userId: user.id, source: 'recipe', sourceId: recipe.id, itemName: recipe.name, quantity: servings, unit: 'serving', nutrients: scaled, notes: recipe.notes, mealType: typeof body?.mealType === 'string' ? body.mealType : 'meal', loggedAt: now, recipeId: recipe.id, recipeServings: servings, recipeSnapshot: JSON.parse(JSON.stringify({ id: recipe.id, name: recipe.name, notes: recipe.notes, servings: recipe.servings, ingredients: recipe.ingredients, totals: recipe.totals })), clientRequestId }, })
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
    await prisma.dailyTask.upsert({ where: { userId_date_taskName: { userId: user.id, date: dayStart, taskName: 'meals' } }, update: { completed: true }, create: { userId: user.id, date: dayStart, taskName: 'meals', completed: true } })
    const journal = await prisma.journalEntry.findFirst({ where: { userId: user.id, date: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) } } })
    const entry = journal?.entry ? JSON.parse(journal.entry) : { nutritionNotes: '', tasksCompleted: {} }
    entry.nutritionNotes = `${entry.nutritionNotes ? `${entry.nutritionNotes}\n` : ''}Recipe logged: ${recipe.name} (${servings} serving${servings === 1 ? '' : 's'})`
    entry.tasksCompleted = { ...(entry.tasksCompleted || {}), meals: true }
    if (journal) await prisma.journalEntry.update({ where: { id: journal.id }, data: { entry: JSON.stringify(entry) } })
    else await prisma.journalEntry.create({ data: { userId: user.id, entry: JSON.stringify(entry), date: now } })
    return NextResponse.json({ ok: true, meal, journalLinked: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/nutrition/recipes/[id] error', error)
    return NextResponse.json({ ok: false, error: 'Unable to log recipe meal' }, { status: 500 })
  }
}
