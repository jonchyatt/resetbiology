import { test, expect } from '@playwright/test'

test.describe('Peptide Tracker Real Clicking Test', () => {
  test('Test peptide issues with actual clicking', async ({ page }) => {
    console.log('🧪 Starting real clicking test...')
    
    await page.goto('http://localhost:3000/peptides')
    await page.waitForLoadState('networkidle')
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-initial.png', fullPage: true })
    
    // Check for IRB bar
    const irbBar = page.locator('text=IRB-Approved Research Protocol')
    if (await irbBar.isVisible()) {
      console.log('❌ IRB bar still present')
    }
    
    // Add a peptide protocol
    console.log('Adding protocol...')
    await page.click('text=library')
    await page.waitForTimeout(1000)
    
    await page.click('text=Add to My Protocols >> nth=0')
    await page.click('text=current')
    await page.waitForTimeout(1000)
    
    // Check if protocol was added
    await expect(page.locator('text=Ipamorelin')).toBeVisible()
    console.log('✅ Protocol added')
    
    // Take screenshot after adding
    await page.screenshot({ path: 'test-after-add.png', fullPage: true })
    
    // Test Log Dose from Active Protocols
    console.log('Testing Log Dose from Active Protocols...')
    const activeLogDose = page.locator('.grid >> text=Log Dose').first()
    await activeLogDose.click()
    
    // Check if modal opens
    const modal = page.locator('text=Log Dose').nth(1)
    if (await modal.isVisible()) {
      console.log('✅ Modal opened')
      
      await page.fill('textarea', 'Test from active protocols')
      await page.check('text=Fatigue')
      await page.click('button:has-text("Log Dose")')
      await page.waitForTimeout(1000)
      
      // Take final screenshot
      await page.screenshot({ path: 'test-final.png', fullPage: true })
      
      // Check if logged dose shows up
      const noteText = page.locator('text=Test from active protocols')
      if (await noteText.isVisible()) {
        console.log('✅ Logged dose notes visible')
      } else {
        console.log('❌ Logged dose notes NOT visible')
      }
    } else {
      console.log('❌ Modal did not open')
    }
    
    console.log('🧪 Test complete')
  })
})