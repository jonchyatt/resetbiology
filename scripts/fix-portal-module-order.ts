// One-shot: align portal module ordering after surfacing the hidden Fable review areas.
// Idempotent.

import { prisma } from '../src/lib/prisma'

async function main() {
  const orderBySlug = [
    ['meditation-visuals', 6],
    ['journal', 7],
    ['vision-training', 8],
    ['mental-training', 9],
    ['ear-training', 10],
    ['voice-training', 11],
    ['emotional-health', 12],
    ['education', 13],
  ] as const

  for (const [slug, order] of orderBySlug) {
    await prisma.portalModule.update({ where: { slug }, data: { order } })
  }

  const all = await prisma.portalModule.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
    select: { slug: true, label: true, order: true },
  })
  console.log(all)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
