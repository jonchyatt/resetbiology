import { prisma } from '@/lib/prisma';
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 26);

type Profile = { sub: string; email?: string; name?: string; picture?: string };

export async function upsertUserFromAuth0(p: Profile) {
  const newId = nanoid();
  return prisma.user.upsert({
    where: { auth0Sub: p.sub },
    update: {
      email: p.email || null,
      name: p.name || null,
      image: p.picture || null,
    },
    create: {
      auth0Sub: p.sub,
      rbClientId: newId,
      email: p.email || null,
      name: p.name || null,
      image: p.picture || null,
      role: 'basic',
      profileJson: {},
      permissionsJson: {},
    },
  });
}