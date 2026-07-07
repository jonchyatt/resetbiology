// One-shot: expose hidden/evaluation surfaces in the Portal for Fable review.
// Idempotent: safe to re-run; upsert is keyed on slug.

import { prisma } from '../src/lib/prisma'

const modules = [
  {
    slug: 'meditation-visuals',
    label: 'Meditation Visuals',
    href: '/visuals/breathing',
    icon: 'Sparkles',
    colorFrom: 'from-violet-600/30',
    colorTo: 'to-sky-700/30',
    borderColor: 'border-violet-400/30',
    iconColor: 'text-violet-200',
    enabled: true,
    order: 6,
  },
  {
    slug: 'journal',
    label: 'Journal',
    href: '#journal',
    icon: 'BookOpen',
    colorFrom: 'from-secondary-600/30',
    colorTo: 'to-secondary-700/30',
    borderColor: 'border-secondary-400/30',
    iconColor: 'text-secondary-300',
    enabled: true,
    order: 7,
  },
  {
    slug: 'vision-training',
    label: 'Vision',
    href: '/vision-training',
    icon: 'Eye',
    colorFrom: 'from-cyan-600/30',
    colorTo: 'to-cyan-700/30',
    borderColor: 'border-cyan-400/30',
    iconColor: 'text-cyan-300',
    enabled: true,
    order: 8,
  },
  {
    slug: 'mental-training',
    label: 'Mental Training',
    href: '/mental-training',
    icon: 'Zap',
    colorFrom: 'from-pink-600/30',
    colorTo: 'to-pink-700/30',
    borderColor: 'border-pink-400/30',
    iconColor: 'text-pink-300',
    enabled: true,
    order: 9,
  },
  {
    slug: 'ear-training',
    label: 'Ear Training',
    href: '/ear-training',
    icon: 'Music',
    colorFrom: 'from-rose-600/30',
    colorTo: 'to-pink-700/30',
    borderColor: 'border-rose-400/30',
    iconColor: 'text-rose-300',
    enabled: true,
    order: 10,
  },
  {
    slug: 'voice-training',
    label: 'Voice Training',
    href: '/voice-training',
    icon: 'Music',
    colorFrom: 'from-fuchsia-600/30',
    colorTo: 'to-cyan-700/30',
    borderColor: 'border-fuchsia-400/30',
    iconColor: 'text-fuchsia-200',
    enabled: true,
    order: 11,
  },
  {
    slug: 'emotional-health',
    label: 'Emotional Health',
    href: 'https://woden.whatamiappreciatingnow.com/woden/change',
    icon: 'HeartPulse',
    colorFrom: 'from-amber-600/30',
    colorTo: 'to-rose-700/30',
    borderColor: 'border-amber-400/30',
    iconColor: 'text-amber-200',
    enabled: true,
    order: 12,
  },
  {
    slug: 'education',
    label: 'Education',
    href: '/education',
    icon: 'BookOpen',
    colorFrom: 'from-indigo-600/30',
    colorTo: 'to-indigo-700/30',
    borderColor: 'border-indigo-400/30',
    iconColor: 'text-indigo-300',
    enabled: true,
    order: 13,
  },
]

async function main() {
  for (const mod of modules) {
    await prisma.portalModule.upsert({
      where: { slug: mod.slug },
      update: mod,
      create: mod,
    })
  }

  const all = await prisma.portalModule.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
    select: { slug: true, label: true, href: true, order: true },
  })
  console.log(JSON.stringify(all, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
