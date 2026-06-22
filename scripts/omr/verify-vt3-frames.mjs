// ════════════════════════════════════════════════════════════════════════════
// verify-vt3-frames.mjs — the REAL iterative-verify harness (Jon directive 2026-06-22:
// "stop bringing me broken stuff — screenshot 5-6 seconds, make a movie, have Argus watch").
// Plays the live page and captures a FRAME SEQUENCE + per-frame data so the bar's
// motion (smooth vs jumping), the notes-vs-audio, and the auto-scroll are all
// measurable — not guessed from 1-2 stills.
//   - 30 frames @ 0.5s = 15s of playback (covers the opening + the first line break)
//   - per frame: amber-bar left px + the score scroll-box scrollTop (jump/scroll proof)
// Output: data/vocal-trainer/runtime-logs/frames/f##.png + series.json
// Run from reset-biology-website:  node scripts/omr/verify-vt3-frames.mjs
// ════════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://resetbiology.com/pitch-defender/vocal-trainer-3';
const OUT = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/frames';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1320, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { const t = m.text(); if (/ScoreEngraving|aligned|drift/i.test(t)) console.log('[page]', t); });

console.log('goto', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('svg', { timeout: 25000 }).catch(() => {});
await sleep(3500);

// load Lida Rose · Lead Dominant
try {
  await page.locator('summary', { hasText: /^\s*Library/ }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(400);
  for (const s of await page.locator('summary', { hasText: /Lead/ }).all()) await s.click({ timeout: 1200 }).catch(() => {});
  await sleep(400);
  await page.getByRole('button', { name: /Lida Rose.*Dominant/i }).first().click({ timeout: 5000 });
  console.log('loaded Lida Rose Lead Dominant');
  await sleep(4000);
} catch (e) { console.log('load item failed:', e.message); }

// probe: amber-bar left + the score scroll-box scrollTop
const PROBE = `(() => {
  const divs = [...document.querySelectorAll('div')];
  const ov = divs.find(d => d.style && typeof d.style.background === 'string' && d.style.background.includes('251') && d.style.background.includes('191'));
  const sb = divs.find(d => { const s = getComputedStyle(d); return s.overflowY === 'auto' && d.querySelector('svg') && d.clientHeight > 100 && d.clientHeight < 460; });
  return JSON.stringify({
    barLeft: ov ? parseFloat(ov.style.left) : null,
    barDisp: ov ? ov.style.display : null,
    scrollTop: sb ? Math.round(sb.scrollTop) : null,
    scrollH: sb ? sb.scrollHeight : null,
    clientH: sb ? sb.clientHeight : null,
  });
})()`;

try { await page.getByRole('button', { name: /play/i }).first().click({ timeout: 4000 }); console.log('pressed Play'); }
catch (e) { console.log('play failed:', e.message); }

const series = [];
const N = 30;
for (let i = 0; i < N; i++) {
  await page.screenshot({ path: `${OUT}/f${String(i).padStart(2, '0')}.png` });
  let d = '{}'; try { d = await page.evaluate(PROBE); } catch {}
  series.push({ i, t: +(i * 0.5).toFixed(2), ...JSON.parse(d) });
  await sleep(500);
}
fs.writeFileSync(`${OUT}/series.json`, JSON.stringify(series, null, 1));

console.log('\n  t(s) | barLeft px | Δleft | scrollTop/scrollH | disp');
let prev = null;
for (const s of series) {
  const dl = (prev != null && s.barLeft != null) ? (s.barLeft - prev).toFixed(0) : '–';
  console.log(`  ${String(s.t).padStart(4)} | ${String(s.barLeft).padStart(9)} | ${String(dl).padStart(5)} | ${s.scrollTop}/${s.scrollH} | ${s.barDisp}`);
  if (s.barLeft != null) prev = s.barLeft;
}
console.log(`\nframes + series.json → ${OUT}`);
await browser.close();
