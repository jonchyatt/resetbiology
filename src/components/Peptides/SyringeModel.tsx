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

  const barrelTop = 78;
  const barrelHeight = 190;
  const barrelBottom = barrelTop + barrelHeight;
  const barrelX = 40;
  const barrelWidth = 40;
  const unitsPerLabel = size / 10;

  const { readoutUnits, overSyringe, overVial, fillRatio } = hasUnits
    ? evaluateSyringe(trueUnits!, size, vialCapacityUnits)
    : { readoutUnits: 0, overSyringe: false, overVial: false, fillRatio: 0 };
  const displayVolume = volumeInMl ?? readoutUnits / 100;

  // Two visually-distinct, non-flashing warning states (render-only — the
  // trigger logic above is untouched): amber = correctable (bigger syringe
  // fixes it), red = the more serious impossible-per-vial case.
  const warnLevel: "none" | "syringe" | "vial" = overVial ? "vial" : overSyringe ? "syringe" : "none";
  const warnStroke = warnLevel === "vial" ? "#EF4444" : warnLevel === "syringe" ? "#F59E0B" : "rgba(255,255,255,0.24)";
  const fillGradientId =
    warnLevel === "vial" ? "syringe-fill-warn-red" : warnLevel === "syringe" ? "syringe-fill-warn-amber" : "syringe-fill";
  const fillTransition = { transition: "y 200ms ease-out, height 200ms ease-out" };

  // Fluid + stopper: the stopper's BOTTOM (needle-facing) edge is the real reading
  // edge on an insulin syringe, so it's pinned exactly to the fill boundary.
  const fillHeight = barrelHeight * fillRatio;
  const stopperY = barrelBottom - fillHeight;
  const stopperHeight = 12;
  const stopperTopY = stopperY - stopperHeight;

  // Plunger rod: fixed anchor near the top; the rod visually shortens as the
  // stopper rises toward it (more dose drawn = more of the rod is "inside"),
  // animating on the same easing/timing as the fill so they never detach.
  const rodTopY = 54;
  const rodWidth = 7;
  const rodHeight = Math.max(stopperTopY - rodTopY, 0);
  const flangeWidth = 36;
  const flangeHeight = 14;
  const flangeY = rodTopY - flangeHeight;

  // Needle hub (distinct cone) + fine needle line, below the barrel.
  const hubTopY = barrelBottom;
  const hubHeight = 16;
  const hubBottomWidth = 6;
  const needleLength = 30;
  const needleWidth = 2.5;
  const needleTipY = hubTopY + hubHeight + needleLength;

  // Tick hierarchy: the 11 major label VALUES/POSITIONS are unchanged; minor
  // ticks between them scale with syringe size, and neither crosses the fluid
  // column (both stop well short of the barrel's right wall).
  const minorPerMajor = size === 100 ? 4 : size === 50 ? 4 : 2;
  const segmentHeight = barrelHeight / 10;

  return (
    <div
      className={`relative bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 w-full max-w-[260px] lg:max-w-[240px] mx-auto ${className}`}
    >
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 140 336" className="w-40 drop-shadow-xl" aria-label="Syringe fill visualization">
          <defs>
            <linearGradient id="syringe-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6FE7DC" />
              <stop offset="100%" stopColor="#3FBFB5" />
            </linearGradient>
            <linearGradient id="syringe-fill-warn-amber" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="syringe-fill-warn-red" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FCA5A5" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
            <linearGradient id="syringe-glass-highlight" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <linearGradient id="syringe-needle-hub" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FDBA74" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
            <clipPath id="syringe-barrel-clip">
              <rect x={barrelX} y={barrelTop} width={barrelWidth} height={barrelHeight} rx="6" ry="6" />
            </clipPath>
          </defs>

          {/* Shoulder — tapered neck between the barrel opening and the exposed rod */}
          <path
            d={`M46 ${barrelTop} L${60 - rodWidth / 2 - 3} ${rodTopY + 6} L${60 + rodWidth / 2 + 3} ${rodTopY + 6} L74 ${barrelTop} Z`}
            fill="rgba(255,255,255,0.1)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />

          {/* Barrel (glass) */}
          <rect
            x={barrelX}
            y={barrelTop}
            width={barrelWidth}
            height={barrelHeight}
            rx="6"
            ry="6"
            fill="rgba(255,255,255,0.04)"
            stroke={warnStroke}
            strokeWidth={warnLevel === "none" ? 1.8 : 2.2}
          />

          {/* Fill — visually capped at 100%, readout below never is. Animated on
              y/height explicitly (not transition-all) so it stays in lockstep
              with the stopper below. */}
          {hasUnits && (
            <g clipPath="url(#syringe-barrel-clip)">
              <rect
                x={barrelX}
                y={stopperY}
                width={barrelWidth}
                height={barrelBottom - stopperY}
                fill={`url(#${fillGradientId})`}
                style={fillTransition}
              />
              <rect x={barrelX + 3} y={barrelTop + 4} width="7" height={barrelHeight - 8} fill="url(#syringe-glass-highlight)" />
            </g>
          )}

          {/* Plunger rod — visible through the glass above the stopper; not
              clipped to the barrel since part of it sits above the opening. */}
          {hasUnits && (
            <rect x={60 - rodWidth / 2} y={rodTopY} width={rodWidth} height={rodHeight} rx="2" fill="rgba(241,245,249,0.6)" style={fillTransition} />
          )}

          {/* Tick marks — majors keep their exact calibrated values/positions;
              minor gradation density scales with syringe size. Neither crosses
              into the right side of the barrel, so the fluid column reads clean. */}
          {Array.from({ length: 11 }).map((_, index) => {
            const y = barrelTop + segmentHeight * index;
            const labelValue = size - index * unitsPerLabel;
            return (
              <g key={`major-${index}`}>
                <line x1={barrelX} x2={barrelX + barrelWidth * 0.55} y1={y} y2={y} stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" />
                <text x={barrelX - 4} y={y + 3} textAnchor="end" fontSize="7.5" fontWeight="bold" fill="rgba(255,255,255,0.75)">
                  {formatNumber(labelValue, labelValue < 10 ? 1 : 0)}
                </text>
              </g>
            );
          })}
          {Array.from({ length: 10 }).map((_, seg) =>
            Array.from({ length: minorPerMajor }).map((_, m) => {
              const y = barrelTop + segmentHeight * seg + (segmentHeight * (m + 1)) / (minorPerMajor + 1);
              return (
                <line
                  key={`minor-${seg}-${m}`}
                  x1={barrelX}
                  x2={barrelX + barrelWidth * 0.25}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                />
              );
            }),
          )}

          {/* Stopper — rubber, dark charcoal (not near-black). Its bottom edge is
              the reading edge, aligned exactly to the dose line; animated on the
              same timing as the fill above so they never visually detach. */}
          {hasUnits && (
            <>
              <rect x={barrelX} y={stopperTopY} width={barrelWidth} height={stopperHeight} rx="2.5" fill="#3F4A5A" style={fillTransition} />
              <rect x={barrelX} y={stopperY - 1.5} width={barrelWidth} height="1.5" fill="rgba(255,255,255,0.4)" style={fillTransition} />
            </>
          )}

          {/* Barrel outline redrawn crisp on top of fill/ticks/stopper */}
          <rect
            x={barrelX}
            y={barrelTop}
            width={barrelWidth}
            height={barrelHeight}
            rx="6"
            ry="6"
            fill="none"
            stroke={warnStroke}
            strokeWidth={warnLevel === "none" ? 1.8 : 2.2}
          />

          {/* Plunger rod + thumb-press flange */}
          <rect x={60 - flangeWidth / 2} y={flangeY} width={flangeWidth} height={flangeHeight} rx="4" fill="rgba(248,250,252,0.92)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />

          {/* Needle hub (distinct cone, real insulin-syringe orange) + fine beveled needle */}
          <path
            d={`M46 ${hubTopY} L${60 - hubBottomWidth / 2} ${hubTopY + hubHeight} L${60 + hubBottomWidth / 2} ${hubTopY + hubHeight} L74 ${hubTopY} Z`}
            fill="url(#syringe-needle-hub)"
            stroke="#C2410C"
            strokeWidth="0.75"
          />
          <rect x={60 - needleWidth / 2} y={hubTopY + hubHeight} width={needleWidth} height={needleLength - 4} fill="rgba(255,255,255,0.85)" />
          <path
            d={`M${60 - needleWidth / 2} ${hubTopY + hubHeight + needleLength - 4} L${60 + needleWidth / 2} ${hubTopY + hubHeight + needleLength - 4} L60 ${needleTipY} Z`}
            fill="rgba(255,255,255,0.85)"
          />

          <text x="86" y={barrelTop - 6} fontSize="8" fill="rgba(255,255,255,0.6)" letterSpacing="1.4">
            UNITS
          </text>
        </svg>

        {hasUnits ? (
          <>
            <div className="text-center mt-4">
              <p
                className={`text-4xl font-extrabold tracking-tight tabular-nums ${
                  warnLevel === "vial" ? "text-red-400" : warnLevel === "syringe" ? "text-amber-400" : "text-primary-300"
                }`}
                aria-live="polite"
              >
                {formatNumber(readoutUnits, 1)} u
              </p>
              <p className="mt-1 text-sm text-gray-300 tabular-nums" aria-live="polite">
                {formatNumber(displayVolume, displayVolume < 1 ? 3 : 2)} ml drawn
              </p>
            </div>

            {overVial ? (
              <div className="mt-3 w-full flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/15 p-2.5 text-xs text-red-200" role="alert">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Exceeds vial contents — this dose is more than the reconstituted vial holds. Check your prep inputs.</span>
              </div>
            ) : overSyringe ? (
              <div className="mt-3 w-full flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/20 p-2.5 text-xs text-amber-200" role="alert">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Exceeds {size}u syringe — use a larger syringe or split the dose.</span>
              </div>
            ) : null}

            <div className="mt-3 flex gap-1 rounded-full border border-white/10 bg-white/5 p-1" role="group" aria-label="Syringe size">
              {SYRINGE_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setManualSize(s)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    s === size
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
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
