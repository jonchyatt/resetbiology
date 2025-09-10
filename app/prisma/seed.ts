import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create TB-500 peptide
  const tb500 = await prisma.peptide.upsert({
    where: { slug: 'tb-500-5mg' },
    update: {},
    create: {
      slug: 'tb-500-5mg',
      name: 'TB-500 (Thymosin Beta-4)',
      dosage: '5mg',
      price: 85.00,
      originalUrl: 'https://www.elitebiogenix.com/tb-500-5mg',
      casNumber: '77591-33-4',
      molecularFormula: 'C212H350N56O78S',
      purity: '≥99%',
      halfLife: '4-6 hours',
      type: 'Synthetic peptide',
      classification: '43-amino acid peptide',
      
      // Research Information
      researchApplications: [
        'Wound healing and tissue repair studies',
        'Muscle injury recovery research',
        'Cardiovascular protection studies',
        'Anti-inflammatory response research',
        'Cell migration and differentiation studies'
      ],
      keyBenefits: [
        'Accelerated wound healing',
        'Enhanced muscle repair',
        'Improved flexibility and mobility',
        'Reduced inflammation',
        'Cardiovascular protection',
        'Hair growth stimulation'
      ],
      keyFeatures: [
        'High bioavailability',
        'Stable peptide structure',
        'Well-documented research profile',
        'Versatile research applications'
      ],
      mechanisms: [
        'Promotes actin upregulation',
        'Stimulates cell migration',
        'Enhances angiogenesis',
        'Modulates inflammatory response'
      ],
      
      // Physical Properties
      color: 'White to off-white lyophilized powder',
      sequence: 'Ac-Ser-Asp-Lys-Pro-Asp-Met-Ala-Glu-Ile-Glu-Lys-Phe-Asp-Lys-Ser-Lys-Leu-Lys-Lys-Thr-Glu-Thr-Gln-Glu-Lys-Asn-Pro-Leu-Pro-Ser-Lys-Glu-Thr-Ile-Glu-Gln-Glu-Lys-Gln-Ala-Gly-Glu-Ser',
      molecularWeight: '4963.44 g/mol',
      
      // Storage and Handling
      storage: 'Store at -20°C in a dry place. Protect from light. Stable for 2 years when stored properly.',
      reconstitution: 'Reconstitute with bacteriostatic water. Use 1-2mL for 5mg vial. Gently swirl, do not shake vigorously.',
      
      // Categorization
      category: 'Healing & Recovery',
      subcategory: 'Tissue Repair',
      
      // Metadata
      inStock: true,
      featured: true
    }
  })

  // Create education content for TB-500
  await prisma.peptideEducation.create({
    data: {
      peptideId: tb500.id,
      title: 'TB-500 Research Overview',
      content: `TB-500 is a synthetic version of Thymosin Beta-4, a naturally occurring peptide present in virtually all human and animal cells. This 43-amino acid peptide has been extensively studied for its wound healing and tissue repair properties.

**Research Applications:**
- Wound healing acceleration
- Muscle injury recovery
- Cardiovascular protection
- Anti-inflammatory effects
- Hair follicle development

**Mechanism of Action:**
TB-500 works primarily through the upregulation of actin, a protein that forms part of the cell's structural framework. This upregulation promotes cell migration, which is essential for wound healing, tissue building, and blood vessel development.

**Safety Profile:**
TB-500 has demonstrated a favorable safety profile in research studies, with minimal reported adverse effects when used appropriately in research settings.`,
      type: 'overview',
      displayOrder: 1,
      isPublished: true
    }
  })

  await prisma.peptideEducation.create({
    data: {
      peptideId: tb500.id,
      title: 'Research Protocols',
      content: `**Typical Research Dosages:**
- Standard protocol: 2-5mg per injection
- Frequency: 2-3 times per week
- Duration: 4-6 week cycles
- Administration: Subcutaneous or intramuscular

**Reconstitution Guidelines:**
1. Use bacteriostatic water for injection
2. Add 1-2mL slowly to the vial
3. Gently swirl to dissolve (do not shake)
4. Store reconstituted solution at 2-8°C
5. Use within 14 days of reconstitution

**Important Considerations:**
- Always use sterile technique
- Rotate injection sites
- Monitor for any adverse reactions
- Maintain proper storage conditions`,
      type: 'protocols',
      displayOrder: 2,
      isPublished: true
    }
  })

  console.log('✅ Database seeded successfully!')
  console.log(`Created peptide: ${tb500.name}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })