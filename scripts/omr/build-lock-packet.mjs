// build-lock-packet.mjs
// PLUMB step 1 (Codex+Argus approved 2026-06-24): FREEZE the Lida Rose verification
// packet. Does NOT edit the score. Output = frozen + SHA256-hashed authority pages +
// engraving (musicxml + render) + page/measure map + BLANK row-level note ledger.
// Readiness is judged mechanically by verify-packet-ready.mjs, never by narration.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { scoreEventsFromXml, noteName } from './score-timing.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const PKT = path.join(__dirname, 'lock', 'lida-rose');
fs.mkdirSync(PKT, { recursive: true });

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rel = (p) => path.relative(RBW, p).replace(/\\/g, '/');

// AUTHORITY = the printed page (court of record). page-N.jpg shows printed page N-3.
const AUTHORITY = ['page-196.jpg', 'page-197.jpg', 'page-198.jpg', 'page-199.jpg']
  .map((f) => path.join(RBW, 'public', 'score', f))
  .filter((p) => fs.existsSync(p));

const PARTS = [
  { part: 'Lead', musicxml: path.join(RBW, 'public', 'musicxml', 'lida-rose-lead.musicxml') },
  { part: 'Baritone', musicxml: path.join(RBW, 'public', 'musicxml', 'lida-rose-baritone.musicxml') },
];

// page → measure map (from the song contract; printed pp.193-196 = files 196-199)
const PAGE_MAP = [
  { page: 'page-196.jpg', printed: 193, measures: [1, 9] },
  { page: 'page-197.jpg', printed: 194, measures: [10, 21] },
  { page: 'page-198.jpg', printed: 195, measures: [22, 34] },
  { page: 'page-199.jpg', printed: 196, measures: [35, 35] },
];
const pageForMeasure = (m) => (PAGE_MAP.find((p) => m >= p.measures[0] && m <= p.measures[1]) || {}).page || '';

// freeze a full per-part engraving render (the thing a human compares to the page)
const browser = await chromium.launch();
for (const P of PARTS) {
  const xml = fs.readFileSync(P.musicxml, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1200, height: 2200 }, deviceScaleFactor: 2 });
  await page.setContent('<div id="o" style="background:white;padding:8px"></div>');
  await page.addScriptTag({ path: path.join(RBW, 'node_modules', 'opensheetmusicdisplay', 'build', 'opensheetmusicdisplay.min.js') });
  await page.evaluate(async (xml) => {
    const o = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(document.getElementById('o'), { autoResize: false, backend: 'svg', drawTitle: true, drawPartNames: true });
    await o.load(xml); o.zoom = 0.75; o.render();
  }, xml);
  await page.waitForTimeout(900);
  P.render = path.join(PKT, `engraving-${P.part.toLowerCase()}.png`);
  await (await page.$('#o')).screenshot({ path: P.render });
  await page.close();
}
await browser.close();

// BLANK row-level note ledger, pre-filled with the ENGRAVING's claims (one row per note).
// page_pitch_read + verdict are filled later by INDEPENDENT reads (Argus + Claude + Jon).
const header = ['row', 'part', 'note_index', 'measure', 'page', 'engraving_pitch', 'page_pitch_read', 'verdict', 'reviewer', 'notes'];
const rows = [header];
let row = 0;
for (const P of PARTS) {
  const events = scoreEventsFromXml(fs.readFileSync(P.musicxml, 'utf8'));
  P.noteCount = events.length;
  events.forEach((e, i) => {
    row++;
    rows.push([row, P.part, i, e.measure, pageForMeasure(e.measure), noteName(e.midi), '', '', '', '']);
  });
}
const ledgerCsv = rows.map((r) => r.join(',')).join('\n') + '\n';
fs.writeFileSync(path.join(PKT, 'discrepancy-ledger.csv'), ledgerCsv);
fs.writeFileSync(path.join(PKT, 'page-measure-map.json'), JSON.stringify({ note: 'page-N.jpg shows printed page N-3', pages: PAGE_MAP }, null, 2) + '\n');

// MANIFEST — the frozen, hashed evidence chain. signoff blank until Jon signs (court of record).
const manifest = {
  song: 'lida-rose',
  purpose: 'Plumb engraving-lock verification packet — step 1: FREEZE (do not edit the score)',
  frozenAt: new Date().toISOString(),
  authority: { type: 'printed-page (court of record)', files: AUTHORITY.map((p) => ({ path: rel(p), sha256: sha(p) })) },
  engraving: {
    musicxml: PARTS.map((P) => ({ part: P.part, path: rel(P.musicxml), sha256: sha(P.musicxml), noteCount: P.noteCount })),
    renders: PARTS.map((P) => ({ part: P.part, path: rel(P.render), sha256: sha(P.render) })),
  },
  map: { path: rel(path.join(PKT, 'page-measure-map.json')), sha256: sha(path.join(PKT, 'page-measure-map.json')) },
  ledger: { path: rel(path.join(PKT, 'discrepancy-ledger.csv')), sha256: sha(path.join(PKT, 'discrepancy-ledger.csv')), rows: row, columns: header },
  signoff: { jon: null, signedAt: null },
};
fs.writeFileSync(path.join(PKT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`FROZEN -> ${rel(PKT)}: ${AUTHORITY.length} authority pages, ${PARTS.length} engravings, ${row} ledger rows`);
console.log('Now run: node scripts/omr/verify-packet-ready.mjs');
