# Reset Biology Brand Colors & Design Reference

## 🎨 Primary Brand Colors

```css
--rb-teal: #3FBFB5      /* Primary brand color */
--rb-green: #72C247     /* Secondary accent */
--rb-dark: #1a1a1a      /* Background */
```

## Color Usage Guide

### Where to Use Teal (#3FBFB5):
- Primary buttons
- Links and hover states
- Product prices
- Icons and badges
- Call-to-action elements
- Headings (as gradient with green)

### Where to Use Green (#72C247):
- Secondary buttons
- Success messages
- Accent elements
- Gradient endings
- Hover state transitions

### Where to Use Dark (#1a1a1a):
- Page background
- Card backgrounds (with transparency)
- Text containers

---

## 🌈 Gradient Combinations

### Primary Gradient (Most Used):
```css
background: linear-gradient(135deg, #3FBFB5 0%, #72C247 100%);
```
**Use for:** Buttons, headings, premium elements

### Glass Effect (Cards):
```css
background: linear-gradient(135deg, rgba(63, 191, 181, 0.1) 0%, rgba(114, 194, 71, 0.1) 100%);
backdrop-filter: blur(10px);
border: 1px solid rgba(63, 191, 181, 0.3);
```
**Use for:** Product cards, containers, modals

### Text Gradient:
```css
background: linear-gradient(135deg, #3FBFB5 0%, #72C247 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```
**Use for:** Headings, featured text, logos

---

## 📏 Spacing & Sizes

### Border Radius:
- Cards: `16px`
- Buttons: `8px`
- Inputs: `8px`
- Large containers: `24px`

### Shadows:
- Default: `0 8px 32px rgba(0, 0, 0, 0.3)`
- Hover: `0 12px 48px rgba(63, 191, 181, 0.4)`
- Buttons: `0 4px 16px rgba(63, 191, 181, 0.4)`

### Transitions:
- Standard: `all 0.3s ease`
- Hover effects: `all 0.3s ease`

---

## 🔤 Typography

### Font Stack:
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### Font Sizes:
- Body: `16px`
- Headings H1: `2.5rem` (40px)
- Headings H2: `2rem` (32px)
- Headings H3: `1.5rem` (24px)
- Product Price: `2rem` (32px)
- Buttons: `16px`

### Font Weights:
- Regular text: `400`
- Headings: `700` (Bold)
- Buttons: `600` (Semi-bold)

---

## 🎭 Design Principles

### Glass-Morphism:
- Use transparent backgrounds with backdrop blur
- Add subtle borders in brand colors
- Layer shadows for depth

### Gradients:
- Always use teal-to-green gradient (135deg angle)
- Apply to buttons, headings, and premium elements
- Use low opacity versions for backgrounds

### Hover Effects:
- Lift elements up (`translateY(-8px)`)
- Increase glow/shadow
- Add color transitions
- Keep animations smooth (0.3s)

### Consistency:
- Match main resetbiology.com portal
- Use same colors everywhere
- Maintain gradient direction (135deg)
- Keep spacing uniform

---

## 🖼️ Asset Guidelines

### Product Images:
- **Size:** 600x600px minimum
- **Format:** PNG or JPG
- **Background:** Transparent or white (will contrast with dark theme)
- **Quality:** High resolution

### Logo:
- **Size:** 200-250px width
- **Format:** PNG with transparency
- **Colors:** Should include brand teal/green

---

## 🎯 Quick Copy-Paste Values

**For WordPress Customizer:**

```
Theme Color: #3FBFB5
Link Color: #3FBFB5
Link Hover: #72C247
Text Color: #ffffff
Heading Color: #ffffff
Background: #1a1a1a
```

**For CSS:**

```css
/* Teal */
#3FBFB5

/* Green */
#72C247

/* Dark Background */
#1a1a1a

/* White Text */
#ffffff

/* Primary Gradient */
linear-gradient(135deg, #3FBFB5 0%, #72C247 100%)
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 768px)

/* Tablet */
@media (max-width: 1024px)

/* Desktop */
@media (min-width: 1025px)
```

---

## ✅ Brand Consistency Checklist

Before launching, verify:

- [ ] All buttons use teal-green gradient
- [ ] Product cards have glass-morphism effect
- [ ] Headings use gradient text
- [ ] Dark background everywhere (#1a1a1a)
- [ ] White text for readability
- [ ] Hover effects with teal glow
- [ ] Smooth 0.3s transitions
- [ ] Border radius 8-16px on elements
- [ ] Shadows with teal tint
- [ ] Mobile responsive (single column)
- [ ] Logo matches brand colors
- [ ] Forms have teal borders on focus
- [ ] Success messages use green
- [ ] Error messages contrast but stay on-brand

---

## 🌟 Inspiration Sources

Your main site already has this aesthetic:
- Dark gradient backgrounds
- Teal/green color scheme
- Glass-morphism cards
- Smooth animations
- Premium feel

WooCommerce store now matches perfectly!

---

**Last Updated:** October 5, 2025
**Brand:** Reset Biology
**Website:** resetbiology.com
