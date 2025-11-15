"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  Flame,
  Loader2,
  RefreshCcw,
  Ruler,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { readinessPrompts, visionMetrics, visionWaves } from "@/data/visionProtocols";
import { visionExerciseMap, visionExercises, VisionExercise } from "@/data/visionExercises";

const LETTER_LINES = [
  ["E"],
  ["F", "P"],
  ["T", "O", "Z"],
  ["L", "P", "E", "D"],
  ["P", "E", "C", "F", "D"],
  ["E", "D", "F", "C", "Z", "P"],
  ["F", "E", "L", "O", "P", "Z", "D"],
  ["D", "E", "F", "P", "O", "T", "E", "C"],
  ["L", "E", "F", "O", "D", "P", "C", "T"],
  ["F", "D", "P", "L", "T", "C", "E", "O"],
];

const DIRECTIONAL_LINES: Direction[][] = [
  ["up"],
  ["left", "right"],
  ["up", "down", "left"],
  ["right", "up", "down", "left"],
  ["up", "right", "down", "left", "up"],
  ["down", "left", "right", "up", "down", "left"],
];

const letterScale = [64, 56, 48, 40, 32, 24, 18, 14, 12, 10];

const CATEGORY_LABELS: Record<VisionExercise["category"], string> = {
  downshift: "Downshift",
  mechanics: "Mechanics",
  peripheral: "Peripheral",
  speed: "Speed",
  integration: "Integration",
};

const categoryFilters: Array<{ value: "all" | VisionExercise["category"]; label: string }> = [
  { value: "all", label: "All" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value: value as VisionExercise["category"], label })),
];

export function VisionHealing() {
  const [visionMode, setVisionMode] = useState<"near" | "far">("near");
  const [chartMode, setChartMode] = useState<"letters" | "directional">("letters");
  const [distanceCm, setDistanceCm] = useState(40);
  const [lineIndex, setLineIndex] = useState(4);
  const [isShuffling, setIsShuffling] = useState(false);

  const [waveIndex, setWaveIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(visionWaves[0].blocks[0].exerciseIds[0]);
  const [coachStep, setCoachStep] = useState(0);
  const [exerciseFilter, setExerciseFilter] = useState<"all" | VisionExercise["category"]>("all");

  const chartLines = chartMode === "letters" ? LETTER_LINES : DIRECTIONAL_LINES;
  const activeLine = chartLines[Math.min(lineIndex, chartLines.length - 1)];
  const distanceRange = visionMode === "far" ? { min: 30, max: 200 } : { min: 10, max: 80 };

  const instruction = useMemo(() => {
    if (visionMode === "far") {
      return distanceCm >= 150
        ? "Hold steady — log this distance as today’s far baseline."
        : "If letters are clear, step back 2 cm. If blurry, move closer 1 cm.";
    }
    return distanceCm <= 15
      ? "Great near control. Try a micro-hold at 10 cm before blinking."
      : "Dial closer in 0.5 cm increments, breathe out as the chart approaches.";
  }, [distanceCm, visionMode]);

  const cycleLine = () => {
    setIsShuffling(true);
    setTimeout(() => {
      setLineIndex((prev) => (prev + 1) % chartLines.length);
      setIsShuffling(false);
    }, 200);
  };

  const activeWave = visionWaves[waveIndex];
  const activeBlock = activeWave.blocks[blockIndex];
  const blockExercises = activeBlock.exerciseIds
    .map((id) => visionExerciseMap[id])
    .filter((exercise): exercise is VisionExercise => Boolean(exercise));

  useEffect(() => {
    const defaultExercise = blockExercises[0]?.id ?? visionExercises[0].id;
    setSelectedExerciseId(defaultExercise);
    setCoachStep(0);
  }, [waveIndex, blockIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedExercise = visionExerciseMap[selectedExerciseId];
  const selectedSteps = selectedExercise?.checkpoints ?? [];
  const filteredExercises = useMemo(() => {
    if (exerciseFilter === "all") return visionExercises;
    return visionExercises.filter((exercise) => exercise.category === exerciseFilter);
  }, [exerciseFilter]);

  const goNextStep = () => {
    if (!selectedSteps.length) return;
    setCoachStep((prev) => (prev + 1) % selectedSteps.length);
  };

  return (
    <div className="space-y-10 text-white">
      <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-8 shadow-inner">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Vision Recovery Lab</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Interactive eye-healing flows with the same precision you expect from Reset Biology
            </h1>
            <p className="mt-4 text-base text-slate-300">
              We rebuilt the entire ScreenFit workbook into a living, guided experience: adaptive Snellen trainer, wave-based
              programming, session coach, and exercise explorer — no PDFs, no friction, just modern UX on any device.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-200">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2">
                Adaptive near/far guidance
              </div>
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2">Protocol intelligence</div>
              <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 px-4 py-2">Session-level coaching</div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-slate-900 to-black px-6 py-5 text-sm text-slate-200">
            <p className="font-semibold text-white">What’s inside</p>
            <ul className="mt-3 space-y-2">
              <li>• Snellen-inspired trainer with live cues</li>
              <li>• Protocol waves mapped to interactive blocks</li>
              <li>• Session coach cycling each checkpoint</li>
              <li>• Explorer for every drill, cue, and progression</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-primary-500/10 p-6 shadow-2xl shadow-primary-500/20 backdrop-blur-sm hover:shadow-primary-500/30 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Calibration</p>
              <h2 className="text-xl font-semibold">Distance-guided Snellen trainer</h2>
            </div>
            <div className="flex gap-2 text-xs">
              {(["near", "far"] as const).map((mode) => (
                <button
                  key={mode}
                  className={`rounded-full border px-3 py-1 uppercase tracking-widest ${
                    visionMode === mode ? "border-secondary-400 bg-secondary-400/20 text-white" : "border-white/10 text-slate-300"
                  }`}
                  onClick={() => {
                    setVisionMode(mode);
                    setDistanceCm(mode === "near" ? 35 : 120);
                  }}
                >
                  {mode} vision
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-primary-400/20 bg-gray-900/30 p-5 text-center">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Target distance</span>
              <span>{distanceCm} cm</span>
            </div>
            <input
              type="range"
              min={distanceRange.min}
              max={distanceRange.max}
              value={distanceCm}
              onChange={(event) => setDistanceCm(Number(event.target.value))}
              className="mt-4 w-full accent-secondary-300"
            />
            <p className="mt-3 text-sm text-slate-200">{instruction}</p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/5 to-black/40 p-6 text-center">
            <div className="flex items-center justify-between">
              <div className="text-left text-xs uppercase tracking-[0.3em] text-slate-400">Chart mode</div>
              <div className="flex gap-2 text-xs">
                {(["letters", "directional"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setChartMode(mode);
                      setLineIndex(0);
                    }}
                    className={`rounded-xl px-3 py-1 ${
                      chartMode === mode ? "bg-white/20 text-white" : "bg-white/5 text-slate-300"
                    }`}
                  >
                    {mode === "letters" ? "Letter lines" : "E directional"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3 font-mono">
              {activeLine.map((value, idx) => (
                <div
                  key={`${value}-${idx}`}
                  className="flex items-center justify-center text-white"
                  style={{
                    fontSize: chartMode === "letters" ? `${letterScale[Math.min(lineIndex, letterScale.length - 1)]}px` : "64px",
                    letterSpacing: chartMode === "letters" ? "0.2em" : "0.5em",
                  }}
                >
                  {chartMode === "letters" ? value : <DirectionalE direction={value as Direction} />}
                </div>
              ))}
            </div>

            <button
              onClick={cycleLine}
              disabled={isShuffling}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-primary-500/10 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary-500/20 transition hover:border-white/40 hover:shadow-primary-500/30 hover:scale-105 disabled:opacity-50"
            >
              {isShuffling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Shuffle line
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
            <div className="flex items-center gap-3">
              <Ruler className="h-5 w-5 text-secondary-200" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Key metrics</p>
                <h3 className="text-lg font-semibold">Quantify the gains</h3>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm text-slate-200">
              {visionMetrics.map((metric) => (
                <li key={metric.label} className="rounded-2xl border border-primary-400/20 bg-gray-900/30 px-4 py-3">
                  <p className="font-semibold text-white">{metric.label}</p>
                  <p className="text-xs uppercase tracking-wide text-secondary-200/70">Target: {metric.target}</p>
                  <p className="mt-1 text-slate-300">{metric.howTo}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-secondary-200" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Readiness prompts</p>
                <h3 className="text-lg font-semibold">Check in before drills</h3>
              </div>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {readinessPrompts.map((prompt) => (
                <li key={prompt}>{prompt}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-400">Log the answers next to your Snellen readings or in the Reset journal.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Interactive flow builder</p>
            <h2 className="text-xl font-semibold">Choose a wave, follow the blocks, let the coach guide you</h2>
            <p className="text-sm text-slate-300">Every drill, cue, and progression is now native to the app.</p>
          </div>
          <Sparkles className="h-10 w-10 text-secondary-200" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {visionWaves.map((wave, idx) => (
            <button
              key={wave.key}
              onClick={() => {
                setWaveIndex(idx);
                setBlockIndex(0);
              }}
              className={`rounded-full border px-4 py-2 font-semibold uppercase tracking-widest transition ${
                waveIndex === idx ? "border-secondary-400 bg-secondary-500/20 text-white shadow-lg shadow-secondary-500/20" : "border-white/10 text-slate-300 hover:shadow-md hover:shadow-secondary-500/10"
              } hover:scale-105`}
            >
              {wave.title}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm text-slate-200">
          <InfoCard title="Duration" value={activeWave.duration} />
          <InfoCard title="Rhythm" value={activeWave.rhythm} />
          <InfoCard title="Recovery cues" value={activeWave.recovery.join(" • ")} />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {activeWave.blocks.map((block, idx) => (
            <button
              key={block.title}
              onClick={() => setBlockIndex(idx)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                blockIndex === idx ? "border-secondary-400 bg-secondary-500/20 shadow-lg shadow-secondary-500/20" : "border-white/10 bg-primary-500/10 hover:shadow-primary-500/20"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/80">{block.duration}</p>
              <p className="mt-2 text-lg font-semibold text-white">{block.title}</p>
              <p className="mt-2 text-sm text-slate-300">{block.description}</p>
              <div className="mt-3 text-xs text-slate-400">Intent: {block.intent}</div>
              <ul className="mt-2 text-xs text-slate-300">
                {block.cues.map((cue) => (
                  <li key={cue}>• {cue}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-primary-400/30 bg-gray-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/80">{activeBlock.duration}</p>
                <h3 className="text-lg font-semibold text-white">Block drill stack</h3>
              </div>
              <Timer className="h-5 w-5 text-secondary-200" />
            </div>

            <ul className="mt-4 space-y-3">
              {blockExercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    selectedExerciseId === exercise.id
                      ? "border-secondary-400 bg-secondary-500/10"
                      : "border-white/10 bg-slate-950/30 hover:border-white/30"
                  }`}
                >
                  <button
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => {
                      setSelectedExerciseId(exercise.id);
                      setCoachStep(0);
                    }}
                  >
                    <div>
                      <p className="font-semibold text-white">{exercise.title}</p>
                      <p className="text-xs text-slate-400">{exercise.duration} • {CATEGORY_LABELS[exercise.category]}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-secondary-200" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            {selectedExercise ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Session coach</p>
                    <h3 className="text-lg font-semibold text-white">{selectedExercise.title}</h3>
                    <p className="text-xs text-slate-400">
                      {selectedExercise.duration} • {CATEGORY_LABELS[selectedExercise.category]} • {selectedExercise.intensity} intent
                    </p>
                  </div>
                  <Flame className="h-5 w-5 text-secondary-200" />
                </div>

                <p className="mt-4 text-sm text-slate-300">{selectedExercise.summary}</p>

                <div className="mt-4 rounded-xl border border-white/10 bg-primary-500/10 p-4 shadow-md shadow-primary-500/10 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Checkpoint {selectedSteps.length ? coachStep + 1 : 0}/{selectedSteps.length}</span>
                    {selectedExercise.distanceTargets && (
                      <span>
                        Near: {selectedExercise.distanceTargets.near ?? "--"} • Far: {selectedExercise.distanceTargets.far ?? "--"}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-base font-semibold text-white">
                    {selectedSteps[coachStep] ?? "Add checkpoints to this drill."}
                  </p>
                  <button
                    onClick={goNextStep}
                    disabled={!selectedSteps.length}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-secondary-400/50 px-4 py-2 text-sm font-semibold text-secondary-100 transition hover:border-secondary-300 disabled:opacity-50"
                  >
                    Next checkpoint
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  {selectedExercise.guidance.map((tip) => (
                    <div key={tip.heading} className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/80">{tip.heading}</p>
                      <p className="mt-1">{tip.detail}</p>
                    </div>
                  ))}
                  {selectedExercise.progression && (
                    <div className="rounded-xl border border-white/10 bg-secondary-500/10 px-4 py-3 text-xs text-slate-400 shadow-sm shadow-secondary-500/10">
                      Progression: {selectedExercise.progression}
                    </div>
                  )}
                  {selectedExercise.layering && (
                    <div className="rounded-xl border border-white/10 bg-secondary-500/10 px-4 py-3 text-xs text-slate-400 shadow-sm shadow-secondary-500/10">
                      Layering idea: {selectedExercise.layering}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-300">Select an exercise to launch the session coach.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-primary-400/30 bg-gray-900/40 p-6 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Exercise explorer</p>
            <h2 className="text-xl font-semibold">Every drill, beautifully interactive</h2>
            <p className="text-sm text-slate-300">Filter by category, tap a card, and you’ve got the entire playbook.</p>
          </div>
          <Eye className="h-10 w-10 text-secondary-200" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {categoryFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setExerciseFilter(filter.value)}
              className={`rounded-full border px-4 py-1 font-semibold uppercase tracking-widest transition ${
                exerciseFilter === filter.value ? "border-secondary-400 bg-secondary-400/20 text-white shadow-md shadow-secondary-500/20" : "border-white/10 text-slate-300 hover:shadow-sm hover:shadow-secondary-500/10"
              } hover:scale-105`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} className="rounded-2xl border border-primary-400/30 bg-gray-900/40 p-5 shadow-inner">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">
                    {CATEGORY_LABELS[exercise.category]} • {exercise.duration}
                  </p>
                  <h3 className="text-lg font-semibold text-white">{exercise.title}</h3>
                </div>
                <Flame className="h-5 w-5 text-secondary-200" />
              </div>
              <p className="mt-3 text-sm text-slate-300">{exercise.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {exercise.focus.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-secondary-200">
                    {tag}
                  </span>
                ))}
              </div>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {exercise.checkpoints.map((checkpoint) => (
                  <li key={checkpoint}>{checkpoint}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

type Direction = "up" | "down" | "left" | "right";

function DirectionalE({ direction }: { direction: Direction }) {
  const rotations: Record<Direction, string> = {
    up: "rotate-0",
    right: "rotate-90",
    down: "rotate-180",
    left: "-rotate-90",
  };

  return (
    <span className={`inline-block font-sans text-[72px] font-black ${rotations[direction]}`}>E</span>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-primary-400/20 bg-gray-900/30 px-4 py-3 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">{title}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
