---
name: skill-generator
description: Meta-skill that teaches how to create new HOS skills following established patterns
version: 1.0.0
triggers:
  - create a new skill for
  - generate a skill that
  - build a skill to
  - teach me how to create a skill
  - make a skill for
---

# Skill Generator

## Purpose
This meta-skill teaches agents how to create new HOS (Human Operating System) skills following established patterns and best practices. It serves as a self-documenting guide for skill creation within the Reset Biology project ecosystem.

## When to Use This Skill
- Creating a new automation workflow that will be reused
- Documenting a complex multi-step process for future agents
- Building domain-specific capabilities (e.g., testing, deployment, debugging)
- Establishing best practices for a particular task
- Teaching other agents new capabilities

## Core Principles of Good Skills

### ✅ Good Skills Are:
1. **Specific & Actionable** - Clear purpose with concrete steps
2. **Reusable** - Solve a problem that occurs repeatedly
3. **Self-Contained** - Include all context needed to execute
4. **Well-Triggered** - Natural language phrases users would actually say
5. **Example-Rich** - Show multiple usage scenarios
6. **Tool-Aware** - Specify required tools/dependencies upfront

### ❌ Bad Skills Are:
1. **Vague** - "Do the right thing" without specifics
2. **One-Off** - Only useful for a single unique situation
3. **Context-Dependent** - Require external knowledge not in the skill
4. **Poorly Triggered** - Technical jargon or unnatural phrases
5. **Example-Poor** - No concrete usage demonstrations
6. **Tool-Agnostic** - Don't specify what's needed to run

## Step-by-Step Skill Creation Process

### Step 1: Read the Template
```bash
Read templates/skill-template.md
```
This gives you the basic structure. All skills follow this format.

### Step 2: Study Reference Skills
```bash
Read skills/playwright-vision/skill.md
```
Look at well-formed skills as examples. Notice:
- YAML frontmatter structure
- Clear section organization
- Concrete parameters and examples
- Integration notes with other skills

### Step 3: Define Your Skill's Purpose
Answer these questions:
- **What problem does this solve?** (1 sentence)
- **Who will use it?** (Agents, humans, both?)
- **When should it trigger?** (List 3-5 natural phrases)
- **What tools does it need?** (Playwright, APIs, file system?)

### Step 4: Structure Your Skill

#### Required YAML Frontmatter
```yaml
---
name: your-skill-name
description: Brief one-liner of what this does
version: 1.0.0
triggers:
  - "natural phrase 1"
  - "natural phrase 2"
  - "natural phrase 3"
---
```

**Naming Convention:**
- Use kebab-case: `playwright-vision`, `skill-generator`
- Be descriptive: `verify-auth-flow` not `check-auth`
- Avoid abbreviations: `database-migrator` not `db-mig`

**Trigger Phrases:**
- Start with action verbs: "create", "validate", "test", "check"
- Use natural language: "see what's displaying on" not "screenshot URL"
- Include variations: "create skill", "generate skill", "build skill"

#### Required Sections

1. **Purpose** - Single paragraph explaining what this does
2. **When to Use** - Bulleted list of scenarios
3. **Required Tools** - List dependencies clearly
4. **Operations** - Detailed breakdown of each capability
5. **Usage Examples** - Minimum 3 concrete examples
6. **Integration** - How it works with other skills (optional)

### Step 5: Write Clear Operations

For each operation your skill provides:

```markdown
### operation_name
Brief description of what this operation does

**Parameters:**
- `param1` (type): Description
- `param2` (type): Description
- `param3` (type, optional): Description

**Returns:**
- What the operation outputs or creates

**Usage:**
```
Natural language command showing how to invoke
```

**Example:**
See actual usage with real parameters
```
```

### Step 6: Add Rich Examples

Include at least 3 examples showing:
1. **Basic Usage** - Simplest possible invocation
2. **Advanced Usage** - With optional parameters
3. **Integration Usage** - Combined with other skills

Bad Example:
```
Use skill-generator to create a skill
```

Good Example:
```
Create a skill for validating database migrations that checks:
- Schema changes match Prisma models
- No data loss occurs
- Rollback procedure is documented
Save it to /skills/reset-biology/db-migration-validator/
```

### Step 7: Choose the Right Directory

**Directory Structure:**
```
/skills/
├── /core/              # Universal skills (any project)
│   ├── skill-generator/
│   └── task-decomposer/
├── /reset-biology/     # Project-specific skills
│   ├── peptide-validator/
│   └── auth0-debugger/
└── /[agent-name]/      # Agent-specific skills
    └── custom-skill/
```

**Decision Tree:**
- **Core** → Works on any codebase (testing, git, deployment)
- **Reset Biology** → Specific to this medical/wellness platform
- **Agent Name** → Specialized for particular agent's role

### Step 8: Create the Skill File

```bash
# Create directory
mkdir -p /skills/[category]/[skill-name]/

# Create skill file
touch /skills/[category]/[skill-name]/skill.md

# Write content following template
```

### Step 9: Test Your Skill

Before finalizing, verify:
- [ ] YAML frontmatter parses correctly
- [ ] Trigger phrases sound natural when spoken
- [ ] Examples are copy-pasteable and work
- [ ] Required tools are clearly listed
- [ ] Parameters are fully documented
- [ ] At least 3 usage examples included
- [ ] Integration points noted (if applicable)

**Test Commands:**
```
[Trigger phrase 1]
[Trigger phrase 2 with parameters]
[Example from Usage Examples section]
```

### Step 10: Update Agent Configuration (If Needed)

If creating an agent-specific skill:
```yaml
# /agents/[agent-name]/config.yaml
skills:
  - /skills/core/skill-generator
  - /skills/[agent-name]/your-new-skill
```

## Complete Skill Template

```markdown
---
name: example-skill
description: What this skill does in one line
version: 1.0.0
triggers:
  - "trigger phrase 1"
  - "trigger phrase 2"
  - "trigger phrase 3"
---

# Example Skill

## Purpose
What this skill accomplishes and why it exists.

## When to Use This Skill
- Scenario 1 where this helps
- Scenario 2 where this helps
- Scenario 3 where this helps

## Required Tools
- Tool 1 (version if applicable)
- Tool 2 with configuration notes
- Tool 3 as optional dependency

## Operations

### operation_one
Description of first operation

**Parameters:**
- `param1` (string): What it does
- `param2` (number): What it does

**Returns:**
- Description of output

**Usage:**
```
Natural language command
```

### operation_two
Description of second operation

**Parameters:**
- `param1` (boolean): What it does

**Usage:**
```
Natural language command
```

## Usage Examples

### Basic Example
```
Simple invocation with minimal parameters
```

### Advanced Example
```
Complex invocation showing all features
```

### Integration Example
```
Using this skill with another skill
```

## Integration with Other Skills
- Works with Skill A to achieve X
- Complements Skill B for Y use case

## Notes
- Important caveat or limitation
- Performance consideration
- Security note if applicable
```

## Real-World Examples

### Example 1: Database Migration Validator
**Good Skill** because it:
- Solves repeated problem (every migration needs validation)
- Clear operations (check schema, verify data, test rollback)
- Specific tools (Prisma, MongoDB)
- Natural triggers ("validate database migration")

### Example 2: Playwright Vision
**Excellent Skill** because it:
- Well-documented operations with parameters
- Rich examples (basic, responsive, interaction testing)
- Clear tool requirements (playwright_mcp)
- Integration notes with other testing skills

### Example 3: Generic "Helper" Skill
**Bad Skill** because:
- No specific purpose ("helps with things")
- Vague triggers ("do the needful")
- No concrete operations
- Missing examples

## Skill Creation Checklist

Before publishing your skill, verify:

**Structure:**
- [ ] YAML frontmatter complete and valid
- [ ] All required sections present
- [ ] Markdown formatting correct
- [ ] Code blocks properly formatted

**Content:**
- [ ] Purpose is clear and specific
- [ ] Operations have parameter documentation
- [ ] At least 3 usage examples included
- [ ] Required tools explicitly listed
- [ ] Trigger phrases are natural language

**Quality:**
- [ ] Solves a real, recurring problem
- [ ] Self-contained (no external context needed)
- [ ] Examples are copy-pasteable
- [ ] Integration points noted
- [ ] Limitations documented

**Testing:**
- [ ] Trigger phrases actually invoke skill
- [ ] Examples work as written
- [ ] Parameters are correct types
- [ ] Tool dependencies are available

## Advanced: Creating Skill Chains

Skills can invoke other skills. Example:

```markdown
## Operations

### deploy_with_validation
Deploys code after running all validation checks

**Process:**
1. Use `run-tests` skill to execute test suite
2. Use `check-typescript` skill to verify types
3. Use `playwright-vision` to visual test UI
4. Deploy to Vercel if all pass
```

This creates powerful workflows by composing existing skills.

## Maintenance and Versioning

### When to Update Version:
- **1.0.0 → 1.0.1** - Bug fixes, clarifications
- **1.0.0 → 1.1.0** - New operations added
- **1.0.0 → 2.0.0** - Breaking changes to operations

### Update Log:
Add to bottom of skill:
```markdown
## Changelog

### 1.1.0 (2025-11-04)
- Added new operation for X
- Improved documentation for Y

### 1.0.0 (2025-11-01)
- Initial release
```

## Meta: This Skill Creating Itself

This skill (`skill-generator`) follows its own guidelines:
- ✅ Specific purpose (teach skill creation)
- ✅ Reusable (any skill creation scenario)
- ✅ Self-contained (all context included)
- ✅ Well-triggered ("create a new skill")
- ✅ Example-rich (multiple scenarios)
- ✅ Tool-aware (file system, markdown)

Use this skill as a template for quality.

## Quick Reference

**Create a skill in 5 minutes:**
1. Copy `templates/skill-template.md`
2. Fill in YAML frontmatter (name, description, triggers)
3. Write Purpose and When to Use sections
4. Document 2-3 operations with parameters
5. Add 3 usage examples
6. Save to appropriate directory
7. Test one trigger phrase

**Verify quality:**
- Would I use this again next month?
- Can someone else understand this without me?
- Are the examples real and working?

## Resources

- **Template:** `/templates/skill-template.md`
- **Good Examples:** `/skills/playwright-vision/skill.md`
- **Documentation:** `/docs/skills/README.md` (if exists)
- **Agent Configs:** `/agents/*/config.yaml`

## Getting Help

If stuck during skill creation:
1. Read this skill again (seriously, it helps)
2. Study `/skills/playwright-vision/skill.md` as reference
3. Ask: "What's the simplest version of this skill?"
4. Start small, iterate later

Remember: A mediocre skill documented is better than a perfect skill imagined.
