---
name: edge-case-finder
description: Identifies edge cases and boundary conditions for comprehensive testing
version: 1.0.0
triggers:
  - find edge cases for
  - identify boundary conditions
  - discover edge cases
  - what are the edge cases
---

# Edge Case Finder Skill

## Purpose
Systematically identifies edge cases and boundary conditions that need testing for ResetBiology.com features.

## When to Use
- During test planning phase
- Before implementing new features
- When reviewing existing features
- After bug reports (find similar cases)

## Edge Case Categories

### 1. Temporal Edge Cases
Time and date related boundary conditions.

#### Midnight Boundaries
- [ ] Action logged at exactly 00:00:00 (which day?)
- [ ] Action logged at 23:59:59 (today or tomorrow?)
- [ ] Date calculation crossing midnight
- [ ] Streak calculation at day boundary

#### Month/Year Boundaries
- [ ] Protocol frequency crossing month end
- [ ] Workout logged on Feb 29 (leap year)
- [ ] Streak spanning year boundary
- [ ] Historical data across multiple years

#### Timezone Edge Cases
- [ ] User travels across timezones
- [ ] User logs in different timezone than usual
- [ ] DST transitions (spring forward, fall back)
- [ ] International date line crossing

### 2. Numeric Edge Cases
Boundary values and extreme numbers.

#### Zero Values
- [ ] Dosage = 0 (valid?)
- [ ] Workout duration = 0 minutes
- [ ] Calories = 0 (some foods are zero)
- [ ] Rep count = 0 (incomplete set?)

#### Negative Values
- [ ] Negative dosage (impossible)
- [ ] Negative calories (should reject)
- [ ] Negative workout time (impossible)
- [ ] Negative points (impossible)

#### Large Values
- [ ] Dosage > 10,000 mcg (typo or real?)
- [ ] Workout duration > 24 hours (overnight?)
- [ ] Calories > 10,000 (possible but unusual)
- [ ] Points > 1,000,000 (overflow?)

#### Decimal Precision
- [ ] Dosage with many decimals (250.123456)
- [ ] Weight with decimals (185.75 lbs)
- [ ] Macro nutrients (protein 24.7g)
- [ ] Points calculation rounding

### 3. String Edge Cases
Text input boundary conditions.

#### Empty Strings
- [ ] Empty protocol name
- [ ] Empty food name
- [ ] Empty exercise name
- [ ] Empty notes field (should be allowed)

#### Very Long Strings
- [ ] Protocol name > 100 characters
- [ ] Notes > 1000 characters
- [ ] Food description > 500 characters
- [ ] Exercise instructions > 2000 characters

#### Special Characters
- [ ] Name with apostrophe (O'Brien)
- [ ] Name with emoji 💪
- [ ] SQL injection attempt '; DROP TABLE--
- [ ] HTML/Script tags <script>alert()</script>

#### Unicode/International
- [ ] Non-English characters (日本語)
- [ ] Accented characters (Café)
- [ ] Right-to-left text (العربية)
- [ ] Special symbols (™, ®, ©)

### 4. Concurrent Operations
Race conditions and simultaneous actions.

#### Simultaneous Logging
- [ ] Two doses logged at same time
- [ ] Multiple workout sessions started
- [ ] Points awarded twice for same action
- [ ] Streak updated from multiple devices

#### Session Management
- [ ] Multiple browser tabs open
- [ ] Login on multiple devices
- [ ] Session expires during action
- [ ] Logout on one device affects others

### 5. State Transitions
Moving between different states.

#### Peptide Tracking
- [ ] Delete protocol with existing doses
- [ ] Change protocol frequency mid-cycle
- [ ] Mark future dose as completed
- [ ] Un-complete completed dose
- [ ] Protocol with no active doses

#### Gamification
- [ ] Reach exactly achievement threshold
- [ ] Go backwards in points (deletion)
- [ ] Streak broken then restored
- [ ] Multiple achievements at once
- [ ] Achievement already unlocked

### 6. Data Integrity
Invalid or inconsistent data.

#### Missing Required Fields
- [ ] UserId missing
- [ ] Protocol ID invalid
- [ ] Date missing but time present
- [ ] Incomplete form submission

#### Invalid Relationships
- [ ] Dose for non-existent protocol
- [ ] Exercise for deleted workout
- [ ] Food entry for deleted meal
- [ ] Points for non-existent user

#### Orphaned Data
- [ ] Doses after protocol deleted
- [ ] Workouts after user deleted
- [ ] Subscriptions after cancellation
- [ ] Cached data out of sync

### 7. Auth0 Edge Cases
Authentication and authorization boundaries.

#### Session States
- [ ] Session expired during operation
- [ ] Auth0 ID changed (rare but possible)
- [ ] Email changed in Auth0
- [ ] User deleted in Auth0 but exists in DB

#### Concurrent Sessions
- [ ] Login on multiple devices
- [ ] Logout on one device
- [ ] Different Auth0 accounts same email
- [ ] Account merge scenario

### 8. ResetBiology-Specific Edge Cases

#### Peptide Protocol
- [ ] Vial reconstitution with 0ml
- [ ] Frequency "every other day" crosses month
- [ ] Multiple protocols same peptide
- [ ] Protocol deleted mid-cycle
- [ ] Custom frequency validation

#### Workout Tracking
- [ ] Workout spans midnight (which day?)
- [ ] Exercise deleted during active workout
- [ ] Rep count > 1000 (display issue?)
- [ ] Empty exercise list
- [ ] Superset with 1 exercise

#### Nutrition Tracking
- [ ] Meal at 11:59pm (today or tomorrow?)
- [ ] Food with 0 calories (valid)
- [ ] Portion size > 1000 servings
- [ ] Custom food missing macros
- [ ] Negative macro values

#### Gamification
- [ ] Points awarded twice (race condition)
- [ ] Streak at timezone boundary
- [ ] Achievement threshold exactly met
- [ ] Retroactive point adjustment
- [ ] Points for deleted action

## Edge Case Discovery Process

### 1. Analyze Feature Requirements
- What are the inputs?
- What are the outputs?
- What are the valid ranges?
- What are the constraints?

### 2. Identify Boundaries
- Minimum values
- Maximum values
- Empty/null values
- Boundary transitions

### 3. Consider Unusual Scenarios
- What if user does opposite of expected?
- What if timing is unusual?
- What if data is corrupted?
- What if system is under load?

### 4. Check Related Features
- How does this interact with other features?
- What side effects exist?
- What cascading changes occur?
- What dependencies exist?

## Output Format

```yaml
Feature: Peptide Dose Logging

Edge Cases:
  Temporal:
    - Dose at midnight boundary
    - Dose in different timezone
    - DST transition handling

  Numeric:
    - Dosage = 0
    - Dosage > 10000
    - Negative dosage (reject)

  String:
    - Empty notes (allow)
    - Very long notes (> 1000 chars)
    - Special characters in notes

  Concurrent:
    - Two doses logged simultaneously
    - Protocol deleted while logging
    - Session expires during save

  State:
    - Log dose for deleted protocol
    - Complete future dose
    - Duplicate dose prevention

  Data:
    - Missing protocol ID
    - Invalid user ID
    - Orphaned dose data

Tests Required: 18
Priority: 6 critical, 8 important, 4 nice-to-have
```

## Success Criteria
- All boundary values identified
- Temporal edge cases covered
- Concurrent scenarios considered
- State transitions mapped
- Data integrity checks defined
- ResetBiology-specific cases included
- Test cases generated for each edge case

## Integration with Test Generator
After finding edge cases, pass to test-generator skill to create actual tests.
