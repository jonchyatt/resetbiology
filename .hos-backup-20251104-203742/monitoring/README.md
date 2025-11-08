# Observer Agent Monitoring System

Continuous monitoring infrastructure for Reset Biology website health, performance, and quality.

## Overview

This monitoring system provides:
- **Uptime monitoring** - Check site availability and response times
- **Performance tracking** - Measure Core Web Vitals (TTFB, FCP, LCP, CLS)
- **Error detection** - Monitor console errors, network failures, and broken links
- **Page health checks** - Automated browser testing with Playwright
- **Live dashboard** - Auto-updating health status
- **Daily insights** - Automated analysis and improvement suggestions
- **Alert system** - Notifications for critical issues

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install playwright

# Run full monitoring suite
npm run hos:monitor

# Generate insights report
npm run hos:insights

# Run Playwright health checks only
npm run hos:health
```

## Health Check Scripts

### 1. Uptime Check
**File:** `.hos/monitoring/health-checks/uptime.js`

Checks site availability and response times:
- Pings production site
- Measures response time
- Verifies HTTP status codes
- Logs results to `.hos/reports/uptime-log.json`

```bash
node .hos/monitoring/health-checks/uptime.js
```

### 2. Performance Check
**File:** `.hos/monitoring/health-checks/performance.js`

Measures Core Web Vitals using Playwright:
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Overall performance score
- Logs to `.hos/reports/performance-log.json`

```bash
node .hos/monitoring/health-checks/performance.js
```

### 3. Error Check
**File:** `.hos/monitoring/health-checks/errors.js`

Monitors for errors:
- Console errors
- Failed network requests
- Broken links (first 50)
- Uncaught exceptions
- Logs to `.hos/reports/errors-log.json`

```bash
node .hos/monitoring/health-checks/errors.js
```

### 4. Playwright Health Check
**File:** `.hos/monitoring/health-checks/playwright-health.js`

Comprehensive page testing:
- Navigates to major pages (Homepage, Portal, Store, Process)
- Checks for JavaScript errors
- Verifies critical elements exist
- Tests basic interactions
- Captures screenshots
- Logs to `.hos/reports/playwright-health-log.json`

```bash
node .hos/monitoring/health-checks/playwright-health.js
```

## Monitoring Runner

**File:** `.hos/monitoring/run-monitoring.js`

Main orchestrator that:
- Runs all health checks in sequence
- Collects results
- Checks alert thresholds
- Updates live dashboard
- Can be run manually or scheduled

```bash
node .hos/monitoring/run-monitoring.js
```

## Dashboard

**File:** `.hos/monitoring/dashboards/health-dashboard.md`

Auto-updating markdown dashboard showing:
- Current uptime status
- Latest performance metrics
- Recent errors (if any)
- Page health check results
- Active alerts
- Last updated timestamp

View the dashboard after running monitoring to see current status.

## Insights Generator

**File:** `.hos/monitoring/generate-insights.js`

Analyzes health check history and generates:
- Trend analysis
- Performance insights
- Issue identification
- Priority-ranked improvement suggestions
- Daily reports in `.hos/reports/daily/YYYY-MM-DD-insights.md`

```bash
node .hos/monitoring/generate-insights.js
```

## Improvement Queue

**File:** `.hos/monitoring/improvement-queue.json`

JSON database tracking improvement suggestions:
- Auto-populated by insights generator
- Categorized by type (performance, bug, UX, etc.)
- Prioritized by impact and effort
- Status tracking (suggested → approved → in-progress → deployed)

Example structure:
```json
{
  "queue": [
    {
      "id": "IMP-001",
      "title": "Optimize LCP performance",
      "category": "performance",
      "impact": "high",
      "effort": "medium",
      "evidence": ["LCP: 3200ms", "Target: <2500ms"],
      "status": "suggested",
      "createdAt": "2025-11-03T10:00:00Z",
      "priority": 1
    }
  ]
}
```

## Alert System

### Configuration
**File:** `.hos/monitoring/alerts/alert-config.json`

Configure alert thresholds:
- **Critical alerts**: Site down, major errors, severe performance issues
- **Warning alerts**: Performance degradation, elevated errors
- **Info alerts**: Optimization opportunities

### Alert Sending
**File:** `.hos/monitoring/alerts/send-alert.js`

Handles alert delivery:
- Console logging (always enabled)
- Email (configurable)
- Slack (configurable)
- Logs all alerts to `.hos/reports/alerts-log.json`

## Scheduling Automated Runs

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 9 AM)
4. Action: Start a program
5. Program: `node`
6. Arguments: `C:\Users\jonch\reset-biology-website\.hos\monitoring\run-monitoring.js`
7. Start in: `C:\Users\jonch\reset-biology-website`

### macOS/Linux (Cron)

```bash
# Edit crontab
crontab -e

# Run monitoring every 4 hours
0 */4 * * * cd /path/to/reset-biology-website && node .hos/monitoring/run-monitoring.js

# Generate insights daily at 9 AM
0 9 * * * cd /path/to/reset-biology-website && node .hos/monitoring/generate-insights.js
```

### GitHub Actions (CI/CD)

Create `.github/workflows/monitoring.yml`:

```yaml
name: Health Monitoring

on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
  workflow_dispatch:  # Manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install playwright
      - run: node .hos/monitoring/run-monitoring.js
      - run: node .hos/monitoring/generate-insights.js
```

## Configuration

### Site URL
Set the `SITE_URL` environment variable to monitor a different site:

```bash
# Windows
set SITE_URL=https://your-site.com
npm run hos:monitor

# macOS/Linux
SITE_URL=https://your-site.com npm run hos:monitor
```

Default: `https://reset-biology.vercel.app`

### Alert Thresholds
Edit `.hos/monitoring/alerts/alert-config.json` to customize:
- When alerts fire
- Alert severity levels
- Notification channels

## Reading Results

### Log Files
All health checks store results in `.hos/reports/`:
- `uptime-log.json` - Last 1000 uptime checks
- `performance-log.json` - Last 500 performance measurements
- `errors-log.json` - Last 500 error scans
- `playwright-health-log.json` - Last 200 page health checks
- `alerts-log.json` - Last 1000 alerts

### Dashboard
Quick overview: `.hos/monitoring/dashboards/health-dashboard.md`

### Daily Reports
Detailed analysis: `.hos/reports/daily/YYYY-MM-DD-insights.md`

### Screenshots
Page screenshots saved to: `.hos/reports/screenshots/`

## Observer Agent Integration

**File:** `.hos/agents/observer/run-daily.js`

Daily automation script for Observer agent:
- Runs all health checks
- Generates insights
- Updates improvement queue
- Creates daily report
- Can be triggered by agent or scheduled task

```bash
node .hos/agents/observer/run-daily.js
```

## Troubleshooting

### Playwright Installation
```bash
npm install playwright
npx playwright install chromium
```

### Permission Issues
Ensure scripts have read/write access to `.hos/reports/` directory.

### No Data in Logs
Run monitoring scripts at least once to populate logs before generating insights.

### High Memory Usage
Playwright checks use headless Chrome. Reduce frequency or run during off-hours.

## Best Practices

1. **Run regularly** - Schedule monitoring every 2-4 hours
2. **Review daily** - Check insights reports each morning
3. **Act on alerts** - Critical alerts need immediate attention
4. **Track trends** - Monitor performance over weeks, not just days
5. **Keep history** - Don't delete old reports; useful for regression analysis
6. **Update thresholds** - Adjust as your site improves

## npm Scripts Reference

Add to `package.json`:

```json
{
  "scripts": {
    "hos:monitor": "node .hos/monitoring/run-monitoring.js",
    "hos:insights": "node .hos/monitoring/generate-insights.js",
    "hos:health": "node .hos/monitoring/health-checks/playwright-health.js",
    "hos:uptime": "node .hos/monitoring/health-checks/uptime.js",
    "hos:performance": "node .hos/monitoring/health-checks/performance.js",
    "hos:errors": "node .hos/monitoring/health-checks/errors.js",
    "hos:observer-daily": "node .hos/agents/observer/run-daily.js"
  }
}
```

## Support

For issues or questions:
1. Check log files in `.hos/reports/`
2. Review alert configuration
3. Ensure Playwright is installed
4. Verify site URL is correct
