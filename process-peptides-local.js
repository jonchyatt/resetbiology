const fs = require('fs').promises;
const path = require('path');

// Map slugs to proper product names
const productNameMap = {
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
  'semaglutide-10mg-single-vial': 'Semaglutide (GLP-1) 10mg',
  'semax-30mg-single-vial': 'Semax 30mg',
  'sexual-enhancement-protocol-package': 'Sexual Enhancement Protocol Package',
  'tanning-sexual-benefits': 'Tanning & Sexual Benefits Package'
};

async function processAndSavePeptides() {
  try {
    console.log('📦 Processing peptides for local storage...\n');
    
    // Read the scraped data
    const rawData = await fs.readFile('cellularpeptide-final-data.json', 'utf-8');
    const scrapedPeptides = JSON.parse(rawData);
    
    const processedPeptides = [];
    
    for (const peptide of scrapedPeptides) {
      // Skip non-peptide items
      if (peptide.slug.includes('syringe') || 
          peptide.slug.includes('alcohol-wipes') || 
          peptide.slug.includes('bacteriostatic-water') ||
          peptide.slug.includes('patient-brochure') ||
          peptide.slug.includes('injection')) {
        console.log(`⏭️  Skipping: ${peptide.slug}`);
        continue;
      }
      
      // Get proper name
      const properName = productNameMap[peptide.slug] || 
        peptide.slug
          .split('-')
          .map(word => {
            if (['bpc', 'tb', 'cjc', 'ghk', 'cu', 'nad', 'mt2', 'pt', 'dsip', 'glp'].includes(word.toLowerCase())) {
              return word.toUpperCase();
            }
            if (word.match(/^\d+mg$/)) {
              return word;
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
          })
          .join(' ');
      
      // Create clean product object
      const cleanProduct = {
        id: peptide.slug, // Use slug as ID for now
        slug: peptide.slug,
        name: properName,
        description: peptide.description && peptide.description !== 'Skip to content' 
          ? peptide.description 
          : `${properName} - Premium quality peptide for research and therapeutic applications.`,
        imageUrl: peptide.imageUrl && !peptide.imageUrl.includes('logo') 
          ? peptide.imageUrl 
          : `/images/peptides/default.jpg`,
        category: 'peptide',
        partnerPrice: peptide.partnerPrice || 0,
        retailPrice: peptide.retailPrice || 0,
        subscriptionPrice: Math.round((peptide.retailPrice || 0) * 0.85 * 100) / 100, // 15% discount
        vialSize: properName.match(/(\d+mg)/)?.[1] || '',
        inStock: true,
        featured: peptide.retailPrice > 100, // Feature more expensive items
        protocolInstructions: peptide.metadata?.protocolInstructions || {},
        educationalContent: peptide.metadata?.educationalContent || '',
        sourceUrl: peptide.url,
        benefits: generateBenefits(properName, peptide.slug),
        usage: generateUsage(properName, peptide.metadata?.protocolInstructions)
      };
      
      processedPeptides.push(cleanProduct);
      console.log(`✅ Processed: ${properName} - $${peptide.retailPrice}`);
    }
    
    // Sort by price (high to low)
    processedPeptides.sort((a, b) => b.retailPrice - a.retailPrice);
    
    // Create the final data structure
    const peptideData = {
      peptides: processedPeptides,
      totalCount: processedPeptides.length,
      lastUpdated: new Date().toISOString(),
      source: 'cellularpeptide.com',
      categories: [...new Set(processedPeptides.map(p => p.category))],
      priceRange: {
        min: Math.min(...processedPeptides.map(p => p.retailPrice)),
        max: Math.max(...processedPeptides.map(p => p.retailPrice))
      }
    };
    
    // Save to src/data directory
    const outputPath = path.join('src', 'data', 'peptides.json');
    await fs.writeFile(outputPath, JSON.stringify(peptideData, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ LOCAL STORAGE COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 Total peptides: ${processedPeptides.length}`);
    console.log(`💰 Price range: $${peptideData.priceRange.min} - $${peptideData.priceRange.max}`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log('\n📦 Top 5 Products:');
    processedPeptides.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name}: $${p.retailPrice}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Generate benefits based on product name
function generateBenefits(name, slug) {
  const benefits = [];
  
  if (name.includes('BPC') || slug.includes('bpc')) {
    benefits.push('Accelerated wound healing', 'Joint and muscle recovery', 'Gut health support');
  }
  if (name.includes('TB-500') || slug.includes('tb500')) {
    benefits.push('Tissue repair', 'Reduced inflammation', 'Improved flexibility');
  }
  if (name.includes('Semaglutide') || slug.includes('semaglutide')) {
    benefits.push('Weight management', 'Blood sugar control', 'Appetite regulation');
  }
  if (name.includes('CJC') || name.includes('Ipamorelin')) {
    benefits.push('Growth hormone optimization', 'Improved sleep quality', 'Enhanced recovery');
  }
  if (name.includes('NAD')) {
    benefits.push('Cellular energy production', 'Anti-aging support', 'Cognitive enhancement');
  }
  if (name.includes('PT-141')) {
    benefits.push('Enhanced libido', 'Improved sexual function', 'Increased arousal');
  }
  if (name.includes('Semax') || name.includes('Selank')) {
    benefits.push('Cognitive enhancement', 'Mood improvement', 'Neuroprotection');
  }
  if (name.includes('GHK')) {
    benefits.push('Skin rejuvenation', 'Collagen production', 'Anti-inflammatory effects');
  }
  
  return benefits.length > 0 ? benefits : ['Research purposes', 'Therapeutic applications'];
}

// Generate usage instructions
function generateUsage(name, protocol) {
  if (protocol?.dosage) {
    return protocol.dosage;
  }
  
  // Default usage based on product type
  if (name.includes('Oral')) {
    return 'Take as directed, typically 1-2 capsules daily';
  }
  if (name.includes('Package')) {
    return 'Follow the complete protocol instructions included with the package';
  }
  
  return 'Reconstitute with bacteriostatic water as directed. Follow dosing protocol.';
}

// Run the processor
processAndSavePeptides();