---
name: gamification-calculator
description: Calculates points, streaks, tier upgrades, and validates achievement logic
category: reset-biology
tags: [gamification, points, achievements]
version: 1.0.0
---

# Gamification Calculator

## Purpose
Validates gamification logic, calculates points/streaks/tiers, and ensures achievement system accuracy in the Reset Biology platform.

## When to Use
- When debugging points not being awarded
- When validating tier upgrade logic
- When checking streak calculations
- When investigating achievement unlocks
- Before deploying changes to gamification system

## Validation Checklist

### 1. Points Calculation
- [ ] Verify points awarded match activity type
- [ ] Check multipliers are applied correctly
- [ ] Validate streak bonuses
- [ ] Ensure no duplicate point entries
- [ ] Confirm user ID is correct

### 2. Streak Tracking
- [ ] Verify daily activity is counted
- [ ] Check for missed days
- [ ] Validate streak reset logic
- [ ] Ensure timezone handling is correct
- [ ] Confirm longest streak tracking

### 3. Tier System
- [ ] Check current point total
- [ ] Validate tier thresholds
- [ ] Ensure tier upgrades trigger correctly
- [ ] Verify tier benefits are applied
- [ ] Confirm tier display is accurate

### 4. Achievement Logic
- [ ] Verify unlock conditions
- [ ] Check for duplicate achievements
- [ ] Validate achievement timestamps
- [ ] Ensure proper notification on unlock
- [ ] Confirm achievement display

## Points System Rules

### Base Points by Activity:
- **Workout logged**: 50 points
- **Nutrition logged (daily)**: 10 points
- **Peptide dose logged**: 5 points
- **Breath session completed**: 20 points
- **Journal entry**: 10 points
- **Module completed**: 100 points

### Streak Bonuses:
- **7-day streak**: +50 points
- **30-day streak**: +250 points
- **100-day streak**: +1,000 points

### Tier Thresholds:
- **Bronze**: 0-999 points
- **Silver**: 1,000-4,999 points
- **Gold**: 5,000-14,999 points
- **Platinum**: 15,000+ points

## Implementation Steps

### Step 1: Calculate Points for Activity
```typescript
// Award points for specific activity
const awardPoints = async (
  userId: string,
  activityType: string,
  metadata?: any
) => {
  // Define point values
  const pointValues: Record<string, number> = {
    workout: 50,
    nutrition_daily: 10,
    peptide_dose: 5,
    breath_session: 20,
    journal_entry: 10,
    module_complete: 100
  }

  const basePoints = pointValues[activityType] || 0

  if (basePoints === 0) {
    throw new Error(`Unknown activity type: ${activityType}`)
  }

  // Check for streak bonus
  const streak = await getCurrentStreak(userId)
  let bonusMultiplier = 1

  if (streak >= 100) bonusMultiplier = 2.0
  else if (streak >= 30) bonusMultiplier = 1.5
  else if (streak >= 7) bonusMultiplier = 1.2

  const totalPoints = Math.round(basePoints * bonusMultiplier)

  // Save points
  await prisma.gamificationPoint.create({
    data: {
      userId,
      points: totalPoints,
      source: activityType,
      metadata: metadata || {},
      earnedAt: new Date()
    }
  })

  console.log(`Awarded ${totalPoints} points for ${activityType}`)

  // Check for tier upgrade
  await checkTierUpgrade(userId)

  return totalPoints
}
```

### Step 2: Calculate Current Streak
```typescript
// Calculate user's current activity streak
const getCurrentStreak = async (userId: string): Promise<number> => {
  // Get all point records ordered by date
  const points = await prisma.gamificationPoint.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' }
  })

  if (points.length === 0) return 0

  // Group by day
  const dayMap = new Map<string, boolean>()
  points.forEach(point => {
    const day = point.earnedAt.toISOString().split('T')[0]
    dayMap.set(day, true)
  })

  // Count consecutive days from today backwards
  let streak = 0
  let currentDate = new Date()

  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0]

    if (dayMap.has(dateStr)) {
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}
```

### Step 3: Check Tier Upgrade
```typescript
// Check if user has reached new tier
const checkTierUpgrade = async (userId: string) => {
  // Calculate total points
  const result = await prisma.gamificationPoint.aggregate({
    where: { userId },
    _sum: { points: true }
  })

  const totalPoints = result._sum.points || 0

  // Determine tier
  let newTier: string
  if (totalPoints >= 15000) newTier = 'platinum'
  else if (totalPoints >= 5000) newTier = 'gold'
  else if (totalPoints >= 1000) newTier = 'silver'
  else newTier = 'bronze'

  // Get current tier
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gamificationTier: true }
  })

  // Check for upgrade
  if (!user?.gamificationTier || user.gamificationTier !== newTier) {
    await prisma.user.update({
      where: { id: userId },
      data: { gamificationTier: newTier }
    })

    console.log(`🎉 Tier upgraded to ${newTier.toUpperCase()}!`)

    // Award bonus points for tier upgrade
    if (newTier === 'silver') await awardPoints(userId, 'tier_upgrade', { tier: 'silver', bonus: 100 })
    if (newTier === 'gold') await awardPoints(userId, 'tier_upgrade', { tier: 'gold', bonus: 500 })
    if (newTier === 'platinum') await awardPoints(userId, 'tier_upgrade', { tier: 'platinum', bonus: 1500 })

    // TODO: Send notification
  }

  return newTier
}
```

### Step 4: Validate Points Integrity
```typescript
// Check for point calculation errors
const validatePointsIntegrity = async (userId: string) => {
  const issues = []

  // Check for duplicate entries
  const points = await prisma.gamificationPoint.findMany({
    where: { userId },
    orderBy: { earnedAt: 'asc' }
  })

  // Look for suspiciously close timestamps (< 1 second apart, same source)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]

    const timeDiff = curr.earnedAt.getTime() - prev.earnedAt.getTime()

    if (timeDiff < 1000 && prev.source === curr.source) {
      issues.push({
        type: 'possible_duplicate',
        id1: prev.id,
        id2: curr.id,
        source: curr.source,
        timeDiff
      })
    }
  }

  // Check for negative points
  const negativePoints = points.filter(p => p.points < 0)
  if (negativePoints.length > 0) {
    issues.push({
      type: 'negative_points',
      count: negativePoints.length,
      entries: negativePoints.map(p => p.id)
    })
  }

  // Check for unrealistic point values
  const unrealistic = points.filter(p => p.points > 10000)
  if (unrealistic.length > 0) {
    issues.push({
      type: 'unrealistic_points',
      entries: unrealistic.map(p => ({ id: p.id, points: p.points }))
    })
  }

  return issues
}
```

## Common Issues & Fixes

### Issue: Points not being awarded
**Check:**
1. Verify activity endpoint calls `awardPoints()`
2. Check user ID is correct
3. Ensure no duplicate checks are blocking
4. Validate database write succeeded

**Fix:**
```typescript
// Add to activity endpoint
try {
  await awardPoints(userId, 'workout', { duration: session.duration })
} catch (error) {
  console.error('Failed to award points:', error)
  // Still save the activity even if points fail
}
```

### Issue: Streak not counting properly
**Check:**
1. Verify timezone handling
2. Check for activity on each day
3. Ensure date grouping logic is correct

**Fix:**
```typescript
// Use UTC dates for consistency
const dateStr = currentDate.toISOString().split('T')[0]
```

### Issue: Tier not upgrading
**Check:**
1. Verify total points calculation
2. Check tier thresholds
3. Ensure user record updates

**Fix:**
```typescript
// Force recalculation
const totalPoints = await prisma.gamificationPoint.aggregate({
  where: { userId },
  _sum: { points: true }
})

const tier = calculateTier(totalPoints._sum.points || 0)
await prisma.user.update({
  where: { id: userId },
  data: { gamificationTier: tier }
})
```

## Testing Scenarios

### Test 1: Workout Points Award
```typescript
// Log workout
await logWorkout(userId, workoutData)

// Check points awarded
const points = await prisma.gamificationPoint.findFirst({
  where: { userId, source: 'workout' },
  orderBy: { earnedAt: 'desc' }
})

// Expected: 50 points (or more with streak bonus)
assert(points.points >= 50)
```

### Test 2: Streak Calculation
```typescript
// Log activity for 7 consecutive days
for (let i = 0; i < 7; i++) {
  await awardPoints(userId, 'workout', {})
  // Advance to next day
}

const streak = await getCurrentStreak(userId)
// Expected: 7 days
assert(streak === 7)
```

### Test 3: Tier Upgrade
```typescript
// Award enough points to reach Silver (1,000)
await awardPoints(userId, 'workout', {}) // 50
await awardPoints(userId, 'workout', {}) // 100
// ... repeat 20 times to reach 1,000

const user = await prisma.user.findUnique({ where: { id: userId } })
// Expected: tier = 'silver'
assert(user.gamificationTier === 'silver')
```

## Integration with Existing Code

### Where this skill applies:
- `/app/api/workout/sessions/route.ts` - Award 50 points
- `/app/api/nutrition/entries/route.ts` - Award 10 points (daily)
- `/app/api/peptides/doses/route.ts` - Award 5 points
- `/app/api/breath/sessions/route.ts` - Award 20 points
- `/app/api/journal/entry/route.ts` - Award 10 points

### Add points middleware:
```typescript
// In activity endpoint
import { awardPoints } from '@/lib/gamification'

export async function POST(req: Request) {
  // ... save activity ...

  // Award points
  try {
    await awardPoints(user.id, 'workout', {
      duration: session.duration
    })
  } catch (error) {
    console.error('Points award failed:', error)
    // Don't block the activity save
  }

  return NextResponse.json({ success: true })
}
```

## Success Criteria
- [ ] Points awarded correctly for all activities
- [ ] Streak calculations are accurate
- [ ] Tier upgrades trigger at correct thresholds
- [ ] No duplicate point entries
- [ ] Bonuses applied correctly
- [ ] User notifications sent on milestones

## Related Skills
- `peptide-protocol-validator` - Awards 5 points per dose
- `nutrition-macro-checker` - Awards 10 points daily
- `workout-form-validator` - Awards 50 points per workout

## Notes
- Points are cumulative (never reset)
- Streaks reset if a day is missed
- Tier bonuses compound with streak bonuses
- Maximum possible daily points: ~500 (varied activities + streaks)
- Achievements are separate from points (unlocked by specific milestones)
