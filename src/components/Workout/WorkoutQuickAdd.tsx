"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, CheckCircle2, Dumbbell, ListChecks } from "lucide-react";

export type WorkoutQuickAddResult = {
  pointsAwarded: number;
  journalNote?: string;
  dailyTaskCompleted?: boolean;
};

type WorkoutSearchResult = {
  id: number | string;
  name: string;
  category: string;
  description?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  image?: string | null;
};

type Status = "idle" | "searching" | "logging" | "success" | "error";

type SessionType = "strength" | "cardio" | "mobility" | "recovery";

const roundNumber = (value: number | null | undefined, digits = 1) =>
  typeof value === "number" && Number.isFinite(value)
    ? Number.parseFloat(value.toFixed(digits))
    : null;

export function WorkoutQuickAdd({ onLogged }: { onLogged?: (result: WorkoutQuickAddResult) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<WorkoutSearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkoutSearchResult | null>(null);
  const [sets, setSets] = useState<number>(3);
  const [reps, setReps] = useState<number>(10);
  const [weight, setWeight] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [sessionType, setSessionType] = useState<SessionType>("strength");
  const [intensity, setIntensity] = useState<string>("Moderate");
  const [notes, setNotes] = useState<string>("");

  // Search WGER API with debounce
  useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setStatus("searching");
        setError(null);
        const res = await fetch(`/api/workouts/search?q=${encodeURIComponent(term.trim())}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Search failed");
        }
        setResults(Array.isArray(data.items) ? data.items : []);
        if (Array.isArray(data.items) && data.items.length > 0) {
          setStatus("idle");
        } else {
          setStatus("idle");
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Workout search error", err);
        setError(err?.message ?? "Unable to search exercises");
        setStatus("error");
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  const totalVolume = useMemo(() => {
    const clampedSets = Math.max(1, sets);
    const clampedReps = Math.max(1, reps);
    const clampedWeight = Math.max(0, weight);
    return {
      totalReps: clampedSets * clampedReps,
      totalWeight: clampedSets * clampedReps * clampedWeight,
    };
  }, [sets, reps, weight]);

  const handleLog = async () => {
    if (!selected || status === "logging") return;
    if (!Number.isFinite(sets) || sets <= 0 || !Number.isFinite(reps) || reps <= 0) {
      setError("Enter valid sets and reps.");
      setStatus("error");
      return;
    }

    try {
      setStatus("logging");
      setError(null);

      // Get user's local date components
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')

      const payload = {
        exercise: selected,
        log: {
          sets: Math.max(1, Math.round(sets)),
          reps: Math.max(1, Math.round(reps)),
          weight: Number.isFinite(weight) && weight > 0 ? roundNumber(weight, 1) : null,
          durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? roundNumber(durationMinutes, 1) : null,
          notes: notes.trim() || null,
          sessionType,
          intensity: intensity.trim() || null,
          localDate: `${year}-${month}-${day}`,
          localTime: `${hours}:${minutes}:${seconds}`,
        },
      };

      const res = await fetch('/api/workouts/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Unable to log workout');
      }

      setStatus("success");
      setSelected(null);
      setResults([]);
      setTerm("");
      setNotes("");

      if (onLogged) {
        onLogged({
          pointsAwarded: data.pointsAwarded ?? 0,
          journalNote: data.journalNote,
          dailyTaskCompleted: Boolean(data.dailyTaskCompleted),
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("workout:log-success", {
            detail: {
              pointsAwarded: data.pointsAwarded ?? 0,
              journalNote: data.journalNote,
              dailyTaskCompleted: Boolean(data.dailyTaskCompleted),
            },
          })
        );
      }

      setTimeout(() => setStatus("idle"), 2000);
    } catch (err: any) {
      console.error("Log workout error", err);
      setError(err?.message ?? 'Unable to log workout');
      setStatus("error");
    }
  };

  return (
    <section className="rounded-2xl bg-gradient-to-br from-secondary-500/10 via-slate-900/40 to-slate-900/60 border border-secondary-400/30 shadow-lg p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-secondary-300">Quick Add</p>
          <h2 className="text-lg font-semibold text-white">Professional workout lookup</h2>
          <p className="text-sm text-slate-300">Search the WGER exercise library, capture your set, and log it instantly.</p>
        </div>
      </div>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search exercises (bench press, squat, cardio, etc.)"
          className="w-full rounded-lg border border-slate-600/40 bg-slate-900/60 pl-10 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-secondary-400 focus:outline-none"
        />
      </div>

      {error && status !== "searching" && (
        <p className="mt-2 text-sm text-rose-300">{error}</p>
      )}

      <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
        {status === "searching" && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching WGER...
          </div>
        )}

        {!term.trim() && (
          <div className="text-xs text-slate-400">
            <p>Popular searches:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['bench press', 'deadlift', 'squat', 'pull up', 'plank'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setTerm(suggestion)}
                  className="rounded-full border border-secondary-400/30 px-3 py-1 text-secondary-200 hover:border-secondary-400/50 hover:text-secondary-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {term.trim() && results.length === 0 && status !== "searching" && (
          <div className="text-sm text-slate-300">No exercises found. Try a different term.</div>
        )}

        {results.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
              selected?.id === item.id
                ? 'border-secondary-400/60 bg-secondary-500/10'
                : 'border-slate-700/50 bg-slate-800/40 hover:border-secondary-400/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white line-clamp-1">{item.name}</p>
              <span className="text-[10px] uppercase tracking-wider text-secondary-300">{item.category}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-300">
              {item.primaryMuscles.length > 0 && <span>{item.primaryMuscles.join(', ')}</span>}
              {item.equipment.length > 0 && <span>{item.equipment.join(', ')}</span>}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-secondary-300" />
              {selected.name}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {selected.category}
              {selected.primaryMuscles.length > 0 && ` • ${selected.primaryMuscles.join(', ')}`}
            </p>
          </div>

          {selected.description && (
            <p className="text-xs text-slate-400 leading-snug" dangerouslySetInnerHTML={{ __html: selected.description }} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Session Type</span>
              <select
                value={sessionType}
                onChange={(event) => setSessionType(event.target.value as SessionType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-secondary-400 focus:outline-none"
              >
                <option value="strength">Strength</option>
                <option value="cardio">Cardio</option>
                <option value="mobility">Mobility</option>
                <option value="recovery">Recovery</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Intensity</span>
              <input
                value={intensity}
                onChange={(event) => setIntensity(event.target.value)}
                placeholder="e.g., Moderate, RPE 7"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-secondary-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-300">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Sets</span>
              <input
                type="number"
                min={1}
                value={sets}
                onChange={(event) => setSets(Math.max(1, Number(event.target.value) || 1))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-secondary-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Reps</span>
              <input
                type="number"
                min={1}
                value={reps}
                onChange={(event) => setReps(Math.max(1, Number(event.target.value) || 1))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-secondary-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Weight (optional)</span>
              <input
                type="number"
                min={0}
                value={weight}
                onChange={(event) => setWeight(Math.max(0, Number(event.target.value) || 0))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-secondary-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Duration (minutes)</span>
              <input
                type="number"
                min={0}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Math.max(0, Number(event.target.value) || 0))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-secondary-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-secondary-300">Volume summary</p>
              <div className="mt-2 text-slate-100 text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-secondary-300" />
                <span>{totalVolume.totalReps} total reps • {weight > 0 ? `${roundNumber(totalVolume.totalWeight, 1)} lbs lifted` : 'Bodyweight'}</span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-secondary-300">Equipment</p>
              <p className="mt-2 text-slate-100 text-sm">
                {selected.equipment.length > 0 ? selected.equipment.join(', ') : 'No equipment specified'}
              </p>
            </div>
          </div>

          <label className="block text-xs text-slate-300">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional – tempo, cues, modifications"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-secondary-400 focus:outline-none"
            />
          </label>

          <button
            onClick={handleLog}
            disabled={status === "logging"}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary-500 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-secondary-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {status === "logging" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
            {status === "logging" ? 'Logging...' : 'Log workout'}
          </button>

          {status === "error" && error && (
            <p className="text-sm text-rose-300">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
