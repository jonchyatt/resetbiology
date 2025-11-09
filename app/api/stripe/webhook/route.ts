import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getStripeWebhookSecret } from '@/lib/stripeEnv';
import { sendOrderConfirmationEmail, sendSellerOrderNotification } from '@/lib/email';
import type Stripe from 'stripe';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('[webhook] received', new Date().toISOString());

  const stripe = getStripe();
  if (!stripe) {
    console.error('[webhook] Stripe not configured');
    return NextResponse.json({ ok: true, note: 'Stripe not configured' }, { status: 200 });
  }

  const sig = req.headers.get('stripe-signature');
  const secret = getStripeWebhookSecret();

  // Enhanced debugging
  console.log('[webhook] ========== DEBUG INFO ==========');
  console.log('[webhook] Timestamp:', new Date().toISOString());
  console.log('[webhook] Has signature:', !!sig);
  console.log('[webhook] Has secret:', !!secret);
  if (secret) {
    console.log('[webhook] Secret starts with:', secret.substring(0, 10));
    console.log('[webhook] Secret length:', secret.length);
  }
  console.log('[webhook] Headers:', {
    'content-type': req.headers.get('content-type'),
    'stripe-signature': sig?.substring(0, 50) + '...',
    'user-agent': req.headers.get('user-agent'),
  });

  if (!sig || !secret) {
    console.error('[webhook] Missing signature or secret');
    return NextResponse.json({ ok: true, note: 'Missing signature or secret' }, { status: 200 });
  }

  // Get raw body as text to preserve exact bytes
  const rawBody = await req.text();
  console.log('[webhook] Body length:', rawBody.length);
  console.log('[webhook] Body preview:', rawBody.substring(0, 100));
  console.log('[webhook] Body type:', typeof rawBody);
  console.log('[webhook] =====================================');

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    console.log('[webhook] ✅ Signature verification SUCCESS!');
    console.log('[webhook] Event type:', event.type);
  } catch (err: any) {
    console.error('[webhook] ❌ Verification failed:', err.message);
    console.error('[webhook] Error details:', err);

    // Try with Buffer as fallback
    try {
      console.log('[webhook] Trying Buffer conversion...');
      const bufferBody = Buffer.from(rawBody, 'utf8');
      event = stripe.webhooks.constructEvent(bufferBody, sig, secret);
      console.log('[webhook] ✅ SUCCESS with Buffer conversion!');
    } catch (err2: any) {
      console.error('[webhook] ❌ Also failed with Buffer:', err2.message);

      // Try manual verification as final fallback
      try {
        console.log('[webhook] Attempting manual signature verification...');

        // Parse signature header
        const sigElements = sig.split(',').reduce((acc, element) => {
          const [key, value] = element.split('=');
          if (key && value) acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        const timestamp = sigElements.t;
        const signatures = [sigElements.v1, sigElements.v0].filter(Boolean);

        console.log('[webhook] Manual: timestamp:', timestamp);
        console.log('[webhook] Manual: signatures count:', signatures.length);

        if (!timestamp || signatures.length === 0) {
          throw new Error('Unable to extract timestamp and signatures from header');
        }

        // Construct expected signature
        const signedPayload = `${timestamp}.${rawBody}`;
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(signedPayload, 'utf8')
          .digest('hex');

        console.log('[webhook] Manual: expected signature prefix:', expectedSignature.substring(0, 20));

        // Verify signature
        const signatureFound = signatures.some(sig =>
          crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(sig)
          )
        );

        if (!signatureFound) {
          console.error('[webhook] Manual: No matching signature found');
          console.error('[webhook] Manual: Expected:', expectedSignature);
          console.error('[webhook] Manual: Received:', signatures);
          throw new Error('No signatures found matching the expected signature');
        }

        // Check timestamp tolerance (5 minutes)
        const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
        if (timestampAge > 300) {
          throw new Error('Timestamp outside the tolerance zone');
        }

        // Parse the event
        event = JSON.parse(rawBody) as Stripe.Event;
        console.log('[webhook] ✅ Manual verification SUCCESS!');
        console.log('[webhook] Event type:', event.type);

      } catch (err3: any) {
        console.error('[webhook] ❌ Manual verification also failed:', err3.message);
        return NextResponse.json(
          { ok: false, error: `Webhook signature verification failed: ${err.message}` },
          { status: 400 },
        );
      }
    }
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const shipping = (session as any).shipping_details;

    // Check if this is a subscription checkout
    if (session.mode === 'subscription' && session.subscription) {
      console.log('[webhook] Subscription checkout completed:', session.subscription);

      // Find user by email
      const userEmail = session.customer_details?.email;
      if (userEmail) {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: userEmail },
              { auth0Sub: session.client_reference_id || undefined }
            ]
          }
        });

        if (user) {
          // Fetch subscription details from Stripe to get current period end
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: 'active',
              subscriptionExpiry: new Date((subscription as any).current_period_end * 1000)
            }
          });

          console.log('[webhook] User subscription activated:', user.id);
        }
      }
    } else {
      // Handle one-time payment (existing order logic)
      const order = await prisma.order.create({
        data: {
          stripeSessionId: session.id,
          stripePaymentIntentId: (session.payment_intent as string) || null,
          stripeCustomerId: (session.customer as string) || null,
          productId: session.metadata?.productId || null,
          priceId: session.metadata?.priceId || null,
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          email: session.customer_details?.email ?? null,
          status: 'paid',

          // Shipping Information
          shippingName: shipping?.name || null,
          shippingLine1: shipping?.address?.line1 || null,
          shippingLine2: shipping?.address?.line2 || null,
          shippingCity: shipping?.address?.city || null,
          shippingState: shipping?.address?.state || null,
          shippingPostalCode: shipping?.address?.postal_code || null,
          shippingCountry: shipping?.address?.country || null,
          shippingPhone: session.customer_details?.phone || null,

          fulfillmentStatus: 'unfulfilled',
        },
      });

      console.log('[webhook] order created:', order.id);

      // Get product details for email
      const product = await prisma.product.findUnique({
        where: { id: order.productId! },
        select: { name: true },
      });

      // Send confirmation email to customer
      if (order.email && product) {
        const orderNumber = order.id.slice(-8).toUpperCase();

        await sendOrderConfirmationEmail({
          orderId: order.id,
          orderNumber,
          email: order.email,
          shippingName: order.shippingName!,
          shippingLine1: order.shippingLine1!,
          shippingLine2: order.shippingLine2 || undefined,
          shippingCity: order.shippingCity!,
          shippingState: order.shippingState!,
          shippingPostalCode: order.shippingPostalCode!,
          shippingCountry: order.shippingCountry!,
          productName: product.name,
          amountTotal: order.amountTotal!,
          currency: order.currency!,
        });

        // Send notification to seller
        await sendSellerOrderNotification({
          orderId: order.id,
          orderNumber,
          email: order.email,
          shippingName: order.shippingName!,
          shippingLine1: order.shippingLine1!,
          shippingLine2: order.shippingLine2 || undefined,
          shippingCity: order.shippingCity!,
          shippingState: order.shippingState!,
          shippingPostalCode: order.shippingPostalCode!,
          shippingCountry: order.shippingCountry!,
          productName: product.name,
          amountTotal: order.amountTotal!,
          currency: order.currency!,
        });
      }
    }
  }

  // Handle subscription created event
  if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object as Stripe.Subscription;
    console.log('[webhook] Subscription created:', subscription.id);

    // Get customer email from Stripe
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    const customerEmail = (customer as Stripe.Customer).email;

    if (customerEmail) {
      const user = await prisma.user.findFirst({
        where: { email: customerEmail }
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: subscription.status === 'active' ? 'active' : 'none',
            subscriptionExpiry: new Date((subscription as any).current_period_end * 1000)
          }
        });
        console.log('[webhook] User subscription status updated:', user.id);
      }
    }
  }

  // Handle subscription updated event
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    console.log('[webhook] Subscription updated:', subscription.id);

    // Get customer email from Stripe
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    const customerEmail = (customer as Stripe.Customer).email;

    if (customerEmail) {
      const user = await prisma.user.findFirst({
        where: { email: customerEmail }
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: subscription.status === 'active' ? 'active' : subscription.status === 'canceled' ? 'expired' : 'none',
            subscriptionExpiry: new Date((subscription as any).current_period_end * 1000)
          }
        });
        console.log('[webhook] User subscription status updated:', user.id);
      }
    }
  }

  // Handle subscription deleted event
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    console.log('[webhook] Subscription deleted:', subscription.id);

    // Get customer email from Stripe
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    const customerEmail = (customer as Stripe.Customer).email;

    if (customerEmail) {
      const user = await prisma.user.findFirst({
        where: { email: customerEmail }
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: 'expired',
            subscriptionExpiry: new Date((subscription as any).current_period_end * 1000)
          }
        });
        console.log('[webhook] User subscription marked as expired:', user.id);
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
