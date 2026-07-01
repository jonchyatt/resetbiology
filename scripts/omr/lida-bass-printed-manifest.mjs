export const BASS_SCORE_VERSION = 'lida-rose-bass-six-flat-106-unverified';
export const EXPECTED_BASS_NOTE_COUNT = 106;
export const BASS_PAGE_BOUNDARIES = [
  { page: 196, measureStart: 1, measureEnd: 9 },
  { page: 197, measureStart: 10, measureEnd: 21 },
  { page: 198, measureStart: 22, measureEnd: 34 },
  { page: 199, measureStart: 35, measureEnd: Infinity },
];

export const BASS_SECTION_TRANSITIONS = [
  {
    fromMeasure: 34,
    toMeasure: 35,
    source: 'page-198 bar 34 into page-199 bar 35',
    nextPage: 199,
    nextKeyFifths: 1,
    detail: 'G2 root holds into the next G-major section for two beats',
  },
];

export const PRINTED_BASS_AUDIT_MEASURES = [
  { measure: 5, source: 'page-196 Olin lyric "sky"', notes: [{ pitch: 'Db3', beats: 4, type: 'whole' }] },
  { measure: 9, source: 'page-196 Olin lyric "shy"', notes: [{ pitch: 'Db3', beats: 4, type: 'whole' }] },
  { measure: 13, source: 'page-197 Olin lyric "chime"', notes: [{ pitch: 'Eb3', beats: 4, type: 'whole' }] },
  { measure: 21, source: 'page-197 Olin lyric "name"', notes: [{ pitch: 'Db3', beats: 4, type: 'whole' }] },
  { measure: 29, source: 'page-198 Olin lyric "fine"', notes: [{ pitch: 'Eb3', beats: 4, type: 'whole' }] },
  { measure: 32, source: 'page-198 Olin held root under "mine"', notes: [{ pitch: 'Gb2', beats: 4, type: 'whole' }] },
  { measure: 33, source: 'page-198 Olin continued held root', notes: [{ pitch: 'Gb2', beats: 4, type: 'whole' }] },
  {
    measure: 34,
    source: 'page-198 Olin final root slide',
    notes: [
      { pitch: 'Gb2', beats: 2, type: 'half' },
      { pitch: 'G2', beats: 2, type: 'half' },
    ],
  },
  {
    measure: 35,
    source: 'page-199 Olin held transition',
    notes: [{ pitch: 'G2', beats: 2, type: 'half' }],
    requiredXml: ['<fifths>1</fifths>', '<tie type="stop"/>', '<tied type="stop"></tied>'],
  },
];

export function pageForBassMeasure(measure) {
  return BASS_PAGE_BOUNDARIES.find((boundary) => (
    measure >= boundary.measureStart && measure <= boundary.measureEnd
  ))?.page ?? null;
}
