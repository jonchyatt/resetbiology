import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      exercise,
      log,
    } = body ?? {};

    if (!exercise?.id && !exercise?.name) {
      return NextResponse.json({ ok: false, error: 'Missing exercise details' }, { status: 400 });
    }

    const exerciseName = (exercise.name ?? '').trim();
    const category = exercise.category ?? log?.sessionType ?? 'General';
    const primaryMuscles = Array.isArray(exercise.primaryMuscles) ? exercise.primaryMuscles : [];

    const setsCount = Math.max(1, Number(log?.sets) || 1);
    const reps = Math.max(0, Number(log?.reps) || 10);
    const weight = log?.weight !== undefined && log?.weight !== null ? Number(log.weight) : null;
    const durationMinutes = log?.durationMinutes !== undefined && log?.durationMinutes !== null ? Math.max(0, Number(log.durationMinutes)) : null;
    const notes: string | null = log?.notes ? String(log.notes) : null;
    const intensity = log?.intensity ? String(log.intensity) : null;
    const localDate = log?.localDate || null;
    const localTime = log?.localTime || null;

    const sets = Array.from({ length: setsCount }).map(() => ({
      reps,
      weight,
      completed: true,
    }));

    const durationSeconds = durationMinutes !== null ? Math.round(durationMinutes * 60) : setsCount * 90;
    const now = new Date();

    const sessionData = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        exercises: [
          {
            id: exercise.id ? `wger-${exercise.id}` : `custom-${exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: exerciseName || 'Unknown exercise',
            category,
            primaryMuscles,
            intensity,
            notes,
            sets,
            source: 'wger',
          },
        ],
        duration: durationSeconds,
        notes,
        completedAt: now,
        localDate,
        localTime,
      },
    });

    // Mark daily workout task completed
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: startOfDay,
          taskName: 'workout',
        },
      },
      update: { completed: true },
      create: {
        userId: user.id,
        date: startOfDay,
        taskName: 'workout',
        completed: true,
      },
    });

    // Award points only for the first logged workout of the day
    const nextDay = new Date(startOfDay);
    nextDay.setDate(nextDay.getDate() + 1);

    const workoutsToday = await prisma.workoutSession.count({
      where: {
        userId: user.id,
        completedAt: {
          gte: startOfDay,
          lt: nextDay,
        },
      },
    });

    let pointsAwarded = 0;
    if (workoutsToday === 1) {
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          amount: 40,
          pointType: 'fitness',
          activitySource: 'Logged workout session',
          earnedAt: now,
        },
      });
      pointsAwarded = 40;
    }

    const timestamp = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const workoutNote = `Workout logged (${exerciseName || 'Workout'}) at ${timestamp}`;

    const existingJournal = await prisma.journalEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: startOfDay,
          lt: nextDay,
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

      const previous = entryData.workoutNotes ? `${entryData.workoutNotes}\n` : '';
      entryData.workoutNotes = `${previous}${workoutNote}`;
      const tasksCompleted = entryData.tasksCompleted || {};
      tasksCompleted.workout = true;
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
        workoutNotes: workoutNote,
        nutritionNotes: '',
        breathNotes: '',
        moduleNotes: '',
        tasksCompleted: { workout: true },
      };

      await prisma.journalEntry.create({
        data: {
          userId: user.id,
          entry: JSON.stringify(entryData),
          mood: null,
          weight: null,
          date: now,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      sessionId: sessionData.id,
      pointsAwarded,
      journalNote: workoutNote,
      dailyTaskCompleted: true,
    });
  } catch (error: any) {
    console.error('POST /api/workouts/log error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to log workout' }, { status: 500 });
  }
}
