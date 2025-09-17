import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/peptides/[slug] - Get single peptide by slug
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const peptide = await prisma.peptide.findUnique({
      where: { slug: params.slug }
    });

    if (!peptide) {
      return NextResponse.json({ error: 'Peptide not found' }, { status: 404 });
    }

    return NextResponse.json({ peptide });
  } catch (error) {
    console.error('Error fetching peptide:', error);
    return NextResponse.json({ error: 'Failed to fetch peptide' }, { status: 500 });
  }
}

// PUT /api/peptides/[slug] - Update peptide
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const peptideData = await request.json();

    const peptide = await prisma.peptide.update({
      where: { slug: params.slug },
      data: {
        name: peptideData.name,
        dosage: peptideData.dosage,
        price: peptideData.price,
        originalUrl: peptideData.originalUrl,
        casNumber: peptideData.casNumber,
        molecularFormula: peptideData.molecularFormula,
        purity: peptideData.purity,
        halfLife: peptideData.halfLife,
        type: peptideData.type,
        classification: peptideData.classification,
        researchApplications: peptideData.researchApplications,
        keyBenefits: peptideData.keyBenefits,
        keyFeatures: peptideData.keyFeatures,
        mechanisms: peptideData.mechanisms,
        researchDosage: peptideData.researchDosage,
        researchProtocols: peptideData.researchProtocols,
        color: peptideData.color,
        sequence: peptideData.sequence,
        molecularWeight: peptideData.molecularWeight,
        storage: peptideData.storage,
        reconstitution: peptideData.reconstitution,
        category: peptideData.category,
        subcategory: peptideData.subcategory,
        inStock: peptideData.inStock,
        featured: peptideData.featured
      }
    });

    return NextResponse.json({ peptide });
  } catch (error) {
    console.error('Error updating peptide:', error);
    return NextResponse.json({ error: 'Failed to update peptide' }, { status: 500 });
  }
}

// DELETE /api/peptides/[slug] - Delete peptide
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await prisma.peptide.delete({
      where: { slug: params.slug }
    });

    return NextResponse.json({ message: 'Peptide deleted successfully' });
  } catch (error) {
    console.error('Error deleting peptide:', error);
    return NextResponse.json({ error: 'Failed to delete peptide' }, { status: 500 });
  }
}