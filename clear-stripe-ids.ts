// Script to clear old Stripe IDs so products can be re-synced with new Stripe account
import { prisma } from './src/lib/prisma';

async function clearStripeIds() {
  console.log('🔄 Clearing old Stripe IDs from products and prices...\n');

  // Clear Stripe Product IDs
  const productsUpdated = await prisma.product.updateMany({
    where: {
      stripeProductId: { not: null }
    },
    data: {
      stripeProductId: null
    }
  });
  console.log(`✅ Cleared Stripe Product IDs from ${productsUpdated.count} products`);

  // Clear Stripe Price IDs
  const pricesUpdated = await prisma.price.updateMany({
    where: {
      stripePriceId: { not: null }
    },
    data: {
      stripePriceId: null
    }
  });
  console.log(`✅ Cleared Stripe Price IDs from ${pricesUpdated.count} prices`);

  console.log('\n✨ Done! You can now re-sync products in /admin/store');

  await prisma.$disconnect();
}

clearStripeIds().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
