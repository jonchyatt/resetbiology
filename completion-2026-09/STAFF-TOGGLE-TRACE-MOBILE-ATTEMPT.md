# Staff-toggle mobile attempt

Date: 2026-09-15
Result: **UNREPRODUCED**. No Part 2 code change is claimed.

## Scope and setup

- Worktree: `C:\Users\jonch\Projects\rb-pitchforks-wt-mic`
- App commit under test: `e673ba076` (`fix(pitchforks): show calm microphone startup state`)
- URL: `http://localhost:3202/pitch-defender/pitchforks-3`
- Browser: fresh Chromium launched by an ephemeral PowerShell here-string piped to `node -`, using the local `playwright` package.
- Viewport/context: `390x844`, `isMobile: true`, `hasTouch: true`, microphone permission granted.
- Fake microphone flags: `--use-fake-device-for-media-stream`, `--use-file-for-fake-audio-capture=C:\Users\jonch\Projects\rb-pitchforks-release-20260913\octave-test-tones\c4.wav`, and `--use-fake-ui-for-media-stream`.
- Instrumentation counted `getUserMedia` calls and Web Audio source starts. It did not log pitch, cents, or Hz values.
- Diagnostics captured page errors and console errors; the run ended with `errors: []`.

## Scenarios attempted

The portrait Staff surface was exercised in the voice demo gameplay lane, which uses the same normal gameplay Staff dock and cue controls but intentionally does not request a microphone.

1. Rapid Staff ON/OFF: six consecutive preference toggles through the portrait Options drawer. The observed states alternated on/off across all six actions; the portrait Staff band mounted and unmounted accordingly. The stage stayed mounted throughout. During the latter rapid toggles the replay control was disabled for an active cue, and there was no error or retry UI.
2. Staff during active cue: after starting a replay cue, the snapshot before the toggle had `replayDisabled: true`, `audioStarts: 2`, and no Staff band. The Staff preference was toggled while that cue was still active; after the toggle the snapshot still had `replayDisabled: true`, the Staff band was mounted, and `audioStarts` remained valid. After the cue settled, `replayDisabled: false` and no error/retry state was present.
3. Staff at the next automatic cue: after the prior cue settled, no replay click was issued while polling. A second `replayDisabled: true` transition was observed after 2080 ms, with the instrumented audio-source count at 7. The portrait Staff drawer was toggled during that transition; it remained mounted, the stage remained mounted, and the replay control later returned to `replayDisabled: false` with the audio-source count at 8.

## Real microphone lane check

- A separate normal voice practice-chamber entry made one `getUserMedia` call, mounted `pf3-boss-room`, progressed to `That note is saved. The next note is ready when you are.`, and showed no microphone retry button or microphone error.
- The normal voice campaign entry was then attempted after returning to the map. It made a second `getUserMedia` call but remained at `CHECKING ROOM` and never mounted the normal gameplay stage in this headless fake-source run. This is the app's existing calibration gate, not evidence that Staff caused a microphone failure; the Staff dock is not rendered in that calibration or practice-boss view.

## Source boundary checked

The current Staff drawer toggle is `PitchforksIII.tsx:12605`, the portrait Staff band is `:12644`, and the Options Staff preference is `:12767`. The replay control is `:12594`. These handlers only update Staff/dock state; the observed run found no Staff-triggered microphone error, cue-control loss, page error, or stage unmount.

## Conclusion

The deeper portrait attempt did not reproduce the reported “Staff toggle kills hint audio / microphone” failure. The demo-lane cue and Staff controls remained live through the requested timing cases, and the separate fake-microphone practice check remained healthy. Because the normal voice campaign could not pass its headless room-calibration gate, this is an honest **not reproduced**, not a claim that the physical iPhone issue is disproven. No Part 2 fix was made.
