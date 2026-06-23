const PRINTED_FIFTHS = -6;
const PRINTED_KEY_FLATS = new Set(['B', 'E', 'A', 'D', 'G', 'C']);

const ACCIDENTAL_ALTER = {
  natural: 0,
  flat: -1,
  sharp: 1,
  'double-flat': -2,
  'flat-flat': -2,
  'double-sharp': 2,
};

export { PRINTED_FIFTHS };

export function printedKeyAlter(step) {
  return PRINTED_KEY_FLATS.has(step) ? -1 : 0;
}

export function normalizeLeadMeasure(measureXml) {
  let out = measureXml.replace(/<fifths>-?\d+<\/fifths>/g, `<fifths>${PRINTED_FIFTHS}</fifths>`);
  const accidentals = new Map();

  out = out.replace(/<note\b[\s\S]*?<\/note>/g, (noteXml) => {
    if (/<rest\b/.test(noteXml) || !/<pitch>/.test(noteXml)) return noteXml;

    const pitchMatch = noteXml.match(/<pitch>[\s\S]*?<\/pitch>/);
    if (!pitchMatch) return noteXml;

    const pitchXml = pitchMatch[0];
    const step = (pitchXml.match(/<step>([A-G])<\/step>/) || [])[1];
    const octave = Number((pitchXml.match(/<octave>(\d+)<\/octave>/) || [])[1]);
    if (!step || !Number.isFinite(octave)) return noteXml;

    const accidental = (noteXml.match(/<accidental(?:\s[^>]*)?>([^<]+)<\/accidental>/) || [])[1];
    const key = `${step}${octave}`;
    let alter;
    if (accidental && Object.prototype.hasOwnProperty.call(ACCIDENTAL_ALTER, accidental)) {
      alter = ACCIDENTAL_ALTER[accidental];
      accidentals.set(key, alter);
    } else if (accidentals.has(key)) {
      alter = accidentals.get(key);
    } else {
      alter = printedKeyAlter(step);
    }

    return noteXml.replace(pitchXml, setPitchAlter(pitchXml, alter));
  });

  return out;
}

function setPitchAlter(pitchXml, alter) {
  const indent = (pitchXml.match(/\n(\s*)<step>/) || [null, '          '])[1];
  let out = pitchXml.replace(/\n\s*<alter>-?\d+<\/alter>/g, '');
  if (alter !== 0) {
    out = out.replace(/(<step>[A-G]<\/step>)/, `$1\n${indent}<alter>${alter}</alter>`);
  }
  return out;
}
