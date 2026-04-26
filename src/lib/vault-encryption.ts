/**
 * Vault Token Encryption (AES-256-GCM)
 *
 * Encrypts user OAuth refresh tokens at rest in MongoDB. Without this,
 * an Atlas dump exposes every user's Google Drive access token.
 *
 * Format: base64url( version(1) | nonce(12) | ciphertext | tag(16) )
 * Key: VAULT_TOKEN_KEY env var, base64-encoded 32 bytes.
 *
 * Graceful degradation: if VAULT_TOKEN_KEY is missing, encryption becomes
 * a passthrough (logs a warning once). Lets the system run during the
 * window between deploy and key provisioning. Lazy migration handles
 * pre-encryption tokens — decrypt() detects the format and returns
 * plaintext unchanged with `wasEncrypted: false`, so the caller can
 * re-encrypt on the next write opportunity.
 *
 * @see docs/PHASE-2-DRIVE-PRIMARY.md (Codex HIGH-2 finding)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALG = 'aes-256-gcm'
const NONCE_LEN = 12
const TAG_LEN = 16
const VERSION = 0x01

let cachedKey: Buffer | null = null
let warnedMissingKey = false

function getKey(): Buffer | null {
  if (cachedKey) return cachedKey
  const raw = process.env.VAULT_TOKEN_KEY
  if (!raw) {
    if (!warnedMissingKey) {
      console.warn(
        '[vault-encryption] VAULT_TOKEN_KEY not set — refresh tokens will be stored UNENCRYPTED. Set this env var ASAP.',
      )
      warnedMissingKey = true
    }
    return null
  }
  try {
    const buf = Buffer.from(raw, 'base64')
    if (buf.length !== 32) {
      console.error(
        `[vault-encryption] VAULT_TOKEN_KEY must decode to 32 bytes, got ${buf.length}. Encryption disabled.`,
      )
      return null
    }
    cachedKey = buf
    return buf
  } catch (err) {
    console.error('[vault-encryption] VAULT_TOKEN_KEY base64 decode failed:', err)
    return null
  }
}

/**
 * Test if a string looks like our encrypted format (vs legacy plaintext).
 * Heuristic: base64url-decoded buffer starts with our VERSION byte AND is
 * at least version(1)+nonce(12)+tag(16) = 29 bytes. Plaintext OAuth refresh
 * tokens from Google start with `1//` and are not valid base64url.
 */
function looksEncrypted(value: string): boolean {
  if (!value || value.startsWith('1//')) return false
  try {
    const buf = Buffer.from(value, 'base64url')
    return buf.length >= NONCE_LEN + TAG_LEN + 1 && buf[0] === VERSION
  } catch {
    return false
  }
}

/**
 * Encrypt a token. If no key is provisioned, returns the plaintext unchanged
 * (graceful degradation). Always idempotent — passing already-encrypted input
 * returns it unchanged.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext
  if (looksEncrypted(plaintext)) return plaintext
  const key = getKey()
  if (!key) return plaintext

  const nonce = randomBytes(NONCE_LEN)
  const cipher = createCipheriv(ALG, key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([Buffer.from([VERSION]), nonce, ciphertext, tag]).toString('base64url')
}

/**
 * Decrypt a token. Handles three cases:
 *   1. Encrypted with current key → returns { plaintext, wasEncrypted: true }
 *   2. Looks plaintext (legacy or no key)  → returns { plaintext: input, wasEncrypted: false }
 *   3. Looks encrypted but decrypt fails  → throws (likely key rotation issue — surface loudly)
 */
export function decryptToken(value: string): { plaintext: string; wasEncrypted: boolean } {
  if (!value) return { plaintext: value, wasEncrypted: false }
  if (!looksEncrypted(value)) return { plaintext: value, wasEncrypted: false }

  const key = getKey()
  if (!key) {
    // We have an encrypted blob but no key — can't decrypt. Surface clearly.
    throw new Error(
      'Cannot decrypt token: VAULT_TOKEN_KEY not set but data looks encrypted. Did you rotate the key without re-encrypting?',
    )
  }

  const buf = Buffer.from(value, 'base64url')
  const nonce = buf.subarray(1, 1 + NONCE_LEN)
  const tag = buf.subarray(buf.length - TAG_LEN)
  const ciphertext = buf.subarray(1 + NONCE_LEN, buf.length - TAG_LEN)

  const decipher = createDecipheriv(ALG, key, nonce)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
  return { plaintext, wasEncrypted: true }
}

/**
 * Reset module state (test-only).
 */
export function __resetForTests() {
  cachedKey = null
  warnedMissingKey = false
}
