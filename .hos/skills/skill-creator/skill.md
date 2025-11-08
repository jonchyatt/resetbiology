---
name: skill-creator
description: Creates properly formatted Claude Skills that agents can use
version: 1.0.0
triggers:
  - when asked to create a new skill
  - when an agent needs a specialized capability
  - create a skill for
  - generate a new skill
---

# Skill Creator

## Purpose
Generates properly formatted Claude Skills with correct YAML frontmatter, trigger patterns, and structure that can be used by Claude agents.

## When to Use
- Creating new skills for agents
- Agent needs specialized capability not covered by existing skills
- Repeated pattern detected (same task 3+ times)
- User explicitly requests a new skill

## Skill Structure Requirements
Every skill MUST include:
1. YAML frontmatter with:
   - name (kebab-case)
   - description (one clear line)
   - version (semver)
   - triggers (array of phrases)
2. Clear purpose section
3. When to use section
4. Operations/capabilities section
5. Usage examples

## Operations

### create_skill
Creates a new skill file with proper structure.

Parameters:
- skill_name: kebab-case name
- description: One-line clear description
- triggers: Array of trigger phrases
- purpose: What the skill does
- use_cases: When to use it
- operations: What it can do

### validate_skill
Checks skill has proper YAML frontmatter and structure.

Parameters:
- file_path: Path to skill.md file

## Output Format
Generates complete skill.md file at:
`.hos/skills/[skill-name]/skill.md`

## Usage Examples
- "Create a skill for validating links"
- "Generate a new skill called responsive-tester"
- "I need a skill that checks CSS styles"
