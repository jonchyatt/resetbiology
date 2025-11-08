import { test, expect } from '@playwright/test'

test.use({ storageState: 'auth-state.json' })

test('Verify notification system is working', async ({ page }) => {
  test.setTimeout(60000)

  const consoleLogs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    consoleLogs.push(text)
  })

  console.log('🌐 Loading peptides page...')
  await page.goto('https://resetbiology.com/peptides')
  await page.waitForTimeout(3000)

  // Check for notification preference loading
  const prefsLog = consoleLogs.find(log => log.includes('Loaded notification preferences'))
  console.log('📋 Notification Preferences:', prefsLog || 'NOT FOUND')

  // Check protocols loaded
  const protocolLog = consoleLogs.find(log => log.includes('protocols from database'))
  console.log('📋 Protocols:', protocolLog || 'NOT FOUND')

  // Look for Edit button with title attribute
  console.log('🔍 Looking for Edit button...')
  const editButton = page.locator('button[title="Edit Protocol"]').first()

  try {
    await editButton.waitFor({ state: 'visible', timeout: 10000 })
    console.log('✅ Edit button found!')

    // Click to open edit modal
    await editButton.click()
    await page.waitForTimeout(1000)

    // Check if timing inputs are visible
    const timeInputs = page.locator('input[type="time"]')
    const timeInputCount = await timeInputs.count()
    console.log(`⏰ Found ${timeInputCount} time input(s)`)

    if (timeInputCount > 0) {
      // Get current time value
      const currentValue = await timeInputs.first().inputValue()
      console.log(`📅 Current timing value: ${currentValue}`)

      // Try changing it to verify it saves
      const testTime = '14:30'
      console.log(`🔧 Changing time to: ${testTime}`)
      await timeInputs.first().fill(testTime)
      await page.waitForTimeout(500)

      // Look for Save button
      const saveButton = page.locator('button:has-text("Save")').first()
      await saveButton.click()
      console.log('💾 Clicked Save button')
      await page.waitForTimeout(3000)

      // Check for success/save logs
      const saveSuccessLog = consoleLogs.find(log =>
        log.includes('saved') || log.includes('Updated') || log.includes('success')
      )
      console.log('💾 Save result:', saveSuccessLog || 'No save confirmation found')

      // Reload and verify persistence
      console.log('🔄 Reloading page to verify persistence...')
      consoleLogs.length = 0
      await page.reload()
      await page.waitForTimeout(3000)

      const reloadLog = consoleLogs.find(log => log.includes('timing'))
      console.log('📋 After reload:', reloadLog || 'No timing log found')

    } else {
      console.log('❌ No time inputs found in edit modal')
    }

  } catch (error) {
    console.log('❌ Could not find Edit button or test failed:', error.message)
  }

  // Print all console logs for debugging
  console.log('\n📊 ALL CONSOLE LOGS:')
  consoleLogs.slice(-20).forEach((log, i) => {
    if (log.includes('notification') || log.includes('timing') || log.includes('protocol')) {
      console.log(`  ${i}: ${log}`)
    }
  })

  // Keep browser open for manual inspection
  console.log('\n⏸️  Browser staying open for 30 seconds for inspection...')
  await page.waitForTimeout(30000)
})
