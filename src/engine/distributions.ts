import type { NumericDistribution } from '../store/useSynqStore'

/**
 * Statistical sampling helpers for the generator. Kept free of Faker so they
 * can be unit tested (and reasoned about) in isolation, with an injectable RNG
 * that makes every draw deterministic under test.
 */

export type Rng = () => number

/** Uniform sample across [min, max]. */
export function sampleUniform(min: number, max: number, random: Rng = Math.random): number {
  if (max < min) [min, max] = [max, min]
  return min + random() * (max - min)
}

/**
 * Normal (Gaussian) sample via the Box-Muller transform: two uniform draws
 * become one standard-normal value, which is then shifted/scaled to the
 * requested mean and standard deviation. No dependency needed.
 */
export function sampleNormal(mean: number, stdDev: number, random: Rng = Math.random): number {
  // u1 must be > 0 for log(); redraw on the (vanishingly rare) exact zero.
  let u1 = random()
  while (u1 === 0) u1 = random()
  const u2 = random()

  const standardNormal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + standardNormal * stdDev
}

/**
 * Draws a numeric value for a field's configured distribution, clamping the
 * result into [min, max] when those bounds are given. Normal samples are
 * unbounded by nature, so clamping is what keeps e.g. an age column positive.
 */
export function sampleDistribution(
  distribution: NumericDistribution,
  random: Rng = Math.random
): number {
  const { kind, min, max, mean, stdDev } = distribution

  let value: number
  if (kind === 'normal') {
    value = sampleNormal(mean ?? 0, Math.max(0, stdDev ?? 1), random)
  } else {
    value = sampleUniform(min ?? 0, max ?? 1, random)
  }

  if (min !== undefined) value = Math.max(min, value)
  if (max !== undefined) value = Math.min(max, value)
  return value
}

/**
 * Picks an index from `weights` in proportion to their values, by walking a
 * cumulative sum. Falls back to a uniform pick when the weights are missing,
 * mismatched in length, or sum to zero, so a half-configured field still
 * generates data instead of throwing.
 */
export function pickWeightedIndex(
  weights: number[] | undefined,
  length: number,
  random: Rng = Math.random
): number {
  if (length <= 0) return -1

  const usable =
    weights && weights.length === length ? weights.map((w) => (w > 0 ? w : 0)) : null
  const total = usable ? usable.reduce((sum, w) => sum + w, 0) : 0

  if (!usable || total <= 0) {
    return Math.min(length - 1, Math.floor(random() * length))
  }

  let roll = random() * total
  for (let i = 0; i < length; i++) {
    roll -= usable[i]
    if (roll < 0) return i
  }
  return length - 1
}
