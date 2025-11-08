# ResetBiology.com - Comprehensive Audit Checklist

**Version:** 1.0
**Last Updated:** November 3, 2025
**Purpose:** Manual and automated audit checklist for comprehensive site evaluation

---

## How to Use This Checklist

- [ ] **Manual Audits:** Review items and check off as completed
- [ ] **Automated Audits:** Run `.hos/scripts/run-audit.js` for automated checks
- [ ] **Frequency:** Run full audit before major releases, partial audits weekly
- [ ] **Track Issues:** Create GitHub issues for items that need fixing

---

## 1. Functionality Testing

### Authentication & Authorization
- [ ] Google OAuth login works
- [ ] New user auto-creation on first login
- [ ] Existing user login retrieves correct data
- [ ] Logout clears session properly
- [ ] Protected routes redirect to login when not authenticated
- [ ] Admin routes blocked for non-admin users
- [ ] Session persists across page refreshes
- [ ] Session timeout works correctly (if configured)
- [ ] Auth0 callback handles errors gracefully

### Peptide Tracking
- [ ] Can create new peptide protocol
- [ ] Can edit existing protocol
- [ ] Can delete protocol (with confirmation)
- [ ] Can log dose from protocol
- [ ] Calendar view displays doses correctly
- [ ] Adherence tracking calculates correctly
- [ ] Push notifications for dose reminders work
- [ ] Email fallback for reminders works
- [ ] Protocol list loads on page refresh
- [ ] Timezone handling correct for dose times

### Nutrition Tracking
- [ ] Can search food database
- [ ] Can log meal with food items
- [ ] Can edit food entry
- [ ] Can delete food entry
- [ ] Macro calculations correct (protein, carbs, fats, calories)
- [ ] Daily totals display correctly
- [ ] Recent foods list works
- [ ] Quick add functionality works
- [ ] Custom food creation works
- [ ] Points awarded correctly (10 per day)

### Workout Tracking
- [ ] Can create workout session
- [ ] Can add exercises from library
- [ ] Can add custom exercise
- [ ] Can log sets, reps, weight
- [ ] Can complete workout session
- [ ] Points awarded correctly (50 per workout)
- [ ] Recent workouts display
- [ ] Exercise search works
- [ ] Bulk import exercises works

### Breath Training
- [ ] Can start breath session
- [ ] Timer works correctly
- [ ] Phase transitions work (inhale, hold, exhale)
- [ ] Can complete session
- [ ] Session saves to IndexedDB
- [ ] Can view session history
- [ ] Can export to Google Sheets (when implemented)
- [ ] Settings persist

### Mental Mastery Modules
- [ ] Module library displays
- [ ] Can play audio module
- [ ] Progress tracking works
- [ ] Completion marks correctly
- [ ] Points awarded for completion

### Daily Journal
- [ ] Can create journal entry
- [ ] Weight tracking works
- [ ] Mood tracking works
- [ ] Affirmations save correctly
- [ ] Activity notes auto-populate from completed tasks
- [ ] Can view journal history
- [ ] Can edit past entries
- [ ] Can delete entries

### Gamification
- [ ] Points awarded for activities
- [ ] Streak tracking works correctly
- [ ] Daily tasks update status
- [ ] Achievement tiers display correctly
- [ ] Point totals calculate correctly
- [ ] Streak breaks reset correctly

### E-commerce / Checkout
- [ ] Product listing displays
- [ ] Can add product to cart
- [ ] Stripe checkout session creates
- [ ] Payment processes correctly
- [ ] Order confirmation displays
- [ ] Inventory updates after purchase
- [ ] Webhook handles payment events
- [ ] Failed payments handled gracefully

### Admin Features
- [ ] Admin panel accessible to admin users only
- [ ] Can upload product images
- [ ] Can edit product details
- [ ] Can manage inventory
- [ ] Can view orders
- [ ] Can view users
- [ ] Stripe sync works

---

## 2. User Experience (UX)

### Navigation
- [ ] Header navigation links work
- [ ] Footer navigation links work
- [ ] Portal navigation intuitive
- [ ] Breadcrumbs display correctly (if present)
- [ ] Back button works as expected
- [ ] Deep links work correctly

### Forms
- [ ] All form inputs labeled clearly
- [ ] Validation messages helpful
- [ ] Error states clear
- [ ] Success states confirmed
- [ ] Required fields marked
- [ ] Placeholder text helpful
- [ ] Tab order logical
- [ ] Submit buttons disabled during submission

### Error Handling
- [ ] Error messages user-friendly
- [ ] No raw error objects displayed
- [ ] Network errors handled gracefully
- [ ] 404 page exists and helpful
- [ ] 500 error page exists
- [ ] Toast notifications work (if implemented)
- [ ] No alert() calls in production

### Loading States
- [ ] Loading spinners display during async operations
- [ ] Skeleton screens for content loading
- [ ] No flash of unstyled content (FOUC)
- [ ] Optimistic UI updates where appropriate
- [ ] No frozen UI during operations

### Visual Design
- [ ] Brand colors consistent throughout
- [ ] Typography hierarchy clear
- [ ] Spacing consistent
- [ ] Icons consistent style
- [ ] Dark theme applied correctly
- [ ] Images load properly
- [ ] Gradients and effects render correctly

---

## 3. Mobile Responsiveness

### Viewport Testing
- [ ] Test on iPhone SE (375x667)
- [ ] Test on iPhone 14 (390x844)
- [ ] Test on iPad (768x1024)
- [ ] Test on Android phone (360x800)
- [ ] Test on Android tablet (800x1280)

### Layout
- [ ] No horizontal scrolling
- [ ] Content fits viewport
- [ ] Text readable without zooming
- [ ] Images scale appropriately
- [ ] Modals fit on screen
- [ ] Forms usable on mobile
- [ ] Calendar view works on mobile

### Touch Targets
- [ ] All buttons ≥44x44px
- [ ] Links easy to tap
- [ ] Form inputs large enough
- [ ] Adequate spacing between interactive elements
- [ ] No accidental taps on adjacent elements

### Mobile-Specific Features
- [ ] PWA install prompt appears
- [ ] Service worker registers
- [ ] Push notifications work on mobile
- [ ] App works offline (if implemented)
- [ ] Pull-to-refresh doesn't conflict

### Orientation
- [ ] Portrait mode works
- [ ] Landscape mode works
- [ ] Orientation change handled gracefully

---

## 4. Performance

### Load Times
- [ ] Homepage loads <3s
- [ ] Portal loads <3s
- [ ] Product page loads <3s
- [ ] First Contentful Paint <2.5s
- [ ] Time to Interactive <5s

### Bundle Size
- [ ] Run bundle analyzer
- [ ] Total bundle <500KB
- [ ] No duplicate dependencies
- [ ] Tree shaking working
- [ ] Code splitting implemented

### Images
- [ ] Images optimized (WebP where possible)
- [ ] Images lazy loaded
- [ ] Images have width/height attributes
- [ ] No oversized images
- [ ] Alt text present

### API Performance
- [ ] API responses <500ms
- [ ] Database queries optimized
- [ ] Indexes added for common queries
- [ ] No N+1 query problems
- [ ] Caching implemented where appropriate

### Lighthouse Scores
- [ ] Performance score >90
- [ ] Accessibility score >90
- [ ] Best Practices score >90
- [ ] SEO score >90

---

## 5. Accessibility (WCAG 2.1 AA)

### Keyboard Navigation
- [ ] All interactive elements keyboard accessible
- [ ] Tab order logical
- [ ] Focus indicators visible
- [ ] No keyboard traps
- [ ] Skip links present
- [ ] Modal focus management works

### Screen Reader
- [ ] All images have alt text
- [ ] Buttons have accessible names
- [ ] Links have descriptive text
- [ ] Forms have labels
- [ ] ARIA labels present where needed
- [ ] ARIA roles used appropriately
- [ ] Live regions for dynamic content

### Color & Contrast
- [ ] Text contrast ratio ≥4.5:1
- [ ] Large text contrast ratio ≥3:1
- [ ] Color not sole means of conveying info
- [ ] Verify with WebAIM Contrast Checker

### Semantic HTML
- [ ] Heading hierarchy correct (h1, h2, h3)
- [ ] Landmarks used (<nav>, <main>, <footer>)
- [ ] Lists use <ul>, <ol>, <li>
- [ ] Tables use proper markup
- [ ] Forms use <label> elements

### Testing Tools
- [ ] Run axe DevTools scan
- [ ] Test with NVDA or JAWS screen reader
- [ ] Test keyboard-only navigation
- [ ] Test with Lighthouse accessibility audit

---

## 6. Security

### Authentication
- [ ] Sessions expire appropriately
- [ ] Passwords hashed (if local auth)
- [ ] OAuth tokens stored securely
- [ ] No client-side secrets
- [ ] HTTPS enforced

### API Security
- [ ] All protected routes check authentication
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention (sanitize user input)
- [ ] CSRF protection (Next.js defaults)

### Payment Security
- [ ] Stripe webhook signature verified
- [ ] No credit card data stored locally
- [ ] PCI compliance maintained
- [ ] Failed payment attempts logged

### Data Protection
- [ ] User data encrypted in transit (HTTPS)
- [ ] Sensitive data not logged
- [ ] Environment variables secured
- [ ] GDPR compliance (data export/deletion)
- [ ] Privacy policy present

### Testing
- [ ] Run OWASP ZAP scan
- [ ] Test for common vulnerabilities
- [ ] Audit third-party dependencies
- [ ] Check for exposed secrets in Git history

---

## 7. SEO

### Meta Tags
- [ ] Title tags present on all pages
- [ ] Meta descriptions present
- [ ] Meta descriptions unique per page
- [ ] Meta descriptions 150-160 characters
- [ ] Viewport meta tag present

### Open Graph
- [ ] og:title present
- [ ] og:description present
- [ ] og:image present (1200x630px)
- [ ] og:url present
- [ ] og:type present

### Twitter Cards
- [ ] twitter:card present
- [ ] twitter:title present
- [ ] twitter:description present
- [ ] twitter:image present

### Structured Data
- [ ] Organization schema present
- [ ] Product schema on product pages
- [ ] MedicalWebPage schema (if applicable)
- [ ] FAQPage schema (if applicable)
- [ ] Validate with Google Rich Results Test

### Technical SEO
- [ ] Sitemap.xml exists
- [ ] Sitemap submitted to Google Search Console
- [ ] robots.txt exists and correct
- [ ] Canonical URLs set
- [ ] No duplicate content
- [ ] Internal linking strategy
- [ ] External links open in new tab (if desired)

### Content SEO
- [ ] Heading hierarchy clear (h1, h2, h3)
- [ ] Keywords in headings
- [ ] Alt text on images
- [ ] Descriptive link text (no "click here")
- [ ] Content length adequate (>300 words)

---

## 8. Browser & Device Compatibility

### Browsers (Latest Versions)
- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Edge (desktop)
- [ ] Chrome (Android)
- [ ] Safari (iOS)

### Older Browser Support
- [ ] Test on Safari iOS 14 (if supporting older iOS)
- [ ] Test on Chrome Android 10 (if supporting older Android)
- [ ] Check caniuse.com for feature support

### Operating Systems
- [ ] Windows 10/11
- [ ] macOS (latest)
- [ ] iOS (latest 2 versions)
- [ ] Android (latest 2 versions)

---

## 9. Error Handling & Edge Cases

### Network Errors
- [ ] Offline handling (PWA)
- [ ] Slow connection handling
- [ ] API timeout handling
- [ ] Failed request retry logic

### Data Validation
- [ ] Empty form submissions blocked
- [ ] Invalid data formats rejected
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked
- [ ] Overly long inputs handled

### Edge Cases
- [ ] Empty states display correctly (no data)
- [ ] Very long text handled (truncation/overflow)
- [ ] Large numbers formatted correctly
- [ ] Date/time timezone handling
- [ ] Leap year handling
- [ ] Daylight saving time transitions

---

## 10. Content & Copy

### Spelling & Grammar
- [ ] Run spell check on all pages
- [ ] Grammar correct
- [ ] Tone consistent with brand voice

### Links
- [ ] All internal links work
- [ ] All external links work
- [ ] External links open in new tab (optional)
- [ ] No broken links

### Legal
- [ ] Privacy policy present
- [ ] Terms of service present
- [ ] Cookie policy present (if using cookies)
- [ ] GDPR compliance notice (for EU users)
- [ ] Contact information present

---

## 11. Analytics & Monitoring

### Analytics Setup
- [ ] Google Analytics installed (or alternative)
- [ ] Conversion goals configured
- [ ] Event tracking configured
- [ ] Funnel analysis set up

### Error Tracking
- [ ] Sentry (or alternative) installed
- [ ] Errors reported correctly
- [ ] Source maps uploaded
- [ ] Alerts configured

### Performance Monitoring
- [ ] Vercel Analytics enabled (or alternative)
- [ ] Core Web Vitals tracked
- [ ] API response times monitored
- [ ] Database performance monitored

### Uptime Monitoring
- [ ] Uptime monitoring service configured
- [ ] Alerts for downtime
- [ ] Status page (optional)

---

## 12. Deployment & Infrastructure

### Pre-Deployment
- [ ] Run tests locally
- [ ] Build passes without errors
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] No console.log statements (or minimal)

### Staging Environment
- [ ] Staging environment exists
- [ ] Deploy to staging first
- [ ] Test on staging
- [ ] Staging database separate from production

### Production Deployment
- [ ] Environment variables configured
- [ ] Database migrations run (if applicable)
- [ ] Backup taken before deployment
- [ ] Rollback plan ready
- [ ] Monitor deployment for errors

### Post-Deployment
- [ ] Smoke test critical paths
- [ ] Check error logs
- [ ] Verify analytics tracking
- [ ] Test on production domain

---

## 13. Database & Data Integrity

### Database Schema
- [ ] Indexes present on frequently queried fields
- [ ] Foreign key relationships correct
- [ ] Default values appropriate
- [ ] Required fields enforced
- [ ] Data types appropriate

### Data Backups
- [ ] Automated backups configured
- [ ] Backup restoration tested
- [ ] Backup frequency adequate
- [ ] Backup retention policy set

### Data Migration
- [ ] Migration scripts tested
- [ ] Rollback scripts prepared
- [ ] Data integrity verified post-migration

---

## 14. API Testing

### Endpoint Testing
- [ ] All endpoints return correct status codes
- [ ] All endpoints return correct data format
- [ ] Authentication required on protected endpoints
- [ ] Unauthenticated requests blocked
- [ ] Invalid requests return helpful errors

### Load Testing
- [ ] API handles expected load
- [ ] No timeout under normal load
- [ ] Graceful degradation under high load

---

## 15. Compliance & Legal

### GDPR (EU)
- [ ] Data export functionality
- [ ] Account deletion functionality
- [ ] Cookie consent (if using cookies)
- [ ] Privacy policy compliant
- [ ] Data processing agreement (if applicable)

### HIPAA (US Healthcare)
- [ ] Review if HIPAA applies
- [ ] Ensure proper data encryption
- [ ] Audit logging implemented
- [ ] Business associate agreements (if applicable)

### ADA (US Accessibility)
- [ ] WCAG 2.1 AA compliance
- [ ] Accessibility statement present

---

## Quick Pre-Release Checklist

Use this abbreviated checklist before every production deployment:

- [ ] All tests pass
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] Critical paths tested manually
- [ ] Mobile responsiveness checked
- [ ] New features tested on staging
- [ ] Database migrations run (if any)
- [ ] Environment variables correct
- [ ] Lighthouse scores acceptable
- [ ] No console.log statements
- [ ] Sentry error tracking working
- [ ] Analytics tracking working

---

## Automated Audit Script

Run the automated audit script:

```bash
# Start dev server
npm run dev

# In another terminal, run audit
node .hos/scripts/run-audit.js

# Or test production
node .hos/scripts/run-audit.js --prod
```

The script will generate:
- `.hos/reports/audit-results/audit-{timestamp}.json` (detailed results)
- `.hos/reports/audit-results/audit-summary-{timestamp}.md` (human-readable report)
- `.hos/reports/screenshots/` (visual regression screenshots)

---

## Issue Tracking

When items fail audit:

1. **Create GitHub Issue** with:
   - Title: Clear description of issue
   - Labels: `audit`, `bug` or `enhancement`, priority level
   - Description: Audit item that failed, expected vs. actual behavior
   - Screenshots: If visual issue
   - Steps to reproduce

2. **Prioritize** using priority matrix:
   - **Critical:** Blocks core functionality or security risk
   - **High:** Major UX issue or missing feature
   - **Medium:** Minor UX issue or optimization
   - **Low:** Nice-to-have improvement

3. **Assign & Track** in project board

---

**Checklist Version:** 1.0
**Next Review:** After major feature additions or quarterly
