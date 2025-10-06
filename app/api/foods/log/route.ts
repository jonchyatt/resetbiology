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
      localDate = null,
      localTime = null,
    } = body ?? {};

    if (!itemName || typeof nutrients !== 'object' || nutrients === null) {
      return NextResponse.json({ ok: false, error: 'Missing itemName or nutrients' }, { status: 400 });
    }

    const logTimestamp = loggedAt ? new Date(loggedAt) : new Date();
    const startOfDay = new Date(logTimestamp);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const existingCountToday = await prisma.foodLog.count({
      where: {
        userId: user.id,
        loggedAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

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
        localDate, // User's local date YYYY-MM-DD
        localTime, // User's local time HH:MM:SS
        loggedAt: logTimestamp,
        mealType,
      },
      select: { id: true },
    });

    // Mark daily task as complete
    await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: startOfDay,
          taskName: 'meals',
        },
      },
      update: { completed: true },
      create: {
        userId: user.id,
        date: startOfDay,
        taskName: 'meals',
        completed: true,
      },
    });

    let pointsAwarded = 0;
    if (existingCountToday === 0) {
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          amount: 10,
          pointType: 'nutrition',
          activitySource: 'Logged nutrition for today',
          earnedAt: logTimestamp,
        },
      });
      pointsAwarded = 10;
    }

    const timestamp = logTimestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const nutritionNote = `Nutrition tracked at ${timestamp}`;

    const existingJournal = await prisma.journalEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (existingJournal) {
      let entryData: any = {};
      try {
        entryData = existingJournal.entry ? JSON.parse(existingJournal.entry as string) : {};
      } catch (err) {
        entryData = {};
      }

      const previous = entryData.nutritionNotes ? `${entryData.nutritionNotes}\n` : '';
      entryData.nutritionNotes = `${previous}${nutritionNote}`;
      const tasksCompleted = entryData.tasksCompleted || {};
      tasksCompleted.meals = true;
      entryData.tasksCompleted = tasksCompleted;

      await prisma.journalEntry.update({
        where: { id: existingJournal.id },
        data: {
          entry: JSON.stringify(entryData),
        },
      });
    } else {
      const entryData = {
        reasonsValidation: '',
        affirmationGoal: '',
        affirmationBecause: '',
        affirmationMeans: '',
        peptideNotes: '',
        workoutNotes: '',
        nutritionNotes: nutritionNote,
        breathNotes: '',
        moduleNotes: '',
        tasksCompleted: { meals: true },
      };

      await prisma.journalEntry.create({
        data: {
          userId: user.id,
          entry: JSON.stringify(entryData),
          mood: null,
          weight: null,
          date: logTimestamp,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      logId: log.id,
      pointsAwarded,
      journalNote: nutritionNote,
      dailyTaskCompleted: true,
    });
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
