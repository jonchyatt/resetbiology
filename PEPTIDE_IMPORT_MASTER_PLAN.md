# PEPTIDE IMPORT MASTER PLAN - SAVED SESSION STATE

## 🎯 OBJECTIVE
Import all peptides from cellularpeptide.com with 50% retail markup into MongoDB, then sync to Stripe for sales.

## ✅ COMPLETED WORK
1. **Cookie Extraction**: Successfully extracted 13 cookies from Chrome browser
   - Cookies saved to: `/tmp/cellularpeptide_cookies.json`
   - Verified authentication worked initially
   
2. **Scripts Created**:
   - `get-chrome-cookies.js` - Extracts cookies from Chrome ✅
   - `scrape-peptides.js` - Main scraping script (v1)
   - `scrape-peptides-v2.js` - Improved scraping with debugging
   - `navigate-to-products.js` - Navigation helper

3. **Database Understanding**: 
   - Using existing Product/Price models (no schema changes needed)
   - Products stored in MongoDB as source of truth
   - Stripe sync happens on-demand or JIT

## 🔴 CURRENT ISSUE
- Running in headless WSL2 environment without display
- Cookies not maintaining session properly
- Need manual browser access to complete scraping

## 📋 DATA TO CAPTURE PER PEPTIDE
```javascript
{
  slug: 'bpc-157-10mg',  // Generated from name
  name: 'BPC-157 (10mg)',
  description: [from site],
  imageUrl: [from site],
  originalPrice: [partner price],
  retailPrice: [partner price * 1.5],
  vialSize: '10mg',
  metadata: {
    category: 'peptide',
    protocolInstructions: {
      reconstitution: '2ml bacteriostatic water',
      dosage: '250mcg twice daily',
      timing: 'morning and evening',
      protocolLength: '4-6 weeks'
    },
    educationalContent: [Learn More content]
  },
  storefront: true,
  active: true
}
```

## 🏗️ STRIPE INTEGRATION ARCHITECTURE

### Your Confirmed Stripe Setup:
1. **Products live in MongoDB/Prisma** (source of truth)
2. **One-click Publish/Sync to Stripe** (or JIT on first purchase)
3. **/order page uses MongoDB data**; Checkout Session created with Stripe
4. **Webhook writes paid orders back to MongoDB**
5. **Admin Store page** to list/sync products
6. **Auth0 and other routes remain untouched**

### Database Models (Already Created):
```prisma
model Product {
  id               String    @id @default(auto()) @map("_id") @db.ObjectId
  slug             String    @unique
  name             String
  description      String?
  imageUrl         String?
  active           Boolean   @default(true)
  storefront       Boolean   @default(false)
  stripeProductId  String?
  metadata         Json?     // <-- Peptide-specific data goes here
  prices           Price[]
}

model Price {
  productId      String    @db.ObjectId
  unitAmount     Int       // in cents
  currency       String    @default("usd")
  interval       String?   // "month" for subscriptions
  stripePriceId  String?
}
```

## 📝 PEPTIDE SEED SCRIPT FORMAT
```javascript
// scripts/seed-peptides.js
const items = [
  {
    slug: 'bpc-157-10mg',
    name: 'BPC-157 (10mg)',
    description: 'Body Protection Compound...',
    imageUrl: 'https://...',
    storefront: true,
    active: true,
    metadata: {
      vialSize: '10mg',
      category: 'peptide',
      originalPrice: 100,
      retailPrice: 150,
      protocolInstructions: {...},
      educationalContent: '...'
    },
    prices: [
      { 
        unitAmount: 15000, // $150 in cents
        currency: 'usd',
        interval: null // one-time
      },
      { 
        unitAmount: 12750, // $127.50 (15% off subscription)
        currency: 'usd',
        interval: 'month'
      }
    ]
  }
]
```

## 🚀 NEXT STEPS FOR NEW SESSION

### Option 1: Manual Data Collection
1. Open cellularpeptide.com in regular Chrome
2. Copy product data manually into JSON format
3. Run seed script to import to MongoDB

### Option 2: Automated Scraping (Requires Display)
1. Run on a machine with display (not headless WSL2)
2. Use saved cookies or login fresh
3. Run scraping script to collect all data
4. Import to MongoDB

### Option 3: API Integration
1. Contact cellularpeptide.com for API access
2. Fetch products programmatically
3. Transform and import to MongoDB

## 📦 URLs TO SCRAPE
- https://cellularpeptide.com/collections/all (3 pages)
- https://cellularpeptide.com/collections/single-vials (2 pages)

## 🔧 IMPORT WORKFLOW
1. **Collect Data** → JSON file
2. **Review & Clean** → Verify pricing/formatting
3. **Run Seed Script** → Import to MongoDB
4. **Admin Review** → Check in /admin/store
5. **Sync to Stripe** → Click "Sync" buttons
6. **Test Purchase** → Verify checkout flow

## 💾 FILES CREATED THIS SESSION
- `/tmp/cellularpeptide_cookies.json` - Saved authentication cookies
- `get-chrome-cookies.js` - Cookie extraction script
- `scrape-peptides.js` - Main scraping logic
- `scrape-peptides-v2.js` - Enhanced version
- `navigate-to-products.js` - Navigation helper

## 📊 MASTER TODO STATUS

### ✅ Phase 1: Stripe Integration Foundation
- Product/Price models created
- Admin sync endpoint ready
- Checkout with JIT publish
- Webhook for order capture

### 🟡 Phase 2: Peptide Import (IN PROGRESS)
- [x] Extract cookies from Chrome
- [x] Create scraping scripts
- [ ] Collect peptide data (blocked by display issue)
- [ ] Create seed script
- [ ] Import to MongoDB
- [ ] Test in admin panel

### 🔴 Phase 3: Portal & Features (PENDING)
- Portal daily check-in system
- Journal integration
- Peptide tracker improvements
- Gamification system

## 🎯 REMEMBER FOR NEXT SESSION
1. We have cookies saved but need display for browser
2. Stripe architecture is ready and waiting for products
3. 50% markup on all peptides (retail = wholesale * 1.5)
4. Protocol instructions are critical for tracker
5. Educational content for each peptide
6. Both one-time and subscription pricing

## 💡 ALTERNATIVE APPROACH
Since browser automation isn't working in headless environment:
1. Open Chrome manually
2. Navigate to each peptide
3. Use browser console to extract data:
```javascript
// Run this in browser console on product page:
{
  name: document.querySelector('h1').textContent,
  price: document.querySelector('.price').textContent,
  description: document.querySelector('.description').textContent,
  // etc...
}
```
4. Compile into JSON
5. Run seed script

---
SAVED: 2025-09-17
This plan preserves all work and can be continued in a new session.