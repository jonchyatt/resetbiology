"use client";

import type { WorkoutEntry } from "./WorkoutTracker";

// W1a item 1 (F4.2 + NEW4): props-driven now -- WorkoutTracker owns the single
// /api/workouts/recent fetch and passes the already-transformed, locally-bucketed
// entries down. This component no longer fetches on its own (removes fetch #3 of 3).
export function RecentWorkouts({ items }: { items: WorkoutEntry[] }) {
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
        {items.map((entry) => (
          <li key={entry.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-700/40 bg-slate-950/60 px-4 py-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">
                {entry.name}
                {entry.intensity ? <span className="ml-2 text-xs text-secondary-300">{entry.intensity}</span> : null}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {entry.category} • {entry.totalSets} set{entry.totalSets === 1 ? '' : 's'}
                {entry.totalReps > 0 ? ` • ${entry.totalReps} reps` : ''}
                {entry.totalWeight > 0 ? ` • ${Math.round(entry.totalWeight)} lbs` : ''}
              </div>
              {entry.notes && (
                <p className="text-xs text-slate-400 line-clamp-2">{entry.notes}</p>
              )}
            </div>
            <div className="text-right text-xs text-slate-400">
              <p className="text-sm font-semibold text-white">{formatDuration(entry.durationSeconds)}</p>
              <p>{new Date(entry.completedAt).toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
