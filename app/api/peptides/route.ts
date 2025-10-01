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

    const peptide = await prisma.peptide.create({
      data: {
        slug: peptideData.slug,
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
        inStock: peptideData.inStock ?? true,
        featured: peptideData.featured ?? false
      }
    });

    return NextResponse.json({ peptide });
  } catch (error) {
    console.error('Error creating peptide:', error);
    return NextResponse.json({ error: 'Failed to create peptide' }, { status: 500 });
  }
}