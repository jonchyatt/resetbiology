import { test } from '@playwright/test'
import * as fs from 'fs'

// Use saved auth if it exists
if (fs.existsSync('auth-state.json')) {
  test.use({ storageState: 'auth-state.json' })
}

test('Open persistent browser (stays open indefinitely)', async ({ page }) => {
  test.setTimeout(0) // NO TIMEOUT - stays open forever!

  console.log('\n🌐 Opening Chromium browser at resetbiology.com/peptides')
  console.log('📋 Using saved auth state from auth-state.json')
  console.log('⏸️  Browser will stay open until you press Ctrl+C')
  console.log('🔍 Look for "Chromium" in your taskbar\n')

  // Enable console logging
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('timing=') || text.includes('Protocol saved') || text.includes('Loading protocol')) {
      console.log('🖥️  Browser:', text)
    }
  })

  // Navigate to peptides page (with saved auth)
  await page.goto('https://resetbiology.com/peptides', { waitUntil: 'networkidle' })

  console.log('\n✅ Browser is open at resetbiology.com/peptides')
  console.log('✅ You should see a Chromium window on your screen')
  console.log('📋 The browser is logged in with your saved auth')
  console.log('\n💡 Now you can:')
  console.log('   - Watch the browser window')
  console.log('   - Ask me to interact with it')
  console.log('   - I will use sub-agents to click/test things')
  console.log('\n⏸️  Browser staying open... (press Ctrl+C in terminal to close)\n')

  // Wait indefinitely (~11 days)
  await page.waitForTimeout(999999999)
})
