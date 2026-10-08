import assert from 'node:assert/strict'
import { RequestCookies, ResponseCookies } from '@edge-runtime/cookies'
import { TransactionStore } from '@auth0/nextjs-auth0/server'
import { RESPONSE_TYPES } from '@auth0/nextjs-auth0/types'
import { getAuth0TransactionCookieDomain } from '../src/lib/auth0-transaction-cookie'

type UserId = 'fixture-a' | 'fixture-b'
type RecordKind = 'peptide' | 'meal' | 'journal' | 'audio'
type UserRecord = { id: string; userId: UserId; kind: RecordKind; localDate: string; value: string; completed?: boolean; edited?: boolean }

type Session = { userId: UserId; token: string }

class EphemeralJourneyStore {
  private readonly records: UserRecord[] = []
  private readonly sessions = new Map<string, Session>()
  private sequence = 0

  createSession(userId: UserId): string {
    const token = `${userId}-session-${++this.sequence}`
    this.sessions.set(token, { userId, token })
    return token
  }

  logout(token: string): void {
    this.sessions.delete(token)
  }

  reenter(userId: UserId): string {
    return this.createSession(userId)
  }

  private userFor(token: string): UserId {
    const session = this.sessions.get(token)
    assert.ok(session, 'every operation requires an active isolated session')
    return session.userId
  }

  createPeptide(token: string, localDate: string, name: string): UserRecord {
    const userId = this.userFor(token)
    const record = { id: `peptide-${++this.sequence}`, userId, kind: 'peptide' as const, localDate, value: name }
    this.records.push(record)
    return record
  }

  saveMeal(token: string, localDate: string, name: string): UserRecord {
    const userId = this.userFor(token)
    const record = { id: `meal-${++this.sequence}`, userId, kind: 'meal' as const, localDate, value: name }
    this.records.push(record)
    return record
  }

  saveJournal(token: string, localDate: string, value: string): UserRecord {
    const userId = this.userFor(token)
    const existing = this.records.find((record) => record.userId === userId && record.kind === 'journal' && record.localDate === localDate)
    if (existing) {
      existing.value = value
      existing.edited = true
      return existing
    }
    const record = { id: `journal-${++this.sequence}`, userId, kind: 'journal' as const, localDate, value }
    this.records.push(record)
    return record
  }

  startAudio(token: string, localDate: string, module: string): UserRecord {
    const userId = this.userFor(token)
    const record = { id: `audio-${++this.sequence}`, userId, kind: 'audio' as const, localDate, value: module, completed: false }
    this.records.push(record)
    return record
  }

  completeAudio(token: string, id: string): UserRecord {
    const userId = this.userFor(token)
    const record = this.records.find((candidate) => candidate.id === id && candidate.userId === userId && candidate.kind === 'audio')
    assert.ok(record, 'audio completion must be scoped to the active user')
    record.completed = true
    return record
  }

  load(token: string, kind: RecordKind, localDate?: string): UserRecord[] {
    const userId = this.userFor(token)
    return this.records.filter((record) => record.userId === userId && record.kind === kind && (!localDate || record.localDate === localDate))
  }
}

function localDate(instant: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
}

function requestCookies(cookieHeader?: string): RequestCookies {
  const headers = new Headers()
  if (cookieHeader) headers.set('cookie', cookieHeader)
  return new RequestCookies(headers)
}

let assertions = 0
function check<T>(condition: T, message: string): asserts condition {
  assertions += 1
  assert.ok(condition, message)
}
function equal<T>(actual: T, expected: T, message: string): void {
  assertions += 1
  assert.equal(actual, expected, message)
}

async function validateCallbackState(): Promise<void> {
  equal(getAuth0TransactionCookieDomain('https://resetbiology.com'), 'resetbiology.com', 'production callback aliases share the transaction cookie')
  equal(getAuth0TransactionCookieDomain('http://localhost:3000'), undefined, 'local callbacks retain host-only cookies')
  const store = new TransactionStore({ secret: 'rb16-test-secret-that-is-long-enough', cookieOptions: { domain: 'resetbiology.com', path: '/', secure: true, sameSite: 'lax' }, enableParallelTransactions: true })
  const responseHeaders = new Headers()
  await store.save(new ResponseCookies(responseHeaders), { state: 'rb16-state', nonce: 'nonce', codeVerifier: 'verifier', responseType: RESPONSE_TYPES.CODE, returnTo: '/portal' })
  const setCookie = responseHeaders.get('set-cookie')
  check(setCookie, 'callback transaction creation emits a cookie')
  const cookieHeader = setCookie.split(';', 1)[0]
  const valid = await store.get(requestCookies(cookieHeader), 'rb16-state')
  equal(valid?.payload.state, 'rb16-state', 'matching callback state validates')
  equal(await store.get(requestCookies(), 'rb16-state'), null, 'missing callback state is rejected')
  equal(await store.get(requestCookies(cookieHeader), 'wrong-state'), null, 'mismatched callback state is rejected')
  await store.delete(new ResponseCookies(new Headers()), 'rb16-state')
  equal(await store.get(requestCookies(), 'rb16-state'), null, 'callback state cannot be replayed')
}

async function runJourney(userId: UserId, instant: string, store: EphemeralJourneyStore): Promise<void> {
  const date = localDate(instant)
  const nextDate = localDate('2026-10-07T06:01:00.000Z')
  const token = store.createSession(userId)
  const peptide = store.createPeptide(token, date, `${userId}-peptide`)
  equal(store.load(token, 'peptide')[0]?.id, peptide.id, `${userId} peptide reloads`) 
  const meal = store.saveMeal(token, date, `${userId}-meal`)
  equal(store.load(token, 'meal', date)[0]?.value, `${userId}-meal`, `${userId} meal saves to local day`)
  const journal = store.saveJournal(token, date, `${userId}-journal-v1`)
  equal(store.load(token, 'journal', date)[0]?.id, journal.id, `${userId} journal reloads`)
  const edited = store.saveJournal(token, date, `${userId}-journal-v2`)
  check(edited.edited, `${userId} journal edit persists`)
  equal(store.load(token, 'journal', date)[0]?.value, `${userId}-journal-v2`, `${userId} journal edit reloads`)
  const audio = store.startAudio(token, date, `${userId}-module`)
  equal(store.load(token, 'audio', date)[0]?.completed, false, `${userId} audio starts incomplete`)
  store.completeAudio(token, audio.id)
  equal(store.load(token, 'audio', date)[0]?.completed, true, `${userId} audio completion persists`)
  store.logout(token)
  const reentered = store.reenter(userId)
  equal(store.load(reentered, 'peptide').length, 1, `${userId} peptide survives logout and re-entry`)
  equal(store.load(reentered, 'journal', date).length, 1, `${userId} journal survives logout and re-entry`)
  if (instant === '2026-10-07T05:59:00.000Z') {
    equal(date, '2026-10-06', 'America/Denver midnight boundary remains on the prior local day')
    equal(nextDate, '2026-10-07', 'America/Denver after-midnight instant advances local day')
  }
  equal(store.load(reentered, 'meal', date)[0]?.id, meal.id, `${userId} meal identity survives re-entry`)
}

async function main(): Promise<void> {
  await validateCallbackState()
  const store = new EphemeralJourneyStore()
  await runJourney('fixture-a', '2026-10-07T05:59:00.000Z', store)
  await runJourney('fixture-b', '2026-10-07T06:01:00.000Z', store)
  const a = store.reenter('fixture-a')
  const b = store.reenter('fixture-b')
  for (const kind of ['peptide', 'meal', 'journal', 'audio'] as const) {
    const aValues = store.load(a, kind).map((record) => record.value)
    const bValues = store.load(b, kind).map((record) => record.value)
    check(aValues.every((value) => value.startsWith('fixture-a')), `fixture A has no fixture B ${kind} records`)
    check(bValues.every((value) => value.startsWith('fixture-b')), `fixture B has no fixture A ${kind} records`)
  }
  equal(store.load(a, 'journal', '10/07/2026').length, 0, 'fixture A does not leak across local days')
  equal(store.load(b, 'journal', '10/06/2026').length, 0, 'fixture B does not inherit fixture A midnight records')
  console.log(`RB-16 local free journey: PASS (${assertions} assertions)`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
