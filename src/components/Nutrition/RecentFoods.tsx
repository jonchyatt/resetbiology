'use client';
import { useEffect, useState } from 'react';

type RecentItem = {
  id: string;
  itemName: string;
  brand?: string | null;
  gramWeight?: number | null;
  nutrients?: {
    kcal?: number | null;
    protein_g?: number | null;
    carb_g?: number | null;
    fat_g?: number | null;
  } | null;
  mealType?: string | null;
  loggedAt: string;
};

export function RecentFoods() {
  const [items, setItems] = useState<RecentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/foods/recent', { cache: 'no-store' });
        const data = await res.json();
        if (!data?.ok) throw new Error(data?.error || 'Failed to load');
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err: any) {
        setError(err?.message || 'Unable to load recent foods');
      }
    })();
  }, []);

  if (error) {
    return <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">Recent load error: {error}</div>;
  }

  if (!items) {
    return <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">Loading recent foods...</div>;
  }

  if (items.length === 0) {
    return <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">Log a food to see it here.</div>;
  }

  return (
    <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-300">Recent activity</p>
          <h2 className="text-lg font-semibold text-white">Latest food logs</h2>
        </div>
        <span className="text-xs text-slate-400">Last {items.length} entries</span>
      </div>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-950/60 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-white">
                {item.itemName}
                {item.brand ? <span className="text-slate-400"> — {item.brand}</span> : null}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {(item.mealType || 'meal').toUpperCase()} • {item.gramWeight ? Math.round(item.gramWeight) + ' g' : 'portion'} • {item.nutrients?.kcal ?? '--'} kcal
              </div>
            </div>
            <div className="text-xs text-slate-400">
              {new Date(item.loggedAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
