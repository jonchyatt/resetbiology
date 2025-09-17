import { NextResponse } from 'next/server';
import peptideData from '@/data/peptides.json';

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    
    let filteredPeptides = peptideData.peptides;
    
    // Apply filters
    if (category) {
      filteredPeptides = filteredPeptides.filter(p => p.category === category);
    }
    
    if (featured === 'true') {
      filteredPeptides = filteredPeptides.filter(p => p.featured === true);
    }
    
    if (minPrice) {
      filteredPeptides = filteredPeptides.filter(p => p.retailPrice >= parseFloat(minPrice));
    }
    
    if (maxPrice) {
      filteredPeptides = filteredPeptides.filter(p => p.retailPrice <= parseFloat(maxPrice));
    }
    
    return NextResponse.json({
      success: true,
      products: filteredPeptides,
      totalCount: filteredPeptides.length,
      metadata: {
        lastUpdated: peptideData.lastUpdated,
        source: peptideData.source,
        priceRange: peptideData.priceRange
      }
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch products',
        products: []
      },
      { status: 500 }
    );
  }
}