# Whisper Voice Recognition for Vision Training

**Date:** 2026-02-26
**Status:** Approved
**Approach:** C — Hybrid (Transformers.js Whisper + keyword post-processing)

## Problem

The current Web Speech API implementation in SnellenChart.tsx is nearly unusable:
- 500ms-2s latency per recognition
- Breaks/stops listening randomly
- Poor accuracy for single-word commands
- No support in Safari/Firefox
- BinocularChart has no voice support at all

## Solution

Replace Web Speech API with Transformers.js Whisper running entirely in the browser via a Web Worker, with a keyword matcher layer for precision.

## Architecture

```
Mic → AudioWorklet (VAD + buffer) → Web Worker (Whisper inference) → KeywordMatcher → Event dispatch → Chart handler
```

### New Files

```
src/lib/speech/
  WhisperService.ts        — Singleton. Loads model, manages Worker, exposes start/stop/onResult
  whisper.worker.ts        — Web Worker running @huggingface/transformers pipeline
  VoiceActivityDetector.ts — AudioWorklet-based VAD (silence detection, chunking)
  KeywordMatcher.ts        — Maps Whisper output → valid answers (directions + letters)
```

### Modified Files

- `SnellenChart.tsx` — Replace Web Speech API with WhisperService.onResult()
- `BinocularChart.tsx` — Add voice support (currently has none)

### Model

- `Xenova/whisper-tiny.en` (~40MB, English-only, fastest inference)
- Cached in IndexedDB via Transformers.js built-in caching — downloads once

### Key Decisions

1. **Web Worker** — All inference off main thread, zero UI jank
2. **AudioWorklet VAD** — Energy-based voice activity detection, no extra model needed
3. **Chunk size** — ~1.5 seconds max per utterance, keeps latency low
4. **Keyword matcher** — Fuzzy maps transcript to valid answer set (4 directions + 13 letters)
5. **Fallback** — If Whisper fails to load, fall back to Web Speech API gracefully
6. **Singleton** — One WhisperService shared across all chart components

### Data Flow

1. User taps mic icon (once) → `WhisperService.start()`
2. AudioWorklet captures mic audio continuously
3. VAD detects speech onset → starts buffering
4. VAD detects silence → sends audio chunk to Web Worker
5. Web Worker runs Whisper → returns transcript
6. KeywordMatcher maps transcript → direction or letter
7. Custom event dispatched → chart handler processes answer
8. Target latency: 300-500ms from end of speech to answer registered

### Scope

- SnellenChart: E-directional voice (replace existing) + letter voice (new)
- BinocularChart: E-directional voice + letter voice (all new)
- Both phone and desktop device modes

### Dependencies

- `@huggingface/transformers` — Whisper inference in browser
- No other new dependencies
