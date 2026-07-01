import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public', 'musicxml', 'lida-rose-quartet.musicxml');
const PARTS = [
  { id: 'P1', name: 'Tenor', abbr: 'Ten', slug: 'tenor' },
  { id: 'P2', name: 'Lead', abbr: 'Lead', slug: 'lead' },
  { id: 'P3', name: 'Baritone', abbr: 'Bar', slug: 'baritone' },
  { id: 'P4', name: 'Bass', abbr: 'Bass', slug: 'bass' },
];
const TARGET_MEASURES = 35;
const DIVISIONS = 12;
const FULL = DIVISIONS * 4;

function readPart(slug) {
  return fs.readFileSync(path.join(ROOT, 'public', 'musicxml', `lida-rose-${slug}.musicxml`), 'utf8');
}

function extractMeasures(xml) {
  return [...xml.matchAll(/<measure\b[\s\S]*?<\/measure>/g)].map((m) => m[0]);
}

function renumber(measure, number) {
  return measure.replace(/<measure number="[^"]*"/, `<measure number="${number}"`);
}

function padTransitionRest() {
  return `    <measure number="35" width="240">
      <print new-system="yes"/>
      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key>
          <fifths>1</fifths>
        </key>
        <time symbol="common">
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
      </attributes>
      <note>
        <rest measure="yes"/>
        <duration>${FULL}</duration>
        <voice>1</voice>
        <type>whole</type>
      </note>
    </measure>`;
}

const leadXml = readPart('lead');
const defaults = (leadXml.match(/<defaults>[\s\S]*?<\/defaults>/) || ['<defaults></defaults>'])[0];
const encDate = (leadXml.match(/<encoding-date>([^<]+)/) || [])[1] || '2026-06-20';

const partList = PARTS.map((part, index) => `    <score-part id="${part.id}">
      <part-name>${part.name}</part-name>
      <part-abbreviation>${part.abbr}</part-abbreviation>
      <score-instrument id="${part.id}-I1">
        <instrument-name>Voice</instrument-name>
      </score-instrument>
      <midi-instrument id="${part.id}-I1">
        <midi-channel>${index + 1}</midi-channel>
        <midi-program>54</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>`).join('\n');

const partsXml = PARTS.map((part) => {
  const xml = readPart(part.slug);
  const measures = extractMeasures(xml);
  while (measures.length < TARGET_MEASURES) measures.push(padTransitionRest());
  const body = measures
    .slice(0, TARGET_MEASURES)
    .map((measure, index) => renumber(measure, index + 1))
    .join('\n    <!--=======================================================-->\n    ');
  return `  <part id="${part.id}">
    ${body}
  </part>`;
}).join('\n');

const doc = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0.3 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0.3">
  <work>
    <work-title>Lida Rose - Quartet</work-title>
  </work>
  <identification>
    <encoding>
      <software>jarvis build-lida-quartet-musicxml.mjs</software>
      <encoding-date>${encDate}</encoding-date>
    </encoding>
    <miscellaneous>
      <miscellaneous-field name="source">The Music Man - Lida Rose, Tenor/Lead/Baritone/Bass, pp.196-198 plus transition</miscellaneous-field>
    </miscellaneous>
  </identification>
  ${defaults}
  <part-list>
${partList}
  </part-list>
${partsXml}
</score-partwise>
`;

fs.writeFileSync(OUT, doc.replace(/[ \t]+$/gm, ''));

const out = fs.readFileSync(OUT, 'utf8');
const partCount = (out.match(/<part id="/g) || []).length;
const measureCounts = PARTS.map((part) => {
  const block = out.match(new RegExp(`<part id="${part.id}">[\\s\\S]*?<\\/part>`))?.[0] || '';
  return `${part.name}:${(block.match(/<measure number="/g) || []).length}`;
});
if (partCount !== PARTS.length || measureCounts.some((entry) => !entry.endsWith(`:${TARGET_MEASURES}`))) {
  console.error(`VERIFY FAILED: parts=${partCount}; measures ${measureCounts.join(' ')}`);
  process.exit(1);
}
console.log(`Quartet MusicXML PASS: ${measureCounts.join(' ')}`);
console.log('WROTE', path.relative(ROOT, OUT));
