"use server"

import { prisma } from "@/lib/prisma"
import { ensureStripeSync } from "@/lib/stripeSync"
import { getStripe } from "@/lib/stripe"

type NonPeptideSeed = {
  slug: string
  name: string
  brand: "StemRegen" | "EnergyBits"
  variantLabel: string
  order: number
  priceCents: number
  imageUrl: string
  description: string
  benefits: string[]
}

const NON_PEPTIDE_CATALOG: NonPeptideSeed[] = [
  {
    slug: "stemregen-release",
    name: "StemRegen Release",
    brand: "StemRegen",
    variantLabel: "Release",
    order: 1,
    priceCents: 13200,
    imageUrl:
      "https://www.stemregen.co/cdn/shop/files/Front_d9a801e2-e09c-4ce2-a02e-f17650946fa9.png?v=1749678028&width=600",
    description:
      "Clinically tested botanical blend designed to support natural stem cell release and migration for whole-body repair.",
    benefits: ["Supports healthy aging", "Cellular repair and recovery", "Daily maintenance"],
  },
  {
    slug: "stemregen-mobilize",
    name: "StemRegen Mobilize",
    brand: "StemRegen",
    variantLabel: "Mobilize",
    order: 2,
    priceCents: 11500,
    imageUrl: "https://www.stemregen.co/cdn/shop/files/Front.png?v=1721151426&width=600",
    description:
      "Microcirculation support to help nutrients and stem cells efficiently reach tissues that need repair.",
    benefits: ["Supports blood flow", "Capillary and endothelial support", "Pairs well with Release"],
  },
  {
    slug: "stemregen-signal",
    name: "StemRegen Signal",
    brand: "StemRegen",
    variantLabel: "Signal",
    order: 3,
    priceCents: 9400,
    imageUrl:
      "https://www.stemregen.co/cdn/shop/files/Front_4a618035-5de7-44fc-8087-6696419a362e.png?v=1721152312&width=600",
    description:
      "Refines cellular signaling so circulating stem cells reach target tissues with less systemic noise.",
    benefits: ["Supports recovery", "Calms inflammatory noise", "Completes the trio"],
  },
  {
    slug: "energybits-spirulina",
    name: "ENERGYbits Spirulina | Large Bag",
    brand: "EnergyBits",
    variantLabel: "Spirulina",
    order: 1,
    priceCents: 13000,
    imageUrl: "https://energybits.com/cdn/shop/files/energybits-spirulina-large-baggeneralpartnerenergybits-954419.webp",
    description:
      "Single-ingredient spirulina tablets for steady energy, focus, and workout support with no caffeine or sugar.",
    benefits: ["Plant protein fuel", "Supports focus and endurance", "Travel-friendly tablets"],
  },
  {
    slug: "energybits-chlorella",
    name: "RECOVERYbits Chlorella | Large Bag",
    brand: "EnergyBits",
    variantLabel: "Chlorella",
    order: 2,
    priceCents: 13000,
    imageUrl: "https://energybits.com/cdn/shop/files/recoverybits-chlorella-large-bagsubscriptionenergybits-9609058.jpg",
    description: "Chlorella tablets to support detox, immune balance, and post-workout recovery.",
    benefits: ["Detox support", "Immune balance", "Great post-training"],
  },
  {
    slug: "energybits-vitalitybits",
    name: "VITALITYbits Spirulina/Chlorella | Large Bag",
    brand: "EnergyBits",
    variantLabel: "Spirulina/Chlorella",
    order: 3,
    priceCents: 13000,
    imageUrl: "https://energybits.com/cdn/shop/files/vitalitybits-large-canistergeneralpartnerenergybits-486488.jpg",
    description: "Balanced spirulina and chlorella blend for micronutrients, mitochondria support, and satiety.",
    benefits: ["Micronutrient dense", "Mitochondria support", "Blend of spirulina and chlorella"],
  },
]

function buildMetadata(seed: NonPeptideSeed) {
  return {
    ...(seed.benefits?.length ? { benefits: seed.benefits } : {}),
    brand: seed.brand,
    nonPeptide: true,
    administrationType: "oral",
    basePrice: seed.priceCents / 100,
  }
}

async function upsertPrice(productId: string, priceCents: number) {
  const existingPrices = await prisma.price.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  })

  const primary = existingPrices.find((p) => p.isPrimary) ?? existingPrices[0]
  const needsNewPrice = !primary || primary.unitAmount !== priceCents || primary.currency !== "usd"

  if (!needsNewPrice) {
    if (!primary.active || !primary.isPrimary) {
      await prisma.price.update({
        where: { id: primary.id },
        data: { active: true, isPrimary: true },
      })
    }
    return primary
  }

  await prisma.price.updateMany({
    where: { productId },
    data: { isPrimary: false },
  })

  const price = await prisma.price.create({
    data: {
      productId,
      unitAmount: priceCents,
      currency: "usd",
      interval: null,
      isPrimary: true,
      active: true,
      stripePriceId: null,
    },
  })

  return price
}

export async function seedNonPeptideCatalog(opts: { syncStripe?: boolean } = {}) {
  const { syncStripe = true } = opts
  const stripeAvailable = !!getStripe()
  const slugs = NON_PEPTIDE_CATALOG.map((p) => p.slug)

  for (const seed of NON_PEPTIDE_CATALOG) {
    const existing = await prisma.product.findUnique({ where: { slug: seed.slug } })
    const metadata = {
      ...(existing?.metadata as Record<string, unknown> | undefined),
      ...buildMetadata(seed),
    }

    const payload = {
      name: seed.name,
      description: seed.description,
      imageUrl: seed.imageUrl,
      allImages: [seed.imageUrl],
      retailPrice: seed.priceCents / 100,
      partnerPrice: null,
      category: "non-peptide",
      administrationType: "oral",
      baseProductName: seed.brand,
      variantLabel: seed.variantLabel,
      variantOrder: seed.order,
      active: true,
      storefront: true,
      isTrackable: false,
      metadata,
    }

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.product.create({
          data: {
            slug: seed.slug,
            ...payload,
          },
        })

    await upsertPrice(product.id, seed.priceCents)

    if (syncStripe && stripeAvailable) {
      try {
        await ensureStripeSync(product.id)
      } catch (err) {
        console.error(`[non-peptide] Failed to sync ${seed.slug} to Stripe:`, err)
      }
    }
  }

  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    include: { prices: { where: { active: true }, orderBy: { unitAmount: "asc" } } },
    orderBy: [
      { baseProductName: "asc" },
      { variantOrder: "asc" },
      { name: "asc" },
    ],
  })

  return products
}

