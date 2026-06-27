// Build a phone-first visual proof page for the five recovered OLIVER bars.
// Source authority is public/score/page-196.jpg..page-198.jpg. This script
// never modifies source scans; it crops them into an auditable review packet.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SCORE = path.join(ROOT, 'public', 'score');
const OUT = path.join(SCORE, 'lida-oliver-proof');
const IMG = path.join(OUT, 'img');

const crops = [
  crop('p196-system-1-full.png', 'page-196.jpg', 50, 360, 700, 320, 3, {
    rows: [rect(0, 178, 700, 80)],
    targets: [rect(620, 204, 58, 43)],
  }),
  crop('p196-system-2-full.png', 'page-196.jpg', 65, 690, 670, 285, 3, {
    rows: [rect(0, 134, 670, 66)],
    targets: [rect(592, 144, 58, 43)],
  }),
  crop('p197-label-proof.png', 'page-197.jpg', 75, 105, 670, 285, 3, {
    rows: [rect(0, 150, 670, 66)],
  }),
  crop('p197-m21-system.png', 'page-197.jpg', 75, 695, 670, 260, 3, {
    rows: [rect(0, 136, 670, 58)],
    targets: [rect(580, 132, 66, 48)],
  }),
  crop('p198-system-1-full.png', 'page-198.jpg', 75, 130, 670, 280, 3, {
    rows: [rect(0, 136, 670, 64)],
    targets: [rect(412, 126, 185, 64)],
  }),
  crop('p198-m29-system.png', 'page-198.jpg', 75, 420, 670, 245, 3, {
    rows: [rect(0, 136, 670, 60)],
    targets: [rect(390, 122, 92, 70)],
  }),
  crop('m5-oliver-zoom.png', 'page-196.jpg', 610, 540, 140, 105, 8, {
    targets: [rect(66, 35, 50, 34)],
  }),
  crop('m9-oliver-zoom.png', 'page-196.jpg', 585, 770, 170, 135, 8, {
    targets: [rect(48, 78, 55, 38)],
  }),
  crop('m21-oliver-zoom.png', 'page-197.jpg', 590, 810, 155, 105, 8, {
    targets: [rect(54, 34, 62, 40)],
  }),
  crop('m25-oliver-zoom.png', 'page-198.jpg', 500, 235, 225, 90, 9, {
    targets: [rect(55, 35, 120, 34)],
  }),
  crop('m29-oliver-zoom.png', 'page-198.jpg', 485, 540, 175, 95, 9, {
    targets: [rect(20, 4, 55, 44)],
  }),
];

const bars = [
  {
    id: 'm5',
    title: 'm5 - "sky"',
    page: 'page-196.jpg',
    sourceLine: 'First printed quartet system, OLIVER staff is labeled directly.',
    result: 'Ab3 whole note',
    pageRead: 'The notehead is on the top line of the bass staff. Bass-clef top line is A; six-flat key makes it A-flat.',
    chord: 'Cadence under confirmed Lead Cb4. With Bass below, Ab3 supplies the Ab-minor cadence tone.',
    full: 'p196-system-1-full.png',
    zoom: 'm5-oliver-zoom.png',
    rowBox: box(0, 178, 700, 80, 700, 320),
  },
  {
    id: 'm9',
    title: 'm9 - "shy"',
    page: 'page-196.jpg',
    sourceLine: 'Second printed quartet system, OLIVER staff is labeled directly.',
    result: 'Ab3 whole note',
    pageRead: 'The whole note sits on the OLIVER bass-staff top line: A-flat in six flats.',
    chord: 'Same cadence family as m5 under confirmed Lead Cb4; Ab3 is the baritone cadence tone.',
    full: 'p196-system-2-full.png',
    zoom: 'm9-oliver-zoom.png',
    rowBox: box(0, 134, 670, 66, 670, 285),
  },
  {
    id: 'm21',
    title: 'm21 - "name"',
    page: 'page-197.jpg',
    sourceLine: 'Page 197 labels the first system: JACEY, EWART, OLIVER, OLIN. In the target system, OLIVER is the third staff.',
    result: 'Ab3 whole note',
    pageRead: 'On the third staff of the target system, the held note is on the bass-staff top line with a printed flat reminder: Ab3.',
    chord: 'Cadence under confirmed Lead Cb4; Ab3 supplies the lower Ab-minor chord tone.',
    full: 'p197-m21-system.png',
    labelProof: 'p197-label-proof.png',
    zoom: 'm21-oliver-zoom.png',
    rowBox: box(0, 136, 670, 58, 670, 260),
  },
  {
    id: 'm25',
    title: 'm25 - "hop-ing"',
    page: 'page-198.jpg',
    sourceLine: 'First printed system on page 198 has OLIVER labeled directly.',
    result: 'Ab3 half, then Bb3 half',
    pageRead: 'First half: top-line A in six flats = Ab3. Second half: space above the bass staff = B, flat by key = Bb3.',
    chord: 'Other voices from source/page: first half has Db3, E-natural4, Ab4; second half has Eb3, Eb4, G4. OLIVER reads as Ab3 -> Bb3.',
    full: 'p198-system-1-full.png',
    zoom: 'm25-oliver-zoom.png',
    rowBox: box(0, 136, 670, 64, 670, 280),
  },
  {
    id: 'm29',
    title: 'm29 - "fine"',
    page: 'page-198.jpg',
    sourceLine: 'Page 198 labels OLIVER on system 1; in the target system, OLIVER remains the third staff.',
    result: 'Bb3 whole note with fermata',
    pageRead: 'The fermata whole note sits in the space above the bass staff. That space is B; six-flat key makes it Bb3.',
    chord: 'Cadential Eb sonority under confirmed Lead Eb4. Bb3 is the fifth of the Eb cadence, not the old Eb3 octave-double guess.',
    full: 'p198-m29-system.png',
    labelProof: 'p198-system-1-full.png',
    zoom: 'm29-oliver-zoom.png',
    rowBox: box(0, 136, 670, 60, 670, 245),
  },
];

fs.mkdirSync(IMG, { recursive: true });
await Promise.all(crops.map(async (c) => {
  let image = sharp(path.join(SCORE, c.source))
    .extract({ left: c.x, top: c.y, width: c.w, height: c.h })
    .resize({ width: c.w * c.scale, kernel: sharp.kernel.cubic });

  const overlay = overlaySvg(c);
  if (overlay) {
    image = image.composite([{ input: Buffer.from(overlay), blend: 'over' }]);
  }

  await image.png().toFile(path.join(IMG, c.name));
}));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lida Rose OLIVER Five-Bar Proof</title>
  <style>
    :root { color-scheme: dark; --bg:#0d0f12; --panel:#171b21; --ink:#f4f1e8; --muted:#b8b2a5; --line:#303846; --red:#ff4444; --green:#39d98a; --gold:#ffd166; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height:1.35; }
    header { position:sticky; top:0; z-index:5; background:rgba(13,15,18,.96); border-bottom:1px solid var(--line); padding:14px 14px 12px; }
    h1 { margin:0 0 8px; font-size:22px; letter-spacing:0; }
    .status { display:flex; align-items:center; gap:10px; font-weight:800; font-size:16px; }
    .pill { padding:8px 10px; border-radius:6px; border:1px solid var(--red); color:#fff; background:#4a1111; }
    .pill.locked { border-color:var(--green); background:#0f3f2a; }
    main { padding:14px; max-width:980px; margin:0 auto; }
    .rule { border:1px solid var(--gold); background:#26200f; color:#fff4c2; padding:10px; border-radius:6px; margin-bottom:14px; font-weight:650; }
    .card { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:12px; margin:0 0 18px; }
    h2 { margin:0 0 8px; font-size:22px; }
    .result { font-size:20px; font-weight:850; color:#fff; background:#123521; border:1px solid #2ec27e; padding:9px; border-radius:6px; margin-bottom:10px; }
    .grid { display:grid; gap:8px; }
    .fact { border-left:4px solid var(--gold); padding:8px 9px; background:#101319; color:var(--ink); }
    .fact strong { color:#fff; }
    .scroll { overflow-x:auto; border:1px solid var(--line); background:#050607; border-radius:6px; margin-top:10px; }
    .imageWrap { position:relative; min-width:720px; }
    .imageWrap img { display:block; width:100%; height:auto; }
    .rowBox { position:absolute; border:4px solid var(--red); background:rgba(255,68,68,.08); pointer-events:none; }
    .caption { color:var(--muted); font-size:13px; padding:7px 8px; border-top:1px solid var(--line); }
    .zoom { margin-top:10px; border:1px solid var(--line); border-radius:6px; background:#050607; overflow:hidden; }
    .zoom img { display:block; width:100%; height:auto; }
    .confirm { display:flex; gap:10px; align-items:flex-start; padding:10px 0 0; font-size:18px; font-weight:800; }
    input[type="checkbox"] { width:28px; height:28px; flex:0 0 28px; }
    .small { color:var(--muted); font-size:13px; }
    @media (max-width: 560px) {
      main { padding:10px; }
      .card { padding:10px; }
      h1 { font-size:20px; }
      h2 { font-size:20px; }
      .result { font-size:19px; }
      .imageWrap { min-width:780px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Lida Rose OLIVER five-bar proof</h1>
    <div class="status"><span id="lockPill" class="pill">NOT LOCKED - Jon visual signoff required</span><span id="count">0/5 confirmed</span></div>
  </header>
  <main>
    <div class="rule">Ground truth is the printed page. The red box marks the OLIVER staff row; the blue box marks the disputed note area. This page is a phone audit surface, not a lock by itself.</div>
    ${bars.map(renderBar).join('\n')}
  </main>
  <script>
    const ids = ${JSON.stringify(bars.map((b) => b.id))};
    const key = 'lida-oliver-proof-confirmed-v1';
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    function refresh() {
      let n = 0;
      for (const id of ids) {
        const el = document.querySelector('[data-confirm="' + id + '"]');
        el.checked = !!state[id];
        if (state[id]) n++;
      }
      document.getElementById('count').textContent = n + '/' + ids.length + ' confirmed';
      const pill = document.getElementById('lockPill');
      if (n === ids.length) {
        pill.textContent = 'ALL FIVE VISUALLY CONFIRMED ON THIS DEVICE';
        pill.classList.add('locked');
      } else {
        pill.textContent = 'NOT LOCKED - Jon visual signoff required';
        pill.classList.remove('locked');
      }
    }
    document.addEventListener('change', (event) => {
      const id = event.target && event.target.getAttribute('data-confirm');
      if (!id) return;
      state[id] = event.target.checked;
      localStorage.setItem(key, JSON.stringify(state));
      refresh();
    });
    refresh();
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'README.txt'), [
  'Lida Rose OLIVER five-bar phone proof',
  '',
  'Generated by scripts/omr/build-lida-oliver-phone-proof.mjs',
  'Source scans are public/score/page-196.jpg, page-197.jpg, page-198.jpg.',
  'Do not treat this as locked until Jon visually confirms the five cards.',
  '',
].join('\n'));

console.log(`WROTE ${path.relative(ROOT, path.join(OUT, 'index.html'))}`);
console.log(`WROTE ${crops.length} crop images in ${path.relative(ROOT, IMG)}`);

function crop(name, source, x, y, w, h, scale, overlay = {}) {
  return { name, source, x, y, w, h, scale, overlay };
}

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function overlaySvg(cropDef) {
  const rows = cropDef.overlay.rows || [];
  const targets = cropDef.overlay.targets || [];
  if (rows.length === 0 && targets.length === 0) return null;

  const width = cropDef.w * cropDef.scale;
  const height = cropDef.h * cropDef.scale;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  for (const row of rows) {
    parts.push(svgRect(row, cropDef.scale, '#ff2e2e', 'rgba(255,46,46,.08)', 'OLIVER STAFF'));
  }

  for (const target of targets) {
    parts.push(svgRect(target, cropDef.scale, '#00a6ff', 'rgba(0,166,255,.10)', 'TARGET NOTE'));
  }

  parts.push('</svg>');
  return parts.join('');
}

function svgRect(rectDef, scale, stroke, fill, label) {
  const x = rectDef.x * scale;
  const y = rectDef.y * scale;
  const w = rectDef.w * scale;
  const h = rectDef.h * scale;
  const sw = Math.max(8, scale * 2);
  const fontSize = Math.max(28, scale * 9);
  const textY = Math.max(fontSize + 6, y - 8);
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`,
    `<rect x="${x}" y="${textY - fontSize - 6}" width="${Math.min(w, label.length * fontSize * 0.68 + 18)}" height="${fontSize + 10}" fill="rgba(0,0,0,.78)"/>`,
    `<text x="${x + 9}" y="${textY}" fill="${stroke}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800">${label}</text>`,
  ].join('');
}

function box(x, y, w, h, baseW, baseH) {
  return {
    left: pct(x, baseW),
    top: pct(y, baseH),
    width: pct(w, baseW),
    height: pct(h, baseH),
  };
}

function pct(n, total) {
  return `${((n / total) * 100).toFixed(3)}%`;
}

function renderBar(bar) {
  return `<section class="card" id="${bar.id}">
    <h2>${escapeHtml(bar.title)}</h2>
    <div class="result">${escapeHtml(bar.result)}</div>
    <div class="grid">
      <div class="fact"><strong>Staff identity:</strong> ${escapeHtml(bar.sourceLine)}</div>
      <div class="fact"><strong>Printed-page read:</strong> ${escapeHtml(bar.pageRead)}</div>
      <div class="fact"><strong>Chord check:</strong> ${escapeHtml(bar.chord)}</div>
    </div>
    ${bar.labelProof ? imageBlock('Staff-order proof for this page', bar.labelProof, null) : ''}
    ${imageBlock('Full system crop - red box is OLIVER staff', bar.full, bar.rowBox)}
    <div class="zoom">
      <img src="img/${bar.zoom}" alt="${escapeHtml(bar.title)} OLIVER zoom">
      <div class="caption">Zoom on the target OLIVER note(s). Source: ${escapeHtml(bar.page)}.</div>
    </div>
    <label class="confirm"><input type="checkbox" data-confirm="${bar.id}"><span>I visually confirm ${escapeHtml(bar.title)} = ${escapeHtml(bar.result)}</span></label>
  </section>`;
}

function imageBlock(label, file, rowBox) {
  const overlay = rowBox ? `<div class="rowBox" style="left:${rowBox.left};top:${rowBox.top};width:${rowBox.width};height:${rowBox.height};"></div>` : '';
  return `<div class="scroll">
    <div class="imageWrap">
      <img src="img/${file}" alt="${escapeHtml(label)}">
      ${overlay}
    </div>
    <div class="caption">${escapeHtml(label)}</div>
  </div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
