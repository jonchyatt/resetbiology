import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ingredient = {
  name: string
  quantity: number
  unit: string
  notes?: string | null
  sourceId?: string | null
  nutrients: Record<string, number>
}

const nutrientKeys = ['kcal', 'protein_g', 'carb_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg']

function parseIngredients(value: unknown): Ingredient[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const ingredients: Ingredient[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null
    const item = raw as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const quantity = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity)
    const unit = typeof item.unit === 'string' ? item.unit.trim() : ''
    const nutrients = item.nutrients
    if (!name || !unit || !Number.isFinite(quantity) || quantity <= 0 || !nutrients || typeof nutrients !== 'object') return null
    const normalized: Record<string, number> = {}
    for (const key of nutrientKeys) {
      const numberValue = Number((nutrients as Record<string, unknown>)[key] ?? 0)
      if (!Number.isFinite(numberValue) || numberValue < 0) return null
      normalized[key] = numberValue
    }
    ingredients.push({ name, quantity, unit, nutrients: normalized, notes: typeof item.notes === 'string' ? item.notes.trim() || null : null, sourceId: typeof item.sourceId === 'string' ? item.sourceId : null })
  }
  return ingredients
}

function totalsFor(ingredients: Ingredient[]) {
  return nutrientKeys.reduce<Record<string, number>>((totals, key) => {
    totals[key] = ingredients.reduce((sum, ingredient) => sum + ingredient.nutrients[key], 0)
    return totals
  }, {})
}

async function currentUser() {
  const session = await auth0.getSession()
  if (!session?.user) return null
  return prisma.user.findFirst({ where: { OR: [{ auth0Sub: session.user.sub }, ...(session.user.email ? [{ email: session.user.email }] : [])] } })
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const recipes = await prisma.recipe.findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ ok: true, recipes })
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const notes = typeof body?.notes === 'string' ? body.notes.trim() || null : null
    const servings = Number(body?.servings)
    const ingredients = parseIngredients(body?.ingredients)
    if (!name || name.length > 120 || !Number.isFinite(servings) || servings <= 0 || servings > 100 || !ingredients) {
      return NextResponse.json({ ok: false, error: 'Name, positive servings, and at least one valid ingredient are required' }, { status: 400 })
    }
    const recipe = await prisma.recipe.create({ data: { userId: user.id, name, notes, servings, ingredients, totals: totalsFor(ingredients) } })
    return NextResponse.json({ ok: true, recipe }, { status: 201 })
  } catch (error) {
    console.error('POST /api/nutrition/recipes error', error)
    return NextResponse.json({ ok: false, error: 'Unable to save recipe' }, { status: 500 })
  }
}

export { parseIngredients, totalsFor }
