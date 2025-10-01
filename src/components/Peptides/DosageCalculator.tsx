"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calculator as CalcIcon, Save, Import, AlertCircle } from "lucide-react";

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

type PresetName = typeof PEPTIDE_PRESETS[number]["name"];

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

  return {
    volumeToDraw: Math.round(volumeToDraw * 100) / 100,
    insulinUnits: insulinUnits ? Math.round(insulinUnits) : undefined,
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
const SyringeVisual: React.FC<{
  fillPercentage: number;
  volumeInMl: number;
  insulinUnits?: number;
}> = ({ fillPercentage, volumeInMl, insulinUnits }) => {
  const pct = clamp(fillPercentage, 0, 100);

  return (
    <div className="relative bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 w-full max-w-sm mx-auto">
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 100 300" className="w-40 drop-shadow-lg" aria-label="Syringe visual">
          {/* Barrel */}
          <rect x="30" y="30" width="40" height="220" rx="6" ry="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
          {/* Measurement ticks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const y = 50 + i * 18; // simple spacing
            return <line key={i} x1="30" x2="70" y1={y} y2={y} stroke="rgba(255,255,255,0.18)" strokeWidth={i % 2 === 0 ? 1.6 : 1} />;
          })}
          {/* Fill */}
          <clipPath id="barrel-clip">
            <rect x="30" y="30" width="40" height="220" rx="6" ry="6" />
          </clipPath>
          <g clipPath="url(#barrel-clip)">
            <rect
              x="30"
              y={30 + (220 * (100 - pct)) / 100}
              width="40"
              height={(220 * pct) / 100}
              fill="url(#grad)"
              className="transition-all duration-500 ease-out"
            />
          </g>
          {/* Gradient */}
          <defs>
            <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7fd7d1" />
              <stop offset="100%" stopColor="#3FBFB5" />
            </linearGradient>
          </defs>
          {/* Plunger */}
          <rect x="28" y="15" width="44" height="10" rx="4" fill="rgba(255,255,255,0.2)" />
          {/* Needle */}
          <rect x="49" y="250" width="2" height="30" fill="rgba(255,255,255,0.6)" />
        </svg>

        <div className="text-center mt-4">
          <p className="text-3xl font-bold text-primary-400" aria-live="polite">
            {formatNumber(volumeInMl, 2)} ml
          </p>
          {typeof insulinUnits === "number" && (
            <p className="text-sm text-gray-300" aria-live="polite">{insulinUnits} units</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full mt-4" aria-hidden>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-2 bg-primary-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
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
      <div className="space-y-4 bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30">
        <h3 className="text-lg font-bold text-white">Mixing Instructions</h3>
        <ol className="space-y-2 text-gray-300 list-decimal list-inside">
          <li>Add {formatNumber(volume, 2)} ml of bacteriostatic water to {formatNumber(peptideAmount, 2)} mg vial</li>
          <li>Inject water slowly down the side of vial</li>
          <li>Gently swirl (do not shake) until dissolved</li>
          <li>Store in refrigerator after reconstitution</li>
        </ol>
        {instructions && (
          <div className="text-sm text-gray-300">
            <span className="font-semibold text-primary-400">Note: </span>{instructions}
          </div>
        )}
        <div className="bg-amber-600/20 border border-amber-400/30 rounded-lg p-3">
          <p className="text-sm text-amber-300">⚠️ Use within 30 days after reconstitution</p>
        </div>
      </div>
    );
  };




/*********************************
 * Main Dosage Calculator Component
 *********************************/
export const DosageCalculator: React.FC<DosageCalculatorProps> = ({
  importedPeptide,
  onSaveToLog,
  userPresets = [],
  onSavePreset,
  onImportFromPeptide,
}) => {
  const defaultInputs: CalculatorInputs = {
    desiredDose: 250, // default in mcg for peptides like BPC-157
    doseUnit: "mcg",
    peptideConcentration: 0, // will be derived and displayed
    totalVolume: 2,
    peptideAmount: 5,
    insulinSyringeUnits: true,
  };

  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);
  const [selectedPreset, setSelectedPreset] = useState<PresetName | "">("");
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [peptideName, setPeptideName] = useState<string>("BPC-157");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);

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
  const fillPct = useMemo(() => {
    if (inputs.totalVolume <= 0) return 0;
    return clamp((results.volumeToDraw / inputs.totalVolume) * 100, 0, 100);
  }, [results.volumeToDraw, inputs.totalVolume]);

  // Preset change handler
  const applyPreset = (name: PresetName) => {
    const preset = PEPTIDE_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    setSelectedPreset(name);
    setPeptideName(name);
    // If dose unit differs (Semaglutide uses mg defaults), set appropriate unit
    const isSemaglutide = name === "Semaglutide";
    const newDose = preset.commonDoses[0];
    setInputs((prev) => ({
      ...prev,
      doseUnit: isSemaglutide ? "mg" : "mcg",
      desiredDose: newDose as number,
      totalVolume: preset.recommendedVolume,
      peptideAmount: preset.typicalVialSize,
    }));
  };

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

  const handleImport = () => {
    if (onImportFromPeptide && importedPeptide?.id) onImportFromPeptide(importedPeptide.id);
  };

  const handleSavePreset = () => {
    if (!onSavePreset) return;
    const name = prompt("Preset name");
    if (!name) return;
    onSavePreset({ name, settings: inputs });
  };

  // Keep display peptideConcentration synced (from vial + volume)
  const displayConcentration = useMemo(() => {
    const conc = inputs.totalVolume > 0 ? (inputs.peptideAmount * 1000) / inputs.totalVolume : 0;
    return formatNumber(conc, 2);
  }, [inputs.peptideAmount, inputs.totalVolume]);

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <CalcIcon className="w-6 h-6 text-primary-400 mr-2" />
          <h2 className="text-2xl font-bold text-white">Peptide Dosage Calculator</h2>
        </div>
        <div className="text-xs text-gray-400">Professional tool • Not medical advice</div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          {/* Preset selector */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30">
            <label className="block mb-2 text-sm text-gray-300">Preset</label>
            <div className="flex gap-2">
              <select
                aria-label="Peptide preset"
                value={selectedPreset}
                onChange={(e) => applyPreset(e.target.value as PresetName)}
                className="flex-1 bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
              >
                <option value="">Select a preset…</option>
                {PEPTIDE_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleImport}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-2"
                aria-label="Import from product page"
                title="Import from product page"
              >
                <Import className="w-4 h-4" /> Import
              </button>
            </div>
            {selectedPreset && (
              <p className="mt-2 text-xs text-gray-400">
                {PEPTIDE_PRESETS.find((p) => p.name === selectedPreset)?.instructions}
              </p>
            )}
          </div>

          {/* Peptide name (editable) */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30">
            <label className="block mb-2 text-sm text-gray-300">Peptide name</label>
            <input
              aria-label="Peptide name"
              value={peptideName}
              onChange={(e) => setPeptideName(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
            />
          </div>

          {/* Dose + Unit */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 space-y-3">
            <div className="flex items-end gap-3">
              <label className="flex-1">
                <span className="block mb-1 text-sm text-gray-300">Desired dose</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white hover:border-primary-400 transition-colors"
                    onClick={() => setInputs((s) => ({ ...s, desiredDose: clamp(s.desiredDose - (inputs.doseUnit === "mg" ? 0.1 : 50), unitMinMax.min, unitMinMax.max) }))}
                    aria-label="Decrease dose"
                  >
                    −
                  </button>
                  <input
                    aria-label="Desired dose value"
                    inputMode="decimal"
                    value={inputs.desiredDose}
                    onChange={(e) => setInputs((s) => ({ ...s, desiredDose: parseFloat(e.target.value) || 0 }))}
                    onBlur={(e) => setInputs((s) => ({ ...s, desiredDose: clamp(parseFloat(e.target.value) || 0, unitMinMax.min, unitMinMax.max) }))}
                    className="flex-1 bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white hover:border-primary-400 transition-colors"
                    onClick={() => setInputs((s) => ({ ...s, desiredDose: clamp(s.desiredDose + (inputs.doseUnit === "mg" ? 0.1 : 50), unitMinMax.min, unitMinMax.max) }))}
                    aria-label="Increase dose"
                  >
                    +
                  </button>
                  <select
                    aria-label="Dose unit"
                    value={inputs.doseUnit}
                    onChange={(e) => setInputs((s) => ({ ...s, doseUnit: e.target.value as "mg" | "mcg" }))}
                    className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                  >
                    <option value="mcg">mcg</option>
                    <option value="mg">mg</option>
                  </select>
                </div>
              </label>
            </div>
            <input
              aria-label="Dose range"
              type="range"
              min={unitMinMax.min}
              max={unitMinMax.max}
              step={unitMinMax.step}
              value={inputs.desiredDose}
              onChange={(e) => setInputs((s) => ({ ...s, desiredDose: parseFloat(e.target.value) }))}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{unitMinMax.min} {inputs.doseUnit}</span>
              <span>{unitMinMax.max} {inputs.doseUnit}</span>
            </div>
          </div>

          {/* Volume & Vial size */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-300">Total volume (ml)</span>
                <select
                  aria-label="Total volume"
                  onChange={(e) => setInputs((s) => ({ ...s, totalVolume: parseFloat(e.target.value) }))}
                  value={inputs.totalVolume}
                  className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none w-full"
                >
                  {[0.5, 1, 1.5, 2, 2.5, 3].map((v) => (
                    <option key={v} value={v}>{v} ml</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-300">Peptide in vial (mg)</span>
                <select
                  aria-label="Peptide amount in vial"
                  value={inputs.peptideAmount}
                  onChange={(e) => setInputs((s) => ({ ...s, peptideAmount: parseFloat(e.target.value) }))}
                  className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                >
                  {[2, 5, 10, 15, 20].map((mg) => (
                    <option key={mg} value={mg}>{mg} mg</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                id="insulin-toggle"
                type="checkbox"
                checked={!!inputs.insulinSyringeUnits}
                onChange={(e) => setInputs((s) => ({ ...s, insulinSyringeUnits: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-600/30 bg-gray-800/50 text-primary-600 focus:ring-primary-400"
              />
              <label htmlFor="insulin-toggle" className="text-sm text-gray-300">Show insulin syringe units (100u = 1 ml)</label>
            </div>
            <div className="text-xs text-gray-400">Actual concentration: <span className="text-white font-medium">{displayConcentration} mcg/ml</span></div>
          </div>

          {/* Notes */}
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30">
            <label className="block mb-2 text-sm text-gray-300">Notes (optional)</label>
            <textarea
              aria-label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-gray-800/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
              placeholder="Timing, site, symptoms, etc."
            />
          </div>
        </div>

        {/* Visual Display */}
        <div className="flex flex-col items-center justify-center">
          <SyringeVisual
            fillPercentage={fillPct}
            volumeInMl={results.volumeToDraw}
            insulinUnits={results.insulinUnits}
          />
        </div>

        {/* Results & Instructions */}
        <div className="space-y-4">
          <ReconstitutionGuide
            peptideAmount={inputs.peptideAmount}
            volume={inputs.totalVolume}
            instructions={PEPTIDE_PRESETS.find((p) => p.name === selectedPreset)?.instructions}
          />

          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30" role="status" aria-live="polite">
            <h3 className="text-lg font-semibold text-white mb-2">Results</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-400">Volume to draw</div>
              <div className="text-white font-medium">{formatNumber(results.volumeToDraw, 2)} ml</div>
              {typeof results.insulinUnits === "number" && (
                <>
                  <div className="text-gray-400">Insulin units</div>
                  <div className="text-white font-medium">{results.insulinUnits} u</div>
                </>
              )}
              <div className="text-gray-400">Actual concentration</div>
              <div className="text-white font-medium">{formatNumber(results.actualConcentration, 2)} mcg/ml</div>
              <div className="text-gray-400">Doses per vial</div>
              <div className="text-white font-medium">{results.dosesPerVial}</div>
            </div>
            <div className="mt-3 text-xs text-gray-400">Formula: volume (ml) = dose (mcg) / concentration (mcg/ml)</div>

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