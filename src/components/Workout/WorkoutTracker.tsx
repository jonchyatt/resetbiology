"use client";

import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { Dumbbell, Activity, Flame, Clock, Calendar, TrendingUp } from "lucide-react";
import { WorkoutQuickAdd, WorkoutQuickAddResult } from "./WorkoutQuickAdd";
import { RecentWorkouts } from "./RecentWorkouts";

interface WorkoutEntry {
  id: string;
  name: string;
  category: string;
  intensity?: string | null;
  totalSets: number;
  totalReps: number;
  totalWeight: number;
  durationSeconds: number;
  completedAt: string;
  notes?: string | null;
}

export function WorkoutTracker() {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [todaysWorkouts, setTodaysWorkouts] = useState<WorkoutEntry[]>([]);
  const [logSuccess, setLogSuccess] = useState<WorkoutQuickAddResult | null>(null);
  const [recentRefresh, setRecentRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historyItems, setHistoryItems] = useState<WorkoutEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodaysWorkouts();
  }, []);

  useEffect(() => {
    if (activeTab !== 'history') return;
    fetchHistory();
  }, [activeTab, historyRefresh]);

  useEffect(() => {
    if (!logSuccess) return;
    const timer = setTimeout(() => setLogSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [logSuccess]);

  const fetchTodaysWorkouts = async () => {
    try {
      const response = await fetch('/api/workouts/recent?limit=100', { cache: 'no-store' });
      const data = await response.json();
      if (!data?.ok || !Array.isArray(data.items)) {
        throw new Error(data?.error || 'Failed to load workouts');
      }

      const todayKey = new Date().toDateString();
      const todays = data.items
        .filter((session: any) => new Date(session.completedAt).toDateString() === todayKey)
        .map(transformSession)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      setTodaysWorkouts(todays);
    } catch (error) {
      console.error('Error loading today\'s workouts:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const response = await fetch('/api/workouts/recent?limit=200', { cache: 'no-store' });
      const data = await response.json();
      if (!data?.ok || !Array.isArray(data.items)) {
        throw new Error(data?.error || 'Failed to load workout history');
      }

      const entries = data.items
        .map(transformSession)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setHistoryItems(entries);
    } catch (error: any) {
      console.error('History error', error);
      setHistoryError(error?.message || 'Unable to load workout history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const todaysTotals = useMemo(() => {
    return todaysWorkouts.reduce(
      (acc, workout) => ({
        sets: acc.sets + workout.totalSets,
        reps: acc.reps + workout.totalReps,
        weight: acc.weight + workout.totalWeight,
        duration: acc.duration + workout.durationSeconds,
      }),
      { sets: 0, reps: 0, weight: 0, duration: 0 }
    );
  }, [todaysWorkouts]);

  const workoutsByCategory = useMemo(() => {
    const groups: Record<string, WorkoutEntry[]> = {};
    todaysWorkouts.forEach((workout) => {
      const key = workout.category?.toLowerCase() || 'general';
      if (!groups[key]) groups[key] = [];
      groups[key].push(workout);
    });
    return groups;
  }, [todaysWorkouts]);

  const groupedHistory = useMemo(() => {
    if (!historyItems || historyItems.length === 0) return [];

    const groups = new Map<string, {
      key: string;
      date: Date;
      label: string;
      totals: { sets: number; reps: number; weight: number; duration: number };
      entries: WorkoutEntry[];
    }>();

    historyItems.forEach((entry) => {
      const date = new Date(entry.completedAt);
      const key = date.toISOString().split('T')[0];
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          date,
          label: date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          totals: { sets: 0, reps: 0, weight: 0, duration: 0 },
          entries: [],
        });
      }
      const group = groups.get(key)!;
      group.entries.push(entry);
      group.totals.sets += entry.totalSets;
      group.totals.reps += entry.totalReps;
      group.totals.weight += entry.totalWeight;
      group.totals.duration += entry.durationSeconds;
    });

    return Array.from(groups.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((group) => ({
        ...group,
        entries: group.entries.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
      }));
  }, [historyItems]);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '—';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return '<1 min';
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (hours > 0) return `${hours}h ${remaining}m`;
    return `${minutes} min`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {logSuccess && (
        <div className="fixed right-6 top-24 z-40 max-w-sm rounded-xl border border-secondary-400/40 bg-secondary-500/20 px-4 py-3 text-sm text-secondary-100 shadow-2xl backdrop-blur">
          <p className="font-semibold">Workout logged!</p>
          {logSuccess.pointsAwarded > 0 && (
            <p className="mt-1 text-secondary-200">+{logSuccess.pointsAwarded} points added today.</p>
          )}
          {logSuccess.journalNote && (
            <p className="mt-1 text-secondary-100/80">Journal updated: {logSuccess.journalNote}</p>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 drop-shadow-lg" />
              <div>
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Portal</h1>
                <span className="text-lg text-gray-200 drop-shadow-sm">• Workout Tracker</span>
              </div>
            </div>
            <a href="/portal" className="text-secondary-300 hover:text-secondary-200 font-medium text-sm transition-colors drop-shadow-sm">
              ← Back to Portal
            </a>
          </div>
        </div>
      </div>

      <div className="text-center py-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          <span className="text-secondary-400">Workout</span> Tracker
        </h2>
        <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto">
          Log strength and cardio sessions, visualize progress, and keep your daily streak alive.
        </p>
      </div>

      <div className="container mx-auto px-4 pb-8">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-secondary-600/20 to-secondary-700/20 backdrop-blur-sm rounded-xl p-1 border border-secondary-400/30 hover:shadow-secondary-400/20 transition-all duration-300">
            {(['today', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                  activeTab === tab ? 'bg-secondary-500 text-white shadow-lg' : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {tab === 'today' ? 'Today' : 'History'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'today' && (
          <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <WorkoutQuickAdd
                onLogged={(result) => {
                  fetchTodaysWorkouts();
                  setRecentRefresh((prev) => prev + 1);
                  setHistoryRefresh((prev) => prev + 1);
                  setLogSuccess(result);
                }}
              />
              <RecentWorkouts refreshToken={recentRefresh} />

              <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-2xl">
                <div className="grid gap-4 md:grid-cols-4">
                  <SummaryCard icon={<Dumbbell className="h-5 w-5" />} label="Total Sets" value={todaysTotals.sets} />
                  <SummaryCard icon={<Activity className="h-5 w-5" />} label="Total Reps" value={todaysTotals.reps} />
                  <SummaryCard icon={<Flame className="h-5 w-5" />} label="Total Volume" value={todaysTotals.weight > 0 ? `${Math.round(todaysTotals.weight)} lbs` : 'Bodyweight'} />
                  <SummaryCard icon={<Clock className="h-5 w-5" />} label="Active Time" value={formatDuration(todaysTotals.duration)} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Dumbbell className="h-5 w-5 mr-2 text-secondary-400"/>Today\'s Sessions
                </h3>

                {Object.keys(workoutsByCategory).length === 0 ? (
                  <p className="text-gray-400 text-sm italic">No workouts logged yet.</p>
                ) : (
                  Object.entries(workoutsByCategory).map(([category, workouts]) => (
                    <div key={category} className="mb-6 last:mb-0">
                      <h4 className="text-secondary-300 font-semibold mb-2 capitalize">{category}</h4>
                      <div className="space-y-2">
                        {workouts.map((workout) => (
                          <div key={workout.id} className="bg-gray-700/30 rounded-lg p-3 flex justify-between items-start">
                            <div>
                              <p className="text-white font-medium">{workout.name}</p>
                              <p className="text-gray-400 text-xs">
                                {workout.totalSets} sets • {workout.totalReps} reps
                                {workout.totalWeight > 0 ? ` • ${Math.round(workout.totalWeight)} lbs` : ''}
                              </p>
                              <p className="text-gray-500 text-xs">{new Date(workout.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                            </div>
                            {workout.notes && (
                              <p className="text-xs text-gray-400 max-w-xs line-clamp-3">{workout.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-2xl">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-secondary-400"/>Daily Goal
                </h4>
                <p className="text-gray-300 text-sm">Log at least one workout to keep your streak alive.</p>
                <div className="mt-3 rounded-lg border border-secondary-400/20 bg-secondary-500/10 px-3 py-2 text-sm text-secondary-100">
                  {todaysWorkouts.length > 0 ? 'Goal completed' : 'No workout yet today'}
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-secondary-400"/>Progress
                </h4>
                <p className="text-gray-300 text-sm">Weekly charts and PR tracking coming soon.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-secondary-300" />
                  <h3 className="text-xl font-bold text-white">Workout History</h3>
                </div>
                <button
                  onClick={() => setHistoryRefresh((prev) => prev + 1)}
                  className="rounded-lg border border-secondary-400/40 bg-secondary-500/10 px-4 py-2 text-sm font-medium text-secondary-200 transition hover:border-secondary-400/60 hover:bg-secondary-500/20"
                >
                  Refresh
                </button>
              </div>

              {historyLoading ? (
                <div className="py-8 text-center text-sm text-gray-300">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-secondary-300 border-t-transparent" />
                  Loading workout history...
                </div>
              ) : historyError ? (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {historyError}
                </div>
              ) : groupedHistory.length === 0 ? (
                <div className="py-10 text-center text-gray-300">
                  <p>No workouts logged yet.</p>
                  <p className="text-sm text-gray-400">Log workouts to build your history.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                  {groupedHistory.map((group) => (
                    <div key={group.key} className="rounded-xl border border-secondary-400/30 bg-gray-900/50 p-4 shadow-lg">
                      <div className="flex items-center justify-between gap-4 border-b border-secondary-400/20 pb-3">
                        <div>
                          <p className="text-lg font-semibold text-white">{group.label}</p>
                          <p className="text-xs text-gray-400">{group.date.toLocaleDateString()}</p>
                        </div>
                        <div className="text-right text-sm text-gray-300">
                          <p className="text-white font-semibold">{group.entries.length} session{group.entries.length === 1 ? '' : 's'}</p>
                          <p className="text-xs text-gray-400">
                            {group.totals.sets} sets • {group.totals.reps} reps • {group.totals.weight > 0 ? `${Math.round(group.totals.weight)} lbs` : 'Bodyweight'}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {group.entries.map((entry) => (
                          <li key={entry.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-700/40 bg-gray-800/40 px-3 py-2 text-sm text-gray-100">
                            <div>
                              <p className="font-medium text-white">{entry.name}</p>
                              <p className="text-xs text-gray-400">
                                {entry.totalSets} sets • {entry.totalReps} reps • {formatDuration(entry.durationSeconds)}
                              </p>
                              {entry.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{entry.notes}</p>}
                            </div>
                            <div className="text-right text-xs text-gray-400">
                              <p>{new Date(entry.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SummaryCard = ({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) => (
  <div className="rounded-lg border border-secondary-400/30 bg-gray-900/50 p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-secondary-200">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary-500/20">{icon}</span>
      <span className="text-xs uppercase tracking-wide text-secondary-200">{label}</span>
    </div>
    <p className="text-2xl font-semibold text-white">{value}</p>
  </div>
);

function transformSession(session: any): WorkoutEntry {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  const primary = exercises[0] ?? {};

  const totalSets = exercises.reduce((acc: number, ex: any) => acc + (Array.isArray(ex?.sets) ? ex.sets.length : 0), 0);
  const totalReps = exercises.reduce((acc: number, ex: any) => acc + (Array.isArray(ex?.sets)
    ? ex.sets.reduce((setSum: number, set: any) => setSum + (Number(set?.reps) || 0), 0)
    : 0), 0);
  const totalWeight = exercises.reduce((acc: number, ex: any) => acc + (Array.isArray(ex?.sets)
    ? ex.sets.reduce((setSum: number, set: any) =>
        setSum + ((Number(set?.reps) || 0) * (Number(set?.weight) || 0)), 0)
    : 0), 0);

  return {
    id: session?.id,
    name: primary?.name || 'Workout session',
    category: primary?.category || 'General',
    intensity: primary?.intensity ?? session?.notes ?? null,
    totalSets,
    totalReps,
    totalWeight,
    durationSeconds: Number(session?.duration) || 0,
    completedAt: session?.completedAt || new Date().toISOString(),
    notes: session?.notes ?? primary?.notes ?? null,
  };
}
