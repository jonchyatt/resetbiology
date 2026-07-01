import { buildLidaPartScoreHealth } from './lida-build-part-score-health.mjs';
import { applyBassMeasureCorrections } from './lida-bass-source-corrections.mjs';
import {
  BASS_SCORE_VERSION,
  BASS_SECTION_TRANSITIONS,
  EXPECTED_BASS_NOTE_COUNT,
  PRINTED_BASS_AUDIT_MEASURES,
  pageForBassMeasure,
} from './lida-bass-printed-manifest.mjs';

buildLidaPartScoreHealth({
  part: 'Bass',
  slug: 'bass',
  scoreVersion: BASS_SCORE_VERSION,
  expectedNoteCount: EXPECTED_BASS_NOTE_COUNT,
  printedAuditMeasures: PRINTED_BASS_AUDIT_MEASURES,
  sectionTransitions: BASS_SECTION_TRANSITIONS,
  pageForMeasure: pageForBassMeasure,
  applyCorrections: applyBassMeasureCorrections,
  pages: [
    { page: '196', file: 'scripts/omr/source/lida-196.xml', staff: 'P5' },
    { page: '197', file: 'scripts/omr/source/lida-197.xml', staff: 'P4' },
    { page: '198', file: 'scripts/omr/source/lida-198.xml', staff: 'P4' },
  ],
});
