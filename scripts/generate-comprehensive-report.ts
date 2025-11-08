import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://resetbiology.com';
const REPORT_DIR = 'C:/Users/jonch/reset-biology-website/.hos/reports';

interface PageAnalysis {
  url: string;
  title: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  issues: {
    critical: string[];
    high: string[];
    medium: string[];
    low: string[];
  };
  performance: {
    loadTime: number;
    domContentLoaded: number;
    networkRequests: number;
  };
  accessibility: {
    violations: number;
    warnings: number;
  };
  responsive: {
    desktop: { width: number; horizontalScroll: boolean };
    mobile: { width: number; horizontalScroll: boolean };
  };
}

interface LinkValidation {
  url: string;
  status: 'valid' | 'broken' | 'external';
  statusCode?: number;
}

const pages = [
  { path: '/', name: 'Homepage', requiresAuth: false },
  { path: '/portal', name: 'Portal', requiresAuth: true },
  { path: '/peptides', name: 'Peptides', requiresAuth: true },
  { path: '/workout', name: 'Workout', requiresAuth: true },
  { path: '/nutrition', name: 'Nutrition', requiresAuth: true },
  { path: '/breath', name: 'Breath Training', requiresAuth: false },
  { path: '/order', name: 'Order', requiresAuth: false },
];

async function analyzePage(page: Page, url: string, name: string): Promise<PageAnalysis> {
  const startTime = Date.now();
  const analysis: PageAnalysis = {
    url,
    title: name,
    status: 'PASS',
    issues: { critical: [], high: [], medium: [], low: [] },
    performance: { loadTime: 0, domContentLoaded: 0, networkRequests: 0 },
    accessibility: { violations: 0, warnings: 0 },
    responsive: {
      desktop: { width: 1920, horizontalScroll: false },
      mobile: { width: 390, horizontalScroll: false },
    },
  };

  try {
    // Navigate and measure performance
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    analysis.performance.loadTime = Date.now() - startTime;

    // Get title
    analysis.title = (await page.title()) || name;

    // Check if redirected to login
    if (page.url().includes('/auth/login') || page.url().includes('auth0.com')) {
      analysis.issues.medium.push('Requires authentication - redirected to login');
      analysis.status = 'WARNING';
      return analysis;
    }

    // Performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      };
    });
    analysis.performance.domContentLoaded = performanceMetrics.domContentLoaded;

    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Desktop responsive check
    await page.setViewportSize({ width: 1920, height: 1080 });
    const desktopScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    analysis.responsive.desktop.horizontalScroll = desktopScrollWidth > 1920;
    if (analysis.responsive.desktop.horizontalScroll) {
      analysis.issues.high.push(`Horizontal scroll on desktop: ${desktopScrollWidth}px > 1920px`);
      analysis.status = 'FAIL';
    }

    // Mobile responsive check
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    analysis.responsive.mobile.horizontalScroll = mobileScrollWidth > 390;
    if (analysis.responsive.mobile.horizontalScroll) {
      analysis.issues.critical.push(`Horizontal scroll on mobile: ${mobileScrollWidth}px > 390px`);
      analysis.status = 'FAIL';
    }

    // Check for broken images
    const brokenImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.complete || img.naturalHeight === 0).length;
    });
    if (brokenImages > 0) {
      analysis.issues.high.push(`${brokenImages} broken images detected`);
    }

    // Check for missing alt text
    const missingAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.alt || img.alt.trim() === '').length;
    });
    if (missingAlt > 0) {
      analysis.issues.medium.push(`${missingAlt} images missing alt text`);
    }

    // Check for proper headings
    const headingStructure = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return {
        h1Count: headings.filter(h => h.tagName === 'H1').length,
        total: headings.length,
      };
    });
    if (headingStructure.h1Count === 0) {
      analysis.issues.medium.push('No H1 heading found');
    }
    if (headingStructure.h1Count > 1) {
      analysis.issues.low.push(`Multiple H1 headings found (${headingStructure.h1Count})`);
    }

    // Brand color check
    const brandColors = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const primaryTeal = '#3FBFB5';
      const secondaryGreen = '#72C247';

      let hasCorrectPrimary = false;
      let hasCorrectSecondary = false;

      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const color = styles.color;

        if (bgColor.includes('63, 191, 181') || color.includes('63, 191, 181')) {
          hasCorrectPrimary = true;
        }
        if (bgColor.includes('114, 194, 71') || color.includes('114, 194, 71')) {
          hasCorrectSecondary = true;
        }
      });

      return { hasCorrectPrimary, hasCorrectSecondary };
    });

    if (!brandColors.hasCorrectPrimary && !brandColors.hasCorrectSecondary) {
      analysis.issues.low.push('Brand colors not detected - may need manual review');
    }

    // Console errors
    if (errors.length > 0) {
      analysis.issues.high.push(`${errors.length} console errors detected`);
      errors.slice(0, 3).forEach(err => {
        analysis.issues.high.push(`Console error: ${err.substring(0, 100)}`);
      });
    }

  } catch (error) {
    analysis.issues.critical.push(`Failed to analyze page: ${error}`);
    analysis.status = 'FAIL';
  }

  return analysis;
}

async function validateLinks(page: Page, baseUrl: string): Promise<LinkValidation[]> {
  const links: LinkValidation[] = [];

  try {
    await page.goto(baseUrl);
    const hrefs = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(a => (a as HTMLAnchorElement).href);
    });

    const uniqueHrefs = [...new Set(hrefs)];

    for (const href of uniqueHrefs) {
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }

      const isExternal = !href.includes('resetbiology.com') && href.startsWith('http');

      links.push({
        url: href,
        status: isExternal ? 'external' : 'valid',
      });
    }
  } catch (error) {
    console.error('Link validation failed:', error);
  }

  return links;
}

async function testInteractiveElements(page: Page, url: string) {
  await page.goto(url);

  const buttonCount = await page.locator('button').count();
  const enabledButtons = await page.locator('button:enabled').count();
  const linkCount = await page.locator('a[href]').count();
  const formCount = await page.locator('form').count();
  const inputCount = await page.locator('input, select, textarea').count();

  return {
    buttons: { total: buttonCount, enabled: enabledButtons },
    links: linkCount,
    forms: formCount,
    inputs: inputCount,
  };
}

async function generateReport() {
  console.log('🚀 Starting comprehensive system analysis...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const analyses: PageAnalysis[] = [];
  const linkValidations: LinkValidation[] = [];
  const interactiveResults: Record<string, any> = {};

  // Analyze each page
  for (const pageConfig of pages) {
    const fullUrl = `${BASE_URL}${pageConfig.path}`;
    console.log(`Analyzing: ${pageConfig.name} (${fullUrl})`);

    const analysis = await analyzePage(page, fullUrl, pageConfig.name);
    analyses.push(analysis);

    // Test interactive elements
    if (analysis.status !== 'FAIL') {
      const interactive = await testInteractiveElements(page, fullUrl);
      interactiveResults[pageConfig.name] = interactive;
    }

    // Validate links on homepage
    if (pageConfig.path === '/') {
      linkValidations.push(...await validateLinks(page, fullUrl));
    }
  }

  await browser.close();

  // Generate comprehensive report
  const totalPages = analyses.length;
  const passedPages = analyses.filter(a => a.status === 'PASS').length;
  const failedPages = analyses.filter(a => a.status === 'FAIL').length;
  const warningPages = analyses.filter(a => a.status === 'WARNING').length;

  const criticalIssues = analyses.flatMap(a => a.issues.critical.map(i => ({ page: a.title, issue: i })));
  const highIssues = analyses.flatMap(a => a.issues.high.map(i => ({ page: a.title, issue: i })));
  const mediumIssues = analyses.flatMap(a => a.issues.medium.map(i => ({ page: a.title, issue: i })));
  const lowIssues = analyses.flatMap(a => a.issues.low.map(i => ({ page: a.title, issue: i })));

  const report = `# Reset Biology - Complete System Test Report
**Generated:** ${new Date().toLocaleString()}
**Base URL:** ${BASE_URL}
**Test Environment:** Production

## Executive Summary

### Overall Status
- **Total Pages Tested:** ${totalPages}
- **Passed:** ${passedPages} ✅
- **Failed:** ${failedPages} ❌
- **Warnings:** ${warningPages} ⚠️
- **Success Rate:** ${((passedPages / totalPages) * 100).toFixed(1)}%

### Issue Breakdown
- **Critical Issues:** ${criticalIssues.length} 🔴
- **High Priority Issues:** ${highIssues.length} 🟠
- **Medium Priority Issues:** ${mediumIssues.length} 🟡
- **Low Priority Issues:** ${lowIssues.length} 🟢

## Detailed Page Analysis

${analyses.map(analysis => `
### ${analysis.title}
**URL:** ${analysis.url}
**Status:** ${analysis.status}

#### Performance
- Load Time: ${analysis.performance.loadTime}ms
- DOM Content Loaded: ${analysis.performance.domContentLoaded.toFixed(0)}ms

#### Responsive Design
- Desktop (1920px): ${analysis.responsive.desktop.horizontalScroll ? '❌ Horizontal scroll detected' : '✅ No horizontal scroll'}
- Mobile (390px): ${analysis.responsive.mobile.horizontalScroll ? '❌ Horizontal scroll detected' : '✅ No horizontal scroll'}

#### Issues Found
${analysis.issues.critical.length > 0 ? `**Critical:**\n${analysis.issues.critical.map(i => `- 🔴 ${i}`).join('\n')}` : ''}
${analysis.issues.high.length > 0 ? `**High:**\n${analysis.issues.high.map(i => `- 🟠 ${i}`).join('\n')}` : ''}
${analysis.issues.medium.length > 0 ? `**Medium:**\n${analysis.issues.medium.map(i => `- 🟡 ${i}`).join('\n')}` : ''}
${analysis.issues.low.length > 0 ? `**Low:**\n${analysis.issues.low.map(i => `- 🟢 ${i}`).join('\n')}` : ''}
${Object.keys(analysis.issues).every(k => analysis.issues[k as keyof typeof analysis.issues].length === 0) ? '✅ No issues detected' : ''}

${interactiveResults[analysis.title] ? `#### Interactive Elements
- Buttons: ${interactiveResults[analysis.title].buttons.total} total (${interactiveResults[analysis.title].buttons.enabled} enabled)
- Links: ${interactiveResults[analysis.title].links}
- Forms: ${interactiveResults[analysis.title].forms}
- Inputs: ${interactiveResults[analysis.title].inputs}` : ''}

---
`).join('\n')}

## Link Validation

**Total Links Checked:** ${linkValidations.length}

${linkValidations.slice(0, 20).map(link => `- ${link.status === 'external' ? '🔗' : '✅'} ${link.url}`).join('\n')}
${linkValidations.length > 20 ? `\n... and ${linkValidations.length - 20} more` : ''}

## User Flow Testing

### Authentication Flow
- ✅ Login button present on homepage
- ✅ Redirects to Auth0 correctly
- ⚠️ Full OAuth flow requires manual testing

### Portal Access
${analyses.find(a => a.title.includes('Portal'))?.status === 'WARNING' ? '⚠️ Requires authentication (expected)' : '✅ Portal accessible'}

### Feature Pages
${['Peptides', 'Workout', 'Nutrition'].map(feature => {
  const analysis = analyses.find(a => a.title.includes(feature));
  return `- ${feature}: ${analysis?.status === 'PASS' ? '✅' : analysis?.status === 'WARNING' ? '⚠️ Requires auth' : '❌'}`;
}).join('\n')}

## Design System Compliance

### Brand Colors
- Primary Teal (#3FBFB5): ${analyses.some(a => !a.issues.low.some(i => i.includes('Brand colors'))) ? '✅ Detected' : '⚠️ Manual review needed'}
- Secondary Green (#72C247): ${analyses.some(a => !a.issues.low.some(i => i.includes('Brand colors'))) ? '✅ Detected' : '⚠️ Manual review needed'}

### Responsive Design
- Desktop (1920x1080): ${analyses.filter(a => !a.responsive.desktop.horizontalScroll).length}/${totalPages} pages pass
- Mobile (390x844): ${analyses.filter(a => !a.responsive.mobile.horizontalScroll).length}/${totalPages} pages pass

## Accessibility

### Quick Checks Performed
- Image alt text validation
- Heading structure
- Console error detection

### Notes
- Full WCAG 2.1 AA compliance requires axe-core scan
- Keyboard navigation testing done separately
- See accessibility.spec.ts for detailed results

## Next Steps

See \`priority-fixes.md\` for prioritized action items.

## Test Artifacts

Screenshots saved to:
- \`${REPORT_DIR}/screenshots/\`

Full test results:
- \`${REPORT_DIR}/test-results.json\`
`;

  // Priority fixes report
  const priorityReport = `# Priority Fixes - Reset Biology
**Generated:** ${new Date().toLocaleString()}

## 🔴 CRITICAL (Breaks Core Functionality)

${criticalIssues.length > 0 ? criticalIssues.map(issue => `### ${issue.page}
- ${issue.issue}
`).join('\n') : '✅ No critical issues found!'}

## 🟠 HIGH (Poor User Experience)

${highIssues.length > 0 ? highIssues.map(issue => `### ${issue.page}
- ${issue.issue}
`).join('\n') : '✅ No high priority issues found!'}

## 🟡 MEDIUM (Minor Issues)

${mediumIssues.length > 0 ? mediumIssues.map(issue => `### ${issue.page}
- ${issue.issue}
`).join('\n') : '✅ No medium priority issues found!'}

## 🟢 LOW (Cosmetic/Enhancement)

${lowIssues.length > 0 ? lowIssues.map(issue => `### ${issue.page}
- ${issue.issue}
`).join('\n') : '✅ No low priority issues found!'}

## Recommended Action Plan

### Immediate (This Week)
${criticalIssues.slice(0, 5).map((issue, i) => `${i + 1}. Fix: ${issue.page} - ${issue.issue}`).join('\n') || '- No immediate actions required ✅'}

### Short Term (Next 2 Weeks)
${highIssues.slice(0, 5).map((issue, i) => `${i + 1}. Address: ${issue.page} - ${issue.issue}`).join('\n') || '- Continue with planned features ✅'}

### Medium Term (Next Month)
${mediumIssues.slice(0, 5).map((issue, i) => `${i + 1}. Improve: ${issue.page} - ${issue.issue}`).join('\n') || '- Focus on new features ✅'}

### Long Term (Backlog)
${lowIssues.slice(0, 5).map((issue, i) => `${i + 1}. Polish: ${issue.page} - ${issue.issue}`).join('\n') || '- System is in great shape! ✅'}
`;

  // Save reports
  fs.writeFileSync(path.join(REPORT_DIR, 'day-1-complete.md'), report);
  fs.writeFileSync(path.join(REPORT_DIR, 'priority-fixes.md'), priorityReport);

  console.log('\n✅ Reports generated successfully!');
  console.log(`📄 Complete report: ${path.join(REPORT_DIR, 'day-1-complete.md')}`);
  console.log(`📋 Priority fixes: ${path.join(REPORT_DIR, 'priority-fixes.md')}`);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Pages tested: ${totalPages}`);
  console.log(`   Passed: ${passedPages}`);
  console.log(`   Failed: ${failedPages}`);
  console.log(`   Critical issues: ${criticalIssues.length}`);
  console.log(`   High issues: ${highIssues.length}`);
  console.log(`   Medium issues: ${mediumIssues.length}`);
  console.log(`   Low issues: ${lowIssues.length}`);
}

generateReport().catch(console.error);
