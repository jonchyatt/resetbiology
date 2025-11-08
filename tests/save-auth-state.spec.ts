import { test } from '@playwright/test'

test('Save authentication state', async ({ page }) => {
  test.setTimeout(600000) // 10 minutes max

  console.log('🌐 Opening browser at resetbiology.com')
  console.log('📋 Please log in with Auth0 and navigate to /peptides')
  console.log('⏳ Waiting for you to reach the peptides page...')

  await page.goto('https://resetbiology.com')

  // Wait for user to navigate to peptides page (indicates they're logged in)
  await page.waitForURL('**/peptides', { timeout: 600000 })

  console.log('✅ Detected you are on peptides page!')
  console.log('💾 Saving auth state...')

  // Wait a bit for protocols to load (confirms auth is working)
  await page.waitForTimeout(3000)

  // Save the auth state
  await page.context().storageState({ path: 'auth-state.json' })
  console.log('✅ Auth state saved to auth-state.json')
  console.log('🎉 You can now close this browser window')

  // Keep browser open for 5 seconds so user sees the message
  await page.waitForTimeout(5000)
})
