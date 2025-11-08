# npm Scripts Setup Instructions

Add these scripts to your `package.json` to enable easy monitoring commands.

## Scripts to Add

Open `package.json` and add the following to the `"scripts"` section:

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

## Usage

After adding the scripts, you can run:

```bash
# Full monitoring suite
npm run hos:monitor

# Generate insights report
npm run hos:insights

# Individual health checks
npm run hos:health        # Playwright page checks
npm run hos:uptime        # Site availability
npm run hos:performance   # Core Web Vitals
npm run hos:errors        # Error monitoring

# Observer agent daily tasks
npm run hos:observer-daily
```

## Example package.json

If your `package.json` already has a scripts section:

```json
{
  "name": "reset-biology-website",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
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

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run hos:monitor` | Run all health checks and update dashboard |
| `npm run hos:insights` | Generate daily insights and improvement queue |
| `npm run hos:health` | Run Playwright browser tests |
| `npm run hos:uptime` | Check site availability |
| `npm run hos:performance` | Measure Core Web Vitals |
| `npm run hos:errors` | Scan for errors and broken links |
| `npm run hos:observer-daily` | Run Observer agent daily tasks |

## Notes

- Ensure Playwright is installed: `npm install playwright`
- All scripts can be run manually without npm by using `node` directly
- Scripts create logs in `.hos/reports/` directory
- Dashboard updates automatically at `.hos/monitoring/dashboards/health-dashboard.md`
