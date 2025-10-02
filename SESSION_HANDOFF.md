# 🔄 SESSION HANDOFF DOCUMENT - READY FOR NEW SESSION

## ⚠️ CRITICAL ISSUE TO RESOLVE
**WSL2 Display Problem**: Browser launches say "success" but no window appears. This needs to be fixed first.

## 📋 IMMEDIATE TASK
**Import peptides from cellularpeptide.com** → MongoDB → Stripe

## ✅ WHAT'S READY
1. **Stripe Architecture** - Complete and waiting
2. **Database Models** - Product/Price tables ready
3. **Admin Panel** - /admin/store ready to manage products
4. **Cookies Saved** - 13 cookies at `/tmp/cellularpeptide_cookies.json`
5. **All Scripts Created** - Just need working display

## 🔧 FIX DISPLAY FIRST
Before starting new session, ensure:
1. X Server running on Windows (VcXsrv or similar)
2. `export DISPLAY=:0` in WSL2
3. Test with: `xclock` or `xeyes`
4. If those work, Playwright should work

## 📁 KEY FILES TO USE
```bash
# Main plan with all details
cat PEPTIDE_IMPORT_MASTER_PLAN.md

# Updated TODO list
cat CLAUDE_MASTER_TODO_UPDATED.md

# Test if browser works
DISPLAY=:0 node test-browser.js

# Scrape with cookies (once display works)
DISPLAY=:0 node scrape-with-cookies-working.js
```

## 🚀 QUICK START FOR NEW SESSION
```bash
# 1. Test display
export DISPLAY=:0
xclock  # Should show clock window

# 2. Test browser
node test-browser.js

# 3. If working, run scraper
node scrape-with-cookies-working.js

# 4. If not working, go manual:
# - Open Chrome manually
# - Login to cellularpeptide.com  
# - Use browser console to extract data
# - Save to JSON
# - Run seed script
```

## 🎯 MANUAL EXTRACTION FALLBACK
If browser automation won't work, use this in Chrome console on each product page:

```javascript
// Run on product page to extract data
const data = {
  name: document.querySelector('h1')?.textContent?.trim(),
  price: parseFloat(document.querySelector('.price')?.textContent?.match(/\d+\.?\d*/)?.[0] || 0),
  description: document.querySelector('.description')?.textContent?.trim(),
  image: document.querySelector('img')?.src,
  // Add 50% markup
  retailPrice: null
};
data.retailPrice = Math.round(data.price * 1.5 * 100) / 100;
console.log(JSON.stringify(data, null, 2));
```

## 📊 DATA FORMAT NEEDED
```javascript
{
  slug: 'bpc-157-10mg',
  name: 'BPC-157 (10mg)',
  description: '...',
  imageUrl: '...',
  storefront: true,
  active: true,
  metadata: {
    originalPrice: 100,
    retailPrice: 150,  // 50% markup
    vialSize: '10mg',
    category: 'peptide',
    protocolInstructions: {...},
    educationalContent: '...'
  },
  prices: [
    { unitAmount: 15000, currency: 'usd', interval: null }
  ]
}
```

## 🔴 REMEMBER
1. **50% markup on all prices**
2. **Protocol instructions are critical**
3. **Both one-time and subscription prices**
4. **Test with one peptide first**
5. **Admin panel at /admin/store to sync to Stripe**

## 💾 SESSION STATE SAVED
- All work preserved in this directory
- Cookies saved (may need refresh)
- Scripts ready to run
- Just need working display or manual approach

---
**Prepared:** 2025-09-17 02:19 UTC
**Issue:** WSL2 display not showing browser windows
**Solution:** Fix X server or use manual extraction