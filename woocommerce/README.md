# Reset Biology WooCommerce Store Setup

## 🎯 Purpose
This is your **SEO-focused marketing storefront** that runs alongside your main Next.js portal at resetbiology.com. It's designed to:
- Rank in Google for peptide-related searches
- Capture organic traffic
- Convert visitors to customers
- Use the same Stripe account as your main site

## 📋 What's Already Done
✅ Docker containers running (WordPress + MySQL + WP-CLI)
✅ 32 products exported to `products.csv`
✅ Stripe keys ready in `.env`
✅ Product categories defined

## 🚀 Quick Start - Manual Setup (15 minutes)

### Step 1: Access WordPress Installation
1. Open browser: http://localhost:8080
2. You should see the WordPress installation screen
3. Select language: **English (United States)**
4. Click **Continue**

### Step 2: WordPress Setup
Fill in the form:
- **Site Title:** Reset Biology Store
- **Username:** admin
- **Password:** ResetBiology2024!
- **Your Email:** jon@resetbiology.com
- **Search Engine Visibility:** ☐ Uncheck (we want Google to find us)
- Click **Install WordPress**

### Step 3: Login
- Go to: http://localhost:8080/wp-admin
- Username: `admin`
- Password: `ResetBiology2024!`

### Step 4: Install WooCommerce
1. In WordPress Admin, go to **Plugins** → **Add New Plugin**
2. Search for "**WooCommerce**"
3. Click **Install Now** → **Activate**
4. WooCommerce Setup Wizard will appear:
   - **Store Details:**
     - Country: United States
     - Address: 123 Wellness Blvd, Health City, CA
     - Click **Continue**
   - **Industry:** Select "Health and beauty"
   - **Product types:** Select "Physical products"
   - **Business details:** Skip this step (click "Skip this step" at bottom)
   - **Theme:** Skip (we'll install Astra manually)
   - Click **Skip setup store** to finish wizard

### Step 5: Install Required Plugins
1. Go to **Plugins** → **Add New Plugin**
2. Install and activate these:
   - **WooCommerce Stripe Gateway** (for payments)
   - **Astra** (theme - go to Appearance → Themes → Add New)
   - **Yoast SEO** (for search optimization)

### Step 6: Configure Stripe Payments
1. Go to **WooCommerce** → **Settings** → **Payments** tab
2. Find **Stripe** and click **Manage**
3. Configure:
   - ☑ Enable Stripe
   - **Test Mode:** ☑ Enable test mode
   - **Test Publishable Key:** (copy from `.env` file in woocommerce folder)
   - **Test Secret Key:** (copy from `.env` file in woocommerce folder)
   - Click **Save changes**

### Step 7: Set SEO-Friendly URLs
1. Go to **Settings** → **Permalinks**
2. Select **Post name** (makes URLs like /product-name instead of ?p=123)
3. Click **Save Changes**

### Step 8: Import Products
1. Go to **Products** → **All Products**
2. Click **Import** button at the top
3. Click **Choose File** and select: `C:\Users\jonch\reset-biology-website\woocommerce\products.csv`
4. Click **Continue**
5. Map columns (should auto-detect):
   - Make sure "Name" maps to "Name"
   - "Regular price" maps to "Regular price"
   - "Images" maps to "Images"
6. Click **Run the importer**
7. Wait for import to complete (should import 32 products)

### Step 9: Create Product Categories
1. Go to **Products** → **Categories**
2. Create these categories:
   - **Protocol Packages** (slug: protocol-packages)
   - **Single Peptides** (slug: single-peptides)
   - **Fat Loss** (slug: fat-loss)
   - **Healing & Recovery** (slug: healing-recovery)
   - **Longevity** (slug: longevity)
   - **Performance** (slug: performance)

### Step 10: Assign Products to Categories
1. Go to **Products** → **All Products**
2. For each product, click **Quick Edit**
3. Check the appropriate category
4. Click **Update**

## 🎨 Brand Styling (After Basic Setup)

### Apply Reset Biology Colors
1. Go to **Appearance** → **Customize**
2. In Customizer:
   - **Colors:**
     - Primary Color: `#3FBFB5` (Teal)
     - Accent Color: `#72C247` (Green)
   - **Typography:**
     - Font: System fonts or similar to resetbiology.com
   - **Header:**
     - Upload logo: Use same logo as main site
   - **Footer:**
     - Add Reset Biology branding

### Customize Product Pages
1. Go to **WooCommerce** → **Settings** → **Products**
2. Set shop page layout
3. Configure product gallery (enable zoom, lightbox)

## 🔍 SEO Setup

### Configure Yoast SEO
1. Go to **SEO** → **General**
2. Run Configuration Wizard
3. Set up:
   - Site name: Reset Biology Store
   - Tagline: Premium Peptides for Health & Wellness
   - Organization/Person: Reset Biology

### Optimize Product Descriptions
For each product, go to **Products** → Edit:
1. Write detailed SEO description (300-500 words)
2. Add benefits, usage, protocols
3. Include keywords like "BPC-157", "peptides for healing", etc.
4. Scroll to Yoast SEO section:
   - Set Focus Keyword
   - Optimize meta description
   - Check readability score

## 📊 Testing Checkout Flow

1. Visit: http://localhost:8080
2. Browse to a product
3. Click **Add to Cart**
4. Go to **Cart** → **Proceed to Checkout**
5. Fill in test details:
   - Name: Test User
   - Email: test@example.com
   - Address: 123 Test St
6. Payment:
   - Use Stripe test card: `4242 4242 4242 4242`
   - Exp: Any future date (12/25)
   - CVC: 123
7. Click **Place Order**
8. Should redirect to Stripe checkout (test mode)
9. Complete payment
10. Should see order confirmation

## 🚀 Deployment (When Ready)

### Option 1: Cloudways (Recommended - $11/month)
1. Sign up at cloudways.com
2. Create new server:
   - App: WordPress + WooCommerce
   - Server: DigitalOcean Basic ($11/mo)
3. Export local database:
   ```bash
   docker exec resetbiology_woo_db mysqldump -u wordpress -pwordpress wordpress > backup.sql
   ```
4. Copy `wp-content` folder to Cloudways
5. Import database
6. Update Stripe webhook URLs in Stripe dashboard

### Option 2: SiteGround ($14.99/month)
1. Sign up for StartUp plan
2. Choose "Start New Website" → WordPress
3. Install WooCommerce
4. Use **All-in-One WP Migration** plugin to export/import
5. Update DNS: `shop.resetbiology.com` → SiteGround IP

### Option 3: Export and Deploy Anywhere
```bash
# Export everything
cd woocommerce
docker exec resetbiology_woo_db mysqldump -u wordpress -pwordpress wordpress > database.sql
cp -r wp-content wp-content-backup

# Zip it up
zip -r woocommerce-export.zip database.sql wp-content-backup/

# Upload to any WordPress host
```

## 🔗 DNS Setup (After Deployment)

1. In your DNS provider (likely Vercel or Cloudflare):
2. Add CNAME record:
   - Name: `shop` or `store`
   - Value: your hosting provider's domain
3. Wait for propagation (5-60 mins)
4. Update WordPress URLs:
   - Go to **Settings** → **General**
   - Change URLs from localhost to `https://shop.resetbiology.com`

## 📈 Next Steps: Content Marketing

### Blog Setup
1. Create these pages:
   - "Benefits of BPC-157 for Healing"
   - "Complete Guide to Peptide Protocols"
   - "Fat Loss Peptides: What Works?"
2. Internal link to product pages
3. Optimize each for SEO

### Product Page Optimization
1. Write detailed descriptions (500+ words)
2. Add customer reviews (use WooCommerce reviews)
3. Add FAQ sections
4. Link related products

## 🆘 Troubleshooting

**Can't access localhost:8080?**
```bash
docker ps  # Check containers are running
cd woocommerce
docker-compose restart
```

**Database connection errors?**
Wait 30 seconds - MySQL takes time to initialize

**Products won't import?**
- Check CSV file exists: `woocommerce/products.csv`
- Verify WooCommerce is activated
- Try importing in smaller batches

**Stripe not working?**
- Verify test keys are correct in WooCommerce → Settings → Payments → Stripe
- Make sure "Test Mode" is enabled
- Use test card: 4242 4242 4242 4242

## 📝 Docker Commands

```bash
# Start containers
cd woocommerce
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f wordpress

# Restart everything
docker-compose restart

# Remove everything (DESTRUCTIVE)
docker-compose down -v

# Backup database
docker exec resetbiology_woo_db mysqldump -u wordpress -pwordpress wordpress > backup.sql

# Restore database
cat backup.sql | docker exec -i resetbiology_woo_db mysql -u wordpress -pwordpress wordpress
```

## 🎯 Success Metrics

Track these in WooCommerce → Reports:
- **Orders:** Daily sales
- **Traffic:** Google Analytics integration
- **SEO Rankings:** Use Google Search Console
- **Conversion Rate:** Visitors → Orders

## 💡 Pro Tips

1. **Content is King:** Write detailed blog posts that rank
2. **Product Descriptions:** 500+ words with keywords
3. **Images:** Use high-quality peptide product images
4. **Reviews:** Encourage customers to leave reviews (boosts SEO)
5. **Speed:** Use caching plugin (WP Super Cache)
6. **Security:** Install Wordfence or Sucuri

## 🔐 Login Credentials

**Local Development:**
- URL: http://localhost:8080/wp-admin
- Username: `admin`
- Password: `ResetBiology2024!`

**Database:**
- Host: localhost:3306 (from host machine use port mapping)
- Database: `wordpress`
- Username: `wordpress`
- Password: `wordpress`

---

## Questions?

This setup gives you:
✅ SEO-optimized product pages
✅ Blog platform for content marketing
✅ Same Stripe account as main site
✅ Independent from Next.js portal
✅ WordPress ecosystem (plugins, themes)

Need help? Check the main site's CLAUDE.md for context.
