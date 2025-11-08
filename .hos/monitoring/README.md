# Reset Biology Continuous Improvement System

## Overview
This directory contains the Observer agent and automated monitoring system that continuously tracks the health of the Reset Biology website.

## Directory Structure
```
.hos/
├── agents/
│   └── observer/
│       ├── config.yaml          # Observer agent configuration
│       └── monitor.ts           # Monitoring script (Playwright-based)
├── dashboard/
│   └── health.md               # Real-time health dashboard
└── monitoring/
    ├── auto-fix.yaml           # Auto-fix protocol configuration
    ├── alerts.yaml             # Alert system configuration
    └── logs/
        ├── latest.json         # Latest monitoring results
        ├── alerts.log          # Alert history log
        └── auto-fix.log        # Auto-fix action log
```

## Quick Start

### 1. Install Dependencies
```bash
npm install -D @playwright/test
npm install -D tsx
```

### 2. Set Up Environment Variables
Create `.env.local` with test credentials:
```bash
TEST_EMAIL=test@resetbiology.com
TEST_PASSWORD=your_test_password
BASE_URL=https://resetbiology.com
```

### 3. Run Manual Check
```bash
npx tsx .hos/agents/observer/monitor.ts
```

### 4. View Dashboard
```bash
cat .hos/dashboard/health.md
```

## Automated Monitoring

### Windows Task Scheduler (Hourly)
```bash
schtasks /create /tn "ResetBioMonitor" /tr "npx tsx C:\Users\jonch\reset-biology-website\.hos\agents\observer\monitor.ts" /sc hourly /st 00:00
```

### Vercel Cron Job (Alternative)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/monitor/run",
    "schedule": "0 * * * *"
  }]
}
```

Then create `/app/api/monitor/run/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { stdout } = await execAsync('npx tsx .hos/agents/observer/monitor.ts')
    return NextResponse.json({ success: true, output: stdout })
  } catch (error) {
    return NextResponse.json({ error: 'Monitor failed' }, { status: 500 })
  }
}
```

## Monitoring Scope

### Pages Monitored
- **Landing Page** (/) - Critical
- **Client Portal** (/portal) - Critical
- **Peptide Tracker** (/peptides) - Critical
- **Workout Tracker** (/workout)
- **Nutrition Tracker** (/nutrition)
- **Breathing App** (/breath)
- **Journal Page** (/journal)
- **Store Checkout** (/order) - Critical

### Checks Performed
1. **Link Validation**: Broken internal/external links
2. **Mobile Responsiveness**: Horizontal scroll, viewport issues
3. **Performance**: Load time, LCP, CLS, Core Web Vitals
4. **Functionality**: Key features working (login, save, checkout)
5. **Style Consistency**: Brand colors, design system compliance
6. **Accessibility**: WCAG AA compliance
7. **Console Errors**: JavaScript errors blocking functionality

### Auto-Fix Capabilities
The system can automatically fix:
- Broken internal links (redirect to closest match)
- Style inconsistencies (apply design system)
- Mobile overflow issues (add overflow-hidden)
- Image optimization (compress & convert to WebP)
- Missing accessibility attributes
- Performance issues (caching, compression)

See `auto-fix.yaml` for full list.

## Alert Severity Levels

### 🔴 Critical (Immediate Action)
- Auth0 down
- Database connection lost
- Checkout broken
- Portal inaccessible
- Data loss detected

**Response Time:** Immediate
**Auto-Fix:** Enabled for safe fixes
**Escalation:** 5 minutes

### 🟠 High (15 Minutes)
- Broken links on main pages
- Mobile rendering broken
- Peptide tracker not saving
- Slow page load (>5s)
- Console errors blocking features

**Response Time:** 15 minutes
**Auto-Fix:** Enabled
**Escalation:** 30 minutes

### 🟡 Medium (1 Hour)
- Style inconsistencies
- Slow API response (>1s)
- Unoptimized images
- Accessibility violations
- Bundle size increase

**Response Time:** 1 hour
**Auto-Fix:** Enabled for safe fixes
**Escalation:** 4 hours

### 🟢 Low (24 Hours)
- Minor accessibility issues
- Outdated dependencies
- Unused code
- Formatting inconsistencies
- Missing loading states

**Response Time:** 24 hours
**Auto-Fix:** Enabled for safe fixes
**Escalation:** Never

## Dashboard Sections

### 🔴 Broken Links (NOW)
Real-time list of broken links found in the last scan.

### 📱 Mobile Issues (NOW)
Pages not rendering correctly on iPhone/Android.

### 💳 Checkout Flow Status
Current status of Stripe checkout integration and last successful test.

### 🎨 Style Inconsistencies (TODAY)
Pages not matching the design system (colors, spacing, typography).

### ⚡ Performance Issues (THIS HOUR)
Slow loading pages and Core Web Vitals violations.

### 📊 Detailed Results
Per-page breakdown with:
- Load time
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- Console errors
- Specific issues found

## Auto-Fix Protocol

### How It Works
1. **Detect Issue**: Monitor identifies problem
2. **Check Auto-Fix Rules**: Consult `auto-fix.yaml`
3. **Apply Fix**: Execute automated remediation
4. **Verify**: Test that fix worked
5. **Log**: Record action in `auto-fix.log`
6. **Notify**: Update dashboard

### Safety Limits
- Max 50 auto-fixes per hour
- Max 10 file modifications per fix
- Excluded paths: `.git/`, `node_modules/`, `.env*`
- Never auto-fix: database schema, auth config, payments

### Manual Review Required
Some issues require human review:
- Database schema changes
- Auth0 configuration
- Payment integration
- TypeScript errors
- Test failures

## Alert History & Analytics

### View Recent Alerts
```bash
cat .hos/monitoring/logs/alerts.log
```

### View Latest Results
```bash
cat .hos/monitoring/logs/latest.json
```

### Alert Metrics
Tracked in `alert-history.json`:
- Alert name
- Timestamp
- Severity
- Auto-fixed (yes/no)
- Resolution time
- Recurrence count

## Integration with Development Workflow

### Pre-Commit Checks
Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
npx tsx .hos/agents/observer/monitor.ts
if [ $? -ne 0 ]; then
  echo "Monitoring check failed. Fix issues before committing."
  exit 1
fi
```

### Pre-Deployment Checks
Add to CI/CD pipeline:
```yaml
- name: Run Health Checks
  run: npx tsx .hos/agents/observer/monitor.ts
- name: Verify Dashboard
  run: cat .hos/dashboard/health.md
```

## Extending the System

### Add New Page to Monitor
Edit `.hos/agents/observer/config.yaml`:
```yaml
monitored_pages:
  - url: "/new-page"
    name: "New Feature"
    critical: false
    checks:
      - page_loads
      - feature_works
```

### Add New Auto-Fix Rule
Edit `.hos/monitoring/auto-fix.yaml`:
```yaml
new_issue_type:
  enabled: true
  auto_fix: true
  action: "description_of_fix"
```

### Add New Alert Type
Edit `.hos/monitoring/alerts.yaml`:
```yaml
medium_alerts:
  - name: "new_alert"
    description: "Description of issue"
    check: "How to detect it"
    severity: medium
    auto_fix:
      enabled: true
      strategy: "how_to_fix"
```

## Troubleshooting

### Monitor Not Running
```bash
# Check if TypeScript is installed
npx tsx --version

# Check if Playwright is installed
npx playwright --version

# Install if missing
npm install -D tsx @playwright/test
```

### Authentication Failing
```bash
# Verify credentials in .env.local
cat .env.local | grep TEST_

# Test manual login
npx playwright codegen https://resetbiology.com/api/auth/login
```

### Dashboard Not Updating
```bash
# Check file permissions
ls -la .hos/dashboard/health.md

# Manually run monitor
npx tsx .hos/agents/observer/monitor.ts

# Check for errors
cat .hos/monitoring/logs/latest.json
```

## Success Metrics

### System Goals
- Zero critical alerts per week
- 95% of high alerts resolved within 15 minutes
- 90% of medium alerts resolved within 1 hour
- 80% auto-fix success rate

### Current Status
View in `health.md` dashboard.

## Future Enhancements

### Planned Features
- [ ] Email/SMS notifications for critical alerts
- [ ] Slack/Discord integration
- [ ] Historical trend analysis
- [ ] Predictive alerting (ML-based)
- [ ] User experience monitoring (real user metrics)
- [ ] A/B test monitoring
- [ ] Cost optimization alerts (Vercel/MongoDB usage)

### Integration Opportunities
- [ ] Vercel Analytics
- [ ] Sentry error tracking
- [ ] LogRocket session replay
- [ ] Google Analytics
- [ ] Stripe dashboard metrics

## Contributing

### Adding New Monitors
1. Create monitor script in `.hos/agents/observer/`
2. Add configuration to `config.yaml`
3. Update this README
4. Test manually before automating

### Modifying Auto-Fix Rules
1. Edit `auto-fix.yaml`
2. Test fix in isolation
3. Update safety limits if needed
4. Document in this README

---

*Last Updated: November 4, 2025*
*Maintained by: Observer Agent*
*Version: 1.0.0*
