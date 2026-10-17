import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { exportMemberData } from "@/lib/member-data";
import { getUserFromSession } from "@/lib/getUserFromSession";
import {
  filterHistory,
  normalizeSideEffects,
  summarizeHistory,
  type PeptideHistoryRecord,
} from "@/lib/peptideHistory";

function validDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function localDateFromStored(date: Date, localDate?: string | null): string {
  if (validDateKey(localDate ?? null)) return localDate as string;
  return date.toISOString().slice(0, 10);
}

function datesBetween(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last && result.length < 367) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function protocolRunsDaily(frequency: string): boolean {
  return /daily|every\s*day|1x\s*(a|per)\s*day/i.test(frequency);
}

function scheduledTimes(protocol: { timing: string | null }): string[] {
  return (protocol.timing || "08:00").split(/[\/,]/).map((time) => time.trim()).filter(Boolean);
}

export async function GET(request: Request) {
  if (process.env.NEXT_PUBLIC_RB_REPORTS !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const session = await auth0.getSession();
    const user = await getUserFromSession(session);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const startDate = validDateKey(searchParams.get("startDate")) ? searchParams.get("startDate")! : today;
    const endDate = validDateKey(searchParams.get("endDate")) ? searchParams.get("endDate")! : startDate;
    const protocolId = searchParams.get("protocolId") || undefined;
    const administrationType = searchParams.get("administrationType") || undefined;
    const status = searchParams.get("status") as "all" | "completed" | "pending" | "missed" | null;
    // Rows come only from the member-data isolation layer (session user id, scopedWhere).
    const { data, peptideNames } = await exportMemberData(prisma as any, user.id);
    const peptideName = (protocol: any): string => peptideNames?.[protocol.peptideId] || "Personal protocol";
    const protocols = ((data.user_peptide_protocols ?? []) as any[]).filter((protocol) => !protocolId || protocol.id === protocolId);
    const protocolIds = new Set(protocols.map((protocol) => protocol.id));
    const doses = ((data.peptide_doses ?? []) as any[])
      .filter((dose) => protocolIds.has(dose.protocolId))
      .sort((a, b) => new Date(a.doseDate).getTime() - new Date(b.doseDate).getTime());
    const protocolById = new Map(protocols.map((protocol) => [protocol.id, protocol]));
    const records: PeptideHistoryRecord[] = doses.map((dose) => {
      const protocol = protocolById.get(dose.protocolId);
      return {
        id: dose.id,
        userId: user.id,
        protocolId: dose.protocolId,
        protocolName: dose.protocolName || (protocol ? peptideName(protocol) : "Personal protocol"),
        administrationType: protocol?.administrationType || "unspecified",
        localDate: localDateFromStored(new Date(dose.doseDate), dose.localDate),
        localTime: dose.localTime || dose.time || "",
        dosage: dose.dosage,
        notes: dose.notes || "",
        sideEffects: normalizeSideEffects(dose.sideEffects),
        status: "completed",
        protocolSnapshot: (dose.protocolSnapshot as Record<string, unknown> | null) || null,
      };
    });

    const completedKeys = new Set(records.map((record) => `${record.protocolId}|${record.localDate}|${record.localTime}`));
    for (const protocol of protocols) {
      if (!protocolRunsDaily(protocol.frequency)) continue;
      for (const date of datesBetween(startDate, endDate)) {
        for (const time of scheduledTimes(protocol)) {
          const key = `${protocol.id}|${date}|${time}`;
          if (completedKeys.has(key)) continue;
          records.push({
            id: `scheduled-${protocol.id}-${date}-${time}`,
            userId: user.id,
            protocolId: protocol.id,
            protocolName: peptideName(protocol),
            administrationType: protocol.administrationType || "unspecified",
            localDate: date,
            localTime: time,
            dosage: protocol.dosage,
            notes: "",
            sideEffects: [],
            status: date < today ? "missed" : "pending",
            protocolSnapshot: {
              peptideName: peptideName(protocol),
              dosage: protocol.dosage,
              frequency: protocol.frequency,
              timing: protocol.timing,
              administrationType: protocol.administrationType,
            },
          });
        }
      }
    }

    const filtered = filterHistory(records, { startDate, endDate, protocolId, administrationType, status: status || "all" });
    return NextResponse.json({ success: true, records: filtered, summary: summarizeHistory(filtered), startDate, endDate });
  } catch (error) {
    console.error("GET /api/peptides/history error:", error);
    return NextResponse.json({ error: "Failed to load peptide history" }, { status: 500 });
  }
}
