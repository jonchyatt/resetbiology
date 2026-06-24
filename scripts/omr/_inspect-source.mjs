// TEMP diagnostic (prefix _ = throwaway). Dumps per-part, per-measure note lists
// + tick sums from an Audiveris source XML so homophonic voices can corroborate a
// voice Audiveris under-read. Read-only on source. Usage:
//   node scripts/omr/_inspect-source.mjs scripts/omr/source/lida-197.xml [P1,P2,..] [localNums csv]
import fs from 'fs';
const file = process.argv[2];
const wantParts = (process.argv[3] || 'P1,P2,P3,P4').split(',');
const wantMeasures = process.argv[4] ? process.argv[4].split(',') : null;
const xml = fs.readFileSync(file, 'utf8');
const div = parseInt((xml.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || '1');
function partInner(id) {
  for (const pb of xml.split('<part id="').slice(1)) {
    const m = pb.match(/^([^"]+)"/);
    if (m && m[1] === id) { const end = pb.indexOf('</part>'); return pb.slice(pb.indexOf('>') + 1, end); }
  }
  return null;
}
const beatsForDiv = (sum) => (sum / div).toFixed(2);
for (const pid of wantParts) {
  const inner = partInner(pid);
  if (!inner) { console.log(pid, 'MISSING'); continue; }
  const measures = inner.match(/<measure\b[\s\S]*?<\/measure>/g) || [];
  console.log(`\n===== ${pid} (${measures.length} measures, div=${div}, quarter=${div}t) =====`);
  for (const mz of measures) {
    const num = (mz.match(/number="([^"]+)"/) || [])[1];
    if (wantMeasures && !wantMeasures.includes(num)) continue;
    const notes = mz.match(/<note\b[\s\S]*?<\/note>/g) || [];
    let sum = 0; const out = [];
    for (const n of notes) {
      const isRest = /<rest\b/.test(n);
      const isChord = /<chord\s*\/?>/.test(n);
      const dur = parseInt((n.match(/<duration>(\d+)<\/duration>/) || [])[1] || '0');
      if (!isChord) sum += dur;
      const step = (n.match(/<step>([A-G])<\/step>/) || [])[1];
      const alter = (n.match(/<alter>(-?\d+)<\/alter>/) || [])[1];
      const oct = (n.match(/<octave>(\d+)<\/octave>/) || [])[1];
      const type = (n.match(/<type>([a-z]+)<\/type>/) || [])[1] || '';
      const tup = /<time-modification>/.test(n) ? '·3' : '';
      const dot = /<dot\s*\/>/.test(n) ? '.' : '';
      const lbl = isRest ? 'REST' : (step + (alter ? `(${alter})` : '') + oct);
      out.push(`${isChord ? '+' : ''}${lbl}:${dur}${type ? '/' + type : ''}${dot}${tup}`);
    }
    const flag = Math.abs(sum - div * 4) > 0.001 ? '  <<<< UNDER/OVER' : '';
    console.log(`  m${num} = ${sum}t (${beatsForDiv(sum)} beats)${flag}\n        ${out.join('  ')}`);
  }
}
