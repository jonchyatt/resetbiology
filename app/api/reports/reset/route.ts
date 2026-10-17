import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getUserFromSession } from "@/lib/getUserFromSession";
import { prisma } from "@/lib/prisma";
import { exportMemberData } from "@/lib/member-data";
import { buildMissing, validateDateRange, type ResetReportRecord } from "@/lib/weeklyResetReport";
import { normalizeSideEffects } from "@/lib/peptideHistory";

export const dynamic = "force-dynamic";

const dayKey = (value: unknown): string => (value ? new Date(value as string | Date).toISOString().slice(0, 10) : "");
const inRange = (day: string, start: string, end: string) => day >= start && day <= end;

export async function GET(request: Request) {
  // Hidden until the local seat sets NEXT_PUBLIC_RB_REPORTS=1.
  if (process.env.NEXT_PUBLIC_RB_REPORTS !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const session = await auth0.getSession();
    const user = await getUserFromSession(session);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const today = new Date().toISOString().slice(0, 10);
    const endDate = params.get("endDate") || today;
    const startDate = params.get("startDate") || new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10);
    if (!validateDateRange(startDate, endDate)) return NextResponse.json({ error: "Use an inclusive YYYY-MM-DD date range." }, { status: 400 });

    // Rows come only from the member-data isolation layer: the user id is the
    // session's, and scopedWhere() refuses to query without one. The date range
    // is applied afterwards, in memory.
    const { data } = await exportMemberData(prisma as any, user.id);
    const rows = (model: string) => (data[model] ?? []) as Array<Record<string, any>>;

    const protocolNames = new Map<string, string>();
    for (const protocol of rows("user_peptide_protocols")) if (protocol.id && protocol.name) protocolNames.set(protocol.id, protocol.name);
    const doses = rows("peptide_doses").filter((dose) => inRange(dose.localDate || dayKey(dose.doseDate), startDate, endDate));
    const meals = rows("FoodLog").filter((meal) => inRange(meal.localDate || dayKey(meal.loggedAt), startDate, endDate));
    const journals = rows("JournalEntry").filter((journal) => inRange(dayKey(journal.date), startDate, endDate));
    const hypnosis = rows("ModuleCompletion").filter((entry) => inRange(entry.localDate || dayKey(entry.completedAt), startDate, endDate));

    const records: ResetReportRecord[] = [];
    for (const dose of doses) records.push({ date: dose.localDate || dayKey(dose.doseDate), feature: "peptide", label: dose.protocolName || protocolNames.get(dose.protocolId) || "Peptide dose", detail: [dose.dosage, normalizeSideEffects(dose.sideEffects).join("; ")].filter(Boolean).join(" · ") || "administration recorded" });
    for (const meal of meals) records.push({ date: meal.localDate || dayKey(meal.loggedAt), feature: "meal", label: meal.itemName, detail: `${meal.mealType}; quantity ${meal.quantity} ${meal.unit}` });
    for (const journal of journals) {
      let parsed: Record<string, unknown> = {};
      try { parsed = journal.entry ? JSON.parse(journal.entry) : {}; } catch { parsed = {}; }
      records.push({ date: dayKey(journal.date), feature: "journal", label: "Daily journal", detail: [`mood: ${journal.mood || "not captured"}`, `completion: ${parsed.tasksCompleted ? "captured" : "not captured"}`].join("; "), privateText: journal.entry });
    }
    for (const entry of hypnosis) records.push({ date: entry.localDate || dayKey(entry.completedAt), feature: "hypnosis", label: entry.moduleId, detail: entry.fullCompletion ? "completed" : "session recorded" });
    records.sort((a, b) => a.date.localeCompare(b.date) || a.feature.localeCompare(b.feature) || a.label.localeCompare(b.label));
    const totals = { peptide: doses.length, meal: meals.length, journal: journals.length, hypnosis: hypnosis.length };
    return NextResponse.json({ success: true, report: { startDate, endDate, records, totals, missing: buildMissing(totals) } });
  } catch (error) {
    console.error("GET /api/reports/reset error:", error);
    return NextResponse.json({ error: "Failed to load Reset report" }, { status: 500 });
  }
}
