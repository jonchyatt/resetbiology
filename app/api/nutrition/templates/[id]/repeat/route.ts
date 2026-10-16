import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { journalEntryIdForDay } from '@/lib/journal/dayEntry'
import { getLocalDateTime, isLocalDate } from '@/lib/nutrition/localEntry'

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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  const requestId = typeof body?.requestId === 'string' && /^[a-f0-9]{24}$/.test(body.requestId) ? body.requestId : null
  const template = await prisma.mealTemplate.findFirst({ where: { id, userId: user.id } })
  if (!template) return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 })
  if (requestId) {
    const duplicate = await prisma.foodLog.findFirst({ where: { id: requestId, userId: user.id } })
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true, logId: duplicate.id, template })
  }
  const snapshot = template.ingredients as any
  const itemName = typeof body?.itemName === 'string' ? body.itemName.trim() : snapshot.itemName
  if (!itemName) return NextResponse.json({ ok: false, error: 'Template has no meal name' }, { status: 400 })
  const now = new Date()
  const requestedDate = typeof body?.localDate === 'string' && isLocalDate(body.localDate) ? body.localDate : getLocalDateTime(now).localDate
  const localTime = getLocalDateTime(now).localTime
  const nutrients = body?.nutrients && typeof body.nutrients === 'object' ? body.nutrients : snapshot.nutrients
  if (!nutrients || typeof nutrients !== 'object') return NextResponse.json({ ok: false, error: 'Template has no nutrition snapshot' }, { status: 400 })
  const logData: any = {
    ...(requestId ? { id: requestId } : {}), userId: user.id, source: 'meal-template', sourceId: template.id,
    itemName, brand: typeof body?.brand === 'string' ? body.brand.trim() : snapshot.brand ?? null,
    quantity: typeof body?.quantity === 'number' && body.quantity > 0 ? body.quantity : Number(snapshot.quantity) || 1,
    unit: typeof body?.unit === 'string' && body.unit.trim() ? body.unit.trim() : snapshot.unit || 'serving',
    gramWeight: typeof body?.gramWeight === 'number' ? body.gramWeight : snapshot.gramWeight ?? null,
    nutrients, notes: typeof body?.notes === 'string' ? body.notes.trim().slice(0, 1000) : template.notes ?? null,
    mealType: typeof body?.mealType === 'string' ? body.mealType : snapshot.mealType || 'snack',
    loggedAt: now, localDate: requestedDate, localTime,
  }
  try {
    const log = await prisma.foodLog.create({ data: logData, select: { id: true, itemName: true, localDate: true } })
    const journalId = journalEntryIdForDay(user.id, requestedDate)
    const journal = await prisma.journalEntry.findFirst({ where: { id: journalId, userId: user.id } })
    const note = `Meal repeated from template: ${itemName}`
    if (journal) {
      let entry: any = {}
      try { entry = journal.entry ? JSON.parse(journal.entry) : {} } catch { entry = {} }
      entry.nutritionNotes = entry.nutritionNotes ? `${entry.nutritionNotes}\n${note}` : note
      entry.tasksCompleted = { ...(entry.tasksCompleted || {}), meals: true }
      await prisma.journalEntry.update({ where: { id: journal.id }, data: { entry: JSON.stringify(entry), localDate: requestedDate } })
    } else {
      await prisma.journalEntry.create({ data: { id: journalId, userId: user.id, entry: JSON.stringify({ nutritionNotes: note, tasksCompleted: { meals: true } }), date: now, localDate: requestedDate } })
    }
    return NextResponse.json({ ok: true, logId: log.id, journalId, log })
  } catch (error: any) {
    if (requestId && String(error?.code) === 'P2002') return NextResponse.json({ ok: true, duplicate: true, logId: requestId, template })
    console.error('POST /api/nutrition/templates/[id]/repeat error', error)
    return NextResponse.json({ ok: false, error: 'Unable to repeat template' }, { status: 500 })
  }
}
