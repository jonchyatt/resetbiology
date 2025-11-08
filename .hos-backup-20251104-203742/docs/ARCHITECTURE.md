# HOS Architecture for ResetBiology.com

## Overview

The Hierarchical Orchestration System (HOS) is a token-efficient AI development system that maintains low context usage through silent sub-agent delegation.

## Core Principle

```
Main Orchestrator (5% tokens) → Silent Sub-Agents (independent contexts) → Work Completed → No Reports → Orchestrator Stays Low
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│   ORCHESTRATOR (Main Context)           │
│   Token Usage: 5-10% (10K tokens max)   │
│   Role: Coordinator Only                │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┬─────────┬────────┬──────────┐
    ▼                 ▼         ▼        ▼          ▼
┌─────────┐    ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐
│ARCHITECT│    │IMPLEMENTER│ │DESIGN  │ │TEST  │ │OBSERVER│
│         │    │           │ │ENFORCER│ │ORACLE│ │        │
└─────────┘    └──────────┘ └────────┘ └──────┘ └────────┘
    │               │            │         │         │
    ▼               ▼            ▼         ▼         ▼
[Skills]        [Skills]     [Skills]  [Skills]  [Skills]
    │               │            │         │         │
    └───────────────┴────────────┴─────────┴─────────┘
                      ▼
              [Playwright MCP]
                      │
                      ▼
              [ResetBiology.com]
```

## Components

### 1. Orchestrator
- **Role:** Coordination only
- **Token Budget:** 5-10% (10K max)
- **Capabilities:**
  - Spawns sub-agents
  - Maintains system state
  - Routes requests
  - Monitors health
- **Never Does:** Direct code analysis, implementation, testing

### 2. Agents

#### Architect Agent
- **Purpose:** Maintains architectural consistency
- **Skills:** system-design
- **Token Budget:** 18K per session
- **Outputs:** Architecture decisions, pattern validation

#### Implementer Agent
- **Purpose:** Builds features with TDD
- **Skills:** code-generator, test-driven-dev, playwright-vision
- **Token Budget:** 18K per session
- **Outputs:** Code, tests, PRs

#### Design Enforcer Agent
- **Purpose:** Validates UI/UX consistency
- **Skills:** style-validator, accessibility-scanner, playwright-vision, responsive-tester
- **Token Budget:** 18K per session
- **Outputs:** Design compliance reports, violation logs

#### Test Oracle Agent
- **Purpose:** Comprehensive testing
- **Skills:** test-generator, edge-case-finder, playwright-vision, link-validator, checkout-validator
- **Token Budget:** 20K per session
- **Outputs:** Test results, coverage reports

#### Observer Agent
- **Purpose:** Continuous monitoring and insights
- **Skills:** pattern-recognition, health-monitor, seo-optimizer
- **Token Budget:** 15K per session
- **Outputs:** Daily reports, improvement suggestions

### 3. Skills System

Skills are reusable capabilities that agents invoke.

**Structure:**
```
/skill-name/
├── skill.md          # Specification with YAML frontmatter
├── script.py         # Optional implementation
└── test_data.csv     # Optional test data
```

**Key Skills:**
- **playwright-vision:** Visual inspection (all UI agents)
- **system-design:** Architecture planning (architect)
- **code-generator:** Code creation (implementer)
- **test-generator:** Test creation (test-oracle)
- **pattern-recognition:** Pattern detection (observer)
- **skill-creator:** Meta-skill that creates other skills

### 4. Memory System

#### Visual Memory
- **Location:** `.hos/memory/visual/`
- **Contents:** Screenshots across devices
- **Purpose:** Visual regression testing, design validation

#### Knowledge Memory
- **Location:** `.hos/memory/knowledge/`
- **Contents:**
  - discovered-vision.md - Site mission/purpose
  - patterns.md - Code patterns
  - pain-points.md - Known issues
  - tech-stack.md - Technology documentation

#### Conversation Memory
- **Location:** `.hos/memory/conversations/`
- **Contents:** Agent interaction logs

### 5. Playwright MCP Integration

Playwright MCP serves as the "eyes" for all UI validation.

**Capabilities:**
- Screenshot capture
- Element visibility checking
- Responsive testing
- Interaction validation
- Visual regression detection

**Integrated With:**
- Design Enforcer (style validation)
- Test Oracle (E2E testing)
- Observer (health monitoring)
- Implementer (implementation validation)

## Data Flow

### Feature Implementation Flow
```
1. User Request
   ↓
2. Orchestrator (spawns Architect agent, silent)
   ↓
3. Architect analyzes & plans (uses system-design skill)
   ↓
4. Orchestrator (spawns Implementer agent, silent)
   ↓
5. Implementer builds with TDD (uses code-generator, test-driven-dev)
   ↓
6. Orchestrator (spawns Test Oracle, silent)
   ↓
7. Test Oracle validates (uses playwright-vision, test-generator)
   ↓
8. Orchestrator (spawns Design Enforcer, silent)
   ↓
9. Design Enforcer validates UI (uses style-validator, playwright-vision)
   ↓
10. All work complete, orchestrator still at 5% context
```

### Monitoring Flow
```
Observer (hourly) → Playwright checks site → Logs health → Identifies issues → Generates improvement suggestions → Updates queue
```

## Token Economics

| Component | Token Budget | Strategy |
|-----------|--------------|----------|
| Orchestrator | 10K (5-10%) | Coordination only, delegates everything |
| Architect | 18K | Per-session, works silently |
| Implementer | 18K | Per-session, works silently |
| Design Enforcer | 18K | Per-session, works silently |
| Test Oracle | 20K | Per-session, works silently |
| Observer | 15K | Per-session, reports back |

**Total Available:** 200K tokens
**Orchestrator Overhead:** 10K (5%)
**Agent Work:** Independent contexts, don't deplete main budget

## Silent Sub-Agent Pattern

**Standard Invocation:**
```bash
"Use a sub-agent to [task]. Tell it not to report back, just do the work."
```

**Why Silent:**
- Reports consume orchestrator tokens
- Sub-agents have independent 200K context
- Orchestrator only needs to know "done" or "failed"
- Detailed work stays in sub-agent context

**When to Report Back:**
- Observer daily insights
- Critical failures
- Explicit user request for details
- System verification

## File Organization

```
C:\Users\jonch\reset-biology-website\
├── .hos/                    # HOS system
│   ├── orchestrator/        # Main coordination
│   ├── agents/              # Agent configs
│   ├── memory/              # Persistent memory
│   ├── tests/               # Test suites
│   ├── monitoring/          # Health checks
│   ├── reports/             # Generated reports
│   └── docs/                # Documentation
├── skills/                  # Claude Skills
│   ├── architect/
│   ├── implementer/
│   ├── design-enforcer/
│   ├── test-oracle/
│   ├── observer/
│   ├── reset-biology/       # Site-specific skills
│   └── shared/              # Multi-agent skills
├── app/                     # Next.js app (existing)
├── src/                     # React components (existing)
└── ...                      # Other project files
```

## Integration with ResetBiology.com

### Technology Stack
- **Framework:** Next.js 15 (App Router)
- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** MongoDB Atlas (Prisma ORM)
- **Auth:** Auth0
- **Payments:** Stripe
- **Deployment:** Vercel

### Key Features
- Peptide tracking
- Nutrition logging
- Workout tracking
- Breath training
- E-commerce store
- User portal
- Assessment system

### Critical Paths (High-Priority Testing)
1. Auth0 authentication
2. Peptide protocol tracking
3. Store checkout (Stripe)
4. Nutrition calculations
5. Workout logging
6. Breath training sessions

## Continuous Improvement Loop

```
Observer detects pattern
    ↓
Architect evaluates
    ↓
User approves
    ↓
Implementer builds (TDD)
    ↓
Test Oracle validates
    ↓
Design Enforcer checks
    ↓
Deploy
    ↓
Observer monitors
    ↓
(repeat)
```

## Future Enhancements

- Auto-skill generation from Observer patterns
- CI/CD integration
- Performance optimization automation
- SEO continuous improvement
- A/B testing framework
