"use client";

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, CheckCircle2, PlusCircle, UtensilsCrossed } from 'lucide-react';
import type { CachedFoodResult, Nutrients } from '@/lib/nutrition/types';

type Result = CachedFoodResult & { nutrients: Nutrients | null };

type Status = 'idle' | 'logging' | 'success' | 'error';

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
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * factor * 100) / 100 : null;

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
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

export function FoodQuickAdd({ onLogged }: { onLogged?: () => void } = {}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [selected, setSelected] = useState<Result | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [servings, setServings] = useState<number>(1);

  useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(term.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Search request failed');
        }
        const data = await response.json();
        setResults(Array.isArray(data?.items) ? data.items : []);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Food search error', err);
          setError('Unable to search foods right now.');
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [term]);

  useEffect(() => {
    if (!selected) return;

    if (selected.per === '100g') {
      setGrams(selected.servingGram ?? 100);
    } else {
      setServings(1);
    }
    setStatus('idle');
    setError(null);
  }, [selected?.sourceId]);

  const factor = useMemo(() => {
    if (!selected || !selected.nutrients) return 0;
    if (selected.per === '100g') {
      return grams > 0 ? grams / 100 : 0;
    }
    return servings > 0 ? servings : 0;
  }, [selected, grams, servings]);

  const scaled = useMemo(() => scaleNutrients(selected?.nutrients ?? null, factor), [selected, factor]);

  const gramWeight = useMemo(() => {
    if (!selected) return null;
    if (selected.per === '100g') {
      return grams;
    }
    if (selected.servingGram && servings) {
      return selected.servingGram * servings;
    }
    return null;
  }, [selected, grams, servings]);

  const logDisabled = !selected || !selected.nutrients || factor === 0 || status === 'logging';

  const handleLog = async () => {
    if (logDisabled || !selected) return;

    try {
      setStatus('logging');
      setError(null);
      const payload = {
        source: selected.source,
        sourceId: selected.sourceId,
        itemName: selected.description,
        brand: selected.brand ?? null,
        quantity: selected.per === '100g' ? grams : servings,
        unit: selected.per === '100g' ? 'g' : 'serving',
        gramWeight,
        nutrients: scaled,
      };

      const response = await fetch('/api/foods/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Unable to log food');
      }

      setStatus('success');
      if (onLogged) onLogged();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Log food error', err);
      setError(err?.message ?? 'Unable to log food');
      setStatus('error');
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border border-primary-400/30 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center gap-3">
        <UtensilsCrossed className="h-5 w-5 text-primary-300" />
        <div>
          <h3 className="text-white font-semibold">Quick Food Log</h3>
          <p className="text-xs text-gray-400">Search USDA or barcode foods, set a portion, and log instantly.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search foods, e.g. oatmeal, chicken breast, greek yogurt"
          className="w-full bg-gray-800/60 border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-primary-400 focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      <div className="max-h-48 overflow-y-auto space-y-2">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching foods...
          </div>
        )}
        {!loading && results.length === 0 && term.trim() && (
          <p className="text-xs text-gray-400">No matches yet. Keep typing for more precise results.</p>
        )}
        {results.map((item) => (
          <button
            key={`${item.source}:${item.sourceId}`}
            onClick={() => setSelected(item)}
            className={`w-full text-left bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2 transition-colors ${
              selected?.sourceId === item.sourceId && selected?.source === item.source
                ? 'border-primary-400/60 bg-primary-500/10'
                : 'hover:border-primary-400/30'
            }`}
          >
            <p className="text-sm font-medium text-white line-clamp-1">{item.description}</p>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
              <span className="uppercase tracking-wide">{item.source}</span>
              {item.brand && <span>{item.brand}</span>}
              <span>Per {item.per === '100g' ? '100 g' : 'serving'}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">{selected.description}</p>
            {selected.brand && <p className="text-xs text-gray-400">{selected.brand}</p>}
          </div>

          {selected.per === '100g' ? (
            <div className="space-y-2">
              <label className="text-xs text-gray-300">Portion (grams)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={400}
                  step={5}
                  value={grams}
                  onChange={(event) => setGrams(Number(event.target.value))}
                  className="flex-1 accent-primary-500"
                />
                <input
                  type="number"
                  min={1}
                  value={grams}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setGrams(Number.isFinite(next) ? Math.max(1, next) : 1);
                  }}
                  className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-100"
                />
                <span className="text-xs text-gray-400">g</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs text-gray-300">Servings</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={servings}
                  onChange={(event) => setServings(Number(event.target.value))}
                  className="flex-1 accent-primary-500"
                />
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={servings}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setServings(Number.isFinite(next) ? Math.max(0.25, next) : 0.25);
                  }}
                  className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-100"
                />
                <span className="text-xs text-gray-400">serv</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-300">
            <div>
              <p className="text-gray-400">Calories</p>
              <p className="text-white text-sm font-semibold">{formatNumber(scaled.kcal, 0)} kcal</p>
            </div>
            <div>
              <p className="text-gray-400">Protein</p>
              <p className="text-white text-sm font-semibold">{formatNumber(scaled.protein_g)} g</p>
            </div>
            <div>
              <p className="text-gray-400">Carbs</p>
              <p className="text-white text-sm font-semibold">{formatNumber(scaled.carb_g)} g</p>
            </div>
            <div>
              <p className="text-gray-400">Fat</p>
              <p className="text-white text-sm font-semibold">{formatNumber(scaled.fat_g)} g</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>
              Logging {selected.per === '100g' ? `${grams} g` : `${servings} serving${servings !== 1 ? 's' : ''}`}
              {gramWeight && selected.per !== '100g' ? ` (~${formatNumber(gramWeight, 0)} g)` : ''}
            </span>
            {status === 'success' && (
              <span className="flex items-center gap-1 text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Logged!
              </span>
            )}
          </div>

          <button
            onClick={handleLog}
            disabled={logDisabled}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
          >
            {status === 'logging' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {status === 'logging' ? 'Logging…' : 'Log this food'}
          </button>

          {status === 'error' && error && (
            <p className="text-xs text-rose-300">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
