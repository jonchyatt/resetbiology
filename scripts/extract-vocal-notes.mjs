// extract-vocal-notes.mjs — server-side BasicPitch melody extraction (same engine VT3 uses
// in-browser), run in Node on tfjs-cpu. Input: a mono 22050Hz f32le PCM file (ffmpeg-decoded
// from the isolated-part MP3). Output: notes JSON {pitchMidi,startTimeSeconds,durationSeconds}.
// Usage: node scripts/extract-vocal-notes.mjs <pcm.f32> <durationSec> <out.json>
import fs from 'fs';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';

const [pcmPath, durStr, outPath] = process.argv.slice(2);
const durationSec = Number(durStr);
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json';

await tf.setBackend('cpu');
await tf.ready();
console.log('tfjs backend:', tf.getBackend());

const buf = fs.readFileSync(pcmPath);
const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
console.log(`samples: ${samples.length} (${(samples.length / 22050).toFixed(1)}s)`);

const { BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import('@spotify/basic-pitch');
const bp = new BasicPitch(MODEL_URL);

const frames = [], onsets = [], contours = [];
let lastPct = 0;
await bp.evaluateModel(
  samples,
  (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); },
  (p) => { if (p - lastPct >= 0.1) { lastPct = p; process.stdout.write(`  analyze ${Math.round(p * 100)}%\r`); } }
);
console.log(`\nframes: ${frames.length}`);

let notes = outputToNotesPoly(frames, onsets, 0.5, 0.3, 11);
notes = addPitchBendsToNoteEvents(contours, notes);
let timed = noteFramesToTime(notes).filter((n) => n.pitchMidi >= 36 && n.pitchMidi <= 84);
timed.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

// greedy melody line: keep the top note in each 50ms window (de-polyphonize)
function melodyLine(arr, windowSec = 0.05) {
  if (!arr.length) return [];
  const s = [...arr].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  const out = []; let i = 0;
  while (i < s.length) {
    const t0 = s[i].startTimeSeconds; let best = s[i]; let j = i + 1;
    while (j < s.length && s[j].startTimeSeconds - t0 < windowSec) {
      if (s[j].pitchMidi > best.pitchMidi || (s[j].pitchMidi === best.pitchMidi && s[j].amplitude > best.amplitude)) best = s[j];
      j++;
    }
    out.push(best); i = j;
  }
  return out;
}
const melody = melodyLine(timed);

const out = {
  source: 'basic-pitch server-side (tfjs-cpu) on isolated-part audio',
  durationSec,
  rawNoteCount: timed.length,
  melodyNoteCount: melody.length,
  notes: melody.map((n) => ({ pitchMidi: n.pitchMidi, startTimeSeconds: Number(n.startTimeSeconds.toFixed(4)), durationSeconds: Number(n.durationSeconds.toFixed(4)), amplitude: Number((n.amplitude ?? 0).toFixed(3)) })),
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[m % 12] + (Math.floor(m / 12) - 1);
console.log(`raw ${timed.length} -> melody ${melody.length} notes -> ${outPath}`);
console.log('first 12:', melody.slice(0, 12).map((n) => nm(n.pitchMidi)).join(' '));
console.log('pitch range:', nm(Math.min(...melody.map((n) => n.pitchMidi))), '..', nm(Math.max(...melody.map((n) => n.pitchMidi))));
