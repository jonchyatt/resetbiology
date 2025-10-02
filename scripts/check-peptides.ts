import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function checkPeptides() {
  try {
    console.log('Checking peptides in database...\n')

    const peptides = await prisma.peptide.findMany()

    if (peptides.length === 0) {
      console.log('❌ No peptides found in database!')
      console.log('Run: npx tsx scripts/seed-peptides.ts to seed the database')
    } else {
      console.log(`✅ Found ${peptides.length} peptides:`)
      peptides.forEach(p => {
        console.log(`  - ${p.name} (${p.category}) - ${p.dosage}`)
      })
    }

    // Check for protocols
    const protocols = await prisma.user_peptide_protocols.count()
    console.log(`\n📊 Total protocols in database: ${protocols}`)

    // Check for doses
    const doses = await prisma.peptide_doses.count()
    console.log(`💉 Total doses logged: ${doses}`)

  } catch (error) {
    console.error('Error checking peptides:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPeptides()