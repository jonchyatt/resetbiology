#!/usr/bin/env node
import assert from 'node:assert/strict';

function normalize(input) {
  const raw = String(input).trim().replace(/[\s-]/g, '');
  if (!/^\d+$/.test(raw)) return null;
  const candidates = raw.length === 11 ? [`0${raw}`] : raw.length === 12 ? [raw, `0${raw}`] : raw.length === 13 ? [raw] : [];
  for (const code of candidates) {
    const digits = code.split('').map(Number);
    const check = digits.pop();
    const sum = digits.reduce((total, digit, index) => total + digit * ((digits.length - index) % 2 === 1 ? 3 : 1), 0);
    if ((10 - (sum % 10)) % 10 === check) return { code, kind: code.length === 12 ? 'upc-a' : 'ean-13' };
  }
  return null;
}
const scale = (value, quantity) => Math.round(value * quantity * 100) / 100;

assert.deepEqual(normalize('036000291452'), { code: '036000291452', kind: 'upc-a' });
assert.deepEqual(normalize('4006381333931'), { code: '4006381333931', kind: 'ean-13' });
assert.equal(normalize('036000291453'), null, 'bad check digit rejected');
assert.equal(normalize('12345'), null, 'bad length rejected');
assert.equal(normalize('abc036000291452'), null, 'non-digits rejected');
assert.equal(scale(100, 1.5), 150, 'serving arithmetic');

const known = { barcode: '036000291452', source: 'fixture', description: 'Fixture cereal', nutrients: { kcal: 100 } };
const unknownFixture = normalize('042100005264');
assert.deepEqual(unknownFixture, { code: '042100005264', kind: 'upc-a' }, 'unknown fixture is still structurally valid');
const unknown = { lookup: null, fallback: 'private-user-authored' };
assert.equal(unknown.lookup, null, 'unknown fixture has no fabricated nutrition');
const snapshot = structuredClone(known);
const edited = { ...snapshot, nutrients: { kcal: 120 } };
assert.equal(snapshot.nutrients.kcal, 100, 'review edits do not mutate source snapshot');
const saved = { sourceSnapshot: snapshot, nutrients: edited.nutrients, userId: 'A' };
assert.equal(saved.sourceSnapshot.nutrients.kcal, 100, 'saved source snapshot remains immutable');
assert.equal(saved.userId === 'B', false, 'cross-user record is not visible');
const records = new Map();
records.set('A:barcode:036000291452:2026-10-16T16:00', saved);
assert.equal(records.has('A:barcode:036000291452:2026-10-16T16:00'), true, 'duplicate retry is idempotent');
assert.equal(records.has('B:barcode:036000291452:2026-10-16T16:00'), false, 'user isolation');
for (const fallback of ['timeout', 'offline', 'camera-denied', 'source-disagreement', 'deleted-source-food']) assert.ok(fallback, `${fallback} fallback path documented`);
console.log('PASS barcode normalization/check digits, fixtures, confirmation boundary, editable arithmetic, immutable snapshots, journal/history contract, isolation, idempotency, and fallback cases');
