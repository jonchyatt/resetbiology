export type PeptideHistoryStatus = "completed" | "pending" | "missed";

export interface PeptideHistoryRecord {
  id: string;
  userId: string;
  protocolId: string;
  protocolName: string;
  administrationType: string;
  localDate: string;
  localTime: string;
  dosage: string;
  notes: string;
  sideEffects: string[];
  status: PeptideHistoryStatus;
  protocolSnapshot: Record<string, unknown> | null;
}

export interface HistoryFilters {
  startDate?: string;
  endDate?: string;
  protocolId?: string;
  administrationType?: string;
  status?: PeptideHistoryStatus | "all";
}

export function normalizeSideEffects(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
}

export function recordMatchesFilters(record: PeptideHistoryRecord, filters: HistoryFilters): boolean {
  if (filters.startDate && record.localDate < filters.startDate) return false;
  if (filters.endDate && record.localDate > filters.endDate) return false;
  if (filters.protocolId && record.protocolId !== filters.protocolId) return false;
  if (filters.administrationType && record.administrationType !== filters.administrationType) return false;
  if (filters.status && filters.status !== "all" && record.status !== filters.status) return false;
  return true;
}

export function filterHistory(records: PeptideHistoryRecord[], filters: HistoryFilters): PeptideHistoryRecord[] {
  return records.filter((record) => recordMatchesFilters(record, filters));
}

export function summarizeHistory(records: PeptideHistoryRecord[]) {
  const byProtocol = new Map<string, { protocolId: string; protocolName: string; total: number; completed: number; pending: number; missed: number }>();
  const sideEffects = new Map<string, number>();
  let completed = 0;
  let pending = 0;
  let missed = 0;
  for (const record of records) {
    const current = byProtocol.get(record.protocolId) ?? {
      protocolId: record.protocolId,
      protocolName: record.protocolName,
      total: 0,
      completed: 0,
      pending: 0,
      missed: 0,
    };
    current.total += 1;
    current[record.status] += 1;
    byProtocol.set(record.protocolId, current);
    if (record.status === "completed") completed += 1;
    if (record.status === "pending") pending += 1;
    if (record.status === "missed") missed += 1;
    for (const effect of record.sideEffects) sideEffects.set(effect, (sideEffects.get(effect) ?? 0) + 1);
  }
  return {
    total: records.length,
    completed,
    pending,
    missed,
    byProtocol: [...byProtocol.values()].sort((a, b) => a.protocolName.localeCompare(b.protocolName)),
    sideEffects: [...sideEffects.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

export function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function historyToCsv(records: PeptideHistoryRecord[]): string {
  const header = ["date", "time", "protocol", "administration", "dosage", "status", "notes", "side_effects"];
  const rows = records.map((record) => [
    record.localDate,
    record.localTime,
    record.protocolName,
    record.administrationType,
    record.dosage,
    record.status,
    record.notes,
    record.sideEffects.join("; "),
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}
