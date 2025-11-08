# HOS Orchestrator - Main Coordination

## Role
Main orchestrator maintains 3-5% token usage by delegating ALL heavy work to silent sub-agents.

## Core Principle: Silent Sub-Agent Delegation

Every operation follows this pattern:
```
Orchestrator (5% context) → Spawn Silent Sub-Agent → Agent Works → No Report Back → Orchestrator Stays at 5%
```

## Token Budget
- **Orchestrator Context:** 5-10% (10,000 tokens max)
- **Each Sub-Agent:** Independent 200K context
- **Strategy:** Sub-agents work silently, never report back unless explicitly needed

## Agent Coordination

### Available Agents
1. **Architect** - Plans architecture, maintains consistency
2. **Implementer** - Builds features with TDD
3. **Design-Enforcer** - Validates UI/UX with Playwright
4. **Test-Oracle** - Comprehensive testing
5. **Observer** - Continuous monitoring and insights

### Invocation Pattern

```bash
# CORRECT: Silent sub-agent
"Use a sub-agent to [task]. Tell it not to report back, just do the work."

# INCORRECT: Direct work (burns orchestrator tokens)
"Let me analyze all the code..." ❌
```

## Daily Workflow

### Morning (5 minutes)
```bash
"Observer agent: Run morning health check. Report back with summary only."
```

### Development
```bash
"Use implementer sub-agent to build [feature]. Work silently."
"Use test-oracle sub-agent to validate. Work silently."
```

### Evening (2 minutes)
```bash
"Create checkpoint of current state."
```

## Checkpoints

Checkpoints saved to: `.hos/orchestrator/checkpoints/`

Format: `YYYY-MM-DD-HHmm-checkpoint.json`

Contains:
- System state
- Agent statuses
- Recent activities
- Token usage stats

## State Management

Current state always in: `.hos/orchestrator/state.json`

Updated after:
- Major agent completions
- Checkpoints
- System changes
- Error conditions

## Emergency Recovery

If orchestrator context grows > 10%:
```bash
"Create checkpoint, then restart orchestrator from clean state."
```

## Integration with ResetBiology.com

### Project Path
`C:\Users\jonch\reset-biology-website\`

### Key Directories
- `/app/` - Next.js pages and API routes
- `/src/components/` - React components
- `/prisma/` - Database schema
- `/public/` - Static assets

### Production URL
https://resetbiology.com

### Local Dev
http://localhost:3000

## Notes
- Orchestrator NEVER does heavy lifting directly
- All analysis, building, testing via sub-agents
- Sub-agents work silently by default
- Only explicit "report back" commands get responses
- This keeps orchestrator context perpetually low
