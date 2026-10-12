import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getUserFromSession } from "@/lib/getUserFromSession";
import { prisma } from "@/lib/prisma";
import { buildMissing, validateDateRange, type ResetReportRecord } from "@/lib/weeklyResetReport";
import { normalizeSideEffects } from "@/lib/peptideHistory";

function dayRange(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function GET(request: Request) {
  try {
    const session = await auth0.getSession();
    const user = await getUserFromSession(session);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const today = new Date().toISOString().slice(0, 10);
    const endDate = params.get("endDate") || today;
    const startDate = params.get("startDate") || new Date(dayRange(endDate).getTime() - 6 * 86400000).toISOString().slice(0, 10);
    if (!validateDateRange(startDate, endDate)) return NextResponse.json({ error: "Use an inclusive YYYY-MM-DD date range." }, { status: 400 });
    const start = dayRange(startDate);
    const end = new Date(dayRange(endDate).getTime() + 86400000);
    const [doses, meals, journals, hypnosis] = await Promise.all([
      prisma.peptide_doses.findMany({ where: { doseDate: { gte: start, lt: end }, user_peptide_protocols: { userId: user.id } }, include: { user_peptide_protocols: { include: { peptides: true } } }, orderBy: { doseDate: "asc" } }),
      prisma.foodLog.findMany({ where: { userId: user.id, loggedAt: { gte: start, lt: end } }, orderBy: { loggedAt: "asc" } }),
      prisma.journalEntry.findMany({ where: { userId: user.id, date: { gte: start, lt: end } }, orderBy: { date: "asc" } }),
      prisma.moduleCompletion.findMany({ where: { userId: user.id, completedAt: { gte: start, lt: end } }, orderBy: { completedAt: "asc" } }),
    ]);
    const records: ResetReportRecord[] = [];
    for (const dose of doses) records.push({ date: dose.localDate || dose.doseDate.toISOString().slice(0, 10), feature: "peptide", label: dose.protocolName || dose.user_peptide_protocols.peptides.name, detail: [dose.dosage, normalizeSideEffects(dose.sideEffects).join("; ")].filter(Boolean).join(" · ") || "administration recorded" });
    for (const meal of meals) records.push({ date: meal.localDate || meal.loggedAt.toISOString().slice(0, 10), feature: "meal", label: meal.itemName, detail: `${meal.mealType}; quantity ${meal.quantity} ${meal.unit}` });
    for (const journal of journals) {
      let parsed: Record<string, unknown> = {};
      try { parsed = journal.entry ? JSON.parse(journal.entry) : {}; } catch { parsed = {}; }
      records.push({ date: journal.date.toISOString().slice(0, 10), feature: "journal", label: "Daily journal", detail: [`mood: ${journal.mood || "not captured"}`, `completion: ${parsed.tasksCompleted ? "captured" : "not captured"}`].join("; "), privateText: journal.entry });
    }
    for (const session of hypnosis) records.push({ date: session.localDate || session.completedAt.toISOString().slice(0, 10), feature: "hypnosis", label: session.moduleId, detail: session.fullCompletion ? "completed" : "session recorded" });
    records.sort((a, b) => a.date.localeCompare(b.date) || a.feature.localeCompare(b.feature) || a.label.localeCompare(b.label));
    const totals = { peptide: doses.length, meal: meals.length, journal: journals.length, hypnosis: hypnosis.length };
    return NextResponse.json({ success: true, report: { startDate, endDate, records, totals, missing: buildMissing(totals) } });
  } catch (error) {
    console.error("GET /api/reports/reset error:", error);
    return NextResponse.json({ error: "Failed to load Reset report" }, { status: 500 });
  }
}
