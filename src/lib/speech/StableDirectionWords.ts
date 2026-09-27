export type SpokenDirection = 'up' | 'down' | 'left' | 'right'

/** Emits a word once its prefix survives an interim revision, or on the final result. */
export class StableDirectionWords {
  private previous = new Map<number, string[]>()
  private emitted = new Map<number, number>()

  read(resultIndex: number, transcript: string, isFinal: boolean): SpokenDirection[] {
    const words = transcript.toLowerCase().match(/[a-z]+/g) ?? []
    const prior = this.previous.get(resultIndex) ?? []
    let stableCount = isFinal ? words.length : 0
    if (!isFinal) {
      while (stableCount < prior.length && words[stableCount] === prior[stableCount]) stableCount++
    }

    const output: SpokenDirection[] = []
    for (let index = this.emitted.get(resultIndex) ?? 0; index < stableCount; index++) {
      const word = words[index]
      if (word === 'up' || word === 'down' || word === 'left' || word === 'right') output.push(word)
    }
    this.previous.set(resultIndex, words)
    this.emitted.set(resultIndex, Math.max(this.emitted.get(resultIndex) ?? 0, stableCount))
    return output
  }
}
