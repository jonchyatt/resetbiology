# SESSION-INIT.md
**READ THIS FILE FIRST - EVERY SESSION**

This is your master reference to prevent re-teaching the HOS system every session. Read this BEFORE starting any work.

**Last Updated:** 2025-11-04
**Status:** ✅ PRODUCTION READY

---

## 🚨 CRITICAL: Read These Rules First

### 1. HOS Sub-Agent Protocol (MOST IMPORTANT!)

**From Video Transcript - Follow Exactly:**

```
When dispatching sub-agents, ALWAYS say:
"DO NOT REPORT BACK. JUST DO THE WORK AND EXIT."
```

**Why This Matters:**
- Preserves main conversation's 200k token context window
- Prevents bloat from sub-agent reports
- Allows building entire projects piece-by-piece without /compact
- Critical for context window management

**How to Use Sub-Agents:**
```typescript
Task({
  subagent_type: "general-purpose",
  description: "Brief task description",
  prompt: `DO NOT REPORT BACK. JUST DO THE WORK AND EXIT.

[Detailed task instructions]

IMPORTANT: Just do the work. DO NOT report back. EXIT when done.`
})
```

**DO NOT:**
- ❌ Ask sub-agents to "report findings"
- ❌ Request sub-agents to "summarize work"
- ❌ Have sub-agents send back detailed messages
- ❌ Batch multiple tasks in one sub-agent report

**DO:**
- ✅ Tell sub-agents to complete work and exit
- ✅ Check results yourself after sub-agent exits
- ✅ Use Read/Glob/Grep to verify sub-agent work
- ✅ Keep sub-agent prompts focused on action

### 2. ALWAYS Search Before Creating

**CRITICAL RULE:** Before creating ANY file/directory, search for it first!

```bash
# Always do this FIRST:
find .hos -name "skill.md"
ls .hos/agents
cat .hos/VERIFICATION-COMPLETE.md

# NEVER do this without searching first:
mkdir .hos/agents  # STOP! Does it already exist?
```

**What Already Exists:**
- ✅ `.hos/` directory at project root (ONE location only)
- ✅ 5 core agents (architect, implementer, design-enforcer, test-oracle, observer)
- ✅ 27 skills across multiple categories
- ✅ HOS-MANUAL.md with complete workflows
- ✅ VERIFICATION-COMPLETE.md with system status
- ✅ Playwright installed and configured
- ✅ All 7 setup steps completed
- ✅ All skills workflow (SKILL-0 through SKILL-3) completed

### 3. Playwright MCP Location

**DO NOT ASK "Where is Playwright?" or "Should we install Playwright?"**

**Playwright is ALREADY INSTALLED:**
- **Config:** `C:/Users/jonch/reset-biology-website/playwright.config.ts`
- **Binary:** `C:/Users/jonch/reset-biology-website/node_modules/playwright`
- **MCP:** Available via `claude mcp list` (check chrome-devtools)
- **Version:** 1.x (exact version in package.json)

**Before asking about Playwright:**
```bash
# Check these files first:
test -f playwright.config.ts && echo "Config exists"
test -d node_modules/playwright && echo "Installed"
```

### 4. Project Structure - Know This By Heart

```
C:/Users/jonch/reset-biology-website/
├── .hos/                           # ONE location only (project root)
│   ├── agents/                     # 5 core agents
│   │   ├── architect/
│   │   ├── implementer/
│   │   ├── design-enforcer/
│   │   ├── test-oracle/
│   │   └── observer/
│   ├── skills/                     # 27 skills total
│   │   ├── core/                   # Universal skills
│   │   ├── shared/                 # Shared across agents
│   │   ├── architect/              # Agent-specific
│   │   ├── design-enforcer/
│   │   ├── test-oracle/
│   │   ├── observer/
│   │   ├── implementer/
│   │   └── reset-biology/          # Site-specific
│   ├── manual/
│   │   └── HOS-MANUAL.md           # Complete manual
│   ├── dashboard/
│   │   └── health.md               # Real-time health
│   ├── reports/
│   │   ├── initial-audit.md
│   │   ├── day-1-complete.md
│   │   └── priority-fixes.md
│   ├── orchestra/
│   │   ├── discovered-vision.md    # Deep site analysis
│   │   └── site-config.yaml
│   ├── memory/
│   │   ├── knowledge/
│   │   ├── concepts/
│   │   └── visual/baseline/        # Baseline screenshots
│   ├── monitoring/
│   │   ├── auto-fix.yaml
│   │   └── alerts.yaml
│   ├── templates/
│   │   └── skill-template.md
│   ├── scripts/
│   │   ├── hos-init.ps1            # PowerShell auto-init
│   │   ├── hos-init.sh             # Bash auto-init
│   │   └── INSTALL-AUTO-INIT.md
│   ├── SESSION-INIT.md             # THIS FILE
│   └── VERIFICATION-COMPLETE.md    # System verification
│
├── app/                            # Next.js 15 app directory
├── src/                            # React components
├── prisma/                         # Database schema
├── playwright.config.ts            # Playwright config
└── CLAUDE.md                       # Project instructions

```

---

## 📚 What's Been Built (DO NOT RECREATE)

### ✅ Completed Steps

**7-Step Workflow (ALL DONE):**
1. ✅ Bootstrap + Deep Analysis → `orchestra/discovered-vision.md`
2. ✅ Intelligent Agent Creation → 5 agents in `agents/`
3. ✅ Playwright Integration → 6 testing skills + baseline screenshots
4. ✅ Smart Manual → `manual/HOS-MANUAL.md`
5. ✅ Skills Generation → 7+ ResetBiology-specific skills
6. ✅ Living Feedback → `dashboard/health.md` monitoring
7. ✅ Complete System Test → 165+ tests, reports generated

**Skills Workflow (ALL DONE):**
- ✅ SKILL-0: skill-creator foundation loaded
- ✅ SKILL-0.5: playwright-vision template created
- ✅ SKILL-1: 11 agent skills generated
- ✅ SKILL-2: Agents connected to skills via config.yaml
- ✅ SKILL-3: skill-generator meta-skill created
- ✅ VERIFICATION: 27 skills listed and verified

**Auto-Init (ALL DONE):**
- ✅ PowerShell init script (hos-init.ps1)
- ✅ Bash init script (hos-init.sh)
- ✅ Installation guide (INSTALL-AUTO-INIT.md)

### 📊 Skills Inventory (27 Total)

**Core (2):**
- skill-generator (meta-skill)
- skill-creator (foundation)

**Shared (6):**
- playwright-vision (main testing)
- link-validator
- responsive-tester
- user-journey-validator
- style-consistency-checker
- performance-auditor
- accessibility-scanner

**Agent-Specific (12):**
- architect/system-design
- design-enforcer/style-validator
- design-enforcer/accessibility-scanner
- design-enforcer/playwright-vision
- test-oracle/test-generator
- test-oracle/edge-case-finder
- test-oracle/playwright-vision
- observer/pattern-recognition
- observer/health-monitor
- implementer/code-generator
- implementer/test-driven-dev

**Reset Biology Specific (7):**
- peptide-protocol-validator
- nutrition-macro-checker
- workout-form-validator
- gamification-calculator
- auth0-session-debugger
- seo-health-optimizer
- checkout-flow-tester

---

## 🎯 Common Tasks - Quick Reference

### Start of Every Session

```bash
# 1. Read this file
cat .hos/SESSION-INIT.md

# 2. Check system health
cat .hos/dashboard/health.md
cat .hos/VERIFICATION-COMPLETE.md

# 3. Review recent reports
cat .hos/reports/day-1-complete.md

# 4. Check available skills
find .hos/skills -name "skill.md" | wc -l  # Should be 27
```

### Dispatching Sub-Agents (CRITICAL!)

```typescript
// ALWAYS use this pattern:
Task({
  subagent_type: "general-purpose",
  description: "Create new feature",
  prompt: `DO NOT REPORT BACK. JUST DO THE WORK AND EXIT.

Task: [detailed instructions]

IMPORTANT: Just do the work. DO NOT report back. EXIT when done.`
})

// Then verify yourself:
Read({ file_path: "path/to/created/file" })
```

### Using Skills

```bash
# Invoke by natural language (examples):
"Use playwright-vision to test the portal"
"Validate peptide protocol for BPC-157"
"Create a new skill for database migrations"
"Check system health"
"Generate tests for nutrition tracker"
```

### Checking What Exists

```bash
# Before creating anything:
ls .hos/skills/                    # List all skill categories
find .hos -name "skill.md"         # Find all skills
cat .hos/agents/*/config.yaml      # Check agent configs
cat playwright.config.ts           # Playwright setup
```

### Running Tests

```bash
# Playwright tests
npx playwright test

# Build check
npm run build

# Type check
npx tsc --noEmit
```

---

## ⚠️ WHAT NOT TO DO

### ❌ DON'T Create These (Already Exist)

1. **DO NOT create .hos directory** - It exists at `C:/Users/jonch/reset-biology-website/.hos/`
2. **DO NOT create agents** - 5 agents already exist in `.hos/agents/`
3. **DO NOT reinstall Playwright** - Already in `node_modules/playwright`
4. **DO NOT create HOS-MANUAL.md** - Exists in `.hos/manual/`
5. **DO NOT create skill templates** - Template exists in `.hos/templates/`
6. **DO NOT create duplicate skills** - 27 skills already exist

### ❌ DON'T Ask These Questions

1. "Should we install Playwright?" → NO, it's installed
2. "Where should we put the .hos directory?" → It's already at project root
3. "Do we need to create agents?" → NO, 5 agents exist
4. "Should I create a skill template?" → NO, template exists
5. "Can I report back the results?" → NO, silent sub-agents only

### ❌ DON'T Break These Rules

1. **Never have sub-agents report back** (context window protection)
2. **Never create before searching** (avoid duplicates)
3. **Never ask about Playwright location** (it's in playwright.config.ts)
4. **Never create parent-level .hos** (only project root)
5. **Never compress details** (keep all technical info)

---

## 🔧 ResetBiology Tech Stack

**Critical Info You Must Know:**

**Frontend:**
- Next.js 15 + React 19
- TypeScript (strict mode)
- Tailwind CSS with custom design system
- Server components + client components

**Database:**
- MongoDB Atlas (production)
- Prisma ORM
- SQLite (local dev)

**Authentication:**
- Auth0 v4.10.0 (WORKING - DON'T CHANGE!)
- Domain: dev-4n4ucz3too5e3w5j.us.auth0.com
- Google OAuth

**Deployment:**
- Vercel (primary)
- Cloudflare Pages (backup)

**Testing:**
- Playwright (installed)
- Jest (planned)

**Design System:**
- Primary: Teal #3FBFB5
- Secondary: Green #72C247
- Glassmorphism effects
- Dark themes with transparency

**Key Features:**
- Peptide dosage tracking
- Nutrition logging
- Workout tracking
- Gamification system
- Breath training app
- Client portal with Auth0

---

## 📖 Essential Reading (In Order)

**On Session Start:**
1. **THIS FILE** (`.hos/SESSION-INIT.md`) - Master reference
2. **VERIFICATION** (`.hos/VERIFICATION-COMPLETE.md`) - System status
3. **HEALTH** (`.hos/dashboard/health.md`) - Current health
4. **CLAUDE.md** (project root) - Development guidelines

**When Working:**
- **HOS-MANUAL.md** (`.hos/manual/`) - Complete workflows
- **discovered-vision.md** (`.hos/orchestra/`) - Site analysis
- **day-1-complete.md** (`.hos/reports/`) - Test results

**When Creating Skills:**
- **skill-template.md** (`.hos/templates/`) - Skill template
- **skill-generator** (`.hos/skills/core/skill-generator/skill.md`) - Meta-skill guide
- **playwright-vision** (`.hos/skills/shared/playwright-vision/skill.md`) - Example skill

---

## 🎯 Quick Decision Tree

**Should I create this file/directory?**
```
1. Search for it first → find .hos -name "[filename]"
2. If exists → READ it, DON'T recreate
3. If missing → Check if it's SUPPOSED to exist (check VERIFICATION-COMPLETE.md)
4. If truly needed → Create with proper structure
```

**Should I use a sub-agent?**
```
1. Is this a multi-step task? → YES → Use sub-agent
2. Dispatch with: "DO NOT REPORT BACK. JUST DO THE WORK AND EXIT."
3. Sub-agent completes and exits silently
4. YOU verify the work yourself (Read/Glob/Grep)
```

**Should I ask about Playwright?**
```
1. Is Playwright installed? → YES (check playwright.config.ts)
2. Where is it? → node_modules/playwright
3. MCP available? → Check with: claude mcp list
4. Just use it → Don't ask, just invoke
```

**Should I create a skill?**
```
1. Check if it exists → find .hos/skills -name "skill.md" | grep [name]
2. If exists → Use it, don't recreate
3. If missing → Read skill-generator skill for instructions
4. Follow template → .hos/templates/skill-template.md
```

---

## 🚀 Session Startup Checklist

On every new session, check these boxes:

- [ ] Read SESSION-INIT.md (this file)
- [ ] Check VERIFICATION-COMPLETE.md for system status
- [ ] Review dashboard/health.md for current health
- [ ] Count skills: `find .hos/skills -name "skill.md" | wc -l` (should be 27)
- [ ] Verify Playwright: `test -f playwright.config.ts && echo "Ready"`
- [ ] Check agents: `ls .hos/agents` (should show 5 directories)
- [ ] Remember sub-agent protocol: "DO NOT REPORT BACK"
- [ ] Search before creating anything

---

## 📊 System Health Quick Check

**Run these commands to verify system:**

```bash
# Check HOS structure
ls .hos/

# Count agents
ls .hos/agents | wc -l  # Should be 5

# Count skills
find .hos/skills -name "skill.md" | wc -l  # Should be 27

# Verify Playwright
test -f playwright.config.ts && echo "✅ Playwright configured"

# Check key files
test -f .hos/VERIFICATION-COMPLETE.md && echo "✅ System verified"
test -f .hos/manual/HOS-MANUAL.md && echo "✅ Manual exists"

# Check recent reports
ls -lt .hos/reports/ | head -n 5
```

**Expected Output:**
```
✅ Playwright configured
✅ System verified
✅ Manual exists
```

---

## 🎓 Key Learnings (Don't Forget!)

### From Previous Sessions:

1. **Sub-agents must be silent** (context window protection)
2. **Search before creating** (avoid duplicates)
3. **Playwright is already installed** (don't ask about it)
4. **One .hos directory only** (at project root)
5. **27 skills exist** (don't create duplicates)
6. **5 agents configured** (don't recreate them)
7. **All 7 steps completed** (don't redo them)
8. **Skills workflow done** (SKILL-0 through SKILL-3)

### Critical Mistakes to Avoid:

1. ❌ Creating duplicate .hos directories
2. ❌ Having sub-agents report back
3. ❌ Asking where Playwright is
4. ❌ Recreating existing agents/skills
5. ❌ Compressing technical details
6. ❌ Not reading this file on session start

---

## 💡 Pro Tips

1. **Use Tab Completion:** The .hos directory structure supports autocomplete
2. **Alias Commands:** Install auto-init for quick commands like `hos-status`
3. **Visual Verification:** Check `.hos/memory/visual/baseline/` for screenshots
4. **Health Monitoring:** Dashboard updates in real-time
5. **Skill Discovery:** `find .hos/skills -name "skill.md"` shows all skills
6. **Agent Config:** `cat .hos/agents/*/config.yaml` shows all agent capabilities

---

## 🔗 External Resources

**Documentation:**
- Playwright: https://playwright.dev/
- Next.js 15: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Auth0: https://auth0.com/docs

**Project Links:**
- Production: https://resetbiology.com
- Vercel Dashboard: (check deployment logs)
- MongoDB Atlas: (database management)

---

## 📝 Update Log

### 2025-11-04 - Initial Creation
- Created master SESSION-INIT.md file
- Documented all 27 skills
- Added sub-agent protocol (critical!)
- Listed all completed steps
- Created quick reference guides
- Added decision trees
- Documented what NOT to do

---

## ✅ Final Checklist Before Starting Work

Before doing ANYTHING in a new session:

1. ✅ Did I read SESSION-INIT.md? (this file)
2. ✅ Did I check VERIFICATION-COMPLETE.md?
3. ✅ Do I know sub-agents must be silent?
4. ✅ Do I know Playwright is already installed?
5. ✅ Did I search before trying to create?
6. ✅ Do I know 27 skills already exist?
7. ✅ Do I know 5 agents already exist?
8. ✅ Did I read the "WHAT NOT TO DO" section?

**If all ✅ → You're ready to start work!**

---

**Remember:** This file exists to SAVE TIME and PRESERVE CONTEXT.

Read it every session. Follow the rules. Don't recreate existing work.

**Status:** ✅ HOS System Fully Operational
**Last Verified:** 2025-11-04
**Next Session:** Read this file first!
