// Repo CLAUDE.md Mongo TTL law keeps newsletter_subscribers bounded; null pendingExpiresAt fields never expire.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const result = await prisma.$runCommandRaw({
    createIndexes: 'newsletter_subscribers',
    indexes: [
      {
        key: { pendingExpiresAt: 1 },
        name: 'pendingExpiresAt_ttl',
        expireAfterSeconds: 0,
      },
    ],
  });

  console.log(result);
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error(error);
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(1);
  }
}
