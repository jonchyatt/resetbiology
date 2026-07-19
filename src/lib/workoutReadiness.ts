// Locked computation contract for readiness actuation (W3). PRIMARY path
// uses the raw slider when the member set it; DERIVED path blends whichever
// of the 4 optional sub-signals are present so a partial check-in still
// yields guidance instead of doing nothing. All inputs are client units:
// readinessScore 0-100, energy/soreness/stress 0-10, sleepHours 0-24.

export const READY_MIN = 70;
export const RECOVER_MAX = 39;

export interface EffectiveReadinessInput {
  readinessScore?: number | null;
  energyLevel?: number | null;
  sorenessLevel?: number | null;
  sleepHours?: number | null;
  stressLevel?: number | null;
}

const isValidNumber = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function effectiveReadiness(input: EffectiveReadinessInput): number | null {
  if (isValidNumber(input.readinessScore, 0, 100)) {
    return Math.min(100, Math.max(0, input.readinessScore as number));
  }

  const components: number[] = [];
  if (isValidNumber(input.energyLevel, 0, 10)) components.push((input.energyLevel as number) * 10);
  if (isValidNumber(input.sorenessLevel, 0, 10)) components.push((10 - (input.sorenessLevel as number)) * 10);
  if (isValidNumber(input.stressLevel, 0, 10)) components.push((10 - (input.stressLevel as number)) * 10);
  if (isValidNumber(input.sleepHours, 0, 24)) components.push((Math.min(input.sleepHours as number, 8) / 8) * 100);

  if (components.length < 2) return null;
  const mean = components.reduce((sum, value) => sum + value, 0) / components.length;
  return Math.round(mean);
}

export interface ReadinessGuidance {
  level: "ready" | "reduce" | "recover" | "none";
  headline: string;
  detail: string;
}

export function readinessGuidance(score: number | null): ReadinessGuidance {
  if (score === null) {
    return {
      level: "none",
      headline: "Check in to get today's guidance",
      detail: "Log a quick readiness check-in and we'll adjust today's plan.",
    };
  }
  if (score >= READY_MIN) {
    return {
      level: "ready",
      headline: "Train as prescribed",
      detail: "Your readiness supports today's full session.",
    };
  }
  if (score <= RECOVER_MAX) {
    return {
      level: "recover",
      headline: "Recovery day",
      detail: "Consider swapping today's session for the mobility work when readiness is low.",
    };
  }
  return {
    level: "reduce",
    headline: "Ease off today",
    detail: "One general option: drop about one set per exercise and stop 2-3 reps shy of failure (RPE ~7-8).",
  };
}
