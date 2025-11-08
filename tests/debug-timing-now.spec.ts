import { test, expect } from '@playwright/test'

test('Test protocol timing NOW', async ({ page }) => {
  test.setTimeout(300000) // 5 minutes

  // Listen to console logs
  const consoleLogs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    console.log('Browser:', text)
    consoleLogs.push(text)
  })

  // Connect to existing page
  await page.goto('https://resetbiology.com/peptides')

  console.log('\n✅ Starting automation NOW!\n')

  // Short wait for page to stabilize
  await page.waitForTimeout(2000)

  // Wait for protocols to load
  console.log('🔍 Waiting for protocols to load...')
  await page.waitForSelector('button:has-text("Edit")', { timeout: 10000 })

  // Find and click the edit button for first protocol
  console.log('🖱️  Clicking Edit button...')
  const editButton = page.locator('button:has-text("Edit")').first()
  await editButton.click()

  console.log('✅ Edit modal opened')
  await page.waitForTimeout(1000)

  // Clear existing times
  console.log('🗑️  Removing existing dose times...')
  const removeButtons = page.locator('button:has-text("×")')
  const count = await removeButtons.count()
  console.log(`Found ${count} existing times to remove`)

  for (let i = 0; i < count; i++) {
    await removeButtons.first().click()
    await page.waitForTimeout(300)
  }

  // Add new specific time: 15:50 (3:50 PM)
  console.log('⏰ Adding new dose time: 15:50')
  const timeInput = page.locator('input[type="time"]')
  await timeInput.fill('15:50')
  await page.waitForTimeout(500)

  // Click Add Time button
  console.log('➕ Clicking Add Time button...')
  const addTimeButton = page.locator('button:has-text("+ Add Time")')
  await addTimeButton.click()
  await page.waitForTimeout(500)

  console.log('💾 Clicking Save Changes...')
  const saveButton = page.locator('button:has-text("Save Changes")')
  await saveButton.click()

  // Wait for save to complete
  console.log('⏳ Waiting for save to complete...')
  await page.waitForTimeout(3000)

  // Check console logs for the save confirmation
  console.log('\n📊 CHECKING CONSOLE LOGS AFTER SAVE:\n')

  const saveLog = consoleLogs.find(log => log.includes('Protocol saved successfully'))
  if (saveLog) {
    console.log('✅ Save log:', saveLog)
  } else {
    console.log('❌ No save log found!')
  }

  const loadLogs = consoleLogs.filter(log => log.includes('Loading protocol') && log.includes('timing='))
  console.log(`\nFound ${loadLogs.length} load logs`)

  loadLogs.forEach(log => {
    console.log('📋 Load log:', log)
    const timingMatch = log.match(/timing="([^"]*)"/)
    if (timingMatch) {
      const timingValue = timingMatch[1]
      console.log(`   🎯 Timing value: "${timingValue}"`)

      if (timingValue === '15:50') {
        console.log('   ✅ CORRECT! Timing is 15:50')
      } else if (timingValue === '' || timingValue === 'null') {
        console.log('   ❌ WRONG! Timing is empty')
      } else if (timingValue === 'AM' || timingValue === '08:00') {
        console.log('   ❌ WRONG! Timing reverted to default')
      } else {
        console.log(`   ⚠️  Unexpected value: "${timingValue}"`)
      }
    }
  })

  // Now refresh the page to test persistence
  console.log('\n🔄 REFRESHING PAGE TO TEST PERSISTENCE...\n')

  // Clear logs before reload
  consoleLogs.length = 0

  await page.reload()
  await page.waitForTimeout(3000)

  // Check console logs after reload
  const reloadLogs = consoleLogs.filter(log =>
    log.includes('Loading protocol') && log.includes('timing=')
  )

  console.log('📊 CONSOLE LOGS AFTER PAGE RELOAD:\n')
  if (reloadLogs.length > 0) {
    reloadLogs.forEach(log => {
      console.log('📋 Load log:', log)
      const timingMatch = log.match(/timing="([^"]*)"/)
      if (timingMatch) {
        const timingValue = timingMatch[1]
        console.log(`   🎯 Timing after reload: "${timingValue}"`)

        if (timingValue === '15:50') {
          console.log('   ✅ PERSISTENCE TEST PASSED!')
        } else {
          console.log('   ❌ PERSISTENCE TEST FAILED!')
        }
      }
    })
  } else {
    console.log('❌ No load logs found after reload')
  }

  // Click Edit again to see what shows in the UI
  console.log('\n🖱️  OPENING EDIT MODAL TO CHECK UI...\n')
  await page.waitForTimeout(1000)

  const editButton2 = page.locator('button:has-text("Edit")').first()
  await editButton2.click()
  await page.waitForTimeout(1000)

  // Check what times are showing
  const doseTimeTags = page.locator('div:has-text("Dose Times") button').filter({ hasText: /\d+:\d+/ })
  const doseTimeCount = await doseTimeTags.count()
  console.log(`📋 Dose times showing in UI: ${doseTimeCount}`)

  for (let i = 0; i < doseTimeCount; i++) {
    const timeText = await doseTimeTags.nth(i).textContent()
    console.log(`   ⏰ Time ${i + 1}: ${timeText}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('TEST COMPLETE!')
  console.log('='.repeat(60))
  console.log('⏸️  Pausing for 60 seconds so you can inspect...\n')

  await page.waitForTimeout(60000)
})
