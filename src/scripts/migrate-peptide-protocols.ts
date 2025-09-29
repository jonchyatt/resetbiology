// Migration script to add protocol data to existing products
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Protocol data from the hardcoded library
const protocolLibrary = [
  {
    name: "Ipamorelin",
    protocolPurpose: "Fat Loss",
    protocolDosageRange: "300mcg",
    protocolTiming: "PM (or AM - your choice)",
    protocolFrequency: "5 days on, 2 days off",
    protocolDuration: "8 weeks on, 8 weeks off",
    vialAmount: "10mg",
    reconstitutionInstructions: "3ml BAC water",
    syringeUnits: 9
  },
  {
    name: "Semaglutide",
    protocolPurpose: "Fat Loss",
    protocolDosageRange: "250mcg",
    protocolTiming: "AM",
    protocolFrequency: "Once per week",
    protocolDuration: "8 weeks on, 8 weeks off",
    vialAmount: "3mg",
    reconstitutionInstructions: "2ml BAC water",
    syringeUnits: 17
  },
  {
    name: "Tirzepatide",
    protocolPurpose: "Fat Loss",
    protocolDosageRange: "0.5mg",
    protocolTiming: "AM",
    protocolFrequency: "3x per week",
    protocolDuration: "8 weeks on, 8 weeks off or until goal weight",
    vialAmount: "10mg",
    reconstitutionInstructions: "2ml BAC water",
    syringeUnits: 10
  },
  {
    name: "Retatrutide",
    protocolPurpose: "Fat Loss",
    protocolDosageRange: "0.5mg-2.5mg",
    protocolTiming: "AM",
    protocolFrequency: "3x per week or every other day",
    protocolDuration: "8 weeks on, 8 weeks off or until goal weight",
    vialAmount: "10mg",
    reconstitutionInstructions: "2ml BAC water",
    syringeUnits: 10
  },
  {
    name: "BPC-157",
    matchPatterns: ["BPC", "BPC157"],
    protocolPurpose: "Healing",
    protocolDosageRange: "500mcg",
    protocolTiming: "AM & PM (twice daily)",
    protocolFrequency: "Daily",
    protocolDuration: "4-6 weeks",
    vialAmount: "10mg",
    reconstitutionInstructions: "3ml BAC water",
    syringeUnits: 10
  },
  {
    name: "TB-500",
    matchPatterns: ["TB500", "TB-500"],
    protocolPurpose: "Healing",
    protocolDosageRange: "500mcg",
    protocolTiming: "PM",
    protocolFrequency: "2x per week",
    protocolDuration: "4-6 weeks",
    vialAmount: "10mg",
    reconstitutionInstructions: "2ml BAC water",
    syringeUnits: 10
  },
  {
    name: "NAD+",
    matchPatterns: ["NAD"],
    protocolPurpose: "Longevity",
    protocolDosageRange: "1-2mg",
    protocolTiming: "AM",
    protocolFrequency: "Daily",
    protocolDuration: "Continuous",
    vialAmount: "100mg",
    reconstitutionInstructions: "10ml BAC water",
    syringeUnits: 30
  },
  {
    name: "CJC-1295",
    matchPatterns: ["CJC1295", "CJC-1295", "CJC"],
    protocolPurpose: "Performance",
    protocolDosageRange: "300mcg",
    protocolTiming: "PM (bedtime)",
    protocolFrequency: "Daily",
    protocolDuration: "8-12 weeks",
    vialAmount: "5mg",
    reconstitutionInstructions: "2ml BAC water",
    syringeUnits: 12
  },
  {
    name: "DSIP",
    protocolPurpose: "Sleep",
    protocolDosageRange: "200mcg",
    protocolTiming: "PM (bedtime)",
    protocolFrequency: "Daily",
    protocolDuration: "4-6 weeks",
    vialAmount: "2mg",
    reconstitutionInstructions: "2ml BAC water",
    syringeUnits: 20
  },
  {
    name: "PT-141",
    matchPatterns: ["PT141", "PT-141"],
    protocolPurpose: "Performance",
    protocolDosageRange: "1-2mg",
    protocolTiming: "2-4 hours before activity",
    protocolFrequency: "As needed",
    protocolDuration: "As needed",
    vialAmount: "10mg",
    reconstitutionInstructions: "2ml BAC water",
    syringeUnits: 20
  }
];

async function migrateProtocols() {
  console.log('🚀 Starting peptide protocol migration...\n');

  try {
    // Get all products from database
    const products = await prisma.product.findMany();
    console.log(`Found ${products.length} products in database\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      // Find matching protocol data
      const protocol = protocolLibrary.find(p => {
        // Check direct name match
        if (product.name.toLowerCase().includes(p.name.toLowerCase())) {
          return true;
        }
        // Check pattern matches
        if (p.matchPatterns) {
          return p.matchPatterns.some(pattern => 
            product.name.toLowerCase().includes(pattern.toLowerCase())
          );
        }
        return false;
      });

      if (protocol) {
        console.log(`✅ Updating ${product.name} with protocol data`);
        
        await prisma.product.update({
          where: { id: product.id },
          data: {
            isTrackable: true,
            protocolPurpose: protocol.protocolPurpose,
            protocolDosageRange: protocol.protocolDosageRange,
            protocolFrequency: protocol.protocolFrequency,
            protocolTiming: protocol.protocolTiming,
            protocolDuration: protocol.protocolDuration,
            vialAmount: protocol.vialAmount,
            reconstitutionInstructions: protocol.reconstitutionInstructions,
            syringeUnits: protocol.syringeUnits
          }
        });
        
        updatedCount++;
      } else {
        // Check if it's a known non-peptide product
        const nonPeptides = ['Syringe', 'Alcohol', 'Water', 'Brochure'];
        const isNonPeptide = nonPeptides.some(word => 
          product.name.includes(word)
        );
        
        if (!isNonPeptide) {
          console.log(`⚠️  No protocol found for: ${product.name}`);
        } else {
          console.log(`⏭️  Skipping non-peptide: ${product.name}`);
        }
        skippedCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Updated: ${updatedCount} products`);
    console.log(`⏭️  Skipped: ${skippedCount} products`);
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateProtocols().catch(console.error);