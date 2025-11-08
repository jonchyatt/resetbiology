import { chromium, Browser, BrowserContext, Page } from '@playwright/test'
import * as fs from 'fs'

let browser: Browser | null = null
let context: BrowserContext | null = null
let page: Page | null = null

export async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: false,
      slowMo: 500, // Slow down so user can watch
      args: ['--start-maximized']
    })
  }
  return browser
}

export async function getContext() {
  if (!context) {
    const br = await getBrowser()

    // Use saved auth state if it exists
    if (fs.existsSync('auth-state.json')) {
      context = await br.newContext({
        storageState: 'auth-state.json',
        viewport: { width: 1920, height: 1080 }
      })
    } else {
      context = await br.newContext({
        viewport: { width: 1920, height: 1080 }
      })
    }
  }
  return context
}

export async function getPage() {
  if (!page) {
    const ctx = await getContext()
    const pages = ctx.pages()

    if (pages.length > 0) {
      page = pages[0]
    } else {
      page = await ctx.newPage()
    }
  }
  return page
}

export async function closeBrowser() {
  if (page) await page.close()
  if (context) await context.close()
  if (browser) await browser.close()
  page = null
  context = null
  browser = null
}

// Keep browser open - don't close automatically
process.on('SIGINT', async () => {
  console.log('\n⏸️  Keeping browser open... Press Ctrl+C again to close.')
})
