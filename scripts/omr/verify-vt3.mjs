// ════════════════════════════════════════════════════════════════════════════
// verify-vt3.mjs — autonomous prod verification via Playwright-isolated.
// Loads the LIVE VocalTrainer III in a throwaway Chromium (autoplay enabled, NOT
// Jon's authenticated Chrome → no Hawkeye gate), then:
//   1) screenshots the one-screen deck (layout co-location check),
//   2) captures the ScoreEngraving console signal — it builds the pitch-aligned
//      ordinals on load and warns ONLY if count != 113 (so NO warn = bar fix good),
//   3) best-effort: loads Lida Rose Lead Dominant + presses Play, screenshots the
//      bar mid-song (it advances because autoplay is allowed here).
// Run from reset-biology-website:  node scripts/omr/verify-vt3.mjs
// ════════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright';

const URL = 'https://resetbiology.com/pitch-defender/vocal-trainer-3';
const OUT = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1320, height: 1040 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

console.log('1) goto', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('svg', { timeout: 25000 }).catch(() => console.log('   (no <svg> within 25s — score may not have rendered)'));
await sleep(4500);
await page.screenshot({ path: `${OUT}/vt3-deck-1-initial.png` });
await page.screenshot({ path: `${OUT}/vt3-deck-full.png`, fullPage: true });
console.log('   ✓ screenshots: vt3-deck-1-initial.png (viewport) + vt3-deck-full.png (full page)');

// is the new layout live? marker text from the collapsed Library/drawer
const html = await page.content();
const newBuild = /saved templates and extraction tools|Mixing desk, plunk/.test(html);
console.log(`   new layout markers present: ${newBuild}`);

// 2) best-effort: load Lida Rose · Lead Dominant, then Play
try {
  await page.locator('summary', { hasText: /^\s*Library/ }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(500);
  // group summaries (e.g. "Lead (10)") — open anything mentioning Lead
  for (const s of await page.locator('summary', { hasText: /Lead/ }).all()) { await s.click({ timeout: 1500 }).catch(() => {}); }
  await sleep(500);
  const item = page.getByRole('button', { name: /Lida Rose.*Dominant/i }).first();
  if (await item.count()) {
    await item.scrollIntoViewIfNeeded().catch(() => {});
    await item.click({ timeout: 5000 });
    console.log('2) clicked a "Lida Rose … Dominant" library item');
    await sleep(4500);
  } else {
    console.log('2) no "Lida Rose … Dominant" button found (selectors may differ) — skipping load');
  }
} catch (e) { console.log('   load-item step failed:', e.message); }
await page.screenshot({ path: `${OUT}/vt3-deck-2-loaded.png`, fullPage: true }).catch(() => {});

// 3) Play and let the sung-out bar advance
try {
  const play = page.getByRole('button', { name: /play/i }).first();
  if (await play.count()) { await play.click({ timeout: 4000 }); console.log('3) pressed Play'); }
  await sleep(9000);
  await page.screenshot({ path: `${OUT}/vt3-deck-3-playing.png` });
  console.log('   ✓ screenshot: vt3-deck-3-playing.png (~9s in)');
  console.log('   playing to a later line (~54s) to test karaoke auto-scroll...');
  await sleep(45000);
  await page.screenshot({ path: `${OUT}/vt3-deck-4-late.png` });
  console.log('   ✓ screenshot: vt3-deck-4-late.png (~54s — bar should be auto-scrolled into view)');
} catch (e) { console.log('   play step failed:', e.message); }

console.log('\n=== ScoreEngraving / alignment console ===');
const rel = logs.filter((l) => /ScoreEngraving|aligned cursor|sync notes|drift|sing-out/i.test(l));
console.log(rel.length ? rel.join('\n') : '(no ScoreEngraving warn → ordinals aligned 1:1, drift fix holding)');
console.log('\n=== errors / pageerrors ===');
const errs = logs.filter((l) => /\[error\]|\[pageerror\]/i.test(l));
console.log(errs.length ? errs.join('\n') : '(none)');
console.log('\n=== last 20 console lines ===');
console.log(logs.slice(-20).join('\n'));

await browser.close();
console.log('\ndone');
