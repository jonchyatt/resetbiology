// One-shot: re-add the Education tile to the portal_modules collection.
// Was removed at some point in favour of Mental Training; Jon wants both.
// Idempotent — safe to re-run (upsert keyed on slug).

import { prisma } from '../src/lib/prisma'

async function main() {
  const result = await prisma.portalModule.upsert({
    where: { slug: 'education' },
    update: {
      label: 'Education',
      href: '/education',
      icon: 'BookOpen',
      colorFrom: 'from-indigo-600/30',
      colorTo: 'to-indigo-700/30',
      borderColor: 'border-indigo-400/30',
      iconColor: 'text-indigo-300',
      enabled: true,
      order: 9,
    },
    create: {
      slug: 'education',
      label: 'Education',
      href: '/education',
      icon: 'BookOpen',
      colorFrom: 'from-indigo-600/30',
      colorTo: 'to-indigo-700/30',
      borderColor: 'border-indigo-400/30',
      iconColor: 'text-indigo-300',
      enabled: true,
      order: 9,
    },
  })
  console.log('Education tile upserted:', { id: result.id, slug: result.slug, order: result.order, enabled: result.enabled })

  const all = await prisma.portalModule.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
    select: { slug: true, label: true, order: true },
  })
  console.log('All enabled portal modules now:', all)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
