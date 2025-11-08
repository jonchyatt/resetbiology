# Skill Creator - Meta Skill

This skill generates other Claude Skills when patterns are detected or new capabilities are needed.

## What It Does
- Analyzes patterns to determine skill requirements
- Generates properly formatted skill.md with YAML frontmatter
- Creates Python implementations when needed
- Packages skills ready for agent use
- Integrates with Observer agent for automatic skill generation

## Trigger Phrases
- "Create a skill for [task]"
- "Generate a skill that [does something]"
- "Noticed repeated pattern of [pattern]"
- "Need a skill to [capability]"

## Generated Skills Stored In
- `/skills/reset-biology/` - ResetBiology-specific skills
- `/skills/shared/` - Multi-project skills
- `/skills/[agent]/` - Agent-specific skills

## Quality Standards
All generated skills include:
- Proper YAML frontmatter
- 3+ specific trigger phrases
- Clear operations documentation
- 3+ usage examples
- Tool requirements
- Integration notes

## Meta Note
This is a recursive capability - it creates the skills that agents use, and can create skills to create better skills.
