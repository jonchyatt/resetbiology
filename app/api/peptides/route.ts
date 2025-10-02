import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/peptides - List all peptides
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const inStock = searchParams.get('inStock');
    const search = searchParams.get('search');

    let where: any = {};

    if (category && category !== 'all') {
      where.category = category;
    }

    if (featured === 'true') {
      where.featured = true;
    }

    if (inStock === 'true') {
      where.inStock = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }

    const peptides = await prisma.peptide.findMany({
      where,
      orderBy: [
        { featured: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ success: true, data: peptides });
  } catch (error) {
    console.error('Error fetching peptides:', error);
    return NextResponse.json({ error: 'Failed to fetch peptides' }, { status: 500 });
  }
}

// POST /api/peptides - Create new peptide
export async function POST(request: NextRequest) {
  try {
    const peptideData = await request.json();

    // Generate slug from name if not provided
    const slug = peptideData.slug || peptideData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const peptide = await prisma.peptide.create({
      data: {
        slug,
        name: peptideData.name,
        dosage: peptideData.dosage || null,
        price: peptideData.price || 0,
        originalUrl: peptideData.originalUrl || null,
        casNumber: peptideData.casNumber || null,
        molecularFormula: peptideData.molecularFormula || null,
        purity: peptideData.purity || null,
        halfLife: peptideData.halfLife || null,
        type: peptideData.type || null,
        classification: peptideData.classification || null,
        researchApplications: peptideData.researchApplications || null,
        keyBenefits: peptideData.keyBenefits || null,
        keyFeatures: peptideData.keyFeatures || null,
        mechanisms: peptideData.mechanisms || null,
        researchDosage: peptideData.researchDosage || null,
        researchProtocols: peptideData.researchProtocols || null,
        color: peptideData.color || null,
        sequence: peptideData.sequence || null,
        molecularWeight: peptideData.molecularWeight || null,
        storage: peptideData.storage || null,
        reconstitution: peptideData.reconstitution || null,
        category: peptideData.category || peptideData.purpose || 'Other',
        subcategory: peptideData.subcategory || null,
        inStock: peptideData.inStock ?? true,
        featured: peptideData.featured ?? false
      }
    });

    return NextResponse.json({ success: true, peptide });
  } catch (error) {
    console.error('Error creating peptide:', error);
    return NextResponse.json({ error: 'Failed to create peptide' }, { status: 500 });
  }
}

// PATCH /api/peptides?id=<id> - Update existing peptide
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const peptideId = searchParams.get('id');

    if (!peptideId) {
      return NextResponse.json({ error: 'Peptide ID required' }, { status: 400 });
    }

    const peptideData = await request.json();

    const peptide = await prisma.peptide.update({
      where: { id: peptideId },
      data: {
        name: peptideData.name,
        dosage: peptideData.dosage || null,
        price: peptideData.price || 0,
        reconstitution: peptideData.reconstitution || null,
        category: peptideData.category || peptideData.purpose || 'Other',
        featured: peptideData.featured ?? false,
        inStock: peptideData.inStock ?? true
      }
    });

    return NextResponse.json({ success: true, peptide });
  } catch (error) {
    console.error('Error updating peptide:', error);
    return NextResponse.json({ error: 'Failed to update peptide' }, { status: 500 });
  }
}

// DELETE /api/peptides?id=<id> - Delete peptide
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const peptideId = searchParams.get('id');

    if (!peptideId) {
      return NextResponse.json({ error: 'Peptide ID required' }, { status: 400 });
    }

    await prisma.peptide.delete({
      where: { id: peptideId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting peptide:', error);
    return NextResponse.json({ error: 'Failed to delete peptide' }, { status: 500 });
  }
}