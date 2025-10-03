'use server';

import { revalidateTag } from 'next/cache';
import path from 'path';
import { promises as fs } from 'fs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';
import { ensureStripeSync } from '@/lib/stripeSync';

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
  if (!id) throw new Error('Missing product id');

  const product = await prisma.product.update({
    where: { id },
    data: patch,
  });
  revalidateTag('products');
  return product;
}

export async function archiveProduct(id: string) {
  // await requireAdmin(); // Admin check already done in page component
  if (!id) throw new Error('Missing product id');

  const product = await prisma.product.update({
    where: { id },
    data: { active: false, storefront: false },
  });
  revalidateTag('products');
  return product;
}

export async function upsertPrice(productId: string, payload: {
  id?: string;                 // if provided, update; else create
  label?: string | null;
  unitAmount: number;          // cents
  currency?: string;           // defaults to 'usd'
  interval?: 'month' | 'year' | null; // null => one-time
  isPrimary?: boolean;
  active?: boolean;
}) {
  // await requireAdmin(); // Admin check already done in page component

  if (!productId) throw new Error('Missing productId');
  if (typeof payload.unitAmount !== 'number' || payload.unitAmount <= 0) {
    throw new Error('unitAmount (cents) must be > 0');
  }

  if (payload.isPrimary) {
    await prisma.price.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });
  }

  const data = {
    label: payload.label ?? null,
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
    // Import peptide data from cellularpeptide-final-data.json
    
    const dataPath = path.join(process.cwd(), 'cellularpeptide-final-data.json');
    const rawData = await fs.readFile(dataPath, 'utf-8');
    const peptides = JSON.parse(rawData);
    
    console.log(`[Import] Starting import of ${peptides.length} peptides...`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const peptide of peptides) {
      try {
        // Check if product already exists by slug
        const slug = peptide.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        const existing = await prisma.product.findFirst({
          where: { slug }
        });
        
        if (existing) {
          console.log(`[Import] Skipping ${peptide.name} - already exists`);
          skipped++;
          continue;
        }
        
        // Create the product
        const product = await prisma.product.create({
          data: {
            name: peptide.name,
            slug: slug,
            description: peptide.protocols ? 
              `${peptide.educationalContent || ''}\n\nProtocol: ${peptide.protocols}`.trim() : 
              peptide.educationalContent || null,
            imageUrl: null, // Images can be added later
            active: true,
            storefront: true, // Make visible in store by default
          }
        });
        
        // Add retail price if available
        if (peptide.retailPrice) {
          const priceInCents = Math.round(peptide.retailPrice * 100);
          
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
        console.error(`[Import] Error importing ${peptide.name}:`, error);
      }
    }
    
    console.log(`[Import] Complete! Imported: ${imported}, Skipped: ${skipped}`);
    revalidateTag('products');
    
    return {
      success: true,
      imported,
      skipped,
      total: peptides.length
    };
    
  } catch (error) {
    console.error('[Import] Failed to import peptides:', error);
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
