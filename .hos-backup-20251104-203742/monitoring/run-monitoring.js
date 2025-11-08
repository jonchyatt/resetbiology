const fs = require('fs');
const path = require('path');

// Import health check modules
const uptimeCheck = require('./health-checks/uptime');
const performanceCheck = require('./health-checks/performance');
const errorsCheck = require('./health-checks/errors');
const playwrightCheck = require('./health-checks/playwright-health');
const alertSystem = require('./alerts/send-alert');

const DASHBOARD_FILE = path.join(__dirname, 'dashboards/health-dashboard.md');

function formatStatus(isUp) {
  return isUp ? '🟢 UP' : '🔴 DOWN';
}

function formatScore(score) {
  if (score >= 85) return `${score}/100 ⚡ Good`;
  if (score >= 70) return `${score}/100 ⚠️ Fair`;
  return `${score}/100 🔴 Poor`;
}

function formatMetric(value, threshold, unit = 'ms') {
  const numValue = parseFloat(value);
  if (numValue <= threshold) return `${value}${unit} ⚡ Good`;
  if (numValue <= threshold * 1.5) return `${value}${unit} ⚠️ Fair`;
  return `${value}${unit} 🔴 Poor`;
}

function updateDashboard(results) {
  const timestamp = new Date().toISOString();
  const date = new Date().toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'long'
  });

  let dashboard = `# Reset Biology Health Dashboard\n\n`;
  dashboard += `**Last Updated:** ${date}\n\n`;
  dashboard += `---\n\n`;

  // Overall Status
  dashboard += `## Overall Status\n\n`;
  dashboard += `| Metric | Status | Details |\n`;
  dashboard += `|--------|--------|---------||\n`;
  dashboard += `| Site Status | ${formatStatus(results.uptime?.isUp)} | ${results.uptime?.statusText || 'Unknown'} |\n`;
  dashboard += `| Performance Score | ${results.performance?.performanceScore ? formatScore(Math.round(results.performance.performanceScore)) : 'N/A'} | ${results.performance?.performanceScore ? 'Monitored' : 'No data'} |\n`;
  dashboard += `| Error Count | ${results.errors?.totalErrors || 0} | ${results.errors?.totalErrors === 0 ? 'No errors' : 'Errors detected'} |\n`;
  dashboard += `| Page Health | ${results.playwrightHealth?.summary?.passed || 0}/${results.playwrightHealth?.summary?.total || 0} | ${results.playwrightHealth?.summary?.passed === results.playwrightHealth?.summary?.total ? 'All passing' : 'Some failures'} |\n\n`;

  dashboard += `---\n\n`;

  // Uptime & Availability
  dashboard += `## Uptime & Availability\n\n`;
  if (results.uptime) {
    dashboard += `- **Status Code:** ${results.uptime.status} ${results.uptime.statusText || ''}\n`;
    dashboard += `- **Response Time:** ${results.uptime.responseTime}ms\n`;
    dashboard += `- **Is Up:** ${results.uptime.isUp ? 'Yes ✅' : 'No ❌'}\n`;
    dashboard += `- **Last Check:** ${timestamp}\n\n`;
  } else {
    dashboard += `No uptime data available\n\n`;
  }

  // Performance
  dashboard += `## Performance (Core Web Vitals)\n\n`;
  if (results.performance) {
    dashboard += `- **TTFB:** ${formatMetric(Math.round(results.performance.ttfb || 0), 300)}\n`;
    dashboard += `- **FCP:** ${formatMetric(Math.round(results.performance.fcp || 0), 1800)}\n`;
    dashboard += `- **LCP:** ${formatMetric(Math.round(results.performance.lcp || 0), 2500)}\n`;
    dashboard += `- **CLS:** ${formatMetric((results.performance.cls || 0).toFixed(3), 0.1, '')}\n`;
    dashboard += `- **Overall Score:** ${formatScore(Math.round(results.performance.performanceScore || 0))}\n\n`;
  } else {
    dashboard += `No performance data available\n\n`;
  }

  // Error Monitoring
  dashboard += `## Error Monitoring\n\n`;
  if (results.errors) {
    dashboard += `- **Console Errors:** ${results.errors.consoleErrors.length}\n`;
    dashboard += `- **Network Errors:** ${results.errors.networkErrors.length}\n`;
    dashboard += `- **Broken Links:** ${results.errors.brokenLinks.length}\n`;
    dashboard += `- **Uncaught Exceptions:** ${results.errors.uncaughtExceptions.length}\n`;
    dashboard += `- **Total Errors:** ${results.errors.totalErrors}\n\n`;
  } else {
    dashboard += `No error data available\n\n`;
  }

  // Page Health
  dashboard += `## Page Health Checks\n\n`;
  if (results.playwrightHealth) {
    results.playwrightHealth.pages.forEach(page => {
      const hasErrors = page.jsErrors.length > 0 ||
                       page.networkErrors.length > 0 ||
                       page.missingElements.length > 0;
      const status = hasErrors ? '❌' : '✅';
      dashboard += `- ${status} ${page.name} (${page.responseTime}ms)\n`;
    });
    dashboard += `\n**Summary:** ${results.playwrightHealth.summary.passed}/${results.playwrightHealth.summary.total} passed\n\n`;
  } else {
    dashboard += `No page health data available\n\n`;
  }

  dashboard += `---\n\n`;

  // Active Alerts
  dashboard += `## Active Alerts\n\n`;
  if (results.alerts && results.alerts.length > 0) {
    results.alerts.forEach(alert => {
      const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
      dashboard += `${icon} **${alert.severity.toUpperCase()}**: ${alert.message}\n`;
    });
    dashboard += `\n`;
  } else {
    dashboard += `**No active alerts** - All systems operating normally\n\n`;
  }

  dashboard += `---\n\n`;
  dashboard += `## Quick Actions\n\n`;
  dashboard += `- 🔄 Run \`npm run hos:monitor\` - Force immediate check\n`;
  dashboard += `- 📊 Run \`npm run hos:insights\` - Generate insights report\n`;
  dashboard += `- 🧪 Run \`npm run hos:health\` - Run Playwright health checks\n`;
  dashboard += `- 📁 View logs in \`.hos/reports/\` directory\n\n`;

  dashboard += `---\n\n`;
  dashboard += `**Note:** This dashboard is automatically updated by the monitoring system.\n`;
  dashboard += `Data is preserved for historical analysis.\n`;

  fs.writeFileSync(DASHBOARD_FILE, dashboard);

  console.log(`Dashboard updated: ${DASHBOARD_FILE}`);
}

async function runAllChecks() {
  console.log('Starting monitoring run...\n');

  const results = {
    timestamp: new Date().toISOString(),
    uptime: null,
    performance: null,
    errors: null,
    playwrightHealth: null,
    alerts: []
  };

  // Run uptime check
  try {
    console.log('Running uptime check...');
    results.uptime = await uptimeCheck.run();
  } catch (error) {
    console.error('Uptime check failed:', error.message);
  }

  // Run performance check
  try {
    console.log('\nRunning performance check...');
    results.performance = await performanceCheck.run();
  } catch (error) {
    console.error('Performance check failed:', error.message);
  }

  // Run error check
  try {
    console.log('\nRunning error check...');
    results.errors = await errorsCheck.run();
  } catch (error) {
    console.error('Error check failed:', error.message);
  }

  // Run Playwright health check
  try {
    console.log('\nRunning Playwright health checks...');
    results.playwrightHealth = await playwrightCheck.run();
  } catch (error) {
    console.error('Playwright health check failed:', error.message);
  }

  // Check alert thresholds
  console.log('\nChecking alert thresholds...');
  const metrics = {
    uptime: results.uptime?.isUp ? 100 : 0,
    performanceScore: results.performance?.performanceScore || 0,
    errorCount: results.errors?.totalErrors || 0,
    responseTime: results.uptime?.responseTime || 0,
    pageHealthPassRate: results.playwrightHealth ?
      (results.playwrightHealth.summary.passed / results.playwrightHealth.summary.total) * 100 : 100
  };

  results.alerts = alertSystem.checkThresholds(metrics);

  // Update dashboard
  console.log('\nUpdating dashboard...');
  updateDashboard(results);

  console.log('\nMonitoring run complete!');
  console.log(`View dashboard at: ${DASHBOARD_FILE}`);

  return results;
}

if (require.main === module) {
  runAllChecks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Monitoring failed:', err);
      process.exit(1);
    });
}

module.exports = { runAllChecks };
