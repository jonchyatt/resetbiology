import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3159', headless: true, channel: 'chrome', launchOptions: { slowMo: 0 } })

async function installFakeRecognition(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0 // deterministic upward targets for this interaction check
    const sessions: Array<{ onresult: ((event: unknown) => void) | null }> = []
    Object.assign(window, { __visionRecognitionSessions: sessions })
    class FakeRecognition {
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onspeechstart: (() => void) | null = null
      onspeechend: (() => void) | null = null
      constructor() { sessions.push(this) }
      start() {}
      stop() { this.onend?.() }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition })
  })
}

async function attempts(page: Page) {
  const score = await page.getByText(/% \(\d+\/\d+\)/).first().textContent()
  return Number(score?.match(/\(\d+\/(\d+)\)/)?.[1] ?? -1)
}

async function say(page: Page, resultIndex: number, words: string) {
  await page.evaluate(({ resultIndex, words }) => {
    const sessions = (window as unknown as { __visionRecognitionSessions: Array<{ onresult: ((event: unknown) => void) | null }> }).__visionRecognitionSessions
    const results = Array.from({ length: resultIndex + 1 }, (_, index) => ({
      isFinal: true,
      0: { transcript: index === resultIndex ? words : 'up' },
    }))
    sessions.at(-1)?.onresult?.({ resultIndex, results })
  }, { resultIndex, words })
}

test('direction buttons and continuous voice share the chart without losing later words', async ({ page }) => {
  await installFakeRecognition(page)

  await page.goto('/vision-training')
  await page.getByRole('button', { name: 'Focus Training' }).click()
  await page.getByRole('button', { name: 'E →' }).click()
  await page.getByRole('button', { name: 'Start Training' }).click()
  await page.getByRole('button', { name: 'Voice OFF' }).click()

  await expect.poll(() => attempts(page)).toBe(0)
  await page.locator('[data-screen-e-response-pad]').getByRole('button', { name: 'Up' }).click()
  await expect.poll(() => attempts(page)).toBe(1)
  await say(page, 0, 'up up')
  await expect.poll(() => attempts(page), { timeout: 3000 }).toBe(3)
  await page.locator('[data-screen-e-response-pad]').getByRole('button', { name: 'Up' }).click()
  await expect.poll(() => attempts(page)).toBe(4)
  await say(page, 1, 'up')
  await expect.poll(() => attempts(page), { timeout: 2000 }).toBe(5)
})

test('binocular arrows and voice continue after each other', async ({ page }) => {
  await installFakeRecognition(page)
  await page.goto('/vision-training')
  await page.getByRole('button', { name: 'Focus Training' }).click()
  await page.getByRole('button', { name: 'E →' }).click()
  await page.getByRole('button', { name: /Duplicate Identical pair/ }).click()
  await page.getByRole('button', { name: 'Start Training' }).click()
  await page.getByRole('button', { name: 'Voice OFF' }).click()

  await page.locator('[data-binocular-answer-arrow="up"]').first().click()
  await expect.poll(() => attempts(page)).toBe(1)
  await say(page, 0, 'up up')
  await expect.poll(() => attempts(page), { timeout: 3000 }).toBe(3)
  await page.locator('[data-binocular-answer-arrow="up"]').first().click()
  await expect.poll(() => attempts(page)).toBe(4)
  await say(page, 1, 'up')
  await expect.poll(() => attempts(page), { timeout: 2000 }).toBe(5)
})
