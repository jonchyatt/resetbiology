// songs/lida-rose.song.mjs
// DECLARATIVE SONG CONTRACT ("golden truth") for Vocal Trainer III.
//
// Every value here is read ONCE off the printed score by a human or a vision pass,
// NOT derived from OMR or from the correction scripts. This is the external truth
// the deterministic invariant gate checks the generated MusicXML against, so a
// wrong correction can no longer grade its own homework.
//
// Printed-page mapping: file page-N.jpg shows printed page N-3.
//   page-196.jpg = p.193 = bars 1-9    (Lida Rose; system 1 has a Harold intro staff)
//   page-197.jpg = p.194 = bars 10-21
//   page-198.jpg = p.195 = bars 22-34
//   page-199.jpg = p.196 = bars 35+    ("Will I Ever Tell You?" — quartet TACET, Marian only)
//
// Lida Rose body = printed bars 1..34. The Lead's held "Rose" ties across the barline
// into bar 35 (key change Gb major -> G major); the quartet drops out there.

export default {
  id: 'lida-rose',
  title: 'Lida Rose / Will I Ever Tell You? (#35)',
  meter: { beats: 4, beatType: 4 }, // common time throughout
  // Octave authority = the Audiveris source staves (it reads staff position reliably).
  // Both parts must match those source octaves; corrections may fix dropped notes,
  // rhythm, or spelling but MUST NOT shift octave. (See the 2026-06-24 incident: an
  // experiment dropped the Baritone an octave below the source and broke the part.)
  parts: [
    {
      name: 'Lead', // Ewart — treble-8vb (G/line2/clef-octave-change -1); source octave 3-4
      musicxml: 'public/musicxml/lida-rose-lead.musicxml',
      expectedMeasures: 35, // bars 1..34 + the tied transition bar 35
      expectedNotes: 118,
      pickupMeasures: [1], // m1 = fermata anacrusis (rest for this voice, partial bar OK)
      keyFifths: [-6, 1], // Gb major, then G major at m35
      clef: { sign: 'G', line: 2, octaveChange: -1 },
    },
    {
      name: 'Baritone', // Oliver — bass (F/line4); source octave 3-4 (e.g. chime = Cb4)
      musicxml: 'public/musicxml/lida-rose-baritone.musicxml',
      expectedMeasures: 34, // Oliver sings bars 1..34, tacet at the bar-35 transition
      expectedNotes: null,  // known-good build is octave-correct but still hold-incomplete
      pickupMeasures: [1],
      keyFifths: [-6],
      clef: { sign: 'F', line: 4, octaveChange: 0 },
    },
  ],
  // Open defects the gate currently (correctly) flags on the known-good build.
  // The gate derives these from notation laws, not from this list — it's documentation.
  knownOpenDefects: [
    'Lead m16 / m18: under-filled (3 beats / 36 ticks) — Audiveris under-read the tuplet [I1]',
    'Lead m24->m25: tie connects E-natural(64) to E-flat(63) — cross-pitch tie / OMR artifact [I2]',
    'Baritone: 31 bars vs 34 — Oliver\'s held bars 9 (shy) / 13 (chime) / 21 (name) are missing [I4]',
    'Baritone m17: under-filled (42 ticks) — Audiveris under-read [I1]',
  ],
};
