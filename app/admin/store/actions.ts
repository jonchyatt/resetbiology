'use server';

import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';
import { ensureStripeSync } from '@/lib/stripeSync';

// Import peptide data directly - no file system access in production!
import peptidesData from '../../src/data/peptides-merged.json';

export async function listProducts() {
  // Admin check already done in page component
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { prices: true },
  });
  return products;
}

export async function createProduct(data: {
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
}) {
  // await requireAdmin(); // Admin check already done in page component

  if (!data?.name || !data?.slug) {
    throw new Error('name and slug are required');
  }

  const product = await prisma.product.create({
    data: {
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: data.description?.trim() ?? null,
      imageUrl: data.imageUrl?.trim() ?? null,
      active: true,
      storefront: false,
    },
  });
  revalidateTag('products');
  return product;
}

export async function updateProduct(id: string, patch: Partial<{
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  storefront: boolean;
}>) {
  // await requireAdmin(); // Admin check already done in page component
  if (!id || !patch) throw new Error('Missing id or patch data');

  const product = await prisma.product.update({
    where: { id },
    data: patch,
  });
  revalidateTag('products');
  return product;
}

export async function archiveProduct(productId: string) {
  // await requireAdmin(); // Admin check already done in page component
  if (!productId) throw new Error('Missing productId');

  const product = await prisma.product.update({
    where: { id: productId },
    data: { active: false },
  });
  revalidateTag('products');
  return product;
}

export async function upsertPrice(productId: string, payload: {
  id?: string;
  unitAmount: number;
  currency?: string;
  interval?: 'month' | 'year' | null;
  isPrimary?: boolean;
  active?: boolean;
}) {
  // await requireAdmin(); // Admin check already done in page component
  if (!productId || !payload?.unitAmount) {
    throw new Error('Missing productId or unitAmount');
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Product not found');

  // If marking as primary, unmark others
  if (payload.isPrimary) {
    await prisma.price.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const data = {
    productId,
    unitAmount: Math.round(payload.unitAmount),
    currency: (payload.currency || 'usd').toLowerCase(),
    interval: payload.interval ?? null,
    isPrimary: !!payload.isPrimary,
    active: payload.active ?? true,
  };

  const price = payload.id
    ? await prisma.price.update({ where: { id: payload.id }, data })
    : await prisma.price.create({ data: { ...data, productId } });

  revalidateTag('products');
  return price;
}

export async function deletePrice(priceId: string) {
  // await requireAdmin(); // Admin check already done in page component
  if (!priceId) throw new Error('Missing priceId');

  await prisma.price.delete({ where: { id: priceId } });
  revalidateTag('products');
  return { ok: true };
}

export async function syncProductToStripe(productId: string) {
  // await requireAdmin(); // Admin check already done in page component
  if (!productId) throw new Error('Missing productId');

  const result = await ensureStripeSync(productId);
  revalidateTag('products');
  return result;
}

export async function importPeptides() {
  // Admin check already done in page component
  
  try {
    // Use imported JSON data directly - no file system access in production!
    const peptides = peptidesData as any[];
    
    console.log(`[Import] Starting import of ${peptides.length} items from peptides-merged.json...`);
    
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    
    for (const peptide of peptides) {
      try {
        // Generate slug if not provided
        let slug = peptide.slug || '';
        if (!slug && peptide.name) {
          slug = peptide.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
        
        if (!slug || !peptide.name) {
          console.log(`[Import] Skipping item without name/slug`);
          skipped++;
          continue;
        }
        
        // Check if product already exists
        const existing = await prisma.product.findFirst({
          where: { slug }
        });
        
        if (existing) {
          // Update existing product with better data if available
          const updateData: any = {};
          
          // Only update if new data is better/longer
          if (peptide.description && (!existing.description || peptide.description.length > existing.description.length)) {
            updateData.description = peptide.description;
          }
          
          if (peptide.imageUrl && !existing.imageUrl) {
            updateData.imageUrl = peptide.imageUrl;
          }
          
          // Merge metadata if available
          if (peptide.metadata) {
            const existingMeta = (existing.metadata as any) || {};
            updateData.metadata = {
              ...existingMeta,
              ...peptide.metadata,
              protocolInstructions: {
                ...existingMeta.protocolInstructions,
                ...(peptide.metadata.protocolInstructions || {})
              }
            };
          }
          
          // Add protocols to description if available
          if (peptide.protocols && !existing.description?.includes('Protocol:')) {
            updateData.description = `${existing.description || ''}\n\nProtocol: ${peptide.protocols}`.trim();
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.product.update({
              where: { id: existing.id },
              data: updateData
            });
            console.log(`[Import] Updated ${peptide.name} with additional data`);
            updated++;
          } else {
            console.log(`[Import] Skipping ${peptide.name} - already exists with complete data`);
            skipped++;
          }
          continue;
        }
        
        // Build description from available data
        let description = peptide.description || '';
        
        // Add educational content if available
        if (peptide.educationalContent) {
          description = `${description}\n\n${peptide.educationalContent}`.trim();
        }
        
        // Add protocols if available
        if (peptide.protocols) {
          description = `${description}\n\nProtocol: ${peptide.protocols}`.trim();
        }
        
        // Add metadata instructions if available
        if (peptide.metadata?.protocolInstructions) {
          const instructions = peptide.metadata.protocolInstructions;
          const instructionText = Object.entries(instructions)
            .filter(([key, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
          
          if (instructionText) {
            description = `${description}\n\n${instructionText}`.trim();
          }
        }
        
        // Create the product
        const product = await prisma.product.create({
          data: {
            name: peptide.name,
            slug: slug,
            description: description || null,
            imageUrl: peptide.imageUrl || null,
            metadata: peptide.metadata || {},
            active: peptide.active !== false,
            storefront: peptide.storefront !== false,
          }
        });
        
        // Add price if available
        const price = peptide.retailPrice || peptide.partnerPrice;
        if (price) {
          const priceInCents = Math.round(price * 100);
          
          await prisma.price.create({
            data: {
              productId: product.id,
              unitAmount: priceInCents,
              currency: 'usd',
              interval: null, // One-time purchase
              isPrimary: true,
              active: true,
            }
          });
        }
        
        console.log(`[Import] Imported ${peptide.name} successfully`);
        imported++;
        
      } catch (error) {
        console.error(`[Import] Error importing ${peptide.name || 'unknown'}:`, error);
      }
    }
    
    console.log(`[Import] Complete! Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`);
    revalidateTag('products');
    
    return {
      success: true,
      imported,
      updated,
      skipped,
      total: peptides.length,
      source: 'peptides-merged.json'
    };
    
  } catch (error) {
    console.error('[Import] Failed to import peptides:', error);
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}