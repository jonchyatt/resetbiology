'use client';
import { useEffect, useState } from 'react';

type RecentItem = {
  id: string;
  name: string;
  brandName?: string | null;
  portionGrams: number;
  calories?: number | null;
  loggedAt: string;
};

export default function RecentFoods() {
  const [items, setItems] = useState<RecentItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/foods/recent', { cache: 'no-store' });
        const data = await res.json();
        if (!data?.ok) throw new Error(data?.error || 'Failed');
        setItems(data.items || []);
      } catch (e: any) {
        setErr(e?.message || 'Error');
      }
    })();
  }, []);

  if (err) return <div className="text-red-600 text-sm">Recent load error: {err}</div>;
  if (!items) return <div className="text-sm text-gray-500">Loading recent foods…</div>;
  if (items.length === 0) return <div className="text-sm text-gray-500">No recent foods logged.</div>;

  return (
    <div className="mt-6">
      <h2 className="font-semibold mb-2">Recent</h2>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{it.name}{it.brandName ? ` — ${it.brandName}` : ''}</div>
              <div className="text-xs text-gray-500">
                {Math.round(it.portionGrams)} g • {it.calories ?? '—'} kcal • {new Date(it.loggedAt).toLocaleString()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
