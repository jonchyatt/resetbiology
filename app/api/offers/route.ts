import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/offers
 * Returns active offers ordered by displayOrder
 * Used by quiz page AND onboarding agent
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const includeInactive = searchParams.get('includeInactive') === 'true';

        const offers = await prisma.offer.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: { displayOrder: 'asc' },
            select: {
                id: true,
                slug: true,
                name: true,
                tagline: true,
                trialPrice: true,
                monthlyPrice: true,
                features: true,
                highlighted: true,
                displayOrder: true,
                color: true,
                ctaText: true,
                ctaUrl: true,
                isActive: true,
            }
        });

        return NextResponse.json({ offers });

    } catch (error) {
        console.error('[Offers API] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
    }
}
