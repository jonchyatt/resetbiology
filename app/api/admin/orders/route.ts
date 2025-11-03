import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { sendShippingConfirmationEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper to check if user is admin
function isAdmin(user: any): boolean {
  return user?.role === 'admin' || user?.accessLevel === 'admin';
}

// GET: List all orders
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ auth0Sub: session.user.sub }, { email: session.user.email }],
      },
    });

    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get product names for orders
    const ordersWithProducts = await Promise.all(
      orders.map(async (order) => {
        const product = order.productId
          ? await prisma.product.findUnique({
              where: { id: order.productId },
              select: { name: true, slug: true },
            })
          : null;

        return {
          ...order,
          productName: product?.name || 'Unknown Product',
          productSlug: product?.slug,
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: ordersWithProducts,
    });
  } catch (error) {
    console.error('GET /api/admin/orders error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH: Update order (mark as shipped, add tracking, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ auth0Sub: session.user.sub }, { email: session.user.email }],
      },
    });

    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, fulfillmentStatus, trackingNumber, trackingUrl, notes } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (fulfillmentStatus) {
      updateData.fulfillmentStatus = fulfillmentStatus;

      // Set shipped date if marking as shipped
      if (fulfillmentStatus === 'shipped' && !updateData.shippedAt) {
        updateData.shippedAt = new Date();
      }

      // Set delivered date if marking as delivered
      if (fulfillmentStatus === 'delivered' && !updateData.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    }

    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;
    if (notes !== undefined) updateData.notes = notes;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Send shipping confirmation email if order was just marked as shipped
    if (fulfillmentStatus === 'shipped' && order.email) {
      const product = await prisma.product.findUnique({
        where: { id: order.productId! },
        select: { name: true },
      });

      const orderNumber = order.id.slice(-8).toUpperCase();

      await sendShippingConfirmationEmail({
        email: order.email,
        orderId: order.id,
        orderNumber,
        trackingNumber: order.trackingNumber || undefined,
        trackingUrl: order.trackingUrl || undefined,
        productName: product?.name || 'Your Order',
      });
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('PATCH /api/admin/orders error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
