// build-lida-visual-audit.mjs
// Builds a measure-by-measure visual audit pack for VT3 Lida Rose.
//
// The pack ties each corrected generated measure to a zoomed crop of the
// printed score, with neighboring-bar context. It is intentionally independent
// of audio: the printed score and corrected MusicXML are the source of truth.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';
import {
  EXPECTED_LEAD_NOTE_COUNT,
  PRINTED_LEAD_AUDIT_MEASURES,
} from './lida-lead-printed-manifest.mjs';
import {
  EXPECTED_BARITONE_NOTE_COUNT,
  PRINTED_BARITONE_AUDIT_MEASURES,
} from './lida-baritone-printed-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SOURCE = path.join(__dirname, 'source');
const SCORE = path.join(ROOT, 'public', 'score');
const PUBLIC_MUSICXML = path.join(ROOT, 'public', 'musicxml');
const DEFAULT_OUT = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/lida-visual-audit';
const OUT = path.resolve(process.env.LIDA_VISUAL_AUDIT_OUT || DEFAULT_OUT);
const SAFE_OUT_ROOT = path.resolve('C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs');

const LCM = 12;
const FULL_MEASURE_TICKS = LCM * 4;
const STAFF_HEIGHT_UNITS = 40;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const PARTS = [
  {
    part: 'Lead',
    slug: 'lead',
    expectedNoteCount: EXPECTED_LEAD_NOTE_COUNT,
    auditMeasures: PRINTED_LEAD_AUDIT_MEASURES,
    pages: [
      { page: 196, file: 'lida-196.xml', staff: 'P3' },
      { page: 197, file: 'lida-197.xml', staff: 'P2' },
      { page: 198, file: 'lida-198.xml', staff: 'P2' },
    ],
  },
  {
    part: 'Baritone',
    slug: 'baritone',
    expectedNoteCount: EXPECTED_BARITONE_NOTE_COUNT,
    auditMeasures: PRINTED_BARITONE_AUDIT_MEASURES,
    pages: [
      { page: 196, file: 'lida-196.xml', staff: 'P4' },
      { page: 197, file: 'lida-197.xml', staff: 'P3' },
      { page: 198, file: 'lida-198.xml', staff: 'P3' },
    ],
  },
];

const MANUAL_CROPS = new Map([
  ['Lead:35', {
    page: 199,
    reason: 'generated transition measure is printed on page 199 Ewart staff; current source XML set stops at page 198',
    rect: { left: 92, top: 258, width: 225, height: 88 },
  }],
]);

assert(OUT.startsWith(SAFE_OUT_ROOT + path.sep) || OUT === SAFE_OUT_ROOT,
  `refusing to rewrite visual audit outside ${SAFE_OUT_ROOT}: ${OUT}`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const pageCache = new Map();
const manifest = {
  version: 'lida-visual-audit-v1',
  createdAt: new Date().toISOString(),
  outDir: OUT,
  source: 'corrected MusicXML measure stream plus printed-score page crops',
  notes: [
    'Each crop intentionally includes neighboring-bar context.',
    'Audio is not used for note or rhythm authority.',
    'Manual crops are explicit when the committed OMR source XML lacks the printed page.',
  ],
  parts: [],
  entries: [],
  checks: [],
};

for (const cfg of PARTS) {
  const partDir = path.join(OUT, cfg.slug);
  fs.mkdirSync(partDir, { recursive: true });
  const entries = await buildPart(cfg, partDir);
  const noteCount = entries.reduce((sum, e) => sum + e.pitched.length, 0);
  manifest.parts.push({
    part: cfg.part,
    slug: cfg.slug,
    measures: entries.length,
    noteCount,
    expectedNoteCount: cfg.expectedNoteCount,
    auditMeasures: cfg.auditMeasures.map((m) => m.measure),
  });
  manifest.entries.push(...entries);
}

manifest.checks.push({
  id: 'measure-crops-written',
  status: 'pass',
  detail: `${manifest.entries.length} crops`,
});
manifest.checks.push({
  id: 'part-note-counts',
  status: manifest.parts.every((p) => p.noteCount === p.expectedNoteCount) ? 'pass' : 'fail',
  detail: manifest.parts.map((p) => `${p.part} ${p.noteCount}/${p.expectedNoteCount}`).join('; '),
});

await writeIndex(manifest);
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log('Lida visual audit pack written');
console.log(`manifest: ${path.join(OUT, 'manifest.json')}`);
console.log(`index: ${path.join(OUT, 'index.html')}`);
for (const part of manifest.parts) {
  console.log(`${part.part}: ${part.measures} measure crops, ${part.noteCount}/${part.expectedNoteCount} notes`);
}

async function buildPart(cfg, partDir) {
  const generated = generatedMeasures(cfg.slug);
  const auditMeasureSet = new Set(cfg.auditMeasures.map((m) => m.measure));
  const pages = [];
  let globalMeasure = 0;

  for (const pageCfg of cfg.pages) {
    const pageXml = fs.readFileSync(path.join(SOURCE, pageCfg.file), 'utf8');
    const pageImage = await loadPage(pageCfg.page);
    const layout = buildPageLayout(pageXml, pageImage);
    const rawPartMeasures = rawMeasuresForPart(pageXml, pageCfg.staff);
    const sourceDivisions = Number((getPartInner(pageXml, pageCfg.staff).match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    const factor = LCM / sourceDivisions;
    let normalized = rawPartMeasures
      .map((measure) => scaleMeasureDurations(measure.xml, factor))
      .map(normalizeLeadMeasure);
    normalized = applyLeadMeasureCorrections(String(pageCfg.page), normalized, { part: cfg.part, divisions: LCM });

    let activeSystem = null;
    const measures = [];
    for (const measureXml of normalized) {
      const measureHadNoNotes = !/<note\b/.test(measureXml);
      const nextGlobalMeasure = globalMeasure + 1;
      if (measureHadNoNotes && !generated.has(nextGlobalMeasure)) {
        measures.push({ measureXml, noteLess: true });
        continue;
      }
      const localMeasure = Number((measureXml.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1]);
      const manualKey = `${cfg.part}:${globalMeasure + 1}`;
      const manual = MANUAL_CROPS.get(manualKey);
      const printedBreak = /<print\b/.test(measureXml);
      if (printedBreak && layout.systemsByStartLocal.has(localMeasure)) {
        activeSystem = layout.systemsByStartLocal.get(localMeasure);
      } else if (!activeSystem) {
        activeSystem = layout.systemForLocal(localMeasure);
      }
      const widthUnits = Number((measureXml.match(/<measure\b[^>]*width="([^"]+)"/) || [])[1] || 120);
      const x0Units = activeSystem?.cursorUnits ?? 0;
      const x1Units = x0Units + widthUnits;
      if (activeSystem) activeSystem.cursorUnits = x1Units;

      globalMeasure++;
      const correctedMeasureXml = fillInteriorRestIfNeeded(measureXml);
      const expectedSummary = summarizeMeasure(
        correctedMeasureXml.replace(/<measure number="[^"]*"/, `<measure number="${globalMeasure}"`),
        globalMeasure,
      );
      const generatedSummary = generated.get(globalMeasure);
      assert(generatedSummary, `${cfg.part} generated MusicXML missing measure ${globalMeasure}`);
      assert(noteSummary(generatedSummary.pitched) === noteSummary(expectedSummary.pitched),
        `${cfg.part} m${globalMeasure}: corrected source and generated MusicXML differ`);

      measures.push({
        part: cfg.part,
        slug: cfg.slug,
        globalMeasure,
        localMeasure,
        page: manual?.page ?? pageCfg.page,
        staff: pageCfg.staff,
        systemIndex: activeSystem?.index ?? null,
        x0Units,
        x1Units,
        staffTopUnits: activeSystem?.partTopUnits[pageCfg.staff] ?? null,
        pageLayout: layout,
        manual,
        pitched: expectedSummary.pitched,
        durationBeats: round3(expectedSummary.durationTicks / LCM),
        restBeats: round3(expectedSummary.restTicks / LCM),
        noteSummary: noteSummary(expectedSummary.pitched),
        auditMeasure: auditMeasureSet.has(globalMeasure),
      });
    }

    const activeMeasures = measures.filter((m) => !m.noteLess);
    pages.push({ pageCfg, measures: activeMeasures });
  }

  const allMeasures = pages.flatMap((p) => p.measures);
  const entries = [];
  for (const entry of allMeasures) {
    const pageGroup = allMeasures.filter((m) => (
      m.page === entry.page &&
      m.systemIndex === entry.systemIndex &&
      m.slug === entry.slug &&
      !m.manual
    ));
    const pageImage = await loadPage(entry.page);
    const crop = entry.manual
      ? entry.manual.rect
      : measureContextCrop(entry, pageGroup, pageImage);
    const fileName = `${cfg.slug}-m${String(entry.globalMeasure).padStart(3, '0')}-p${entry.page}${entry.auditMeasure ? '-AUDIT' : ''}.png`;
    const cropPath = path.join(partDir, fileName);
    const clamped = clampCrop(crop, pageImage.width, pageImage.height);
    await sharp(pageImage.path).extract(clamped).png().toFile(cropPath);
    const stats = await imageStats(cropPath);

    entries.push({
      part: entry.part,
      slug: entry.slug,
      measure: entry.globalMeasure,
      page: entry.page,
      staff: entry.staff,
      localMeasure: entry.localMeasure,
      systemIndex: entry.systemIndex,
      auditMeasure: entry.auditMeasure,
      manualCrop: !!entry.manual,
      manualReason: entry.manual?.reason,
      cropPath,
      cropRelativePath: path.relative(OUT, cropPath).replace(/\\/g, '/'),
      crop: clamped,
      clamped: JSON.stringify(crop) !== JSON.stringify(clamped),
      pitched: entry.pitched,
      noteSummary: entry.noteSummary,
      durationBeats: entry.durationBeats,
      restBeats: entry.restBeats,
      stats,
    });
  }

  return entries;
}

function buildPageLayout(xml, pageImage) {
  const pageWidth = Number((xml.match(/<page-width>([^<]+)<\/page-width>/) || [])[1]);
  const pageHeight = Number((xml.match(/<page-height>([^<]+)<\/page-height>/) || [])[1]);
  const topMargin = Number((xml.match(/<top-margin>([^<]+)<\/top-margin>/) || [])[1] || 80);
  const partIds = [...xml.matchAll(/<part id="([^"]+)">/g)].map((m) => m[1]);
  const rawByPart = new Map(partIds.map((id) => [id, rawMeasuresForPart(xml, id)]));
  const targetPrints = rawByPart.get(partIds[0])
    .filter((m) => /<print\b/.test(m.xml))
    .map((m) => m.localMeasure);

  const systems = [];
  let previous = null;
  for (const local of targetPrints) {
    const firstPartMeasure = measureByLocal(rawByPart.get(partIds[0]), local);
    const systemLayout = parseSystemLayout(firstPartMeasure?.xml || '');
    const staffDistances = {};
    for (let i = 1; i < partIds.length; i++) {
      const partMeasure = measureByLocal(rawByPart.get(partIds[i]), local);
      staffDistances[partIds[i]] = parseStaffDistance(partMeasure?.xml || '') ?? 75;
    }
    const systemHeightUnits = systemHeight(partIds, staffDistances);
    let firstStaffTopUnits;
    if (!previous) {
      firstStaffTopUnits = topMargin + (systemLayout.topSystemDistance ?? 0);
    } else {
      firstStaffTopUnits = previous.firstStaffTopUnits + previous.systemHeightUnits + (systemLayout.systemDistance ?? 110);
    }
    const partTopUnits = {};
    let y = firstStaffTopUnits;
    partTopUnits[partIds[0]] = y;
    for (let i = 1; i < partIds.length; i++) {
      y += STAFF_HEIGHT_UNITS + (staffDistances[partIds[i]] ?? 75);
      partTopUnits[partIds[i]] = y;
    }
    const system = {
      index: systems.length + 1,
      startLocal: local,
      leftUnits: systemLayout.leftMargin ?? 150,
      rightUnits: pageWidth - (systemLayout.rightMargin ?? 150),
      cursorUnits: systemLayout.leftMargin ?? 150,
      firstStaffTopUnits,
      systemHeightUnits,
      partTopUnits,
    };
    systems.push(system);
    previous = system;
  }

  const systemsByStartLocal = new Map(systems.map((s) => [s.startLocal, s]));
  return {
    pageWidth,
    pageHeight,
    imageWidth: pageImage.width,
    imageHeight: pageImage.height,
    scaleX: pageImage.width / pageWidth,
    scaleY: pageImage.height / pageHeight,
    systems,
    systemsByStartLocal,
    systemForLocal(local) {
      let found = systems[0] ?? null;
      for (const system of systems) {
        if (system.startLocal <= local) found = system;
      }
      return found;
    },
  };
}

function measureContextCrop(entry, pageGroup, pageImage) {
  const layout = entry.pageLayout;
  const sameSystem = pageGroup.sort((a, b) => a.globalMeasure - b.globalMeasure);
  const idx = sameSystem.findIndex((m) => m.globalMeasure === entry.globalMeasure);
  const prev = idx > 0 ? sameSystem[idx - 1] : null;
  const next = idx >= 0 && idx < sameSystem.length - 1 ? sameSystem[idx + 1] : null;
  const x0Units = prev ? prev.x0Units : entry.x0Units - 100;
  const x1Units = next ? next.x1Units : entry.x1Units + 100;
  const staffTop = entry.staffTopUnits;
  assert(Number.isFinite(staffTop), `${entry.part} m${entry.globalMeasure}: missing staff top`);

  const left = Math.floor(x0Units * layout.scaleX) - 8;
  const right = Math.ceil(x1Units * layout.scaleX) + 8;
  const top = Math.floor(staffTop * layout.scaleY) - 42;
  const bottom = Math.ceil((staffTop + STAFF_HEIGHT_UNITS) * layout.scaleY) + 76;
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function generatedMeasures(slug) {
  const xml = fs.readFileSync(path.join(PUBLIC_MUSICXML, `lida-rose-${slug}.musicxml`), 'utf8');
  const out = new Map();
  for (const m of xml.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    out.set(Number(m[1]), summarizeMeasure(m[0], Number(m[1])));
  }
  return out;
}

function rawMeasuresForPart(xml, partId) {
  return (getPartInner(xml, partId).match(/<measure\b[\s\S]*?<\/measure>/g) || []).map((measureXml) => ({
    xml: measureXml,
    localMeasure: Number((measureXml.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1]),
  }));
}

function getPartInner(xml, id) {
  for (const partBlock of xml.split('<part id="').slice(1)) {
    const match = partBlock.match(/^([^"]+)"/);
    if (!match || match[1] !== id) continue;
    const end = partBlock.indexOf('</part>');
    if (end < 0) throw new Error(`part ${id}: missing </part>`);
    return partBlock.slice(partBlock.indexOf('>') + 1, end);
  }
  throw new Error(`part ${id} not found`);
}

function measureByLocal(measures, local) {
  return measures.find((m) => m.localMeasure === local);
}

function parseSystemLayout(xml) {
  return {
    leftMargin: numberTag(xml, 'left-margin'),
    rightMargin: numberTag(xml, 'right-margin'),
    topSystemDistance: numberTag(xml, 'top-system-distance'),
    systemDistance: numberTag(xml, 'system-distance'),
  };
}

function parseStaffDistance(xml) {
  return numberTag(xml, 'staff-distance');
}

function numberTag(xml, tag) {
  const value = (xml.match(new RegExp(`<${tag}>([^<]+)<\\/${tag}>`)) || [])[1];
  return value == null ? null : Number(value);
}

function systemHeight(partIds, staffDistances) {
  let height = STAFF_HEIGHT_UNITS;
  for (let i = 1; i < partIds.length; i++) {
    height += STAFF_HEIGHT_UNITS + (staffDistances[partIds[i]] ?? 75);
  }
  return height;
}

function scaleMeasureDurations(xml, factor) {
  return xml
    .replace(/<duration>(\d+)<\/duration>/g, (_, n) => `<duration>${Number(n) * factor}</duration>`)
    .replace(/<divisions>\d+<\/divisions>/g, `<divisions>${LCM}</divisions>`);
}

function fillInteriorRestIfNeeded(xml) {
  if (/<note\b/.test(xml)) return xml;
  return xml.replace(/<\/measure>$/, `  <note><rest measure="yes"/><duration>${FULL_MEASURE_TICKS}</duration><voice>1</voice></note>\n    </measure>`);
}

function summarizeMeasure(xml, measure) {
  const notes = [...xml.matchAll(/<note\b[\s\S]*?<\/note>/g)].map((m) => m[0]);
  const pitched = [];
  let durationTicks = 0;
  let restTicks = 0;
  for (const noteXml of notes) {
    if (/<chord\s*\/?\s*>/.test(noteXml)) continue;
    const duration = Number((noteXml.match(/<duration>(\d+)<\/duration>/) || [])[1] || 0);
    durationTicks += duration;
    if (/<rest\b/.test(noteXml)) {
      restTicks += duration;
      continue;
    }
    const pitch = extractPitch(noteXml);
    if (!pitch) continue;
    const dots = (noteXml.match(/<dot\s*\/>/g) || []).length;
    const accidental = (noteXml.match(/<accidental(?:\s[^>]*)?>([^<]+)<\/accidental>/) || [])[1] || null;
    pitched.push({
      pitch,
      midi: midiFromNoteXml(noteXml),
      durationTicks: duration,
      beats: round3(duration / LCM),
      type: (noteXml.match(/<type>([^<]+)<\/type>/) || [])[1] || null,
      ...(dots ? { dots } : {}),
      ...(accidental ? { accidental } : {}),
      tieStart: /<tie type="start"\/>/.test(noteXml) || /<tied type="start"/.test(noteXml),
      tieStop: /<tie type="stop"\/>/.test(noteXml) || /<tied type="stop"/.test(noteXml),
    });
  }
  return { measure, durationTicks, restTicks, pitched };
}

function extractPitch(noteXml) {
  const pitch = noteXml.match(/<pitch>[\s\S]*?<step>([A-G])<\/step>[\s\S]*?(?:<alter>(-?\d+)<\/alter>[\s\S]*?)?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/);
  if (!pitch) return null;
  return spelledPitch(pitch[1], pitch[2] ? Number(pitch[2]) : 0, pitch[3]);
}

function midiFromNoteXml(noteXml) {
  const pitch = noteXml.match(/<pitch>[\s\S]*?<step>([A-G])<\/step>[\s\S]*?(?:<alter>(-?\d+)<\/alter>[\s\S]*?)?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/);
  if (!pitch) return null;
  return (Number(pitch[3]) + 1) * 12 + SEMI[pitch[1]] + (pitch[2] ? Number(pitch[2]) : 0);
}

function spelledPitch(step, alter, octave) {
  const accidentals = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
  return `${step}${accidentals[alter] ?? `(${alter})`}${octave}`;
}

function noteSummary(notes) {
  return notes.map((n) => {
    const dots = n.dots ? `.${n.dots}` : '';
    const accidental = n.accidental ? `:${n.accidental}` : '';
    const tie = n.tieStart ? ':tie-start' : n.tieStop ? ':tie-stop' : '';
    return `${n.pitch}/${n.beats}/${n.type || '?'}${dots}${accidental}${tie}`;
  }).join(' ');
}

async function loadPage(page) {
  if (pageCache.has(page)) return pageCache.get(page);
  const pagePath = path.join(SCORE, `page-${page}.jpg`);
  assert(fs.existsSync(pagePath), `missing printed page image ${pagePath}`);
  const meta = await sharp(pagePath).metadata();
  const entry = { page, path: pagePath, width: meta.width, height: meta.height };
  pageCache.set(page, entry);
  return entry;
}

function clampCrop(rect, maxWidth, maxHeight) {
  const left = Math.max(0, Math.min(maxWidth - 1, Math.round(rect.left)));
  const top = Math.max(0, Math.min(maxHeight - 1, Math.round(rect.top)));
  const right = Math.max(left + 1, Math.min(maxWidth, Math.round(rect.left + rect.width)));
  const bottom = Math.max(top + 1, Math.min(maxHeight, Math.round(rect.top + rect.height)));
  return { left, top, width: right - left, height: bottom - top };
}

async function imageStats(file) {
  const img = sharp(file);
  const metadata = await img.metadata();
  const stats = await img.grayscale().stats();
  const channel = stats.channels[0];
  const { data, info } = await sharp(file).grayscale().raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  for (const value of data) {
    if (value < 150) dark++;
  }
  return {
    width: metadata.width,
    height: metadata.height,
    mean: round3(channel.mean),
    stdev: round3(channel.stdev),
    darkRatio: round5(dark / (info.width * info.height)),
  };
}

async function writeIndex(pack) {
  const groups = new Map();
  for (const entry of pack.entries) {
    const key = `${entry.part} page ${entry.page}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const sections = [...groups.entries()].map(([label, entries]) => `
    <section>
      <h2>${escapeHtml(label)}</h2>
      <div class="grid">
        ${entries.map((entry) => `
          <article class="${entry.auditMeasure ? 'audit' : ''}">
            <h3>${entry.part} m${entry.measure}${entry.auditMeasure ? ' audit' : ''}${entry.manualCrop ? ' manual crop' : ''}</h3>
            <img src="${entry.cropRelativePath}" alt="${entry.part} measure ${entry.measure}">
            <p>${escapeHtml(entry.noteSummary || '(rest only)')}</p>
            <p class="meta">page ${entry.page}; local ${entry.localMeasure}; duration ${entry.durationBeats}; dark ${entry.stats.darkRatio}</p>
            ${entry.manualReason ? `<p class="warn">${escapeHtml(entry.manualReason)}</p>` : ''}
          </article>
        `).join('\n')}
      </div>
    </section>
  `).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Lida Rose Visual Audit</title>
  <style>
    body { margin: 24px; font: 14px/1.4 system-ui, sans-serif; color: #111827; background: #f8fafc; }
    h1, h2, h3 { margin: 0 0 10px; }
    section { margin: 28px 0; }
    .summary { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 24px; }
    .pill { border: 1px solid #cbd5e1; border-radius: 999px; padding: 6px 10px; background: white; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 14px; }
    article { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: white; }
    article.audit { border-color: #d97706; box-shadow: inset 4px 0 #f59e0b; }
    img { width: 100%; background: white; border: 1px solid #e5e7eb; }
    p { margin: 8px 0 0; }
    .meta { color: #64748b; font-size: 12px; }
    .warn { color: #92400e; }
  </style>
</head>
<body>
  <h1>Lida Rose Visual Audit</h1>
  <div class="summary">
    ${pack.parts.map((p) => `<span class="pill">${p.part}: ${p.measures} measures, ${p.noteCount}/${p.expectedNoteCount} notes</span>`).join('\n')}
    <span class="pill">${pack.entries.length} crops</span>
    <span class="pill">${escapeHtml(pack.createdAt)}</span>
  </div>
  ${sections}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function round3(n) {
  return +n.toFixed(3);
}

function round5(n) {
  return +n.toFixed(5);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
