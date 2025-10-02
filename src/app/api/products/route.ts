import { NextResponse } from 'next/server';
import peptideData from '@/data/peptides.json';

type PriceRange = { min: number; max: number };
type CatalogMeta = { 
  lastUpdated?: string; 
  source?: string; 
  priceRange?: PriceRange;
  totalPeptides?: number;
  dataSources?: string[];
  mergeStrategy?: string;
};
interface PeptideCatalog {
  peptides: any[];
  metadata: CatalogMeta;
}

export async function GET(request: Request) {
  try {
    const { peptides, metadata } = peptideData as PeptideCatalog;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    
    let filteredPeptides = peptides;
    
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
        lastUpdated: metadata?.lastUpdated ?? null,
        source: metadata?.source ?? 'mongo',
        priceRange: metadata?.priceRange
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