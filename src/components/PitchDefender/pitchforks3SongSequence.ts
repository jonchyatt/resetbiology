import { extractMelodyFromComposition, type ExtractedNote } from './composerExtract'

export interface SongOption {
  key: string
  title: string
  notes: ExtractedNote[]
}

export function loadComposedSongs(): SongOption[] {
  try {
    const out: SongOption[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('pd_composed_')) continue
      try {
        const comp = JSON.parse(localStorage.getItem(key) || '{}')
        const extracted = extractMelodyFromComposition(comp, { skipRests: true })
        if (extracted.length === 0) continue
        out.push({
          key,
          title: comp.title || 'Untitled',
          notes: extracted,
        })
      } catch {}
    }
    return out
  } catch {
    return []
  }
}

export interface SongSequenceState {
  songKey: string
  notes: ExtractedNote[]
  cursor: number
}

export function createSongSequenceState(song: SongOption): SongSequenceState {
  return {
    songKey: song.key,
    notes: song.notes,
    cursor: 0,
  }
}

export function advanceSongSequence(state: SongSequenceState): SongSequenceState {
  return {
    ...state,
    cursor: Math.min(state.cursor + 1, state.notes.length),
  }
}

export function liveNotes(state: SongSequenceState): ExtractedNote[] {
  return state.notes.slice(state.cursor)
}

export function deadNotes(state: SongSequenceState): ExtractedNote[] {
  return state.notes.slice(0, state.cursor)
}

export function __selfTest(): { pass: boolean; results: string[] } {
  const results: string[] = []
  const originalLocalStorage = globalThis.localStorage

  const makeNote = (semi: number): ExtractedNote => ({
    semi,
    beats: 1,
    pitchName: `C${semi}`,
    isRest: false,
    measureIdx: 1,
    beatOffset: semi,
  })

  try {
    const emptyStore: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: emptyStore,
    })

    const emptySongs = loadComposedSongs()
    const emptyLoadPass = Array.isArray(emptySongs) && emptySongs.length === 0
    results.push(`empty localStorage scan: ${emptyLoadPass ? 'pass' : 'fail'}`)

    const notes = [makeNote(0), makeNote(2), makeNote(4)]
    let state = createSongSequenceState({ key: 'pd_composed_selftest', title: 'Self Test', notes })
    for (let i = 0; i < notes.length + 3; i++) {
      state = advanceSongSequence(state)
    }
    const clampPass = state.cursor === notes.length
    results.push(`cursor clamps at notes.length: ${clampPass ? 'pass' : 'fail'}`)

    let partitionPass = true
    for (let cursor = 0; cursor <= notes.length; cursor++) {
      const cursorState: SongSequenceState = { songKey: 'pd_composed_selftest', notes, cursor }
      const dead = deadNotes(cursorState)
      const live = liveNotes(cursorState)
      const partition = [...dead, ...live]
      const noGap = partition.length === notes.length && partition.every((note, idx) => note === notes[idx])
      const noOverlap = dead.every(note => !live.includes(note))
      if (!noGap || !noOverlap) {
        partitionPass = false
        break
      }
    }
    results.push(`live/dead partition: ${partitionPass ? 'pass' : 'fail'}`)

    return {
      pass: emptyLoadPass && clampPass && partitionPass,
      results,
    }
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
  }
}
