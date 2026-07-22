import fs from 'node:fs'
import path from 'node:path'

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const schema = fs.readFileSync(schemaPath, 'utf8')
let failed = false

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`)
  } else {
    failed = true
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function block(kind: 'model' | 'enum', name: string): string {
  const marker = `${kind} ${name} {`
  const start = schema.indexOf(marker)
  if (start < 0) return ''

  let depth = 0
  for (let index = start; index < schema.length; index += 1) {
    if (schema[index] === '{') depth += 1
    if (schema[index] === '}') {
      depth -= 1
      if (depth === 0) return schema.slice(start, index + 1)
    }
  }
  return ''
}

function normalizedLines(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}

function hasLine(source: string, expected: string): boolean {
  return normalizedLines(source).includes(expected)
}

const statusBlock = block('enum', 'BodyMetricStatus')
const statusVocabulary = normalizedLines(statusBlock).slice(1, -1)
check('BodyMetricStatus exists', statusBlock.length > 0)
check(
  'BodyMetricStatus has the exact approved vocabulary and order',
  JSON.stringify(statusVocabulary) === JSON.stringify([
    'resolved',
    'same_value_duplicates',
    'conflict',
    'unknown_unit',
    'removed',
    'invalid_source',
  ]),
  statusVocabulary.join(',')
)

const bodyMetric = block('model', 'BodyMetric')
check('BodyMetric exists', bodyMetric.length > 0)

const bodyMetricFields = [
  'id String @id @default(auto()) @map("_id") @db.ObjectId',
  'userId String @db.ObjectId',
  'dayKey String',
  'weightKg Float?',
  'source String',
  'sourceValue Float?',
  'sourceUnit String?',
  'status BodyMetricStatus',
  'sourceEntryIds String[] @db.ObjectId',
  'sourceRevision String',
  'provenance Json',
  'migrationId String?',
  'reconciledAt DateTime?',
  'createdAt DateTime @default(now())',
  'updatedAt DateTime @updatedAt',
  'user User @relation(fields: [userId], references: [id])',
]

for (const field of bodyMetricFields) {
  check(`BodyMetric preserves exact field contract: ${field.split(' ')[0]}`, hasLine(bodyMetric, field), field)
}

check('BodyMetric is unique per member and local day', hasLine(bodyMetric, '@@unique([userId, dayKey])'))
check('BodyMetric maps to body_metrics', hasLine(bodyMetric, '@@map("body_metrics")'))

const user = block('model', 'User')
check('User has the additive BodyMetric back-relation', hasLine(user, 'bodyMetrics BodyMetric[]'))

const clientProgress = block('model', 'ClientProgress')
for (const line of [
  'id String @id @default(auto()) @map("_id") @db.ObjectId',
  'userId String @db.ObjectId',
  'metricType String',
  'value Float',
  'date DateTime @default(now())',
  'notes String?',
  'user User @relation(fields: [userId], references: [id])',
  '@@map("client_progress")',
]) {
  check(`ClientProgress remains intact: ${line.split(' ')[0]}`, hasLine(clientProgress, line), line)
}

const journalEntry = block('model', 'JournalEntry')
for (const line of [
  'id String @id @default(auto()) @map("_id") @db.ObjectId',
  'userId String @db.ObjectId',
  'entry String',
  'mood String?',
  'weight Float?',
  'date DateTime',
  'createdAt DateTime @default(now())',
  'updatedAt DateTime? @updatedAt',
  'user User @relation(fields: [userId], references: [id])',
  '@@map("journal_entries")',
]) {
  check(`JournalEntry remains intact: ${line.split(' ')[0]}`, hasLine(journalEntry, line), line)
}

if (failed) {
  process.exitCode = 1
  console.error('\nOne or more BodyMetric schema contract checks failed.')
} else {
  console.log('\nAll BodyMetric schema contract checks passed.')
}
