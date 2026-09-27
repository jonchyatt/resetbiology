import { expect, test, type Locator, type Page } from '@playwright/test'
import { SCREEN_E_LINE_LETTER_COUNTS, SCREEN_E_LINE_MULTIPLIERS, screenELineSize } from '../src/lib/vision/screenDirectionalE'

test.use({
  baseURL: process.env.VISION_SPLIT_BASE_URL || 'http://localhost:3157',
  video: 'on',
  channel: 'chrome',
})

async function startRedGreen(page: Page, viewport: { width: number; height: number }, exercise: 'ABC' | 'E →', device: 'Phone' | 'Desktop') {
  await page.setViewportSize(viewport)
  await page.goto('/vision-training')
  await page.getByRole('button', { name: 'Focus Training' }).click()
  await page.getByRole('button', { name: device, exact: true }).click()
  await page.getByRole('button', { name: exercise, exact: true }).click()
  await page.getByRole('button', { name: 'Red/Green' }).click()
  await page.getByRole('button', { name: 'Start Training' }).click()
}

const boxCenter = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

async function chartSeparation(left: Locator, right: Locator) {
  const leftBox = await left.boundingBox()
  const rightBox = await right.boundingBox()
  if (!leftBox || !rightBox) throw new Error('Both chart boxes must be measurable')
  return boxCenter(rightBox).x - boxCenter(leftBox).x
}

async function expectArrowFusion(page: Page, iconSize: number) {
  const mismatches = await page.evaluate(expectedSize => {
    type Rect = { x: number; y: number; width: number; height: number }
    const getRect = (element: Element | null): Rect | null => {
      if (!element) return null
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }
    const center = (box: Rect) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
    const left = document.querySelector<HTMLElement>('[data-binocular-eye-chart="left"]')
    const right = document.querySelector<HTMLElement>('[data-binocular-eye-chart="right"]')
    if (!left || !right) return ['missing eye chart']
    const leftHalf = left.parentElement?.parentElement
    const rightHalf = right.parentElement?.parentElement
    if (!leftHalf || !rightHalf) return ['missing eye panel']
    const pairs = [
      [leftHalf, 'outer', 'up', left, rightHalf, 'inner', 'up', right],
      [leftHalf, 'outer', 'left', left, rightHalf, 'inner', 'left', right],
      [leftHalf, 'inner', 'down', left, rightHalf, 'outer', 'down', right],
      [leftHalf, 'inner', 'right', left, rightHalf, 'outer', 'right', right],
    ] as const
    const issues: string[] = []
    for (const [firstPanel, firstColumn, firstDir, firstChart, secondPanel, secondColumn, secondDir, secondChart] of pairs) {
      const first = getRect(firstPanel.querySelector(`[data-binocular-arrow-column="${firstColumn}"] [data-binocular-answer-arrow="${firstDir}"] svg`))
      const second = getRect(secondPanel.querySelector(`[data-binocular-arrow-column="${secondColumn}"] [data-binocular-answer-arrow="${secondDir}"] svg`))
      const firstChartBox = getRect(firstChart)
      const secondChartBox = getRect(secondChart)
      if (!first || !second || !firstChartBox || !secondChartBox) { issues.push(`missing ${firstDir} arrow`); continue }
      if (first.width !== expectedSize || first.height !== expectedSize || second.width !== expectedSize || second.height !== expectedSize) issues.push(`${firstDir}: wrong SVG dimensions`)
      if (Math.abs(center(first).x - center(firstChartBox).x - center(second).x + center(secondChartBox).x) > 8) issues.push(`${firstDir}: fused x offsets differ`)
      if (Math.abs(center(first).y - center(second).y) > 8) issues.push(`${firstDir}: fused y positions differ`)
    }
    return issues
  }, iconSize)
  expect(mismatches).toEqual([])
}

async function expectNoArrowChartOverlap(page: Page) {
  const overlaps = await page.evaluate(() => {
    const collisions: string[] = []
    for (const side of ['left', 'right']) {
      const chart = document.querySelector<HTMLElement>(`[data-binocular-eye-chart="${side}"]`)
      const half = chart?.parentElement?.parentElement
      if (!chart || !half) { collisions.push(`${side}: missing chart`); continue }
      const optotypes = [...chart.querySelectorAll('svg[viewBox="0 0 50 50"]')]
      const arrows = [...half.querySelectorAll('[data-binocular-arrow-column] svg')]
      if (optotypes.length === 0) collisions.push(`${side}: missing E optotypes`)
      for (const glyph of optotypes) {
        const g = glyph.getBoundingClientRect()
        for (const element of arrows) {
          const a = element.getBoundingClientRect()
          if (g.left < a.right && g.right > a.left && g.top < a.bottom && g.bottom > a.top) collisions.push(`${side}: glyph overlaps arrow`)
        }
      }
    }
    return collisions
  })
  expect(overlaps).toEqual([])
}

async function expectPairedOptotypes(page: Page) {
  const mismatches = await page.evaluate(() => {
    type Glyph = { identity: string | null; size: string | null; opacity: string; color: string | null; bars: string[]; x: number; y: number; width: number; height: number }
    const charts = ['left', 'right'].map(side => document.querySelector<HTMLElement>(`[data-binocular-eye-chart="${side}"]`))
    if (!charts[0] || !charts[1]) return ['missing chart']
    const chartBoxes = charts.map(chart => chart!.getBoundingClientRect())
    const rows = charts.map(chart => [...chart!.querySelectorAll<HTMLElement>('[data-binocular-chart-row]')])
    const issues: string[] = []
    if (rows[0].length !== rows[1].length) issues.push('row counts differ')
    for (let rowIndex = 0; rowIndex < Math.min(rows[0].length, rows[1].length); rowIndex += 1) {
      const rowPair = rows.map(sideRows => sideRows[rowIndex])
      if (getComputedStyle(rowPair[0]).opacity !== getComputedStyle(rowPair[1]).opacity) issues.push(`row ${rowIndex}: opacity differs`)
      const glyphRows: Glyph[][] = rowPair.map((row, sideIndex) => [...row.querySelectorAll<HTMLElement>('[data-binocular-optotype-size]')].map(target => {
        const glyph = target.querySelector<SVGSVGElement>('svg[viewBox="0 0 50 50"]')
        const box = glyph?.getBoundingClientRect()
        return {
          identity: target.getAttribute('data-binocular-target'),
          size: target.getAttribute('data-binocular-optotype-size'),
          opacity: getComputedStyle(row).opacity,
          color: glyph?.querySelector('g')?.getAttribute('fill') ?? null,
          bars: [...(glyph?.querySelectorAll('rect') ?? [])].map(rect => `${rect.getAttribute('width')}x${rect.getAttribute('height')}`),
          x: box ? box.left + box.width / 2 - (chartBoxes[sideIndex].left + chartBoxes[sideIndex].width / 2) : NaN,
          y: box ? box.top + box.height / 2 - chartBoxes[sideIndex].top : NaN,
          width: box?.width ?? NaN,
          height: box?.height ?? NaN,
        }
      }))
      if (glyphRows[0].length !== glyphRows[1].length) issues.push(`row ${rowIndex}: glyph counts differ`)
      for (let index = 0; index < Math.min(glyphRows[0].length, glyphRows[1].length); index += 1) {
        const [leftGlyph, rightGlyph] = [glyphRows[0][index], glyphRows[1][index]]
        if (leftGlyph.identity !== rightGlyph.identity || leftGlyph.size !== rightGlyph.size || leftGlyph.width !== rightGlyph.width || leftGlyph.height !== rightGlyph.height || leftGlyph.bars.join() !== rightGlyph.bars.join() || leftGlyph.opacity !== rightGlyph.opacity || Math.abs(leftGlyph.x - rightGlyph.x) > 1 || Math.abs(leftGlyph.y - rightGlyph.y) > 1) issues.push(`row ${rowIndex} glyph ${index}: paired geometry differs`)
        if (leftGlyph.color !== '#DD0000' || rightGlyph.color !== '#009500') issues.push(`row ${rowIndex} glyph ${index}: wrong eye colors`)
      }
    }
    return issues
  })
  expect(mismatches).toEqual([])
}

async function visibleRowCount(page: Page, side: 'left' | 'right') {
  return page.locator(`[data-binocular-eye-viewport="${side}"]`).evaluate(viewport => {
    const viewportBox = viewport.getBoundingClientRect()
    return [...viewport.querySelectorAll<HTMLElement>('[data-binocular-chart-row]')].filter(row => {
      const box = row.getBoundingClientRect()
      return box.top < viewportBox.bottom && box.bottom > viewportBox.top
    }).length
  })
}

async function expectNoHorizontalEyeOverflow(page: Page) {
  const widths = await page.locator('[data-binocular-eye-viewport]').evaluateAll(elements =>
    elements.map(element => ({ client: (element as HTMLElement).clientWidth, content: (element as HTMLElement).scrollWidth })),
  )
  expect(widths).toHaveLength(2)
  expect(widths.every(({ client, content }) => content <= client)).toBe(true)
}

test('Red/Green directional-E follows the active row after midpoint and keeps manual paired scroll on phone landscape', async ({ page }) => {
  test.setTimeout(90000)
  await startRedGreen(page, { width: 844, height: 390 }, 'E →', 'Phone')
  const left = page.locator('[data-binocular-eye-chart="left"]')
  const right = page.locator('[data-binocular-eye-chart="right"]')
  const leftViewport = page.locator('[data-binocular-eye-viewport="left"]')
  const rightViewport = page.locator('[data-binocular-eye-viewport="right"]')
  const exit = page.getByRole('button', { name: 'Exit', exact: true })
  const voice = page.getByRole('button', { name: 'Voice OFF' })
  expect(SCREEN_E_LINE_MULTIPLIERS).toHaveLength(14)
  await expect(left.locator('[data-binocular-chart-row]')).toHaveCount(14)
  await expect(right.locator('[data-binocular-chart-row]')).toHaveCount(14)
  await expect(left.locator('[data-binocular-current-target="true"]')).toBeInViewport()
  await expect(right.locator('[data-binocular-current-target="true"]')).toBeInViewport()
  await expect(exit).toBeInViewport({ ratio: 1 })
  await expect(voice).toBeInViewport({ ratio: 1 })
  await expectNoHorizontalEyeOverflow(page)
  await expect(page.getByRole('button', { name: /^Left eye answer:/ })).toHaveCount(4)
  await expect(page.getByRole('button', { name: /^Right eye answer:/ })).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Widen eye chart separation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Narrow eye chart separation' })).toBeVisible()
  expect(await visibleRowCount(page, 'left')).toBeGreaterThan(1)
  expect(await visibleRowCount(page, 'left')).toBeLessThan(14)
  await expectArrowFusion(page, 40)
  await expectNoArrowChartOverlap(page)
  await expectPairedOptotypes(page)
  await page.screenshot({ path: 'test-results/vision-binocular-phone-landscape.png' })

  const viewportSize = await page.evaluate(() => ({ width: window.innerWidth, dpr: window.devicePixelRatio }))
  for (let rowIndex = 0; rowIndex < 14; rowIndex += 1) {
    const expectedSize = screenELineSize(viewportSize.width, rowIndex, viewportSize.dpr)
    for (const chart of [left, right]) {
      const row = chart.locator(`[data-binocular-chart-row="${rowIndex}"]`)
      await expect(row.locator('[data-binocular-optotype-size]').first()).toHaveAttribute('data-binocular-optotype-size', String(expectedSize))
      const expectedLetters = SCREEN_E_LINE_LETTER_COUNTS[rowIndex]
      await expect(row.locator('[data-binocular-optotype-size]')).toHaveCount(expectedLetters)
    }
  }

  const leftTarget = left.locator('[data-binocular-current-target="true"]')
  const rightTarget = right.locator('[data-binocular-current-target="true"]')
  const initialSize = await leftTarget.getAttribute('data-binocular-optotype-size')
  const initialSeparation = await chartSeparation(left, right)
  expect(initialSeparation / 844).toBeGreaterThanOrEqual(0.36)
  expect(initialSeparation / 844).toBeLessThanOrEqual(0.46)
  const ipd = page.locator('[data-binocular-ipd-narrow]').locator('xpath=..')
  expect((await ipd.boundingBox())?.width).toBe(64)

  for (let step = 0; step < 2; step += 1) {
    const before = await chartSeparation(left, right)
    await page.locator('[data-binocular-ipd-narrow]').click()
    await expect.poll(() => chartSeparation(left, right)).toBeLessThan(before)
    await expectArrowFusion(page, 40)
    expect(await leftTarget.getAttribute('data-binocular-optotype-size')).toBe(initialSize)
  }
  expect((await ipd.boundingBox())?.width).toBe(48)
  const narrowSeparation = await chartSeparation(left, right)

  for (let step = 0; step < 14; step += 1) {
    const before = await chartSeparation(left, right)
    await page.locator('[data-binocular-ipd-widen]').click()
    await expect.poll(() => chartSeparation(left, right)).toBeGreaterThan(before)
  }
  expect((await ipd.boundingBox())?.width).toBe(160)
  expect(await chartSeparation(left, right)).toBeGreaterThan(narrowSeparation)
  expect(await leftTarget.getAttribute('data-binocular-optotype-size')).toBe(initialSize)
  await expectArrowFusion(page, 40)
  await expectNoArrowChartOverlap(page)
  await expectNoHorizontalEyeOverflow(page)

  const initialLeftScroll = await leftViewport.evaluate(element => element.scrollTop)
  const initialRightScroll = await rightViewport.evaluate(element => element.scrollTop)
  const shellScroll = await page.locator('[data-binocular-scroll-shell="redgreen"]').evaluate(element => element.scrollTop)
  const pageScroll = await page.evaluate(() => window.scrollY)
  expect(initialLeftScroll).toBe(0)
  expect(initialRightScroll).toBe(0)

  const leftViewportBox = await leftViewport.boundingBox()
  expect(leftViewportBox).not.toBeNull()
  await page.mouse.move(leftViewportBox!.x + leftViewportBox!.width / 2, leftViewportBox!.y + leftViewportBox!.height / 2)
  await page.mouse.wheel(0, 2000)
  await expect.poll(() => leftViewport.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await expect.poll(() => rightViewport.evaluate(element => element.scrollTop)).toBe(await leftViewport.evaluate(element => element.scrollTop))
  await page.mouse.wheel(0, -2000)
  await expect.poll(() => leftViewport.evaluate(element => element.scrollTop)).toBe(0)
  await expect.poll(() => rightViewport.evaluate(element => element.scrollTop)).toBe(0)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(pageScroll)

  const answerCount = SCREEN_E_LINE_LETTER_COUNTS.reduce((sum, count) => sum + count, 0)
  let hasFollowedMidpoint = false
  for (let step = 0; step < answerCount - 1; step += 1) {
    const target = await leftTarget.getAttribute('data-binocular-target')
    const before = await leftViewport.evaluate(viewport => {
      const active = viewport.querySelector<HTMLElement>('[data-binocular-current-target="true"]')!
      const activeRow = active.parentElement as HTMLElement
      const rowIndex = Number(activeRow.getAttribute('data-binocular-chart-row'))
      const nextRow = viewport.querySelector<HTMLElement>(`[data-binocular-chart-row="${rowIndex + 1}"]`)
      const viewportBox = viewport.getBoundingClientRect()
      const nextRowBox = nextRow?.getBoundingClientRect()
      return {
        key: `${rowIndex}:${active.getAttribute('data-binocular-target-index')}`,
        rowIndex,
        scrollTop: viewport.scrollTop,
        maxScroll: viewport.scrollHeight - viewport.clientHeight,
        shouldFollowNextRow: Boolean(nextRowBox && nextRowBox.top + nextRowBox.height / 2 - viewportBox.top >= viewport.clientHeight / 2),
      }
    })
    expect(target).toBe(await rightTarget.getAttribute('data-binocular-target'))
    await page.locator(`[data-binocular-answer-arrow="${target}"]`).first().evaluate(button => (button as HTMLButtonElement).click())
    await expect.poll(() => leftViewport.evaluate(viewport => {
      const active = viewport.querySelector<HTMLElement>('[data-binocular-current-target="true"]')!
      return `${active.parentElement?.getAttribute('data-binocular-chart-row')}:${active.getAttribute('data-binocular-target-index')}`
    })).not.toBe(before.key)
    const after = await leftViewport.evaluate(viewport => {
      const active = viewport.querySelector<HTMLElement>('[data-binocular-current-target="true"]')!
      const row = active.parentElement as HTMLElement
      const viewportBox = viewport.getBoundingClientRect()
      const rowBox = row.getBoundingClientRect()
      const maxScroll = viewport.scrollHeight - viewport.clientHeight
      return {
        rowIndex: Number(row.getAttribute('data-binocular-chart-row')),
        scrollTop: viewport.scrollTop,
        maxScroll,
        rowTop: rowBox.top - viewportBox.top,
        rowBottom: rowBox.bottom - viewportBox.top,
        rowCenter: rowBox.top + rowBox.height / 2 - viewportBox.top,
        midpoint: viewport.clientHeight / 2,
      }
    })
    if (after.rowIndex > before.rowIndex && before.shouldFollowNextRow && before.scrollTop < before.maxScroll - 1) {
      expect(after.scrollTop).toBeGreaterThan(before.scrollTop)
      hasFollowedMidpoint = true
    }
    expect(await rightViewport.evaluate(element => element.scrollTop)).toBe(after.scrollTop)
    expect(after.rowTop).toBeGreaterThanOrEqual(0)
    expect(after.rowBottom).toBeLessThanOrEqual((await leftViewport.boundingBox())!.height + 1)
    if (hasFollowedMidpoint && after.scrollTop < after.maxScroll - 1) expect(Math.abs(after.rowCenter - after.midpoint)).toBeLessThanOrEqual(2)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(pageScroll)
    expect(await page.locator('[data-binocular-next]').count()).toBe(0)
  }
  expect(hasFollowedMidpoint).toBe(true)
  await expect(leftTarget.evaluate(element => element.parentElement?.getAttribute('data-binocular-chart-row'))).resolves.toBe('13')
  const finalRowInViewport = await leftViewport.evaluate(viewport => {
    const viewportBox = viewport.getBoundingClientRect()
    const rowBox = viewport.querySelector('[data-binocular-chart-row="13"]')!.getBoundingClientRect()
    return rowBox.top >= viewportBox.top && rowBox.bottom <= viewportBox.bottom
  })
  expect(finalRowInViewport).toBe(true)
  await expect.poll(() => leftViewport.evaluate(element => element.scrollTop)).toBe(await leftViewport.evaluate(element => element.scrollHeight - element.clientHeight))
  await page.screenshot({ path: 'test-results/vision-binocular-phone-landscape-late-row.png' })
  expect(await page.locator('[data-binocular-scroll-shell="redgreen"]').evaluate(element => element.scrollTop)).toBe(shellScroll)
  await expect(leftTarget).toHaveAttribute('data-binocular-target', await rightTarget.getAttribute('data-binocular-target') || '')
})

test('Red/Green directional-E preserves 14 paired levels and arrow geometry on desktop', async ({ page }) => {
  await startRedGreen(page, { width: 1280, height: 589 }, 'E →', 'Desktop')
  const left = page.locator('[data-binocular-eye-chart="left"]')
  const right = page.locator('[data-binocular-eye-chart="right"]')
  await expect(left.locator('[data-binocular-chart-row]')).toHaveCount(14)
  await expect(right.locator('[data-binocular-chart-row]')).toHaveCount(14)
  expect(await visibleRowCount(page, 'left')).toBeGreaterThan(1)
  await expectArrowFusion(page, 48)
  await expectNoArrowChartOverlap(page)
  await expectPairedOptotypes(page)
  await expectNoHorizontalEyeOverflow(page)
  await page.screenshot({ path: 'test-results/vision-binocular-desktop.png' })
})

test('Red/Green ABC follows paired scroll through its late rows', async ({ page }) => {
  test.setTimeout(90000)
  await startRedGreen(page, { width: 844, height: 390 }, 'ABC', 'Phone')
  const left = page.locator('[data-binocular-eye-chart="left"]')
  const right = page.locator('[data-binocular-eye-chart="right"]')
  const leftViewport = page.locator('[data-binocular-eye-viewport="left"]')
  const rightViewport = page.locator('[data-binocular-eye-viewport="right"]')
  await expect(left.locator('[data-binocular-chart-row]')).toHaveCount(14)
  await expect(right.locator('[data-binocular-chart-row]')).toHaveCount(14)
  await expect(page.getByRole('button', { name: 'Exit', exact: true })).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: 'Voice OFF' })).toBeInViewport({ ratio: 1 })
  const answerDock = page.locator('[data-binocular-letter-answer-dock]')
  await expect(answerDock).toBeVisible()
  const voiceBox = await page.getByRole('button', { name: 'Voice OFF' }).boundingBox()
  expect(voiceBox).not.toBeNull()
  expect(390 - (voiceBox!.y + voiceBox!.height)).toBeGreaterThanOrEqual(6)
  const dockBox = await answerDock.boundingBox()
  const eyeBoxes = await Promise.all([leftViewport.boundingBox(), rightViewport.boundingBox()])
  expect(dockBox).not.toBeNull()
  expect(eyeBoxes[0]).not.toBeNull()
  expect(eyeBoxes[1]).not.toBeNull()
  const pairedChartCenter = ((eyeBoxes[0]!.x + eyeBoxes[0]!.width / 2) + (eyeBoxes[1]!.x + eyeBoxes[1]!.width / 2)) / 2
  expect(Math.abs((dockBox!.x + dockBox!.width / 2) - pairedChartCenter)).toBeLessThanOrEqual(4)
  expect(dockBox!.y).toBeGreaterThanOrEqual(Math.max(eyeBoxes[0]!.y + eyeBoxes[0]!.height, eyeBoxes[1]!.y + eyeBoxes[1]!.height) - 1)
  await page.screenshot({ path: 'test-results/vision-binocular-abc-phone-landscape.png' })

  const viewportWidth = await page.evaluate(() => window.innerWidth)
  const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio)
  for (let rowIndex = 0; rowIndex < 14; rowIndex += 1) {
    const expectedSize = screenELineSize(viewportWidth, rowIndex, devicePixelRatio)
    for (const chart of [left, right]) {
      const row = chart.locator(`[data-binocular-chart-row="${rowIndex}"]`)
      const sizes = await row.locator('[data-binocular-optotype-size]').evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-binocular-optotype-size'))))
      expect(sizes).toHaveLength(SCREEN_E_LINE_LETTER_COUNTS[rowIndex])
      expect(sizes.every(size => size === expectedSize)).toBe(true)
    }
  }
  const leftTarget = left.locator('[data-binocular-current-target="true"]')
  const rightTarget = right.locator('[data-binocular-current-target="true"]')
  const size = await leftTarget.getAttribute('data-binocular-optotype-size')
  expect(await leftTarget.getAttribute('data-binocular-target')).toBe(await rightTarget.getAttribute('data-binocular-target'))
  await expect(leftTarget.locator('div').last()).toHaveCSS('font-weight', '500')
  await expect(leftTarget.locator('div').last()).toHaveCSS('font-size', `${Number(size) * 0.8}px`)
  const answers = page.locator('[data-binocular-letter-answer-dock]')
  const answerButtons = answers.locator('[data-binocular-center-answer]')
  await expect(answerButtons).toHaveCount(4)
  for (const button of await answerButtons.all()) {
    const box = await button.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(48)
    expect(box?.height).toBeGreaterThanOrEqual(48)
  }
  const beforeSeparation = await chartSeparation(left, right)
  await page.locator('[data-binocular-ipd-widen]').click()
  await expect.poll(() => chartSeparation(left, right)).toBeGreaterThan(beforeSeparation)
  expect(await leftTarget.getAttribute('data-binocular-optotype-size')).toBe(size)

  const initialLeftScroll = await leftViewport.evaluate(element => element.scrollTop)
  const initialRightScroll = await rightViewport.evaluate(element => element.scrollTop)
  const currentLetter = await leftTarget.getAttribute('data-binocular-target')
  const wrong = (await answerButtons.allTextContents()).find(letter => letter.trim() !== currentLetter)
  await answers.getByRole('button', { name: wrong!, exact: true }).click()
  await expect(left.locator('[data-binocular-current-target="true"]')).toHaveAttribute('data-binocular-target-index', '0')
  const target = await leftTarget.getAttribute('data-binocular-target')
  await answers.getByRole('button', { name: target!, exact: true }).evaluate(button => (button as HTMLButtonElement).click())
  await expect(left.locator('[data-binocular-current-target="true"]')).toHaveAttribute('data-binocular-target-index', '1')
  expect(await leftViewport.evaluate(element => element.scrollTop)).toBe(initialLeftScroll)
  expect(await rightViewport.evaluate(element => element.scrollTop)).toBe(initialRightScroll)

  const answerCount = SCREEN_E_LINE_LETTER_COUNTS.reduce((sum, count) => sum + count, 0)
  for (let step = 0; step < answerCount - 2; step += 1) {
    const current = await leftTarget.getAttribute('data-binocular-target')
    const beforeKey = await leftTarget.evaluate(element => `${element.parentElement?.getAttribute('data-binocular-chart-row')}:${element.getAttribute('data-binocular-target-index')}`)
    await answers.getByRole('button', { name: current!, exact: true }).evaluate(button => (button as HTMLButtonElement).click())
    await expect.poll(() => leftTarget.evaluate(element => `${element.parentElement?.getAttribute('data-binocular-chart-row')}:${element.getAttribute('data-binocular-target-index')}`)).not.toBe(beforeKey)
  }
  await expect(leftTarget.evaluate(element => element.parentElement?.getAttribute('data-binocular-chart-row'))).resolves.toBe('13')
  await expect.poll(() => leftViewport.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await expect.poll(() => rightViewport.evaluate(element => element.scrollTop)).toBe(await leftViewport.evaluate(element => element.scrollTop))
  const finalRowInViewport = await leftViewport.evaluate(viewport => {
    const viewportBox = viewport.getBoundingClientRect()
    const rowBox = viewport.querySelector('[data-binocular-chart-row="13"]')!.getBoundingClientRect()
    return rowBox.top >= viewportBox.top && rowBox.bottom <= viewportBox.bottom
  })
  expect(finalRowInViewport).toBe(true)
  await expect.poll(() => leftViewport.evaluate(element => element.scrollTop)).toBe(await leftViewport.evaluate(element => element.scrollHeight - element.clientHeight))
  await expect(leftTarget).toHaveAttribute('data-binocular-target', await rightTarget.getAttribute('data-binocular-target') || '')
  await expect(page.locator('[data-binocular-next]')).toHaveCount(0)
})
