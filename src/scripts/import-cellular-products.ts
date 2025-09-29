// Import all CellularPeptide products to MongoDB
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function importProducts() {
  console.log('🚀 CELLULAR PEPTIDE PRODUCT IMPORT');
  console.log('=' .repeat(50));
  
  try {
    // Read the comprehensive product data with images
    const dataPath = path.join(process.cwd(), 'cellular-peptide-with-images.json');
    console.log('📖 Reading product data from:', dataPath);
    
    const fileContent = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(fileContent);
    
    console.log(`📊 Found ${data.products.length} products to import`);
    console.log(`📸 Images downloaded: ${data.imageDownload?.successfulDownloads || 0}`);
    
    // Clear existing products (optional - comment out if you want to keep existing)
    console.log('\n🗑️  Clearing existing products...');
    await prisma.price.deleteMany({});
    await prisma.product.deleteMany({});
    console.log('✅ Existing data cleared');
    
    let successCount = 0;
    let errorCount = 0;
    
    console.log('\n📥 Importing products...\n');
    
    for (const product of data.products) {
      try {
        console.log(`📦 ${product.name}`);
        
        // Create the product
        const createdProduct = await prisma.product.create({
          data: {
            slug: product.slug,
            name: product.name,
            description: product.description || product.name,
            imageUrl: product.localImageUrl 
              ? `/product-images/${product.localImageUrl}` 
              : product.imageUrl,
            
            // Additional images and media
            allImages: product.allImages || [],
            localImages: product.localImages?.map((img: string) => `/product-images/${img}`) || [],
            videos: product.videos || [],
            
            // Pricing
            partnerPrice: product.partnerPrice || 0,
            retailPrice: product.retailPrice || 0,
            
            // Protocol and dosage information
            protocolInfo: product.protocolInfo || {},
            educationalContent: product.educationalContent || [],
            learnMoreLinks: product.learnMoreLinks || [],
            
            // Product flags
            active: true,
            storefront: true,
            featured: false,
            category: product.metadata?.category || 'peptide',
            
            // Metadata
            metadata: {
              ...product.metadata,
              importedAt: new Date().toISOString(),
              source: 'cellularpeptide.com',
              hasProtocol: Object.keys(product.protocolInfo || {}).length > 0,
              hasEducationalContent: (product.educationalContent || []).length > 0,
              imageCount: product.metadata?.imageCount || 0,
              localImageCount: product.metadata?.localImageCount || 0
            },
            originalUrl: product.originalUrl
          }
        });
        
        // Create default price
        await prisma.price.create({
          data: {
            productId: createdProduct.id,
            label: 'Standard Price',
            unitAmount: Math.round((product.retailPrice || 0) * 100), // Convert to cents
            currency: 'usd',
            isPrimary: true,
            active: true
          }
        });
        
        // Skip product pages creation - model doesn't exist in schema
        // Educational content is stored in the product's metadata field
        
        console.log(`   ✅ Imported successfully`);
        console.log(`   💰 Price: $${product.partnerPrice} → $${product.retailPrice}`);
        console.log(`   📸 Images: ${product.localImages?.length || 0} local, ${product.allImages?.length || 0} total`);
        console.log(`   📋 Protocol: ${Object.keys(product.protocolInfo || {}).length} items`);
        
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Error importing ${product.name}:`, error);
        errorCount++;
      }
    }
    
    // Final summary
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 IMPORT COMPLETE!');
    console.log(`   ✅ Successfully imported: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    // Verify the import
    const productCount = await prisma.product.count();
    const priceCount = await prisma.price.count();
    
    console.log('\n📊 DATABASE VERIFICATION:');
    console.log(`   Products in database: ${productCount}`);
    console.log(`   Prices in database: ${priceCount}`);
    
    // Show sample products
    const sampleProducts = await prisma.product.findMany({
      take: 5,
      include: {
        prices: true
      }
    });
    
    console.log('\n📋 SAMPLE PRODUCTS:');
    for (const product of sampleProducts) {
      const price = product.prices[0];
      console.log(`   - ${product.name} (${product.slug})`);
      console.log(`     Price: $${price ? price.unitAmount / 100 : 0}`);
      console.log(`     Image: ${product.imageUrl}`);
    }
    
    console.log('\n🚀 Ready for Phase 3: Create Store Pages!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importProducts().catch(console.error);