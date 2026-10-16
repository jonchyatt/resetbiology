#!/usr/bin/env node
import assert from 'node:assert/strict'

const nutrientKeys = ['kcal', 'protein_g', 'carb_g', 'fat_g']
function validateIngredient(item) {
  if (!item || !item.name?.trim() || !item.unit?.trim() || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) return false
  return nutrientKeys.every((key) => Number.isFinite(Number(item.nutrients?.[key] ?? 0)) && Number(item.nutrients?.[key] ?? 0) >= 0)
}
function totals(ingredients) {
  return nutrientKeys.reduce((out, key) => { out[key] = ingredients.reduce((sum, item) => sum + Number(item.nutrients[key]), 0); return out }, {})
}
function logMeal(store, userId, recipe, servings, requestId) {
  if (!Number.isFinite(servings) || servings <= 0 || !requestId) throw new Error('invalid meal')
  const existing = store.meals.find((meal) => meal.userId === userId && meal.requestId === requestId)
  if (existing) return existing
  const meal = { userId, requestId, recipeSnapshot: structuredClone(recipe), servings, nutrients: Object.fromEntries(nutrientKeys.map((key) => [key, recipe.totals[key] * servings / recipe.servings])) }
  store.meals.push(meal); store.journal.push({ userId, mealId: requestId, recipeName: recipe.name }); return meal
}

const a = { userId: 'A', recipes: [], meals: [], journal: [] }
const b = { userId: 'B', recipes: [], meals: [], journal: [] }
const ingredients = [{ name: 'Oats', quantity: 50, unit: 'g', notes: 'rolled', nutrients: { kcal: 190, protein_g: 6, carb_g: 32, fat_g: 3.5 } }, { name: 'Milk', quantity: 200, unit: 'ml', notes: '', nutrients: { kcal: 100, protein_g: 7, carb_g: 10, fat_g: 3 } }]
assert.ok(ingredients.every(validateIngredient), 'valid ingredients accepted')
assert.deepEqual(totals(ingredients), { kcal: 290, protein_g: 13, carb_g: 42, fat_g: 6.5 }, 'totals are arithmetic')
const recipe = { id: 'r1', name: 'Overnight oats', servings: 2, ingredients, totals: totals(ingredients), archived: false }
a.recipes.push(recipe)
assert.equal(b.recipes.some((item) => item.id === recipe.id), false, 'two-user isolation')
const first = logMeal(a, 'A', recipe, 1.5, 'req-1')
assert.equal(first.nutrients.kcal, 217.5, 'serving arithmetic')
assert.equal(a.journal.length, 1, 'journal linkage')
const retry = logMeal(a, 'A', recipe, 1.5, 'req-1')
assert.equal(retry, first, 'duplicate retry is idempotent')
recipe.ingredients[0].quantity = 75
recipe.totals.kcal = 380
recipe.archived = true
assert.equal(first.recipeSnapshot.ingredients[0].quantity, 50, 'snapshot remains immutable after edit/archive')
assert.equal(first.recipeSnapshot.totals.kcal, 290, 'snapshot nutrition remains immutable')
assert.equal(validateIngredient({ name: '', quantity: 1, unit: 'g', nutrients: {} }), false, 'empty ingredient rejected')
assert.equal(validateIngredient({ name: 'Bad', quantity: 'nope', unit: 'g', nutrients: {} }), false, 'malformed quantity rejected')
assert.throws(() => logMeal(a, 'A', recipe, 0, 'req-2'), /invalid meal/, 'invalid servings rejected')
assert.equal(a.recipes.some((item) => item.id === 'does-not-exist'), false, 'deleted source does not fabricate a recipe')
assert.equal(logMeal(a, 'A', recipe, 1, 'req-3').userId, 'A', 'offline/failure path only records after valid call')
assert.equal(a.meals.some((meal) => meal.userId === 'B'), false, 'cross-user records denied')
console.log('recipe-builder-check: PASS (10 assertions)')
