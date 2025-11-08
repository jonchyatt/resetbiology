import { test, expect } from '@playwright/test'

test('Debug protocol timing save/load', async ({ page }) => {
  // Set very long timeout for this test
  test.setTimeout(600000) // 10 minutes

  // Listen to console logs
  const consoleLogs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    console.log('Browser Console:', text)
    consoleLogs.push(text)
  })

  // Open the site
  await page.goto('https://resetbiology.com')

  console.log('\n🚀 Browser opened at resetbiology.com!')
  console.log('⏸️  WAITING FOR YOU TO LOG IN...')
  console.log('📋 Please:')
  console.log('   1. Log in with Auth0')
  console.log('   2. Navigate to /peptides page')
  console.log('   3. Press F12 to open DevTools Console')
  console.log('   4. Tell me in chat when ready!\n')
  console.log('⏳ I will wait here... (up to 10 minutes)\n')

  // Wait for 10 minutes - tell me when you're ready!
  await page.waitForTimeout(600000)

  console.log('\n✅ Continuing automation...\n')

  // Wait for protocols to load
  console.log('🔍 Waiting for protocols to load...')
  await page.waitForSelector('text=/Ipamorelin|BPC-157|TB-500/i', { timeout: 10000 })

  // Find and click the edit button for first protocol
  console.log('🖱️  Looking for Edit button...')
  const editButton = page.locator('button:has-text("Edit")').first()
  await editButton.click()

  console.log('✅ Edit modal opened')
  await page.waitForTimeout(1000)

  // Clear existing times
  console.log('🗑️  Removing existing dose times...')
  const removeButtons = page.locator('button:has-text("×")')
  const count = await removeButtons.count()
  for (let i = 0; i < count; i++) {
    await removeButtons.first().click()
    await page.waitForTimeout(200)
  }

  // Add new specific time: 15:50 (3:50 PM)
  console.log('⏰ Adding new dose time: 15:50')
  const timeInput = page.locator('input[type="time"]')
  await timeInput.fill('15:50')
  await page.waitForTimeout(500)

  // Click Add Time button
  const addTimeButton = page.locator('button:has-text("+ Add Time")')
  await addTimeButton.click()
  await page.waitForTimeout(500)

  console.log('💾 Clicking Save Changes...')
  const saveButton = page.locator('button:has-text("Save Changes")')
  await saveButton.click()

  // Wait for save to complete
  await page.waitForTimeout(3000)

  // Check console logs for the save confirmation
  console.log('\n📊 Checking console logs after save:')
  const saveLog = consoleLogs.find(log => log.includes('Protocol saved successfully'))
  const loadLog = consoleLogs.find(log => log.includes('Loading protocol') && log.includes('timing='))

  if (saveLog) {
    console.log('✅ Save log found:', saveLog)
  } else {
    console.log('❌ No save log found!')
  }

  if (loadLog) {
    console.log('✅ Load log found:', loadLog)

    // Extract the timing value
    const timingMatch = loadLog.match(/timing="([^"]*)"/)
    if (timingMatch) {
      const timingValue = timingMatch[1]
      console.log(`🎯 Timing value from database: "${timingValue}"`)

      if (timingValue === '15:50') {
        console.log('✅ SUCCESS! Timing saved correctly as 15:50')
      } else if (timingValue === '' || timingValue === 'null') {
        console.log('❌ FAIL! Timing is empty in database')
      } else if (timingValue === 'AM' || timingValue === '08:00') {
        console.log('❌ FAIL! Timing reverted to default')
      } else {
        console.log(`⚠️  Timing has unexpected value: "${timingValue}"`)
      }
    }
  } else {
    console.log('❌ No load log found!')
  }

  // Now refresh the page to test persistence
  console.log('\n🔄 Refreshing page to test persistence...')
  await page.reload()
  await page.waitForTimeout(3000)

  // Check console logs after reload
  const reloadLogs = consoleLogs.filter(log =>
    log.includes('Loading protocol') && log.includes('timing=')
  )

  console.log('\n📊 Console logs after page reload:')
  if (reloadLogs.length > 0) {
    const latestLoadLog = reloadLogs[reloadLogs.length - 1]
    console.log('Latest load log:', latestLoadLog)

    const timingMatch = latestLoadLog.match(/timing="([^"]*)"/)
    if (timingMatch) {
      const timingValue = timingMatch[1]
      console.log(`🎯 Timing value after reload: "${timingValue}"`)

      if (timingValue === '15:50') {
        console.log('✅ PERSISTENCE TEST PASSED! Timing is still 15:50 after reload')
      } else {
        console.log('❌ PERSISTENCE TEST FAILED! Timing changed after reload')
      }
    }
  }

  // Click Edit again to see what shows in the UI
  console.log('\n🖱️  Opening Edit modal again to check UI...')
  const editButton2 = page.locator('button:has-text("Edit")').first()
  await editButton2.click()
  await page.waitForTimeout(1000)

  // Check what times are showing
  const doseTimeTags = page.locator('div:has-text("Dose Times") ~ div button')
  const doseTimeCount = await doseTimeTags.count()
  console.log(`\n📋 Dose times showing in UI: ${doseTimeCount}`)

  for (let i = 0; i < doseTimeCount; i++) {
    const timeText = await doseTimeTags.nth(i).textContent()
    console.log(`   Time ${i + 1}: ${timeText}`)
  }

  console.log('\n✅ Test complete! Check the logs above for results.')
  console.log('⏸️  Pausing for 30 seconds so you can inspect the page...')
  await page.waitForTimeout(30000)
})
