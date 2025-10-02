import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Fetch all products where isTrackable is true
    const trackableProducts = await prisma.product.findMany({
      where: {
        isTrackable: true,
        active: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        protocolPurpose: true,
        protocolDosageRange: true,
        protocolFrequency: true,
        protocolTiming: true,
        protocolDuration: true,
        vialAmount: true,
        reconstitutionInstructions: true,
        syringeUnits: true,
        description: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform to match the expected format for PeptideTracker
    const formattedProducts = trackableProducts.map(product => ({
      name: product.name,
      protocolPurpose: product.protocolPurpose || 'General',
      protocolDosageRange: product.protocolDosageRange || 'Consult physician',
      protocolTiming: product.protocolTiming || 'As directed',
      protocolFrequency: product.protocolFrequency || 'As directed',
      protocolDuration: product.protocolDuration || 'As directed',
      vialAmount: product.vialAmount || '10mg',
      reconstitutionInstructions: product.reconstitutionInstructions || '2ml BAC water',
      syringeUnits: product.syringeUnits || 10,
      description: product.description || product.name
    }));

    return NextResponse.json({
      success: true,
      data: formattedProducts,
      count: formattedProducts.length
    });
  } catch (error) {
    console.error('Error fetching trackable products:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch trackable products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: POST endpoint to update a product's trackable status
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, isTrackable, protocolData } = body;

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        isTrackable,
        ...protocolData
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    console.error('Error updating product trackable status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}