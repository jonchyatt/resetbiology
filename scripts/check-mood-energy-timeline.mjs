import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const schema = read('prisma/schema.prisma')
const api = read('app/api/journal/mood-energy/route.ts')
const itemApi = read('app/api/journal/mood-energy/[id]/route.ts')
const ui = read('src/components/Journal/MoodEnergyTimeline.tsx')
const checks = [
  ['two-user isolation', api.includes('userId: user.id') && itemApi.includes('userId: resolved.id')],
  ['CRUD', api.includes('export async function POST') && itemApi.includes('PATCH') && itemApi.includes('DELETE')],
  ['local dates and DST-safe timestamp', schema.includes('localDate') && schema.includes('recordedAt') && ui.includes('datetime-local')],
  ['day/week/month aggregation surface', ui.includes('periodMode') && ui.includes('value="day"') && ui.includes('value="week"') && ui.includes('value="month"')],
  ['tag/date filters', api.includes('params.get(\'from\')') && api.includes('params.get(\'tag\')') && ui.includes('Timeline tag')],
  ['neutral event linkage', ui.includes('Neutral event markers') && ui.includes('href')],
  ['deleted-link honesty', ui.includes('deleted records are not recreated')],
  ['CSV/print parity', ui.includes('exportCsv') && ui.includes('window.print') && ui.includes('entries.map')],
  ['reload persistence', ui.includes('cache: "no-store"') && api.includes('findMany')],
  ['duplicate idempotency', api.includes('clientKey') && api.includes('duplicate: true')],
  ['malformed values rejected', api.includes('validScale') && api.includes('status: 400')],
  ['forbidden-causality copy', ui.includes('does not infer causes') && ui.includes('does not diagnose')],
]
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
if (checks.some(([, ok]) => !ok)) process.exitCode = 1
else console.log(`PASS ${checks.length}/${checks.length} mood-energy timeline checks`)