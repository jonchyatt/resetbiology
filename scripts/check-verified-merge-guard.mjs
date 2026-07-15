// Ticket T7/T8 check — proves the verified-email merge guard behaves per the
// Jon-ruled contract at BOTH merge sites:
//
// src/lib/getUserFromSession.ts (resolveUserFromSession / getUserFromSession
// — the guarded resolver every API route sweeps through):
//   verified   + existing user with that email -> merge (reattach sub) + one
//                [identity-merge] audit log line
//   unverified + existing user with that email -> 'unverified_email' outcome,
//                NO merge (auth0Sub left untouched), NO new user created
//   absent email_verified claim -> treated as NOT verified (same as false)
//   unverified + no existing user with that email -> fresh user created
//   verified   + no existing user with that email -> fresh user created
//
// src/lib/auth0.ts (syncUserToDatabase — the beforeSessionSaved hook that
// runs on EVERY login, independent of any API route):
//   (a) match by auth0Sub -> normal update, no reattach needed
//   (b) match by email only + VERIFIED -> reattach sub + [identity-merge] log
//   (c) match by email only + UNVERIFIED -> no reattach, no dupe create,
//       sync skipped entirely, no user mutation, does not throw
//
// Runs the REAL production code from both files. Only @/lib/prisma is faked
// (in-memory collection), same pattern as scripts/check-modules-drive-sync.mjs.
// The module is mocked exactly once (Node's test-module-mocks throws on a
// second mock.module call for the same specifier) — getUserFromSession.ts
// imports '@/lib/prisma' and auth0.ts imports './prisma', but both resolve
// to the same file (src/lib/prisma.ts) so one mock covers both importers.
//
// Run: node --import tsx --experimental-test-module-mocks scripts/check-verified-merge-guard.mjs

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let nextId = 1
const genId = () => `fake-user-${nextId++}`

const users = new Map() // id -> row

const fakePrisma = {
  user: {
    async findUnique({ where }) {
      for (const u of users.values()) {
        if (where.auth0Sub !== undefined && u.auth0Sub === where.auth0Sub) return u
        if (where.email !== undefined && u.email === where.email) return u
      }
      return null
    },
    // Only exercised by auth0.ts's generateMemberID() (orders by memberID
    // desc to mint the next RB-###### id). None of the seeded rows in these
    // tests carry a memberID, so this always returns null (start at RB-000001).
    async findFirst() {
      return null
    },
    async update({ where, data }) {
      const u = users.get(where.id)
      Object.assign(u, data)
      return u
    },
    async create({ data }) {
      const u = { id: genId(), ...data }
      users.set(u.id, u)
      return u
    },
  },
  // auth0.ts's syncUserToDatabase looks up a quiz submission by email to
  // decide the introduction-tier upgrade; irrelevant to the merge-guard
  // contract under test, so always "no submission found".
  nEPQSubmission: {
    async findFirst() {
      return null
    },
  },
}

function resetStore() {
  users.clear()
}

const prismaSpecifier = pathToFileURL(path.resolve('src/lib/prisma.ts')).href
mock.module(prismaSpecifier, { namedExports: { prisma: fakePrisma } })

const { resolveUserFromSession, getUserFromSession } = await import('../src/lib/getUserFromSession.ts')
const { syncUserToDatabase } = await import('../src/lib/auth0.ts')

function session(sub, email, emailVerified) {
  return { user: { sub, email, email_verified: emailVerified }, tokenSet: {} }
}

test('verified + existing email row -> merge + audit log', async () => {
  resetStore()
  const existing = await fakePrisma.user.create({
    data: { auth0Sub: 'auth0|old-sub', email: 'jon@example.com', name: 'Jon' },
  })

  const logs = []
  const origLog = console.log
  console.log = (...args) => { logs.push(args); origLog(...args) }
  let result
  try {
    result = await resolveUserFromSession(session('auth0|new-sub', 'jon@example.com', true))
  } finally {
    console.log = origLog
  }

  assert.equal(result.status, 'ok')
  assert.equal(result.user.id, existing.id)
  assert.equal(result.user.auth0Sub, 'auth0|new-sub', 'sub must be reattached to the existing row')
  assert.equal(users.size, 1, 'no new user row created')

  const mergeLine = logs.find(l => l[0] === '[identity-merge]')
  assert.ok(mergeLine, 'expected one [identity-merge] audit log line')
  assert.deepEqual(mergeLine[1], {
    existingUserId: existing.id,
    newSub: 'auth0|new-sub',
    email: 'jon@example.com',
    emailVerified: true,
  })
})

test('unverified + existing email row -> unverified_email outcome, no merge, no create', async () => {
  resetStore()
  const existing = await fakePrisma.user.create({
    data: { auth0Sub: 'auth0|old-sub', email: 'jon@example.com', name: 'Jon' },
  })

  const result = await resolveUserFromSession(session('auth0|attacker-sub', 'jon@example.com', false))

  assert.equal(result.status, 'unverified_email')
  assert.equal(result.email, 'jon@example.com')
  assert.equal(users.size, 1, 'no new user row created')
  const stillOld = await fakePrisma.user.findUnique({ where: { auth0Sub: 'auth0|old-sub' } })
  assert.equal(stillOld.id, existing.id, 'existing row auth0Sub must be untouched')
  const attackerSub = await fakePrisma.user.findUnique({ where: { auth0Sub: 'auth0|attacker-sub' } })
  assert.equal(attackerSub, null, 'attacker sub must not have been merged in')

  // backward-compatible wrapper collapses this to null, same as "not found"
  const wrapped = await getUserFromSession(session('auth0|attacker-sub', 'jon@example.com', false))
  assert.equal(wrapped, null)
})

test('unverified + no existing email row -> fresh user created', async () => {
  resetStore()
  const result = await resolveUserFromSession(session('auth0|brand-new', 'new@example.com', false))

  assert.equal(result.status, 'ok')
  assert.equal(result.user.email, 'new@example.com')
  assert.equal(result.user.auth0Sub, 'auth0|brand-new')
  assert.equal(users.size, 1)
})

test('verified + no existing email row -> fresh user created', async () => {
  resetStore()
  const result = await resolveUserFromSession(session('auth0|brand-new-2', 'newer@example.com', true))

  assert.equal(result.status, 'ok')
  assert.equal(result.user.email, 'newer@example.com')
  assert.equal(users.size, 1)
})

test('absent email_verified claim + existing email row -> treated as unverified (blocked, no merge)', async () => {
  resetStore()
  const existing = await fakePrisma.user.create({
    data: { auth0Sub: 'auth0|old-sub', email: 'jon@example.com', name: 'Jon' },
  })

  // No emailVerified arg at all -> session.user.email_verified is undefined,
  // not false. Must still be treated as NOT verified.
  const result = await resolveUserFromSession({ user: { sub: 'auth0|attacker-sub', email: 'jon@example.com' } })

  assert.equal(result.status, 'unverified_email')
  assert.equal(users.size, 1, 'no new user row created')
  const stillOld = await fakePrisma.user.findUnique({ where: { auth0Sub: 'auth0|old-sub' } })
  assert.equal(stillOld.id, existing.id, 'existing row auth0Sub must be untouched')
})

// ---------------------------------------------------------------------------
// src/lib/auth0.ts — syncUserToDatabase (the beforeSessionSaved merge site)
// Mirrors contract (a)/(b)/(c) from the ticket, using the same fakePrisma
// store as above (prisma.ts is mocked once, both importers share it).
// ---------------------------------------------------------------------------

function authSession(sub, email, emailVerified, extra = {}) {
  return { user: { sub, email, email_verified: emailVerified, name: 'Test User', ...extra } }
}

test('auth0.ts (a): match by auth0Sub -> normal update, no reattach needed', async () => {
  resetStore()
  const existing = await fakePrisma.user.create({
    data: { auth0Sub: 'auth0|stable-sub', email: 'stable@example.com', name: 'Old Name', accessLevel: 'subscriber' },
  })

  await syncUserToDatabase(authSession('auth0|stable-sub', 'stable@example.com', true, { name: 'New Name' }))

  assert.equal(users.size, 1, 'no new user row created')
  const updated = users.get(existing.id)
  assert.equal(updated.auth0Sub, 'auth0|stable-sub')
  assert.equal(updated.name, 'New Name', 'existing row updated in place')
})

test('auth0.ts (b): match by email only + VERIFIED -> reattach sub + [identity-merge] log', async () => {
  resetStore()
  const existing = await fakePrisma.user.create({
    data: { auth0Sub: 'auth0|old-sub', email: 'jon@example.com', name: 'Jon', accessLevel: 'subscriber' },
  })

  const logs = []
  const origLog = console.log
  console.log = (...args) => { logs.push(args); origLog(...args) }
  try {
    await syncUserToDatabase(authSession('auth0|new-sub', 'jon@example.com', true))
  } finally {
    console.log = origLog
  }

  assert.equal(users.size, 1, 'no new user row created')
  const updated = users.get(existing.id)
  assert.equal(updated.auth0Sub, 'auth0|new-sub', 'sub reattached to the existing row')

  const mergeLine = logs.find(l => l[0] === '[identity-merge]')
  assert.ok(mergeLine, 'expected one [identity-merge] audit log line')
  assert.equal(mergeLine[1].existingUserId, existing.id)
  assert.equal(mergeLine[1].newSub, 'auth0|new-sub')
  assert.equal(mergeLine[1].email, 'jon@example.com')
  assert.equal(mergeLine[1].emailVerified, true)
})

test('auth0.ts (c): match by email only + UNVERIFIED -> no reattach, no dupe, no mutation, does not throw', async () => {
  resetStore()
  const existing = await fakePrisma.user.create({
    data: { auth0Sub: 'auth0|old-sub', email: 'jon@example.com', name: 'Jon', accessLevel: 'subscriber' },
  })
  const snapshotBefore = JSON.stringify(existing)

  await assert.doesNotReject(
    syncUserToDatabase(authSession('auth0|attacker-sub', 'jon@example.com', false)),
    'unverified-collision sync must not throw (login redirect must still complete)'
  )

  assert.equal(users.size, 1, 'no duplicate user row created')
  assert.equal(JSON.stringify(users.get(existing.id)), snapshotBefore, 'existing row must be byte-identical (no mutation at all)')
  const attackerSub = await fakePrisma.user.findUnique({ where: { auth0Sub: 'auth0|attacker-sub' } })
  assert.equal(attackerSub, null, 'attacker sub must not have been merged in')
})

test('auth0.ts: no existing row at all -> fresh user created (unaffected by the guard)', async () => {
  resetStore()
  await syncUserToDatabase(authSession('auth0|brand-new', 'brand-new@example.com', false))

  assert.equal(users.size, 1)
  const created = [...users.values()][0]
  assert.equal(created.auth0Sub, 'auth0|brand-new')
  assert.equal(created.email, 'brand-new@example.com')
})
