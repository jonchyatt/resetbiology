# Claude Skill Template

## Directory Structure
```
/skill-name/
├── skill.md          # Main skill file with YAML frontmatter
├── script.py         # Optional: Python implementation
└── test_data.csv     # Optional: Test data
```

## skill.md Format

```markdown
---
name: skill-name
description: Brief description of what this skill does
version: 1.0.0
triggers:
  - "trigger phrase 1"
  - "trigger phrase 2"
  - "trigger phrase 3"
---

# Skill Name

## Purpose
What this skill accomplishes

## When to Use
- Situation 1
- Situation 2
- Situation 3

## Required Tools
- List any tools needed (e.g., playwright_mcp, specific APIs)

## Operations

### operation_name
Description of operation
Parameters: param1, param2, param3

## Usage Examples
- "Example command 1"
- "Example command 2"
```

## Packaging
```bash
cd /skills/
zip -r skill-name.zip skill-name/
# Or rename: mv skill-name.zip skill-name.skill
```
