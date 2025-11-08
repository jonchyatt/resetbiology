---
name: pattern-recognition
description: Identifies recurring patterns, anti-patterns, and architectural insights
version: 1.0.0
triggers:
  - analyze patterns in codebase
  - identify recurring issues
  - find code patterns
  - detect anti-patterns
  - recognize architectural patterns
---

# Pattern Recognition Skill

## Purpose
Analyzes codebase to identify recurring patterns (good and bad), architectural insights, and opportunities for improvement in ResetBiology.com.

## When to Use
- During code reviews
- After multiple bug fixes
- When planning refactoring
- For architectural assessments
- Monthly codebase health checks

## Pattern Categories

### 1. Architectural Patterns

#### Good Patterns to Detect
```yaml
User_Lookup_Pattern:
  description: Email fallback for Auth0 ID changes
  signature: "OR: [{ auth0Sub }, { email }]"
  frequency: Count occurrences
  impact: Prevents user not found errors
  recommendation: Continue using

Timezone_Safe_Dates:
  description: Store localDate/localTime strings
  signature: "localDate: string, localTime: string"
  frequency: Count usage
  impact: No timezone bugs
  recommendation: Enforce in new features

Feature_Isolation:
  description: Self-contained feature modules
  signature: "/app/api/[feature]/"
  frequency: Per feature
  impact: Easy maintenance
  recommendation: Apply to new features

API_Response_Format:
  description: Consistent response structure
  signature: "{ success, data, error }"
  frequency: Count endpoints
  impact: Predictable API
  recommendation: Enforce standard
```

#### Anti-Patterns to Detect
```yaml
UTC_Date_Conversion:
  description: Converting user dates to UTC
  signature: "toISOString(), toUTCString()"
  frequency: Should be 0
  impact: Wrong dates shown to users
  action: Alert and fix immediately

Missing_Error_Handling:
  description: API routes without try-catch
  signature: "export async function.*without try"
  frequency: Count violations
  impact: Unhandled exceptions
  action: Add error handling

Hard_Coded_Values:
  description: Magic numbers in code
  signature: "[0-9]{2,} (not in const)"
  frequency: Count occurrences
  impact: Maintainability issues
  action: Extract to constants

Multiple_Prisma_Instances:
  description: Creating multiple Prisma clients
  signature: "new PrismaClient()"
  frequency: Should be 1
  impact: Connection pool exhaustion
  action: Use singleton pattern
```

### 2. Bug Patterns

#### Recurring Issues
```yaml
Auth0_Related:
  patterns:
    - User not found (email fallback missing)
    - Session expiration (no refresh)
    - Redirect loops (missing returnTo)
  frequency: Track by category
  root_cause: Auth0 ID changes
  solution: Email fallback pattern

Timezone_Issues:
  patterns:
    - Dose logged on wrong day
    - Streak broken at midnight
    - Calendar display off by one
  frequency: Track occurrences
  root_cause: UTC conversion
  solution: Local date/time strings

Gamification:
  patterns:
    - Points awarded twice
    - Streak not updating
    - Achievement not unlocking
  frequency: Track by type
  root_cause: Race conditions
  solution: Transaction handling
```

### 3. Performance Patterns

#### Bottlenecks
```yaml
Database_Queries:
  pattern: N+1 query problem
  detection: "findMany in loop"
  locations: List files
  impact: Slow response times
  solution: Use include/select

API_Response_Times:
  pattern: Slow endpoints
  detection: Response > 1000ms
  endpoints: List by latency
  impact: Poor UX
  solution: Optimize queries/caching

Frontend_Performance:
  pattern: Excessive re-renders
  detection: Component re-renders > 10/sec
  components: List affected
  impact: Laggy UI
  solution: Memoization
```

### 4. Code Duplication Patterns

#### Similar Code Blocks
```yaml
API_Route_Boilerplate:
  pattern: Auth + user lookup
  locations: All API routes
  lines: ~15 per route
  opportunity: Create middleware
  impact: DRY principle

Date_Time_Formatting:
  pattern: Date string generation
  locations: Multiple components
  lines: ~5 per occurrence
  opportunity: Utility function
  impact: Consistency

Gamification_Calls:
  pattern: Point awarding logic
  locations: After each action
  lines: ~8 per occurrence
  opportunity: Helper function
  impact: Maintainability
```

## Pattern Analysis Process

### 1. Scan Codebase
Use Grep to find pattern signatures:

```bash
# Find user lookup pattern
grep -r "auth0Sub.*email" src/

# Find UTC conversions
grep -r "toISOString\|toUTCString" src/

# Find error handling
grep -r "try.*catch" app/api/

# Find hard-coded values
grep -r "[0-9]{3,}" src/
```

### 2. Count Occurrences
Track frequency of each pattern:

```yaml
Results:
  user_lookup_pattern: 18 occurrences ✅
  timezone_safe_dates: 12 occurrences ✅
  utc_conversion: 2 occurrences ❌
  missing_error_handling: 5 occurrences ⚠️
  hard_coded_values: 23 occurrences ⚠️
```

### 3. Analyze Impact
For each pattern, determine:
- Severity (Critical, High, Medium, Low)
- Frequency (Common, Occasional, Rare)
- Impact (Breaking, Degraded, Minor)
- Effort to fix (Easy, Medium, Hard)

### 4. Generate Recommendations

```yaml
Critical_Actions:
  - Fix UTC conversion (2 occurrences)
    Impact: User-facing bugs
    Effort: Easy (2 hours)
    Priority: Immediate

High_Priority:
  - Add error handling (5 endpoints)
    Impact: Production stability
    Effort: Medium (1 day)
    Priority: This sprint

Medium_Priority:
  - Extract constants (23 occurrences)
    Impact: Maintainability
    Effort: Medium (2 days)
    Priority: Next sprint

Low_Priority:
  - Create API middleware
    Impact: Code cleanliness
    Effort: Hard (3 days)
    Priority: Backlog
```

## ResetBiology-Specific Patterns

### Feature Usage Patterns
Analyze which features are used most:

```yaml
Most_Used:
  1. Peptide Tracker (85% of users)
  2. Portal Dashboard (80% daily)
  3. Breath Training (60% weekly)
  4. Workout Tracker (45% weekly)
  5. Nutrition Tracker (40% weekly)

Least_Used:
  1. Journal (20% adoption)
  2. Mental Mastery (15% completion)

Insights:
  - Focus development on peptide tracking
  - Improve onboarding for journal
  - Consider sunset for mental mastery
```

### Common User Journeys
```yaml
Successful_Path:
  1. Quiz → Login → Portal
  2. Add peptide protocol
  3. Log first dose
  4. Return daily for 7+ days
  5. Subscribe after trial
  Success_Rate: 60%

Failed_Path:
  1. Quiz → Login → Portal
  2. View features
  3. Never add protocol
  4. Don't return
  Success_Rate: 40%

Insights:
  - Optimize "Add Protocol" onboarding
  - Add reminder system
  - Improve initial engagement
```

## Output Format

### Pattern Report
```markdown
# ResetBiology Pattern Analysis
Date: 2025-11-04

## Good Patterns Found ✅
1. **User Lookup Pattern** (18 occurrences)
   - Prevents Auth0 ID issues
   - Continue using

2. **Timezone Safe Dates** (12 occurrences)
   - No timezone bugs
   - Enforce in new features

## Anti-Patterns Found ❌
1. **UTC Date Conversion** (2 occurrences)
   - Files: peptides/route.ts, workout/route.ts
   - Impact: Critical - user-facing bugs
   - Action: Fix immediately

2. **Missing Error Handling** (5 endpoints)
   - Files: [list]
   - Impact: High - production stability
   - Action: Add try-catch blocks

## Recommendations
### Immediate (This Week)
- Fix UTC conversions
- Add error handling to critical endpoints

### Short-term (This Month)
- Extract hard-coded values to constants
- Create API route middleware

### Long-term (This Quarter)
- Refactor common code patterns
- Implement caching layer

## Metrics
- Technical Debt Score: 6/10
- Code Quality: 8/10
- Architecture Consistency: 9/10
```

## Success Criteria
- All good patterns documented
- All anti-patterns identified
- Impact assessment complete
- Recommendations prioritized
- Metrics tracked over time
- Actionable insights provided

## Integration
- **→ Architect**: Report architectural patterns
- **→ Implementer**: Provide refactoring suggestions
- **→ Test Oracle**: Share bug patterns
- **→ Design Enforcer**: Report UI patterns
