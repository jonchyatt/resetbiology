---
name: skill-creator
description: Creates properly formatted Claude Skills that agents can use
version: 1.0.0
triggers:
  - when asked to create a new skill
  - when an agent needs a specialized capability
  - create a skill for
  - generate a skill that
---

# Skill Creator

## Purpose
Creates properly formatted Claude Skills that sub-agents can invoke and use.

## When to Use
- When asked to create a new skill
- When an agent needs a specialized capability
- When you say "create a skill for [task]"

## Skill Creation Process

### 1. Analyze Requirements
Determine what the skill needs to do

### 2. Create Skill Structure
Every skill needs:
- skill.md with YAML frontmatter
- Clear trigger phrases
- Implementation instructions
- Optional Python scripts

### 3. Package
ZIP the skill directory into [skill-name].zip or [skill-name].skill

## Usage Examples
- "Create a skill for validating biology content"
- "Generate a skill that checks link integrity"
