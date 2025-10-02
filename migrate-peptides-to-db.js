const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function migratePeptides() {
  console.log('Starting peptide migration to MongoDB...');

  try {
    // Load merged peptide data
    const peptideData = JSON.parse(fs.readFileSync('./src/data/peptides.json', 'utf8'));
    console.log(`Found ${peptideData.peptides.length} peptides to migrate`);

    // Clear existing peptides
    console.log('Clearing existing peptides...');
    await prisma.peptide.deleteMany({});

    // Transform JSON data to database format
    const peptides = peptideData.peptides.map(peptide => {
      return {
        slug: peptide.slug,
        name: peptide.name,
        dosage: extractDosage(peptide),
        price: peptide.retailPrice,
        originalUrl: peptide.sourceUrl || null,
        casNumber: null,
        molecularFormula: null,
        purity: null,
        halfLife: null,
        type: 'peptide',
        classification: peptide.category,
        researchApplications: peptide.benefits ? JSON.stringify(peptide.benefits) : null,
        keyBenefits: peptide.benefits ? JSON.stringify(peptide.benefits) : null,
        keyFeatures: null,
        mechanisms: null,
        researchDosage: peptide.protocolInstructions ? JSON.stringify(peptide.protocolInstructions) : null,
        researchProtocols: peptide.protocolInstructions ? JSON.stringify(peptide.protocolInstructions) : null,
        color: null,
        sequence: null,
        molecularWeight: extractMolecularWeight(peptide.vialSize),
        storage: extractStorage(peptide.protocolInstructions),
        reconstitution: peptide.protocolInstructions?.reconstitution || null,
        category: peptide.category || 'peptide',
        subcategory: extractSubcategory(peptide.name),
        inStock: peptide.inStock,
        featured: peptide.featured || false
      };
    });

    console.log('Inserting peptides into database...');
    
    // Insert peptides one by one to handle duplicates gracefully
    for (let i = 0; i < peptides.length; i++) {
      const peptide = peptides[i];
      try {
        await prisma.peptide.create({
          data: peptide
        });
        console.log(`✓ Inserted: ${peptide.name}`);
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`⚠ Skipped duplicate: ${peptide.name} (slug: ${peptide.slug})`);
        } else {
          console.error(`✗ Failed to insert ${peptide.name}:`, error.message);
        }
      }
    }

    // Verify migration
    const count = await prisma.peptide.count();
    console.log(`\n✅ Migration complete! ${count} peptides in database`);

    // Show sample data
    const samplePeptides = await prisma.peptide.findMany({
      take: 3,
      orderBy: { featured: 'desc' }
    });

    console.log('\nSample migrated peptides:');
    samplePeptides.forEach(p => {
      console.log(`- ${p.name} ($${p.price}) - ${p.featured ? 'Featured' : 'Standard'}`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function extractDosage(peptide) {
  if (peptide.protocolInstructions?.dosage && peptide.protocolInstructions.dosage !== 'Add To Cart') {
    return peptide.protocolInstructions.dosage;
  }
  if (peptide.vialSize) {
    return `Per vial: ${peptide.vialSize}`;
  }
  return null;
}

function extractMolecularWeight(vialSize) {
  if (vialSize && vialSize.includes('mg')) {
    const match = vialSize.match(/(\d+(?:\.\d+)?)\s*mg/);
    return match ? `${match[1]} mg` : null;
  }
  return null;
}

function extractStorage(protocolInstructions) {
  if (protocolInstructions?.reconstitution?.includes('freezer')) {
    return 'Store in freezer for up to 2 years';
  }
  return 'Store in refrigerator';
}

function extractSubcategory(name) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('package') || lowerName.includes('protocol')) {
    return 'protocol_package';
  }
  if (lowerName.includes('single') || lowerName.includes('vial')) {
    return 'single_vial';
  }
  if (lowerName.includes('syringe') || lowerName.includes('alcohol') || lowerName.includes('water')) {
    return 'supplies';
  }
  
  return 'peptide';
}

// Run migration
migratePeptides().catch(console.error);