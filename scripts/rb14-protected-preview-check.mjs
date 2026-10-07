#!/usr/bin/env node

const baseUrl = process.argv[2]
const expectedSha = process.argv[3]
const bypass = process.env.RB_VERCEL_BYPASS

if (!baseUrl || !expectedSha || !bypass) {
  console.error('usage: RB_VERCEL_BYPASS=<secret> node scripts/rb14-protected-preview-check.mjs <preview-url> <candidate-sha>')
  process.exit(2)
}

const origin = baseUrl.replace(/\/$/, '')
const paths = ['/', '/peptides', '/nutrition', '/daily-history', '/audio', '/store', '/version']
const results = []

async function probe(path, headers = {}) {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual', headers })
  const body = await response.text()
  return { status: response.status, location: response.headers.get('location'), body }
}

for (const path of paths) {
  const anonymous = await probe(path)
  const bypassed = await probe(path, { 'x-vercel-protection-bypass': bypass })
  results.push({ path, anonymous, bypassed })
}

const failures = []
for (const result of results) {
  if (result.anonymous.status !== 302 || !result.anonymous.location?.includes('vercel.com/sso-api')) {
    failures.push(`${result.path} anonymous expected Vercel SSO 302, got ${result.anonymous.status}`)
  }
  if (result.bypassed.status === 302 && result.bypassed.location?.includes('vercel.com/sso-api')) {
    failures.push(`${result.path} bypass still reached Vercel SSO`)
  }
}

const version = results.find(({ path }) => path === '/version').bypassed
let versionJson
try {
  versionJson = JSON.parse(version.body)
} catch {
  failures.push('/version bypass did not return JSON')
}
if (versionJson?.buildSha !== expectedSha) {
  failures.push(`/version build SHA ${versionJson?.buildSha ?? 'missing'} != ${expectedSha}`)
}

const hidden = results.find(({ path }) => path === '/store').bypassed
if (![301, 302, 303, 307, 308].includes(hidden.status) || !hidden.location?.includes('/get-started')) {
  failures.push(`/store bypass expected redirect to /get-started, got ${hidden.status} ${hidden.location ?? ''}`)
}

const allowed = ['/', '/peptides', '/nutrition', '/daily-history', '/audio']
for (const path of allowed) {
  const status = results.find((result) => result.path === path).bypassed.status
  if (![200, 301, 302, 303, 307, 308].includes(status)) failures.push(`${path} unexpected bypass status ${status}`)
}

const checks = paths.length * 2 + 2
console.log(JSON.stringify({ expectedSha, checks, passed: checks - failures.length, failures, results: results.map(({ path, anonymous, bypassed }) => ({ path, anonymous: { status: anonymous.status, location: anonymous.location }, bypassed: { status: bypassed.status, location: bypassed.location } })) }, null, 2))
process.exit(failures.length ? 1 : 0)
