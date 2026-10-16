import assert from 'node:assert/strict'
import { journalToMarkdown } from '../src/lib/journalMarkdown'
import { validateUsername, validateWeight } from '../src/lib/inputValidators'
import { shapeMemberExport } from '../src/lib/memberExport'
import { journalAfterDelete } from '../src/lib/journalDelete'

// I-1 Drive serializer writes every member-authored field
const md = journalToMarkdown({
  date: new Date('2026-10-16T00:00:00Z'), mood: 'Great', weight: 181,
  entry: { reasonsValidation: 'REFLECTION-TEXT', affirmationGoal: 'GOAL-LINE', affirmationBecause: 'BECAUSE-LINE', affirmationMeans: 'MEANS-LINE', peptideNotes: 'TB-500 dose' },
})
for (const t of ['REFLECTION-TEXT', 'GOAL-LINE', 'BECAUSE-LINE', 'MEANS-LINE', 'TB-500 dose', 'Great', '181', 'October 16, 2026']) assert.ok(md.includes(t), t)
console.log('1 drive journal serializer: OK')

// I-3 username
assert.equal(validateUsername(''), null)
assert.equal(validateUsername('hunt2_user.x'), null)
for (const bad of ['Bad Name!', 'ab', 'a'.repeat(31), 'no-dash']) assert.ok(validateUsername(bad), bad)
console.log('2 username validator: OK')

// I-4 weight
assert.equal(validateWeight(181.5, 'lb'), null)
assert.ok(validateWeight(5000, 'lb')); assert.ok(validateWeight(49, 'lb')); assert.ok(validateWeight(1501, 'lb'))
assert.equal(validateWeight(20, 'kg'), null); assert.ok(validateWeight(701, 'kg')); assert.ok(validateWeight(NaN))
console.log('3 weight validator: OK')

// I-7 export shaper
const out = shapeMemberExport({
  exportedAt: 'x', peptideNames: { p1: 'TB-500' },
  account: { id: 'u', name: 'REA', email: 'e@x.com', stripeCustomerId: 'cus_123', auth0Sub: 'a|1', createdAt: '2026-10-15T22:00:00Z' },
  data: {
    peptide_orders: [{ id: 'o', total: 5 }], AffiliateTracking: [{ id: 'a' }], DriveSyncOutbox: [{ id: 'd' }],
    JournalEntry: [{ id: 'j', userId: 'u', date: '2026-10-16T00:00:00Z', mood: 'Good', weight: 181, entry: JSON.stringify({ reasonsValidation: 'hello', affirmationGoal: 'g', peptideNotes: 'dose line', tasksCompleted: {} }) }],
    user_peptide_protocols: [{ id: 'pr', userId: 'u', peptideId: 'p1', dosage: '300mcg', startDate: '2026-10-15T00:00:00Z' }],
    peptide_doses: [{ id: 'x', protocolId: 'pr', protocolName: 'TB-500', localDate: '2026-10-16', time: '18:42', dosage: '250mcg' }],
  },
})
const s = JSON.stringify(out)
assert.ok(!/stripeCustomerId|peptide_orders|AffiliateTracking|DriveSyncOutbox|auth0Sub|"userId"|"id"/.test(s), 'leak: ' + s)
assert.equal((out as any).journal[0].reflection, 'hello')
assert.equal((out as any).journal[0].date, '2026-10-16')
assert.ok(!s.includes('\\"reasonsValidation'), 'journal still JSON-in-string')
assert.equal((out as any).peptides.protocols[0].peptide, 'TB-500')
assert.ok((out as any).README && (out as any).profile && (out as any).breath && (out as any).mentalTraining && (out as any).workouts && (out as any).nutrition)
console.log('4 export shaper: OK')

// I-5 delete keeps dose lines
const k = journalAfterDelete(JSON.stringify({ reasonsValidation: 'r', peptideNotes: 'TB-500 dose', affirmationGoal: 'g', tasksCompleted: { journal: true, peptides: true } }))
assert.ok(k.keep && !k.entryJson.includes('reasonsValidation') && k.entryJson.includes('TB-500 dose') && !k.entryJson.includes('journal"'))
assert.equal(journalAfterDelete(JSON.stringify({ reasonsValidation: 'r', peptideNotes: '  ' })).keep, false)
console.log('5 delete keeps dose lines: OK')
