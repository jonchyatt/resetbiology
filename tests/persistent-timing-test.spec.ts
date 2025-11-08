import { test } from '@playwright/test'
import { getPage } from './persistent-browser'

test('Test timing with persistent browser', async () => {
  test.setTimeout(300000) // 5 minutes

  const page = await getPage()

  // Enable console logging
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('timing=') || text.includes('Protocol saved') || text.includes('Loading protocol')) {
      console.log('Browser:', text)
    }
  })

  console.log('🌐 Navigating to peptides page...')
  await page.goto('https://resetbiology.com/peptides')
  await page.waitForTimeout(3000)

  console.log('🖱️  Clicking Edit button')
  const editButton = page.locator('button[title="Edit Protocol"]').first()
  await editButton.waitFor({ state: 'visible', timeout: 10000 })
  await editButton.click()
  await page.waitForTimeout(1000)

  console.log('🗑️  Removing existing times')
  const removeButtons = page.locator('button:has-text("×")')
  const count = await removeButtons.count()
  for (let i = 0; i < count; i++) {
    await removeButtons.first().click()
    await page.waitForTimeout(300)
  }

  console.log('⏰ Adding time: 15:50')
  await page.locator('input[type="time"]').fill('15:50')
  await page.waitForTimeout(500)

  console.log('➕ Clicking Add Time')
  await page.locator('button:has-text("+ Add Time")').click()
  await page.waitForTimeout(500)

  console.log('💾 Clicking Save Changes')
  await page.locator('button:has-text("Save Changes")').click()
  await page.waitForTimeout(3000)

  console.log('🔄 Refreshing page...')
  await page.reload()
  await page.waitForTimeout(3000)

  console.log('✅ Test complete! Browser will stay open.')
  console.log('📋 Check the browser console for timing values')
  console.log('⏸️  Pausing indefinitely - press Ctrl+C to close')

  // Keep test running so browser stays open
  await page.waitForTimeout(300000)
})
