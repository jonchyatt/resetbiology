import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await auth0.getSession();
    const authUser = session?.user;

    if (!authUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let user = authUser.sub ? await prisma.user.findUnique({ where: { auth0Sub: authUser.sub } }) : null;
    if (!user && authUser.email) {
      user = await prisma.user.findUnique({ where: { email: authUser.email } });
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      source = 'usda',
      sourceId = null,
      itemName,
      brand = null,
      quantity = 1,
      unit = 'serving',
      gramWeight = null,
      nutrients,
      mealType = 'snack',
      photoUrl = null,
      notes = null,
      loggedAt = null,
    } = body ?? {};

    if (!itemName || typeof nutrients !== 'object' || nutrients === null) {
      return NextResponse.json({ ok: false, error: 'Missing itemName or nutrients' }, { status: 400 });
    }

    const log = await prisma.foodLog.create({
      data: {
        userId: user.id,
        source,
        sourceId,
        itemName,
        brand,
        quantity: typeof quantity === 'number' ? quantity : Number(quantity) || 1,
        unit,
        gramWeight: typeof gramWeight === 'number' ? gramWeight : gramWeight ? Number(gramWeight) : null,
        nutrients,
        photoUrl,
        notes,
        loggedAt: loggedAt ? new Date(loggedAt) : undefined,
        mealType,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, logId: log.id });
  } catch (error: any) {
    console.error('POST /api/foods/log error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to log food' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth0.getSession();
    const authUser = session?.user;

    if (!authUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let user = authUser.sub ? await prisma.user.findUnique({ where: { auth0Sub: authUser.sub } }) : null;
    if (!user && authUser.email) {
      user = await prisma.user.findUnique({ where: { email: authUser.email } });
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    }

    await prisma.foodLog.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/foods/log error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to delete entry' }, { status: 500 });
  }
}
