// clean-extracted-notes.mjs — collapse BasicPitch's over-segmentation into a singable line.
// Raw extraction fragments sustained/vibrato notes into many short same-or-±1-semitone pieces.
// Pass 1: merge consecutive SAME-pitch notes separated by a small gap into one sustained note.
// Pass 2: de-wobble — absorb a short note whose neighbors are the same pitch ±1 semitone (vibrato).
// Pass 3: drop slivers shorter than minDur. Keeps {pitchMidi,startTimeSeconds,durationSeconds}.
// Usage: node scripts/clean-extracted-notes.mjs <in.json> <out.json> [mergeGapMs] [minDurMs]
import fs from 'fs';
const [inP, outP, mg = '140', md = '110'] = process.argv.slice(2);
const mergeGap = Number(mg) / 1000, minDur = Number(md) / 1000;
const doc = JSON.parse(fs.readFileSync(inP, 'utf8'));
let ns = doc.notes.map((n) => ({ ...n })).sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

// pass 1: merge same-pitch with small gap
const merged = [];
for (const n of ns) {
  const last = merged[merged.length - 1];
  if (last && last.pitchMidi === n.pitchMidi && n.startTimeSeconds - (last.startTimeSeconds + last.durationSeconds) <= mergeGap) {
    last.durationSeconds = (n.startTimeSeconds + n.durationSeconds) - last.startTimeSeconds;
  } else merged.push({ ...n });
}

// pass 2: de-wobble — a short note flanked by same-pitch (±1 semitone) neighbors = vibrato fragment → fold into prev
const dewob = [];
for (let i = 0; i < merged.length; i++) {
  const n = merged[i], prev = dewob[dewob.length - 1], next = merged[i + 1];
  const short = n.durationSeconds < 0.18;
  if (prev && short && Math.abs(n.pitchMidi - prev.pitchMidi) === 1 && next && Math.abs(next.pitchMidi - prev.pitchMidi) <= 1) {
    prev.durationSeconds = (n.startTimeSeconds + n.durationSeconds) - prev.startTimeSeconds; // extend prev over the wobble
    continue;
  }
  dewob.push({ ...n });
}
// re-merge same-pitch after de-wobble
const merged2 = [];
for (const n of dewob) {
  const last = merged2[merged2.length - 1];
  if (last && last.pitchMidi === n.pitchMidi && n.startTimeSeconds - (last.startTimeSeconds + last.durationSeconds) <= mergeGap) {
    last.durationSeconds = (n.startTimeSeconds + n.durationSeconds) - last.startTimeSeconds;
  } else merged2.push({ ...n });
}

// pass 3: drop slivers
const clean = merged2.filter((n) => n.durationSeconds >= minDur)
  .map((n) => ({ pitchMidi: n.pitchMidi, startTimeSeconds: Number(n.startTimeSeconds.toFixed(4)), durationSeconds: Number(n.durationSeconds.toFixed(4)), amplitude: n.amplitude ?? 0.5 }));

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[m % 12] + (Math.floor(m / 12) - 1);
const out = { ...doc, cleaned: true, params: { mergeGapMs: Number(mg), minDurMs: Number(md) }, rawMelodyCount: doc.notes.length, cleanCount: clean.length, notes: clean };
fs.writeFileSync(outP, JSON.stringify(out, null, 2));
console.log(`raw melody ${doc.notes.length} -> clean ${clean.length}`);
console.log('range:', nm(Math.min(...clean.map((n) => n.pitchMidi))), '..', nm(Math.max(...clean.map((n) => n.pitchMidi))));
console.log('first 24:', clean.slice(0, 24).map((n) => nm(n.pitchMidi)).join(' '));
const durs = clean.map((n) => n.durationSeconds).sort((a, b) => a - b);
console.log('median note dur:', durs[Math.floor(durs.length / 2)].toFixed(2) + 's', '| notes/sec:', (clean.length / doc.durationSec).toFixed(2));
