import { NextRequest, NextResponse } from 'next/server';
import { getPeptide } from '@/data/peptide-education/generated';

// GET /api/peptides/education-library/[slug] - full PeptideCard (incl.
// structured_regimens) for one library card, fetched on demand when the
// Add-Protocol picker selects a library-sourced peptide. Public research
// content, same data already server-rendered at /education/peptides/[slug].
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const card = getPeptide(slug);
  if (!card) {
    return NextResponse.json({ success: false, error: 'Peptide not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, card });
}
