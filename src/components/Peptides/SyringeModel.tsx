"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";

/*********************************
 * F8.3 fix — ONE syringe model shared by DosageCalculator + PeptideTracker.
 * Readout is ALWAYS the true units (never clamped to the barrel size).
 * The barrel fill visually caps at 100% when the dose exceeds the selected
 * syringe, but an explicit warning banner says so instead of hiding it.
 *********************************/

export type SyringeSize = 30 | 50 | 100;
const SYRINGE_SIZES: SyringeSize[] = [30, 50, 100];

export interface EvaluateSyringeResult {
  readoutUnits: number;
  overSyringe: boolean;
  overVial: boolean;
  fillRatio: number; // 0..1, visual cap only — never drives the readout
}

/** Smallest syringe that fits the dose, else 100 (largest we support). */
export function pickDefaultSyringeSize(trueUnits: number): SyringeSize {
  for (const size of SYRINGE_SIZES) {
    if (trueUnits <= size) return size;
  }
  return 100;
}

/**
 * Pure calc — no React — so it's unit-testable straight from a fixture.
 * readoutUnits is always the true value; overSyringe/overVial are the two
 * warning flags; fillRatio is capped at 1 for the visual fill only.
 */
export function evaluateSyringe(
  trueUnits: number,
  size: SyringeSize,
  vialCapacityUnits?: number,
): EvaluateSyringeResult {
  const readoutUnits = Number.isFinite(trueUnits) ? trueUnits : 0;
  const overSyringe = readoutUnits > size;
  const overVial =
    typeof vialCapacityUnits === "number" && vialCapacityUnits > 0
      ? readoutUnits > vialCapacityUnits
      : false;
  const fillRatio = size > 0 ? Math.min(Math.max(readoutUnits / size, 0), 1) : 0;
  return { readoutUnits, overSyringe, overVial, fillRatio };
}

const formatNumber = (n: number, digits = 2) =>
  Number.isFinite(n) ? Number(n.toFixed(digits)) : 0;

export interface SyringeModelProps {
  /** Real units to draw (unclamped). undefined/NaN => empty "enter prep" state. */
  trueUnits?: number;
  /** Optional precise ml value for the "X ml drawn" line; derived from trueUnits if omitted. */
  volumeInMl?: number;
  /** Explicit syringe size. Omit to let the model default + let the user pick. */
  syringeSize?: SyringeSize;
  /** Total units the vial's reconstituted volume holds (totalVolume * 100). */
  vialCapacityUnits?: number;
  className?: string;
}

export const SyringeModel: React.FC<SyringeModelProps> = ({
  trueUnits,
  volumeInMl,
  syringeSize,
  vialCapacityUnits,
  className = "",
}) => {
  const hasUnits = typeof trueUnits === "number" && Number.isFinite(trueUnits);
  const [manualSize, setManualSize] = useState<SyringeSize | null>(null);
  const size = syringeSize ?? manualSize ?? pickDefaultSyringeSize(hasUnits ? trueUnits! : 0);

  const barrelTop = 32;
  const barrelHeight = 210;
  const barrelBottom = barrelTop + barrelHeight;
  const unitsPerLabel = size / 10;

  const { readoutUnits, overSyringe, overVial, fillRatio } = hasUnits
    ? evaluateSyringe(trueUnits!, size, vialCapacityUnits)
    : { readoutUnits: 0, overSyringe: false, overVial: false, fillRatio: 0 };
  const displayVolume = volumeInMl ?? readoutUnits / 100;

  const fillHeight = barrelHeight * fillRatio;
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
    <div
      className={`relative bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 w-full max-w-[260px] lg:max-w-[240px] mx-auto ${className}`}
    >
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 140 310" className="w-40 drop-shadow-xl" aria-label="Syringe fill visualization">
          {/* Barrel */}
          <path
            d={`M48 ${barrelTop - 8}h26c3.3 0 6 2.7 6 6v6h-38v-6c0-3.3 2.7-6 6-6z`}
            fill="rgba(255,255,255,0.18)"
          />
          <rect x="40" y={barrelTop} width="40" height={barrelHeight} rx="6" ry="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.24)" strokeWidth="1.8" />

          {/* Tick marks */}
          {Array.from({ length: 10 + 1 }).map((_, index) => {
            const y = barrelTop + (barrelHeight / 10) * index;
            const labelValue = size - index * unitsPerLabel;
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
                  {formatNumber(labelValue, labelValue < 10 ? 1 : 0)}
                </text>
              </g>
            );
          })}

          {/* Fill — visually capped at 100%, readout below never is */}
          <clipPath id="syringe-barrel-clip">
            <rect x="40" y={barrelTop} width="40" height={barrelHeight} rx="6" ry="6" />
          </clipPath>
          {hasUnits && (
            <g clipPath="url(#syringe-barrel-clip)">
              <rect
                x="40"
                y={stopperY}
                width="40"
                height={barrelBottom - stopperY}
                fill={overSyringe || overVial ? "url(#syringe-fill-warn)" : "url(#syringe-fill)"}
                className="transition-all duration-500 ease-out"
              />
            </g>
          )}

          {/* Stopper */}
          {hasUnits && (
            <rect x="38" y={Math.min(Math.max(stopperY - 6, barrelTop), barrelBottom - 10)} width="44" height="10" rx="3" fill="rgba(0,0,0,0.55)" />
          )}

          <defs>
            <linearGradient id="syringe-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6FE7DC" />
              <stop offset="100%" stopColor="#3FBFB5" />
            </linearGradient>
            <linearGradient id="syringe-fill-warn" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FCA5A5" />
              <stop offset="100%" stopColor="#EF4444" />
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

        {hasUnits ? (
          <>
            <div className="text-center mt-4">
              <p
                className={`text-4xl font-extrabold tracking-tight ${overSyringe || overVial ? "text-red-400" : "text-primary-300"}`}
                aria-live="polite"
              >
                {formatNumber(readoutUnits, 1)} u
              </p>
              <p className="mt-1 text-sm text-gray-300" aria-live="polite">
                {formatNumber(displayVolume, displayVolume < 1 ? 3 : 2)} ml drawn
              </p>
            </div>

            <div className="w-full mt-4" aria-hidden>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-2 transition-all duration-500 ${overSyringe || overVial ? "bg-red-500" : "bg-primary-600"}`}
                  style={{ width: `${fillRatio * 100}%` }}
                />
              </div>
            </div>

            {overVial ? (
              <div className="mt-3 w-full flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/15 p-2.5 text-xs text-red-200" role="alert">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Exceeds vial contents — this dose is more than the reconstituted vial holds. Check your prep inputs.</span>
              </div>
            ) : overSyringe ? (
              <div className="mt-3 w-full flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/15 p-2.5 text-xs text-red-200" role="alert">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Exceeds {size}u syringe — use a larger syringe or split the dose.</span>
              </div>
            ) : null}

            <div className="mt-3 flex gap-1.5" role="group" aria-label="Syringe size">
              {SYRINGE_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setManualSize(s)}
                  className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                    s === size
                      ? "border-primary-400/60 bg-primary-600/30 text-primary-200"
                      : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {s}u
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-400">Enter prep values to see syringe fill.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyringeModel;
