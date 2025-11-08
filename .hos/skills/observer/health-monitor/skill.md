---
name: health-monitor
description: Monitors system health, performance metrics, and application status
version: 1.0.0
triggers:
  - check system health
  - monitor application status
  - check performance metrics
  - verify system is healthy
  - run health checks
---

# Health Monitor Skill

## Purpose
Monitors ResetBiology.com system health including database connectivity, API availability, performance metrics, and error rates.

## When to Use
- Before deployments
- After deployments
- Daily health checks
- During incidents
- Performance reviews

## Health Check Categories

### 1. Database Health
Check MongoDB Atlas connectivity and performance.

```typescript
// Health check endpoint
GET /api/health/db

Expected Response:
{
  status: 'healthy',
  latency: '45ms',
  userCount: 1234,
  timestamp: '2025-11-04T10:00:00Z'
}

Thresholds:
  - Latency < 100ms: ✅ Healthy
  - Latency 100-500ms: ⚠️ Warning
  - Latency > 500ms: ❌ Critical
```

### 2. API Endpoint Health
Verify all critical endpoints are responding.

```yaml
Critical_Endpoints:
  - /api/peptides
  - /api/peptides/protocols
  - /api/peptides/doses
  - /api/workout/sessions
  - /api/nutrition/entries
  - /api/gamification/points
  - /api/auth/callback

For Each Endpoint:
  - Check: Response status 200
  - Check: Response time < 1000ms
  - Check: Response format valid
  - Check: No server errors
```

### 3. Authentication Health
Verify Auth0 integration is working.

```yaml
Auth0_Checks:
  - Login flow completes
  - Session validation works
  - Token refresh succeeds
  - Logout functions
  - Callback handler responds

Success Criteria:
  - All checks pass: ✅
  - One check fails: ⚠️ Investigate
  - Multiple fail: ❌ Critical
```

### 4. Performance Metrics

#### Core Web Vitals
```yaml
Page_Performance:
  - LCP (Largest Contentful Paint): < 2.5s ✅
  - FID (First Input Delay): < 100ms ✅
  - CLS (Cumulative Layout Shift): < 0.1 ✅

API_Performance:
  - P50 Response Time: < 200ms
  - P95 Response Time: < 500ms
  - P99 Response Time: < 1000ms

Database_Performance:
  - Query Time: < 50ms average
  - Connection Pool: < 80% usage
```

#### Bundle Size
```yaml
Bundle_Metrics:
  - Total JS: < 500KB (gzipped) ✅
  - Initial Load: < 200KB ✅
  - CSS: < 50KB ✅
  - Images: Lazy loaded ✅

Check:
  - Run: npm run build --analyze
  - Verify size limits
  - Check for bloat
```

#### Build Metrics
```yaml
Build_Performance:
  - Build Time: < 60s ✅
  - Type Check: < 10s ✅
  - Test Execution: < 5min ✅

Deployment:
  - Vercel Deploy: < 2min
  - Function Cold Start: < 1s
```

### 5. Error Rate Monitoring

```yaml
Error_Thresholds:
  - Error Rate < 0.1%: ✅ Healthy
  - Error Rate 0.1-1%: ⚠️ Warning
  - Error Rate > 1%: ❌ Critical

Track By:
  - API endpoint
  - Error type
  - Time of day
  - User segment

Common Errors:
  - 401 Unauthorized
  - 404 Not Found
  - 500 Internal Server Error
  - Database timeouts
  - Network failures
```

### 6. Feature Availability

```yaml
Critical_Features:
  - Peptide Tracking: Must be available
  - Workout Logging: Must be available
  - Nutrition Tracking: Must be available
  - Authentication: Must be available
  - Portal Dashboard: Must be available

Nice_To_Have:
  - Breath Training: Can degrade
  - Journal: Can degrade
  - Mental Mastery: Can degrade

Check Method:
  - E2E smoke tests
  - Feature flag status
  - Dependency availability
```

## Health Check Implementation

### Database Health Check
```typescript
// /app/api/health/db/route.ts
export async function GET() {
  try {
    const start = Date.now()
    await prisma.$connect()
    const latency = Date.now() - start

    const userCount = await prisma.user.count()

    return NextResponse.json({
      status: latency < 100 ? 'healthy' : latency < 500 ? 'warning' : 'critical',
      latency: `${latency}ms`,
      userCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 503 })
  }
}
```

### API Endpoints Health Check
```typescript
// /app/api/health/endpoints/route.ts
export async function GET() {
  const endpoints = [
    '/api/peptides',
    '/api/workout/sessions',
    '/api/nutrition/entries',
    '/api/gamification/points'
  ]

  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      const start = Date.now()
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${endpoint}`)
        return {
          endpoint,
          status: res.status,
          latency: Date.now() - start,
          healthy: res.ok
        }
      } catch (error) {
        return {
          endpoint,
          status: 'error',
          latency: Date.now() - start,
          healthy: false,
          error: error.message
        }
      }
    })
  )

  const allHealthy = results.every(r => r.healthy)
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    endpoints: results,
    averageLatency: `${avgLatency.toFixed(0)}ms`,
    timestamp: new Date().toISOString()
  })
}
```

### Playwright Health Check
```typescript
// tests/health/smoke.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Health Checks', () => {
  test('critical features are available', async ({ page }) => {
    // Check homepage loads
    await page.goto('https://resetbiology.com')
    await expect(page.locator('text=Reset Biology')).toBeVisible()

    // Check portal is accessible (after login)
    await page.goto('https://resetbiology.com/portal')
    // Should redirect to login or show portal

    // Check peptide page loads
    await page.goto('https://resetbiology.com/peptides')
    await expect(page.locator('text=Peptide')).toBeVisible()

    // Check performance
    const performance = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0]
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
      }
    })

    expect(performance.loadTime).toBeLessThan(3000)
  })
})
```

## Monitoring Dashboard

### Real-Time Metrics
```yaml
Display:
  - System Status: 🟢 Healthy | 🟡 Warning | 🔴 Critical
  - Database: Latency, Connection count
  - API: Response times, Error rates
  - Users: Active sessions, Recent signups
  - Performance: LCP, FID, CLS

Update Frequency: Every 60 seconds

Alerts:
  - Critical: Immediate notification
  - Warning: Every 5 minutes
  - Info: Daily summary
```

### Historical Trends
```yaml
Track Over Time:
  - Response time trends
  - Error rate trends
  - User growth
  - Feature adoption
  - Performance scores

Retention: 90 days
Reports: Weekly summaries
```

## Alert Thresholds

### Critical Alerts (Immediate)
```yaml
Triggers:
  - Database connection lost
  - API response time > 5s
  - Error rate > 5%
  - Auth0 authentication failing
  - Payment processing down

Action: Page on-call engineer
```

### Warning Alerts (5 min delay)
```yaml
Triggers:
  - Database latency > 500ms
  - API response time > 1s
  - Error rate > 1%
  - Build time > 90s
  - Bundle size increase > 10%

Action: Create ticket
```

### Info Alerts (Daily summary)
```yaml
Triggers:
  - New user signups
  - Feature usage stats
  - Performance trends
  - Error summaries
  - System changes

Action: Send email report
```

## Health Check Commands

### Manual Checks
```bash
# Check database
curl https://resetbiology.com/api/health/db

# Check API endpoints
curl https://resetbiology.com/api/health/endpoints

# Check build
npm run build

# Check tests
npm test

# Check performance
npx lighthouse https://resetbiology.com --only-categories=performance
```

### Automated Checks
```bash
# Run health checks
npm run health-check

# Output example:
✅ Database: Healthy (45ms)
✅ API Endpoints: Healthy (avg 234ms)
✅ Build: Success (42s)
✅ Tests: Passing (3m 21s)
⚠️ Bundle Size: 487KB (warning threshold: 450KB)
```

## Success Criteria
- All critical systems healthy
- Response times within thresholds
- Error rate < 0.1%
- Performance metrics green
- No degraded features
- Automated monitoring active

## Output Format

```yaml
Health Check Report
Date: 2025-11-04 10:00:00

Overall Status: 🟢 Healthy

Components:
  Database:
    Status: ✅ Healthy
    Latency: 45ms
    Connections: 12/100

  API Endpoints:
    Status: ✅ Healthy
    Average Latency: 234ms
    Error Rate: 0.02%

  Authentication:
    Status: ✅ Healthy
    Active Sessions: 156

  Performance:
    LCP: 1.8s ✅
    FID: 45ms ✅
    CLS: 0.05 ✅

  Build:
    Status: ✅ Success
    Time: 42s
    Bundle: 487KB ⚠️

Alerts: None

Recommendations:
  - Monitor bundle size trend
  - Consider code splitting
```
