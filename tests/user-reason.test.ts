import { resolveReason, type ReasonSourceSubmission, type ReasonSourceUser } from '../src/lib/reason'

interface Scenario {
  label: string
  user: ReasonSourceUser
  submissions: ReasonSourceSubmission[]
  expected: { reason: string | null; feeling: string | null }
}

function sub(id: string, email: string, vision: string, feeling: string, createdAt: string): ReasonSourceSubmission {
  return { id, email, successVision: vision, successFeeling: feeling, createdAt: new Date(createdAt) }
}

const scenarios: Scenario[] = [
  {
    label: 'linked submission wins',
    user: { quizSubmissionId: 'sub-1', email: 'jon@example.com' },
    submissions: [sub('sub-1', 'jon@example.com', 'See my kids grow up healthy', 'proud', '2026-01-01')],
    expected: { reason: 'See my kids grow up healthy', feeling: 'proud' },
  },
  {
    label: 'unlinked but email match',
    user: { quizSubmissionId: null, email: 'Jon@Example.com' },
    submissions: [sub('sub-2', 'jon@example.com', 'Run a 5k again', 'strong', '2026-02-01')],
    expected: { reason: 'Run a 5k again', feeling: 'strong' },
  },
  {
    label: 'no submission at all',
    user: { quizSubmissionId: null, email: 'nobody@example.com' },
    submissions: [],
    expected: { reason: null, feeling: null },
  },
  {
    label: 'email mismatch never leaks another user row',
    user: { quizSubmissionId: null, email: 'jon@example.com' },
    submissions: [sub('sub-3', 'someoneelse@example.com', 'Their reason', 'their feeling', '2026-01-01')],
    expected: { reason: null, feeling: null },
  },
  {
    label: 'two submissions, latest wins',
    user: { quizSubmissionId: null, email: 'jon@example.com' },
    submissions: [
      sub('sub-4', 'jon@example.com', 'Old reason from January', 'old feeling', '2026-01-01'),
      sub('sub-5', 'jon@example.com', 'New reason from June', 'new feeling', '2026-06-01'),
    ],
    expected: { reason: 'New reason from June', feeling: 'new feeling' },
  },
]

const results = scenarios.map((scenario) => {
  const actual = resolveReason(scenario.user, scenario.submissions)
  const pass = actual.reason === scenario.expected.reason && actual.feeling === scenario.expected.feeling
  if (!pass) {
    console.error(`[FAIL] ${scenario.label} expected ${JSON.stringify(scenario.expected)} but got ${JSON.stringify(actual)}`)
  } else {
    console.log(`[PASS] ${scenario.label}`)
  }
  return pass
})

if (results.some((pass) => !pass)) {
  process.exitCode = 1
  console.error('\nOne or more reason-resolution scenarios failed.')
} else {
  console.log('\nAll reason-resolution scenarios passed.')
}
