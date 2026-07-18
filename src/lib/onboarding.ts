// Pure derivation for the first-run OnboardingGuide (FLOW-SPEC T6).
// No DB, no session — callers (the status route, tests) supply already-fetched
// facts. Keeping this pure is what makes it testable without a live Prisma
// connection (tests/onboarding.test.ts runs it against seed arrays).

export interface DeriveOnboardingInput {
  /** User.onboardingComplete (schema.prisma:49) — the ONLY persisted bit. */
  onboardingComplete: boolean
  /** User.googleDriveConnectedAt set (schema.prisma:42) — Step 2 derived done. */
  driveConnected: boolean
  /** any FoodLog OR DailyTask row for the user — Step 3 derived done. */
  firstWinDone: boolean
  /**
   * One YYYY-MM-DD local-day key per JournalEntry + DailyTask row (v2
   * GRANDFATHER THRESHOLD, LOW amendment). Row COUNT and DISTINCT DAY count
   * both come from this same array so a caller can't desync them.
   */
  historyDayKeys: string[]
}

export interface OnboardingState {
  onboardingComplete: boolean
  driveConnected: boolean
  firstWinDone: boolean
  /** ≥3 history rows spanning ≥2 distinct local days — "genuine history", not mere row existence. */
  grandfatherEligible: boolean
}

export function deriveOnboarding(input: DeriveOnboardingInput): OnboardingState {
  const distinctDays = new Set(input.historyDayKeys).size
  const grandfatherEligible =
    !input.onboardingComplete &&
    input.historyDayKeys.length >= 3 &&
    distinctDays >= 2

  return {
    onboardingComplete: input.onboardingComplete,
    driveConnected: input.driveConnected,
    firstWinDone: input.firstWinDone,
    grandfatherEligible,
  }
}
