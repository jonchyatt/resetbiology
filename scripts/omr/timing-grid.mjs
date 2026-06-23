// timing-grid.mjs
// Shared timing-grid guards for VT3 score-conductor sync builders.

export function pruneTempoCliffAnchors(anchors, options = {}) {
  const minSegmentSecPerBeat = options.minSegmentSecPerBeat ?? 0.35;
  const maxSegmentSecPerBeat = options.maxSegmentSecPerBeat ?? 1.08;
  const maxAdjacentRateJump = options.maxAdjacentRateJump ?? 0.38;
  const out = anchors.slice().sort((a, b) => a.beat - b.beat || a.scoreIndex - b.scoreIndex);
  const removed = [];

  let changed = true;
  while (changed && out.length > 2) {
    changed = false;
    let worst = null;

    for (let i = 1; i < out.length; i++) {
      const prior = out[i - 1];
      const current = out[i];
      const beatDelta = current.beat - prior.beat;
      const timeDelta = current.time - prior.time;
      const rate = timeDelta / beatDelta;
      let score = 0;
      let reason = '';

      if (!(beatDelta > 0 && timeDelta > 0)) {
        score = 99;
        reason = 'nonmonotonic';
      } else if (rate < minSegmentSecPerBeat) {
        score = minSegmentSecPerBeat - rate;
        reason = 'too-fast';
      } else if (rate > maxSegmentSecPerBeat) {
        score = rate - maxSegmentSecPerBeat;
        reason = 'too-slow';
      }
      if (score > 0 && (!worst || score > worst.score)) {
        worst = { index: i, score, reason, rate };
      }
    }

    for (let i = 1; i < out.length - 1; i++) {
      const priorRate = segmentRate(out[i - 1], out[i]);
      const nextRate = segmentRate(out[i], out[i + 1]);
      const jump = Math.abs(nextRate - priorRate);
      if (jump > maxAdjacentRateJump && (!worst || jump - maxAdjacentRateJump > worst.score)) {
        worst = {
          index: i,
          score: jump - maxAdjacentRateJump,
          reason: 'tempo-cliff',
          rate: nextRate,
          previousRate: priorRate,
        };
      }
    }

    if (worst) {
      let removeIndex = worst.index;
      if (removeIndex <= 0) removeIndex = 1;
      if (removeIndex >= out.length - 1) removeIndex = out.length - 2;
      const [anchor] = out.splice(removeIndex, 1);
      removed.push({
        ...anchor,
        removedReason: worst.reason,
        removedRateSecPerBeat: round3(worst.rate),
        previousRateSecPerBeat: Number.isFinite(worst.previousRate) ? round3(worst.previousRate) : null,
      });
      changed = true;
    }
  }

  return { anchors: out, removed };
}

function segmentRate(a, b) {
  return (b.time - a.time) / ((b.beat - a.beat) || 1);
}

function round3(n) {
  return +n.toFixed(3);
}
