import { buildLidaPartScoreHealth } from './lida-build-part-score-health.mjs';
import { applyTenorMeasureCorrections } from './lida-tenor-source-corrections.mjs';
import {
  EXPECTED_TENOR_NOTE_COUNT,
  PRINTED_TENOR_AUDIT_MEASURES,
  TENOR_SCORE_VERSION,
  TENOR_SECTION_TRANSITIONS,
  pageForTenorMeasure,
} from './lida-tenor-printed-manifest.mjs';

buildLidaPartScoreHealth({
  part: 'Tenor',
  slug: 'tenor',
  scoreVersion: TENOR_SCORE_VERSION,
  expectedNoteCount: EXPECTED_TENOR_NOTE_COUNT,
  printedAuditMeasures: PRINTED_TENOR_AUDIT_MEASURES,
  sectionTransitions: TENOR_SECTION_TRANSITIONS,
  pageForMeasure: pageForTenorMeasure,
  applyCorrections: applyTenorMeasureCorrections,
  pages: [
    { page: '196', file: 'scripts/omr/source/lida-196.xml', staff: 'P2' },
    { page: '197', file: 'scripts/omr/source/lida-197.xml', staff: 'P1' },
    { page: '198', file: 'scripts/omr/source/lida-198.xml', staff: 'P1' },
  ],
});
