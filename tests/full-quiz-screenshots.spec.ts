import { test, expect } from '@playwright/test'

test('Full quiz walkthrough - screenshot every step', async ({ page }) => {
  test.setTimeout(180000) // 3 minutes

  await page.goto('http://localhost:3001/get-started')
  await page.waitForTimeout(2000)

  let step = 1

  // Step 1: Contact - Name/Email
  await page.screenshot({ path: `test-results/step-${step++}-contact.png`, fullPage: true })
  await page.fill('input[placeholder="Your preferred name"]', 'Test User')
  await page.fill('input[placeholder="your.email@example.com"]', 'test@example.com')
  await page.click('button:has-text("Next")')
  await page.waitForTimeout(1000)

  // Step 2: Audit - multi-select
  await page.screenshot({ path: `test-results/step-${step++}-audit.png`, fullPage: true })
  await page.click('text=Tracking protein intake')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 3: Journey stage
  await page.screenshot({ path: `test-results/step-${step++}-journey-stage.png`, fullPage: true })
  await page.click('text=Just getting started')
  await page.waitForTimeout(1500)

  // Step 4: Desired outcome
  await page.screenshot({ path: `test-results/step-${step++}-desired-outcome.png`, fullPage: true })
  await page.click('text=Build a sustainable system')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 5: Biggest obstacle
  await page.screenshot({ path: `test-results/step-${step++}-biggest-obstacle.png`, fullPage: true })
  await page.click('text=I can\'t stay consistent')
  await page.waitForTimeout(1500)

  // Step 6: Amplification - why change (NOW BEFORE VISION)
  await page.screenshot({ path: `test-results/step-${step++}-why-change.png`, fullPage: true })
  await page.fill('textarea', 'I want to feel better')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 7: Amplification - readiness scale
  await page.screenshot({ path: `test-results/step-${step++}-readiness-scale.png`, fullPage: true })
  await page.click('button:has-text("8")')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 8: Amplification - why not lower
  await page.screenshot({ path: `test-results/step-${step++}-why-not-lower.png`, fullPage: true })
  await page.fill('textarea', 'Because I am motivated')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 9: Amplification - positive outcomes
  await page.screenshot({ path: `test-results/step-${step++}-positive-outcomes.png`, fullPage: true })
  await page.fill('textarea', 'Better health and energy')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 10: Amplification - why important
  await page.screenshot({ path: `test-results/step-${step++}-why-important.png`, fullPage: true })
  await page.fill('textarea', 'For my family')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 11: Vision - success vision (NOW AFTER AMPLIFICATION)
  await page.screenshot({ path: `test-results/step-${step++}-success-vision.png`, fullPage: true })
  await page.fill('textarea', 'I will feel amazing and healthy')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Step 12: Vision - success feeling
  await page.screenshot({ path: `test-results/step-${step++}-success-feeling.png`, fullPage: true })
  await page.fill('textarea', 'Confident and proud')
  await page.click('button:has-text("Continue")')
  await page.waitForTimeout(1000)

  // Final step
  await page.screenshot({ path: `test-results/step-${step++}-final.png`, fullPage: true })

  console.log(`Captured ${step - 1} screenshots`)
})
