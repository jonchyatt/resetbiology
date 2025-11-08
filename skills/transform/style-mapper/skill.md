---
name: style-mapper
agent: transform
type: mapping
model: claude-3-haiku
---

# Style Mapper Skill

## Purpose
Maps captured styles to ResetBiology's design system, creating a translation layer between original and rebranded styles.

## Trigger Phrases
- "map styles to design system"
- "create style translation"
- "convert to ResetBiology theme"
- "generate style mapping rules"
- "translate CSS to our system"

## ResetBiology Design System

### 1. Core Design Tokens
```javascript
const resetBiologyDesignSystem = {
  // Typography
  typography: {
    fontFamily: {
      heading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'JetBrains Mono', 'Courier New', monospace"
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem'     // 48px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75
    }
  },

  // Colors
  colors: {
    // Primary palette
    black: '#000000',
    white: '#FFFFFF',
    red: {
      50: '#FFF5F5',
      100: '#FED7D7',
      200: '#FEB2B2',
      300: '#FC8181',
      400: '#F56565',
      500: '#E53E3E',
      600: '#C53030',
      700: '#9B2C2C',
      800: '#822727',
      900: '#63171B'
    },

    // Neutral grays
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827'
    },

    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6'
  },

  // Spacing
  spacing: {
    0: '0',
    px: '1px',
    0.5: '0.125rem',  // 2px
    1: '0.25rem',     // 4px
    2: '0.5rem',      // 8px
    3: '0.75rem',     // 12px
    4: '1rem',        // 16px
    5: '1.25rem',     // 20px
    6: '1.5rem',      // 24px
    8: '2rem',        // 32px
    10: '2.5rem',     // 40px
    12: '3rem',       // 48px
    16: '4rem',       // 64px
    20: '5rem',       // 80px
    24: '6rem',       // 96px
    32: '8rem'        // 128px
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    DEFAULT: '0.25rem',// 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px'
  },

  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    glow: '0 0 20px rgba(255, 0, 0, 0.5)',
    glowSubtle: '0 0 10px rgba(255, 255, 255, 0.2)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
  },

  // Special effects
  effects: {
    glassmorphism: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.18)'
    },
    darkGlassmorphism: {
      background: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    },
    gradient: {
      hero: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      card: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      button: 'linear-gradient(90deg, #FF0000 0%, #CC0000 100%)'
    }
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    base: '250ms ease-in-out',
    slow: '350ms ease-in-out',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
};
```

### 2. Style Mapping Algorithm
```javascript
class StyleMapper {
  constructor(originalStyles, designSystem) {
    this.original = originalStyles;
    this.designSystem = designSystem;
    this.mappings = new Map();
  }

  // Map colors
  mapColor(originalColor) {
    // Convert to RGB for comparison
    const rgb = this.colorToRGB(originalColor);

    // Find closest match in design system
    if (this.isGray(rgb)) {
      return this.findClosestGray(rgb);
    }

    // Map brand colors
    if (this.isBrandColor(originalColor)) {
      return this.designSystem.colors.red[600];
    }

    // Default mapping
    return this.findClosestSystemColor(rgb);
  }

  // Map typography
  mapTypography(originalFont) {
    const fontMap = {
      'serif': this.designSystem.typography.fontFamily.body,
      'sans-serif': this.designSystem.typography.fontFamily.heading,
      'monospace': this.designSystem.typography.fontFamily.mono
    };

    // Check for specific font names
    const fontFamily = originalFont.toLowerCase();
    for (const [key, value] of Object.entries(fontMap)) {
      if (fontFamily.includes(key)) {
        return value;
      }
    }

    return this.designSystem.typography.fontFamily.body;
  }

  // Map spacing
  mapSpacing(originalValue) {
    const px = this.toPx(originalValue);

    // Find closest spacing value
    const spacingValues = Object.entries(this.designSystem.spacing)
      .map(([key, value]) => ({
        key,
        px: this.toPx(value)
      }))
      .sort((a, b) => Math.abs(a.px - px) - Math.abs(b.px - px));

    return this.designSystem.spacing[spacingValues[0].key];
  }

  // Map shadows
  mapBoxShadow(originalShadow) {
    // Parse shadow properties
    const shadowProps = this.parseShadow(originalShadow);

    if (shadowProps.isGlow) {
      return shadowProps.intensity > 15
        ? this.designSystem.boxShadow.glow
        : this.designSystem.boxShadow.glowSubtle;
    }

    if (shadowProps.isInset) {
      return this.designSystem.boxShadow.inner;
    }

    // Map by blur radius
    if (shadowProps.blur < 4) return this.designSystem.boxShadow.sm;
    if (shadowProps.blur < 8) return this.designSystem.boxShadow.md;
    if (shadowProps.blur < 16) return this.designSystem.boxShadow.lg;
    if (shadowProps.blur < 25) return this.designSystem.boxShadow.xl;
    return this.designSystem.boxShadow['2xl'];
  }

  // Helper methods
  colorToRGB(color) {
    // Implementation to convert any color format to RGB
    // Handles hex, rgb, rgba, hsl, hsla, named colors
  }

  isGray(rgb) {
    const tolerance = 10;
    return Math.abs(rgb.r - rgb.g) < tolerance &&
           Math.abs(rgb.g - rgb.b) < tolerance;
  }

  isBrandColor(color) {
    // Check if color is a brand color that needs replacement
    const brandColors = ['#4CAF50', '#2196F3', 'green', 'blue'];
    return brandColors.some(brand =>
      color.toLowerCase().includes(brand.toLowerCase())
    );
  }

  parseShadow(shadow) {
    const isInset = shadow.includes('inset');
    const isGlow = shadow.includes('0 0');
    const blurMatch = shadow.match(/(\d+)px/g);
    const blur = blurMatch ? parseInt(blurMatch[2] || blurMatch[0]) : 0;

    return { isInset, isGlow, blur, intensity: blur };
  }

  toPx(value) {
    if (typeof value === 'number') return value;
    if (value.includes('px')) return parseFloat(value);
    if (value.includes('rem')) return parseFloat(value) * 16;
    if (value.includes('em')) return parseFloat(value) * 16;
    return 0;
  }
}
```

### 3. Component Style Templates
```javascript
const componentTemplates = {
  // Hero section
  hero: {
    container: {
      position: 'relative',
      minHeight: '100vh',
      background: resetBiologyDesignSystem.effects.gradient.hero,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    content: {
      maxWidth: '1200px',
      padding: resetBiologyDesignSystem.spacing[8],
      textAlign: 'center',
      color: resetBiologyDesignSystem.colors.white
    },
    heading: {
      fontSize: resetBiologyDesignSystem.typography.fontSize['5xl'],
      fontWeight: resetBiologyDesignSystem.typography.fontWeight.bold,
      lineHeight: resetBiologyDesignSystem.typography.lineHeight.tight,
      marginBottom: resetBiologyDesignSystem.spacing[6]
    }
  },

  // Product card
  productCard: {
    container: {
      ...resetBiologyDesignSystem.effects.glassmorphism,
      borderRadius: resetBiologyDesignSystem.borderRadius.xl,
      padding: resetBiologyDesignSystem.spacing[6],
      transition: resetBiologyDesignSystem.transitions.base
    },
    hover: {
      transform: 'translateY(-4px)',
      boxShadow: resetBiologyDesignSystem.boxShadow.glow
    }
  },

  // Button
  button: {
    base: {
      padding: `${resetBiologyDesignSystem.spacing[3]} ${resetBiologyDesignSystem.spacing[6]}`,
      borderRadius: resetBiologyDesignSystem.borderRadius.md,
      fontWeight: resetBiologyDesignSystem.typography.fontWeight.semibold,
      transition: resetBiologyDesignSystem.transitions.base,
      cursor: 'pointer'
    },
    primary: {
      background: resetBiologyDesignSystem.effects.gradient.button,
      color: resetBiologyDesignSystem.colors.white,
      border: 'none'
    },
    secondary: {
      background: 'transparent',
      color: resetBiologyDesignSystem.colors.red[600],
      border: `2px solid ${resetBiologyDesignSystem.colors.red[600]}`
    }
  }
};
```

### 4. CSS Generation
```javascript
function generateMappedStyles(mappings) {
  const css = [];

  // Generate CSS custom properties
  css.push(':root {');
  Object.entries(resetBiologyDesignSystem.colors).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([shade, color]) => {
        css.push(`  --color-${key}-${shade}: ${color};`);
      });
    } else {
      css.push(`  --color-${key}: ${value};`);
    }
  });

  // Spacing custom properties
  Object.entries(resetBiologyDesignSystem.spacing).forEach(([key, value]) => {
    css.push(`  --spacing-${key}: ${value};`);
  });
  css.push('}');

  // Generate component classes
  Object.entries(componentTemplates).forEach(([component, styles]) => {
    Object.entries(styles).forEach(([variant, properties]) => {
      const className = variant === 'container'
        ? `.rb-${component}`
        : `.rb-${component}--${variant}`;

      css.push(`${className} {`);
      Object.entries(properties).forEach(([prop, value]) => {
        css.push(`  ${camelToKebab(prop)}: ${value};`);
      });
      css.push('}');
    });
  });

  return css.join('\n');
}

function camelToKebab(str) {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}
```

## Output Format
```json
{
  "mappings": {
    "colors": {
      "#4CAF50": "var(--color-red-600)",
      "#2196F3": "var(--color-black)"
    },
    "typography": {
      "Roboto": "'Inter', sans-serif",
      "Arial": "'Inter', sans-serif"
    },
    "spacing": {
      "15px": "var(--spacing-4)",
      "30px": "var(--spacing-8)"
    },
    "components": {
      "hero": "rb-hero",
      "card": "rb-product-card",
      "button": "rb-button"
    }
  },
  "generatedCSS": "/* ResetBiology mapped styles */",
  "designTokens": {...},
  "conversionReport": {
    "totalStyles": 150,
    "mapped": 145,
    "customRequired": 5
  }
}
```

## Usage Example
```javascript
const mapper = new StyleMapper(capturedStyles, resetBiologyDesignSystem);

// Map all styles
const colorMappings = capturedStyles.colors.map(c => ({
  original: c,
  mapped: mapper.mapColor(c)
}));

const spacingMappings = capturedStyles.spacing.map(s => ({
  original: s,
  mapped: mapper.mapSpacing(s)
}));

// Generate CSS
const css = generateMappedStyles({
  colors: colorMappings,
  spacing: spacingMappings,
  components: componentTemplates
});
```