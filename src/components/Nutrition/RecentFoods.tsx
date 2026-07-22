'use client';
import { useEffect, useState } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { localDayKey } from '@/lib/localDay';

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
  source?: string;
  sourceId?: string;
  quantity?: number;
  unit?: string;
};

/**
 * `items` is the parent-owned recent-logs list (single fetch on the page).
 * When provided, this component does NOT fetch — it derives the latest 10 from the shared list.
 * (Legacy self-fetch retained only for standalone use when no items are passed.)
 */
export function RecentFoods({
  items: itemsProp,
  refreshToken = 0,
  onQuickAddSuccess,
}: {
  items?: RecentItem[];
  refreshToken?: number;
  onQuickAddSuccess?: () => void;
}) {
  const toast = useToast();
  const [selfItems, setSelfItems] = useState<RecentItem[] | null>(itemsProp ? null : null);
  const [error, setError] = useState<string | null>(null);
  const [reloggingId, setReloggingId] = useState<string | null>(null);

  const controlled = itemsProp !== undefined;

  useEffect(() => {
    if (controlled) return; // parent owns the data
    (async () => {
      try {
        const res = await fetch('/api/foods/recent', { cache: 'no-store' });
        const data = await res.json();
        if (!data?.ok) throw new Error(data?.error || 'Failed to load');
        setSelfItems(Array.isArray(data.items) ? data.items : []);
      } catch (err: any) {
        setError(err?.message || 'Unable to load recent foods');
      }
    })();
  }, [controlled, refreshToken]);

  const items = controlled ? (itemsProp ?? []).slice(0, 10) : selfItems;

  const handleQuickAdd = async (item: RecentItem) => {
    if (reloggingId) return;
    try {
      setReloggingId(item.id);
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const payload = {
        source: item.source || 'recent',
        sourceId: item.sourceId || item.id,
        itemName: item.itemName,
        brand: item.brand,
        quantity: item.quantity || 1,
        unit: item.unit || 'serving',
        gramWeight: item.gramWeight,
        nutrients: item.nutrients,
        mealType: item.mealType || 'snack',
        loggedAt: now.toISOString(),
        localDate: localDayKey(now),
        localTime: `${hours}:${minutes}:${seconds}`,
      };

      const res = await fetch('/api/foods/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Unable to log food');

      onQuickAddSuccess?.();
      toast.success(`Re-logged ${item.itemName}`);
    } catch (err: any) {
      console.error('Quick-add error:', err);
      toast.error(err?.message || 'Failed to re-log food');
    } finally {
      setReloggingId(null);
    }
  };

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
          <li key={item.id} className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-950/60 px-4 py-3 group hover:border-emerald-400/30 transition-colors">
            <div className="flex-1">
              <div className="text-sm font-medium text-white">
                {item.itemName}
                {item.brand ? <span className="text-slate-400"> — {item.brand}</span> : null}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {(item.mealType || 'meal').toUpperCase()} • <span className="text-emerald-300">P {item.nutrients?.protein_g ?? '--'}g</span> • {item.nutrients?.kcal ?? '--'} kcal
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">
                {new Date(item.loggedAt).toLocaleString()}
              </div>
              <button
                onClick={() => handleQuickAdd(item)}
                disabled={reloggingId === item.id}
                className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-105"
                title="Quick re-log this food"
              >
                {reloggingId === item.id ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
