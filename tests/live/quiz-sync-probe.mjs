import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const arg = name => {
  const index = args.indexOf(name)
  return index === -1 ? null : args[index + 1]
}

const masterSha = arg('--sha')
if (!masterSha || !/^[A-Za-z0-9._-]+$/.test(masterSha)) {
  throw new Error('usage: node tests/live/quiz-sync-probe.mjs --sha <master-sha> [--base-url <url>]')
}

const baseUrl = (arg('--base-url') || process.env.PORTAL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const output = resolve('data/rb-portal-modules/runtime-logs/visual-2026-07-19-da7c-arc2')
const storageKey = 'resetbiology_quiz_responses'
const syncPath = '/api/quiz/sync'
const syncGlob = `**${syncPath}`
const utc = new Date().toISOString()
const receiptPath = resolve(output, `w1-t3-receipt-${masterSha}.txt`)

mkdirSync(output, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitForPostCount(posts, count, label) {
  const deadline = Date.now() + 30_000
  while (posts.length < count && Date.now() < deadline) {
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  assert(posts.length >= count, `${label}: expected ${count} sync POST(s), saw ${posts.length}`)
}

async function selectFirstChoice(page, step) {
  const selected = await page.locator('button:not([disabled])').evaluateAll(buttons => {
    const choice = buttons.find(button => !/^(Back|Next|See Your Personalized Results)/i.test(button.textContent?.trim() || ''))
    if (!choice) return false
    choice.click()
    return true
  })
  assert(selected, `step ${step}: no selectable choice found`)
}

async function completeQuiz(page) {
  for (let step = 1; step <= 12; step += 1) {
    await page.getByText(`Step ${step} of 12`, { exact: true }).waitFor({ timeout: 15_000 })

    if (step === 1) {
      await page.locator('input[type="text"]').fill('jonchyatt')
      await page.locator('input[type="email"]').fill('jonchyatt+quiz-sync-probe@example.com')
    } else if ([2, 4, 9, 12].includes(step)) {
      await selectFirstChoice(page, step)
    } else if ([3, 5, 10, 11].includes(step)) {
      const range = page.locator('input[type="range"]')
      await range.focus()
      await range.press('Home')
    } else if (step === 6) {
      await page.locator('textarea').fill('Feel healthy and strong every day.')
    } else if (step === 7) {
      const range = page.locator('input[type="range"]')
      await range.focus()
      await range.press('Home')
      await page.locator('textarea').fill('My family and future matter to me.')
    } else if (step === 8) {
      const answers = page.locator('textarea')
      await answers.nth(0).fill('A sustainable, supported process.')
      await answers.nth(1).fill('Confident, energetic, and proud.')
    }

    await page.waitForTimeout(100)
    const next = page.getByRole('button', {
      name: step === 12 ? /See Your Personalized Results/i : /^Next$/i,
    })

    if (step === 12) {
      await Promise.all([
        page.waitForURL(url => url.pathname === '/quiz/results', { timeout: 30_000 }),
        next.click(),
      ])
    } else {
      await next.click()
    }
  }
}

async function screenshotResultsCard(page, path) {
  const card = page.getByRole('heading', { name: /Your Next Step,/i }).locator('xpath=..')
  await card.waitFor({ timeout: 15_000 })
  await card.screenshot({ path })
}

let browser
let page
let priorStorage
let exitCode = 0
const syncPosts = []
const receipt = {
  run: '2026-07-19-da7c',
  step: 'W1-T3-quiz-robustness',
  direction: 'test',
  persona: 'jonchyatt',
  masterSha,
  utc,
  baseUrl,
  syncPosts,
}

try {
  browser = await chromium.connectOverCDP('http://127.0.0.1:9226')
  const context = browser.contexts()[0]
  assert(context, 'the authed Edge lane has no browser context')
  page = await context.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === syncPath) {
      syncPosts.push({ url: request.url(), at: new Date().toISOString() })
    }
  })

  // Preserve exactly the one quiz key this probe overwrites before starting its real UI path.
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  priorStorage = await page.evaluate(key => localStorage.getItem(key), storageKey)
  await page.goto(`${baseUrl}/quiz`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(key => localStorage.removeItem(key), storageKey)
  await page.reload({ waitUntil: 'domcontentloaded' })

  await completeQuiz(page)
  await waitForPostCount(syncPosts, 1, 'initial results sync')
  await screenshotResultsCard(page, resolve(output, `w1-t3-sync-ok-${masterSha}.png`))
  receipt.initialPostCount = syncPosts.length

  await page.route(syncGlob, route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'forced quiz sync failure' }),
  }))
  const beforeForced = syncPosts.length
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForPostCount(syncPosts, beforeForced + 1, 'forced-500 results sync')
  await page.getByText(/Your results are saved on this device, but syncing them to your account failed\./i).waitFor({ timeout: 15_000 })
  await page.locator('main').screenshot({ path: resolve(output, `w1-t3-forced500-${masterSha}.png`) })
  receipt.forced500PostCount = syncPosts.length - beforeForced

  await page.unroute(syncGlob)
  const beforeRetry = syncPosts.length
  await page.getByRole('button', { name: /Retry sync/i }).click()
  await waitForPostCount(syncPosts, beforeRetry + 1, 'retry results sync')
  await page.getByText(/Your results are saved on this device, but syncing them to your account failed\./i).waitFor({ state: 'hidden', timeout: 15_000 })
  await screenshotResultsCard(page, resolve(output, `w1-t3-retry-${masterSha}.png`))
  receipt.retryPostCount = syncPosts.length - beforeRetry
  receipt.verdict = 'PASS'
} catch (error) {
  exitCode = 1
  receipt.verdict = 'FAIL'
  receipt.error = String(error?.stack || error)
  console.error(receipt.error)
} finally {
  try {
    if (page) {
      await page.unroute(syncGlob)
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      await page.evaluate(({ key, value }) => {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      }, { key: storageKey, value: priorStorage ?? null })
      await page.close()
    }
  } catch (cleanupError) {
    exitCode = 1
    receipt.cleanupError = String(cleanupError?.stack || cleanupError)
  }
  if (browser) browser._connection.close()

  const karpathyAppend = {
    run: '2026-07-19-da7c',
    step: 'W1-T3-quiz-robustness',
    direction: 'test',
    result: receipt.verdict,
    measurement: {
      initialPostCount: receipt.initialPostCount ?? 0,
      forced500PostCount: receipt.forced500PostCount ?? 0,
      retryPostCount: receipt.retryPostCount ?? 0,
    },
  }
  writeFileSync(receiptPath, [
    `master_sha=${masterSha} utc=${utc} persona=jonchyatt`,
    JSON.stringify(karpathyAppend),
    JSON.stringify(receipt, null, 2),
    '',
  ].join('\n'))
}

if (exitCode) process.exit(exitCode)
process.exit(0)
