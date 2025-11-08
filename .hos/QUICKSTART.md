# Observer Agent - Quick Start Guide

## Setup (One-Time)

### 1. Install Dependencies
```bash
cd C:/Users/jonch/reset-biology-website
npm install -D @playwright/test tsx
```

### 2. Configure Test Credentials
Add to `.env.local`:
```bash
TEST_EMAIL=test@resetbiology.com
TEST_PASSWORD=your_secure_password
BASE_URL=https://resetbiology.com
```

### 3. Run First Check
```bash
npx tsx .hos/agents/observer/monitor.ts
```

### 4. View Results
```bash
cat .hos/dashboard/health.md
```

## Daily Usage

### Check Website Health
```bash
# From project root
npx tsx .hos/agents/observer/monitor.ts
```

### View Dashboard
```bash
# Open in VS Code
code .hos/dashboard/health.md

# Or view in terminal
cat .hos/dashboard/health.md
```

### View Latest Results (JSON)
```bash
cat .hos/monitoring/logs/latest.json
```

## Automated Monitoring

### Option 1: Windows Task Scheduler (Recommended)
```bash
# Run every hour
schtasks /create /tn "ResetBioMonitor" /tr "npx tsx C:\Users\jonch\reset-biology-website\.hos\agents\observer\monitor.ts" /sc hourly /st 00:00

# Delete scheduled task
schtasks /delete /tn "ResetBioMonitor" /f

# View scheduled tasks
schtasks /query | findstr ResetBio
```

### Option 2: Manual Cron (Alternative)
Run monitor manually every hour during work hours.

## What Gets Checked

✅ **8 Critical Pages:**
- Landing Page (/)
- Client Portal (/portal)
- Peptide Tracker (/peptides)
- Workout Tracker (/workout)
- Nutrition Tracker (/nutrition)
- Breathing App (/breath)
- Journal (/journal)
- Store Checkout (/order)

✅ **Health Metrics:**
- Broken links
- Mobile responsiveness
- Page load times
- Core Web Vitals (LCP, CLS)
- Console errors
- Stripe checkout status

✅ **Auto-Fixes:**
- Broken internal links → Redirected
- Mobile overflow → Fixed CSS
- Style inconsistencies → Design system applied
- Slow images → Compressed

## Reading the Dashboard

### Status Indicators
- ✅ Green: No issues
- ⚠️ Yellow: Warning (non-critical)
- 🔴 Red: Critical issue (needs immediate fix)

### Sections
1. **Broken Links (NOW)** - Links that 404
2. **Mobile Issues (NOW)** - Layout problems on phones
3. **Checkout Status** - Stripe integration health
4. **Style Issues (TODAY)** - Design system violations
5. **Performance Issues (THIS HOUR)** - Slow pages

## Troubleshooting

### "Monitor script fails to run"
```bash
# Check if tsx is installed
npx tsx --version

# Reinstall if needed
npm install -D tsx
```

### "Authentication fails"
```bash
# Verify test credentials
cat .env.local | findstr TEST_

# Test manual login
npx playwright codegen https://resetbiology.com
```

### "Dashboard not updating"
```bash
# Check file exists
dir .hos\dashboard\health.md

# Run monitor manually and check for errors
npx tsx .hos/agents/observer/monitor.ts
```

## Next Steps

### Integrate with Development
1. Add pre-commit hook (optional)
2. Add pre-deploy check (recommended)
3. Set up automated alerts (future)

### Extend Monitoring
1. Add new pages to monitor
2. Add custom checks
3. Configure auto-fix rules

See `.hos/monitoring/README.md` for full documentation.

---

**Quick Commands Cheat Sheet:**
```bash
# Run monitor
npx tsx .hos/agents/observer/monitor.ts

# View dashboard
cat .hos/dashboard/health.md

# View logs
cat .hos/monitoring/logs/latest.json

# Schedule hourly
schtasks /create /tn "ResetBioMonitor" /tr "npx tsx C:\Users\jonch\reset-biology-website\.hos\agents\observer\monitor.ts" /sc hourly
```

---
*Observer Agent v1.0.0*
