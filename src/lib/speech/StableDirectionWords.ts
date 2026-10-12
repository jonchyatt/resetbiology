export type SpokenDirection = 'up' | 'down' | 'left' | 'right'

/** Emits exact direction words from live hypotheses without waiting for utterance finalization. */
export class StableDirectionWords {
  private emitted = new Map<number, number>()

  read(resultIndex: number, transcript: string, isFinal: boolean): SpokenDirection[] {
    const words = transcript.toLowerCase().match(/[a-z]+/g) ?? []
    const isDirection = (word: string): word is SpokenDirection =>
      word === 'up' || word === 'down' || word === 'left' || word === 'right'
    // An unfinished non-command tail can still become a direction ("do" -> "down").
    // ponytail: Exact interim direction words score immediately; if live corrections
    // prove frequent, add a measured acoustic confidence gate at this seam.
    const last = words.at(-1)
    const readyCount = !isFinal && last && !isDirection(last) && !/\s$/.test(transcript)
      ? words.length - 1 : words.length

    const output: SpokenDirection[] = []
    for (let index = this.emitted.get(resultIndex) ?? 0; index < readyCount; index++) {
      const word = words[index]
      if (isDirection(word)) output.push(word)
    }
    this.emitted.set(resultIndex, Math.max(this.emitted.get(resultIndex) ?? 0, readyCount))
    return output
  }
}
