# Simply Sing (resetbiology.com) — UX Paradigm Spec

**File:** `src/components/PitchDefender/SimplySing.tsx`
**Route:** `/pitch-defender/simply-sing`
**Status:** Spec v1 — no code yet. Implementation-ready.
**Sister to:** NoteRunner, PitchforksII, SynthesiaRunner, ChoirPractice
**Audience:** Son (~11yo) auditioning for choir; also any beginner who wants a song-driven singing trainer.

This spec is a faithful translation of the Joytunes **Simply Sing** paradigm into our pitch-defender ecosystem. It is **additive** — NoteRunner stays untouched. Both coexist as sister components, each optimized for a different training mode (NoteRunner = staff notation + pause-on-note; Simply Sing = song-driven karaoke-style continuous play with lyrics).

---

## Section 0 — Research Provenance

**Primary reference:** The official Simply Sing marketing site (`hellosimply.com/simply-sing`) — three hero phone screenshots (`singPhone01`, `singPhone02`, `singPhone03`) were fetched and visually inspected.

**Secondary references:**
- American Songwriter review (`americansongwriter.com/simply-sing-review`)
- Sing.salon review (`sing.salon/articles/tech-reviews/simply-sing-review-practice-singing-in-your-vocal-range`)
- Singalong review (`singalong.net/simply-sing-app-review-can-an-app-really-teach-you-to-sing-from-scratch`)
- App Store listing
- Singing Carrots comparison

**What the screenshots actually showed (load-bearing — this is what we are mimicking):**

1. **Voice Range Selection screen (`singPhone01`) — portrait.**
   Dark purple background (`#3d1a7a`-range). Centered header "Your vocal range". Large display of current range label ("Alto") with a rounded outlined "Change" button under it. A **vertical voice-type picker** on the left with entries (top→bottom): Highest, Soprano, Mezzo, Alto (currently selected — highlighted in teal/cyan `#3FBFB5`-ish), Tenor, Baritone, Bass, Lowest. Each row is a small pill. A stylized silhouette of a singer's head/face fills the right half. Bottom CTA: solid gradient purple "CONTINUE" button, full-width with pill radius.

2. **Song Playing screen (`singPhone02`) — landscape.**
   This is **the whole paradigm**. Deep purple background. A horizontal field of **pill-shaped pitch ribbons**, each representing one sung note, scattered at different vertical positions (= pitch) and different horizontal positions (= time). Colors:
   - **Upcoming ribbons:** teal/cyan (`#3FBFB5`-ish) outlined pills, semi-transparent, no glow.
   - **Currently sung / just-sung ribbon (at the playhead):** bright white with a soft white glow trail/smear emanating backward from the playhead showing the last N milliseconds of the singer's actual pitch trace.
   - **Completed ribbons:** faded/white tint, post-playhead, dimmer.
   A **vertical teal playhead line** cuts through the middle of the field with sparkles/glow at top and bottom.
   Under each ribbon, a small gray lyric syllable (e.g. "done", "We'll", "take", "our", "leave", "and", "go"). The **currently singing word** is duplicated in a large white font centered at the bottom ("is done" with "We'll take our leave and go" below it as a running lyric line).
   **Top-left pill chip:** "CHORUS IV" — the current section. Next to it a small circular album thumbnail.
   Top-right: a green circular checkmark (accuracy? saved?).

3. **Song Lyrics screen (`singPhone03`) — portrait.**
   Same dark purple background. **Top bar:** small square album thumbnail on the left, song title "House of the Rising Sun" in bold white, artist "The Animals" below, a small "MEDIUM ▾" difficulty dropdown, and a green circle checkmark on the right.
   Section chip: "CHORUS I" small-caps gray.
   Lyrics body: large white text with the currently-singing word in bold ("There is a **house** in New Orleans"). Gray lyrics scroll up as the song plays. Next verse greyed out.
   **Bottom bar (portrait-only):** time counters `00:34` / `04:34` on the left, a transport row centered with rewind-15s, play/pause, forward-15s. Right side: a "Singer OFF / Singer" toggle with a microphone icon (probably toggles the original artist vocal track). Below that a "MEDIUM" label.
   **Bottom row of circular buttons:** "Studio" (mic icon) on the left, transport in middle, "Range" (slider icon) on the right.

**Key takeaways from the research:**

- The gameplay field is a **piano-roll-style horizontal scrolling pitch field**, NOT a traditional staff. No staff lines, no ledger lines, no clefs. Just pills at vertical positions.
- Pills are **pill-shaped (rounded rectangles)**, not rectangles and not notehead glyphs. Height is small (consistent per-note), length encodes duration.
- **No fixed scale/key is visible.** The vertical axis is just "pitch space" — there are no visible gridlines or semitone markings. It's a clean, minimal plane where ribbons float at their target height.
- **Lyrics are attached to ribbons.** Each ribbon has its lyric syllable beneath it. The currently-singing phrase is also displayed large at the bottom center for readability.
- The **pitch trail** behind the playhead is the app's signature effect: a glowing smear that shows the last N ms of your actual voice, so you can see whether you were above/below/on each ribbon.
- The app **continuously plays** — the playhead marches across the screen at the song's tempo. You do not pause. If you miss a note, the playhead keeps going.
- **Voice range adaptation**: every song is transposed so the notes fit the chosen voice type's comfortable range. This is load-bearing: it's how an 11-year-old can sing "House of the Rising Sun" without straining.
- **Section navigation**: songs are chunked into `CHORUS I`, `CHORUS II`, `VERSE 1`, `BRIDGE`, etc. The current chip is shown top-left.

**Color palette (derived from screenshots, approximate hex):**
- Background: `#2B1264` → `#3D1A7A` radial gradient (deep royal purple)
- Primary accent / on-pitch / teal: `#3FBFB5` (matches our existing `'Sound Scouts'` world color in `types.ts` line 100)
- Upcoming ribbon fill: `rgba(63, 191, 181, 0.35)` with `rgba(63, 191, 181, 0.7)` outline
- Playhead line: `#3FBFB5` with white-hot core + glow
- Voice trail (on pitch): pure white `rgba(255,255,255,0.9)` with `filter: blur(4px)`
- Voice trail (off pitch): salmon `rgba(255, 130, 120, 0.75)` softly desaturated
- Currently-sung ribbon: `#FFFFFF` with `box-shadow: 0 0 20px rgba(255,255,255,0.8)`
- Completed ribbon: `rgba(255,255,255,0.28)`
- Lyric text (inactive): `rgba(255,255,255,0.45)`
- Lyric text (active): `rgba(255,255,255,1.0)` at 1.4x size
- CTA gradient (purple): `linear-gradient(135deg, #8B5CF6, #6D28D9)` — reuse from `NoteRunner.tsx:566-567`

---

## Section 1 — Concept & Pedagogy

### What Simply Sing is in our ecosystem

Simply Sing is the **song-driven continuous-play** sibling to NoteRunner. Where NoteRunner pauses for every note and lets you settle before accepting the answer, Simply Sing **flows like a real song** — the playhead marches in tempo and you either hit the note or you don't; then the next one comes whether you were ready or not. It is karaoke that grades you.

The pedagogical differences:

| Dimension              | NoteRunner                                   | Simply Sing                                  |
| ---------------------- | -------------------------------------------- | -------------------------------------------- |
| Visual metaphor        | Musical staff with clefs + noteheads         | Piano-roll field of pills at pitch heights   |
| Time model             | Pause-on-note (self-paced)                   | Continuous playhead at song tempo            |
| Lyrics                 | None                                         | First-class — attached to every note         |
| Song selection         | Exercises + short melodies + imported scores | Full songs (audio + lyrics + sections)       |
| Voice range adaptation | None (assumes treble/bass staff)             | Yes — auto-transpose to chosen voice type    |
| Audio backing          | Piano reference on Easy only                 | Full backing track (optionally with vocal)   |
| Scoring                | Per-note accuracy (hold-to-match)            | Per-beat accuracy + overall star rating      |
| Target user            | Learns to read & sing notation               | Learns to sing real songs in tune            |
| Session length         | 30s–3min per exercise                        | 2–4min per song, leaderboard over sessions   |
| Failure mode           | Stalls until you sing it right               | Plays through — you see your misses as red   |

### Why this matters for Jon's son (~11yo choir auditionee)

The son needs two things to pass a choir audition:
1. **Ability to match pitch in context** — not just on isolated notes, but while reading a lyric line at tempo.
2. **Confidence with songs in his voice range** — an 11yo cannot sing "Amazing Grace" in Bb without cracking; Simply Sing's auto-transpose fixes that.

NoteRunner teaches the *mechanics* (where the notes live, what they sound like). Simply Sing gives him a dopamine-loaded way to **practice pitching in real time** on songs he knows, at a tempo that mirrors audition conditions. The scrolling playhead + visible pitch trail is a pitch-matching feedback loop tightened to the frame level — exactly what a kid learning to sing in tune needs.

### Why not rewrite NoteRunner

NoteRunner is earning its keep for users who want to learn staff reading. Simply Sing's paradigm is **fundamentally incompatible** with NoteRunner's pause-on-note loop — you cannot have a continuous playhead and also freeze until the user matches each note. Building Simply Sing as a rewrite would destroy the staff-reading use case. Ship both. (This follows Jon's rule `feedback_v2_alongside_v1.md`.)

### Relationship to SynthesiaRunner

SynthesiaRunner is the closest existing cousin: it has falling blocks, a hit line, continuous tempo, and it reads songs from `pd_composed_*` localStorage. Simply Sing **reuses SynthesiaRunner's data layer entirely** (`SongNote = [semi, beats]`, `pd_composed_*`, VocalTrainer library) but **rotates the field 90°** (horizontal scroll instead of vertical fall), adds **lyrics + sections + voice range + backing audio**, and changes the visual language from "piano-roll blocks above a keyboard" to "pill ribbons on an open plane."

---

## Section 2 — UX Spec

### 2.1 Overall layout

The component has four top-level screens (React state machine):

```
'onboarding'  →  first launch only. Voice range selection + tutorial walkthrough.
'menu'        →  song picker.
'playing'     →  the song field (this is the Simply Sing Paradigm screen).
'results'     →  end-of-song summary + retry.
```

Orientation for playing is **landscape on mobile, full-width on desktop**. The song field is designed to use the entire viewport. Menu/onboarding/results are portrait-friendly.

### 2.2 Onboarding flow (first launch)

**Step 1 — "Welcome" (portrait, full-screen):**
- Background: radial gradient `#2B1264` → `#3D1A7A` with a subtle star field (reuse `StarNestBackground` at low intensity, or static SVG dots to save perf).
- Centered stack:
  - Small app mark (can reuse the Pitch Defender cluster icon)
  - `h1` "Simply Sing" in bold white, tracking tight, shadow `0 0 40px rgba(139,92,246,0.3)` — same treatment as `NoteRunner.tsx:464-466`.
  - Subtitle "Sing real songs. In your voice. At your level." in `rgba(255,255,255,0.6)`.
  - Primary CTA: gradient purple button "Start".

**Step 2 — "What's your voice?"**
- Header "Your vocal range".
- Vertical pill picker (same as `singPhone01`):
  - 8 rows: Highest / Soprano / Mezzo / Alto / Tenor / Baritone / Bass / Lowest.
  - Width ~120px, gap 6px, radius full.
  - Selected state: teal fill `#3FBFB5`, white text, scale 1.05.
  - Unselected: transparent fill, `rgba(63,191,181,0.4)` outline, `rgba(255,255,255,0.7)` text.
- Below picker: large label of current selection (e.g. "Alto") + a gray "Change" outlined button (tappable also = triggers the picker).
- On the right: a stylized silhouette (SVG — inline, ~200px tall). Can be a side-profile of a generic singer. Skip if assets are not ready — leave space.
- Optional: "Hear your range" — plays an ascending arpeggio in the selected range via `playPianoNote` so the kid can hear if it feels comfortable. If he picks a range that's too low/high, let him change.
- Persist selection to `localStorage['ss_voice_range']` (see Section 3).
- CTA: gradient purple "Continue".

**Step 3 — "How to sing" (one-screen tutorial):**
- Static mock of the playing screen with labeled callouts:
  - Arrow to a ribbon: "These pills are the notes you sing."
  - Arrow to the playhead line: "Sing when the line crosses a pill."
  - Arrow to the trail: "The glow shows your voice. Try to keep it on the pills."
  - Arrow to the lyrics: "Sing the words under each pill."
- CTA: "Let's sing" → dumps into menu.

### 2.3 Menu (song picker)

Portrait, scrollable. Reuses NoteRunner menu aesthetic but with Simply Sing terminology.

**Top:**
- Back link to `/pitch-defender` (small gray, top-left).
- Title "Simply Sing" (big, white, purple glow).
- Subtitle "Pick a song".
- Small voice-range chip top-right showing current voice type ("Alto ▾") — tap to re-open voice picker.

**Songs list:**
- Grouped by source:
  1. **Featured** — hand-curated short list (see Section 7 — Open Questions for initial picks). Each card has:
     - Album art thumbnail (square, 56px, rounded 12px) — for built-in songs use a generated gradient icon if we don't have real art; never a placeholder square.
     - Song title in bold white.
     - Artist in `rgba(255,255,255,0.55)`.
     - Right side: difficulty chip ("EASY" / "MEDIUM" / "HARD") + a small heart icon (favorite toggle, persisted to `ss_favorites`).
  2. **★ Your compositions** — reads `pd_composed_*` localStorage (same code path as `NoteRunner.tsx:160-178` and `SynthesiaRunner.tsx:219-237`). Only compositions that have lyrics (opt-in tag, see Section 3) show here.
  3. **★ Vocal Trainer library** — fetched from `/api/vocal-trainer/library` route. Shows any uploaded song. Note: the existing VocalTrainer templates don't have lyrics — they are just audio + extracted melody. For Simply Sing they'd play as instrumental pill tracks with `(no lyrics)` under the ribbons. That's still valuable for warm-up.
  4. **★ MusicXML uploads** — same as NoteRunner: drag-drop or picker, use `extractNotesFromXML` from `extractNotes.ts`.
- Each card on tap → transitions to `'playing'` with the selected song.

**Bottom of menu:**
- Small "Settings" link opens a modal with: change voice range / clear progress / reset tutorial.

### 2.4 Playing screen (THE SIMPLY SING PARADIGM)

Landscape, full-viewport. This is the heart of the spec.

**Overall structure, z-order bottom → top:**
1. Background layer (DOM div, deep purple gradient)
2. Canvas element filling the whole viewport (the pitch field + ribbons + playhead + trails + syllables)
3. DOM overlay for top bar (HTML+CSS — album art, title, section chip, close)
4. DOM overlay for bottom chrome (HTML+CSS — transport, range dial, mic meter, accuracy meter, current lyric line)

This hybrid canvas + DOM split is intentional (see Section 5).

#### 2.4.1 Background

- Full viewport deep purple radial gradient. Center of gradient at 40% top, 50% left. Colors `#3D1A7A` center → `#1A0A3C` edges.
- Subtle star specks (optional, perf-permitting) — 30 small white dots at varying opacity drifting slowly.
- No other background elements — cleanliness matters. Simply Sing's design is built on the purple.

#### 2.4.2 The Pitch Field (canvas)

The canvas occupies the whole viewport. Inside it we draw (in z-order):

**a) Horizontal guide band (optional).** A very faint horizontal gradient band in the middle 60% of the canvas height hinting at "the pitch zone." No gridlines. No ledger lines. This is NOT a staff.

**b) Upcoming pitch ribbons.**
- Each ribbon is a pill: `borderRadius = height / 2`.
- Fill: `rgba(63, 191, 181, 0.28)`.
- Stroke: `rgba(63, 191, 181, 0.7)` 1.5px.
- Height: `14px`.
- Width: proportional to note duration (`beats * PIXELS_PER_BEAT`, recommended 120 px/beat for readability).
- Y position: `songRowCenterY - (semitone - rowCenterSemi) * SEMI_PIXELS` where `SEMI_PIXELS = 12`. So 12 semitones = 144px vertical span — compact but distinct.
- X position: `startX = playheadX + (startTimeSec - currentTimeSec) * PIXELS_PER_SECOND` with `PIXELS_PER_SECOND ≈ bpm * PIXELS_PER_BEAT / 60`.

**c) Currently-active ribbon (the one the playhead is crossing).**
- Fill: pure white `#FFFFFF`.
- Outer glow: `shadowColor = "#FFFFFF"`, `shadowBlur = 22`.
- Scale bump: `height * 1.15` (slight vertical swell).
- A small teal chevron or arrowhead at its left edge pointing right to reinforce "this is the live one."
- If the singer is on pitch for this ribbon (deviation ≤ tolerance), keep white. If off pitch, overlay a salmon `rgba(255,130,120,0.6)` tint instead of white. A kid needs to instantly see "I'm drifting."

**d) Completed ribbons.**
- Fill: `rgba(255,255,255,0.28)` if hit (above accuracy threshold).
- Fill: `rgba(255,120,120,0.28)` if missed.
- No glow, no outline.

**e) Pitch trail (THE KILLER FEATURE).**
- Behind the playhead (to the left, in the last 600ms-worth of pixels).
- Draw a smoothed path of the singer's `staffPosition` over time, rendered as:
  - Outer glow: blurred white stroke, width 12px, `shadowBlur = 16`, low alpha.
  - Inner core: solid white stroke, width 3px, high alpha.
- The path is built from `TrailPoint[]` (see `staffRenderer.ts:647-651` and the pattern already in use by `NoteRunner.tsx:248-255`). Reuse `TrailPoint` directly.
- Color rule:
  - White when the singer is within `TOLERANCE_SEMI` of the active ribbon's pitch.
  - Gradient fade from white → salmon as deviation grows past tolerance.
  - When no ribbon is currently at the playhead (rest or between phrases), draw the trail in `rgba(180, 220, 255, 0.55)` — cool blue, meaning "nothing to match."
- The trail should feel like it's **emerging from the playhead**, not being drawn ahead of it. It shows **history**, not future.

**f) Playhead.**
- A vertical line at `playheadX = viewportWidth * 0.35` (fixed — the field scrolls past it).
- Line: 2px wide, solid `#3FBFB5`.
- Top cap: a small upward-pointing teal triangle (`drawPath`: polygon 8px wide, 8px tall).
- Bottom cap: mirrored triangle.
- Optional sparkles: every frame, spawn 1-2 small white dots at `(playheadX, random Y)` that drift sideways and fade. Don't overdo it.

**g) Lyric syllables (under each ribbon).**
- Canvas text: `font: 11px/1 'Inter', sans-serif`, `fillStyle: rgba(255,255,255,0.55)`.
- Position: `(ribbonX + ribbonWidth/2, ribbonY + 18)` — centered horizontally, just below the pill.
- For the active ribbon, boost fill to `rgba(255,255,255,1.0)` and size to `14px` bold.
- Pre-active syllables stay gray; post-active syllables fade to `rgba(255,255,255,0.3)`.
- If a ribbon has no lyric (instrumental region), skip the text.

**h) Section marker flags (vertical).**
- When the field reaches a new section (`VERSE 2`, `CHORUS`, etc.), draw a subtle vertical dashed line at the section's start time across the full canvas height.
- Label the line with the section name in small caps at the top: `rgba(255,255,255,0.35)`.
- This lets the player see a section boundary coming.

#### 2.4.3 Top bar (DOM, absolute-positioned)

Position: `top: 12px; left: 16px; right: 16px; height: 56px;` — a single horizontal bar sitting over the canvas, transparent background.

Left cluster (flex-row, gap 12px):
- Album art thumbnail (40×40, `rounded-xl`, object-cover). For built-ins, use a gradient tile with the song's first letter.
- Song title (bold white, 14px) stacked over artist (`rgba(255,255,255,0.55)`, 11px).
- **Section chip** — pill-shaped, `px-3 py-1 rounded-full bg-white/10 text-white/80 text-[10px] uppercase tracking-wider`, reading the current section ("CHORUS IV"). The chip is computed from `currentTimeSec` against the song's `sections[]` array.

Right cluster (flex-row, gap 8px):
- Heart icon (favorite toggle) — outlined heart `lucide-heart`; filled + pink (`#ff6fa3`) when favorited. Persists to `ss_favorites`.
- Close (X) icon — on click, navigate back to menu with confirmation if song is in progress (>10s elapsed).

#### 2.4.4 Bottom bar (DOM, absolute-positioned)

Position: `bottom: 16px; left: 16px; right: 16px;` — multi-row flex cluster.

**Row 1 (current lyric line, big, centered):**
- Display style mirrors `singPhone02` bottom text: the currently-singing phrase in large white, the next phrase in lighter gray below.
- Font: `24px bold` active, `16px regular` next, center-aligned, max 2 lines.
- This is driven by `getCurrentPhrase(currentTimeSec, lyricEvents)` (Section 3).
- Fades in 100ms before the first syllable of a phrase, fades out after the last syllable finishes.
- If the song has no lyrics, this row is hidden.

**Row 2 (transport + controls):**
Flex-row, full-width, centered, gap 12px. Left section, center section, right section.

**Left section — Studio / Backing:**
- Button "Studio" — microphone icon. Tapping shows mic source picker (laptop vs USB, reusing `MIC_PROFILES` from `VocalTrainer.tsx:51-54`). Also doubles as mic meter: a thin horizontal bar under the icon fills 0-100% with the live mic RMS amplitude. Fill color: `#3FBFB5` when a pitch is detected, `rgba(255,255,255,0.3)` otherwise. Measured once per frame from `PitchFusion`'s internal RMS (need a small export — see Section 4).

**Center section — Transport:**
- Rewind -15s button: circular, `rounded-full bg-white/10`, `lucide-rewind` icon. Seeks `currentTimeSec -= 15` clamped ≥ 0.
- Play / Pause: larger circular button (56px), `bg-gradient-to-br from-purple-400 to-purple-700`, `lucide-play` or `lucide-pause` icon. On press, toggles the audio playback + the playhead + the mic engine pause state (see Section 5).
- Forward +15s button: circular, `lucide-fast-forward` icon. Seeks `currentTimeSec += 15` clamped ≤ `durationSec`.
- Small time label below the transport: `00:34 / 04:34`, monospace, `rgba(255,255,255,0.55)`.

**Right section — Range dial & accuracy:**
- "Range" circular button, `lucide-sliders-horizontal` icon. Tapping opens a semi-transparent modal with a **semitone shift slider** (-12 … 0 … +12). Dragging re-transposes all upcoming ribbons in real time AND transposes backing audio playback (Web Audio `playbackRate` or pitch shift node — see Section 5). Default: the auto-shift implied by voice range selection. A small numeric badge on the dial button shows the current shift in semitones (e.g., `-3`).
- Accuracy meter: a circular progress ring around the Range button showing overall song accuracy so far (0-100%). Color interpolates from `#ff7878` (low) → `#ffc83c` (mid) → `#64ffa0` (high). Not a percentage number — just the ring fill.

### 2.5 Results screen

Full-screen portrait-friendly overlay after the song finishes.

**Layout:**
- Centered stack on purple background.
- Big star-rating band: 1–5 stars based on accuracy buckets (`< 50%` = 1, `< 65%` = 2, `< 80%` = 3, `< 90%` = 4, `≥ 90%` = 5). Earned stars animate in one by one (staggered fade + scale).
- Song title + artist.
- Stats grid (2×3):
  - ACCURACY: big number
  - NOTES HIT: `X / Y`
  - BEST STREAK: `N`
  - PITCH AVG: `± N cents`
  - TIME: `mm:ss`
  - VOICE: current voice type
- Primary CTA: "Sing Again" (purple gradient).
- Secondary: "Different Song" → menu.
- Tertiary small link: "Save to Progress" → writes to `ss_history` localStorage (see Section 3).

### 2.6 Accessibility

- Every interactive control has a `title`/`aria-label`.
- Color is never the only signal: the current ribbon has a chevron marker, the pitch trail has an arrow tail, the accuracy ring has numeric readout available on long-press.
- Tap targets ≥ 44px.
- Keyboard: Space = play/pause, Left/Right = seek ±15s, Up/Down = semitone shift ±1, Esc = close.
- Screen reader: the current lyric phrase is `aria-live="polite"` so it reads as it changes.

---

## Section 3 — Data Model

### 3.1 Core types

```typescript
// The smallest playable unit
interface SungNote {
  /** Semitones from C4 (C4 = 0). Positive = higher. */
  semitone: number;
  /** Absolute start time in seconds from song start. */
  startSec: number;
  /** Duration in seconds. */
  durSec: number;
  /** Optional: the syllable that lands on this note (e.g. "house", "in"). */
  lyric?: string;
  /** Optional: section id this note belongs to (indexes into song.sections). */
  sectionId?: string;
  /** Optional: confidence/amplitude at extraction time (for ribbon alpha). */
  amplitude?: number;
}

// Section chip (CHORUS I, VERSE 2, BRIDGE, …)
interface SongSection {
  id: string;
  /** Display label shown in chip. */
  label: string;
  /** Start time in seconds. */
  startSec: number;
  /** End time in seconds (exclusive). */
  endSec: number;
}

// Standalone lyric timing (for the big bottom phrase display)
// Redundant with SungNote.lyric for rendering simplicity:
// SungNote.lyric drives the syllables under each pill;
// LyricPhrase drives the large bottom phrase display.
interface LyricPhrase {
  /** Start time in seconds. */
  startSec: number;
  /** End time in seconds. */
  endSec: number;
  /** The full phrase shown large at the bottom. */
  text: string;
  /** Optional: the sectionId this belongs to. */
  sectionId?: string;
}

// The whole song
interface SimplySong {
  /** Unique id (slug or uuid). */
  id: string;
  /** Display title. */
  title: string;
  /** Artist. */
  artist: string;
  /** Difficulty. */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Tempo in bpm. Used for scroll speed calculation. */
  bpm: number;
  /** Total duration in seconds (may be derived from audio). */
  durationSec: number;
  /** Audio backing track URL. Can be null for melody-only play. */
  audioUrl: string | null;
  /**
   * The natural key of the song in semitones from C4.
   * Used so we know how much to shift for voice-range transposition.
   * Example: a song centered around A3 has keyCenterSemi = -3.
   */
  keyCenterSemi: number;
  /** Target notes in song order, ascending by startSec. */
  notes: SungNote[];
  /** Section chunks (verse, chorus, bridge). */
  sections: SongSection[];
  /** Lyric phrases for the bottom display (may be empty). */
  phrases: LyricPhrase[];
  /** Where this song came from — for analytics + UI badges. */
  source: 'featured' | 'composed' | 'vocal-trainer' | 'musicxml';
  /** Optional album art URL or CSS gradient fallback id. */
  artUrl: string | null;
  /** Optional credits / license note. */
  credits?: string;
}

// User voice profile, persisted
type VoiceType =
  | 'highest' | 'soprano' | 'mezzo' | 'alto'
  | 'tenor' | 'baritone' | 'bass' | 'lowest';

interface VoiceProfile {
  /** Selected voice type. */
  type: VoiceType;
  /** Manual override semitone shift (-12 … +12). */
  manualShiftSemi: number;
  /** When onboarding completed. */
  completedAt: string;
}

// Per-song playthrough state (kept in ref during play, written to history on complete)
interface PlaythroughState {
  songId: string;
  startedAt: string;
  currentTimeSec: number;
  isPaused: boolean;
  shiftSemi: number;
  /** Per-note hit/miss/partial results, indexed into song.notes. */
  results: ('pending' | 'hit' | 'miss' | 'partial')[];
  /** Rolling on-pitch percentage (for the accuracy ring). */
  accuracyPct: number;
  /** Current streak of hit-in-a-row. */
  streak: number;
  maxStreak: number;
  /** The last N TrailPoint samples (for rendering). */
  trail: TrailPoint[];
}
```

### 3.2 Voice-type → transposition table

When a user picks a voice type, we compute a default `shiftSemi` that maps the song's `keyCenterSemi` to the middle of that voice's comfortable range. Rough target centers (subject to refinement in Section 7):

| Voice    | Target center semi (from C4) |
| -------- | ---------------------------- |
| Highest  | +12 (C5)                     |
| Soprano  | +7  (G4)                     |
| Mezzo    | +4  (E4)                     |
| Alto     | 0   (C4)                     |
| Tenor    | -3  (A3)                     |
| Baritone | -7  (F3)                     |
| Bass     | -12 (C3)                     |
| Lowest   | -17 (G2)                     |

Compute `autoShiftSemi = round(targetCenter - song.keyCenterSemi)`. Then clamp to `[-12, +12]` (one octave each way max).
Final shift applied to each note: `shiftedSemi = note.semitone + autoShiftSemi + profile.manualShiftSemi`.

### 3.3 Import paths — how we get songs into `SimplySong` shape

We support four import sources, in priority order:

#### 3.3.1 Featured songs (hand-crafted JSON)

Ship 3–5 songs with `public/simply-sing/featured/<slug>/` directories containing:
- `song.json` — a `SimplySong` payload
- `backing.mp3` — the audio (instrumental only, or instrumental+vocal mix if we obtain the rights/use Jon-owned recordings per `feedback_no_copyright_lectures.md`)
- `art.jpg` — album art (optional)

Loader:
```typescript
async function loadFeaturedSong(slug: string): Promise<SimplySong> {
  const r = await fetch(`/simply-sing/featured/${slug}/song.json`);
  const data = await r.json();
  return {
    ...data,
    audioUrl: `/simply-sing/featured/${slug}/backing.mp3`,
    artUrl: `/simply-sing/featured/${slug}/art.jpg`,
    source: 'featured',
  };
}
```

Seed featured list (see Section 7 for Jon's final call):
1. "Amazing Grace" (public domain) — easy.
2. "Twinkle Twinkle Little Star" (public domain) — easy.
3. "House of the Rising Sun" (traditional, public domain arrangement) — medium.
4. "Ode to Joy" (Beethoven) — easy.
5. A Jon-recorded/Donny practice song from the existing VocalTrainer library, promoted here.

#### 3.3.2 Composer (`pd_composed_*` localStorage)

Existing convention. Shape varies — see `Composer.tsx:60-78` and `SynthesiaRunner.tsx:195-218` for the flattening logic that handles legacy flat + new measure-based formats. Reuse that flattening.

**Lyric support:** Composer already has an `MNote.lyric?: string` field (`Composer.tsx:75`). We reuse it. For a composition to appear in Simply Sing, it must have at least 30% of notes with lyric fields. Otherwise it's a Simply Sing candidate without lyrics (still playable; just no lyric row). The UI filter toggle in the menu: "Show instrumental compositions" (default off).

Loader:
```typescript
function loadComposedSong(storageKey: string): SimplySong {
  const comp = JSON.parse(localStorage.getItem(storageKey)!);
  // Use SynthesiaRunner.tsx:195-218 flattener as-is.
  const flat = flattenComposerNotes(comp); // [semi, beats][]
  // Also extract lyrics by walking the measures in parallel.
  const notesWithLyrics = flattenComposerNotesWithLyrics(comp); // SungNote[]
  return {
    id: storageKey,
    title: comp.title || 'Untitled',
    artist: comp.composer || 'You',
    difficulty: 'medium',
    bpm: comp.tempoBpm || 100,
    durationSec: /* computed from total beats */,
    audioUrl: null, // no backing track for Composer songs
    keyCenterSemi: 0, // assume C until we compute it
    notes: notesWithLyrics,
    sections: [], // Composer does not yet express sections
    phrases: [], // synthesized from the lyric fields + note timings
    source: 'composed',
    artUrl: null,
  };
}
```

A one-time helper `flattenComposerNotesWithLyrics(comp)` must be added to a new file `src/components/PitchDefender/simplySingImport.ts` (not Composer.tsx — we don't touch it). It walks `comp.measures[].notes[]`, maintains a cumulative beat cursor, and emits `SungNote` with `startSec = cumulativeBeat * (60/bpm)`. The `lyric` field is a direct passthrough of `MNote.lyric`.

#### 3.3.3 Vocal Trainer library (`/api/vocal-trainer/library`)

Existing API. See `VocalTrainer.tsx:102-115` and the route at `app/api/vocal-trainer/library/route.ts`. Each entry is `{ id, title, audioUrl, templateUrl, createdAt, noteCount }`. Fetch the full template via `templateUrl` to get `{ notes: RawNote[], tempo, durationSec }` where `RawNote` is from Spotify BasicPitch (`pitchMidi`, `startTimeSeconds`, `durationSeconds`, `amplitude`).

Convert with:
```typescript
function vocalTrainerTemplateToSimplySong(tpl: any): SimplySong {
  const notes: SungNote[] = tpl.notes.map((rn: RawNote) => ({
    semitone: rn.pitchMidi - 60, // MIDI 60 = C4 = semitone 0
    startSec: rn.startTimeSeconds,
    durSec: rn.durationSeconds,
    amplitude: rn.amplitude,
    // lyric and sectionId are absent — this source has no lyrics
  }));
  // Estimate keyCenterSemi from the median pitch
  const sorted = [...notes].sort((a, b) => a.semitone - b.semitone);
  const keyCenter = sorted[Math.floor(sorted.length / 2)]?.semitone ?? 0;
  return {
    id: tpl.id,
    title: tpl.title,
    artist: 'Uploaded',
    difficulty: 'medium',
    bpm: tpl.tempo || 100,
    durationSec: tpl.durationSec,
    audioUrl: tpl.audioUrl, // backing audio IS available for this source
    keyCenterSemi: keyCenter,
    notes,
    sections: [],
    phrases: [],
    source: 'vocal-trainer',
    artUrl: null,
  };
}
```

This gives us instrumental-only Simply Sing playback for every VocalTrainer template automatically. The user gets real backing audio + a scrolling ribbon field but no lyrics.

#### 3.3.4 MusicXML upload

Same code path as NoteRunner (`NoteRunner.tsx:100-156`) — reuse `extractNotesFromXML` from `extractNotes.ts`. The `ExtractedNote` type (line 13-22 of `extractNotes.ts`) contains `pitch`, `semitones`, `frequency`, `duration` (in beats), `measure`, `partIndex`. Convert to `SungNote` with a cumulative-beat cursor and bpm.

**Lyric support:** MusicXML has lyric elements but our current `extractNotesFromXML` doesn't parse them. This is a known gap. For v1 Simply Sing: MusicXML imports become no-lyric Simply Sing songs. Adding lyric extraction is a follow-up and lives in `extractNotes.ts`, not in our Simply Sing component.

### 3.4 Persistence keys (localStorage)

- `ss_voice_profile` → JSON `VoiceProfile`. Read on mount. Written on onboarding + range changes.
- `ss_favorites` → JSON `string[]` of song ids.
- `ss_history` → JSON `PlaythroughHistoryEntry[]`, appended after each completion (capped at 200 entries, oldest dropped).
- `ss_onboarding_completed` → boolean.
- Reuse `pd_composed_*` (read-only).

---

## Section 4 — Reusable Components

Concrete file paths + symbols to import. **Do not rebuild anything already in this list.**

### 4.1 Mic + pitch detection

**Import from:** `src/components/PitchDefender/pitchFusion.ts`

```typescript
import {
  PitchFusion,            // class — line 189
  DEFAULT_FUSION_CONFIG,  // const — line 42
  freqToStaffPosition,    // function — line 78
  type FusedPitch,        // interface — line 20
  type FusionConfig,      // interface — line 32
} from '@/components/PitchDefender/pitchFusion';
```

**Usage pattern (copy from `NoteRunner.tsx:242-259`):**
```typescript
const fusion = new PitchFusion({ enableML: false, noiseGateDb: -45 });
await fusion.start((pitch: FusedPitch) => {
  pitchRef.current = pitch;
  if (pitch.isActive) {
    trailRef.current.push({
      staffPosition: pitch.staffPosition,
      confidence: pitch.confidence,
      timestamp: performance.now(),
    });
    if (trailRef.current.length > 200) trailRef.current.shift();
  }
});
// later
fusion.stop();
```

**Critical rules (from `feedback_singing_game_baseline_checklist.md` and known bugs in `SynthesiaRunner.tsx:15-17`):**
- **Use `pitch.isActive` ONLY** for matching, NEVER `pitch.isSettled`. `isSettled` gates too hard and pitch matching will never fire.
- **`enableML: false` in production.** CREPE hangs in production builds.
- **Noise gate `-45` dB** is the Jon-approved sweet spot for quiet singing.
- **Echo suppression:** if we play backing audio via speakers, `markToneEmitted()` from `audioEngine.ts:112` must be called every frame (or keep backing audio on a dedicated `AudioBufferSource` that routes through the shared context so browser AEC handles it). Best answer: require headphones + show a "Headphones recommended" banner on first play.

**Small addition we need (one new export):** `PitchFusion` should expose a `getInputRMS(): number` method so the bottom-bar mic meter can read the amplitude without running its own analyser. This is a 4-line addition to `pitchFusion.ts` — store the RMS computed at line 330 into a private field, expose a getter. If we don't want to touch `pitchFusion.ts` at all, we can run a second `AnalyserNode` off the same mic stream just for the meter. **Recommendation:** do the getter. It's trivial and additive.

### 4.2 Audio playback

**Import from:** `src/components/PitchDefender/audioEngine.ts`

```typescript
import {
  initAudio,              // line 45 — call once at component mount
  playPianoNote,          // line 85 — for the onboarding arpeggio + tutorial
  markToneEmitted,        // line 112 — echo suppression hook
  isWithinToneSuppressionWindow, // line 120
  setMicActive,           // line 234 — mutes music bus when mic on
} from '@/components/PitchDefender/audioEngine';
```

**For the backing track** we need custom logic, since `audioEngine.ts` only exposes the oscillator-based adaptive music (`startMusic` / `stopMusic` — lines 138, 197) and per-note piano samples. Simply Sing needs **arbitrary MP3 playback with seek, pause, playback-rate/pitch, and volume control** — that doesn't exist yet.

**Recommendation:** add a minimal `simplySingAudio.ts` alongside `audioEngine.ts` (do NOT extend `audioEngine.ts` to keep it focused on game SFX). Use the existing singleton `AudioContext` via a new small exported accessor in `audioEngine.ts`:

```typescript
// New export in audioEngine.ts (one line):
export function getAudioContext(): AudioContext { return ctx(); }
```

Then in `simplySingAudio.ts`:
```typescript
import { getAudioContext } from './audioEngine';

export class BackingTrack {
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode;
  private startedAt = 0;
  private pausedAt = 0;
  private isPlaying = false;

  constructor() {
    this.gain = getAudioContext().createGain();
    this.gain.gain.value = 0.8;
    this.gain.connect(getAudioContext().destination);
  }

  async load(url: string) { /* fetch → decodeAudioData → this.buffer */ }
  play(atSec = 0) { /* start source, track startedAt */ }
  pause() { /* stop source, store pausedAt */ }
  seek(sec: number) { /* pause, play(sec) */ }
  getCurrentTime(): number { /* computed from startedAt + ctx.currentTime */ }
  setPlaybackRate(rate: number) { /* source.playbackRate.value */ }
  // pitch shift independent of tempo requires a ScriptProcessor or AudioWorklet;
  // DEFER THIS to Phase 3. For Phase 1-2, apply semitone shift to the
  // RIBBONS only (the visual targets), not to the audio. Jon's son will
  // learn to hear the key and adjust — and many beginners prefer the
  // original key reference.
  setVolume(v: number) { /* gain.gain.value = v */ }
}
```

### 4.3 Song loading & conversion

**From `src/components/PitchDefender/extractNotes.ts`:**
```typescript
import {
  extractNotesFromXML,     // line 43 — MusicXML parser
  notesToSemitoneArray,    // line 159 — simple semitone extraction
  type ExtractedNote,      // line 13
  type ExtractionResult,   // line 24
} from '@/components/PitchDefender/extractNotes';
```

**From `src/components/PitchDefender/extractNotesFromAudio.ts`:**
```typescript
import {
  type RawNote,            // line 16 — BasicPitch shape for VocalTrainer templates
} from '@/components/PitchDefender/extractNotesFromAudio';
```

We don't re-run BasicPitch in Simply Sing — that's VocalTrainer's job. We just consume its outputs via the library API.

### 4.4 Rendering helpers

**From `src/components/PitchDefender/staffRenderer.ts`:**
```typescript
import {
  type TrailPoint,         // line 647 — reuse for pitch-trail points
} from '@/components/PitchDefender/staffRenderer';
```

That's the only thing we need from staffRenderer. **We do NOT use `renderStaff`, `computeLayout`, `drawNoteHeadWithStem`, `drawVoiceOrb`, or `drawCentsIndicator`.** Simply Sing's visual is a piano-roll, not a staff — reusing staff rendering would be architecturally wrong. We write our own `renderPitchField` function that knows about ribbons.

### 4.5 Color map

**From `src/lib/fsrs.ts`:**
```typescript
import { NOTE_COLORS } from '@/lib/fsrs';
```

`NOTE_COLORS` is `Record<string, { hue: number; name: string }>` for C3..C5 (line 32-50 of `fsrs.ts`). Simply Sing uses these **only** for the optional "color by pitch" variant mode — the default visual style is teal-or-white regardless of pitch (because that matches the Simply Sing aesthetic). The user can toggle "colorful notes" in settings and get NOTE_COLORS applied as the ribbon hue, similar to NoteRunner's approach at `NoteRunner.tsx:380-405`.

### 4.6 UI primitives

**Lucide icons** (already installed, used throughout PitchDefender): `lucide-react`. Use `X`, `Play`, `Pause`, `Rewind`, `FastForward`, `Mic`, `MicOff`, `Heart`, `SlidersHorizontal`, `ChevronDown`.

**Tailwind classes** — the existing components use inline styles for the custom colors (see `NoteRunner.tsx:463-576`). Match that style exactly for consistency. Don't introduce a new CSS module.

### 4.7 Summary of what we build vs reuse

| Area                   | Status                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| Mic + pitch fusion     | **Reuse** `PitchFusion` (1 tiny addition: `getInputRMS` getter)     |
| Piano sample playback  | **Reuse** `playPianoNote` (onboarding only)                         |
| Backing track playback | **New** `simplySingAudio.ts` (`BackingTrack` class)                 |
| MusicXML import        | **Reuse** `extractNotesFromXML`                                     |
| Composer import        | **New flattener** in `simplySingImport.ts` (wraps existing logic)   |
| Vocal-trainer import   | **New adapter** in `simplySingImport.ts` (thin wrapper)             |
| Color map              | **Reuse** `NOTE_COLORS` (optional mode)                             |
| Trail data type        | **Reuse** `TrailPoint`                                              |
| Staff rendering        | **Do NOT reuse** — we draw ribbons, not staves                      |
| Voice range table      | **New** — `VOICE_TYPE_CENTERS` constant in the component            |
| Section / lyric system | **New** — `SongSection`, `LyricPhrase` types + resolvers            |
| Component files        | **New** — `SimplySing.tsx`, `simplySingAudio.ts`, `simplySingImport.ts` |
| Route page             | **New** — `app/pitch-defender/simply-sing/page.tsx` (4 lines, copy NoteRunner's) |

---

## Section 5 — Render Pipeline

### 5.1 The split: DOM vs Canvas

**Canvas draws (inside a full-viewport `<canvas>`):**
- Background gradient (optional — can also be a DOM div behind the canvas)
- Pitch ribbons (upcoming, active, completed, missed)
- Pitch trail (the glowing voice smear)
- Playhead line + caps + sparkles
- Per-ribbon lyric syllables (small text under pills)
- Section flags (vertical dashed dividers with labels)

**DOM draws (HTML overlays via absolute-position divs over the canvas):**
- Top bar: album art, title, section chip, favorite, close
- Bottom bar: current phrase (big lyrics), transport, Studio button w/ mic meter, Range dial w/ accuracy ring
- Onboarding screens (all DOM)
- Menu screen (all DOM)
- Results screen (all DOM)

### 5.2 Why this split

- **Canvas for the field** because it has 20–60 animated elements per frame (ribbons + trail + sparkles), needs 60fps, and the tight pixel control for the glow effects. DOM reflow cost at 60fps with 20 pills would kill perf, especially on mobile Chrome.
- **DOM for chrome** because the top/bottom bars are static, click-heavy, and benefit from accessibility primitives (aria labels, keyboard focus, lucide icons, Tailwind). Rebuilding a transport button in canvas is pointless.
- **Canvas for syllable text** because the syllables are attached to moving ribbons — they scroll with them. Rendering 20 DOM `<span>`s that re-position every frame is worse than `ctx.fillText` calls.
- **DOM for the big current-phrase display** because it's static in position and only changes on phrase boundaries.

### 5.3 Canvas setup (copy pattern from `NoteRunner.tsx:189-205`)

```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);

const updateCanvasSize = useCallback(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.scale(dpr, dpr);
  // Recompute viewport-dependent constants (playheadX, row center, etc.)
  layoutRef.current = {
    w: rect.width,
    h: rect.height,
    playheadX: rect.width * 0.35,
    rowCenterY: rect.height * 0.5,
    pxPerSec: (songRef.current.bpm / 60) * PIXELS_PER_BEAT,
  };
}, []);
```

Critical: **only mount the canvas while `phase === 'playing'`**. `NoteRunner.tsx:207-214` documents the exact bug: if the canvas is unmounted when `updateLayout` runs, `layoutRef` stays null and the game loop renders nothing. Same fix applies here.

### 5.4 Game loop

One RAF loop driven by the audio clock (NOT `performance.now`). This is critical for sync with the backing track.

```typescript
const gameLoop = () => {
  const backing = backingTrackRef.current;
  const currentTimeSec = backing?.isPlaying
    ? backing.getCurrentTime()
    : lastKnownTimeRef.current; // frozen when paused

  // 1. Update playthrough state
  //    - advance currentTimeSec
  //    - trim trail (drop points older than 1.2s)
  //    - evaluate the "active ribbon" = the note whose [startSec, startSec+durSec] contains currentTimeSec
  //    - if we crossed into a new ribbon, scroll section chip / lyric phrase
  //    - evaluate hit/miss for any ribbons that just ended

  // 2. Render
  const ctx = canvas.getContext('2d');
  clearCanvas(ctx);
  drawBackground(ctx, layout);
  drawSectionFlags(ctx, song.sections, currentTimeSec, layout);
  drawRibbons(ctx, song.notes, currentTimeSec, layout, playthrough.results);
  drawActiveRibbonHighlight(ctx, activeNote, pitchMatch, layout);
  drawPitchTrail(ctx, trailRef.current, activeNote, layout);
  drawPlayhead(ctx, layout);
  drawSyllables(ctx, song.notes, currentTimeSec, layout);

  // 3. Update DOM overlays via React state (throttled)
  //    - currentTimeSec → bottom transport time label
  //    - current phrase → big bottom text
  //    - current section → top-bar chip
  //    - accuracy → ring fill
  //    - mic RMS → Studio button meter

  rafRef.current = requestAnimationFrame(gameLoop);
};
```

### 5.5 DOM state update throttling

Re-rendering the React tree every frame for the bottom bar would be wasteful. Use this pattern:

```typescript
// Refs for high-frequency data (60fps)
const currentTimeRef = useRef(0);
const accuracyRef = useRef(0);
const currentSectionRef = useRef<SongSection | null>(null);
const currentPhraseRef = useRef<LyricPhrase | null>(null);

// React state only for DOM overlays, updated at 10fps via a separate interval
const [displayTime, setDisplayTime] = useState(0);
const [displayAccuracy, setDisplayAccuracy] = useState(0);
const [displaySection, setDisplaySection] = useState<SongSection | null>(null);
const [displayPhrase, setDisplayPhrase] = useState<LyricPhrase | null>(null);

useEffect(() => {
  if (phase !== 'playing') return;
  const id = setInterval(() => {
    setDisplayTime(currentTimeRef.current);
    setDisplayAccuracy(accuracyRef.current);
    setDisplaySection(currentSectionRef.current);
    setDisplayPhrase(currentPhraseRef.current);
  }, 100); // 10fps is plenty for the chrome
  return () => clearInterval(id);
}, [phase]);
```

Canvas loop runs at 60fps reading refs. DOM updates at 10fps. This matches the SynthesiaRunner architecture (`SynthesiaRunner.tsx:128-140` stores game state in refs).

### 5.6 Audio / playhead sync

The playhead position is computed from `BackingTrack.getCurrentTime()` which reads `audioContext.currentTime - startedAt`. This is the *only* safe source of truth for sync — `performance.now()` will drift vs the audio playback by 10-40ms on mobile and the drift is audible.

For Composer songs (no backing audio), use a virtual clock:
```typescript
// In the game loop:
const now = performance.now();
currentTimeSec += (now - lastFrameTimeRef.current) / 1000;
lastFrameTimeRef.current = now;
```

### 5.7 Hit detection & scoring

For each ribbon, during the interval `[startSec, startSec + durSec]`:
- Sample the singer's `staffPosition` from `pitchRef.current` once per frame.
- Compare to `ribbon.shiftedSemi`. Compute `deviation = |staffPosition - shiftedSemi|` in semitones.
- A frame is "on pitch" if `pitch.isActive === true && deviation ≤ TOLERANCE_SEMI`.
- Accumulate `onPitchFrames` and `totalFrames` for this ribbon.
- When the ribbon passes the playhead (`currentTimeSec > startSec + durSec`), compute `noteAccuracy = onPitchFrames / totalFrames`.
- Bucket:
  - `≥ 0.7` → `'hit'` (award streak + score)
  - `≥ 0.4` → `'partial'` (break streak, small score)
  - `< 0.4` → `'miss'` (break streak, no score)

`TOLERANCE_SEMI` defaults by difficulty: easy `2.5`, medium `1.5`, hard `0.8` — matching NoteRunner (`NoteRunner.tsx:185`).

**Rolling accuracy** = `sum(noteAccuracy) / notesCompleted` (not weighted by duration, for simplicity). Updates the circular ring.

### 5.8 Perf budget

At 60fps on a mid-range phone:
- ~30 ribbons visible in the viewport max (we cull off-screen ribbons)
- ~120 trail points (1.2s at 100 samples/s)
- 1 playhead line + caps + 2-3 sparkles per frame
- ~10 syllable `fillText` calls
- 2-3 section flags visible

Total canvas operations per frame ≈ 200-300 fills/strokes. This is comfortably within budget.

**Culling:** only draw ribbons where `ribbon.endX > -20 && ribbon.startX < viewportWidth + 20`. Use a simple linear scan; for typical song lengths (300 notes) this is <1ms.

---

## Section 6 — Implementation Phases

Each phase is a **working, deployable state**. Ship at each checkpoint.

### Phase 1 — Ribbon field + playhead + one hardcoded song (no mic, no audio)

**Goal:** See ribbons scroll horizontally past a stationary playhead at the correct tempo for a known song. No mic, no audio, no lyrics, no voice range. Just proving the visual engine works.

**Files touched:**
- `src/components/PitchDefender/SimplySing.tsx` (new, ~250 lines)
- `app/pitch-defender/simply-sing/page.tsx` (new, 4 lines — copy `note-runner/page.tsx`)

**Tasks:**
1. Create the component skeleton with `phase` state machine (`menu`/`playing`/`results`). Stub onboarding as a skipped passthrough for now.
2. Hardcode one song: "C major scale" (8 quarter notes at 100bpm, 4.8s total). Define as a `SimplySong` inline.
3. Mount the canvas only while `phase === 'playing'`. Use the same deferred-mount pattern as `NoteRunner.tsx:207-214`.
4. Build `layoutRef`: viewport width, height, `playheadX = w * 0.35`, `rowCenterY = h * 0.5`, `pxPerSec`.
5. Write `drawBackground`, `drawRibbons`, `drawPlayhead`. Ribbons = pills drawn with `ctx.roundRect` (supported in modern browsers; fallback to manual path for Safari).
6. Game loop: advance a virtual clock by dt each frame, cull off-screen ribbons, redraw.
7. Add a manual "Play" button on the menu that starts the playthrough.
8. Add a "Back to menu" close button.

**Visual verification:**
- Open `/pitch-defender/simply-sing`.
- Ribbons enter from the right, drift left across the playhead, and exit on the left.
- Playhead is stationary at 35% from the left.
- Tempo feels correct for 100bpm.
- Screenshot into `data/simply-sing-phase1-ribbons.png` and LOOK at it (per `feedback_visual_verification_loop.md`).

**Done criterion:** Can watch the C-scale scroll past and it *feels* like Simply Sing (minus mic, lyrics, audio). Jon gives a thumbs up.

### Phase 2 — Mic input + pitch trail + on-pitch ribbon highlight

**Goal:** Sing into the mic and see the pitch trail emerge from the playhead. Ribbons turn white when the singer is on pitch; salmon when off.

**Files touched:**
- `src/components/PitchDefender/SimplySing.tsx` (extend)
- `src/components/PitchDefender/pitchFusion.ts` (add 5-line `getInputRMS()` getter — additive, no existing behavior changed)

**Tasks:**
1. Import `PitchFusion`, `FusedPitch`, `DEFAULT_FUSION_CONFIG`, `TrailPoint`.
2. On `'playing'` mount: create `new PitchFusion({ enableML: false, noiseGateDb: -45 })`, call `.start()` with a callback that writes to `pitchRef` and pushes to `trailRef`. Copy the pattern verbatim from `NoteRunner.tsx:244-259`.
3. Add `drawPitchTrail`: walk `trailRef.current`, skip points older than 1.2s, convert `staffPosition` → y via the same mapping as ribbons. Draw a glow stroke + inner core stroke along the path.
4. Add `drawActiveRibbonHighlight`: find the ribbon whose `[startSec, startSec+durSec]` brackets `currentTimeSec`. Compute `deviation = |pitch.staffPosition - ribbon.semitone|`. Draw the ribbon in white (+ glow) if `deviation ≤ TOLERANCE_SEMI`, else in salmon.
5. Add `getInputRMS()` to PitchFusion — just capture the RMS computed at `pitchFusion.ts:330` into a private field and expose a getter.
6. Add a tiny mic-meter bar at the bottom-left of the canvas (temporary — will move to the Studio button in Phase 4).
7. Handle mic permission errors with a friendly banner.

**Visual verification:**
- Sing into the mic. A glowing white trail should appear just left of the playhead following your voice.
- When you hit a ribbon, the ribbon turns white.
- When you drift off, the ribbon goes salmon.
- Screenshot + LOOK.

**Done criterion:** Can sing the C scale and feel the feedback loop. Latency < 50ms from voice to trail visible.

### Phase 3 — Scoring, results screen, and multiple songs

**Goal:** Complete one full playthrough of a song and see a results screen with accuracy. Have more than one song in the menu.

**Files touched:**
- `src/components/PitchDefender/SimplySing.tsx` (extend)

**Tasks:**
1. Add `playthroughRef: PlaythroughState` tracking `results[]`, `accuracyPct`, `streak`, `maxStreak`.
2. Hit detection: per ribbon, accumulate `onPitchFrames` / `totalFrames` as it crosses the playhead. Bucket to `hit` / `partial` / `miss` as in Section 5.7.
3. On song end (`currentTimeSec > durationSec`): transition to `phase === 'results'`.
4. Results screen: star rating, stats grid, Sing Again / Menu buttons. Match NoteRunner's end-screen aesthetic (`NoteRunner.tsx:580-616`).
5. Add 3 more hardcoded songs: ode to joy, twinkle, mary had a little lamb — reuse `SONGS` array from `NoteRunner.tsx:48-57` but annotate with `bpm`, `durationSec`, and generate proper `SungNote[]` with `startSec`/`durSec`.
6. Menu shows all 4 songs as cards.

**Done criterion:** Complete a song start-to-finish, see a 1-5 star rating with honest accuracy. Can replay or pick a different song.

### Phase 4 — Lyrics + sections + the bottom phrase display + top bar

**Goal:** Make it feel like an actual Simply Sing song. Lyrics under ribbons, current phrase big at the bottom, section chip in the top bar.

**Files touched:**
- `src/components/PitchDefender/SimplySing.tsx` (extend)
- `public/simply-sing/featured/` (new — seed songs)

**Tasks:**
1. Extend `SungNote` with `lyric?` and `sectionId?`. Extend `SimplySong` with `sections[]` and `phrases[]`.
2. Craft 2 featured songs (JSON files in `public/simply-sing/featured/`):
   - "Twinkle Twinkle" — short, kid-friendly, all public domain text.
   - "Amazing Grace" — one verse, public domain lyrics.
   - Each as a `song.json` matching the `SimplySong` schema.
3. Loader: `loadFeaturedSong(slug)` fetches + parses.
4. Menu: show featured songs as cards with album art placeholder (gradient tile with first letter).
5. `drawSyllables`: canvas text under each ribbon, bold the active one.
6. DOM top bar: album art, title, artist, section chip (computed from `currentTimeRef` vs `song.sections[]`), favorite, close. Reuse the 10fps interval from Section 5.5.
7. DOM bottom current-phrase display: large white text showing `displayPhrase.text`, next phrase below in lighter gray.

**Done criterion:** Play "Twinkle Twinkle" — see the lyrics on every pill, the current phrase big at the bottom, and the section chip update when the song moves into the second verse.

### Phase 5 — Backing audio + transport + voice range onboarding + semitone dial

**Goal:** Full Simply Sing experience. Onboard the user into a voice range, play real backing audio, scrub/pause/resume.

**Files touched:**
- `src/components/PitchDefender/SimplySing.tsx` (extend)
- `src/components/PitchDefender/simplySingAudio.ts` (new, ~120 lines)
- `src/components/PitchDefender/audioEngine.ts` (add 1-line `getAudioContext` export)
- `public/simply-sing/featured/twinkle/backing.mp3` (new asset)

**Tasks:**
1. Add `getAudioContext()` export to `audioEngine.ts` (1 line, additive).
2. Write `BackingTrack` class in `simplySingAudio.ts` per Section 4.2. Decode on load, play/pause/seek/getCurrentTime/setVolume.
3. Integrate: on `'playing'` start, if `song.audioUrl`, load and play the backing. Use `backing.getCurrentTime()` as the canonical clock.
4. Top bar close: on close, stop backing + mic.
5. Bottom bar transport row: Play/Pause (toggles backing + mic + playhead), Rewind -15s (seeks backing + resets trail), Forward +15s.
6. Studio button on the left with the mic meter (move from the temporary Phase 2 position).
7. Range button on the right with the semitone shift dial (a `<input type="range" min=-12 max=12 step=1>` inside a modal). Changes `profile.manualShiftSemi`. Redraws ribbons on the fly (doesn't touch audio pitch — see Section 4.2 note).
8. Accuracy ring around the Range button.
9. Onboarding flow: voice range picker screen, gated by `ss_onboarding_completed` localStorage flag.
10. Voice range auto-shift: compute `autoShiftSemi` per Section 3.2 when a song loads.
11. Headphones recommendation banner on first play.
12. Echo suppression: if backing audio plays without headphones, call `markToneEmitted()` each frame so `PitchFusion` skips those frames. Or require headphones and suppress the prompt.

**Done criterion:** Kid launches the app, picks "Alto", plays Twinkle, sees lyrics, sings along with real backing audio, ends the song, sees a 4-star rating. Full loop works.

### Phase 6 (stretch — post-ship polish)

- Color-by-pitch mode (toggle in settings, uses `NOTE_COLORS`)
- Favorite songs persistence
- Song history + progress charts (`ss_history`)
- VocalTrainer library import (adapter already spec'd in Section 3.3.3)
- Composer localStorage import with lyric extraction
- MusicXML upload with lyrics (requires extending `extractNotesFromXML` to parse `<lyric>` elements)
- Section skip controls (tap chip to jump)
- Section looping (long-press chip = loop that section for practice)
- Real pitch-shifted backing audio (AudioWorklet-based time-domain pitch shifter OR use `Tone.js`'s `PitchShift` if we add it)
- Sing-a-long duet mode: play the vocal track and the player sings harmony
- Kids' sticker reward system tied to streak milestones
- Mic input device picker (beyond the laptop/USB split)

---

## Section 7 — Open Questions for Jon

Before building Phase 5, we need decisions from Jon. Phases 1-4 can proceed with reasonable defaults. Phases 5+ need these answered:

1. **Default song for the son.**
   - Suggestion: "Twinkle Twinkle" for Phase 1-4 (easiest to craft + test), then "Amazing Grace" as a second. What does his choir actually audition on? If the audition piece is known, it becomes song #1.
   - **Needs:** One specific audition song title from Jon.

2. **Backing audio source for featured songs.**
   - Public domain songs have no rights issues but we need recordings. Options:
     - (a) Jon records himself playing piano/guitar — highest trust, fits `feedback_no_copyright_lectures.md`.
     - (b) Use existing Donny recordings from the VocalTrainer library (`data/vocal-trainer/donny-*.m4a`).
     - (c) Generate backing via the existing oscillator music in `audioEngine.ts` (worst-sounding, but zero asset cost).
   - **Needs:** Jon's call on the source. Per his rule `feedback_no_copyright_lectures.md`, he owns rights to music he uses for personal educational training — we should not be squeamish about including his own recordings.

3. **Default voice range for the son.**
   - 11-year-old unchanged voice is typically in the **Alto or Mezzo** range (A3-F5). We should default onboarding to one of these.
   - **Needs:** Jon's call — does his son currently sing alto or has his voice started changing?

4. **Voice range onboarding: do we include a range-detection test?**
   - Simply Sing does a vocal range test on first launch (sing ascending arpeggios, detect highest/lowest comfortable notes). This is a whole mini-feature.
   - **Recommendation:** Ship Phase 5 with manual range picker only. Defer auto-detection to Phase 6+. Range auto-detection isn't load-bearing for the son's audition goal.
   - **Needs:** Jon confirm or override.

5. **Backing audio + pitch shift: tolerate out-of-key backing?**
   - If we transpose ribbons by -3 semitones for an Alto but play the backing at original pitch, the song will sound "wrong" to the player (ribbons line up for their voice but the backing is in a different key).
   - **Recommendation:** For Phase 5, require the user to either (a) accept the original key and sing along, or (b) mute the backing and sing with just the playhead/pitch trail. Add real pitch-shifted audio in Phase 6 via `AudioWorklet + phase vocoder` or Tone.js.
   - **Needs:** Jon's call on whether Phase 5 should ship with this limitation.

6. **Lyric format for Composer compositions.**
   - Composer's `MNote.lyric` is a per-note syllable (`Composer.tsx:75`). That's perfect for Simply Sing's syllable display but doesn't give us the "big phrase" display easily.
   - **Recommendation:** Synthesize phrases from consecutive lyric-bearing notes separated by rests >= 0.5s. Heuristic, good enough for v1.
   - **Needs:** Jon confirm he's OK with the heuristic or wants explicit phrase markers in Composer.

7. **Section detection from Composer / VocalTrainer.**
   - These sources have no section markers. We could synthesize sections by looking for repeat bars (Composer only) or silence gaps >= 2s (both).
   - **Recommendation:** Phase 4 ships without section synthesis — featured songs have explicit sections in their JSON, Composer/VocalTrainer imports get a single `SONG` section.
   - **Needs:** No urgent decision; flag for later.

8. **Difficulty tiers — what do they control?**
   - Proposed:
     - Easy: `TOLERANCE_SEMI = 2.5`, backing audio at `-6 dB` so your voice is louder, lyrics always visible, section flags always visible.
     - Medium: `TOLERANCE_SEMI = 1.5`, backing at `0 dB`, lyrics visible, section flags visible.
     - Hard: `TOLERANCE_SEMI = 0.8`, backing at `+3 dB`, lyrics only on active ribbon, section flags hidden.
   - **Needs:** Jon approve or adjust.

9. **Score math for the star rating.**
   - Proposed buckets: `< 50%` = 1★, `< 65%` = 2★, `< 80%` = 3★, `< 90%` = 4★, `≥ 90%` = 5★.
   - **Needs:** Jon to confirm these feel right for an 11yo. Don't want to be too punishing.

10. **Headphones enforcement.**
    - Without headphones, backing audio bleeds into the mic and `PitchFusion`'s echo suppression becomes critical. We can either:
      - (a) Require headphones (show a gate screen, no way past it).
      - (b) Warn on first launch but allow.
      - (c) Detect speaker output + mic simultaneously and force-apply `markToneEmitted()` every frame.
    - **Recommendation:** (b) warn + allow. Laptop AEC is decent; kids on Jon's machine probably use headphones already.
    - **Needs:** Jon to confirm.

11. **Favicon / OG for the route.**
    - Minor polish. Skip for Phase 1-5.

12. **Route naming.**
    - Proposed: `/pitch-defender/simply-sing`. Alternative: `/pitch-defender/songs` or `/pitch-defender/karaoke`.
    - **Recommendation:** `/pitch-defender/simply-sing`. It's the paradigm name and matches the filename.
    - **Needs:** Jon confirm.

13. **Where does Simply Sing appear in the PitchDefender hub menu?**
    - `PitchDefender.tsx` probably has a mode/game picker grid. Simply Sing should be added as a card alongside NoteRunner/Pitchforks/etc.
    - **Needs:** Show Jon the exact hub location to add it (outside this spec's scope — that's an implementation detail).

14. **Should Simply Sing persist mid-song progress?**
    - If the kid closes the app mid-song, do we resume where he was?
    - **Recommendation:** No — always start from the beginning. Simplifies state, matches actual Simply Sing behavior.
    - **Needs:** Jon confirm.

---

## Appendix A — Summary of files to create/touch

**New files (all additive):**
- `src/components/PitchDefender/SimplySing.tsx` (~1200 lines when done)
- `src/components/PitchDefender/simplySingAudio.ts` (~120 lines)
- `src/components/PitchDefender/simplySingImport.ts` (~200 lines)
- `app/pitch-defender/simply-sing/page.tsx` (4 lines, copy `note-runner/page.tsx`)
- `public/simply-sing/featured/twinkle/song.json`
- `public/simply-sing/featured/twinkle/backing.mp3` (Jon-supplied or generated)
- `public/simply-sing/featured/amazing-grace/song.json`
- `public/simply-sing/featured/amazing-grace/backing.mp3`

**Modified files (small additive edits only):**
- `src/components/PitchDefender/pitchFusion.ts` — add `getInputRMS(): number` getter (~5 lines)
- `src/components/PitchDefender/audioEngine.ts` — add `export function getAudioContext(): AudioContext` (~1 line)
- `src/components/PitchDefender/PitchDefender.tsx` — add Simply Sing card to the mode picker (~10 lines) [Phase 5 or 6]

**Files NOT touched:**
- `NoteRunner.tsx` — stays exactly as is
- `PitchforksII.tsx` — untouched
- `Composer.tsx` — untouched (we read its localStorage output, we don't modify)
- `VocalTrainer.tsx` — untouched (we read its library API)
- `extractNotes.ts`, `extractNotesFromAudio.ts`, `staffRenderer.ts`, `types.ts` — untouched

**Rule for the implementer:** if you feel the urge to modify `NoteRunner.tsx`, `Composer.tsx`, or `staffRenderer.ts`, STOP. Simply Sing is additive. This follows `feedback_additive_not_destructive.md` and `feedback_v2_alongside_v1.md`.

---

## Appendix B — Line/line references cheat-sheet

Every concrete reference used in this spec, for fast lookup:

| Reference                              | File:Line                                          |
| -------------------------------------- | -------------------------------------------------- |
| PitchFusion class                      | `pitchFusion.ts:189`                               |
| FusedPitch interface                   | `pitchFusion.ts:20`                                |
| FusionConfig interface                 | `pitchFusion.ts:32`                                |
| DEFAULT_FUSION_CONFIG                  | `pitchFusion.ts:42`                                |
| freqToStaffPosition                    | `pitchFusion.ts:78`                                |
| PitchFusion usage pattern              | `NoteRunner.tsx:242-259`                           |
| pitchFusion RMS calculation            | `pitchFusion.ts:328-331`                           |
| TrailPoint type                        | `staffRenderer.ts:647`                             |
| trail push pattern                     | `NoteRunner.tsx:248-255`                           |
| isActive-only rule                     | `SynthesiaRunner.tsx:15-17`                        |
| canvas mount pattern                   | `NoteRunner.tsx:207-214`                           |
| canvas DPR setup                       | `NoteRunner.tsx:189-199`                           |
| initAudio                              | `audioEngine.ts:45`                                |
| playPianoNote                          | `audioEngine.ts:85`                                |
| markToneEmitted                        | `audioEngine.ts:112`                               |
| isWithinToneSuppressionWindow          | `audioEngine.ts:120`                               |
| setMicActive                           | `audioEngine.ts:234`                               |
| echo suppression in tick               | `pitchFusion.ts:316-325`                           |
| NOTE_COLORS                            | `fsrs.ts:32-50`                                    |
| extractNotesFromXML                    | `extractNotes.ts:43`                               |
| ExtractedNote type                     | `extractNotes.ts:13-22`                            |
| ExtractionResult type                  | `extractNotes.ts:24`                               |
| Composer MNote.lyric                   | `Composer.tsx:75`                                  |
| Composer STORAGE_PREFIX                | `Composer.tsx:124`                                 |
| pd_composed_ reader pattern            | `NoteRunner.tsx:160-178`, `SynthesiaRunner.tsx:219-237` |
| Composer notes flattener               | `SynthesiaRunner.tsx:195-218`                      |
| RawNote type                           | `extractNotesFromAudio.ts:16`                      |
| publishToSynthesia                     | `extractNotesFromAudio.ts:196`                     |
| VocalTrainer library fetch             | `VocalTrainer.tsx:102-115`                         |
| /api/vocal-trainer/library route       | `app/api/vocal-trainer/library/route.ts`           |
| MIC_PROFILES                           | `VocalTrainer.tsx:51-54`                           |
| NoteRunner menu aesthetic              | `NoteRunner.tsx:460-576`                           |
| NoteRunner results screen              | `NoteRunner.tsx:580-616`                           |
| NoteRunner song list                   | `NoteRunner.tsx:48-57`                             |
| NoteRunner tolerance table             | `NoteRunner.tsx:185`                               |
| PitchDefender hub                      | `PitchDefender.tsx` (top-level picker, line TBD)   |
| NoteRunner route page                  | `app/pitch-defender/note-runner/page.tsx`          |
| WORLD_CONFIG color palette             | `types.ts:99-105`                                  |
| Sound Scouts teal `#3FBFB5`            | `types.ts:100`                                     |

---

**End of spec. Ready for implementation.**
