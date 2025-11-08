# ResetBiology.com - Pain Points & Improvement Opportunities

## Critical Issues

### 1. Google Drive Integration (Incomplete)
**Status:** Stub functions only
**Files:** `src/lib/google-drive.ts`
**Evidence:**
```typescript
export async function createClientFolder(clientEmail: string): Promise<string> {
  console.log(`TODO: Create Google Drive folder for ${clientEmail}`)
  return 'placeholder-folder-id'
}
```

**Impact:** HIGH
- Users cannot auto-sync data to personal Drive folders
- No automated backup for user data
- Missing promised feature from original design

**Priority:** HIGH
**Solution Path:**
1. Complete OAuth2 flow for Google Drive API
2. Implement folder creation on user signup
3. Build sync mechanism for breath sessions, protocols, journal entries
4. Add user preferences for auto-sync toggle
**Estimated Effort:** 8-12 hours

---

### 2. Trial/Upgrade Flow (Incomplete)
**Status:** Basic structure, missing core logic
**Files:** `app/api/user/trial/route.ts`, Stripe integration
**Evidence from CLAUDE.md:** "Trial Flows" listed as incomplete priority

**Impact:** MEDIUM-HIGH
- Cannot convert free users to paid subscriptions
- No trial expiration handling
- Revenue generation blocked

**Priority:** HIGH
**Solution Path:**
1. Implement trial period tracking in User model
2. Build Stripe subscription creation flow
3. Add payment plan selection UI
4. Create trial expiration warnings
5. Implement feature gating based on subscription status
**Estimated Effort:** 12-16 hours

---

### 3. Test Coverage (Minimal)
**Status:** Playwright installed, tests are stubs
**Files:** `.hos/tests/playwright/*.spec.ts`
**Evidence:** All test files contain only `// TODO: Implement` comments

**Impact:** HIGH
- No confidence in deployments
- Bugs only caught in production
- Regression risk with every change
- Manual testing burden

**Priority:** HIGH
**Solution Path:**
1. Implement critical path tests (login, peptide logging, dose tracking)
2. Add checkout flow tests
3. Mobile responsiveness tests
4. API endpoint tests
5. Visual regression tests
**Estimated Effort:** 20-30 hours for comprehensive coverage

---

### 4. IRB Handoff Integration (Stub)
**Status:** TODO placeholder
**Files:** `app/api/irb-handoff/route.ts`
**Evidence:**
```typescript
// TODO: Implement actual cellularpeptide.com API integration
// TODO: Verify webhook signature from cellularpeptide.com
```

**Impact:** MEDIUM-HIGH
- Assessment data not sent to IRB partner
- Manual handoff required
- Delays in retatrutide approval

**Priority:** MEDIUM-HIGH
**Solution Path:**
1. Obtain API credentials from cellularpeptide.com
2. Implement API integration for assessment submission
3. Add webhook verification
4. Build status tracking for approvals
**Estimated Effort:** 6-10 hours

## Performance Issues

### Mobile Performance
**Issue:** No performance monitoring, potential mobile slowdowns
**Evidence:**
- Large JavaScript bundle (Next.js defaults)
- No lazy loading strategy
- Framer Motion animations could impact low-end devices
- Complex PeptideTracker component (1000+ lines)

**Impact:** MEDIUM
**Affected Users:** Mobile users (likely 40-60% of traffic)
**Solution:**
1. Implement bundle analysis
2. Lazy load heavy components (BreathTrainingApp, PeptideTracker)
3. Optimize images (convert to WebP, add size hints)
4. Add performance monitoring (Vercel Analytics)
**Estimated Effort:** 8-12 hours

---

### API Response Times
**Issue:** No caching layer for API calls
**Evidence:**
- Multiple useEffect fetches in components
- No React Query or SWR
- Database queries on every request

**Impact:** MEDIUM
**Solution:**
1. Implement React Query for client-side caching
2. Add Redis for server-side caching (future)
3. Optimize Prisma queries (add indexes)
4. Implement stale-while-revalidate pattern
**Estimated Effort:** 12-16 hours

---

### Database Query Optimization
**Issue:** No indexes defined, potential N+1 queries
**Evidence from schema.prisma:**
```prisma
@@index([reminderTime, sent])  // Only 3 indexes in entire schema
@@index([userId, loggedAt], map: "foodlog_user_loggedAt")
@@index([productId, createdAt])
```

**Impact:** MEDIUM (will become HIGH at scale)
**Solution:**
1. Add indexes for common query patterns:
   - User lookups by auth0Sub and email
   - Date-based queries (localDate fields)
   - Protocol and dose relationships
2. Analyze slow queries with MongoDB profiler
3. Add composite indexes for multi-field queries
**Estimated Effort:** 4-6 hours

## UX/Design Issues

### Mobile Responsiveness Gaps
**Issue:** Untested mobile layouts
**Evidence:** Mobile test suite is empty stubs
**Potential Problems:**
- Touch target sizes may be too small
- Forms may have awkward mobile input
- Modals may not fit on small screens
- Calendar view in PeptideTracker complex for mobile

**Impact:** MEDIUM
**Solution:**
1. Implement comprehensive mobile tests
2. Audit all modals and forms on actual devices
3. Ensure 44x44px minimum touch targets
4. Test on iOS Safari, Chrome Android
5. Fix identified issues
**Estimated Effort:** 8-12 hours

---

### Accessibility Issues
**Issue:** Limited accessibility audit performed
**Evidence:**
- No aria-labels on many interactive elements
- Modal focus management unclear
- Keyboard navigation not tested
- Color contrast mostly good but not verified

**Impact:** MEDIUM
- WCAG 2.1 AA compliance uncertain
- Screen reader experience untested
- Keyboard-only navigation may be broken

**Solution:**
1. Run axe DevTools audit
2. Add aria-labels to all buttons/links
3. Implement focus trapping in modals
4. Test keyboard navigation
5. Verify color contrast ratios
**Estimated Effort:** 6-10 hours

---

### Error Handling & User Feedback
**Issue:** Inconsistent error messaging
**Evidence:**
- Many error handlers use `alert()` (poor UX)
- No toast notification system
- Loading states inconsistent
- Network errors not gracefully handled

**Impact:** MEDIUM
**Solution:**
1. Implement toast notification system (e.g., sonner, react-hot-toast)
2. Replace all `alert()` calls with toasts
3. Add consistent loading states
4. Improve error messages (user-friendly, actionable)
5. Add retry logic for failed requests
**Estimated Effort:** 8-12 hours

---

### Onboarding Flow
**Issue:** No guided onboarding for new users
**Evidence:** Users land in portal with no instructions
**Impact:** MEDIUM
**Solution:**
1. Create welcome modal on first login
2. Add tooltips for key features
3. Build interactive tour (e.g., Intro.js)
4. Add progress checklist for setup
**Estimated Effort:** 12-16 hours

## Code Quality Issues

### Console.log Pollution
**Issue:** 282 console statements across 56 files
**Evidence from grep:** `Found 282 total occurrences across 56 files`
**Files with most:**
- `src/components/Peptides/PeptideTracker.tsx` (25)
- `src/scripts/*.ts` (various)
- `src/components/Portal/EnhancedDashboard.tsx` (9)

**Impact:** LOW-MEDIUM
- Production logs cluttered
- Sensitive data potentially logged
- Debugging harder to track

**Solution:**
1. Remove all console.log from production code
2. Replace with proper logger (e.g., pino)
3. Add environment check for debug logs
4. Use Vercel logging for production
**Estimated Effort:** 2-4 hours

---

### Code Duplication
**Issue:** Duplicate API routes and components
**Evidence:**
- `/src/legacy_app/` contains old versions
- `/app/api/workouts/` vs `/app/api/workout/`
- Duplicate form handling logic across components

**Impact:** MEDIUM
**Solution:**
1. Remove legacy_app directory
2. Consolidate duplicate routes
3. Extract shared form logic to hooks
4. Create shared validation utilities
**Estimated Effort:** 6-10 hours

---

### Type Safety Gaps
**Issue:** Some `any` types, missing interfaces
**Evidence from lint results:**
```typescript
Unexpected any. Specify a different type. (line 22, column 19)
```

**Impact:** LOW-MEDIUM
**Solution:**
1. Enable `noImplicitAny` in tsconfig
2. Replace all `any` with proper types
3. Add interfaces for API responses
4. Use Zod for runtime validation
**Estimated Effort:** 4-8 hours

---

### Error Boundaries Missing
**Issue:** No React error boundaries
**Evidence:** No ErrorBoundary components found
**Impact:** MEDIUM
- Errors crash entire app
- No graceful degradation
- Poor user experience on errors

**Solution:**
1. Add global ErrorBoundary in layout
2. Add feature-specific boundaries
3. Implement error logging to Sentry
4. Create fallback UI components
**Estimated Effort:** 4-6 hours

## Integration Gaps

### Google Drive (Detailed)
**Current State:**
- OAuth initialization helper exists
- Google Sheets export for breath sessions implemented
- Folder creation, file storage, sync all stubbed

**Missing:**
1. Complete OAuth2 flow
2. Token refresh handling
3. Folder creation on signup
4. File upload for journals, protocols
5. Sync status UI
6. Conflict resolution

**Priority:** HIGH
**Estimated Effort:** 12-16 hours

---

### Affiliate System (Basic Only)
**Current State:** Basic tracking exists
**Missing:**
1. Commission calculation engine
2. Payout request system
3. Affiliate dashboard
4. Referral link generator with UTM params
5. Conversion attribution
6. Payout automation via Stripe Connect

**Priority:** MEDIUM
**Estimated Effort:** 16-24 hours

---

### Analytics & Monitoring
**Current State:** None configured
**Missing:**
1. Error tracking (Sentry)
2. Analytics (PostHog/Plausible)
3. Performance monitoring (Vercel Analytics)
4. User behavior tracking
5. Conversion funnels
6. Health checks/uptime monitoring

**Priority:** MEDIUM-HIGH
**Estimated Effort:** 8-12 hours

## Security Considerations

### Rate Limiting
**Issue:** No rate limiting on API endpoints
**Evidence:** No rate limiting middleware found
**Impact:** HIGH
- Vulnerable to abuse
- DoS attacks possible
- API cost risk

**Solution:**
1. Implement rate limiting middleware (e.g., upstash-ratelimit)
2. Apply to all public endpoints
3. Add stricter limits on auth endpoints
4. Return 429 with Retry-After header
**Estimated Effort:** 4-6 hours

---

### Input Validation
**Issue:** Limited input sanitization
**Evidence:** Reliance on Prisma for validation only
**Impact:** MEDIUM
- SQL injection unlikely (Prisma protects)
- XSS possible in free-text fields
- Business logic validation weak

**Solution:**
1. Implement Zod schemas for all API inputs
2. Sanitize HTML in rich text fields
3. Validate business rules (dosage ranges, etc.)
4. Add CSRF tokens to forms
**Estimated Effort:** 8-12 hours

---

### Secrets Management
**Issue:** Environment variables in .env files
**Evidence:** Secrets stored in .env.local (not in repo, but risky)
**Impact:** MEDIUM
**Solution:**
1. Use Vercel Environment Variables (already doing)
2. Implement secret rotation schedule
3. Audit access to production secrets
4. Consider Vault or AWS Secrets Manager
**Estimated Effort:** 4-6 hours

## Deployment Issues

### No Staging Environment
**Issue:** Direct to production deploys
**Evidence from CLAUDE.md:** Only production and local environments mentioned
**Impact:** MEDIUM
**Solution:**
1. Create staging branch/deployment on Vercel
2. Add staging DATABASE_URL (separate DB or namespace)
3. Test changes on staging before production
4. Implement promotion workflow
**Estimated Effort:** 2-4 hours

---

### Build Time
**Issue:** No build optimization tracking
**Evidence:** Build cache disabled in production
**Impact:** LOW-MEDIUM
**Solution:**
1. Enable build cache for dependencies
2. Implement build time monitoring
3. Optimize bundle size
4. Use SWC instead of Babel (already using)
**Estimated Effort:** 2-4 hours

---

### Rollback Strategy
**Issue:** No documented rollback process
**Evidence:** No rollback scripts or docs
**Impact:** MEDIUM
**Solution:**
1. Document Vercel rollback process
2. Keep last 5 production builds
3. Add database migration rollback scripts
4. Test rollback procedure
**Estimated Effort:** 2-4 hours

## Data Management

### Backup Strategy
**Issue:** No automated backups documented
**Evidence:** MongoDB Atlas has backups, but not verified
**Impact:** HIGH (if backups fail)
**Solution:**
1. Verify MongoDB Atlas backup settings
2. Test restoration process
3. Implement application-level exports
4. Store backups in S3 or similar
**Estimated Effort:** 4-6 hours

---

### Data Migration Tools
**Issue:** No migration scripts for Prisma
**Evidence:** `prisma db push` instead of migrations
**Impact:** MEDIUM
**Solution:**
1. Switch to `prisma migrate` workflow
2. Create migration scripts for schema changes
3. Test migrations on staging
4. Document migration process
**Estimated Effort:** 4-6 hours

---

### GDPR Compliance
**Issue:** Data export/deletion not implemented
**Evidence:** No GDPR endpoints found
**Impact:** HIGH (legal requirement)
**Solution:**
1. Implement user data export (JSON download)
2. Implement account deletion (cascade deletes)
3. Add privacy policy acceptance tracking
4. Create data retention policies
**Estimated Effort:** 8-12 hours

## Priority Matrix

| Issue | Impact | Effort | Priority | Quick Win? |
|-------|--------|--------|----------|-----------|
| **Test Coverage** | HIGH | HIGH | **CRITICAL** | No |
| **Google Drive Integration** | HIGH | MEDIUM | **CRITICAL** | No |
| **Trial/Upgrade Flows** | HIGH | HIGH | **CRITICAL** | No |
| **Rate Limiting** | HIGH | LOW | **HIGH** | Yes |
| **GDPR Compliance** | HIGH | MEDIUM | **HIGH** | No |
| **IRB Handoff** | MEDIUM-HIGH | MEDIUM | **HIGH** | No |
| **Console.log Cleanup** | LOW-MEDIUM | LOW | **MEDIUM** | Yes |
| **Error Boundaries** | MEDIUM | LOW | **MEDIUM** | Yes |
| **Mobile Performance** | MEDIUM | MEDIUM | **MEDIUM** | No |
| **Accessibility Audit** | MEDIUM | MEDIUM | **MEDIUM** | No |
| **Analytics Setup** | MEDIUM-HIGH | MEDIUM | **MEDIUM** | No |
| **Code Duplication** | MEDIUM | MEDIUM | **MEDIUM** | No |
| **Affiliate System** | MEDIUM | HIGH | **LOW** | No |
| **Staging Environment** | MEDIUM | LOW | **MEDIUM** | Yes |

## Opportunities for Enhancement

### Feature Enhancements
1. **Advanced Peptide Analytics:** Track effectiveness, side effects, correlate with other data
2. **Nutrition AI:** Meal photo recognition, macro calculation from images
3. **Workout Program Builder:** Pre-built programs, progressive overload tracking
4. **Community Features:** Forums, group challenges, peer support
5. **Integration Ecosystem:** Apple Health, Google Fit, Fitbit, Oura Ring
6. **Telehealth:** Video consultations with providers
7. **Prescription Management:** Track all medications, not just peptides

### Performance Optimizations
1. **Image Optimization:** Convert to WebP, implement lazy loading
2. **Bundle Size Reduction:** Code splitting, tree shaking, dynamic imports
3. **API Response Caching:** Redis layer for frequently accessed data
4. **Database Indexing:** Comprehensive index strategy
5. **CDN for Assets:** Cloudflare or similar for static assets
6. **Service Worker Caching:** Offline support for core features

### UX Improvements
1. **Dark/Light Mode Toggle:** User preference (currently dark only)
2. **Customizable Dashboard:** Drag-and-drop widgets
3. **Bulk Operations:** Import/export in batch, multi-edit
4. **Keyboard Shortcuts:** Power user features
5. **Smart Notifications:** AI-driven reminders based on patterns
6. **Voice Input:** Log doses, meals via voice
7. **Progressive Disclosure:** Simplify complex forms with steps

### SEO Improvements
1. **Meta Tags:** Comprehensive SEO meta tags on all pages
2. **Schema.org Markup:** Health/medical schema for rich snippets
3. **Sitemap:** Dynamic sitemap generation
4. **Blog/Content:** SEO-optimized educational content
5. **Open Graph:** Social sharing previews
6. **Performance Scores:** Lighthouse optimization (currently unknown)

## Next Steps (Recommended Priority)

### Phase 1: Critical Stability (2-3 weeks)
1. Implement comprehensive test coverage (Playwright suite)
2. Add rate limiting to all API endpoints
3. Clean up console.log statements
4. Add React error boundaries
5. Implement GDPR data export/deletion

### Phase 2: Revenue Enablement (2-3 weeks)
1. Complete trial/upgrade flow
2. IRB handoff integration
3. Affiliate system enhancement
4. Analytics and monitoring setup

### Phase 3: User Experience (3-4 weeks)
1. Complete Google Drive integration
2. Mobile performance audit and fixes
3. Accessibility compliance
4. Onboarding flow
5. Error handling improvements

### Phase 4: Scale & Polish (3-4 weeks)
1. Database optimization and indexing
2. API caching layer
3. Staging environment setup
4. Backup and disaster recovery verification
5. Performance monitoring and optimization

## Long-Term Technical Debt

1. **Legacy Code Removal:** Delete `/src/legacy_app/` entirely
2. **State Management:** Consider Zustand or Jotai for global state
3. **Data Fetching:** Migrate to React Query for better caching
4. **Form Handling:** Standardize with React Hook Form + Zod
5. **Component Library:** Build design system with Storybook
6. **Monorepo:** Consider splitting into apps (admin, portal, marketing)
7. **Backend Separation:** Consider separate API server (FastAPI/Go)

## Continuous Improvement

Based on CLAUDE.md philosophy:
- **Observer Agent:** Continuous monitoring and issue detection
- **Four-Step Protocol:** Always understand → investigate → propose → implement
- **Minimal Changes:** One-line fixes preferred, never overcomplicate
- **User Feedback:** Regular usability testing and feedback loops
- **Metric-Driven:** Track performance, errors, conversions continuously
