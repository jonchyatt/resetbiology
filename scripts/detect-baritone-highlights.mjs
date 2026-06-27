// Detect the yellow highlight bands (Jon's baritone marks) on each Lida Rose page
// → a normalized path the bouncing ball rides. Output: public/lida-baritone/path.json
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DIR = process.argv[2] || 'public/lida-baritone';
const URLBASE = '/' + DIR.replace(/^public\//, '');
// Pale-yellow highlight: high R+G, a clear R−B gap (rejects white where R≈G≈B),
// R≈G (yellow, not orange/green). Robust across scan + HEIC-converted shades.
const isYellow = (r, g, b) => r > 195 && g > 188 && (r - b) > 30 && Math.abs(r - g) < 40;

async function detect(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const rowCount = new Int32Array(H);
  const rowMinX = new Int32Array(H).fill(W);
  const rowMaxX = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      if (isYellow(data[i], data[i + 1], data[i + 2])) {
        rowCount[y]++;
        if (x < rowMinX[y]) rowMinX[y] = x;
        if (x > rowMaxX[y]) rowMaxX[y] = x;
      }
    }
  }
  const thresh = W * 0.2; // a band row spans a wide x-range
  const bands = [];
  let cur = null;
  for (let y = 0; y < H; y++) {
    if (rowCount[y] > thresh) {
      if (!cur) cur = { y0: y, y1: y, x0: rowMinX[y], x1: rowMaxX[y] };
      else { cur.y1 = y; cur.x0 = Math.min(cur.x0, rowMinX[y]); cur.x1 = Math.max(cur.x1, rowMaxX[y]); }
    } else if (cur) { if (cur.y1 - cur.y0 > 6) bands.push(cur); cur = null; }
  }
  if (cur && cur.y1 - cur.y0 > 6) bands.push(cur);
  // merge fragments of the same highlight band (notes/staff lines split a band into
  // pieces); any two bands whose vertical gap is < 2.5% of page height = one band.
  bands.sort((a, b) => a.y0 - b.y0);
  const merged = [];
  for (const b of bands) {
    const last = merged[merged.length - 1];
    if (last && (b.y0 - last.y1) < H * 0.025) {
      last.y1 = Math.max(last.y1, b.y1);
      last.x0 = Math.min(last.x0, b.x0);
      last.x1 = Math.max(last.x1, b.x1);
    } else merged.push({ ...b });
  }
  // normalize to 0..1 of the page
  return {
    w: W, h: H,
    bands: merged.map((b) => ({
      x0: +(b.x0 / W).toFixed(4), x1: +(b.x1 / W).toFixed(4),
      yc: +(((b.y0 + b.y1) / 2) / H).toFixed(4), bh: +((b.y1 - b.y0) / H).toFixed(4),
    })),
  };
}

const files = fs.readdirSync(DIR).filter((f) => /^page-\d+\.jpg$/.test(f)).sort();
const pages = [];
for (const f of files) {
  const d = await detect(path.join(DIR, f));
  pages.push({ file: `${URLBASE}/${f}`, ...d });
  console.log(`${f}: ${d.bands.length} bands → ${d.bands.map((b) => `y${b.yc}[${b.x0}-${b.x1}]`).join(' ')}`);
}
fs.writeFileSync(path.join(DIR, 'path.json'), JSON.stringify({ pages }, null, 0));
console.log(`\nwrote ${DIR}/path.json — ${pages.length} pages, ${pages.reduce((n, p) => n + p.bands.length, 0)} total bands`);
