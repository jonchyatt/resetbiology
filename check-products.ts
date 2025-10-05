import { prisma } from './src/lib/prisma';

async function main() {
  const products = await prisma.product.findMany({
    include: { prices: true }
  });

  console.log('Total products:', products.length);
  console.log('\nProducts:');

  products.forEach(p => {
    console.log(`- ${p.name}`);
    console.log(`  Active: ${p.active}, Storefront: ${p.storefront}`);
    console.log(`  Prices: ${p.prices.length}`);
    console.log(`  Stripe Product ID: ${p.stripeProductId || 'NOT SYNCED'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main();
