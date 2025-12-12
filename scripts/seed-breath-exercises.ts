/**
 * Seed script for predefined breath exercises
 * Run with: npx ts-node scripts/seed-breath-exercises.ts
 * Or: npx tsx scripts/seed-breath-exercises.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BREATH_EXERCISES = [
  {
    name: 'Autophagy/VO2-max Builder',
    slug: 'autophagy-vo2max',
    description: 'The signature Reset Biology protocol. 40 deep breaths followed by exhale and inhale holds. Stimulates autophagy better than HIIT while boosting growth hormone. The go-to for weight loss and reducing loose skin.',
    category: 'performance',
    inhaleMs: 3000,
    exhaleMs: 3000,
    inhaleHoldMs: 0,  // User-controlled holds
    exhaleHoldMs: 0,  // User-controlled holds
    breathsPerCycle: 40,
    cyclesTarget: 3,
    postCycleExhaleHoldMs: 0,  // User-controlled
    postCycleInhaleHoldMs: 0,  // User-controlled
    isSample: false,
    isActive: true,
    sortOrder: 0  // First in list - primary protocol
  },
  {
    name: 'Vagal Reset',
    slug: 'vagal-reset',
    description: 'Stimulate the vagus nerve to calm your nervous system. Extended exhales activate the parasympathetic response for deep relaxation.',
    category: 'vagal',
    inhaleMs: 4000,
    exhaleMs: 8000,  // 4-8 pattern for vagal stimulation
    inhaleHoldMs: 0,
    exhaleHoldMs: 0,
    breathsPerCycle: 6,
    cyclesTarget: 3,
    postCycleExhaleHoldMs: 15000,  // 15 second exhale hold between cycles
    postCycleInhaleHoldMs: 0,
    isSample: false,
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Deep Relaxation',
    slug: 'deep-relaxation',
    description: 'A gentle breathing pattern designed to reduce stress and promote calm. Perfect for winding down before sleep or after a stressful day.',
    category: 'relaxation',
    inhaleMs: 4000,
    exhaleMs: 6000,  // Slightly longer exhale
    inhaleHoldMs: 2000,
    exhaleHoldMs: 0,
    breathsPerCycle: 8,
    cyclesTarget: 3,
    postCycleExhaleHoldMs: 0,
    postCycleInhaleHoldMs: 0,
    isSample: false,
    isActive: true,
    sortOrder: 2
  },
  {
    name: '4-7-8 Sleep Breath',
    slug: '4-7-8-sleep',
    description: 'The famous Dr. Weil sleep breathing technique. Inhale for 4, hold for 7, exhale for 8. Excellent for falling asleep quickly.',
    category: 'relaxation',
    inhaleMs: 4000,
    exhaleMs: 8000,
    inhaleHoldMs: 7000,
    exhaleHoldMs: 0,
    breathsPerCycle: 4,
    cyclesTarget: 3,
    postCycleExhaleHoldMs: 0,
    postCycleInhaleHoldMs: 0,
    isSample: false,
    isActive: true,
    sortOrder: 3
  },
  {
    name: 'Box Breathing',
    slug: 'box-breathing',
    description: 'Used by Navy SEALs for stress management. Equal parts inhale, hold, exhale, hold creates balance and mental clarity.',
    category: 'relaxation',
    inhaleMs: 4000,
    exhaleMs: 4000,
    inhaleHoldMs: 4000,
    exhaleHoldMs: 4000,
    breathsPerCycle: 6,
    cyclesTarget: 4,
    postCycleExhaleHoldMs: 0,
    postCycleInhaleHoldMs: 0,
    isSample: false,
    isActive: true,
    sortOrder: 4
  },
  {
    name: 'Energizing Breath',
    slug: 'energizing-breath',
    description: 'Quick, stimulating breathing pattern to boost energy and alertness. Great for morning or when you need a natural energy boost.',
    category: 'energizing',
    inhaleMs: 2000,
    exhaleMs: 2000,
    inhaleHoldMs: 0,
    exhaleHoldMs: 0,
    breathsPerCycle: 20,
    cyclesTarget: 3,
    postCycleExhaleHoldMs: 10000,  // Recovery hold
    postCycleInhaleHoldMs: 5000,
    isSample: false,
    isActive: true,
    sortOrder: 5
  },
  {
    name: 'Quick Calm',
    slug: 'quick-calm-sample',
    description: 'A 2-minute breathing exercise to quickly reduce stress. Try it now - no signup required!',
    category: 'sample',
    inhaleMs: 4000,
    exhaleMs: 6000,
    inhaleHoldMs: 0,
    exhaleHoldMs: 0,
    breathsPerCycle: 6,
    cyclesTarget: 1,  // Just one cycle for the sample
    postCycleExhaleHoldMs: 0,
    postCycleInhaleHoldMs: 0,
    isSample: true,  // This will show on the hero page
    isActive: true,
    sortOrder: 0  // First in sort order since it's the sample
  }
]

async function main() {
  console.log('Seeding breath exercises...')

  for (const exercise of BREATH_EXERCISES) {
    const existing = await prisma.breathExercise.findUnique({
      where: { slug: exercise.slug }
    })

    if (existing) {
      console.log(`Updating: ${exercise.name}`)
      await prisma.breathExercise.update({
        where: { slug: exercise.slug },
        data: exercise
      })
    } else {
      console.log(`Creating: ${exercise.name}`)
      await prisma.breathExercise.create({
        data: exercise
      })
    }
  }

  console.log('Done! Seeded', BREATH_EXERCISES.length, 'breath exercises')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
