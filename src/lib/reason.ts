// src/lib/reason.ts
//
// REASON CONTRACT v1.1 — the member's "why" is authoritatively their latest
// NEPQSubmission (successVision, secondarily successFeeling), reached
// SERVER-SIDE via the session user's quizSubmissionId, falling back to an
// exact case-insensitive email match. Never localStorage, never a
// client-supplied user id, never another user's row.

export interface ReasonSourceUser {
  quizSubmissionId: string | null
  email: string | null
}

export interface ReasonSourceSubmission {
  id: string
  email: string
  successVision: string
  successFeeling: string
  createdAt: Date
}

export interface ReasonResult {
  reason: string | null
  feeling: string | null
}

/**
 * Pure resolution: given the session user and a pool of candidate
 * submissions (linked-by-id and/or matched-by-email), picks the one the
 * contract says wins.
 *   1. quizSubmissionId match, if present among the candidates — wins outright.
 *   2. Otherwise the latest (by createdAt) exact case-insensitive email match.
 *   3. Otherwise null/null (honest-empty-state territory, not this function's job).
 */
export function resolveReason(
  user: ReasonSourceUser,
  submissions: ReasonSourceSubmission[]
): ReasonResult {
  const linked = user.quizSubmissionId
    ? submissions.find((s) => s.id === user.quizSubmissionId)
    : undefined

  if (linked) {
    return { reason: linked.successVision || null, feeling: linked.successFeeling || null }
  }

  const email = user.email?.toLowerCase()
  const emailMatches = email ? submissions.filter((s) => s.email.toLowerCase() === email) : []

  if (emailMatches.length === 0) return { reason: null, feeling: null }

  const latest = emailMatches.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
  return { reason: latest.successVision || null, feeling: latest.successFeeling || null }
}
