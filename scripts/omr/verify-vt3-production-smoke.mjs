// verify-vt3-production-smoke.mjs
// Fast production smoke for Vocal Trainer III. It checks deployed score artifacts,
// loads the app, selects a Lida Rose generated part, and confirms OSMD active-note
// telemetry after playback starts.
import { chromium } from 'playwright';
import {
  EXPECTED_LEAD_NOTE_COUNT,
  LEAD_SCORE_VERSION,
  LEAD_SECTION_TRANSITIONS,
} from './lida-lead-printed-manifest.mjs';
import {
  BARITONE_SCORE_VERSION,
  EXPECTED_BARITONE_NOTE_COUNT,
} from './lida-baritone-printed-manifest.mjs';

const VT3_URL = process.env.VT3_URL || 'https://resetbiology.com/pitch-defender/vocal-trainer-3';
const origin = new URL(VT3_URL).origin;
const allowEmptyLibrary = process.env.VT3_ALLOW_EMPTY_LIBRARY === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOWED_FIFTHS = new Set([-6, ...LEAD_SECTION_TRANSITIONS.map((t) => t.nextKeyFifths)]);
const PART = process.env.VT3_PART || 'Lead';
const PARTS = {
  Lead: {
    slug: 'lead',
    expectedNoteCount: EXPECTED_LEAD_NOTE_COUNT,
    scoreVersion: LEAD_SCORE_VERSION,
    expectedWholeNotes: '5:Cb4 9:Cb4 13:Cb4 21:Cb4 29:Eb4',
    minPhraseCount: 8,
    allowedFifths: ALLOWED_FIFTHS,
    button: /(Lead.*Lida Rose.*Dominant|Lida Rose.*Lead Dominant)/i,
  },
  Baritone: {
    slug: 'baritone',
    expectedNoteCount: EXPECTED_BARITONE_NOTE_COUNT,
    scoreVersion: BARITONE_SCORE_VERSION,
    expectedWholeNotes: '',
    minPhraseCount: 6,
    allowedFifths: new Set([-6]),
    button: /(Baritone.*Lida Rose.*Dominant|Lida Rose.*Baritone Dominant)/i,
  },
};
const config = PARTS[PART];
assert(config, `unknown VT3_PART=${PART}; expected ${Object.keys(PARTS).join(', ')}`);

await verifyArtifacts();
await verifyBrowser();

async function verifyArtifacts() {
  const [xmlText, health] = await Promise.all([
    fetchText(`${origin}/musicxml/lida-rose-${config.slug}.musicxml`),
    fetchJson(`${origin}/musicxml/lida-rose-${config.slug}-score-health.json`),
  ]);
  const [allHealth, phrases, noteMap] = await Promise.all([
    fetchJson(`${origin}/musicxml/lida-rose-score-health.json`),
    fetchJson(`${origin}/musicxml/lida-rose-${config.slug}-phrases.json`),
    fetchJson(`${origin}/musicxml/lida-rose-${config.slug}-note-map.json`),
  ]);
  const fifths = [...new Set([...xmlText.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
  const pitched = [...xmlText.matchAll(/<note\b[\s\S]*?<\/note>/g)]
    .filter((m) => /<pitch>/.test(m[0]) && !/<rest\b/.test(m[0]) && !/<chord\s*\/?\s*>/.test(m[0]));
  assert(fifths.length > 0 && fifths.every((f) => config.allowedFifths.has(f)),
    `expected deployed XML fifths in ${[...config.allowedFifths].join(',')}, got ${fifths.join(',') || 'none'}`);
  assert(pitched.length === config.expectedNoteCount, `expected deployed XML ${config.expectedNoteCount} pitched notes, got ${pitched.length}`);
  assert(health.keyFifths === -6, `expected health keyFifths=-6, got ${health.keyFifths}`);
  assert(health.noteCount === config.expectedNoteCount, `expected health noteCount=${config.expectedNoteCount}, got ${health.noteCount}`);
  assert(health.scoreVersion === config.scoreVersion, `expected scoreVersion=${config.scoreVersion}, got ${health.scoreVersion}`);
  assert(Array.isArray(health.wholeNotes) && health.wholeNotes.map((n) => `${n.measure}:${n.pitch}`).join(' ') === config.expectedWholeNotes,
    `unexpected health whole notes ${JSON.stringify(health.wholeNotes)}`);
  assert(Array.isArray(health.checks) && health.checks.every((c) => c.status === 'pass'),
    `health checks failing: ${JSON.stringify(health.checks)}`);
  assert(Array.isArray(allHealth.parts) && allHealth.parts.length === 4,
    `expected 4 source parts, got ${JSON.stringify(allHealth.parts)}`);
  assert(Array.isArray(allHealth.checks) && allHealth.checks.every((c) => c.status === 'pass'),
    `all-part checks failing: ${JSON.stringify(allHealth.checks)}`);
  assert(Array.isArray(phrases.phrases) && phrases.phrases.length >= config.minPhraseCount,
    `expected phrase manifest, got ${JSON.stringify(phrases.phrases)}`);
  assert(Array.isArray(noteMap.notes) && noteMap.notes.length === config.expectedNoteCount,
    `expected ${config.expectedNoteCount} note-map entries, got ${noteMap.notes?.length}`);
  assert(noteMap.notes.every((n) => typeof n.phraseLabel === 'string' && n.phraseLabel.length > 0),
    `expected phrase labels on every note-map entry`);
  console.log(`${PART} artifact smoke PASS`);
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
    await sleep(1500);

    await page.locator('summary', { hasText: /^\s*Library/ }).first().click({ timeout: 5000 }).catch(() => {});
    await sleep(300);
    const partSummary = page.locator('summary', { hasText: new RegExp(`^\\s*${PART}\\b`, 'i') }).first();
    await partSummary.waitFor({ timeout: 15000 });
    const partOpen = await partSummary.evaluate((el) => el.parentElement?.hasAttribute('open') ?? false);
    if (!partOpen) {
      await partSummary.click({ timeout: 3000 }).catch(() => {});
    }
    await page.getByRole('button', { name: config.button }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    try {
      await page.getByRole('button', { name: config.button }).first().click({ timeout: 6000 });
    } catch (e) {
      if (!allowEmptyLibrary) throw e;
      console.log('ui score-health SKIP (library item unavailable in local fallback mode)');
      return;
    }
    await page.getByText(/Score PASS/i).first().waitFor({ timeout: 10000 });
    await page.getByText(/key -6/i).first().waitFor({ timeout: 10000 });
    await page.getByText(/4 parts/i).first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Report engraving/i }).first().waitFor({ timeout: 10000 });
    await page.getByText(new RegExp(`Score target\\s+.*${PART}\\s+.*${config.expectedNoteCount}`, 'i')).first().waitFor({ timeout: 10000 });
    console.log('ui score-health PASS');

    await page.getByRole('button', { name: /^Play/i }).first().click({ timeout: 6000 });
    await sleep(5600);
    const active = await page.evaluate(() => window.__VT3_SCORE_ACTIVE__ || null);
    assert(active && Number.isFinite(active.index), `expected active OSMD score note after playback, got ${JSON.stringify(active)}`);
    assert(active.index >= 0 && active.index < config.expectedNoteCount, `active index out of range: ${active.index}`);
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
