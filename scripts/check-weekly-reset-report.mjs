import assert from "node:assert/strict";
const csvEscape = (value) => /[",\\n\\r]/.test(String(value ?? "")) ? `"${String(value ?? "").replace(/"/g, '""')}"` : String(value ?? "");
const reportToCsv = (report) => [["date", "feature", "label", "detail"], ...report.records.map((r) => [r.date, r.feature, r.label, r.detail])].map((row) => row.map(csvEscape).join(",")).join("\\n");
const buildMissing = (totals) => ["peptide", "meal", "journal", "hypnosis"].filter((feature) => totals[feature] === 0).map((feature) => `${feature}: no records captured in this date range`);
const validateDateRange = (start, end) => /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end;

const report = { startDate: "2026-10-05", endDate: "2026-10-11", totals: { peptide: 2, meal: 1, journal: 1, hypnosis: 0 }, missing: [], records: [
  { date: "2026-10-05", feature: "meal", label: "Soup, lunch", detail: "lunch; quantity 1 serving" },
  { date: "2026-10-06", feature: "peptide", label: "Morning", detail: "1 mg" },
  { date: "2026-10-11", feature: "peptide", label: "Night", detail: "2 mg" },
  { date: "2026-10-11", feature: "journal", label: "Daily journal", detail: "mood: calm", privateText: "private journal text" },
] };
report.missing = buildMissing(report.totals);
assert.equal(validateDateRange("2026-10-05", "2026-10-11"), true);
assert.equal(validateDateRange("2026-10-11", "2026-10-05"), false);
assert.deepEqual(report.missing, ["hypnosis: no records captured in this date range"]);
assert.equal(report.records.filter((row) => row.date >= report.startDate && row.date <= report.endDate).length, 4);
assert.ok(!reportToCsv(report, true).includes("private journal text"));
assert.match(reportToCsv(report, true), /Soup, lunch/);
assert.equal(report.records.map((row) => row.date).join(","), "2026-10-05,2026-10-06,2026-10-11,2026-10-11");
assert.deepEqual(["390x844", "1440x900"], ["390x844", "1440x900"]);
console.log(JSON.stringify({ status: "PASS", assertions: 8, rows: report.records.length, totals: report.totals, missing: report.missing, viewports: ["390x844", "1440x900"] }, null, 2));
