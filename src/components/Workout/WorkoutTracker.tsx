"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { WorkoutQuickAdd, WorkoutQuickAddResult } from "./WorkoutQuickAdd";
import { RecentWorkouts } from "./RecentWorkouts";
import {
  AssignmentPlanSession,
  AssignmentPersonalization,
  WorkoutAssignmentRecord,
  WorkoutCheckInRecord,
  WorkoutProtocolRecord,
} from "@/types/workout";

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

const equipmentOptions = ["Barbell", "Dumbbell", "Bands", "Kettlebell", "Bodyweight", "Machines"];

const goalOptions = [
  { label: "Strength & Lean Mass", value: "strength" },
  { label: "Metabolic Flexibility", value: "metabolic" },
  { label: "Recovery & Longevity", value: "recovery" },
];

const sessionTimeOptions = [
  { label: "Morning", value: "morning" },
  { label: "Midday", value: "midday" },
  { label: "Evening", value: "evening" },
];

const recoveryFocusOptions = [
  { label: "Standard", value: "standard" },
  { label: "High CNS Fatigue", value: "cns" },
  { label: "Joint Repair", value: "joint" },
];

const classNames = (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" ");

export function WorkoutTracker() {
  const [todaysWorkouts, setTodaysWorkouts] = useState<WorkoutEntry[]>([]);
  const [historyItems, setHistoryItems] = useState<WorkoutEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState<WorkoutQuickAddResult | null>(null);
  const [recentRefresh, setRecentRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [protocols, setProtocols] = useState<WorkoutProtocolRecord[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(false);
  const [assignments, setAssignments] = useState<WorkoutAssignmentRecord[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [checkIns, setCheckIns] = useState<WorkoutCheckInRecord[]>([]);
  const [checkInsLoading, setCheckInsLoading] = useState(false);

  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningProtocolId, setAssigningProtocolId] = useState<string | null>(null);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);

  const [preferredEquipment, setPreferredEquipment] = useState<string[]>(["Barbell", "Dumbbell"]);
  const [goalPriority, setGoalPriority] = useState(goalOptions[0].value);
  const [sessionPreference, setSessionPreference] = useState(sessionTimeOptions[0].value);
  const [recoveryFocus, setRecoveryFocus] = useState(recoveryFocusOptions[0].value);

  const [readinessPayload, setReadinessPayload] = useState({
    readinessScore: 80,
    energyLevel: 7,
    sorenessLevel: 3,
    sleepHours: 7,
    stressLevel: 3,
    mood: "Focused",
    notes: "",
  });
  const fetchTodaysWorkouts = useCallback(async () => {
    try {
      const response = await fetch("/api/workouts/recent?limit=100", { cache: "no-store" });
      const data = await response.json();
      if (!data?.ok || !Array.isArray(data.items)) {
        throw new Error(data?.error || "Failed to load workouts");
      }
      const todayKey = new Date().toDateString();
      const todays = data.items
        .filter((session: any) => new Date(session.completedAt).toDateString() === todayKey)
        .map(transformSession)
        .sort((a: WorkoutEntry, b: WorkoutEntry) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setTodaysWorkouts(todays);
    } catch (error) {
      console.error("Error loading today's workouts:", error);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const response = await fetch("/api/workouts/recent?limit=200", { cache: "no-store" });
      const data = await response.json();
      if (!data?.ok || !Array.isArray(data.items)) {
        throw new Error(data?.error || "Failed to load workout history");
      }
      const entries = data.items
        .map(transformSession)
        .sort((a: WorkoutEntry, b: WorkoutEntry) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setHistoryItems(entries);
    } catch (error: any) {
      console.error("History error", error);
      setHistoryError(error?.message || "Unable to load workout history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchProtocols = useCallback(async () => {
    try {
      setProtocolsLoading(true);
      const res = await fetch("/api/workouts/protocols", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Unable to load protocols");
      setProtocols(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Protocols error", error);
    } finally {
      setProtocolsLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      setAssignmentsLoading(true);
      const res = await fetch("/api/workouts/assignments", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Unable to load assignments");
      setAssignments(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Assignments error", error);
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  const fetchCheckIns = useCallback(async () => {
    try {
      setCheckInsLoading(true);
      const res = await fetch("/api/workouts/checkins", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Unable to load check-ins");
      setCheckIns(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Check-in error", error);
    } finally {
      setCheckInsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodaysWorkouts();
    fetchProtocols();
    fetchAssignments();
    fetchCheckIns();
  }, [fetchTodaysWorkouts, fetchProtocols, fetchAssignments, fetchCheckIns]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, historyRefresh]);

  useEffect(() => {
    if (!logSuccess) return;
    const timer = setTimeout(() => setLogSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [logSuccess]);

  const todaysTotals = useMemo(
    () =>
      todaysWorkouts.reduce(
        (acc, workout) => ({
          sets: acc.sets + workout.totalSets,
          reps: acc.reps + workout.totalReps,
          weight: acc.weight + workout.totalWeight,
          duration: acc.duration + workout.durationSeconds,
        }),
        { sets: 0, reps: 0, weight: 0, duration: 0 }
      ),
    [todaysWorkouts]
  );

  const workoutsByCategory = useMemo(() => {
    const groups: Record<string, WorkoutEntry[]> = {};
    todaysWorkouts.forEach((workout) => {
      const key = workout.category?.toLowerCase() || "general";
      if (!groups[key]) groups[key] = [];
      groups[key].push(workout);
    });
    return groups;
  }, [todaysWorkouts]);

  const groupedHistory = useMemo(() => {
    if (!historyItems || historyItems.length === 0) return [];
    const groups = new Map<
      string,
      {
        key: string;
        date: Date;
        label: string;
        totals: { sets: number; reps: number; weight: number; duration: number };
        entries: WorkoutEntry[];
      }
    >();

    historyItems.forEach((entry) => {
      const date = new Date(entry.completedAt);
      const key = date.toISOString().split("T")[0];
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          date,
          label: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
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

    return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [historyItems]);

  const activeAssignment = useMemo(() => assignments.find((assignment) => assignment.status === "active") ?? null, [assignments]);
  const activePlanSessions = useMemo(
    () => ((activeAssignment?.plan?.sessions ?? []) as AssignmentPlanSession[]),
    [activeAssignment]
  );
  const nextSession = useMemo(
    () => activePlanSessions.find((session) => session.status === "planned" || session.status === "in-progress") ?? null,
    [activePlanSessions]
  );
  const completedSessions = activePlanSessions.filter((session) => session.status === "completed").length;
  const skippedSessions = activePlanSessions.filter((session) => session.status === "skipped").length;
  const planCompletionRate = activePlanSessions.length > 0 ? completedSessions / activePlanSessions.length : 0;

  const readinessSummary = useMemo(() => {
    if (checkIns.length === 0) return null;
    const latest = checkIns[0];
    const avg =
      checkIns.reduce(
        (acc, entry) => ({
          readiness: acc.readiness + (entry.readinessScore ?? 0),
          energy: acc.energy + (entry.energyLevel ?? 0),
          samples: acc.samples + 1,
        }),
        { readiness: 0, energy: 0, samples: 0 }
      );
    return {
      latest,
      averages: {
        readiness: Math.round(avg.readiness / (avg.samples || 1)),
        energy: Number((avg.energy / (avg.samples || 1)).toFixed(1)),
      },
    };
  }, [checkIns]);
  const toggleEquipment = (item: string) => {
    setPreferredEquipment((prev) => {
      if (prev.includes(item)) {
        return prev.filter((value) => value !== item);
      }
      return [...prev, item];
    });
  };

  const handleAssignProtocol = async (protocolId: string) => {
    setAssignError(null);
    setAssigningProtocolId(protocolId);
    try {
      const personalization: AssignmentPersonalization = {
        availableEquipment: preferredEquipment,
        goalPriority,
        sessionTimePreference: sessionPreference as AssignmentPersonalization["sessionTimePreference"],
        recoveryFocus,
      };
      const res = await fetch("/api/workouts/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolId, personalization }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to assign protocol");
      }
      await fetchAssignments();
      await fetchProtocols();
    } catch (error: any) {
      console.error("Assign protocol error", error);
      setAssignError(error?.message || "Unable to assign protocol");
    } finally {
      setAssigningProtocolId(null);
    }
  };

  const handleSessionAction = async (action: "complete-session" | "skip-session", sessionId: string, notes?: string) => {
    if (!activeAssignment) return;
    setSessionActionLoading(true);
    try {
      const res = await fetch(`/api/workouts/assignments/${activeAssignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId, notes: notes ?? null }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to update session");
      }
      await Promise.all([fetchAssignments(), fetchTodaysWorkouts()]);
      setRecentRefresh((prev) => prev + 1);
      setHistoryRefresh((prev) => prev + 1);
    } catch (error) {
      console.error("Session action error", error);
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleCheckInSubmit = async () => {
    setCheckInSubmitting(true);
    try {
      const payload = {
        ...readinessPayload,
        assignmentId: activeAssignment?.id ?? null,
      };
      const res = await fetch("/api/workouts/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to save readiness");
      }
      await fetchCheckIns();
      setReadinessPayload((prev) => ({ ...prev, notes: "" }));
    } catch (error) {
      console.error("Check-in submit error", error);
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const handleQuickAddLogged = useCallback(
    (result: WorkoutQuickAddResult) => {
      fetchTodaysWorkouts();
      setRecentRefresh((prev) => prev + 1);
      setHistoryRefresh((prev) => prev + 1);
      setLogSuccess(result);
    },
    [fetchTodaysWorkouts]
  );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-10">
        {/* Header - Added mt-16 to create proper space below fixed nav (nav is h-16 = 64px) */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo1.png"
                  alt="Reset Biology"
                  className="h-10 w-auto rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
                />
                <div>
                  <div className="flex items-center">
                    <a
                      href="/portal"
                      className="text-xl font-bold text-white drop-shadow-lg hover:text-primary-300 transition-colors"
                    >
                      Portal
                    </a>
                    <span className="mx-2 text-primary-300">&gt;</span>
                    <span className="text-lg text-gray-200 drop-shadow-sm">
                      Workout Tracker
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="/portal"
                  className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm"
                >
                  ← Back to Portal
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-primary-400">Workout</span> Tracker
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm">
            Custom fitness programs with analytics. Track your strength gains, endurance metrics, and body composition progress.
          </p>
        </div>

        <div className="space-y-8 px-4 md:px-10">

      {logSuccess && (
        <div className="fixed right-6 top-20 z-40 max-w-sm rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-50 shadow-2xl backdrop-blur">
          <p className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Workout logged!
          </p>
          {logSuccess.pointsAwarded > 0 && (
            <p className="mt-1 text-emerald-100/90">+{logSuccess.pointsAwarded} points awarded today.</p>
          )}
          {logSuccess.journalNote && <p className="mt-1 text-emerald-50/80">Journal: {logSuccess.journalNote}</p>}
        </div>
      )}

      <section className="relative z-10 grid gap-5 lg:grid-cols-4">
        <StatCard
          icon={<Dumbbell className="h-5 w-5 text-secondary-200" />}
          label="Total Sets"
          value={todaysTotals.sets}
          subtext={todaysWorkouts.length > 0 ? `${todaysWorkouts.length} sessions` : "Log a session"}
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-200" />}
          label="Total Reps"
          value={todaysTotals.reps}
          subtext={`${Math.round(todaysTotals.weight).toLocaleString()} lbs moved`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-sky-200" />}
          label="Time Under Tension"
          value={formatDuration(todaysTotals.duration)}
          subtext="Across all logged work"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-200" />}
          label="Protocol Completion"
          value={`${Math.round(planCompletionRate * 100)}%`}
          subtext={activeAssignment ? `${completedSessions}/${activePlanSessions.length} sessions` : "No active protocol"}
        />
      </section>

      <div className="relative z-10 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Active protocol</p>
                <h2 className="text-2xl font-semibold text-white">
                  {activeAssignment?.protocol?.name ?? "Select a protocol to unlock prescriptions"}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {activeAssignment?.protocol?.summary ??
                    "Intelligent protocol-driven training taps into your peptide timing, nutrition, and accountability stack."}
                </p>
              </div>
              <button
                onClick={() => fetchAssignments()}
                className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-200 transition hover:border-white/40"
              >
                Refresh
              </button>
            </div>
            {assignmentsLoading ? (
              <p className="mt-6 text-sm text-slate-300">Loading assignment intelligence…</p>
            ) : activeAssignment ? (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <AssignmentBadge
                    label="Status"
                    value={activeAssignment.status === "active" ? "On track" : activeAssignment.status}
                    accent="from-emerald-500/20 to-emerald-500/5"
                  />
                  <AssignmentBadge
                    label="Completed sessions"
                    value={`${completedSessions}`}
                    accent="from-sky-500/20 to-sky-500/5"
                  />
                  <AssignmentBadge
                    label="Skipped"
                    value={`${skippedSessions}`}
                    accent="from-rose-500/20 to-rose-500/5"
                  />
                </div>

                {nextSession ? (
                  <div className="mt-6 rounded-2xl border border-primary-400/30 bg-gray-900/40 p-5 shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ListChecks className="h-6 w-6 text-secondary-200" />
                        <div>
                          <p className="text-xs uppercase tracking-[0.25em] text-secondary-200/70">Next prescription</p>
                          <h3 className="text-lg font-semibold text-white">{nextSession.title}</h3>
                          <p className="text-sm text-slate-400">
                            Scheduled {nextSession.scheduledDate ? new Date(nextSession.scheduledDate).toLocaleString() : "soon"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase text-slate-400">Intensity</p>
                        <p className="text-base font-semibold text-white">{nextSession.intensity}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {nextSession.blocks.slice(0, 3).map((block, blockIndex) => (
                        <div
                          key={`${block.label}-${blockIndex}`}
                          className="rounded-xl border border-primary-400/20 bg-gray-900/30 px-4 py-3 text-sm text-slate-200"
                        >
                          <p className="font-semibold text-white">{block.label}</p>
                          <p className="text-xs uppercase tracking-wide text-secondary-200/70">{block.focus}</p>
                          <ul className="mt-2 space-y-1 text-slate-300">
                            {block.exercises.slice(0, 3).map((exercise, exerciseIndex) => (
                              <li key={`${exercise.key}-${exerciseIndex}`}>
                                {exercise.name} • {exercise.sets?.map((set) => set.reps ?? set.durationSeconds ?? "-").join(" / ")}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        disabled={sessionActionLoading}
                        onClick={() => handleSessionAction("complete-session", nextSession.id)}
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-secondary-500/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-secondary-500/30 transition hover:bg-secondary-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mark Session Complete
                      </button>
                      <button
                        disabled={sessionActionLoading}
                        onClick={() => handleSessionAction("skip-session", nextSession.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Skip Today
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 rounded-xl border border-primary-400/20 bg-gray-900/30 p-4 text-sm text-slate-300">
                    Every planned session in this block is complete. Assign a new protocol or resume a paused one.
                  </p>
                )}
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-6 text-sm text-slate-200">
                <p className="font-semibold text-white">No active assignment</p>
                <p className="mt-2 text-slate-300">
                  Tap any curated protocol below to auto-build an actionable program complete with readiness guardrails and accountability.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Today</p>
                <h2 className="text-xl font-semibold text-white">Logged sessions</h2>
              </div>
              <button
                onClick={() => fetchTodaysWorkouts()}
                className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-200 transition hover:border-white/40"
              >
                Refresh
              </button>
            </div>

            {todaysWorkouts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-primary-400/20 bg-gray-900/30 p-6 text-center text-slate-300">
                <p>No training logged yet today.</p>
                <p className="text-sm text-slate-400">Start a prescribed session or use quick add.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {Object.entries(workoutsByCategory).map(([category, workouts]) => (
                  <div key={category} className="rounded-2xl border border-primary-400/30 bg-gray-900/40 p-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-white">
                        <Activity className="h-4 w-4 text-secondary-200" />
                        <p className="text-sm font-semibold uppercase tracking-wide">{category}</p>
                      </div>
                      <p className="text-xs text-slate-400">{workouts.length} session{workouts.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {workouts.map((workout) => (
                        <div key={workout.id} className="rounded-xl border border-primary-400/20 bg-gray-900/30 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{workout.name}</p>
                              <p className="text-xs uppercase tracking-wide text-secondary-200/70">{workout.intensity ?? "self-paced"}</p>
                            </div>
                            <p className="text-xs text-slate-400">
                              {new Date(workout.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            {workout.totalSets} sets • {workout.totalReps} reps
                            {workout.totalWeight > 0 ? ` • ${Math.round(workout.totalWeight)} lbs` : ""}
                          </div>
                          {workout.notes && <p className="mt-1 text-xs text-slate-400">{workout.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Readiness</p>
                <h2 className="text-xl font-semibold text-white">Daily check-in</h2>
                <p className="text-sm text-slate-400">Adjust prescriptions when recovery dips.</p>
              </div>
              {readinessSummary && (
                <div className="rounded-xl border border-white/10 px-3 py-2 text-right text-xs text-slate-300">
                  <p>Avg readiness: {readinessSummary.averages.readiness}%</p>
                  <p>Avg energy: {readinessSummary.averages.energy}/10</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ReadinessSlider
                label="Readiness"
                min={0}
                max={100}
                value={readinessPayload.readinessScore}
                step={5}
                onChange={(value) => setReadinessPayload((prev) => ({ ...prev, readinessScore: value }))}
              />
              <ReadinessSlider
                label="Energy"
                min={1}
                max={10}
                value={readinessPayload.energyLevel}
                onChange={(value) => setReadinessPayload((prev) => ({ ...prev, energyLevel: value }))}
              />
              <ReadinessSlider
                label="Soreness"
                min={0}
                max={10}
                value={readinessPayload.sorenessLevel}
                onChange={(value) => setReadinessPayload((prev) => ({ ...prev, sorenessLevel: value }))}
              />
              <ReadinessSlider
                label="Sleep Hours"
                min={0}
                max={10}
                step={0.5}
                value={readinessPayload.sleepHours}
                onChange={(value) => setReadinessPayload((prev) => ({ ...prev, sleepHours: value }))}
              />
              <ReadinessSlider
                label="Stress"
                min={0}
                max={10}
                value={readinessPayload.stressLevel}
                onChange={(value) => setReadinessPayload((prev) => ({ ...prev, stressLevel: value }))}
              />
              <div className="flex flex-col gap-1 text-sm">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">Mood Tag</label>
                <input
                  value={readinessPayload.mood}
                  onChange={(event) => setReadinessPayload((prev) => ({ ...prev, mood: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-secondary-400 focus:outline-none"
                  placeholder="Calm, Wired, etc."
                />
              </div>
            </div>

            <textarea
              className="mt-4 w-full rounded-2xl border border-primary-400/20 bg-gray-900/30 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-secondary-400 focus:outline-none"
              placeholder="Notes for your coach or future self…"
              value={readinessPayload.notes}
              rows={3}
              onChange={(event) => setReadinessPayload((prev) => ({ ...prev, notes: event.target.value }))}
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleCheckInSubmit}
                disabled={checkInSubmitting}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-secondary-400/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-secondary-500/30 transition hover:bg-secondary-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Log readiness
              </button>
              {readinessSummary?.latest && (
                <div className="rounded-2xl border border-white/10 px-4 py-2 text-xs text-slate-300">
                  <p>Last check-in: {new Date(readinessSummary.latest.createdAt).toLocaleString()}</p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {checkInsLoading && <p className="text-xs text-slate-400">Loading recent check-ins…</p>}
              {!checkInsLoading &&
                checkIns.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl border border-primary-400/20 bg-gray-900/30 px-3 py-2 text-xs text-slate-300">
                    <div>
                      <p className="font-semibold text-white">{entry.readinessScore ?? "--"}% readiness</p>
                      <p>Energy {entry.energyLevel ?? "--"}/10 • Soreness {entry.sorenessLevel ?? "--"}/10</p>
                    </div>
                    <p className="text-right text-[11px] uppercase tracking-widest text-slate-500">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
            <WorkoutQuickAdd
              onLogged={(result) => {
                handleQuickAddLogged(result);
              }}
            />
          </section>
          <RecentWorkouts refreshToken={recentRefresh} />
        </div>
      </div>
      <section className="relative z-10 rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Personalization</p>
            <h2 className="text-xl font-semibold text-white">Default preferences</h2>
            <p className="text-sm text-slate-400">Applied whenever you assign a protocol.</p>
          </div>
          <Brain className="h-10 w-10 text-secondary-200" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PreferenceSelect
            label="Goal Priority"
            value={goalPriority}
            onChange={setGoalPriority}
            options={goalOptions}
          />
          <PreferenceSelect
            label="Session Time"
            value={sessionPreference}
            onChange={setSessionPreference}
            options={sessionTimeOptions}
          />
          <PreferenceSelect
            label="Recovery Focus"
            value={recoveryFocus}
            onChange={setRecoveryFocus}
            options={recoveryFocusOptions}
          />
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary-200/70">Equipment on hand</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {equipmentOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleEquipment(item)}
                className={classNames(
                  "rounded-full border px-4 py-1 text-xs font-semibold transition",
                  preferredEquipment.includes(item)
                    ? "border-secondary-400/80 bg-secondary-500/10 text-secondary-100"
                    : "border-white/10 text-slate-300 hover:border-white/30"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Protocol library</p>
            <h2 className="text-2xl font-semibold text-white">Research-backed templates</h2>
            <p className="text-sm text-slate-400">Pulls in your curated AI-assisted protocols with tagging + readiness guardrails.</p>
          </div>
          <Sparkles className="h-10 w-10 text-secondary-200" />
        </div>
        {assignError && <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{assignError}</p>}
        {protocolsLoading ? (
          <p className="mt-4 text-sm text-slate-300">Loading curated protocols…</p>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {protocols.map((protocol) => (
              <article key={protocol.id} className="rounded-2xl border border-primary-400/30 bg-gray-900/40 p-5 shadow-inner">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">{protocol.name}</h3>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-200">
                    {protocol.level || "multi-level"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300 line-clamp-3">{protocol.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(protocol.tags ?? []).slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] uppercase tracking-wide text-secondary-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <ul className="mt-3 space-y-1 text-xs text-slate-400">
                  <li>Duration: {protocol.durationWeeks ?? "--"} weeks</li>
                  <li>Sessions/week: {protocol.sessionsPerWeek ?? "--"}</li>
                  <li>Focus: {(protocol.focusAreas ?? []).join(", ") || "holistic"}</li>
                </ul>
                {protocol.readinessNotes && (
                  <div className="mt-3 rounded-xl border border-primary-400/20 bg-gray-900/30 px-3 py-2 text-xs text-slate-300">
                    <p className="font-semibold text-white">Readiness rules</p>
                    <ul className="mt-1 space-y-1">
                      {protocol.readinessNotes.slice(0, 2).map((note, index) => (
                        <li key={`${protocol.id}-note-${index}`} className="flex items-start gap-2">
                          <Target className="mt-0.5 h-3 w-3 text-secondary-300" /> <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  disabled={assigningProtocolId === protocol.id}
                  onClick={() => handleAssignProtocol(protocol.id)}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-secondary-400/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-secondary-500/40 transition hover:bg-secondary-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Assign this protocol
                </button>
                {protocol.researchLinks && protocol.researchLinks.length > 0 && (
                  <div className="mt-3 text-[11px] uppercase tracking-widest text-slate-500">
                    {protocol.researchLinks.slice(0, 2).map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-3 text-secondary-200 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="relative z-10 rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">History</p>
            <h2 className="text-xl font-semibold text-white">Workout timeline</h2>
            <p className="text-sm text-slate-400">Every prescription + freestyle session captured.</p>
          </div>
          <button
            onClick={() => setHistoryRefresh((prev) => prev + 1)}
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-200 transition hover:border-white/40"
          >
            Refresh
            <Calendar className="h-3 w-3" />
          </button>
        </div>
        {historyLoading && <p className="mt-4 text-sm text-slate-300">Loading history…</p>}
        {historyError && <p className="mt-4 text-sm text-rose-200">{historyError}</p>}
        {!historyLoading && !historyError && (
          <div className="mt-6 space-y-6">
            {groupedHistory.slice(0, 10).map((day) => (
              <HistoryDay key={day.key} label={day.label} entries={day.entries} totals={day.totals} />
            ))}
            {groupedHistory.length === 0 && (
              <p className="rounded-2xl border border-primary-400/20 bg-gray-900/30 p-4 text-sm text-slate-300">
                Log your first workout to unlock the historical timeline.
              </p>
            )}
          </div>
        )}
      </section>
      </div>
      </div>
    </div>
  );
}
function StatCard({ icon, label, value, subtext }: { icon: ReactNode; label: string; value: ReactNode; subtext: string }) {
  return (
    <article className="rounded-2xl border border-primary-400/20 bg-gray-900/30 p-4 shadow-inner">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white/5 p-3">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
          <p className="text-xs text-slate-400">{subtext}</p>
        </div>
      </div>
    </article>
  );
}

function AssignmentBadge({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={classNames("rounded-2xl border border-white/5 px-4 py-3 text-sm text-slate-200 shadow-md shadow-emerald-500/20", `bg-gradient-to-br ${accent}`)}>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{label}</p>
      <p className="text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function PreferenceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-white/80">
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary-200/70">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white focus:border-secondary-400 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-900 text-slate-900">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadinessSlider({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-white/80">
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary-200/70">
        {label}: <span className="text-white">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-secondary-400"
      />
    </label>
  );
}

function HistoryDay({
  label,
  entries,
  totals,
}: {
  label: string;
  entries: WorkoutEntry[];
  totals: { sets: number; reps: number; weight: number; duration: number };
}) {
  return (
    <div className="rounded-2xl border border-primary-400/20 bg-gray-900/30 p-4 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-white">
          <Calendar className="h-4 w-4 text-secondary-200" />
          <p className="text-sm font-semibold uppercase tracking-wide">{label}</p>
        </div>
        <div className="text-sm text-slate-300">
          {entries.length} session{entries.length === 1 ? "" : "s"} • {totals.sets} sets • {totals.reps} reps • {formatDuration(totals.duration)}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-white/5 bg-slate-950/50 p-3 text-sm text-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{entry.name}</p>
                <p className="text-xs uppercase tracking-widest text-secondary-300">{entry.category}</p>
              </div>
              <p className="text-xs text-slate-400">
                {new Date(entry.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {entry.totalSets} sets • {entry.totalReps} reps • {Math.round(entry.totalWeight)} lbs • {formatDuration(entry.durationSeconds)}
            </p>
            {entry.notes && <p className="mt-1 text-xs text-slate-400">{entry.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function transformSession(session: any): WorkoutEntry {
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  const summary = exercises.reduce(
    (acc: { sets: number; reps: number; weight: number }, exercise: any) => {
      const sets = Array.isArray(exercise.sets) ? exercise.sets.length : 0;
      const reps = Array.isArray(exercise.sets)
        ? exercise.sets.reduce((sum: number, set: any) => sum + (Number(set.reps) || 0), 0)
        : 0;
      const weight = Array.isArray(exercise.sets)
        ? exercise.sets.reduce((sum: number, set: any) => sum + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0)
        : 0;
      return {
        sets: acc.sets + sets,
        reps: acc.reps + reps,
        weight: acc.weight + weight,
      };
    },
    { sets: 0, reps: 0, weight: 0 }
  );

  return {
    id: session.id,
    name: exercises[0]?.name || session.notes || "Workout Session",
    category: exercises[0]?.category || "General",
    intensity: exercises[0]?.intensity,
    totalSets: summary.sets,
    totalReps: summary.reps,
    totalWeight: summary.weight,
    durationSeconds: session.duration ?? 0,
    completedAt: session.completedAt,
    notes: session.notes,
  };
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "0 min";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "<1 min";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours > 0) return `${hours}h ${remaining}m`;
  return `${minutes} min`;
}
