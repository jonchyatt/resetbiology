import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PeptideDetailClient } from '@/components/Peptides/PeptideDetailClient';

type Props = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

// null = confirmed absent; undefined = lookup failed (do not 404 on a DB outage).
async function findName(slug: string): Promise<string | null | undefined> {
  try {
    const p = await prisma.peptide.findUnique({ where: { slug }, select: { name: true } });
    return p ? p.name : null;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = await findName(slug);
  if (!name) return {};
  return {
    title: name,
    description: `${name}: research notes, a dosage calculator and protocol tracking. Free to use, nothing for sale.`,
  };
}

export default async function PeptideDetailPage({ params }: Props) {
  const { slug } = await params;
  if ((await findName(slug)) === null) notFound();
  return <PeptideDetailClient />;
}
