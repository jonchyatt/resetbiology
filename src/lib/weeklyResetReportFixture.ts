import { buildMissing, type ResetReportRecord, type WeeklyResetReport } from "./weeklyResetReport";

// Synthetic data only. No member data is read or written to build the preview.
// Hypnosis is left empty on purpose so the "Missing data" box shows.
const records: ResetReportRecord[] = [
  { date: "2026-01-05", feature: "peptide", label: "Example peptide A", detail: "250 mcg, morning" },
  { date: "2026-01-06", feature: "meal", label: "Oatmeal with berries", detail: "320 kcal, 12 g protein" },
  { date: "2026-01-06", feature: "journal", label: "Journal entry", detail: "Mood 4 of 5", privateText: "Synthetic private text that must never appear in the report." },
  { date: "2026-01-08", feature: "peptide", label: "Example peptide A", detail: "250 mcg, morning" },
  { date: "2026-01-09", feature: "meal", label: "Chicken and rice bowl", detail: "540 kcal, 38 g protein" },
  { date: "2026-01-10", feature: "journal", label: "Journal entry", detail: "Mood 3 of 5", privateText: "Another synthetic private note." },
  { date: "2026-01-11", feature: "meal", label: "Greek yogurt", detail: "150 kcal, 17 g protein" },
];

const totals: WeeklyResetReport["totals"] = { peptide: 0, meal: 0, journal: 0, hypnosis: 0 };
for (const record of records) totals[record.feature] += 1;

export const syntheticResetReport: WeeklyResetReport = {
  startDate: "2026-01-05",
  endDate: "2026-01-11",
  records,
  totals,
  missing: buildMissing(totals),
};
