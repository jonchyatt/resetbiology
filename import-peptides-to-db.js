const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function importPeptides() {
  try {
    console.log('📦 Starting peptide import to MongoDB...\n');
    
    // Read the scraped data
    const dataFile = path.join(__dirname, 'cellularpeptide-final-data.json');
    const rawData = await fs.readFile(dataFile, 'utf-8');
    const peptides = JSON.parse(rawData);
    
    console.log(`📊 Found ${peptides.length} peptides to import\n`);
    
    let imported = 0;
    let updated = 0;
    let errors = 0;
    
    for (const peptide of peptides) {
      try {
        // Skip non-peptide items
        if (peptide.name.includes('Syringe') || 
            peptide.name.includes('Alcohol Wipes') || 
            peptide.name.includes('Bacteriostatic Water') ||
            peptide.name.includes('Patient Brochure') ||
            peptide.name === 'Filter:') {
          console.log(`⏭️  Skipping non-peptide: ${peptide.name}`);
          continue;
        }
        
        // Fix names that got scraped incorrectly
        let name = peptide.name;
        if (name === 'More Protocol Information' || name === 'Filter:') {
          // Try to extract name from URL
          const urlName = peptide.slug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          name = urlName;
        }
        
        // Check if product already exists
        const existing = await prisma.product.findUnique({
          where: { slug: peptide.slug }
        });
        
        const productData = {
          slug: peptide.slug,
          name: name,
          description: peptide.description || `${name} - Premium quality peptide for research and therapeutic use.`,
          imageUrl: peptide.imageUrl || '/images/default-peptide.png',
          active: true,
          storefront: true,
          metadata: {
            category: 'peptide',
            vialSize: peptide.metadata.vialSize || '',
            originalPrice: peptide.partnerPrice,
            retailPrice: peptide.retailPrice,
            protocolInstructions: peptide.metadata.protocolInstructions || {},
            educationalContent: peptide.metadata.educationalContent || '',
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
          
          // Update prices
          await prisma.price.deleteMany({
            where: { productId: existing.id }
          });
          
          // Create new prices (one-time and subscription)
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
          
          console.log(`✅ Updated: ${name} - $${peptide.retailPrice}`);
          updated++;
        } else {
          // Create new product
          const newProduct = await prisma.product.create({
            data: productData
          });
          
          // Create prices
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
          
          console.log(`✅ Imported: ${name} - $${peptide.retailPrice}`);
          imported++;
        }
        
      } catch (error) {
        console.error(`❌ Error with ${peptide.name}: ${error.message}`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✅ Imported: ${imported} new products`);
    console.log(`🔄 Updated: ${updated} existing products`);
    console.log(`❌ Errors: ${errors}`);
    
    // Get total count
    const totalProducts = await prisma.product.count({
      where: {
        metadata: {
          path: ['category'],
          equals: 'peptide'
        }
      }
    });
    
    console.log(`📦 Total peptides in database: ${totalProducts}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importPeptides();