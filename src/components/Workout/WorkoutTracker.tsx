"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Brain,
  Calendar,
  CheckCircle2,
  Dumbbell,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { WorkoutQuickAdd, WorkoutQuickAddResult } from "./WorkoutQuickAdd";
import { PortalHeader } from "@/components/Navigation/PortalHeader";
import { RecentWorkouts } from "./RecentWorkouts";
import { useToast } from "@/components/ui/Toast";
import { localDayKey } from "@/lib/localDay";
import { effectiveReadiness, readinessGuidance, RECOVER_MAX } from "@/lib/workoutReadiness";
import {
  AssignmentPlanSession,
  AssignmentPersonalization,
  WorkoutAssignmentRecord,
  WorkoutCheckInRecord,
  WorkoutProtocolRecord,
} from "@/types/workout";

export interface WorkoutEntry {
  id: string;
  name: string;
  category: string;
  intensity?: string | null;
  totalSets: number;
  totalReps: number;
  totalWeight: number;
  durationSeconds: number;
  completedAt: string;
  localDate?: string | null;
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

// W3 banner styling per readinessGuidance().level -- teal/amber/rose per the
// ticket's brand palette, matching the existing left-border + tint card idiom.
const readinessBannerClass = (level: "ready" | "reduce" | "recover" | "none") => {
  if (level === "ready") return "border-[#3FBFB5] bg-[#3FBFB5]/10 text-[#3FBFB5]";
  if (level === "reduce") return "border-amber-400 bg-amber-400/10 text-amber-200";
  if (level === "recover") return "border-rose-400 bg-rose-500/10 text-rose-200";
  return "border-white/20 bg-slate-900/30 text-slate-300";
};

// Solid fill for the sparkline bars -- same three colors as the banner border.
const readinessBarClass = (level: "ready" | "reduce" | "recover" | "none") => {
  if (level === "ready") return "bg-[#3FBFB5]";
  if (level === "reduce") return "bg-amber-400";
  if (level === "recover") return "bg-rose-400";
  return "bg-white/20";
};

export function WorkoutTracker() {
  const toast = useToast();
  const [todaysWorkouts, setTodaysWorkouts] = useState<WorkoutEntry[]>([]);
  const [historyItems, setHistoryItems] = useState<WorkoutEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState<WorkoutQuickAddResult | null>(null);

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
  const [showProtocolLibrary, setShowProtocolLibrary] = useState(false);

  const [preferredEquipment, setPreferredEquipment] = useState<string[]>(["Barbell", "Dumbbell"]);
  const [goalPriority, setGoalPriority] = useState(goalOptions[0].value);
  const [sessionPreference, setSessionPreference] = useState(sessionTimeOptions[0].value);
  const [recoveryFocus, setRecoveryFocus] = useState(recoveryFocusOptions[0].value);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const [readinessPayload, setReadinessPayload] = useState({
    readinessScore: 80,
    energyLevel: 7,
    sorenessLevel: 3,
    sleepHours: 7,
    stressLevel: 3,
    mood: "Focused",
    notes: "",
  });
  // W1a item 1 (F4.2 + NEW4): ONE fetch feeds both "today" and history, bucketed
  // by local day (stored localDate first, localDayKey(completedAt) fallback) --
  // mirrors NutritionTracker.tsx:282-286, replaces the old triple-fetch + UTC
  // toDateString()/toISOString() bucketing.
  const fetchRecentWorkouts = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const response = await fetch("/api/workouts/recent?limit=100", { cache: "no-store" });
      const data = await response.json();
      if (!data?.ok || !Array.isArray(data.items)) {
        throw new Error(data?.error || "Failed to load workouts");
      }
      const entries = data.items
        .map(transformSession)
        .sort((a: WorkoutEntry, b: WorkoutEntry) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setHistoryItems(entries);
      const todayKey = localDayKey(new Date());
      setTodaysWorkouts(
        entries.filter((entry: WorkoutEntry) => (entry.localDate || localDayKey(new Date(entry.completedAt))) === todayKey)
      );
    } catch (error: any) {
      console.error("Recent workouts error", error);
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
    fetchRecentWorkouts();
    fetchProtocols();
    fetchAssignments();
    fetchCheckIns();
  }, [fetchRecentWorkouts, fetchProtocols, fetchAssignments, fetchCheckIns]);

  useEffect(() => {
    if (!logSuccess) return;
    const timer = setTimeout(() => setLogSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [logSuccess]);

  // W1a item 6 (NEW6): hydrate saved personalization prefs from the member's
  // profile on mount (GET /api/workout/exercises -- see route for the field).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/workout/exercises", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load workout preferences: ${res.status}`);
        const data = await res.json();
        const saved = data?.workoutPreferences;
        if (saved && typeof saved === "object") {
          if (Array.isArray(saved.preferredEquipment)) setPreferredEquipment(saved.preferredEquipment);
          if (typeof saved.goalPriority === "string") setGoalPriority(saved.goalPriority);
          if (typeof saved.sessionPreference === "string") setSessionPreference(saved.sessionPreference);
          if (typeof saved.recoveryFocus === "string") setRecoveryFocus(saved.recoveryFocus);
        }
        setPrefsHydrated(true);
      } catch (error) {
        console.error("Load workout preferences error", error);
        // ponytail: hydration failed, leave prefsHydrated false so the autosave
        // effect below stays disabled and doesn't POST defaults over saved prefs.
      }
    })();
  }, []);

  // Persist prefs whenever changed, once the hydrate-from-profile read above has
  // finished (guards against overwriting saved prefs with defaults on first paint).
  useEffect(() => {
    if (!prefsHydrated) return;
    fetch("/api/workout/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workoutPreferences: { preferredEquipment, goalPriority, sessionPreference, recoveryFocus },
      }),
    }).catch((error) => console.error("Save workout preferences error", error));
  }, [prefsHydrated, preferredEquipment, goalPriority, sessionPreference, recoveryFocus]);

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
      const key = entry.localDate || localDayKey(new Date(entry.completedAt));
      if (!groups.has(key)) {
        // Parsed WITHOUT a "Z" suffix (local-time parse) so the label reflects the
        // calendar day the key names, not a UTC-shifted one -- see localDay.ts
        // weekdayOfDayKey doc for why this matters.
        const date = new Date(`${key}T00:00:00`);
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

  // W3: readiness banner + 7-day trend + deload flag, all derived from the
  // already-fetched checkIns state -- no extra fetch, banner updates the
  // instant fetchCheckIns() resolves after a submit.
  const readinessActuation = useMemo(() => {
    // checkIns arrives sorted desc by createdAt (server route), so the first
    // entry seen per localDate is that day's latest.
    const byDay = new Map<string, WorkoutCheckInRecord>();
    checkIns.forEach((entry) => {
      const key = (entry as { localDate?: string }).localDate;
      if (key && !byDay.has(key)) byDay.set(key, entry);
    });

    const todayKey = localDayKey(new Date());
    const todayScore = byDay.has(todayKey) ? effectiveReadiness(byDay.get(todayKey)!) : null;

    const priorDay = (key: string) => {
      const d = new Date(`${key}T00:00:00`);
      d.setDate(d.getDate() - 1);
      return localDayKey(d);
    };

    // 7-day sparkline window ending today, oldest -> newest, gap days = null.
    const sparkline: Array<{ key: string; score: number | null }> = [];
    let cursorKey = todayKey;
    for (let i = 0; i < 7; i++) {
      sparkline.unshift({ key: cursorKey, score: byDay.has(cursorKey) ? effectiveReadiness(byDay.get(cursorKey)!) : null });
      cursorKey = priorDay(cursorKey);
    }

    // Deload: the 3 most recent DAYS THAT HAVE A CHECK-IN, consecutive on the
    // calendar, all at/under RECOVER_MAX. W4 verifier fix: also require the
    // most recent of those low days to be today or yesterday -- otherwise a
    // stale 3-low-day streak from weeks ago keeps showing the banner forever.
    const recentDayKeys = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a)).slice(0, 3);
    const consecutive =
      recentDayKeys.length === 3 && recentDayKeys.every((key, idx) => idx === 0 || priorDay(recentDayKeys[idx - 1]) === key);
    const recentEnough = recentDayKeys.length > 0 && (recentDayKeys[0] === todayKey || recentDayKeys[0] === priorDay(todayKey));
    const showDeload =
      consecutive &&
      recentEnough &&
      recentDayKeys.every((key) => (effectiveReadiness(byDay.get(key)!) ?? Infinity) <= RECOVER_MAX);

    return { guidance: readinessGuidance(todayScore), sparkline, showDeload };
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
        body: JSON.stringify({ action, sessionId, notes: notes ?? null, localDate: localDayKey(new Date()) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to update session");
      }
      if (data?.pointsAwarded > 0) {
        toast.success(`+${data.pointsAwarded} points — session complete`);
      }
      await Promise.all([fetchAssignments(), fetchRecentWorkouts()]);
    } catch (error: any) {
      console.error("Session action error", error);
      toast.error(error?.message || "Unable to update session. Please try again.");
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
        localDate: localDayKey(new Date()),
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
      if (data?.pointsAwarded > 0) {
        toast.success(`+${data.pointsAwarded} points — readiness logged`);
      }
      await fetchCheckIns();
      setReadinessPayload((prev) => ({ ...prev, notes: "" }));
    } catch (error: any) {
      console.error("Check-in submit error", error);
      toast.error(error?.message || "Unable to save your readiness check-in. Please try again.");
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const handleRemoveProtocol = async () => {
    if (!activeAssignment) return;
    const confirmed = await toast.confirm({
      title: "Remove this protocol?",
      body: "This archives your active assignment. You can re-assign it later from the library.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/workouts/assignments/${activeAssignment.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to remove protocol");
      }
      await fetchAssignments();
      toast.success("Protocol removed.");
    } catch (error: any) {
      console.error("Remove protocol error", error);
      toast.error(error?.message || "Unable to remove protocol");
    }
  };

  const handleQuickAddLogged = useCallback(
    (result: WorkoutQuickAddResult) => {
      fetchRecentWorkouts();
      setLogSuccess(result);
    },
    [fetchRecentWorkouts]
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
      <div className="relative z-10 pt-32">
        <PortalHeader
          section="Workout Tracker"
          secondaryBackLink="/daily-history"
          secondaryBackText="Daily History"
        />

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

          {/* MY PROTOCOLS - Quick Access Section (mirrors Peptide Tracker) */}
          <section className="relative z-10 rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-white">My Workout Protocols</h2>
                <p className="text-sm text-slate-400">Click a protocol to start training</p>
              </div>
              <button
                onClick={() => setShowProtocolLibrary(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-secondary-400/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-secondary-500/40 transition hover:bg-secondary-300"
              >
                <Plus className="h-4 w-4" />
                Add from Library
              </button>
            </div>

            {assignmentsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-slate-300">Loading your protocols...</p>
              </div>
            ) : !activeAssignment ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/30 p-8 text-center">
                <Dumbbell className="w-12 h-12 text-secondary-200/50 mx-auto mb-4" />
                <p className="font-semibold text-white mb-2">No Active Protocol</p>
                <p className="text-sm text-slate-400 mb-4">
                  Add a workout protocol from our library to get started with guided training.
                </p>
                <button
                  onClick={() => setShowProtocolLibrary(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-secondary-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-secondary-400"
                >
                  Browse Protocol Library
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Protocol Card - Clickable to start training */}
                <div
                  className="rounded-2xl border border-primary-400/30 bg-gray-900/40 p-5 shadow-inner cursor-pointer hover:border-primary-400/50 transition-all group"
                  onClick={() => setShowProtocolLibrary(true)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Dumbbell className="h-6 w-6 text-secondary-200" />
                        <h3 className="text-xl font-semibold text-white group-hover:text-primary-300 transition-colors">
                          {activeAssignment.protocol?.name}
                        </h3>
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
                          Active
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mb-3">{activeAssignment.protocol?.summary}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                        <span>{completedSessions}/{activePlanSessions.length} sessions completed</span>
                        <span>•</span>
                        <span>Adherence: {Math.round(planCompletionRate * 100)}%</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProtocol();
                      }}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove protocol"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Next Session Preview */}
                  {nextSession && (
                    <div className="mt-4 rounded-xl border border-primary-400/20 bg-gray-900/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ListChecks className="h-5 w-5 text-secondary-200" />
                          <span className="text-sm font-semibold text-white">Next: {nextSession.title}</span>
                        </div>
                        <span className="text-xs text-slate-400">{nextSession.intensity} intensity</span>
                      </div>
                      <div className={classNames("mb-3 rounded-lg border-l-4 px-3 py-2 text-xs", readinessBannerClass(readinessActuation.guidance.level))}>
                        <p className="font-semibold">{readinessActuation.guidance.headline}</p>
                        <p className="mt-0.5 text-slate-300">{readinessActuation.guidance.detail}</p>
                        {readinessActuation.showDeload && (
                          <p className="mt-1 font-semibold text-rose-200">
                            Three low days in a row — consider a deload week: halve your sets at the same weights.
                          </p>
                        )}
                      </div>
                      {readinessActuation.guidance.level === "recover" ? (
                        // Low readiness: recovery becomes the primary (visually prominent) action,
                        // training-as-prescribed stays one click away as secondary -- never gated.
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSessionAction("skip-session", nextSession.id);
                            }}
                            disabled={sessionActionLoading}
                            className="flex-1 rounded-lg bg-secondary-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-secondary-400 disabled:opacity-50"
                          >
                            Take a Recovery Day
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSessionAction("complete-session", nextSession.id);
                            }}
                            disabled={sessionActionLoading}
                            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 disabled:opacity-50"
                          >
                            Train hard anyway
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSessionAction("complete-session", nextSession.id);
                            }}
                            disabled={sessionActionLoading}
                            className="flex-1 rounded-lg bg-secondary-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-secondary-400 disabled:opacity-50"
                          >
                            Complete Session
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSessionAction("skip-session", nextSession.id);
                            }}
                            disabled={sessionActionLoading}
                            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 disabled:opacity-50"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="relative z-10 grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              {/* Today's Logged Sessions */}
              <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Today</p>
                    <h2 className="text-xl font-semibold text-white">Logged sessions</h2>
                  </div>
                  <button
                    onClick={() => fetchRecentWorkouts()}
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

                <ReadinessSparkline days={readinessActuation.sparkline} />

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

                <details className="mt-4 rounded-xl border border-white/10 bg-gray-900/30 px-4 py-2 text-xs text-slate-300">
                  <summary className="cursor-pointer select-none font-semibold text-white">How readiness works</summary>
                  <div className="mt-2 space-y-2">
                    <p>
                      Subjective check-ins like this one are a validated way to monitor how your body is responding to
                      training. On a middling day we reduce volume, not intensity — the work stays hard, there's just
                      less of it. That's how we protect you from your most motivated bad days.
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-400">
                      <li>
                        Saw AE, Main LC, Gastin PB (2016). Monitoring the athlete training response: subjective
                        self-reported measures trump commonly used objective measures. Br J Sports Med 50(5):281-291.{" "}
                        <a href="https://pubmed.ncbi.nlm.nih.gov/26423706/" target="_blank" rel="noreferrer" className="text-secondary-200 hover:underline">
                          pubmed.ncbi.nlm.nih.gov/26423706
                        </a>
                      </li>
                      <li>
                        Zourdos MC, et al. (2016). Novel resistance training-specific rating of perceived exertion
                        scale measuring repetitions in reserve. J Strength Cond Res 30(1):267-275.{" "}
                        <a href="https://pubmed.ncbi.nlm.nih.gov/26049792/" target="_blank" rel="noreferrer" className="text-secondary-200 hover:underline">
                          pubmed.ncbi.nlm.nih.gov/26049792
                        </a>
                      </li>
                      <li>
                        Helms ER, et al. (2016). Application of the repetitions-in-reserve-based rating of perceived exertion
                        scale for resistance training. Strength Cond J 38(4):42-49.{" "}
                        <a
                          href="https://journals.lww.com/nsca-scj/fulltext/2016/08000/application_of_the_repetitions_in_reserve_based.10.aspx"
                          target="_blank"
                          rel="noreferrer"
                          className="text-secondary-200 hover:underline"
                        >
                          journals.lww.com/nsca-scj
                        </a>
                      </li>
                    </ul>
                    <p className="text-[11px] text-slate-500">Educational guidance, not medical advice — adjust to your own situation.</p>
                  </div>
                </details>
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
              <RecentWorkouts items={historyItems ? historyItems.slice(0, 25) : []} />
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
                      <li>Duration: {formatProtocolDurationWeeks(protocol.durationWeeks)}</li>
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
                    <ProtocolEducationBlock protocol={protocol} />
                    <button
                      disabled={assigningProtocolId === protocol.id}
                      onClick={() => handleAssignProtocol(protocol.id)}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-secondary-400/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-secondary-500/40 transition hover:bg-secondary-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Assign this protocol
                    </button>
                    {protocol.researchLinks && protocol.researchLinks.length > 0 && (
                      <div className="mt-3 text-[11px] uppercase tracking-widest text-slate-500">
                        <span className="mr-2 normal-case tracking-normal text-slate-600">Further reading:</span>
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
                onClick={() => fetchRecentWorkouts()}
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

      {/* Protocol Library Modal */}
      {showProtocolLibrary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-4xl w-full border border-primary-400/30 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">Workout Protocol Library</h3>
                <p className="text-sm text-slate-400 mt-1">Research-backed templates with AI-assisted guardrails</p>
              </div>
              <button
                onClick={() => setShowProtocolLibrary(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {assignError && (
              <p className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
                {assignError}
              </p>
            )}

            {protocolsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-slate-300">Loading protocols...</p>
              </div>
            ) : protocols.length === 0 ? (
              <p className="text-center py-8 text-slate-400">No protocols available yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {protocols.map((protocol) => (
                  <article
                    key={protocol.id}
                    className="rounded-2xl border border-primary-400/30 bg-gray-900/40 p-5 shadow-inner"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-white">{protocol.name}</h4>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-200">
                        {protocol.level || "multi-level"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300 line-clamp-2">{protocol.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(protocol.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] uppercase tracking-wide text-secondary-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-slate-400">
                      <li>Duration: {formatProtocolDurationWeeks(protocol.durationWeeks)}</li>
                      <li>Sessions/week: {protocol.sessionsPerWeek ?? "--"}</li>
                    </ul>
                    <ProtocolEducationBlock protocol={protocol} />
                    <button
                      disabled={assigningProtocolId === protocol.id}
                      onClick={() => {
                        handleAssignProtocol(protocol.id);
                        setShowProtocolLibrary(false);
                      }}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-secondary-400/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-secondary-500/40 transition hover:bg-secondary-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Assign Protocol
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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

// W3 item 4: 7-day effective-readiness trend, gap days rendered as gaps. No
// chart library -- flex-of-divs, height scaled to score, color per guidance
// level (matches readinessBannerClass, imported constants only).
function ReadinessSparkline({ days }: { days: Array<{ key: string; score: number | null }> }) {
  return (
    <div className="mt-3 flex items-end gap-1 h-10">
      {days.map((day) => {
        const level = readinessGuidance(day.score).level;
        return (
          <div key={day.key} className="flex-1 flex items-end" title={day.score === null ? "No check-in" : `${day.score}%`}>
            {day.score !== null && (
              <div
                className={classNames("w-full rounded-sm", readinessBarClass(level))}
                style={{ height: `${Math.max(6, (day.score / 100) * 40)}px` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// W4: education block (whoItsFor / evidenceSummary / progressionRule /
// deloadRule / citations) shared by the inline protocol-library section and
// the protocol-library modal -- one render path, two call sites. Collapsible
// so the cards stay scannable rather than becoming a wall of text.
function ProtocolEducationBlock({ protocol }: { protocol: WorkoutProtocolRecord }) {
  const hasEducation =
    protocol.whoItsFor || protocol.evidenceSummary || protocol.progressionRule || protocol.deloadRule;
  if (!hasEducation) return null;
  return (
    <details className="mt-3 rounded-xl border border-primary-400/20 bg-gray-900/30 px-3 py-2 text-xs text-slate-300">
      <summary className="cursor-pointer select-none font-semibold text-white">Who it's for + evidence</summary>
      <div className="mt-2 space-y-2">
        {protocol.whoItsFor && <p>{protocol.whoItsFor}</p>}
        {protocol.evidenceSummary && <p className="text-slate-400">{protocol.evidenceSummary}</p>}
        {protocol.progressionRule && (
          <p>
            <span className="font-semibold text-white">Progression: </span>
            {protocol.progressionRule}
          </p>
        )}
        {protocol.deloadRule && (
          <p>
            <span className="font-semibold text-white">Deload: </span>
            {protocol.deloadRule}
          </p>
        )}
        {protocol.citations && protocol.citations.length > 0 && (
          <ul className="space-y-1 border-t border-white/10 pt-2 text-[11px] text-slate-400">
            {protocol.citations.map((citation) => (
              <li key={citation.url}>
                <a href={citation.url} target="_blank" rel="noreferrer" className="text-secondary-200 hover:underline">
                  {citation.label}
                </a>
                <span className="text-slate-500"> — {citation.journal}, {citation.year}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
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
    // W1a item 5 (NEW5): prefer the plan session's title (persisted onto each
    // exercise entry by logCompletedSession -- see workoutProtocolService.ts)
    // over the first-exercise name, so a 6-exercise prescribed session shows
    // its plan title instead of "Goblet Squat". Freestyle/quick-add logs have
    // no sessionTitle and fall back to the exercise-derived name as before.
    name: exercises[0]?.sessionTitle || exercises[0]?.name || session.notes || "Workout Session",
    category: exercises[0]?.category || "General",
    intensity: exercises[0]?.intensity,
    totalSets: summary.sets,
    totalReps: summary.reps,
    totalWeight: summary.weight,
    durationSeconds: session.duration ?? 0,
    completedAt: session.completedAt,
    localDate: session.localDate ?? null,
    notes: session.notes,
  };
}

// W1a item 4 (F4.7 UI half): 0 or null/undefined durationWeeks means the
// protocol is deliberately ongoing -- never render "0 weeks" or "--".
function formatProtocolDurationWeeks(weeks?: number | null) {
  if (!weeks) return "Ongoing";
  return `${weeks} weeks`;
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
