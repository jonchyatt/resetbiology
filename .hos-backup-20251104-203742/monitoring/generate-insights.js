const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../reports');
const DAILY_DIR = path.join(REPORTS_DIR, 'daily');
const QUEUE_FILE = path.join(__dirname, 'improvement-queue.json');

function loadLogs(filename) {
  const filepath = path.join(REPORTS_DIR, filename);
  if (!fs.existsSync(filepath)) return [];

  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.warn(`Could not parse ${filename}:`, e.message);
    return [];
  }
}

function analyzeUptime(logs) {
  if (logs.length === 0) return null;

  const recent = logs.slice(-100);
  const upCount = recent.filter(l => l.isUp).length;
  const uptimePercent = (upCount / recent.length) * 100;
  const avgResponseTime = recent
    .filter(l => l.isUp)
    .reduce((sum, l) => sum + l.responseTime, 0) / upCount;

  const insights = [];

  if (uptimePercent < 95) {
    insights.push({
      category: 'bug',
      impact: 'high',
      title: 'Site uptime below 95%',
      evidence: [`Uptime: ${uptimePercent.toFixed(2)}%`, `Recent checks: ${recent.length}`]
    });
  }

  if (avgResponseTime > 1000) {
    insights.push({
      category: 'performance',
      impact: 'high',
      title: 'Slow response times detected',
      evidence: [`Average response time: ${avgResponseTime.toFixed(0)}ms`]
    });
  } else if (avgResponseTime > 500) {
    insights.push({
      category: 'performance',
      impact: 'medium',
      title: 'Response time could be improved',
      evidence: [`Average response time: ${avgResponseTime.toFixed(0)}ms`]
    });
  }

  return {
    uptimePercent,
    avgResponseTime,
    insights,
    totalChecks: recent.length
  };
}

function analyzePerformance(logs) {
  if (logs.length === 0) return null;

  const recent = logs.slice(-50);
  const avgScore = recent.reduce((sum, l) => sum + (l.performanceScore || 0), 0) / recent.length;
  const avgTTFB = recent.reduce((sum, l) => sum + (l.ttfb || 0), 0) / recent.length;
  const avgLCP = recent.reduce((sum, l) => sum + (l.lcp || 0), 0) / recent.length;
  const avgCLS = recent.reduce((sum, l) => sum + (l.cls || 0), 0) / recent.length;

  const insights = [];

  if (avgScore < 70) {
    insights.push({
      category: 'performance',
      impact: 'high',
      title: 'Performance score needs improvement',
      evidence: [`Average score: ${avgScore.toFixed(0)}/100`]
    });
  }

  if (avgTTFB > 600) {
    insights.push({
      category: 'performance',
      impact: 'high',
      title: 'TTFB too slow - server optimization needed',
      evidence: [`Average TTFB: ${avgTTFB.toFixed(0)}ms`, 'Target: <300ms']
    });
  }

  if (avgLCP > 2500) {
    insights.push({
      category: 'performance',
      impact: 'medium',
      title: 'LCP needs optimization',
      evidence: [`Average LCP: ${avgLCP.toFixed(0)}ms`, 'Target: <2500ms']
    });
  }

  if (avgCLS > 0.1) {
    insights.push({
      category: 'ux',
      impact: 'medium',
      title: 'Layout shift issues detected',
      evidence: [`Average CLS: ${avgCLS.toFixed(3)}`, 'Target: <0.1']
    });
  }

  return {
    avgScore,
    avgTTFB,
    avgLCP,
    avgCLS,
    insights
  };
}

function analyzeErrors(logs) {
  if (logs.length === 0) return null;

  const recent = logs.slice(-50);
  const totalErrors = recent.reduce((sum, l) => sum + l.totalErrors, 0);
  const avgErrors = totalErrors / recent.length;

  const consoleErrors = recent.reduce((sum, l) => sum + l.consoleErrors.length, 0);
  const networkErrors = recent.reduce((sum, l) => sum + l.networkErrors.length, 0);
  const brokenLinks = recent.reduce((sum, l) => sum + l.brokenLinks.length, 0);

  const insights = [];

  if (avgErrors > 5) {
    insights.push({
      category: 'bug',
      impact: 'high',
      title: 'High error rate detected',
      evidence: [`Average errors per check: ${avgErrors.toFixed(1)}`]
    });
  }

  if (consoleErrors > 0) {
    insights.push({
      category: 'bug',
      impact: 'medium',
      title: 'Console errors need investigation',
      evidence: [`${consoleErrors} console errors in recent checks`]
    });
  }

  if (brokenLinks > 0) {
    insights.push({
      category: 'bug',
      impact: 'low',
      title: 'Broken links found',
      evidence: [`${brokenLinks} broken links detected`]
    });
  }

  return {
    totalErrors,
    avgErrors,
    consoleErrors,
    networkErrors,
    brokenLinks,
    insights
  };
}

function analyzePlaywrightHealth(logs) {
  if (logs.length === 0) return null;

  const recent = logs.slice(-20);
  const totalPassed = recent.reduce((sum, l) => sum + l.summary.passed, 0);
  const totalFailed = recent.reduce((sum, l) => sum + l.summary.failed, 0);
  const totalChecks = totalPassed + totalFailed;
  const passRate = totalChecks > 0 ? (totalPassed / totalChecks) * 100 : 0;

  const insights = [];

  if (passRate < 90) {
    insights.push({
      category: 'bug',
      impact: 'high',
      title: 'Page health checks failing',
      evidence: [`Pass rate: ${passRate.toFixed(1)}%`, `${totalFailed} failures in recent checks`]
    });
  }

  // Analyze which pages are failing most
  const pageFailures = {};
  recent.forEach(log => {
    log.pages.forEach(page => {
      if (page.jsErrors.length > 0 || page.networkErrors.length > 0 || page.missingElements.length > 0) {
        pageFailures[page.name] = (pageFailures[page.name] || 0) + 1;
      }
    });
  });

  Object.entries(pageFailures).forEach(([page, count]) => {
    if (count > 3) {
      insights.push({
        category: 'bug',
        impact: 'medium',
        title: `${page} page has recurring issues`,
        evidence: [`Failed ${count} times in recent checks`]
      });
    }
  });

  return {
    passRate,
    totalPassed,
    totalFailed,
    pageFailures,
    insights
  };
}

function generateImprovements(allInsights) {
  const improvements = [];
  let idCounter = 1;

  allInsights.forEach(insight => {
    const effort = insight.impact === 'high' ? 'medium' : 'small';
    const priority =
      insight.impact === 'high' ? 1 :
      insight.impact === 'medium' ? 2 : 3;

    improvements.push({
      id: `IMP-${String(idCounter).padStart(3, '0')}`,
      title: insight.title,
      category: insight.category,
      impact: insight.impact,
      effort,
      evidence: insight.evidence,
      status: 'suggested',
      createdAt: new Date().toISOString(),
      priority
    });

    idCounter++;
  });

  return improvements.sort((a, b) => a.priority - b.priority);
}

function updateImprovementQueue(newImprovements) {
  let queue = { queue: [] };

  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch (e) {
      console.warn('Could not parse queue file, starting fresh');
    }
  }

  // Add new improvements if they don't already exist
  newImprovements.forEach(newImp => {
    const exists = queue.queue.some(imp => imp.title === newImp.title);
    if (!exists) {
      queue.queue.push(newImp);
    }
  });

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

  return queue;
}

function generateReport(analysis) {
  const date = new Date().toISOString().split('T')[0];
  const reportPath = path.join(DAILY_DIR, `${date}-insights.md`);

  let report = `# Daily Insights Report - ${date}\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  report += `---\n\n`;

  // Uptime
  if (analysis.uptime) {
    report += `## Uptime & Availability\n\n`;
    report += `- **Uptime:** ${analysis.uptime.uptimePercent.toFixed(2)}%\n`;
    report += `- **Avg Response Time:** ${analysis.uptime.avgResponseTime.toFixed(0)}ms\n`;
    report += `- **Total Checks:** ${analysis.uptime.totalChecks}\n\n`;
  }

  // Performance
  if (analysis.performance) {
    report += `## Performance Metrics\n\n`;
    report += `- **Overall Score:** ${analysis.performance.avgScore.toFixed(0)}/100\n`;
    report += `- **TTFB:** ${analysis.performance.avgTTFB.toFixed(0)}ms\n`;
    report += `- **LCP:** ${analysis.performance.avgLCP.toFixed(0)}ms\n`;
    report += `- **CLS:** ${analysis.performance.avgCLS.toFixed(3)}\n\n`;
  }

  // Errors
  if (analysis.errors) {
    report += `## Error Summary\n\n`;
    report += `- **Total Errors:** ${analysis.errors.totalErrors}\n`;
    report += `- **Console Errors:** ${analysis.errors.consoleErrors}\n`;
    report += `- **Network Errors:** ${analysis.errors.networkErrors}\n`;
    report += `- **Broken Links:** ${analysis.errors.brokenLinks}\n\n`;
  }

  // Page Health
  if (analysis.playwrightHealth) {
    report += `## Page Health\n\n`;
    report += `- **Pass Rate:** ${analysis.playwrightHealth.passRate.toFixed(1)}%\n`;
    report += `- **Passed:** ${analysis.playwrightHealth.totalPassed}\n`;
    report += `- **Failed:** ${analysis.playwrightHealth.totalFailed}\n\n`;
  }

  // Insights
  const allInsights = [
    ...(analysis.uptime?.insights || []),
    ...(analysis.performance?.insights || []),
    ...(analysis.errors?.insights || []),
    ...(analysis.playwrightHealth?.insights || [])
  ];

  if (allInsights.length > 0) {
    report += `## Key Insights\n\n`;
    allInsights.forEach((insight, i) => {
      report += `### ${i + 1}. ${insight.title}\n\n`;
      report += `- **Category:** ${insight.category}\n`;
      report += `- **Impact:** ${insight.impact}\n`;
      report += `- **Evidence:**\n`;
      insight.evidence.forEach(e => {
        report += `  - ${e}\n`;
      });
      report += `\n`;
    });
  } else {
    report += `## Key Insights\n\n`;
    report += `No issues detected. All systems operating normally.\n\n`;
  }

  // Recommendations
  if (allInsights.length > 0) {
    report += `## Recommended Actions\n\n`;
    const highPriority = allInsights.filter(i => i.impact === 'high');
    const mediumPriority = allInsights.filter(i => i.impact === 'medium');
    const lowPriority = allInsights.filter(i => i.impact === 'low');

    if (highPriority.length > 0) {
      report += `### High Priority\n\n`;
      highPriority.forEach(i => report += `- ${i.title}\n`);
      report += `\n`;
    }

    if (mediumPriority.length > 0) {
      report += `### Medium Priority\n\n`;
      mediumPriority.forEach(i => report += `- ${i.title}\n`);
      report += `\n`;
    }

    if (lowPriority.length > 0) {
      report += `### Low Priority\n\n`;
      lowPriority.forEach(i => report += `- ${i.title}\n`);
      report += `\n`;
    }
  }

  report += `---\n\n`;
  report += `**Next Steps:**\n`;
  report += `1. Review high-priority items immediately\n`;
  report += `2. Schedule medium-priority fixes for next sprint\n`;
  report += `3. Add low-priority items to backlog\n`;
  report += `4. Continue daily monitoring\n`;

  fs.mkdirSync(DAILY_DIR, { recursive: true });
  fs.writeFileSync(reportPath, report);

  return reportPath;
}

async function run() {
  console.log('Generating daily insights...');

  const uptimeLogs = loadLogs('uptime-log.json');
  const performanceLogs = loadLogs('performance-log.json');
  const errorLogs = loadLogs('errors-log.json');
  const playwrightLogs = loadLogs('playwright-health-log.json');

  const analysis = {
    uptime: analyzeUptime(uptimeLogs),
    performance: analyzePerformance(performanceLogs),
    errors: analyzeErrors(errorLogs),
    playwrightHealth: analyzePlaywrightHealth(playwrightLogs)
  };

  const allInsights = [
    ...(analysis.uptime?.insights || []),
    ...(analysis.performance?.insights || []),
    ...(analysis.errors?.insights || []),
    ...(analysis.playwrightHealth?.insights || [])
  ];

  console.log(`Found ${allInsights.length} insights`);

  const improvements = generateImprovements(allInsights);
  const queue = updateImprovementQueue(improvements);

  console.log(`Improvement queue updated: ${queue.queue.length} total items`);

  const reportPath = generateReport(analysis);

  console.log(`Report generated: ${reportPath}`);

  return { analysis, improvements, reportPath };
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = { run };
