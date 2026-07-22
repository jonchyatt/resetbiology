"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, AlertCircle } from "lucide-react";
import type { PeptideCard } from "@/data/peptide-education/generated";
import {
  RegimenSourcePicker,
  mapRouteToAdministrationType,
  type AdministrationType,
} from "./RegimenSourcePicker";
import { SyringeModel } from "./SyringeModel";

/*********************************
 * Types
 *********************************/
export interface CalculatorInputs {
  desiredDose: number; // in mg or mcg
  doseUnit: "mg" | "mcg";
  peptideConcentration: number; // mcg/ml (optional display; calculated from vial + volume)
  totalVolume: number; // member-entered total volume in ml
  peptideAmount: number; // mg in vial
  insulinSyringeUnits?: boolean; // toggle for insulin syringe conversion
}

export interface CalculatorOutputs {
  volumeToDraw: number; // ml to draw
  insulinUnits?: number; // if using insulin syringe
  actualConcentration: number; // mcg/ml after reconstitution
  dosesPerVial: number; // total doses available
}

export interface DosageCalculatorProps {
  mode?: 'calculate' | 'addProtocol'; // New: determine behavior
  peptideLibrary?: Array<{           // New: from MongoDB, or a peptide-education library card
    id?: string;
    name: string;
    dosage?: string;
    category?: string;
    reconstitution?: string;
    vialAmount?: string;
    slug?: string;                   // present for peptide-education library cards
    source?: 'storefront' | 'library' | 'custom';
  }>;
  initialPeptideSlug?: string | null; // deep-link preselect (?peptide=<slug>)
  onSaveProtocol?: (protocol: {      // New: save protocol to DB
    peptideId?: string;
    peptideName: string;
    dosage: string;
    schedule: {
      days: string[];
      times: string[];
      frequency: string; // formatted string like "Mon-Fri AM"
    };
    duration: string;
    vialAmount: string;
    reconstitution: string;
    notes?: string;
    administrationType?: AdministrationType;
    notifications?: {               // New: notification preferences
      pushEnabled: boolean;
      emailEnabled: boolean;
      reminderMinutes: number;
    };
  }) => void;
  onClose?: () => void;              // New: close modal callback
  importedPeptide?: {
    id: string;
    name: string;
    vialSize: number;
    recommendedDose?: number;
  };
  onSaveToLog?: (data: {
    peptideName: string;
    dose: number;
    unit: string;
    volumeDrawn: number;
    timestamp: Date;
    notes?: string;
  }) => void;
  userPresets?: Array<{
    id: string;
    name: string;
    settings: CalculatorInputs;
  }>;
  onSavePreset?: (preset: { name: string; settings: CalculatorInputs }) => void;
  onImportFromPeptide?: (peptideId: string) => void;
}

/*********************************
 * Core calculation engine
 *********************************/
export const calculateDosage = (inputs: CalculatorInputs): CalculatorOutputs => {
  const safeTotalVolume = Number(inputs.totalVolume) || 0;
  const safePeptideAmount = Number(inputs.peptideAmount) || 0;
  const safeDesired = Number(inputs.desiredDose) || 0;

  // Prevent divide-by-zero
  if (safeTotalVolume <= 0 || safePeptideAmount <= 0 || safeDesired <= 0) {
    return {
      volumeToDraw: 0,
      insulinUnits: inputs.insulinSyringeUnits ? 0 : undefined,
      actualConcentration: 0,
      dosesPerVial: 0,
    };
  }

  // Convert dose to mcg if needed
  const doseInMcg = inputs.doseUnit === "mg" ? safeDesired * 1000 : safeDesired;

  // Calculate actual concentration after reconstitution (mcg/ml)
  const actualConcentration = (safePeptideAmount * 1000) / safeTotalVolume;

  // Calculate volume to draw (ml)
  const volumeToDraw = doseInMcg / actualConcentration;

  // Calculate insulin units if needed (100 units = 1ml)
  const insulinUnits = inputs.insulinSyringeUnits ? volumeToDraw * 100 : undefined;

  // Calculate doses per vial
  const dosesPerVial = Math.floor((safePeptideAmount * 1000) / doseInMcg);

  // Rounded outputs for display
  const roundedVolume = Number(volumeToDraw.toFixed(volumeToDraw < 1 ? 3 : 2));
  const roundedUnits = typeof insulinUnits === "number"
    ? Number(insulinUnits.toFixed(insulinUnits < 10 ? 1 : 0))
    : undefined;

  return {
    volumeToDraw: roundedVolume,
    insulinUnits: roundedUnits,
    actualConcentration,
    dosesPerVial,
  };
};
/*********************************
 * Utility helpers
 *********************************/
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const formatNumber = (n: number, digits = 2) =>
  Number.isFinite(n) ? Number(n.toFixed(digits)) : 0;

type PreparationState = "absent" | "complete" | "invalid";

// Add Protocol treats vial amount and total volume as one member-confirmed
// preparation. Catalog packaging is deliberately not preparation input.
export const getPreparationState = (vialAmount: string, totalVolume: string): PreparationState => {
  const vial = vialAmount.trim();
  const volume = totalVolume.trim();
  if (!vial && !volume) return "absent";

  const parsedVial = Number(vial);
  const parsedVolume = Number(volume);
  return Number.isFinite(parsedVial) && parsedVial > 0 && Number.isFinite(parsedVolume) && parsedVolume > 0
    ? "complete"
    : "invalid";
};

/*********************************
 * Reconstitution Guide Component
 *********************************/
const ReconstitutionGuide: React.FC<{ peptideAmount: number; volume: number }>
  = ({ peptideAmount, volume }) => {
    return (
      <div className="space-y-3 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-1">Preparation entered</h3>
        <p className="text-sm text-white/70 leading-snug">
          {formatNumber(peptideAmount, 2)} mg vial with {formatNumber(volume, 2)} mL total volume.
        </p>
      </div>
    );
  };




/*********************************
 * Main Dosage Calculator Component
 *********************************/
export const DosageCalculator: React.FC<DosageCalculatorProps> = ({
  mode = 'calculate',
  peptideLibrary,
  initialPeptideSlug,
  onSaveProtocol,
  onClose,
  importedPeptide,
  onSaveToLog,
  userPresets = [],
  onSavePreset,
}) => {
  const defaultInputs: CalculatorInputs = {
    // addProtocol mode: no hardcoded dose — filled from a cited regimen or
    // typed by the user (see CITATION-GROUNDED DOSING CONTRACT). calculate
    // mode is always seeded from importedPeptide below, so 250 there is
    // inert (never shown to a user before being overridden).
    desiredDose: mode === 'addProtocol' ? 0 : 250,
    doseUnit: "mcg",
    peptideConcentration: 0, // will be derived and displayed
    totalVolume: mode === 'addProtocol' ? 0 : 1,
    peptideAmount: mode === 'addProtocol' ? 0 : 10,
    insulinSyringeUnits: true,
  };

  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);
  const [preparation, setPreparation] = useState(() => ({
    totalVolume: mode === 'addProtocol' ? "" : String(defaultInputs.totalVolume),
    peptideAmount: mode === 'addProtocol' ? "" : String(defaultInputs.peptideAmount),
  }));
  // addProtocol mode starts with NO peptide selected (H4) — auto-selecting
  // peptideLibrary[0] previously landed on whatever the storefront listed
  // first, which could be a diluent like Bacteriostatic Water, not a real
  // peptide. "calculate" mode (standalone tool, no protocol attached) keeps
  // a reasonable starting display name.
  const [peptideName, setPeptideName] = useState<string>(mode === "addProtocol" ? "" : "BPC-157");
  const [selectedPeptideId, setSelectedPeptideId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // T2: synchronous re-entrancy guard. isSaving is React state — the DOM
  // `disabled` attribute lags a tick behind setIsSaving(true), so it alone
  // can't stop a second click that lands in the same tick as the first.
  // This ref is set synchronously before any await, closing that gap.
  const savingInFlightRef = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);
  // T3: gate the error BANNER's render behind interaction, not its
  // computation. `errors` still recomputes on every `inputs` change
  // (including mount) so the disabled logic below is untouched. The latch
  // is set ONLY inside real user event handlers (onChange/onBlur/submit)
  // below — never from an effect — so it survives StrictMode's double
  // mount-effect invoke and programmatic seeds (imported peptide, deep-link
  // ?peptide=<slug>, defaultInputs) without tripping.
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [isCustomPeptide, setIsCustomPeptide] = useState<boolean>(false);
  const [customPeptideName, setCustomPeptideName] = useState<string>("");

  // Citation-grounded dosing (addProtocol mode, library-sourced peptides)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [eduCard, setEduCard] = useState<PeptideCard | null>(null);
  const [eduLoading, setEduLoading] = useState<boolean>(false);
  const [administrationType, setAdministrationType] = useState<AdministrationType>("injection");
  const [adminTypeAutoNote, setAdminTypeAutoNote] = useState<string | null>(null);
  const adminTypeTouchedRef = useRef(false);
  const appliedInitialSlugRef = useRef(false);

  // New state for scheduling (addProtocol mode)
  const [scheduleType, setScheduleType] = useState<string>('daily');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['08:00']);
  const [duration, setDuration] = useState<string>('');
  const [newTimeInput, setNewTimeInput] = useState<string>('08:00');

  // Notification preferences
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(false);
  const [reminderMinutes, setReminderMinutes] = useState<number>(15);

  // Apply imported peptide defaults
  useEffect(() => {
    if (!importedPeptide) return;
    setPeptideName(importedPeptide.name);
    const importedVialSize = Number(importedPeptide.vialSize);
    const hasImportedVialSize = Number.isFinite(importedVialSize) && importedVialSize > 0;
    setInputs((prev) => ({
      ...prev,
      // An imported vial size is incomplete preparation without a member
      // confirmed volume, so Add Protocol must not turn it into dose math.
      peptideAmount: mode === 'addProtocol' ? 0 : (hasImportedVialSize ? importedVialSize : prev.peptideAmount),
      totalVolume: mode === 'addProtocol' ? 0 : prev.totalVolume,
      desiredDose: importedPeptide.recommendedDose ?? prev.desiredDose,
    }));
    if (mode === 'addProtocol') {
      setPreparation({ totalVolume: "", peptideAmount: "" });
    }
  }, [importedPeptide, mode]);

  // Live results
  const results = useMemo(() => calculateDosage(inputs), [inputs]);

  // Validation. Pure computation only — must NOT touch hasInteracted here.
  // "effect ran more than once" is not a proxy for "the member touched
  // something": StrictMode double-invokes this on the same mount, and
  // programmatic setInputs calls (loadPeptideFromLibrary, imported-peptide
  // seed, deep-link seed) re-run it too. The latch lives in the event
  // handlers that actually originate from user input instead.
  useEffect(() => {
    const e: string[] = [];
    const preparationState = getPreparationState(preparation.peptideAmount, preparation.totalVolume);
    if (mode !== 'addProtocol' && inputs.totalVolume <= 0) e.push("Total volume must be greater than 0 ml.");
    if (mode !== 'addProtocol' && inputs.peptideAmount <= 0) e.push("Peptide amount in vial must be greater than 0 mg.");
    if (mode === 'addProtocol' && preparationState === 'invalid') {
      e.push("Enter both vial amount and total volume, or leave both blank.");
    }
    if (inputs.desiredDose <= 0) e.push("Desired dose must be greater than 0.");
    setErrors(e);
  }, [inputs, mode, preparation]);

  // Derived values for visuals

  const unitMinMax = inputs.doseUnit === "mg"
    ? { min: 0.1, max: 15, step: 0.05 }
    : { min: 50, max: 5000, step: 10 };

  const handleSave = async () => {
    if (!onSaveToLog) return;
    setHasInteracted(true);
    try {
      setIsSaving(true);
      await onSaveToLog({
        peptideName,
        dose: inputs.desiredDose,
        unit: inputs.doseUnit,
        volumeDrawn: results.volumeToDraw,
        timestamp: new Date(),
        notes,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreset = () => {
    if (!onSavePreset) return;
    const name = prompt("Preset name");
    if (!name) return;
    onSavePreset({ name, settings: inputs });
  };

  // Scheduling helpers (addProtocol mode)
  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const addTime = () => {
    if (!newTimeInput || selectedTimes.includes(newTimeInput)) return;
    setSelectedTimes(prev => [...prev, newTimeInput].sort());
  };

  const removeTime = (time: string) => {
    setSelectedTimes(prev => prev.filter(t => t !== time));
  };

  const formatScheduleString = (type: string, days: string[], times: string[]): string => {
    let dayStr: string;

    switch (type) {
      case 'daily':
        dayStr = 'Daily';
        break;
      case 'everyOtherDay':
        dayStr = 'Every other day';
        break;
      case 'monFri':
        dayStr = 'Mon-Fri';
        break;
      case 'custom':
        dayStr = days.length === 7
          ? 'Daily'
          : days.length === 5 && !days.includes('Sat') && !days.includes('Sun')
          ? 'Mon-Fri'
          : days.join('/');
        break;
      default:
        dayStr = 'Daily';
    }

    const timeStr = times.join('/');
    return `${dayStr} ${timeStr}`;
  };

  const handleProtocolSave = async () => {
    if (!onSaveProtocol || mode !== 'addProtocol') return;
    setHasInteracted(true);
    const preparationState = getPreparationState(preparation.peptideAmount, preparation.totalVolume);
    if (preparationState === 'invalid') return;

    // T2: a second click landing before the disabled attribute commits
    // cannot start a duplicate save.
    if (savingInFlightRef.current) return;

    // Validation: custom schedule requires selected days
    if (scheduleType === 'custom' && selectedDays.length === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    if (selectedTimes.length === 0) {
      alert('Please add at least one dose time');
      return;
    }

    // Validate custom peptide name
    if (isCustomPeptide && !customPeptideName.trim()) {
      alert('Please enter a name for your custom peptide');
      return;
    }

    try {
      savingInFlightRef.current = true;
      setIsSaving(true);
      const formattedDosage = `${inputs.desiredDose}${inputs.doseUnit}`;

      // Use custom name if custom peptide selected, otherwise use library peptide name
      const finalPeptideName = isCustomPeptide ? customPeptideName.trim() : peptideName;

      // Set days based on schedule type
      let daysToSave: string[];
      if (scheduleType === 'daily') {
        daysToSave = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      } else if (scheduleType === 'monFri') {
        daysToSave = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      } else if (scheduleType === 'everyOtherDay') {
        daysToSave = []; // Empty for every other day (backend uses startDate instead)
      } else {
        daysToSave = selectedDays;
      }

      await onSaveProtocol({
        peptideId: isCustomPeptide ? undefined : selectedPeptideId,
        peptideName: finalPeptideName,
        dosage: formattedDosage,
        schedule: {
          days: daysToSave,
          times: selectedTimes,
          frequency: formatScheduleString(scheduleType, daysToSave, selectedTimes)
        },
        duration,
        vialAmount: preparationState === 'complete' ? `${preparation.peptideAmount.trim()}mg` : "",
        reconstitution: preparationState === 'complete' ? `${preparation.totalVolume.trim()}ml` : "",
        notes,
        administrationType,
        notifications: {
          pushEnabled,
          emailEnabled,
          reminderMinutes
        }
      });

      if (onClose) onClose();
    } catch (error) {
      console.error('Error saving protocol:', error);
      alert('Failed to save protocol. Please try again.');
    } finally {
      savingInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const loadPeptideFromLibrary = useCallback((peptideName: string) => {
    if (!peptideLibrary) return;
    const peptide = peptideLibrary.find((item) => item.name === peptideName || item.id === peptideName);
    if (!peptide) return;

    // Check if "Other (Custom)" is selected
    if (peptide.id === 'custom' || peptide.name === 'Other (Custom)') {
      setIsCustomPeptide(true);
      setPeptideName('Other (Custom)');
      setSelectedPeptideId('custom');
      setCustomPeptideName(''); // Reset custom name
    } else {
      setIsCustomPeptide(false);
      setPeptideName(peptide.name);
      if (peptide.id) setSelectedPeptideId(peptide.id);
      setCustomPeptideName('');
    }

    // New peptide selected: citation-grounded dose/route from the previous
    // selection no longer applies. Clear dose + admin-type back to the
    // no-hardcoded-default state; the eduCard fetch + route-map effects
    // below will re-populate from this peptide's own cited sources.
    setSelectedSlug(peptide.slug ?? null);
    adminTypeTouchedRef.current = false;
    setAdminTypeAutoNote(null);
    setAdministrationType('injection');

    setInputs((prev) => {
      return {
        ...prev,
        totalVolume: 0,
        peptideAmount: 0,
        desiredDose: 0,
      };
    });
    setPreparation({ totalVolume: "", peptideAmount: "" });
  }, [peptideLibrary]);

  // H4: no auto-select-first-item. The picker used to default to
  // peptideLibrary[0], which could silently land on a diluent (e.g.
  // "Bacteriostatic Water 10mL") if the storefront happened to list it
  // first, then compute prep math for the diluent instead of a real
  // peptide. The selector now starts empty ("Select a peptide" placeholder)
  // until the member makes an explicit choice.

  // Deep-link preselect: ?peptide=<slug> from /education/peptides/[slug]'s
  // "Start Protocol" link. Runs once per modal mount — this is an explicit
  // navigation intent, not an indiscriminate first-item default.
  useEffect(() => {
    if (!initialPeptideSlug || appliedInitialSlugRef.current || !peptideLibrary) return;
    const match = peptideLibrary.find((item) => item.slug === initialPeptideSlug);
    if (match) {
      appliedInitialSlugRef.current = true;
      loadPeptideFromLibrary(match.id || match.name);
    }
  }, [initialPeptideSlug, peptideLibrary, loadPeptideFromLibrary]);

  // Fetch the full cited card (structured_regimens) for a library-sourced
  // peptide selection. Storefront/custom selections have no slug -> no fetch.
  useEffect(() => {
    if (!selectedSlug) {
      setEduCard(null);
      return;
    }
    let cancelled = false;
    setEduLoading(true);
    fetch(`/api/peptides/education-library/${selectedSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setEduCard(data?.card ?? null);
      })
      .catch(() => {
        if (!cancelled) setEduCard(null);
      })
      .finally(() => {
        if (!cancelled) setEduLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  // Auto-map administrationType from an unambiguous cited route — only if
  // the user hasn't already picked one manually for this peptide selection.
  useEffect(() => {
    if (!eduCard || adminTypeTouchedRef.current) return;
    const mapped = mapRouteToAdministrationType(eduCard.structured_regimens);
    if (mapped) {
      setAdministrationType(mapped);
      setAdminTypeAutoNote(mapped);
    }
  }, [eduCard]);

  const handleSelectRegimenDose = useCallback((value: number, unit: "mg" | "mcg" | null) => {
    setInputs((prev) => ({ ...prev, desiredDose: value, doseUnit: unit ?? prev.doseUnit }));
  }, []);

  const preparationState = getPreparationState(preparation.peptideAmount, preparation.totalVolume);
  const hasCompletePreparation = mode !== 'addProtocol' || preparationState === 'complete';

  // Keep display peptideConcentration synced (from vial + volume)
  const displayConcentration = useMemo(() => {
    const conc = inputs.totalVolume > 0 ? (inputs.peptideAmount * 1000) / inputs.totalVolume : 0;
    return formatNumber(conc, 2);
  }, [inputs.peptideAmount, inputs.totalVolume]);

  const groupedPeptideLibrary = useMemo(() => {
    const list = peptideLibrary ?? [];
    return {
      storefront: list.filter((p) => (p.source ?? 'storefront') === 'storefront' && p.id !== 'custom'),
      library: list.filter((p) => p.source === 'library'),
      custom: list.filter((p) => p.source === 'custom' || p.id === 'custom'),
    };
  }, [peptideLibrary]);

  return (
    <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20">
      {/* Alerts */}
      {hasInteracted && errors.length > 0 && (
        <div className="mb-4 bg-red-900/20 border border-red-500/30 text-red-200 rounded-2xl p-4 flex items-start gap-2" role="alert">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Please correct the following:</p>
            <ul className="list-disc list-inside text-sm">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(360px,1.15fr)_minmax(240px,0.85fr)_minmax(320px,1fr)] gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          {/* Peptide selection */}
          {mode === 'addProtocol' && (
            peptideLibrary && peptideLibrary.length > 0 ? (
              <div className="bg-primary-500/10 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 space-y-3">
                <label className="block text-sm text-white/80 font-semibold">Select Peptide</label>
                <select
                  aria-label="Select peptide"
                  value={selectedPeptideId || peptideName}
                  onChange={(event) => {
                    setHasInteracted(true);
                    loadPeptideFromLibrary(event.target.value);
                  }}
                  className="w-full bg-black/20 border border-white/15 rounded-lg px-3 py-2.5 text-white focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                >
                  {/* H4: no item is auto-selected, so show an explicit
                      placeholder until the member picks a real peptide. */}
                  {!(selectedPeptideId || peptideName) && (
                    <option value="" disabled>Select a peptide</option>
                  )}
                  {(() => {
                    const renderOption = (peptide: NonNullable<typeof peptideLibrary>[number]) => {
                      const optionValue = peptide.id || peptide.name;
                      const displayName = peptide.name
                        .replace(/\s*-\s*peptide\s*$/i, '')
                        .replace(/\s+Package\s*$/i, '')
                        .trim();
                      return (
                        <option key={optionValue} value={optionValue} className="bg-gray-800 text-white">
                          {displayName}
                        </option>
                      );
                    };
                    const { storefront, library, custom } = groupedPeptideLibrary;
                    // Legacy callers that only ever pass storefront items still render flat.
                    if (library.length === 0) {
                      return peptideLibrary.map(renderOption);
                    }
                    return (
                      <>
                        {storefront.length > 0 && (
                          <optgroup label="Storefront Products">{storefront.map(renderOption)}</optgroup>
                        )}
                        <optgroup label={`Peptide Library (${library.length})`}>{library.map(renderOption)}</optgroup>
                        {custom.length > 0 && (
                          <optgroup label="Custom">{custom.map(renderOption)}</optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>

                {/* Custom Peptide Name Input */}
                {isCustomPeptide && (
                  <div className="space-y-2 animate-fade-in">
                    <label className="block text-sm text-white/80 font-medium">Custom Peptide/Supplement Name</label>
                    <input
                      type="text"
                      value={customPeptideName}
                      onChange={(e) => setCustomPeptideName(e.target.value)}
                      placeholder="e.g., Vitamin D3, Magnesium, NAD+, Custom Blend"
                      className="w-full bg-black/20 border border-white/15 rounded-lg px-3 py-2.5 text-white placeholder-white/40 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                    />
                    <p className="text-xs text-white/50">
                      Enter any vitamin, mineral, or custom compound you want to track
                    </p>
                  </div>
                )}

                <p className="text-xs text-white/50">
                  {groupedPeptideLibrary.storefront.length} store product{groupedPeptideLibrary.storefront.length === 1 ? '' : 's'}
                  {groupedPeptideLibrary.library.length > 0 ? ` + ${groupedPeptideLibrary.library.length} peptide library cards` : ''} + Custom option available
                </p>

                {selectedSlug && (
                  <RegimenSourcePicker card={eduCard} loading={eduLoading} onSelectDose={handleSelectRegimenDose} />
                )}
              </div>
            ) : (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-sm text-red-200">
                Peptide library unavailable. Please close and try again.
              </div>
            )
          )}

          {/* Administration type */}
          {mode === 'addProtocol' && (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-2">
              <label className="block text-sm text-white/70 font-medium">Administration Type</label>
              <select
                aria-label="Administration type"
                value={administrationType}
                onChange={(e) => {
                  adminTypeTouchedRef.current = true;
                  setAdminTypeAutoNote(null);
                  setAdministrationType(e.target.value as AdministrationType);
                }}
                className="w-full bg-black/20 border border-white/15 rounded-lg px-3 py-2.5 text-white focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
              >
                <option value="injection" className="bg-gray-800 text-white">Injection</option>
                <option value="oral" className="bg-gray-800 text-white">Oral</option>
                <option value="nasal" className="bg-gray-800 text-white">Nasal</option>
                <option value="topical" className="bg-gray-800 text-white">Topical</option>
              </select>
              {adminTypeAutoNote && (
                <p className="text-xs text-white/50">Auto-detected from a cited route — change it if that's wrong.</p>
              )}
            </div>
          )}

          {/* Volume & Vial size */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-white/70 font-medium">Total volume (ml)</span>
                <select
                  aria-label="Total volume"
                  onChange={(e) => {
                    setHasInteracted(true);
                    const value = e.target.value;
                    const parsed = Number(value);
                    setPreparation((current) => ({ ...current, totalVolume: value }));
                    setInputs((s) => ({ ...s, totalVolume: Number.isFinite(parsed) ? parsed : 0 }));
                  }}
                  value={mode === 'addProtocol' ? preparation.totalVolume : String(inputs.totalVolume)}
                  className="bg-black/20 border border-white/15 rounded-lg px-3 py-2.5 text-white focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all w-full"
                >
                  {mode === 'addProtocol' && <option value="" className="bg-gray-800 text-white">Choose total volume</option>}
                  {[1, 0.5, 1.5, 2, 2.5, 3].map((v) => (
                    <option key={v} value={v} className="bg-gray-800 text-white">{v} ml</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-white/70 font-medium">Peptide in vial (mg)</span>
                <input
                  type="number"
                  aria-label="Peptide amount in vial"
                  value={mode === 'addProtocol' ? preparation.peptideAmount : inputs.peptideAmount}
                  onChange={(e) => {
                    setHasInteracted(true);
                    const value = e.target.value;
                    const parsed = Number(value);
                    setPreparation((current) => ({ ...current, peptideAmount: value }));
                    setInputs((s) => ({ ...s, peptideAmount: Number.isFinite(parsed) ? parsed : 0 }));
                  }}
                  placeholder="e.g., 10, 50, 100"
                  min="0"
                  step="any"
                  className="bg-black/20 border border-white/15 rounded-lg px-3 py-2.5 text-white placeholder-white/40 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                />
              </label>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                id="insulin-toggle"
                type="checkbox"
                checked={!!inputs.insulinSyringeUnits}
                onChange={(e) => setInputs((s) => ({ ...s, insulinSyringeUnits: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-400/30"
              />
              <label htmlFor="insulin-toggle" className="text-sm text-white/70">Show insulin syringe units (100u = 1 ml)</label>
            </div>
            {hasCompletePreparation && (
              <div className="text-xs text-white/60">Actual concentration: <span className="text-white font-medium">{displayConcentration} mcg/ml</span></div>
            )}
          </div>

          {/* Dose + Unit */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-3">
            <label>
              <span className="block mb-1 text-sm text-white/70 font-medium">Desired dose</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  aria-label="Desired dose value"
                  inputMode="decimal"
                  placeholder={mode === 'addProtocol' ? 'enter dose' : undefined}
                  value={inputs.desiredDose === 0 ? "" : inputs.desiredDose}
                  onChange={(e) => {
                    setHasInteracted(true);
                    setInputs((s) => ({ ...s, desiredDose: parseFloat(e.target.value) || 0 }));
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "") return; // empty stays empty — no forced default
                    setHasInteracted(true);
                    setInputs((s) => ({ ...s, desiredDose: clamp(parseFloat(e.target.value) || 0, unitMinMax.min, unitMinMax.max) }));
                  }}
                  className="flex-1 min-w-0 bg-black/20 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                />
                <select
                  aria-label="Dose unit"
                  value={inputs.doseUnit}
                  onChange={(e) => {
                    setHasInteracted(true);
                    const nextUnit = e.target.value as "mg" | "mcg";
                    setInputs((s) => {
                      if (nextUnit === s.doseUnit) return s;
                      // H5: switching units must convert the real value
                      // (mg<->mcg is always x1000), never silently
                      // reinterpret the same number under a new unit — that
                      // would change the actual dose 1000x with no
                      // confirmation. The displayed number updates to the
                      // correctly-converted figure so the conversion is
                      // visible, not hidden. IU is never touched here.
                      const converted =
                        s.desiredDose === 0
                          ? 0
                          : nextUnit === "mg"
                            ? s.desiredDose / 1000
                            : s.desiredDose * 1000;
                      return { ...s, doseUnit: nextUnit, desiredDose: converted };
                    });
                  }}
                  className="w-24 shrink-0 bg-black/20 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                >
                  <option value="mcg" className="bg-gray-800 text-white">mcg</option>
                  <option value="mg" className="bg-gray-800 text-white">mg</option>
                </select>
              </div>
            </label>
            <input
              aria-label="Dose range"
              type="range"
              min={unitMinMax.min}
              max={unitMinMax.max}
              step={unitMinMax.step}
              value={inputs.desiredDose}
              onChange={(e) => {
                setHasInteracted(true);
                setInputs((s) => ({ ...s, desiredDose: parseFloat(e.target.value) }));
              }}
              className="w-full accent-primary-400"
            />
            <div className="flex justify-between text-xs text-white/50">
              <span>{unitMinMax.min} {inputs.doseUnit}</span>
              <span>{unitMinMax.max} {inputs.doseUnit}</span>
            </div>
          </div>

          {/* Scheduling Section - Only in addProtocol mode */}
          {mode === 'addProtocol' && (
            <>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-4">
                {/* Frequency Selector */}
                <div>
                  <label className="block text-sm text-white/70 font-medium mb-2">Dosing Frequency</label>
                  <select
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="w-full bg-black/20 text-white border border-white/15 rounded-lg px-4 py-2 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                  >
                    <option value="daily" className="bg-gray-800 text-white">Daily (Every Day)</option>
                    <option value="everyOtherDay" className="bg-gray-800 text-white">Every Other Day</option>
                    <option value="monFri" className="bg-gray-800 text-white">Mon-Fri (5 days/week)</option>
                    <option value="custom" className="bg-gray-800 text-white">Custom Days</option>
                  </select>
                  {scheduleType === 'everyOtherDay' && (
                    <p className="text-xs text-amber-300 mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1.5">
                      <span className="font-semibold">Note:</span> Every other day alternates from your start date, so the day of week will shift. First dose starts today.
                    </p>
                  )}
                </div>

                {/* Day Picker - Only show for custom schedule */}
                {scheduleType === 'custom' && (
                  <div>
                    <label className="block text-sm text-white/70 font-medium mb-2">Select Days</label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`flex-shrink-0 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${
                            selectedDays.includes(day)
                              ? 'bg-primary-500 text-white border-primary-400/60'
                              : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10'
                          }`}
                          aria-pressed={selectedDays.includes(day)}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dose Times */}
                <div>
                  <label className="block text-sm text-white/70 font-medium mb-2">Dose Times</label>

                  {/* Display selected times */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedTimes.map((time) => (
                      <div
                        key={time}
                        className="flex items-center gap-2 bg-primary-500/20 text-primary-100 border border-primary-400/40 px-3 py-1.5 text-sm font-medium rounded-md"
                      >
                        <span>{time}</span>
                        <button
                          type="button"
                          onClick={() => removeTime(time)}
                          className="text-primary-200 hover:text-white transition-colors"
                          aria-label={`Remove ${time}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedTimes.length === 0 && (
                      <p className="text-xs text-white/50">No dose times selected</p>
                    )}
                  </div>

                  {/* Add new time */}
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={newTimeInput}
                      onChange={(e) => setNewTimeInput(e.target.value)}
                      className="flex-1 bg-black/20 text-white border border-white/15 rounded-lg px-4 py-2 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={addTime}
                      className="bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 border border-primary-400/40 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                      + Add Time
                    </button>
                  </div>

                  <p className="text-xs text-white/50 mt-2">
                    Add specific times for your doses (e.g., 8:00 AM, 8:00 PM)
                  </p>
                </div>

                {/* Schedule Summary */}
                <div className="bg-black/20 rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-xs text-white/60 leading-snug">
                    <span className="font-medium text-white/80">Schedule:</span>{' '}
                    {formatScheduleString(
                      scheduleType,
                      scheduleType === 'custom' ? selectedDays : [],
                      selectedTimes
                    )}
                  </p>
                </div>
              </div>

            </>
          )}
        </div>

        {/* Visual Display */}
        <div className="flex flex-col items-center justify-start h-full gap-6">
          {hasCompletePreparation ? (
            <SyringeModel
              trueUnits={results.insulinUnits}
              volumeInMl={results.volumeToDraw}
              vialCapacityUnits={inputs.totalVolume > 0 ? inputs.totalVolume * 100 : undefined}
            />
          ) : (
            <div className="w-full bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-sm text-white/60">
              Enter your vial amount and total volume only if you want a syringe conversion.
            </div>
          )}

          {mode === 'addProtocol' && (
            <div className="w-full bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex flex-col gap-3">
                <label className="text-sm text-white/70 font-medium" htmlFor="protocol-duration">
                  Protocol Duration
                </label>
                <input
                  id="protocol-duration"
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g., 8 weeks, 12 weeks, 6 months"
                  className="bg-black/20 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all text-sm"
                />
                <p className="text-xs text-white/50 leading-snug">
                  Example: "8 weeks on, 8 weeks off" or "12 weeks continuous"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Results & Instructions */}
        <div className="space-y-4">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10" role="status" aria-live="polite">
            <h3 className="text-lg font-semibold text-white mb-1">Results</h3>
            {hasCompletePreparation ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm leading-snug">
              <div className="text-white/60">Peptide</div>
              <div className="text-white font-medium">
                {isCustomPeptide ? (customPeptideName || 'Custom (not named)') : (peptideName || '—')}
              </div>
              <div className="text-white/60">Volume to draw</div>
              <div className="text-white font-medium">{formatNumber(results.volumeToDraw, results.volumeToDraw < 1 ? 3 : 2)} ml</div>
              {typeof results.insulinUnits === "number" && (
                <>
                  <div className="text-white/60">Insulin units</div>
                  <div className="text-white font-medium">{results.insulinUnits} u</div>
                </>
              )}
              <div className="text-white/60">Doses per vial</div>
              <div className="text-white font-medium">{results.dosesPerVial}</div>
            </div>
            ) : (
              <p className="text-sm text-white/60">No preparation entered. You can save this protocol without a syringe conversion.</p>
            )}
          </div>

          {hasCompletePreparation && <ReconstitutionGuide
            peptideAmount={inputs.peptideAmount}
            volume={inputs.totalVolume}
          />}

          {/* Notes */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <label className="block mb-2 text-sm text-white/70">Notes (optional)</label>
            <textarea
              aria-label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-black/20 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
              placeholder="Timing, site, symptoms, etc."
            />
          </div>

          {/* Notification Preferences - Only show in addProtocol mode */}
          {mode === 'addProtocol' && (
            <div className="bg-primary-500/10 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h3 className="text-lg font-semibold text-primary-200">Dose Reminders</h3>
              </div>

              <div className="space-y-4">
                {/* Push Notifications */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => setPushEnabled(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium group-hover:text-primary-300 transition-colors">
                      Push notifications
                    </div>
                    <div className="text-xs text-white/50">
                      Get reminders even when the app is closed
                    </div>
                  </div>
                </label>

                {/* Email Reminders */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium group-hover:text-blue-300 transition-colors">
                      Email reminders
                    </div>
                    <div className="text-xs text-white/50">
                      Backup reminders to your login email
                    </div>
                  </div>
                </label>

                {/* Reminder Timing */}
                <div>
                  <label className="block text-sm text-white/70 mb-2">
                    Remind me before dose:
                  </label>
                  <select
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(Number(e.target.value))}
                    className="w-full bg-black/20 border border-white/15 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 transition-all"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>

                {pushEnabled && (
                  <div className="text-xs text-primary-300/80 bg-primary-500/10 rounded-lg p-3 border border-primary-500/20">
                    <span className="font-medium">Note:</span> You'll be asked to allow notifications when you save this protocol.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div>
            {mode === 'addProtocol' ? (
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProtocolSave}
                  disabled={!peptideName || isSaving || errors.length > 0 || selectedDays.length === 0 || selectedTimes.length === 0}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 disabled:bg-white/10 disabled:text-white/40 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                >
                  {isSaving ? "Adding Protocol..." : "Add Protocol"}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!onSaveToLog || isSaving || errors.length > 0}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {isSaving ? "Saving…" : "Save to Log"}
                </button>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  className="bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Save Preset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="mt-6 text-xs text-white/40">
        This calculator is provided for informational purposes and should be used under clinician guidance. Always verify calculations.
      </div>
    </div>
  );
};

export default DosageCalculator;

