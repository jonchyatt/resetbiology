import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function importPeptides() {
  try {
    console.log('📦 Starting peptide import to MongoDB...\n');
    
    // Read the scraped data
    const dataFile = path.join(process.cwd(), 'cellularpeptide-final-data.json');
    const rawData = await fs.readFile(dataFile, 'utf-8');
    const peptides = JSON.parse(rawData);
    
    console.log(`📊 Found ${peptides.length} peptides to import\n`);
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const peptide of peptides) {
      try {
        // Skip non-peptide items
        const skipItems = ['Syringe', 'Alcohol Wipes', 'Bacteriostatic Water', 'Patient Brochure', 'Filter:'];
        if (skipItems.some(item => peptide.name.includes(item))) {
          console.log(`⏭️  Skipping non-peptide: ${peptide.name}`);
          skipped++;
          continue;
        }
        
        // Fix names that got scraped incorrectly
        let name = peptide.name;
        if (name === 'More Protocol Information' || name === 'Filter:' || name === '') {
          // Try to extract name from slug
          name = peptide.slug
            .split('-')
            .map(word => {
              // Keep common abbreviations uppercase
              if (['bpc', 'tb', 'cjc', 'ghk', 'cu', 'nad', 'mt2', 'pt'].includes(word.toLowerCase())) {
                return word.toUpperCase();
              }
              // Keep numbers as is
              if (/^\d+/.test(word)) {
                return word;
              }
              // Capitalize first letter
              return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
        }
        
        // Check if product already exists
        const existing = await prisma.product.findUnique({
          where: { slug: peptide.slug }
        });
        
        const productData = {
          slug: peptide.slug,
          name: name,
          description: peptide.description || `${name} - Premium quality peptide for research and therapeutic use.`,
          imageUrl: peptide.imageUrl || '/images/peptides/default.jpg',
          active: true,
          storefront: true,
          metadata: {
            category: 'peptide',
            vialSize: peptide.metadata?.vialSize || '',
            originalPrice: peptide.partnerPrice || 0,
            retailPrice: peptide.retailPrice || 0,
            protocolInstructions: peptide.metadata?.protocolInstructions || {},
            educationalContent: peptide.metadata?.educationalContent || '',
            source: 'cellularpeptide.com',
            importDate: new Date().toISOString()
          }
        };
        
        if (existing) {
          // Update existing product
          await prisma.product.update({
            where: { id: existing.id },
            data: productData
          });
          
          // Delete old prices
          await prisma.price.deleteMany({
            where: { productId: existing.id }
          });
          
          // Create new prices
          if (peptide.retailPrice > 0) {
            await prisma.price.createMany({
              data: [
                {
                  productId: existing.id,
                  unitAmount: Math.round(peptide.retailPrice * 100), // Convert to cents
                  currency: 'usd',
                  interval: null // One-time purchase
                },
                {
                  productId: existing.id,
                  unitAmount: Math.round(peptide.retailPrice * 0.85 * 100), // 15% discount for subscription
                  currency: 'usd',
                  interval: 'month' // Monthly subscription
                }
              ]
            });
          }
          
          console.log(`🔄 Updated: ${name} - $${peptide.retailPrice}`);
          updated++;
        } else {
          // Create new product
          const newProduct = await prisma.product.create({
            data: productData
          });
          
          // Create prices
          if (peptide.retailPrice > 0) {
            await prisma.price.createMany({
              data: [
                {
                  productId: newProduct.id,
                  unitAmount: Math.round(peptide.retailPrice * 100),
                  currency: 'usd',
                  interval: null
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
          
          console.log(`✅ Imported: ${name} - $${peptide.retailPrice}`);
          imported++;
        }
        
      } catch (error: any) {
        console.error(`❌ Error with ${peptide.name}: ${error.message}`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✅ Imported: ${imported} new products`);
    console.log(`🔄 Updated: ${updated} existing products`);
    console.log(`⏭️  Skipped: ${skipped} non-peptide items`);
    console.log(`❌ Errors: ${errors}`);
    
    // Get total count of peptides
    const totalProducts = await prisma.product.count({
      where: {
        storefront: true,
        active: true
      }
    });
    
    console.log(`\n📦 Total products in database: ${totalProducts}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importPeptides();