---
name: peptide-protocol-validator
description: Validates peptide dosing schedules, adherence tracking, and checks for missing doses
category: reset-biology
tags: [peptides, validation, health-tracking]
version: 1.0.0
---

# Peptide Protocol Validator

## Purpose
Validates peptide dosing schedules, tracks adherence, and identifies missing or improperly timed doses in the Reset Biology platform.

## When to Use
- When checking peptide protocol consistency
- When debugging dose timing issues
- When validating user adherence to protocols
- When investigating missing dose logs
- Before deploying changes to peptide tracking system

## Validation Checklist

### 1. Protocol Structure Validation
- [ ] Verify all protocols have valid peptide IDs
- [ ] Check dosage amounts are within safe ranges
- [ ] Validate frequency patterns (daily, twice-daily, etc.)
- [ ] Ensure timing schedules don't overlap inappropriately
- [ ] Confirm duration is set and reasonable

### 2. Dose Timing Validation
- [ ] Check scheduled times are in valid format (HH:MM)
- [ ] Verify doses don't conflict with each other
- [ ] Validate reminder timing (must be before dose time)
- [ ] Ensure timezone handling is correct
- [ ] Check for duplicate scheduled doses

### 3. Adherence Tracking
- [ ] Verify dose logs match scheduled protocols
- [ ] Identify missing doses (scheduled but not logged)
- [ ] Calculate adherence percentage
- [ ] Check for early/late doses (outside tolerance window)
- [ ] Validate streak calculations

### 4. Database Consistency
- [ ] Verify all protocol IDs exist in database
- [ ] Check foreign key relationships (userId, peptideId)
- [ ] Validate JSON structure for nested data
- [ ] Ensure timestamps are properly stored
- [ ] Check for orphaned records

## Implementation Steps

### Step 1: Check Protocol Data Structure
```typescript
// Validate protocol structure
const protocol = await prisma.peptideProtocol.findUnique({
  where: { id: protocolId },
  include: {
    peptide: true,
    user: true
  }
})

// Validation checks
if (!protocol.peptide) throw new Error('Invalid peptide ID')
if (protocol.dosage <= 0) throw new Error('Invalid dosage amount')
if (!protocol.frequency) throw new Error('Missing frequency')
```

### Step 2: Validate Timing Logic
```typescript
// Check for timing conflicts
const times = protocol.scheduledTimes // e.g., ['08:00', '20:00']
times.forEach((time, index) => {
  // Validate format
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid time format: ${time}`)
  }

  // Check for conflicts (at least 4 hours apart)
  for (let i = index + 1; i < times.length; i++) {
    const diff = calculateTimeDiff(time, times[i])
    if (diff < 240) { // 4 hours in minutes
      console.warn(`Doses too close together: ${time} and ${times[i]}`)
    }
  }
})
```

### Step 3: Calculate Adherence
```typescript
// Get scheduled vs logged doses
const startDate = new Date(protocol.startDate)
const endDate = new Date()
const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

const expectedDoses = daysDiff * protocol.frequency
const loggedDoses = await prisma.peptideDoseLog.count({
  where: {
    protocolId: protocol.id,
    loggedAt: {
      gte: startDate,
      lte: endDate
    }
  }
})

const adherence = (loggedDoses / expectedDoses) * 100
console.log(`Adherence: ${adherence.toFixed(1)}%`)
```

### Step 4: Identify Missing Doses
```typescript
// Find gaps in dose logs
const allLogs = await prisma.peptideDoseLog.findMany({
  where: { protocolId: protocol.id },
  orderBy: { scheduledTime: 'asc' }
})

const missingDoses = []
for (let day = 0; day < daysDiff; day++) {
  protocol.scheduledTimes.forEach(time => {
    const expectedDate = addDays(startDate, day)
    const expectedTime = setTime(expectedDate, time)

    const logged = allLogs.find(log =>
      isSameHour(log.scheduledTime, expectedTime)
    )

    if (!logged && expectedTime < new Date()) {
      missingDoses.push({
        date: expectedDate,
        time: time,
        protocolName: protocol.name
      })
    }
  })
}

console.log(`Missing doses: ${missingDoses.length}`)
```

## Common Issues & Fixes

### Issue: Doses not appearing in tracker
**Check:**
1. Verify protocol is active (`active: true`)
2. Check scheduled times are valid
3. Ensure user ID matches session
4. Validate timezone conversions

### Issue: Adherence percentage incorrect
**Check:**
1. Confirm start date is correct
2. Verify frequency multiplier
3. Check for duplicate logs
4. Validate date range calculations

### Issue: Missing dose notifications
**Check:**
1. Verify notification preferences exist
2. Check reminder timing calculation
3. Ensure cron job is running
4. Validate push subscriptions are active

## Testing Scenarios

### Test 1: Valid Protocol
```typescript
const protocol = {
  userId: validUserId,
  peptideId: validPeptideId,
  dosage: 250, // mcg
  frequency: 1, // daily
  scheduledTimes: ['08:00'],
  active: true,
  startDate: new Date()
}
// Expected: Passes all validations
```

### Test 2: Invalid Timing
```typescript
const protocol = {
  // ... valid fields ...
  scheduledTimes: ['08:00', '08:30'] // Too close together
}
// Expected: Warning about timing conflict
```

### Test 3: Missing Doses
```typescript
// Protocol started 7 days ago, twice daily = 14 expected doses
// Only 10 logged
// Expected: 71.4% adherence, 4 missing doses identified
```

## Integration with Existing Code

### Where this skill applies:
- `/app/api/peptides/protocols/route.ts` - Validation on save
- `/app/api/peptides/doses/route.ts` - Validation on dose logging
- `/src/components/Peptides/PeptideTracker.tsx` - Client-side validation
- `/app/api/notifications/send/route.ts` - Scheduling validation

### Add validation middleware:
```typescript
// In protocol save endpoint
import { validateProtocol } from '@/lib/validators/peptide-protocol'

export async function POST(req: Request) {
  const data = await req.json()

  // Validate before saving
  const validation = validateProtocol(data)
  if (!validation.valid) {
    return NextResponse.json({
      error: validation.errors
    }, { status: 400 })
  }

  // Proceed with save...
}
```

## Success Criteria
- [ ] All protocols pass structure validation
- [ ] No timing conflicts detected
- [ ] Adherence calculations are accurate
- [ ] Missing doses are identified correctly
- [ ] Database relationships are intact
- [ ] No orphaned records exist

## Related Skills
- `gamification-calculator` - Points depend on adherence
- `auth0-session-debugger` - User session affects protocol access
- `checkout-flow-tester` - Protocols created after purchase

## Notes
- Tolerance window for "on-time" doses: ±30 minutes
- Minimum time between doses: 4 hours
- Maximum doses per day: 4
- Protocol auto-expires after end date
