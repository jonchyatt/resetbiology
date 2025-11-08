# HOS Agent System for ResetBiology.com

This directory contains specialized AI agents for maintaining and developing the ResetBiology platform.

## Core Agents (Standard HOS)

### 1. **Architect** (`/architect`)
**Role**: System design and architecture decisions

**Responsibilities**:
- Database schema design
- API endpoint structure
- Component hierarchy planning
- Integration pattern design
- Architecture Decision Records (ADRs)

**Key Patterns**:
- User lookup with email fallback
- Timezone-safe date handling
- Feature isolation architecture
- API response format consistency

**When to Engage**: New features, database changes, system integrations

---

### 2. **Implementer** (`/implementer`)
**Role**: Code generation following TDD and quality gates

**Responsibilities**:
- Write tests first (Red-Green-Refactor)
- Implement minimal code to pass tests
- Follow established patterns
- Quality gate enforcement

**Superpowers Used**:
- `superpowers:test-driven-development`
- `superpowers:testing-anti-patterns`

**Quality Gates**:
- TypeScript compiles without errors
- All tests pass
- ESLint passes
- Playwright E2E tests pass

**When to Engage**: All code implementation tasks

---

### 3. **Design Enforcer** (`/design-enforcer`)
**Role**: UI/UX validation and design system compliance

**Responsibilities**:
- Design system color palette enforcement
- Typography consistency
- Responsive design validation
- Accessibility auditing (WCAG 2.1 AA)
- Visual regression testing

**Design System**:
- Primary Teal: `#3FBFB5`
- Secondary Green: `#72C247`
- Glassmorphism patterns
- Mobile-first responsive design

**Tools**: Playwright for visual testing, Chrome DevTools

**When to Engage**: All UI component work, visual changes

---

### 4. **Test Oracle** (`/test-oracle`)
**Role**: Test generation, edge case discovery, quality assurance

**Responsibilities**:
- Unit test writing (80% coverage target)
- Integration test creation (100% API endpoints)
- E2E test scenarios (critical paths)
- Visual regression tests
- Edge case identification

**Superpowers Used**:
- `superpowers:test-driven-development`
- `superpowers:testing-anti-patterns`
- `superpowers:condition-based-waiting`

**Critical Paths Tested**:
- Authentication flow
- Peptide tracking workflow
- Workout logging
- Nutrition tracking
- Gamification integration

**When to Engage**: Before implementing features, when bugs appear

---

### 5. **Observer** (`/observer`)
**Role**: Pattern recognition, system monitoring, health tracking

**Responsibilities**:
- Identify recurring bugs and patterns
- Monitor API response times
- Track database query performance
- Generate weekly reports
- Real-time health checks

**Superpowers Used**:
- `superpowers:root-cause-tracing`
- `superpowers:systematic-debugging`

**Monitors**:
- Application health (database, APIs, Auth0)
- Performance (bundle size, load times, Core Web Vitals)
- User experience (engagement, conversion, retention)

**When to Engage**: Ongoing monitoring, pattern analysis, performance issues

---

## ResetBiology-Specific Agents

### 6. **Peptide Protocol Agent** (`/peptide-protocol-agent`)
**Role**: Domain expert for peptide tracking system

**Responsibilities**:
- Protocol management and validation
- Dosage calculator (reconstitution math)
- Next dose calculation (frequency patterns)
- Dose logging with timezone safety
- History and calendar views

**Domain Knowledge**:
- BPC-157, TB-500, GHK-Cu, CJC-1295, Ipamorelin, MOTS-c, etc.
- Dosing units (mg, mcg, IU)
- Frequency patterns (daily, every-other-day, 3x/week, custom)
- Timing patterns (AM, PM, twice-daily, custom)

**Business Logic**:
- Reconstitution calculations
- Next dose time prediction
- Protocol validation rules

**When to Engage**: Peptide feature work, dosing calculations, protocol logic

---

### 7. **Gamification Agent** (`/gamification-agent`)
**Role**: Design and manage engagement mechanics

**Responsibilities**:
- Points system management
- Streak mechanics enforcement
- Achievement badge design
- Tier system progression
- Variable reward implementation

**Gamification Pillars**:
1. Points system (progressive rewards)
2. Streak mechanics (daily commitment via loss aversion)
3. Achievement badges (milestone celebrations)
4. Tier system (Bronze → Silver → Gold → Platinum)
5. Variable rewards (unpredictable bonuses)

**Point Structure**:
- Peptide dose: 10 points
- Workout: 50 points
- Nutrition log: 10 points
- Breath session: 20 points
- Journal entry: 15 points
- Module complete: 30 points

**Psychology Principles**:
- Variable ratio reinforcement
- Loss aversion (streaks)
- Progress visualization
- Social proof
- Endowed progress effect

**When to Engage**: Gamification features, engagement mechanics, point logic

---

### 8. **Auth0 Guardian** (`/auth0-guardian`)
**Role**: Protect the working Auth0 authentication system

**Critical Mission**: **STOP ANY UNNECESSARY AUTH0 CHANGES**

**Historical Context**:
- September 29, 2025: Auth0 downgrade incident
- Problem: Login redirect issue
- Wrong action: Downgraded from v4 to v3
- Correct action: Add `?returnTo=/portal` parameter
- Lesson: ALWAYS try simplest change first

**Working Configuration**:
- Package: `@auth0/nextjs-auth0@4.10.0`
- Domain: `dev-4n4ucz3too5e3w5j.us.auth0.com`
- Auto-creates users on first login
- Email fallback for user lookups

**Guardian Rules**:
- ✅ ALLOWED: Query params, middleware updates, profile fields
- 🛑 FORBIDDEN: Downgrading, import changes, removing email fallback
- ⚠️ REQUIRES APPROVAL: Upgrades, new features, session config changes

**When to Engage**: ANY Auth0-related work, authentication issues, user lookup bugs

---

## Agent Interaction Map

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                         OBSERVER                             │
│           (Monitors all agents, reports patterns)            │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Pattern reports
                     │ Health metrics
                     ▼
         ┌───────────────────────┐
         │                       │
         │     ARCHITECT         │
         │  (Design decisions)   │
         │                       │
         └───────┬───────────────┘
                 │
                 │ Specs & ADRs
                 │
    ┌────────────┼────────────┬─────────────────────────┐
    │            │            │                         │
    │            │            │                         │
    ▼            ▼            ▼                         ▼
┌───────┐  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐
│PEPTIDE│  │GAMIFICATION │  │  AUTH0   │  │OTHER DOMAIN      │
│AGENT  │  │   AGENT     │  │ GUARDIAN │  │AGENTS (future)   │
└───┬───┘  └──────┬──────┘  └────┬─────┘  └─────────┬────────┘
    │             │              │                   │
    │             │              │                   │
    └─────────────┴──────────────┴───────────────────┘
                  │
                  │ Implementation specs
                  │
                  ▼
         ┌────────────────┐
         │                │
         │  IMPLEMENTER   │
         │   (TDD code)   │
         │                │
         └────┬───────┬───┘
              │       │
              │       │ Code for review
              │       │
     ┌────────┘       └─────────┐
     │                          │
     ▼                          ▼
┌─────────────┐         ┌──────────────┐
│   DESIGN    │         │     TEST     │
│  ENFORCER   │         │    ORACLE    │
│ (UI check)  │         │ (Test suite) │
└─────────────┘         └──────────────┘
```

## Using the Agent System

### Starting a New Feature
1. **Architect** designs the system
2. **Test Oracle** defines test requirements
3. **Implementer** writes tests first (TDD)
4. **Implementer** writes minimal code to pass
5. **Design Enforcer** validates UI compliance
6. **Test Oracle** verifies edge cases covered
7. **Observer** monitors performance after deploy

### Fixing a Bug
1. **Observer** identifies pattern or reports issue
2. **Test Oracle** writes failing test reproducing bug
3. **Architect** (if needed) reviews architectural cause
4. **Implementer** fixes with minimal change
5. **Test Oracle** verifies test now passes
6. **Observer** confirms bug pattern resolved

### Authentication Work
1. **Auth0 Guardian** MUST be consulted FIRST
2. Guardian reviews necessity of change
3. Guardian approves or suggests alternative
4. **Implementer** makes approved change only
5. **Test Oracle** extensively tests auth flow
6. **Observer** monitors auth metrics after deploy

### UI Changes
1. **Design Enforcer** validates design system usage
2. **Implementer** implements with correct classes
3. **Test Oracle** writes visual regression tests
4. **Design Enforcer** approves with Playwright checks
5. **Observer** monitors UI performance metrics

## Success Metrics

### Overall System Health
- Zero critical breaking changes per month
- >98% test pass rate
- >80% code coverage
- <500ms API response times (P95)
- 100% design system compliance

### Agent-Specific Metrics
- **Architect**: ADRs created, patterns documented
- **Implementer**: Test-first compliance, quality gates passed
- **Design Enforcer**: Accessibility score (AA minimum)
- **Test Oracle**: Edge cases caught, flaky test rate <1%
- **Observer**: Patterns identified, early warnings issued
- **Peptide Agent**: Calculation accuracy 100%
- **Gamification Agent**: Engagement metrics improved
- **Auth0 Guardian**: Zero auth breaking changes

## Adding New Agents

When creating new domain-specific agents:

1. Create directory: `.hos/agents/[agent-name]/`
2. Create `agent.md` with role, responsibilities, patterns
3. Create `config.yaml` with skills, tools, integration points
4. Update this README with agent description
5. Define integration with existing agents
6. Set success criteria and metrics
7. Document when to engage the agent

### Agent Template Structure
```
/agent-name/
  ├── agent.md           # Role, responsibilities, patterns, examples
  ├── config.yaml        # Skills, tools, integration, configuration
  └── templates/         # (Optional) Code templates, examples
```

## Quick Reference

### Which Agent Should I Use?

| Task | Agent | Why |
|------|-------|-----|
| Design new feature | Architect | System design needed |
| Write code | Implementer | TDD implementation |
| Check UI design | Design Enforcer | Design system compliance |
| Write tests | Test Oracle | Test generation expert |
| Debug performance | Observer | Pattern recognition |
| Peptide calculations | Peptide Agent | Domain expertise |
| Points/streaks logic | Gamification Agent | Engagement mechanics |
| **ANYTHING Auth0** | **Auth0 Guardian** | **MANDATORY** |

---

**Last Updated**: November 4, 2025

**Maintained By**: HOS Agent System

**Questions?** Consult the Observer agent for pattern analysis or Architect for architectural decisions.
