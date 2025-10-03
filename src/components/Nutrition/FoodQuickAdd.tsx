"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, CheckCircle2, PlusCircle } from "lucide-react";
import type { CachedFoodResult, Nutrients } from "@/lib/nutrition/types";

type Result = CachedFoodResult & { nutrients: Nutrients | null };
type Status = "idle" | "logging" | "success" | "error";
type MealOption = "breakfast" | "lunch" | "dinner" | "snack";

const EMPTY_NUTRIENTS: Nutrients = {
  kcal: null,
  protein_g: null,
  fat_g: null,
  carb_g: null,
  fiber_g: null,
  sugar_g: null,
  sodium_mg: null,
  sat_fat_g: null,
  cholesterol_mg: null,
  potassium_mg: null,
};

const multiply = (value: number | null, factor: number): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * factor * 100) / 100
    : null;

const scaleNutrients = (nutrients: Nutrients | null, factor: number): Nutrients => {
  if (!nutrients || !factor || factor <= 0) {
    return EMPTY_NUTRIENTS;
  }

  return {
    kcal: multiply(nutrients.kcal, factor),
    protein_g: multiply(nutrients.protein_g, factor),
    fat_g: multiply(nutrients.fat_g, factor),
    carb_g: multiply(nutrients.carb_g, factor),
    fiber_g: multiply(nutrients.fiber_g, factor),
    sugar_g: multiply(nutrients.sugar_g, factor),
    sodium_mg: multiply(nutrients.sodium_mg, factor),
    sat_fat_g: multiply(nutrients.sat_fat_g, factor),
    cholesterol_mg: multiply(nutrients.cholesterol_mg, factor),
    potassium_mg: multiply(nutrients.potassium_mg, factor),
  };
};

const formatNumber = (value: number | null, digits = 1): string =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--";

export function FoodQuickAdd({ onLogged }: { onLogged?: () => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [selected, setSelected] = useState<Result | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [servings, setServings] = useState<number>(1);
  const [mealType, setMealType] = useState<MealOption>("snack");

  useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const query = encodeURIComponent(term.trim());
        const res = await fetch("/api/foods/search?q=" + query, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(Array.isArray(data?.items) ? data.items : []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Food search error", err);
          setError(err?.message ?? "Unable to search foods");
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    if (!selected) return;

    if (selected.per === "100g") {
      setGrams(selected.servingGram ?? 100);
    } else {
      setServings(1);
    }
    setStatus("idle");
    setError(null);
  }, [selected?.sourceId]);

  const factor = useMemo(() => {
    if (!selected || !selected.nutrients) return 0;
    if (selected.per === "100g") {
      return grams > 0 ? grams / 100 : 0;
    }
    return servings > 0 ? servings : 0;
  }, [selected, grams, servings]);

  const scaled = useMemo(() => scaleNutrients(selected?.nutrients ?? null, factor), [selected, factor]);

  const gramWeight = useMemo(() => {
    if (!selected) return null;
    if (selected.per === "100g") return grams;
    if (selected.servingGram && servings) return selected.servingGram * servings;
    return null;
  }, [selected, grams, servings]);

  const handleLog = async () => {
    if (!selected || !selected.nutrients || factor === 0 || status === "logging") return;

    try {
      setStatus("logging");
      setError(null);
      const payload = {
        source: selected.source,
        sourceId: selected.sourceId,
        itemName: selected.description,
        brand: selected.brand ?? null,
        quantity: selected.per === "100g" ? grams : servings,
        unit: selected.per === "100g" ? "g" : "serving",
        gramWeight,
        nutrients: scaled,
        mealType,
      };

      const res = await fetch("/api/foods/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Unable to log food");
      }

      setStatus("success");
      if (onLogged) onLogged();
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err: any) {
      console.error("Log food error", err);
      setError(err?.message ?? "Unable to log food");
      setStatus("error");
    }
  };

  return (
    <section className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-slate-900/60 border border-emerald-400/30 shadow-lg p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-300">Quick Add</p>
          <h2 className="text-lg font-semibold text-white">Professional food lookup</h2>
          <p className="text-sm text-slate-300">Search USDA and Open Food Facts, adjust a portion, log instantly.</p>
        </div>
      </div>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search foods, brands, or enter a UPC"
          className="w-full rounded-lg border border-slate-600/40 bg-slate-900/60 pl-10 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-slate-400">Meal type</span>
          <select
            value={mealType}
            onChange={(event) => setMealType(event.target.value as MealOption)}
            className="rounded border border-slate-600 bg-slate-900 px-3 py-1 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
        <p className="text-slate-400">Portion applies per 100 g or per serving as returned by the data source.</p>
      </div>

      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

      <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching foods...
          </div>
        )}
        {!loading && results.length === 0 && term.trim() && (
          <p className="text-sm text-slate-400">No matches yet. Keep typing or refine your search.</p>
        )}
        {results.map((item) => (
          <button
            key={item.source + ":" + item.sourceId}
            onClick={() => setSelected(item)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
              selected?.source === item.source && selected?.sourceId === item.sourceId
                ? "border-emerald-400/60 bg-emerald-500/10"
                : "border-slate-700/50 bg-slate-800/40 hover:border-emerald-400/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white line-clamp-1">{item.description}</p>
              <span className="text-[10px] uppercase tracking-wider text-emerald-300">{item.source}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-300">
              {item.brand && <span>{item.brand}</span>}
              <span>Per {item.per === "100g" ? "100 g" : "serving"}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">{selected.description}</p>
            {selected.brand && <p className="text-xs text-slate-400">{selected.brand}</p>}
          </div>

          {selected.per === "100g" ? (
            <div className="space-y-2">
              <label className="text-xs text-slate-300">Portion (grams)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={400}
                  step={5}
                  value={grams}
                  onChange={(event) => setGrams(Number(event.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <input
                  type="number"
                  min={1}
                  value={grams}
                  onChange={(event) => setGrams(Math.max(1, Number(event.target.value) || 1))}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
                <span className="text-xs text-slate-400">g</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs text-slate-300">Servings</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={servings}
                  onChange={(event) => setServings(Number(event.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={servings}
                  onChange={(event) => setServings(Math.max(0.25, Number(event.target.value) || 0.25))}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
                <span className="text-xs text-slate-400">serv</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
            <div>
              <p className="text-slate-400">Calories</p>
              <p className="text-sm font-semibold text-white">{formatNumber(scaled.kcal, 0)} kcal</p>
            </div>
            <div>
              <p className="text-slate-400">Protein</p>
              <p className="text-sm font-semibold text-white">{formatNumber(scaled.protein_g)} g</p>
            </div>
            <div>
              <p className="text-slate-400">Carbs</p>
              <p className="text-sm font-semibold text-white">{formatNumber(scaled.carb_g)} g</p>
            </div>
            <div>
              <p className="text-slate-400">Fat</p>
              <p className="text-sm font-semibold text-white">{formatNumber(scaled.fat_g)} g</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Logging {selected.per === "100g"
                ? grams + " g"
                : servings + " serving" + (servings !== 1 ? "s" : "")}
              {gramWeight && selected.per !== "100g"
                ? " (~" + formatNumber(gramWeight, 0) + " g)"
                : ""}
            </span>
            {status === "success" && (
              <span className="flex items-center gap-1 text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Logged
              </span>
            )}
          </div>

          <button
            onClick={handleLog}
            disabled={!selected || !selected.nutrients || factor === 0 || status === "logging"}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {status === "logging" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {status === "logging" ? "Logging..." : "Log this food"}
          </button>

          {status === "error" && error && (
            <p className="text-sm text-rose-300">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
