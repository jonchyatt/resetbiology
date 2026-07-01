import { buildLidaPartMusicXml } from './lida-build-part-musicxml.mjs';
import { applyBassMeasureCorrections } from './lida-bass-source-corrections.mjs';
import { BASS_SECTION_TRANSITIONS } from './lida-bass-printed-manifest.mjs';

buildLidaPartMusicXml({
  part: 'Bass',
  slug: 'bass',
  character: 'Olin',
  abbreviation: 'Bass',
  pages: [
    { pg: '196', file: 'lida-196.xml', staff: 'P5' },
    { pg: '197', file: 'lida-197.xml', staff: 'P4' },
    { pg: '198', file: 'lida-198.xml', staff: 'P4' },
  ],
  applyCorrections: applyBassMeasureCorrections,
  sectionTransitions: BASS_SECTION_TRANSITIONS,
});
