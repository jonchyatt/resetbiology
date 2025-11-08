import { test, expect } from '@playwright/test'

test.use({ storageState: 'auth-state.json' })

test('Test protocol timing with saved auth', async ({ page }) => {
  test.setTimeout(120000) // 2 minutes

  const consoleLogs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    console.log('Browser:', text)
    consoleLogs.push(text)
  })

  console.log('🌐 Going to peptides page (using saved auth)')
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

  console.log('💾 Saving changes')
  const saveButton = page.locator('button:has-text("Save Changes")')
  const buttonCount = await saveButton.count()
  console.log(`Found ${buttonCount} "Save Changes" buttons`)
  await saveButton.click()
  await page.waitForTimeout(5000)

  console.log('\n📊 ALL CONSOLE LOGS AFTER SAVE:\n')
  console.log('Total logs:', consoleLogs.length)
  consoleLogs.forEach((log, i) => {
    console.log(`  ${i}: ${log}`)
  })

  const saveLog = consoleLogs.find(log => log.includes('Protocol saved'))
  if (saveLog) console.log('✅', saveLog)

  const loadLogs = consoleLogs.filter(log => log.includes('timing='))
  loadLogs.forEach(log => {
    console.log('📋', log)
    if (log.includes('timing="15:50"')) {
      console.log('   ✅ TIMING SAVED CORRECTLY!')
    }
  })

  console.log('\n🔄 Refreshing page...\n')
  consoleLogs.length = 0
  await page.reload()
  await page.waitForTimeout(3000)

  console.log('📊 CONSOLE LOGS AFTER RELOAD:\n')
  console.log('All logs after reload:', consoleLogs.length)
  consoleLogs.forEach((log, i) => {
    if (log.includes('💾') || log.includes('✅') || log.includes('📋') || log.includes('timing')) {
      console.log(`${i}: ${log}`)
    }
  })

  const reloadLogs = consoleLogs.filter(log => log.includes('timing='))
  reloadLogs.forEach(log => {
    console.log('📋', log)
    if (log.includes('timing="15:50"')) {
      console.log('   ✅ PERSISTENCE VERIFIED!')
    } else if (log.includes('timing="AM"') || log.includes('timing="08:00"')) {
      console.log('   ❌ REVERTED TO DEFAULT!')
    }
  })

  console.log('\n⏸️  Leaving browser open for inspection...')
  await page.waitForTimeout(60000)
})
