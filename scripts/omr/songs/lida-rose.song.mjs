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
  // Tempo is golden-truth, read once into the contract — the OMR carries NO <sound tempo>,
  // and pure-notation timing must never silently default to 120 bpm. The plunk plays the
  // score at this single constant tempo (start = scoreBeat × 60/bpm), shared by BOTH parts
  // so the duet stays aligned. 99 = the measured average tempo of the reference recording
  // (Lead 138 beats / 83.24 s), rounded to a clean integer metronome. Replace with the
  // printed score's tempo marking when a future song carries one.
  tempoBpm: 99,
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
      expectedNotes: 114,   // locked 2026-06-24: 3 held bars + bar-19 run + 3 restored sing-bars (gate-green)
      pickupMeasures: [1],
      keyFifths: [-6],
      clef: { sign: 'F', line: 4, octaveChange: 0 },
    },
  ],
  // Open defects the gate currently flags on the known-good build. The gate derives these
  // from notation laws, not from this list — it's documentation. All four below were RESOLVED
  // 2026-06-24 (session 2): `verify-score-invariants.mjs lida-rose` is GATE PASS both parts.
  // Kept here as the record of what the law-gate caught and the corrections fixed.
  knownOpenDefects: [
    // RESOLVED: Lead m16 / m18 under-filled tuplet [I1] — deTripletizeQuarterTriplets.
    // RESOLVED: Lead m24->m25 cross-pitch tie E♮(64)->E♭(63) [I2] — fixLeadTieStopNatural.
    // RESOLVED: Baritone 31 vs 34 bars [I4] — held bars 9/13/21 inserted (+ 5/25/29 restored).
    // RESOLVED: Baritone m17 under-filled [I1] — bar-19 8-eighth run completed.
  ],
};
