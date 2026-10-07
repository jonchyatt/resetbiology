import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { isLocalDate, localDateToUtcStart } from '@/lib/nutrition/localEntry';
import { journalEntryIdForDay } from '@/lib/journal/dayEntry';

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
      requestId = null,
    } = body ?? {};

    if (!itemName || typeof nutrients !== 'object' || nutrients === null) {
      return NextResponse.json({ ok: false, error: 'Missing itemName or nutrients' }, { status: 400 });
    }

    const logTimestamp = loggedAt ? new Date(loggedAt) : new Date();
    if (Number.isNaN(logTimestamp.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid loggedAt timestamp' }, { status: 400 });
    }
    const fallbackLocalDate = `${logTimestamp.getFullYear()}-${String(logTimestamp.getMonth() + 1).padStart(2, '0')}-${String(logTimestamp.getDate()).padStart(2, '0')}`;
    const fallbackLocalTime = `${String(logTimestamp.getHours()).padStart(2, '0')}:${String(logTimestamp.getMinutes()).padStart(2, '0')}:${String(logTimestamp.getSeconds()).padStart(2, '0')}`;
    const resolvedLocalDate = isLocalDate(localDate) ? localDate : fallbackLocalDate;
    const resolvedLocalTime = typeof localTime === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(localTime) ? localTime : fallbackLocalTime;
    const taskDate = localDateToUtcStart(resolvedLocalDate);
    const nextTaskDate = new Date(taskDate);
    nextTaskDate.setUTCDate(nextTaskDate.getUTCDate() + 1);

    const stableLogId = typeof requestId === 'string' && /^[a-f0-9]{24}$/.test(requestId.trim())
      ? requestId.trim()
      : null;

    if (stableLogId) {
      const existingLog = await prisma.foodLog.findFirst({
        where: { id: stableLogId, userId: user.id },
        select: { id: true },
      });
      if (existingLog) {
        return NextResponse.json({ ok: true, logId: existingLog.id, pointsAwarded: 0, journalNote: null, dailyTaskCompleted: true, duplicate: true });
      }
    }

    const timestamp = logTimestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const nutritionNote = `Nutrition tracked at ${timestamp}`;

    const result = await prisma.$transaction(async (tx) => {
      const existingCountToday = await tx.foodLog.count({
        where: {
          userId: user.id,
          OR: [
            { localDate: resolvedLocalDate },
            { localDate: null, loggedAt: { gte: taskDate, lt: nextTaskDate } },
          ],
        },
      });

      const log = await tx.foodLog.create({
        data: {
          ...(stableLogId ? { id: stableLogId } : {}),
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
          localDate: resolvedLocalDate,
          localTime: resolvedLocalTime,
          loggedAt: logTimestamp,
          mealType,
        },
        select: { id: true },
      });

      await tx.dailyTask.upsert({
        where: {
          userId_date_taskName: {
            userId: user.id,
            date: taskDate,
            taskName: 'meals',
          },
        },
        update: { completed: true },
        create: {
          userId: user.id,
          date: taskDate,
          taskName: 'meals',
          completed: true,
        },
      });

      let pointsAwarded = 0;
      if (existingCountToday === 0) {
        await tx.gamificationPoint.create({
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

      const existingJournal = await tx.journalEntry.findFirst({
        where: {
          userId: user.id,
          OR: [
            { localDate: resolvedLocalDate },
            { localDate: null, date: { gte: taskDate, lt: nextTaskDate } },
          ],
        },
      });

      if (existingJournal) {
        let entryData: any = {};
        try {
          entryData = existingJournal.entry ? JSON.parse(existingJournal.entry as string) : {};
        } catch {
          entryData = {};
        }

        const previous = entryData.nutritionNotes ? `${entryData.nutritionNotes}\n` : '';
        entryData.nutritionNotes = `${previous}${nutritionNote}`;
        entryData.tasksCompleted = { ...(entryData.tasksCompleted || {}), meals: true };

        await tx.journalEntry.update({
          where: { id: existingJournal.id },
          data: { entry: JSON.stringify(entryData), localDate: resolvedLocalDate },
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

        await tx.journalEntry.create({
          data: {
            id: journalEntryIdForDay(user.id, resolvedLocalDate),
            userId: user.id,
            entry: JSON.stringify(entryData),
            mood: null,
            weight: null,
            date: logTimestamp,
            localDate: resolvedLocalDate,
          },
        });
      }

      return { log, pointsAwarded };
    });

    return NextResponse.json({
      ok: true,
      logId: result.log.id,
      pointsAwarded: result.pointsAwarded,
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
