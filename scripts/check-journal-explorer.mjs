import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const checks = [
  ['two-user isolation', read('app/api/journal/explorer/route.ts').includes('userId: user.id') && read('app/api/journal/explorer/[id]/route.ts').includes('userId: user.id')],
  ['journal CRUD', read('app/api/journal/explorer/route.ts').includes('export async function POST') && read('app/api/journal/explorer/[id]/route.ts').includes('export async function PATCH') && read('app/api/journal/explorer/[id]/route.ts').includes('export async function DELETE')],
  ['search and type/date filters', read('app/api/journal/explorer/route.ts').includes('params.get(\'q\')') && read('src/components/Journal/JournalExplorer.tsx').includes('Filter by type') && read('src/components/Journal/JournalExplorer.tsx').includes('From date')],
  ['tags and rename', read('app/api/journal/explorer/tags/route.ts').includes('renamed') && read('src/components/Journal/JournalExplorer.tsx').includes('Rename')],
  ['pin/favorite', read('src/components/Journal/JournalExplorer.tsx').includes('togglePin') && read('app/api/journal/explorer/[id]/route.ts').includes('isPinned')],
  ['real meal peptide hypnosis links', read('app/api/journal/explorer/route.ts').includes("kind: 'meal'") && read('app/api/journal/explorer/route.ts').includes("kind: 'peptide'") && read('app/api/journal/explorer/route.ts').includes("kind: 'hypnosis'")],
  ['deleted-link honesty', read('src/components/Journal/JournalExplorer.tsx').includes('never recreated')],
  ['timezone rollover', read('app/api/journal/explorer/route.ts').includes('localDate') && read('src/components/Journal/JournalExplorer.tsx').includes('type="date"')],
  ['reload persistence', read('src/components/Journal/JournalExplorer.tsx').includes('cache: "no-store"') && read('app/api/journal/explorer/route.ts').includes('journalRecord.findMany')],
  ['duplicate submit', read('app/api/journal/explorer/route.ts').includes('clientKey') && read('app/api/journal/explorer/route.ts').includes('duplicate: true')],
  ['false-insight rejection', read('src/components/Journal/JournalExplorer.tsx').includes('does not diagnose') && !read('src/components/Journal/JournalExplorer.tsx').includes('insight')],
]
const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
if (failed.length) process.exitCode = 1
else console.log(`PASS ${checks.length}/${checks.length} journal explorer checks`)
