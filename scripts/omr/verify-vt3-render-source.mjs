// verify-vt3-render-source.mjs
// Visual QA pack for VT3 score truth: source page images vs rendered OSMD score.
// This is not a semantic OMR proof. It is a repeatable visual smoke that catches
// blank source assets, blank rendered scores, and gives a reviewable contact sheet
// when a human needs to compare the score page to the current engraving.
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const URL = process.env.VT3_URL || 'https://resetbiology.com/pitch-defender/vocal-trainer-3';
const OUT = process.env.VT3_RENDER_OUT || 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/render-source';
const PART = process.env.VT3_PART || 'Lead';
const PART_BUTTONS = {
  Lead: /Lead.*Lida Rose.*Dominant/i,
  Baritone: /Baritone.*Lida Rose.*Dominant/i,
};
const partButton = PART_BUTTONS[PART];
assert(partButton, `unknown VT3_PART=${PART}`);
const SOURCE_PAGES = [
  { page: 196, path: 'public/score/page-196.jpg' },
  { page: 197, path: 'public/score/page-197.jpg' },
  { page: 198, path: 'public/score/page-198.jpg' },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
const page = await ctx.newPage();

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('summary', { hasText: /^\s*Library/ }).first().click({ timeout: 5000 }).catch(() => {});
  for (const s of await page.locator('summary', { hasText: new RegExp(PART) }).all()) {
    await s.click({ timeout: 1200 }).catch(() => {});
  }
  await page.getByRole('button', { name: partButton }).first().click({ timeout: 6000 });
  await page.getByText(/Score PASS/i).first().waitFor({ timeout: 20000 });
  await page.getByText(/key -6/i).first().waitFor({ timeout: 20000 });
  await page.getByText(/4 parts/i).first().waitFor({ timeout: 20000 });
  await page.locator('[data-vt3-score-panel="engraving"] svg').first().waitFor({ timeout: 30000 });
  const panel = page.locator('[data-vt3-score-panel="engraving"]').first();
  const renderPath = path.join(OUT, 'vt3-rendered-engraving.png');
  await panel.screenshot({ path: renderPath });

  const sourceStats = [];
  for (const source of SOURCE_PAGES) {
    assert(fs.existsSync(source.path), `missing source page ${source.path}`);
    sourceStats.push({ page: source.page, path: source.path, ...(await imageStats(source.path)) });
  }
  const renderStats = await imageStats(renderPath);
  assert(renderStats.stdev > 3, `render looks blank; stdev=${renderStats.stdev.toFixed(2)}`);
  for (const stat of sourceStats) {
    assert(stat.stdev > 3, `source page ${stat.page} looks blank; stdev=${stat.stdev.toFixed(2)}`);
  }

  const diff = await resizedDiff(SOURCE_PAGES[0].path, renderPath);
  const contactPath = path.join(OUT, 'vt3-render-source-contact.png');
  await writeContactSheet([...SOURCE_PAGES.map((p) => p.path), renderPath], contactPath);

  const manifest = {
    url: URL,
    part: PART,
    createdAt: new Date().toISOString(),
    sourceStats,
    render: { path: renderPath, ...renderStats },
    resizedDiffVsPage196: diff,
    contactSheet: contactPath,
    checks: [
      { id: 'source-pages-nonblank', status: 'pass', detail: SOURCE_PAGES.map((p) => String(p.page)).join(',') },
      { id: 'render-nonblank', status: 'pass', detail: `stdev=${renderStats.stdev.toFixed(2)}` },
      { id: 'review-pack-written', status: 'pass', detail: contactPath },
    ],
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('render/source smoke PASS');
  console.log(`render: ${renderPath}`);
  console.log(`contact: ${contactPath}`);
  console.log(`diff mean abs vs page196: ${diff.meanAbs.toFixed(2)}`);
} finally {
  await browser.close();
}

async function imageStats(file) {
  const img = sharp(file);
  const metadata = await img.metadata();
  const stats = await img.stats();
  const stdev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
  const mean = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
  return { width: metadata.width, height: metadata.height, mean, stdev };
}

async function resizedDiff(a, b) {
  const width = 900;
  const height = 900;
  const [aa, bb] = await Promise.all([
    sharp(a).resize(width, height, { fit: 'contain', background: '#ffffff' }).grayscale().raw().toBuffer(),
    sharp(b).resize(width, height, { fit: 'contain', background: '#ffffff' }).grayscale().raw().toBuffer(),
  ]);
  let sum = 0;
  for (let i = 0; i < aa.length; i++) sum += Math.abs(aa[i] - bb[i]);
  return { width, height, meanAbs: sum / aa.length };
}

async function writeContactSheet(files, outPath) {
  const thumbs = [];
  for (const file of files) {
    const input = await sharp(file)
      .resize({ height: 620, fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
    const meta = await sharp(input).metadata();
    thumbs.push({ input, width: meta.width ?? 0, height: meta.height ?? 0 });
  }
  const gutter = 16;
  const width = thumbs.reduce((sum, t) => sum + t.width, 0) + gutter * (thumbs.length + 1);
  const height = 660;
  let left = gutter;
  const composite = thumbs.map((t) => {
    const item = { input: t.input, left, top: 20 };
    left += t.width + gutter;
    return item;
  });
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#f8fafc',
    },
  }).composite(composite).png().toFile(outPath);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
