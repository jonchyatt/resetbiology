import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function seedPeptides() {
  const peptides = [
    {
      slug: 'semaglutide',
      name: 'Semaglutide',
      category: 'Fat Loss',
      dosage: '0.25mg',
      price: 299.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'bpc-157',
      name: 'BPC-157',
      category: 'Healing',
      dosage: '250mcg',
      price: 149.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'tb-500',
      name: 'TB-500',
      category: 'Healing',
      dosage: '2.5mg',
      price: 199.99,
      reconstitution: '3ml BAC water'
    },
    {
      slug: 'cjc-1295',
      name: 'CJC-1295',
      category: 'Growth',
      dosage: '2mg',
      price: 179.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'ipamorelin',
      name: 'Ipamorelin',
      category: 'Growth',
      dosage: '200mcg',
      price: 159.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'retatrutide',
      name: 'Retatrutide',
      category: 'Fat Loss',
      dosage: '2mg',
      price: 399.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'tirzepatide',
      name: 'Tirzepatide',
      category: 'Fat Loss',
      dosage: '2.5mg',
      price: 349.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'pt-141',
      name: 'PT-141',
      category: 'Libido',
      dosage: '1.75mg',
      price: 129.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'melanotan-ii',
      name: 'Melanotan II',
      category: 'Tanning',
      dosage: '0.5mg',
      price: 89.99,
      reconstitution: '2ml BAC water'
    },
    {
      slug: 'ghk-cu',
      name: 'GHK-Cu',
      category: 'Anti-Aging',
      dosage: '2mg',
      price: 189.99,
      reconstitution: '10ml BAC water'
    }
  ]

  console.log('🧪 Seeding peptides...')

  for (const peptide of peptides) {
    try {
      await prisma.peptide.upsert({
        where: { slug: peptide.slug },
        update: {
          name: peptide.name,
          dosage: peptide.dosage,
          price: peptide.price,
          category: peptide.category,
          reconstitution: peptide.reconstitution
        },
        create: peptide
      })
      console.log(`✅ ${peptide.name} added/updated`)
    } catch (error) {
      console.log(`❌ Error with ${peptide.name}:`, error)
    }
  }

  console.log('✨ Peptide seeding complete!')
}

seedPeptides()
  .catch(console.error)
  .finally(() => prisma.$disconnect())