import { expect, test } from '@playwright/test'

test.use({
  baseURL: process.env.VISION_SPLIT_BASE_URL || 'http://localhost:3157',
  video: 'on',
  channel: 'chrome',
})

test('Red/Green binocular panels and controls fit a phone landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/vision-training')
  await page.getByRole('button', { name: 'Focus Training' }).click()
  await page.getByRole('button', { name: 'Red/Green' }).click()
  await page.getByRole('button', { name: 'Start Training' }).click()

  const leftChart = page.locator('[data-binocular-eye-chart="left"]')
  const rightChart = page.locator('[data-binocular-eye-chart="right"]')
  const exit = page.getByRole('button', { name: 'Exit', exact: true })
  const voice = page.getByRole('button', { name: 'Voice OFF' })
  await expect(leftChart).toBeVisible()
  await expect(rightChart).toBeVisible()
  await expect(exit).toBeVisible()
  await expect(voice).toBeVisible()

  const viewport = page.viewportSize()!
  for (const element of [leftChart, rightChart, exit, voice]) {
    const box = await element.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
  }
  await expect(leftChart.locator('[data-binocular-current-target="true"]')).toBeInViewport()
  await expect(rightChart.locator('[data-binocular-current-target="true"]')).toBeInViewport()
})

test('Red/Green keeps paired Snellen rows fixed and advances from one shared answer', async ({ page }) => {
  await page.goto('/vision-training')
  await page.getByRole('button', { name: 'Focus Training' }).click()
  await page.getByRole('button', { name: 'Red/Green' }).click()
  await page.getByRole('button', { name: 'Start Training' }).click()

  const leftChart = page.locator('[data-binocular-eye-chart="left"]')
  const rightChart = page.locator('[data-binocular-eye-chart="right"]')
  await expect(leftChart).toBeVisible()
  await expect(rightChart).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exit', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Voice OFF' })).toBeVisible()
  await expect(leftChart.locator('[data-binocular-chart-row]')).toHaveCount(7)
  await expect(rightChart.locator('[data-binocular-chart-row]')).toHaveCount(7)

  const leftTarget = leftChart.locator('[data-binocular-current-target="true"]')
  const rightTarget = rightChart.locator('[data-binocular-current-target="true"]')
  const leftSize = await leftTarget.getAttribute('data-binocular-optotype-size')
  const rightSize = await rightTarget.getAttribute('data-binocular-optotype-size')
  expect(leftSize).toBeTruthy()
  expect(leftSize).toBe(rightSize)
  expect(await leftTarget.getAttribute('data-binocular-target')).toBe(await rightTarget.getAttribute('data-binocular-target'))
  await expect(leftTarget.locator('div').last()).toHaveCSS('color', 'rgb(221, 0, 0)')
  await expect(rightTarget.locator('div').last()).toHaveCSS('color', 'rgb(0, 149, 0)')
  await expect(leftTarget.locator('div').last()).toHaveCSS('font-weight', '500')
  await expect(leftTarget.locator('div').last()).toHaveCSS('font-size', `${Number(leftSize) * 0.8}px`)

  const beforeRow = await leftTarget.evaluate(el => el.parentElement?.getAttribute('data-binocular-chart-row'))
  const beforeIndex = await leftTarget.getAttribute('data-binocular-target-index')
  const scrollBefore = await page.evaluate(() => window.scrollY)
  const target = await leftTarget.getAttribute('data-binocular-target')
  await page.getByRole('button', { name: target!, exact: true }).first().click()
  await expect.poll(async () => {
    const current = leftChart.locator('[data-binocular-current-target="true"]')
    return [
      await current.evaluate(el => el.parentElement?.getAttribute('data-binocular-chart-row')),
      await current.getAttribute('data-binocular-target-index'),
    ]
  }).not.toEqual([beforeRow, beforeIndex])
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore)
})
