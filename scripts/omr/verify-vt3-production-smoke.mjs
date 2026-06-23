// verify-vt3-production-smoke.mjs
// Fast production smoke for Vocal Trainer III. It checks deployed score artifacts,
// loads the app, selects Lida Rose Lead Dominant, and confirms OSMD active-note
// telemetry after playback starts.
import { chromium } from 'playwright';

const VT3_URL = process.env.VT3_URL || 'https://resetbiology.com/pitch-defender/vocal-trainer-3';
const origin = new URL(VT3_URL).origin;
const allowEmptyLibrary = process.env.VT3_ALLOW_EMPTY_LIBRARY === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await verifyArtifacts();
await verifyBrowser();

async function verifyArtifacts() {
  const [xmlText, health] = await Promise.all([
    fetchText(`${origin}/musicxml/lida-rose-lead.musicxml`),
    fetchJson(`${origin}/musicxml/lida-rose-lead-score-health.json`),
  ]);
  const fifths = [...new Set([...xmlText.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
  const pitched = [...xmlText.matchAll(/<note\b[\s\S]*?<\/note>/g)]
    .filter((m) => /<pitch>/.test(m[0]) && !/<rest\b/.test(m[0]) && !/<chord\s*\/?\s*>/.test(m[0]));
  assert(fifths.length === 1 && fifths[0] === -6, `expected deployed XML fifths=-6, got ${fifths.join(',') || 'none'}`);
  assert(pitched.length === 114, `expected deployed XML 114 pitched notes, got ${pitched.length}`);
  assert(health.keyFifths === -6, `expected health keyFifths=-6, got ${health.keyFifths}`);
  assert(health.noteCount === 114, `expected health noteCount=114, got ${health.noteCount}`);
  assert(Array.isArray(health.wholeNotes) && health.wholeNotes.map((n) => `${n.measure}:${n.pitch}`).join(' ') === '5:Cb4 9:Cb4',
    `unexpected health whole notes ${JSON.stringify(health.wholeNotes)}`);
  assert(Array.isArray(health.checks) && health.checks.every((c) => c.status === 'pass'),
    `health checks failing: ${JSON.stringify(health.checks)}`);
  console.log('artifact smoke PASS');
}

async function verifyBrowser() {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 820 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const text = m.text();
    if (/ScoreEngraving|aligned|drift/i.test(text)) console.log('[page]', text);
  });

  try {
    await page.goto(VT3_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('svg', { timeout: 25000 }).catch(() => {});
    await page.getByText(/Score PASS/i).first().waitFor({ timeout: 10000 });
    await page.getByText(/key -6/i).first().waitFor({ timeout: 10000 });
    await sleep(1500);

    await page.locator('summary', { hasText: /^\s*Library/ }).first().click({ timeout: 5000 }).catch(() => {});
    await sleep(300);
    for (const s of await page.locator('summary', { hasText: /Lead/ }).all()) {
      await s.click({ timeout: 1200 }).catch(() => {});
    }
    await sleep(300);
    try {
      await page.getByRole('button', { name: /Lida Rose.*Dominant/i }).first().click({ timeout: 6000 });
    } catch (e) {
      if (!allowEmptyLibrary) throw e;
      await page.waitForSelector('svg', { timeout: 10000 });
      console.log('ui score-health PASS (library item unavailable in local fallback mode)');
      return;
    }
    await page.getByText(/Score target\s+.*Lead\s+.*114/i).first().waitFor({ timeout: 10000 });
    console.log('ui score-health PASS');

    await page.getByRole('button', { name: /^Play/i }).first().click({ timeout: 6000 });
    await sleep(5600);
    const active = await page.evaluate(() => window.__VT3_SCORE_ACTIVE__ || null);
    assert(active && Number.isFinite(active.index), `expected active OSMD score note after playback, got ${JSON.stringify(active)}`);
    assert(active.index >= 0 && active.index < 114, `active index out of range: ${active.index}`);
    console.log(`active-note smoke PASS index=${active.index} pitch=${active.pitchName || active.pitchMidi}`);
  } finally {
    await browser.close();
  }
}

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  assert(r.ok, `${url} returned ${r.status}`);
  return r.text();
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  assert(r.ok, `${url} returned ${r.status}`);
  return r.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
