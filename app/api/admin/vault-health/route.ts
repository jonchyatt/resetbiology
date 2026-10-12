import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminGuard'
import { prisma } from '@/lib/prisma'
import { isVaultKeyConfigured } from '@/lib/vault-encryption'

export const dynamic = 'force-dynamic'

// Wave J4.3: admin-only read of vault health. No behaviour change.
export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plaintextTokens = await prisma.user.count({ where: { googleDriveRefreshToken: { startsWith: '1//' } } })
  return NextResponse.json({ vaultKeyConfigured: isVaultKeyConfigured(), plaintextTokens })
}
