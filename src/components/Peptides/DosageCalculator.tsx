"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Save, AlertCircle } from "lucide-react";

/*********************************
 * Types
 *********************************/
export interface CalculatorInputs {
  desiredDose: number; // in mg or mcg
  doseUnit: "mg" | "mcg";
  peptideConcentration: number; // mcg/ml (optional display; calculated from vial + volume)
  totalVolume: number; // ml of BAC water added
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
  peptideLibrary?: Array<{           // New: from MongoDB
    id?: string;
    name: string;
    dosage?: string;
    category?: string;
    reconstitution?: string;
    vialAmount?: string;
  }>;
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
 * Presets
 *********************************/
const PEPTIDE_PRESETS = [
  {
    name: "BPC-157",
    commonDoses: [250, 500, 750], // mcg
    typicalVialSize: 5, // mg
    recommendedVolume: 2, // ml
    instructions: "Subcutaneous injection, can be site-specific",
  },
  {
    name: "Ipamorelin",
    commonDoses: [200, 300, 400], // mcg
    typicalVialSize: 10, // mg
    recommendedVolume: 2, // ml
    instructions: "Best taken before bed or post-workout",
  },
  {
    name: "Semaglutide",
    commonDoses: [0.25, 0.5, 1.0, 2.0], // mg
    typicalVialSize: 10, // mg
    recommendedVolume: 2, // ml
    instructions: "Weekly injection, gradually increase dose",
  },
] as const;

/*********************************
 * Core calculation engine
 *********************************/
const calculateDosage = (inputs: CalculatorInputs): CalculatorOutputs => {
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

/*********************************
 * Visual Syringe Component
 *********************************/
const TOTAL_INSULIN_UNITS = 50; // standard 0.5 ml insulin syringe scale
const UNITS_PER_LABEL = 5;

const SyringeVisual: React.FC<{
  volumeInMl: number;
  insulinUnits?: number;
}> = ({ volumeInMl, insulinUnits }) => {
  const barrelTop = 32;
  const barrelHeight = 210;
  const barrelBottom = barrelTop + barrelHeight;
  const units = clamp(volumeInMl * 100, 0, TOTAL_INSULIN_UNITS);
  const fillHeight = barrelHeight * (units / TOTAL_INSULIN_UNITS);
  const stopperY = barrelBottom - fillHeight;
  const needleWidth = 2;
  const needleHeight = 44;
  const needleX = 58;
  const needleY = barrelBottom - 4;
  const needleRadius = needleWidth / 2;
  const capWidth = 16;
  const capHeight = 40;
  const capX = needleX + needleWidth / 2 - capWidth / 2;
  const capY = barrelBottom;
  const capRadius = 6;

  return (
    <div className="relative bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl p-5 border border-primary-400/30 shadow-2xl w-full max-w-[260px] lg:max-w-[240px] mx-auto">
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 140 310" className="w-40 drop-shadow-xl" aria-label="Insulin syringe fill visualization">
          {/* Barrel */}
          <path
            d={`M48 ${barrelTop - 8}h26c3.3 0 6 2.7 6 6v6h-38v-6c0-3.3 2.7-6 6-6z`}
            fill="rgba(255,255,255,0.18)"
          />
          <rect x="40" y={barrelTop} width="40" height={barrelHeight} rx="6" ry="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.24)" strokeWidth="1.8" />

          {/* Tick marks */}
          {Array.from({ length: TOTAL_INSULIN_UNITS / UNITS_PER_LABEL + 1 }).map((_, index) => {
            const y = barrelTop + (barrelHeight / (TOTAL_INSULIN_UNITS / UNITS_PER_LABEL)) * index;
            const labelValue = TOTAL_INSULIN_UNITS - index * UNITS_PER_LABEL;
            return (
              <g key={index}>
                <line x1="40" x2="78" y1={y} y2={y} stroke="rgba(255,255,255,0.22)" strokeWidth={index % 2 === 0 ? 1.6 : 1} />
                <text
                  x="36"
                  y={y + 4}
                  textAnchor="end"
                  fontSize="7"
                  fontWeight={index % 2 === 0 ? 'bold' : 'normal'}
                  fill="rgba(255,255,255,0.6)"
                >
                  {labelValue}
                </text>
              </g>
            );
          })}

          {/* Fill */}
          <clipPath id="insulin-barrel">
            <rect x="40" y={barrelTop} width="40" height={barrelHeight} rx="6" ry="6" />
          </clipPath>
          <g clipPath="url(#insulin-barrel)">
            <rect
              x="40"
              y={stopperY}
              width="40"
              height={barrelBottom - stopperY}
              fill="url(#insulin-fill)"
              className="transition-all duration-500 ease-out"
            />
          </g>

          {/* Stopper */}
          <rect x="38" y={Math.min(Math.max(stopperY - 6, barrelTop), barrelBottom - 10)} width="44" height="10" rx="3" fill="rgba(0,0,0,0.55)" />

          <defs>
            <linearGradient id="insulin-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6FE7DC" />
              <stop offset="100%" stopColor="#3FBFB5" />
            </linearGradient>
          </defs>

          {/* Needle and cap */}
          <rect x="58" y="14" width="8" height="18" rx="3" ry="3" fill="rgba(255,255,255,0.2)" />
          <rect x={needleX} y={needleY} width={needleWidth} height={needleHeight} rx={needleRadius} ry={needleRadius} fill="rgba(255,255,255,0.7)" />
          <rect
            x={capX}
            y={capY}
            width={capWidth}
            height={capHeight}
            rx={capRadius}
            ry={capRadius}
            fill="rgba(255,120,60,0.55)"
          />

          <text x="86" y={barrelTop - 12} fontSize="8" fill="rgba(255,255,255,0.7)" letterSpacing="1.4">
            UNITS
          </text>
        </svg>

        <div className="text-center mt-4">
          <p className="text-4xl font-extrabold text-primary-300 tracking-tight" aria-live="polite">
            {formatNumber(units, 1)} u
          </p>
          <p className="mt-1 text-sm text-gray-300" aria-live="polite">
            {formatNumber(volumeInMl, volumeInMl < 1 ? 3 : 2)} ml drawn
          </p>
        </div>

        <div className="w-full mt-4" aria-hidden>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-2 bg-primary-600 transition-all duration-500"
              style={{ width: `${(units / TOTAL_INSULIN_UNITS) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/*********************************
 * Reconstitution Guide Component
 *********************************/
const ReconstitutionGuide: React.FC<{ peptideAmount: number; volume: number; instructions?: string }>
  = ({ peptideAmount, volume, instructions }) => {
    return (
      <div className="space-y-3 bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30">
        <h3 className="text-lg font-bold text-white mb-1">Mixing Instructions</h3>
        <ol className="space-y-1.5 text-gray-300 list-decimal list-inside text-sm leading-snug">
          <li>Add {formatNumber(volume, 2)} ml of bacteriostatic water to {formatNumber(peptideAmount, 2)} mg vial</li>
          <li>Inject water slowly down the side of vial</li>
          <li>Gently swirl (do not shake) until dissolved</li>
          <li>Store in refrigerator after reconstitution</li>
        </ol>
        {instructions && (
          <div className="text-sm text-gray-300 leading-snug">
            <span className="font-semibold text-primary-400">Note: </span>{instructions}
          </div>
        )}
        <div className="bg-amber-600/20 border border-amber-400/30 rounded-lg p-2.5">
          <p className="text-sm text-amber-300 leading-snug">⚠️ Use within 30 days after reconstitution</p>
        </div>
      </div>
    );
  };




/*********************************
 * Main Dosage Calculator Component
 *********************************/
export const DosageCalculator: React.FC<DosageCalculatorProps> = ({
  mode = 'calculate',
  peptideLibrary,
  onSaveProtocol,
  onClose,
  importedPeptide,
  onSaveToLog,
  userPresets = [],
  onSavePreset,
}) => {
  const defaultInputs: CalculatorInputs = {
    desiredDose: 250, // default in mcg for peptides like BPC-157
    doseUnit: "mcg",
    peptideConcentration: 0, // will be derived and displayed
    totalVolume: 1,
    peptideAmount: 10,
    insulinSyringeUnits: true,
  };

  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);
  const [peptideName, setPeptideName] = useState<string>("BPC-157");
  const [selectedPeptideId, setSelectedPeptideId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isCustomPeptide, setIsCustomPeptide] = useState<boolean>(false);
  const [customPeptideName, setCustomPeptideName] = useState<string>("");

  // New state for scheduling (addProtocol mode)
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['AM']);
  const [duration, setDuration] = useState<string>('8 weeks');

  // Apply imported peptide defaults
  useEffect(() => {
    if (!importedPeptide) return;
    setPeptideName(importedPeptide.name);
    setInputs((prev) => ({
      ...prev,
      peptideAmount: importedPeptide.vialSize || prev.peptideAmount,
      desiredDose: importedPeptide.recommendedDose ?? prev.desiredDose,
    }));
  }, [importedPeptide]);

  // Live results
  const results = useMemo(() => calculateDosage(inputs), [inputs]);

  // Validation
  useEffect(() => {
    const e: string[] = [];
    if (inputs.totalVolume <= 0) e.push("Total volume must be greater than 0 ml.");
    if (inputs.peptideAmount <= 0) e.push("Peptide amount in vial must be greater than 0 mg.");
    if (inputs.desiredDose <= 0) e.push("Desired dose must be greater than 0.");
    setErrors(e);
  }, [inputs]);

  // Derived values for visuals

  const unitMinMax = inputs.doseUnit === "mg"
    ? { min: 0.1, max: 15, step: 0.05 }
    : { min: 50, max: 5000, step: 10 };

  const handleSave = async () => {
    if (!onSaveToLog) return;
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

  const toggleTime = (time: string) => {
    setSelectedTimes(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const formatScheduleString = (days: string[], times: string[]): string => {
    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayStr = days.length === 7
      ? 'Daily'
      : days.length === 5 && !days.includes('Sat') && !days.includes('Sun')
      ? 'Mon-Fri'
      : days.join('/');
    const timeStr = times.join('/');
    return `${dayStr} ${timeStr}`;
  };

  const handleProtocolSave = async () => {
    if (!onSaveProtocol || mode !== 'addProtocol') return;

    if (selectedDays.length === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    if (selectedTimes.length === 0) {
      alert('Please select AM, PM, or both');
      return;
    }

    // Validate custom peptide name
    if (isCustomPeptide && !customPeptideName.trim()) {
      alert('Please enter a name for your custom peptide');
      return;
    }

    try {
      setIsSaving(true);
      const formattedDosage = `${inputs.desiredDose}${inputs.doseUnit}`;

      // Use custom name if custom peptide selected, otherwise use library peptide name
      const finalPeptideName = isCustomPeptide ? customPeptideName.trim() : peptideName;

      await onSaveProtocol({
        peptideId: isCustomPeptide ? undefined : selectedPeptideId,
        peptideName: finalPeptideName,
        dosage: formattedDosage,
        schedule: {
          days: selectedDays,
          times: selectedTimes,
          frequency: formatScheduleString(selectedDays, selectedTimes)
        },
        duration,
        vialAmount: `${inputs.peptideAmount}mg`,
        reconstitution: `${inputs.totalVolume}ml`,
        notes
      });

      if (onClose) onClose();
    } catch (error) {
      console.error('Error saving protocol:', error);
      alert('Failed to save protocol. Please try again.');
    } finally {
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

    setInputs((prev) => {
      let totalVolume = 1;

      let peptideAmount = prev.peptideAmount;
      if (peptide.vialAmount) {
        const amountMatch = peptide.vialAmount.match(/(\d+\.?\d*)/);
        if (amountMatch) {
          const parsed = Number.parseFloat(amountMatch[1]);
          if (Number.isFinite(parsed)) peptideAmount = parsed;
        }
      }

      return {
        ...prev,
        totalVolume,
        peptideAmount,
      };
    });
  }, [peptideLibrary]);

  useEffect(() => {
    if (mode !== 'addProtocol' || !peptideLibrary || peptideLibrary.length === 0) return;
    if (selectedPeptideId) return;
    loadPeptideFromLibrary(peptideLibrary[0].name);
  }, [mode, peptideLibrary, loadPeptideFromLibrary, selectedPeptideId]);

  // Keep display peptideConcentration synced (from vial + volume)
  const displayConcentration = useMemo(() => {
    const conc = inputs.totalVolume > 0 ? (inputs.peptideAmount * 1000) / inputs.totalVolume : 0;
    return formatNumber(conc, 2);
  }, [inputs.peptideAmount, inputs.totalVolume]);

  const presetInstructions = useMemo(() => {
    const match = PEPTIDE_PRESETS.find((preset) => preset.name.toLowerCase() === peptideName.toLowerCase());
    return match?.instructions ?? null;
  }, [peptideName]);

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-3xl p-6 pt-6 border border-primary-400/30 shadow-2xl">
      {/* Alerts */}
      {errors.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-400/30 text-red-200 rounded-lg p-3 flex items-start gap-2" role="alert">
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
              <div className="bg-gradient-to-br from-primary-600/20 to-primary-700/15 backdrop-blur-sm rounded-xl p-4 border border-primary-400/40 space-y-3">
                <label className="block text-sm text-amber-300 font-semibold">Select Peptide</label>
                <select
                  aria-label="Select peptide"
                  value={selectedPeptideId || peptideName}
                  onChange={(event) => loadPeptideFromLibrary(event.target.value)}
                  className="w-full bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2.5 text-amber-100 placeholder-amber-300/50 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                >
                  {peptideLibrary.map((peptide) => {
                    const optionValue = peptide.id || peptide.name;
                    const displayName = peptide.name
                      .replace(/\s*-\s*peptide\s*$/i, '')
                      .replace(/\s+Package\s*$/i, '')
                      .trim();
                    return (
                      <option key={optionValue} value={optionValue} className="bg-gray-800 text-amber-100">
                        {displayName}
                      </option>
                    );
                  })}
                </select>

                {/* Custom Peptide Name Input */}
                {isCustomPeptide && (
                  <div className="space-y-2 animate-fade-in">
                    <label className="block text-sm text-amber-300 font-medium">Custom Peptide/Supplement Name</label>
                    <input
                      type="text"
                      value={customPeptideName}
                      onChange={(e) => setCustomPeptideName(e.target.value)}
                      placeholder="e.g., Vitamin D3, Magnesium, NAD+, Custom Blend"
                      className="w-full bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2.5 text-amber-100 placeholder-amber-300/50 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                    />
                    <p className="text-xs text-amber-200/70">
                      Enter any vitamin, mineral, or custom compound you want to track
                    </p>
                  </div>
                )}

                <p className="text-xs text-amber-300/70">
                  {(peptideLibrary?.length ?? 0) - 1} products from store + Custom option available
                </p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-rose-900/20 to-rose-900/10 backdrop-blur-sm rounded-xl p-4 border border-rose-400/30 text-sm text-rose-200">
                Peptide library unavailable. Please close and try again.
              </div>
            )
          )}

          {/* Volume & Vial size */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-amber-300 font-medium">Total volume (ml)</span>
                <select
                  aria-label="Total volume"
                  onChange={(e) => setInputs((s) => ({ ...s, totalVolume: parseFloat(e.target.value) }))}
                  value={inputs.totalVolume}
                  className="bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2.5 text-amber-100 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all w-full"
                >
                  {[1, 0.5, 1.5, 2, 2.5, 3].map((v) => (
                    <option key={v} value={v} className="bg-gray-800 text-amber-100">{v} ml</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-amber-300 font-medium">Peptide in vial (mg)</span>
                <input
                  type="number"
                  aria-label="Peptide amount in vial"
                  value={inputs.peptideAmount}
                  onChange={(e) => setInputs((s) => ({ ...s, peptideAmount: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g., 10, 50, 100"
                  min="0"
                  step="1"
                  className="bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2.5 text-amber-100 placeholder-amber-300/50 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                />
              </label>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                id="insulin-toggle"
                type="checkbox"
                checked={!!inputs.insulinSyringeUnits}
                onChange={(e) => setInputs((s) => ({ ...s, insulinSyringeUnits: e.target.checked }))}
                className="h-4 w-4 rounded border-amber-400/40 bg-primary-600/25 text-amber-400 focus:ring-amber-400/30"
              />
              <label htmlFor="insulin-toggle" className="text-sm text-amber-300">Show insulin syringe units (100u = 1 ml)</label>
            </div>
            <div className="text-xs text-amber-300/70">Actual concentration: <span className="text-amber-100 font-medium">{displayConcentration} mcg/ml</span></div>
          </div>

          {/* Dose + Unit */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 space-y-3">
            <label>
              <span className="block mb-1 text-sm text-amber-300 font-medium">Desired dose</span>
              <div className="flex items-center gap-2 max-w-xs">
                <button
                  type="button"
                  className="bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2 text-amber-100 hover:border-amber-300 transition-colors"
                  onClick={() => setInputs((s) => ({ ...s, desiredDose: clamp(s.desiredDose - (inputs.doseUnit === "mg" ? 0.1 : 50), unitMinMax.min, unitMinMax.max) }))}
                  aria-label="Decrease dose"
                >
                  -
                </button>
                <input
                  type="number"
                  step="any"
                  aria-label="Desired dose value"
                  inputMode="decimal"
                  value={inputs.desiredDose}
                  onChange={(e) => setInputs((s) => ({ ...s, desiredDose: parseFloat(e.target.value) || 0 }))}
                  onBlur={(e) => setInputs((s) => ({ ...s, desiredDose: clamp(parseFloat(e.target.value) || 0, unitMinMax.min, unitMinMax.max) }))}
                  className="w-20 bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2 text-amber-100 placeholder-amber-300/50 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all text-center"
                />
                <button
                  type="button"
                  className="bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2 text-amber-100 hover:border-amber-300 transition-colors"
                  onClick={() => setInputs((s) => ({ ...s, desiredDose: clamp(s.desiredDose + (inputs.doseUnit === "mg" ? 0.1 : 50), unitMinMax.min, unitMinMax.max) }))}
                  aria-label="Increase dose"
                >
                  +
                </button>
                <select
                  aria-label="Dose unit"
                  value={inputs.doseUnit}
                  onChange={(e) => setInputs((s) => ({ ...s, doseUnit: e.target.value as "mg" | "mcg" }))}
                  className="bg-primary-600/25 border border-amber-400/40 rounded-lg px-3 py-2 text-amber-100 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                >
                  <option value="mcg" className="bg-gray-800 text-amber-100">mcg</option>
                  <option value="mg" className="bg-gray-800 text-amber-100">mg</option>
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
              onChange={(e) => setInputs((s) => ({ ...s, desiredDose: parseFloat(e.target.value) }))}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-amber-300/70">
              <span>{unitMinMax.min} {inputs.doseUnit}</span>
              <span>{unitMinMax.max} {inputs.doseUnit}</span>
            </div>
          </div>

          {/* Scheduling Section - Only in addProtocol mode */}
          {mode === 'addProtocol' && (
            <>
              <div className="bg-gradient-to-br from-primary-900/20 to-secondary-900/20 backdrop-blur-sm rounded-xl p-4 border border-primary-400/40">
                <div className="flex items-center gap-2 pb-2">
                  <span className="text-sm text-gray-300 font-medium">Schedule</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {['AM', 'PM'].map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => toggleTime(time)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                          selectedTimes.includes(time)
                            ? 'bg-amber-300/45 text-amber-50 border-amber-200/70 shadow-[0_0_14px_rgba(245,193,92,0.45)]'
                            : 'bg-amber-300/15 text-amber-200 border-amber-200/40 hover:bg-amber-300/25'
                        }`}
                        aria-pressed={selectedTimes.includes(time)}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${
                        selectedDays.includes(day)
                          ? 'bg-amber-300/50 text-amber-50 border-amber-200/70 shadow-[0_0_18px_rgba(245,193,92,0.5)]'
                          : 'bg-amber-300/15 text-amber-200 border-amber-200/40 hover:bg-amber-300/25'
                      }`}
                      aria-pressed={selectedDays.includes(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400 leading-snug">
                  {selectedDays.length === 7 ? 'Daily' : selectedDays.join(', ') || 'No days selected'}
                  {' - '}
                  {selectedTimes.length === 0
                    ? 'Select AM or PM'
                    : selectedTimes.length === 2
                    ? 'AM & PM'
                    : selectedTimes[0]}
                </p>
              </div>

            </>
          )}
        </div>

        {/* Visual Display */}
        <div className="flex flex-col items-center justify-start h-full gap-6">
          <SyringeVisual
            volumeInMl={results.volumeToDraw}
            insulinUnits={results.insulinUnits}
          />

          {mode === 'addProtocol' && (
            <div className="w-full bg-gradient-to-br from-primary-900/20 to-secondary-900/20 backdrop-blur-sm rounded-xl p-4 border border-primary-400/40">
              <div className="flex flex-col gap-3">
                <label className="text-sm text-gray-300 font-medium" htmlFor="protocol-duration">
                  Protocol Duration
                </label>
                <input
                  id="protocol-duration"
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g., 8 weeks, 12 weeks, 6 months"
                  className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none text-sm"
                />
                <p className="text-xs text-gray-400 leading-snug">
                  Example: "8 weeks on, 8 weeks off" or "12 weeks continuous"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Results & Instructions */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30" role="status" aria-live="polite">
            <h3 className="text-lg font-semibold text-white mb-1">Results</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm leading-snug">
              <div className="text-gray-400">Peptide</div>
              <div className="text-white font-medium">
                {isCustomPeptide ? (customPeptideName || 'Custom (not named)') : (peptideName || '—')}
              </div>
              <div className="text-gray-400">Volume to draw</div>
              <div className="text-white font-medium">{formatNumber(results.volumeToDraw, results.volumeToDraw < 1 ? 3 : 2)} ml</div>
              {typeof results.insulinUnits === "number" && (
                <>
                  <div className="text-gray-400">Insulin units</div>
                  <div className="text-white font-medium">{results.insulinUnits} u</div>
                </>
              )}
              <div className="text-gray-400">Doses per vial</div>
              <div className="text-white font-medium">{results.dosesPerVial}</div>
            </div>
          </div>

          <ReconstitutionGuide
            peptideAmount={inputs.peptideAmount}
            volume={inputs.totalVolume}
            instructions={presetInstructions ?? undefined}
          />

          {/* Notes */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30">
            <label className="block mb-2 text-sm text-gray-300">Notes (optional)</label>
            <textarea
              aria-label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
              placeholder="Timing, site, symptoms, etc."
            />
          </div>

          {/* Action Buttons */}
          <div>
            {mode === 'addProtocol' ? (
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-red-500/20 hover:bg-red-500/35 text-red-200 font-bold py-3 px-6 rounded-lg transition-colors border border-red-400/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProtocolSave}
                  disabled={!peptideName || isSaving || errors.length > 0 || selectedDays.length === 0 || selectedTimes.length === 0}
                  className="flex-1 bg-amber-300/30 hover:bg-amber-300/50 disabled:bg-gray-600 disabled:text-gray-300 disabled:opacity-60 text-amber-100 font-bold py-3 px-6 rounded-lg border border-amber-200/40 backdrop-blur-sm transition-all shadow-[0_0_20px_rgba(245,193,92,0.35)]"
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
                  className="bg-gray-800/50 border border-gray-600/30 text-white font-medium py-2 px-4 rounded-lg transition-colors hover:border-primary-400"
                >
                  Save Preset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="mt-6 text-xs text-gray-500">
        This calculator is provided for informational purposes and should be used under clinician guidance. Always verify calculations.
      </div>
    </div>
  );
};

export default DosageCalculator;

