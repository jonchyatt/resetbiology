# Reset Biology WooCommerce Styling Guide

## 🎨 Quick Setup (10 Minutes)

This guide will transform your WooCommerce store with the Reset Biology brand aesthetic:
- Teal (#3FBFB5) & Green (#72C247) gradient colors
- Modern glass-morphism effects
- Dark theme with premium feel
- Animated product cards
- Matching your main resetbiology.com site

---

## Step 1: Install Astra Theme (2 mins)

1. Go to WordPress Admin: http://localhost:8080/wp-admin
2. **Appearance** → **Themes** → **Add New Theme**
3. Search for: **"Astra"**
4. Click **Install** → **Activate**

---

## Step 2: Apply Custom CSS (3 mins)

### Option A: Using Customizer (Recommended)

1. Go to **Appearance** → **Customize**
2. Click **Additional CSS** (at the bottom of the left sidebar)
3. Open this file on your computer:
   ```
   C:\Users\jonch\reset-biology-website\woocommerce\reset-biology-custom.css
   ```
4. Copy ALL the CSS code
5. Paste it into the **Additional CSS** box
6. Click **Publish** (top button)

### Option B: Using Theme Editor

1. Go to **Appearance** → **Theme File Editor**
2. Select **Astra Child** (or Astra if no child theme)
3. Find `style.css` in the right sidebar
4. Paste the custom CSS at the bottom
5. Click **Update File**

---

## Step 3: Configure Astra Theme Settings (5 mins)

### Global Colors

1. In Customizer, go to **Global** → **Colors**
2. Set these colors:

**Theme Color (Primary):**
```
#3FBFB5
```

**Link Color:**
```
#3FBFB5
```

**Link Hover Color:**
```
#72C247
```

**Text Color:**
```
#ffffff
```

**Heading Color (H1-H6):**
```
#ffffff
```

**Background Color:**
```
#1a1a1a
```

### Header Settings

1. Go to **Header Builder** (in Customizer)
2. **Primary Header** settings:
   - Background: Transparent or `rgba(31, 41, 55, 0.8)`
   - Text Color: `#ffffff`
   - Link Color: `#ffffff`
   - Link Hover Color: `#3FBFB5`

### Logo (Optional)

1. In Customizer → **Header Builder** → **Site Identity**
2. Upload your Reset Biology logo
3. Set width to 200-250px

### Typography

1. **Global** → **Typography**
2. **Base Typography:**
   - Font Family: System fonts or "Inter" (clean, modern)
   - Font Size: 16px
   - Line Height: 1.8

3. **Headings:**
   - Font Weight: 700 (Bold)
   - Text Transform: None

### Layout

1. **Global** → **Container**
2. **Container Width:** 1200px
3. **Container Layout:** Full Width / Stretched

---

## Step 4: WooCommerce Specific Settings

### Shop Page

1. **Customizer** → **WooCommerce** → **Product Catalog**
2. **Products per row:** 3
3. **Rows per page:** 4 (shows 12 products)

### Product Images

1. **WooCommerce** → **Settings** → **Products** tab
2. **Product Images:**
   - Catalog Images: 300 x 300px
   - Single Product Image: 600 x 600px
   - Product Thumbnails: 100 x 100px

---

## Step 5: Verify the Look

### Check These Pages:

1. **Shop:** http://localhost:8080/shop
   - Should show product grid with gradient cards
   - Hover effects with teal glow
   - Prices in large teal gradient text

2. **Single Product:** Click any product
   - Dark background with glass effect
   - Gradient "Add to Cart" button
   - Clean, modern layout

3. **Cart:** Add item and view cart
   - Dark table with teal accents
   - Gradient totals box
   - Styled checkout button

4. **Checkout:** Proceed to checkout
   - Dark form fields with teal borders
   - Glass-morphism effects
   - Clean, premium feel

---

## 🎨 What You'll See:

### Before:
- Plain white background
- Default blue buttons
- Basic product cards
- Generic WordPress look

### After:
- **Dark gradient background** (matches main site)
- **Teal & Green gradients** everywhere
- **Glass-morphism cards** with blur effects
- **Animated hover effects** (cards lift and glow)
- **Premium typography** with gradient headings
- **Smooth transitions** on all interactions
- **Custom scrollbar** with brand colors
- **Responsive design** (works on mobile)

---

## 🚀 Advanced Customization (Optional)

### Add Custom Hero Section

Add this to the top of your shop page:

1. **Pages** → **Shop** → **Edit with Elementor** (or Gutenberg)
2. Add a hero section with:
   - Large heading: "Premium Peptides for Health & Wellness"
   - Subheading: "Reset your biology with science-backed solutions"
   - Background: Gradient or your hero image

### Custom Product Categories

1. **Products** → **Categories**
2. Add these categories (matching your main site):
   - Fat Loss (Description: "Peptides for body composition")
   - Healing & Recovery (Description: "Accelerate tissue repair")
   - Longevity (Description: "Anti-aging protocols")
   - Performance (Description: "Athletic enhancement")

3. Assign products to categories
4. Categories will show with gradient styling

### Add Trust Badges

Add these to product pages for credibility:
- "Lab Tested & Certified"
- "Free Shipping on Orders $100+"
- "30-Day Money Back Guarantee"
- "Same Day Shipping"

---

## 📱 Mobile Optimization

The CSS is already mobile-responsive! It will:
- Stack products in single column on mobile
- Adjust font sizes
- Maintain gradient effects
- Keep all animations smooth

Test on mobile:
1. Press F12 in browser
2. Click mobile device icon
3. Select iPhone or Android
4. Navigate shop - should look great!

---

## 🔧 Troubleshooting

### CSS Not Applying?

1. **Clear cache:**
   - Install "WP Super Cache" plugin
   - **Settings** → **WP Super Cache** → **Delete Cache**

2. **Hard refresh browser:**
   - Windows: Ctrl + Shift + R
   - Mac: Cmd + Shift + R

3. **Check CSS was pasted correctly:**
   - Go back to **Appearance** → **Customize** → **Additional CSS**
   - Should see 500+ lines of CSS

### Colors Look Wrong?

Make sure you set:
- Theme Color: `#3FBFB5` (with # symbol!)
- Background: `#1a1a1a`
- Text: `#ffffff`

### Products Not Showing?

1. **Products** → **All Products**
2. Check products are **Published** (not Draft)
3. Check **Stock Status:** In Stock

---

## 🎯 Result: Professional Brand Consistency

Your WooCommerce store will now match your main resetbiology.com portal:
- ✅ Same color palette
- ✅ Same modern aesthetic
- ✅ Same premium feel
- ✅ Same gradient effects
- ✅ Unified brand experience

Customers moving between sites will see consistent branding!

---

## 📸 Screenshot Checklist

After styling, take screenshots of:
1. Shop page with product grid
2. Single product page
3. Cart page
4. Checkout page

Compare to main site - should look like same brand!

---

## 💡 Pro Tips

1. **Use high-quality product images** - they'll pop with the dark background
2. **Write detailed descriptions** - white text on dark is easy to read
3. **Add product categories** - they'll have beautiful gradient styling
4. **Enable product reviews** - social proof with brand styling
5. **Add related products** - cross-sell with same card design

---

## ⏱️ Total Time: 10-15 minutes

That's it! Your WooCommerce store now has brilliant Reset Biology branding that matches your main site perfectly.

**Next:** Deploy to production and watch your SEO-optimized store start ranking!
