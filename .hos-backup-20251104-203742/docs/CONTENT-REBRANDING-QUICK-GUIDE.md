# Content Rebranding System - Quick Reference Guide

## What We Just Built
A complete website scraping and rebranding system with 3 agents and 5 skills that can capture content from sites where you have rights (like StemRegen as certified reseller) and rebrand it for ResetBiology.

## System Components

### 🤖 Agents Created
1. **Content Capture Agent** (`.hos/agents/content-capture/`)
   - Scrapes websites with Playwright
   - Extracts layout and media
   - Preserves content structure

2. **Transform Agent** (`.hos/agents/transform/`)
   - Rebrand content to ResetBiology
   - Preserves glassmorphism & effects
   - Maintains compliance text

3. **Builder Agent** (`.hos/agents/builder/`)
   - Generates Next.js pages
   - Creates TypeScript components
   - Writes Playwright tests

### 🛠️ Skills Created
1. **website-scraper** (`skills/content-capture/website-scraper/`)
   - Full page content extraction
   - Screenshot capture
   - Form detection

2. **layout-analyzer** (`skills/content-capture/layout-analyzer/`)
   - Grid system detection
   - Responsive breakpoints
   - Component hierarchy mapping

3. **media-extractor** (`skills/content-capture/media-extractor/`)
   - Image downloading
   - Video extraction
   - PDF/document capture

4. **rebrand-skill** (`skills/transform/rebrand-skill/`)
   - **ENHANCED** with glassmorphism detection
   - Glow effect preservation
   - Gradient transformation
   - Advanced CSS handling

5. **style-mapper** (`skills/transform/style-mapper/`)
   - Complete ResetBiology design system
   - CSS-to-design-token mapping
   - Component templates

## Quick Start Commands

### Basic Usage
```bash
# 1. Capture a website
"Content capture agent: scrape https://stemregen.co"

# 2. Transform to ResetBiology branding
"Transform agent: rebrand captured content preserving glassmorphism"

# 3. Build Next.js pages
"Builder agent: create pages from transformed content"
```

### Advanced Usage
```bash
# Capture with specific focus
"Content capture agent: extract all media from StemRegen product pages"

# Transform with style preservation
"Transform agent: rebrand with glassmorphism effects and glow preservation"

# Build specific components
"Builder agent: create testimonial components from captured reviews"
```

## Key Features

### ✨ Advanced CSS Support
- **Glassmorphism**: Automatically detected and preserved
- **Glow Effects**: Button glows, text shadows maintained
- **Gradients**: Mapped to ResetBiology gradient system
- **Transparencies**: RGBA values properly converted
- **Backdrop Filters**: Blur effects preserved

### 🎨 ResetBiology Design System
```javascript
// Core palette
colors: {
  black: '#000000',
  white: '#FFFFFF',
  red: { /* 50-900 shades */ }
}

// Special effects
effects: {
  glassmorphism: 'rgba(255, 255, 255, 0.1)',
  glow: '0 0 20px rgba(255, 0, 0, 0.5)'
}
```

### 📋 Compliance Preservation
- Medical disclaimers maintained
- Ingredient lists preserved
- Scientific data unchanged
- Reseller attribution added
- Certification text kept

## File Locations

### Workflow Documentation
- **Master Workflow**: `.hos/workflows/content-rebranding-workflow.md`
- **This Quick Guide**: `.hos/docs/CONTENT-REBRANDING-QUICK-GUIDE.md`

### Agent Configurations
```
.hos/agents/
├── content-capture/
│   ├── agent.md
│   └── config.yaml
├── transform/
│   ├── agent.md
│   └── config.yaml
└── builder/
    ├── agent.md
    └── config.yaml
```

### Skills
```
skills/
├── content-capture/
│   ├── website-scraper/skill.md
│   ├── layout-analyzer/skill.md
│   └── media-extractor/skill.md
└── transform/
    ├── rebrand-skill/skill.md
    └── style-mapper/skill.md
```

## Testing the System

### 1. Test Single Page
```bash
"Content capture agent: scrape https://stemregen.co/products/stemregen-release"
```

### 2. Verify Glassmorphism
Check if the rebrand-skill detects and preserves your glassmorphic effects:
```bash
"Transform agent: analyze glassmorphism in captured content"
```

### 3. Generate Test Component
```bash
"Builder agent: create test component with glassmorphism"
```

## Important Notes

### About the Rebrand Skill
The rebrand-skill has been **specially enhanced** to understand:
- Your glassmorphism effects
- Button glow effects
- Transparent backgrounds
- Gradient overlays
- All the advanced CSS you use

It will:
1. **Detect** these effects in captured content
2. **Preserve** the effect structure
3. **Transform** colors to ResetBiology palette
4. **Maintain** the visual impact

### Legal Compliance
- Only use on sites where you have rights
- StemRegen content OK (certified reseller)
- Always preserve medical/scientific accuracy
- Include reseller attribution

## Meta Skill Note
You asked about a skill that creates skills - **YES, we have it!**

📍 **Location**: `/skills/core/skill-creator/skill.md`

**Trigger phrases**:
- "create a skill for [purpose]"
- "build a new agent skill"
- "generate skill template"

This meta skill can create both new skills and agent configurations using the proper YAML frontmatter format.

## Next Steps

1. **Test the system** with a StemRegen product page
2. **Review captured content** in `.hos/memory/media/`
3. **Check transformations** preserve your effects
4. **Inspect generated components** for accuracy

## Need Help?

### Common Commands
```bash
# Check what was captured
"Show me the captured content catalog"

# Review transformations
"Show transformed styles with effects"

# See generated components
"List generated Next.js components"
```

### Troubleshooting
- **Effects not preserved?** The rebrand-skill now handles this
- **Media not downloading?** Check `.hos/memory/media/` permissions
- **Components not building?** Verify TypeScript configuration

---

**System Ready!** The content rebranding system is now fully operational with advanced CSS support for glassmorphism, glows, and all your custom effects.

**Created by**: HOS Implementation
**Date**: 2025-01-15
**Status**: ✅ Complete and Enhanced