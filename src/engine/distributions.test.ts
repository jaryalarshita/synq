import { describe, it, expect } from 'vitest'
import { sampleUniform, sampleNormal, sampleDistribution, pickWeightedIndex } from './distributions'

/** Deterministic RNG cycling through the given values. */
function rngOf(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('sampleUniform', () => {
  it('maps the RNG range onto the requested bounds', () => {
    expect(sampleUniform(10, 20, rngOf(0))).toBe(10)
    expect(sampleUniform(10, 20, rngOf(0.5))).toBe(15)
    expect(sampleUniform(10, 20, rngOf(0.999999))).toBeCloseTo(20, 4)
  })

  it('tolerates inverted bounds', () => {
    expect(sampleUniform(20, 10, rngOf(0))).toBe(10)
  })

  it('stays inside the range across many draws', () => {
    for (let i = 0; i < 500; i++) {
      const value = sampleUniform(-5, 5)
      expect(value).toBeGreaterThanOrEqual(-5)
      expect(value).toBeLessThanOrEqual(5)
    }
  })
})

describe('sampleNormal', () => {
  it('returns the mean when the Box-Muller draw is the distribution centre', () => {
    // cos(2π * 0.25) === 0, so the standard-normal term vanishes.
    expect(sampleNormal(100, 15, rngOf(0.5, 0.25))).toBeCloseTo(100, 10)
  })

  it('scales the deviation by stdDev', () => {
    const tight = sampleNormal(0, 1, rngOf(0.1, 0))
    const wide = sampleNormal(0, 10, rngOf(0.1, 0))
    expect(Math.abs(wide)).toBeCloseTo(Math.abs(tight) * 10, 6)
  })

  it('produces a sample mean and deviation close to the configured ones', () => {
    const samples = Array.from({ length: 20000 }, () => sampleNormal(50, 10))
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length

    expect(mean).toBeGreaterThan(49.5)
    expect(mean).toBeLessThan(50.5)
    expect(Math.sqrt(variance)).toBeGreaterThan(9.5)
    expect(Math.sqrt(variance)).toBeLessThan(10.5)
  })

  it('never returns NaN even when the first draw is zero', () => {
    // A zero u1 would make log(0) = -Infinity; the helper redraws instead.
    expect(Number.isNaN(sampleNormal(5, 1, rngOf(0, 0.5, 0.5)))).toBe(false)
  })
})

describe('sampleDistribution', () => {
  it('samples uniformly between min and max', () => {
    const value = sampleDistribution({ kind: 'uniform', min: 0, max: 100 }, rngOf(0.25))
    expect(value).toBe(25)
  })

  it('clamps normal samples into the configured bounds', () => {
    // A far-out draw would land well below zero without the clamp.
    const value = sampleDistribution(
      { kind: 'normal', mean: 5, stdDev: 100, min: 0, max: 10 },
      rngOf(0.99, 0.5)
    )
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(10)
  })

  it('keeps normal samples unclamped when no bounds are given', () => {
    const samples = Array.from({ length: 2000 }, () =>
      sampleDistribution({ kind: 'normal', mean: 0, stdDev: 50 })
    )
    expect(samples.some((v) => v < 0)).toBe(true)
    expect(samples.some((v) => v > 0)).toBe(true)
  })

  it('treats a negative stdDev as zero spread rather than erroring', () => {
    const value = sampleDistribution({ kind: 'normal', mean: 7, stdDev: -3 }, rngOf(0.3, 0.7))
    expect(value).toBeCloseTo(7, 10)
  })
})

describe('pickWeightedIndex', () => {
  it('honours the weights in proportion', () => {
    const counts = [0, 0, 0]
    for (let i = 0; i < 10000; i++) {
      counts[pickWeightedIndex([80, 15, 5], 3)]++
    }

    expect(counts[0] / 10000).toBeGreaterThan(0.75)
    expect(counts[0] / 10000).toBeLessThan(0.85)
    expect(counts[2] / 10000).toBeLessThan(0.08)
  })

  it('selects the slice the roll lands in', () => {
    // Weights [1,1,2] over a total of 4: rolls map to 0, 1, then 2.
    expect(pickWeightedIndex([1, 1, 2], 3, rngOf(0.1))).toBe(0)
    expect(pickWeightedIndex([1, 1, 2], 3, rngOf(0.3))).toBe(1)
    expect(pickWeightedIndex([1, 1, 2], 3, rngOf(0.9))).toBe(2)
  })

  it('never picks a zero-weight option', () => {
    for (let i = 0; i < 500; i++) {
      expect(pickWeightedIndex([0, 1, 0], 3)).toBe(1)
    }
  })

  it('falls back to a uniform pick when weights are missing or mismatched', () => {
    expect(pickWeightedIndex(undefined, 3, rngOf(0.99))).toBe(2)
    expect(pickWeightedIndex([1, 2], 3, rngOf(0))).toBe(0) // length mismatch
  })

  it('falls back to uniform when every weight is zero', () => {
    expect(pickWeightedIndex([0, 0, 0], 3, rngOf(0.5))).toBe(1)
  })

  it('returns -1 for an empty option list', () => {
    expect(pickWeightedIndex([], 0)).toBe(-1)
  })
})
