---
name: workout-form-validator
description: Validates exercise logging, set/rep tracking, and workout progress
category: reset-biology
tags: [workout, validation, fitness-tracking]
version: 1.0.0
---

# Workout Form Validator

## Purpose
Validates workout session data, exercise logging, and progress tracking in the Reset Biology platform.

## When to Use
- When debugging workout tracking issues
- When validating set/rep/weight logging
- When checking exercise database accuracy
- When investigating progress calculation errors
- Before deploying changes to workout system

## Validation Checklist

### 1. Workout Session Validation
- [ ] Verify all required fields are present
- [ ] Check session duration is reasonable
- [ ] Validate exercise array structure
- [ ] Ensure user ID is correct
- [ ] Confirm timestamps are accurate

### 2. Exercise Data Validation
- [ ] Verify exercise exists in database
- [ ] Check sets/reps are positive integers
- [ ] Validate weight values are realistic
- [ ] Ensure rest periods are reasonable
- [ ] Confirm exercise type (strength, cardio, flexibility)

### 3. Progress Tracking Validation
- [ ] Check volume calculations (sets × reps × weight)
- [ ] Validate personal records (PRs)
- [ ] Ensure progressive overload is tracked
- [ ] Verify rest day calculations
- [ ] Confirm streak tracking

### 4. Exercise Library Integrity
- [ ] Check for duplicate exercises
- [ ] Validate muscle group assignments
- [ ] Ensure equipment tags are correct
- [ ] Verify difficulty levels
- [ ] Confirm exercise descriptions exist

## Implementation Steps

### Step 1: Validate Workout Session Structure
```typescript
// Validate workout session data
const validateWorkoutSession = (session: WorkoutSession) => {
  const errors = []

  // Required fields
  if (!session.userId) {
    errors.push('User ID is required')
  }

  if (!session.exercises || session.exercises.length === 0) {
    errors.push('At least one exercise is required')
  }

  if (!session.duration || session.duration <= 0) {
    errors.push('Valid duration required (minutes)')
  }

  // Duration sanity check (no 24-hour workouts!)
  if (session.duration > 300) { // 5 hours
    errors.push('Duration exceeds reasonable limit')
  }

  // Validate each exercise
  session.exercises.forEach((exercise, index) => {
    const exerciseErrors = validateExercise(exercise)
    if (exerciseErrors.length > 0) {
      errors.push(`Exercise ${index + 1}: ${exerciseErrors.join(', ')}`)
    }
  })

  return { valid: errors.length === 0, errors }
}
```

### Step 2: Validate Exercise Data
```typescript
// Validate individual exercise entry
const validateExercise = (exercise: Exercise) => {
  const errors = []

  // Exercise name/ID
  if (!exercise.name && !exercise.exerciseId) {
    errors.push('Exercise name or ID required')
  }

  // Sets validation
  if (!exercise.sets || !Array.isArray(exercise.sets)) {
    errors.push('Sets array required')
  } else {
    exercise.sets.forEach((set, index) => {
      // Reps validation
      if (set.reps === undefined || set.reps <= 0 || set.reps > 1000) {
        errors.push(`Set ${index + 1}: Invalid reps (${set.reps})`)
      }

      // Weight validation (if applicable)
      if (set.weight !== undefined) {
        if (set.weight < 0 || set.weight > 1500) { // lbs
          errors.push(`Set ${index + 1}: Invalid weight (${set.weight} lbs)`)
        }
      }

      // Rest period validation
      if (set.restSeconds !== undefined) {
        if (set.restSeconds < 0 || set.restSeconds > 600) { // 10 min max
          errors.push(`Set ${index + 1}: Invalid rest period`)
        }
      }
    })
  }

  return errors
}
```

### Step 3: Calculate Workout Volume
```typescript
// Calculate total volume for strength exercises
const calculateVolume = (exercise: Exercise): number => {
  if (!exercise.sets) return 0

  return exercise.sets.reduce((total, set) => {
    const weight = set.weight || 0
    const reps = set.reps || 0
    return total + (weight * reps)
  }, 0)
}

// Validate volume calculation
const validateVolume = (session: WorkoutSession) => {
  session.exercises.forEach(exercise => {
    const volume = calculateVolume(exercise)

    // Sanity check - no one lifts 100,000 lbs in one exercise
    if (volume > 100000) {
      console.warn(
        `Unusually high volume for ${exercise.name}: ${volume} lbs`
      )
    }

    // Check for progressive overload
    const lastSession = getPreviousSession(exercise.exerciseId)
    if (lastSession && volume > 0) {
      const improvement = ((volume - lastSession.volume) / lastSession.volume) * 100
      console.log(`Progress: ${improvement.toFixed(1)}% volume increase`)
    }
  })
}
```

### Step 4: Validate Personal Records
```typescript
// Check if new PR was achieved
const validatePersonalRecord = async (
  userId: string,
  exerciseId: string,
  newWeight: number,
  newReps: number
) => {
  // Get user's previous best
  const previousBest = await prisma.workoutSession.findFirst({
    where: {
      userId,
      exercises: {
        path: '$[*].exerciseId',
        equals: exerciseId
      }
    },
    orderBy: { completedAt: 'desc' }
  })

  // Calculate 1RM (one-rep max) estimate
  // Formula: weight × (1 + reps/30)
  const new1RM = newWeight * (1 + newReps / 30)

  if (!previousBest) {
    console.log(`First time logging ${exerciseId} - establishing baseline`)
    return true
  }

  // Compare to previous best
  const prevExercise = previousBest.exercises.find(
    e => e.exerciseId === exerciseId
  )

  if (prevExercise) {
    const prevBestSet = prevExercise.sets.reduce((max, set) => {
      const est1RM = set.weight * (1 + set.reps / 30)
      return est1RM > max ? est1RM : max
    }, 0)

    if (new1RM > prevBestSet) {
      console.log(`🎉 New PR! ${new1RM.toFixed(0)} lbs (prev: ${prevBestSet.toFixed(0)})`)
      return true
    }
  }

  return false
}
```

## Common Issues & Fixes

### Issue: Sets/reps not saving
**Check:**
1. Verify JSON structure is correct
2. Check array is not empty
3. Ensure data types are correct (numbers, not strings)
4. Validate session is committed to database

**Fix:**
```typescript
// Ensure proper structure
const exercise = {
  exerciseId: 'bench-press',
  name: 'Bench Press',
  sets: [
    { reps: 10, weight: 135, restSeconds: 90 },
    { reps: 8, weight: 155, restSeconds: 90 },
    { reps: 6, weight: 185, restSeconds: 120 }
  ]
}
```

### Issue: Duration calculation wrong
**Check:**
1. Verify start/end timestamps
2. Check for timezone issues
3. Ensure manual duration input is validated

**Fix:**
```typescript
// Calculate duration from timestamps
const duration = Math.round(
  (session.endTime - session.startTime) / (1000 * 60)
)

// Validate
if (duration < 1 || duration > 300) {
  throw new Error(`Invalid duration: ${duration} minutes`)
}
```

### Issue: Exercise not found in database
**Check:**
1. Verify exercise ID exists
2. Check for typos in exercise name
3. Ensure exercise wasn't deleted

**Fix:**
```typescript
// Validate exercise exists before logging
const exercise = await prisma.exercise.findUnique({
  where: { id: exerciseId }
})

if (!exercise) {
  throw new Error(`Exercise not found: ${exerciseId}`)
}
```

## Testing Scenarios

### Test 1: Valid Strength Workout
```typescript
const session = {
  userId: validUserId,
  duration: 45,
  exercises: [
    {
      exerciseId: 'bench-press',
      name: 'Bench Press',
      sets: [
        { reps: 10, weight: 135, restSeconds: 90 },
        { reps: 8, weight: 155, restSeconds: 90 },
        { reps: 6, weight: 185, restSeconds: 120 }
      ]
    }
  ],
  completedAt: new Date()
}
// Expected: Passes validation, volume = 3,570 lbs
```

### Test 2: Invalid Weight Entry
```typescript
const session = {
  // ... valid fields ...
  exercises: [{
    sets: [
      { reps: 10, weight: -50 } // Invalid negative weight
    ]
  }]
}
// Expected: Validation error
```

### Test 3: Progressive Overload Check
```typescript
// Previous session: 3 sets × 10 reps × 135 lbs = 4,050 lbs
// Current session: 3 sets × 10 reps × 145 lbs = 4,350 lbs
// Expected: 7.4% volume increase, log progress
```

## Integration with Existing Code

### Where this skill applies:
- `/app/api/workout/sessions/route.ts` - Validation on save
- `/app/api/workout/exercises/route.ts` - Exercise database validation
- `/src/components/Workout/WorkoutTracker.tsx` - Client-side validation
- `/app/api/gamification/points/route.ts` - Points for workouts (50 pts)

### Add validation middleware:
```typescript
// In workout sessions endpoint
import { validateWorkoutSession, validateExercise } from '@/lib/validators/workout'

export async function POST(req: Request) {
  const session = await req.json()

  // Validate structure
  const validation = validateWorkoutSession(session)
  if (!validation.valid) {
    return NextResponse.json({
      error: validation.errors
    }, { status: 400 })
  }

  // Calculate volume
  session.exercises.forEach(exercise => {
    exercise.volume = calculateVolume(exercise)
  })

  // Check for PRs
  for (const exercise of session.exercises) {
    const isPR = await validatePersonalRecord(
      session.userId,
      exercise.exerciseId,
      Math.max(...exercise.sets.map(s => s.weight)),
      Math.max(...exercise.sets.map(s => s.reps))
    )

    if (isPR) {
      exercise.isPersonalRecord = true
    }
  }

  // Proceed with save...
}
```

## Success Criteria
- [ ] All workout sessions pass structure validation
- [ ] Set/rep/weight data is within realistic ranges
- [ ] Volume calculations are accurate
- [ ] Personal records are identified correctly
- [ ] Exercise library has no duplicates
- [ ] Gamification points awarded correctly (50 pts/workout)

## Related Skills
- `gamification-calculator` - Points for workout completion
- `nutrition-macro-checker` - Similar validation patterns
- `peptide-protocol-validator` - Tracking consistency

## Notes
- 1RM estimation formula: weight × (1 + reps/30)
- Typical rest periods: 60-180 seconds
- Maximum realistic workout duration: 5 hours
- Workout awards 50 gamification points
- Volume = sets × reps × weight
- Progressive overload: increase volume by 2-10% per session
