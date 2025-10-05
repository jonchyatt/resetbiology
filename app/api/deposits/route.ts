import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: 'Stripe not configured' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { amount, tier, multiplier, userId } = body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: 'partner_success_stake',
        user_id: userId,
        tier,
        multiplier: String(multiplier),
        psychology_frame: 'investment_not_payment',
        refund_eligible: 'true',
      },
      description: `Reset Biology ${tier} Partner Stake - Refundable Investment`,
    });

    const mockDepositRecord = {
      id: `deposit_${Date.now()}`,
      userId,
      amount,
      tier,
      multiplier,
      status: 'active',
      stripePaymentId: paymentIntent.id,
      payoutConditions: {
        modulesRequired: tier === 'Starter' ? 3 : tier === 'Partner' ? 5 : 7,
        checkinsRequired: 30,
        timeframe: 90,
      },
      progress: {
        modulesCompleted: 0,
        checkinStreak: 0,
        daysRemaining: 90,
      },
      createdAt: new Date(),
      deadlineDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };

    console.log('Deposit created:', {
      depositId: mockDepositRecord.id,
      amount,
      tier,
      psychology: 'Partner investment activated - loss aversion engaged',
    });

    return NextResponse.json({
      success: true,
      depositId: mockDepositRecord.id,
      clientSecret: paymentIntent.client_secret,
      deposit: mockDepositRecord,
      psychologyActivated: [
        'Loss aversion engaged',
        'Partner identity established',
        'Progress tracking activated',
        'Achievement pathway unlocked',
      ],
    });
  } catch (error) {
    console.error('Deposit creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create partner stake' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, status } = body;

    if (status === 'succeeded') {
      console.log('Payment confirmed - activating partner benefits', paymentIntentId);

      return NextResponse.json({
        success: true,
        message: 'Partner stake activated - welcome sequence initiated',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deposit webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process payment confirmation' },
      { status: 500 },
    );
  }
}
