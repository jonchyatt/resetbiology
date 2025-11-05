# HOS (Holistic Orchestration System)

**Initialized:** November 4, 2025
**Project:** Reset Biology (https://resetbiology.com)

## What is HOS?

HOS is an intelligent knowledge system that maintains deep understanding of your project across sessions. It enables Claude to work more effectively by preserving:

- **Vision & Strategy** - Mission, goals, competitive positioning
- **Patterns & Standards** - Code patterns, design systems, best practices
- **Configuration** - Tech stack, deployment, environment setup
- **Knowledge Base** - Discovered insights, user journeys, personas
- **Visual Baseline** - Screenshots and UI states for regression testing

## Directory Structure

```
.hos/
├── orchestra/           # High-level vision and orchestration
│   ├── discovered-vision.md       # Comprehensive site analysis
│   └── site-config.yaml           # Configuration and settings
│
├── memory/              # Knowledge persistence
│   ├── knowledge/       # Domain knowledge, user research
│   ├── concepts/        # Extracted patterns and principles
│   │   └── extracted-patterns.md  # Code, design, UX patterns
│   └── visual/          # Visual regression baseline
│       └── baseline/    # Reference screenshots
│
├── agents/              # Agent configurations (future)
├── skills/              # Custom skills for workflows (future)
├── scripts/             # Automation scripts (future)
└── reports/             # Analysis reports (future)
```

## Current Contents

### 📋 Orchestra Layer

**`discovered-vision.md`** - Comprehensive analysis including:
- Mission statement from actual content
- Complete feature map (6 tracking systems + commerce)
- User journey mapping (5 phases)
- Tech stack breakdown (37 database models)
- Issues and incomplete features
- Brand voice analysis
- Development recommendations

**`site-config.yaml`** - Structured configuration:
- Tech stack versions
- Branding guidelines (colors, fonts, animations)
- Feature status tracking
- Database schema overview
- API patterns
- User personas
- Development priorities

### 🧠 Memory Layer

**`concepts/extracted-patterns.md`** - Pattern library:
- **Design Patterns:** Glassmorphism, color system, typography, animations
- **Code Patterns:** API routes, components, database access, state management
- **UI/UX Patterns:** Progressive disclosure, modals, forms, calendars
- **Architecture Patterns:** Feature modules, data flow, authentication

## How to Use HOS

### For Development
When starting work on a feature, reference:
1. `discovered-vision.md` → Understand current state and gaps
2. `extracted-patterns.md` → Follow established patterns
3. `site-config.yaml` → Check tech stack and configuration

### For Planning
When planning new features:
1. Review user personas in `site-config.yaml`
2. Check priorities in `discovered-vision.md`
3. Align with brand voice and design patterns

### For Debugging
When fixing issues:
1. Check "Issues & Incomplete Features" in `discovered-vision.md`
2. Review architecture patterns in `extracted-patterns.md`
3. Verify against user journey map

## Key Insights from Discovery

### ✅ Production-Ready Features
- Peptide tracking with dose logging
- Workout tracking with WGER integration
- Nutrition tracking with food database
- Breath training application
- Gamification points system
- Stripe e-commerce integration

### ⚠️ Incomplete Features
- PWA notification system (schema exists, cron not active)
- Rich text journal editor
- Success Deposit UI
- Affiliate dashboard
- Achievement badges and tier system
- Unified activity timeline

### 🎯 Core User Value
**Primary Persona:** "The Ozempic Escapee"
- Adults 30-55 escaping GLP-1 drug dependency
- Wants muscle-preserving weight loss
- Needs psychological support + accountability

**Unique Positioning:**
- IRB-approved protocols (medical legitimacy)
- Holistic 6-feature tracking suite
- Bridge to independence vs lifetime dependency

## Maintenance

### Updating HOS
When significant changes occur:
1. Update `discovered-vision.md` with new features/findings
2. Add new patterns to `extracted-patterns.md`
3. Modify `site-config.yaml` configuration as needed
4. Take screenshots for `visual/baseline/`

### Pattern Extraction
When establishing new patterns:
1. Document in `extracted-patterns.md` under appropriate section
2. Include code examples and usage guidelines
3. Note any deviations from existing patterns

## Integration with Development

### Code Review Alignment
Before merging code, verify:
- [ ] Follows patterns in `extracted-patterns.md`
- [ ] Matches brand voice in `site-config.yaml`
- [ ] Addresses priorities in `discovered-vision.md`
- [ ] Updates HOS documentation if introducing new patterns

### Feature Development Workflow
1. **Plan:** Check `discovered-vision.md` → Priorities
2. **Design:** Reference `extracted-patterns.md` → UI/UX patterns
3. **Implement:** Follow `extracted-patterns.md` → Code patterns
4. **Test:** Use user journey from `discovered-vision.md`
5. **Document:** Update HOS with new insights

## Future Enhancements

### Planned HOS Additions
- **Visual Baseline:** Screenshot library for regression testing
- **Agent Configs:** Specialized agent configurations for different tasks
- **Custom Skills:** Reusable workflows for common operations
- **Automation Scripts:** Build, test, and deployment helpers
- **Analysis Reports:** Performance, SEO, accessibility audits

### Knowledge Graph (Future)
- Relationship mapping between features
- Dependency tracking
- Impact analysis for changes

## Notes

- HOS is living documentation - update as project evolves
- Patterns should be prescriptive, not just descriptive
- Discovery analysis is point-in-time snapshot (Nov 4, 2025)
- Configuration should be single source of truth

---

**Last Updated:** November 4, 2025
**Status:** Initial bootstrap complete
**Next Step:** Begin using HOS patterns for new feature development
