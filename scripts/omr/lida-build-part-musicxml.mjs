import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRINTED_FIFTHS, normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = (file) => path.join(__dirname, 'source', file);
const ROOT = path.join(__dirname, '..', '..');
const OMR_TS = path.join(ROOT, 'src', 'components', 'PitchDefender', 'omrTargets.ts');
const LCM = 12;
const FULL_MEASURE_REST = LCM * 4;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function buildLidaPartMusicXml(config) {
  const outPath = path.join(ROOT, 'public', 'musicxml', `lida-rose-${config.slug}.musicxml`);
  const measures = [];
  const perPage = [];

  for (let pageIndex = 0; pageIndex < config.pages.length; pageIndex++) {
    const { pg, file, staff } = config.pages[pageIndex];
    const xml = fs.readFileSync(SRC(file), 'utf8');
    let inner = getPartInner(xml, staff);
    const first = inner.indexOf('<measure ');
    const last = inner.lastIndexOf('</measure>');
    inner = inner.slice(first, last + '</measure>'.length);
    const div = Number((inner.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    const factor = LCM / div;
    inner = inner.replace(/<duration>(\d+)<\/duration>/g, (_, n) => `<duration>${Number(n) * factor}</duration>`);
    inner = inner.replace(/<divisions>\d+<\/divisions>/g, `<divisions>${LCM}</divisions>`);
    inner = preservePrintBreaks(inner);

    let units = (inner.match(/<measure\b[\s\S]*?<\/measure>/g) || []).map(normalizeLeadMeasure);
    units = config.applyCorrections(pg, units, { part: config.part, divisions: LCM });
    if (pageIndex > 0 && units[0]) units[0] = forceSystemBreak(units[0]);
    perPage.push(units.reduce((count, unit) => count + melodicPitches(unit).length, 0));
    measures.push(...units);
  }

  let trimmed = 0;
  while (measures.length && !/<note\b/.test(measures[measures.length - 1])) {
    measures.pop();
    trimmed++;
  }

  let filled = 0;
  for (let i = 0; i < measures.length; i++) {
    if (!/<note\b/.test(measures[i])) {
      measures[i] = measures[i].replace(
        /<\/measure>$/,
        `  <note><rest measure="yes"/><duration>${FULL_MEASURE_REST}</duration><voice>1</voice></note>\n    </measure>`,
      );
      filled++;
    }
  }

  for (let i = 1; i < measures.length; i++) measures[i] = stripRepeatedClef(measures[i]);

  let measureNo = 0;
  const body = measures
    .map((unit) => unit.replace(/<measure number="[^"]*"/, () => `<measure number="${++measureNo}"`))
    .join('\n    <!--=======================================================-->\n    ');

  const src196 = fs.readFileSync(SRC('lida-196.xml'), 'utf8');
  const defaults = (src196.match(/<defaults>[\s\S]*?<\/defaults>/) || ['<defaults></defaults>'])[0];
  const encDate = (src196.match(/<encoding-date>([^<]+)/) || [])[1] || '2026-06-20';
  const doc = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0.3 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0.3">
  <work>
    <work-title>Lida Rose - ${config.part}</work-title>
  </work>
  <identification>
    <encoding>
      <software>jarvis build-${config.slug}-musicxml.mjs (stitched from Audiveris 5.10.2)</software>
      <encoding-date>${encDate}</encoding-date>
    </encoding>
    <miscellaneous>
      <miscellaneous-field name="source">The Music Man - Lida Rose, ${config.part} (${config.character}), pp.196-198</miscellaneous-field>
    </miscellaneous>
  </identification>
  ${defaults}
  <part-list>
    <score-part id="P1">
      <part-name>${config.part}</part-name>
      <part-abbreviation>${config.abbreviation}</part-abbreviation>
      <score-instrument id="P1-I1">
        <instrument-name>Voice</instrument-name>
      </score-instrument>
      <midi-instrument id="P1-I1">
        <midi-channel>1</midi-channel>
        <midi-program>54</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    ${body}
  </part>
</score-partwise>
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, doc.replace(/[ \t]+$/gm, ''));

  const out = fs.readFileSync(outPath, 'utf8');
  const errors = [];
  const partOpen = (out.match(/<part id="/g) || []).length;
  const partClose = (out.match(/<\/part>/g) || []).length;
  if (partOpen !== 1) errors.push(`expected 1 <part id=>, got ${partOpen}`);
  if (partClose !== 1) errors.push(`expected 1 </part>, got ${partClose}`);

  const nums = [...out.matchAll(/<measure number="(\d+)"/g)].map((m) => Number(m[1]));
  if (!nums.every((n, i) => n === i + 1)) errors.push(`measures not consecutive 1..N (n=${nums.length}, head ${nums.slice(0, 6)})`);

  const divs = [...new Set([...out.matchAll(/<divisions>(\d+)<\/divisions>/g)].map((m) => Number(m[1])))];
  if (divs.length !== 1 || divs[0] !== LCM) errors.push(`divisions not uniformly ${LCM}: ${divs}`);

  const allowedFifths = new Set([PRINTED_FIFTHS, ...(config.sectionTransitions || []).map((t) => t.nextKeyFifths)]);
  const fifths = [...new Set([...out.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
  if (!fifths.length || fifths.some((f) => !allowedFifths.has(f))) {
    errors.push(`unexpected key fifths: ${fifths}; allowed ${[...allowedFifths].join(',')}`);
  }

  for (const measureMatch of out.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const no = Number(measureMatch[1]);
    if (no <= 2) continue;
    const measureBody = measureMatch[0];
    if (/<clef>/.test(measureBody)) errors.push(`m${no}: repeated clef would render as a courtesy clef in OSMD`);
    if (/(<clef>|<key>)/.test(measureBody) && !/<print\b[^>]*new-(?:system|page)="yes"/.test(measureBody)) {
      errors.push(`m${no}: clef/key attributes without an explicit system break`);
    }
  }

  const outInner = out.slice(out.indexOf('<part id="P1">'), out.indexOf('</part>'));
  const outPitches = melodicPitches(outInner);
  const refPitches = targetPitchesFromOmr(config.part);
  if (refPitches.length) {
    const samePitch = outPitches.length === refPitches.length && outPitches.every((p, i) => p === refPitches[i]);
    if (!samePitch) {
      const k = outPitches.findIndex((p, i) => p !== refPitches[i]);
      errors.push(`pitch mismatch: stitched ${outPitches.length} vs omrTargets ${refPitches.length}` +
        (k >= 0 ? `; first divergence @${k}: ${nameOf(outPitches[k])} vs ref ${nameOf(refPitches[k])}` : ''));
    }
  }

  console.log(`stitched ${nums.length} measures (trimmed ${trimmed} trailing, filled ${filled} empty) - ${outPitches.length} melodic notes - divisions ${LCM}`);
  console.log(`per-page ${config.part} notes: ${config.pages.map((page, i) => `${page.pg}=${perPage[i]}`).join(' ')} (sum ${perPage.reduce((a, c) => a + c, 0)})`);
  console.log(`range ${nameOf(Math.min(...outPitches))}-${nameOf(Math.max(...outPitches))}`);
  if (!refPitches.length) console.log(`WARN: no ${config.part} target in omrTargets.ts yet; pitch self-check skipped`);
  if (errors.length) {
    console.error('VERIFY FAILED:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  if (refPitches.length) console.log(`VERIFY PASS - stitched melody == omrTargets.ts ground truth (${outPitches.length}/${refPitches.length})`);
  console.log('WROTE', path.relative(ROOT, outPath));
}

function getPartInner(xml, id) {
  for (const partBlock of xml.split('<part id="').slice(1)) {
    const match = partBlock.match(/^([^"]+)"/);
    if (match?.[1] !== id) continue;
    const end = partBlock.indexOf('</part>');
    if (end < 0) throw new Error(`part ${id}: no </part>`);
    return partBlock.slice(partBlock.indexOf('>') + 1, end);
  }
  throw new Error(`part ${id} not found`);
}

function melodicPitches(partInner) {
  const out = [];
  for (const note of partInner.split(/<note[ >]/).slice(1)) {
    if (/<rest\b/.test(note)) continue;
    if (/<chord\s*\/?>/.test(note)) continue;
    const match = note.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
    if (!match) continue;
    out.push((Number(match[3]) + 1) * 12 + SEMI[match[1]] + (match[2] ? Number(match[2]) : 0));
  }
  return out;
}

function preservePrintBreaks(xml) {
  return xml.replace(/<print\b([^>]*)>[\s\S]*?<\/print>\s*/g, (_, attrs) => {
    if (/\bnew-page="yes"/.test(attrs)) return '<print new-page="yes"/>\n      ';
    if (/\bnew-system="yes"/.test(attrs)) return '<print new-system="yes"/>\n      ';
    return '';
  });
}

function forceSystemBreak(measureXml) {
  if (/<print\b/.test(measureXml)) {
    return measureXml.replace(/<print\b[^>]*(?:\/>|>[\s\S]*?<\/print>)/, '<print new-system="yes"/>');
  }
  return measureXml.replace(/(<measure\b[^>]*>\s*)/, '$1\n      <print new-system="yes"/>');
}

function stripRepeatedClef(measureXml) {
  return measureXml.replace(/\s*<clef>[\s\S]*?<\/clef>/g, '');
}

function targetPitchesFromOmr(part) {
  const ts = fs.readFileSync(OMR_TS, 'utf8');
  const block = ts.match(new RegExp(`part: '${part}',[\\s\\S]*?notes: \\[([\\s\\S]*?)\\n    \\]`));
  if (!block) return [];
  return [...block[1].matchAll(/pitchMidi:\s*(\d+)/g)].map((m) => Number(m[1]));
}

function nameOf(midi) {
  return NM[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}
