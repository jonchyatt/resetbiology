/**
 * Wave J4.4 check: storing is strict, reading is lenient.
 * Run: npx tsx tests/vault-encryption-check.ts   (exits 0 on pass)
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'crypto'
import { encryptToken, decryptToken, isVaultKeyConfigured, __resetForTests } from '../src/lib/vault-encryption'

const LEGACY = '1//legacy'

// (a) no key -> refuse to store: encryptToken throws VAULT_KEY_MISSING
delete process.env.VAULT_TOKEN_KEY
__resetForTests()
assert.equal(isVaultKeyConfigured(), false)
assert.throws(() => encryptToken('1//new-token'), /VAULT_KEY_MISSING/)

// (a2) wrong-length key -> also refuses
process.env.VAULT_TOKEN_KEY = randomBytes(16).toString('base64')
__resetForTests()
assert.equal(isVaultKeyConfigured(), false)
assert.throws(() => encryptToken('1//new-token'), /VAULT_KEY_MISSING/)

// (c) existing members keep working with NO key: legacy plaintext still reads
delete process.env.VAULT_TOKEN_KEY
__resetForTests()
assert.deepEqual(decryptToken(LEGACY), { plaintext: LEGACY, wasEncrypted: false })

// (b) valid 32-byte key -> round-trips, and the stored form is not the plaintext
process.env.VAULT_TOKEN_KEY = randomBytes(32).toString('base64')
__resetForTests()
assert.equal(isVaultKeyConfigured(), true)
const stored = encryptToken('1//real-refresh-token')
assert.notEqual(stored, '1//real-refresh-token')
assert.deepEqual(decryptToken(stored), { plaintext: '1//real-refresh-token', wasEncrypted: true })
assert.equal(encryptToken(stored), stored, 'idempotent on already-encrypted input')

// (c2) legacy plaintext still reads with a key configured too
assert.deepEqual(decryptToken(LEGACY), { plaintext: LEGACY, wasEncrypted: false })

console.log('vault-encryption-check: all cases pass')
