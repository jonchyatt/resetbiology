// verify-vt3-report-capture.mjs
// Reusable smoke for the VT3 "Report engraving" workflow. The report is the
// handoff artifact when the rendered OSMD score and source PDF/page image disagree.
import { chromium } from 'playwright';
import { EXPECTED_LEAD_NOTE_COUNT } from './lida-lead-printed-manifest.mjs';

const VT3_URL = process.env.VT3_URL || 'https://resetbiology.com/pitch-defender/vocal-trainer-3';

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 980 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await ctx.newPage();

try {
  await page.goto(VT3_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByText(/Score PASS/i).first().waitFor({ timeout: 20000 });
  await page.getByText(/key -6/i).first().waitFor({ timeout: 20000 });
  await page.getByText(/4 parts/i).first().waitFor({ timeout: 20000 });
  await page.locator('[data-vt3-score-panel="engraving"] svg').first().waitFor({ timeout: 30000 });
  await page.evaluate(() => localStorage.removeItem('vt3_engraving_reports_v1'));
  await page.getByRole('button', { name: /Report engraving/i }).first().click({ timeout: 10000 });
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('vt3_engraving_reports_v1');
    return raw && JSON.parse(raw).length > 0;
  }, { timeout: 10000 });

  const report = await page.evaluate(() => JSON.parse(localStorage.getItem('vt3_engraving_reports_v1') || '[]')[0]);
  assert(report && typeof report === 'object', 'missing report object');
  assert(report.title, 'missing report title');
  assert(Number.isFinite(report.timeSeconds), `missing timeSeconds: ${JSON.stringify(report)}`);
  assert(Number.isFinite(report.noteIndex) && report.noteIndex >= 1 && report.noteIndex <= EXPECTED_LEAD_NOTE_COUNT,
    `noteIndex out of range: ${report.noteIndex}`);
  assert(Number.isFinite(report.measure), `missing measure: ${JSON.stringify(report)}`);
  assert(Number.isFinite(report.page) && [196, 197, 198].includes(report.page),
    `unexpected page: ${report.page}`);
  assert(typeof report.pitch === 'string' && report.pitch.length > 0,
    `missing pitch: ${JSON.stringify(report)}`);
  assert(typeof report.phrase === 'string' && report.phrase.length > 0,
    `missing phrase: ${JSON.stringify(report)}`);
  assert(report.sourcePageImage === `/score/page-${report.page}.jpg`,
    `unexpected source image: ${report.sourcePageImage}`);
  assert(typeof report.svgSnapshot === 'string' && report.svgSnapshot.includes('<svg'),
    'missing SVG snapshot');
  assert(report.viewport?.width > 0 && report.viewport?.height > 0, 'missing viewport');

  console.log('engraving report capture PASS');
  console.log(JSON.stringify({
    noteIndex: report.noteIndex,
    measure: report.measure,
    page: report.page,
    pitch: report.pitch,
    phrase: report.phrase,
    svgChars: report.svgSnapshot.length,
  }));
} finally {
  await browser.close();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
