import {
  addLeadingQuarterRest,
  addTieStartToLastPitchedNote,
  deTripletizeQuarterTriplets,
  transitionHalfThenRest,
  wholeNoteMeasure,
} from './lida-source-correction-helpers.mjs';

export function applyTenorMeasureCorrections(page, measures, options = {}) {
  const part = options.part || 'Tenor';
  if (part !== 'Tenor') return measures;
  const divisions = options.divisions || (page === '197' ? 6 : page === '198' ? 4 : 12);
  const full = divisions * 4;
  const out = [];

  for (const measure of measures) {
    const number = (measure.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1];

    if (page === '196' && number === '4') {
      out.push(deTripletizeQuarterTriplets(measure, divisions));
      continue;
    }
    if (page === '196' && number === '5') {
      out.push(wholeNoteMeasure({ number: '905', width: '131', step: 'F', octave: 4, duration: full }));
      continue;
    }

    if (page === '197' && number === '3') {
      out.push(addLeadingQuarterRest(measure, divisions));
      out.push(wholeNoteMeasure({ number: '913', width: '131', step: 'G', alter: -1, octave: 4, duration: full }));
      continue;
    }

    if (page === '198' && number === '8') {
      out.push(wholeNoteMeasure({ number: '929', width: '126', step: 'G', octave: 4, duration: full }));
      continue;
    }
    if (page === '198' && number === '13') {
      out.push(addTieStartToLastPitchedNote(measure));
      continue;
    }
    if (page === '198' && number === '14') {
      out.push(transitionHalfThenRest({
        step: 'D',
        octave: 4,
        duration: full,
        accidental: 'natural',
      }));
      continue;
    }

    out.push(measure);

    if (page === '196' && number === '8') {
      out.push(wholeNoteMeasure({ number: '909', width: '131', step: 'F', octave: 4, duration: full }));
    }
    if (page === '197' && number === '10') {
      out.push(wholeNoteMeasure({ number: '921', width: '131', step: 'F', octave: 4, duration: full }));
    }
  }

  return out;
}
