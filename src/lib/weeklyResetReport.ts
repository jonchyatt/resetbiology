export type ResetReportRecord = {
  date: string;
  feature: "peptide" | "meal" | "journal" | "hypnosis";
  label: string;
  detail: string;
  privateText?: string;
};

export type WeeklyResetReport = {
  startDate: string;
  endDate: string;
  records: ResetReportRecord[];
  totals: Record<ResetReportRecord["feature"], number>;
  missing: string[];
};

export function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function reportToCsv(report: WeeklyResetReport, shareSafe = true): string {
  const header = ["date", "feature", "label", "detail"];
  const rows = report.records.map((record) => [record.date, record.feature, record.label, record.detail]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function validateDateRange(startDate: string, endDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && startDate <= endDate;
}

export function buildMissing(totals: WeeklyResetReport["totals"]): string[] {
  return (["peptide", "meal", "journal", "hypnosis"] as const)
    .filter((feature) => totals[feature] === 0)
    .map((feature) => `${feature}: no records captured in this date range`);
}
