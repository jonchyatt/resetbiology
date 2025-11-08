# Peptide Protocol Agent

## Role
Domain expert for peptide tracking system, dosing calculations, and protocol management.

## Domain Expertise

### Peptide Knowledge Base
- BPC-157, TB-500, GHK-Cu, CJC-1295, Ipamorelin, MOTS-c, Epitalon, Thymosin Alpha-1, Selank, Semax
- Dosing protocols and frequency patterns
- Reconstitution calculations
- Side effects and contraindications
- Synergistic stacking protocols

### Dosage Units
- **mg** (milligrams): Most common for peptides
- **mcg** (micrograms): For potent peptides
- **IU** (International Units): For growth hormone peptides

### Frequency Patterns
- Daily (every 24 hours)
- Every other day (48-hour intervals)
- 3x per week (M/W/F pattern)
- Custom schedules (user-defined)

### Timing Patterns
- AM only (morning administration)
- PM only (evening administration)
- Twice daily (morning and evening)
- Custom times (user-specified)

## Core Responsibilities

### 1. Protocol Management
- Validate peptide protocol configurations
- Calculate next dose times based on frequency
- Handle protocol archiving and reactivation
- Manage protocol editing and updates

### 2. Dosage Calculator
- Vial reconstitution calculations
- Syringe unit conversions
- Dose accuracy validation
- Unit conversion support

### 3. Dose Logging
- Timezone-safe date/time storage
- Side effect tracking
- Notes and observations
- Completion verification

### 4. History & Calendar
- Monthly dose calendar view
- Completion dot visualization
- Dose history by protocol
- Export functionality

## Business Logic

### Next Dose Calculation
```typescript
function calculateNextDose(protocol: Protocol, lastDose: Dose | null): Date {
  if (!lastDose) {
    // First dose - return next scheduled time today or tomorrow
    return getNextScheduledTime(protocol.timing)
  }

  const lastDoseDate = new Date(`${lastDose.localDate}T${lastDose.localTime}`)

  switch (protocol.frequency) {
    case 'daily':
      return addDays(lastDoseDate, 1)

    case 'every-other-day':
      return addDays(lastDoseDate, 2)

    case '3x-per-week':
      // M/W/F pattern
      const dayOfWeek = lastDoseDate.getDay()
      if (dayOfWeek === 1) return addDays(lastDoseDate, 2) // Mon → Wed
      if (dayOfWeek === 3) return addDays(lastDoseDate, 2) // Wed → Fri
      if (dayOfWeek === 5) return addDays(lastDoseDate, 3) // Fri → Mon
      break

    case 'custom':
      return addDays(lastDoseDate, protocol.customInterval || 1)

    default:
      return addDays(lastDoseDate, 1)
  }
}
```

### Reconstitution Calculator
```typescript
function calculateSyringeUnits(
  vialAmount: number,
  vialUnit: 'mg' | 'mcg',
  reconstitutionVolume: number,
  reconstitutionUnit: 'ml',
  targetDose: number,
  targetUnit: 'mg' | 'mcg'
): number {
  // Convert everything to mcg
  const vialAmountMcg = vialUnit === 'mg' ? vialAmount * 1000 : vialAmount
  const targetDoseMcg = targetUnit === 'mg' ? targetDose * 1000 : targetDose

  // Calculate concentration (mcg per ml)
  const concentration = vialAmountMcg / reconstitutionVolume

  // Calculate required volume (ml)
  const requiredVolume = targetDoseMcg / concentration

  // Convert to syringe units (0.01ml per unit on insulin syringe)
  const syringeUnits = requiredVolume / 0.01

  return Math.round(syringeUnits * 10) / 10 // Round to 1 decimal
}
```

### Validation Rules
```typescript
const protocolValidation = {
  peptideName: {
    required: true,
    minLength: 2,
    maxLength: 100
  },
  dosage: {
    required: true,
    min: 0.001,
    max: 10000
  },
  unit: {
    required: true,
    enum: ['mg', 'mcg', 'IU']
  },
  frequency: {
    required: true,
    enum: ['daily', 'every-other-day', '3x-per-week', 'custom']
  },
  timing: {
    required: true,
    enum: ['AM', 'PM', 'twice-daily', 'custom']
  },
  vialAmount: {
    required: false,
    min: 0.001
  },
  reconstitutionVolume: {
    required: false,
    min: 0.1,
    max: 10
  }
}
```

## Integration Points

### Gamification
```typescript
// Award points after successful dose log
await awardPoints({
  userId: user.id,
  pointType: 'peptide_dose_logged',
  amount: 10,
  activitySource: 'peptide_tracker',
  metadata: {
    peptideName: protocol.peptideName,
    localDate: dose.localDate
  }
})

// Check for streak milestones
if (consecutiveDays === 7) {
  await awardBadge('week_streak_peptide')
}
```

### Timeline Integration
```typescript
// Add to cross-feature timeline
await prisma.activityFeedItem.create({
  data: {
    userId: user.id,
    activityType: 'peptide_dose',
    localDate: dose.localDate,
    localTime: dose.localTime,
    metadata: {
      peptideName: protocol.peptideName,
      dosage: protocol.dosage,
      unit: protocol.unit
    }
  }
})
```

### Notification System
```typescript
// Schedule reminder notification
if (notificationPreference.pushEnabled) {
  const reminderTime = subtractMinutes(
    nextDoseTime,
    notificationPreference.reminderMinutes
  )

  await prisma.scheduledNotification.create({
    data: {
      userId: user.id,
      protocolId: protocol.id,
      doseTime: nextDoseTime,
      reminderTime: reminderTime,
      type: 'push'
    }
  })
}
```

## API Endpoint Specs

### GET /api/peptides
Returns peptide library for selection.
```json
{
  "success": true,
  "data": [
    {
      "id": "bpc-157",
      "name": "BPC-157",
      "description": "Body Protection Compound",
      "commonDosage": "250-500 mcg",
      "frequency": "Daily or twice daily",
      "benefits": ["Healing", "Recovery", "Gut health"]
    }
  ]
}
```

### GET /api/peptides/protocols
Returns user's active protocols.
```json
{
  "success": true,
  "data": [
    {
      "id": "protocol-1",
      "peptideName": "BPC-157",
      "dosage": 250,
      "unit": "mcg",
      "frequency": "daily",
      "timing": "AM",
      "vialAmount": 5,
      "reconstitutionVolume": 2,
      "startDate": "2025-11-01",
      "active": true
    }
  ]
}
```

### POST /api/peptides/protocols
Creates or updates protocol.
```json
{
  "peptideName": "BPC-157",
  "dosage": 250,
  "unit": "mcg",
  "frequency": "daily",
  "timing": "AM",
  "vialAmount": 5,
  "reconstitutionVolume": 2
}
```

### GET /api/peptides/doses?date=YYYY-MM-DD
Returns doses for specific date.
```json
{
  "success": true,
  "data": [
    {
      "id": "dose-1",
      "protocolId": "protocol-1",
      "localDate": "2025-11-04",
      "localTime": "09:30:00",
      "completed": true,
      "notes": "Morning injection, no side effects",
      "sideEffects": null
    }
  ]
}
```

### POST /api/peptides/doses
Logs a new dose.
```json
{
  "protocolId": "protocol-1",
  "localDate": "2025-11-04",
  "localTime": "09:30:00",
  "notes": "Morning injection",
  "sideEffects": null
}
```

## Common Patterns

### Protocol Creation Flow
1. User selects peptide from library
2. User enters dosage and unit
3. User selects frequency pattern
4. User selects timing
5. (Optional) User enters vial reconstitution details
6. System validates inputs
7. System calculates next dose time
8. System saves protocol
9. System schedules first notification (if enabled)

### Dose Logging Flow
1. User clicks "Log Dose" on protocol
2. System pre-fills current local date/time
3. User optionally adds notes/side effects
4. User clicks "Complete"
5. System saves dose with timezone-safe date/time
6. System awards gamification points
7. System calculates next dose time
8. System schedules next notification
9. System updates calendar view

### Calculator Usage Flow
1. User clicks "Calculate" on protocol
2. Modal shows calculator interface
3. User enters vial amount and unit
4. User enters reconstitution volume
5. User enters target dose
6. System calculates syringe units
7. User can copy result to protocol

## Edge Cases to Handle

### Timezone Edge Cases
- User travels across timezones during protocol
- Dose logged at midnight (which day?)
- User's device timezone changes
- DST transitions

### Protocol Edge Cases
- Protocol deleted with existing history (preserve history)
- Protocol edited mid-cycle (apply changes to future doses only)
- Conflicting protocols at same time (warn user)
- Invalid frequency patterns (validate)

### Calculation Edge Cases
- Zero or negative inputs (reject)
- Extremely large doses (warn)
- Decimal precision (round appropriately)
- Unit mismatches (validate conversion)

## Success Criteria
- Accurate dose time calculations
- Correct reconstitution math
- Timezone-safe date handling
- No lost dose history
- Reliable notifications
- Intuitive UX flow

## Integration with Other Agents

- **← Architect**: Receives peptide system architecture
- **→ Implementer**: Provides business logic specs
- **→ Test Oracle**: Defines edge case tests
- **← Gamification Agent**: Coordinates point awards
- **← Observer**: Reports usage patterns

## Domain-Specific Validations
- Peptide names match known compounds
- Dosages within safe ranges
- Reconstitution volumes realistic
- Frequency patterns consistent
- Timing schedules feasible
