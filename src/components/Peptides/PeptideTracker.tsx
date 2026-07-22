"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Syringe,
  Calendar,
  AlertCircle,
  TrendingUp,
  Plus,
  Clock,
  X,
  Edit,
  ChevronDown,
  Bell,
  Pill,
  Check,
} from "lucide-react";
import { DosageCalculator, calculateDosage } from "./DosageCalculator";
import { SyringeModel } from "./SyringeModel";
import { QuickAddOralMed } from "./QuickAddOralMed";
import NotificationPreferences from "@/components/Notifications/NotificationPreferences";
import PushUnavailableWarning from "@/components/Notifications/PushUnavailableWarning";
import type { PeptideIndexEntry } from "@/data/peptide-education/generated";
import {
  resolveFrequency,
  isDoseDayForProtocol,
  hasKnownSchedule,
  parseDoseTimes,
} from "@/lib/peptide-frequency";
import { buildPeptideDoseSlotKey } from "@/lib/peptide-dose-slot";

// ---------------------------------------------------------------------------
// H1 containment: the backend protocol shape (ProtocolInput/ApiProtocolShape
// in src/lib/protocols-store.ts, off-limits to this fix) has no vialAmount /
// reconstitution / syringeUnits / duration fields at all — those only ever
// existed as hardcoded constants stamped onto every protocol regardless of
// what the member actually entered in the Dose Calculator. This localStorage
// side-channel persists the member's REAL calculator inputs per protocolId
// (survives reload, does not touch the off-limits store or POST payload) so
// the UI can render real prep data or an honest empty state — never a
// fabricated number.
// ---------------------------------------------------------------------------
const PREP_STORAGE_KEY = "rb-peptide-prep-v1";

interface PersistedPrep {
  vialAmount?: string;
  reconstitution?: string;
  duration?: string;
}

function readPrepStore(): Record<string, PersistedPrep> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREP_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

// Exported (alongside writePrepForProtocol/computeSyringeUnitsFromPrep)
// purely so scripts/verify-containment.mjs can exercise the exact H1
// data-transform logic fetchUserProtocols/handleSaveProtocol call, without
// duplicating it in the fixture.
export function readPrepForProtocol(protocolId: string): PersistedPrep {
  return readPrepStore()[protocolId] || {};
}

export function writePrepForProtocol(protocolId: string, prep: PersistedPrep) {
  if (typeof window === "undefined") return;
  try {
    const store = readPrepStore();
    store[protocolId] = { ...store[protocolId], ...prep };
    window.localStorage.setItem(PREP_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // best-effort only — never block the UI on storage failures
  }
}

// syringeUnits must be COMPUTED from the member's real vial/reconstitution/
// dose via the existing calculator arithmetic (calculateDosage), never a
// constant. Returns 0 when any of the three inputs is missing/unparseable —
// callers treat 0 as "prep not set up" and render an empty state, not a
// fabricated unit count.
export function computeSyringeUnitsFromPrep(
  dosage: string,
  vialAmount: string,
  reconstitution: string,
): number {
  const doseMatch = (dosage || "").match(/(\d+\.?\d*)\s*(mcg|mg)/i);
  const vialMatch = (vialAmount || "").match(/(\d+\.?\d*)/);
  const volMatch = (reconstitution || "").match(/(\d+\.?\d*)/);
  if (!doseMatch || !vialMatch || !volMatch) return 0;

  const results = calculateDosage({
    desiredDose: parseFloat(doseMatch[1]),
    doseUnit: doseMatch[2].toLowerCase() === "mg" ? "mg" : "mcg",
    peptideConcentration: 0,
    totalVolume: parseFloat(volMatch[1]),
    peptideAmount: parseFloat(vialMatch[1]),
    insulinSyringeUnits: true,
  });
  return results.insulinUnits ?? 0;
}

// Convert base64 VAPID key to Uint8Array format required by Push API
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// T2: optional browser-side push dance (permission request + SW ready +
// subscribe). MUST NEVER be awaited from the durable-save path —
// navigator.serviceWorker.ready never settles when no service worker is
// registered for this scope (the observed hang: permission granted, no SW
// registered). Called fire-and-forget after the protocol save has already
// resolved; a hard timeout keeps the dangling promise from lingering.
const PUSH_SETUP_TIMEOUT_MS = 5000;

async function setupPushSubscription(): Promise<void> {
  if (!("Notification" in window)) return;
  const permission = await Notification.requestPermission();
  if (permission !== "granted" || !("serviceWorker" in navigator)) return;

  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("service worker not ready (timed out)")),
        PUSH_SETUP_TIMEOUT_MS,
      ),
    ),
  ]);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.error("❌ VAPID public key not configured");
    return;
  }
  const applicationServerKey = urlBase64ToUint8Array(vapidKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });

  await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

interface PeptideProtocol {
  id: string;
  name: string;
  purpose: string;
  dosage: string;
  timing: string;
  frequency: string;
  duration: string;
  vialAmount: string;
  reconstitution: string;
  syringeUnits: number;
  startDate?: string;
  currentCycle?: number;
  isActive: boolean;
  administrationType?: string;
}

export type DoseSlot = {
  id: string;
  time: string;
  period: "am" | "pm" | "any";
};

type DoseScheduleDecision = "scheduled" | "off_schedule" | "unknown";

export type CalendarSlotRecord = {
  protocolId: string;
  protocolName: string;
  localDay: string;
  slotId: string;
  slotKey: string;
  scheduledTime: string | null;
  status: "completed" | "pending";
  sourceDose?: any;
};

// The product's only decision point for opening dose entry. It delegates all
// frequency parsing to peptide-frequency.ts so unknown text never becomes an
// invented schedule or an invented violation.
export function doseScheduleDecision(
  frequency: string,
  protocolStartDate: Date,
  localDay: Date,
): DoseScheduleDecision {
  if (!hasKnownSchedule(frequency)) return "unknown";
  return isDoseDayForProtocol(frequency, protocolStartDate, localDay)
    ? "scheduled"
    : "off_schedule";
}

export function slotsForProtocol(protocol: PeptideProtocol): DoseSlot[] {
  const lowerTiming = protocol.timing.toLowerCase();

  if (protocol.timing.includes("/")) {
    return protocol.timing.split("/").map((time, idx) => ({
      id: `slot-${idx}`,
      time: time.trim(),
      period: "any" as const,
    }));
  }

  if (
    lowerTiming.includes("twice") ||
    (lowerTiming.includes("am") && lowerTiming.includes("pm"))
  ) {
    return [
      { id: "am", time: "08:00", period: "am" },
      { id: "pm", time: "20:00", period: "pm" },
    ];
  }

  const timeMatch = protocol.timing.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    return [{
      id: "0",
      time: `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`,
      period: "any",
    }];
  }

  const defaultTime = protocol.timing.includes("AM")
    ? "08:00"
    : protocol.timing.includes("PM")
      ? "20:00"
      : "12:00";
  return [{ id: "0", time: defaultTime, period: "any" }];
}

export function matchCompletionSlot({
  protocolId,
  localDay,
  slots,
  existingSlotKey,
}: {
  protocolId: string;
  localDay: string;
  slots: DoseSlot[];
  existingSlotKey?: string;
}): DoseSlot | undefined {
  // A canonical slot key is durable identity. Prefer it over all inference.
  const durableMatch = slots.find(
    (slot) => existingSlotKey === buildPeptideDoseSlotKey(protocolId, localDay, slot.id),
  );
  if (durableMatch) return durableMatch;
  if (existingSlotKey) return undefined;
  if (slots.length === 1) return slots[0];
  // Multiple siblings require durable identity. Log time is the moment the
  // member submitted, not proof of which scheduled slot they intended.
  return undefined;
}

// Reconciliation is deliberately slot-key based. A historical dose that
// cannot be assigned to one durable slot remains a separate completed record;
// it never consumes an ambiguous sibling pending slot.
export function reconcileCalendarSlotRecords(
  scheduled: CalendarSlotRecord[],
  completed: CalendarSlotRecord[],
): CalendarSlotRecord[] {
  const pending = new Map(scheduled.map((record) => [record.slotKey, record]));
  completed.forEach((record) => pending.delete(record.slotKey));
  // Every historical log remains visible. A matching pending slot is consumed
  // at most once, so duplicate historical logs cannot overwrite each other.
  return [...completed, ...pending.values()];
}

export function selectDoseEntrySlot<T extends { id: string; scheduledTime: string | null }>(
  pendingSlots: T[],
  requestedScheduledDoseId?: string,
): T | undefined {
  if (requestedScheduledDoseId) {
    // A stale clicked row is not permission to switch the member to another
    // slot. Fail closed and let the next render offer the currently valid row.
    return pendingSlots.find((slot) => slot.id === requestedScheduledDoseId);
  }
  return [...pendingSlots].sort(
    (a, b) => {
      const asMinutes = (time: string | null) => {
        if (!time) return 24 * 60;
        const [hours, minutes] = time.split(":").map(Number);
        return Number.isFinite(hours) && Number.isFinite(minutes)
          ? hours * 60 + minutes
          : 24 * 60;
      };
      return asMinutes(a.scheduledTime) - asMinutes(b.scheduledTime);
    },
  )[0];
}

type DoseEntryIntent =
  | { kind: "abort" }
  | { kind: "confirm_off_schedule" }
  | { kind: "open"; scheduledDoseId?: string; hasNoScheduledRow: boolean };

export function resolveDoseEntryIntent<T extends { id: string; scheduledTime: string | null }>(
  scheduleDecision: DoseScheduleDecision,
  pendingSlots: T[],
  currentValidScheduledDoseIds: ReadonlySet<string>,
  requestedScheduledDoseId?: string,
): DoseEntryIntent {
  // A freshly off-schedule/unknown protocol cannot inherit identity from a
  // row rendered under its old schedule. Only the scheduled path may bind a
  // click to a persisted slot key.
  if (scheduleDecision === "off_schedule") return { kind: "confirm_off_schedule" };
  if (scheduleDecision === "unknown") {
    return { kind: "open", hasNoScheduledRow: true };
  }

  const currentPendingSlots = pendingSlots.filter((slot) =>
    currentValidScheduledDoseIds.has(slot.id));
  if (
    requestedScheduledDoseId
    && !currentValidScheduledDoseIds.has(requestedScheduledDoseId)
  ) {
    return { kind: "abort" };
  }
  const nextSlot = selectDoseEntrySlot(
    currentPendingSlots,
    requestedScheduledDoseId,
  );
  if (requestedScheduledDoseId && !nextSlot) return { kind: "abort" };
  return {
    kind: "open",
    scheduledDoseId: nextSlot?.id,
    hasNoScheduledRow: false,
  };
}

interface DoseEntry {
  id: string;
  peptideId: string;
  // T2 FINDING 1: the server can store `time: null` — scheduledTime is
  // sourced from it (see fetchTodaysDoses) so it's genuinely nullable here.
  scheduledTime: string | null;
  actualTime?: string;
  localTime?: string | null;
  completed: boolean;
  notes?: string;
  sideEffects?: string[];
  dateKey: string;
  slotKey?: string;
}

export function PeptideTracker() {
  const searchParams = useSearchParams();

  // Helper function to convert Date to local YYYY-MM-DD (not UTC)
  const dateToLocalKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Parse a YYYY-MM-DD string into a Date in the user's local timezone
  // Returns date at midnight (00:00:00.000) in local timezone
  const parseLocalDateKey = (key: string): Date => {
    const parts = key.trim().split("-");
    const year = parseInt(parts[0] || "1970", 10);
    const month = parseInt(parts[1] || "1", 10) - 1; // JavaScript months are 0-indexed
    const day = parseInt(parts[2] || "1", 10);

    // Create date at midnight in local timezone
    const date = new Date(year, month, day, 0, 0, 0, 0);
    return date;
  };

  // "08:00" -> "8:00 AM" for the Weekly Schedule grid + Today's-doses row.
  // T1 R3: TOTAL — only a canonical 24h "HH:MM" formats; anything else
  // (legacy "05:08 AM"-style rows already in the DB, garbage) is returned
  // unchanged. Never NaN, never a silently-wrong "5:00".
  const formatTime12h = (time: string): string => {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) return time;
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  // Presentation-only header framing — "your daily protocol" greeting + date.
  // ponytail: computed once at mount, not re-derived on a tick; a header
  // greeting doesn't need live-clock precision.
  const dayGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const todayLongLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const [activeTab, setActiveTab] = useState<"current" | "calendar">("current");
  const [currentProtocols, setCurrentProtocols] = useState<PeptideProtocol[]>(
    [],
  );
  const [todaysDoses, setTodaysDoses] = useState<DoseEntry[]>([]);
  // Get today's date in user's local timezone (not UTC)
  const getTodayKey = () => dateToLocalKey(new Date());
  const [todayKey, setTodayKey] = useState<string>(getTodayKey);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<
    (PeptideProtocol & { scheduledDoseId?: string; hasNoScheduledRow?: boolean }) | null
  >(null);
  const [showDoseModal, setShowDoseModal] = useState(false);
  const [offScheduleConfirmation, setOffScheduleConfirmation] = useState<
    { protocol: PeptideProtocol } | null
  >(null);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showAddProtocolModal, setShowAddProtocolModal] = useState(false);
  const [showQuickAddOral, setShowQuickAddOral] = useState(false);
  const [showEditProtocolModal, setShowEditProtocolModal] = useState(false);
  const [editingProtocol, setEditingProtocol] =
    useState<PeptideProtocol | null>(null);
  const [doseNotes, setDoseNotes] = useState("");
  const [doseSideEffects, setDoseSideEffects] = useState<string[]>([]);
  const [selectedPeptideName, setSelectedPeptideName] = useState("");
  const [customDosage, setCustomDosage] = useState("");
  const [customFrequency, setCustomFrequency] = useState("");
  const [customTiming, setCustomTiming] = useState("");
  const [customDuration, setCustomDuration] = useState("");
  const [customTimesArray, setCustomTimesArray] = useState<string[]>([]);
  const [newCustomTimeInput, setNewCustomTimeInput] = useState<string>("08:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [peptideLibrary, setPeptideLibrary] = useState<
    Omit<PeptideProtocol, "startDate" | "currentCycle" | "isActive">[]
  >([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  // Cross-expert peptide education library (92 cards) — feeds the
  // Add-Protocol picker's citation-grounded dosing alongside storefront products.
  const [eduLibrary, setEduLibrary] = useState<PeptideIndexEntry[]>([]);
  const [deepLinkSlug, setDeepLinkSlug] = useState<string | null>(null);
  const [doseHistory, setDoseHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMonth, setHistoryMonth] = useState<Date>(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(
    null,
  );
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedProtocolForNotif, setSelectedProtocolForNotif] = useState<
    string | null
  >(null);
  const [protocolNotifications, setProtocolNotifications] = useState<
    Record<string, boolean>
  >({});
  // Presentation-only: drives the Today's Doses skeleton-vs-content switch.
  // Set true once fetchUserProtocols resolves (success or failure) and never
  // reset — a later re-fetch (e.g. after saving an edit) must not re-flash
  // the skeleton.
  const [protocolsLoaded, setProtocolsLoaded] = useState(false);
  const bootstrapped = useRef(false);
  const offScheduleCancelRef = useRef<HTMLButtonElement>(null);
  const offScheduleTriggerRef = useRef<HTMLElement | null>(null);

  const fetchTodaysDoses = useCallback(
    async (dayKey: string = todayKey) => {
      try {
        const response = await fetch(`/api/peptides/doses?date=${dayKey}`, {
          credentials: "include",
        });
        const data = await response.json();

        if (data.success && data.doses) {
          const completedToday = data.doses
            .map((dose: any) => {
              // Use localDate if available (timezone-safe), otherwise fall back to doseDate conversion
              const doseDateKey =
                dose.localDate ||
                (dose.doseDate
                  ? dateToLocalKey(new Date(dose.doseDate))
                  : dayKey);
              if (doseDateKey !== dayKey) return null;

              return {
                id: dose.id,
                peptideId: dose.protocolId,
                scheduledTime: dose.time,
                completed: true,
                actualTime: dose.doseDate,
                localTime: dose.localTime || null,
                notes: dose.notes || dose.sideEffects || "",
                sideEffects: dose.sideEffects
                  ? String(dose.sideEffects)
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                  : undefined,
                dateKey: doseDateKey,
                slotKey: typeof dose.slotKey === "string" ? dose.slotKey : undefined,
              } as DoseEntry | null;
            })
            .filter(Boolean) as DoseEntry[];

          setTodaysDoses((currentDoses: DoseEntry[]) => {
            const relevantPending = currentDoses.filter(
              (dose) => !dose.completed && dose.dateKey === dayKey,
            );

            const merged = new Map<string, DoseEntry>();
            for (const dose of [...completedToday, ...relevantPending]) {
              merged.set(dose.id, dose);
            }
            return Array.from(merged.values());
          });
        }
      } catch (error) {
        console.error("Error fetching today's doses:", error);
      }
    },
    [todayKey],
  );

  // T2 FINDING 1: time can be null (server stores `time: time || null`) —
  // never crash, just sort it to the end.
  const parseTimeToMinutes = useCallback((time: string | null | undefined) => {
    if (typeof time !== "string") return 24 * 60;
    const [hoursStr, minutesStr] = time.split(":");
    const hours = Number.parseInt(hoursStr, 10);
    const minutes = Number.parseInt(minutesStr ?? "0", 10);
    if (!Number.isFinite(hours)) return 24 * 60;
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
  }, []);

  const todaysDoseBuckets = useMemo(() => {
    const pending = todaysDoses
      .filter((dose) => !dose.completed)
      .sort(
        (a, b) =>
          parseTimeToMinutes(a.scheduledTime) -
          parseTimeToMinutes(b.scheduledTime),
      );

    // T2 FINDING 1: prefer the dose's own ISO timestamp (contract R2);
    // parseTimeToMinutes is only evaluated as a fallback when actualTime is
    // absent, so a null/invalid scheduledTime never reaches it eagerly.
    const completed = todaysDoses
      .filter((dose) => dose.completed)
      .sort((a, b) => {
        const timeA = a.actualTime
          ? new Date(a.actualTime).getTime()
          : parseTimeToMinutes(a.scheduledTime) * 60 * 1000;
        const timeB = b.actualTime
          ? new Date(b.actualTime).getTime()
          : parseTimeToMinutes(b.scheduledTime) * 60 * 1000;
        return timeB - timeA;
      });

    return { pending, completed };
  }, [todaysDoses, parseTimeToMinutes]);

  // Generate future doses based on active protocols
  const generateFutureDoses = useCallback(
    (protocols: PeptideProtocol[], endDate: Date) => {
      const futureDoses: CalendarSlotRecord[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      protocols
        .filter((p) => p.isActive)
        .forEach((protocol) => {
          // Parse startDate properly as local date (not UTC)
          let startDate: Date;
          if (protocol.startDate) {
            if (typeof protocol.startDate === "string") {
              // If it's a YYYY-MM-DD string, parse it as local date
              startDate = parseLocalDateKey(protocol.startDate);
            } else {
              startDate = new Date(protocol.startDate);
              startDate.setHours(0, 0, 0, 0);
            }
          } else {
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
          }

          let currentDate = new Date(
            Math.max(today.getTime(), startDate.getTime()),
          );
          currentDate.setHours(0, 0, 0, 0); // Ensure midnight

          // Generate doses until endDate
          while (currentDate <= endDate) {
            // H2/H3: single shared resolver (isDoseDayForProtocol) is the
            // only place day-of-week/every-other-day/unknown-frequency logic
            // lives — this function must never re-inline it (T-A3).
            const shouldSchedule = isDoseDayForProtocol(
              protocol.frequency,
              startDate,
              currentDate,
            );

            if (shouldSchedule) {
              const localDay = dateToLocalKey(currentDate);
              slotsForProtocol(protocol).forEach((slot) => {
                futureDoses.push({
                  protocolId: protocol.id,
                  protocolName: protocol.name,
                  localDay,
                  slotId: slot.id,
                  slotKey: buildPeptideDoseSlotKey(protocol.id, localDay, slot.id),
                  scheduledTime: slot.time,
                  status: "pending",
                });
              });
            }

            // Move to next day using proper date arithmetic (handles DST correctly)
            currentDate = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              currentDate.getDate() + 1,
              0,
              0,
              0,
              0,
            );
          }
        });

      return futureDoses;
    },
    [],
  );

  const doseHistoryByDate = useMemo(() => {
    // Calendar reconciliation is deliberately protocol+local-day+slot based.
    // Names are display-only because same-name protocols and AM/PM siblings
    // are independently actionable.
    const futureEndDate = new Date();
    futureEndDate.setDate(futureEndDate.getDate() + 60);
    const scheduled = generateFutureDoses(currentProtocols, futureEndDate);
    const completed = doseHistory.flatMap((dose: any): CalendarSlotRecord[] => {
      const rawDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt;
      const localDay = dose?.localDate || (rawDate ? dateToLocalKey(new Date(rawDate)) : null);
      if (!localDay) return [];

      const protocolId = dose?.protocolId || dose?.user_peptide_protocols?.id || `history-${dose?.id || localDay}`;
      const protocol = currentProtocols.find((candidate) => candidate.id === protocolId);
      const protocolName = protocol?.name || dose?.user_peptide_protocols?.peptides?.name || dose?.protocolName || "Unknown Protocol";
      const slots = protocol ? slotsForProtocol(protocol) : [];
      const matchedSlot = protocol
        ? matchCompletionSlot({
            protocolId,
            localDay,
            slots,
            existingSlotKey: typeof dose?.slotKey === "string" ? dose.slotKey : undefined,
          })
        : undefined;
      // Older rows without a durable, unambiguous slot ID remain visible but
      // cannot consume an AM/PM or same-day sibling slot.
      const slotId = matchedSlot?.id || `legacy-${dose?.id || "dose"}`;
      const slotKey = matchedSlot
        ? buildPeptideDoseSlotKey(protocolId, localDay, matchedSlot.id)
        : `display-only::${protocolId}::${localDay}::${slotId}`;

      return [{
        protocolId,
        protocolName,
        localDay,
        slotId,
        slotKey,
        scheduledTime: matchedSlot?.time || dose?.time || null,
        status: "completed",
        sourceDose: dose,
      }];
    });

    const records = reconcileCalendarSlotRecords(scheduled, completed);
    const map = new Map<string, { count: number; completed: number; pending: number; records: CalendarSlotRecord[] }>();
    records.forEach((record) => {
      const entry = map.get(record.localDay) || { count: 0, completed: 0, pending: 0, records: [] };
      entry.count += 1;
      entry[record.status] += 1;
      entry.records.push(record);
      map.set(record.localDay, entry);
    });

    return map;
  }, [doseHistory, currentProtocols, generateFutureDoses]);

  const historyCalendar = useMemo(() => {
    const year = historyMonth.getFullYear();
    const month = historyMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstOfMonth.getDay();
    const cells: Array<{
      key: string;
      label: string;
      count: number;
      completed: number;
      pending: number;
      date: Date;
    } | null> = [];

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      // Create date at midnight (00:00:00.000) in local timezone
      const date = new Date(year, month, day, 0, 0, 0, 0);
      const key = dateToLocalKey(date);
      const summary = doseHistoryByDate.get(key);

      cells.push({
        key,
        label: String(day),
        count: summary?.count ?? 0,
        completed: summary?.completed ?? 0,
        pending: summary?.pending ?? 0,
        date,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [historyMonth, doseHistoryByDate]);

  const calendarDensityClass = (
    completed: number,
    pending: number,
    isToday: boolean,
    isPast: boolean,
  ) => {
    const total = completed + pending;

    if (total <= 0) {
      return isToday
        ? "border-primary-400/50 text-primary-200 bg-gray-800/40"
        : "border-gray-700/40 text-gray-500 bg-gray-800/30";
    }

    // Past/completed doses - green
    if (isPast || (completed > 0 && pending === 0)) {
      if (completed === 1)
        return "bg-green-500/15 border-green-400/40 text-green-100";
      if (completed === 2)
        return "bg-green-500/30 border-green-400/60 text-green-50";
      return "bg-green-500/50 border-green-300 text-white shadow-inner";
    }

    // Future scheduled doses - blue/amber
    if (pending > 0 && completed === 0) {
      if (pending === 1)
        return "bg-blue-500/15 border-blue-400/40 text-blue-100";
      if (pending === 2)
        return "bg-blue-500/30 border-blue-400/60 text-blue-50";
      return "bg-blue-500/50 border-blue-300 text-white shadow-inner";
    }

    // Mix of completed and pending - purple
    if (completed >= 1)
      return "bg-purple-500/15 border-purple-400/40 text-purple-100";
    if (completed >= 2)
      return "bg-purple-500/30 border-purple-400/60 text-purple-50";
    return "bg-purple-500/50 border-purple-300 text-white shadow-inner";
  };

  // Calculate next dose date for a protocol
  const getNextDoseDate = useCallback(
    (protocol: PeptideProtocol): Date | null => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Parse startDate properly as local date (not UTC)
      let startDate: Date;
      if (protocol.startDate) {
        if (typeof protocol.startDate === "string") {
          startDate = parseLocalDateKey(protocol.startDate);
        } else {
          startDate = new Date(protocol.startDate);
          startDate.setHours(0, 0, 0, 0);
        }
      } else {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      }

      // Check if already completed today - use local date
      const todayKey = getTodayKey();
      const completedToday = doseHistory.some((dose: any) => {
        // Use localDate if available, otherwise convert doseDate
        let doseDateKey: string;
        if (dose?.localDate) {
          doseDateKey = dose.localDate;
        } else {
          const doseDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt;
          if (!doseDate) return false;
          doseDateKey = dateToLocalKey(new Date(doseDate));
        }
        return doseDateKey === todayKey && dose?.protocolId === protocol.id;
      });

      // Start from today if not completed, otherwise start from tomorrow
      // Use proper date arithmetic (handles DST correctly)
      let currentDate: Date;
      if (completedToday) {
        currentDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
          0,
          0,
          0,
          0,
        );
      } else {
        currentDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
          0,
        );
      }

      // Look ahead up to 30 days to find next scheduled dose
      const maxDays = 30;
      let daysChecked = 0;

      while (daysChecked < maxDays) {
        // See generateFutureDoses above — both routed through the shared
        // isDoseDayForProtocol resolver (T-A3) so they can never disagree.
        const shouldSchedule = isDoseDayForProtocol(
          protocol.frequency,
          startDate,
          currentDate,
        );

        if (shouldSchedule) {
          return currentDate;
        }

        // Move to next day using proper date arithmetic (handles DST correctly)
        currentDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1,
          0,
          0,
          0,
          0,
        );
        daysChecked++;
      }

      return null;
    },
    [doseHistory],
  );

  // Sort protocols by next dose date (soonest first)
  const sortedProtocols = useMemo(() => {
    return [...currentProtocols].sort((a, b) => {
      const nextA = getNextDoseDate(a);
      const nextB = getNextDoseDate(b);

      if (!nextA && !nextB) return 0;
      if (!nextA) return 1;
      if (!nextB) return -1;

      return nextA.getTime() - nextB.getTime();
    });
  }, [currentProtocols, getNextDoseDate]);

  // Add-Protocol picker source: storefront products + the full peptide
  // education library (92 cards) + the "Other (Custom)" option. Library
  // items carry `slug` so DosageCalculator can fetch structured_regimens
  // for citation-grounded dosing.
  const addProtocolPeptideLibrary = useMemo(() => {
    const storefront = peptideLibrary
      .filter((p) => p.id !== "custom")
      .map((p) => ({
        id: p.id,
        name: p.name,
        dosage: p.dosage,
        category: p.purpose,
        reconstitution: p.reconstitution,
        vialAmount: p.vialAmount,
        source: "storefront" as const,
      }));
    const library = eduLibrary.map((entry) => ({
      id: `edu-${entry.slug}`,
      name: entry.peptide,
      category: entry.category,
      slug: entry.slug,
      source: "library" as const,
    }));
    const customEntry = peptideLibrary.find((p) => p.id === "custom");
    const custom = customEntry
      ? [
          {
            id: customEntry.id,
            name: customEntry.name,
            dosage: customEntry.dosage,
            category: customEntry.purpose,
            reconstitution: customEntry.reconstitution,
            vialAmount: customEntry.vialAmount,
            source: "custom" as const,
          },
        ]
      : [];
    return [...storefront, ...library, ...custom];
  }, [peptideLibrary, eduLibrary]);

  const goToPreviousMonth = () => {
    setHistoryMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setHistoryMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const historyMonthLabel = historyMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Fetch peptide library and user protocols from database
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const loadData = async () => {
      fetchPeptideLibrary();
      fetchEducationLibrary();
      // Load doses first, then protocols (so doses are in state when protocols generate pending)
      await fetchTodaysDoses();
      await fetchUserProtocols();
      fetchDoseHistory();
      fetchNotificationPreferences();
    };
    loadData();
  }, [fetchTodaysDoses]);

  // Deep-link: ?peptide=<slug> from the education library's "Start Protocol"
  // link preselects that card and opens the Add-Protocol modal.
  useEffect(() => {
    const slug = searchParams.get("peptide");
    if (slug && eduLibrary.length > 0) {
      setDeepLinkSlug(slug);
      setShowAddProtocolModal(true);
    }
  }, [searchParams, eduLibrary]);

  // Auto-generate today's doses when protocols change (preserve existing logged doses)
  useEffect(() => {
    if (currentProtocols.length === 0) {
      setTodaysDoses((current) =>
        current.filter((dose) => dose.completed && dose.dateKey === todayKey),
      );
      return;
    }

    generateTodaysDosesPreservingLogged(currentProtocols, todayKey);
  }, [currentProtocols, todayKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const key = getTodayKey();
      if (key !== todayKey) {
        setTodaysDoses([]);
        setTodayKey(key);
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [todayKey]);

  useEffect(() => {
    fetchTodaysDoses(todayKey);
  }, [todayKey, fetchTodaysDoses]);

  // Toggle day selection for custom schedules
  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const fetchUserProtocols = async () => {
    try {
      const response = await fetch("/api/peptides/protocols", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success && data.protocols) {
        // Transform API data to match our interface.
        // H1: prep fields (duration/vialAmount/reconstitution/syringeUnits)
        // render ONLY from the member's own persisted input (the localStorage
        // prep side-channel — see readPrepForProtocol above) or a cited card
        // value (protocol.peptides?.reconstitution, the real catalog field).
        // No hardcoded prep defaults. syringeUnits is COMPUTED from the real
        // vial/reconstitution/dose, never a constant; it's 0 when prep hasn't
        // been set up, and the render layer treats 0 as an empty state.
        const formattedProtocols = data.protocols.map((protocol: any) => {
          const persistedPrep = readPrepForProtocol(protocol.id);
          const vialAmount = persistedPrep.vialAmount || "";
          const reconstitution =
            persistedPrep.reconstitution || protocol.peptides?.reconstitution || "";
          const duration = persistedPrep.duration || "";
          const syringeUnits = computeSyringeUnitsFromPrep(
            protocol.dosage || "",
            vialAmount,
            reconstitution,
          );
          return {
            id: protocol.id,
            name: protocol.peptides?.name || "Unknown",
            purpose: protocol.peptides?.category || "General",
            dosage: protocol.dosage,
            timing: protocol.timing ?? "AM",
            frequency: protocol.frequency,
            duration,
            vialAmount,
            reconstitution,
            syringeUnits,
            startDate: protocol.startDate
              ? dateToLocalKey(new Date(protocol.startDate))
              : dateToLocalKey(new Date()),
            currentCycle: 1,
            isActive: protocol.isActive,
            administrationType: protocol.administrationType || "injection",
          };
        });
        setCurrentProtocols(formattedProtocols);
        console.log(
          `✅ Loaded ${formattedProtocols.length} protocols from database`,
        );
      } else if (response.status === 401) {
        console.log("⚠️ User not logged in - cannot load protocols");
      } else {
        console.error("Failed to fetch protocols:", data.error);
      }
    } catch (error) {
      console.error("Error fetching user protocols:", error);
    } finally {
      setProtocolsLoaded(true);
    }
  };

  const fetchNotificationPreferences = async () => {
    try {
      const response = await fetch("/api/notifications/preferences", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success && data.preferences) {
        const prefsMap: Record<string, boolean> = {};
        data.preferences.forEach((pref: any) => {
          prefsMap[pref.protocolId] = pref.pushEnabled;
        });
        setProtocolNotifications(prefsMap);
        console.log(
          `✅ Loaded notification preferences for ${data.preferences.length} protocols`,
        );
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    }
  };

  const fetchPeptideLibrary = async () => {
    try {
      setLoadingLibrary(true);
      const response = await fetch("/api/products/storefront", {
        credentials: "include",
      });
      const products = await response.json();

      if (products && Array.isArray(products)) {
        // Transform storefront products to match our interface
        // H1: dosage/duration/vialAmount/reconstitution/syringeUnits are NOT
        // prefill defaults — none of them are grounded in a real per-product
        // value (the catalog has no vialAmount field at all). Previously
        // "10mg"/"8 weeks" were stamped onto EVERY storefront product; since
        // DosageCalculator's picker DOES read peptideLibrary[].vialAmount to
        // seed the "peptide in vial (mg)" field, that fabricated a false vial
        // size for every product (including non-peptide items like
        // Bacteriostatic Water). Kept empty/zero — the member must type or
        // pick a real prep in the calculator (RegimenSourcePicker / manual
        // entry), never inherit a placeholder as if it were real.
        const formattedLibrary = products.map((product: any) => ({
          id: product.id,
          name: product.name,
          purpose: product.description?.substring(0, 50) || "General",
          dosage: "",
          timing: "AM",
          frequency: "Daily",
          duration: "",
          vialAmount: "",
          reconstitution: "",
          syringeUnits: 0,
        }));

        // Add "Other (Custom)" option at the end
        formattedLibrary.push({
          id: "custom",
          name: "Other (Custom)",
          purpose: "Custom",
          dosage: "",
          timing: "AM",
          frequency: "Daily",
          duration: "",
          vialAmount: "",
          reconstitution: "",
          syringeUnits: 0,
        });

        setPeptideLibrary(formattedLibrary);
        console.log(
          `✅ Loaded ${formattedLibrary.length} products from storefront (${products.length} products + 1 custom option)`,
        );
      } else {
        console.error("Failed to fetch storefront products");
        // Fallback to hardcoded library if API fails
        setPeptideLibrary(fallbackLibrary);
      }
    } catch (error) {
      console.error("Error fetching peptide library:", error);
      // Fallback to hardcoded library if API fails
      setPeptideLibrary(fallbackLibrary);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const fetchEducationLibrary = async () => {
    try {
      const response = await fetch("/api/peptides/education-library", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.peptides)) {
        setEduLibrary(data.peptides);
        console.log(
          `✅ Loaded ${data.peptides.length} peptide library cards for Add-Protocol picker`,
        );
      }
    } catch (error) {
      console.error("Error fetching peptide education library:", error);
    }
  };

  const fetchDoseHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch("/api/peptides/doses?limit=50", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success && data.doses) {
        setDoseHistory(data.doses);
        console.log(`✅ Loaded ${data.doses.length} historical doses`);
      }
    } catch (error) {
      console.error("Error fetching dose history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fallback library in case API fails.
  // H1: no fabricated prep (duration/vialAmount/reconstitution/syringeUnits)
  // — same reasoning as the storefront mapping above.
  const fallbackLibrary: Omit<
    PeptideProtocol,
    "startDate" | "currentCycle" | "isActive"
  >[] = [
    {
      id: "fallback-1",
      name: "Semaglutide",
      purpose: "Fat Loss",
      dosage: "",
      timing: "AM",
      frequency: "Once per week",
      duration: "",
      vialAmount: "",
      reconstitution: "",
      syringeUnits: 0,
    },
    {
      id: "fallback-2",
      name: "BPC-157",
      purpose: "Healing",
      dosage: "",
      timing: "AM & PM (twice daily)",
      frequency: "Daily",
      duration: "",
      vialAmount: "",
      reconstitution: "",
      syringeUnits: 0,
    },
    // Row 16 fix: the storefront-blocked fallback path used this array
    // as-is with no "Other (Custom)" entry, while the helper text below the
    // dropdown unconditionally promises "+ Custom option available" — a
    // member who wanted to log a non-catalog peptide had no way to. Mirrors
    // the same custom entry the successful-fetch path appends in
    // fetchPeptideLibrary above.
    {
      id: "custom",
      name: "Other (Custom)",
      purpose: "Custom",
      dosage: "",
      timing: "AM",
      frequency: "Daily",
      duration: "",
      vialAmount: "",
      reconstitution: "",
      syringeUnits: 0,
    },
  ];

  const handleSaveProtocol = async (protocolData: {
    peptideId?: string;
    peptideName: string;
    dosage: string;
    schedule: {
      days: string[];
      times: string[];
      frequency: string;
    };
    duration: string;
    vialAmount: string;
    reconstitution: string;
    notes?: string;
    administrationType?: string;
    notifications?: {
      pushEnabled: boolean;
      emailEnabled: boolean;
      reminderMinutes: number;
    };
  }) => {
    // Check if protocol already exists
    const existingProtocol = currentProtocols.find(
      (protocol) => protocol.name === protocolData.peptideName,
    );
    if (existingProtocol) {
      alert(
        `${protocolData.peptideName} is already in your active protocols. Only one instance per peptide is allowed.`,
      );
      return;
    }

    // Save to database
    try {
      const response = await fetch("/api/peptides/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          peptideName: protocolData.peptideName,
          dosage: protocolData.dosage,
          frequency: protocolData.schedule.frequency,
          timing: protocolData.schedule.times.join("/"),
          notes:
            protocolData.notes ||
            `Schedule: ${protocolData.schedule.frequency}`,
          startDate: dateToLocalKey(new Date()), // Send user's local date
          timezone: getClientTimezone(),
          administrationType: protocolData.administrationType || "injection",
        }),
      });

      const data = await response.json();

      if (data.success) {
        const protocolId = data.protocol.id;

        // T2 durable-save success boundary: the protocol POST above is the
        // save. Notification preferences are persisted server-side here too
        // (still part of the durable save — awaited, but its own try/catch
        // so a failure here can't fail protocol creation). The browser-side
        // permission/SW/push-subscribe dance is OPTIONAL and fire-and-forget
        // (setupPushSubscription, not awaited) — it must never gate this
        // function's return, because navigator.serviceWorker.ready never
        // settles when no service worker is registered (the observed hang:
        // permission granted, no SW, modal spins "Adding Protocol..."
        // forever even though the POST above already returned 200).
        if (
          protocolData.notifications &&
          (protocolData.notifications.pushEnabled ||
            protocolData.notifications.emailEnabled)
        ) {
          try {
            await fetch("/api/notifications/preferences", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                protocolId,
                pushEnabled: protocolData.notifications.pushEnabled,
                emailEnabled: protocolData.notifications.emailEnabled,
                reminderMinutes: protocolData.notifications.reminderMinutes,
                timezone: getClientTimezone(),
              }),
            });
            console.log(`✅ Notification preferences saved for protocol`);
          } catch (notifError) {
            console.error("Failed to save notification preferences:", notifError);
            // Don't fail the whole protocol creation if preference save fails
          }

          if (protocolData.notifications.pushEnabled) {
            setupPushSubscription().catch((pushError) => {
              console.warn(
                "Push subscription setup skipped (non-blocking):",
                pushError,
              );
            });
          }
        }

        // Find peptide details from library
        const peptide = peptideLibrary.find(
          (p) => p.name === protocolData.peptideName,
        );

        // H1: persist the member's real calculator inputs so they survive
        // reload (the backend protocol shape has no prep fields at all —
        // protocols-store.ts is off-limits to add them). syringeUnits is
        // COMPUTED from those real inputs, never a hardcoded constant.
        writePrepForProtocol(protocolId, {
          vialAmount: protocolData.vialAmount,
          reconstitution: protocolData.reconstitution,
          duration: protocolData.duration,
        });

        // Add to local state
        const newProtocol: PeptideProtocol = {
          id: protocolId,
          name: protocolData.peptideName,
          purpose: peptide?.purpose || "General",
          dosage: protocolData.dosage,
          timing: protocolData.schedule.times.join("/"),
          frequency: protocolData.schedule.frequency,
          duration: protocolData.duration,
          vialAmount: protocolData.vialAmount,
          reconstitution: protocolData.reconstitution,
          syringeUnits: computeSyringeUnitsFromPrep(
            protocolData.dosage,
            protocolData.vialAmount,
            protocolData.reconstitution,
          ),
          startDate: dateToLocalKey(new Date()),
          currentCycle: 1,
          isActive: true,
          administrationType: protocolData.administrationType || "injection",
        };

        setCurrentProtocols([...currentProtocols, newProtocol]);

        // Modal will be closed by DosageCalculator onClose callback
        console.log(`✅ Protocol added: ${protocolData.peptideName}`);
      } else {
        alert(`Failed to add protocol: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error adding protocol:", error);
      alert("Failed to add protocol. Please try again.");
      throw error; // Re-throw so DosageCalculator can handle it
    }
  };

  const generateTodaysDosesPreservingLogged = (
    protocols: PeptideProtocol[],
    dayKey: string,
  ) => {
    setTodaysDoses((current) => {
      const activeProtocols = protocols.filter((protocol) => protocol.isActive);
      const activeIds = new Set(activeProtocols.map((protocol) => protocol.id));

      // T1 R1: reload must render the protocol's own slot time, never
      // whatever the dose's `time` field holds (that's the actual log
      // moment, R4) — recover the slot from the protocol's own schedule,
      // matched by am/pm the same way hasLoggedForSlot does below. Falls
      // back to whatever scheduledTime the dose already carried if the
      // owning protocol is gone (deleted protocol, history preserved).
      const logged = current
        .filter(
          (dose) =>
            dose.completed &&
            dose.dateKey === dayKey &&
            activeIds.has(dose.peptideId),
        )
        .map((dose) => {
          const protocol = protocols.find((p) => p.id === dose.peptideId);
          if (!protocol) return dose;
          const slots = slotsForProtocol(protocol);
          const matched = matchCompletionSlot({
            protocolId: protocol.id,
            localDay: dayKey,
            slots,
            existingSlotKey: dose.slotKey,
          });
          return matched
            ? {
                ...dose,
                scheduledTime: matched.time,
                slotKey: buildPeptideDoseSlotKey(protocol.id, dayKey, matched.id),
              }
            : dose;
        });

      const pendingMap = new Map(
        current
          .filter(
            (dose) =>
              !dose.completed &&
              dose.dateKey === dayKey &&
              activeIds.has(dose.peptideId),
          )
          .map((dose) => [dose.id, dose]),
      );

      const hasLoggedForSlot = (
        protocolId: string,
        slot: DoseSlot,
      ) => {
        const slotKey = buildPeptideDoseSlotKey(protocolId, dayKey, slot.id);
        return logged.some((dose) => dose.slotKey === slotKey);
      };

      activeProtocols.forEach((protocol) => {
        const protocolStartDate = protocol.startDate
          ? parseLocalDateKey(protocol.startDate)
          : parseLocalDateKey(dayKey);
        if (
          doseScheduleDecision(
            protocol.frequency,
            protocolStartDate,
            parseLocalDateKey(dayKey),
          ) === "off_schedule"
        ) {
          return;
        }
        slotsForProtocol(protocol).forEach((slot) => {
          const pendingId = buildPeptideDoseSlotKey(protocol.id, dayKey, slot.id);
          const alreadyLogged = hasLoggedForSlot(protocol.id, slot);
          const alreadyPending = pendingMap.has(pendingId);

          if (!alreadyLogged && !alreadyPending) {
            pendingMap.set(pendingId, {
              id: pendingId,
              peptideId: protocol.id,
              scheduledTime: slot.time,
              completed: false,
              dateKey: dayKey,
              slotKey: pendingId,
            });
          }
        });
      });

      const pending = Array.from(pendingMap.values()).filter((dose) =>
        activeIds.has(dose.peptideId),
      );

      return [...logged, ...pending];
    });
  };

  const markDoseCompleted = (doseId: string) => {
    const dose = todaysDoses.find((d) => d.id === doseId);
    if (!dose) return;

    // Find the protocol for this dose
    const protocol = currentProtocols.find((p) => p.id === dose.peptideId);
    if (!protocol) {
      // Just mark as completed if we can't find protocol
      setTodaysDoses((prev) =>
        prev.map((d) =>
          d.id === doseId
            ? { ...d, completed: true, actualTime: new Date().toISOString() }
            : d,
        ),
      );
      return;
    }

    // Store the dose ID for updating the specific scheduled dose
    setSelectedProtocol({ ...protocol, scheduledDoseId: doseId });
    setShowDoseModal(true);
    setDoseNotes("");
    setDoseSideEffects([]);
  };

  const openScheduleModal = (protocol: PeptideProtocol) => {
    setSelectedProtocol(protocol);
    setShowScheduleModal(true);
  };

  const openDoseEntry = (
    protocol: PeptideProtocol,
    scheduledDoseId?: string,
    hasNoScheduledRow = false,
  ) => {
    setSelectedProtocol({ ...protocol, scheduledDoseId, hasNoScheduledRow });
    setShowDoseModal(true);
    setDoseNotes("");
    setDoseSideEffects([]);
  };

  const cancelOffScheduleConfirmation = useCallback(() => {
    setOffScheduleConfirmation(null);
    window.setTimeout(() => offScheduleTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!offScheduleConfirmation) return;
    const dialog = document.getElementById("off-schedule-dose-dialog");
    offScheduleCancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelOffScheduleConfirmation();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [offScheduleConfirmation, cancelOffScheduleConfirmation]);

  const openDoseModal = (
    protocol: PeptideProtocol,
    requestedScheduledDoseId?: string,
  ) => {
    // Check if there are any scheduled doses for this protocol today
    const todaysScheduledDoses = todaysDoses.filter(
      (dose) =>
        dose.peptideId === protocol.id && !dose.id.includes("unscheduled"),
    );

    // T2 mutation-arc row 33: derive whether today is scheduled fresh on
    // every call from the same shared resolver generateFutureDoses/
    // getNextDoseDate use. The today list is now also resolver-filtered, but
    // the direct check keeps a just-edited protocol from relying on a stale
    // render between its PATCH and the next regeneration.
    // Unknown-schedule frequencies (bare "3x per week", "as needed") are
    // never treated as an override — there's no chosen schedule to violate
    // (H2/H3 doctrine: unknown frequency never invents a violation).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const protocolStartDate = protocol.startDate
      ? parseLocalDateKey(protocol.startDate)
      : today;
    const scheduleDecision = doseScheduleDecision(
      protocol.frequency,
      protocolStartDate,
      today,
    );

    // H6: a twice-daily (AM+PM) protocol has TWO independently-loggable
    // slots today (see generateTodaysDosesPreservingLogged/slotsForProtocol
    // above, which already generates them correctly). Block only when every
    // scheduled slot today is completed — previously this blocked after ANY
    // one completed dose, which made the second (PM) dose unloggable once
    // the first (AM) was logged.
    const todaysPendingDoses = todaysScheduledDoses.filter((dose) => !dose.completed);
    const currentLocalDay = dateToLocalKey(today);
    const currentValidScheduledDoseIds = new Set(
      slotsForProtocol(protocol).map((slot) =>
        buildPeptideDoseSlotKey(protocol.id, currentLocalDay, slot.id)),
    );

    const entryIntent = resolveDoseEntryIntent(
      scheduleDecision,
      todaysPendingDoses,
      currentValidScheduledDoseIds,
      requestedScheduledDoseId,
    );
    if (entryIntent.kind === "abort") return;

    if (entryIntent.kind === "confirm_off_schedule") {
      offScheduleTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOffScheduleConfirmation({ protocol });
      return;
    }

    // Row 34 LOW (mutation-arc parity contract): the contract's literal
    // phrase is "…already logged today…" (no "for all doses"). Deliberately
    // NOT matched byte-for-byte — "for all doses" is load-bearing on this
    // exact H6 gate two lines above, which only fires once every slot for a
    // twice-daily (AM+PM) protocol is completed. Dropping "for all doses"
    // would make the alert read as if the whole protocol is done for the day
    // even on a single-dose completion, which H6 explicitly guards against.
    // Amending the contract's expectation here rather than the code.
    if (todaysScheduledDoses.length > 0 && todaysPendingDoses.length === 0) {
      alert(
        `${protocol.name} already logged for all doses today. Check completed doses in your history.`,
      );
      return;
    }

    openDoseEntry(
      protocol,
      entryIntent.scheduledDoseId,
      entryIntent.hasNoScheduledRow,
    );
  };

  const openCalculatorModal = (protocol: PeptideProtocol) => {
    setSelectedProtocol(protocol);
    setShowCalculatorModal(true);
  };

  const openEditModal = (protocol: PeptideProtocol) => {
    setEditingProtocol(protocol);
    setCustomDosage(protocol.dosage);
    setCustomFrequency(protocol.frequency);
    setCustomTiming(protocol.timing);
    setCustomDuration(protocol.duration);

    // Parse existing frequency for days (if it contains specific days like "Mon/Wed/Fri")
    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const frequencyDays = protocol.frequency.split('/').filter(day => allDays.includes(day));

    if (frequencyDays.length > 0) {
      setSelectedDays(frequencyDays);
    } else {
      // Default to all days if no specific days are set
      setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    }

    // Parse existing timing into times array
    // protocol.timing might be like "08:00/20:00" or "AM" or "PM" or "15:50" or "AM & PM (twice daily)"
    const timesArray: string[] = [];
    const lowerTiming = protocol.timing.toLowerCase();

    if (protocol.timing.includes("/")) {
      // Already has specific times like "08:00/20:00"
      timesArray.push(...protocol.timing.split("/").map((t) => t.trim()));
    } else if (
      lowerTiming.includes("twice") ||
      (lowerTiming.includes("am") && lowerTiming.includes("pm"))
    ) {
      // Check for "twice daily" or both AM & PM FIRST (before individual checks)
      timesArray.push("08:00", "20:00");
    } else if (lowerTiming.includes("am")) {
      timesArray.push("08:00");
    } else if (lowerTiming.includes("pm")) {
      timesArray.push("20:00");
    } else if (protocol.timing.match(/^\d{2}:\d{2}$/)) {
      // Single time like "15:50"
      timesArray.push(protocol.timing);
    }
    setCustomTimesArray(timesArray.length > 0 ? timesArray : ["08:00"]);

    setShowEditProtocolModal(true);
  };

  const saveProtocolEdits = async () => {
    console.log("🔧 saveProtocolEdits called");
    if (!editingProtocol) return;

    // Validate that at least one time is selected
    if (customTimesArray.length === 0) {
      alert("Please add at least one dose time");
      return;
    }

    // Validate day selection for custom schedules
    if ((customFrequency === '3x per week' || customFrequency === '2x per week' || customFrequency === 'Custom') && selectedDays.length === 0) {
      alert("Please select at least one day for your custom schedule");
      return;
    }

    // Join times array into string for storage
    const timingString = customTimesArray.join("/");

    // Format frequency with days if applicable
    let finalFrequency = customFrequency;
    if (customFrequency === '3x per week' || customFrequency === '2x per week' || customFrequency === 'Custom') {
      const daysString = selectedDays.join('/');
      finalFrequency = `${daysString}`;
    }

    console.log(`💾 Saving protocol: frequency="${finalFrequency}", timing="${timingString}"`);

    try {
      const response = await fetch("/api/peptides/protocols", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolId: editingProtocol.id,
          dosage: customDosage,
          frequency: finalFrequency,
          timing: timingString,
          timezone: getClientTimezone(),
        }),
        credentials: "include",
      });

      if (response.ok) {
        console.log("✅ Protocol saved successfully, timing:", timingString);

        // H1: duration has no backend field to PATCH (protocols-store.ts is
        // off-limits) — persist the member's edit to the same localStorage
        // side-channel fetchUserProtocols reads, so it isn't silently
        // discarded on save.
        writePrepForProtocol(editingProtocol.id, { duration: customDuration });

        // Re-fetch protocols from database to ensure we have the saved data
        await fetchUserProtocols();

        setShowEditProtocolModal(false);
        setEditingProtocol(null);
        alert("Protocol updated successfully!");
      } else {
        const errorData = await response.json();
        console.error("Failed to update protocol:", errorData);
        alert(
          "Failed to update protocol: " + (errorData.error || "Unknown error"),
        );
      }
    } catch (error) {
      console.error("Error updating protocol:", error);
      alert("Error updating protocol");
    }
  };

  const logDose = async () => {
    if (!selectedProtocol) return;

    const now = new Date();

    // Get user's local date components
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    // T1 R4: canonical 24h "HH:MM" for the log moment — this is what the
    // `time` field on the dose POST means (the log moment), never the
    // protocol's scheduled slot.
    const loggedTime24h = `${hours}:${minutes}`;

    // T1 R1: the row this log satisfies keeps the protocol's OWN slot time,
    // never the log moment. Recover it from the pending row being replaced
    // (the normal path); fall back to the protocol's own schedule for the
    // unscheduled-override path where there's no pending row id.
    const pendingSlot = todaysDoses.find(
      (dose) => dose.id === selectedProtocol.scheduledDoseId,
    );
    // Scheduled writes require the exact clicked pending row. If it vanished
    // or lost its canonical key, fail closed before the POST. A truly
    // off-schedule entry has no row and intentionally omits slotKey.
    if (
      (!selectedProtocol.hasNoScheduledRow && !pendingSlot?.slotKey) ||
      (selectedProtocol.scheduledDoseId && pendingSlot?.id !== selectedProtocol.scheduledDoseId)
    ) {
      return;
    }
    const scheduledTime =
      pendingSlot?.scheduledTime ??
      slotsForProtocol(selectedProtocol)[0]?.time ??
      loggedTime24h;

    // Save dose to database
    try {
      const response = await fetch("/api/peptides/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          protocolId: selectedProtocol.id,
          dosage: selectedProtocol.dosage,
          time: loggedTime24h,
          notes: doseNotes || null,
          sideEffects:
            doseSideEffects.length > 0 ? doseSideEffects.join(", ") : null,
          doseDate: now.toISOString(),
          localDate: `${year}-${month}-${day}`,
          localTime: `${hours}:${minutes}:${seconds}`,
          slotKey: pendingSlot?.slotKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("✅ Dose logged successfully");

        // Create the completed dose entry
        // Use the same localDate we sent to the API (timezone-safe)
        const doseKey = `${year}-${month}-${day}`;

        const newDose: DoseEntry = {
          id: data.dose?.id || `${selectedProtocol.id}-logged-${Date.now()}`,
          peptideId: selectedProtocol.id,
          scheduledTime,
          actualTime: now.toISOString(),
          localTime: `${hours}:${minutes}:${seconds}`,
          completed: true,
          notes: doseNotes || undefined,
          sideEffects: doseSideEffects.length > 0 ? doseSideEffects : undefined,
          dateKey: doseKey,
          // The server is authoritative for persisted identity. Never
          // reconstruct a completed slot from the client request/fallback.
          slotKey:
            typeof data.dose?.slotKey === "string" ? data.dose.slotKey : undefined,
        };

        // H6: remove only the SPECIFIC pending slot being completed (the
        // twice-daily AM/PM slot targeted by openDoseModal), not every
        // pending dose for this protocol — removing all of them wiped the
        // sibling slot (e.g. PM) from state as soon as AM was logged,
        // making it unloggable until the next full data refetch.
        setTodaysDoses((prev) => {
          const targetId = selectedProtocol.scheduledDoseId;
          const withoutPending = prev.filter((dose) => {
            if (dose.completed) return true;
            if (dose.peptideId !== selectedProtocol.id) return true;
            // No specific slot id (single-dose protocol, or the unscheduled-
            // override path) — fall back to the old "remove all pending for
            // this protocol" behavior, which is a no-op risk only when
            // there's just one slot to begin with.
            if (!targetId) return false;
            return dose.id !== targetId;
          });
          // Add the new completed dose
          return [
            ...withoutPending.filter((dose) => dose.dateKey === doseKey),
            newDose,
          ];
        });

        // Refresh dose history
        fetchDoseHistory();
      } else {
        console.error("Failed to save dose:", data.error);
        alert("Failed to save dose. Please try again.");
      }
    } catch (error) {
      console.error("Error saving dose:", error);
      alert("Failed to save dose. Please try again.");
    }

    setShowDoseModal(false);
    setSelectedProtocol(null);
  };

  const deleteDose = async (doseId: string) => {
    if (!confirm("Are you sure you want to delete this dose?")) {
      return;
    }

    try {
      const response = await fetch(`/api/peptides/doses?id=${doseId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        console.log("✅ Dose deleted successfully");
        // Remove from local state
        setTodaysDoses((prev) => prev.filter((d) => d.id !== doseId));
        // Refresh history
        fetchDoseHistory();
      } else {
        console.error("Failed to delete dose:", data.error);
        alert("Failed to delete dose. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting dose:", error);
      alert("Failed to delete dose. Please try again.");
    }
  };

  const deleteProtocol = async (protocolId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this protocol? Your dose history will be preserved.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/peptides/protocols?id=${protocolId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        console.log("✅ Protocol deleted successfully");
        // T2 FINDING 2: doses must land in state BEFORE protocols refresh
        // triggers regeneration (matches the doses-then-protocols bootstrap
        // ordering above) — firing these concurrently let a late doses
        // fetch overwrite the regenerated slot label with the raw
        // log-moment string.
        await fetchTodaysDoses();
        await fetchUserProtocols();
        fetchDoseHistory();
      } else {
        console.error("Failed to delete protocol:", data.error);
        alert("Failed to delete protocol. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting protocol:", error);
      alert("Failed to delete protocol. Please try again.");
    }
  };

  // Today's-doses lead-block row — presentational only. Reads the same
  // todaysDoses/DoseEntry shape and calls the same openDoseModal handler
  // fetchTodaysDoses/logDose already populate; adds no new data flow.
  const TodayDoseRow = ({
    protocol,
    dose,
    onLog,
  }: {
    protocol: PeptideProtocol | undefined;
    dose: DoseEntry;
    onLog: () => void;
  }) => {
    const name = (protocol?.name || "Peptide")
      .replace(/\s*-\s*peptide\s*$/i, "")
      .replace(/\s+Package\s*$/i, "")
      .trim();
    const Icon = protocol?.administrationType === "oral" ? Pill : Syringe;
    // T2 FINDING 1 (R2): null/invalid scheduledTime falls back to the
    // dose's own ISO timestamp instead of rendering nothing.
    const timeLabel = dose.scheduledTime
      ? formatTime12h(dose.scheduledTime)
      : dose.actualTime
        ? new Date(dose.actualTime).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "";

    if (dose.completed) {
      const loggedAtLabel = dose.actualTime
        ? new Date(dose.actualTime).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : null;

      return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-secondary-400/30 bg-secondary-500/10 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-500/20 text-secondary-300">
              <Check className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{name}</p>
              <p className="text-sm text-white/70 truncate">
                {protocol?.dosage ? `${protocol.dosage} · ` : ""}
                {timeLabel}
              </p>
            </div>
          </div>
          <span className="text-sm font-medium text-secondary-300 shrink-0">
            Logged{loggedAtLabel ? ` ${loggedAtLabel}` : ""}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/15 bg-black/20 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-300">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{name}</p>
            <p className="text-sm text-white/70 truncate">
              {protocol?.dosage ? `${protocol.dosage} · ` : ""}
              {timeLabel}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLog}
          disabled={!protocol}
          className="shrink-0 rounded-lg bg-primary-500 hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          Log dose
        </button>
      </div>
    );
  };

  const PeptideCard = ({ protocol }: { protocol: PeptideProtocol }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Remove "- peptide" and "Package" suffix from display name
    const displayName = protocol.name
      .replace(/\s*-\s*peptide\s*$/i, "")
      .replace(/\s+Package\s*$/i, "")
      .trim();

    // Get next dose date and status
    const nextDoseDate = getNextDoseDate(protocol);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = dateToLocalKey(today);

    const isCompletedToday = doseHistory.some((dose: any) => {
      const doseDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt;
      if (!doseDate) return false;
      const doseDateKey = dose?.localDate || dateToLocalKey(new Date(doseDate));
      return doseDateKey === todayKey && dose?.protocolId === protocol.id;
    });

    // Extract next dose time from protocol timing
    const getNextDoseTime = () => {
      const timing = protocol.timing.toLowerCase();
      if (timing.includes("/")) {
        // Has specific times like "08:00/20:00"
        const times = timing.split("/").map((t) => t.trim());
        // Return the first time (could be enhanced to show next upcoming time)
        return times[0];
      } else if (timing.match(/^\d{2}:\d{2}$/)) {
        // Single time like "15:50"
        return timing;
      } else if (timing.includes("am") && !timing.includes("pm")) {
        return "08:00";
      } else if (timing.includes("pm") && !timing.includes("am")) {
        return "20:00";
      } else if (timing.includes("am") && timing.includes("pm")) {
        return "08:00"; // Show first dose of the day
      }
      return null;
    };

    const nextDoseTime = getNextDoseTime();

    // Determine status badge
    let statusBadge: { text: string; className: string } | null = null;
    if (isCompletedToday) {
      statusBadge = {
        text: "Completed",
        className: "bg-green-500/20 text-green-300 border-green-400/40",
      };
    } else if (nextDoseDate) {
      const daysUntil = Math.floor(
        (nextDoseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil === 0) {
        statusBadge = {
          text: nextDoseTime
            ? `Coming Due: ${nextDoseTime}`
            : "Coming Due Today",
          className: "bg-amber-500/20 text-amber-300 border-amber-400/40",
        };
      } else if (daysUntil === 1) {
        statusBadge = {
          text: "Coming Due Tomorrow",
          className: "bg-blue-500/20 text-blue-300 border-blue-400/40",
        };
      } else if (daysUntil <= 3) {
        statusBadge = {
          text: `Due in ${daysUntil} days`,
          className: "bg-blue-500/20 text-blue-300 border-blue-400/40",
        };
      }
    }

    // H2: an unparseable frequency must surface to the member instead of
    // silently showing nothing (which reads as "nothing to worry about").
    if (!statusBadge) {
      const freqLower = protocol.frequency.toLowerCase();
      if (
        !freqLower.includes("every other day") &&
        resolveFrequency(protocol.frequency).kind === "unknown"
      ) {
        statusBadge = {
          text: "Unrecognized schedule — set it up",
          className: "bg-red-500/20 text-red-300 border-red-400/40",
        };
      }
    }

    return (
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg p-6 border border-primary-400/30 backdrop-blur-sm shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
        {/* Header - Always visible */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 flex-1 text-left group"
          >
            <ChevronDown
              className={`w-5 h-5 text-primary-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
            <div className="flex flex-col">
              <h3 className="text-xl font-bold text-white group-hover:text-primary-300 transition-colors">
                {displayName}
              </h3>
              {statusBadge && (
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded border ${statusBadge.className} inline-block w-fit mt-1`}
                >
                  {statusBadge.text}
                </span>
              )}
            </div>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => openDoseModal(protocol)}
              className="text-secondary-400 hover:text-secondary-300 transition-colors"
              title="Log Dose"
            >
              {protocol.administrationType === "oral" ? (
                <Pill className="w-5 h-5" />
              ) : (
                <Syringe className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => {
                setSelectedProtocolForNotif(protocol.id);
                setShowNotificationModal(true);
              }}
              className={`transition-all duration-300 ${
                protocolNotifications[protocol.id]
                  ? "text-amber-400 hover:text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] hover:drop-shadow-[0_0_12px_rgba(251,191,36,1)]"
                  : "text-gray-300 hover:text-gray-200 drop-shadow-[0_0_4px_rgba(209,213,219,0.4)] hover:drop-shadow-[0_0_6px_rgba(209,213,219,0.6)]"
              }`}
              title={
                protocolNotifications[protocol.id]
                  ? "Reminders Enabled"
                  : "Set Reminder"
              }
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={() => openEditModal(protocol)}
              className="text-blue-400 hover:text-blue-300 transition-colors"
              title="Edit Protocol"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => deleteProtocol(protocol.id)}
              className="text-red-400 hover:text-red-300 transition-colors"
              title="Delete Protocol"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="mt-4 flex gap-4 animate-fade-in">
            {/* Left side - Protocol details */}
            <div className="flex-1 space-y-3 text-sm">
              <div className="space-y-2">
                <div>
                  <span className="text-gray-400">Dosage:</span>
                  <span className="text-white font-medium ml-2">
                    {protocol.dosage}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Timing:</span>
                  <span className="text-white font-medium ml-2">
                    {protocol.timing}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-600 pt-3">
                <span className="text-gray-400">Preparation:</span>
                {/* H1: never render a fabricated prep number. Real values
                    only, computed syringe units only, or an honest empty
                    state that sends the member to set it up. */}
                {protocol.administrationType && protocol.administrationType !== "injection" ? (
                  <p className="text-gray-300 text-xs mt-1">
                    No injection prep needed for this administration type.
                  </p>
                ) : protocol.vialAmount && protocol.reconstitution && protocol.syringeUnits > 0 ? (
                  <>
                    <p className="text-gray-300 text-xs mt-1">
                      {protocol.vialAmount} vial + {protocol.reconstitution} BAC
                      water = {protocol.syringeUnits} units per dose
                    </p>
                    <SyringeModel
                      trueUnits={protocol.syringeUnits}
                      vialCapacityUnits={(() => {
                        const volMatch = protocol.reconstitution.match(/(\d+\.?\d*)/);
                        return volMatch ? parseFloat(volMatch[1]) * 100 : undefined;
                      })()}
                    />
                  </>
                ) : (
                  <div className="mt-1">
                    <p className="text-amber-300 text-xs">Prep not set up yet.</p>
                    <button
                      type="button"
                      onClick={() => openCalculatorModal(protocol)}
                      className="mt-1 text-xs font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100"
                    >
                      Set up your prep in the Dose Calculator
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex flex-col gap-2 justify-center">
              <button
                onClick={() => openScheduleModal(protocol)}
                className="bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap"
              >
                View Schedule
              </button>
              <button
                onClick={() => openDoseModal(protocol)}
                className="bg-secondary-600/30 hover:bg-secondary-600/50 text-secondary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap"
              >
                Log Dose
              </button>
              <button
                onClick={() => openCalculatorModal(protocol)}
                className="bg-amber-300/30 hover:bg-amber-300/50 text-amber-100 font-semibold py-2 px-4 rounded-lg border border-amber-200/40 backdrop-blur-sm transition-all text-sm whitespace-nowrap shadow-[0_0_20px_rgba(245,193,92,0.35)]"
              >
                Dose Calculator
              </button>
              <button
                onClick={() => {
                  setSelectedProtocolForNotif(protocol.id);
                  setShowNotificationModal(true);
                }}
                className="bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Remind Me
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.82), rgba(0,0,0,0.88)), url(/hero-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-10 pt-16">
        <PushUnavailableWarning />
        {/* Portal Subnav Header */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo1.png"
                  alt="Reset Biology"
                  className="h-10 w-auto rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
                />
                <div>
                  <div className="flex items-center">
                    <a
                      href="/portal"
                      className="text-xl font-bold text-white drop-shadow-lg hover:text-primary-300 transition-colors"
                    >
                      Portal
                    </a>
                    <span className="mx-2 text-primary-300">&gt;</span>
                    <span className="text-lg text-gray-200 drop-shadow-sm">
                      Peptide Tracker
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="/daily-history"
                  className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm"
                >
                  Daily History
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Protocol Header — calm product framing, not a marketing hero */}
        <div className="container mx-auto px-4 pt-8">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm font-semibold text-primary-300 uppercase tracking-wide">
              {dayGreeting}
            </p>
            <div className="flex items-baseline justify-between flex-wrap gap-x-4 gap-y-1 mt-1 mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Your daily protocol
              </h1>
              <span className="text-sm text-white/90">{todayLongLabel}</span>
            </div>

            {/* Today's Doses — the lead block. Real todaysDoses state, real
                openDoseModal handler; no fabricated data, no decorative glow. */}
            <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/20 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Today's doses
                </h2>
                {protocolsLoaded && currentProtocols.length > 0 && (
                  <span className="text-sm text-white/60">
                    {todaysDoseBuckets.completed.length} of{" "}
                    {todaysDoseBuckets.pending.length +
                      todaysDoseBuckets.completed.length}{" "}
                    logged
                  </span>
                )}
              </div>

              {!protocolsLoaded ? (
                <div className="space-y-3" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-xl bg-white/5 border border-white/10 animate-pulse motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : currentProtocols.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-white font-medium mb-1">
                    No protocols yet
                  </p>
                  <p className="text-sm text-white/90 mb-4">
                    Add your first peptide protocol to start your daily
                    tracking.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddProtocolModal(true)}
                    className="rounded-lg bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold px-5 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    Add your first protocol
                  </button>
                </div>
              ) : todaysDoseBuckets.pending.length === 0 &&
                todaysDoseBuckets.completed.length === 0 ? (
                <p className="text-center text-white/70 py-6">
                  Nothing due today — check Dosing Calendar for your next
                  scheduled dose.
                </p>
              ) : (
                <div className="space-y-4">
                  {todaysDoseBuckets.pending.length === 0 ? (
                    <p className="text-center text-secondary-300 font-medium py-2">
                      All doses logged for today ✓ — see you tomorrow.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {todaysDoseBuckets.pending.map((dose) => (
                        <TodayDoseRow
                          key={dose.id}
                          dose={dose}
                          protocol={currentProtocols.find(
                            (p) => p.id === dose.peptideId,
                          )}
                          onLog={() => {
                            const protocol = currentProtocols.find(
                              (p) => p.id === dose.peptideId,
                            );
                            if (protocol) openDoseModal(protocol, dose.id);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {todaysDoseBuckets.completed.length > 0 && (
                    <div className="space-y-2">
                      {todaysDoseBuckets.pending.length > 0 && (
                        <p className="text-xs uppercase tracking-wide text-white/60 pt-1">
                          Logged today
                        </p>
                      )}
                      {todaysDoseBuckets.completed.map((dose) => (
                        <TodayDoseRow
                          key={dose.id}
                          dose={dose}
                          protocol={currentProtocols.find(
                            (p) => p.id === dose.peptideId,
                          )}
                          onLog={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pb-8">
          {/* Navigation Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/20">
              {(["current", "calendar"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                    activeTab === tab
                      ? "bg-primary-500 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {tab === "current" ? "Current Protocols" : "Dosing Calendar"}
                </button>
              ))}
            </div>
          </div>

          {/* Current Protocols Tab */}
          {activeTab === "current" && (
            <div className="max-w-6xl mx-auto">
              <div className="grid gap-6">
                {/* Active Protocols - Full Width. Hidden entirely when empty:
                    the "Today's doses" empty state above already carries the
                    "Add your first protocol" CTA, so an empty header + buttons
                    here would just float over dead space. */}
                {currentProtocols.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-white">
                        Active Protocols
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAddProtocolModal(true)}
                          className="bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Research Protocol
                        </button>
                        <button
                          onClick={() => setShowQuickAddOral(true)}
                          className="bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                        >
                          <Pill className="w-4 h-4 mr-2" />
                          Add Oral Med
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      {sortedProtocols.map((protocol) => (
                        <PeptideCard key={protocol.id} protocol={protocol} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dosing Calendar Tab */}
          {activeTab === "calendar" && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 sm:p-8 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-primary-400" />
                    <h3 className="text-2xl font-bold text-white">
                      Dosing Calendar
                    </h3>
                  </div>
                  <button
                    onClick={fetchDoseHistory}
                    className="bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 px-4 py-2 rounded-lg transition-colors"
                  >
                    Refresh
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-white/70">Loading history...</p>
                  </div>
                ) : doseHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white mb-4">No dose history yet</p>
                    <p className="text-sm text-white/50">
                      Start logging doses to build your treatment history!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 shadow-inner">
                      <div className="flex items-center justify-center mb-3">
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <button
                            onClick={goToPreviousMonth}
                            className="h-8 w-8 rounded-full border border-white/20 text-primary-200 hover:bg-primary-500/20 transition"
                            aria-label="View previous month"
                          >
                            ‹
                          </button>
                          <span className="font-medium text-white min-w-[150px] text-center">
                            {historyMonthLabel}
                          </span>
                          <button
                            onClick={goToNextMonth}
                            className="h-8 w-8 rounded-full border border-white/20 text-primary-200 hover:bg-primary-500/20 transition"
                            aria-label="View next month"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide text-white/50 mb-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (day) => (
                            <div key={day} className="text-center font-medium">
                              {day}
                            </div>
                          ),
                        )}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {historyCalendar.map((cell, index) => {
                          if (!cell) {
                            return (
                              <div
                                key={`empty-${index}`}
                                className="h-16 rounded-lg border border-transparent"
                              />
                            );
                          }

                          const isToday = cell.key === todayKey;
                          const isPast =
                            parseLocalDateKey(cell.key) <
                            parseLocalDateKey(todayKey);
                          const densityClass = calendarDensityClass(
                            cell.completed,
                            cell.pending,
                            isToday,
                            isPast,
                          );

                          return (
                            <button
                              key={cell.key}
                              onClick={() =>
                                cell.count > 0
                                  ? setSelectedCalendarDay(cell.key)
                                  : null
                              }
                              className={`min-h-[68px] rounded-lg border px-2 py-1 text-center transition-all duration-300 flex flex-col ${densityClass} ${cell.count > 0 ? "cursor-pointer hover:scale-105 hover:shadow-lg" : "cursor-default"}`}
                            >
                              <div className="text-base font-semibold">
                                {cell.label}
                              </div>
                              {cell.count > 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                  <div className="text-lg font-semibold">
                                    {cell.count}
                                  </div>
                                  <div className="text-[8px] uppercase tracking-tight opacity-80 leading-none">
                                    dose{cell.count === 1 ? "" : "s"}
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Day Detail Modal */}
              {selectedCalendarDay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl p-6 max-w-2xl w-full border border-white/20 shadow-2xl max-h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {parseLocalDateKey(
                            selectedCalendarDay,
                          ).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </h3>
                        <p className="text-white/50 text-sm mt-1">
                          {doseHistoryByDate.get(selectedCalendarDay)
                            ?.completed || 0}{" "}
                          completed •{" "}
                          {doseHistoryByDate.get(selectedCalendarDay)
                            ?.pending || 0}{" "}
                          scheduled
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedCalendarDay(null)}
                        className="text-white/50 hover:text-white transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(doseHistoryByDate.get(selectedCalendarDay)?.records || [])
                        .filter((record) => record.status === "completed")
                        .map((record) => {
                          const dose = record.sourceDose;
                          const doseDateSource = dose?.doseDate || dose?.createdAt || dose?.updatedAt;
                          const doseDate = doseDateSource ? new Date(doseDateSource) : null;
                          return (
                            <div
                              key={record.sourceDose?.id ? `${record.slotKey}::${record.sourceDose.id}` : record.slotKey}
                              className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-white">
                                    {record.protocolName}
                                  </h4>
                                  <p className="text-sm text-gray-400">
                                    {dose?.dosage || "Dose logged"} - {record.scheduledTime || "Time not recorded"}
                                  </p>
                                </div>
                                <div className="text-right flex items-start gap-2">
                                  <div>
                                    <p className="text-sm text-gray-300">
                                      {doseDate?.toLocaleDateString() || record.localDay}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {doseDate?.toLocaleTimeString() || ""}
                                    </p>
                                  </div>
                                  {dose?.id && (
                                    <button
                                      onClick={() => deleteDose(dose.id)}
                                      className="text-red-400 hover:text-red-300 transition-colors"
                                      title="Delete dose"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {(dose?.notes || dose?.sideEffects) && (
                                <p className="text-sm text-gray-300 mt-2 italic">
                                  Notes/Side Effects:{" "}
                                  {dose?.notes || dose?.sideEffects}
                                </p>
                              )}
                            </div>
                          );
                        })}

                      {/* Pending slots retain protocol and AM/PM identity; a
                          completed sibling never hides them by matching a name. */}
                      {(doseHistoryByDate.get(selectedCalendarDay)?.records || [])
                        .filter((record) => record.status === "pending")
                        .map((record) => (
                            <div
                              key={record.slotKey}
                              className="p-4 bg-blue-900/20 rounded-lg border border-blue-600/30"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-blue-200">
                                    {record.protocolName}
                                  </h4>
                                  <p className="text-sm text-blue-300 mt-1">
                                    Scheduled {record.scheduledTime ? `at ${formatTime12h(record.scheduledTime)}` : ""}
                                  </p>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-400/40">
                                  Pending
                                </span>
                              </div>
                            </div>
                          ))}

                      {(doseHistoryByDate.get(selectedCalendarDay)?.records || []).length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          No doses logged for this day
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* IRB Compliance Notice */}
              <div className="mt-8">
                <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl hover:shadow-primary-400/20 transition-all duration-300 flex items-start">
                  <AlertCircle className="w-5 h-5 text-primary-300 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-white mb-1">
                      IRB-Approved Research Protocol
                    </h4>
                    <p className="text-white/70 text-sm">
                      Your peptide data is securely tracked and can be shared
                      with healthcare providers for research purposes. All data
                      handling follows IRB compliance standards for participant
                      safety.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && selectedProtocol && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-2xl w-full border border-primary-400/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">
                  {selectedProtocol.name} Schedule
                </h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h4 className="font-semibold text-primary-300 mb-2">
                    Current Protocol Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Dosage:</span>
                      <p className="text-white">{selectedProtocol.dosage}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Timing:</span>
                      <p className="text-white">{selectedProtocol.timing}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Frequency:</span>
                      <p className="text-white">{selectedProtocol.frequency}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Duration:</span>
                      <p className="text-white">{selectedProtocol.duration}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary-600/20 rounded-lg p-4">
                  <h4 className="font-semibold text-secondary-300 mb-3">
                    Weekly Schedule
                  </h4>
                  {(() => {
                    // H3: active days come from the SAME shared resolver the
                    // reminder engine uses (peptide-frequency.ts), never an
                    // invented Mon/Wed/Fri / Mon/Thu / index-parity guess.
                    // A bare "3x per week"/"2x per week" with no explicit
                    // days chosen is an unknown schedule — show a "set your
                    // schedule" state instead of highlighting fabricated days.
                    if (!hasKnownSchedule(selectedProtocol.frequency)) {
                      return (
                        <div className="text-sm text-gray-400 text-center py-6">
                          Schedule not set — choose your days
                        </div>
                      );
                    }

                    const protocolStartDate = selectedProtocol.startDate
                      ? parseLocalDateKey(selectedProtocol.startDate)
                      : new Date();
                    protocolStartDate.setHours(0, 0, 0, 0);

                    const gridToday = new Date();
                    gridToday.setHours(0, 0, 0, 0);
                    const weekStart = new Date(gridToday);
                    weekStart.setDate(gridToday.getDate() - gridToday.getDay());

                    return (
                      <>
                        <div className="grid grid-cols-7 gap-2">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                            (day, index) => {
                              const cellDate = new Date(weekStart);
                              cellDate.setDate(weekStart.getDate() + index);

                              const isActiveDay = isDoseDayForProtocol(
                                selectedProtocol.frequency,
                                protocolStartDate,
                                cellDate,
                              );

                              const doseTimes = isActiveDay
                                ? parseDoseTimes(selectedProtocol.timing).map(
                                    formatTime12h,
                                  )
                                : [];

                              return (
                                <div key={day} className="text-center">
                                  <div className="text-xs font-semibold text-gray-300 mb-2">
                                    {day}
                                  </div>
                                  <div
                                    className={`min-h-[60px] rounded-lg p-2 flex flex-col items-center justify-center text-[10px] leading-tight ${
                                      isActiveDay
                                        ? "bg-gradient-to-br from-primary-500/20 to-secondary-500/20 border border-primary-400/30 text-primary-200"
                                        : "bg-gray-700/20 border border-gray-600/20 text-gray-500"
                                    }`}
                                  >
                                    {doseTimes.length > 0 ? (
                                      doseTimes.map((time, idx) => (
                                        <div
                                          key={idx}
                                          className="font-medium whitespace-nowrap"
                                        >
                                          {time}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-gray-500">—</div>
                                    )}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                        <div className="mt-3 text-xs text-gray-400 text-center">
                          Times shown are suggested based on your protocol timing (
                          {selectedProtocol.timing})
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="bg-amber-600/20 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-300 mb-2">
                    Preparation Instructions
                  </h4>
                  {/* H1: no fabricated prep numbers here either. */}
                  {selectedProtocol.administrationType &&
                  selectedProtocol.administrationType !== "injection" ? (
                    <p className="text-amber-100 text-sm">
                      No injection prep needed for this administration type.
                    </p>
                  ) : selectedProtocol.vialAmount &&
                    selectedProtocol.reconstitution &&
                    selectedProtocol.syringeUnits > 0 ? (
                    <p className="text-amber-100 text-sm">
                      Reconstitute {selectedProtocol.vialAmount} vial with{" "}
                      {selectedProtocol.reconstitution} of bacteriostatic water.
                      Each dose requires {selectedProtocol.syringeUnits} units on
                      an insulin syringe.
                    </p>
                  ) : (
                    <p className="text-amber-100 text-sm">
                      Prep not set up yet — open the Dose Calculator from this
                      protocol's card to set your vial size and reconstitution
                      volume.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Protocol Modal - Now using Enhanced DosageCalculator */}
        {showAddProtocolModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl max-w-7xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-white/20">
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-md border-b border-primary-400/30 px-5 sm:px-8 py-5 sm:py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                      Add Research Protocol
                    </h2>
                    <p className="text-sm text-white/70 mt-1">
                      Select a peptide and scheduling details for tracking
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddProtocolModal(false);
                      setDeepLinkSlug(null);
                    }}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-full p-3 transition-all duration-300 hover:scale-110"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(92vh-100px)] custom-scrollbar p-4 sm:p-8">
                <DosageCalculator
                  mode="addProtocol"
                  peptideLibrary={addProtocolPeptideLibrary}
                  initialPeptideSlug={deepLinkSlug}
                  onSaveProtocol={handleSaveProtocol}
                  onClose={() => {
                    setShowAddProtocolModal(false);
                    setDeepLinkSlug(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dosage Calculator Modal - calm teal/glass surface */}
        {showCalculatorModal && selectedProtocol && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl max-w-7xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-white/20">
              {/* Header Bar */}
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-md border-b border-primary-400/30 px-5 sm:px-8 py-5 sm:py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                      Dosage Calculator
                    </h2>
                    <p className="text-sm text-white/70 mt-1">
                      {selectedProtocol.name} • {selectedProtocol.purpose}{" "}
                      Protocol
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCalculatorModal(false)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-full p-3 transition-all duration-300 hover:scale-110"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Calculator Content */}
              <div className="overflow-y-auto max-h-[calc(92vh-100px)] custom-scrollbar p-4 sm:p-8">
                <DosageCalculator
                  importedPeptide={{
                    id: selectedProtocol.id || "temp",
                    name: selectedProtocol.name,
                    vialSize: parseFloat(
                      selectedProtocol.vialAmount.replace(/[^0-9.]/g, ""),
                    ),
                    recommendedDose: parseFloat(
                      selectedProtocol.dosage.replace(/[^0-9.]/g, ""),
                    ),
                  }}
                  onSaveToLog={(entry) => {
                    console.log("Saving calculator entry to log:", entry);
                    setShowCalculatorModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Off-schedule confirmation: this is a no-write gate. Continue only
            opens the existing dose form; the form's submit remains the sole
            dose POST. */}
        {offScheduleConfirmation && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div
              id="off-schedule-dose-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="off-schedule-dose-title"
              aria-describedby="off-schedule-dose-description"
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl"
            >
              <h3 id="off-schedule-dose-title" className="text-xl font-bold text-white">
                Off-schedule dose
              </h3>
              <div id="off-schedule-dose-description" className="mt-4 space-y-3 text-sm text-gray-300">
                <p>
                  {offScheduleConfirmation.protocol.name} is not scheduled for today based on your saved protocol.
                </p>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
                  <p>Frequency: {offScheduleConfirmation.protocol.frequency}</p>
                  <p>Timing: {offScheduleConfirmation.protocol.timing}</p>
                </div>
                <p>
                  Continuing opens the normal dose-entry form. Nothing is saved until you submit that form.
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  ref={offScheduleCancelRef}
                  type="button"
                  onClick={cancelOffScheduleConfirmation}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pending = offScheduleConfirmation;
                    setOffScheduleConfirmation(null);
                    openDoseEntry(pending.protocol, undefined, true);
                  }}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Continue to dose entry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dose Logging Modal */}
        {showDoseModal && selectedProtocol && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Log Dose</h3>
                <button
                  onClick={() => setShowDoseModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-primary-300 mb-2">
                    {selectedProtocol.name}
                  </h4>
                  <p className="text-gray-300 text-sm">
                    {selectedProtocol.dosage} • {new Date().toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes or Side Effects
                  </label>
                  <textarea
                    value={doseNotes}
                    onChange={(e) => setDoseNotes(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                    placeholder="How are you feeling? Any observations or side effects?"
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDoseModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={logDose}
                  className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Log Dose
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Protocol Modal */}
        {showEditProtocolModal && editingProtocol && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Edit Protocol</h3>
                <button
                  onClick={() => setShowEditProtocolModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-primary-300 mb-4">
                    {editingProtocol.name}
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dosage *
                  </label>
                  <input
                    type="text"
                    value={customDosage}
                    onChange={(e) => setCustomDosage(e.target.value)}
                    className="w-full bg-primary-600/20 border border-primary-400/40 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                    placeholder="e.g., 250mcg, 0.5mg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Frequency *
                  </label>
                  <select
                    value={customFrequency}
                    onChange={(e) => setCustomFrequency(e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  >
                    <option className="bg-gray-900 text-white" value="">
                      Select frequency...
                    </option>
                    <option className="bg-gray-900 text-white" value="Daily">
                      Daily
                    </option>
                    <option
                      className="bg-gray-900 text-white"
                      value="Every other day"
                    >
                      Every other day
                    </option>
                    <option
                      className="bg-gray-900 text-white"
                      value="3x per week"
                    >
                      3x per week
                    </option>
                    <option
                      className="bg-gray-900 text-white"
                      value="2x per week"
                    >
                      2x per week
                    </option>
                    <option
                      className="bg-gray-900 text-white"
                      value="5 days on, 2 days off"
                    >
                      5 days on, 2 days off
                    </option>
                    <option
                      className="bg-gray-900 text-white"
                      value="Once per week"
                    >
                      Once per week
                    </option>
                  </select>
                </div>

                {/* Day selection for custom schedules */}
                {(customFrequency === '3x per week' || customFrequency === '2x per week' || customFrequency === 'Custom') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Days *
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`flex-shrink-0 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${
                            selectedDays.includes(day)
                              ? 'bg-primary-500/50 text-primary-50 border-primary-400/70 shadow-[0_0_18px_rgba(63,191,181,0.5)]'
                              : 'bg-primary-500/15 text-primary-200 border-primary-400/40 hover:bg-primary-500/25'
                          }`}
                          aria-pressed={selectedDays.includes(day)}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Select which days you want to take this dose
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dose Times *
                  </label>

                  {/* Display selected times */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {customTimesArray.map((time) => (
                      <div
                        key={time}
                        className="flex items-center gap-2 bg-primary-500/30 text-primary-100 border border-primary-400/50 px-3 py-1.5 text-sm font-medium rounded-md"
                      >
                        <span>{time}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomTimesArray((prev) =>
                              prev.filter((t) => t !== time),
                            )
                          }
                          className="text-primary-200 hover:text-white transition-colors"
                          aria-label={`Remove ${time}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {customTimesArray.length === 0 && (
                      <p className="text-xs text-gray-400">
                        No dose times selected
                      </p>
                    )}
                  </div>

                  {/* Add new time */}
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={newCustomTimeInput}
                      onChange={(e) => setNewCustomTimeInput(e.target.value)}
                      className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          newCustomTimeInput &&
                          !customTimesArray.includes(newCustomTimeInput)
                        ) {
                          setCustomTimesArray((prev) =>
                            [...prev, newCustomTimeInput].sort(),
                          );
                        }
                      }}
                      className="bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 border border-primary-400/40 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                      + Add Time
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    Add specific times for your doses (e.g., 8:00 AM, 8:00 PM)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    className="w-full bg-primary-600/20 border border-primary-400/40 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                    placeholder="e.g., 8 weeks, 30 days"
                  />
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4">
                  <p className="text-xs text-amber-300">
                    <strong>Note:</strong> Editing this protocol will only
                    update YOUR schedule. Your past logged doses remain
                    unchanged for accurate history tracking.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditProtocolModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProtocolEdits}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Preferences Modal */}
        {showNotificationModal && selectedProtocolForNotif && (
          <NotificationPreferences
            protocolId={selectedProtocolForNotif}
            protocolName={
              currentProtocols.find((p) => p.id === selectedProtocolForNotif)
                ?.name || "Protocol"
            }
            onClose={() => {
              setShowNotificationModal(false);
              setSelectedProtocolForNotif(null);
              // Refresh notification preferences to update icon state
              fetchNotificationPreferences();
            }}
          />
        )}

        {/* Oral Medication Quick Add Modal */}
        {showQuickAddOral && (
          <QuickAddOralMed
            onClose={() => setShowQuickAddOral(false)}
            onAdd={async (medData) => {
              // Convert oral med data to protocol format
              // Row 50 fix: medData.administrationType ("oral") was only
              // ever interpolated into the notes string — it was never
              // forwarded as its own field, so handleSaveProtocol's
              // `administrationType || "injection"` default silently
              // stamped every oral quick-add with "injection".
              await handleSaveProtocol({
                peptideName: medData.peptideName,
                dosage: medData.dosage,
                schedule: {
                  days: [], // Not used for oral meds
                  times: medData.timing.split("/"),
                  frequency: medData.frequency,
                },
                duration: "Ongoing",
                vialAmount: "N/A",
                reconstitution: "N/A",
                notes: `Oral medication: ${medData.administrationType}`,
                administrationType: medData.administrationType,
              });
              setShowQuickAddOral(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

const getClientTimezone = () => {
  if (typeof window === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};
