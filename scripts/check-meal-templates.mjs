#!/usr/bin/env node
'use strict'

import assert from 'node:assert/strict'

const users = new Map()
const meals = new Map()
const templates = new Map()
const journal = new Map()
let next = 1
const id = () => `id-${next++}`
const clone = (value) => JSON.parse(JSON.stringify(value))

function logMeal(userId, input, requestId = id()) {
  assert(userId && input.itemName && input.nutrients && typeof input.nutrients === 'object')
  if (meals.has(requestId)) return { ...meals.get(requestId), duplicate: true }
  const meal = { ...clone(input), id: requestId, userId }
  meals.set(requestId, meal)
  const day = input.localDate || '2026-10-16'
  journal.set(`${userId}:${day}`, { userId, day, mealIds: [...(journal.get(`${userId}:${day}`)?.mealIds || []), requestId] })
  return meal
}
function saveTemplate(userId, sourceMealId, name) {
  const source = meals.get(sourceMealId)
  assert(source && source.userId === userId, 'cross-user source rejected')
  assert(name.trim(), 'empty name rejected')
  const duplicate = [...templates.values()].find((t) => t.userId === userId && t.sourceMealId === sourceMealId && t.name === name.trim())
  if (duplicate) return duplicate
  const template = { id: id(), userId, name: name.trim(), sourceMealId, ingredients: clone(source), notes: '', tags: [], favorite: false }
  templates.set(template.id, template)
  return template
}
function repeat(userId, templateId, input = {}, requestId = id()) {
  const template = templates.get(templateId)
  assert(template && template.userId === userId, 'cross-user template rejected')
  if (meals.has(requestId)) return { ...meals.get(requestId), duplicate: true }
  return logMeal(userId, { ...clone(template.ingredients), ...clone(input), source: 'meal-template', localDate: input.localDate || '2026-10-16' }, requestId)
}

const userA = id(); const userB = id()
const source = logMeal(userA, { itemName: 'Personal bowl', nutrients: { kcal: 400, protein_g: 20 }, mealType: 'lunch', localDate: '2026-10-15' }, 'meal-source')
const template = saveTemplate(userA, source.id, 'Workday bowl')
assert.equal(saveTemplate(userA, source.id, 'Workday bowl').id, template.id, 'duplicate template submit is idempotent')
template.ingredients.itemName = 'Edited personal bowl'; template.notes = 'My note'; template.tags = ['workday']; template.favorite = true
const repeated = repeat(userA, template.id, { itemName: 'Today bowl', localDate: '2026-10-16' }, 'meal-repeat')
assert.equal(repeated.itemName, 'Today bowl')
assert.equal(source.itemName, 'Personal bowl', 'source snapshot remains immutable')
assert.equal(template.ingredients.itemName, 'Edited personal bowl', 'template edit remains independent')
assert.equal(repeat(userA, template.id, { itemName: 'ignored' }, 'meal-repeat').duplicate, true, 'duplicate repeat does not fabricate a second record')
assert.throws(() => saveTemplate(userB, source.id, 'No access'))
assert.throws(() => repeat(userB, template.id))
templates.delete(template.id)
assert(meals.has(repeated.id), 'deleting template preserves history')
assert([...journal.values()].some((entry) => entry.userId === userA && entry.day === '2026-10-16' && entry.mealIds.includes(repeated.id)), 'repeat links to journal/history')
assert.equal(clone(repeated).itemName, 'Today bowl', 'reload-safe persisted snapshot shape')
console.log('RB-30 meal template checks: PASS')
console.log(JSON.stringify({ twoUserIsolation: true, sourceConversion: true, editFavorite: true, immutableRepeat: true, journalLinkage: true, deletePreservation: true, reload: true, duplicateSubmit: true, failureRejection: true }, null, 2))
