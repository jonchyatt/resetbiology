# WooCommerce Store - Quick Start Checklist

## ✅ What's Done
- [x] Docker containers running (WordPress + MySQL)
- [x] 32 products exported to `products.csv`
- [x] Stripe keys configured in `.env`
- [x] Setup documentation created

## 🎯 Your Next Steps (15 minutes)

### 1. Open WordPress (1 min)
```
http://localhost:8080
```
You should see WordPress installation screen.

### 2. Install WordPress (2 mins)
- Language: English
- Site Title: **Reset Biology Store**
- Username: **admin**
- Password: **ResetBiology2024!**
- Email: **jon@resetbiology.com**
- Click **Install WordPress**

### 3. Login (1 min)
- Go to: `http://localhost:8080/wp-admin`
- Username: `admin`
- Password: `ResetBiology2024!`

### 4. Install WooCommerce (3 mins)
1. **Plugins** → **Add New Plugin**
2. Search "**WooCommerce**"
3. **Install Now** → **Activate**
4. Setup wizard appears:
   - Store details: United States, CA
   - Industry: Health and beauty
   - **Skip** the rest (click "Skip setup store")

### 5. Install Stripe Plugin (2 mins)
1. **Plugins** → **Add New Plugin**
2. Search "**WooCommerce Stripe Gateway**"
3. **Install** → **Activate**

### 6. Configure Stripe (3 mins)
1. **WooCommerce** → **Settings** → **Payments**
2. Click **Stripe** → **Manage**
3. Settings:
   - ☑ **Enable Stripe**
   - ☑ **Enable test mode**
   - **Test Publishable Key:** (copy from `.env` file)
   - **Test Secret Key:** (copy from `.env` file)
4. **Save changes**

### 7. Import Products (3 mins)
1. **Products** → **All Products**
2. **Import** button (top of page)
3. Choose file: `C:\Users\jonch\reset-biology-website\woocommerce\products.csv`
4. **Continue** → **Run the importer**
5. Wait for "Import complete!" (32 products)

### 8. Test Checkout (3 mins)
1. Visit `http://localhost:8080`
2. Click any product
3. **Add to Cart** → **View Cart** → **Checkout**
4. Test card: **4242 4242 4242 4242**
5. Exp: **12/25**, CVC: **123**
6. **Place Order**
7. Should complete successfully ✅

## 🎨 Optional: Brand Styling (10 mins)

### Install Astra Theme
1. **Appearance** → **Themes** → **Add New Theme**
2. Search "**Astra**"
3. **Install** → **Activate**

### Apply Reset Biology Colors
1. **Appearance** → **Customize**
2. **Colors & Background**:
   - Theme Color: `#3FBFB5` (teal)
   - Link Color: `#72C247` (green)
3. **Publish**

### Add Logo
1. **Appearance** → **Customize** → **Site Identity**
2. Upload Reset Biology logo
3. **Publish**

## 🔍 Optional: SEO Setup (5 mins)

### Install Yoast SEO
1. **Plugins** → **Add New Plugin**
2. Search "**Yoast SEO**"
3. **Install** → **Activate**
4. Follow configuration wizard

### Optimize One Product (as example)
1. **Products** → **All Products**
2. Edit any product
3. Expand **Yoast SEO** section (bottom)
4. Set **Focus Keyword** (e.g., "BPC-157")
5. **Update** product

## 📊 View Your Store

- **Storefront:** http://localhost:8080
- **Admin:** http://localhost:8080/wp-admin
- **Products:** http://localhost:8080/shop
- **Orders:** Admin → WooCommerce → Orders

## 🚀 When Ready to Deploy

See full `README.md` for deployment options:
- Cloudways ($11/month)
- SiteGround ($14.99/month)
- Any WordPress host

## 🆘 Problems?

**Can't access localhost:8080?**
```bash
cd woocommerce
docker-compose ps  # Check if containers running
docker-compose restart  # Restart if needed
```

**Import failed?**
- Make sure WooCommerce is activated first
- Check CSV file exists in woocommerce folder

**Stripe not working?**
- Verify test mode is ON
- Double-check keys from `.env` file
- Use test card: 4242 4242 4242 4242

---

## ⏱️ Total Time: ~15-30 minutes

After this you'll have:
✅ Working WooCommerce store
✅ 32 products ready to sell
✅ Stripe payments configured (test mode)
✅ SEO-ready platform

For detailed docs, see `README.md`
