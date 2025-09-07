import { test, expect } from '@playwright/test'

test.describe('Peptide Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/peptides')
    await page.waitForLoadState('networkidle')
  })

  test('should prevent duplicate peptide protocols', async ({ page }) => {
    // Navigate to library tab
    await page.click('text=library')
    
    // Add first Ipamorelin protocol
    await page.click('text=Add to My Protocols').first()
    
    // Go back to current tab to verify it was added
    await page.click('text=current')
    await expect(page.locator('text=Ipamorelin')).toBeVisible()
    
    // Try to add same peptide again
    await page.click('text=library')
    await page.click('text=Add to My Protocols').first()
    
    // Should show alert about duplicate
    await page.on('dialog', dialog => {
      expect(dialog.message()).toContain('already in your active protocols')
      dialog.accept()
    })
  })

  test('should open and function schedule modal', async ({ page }) => {
    // Add a protocol first
    await page.click('text=library')
    await page.click('text=Add to My Protocols').first()
    await page.click('text=current')
    
    // Click View Schedule button
    await page.click('text=View Schedule')
    
    // Verify schedule modal opens
    await expect(page.locator('text=Ipamorelin Schedule')).toBeVisible()
    await expect(page.locator('text=Current Protocol Details')).toBeVisible()
    await expect(page.locator('text=Weekly Schedule')).toBeVisible()
    
    // Close modal
    await page.click('text=Close')
    await expect(page.locator('text=Ipamorelin Schedule')).not.toBeVisible()
  })

  test('should log dose with notes and side effects', async ({ page }) => {
    // Add a protocol first
    await page.click('text=library')
    await page.click('text=Add to My Protocols').first()
    await page.click('text=current')
    
    // Click Log Dose button
    await page.click('text=Log Dose')
    
    // Verify dose modal opens
    await expect(page.locator('text=Log Dose')).toBeVisible()
    
    // Add notes
    await page.fill('textarea', 'Feeling energetic today')
    
    // Select side effects
    await page.check('text=Nausea')
    await page.check('text=Headache')
    
    // Submit dose log
    await page.click('button:has-text("Log Dose")')
    
    // Verify dose appears in Today's doses
    await expect(page.locator('text=Ipamorelin')).toBeVisible()
    await expect(page.locator('text=Feeling energetic today')).toBeVisible()
    await expect(page.locator('text=Nausea, Headache')).toBeVisible()
  })

  test('should prevent duplicate dose logging', async ({ page }) => {
    // Add a protocol first
    await page.click('text=library')
    await page.click('text=Add to My Protocols').first()
    await page.click('text=current')
    
    // Log first dose
    await page.click('text=Log Dose')
    await page.fill('textarea', 'First dose')
    await page.click('button:has-text("Log Dose")')
    
    // Try to log another dose for same protocol
    await page.click('text=Log Dose')
    
    // Should show alert about already logged
    await page.on('dialog', dialog => {
      expect(dialog.message()).toContain('already logged today')
      dialog.accept()
    })
  })

  test('should sync scheduled dose completion with dose logging', async ({ page }) => {
    // Add a protocol first
    await page.click('text=library')
    await page.click('text=Add to My Protocols').first()
    await page.click('text=current')
    
    // Should see scheduled dose in Today's doses
    await expect(page.locator('text=Log Dose').first()).toBeVisible()
    
    // Click "Log Dose" from Today's doses section
    await page.click('text=Log Dose').first()
    
    // Fill in dose logging form
    await page.fill('textarea', 'Scheduled dose completed')
    await page.check('text=Fatigue')
    await page.click('button:has-text("Log Dose")')
    
    // Verify dose is marked as completed with details
    await expect(page.locator('text=Completed')).toBeVisible()
    await expect(page.locator('text=Scheduled dose completed')).toBeVisible()
    await expect(page.locator('text=Fatigue')).toBeVisible()
  })
})