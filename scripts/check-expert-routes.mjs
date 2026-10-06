#!/usr/bin/env node

const baseUrl = (process.env.RB_EXPERT_CHECK_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const experts = [
  'concierge', 'peptide', 'exercise', 'nutrition', 'breath', 'journal',
  'vision', 'nback', 'course', 'sales', 'onboarding', 'professor',
];

let failures = 0;
for (const expert of experts) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/experts/${expert}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'State your expert role in one sentence.' }),
    });
    const body = await response.json().catch(() => ({}));
    const latencyMs = Math.round(performance.now() - started);
    const model = response.headers.get('x-rb-brain-model') || body.model || 'unavailable';
    const keyOwner = response.headers.get('x-rb-brain-key-owner') || body.keyOwner || 'unavailable';
    console.log(`${expert}\tstatus=${response.status}\tmodel=${model}\tkey_owner=${keyOwner}\tlatency_ms=${latencyMs}`);
    if (!response.ok || model === 'unavailable' || keyOwner === 'unavailable') failures++;
  } catch (error) {
    failures++;
    console.log(`${expert}\tstatus=error\tmodel=unavailable\tkey_owner=unavailable\tlatency_ms=${Math.round(performance.now() - started)}\tdetail=${error.message}`);
  }
}

if (failures) process.exitCode = 1;
