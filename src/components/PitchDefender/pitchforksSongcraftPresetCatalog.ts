/**
 * Original, bundled Songcraft practice material for Pitchforks III.
 *
 * Every raw value is an exact legacy Composer source string. Keep these
 * descriptors literal: the byte hash and authored octave are part of the
 * content contract, so practice never changes or reconstructs a phrase.
 */

export interface SongcraftPresetDescriptor {
  readonly sourceKey: string
  readonly raw: string
  readonly expectedSha256: string
}

export const SONGCRAFT_PRESET_CATALOG = Object.freeze([
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:lantern-steps-c3-d3-v1',
    raw: '{"title":"Lantern Steps · C3–D3","notes":[{"semitones":-12,"beats":1,"pitchName":"C3"},{"semitones":-10,"beats":1,"pitchName":"D3"},{"isRest":true,"beats":1},{"semitones":-12,"beats":0.5,"pitchName":"C3"},{"semitones":-10,"beats":1,"pitchName":"D3"},{"semitones":-12,"beats":1,"pitchName":"C3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"lantern-steps-c3-d3-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/lantern-steps-c3-d3-v1"}}',
    expectedSha256: 'dfc3a2c5344a62a5fd81f820c7cdc0874c3cfafb1d2eb58cf3d819bd498b8fb1',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:lantern-steps-c3-d3-v2',
    raw: '{"title":"Lantern Answer · C3–D3","notes":[{"semitones":-10,"beats":0.5,"pitchName":"D3"},{"semitones":-12,"beats":0.5,"pitchName":"C3"},{"isRest":true,"beats":1},{"semitones":-10,"beats":1,"pitchName":"D3"},{"semitones":-10,"beats":0.5,"pitchName":"D3"},{"semitones":-12,"beats":1,"pitchName":"C3"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"lantern-steps-c3-d3-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/lantern-steps-c3-d3-v2"}}',
    expectedSha256: '13ff3b995158adbb78a0f3e45a3b750184bef5a8ea301798c8cc2f59a093a537',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:lantern-steps-c3-d3-v3',
    raw: '{"title":"Lantern Echo · C3–D3","notes":[{"isRest":true,"beats":0.5},{"semitones":-12,"beats":1,"pitchName":"C3"},{"semitones":-10,"beats":0.5,"pitchName":"D3"},{"semitones":-12,"beats":0.5,"pitchName":"C3"},{"isRest":true,"beats":1},{"semitones":-10,"beats":1,"pitchName":"D3"},{"semitones":-12,"beats":0.5,"pitchName":"C3"},{"semitones":-10,"beats":1,"pitchName":"D3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"lantern-steps-c3-d3-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/lantern-steps-c3-d3-v3"}}',
    expectedSha256: '62b4cf810079f90b2acfdac6f875b819eed92f1442a8755829adca953570be37',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:pebble-reply-d3-e3-v1',
    raw: '{"title":"Pebble Reply · D3–E3","notes":[{"semitones":-10,"beats":1,"pitchName":"D3"},{"semitones":-8,"beats":1,"pitchName":"E3"},{"isRest":true,"beats":1},{"semitones":-10,"beats":0.5,"pitchName":"D3"},{"semitones":-8,"beats":1,"pitchName":"E3"},{"semitones":-10,"beats":1,"pitchName":"D3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"pebble-reply-d3-e3-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/pebble-reply-d3-e3-v1"}}',
    expectedSha256: 'f5df8342d48c406ff1c2d64dadc302a3d1962857feeb9f60e9a9ee78fd26822c',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:pebble-reply-d3-e3-v2',
    raw: '{"title":"Pebble Answer · D3–E3","notes":[{"semitones":-8,"beats":0.5,"pitchName":"E3"},{"semitones":-10,"beats":0.5,"pitchName":"D3"},{"isRest":true,"beats":1},{"semitones":-8,"beats":1,"pitchName":"E3"},{"semitones":-8,"beats":0.5,"pitchName":"E3"},{"semitones":-10,"beats":1,"pitchName":"D3"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"pebble-reply-d3-e3-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/pebble-reply-d3-e3-v2"}}',
    expectedSha256: '185c09e62ecc1525e1172b6e3d2da5fff31e9b25cb913104b79830b014e9426e',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:pebble-reply-d3-e3-v3',
    raw: '{"title":"Pebble Echo · D3–E3","notes":[{"isRest":true,"beats":0.5},{"semitones":-10,"beats":1,"pitchName":"D3"},{"semitones":-8,"beats":0.5,"pitchName":"E3"},{"semitones":-10,"beats":0.5,"pitchName":"D3"},{"isRest":true,"beats":1},{"semitones":-8,"beats":1,"pitchName":"E3"},{"semitones":-10,"beats":0.5,"pitchName":"D3"},{"semitones":-8,"beats":1,"pitchName":"E3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"pebble-reply-d3-e3-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/pebble-reply-d3-e3-v3"}}',
    expectedSha256: '3b61fc2ae4e6170a2f1bdb14dc7033760f330990d6168f5ca923f811d335619d',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:meadow-hinge-e3-f3-v1',
    raw: '{"title":"Meadow Hinge · E3–F3","notes":[{"semitones":-8,"beats":1,"pitchName":"E3"},{"semitones":-7,"beats":1,"pitchName":"F3"},{"isRest":true,"beats":1},{"semitones":-8,"beats":0.5,"pitchName":"E3"},{"semitones":-7,"beats":1,"pitchName":"F3"},{"semitones":-8,"beats":1,"pitchName":"E3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"meadow-hinge-e3-f3-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/meadow-hinge-e3-f3-v1"}}',
    expectedSha256: '0ef77ac76374a34c7894d6ad07e11b6615979944d7561042b8ddb806c86415f7',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:meadow-hinge-e3-f3-v2',
    raw: '{"title":"Meadow Answer · E3–F3","notes":[{"semitones":-7,"beats":0.5,"pitchName":"F3"},{"semitones":-8,"beats":0.5,"pitchName":"E3"},{"isRest":true,"beats":1},{"semitones":-7,"beats":1,"pitchName":"F3"},{"semitones":-7,"beats":0.5,"pitchName":"F3"},{"semitones":-8,"beats":1,"pitchName":"E3"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"meadow-hinge-e3-f3-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/meadow-hinge-e3-f3-v2"}}',
    expectedSha256: 'ab1f751cd4129e63dea8f886440575857b6e3be4164194c7fdd1347e07a49be8',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:meadow-hinge-e3-f3-v3',
    raw: '{"title":"Meadow Echo · E3–F3","notes":[{"isRest":true,"beats":0.5},{"semitones":-8,"beats":1,"pitchName":"E3"},{"semitones":-7,"beats":0.5,"pitchName":"F3"},{"semitones":-8,"beats":0.5,"pitchName":"E3"},{"isRest":true,"beats":1},{"semitones":-7,"beats":1,"pitchName":"F3"},{"semitones":-8,"beats":0.5,"pitchName":"E3"},{"semitones":-7,"beats":1,"pitchName":"F3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"meadow-hinge-e3-f3-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/meadow-hinge-e3-f3-v3"}}',
    expectedSha256: '16c620a8ab76adab5bb149523264596605af4220ff19b7b6a128f6aea3d4dd11',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:cedar-glide-f3-g3-v1',
    raw: '{"title":"Cedar Glide · F3–G3","notes":[{"semitones":-7,"beats":1,"pitchName":"F3"},{"semitones":-5,"beats":1,"pitchName":"G3"},{"isRest":true,"beats":1},{"semitones":-7,"beats":0.5,"pitchName":"F3"},{"semitones":-5,"beats":1,"pitchName":"G3"},{"semitones":-7,"beats":1,"pitchName":"F3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"cedar-glide-f3-g3-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/cedar-glide-f3-g3-v1"}}',
    expectedSha256: 'bd0e7220a5c3eeea7d3c57478af2349e8e5b1f9dd51b19842dff33894fcb17fa',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:cedar-glide-f3-g3-v2',
    raw: '{"title":"Cedar Answer · F3–G3","notes":[{"semitones":-5,"beats":0.5,"pitchName":"G3"},{"semitones":-7,"beats":0.5,"pitchName":"F3"},{"isRest":true,"beats":1},{"semitones":-5,"beats":1,"pitchName":"G3"},{"semitones":-5,"beats":0.5,"pitchName":"G3"},{"semitones":-7,"beats":1,"pitchName":"F3"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"cedar-glide-f3-g3-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/cedar-glide-f3-g3-v2"}}',
    expectedSha256: '0a8f3d554e5c34b6de1f28affa6e5b38ea2186c56720f6c90ea25b8543c28fa9',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:cedar-glide-f3-g3-v3',
    raw: '{"title":"Cedar Echo · F3–G3","notes":[{"isRest":true,"beats":0.5},{"semitones":-7,"beats":1,"pitchName":"F3"},{"semitones":-5,"beats":0.5,"pitchName":"G3"},{"semitones":-7,"beats":0.5,"pitchName":"F3"},{"isRest":true,"beats":1},{"semitones":-5,"beats":1,"pitchName":"G3"},{"semitones":-7,"beats":0.5,"pitchName":"F3"},{"semitones":-5,"beats":1,"pitchName":"G3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"cedar-glide-f3-g3-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/cedar-glide-f3-g3-v3"}}',
    expectedSha256: '2125ad5ee98d6b8b16a0e96da6b845a5c7e7703ee9d7ba74c291923697f202be',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:river-turn-g3-a3-v1',
    raw: '{"title":"River Turn · G3–A3","notes":[{"semitones":-5,"beats":1,"pitchName":"G3"},{"semitones":-3,"beats":1,"pitchName":"A3"},{"isRest":true,"beats":1},{"semitones":-5,"beats":0.5,"pitchName":"G3"},{"semitones":-3,"beats":1,"pitchName":"A3"},{"semitones":-5,"beats":1,"pitchName":"G3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"river-turn-g3-a3-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/river-turn-g3-a3-v1"}}',
    expectedSha256: '361303b5c994e1bb3f5a983e493da008eb5284d32efa2f406d03f26511395c0e',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:river-turn-g3-a3-v2',
    raw: '{"title":"River Answer · G3–A3","notes":[{"semitones":-3,"beats":0.5,"pitchName":"A3"},{"semitones":-5,"beats":0.5,"pitchName":"G3"},{"isRest":true,"beats":1},{"semitones":-3,"beats":1,"pitchName":"A3"},{"semitones":-3,"beats":0.5,"pitchName":"A3"},{"semitones":-5,"beats":1,"pitchName":"G3"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"river-turn-g3-a3-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/river-turn-g3-a3-v2"}}',
    expectedSha256: '0127deee3f4849992b46c95af685efcb950d50da2af516cf96d2a8beeba2dabc',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:river-turn-g3-a3-v3',
    raw: '{"title":"River Echo · G3–A3","notes":[{"isRest":true,"beats":0.5},{"semitones":-5,"beats":1,"pitchName":"G3"},{"semitones":-3,"beats":0.5,"pitchName":"A3"},{"semitones":-5,"beats":0.5,"pitchName":"G3"},{"isRest":true,"beats":1},{"semitones":-3,"beats":1,"pitchName":"A3"},{"semitones":-5,"beats":0.5,"pitchName":"G3"},{"semitones":-3,"beats":1,"pitchName":"A3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"river-turn-g3-a3-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/river-turn-g3-a3-v3"}}',
    expectedSha256: 'a35ef5522f0208afa7a4bd8b82b9c626833da3b12959f5c43cf00dfe5fb249be',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:cloud-ladder-a3-b3-v1',
    raw: '{"title":"Cloud Ladder · A3–B3","notes":[{"semitones":-3,"beats":1,"pitchName":"A3"},{"semitones":-1,"beats":1,"pitchName":"B3"},{"isRest":true,"beats":1},{"semitones":-3,"beats":0.5,"pitchName":"A3"},{"semitones":-1,"beats":1,"pitchName":"B3"},{"semitones":-3,"beats":1,"pitchName":"A3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"cloud-ladder-a3-b3-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/cloud-ladder-a3-b3-v1"}}',
    expectedSha256: '1366d37a711db55452a6623f8342107566907235ae4e3c26fdb73c191c12e3a0',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:cloud-ladder-a3-b3-v2',
    raw: '{"title":"Cloud Answer · A3–B3","notes":[{"semitones":-1,"beats":0.5,"pitchName":"B3"},{"semitones":-3,"beats":0.5,"pitchName":"A3"},{"isRest":true,"beats":1},{"semitones":-1,"beats":1,"pitchName":"B3"},{"semitones":-1,"beats":0.5,"pitchName":"B3"},{"semitones":-3,"beats":1,"pitchName":"A3"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"cloud-ladder-a3-b3-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/cloud-ladder-a3-b3-v2"}}',
    expectedSha256: '219094d28b9cc81f9d7d5fb30252ad064189ddd7900aca75e7fe2d06a782081d',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:cloud-ladder-a3-b3-v3',
    raw: '{"title":"Cloud Echo · A3–B3","notes":[{"isRest":true,"beats":0.5},{"semitones":-3,"beats":1,"pitchName":"A3"},{"semitones":-1,"beats":0.5,"pitchName":"B3"},{"semitones":-3,"beats":0.5,"pitchName":"A3"},{"isRest":true,"beats":1},{"semitones":-1,"beats":1,"pitchName":"B3"},{"semitones":-3,"beats":0.5,"pitchName":"A3"},{"semitones":-1,"beats":1,"pitchName":"B3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"cloud-ladder-a3-b3-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/cloud-ladder-a3-b3-v3"}}',
    expectedSha256: 'ccceed1f1eddbaf3c110c8cedd0e1ab772d57c157b8b03122234b4ff2b91dcc0',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:bell-threshold-b3-c4-v1',
    raw: '{"title":"Bell Threshold · B3–C4","notes":[{"semitones":-1,"beats":1,"pitchName":"B3"},{"semitones":0,"beats":1,"pitchName":"C4"},{"isRest":true,"beats":1},{"semitones":-1,"beats":0.5,"pitchName":"B3"},{"semitones":0,"beats":1,"pitchName":"C4"},{"semitones":-1,"beats":1,"pitchName":"B3"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"bell-threshold-b3-c4-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/bell-threshold-b3-c4-v1"}}',
    expectedSha256: '03da512c31b05502ffd32cdc3fc39f455803dbea2ca54b9658d22e86cecf7de5',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:bell-threshold-b3-c4-v2',
    raw: '{"title":"Bell Answer · B3–C4","notes":[{"semitones":0,"beats":0.5,"pitchName":"C4"},{"semitones":-1,"beats":0.5,"pitchName":"B3"},{"isRest":true,"beats":1},{"semitones":0,"beats":1,"pitchName":"C4"},{"semitones":0,"beats":0.5,"pitchName":"C4"},{"semitones":-1,"beats":1,"pitchName":"B3"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"bell-threshold-b3-c4-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/bell-threshold-b3-c4-v2"}}',
    expectedSha256: '587e3e8ae7a97d1ba76e6050ef62451c3dc004f2eb0104fb57263e79b15e5eb6',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:bell-threshold-b3-c4-v3',
    raw: '{"title":"Bell Echo · B3–C4","notes":[{"isRest":true,"beats":0.5},{"semitones":-1,"beats":1,"pitchName":"B3"},{"semitones":0,"beats":0.5,"pitchName":"C4"},{"semitones":-1,"beats":0.5,"pitchName":"B3"},{"isRest":true,"beats":1},{"semitones":0,"beats":1,"pitchName":"C4"},{"semitones":-1,"beats":0.5,"pitchName":"B3"},{"semitones":0,"beats":1,"pitchName":"C4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"bell-threshold-b3-c4-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/bell-threshold-b3-c4-v3"}}',
    expectedSha256: '0711c22b6e000b89ef87fc1d7b9960e89e652b659424e9fad6d3a09295bd13af',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:hearth-steps-c4-d4-v1',
    raw: '{"title":"Hearth Steps · C4–D4","notes":[{"semitones":0,"beats":1,"pitchName":"C4"},{"semitones":2,"beats":1,"pitchName":"D4"},{"isRest":true,"beats":1},{"semitones":0,"beats":0.5,"pitchName":"C4"},{"semitones":2,"beats":1,"pitchName":"D4"},{"semitones":0,"beats":1,"pitchName":"C4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"hearth-steps-c4-d4-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/hearth-steps-c4-d4-v1"}}',
    expectedSha256: 'd17a93a162747554a9d4cf364d416261621db8e6077a2c35e378377ab8f16256',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:hearth-steps-c4-d4-v2',
    raw: '{"title":"Hearth Answer · C4–D4","notes":[{"semitones":2,"beats":0.5,"pitchName":"D4"},{"semitones":0,"beats":0.5,"pitchName":"C4"},{"isRest":true,"beats":1},{"semitones":2,"beats":1,"pitchName":"D4"},{"semitones":2,"beats":0.5,"pitchName":"D4"},{"semitones":0,"beats":1,"pitchName":"C4"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"hearth-steps-c4-d4-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/hearth-steps-c4-d4-v2"}}',
    expectedSha256: '458fbd7322ac30dfe8604aea36ce64b01d493ef75c27949cf83dc44ee1a3fe0f',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:hearth-steps-c4-d4-v3',
    raw: '{"title":"Hearth Echo · C4–D4","notes":[{"isRest":true,"beats":0.5},{"semitones":0,"beats":1,"pitchName":"C4"},{"semitones":2,"beats":0.5,"pitchName":"D4"},{"semitones":0,"beats":0.5,"pitchName":"C4"},{"isRest":true,"beats":1},{"semitones":2,"beats":1,"pitchName":"D4"},{"semitones":0,"beats":0.5,"pitchName":"C4"},{"semitones":2,"beats":1,"pitchName":"D4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"hearth-steps-c4-d4-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/hearth-steps-c4-d4-v3"}}',
    expectedSha256: '71952e75cadf13e9dcf1712d1aa346fdda90a316706674eb6cb5b70c53ca0891',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:copper-drift-d4-e4-v1',
    raw: '{"title":"Copper Drift · D4–E4","notes":[{"semitones":2,"beats":1,"pitchName":"D4"},{"semitones":4,"beats":1,"pitchName":"E4"},{"isRest":true,"beats":1},{"semitones":2,"beats":0.5,"pitchName":"D4"},{"semitones":4,"beats":1,"pitchName":"E4"},{"semitones":2,"beats":1,"pitchName":"D4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"copper-drift-d4-e4-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/copper-drift-d4-e4-v1"}}',
    expectedSha256: 'a25dde31fb86adfb66e1d68b0832d70cc17f3b442c8a6a8f531839c7854ad7ba',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:copper-drift-d4-e4-v2',
    raw: '{"title":"Copper Answer · D4–E4","notes":[{"semitones":4,"beats":0.5,"pitchName":"E4"},{"semitones":2,"beats":0.5,"pitchName":"D4"},{"isRest":true,"beats":1},{"semitones":4,"beats":1,"pitchName":"E4"},{"semitones":4,"beats":0.5,"pitchName":"E4"},{"semitones":2,"beats":1,"pitchName":"D4"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"copper-drift-d4-e4-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/copper-drift-d4-e4-v2"}}',
    expectedSha256: '7d32ddb8b4b950bf3f76580cea4cd68884d5e953ff89a08abcb09c605790ccbe',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:copper-drift-d4-e4-v3',
    raw: '{"title":"Copper Echo · D4–E4","notes":[{"isRest":true,"beats":0.5},{"semitones":2,"beats":1,"pitchName":"D4"},{"semitones":4,"beats":0.5,"pitchName":"E4"},{"semitones":2,"beats":0.5,"pitchName":"D4"},{"isRest":true,"beats":1},{"semitones":4,"beats":1,"pitchName":"E4"},{"semitones":2,"beats":0.5,"pitchName":"D4"},{"semitones":4,"beats":1,"pitchName":"E4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"copper-drift-d4-e4-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/copper-drift-d4-e4-v3"}}',
    expectedSha256: 'cd0a1b695bde7482eebe85395d384636841e1702707eb5ff8229bdf06c1f07c7',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:quiet-orbit-e4-f4-v1',
    raw: '{"title":"Quiet Orbit · E4–F4","notes":[{"semitones":4,"beats":1,"pitchName":"E4"},{"semitones":5,"beats":1,"pitchName":"F4"},{"isRest":true,"beats":1},{"semitones":4,"beats":0.5,"pitchName":"E4"},{"semitones":5,"beats":1,"pitchName":"F4"},{"semitones":4,"beats":1,"pitchName":"E4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"quiet-orbit-e4-f4-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/quiet-orbit-e4-f4-v1"}}',
    expectedSha256: '1bcddd84e26c4a78b74436cfc919c5cf15be1d3d058b776d4d70541b84a7bae7',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:quiet-orbit-e4-f4-v2',
    raw: '{"title":"Quiet Answer · E4–F4","notes":[{"semitones":5,"beats":0.5,"pitchName":"F4"},{"semitones":4,"beats":0.5,"pitchName":"E4"},{"isRest":true,"beats":1},{"semitones":5,"beats":1,"pitchName":"F4"},{"semitones":5,"beats":0.5,"pitchName":"F4"},{"semitones":4,"beats":1,"pitchName":"E4"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"quiet-orbit-e4-f4-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/quiet-orbit-e4-f4-v2"}}',
    expectedSha256: 'ca1a233309b3704aebecfa46bc0e543fe4e6be2af7862efda052f075001ad30e',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:quiet-orbit-e4-f4-v3',
    raw: '{"title":"Quiet Echo · E4–F4","notes":[{"isRest":true,"beats":0.5},{"semitones":4,"beats":1,"pitchName":"E4"},{"semitones":5,"beats":0.5,"pitchName":"F4"},{"semitones":4,"beats":0.5,"pitchName":"E4"},{"isRest":true,"beats":1},{"semitones":5,"beats":1,"pitchName":"F4"},{"semitones":4,"beats":0.5,"pitchName":"E4"},{"semitones":5,"beats":1,"pitchName":"F4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"quiet-orbit-e4-f4-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/quiet-orbit-e4-f4-v3"}}',
    expectedSha256: 'fbcb5c348d332a705b7b2e58d690708ad0d019af81b1a3b8e36024993e3af1f2',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:mossy-window-f4-g4-v1',
    raw: '{"title":"Mossy Window · F4–G4","notes":[{"semitones":5,"beats":1,"pitchName":"F4"},{"semitones":7,"beats":1,"pitchName":"G4"},{"isRest":true,"beats":1},{"semitones":5,"beats":0.5,"pitchName":"F4"},{"semitones":7,"beats":1,"pitchName":"G4"},{"semitones":5,"beats":1,"pitchName":"F4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"mossy-window-f4-g4-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/mossy-window-f4-g4-v1"}}',
    expectedSha256: '8798697028c49d24acb3e8b74877f5a8462e67d9c50984db48042559797622bb',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:mossy-window-f4-g4-v2',
    raw: '{"title":"Mossy Answer · F4–G4","notes":[{"semitones":7,"beats":0.5,"pitchName":"G4"},{"semitones":5,"beats":0.5,"pitchName":"F4"},{"isRest":true,"beats":1},{"semitones":7,"beats":1,"pitchName":"G4"},{"semitones":7,"beats":0.5,"pitchName":"G4"},{"semitones":5,"beats":1,"pitchName":"F4"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"mossy-window-f4-g4-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/mossy-window-f4-g4-v2"}}',
    expectedSha256: '218109e56cea5922d8f8a675afe05d3d06e11f404fffb227c74924b493c09cf3',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:mossy-window-f4-g4-v3',
    raw: '{"title":"Mossy Echo · F4–G4","notes":[{"isRest":true,"beats":0.5},{"semitones":5,"beats":1,"pitchName":"F4"},{"semitones":7,"beats":0.5,"pitchName":"G4"},{"semitones":5,"beats":0.5,"pitchName":"F4"},{"isRest":true,"beats":1},{"semitones":7,"beats":1,"pitchName":"G4"},{"semitones":5,"beats":0.5,"pitchName":"F4"},{"semitones":7,"beats":1,"pitchName":"G4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"mossy-window-f4-g4-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/mossy-window-f4-g4-v3"}}',
    expectedSha256: '4696a7e823c03b763936aa6162ff308d07cbaba6ecda0263b840d86bffc9cd9f',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:rain-thread-g4-a4-v1',
    raw: '{"title":"Rain Thread · G4–A4","notes":[{"semitones":7,"beats":1,"pitchName":"G4"},{"semitones":9,"beats":1,"pitchName":"A4"},{"isRest":true,"beats":1},{"semitones":7,"beats":0.5,"pitchName":"G4"},{"semitones":9,"beats":1,"pitchName":"A4"},{"semitones":7,"beats":1,"pitchName":"G4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"rain-thread-g4-a4-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/rain-thread-g4-a4-v1"}}',
    expectedSha256: '546476a8b6ea19f765e4802fe57d55d39e4ab8c1175ab48980c837998abae0ef',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:rain-thread-g4-a4-v2',
    raw: '{"title":"Rain Answer · G4–A4","notes":[{"semitones":9,"beats":0.5,"pitchName":"A4"},{"semitones":7,"beats":0.5,"pitchName":"G4"},{"isRest":true,"beats":1},{"semitones":9,"beats":1,"pitchName":"A4"},{"semitones":9,"beats":0.5,"pitchName":"A4"},{"semitones":7,"beats":1,"pitchName":"G4"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"rain-thread-g4-a4-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/rain-thread-g4-a4-v2"}}',
    expectedSha256: 'f274bf0f9b46dbf5e0c349d49f834d52043b3e6d073581f95d932d06df4b29b8',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:rain-thread-g4-a4-v3',
    raw: '{"title":"Rain Echo · G4–A4","notes":[{"isRest":true,"beats":0.5},{"semitones":7,"beats":1,"pitchName":"G4"},{"semitones":9,"beats":0.5,"pitchName":"A4"},{"semitones":7,"beats":0.5,"pitchName":"G4"},{"isRest":true,"beats":1},{"semitones":9,"beats":1,"pitchName":"A4"},{"semitones":7,"beats":0.5,"pitchName":"G4"},{"semitones":9,"beats":1,"pitchName":"A4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"rain-thread-g4-a4-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/rain-thread-g4-a4-v3"}}',
    expectedSha256: '4b08e121e09d88468cd9066fe42ca1c25d1c5e1cfc1d078c67fa6ee21687e108',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:amber-pair-a4-b4-v1',
    raw: '{"title":"Amber Pair · A4–B4","notes":[{"semitones":9,"beats":1,"pitchName":"A4"},{"semitones":11,"beats":1,"pitchName":"B4"},{"isRest":true,"beats":1},{"semitones":9,"beats":0.5,"pitchName":"A4"},{"semitones":11,"beats":1,"pitchName":"B4"},{"semitones":9,"beats":1,"pitchName":"A4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"amber-pair-a4-b4-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/amber-pair-a4-b4-v1"}}',
    expectedSha256: 'f613cf4d16ae2d1df586cf82194b02a34c3bafb6360faa1e5cb3eef45471708e',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:amber-pair-a4-b4-v2',
    raw: '{"title":"Amber Answer · A4–B4","notes":[{"semitones":11,"beats":0.5,"pitchName":"B4"},{"semitones":9,"beats":0.5,"pitchName":"A4"},{"isRest":true,"beats":1},{"semitones":11,"beats":1,"pitchName":"B4"},{"semitones":11,"beats":0.5,"pitchName":"B4"},{"semitones":9,"beats":1,"pitchName":"A4"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"amber-pair-a4-b4-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/amber-pair-a4-b4-v2"}}',
    expectedSha256: 'a94eb37c9d3f977162e1426b498b8d2e46cf193f77740a51ac65467ef041719f',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:amber-pair-a4-b4-v3',
    raw: '{"title":"Amber Echo · A4–B4","notes":[{"isRest":true,"beats":0.5},{"semitones":9,"beats":1,"pitchName":"A4"},{"semitones":11,"beats":0.5,"pitchName":"B4"},{"semitones":9,"beats":0.5,"pitchName":"A4"},{"isRest":true,"beats":1},{"semitones":11,"beats":1,"pitchName":"B4"},{"semitones":9,"beats":0.5,"pitchName":"A4"},{"semitones":11,"beats":1,"pitchName":"B4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"amber-pair-a4-b4-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/amber-pair-a4-b4-v3"}}',
    expectedSha256: '62291423f154fbaaf330714a4096e83c67820d089c4ea8626b3a5d45ad88ab83',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:frosted-gate-b4-c5-v1',
    raw: '{"title":"Frosted Gate · B4–C5","notes":[{"semitones":11,"beats":1,"pitchName":"B4"},{"semitones":12,"beats":1,"pitchName":"C5"},{"isRest":true,"beats":1},{"semitones":11,"beats":0.5,"pitchName":"B4"},{"semitones":12,"beats":1,"pitchName":"C5"},{"semitones":11,"beats":1,"pitchName":"B4"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"frosted-gate-b4-c5-v1","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/frosted-gate-b4-c5-v1"}}',
    expectedSha256: 'e254d88c2c5f6d3d242bb4b6e2bb9ac118beafc06e92bb08d71cc4d7f34552f6',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:frosted-gate-b4-c5-v2',
    raw: '{"title":"Frosted Answer · B4–C5","notes":[{"semitones":12,"beats":0.5,"pitchName":"C5"},{"semitones":11,"beats":0.5,"pitchName":"B4"},{"isRest":true,"beats":1},{"semitones":12,"beats":1,"pitchName":"C5"},{"semitones":12,"beats":0.5,"pitchName":"C5"},{"semitones":11,"beats":1,"pitchName":"B4"},{"isRest":true,"beats":0.5}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"frosted-gate-b4-c5-v2","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/frosted-gate-b4-c5-v2"}}',
    expectedSha256: 'd3de50c0bd1e8ac5df45fa9b306e0c0ee9796d49483b4b0db227674d1f7b2986',
  }),
  Object.freeze({
    sourceKey: 'builtin:practice:storm-studies:1:frosted-gate-b4-c5-v3',
    raw: '{"title":"Frosted Echo · B4–C5","notes":[{"isRest":true,"beats":0.5},{"semitones":11,"beats":1,"pitchName":"B4"},{"semitones":12,"beats":0.5,"pitchName":"C5"},{"semitones":11,"beats":0.5,"pitchName":"B4"},{"isRest":true,"beats":1},{"semitones":12,"beats":1,"pitchName":"C5"},{"semitones":11,"beats":0.5,"pitchName":"B4"},{"semitones":12,"beats":1,"pitchName":"C5"}],"songcraftPreset":{"packId":"storm-studies","packVersion":"1","presetId":"frosted-gate-b4-c5-v3","author":"Pitchforks III original practice","licenseId":"LicenseRef-Pitchforks-Original-Bundled-Use","licenseText":"Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.","sourceReference":"project:pitchforks-iii/storm-studies/1/frosted-gate-b4-c5-v3"}}',
    expectedSha256: 'de027d0bb4fc165f4295e4dcfdd37e2bb4ad325686a94c11965039fe6311efc6',
  }),
] as const satisfies readonly SongcraftPresetDescriptor[])
