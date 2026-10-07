import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8')
const identity = readFileSync(new URL('../src/lib/buildIdentity.ts', import.meta.url), 'utf8')
const route = readFileSync(new URL('../app/version/route.ts', import.meta.url), 'utf8')

test('build identity is a full immutable commit SHA', () => {
  assert.match(sha, /^[0-9a-f]{40}$/i)
  assert.match(config, /VERCEL_GIT_COMMIT_SHA/)
  assert.match(config, /NEXT_PUBLIC_BUILD_SHA:\s*buildSha/)
  assert.match(identity, /BUILD_SHA\s*=\s*process\.env\.NEXT_PUBLIC_BUILD_SHA/)
})

test('version route exposes the same machine-readable identity', () => {
  assert.match(route, /buildSha:\s*BUILD_SHA/)
  assert.match(route, /Cache-Control.*immutable/)
})