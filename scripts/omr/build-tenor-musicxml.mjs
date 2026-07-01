import { buildLidaPartMusicXml } from './lida-build-part-musicxml.mjs';
import { applyTenorMeasureCorrections } from './lida-tenor-source-corrections.mjs';
import { TENOR_SECTION_TRANSITIONS } from './lida-tenor-printed-manifest.mjs';

buildLidaPartMusicXml({
  part: 'Tenor',
  slug: 'tenor',
  character: 'Jacey',
  abbreviation: 'Ten',
  pages: [
    { pg: '196', file: 'lida-196.xml', staff: 'P2' },
    { pg: '197', file: 'lida-197.xml', staff: 'P1' },
    { pg: '198', file: 'lida-198.xml', staff: 'P1' },
  ],
  applyCorrections: applyTenorMeasureCorrections,
  sectionTransitions: TENOR_SECTION_TRANSITIONS,
});
