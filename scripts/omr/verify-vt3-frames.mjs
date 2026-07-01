// verify-vt3-frames.mjs -- frame-sequence verification for VocalTrainer III.
// Plays the production page, loads a Lida Rose generated part, captures screenshots,
// and records active OSMD note telemetry over time.
//
// Output: C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/frames
// Run from reset-biology-website: node scripts/omr/verify-vt3-frames.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.VT3_URL || 'https://resetbiology.com/pitch-defender/vocal-trainer-3';
const PART = process.env.VT3_PART || 'Lead';
const VIEW = process.env.VT3_VIEW || 'together';
const PART_BUTTONS = {
  Tenor: /Tenor.*Lida Rose.*Dominant/i,
  Lead: /Lead.*Lida Rose.*Dominant/i,
  Baritone: /Baritone.*Lida Rose.*Dominant/i,
  Bass: /Bass.*Lida Rose.*Dominant/i,
};
const partButton = PART_BUTTONS[PART];
if (!partButton) throw new Error(`unknown VT3_PART=${PART}`);
const OUT_BASE = process.env.VT3_FRAMES_OUT || 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/frames';
const OUT = `${OUT_BASE}/${PART.toLowerCase()}-${VIEW}`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1320, height: 820 } });
const page = await ctx.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (/ScoreEngraving|aligned|drift/i.test(t)) console.log('[page]', t);
});

console.log('goto', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('svg', { timeout: 25000 }).catch(() => {});
await sleep(3500);

try {
  await page.locator('summary', { hasText: /^\s*Library/ }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(400);
  for (const s of await page.locator('summary', { hasText: new RegExp(PART) }).all()) {
    await s.click({ timeout: 1200 }).catch(() => {});
  }
  await sleep(400);
  await page.getByRole('button', { name: partButton }).first().click({ timeout: 5000 });
  console.log(`loaded Lida Rose ${PART} Dominant`);
  await sleep(4000);
} catch (e) {
  console.log('load item failed:', e.message);
}

if (VIEW === 'together') {
  await page.getByRole('button', { name: /Everybody together/i }).click({ timeout: 5000 });
  console.log('selected Everybody together view');
  await sleep(3500);
} else if (VIEW === 'engraved') {
  await page.getByRole('button', { name: /Engraved/i }).click({ timeout: 5000 }).catch(() => {});
  console.log('selected Engraved view');
  await sleep(2000);
} else if (VIEW === 'pages') {
  await page.getByRole('button', { name: /Pages/i }).click({ timeout: 5000 }).catch(() => {});
  console.log('selected Pages view');
  await sleep(1000);
}

const PROBE = `(() => {
  const divs = [...document.querySelectorAll('div')];
  const sb = divs.find(d => {
    const s = getComputedStyle(d);
    return s.overflowY === 'auto' && d.querySelector('svg') && d.scrollHeight > d.clientHeight + 4 && d.clientHeight > 150;
  });
  const active = window.__VT3_SCORE_ACTIVE__ || null;
  return JSON.stringify({
    activeIndex: active ? active.index : null,
    activePitch: active ? active.pitchName : null,
    activeMidi: active ? active.pitchMidi : null,
    highlightPart: active ? active.highlightPart : null,
    coloredNoteCount: active ? active.coloredNoteCount : null,
    cursorStep: active ? active.cursorStep : null,
    scoreTitle: document.querySelector('[data-vt3-score-panel="engraving"]')?.innerText?.split('\\n')[0] || null,
    svgCount: document.querySelectorAll('[data-vt3-score-panel="engraving"] svg').length,
    scrollTop: sb ? Math.round(sb.scrollTop) : null,
    scrollH: sb ? sb.scrollHeight : null,
    clientH: sb ? sb.clientHeight : null,
  });
})()`;

try {
  await page.getByRole('button', { name: /play/i }).first().click({ timeout: 4000 });
  console.log('pressed Play');
} catch (e) {
  console.log('play failed:', e.message);
}

const series = [];
const N = 40;
for (let i = 0; i < N; i++) {
  await page.screenshot({ path: `${OUT}/f${String(i).padStart(2, '0')}.png` });
  let d = '{}';
  try { d = await page.evaluate(PROBE); } catch {}
  series.push({ i, t: +(i * 1.5).toFixed(2), ...JSON.parse(d) });
  await sleep(1500);
}
fs.writeFileSync(`${OUT}/series.json`, JSON.stringify(series, null, 1));

console.log('\n  t(s) | note# | pitch | midi | part | colored | cursor | scrollTop/scrollH');
for (const s of series) {
  console.log(`  ${String(s.t).padStart(4)} | ${String(s.activeIndex).padStart(5)} | ${String(s.activePitch).padStart(5)} | ${String(s.activeMidi).padStart(4)} | ${String(s.highlightPart).padStart(8)} | ${String(s.coloredNoteCount).padStart(7)} | ${String(s.cursorStep).padStart(6)} | ${s.scrollTop}/${s.scrollH}`);
}
console.log(`\nframes + series.json -> ${OUT}`);
await browser.close();
