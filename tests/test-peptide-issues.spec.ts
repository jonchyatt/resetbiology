import { test, expect } from '@playwright/test'

test.describe('Peptide Tracker - Issue Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/peptides')
    await page.waitForLoadState('networkidle')
  })

  test('Test actual peptide flow with clicking', async ({ page }) => {
    console.log('🧪 Testing peptide tracker issues...')
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'initial-peptide-page.png', fullPage: true })
    
    // Check if IRB orange bar is present
    const irbBar = page.locator('text=IRB-Approved Research Protocol')
    if (await irbBar.isVisible()) {
      console.log('❌ IRB orange bar is still present')
    } else {
      console.log('✅ IRB orange bar removed')
    }
    
    // Go to library and add a peptide
    console.log('📝 Adding Ipamorelin protocol...')
    await page.click('text=library')
    await page.waitForTimeout(1000)
    
    // Add Ipamorelin (first protocol)
    await page.click('text=Add to My Protocols >> nth=0')
    
    // Go back to current protocols
    await page.click('text=current')
    await page.waitForTimeout(1000)
    
    // Check if protocol appears
    await expect(page.locator('text=Ipamorelin')).toBeVisible()
    console.log('✅ Ipamorelin protocol added')
    
    // Take screenshot after adding protocol
    await page.screenshot({ path: 'after-adding-protocol.png', fullPage: true })
    
    // Test Log Dose from Active Protocols
    console.log('📝 Testing Log Dose from Active Protocols...')
    const logDoseButton = page.locator('text=Log Dose').first()
    await logDoseButton.click()
    
    // Check if dose modal opens
    const doseModal = page.locator('text=Log Dose >> .. >> .. >> text=Log Dose')
    if (await doseModal.isVisible()) {
      console.log('✅ Log Dose modal opened')
      
      // Fill in some notes
      await page.fill('textarea', 'Test dose from active protocols')
      
      // Select a side effect
      await page.check('text=Fatigue')
      
      // Click Log Dose
      await page.click('button:has-text("Log Dose")')
      await page.waitForTimeout(1000)
      
      // Check if dose appears in Today's Doses
      const todaysDoses = page.locator('text=Today\'s Doses')
      const testDoseNote = page.locator('text=Test dose from active protocols')
      
      if (await testDoseNote.isVisible()) {
        console.log('✅ Logged dose shows notes in Today\'s Doses')
      } else {
        console.log('❌ Logged dose notes not visible in Today\'s Doses')
      }
      
    } else {
      console.log('❌ Log Dose modal did not open')
    }
    
    // Take screenshot of final state
    await page.screenshot({ path: 'final-peptide-state.png', fullPage: true })
    
    console.log('🧪 Test completed - check screenshots for visual verification')
  })
})