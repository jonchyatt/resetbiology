import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { affiliateCode, referredUserId, conversionData } = body

    // Track affiliate conversion
    const affiliateRecord = {
      id: `aff_${Date.now()}`,
      affiliateCode,
      referredUserId,
      conversionType: conversionData?.type || 'signup',
      conversionValue: conversionData?.value || 0,
      commissionRate: 0.30, // 30% commission on success deposits
      commissionOwed: (conversionData?.value || 0) * 0.30,
      status: 'pending',
      timestamp: new Date(),
      metadata: {
        referralSource: conversionData?.source || 'direct',
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        psychologyTrigger: 'affiliate_success_tracking'
      }
    }

    // TODO: Save to database
    // await prisma.affiliateConversion.create({ data: affiliateRecord })
    
    console.log('Affiliate conversion tracked:', {
      affiliate: affiliateCode,
      conversion: conversionData,
      commission: affiliateRecord.commissionOwed,
      psychology: 'Affiliate motivated by earnings potential'
    })

    return NextResponse.json({
      success: true,
      affiliateId: affiliateRecord.id,
      commission: affiliateRecord.commissionOwed,
      status: affiliateRecord.status
    })

  } catch (error) {
    console.error('Affiliate tracking error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to track affiliate conversion' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const affiliateCode = searchParams.get('code')
    
    if (!affiliateCode) {
      return NextResponse.json(
        { error: 'Affiliate code required' },
        { status: 400 }
      )
    }

    // Mock affiliate stats
    const stats = {
      affiliateCode,
      totalConversions: 23,
      totalCommissions: 3450,
      pendingCommissions: 850,
      conversionRate: 8.7,
      topConversionSources: ['Facebook', 'Email', 'Direct'],
      recentConversions: [
        { userId: 'user_123', value: 500, date: '2025-01-15', status: 'confirmed' },
        { userId: 'user_124', value: 1000, date: '2025-01-14', status: 'pending' },
        { userId: 'user_125', value: 250, date: '2025-01-13', status: 'confirmed' }
      ],
      performance: {
        thisMonth: { conversions: 12, commissions: 1800 },
        lastMonth: { conversions: 8, commissions: 1200 },
        growth: '+50%'
      }
    }

    return NextResponse.json({
      success: true,
      affiliate: stats
    })

  } catch (error) {
    console.error('Affiliate stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve affiliate stats' },
      { status: 500 }
    )
  }
}