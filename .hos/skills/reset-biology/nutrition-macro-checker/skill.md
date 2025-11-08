---
name: nutrition-macro-checker
description: Validates macro tracking, meal logging, and calorie calculations
category: reset-biology
tags: [nutrition, validation, health-tracking]
version: 1.0.0
---

# Nutrition Macro Checker

## Purpose
Validates nutrition tracking data, macro calculations, and meal logging accuracy in the Reset Biology platform.

## When to Use
- When debugging nutrition tracking issues
- When validating calorie/macro calculations
- When checking food database accuracy
- When investigating daily total discrepancies
- Before deploying changes to nutrition system

## Validation Checklist

### 1. Food Entry Validation
- [ ] Verify all required fields are present (name, calories, macros)
- [ ] Check macro totals match calorie calculations
- [ ] Validate portion sizes are reasonable
- [ ] Ensure meal type is valid (breakfast, lunch, dinner, snack)
- [ ] Confirm timestamps are correct

### 2. Macro Calculation Validation
- [ ] Verify calorie calculation: (protein × 4) + (carbs × 4) + (fats × 9)
- [ ] Check macro percentages sum to 100%
- [ ] Validate against standard macro ratios
- [ ] Ensure no negative values
- [ ] Check for unrealistic values (>5000 calories, etc.)

### 3. Daily Totals Validation
- [ ] Verify sum of all entries matches daily total
- [ ] Check for duplicate entries
- [ ] Validate date ranges
- [ ] Ensure user ID consistency
- [ ] Confirm timezone handling

### 4. Food Database Integrity
- [ ] Check for missing nutrition data
- [ ] Validate serving size formats
- [ ] Ensure no duplicate foods
- [ ] Verify custom foods vs. database foods
- [ ] Check for orphaned entries

## Implementation Steps

### Step 1: Validate Food Entry Structure
```typescript
// Validate food entry data
const validateFoodEntry = (entry: FoodEntry) => {
  const errors = []

  // Required fields
  if (!entry.name || entry.name.trim() === '') {
    errors.push('Food name is required')
  }

  if (entry.calories === undefined || entry.calories < 0) {
    errors.push('Valid calorie count required')
  }

  if (entry.protein === undefined || entry.protein < 0) {
    errors.push('Valid protein amount required')
  }

  if (entry.carbs === undefined || entry.carbs < 0) {
    errors.push('Valid carbs amount required')
  }

  if (entry.fats === undefined || entry.fats < 0) {
    errors.push('Valid fats amount required')
  }

  // Meal type validation
  const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack']
  if (!validMealTypes.includes(entry.mealType)) {
    errors.push(`Invalid meal type: ${entry.mealType}`)
  }

  return { valid: errors.length === 0, errors }
}
```

### Step 2: Validate Macro Calculations
```typescript
// Check if macros match calories
const validateMacroCalculation = (entry: FoodEntry) => {
  const calculatedCalories =
    (entry.protein * 4) +
    (entry.carbs * 4) +
    (entry.fats * 9)

  const difference = Math.abs(calculatedCalories - entry.calories)
  const tolerance = 5 // 5 calorie tolerance

  if (difference > tolerance) {
    console.warn(
      `Macro/calorie mismatch for "${entry.name}": ` +
      `Stated: ${entry.calories}cal, Calculated: ${calculatedCalories}cal`
    )
    return false
  }

  return true
}
```

### Step 3: Calculate Daily Totals
```typescript
// Aggregate daily nutrition data
const calculateDailyTotals = async (userId: string, date: Date) => {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const entries = await prisma.foodEntry.findMany({
    where: {
      userId,
      loggedAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  })

  const totals = entries.reduce((acc, entry) => ({
    calories: acc.calories + entry.calories,
    protein: acc.protein + entry.protein,
    carbs: acc.carbs + entry.carbs,
    fats: acc.fats + entry.fats
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 })

  // Validate calculated vs. expected
  const recalculated =
    (totals.protein * 4) +
    (totals.carbs * 4) +
    (totals.fats * 9)

  if (Math.abs(recalculated - totals.calories) > 10) {
    console.warn(`Daily total mismatch: ${totals.calories} vs ${recalculated}`)
  }

  return totals
}
```

### Step 4: Check for Data Anomalies
```typescript
// Identify suspicious entries
const checkForAnomalies = (entry: FoodEntry) => {
  const warnings = []

  // Unrealistic calorie counts
  if (entry.calories > 5000) {
    warnings.push('Unusually high calorie count')
  }

  // Impossible macro ratios
  const totalMacroWeight = entry.protein + entry.carbs + entry.fats
  if (totalMacroWeight > 1000) { // grams
    warnings.push('Unusually high macro totals')
  }

  // All zeros
  if (entry.calories === 0 && entry.protein === 0 &&
      entry.carbs === 0 && entry.fats === 0) {
    warnings.push('Entry has no nutritional data')
  }

  // Protein > 100% of calories (impossible)
  if ((entry.protein * 4) > entry.calories) {
    warnings.push('Protein exceeds total calories')
  }

  return warnings
}
```

## Common Issues & Fixes

### Issue: Daily totals don't match individual entries
**Check:**
1. Verify timezone conversions
2. Check for hidden/deleted entries
3. Ensure date range includes all entries
4. Validate user ID filter

**Fix:**
```typescript
// Recalculate and update totals
const entries = await prisma.foodEntry.findMany({
  where: { userId, date: targetDate }
})

const correct = entries.reduce((sum, e) => sum + e.calories, 0)
console.log(`Correct total: ${correct}`)
```

### Issue: Macro percentages don't add to 100%
**Check:**
1. Verify rounding logic
2. Check calculation method
3. Ensure all macros are included

**Fix:**
```typescript
// Calculate percentages correctly
const totalMacroCalories =
  (protein * 4) + (carbs * 4) + (fats * 9)

const percentages = {
  protein: (protein * 4 / totalMacroCalories) * 100,
  carbs: (carbs * 4 / totalMacroCalories) * 100,
  fats: (fats * 9 / totalMacroCalories) * 100
}
```

### Issue: Food database entries inconsistent
**Check:**
1. Verify serving size units
2. Check for duplicate entries
3. Validate import data

**Fix:**
```typescript
// Deduplicate foods
const foods = await prisma.food.findMany()
const seen = new Set()
const duplicates = foods.filter(f => {
  const key = f.name.toLowerCase().trim()
  if (seen.has(key)) return true
  seen.add(key)
  return false
})
```

## Testing Scenarios

### Test 1: Valid Food Entry
```typescript
const entry = {
  name: 'Chicken Breast',
  calories: 165,
  protein: 31,
  carbs: 0,
  fats: 3.6,
  mealType: 'lunch'
}
// Expected: Passes validation
// Calculated: (31*4) + (0*4) + (3.6*9) = 156.4 ≈ 165 ✓
```

### Test 2: Invalid Macro Calculation
```typescript
const entry = {
  name: 'Mystery Food',
  calories: 500,
  protein: 10,
  carbs: 10,
  fats: 10,
  mealType: 'dinner'
}
// Expected: Warning - macros don't match calories
// Calculated: (10*4) + (10*4) + (10*9) = 170 ≠ 500 ✗
```

### Test 3: Daily Total Validation
```typescript
// Three meals logged
const breakfast = { calories: 400, protein: 20, carbs: 50, fats: 12 }
const lunch = { calories: 600, protein: 40, carbs: 60, fats: 20 }
const dinner = { calories: 700, protein: 45, carbs: 70, fats: 25 }

// Expected daily total: 1700 calories
// Expected: All calculations match
```

## Integration with Existing Code

### Where this skill applies:
- `/app/api/nutrition/entries/route.ts` - Validation on save
- `/app/api/nutrition/foods/route.ts` - Food database validation
- `/src/components/Nutrition/NutritionTracker.tsx` - Client-side validation
- `/app/api/gamification/points/route.ts` - Points for logging

### Add validation middleware:
```typescript
// In nutrition entries endpoint
import { validateFoodEntry, validateMacros } from '@/lib/validators/nutrition'

export async function POST(req: Request) {
  const entry = await req.json()

  // Validate structure
  const validation = validateFoodEntry(entry)
  if (!validation.valid) {
    return NextResponse.json({
      error: validation.errors
    }, { status: 400 })
  }

  // Validate macros
  if (!validateMacros(entry)) {
    return NextResponse.json({
      error: 'Macro calculations do not match calories'
    }, { status: 400 })
  }

  // Proceed with save...
}
```

## Success Criteria
- [ ] All food entries pass structure validation
- [ ] Macro calculations are accurate (±5 calorie tolerance)
- [ ] Daily totals match sum of entries
- [ ] No duplicate food entries exist
- [ ] No negative or unrealistic values
- [ ] Gamification points awarded correctly (10 pts/day)

## Related Skills
- `gamification-calculator` - Points for daily logging
- `workout-form-validator` - Similar validation patterns
- `peptide-protocol-validator` - Tracking consistency

## Notes
- Calorie calculation: (P × 4) + (C × 4) + (F × 9)
- Tolerance for rounding: ±5 calories
- Standard serving sizes should use grams
- Custom foods should be clearly marked
- Daily logging awards 10 gamification points
