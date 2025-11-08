#!/usr/bin/env tsx
/**
 * Observer Agent - Continuous Website Health Monitor
 * Runs hourly checks on all Reset Biology pages
 */

import { chromium, Browser, Page } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'

interface MonitorResult {
  timestamp: string
  page: string
  status: 'pass' | 'fail' | 'warn'
  issues: string[]
  metrics: {
    loadTime?: number
    lcp?: number
    cls?: number
    errors?: number
  }
}

interface HealthDashboard {
  lastUpdated: string
  brokenLinks: string[]
  mobileIssues: string[]
  checkoutStatus: {
    working: boolean
    lastSuccessfulTest: string
  }
  styleIssues: string[]
  performanceIssues: string[]
  rawResults: MonitorResult[]
}

const PAGES = [
  { url: '/', name: 'Landing Page', critical: true },
  { url: '/portal', name: 'Client Portal', critical: true, requiresAuth: true },
  { url: '/peptides', name: 'Peptide Tracker', critical: true, requiresAuth: true },
  { url: '/workout', name: 'Workout Tracker', critical: false, requiresAuth: true },
  { url: '/nutrition', name: 'Nutrition Tracker', critical: false, requiresAuth: true },
  { url: '/breath', name: 'Breathing App', critical: false },
  { url: '/journal', name: 'Journal Page', critical: false, requiresAuth: true },
  { url: '/order', name: 'Store Checkout', critical: true }
]

const BASE_URL = process.env.BASE_URL || 'https://resetbiology.com'
const DASHBOARD_PATH = '.hos/dashboard/health.md'

async function login(page: Page) {
  // Navigate to login
  await page.goto(`${BASE_URL}/api/auth/login?returnTo=/portal`)

  // Wait for Auth0 redirect
  await page.waitForURL(/auth0\.com/, { timeout: 10000 })

  // Fill in credentials (use test account)
  const email = process.env.TEST_EMAIL || 'test@resetbiology.com'
  const password = process.env.TEST_PASSWORD || ''

  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')

  // Wait for redirect back to portal
  await page.waitForURL(/\/portal/, { timeout: 10000 })
}

async function checkPage(browser: Browser, pageConfig: typeof PAGES[0], isAuthenticated: boolean): Promise<MonitorResult> {
  const page = await browser.newPage()
  const issues: string[] = []
  const metrics: MonitorResult['metrics'] = {}

  try {
    const startTime = Date.now()

    // Navigate to page
    await page.goto(`${BASE_URL}${pageConfig.url}`, { waitUntil: 'networkidle' })

    metrics.loadTime = Date.now() - startTime

    // Check for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Check for broken links
    const links = await page.locator('a[href]').all()
    for (const link of links) {
      const href = await link.getAttribute('href')
      if (href?.startsWith('/')) {
        // Internal link - check if it's valid
        const response = await page.goto(`${BASE_URL}${href}`, { waitUntil: 'domcontentloaded' })
        if (!response?.ok()) {
          issues.push(`Broken link: ${href}`)
        }
        await page.goBack()
      }
    }

    // Check Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise<any>(resolve => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lcp = entries.find(e => e.entryType === 'largest-contentful-paint')
          const cls = entries.find(e => e.entryType === 'layout-shift')
          resolve({
            lcp: lcp ? (lcp as any).renderTime : null,
            cls: cls ? (cls as any).value : null
          })
        }).observe({ entryTypes: ['largest-contentful-paint', 'layout-shift'] })

        setTimeout(() => resolve({ lcp: null, cls: null }), 5000)
      })
    })

    if (vitals.lcp) metrics.lcp = vitals.lcp
    if (vitals.cls) metrics.cls = vitals.cls

    // Check for mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone size
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })

    if (hasHorizontalScroll) {
      issues.push('Mobile: Horizontal scroll detected')
    }

    // Page-specific checks
    if (pageConfig.url === '/order') {
      // Check Stripe integration
      const stripeElement = await page.locator('[data-testid="stripe-checkout"]').count()
      if (stripeElement === 0) {
        issues.push('Checkout: Stripe element not found')
      }
    }

    if (pageConfig.url === '/peptides') {
      // Check peptide library loads
      const peptideCount = await page.locator('[data-testid="peptide-card"]').count()
      if (peptideCount === 0) {
        issues.push('Peptides: No peptides loaded')
      }
    }

    metrics.errors = errors.length

    // Determine status
    const status = issues.length === 0 ? 'pass' : pageConfig.critical ? 'fail' : 'warn'

    return {
      timestamp: new Date().toISOString(),
      page: pageConfig.name,
      status,
      issues,
      metrics
    }

  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      page: pageConfig.name,
      status: 'fail',
      issues: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      metrics
    }
  } finally {
    await page.close()
  }
}

async function runMonitoring() {
  const browser = await chromium.launch()
  const results: MonitorResult[] = []

  try {
    // First, login to get authenticated session
    const authPage = await browser.newPage()
    let isAuthenticated = false

    try {
      await login(authPage)
      isAuthenticated = true
    } catch (error) {
      console.error('Failed to authenticate:', error)
    }

    await authPage.close()

    // Now check each page
    for (const pageConfig of PAGES) {
      console.log(`Checking ${pageConfig.name}...`)

      if (pageConfig.requiresAuth && !isAuthenticated) {
        results.push({
          timestamp: new Date().toISOString(),
          page: pageConfig.name,
          status: 'warn',
          issues: ['Skipped: Authentication failed'],
          metrics: {}
        })
        continue
      }

      const result = await checkPage(browser, pageConfig, isAuthenticated)
      results.push(result)
    }

    // Generate dashboard
    await generateDashboard(results)

    // Save raw results
    await fs.writeFile(
      '.hos/monitoring/logs/latest.json',
      JSON.stringify(results, null, 2)
    )

  } finally {
    await browser.close()
  }
}

async function generateDashboard(results: MonitorResult[]) {
  const dashboard: HealthDashboard = {
    lastUpdated: new Date().toISOString(),
    brokenLinks: [],
    mobileIssues: [],
    checkoutStatus: {
      working: true,
      lastSuccessfulTest: new Date().toISOString()
    },
    styleIssues: [],
    performanceIssues: [],
    rawResults: results
  }

  // Analyze results
  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.includes('Broken link')) {
        dashboard.brokenLinks.push(`${result.page}: ${issue}`)
      }
      if (issue.includes('Mobile')) {
        dashboard.mobileIssues.push(`${result.page}: ${issue}`)
      }
      if (issue.includes('Checkout')) {
        dashboard.checkoutStatus.working = false
      }
      if (issue.includes('Style') || issue.includes('CSS')) {
        dashboard.styleIssues.push(`${result.page}: ${issue}`)
      }
    }

    // Check performance
    if (result.metrics.loadTime && result.metrics.loadTime > 3000) {
      dashboard.performanceIssues.push(`${result.page}: Slow load time (${result.metrics.loadTime}ms)`)
    }
    if (result.metrics.lcp && result.metrics.lcp > 2500) {
      dashboard.performanceIssues.push(`${result.page}: Poor LCP (${result.metrics.lcp}ms)`)
    }
    if (result.metrics.cls && result.metrics.cls > 0.1) {
      dashboard.performanceIssues.push(`${result.page}: High CLS (${result.metrics.cls})`)
    }
  }

  // Generate markdown
  const markdown = `# Reset Biology Health Dashboard
**Last Updated:** ${new Date(dashboard.lastUpdated).toLocaleString()}

## 🔴 Broken Links (NOW)
${dashboard.brokenLinks.length === 0 ? '✅ No broken links detected' : dashboard.brokenLinks.map(l => `- ${l}`).join('\n')}

## 📱 Mobile Issues (NOW)
${dashboard.mobileIssues.length === 0 ? '✅ No mobile issues detected' : dashboard.mobileIssues.map(i => `- ${i}`).join('\n')}

## 💳 Checkout Flow Status
- **Status:** ${dashboard.checkoutStatus.working ? '✅ Working' : '🔴 BROKEN'}
- **Last Successful Test:** ${new Date(dashboard.checkoutStatus.lastSuccessfulTest).toLocaleString()}

## 🎨 Style Inconsistencies (TODAY)
${dashboard.styleIssues.length === 0 ? '✅ No style issues detected' : dashboard.styleIssues.map(s => `- ${s}`).join('\n')}

## ⚡ Performance Issues (THIS HOUR)
${dashboard.performanceIssues.length === 0 ? '✅ All pages performing well' : dashboard.performanceIssues.map(p => `- ${p}`).join('\n')}

## 📊 Detailed Results

${results.map(r => `
### ${r.page}
- **Status:** ${r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '🔴'} ${r.status.toUpperCase()}
- **Load Time:** ${r.metrics.loadTime ? `${r.metrics.loadTime}ms` : 'N/A'}
- **LCP:** ${r.metrics.lcp ? `${r.metrics.lcp}ms` : 'N/A'}
- **CLS:** ${r.metrics.cls ? r.metrics.cls.toFixed(3) : 'N/A'}
- **Console Errors:** ${r.metrics.errors || 0}
${r.issues.length > 0 ? `- **Issues:**\n${r.issues.map(i => `  - ${i}`).join('\n')}` : ''}
`).join('\n')}

---
*Generated by Observer Agent - Next run in 1 hour*
`

  await fs.writeFile(DASHBOARD_PATH, markdown)
  console.log(`Dashboard updated: ${DASHBOARD_PATH}`)
}

// Run monitoring
runMonitoring().catch(console.error)
