import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const modules = [
  {
    slug: 'peptides',
    label: 'Peptides',
    href: '/peptides',
    icon: 'Target',
    colorFrom: 'from-teal-600/30',
    colorTo: 'to-teal-700/30',
    borderColor: 'border-teal-400/30',
    iconColor: 'text-teal-300',
    enabled: true,
    order: 1,
  },
  {
    slug: 'workout',
    label: 'Workout',
    href: '/workout',
    icon: 'Dumbbell',
    colorFrom: 'from-green-600/30',
    colorTo: 'to-green-700/30',
    borderColor: 'border-green-400/30',
    iconColor: 'text-green-300',
    enabled: true,
    order: 2,
  },
  {
    slug: 'nutrition',
    label: 'Nutrition',
    href: '/nutrition',
    icon: 'Apple',
    colorFrom: 'from-amber-600/30',
    colorTo: 'to-amber-700/30',
    borderColor: 'border-amber-400/30',
    iconColor: 'text-amber-300',
    enabled: true,
    order: 3,
  },
  {
    slug: 'modules',
    label: 'Modules',
    href: '/modules',
    icon: 'Brain',
    colorFrom: 'from-purple-600/30',
    colorTo: 'to-purple-700/30',
    borderColor: 'border-purple-400/30',
    iconColor: 'text-purple-300',
    enabled: true,
    order: 4,
  },
  {
    slug: 'breath',
    label: 'Breathe',
    href: '/breath',
    icon: 'Wind',
    colorFrom: 'from-blue-600/30',
    colorTo: 'to-blue-700/30',
    borderColor: 'border-blue-400/30',
    iconColor: 'text-blue-300',
    enabled: true,
    order: 5,
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
    order: 6,
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
    order: 7,
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
    enabled: false,
    order: 8,
  },
]

async function main() {
  console.log('Seeding portal modules...')

  for (const mod of modules) {
    await prisma.portalModule.upsert({
      where: { slug: mod.slug },
      update: mod,
      create: mod,
    })
    console.log(`  ${mod.enabled ? '✓' : '○'} ${mod.label} (${mod.slug})`)
  }

  console.log(`\nDone! ${modules.length} modules seeded.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
