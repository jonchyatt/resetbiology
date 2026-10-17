"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import {
  historyToCsv,
  type HistoryFilters,
  type PeptideHistoryRecord,
} from "@/lib/peptideHistory";

type Summary = {
  total: number;
  completed: number;
  pending: number;
  missed: number;
  byProtocol: Array<{ protocolId: string; protocolName: string; total: number; completed: number; pending: number; missed: number }>;
  sideEffects: Array<{ label: string; count: number }>;
};

const today = new Date().toISOString().slice(0, 10);

export function PeptideHistoryReport() {
  const [filters, setFilters] = useState<HistoryFilters>({ startDate: today, endDate: today, status: "all" });
  const [records, setRecords] = useState<PeptideHistoryRecord[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, completed: 0, pending: 0, missed: 0, byProtocol: [], sideEffects: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return params.toString();
  }, [filters]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/peptides/history?${query}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load history");
      setRecords(data.records);
      setSummary(data.summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [query]);

  function updateFilter(key: keyof HistoryFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  function exportCsv() {
    const blob = new Blob([historyToCsv(records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reset-biology-peptide-history-${filters.startDate || "all"}-${filters.endDate || "all"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-white print:max-w-none print:px-0 print:text-black">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300 print:text-gray-600">Personal record</p>
          <h1 className="mt-2 text-3xl font-bold">Peptide history</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-300 print:text-gray-700">Review the doses you recorded, scheduled items, and your own side-effect notes. This is a personal record, not medical advice or a diagnosis.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={exportCsv} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-primary-300/40 px-4 py-2 text-sm hover:bg-primary-400/10 disabled:opacity-50"><Download size={16} /> CSV</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-black hover:bg-primary-400"><Printer size={16} /> Print</button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
        <label className="text-sm">From<input type="date" value={filters.startDate || ""} onChange={(event) => updateFilter("startDate", event.target.value)} className="mt-1 w-full rounded bg-black/30 px-3 py-2" /></label>
        <label className="text-sm">Through<input type="date" value={filters.endDate || ""} onChange={(event) => updateFilter("endDate", event.target.value)} className="mt-1 w-full rounded bg-black/30 px-3 py-2" /></label>
        <label className="text-sm">Protocol<select value={filters.protocolId || ""} onChange={(event) => updateFilter("protocolId", event.target.value)} className="mt-1 w-full rounded bg-black/30 px-3 py-2"><option value="">All protocols</option>{summary.byProtocol.map((protocol) => <option key={protocol.protocolId} value={protocol.protocolId}>{protocol.protocolName}</option>)}</select></label>
        <label className="text-sm">Administration<select value={filters.administrationType || ""} onChange={(event) => updateFilter("administrationType", event.target.value)} className="mt-1 w-full rounded bg-black/30 px-3 py-2"><option value="">All types</option><option value="injection">Injection</option><option value="oral">Oral</option><option value="nasal">Nasal</option><option value="topical">Topical</option><option value="unspecified">Unspecified</option></select></label>
        <label className="text-sm">Status<select value={filters.status || "all"} onChange={(event) => updateFilter("status", event.target.value)} className="mt-1 w-full rounded bg-black/30 px-3 py-2"><option value="all">All statuses</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="missed">Missed</option></select></label>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-400/40 bg-red-950/30 p-4 text-red-200">{error}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Total', summary.total], ['Completed', summary.completed], ['Pending', summary.pending], ['Missed', summary.missed]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-xs uppercase tracking-wider text-gray-400">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 p-4"><h2 className="font-semibold">Recorded and scheduled doses</h2><button onClick={() => void load()} className="print:hidden" aria-label="Refresh history"><RefreshCw size={16} /></button></div>
          {loading ? <p className="p-6 text-gray-300">Loading personal history…</p> : records.length === 0 ? <p className="p-6 text-gray-300">No records match this date range and filter.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-black/20 text-xs uppercase text-gray-400"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Protocol</th><th className="px-4 py-3">Dose</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Notes / side effects</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-white/10"><td className="whitespace-nowrap px-4 py-3">{record.localDate}<br /><span className="text-xs text-gray-400">{record.localTime}</span></td><td className="px-4 py-3">{record.protocolName}<br /><span className="text-xs text-gray-400">{record.administrationType}</span></td><td className="px-4 py-3">{record.dosage}</td><td className="px-4 py-3 capitalize">{record.status}</td><td className="max-w-xs px-4 py-3">{[record.notes, ...record.sideEffects].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody></table></div>}
        </div>
        <aside className="space-y-6"><div className="rounded-xl border border-white/10 bg-white/5 p-4"><h2 className="font-semibold">Totals by protocol</h2><ul className="mt-3 space-y-3 text-sm">{summary.byProtocol.map((protocol) => <li key={protocol.protocolId}><div className="font-medium">{protocol.protocolName}</div><div className="text-xs text-gray-400">{protocol.total} total · {protocol.completed} completed · {protocol.pending} pending · {protocol.missed} missed</div></li>)}{summary.byProtocol.length === 0 && <li className="text-gray-400">No protocol totals yet.</li>}</ul></div><div className="rounded-xl border border-white/10 bg-white/5 p-4"><h2 className="font-semibold">Side-effect notes</h2><p className="mt-1 text-xs text-gray-400">Grouped exactly as recorded; no diagnosis or interpretation is added.</p><ul className="mt-3 space-y-2 text-sm">{summary.sideEffects.map((effect) => <li key={effect.label} className="flex justify-between gap-3"><span>{effect.label}</span><span className="text-gray-400">{effect.count}</span></li>)}{summary.sideEffects.length === 0 && <li className="text-gray-400">No side-effect notes in this range.</li>}</ul></div></aside>
      </div>
    </section>
  );
}
