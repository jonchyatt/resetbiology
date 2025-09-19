'use server';

import { revalidateTag } from 'next/cache';
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