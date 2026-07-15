// Ticket T7 check — proves the verified-email merge guard in
// src/lib/getUserFromSession.ts behaves per the Jon-ruled contract:
//   verified   + existing user with that email -> merge (reattach sub) + one
//                [identity-merge] audit log line
//   unverified + existing user with that email -> 'unverified_email' outcome,
//                NO merge (auth0Sub left untouched), NO new user created
//   unverified + no existing user with that email -> fresh user created
//   verified   + no existing user with that email -> fresh user created
//
// Runs the REAL production code (resolveUserFromSession / getUserFromSession)
// from src/lib/getUserFromSession.ts. Only @/lib/prisma is faked (in-memory
// collection), same pattern as scripts/check-modules-drive-sync.mjs. The
// module is mocked exactly once (Node's test-module-mocks throws on a second
// mock.module call for the same specifier), so the fake store is reset
// between tests instead of re-mocked.
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
}

function resetStore() {
  users.clear()
}

const prismaSpecifier = pathToFileURL(path.resolve('src/lib/prisma.ts')).href
mock.module(prismaSpecifier, { namedExports: { prisma: fakePrisma } })

const { resolveUserFromSession, getUserFromSession } = await import('../src/lib/getUserFromSession.ts')

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
