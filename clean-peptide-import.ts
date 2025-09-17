import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';

const prisma = new PrismaClient();

// Map slugs to proper product names
const productNameMap: Record<string, string> = {
  'anxiety-depression-protocol-package': 'Anxiety & Depression Protocol Package',
  'blood-sugar-weight-reduction-package': 'Blood Sugar Support & Weight Reduction Package', 
  'body-recomposition-metabolic-health-package': 'Body Recomposition & Metabolic Health Package',
  'bpc157-tb500-5mg-5mg-combination': 'BPC-157 + TB-500 5mg/5mg Combination',
  'cjc1295-ipamorelin-5mg-5mg-combination-single-vial': 'CJC-1295 + Ipamorelin 5mg/5mg Combination',
  'dsip-2mg-single-vial': 'DSIP 2mg',
  'epitalon-20mg-single-vial': 'Epitalon 20mg',
  'ghk-cu-100mg-single-vial': 'GHK-Cu 100mg',
  'growth-hormone-anti-aging-protocol-package': 'Growth Hormone & Anti-Aging Protocol Package',
  'hair-growth-skin-health-protocol': 'Hair Growth & Skin Health Package',
  'hormone-balancing-protocol-package': 'Hormone Balancing Protocol Package',
  'joint-wound-healing-protocol-package': 'Joint & Wound Healing Protocol Package',
  'kisspeptin-10mg-single-vial': 'Kisspeptin 10mg',
  'mt2-10mg-single-vial': 'MT-2 (Melanotan II) 10mg',
  'nad-500mg-single-vial': 'NAD+ 500mg',
  'natural-energy-reset-protocol-package': 'Natural Energy Reset Protocol Package',
  'oral-bpc-157': 'Oral BPC-157',
  'organ-health-anti-aging-protocol-package': 'Organ Health & Anti-Aging Protocol Package',
  'prostamax-20mg-single-vial': 'Prostamax 20mg',
  'prostate-support-package': 'Prostate Support Package',
  'pt141-10mg-single-vial': 'PT-141 10mg',
  'retatrutide-10mg-single-vial': 'Retatrutide 10mg',
  'selank-10mg-vial': 'Selank 10mg',
  'semaglutide-10mg-single-vial': 'Semaglutide 10mg',
  'semax-30mg-single-vial': 'Semax 30mg',
  'sexual-enhancement-protocol-package': 'Sexual Enhancement Protocol Package',
  'tanning-sexual-benefits': 'Tanning & Sexual Benefits Package'
};

async function cleanImport() {
  try {
    console.log('🚀 Starting clean peptide import...\n');
    
    // Read the scraped data
    const rawData = await fs.readFile('cellularpeptide-final-data.json', 'utf-8');
    const peptides = JSON.parse(rawData);
    
    let imported = 0;
    let skipped = 0;
    
    for (const peptide of peptides) {
      try {
        // Skip non-peptide items
        if (peptide.slug.includes('syringe') || 
            peptide.slug.includes('alcohol-wipes') || 
            peptide.slug.includes('bacteriostatic-water') ||
            peptide.slug.includes('patient-brochure')) {
          console.log(`⏭️  Skipping: ${peptide.slug}`);
          skipped++;
          continue;
        }
        
        // Get proper name from map or generate from slug
        const properName = productNameMap[peptide.slug] || 
          peptide.slug
            .split('-')
            .map(word => {
              // Keep certain words uppercase
              if (['bpc', 'tb', 'cjc', 'ghk', 'cu', 'nad', 'mt2', 'pt', 'dsip'].includes(word.toLowerCase())) {
                return word.toUpperCase();
              }
              // Handle numbers with mg
              if (word.match(/^\d+mg$/)) {
                return word;
              }
              // Capitalize normally
              return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
        
        // Check if product exists
        const existing = await prisma.product.findUnique({
          where: { slug: peptide.slug }
        });
        
        const productData = {
          slug: peptide.slug,
          name: properName,
          description: peptide.description && peptide.description !== 'Skip to content' 
            ? peptide.description 
            : `${properName} - High-quality peptide for research and therapeutic applications.`,
          imageUrl: peptide.imageUrl && !peptide.imageUrl.includes('logo') 
            ? peptide.imageUrl 
            : `/images/peptides/${peptide.slug}.jpg`,
          active: true,
          storefront: true,
          metadata: {
            category: 'peptide',
            vialSize: properName.match(/(\d+mg)/)?.[1] || '',
            partnerPrice: peptide.partnerPrice || 0,
            retailPrice: peptide.retailPrice || 0,
            protocolInstructions: peptide.metadata?.protocolInstructions || {},
            educationalContent: peptide.metadata?.educationalContent || '',
            source: 'cellularpeptide.com',
            importDate: new Date().toISOString()
          }
        };
        
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: productData
          });
          
          // Update prices
          await prisma.price.deleteMany({
            where: { productId: existing.id }
          });
          
          if (peptide.retailPrice > 0) {
            await prisma.price.createMany({
              data: [
                {
                  productId: existing.id,
                  unitAmount: Math.round(peptide.retailPrice * 100),
                  currency: 'usd'
                },
                {
                  productId: existing.id,
                  unitAmount: Math.round(peptide.retailPrice * 0.85 * 100),
                  currency: 'usd',
                  interval: 'month'
                }
              ]
            });
          }
          
          console.log(`🔄 Updated: ${properName} - $${peptide.retailPrice}`);
        } else {
          const newProduct = await prisma.product.create({
            data: productData
          });
          
          if (peptide.retailPrice > 0) {
            await prisma.price.createMany({
              data: [
                {
                  productId: newProduct.id,
                  unitAmount: Math.round(peptide.retailPrice * 100),
                  currency: 'usd'
                },
                {
                  productId: newProduct.id,
                  unitAmount: Math.round(peptide.retailPrice * 0.85 * 100),
                  currency: 'usd',
                  interval: 'month'
                }
              ]
            });
          }
          
          console.log(`✅ Imported: ${properName} - $${peptide.retailPrice}`);
          imported++;
        }
        
      } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully imported ${imported} peptides`);
    console.log(`⏭️  Skipped ${skipped} non-peptide items`);
    
    const total = await prisma.product.count();
    console.log(`📦 Total products in database: ${total}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanImport();