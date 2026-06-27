// Minimal type surface for soundtouchjs (ships no .d.ts). We use only the
// offline-render path: SoundTouch + SimpleFilter + WebAudioBufferSource.
declare module 'soundtouchjs' {
  export class SoundTouch {
    tempo: number;
    pitch: number;
    rate: number;
  }
  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
  }
  export class SimpleFilter {
    constructor(sourceSound: WebAudioBufferSource, pipe: SoundTouch);
    extract(target: Float32Array, numFrames: number): number;
  }
  export class PitchShifter {
    constructor(context: AudioContext, buffer: AudioBuffer, options?: unknown);
  }
}
