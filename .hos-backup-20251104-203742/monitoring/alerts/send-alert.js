const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'alert-config.json');
const ALERT_LOG = path.join(__dirname, '../reports/alerts-log.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error('Alert config file not found');
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function logAlert(alert) {
  let logs = [];

  if (fs.existsSync(ALERT_LOG)) {
    try {
      logs = JSON.parse(fs.readFileSync(ALERT_LOG, 'utf8'));
    } catch (e) {
      console.warn('Could not parse alert log, starting fresh');
    }
  }

  logs.push({
    ...alert,
    timestamp: new Date().toISOString()
  });

  // Keep only last 1000 alerts
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }

  fs.mkdirSync(path.dirname(ALERT_LOG), { recursive: true });
  fs.writeFileSync(ALERT_LOG, JSON.stringify(logs, null, 2));
}

function sendConsoleAlert(alert) {
  const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
  console.log('\n' + '='.repeat(60));
  console.log(`${icon} ${alert.severity.toUpperCase()} ALERT`);
  console.log('='.repeat(60));
  console.log(`Type: ${alert.type}`);
  console.log(`Message: ${alert.message}`);
  if (alert.value !== undefined) {
    console.log(`Value: ${alert.value}`);
  }
  if (alert.threshold !== undefined) {
    console.log(`Threshold: ${alert.threshold}`);
  }
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');
}

function sendEmailAlert(alert, config) {
  // Placeholder for email implementation
  console.log('[Email Alert] Would send email to:', config.channels.email.recipients);
  console.log('[Email Alert] Subject:', `${alert.severity.toUpperCase()}: ${alert.message}`);
}

function sendSlackAlert(alert, config) {
  // Placeholder for Slack implementation
  console.log('[Slack Alert] Would send to webhook:', config.channels.slack.webhookUrl);
  console.log('[Slack Alert] Message:', alert.message);
}

function sendAlert(type, severity, message, value = null, threshold = null) {
  const config = loadConfig();

  const alert = {
    type,
    severity,
    message,
    value,
    threshold,
    timestamp: new Date().toISOString()
  };

  // Log the alert
  logAlert(alert);

  // Send through enabled channels
  if (config.channels.console?.enabled) {
    sendConsoleAlert(alert);
  }

  if (config.channels.email?.enabled) {
    sendEmailAlert(alert, config);
  }

  if (config.channels.slack?.enabled) {
    sendSlackAlert(alert, config);
  }

  return alert;
}

function checkThresholds(metrics) {
  const config = loadConfig();
  const alerts = [];

  // Check uptime
  if (metrics.uptime !== undefined) {
    if (metrics.uptime === 0 && config.alerts.uptime.critical.enabled) {
      alerts.push(sendAlert(
        'uptime',
        'critical',
        config.alerts.uptime.critical.message,
        metrics.uptime,
        config.alerts.uptime.critical.threshold
      ));
    } else if (metrics.uptime < config.alerts.uptime.warning.threshold && config.alerts.uptime.warning.enabled) {
      alerts.push(sendAlert(
        'uptime',
        'warning',
        config.alerts.uptime.warning.message,
        metrics.uptime,
        config.alerts.uptime.warning.threshold
      ));
    }
  }

  // Check performance
  if (metrics.performanceScore !== undefined) {
    if (metrics.performanceScore < config.alerts.performance.critical.threshold && config.alerts.performance.critical.enabled) {
      alerts.push(sendAlert(
        'performance',
        'critical',
        config.alerts.performance.critical.message,
        metrics.performanceScore,
        config.alerts.performance.critical.threshold
      ));
    } else if (metrics.performanceScore < config.alerts.performance.warning.threshold && config.alerts.performance.warning.enabled) {
      alerts.push(sendAlert(
        'performance',
        'warning',
        config.alerts.performance.warning.message,
        metrics.performanceScore,
        config.alerts.performance.warning.threshold
      ));
    }
  }

  // Check errors
  if (metrics.errorCount !== undefined) {
    if (metrics.errorCount >= config.alerts.errors.critical.threshold && config.alerts.errors.critical.enabled) {
      alerts.push(sendAlert(
        'errors',
        'critical',
        config.alerts.errors.critical.message,
        metrics.errorCount,
        config.alerts.errors.critical.threshold
      ));
    } else if (metrics.errorCount >= config.alerts.errors.warning.threshold && config.alerts.errors.warning.enabled) {
      alerts.push(sendAlert(
        'errors',
        'warning',
        config.alerts.errors.warning.message,
        metrics.errorCount,
        config.alerts.errors.warning.threshold
      ));
    }
  }

  // Check response time
  if (metrics.responseTime !== undefined) {
    if (metrics.responseTime >= config.alerts.responseTime.critical.threshold && config.alerts.responseTime.critical.enabled) {
      alerts.push(sendAlert(
        'responseTime',
        'critical',
        config.alerts.responseTime.critical.message,
        metrics.responseTime,
        config.alerts.responseTime.critical.threshold
      ));
    } else if (metrics.responseTime >= config.alerts.responseTime.warning.threshold && config.alerts.responseTime.warning.enabled) {
      alerts.push(sendAlert(
        'responseTime',
        'warning',
        config.alerts.responseTime.warning.message,
        metrics.responseTime,
        config.alerts.responseTime.warning.threshold
      ));
    }
  }

  // Check page health
  if (metrics.pageHealthPassRate !== undefined) {
    if (metrics.pageHealthPassRate < config.alerts.pageHealth.critical.threshold && config.alerts.pageHealth.critical.enabled) {
      alerts.push(sendAlert(
        'pageHealth',
        'critical',
        config.alerts.pageHealth.critical.message,
        metrics.pageHealthPassRate,
        config.alerts.pageHealth.critical.threshold
      ));
    } else if (metrics.pageHealthPassRate < config.alerts.pageHealth.warning.threshold && config.alerts.pageHealth.warning.enabled) {
      alerts.push(sendAlert(
        'pageHealth',
        'warning',
        config.alerts.pageHealth.warning.message,
        metrics.pageHealthPassRate,
        config.alerts.pageHealth.warning.threshold
      ));
    }
  }

  return alerts;
}

module.exports = { sendAlert, checkThresholds };
