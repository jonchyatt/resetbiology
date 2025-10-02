const fs = require('fs');

// Load both data sources
const currentData = JSON.parse(fs.readFileSync('./src/data/peptides.json', 'utf8'));
const scrapedData = JSON.parse(fs.readFileSync('./cellularpeptide-final-data.json', 'utf8'));

console.log('Current data:', currentData.peptides.length, 'peptides');
console.log('Scraped data:', scrapedData.length, 'peptides');

// Create a map of existing peptides by slug
const existingPeptides = new Map();
currentData.peptides.forEach(peptide => {
  existingPeptides.set(peptide.slug, peptide);
});

// Helper function to clean and fix data
function cleanPeptideData(scrapedPeptide, existingPeptide) {
  // Use existing name if scraped name is placeholder
  const name = (scrapedPeptide.name === "More Protocol Information" || scrapedPeptide.name === "Filter:")
    ? (existingPeptide?.name || generateNameFromSlug(scrapedPeptide.slug))
    : scrapedPeptide.name;

  // Fix pricing - use scraped if reasonable, otherwise use existing
  const partnerPrice = scrapedPeptide.partnerPrice > 5 ? scrapedPeptide.partnerPrice : (existingPeptide?.partnerPrice || scrapedPeptide.partnerPrice);
  const retailPrice = partnerPrice * 1.5; // Apply 50% markup

  // Clean protocol instructions
  const protocolInstructions = cleanProtocolInstructions(
    scrapedPeptide.metadata?.protocolInstructions || {},
    existingPeptide?.protocolInstructions || {}
  );

  // Merge educational content
  const educationalContent = scrapedPeptide.metadata?.educationalContent || existingPeptide?.educationalContent || '';

  // Extract vial size from name or existing data
  const vialSize = extractVialSize(name) || existingPeptide?.vialSize || scrapedPeptide.metadata?.vialSize || '';

  return {
    id: scrapedPeptide.slug,
    slug: scrapedPeptide.slug,
    name: name,
    description: scrapedPeptide.description || existingPeptide?.description || `${name} - Premium quality peptide`,
    imageUrl: scrapedPeptide.imageUrl || existingPeptide?.imageUrl || '',
    category: scrapedPeptide.metadata?.category || existingPeptide?.category || 'peptide',
    partnerPrice: partnerPrice,
    retailPrice: retailPrice,
    subscriptionPrice: parseFloat((retailPrice * 0.85).toFixed(2)), // 15% discount
    vialSize: vialSize,
    inStock: scrapedPeptide.active !== false,
    featured: existingPeptide?.featured || false,
    protocolInstructions: protocolInstructions,
    educationalContent: educationalContent.substring(0, 2000), // Limit length
    sourceUrl: scrapedPeptide.url || existingPeptide?.sourceUrl || '',
    benefits: existingPeptide?.benefits || generateBenefits(name),
    usage: cleanUsage(scrapedPeptide.metadata?.usage || existingPeptide?.usage || '')
  };
}

function generateNameFromSlug(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractVialSize(name) {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|iu)/i);
  return match ? match[0] : '';
}

function cleanProtocolInstructions(scraped, existing) {
  const cleaned = { ...existing };
  
  // Only use scraped data if it's meaningful
  if (scraped.reconstitution && scraped.reconstitution !== 'Syringes') {
    cleaned.reconstitution = scraped.reconstitution;
  }
  if (scraped.protocolLength && !scraped.protocolLength.includes('Add To Cart')) {
    cleaned.protocolLength = scraped.protocolLength;
  }
  if (scraped.dosage && scraped.dosage !== 'Add To Cart') {
    cleaned.dosage = scraped.dosage;
  }
  if (scraped.timing) {
    cleaned.timing = scraped.timing;
  }

  return cleaned;
}

function cleanUsage(usage) {
  if (usage === 'Add To Cart' || !usage) {
    return 'Follow protocol instructions';
  }
  return usage;
}

function generateBenefits(name) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('bpc') || lowerName.includes('wound') || lowerName.includes('healing')) {
    return ['Accelerated wound healing', 'Joint and muscle recovery', 'Gut health support'];
  }
  if (lowerName.includes('tb-500') || lowerName.includes('tb500')) {
    return ['Muscle recovery', 'Injury healing', 'Anti-inflammatory'];
  }
  if (lowerName.includes('semaglutide') || lowerName.includes('weight') || lowerName.includes('blood sugar')) {
    return ['Weight management', 'Blood sugar support', 'Appetite control'];
  }
  if (lowerName.includes('retatrutide') || lowerName.includes('metabolic')) {
    return ['Metabolic health', 'Body composition', 'Weight management'];
  }
  if (lowerName.includes('energy') || lowerName.includes('dsip')) {
    return ['Energy support', 'Sleep quality', 'Recovery enhancement'];
  }
  if (lowerName.includes('prostate')) {
    return ['Prostate health', 'Hormonal support', 'Men\'s wellness'];
  }
  
  return ['Research purposes', 'Therapeutic applications'];
}

// Merge all peptides
const mergedPeptides = [];
const processedSlugs = new Set();

// Process scraped data first (most up-to-date)
scrapedData.forEach(scrapedPeptide => {
  if (scrapedPeptide.slug && !processedSlugs.has(scrapedPeptide.slug)) {
    const existingPeptide = existingPeptides.get(scrapedPeptide.slug);
    const cleanedPeptide = cleanPeptideData(scrapedPeptide, existingPeptide);
    mergedPeptides.push(cleanedPeptide);
    processedSlugs.add(scrapedPeptide.slug);
  }
});

// Add any existing peptides that weren't in scraped data
currentData.peptides.forEach(peptide => {
  if (!processedSlugs.has(peptide.slug)) {
    mergedPeptides.push(peptide);
    processedSlugs.add(peptide.slug);
  }
});

// Sort by featured status and name
mergedPeptides.sort((a, b) => {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  return a.name.localeCompare(b.name);
});

// Create output
const output = {
  peptides: mergedPeptides,
  metadata: {
    lastUpdated: new Date().toISOString(),
    totalPeptides: mergedPeptides.length,
    dataSources: ['cellularpeptide.com', 'manual_curation'],
    mergeStrategy: 'scraped_data_priority_with_existing_fallback'
  }
};

// Write merged data
fs.writeFileSync('./src/data/peptides-merged.json', JSON.stringify(output, null, 2));

console.log('Merged data written to peptides-merged.json');
console.log('Total peptides:', mergedPeptides.length);
console.log('Sample of cleaned data:');
console.log(mergedPeptides.slice(0, 3).map(p => ({
  name: p.name,
  price: p.retailPrice,
  hasProtocol: Object.keys(p.protocolInstructions).length > 0,
  hasEducation: p.educationalContent.length > 0
})));