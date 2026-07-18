import { NextResponse } from 'next/server';
import { peptideIndex } from '@/data/peptide-education/generated';

// GET /api/peptides/education-library - lightweight index (slug/name/category)
// for all cross-expert peptide library cards. Public research content, same
// data already server-rendered at /education/peptides — no auth required.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const peptides = peptideIndex();
    return NextResponse.json({ success: true, peptides });
  } catch (error) {
    console.error('Error loading peptide education index:', error);
    return NextResponse.json({ success: false, error: 'Failed to load peptide library' }, { status: 500 });
  }
}
