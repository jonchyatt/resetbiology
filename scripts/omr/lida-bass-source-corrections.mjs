import {
  deTripletizeQuarterTriplets,
  measureXml,
  pitchedNote,
  transitionHalfThenRest,
  wholeNoteMeasure,
} from './lida-source-correction-helpers.mjs';

export function applyBassMeasureCorrections(page, measures, options = {}) {
  const part = options.part || 'Bass';
  if (part !== 'Bass') return measures;
  const divisions = options.divisions || (page === '197' ? 6 : page === '198' ? 4 : 12);
  const full = divisions * 4;
  const out = [];

  for (const measure of measures) {
    const number = (measure.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1];

    if (page === '196' && number === '5') {
      out.push(wholeNoteMeasure({ number: '905', width: '129', step: 'D', alter: -1, octave: 3, duration: full }));
      continue;
    }

    if (page === '197' && (number === '6' || number === '10')) {
      out.push(deTripletizeQuarterTriplets(measure, divisions));
      if (number === '10') {
        out.push(wholeNoteMeasure({ number: '921', width: '131', step: 'D', alter: -1, octave: 3, duration: full }));
      }
      continue;
    }

    if (page === '198' && number === '8') {
      out.push(wholeNoteMeasure({ number: '929', width: '126', step: 'E', alter: -1, octave: 3, duration: full }));
      continue;
    }
    if (page === '198' && number === '11') {
      out.push(wholeNoteMeasure({ number: '932', width: '270', step: 'G', alter: -1, octave: 2, duration: full }));
      continue;
    }
    if (page === '198' && number === '12') {
      out.push(wholeNoteMeasure({ number: '933', width: '269', step: 'G', alter: -1, octave: 2, duration: full }));
      continue;
    }
    if (page === '198' && number === '13') {
      const half = full / 2;
      out.push(measureXml({
        number: '934',
        width: '179',
        notes: [
          pitchedNote({ step: 'G', alter: -1, octave: 2, duration: half, type: 'half' }),
          pitchedNote({
            step: 'G',
            octave: 2,
            duration: half,
            type: 'half',
            accidental: 'natural',
            tie: 'start',
            tied: 'start',
            fermata: true,
          }),
        ],
      }));
      continue;
    }
    if (page === '198' && number === '14') {
      out.push(transitionHalfThenRest({
        step: 'G',
        octave: 2,
        duration: full,
        accidental: 'natural',
      }));
      continue;
    }

    out.push(measure);

    if (page === '196' && number === '8') {
      out.push(wholeNoteMeasure({ number: '909', width: '131', step: 'D', alter: -1, octave: 3, duration: full }));
    }
    if (page === '197' && number === '3') {
      out.push(wholeNoteMeasure({ number: '913', width: '131', step: 'E', alter: -1, octave: 3, duration: full }));
    }
  }

  return out;
}
