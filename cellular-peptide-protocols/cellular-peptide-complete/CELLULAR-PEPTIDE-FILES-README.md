# Cellular Peptide Website Scrape - Complete File Structure

**Date Created:** October 6, 2025
**Purpose:** Clone of Cellular Peptide protocol pages for client comparison
**Environment:** WSL2 → Windows Transfer Required

---

## 📁 COMPLETE FILE STRUCTURE

### 1. **Product Images** (13 main products)
**Location:** `/home/jonch/reset-biology-website/public/images/cellular-peptide-products/`

```
anxiety-depression.png         (381 KB)
body-recomposition.png         (356 KB)
bpc-tb500.png                  (424 KB)
growth-hormone.png             (454 KB)
hair-growth.png                (386 KB)
hormone-balancing.png          (348 KB)
natural-energy.png             (442 KB)
oral-bpc-157.png               (360 KB)
organ-health.png               (419 KB)
prostate-support.png           (385 KB)
semaglutide.png                (372 KB)
sexual-enhancement.png         (352 KB)
tanning-sexual.png             (364 KB)
```

### 2. **Certificate of Analysis Images** (14 certificates - 3rd Party Testing)
**Location:** `/home/jonch/reset-biology-website/public/images/cellular-peptide-products/`

**Coverage: 11 out of 13 protocols (85%)**

```
BPC157TB500_CofA.png           - Joint & Wound Healing (BPC-157 + TB-500)
CJC-1295_Ipamorelin_CofA.webp  - Growth Hormone (CJC-1295 + Ipamorelin)
DSIP_CofA.png                  - Natural Energy (DSIP)
Epitalon_CofA.webp             - Organ Health (Epitalon)
Kisspeptin_CofA.webp           - Hormone Balancing & Organ Health
Melanotan_II_CofA.webp         - Tanning & Sexual (MT-2)
NAD_CofA.png                   - Natural Energy (NAD+)
Oral_BPC-157_CofA.png          - Oral BPC-157
PT141_CofA.webp                - Sexual Enhancement (PT-141)
Retatrutide_CofA.png           - Body Recomposition (Retatrutide - Page 1)
Retatrutide_CofA_2.png         - Body Recomposition (Retatrutide - Page 2)
Selank_CofA.png                - Anxiety & Depression (Selank)
Semaglutide_CofA.webp          - Blood Sugar Support (Semaglutide)
Semax_CofA.jpg                 - Anxiety & Depression (Semax)
```

**Protocols Without Certificates:**
- Hair Growth & Skin Health (GHK-Cu) - Not available
- Prostate Support (Prostamax) - Not available

### 3. **Protocol Data (JSON)**
**Location:** `/home/jonch/reset-biology-website/cellular-peptide-protocols/complete-data/`

```
anxiety-depression.json
blood-sugar-support.json
body-recomposition.json
growth-hormone.json
hair-growth.json
hormone-balancing.json
joint-wound-healing.json
natural-energy.json
oral-bpc-157.json
organ-health.json
prostate-support.json
sexual-enhancement.json
tanning-sexual.json
```

### 4. **Protocol Information (Markdown)**
**Location:** `/home/jonch/reset-biology-website/cellular-peptide-protocols/`

```
01-anxiety-depression.md
02-blood-sugar-support-craving-reduction.md
03-body-recomposition-metabolic-health.md
04-growth-hormone-anti-aging.md
05-hair-growth-skin-health.md
06-hormone-balancing.md
07-joint-wound-healing.md
08-natural-energy-reset.md
09-oral-bpc-157.md
10-organ-health-anti-aging.md
11-prostate-support.md
12-sexual-enhancement.md
13-tanning-sexual-benefits.md
README.md
```

### 5. **Screenshots**
**Location:** `/home/jonch/reset-biology-website/cellular-peptide-protocols/screenshots/`

```
anxiety-depression-full-page.png
collection-page-screenshot.png
```

### 6. **Scraped HTML Pages**
**Location:** `/home/jonch/reset-biology-website/cellular-peptide-protocols/scraped-html/`

```
All 13 protocol HTML files
```

---

## 📊 PROTOCOL DETAILS

### Complete List of 13 Protocols:

1. **Anxiety & Depression** - $550 (12 weeks) - Selank + Semax
2. **Blood Sugar Support** - $720 (16 weeks) - Semaglutide
3. **Body Recomposition** - $980 (16 weeks) - Retatrutide
4. **Growth Hormone** - $1,300 (12 weeks) - CJC-1295 + Ipamorelin
5. **Hair Growth & Skin** - $340 (8 weeks) - GHK-Cu
6. **Hormone Balancing** - $360 (8 weeks) - Kisspeptin
7. **Joint & Wound Healing** - $1,050 (12 weeks) - BPC-157 + TB-500
8. **Natural Energy Reset** - $650 (8 weeks) - DSIP + NAD+
9. **Oral BPC-157** - $150 (4 weeks) - BPC-157
10. **Organ Health** - $360 (8 weeks) - Epitalon + Kisspeptin
11. **Prostate Support** - $790 (8 weeks) - Prostamax
12. **Sexual Enhancement** - $420 (8 weeks) - PT-141
13. **Tanning & Sexual** - $340 (8 weeks) - MT-2

---

## 🚚 WINDOWS TRANSFER INSTRUCTIONS

### What to Copy to Windows:

```bash
# From WSL2 to Windows
# (Replace YOUR_WINDOWS_USERNAME with actual username)

# 1. Images
cp -r /home/jonch/reset-biology-website/public/images/cellular-peptide-products \
  /mnt/c/Users/YOUR_WINDOWS_USERNAME/reset-biology-website/public/images/

# 2. Protocol Data
cp -r /home/jonch/reset-biology-website/cellular-peptide-protocols \
  /mnt/c/Users/YOUR_WINDOWS_USERNAME/reset-biology-website/

# 3. Source Data
cp /home/jonch/reset-biology-website/src/data/cellular-peptide-products.json \
  /mnt/c/Users/YOUR_WINDOWS_USERNAME/reset-biology-website/src/data/
```

### Or use this one-liner:

```bash
rsync -av --progress \
  /home/jonch/reset-biology-website/public/images/cellular-peptide-products \
  /home/jonch/reset-biology-website/cellular-peptide-protocols \
  /home/jonch/reset-biology-website/src/data/cellular-peptide-products.json \
  /mnt/c/Users/YOUR_WINDOWS_USERNAME/reset-biology-website/
```

---

## 📋 DATA STRUCTURE EXAMPLE

Each protocol JSON contains:
- `id` - unique identifier
- `title` - full protocol name
- `price` - retail price
- `duration` - protocol length
- `productUrl` - Cellular Peptide product page
- `infoUrl` - Cellular Peptide information page
- `images.product` - main product image path
- `images.certificates[]` - Certificate of Analysis images
- `videoLinks[]` - YouTube instructional videos
- `packageIncludes[]` - what's in the box
- `instructions{}` - dosing, reconstitution, timing
- `description` - how it works
- `bestResults[]` - tips for optimal results

---

## 🎯 NEXT STEPS FOR INTEGRATION

1. **Copy all files to Windows environment**
2. **Build protocol comparison page** using this data
3. **Display product images** from `/public/images/cellular-peptide-products/`
4. **Show certificates** for credibility (3rd party testing)
5. **Embed video links** for client education
6. **Create selection form** (no checkout - just selection)
7. **Backend process** - Send selected protocols to you → You handle IRB forms with Cellular Peptide

---

## ⚠️ IMPORTANT NOTES

- **NO functioning store** - Information display only
- **Client workflow:** Browse → Select → You handle IRB enrollment → Cellular Peptide fulfills
- **All images downloaded** - No external dependencies
- **Certificate images** prove 3rd party testing (credibility)
- **Video links** still point to YouTube (external)
- **Layout should match** Cellular Peptide's professional design

---

## 📞 SUPPORT

If you need to re-scrape or update data, use:
- Chrome DevTools MCP (you're logged in)
- Product pages: `https://cellularpeptide.com/products/{protocol-id}-package`
- Info pages: `https://cellularpeptide.com/pages/{protocol-name}-protocol`

---

**Generated by Claude Code in WSL2**
**Ready for Windows Transfer** ✅
