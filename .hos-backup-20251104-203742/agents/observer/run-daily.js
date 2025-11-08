const path = require('path');

// Import monitoring modules
const monitoringRunner = require('../../monitoring/run-monitoring');
const insightsGenerator = require('../../monitoring/generate-insights');

async function runDailyObserverTasks() {
  console.log('========================================');
  console.log('Observer Agent - Daily Tasks');
  console.log('========================================');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = {
    timestamp: new Date().toISOString(),
    monitoring: null,
    insights: null,
    errors: []
  };

  // Step 1: Run all health checks
  console.log('Step 1: Running health checks...\n');
  try {
    results.monitoring = await monitoringRunner.runAllChecks();
    console.log('✅ Health checks complete\n');
  } catch (error) {
    console.error('❌ Health checks failed:', error.message);
    results.errors.push({
      step: 'monitoring',
      error: error.message
    });
  }

  // Step 2: Generate insights
  console.log('Step 2: Generating insights...\n');
  try {
    results.insights = await insightsGenerator.run();
    console.log('✅ Insights generated\n');
  } catch (error) {
    console.error('❌ Insights generation failed:', error.message);
    results.errors.push({
      step: 'insights',
      error: error.message
    });
  }

  // Summary
  console.log('========================================');
  console.log('Daily Tasks Summary');
  console.log('========================================');

  if (results.monitoring) {
    console.log('\nHealth Status:');
    console.log(`- Site Up: ${results.monitoring.uptime?.isUp ? 'Yes' : 'No'}`);
    console.log(`- Performance Score: ${results.monitoring.performance?.performanceScore?.toFixed(0) || 'N/A'}/100`);
    console.log(`- Errors Detected: ${results.monitoring.errors?.totalErrors || 0}`);
    console.log(`- Page Health: ${results.monitoring.playwrightHealth?.summary?.passed || 0}/${results.monitoring.playwrightHealth?.summary?.total || 0} passing`);
    console.log(`- Alerts: ${results.monitoring.alerts?.length || 0} triggered`);
  }

  if (results.insights) {
    console.log('\nInsights:');
    const allInsights = [
      ...(results.insights.analysis.uptime?.insights || []),
      ...(results.insights.analysis.performance?.insights || []),
      ...(results.insights.analysis.errors?.insights || []),
      ...(results.insights.analysis.playwrightHealth?.insights || [])
    ];

    console.log(`- Total Insights: ${allInsights.length}`);
    console.log(`- High Priority: ${allInsights.filter(i => i.impact === 'high').length}`);
    console.log(`- Medium Priority: ${allInsights.filter(i => i.impact === 'medium').length}`);
    console.log(`- Low Priority: ${allInsights.filter(i => i.impact === 'low').length}`);
    console.log(`- Report: ${results.insights.reportPath}`);
  }

  if (results.errors.length > 0) {
    console.log('\n⚠️ Errors occurred during execution:');
    results.errors.forEach(err => {
      console.log(`- ${err.step}: ${err.error}`);
    });
  }

  console.log(`\nCompleted: ${new Date().toISOString()}`);
  console.log('========================================\n');

  return results;
}

if (require.main === module) {
  runDailyObserverTasks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Daily tasks failed:', err);
      process.exit(1);
    });
}

module.exports = { runDailyObserverTasks };
