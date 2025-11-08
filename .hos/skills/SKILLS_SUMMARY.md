# ResetBiology Skills Factory Output

## Skills Created (2025-11-04)

### Architect Agent Skills
Located: `.hos/skills/architect/`

1. **system-design** - `architect/system-design/skill.md`
   - Designs system architecture and database schemas
   - Makes technical decisions using ADR format
   - Ensures ResetBiology patterns are followed
   - Triggers: "design the system architecture", "plan the database schema", "architect this feature"

### Design Enforcer Agent Skills
Located: `.hos/skills/design-enforcer/`

1. **style-validator** - `design-enforcer/style-validator/skill.md`
   - Validates UI components against design system
   - Checks colors, typography, spacing, glassmorphism
   - Ensures Tailwind consistency
   - Triggers: "validate design system compliance", "check style consistency"

2. **accessibility-scanner** - `design-enforcer/accessibility-scanner/` (symlink to shared)
   - WCAG 2.1 AA compliance testing
   - Keyboard navigation validation
   - Color contrast checking

3. **playwright-vision** - `design-enforcer/playwright-vision/` (symlink to shared)
   - Visual regression testing
   - Design verification

### Test Oracle Agent Skills
Located: `.hos/skills/test-oracle/`

1. **test-generator** - `test-oracle/test-generator/skill.md`
   - Generates comprehensive test suites
   - Creates unit, integration, and E2E tests
   - Follows TDD principles
   - Triggers: "generate tests for", "create test suite", "write tests following TDD"

2. **edge-case-finder** - `test-oracle/edge-case-finder/skill.md`
   - Identifies boundary conditions and edge cases
   - Discovers temporal, numeric, string, and concurrent edge cases
   - ResetBiology-specific scenarios
   - Triggers: "find edge cases for", "identify boundary conditions"

3. **playwright-vision** - `test-oracle/playwright-vision/` (symlink to shared)
   - E2E test execution with visual verification

### Observer Agent Skills
Located: `.hos/skills/observer/`

1. **pattern-recognition** - `observer/pattern-recognition/skill.md`
   - Identifies recurring patterns and anti-patterns
   - Detects architectural insights
   - Analyzes code duplication and bottlenecks
   - Triggers: "analyze patterns in codebase", "identify recurring issues"

2. **health-monitor** - `observer/health-monitor/skill.md`
   - Monitors system health and performance
   - Tracks database, API, and authentication status
   - Provides real-time alerts
   - Triggers: "check system health", "monitor application status"

### Implementer Agent Skills
Located: `.hos/skills/implementer/`

1. **code-generator** - `implementer/code-generator/skill.md`
   - Generates production-ready code
   - Follows ResetBiology patterns (user lookup, timezone safety, API format)
   - Creates API routes, components, database models
   - Triggers: "generate code for", "implement the feature", "create API route for"

2. **test-driven-dev** - `implementer/test-driven-dev/skill.md`
   - Implements features using strict TDD (Red-Green-Refactor)
   - Ensures tests written before code
   - High test coverage and quality
   - Triggers: "implement using TDD", "follow TDD for", "write tests first"

## Skill Relationships

```
Architect (system-design)
    ↓ provides specs
Implementer (code-generator + test-driven-dev)
    ↓ submits code
Design Enforcer (style-validator + accessibility-scanner)
    ↓ validates UI
Test Oracle (test-generator + edge-case-finder)
    ↓ verifies quality
Observer (pattern-recognition + health-monitor)
    ↓ monitors and reports
```

## Usage

Each agent now has specialized skills that can be triggered by natural language:

**Example 1: Architect**
```
"Design the system architecture for the PWA notification feature"
→ Triggers: system-design skill
→ Output: ADR, database schema, API structure
```

**Example 2: Test Oracle**
```
"Generate tests for the peptide dose logging feature"
→ Triggers: test-generator skill
→ Output: Unit, integration, and E2E tests
```

**Example 3: Design Enforcer**
```
"Validate design system compliance for the new modal"
→ Triggers: style-validator skill
→ Output: Validation report with violations and fixes
```

## Shared Skills

### Playwright Vision
- Located: `.hos/skills/playwright-vision/`
- Used by: design-enforcer, test-oracle
- Purpose: Visual testing and verification

### Accessibility Scanner
- Located: `.hos/skills/shared/accessibility-scanner/`
- Used by: design-enforcer
- Purpose: WCAG compliance testing

## Critical Patterns Enforced

All skills enforce ResetBiology-specific patterns:

1. **User Lookup Pattern**: Auth0 email fallback
2. **Timezone Safety**: localDate/localTime strings (never UTC)
3. **API Response Format**: `{ success, data, error }`
4. **Design System**: Glassmorphism, Tailwind colors (#3FBFB5)
5. **Gamification Integration**: Points for all user actions
6. **Error Handling**: Try-catch on all operations
7. **TDD Methodology**: Red-Green-Refactor cycle

## Next Steps

1. Test skills with each agent
2. Refine trigger phrases based on usage
3. Add more specialized skills as needed
4. Document skill interactions and workflows
