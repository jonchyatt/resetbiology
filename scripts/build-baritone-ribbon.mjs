// Build ONE long horizontal baritone ribbon per song, from the CRISP source PDF.
// Uses the highlight-detected bands (path.json) only as a MAP of where the OLIVER
// line sits on each page, then crops that strip from a high-DPI render of the real
// page (no highlight), and joins all the strips end-to-end → public/<song>/ribbon.jpg
// + ribbon.json (per-strip widths, for timing the horizontal scroll to the audio).
import sharp from 'sharp';
import fs from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';

const PDF = 'C:/Users/jonch/Downloads/The Music Man - Complete.pdf';
const PDFTOPPM = 'C:/Users/jonch/AppData/Local/Microsoft/WinGet/Packages/oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe/poppler-25.07.0/Library/bin/pdftoppm.exe';
const DPI = 300;
const RIBBON_H = 360;          // final ribbon height (px)
const CROP_UP = 0.040;         // generous — capture high notes + a margin (don't cut edges)
const CROP_DOWN = 0.046;       // …and the lyrics below the staff
const LEAD_TRIM = 720;
                               // dropping the repeated clef+key-sig so it reads as ONE staff

// song → first PDF page (verified: Lida Rose printed 193 = PDF 196)
const SONG = process.argv[2] || 'lida-baritone';
const PDF_START = Number(process.argv[3] || 196);

async function renderPage(pdfPage) {
  const tmp = path.join(os.tmpdir(), `mmpage_${pdfPage}`);
  execFileSync(PDFTOPPM, ['-jpeg', '-r', String(DPI), '-f', String(pdfPage), '-l', String(pdfPage), PDF, tmp]);
  // pdftoppm names it tmp-<page>.jpg (zero-padded to page-count width)
  const dir = path.dirname(tmp), base = path.basename(tmp);
  const f = fs.readdirSync(dir).find((x) => x.startsWith(base) && x.endsWith('.jpg'));
  return path.join(dir, f);
}

const STAFF_TARGET = 0.46;   // every strip's staff centre is shifted to this fraction of RIBBON_H → the lines line up

// Find the FIRST staff (OLIVER, the top one) — its 5 lines are long horizontal dark
// runs; stop before the next staff (OLIN) so its lines don't drag the centre down.
async function findStaffCenter(buf, W, H) {
  const { data: g } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const thr = W * 0.45; const isLine = new Array(H);
  for (let y = 0; y < H; y++) { let d = 0; for (let x = 0; x < W; x++) if (g[y * W + x] < 120) d++; isLine[y] = d > thr; }
  let y = 0; while (y < H && !isLine[y]) y++;
  if (y >= H) return Math.round(H * STAFF_TARGET);
  const start = y; let last = y, gap = Math.round(H * 0.12);
  for (let z = y; z < H; z++) { if (isLine[z]) { if (z - last > gap) break; last = z; } }
  return Math.round((start + last) / 2);
}
// pad + re-window so the detected staff centre lands at STAFF_TARGET → all strips align
async function alignStaff(buf, W, H) {
  const c = await findStaffCenter(buf, W, H);
  const pad = H;
  const padded = await sharp(buf).extend({ top: pad, bottom: pad, left: 0, right: 0, background: '#ffffff' }).toBuffer();
  const startY = Math.max(0, pad + c - Math.round(H * STAFF_TARGET));
  return sharp(padded).extract({ left: 0, top: startY, width: W, height: H }).jpeg({ quality: 92 }).toBuffer();
}
// trim trailing white so strips butt together (keep a small margin)
async function trimTail(buf, W, H) {
  const { data: g } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  let last = W - 1;
  for (let x = W - 1; x >= 0; x--) { let d = 0; for (let y = 0; y < H; y++) if (g[y * W + x] < 120) d++; if (d > 2) { last = x; break; } }
  const keep = Math.min(W, last + 22);
  if (keep < W - 8) return { buf: await sharp(buf).extract({ left: 0, top: 0, width: keep, height: H }).jpeg({ quality: 92 }).toBuffer(), w: keep };
  return { buf, w: W };
}

const data = JSON.parse(fs.readFileSync(`public/${SONG}/path.json`, 'utf8'));
const strips = [];
for (let i = 0; i < data.pages.length; i++) {
  const page = data.pages[i];
  if (!page.bands.length) continue;            // rest page — no baritone strip
  const pdfPage = PDF_START + i;
  const img = await renderPage(pdfPage);
  const meta = await sharp(img).metadata();
  const W = meta.width, H = meta.height;
  for (const b of page.bands) {
    const top = Math.max(0, Math.round((b.yc - CROP_UP) * H));
    const bot = Math.min(H, Math.round((b.yc + CROP_DOWN) * H));
    const left = Math.max(0, Math.round(b.x0 * W));
    const right = Math.min(W, Math.round(b.x1 * W));
    let buf = await sharp(img)
      .extract({ left, top, width: right - left, height: bot - top })
      .resize({ height: RIBBON_H })            // normalize height; width scales
      .jpeg({ quality: 92 }).toBuffer();
    let m = await sharp(buf).metadata();
    buf = await alignStaff(buf, m.width, RIBBON_H);   // line every strip's staff up
    strips.push({ buf, w: m.width, page: i + 1, pdfPage });
  }
  console.log(`page ${i + 1} (pdf ${pdfPage}): ${page.bands.length} strips`);
}

// drop the repeated clef+key-sig from every strip after the first, then trim each
// strip's trailing white, so the systems flow into ONE continuous, gapless staff.
for (let i = 0; i < strips.length; i++) {
  const s = strips[i];
  if (i > 0 && s.w > LEAD_TRIM + 80) {
    s.buf = await sharp(s.buf).extract({ left: LEAD_TRIM, top: 0, width: s.w - LEAD_TRIM, height: RIBBON_H }).jpeg({ quality: 92 }).toBuffer();
    s.w -= LEAD_TRIM;
  }
  const t = await trimTail(s.buf, s.w, RIBBON_H);
  s.buf = t.buf; s.w = t.w;
}

// concat horizontally — no separator, one continuous staff
const SEP = 0;
const totalW = strips.reduce((s, x) => s + x.w, 0) + SEP * (strips.length - 1);
const composites = [];
let x = 0;
const boundaries = [];
for (const s of strips) {
  composites.push({ input: s.buf, left: x, top: 0 });
  boundaries.push({ x, w: s.w, page: s.page });
  x += s.w + SEP;
}
const ribbon = await sharp({ create: { width: totalW, height: RIBBON_H, channels: 3, background: '#ffffff' } })
  .composite(composites).jpeg({ quality: 90 }).toBuffer();
fs.writeFileSync(`public/${SONG}/ribbon.jpg`, ribbon);
fs.writeFileSync(`public/${SONG}/ribbon.json`, JSON.stringify({ w: totalW, h: RIBBON_H, strips: boundaries }, null, 0));
console.log(`\n→ public/${SONG}/ribbon.jpg  ${totalW}x${RIBBON_H}  (${strips.length} strips)`);
