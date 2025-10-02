const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing database connection...');
    const count = await prisma.product.count();
    console.log('Product count:', count);
    
    const products = await prisma.product.findMany({ take: 3 });
    console.log('\nSample products:');
    products.forEach(p => {
      console.log(`  - ${p.name} (${p.slug})`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();