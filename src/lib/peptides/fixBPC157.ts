import { prisma } from '../prisma';

async function fixBPC157() {
  try {
    const bpc157 = await prisma.peptide.create({
      data: {
        slug: 'bpc-157-5mg-10mg',
        name: 'BPC-157',
        dosage: '5mg & 10mg',
        price: 54.99,
        originalUrl: 'https://elitebiogenix.com/product/bpc-157-5mg-10mg/',
        casNumber: '137525-51-0',
        purity: '≥99%',
        researchApplications: [
          'Musculoskeletal tissue regeneration',
          'Gastrointestinal system protection',
          'Neurological protection & repair'
        ],
        keyBenefits: [],
        keyFeatures: [],
        mechanisms: [],
        researchDosage: {},
        researchProtocols: {},
        sequence: 'Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val',
        storage: 'Lyophilized 24 months at -20°C, reconstituted 7 days at 4°C',
        reconstitution: '5mg vial: Add 2.5mL (2mg/mL), 10mg vial: Add 5mL (2mg/mL)',
        category: 'Healing & Recovery',
        featured: true,
        inStock: true,
      },
    });
    
    console.log('✓ Successfully created BPC-157:', bpc157.name);
  } catch (error) {
    console.error('Error creating BPC-157:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBPC157();