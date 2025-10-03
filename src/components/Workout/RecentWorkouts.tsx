"use client";

import { useEffect, useState } from "react";

interface WorkoutSessionSummary {
  id: string;
  exercises: Array<{
    name?: string;
    category?: string;
    intensity?: string | null;
    sets?: Array<{ reps: number; weight?: number | null }>;
  }>;
  duration: number;
  notes?: string | null;
  completedAt: string;
}

export function RecentWorkouts({ refreshToken = 0 }: { refreshToken?: number }) {
  const [items, setItems] = useState<WorkoutSessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventRefresh, setEventRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/workouts/recent', { cache: 'no-store' });
        const data = await res.json();
        if (!data?.ok) throw new Error(data?.error || 'Failed to load workouts');
        const entries = Array.isArray(data.items) ? data.items : [];
        setItems(entries);
      } catch (err: any) {
        console.error('Recent workouts error', err);
        setError(err?.message || 'Unable to load recent workouts');
      }
    })();
  }, [refreshToken, eventRefresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => setEventRefresh((prev) => prev + 1);
    window.addEventListener('workout:log-success', handler);
    return () => {
      window.removeEventListener('workout:log-success', handler);
    };
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 shadow-lg text-sm text-rose-200">
        Recent workouts load error: {error}
      </section>
    );
  }

  if (!items) {
    return (
      <section className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-6 shadow-lg text-sm text-slate-300">
        Loading recent workouts...
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-6 shadow-lg text-sm text-slate-300">
        Log a workout to see it here.
      </section>
    );
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '—';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return '<1 min';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes} min`;
  };

  return (
    <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-secondary-300">Recent activity</p>
          <h2 className="text-lg font-semibold text-white">Latest workouts</h2>
        </div>
        <span className="text-xs text-slate-400">Last {items.length} sessions</span>
      </div>

      <ul className="mt-4 space-y-3">
        {items.map((session) => {
          const exercise = session.exercises?.[0] ?? {};
          const summarySets = Array.isArray(exercise.sets) ? exercise.sets.length : 0;
          const firstSet = Array.isArray(exercise.sets) ? exercise.sets[0] : undefined;
          return (
            <li key={session.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-700/40 bg-slate-950/60 px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-white">
                  {exercise.name || 'Workout session'}
                  {exercise.intensity ? <span className="ml-2 text-xs text-secondary-300">{exercise.intensity}</span> : null}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {exercise.category || 'General'} • {summarySets} set{summarySets === 1 ? '' : 's'}
                  {firstSet?.reps ? ` • ${firstSet.reps} reps` : ''}
                  {typeof firstSet?.weight === 'number' && firstSet.weight > 0 ? ` @ ${firstSet.weight} lbs` : ''}
                </div>
                {session.notes && (
                  <p className="text-xs text-slate-400 line-clamp-2">{session.notes}</p>
                )}
              </div>
              <div className="text-right text-xs text-slate-400">
                <p className="text-sm font-semibold text-white">{formatDuration(session.duration)}</p>
                <p>{new Date(session.completedAt).toLocaleString()}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
