---
name: skill-creator
description: Generates new Claude Skills when patterns are detected or capabilities needed
version: 2.0.0
triggers:
  - create a skill for
  - generate a skill that
  - noticed repeated pattern
  - need a skill to
  - build a skill for
---

# Skill Creator

## Purpose
Automatically generates properly formatted Claude Skills when:
- Repeated patterns are detected (3+ occurrences)
- An agent needs a new capability
- User explicitly requests a skill
- Observer identifies improvement opportunity

## When to Use This Skill
- "Create a skill for [task]"
- "Generate a skill that [does something]"
- When you notice doing the same task 3+ times
- When an agent lacks needed capability

## Skill Generation Process

### 1. Pattern Analysis
```
Input: Task description or observed pattern
Output: Skill requirements and specifications
```

Analyze:
- What problem does this solve?
- Which agents will use it?
- What tools/APIs are needed?
- What are the trigger phrases?
- Is this ResetBiology-specific or general?

### 2. Skill Structure Generation

Every generated skill must have:

**Required Components:**
- `skill.md` with proper YAML frontmatter
- Clear, specific trigger phrases (3-5 minimum)
- Detailed operations section
- Usage examples (3-5 real examples)
- Purpose and "When to Use" sections

**Optional Components:**
- `script.py` for complex operations
- `test_data.csv` for test cases
- `README.md` for documentation

### 3. YAML Frontmatter Template

```yaml
---
name: skill-name-in-kebab-case
description: One clear sentence describing what this skill does
version: 1.0.0
triggers:
  - "specific trigger phrase 1"
  - "specific trigger phrase 2"
  - "specific trigger phrase 3"
---
```

### 4. Skill.md Template

```markdown
# Skill Name

## Purpose
Clear statement of what this skill accomplishes.

## When to Use
- Specific situation 1
- Specific situation 2
- Specific situation 3

## Required Tools
(if any)
- tool_name (version if applicable)
- API requirements
- Access requirements

## Operations

### operation_name
Clear description of what this operation does

**Parameters:**
- param1 (type): description
- param2 (type): description

**Returns:**
- return_value (type): description

**Usage:**
```
Example command using this operation
```

### another_operation
...

## Usage Examples

### Example 1: [Descriptive Name]
```
Specific command showing how to use this skill
```

### Example 2: [Descriptive Name]
```
Another specific usage example
```

## Integration with Other Skills
(if applicable)
- Works with skill-X to do Y
- Complements skill-Z for W

## Notes
- Important limitations
- Performance considerations
- Special requirements
```

### 5. Python Script Template (if needed)

```python
"""
[Skill Name] - [Brief Description]
"""

from typing import Dict, List, Optional, Any

class SkillImplementation:
    """
    Implementation for [skill name] skill
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the skill

        Args:
            config: Configuration dictionary
        """
        self.config = config

    def operation_name(self, param1: str, param2: int) -> Dict[str, Any]:
        """
        Description of what this operation does

        Args:
            param1: Description
            param2: Description

        Returns:
            Dict containing:
                - success (bool): Operation success
                - data (Any): Operation result
                - error (str, optional): Error message if failed
        """
        try:
            # Implementation here
            result = {}

            return {
                "success": True,
                "data": result
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Usage example
if __name__ == "__main__":
    skill = SkillImplementation({})
    result = skill.operation_name("test", 42)
    print(result)
```

### 6. Packaging Instructions

```bash
# Structure:
/skill-name/
├── skill.md
├── script.py (if needed)
├── test_data.csv (if needed)
└── README.md (optional)

# Package as ZIP:
cd skills/
zip -r skill-name.zip skill-name/

# Or rename to .skill:
mv skill-name.zip skill-name.skill
```

## ResetBiology-Specific Pattern Recognition

When generating skills for ResetBiology.com, consider:

### Domain-Specific Patterns
- **Biology Content**: Scientific accuracy, citation checking
- **Health Tracking**: Data validation, privacy considerations
- **E-commerce**: Payment security, order processing
- **User Authentication**: Auth0 integration patterns
- **Database Operations**: Prisma ORM patterns

### Common ResetBiology Tasks
1. **Content Validation**
   - Check scientific accuracy
   - Validate citations
   - Ensure readability (grade 10-12)

2. **Link Integrity**
   - Internal navigation
   - External research links
   - PubMed citations

3. **Mobile Responsiveness**
   - Touch targets (min 44x44px)
   - Viewport behavior
   - Performance on mobile networks

4. **Checkout Flow**
   - Stripe test card handling
   - Order creation in MongoDB
   - Email confirmation

5. **SEO Optimization**
   - Health/biology keyword optimization
   - Meta tag validation
   - Schema.org markup for articles

## Usage Examples

### Example 1: Create Skill from Pattern
```
User: "I keep checking if research citations are valid. Can we automate this?"

Response: "I'll use skill-creator to generate a citation-validator skill"

Generated: /skills/reset-biology/citation-validator/
- Validates PubMed links
- Checks DOI resolution
- Verifies publication dates
```

### Example 2: Agent Needs Capability
```
Observer: "I notice nutrition calculations are inconsistent"

Response: "Using skill-creator to build nutrition-validator skill"

Generated: /skills/reset-biology/nutrition-validator/
- Validates macro calculations
- Checks serving size math
- Ensures data consistency
```

### Example 3: Explicit Request
```
User: "Create a skill for testing the peptide dosage calculator"

Response: "Using skill-creator..."

Generated: /skills/reset-biology/peptide-calculator-tester/
- Tests dosage calculations
- Validates unit conversions
- Checks edge cases
```

## Skill Naming Conventions

### Format: `[scope]-[function]-[type]`

**Scope:**
- `reset-biology` - ResetBiology-specific
- `shared` - Usable by multiple projects
- `[agent-name]` - Agent-specific

**Function:**
- What the skill does (link-validator, seo-optimizer)

**Type:**
- validator, generator, tester, monitor, optimizer, scanner

**Examples:**
- `reset-biology-link-validator`
- `shared-playwright-vision`
- `architect-system-design`
- `reset-biology-checkout-validator`

## Quality Checklist

Before finalizing a generated skill, verify:

- [ ] YAML frontmatter is properly formatted
- [ ] At least 3 specific trigger phrases
- [ ] Clear purpose statement
- [ ] "When to Use" section with 3+ scenarios
- [ ] Operations clearly documented
- [ ] At least 3 usage examples
- [ ] Parameters and returns documented
- [ ] Tool requirements specified
- [ ] Follows naming conventions
- [ ] Packaged as .zip or .skill file

## Testing Generated Skills

After creation:
1. Test skill invocation with each trigger phrase
2. Verify operations work as documented
3. Test integration with target agent
4. Validate packaging is correct
5. Update user manual with new skill

## Storage Locations

Generated skills stored in:
- `/skills/[scope]/[skill-name]/` - Main storage
- `/skills/shared/` - If usable by multiple agents
- `/.hos/skills/generated/` - Auto-generated skills log

## Integration with Observer Agent

Observer agent can trigger skill creation when:
- Pattern detected 3+ times in 7 days
- New pain point identified
- Efficiency opportunity found
- User feedback suggests need

## Version Control

Skills are versioned:
- `1.0.0` - Initial creation
- `1.1.0` - Minor enhancements
- `2.0.0` - Major changes/breaking

Update version in YAML frontmatter when modifying.

---

## Meta Note

This skill creates other skills. It's recursive capability - use it to generate skills for new patterns as ResetBiology.com evolves.
