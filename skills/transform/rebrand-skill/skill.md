---
name: rebrand-skill
agent: transform
type: transformation
model: claude-3-sonnet
---

# Rebrand Skill - Advanced CSS & Effects

## Purpose
Transforms captured content with ResetBiology branding while preserving advanced CSS effects like glassmorphism, glows, transparencies, and gradients.

## Trigger Phrases
- "rebrand with glassmorphism effects"
- "transform keeping glow effects"
- "apply ResetBiology style with transparencies"
- "convert branding preserve advanced CSS"
- "maintain glassmorphic design"

## Advanced Style Detection

### 1. Glassmorphism Detection
```javascript
async function detectGlassmorphism(page) {
  const glassEffects = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const glassmorphic = [];

    elements.forEach(el => {
      const styles = window.getComputedStyle(el);

      // Check for glassmorphism characteristics
      const hasBackdropFilter = styles.backdropFilter && styles.backdropFilter !== 'none';
      const hasTransparency = styles.backgroundColor?.includes('rgba') ||
                              styles.backgroundColor?.includes('hsla');
      const hasBlur = styles.backdropFilter?.includes('blur') ||
                     styles.filter?.includes('blur');
      const hasBorder = styles.border !== 'none' || styles.borderRadius !== '0px';

      if (hasBackdropFilter || (hasTransparency && hasBlur)) {
        glassmorphic.push({
          selector: el.className || el.id || el.tagName,
          effects: {
            backdropFilter: styles.backdropFilter,
            backgroundColor: styles.backgroundColor,
            border: styles.border,
            borderRadius: styles.borderRadius,
            boxShadow: styles.boxShadow
          },
          computed: {
            isGlassmorphic: true,
            transparency: extractAlpha(styles.backgroundColor),
            blurAmount: extractBlurAmount(styles.backdropFilter || styles.filter)
          }
        });
      }
    });

    return glassmorphic;
  });

  return glassEffects;
}

function extractAlpha(color) {
  const match = color?.match(/rgba?\([^,]+,[^,]+,[^,]+,?\s*([0-9.]+)?\)/);
  return match ? parseFloat(match[1] || 1) : 1;
}

function extractBlurAmount(filter) {
  const match = filter?.match(/blur\(([0-9.]+)px\)/);
  return match ? parseFloat(match[1]) : 0;
}
```

### 2. Glow Effects Detection
```javascript
async function detectGlowEffects(page) {
  const glowElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('button, a, .glow, [class*="glow"]'));
    const glows = [];

    elements.forEach(el => {
      const styles = window.getComputedStyle(el);
      const hoverStyles = window.getComputedStyle(el, ':hover');

      // Check for glow characteristics
      const hasGlow = styles.boxShadow?.includes('0 0') ||
                     styles.textShadow?.includes('0 0') ||
                     styles.filter?.includes('drop-shadow');

      if (hasGlow) {
        glows.push({
          selector: el.className || el.tagName,
          glowType: determineGlowType(styles),
          effects: {
            boxShadow: styles.boxShadow,
            textShadow: styles.textShadow,
            filter: styles.filter,
            transition: styles.transition
          },
          hover: {
            boxShadow: hoverStyles.boxShadow,
            transform: hoverStyles.transform
          }
        });
      }
    });

    return glows;
  });

  return glowElements;
}

function determineGlowType(styles) {
  if (styles.boxShadow?.includes('inset')) return 'inner-glow';
  if (styles.textShadow !== 'none') return 'text-glow';
  if (styles.filter?.includes('drop-shadow')) return 'drop-shadow-glow';
  return 'outer-glow';
}
```

### 3. Advanced Gradient Detection
```javascript
async function detectGradients(page) {
  const gradients = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const gradientElements = [];

    elements.forEach(el => {
      const styles = window.getComputedStyle(el);

      // Check all gradient types
      const hasGradient =
        styles.backgroundImage?.includes('gradient') ||
        styles.background?.includes('gradient');

      if (hasGradient) {
        const gradientType = detectGradientType(styles.backgroundImage || styles.background);

        gradientElements.push({
          selector: el.className || el.id || el.tagName,
          gradientType,
          original: styles.backgroundImage || styles.background,
          colors: extractGradientColors(styles.backgroundImage || styles.background),
          angle: extractGradientAngle(styles.backgroundImage || styles.background)
        });
      }
    });

    return gradientElements;
  });

  return gradients;
}

function detectGradientType(gradient) {
  if (gradient.includes('linear-gradient')) return 'linear';
  if (gradient.includes('radial-gradient')) return 'radial';
  if (gradient.includes('conic-gradient')) return 'conic';
  return 'unknown';
}

function extractGradientColors(gradient) {
  const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g;
  return gradient.match(colorRegex) || [];
}

function extractGradientAngle(gradient) {
  const angleMatch = gradient.match(/(\d+)deg/);
  return angleMatch ? parseInt(angleMatch[1]) : 0;
}
```

## ResetBiology Style Transformation

### 1. Color Mapping with Effects Preservation
```javascript
const resetBiologyPalette = {
  // Core colors
  primary: '#000000',
  secondary: '#FFFFFF',
  accent: '#FF0000',

  // Glassmorphism variants
  glass: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    dark: 'rgba(0, 0, 0, 0.3)',
    border: 'rgba(255, 255, 255, 0.18)'
  },

  // Glow colors
  glow: {
    red: '0 0 20px rgba(255, 0, 0, 0.5)',
    white: '0 0 20px rgba(255, 255, 255, 0.5)',
    subtle: '0 0 10px rgba(255, 255, 255, 0.2)'
  },

  // Gradients
  gradients: {
    hero: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
    card: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    button: 'linear-gradient(90deg, #FF0000 0%, #CC0000 100%)'
  }
};

function transformGlassmorphism(originalEffect) {
  return {
    backdropFilter: originalEffect.backdropFilter || 'blur(10px)',
    backgroundColor: resetBiologyPalette.glass.light,
    border: `1px solid ${resetBiologyPalette.glass.border}`,
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
  };
}

function transformGlow(originalGlow) {
  const intensity = extractGlowIntensity(originalGlow.boxShadow);

  return {
    boxShadow: intensity > 15
      ? resetBiologyPalette.glow.red
      : resetBiologyPalette.glow.subtle,
    transition: 'all 0.3s ease',
    hover: {
      boxShadow: resetBiologyPalette.glow.white,
      transform: 'translateY(-2px)'
    }
  };
}

function extractGlowIntensity(shadow) {
  const match = shadow?.match(/0 0 (\d+)px/);
  return match ? parseInt(match[1]) : 0;
}
```

### 2. Advanced CSS Generation
```javascript
function generateAdvancedCSS(transformedStyles) {
  const css = [];

  // Glassmorphism classes
  transformedStyles.glassmorphism.forEach(item => {
    css.push(`
      .glass-card {
        background: ${resetBiologyPalette.glass.light};
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: 10px;
        border: 1px solid ${resetBiologyPalette.glass.border};
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      }

      .glass-dark {
        background: ${resetBiologyPalette.glass.dark};
        backdrop-filter: blur(20px);
      }
    `);
  });

  // Glow effects
  css.push(`
    .glow-button {
      position: relative;
      padding: 12px 24px;
      background: ${resetBiologyPalette.primary};
      color: ${resetBiologyPalette.secondary};
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .glow-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .glow-button:hover {
      box-shadow: ${resetBiologyPalette.glow.red};
      transform: translateY(-2px);
    }

    .glow-button:hover::before {
      left: 100%;
    }
  `);

  // Gradient overlays
  css.push(`
    .gradient-overlay {
      position: relative;
      background: ${resetBiologyPalette.gradients.hero};
    }

    .gradient-overlay::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${resetBiologyPalette.gradients.card};
      pointer-events: none;
    }
  `);

  return css.join('\n');
}
```

### 3. Component Transformation Rules
```javascript
const transformationRules = {
  // Preserve scientific content
  preserveContent: [
    'ingredients',
    'dosage',
    'clinical-data',
    'research-citations',
    'medical-disclaimers'
  ],

  // Transform branding
  replaceBranding: {
    'StemRegen': 'ResetBiology',
    'stem-regen': 'reset-biology',
    '#4CAF50': resetBiologyPalette.accent, // Green to red
    '#2196F3': resetBiologyPalette.primary  // Blue to black
  },

  // Enhance with ResetBiology effects
  addEffects: {
    cards: 'glassmorphism',
    buttons: 'glow',
    heroes: 'gradient-overlay',
    modals: 'glassmorphism-dark'
  }
};

function applyTransformationRules(element, rules) {
  let transformed = {...element};

  // Preserve important content
  if (rules.preserveContent.includes(element.dataType)) {
    transformed.preserved = true;
    transformed.content = element.originalContent;
  }

  // Replace branding
  Object.entries(rules.replaceBranding).forEach(([original, replacement]) => {
    transformed.text = transformed.text?.replace(original, replacement);
    transformed.styles = transformed.styles?.replace(original, replacement);
  });

  // Add ResetBiology effects
  if (rules.addEffects[element.type]) {
    transformed.effects = rules.addEffects[element.type];
  }

  return transformed;
}
```

## Output Format
```json
{
  "detectedEffects": {
    "glassmorphism": [...],
    "glows": [...],
    "gradients": [...],
    "animations": [...]
  },
  "transformedStyles": {
    "css": "/* Generated ResetBiology styles */",
    "components": {
      "GlassCard": {...},
      "GlowButton": {...},
      "GradientHero": {...}
    }
  },
  "preservedElements": {
    "scientific": [...],
    "compliance": [...],
    "certifications": [...]
  }
}
```

## Training & Learning

The skill learns from:
1. **Pattern Recognition**: Analyzes existing ResetBiology components for style patterns
2. **Effect Libraries**: Maintains catalog of approved effects
3. **Feedback Loop**: Updates transformation rules based on results
4. **Visual Comparison**: Uses Playwright screenshots to verify transformations

## Usage Example
```javascript
// Detect and transform advanced styles
const effects = await detectGlassmorphism(page);
const glows = await detectGlowEffects(page);
const gradients = await detectGradients(page);

const transformed = {
  glassmorphism: effects.map(e => transformGlassmorphism(e)),
  glows: glows.map(g => transformGlow(g)),
  gradients: gradients.map(g => transformGradient(g))
};

const css = generateAdvancedCSS(transformed);
```