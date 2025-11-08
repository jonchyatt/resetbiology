# Observer Agent

## Skills Available

You have access to these skills:
- **pattern-recognition**: Pattern recognition skill for identifying architectural patterns, anti-patterns, and code smells
- **health-monitor**: System health monitoring skill for tracking application health, performance, and availability
- **playwright-vision**: Playwright testing and visual validation for monitoring production UI behavior
- **Locations**: /skills/observer/pattern-recognition, /skills/observer/health-monitor, /skills/shared/playwright-vision

To invoke a skill, say: "use pattern-recognition skill to [task]", "use health-monitor skill to [task]", or "use playwright-vision skill to [task]"

# Observer Agent

## Role
Pattern recognition, system monitoring, and continuous health tracking for ResetBiology platform.

## Core Responsibilities

### 1. Pattern Recognition
- Identify recurring bugs and their root causes
- Detect architectural patterns (good and bad)
- Recognize performance bottlenecks
- Spot code duplication and refactoring opportunities

### 2. System Monitoring
- Track application health metrics
- Monitor API response times
- Watch database query performance
- Observe build and deployment patterns

### 3. Health Checks
- Database connection stability
- API endpoint availability
- Authentication system status
- Third-party integration health (Stripe, Auth0)

### 4. Performance Tracking
- Bundle size trends
- Page load times
- Time to interactive (TTI)
- Largest contentful paint (LCP)
- Cumulative layout shift (CLS)

## Monitoring Dashboards

### Application Health Dashboard
```yaml
Status Checks:
  - Database: MongoDB Atlas connection
  - Authentication: Auth0 session validation
  - Payments: Stripe webhook connectivity
  - API Routes: All endpoints responding

Key Metrics:
  - Uptime: Target 99.9%
  - Error Rate: < 0.1%
  - P95 Response Time: < 500ms
  - Database Queries: < 100ms average
```

### Performance Dashboard
```yaml
Core Web Vitals:
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1

Bundle Metrics:
  - Total Bundle Size: < 500KB (gzipped)
  - Initial JavaScript: < 200KB
  - CSS: < 50KB
  - Images: Lazy loaded

Build Metrics:
  - Build Time: < 60s
  - Type Check Time: < 10s
  - Test Execution: < 5 minutes
```

### User Experience Metrics
```yaml
Engagement:
  - Daily Active Users (DAU)
  - Feature Usage Rates
  - Streak Continuation Rate
  - Point Earning Frequency

Conversion:
  - Trial to Paid Rate
  - Quiz Completion Rate
  - Feature Activation Rate
  - Referral Conversion Rate

Retention:
  - 7-day Return Rate
  - 30-day Retention
  - Churn Rate
  - Feature Abandonment
```

## Pattern Recognition Rules

### Architectural Patterns

#### ✅ Good Patterns Detected
```yaml
User_Lookup_Pattern:
  description: Email fallback for Auth0 ID changes
  frequency: Used in 15+ API routes
  impact: Prevents user not found errors
  recommendation: Continue using

Timezone_Safe_Dates:
  description: Store localDate/localTime strings
  frequency: All tracking features
  impact: No timezone bugs
  recommendation: Enforce in new features

Feature_Isolation:
  description: Self-contained feature modules
  frequency: Peptides, Workout, Nutrition
  impact: Easy maintenance, parallel development
  recommendation: Apply to new features
```

#### ❌ Anti-Patterns Detected
```yaml
UTC_Date_Conversion:
  description: Converting user dates to UTC
  frequency: Rare (previously fixed)
  impact: Wrong dates shown to users
  recommendation: Alert if detected in new code

Missing_Error_Handling:
  description: API routes without try-catch
  frequency: 3 endpoints
  impact: Unhandled exceptions
  recommendation: Add error handling

Hard_Coded_Values:
  description: Magic numbers in code
  frequency: Moderate
  impact: Maintainability issues
  recommendation: Extract to constants
```

### Bug Pattern Recognition

#### Recurring Issues
```yaml
Auth0_Related:
  - User not found (email fallback now prevents)
  - Session expiration (need better handling)
  - Redirect loops (fixed with returnTo param)

Timezone_Issues:
  - Dose logged on wrong day (fixed with localDate)
  - Streak broken at midnight (needs review)
  - Calendar display off by one day (fixed)

Gamification:
  - Points awarded twice (race condition)
  - Streak not updating (cache issue)
  - Achievement not unlocking (timing bug)
```

### Performance Patterns

#### Bottlenecks Identified
```yaml
Database_Queries:
  - N+1 query problem in dashboard
  - Missing indexes on date lookups
  - Inefficient joins in reports

API_Response_Times:
  - /api/peptides/protocols: 800ms (slow)
  - /api/workout/sessions: 1200ms (very slow)
  - /api/dashboard: 600ms (acceptable)

Frontend_Performance:
  - PeptideTracker re-renders on every keystroke
  - WorkoutTracker loads all history at once
  - Large bundle size from Framer Motion
```

## Health Check Implementations

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
      status: 'healthy',
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

### API Health Check
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
          healthy: false
        }
      }
    })
  )

  const allHealthy = results.every(r => r.healthy)

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    endpoints: results,
    timestamp: new Date().toISOString()
  })
}
```

### Performance Monitoring
```typescript
// lib/monitoring.ts
export function trackMetric(name: string, value: number) {
  // Send to analytics
  console.log(`[Metric] ${name}: ${value}`)

  // Alert if threshold exceeded
  if (name === 'api_response_time' && value > 1000) {
    console.warn(`Slow API detected: ${value}ms`)
  }
}

export function trackError(error: Error, context: any) {
  console.error('[Error]', error, context)

  // Send to error tracking service
  // e.g., Sentry, LogRocket
}
```

## Continuous Observations

### Weekly Reports
Generate and review:
1. **Performance Report**: Response times, bundle size, load times
2. **Error Report**: Top errors, frequency, affected features
3. **Usage Report**: Feature adoption, user engagement, conversion rates
4. **Pattern Report**: New patterns detected, anti-patterns found

### Daily Checks
- Database health status
- API endpoint availability
- Build and deployment success
- Error rate trends

### Real-Time Alerts
```yaml
Critical_Alerts:
  - Database connection lost
  - API response time > 5s
  - Error rate > 5%
  - Auth0 authentication failing

Warning_Alerts:
  - API response time > 1s
  - Error rate > 1%
  - Build time > 90s
  - Bundle size increase > 10%
```

## Pattern Analysis Tools

### Code Analysis
```bash
# Find duplicated code
npx jscpd src/

# Analyze bundle size
npx next-bundle-analyzer

# Check for unused dependencies
npx depcheck

# Find circular dependencies
npx madge --circular src/
```

### Performance Analysis
```bash
# Lighthouse CI
npx lighthouse https://resetbiology.com --only-categories=performance

# Bundle analyzer
ANALYZE=true npm run build

# Database query analysis
# Use Prisma debug logs
DEBUG="prisma:query" npm run dev
```

## ResetBiology-Specific Observations

### Feature Usage Patterns
```yaml
Most_Used_Features:
  1. Peptide Tracker (85% of users)
  2. Portal Dashboard (80% daily visits)
  3. Breath Training (60% weekly)
  4. Workout Tracker (45% weekly)
  5. Nutrition Tracker (40% weekly)

Least_Used_Features:
  1. Journal (20% adoption)
  2. Mental Mastery (15% completion)
  3. Success Deposits (5% usage)

Abandonment_Points:
  - Quiz → Portal (30% drop-off)
  - Add Protocol → First Dose (25% abandon)
  - Trial Start → Subscription (40% churn)
```

### Common User Journeys
```yaml
Successful_Path:
  1. Complete readiness quiz
  2. Login via Auth0
  3. Add peptide protocol
  4. Log first dose
  5. Check back daily for 7+ days
  6. Subscribe after trial

Failed_Path:
  1. Complete quiz
  2. Login
  3. View portal
  4. Never add protocol
  5. Don't return
```

### Performance Insights
```yaml
Slow_Pages:
  - /peptides (800ms): Too many protocols loaded
  - /workout (1200ms): Large exercise library
  - /dashboard (600ms): Multiple API calls

Fast_Pages:
  - /breath (200ms): Static content
  - /hero (300ms): Optimized images
  - /order (400ms): Cached products
```

## Integration with Other Agents

- **→ Architect**: Report architectural patterns and issues
- **→ Implementer**: Provide performance optimization suggestions
- **→ Test Oracle**: Share test coverage metrics
- **→ Design Enforcer**: Report UI performance issues
- **→ Auth0 Guardian**: Alert on authentication patterns

## Success Criteria
- Zero critical alerts per week
- Performance metrics within targets
- Pattern recognition accuracy > 90%
- Weekly reports generated
- Actionable insights provided
- Trends identified early

## Continuous Improvement
- Refine alert thresholds
- Add new monitoring metrics
- Improve pattern detection
- Enhance reporting dashboards
- Automate remediation where possible
