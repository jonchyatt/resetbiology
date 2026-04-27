// One-shot: fix the duplicate order:8 between mental-training and ear-training,
// and slot Education at order:10 so the bottom row renders deterministically.
// Idempotent.

import { prisma } from '../src/lib/prisma'

async function main() {
  await prisma.portalModule.update({ where: { slug: 'mental-training' }, data: { order: 8 } })
  await prisma.portalModule.update({ where: { slug: 'ear-training' }, data: { order: 9 } })
  await prisma.portalModule.update({ where: { slug: 'education' }, data: { order: 10 } })

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
