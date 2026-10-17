"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { reportToCsv, type WeeklyResetReport as WeeklyResetReportData } from "@/lib/weeklyResetReport";

const today = new Date().toISOString().slice(0, 10);
const prior = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

export function WeeklyResetReport({ previewReport }: { previewReport?: WeeklyResetReportData } = {}) {
  const [startDate, setStartDate] = useState(prior);
  const [endDate, setEndDate] = useState(today);
  const [shareSafe, setShareSafe] = useState(true);
  const [report, setReport] = useState<WeeklyResetReportData | null>(previewReport ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (previewReport) return;
    void fetch(`/api/reports/reset?startDate=${startDate}&endDate=${endDate}`, { credentials: "include" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setReport(body.report); })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load report"));
  }, [startDate, endDate, previewReport]);

  const csv = useMemo(() => report ? reportToCsv(report, shareSafe) : "", [report, shareSafe]);
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `reset-report-${startDate}-${endDate}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-white print:max-w-none print:px-0 print:text-black">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300 print:text-gray-600">Private personal record</p><h1 className="mt-2 text-3xl font-bold">Weekly Reset report</h1><p className="mt-2 max-w-2xl text-sm text-gray-300 print:text-gray-700">A portable summary of what you recorded. Missing data is labelled; no medical interpretation is added.</p></div><div className="flex gap-2 print:hidden"><button onClick={exportCsv} disabled={!report} className="inline-flex items-center gap-2 rounded-lg border border-primary-300/40 px-4 py-2 text-sm"><Download size={16} /> CSV</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-black"><Printer size={16} /> Print / PDF</button></div></header>
    <section className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3 print:hidden"><label>From<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded bg-black/30 px-3 py-2" /></label><label>Through<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded bg-black/30 px-3 py-2" /></label><label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={shareSafe} onChange={(e) => setShareSafe(e.target.checked)} /> Share-safe (hide journal text)</label></section>
    {error && <div role="alert" className="rounded-lg border border-red-400/40 bg-red-950/30 p-4 text-red-200">{error}</div>}
    {report && <><section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['Peptides', report.totals.peptide], ['Meals', report.totals.meal], ['Journal days', report.totals.journal], ['Hypnosis', report.totals.hypnosis]] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-xs uppercase tracking-wider text-gray-400">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>)}</section>{report.missing.length > 0 && <section className="rounded-xl border border-amber-300/30 bg-amber-950/20 p-4"><h2 className="font-semibold">Missing data in this range</h2><ul className="mt-2 list-disc pl-5 text-sm text-amber-100">{report.missing.map((item) => <li key={item}>{item}</li>)}</ul></section>}<section className="overflow-hidden rounded-xl border border-white/10 bg-white/5"><div className="border-b border-white/10 p-4"><h2 className="font-semibold">Recorded activity</h2></div>{report.records.length === 0 ? <p className="p-6 text-gray-300">No records captured in this date range.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-black/20 text-xs uppercase text-gray-400"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Feature</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Details</th></tr></thead><tbody>{report.records.map((record, index) => <tr key={`${record.date}-${record.feature}-${record.label}-${index}`} className="border-t border-white/10"><td className="whitespace-nowrap px-4 py-3">{record.date}</td><td className="px-4 py-3 capitalize">{record.feature}</td><td className="px-4 py-3">{record.label}</td><td className="px-4 py-3">{record.detail}</td></tr>)}</tbody></table></div>}</section></>}
  </main>;
}
