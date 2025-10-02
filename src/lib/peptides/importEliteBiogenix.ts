import { prisma } from '../prisma';
import catalog from '../../data/peptides/elite-biogenix-catalog.json';

interface EliteBiogenixPeptide {
  id: string;
  name: string;
  dosage?: string;
  price: number;
  url: string;
  casNumber?: string;
  molecularFormula?: string;
  purity?: string;
  halfLife?: string;
  type?: string;
  classification?: string;
  researchApplications?: string[];
  keyBenefits?: string[];
  keyFeatures?: string[];
  mechanisms?: string[];
  researchDosage?: any;
  researchProtocols?: any;
  color?: string;
  sequence?: string;
  molecularWeight?: string;
  storage?: string;
  reconstitution?: string;
  category: string;
  [key: string]: any;
}

function createSlug(name: string, dosage?: string): string {
  const base = name.toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove multiple consecutive hyphens
    .trim();
  
  if (dosage) {
    const dosageSlug = dosage.toLowerCase().replace(/[^\w]/g, '');
    return `${base}-${dosageSlug}`;
  }
  
  return base;
}

export async function importEliteBiogenixPeptides() {
  console.log('Starting Elite Biogenix peptide import...');
  
  let importedCount = 0;
  let errorCount = 0;
  
  // Import categories first
  const categoryMap: Record<string, string> = {
    'glp1_metabolic': 'Weight Loss & Metabolic',
    'growth_hormone': 'Growth Hormone',
    'regenerative': 'Healing & Recovery',
    'neurological': 'Neurological & Cognitive',
    'anti_aging': 'Anti-Aging & Longevity',
    'hormone_regulation': 'Hormone & Sexual Health',
    'specialized': 'Anti-Inflammatory'
  };
  
  // Create categories
  for (const [slug, name] of Object.entries(categoryMap)) {
    try {
      await prisma.peptide_categories.upsert({
        where: { slug },
        update: { name },
        create: {
          id: slug, // Use slug as ID since it's unique
          name,
          slug,
          description: `Research peptides in the ${name} category`,
          displayOrder: Object.keys(categoryMap).indexOf(slug),
        },
      });
      console.log(`✓ Category: ${name}`);
    } catch (error) {
      console.error(`✗ Error creating category ${name}:`, error);
    }
  }
  
  // Import peptides from each category
  for (const [categoryKey, peptides] of Object.entries(catalog.categories)) {
    const categoryName = categoryMap[categoryKey] || 'Specialized';
    
    for (const peptideData of peptides as EliteBiogenixPeptide[]) {
      try {
        const slug = createSlug(peptideData.name, peptideData.dosage);
        
        const peptide = await prisma.peptide.upsert({
          where: { slug },
          update: {
            name: peptideData.name,
            dosage: peptideData.dosage,
            price: peptideData.price,
            originalUrl: peptideData.url,
            casNumber: peptideData.casNumber,
            molecularFormula: peptideData.molecularFormula,
            purity: peptideData.purity,
            halfLife: peptideData.halfLife,
            type: peptideData.type,
            classification: peptideData.classification,
            researchApplications: peptideData.researchApplications || [],
            keyBenefits: peptideData.keyBenefits || [],
            keyFeatures: peptideData.keyFeatures || [],
            mechanisms: peptideData.mechanisms || [],
            researchDosage: peptideData.researchDosage || {},
            researchProtocols: peptideData.researchProtocols || {},
            color: peptideData.color,
            sequence: peptideData.sequence,
            molecularWeight: peptideData.molecularWeight,
            storage: peptideData.storage,
            reconstitution: peptideData.reconstitution,
            category: categoryName,
            subcategory: peptideData.subcategory,
            featured: ['Retatrutide', 'Semaglutide', 'BPC-157', 'TB-500'].includes(peptideData.name),
            updatedAt: new Date(),
          },
          create: {
            slug,
            name: peptideData.name,
            dosage: peptideData.dosage,
            price: peptideData.price,
            originalUrl: peptideData.url,
            casNumber: peptideData.casNumber,
            molecularFormula: peptideData.molecularFormula,
            purity: peptideData.purity,
            halfLife: peptideData.halfLife,
            type: peptideData.type,
            classification: peptideData.classification,
            researchApplications: peptideData.researchApplications || [],
            keyBenefits: peptideData.keyBenefits || [],
            keyFeatures: peptideData.keyFeatures || [],
            mechanisms: peptideData.mechanisms || [],
            researchDosage: peptideData.researchDosage || {},
            researchProtocols: peptideData.researchProtocols || {},
            color: peptideData.color,
            sequence: peptideData.sequence,
            molecularWeight: peptideData.molecularWeight,
            storage: peptideData.storage,
            reconstitution: peptideData.reconstitution,
            category: categoryName,
            subcategory: peptideData.subcategory,
            featured: ['Retatrutide', 'Semaglutide', 'BPC-157', 'TB-500'].includes(peptideData.name),
            inStock: true,
          },
        });
        
        // Create education content for high-value peptides
        if (['Retatrutide', 'Semaglutide', 'BPC-157', 'TB-500', 'CJC-1295 DAC'].includes(peptideData.name)) {
          await createEducationContent(peptide.id, peptideData);
        }
        
        console.log(`✓ Imported: ${peptideData.name} (${peptideData.dosage || 'N/A'}) - $${peptideData.price}`);
        importedCount++;
        
      } catch (error) {
        console.error(`✗ Error importing ${peptideData.name}:`, error);
        errorCount++;
      }
    }
  }
  
  console.log(`\n🎉 Import completed!`);
  console.log(`✓ Successfully imported: ${importedCount} peptides`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`📊 Categories: ${Object.keys(categoryMap).length}`);
  
  return { imported: importedCount, errors: errorCount };
}

async function createEducationContent(peptideId: string, peptideData: EliteBiogenixPeptide) {
  const educationSections = [
    {
      title: 'Research Overview',
      type: 'overview',
      content: generateOverviewContent(peptideData),
      displayOrder: 1,
    },
    {
      title: 'Research Applications',
      type: 'research',
      content: generateResearchContent(peptideData),
      displayOrder: 2,
    },
    {
      title: 'Dosage Guidelines',
      type: 'protocols',
      content: generateProtocolContent(peptideData),
      displayOrder: 3,
    },
    {
      title: 'Storage & Safety',
      type: 'safety',
      content: generateSafetyContent(peptideData),
      displayOrder: 4,
    },
  ];
  
  for (const section of educationSections) {
    try {
      await prisma.peptide_education.create({
        data: {
          id: `${peptideId}-${section.type}-${section.displayOrder}`, // Generate unique ID
          peptideId,
          title: section.title,
          content: section.content,
          type: section.type,
          displayOrder: section.displayOrder,
          updatedAt: new Date(), // Explicit updatedAt
        },
      });
    } catch (error) {
      console.error(`Error creating education content for ${peptideData.name}:`, error);
    }
  }
}

function generateOverviewContent(peptide: EliteBiogenixPeptide): string {
  let content = `# ${peptide.name} Research Overview\n\n`;
  
  if (peptide.type) {
    content += `**Type:** ${peptide.type}\n\n`;
  }
  
  if (peptide.purity) {
    content += `**Purity:** ${peptide.purity}\n\n`;
  }
  
  if (peptide.casNumber) {
    content += `**CAS Number:** ${peptide.casNumber}\n\n`;
  }
  
  if (peptide.keyBenefits && peptide.keyBenefits.length > 0) {
    content += `## Key Research Benefits\n\n`;
    peptide.keyBenefits.forEach((benefit: string) => {
      content += `- ${benefit}\n`;
    });
    content += `\n`;
  }
  
  if (peptide.keyFeatures && peptide.keyFeatures.length > 0) {
    content += `## Key Features\n\n`;
    peptide.keyFeatures.forEach((feature: string) => {
      content += `- ${feature}\n`;
    });
    content += `\n`;
  }
  
  content += `> **Important:** This product is for laboratory research use only. Not for human consumption or clinical use.\n`;
  
  return content;
}

function generateResearchContent(peptide: EliteBiogenixPeptide): string {
  let content = `# ${peptide.name} Research Applications\n\n`;
  
  if (peptide.researchApplications && peptide.researchApplications.length > 0) {
    content += `## Primary Research Areas\n\n`;
    peptide.researchApplications.forEach((app: string) => {
      content += `### ${app}\n\nDetailed research protocols and methodologies for ${app.toLowerCase()} studies.\n\n`;
    });
  }
  
  if (peptide.mechanisms && peptide.mechanisms.length > 0) {
    content += `## Mechanisms of Action\n\n`;
    peptide.mechanisms.forEach((mechanism: string) => {
      content += `- ${mechanism}\n`;
    });
    content += `\n`;
  }
  
  if (peptide.molecularFormula) {
    content += `## Molecular Information\n\n`;
    content += `**Molecular Formula:** ${peptide.molecularFormula}\n\n`;
    
    if (peptide.molecularWeight) {
      content += `**Molecular Weight:** ${peptide.molecularWeight}\n\n`;
    }
    
    if (peptide.halfLife) {
      content += `**Half-Life:** ${peptide.halfLife}\n\n`;
    }
  }
  
  return content;
}

function generateProtocolContent(peptide: EliteBiogenixPeptide): string {
  let content = `# ${peptide.name} Research Protocols\n\n`;
  
  if (peptide.researchDosage) {
    content += `## Research Dosage Guidelines\n\n`;
    
    Object.entries(peptide.researchDosage).forEach(([model, dosage]) => {
      const modelName = model.charAt(0).toUpperCase() + model.slice(1);
      content += `**${modelName} Models:** ${dosage}\n\n`;
    });
  }
  
  if (peptide.researchProtocols) {
    content += `## Research Protocols\n\n`;
    
    Object.entries(peptide.researchProtocols).forEach(([protocol, details]) => {
      const protocolName = protocol.charAt(0).toUpperCase() + protocol.slice(1);
      content += `**${protocolName}:** ${details}\n\n`;
    });
  }
  
  if (peptide.reconstitution) {
    content += `## Reconstitution Guidelines\n\n`;
    content += `${peptide.reconstitution}\n\n`;
  }
  
  content += `> **Note:** All dosage information is for research purposes only. Consult relevant research protocols and safety guidelines.\n`;
  
  return content;
}

function generateSafetyContent(peptide: EliteBiogenixPeptide): string {
  let content = `# ${peptide.name} Storage & Safety\n\n`;
  
  if (peptide.storage) {
    content += `## Storage Instructions\n\n`;
    content += `${peptide.storage}\n\n`;
  }
  
  content += `## General Safety Guidelines\n\n`;
  content += `- Handle with appropriate laboratory safety equipment\n`;
  content += `- Store in appropriate temperature conditions\n`;
  content += `- Protect from light and moisture\n`;
  content += `- Use sterile techniques for reconstitution\n`;
  content += `- Dispose of properly according to laboratory protocols\n\n`;
  
  content += `## Quality Assurance\n\n`;
  if (peptide.purity) {
    content += `- Purity: ${peptide.purity}\n`;
  }
  content += `- HPLC and mass spectrometry verified\n`;
  content += `- cGMP manufacturing standards\n`;
  content += `- Third-party lab testing available\n\n`;
  
  content += `> **Warning:** For laboratory research use only. Not for human consumption, clinical, diagnostic, or therapeutic use.\n`;
  
  return content;
}

// CLI function to run the import
if (require.main === module) {
  importEliteBiogenixPeptides()
    .then(() => {
      console.log('Import process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Import process failed:', error);
      process.exit(1);
    });
}