---
name: layout-analyzer
agent: content-capture
type: analysis
model: claude-3-haiku
---

# Layout Analyzer Skill

## Purpose
Analyzes page layout, component hierarchy, grid systems, and responsive behavior for accurate reconstruction.

## Trigger Phrases
- "analyze page layout"
- "extract component structure"
- "map grid system"
- "identify layout patterns"
- "detect responsive breakpoints"

## Implementation

### 1. Component Detection
```javascript
async function analyzeLayout(page) {
  const layout = await page.evaluate(() => {
    // Helper to get computed styles
    const getStyles = (element) => {
      const styles = window.getComputedStyle(element);
      return {
        display: styles.display,
        position: styles.position,
        grid: styles.gridTemplateColumns,
        flex: styles.flexDirection,
        padding: styles.padding,
        margin: styles.margin,
        width: styles.width,
        height: styles.height
      };
    };

    // Detect major sections
    const sections = [];
    const sectionElements = document.querySelectorAll('header, nav, main, section, article, aside, footer');

    sectionElements.forEach(section => {
      const bounds = section.getBoundingClientRect();
      sections.push({
        type: section.tagName.toLowerCase(),
        id: section.id,
        class: section.className,
        position: {
          top: bounds.top,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height
        },
        styles: getStyles(section),
        children: section.children.length
      });
    });

    return sections;
  });
```

### 2. Grid System Detection
```javascript
  const gridSystem = await page.evaluate(() => {
    // Check for common grid frameworks
    const hasBootstrap = !!document.querySelector('[class*="col-"]');
    const hasTailwind = !!document.querySelector('[class*="grid-cols-"]');

    // Detect custom grid
    const containers = document.querySelectorAll('[class*="container"], [class*="wrapper"]');
    const gridInfo = {
      framework: hasBootstrap ? 'bootstrap' : hasTailwind ? 'tailwind' : 'custom',
      containers: []
    };

    containers.forEach(container => {
      const styles = window.getComputedStyle(container);
      gridInfo.containers.push({
        maxWidth: styles.maxWidth,
        padding: styles.padding,
        margin: styles.margin,
        display: styles.display
      });
    });

    // Detect CSS Grid usage
    const gridElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const display = window.getComputedStyle(el).display;
      return display === 'grid' || display === 'inline-grid';
    });

    gridInfo.cssGrids = gridElements.map(el => ({
      selector: el.className || el.id || el.tagName,
      columns: window.getComputedStyle(el).gridTemplateColumns,
      rows: window.getComputedStyle(el).gridTemplateRows,
      gap: window.getComputedStyle(el).gap
    }));

    return gridInfo;
  });
```

### 3. Component Hierarchy
```javascript
  const hierarchy = await page.evaluate(() => {
    function buildHierarchy(element, depth = 0) {
      if (depth > 5) return null; // Limit depth

      const children = Array.from(element.children)
        .filter(child => {
          // Filter out scripts and styles
          return !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(child.tagName);
        })
        .map(child => buildHierarchy(child, depth + 1))
        .filter(Boolean);

      return {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: element.className,
        role: element.getAttribute('role'),
        'data-testid': element.getAttribute('data-testid'),
        children: children.length > 0 ? children : undefined
      };
    }

    return buildHierarchy(document.body);
  });
```

### 4. Responsive Breakpoints
```javascript
  // Test different viewport sizes
  const breakpoints = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'wide', width: 1920, height: 1080 }
  ];

  const responsiveData = {};

  for (const breakpoint of breakpoints) {
    await page.setViewportSize(breakpoint);
    await page.waitForTimeout(500);

    responsiveData[breakpoint.name] = await page.evaluate(() => {
      // Check visibility of elements
      const visibilityMap = {};
      const keyElements = document.querySelectorAll('[data-responsive], .mobile-only, .desktop-only, .tablet-only');

      keyElements.forEach(el => {
        const bounds = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        visibilityMap[el.className || el.id] = {
          visible: styles.display !== 'none',
          width: bounds.width,
          position: styles.position
        };
      });

      return {
        visibility: visibilityMap,
        menuType: document.querySelector('.hamburger, .mobile-menu') ? 'mobile' : 'desktop',
        columns: document.querySelector('[class*="col-"]')?.className
      };
    });
  }
```

### 5. Spacing Analysis
```javascript
  const spacing = await page.evaluate(() => {
    const elements = document.querySelectorAll('section, article, div[class]');
    const spacingPatterns = new Set();

    elements.forEach(el => {
      const styles = window.getComputedStyle(el);
      spacingPatterns.add(styles.padding);
      spacingPatterns.add(styles.margin);
    });

    // Find common spacing values
    const spacingValues = Array.from(spacingPatterns)
      .filter(v => v && v !== '0px')
      .reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});

    return {
      commonPadding: Object.entries(spacingValues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value]) => value),
      baseUnit: detectBaseUnit(spacingValues)
    };
  });

  function detectBaseUnit(spacingValues) {
    // Detect if using 4px, 8px, or rem-based system
    const values = Object.keys(spacingValues).map(v => parseInt(v));
    const gcd = values.reduce((a, b) => {
      while (b) {
        let t = b;
        b = a % b;
        a = t;
      }
      return a;
    });
    return gcd;
  }
```

## Output Format
```json
{
  "layout": {
    "sections": [...],
    "hierarchy": {...},
    "gridSystem": {
      "framework": "tailwind",
      "columns": 12,
      "containerWidth": "1280px"
    }
  },
  "responsive": {
    "breakpoints": {
      "mobile": 640,
      "tablet": 768,
      "desktop": 1024,
      "wide": 1280
    },
    "behavior": {...}
  },
  "spacing": {
    "baseUnit": 8,
    "scale": [8, 16, 24, 32, 48, 64]
  },
  "patterns": {
    "headerStyle": "fixed",
    "navigationStyle": "horizontal",
    "heroStyle": "full-width",
    "cardLayout": "grid-3-columns"
  }
}
```

## Visual Mapping
```javascript
// Generate visual layout map
async function createLayoutMap(page) {
  await page.evaluate(() => {
    // Add visual borders to all sections
    document.querySelectorAll('section, article, header, footer').forEach(el => {
      el.style.outline = '2px solid red';
      el.style.outlineOffset = '-2px';
    });
  });

  await page.screenshot({
    path: '.hos/memory/visual/layout-map.png',
    fullPage: true
  });

  // Remove borders
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      el.style.outline = '';
    });
  });
}
```

## Usage Example
```javascript
const layout = await analyzeLayout(page);
const map = await createLayoutMap(page);

console.log(`Found ${layout.sections.length} major sections`);
console.log(`Grid system: ${layout.gridSystem.framework}`);
console.log(`Base spacing unit: ${layout.spacing.baseUnit}px`);
```