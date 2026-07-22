import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserFromSession} from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma';
import { dayKeyToUtcMidnight, localDayKey } from '@/lib/localDay';
import { awardNutritionPoints } from '@/lib/nutritionPoints';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_KEY_RE.test(value)) return false;
  const parsed = dayKeyToUtcMidnight(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(req: Request) {
  try {
    const session = await auth0.getSession();
    const authUser = session?.user;

    if (!authUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(session);

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

    // Only our own vault-backed render path may land in photoUrl — an
    // external-host photo URL can never enter FoodLog again.
    const safePhotoUrl =
      typeof photoUrl === 'string' && /^\/api\/images\/[A-Za-z0-9_-]+$/.test(photoUrl)
        ? photoUrl
        : null;

    const logTimestamp = loggedAt ? new Date(loggedAt) : new Date();
    const dayKey = isValidDayKey(localDate) ? localDate : localDayKey(logTimestamp);
    const dayStart = dayKeyToUtcMidnight(dayKey);
    const nextDay = new Date(dayStart);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

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
        photoUrl: safePhotoUrl,
        notes,
        localDate: dayKey, // One validated user-local YYYY-MM-DD key for every daily side effect
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
          date: dayStart,
          taskName: 'meals',
        },
      },
      update: { completed: true },
      create: {
        userId: user.id,
        date: dayStart,
        taskName: 'meals',
        completed: true,
      },
    });

    const award = await awardNutritionPoints({ userId: user.id, dayKey });
    const pointsAwarded = award.points;

    const timestamp = logTimestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const nutritionNote = `Nutrition tracked at ${timestamp}`;

    const existingJournal = await prisma.journalEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: dayStart,
          lt: nextDay,
        },
      },
      orderBy: { createdAt: 'desc' },
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
      if (typeof entryData.localDate !== 'string' || !entryData.localDate) {
        entryData.localDate = dayKey;
      }
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
        localDate: dayKey,
      };

      await prisma.journalEntry.create({
        data: {
          userId: user.id,
          entry: JSON.stringify(entryData),
          mood: null,
          weight: null,
          date: dayStart,
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

    const user = await getUserFromSession(session);

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
