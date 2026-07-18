import { deriveOnboarding, type DeriveOnboardingInput } from '../src/lib/onboarding'

// FLOW-SPEC T6 regression harness for the pure onboarding derivation —
// no DB, no session, follows the tests/local-day.test.ts idiom (seed
// array + check() + process.exitCode).

type Scenario = {
  label: string
  input: DeriveOnboardingInput
  expected: {
    onboardingComplete: boolean
    driveConnected: boolean
    firstWinDone: boolean
    grandfatherEligible: boolean
  }
}

const scenarios: Scenario[] = [
  {
    label: 'brand-new user — nothing done',
    input: { onboardingComplete: false, driveConnected: false, firstWinDone: false, historyDayKeys: [] },
    expected: { onboardingComplete: false, driveConnected: false, firstWinDone: false, grandfatherEligible: false },
  },
  {
    label: 'drive-connected only',
    input: { onboardingComplete: false, driveConnected: true, firstWinDone: false, historyDayKeys: [] },
    expected: { onboardingComplete: false, driveConnected: true, firstWinDone: false, grandfatherEligible: false },
  },
  {
    label: 'has-meal only',
    input: { onboardingComplete: false, driveConnected: false, firstWinDone: true, historyDayKeys: [] },
    expected: { onboardingComplete: false, driveConnected: false, firstWinDone: true, grandfatherEligible: false },
  },
  {
    label: 'both steps 2 and 3 done',
    input: { onboardingComplete: false, driveConnected: true, firstWinDone: true, historyDayKeys: [] },
    expected: { onboardingComplete: false, driveConnected: true, firstWinDone: true, grandfatherEligible: false },
  },
  {
    label: 'grandfather-eligible — 3 rows spanning 2 distinct days',
    input: {
      onboardingComplete: false,
      driveConnected: false,
      firstWinDone: false,
      historyDayKeys: ['2026-07-01', '2026-07-01', '2026-07-02'],
    },
    expected: { onboardingComplete: false, driveConnected: false, firstWinDone: false, grandfatherEligible: true },
  },
  {
    label: 'NOT eligible — 3 rows but all on the same day',
    input: {
      onboardingComplete: false,
      driveConnected: false,
      firstWinDone: false,
      historyDayKeys: ['2026-07-01', '2026-07-01', '2026-07-01'],
    },
    expected: { onboardingComplete: false, driveConnected: false, firstWinDone: false, grandfatherEligible: false },
  },
  {
    label: 'NOT eligible — 2 distinct days but only 2 rows (row-count floor)',
    input: {
      onboardingComplete: false,
      driveConnected: false,
      firstWinDone: false,
      historyDayKeys: ['2026-07-01', '2026-07-02'],
    },
    expected: { onboardingComplete: false, driveConnected: false, firstWinDone: false, grandfatherEligible: false },
  },
  {
    label: 'complete-flag already set — grandfather is moot even with qualifying history',
    input: {
      onboardingComplete: true,
      driveConnected: true,
      firstWinDone: true,
      historyDayKeys: ['2026-07-01', '2026-07-01', '2026-07-02'],
    },
    expected: { onboardingComplete: true, driveConnected: true, firstWinDone: true, grandfatherEligible: false },
  },
]

let failed = false

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`)
  } else {
    failed = true
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

for (const scenario of scenarios) {
  const result = deriveOnboarding(scenario.input)
  const matches =
    result.onboardingComplete === scenario.expected.onboardingComplete &&
    result.driveConnected === scenario.expected.driveConnected &&
    result.firstWinDone === scenario.expected.firstWinDone &&
    result.grandfatherEligible === scenario.expected.grandfatherEligible
  check(scenario.label, matches, `expected ${JSON.stringify(scenario.expected)}, got ${JSON.stringify(result)}`)
}

if (failed) {
  process.exitCode = 1
  console.error('\nOne or more onboarding scenarios failed.')
} else {
  console.log('\nAll onboarding scenarios passed.')
}
