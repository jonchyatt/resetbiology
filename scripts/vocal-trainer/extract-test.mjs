// Sanity check: run BasicPitch against decoded PCM and dump notes.
// Usage: node scripts/vocal-trainer/extract-test.mjs <pcm-file>
// PCM must be 22050Hz mono float32 little-endian.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';

const SR = 22050;
const pcmPath = process.argv[2] || 'data/vocal-trainer/donny.pcm';
const modelDir = path.resolve('node_modules/@spotify/basic-pitch/model');

// Serve the model files locally because tfjs in Node can't fetch file://
const server = http.createServer((req, res) => {
  const fp = path.join(modelDir, req.url.replace(/^\//, ''));
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': req.url.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const buf = fs.readFileSync(pcmPath);
const samples = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
console.log(`PCM loaded: ${samples.length} samples = ${(samples.length / SR).toFixed(2)}s`);
console.log(`Serving model from http://127.0.0.1:${port}/model.json`);

const bp = new BasicPitch(`http://127.0.0.1:${port}/model.json`);
const frames = [], onsets = [], contours = [];
await bp.evaluateModel(samples, (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); }, (p) => {
  if (Math.round(p * 100) % 25 === 0) process.stdout.write(`  progress ${(p*100).toFixed(0)}%\n`);
});

const notes = noteFramesToTime(outputToNotesPoly(frames, onsets, 0.25, 0.25, 5));
console.log(`\nExtracted ${notes.length} notes`);
console.log('First 15:');
notes.slice(0, 15).forEach((n, i) => {
  const midi = n.pitchMidi;
  const name = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi % 12] + (Math.floor(midi/12)-1);
  console.log(`  ${i+1}. t=${n.startTimeSeconds.toFixed(2)}s dur=${(n.durationSeconds).toFixed(2)}s ${name} (midi ${midi}) amp=${n.amplitude.toFixed(2)}`);
});

const outPath = pcmPath.replace(/\.pcm$/, '.notes.json');
fs.writeFileSync(outPath, JSON.stringify(notes, null, 2));
console.log(`\nWrote ${outPath}`);
server.close();
