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
const CROP_UP = 0.024;
const CROP_DOWN = 0.016;

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
    const buf = await sharp(img)
      .extract({ left, top, width: right - left, height: bot - top })
      .resize({ height: RIBBON_H })            // normalize height; width scales
      .jpeg({ quality: 92 }).toBuffer();
    const m = await sharp(buf).metadata();
    strips.push({ buf, w: m.width, page: i + 1, pdfPage });
  }
  console.log(`page ${i + 1} (pdf ${pdfPage}): ${page.bands.length} strips`);
}

// concat horizontally with a thin separator
const SEP = 6;
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
