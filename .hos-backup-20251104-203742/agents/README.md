# HOS Agents for ResetBiology.com

## All Agents

### Architect Agent
**Path:** `.hos/agents/architect/`
**Skills:** system-design
**Invoke:** "Architect: plan architecture for [feature]"

### Implementer Agent
**Path:** `.hos/agents/implementer/`
**Skills:** code-generator, test-driven-dev, playwright-vision
**Invoke:** "Implementer: build [feature] with tests"

### Design-Enforcer Agent
**Path:** `.hos/agents/design-enforcer/`
**Skills:** style-validator, accessibility-scanner, playwright-vision, responsive-tester
**Invoke:** "Design-enforcer: audit [page] for compliance"

### Test-Oracle Agent
**Path:** `.hos/agents/test-oracle/`
**Skills:** test-generator, edge-case-finder, playwright-vision, link-validator, checkout-validator
**Invoke:** "Test-oracle: run full test suite"

### Observer Agent
**Path:** `.hos/agents/observer/`
**Skills:** pattern-recognition, health-monitor, playwright-vision, seo-optimizer
**Invoke:** "Observer: generate daily insights"

## Skill Sharing

Shared skills available to multiple agents:
- `playwright-vision` → All UI agents
- `link-validator` → test-oracle, observer
- `responsive-tester` → design-enforcer, test-oracle
